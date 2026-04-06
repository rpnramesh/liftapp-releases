// ─────────────────────────────────────────────────────────────────────────────
// Lift — Shared Types (Member App + Trainer App)
// ─────────────────────────────────────────────────────────────────────────────

// ── User roles ────────────────────────────────────────────────────────────────
export type UserRole = 'member' | 'trainer' | 'gym_admin';

// ── Gym ───────────────────────────────────────────────────────────────────────
export interface Gym {
  id: string;
  name: string;
  address: string;
  phone: string;
  ownerUid: string;
  createdAt: number;
}

// ── Member ────────────────────────────────────────────────────────────────────
export interface Member {
  id: string;                  // Firebase UID
  gymId: string;
  trainerId: string | null;
  trainerName?: string;
  name: string;
  phone: string;
  email?: string;
  height: number;              // cm
  weight: number;              // kg
  goalWeight: number;          // kg
  age?: number;
  gender?: string;
  plan: string;                // e.g. 'Monthly'
  planStartDate: number;       // timestamp
  planEndDate: number;         // timestamp
  active: boolean;
  isFrozen?: boolean;
  fcmToken?: string;           // for push notifications
  createdAt: number;
  photoUrl?: string;
  // ── Payment / Membership (written by Gym Management app) ──
  joiningDate?: number;        // timestamp — first-ever joining date
  amountPaid?: number;         // last payment amount
  paidDate?: number;           // timestamp of last payment
  paymentStatus?: 'paid' | 'pending' | 'overdue';
  paymentMethod?: string;      // 'cash' | 'upi' | 'card' etc.
}

// ── Trainer ───────────────────────────────────────────────────────────────────
export interface Trainer {
  id: string;                  // Firebase UID
  gymId: string | null;
  isFreelance: boolean;
  name: string;
  phone: string;
  email?: string;
  specialization?: string;
  fcmToken?: string;
  active: boolean;
  createdAt: number;
  photoUrl?: string;
}

// ── Exercise ──────────────────────────────────────────────────────────────────
export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  rest: number;                // seconds
  note: string;
  videoUri?: string;
  videoThumb?: string;
  weight?: number;             // optional default weight kg
}

// ── Workout ───────────────────────────────────────────────────────────────────
export type WorkoutDayLabel =
  | 'Push Day A' | 'Push Day B'
  | 'Pull Day'
  | 'Legs'
  | 'Upper Body'
  | 'Lower Body'
  | 'Full Body'
  | 'Cardio'
  | 'Core'
  | 'Rest';

export interface WorkoutDay {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  label: WorkoutDayLabel;
  rest: boolean;
  workoutId?: string;          // ref to Workout doc
}

export interface Workout {
  id: string;
  gymId: string;
  trainerId: string;
  name: string;                // e.g. 'Push Day A'
  estimatedMinutes: number;
  exercises: Exercise[];
  createdAt: number;
  updatedAt: number;
}

// ── Workout Assignment ────────────────────────────────────────────────────────
// One document per member, holds their current weekly plan
export interface WorkoutAssignment {
  id: string;                  // usually memberId
  gymId: string;
  memberId: string;
  trainerId: string;
  weekPlan: WorkoutDay[];      // 7-day plan
  todayWorkoutId: string | null;
  assignedAt: number;
  updatedAt: number;
}

// ── Workout Log (member completes a workout) ──────────────────────────────────
export interface SetLog {
  setNo: number;
  reps: number;
  weight: number;              // kg
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
}

export interface WorkoutLog {
  id: string;
  gymId: string;
  memberId: string;
  workoutId: string;
  workoutName: string;
  durationSeconds: number;
  exerciseLogs: ExerciseLog[];
  completedAt: number;
}

// ── Progress ──────────────────────────────────────────────────────────────────
export interface WeightEntry {
  id: string;
  memberId: string;
  gymId: string;
  weight: number;              // kg
  loggedAt: number;            // timestamp
  note?: string;
}

export interface MeasurementEntry {
  id: string;
  memberId: string;
  gymId: string;
  type: string;                // 'Chest', 'Waist', 'Hips', etc.
  value: number;               // cm
  loggedAt: number;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export type MessageType = 'text' | 'image' | 'voice' | 'workout_card';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: 'member' | 'trainer';
  type: MessageType;
  text?: string;
  mediaUrl?: string;           // for image / voice
  workoutId?: string;          // for workout_card type
  readBy: string[];            // array of UIDs who have read
  createdAt: number;
}

// Chat thread between one trainer and one member
export interface ChatThread {
  id: string;                  // `${gymId}_${trainerId}_${memberId}`
  gymId: string;
  trainerId: string;
  memberId: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: {
    [uid: string]: number;
  };
}

// ── Video ─────────────────────────────────────────────────────────────────────
export interface Video {
  id: string;
  gymId: string;
  trainerId: string;
  trainerName: string;
  title: string;
  description?: string;
  duration: string;            // '12 min'
  category: string;
  videoUrl: string;
  thumbUrl?: string;
  assignedTo: string[];        // array of memberIds, empty = all members
  createdAt: number;
}

// ── Notification ──────────────────────────────────────────────────────────────
export type NotifType =
  | 'workout_assigned'
  | 'message_received'
  | 'membership_expiring'
  | 'progress_reminder'
  | 'class_reminder';

export interface Notification {
  id: string;
  recipientId: string;
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, string>;
  createdAt: number;
}
