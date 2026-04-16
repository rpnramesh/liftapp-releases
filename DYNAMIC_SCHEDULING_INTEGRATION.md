# Dynamic Workout Scheduling Integration Guide

## Overview

This document explains how to integrate the dynamic scheduling system into the existing Lift Member app without breaking current functionality.

**Files Created:**
- `shared/services/dynamicScheduling.ts` — Core logic (interfaces, functions, algorithms)
- `shared/hooks/useDynamicScheduling.ts` — React hooks for UI integration
- `shared/services/__tests__/dynamicScheduling.test.ts` — Comprehensive tests

---

## Core Concepts

### 1. Training Plan State

The new system tracks:

```typescript
interface TrainingPlan {
  weeklyTemplate: Record<DayOfWeek, string>;  // Original schedule (Push, REST, Pull, ...)
  trainingSequence: string[];                 // Non-REST workouts in order (Push, Pull, Legs)
  nextWorkoutIndex: number;                   // Which one is next (0-indexed)
  completedWorkouts: CompletedWorkoutEntry[]; // Log of all user actions
  planStartDate: Date;                        // Reference date for calculations
}
```

### 2. Key Functions

#### `getPlannedWorkoutForDate(date, plan): PlannedWorkout | null`

Returns what should happen on a given date, accounting for all shifts:

```typescript
interface PlannedWorkout {
  workoutName: string;      // "Push", "Pull", "Legs"
  workoutIndex: number;     // Index in trainingSequence
  originalDay: DayOfWeek;   // Mon-Sun of where it was in the base template
  isShifted: boolean;       // Is the date different from the original?
  shiftDays: number;        // -1 = 1 day earlier, 0 = on schedule
  isAlreadyCompleted: boolean;
  wasSkipped: boolean;
}
```

#### `markWorkoutAsDone(date, plan)`

Records that a workout was completed on a given date:
- Updates `completedWorkouts` log
- Advances `nextWorkoutIndex`
- Handles rest day workouts (sets `wasOnRestDay: true`)

#### `markDayAsRest(date, plan)`

Records that a training day was skipped:
- Updates `completedWorkouts` with `wasSkipped: true`
- **Does NOT advance** `nextWorkoutIndex` (same workout still needs to be done)
- Triggers schedule shift: all future workouts move 1 day earlier

#### `getNext14DaysSchedule(startDate, plan): Next14DaysSchedule`

Returns the next 14 days with original and adjusted dates:

```typescript
interface ScheduledDay {
  date: Date;
  dayOfWeek: DayOfWeek;
  templateWorkout: string;        // What the template says
  plannedWorkout: PlannedWorkout; // What actually should happen (null if done)
  isRestDay: boolean;
}
```

---

## Shift Logic (The Heart of the System)

### Scenario 1: Skip a Training Day

**Template:** Push(Mon), REST(Tue), Pull(Wed), REST(Thu), Legs(Fri), REST(Sat), REST(Sun)  
**Sequence:** [Push, Pull, Legs]

```
Before:
Mon(Push) → Wed(Pull) → Fri(Legs)

User marks Monday as Rest:
markDayAsRest(Monday, plan);

After:
Tue(Push) → Wed(Pull) → Fri(Legs)  [all shifted 1 day earlier]
```

**Why:** Marking a training day as Rest removes 1 day from the schedule, so future workouts compress forward.

### Scenario 2: Complete a Workout on a Rest Day

```
Mon, Tue is REST: User completes Push on Tuesday
markWorkoutAsDone(Tuesday, plan);

Entry recorded: { date: Tue, workoutIndex: 0, wasOnRestDay: true }

Result: Pull shifts 1 day earlier (from Wed to Tue next week, or compresses this week)
```

**Why:** Doing an extra workout on a rest day "accelerates" the schedule.

### Scenario 3: Complete a Missed Workout (Catch-Up)

