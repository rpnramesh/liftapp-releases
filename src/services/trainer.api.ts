// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Firebase API Service
// Fix: strip undefined values before all Firestore writes
// ─────────────────────────────────────────────────────────────────────────────
import { signOut } from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc, getDoc, getDocs,
    orderBy,
    query,
    setDoc, updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
    BodyMeasurement, ClassAttendee, ClientCard, ClientProfile,
    CreateClassPayload, CreateInvitePayload, FeeDue, FreelanceInvite,
    LiveClass, ManualClientPayload,
    MembershipStatus,
    PaymentRecord, ProgressPhoto,
    TrainerDashboard, TrainerEarnings, TrainerNotification, TrainerProfile,
    TrainerRegistrationPayload, TrainerVideo, VideoUploadPayload,
    WeightEntry, WorkoutLog, WorkoutPlan,
} from '../types/trainer.types';

const ts = () => Date.now();
const uid = () => auth.currentUser?.uid ?? '';

// ─── CRITICAL: Strip undefined before every Firestore write ──────────────────
// setDoc/updateDoc throw if any value is undefined — use this on every write
function clean(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(clean).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) result[k] = clean(v);
    }
    return result;
  }
  return obj;
}

const getMemberGymId = async (memberId: string): Promise<string> => {
  try {
    const snap = await getDoc(doc(db, 'members', memberId));
    return snap.data()?.gymId ?? memberId;
  } catch { return memberId; }
};


// ── Effective gym namespace ───────────────────────────────────────────────────
// For gym members: gymId (e.g. "abc123")
// For freelance members: trainerId (used as namespace)
// Always returns a non-null string safe to use as Firestore path segment
const getEffectiveGymId = async (trainerId: string, memberId?: string): Promise<string> => {
  // Check trainer's gymId first
  const trainerGymId = await getTrainerGymId(trainerId);
  if (trainerGymId && trainerGymId !== trainerId) return trainerGymId;
  // If trainer is freelance, check member's gymId
  if (memberId) {
    const memberGymId = await getMemberGymId(memberId);
    if (memberGymId && memberGymId !== memberId) return memberGymId;
  }
  // Both freelance → use trainerId as namespace
  return trainerId;
};

const getTrainerGymId = async (trainerId: string): Promise<string> => {
  try {
    const snap = await getDoc(doc(db, 'trainers', trainerId));
    return snap.data()?.gymId ?? trainerId;
  } catch { return trainerId; }
};

