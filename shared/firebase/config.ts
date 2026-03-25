// ─────────────────────────────────────────────────────────────────────────────
// Lift — Firebase Config (React Native / Expo compatible)
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence is only available in the RN-specific Firebase bundle.
// Import it safely so it doesn't crash if Metro resolves the browser bundle.
let getReactNativePersistence;
try {
  const authModule = require('firebase/auth');
  if (typeof authModule.getReactNativePersistence === 'function') {
    getReactNativePersistence = authModule.getReactNativePersistence;
  }
} catch {}

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

// Auth with AsyncStorage persistence — fixes "auth state not persisting" warning
let auth;
try {
  auth = getReactNativePersistence
    ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
    : initializeAuth(app);
} catch (e) {
  // Already initialized (hot reload)
  auth = getAuth(app);
}

export { auth };
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;
