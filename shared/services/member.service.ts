// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Service
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import { Member } from '../types';

// ── Get a single member ───────────────────────────────────────────────────────
export async function getMember(memberId: string): Promise<Member | null> {
  const snap = await getDoc(doc(db, 'members', memberId));
  return snap.exists() ? (snap.data() as Member) : null;
}

// ── Real-time member profile listener ────────────────────────────────────────
// Member app uses this to stay in sync (plan updates, trainer changes, etc.)
export function subscribeToMember(
  memberId: string,
  callback: (member: Member | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'members', memberId), snap => {
    callback(snap.exists() ? (snap.data() as Member) : null);
  });
}

// ── Update member profile ─────────────────────────────────────────────────────
export async function updateMember(
  memberId: string,
  changes: Partial<Member>,
): Promise<void> {
  await updateDoc(doc(db, 'members', memberId), changes);
}

// ── Get all members of a gym (trainer view) ───────────────────────────────────
export async function getGymMembers(gymId: string): Promise<Member[]> {
  const q = query(
    collection(db, 'members'),
    where('gymId', '==', gymId),
    where('active', '==', true),
    orderBy('name', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Member);
}

// ── Get all members assigned to a trainer ────────────────────────────────────
export async function getTrainerMembers(
  gymId: string,
  trainerId: string,
): Promise<Member[]> {
  const q = query(
    collection(db, 'members'),
    where('gymId', '==', gymId),
    where('trainerId', '==', trainerId),
    where('active', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Member);
}

// ── Real-time trainer member list ─────────────────────────────────────────────
export function subscribeToTrainerMembers(
  gymId: string,
  trainerId: string,
  callback: (members: Member[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'members'),
    where('gymId', '==', gymId),
    where('trainerId', '==', trainerId),
    where('active', '==', true),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as Member));
  });
}

// ── Check if membership is expiring soon ─────────────────────────────────────
export function daysUntilExpiry(member: Member): number {
  const now = Date.now();
  const diff = member.planEndDate - now;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function isMembershipExpired(member: Member): boolean {
  return Date.now() > member.planEndDate;
}
