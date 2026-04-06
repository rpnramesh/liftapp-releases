// ── WORKOUTS SCREEN ──────────────────────────────────────
// Clean, premium workout overview — header, week nav, exercise
// list, and start button. Opens LoggingView on start.

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Platform,
} from 'react-native';
import C from '../constants/colors';
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
  const todayIndex = useMemo(() => new Date().getDay(), []);
  const [activeDay, setActiveDay] = useState(todayIndex);
  const [exercises]               = useState(TODAY_WORKOUT.exercises);
  const [logging, setLogging]     = useState(false);

  const weekDates = useMemo(() => {
    const today = new Date();
    const dow   = today.getDay();
    return WEEK.map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - dow + i);
      return {
        date:  d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
      };
    });
  }, []);

  const allSetsOf   = (ex) =>
    Array.from({ length: ex.sets }, (_, i) => `${ex.id}_${i + 1}`)
      .every(k => workoutDoneSets?.[k]);
  const doneExCount = exercises.filter(allSetsOf).length;

  const elapsed     = workoutTimer?.elapsed || 0;
  const isRunning   = workoutTimer?.running;
  const isCompleted = workoutTimer?.completed;
  const isRest      = WEEK[activeDay]?.rest;

  const workoutName = activeDay === todayIndex
    ? TODAY_WORKOUT.name
    : WEEK[activeDay]?.label || TODAY_WORKOUT.name;

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
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ═══ HEADER ═══ */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{workoutName}</Text>
            <Text style={s.subtitle}>7 day plan · Assigned by your trainer</Text>
          </View>
          <View style={s.headerRight}>
            {(isRunning || isCompleted) ? (
              <View style={s.timerPill}>
                <View style={[s.timerDot, isCompleted && { backgroundColor: C.green }]} />
                <Text style={[s.timerVal, isCompleted && { color: C.green }]}>
                  {formatElapsed(elapsed)}
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={s.historyBtn} activeOpacity={0.7}>
                <Text style={s.historyTxt}>History</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ═══ THIS WEEK ═══ */}
        <Text style={s.sectionLabel}>THIS WEEK</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.weekRow}
        >
          {WEEK.map((d, i) => {
            const isActive = i === activeDay;
            const wd       = weekDates[i];
            return (
              <TouchableOpacity
                key={i}
                style={[s.weekCard, isActive && s.weekCardActive]}
                onPress={() => setActiveDay(i)}
                activeOpacity={0.7}
              >
                <Text style={[s.weekDay, isActive && s.weekTxtW]}>{d.day}</Text>
                <Text style={[s.weekDate, isActive && s.weekTxtW]}>
                  {wd.date} {wd.month}
                </Text>
                {isActive && !d.rest && <View style={s.weekDot} />}
                <Text style={[s.weekLabel, isActive && { color: 'rgba(255,255,255,0.8)' }]}>
                  {d.rest ? 'Rest' : d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ═══ BODY ═══ */}
        {isRest ? (
          <View style={s.restCard}>
            <Text style={{ fontSize: 32 }}>😴</Text>
            <Text style={s.restTitle}>Rest Day</Text>
            <Text style={s.restSub}>Recovery is part of training</Text>
          </View>
        ) : (
          <>
            {/* Section header */}
            <View style={s.todayRow}>
              <Text style={s.todayLabel}>TODAY — {workoutName.toUpperCase()}</Text>
              <Text style={s.doneTxt}>{doneExCount}/{exercises.length} done</Text>
            </View>

            {/* Exercise list */}
            {exercises.map(ex => {
              const hasReps = ex.reps && ex.reps > 0;
              const isDone  = allSetsOf(ex);
              return (
                <View key={ex.id} style={[s.exCard, isDone && s.exCardDone]}>
                  <View style={[s.exIcon, isDone && s.exIconDone]}>
                    {isDone
                      ? <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>✓</Text>
                      : <Text style={{ fontSize: 18 }}>🏋️</Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.exName, isDone && s.exNameDone]}>{ex.name}</Text>
                    <Text style={s.exMeta}>
                      {hasReps
                        ? `${ex.sets} sets × ${ex.reps} reps · ${ex.rest}s rest`
                        : `${ex.sets} sets · General`
                      }
                    </Text>
                  </View>
                  <Text style={s.chevron}>›</Text>
                </View>
              );
            })}

            {/* Start / Continue */}
            <TouchableOpacity
              style={[s.startBtn, (isRunning || isCompleted) && s.greenBtn]}
              activeOpacity={0.8}
              onPress={() => {
                if (!isRunning && !isCompleted) startWorkoutTimer();
                setLogging(true);
              }}
            >
              <Text style={s.startBtnTxt}>
                {isRunning ? 'Continue Workout' : isCompleted ? 'View Summary' : 'Start Workout'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  android: { elevation: 1 },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1, paddingHorizontal: 20 },

  /* Header */
  header:      { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 16, paddingBottom: 4 },
  title:       { fontSize: 28, fontWeight: '800', color: C.dark, letterSpacing: -0.5 },
  subtitle:    { fontSize: 13, color: C.mid, marginTop: 5, lineHeight: 18 },
  headerRight: { marginLeft: 16, paddingTop: 4 },
  timerPill:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, ...shadow, borderWidth: 1, borderColor: C.light },
  timerDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  timerVal:    { fontSize: 15, fontWeight: '800', color: C.green },
  historyBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.primary + '30' },
  historyTxt:  { fontSize: 13, fontWeight: '600', color: C.primary },

  /* Section */
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.mid, letterSpacing: 1.2, marginTop: 28, marginBottom: 14 },

  /* Week */
  weekRow:        { paddingBottom: 4 },
  weekCard:       { width: 80, paddingVertical: 14, borderRadius: 16, backgroundColor: C.card, marginRight: 10, alignItems: 'center', borderWidth: 1, borderColor: C.light, ...shadow },
  weekCardActive: { backgroundColor: C.primary, borderColor: C.primary },
  weekDay:        { fontSize: 11, fontWeight: '600', color: C.mid, letterSpacing: 0.5 },
  weekDate:       { fontSize: 14, fontWeight: '700', color: C.dark, marginTop: 4 },
  weekTxtW:       { color: '#fff' },
  weekDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff', marginTop: 8 },
  weekLabel:      { fontSize: 10, fontWeight: '600', color: C.mid, marginTop: 6 },

  /* Today */
  todayRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 16 },
  todayLabel: { fontSize: 12, fontWeight: '700', color: C.mid, letterSpacing: 0.5 },
  doneTxt:    { fontSize: 12, fontWeight: '700', color: C.primary },

  /* Rest */
  restCard:  { backgroundColor: C.card, borderRadius: 20, padding: 40, alignItems: 'center', marginTop: 24, ...shadow },
  restTitle: { fontSize: 20, fontWeight: '700', color: C.dark, marginTop: 12 },
  restSub:   { fontSize: 14, color: C.mid, marginTop: 4 },

  /* Exercises */
  exCard:     { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: C.light, ...shadow },
  exCardDone: { borderColor: C.green + '40' },
  exIcon:     { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  exIconDone: { backgroundColor: C.green },
  exName:     { fontSize: 16, fontWeight: '600', color: C.dark },
  exNameDone: { color: C.mid, textDecorationLine: 'line-through' },
  exMeta:     { fontSize: 12, color: C.mid, marginTop: 3 },
  chevron:    { fontSize: 20, color: C.light, fontWeight: '300' },

  /* Button */
  startBtn:    { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  greenBtn:    { backgroundColor: C.green },
  startBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
});