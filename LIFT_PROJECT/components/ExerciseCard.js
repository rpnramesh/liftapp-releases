// ── EXERCISE CARD ────────────────────────────────────────
// Clean, minimal exercise logging card with:
//   - Collapsible header with completion state
//   - Per-set rows: editable reps (±1), weight input, last best, Done button
//   - Scale animation on set completion
//   - Inline rest timer

import React, { useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Platform, Animated,
} from 'react-native';
import C from '../constants/colors';
import { formatRest } from '../utils/formatters';

const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  android: { elevation: 2 },
});

/* ── Single Set Row ── */
function SetRow({
  exerciseId,
  setNo,
  targetReps,
  currentReps,
  isDone,
  weight,
  lastWeight,
  lastReps,
  restLeft,
  onWeightChange,
  onRepsChange,
  onMarkDone,
  defaultRest,
  totalSets,
}) {
  const stateKey  = `${exerciseId}_${setNo}`;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleDone = useCallback(() => {
    // Pop animation
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.08, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onMarkDone(exerciseId, setNo, defaultRest, totalSets);
  }, [exerciseId, setNo, defaultRest, totalSets, onMarkDone, scaleAnim]);

  const adjustReps = useCallback((delta) => {
    const current = parseInt(currentReps, 10) || targetReps || 0;
    const next = Math.max(0, current + delta);
    onRepsChange(stateKey, String(next));
  }, [currentReps, targetReps, stateKey, onRepsChange]);

  const hasLast = lastWeight || lastReps;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <View style={[sr.row, isDone && sr.rowDone]}>
        {/* Set badge */}
        <View style={[sr.badge, isDone && sr.badgeDone]}>
          <Text style={[sr.badgeTxt, isDone && sr.badgeTxtDone]}>S{setNo}</Text>
        </View>

        {/* Reps cluster: -1 [input] +1 */}
        <View style={sr.repsCluster}>
          {!isDone && (
            <TouchableOpacity
              style={sr.adjBtn}
              onPress={() => adjustReps(-1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={sr.adjTxt}>−</Text>
            </TouchableOpacity>
          )}
          <TextInput
            style={[sr.repsInput, isDone && sr.inputDone]}
            keyboardType="number-pad"
            value={currentReps || String(targetReps || '')}
            editable={!isDone}
            onChangeText={val => onRepsChange(stateKey, val)}
            selectTextOnFocus
          />
          {!isDone && (
            <TouchableOpacity
              style={sr.adjBtn}
              onPress={() => adjustReps(1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={sr.adjTxt}>+</Text>
            </TouchableOpacity>
          )}
          {!isDone && <Text style={sr.unitLbl}>reps</Text>}
        </View>

        {/* Weight input */}
        <View style={sr.weightCluster}>
          <TextInput
            style={[sr.weightInput, isDone && sr.inputDone]}
            placeholder={lastWeight || '0'}
            placeholderTextColor={C.mid + '60'}
            keyboardType="decimal-pad"
            value={weight || ''}
            editable={!isDone}
            onChangeText={val => onWeightChange(stateKey, val)}
            selectTextOnFocus
          />
          <Text style={sr.kgLbl}>kg</Text>
        </View>

        {/* Done / check */}
        {!isDone ? (
          <TouchableOpacity style={sr.doneBtn} activeOpacity={0.7} onPress={handleDone}>
            <Text style={sr.doneTxt}>Done</Text>
          </TouchableOpacity>
        ) : (
          <View style={sr.checkCircle}>
            <Text style={sr.checkTxt}>✓</Text>
          </View>
        )}
      </View>

      {/* Last best — shown below the row, very subtle */}
      {!isDone && hasLast && (
        <Text style={sr.lastHint}>
          Last: {lastReps || targetReps} reps @ {lastWeight || '–'}kg
        </Text>
      )}

      {/* Rest timer */}
      {isDone && restLeft !== undefined && restLeft > 0 && (
        <View style={sr.restBar}>
          <View style={sr.restPill}>
            <Text style={sr.restTxt}>Rest {formatRest(restLeft)}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const sr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  rowDone:   { opacity: 0.55 },

  badge:        { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.light },
  badgeDone:    { backgroundColor: C.green + '18', borderColor: C.green + '60' },
  badgeTxt:     { fontSize: 12, fontWeight: '800', color: C.primary },
  badgeTxtDone: { color: C.green },

  /* Reps */
  repsCluster: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adjBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.light },
  adjTxt:      { fontSize: 16, fontWeight: '700', color: C.dark, marginTop: -1 },
  repsInput:   { width: 44, height: 40, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.light, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.dark, paddingVertical: 0 },
  unitLbl:     { fontSize: 11, color: C.mid, fontWeight: '600', marginLeft: 2 },

  /* Weight */
  weightCluster: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  weightInput:   { flex: 1, height: 40, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.light, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.dark, paddingVertical: 0 },
  kgLbl:         { fontSize: 12, fontWeight: '600', color: C.mid },
  inputDone:     { backgroundColor: C.bg, borderColor: C.light + '60', color: C.mid },

  /* Done */
  doneBtn:     { width: 56, height: 40, borderRadius: 10, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  doneTxt:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.green + '18', alignItems: 'center', justifyContent: 'center' },
  checkTxt:    { color: C.green, fontWeight: '800', fontSize: 16 },

  /* Last hint */
  lastHint: { fontSize: 11, color: C.mid + '90', marginLeft: 42, marginTop: -4, marginBottom: 4 },

  /* Rest */
  restBar:  { alignItems: 'center', paddingTop: 4, paddingBottom: 6 },
  restPill: { backgroundColor: C.primary + '10', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5 },
  restTxt:  { fontSize: 13, fontWeight: '700', color: C.primary },
});


/* ── Main ExerciseCard ── */
export default function ExerciseCard({
  exercise,
  isExpanded,
  onToggle,
  doneSets,
  setWeights,
  setReps,
  lastWeights,
  lastReps,
  restTimers,
  onWeightChange,
  onRepsChange,
  onMarkDone,
}) {
  const ex        = exercise;
  const totalSets = ex.sets;
  const hasReps   = ex.reps && ex.reps > 0;

  const allDone = Array.from({ length: totalSets }, (_, i) => `${ex.id}_${i + 1}`)
    .every(k => doneSets[k]);

  const doneSetsCount = Array.from({ length: totalSets }, (_, i) => `${ex.id}_${i + 1}`)
    .filter(k => doneSets[k]).length;

  // Best from last session (highest weight across all sets)
  const bestLast = (() => {
    let best = null;
    for (let i = 1; i <= totalSets; i++) {
      const w = parseFloat(lastWeights[`${ex.id}_${i}`]);
      if (w && (!best || w > best.weight)) {
        best = { weight: w, reps: lastReps?.[`${ex.id}_${i}`] || ex.reps };
      }
    }
    return best;
  })();

  return (
    <View style={[s.card, allDone && s.cardDone]}>
      {/* ── Header ── */}
      <TouchableOpacity style={s.header} onPress={onToggle} activeOpacity={0.7}>
        <View style={s.headerLeft}>
          <View style={[s.iconCircle, allDone && s.iconCircleDone]}>
            {allDone
              ? <Text style={s.iconCheck}>✓</Text>
              : <Text style={s.iconEmoji}>🏋️</Text>
            }
          </View>
          <View style={s.headerText}>
            <Text style={[s.exName, allDone && s.exNameDone]}>{ex.name}</Text>
            <Text style={s.exScheme}>
              {hasReps
                ? `${totalSets} sets × ${ex.reps} reps · ${ex.rest}s rest`
                : `${totalSets} sets · General`
              }
            </Text>
          </View>
        </View>
        <View style={s.headerRight}>
          {doneSetsCount > 0 && !allDone && (
            <Text style={s.progressTxt}>{doneSetsCount}/{totalSets}</Text>
          )}
          <Text style={s.chevron}>{isExpanded ? '⌃' : '⌄'}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Last best hint ── */}
      {isExpanded && bestLast && !allDone && (
        <Text style={s.bestHint}>
          Previous best: {bestLast.reps} reps @ {bestLast.weight}kg
        </Text>
      )}

      {/* ── Set Rows ── */}
      {isExpanded && (
        <View style={s.setsArea}>
          {Array.from({ length: totalSets }, (_, i) => {
            const setNo    = i + 1;
            const stateKey = `${ex.id}_${setNo}`;
            return (
              <SetRow
                key={setNo}
                exerciseId={ex.id}
                setNo={setNo}
                targetReps={hasReps ? ex.reps : null}
                currentReps={setReps?.[stateKey] || ''}
                isDone={!!doneSets[stateKey]}
                weight={setWeights[stateKey] || ''}
                lastWeight={lastWeights[stateKey]}
                lastReps={lastReps?.[stateKey]}
                restLeft={restTimers?.[stateKey]}
                onWeightChange={onWeightChange}
                onRepsChange={onRepsChange}
                onMarkDone={onMarkDone}
                defaultRest={ex.rest}
                totalSets={totalSets}
              />
            );
          })}

          {ex.note ? <Text style={s.note}>💬 {ex.note}</Text> : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  /* Card */
  card:     { backgroundColor: C.card, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: C.light, overflow: 'hidden', ...shadow },
  cardDone: { borderColor: C.green + '40' },

  /* Header */
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
  headerText:  { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },

  iconCircle:     { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  iconCircleDone: { backgroundColor: C.green },
  iconEmoji:      { fontSize: 17 },
  iconCheck:      { color: '#fff', fontSize: 17, fontWeight: '700' },

  exName:     { fontSize: 16, fontWeight: '700', color: C.dark, letterSpacing: -0.2 },
  exNameDone: { color: C.mid, textDecorationLine: 'line-through' },
  exScheme:   { fontSize: 12, color: C.mid, marginTop: 3 },

  progressTxt: { fontSize: 12, fontWeight: '700', color: C.primary, backgroundColor: C.blue2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  chevron:     { fontSize: 16, color: C.mid, fontWeight: '600' },

  /* Best hint */
  bestHint: { fontSize: 11, color: C.mid + '80', paddingHorizontal: 72, marginTop: -6, marginBottom: 4 },

  /* Sets area */
  setsArea: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },

  /* Note */
  note: { fontSize: 12, color: C.mid, fontStyle: 'italic', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.light },
});
