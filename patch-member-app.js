// patch-member-app.js
// Run from LIFT folder: node patch-member-app.js
// Fixes ALL Member App issues in one shot

const fs = require('fs');

const appPath = './App.js';
if (!fs.existsSync(appPath)) {
  console.log('ERROR: Run this from the LIFT folder (where App.js is)');
  process.exit(1);
}

let code = fs.readFileSync(appPath, 'utf8');
let fixes = 0;

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: Workout sync — read from clientPlans not workouts
// ─────────────────────────────────────────────────────────────────────────────
const OLD_WORKOUT_EFFECT = `  // ── Workout assignment listener ─────────────────────────────────────────────
  useEffect(() => {
    const gymOrTrainer = member?.gymId || member?.trainerId;
    if (!gymOrTrainer || !uid) return;
    const unsub = subscribeToAssignment(gymOrTrainer, uid, async (a) => {
      setAssignment(a);
      if (a?.todayWorkoutId) {
        const workout = await getWorkout(gymOrTrainer, a.todayWorkoutId).catch(() => null);
        setTodayWorkout(workout);
      } else {
        setTodayWorkout(null);
      }
    });
    return () => unsub();
  }, [member?.gymId, member?.trainerId, uid]);`;

const NEW_WORKOUT_EFFECT = `  // ── Workout assignment listener ─────────────────────────────────────────────
  // Reads from clientPlans (where CreatePlanScreen saves plans)
  useEffect(() => {
    const gymOrTrainer = member?.gymId || member?.trainerId;
    if (!gymOrTrainer || !uid) return;
    const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', uid);
    const unsub = onSnapshot(assignRef, async (snap) => {
      if (!snap.exists()) { setAssignment(null); setTodayWorkout(null); return; }
      const a = snap.data();
      setAssignment(a);
      if (a?.planId) {
        try {
          // Read from clientPlans — this is where CreatePlanScreen saves
          const planSnap = await getDoc(doc(db, 'gyms', gymOrTrainer, 'clientPlans', a.planId));
          if (planSnap.exists()) {
            const plan = planSnap.data();
            // Find today's workout from the plan's days array
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayLabel = dayNames[new Date().getDay()];
            const todayDay = plan.days?.find(d => 
              (d.dayLabel || '').toLowerCase() === todayLabel.toLowerCase()
            );
            if (todayDay && !todayDay.restDay && todayDay.exercises?.length > 0) {
              setTodayWorkout({
                id: plan.id,
                name: plan.name || 'Today\'s Workout',
                estimatedMinutes: plan.estimatedMinutes || 45,
                exercises: todayDay.exercises.map(ex => ({
                  id: ex.id || ex.name,
                  name: ex.name,
                  sets: ex.mainSets || 3,
                  reps: ex.mainReps || 10,
                  rest: ex.mainRestSeconds || 60,
                  note: ex.notes || '',
                  muscleGroup: ex.muscleGroup || '',
                })),
                dayLabel: todayLabel,
              });
            } else if (todayDay?.restDay) {
              setTodayWorkout({ id: 'rest', name: 'Rest Day', isRestDay: true, exercises: [] });
            } else {
              setTodayWorkout(null);
            }
          } else {
            setTodayWorkout(null);
          }
        } catch (e) { console.log('Plan fetch error:', e); setTodayWorkout(null); }
      } else {
        setTodayWorkout(null);
      }
    });
    return () => unsub();
  }, [member?.gymId, member?.trainerId, uid]);`;

