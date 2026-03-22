// fix-handle-remove.js
// Run from trainer app root: node fix-handle-remove.js
// Fixes: removing a client sets active:false, making them unsearchable forever

const fs = require('fs');
const path = './src/screens/clients/ClientListScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Remove the active:false line from handleRemove
content = content.replace(
  /await updateDoc\(doc\(db, 'members', clientId\), \{\s*trainerId: null,\s*active: false,\s*removedAt: Date\.now\(\),\s*\}\);/,
  `await updateDoc(doc(db, 'members', clientId), {
              trainerId: null,
              removedAt: Date.now(),
            });`
);

fs.writeFileSync(path, content);
console.log('✓ Fixed handleRemove — no longer sets active:false');
console.log('Run: npx expo start');
