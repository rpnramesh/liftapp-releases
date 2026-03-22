// ─────────────────────────────────────────────────────────────────────────────
// Lift — Notification Service
// Saves in-app notifications to Firestore
// FCM push is triggered via a Cloud Function (see instructions below)
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import { Notification, NotifType } from '../types';

// ── Save an in-app notification ───────────────────────────────────────────────
export async function createNotification(
  recipientId: string,
  type: NotifType,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const ref = doc(collection(db, 'notifications'));
  const notif: Notification = {
    id: ref.id,
    recipientId,
    type,
    title,
    body,
    read: false,
    data,
    createdAt: Date.now(),
  };
  await setDoc(ref, notif);
}

// ── Mark a notification as read ───────────────────────────────────────────────
export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

// ── Mark all notifications read for a user ────────────────────────────────────
export async function markAllRead(recipientId: string): Promise<void> {
  // In production use a batched write — kept simple here
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', recipientId),
    where('read', '==', false),
  );
  const { getDocs, writeBatch } = await import('firebase/firestore');
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ── Real-time notification listener ──────────────────────────────────────────
export function subscribeToNotifications(
  recipientId: string,
  callback: (notifs: Notification[]) => void,
  count = 20,
): Unsubscribe {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', recipientId),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as Notification));
  });
}

// ── Unread count listener (for badge on bell icon) ───────────────────────────
export function subscribeToUnreadNotifCount(
  recipientId: string,
  callback: (count: number) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', recipientId),
    where('read', '==', false),
  );
  return onSnapshot(q, snap => callback(snap.size));
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION HELPERS — call these after trainer actions
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyWorkoutAssigned(
  memberId: string,
  workoutName: string,
  trainerName: string,
): Promise<void> {
  await createNotification(
    memberId,
    'workout_assigned',
    'New workout assigned',
    `${workoutName} is ready for today — assigned by ${trainerName}`,
    { workoutName, trainerName },
  );
}

export async function notifyMessage(
  recipientId: string,
  senderName: string,
): Promise<void> {
  await createNotification(
    recipientId,
    'message_received',
    `Message from ${senderName}`,
    'Tap to open the chat',
    { senderName },
  );
}

export async function notifyMembershipExpiring(
  memberId: string,
  daysLeft: number,
): Promise<void> {
  await createNotification(
    memberId,
    'membership_expiring',
    'Membership expiring soon',
    `${daysLeft} days left — renew to stay active`,
    { daysLeft: String(daysLeft) },
  );
}
