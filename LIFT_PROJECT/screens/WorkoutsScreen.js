// ── WORKOUTS SCREEN ──────────────────────────────────────
// Shows the weekly workout plan. User can tap a day to see
// that day's exercises. Tapping "Start Workout" opens LoggingView.
//
// Props:
//   member               – member data object
//   workoutTimer         – { running, elapsed, completed }
//   startWorkoutTimer    – function() to start the global timer
//   stopWorkoutTimer     – function(elapsed) to stop the global timer
//   workoutDoneSets      – object tracking which sets are completed
//   setWorkoutDoneSets   – updater for workoutDoneSets
//   workoutSetWeights    – object tracking set weights entered
//   setWorkoutSetWeights – updater for workoutSetWeights

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import C from '../constants/colors';
import g from '../styles/global';
import { formatElapsed } from '../utils/formatters';
import { TODAY_WORKOUT, WEEK } from '../constants/data';
import LoggingView from '../components/LoggingView';

export default function WorkoutsScreen({
  member,
  workoutTimer,
  startWorkoutTimer,
  stopWorkoutTimer,
  workoutDoneSets,
  setWorkoutDoneSets,
  workoutSetWeights,
  setWorkoutSetWeights,
}) {
  const [activeDay, setActiveDay] = useState(0);
  const [exercises]               = useState(TODAY_WORKOUT.exercises);
  const [logging, setLogging]     = useState(false);

  // Show the logging view when user starts or continues a workout
  if (logging) return (
    <LoggingView
      exercises={exercises}
      onBack={() => setLogging(false)}
      memberName={member.name.split(' ')[0]}
      workoutTimer={workoutTimer}
      stopWorkoutTimer={stopWorkoutTimer}
      doneSets={workoutDoneSets}
      setDoneSetsExternal={setWorkoutDoneSets}
      setWeightsExternal={workoutSetWeights}
      setSetWeightsExternal={setWorkoutSetWeights}
    />
  );

  return (
    <ScrollView style={g.screen}>
      <Text style={g.pageTitle}>🏋️ Workouts</Text>

      {/* ── Day Selector ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {WEEK.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[s.dayChip, i === activeDay && s.dayChipActive]}
            onPress={() => setActiveDay(i)}>
            <Text style={[s.dayLbl, i === activeDay && { color: '#fff' }]}>{d.day}</Text>
            {!d.rest && (
              <View style={[s.dot, i === activeDay && { backgroundColor: 'rgba(255,255,255,0.7)' }]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Rest Day Card ── */}
      {WEEK[activeDay].rest ? (
        <View style={s.restCard}>
          <Text style={{ fontSize: 36 }}>😴</Text>
          <Text style={s.restTitle}>Rest Day</Text>
          <Text style={s.restSub}>Recovery is part of training!</Text>
        </View>
      ) : (
        <>
          {/* ── Plan Header ── */}
          <View style={s.planHeader}>
            <Text style={s.planName}>
              {activeDay === 0 ? TODAY_WORKOUT.name : WEEK[activeDay].label}
            </Text>
            <Text style={s.planMeta}>
              {TODAY_WORKOUT.time} · {TODAY_WORKOUT.exercises.length} exercises
            </Text>

            {activeDay === 0 && workoutTimer?.running && (
              <View style={s.timerRunningTag}>
                <Text style={s.timerRunningTxt}>⏱ {formatElapsed(workoutTimer.elapsed)} · In progress</Text>
              </View>
            )}
            {activeDay === 0 && workoutTimer?.completed && (
              <View style={s.completedTag}>
                <Text style={s.completedTxt}>✅ Done in {formatElapsed(workoutTimer.elapsed)}</Text>
              </View>
            )}
          </View>

          {/* ── Exercise List ── */}
          {exercises.map(ex => (
            <View key={ex.id} style={s.exCardStatic}>
              <View style={s.exIcon}><Text style={{ fontSize: 18 }}>💪</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.exName}>{ex.name}</Text>
                <Text style={s.exDetail}>{ex.sets} sets × {ex.reps} reps · Rest {ex.rest}s</Text>
              </View>
            </View>
          ))}

          {/* ── Start / View Button ── */}
          <TouchableOpacity
            style={[s.startBtn, (workoutTimer?.running || workoutTimer?.completed) && s.viewDetailsBtn]}
            onPress={() => {
              if (!workoutTimer?.running && !workoutTimer?.completed) {
                startWorkoutTimer();
              }
              setLogging(true);
            }}>
            <Text style={s.startBtnTxt}>
              {workoutTimer?.running
                ? '👁  View Details'
                : workoutTimer?.completed
                ? '✅  View Details'
                : '▶  Start Workout'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  dayChip:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: C.card, marginRight: 8, alignItems: 'center', borderWidth: 1, borderColor: C.light },
  dayChipActive:  { backgroundColor: C.primary, borderColor: C.primary },
  dayLbl:         { fontSize: 13, fontWeight: '600', color: C.mid },
  dot:            { width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, marginTop: 4 },
  restCard:       { backgroundColor: C.card, borderRadius: 18, padding: 40, alignItems: 'center', elevation: 1 },
  restTitle:      { fontSize: 20, fontWeight: '700', color: C.dark, marginTop: 10 },
  restSub:        { fontSize: 14, color: C.mid, marginTop: 4 },
  planHeader:     { backgroundColor: C.blue2, borderRadius: 14, padding: 16, marginBottom: 14 },
  planName:       { fontSize: 20, fontWeight: '800', color: C.primary },
  planMeta:       { fontSize: 13, color: C.mid, marginTop: 4 },
  timerRunningTag:{ marginTop: 8, backgroundColor: '#DBEAFE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  timerRunningTxt:{ color: C.primary, fontSize: 12, fontWeight: '700' },
  completedTag:   { marginTop: 10, backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  completedTxt:   { color: C.green, fontSize: 12, fontWeight: '700' },
  exCardStatic:   { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  exIcon:         { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  exName:         { fontSize: 15, fontWeight: '600', color: C.dark },
  exDetail:       { fontSize: 12, color: C.mid, marginTop: 2 },
  startBtn:       { backgroundColor: C.primary, borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 8 },
  viewDetailsBtn: { backgroundColor: C.green },
  startBtnTxt:    { color: '#fff', fontWeight: '700', fontSize: 16 },
});