const membershipStatus = (planEndDate: number): MembershipStatus => {
  const daysLeft = Math.floor((planEndDate - ts()) / 86400000);
  if (daysLeft < 0) return 'Expired';
  if (daysLeft <= 7) return 'Expiring';
  return 'Active';
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const AuthAPI = {
  validateToken: async (..._a: any[]) => {
    const u = auth.currentUser;
    if (!u) throw new Error('Not authenticated');
    const snap = await getDoc(doc(db, 'trainers', u.uid));
    if (!snap.exists()) throw new Error('Trainer not found');
    const data = snap.data();
    return { role: data.adminAccess ? 'admin' : 'trainer', gymId: data.gymId ?? null, isFreelance: data.isFreelance ?? false };
  },
  register: async (payload: TrainerRegistrationPayload, ..._a: any[]) => {
    const u = auth.currentUser;
    if (!u) throw new Error('Not authenticated');
    await setDoc(doc(db, 'trainers', u.uid), clean({
      id: u.uid, phone: u.phoneNumber ?? payload.phone,
      fullName: payload.fullName, name: payload.fullName,
      age: payload.age, gender: payload.gender,
      specializations: payload.specializations ?? [],
      yearsOfExperience: payload.yearsOfExperience ?? 0,
      bio: payload.bio ?? '', profilePhotoUrl: null, gymId: null,
      isFreelance: false, adminAccess: false, isLifeVerified: false,
      acceptingNewClients: true, certifications: [], active: true, createdAt: ts(),
    }));
    return { trainerId: u.uid, otpSent: false };
  },
  requestOTP: async (..._a: any[]) => ({ otpSent: true }),
  verifyOTP: async (..._a: any[]) => ({
    accessToken: await auth.currentUser?.getIdToken() ?? '',
    refreshToken: '', trainerId: uid(),
  }),
  linkGym: async (trainerId: string, code: string, ..._a: any[]) => {
    const q = query(collection(db, 'gyms'), where('inviteCode', '==', code));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Invalid gym invite code');
    const gym = snap.docs[0];
    await updateDoc(doc(db, 'trainers', trainerId), clean({ gymId: gym.id, gymName: gym.data().name, isFreelance: false }));
    return { gymId: gym.id, gymName: gym.data().name };
  },
  setupFreelance: async (trainerId: string, fee: number, ..._a: any[]) => {
    await updateDoc(doc(db, 'trainers', trainerId), clean({ isFreelance: true, gymId: null, freelanceMonthlyFee: fee }));
    return { freelanceEnabled: true };
  },
  getInviteLink: async (trainerId: string, ..._a: any[]) => {
    const snap = await getDoc(doc(db, 'trainers', trainerId));
    const code = snap.data()?.inviteCode ?? trainerId.slice(0, 8).toUpperCase();
    return { inviteLink: `https://lift.app/join/${code}` };
  },
  logout: async (..._a: any[]) => {
    const id = uid();
    if (id) await updateDoc(doc(db, 'trainers', id), { fcmToken: null }).catch(() => {});
    await signOut(auth);
  },
  refreshToken: async (..._a: any[]) => ({
    accessToken: await auth.currentUser?.getIdToken(true) ?? '', refreshToken: '',
  }),
  registerFCM: async (fcmToken: string, ..._a: any[]) => {
    const id = uid();
    if (id) await updateDoc(doc(db, 'trainers', id), { fcmToken }).catch(() => {});
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const DashboardAPI = {
  getDashboard: async (trainerId: string, ..._a: any[]): Promise<TrainerDashboard> => {
    if (!trainerId) return {
      todaySchedule: [], recentActivity: [],
      pendingActions: { clientsWithoutPlan: 0, missedWorkouts: 0, feeDue: 0 },
      quickStats: { totalActiveClients: 0, sessionsThisWeek: 0, unreadLogs: 0 },
      earningsSummary: { thisMonthTotal: 0, gymSalary: 0, freelanceFees: 0 },
    };
    const membersQ = query(collection(db, 'members'), where('trainerId', '==', trainerId), where('active', '==', true));
    const membersSnap = await getDocs(membersQ);
    const members = membersSnap.docs.map(d => d.data());
    const expired = members.filter(m => m.planEndDate < ts()).length;
    const withoutPlan = members.filter(m => !m.currentPlanId).length;
    const gymId = await getTrainerGymId(trainerId);
    const logsSnap = await getDocs(collection(db, 'gyms', gymId, 'workoutLogs')).catch(() => ({ docs: [] as any[] }));
    const recentLogs = logsSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .sort((a: any, b: any) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 10);
    return {
      todaySchedule: [],
      recentActivity: recentLogs.map((l: any) => {
        const member = members.find(m => m.id === l.memberId);
        const secsAgo = Math.floor((ts() - (l.completedAt ?? ts())) / 1000);
        const timeAgo = secsAgo < 3600 ? `${Math.floor(secsAgo / 60)}m ago`
          : secsAgo < 86400 ? `${Math.floor(secsAgo / 3600)}h ago`
          : `${Math.floor(secsAgo / 86400)}d ago`;
        return { clientId: l.memberId, clientName: member?.name ?? 'Member', clientPhotoUrl: null, workoutName: l.workoutName ?? '', status: 'completed' as const, timeAgo, logId: l.id ?? '' };
      }),
      pendingActions: { clientsWithoutPlan: withoutPlan, missedWorkouts: 0, feeDue: expired },
      quickStats: { totalActiveClients: membersSnap.size, sessionsThisWeek: recentLogs.length, unreadLogs: 0 },
      earningsSummary: { thisMonthTotal: 0, gymSalary: 0, freelanceFees: 0 },
    };
  },
};

// ─── Clients ──────────────────────────────────────────────────────────────────
export const ClientsAPI = {
  getClients: async (trainerId: string, type: 'gym' | 'freelance' | 'all', ..._a: any[]) => {
    if (!trainerId) return { clients: [], total: 0, page: 1 };
    const q = query(collection(db, 'members'), where('trainerId', '==', trainerId), where('active', '==', true));
    const snap = await getDocs(q);
    let results = snap.docs.map(d => d.data());
    const isFreelanceClient = (m: any) => !!m.isFreelance || !m.gymId;
    if (type === 'freelance') results = results.filter(isFreelanceClient);
    else if (type === 'gym') results = results.filter(m => !isFreelanceClient(m));
    const clients: ClientCard[] = results.map(m => ({
      id: m.id, fullName: m.name ?? m.fullName ?? '',
      profilePhotoUrl: m.photoUrl ?? null,
      membershipStatus: membershipStatus(m.planEndDate ?? 0),
      lastWorkoutDate: m.lastWorkoutAt ? new Date(m.lastWorkoutAt).toISOString() : null,
      assignedPlanName: m.currentPlanName ?? null,
      streak: m.streak ?? 0, hasRiskFlag: (m.planEndDate ?? 0) < ts(),
      clientType: ((m.isFreelance || !m.gymId) ? 'freelance' : 'gym') as 'gym' | 'freelance',
    }));
    return { clients, total: clients.length, page: 1 };
  },
  getClientProfile: async (trainerId: string, memberId: string, ..._a: any[]): Promise<ClientProfile> => {
    const snap = await getDoc(doc(db, 'members', memberId));
    if (!snap.exists()) throw new Error('Member not found');
    const m = snap.data();
    const gymId = m.gymId ?? memberId;
    const logsSnap = await getDocs(query(collection(db, 'gyms', gymId, 'workoutLogs'), where('memberId', '==', memberId))).catch(() => ({ docs: [] as any[] }));
    const bmi = m.height > 0 ? parseFloat((m.weight / ((m.height / 100) ** 2)).toFixed(1)) : null;
    return {
      id: memberId, fullName: m.name ?? m.fullName ?? '',
      profilePhotoUrl: m.photoUrl ?? null, age: m.age ?? 0, gender: m.gender ?? '',
      phone: m.phone ?? '', healthGoals: m.healthGoals ?? [],
      membershipStatus: membershipStatus(m.planEndDate ?? 0),
      currentPlanName: m.currentPlanName ?? null,
      planAssignedDate: m.planAssignedAt ? new Date(m.planAssignedAt).toISOString() : null,
      latestWeight: m.weight ?? null, latestBMI: bmi,
      lastWorkoutDate: m.lastWorkoutAt ? new Date(m.lastWorkoutAt).toISOString() : null,
      totalWorkoutsLogged: logsSnap.docs.length, currentStreak: m.streak ?? 0,
      attendanceThisMonth: 0,
      clientType: ((m.isFreelance || !m.gymId) ? 'freelance' : 'gym') as 'gym' | 'freelance',
    };
  },
};

// ─── Workout Plans ────────────────────────────────────────────────────────────
export const WorkoutAPI = {
  createPlan: async (plan: Omit<WorkoutPlan, 'id' | 'assignedAt'>, ..._a: any[]) => {
    const trainerId = uid();
    const gymId = await getTrainerGymId(trainerId);
    const ref = doc(collection(db, 'gyms', gymId, 'workouts'));
    // clean() strips all undefined fields before writing
    await setDoc(ref, clean({ ...plan, id: ref.id, gymId, trainerId, createdAt: ts(), updatedAt: ts() }));
    return { planId: ref.id };
  },
  updatePlan: async (planId: string, plan: Partial<WorkoutPlan>, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(uid());
    await updateDoc(doc(db, 'gyms', gymId, 'workouts', planId), clean({ ...plan, updatedAt: ts() }));
  },
  assignPlan: async (planId: string, memberId: string, ..._a: any[]) => {
    const trainerId = uid();
    if (!trainerId) throw new Error('Not logged in');
    const gymId = await getEffectiveGymId(trainerId, memberId);
    const workoutSnap = await getDoc(doc(db, 'gyms', gymId, 'workouts', planId)).catch(() => null);
    const workout = workoutSnap?.data() ?? {};
    // Use clean() to remove any undefined values from the workout data
    await setDoc(doc(db, 'gyms', gymId, 'assignments', memberId), clean({
      id: memberId, gymId, memberId, trainerId,
      weekPlan: workout.weekPlan ?? [],
      todayWorkoutId: planId,
      workoutName: workout.name ?? '',
      assignedAt: ts(), updatedAt: ts(),
    }));
    await updateDoc(doc(db, 'members', memberId), clean({
      currentPlanId: planId,
      currentPlanName: workout.name ?? '',
      planAssignedAt: ts(),
    })).catch(() => {});
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, clean({
      id: notifRef.id, recipientId: memberId, type: 'workout_assigned',
      title: 'New workout assigned',
      body: `${workout.name ?? 'A workout'} is ready for today`,
      isRead: false, read: false, createdAt: ts(),
    }));
  },
  getMemberPlans: async (trainerId: string, memberId: string, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(trainerId || uid(), memberId);
    const snap = await getDocs(query(collection(db, 'gyms', gymId, 'workouts'), where('trainerId', '==', trainerId)));
    return snap.docs.map(d => d.data() as WorkoutPlan);
  },
  getWorkoutLogs: async (trainerId: string, memberId: string, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(trainerId || uid(), memberId);
    const snap = await getDocs(query(collection(db, 'gyms', gymId, 'workoutLogs'), where('memberId', '==', memberId), orderBy('completedAt', 'desc'))).catch(() => ({ docs: [] as any[] }));
    const logs = snap.docs.map(d => ({ id: d.id, ...(d.data() as WorkoutLog) }));
    return { logs, total: logs.length };
  },
  addNoteOnLog: async (trainerId: string, memberId: string, logId: string, note: string, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(trainerId || uid(), memberId);
    await updateDoc(doc(db, 'gyms', gymId, 'workoutLogs', logId), { trainerNote: note, noteAddedAt: ts() });
  },
};

// ─── Video Library ────────────────────────────────────────────────────────────
export const VideoAPI = {
  getVideos: async (trainerId: string, ..._a: any[]): Promise<TrainerVideo[]> => {
    if (!trainerId) return [];
    const gymId = await getTrainerGymId(trainerId);
    const snap = await getDocs(query(collection(db, 'gyms', gymId, 'videos'), where('trainerId', '==', trainerId)));
    return snap.docs.map(d => {
      const v = d.data();
      return { id: d.id, title: v.title ?? '', description: v.description ?? '', category: v.category ?? 'General', thumbnailUrl: v.thumbUrl ?? '', videoUrl: v.videoUrl ?? '', durationSeconds: v.durationSeconds ?? 0, uploadedAt: new Date(v.createdAt ?? ts()).toISOString(), isPersonalized: !!v.memberId, assignedMemberId: v.memberId ?? undefined, watchStatus: 'not_watched' as const };
    });
  },
  deleteVideo: async (videoId: string, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(uid());
    await deleteDoc(doc(db, 'gyms', gymId, 'videos', videoId));
  },
  uploadVideo: async (payload: VideoUploadPayload, ..._a: any[]) => {
    const trainerId = uid();
    const gymId = await getTrainerGymId(trainerId);
    const ref = doc(collection(db, 'gyms', gymId, 'videos'));
    await setDoc(ref, clean({ id: ref.id, gymId, trainerId, title: payload.title, description: payload.description ?? '', category: payload.category ?? 'General', memberId: payload.memberId ?? null, expiresAt: payload.expiresAt ?? null, videoUrl: payload.videoUri, thumbUrl: '', durationSeconds: 0, createdAt: ts() }));
    return { videoId: ref.id, uploadUrl: '' };
  },
  getWatchStatus: async (..._a: any[]) => ({ memberId: '', watchedPercent: 0, lastWatchedAt: null }),
};

// ─── Live Classes ─────────────────────────────────────────────────────────────
export const LiveClassAPI = {
  createClass: async (payload: CreateClassPayload, trainerId: string, gymId: string | null, ..._a: any[]) => {
    const gid = gymId ?? trainerId;
    const ref = doc(collection(db, 'gyms', gid, 'classes'));
    await setDoc(ref, clean({ id: ref.id, gymId: gid, trainerId, ...payload, status: 'Scheduled', rsvpCount: 0, createdAt: ts() }));
    return { classId: ref.id };
  },
  updateClass: async (classId: string, payload: Partial<CreateClassPayload>, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(uid());
    await updateDoc(doc(db, 'gyms', gymId, 'classes', classId), clean(payload));
  },
  cancelClass: async (classId: string, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(uid());
    await updateDoc(doc(db, 'gyms', gymId, 'classes', classId), { status: 'Cancelled' });
  },
  getHostToken: async (_classId: string, ..._a: any[]) => ({ agoraToken: '', channelName: _classId }),
  getAttendees: async (classId: string, ..._a: any[]): Promise<ClassAttendee[]> => {
    const gymId = await getEffectiveGymId(uid());
    const snap = await getDocs(collection(db, 'gyms', gymId, 'classes', classId, 'attendees'));
    return snap.docs.map(d => d.data() as ClassAttendee);
  },
  endClass: async (classId: string, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(uid());
    await updateDoc(doc(db, 'gyms', gymId, 'classes', classId), { status: 'Completed', endedAt: ts() });
    return { attendeeCount: 0, averageRating: null };
  },
  getPastClasses: async (trainerId: string, ..._a: any[]) => {
    if (!trainerId) return { classes: [], total: 0 };
    const gymId = await getTrainerGymId(trainerId);
    const snap = await getDocs(query(collection(db, 'gyms', gymId, 'classes'), where('trainerId', '==', trainerId), where('status', '==', 'Completed')));
    const classes = snap.docs.map(d => d.data() as LiveClass).sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return { classes, total: classes.length };
  },
  getUpcomingClasses: async (trainerId: string, ..._a: any[]) => {
    if (!trainerId) return [];
    const gymId = await getTrainerGymId(trainerId);
    const snap = await getDocs(query(collection(db, 'gyms', gymId, 'classes'), where('trainerId', '==', trainerId), where('status', '==', 'Scheduled')));
    return snap.docs.map(d => d.data() as LiveClass);
  },
};

// ─── Progress ─────────────────────────────────────────────────────────────────
export const ProgressAPI = {
  getWeightHistory: async (_t: string, memberId: string, ..._a: any[]): Promise<WeightEntry[]> => {
    const gymId = await getEffectiveGymId(_t || uid(), memberId);
    const snap = await getDocs(query(collection(db, 'gyms', gymId, 'weightLogs'), where('memberId', '==', memberId)));
    return snap.docs.map(d => {
      const w = d.data();
      const h = w.height ?? 170;
      return { date: new Date(w.loggedAt).toISOString().split('T')[0], weightKg: w.weight, bmi: parseFloat((w.weight / ((h / 100) ** 2)).toFixed(1)) };
    }).sort((a, b) => a.date.localeCompare(b.date));
  },
  addAnnotation: async (trainerId: string, memberId: string, date: string, annotation: string, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(trainerId || uid(), memberId);
    const ref = doc(collection(db, 'gyms', gymId, 'weightAnnotations'));
    await setDoc(ref, clean({ memberId, trainerId, date, annotation, createdAt: ts() }));
  },
  getMeasurements: async (_t: string, memberId: string, ..._a: any[]): Promise<BodyMeasurement[]> => {
    const gymId = await getEffectiveGymId(_t || uid(), memberId);
    const snap = await getDocs(query(collection(db, 'gyms', gymId, 'measurements'), where('memberId', '==', memberId)));
    return snap.docs.map(d => {
      const m = d.data();
      return { date: new Date(m.loggedAt).toISOString().split('T')[0], chestCm: m.type === 'Chest' ? m.value : undefined, waistCm: m.type === 'Waist' ? m.value : undefined, hipsCm: m.type === 'Hips' ? m.value : undefined, armsLeftCm: m.type === 'Bicep' ? m.value : undefined, thighsLeftCm: m.type === 'Thigh' ? m.value : undefined };
    });
  },
  getProgressPhotos: async (_t: string, memberId: string, ..._a: any[]): Promise<ProgressPhoto[]> => {
    const gymId = await getEffectiveGymId(_t || uid(), memberId);
    const snap = await getDocs(query(collection(db, 'gyms', gymId, 'progressPhotos'), where('memberId', '==', memberId), where('sharedWithTrainer', '==', true))).catch(() => ({ docs: [] as any[] }));
    return snap.docs.map(d => { const p = d.data(); return { id: d.id, date: new Date(p.takenAt).toISOString().split('T')[0], photoUrl: p.photoUrl ?? '', isSharedWithTrainer: true }; });
  },
  requestPhotoAccess: async (_t: string, memberId: string, ..._a: any[]) => {
    const ref = doc(collection(db, 'photoAccessRequests'));
    await setDoc(ref, clean({ trainerId: _t, memberId, requestedAt: ts(), status: 'pending' }));
    return { requestId: ref.id, expiresAt: new Date(ts() + 86400000).toISOString() };
  },
  commentOnPhoto: async (_t: string, memberId: string, photoId: string, text: string, ..._a: any[]) => {
    const gymId = await getEffectiveGymId(_t || uid(), memberId);
    const ref = doc(collection(db, 'gyms', gymId, 'progressPhotos', photoId, 'comments'));
    await setDoc(ref, clean({ trainerId: _t, text, createdAt: ts() }));
  },
};

// ─── Freelance ────────────────────────────────────────────────────────────────
export const FreelanceAPI = {
  createInvite: async (trainerId: string, payload: CreateInvitePayload, ..._a: any[]) => {
    const code = `${trainerId.slice(0, 6)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const ref = doc(collection(db, 'freelanceInvites'));
    const startDate = payload.startDate ?? new Date().toISOString().split('T')[0];
    const expiresAt = new Date(ts() + 7 * 86400000).toISOString();
    await setDoc(ref, clean({ id: ref.id, trainerId, monthlyFee: payload.monthlyFee, inviteCode: code, inviteLink: `https://lift.app/join/${code}`, startDate, expiresAt, status: 'Pending', createdAt: new Date().toISOString() }));
    await updateDoc(doc(db, 'trainers', trainerId), { inviteCode: code }).catch(() => {});
    return { inviteCode: code, inviteLink: `https://lift.app/join/${code}`, inviteId: ref.id };
  },
  getInvites: async (trainerId: string, ..._a: any[]): Promise<FreelanceInvite[]> => {
    if (!trainerId) return [];
    const snap = await getDocs(query(collection(db, 'freelanceInvites'), where('trainerId', '==', trainerId)));
    return snap.docs.map(d => d.data() as FreelanceInvite).sort((a: any, b: any) => (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1);
  },
  addManualClient: async (trainerId: string, payload: ManualClientPayload, ..._a: any[]) => {
    const ref = doc(collection(db, 'members'));
    await setDoc(ref, clean({
      id: ref.id, trainerId, gymId: null, isFreelance: true,
      name: payload.name, fullName: payload.name,
      phone: payload.phone.startsWith('+91') ? payload.phone : `+91${payload.phone}`,
      plan: payload.planName, planName: payload.planName,
      monthlyFee: payload.monthlyFee, paymentType: payload.paymentType,
      planStartDate: ts(), planEndDate: ts() + 30 * 86400000,
      height: 0, weight: 0, goalWeight: 0,
      active: true, createdAt: ts(),
    }));
    return { memberId: ref.id };
  },
  removeClient: async (trainerId: string, memberId: string, ..._a: any[]) => {
    await updateDoc(doc(db, 'members', memberId), { active: false, removedAt: ts() });
  },
};

// ─── Earnings ─────────────────────────────────────────────────────────────────
export const EarningsAPI = {
  getEarnings: async (trainerId: string, month: string, ..._a: any[]): Promise<TrainerEarnings> => {
    if (!trainerId) return { month, totalReceived: 0, pendingPayouts: 0, thisYearTotal: 0, gymSalary: 0, freelanceFees: 0, sessionBonuses: 0, monthlyTrend: [] };
    const snap = await getDocs(query(collection(db, 'payments'), where('trainerId', '==', trainerId), where('month', '==', month)));
    const payments = snap.docs.map(d => d.data());
    const freelanceFees = payments.filter(p => p.type === 'freelance').reduce((s, p) => s + (p.amount ?? 0), 0);
    const gymSalary = payments.filter(p => p.type === 'gym').reduce((s, p) => s + (p.amount ?? 0), 0);
    return { month, totalReceived: freelanceFees + gymSalary, pendingPayouts: 0, thisYearTotal: 0, gymSalary, freelanceFees, sessionBonuses: 0, monthlyTrend: [] };
  },
  getFeeDues: async (trainerId: string, ..._a: any[]): Promise<FeeDue[]> => {
    if (!trainerId) return [];
    const snap = await getDocs(query(collection(db, 'members'), where('trainerId', '==', trainerId), where('active', '==', true)));
    return snap.docs.map(d => d.data()).filter(m => (m.planEndDate ?? 0) < ts())
      .map(m => ({ clientId: m.id, clientName: m.name ?? m.fullName ?? '', clientPhone: m.phone ?? '', amountDue: m.monthlyFee ?? 0, daysOverdue: Math.floor((ts() - (m.planEndDate ?? 0)) / 86400000), paymentLink: `https://lift.app/pay/${m.id}` }));
  },
  sendReminder: async (trainerId: string, memberId: string, ..._a: any[]) => {
    const ref = doc(collection(db, 'reminders'));
    await setDoc(ref, clean({ trainerId, memberId, sentAt: ts(), type: 'whatsapp' }));
    return { whatsappOpened: true };
  },
  getPaymentHistory: async (trainerId: string, ..._a: any[]) => {
    if (!trainerId) return { payments: [], total: 0 };
    const snap = await getDocs(query(collection(db, 'payments'), where('trainerId', '==', trainerId)));
    const payments = snap.docs.map(d => d.data() as PaymentRecord).sort((a: any, b: any) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
    return { payments, total: payments.length };
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const NotificationsAPI = {
  getNotifications: async (trainerId: string, ..._a: any[]) => {
    if (!trainerId) return { notifications: [], total: 0, unread: 0 };
    const snap = await getDocs(query(collection(db, 'notifications'), where('recipientId', '==', trainerId)));
    const notifications: TrainerNotification[] = snap.docs.map(d => {
      const n = d.data();
      return { id: d.id, type: n.type ?? 'system', title: n.title ?? '', body: n.body ?? '', isRead: n.isRead ?? n.read ?? false, deeplink: n.deeplink ?? undefined, createdAt: new Date(n.createdAt ?? ts()).toISOString() };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const unread = notifications.filter(n => !n.isRead).length;
    return { notifications, total: notifications.length, unread };
  },
  markAllRead: async (trainerId: string, ..._a: any[]) => {
    if (!trainerId) return;
    const snap = await getDocs(query(collection(db, 'notifications'), where('recipientId', '==', trainerId), where('isRead', '==', false)));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { isRead: true, read: true }));
    await batch.commit();
  },
  deleteNotification: async (_t: string, notifId: string, ..._a: any[]) => {
    await deleteDoc(doc(db, 'notifications', notifId));
  },
  updatePreferences: async (trainerId: string, type: string, pushEnabled: boolean, whatsappEnabled: boolean, ..._a: any[]) => {
    await updateDoc(doc(db, 'trainers', trainerId), { [`notifPrefs.${type}`]: { pushEnabled, whatsappEnabled } });
  },
};

// ─── Profile ──────────────────────────────────────────────────────────────────
export const ProfileAPI = {
  getProfile: async (trainerId: string, ..._a: any[]): Promise<TrainerProfile> => {
    const snap = await getDoc(doc(db, 'trainers', trainerId));
    if (!snap.exists()) throw new Error('Trainer not found');
    const d = snap.data();
    return {
      id: trainerId,
      fullName: d.fullName ?? d.name ?? '',
      phone: d.phone ?? '',
      age: d.age ?? 0, gender: d.gender ?? '',
      profilePhotoUrl: d.profilePhotoUrl ?? null,
      specializations: d.specializations ?? [],
      yearsOfExperience: d.yearsOfExperience ?? 0,
      bio: d.bio ?? '', isLifeVerified: d.isLifeVerified ?? false,
      gymId: d.gymId ?? null, gymName: d.gymName ?? undefined,
      isFreelance: d.isFreelance ?? false,
      freelanceMonthlyFee: d.freelanceMonthlyFee ?? undefined,
      acceptingNewClients: d.acceptingNewClients ?? true,
      certifications: d.certifications ?? [],
    };
  },
  updateProfile: async (trainerId: string, data: Partial<TrainerProfile>, ..._a: any[]) => {
    await updateDoc(doc(db, 'trainers', trainerId), clean({ ...data, updatedAt: ts() }));
  },
  uploadProfilePhoto: async (..._a: any[]) => ({ photoUrl: '' }),
  uploadCertification: async (..._a: any[]) => ({ certificationId: '' }),
  leaveGym: async (trainerId: string, ..._a: any[]) => {
    await updateDoc(doc(db, 'trainers', trainerId), clean({ gymId: null, gymName: null, leftGymAt: ts() }));
  },
  logout: async (..._a: any[]) => {
    const id = uid();
    if (id) await updateDoc(doc(db, 'trainers', id), { fcmToken: null }).catch(() => {});
    await signOut(auth);
  },
  deleteAccount: async (trainerId: string, ..._a: any[]) => {
    await updateDoc(doc(db, 'trainers', trainerId), { active: false, deletedAt: ts() });
    await signOut(auth);
  },
};

// ─── Plan API ─────────────────────────────────────────────────────────────────
export const PlanAPI = {
  createPlan: async (plan: Omit<WorkoutPlan, 'id' | 'assignedAt'>, ..._a: any[]) => WorkoutAPI.createPlan(plan),
  assignPlan: async (planId: string, memberId: string, ..._a: any[]) => WorkoutAPI.assignPlan(planId, memberId),
};
