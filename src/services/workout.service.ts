// ─────────────────────────────────────────────────────────────────────────────
// Lift — Workout Service
// Trainer assigns workouts → Member sees them live
// ─────────────────────────────────────────────────────────────────────────────

import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    setDoc,
    Unsubscribe,
    updateDoc,
    where
} from 'firebase/firestore';

import { db } from '../firebase/config';
import {
    Workout,
    WorkoutAssignment,
    WorkoutDay,
    WorkoutLog,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// TRAINER SIDE
// ─────────────────────────────────────────────────────────────────────────────

// Create a new workout template
export async function createWorkout(
  gymId: string,
  trainerId: string,
  workout: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = doc(collection(db, 'gyms', gymId, 'workouts'));
  await setDoc(ref, {
    ...workout,
    id: ref.id,
    gymId,
    trainerId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

// Update an existing workout template
export async function updateWorkout(
  gymId: string,
  workoutId: string,
  changes: Partial<Workout>,
): Promise<void> {
  await updateDoc(doc(db, 'gyms', gymId, 'workouts', workoutId), {
    ...changes,
    updatedAt: Date.now(),
  });
}

// Get all workouts created by a trainer
export async function getTrainerWorkouts(
  gymId: string,
  trainerId: string,
): Promise<Workout[]> {
  const q = query(
    collection(db, 'gyms', gymId, 'workouts'),
    where('trainerId', '==', trainerId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Workout);
}

// ── ASSIGN workout plan to a member ──────────────────────────────────────────
// This is the key function: trainer assigns → member sees it instantly
export async function assignWorkoutPlan(
  gymId: string,
  memberId: string,
  trainerId: string,
  weekPlan: WorkoutDay[],
  todayWorkoutId: string | null,
): Promise<void> {
  // Assignment document uses memberId as its ID for easy lookup
  await setDoc(doc(db, 'gyms', gymId, 'assignments', memberId), {
    id: memberId,
    gymId,
    memberId,
    trainerId,
    weekPlan,
    todayWorkoutId,
    assignedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// Update only today's workout (quick reassign)
export async function updateTodayWorkout(
  gymId: string,
  memberId: string,
  todayWorkoutId: string | null,
): Promise<void> {
  await updateDoc(doc(db, 'gyms', gymId, 'assignments', memberId), {
    todayWorkoutId,
    updatedAt: Date.now(),
  });
}

// Get all members' workout logs (trainer view — see who completed what)
export async function getMemberWorkoutLogs(
  gymId: string,
  memberId: string,
): Promise<WorkoutLog[]> {
  const q = query(
    collection(db, 'gyms', gymId, 'workoutLogs'),
    where('memberId', '==', memberId),
    orderBy('completedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as WorkoutLog);
}

// Real-time listener: trainer watches a member's workout logs live
export function subscribeToMemberLogs(
  gymId: string,
  memberId: string,
  callback: (logs: WorkoutLog[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'gyms', gymId, 'workoutLogs'),
    where('memberId', '==', memberId),
    orderBy('completedAt', 'desc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as WorkoutLog));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER SIDE
// ─────────────────────────────────────────────────────────────────────────────

// Get a single workout by ID
export async function getWorkout(
  gymId: string,
  workoutId: string,
): Promise<Workout | null> {
  const snap = await getDoc(doc(db, 'gyms', gymId, 'workouts', workoutId));
  return snap.exists() ? (snap.data() as Workout) : null;
}

// Real-time listener: member listens for assignment changes from trainer
// When trainer assigns a workout, this fires automatically on the member's phone
export function subscribeToAssignment(
  gymId: string,
  memberId: string,
  callback: (assignment: WorkoutAssignment | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'gyms', gymId, 'assignments', memberId),
    snap => {
      callback(snap.exists() ? (snap.data() as WorkoutAssignment) : null);
    },
  );
}

// Save a completed workout log (member finishes workout)
export async function saveWorkoutLog(
  gymId: string,
  log: Omit<WorkoutLog, 'id'>,
): Promise<string> {
  const ref = doc(collection(db, 'gyms', gymId, 'workoutLogs'));
  const id = ref.id;

  // Transaction: write workout log and update member streak/lastWorkoutAt
  await runTransaction(db, async (tx) => {
    tx.set(ref, { ...log, id });

    // Update member document with streak logic
    try {
      const memberRef = doc(db, 'members', log.memberId);
      const memberSnap = await tx.get(memberRef);
      const now = Date.now();
      let newStreak = 1;
      if (memberSnap.exists()) {
        const m = memberSnap.data() as any;
        const prev = m.lastWorkoutAt ?? m.lastWorkoutAtMillis ?? 0;
        if (prev) {
          const prevMid = new Date(new Date(prev).toDateString()).getTime();
          const nowMid = new Date(new Date(log.completedAt ?? now).toDateString()).getTime();
          const daysDiff = Math.floor((nowMid - prevMid) / (24 * 3600 * 1000));
          if (daysDiff === 0) {
            // same day — keep existing streak
            newStreak = m.streak ?? 1;
          } else if (daysDiff === 1) {
            newStreak = (m.streak ?? 0) + 1;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }
      }
      tx.update(doc(db, 'members', log.memberId), {
        lastWorkoutAt: log.completedAt ?? Date.now(),
        streak: newStreak,
      });
    } catch (e) {
      // If member doc update fails, still allow log creation
      console.log('streak update failed', e);
    }
  });

  return id;
}
