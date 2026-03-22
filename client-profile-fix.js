// client-profile-fix.js
// Run from trainer app root: node client-profile-fix.js
// Patches ClientProfileScreen to show the existing plan with an Edit Plan button

const fs = require('fs');

const filePath = './src/screens/clients/ClientListScreen.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The ClientProfileScreen is in this file.
// Find the "Create / Edit Plan" button and change its label to reflect whether a plan exists
const oldBtn = `<PrimaryButton label="Create / Edit Plan" onPress={() => navigation.navigate('CreatePlan', { clientId: profile.id, clientName: profile.fullName })} />`;
const newBtn = `<PrimaryButton 
  label={profile.currentPlanName ? \`✏️ Edit Plan: \${profile.currentPlanName}\` : '+ Create Plan'} 
  onPress={() => navigation.navigate('CreatePlan', { clientId: profile.id, clientName: profile.fullName })} 
/>`;

if (content.includes('Create / Edit Plan')) {
  content = content.replace(oldBtn, newBtn);
  fs.writeFileSync(filePath, content);
  console.log('✓ ClientProfileScreen patched — shows existing plan name on button');
} else {
  console.log('Pattern not found — checking alternate format...');
  // Try alternate
  content = content.replace(
    /label="Create \/ Edit Plan"/,
    'label={profile.currentPlanName ? `✏️ Edit Plan: ${profile.currentPlanName}` : \'+ Create Plan\'}'
  );
  fs.writeFileSync(filePath, content);
  console.log('✓ Applied alternate patch');
}

console.log('Run: npx expo start');
