// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — AuthContext
//
// Provides trainerId, accessToken, trainerProfile, and auth actions to every
// screen.  Replace the `TRAINER_ID = 'trainer-001'` / `TOKEN = ''` stubs in
// each screen with:
//
//   const { trainerId, token } = useAuth();
//
// Install:  npx expo install expo-secure-store
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AuthAPI, ProfileAPI } from '../services/trainer.api';
import { TrainerProfile } from '../types/trainer.types';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  ACCESS_TOKEN: 'lift_trainer_access_token',
  REFRESH_TOKEN: 'lift_trainer_refresh_token',
  TRAINER_ID: 'lift_trainer_id',
} as const;

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthState {
  trainerId: string | null;
  token: string | null;
  refreshToken: string | null;
  gymId: string | null;
  isFreelance: boolean;
  profile: TrainerProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  /** Call after successful OTP verification */
  setSession: (params: {
    trainerId: string;
    accessToken: string;
    refreshToken: string;
    gymId: string | null;
    isFreelance: boolean;
  }) => Promise<void>;
  /** Clears all stored credentials */
  logout: () => Promise<void>;
  /** Reload profile from API (call after profile edits) */
  reloadProfile: () => Promise<void>;
  /** Silently refresh the access token using the stored refresh token */
  silentRefresh: () => Promise<string | null>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    trainerId: null,
    token: null,
    refreshToken: null,
    gymId: null,
    isFreelance: false,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Track timer for silent token refresh
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persist helpers ──────────────────────────────────────────────────────────

  const saveTokens = async (
    accessToken: string,
    refreshToken: string,
    trainerId: string,
  ) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
      SecureStore.setItemAsync(KEYS.TRAINER_ID, trainerId),
    ]);
  };

  const clearTokens = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.TRAINER_ID),
    ]);
  };

  // ── Token expiry parser ──────────────────────────────────────────────────────

  /** Decode JWT payload without verifying signature (client-side only) */
  const decodeJWT = (token: string): { exp?: number } => {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return {};
    }
  };

  /** Schedule silent refresh 5 minutes before token expiry */
  const scheduleRefresh = useCallback((accessToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const { exp } = decodeJWT(accessToken);
    if (!exp) return;
    const msUntilExpiry = exp * 1000 - Date.now();
    const msUntilRefresh = Math.max(msUntilExpiry - 5 * 60 * 1000, 0);
    refreshTimerRef.current = setTimeout(silentRefresh, msUntilRefresh);
  }, []);

  // ── Silent refresh ───────────────────────────────────────────────────────────

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    const storedRefresh = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN).catch(() => null);
    if (!storedRefresh) return null;

    try {
      const res = await AuthAPI.refreshToken(storedRefresh);
      await saveTokens(
        res.accessToken,
        res.refreshToken,
        (await SecureStore.getItemAsync(KEYS.TRAINER_ID)) ?? '',
      );
      setState(prev => ({
        ...prev,
        token: res.accessToken,
        refreshToken: res.refreshToken,
      }));
      scheduleRefresh(res.accessToken);
      return res.accessToken;
    } catch {
      // Refresh failed — user must re-authenticate
      await clearTokens();
      setState(prev => ({
        ...prev,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
      }));
      return null;
    }
  }, [scheduleRefresh]);

  // ── Bootstrap on mount ───────────────────────────────────────────────────────

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [storedToken, storedRefresh, storedId] = await Promise.all([
          SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
          SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
          SecureStore.getItemAsync(KEYS.TRAINER_ID),
        ]);

        if (!storedToken || !storedId) {
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Check if token is still valid
        const { exp } = decodeJWT(storedToken);
        let activeToken = storedToken;

        if (exp && exp * 1000 < Date.now()) {
          // Token expired — try refresh
          const newToken = await silentRefresh();
          if (!newToken) {
            setState(prev => ({ ...prev, isLoading: false }));
            return;
          }
          activeToken = newToken;
        }

        // Validate with server and get role/gymId
        const validation = await AuthAPI.validateToken(activeToken);

        if (validation.role !== 'TRAINER') {
          await clearTokens();
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Load profile
        let profile: TrainerProfile | null = null;
        try {
          profile = await ProfileAPI.getProfile(storedId, activeToken);
        } catch {
          // Non-fatal — profile loads later
        }

        scheduleRefresh(activeToken);

        setState({
          trainerId: storedId,
          token: activeToken,
          refreshToken: storedRefresh,
          gymId: validation.gymId,
          isFreelance: validation.isFreelance,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    bootstrap();
  }, []);

  // ── Refresh on foreground ────────────────────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && state.isAuthenticated) {
        silentRefresh();
      }
    });
    return () => sub.remove();
  }, [state.isAuthenticated, silentRefresh]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const setSession = useCallback(
    async ({
      trainerId,
      accessToken,
      refreshToken,
      gymId,
      isFreelance,
    }: {
      trainerId: string;
      accessToken: string;
      refreshToken: string;
      gymId: string | null;
      isFreelance: boolean;
    }) => {
      await saveTokens(accessToken, refreshToken, trainerId);
      scheduleRefresh(accessToken);

      let profile: TrainerProfile | null = null;
      try {
        profile = await ProfileAPI.getProfile(trainerId, accessToken);
      } catch {}

      setState({
        trainerId,
        token: accessToken,
        refreshToken,
        gymId,
        isFreelance,
        profile,
        isAuthenticated: true,
        isLoading: false,
      });
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      if (state.token) {
        // FCM token cleared server-side
        await AuthAPI.logout(state.trainerId ?? '', '', state.token);
      }
    } catch {}
    await clearTokens();
    setState({
      trainerId: null,
      token: null,
      refreshToken: null,
      gymId: null,
      isFreelance: false,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, [state.token, state.trainerId]);

  const reloadProfile = useCallback(async () => {
    if (!state.trainerId || !state.token) return;
    try {
      const profile = await ProfileAPI.getProfile(state.trainerId, state.token);
      setState(prev => ({ ...prev, profile }));
    } catch {}
  }, [state.trainerId, state.token]);

  // ── Context value ────────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    ...state,
    setSession,
    logout,
    reloadProfile,
    silentRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ─── HOC: requireAuth ─────────────────────────────────────────────────────────
/**
 * Wraps any component and redirects to Auth stack if unauthenticated.
 * Usage: export default requireAuth(MyScreen);
 */
export function requireAuth<P extends object>(
  Component: React.ComponentType<P>,
): React.FC<P> {
  return function ProtectedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) return null; // Splash handles the loading state

    if (!isAuthenticated) {
      // useNavigation can't be called conditionally; handle in navigator
      return null;
    }

    return <Component {...props} />;
  };
}
