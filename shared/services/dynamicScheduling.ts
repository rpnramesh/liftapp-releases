/**
 * Dynamic Workout Rescheduling Engine
 *
 * Handles shifting workout sequences when users skip days, complete early,
 * or work out on rest days. Workouts are always done in the original
 * sequence order, but their actual calendar dates can shift.
 */

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon, ..., 6=Sat

/** The base weekly schedule and training metadata */
export interface TrainingPlan {
  /** Original weekly template: day -> workout name or 'REST' */
  weeklyTemplate: Record<DayOfWeek, string>;

  /** Ordered list of non-REST workouts */
  trainingSequence: string[]; // e.g., ['Push', 'Pull', 'Legs']

  /** Which workout in trainingSequence should happen next (0-indexed) */
  nextWorkoutIndex: number;

  /** Log of all completed and skipped workouts */
  completedWorkouts: CompletedWorkoutEntry[];

  /** When this plan started (used to map dates to day-of-week) */
  planStartDate: Date;
}

/** Record of a user's interaction with a scheduled workout */
export interface CompletedWorkoutEntry {
  date: Date;
  workoutIndex: number; // Index in trainingSequence
  workoutName: string;
  wasSkipped: boolean; // true = marked as Rest, false = actually completed
  wasOnRestDay: boolean; // true if template said 'REST' but user did the workout
  completedAt?: Date; // timestamp of when marked
}

/** What should the user do on a given date? */
export interface PlannedWorkout {
  workoutName: string;
  workoutIndex: number;
  originalDay: DayOfWeek; // Mon-Sun of where this workout was in the base template
  isShifted: boolean; // true if the date is different from the original day
  shiftDays: number; // negative = earlier, positive = later (usually 0 or negative)
  isAlreadyCompleted: boolean;
  wasSkipped: boolean;
}

/** The schedule for the next N days */
export interface Next14DaysSchedule {
  dates: ScheduledDay[];
}

export interface ScheduledDay {
  date: Date;
  dayOfWeek: DayOfWeek;
  templateWorkout: string; // What the template says
  plannedWorkout: PlannedWorkout | null; // What actually should happen (null if caught up)
  isRestDay: boolean; // Is template a 'REST' day?
}

/**
 * Get the day-of-week (0-6) for a specific date
 */
function getDayOfWeek(date: Date): DayOfWeek {
  return (date.getDay() as DayOfWeek);
}

/**
 * Get the original day-of-week for a workout in the training sequence
 * @param workoutName e.g., 'Push'
 * @param template the weeklyTemplate
 * @returns day of week (0-6) or null if not found
 */
function getOriginalDayForWorkout(
  workoutName: string,
  template: Record<DayOfWeek, string>
): DayOfWeek | null {
  for (const [dayStr, name] of Object.entries(template)) {
    if (name === workoutName && name !== 'REST') {
      return parseInt(dayStr) as DayOfWeek;
    }
  }
  return null;
}

/**
 * Count how many workouts (non-skipped) have been completed on or before a date
 */
function countCompletedBefore(date: Date, log: CompletedWorkoutEntry[]): number {
  return log.filter(w => !w.wasSkipped && new Date(w.date) <= date).length;
}

/**
 * Get what workout should be planned for a specific date
 *
 * Algorithm:
 * 1. Count how many workouts have been completed before this date (not counting skips)
 * 2. This count tells us which index in trainingSequence should be done
 * 3. Calculate the "shift" from the original planned date
 *
 * @param date the target date
 * @param plan the training plan
 * @returns the planned workout, or null if all workouts in sequence are done
 */
