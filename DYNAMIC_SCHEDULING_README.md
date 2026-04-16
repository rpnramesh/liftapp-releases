# Dynamic Workout Scheduling System

A TypeScript-based system for rescheduling workouts dynamically as users skip days, complete early, or work out on rest days.

## What You Get

### 1. **Core Logic** (`shared/services/dynamicScheduling.ts`)

Complete TypeScript implementation with:
- **Interfaces** for `TrainingPlan`, `PlannedWorkout`, `CompletedWorkoutEntry`
- **4 main functions:**
  - `getPlannedWorkoutForDate(date, plan)` — What should happen on a date
  - `markWorkoutAsDone(date, plan)` — Record a completed workout
  - `markDayAsRest(date, plan)` — Mark a day as skipped
  - `getNext14DaysSchedule(startDate, plan)` — Full 2-week view
- **Helper functions:**
  - `getScheduledDateForWorkout(index, plan)` — When will workout N happen
  - `getScheduleStats(plan)` — Progress tracking

### 2. **React Integration** (`shared/hooks/useDynamicScheduling.ts`)

- `useDynamicScheduling()` hook — Drop-in replacement for current state
- `useBuildDynamicPlan()` hook — Convert existing plans to dynamic format
- Automatic plan persistence
- UI-friendly return values

### 3. **Comprehensive Tests** (`shared/services/__tests__/dynamicScheduling.test.ts`)

Full test coverage demonstrating:
- ✅ Skip a training day → future workouts shift 1 day earlier
- ✅ Complete a workout on a rest day → schedule accelerates
- ✅ Catch-up on a missed workout → schedule normalizes
- ✅ Normal progression → no shifts
- ✅ 14-day schedule view with shifts
- ✅ Multiple skips and edge cases

### 4. **Integration Guide** (`DYNAMIC_SCHEDULING_INTEGRATION.md`)

Step-by-step instructions to:
- Initialize dynamic plans in WorkoutsScreen
- Update "Mark Complete" buttons
- Add "Mark as Rest" button (new feature)
- Update weekly view to show shifted dates
- Persist to Firestore
- Handle backward compatibility

---

## Key Algorithm: How Shifts Work

### State Tracking
```typescript
interface TrainingPlan {
  weeklyTemplate: Record<DayOfWeek, string>; // Base schedule
  trainingSequence: string[];                 // Workouts only (no REST)
  nextWorkoutIndex: number;                   // Current position
  completedWorkouts: CompletedWorkoutEntry[]; // Log of all user actions
}
```

### The Shift Calculation

For any date, determine:
1. **How many workouts have been completed before this date?**
   - This index tells you which workout in the sequence should be done
2. **How many shifts have occurred?**
   - Each skip: -1 day (workouts move earlier)
   - Each rest-day completion: -1 day (workouts move earlier)
   - Cumulative effect: shifts compound

### Example

```
Template:     Push(Mon), REST(Tue), Pull(Wed), REST(Thu), Legs(Fri)
Sequence:     [Push, Pull, Legs]

Timeline:
Mon: User marks as Rest
  → Skip recorded
  → All future workouts shift -1 day

Tue: User completes Push (catch-up)
  → Completion logged with wasOnRestDay: true
  → nextWorkoutIndex advances to 1
  → All future workouts shift another -1 day

Now:
- Pull is scheduled 2 days earlier (from Wed → Mon of next week, or effectively earlier)
- Legs is scheduled 2 days earlier (from Fri → Wed)
```

---

## Usage Example

### Basic Usage

```typescript
import { useDynamicScheduling } from './shared/hooks/useDynamicScheduling';

function WorkoutsScreen() {
  const scheduling = useDynamicScheduling({
    plan: currentPlan,
    onPlanChange: (updated) => saveToDB(updated),
  });

  return (
    <>
      {/* Show what's planned for today */}
      <Text>Today: {scheduling.plannedForToday?.workoutName}</Text>
      <Text>Tomorrow: {scheduling.plannedForTomorrow?.workoutName}</Text>

      {/* Mark a workout done */}
      <Button
        title="Complete Workout"
        onPress={() => scheduling.completeWorkout(new Date())}
      />

      {/* Skip a workout (new feature) */}
      <Button
        title="Skip (Rest Day)"
        onPress={() => scheduling.skipWorkout(new Date())}
      />

      {/* Show 14-day schedule with shifts */}
      {scheduling.scheduledDays.map((day) => (
        <View key={day.date.toISOString()}>
          <Text>{day.date.toLocaleDateString()}</Text>
          {day.plannedWorkout ? (
            <>
              <Text>{day.plannedWorkout.workoutName}</Text>
              {day.plannedWorkout.isShifted && (
                <Text style={{ color: 'orange' }}>
                  ↑ Shifted {Math.abs(day.plannedWorkout.shiftDays)} day(s) earlier
                </Text>
              )}
            </>
          ) : (
            <Text>Rest</Text>
          )}
        </View>
      ))}

      {/* Show progress */}
      <ProgressBar value={scheduling.progressPercent} />
      <Text>{scheduling.stats.cycleProgress}</Text>
    </>
  );
}
```

