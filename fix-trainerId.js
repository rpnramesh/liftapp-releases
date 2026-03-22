// fix-trainerId.js — run from trainer app root: node fix-trainerId.js
// Replaces all screen-level TRAINER_ID usages with getTrainerId()
// so they always get the live Firebase UID, not the stale import copy

const fs = require('fs');
const path = require('path');

const fixes = [
  // Fix import statements to include getTrainerId
  [
    /import \{ TRAINER_ID, getTrainerId \} from '(\.\.\/)*services\/session'/g,
    (match, p1) => `import { getTrainerId } from '${p1 ?? ''}services/session'`
  ],
  [
    /import \{ TRAINER_ID \} from '(\.\.\/)*services\/session'/g,
    (match, p1) => `import { getTrainerId } from '${p1 ?? ''}services/session'`
  ],
  [
    /import \{ TRAINER_TOKEN as TOKEN, TRAINER_ID \} from '(\.\.\/)*services\/session'/g,
    (match, p1) => `import { getTrainerId } from '${p1 ?? ''}services/session'`
  ],
];

// Screens that still have TRAINER_ID as a variable — add getTrainerId() call at top of component
const screenFixes = [
  // Replace standalone TRAINER_ID const declarations that come from session
  [/const TRAINER_ID = ['"][^'"]+['"]/g, 'const TRAINER_ID = getTrainerId()'],
  // Replace inline TRAINER_ID usages in function calls — convert to getTrainerId()
  // Only where it appears as a function argument
  [/\bTRAINER_ID\b(?!\s*=\s*getTrainerId)/g, 'getTrainerId()'],
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [pattern, replacement] of fixes) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) { content = newContent; changed = true; }
  }

  for (const [pattern, replacement] of screenFixes) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) { content = newContent; changed = true; }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', filePath);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory() && !fp.includes('node_modules')) walk(fp);
    else if ((f.endsWith('.tsx') || f.endsWith('.ts')) && !fp.includes('session.ts')) processFile(fp);
  });
}

walk('./src/screens');
walk('./src/context');
console.log('\nDone!');
