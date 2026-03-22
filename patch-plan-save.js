// patch-plan-save.js
// Run from trainer app root: node patch-plan-save.js
// Ensures CreatePlanScreen writes currentPlanName + currentPlanId
// to the members collection on every save, so ClientListScreen sees it

const fs = require('fs');

const filePath = './src/screens/workout/CreatePlanScreen.tsx';
if (!fs.existsSync(filePath)) {
  console.log('File not found:', filePath);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Add firebase imports if not present
if (!content.includes("from 'firebase/firestore'")) {
  content = content.replace(
    /import React/,
    `import { doc, getDoc, setDoc, collection, updateDoc } from 'firebase/firestore';\nimport { db } from '../../firebase/config';\nimport React`
  );
}
if (!content.includes("from '../../firebase/config'") && !content.includes("from \"../../firebase/config\"")) {
  content = content.replace(
    /import React/,
    `import { db } from '../../firebase/config';\nimport React`
  );
}

// Ensure getDoc, setDoc, collection, updateDoc are imported
if (!content.includes('updateDoc')) {
  content = content.replace(
    /from 'firebase\/firestore'/,
    `from 'firebase/firestore'`
  );
}

// Find the save handler and add member update after plan save
// Look for the notification setDoc and add member update after it
const memberUpdateSnippet = `
      // Always update member document so ClientListScreen shows plan name
      try {
        await updateDoc(doc(db, 'members', clientId), {
          currentPlanId: planRef.id,
          currentPlanName: planName.trim(),
          planAssignedAt: Date.now(),
        });
      } catch (e) {
        // Member doc might not exist for freelance clients — try setDoc with merge
        try {
          await setDoc(doc(db, 'members', clientId), {
            currentPlanId: planRef.id,
            currentPlanName: planName.trim(),
            planAssignedAt: Date.now(),
          }, { merge: true });
        } catch (e2) {
          console.log('Member plan update error:', e2);
        }
      }
`;

// Insert member update before the notification send (after assignment setDoc)
if (!content.includes('Always update member document')) {
  content = content.replace(
    /\/\/ Send notification to member/,
    `${memberUpdateSnippet}
      // Send notification to member`
  );
  console.log('✓ Added member plan update to CreatePlanScreen');
} else {
  console.log('Already patched — skipping');
}

fs.writeFileSync(filePath, content);
console.log('Done! Run: npx expo start');
