// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — API Service
// All endpoints from user stories TS-001 to TS-019
// ─────────────────────────────────────────────────────────────────────────────

import { API_TIMEOUT_MS } from '../constants/trainer.constants';
import {
    BodyMeasurement,
    ClassAttendee,
    ClientCard,
    ClientProfile,
    CreateClassPayload,
    CreateInvitePayload,
    FeeDue,
    FreelanceInvite,
    LiveClass,
    ManualClientPayload,
    PaymentRecord,
    ProgressPhoto,
    TrainerDashboard,
    TrainerEarnings,
    TrainerNotification,
    TrainerProfile,
    TrainerRegistrationPayload,
    TrainerVideo,
    VideoUploadPayload,
    WeightEntry,
    WorkoutLog,
    WorkoutPlan
} from '../types/trainer.types';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.lift.app/api/v1';

// ─── HTTP Utility ─────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function http<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(res.status, err.message ?? 'Unknown error');
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, (e as Error).message ?? 'Network error');
  }
}

// ─── Auth (TS-001 to TS-005) ─────────────────────────────────────────────────

export const AuthAPI = {
  /** TS-001: Validate token on cold start */
  validateToken: (token: string) =>
    http<{ role: string; gymId: string | null; isFreelance: boolean }>(
      '/auth/validate-token',
      { method: 'GET' },
      token,
    ),

  /** TS-003: Register new trainer */
  register: (payload: TrainerRegistrationPayload) =>
    http<{ trainerId: string; otpSent: boolean }>('/auth/trainer/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** TS-004: Request OTP */
  requestOTP: (phone: string) =>
    http<{ otpSent: boolean }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  /** TS-004: Verify OTP */
  verifyOTP: (phone: string, otp: string) =>
    http<{ accessToken: string; refreshToken: string; trainerId: string }>(
      '/auth/otp/verify',
      { method: 'POST', body: JSON.stringify({ phone, otp }) },
    ),

  /** TS-005: Link gym */
  linkGym: (trainerId: string, gymInviteCode: string, token: string) =>
    http<{ gymId: string; gymName: string }>(
      `/trainers/${trainerId}/link-gym`,
      { method: 'POST', body: JSON.stringify({ gymInviteCode }) },
      token,
    ),

  /** TS-005: Setup as freelance */
  setupFreelance: (trainerId: string, monthlyFee: number, token: string) =>
    http<{ freelanceEnabled: boolean }>(
      `/trainers/${trainerId}/setup-freelance`,
      { method: 'POST', body: JSON.stringify({ monthlyFee }) },
      token,
    ),

  /** TS-005: Get trainer invite link */
  getInviteLink: (trainerId: string, token: string) =>
    http<{ inviteLink: string }>(`/trainers/${trainerId}/invite-link`, { method: 'GET' }, token),

  /** Logout */
  logout: (trainerId: string, fcmToken: string, token: string) =>
    http<void>(
      '/auth/logout',
      { method: 'POST', body: JSON.stringify({ fcmToken }) },
      token,
    ),

  /** Refresh tokens */
  refreshToken: (refreshToken: string) =>
    http<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  /** Register FCM token */
  registerFCM: (fcmToken: string, token: string) =>
    http<void>('/auth/fcm-token', { method: 'POST', body: JSON.stringify({ token: fcmToken }) }, token),
};

// ─── Dashboard (TS-006) ──────────────────────────────────────────────────────

export const DashboardAPI = {
  /** TS-006: Load trainer dashboard */
  getDashboard: (trainerId: string, token: string) =>
    http<TrainerDashboard>(`/trainers/${trainerId}/dashboard`, { method: 'GET' }, token),
};

// ─── Clients (TS-007) ────────────────────────────────────────────────────────

export const ClientsAPI = {
  /** TS-007 AC1: Get client list */
  getClients: (
    trainerId: string,
    type: 'gym' | 'freelance' | 'all',
    page: number,
    token: string,
  ) =>
    http<{ clients: ClientCard[]; total: number; page: number }>(
      `/trainers/${trainerId}/clients?type=${type}&page=${page}`,
      { method: 'GET' },
      token,
    ),

  /** TS-007 AC5: Get client profile */
  getClientProfile: (trainerId: string, memberId: string, token: string) =>
    http<ClientProfile>(`/trainers/${trainerId}/clients/${memberId}/profile`, { method: 'GET' }, token),
};

// ─── Workout Plans (TS-008) ──────────────────────────────────────────────────

export const WorkoutAPI = {
  /** TS-008: Create or update a workout plan */
  createPlan: (plan: Omit<WorkoutPlan, 'id' | 'assignedAt'>, token: string) =>
    http<{ planId: string }>('/workout-plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    }, token),

  updatePlan: (planId: string, plan: Partial<WorkoutPlan>, token: string) =>
    http<void>(`/workout-plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    }, token),

  /** TS-008: Assign plan to member */
  assignPlan: (planId: string, memberId: string, token: string) =>
    http<void>(`/workout-plans/${planId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }, token),

  /** TS-008: Get plans for a member */
  getMemberPlans: (trainerId: string, memberId: string, token: string) =>
    http<WorkoutPlan[]>(`/trainers/${trainerId}/clients/${memberId}/plans`, { method: 'GET' }, token),

  /** TS-009: Get workout logs */
  getWorkoutLogs: (
    trainerId: string,
    memberId: string,
    page: number,
    token: string,
  ) =>
    http<{ logs: WorkoutLog[]; total: number }>(
      `/trainers/${trainerId}/clients/${memberId}/workout-logs?page=${page}`,
      { method: 'GET' },
      token,
    ),

  /** TS-009: Add trainer note on a log */
  addNoteOnLog: (
    trainerId: string,
    memberId: string,
    logId: string,
    note: string,
    token: string,
  ) =>
    http<void>(
      `/trainers/${trainerId}/clients/${memberId}/workout-logs/${logId}/note`,
      { method: 'POST', body: JSON.stringify({ note }) },
      token,
    ),
};

// ─── Video Library (TS-010, TS-011) ─────────────────────────────────────────

export const VideoAPI = {
  /** TS-010: Get trainer's video library */
  getVideos: (trainerId: string, token: string) =>
    http<TrainerVideo[]>(`/trainers/${trainerId}/videos`, { method: 'GET' }, token),

  /** TS-010: Delete a video */
  deleteVideo: (videoId: string, token: string) =>
    http<void>(`/videos/${videoId}`, { method: 'DELETE' }, token),

  /** TS-011: Upload personalized video — returns uploadId for multipart */
  uploadVideo: (payload: VideoUploadPayload, token: string) =>
    http<{ videoId: string; uploadUrl: string }>('/videos/upload-personal', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        memberId: payload.memberId,
        expiresAt: payload.expiresAt,
      }),
    }, token),

  /** TS-011: Get watch status for a personal video */
  getWatchStatus: (videoId: string, token: string) =>
    http<{ memberId: string; watchedPercent: number; lastWatchedAt: string | null }>(
      `/videos/${videoId}/watch-status`,
      { method: 'GET' },
      token,
    ),
};

