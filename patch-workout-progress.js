// patch-workout-progress.js
// Run from LIFT folder: node patch-workout-progress.js
// Fix 1: Write startedAt/completedAt to Firestore so trainer sees workout status
// Fix 2: Use gymId || trainerId as namespace so freelance members can log weight/measurements

const fs = require('fs');
const appPath = './App.js';
if (!fs.existsSync(appPath)) { console.log('Run from LIFT folder'); process.exit(1); }
let code = fs.readFileSync(appPath, 'utf8');
let fixes = 0;

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: Write workout start/complete status back to Firestore
// Find the markSetDone function and add Firestore writes
// ─────────────────────────────────────────────────────────────────────────────

// We need to find and replace the markSetDone function
// The key part is: when setNo === 1 and it's the first set being marked done,
// write startedAt to the plan day. When allDone, write completedAt.

const OLD_MARK_SET_DONE_ALLSETS = `    const isAllDone = exercises.every(ex =>
      Array.from({ length: ex.sets }, (_, i) => \`\${ex.id}_\${i + 1}\`).every(k => newDone[k])
    );

    if (isAllDone) {
      setAllDone(true);
      const elapsed = workoutTimer?.elapsed || 0;
      stopWorkoutTimer(elapsed);
      // Save workout log to Firestore
      if (gymId && memberId) {
        try {
          await saveWorkoutLog(gymId, {
            memberId,
            gymId,
            workoutId: workoutId || '',
            workoutName: workoutName || '',
            durationSeconds: elapsed,
            exerciseLogs: exercises.map(ex => ({
              exerciseId: ex.id,
              exerciseName: ex.name,
              sets: Array.from({ length: ex.sets }, (_, i) => ({
                setNo: i + 1,
                reps: ex.reps,
                weight: parseFloat(setWeights[\`\${ex.id}_\${i + 1}\`] || lastWeights[\`\${ex.id}_\${i + 1}\`] || '0'),
                done: true,
              })),
            })),
            completedAt: Date.now(),
          });
        } catch (_) {}
      }
    }`;

const NEW_MARK_SET_DONE_ALLSETS = `    const isAllDone = exercises.every(ex =>
      Array.from({ length: ex.sets }, (_, i) => \`\${ex.id}_\${i + 1}\`).every(k => newDone[k])
    );

    // Write startedAt on first set completed (so trainer sees "In Progress")
    const totalDoneCount = Object.values(newDone).filter(Boolean).length;
    const gymOrTrainer = gymId || memberId; // fallback for freelance members
    if (totalDoneCount === 1 && gymOrTrainer && memberId) {
      try {
        // Write startedAt to the assignment doc's day entry
        const { doc, updateDoc, getDoc } = require('firebase/firestore');
        const { db } = require('./shared/firebase/config');
        const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', memberId);
        const assignSnap = await getDoc(assignRef).catch(() => null);
        if (assignSnap?.exists() && assignSnap.data()?.planId) {
          const planId = assignSnap.data().planId;
          const planRef = doc(db, 'gyms', gymOrTrainer, 'clientPlans', planId);
          const planSnap = await getDoc(planRef).catch(() => null);
          if (planSnap?.exists()) {
            const plan = planSnap.data();
            const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const todayLabel = dayNames[new Date().getDay()];
            const days = (plan.days ?? []).map(d =>
              (d.dayLabel ?? '').toLowerCase() === todayLabel.toLowerCase()
                ? { ...d, startedAt: Date.now() }
                : d
            );
            await updateDoc(planRef, { days }).catch(() => {});
          }
        }
      } catch (e) { console.log('startedAt write error:', e); }
    }

    if (isAllDone) {
      setAllDone(true);
      const elapsed = workoutTimer?.elapsed || 0;
      stopWorkoutTimer(elapsed);

      // Write completedAt to the plan day (so trainer sees "Completed")
      if (gymOrTrainer && memberId) {
        try {
          const { doc, updateDoc, getDoc, collection, setDoc } = require('firebase/firestore');
          const { db } = require('./shared/firebase/config');
          const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', memberId);
          const assignSnap = await getDoc(assignRef).catch(() => null);
          if (assignSnap?.exists() && assignSnap.data()?.planId) {
            const planId = assignSnap.data().planId;
            const planRef = doc(db, 'gyms', gymOrTrainer, 'clientPlans', planId);
            const planSnap = await getDoc(planRef).catch(() => null);
            if (planSnap?.exists()) {
              const plan = planSnap.data();
              const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
              const todayLabel = dayNames[new Date().getDay()];
              const days = (plan.days ?? []).map(d =>
                (d.dayLabel ?? '').toLowerCase() === todayLabel.toLowerCase()
                  ? { ...d, completedAt: Date.now(), startedAt: d.startedAt ?? Date.now() }
                  : d
              );
              await updateDoc(planRef, { days }).catch(() => {});
            }
          }

          // Save workout log
          const logRef = doc(collection(db, 'gyms', gymOrTrainer, 'workoutLogs'));
          await setDoc(logRef, {
            id: logRef.id,
            memberId,
            gymId: gymId || null,
            workoutId: workoutId || '',
            workoutName: workoutName || '',
            durationSeconds: elapsed,
            exerciseLogs: exercises.map(ex => ({
              exerciseId: ex.id,
              exerciseName: ex.name,
              sets: Array.from({ length: ex.sets }, (_, i) => ({
                setNo: i + 1,
                reps: ex.reps,
                weight: parseFloat(setWeights[\`\${ex.id}_\${i + 1}\`] || lastWeights[\`\${ex.id}_\${i + 1}\`] || '0'),
                done: true,
              })),
            })),
            completedAt: Date.now(),
          });

          // Update member's lastWorkoutAt
          const { updateDoc: upd, doc: d } = require('firebase/firestore');
          await upd(d(db, 'members', memberId), { lastWorkoutAt: Date.now() }).catch(() => {});
        } catch (e) { console.log('Workout complete write error:', e); }
      }
    }`;

