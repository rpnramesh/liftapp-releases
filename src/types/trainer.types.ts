// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Types
// TS-001 to TS-019 | Version 1.0 | March 2026
// ─────────────────────────────────────────────────────────────────────────────

export type TrainerRole = 'GYM_TRAINER' | 'FREELANCE_TRAINER';
export type MembershipStatus = 'Active' | 'Expiring' | 'Expired' | 'Inactive';
export type InviteStatus = 'Pending' | 'Accepted' | 'Expired';
export type VideoWatchStatus = 'not_watched' | 'in_progress' | 'watched';
export type ClassCategory = 'Yoga' | 'Cardio' | 'Strength' | 'Mobility' | 'Meditation' | 'General';
export type ClassStatus = 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
export type PaymentStatus = 'Received' | 'Pending' | 'Failed';
export type CertificationStatus = 'Pending Review' | 'Lift-Verified' | 'Not Verified';
export type ClientType = 'gym' | 'freelance';
export type PaymentType = 'Online' | 'Offline';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TrainerJWT {
  trainerId: string;
  role: 'TRAINER';
  gymId: string | null;
  isFreelance: boolean;
  exp: number;
}

export interface TrainerRegistrationPayload {
  fullName: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  specializations: string[];
  yearsOfExperience: number;
  bio?: string;
  profilePhotoUri?: string;
}

// ─── Trainer Profile ─────────────────────────────────────────────────────────

export interface TrainerProfile {
  id: string;
  fullName: string;
  phone: string;
  age: number;
  gender: string;
  profilePhotoUrl: string | null;
  specializations: string[];
  yearsOfExperience: number;
  bio: string;
  isLifeVerified: boolean;
  gymId: string | null;
  gymName?: string;
  gymAddress?: string;
  isFreelance: boolean;
  freelanceMonthlyFee?: number;
  acceptingNewClients: boolean;
  certifications: Certification[];
  availabilityHours?: AvailabilityHours;
}

export interface Certification {
  id: string;
  name: string;
  imageUrl: string;
  status: CertificationStatus;
  uploadedAt: string;
}

