// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Workout & Exercise Firebase Service
// No composite indexes — all filtering/sorting done client-side
// ─────────────────────────────────────────────────────────────────────────────
import {
  collection,
  deleteDoc,
  doc, getDoc, getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const uid = () => auth.currentUser?.uid ?? '';
const ts = () => Date.now();

// Strip undefined values — Firestore throws on undefined
function clean(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(clean);
  if (typeof obj === 'object') {
    const r: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) r[k] = clean(v);
    }
    return r;
  }
  return obj;
}

const getGymId = async (): Promise<string> => {
  const u = uid();
  if (!u) return u;
  try {
    const snap = await getDoc(doc(db, 'trainers', u));
    return snap.data()?.gymId ?? u;
  } catch { return u; }
};

// ─── computeWorkoutStats ──────────────────────────────────────────────────────
export function computeWorkoutStats(entries: any[]) {
  let totalSets = 0;
  let totalRest = 0;
  for (const e of entries) {
    const warmup = e.warmupSets ?? 0;
    const main = e.mainSets ?? 3;
    totalSets += warmup + main;
    if (warmup > 1) totalRest += (warmup - 1) * (e.warmupRestSeconds ?? 60);
    if (main > 1) totalRest += (main - 1) * (e.mainRestSeconds ?? 60);
  }
  const workTime = entries.reduce((s, e) => {
    const sets = (e.warmupSets ?? 0) + (e.mainSets ?? 3);
    const reps = e.mainReps ?? 10;
    return s + sets * reps * 3;
  }, 0);
  const estimatedMinutes = Math.ceil((workTime + totalRest) / 60);
  return { totalSets, estimatedMinutes };
}

// ─── Exercise API ─────────────────────────────────────────────────────────────
export const ExerciseAPI = {
  getAll: async () => {
    const trainerId = uid();
    if (!trainerId) return [];
    const gymId = await getGymId();
    const q = query(
      collection(db, 'gyms', gymId, 'exercises'),
      where('trainerId', '==', trainerId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data()).sort((a: any, b: any) =>
      (a.name ?? '').localeCompare(b.name ?? '')
    );
  },

  create: async (data: { name: string; description: string; muscleGroup: string; videoId?: string; videoTitle?: string }) => {
    const trainerId = uid();
    if (!trainerId) throw new Error('Not logged in');
    const gymId = await getGymId();
    const ref = doc(collection(db, 'gyms', gymId, 'exercises'));
    const exercise = clean({
      id: ref.id, exerciseId: ref.id, trainerId, gymId,
      name: data.name, exerciseName: data.name,
      description: data.description,
      muscleGroup: data.muscleGroup,
      exerciseMuscleGroup: data.muscleGroup,
      videoId: data.videoId ?? null,
      videoTitle: data.videoTitle ?? null,
      warmupSets: 0, warmupReps: 10, warmupRestSeconds: 60,
      mainSets: 3, mainReps: 10, mainRestSeconds: 60,
      createdAt: ts(), updatedAt: ts(),
    });
    await setDoc(ref, exercise);
    return exercise;
  },

  update: async (exerciseId: string, data: any) => {
    const gymId = await getGymId();
    await updateDoc(doc(db, 'gyms', gymId, 'exercises', exerciseId), clean({ ...data, updatedAt: ts() }));
  },

  delete: async (exerciseId: string) => {
    const gymId = await getGymId();
    await deleteDoc(doc(db, 'gyms', gymId, 'exercises', exerciseId));
  },
};

// ─── Workout API ──────────────────────────────────────────────────────────────
// IMPORTANT: These are LIBRARY workouts (templates).
// When assigning to a client via CreatePlanScreen, trainer.api.ts WorkoutAPI.createPlan
// is used instead — which is stored separately and does NOT appear here.
export const WorkoutAPI = {
  // Fetch library workouts — always fresh from Firestore, no caching
  getAll: async () => {
    const trainerId = uid();
    if (!trainerId) return [];
    const gymId = await getGymId();
    const q = query(
      collection(db, 'gyms', gymId, 'workouts'),
      where('trainerId', '==', trainerId),
      where('isLibraryItem', '==', true),   // only library items
    );
    const snap = await getDocs(q);
    // Also get workouts without isLibraryItem flag (legacy)
    const q2 = query(
      collection(db, 'gyms', gymId, 'workouts'),
      where('trainerId', '==', trainerId),
    );
    const snap2 = await getDocs(q2);
    const all = snap2.docs.map(d => d.data());
    // Filter: only show library items (isLibraryItem=true or isLibraryItem is not set but no memberId)
    const library = all.filter((w: any) => w.isLibraryItem !== false && !w.memberId);
    return library.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  },

  getById: async (workoutId: string) => {
    const gymId = await getGymId();
    const snap = await getDoc(doc(db, 'gyms', gymId, 'workouts', workoutId));
    return snap.exists() ? snap.data() : null;
  },

  // Creates a LIBRARY workout (shown in WorkoutsListScreen)
  create: async (data: any) => {
    const trainerId = uid();
    if (!trainerId) throw new Error('Not logged in');
    const gymId = await getGymId();
    const ref = doc(collection(db, 'gyms', gymId, 'workouts'));
    const workout = clean({
      ...data,
      id: ref.id, trainerId, gymId,
      isLibraryItem: true,   // marks this as a library template
      memberId: null,         // not assigned to any client yet
      createdAt: ts(), updatedAt: ts(),
    });
    await setDoc(ref, workout);
    return workout;
  },

  update: async (workoutId: string, data: any) => {
    const gymId = await getGymId();
    await updateDoc(doc(db, 'gyms', gymId, 'workouts', workoutId), clean({ ...data, updatedAt: ts() }));
  },

  delete: async (workoutId: string) => {
    const gymId = await getGymId();
    await deleteDoc(doc(db, 'gyms', gymId, 'workouts', workoutId));
  },
};
