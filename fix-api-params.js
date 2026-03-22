// fix-api-params.js
// Run from trainer app root: node fix-api-params.js
// Rewrites all API function signatures to accept rest params
// so screens can pass any number of args without TS errors

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'trainer.api.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Strategy: replace all async function param lists in API objects
// with rest params, keeping the internal variable extractions

const replacements = [
  // validateToken
  [/validateToken: async \(_token\?: string\)/g, 'validateToken: async (..._a: any[])'],
  // register
  [/register: async \(payload: TrainerRegistrationPayload, _token\?: string\)/g, 'register: async (payload: TrainerRegistrationPayload, ..._a: any[])'],
  // requestOTP
  [/requestOTP: async \(_phone\?: string\)/g, 'requestOTP: async (..._a: any[])'],
  // verifyOTP
  [/verifyOTP: async \(_phone\?: string, _otp\?: string\)/g, 'verifyOTP: async (..._a: any[])'],
  // linkGym
  [/linkGym: async \(trainerId: string, code: string, _token\?: string\)/g, 'linkGym: async (trainerId: string, code: string, ..._a: any[])'],
  // setupFreelance
  [/setupFreelance: async \(trainerId: string, fee: number, _token\?: string\)/g, 'setupFreelance: async (trainerId: string, fee: number, ..._a: any[])'],
  // getInviteLink
  [/getInviteLink: async \(trainerId: string, _token\?: string\)/g, 'getInviteLink: async (trainerId: string, ..._a: any[])'],
  // logout AuthAPI
  [/logout: async \(_trainerId\?: string, _fcmToken\?: string, _token\?: string\)/g, 'logout: async (..._a: any[])'],
  // refreshToken
  [/refreshToken: async \(_refreshToken\?: string\)/g, 'refreshToken: async (..._a: any[])'],
  // registerFCM
  [/registerFCM: async \(fcmToken: string, _token\?: string\)/g, 'registerFCM: async (fcmToken: string, ..._a: any[])'],
  // getDashboard
  [/getDashboard: async \(trainerId: string, _token\?: string\)/g, 'getDashboard: async (trainerId: string, ..._a: any[])'],
  // getClients
  [/getClients: async \(\s*trainerId: string,\s*type: 'gym' \| 'freelance' \| 'all',\s*_page = 1,\s*_token\?: string,\s*\)/g, 'getClients: async (trainerId: string, type: \'gym\' | \'freelance\' | \'all\', ..._a: any[])'],
  // getClientProfile
  [/getClientProfile: async \(\s*trainerId: string,\s*memberId: string,\s*_token\?: string,\s*\)/g, 'getClientProfile: async (trainerId: string, memberId: string, ..._a: any[])'],
  // createPlan WorkoutAPI
  [/createPlan: async \(\s*plan: Omit<WorkoutPlan, 'id' \| 'assignedAt'>,\s*_token\?: string,\s*\)/g, "createPlan: async (plan: Omit<WorkoutPlan, 'id' | 'assignedAt'>, ..._a: any[])"],
  // updatePlan
  [/updatePlan: async \(planId: string, plan: Partial<WorkoutPlan>, _token\?: string\)/g, 'updatePlan: async (planId: string, plan: Partial<WorkoutPlan>, ..._a: any[])'],
  // assignPlan
  [/assignPlan: async \(planId: string, memberId: string, _token\?: string\)/g, 'assignPlan: async (planId: string, memberId: string, ..._a: any[])'],
  // getMemberPlans
  [/getMemberPlans: async \(trainerId: string, memberId: string, _token\?: string\)/g, 'getMemberPlans: async (trainerId: string, memberId: string, ..._a: any[])'],
  // getWorkoutLogs
  [/getWorkoutLogs: async \(\s*trainerId: string,\s*memberId: string,\s*_page = 1,\s*_token\?: string,\s*\)/g, 'getWorkoutLogs: async (trainerId: string, memberId: string, ..._a: any[])'],
  // addNoteOnLog
  [/addNoteOnLog: async \(\s*trainerId: string,\s*memberId: string,\s*logId: string,\s*note: string,\s*_token\?: string,\s*\)/g, 'addNoteOnLog: async (trainerId: string, memberId: string, logId: string, note: string, ..._a: any[])'],
  // getVideos
  [/getVideos: async \(trainerId: string, _token\?: string\)/g, 'getVideos: async (trainerId: string, ..._a: any[])'],
  // deleteVideo
  [/deleteVideo: async \(videoId: string, _token\?: string\)/g, 'deleteVideo: async (videoId: string, ..._a: any[])'],
  // uploadVideo
  [/uploadVideo: async \(payload: VideoUploadPayload, _token\?: string\)/g, 'uploadVideo: async (payload: VideoUploadPayload, ..._a: any[])'],
  // getWatchStatus
  [/getWatchStatus: async \(_videoId: string, _token\?: string\)/g, 'getWatchStatus: async (_videoId: string, ..._a: any[])'],
  // createClass
  [/createClass: async \(\s*payload: CreateClassPayload,\s*trainerId: string,\s*gymId: string \| null,\s*_token\?: string,\s*\)/g, 'createClass: async (payload: CreateClassPayload, trainerId: string, gymId: string | null, ..._a: any[])'],
  // updateClass
  [/updateClass: async \(classId: string, payload: Partial<CreateClassPayload>, _token\?: string\)/g, 'updateClass: async (classId: string, payload: Partial<CreateClassPayload>, ..._a: any[])'],
  // cancelClass
  [/cancelClass: async \(classId: string, _token\?: string\)/g, 'cancelClass: async (classId: string, ..._a: any[])'],
  // getHostToken
  [/getHostToken: async \(_classId: string, _token\?: string\)/g, 'getHostToken: async (_classId: string, ..._a: any[])'],
  // getAttendees
  [/getAttendees: async \(classId: string, _token\?: string\)/g, 'getAttendees: async (classId: string, ..._a: any[])'],
  // endClass
  [/endClass: async \(classId: string, _token\?: string\)/g, 'endClass: async (classId: string, ..._a: any[])'],
  // getPastClasses
  [/getPastClasses: async \(trainerId: string, _page = 1, _token\?: string\)/g, 'getPastClasses: async (trainerId: string, ..._a: any[])'],
  // getUpcomingClasses
  [/getUpcomingClasses: async \(trainerId: string, _token\?: string\)/g, 'getUpcomingClasses: async (trainerId: string, ..._a: any[])'],
  // getWeightHistory
  [/getWeightHistory: async \(\s*_trainerId: string,\s*memberId: string,\s*_token\?: string,\s*\)/g, 'getWeightHistory: async (_trainerId: string, memberId: string, ..._a: any[])'],
  // addAnnotation
  [/addAnnotation: async \(\s*trainerId: string,\s*memberId: string,\s*date: string,\s*annotation: string,\s*_token\?: string,\s*\)/g, 'addAnnotation: async (trainerId: string, memberId: string, date: string, annotation: string, ..._a: any[])'],
  // getMeasurements
  [/getMeasurements: async \(\s*_trainerId: string,\s*memberId: string,\s*_token\?: string,\s*\)/g, 'getMeasurements: async (_trainerId: string, memberId: string, ..._a: any[])'],
  // getProgressPhotos
  [/getProgressPhotos: async \(\s*_trainerId: string,\s*memberId: string,\s*_token\?: string,\s*\)/g, 'getProgressPhotos: async (_trainerId: string, memberId: string, ..._a: any[])'],
  // requestPhotoAccess
  [/requestPhotoAccess: async \(_trainerId: string, memberId: string, _token\?: string\)/g, 'requestPhotoAccess: async (_trainerId: string, memberId: string, ..._a: any[])'],
  // commentOnPhoto
  [/commentOnPhoto: async \(\s*_trainerId: string,\s*memberId: string,\s*photoId: string,\s*text: string,\s*_token\?: string,\s*\)/g, 'commentOnPhoto: async (_trainerId: string, memberId: string, photoId: string, text: string, ..._a: any[])'],
  // createInvite
  [/createInvite: async \(\s*trainerId: string,\s*payload: CreateInvitePayload,\s*_token\?: string,\s*\)/g, 'createInvite: async (trainerId: string, payload: CreateInvitePayload, ..._a: any[])'],
  // getInvites
  [/getInvites: async \(trainerId: string, _token\?: string\)/g, 'getInvites: async (trainerId: string, ..._a: any[])'],
  // addManualClient
  [/addManualClient: async \(\s*trainerId: string,\s*payload: ManualClientPayload,\s*_token\?: string,\s*\)/g, 'addManualClient: async (trainerId: string, payload: ManualClientPayload, ..._a: any[])'],
  // removeClient
  [/removeClient: async \(trainerId: string, memberId: string, _token\?: string\)/g, 'removeClient: async (trainerId: string, memberId: string, ..._a: any[])'],
  // getEarnings
  [/getEarnings: async \(\s*trainerId: string,\s*month: string,\s*_token\?: string,\s*\)/g, 'getEarnings: async (trainerId: string, month: string, ..._a: any[])'],
  // getFeeDues
  [/getFeeDues: async \(trainerId: string, _token\?: string\)/g, 'getFeeDues: async (trainerId: string, ..._a: any[])'],
  // sendReminder
  [/sendReminder: async \(trainerId: string, memberId: string, _token\?: string\)/g, 'sendReminder: async (trainerId: string, memberId: string, ..._a: any[])'],
  // getPaymentHistory
  [/getPaymentHistory: async \(trainerId: string, _page = 1, _token\?: string\)/g, 'getPaymentHistory: async (trainerId: string, ..._a: any[])'],
  // getNotifications
  [/getNotifications: async \(trainerId: string, _page = 1, _token\?: string\)/g, 'getNotifications: async (trainerId: string, ..._a: any[])'],
  // markAllRead
  [/markAllRead: async \(trainerId: string, _token\?: string\)/g, 'markAllRead: async (trainerId: string, ..._a: any[])'],
  // deleteNotification
  [/deleteNotification: async \(_trainerId: string, notifId: string, _token\?: string\)/g, 'deleteNotification: async (_trainerId: string, notifId: string, ..._a: any[])'],
  // updatePreferences
  [/updatePreferences: async \(\s*trainerId: string,\s*type: string,\s*pushEnabled: boolean,\s*whatsappEnabled: boolean,\s*_token\?: string,\s*\)/g, 'updatePreferences: async (trainerId: string, type: string, pushEnabled: boolean, whatsappEnabled: boolean, ..._a: any[])'],
  // getProfile
  [/getProfile: async \(trainerId: string, _token\?: string\)/g, 'getProfile: async (trainerId: string, ..._a: any[])'],
  // updateProfile
  [/updateProfile: async \(\s*trainerId: string,\s*data: Partial<TrainerProfile>,\s*_token\?: string,\s*\)/g, 'updateProfile: async (trainerId: string, data: Partial<TrainerProfile>, ..._a: any[])'],
  // uploadProfilePhoto
  [/uploadProfilePhoto: async \(_trainerId: string, _formData: FormData, _token\?: string\)/g, 'uploadProfilePhoto: async (_trainerId: string, _formData: FormData, ..._a: any[])'],
  // uploadCertification
  [/uploadCertification: async \(_trainerId: string, _formData: FormData, _token\?: string\)/g, 'uploadCertification: async (_trainerId: string, _formData: FormData, ..._a: any[])'],
  // leaveGym
  [/leaveGym: async \(trainerId: string, _token\?: string\)/g, 'leaveGym: async (trainerId: string, ..._a: any[])'],
  // logout ProfileAPI
  [/logout: async \(_fcmToken\?: string, _token\?: string\)/g, 'logout: async (..._a: any[])'],
  // deleteAccount
  [/deleteAccount: async \(trainerId: string, _otp\?: string, _token\?: string\)/g, 'deleteAccount: async (trainerId: string, ..._a: any[])'],
  // PlanAPI createPlan
  [/createPlan: async \(plan: Omit<WorkoutPlan, 'id' \| 'assignedAt'>, _token\?: string\)/g, "createPlan: async (plan: Omit<WorkoutPlan, 'id' | 'assignedAt'>, ..._a: any[])"],
  // PlanAPI assignPlan
  [/assignPlan: async \(planId: string, memberId: string, _token\?: string\)/g, 'assignPlan: async (planId: string, memberId: string, ..._a: any[])'],
];

let count = 0;
for (const [pattern, replacement] of replacements) {
  const before = content;
  content = content.replace(pattern, replacement);
  if (content !== before) count++;
}

fs.writeFileSync(filePath, content);
console.log(`Applied ${count} replacements to trainer.api.ts`);
console.log('Now run: npx tsc --noEmit');
