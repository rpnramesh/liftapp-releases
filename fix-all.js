// fix-all.js — run from trainer app root: node fix-all.js
// Fixes all mockApi imports and TRAINER_ID references across all screens
const fs = require('fs');
const path = require('path');

const importFixes = [
  // mockApi → trainer.api
  [/from '\.\.\/\.\.\/services\/mockApi'/g, "from '../../services/trainer.api'"],
  [/from '\.\.\/services\/mockApi'/g, "from '../services/trainer.api'"],
  [/from '\.\/mockApi'/g, "from './trainer.api'"],
  // session import fixes
  [/import \{ TRAINER_TOKEN as TOKEN, TRAINER_ID \} from '\.\.\/\.\.\/services\/session'/g,
   "import { TRAINER_ID, getTrainerId } from '../../services/session'"],
  [/import \{ TRAINER_TOKEN as TOKEN, TRAINER_ID \} from '\.\.\/services\/session'/g,
   "import { TRAINER_ID, getTrainerId } from '../services/session'"],
  [/import \{ TRAINER_ID \} from '\.\.\/\.\.\/services\/session'/g,
   "import { TRAINER_ID, getTrainerId } from '../../services/session'"],
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of importFixes) {
    const n = content.replace(pattern, replacement);
    if (n !== content) { content = n; changed = true; }
  }
  if (changed) { fs.writeFileSync(filePath, content); console.log('Fixed:', filePath); }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory() && !fp.includes('node_modules')) walk(fp);
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) processFile(fp);
  });
}

walk('./src/screens');
walk('./src/context');
console.log('\nAll done!');
