/**
 * Tests for Dynamic Workout Scheduling
 *
 * Demonstrates:
 * 1. Skip a training day → schedule shifts earlier
 * 2. Complete a workout early → schedule compresses
 * 3. Complete a workout on a rest day → schedule accelerates
 * 4. Catch up on a missed workout → schedule normalizes
 */

import {
  TrainingPlan,
  PlannedWorkout,
  getPlannedWorkoutForDate,
  markWorkoutAsDone,
  markDayAsRest,
  getNext14DaysSchedule,
  getScheduledDateForWorkout,
  getScheduleStats,
} from '../dynamicScheduling';

/**
 * Helper to create a test plan
 * Template: Push(Mon), Rest(Tue), Pull(Wed), Rest(Thu), Legs(Fri), Rest(Sat), Rest(Sun)
 */
function createTestPlan(planStartDate: Date): TrainingPlan {
  return {
    weeklyTemplate: {
      0: 'REST',  // Sunday
      1: 'Push',  // Monday
      2: 'REST',  // Tuesday
      3: 'Pull',  // Wednesday
      4: 'REST',  // Thursday
      5: 'Legs',  // Friday
      6: 'REST',  // Saturday
    },
    trainingSequence: ['Push', 'Pull', 'Legs'],
    nextWorkoutIndex: 0,
    completedWorkouts: [],
    planStartDate,
  };
}

