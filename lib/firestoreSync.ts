// lib/firestoreSync.ts — Direct Firebase Firestore real-time sync & offline persistence
import { db, isFirebaseConfigured } from "./firebase";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { Tournament, Player, CompletedDaySummary } from "./types";
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
   * Fetch full day session and its tournaments from Firestore
   */
  public async getDaySession(date: string): Promise<{ totals: Record<string, number>; tournaments: any[]; dayStandings: any[] } | null> {
    if (!isFirebaseConfigured() || !db || !date) return null;
    try {
      const dayRef = doc(db, "days", date);
      const daySnap = await getDoc(dayRef);
      if (!daySnap.exists()) return null;
      const data = daySnap.data();
      const tourneyIds: string[] = data.tournamentIds || [];
      const tournaments: any[] = [];
      for (const tId of tourneyIds) {
        const tSnap = await getDoc(doc(db, "tournaments", tId));
        if (tSnap.exists()) tournaments.push(tSnap.data());
      }
      return {
        totals: data.totals || {},
        tournaments,
        dayStandings: [],
      };
    } catch (err) {
      console.warn("Firestore getDaySession error:", err);
      return null;
    }
  }

  /**
   * Fetches all tournaments and completed days from Firestore
   */
  public async loadAllFromFirestore(): Promise<{
    tournaments: Tournament[];
    completedDays: CompletedDaySummary[];
  } | null> {
    if (!isFirebaseConfigured() || !db) return null;
    try {
      const tourneysSnap = await getDocs(collection(db, "tournaments"));
      const tournaments: Tournament[] = [];
      tourneysSnap.forEach((d) => {
        tournaments.push(d.data() as Tournament);
      });

      const daysSnap = await getDocs(collection(db, "days"));
      const completedDays: CompletedDaySummary[] = [];
      daysSnap.forEach((d) => {
        const data = d.data();
        if (data.closed) {
          completedDays.push({
            date: data.date,
            totals: data.totals || {},
            topPlayerId: data.topPlayerId || undefined,
            spoonPlayerId: data.spoonPlayerId || undefined,
            tournamentIds: data.tournamentIds || [],
          });
        }
      });

      return { tournaments, completedDays };
    } catch (err) {
      console.warn("Firestore loadAllFromFirestore error:", err);
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

  /**
   * Imports a parsed backup JSON object, stores in local storage, and pushes to Firestore
   */
  public async importAndSyncBackup(data: any): Promise<{ success: boolean; tourneyCount: number; dayCount: number; error?: string }> {
    if (!data || typeof data !== "object") {
      return { success: false, tourneyCount: 0, dayCount: 0, error: "Invalid backup JSON file" };
    }

    let tourneyCount = 0;
    let dayCount = 0;

    // 1. Merge into local storage
    if (typeof window !== "undefined") {
      try {
        if (Array.isArray(data.tournaments) && data.tournaments.length > 0) {
          const rawExisting = localStorage.getItem("badminton_archived_tournaments_v1");
          const existing = rawExisting ? JSON.parse(rawExisting) : [];
          const existingMap: Record<string, any> = {};
          if (Array.isArray(existing)) {
            for (const t of existing) if (t?.id) existingMap[t.id] = t;
          }
          for (const t of data.tournaments) {
            if (t?.id) existingMap[t.id] = t;
          }
          localStorage.setItem("badminton_archived_tournaments_v1", JSON.stringify(Object.values(existingMap)));
        }

        if (Array.isArray(data.completedDays) && data.completedDays.length > 0) {
          const rawDays = localStorage.getItem("badminton_completed_days_v1");
          const existingDays = rawDays ? JSON.parse(rawDays) : [];
          const daysMap: Record<string, any> = {};
          if (Array.isArray(existingDays)) {
            for (const d of existingDays) if (d?.date) daysMap[d.date] = d;
          }
          for (const d of data.completedDays) {
            if (d?.date) daysMap[d.date] = d;
          }
          localStorage.setItem("badminton_completed_days_v1", JSON.stringify(Object.values(daysMap)));
        }
      } catch (e) {
        console.warn("Error merging into local storage:", e);
      }
    }

    // 2. Upload to Firestore if configured
    if (isFirebaseConfigured() && db) {
      try {
        if (Array.isArray(data.tournaments)) {
          for (const t of data.tournaments) {
            if (t?.id) {
              const tRef = doc(db, "tournaments", t.id);
              await setDoc(tRef, { ...t, updatedAt: Date.now() }, { merge: true });
              tourneyCount++;
            }
          }
        }

        if (Array.isArray(data.completedDays)) {
          for (const cd of data.completedDays) {
            if (cd?.date) {
              const dRef = doc(db, "days", cd.date);
              await setDoc(dRef, { ...cd, closed: true, updatedAt: Date.now() }, { merge: true });
              dayCount++;
            }
          }
        }

        if (data.dayTable?.date) {
          const dRef = doc(db, "days", data.dayTable.date);
          await setDoc(dRef, {
            date: data.dayTable.date,
            totals: data.dayTable.totals || {},
            tournamentIds: data.dayTable.tournaments || [],
            closed: false,
            updatedAt: Date.now(),
          }, { merge: true });
          dayCount++;
        }
      } catch (err: any) {
        return { success: false, tourneyCount, dayCount, error: err.message };
      }
    }

    return { success: true, tourneyCount, dayCount };
  }
}

export const firestoreSync = new FirestoreSyncService();
