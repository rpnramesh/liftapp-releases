// fix-trainer-app.js
// Run from TRAINER APP root: node fix-trainer-app.js

const fs = require('fs');
let fixes = 0;

// ── 1. Add MemberDetailsScreen to navigator ──────────────────────────────────
const navPath = './src/navigation/TrainerNavigator.tsx';
let nav = fs.readFileSync(navPath, 'utf8');

if (!nav.includes('MemberDetailsScreen')) {
  nav = nav.replace(
    `import ClientListScreen from '../screens/clients/ClientListScreen';`,
    `import ClientListScreen from '../screens/clients/ClientListScreen';\nimport MemberDetailsScreen from '../screens/clients/MemberDetailsScreen';`
  );
  nav = nav.replace(
    /export type ClientsStackParamList = \{/,
    `export type ClientsStackParamList = {\n  MemberDetails: { clientId: string; clientName: string };`
  );
  nav = nav.replace(
    `<ClientsStack.Screen name="PhoneInvite"`,
    `<ClientsStack.Screen name="MemberDetails" component={MemberDetailsScreen} options={{ headerShown: false }} />\n        <ClientsStack.Screen name="PhoneInvite"`
  );
  fs.writeFileSync(navPath, nav);
  console.log('✓ Fix 1: MemberDetailsScreen added to navigator');
  fixes++;
}

// ── 2. Add "Member Details" button above "View Workout Logs" in ClientProfileScreen ──
const clientPath = './src/screens/clients/ClientListScreen.tsx';
if (fs.existsSync(clientPath)) {
  let client = fs.readFileSync(clientPath, 'utf8');
  
  if (!client.includes('MemberDetails') && client.includes('WorkoutLogs')) {
    client = client.replace(
      `<TouchableOpacity style={pStyles.secondBtn}
          onPress={() => navigation.navigate('WorkoutLogs', {`,
      `<TouchableOpacity style={[pStyles.secondBtn, { backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryMid }]}
          onPress={() => navigation.navigate('MemberDetails', {
            clientId: profile.id, clientName: profile.fullName,
          })}>
          <Text style={[pStyles.secondBtnText, { color: C.primary }]}>📋 Member Details & Measurements</Text>
        </TouchableOpacity>

        <TouchableOpacity style={pStyles.secondBtn}
          onPress={() => navigation.navigate('WorkoutLogs', {`
    );
    fs.writeFileSync(clientPath, client);
    console.log('✓ Fix 2: Member Details button added above Workout Logs');
    fixes++;
  } else {
    console.log('ℹ Fix 2: Already added or pattern not found');
  }
}

// ── 3. Fix chat clear on member removal — trainer side ───────────────────────
// When trainer removes a member, we should NOT delete chat history
// (chat stays until trainer or member explicitly deletes)
// The current handleRemove in ClientListScreen.tsx already just sets trainerId:null
// so no change needed here

// ── 4. Add WorkoutsListScreen import if missing ──────────────────────────────
if (!nav.includes('WorkoutsListScreen')) {
  nav = nav.replace(
    `import LibraryScreen from '../screens/library/LibraryScreen';`,
    `import LibraryScreen from '../screens/library/LibraryScreen';\nimport WorkoutsListScreen from '../screens/library/WorkoutsListScreen';`
  );
  fs.writeFileSync(navPath, nav);
}

console.log(`\n✅ Applied ${fixes} fixes. Run: npx expo start --clear`);
