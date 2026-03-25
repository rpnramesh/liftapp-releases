// ─────────────────────────────────────────────────────────────────────────────
// Lift — Chat Service (Real-time Trainer ↔ Member messaging)
// Works for BOTH gym members (gymId exists) and freelance members (no gymId)
// ─────────────────────────────────────────────────────────────────────────────

import {
    collection,
    doc,
    getDoc,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Unsubscribe,
    updateDoc,
    where
} from 'firebase/firestore';

import { db } from '../firebase/config';
import { ChatMessage, ChatThread, MessageType } from '../types';

// ── Namespace helper ──────────────────────────────────────────────────────────
// Gym members    → namespace = gymId     (e.g. "abc123")
// Freelance/none → namespace = trainerId (e.g. "xyz789")
// This ensures every trainer-member pair has a unique, consistent namespace
// regardless of whether they are gym-linked or freelance.
export function getNamespace(gymId: string | null | undefined, trainerId: string): string {
  return gymId && gymId.trim() !== '' ? gymId : trainerId;
}

// ── Build a consistent chat thread ID ────────────────────────────────────────
// Same ID regardless of who opens the chat first.
// Gym member:    "{gymId}_{trainerId}_{memberId}"
// Freelance:     "{trainerId}_{trainerId}_{memberId}"  (trainerId used as namespace)
export function buildChatId(
  gymId: string | null | undefined,
  trainerId: string,
  memberId: string,
): string {
  const ns = getNamespace(gymId, trainerId);
  return `${ns}_${trainerId}_${memberId}`;
}

// ── Get or create a chat thread ───────────────────────────────────────────────
export async function getOrCreateChatThread(
  gymId: string | null | undefined,
  trainerId: string,
  memberId: string,
): Promise<ChatThread> {
  const chatId = buildChatId(gymId, trainerId, memberId);
  const ref = doc(db, 'chats', chatId);
  const snap = await getDoc(ref);

  if (snap.exists()) return snap.data() as ChatThread;

  const thread: ChatThread = {
    id: chatId,
    gymId: gymId ?? null,
    trainerId,
    memberId,
    lastMessage: '',
    lastMessageAt: Date.now(),
    unreadCount: { [trainerId]: 0, [memberId]: 0 },
  };
  await setDoc(ref, thread);
  return thread;
}

// ── Send a message ────────────────────────────────────────────────────────────
export async function sendMessage(
  gymId: string | null | undefined,
  trainerId: string,
  memberId: string,
  senderId: string,
  senderRole: 'member' | 'trainer',
  type: MessageType,
  text?: string,
  mediaUrl?: string,
  workoutId?: string,
): Promise<void> {
  const chatId = buildChatId(gymId, trainerId, memberId);
  const recipientId = senderRole === 'member' ? trainerId : memberId;

  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
  const message: ChatMessage = {
    id: msgRef.id,
    chatId,
    senderId,
    senderRole,
    type,
    text,
    mediaUrl,
    workoutId,
    readBy: [senderId],
    createdAt: Date.now(),
  };
  await setDoc(msgRef, message);

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: text ?? (type === 'image' ? 'Image' : type === 'voice' ? 'Voice note' : 'Workout'),
    lastMessageAt: Date.now(),
    [`unreadCount.${recipientId}`]: increment(1),
  });
}

// ── Real-time message listener ────────────────────────────────────────────────
export function subscribeToMessages(
  gymId: string | null | undefined,
  trainerId: string,
  memberId: string,
  callback: (messages: ChatMessage[]) => void,
  messageLimit = 100,
): Unsubscribe {
  const chatId = buildChatId(gymId, trainerId, memberId);
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(messageLimit),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as ChatMessage));
  });
}

// ── Mark messages as read ─────────────────────────────────────────────────────
export async function markMessagesRead(
  gymId: string | null | undefined,
  trainerId: string,
  memberId: string,
  readerUid: string,
): Promise<void> {
  const chatId = buildChatId(gymId, trainerId, memberId);
  await updateDoc(doc(db, 'chats', chatId), {
    [`unreadCount.${readerUid}`]: 0,
  });
}

// ── Subscribe to all threads for a trainer ────────────────────────────────────
// Finds both gym chats and freelance (direct) chats for this trainer
export function subscribeToTrainerThreads(
  trainerId: string,
  callback: (threads: ChatThread[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'chats'),
    where('trainerId', '==', trainerId),
    orderBy('lastMessageAt', 'desc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as ChatThread));
  });
}

// ── Unread count for a user ───────────────────────────────────────────────────
export function subscribeToUnreadCount(
  gymId: string | null | undefined,
  trainerId: string,
  memberId: string,
  readerUid: string,
  callback: (count: number) => void,
): Unsubscribe {
  const chatId = buildChatId(gymId, trainerId, memberId);
  return onSnapshot(doc(db, 'chats', chatId), snap => {
    if (!snap.exists()) { callback(0); return; }
    const thread = snap.data() as ChatThread;
    callback(thread.unreadCount?.[readerUid] ?? 0);
  });
}