// ─── Live Classes (TS-012) ───────────────────────────────────────────────────

export const LiveClassAPI = {
  /** TS-012 AC2: Create a live class */
  createClass: (payload: CreateClassPayload, trainerId: string, gymId: string | null, token: string) =>
    http<{ classId: string }>(
      '/classes',
      { method: 'POST', body: JSON.stringify({ trainerId, gymId, ...payload }) },
      token,
    ),

  /** TS-012 AC4: Edit a class (allowed up to 2h before) */
  updateClass: (classId: string, payload: Partial<CreateClassPayload>, token: string) =>
    http<void>(`/classes/${classId}`, { method: 'PUT', body: JSON.stringify(payload) }, token),

  /** TS-012 AC4: Cancel a class */
  cancelClass: (classId: string, token: string) =>
    http<void>(`/classes/${classId}`, { method: 'DELETE' }, token),

  /** TS-012: Get Agora host token */
  getHostToken: (classId: string, token: string) =>
    http<{ agoraToken: string; channelName: string }>(`/classes/${classId}/host-token`, { method: 'GET' }, token),

  /** TS-012: Get attendees */
  getAttendees: (classId: string, token: string) =>
    http<ClassAttendee[]>(`/classes/${classId}/attendees`, { method: 'GET' }, token),

  /** TS-012 AC8: End class */
  endClass: (classId: string, token: string) =>
    http<{ attendeeCount: number; averageRating: number | null }>(
      `/classes/${classId}/end-class`,
      { method: 'POST' },
      token,
    ),

  /** TS-012 AC9: Get past classes */
  getPastClasses: (trainerId: string, page: number, token: string) =>
    http<{ classes: LiveClass[]; total: number }>(
      `/trainers/${trainerId}/classes?status=completed&page=${page}`,
      { method: 'GET' },
      token,
    ),

  /** TS-012: Get upcoming classes */
  getUpcomingClasses: (trainerId: string, token: string) =>
    http<LiveClass[]>(`/trainers/${trainerId}/classes?status=scheduled`, { method: 'GET' }, token),
};

