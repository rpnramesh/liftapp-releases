// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Exercise Library Seeder
//
// Seeds 15 real exercises from the enterprise exercise library CSV into the
// trainer's Firestore gym. Uses deterministic doc IDs (seed_<csvId>) so the
// function is fully idempotent — safe to call multiple times.
//
// Seeding is skipped if:
//   1. AsyncStorage flag `LIFT_EXERCISES_SEEDED_<trainerId>` is already set, OR
//   2. A seeded exercise already exists in Firestore (covers cleared storage)
//
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseAPI } from './workoutMockApi';

const SEED_KEY = (trainerId: string) => `LIFT_EXERCISES_SEEDED_${trainerId}`;

// ── 15 real exercises from the enterprise CSV ─────────────────────────────────
// Muscle group mapping (CSV → app enum):
//   Quads / Upper Chest / Rear Delts / Side Delts → closest app enum value
// Tracking metric mapping (CSV → TrackingMetric type):
//   "weight,reps" → weight_reps | "reps" → reps | "time" → time
//   "distance,time" → distance_time | "reps,time" → reps_time
// ─────────────────────────────────────────────────────────────────────────────
const LIBRARY_EXERCISES = [
  {
    csvId: 'bench_press_barbell',
    name: 'Bench Press (Barbell)',
    muscleGroup: 'Chest',
    trackingMetric: 'weight_reps',
    description:
      'Lie on a flat bench. Grip the bar slightly wider than shoulder-width. ' +
      'Lower the bar to your chest with control, then press back up to full extension.\n\n' +
      'Tips: Retract scapulae, keep a slight arch, feet flat on the floor.\n' +
      'Common mistakes: Bouncing the bar off chest, flaring elbows excessively.\n' +
      'Variations: Incline Bench, Decline Bench, Close Grip Bench.',
  },
  {
    csvId: 'plank_standard',
    name: 'Plank',
    muscleGroup: 'Core',
    trackingMetric: 'time',
    description:
      'Hold a straight body line on your forearms and toes. Keep hips level, ' +
      'core braced, and gaze at the floor.\n\n' +
      'Tips: Brace your core as if bracing for a punch.\n' +
      'Common mistakes: Sagging hips, raised hips, holding breath.\n' +
      'Variations: Side Plank, Weighted Plank, Plank with shoulder taps.',
  },
  {
    csvId: 'burpees',
    name: 'Burpees',
    muscleGroup: 'Full Body',
    trackingMetric: 'reps_time',
    description:
      'From standing: squat down, jump feet back to plank, perform a push-up, ' +
      'jump feet forward, then explode into a jump with arms overhead.\n\n' +
      'Tips: Stay explosive; move with purpose.\n' +
      'Common mistakes: Letting form break as fatigue sets in.\n' +
      'Variations: Step-back Burpee (lower impact).',
  },
  {
    csvId: 'squat_barbell',
    name: 'Back Squat (Barbell)',
    muscleGroup: 'Legs',
    trackingMetric: 'weight_reps',
    description:
      'Bar on upper traps, feet shoulder-width. Squat until thighs are at least ' +
      'parallel, then drive through heels to stand.\n\n' +
      'Tips: Knees track over toes; chest stays tall.\n' +
      'Common mistakes: Rounding the lower back, knees caving inward.\n' +
      'Variations: Front Squat, Goblet Squat, Box Squat.',
  },
  {
    csvId: 'running_treadmill',
    name: 'Treadmill Run',
    muscleGroup: 'Cardio',
    trackingMetric: 'distance_time',
    description:
      'Run at a chosen speed on the treadmill. Maintain good posture — upright ' +
      'torso, relaxed shoulders, natural arm swing.\n\n' +
      'Tips: Land mid-foot, avoid holding the rails.\n' +
      'Common mistakes: Holding rails, excessive forward lean.\n' +
      'Variations: Incline Walk, Sprint Intervals, Tempo Run.',
  },
  {
    csvId: 'deadlift_conventional',
    name: 'Conventional Deadlift (Barbell)',
    muscleGroup: 'Back',
    trackingMetric: 'weight_reps',
    description:
      'Stand with feet hip-width. Hinge at hips, grip bar just outside legs. ' +
      'Brace core, neutral spine, then drive through heels to stand tall.\n\n' +
      'Tips: Keep bar close to body; engage lats before pulling.\n' +
      'Common mistakes: Rounding the back, jerking the bar, looking up.\n' +
      'Variations: Sumo Deadlift, Romanian Deadlift, Trap Bar Deadlift.',
  },
  {
    csvId: 'pull_up_wide',
    name: 'Pull Up (Wide Grip)',
    muscleGroup: 'Back',
    trackingMetric: 'reps',
    description:
      'Hang from a bar with an overhand grip wider than shoulders. Pull your ' +
      'chin above the bar with full control, then lower with control.\n\n' +
      'Tips: Full ROM; retract scapulae at the top.\n' +
      'Common mistakes: Kipping, half reps, shrugging shoulders.\n' +
      'Variations: Chin Up (supinated), Lat Pulldown, Band-assisted Pull Up.',
  },
  {
    csvId: 'incline_dumbbell_press',
    name: 'Incline Dumbbell Press',
    muscleGroup: 'Chest',
    trackingMetric: 'weight_reps',
    description:
      'Set bench to 30–45°. Press dumbbells from shoulder height to full ' +
      'extension above chest, squeezing at the top.\n\n' +
      'Tips: Squeeze chest at the top of each rep.\n' +
      'Common mistakes: Using momentum, shrugging, partial range of motion.\n' +
      'Variations: Incline Barbell Press, Cable Fly.',
  },
  {
    csvId: 'lateral_raise_dumbbell',
    name: 'Lateral Raise (Dumbbell)',
    muscleGroup: 'Shoulders',
    trackingMetric: 'weight_reps',
    description:
      'Stand with dumbbells at your sides. Raise arms out to the sides until ' +
      'parallel to the floor, leading with the pinky finger.\n\n' +
      'Tips: Lead with your pinky to maximise lateral delt engagement.\n' +
      'Common mistakes: Trap dominance, swinging, too much weight.\n' +
      'Variations: Cable Lateral Raise, Machine Lateral Raise.',
  },
  {
    csvId: 'tricep_pushdown_rope',
    name: 'Tricep Rope Pushdown',
    muscleGroup: 'Triceps',
    trackingMetric: 'weight_reps',
    description:
      'Attach rope to high cable. Elbows pinned to sides, push rope down and ' +
      'spread the ends apart at the bottom. Control the return.\n\n' +
      'Tips: Full stretch at top, squeeze triceps at bottom.\n' +
      'Common mistakes: Elbows flaring, using momentum.\n' +
      'Variations: Straight Bar Pushdown, Overhead Tricep Extension.',
  },
  {
    csvId: 'leg_press_machine',
    name: 'Leg Press (Machine)',
    muscleGroup: 'Legs',
    trackingMetric: 'weight_reps',
    description:
      'Sit in the leg press machine. Lower the platform until knees reach ~90°, ' +
      'then press back to near-full extension without locking knees.\n\n' +
      'Tips: Keep heels flat on the platform throughout.\n' +
      'Common mistakes: Rounding lower back at the bottom, locking out knees.\n' +
      'Variations: Narrow Stance (quads), High Foot Placement (glutes/hams).',
  },
  {
    csvId: 'face_pull',
    name: 'Face Pull (Cable)',
    muscleGroup: 'Shoulders',
    trackingMetric: 'weight_reps',
    description:
      'Set cable at upper chest height with rope. Pull towards your face with ' +
      'elbows high and externally rotate at the end.\n\n' +
      'Tips: Focus on external rotation at the end of the pull.\n' +
      'Common mistakes: Pulling too low, using too much weight.\n' +
      'Variations: Rear Delt Fly, Band Pull-Apart.',
  },
  {
    csvId: 'mountain_climbers',
    name: 'Mountain Climbers',
    muscleGroup: 'Core',
    trackingMetric: 'reps_time',
    description:
      'Start in a high plank. Alternate driving knees to chest rapidly while ' +
      'keeping hips level and core tight.\n\n' +
      'Tips: Keep hips level; do not let them bounce up and down.\n' +
      'Common mistakes: Bouncing hips, looking up, losing plank position.\n' +
      'Variations: Cross-Body Mountain Climbers, Slow Mountain Climbers.',
  },
  {
    csvId: 'cycling_stationary',
    name: 'Stationary Bike',
    muscleGroup: 'Cardio',
    trackingMetric: 'distance_time',
    description:
      'Pedal at your chosen resistance level. Maintain proper seat height so ' +
      'the knee has a slight bend at the bottom of the pedal stroke.\n\n' +
      'Tips: Proper seat height prevents knee strain.\n' +
      'Common mistakes: Setting resistance too low, improper seat position.\n' +
      'Variations: HIIT Intervals, Hill Climb, Steady State.',
  },
  {
    csvId: 'push_up',
    name: 'Push Up',
    muscleGroup: 'Chest',
    trackingMetric: 'reps',
    description:
      'Start in a high plank with hands just wider than shoulders. Lower your ' +
      'chest to the floor with elbows at ~45°, then push back up.\n\n' +
      'Tips: Keep elbows at roughly 45° to protect shoulders.\n' +
      'Common mistakes: Half reps, sagging hips, flared elbows.\n' +
      'Variations: Diamond Push Up, Decline Push Up, Knee Push Up.',
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Seeds the 15-exercise library for the given trainer.
 * Safe to call on every app launch — skips immediately if already done.
 */
export async function seedExerciseLibrary(trainerId: string): Promise<void> {
  if (!trainerId) return;

  // Fast path: AsyncStorage flag already set for this trainer
  try {
    const flag = await AsyncStorage.getItem(SEED_KEY(trainerId));
    if (flag === 'true') return;
  } catch (_) {}

  // Fallback check: look for any seeded exercise in Firestore
  // (covers the case where AsyncStorage was cleared)
  try {
    const existing = await ExerciseAPI.getAll();
    const alreadySeeded = existing.some((ex: any) => ex.isSeeded === true);
    if (alreadySeeded) {
      await AsyncStorage.setItem(SEED_KEY(trainerId), 'true').catch(() => {});
      return;
    }
  } catch (_) {}

  // Seed all 15 exercises using deterministic IDs (idempotent)
  const results = await Promise.allSettled(
    LIBRARY_EXERCISES.map(ex =>
      ExerciseAPI.createSeeded(ex.csvId, {
        name: ex.name,
        description: ex.description,
        muscleGroup: ex.muscleGroup,
        trackingMetric: ex.trackingMetric,
      }),
    ),
  );

  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed === 0) {
    // Only mark as done when all succeeded
    await AsyncStorage.setItem(SEED_KEY(trainerId), 'true').catch(() => {});
  }
}
