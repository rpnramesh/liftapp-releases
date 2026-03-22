// add-phone-invite-nav.js
// Run from trainer app root: node add-phone-invite-nav.js
// Adds PhoneInviteScreen to navigator
// "Invite by Phone" button goes in ClientListScreen header (not Freelance)

const fs = require('fs');

// ── 1. Add to TrainerNavigator ────────────────────────────────────────────────
const navPath = './src/navigation/TrainerNavigator.tsx';
let nav = fs.readFileSync(navPath, 'utf8');

if (!nav.includes('PhoneInviteScreen')) {
  nav = nav.replace(
    `import ClientListScreen from '../screens/clients/ClientListScreen';`,
    `import ClientListScreen from '../screens/clients/ClientListScreen';\nimport PhoneInviteScreen from '../screens/clients/PhoneInviteScreen';`
  );
  console.log('✓ Added PhoneInviteScreen import');
}

if (!nav.includes('PhoneInvite:')) {
  // Add to ClientsStackParamList — find the closing }; of the type
  nav = nav.replace(
    /export type ClientsStackParamList = \{([^}]+)\};/,
    (match, inner) => `export type ClientsStackParamList = {${inner}  PhoneInvite: undefined;\n};`
  );
  console.log('✓ Added PhoneInvite to ClientsStackParamList');
}

if (!nav.includes(`name="PhoneInvite"`)) {
  nav = nav.replace(
    `<ClientsStack.Screen name="ClientList"`,
    `<ClientsStack.Screen name="PhoneInvite" component={PhoneInviteScreen} options={{ headerShown: false }} />\n        <ClientsStack.Screen name="ClientList"`
  );
  console.log('✓ Added PhoneInvite Screen to stack');
}

fs.writeFileSync(navPath, nav);

// ── 2. Add "Invite by Phone" button to ClientListScreen ──────────────────────
// The ClientListScreen already has a "+ Add" button that goes to FreelanceOnboarding
// We change it to go to PhoneInvite instead (which covers both gym + freelance)
const clientPath = './src/screens/clients/ClientListScreen.tsx';
if (fs.existsSync(clientPath)) {
  let client = fs.readFileSync(clientPath, 'utf8');

  // Replace the "+ Add" button to navigate to PhoneInvite
  if (client.includes("navigation.navigate('FreelanceOnboarding')") && !client.includes("navigation.navigate('PhoneInvite')")) {
    client = client.replace(
      /onPress=\{\(\) => navigation\.navigate\('FreelanceOnboarding'\)\}/g,
      `onPress={() => navigation.navigate('PhoneInvite')}`
    );
    console.log('✓ Updated + Add button to open PhoneInvite');
  }

  // Change button label from "+ Add" to "➕ Invite"
  client = client.replace(
    /<Text style={styles\.addBtnText}>(\+ Add|➕ Invite|Invite)<\/Text>/,
    `<Text style={styles.addBtnText}>➕ Invite</Text>`
  );

  fs.writeFileSync(clientPath, client);
  console.log('✓ Updated button label to ➕ Invite');
}

console.log('\nDone! Run: npx expo start');
