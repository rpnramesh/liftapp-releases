// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Constants
// ─────────────────────────────────────────────────────────────────────────────

// Brand
export const LIFT_TEAL = '#0E7490';
export const LIFT_TEAL_DARK = '#0C6478';
export const LIFT_TEAL_LIGHT = '#CFFAFE';

// Status colours
export const STATUS_COLORS = {
  active: '#16A34A',
  expiring: '#D97706',
  expired: '#DC2626',
  inactive: '#6B7280',
  completed: '#16A34A',
  incomplete: '#6B7280',
  pending: '#D97706',
  received: '#16A34A',
  failed: '#DC2626',
  not_watched: '#6B7280',
  in_progress: '#D97706',
  watched: '#16A34A',
} as const;

// Risk flag thresholds
export const RISK_FLAG = {
  MISSED_WORKOUT_DAYS: 5,
  MEMBERSHIP_EXPIRY_WARNING_DAYS: 3,
} as const;

// Live class durations
export const CLASS_DURATIONS = [30, 45, 60, 90] as const;

// Live class categories
export const CLASS_CATEGORIES = [
  'Yoga',
  'Cardio',
  'Strength',
  'Mobility',
  'Meditation',
  'General',
] as const;

// Specialization options
export const SPECIALIZATIONS = [
  'Weight Training',
  'Yoga',
  'Cardio',
  'CrossFit',
  'HIIT',
  'Pilates',
  'Zumba',
  'Sports Conditioning',
  'Rehabilitation',
  'Nutrition Coaching',
  'Bodybuilding',
  'Functional Training',
  'Mobility & Flexibility',
] as const;

// Video categories
export const VIDEO_CATEGORIES = [
  'Warm-Up',
  'Strength',
  'Cardio',
  'Mobility',
  'Cool-Down',
  'Technique',
  'Nutrition Tips',
  'Motivation',
  'Full Body',
  'Upper Body',
  'Lower Body',
  'Core',
] as const;

// Upload limits
export const UPLOAD_LIMITS = {
  PROFILE_PHOTO_MB: 5,
  VIDEO_MB: 500,
  LARGE_VIDEO_THRESHOLD_MB: 50,
  CERTIFICATION_PHOTO_MB: 10,
} as const;

// API timeouts
export const API_TIMEOUT_MS = 15_000;

// Token expiry
export const TOKEN = {
  ACCESS_EXPIRY_HOURS: 1,
  REFRESH_EXPIRY_DAYS: 30,
} as const;

// Pagination
export const PAGE_SIZE = 20;

// Freelance invite expiry
export const INVITE_EXPIRY_DAYS = 7;

// Freelance client limit (per plan)
export const MAX_FREELANCE_CLIENTS = 30;

// Live class
export const LIVE_CLASS = {
  START_BUTTON_ACTIVE_BEFORE_MINUTES: 10,
  EDIT_ALLOWED_BEFORE_HOURS: 2,
  AGORA_RECONNECT_TIMEOUT_SEC: 30,
  HOST_HOLD_DURATION_SEC: 120,
  RSVP_WARNING_NOTIFICATION_MIN: 5,
} as const;

// Notification types readable labels
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  workout_logged: 'Workout Logged',
  client_invited_accepted: 'New Client',
  membership_due: 'Fee Due',
  video_watched: 'Video Watched',
  class_rsvp: 'Class RSVP',
  class_reminder: 'Class Reminder',
  payment_received: 'Payment Received',
  payment_failed: 'Payment Failed',
  client_reassigned: 'Client Reassigned',
  system: 'System',
};

// Day labels for workout plan builder
export const WORKOUT_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

// Bottom navigation tabs (TS-006 AC4)
export const TRAINER_NAV_TABS = [
  { key: 'Home', label: 'Home', icon: 'home-outline' },
  { key: 'Clients', label: 'Clients', icon: 'people-outline' },
  { key: 'Videos', label: 'Videos', icon: 'play-circle-outline' },
  { key: 'Schedule', label: 'Schedule', icon: 'calendar-outline' },
  { key: 'Profile', label: 'Profile', icon: 'person-outline' },
] as const;

// i18n keys (English defaults — Malayalam in ml.json)
export const I18N = {
  GREETING_MORNING: 'Good morning',
  GREETING_AFTERNOON: 'Good afternoon',
  GREETING_EVENING: 'Good evening',
  GREETING_NIGHT: 'Good night',
  OFFLINE_BANNER: 'No Internet — client data may be outdated',
  OFFLINE_ACTION: 'You are offline. This action requires internet.',
  ROLE_ERROR: 'This app is for Lift Trainers. Please use the Lift Member App.',
  ACCOUNT_DEACTIVATED: 'Your account has been deactivated. Contact your gym or Lift support.',
  GYM_ACCOUNT_INACTIVE: 'Your gym account is inactive. Contact your gym admin.',
} as const;

// Razorpay payout lag
export const RAZORPAY_PAYOUT_DAYS = 2; // T+2 banking days