if (code.includes(OLD_WORKOUT_EFFECT)) {
  code = code.replace(OLD_WORKOUT_EFFECT, NEW_WORKOUT_EFFECT);
  console.log('✓ Fix 1: Workout sync now reads from clientPlans');
  fixes++;
} else {
  console.log('⚠ Fix 1: Workout effect pattern not found — check manually');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Chat — remove orderBy that requires Firestore index
// ─────────────────────────────────────────────────────────────────────────────
// Fix in chat.service.ts (shared service)
const chatServicePath = './shared/services/chat.service.ts';
if (fs.existsSync(chatServicePath)) {
  let chatCode = fs.readFileSync(chatServicePath, 'utf8');
  
  const OLD_QUERY = `  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(messageLimit),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as ChatMessage));
  });`;
  
  const NEW_QUERY = `  // No orderBy — sort client-side to avoid requiring Firestore index
  const q = query(collection(db, 'chats', chatId, 'messages'));
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => d.data() as ChatMessage)
      .sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(msgs);
  });`;
  
  if (chatCode.includes(OLD_QUERY)) {
    chatCode = chatCode.replace(OLD_QUERY, NEW_QUERY);
    fs.writeFileSync(chatServicePath, chatCode);
    console.log('✓ Fix 2: Chat subscription no longer requires Firestore index');
    fixes++;
  } else {
    // Try simpler pattern
    chatCode = chatCode.replace(
      /orderBy\('createdAt', 'asc'\),\s*limit\([^)]+\),/g,
      '// sorted client-side'
    );
    chatCode = chatCode.replace(
      /callback\(snap\.docs\.map\(d => d\.data\(\) as ChatMessage\)\);/g,
      `const msgs = snap.docs.map(d => d.data() as ChatMessage)
      .sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(msgs);`
    );
    fs.writeFileSync(chatServicePath, chatCode);
    console.log('✓ Fix 2: Chat subscription fixed (alternate pattern)');
    fixes++;
  }
} else {
  console.log('⚠ Fix 2: chat.service.ts not found at', chatServicePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: Home — disable chat card when no trainer
// ─────────────────────────────────────────────────────────────────────────────
const OLD_TRAINER_CARD = `      <Text style={g.sec}>Your Trainer</Text>
      <TouchableOpacity style={hm.trainerCard} onPress={() => onNavigate('TrainerChat')}>
        <Text style={{ fontSize: 28 }}>🏋️</Text>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={hm.trainerCardTitle}>Chat with your trainer</Text>
          <Text style={hm.trainerCardSub}>Messages & voice notes</Text>
        </View>
        <View style={hm.onlineChip}><Text style={hm.onlineChipTxt}>● Online</Text></View>
      </TouchableOpacity>`;

const NEW_TRAINER_CARD = `      <Text style={g.sec}>Your Trainer</Text>
      {member?.trainerId ? (
        <TouchableOpacity style={hm.trainerCard} onPress={() => onNavigate('TrainerChat')}>
          <Text style={{ fontSize: 28 }}>🏋️</Text>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={hm.trainerCardTitle}>Chat with {member?.trainerName || 'your trainer'}</Text>
            <Text style={hm.trainerCardSub}>Messages, voice notes & images</Text>
          </View>
          <View style={hm.onlineChip}><Text style={hm.onlineChipTxt}>● Online</Text></View>
        </TouchableOpacity>
      ) : (
        <View style={[hm.trainerCard, { opacity: 0.45 }]}>
          <Text style={{ fontSize: 28 }}>🏋️</Text>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={hm.trainerCardTitle}>No trainer assigned yet</Text>
            <Text style={hm.trainerCardSub}>Accept a trainer invite in Profile</Text>
          </View>
        </View>
      )}`;

if (code.includes(OLD_TRAINER_CARD)) {
  code = code.replace(OLD_TRAINER_CARD, NEW_TRAINER_CARD);
  console.log('✓ Fix 3: Chat card disabled when no trainer');
  fixes++;
} else {
  console.log('⚠ Fix 3: Trainer card pattern not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4: Home + Profile — membership card logic
// ─────────────────────────────────────────────────────────────────────────────
// Replace the membership strip in HomeScreen
const OLD_MEMBERSHIP_STRIP = `      {member?.planEndDate > 0 && (
        <View style={[hm.memberStrip, { borderLeftColor: daysColor }]}>
          <View>
            <Text style={hm.memberPlan}>{member.plan || 'Membership'}</Text>
            <Text style={hm.memberSub}>Valid until {formatDate(member.planEndDate)}</Text>
          </View>
          <Text style={[hm.daysLeft, { color: daysColor }]}>{daysLeft}d</Text>
        </View>
      )}`;

const NEW_MEMBERSHIP_STRIP = `      {(member?.trainerId || member?.gymId) && member?.planEndDate > 0 && (
        <View>
          {member?.trainerId && (
            <View style={[hm.memberStrip, { borderLeftColor: daysColor }]}>
              <View>
                <Text style={hm.memberPlan}>
                  {member?.gymId ? '🏋️ Personal Training' : '🏋️ Training Plan'}
                </Text>
                <Text style={hm.memberSub}>Valid until {formatDate(member.planEndDate)}</Text>
              </View>
              <Text style={[hm.daysLeft, { color: daysColor }]}>{daysLeft}d</Text>
            </View>
          )}
          {member?.gymId && !member?.trainerId && (
            <View style={[hm.memberStrip, { borderLeftColor: C.primary }]}>
              <View>
                <Text style={hm.memberPlan}>🏛 Gym Membership</Text>
                <Text style={hm.memberSub}>Valid until {formatDate(member.planEndDate)}</Text>
              </View>
              <Text style={[hm.daysLeft, { color: C.primary }]}>{daysLeft}d</Text>
            </View>
          )}
        </View>
      )}`;

if (code.includes(OLD_MEMBERSHIP_STRIP)) {
  code = code.replace(OLD_MEMBERSHIP_STRIP, NEW_MEMBERSHIP_STRIP);
  console.log('✓ Fix 4: Membership card shows correct info based on gym/trainer status');
  fixes++;
} else {
  console.log('⚠ Fix 4: Membership strip pattern not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5: Profile membership card — same logic
// ─────────────────────────────────────────────────────────────────────────────
const OLD_PROFILE_MEMBERSHIP = `      {member?.planEndDate > 0 && (
        <>
          <Text style={g.sec}>Membership</Text>
          <View style={pf.memberCard}>
            <Text style={pf.planName}>{member.plan || 'Active Plan'}</Text>
            <Text style={pf.planSub}>Valid until {formatDate(member.planEndDate)} · {daysLeft} days left</Text>
          </View>
        </>
      )}`;

const NEW_PROFILE_MEMBERSHIP = `      {(member?.trainerId || member?.gymId) && member?.planEndDate > 0 && (
        <>
          <Text style={g.sec}>Membership</Text>
          {member?.trainerId && (
            <View style={pf.memberCard}>
              <Text style={pf.planName}>
                {member?.gymId ? '🏋️ Personal Training' : '🏋️ Training Plan'}
              </Text>
              <Text style={pf.planSub}>Valid until {formatDate(member.planEndDate)} · {daysLeft} days left</Text>
            </View>
          )}
          {member?.gymId && !member?.trainerId && (
            <View style={pf.memberCard}>
              <Text style={pf.planName}>🏛 Gym Membership</Text>
              <Text style={pf.planSub}>Valid until {formatDate(member.planEndDate)} · {daysLeft} days left</Text>
            </View>
          )}
        </>
      )}`;

if (code.includes(OLD_PROFILE_MEMBERSHIP)) {
  code = code.replace(OLD_PROFILE_MEMBERSHIP, NEW_PROFILE_MEMBERSHIP);
  console.log('✓ Fix 5: Profile membership card updated');
  fixes++;
} else {
  console.log('⚠ Fix 5: Profile membership pattern not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 6: Remove Trainer — clear chat flag too
// ─────────────────────────────────────────────────────────────────────────────
const OLD_REMOVE_TRAINER = `              await updateDoc(doc(db, 'members', member.id), {
                trainerId: null,
                trainerName: null,
                gymId: null,
                currentPlanId: null,
                currentPlanName: null,
                removedTrainerAt: Date.now(),
              });`;

const NEW_REMOVE_TRAINER = `              await updateDoc(doc(db, 'members', member.id), {
                trainerId: null,
                trainerName: null,
                gymId: null,
                currentPlanId: null,
                currentPlanName: null,
                planEndDate: 0,
                removedTrainerAt: Date.now(),
              });`;

if (code.includes(OLD_REMOVE_TRAINER)) {
  code = code.replace(OLD_REMOVE_TRAINER, NEW_REMOVE_TRAINER);
  console.log('✓ Fix 6: Remove trainer also clears planEndDate');
  fixes++;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 7: Home workout card — handle rest day and real data
// ─────────────────────────────────────────────────────────────────────────────
// The HomeScreen currently shows todayWorkout which now comes from clientPlans
// Make sure it handles the restDay case
const OLD_HOME_WORKOUT = `      {todayWorkout ? (
        <TouchableOpacity style={hm.workoutCard} onPress={() => onNavigate('Workouts')}>
          <View style={hm.workoutTop}>
            <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
            <Text style={hm.workoutTime}>⏱ {todayWorkout.estimatedMinutes} min</Text>
          </View>
          <Text style={hm.workoutName}>{todayWorkout.name}</Text>
          {workoutTimer?.running && (
            <View style={hm.timerPill}>
              <Text style={hm.timerPillTxt}>⏱ {formatElapsed(workoutTimer.elapsed)} · In progress</Text>
            </View>
          )}
          {workoutTimer?.completed && (
            <View style={[hm.timerPill, { backgroundColor: 'rgba(16,185,129,0.25)' }]}>
              <Text style={hm.timerPillTxt}>✅ Done in {formatElapsed(workoutTimer.elapsed)}</Text>
            </View>
          )}
          <Text style={hm.workoutSub}>
            {todayWorkout.exercises?.length || 0} exercises · Assigned by {member?.trainer || 'your trainer'}
          </Text>
          <View style={hm.startBtn}>
            <Text style={hm.startBtnTxt}>
              {workoutTimer?.running || workoutTimer?.completed ? 'View Details →' : 'Start Workout →'}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[hm.workoutCard, { opacity: 0.7 }]}>
          <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
          <Text style={hm.workoutName}>No workout assigned yet</Text>
          <Text style={hm.workoutSub}>Your trainer will assign a workout soon</Text>
        </View>
      )}`;

const NEW_HOME_WORKOUT = `      {todayWorkout?.isRestDay ? (
        <View style={[hm.workoutCard, { backgroundColor: '#374151' }]}>
          <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
          <Text style={hm.workoutName}>😴 Rest Day</Text>
          <Text style={hm.workoutSub}>Recovery is part of progress. Take it easy today.</Text>
        </View>
      ) : todayWorkout ? (
        <TouchableOpacity style={hm.workoutCard} onPress={() => onNavigate('Workouts')}>
          <View style={hm.workoutTop}>
            <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
            <Text style={hm.workoutTime}>⏱ {todayWorkout.estimatedMinutes || '—'} min</Text>
          </View>
          <Text style={hm.workoutName}>{todayWorkout.name}</Text>
          {workoutTimer?.running && (
            <View style={hm.timerPill}>
              <Text style={hm.timerPillTxt}>⏱ {formatElapsed(workoutTimer.elapsed)} · In progress</Text>
            </View>
          )}
          {workoutTimer?.completed && (
            <View style={[hm.timerPill, { backgroundColor: 'rgba(16,185,129,0.25)' }]}>
              <Text style={hm.timerPillTxt}>✅ Done in {formatElapsed(workoutTimer.elapsed)}</Text>
            </View>
          )}
          <Text style={hm.workoutSub}>
            {todayWorkout.exercises?.length || 0} exercises · Assigned by {member?.trainerName || member?.trainer || 'your trainer'}
          </Text>
          <View style={hm.startBtn}>
            <Text style={hm.startBtnTxt}>
              {workoutTimer?.running || workoutTimer?.completed ? 'View Details →' : 'Start Workout →'}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[hm.workoutCard, { opacity: 0.7 }]}>
          <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
          <Text style={hm.workoutName}>{member?.trainerId ? 'No workout for today' : 'No trainer assigned'}</Text>
          <Text style={hm.workoutSub}>{member?.trainerId ? 'Check back later' : 'Accept a trainer invite in Profile'}</Text>
        </View>
      )}`;

if (code.includes(OLD_HOME_WORKOUT)) {
  code = code.replace(OLD_HOME_WORKOUT, NEW_HOME_WORKOUT);
  console.log('✓ Fix 7: Home workout card handles rest day and real trainer name');
  fixes++;
} else {
  console.log('⚠ Fix 7: Home workout card pattern not found');
}

fs.writeFileSync(appPath, code);
console.log(`\n✅ Applied ${fixes}/7 fixes to App.js`);
console.log('Run: npx expo start --clear');