```
Scenario:
- Mon: User marks as Rest (skip Push)
- Thu: User decides to do Push (catch-up, 3 days late)

markDayAsRest(Monday, plan);
markWorkoutAsDone(Thursday, plan);

Result:
- 1 skip: -1 day (all future workouts 1 day earlier)
- 1 completion on rest day: -1 day (all future workouts 1 day earlier)
- Total: Pull shifts 2 days earlier, Legs shifts 2 days earlier
```

**Key:** The shift calculation is cumulative. Each skip and early/rest-day completion adds to the overall shift.

---

## Integration Steps

### Step 1: Initialize a Dynamic Plan in WorkoutsScreen

**Current code (App.js line ~2014):**
```typescript
const selectedDay = fullPlan?.days[selectedDayIdx];
```

**Add dynamic scheduling:**
```typescript
import { useDynamicScheduling, useBuildDynamicPlan } from './shared/hooks/useDynamicScheduling';

function WorkoutsScreen({ ... }) {
  // Build a dynamic plan from the existing plan
  const dynamicPlan = useBuildDynamicPlan(fullPlan);
  
  // Use the scheduling hook
  const scheduling = useDynamicScheduling({
    plan: dynamicPlan,
    onPlanChange: (updated) => {
      // Save the updated plan back to Firestore if needed
      // or keep it in local state for now
    }
  });
  
  // ...rest of component
}
```

### Step 2: Update the "Mark Complete" Button

**Current behavior:**
```typescript
<TouchableOpacity onPress={() => {
  // Current completion logic (saves to plan.days[todayIdx])
  // ...
}}>
  <Text>Mark Workout Complete</Text>
</TouchableOpacity>
```

**New behavior:**
```typescript
<TouchableOpacity onPress={() => {
  // Use the dynamic scheduling
  scheduling.completeWorkout(new Date());
  
  // Then update the UI / Firestore with the new plan
  // ...
}}>
  <Text>Mark Workout Complete</Text>
</TouchableOpacity>
```

### Step 3: Add "Mark as Rest" Button (New Feature)

**In the workout detail view, add:**
```typescript
<TouchableOpacity onPress={() => {
  scheduling.skipWorkout(new Date());
  // Update plan
}}>
  <Text>Skip This Workout (Rest Day)</Text>
</TouchableOpacity>
```

### Step 4: Update the Weekly View

**Current:**
```typescript
{planWeek.map((d, i) => (
  <Text>{d.dayLabel}</Text>
))}
```

**New:**
```typescript
{scheduling.scheduledDays.slice(0, 7).map((day) => (
  <View>
    <Text>{day.plannedWorkout?.workoutName || 'Rest'}</Text>
    {day.plannedWorkout?.isShifted && (
      <Text style={{ color: 'orange' }}>↑ Shifted earlier</Text>
    )}
  </View>
))}
```

### Step 5: Persist to Firestore

The new `TrainingPlan` structure needs to be saved. Add a useEffect in WorkoutsScreen:

```typescript
useEffect(() => {
  if (!scheduling.plan || !assignment?.planId) return;
  
  // Map the dynamicPlan back to Firestore format
  const firestoreData = {
    ...fullPlan,
    // Add fields to track dynamic scheduling state
    trainingSequence: scheduling.plan.trainingSequence,
    nextWorkoutIndex: scheduling.plan.nextWorkoutIndex,
    completedWorkouts: scheduling.plan.completedWorkouts,
    // Keep existing 'days' array unchanged for backward compatibility
  };
  
  // Save to Firestore
  updateDoc(planRef, firestoreData).catch(err =>
    console.log('Error saving dynamic plan:', err)
  );
}, [scheduling.plan]);
```

---

## Data Model: Backward Compatibility

**The new fields are additive.** Existing `plan.days` array remains unchanged:

```typescript
interface ClientPlan {
  id: string;
  name: string;
  days: PlanDay[]; // Existing: [Mon workout, Tue rest, Wed, ...]
  
  // NEW FIELDS (optional):
  trainingSequence?: string[];        // Only workouts
  nextWorkoutIndex?: number;          // Current position in sequence
  completedWorkouts?: CompletedWorkoutEntry[];
}
```

