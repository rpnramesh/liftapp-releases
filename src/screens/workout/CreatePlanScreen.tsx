// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Create / Edit Plan for a Client
// Fixes:
//   1. Assigned plan stored separately (NOT as library workout)
//   2. Shows existing assigned plan when opened for a client
//   3. Library workouts loaded fresh every time modal opens
// ─────────────────────────────────────────────────────────────────────────────
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { collection, deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert, FlatList, Modal,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { EmptyState, PrimaryButton, ScreenHeader } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import KeyboardSafeView from '../../components/ui/KeyboardSafeView';
import { C, R, S } from '../../constants/theme';
import { REST_PRESETS, WORKOUT_DAYS } from '../../constants/trainer.constants';
import { db } from '../../firebase/config';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { getTrainerId } from '../../services/session';
import { MUSCLE_GROUP_ICONS } from '../../services/workoutDemoData';
import { WorkoutAPI } from '../../services/workoutMockApi';

type Props = NativeStackScreenProps<ClientsStackParamList, 'CreatePlan'>;

interface PlanExercise {
  id: string; name: string; muscleGroup: string;
  warmupSets: number; warmupReps: number; warmupRestSeconds: number;
  mainSets: number; mainReps: number; mainRestSeconds: number; notes: string;
}
interface PlanDay {
  dayLabel: string; restDay: boolean;
  sourceWorkoutName?: string; exercises: PlanExercise[];
}

function defaultPlanDay(label: string): PlanDay {
  return { dayLabel: label, restDay: false, exercises: [] };
}
function workoutToPlanExercises(workout: any): PlanExercise[] {
  return (workout.exercises ?? []).map((ex: any) => ({
    id: `plan-${ex.exerciseId ?? ex.id}-${Date.now()}-${Math.random()}`,
    name: ex.exerciseName ?? ex.name ?? '',
    muscleGroup: ex.exerciseMuscleGroup ?? ex.muscleGroup ?? 'Other',
    warmupSets: ex.warmupSets ?? 0,
    warmupReps: ex.warmupReps ?? 10,
    warmupRestSeconds: ex.warmupRestSeconds ?? 60,
    mainSets: ex.mainSets ?? 3,
    mainReps: ex.mainReps ?? 10,
    mainRestSeconds: ex.mainRestSeconds ?? 60,
    notes: ex.notes ?? '',
  }));
}

const MAX_SETS = 12;
const MAX_REPS = 50;

// Strip undefined before Firestore writes
function clean(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(clean);
  if (typeof obj === 'object') {
    const r: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) r[k] = clean(v);
    }
    return r;
  }
  return obj;
}

