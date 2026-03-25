// ─────────────────────────────────────────────────────────────────────────────
// Lift — Progress Service  (Weight + Measurements)
// FIX: Removed orderBy from ALL snapshot queries — Firestore requires a
//      composite index for where+orderBy. We fetch without ordering and sort
//      client-side instead. This eliminates the failed-precondition crash.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import { WeightEntry, MeasurementEntry } from '../types';

// ─── WEIGHT ──────────────────────────────────────────────────────────────────

export async function logWeight(
  gymId: string,
  memberId: string,
  weight: number,
  note?: string,
): Promise<string> {
  // Use gymId || memberId so freelance members (gymId = null) still work
  const ns = gymId || memberId;
  const ref = doc(collection(db, 'gyms', ns, 'weightLogs'));
  const entry = {
    id: ref.id,
    memberId,
    gymId: gymId || null,
    weight,
    note: note ?? null,          // null, never undefined
    loggedAt: Date.now(),
  };
  await setDoc(ref, entry);
  return ref.id;
}

// Real-time weight log — NO orderBy to avoid composite index requirement
export function subscribeToWeightLog(
  gymId: string,
  memberId: string,
  callback: (entries: WeightEntry[]) => void,
): Unsubscribe {
  const ns = gymId || memberId;
  // Only filter by memberId — no orderBy
  const q = query(
    collection(db, 'gyms', ns, 'weightLogs'),
    where('memberId', '==', memberId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const entries = snap.docs
        .map((d) => d.data() as WeightEntry)
        .sort((a: any, b: any) => (b.loggedAt ?? 0) - (a.loggedAt ?? 0)); // sort client-side
      callback(entries);
    },
    (err) => {
      console.log('[progress] weightLog snapshot error:', err.message);
      callback([]);
    },
  );
}

// ─── MEASUREMENTS ────────────────────────────────────────────────────────────

export async function logMeasurement(
  gymId: string,
  memberId: string,
  type: string,
  value: number,
): Promise<string> {
  const ns = gymId || memberId;
  const ref = doc(collection(db, 'gyms', ns, 'measurements'));
  const entry = {
    id: ref.id,
    memberId,
    gymId: gymId || null,
    type,
    value,
    loggedAt: Date.now(),
  };
  await setDoc(ref, entry);
  return ref.id;
}

// Real-time measurements — NO orderBy
export function subscribeToMeasurements(
  gymId: string,
  memberId: string,
  callback: (entries: MeasurementEntry[]) => void,
): Unsubscribe {
  const ns = gymId || memberId;
  const q = query(
    collection(db, 'gyms', ns, 'measurements'),
    where('memberId', '==', memberId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const entries = snap.docs
        .map((d) => d.data() as MeasurementEntry)
        .sort((a: any, b: any) => (b.loggedAt ?? 0) - (a.loggedAt ?? 0)); // sort client-side
      callback(entries);
    },
    (err) => {
      console.log('[progress] measurements snapshot error:', err.message);
      callback([]);
    },
  );
}
