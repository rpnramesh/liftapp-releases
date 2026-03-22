// dashboard-fix.js
// Run from trainer app root: node dashboard-fix.js
// Patches DashboardScreen to get trainer name from AuthContext
// so name updates in Profile reflect immediately on Dashboard

const fs = require('fs');
const path = require('path');

const filePath = './src/screens/dashboard/DashboardScreen.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Add useAuth import if not already present
if (!content.includes("from '../../context/AuthContext'")) {
  content = content.replace(
    /import \{ useNavigation \} from '@react-navigation\/native';/,
    `import { useNavigation } from '@react-navigation/native';\nimport { useAuth } from '../../context/AuthContext';`
  );
}

// Fix 2: Remove TRAINER_NAME from session import
content = content.replace(
  /import \{[^}]*TRAINER_FIRST_NAME as TRAINER_NAME[^}]*\} from ['"][^'"]*session['"]/g,
  `import { getTrainerId } from '../../services/session'`
);

// Fix 3: Add profile from useAuth and derive name from it
// Replace the greeting line
content = content.replace(
  /const greeting = useGreeting\(TRAINER_NAME\);/,
  `const { profile } = useAuth();\n  const trainerName = profile?.fullName ?? profile?.name ?? '';\n  const greeting = useGreeting(trainerName);`
);

// Fix 4: Handle case where TRAINER_NAME is still referenced elsewhere
content = content.replace(/\bTRAINER_NAME\b/g, 'trainerName');

fs.writeFileSync(filePath, content);
console.log('✓ DashboardScreen patched — trainer name now comes from AuthContext');
console.log('Run: npx expo start');
