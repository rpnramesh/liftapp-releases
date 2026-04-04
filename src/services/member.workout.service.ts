// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Workout Service
// Handles: plan fetching, previous performance, draft persistence, session saving
// ─────────────────────────────────────────────────────────────────────────────
// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Unsubscribe,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type {
    ActiveExercise,
    ExerciseVolumeTrend,
    ExpandedSetLog,
    MemberPlan,
    MemberPlanExercise,
    PreviousPerformance,
    SetType,
    WeeklyVolumeSummary,
    WorkoutSession
} from '../types/member.workout.types';

const DRAFT_KEY = (memberId: string) => `@lift_workout_draft_${memberId}`;

// ─────────────────────────────────────────────────────────────────────────────
// PLAN FETCHING
// ─────────────────────────────────────────────────────────────────────────────

// Get member's current assigned plan (supports both planId-based and weekPlan-based assignments)
export async function getMemberPlan(
  gymId: string,
  memberId: string,
): Promise<MemberPlan | null> {
  const assignmentSnap = await getDoc(doc(db, 'gyms', gymId, 'assignments', memberId));
  if (!assignmentSnap.exists()) return null;

  const assignment = assignmentSnap.data();

  // Handle planId-based assignment (from CreatePlanScreen/trainer.api WorkoutAPI)
  if (assignment.planId) {
    const planSnap = await getDoc(doc(db, 'gyms', gymId, 'clientPlans', assignment.planId));
    if (!planSnap.exists()) return null;
    const planData = planSnap.data();
    return {
      planId: assignment.planId,
      planName: planData.planName || 'My Plan',
      memberId,
      trainerId: assignment.trainerId || planData.trainerId || '',
      gymId,
      days: planData.days || [],
      assignedAt: assignment.createdAt || assignment.assignedAt,
      createdAt: planData.createdAt,
    } as MemberPlan;
  }

  return null;
}

