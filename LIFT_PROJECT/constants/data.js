// ── LIFT APP SAMPLE DATA ─────────────────────────────────
// All mock / default data lives here.
// When you connect a real backend, replace these one by one.

export const MEMBER_DEFAULT = {
  name:        'Ramesh',
  phone:       '8891707187',
  gym:         'Fitnessoul, Edachira',
  trainer:     'Vishnu',
  plan:        'Monthly',
  validUntil:  '15 Apr 2026',
  daysLeft:    29,
  weight:      66.5,
  height:      166,
  goalWeight:  70,
};

export const TODAY_WORKOUT = {
  name: 'Pull Day',
  time: '45 min',
  exercises: [
    {
      id: '1', name: 'Barbell Row', sets: 4, reps: 8, rest: 60,
      note: 'Keep back straight', done: false,
      videoUri: 'https://www.w3schools.com/html/mov_bbb.mp4',
    },
    {
      id: '2', name: 'Pull-Ups', sets: 2, reps: 10, rest: 60,
      note: '', done: false,
      videoUri: 'https://www.w3schools.com/html/movie.mp4',
    },
    {
      id: '3', name: 'Lat Pulldown', sets: 2, reps: 10, rest: 60,
      note: '', done: false,
      videoUri: 'https://www.w3schools.com/html/mov_bbb.mp4',
    },
    {
      id: '4', name: 'Single-Arm Dumbbell Row', sets: 3, reps: 0, rest: 60,
      note: '', done: false,
      videoUri: 'https://www.w3schools.com/html/movie.mp4',
    },
    {
      id: '5', name: 'Rear Delt Fly', sets: 3, reps: 15, rest: 60,
      note: '', done: false,
      videoUri: 'https://www.w3schools.com/html/mov_bbb.mp4',
    },
  ],
};

export const WEEK = [
  { day: 'Sun', label: 'Pull Day', rest: false },
  { day: 'Mon', label: 'Pull Day', rest: false },
  { day: 'Tue', label: 'Pull Day', rest: false },
  { day: 'Wed', label: 'Pull Day', rest: false },
  { day: 'Thu', label: 'Pull Day', rest: false },
  { day: 'Fri', label: 'Pull Day', rest: false },
  { day: 'Sat', label: 'Pull Day', rest: false },
];

export const VIDEOS = [
  { id: '1', title: 'Full Body Warmup',   trainer: 'Vishnu', duration: '12 min', category: 'Cardio',   watched: true  },
  { id: '2', title: 'Chest & Shoulders',  trainer: 'Vishnu', duration: '28 min', category: 'Strength', watched: false },
  { id: '3', title: 'Core Blast',         trainer: 'Priya',  duration: '15 min', category: 'Core',     watched: false },
  { id: '4', title: 'Yoga for Recovery',  trainer: 'Priya',  duration: '20 min', category: 'Yoga',     watched: true  },
  { id: '5', title: 'Leg Day Complete',   trainer: 'Vishnu', duration: '35 min', category: 'Strength', watched: false },
  { id: '6', title: 'Mobility Flow',      trainer: 'Priya',  duration: '18 min', category: 'Mobility', watched: false },
];

export const WEIGHT_LOG = [
  { date: '10 Mar', weight: 73.5 },
  { date: '12 Mar', weight: 73.0 },
  { date: '14 Mar', weight: 72.8 },
  { date: '16 Mar', weight: 72.5 },
];

export const MEASURE_HISTORY = {
  Chest:       [{ date: '1 Mar', val: 97   }, { date: '5 Mar', val: 96.5 }, { date: '10 Mar', val: 96.2 }, { date: '15 Mar', val: 96   }],
  Waist:       [{ date: '1 Mar', val: 84   }, { date: '5 Mar', val: 83   }, { date: '10 Mar', val: 82.5 }, { date: '15 Mar', val: 82   }],
  Hips:        [{ date: '1 Mar', val: 95   }, { date: '5 Mar', val: 94.5 }, { date: '10 Mar', val: 94.2 }, { date: '15 Mar', val: 94   }],
  'Left Arm':  [{ date: '1 Mar', val: 35.5 }, { date: '5 Mar', val: 35.3 }, { date: '10 Mar', val: 35.1 }, { date: '15 Mar', val: 35   }],
  'Right Arm': [{ date: '1 Mar', val: 36   }, { date: '5 Mar', val: 35.8 }, { date: '10 Mar', val: 35.6 }, { date: '15 Mar', val: 35.5 }],
  Shoulders:   [{ date: '1 Mar', val: 113  }, { date: '5 Mar', val: 112.5}, { date: '10 Mar', val: 112.2}, { date: '15 Mar', val: 112  }],
};

export const CONSULTANTS = {
  Nutrition: [
    { id: 'n1', name: 'Dr. Anitha Nair', spec: 'Sports Nutrition',   available: true,  hours: '9 AM – 6 PM',  rating: 4.8, sessions: 142, avatar: '👩‍⚕️' },
    { id: 'n2', name: 'Rahul Menon',     spec: 'Weight Management',  available: true,  hours: '10 AM – 8 PM', rating: 4.6, sessions: 98,  avatar: '👨‍⚕️' },
    { id: 'n3', name: 'Priya Suresh',    spec: 'Clinical Dietitian', available: false, hours: '8 AM – 4 PM',  rating: 4.9, sessions: 210, avatar: '👩‍⚕️' },
  ],
  Physio: [
    { id: 'p1', name: 'Dr. Sanjay Kumar', spec: 'Sports Physio',    available: true,  hours: '8 AM – 5 PM',  rating: 4.7, sessions: 176, avatar: '👨‍⚕️' },
    { id: 'p2', name: 'Meera Pillai',     spec: 'Rehab Specialist', available: false, hours: '11 AM – 7 PM', rating: 4.5, sessions: 89,  avatar: '👩‍⚕️' },
    { id: 'p3', name: 'Arun Das',         spec: 'Muscle & Joint',   available: true,  hours: '9 AM – 6 PM',  rating: 4.8, sessions: 134, avatar: '👨‍⚕️' },
  ],
};

export const CONSULT_PRICING = {
  chat: { price: 25, duration: 600, label: '10 min Chat' },
  call: { price: 50, duration: 300, label: '5 min Call'  },
};

export const NOTIFS = [
  { id: '1', icon: '🏋️', title: 'New workout assigned',       body: 'Push Day A is ready for today',              time: '2h ago', read: false },
  { id: '2', icon: '📅', title: 'Live class in 5 mins',       body: 'Morning Yoga with Priya',                    time: '5h ago', read: false },
  { id: '3', icon: '💳', title: 'Membership expiring soon',   body: '29 days left — renew to stay active',        time: '1d ago', read: true  },
  { id: '4', icon: '📸', title: 'Progress photo reminder',    body: "It's Sunday! Log your progress photo",       time: '2d ago', read: true  },
];