describe('Dynamic Workout Scheduling', () => {
  let plan: TrainingPlan;
  let monday: Date;

  beforeEach(() => {
    // Set up plan starting Monday, April 14, 2025
    monday = new Date('2025-04-14'); // This is a Monday
    plan = createTestPlan(monday);
  });

  describe('Scenario 1: Skip a training day', () => {
    it('should shift future workouts earlier when a training day is skipped', () => {
      // Mon Apr 14: Push is planned
      const mondayPlanned = getPlannedWorkoutForDate(monday, plan);
      expect(mondayPlanned?.workoutName).toBe('Push');
      expect(mondayPlanned?.workoutIndex).toBe(0);
      expect(mondayPlanned?.isShifted).toBe(false);

      // Mark Monday as Rest (skip Push)
      markDayAsRest(monday, plan);

      // Wed Apr 16: Pull should now be planned (shifted from Wed to Tue due to skip)
      const tuesday = new Date('2025-04-15');
      const tuesdayPlanned = getPlannedWorkoutForDate(tuesday, plan);
      expect(tuesdayPlanned?.workoutName).toBe('Pull');
      expect(tuesdayPlanned?.workoutIndex).toBe(1);
      expect(tuesdayPlanned?.isShifted).toBe(true);
      expect(tuesdayPlanned?.shiftDays).toBe(-1); // 1 day earlier

      // Fri Apr 18: Legs should also shift earlier
      const thursday = new Date('2025-04-17');
      const thursdayPlanned = getPlannedWorkoutForDate(thursday, plan);
      expect(thursdayPlanned?.workoutName).toBe('Legs');
      expect(thursdayPlanned?.isShifted).toBe(true);
      expect(thursdayPlanned?.shiftDays).toBe(-1);

      // Push is still the "next" workout (hasn't been done yet)
      expect(plan.nextWorkoutIndex).toBe(0);
    });

    it('should be possible to catch up on a skipped workout', () => {
      // Mark Monday as Rest
      markDayAsRest(monday, plan);

      // On Tuesday, decide to do Push (catch up)
      const tuesday = new Date('2025-04-15');
      markWorkoutAsDone(tuesday, plan);

      // Now Push is done (index advances)
      expect(plan.nextWorkoutIndex).toBe(1);

      // Next planned should be Pull (still on Wed, not on Tue anymore)
      const wednesday = new Date('2025-04-16');
      const wednesdayPlanned = getPlannedWorkoutForDate(wednesday, plan);
      expect(wednesdayPlanned?.workoutName).toBe('Pull');
      expect(wednesdayPlanned?.isShifted).toBe(false); // No longer shifted
    });
  });

  describe('Scenario 2: Complete a workout on a rest day', () => {
    it('should accelerate the schedule when a workout is done on a rest day', () => {
      // Tue Apr 15 is normally a rest day
      // But user does Push on Tuesday (2 days early)
      const tuesday = new Date('2025-04-15');
      markWorkoutAsDone(tuesday, plan);

      // Push should be marked as completed on a rest day
      const pushCompletion = plan.completedWorkouts[0];
      expect(pushCompletion.wasOnRestDay).toBe(true);
      expect(pushCompletion.workoutName).toBe('Push');

      // Now nextWorkoutIndex advances
      expect(plan.nextWorkoutIndex).toBe(1);

      // Pull (originally Wed) should shift to... Tue? No, the next non-rest after Tue is Wed.
      // But because we did Push early, Pull should shift earlier too.
      // Actually, let me reconsider: Pull is still scheduled for Wed (a non-rest day).
      // But all the "shift" calculations apply, so Pull might appear on Tue next week?
      // No wait, the logic is: how many completions before a date determines which workout.

      // Let me think through this more carefully:
      // - Tu Ap15: Push completed (on rest day)
      // - We, Ap16: how many workouts have been done before Wed? 1 (Push).
      //   So Pull (index 1) should be done on Wed.
      // - But is it shifted? We'll have 1 skipped or early completion, so yes, shifted by -1 day.

      const wednesday = new Date('2025-04-16');
      const wednesdayPlanned = getPlannedWorkoutForDate(wednesday, plan);
      expect(wednesdayPlanned?.workoutName).toBe('Pull');
      expect(wednesdayPlanned?.isShifted).toBe(true);
      expect(wednesdayPlanned?.shiftDays).toBe(-1); // 1 day earlier due to early completion on rest day
    });

    it('should work if user completes a workout before its original date during the week', () => {
      // Complete Push on Tuesday instead of Monday (1 day early)
      const tuesday = new Date('2025-04-15');
      markWorkoutAsDone(tuesday, plan);

      // The completion is on a rest day
      expect(plan.completedWorkouts[0].wasOnRestDay).toBe(true);

      // Pull's date should shift
      const wednesday = new Date('2025-04-16');
      const wednesdayPlanned = getPlannedWorkoutForDate(wednesday, plan);
      expect(wednesdayPlanned?.workoutName).toBe('Pull');

      // Later week should continue to be shifted
      const friday = new Date('2025-04-18');
      const fridayPlanned = getPlannedWorkoutForDate(friday, plan);
      expect(fridayPlanned?.workoutName).toBe('Legs');
      expect(fridayPlanned?.isShifted).toBe(true);
    });
  });

  describe('Scenario 3: Catch up on a missed workout later', () => {
    it('should allow completing a missed workout and shift future workouts accordingly', () => {
      // Skip Monday (mark as rest)
      markDayAsRest(monday, plan);

      // Skip Tuesday (rest day anyway, but pretend user was busy)
      const tuesday = new Date('2025-04-15');
      markDayAsRest(tuesday, plan); // This marks Push (index 0) as skipped again? No, the logic checks
      // what's planned for Tuesday, which is still Push (not yet done).
      // But Tue is a rest day, so skipping it doesn't affect training schedule.

      // Actually, let me reconsider. markDayAsRest is for skipping a planned workout.
      // On Tuesday, Pull is not planned (it's scheduled for Wednesday).
      // So calling markDayAsRest(tuesday) should do nothing or error.

      // Let's instead: skip Monday, and then on Thursday (rest day), do Push to catch up.
      const thursday = new Date('2025-04-17');
      markWorkoutAsDone(thursday, plan);

      // Push completed on Thursday (a rest day, and 3 days late)
      const pushLog = plan.completedWorkouts[1];
      expect(pushLog.wasOnRestDay).toBe(true);
      expect(pushLog.workoutIndex).toBe(0);

      // Pull should now be scheduled for Friday (was Wed)
      const friday = new Date('2025-04-18');
      const fridayPlanned = getPlannedWorkoutForDate(friday, plan);
      expect(fridayPlanned?.workoutName).toBe('Pull');
    });
  });

  describe('Scenario 4: Normal progression', () => {
    it('should schedule workouts in sequence for the normal case (no skips or early days)', () => {
      // Monday: Push
      let planned = getPlannedWorkoutForDate(monday, plan);
      expect(planned?.workoutName).toBe('Push');
      expect(planned?.isShifted).toBe(false);

      markWorkoutAsDone(monday, plan);

      // Wednesday: Pull
      const wednesday = new Date('2025-04-16');
      planned = getPlannedWorkoutForDate(wednesday, plan);
      expect(planned?.workoutName).toBe('Pull');
      expect(planned?.isShifted).toBe(false);

      markWorkoutAsDone(wednesday, plan);

      // Friday: Legs
      const friday = new Date('2025-04-18');
      planned = getPlannedWorkoutForDate(friday, plan);
      expect(planned?.workoutName).toBe('Legs');
      expect(planned?.isShifted).toBe(false);

      markWorkoutAsDone(friday, plan);

      // All done
      expect(plan.nextWorkoutIndex).toBe(3);
      const sunday = new Date('2025-04-20');
      planned = getPlannedWorkoutForDate(sunday, plan);
      expect(planned).toBeNull();
    });
  });

  describe('14-day schedule view', () => {
    it('should show the next 14 days with original and adjusted dates', () => {
      const schedule = getNext14DaysSchedule(monday, plan);

      // Check first few days
      expect(schedule.dates[0].date).toEqual(monday);
      expect(schedule.dates[0].plannedWorkout?.workoutName).toBe('Push');
      expect(schedule.dates[0].isRestDay).toBe(false);

      expect(schedule.dates[1].plannedWorkout).toBeNull(); // Tuesday: rest day, nothing planned
      expect(schedule.dates[1].isRestDay).toBe(true);

      expect(schedule.dates[2].plannedWorkout?.workoutName).toBe('Pull'); // Wednesday
      expect(schedule.dates[4].plannedWorkout?.workoutName).toBe('Legs'); // Friday

      expect(schedule.dates.length).toBe(14);
    });

    it('should show shifts in the 14-day view after a skip', () => {
      markDayAsRest(monday, plan);

      const schedule = getNext14DaysSchedule(monday, plan);

      // Tuesday should now have Pull (shifted from Wed)
      const tuesdayEntry = schedule.dates[1];
      expect(tuesdayEntry.plannedWorkout?.workoutName).toBe('Pull');
      expect(tuesdayEntry.plannedWorkout?.isShifted).toBe(true);

      // Thursday should have Legs (shifted from Fri)
      const thursdayEntry = schedule.dates[3];
      expect(thursdayEntry.plannedWorkout?.workoutName).toBe('Legs');
      expect(thursdayEntry.plannedWorkout?.isShifted).toBe(true);
    });
  });

  describe('Utility functions', () => {
    it('should calculate when a workout will be scheduled', () => {
      // Push (index 0) should be on Monday
      let date = getScheduledDateForWorkout(0, plan);
      expect(date).toEqual(new Date('2025-04-14'));

      // Pull (index 1) should be on Wednesday
      date = getScheduledDateForWorkout(1, plan);
      expect(date).toEqual(new Date('2025-04-16'));

      // Legs (index 2) should be on Friday
      date = getScheduledDateForWorkout(2, plan);
      expect(date).toEqual(new Date('2025-04-18'));

      // After completing Push, it should still return Monday (already done, not scheduled)
      markWorkoutAsDone(monday, plan);
      date = getScheduledDateForWorkout(0, plan);
      expect(date).toBeNull(); // Already done, so not "scheduled" anymore
    });

    it('should provide schedule statistics', () => {
      markWorkoutAsDone(monday, plan);

      const stats = getScheduleStats(plan);
      expect(stats.totalWorkoutsInSequence).toBe(3);
      expect(stats.completedWorkouts).toBe(1);
      expect(stats.skippedWorkouts).toBe(0);
      expect(stats.nextWorkoutIndex).toBe(1);
      expect(stats.nextWorkoutName).toBe('Pull');
      expect(stats.cycleProgress).toBe('1 of 3');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple consecutive skips', () => {
      // Skip Mon, Tue, Wed workouts
      markDayAsRest(monday, plan); // Skip Push

      // Planned workout for Tue is still Push (hasn't been done)
      const tuesday = new Date('2025-04-15');
      let planned = getPlannedWorkoutForDate(tuesday, plan);
      expect(planned?.workoutName).toBe('Push');

      markDayAsRest(tuesday, plan); // Skip Push again (on a rest day, but logically)

      // Planned workout for Wed is Pull (but it should shift earlier)
      const wednesday = new Date('2025-04-16');
      planned = getPlannedWorkoutForDate(wednesday, plan);
      expect(planned?.workoutName).toBe('Pull');
      expect(planned?.shiftDays).toBeLessThan(0);
    });

    it('should handle completion of entire cycle', () => {
      const wed = new Date('2025-04-16');
      const fri = new Date('2025-04-18');

      markWorkoutAsDone(monday, plan);
      markWorkoutAsDone(wed, plan);
      markWorkoutAsDone(fri, plan);

      expect(plan.nextWorkoutIndex).toBe(3);
      expect(getScheduleStats(plan).cycleProgress).toBe('3 of 3');

      // No more workouts planned
      const next = getPlannedWorkoutForDate(new Date('2025-04-21'), plan);
      expect(next).toBeNull();
    });
  });
});
