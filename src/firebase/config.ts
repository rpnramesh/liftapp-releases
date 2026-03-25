// ─────────────────────────────────────────────────────────────────────────────
// Lift — Firebase Config (shared by Member App + Trainer App)
// ─────────────────────────────────────────────────────────────────────────────

import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBWfe4NVioDMI1b_VuZvkBsNCMJLnWI32M',
  authDomain: 'lift-bfd12.firebaseapp.com',
  projectId: 'lift-bfd12',
  storageBucket: 'lift-bfd12.firebasestorage.app',
  messagingSenderId: '858368934869',
  appId: '1:858368934869:web:6c50951d112281909f335c',
};

// Prevent re-initializing on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth with AsyncStorage persistence — user stays logged in until explicit sign-out
let auth: ReturnType<typeof getAuth>;
try {
  // initializeAuth with default persistence — older/newer firebase builds differ
  auth = initializeAuth(app);
} catch {
  // Already initialized (hot reload)
  auth = getAuth(app);
}

export { auth };
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;
