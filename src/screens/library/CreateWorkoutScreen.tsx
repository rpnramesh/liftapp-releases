// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Create / Edit Workout Screen
// Fix 2: Allow deleting exercise from workout (clears block on library delete)
// Fix 3: When last exercise deleted, alert user workout will be discarded
// ─────────────────────────────────────────────────────────────────────────────
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    Alert, FlatList, Modal,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { EmptyState, PrimaryButton, ScreenHeader } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import KeyboardSafeView from '../../components/ui/KeyboardSafeView';
import { C, R, S } from '../../constants/theme';
import { REST_PRESETS } from '../../constants/trainer.constants';
import { useAsync } from '../../hooks/useTrainer';
import { LibraryStackParamList } from '../../navigation/TrainerNavigator';
import { MUSCLE_GROUP_ICONS, MUSCLE_GROUPS } from '../../services/workoutDemoData';
import { computeWorkoutStats, ExerciseAPI, WorkoutAPI } from '../../services/workoutMockApi';

type Props = NativeStackScreenProps<LibraryStackParamList, 'CreateWorkout'>;

const MAX_EXERCISES = 12;
const MAX_SETS = 12;
const MAX_REPS = 50;

function defaultEntry(ex) {
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseMuscleGroup: ex.muscleGroup,
    warmupSets: 0, warmupReps: 10, warmupRestSeconds: 60,
    mainSets: 3, mainReps: 10, mainRestSeconds: 60,
  };
}