// ─── Progress Monitoring (TS-013 to TS-015) ─────────────────────────────────

export const ProgressAPI = {
  /** TS-013: Get client weight & BMI history */
  getWeightHistory: (trainerId: string, memberId: string, token: string) =>
    http<WeightEntry[]>(
      `/trainers/${trainerId}/clients/${memberId}/weight-history`,
      { method: 'GET' },
      token,
    ),

  /** TS-013: Add chart annotation */
  addAnnotation: (
    trainerId: string,
    memberId: string,
    date: string,
    annotation: string,
    token: string,
  ) =>
    http<void>(
      `/trainers/${trainerId}/clients/${memberId}/weight-history/annotate`,
      { method: 'POST', body: JSON.stringify({ date, annotation }) },
      token,
    ),

  /** TS-014: Get body measurements */
  getMeasurements: (trainerId: string, memberId: string, token: string) =>
    http<BodyMeasurement[]>(
      `/trainers/${trainerId}/clients/${memberId}/measurements`,
      { method: 'GET' },
      token,
    ),

  /** TS-015: Get progress photos (shared only) */
  getProgressPhotos: (trainerId: string, memberId: string, token: string) =>
    http<ProgressPhoto[]>(
      `/trainers/${trainerId}/clients/${memberId}/progress-photos`,
      { method: 'GET' },
      token,
    ),

  /** TS-015: Request progress photo access */
  requestPhotoAccess: (trainerId: string, memberId: string, token: string) =>
    http<{ requestId: string; expiresAt: string }>(
      `/trainers/${trainerId}/clients/${memberId}/progress-photos/request-access`,
      { method: 'POST' },
      token,
    ),

  /** TS-015: Comment on a progress photo */
  commentOnPhoto: (
    trainerId: string,
    memberId: string,
    photoId: string,
    text: string,
    token: string,
  ) =>
    http<void>(
      `/trainers/${trainerId}/clients/${memberId}/progress-photos/${photoId}/comment`,
      { method: 'POST', body: JSON.stringify({ text }) },
      token,
    ),
};

// ─── Freelance (TS-016) ──────────────────────────────────────────────────────

