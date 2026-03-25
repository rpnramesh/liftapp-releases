// member-app-patch.js — run from LIFT root: node member-app-patch.js
const fs = require('fs');

if (!fs.existsSync('./App.js')) { console.log('❌ Run from LIFT folder'); process.exit(1); }
if (!fs.existsSync('./TrainerInviteSection.js')) { console.log('❌ TrainerInviteSection.js missing'); process.exit(1); }

let content = fs.readFileSync('./App.js', 'utf8');

// Step 1: Extend Firestore imports
const needed = ['updateDoc', 'collection', 'query', 'where', 'getDocs', 'onSnapshot', 'setDoc'];
const missing = needed.filter(fn => !content.includes(fn));
if (missing.length > 0) {
  const match = content.match(/import \{([^}]+)\} from 'firebase\/firestore';/);
  if (match) {
    const existing = match[1].split(',').map(s => s.trim()).filter(Boolean);
    const merged = [...new Set([...existing, ...missing])].join(', ');
    content = content.replace(/import \{[^}]+\} from 'firebase\/firestore';/, `import { ${merged} } from 'firebase/firestore';`);
    console.log('✓ Updated Firestore imports');
  } else {
    console.log('⚠ Add manually to imports: ' + missing.join(', '));
  }
}

// Step 2: Add acceptingTrainerInvites field
if (!content.includes('acceptingTrainerInvites')) {
  content = content.replace(/const MEMBER_DEFAULT = \{/, `const MEMBER_DEFAULT = {\n  acceptingTrainerInvites: false,`);
  console.log('✓ Added acceptingTrainerInvites');
}

// Step 3: Insert component before ProfileScreen
const section = fs.readFileSync('./TrainerInviteSection.js', 'utf8');
if (!content.includes('function TrainerInviteSection(')) {
  content = content.replace('function ProfileScreen(', `${section}\n\nfunction ProfileScreen(`);
  console.log('✓ Inserted TrainerInviteSection');
}

// Step 4: Call it inside ProfileScreen
if (!content.includes('<TrainerInviteSection')) {
  if (content.includes("<Text style={g.sec}>Preferences</Text>")) {
    content = content.replace(
      "<Text style={g.sec}>Preferences</Text>",
      `<TrainerInviteSection member={member} onTrainerLinked={onUpdateMember} />\n\n      <Text style={g.sec}>Preferences</Text>`
    );
    console.log('✓ Added <TrainerInviteSection> before Preferences');
  } else {
    content = content.replace(
      `<TouchableOpacity style={pf.logoutBtn}`,
      `<TrainerInviteSection member={member} onTrainerLinked={onUpdateMember} />\n      <TouchableOpacity style={pf.logoutBtn}`
    );
    console.log('✓ Added <TrainerInviteSection> before logout');
  }
}

fs.writeFileSync('./App.js', content);
console.log('\n✅ Done. Run: npx expo start');
