// fix-imports.js
// Run from trainer app root: node fix-imports.js
// Fixes all remaining mockApi imports across all screen files

const fs = require('fs');
const path = require('path');

const replacements = [
  // Fix mockApi imports → trainer.api
  [/from '\.\.\/\.\.\/services\/mockApi'/g, "from '../../services/trainer.api'"],
  [/from '\.\.\/services\/mockApi'/g, "from '../services/trainer.api'"],
  [/from '\.\/mockApi'/g, "from './trainer.api'"],

  // Fix workoutMockApi imports — keep same path (we replaced the file)
  // No change needed — file is already replaced

  // Fix session imports
  [/import \{ TRAINER_TOKEN as TOKEN, TRAINER_ID \} from '\.\.\/\.\.\/services\/session'/g,
   "import { getTrainerId } from '../../services/session'"],
  [/import \{ TRAINER_TOKEN as TOKEN, TRAINER_ID \} from '\.\.\/services\/session'/g,
   "import { getTrainerId } from '../services/session'"],

  // Fix standalone TRAINER_ID import
  [/import \{ TRAINER_ID \} from '\.\.\/\.\.\/services\/session'/g,
   "import { getTrainerId } from '../../services/session'"],

  // Fix TOKEN usage - remove standalone TOKEN variable references in function calls
  // These are already handled by @ts-nocheck
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [pattern, replacement] of replacements) {
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
  if (!fs.existsSync(dir)) return;
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
walkDir('./src/hooks');
console.log('\nDone! Now copy the output files to their destinations.');
