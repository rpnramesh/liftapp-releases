// fix-navigator.js — run from trainer app root: node fix-navigator.js
const fs = require('fs');
const navPath = './src/navigation/TrainerNavigator.tsx';
let content = fs.readFileSync(navPath, 'utf8');

// Fix the entire ClientsStackParamList block
content = content.replace(
  /export type ClientsStackParamList = \{[\s\S]*?\n\};/,
  `export type ClientsStackParamList = {
  ClientList: undefined;
  ClientProfile: { clientId: string; clientName: string };
  CreatePlan: { clientId: string; clientName: string };
  WorkoutLogs: { clientId: string; clientName: string };
  WeightBMI: { clientId: string; clientName: string };
  Measurements: { clientId: string; clientName: string };
  ProgressPhotos: { clientId: string; clientName: string };
  FreelanceOnboarding: undefined;
  TrainerChat: { clientId: string; clientName: string; clientPhone?: string; clientPhotoUrl?: string | null };
  PhoneInvite: undefined;
};`
);
console.log('✓ Fixed ClientsStackParamList');

if (!content.includes('PhoneInviteScreen')) {
  content = content.replace(
    `import ClientListScreen from '../screens/clients/ClientListScreen';`,
    `import ClientListScreen from '../screens/clients/ClientListScreen';\nimport PhoneInviteScreen from '../screens/clients/PhoneInviteScreen';`
  );
  console.log('✓ Added PhoneInviteScreen import');
}

if (!content.includes(`name="PhoneInvite"`)) {
  content = content.replace(
    `<ClientsStack.Screen name="ClientList"`,
    `<ClientsStack.Screen name="PhoneInvite" component={PhoneInviteScreen} options={{ headerShown: false }} />\n        <ClientsStack.Screen name="ClientList"`
  );
  console.log('✓ Added PhoneInvite screen');
}

fs.writeFileSync(navPath, content);
console.log('\n✅ Done. Run: npx expo start');
