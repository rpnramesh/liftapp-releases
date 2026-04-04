// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Workout Types (Expanded Set Data Fields)
// Supports volume calculation, estimated 1RM, intensity tracking, trainer review
// ─────────────────────────────────────────────────────────────────────────────

// ── Set type enum ────────────────────────────────────────────────────────────
export type SetType =
  | 'warmup'
  | 'working'
  | 'drop'
  | 'failure'
  | 'tempo'
  | 'paused';

// ── Expanded set log ─────────────────────────────────────────────────────────
// Rich data structure per completed set for volume calc, 1RM, and trainer review
export interface ExpandedSetLog {
  setNumber: number;                // Sequential number within the exercise (auto-managed)
  weight: number;                   // Numeric value (kg; decimals OK e.g. 2.5)
  reps: number;                     // Actual completed reps
  targetWeight?: number;            // From trainer assignment — for display comparison
  targetReps?: number;              // From trainer assignment — for display comparison
  rpe?: number;                     // 0–10 Rate of Perceived Exertion (optional)
  rir?: number;                     // 0–5 Reps In Reserve (optional)
  setType: SetType;
  duration?: number;                // Seconds (isometric / timed sets)
  distance?: number;                // Meters (conditioning elements)
  tempo?: string;                   // e.g. "3010" eccentric-pause-concentric-pause
  notes?: string;                   // Form feedback, pain notes, personal cues
  completedAt?: number;             // Timestamp when set was marked complete
  isCompleted: boolean;
  restTimeSeconds?: number;         // Actual rest after this set (auto or manual)
}

// ── Exercise in an active session ────────────────────────────────────────────
export interface ActiveExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: ExpandedSetLog[];
  targetSets: number;
  targetReps: number;
  targetWeight?: number;
  restSeconds: number;
  notes?: string;                   // Trainer-provided notes for this exercise
  order: number;                    // Position in workout (1-based)
  supersetGroup?: string;           // Optional group ID for supersets
}

// ── Full workout session (in-progress or completed) ──────────────────────────
export interface WorkoutSession {
  id: string;
  gymId: string;
  memberId: string;
  workoutId?: string;
  workoutName: string;
  dayLabel?: string;
  trainerId?: string;
  exercises: ActiveExercise[];
  startedAt: number;
  completedAt?: number;
  durationSeconds?: number;
  totalVolume?: number;             // Total weight × reps across all completed sets
  totalSets?: number;
  status: 'active' | 'completed' | 'abandoned';
  memberNotes?: string;
  effortRating?: number;            // 1–5 star rating by member
  progressPhotoUri?: string;
  sentToTrainer?: boolean;
  newPRs?: PREntry[];
}

// ── Personal record entry ────────────────────────────────────────────────────
export interface PREntry {
  exerciseId: string;
  exerciseName: string;
  prType: 'weight' | 'reps' | 'volume' | 'estimated1rm';
  value: number;
  previousValue?: number;
  achievedAt: number;
}

// ── Previous performance lookup ───────────────────────────────────────────────
export interface PreviousPerformance {
  exerciseId: string;
  lastWeight: number;
  lastReps: number;
  lastSets: number;
  lastVolume: number;
  estimated1RM?: number;
  achievedAt: number;
  workoutName?: string;
}

// ── Member's assigned plan (aggregated from Firestore) ───────────────────────
export interface MemberPlan {
  planId: string;
  planName: string;
  memberId: string;
  trainerId: string;
  gymId: string;
  days: MemberPlanDay[];
  assignedAt?: number;
  createdAt?: number;
}

export interface MemberPlanDay {
  dayLabel: string;
  restDay: boolean;
  sourceWorkoutName?: string;
  exercises: MemberPlanExercise[];
}

export interface MemberPlanExercise {
  id: string;
  name: string;
  muscleGroup: string;
  warmupSets: number;
  warmupReps: number;
  warmupRestSeconds: number;
  mainSets: number;
  mainReps: number;
  mainRestSeconds: number;
  notes?: string;
}

// ── Weekly volume summary (for history/charts) ───────────────────────────────
export interface WeeklyVolumeSummary {
  weekLabel: string;            // e.g. "Mar 31 – Apr 6"
  weekStart: number;            // timestamp
  totalVolume: number;
  totalSets: number;
  workoutCount: number;
}

// ── Exercise volume trend (for per-exercise charts) ──────────────────────────
export interface ExerciseVolumeTrend {
  exerciseId: string;
  exerciseName: string;
  dataPoints: Array<{
    date: number;               // timestamp
    maxWeight: number;
    totalVolume: number;
    estimated1RM: number;
  }>;
}