export default function CreateWorkoutScreen({ navigation, route }: Props) {
  const existing = route.params?.workout;
  const isEditing = !!existing;

  const [workoutName, setWorkoutName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [entries, setEntries] = useState(existing?.exercises ?? []);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [errors, setErrors] = useState({});

  const { data: allExercises, loading: loadingExercises } = useAsync(() => ExerciseAPI.getAll(), []);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerFilter, setPickerFilter] = useState(null);

  const filteredExercises = (allExercises ?? []).filter(ex => {
    const alreadyAdded = entries.some(e => e.exerciseId === ex.id);
    const matchSearch = ex.name.toLowerCase().includes(pickerSearch.toLowerCase());
    const matchGroup = !pickerFilter || ex.muscleGroup === pickerFilter;
    return !alreadyAdded && matchSearch && matchGroup;
  });

  const addExercise = (ex) => {
    if (entries.length >= MAX_EXERCISES) {
      Alert.alert('Limit Reached', `Maximum ${MAX_EXERCISES} exercises per workout.`);
      return;
    }
    setEntries(prev => [...prev, defaultEntry(ex)]);
    setExpandedIndex(entries.length);
    setShowPicker(false);
  };

  // Fix 2 & 3: Removing an exercise from workout
  const removeExercise = (index) => {
    const exerciseName = entries[index].exerciseName;
    const isLastExercise = entries.length === 1;

    if (isLastExercise) {
      // Fix 3: Last exercise — warn that workout will be discarded
      Alert.alert(
        'Discard Workout?',
        `"${exerciseName}" is the only exercise in this workout. Removing it will discard the entire workout. Do you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard Workout', style: 'destructive',
            onPress: async () => {
              // If editing, delete the workout from Firestore too
              if (isEditing && existing?.id) {
                try {
                  await WorkoutAPI.delete(existing.id);
                } catch (e) {
                  console.log('Delete workout error:', e);
                }
              }
              Alert.alert(
                'Workout Discarded',
                'The workout has been removed as it had no exercises.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            },
          },
        ]
      );
      return;
    }

    // Normal removal — just confirm
    Alert.alert(
      'Remove Exercise',
      `Remove "${exerciseName}" from this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => {
            setEntries(prev => prev.filter((_, i) => i !== index));
            setExpandedIndex(null);
          },
        },
      ]
    );
  };

  const moveEntry = (index, direction) => {
    const newEntries = [...entries];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newEntries.length) return;
    [newEntries[index], newEntries[target]] = [newEntries[target], newEntries[index]];
    setEntries(newEntries);
    setExpandedIndex(target);
  };

  const updateEntry = (index, patch) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e));
  };

  const validate = () => {
    const e = {};
    if (!workoutName.trim()) e.workoutName = 'Workout name is required';
    if (entries.length === 0) e.exercises = 'Add at least one exercise';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const stats = computeWorkoutStats(entries);
      const payload = { name: workoutName.trim(), description: description.trim(), exercises: entries, ...stats };
      if (isEditing && existing) {
        await WorkoutAPI.update(existing.id, payload);
      } else {
        await WorkoutAPI.create(payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  const stats = computeWorkoutStats(entries);
  const noExercisesYet = !loadingExercises && (allExercises ?? []).length === 0;

  return (
    <KeyboardSafeView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader
          title={isEditing ? 'Edit Workout' : 'New Workout'}
          onBack={() => navigation.goBack()}
          rightLabel={saving ? 'Saving…' : 'Save'}
          onRight={handleSave}
        />

        {noExercisesYet && (
          <View style={styles.noExercisesNotice}>
            <IconSymbol name="dumbbell" size={52} color={C.primary} />
            <Text style={styles.noExercisesTitle}>No exercises in your library yet</Text>
            <Text style={styles.noExercisesText}>
              Go to Library › Exercises › tap + Exercise to add your first exercise before creating a workout.
            </Text>
            <TouchableOpacity style={styles.noExercisesBtn} onPress={() => navigation.goBack()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol name="chevron.left" size={14} color={C.mid} />
                <Text style={styles.noExercisesBtnText}>Go back to Library</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {!noExercisesYet && (
          <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: 100 }}>
            <View>
              <Text style={styles.label}>Workout Name *</Text>
              <TextInput style={[styles.input, errors.workoutName && styles.inputError]}
                placeholder="e.g. Push Day, Leg Day, Full Body A…"
                placeholderTextColor={C.mid} value={workoutName}
                onChangeText={v => { setWorkoutName(v); setErrors(p => ({ ...p, workoutName: '' })); }} />
              {errors.workoutName ? <Text style={styles.errorText}>{errors.workoutName}</Text> : null}
            </View>

            <View>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: S.md }]}
                placeholder="What muscle groups does this target?"
                placeholderTextColor={C.mid} multiline value={description} onChangeText={setDescription} />
            </View>

            {entries.length > 0 && (
              <View style={styles.statsBar}>
                  <StatMini icon="figure.strengthtraining.traditional" value={`${entries.length}/${MAX_EXERCISES}`} label="exercises" />
                  <View style={styles.statsDivider} />
                  <StatMini icon="number" value={`${stats.totalSets}`} label="total sets" />
                  <View style={styles.statsDivider} />
                  <StatMini icon="timer" value={`~${stats.estimatedMinutes}`} label="minutes" />
                </View>
            )}

            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>EXERCISES</Text>
                {errors.exercises
                  ? <Text style={styles.errorText}>{errors.exercises}</Text>
                  : <Text style={styles.sectionCount}>{entries.length}/{MAX_EXERCISES}</Text>}
              </View>

              {entries.length === 0 ? (
                <TouchableOpacity style={styles.emptyExercises} onPress={() => setShowPicker(true)}>
                  <IconSymbol name="dumbbell" size={36} color={C.primary} />
                  <Text style={styles.emptyExText}>Tap to add exercises</Text>
                  <Text style={styles.emptyExSub}>Choose from your exercise library</Text>
                </TouchableOpacity>
              ) : (
                entries.map((entry, index) => (
                  <ExerciseEntry
                    key={entry.exerciseId + index}
                    entry={entry} index={index} total={entries.length}
                    isExpanded={expandedIndex === index}
                    onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    onUpdate={patch => updateEntry(index, patch)}
                    onRemove={() => removeExercise(index)}
                    onMoveUp={() => moveEntry(index, 'up')}
                    onMoveDown={() => moveEntry(index, 'down')}
                    errors={errors} errorKey={`mainSets_${index}`}
                  />
                ))
              )}

              {entries.length < MAX_EXERCISES && (
                <TouchableOpacity style={styles.addExBtn} onPress={() => setShowPicker(true)}>
                  <Text style={styles.addExBtnText}>+ Add Exercise</Text>
                </TouchableOpacity>
              )}
            </View>

            <PrimaryButton label={isEditing ? 'Save Changes' : 'Create Workout'} onPress={handleSave} loading={saving} />
          </ScrollView>
        )}

        <ExercisePickerModal
          visible={showPicker}
          exercises={filteredExercises}
          search={pickerSearch}
          onSearch={setPickerSearch}
          filter={pickerFilter}
          onFilter={setPickerFilter}
          onSelect={addExercise}
          onClose={() => { setShowPicker(false); setPickerSearch(''); setPickerFilter(null); }}
        />
      </View>
    </KeyboardSafeView>
  );
}

