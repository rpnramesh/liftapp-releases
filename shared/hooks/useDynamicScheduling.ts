/**
 * React Hook for Dynamic Workout Scheduling
 *
 * Provides a convenient interface to use the scheduling logic in React components
 */

import { useState, useCallback, useEffect } from 'react';
import {
  TrainingPlan,
  PlannedWorkout,
  ScheduledDay,
  getPlannedWorkoutForDate,
  markWorkoutAsDone,
  markDayAsRest,
  getNext14DaysSchedule,
  getScheduleStats,
} from '../services/dynamicScheduling';

interface UseDynamicSchedulingOptions {
  plan: TrainingPlan;
  onPlanChange?: (updatedPlan: TrainingPlan) => void;
}

interface UseDynamicSchedulingReturn {
  // State
  plan: TrainingPlan;
  scheduledDays: ScheduledDay[];

  // For a specific date
  getPlanned: (date: Date) => PlannedWorkout | null;
  plannedForToday: PlannedWorkout | null;
  plannedForTomorrow: PlannedWorkout | null;

  // Actions
  completeWorkout: (date: Date) => void;
  skipWorkout: (date: Date) => void;

  // Stats
  stats: ReturnType<typeof getScheduleStats>;
  progressPercent: number;
}

/**
 * Hook to manage dynamic workout scheduling
 *
 * Usage:
 * ```tsx
 * const scheduling = useDynamicScheduling({
 *   plan: userPlan,
 *   onPlanChange: (updated) => saveToDB(updated)
 * });
 *
 * // Show what's planned for today
 * <Text>{scheduling.plannedForToday?.workoutName}</Text>
 *
 * // Mark a workout done
 * <Button onPress={() => scheduling.completeWorkout(new Date())} />
 * ```
 */
export function useDynamicScheduling({
  plan,
  onPlanChange,
}: UseDynamicSchedulingOptions): UseDynamicSchedulingReturn {
  // Local copy of plan to mutate
  const [localPlan, setLocalPlan] = useState<TrainingPlan>(structuredClone(plan));
  const [scheduledDays, setScheduledDays] = useState<ScheduledDay[]>([]);

  // Sync when props change
  useEffect(() => {
    setLocalPlan(structuredClone(plan));
  }, [plan]);

  // Recalculate scheduled days whenever plan changes
  useEffect(() => {
    const today = new Date();
    const next14 = getNext14DaysSchedule(today, localPlan);
    setScheduledDays(next14.dates);

    // Notify parent if plan changed
    onPlanChange?.(localPlan);
  }, [localPlan, onPlanChange]);

  // Get what's planned for a specific date
  const getPlanned = useCallback(
    (date: Date): PlannedWorkout | null => {
      return getPlannedWorkoutForDate(date, localPlan);
    },
    [localPlan]
  );

  // Memoized results for today/tomorrow
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const plannedForToday = getPlanned(today);
  const plannedForTomorrow = getPlanned(tomorrow);

  // Complete a workout
  const completeWorkout = useCallback(
    (date: Date) => {
      const newPlan = structuredClone(localPlan);
      markWorkoutAsDone(date, newPlan);
      setLocalPlan(newPlan);
    },
    [localPlan]
  );

  // Skip a workout (mark as rest)
  const skipWorkout = useCallback(
    (date: Date) => {
      const newPlan = structuredClone(localPlan);
      markDayAsRest(date, newPlan);
      setLocalPlan(newPlan);
    },
    [localPlan]
  );

  // Calculate statistics
  const stats = getScheduleStats(localPlan);
  const progressPercent =
    stats.totalWorkoutsInSequence > 0
      ? (stats.completedWorkouts / stats.totalWorkoutsInSequence) * 100
      : 0;

  return {
    plan: localPlan,
    scheduledDays,
    getPlanned,
    plannedForToday,
    plannedForTomorrow,
    completeWorkout,
    skipWorkout,
    stats,
    progressPercent,
  };
}

/**
 * Hook to build a dynamic training plan from the existing app structure
 *
 * Converts the app's current plan structure to the dynamic scheduling format
 */
export function useBuildDynamicPlan(
  existingPlan: any // From current app
): TrainingPlan | null {
  const [builtPlan, setBuiltPlan] = useState<TrainingPlan | null>(null);

  useEffect(() => {
    if (!existingPlan?.days) {
      setBuiltPlan(null);
      return;
    }

    // Map the existing plan.days array to the weekly template
    // Assume plan.days is 7 elements: [Mon, Tue, Wed, Thu, Fri, Sat, Sun] (indexed 0-6)
    const weeklyTemplate: Record<number, string> = {};
    const trainingSequence: string[] = [];

    existingPlan.days.forEach((day: any, idx: number) => {
      const dayName = day.dayLabel || day.exercises?.length > 0 ? 'Training Day' : 'REST';
      const isRest = day.restDay || !day.exercises?.length;
      const displayName = isRest ? 'REST' : dayName;

      weeklyTemplate[idx] = displayName;

      if (!isRest && displayName !== 'REST') {
        trainingSequence.push(displayName);
      }
    });

    setBuiltPlan({
      weeklyTemplate: weeklyTemplate as any,
      trainingSequence,
      nextWorkoutIndex: 0,
      completedWorkouts: [],
      planStartDate: existingPlan.planStartDate || new Date(),
    });
  }, [existingPlan]);

  return builtPlan;
}