### Low-Level Usage (Core Functions)

```typescript
import {
  getPlannedWorkoutForDate,
  markWorkoutAsDone,
  markDayAsRest,
  getNext14DaysSchedule,
} from './shared/services/dynamicScheduling';

// What's planned for tomorrow?
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const planned = getPlannedWorkoutForDate(tomorrow, myPlan);
console.log(planned);
// Output:
// {
//   workoutName: 'Pull',
//   workoutIndex: 1,
//   originalDay: 3 (Wednesday),
//   isShifted: true,
//   shiftDays: -1,
//   isAlreadyCompleted: false,
//   wasSkipped: false,
// }

// Mark it done
markWorkoutAsDone(tomorrow, myPlan);

// Or skip it
markDayAsRest(tomorrow, myPlan);

// Get full 2-week view
const schedule = getNext14DaysSchedule(new Date(), myPlan);
schedule.dates.forEach((day) => {
  console.log(`${day.date}: ${day.plannedWorkout?.workoutName || 'Rest'}`);
});
```

---

## Data Model

### TrainingPlan
```typescript
{
  weeklyTemplate: {
    0: 'REST',   // Sunday
    1: 'Push',   // Monday
    2: 'REST',   // Tuesday
    3: 'Pull',   // Wednesday
    4: 'REST',   // Thursday
    5: 'Legs',   // Friday
    6: 'REST',   // Saturday
  },
  trainingSequence: ['Push', 'Pull', 'Legs'],
  nextWorkoutIndex: 0,
  completedWorkouts: [
    {
      date: Date('2025-04-14'),
      workoutIndex: 0,
      workoutName: 'Push',
      wasSkipped: true,
      wasOnRestDay: false,
    }
  ],
  planStartDate: Date('2025-04-14'),
}
```

### PlannedWorkout
```typescript
{
  workoutName: 'Pull',
  workoutIndex: 1,
  originalDay: 3,        // Wednesday
  isShifted: true,       // Date ≠ original day
  shiftDays: -1,         // 1 day earlier
  isAlreadyCompleted: false,
  wasSkipped: false,
}
```

### ScheduledDay
```typescript
{
  date: Date('2025-04-15'),
  dayOfWeek: 2,          // Tuesday
  templateWorkout: 'REST',
  plannedWorkout: { /* PlannedWorkout */ },
  isRestDay: true,
}
```

---

## Backward Compatibility

The new fields are **additive**. Existing `plan.days` array remains unchanged:

```typescript
// Old plan
const plan = {
  id: '...',
  days: [ /* existing 7-element array */ ],
  // ... other fields
};

// New plan (backward compatible)
const plan = {
  id: '...',
  days: [ /* same as before */ ],
  trainingSequence: ['Push', 'Pull', 'Legs'],
  nextWorkoutIndex: 0,
  completedWorkouts: [],
  // ... other fields
};
```

The `useBuildDynamicPlan()` hook automatically generates the new fields from existing plans.

---

## Testing

```bash
# Run the test suite
npm test -- shared/services/__tests__/dynamicScheduling.test.ts

# Run with coverage
npm test -- --coverage shared/services/__tests__/dynamicScheduling.test.ts
```

All tests pass and cover:
- Normal progression
- Skipped workouts
- Early completions
- Rest day workouts
- Catch-up scenarios
- Edge cases

---

## Next Steps

1. **Review the core logic** (`dynamicScheduling.ts`) — understand the shift algorithm
2. **Check the tests** (`__tests__/dynamicScheduling.test.ts`) — see concrete examples
3. **Read the integration guide** (`DYNAMIC_SCHEDULING_INTEGRATION.md`) — step-by-step wiring
4. **Hook it up** — integrate into WorkoutsScreen (5-10 min per section)
5. **Persist to Firestore** — save the new fields alongside existing data

---

## Files

```
shared/services/dynamicScheduling.ts          (450 lines) - Core logic
shared/hooks/useDynamicScheduling.ts          (180 lines) - React hooks
shared/services/__tests__/...test.ts          (400 lines) - Tests
DYNAMIC_SCHEDULING_INTEGRATION.md             (300 lines) - Integration guide
DYNAMIC_SCHEDULING_README.md                  (this file)
```

---

## Questions?

See the **commented examples** throughout `dynamicScheduling.ts` and the **test scenarios** in `__tests__/dynamicScheduling.test.ts`.
