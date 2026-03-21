// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Analytics Service
//
// Logs all trainer-specific events listed in the non-functional requirements.
// Wraps Firebase Analytics (or swap with Mixpanel / Amplitude).
//
// Install:
//   npx expo install @react-native-firebase/app @react-native-firebase/analytics
//
// If using plain Expo without Firebase native:
//   npx expo install expo-firebase-analytics
// ─────────────────────────────────────────────────────────────────────────────

// ─── Event catalogue ─────────────────────────────────────────────────────────
// Matches the Analytics spec in TS-011 (Section 11 — Non-Functional Requirements)

export type TrainerAnalyticsEvent =
  | 'app_open'
  | 'registration_started'
  | 'registration_completed'
  | 'otp_requested'
  | 'otp_verified'
  | 'gym_linked'
  | 'freelance_setup'
  | 'plan_created'
  | 'plan_assigned'
  | 'workout_log_note_added'
  | 'video_uploaded'
  | 'video_personal_uploaded'
  | 'class_scheduled'
  | 'class_started'
  | 'class_ended'
  | 'client_invited'
  | 'client_manual_added'
  | 'earnings_viewed'
  | 'fee_reminder_sent'
  | 'profile_updated'
  | 'certification_uploaded'
  | 'gym_left'
  | 'logout'
  | 'delete_account_initiated';

// ─── Parameter types ─────────────────────────────────────────────────────────

interface EventParams {
  app_open: { trainerId?: string; gymId?: string | null; isFreelance?: boolean };
  registration_started: Record<string, never>;
  registration_completed: { trainerId: string };
  otp_requested: Record<string, never>;
  otp_verified: { isNewUser: boolean };
  gym_linked: { gymId: string; gymName: string };
  freelance_setup: { monthlyFee: number };
  plan_created: { trainerId: string; planId: string; dayCount: number; exerciseCount: number };
  plan_assigned: { trainerId: string; planId: string; memberId: string };
  workout_log_note_added: { trainerId: string; logId: string };
  video_uploaded: { trainerId: string; category: string; isPersonalized: false };
  video_personal_uploaded: { trainerId: string; memberId: string; hasExpiry: boolean };
  class_scheduled: { trainerId: string; classId: string; category: string; durationMinutes: number };
  class_started: { trainerId: string; classId: string; rsvpCount: number };
  class_ended: { trainerId: string; classId: string; attendeeCount: number; durationMinutes: number };
  client_invited: { trainerId: string; inviteId: string; monthlyFee: number };
  client_manual_added: { trainerId: string; paymentType: 'Online' | 'Offline' };
  earnings_viewed: { trainerId: string; month: string };
  fee_reminder_sent: { trainerId: string; memberId: string; daysOverdue: number };
  profile_updated: { trainerId: string; fieldsUpdated: string[] };
  certification_uploaded: { trainerId: string };
  gym_left: { trainerId: string; gymId: string };
  logout: { trainerId: string };
  delete_account_initiated: { trainerId: string };
}

// ─── Stub logger (replace body with Firebase/Analytics call) ─────────────────

type EventMap = {
  [K in TrainerAnalyticsEvent]: K extends keyof EventParams ? EventParams[K] : Record<string, unknown>;
};

class AnalyticsService {
  private enabled: boolean;

  constructor() {
    // Disable in development — set via env var
    this.enabled = process.env.NODE_ENV === 'production';
  }

  /**
   * Log a typed analytics event.
   * Replace the console.log with your analytics SDK call.
   *
   * Example with Firebase:
   *   import analytics from '@react-native-firebase/analytics';
   *   await analytics().logEvent(event, params);
   */
  async log<K extends TrainerAnalyticsEvent>(
    event: K,
    params: K extends keyof EventParams ? EventParams[K] : Record<string, unknown>,
  ): Promise<void> {
    if (!this.enabled) {
      if (__DEV__) console.log(`[Analytics] ${event}`, params);
      return;
    }

    try {
      // ── Firebase example ──────────────────────────────────────────────────
      // const analytics = (await import('@react-native-firebase/analytics')).default;
      // await analytics().logEvent(event, params as Record<string, unknown>);

      // ── Mixpanel example ─────────────────────────────────────────────────
      // Mixpanel.track(event, params);

      // ── Amplitude example ────────────────────────────────────────────────
      // amplitude.track(event, params);
    } catch (err) {
      // Analytics failures should never crash the app
      if (__DEV__) console.warn('[Analytics] Failed to log event:', event, err);
    }
  }

  /** Set user identity (call after successful login) */
  async identify(trainerId: string): Promise<void> {
    if (!this.enabled) return;
    try {
      // Firebase: analytics().setUserId(trainerId);
      // Mixpanel: Mixpanel.identify(trainerId);
    } catch {}
  }

  /** Clear identity (call on logout) */
  async reset(): Promise<void> {
    if (!this.enabled) return;
    try {
      // Firebase: analytics().setUserId(null);
      // Mixpanel: Mixpanel.reset();
    } catch {}
  }

  /** Set persistent user properties */
  async setUserProperties(props: {
    gymId?: string | null;
    isFreelance?: boolean;
    trainerType?: string;
  }): Promise<void> {
    if (!this.enabled) return;
    try {
      // Firebase: analytics().setUserProperties(props);
    } catch {}
  }
}

export const analytics = new AnalyticsService();

// ─── Convenience wrappers (used directly in screens) ─────────────────────────

export const logAppOpen = (trainerId?: string, gymId?: string | null, isFreelance?: boolean) =>
  analytics.log('app_open', { trainerId, gymId, isFreelance });

export const logPlanCreated = (trainerId: string, planId: string, dayCount: number, exerciseCount: number) =>
  analytics.log('plan_created', { trainerId, planId, dayCount, exerciseCount });

export const logPlanAssigned = (trainerId: string, planId: string, memberId: string) =>
  analytics.log('plan_assigned', { trainerId, planId, memberId });

export const logVideoUploaded = (trainerId: string, category: string) =>
  analytics.log('video_uploaded', { trainerId, category, isPersonalized: false });

export const logPersonalVideoUploaded = (trainerId: string, memberId: string, hasExpiry: boolean) =>
  analytics.log('video_personal_uploaded', { trainerId, memberId, hasExpiry });

export const logClassScheduled = (trainerId: string, classId: string, category: string, durationMinutes: number) =>
  analytics.log('class_scheduled', { trainerId, classId, category, durationMinutes });

export const logClassStarted = (trainerId: string, classId: string, rsvpCount: number) =>
  analytics.log('class_started', { trainerId, classId, rsvpCount });

export const logClassEnded = (trainerId: string, classId: string, attendeeCount: number, durationMinutes: number) =>
  analytics.log('class_ended', { trainerId, classId, attendeeCount, durationMinutes });

export const logClientInvited = (trainerId: string, inviteId: string, monthlyFee: number) =>
  analytics.log('client_invited', { trainerId, inviteId, monthlyFee });

export const logEarningsViewed = (trainerId: string, month: string) =>
  analytics.log('earnings_viewed', { trainerId, month });

export const logLogout = (trainerId: string) =>
  analytics.log('logout', { trainerId });
