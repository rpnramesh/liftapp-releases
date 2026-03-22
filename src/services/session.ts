// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Session
//
// IMPORTANT: TRAINER_ID exported as object property so it stays live.
// Primitive exports get copied at import time in Babel/Metro — always empty.
// Use session.TRAINER_ID or getTrainerId() in all screens.
// ─────────────────────────────────────────────────────────────────────────────
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

// Mutable object — property references stay live across modules
export const session = {
  TRAINER_ID: auth.currentUser?.uid ?? '',
  TRAINER_TOKEN: '',
};

// Keep in sync with Firebase auth state
onAuthStateChanged(auth, async (user) => {
  session.TRAINER_ID = user?.uid ?? '';
  session.TRAINER_TOKEN = user ? await user.getIdToken().catch(() => '') : '';
  // Also update legacy exports for backward compat
  TRAINER_ID = user?.uid ?? '';
  TRAINER_TOKEN = session.TRAINER_TOKEN;
});

// Legacy primitive exports — kept for screens that already import them
// These update via the auth listener above
export let TRAINER_ID: string = auth.currentUser?.uid ?? '';
export let TRAINER_TOKEN: string = '';

// Always-fresh function — use this in async functions
export const getTrainerId = (): string => auth.currentUser?.uid ?? '';
export const getToken = async (): Promise<string> =>
  await auth.currentUser?.getIdToken().catch(() => '') ?? '';
