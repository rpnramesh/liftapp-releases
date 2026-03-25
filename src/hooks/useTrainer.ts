// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Custom Hooks
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Vibration } from 'react-native';

// ─── useAppState ─────────────────────────────────────────────────────────────
/** Detect foreground events to re-fetch dashboard data (TS-006 AC2) */
export function useAppForeground(callback: () => void) {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') callback();
    });
    return () => sub.remove();
  }, [callback]);
}

// Optionally vibrate on background/foreground transitions (Android only by design)
export function useBackgroundVibration(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (next: AppStateStatus) => {
      if (next === 'background') {
        try { Vibration.vibrate(100); } catch (_) {}
      }
    };
    const sub = AppState.addEventListener('change', handler as any);
    return () => sub.remove();
  }, [enabled]);
}

// ─── useAsync ────────────────────────────────────────────────────────────────
/** Generic data-fetching hook with loading, error, and refresh states */
export function useAsync<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  return { data, loading, error, refresh: execute };
}

// ─── useDebounce ─────────────────────────────────────────────────────────────
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── useGreeting ─────────────────────────────────────────────────────────────
/** Returns time-based greeting for TS-006 dashboard */
export function useGreeting(firstName: string): string {
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17 && hour < 21) greeting = 'Good evening';
  else if (hour >= 21) greeting = 'Good night';
  return `${greeting}, ${firstName}!`;
}

// ─── useNetworkStatus ────────────────────────────────────────────────────────
/**
 * Offline detection — TS-001, TS-006, TS-011
 * On React Native you'd swap this for @react-native-community/netinfo
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    // Only attach browser window listeners when running on web
    if (typeof globalThis !== 'undefined' && (globalThis as any).addEventListener) {
      (globalThis as any).addEventListener('online', handleOnline);
      (globalThis as any).addEventListener('offline', handleOffline);
      return () => {
        (globalThis as any).removeEventListener('online', handleOnline);
        (globalThis as any).removeEventListener('offline', handleOffline);
      };
    }
  }, []);
  return { isOnline };
}

// ─── usePagination ───────────────────────────────────────────────────────────
export function usePagination(pageSize = 20) {
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const nextPage = useCallback(() => {
    if (hasMore) setPage(p => p + 1);
  }, [hasMore]);

  const reset = useCallback(() => {
    setPage(1);
    setHasMore(true);
  }, []);

  return { page, hasMore, setHasMore, nextPage, reset };
}
