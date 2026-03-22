// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Mock API (Demo Mode)
// Identical function names to trainer.api.ts — swap one import line per screen
// No network calls needed — works fully offline for client demos
// ─────────────────────────────────────────────────────────────────────────────

import {
  DEMO_TRAINER_ID,
  demoTrainerProfile,
  demoDashboard,
  demoClients,
  demoClientProfiles,
  demoWorkoutLogs,
  demoVideos,
  demoUpcomingClasses,
  demoPastClasses,
  demoWeightHistory,
  demoMeasurements,
  demoProgressPhotos,
  demoFreelanceInvites,
  demoEarnings,
  demoFeeDues,
  demoPaymentHistory,
  demoNotifications,
} from './demoData';

// Small delay helper — makes the app feel real (skeleton loaders show briefly)
const delay = (ms = 600) => new Promise(res => setTimeout(res, ms));

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const AuthAPI = {
  validateToken: async () => {
    await delay(300);
    return { role: 'TRAINER', gymId: 'gym-001', isFreelance: true };
  },
  register: async () => {
    await delay(800);
    return { trainerId: DEMO_TRAINER_ID, otpSent: true };
  },
  requestOTP: async () => {
    await delay(600);
    return { otpSent: true };
  },
  verifyOTP: async () => {
    await delay(800);
    return {
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
      trainerId: DEMO_TRAINER_ID,
    };
  },
  linkGym: async () => {
    await delay(800);
    return { gymId: 'gym-001', gymName: 'FitZone Gym' };
  },
  setupFreelance: async () => {
    await delay(600);
    return { freelanceEnabled: true };
  },
  getInviteLink: async () => {
    await delay(400);
    return { inviteLink: 'https://lift.app/trainer/invite/ARUN2026' };
  },
  logout: async () => { await delay(300); },
  refreshToken: async () => {
    await delay(300);
    return { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' };
  },
  registerFCM: async () => { await delay(200); },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const DashboardAPI = {
  getDashboard: async () => {
    await delay(700);
    return { ...demoDashboard };
  },
};

// ─── Clients ──────────────────────────────────────────────────────────────────

export const ClientsAPI = {
  getClients: async (_trainerId: string, type: string) => {
    await delay(600);
    const filtered = type === 'all'
      ? demoClients
      : demoClients.filter(c => c.clientType === type);
    return { clients: filtered, total: filtered.length, page: 1 };
  },
  getClientProfile: async (_trainerId: string, memberId: string) => {
    await delay(500);
    const profile = demoClientProfiles[memberId];
    if (profile) return { ...profile };
    // Return a generic profile for demo clients without a dedicated profile
    const client = demoClients.find(c => c.id === memberId);
    return {
      id: memberId,
      fullName: client?.fullName ?? 'Demo Client',
      profilePhotoUrl: null,
      age: 28,
      gender: 'Male',
      phone: '9800000000',
      healthGoals: ['General Fitness', 'Build Strength'],
      membershipStatus: client?.membershipStatus ?? 'Active',
      currentPlanName: client?.assignedPlanName ?? null,
      planAssignedDate: '2026-01-01T00:00:00Z',
      latestWeight: 72,
      latestBMI: 23.0,
      lastWorkoutDate: client?.lastWorkoutDate ?? null,
      totalWorkoutsLogged: 18,
      currentStreak: client?.streak ?? 0,
      attendanceThisMonth: 16,
      clientType: client?.clientType ?? 'gym',
    };
  },
};

// ─── Workout Plans ────────────────────────────────────────────────────────────

export const WorkoutAPI = {
  createPlan: async (plan: any) => {
    await delay(800);
    return { planId: `plan-${Date.now()}` };
  },
  updatePlan: async () => { await delay(600); },
  assignPlan: async () => { await delay(500); },
  getMemberPlans: async () => {
    await delay(500);
    return [];
  },
  getWorkoutLogs: async (_trainerId: string, memberId: string) => {
    await delay(600);
    const logs = demoWorkoutLogs.filter(l => l.memberId === memberId);
    return { logs, total: logs.length };
  },
  addNoteOnLog: async () => { await delay(500); },
};

// ─── Video ────────────────────────────────────────────────────────────────────

export const VideoAPI = {
  getVideos: async () => {
    await delay(700);
    return [...demoVideos];
  },
  deleteVideo: async () => { await delay(500); },
  uploadVideo: async () => {
    await delay(1000);
    return { videoId: `vid-${Date.now()}`, uploadUrl: 'https://demo-upload.url' };
  },
  getWatchStatus: async (_videoId: string) => {
    await delay(300);
    return { memberId: 'member-001', watchedPercent: 100, lastWatchedAt: new Date().toISOString() };
  },
};

// ─── Live Classes ─────────────────────────────────────────────────────────────

export const LiveClassAPI = {
  createClass: async () => {
    await delay(700);
    return { classId: `class-${Date.now()}` };
  },
  updateClass: async () => { await delay(500); },
  cancelClass: async () => { await delay(500); },
  getHostToken: async () => {
    await delay(400);
    return { agoraToken: 'demo-agora-token', channelName: 'demo-channel' };
  },
  getAttendees: async () => {
    await delay(400);
    return [
      { memberId: 'member-001', memberName: 'Rahul Menon', memberPhotoUrl: null, hasRaisedHand: false, isMuted: true },
      { memberId: 'member-004', memberName: 'Anjali Thomas', memberPhotoUrl: null, hasRaisedHand: true, isMuted: false },
      { memberId: 'member-002', memberName: 'Priya Nair', memberPhotoUrl: null, hasRaisedHand: false, isMuted: true },
      { memberId: 'member-005', memberName: 'Sreejith Kumar', memberPhotoUrl: null, hasRaisedHand: false, isMuted: true },
    ];
  },
  endClass: async () => {
    await delay(600);
    return { attendeeCount: 12, averageRating: 4.7 };
  },
  getPastClasses: async () => {
    await delay(600);
    return { classes: [...demoPastClasses], total: demoPastClasses.length };
  },
  getUpcomingClasses: async () => {
    await delay(600);
    return [...demoUpcomingClasses];
  },
};

// ─── Progress ─────────────────────────────────────────────────────────────────

export const ProgressAPI = {
  getWeightHistory: async () => {
    await delay(600);
    return [...demoWeightHistory];
  },
  addAnnotation: async () => { await delay(500); },
  getMeasurements: async () => {
    await delay(600);
    return [...demoMeasurements];
  },
  getProgressPhotos: async () => {
    await delay(600);
    return [...demoProgressPhotos];
  },
  requestPhotoAccess: async () => {
    await delay(500);
    return {
      requestId: `req-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  },
  commentOnPhoto: async () => { await delay(500); },
};

// ─── Freelance ────────────────────────────────────────────────────────────────

export const FreelanceAPI = {
  createInvite: async (_trainerId: string, payload: any) => {
    await delay(700);
    const code = `ARUN${Date.now().toString().slice(-4)}`;
    return {
      inviteCode: code,
      inviteLink: `https://lift.app/trainer/invite/${code}`,
      inviteId: `invite-${Date.now()}`,
    };
  },
  getInvites: async () => {
    await delay(600);
    return [...demoFreelanceInvites];
  },
  addManualClient: async () => {
    await delay(700);
    return { memberId: `member-${Date.now()}` };
  },
  removeClient: async () => { await delay(500); },
};

// ─── Earnings ─────────────────────────────────────────────────────────────────

export const EarningsAPI = {
  getEarnings: async () => {
    await delay(700);
    return { ...demoEarnings };
  },
  getFeeDues: async () => {
    await delay(500);
    return [...demoFeeDues];
  },
  sendReminder: async () => {
    await delay(600);
    return { whatsappOpened: true };
  },
  getPaymentHistory: async () => {
    await delay(600);
    return { payments: [...demoPaymentHistory], total: demoPaymentHistory.length };
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const NotificationsAPI = {
  getNotifications: async () => {
    await delay(600);
    const unread = demoNotifications.filter(n => !n.isRead).length;
    return {
      notifications: [...demoNotifications],
      total: demoNotifications.length,
      unread,
    };
  },
  markAllRead: async () => { await delay(400); },
  deleteNotification: async () => { await delay(400); },
  updatePreferences: async () => { await delay(400); },
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const ProfileAPI = {
  getProfile: async () => {
    await delay(600);
    return { ...demoTrainerProfile };
  },
  updateProfile: async () => { await delay(700); },
  uploadProfilePhoto: async () => {
    await delay(800);
    return { photoUrl: '' };
  },
  uploadCertification: async () => {
    await delay(800);
    return { certificationId: `cert-${Date.now()}` };
  },
  leaveGym: async () => { await delay(600); },
  logout: async () => { await delay(300); },
  deleteAccount: async () => { await delay(800); },
};
