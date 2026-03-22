// fix-screens.js
// Run with: node fix-screens.js
// Removes extra TOKEN and page args from API calls in all screen files

const fs = require('fs');
const path = require('path');

const fixes = [
  // Remove trailing TOKEN arg
  [/, TOKEN\)/g, ')'],
  [/, TOKEN\b/g, ''],
  // Remove trailing TOKEN_STUB arg  
  [/, TOKEN_STUB\)/g, ')'],
  [/, TOKEN_STUB\b/g, ''],
  // Remove extra page number before TOKEN: (TRAINER_ID, type, 1, TOKEN) → (TRAINER_ID, type)
  // (TRAINER_ID, 1, TOKEN) → (TRAINER_ID)
  [/, 1, TOKEN\)/g, ')'],
  [/, next, TOKEN\)/g, ')'],
  [/, page, TOKEN\)/g, ')'],
  // Remove trailing extra TRAINER_ID, TOKEN patterns for 2-arg functions
  // e.g. getDashboard(TRAINER_ID, TOKEN) → getDashboard(TRAINER_ID)
  // These are handled by TOKEN removal above
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  for (const [pattern, replacement] of fixes) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !fullPath.includes('node_modules')) {
      walkDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir('./src/screens');
walkDir('./src/context');
console.log('Done! Run: npx tsc --noEmit');