export default function CreatePlanScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const [planName, setPlanName] = useState('');
  const [days, setDays] = useState<PlanDay[]>(WORKOUT_DAYS.map(l => defaultPlanDay(l)));
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [showWorkoutPicker, setShowWorkoutPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);

  // Load existing assigned plan when screen opens
  useEffect(() => {
    const loadExisting = async () => {
      setLoadingExisting(true);
      try {
        const trainerId = getTrainerId();
        const gymSnap = await getDoc(doc(db, 'trainers', trainerId)).catch(() => null);
        const gymId = gymSnap?.data()?.gymId ?? trainerId;

        // Check if there's an existing assignment for this member
        const assignSnap = await getDoc(doc(db, 'gyms', gymId, 'assignments', clientId)).catch(() => null);
        if (assignSnap?.exists()) {
          const assign = assignSnap.data();
          if (assign.planId) {
            // Load the plan
            const planSnap = await getDoc(doc(db, 'gyms', gymId, 'clientPlans', assign.planId)).catch(() => null);
            if (planSnap?.exists()) {
              const plan = planSnap.data();
              setPlanName(plan.name ?? '');
              setDays(plan.days ?? WORKOUT_DAYS.map(l => defaultPlanDay(l)));
              setExistingPlanId(assign.planId);
              setIsEditing(true);
            }
          }
        }
      } catch (e) {
        console.log('Load existing plan error:', e);
      } finally {
        setLoadingExisting(false);
      }
    };
    loadExisting();
  }, [clientId]);

  const activeDay = days[activeDayIdx];

  // Ensure activeDayIdx stays valid if days array length changes
  useEffect(() => {
    if (activeDayIdx >= days.length) {
      setActiveDayIdx(Math.max(0, days.length - 1));
    }
  }, [days.length, activeDayIdx]);

  const toggleRestDay = (idx: number) => {
    setDays(prev => prev.map((d, i) =>
      i === idx ? { ...d, restDay: !d.restDay, exercises: [], sourceWorkoutName: undefined } : d,
    ));
  };

  const loadWorkoutIntoDay = (workout: any) => {
    const exercises = workoutToPlanExercises(workout);
    setDays(prev => prev.map((d, i) =>
      i === activeDayIdx ? { ...d, restDay: false, sourceWorkoutName: workout.name, exercises } : d,
    ));
    setShowWorkoutPicker(false);
  };

  const addBlankExercise = () => {
    const blank: PlanExercise = {
      id: `blank-${Date.now()}`,
      name: '', muscleGroup: 'Other',
      warmupSets: 0, warmupReps: 10, warmupRestSeconds: 60,
      mainSets: 3, mainReps: 10, mainRestSeconds: 60, notes: '',
    };
    setDays(prev => prev.map((d, i) =>
      i === activeDayIdx ? { ...d, exercises: [...d.exercises, blank] } : d,
    ));
  };

  const updateExercise = (exIdx: number, patch: Partial<PlanExercise>) => {
    setDays(prev => prev.map((d, i) =>
      i !== activeDayIdx ? d : {
        ...d, exercises: d.exercises.map((ex, j) => j === exIdx ? { ...ex, ...patch } : ex),
      },
    ));
  };

  const removeExercise = (exIdx: number) => {
    setDays(prev => prev.map((d, i) =>
      i !== activeDayIdx ? d : {
        ...d,
        exercises: d.exercises.filter((_, j) => j !== exIdx),
        sourceWorkoutName: d.exercises.length <= 1 ? undefined : d.sourceWorkoutName,
      },
    ));
  };

  const validate = () => {
    if (!planName.trim()) { Alert.alert('Missing Name', 'Please give this plan a name.'); return false; }
    const hasContent = days.some(d => !d.restDay && d.exercises.length > 0);
    if (!hasContent) { Alert.alert('Empty Plan', 'Add at least one exercise to any day.'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const trainerId = getTrainerId();
      const gymSnap = await getDoc(doc(db, 'trainers', trainerId)).catch(() => null);
      const gymId = gymSnap?.data()?.gymId ?? trainerId;

      // Store as CLIENT PLAN — NOT a library workout
      // Uses 'clientPlans' collection, separate from 'workouts'
      const planRef = existingPlanId
        ? doc(db, 'gyms', gymId, 'clientPlans', existingPlanId)
        : doc(collection(db, 'gyms', gymId, 'clientPlans'));

      const planData = clean({
        id: planRef.id,
        name: planName.trim(),
        trainerId,
        memberId: clientId,
        memberName: clientName,
        gymId,
        isLibraryItem: false,   // explicitly NOT a library item
        days: days.map(d => clean({
          dayLabel: d.dayLabel,
          restDay: d.restDay,
          sourceWorkoutName: d.sourceWorkoutName ?? null,
          exercises: d.exercises.map(ex => clean({
            id: ex.id, name: ex.name,
            muscleGroup: ex.muscleGroup,
            warmupSets: ex.warmupSets, warmupReps: ex.warmupReps, warmupRestSeconds: ex.warmupRestSeconds,
            mainSets: ex.mainSets, mainReps: ex.mainReps, mainRestSeconds: ex.mainRestSeconds,
            notes: ex.notes || null,
          })),
        })),
        createdAt: existingPlanId ? undefined : Date.now(),
        updatedAt: Date.now(),
      });

      await setDoc(planRef, planData, { merge: true });
      // Clear any member-set postponement so the freshly assigned/updated plan
      // shows immediately instead of staying as a rest day.
      await updateDoc(planRef, { postponedOn: deleteField(), postponedDayIdx: deleteField() }).catch(() => {});

      // Update assignment record
      await setDoc(doc(db, 'gyms', gymId, 'assignments', clientId), clean({
        id: clientId, gymId, memberId: clientId, trainerId,
        planId: planRef.id, planName: planName.trim(),
        assignedAt: Date.now(), updatedAt: Date.now(),
      }), { merge: true });

      // Update member's current plan name
      await getDoc(doc(db, 'members', clientId)).then(snap => {
        if (snap.exists()) {
          return snap.ref.update(clean({ currentPlanId: planRef.id, currentPlanName: planName.trim(), planAssignedAt: Date.now() }));
        }
      }).catch(() => {});

      
      // Always update member document so ClientListScreen shows plan name
      try {
        await updateDoc(doc(db, 'members', clientId), {
          currentPlanId: planRef.id,
          currentPlanName: planName.trim(),
          planAssignedAt: Date.now(),
        });
      } catch (e) {
        // Member doc might not exist for freelance clients — try setDoc with merge
        try {
          await setDoc(doc(db, 'members', clientId), {
            currentPlanId: planRef.id,
            currentPlanName: planName.trim(),
            planAssignedAt: Date.now(),
          }, { merge: true });
        } catch (e2) {
          console.log('Member plan update error:', e2);
        }
      }

      // Send notification to member
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, clean({
        id: notifRef.id, recipientId: clientId, type: 'workout_assigned',
        title: 'New workout plan assigned',
        body: `${planName.trim()} has been assigned to you`,
        isRead: false, read: false, createdAt: Date.now(),
      }));

      Alert.alert(
        isEditing ? 'Plan Updated' : 'Plan Assigned',
        `"${planName}" has been ${isEditing ? 'updated' : 'assigned'} for ${clientName}.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      console.log('Save plan error:', e);
      Alert.alert('Error', e.message ?? 'Failed to save plan');
    } finally { setSaving(false); }
  };

  if (loadingExisting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={{ color: C.mid, marginTop: 12 }}>Loading plan…</Text>
      </View>
    );
  }

  return (
    <KeyboardSafeView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader
          title={isEditing ? `Edit Plan — ${clientName}` : `New Plan — ${clientName}`}
          onBack={() => navigation.goBack()}
          rightLabel={saving ? 'Saving…' : isEditing ? 'Update' : 'Save & Assign'}
          onRight={handleSave}
        />

        {isEditing && (
          <View style={styles.editingBanner}>
            <Text style={styles.editingBannerText}>Editing existing plan — changes save immediately</Text>
          </View>
        )}

        <View style={styles.planNameRow}>
          <TextInput style={styles.planNameInput}
            placeholder="Plan name — e.g. 8-Week Strength Builder"
            placeholderTextColor={C.mid} value={planName} onChangeText={setPlanName} />
        </View>

        {/* Day tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.dayTabRow} contentContainerStyle={{ paddingHorizontal: S.lg, gap: S.sm }}>
          {days.map((d, i) => (
            <TouchableOpacity key={d.dayLabel ?? `day-${i}`}
              style={[styles.dayTab, i === activeDayIdx && styles.dayTabActive, d.restDay && styles.dayTabRest]}
              onPress={() => setActiveDayIdx(i)}>
              <Text style={[styles.dayTabText, i === activeDayIdx && styles.dayTabTextActive]}>
                {( (d.dayLabel ?? `Day ${i + 1}`) ).slice(0, 3)}
              </Text>
              {d.restDay && <Text style={styles.dayTabBadge}>REST</Text>}
              {!d.restDay && d.exercises.length > 0 && (
                <View style={styles.dayTabCount}>
                  <Text style={styles.dayTabCountText}>{d.exercises.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: S.lg, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled">
          <View style={styles.dayHeader}>
            <TextInput
              style={styles.dayTitleInput}
              value={activeDay.dayLabel}
              onChangeText={(text) => setDays(prev => prev.map((d, i) => i === activeDayIdx ? { ...d, dayLabel: text } : d))}
              placeholder={`Day ${activeDayIdx + 1} name`}
              placeholderTextColor={C.mid}
            />
            <TouchableOpacity
              style={[styles.restToggle, activeDay.restDay && styles.restToggleOn]}
              onPress={() => toggleRestDay(activeDayIdx)}>
              <Text style={[styles.restToggleText, activeDay.restDay && { color: C.white }]}>
                {activeDay.restDay ? '✓ Rest Day' : 'Set as Rest Day'}
              </Text>
            </TouchableOpacity>
          </View>

          {!activeDay.restDay && (
            <>
              {activeDay.sourceWorkoutName && (
                <View style={styles.sourceBadge}>
                  <IconSymbol name="clipboard" size={18} color={C.primary} />
                  <Text style={styles.sourceBadgeText}>
                    Loaded from <Text style={{ fontWeight: '700' }}>{activeDay.sourceWorkoutName}</Text>
                    {' '}— edits here won't affect the library
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.loadWorkoutBtn}
                onPress={() => setShowWorkoutPicker(true)}>
                <IconSymbol name="clipboard" size={18} color={C.primary} style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.loadWorkoutText}>
                    {activeDay.sourceWorkoutName ? 'Replace with another workout' : 'Load from Workout Library'}
                  </Text>
                  <Text style={styles.loadWorkoutSub}>Pick a saved workout — exercises load in as a copy</Text>
                </View>
              </TouchableOpacity>

              {activeDay.exercises.map((ex, exIdx) => (
                        <PlanExerciseCard key={ex.id} exercise={ex} index={exIdx}
                          onChange={patch => updateExercise(exIdx, patch)}
                          onRemove={() => removeExercise(exIdx)} />
              ))}

              <TouchableOpacity style={styles.addBlankBtn} onPress={addBlankExercise}>
                <Text style={styles.addBlankBtnText}>+ Add Exercise Manually</Text>
              </TouchableOpacity>
            </>
          )}

          {activeDay.restDay && (
            <View style={styles.restDayPlaceholder}>
              <IconSymbol name="hotel" size={48} color={C.mid} />
              <Text style={styles.restDayText}>Rest Day</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label={saving ? 'Saving…' : isEditing ? 'Update Plan' : 'Save & Assign to Client'}
            onPress={handleSave} loading={saving} />
        </View>
      </View>

        {showWorkoutPicker && (
        <WorkoutPickerModal
          visible={showWorkoutPicker}
          dayLabel={activeDay.dayLabel ?? `Day ${activeDayIdx + 1}`}
          onSelect={loadWorkoutIntoDay}
          onClose={() => setShowWorkoutPicker(false)}
        />
      )}
    </KeyboardSafeView>
  );
}

// ─── WorkoutPickerModal — fetches fresh each time it opens ───────────────────
function WorkoutPickerModal({ visible, dayLabel, onSelect, onClose }: any) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch fresh every time modal opens — fixes the stale data issue
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    WorkoutAPI.getAll()
      .then(data => setWorkouts(data))
      .catch(e => { console.log('Workout picker error:', e); setWorkouts([]); })
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={pickerStyles.header}>
          <View>
            <Text style={pickerStyles.title}>Choose a Workout</Text>
            <Text style={pickerStyles.sub}>Loading into {dayLabel}</Text>
          </View>
          <TouchableOpacity style={pickerStyles.closeBtn} onPress={onClose}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconSymbol name="xmark" size={16} color={C.mid} />
              <Text style={pickerStyles.closeBtnText}>Cancel</Text>
            </View>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={{ color: C.mid, marginTop: 12 }}>Loading your workout library…</Text>
          </View>
        ) : workouts.length === 0 ? (
            <EmptyState icon={<IconSymbol name="clipboard" size={40} color={C.mid} />} title="No workouts in library"
            subtitle="Go to Library > Workouts and create a workout first. Come back here after saving." />
        ) : (
          <FlatList data={workouts} keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: 40 }}
            renderItem={({ item: wkt }: any) => {
              const muscleGroups = [...new Set((wkt.exercises ?? []).map((e: any) => e.exerciseMuscleGroup ?? e.muscleGroup).filter(Boolean))];
              return (
                <TouchableOpacity style={pickerStyles.card} onPress={() => onSelect(wkt)} activeOpacity={0.85}>
                  <View style={{ flex: 1, gap: S.sm }}>
                    <Text style={pickerStyles.cardName}>{wkt.name}</Text>
                    {wkt.description ? <Text style={pickerStyles.cardDesc} numberOfLines={1}>{wkt.description}</Text> : null}
                    <View style={pickerStyles.statsRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <IconSymbol name="figure.strengthtraining.traditional" size={14} color={C.primary} />
                        <Text style={[pickerStyles.statText, { marginLeft: 8 }]}>{(wkt.exercises ?? []).length} exercises</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <IconSymbol name="timer" size={14} color={C.mid} />
                        <Text style={[pickerStyles.statText, { marginLeft: 8 }]}>~{wkt.estimatedMinutes ?? 0} min</Text>
                      </View>
                    </View>
                    {muscleGroups.length > 0 && (
                      <View style={pickerStyles.muscleRow}>
                        {muscleGroups.slice(0, 4).map((g: any) => (
                          <View key={g} style={pickerStyles.muscleChip}>
                            <IconSymbol name={MUSCLE_GROUP_ICONS[g] ?? 'dumbbell'} size={14} color={C.primary} />
                            <Text style={[pickerStyles.muscleChipText, { marginLeft: 8 }]}>{g}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <IconSymbol name="chevron.right" size={22} color={C.primary} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── PlanExerciseCard ─────────────────────────────────────────────────────────
function PlanExerciseCard({ exercise, index, onChange, onRemove }: any) {
  const [expanded, setExpanded] = useState(true);
  return (
    <View style={exStyles.card}>
      <TouchableOpacity style={exStyles.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={exStyles.indexBadge}><Text style={exStyles.indexText}>{index + 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={exStyles.name}>{exercise.name || 'Unnamed exercise'}</Text>
          <Text style={exStyles.summary}>
            {exercise.warmupSets > 0 ? `${exercise.warmupSets}×${exercise.warmupReps} warm-up · ` : ''}
            {exercise.mainSets}×{exercise.mainReps} main
          </Text>
        </View>
        <TouchableOpacity onPress={onRemove}><IconSymbol name="xmark" size={18} color={C.red} /></TouchableOpacity>
        <View style={{ marginLeft: 8 }}>
          <IconSymbol name={expanded ? 'chevron.up' : 'chevron.down'} size={14} color={C.mid} />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={exStyles.body}>
          <TextInput style={exStyles.nameInput} placeholder="Exercise name"
            placeholderTextColor={C.mid} value={exercise.name}
            onChangeText={v => onChange({ name: v })} />
          <MiniSetBlock label="WARM-UP" color="#7C3AED" bgColor="#F5F3FF"
            sets={exercise.warmupSets} reps={exercise.warmupReps} restSeconds={exercise.warmupRestSeconds}
            restPeriods={Math.max(0, exercise.warmupSets - 1)}
            onSetsChange={v => onChange({ warmupSets: v })}
            onRepsChange={v => onChange({ warmupReps: v })}
            onRestChange={v => onChange({ warmupRestSeconds: v })} allowZero />
          <MiniSetBlock label="MAIN" color={C.primary} bgColor={C.primaryBg}
            sets={exercise.mainSets} reps={exercise.mainReps} restSeconds={exercise.mainRestSeconds}
            restPeriods={Math.max(0, exercise.mainSets - 1)}
            onSetsChange={v => onChange({ mainSets: v })}
            onRepsChange={v => onChange({ mainReps: v })}
            onRestChange={v => onChange({ mainRestSeconds: v })} allowZero={false} />
          <TextInput style={exStyles.notesInput} placeholder="Trainer notes (optional)"
            placeholderTextColor={C.mid} value={exercise.notes}
            onChangeText={v => onChange({ notes: v })} multiline />
        </View>
      )}
    </View>
  );
}

function MiniSetBlock({ label, color, bgColor, sets, reps, restSeconds, onSetsChange, onRepsChange, onRestChange, allowZero, restPeriods }: any) {
  return (
    <View style={[miniStyles.block, { borderLeftColor: color, backgroundColor: bgColor }]}>
      <Text style={[miniStyles.label, { color }]}>{label}</Text>
      <View style={miniStyles.row}>
        <View style={miniStyles.field}>
          <Text style={miniStyles.fieldLabel}>Sets</Text>
          <View style={miniStyles.stepper}>
            <TouchableOpacity style={[miniStyles.btn, sets <= (allowZero ? 0 : 1) && miniStyles.btnDisabled]}
              onPress={() => onSetsChange(Math.max(allowZero ? 0 : 1, sets - 1))} disabled={sets <= (allowZero ? 0 : 1)}>
              <Text style={miniStyles.btnText}>−</Text>
            </TouchableOpacity>
            <Text style={miniStyles.val}>{sets}</Text>
            <TouchableOpacity style={[miniStyles.btn, sets >= MAX_SETS && miniStyles.btnDisabled]}
              onPress={() => onSetsChange(Math.min(MAX_SETS, sets + 1))} disabled={sets >= MAX_SETS}>
              <Text style={miniStyles.btnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        {sets > 0 && (
          <View style={miniStyles.field}>
            <Text style={miniStyles.fieldLabel}>Reps</Text>
            <View style={miniStyles.stepper}>
              <TouchableOpacity style={[miniStyles.btn, reps <= 1 && miniStyles.btnDisabled]}
                onPress={() => onRepsChange(Math.max(1, reps - 1))} disabled={reps <= 1}>
                <Text style={miniStyles.btnText}>−</Text>
              </TouchableOpacity>
              <Text style={miniStyles.val}>{reps}</Text>
              <TouchableOpacity style={[miniStyles.btn, reps >= MAX_REPS && miniStyles.btnDisabled]}
                onPress={() => onRepsChange(Math.min(MAX_REPS, reps + 1))} disabled={reps >= MAX_REPS}>
                <Text style={miniStyles.btnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      {restPeriods > 0 && (
        <View style={miniStyles.restRow}>
          <Text style={miniStyles.restLabel}>Rest between sets</Text>
          <View style={miniStyles.restChips}>
            {REST_PRESETS.map((s: number) => (
              <TouchableOpacity key={s}
                style={[miniStyles.restChip, restSeconds === s && { backgroundColor: color, borderColor: color }]}
                onPress={() => onRestChange(s)}>
                <Text style={[miniStyles.restChipText, restSeconds === s && { color: C.white }]}>{s}s</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  editingBanner: { backgroundColor: '#FFF7ED', borderBottomWidth: 1, borderBottomColor: '#FED7AA', paddingHorizontal: S.lg, paddingVertical: 8 },
  editingBannerText: { fontSize: 12, color: '#C2410C', fontWeight: '500' },
  planNameRow: { backgroundColor: C.white, paddingHorizontal: S.lg, paddingVertical: S.md, borderBottomWidth: 1, borderBottomColor: C.border },
  planNameInput: { fontSize: 16, fontWeight: '600', color: C.dark, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm + 2, backgroundColor: C.bg },
  dayTabRow: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 64, flexGrow: 0 },
  dayTab: { paddingHorizontal: S.md, paddingVertical: S.sm + 2, borderRadius: R.md, alignItems: 'center', marginVertical: S.sm, minWidth: 52, position: 'relative', borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  dayTabActive: { backgroundColor: C.primary, borderColor: C.primary },
  dayTabRest: { backgroundColor: '#F3F4F6', borderColor: C.border },
  dayTabText: { fontSize: 12, fontWeight: '700', color: C.mid },
  dayTabTextActive: { color: C.white },
  dayTabBadge: { fontSize: 8, color: C.mid, fontWeight: '700' },
  dayTabCount: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  dayTabCountText: { fontSize: 9, color: C.white, fontWeight: '700' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md },
  dayTitle: { fontSize: 17, fontWeight: '700', color: C.dark },
  dayTitleInput: { fontSize: 17, fontWeight: '700', color: C.dark, flex: 1, borderBottomWidth: 1.5, borderBottomColor: C.primary, paddingVertical: 4, marginRight: 12 },
  restToggle: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  restToggleOn: { backgroundColor: C.amber, borderColor: C.amber },
  restToggleText: { fontSize: 12, fontWeight: '600', color: C.mid },
  sourceBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, backgroundColor: C.primaryBg, borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: C.primaryMid, marginBottom: S.md },
  sourceBadgeIcon: { fontSize: 16, marginTop: 1 },
  sourceBadgeText: { flex: 1, fontSize: 13, color: C.primary, lineHeight: 18 },
  loadWorkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.white, borderRadius: R.lg, padding: S.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.primary, marginBottom: S.md },
  loadWorkoutIcon: { fontSize: 24 },
  loadWorkoutText: { fontSize: 14, fontWeight: '700', color: C.primary },
  loadWorkoutSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  addBlankBtn: { marginTop: S.md, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, borderRadius: R.lg, padding: S.md, alignItems: 'center' },
  addBlankBtnText: { color: C.mid, fontWeight: '600', fontSize: 14 },
  restDayPlaceholder: { alignItems: 'center', paddingVertical: 60, gap: S.md },
  restDayText: { fontSize: 20, fontWeight: '700', color: C.mid },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: S.lg, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
});

const exStyles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: R.lg, marginBottom: S.md, overflow: 'hidden', elevation: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  indexBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  indexText: { color: C.white, fontWeight: '700', fontSize: 12 },
  name: { fontSize: 14, fontWeight: '600', color: C.dark },
  summary: { fontSize: 11, color: C.mid, marginTop: 1 },
  body: { padding: S.md, gap: S.md, borderTopWidth: 1, borderTopColor: C.border },
  nameInput: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: S.sm + 2, fontSize: 14, color: C.dark },
  notesInput: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: S.sm + 2, fontSize: 13, color: C.dark, minHeight: 40 },
});

const miniStyles = StyleSheet.create({
  block: { borderLeftWidth: 3, borderRadius: R.md, padding: S.md, gap: S.md },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: S.xl },
  field: { gap: S.xs },
  fieldLabel: { fontSize: 11, color: C.mid, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  btn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { fontSize: 18, color: C.dark, lineHeight: 22 },
  val: { fontSize: 17, fontWeight: '700', color: C.dark, minWidth: 24, textAlign: 'center' },
  restRow: { gap: S.xs },
  restLabel: { fontSize: 11, color: C.mid, fontWeight: '500' },
  restChips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  restChip: { paddingHorizontal: S.sm + 2, paddingVertical: 3, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  restChipText: { fontSize: 11, fontWeight: '600', color: C.mid },
});

const pickerStyles = StyleSheet.create({
  header: { backgroundColor: C.white, padding: S.lg, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700', color: C.dark },
  sub: { fontSize: 13, color: C.mid, marginTop: 2 },
  closeBtn: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, backgroundColor: C.bg, borderRadius: R.md },
  closeBtnText: { fontSize: 14, color: C.mid, fontWeight: '500' },
  card: { backgroundColor: C.white, borderRadius: R.lg, padding: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.md, elevation: 2 },
  cardName: { fontSize: 17, fontWeight: '700', color: C.dark },
  cardDesc: { fontSize: 13, color: C.mid },
  statsRow: { flexDirection: 'row', gap: S.md },
  statText: { fontSize: 12, color: C.mid },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  muscleChip: { backgroundColor: C.primaryBg, paddingHorizontal: S.sm, paddingVertical: 2, borderRadius: R.full },
  muscleChipText: { fontSize: 11, color: C.primary, fontWeight: '600' },
});
