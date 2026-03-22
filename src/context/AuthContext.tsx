// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — AuthContext (Firebase)
// Same interface as before — screens unchanged
// ─────────────────────────────────────────────────────────────────────────────

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { auth, db } from '../firebase/config';
import { ProfileAPI } from '../services/trainer.api';
import { TrainerProfile } from '../types/trainer.types';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthState {
  trainerId: string | null;
  token: string | null;
  refreshToken: string | null;
  gymId: string | null;
  isFreelance: boolean;
  adminAccess: boolean;
  profile: TrainerProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setSession: (params: {
    trainerId: string;
    accessToken: string;
    refreshToken: string;
    gymId: string | null;
    isFreelance: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  reloadProfile: () => Promise<void>;
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
    adminAccess: false,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── Firebase auth state listener ──────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState(prev => ({
          ...prev,
          trainerId: null,
          token: null,
          gymId: null,
          isFreelance: false,
          adminAccess: false,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
        }));
        return;
      }

      try {
        const token = await user.getIdToken();

        // Check if trainer profile exists in Firestore
        const snap = await getDoc(doc(db, 'trainers', user.uid));

        if (!snap.exists()) {
          // New trainer — profile will be created in RegistrationScreen
          setState(prev => ({
            ...prev,
            trainerId: user.uid,
            token,
            gymId: null,
            isFreelance: false,
            adminAccess: false,
            profile: null,
            isAuthenticated: true,
            isLoading: false,
          }));
          return;
        }

        const data = snap.data();
        let profile: TrainerProfile | null = null;
        try {
          profile = await ProfileAPI.getProfile(user.uid);
        } catch {}

        setState({
          trainerId: user.uid,
          token,
          refreshToken: null,
          gymId: data.gymId ?? null,
          isFreelance: data.isFreelance ?? false,
          adminAccess: data.adminAccess ?? false,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    // Timeout fallback
    const timeout = setTimeout(() => {
      setState(prev => {
        if (prev.isLoading) return { ...prev, isLoading: false };
        return prev;
      });
    }, 8000);

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  // Called after OTP verification — used by OTPScreen / SplashScreen
  const setSession = useCallback(async ({
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
    let profile: TrainerProfile | null = null;
    try {
      profile = await ProfileAPI.getProfile(trainerId);
    } catch {}

    const snap = await getDoc(doc(db, 'trainers', trainerId)).catch(() => null);
    const adminAccess = snap?.data()?.adminAccess ?? false;

    setState(prev => ({
      ...prev,
      trainerId,
      token: accessToken,
      refreshToken,
      gymId,
      isFreelance,
      adminAccess,
      profile,
      isAuthenticated: true,
      isLoading: false,
    }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {}
    setState({
      trainerId: null,
      token: null,
      refreshToken: null,
      gymId: null,
      isFreelance: false,
      adminAccess: false,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const reloadProfile = useCallback(async () => {
    if (!state.trainerId) return;
    try {
      const profile = await ProfileAPI.getProfile(state.trainerId);
      setState(prev => ({ ...prev, profile }));
    } catch {}
  }, [state.trainerId]);

  // Firebase handles token refresh automatically
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      const token = await user.getIdToken(true);
      setState(prev => ({ ...prev, token }));
      return token;
    } catch {
      return null;
    }
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────

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

export function requireAuth<P extends object>(
  Component: React.ComponentType<P>,
): React.FC<P> {
  return function ProtectedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return null;
    if (!isAuthenticated) return null;
    return <Component {...props} />;
  };
}
