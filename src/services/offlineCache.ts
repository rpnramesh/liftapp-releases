// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Offline Cache Service
//
// Persists the critical read-only data that must be available offline:
//   • Client list (last loaded)
//   • Assigned workout plans
//   • Earnings summary
//
// Per TS-011 (Non-Functional Requirements — Offline Mode):
//   "Client list (last-loaded), assigned workout plans, and earnings summary
//    must be readable offline. Actions requiring network show toast."
//
// Install:  npx expo install @react-native-async-storage/async-storage
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClientCard, EarningsSummary, TrainerDashboard, WorkoutPlan } from '../types/trainer.types';

// ─── Cache keys ───────────────────────────────────────────────────────────────

const CACHE_KEYS = {
  CLIENT_LIST: (trainerId: string) => `lift_trainer_${trainerId}_clients`,
  WORKOUT_PLANS: (trainerId: string) => `lift_trainer_${trainerId}_plans`,
  EARNINGS_SUMMARY: (trainerId: string) => `lift_trainer_${trainerId}_earnings_summary`,
  DASHBOARD: (trainerId: string) => `lift_trainer_${trainerId}_dashboard`,
  LAST_UPDATED: (key: string) => `${key}_updated_at`,
} as const;

// ─── Cache TTLs (ms) ─────────────────────────────────────────────────────────

const TTL = {
  CLIENT_LIST: 30 * 60 * 1000,    // 30 minutes
  DASHBOARD: 5 * 60 * 1000,       // 5 minutes (matches Redis TTL on server)
  EARNINGS: 60 * 60 * 1000,       // 1 hour
  PLANS: 60 * 60 * 1000,          // 1 hour
} as const;

// ─── Generic cache helpers ────────────────────────────────────────────────────

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [key, JSON.stringify(data)],
      [CACHE_KEYS.LAST_UPDATED(key), Date.now().toString()],
    ]);
  } catch (err) {
    if (__DEV__) console.warn('[Cache] Write failed:', key, err);
  }
}

async function readCache<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const [[, raw], [, updatedAt]] = await AsyncStorage.multiGet([
      key,
      CACHE_KEYS.LAST_UPDATED(key),
    ]);

    if (!raw) return null;

    // Check TTL
    if (updatedAt) {
      const age = Date.now() - parseInt(updatedAt, 10);
      if (age > ttlMs) return null; // Stale
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([key, CACHE_KEYS.LAST_UPDATED(key)]);
  } catch {}
}

// ─── Client List Cache ────────────────────────────────────────────────────────

export const ClientListCache = {
  save: (trainerId: string, clients: ClientCard[]) =>
    writeCache(CACHE_KEYS.CLIENT_LIST(trainerId), clients),

  load: (trainerId: string): Promise<ClientCard[] | null> =>
    readCache(CACHE_KEYS.CLIENT_LIST(trainerId), TTL.CLIENT_LIST),

  clear: (trainerId: string) =>
    clearCache(CACHE_KEYS.CLIENT_LIST(trainerId)),
};

// ─── Workout Plans Cache ──────────────────────────────────────────────────────

export const WorkoutPlansCache = {
  save: (trainerId: string, plans: WorkoutPlan[]) =>
    writeCache(CACHE_KEYS.WORKOUT_PLANS(trainerId), plans),

  load: (trainerId: string): Promise<WorkoutPlan[] | null> =>
    readCache(CACHE_KEYS.WORKOUT_PLANS(trainerId), TTL.PLANS),

  clear: (trainerId: string) =>
    clearCache(CACHE_KEYS.WORKOUT_PLANS(trainerId)),
};

// ─── Earnings Summary Cache ───────────────────────────────────────────────────

export const EarningsSummaryCache = {
  save: (trainerId: string, summary: EarningsSummary) =>
    writeCache(CACHE_KEYS.EARNINGS_SUMMARY(trainerId), summary),

  load: (trainerId: string): Promise<EarningsSummary | null> =>
    readCache(CACHE_KEYS.EARNINGS_SUMMARY(trainerId), TTL.EARNINGS),

  clear: (trainerId: string) =>
    clearCache(CACHE_KEYS.EARNINGS_SUMMARY(trainerId)),
};

// ─── Dashboard Cache ──────────────────────────────────────────────────────────

export const DashboardCache = {
  save: (trainerId: string, dashboard: TrainerDashboard) =>
    writeCache(CACHE_KEYS.DASHBOARD(trainerId), dashboard),

  load: (trainerId: string): Promise<TrainerDashboard | null> =>
    readCache(CACHE_KEYS.DASHBOARD(trainerId), TTL.DASHBOARD),

  clear: (trainerId: string) =>
    clearCache(CACHE_KEYS.DASHBOARD(trainerId)),
};

// ─── Global cache clear (on logout) ─────────────────────────────────────────

export const clearAllTrainerCache = async (trainerId: string): Promise<void> => {
  await Promise.allSettled([
    ClientListCache.clear(trainerId),
    WorkoutPlansCache.clear(trainerId),
    EarningsSummaryCache.clear(trainerId),
    DashboardCache.clear(trainerId),
  ]);
};

// ─── useOfflineData hook ──────────────────────────────────────────────────────
/**
 * Unified hook: tries API first, falls back to cache on failure.
 * Shows a stale-data banner when serving from cache.
 *
 * Usage:
 *   const { data, isStale, loading } = useOfflineData(
 *     () => DashboardAPI.getDashboard(trainerId, token),
 *     () => DashboardCache.load(trainerId),
 *     (d) => DashboardCache.save(trainerId, d),
 *   );
 */
import { useCallback, useEffect, useState } from 'react';

export function useOfflineData<T>(
  fetchFn: () => Promise<T>,
  loadCache: () => Promise<T | null>,
  saveCache: (data: T) => Promise<void>,
  deps: unknown[] = [],
): { data: T | null; isStale: boolean; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [loading, setLoading] = useState(true);

  const execute = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await fetchFn();
      setData(fresh);
      setIsStale(false);
      saveCache(fresh).catch(() => {});
    } catch {
      // Network failed — try cache
      const cached = await loadCache();
      if (cached) {
        setData(cached);
        setIsStale(true);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  return { data, isStale, loading, refresh: execute };
}
