// repair-imports.js
// Run from trainer app root: node repair-imports.js
// Fixes all import statements broken by the previous fix-trainerId.js script
// That script wrongly replaced TRAINER_ID inside import {} blocks with getTrainerId()
// which is invalid syntax — you cannot call functions inside import statements

const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Fix 1: Remove getTrainerId() calls from inside import { } blocks
  // Pattern: import { ..., getTrainerId(), ... } from '...'
  // Replace the entire broken import with a clean one
  content = content.replace(
    /import \{[^}]*getTrainerId\(\)[^}]*\} from ['"][^'"]+['"]/g,
    (match) => {
      // Extract the source path
      const sourceMatch = match.match(/from ['"]([^'"]+)['"]/);
      const source = sourceMatch ? sourceMatch[1] : '';
      
      // Check if it's a session import
      if (source.includes('session')) {
        return `import { getTrainerId } from '${source}'`;
      }
      
      // For other imports, just remove getTrainerId() from the destructure
      return match.replace(/,?\s*getTrainerId\(\)\s*,?/g, '').replace(/\{,/, '{').replace(/,\s*\}/, '}');
    }
  );

  // Fix 2: Any remaining getTrainerId() inside import statements on a single line
  // e.g. import { TRAINER_TOKEN as TOKEN, getTrainerId(), TRAINER_NAME } from '...'
  const lines = content.split('\n');
  const fixedLines = lines.map(line => {
    // Only fix lines that start with 'import'
    if (line.trim().startsWith('import') && line.includes('getTrainerId()')) {
      const sourceMatch = line.match(/from ['"]([^'"]+)['"]/);
      const source = sourceMatch ? sourceMatch[1] : '';
      if (source.includes('session')) {
        return `import { getTrainerId } from '${source}';`;
      }
      // Remove getTrainerId() from the import destructure
      return line.replace(/,?\s*getTrainerId\(\)\s*,?/g, '');
    }
    return line;
  });
  content = fixedLines.join('\n');

  // Fix 3: Make sure getTrainerId is actually imported where it's used in function bodies
  // If the file uses getTrainerId() in function bodies but doesn't import it, add the import
  const usesGetTrainerId = /(?<!import[^;]*)\bgetTrainerId\(\)/.test(content);
  const importsGetTrainerId = /import[^;]*\bgetTrainerId\b[^;]*from[^;]*session/.test(content);
  
  if (usesGetTrainerId && !importsGetTrainerId) {
    // Find the first import line and add after it
    const firstImportEnd = content.indexOf('\n', content.indexOf('import '));
    if (firstImportEnd > -1) {
      // Find the relative path to session from this file
      const fileDir = path.dirname(filePath);
      const appRoot = process.cwd();
      const servicesPath = path.join(appRoot, 'src', 'services', 'session');
      const relPath = path.relative(fileDir, servicesPath).replace(/\\/g, '/');
      const importPath = relPath.startsWith('.') ? relPath : './' + relPath;
      
      // Add import after last import statement
      const lastImportIndex = (() => {
        let idx = 0;
        const importRegex = /^import\s/gm;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          idx = match.index;
        }
        return content.indexOf('\n', idx);
      })();
      
      if (lastImportIndex > -1) {
        content = content.slice(0, lastImportIndex + 1) +
          `import { getTrainerId } from '${importPath}';\n` +
          content.slice(lastImportIndex + 1);
      }
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('✓ Fixed:', path.relative(process.cwd(), filePath));
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory() && !fp.includes('node_modules')) walk(fp);
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) processFile(fp);
  });
}

console.log('Repairing broken import statements...\n');
walk('./src');
console.log('\nDone! Run: npx expo start');
