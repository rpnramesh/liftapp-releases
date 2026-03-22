// add-chat-navigation.js
// Run from trainer app root: node add-chat-navigation.js
// Adds TrainerChatScreen to the ClientsStack in TrainerNavigator.tsx

const fs = require('fs');

const navPath = './src/navigation/TrainerNavigator.tsx';
if (!fs.existsSync(navPath)) {
  console.log('TrainerNavigator.tsx not found at', navPath);
  process.exit(1);
}

let content = fs.readFileSync(navPath, 'utf8');

// 1. Add import for TrainerChatScreen
if (!content.includes('TrainerChatScreen')) {
  content = content.replace(
    /import.*ClientProfileScreen.*from.*ClientListScreen.*/,
    (match) => `${match}\nimport TrainerChatScreen from '../screens/clients/TrainerChatScreen';`
  );
  // Fallback: add after last screen import
  if (!content.includes('TrainerChatScreen')) {
    content = content.replace(
      /(import.*from '\.\.\/screens\/clients\/ClientListScreen';)/,
      `$1\nimport TrainerChatScreen from '../screens/clients/TrainerChatScreen';`
    );
  }
  console.log('✓ Added TrainerChatScreen import');
}

// 2. Add TrainerChat to ClientsStackParamList type
if (!content.includes('TrainerChat:')) {
  content = content.replace(
    /ClientsStackParamList = \{/,
    `ClientsStackParamList = {\n  TrainerChat: { clientId: string; clientName: string; clientPhone?: string; clientPhotoUrl?: string | null };`
  );
  console.log('✓ Added TrainerChat to ClientsStackParamList');
}

// 3. Add Screen inside ClientsStack
if (!content.includes('<Stack.Screen name="TrainerChat"')) {
  // Find the last Screen in ClientsStack and add after it
  // Look for ProgressPhotos screen as anchor
  const anchor = '<Stack.Screen name="ProgressPhotos"';
  if (content.includes(anchor)) {
    content = content.replace(
      /(.*Stack\.Screen name="ProgressPhotos"[^/]*\/>[^\n]*\n)/,
      `$1        <Stack.Screen name="TrainerChat" component={TrainerChatScreen} options={{ headerShown: false }} />\n`
    );
    console.log('✓ Added TrainerChat Screen after ProgressPhotos');
  } else {
    // Try WorkoutLogs as anchor
    const anchor2 = '<Stack.Screen name="WorkoutLogs"';
    if (content.includes(anchor2)) {
      content = content.replace(
        /(.*Stack\.Screen name="WorkoutLogs"[^/]*\/>[^\n]*\n)/,
        `$1        <Stack.Screen name="TrainerChat" component={TrainerChatScreen} options={{ headerShown: false }} />\n`
      );
      console.log('✓ Added TrainerChat Screen after WorkoutLogs');
    } else {
      console.log('⚠ Could not find anchor — manually add to ClientsStack:');
      console.log('  <Stack.Screen name="TrainerChat" component={TrainerChatScreen} options={{ headerShown: false }} />');
    }
  }
}

fs.writeFileSync(navPath, content);
console.log('\nDone! Run: npx expo install expo-image-picker expo-av && npx expo start');
