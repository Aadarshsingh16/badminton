// lib/apiSync.ts — Optimistic background sync queue with offline / waking-backend retry

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

  public getBackendUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  }

  public getPin(): string {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("scorekeeper_pin");
      if (stored) return stored;
    }
    return process.env.NEXT_PUBLIC_SCOREKEEPER_PIN || "badminton2024";
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
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            "x-scorekeeper-pin": this.getPin(),
          },
          body: item.body ? JSON.stringify(item.body) : undefined,
        });

        if (res.ok || res.status === 409) {
          // Success or already exists -> remove from queue
          this.queue = this.queue.filter((q) => q.id !== item.id);
          this.saveQueue();
        } else if (res.status === 401) {
          console.warn("Sync unauthorized (check scorekeeper PIN):", item.url);
          // Don't spin loop on 401
          item.nextRetry = now + 60000;
          item.attempts++;
          this.saveQueue();
        } else {
          // Server error / waking up -> retry with exponential backoff
          item.attempts++;
          const backoff = Math.min(60000, Math.pow(2, item.attempts) * 2000);
          item.nextRetry = now + backoff;
          this.saveQueue();
        }
      } catch (err) {
        // Network offline or failed connection
        item.attempts++;
        const backoff = Math.min(60000, Math.pow(2, item.attempts) * 2000);
        item.nextRetry = now + backoff;
        this.saveQueue();
      }
    }

    this.isProcessing = false;
    this.notify();
  }
}

export const apiSync = new ApiSyncService();