function ExerciseEntry({ entry, index, total, isExpanded, onToggle, onUpdate, onRemove, onMoveUp, onMoveDown, errors, errorKey }) {
  const warmupRests = Math.max(0, entry.warmupSets - 1);
  const mainRests = Math.max(0, entry.mainSets - 1);
  return (
    <View style={[styles.entryCard, errors[errorKey] && styles.entryCardError]}>
      <TouchableOpacity style={styles.entryHeader} onPress={onToggle} activeOpacity={0.8}>
        <View style={styles.entryIndexBadge}><Text style={styles.entryIndexText}>{index + 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.entryName}>{entry.exerciseName}</Text>
          <Text style={styles.entrySummary}>
            {entry.warmupSets > 0 ? `${entry.warmupSets}×${entry.warmupReps} warm-up · ` : ''}
            {entry.mainSets}×{entry.mainReps} main
          </Text>
        </View>
        <IconSymbol name={isExpanded ? 'chevron.up' : 'chevron.down'} size={18} color={C.mid} style={styles.entryChevron as any} />
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.entryBody}>
          <SetBlock label="WARM-UP" color="#7C3AED" bgColor="#F5F3FF"
            sets={entry.warmupSets} reps={entry.warmupReps} restSeconds={entry.warmupRestSeconds}
            onSetsChange={v => onUpdate({ warmupSets: v })}
            onRepsChange={v => onUpdate({ warmupReps: v })}
            onRestChange={v => onUpdate({ warmupRestSeconds: v })}
            allowZeroSets restPeriods={warmupRests} />
          <SetBlock label="MAIN" color={C.primary} bgColor={C.primaryBg}
            sets={entry.mainSets} reps={entry.mainReps} restSeconds={entry.mainRestSeconds}
            onSetsChange={v => onUpdate({ mainSets: v })}
            onRepsChange={v => onUpdate({ mainReps: v })}
            onRestChange={v => onUpdate({ mainRestSeconds: v })}
            allowZeroSets={false} restPeriods={mainRests} />
          <View style={styles.entryActions}>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {index > 0 && (
                <TouchableOpacity style={styles.reorderBtn} onPress={onMoveUp}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <IconSymbol name="chevron.up" size={14} color={C.mid} />
                    <Text style={styles.reorderBtnText}>Move Up</Text>
                  </View>
                </TouchableOpacity>
              )}
              {index < total - 1 && (
                <TouchableOpacity style={styles.reorderBtn} onPress={onMoveDown}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <IconSymbol name="chevron.down" size={14} color={C.mid} />
                    <Text style={styles.reorderBtnText}>Move Down</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
            {/* Fix 2: Always show Remove button — user can delete from workout */}
            <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol name="trash" size={14} color={C.red} />
                <Text style={styles.removeBtnText}>Remove</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function SetBlock({ label, color, bgColor, sets, reps, restSeconds, onSetsChange, onRepsChange, onRestChange, allowZeroSets, restPeriods }) {
  return (
    <View style={[styles.setBlock, { borderLeftColor: color, backgroundColor: bgColor }]}>
      <Text style={[styles.setBlockLabel, { color }]}>{label}</Text>
      <View style={styles.setRow}>
        <Text style={styles.setRowLabel}>Sets</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={[styles.stepperBtn, sets <= (allowZeroSets ? 0 : 1) && styles.stepperBtnDisabled]}
            onPress={() => onSetsChange(Math.max(allowZeroSets ? 0 : 1, sets - 1))} disabled={sets <= (allowZeroSets ? 0 : 1)}>
            <Text style={styles.stepperBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{sets}</Text>
          <TouchableOpacity style={[styles.stepperBtn, sets >= MAX_SETS && styles.stepperBtnDisabled]}
            onPress={() => onSetsChange(Math.min(MAX_SETS, sets + 1))} disabled={sets >= MAX_SETS}>
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {sets > 0 && (
        <View style={styles.setRow}>
          <Text style={styles.setRowLabel}>Reps per set</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={[styles.stepperBtn, reps <= 1 && styles.stepperBtnDisabled]}
              onPress={() => onRepsChange(Math.max(1, reps - 1))} disabled={reps <= 1}>
              <Text style={styles.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{reps}</Text>
            <TouchableOpacity style={[styles.stepperBtn, reps >= MAX_REPS && styles.stepperBtnDisabled]}
              onPress={() => onRepsChange(Math.min(MAX_REPS, reps + 1))} disabled={reps >= MAX_REPS}>
              <Text style={styles.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {restPeriods > 0 && (
        <View style={styles.restRow}>
          <Text style={styles.setRowLabel}>Rest between sets</Text>
          <View style={styles.restPresets}>
            {REST_PRESETS.map(s => (
              <TouchableOpacity key={s}
                style={[styles.restChip, restSeconds === s && { backgroundColor: color, borderColor: color }]}
                onPress={() => onRestChange(s)}>
                <Text style={[styles.restChipText, restSeconds === s && { color: C.white }]}>{s}s</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function ExercisePickerModal({ visible, exercises, search, onSearch, filter, onFilter, onSelect, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={pickerStyles.header}>
          <Text style={pickerStyles.title}>Add Exercise</Text>
          <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconSymbol name="xmark" size={16} color={C.mid} />
              <Text style={pickerStyles.closeBtnText}>Close</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={pickerStyles.searchBar}>
          <IconSymbol name="magnifyingglass" size={18} color={C.mid} />
          <TextInput style={pickerStyles.searchInput} placeholder="Search exercises…"
            placeholderTextColor={C.mid} value={search} onChangeText={onSearch} autoFocus />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: S.lg, gap: S.sm, paddingVertical: S.xs }}>
          <TouchableOpacity style={[pickerStyles.filterChip, !filter && pickerStyles.filterChipActive]}
            onPress={() => onFilter(null)}>
            <Text style={[pickerStyles.filterText, !filter && pickerStyles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {MUSCLE_GROUPS.map(g => (
            <TouchableOpacity key={g}
                style={[pickerStyles.filterChip, filter === g && pickerStyles.filterChipActive]}
                onPress={() => onFilter(filter === g ? null : g)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconSymbol name={MUSCLE_GROUP_ICONS[g] ?? 'dumbbell'} size={14} color={filter === g ? C.white : C.primary} />
                  <Text style={[pickerStyles.filterText, filter === g && pickerStyles.filterTextActive]}>{g}</Text>
                </View>
              </TouchableOpacity>
          ))}
        </ScrollView>
        <FlatList data={exercises} keyExtractor={item => item.id}
          contentContainerStyle={{ padding: S.lg, gap: S.sm, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyState icon={<IconSymbol name="magnifyingglass" size={48} color={C.mid} />} title="No exercises found"
              subtitle={search ? 'Try a different search' : 'All exercises already added'} />
          }
          renderItem={({ item: ex }) => (
            <TouchableOpacity style={pickerStyles.exCard} onPress={() => onSelect(ex)} activeOpacity={0.85}>
              <View style={pickerStyles.exIconCircle}>
                <IconSymbol name={MUSCLE_GROUP_ICONS[ex.muscleGroup] ?? 'dumbbell'} size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={pickerStyles.exName}>{ex.name}</Text>
                <Text style={pickerStyles.exGroup}>{ex.muscleGroup}</Text>
                {ex.description ? <Text style={pickerStyles.exDesc} numberOfLines={2}>{ex.description}</Text> : null}
              </View>
              <Text style={{ fontSize: 22, color: C.primary }}>+</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

function StatMini({ icon, value, label }) {
  return (
    <View style={styles.statMini}>
      {typeof icon === 'string' ? (
        <IconSymbol name={icon as any} size={18} color={C.primary} />
      ) : (
        <Text style={styles.statMiniIcon}>{icon}</Text>
      )}
      <Text style={styles.statMiniValue}>{value}</Text>
      <Text style={styles.statMiniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noExercisesNotice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  noExercisesIcon: { fontSize: 52 },
  noExercisesTitle: { fontSize: 20, fontWeight: '700', color: C.dark, textAlign: 'center' },
  noExercisesText: { fontSize: 14, color: C.mid, textAlign: 'center', lineHeight: 22 },
  noExercisesBtn: { marginTop: 8, backgroundColor: C.primaryBg, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  noExercisesBtnText: { color: C.primary, fontWeight: '600', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '700', color: C.dark, marginBottom: S.xs },
  errorText: { fontSize: 12, color: C.red, marginTop: S.xs },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: S.md, fontSize: 15, color: C.dark, minHeight: 44 },
  inputError: { borderColor: C.red },
  statsBar: { backgroundColor: C.white, borderRadius: R.lg, padding: S.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', elevation: 1 },
  statsDivider: { width: 1, height: 32, backgroundColor: C.border },
  statMini: { alignItems: 'center', gap: 2, flex: 1 },
  statMiniIcon: { fontSize: 16 },
  statMiniValue: { fontSize: 18, fontWeight: '700', color: C.dark },
  statMiniLabel: { fontSize: 10, color: C.mid },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.mid, letterSpacing: 0.5 },
  sectionCount: { fontSize: 12, color: C.mid },
  emptyExercises: { backgroundColor: C.white, borderRadius: R.lg, padding: 40, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border, alignItems: 'center', gap: S.sm },
  emptyExText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyExSub: { fontSize: 13, color: C.mid },
  addExBtn: { marginTop: S.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.primary, borderRadius: R.lg, padding: S.lg, alignItems: 'center' },
  addExBtnText: { color: C.primary, fontWeight: '700', fontSize: 15 },
  entryCard: { backgroundColor: C.white, borderRadius: R.lg, marginBottom: S.md, overflow: 'hidden', elevation: 1 },
  entryCardError: { borderWidth: 1, borderColor: C.red },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  entryIndexBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  entryIndexText: { color: C.white, fontWeight: '700', fontSize: 13 },
  entryName: { fontSize: 15, fontWeight: '600', color: C.dark },
  entrySummary: { fontSize: 12, color: C.mid, marginTop: 2 },
  entryChevron: { fontSize: 12, color: C.mid },
  entryBody: { padding: S.md, gap: S.md, borderTopWidth: 1, borderTopColor: C.border },
  setBlock: { borderLeftWidth: 3, borderRadius: R.md, padding: S.md, gap: S.md },
  setBlockLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  setRowLabel: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  stepperBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperBtnText: { fontSize: 20, color: C.dark, lineHeight: 24 },
  stepperValue: { fontSize: 18, fontWeight: '700', color: C.dark, minWidth: 28, textAlign: 'center' },
  restRow: { gap: S.sm },
  restPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  restChip: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  restChipText: { fontSize: 12, fontWeight: '600', color: C.mid },
  entryActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: S.md },
  reorderBtn: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, backgroundColor: C.bg, borderRadius: R.sm, borderWidth: 1, borderColor: C.border },
  reorderBtnText: { fontSize: 12, color: '#374151' },
  removeBtn: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, backgroundColor: '#FEE2E2', borderRadius: R.sm },
  removeBtnText: { fontSize: 12, color: C.red, fontWeight: '600' },
});

const pickerStyles = StyleSheet.create({
  header: { backgroundColor: C.white, paddingHorizontal: S.lg, paddingTop: 20, paddingBottom: S.md, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: C.dark },
  closeBtn: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, backgroundColor: C.bg, borderRadius: R.md },
  closeBtnText: { fontSize: 14, color: C.mid, fontWeight: '500' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginHorizontal: S.lg, marginVertical: S.md, backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: S.md, height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: C.dark },
  filterChip: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 12, color: C.mid, fontWeight: '500' },
  filterTextActive: { color: C.white, fontWeight: '700' },
  exCard: { backgroundColor: C.white, borderRadius: R.lg, padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md, elevation: 1 },
  exIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 15, fontWeight: '600', color: C.dark },
  exGroup: { fontSize: 12, color: C.primary, fontWeight: '500', marginTop: 1 },
  exDesc: { fontSize: 12, color: C.mid, marginTop: 2, lineHeight: 17 },
});
