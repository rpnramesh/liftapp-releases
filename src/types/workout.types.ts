// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Exercise & Workout Types
// Add these to the bottom of trainer.types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Legs'
  | 'Glutes'
  | 'Core'
  | 'Cardio'
  | 'Full Body'
  | 'Other';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  muscleGroup: MuscleGroup;
  videoId?: string;          // links to a video in Video Library
  videoTitle?: string;
  createdAt: string;
}

// ─── One exercise entry inside a workout ─────────────────────────────────────

export interface WorkoutExerciseEntry {
  exerciseId: string;
  exerciseName: string;
  exerciseMuscleGroup: MuscleGroup;
  // Warm-up block (optional — 0 means no warm-up)
  warmupSets: number;        // 0–12
  warmupReps: number;        // 1–12
  warmupRestSeconds: number; // rest BETWEEN warm-up sets (last set has no rest)
  // Main block
  mainSets: number;          // 1–12
  mainReps: number;          // 1–12
  mainRestSeconds: number;   // rest BETWEEN main sets (last set has no rest)
}

// ─── Full workout ─────────────────────────────────────────────────────────────

export interface Workout {
  id: string;
  name: string;              // e.g. "Push Day"
  description: string;
  exercises: WorkoutExerciseEntry[]; // max 12
  totalSets: number;         // computed
  estimatedMinutes: number;  // computed
  createdAt: string;
}
