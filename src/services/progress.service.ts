// ─────────────────────────────────────────────────────────────────────────────
// Lift — Progress Service (Weight + Measurements)
// Member logs progress → Trainer can view it
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import { WeightEntry, MeasurementEntry } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHT
// ─────────────────────────────────────────────────────────────────────────────

export async function logWeight(
  gymId: string,
  memberId: string,
  weight: number,
  note?: string,
): Promise<string> {
  const ref = doc(collection(db, 'gyms', gymId, 'weightLogs'));
  const entry: WeightEntry = {
    id: ref.id,
    memberId,
    gymId,
    weight,
    note,
    loggedAt: Date.now(),
  };
  await setDoc(ref, entry);
  return ref.id;
}

export async function getWeightLog(
  gymId: string,
  memberId: string,
  count = 30,
): Promise<WeightEntry[]> {
  const q = query(
    collection(db, 'gyms', gymId, 'weightLogs'),
    where('memberId', '==', memberId),
    orderBy('loggedAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as WeightEntry).reverse();
}

// Real-time weight log — member + trainer both see updates instantly
export function subscribeToWeightLog(
  gymId: string,
  memberId: string,
  callback: (entries: WeightEntry[]) => void,
  count = 30,
): Unsubscribe {
  const q = query(
    collection(db, 'gyms', gymId, 'weightLogs'),
    where('memberId', '==', memberId),
    orderBy('loggedAt', 'desc'),
    limit(count),
  );
  return onSnapshot(q, snap => {
    const entries = snap.docs.map(d => d.data() as WeightEntry).reverse();
    callback(entries);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MEASUREMENTS
// ─────────────────────────────────────────────────────────────────────────────

export async function logMeasurement(
  gymId: string,
  memberId: string,
  type: string,
  value: number,
): Promise<string> {
  const ref = doc(collection(db, 'gyms', gymId, 'measurements'));
  const entry: MeasurementEntry = {
    id: ref.id,
    memberId,
    gymId,
    type,
    value,
    loggedAt: Date.now(),
  };
  await setDoc(ref, entry);
  return ref.id;
}

export async function getMeasurements(
  gymId: string,
  memberId: string,
  type?: string,
): Promise<MeasurementEntry[]> {
  let q = query(
    collection(db, 'gyms', gymId, 'measurements'),
    where('memberId', '==', memberId),
    orderBy('loggedAt', 'desc'),
  );
  if (type) {
    q = query(
      collection(db, 'gyms', gymId, 'measurements'),
      where('memberId', '==', memberId),
      where('type', '==', type),
      orderBy('loggedAt', 'desc'),
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as MeasurementEntry);
}

export function subscribeToMeasurements(
  gymId: string,
  memberId: string,
  callback: (entries: MeasurementEntry[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'gyms', gymId, 'measurements'),
    where('memberId', '==', memberId),
    orderBy('loggedAt', 'desc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as MeasurementEntry));
  });
}
