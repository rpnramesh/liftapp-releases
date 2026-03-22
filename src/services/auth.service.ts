// ─────────────────────────────────────────────────────────────────────────────
// Lift — Auth Service (SMS OTP — shared by both apps)
// ─────────────────────────────────────────────────────────────────────────────
//
// Usage:
//   1. sendOtp('+919876543210')          → returns confirmationResult
//   2. verifyOtp(confirmationResult, '123456') → signs in the user
//   3. getCurrentUser()                  → returns Firebase user or null
//   4. signOut()                         → logs out
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  ConfirmationResult,
  ApplicationVerifier,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from '../firebase/config';
import { Member, Trainer, UserRole } from '../types';

// ── Send OTP ──────────────────────────────────────────────────────────────────
// phoneNumber must include country code: '+919876543210'
// appVerifier is a RecaptchaVerifier — set up in the screen component
export async function sendOtp(
  phoneNumber: string,
  appVerifier: ApplicationVerifier,
): Promise<ConfirmationResult> {
  const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
  return signInWithPhoneNumber(auth, formatted, appVerifier);
}

// ── Verify OTP ────────────────────────────────────────────────────────────────
export async function verifyOtp(
  confirmationResult: ConfirmationResult,
  otp: string,
): Promise<User> {
  const credential = await confirmationResult.confirm(otp);
  return credential.user;
}

// ── Get user profile from Firestore ──────────────────────────────────────────
export async function getUserProfile(
  uid: string,
): Promise<{ role: UserRole; profile: Member | Trainer } | null> {
  // Check members collection
  const memberSnap = await getDoc(doc(db, 'members', uid));
  if (memberSnap.exists()) {
    return { role: 'member', profile: memberSnap.data() as Member };
  }

  // Check trainers collection
  const trainerSnap = await getDoc(doc(db, 'trainers', uid));
  if (trainerSnap.exists()) {
    return { role: 'trainer', profile: trainerSnap.data() as Trainer };
  }

  return null;
}

// ── Create member profile on first login ─────────────────────────────────────
export async function createMemberProfile(
  uid: string,
  data: Partial<Member>,
): Promise<void> {
  await setDoc(doc(db, 'members', uid), {
    id: uid,
    active: true,
    createdAt: Date.now(),
    ...data,
  });
}

// ── Create trainer profile on first login ────────────────────────────────────
export async function createTrainerProfile(
  uid: string,
  data: Partial<Trainer>,
): Promise<void> {
  await setDoc(doc(db, 'trainers', uid), {
    id: uid,
    active: true,
    createdAt: Date.now(),
    ...data,
  });
}

// ── Update FCM token (for push notifications) ─────────────────────────────────
export async function updateFcmToken(
  uid: string,
  role: UserRole,
  token: string,
): Promise<void> {
  const collection = role === 'member' ? 'members' : 'trainers';
  await updateDoc(doc(db, collection, uid), { fcmToken: token });
}

// ── Sign out ──────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// ── Get current Firebase user ─────────────────────────────────────────────────
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

// ── Subscribe to auth state changes ──────────────────────────────────────────
// Returns an unsubscribe function — call it on component unmount
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
