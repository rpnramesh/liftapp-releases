// ── LOGGING VIEW ─────────────────────────────────────────
// Minimal workout logging screen. Uses ExerciseCard for each exercise.
// Handles timer, set completion, rest timers, weight persistence.

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '../constants/colors';
import { formatElapsed } from '../utils/formatters';
import { TODAY_WORKOUT } from '../constants/data';
import STORAGE_KEYS from '../constants/storageKeys';
import ExerciseCard from './ExerciseCard';

export default function LoggingView({
  exercises,
  onBack,
  memberName,
  workoutTimer,
  stopWorkoutTimer,
  doneSets: doneSetsExternal,
  setDoneSetsExternal,
  setWeightsExternal,
  setSetWeightsExternal,
}) {
  const [expanded, setExpanded]       = useState(exercises[0]?.id ?? null);
  const [setWeights, setSetWeights]   = useState(setWeightsExternal || {});
  const [setReps, setSetReps]         = useState({});
  const [lastWeights, setLastWeights] = useState({});
  const [lastReps, setLastReps]       = useState({});
  const [doneSets, setDoneSets]       = useState(doneSetsExternal || {});
  const [restTimers, setRestTimers]   = useState({});
  const [allDone, setAllDone]         = useState(false);
  const restIntervals                 = useRef({});

  useEffect(() => {
    return () => { Object.values(restIntervals.current).forEach(clearInterval); };
  }, []);

  // Load last‑used weights and reps from storage
  useEffect(() => {
    const load = async () => {
      const storedW = {};
      const storedR = {};
      for (const ex of exercises) {
        for (let s = 1; s <= ex.sets; s++) {
          const wKey = `lift_w_${ex.id}_s${s}`;
          const rKey = `lift_r_${ex.id}_s${s}`;
          try {
            const wVal = await AsyncStorage.getItem(wKey);
            if (wVal) storedW[`${ex.id}_${s}`] = wVal;
            const rVal = await AsyncStorage.getItem(rKey);
            if (rVal) storedR[`${ex.id}_${s}`] = rVal;
          } catch (_) {}
        }
      }
      setLastWeights(storedW);
      setLastReps(storedR);
    };
    load();
  }, []);

  /* ── Rest timer helpers ── */
  const startRestTimer = (stateKey, defaultRest) => {
    if (restIntervals.current[stateKey]) clearInterval(restIntervals.current[stateKey]);
    setRestTimers(prev => ({ ...prev, [stateKey]: defaultRest }));
    restIntervals.current[stateKey] = setInterval(() => {
      setRestTimers(prev => {
        const cur = prev[stateKey];
        if (cur <= 1) {
          clearInterval(restIntervals.current[stateKey]);
          delete restIntervals.current[stateKey];
          return { ...prev, [stateKey]: 0 };
        }
        return { ...prev, [stateKey]: cur - 1 };
      });
    }, 1000);
  };

  /* ── Mark a set done ── */
  const markSetDone = async (exId, setNo, defaultRest, totalSets) => {
    const stateKey = `${exId}_${setNo}`;

    // Auto-save weight and reps to storage
    const wVal = setWeights[stateKey];
    const rVal = setReps[stateKey];
    try {
      if (wVal) await AsyncStorage.setItem(`lift_w_${exId}_s${setNo}`, wVal);
      if (rVal) await AsyncStorage.setItem(`lift_r_${exId}_s${setNo}`, rVal);
    } catch (_) {}

    const newDone = { ...doneSets, [stateKey]: true };
    setDoneSets(newDone);
    setDoneSetsExternal(newDone);

    // Clear existing rest timers
    Object.keys(restIntervals.current).forEach(key => {
      clearInterval(restIntervals.current[key]);
      delete restIntervals.current[key];
    });
    setRestTimers({});

    const allSetsOfThisExDone = Array.from(
      { length: totalSets }, (_, i) => `${exId}_${i + 1}`
    ).every(k => newDone[k]);

    if (!allSetsOfThisExDone) {
      startRestTimer(stateKey, defaultRest || 60);
    }

    // Auto-expand next incomplete exercise when current one completes
    if (allSetsOfThisExDone) {
      const nextEx = exercises.find(e =>
        e.id !== exId &&
        !Array.from({ length: e.sets }, (_, i) => `${e.id}_${i + 1}`).every(k => newDone[k])
      );
      if (nextEx) setExpanded(nextEx.id);
    }

    const isAllDone = exercises.every(ex =>
      Array.from({ length: ex.sets }, (_, i) => `${ex.id}_${i + 1}`).every(k => newDone[k])
    );

    if (isAllDone) {
      setAllDone(true);
      stopWorkoutTimer(workoutTimer?.elapsed || 0);
      try {
        const record = {
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          workoutName: TODAY_WORKOUT.name,
          duration: workoutTimer?.elapsed || 0,
          exercises: exercises.map(ex => ({
            name: ex.name,
            sets: Array.from({ length: ex.sets }, (_, i) => ({
              setNo: i + 1,
              reps: parseInt(setReps[`${ex.id}_${i + 1}`], 10) || ex.reps || 0,
              weight: setWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0',
            })),
          })),
        };
        const existing = await AsyncStorage.getItem(STORAGE_KEYS.workoutRecords);
        const records  = existing ? JSON.parse(existing) : [];
        records.push(record);
        await AsyncStorage.setItem(STORAGE_KEYS.workoutRecords, JSON.stringify(records));
      } catch (_) {}
    }
  };

  /* ── Weight change handler ── */
  const handleWeightChange = (stateKey, val) => {
    const updated = { ...setWeights, [stateKey]: val };
    setSetWeights(updated);
    setSetWeightsExternal(updated);
  };

  /* ── Reps change handler ── */
  const handleRepsChange = (stateKey, val) => {
    setSetReps(prev => ({ ...prev, [stateKey]: val }));
  };

  /* ── Derived ── */
  const allSetsOf = (ex) =>
    Array.from({ length: ex.sets }, (_, i) => `${ex.id}_${i + 1}`).every(k => doneSets[k]);

  const doneCount    = exercises.filter(allSetsOf).length;
  const elapsed      = workoutTimer?.elapsed || 0;
  const elapsedColor = allDone ? C.green : elapsed > 3600 ? C.red : elapsed > 1800 ? C.amber : C.green;

  return (
    <SafeAreaView style={s.safe}>

      {/* ══════════ HEADER ══════════ */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{TODAY_WORKOUT.name}</Text>
          <Text style={[s.timerTxt, { color: elapsedColor }]}>
            {formatElapsed(elapsed)}
          </Text>
        </View>
        <View style={s.countBadge}>
          <Text style={s.countTxt}>{doneCount}/{exercises.length}</Text>
        </View>
      </View>

      {/* ══════════ EXERCISE LIST ══════════ */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {exercises.map(ex => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            isExpanded={expanded === ex.id}
            onToggle={() => setExpanded(expanded === ex.id ? null : ex.id)}
            doneSets={doneSets}
            setWeights={setWeights}
            setReps={setReps}
            lastWeights={lastWeights}
            lastReps={lastReps}
            restTimers={restTimers}
            onWeightChange={handleWeightChange}
            onRepsChange={handleRepsChange}
            onMarkDone={markSetDone}
          />
        ))}

        {/* ── Workout Complete Card ── */}
        {allDone && (
          <View style={s.finishCard}>
            <Text style={s.finishEmoji}>🎉</Text>
            <Text style={s.finishTitle}>Workout Complete!</Text>
            <Text style={s.finishSub}>
              Great job, {memberName}!{'\n'}Total time: {formatElapsed(elapsed)}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  android: { elevation: 1 },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },

  /* Header */
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.light, ...shadow },
  backTxt:      { fontSize: 15, fontWeight: '600', color: C.primary },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: C.dark, letterSpacing: -0.3 },
  timerTxt:     { fontSize: 17, fontWeight: '800', marginTop: 2 },
  countBadge:   { backgroundColor: C.blue2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  countTxt:     { fontSize: 13, fontWeight: '700', color: C.primary },

  /* Scroll */
  scroll:        { flex: 1 },
  scrollContent: { padding: 20 },

  /* Finish */
  finishCard:   { backgroundColor: '#F0FDF4', borderRadius: 20, padding: 36, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: C.green + '30' },
  finishEmoji:  { fontSize: 36 },
  finishTitle:  { fontSize: 22, fontWeight: '800', color: C.dark, marginTop: 12 },
  finishSub:    { fontSize: 14, color: C.mid, marginTop: 6, textAlign: 'center', lineHeight: 22 },
});