export function getPlannedWorkoutForDate(
  date: Date,
  plan: TrainingPlan
): PlannedWorkout | null {
  // How many workouts have been completed (not skipped) before this date?
  const completedCount = countCompletedBefore(date, plan.completedWorkouts);

  // This is the index of the workout that should be on this date
  const workoutIndex = completedCount;

  // If we've completed all workouts in the sequence, nothing is scheduled
  if (workoutIndex >= plan.trainingSequence.length) {
    return null;
  }

  const workoutName = plan.trainingSequence[workoutIndex];
  const originalDay = getOriginalDayForWorkout(workoutName, plan.weeklyTemplate);

  if (originalDay === null) {
    console.warn(`Workout "${workoutName}" not found in template`);
    return null;
  }

  // Check if this workout has already been completed
  const completion = plan.completedWorkouts.find(w => w.workoutIndex === workoutIndex);
  const isAlreadyCompleted = completion ? !completion.wasSkipped : false;

  // Calculate the shift: how many days earlier or later than the original
  // Shift occurs because of skipped workouts and early completions
  const shiftDays = calculateShift(date, originalDay, plan);

  return {
    workoutName,
    workoutIndex,
    originalDay,
    isShifted: shiftDays !== 0,
    shiftDays,
    isAlreadyCompleted,
    wasSkipped: completion?.wasSkipped ?? false,
  };
}

/**
 * Calculate how many days the schedule has shifted by this date
 *
 * Logic:
 * - For each skipped training day before now: schedule shifts 1 day earlier
 * - For each completed workout on a rest day: schedule shifts 1 day earlier
 * - For each completed workout before its original date: schedule shifts earlier
 *
 * @param currentDate the reference date
 * @param originalDay the original day-of-week of the workout
 * @param plan the training plan
 * @returns shift in days (negative = earlier, positive = later)
 */
function calculateShift(
  currentDate: Date,
  originalDay: DayOfWeek,
  plan: TrainingPlan
): number {
  let shift = 0;

  for (const entry of plan.completedWorkouts) {
    if (new Date(entry.date) >= currentDate) {
      // Only count events before the current date
      continue;
    }

    if (entry.wasSkipped) {
      // Skipped a training day → all future workouts move 1 day earlier
      shift -= 1;
    } else if (entry.wasOnRestDay) {
      // Completed a workout on a rest day → all future workouts move 1 day earlier
      shift -= 1;
    } else {
      // Completed a workout: check if it was early
      // (This is handled implicitly: completing a workout "uses up" that slot,
      // so if the next workout was supposed to be 3 days later but you did
      // the previous one yesterday, the next one moves up accordingly)
    }
  }

  return shift;
}

/**
 * Mark a workout as completed on a specific date
 *
 * Behavior:
 * - If the date matches the planned workout: mark as complete
 * - If the date is a rest day but user did a workout: mark as complete with wasOnRestDay=true
 * - If the user is catching up on a missed workout: mark with earlier date
 * - Update nextWorkoutIndex to point to the next workout in the sequence
 *
 * @param date the date the workout was done
 * @param plan the training plan (mutated)
 */
export function markWorkoutAsDone(date: Date, plan: TrainingPlan): void {
  const planned = getPlannedWorkoutForDate(date, plan);

  if (!planned) {
    console.warn('No workout planned for this date or all workouts already completed');
    return;
  }

  const dayOfWeek = getDayOfWeek(date);
  const templateWorkout = plan.weeklyTemplate[dayOfWeek];
  const wasOnRestDay = templateWorkout === 'REST';

  // Record this completion
  plan.completedWorkouts.push({
    date,
    workoutIndex: planned.workoutIndex,
    workoutName: planned.workoutName,
    wasSkipped: false,
    wasOnRestDay,
    completedAt: new Date(),
  });

  // Advance the next workout index
  plan.nextWorkoutIndex = planned.workoutIndex + 1;
}

