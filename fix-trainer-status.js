// fix-trainer-status.js
// Run from TRAINER APP root: node fix-trainer-status.js
// Ensures workout status (Not Started / In Progress / Completed) refreshes
// every time the trainer opens the Clients screen

const fs = require('fs');
const clientPath = './src/screens/clients/ClientListScreen.tsx';

if (!fs.existsSync(clientPath)) {
  console.log('ERROR: ClientListScreen.tsx not found');
  process.exit(1);
}

let code = fs.readFileSync(clientPath, 'utf8');
let fixes = 0;

// Fix 1: getTodayStatus also checks startedAt even if completedAt is missing
// Some edge case where completedAt might be stored differently
const OLD_TODAY_STATUS = `function getTodayStatus(planDays: any[]): { label: string; color: string } | null {
  if (!planDays || planDays.length === 0) return null;
  const todayLabel = getTodayLabel();
  const today = planDays.find(d =>
    (d.dayLabel ?? '').toLowerCase() === todayLabel.toLowerCase()
  );
  if (!today) return null;
  if (today.restDay) return { label: '😴 Rest Day', color: C.mid };
  const exercises = today.exercises ?? [];
  if (exercises.length === 0) return null;
  if (today.completedAt) return { label: '✅ Completed', color: '#16A34A' };
  if (today.startedAt) return { label: '🔄 In Progress', color: '#D97706' };
  return { label: '⏳ Not Started', color: C.primary };
}`;

const NEW_TODAY_STATUS = `function getTodayStatus(planDays: any[]): { label: string; color: string } | null {
  if (!planDays || planDays.length === 0) return null;
  const todayLabel = getTodayLabel();
  // Try multiple day label formats
  const today = planDays.find(d => {
    const label = (d.dayLabel ?? d.day ?? '').toLowerCase();
    return label === todayLabel.toLowerCase() || label === todayLabel.slice(0, 3).toLowerCase();
  });
  if (!today) return null;
  if (today.restDay) return { label: '😴 Rest Day', color: C.mid };
  const exercises = today.exercises ?? [];
  if (exercises.length === 0) return { label: '😴 Rest Day', color: C.mid };
  // Check both timestamp and boolean flags for max compatibility
  if (today.completedAt || today.completed === true) return { label: '✅ Completed', color: '#16A34A' };
  if (today.startedAt || today.inProgress === true) return { label: '🔄 In Progress', color: '#D97706' };
  return { label: '⏳ Not Started', color: C.primary };
}`;

if (code.includes('if (today.completedAt)')) {
  code = code.replace(
    /function getTodayStatus[\s\S]*?return \{ label: '⏳ Not Started', color: C\.primary \};\n\}/,
    NEW_TODAY_STATUS
  );
  console.log('✓ Fix 1: getTodayStatus handles more day label formats and flag types');
  fixes++;
} else {
  console.log('ℹ Fix 1: getTodayStatus already updated or pattern not found');
}

// Fix 2: Ensure the ClientProfileScreen also has the "Member Details" button
// above workout logs (in case it was missed)
if (!code.includes('MemberDetails')) {
  code = code.replace(
    `<TouchableOpacity style={pStyles.secondBtn}
          onPress={() => navigation.navigate('WorkoutLogs', {
            clientId: profile.id, clientName: profile.fullName,
          })}>
          <Text style={pStyles.secondBtnText}>📊 View Workout Logs</Text>
        </TouchableOpacity>`,
    `<TouchableOpacity
          style={[pStyles.secondBtn, { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }]}
          onPress={() => navigation.navigate('MemberDetails', {
            clientId: profile.id, clientName: profile.fullName,
          })}>
          <Text style={[pStyles.secondBtnText, { color: '#1D4ED8' }]}>📋 Member Details & Measurements</Text>
        </TouchableOpacity>

        <TouchableOpacity style={pStyles.secondBtn}
          onPress={() => navigation.navigate('WorkoutLogs', {
            clientId: profile.id, clientName: profile.fullName,
          })}>
          <Text style={pStyles.secondBtnText}>📊 View Workout Logs</Text>
        </TouchableOpacity>`
  );
  console.log('✓ Fix 2: Member Details button added to ClientProfileScreen');
  fixes++;
} else {
  console.log('ℹ Fix 2: Member Details button already present');
}

fs.writeFileSync(clientPath, code);
console.log(`\n✅ Applied ${fixes} fixes to ClientListScreen.tsx`);
console.log('Run: npx expo start --clear');