**For old plans (without dynamic fields):**
- Use `useBuildDynamicPlan(fullPlan)` to auto-generate `trainingSequence`
- `nextWorkoutIndex` starts at 0
- `completedWorkouts` starts empty

---

## Example: Complete User Flow

```
User starts their week Monday with a plan: Push(Mon), Pull(Wed), Legs(Fri)

Monday:
  - Sees "Push" scheduled
  - Too busy, marks as Rest
  - scheduling.skipWorkout(Mon)
  - All future workouts shift 1 day earlier
  - New view: Pull shows for Tuesday, Legs shows for Thursday

Tuesday:
  - Sees "Pull" (shifted from Wed)
  - Completes it
  - scheduling.completeWorkout(Tue)
  - nextWorkoutIndex = 1
  - View updates to show Legs for Thursday

Thursday (Rest day in template):
  - Realizes they want to accelerate, does Legs early
  - scheduling.completeWorkout(Thu)
  - wasOnRestDay = true is recorded
  - Plan is now complete for the week
  - UI can show "Cycle Complete!" or "Ready for next week"
```

---

## Testing

Run the test suite:

```bash
npm test -- shared/services/__tests__/dynamicScheduling.test.ts
```

The tests cover:
- Skip a training day (schedule compresses)
- Complete on a rest day (schedule accelerates)
- Catch-up on a missed workout
- Normal progression (no shifts)
- 14-day view with shifts
- Utility functions (progress, stats)
- Edge cases (multiple skips, full cycle completion)

---

## Handling Edge Cases

### What if a user tries to mark a rest day as Rest?

`markDayAsRest()` checks `getPlannedWorkoutForDate()` first. If there's no planned workout on that day, it logs a warning and returns early.

### What if the training sequence changes mid-cycle?

The `completedWorkouts` log contains indices into `trainingSequence`. If the sequence changes, those indices become stale. **Recommendation:** Treat a sequence change as a new plan cycle (reset `nextWorkoutIndex = 0`, optionally archive old `completedWorkouts`).

### What if a user completes the same workout twice?

`markWorkoutAsDone()` records a new completion entry each time. The `getPlannedWorkoutForDate()` logic counts completed entries, so doing the same workout twice advances the index twice. **Recommendation:** Add a check before `markWorkoutAsDone()` to prevent duplicates on the same date.

---

## Performance Considerations

- `getNext14DaysSchedule()` loops through 14 days; O(14 × completions) = O(constant)
- `getPlannedWorkoutForDate()` counts completions before a date: O(completions), typically O(1-10)
- Each `markWorkoutAsDone()` or `markDayAsRest()` is O(1) (just push to array)

**For very long-term plans (100+ weeks):**
- Consider caching the shift calculation (e.g., store `totalShiftDays: number` in the plan)
- The current algorithm recomputes shifts for every query, which is fine for ~50 entries

---

## Troubleshooting

### Workouts not showing shifted dates

Check:
1. Are skips being recorded with `wasSkipped: true`?
2. Is `calculateShift()` counting them correctly?
3. Print `scheduling.plannedForToday` and check `shiftDays`

### Completion log growing too large

If the app runs for months, `completedWorkouts` could grow large. Consider:
- Archiving old entries (e.g., older than 3 months) to a separate collection
- Keeping only the last N entries and computing historical shifts from a summary

---

## Future Enhancements

1. **Multiple cycles:** Support back-to-back training cycles (each with its own sequence)
2. **Deload weeks:** Build in automatic rest weeks after N completed workouts
3. **Flexible rest days:** Let users choose which rest days to use for catch-ups
4. **Mobile workout logs:** Sync with wearables to auto-mark workouts done
5. **Analytics:** Track how much users shift their schedules (e.g., "usually skip Tue")

---

## Questions?

Refer to the test file (`__tests__/dynamicScheduling.test.ts`) for concrete examples of each scenario.