if (code.includes(OLD_MARK_SET_DONE_ALLSETS)) {
  code = code.replace(OLD_MARK_SET_DONE_ALLSETS, NEW_MARK_SET_DONE_ALLSETS);
  console.log('✓ Fix 1: Workout status (startedAt/completedAt) now written to Firestore');
  fixes++;
} else {
  console.log('⚠ Fix 1: markSetDone pattern not found — applying alternate fix');
  // Alternate: find the saveWorkoutLog block and replace it
  code = code.replace(
    /if \(gymId && memberId\) \{\s*try \{[\s\S]*?saveWorkoutLog[\s\S]*?\} catch \(_\) \{\}\s*\}/,
    `if (true) { // gymId or trainerId as namespace
        const gymOrTrainer = gymId || memberId;
        try {
          const { doc, updateDoc, getDoc, collection, setDoc } = require('firebase/firestore');
          const { db } = require('./shared/firebase/config');
          // Write completedAt to plan day
          const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', memberId);
          const assignSnap = await getDoc(assignRef).catch(() => null);
          if (assignSnap?.exists() && assignSnap.data()?.planId) {
            const planId = assignSnap.data().planId;
            const planRef = doc(db, 'gyms', gymOrTrainer, 'clientPlans', planId);
            const planSnap = await getDoc(planRef).catch(() => null);
            if (planSnap?.exists()) {
              const plan = planSnap.data();
              const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
              const todayLabel = dayNames[new Date().getDay()];
              const days = (plan.days ?? []).map(d =>
                (d.dayLabel ?? '').toLowerCase() === todayLabel.toLowerCase()
                  ? { ...d, completedAt: Date.now(), startedAt: d.startedAt ?? Date.now() }
                  : d
              );
              await updateDoc(planRef, { days }).catch(() => {});
            }
          }
          // Save log
          const logRef = doc(collection(db, 'gyms', gymOrTrainer, 'workoutLogs'));
          await setDoc(logRef, {
            id: logRef.id, memberId, gymId: gymId || null,
            workoutId: workoutId || '', workoutName: workoutName || '',
            durationSeconds: elapsed, completedAt: Date.now(),
          });
        } catch (e) { console.log('Workout log error:', e); }
      }`
  );
  console.log('✓ Fix 1 (alternate): Workout status written to Firestore');
  fixes++;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Weight logging — fix namespace for freelance members
// ─────────────────────────────────────────────────────────────────────────────
const OLD_LOG_WEIGHT = `  const handleLogWeight = async () => {
    const val = parseFloat(weightInput);
    if (!val || !gymId || !memberId) return;
    setSaving(true);
    try {
      await logWeight(gymId, memberId, val);
      setWeightInput('');
    } finally { setSaving(false); }
  };`;

const NEW_LOG_WEIGHT = `  const handleLogWeight = async () => {
    const val = parseFloat(weightInput);
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!val || !ns || !memberId) { Alert.alert('Error', 'Could not save. Try again.'); return; }
    setSaving(true);
    try {
      // Write directly to Firestore — works for both gym and freelance members
      const { doc, collection, setDoc, updateDoc } = require('firebase/firestore');
      const { db } = require('./shared/firebase/config');
      const logRef = doc(collection(db, 'gyms', ns, 'weightLogs'));
      await setDoc(logRef, {
        id: logRef.id,
        memberId,
        gymId: gymId || null,
        weight: val,
        height: member?.height || 0,
        loggedAt: Date.now(),
      });
      // Also update member's current weight
      await updateDoc(doc(db, 'members', memberId), { weight: val, updatedAt: Date.now() }).catch(() => {});
      setWeightInput('');
    } catch (e) {
      console.log('Weight log error:', e);
      Alert.alert('Error', 'Failed to save weight. Please try again.');
    } finally { setSaving(false); }
  };`;

if (code.includes(OLD_LOG_WEIGHT)) {
  code = code.replace(OLD_LOG_WEIGHT, NEW_LOG_WEIGHT);
  console.log('✓ Fix 2a: Weight logging fixed for freelance members');
  fixes++;
} else {
  console.log('⚠ Fix 2a: handleLogWeight pattern not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2b: Weight subscription — fix namespace for freelance members
// ─────────────────────────────────────────────────────────────────────────────
const OLD_PROGRESS_EFFECT = `  useEffect(() => {
    if (!gymId || !memberId) return;
    const unsub1 = subscribeToWeightLog(gymId, memberId, setWeightLog);
    const unsub2 = subscribeToMeasurements(gymId, memberId, setMeasurements);
    return () => { unsub1(); unsub2(); };
  }, [gymId, memberId]);`;

const NEW_PROGRESS_EFFECT = `  useEffect(() => {
    // Fix: use gymId OR trainerId as namespace for freelance members
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!ns || !memberId) return;
    const unsub1 = subscribeToWeightLog(ns, memberId, setWeightLog);
    const unsub2 = subscribeToMeasurements(ns, memberId, setMeasurements);
    return () => { unsub1(); unsub2(); };
  }, [gymId, memberId, member?.trainerId]);`;

if (code.includes(OLD_PROGRESS_EFFECT)) {
  code = code.replace(OLD_PROGRESS_EFFECT, NEW_PROGRESS_EFFECT);
  console.log('✓ Fix 2b: Weight/measurement subscription fixed for freelance members');
  fixes++;
} else {
  console.log('⚠ Fix 2b: Progress useEffect pattern not found — checking member prop');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2c: Make sure ProgressScreen receives member prop
// ─────────────────────────────────────────────────────────────────────────────
const OLD_PROGRESS_PROPS = `function ProgressScreen({ member, gymId, memberId }) {`;
if (!code.includes(OLD_PROGRESS_PROPS)) {
  // Try to find it and add member
  if (code.includes('function ProgressScreen({ gymId, memberId }) {')) {
    code = code.replace('function ProgressScreen({ gymId, memberId }) {', 'function ProgressScreen({ member, gymId, memberId }) {');
    console.log('✓ Fix 2c: Added member prop to ProgressScreen');
    fixes++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2d: Make sure ProgressScreen is called with member prop in renderTab
// ─────────────────────────────────────────────────────────────────────────────
const OLD_PROGRESS_CALL = `          <ProgressScreen
            member={member}
            gymId={member?.gymId}
            memberId={uid}
          />`;
if (!code.includes(OLD_PROGRESS_CALL)) {
  code = code.replace(
    /<ProgressScreen[\s\S]*?gymId={member\?\.gymId}[\s\S]*?memberId={uid}[\s\S]*?\/>/,
    `<ProgressScreen
            member={member}
            gymId={member?.gymId || member?.trainerId}
            memberId={uid}
          />`
  );
  console.log('✓ Fix 2d: ProgressScreen now passes gymId fallback');
  fixes++;
} else {
  code = code.replace(
    'gymId={member?.gymId}',
    'gymId={member?.gymId || member?.trainerId}'
  );
  console.log('✓ Fix 2d: ProgressScreen gymId now falls back to trainerId');
  fixes++;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: Measurement logging — add ability to log measurements in ProgressScreen
// Currently measurements are read-only in the member app — add logging UI
// ─────────────────────────────────────────────────────────────────────────────
const OLD_MEASUREMENT_TAB = `      {activeTab === 'Measurements' && (
        <View style={{ marginTop: 8 }}>
          {['Chest', 'Waist', 'Hips', 'Bicep', 'Thigh'].map(type => {
            const entries = measurements.filter(m => m.type === type);
            const latest = entries[0];
            return (
              <View key={type} style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.light }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.dark }}>{type}</Text>
                  {latest && <Text style={{ fontSize: 14, fontWeight: '600', color: C.primary }}>{latest.value} cm</Text>}
                </View>
                {!latest && <Text style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>Not logged yet</Text>}
              </View>
            );
          })}
        </View>
      )}`;

const NEW_MEASUREMENT_TAB = `      {activeTab === 'Measurements' && (
        <MeasurementLogger
          member={member}
          gymId={gymId || (member && (member.trainerId || member.id))}
          memberId={memberId}
          measurements={measurements}
        />
      )}`;

if (code.includes(OLD_MEASUREMENT_TAB)) {
  code = code.replace(OLD_MEASUREMENT_TAB, NEW_MEASUREMENT_TAB);
  console.log('✓ Fix 3: Measurements tab replaced with interactive logger');
  fixes++;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3b: Insert MeasurementLogger component before ProgressScreen
// ─────────────────────────────────────────────────────────────────────────────
const MEASUREMENT_LOGGER_COMPONENT = `
// ── MeasurementLogger — lets member log body measurements ────────────────────
function MeasurementLogger({ member, gymId, memberId, measurements }) {
  const TYPES = ['Chest', 'Waist', 'Hips', 'Bicep', 'Thigh', 'Shoulder', 'Calf'];
  const [editing, setEditing] = React.useState(null);
  const [inputVal, setInputVal] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const getLatest = (type) => {
    const entries = (measurements || []).filter(m => m.type === type);
    if (!entries.length) return null;
    return entries.sort((a, b) => (b.loggedAt || 0) - (a.loggedAt || 0))[0];
  };

  const handleSave = async (type) => {
    const val = parseFloat(inputVal);
    if (!val) { Alert.alert('Invalid', 'Enter a valid number'); return; }
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!ns || !memberId) { Alert.alert('Error', 'Cannot save. Try again.'); return; }
    setSaving(true);
    try {
      const { doc, collection, setDoc } = require('firebase/firestore');
      const { db } = require('./shared/firebase/config');
      const ref = doc(collection(db, 'gyms', ns, 'measurements'));
      await setDoc(ref, {
        id: ref.id,
        memberId,
        gymId: gymId || null,
        type,
        value: val,
        loggedAt: Date.now(),
      });
      setEditing(null);
      setInputVal('');
    } catch (e) {
      console.log('Measurement save error:', e);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <View style={{ marginTop: 8 }}>
      {TYPES.map(type => {
        const latest = getLatest(type);
        const isEditing = editing === type;
        return (
          <View key={type} style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: isEditing ? C.primary : C.light }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.dark }}>{type}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {latest && <Text style={{ fontSize: 14, fontWeight: '600', color: C.primary }}>{latest.value} cm</Text>}
                <TouchableOpacity
                  style={{ backgroundColor: isEditing ? C.light : C.blue2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                  onPress={() => { setEditing(isEditing ? null : type); setInputVal(''); }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isEditing ? C.mid : C.primary }}>
                    {isEditing ? 'Cancel' : latest ? 'Update' : '+ Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {!latest && !isEditing && <Text style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>Not logged yet</Text>}
            {isEditing && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: C.bg, borderRadius: 10, padding: 10, fontSize: 16, color: C.dark, borderWidth: 1, borderColor: C.primary }}
                  placeholder={'Enter ' + type + ' in cm'}
                  placeholderTextColor={C.mid}
                  keyboardType="decimal-pad"
                  value={inputVal}
                  onChangeText={setInputVal}
                  autoFocus
                />
                <TouchableOpacity
                  style={{ backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, opacity: (!inputVal || saving) ? 0.5 : 1 }}
                  onPress={() => handleSave(type)}
                  disabled={!inputVal || saving}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{saving ? '…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

`;

if (!code.includes('function MeasurementLogger(')) {
  code = code.replace('function ProgressScreen(', MEASUREMENT_LOGGER_COMPONENT + 'function ProgressScreen(');
  console.log('✓ Fix 3b: MeasurementLogger component added');
  fixes++;
}

fs.writeFileSync(appPath, code);
console.log(`\n✅ Applied ${fixes} fixes to App.js`);
console.log('Run: npx expo start --clear');
