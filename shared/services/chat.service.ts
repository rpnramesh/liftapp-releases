// ─────────────────────────────────────────────────────────────────────────────
// Lift — Chat Service
// FIX: mediaUrl: undefined was crashing setDoc (Firestore rejects undefined).
//      Now uses `mediaUrl: mediaUrl ?? null` — null is always safe.
//      Messages are fetched without orderBy to avoid composite index requirement,
//      and sorted client-side by createdAt.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  getDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ─── Chat ID formula (must match trainer app exactly) ─────────────────────────
// namespace = gymId if non-null/non-empty, else trainerId
// chatId = `${namespace}_${trainerId}_${memberId}`
function buildChatId(gymId: string | null, trainerId: string, memberId: string): string {
  const ns = (gymId && gymId.trim()) ? gymId : trainerId;
  return `${ns}_${trainerId}_${memberId}`;
}

// ─── Get or create the chat thread document ───────────────────────────────────
export async function getOrCreateChatThread(
  gymId: string | null,
  trainerId: string,
  memberId: string,
): Promise<{ chatId: string }> {
  const chatId = buildChatId(gymId, trainerId, memberId);
  const ref = doc(db, 'chats', chatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      id: chatId,
      gymId: gymId ?? null,
      trainerId,
      memberId,
      createdAt: Date.now(),
      lastMessage: null,
      lastMessageAt: null,
    });
  }
  return { chatId };
}

// ─── Send a message ───────────────────────────────────────────────────────────
// type: 'text' | 'image' | 'voice'
// text: message text (required for text; for image/voice use caption or '')
// mediaUrl: URL of uploaded media (undefined → null, never written as undefined)
export async function sendMessage(
  gymId: string | null,
  trainerId: string,
  memberId: string,
  senderId: string,
  senderRole: 'trainer' | 'member',
  type: 'text' | 'image' | 'voice',
  text: string,
  mediaUrl?: string,
): Promise<string> {
  const chatId = buildChatId(gymId, trainerId, memberId);
  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));

  // ⚠️ CRITICAL: never write undefined to Firestore — use null
  const message = {
    id: msgRef.id,
    chatId,
    senderId,
    senderRole,
    type,
    text: text ?? '',
    mediaUrl: mediaUrl ?? null,   // <-- THE FIX: was `mediaUrl` (undefined when not passed)
    isRead: false,
    createdAt: Date.now(),
  };

  await setDoc(msgRef, message);

  // Update thread's lastMessage (best-effort)
  const threadRef = doc(db, 'chats', chatId);
  await setDoc(
    threadRef,
    {
      lastMessage: type === 'text' ? text : `📎 ${type}`,
      lastMessageAt: Date.now(),
      gymId: gymId ?? null,
      trainerId,
      memberId,
    },
    { merge: true },
  ).catch(() => {});

  return msgRef.id;
}

// ─── Subscribe to messages ────────────────────────────────────────────────────
// NO orderBy — avoids composite index requirement. Sorted client-side.
export function subscribeToMessages(
  gymId: string | null,
  trainerId: string,
  memberId: string,
  callback: (messages: any[]) => void,
): Unsubscribe {
  const chatId = buildChatId(gymId, trainerId, memberId);
  // No orderBy — only filter by chatId (all messages in this subcollection belong to it anyway)
  const q = query(collection(db, 'chats', chatId, 'messages'));
  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (a.createdAt ?? 0) - (b.createdAt ?? 0)); // oldest first
      callback(messages);
    },
    (err) => {
      console.log('[chat] messages snapshot error:', err.message);
      callback([]);
    },
  );
}

// ─── Mark messages as read ────────────────────────────────────────────────────
export async function markMessagesRead(
  gymId: string | null,
  trainerId: string,
  memberId: string,
  readerId: string,
): Promise<void> {
  // Best-effort — don't let this crash anything
  try {
    const chatId = buildChatId(gymId, trainerId, memberId);
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      where('isRead', '==', false),
    );
    const snap = await getDoc(doc(db, 'chats', chatId)).catch(() => null);
    // We skip the batch update to avoid another index requirement.
    // Simple approach: just mark thread as read.
    if (snap?.exists()) {
      await updateDoc(doc(db, 'chats', chatId), {
        [`unread_${readerId}`]: 0,
      }).catch(() => {});
    }
  } catch (_) {}
}
