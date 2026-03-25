// ── LOGGING VIEW ─────────────────────────────────────────
// The detailed workout logging screen shown when a user taps "Start Workout".
// Handles per-set logging, rest timers, weights, and workout completion.
//
// Props:
//   exercises            – array of exercise objects for the day
//   onBack               – function to go back to WorkoutsScreen
//   memberName           – first name of the member (for the finish card)
//   workoutTimer         – { running, elapsed, completed }
//   stopWorkoutTimer     – function(elapsed) to stop the global timer
//   doneSets             – object of completed sets from parent state
//   setDoneSetsExternal  – updates parent's doneSets state
//   setWeightsExternal   – current set weights from parent
//   setSetWeightsExternal– updates parent's setWeights state

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import C from '../constants/colors';
import { formatElapsed, formatRest } from '../utils/formatters';
import { TODAY_WORKOUT } from '../constants/data';
import STORAGE_KEYS from '../constants/storageKeys';
import ExerciseVideo from './ExerciseVideo';

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
  const [expanded, setExpanded]     = useState(null);
  const [setWeights, setSetWeights] = useState(setWeightsExternal || {});
  const [lastWeights, setLastWeights] = useState({});
  const [doneSets, setDoneSets]     = useState(doneSetsExternal || {});
  const [restTimers, setRestTimers] = useState({});
  const [allDone, setAllDone]       = useState(false);
  const restIntervals               = useRef({});

  useEffect(() => {
    return () => { Object.values(restIntervals.current).forEach(clearInterval); };
  }, []);

  // Load historical weights from storage
  useEffect(() => {
    const load = async () => {
      const stored = {};
      for (const ex of exercises) {
        for (let s = 1; s <= ex.sets; s++) {
          const key = `lift_w_${ex.id}_s${s}`;
          try {
            const val = await AsyncStorage.getItem(key);
            if (val) stored[`${ex.id}_${s}`] = val;
          } catch (_) {}
        }
      }
      setLastWeights(stored);
    };
    load();
  }, []);

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

  const adjustRest = (stateKey, delta) => {
    setRestTimers(prev => ({
      ...prev,
      [stateKey]: Math.max(10, (prev[stateKey] ?? 60) + delta),
    }));
  };

  const markSetDone = async (exId, setNo, defaultRest, totalSets) => {
    const stateKey = `${exId}_${setNo}`;
    const val = setWeights[stateKey];
    if (val) {
      try { await AsyncStorage.setItem(`lift_w_${exId}_s${setNo}`, val); } catch (_) {}
    }
    const newDone = { ...doneSets, [stateKey]: true };
    setDoneSets(newDone);
    setDoneSetsExternal(newDone);

    // Clear all running rest timers before starting the new one
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

  const allSetsOf = (ex) =>
    Array.from({ length: ex.sets }, (_, i) => `${ex.id}_${i + 1}`).every(k => doneSets[k]);

  const doneCount   = exercises.filter(ex => allSetsOf(ex)).length;
  const elapsed     = workoutTimer?.elapsed || 0;
  const elapsedColor = allDone ? C.green : elapsed > 3600 ? C.red : elapsed > 1800 ? C.amber : C.green;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={s.logHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color: C.primary, fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.logTitle}>Workout Log</Text>
          <Text style={[s.globalTimer, { color: elapsedColor }]}>
            {allDone ? '✅ ' : '⏱ '}{formatElapsed(elapsed)}
          </Text>
        </View>
        <Text style={s.logCount}>{doneCount}/{exercises.length}</Text>
      </View>

      <ScrollView style={{ padding: 16 }}>
        {exercises.map((ex) => {
          const isOpen = expanded === ex.id;
          const isDone = allSetsOf(ex);

          return (
            <View key={ex.id} style={[s.exWrap, isDone && s.exWrapDone]}>
              <TouchableOpacity
                style={s.exHeader}
                onPress={() => setExpanded(isOpen ? null : ex.id)}>
                <View style={[s.exCheck, isDone && s.exCheckDone]}>
                  <Text style={{ color: isDone ? '#fff' : C.mid }}>{isDone ? '✓' : ''}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.exName, isDone && { color: C.mid }]}>{ex.name}</Text>
                  <Text style={s.exMeta}>{ex.sets} sets × {ex.reps} reps · Rest {ex.rest}s</Text>
                </View>
                <Text style={{ color: C.mid, fontSize: 13 }}>{isOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={s.setsContainer}>
                  <ExerciseVideo uri={ex.videoUri} exerciseName={ex.name} />

                  {Array.from({ length: ex.sets }, (_, i) => {
                    const setNo    = i + 1;
                    const stateKey = `${ex.id}_${setNo}`;
                    const isDoneSet = doneSets[stateKey];
                    const lastW    = lastWeights[stateKey];
                    const restLeft = restTimers[stateKey];
                    const restColor = restLeft !== undefined
                      ? (restLeft < 20 ? C.red : restLeft < 40 ? C.amber : C.green)
                      : C.green;

                    return (
                      <View key={setNo}>
                        {/* Set Row */}
                        <View style={[s.setRow, isDoneSet && s.setRowDone]}>
                          <View style={s.setNumBadge}>
                            <Text style={s.setNumTxt}>S{setNo}</Text>
                          </View>
                          <View style={s.repsBox}>
                            <Text style={s.repsVal}>{ex.reps}</Text>
                            <Text style={s.repsLbl}>reps</Text>
                          </View>
                          <View style={s.lastBox}>
                            <Text style={s.lastVal}>{lastW || '—'}</Text>
                            <Text style={s.lastLbl}>last</Text>
                          </View>
                          <TextInput
                            style={[s.weightInput, isDoneSet && { opacity: 0.5 }]}
                            placeholder={lastW || '0'}
                            placeholderTextColor={C.mid}
                            keyboardType="decimal-pad"
                            value={setWeights[stateKey] || ''}
                            editable={!isDoneSet}
                            onChangeText={val => {
                              const updated = { ...setWeights, [stateKey]: val };
                              setSetWeights(updated);
                              setSetWeightsExternal(updated);
                            }}
                          />
                          <Text style={s.kgLbl}>kg</Text>
                          {!isDoneSet ? (
                            <TouchableOpacity
                              style={s.doneBtn}
                              onPress={() => markSetDone(ex.id, setNo, ex.rest, ex.sets)}>
                              <Text style={s.doneBtnTxt}>✓ Done</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={s.donedTag}>
                              <Text style={s.donedTxt}>✓</Text>
                            </View>
                          )}
                        </View>

                        {/* Rest Countdown */}
                        {isDoneSet && restLeft !== undefined && restLeft > 0 && (
                          <View style={s.restRow}>
                            <TouchableOpacity style={s.restAdjBtn} onPress={() => adjustRest(stateKey, -10)}>
                              <Text style={s.restAdjTxt}>−10s</Text>
                            </TouchableOpacity>
                            <View style={[s.restTimerBox, { borderColor: restColor, backgroundColor: restColor + '15' }]}>
                              <Text style={[s.restTimerTxt, { color: restColor }]}>
                                😮‍💨 Rest {formatRest(restLeft)}
                              </Text>
                            </View>
                            <TouchableOpacity style={s.restAdjBtn} onPress={() => adjustRest(stateKey, 10)}>
                              <Text style={s.restAdjTxt}>+10s</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {isDoneSet && restLeft === 0 && (
                          <View style={s.restDoneRow}>
                            <Text style={s.restDoneTxt}>✅ Rest complete · Start next set!</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {ex.note ? <Text style={s.trainerNote}>💬 "{ex.note}"</Text> : null}
                </View>
              )}
            </View>
          );
        })}

        {allDone && (
          <View style={s.finishCard}>
            <Text style={{ fontSize: 36 }}>🎉</Text>
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

const s = StyleSheet.create({
  logHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.light, backgroundColor: C.card },
  logTitle:     { fontSize: 15, fontWeight: '700', color: C.dark },
  globalTimer:  { fontSize: 16, fontWeight: '800', marginTop: 2 },
  logCount:     { fontSize: 14, fontWeight: '600', color: C.primary },
  exWrap:       { backgroundColor: C.card, borderRadius: 14, marginBottom: 12, overflow: 'hidden', elevation: 1, borderWidth: 1, borderColor: C.light },
  exWrapDone:   { borderColor: C.green },
  exHeader:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  exCheck:      { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.light, alignItems: 'center', justifyContent: 'center' },
  exCheckDone:  { backgroundColor: C.green, borderColor: C.green },
  exName:       { fontSize: 15, fontWeight: '700', color: C.dark },
  exMeta:       { fontSize: 12, color: C.mid, marginTop: 2 },
  setsContainer:{ borderTopWidth: 1, borderTopColor: C.light, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 12 },
  setRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.light, gap: 6 },
  setRowDone:   { backgroundColor: '#F0FDF4', marginHorizontal: -14, paddingHorizontal: 14 },
  setNumBadge:  { width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  setNumTxt:    { fontSize: 11, fontWeight: '700', color: C.primary },
  repsBox:      { alignItems: 'center', width: 34 },
  repsVal:      { fontSize: 14, fontWeight: '700', color: C.dark },
  repsLbl:      { fontSize: 9, color: C.mid },
  lastBox:      { alignItems: 'center', width: 40 },
  lastVal:      { fontSize: 12, fontWeight: '600', color: C.amber },
  lastLbl:      { fontSize: 9, color: C.mid },
  weightInput:  { flex: 1, backgroundColor: C.bg, borderRadius: 8, padding: 7, fontSize: 14, color: C.dark, borderWidth: 1, borderColor: C.light, textAlign: 'center' },
  kgLbl:        { fontSize: 11, color: C.mid, fontWeight: '600' },
  doneBtn:      { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  doneBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 11 },
  donedTag:     { width: 28, height: 28, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  donedTxt:     { color: '#fff', fontWeight: '800', fontSize: 13 },
  restRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 10, backgroundColor: '#F8FAFF', marginHorizontal: -14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.light },
  restAdjBtn:   { backgroundColor: C.light, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  restAdjTxt:   { fontSize: 13, color: C.dark, fontWeight: '700' },
  restTimerBox: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6, minWidth: 130, alignItems: 'center' },
  restTimerTxt: { fontSize: 16, fontWeight: '800' },
  restDoneRow:  { alignItems: 'center', paddingVertical: 8, backgroundColor: '#F0FDF4', marginHorizontal: -14, paddingHorizontal: 14 },
  restDoneTxt:  { fontSize: 13, color: C.green, fontWeight: '600' },
  trainerNote:  { fontSize: 12, color: C.primary, fontStyle: 'italic', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.light },
  finishCard:   { backgroundColor: '#F0FDF4', borderRadius: 18, padding: 32, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: C.green },
  finishTitle:  { fontSize: 22, fontWeight: '800', color: C.dark, marginTop: 10 },
  finishSub:    { fontSize: 14, color: C.mid, marginTop: 4, textAlign: 'center', lineHeight: 22 },
});