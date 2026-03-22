// patch-gymid.js
// Run from trainer app root: node patch-gymid.js
// Adds getEffectiveGymId helper to trainer.api.ts so all Firestore paths
// work correctly for both gym members and freelance members

const fs = require('fs');

const apiPath = './src/services/trainer.api.ts';
let content = fs.readFileSync(apiPath, 'utf8');

// Add getEffectiveGymId helper after the existing getTrainerGymId function
// This ensures all paths fall back to trainerId when no gymId
const helper = `
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
`;

// Insert after getMemberGymId function
if (!content.includes('getEffectiveGymId')) {
  content = content.replace(
    /const getTrainerGymId = async/,
    `${helper}\nconst getTrainerGymId = async`
  );
  console.log('✓ Added getEffectiveGymId helper');
}

// Replace all getTrainerGymId(uid()) calls in WorkoutAPI with getEffectiveGymId
// so freelance trainers can still create workouts and plans
content = content.replace(
  /const gymId = await getTrainerGymId\(uid\(\)\);/g,
  'const gymId = await getEffectiveGymId(uid());'
);

// Replace getMemberGymId in assignPlan to use getEffectiveGymId
content = content.replace(
  /const gymId = await getMemberGymId\(memberId\) \?\? trainerId;/g,
  'const gymId = await getEffectiveGymId(trainerId, memberId);'
);

// Replace remaining getMemberGymId calls that affect cross-trainer-member paths
content = content.replace(
  /const gymId = await getMemberGymId\(memberId\);/g,
  'const gymId = await getEffectiveGymId(trainerId || uid(), memberId);'
);

fs.writeFileSync(apiPath, content);
console.log('✓ All Firestore paths now handle null gymId correctly');
console.log('Run: npx expo start');
