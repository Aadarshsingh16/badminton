// lib/apiSync.ts — Optimistic background sync queue with offline / waking-backend retry

import { getBackendUrl } from "@/lib/backend";

type SyncStatusListener = (status: { isSyncing: boolean; pendingCount: number; error: boolean }) => void;

interface QueuedItem {
  id: string;
  url: string;
  method: string;
  body: any;
  attempts: number;
  nextRetry: number;
}

const QUEUE_STORAGE_KEY = "badminton_sync_queue_v1";

class ApiSyncService {
  private queue: QueuedItem[] = [];
  private listeners: Set<SyncStatusListener> = new Set();
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadQueue();
      // Listen for network coming back online
      window.addEventListener("online", () => this.processQueue());
      // Process queue periodically
      this.timer = setInterval(() => this.processQueue(), 5000);
    }
  }

  private loadQueue() {
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) {
        this.queue = JSON.parse(saved);
        this.notify();
      }
    } catch (e) {
      console.warn("Failed to load sync queue from localStorage", e);
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notify();
    } catch (e) {
      console.warn("Failed to save sync queue to localStorage", e);
    }
  }

  public subscribe(listener: SyncStatusListener) {
    this.listeners.add(listener);
    listener({
      isSyncing: this.isProcessing,
      pendingCount: this.queue.length,
      error: this.queue.some((item) => item.attempts > 2),
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = {
      isSyncing: this.isProcessing,
      pendingCount: this.queue.length,
      error: this.queue.some((item) => item.attempts > 2),
    };
    this.listeners.forEach((l) => l(status));
  }

  private unauthorizedListeners: Set<() => void> = new Set();

  public onUnauthorized(listener: () => void) {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  private notifyUnauthorized() {
    this.unauthorizedListeners.forEach((l) => l());
  }

  public getBackendUrl(): string {
    return getBackendUrl();
  }

  public getPin(): string {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("scorekeeper_pin");
      if (stored && stored.trim()) return stored.trim();
    }
    return "badminton2024";
  }

  public setPin(pin: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("scorekeeper_pin", pin);
      this.notify();
      this.forceSyncAll();
    }
  }

  public hasPin(): boolean {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("scorekeeper_pin");
      return !!(stored && stored.trim());
    }
    return false;
  }

  /**
   * Directly syncs a tournament, its players, and its matches to the cloud,
   * guaranteeing that the spectator link (/live/[slug]) will immediately find it.
   */
  public async syncTournamentDirectly(tournament: any, players?: any[]): Promise<boolean> {
    if (!tournament || tournament.isPractice) return false;
    const backendUrl = this.getBackendUrl();
    const pin = this.getPin();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-scorekeeper-pin": pin,
    };

    try {
      // 1. Ensure players exist on backend
      if (Array.isArray(players) && players.length > 0) {
        const playerPromises = players.map(p => 
          fetch(`${backendUrl}/players`, {
            method: "POST",
            headers,
            body: JSON.stringify(p),
          }).catch(() => {})
        );
        await Promise.all(playerPromises);
      }

      // 2. Upsert tournament, matches, and final if present
      const tRes = await fetch(`${backendUrl}/tournaments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: tournament.id,
          shareSlug: tournament.shareSlug,
          playerIds: tournament.playerIds,
          matches: tournament.matches,
          final: tournament.final,
          config: tournament.config,
          date: tournament.date,
        }),
      });

      if (!tRes.ok && tRes.status !== 409) {
        console.warn("Direct tournament sync response:", tRes.status);
        return false;
      }

      // 3. Purge matching tournament create item from queue
      this.purgeTournament(tournament.id);
      return true;
    } catch (err) {
      console.warn("Direct tournament sync error:", err);
      return false;
    }
  }

  /**
   * Purge all queued mutation requests for a specific tournament
   * so deleted tournaments are never retried or resurrected.
   */
  public purgeTournament(tournamentId: string) {
    this.queue = this.queue.filter(
      (item) =>
        !(item.url === "/tournaments" && item.body && item.body.id === tournamentId)
    );
    this.saveQueue();
  }

  /**
   * Purge all queued mutation requests for a specific date (day table or day results)
   */
  public purgeDay(date: string) {
    this.queue = this.queue.filter(
      (item) =>
        !(item.url.includes("/day-tables") && (item.body?.date === date || item.url.includes(date))) &&
        !(item.url.includes("/day-results") && item.url.includes(date))
    );
    this.saveQueue();
  }

  /**
   * Immediately reset retry timers and flush all pending queued items.
   */
  public forceSyncAll() {
    this.queue.forEach((item) => {
      item.nextRetry = 0;
      item.attempts = 0;
    });
    this.saveQueue();
    this.processQueue();
  }

  /**
   * Clear all pending items in the sync queue.
   */
  public clearQueue() {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Queue a backend mutation. Tries immediately; if backend is sleeping or offline,
   * will retry in background with exponential backoff.
   */
  public enqueue(endpoint: string, method: string, body: any) {
    const item: QueuedItem = {
      id: Math.random().toString(36).slice(2, 10) + Date.now(),
      url: endpoint.startsWith("http") ? endpoint : `${this.getBackendUrl()}${endpoint}`,
      method,
      body,
      attempts: 0,
      nextRetry: Date.now(),
    };

    this.queue.push(item);
    this.saveQueue();
    this.processQueue();
  }

  public async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    if (typeof window !== "undefined" && !navigator.onLine) return;

    this.isProcessing = true;
    this.notify();

    const now = Date.now();
    const readyItems = this.queue.filter((item) => item.nextRetry <= now);

    for (const item of readyItems) {
      // Drop items that have failed 8+ times
      if (item.attempts >= 8) {
        this.queue = this.queue.filter((q) => q.id !== item.id);
        this.saveQueue();
        continue;
      }

      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            "x-scorekeeper-pin": this.getPin(),
          },
          body: item.body ? JSON.stringify(item.body) : undefined,
        });

        // Always re-read queue before mutating in case a new item was pushed while awaiting fetch
        let currentQueue = JSON.parse(localStorage.getItem("badminton_sync_queue_v1") || "[]");
        let qItem = currentQueue.find((q: QueuedItem) => q.id === item.id);
        
        if (!qItem) continue; // It was deleted elsewhere

        if (res.ok || res.status === 409 || res.status === 400 || res.status === 422) {
          // Success, already exists, or unprocessable -> remove from queue
          this.queue = currentQueue.filter((q: QueuedItem) => q.id !== item.id);
          this.saveQueue();
        } else if (res.status === 404) {
          // If tournament wasn't created yet, don't drop immediately; retry with backoff
          qItem.attempts++;
          const backoff = Math.min(20000, Math.pow(2, qItem.attempts) * 1000);
          qItem.nextRetry = now + backoff;
          this.queue = currentQueue;
          this.saveQueue();
        } else if (res.status === 401) {
          console.warn("Sync unauthorized (check scorekeeper PIN):", item.url);
          // Wait 15s before retrying unauthorized requests
          qItem.nextRetry = now + 15000;
          qItem.attempts++;
          this.queue = currentQueue;
          this.saveQueue();
          this.notifyUnauthorized();
        } else {
          // Server error / waking up -> retry with exponential backoff
          qItem.attempts++;
          const backoff = Math.min(30000, Math.pow(2, qItem.attempts) * 1500);
          qItem.nextRetry = now + backoff;
          this.queue = currentQueue;
          this.saveQueue();
        }
      } catch (err) {
        // Network offline or failed connection
        let currentQueue = JSON.parse(localStorage.getItem("badminton_sync_queue_v1") || "[]");
        let qItem = currentQueue.find((q: QueuedItem) => q.id === item.id);
        if (qItem) {
          qItem.attempts++;
          const backoff = Math.min(30000, Math.pow(2, qItem.attempts) * 1500);
          qItem.nextRetry = now + backoff;
          this.queue = currentQueue;
          this.saveQueue();
        }
      }
    }

    this.isProcessing = false;
    this.notify();
  }
}

export const apiSync = new ApiSyncService();