export const FreelanceAPI = {
  /** TS-016 AC3: Create an invite */
  createInvite: (trainerId: string, payload: CreateInvitePayload, token: string) =>
    http<{ inviteCode: string; inviteLink: string; inviteId: string }>(
      `/trainers/${trainerId}/freelance/invite`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  /** TS-016 AC5: List all invites with status */
  getInvites: (trainerId: string, token: string) =>
    http<FreelanceInvite[]>(`/trainers/${trainerId}/freelance/invites`, { method: 'GET' }, token),

  /** TS-016 AC8: Manually add a freelance client */
  addManualClient: (trainerId: string, payload: ManualClientPayload, token: string) =>
    http<{ memberId: string }>(
      `/trainers/${trainerId}/freelance/add-manual`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  /** TS-016 AC9: Remove a freelance client */
  removeClient: (trainerId: string, memberId: string, token: string) =>
    http<void>(`/trainers/${trainerId}/freelance/${memberId}`, { method: 'DELETE' }, token),
};

// ─── Earnings (TS-017) ───────────────────────────────────────────────────────

export const EarningsAPI = {
  /** TS-017 AC2: Get earnings for a month */
  getEarnings: (trainerId: string, month: string, token: string) =>
    http<TrainerEarnings>(`/trainers/${trainerId}/earnings?month=${month}`, { method: 'GET' }, token),

  /** TS-017 AC4: Get fee dues */
  getFeeDues: (trainerId: string, token: string) =>
    http<FeeDue[]>(`/trainers/${trainerId}/earnings/dues`, { method: 'GET' }, token),

  /** TS-017 AC4: Send WhatsApp payment reminder */
  sendReminder: (trainerId: string, memberId: string, token: string) =>
    http<{ whatsappOpened: boolean }>(
      `/trainers/${trainerId}/earnings/dues/${memberId}/remind`,
      { method: 'POST' },
      token,
    ),

  /** TS-017 AC5: Get payment history */
  getPaymentHistory: (trainerId: string, page: number, token: string) =>
    http<{ payments: PaymentRecord[]; total: number }>(
      `/trainers/${trainerId}/earnings/payments?page=${page}`,
      { method: 'GET' },
      token,
    ),
};

// ─── Notifications (TS-018) ──────────────────────────────────────────────────

export const NotificationsAPI = {
  /** TS-018: Get notifications */
  getNotifications: (trainerId: string, page: number, token: string) =>
    http<{ notifications: TrainerNotification[]; total: number; unread: number }>(
      `/trainers/${trainerId}/notifications?page=${page}`,
      { method: 'GET' },
      token,
    ),

  /** TS-018: Mark all as read */
  markAllRead: (trainerId: string, token: string) =>
    http<void>(`/trainers/${trainerId}/notifications/read-all`, { method: 'POST' }, token),

  /** TS-018: Delete a notification */
  deleteNotification: (trainerId: string, notifId: string, token: string) =>
    http<void>(`/trainers/${trainerId}/notifications/${notifId}`, { method: 'DELETE' }, token),

  /** TS-018: Update notification preferences */
  updatePreferences: (
    trainerId: string,
    type: string,
    pushEnabled: boolean,
    whatsappEnabled: boolean,
    token: string,
  ) =>
    http<void>(
      `/trainers/${trainerId}/notification-preferences`,
      { method: 'PATCH', body: JSON.stringify({ type, pushEnabled, whatsappEnabled }) },
      token,
    ),
};

// ─── Profile (TS-019) ────────────────────────────────────────────────────────

export const ProfileAPI = {
  /** TS-019 AC1: Get profile */
  getProfile: (trainerId: string, token: string) =>
    http<TrainerProfile>(`/trainers/${trainerId}/profile`, { method: 'GET' }, token),

  /** TS-019 AC2: Update profile */
  updateProfile: (trainerId: string, data: Partial<TrainerProfile>, token: string) =>
    http<void>(
      `/trainers/${trainerId}/profile`,
      { method: 'PATCH', body: JSON.stringify(data) },
      token,
    ),

  /** TS-019 AC3: Upload profile photo (caller converts to FormData) */
  uploadProfilePhoto: (trainerId: string, formData: FormData, token: string) =>
    fetch(`${BASE_URL}/trainers/${trainerId}/profile-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.json()) as Promise<{ photoUrl: string }>,

  /** TS-019 AC4: Upload certification */
  uploadCertification: (trainerId: string, formData: FormData, token: string) =>
    fetch(`${BASE_URL}/trainers/${trainerId}/certifications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.json()) as Promise<{ certificationId: string }>,

  /** TS-019 AC6: Leave gym */
  leaveGym: (trainerId: string, token: string) =>
    http<void>(`/trainers/${trainerId}/leave-gym`, { method: 'POST' }, token),

  /** TS-019 AC8: Logout */
  logout: (fcmToken: string, token: string) =>
    http<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ fcmToken }) }, token),

  /** TS-019 AC9: Delete account */
  deleteAccount: (trainerId: string, otp: string, token: string) =>
    http<void>(
      `/trainers/${trainerId}/delete-account`,
      { method: 'POST', body: JSON.stringify({ otp }) },
      token,
    ),
};