export interface AvailabilityHours {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export interface DayAvailability {
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface TrainerDashboard {
  todaySchedule: ScheduledSession[];
  recentActivity: ActivityFeedItem[];
  pendingActions: PendingActions;
  quickStats: QuickStats;
  earningsSummary: EarningsSummary;
}

export interface ScheduledSession {
  clientId: string;
  clientName: string;
  clientPhotoUrl: string | null;
  planName: string;
  lastWorkoutStatus: 'completed' | 'incomplete' | 'not_started';
}

export interface ActivityFeedItem {
  clientId: string;
  clientName: string;
  clientPhotoUrl: string | null;
  workoutName: string;
  status: 'completed' | 'incomplete';
  timeAgo: string;
  logId: string;
}

export interface PendingActions {
  clientsWithoutPlan: number;
  missedWorkouts: number;
  feeDue: number;
}

export interface QuickStats {
  totalActiveClients: number;
  sessionsThisWeek: number;
  unreadLogs: number;
}

export interface EarningsSummary {
  thisMonthTotal: number;
  gymSalary: number;
  freelanceFees: number;
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export interface ClientCard {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
  membershipStatus: MembershipStatus;
  lastWorkoutDate: string | null;
  assignedPlanName: string | null;
  streak: number;
  hasRiskFlag: boolean;
  clientType: ClientType;
}

export interface ClientProfile {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
  age: number;
  gender: string;
  phone: string;
  healthGoals: string[];
  membershipStatus: MembershipStatus;
  currentPlanName: string | null;
  planAssignedDate: string | null;
  latestWeight: number | null;
  latestBMI: number | null;
  lastWorkoutDate: string | null;
  totalWorkoutsLogged: number;
  currentStreak: number;
  attendanceThisMonth: number;
  clientType: ClientType;
}

// ─── Workout Plans ───────────────────────────────────────────────────────────

export interface WorkoutPlan {
  id: string;
  name: string;
  trainerId: string;
  memberId: string;
  memberName: string;
  days: WorkoutDay[];
  assignedAt: string;
  isActive: boolean;
}

export interface WorkoutDay {
  dayLabel: string;
  exercises: Exercise[];
  restDay: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
  videoId?: string;
  videoTitle?: string;
  videoThumbnailUrl?: string;
}

export interface WorkoutLog {
  id: string;
  memberId: string;
  memberName: string;
  memberPhotoUrl: string | null;
  planName: string;
  dayLabel: string;
  completedExercises: CompletedExercise[];
  status: 'completed' | 'incomplete';
  loggedAt: string;
  trainerNote?: string;
}

export interface CompletedExercise {
  exerciseId: string;
  exerciseName: string;
  actualSets: number;
  actualReps: string;
  completed: boolean;
  notes?: string;
}

// ─── Video Library ───────────────────────────────────────────────────────────

export interface TrainerVideo {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  videoUrl: string;
  durationSeconds: number;
  uploadedAt: string;
  isPersonalized: boolean;
  assignedMemberId?: string;
  assignedMemberName?: string;
  watchStatus?: VideoWatchStatus;
  watchedPercent?: number;
  expiresAt?: string;
  isExpired?: boolean;
}

export interface VideoUploadPayload {
  videoUri: string;
  title: string;
  description: string;
  category?: string;
  memberId?: string;
  expiresAt?: string;
}

// ─── Live Classes ────────────────────────────────────────────────────────────

export interface LiveClass {
  id: string;
  trainerId: string;
  gymId: string | null;
  name: string;
  category: ClassCategory;
  scheduledAt: string;
  durationMinutes: 30 | 45 | 60 | 90;
  maxParticipants: number;
  rsvpCount: number;
  description?: string;
  recordSession: boolean;
  status: ClassStatus;
  averageRating?: number;
  recordingUrl?: string;
  attendees?: ClassAttendee[];
}

export interface ClassAttendee {
  memberId: string;
  memberName: string;
  memberPhotoUrl: string | null;
  hasRaisedHand: boolean;
  isMuted: boolean;
}

export interface CreateClassPayload {
  name: string;
  category: ClassCategory;
  scheduledAt: string;
  durationMinutes: 30 | 45 | 60 | 90;
  maxParticipants: number;
  description?: string;
  recordSession: boolean;
}

// ─── Progress Monitoring ─────────────────────────────────────────────────────

export interface WeightEntry {
  date: string;
  weightKg: number;
  bmi: number;
  trainerAnnotation?: string;
}

export interface BodyMeasurement {
  date: string;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  armsLeftCm?: number;
  armsRightCm?: number;
  thighsLeftCm?: number;
  thighsRightCm?: number;
  calfLeftCm?: number;
  calfRightCm?: number;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  photoUrl: string;
  caption?: string;
  trainerComment?: string;
  isSharedWithTrainer: boolean;
}

// ─── Freelance ───────────────────────────────────────────────────────────────

export interface FreelanceInvite {
  id: string;
  inviteCode: string;
  inviteLink: string;
  monthlyFee: number;
  startDate: string;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  clientName?: string;
  clientId?: string;
}

export interface CreateInvitePayload {
  monthlyFee: number;
  startDate?: string;
}

export interface ManualClientPayload {
  name: string;
  phone: string;
  planName: string;
  monthlyFee: number;
  paymentType: PaymentType;
}

// ─── Earnings ────────────────────────────────────────────────────────────────

export interface TrainerEarnings {
  month: string;
  totalReceived: number;
  pendingPayouts: number;
  thisYearTotal: number;
  gymSalary: number;
  freelanceFees: number;
  sessionBonuses: number;
  monthlyTrend: MonthlyEarning[];
}

export interface MonthlyEarning {
  month: string;
  gymSalary: number;
  freelanceFees: number;
  total: number;
}

export interface FeeDue {
  clientId: string;
  clientName: string;
  clientPhone: string;
  amountDue: number;
  daysOverdue: number;
  paymentLink: string;
}

export interface PaymentRecord {
  id: string;
  date: string;
  clientName: string;
  amount: number;
  description: string;
  status: PaymentStatus;
  receiptUrl?: string;
  payoutDate?: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'workout_logged'
  | 'client_invited_accepted'
  | 'membership_due'
  | 'video_watched'
  | 'class_rsvp'
  | 'class_reminder'
  | 'payment_received'
  | 'payment_failed'
  | 'client_reassigned'
  | 'system';

export interface TrainerNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  deeplink?: string;
  createdAt: string;
  clientId?: string;
  clientName?: string;
}

export interface NotificationPreference {
  type: NotificationType;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
}