// Real-time subscription to plan changes (fires when trainer reassigns)
export function subscribeToPlan(
  gymId: string,
  memberId: string,
  onUpdate: (plan: MemberPlan | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'gyms', gymId, 'assignments', memberId), async (snap) => {
    if (!snap.exists()) {
      onUpdate(null);
      return;
    }
    const assignment = snap.data();
    if (assignment.planId) {
      const planSnap = await getDoc(doc(db, 'gyms', gymId, 'clientPlans', assignment.planId));
      if (planSnap.exists()) {
        const planData = planSnap.data();
        onUpdate({
          planId: assignment.planId,
          planName: planData.planName || 'My Plan',
          memberId,
          trainerId: assignment.trainerId || planData.trainerId || '',
          gymId,
          days: planData.days || [],
          assignedAt: assignment.createdAt || assignment.assignedAt,
        } as MemberPlan);
      } else {
        onUpdate(null);
      }
    } else {
      onUpdate(null);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIOUS PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────

// Get the most recent best performance for each exercise the member has logged
export async function getPreviousPerformance(
  gymId: string,
  memberId: string,
): Promise<Record<string, PreviousPerformance>> {
  const q = query(
    collection(db, 'gyms', gymId, 'workoutLogs'),
    where('memberId', '==', memberId),
    orderBy('completedAt', 'desc'),
    limit(60),
  );
  const snap = await getDocs(q);
  const perfMap: Record<string, PreviousPerformance> = {};

  for (const d of snap.docs) {
    const log = d.data();
    // Support both member session format (exercises) and trainer log format (completedExercises/exerciseLogs)
    const exercises =
      log.exercises || log.exerciseLogs || log.completedExercises || [];

    for (const exercise of exercises) {
      const eid = exercise.exerciseId;
      if (!eid || perfMap[eid]) continue; // already have latest

      const sets = exercise.sets || [];
      const completedSets = sets.filter(
        (s: any) => s.isCompleted || s.done || s.completed,
      );
      if (completedSets.length === 0) continue;

      const maxWeight = Math.max(...completedSets.map((s: any) => Number(s.weight) || 0));
      const maxRepsAtMaxWeight = completedSets
        .filter((s: any) => Number(s.weight) === maxWeight)
        .reduce((best: number, s: any) => Math.max(best, Number(s.reps) || 0), 0);
      const totalVolume = completedSets.reduce(
        (sum: number, s: any) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0),
        0,
      );

      perfMap[eid] = {
        exerciseId: eid,
        lastWeight: maxWeight,
        lastReps: maxRepsAtMaxWeight,
        lastSets: completedSets.length,
        lastVolume: totalVolume,
        estimated1RM:
          maxWeight > 0 && maxRepsAtMaxWeight > 0
            ? estimate1RM(maxWeight, maxRepsAtMaxWeight)
            : undefined,
        achievedAt: Number(log.completedAt) || Date.now(),
        workoutName: log.workoutName,
      };
    }
  }

  return perfMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Brzycki formula: 1RM estimate
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  if (reps > 30) return weight; // formula breaks down at very high reps
  return Math.round(weight * (36 / (37 - reps)));
}

// Calculate total volume for a session
export function calculateSessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce((total, ex) => {
    return (
      total +
      ex.sets.reduce((s, set) => {
        if (!set.isCompleted) return s;
        return s + (set.weight || 0) * (set.reps || 0);
      }, 0)
    );
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION BUILDER
// ─────────────────────────────────────────────────────────────────────────────

// Build a new WorkoutSession from a trainer-assigned plan day
export function buildSessionFromPlanDay(params: {
  gymId: string;
  memberId: string;
  trainerId: string;
  planId: string;
  planName: string;
  dayLabel: string;
  exercises: MemberPlanExercise[];
  prevPerf: Record<string, PreviousPerformance>;
}): WorkoutSession {
  const { gymId, memberId, trainerId, planId, planName, dayLabel, exercises, prevPerf } = params;

  const activeExercises: ActiveExercise[] = exercises.map((ex, idx) => {
    const prev = prevPerf[ex.id];
    const prefillWeight = prev?.lastWeight ?? 0;

    const warmupSets: ExpandedSetLog[] = Array.from({ length: ex.warmupSets || 0 }).map((_, i) => ({
      setNumber: i + 1,
      weight: prefillWeight ? Math.round(prefillWeight * 0.6 * 2) / 2 : 0, // 60% rounded to nearest 0.5
      reps: ex.warmupReps || 10,
      targetReps: ex.warmupReps || 10,
      setType: 'warmup' as SetType,
      isCompleted: false,
    }));

    const mainSets: ExpandedSetLog[] = Array.from({ length: ex.mainSets || 3 }).map((_, i) => ({
      setNumber: (ex.warmupSets || 0) + i + 1,
      weight: prefillWeight || 0,
      reps: ex.mainReps || 10,
      targetReps: ex.mainReps || 10,
      targetWeight: prev?.lastWeight,
      setType: 'working' as SetType,
      isCompleted: false,
    }));

    return {
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroup: ex.muscleGroup || 'Other',
      sets: [...warmupSets, ...mainSets],
      targetSets: (ex.warmupSets || 0) + (ex.mainSets || 3),
      targetReps: ex.mainReps || 10,
      restSeconds: ex.mainRestSeconds || 90,
      notes: ex.notes || '',
      order: idx + 1,
    } as ActiveExercise;
  });

  return {
    id: `active_${memberId}_${Date.now()}`,
    gymId,
    memberId,
    workoutId: planId,
    workoutName: planName,
    dayLabel,
    trainerId,
    exercises: activeExercises,
    startedAt: Date.now(),
    status: 'active',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT PERSISTENCE (AsyncStorage — survives crashes, no network needed)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveDraft(memberId: string, session: WorkoutSession): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY(memberId), JSON.stringify(session));
  } catch {
    // Silently fail — draft is best-effort
  }
}

export async function loadDraft(memberId: string): Promise<WorkoutSession | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY(memberId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearDraft(memberId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY(memberId));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION PERSISTENCE (Firestore)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveWorkoutSession(
  gymId: string,
  session: WorkoutSession,
): Promise<string> {
  const ref = doc(collection(db, 'gyms', gymId, 'workoutLogs'));
  const id = ref.id;
  const totalVolume = calculateSessionVolume(session);
  const totalSets = session.exercises.reduce(
    (n, ex) => n + ex.sets.filter((s) => s.isCompleted).length,
    0,
  );
  await setDoc(ref, {
    ...session,
    id,
    totalVolume,
    totalSets,
    savedAt: Date.now(),
  });
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export async function getWorkoutHistory(
  gymId: string,
  memberId: string,
  limitCount = 30,
): Promise<WorkoutSession[]> {
  const q = query(
    collection(db, 'gyms', gymId, 'workoutLogs'),
    where('memberId', '==', memberId),
    orderBy('completedAt', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as WorkoutSession);
}

// Get weekly volume summaries (for history chart)
export function buildWeeklyVolume(sessions: WorkoutSession[]): WeeklyVolumeSummary[] {
  const weeks: Record<string, WeeklyVolumeSummary> = {};

  for (const session of sessions) {
    const ts = session.completedAt || session.startedAt;
    const date = new Date(ts);
    const day = date.getDay(); // 0=Sun
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const weekKey = monday.getTime().toString();

    if (!weeks[weekKey]) {
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      weeks[weekKey] = {
        weekLabel: `${monday.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
        weekStart: monday.getTime(),
        totalVolume: 0,
        totalSets: 0,
        workoutCount: 0,
      };
    }

    weeks[weekKey].totalVolume += session.totalVolume || calculateSessionVolume(session);
    weeks[weekKey].totalSets += session.totalSets || 0;
    weeks[weekKey].workoutCount += 1;
  }

  return Object.values(weeks).sort((a, b) => a.weekStart - b.weekStart);
}

// Get per-exercise volume trend for charts
export function buildExerciseTrend(
  sessions: WorkoutSession[],
  exerciseId: string,
): ExerciseVolumeTrend | null {
  const points: ExerciseVolumeTrend['dataPoints'] = [];
  let exerciseName = '';

  for (const session of [...sessions].reverse()) {
    const exercise = session.exercises?.find((e) => e.exerciseId === exerciseId);
    if (!exercise) continue;
    exerciseName = exercise.exerciseName;

    const completedSets = exercise.sets.filter((s) => s.isCompleted);
    if (completedSets.length === 0) continue;

    const maxWeight = Math.max(...completedSets.map((s) => s.weight || 0));
    const maxReps = completedSets
      .filter((s) => s.weight === maxWeight)
      .reduce((best, s) => Math.max(best, s.reps || 0), 0);
    const totalVolume = completedSets.reduce(
      (sum, s) => sum + (s.weight || 0) * (s.reps || 0),
      0,
    );

    points.push({
      date: session.completedAt || session.startedAt,
      maxWeight,
      totalVolume,
      estimated1RM: maxWeight > 0 && maxReps > 0 ? estimate1RM(maxWeight, maxReps) : 0,
    });
  }

  if (!exerciseName) return null;
  return { exerciseId, exerciseName, dataPoints: points };
}