/**
 * Mark a training day as Rest (skip the scheduled workout)
 *
 * Behavior:
 * - Records a "skipped" entry for the planned workout
 * - All future workouts shift 1 day earlier (schedule compresses)
 * - The nextWorkoutIndex does NOT advance (same workout must be done later)
 *
 * Example:
 * - Plan: [Push(Mon), Pull(Wed), Legs(Fri)]
 * - User marks Monday as Rest
 * - Now: Pull should be on Tuesday, Legs on Thursday
 * - nextWorkoutIndex stays 0 (Push is still next)
 *
 * @param date the date being marked as rest
 * @param plan the training plan (mutated)
 */
export function markDayAsRest(date: Date, plan: TrainingPlan): void {
  const planned = getPlannedWorkoutForDate(date, plan);

  if (!planned) {
    console.warn('No workout to skip on this date');
    return;
  }

  // Record that this workout was skipped
  plan.completedWorkouts.push({
    date,
    workoutIndex: planned.workoutIndex,
    workoutName: planned.workoutName,
    wasSkipped: true,
    wasOnRestDay: false,
    completedAt: new Date(),
  });

  // nextWorkoutIndex does NOT change; this same workout is still next
  // (but all future workouts have shifted earlier by 1 day)
}

/**
 * Get the next 14 days of the schedule
 *
 * For each day, returns:
 * - What the template says
 * - What the dynamic schedule says to do (accounting for shifts)
 * - Whether it's shifted from the original day
 *
 * @param startDate the first date to include
 * @param plan the training plan
 * @returns schedule for next 14 days
 */
export function getNext14DaysSchedule(
  startDate: Date,
  plan: TrainingPlan
): Next14DaysSchedule {
  const dates: ScheduledDay[] = [];
  const currentDate = new Date(startDate);

  for (let i = 0; i < 14; i++) {
    const dayOfWeek = getDayOfWeek(currentDate);
    const templateWorkout = plan.weeklyTemplate[dayOfWeek];
    const isRestDay = templateWorkout === 'REST';

    const plannedWorkout = getPlannedWorkoutForDate(currentDate, plan);

    dates.push({
      date: new Date(currentDate),
      dayOfWeek,
      templateWorkout,
      plannedWorkout,
      isRestDay,
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { dates };
}

/**
 * Calculate what day a workout will be done on (based on current shifts)
 *
 * Useful for UI: "You'll do Pull on Thursday (originally Wednesday)"
 *
 * @param workoutIndex index in trainingSequence
 * @param plan the training plan
 * @returns the date this workout is scheduled for, or null if already done
 */
export function getScheduledDateForWorkout(
  workoutIndex: number,
  plan: TrainingPlan
): Date | null {
  if (workoutIndex >= plan.trainingSequence.length) {
    return null;
  }

  // Find the date where this workout should be done
  const search = new Date(plan.planStartDate);
  const endDate = new Date(search);
  endDate.setDate(endDate.getDate() + 365); // Search up to 1 year ahead

  while (search <= endDate) {
    const planned = getPlannedWorkoutForDate(search, plan);
    if (planned && planned.workoutIndex === workoutIndex && !planned.isAlreadyCompleted) {
      return new Date(search);
    }
    search.setDate(search.getDate() + 1);
  }

  return null;
}

/**
 * Get statistics about the schedule
 */
export function getScheduleStats(plan: TrainingPlan) {
  return {
    totalWorkoutsInSequence: plan.trainingSequence.length,
    completedWorkouts: plan.completedWorkouts.filter(w => !w.wasSkipped).length,
    skippedWorkouts: plan.completedWorkouts.filter(w => w.wasSkipped).length,
    nextWorkoutIndex: plan.nextWorkoutIndex,
    nextWorkoutName: plan.trainingSequence[plan.nextWorkoutIndex] || 'Cycle Complete',
    cycleProgress: `${plan.nextWorkoutIndex} of ${plan.trainingSequence.length}`,
  };
}

/**
 * Reset the plan to its initial state (useful for testing)
 */
export function resetPlan(plan: TrainingPlan): void {
  plan.nextWorkoutIndex = 0;
  plan.completedWorkouts = [];
}
