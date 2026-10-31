// lib/firestoreSync.ts — Direct Firebase Firestore real-time sync & offline persistence
import { db, isFirebaseConfigured } from "./firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { Tournament, Player } from "./types";
import { apiSync } from "./apiSync";

export interface FirestoreDaySession {
  date: string;
  totals: Record<string, number>;
  tournamentIds: string[];
  closed: boolean;
  updatedAt: number;
}

class FirestoreSyncService {
  /**
   * Syncs a single tournament with its matches and config directly to Firestore
   */
  public async syncTournament(tournament: Tournament, players?: Player[]): Promise<boolean> {
    if (!isFirebaseConfigured() || !db || !tournament || tournament.isPractice) {
      return false;
    }

    try {
      const tourneyRef = doc(db, "tournaments", tournament.id);
      const payload: any = {
        id: tournament.id,
        shareSlug: tournament.shareSlug || tournament.id,
        date: tournament.date || (tournament.createdAt ? new Date(tournament.createdAt).toISOString().split("T")[0] : null),
        playerIds: tournament.playerIds || [],
        matches: tournament.matches || [],
        final: tournament.final || null,
        config: tournament.config || {},
        closed: !!tournament.closed,
        status: tournament.closed ? "completed" : "active",
        createdAt: tournament.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(tourneyRef, payload, { merge: true });

      // If players provided, update players collection
      if (Array.isArray(players) && players.length > 0) {
        for (const p of players) {
          const pRef = doc(db, "players", p.id);
          await setDoc(pRef, p, { merge: true });
        }
      }

      return true;
    } catch (err) {
      console.warn("Firestore syncTournament error:", err);
      return false;
    }
  }

  /**
   * Syncs a day session (standings, tournament IDs, and closure status) to Firestore
   */
  public async syncDaySession(
    date: string,
    totals: Record<string, number>,
    tournamentIds: string[],
    closed: boolean = false
  ): Promise<boolean> {
    if (!isFirebaseConfigured() || !db || !date) {
      return false;
    }

    try {
      const dayRef = doc(db, "days", date);
      const payload: FirestoreDaySession = {
        date,
        totals,
        tournamentIds,
        closed,
        updatedAt: Date.now(),
      };
      await setDoc(dayRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn("Firestore syncDaySession error:", err);
      return false;
    }
  }

  /**
   * Real-time listener for a tournament by ID or shareSlug
   */
  public subscribeToTournament(slugOrId: string, onUpdate: (data: any) => void): Unsubscribe | null {
    if (!isFirebaseConfigured() || !db) return null;

    try {
      // Direct doc check first
      const docRef = doc(db, "tournaments", slugOrId);
      return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data());
        }
      });
    } catch (err) {
      console.warn("Firestore subscribeToTournament error:", err);
      return null;
    }
  }

  /**
   * Real-time listener for a day session
   */
  public subscribeToDay(date: string, onUpdate: (data: FirestoreDaySession | null) => void): Unsubscribe | null {
    if (!isFirebaseConfigured() || !db) return null;

    try {
      const docRef = doc(db, "days", date);
      return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as FirestoreDaySession);
        } else {
          onUpdate(null);
        }
      });
    } catch (err) {
      console.warn("Firestore subscribeToDay error:", err);
      return null;
    }
  }

  /**
   * Deep backup: dumps all data from local storage into an exportable JSON object
   */
  public exportAllLocalData(): {
    timestamp: string;
    tournaments: any[];
    completedDays: any[];
    dayTable: any;
    appState: any;
  } {
    if (typeof window === "undefined") {
      return { timestamp: new Date().toISOString(), tournaments: [], completedDays: [], dayTable: null, appState: null };
    }

    const allTourneys = apiSync.recoverAllTournamentsFromStorage();

    let completedDays: any[] = [];
    try {
      const rawDays = localStorage.getItem("badminton_completed_days_v1");
      if (rawDays) completedDays = JSON.parse(rawDays);
    } catch {}

    let appState: any = null;
    try {
      const rawStore = localStorage.getItem("badminton-app-state-v2");
      if (rawStore) appState = JSON.parse(rawStore);
    } catch {}

    return {
      timestamp: new Date().toISOString(),
      tournaments: allTourneys,
      completedDays,
      dayTable: appState?.state?.dayTable || null,
      appState,
    };
  }

  /**
   * Uploads all local tournaments and completed days into Firestore in one batch
   */
  public async uploadAllLocalDataToFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
    if (!isFirebaseConfigured() || !db) {
      return { success: false, count: 0, error: "Firebase is not yet configured in .env.local" };
    }

    try {
      const exportData = this.exportAllLocalData();
      let count = 0;

      // 1. Upload tournaments
      for (const t of exportData.tournaments) {
        if (t && t.id) {
          const tRef = doc(db, "tournaments", t.id);
          await setDoc(tRef, {
            ...t,
            updatedAt: Date.now(),
          }, { merge: true });
          count++;
        }
      }

      // 2. Upload completed days
      for (const cd of exportData.completedDays) {
        if (cd && cd.date) {
          const dRef = doc(db, "days", cd.date);
          await setDoc(dRef, {
            ...cd,
            closed: true,
            updatedAt: Date.now(),
          }, { merge: true });
        }
      }

      // 3. Upload current day table if present
      if (exportData.dayTable && exportData.dayTable.date) {
        const dRef = doc(db, "days", exportData.dayTable.date);
        await setDoc(dRef, {
          date: exportData.dayTable.date,
          totals: exportData.dayTable.totals || {},
          tournamentIds: exportData.dayTable.tournaments || [],
          closed: false,
          updatedAt: Date.now(),
        }, { merge: true });
      }

      return { success: true, count };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message || "Failed uploading to Firestore" };
    }
  }
}

export const firestoreSync = new FirestoreSyncService();
