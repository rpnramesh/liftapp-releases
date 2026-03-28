// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../constants/theme';
// Lift Trainer App — Interactive Client Workout Logs (real-time sync)
// Trainer can start workouts, edit weight/reps/sets, toggle completion,
// adjust rest time — all changes sync bidirectionally with member app.
// ─────────────────────────────────────────────────────────────────────────────

import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { collection, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { EmptyState, PrimaryButton, SkeletonCard, StatusBadge } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { db } from '../../firebase/config';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { getTrainerId } from '../../services/session';
import { WorkoutAPI } from '../../services/trainer.api';
import { WorkoutLog } from '../../types/trainer.types';
import { formatDateTime } from '../../utils/trainer.utils';

type Props = NativeStackScreenProps<ClientsStackParamList, 'WorkoutLogs'>;

// Helper to get gymId for Firestore writes
async function getGymId() {
  const trainerId = getTrainerId();
  const trainerSnap = await getDoc(doc(db, 'trainers', trainerId)).catch(() => null);
  return trainerSnap?.data()?.gymId ?? trainerId;
}

export default function WorkoutLogsScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const [noteModal, setNoteModal] = useState<{ logId: string; existing?: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [logs, setLogs] = useState<WorkoutLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Day picker modal state
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [planDays, setPlanDays] = useState<any[]>([]);
  const [cachedPlan, setCachedPlan] = useState<any>(null);
  const [cachedGymId, setCachedGymId] = useState<string | null>(null);

  // Reload helper for pull-to-refresh (re-mounts listener)
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = useCallback(() => {
    setLoading(true);
    setReloadKey(k => k + 1);
  }, []);

  // Realtime subscription while focused — sort client-side to avoid composite index
  useFocusEffect(
    useCallback(() => {
      let unsub: (() => void) | null = null;
      let mounted = true;

      (async () => {
        try {
          const gymId = await getGymId();
          if (!gymId) { setLoading(false); return; }
          // Query without orderBy to avoid requiring a Firestore composite index
          const q = query(
            collection(db, 'gyms', gymId, 'workoutLogs'),
            where('memberId', '==', clientId),
          );
          unsub = onSnapshot(q, snap => {
            if (!mounted) return;
            const data = snap.docs
              .map(d => ({ id: d.id, ...(d.data() as any) }))
              // Sort newest first client-side
              .sort((a: any, b: any) =>
                (b.startedAt ?? b.completedAt ?? 0) - (a.startedAt ?? a.completedAt ?? 0),
              );
            setLogs(data);
            setLoading(false);
          }, err => {
            console.log('workoutLogs onSnapshot error', err);
            if (mounted) { setLogs([]); setLoading(false); }
          });
        } catch (e) {
          console.log('workoutLogs listener error', e);
          if (mounted) { setLogs([]); setLoading(false); }
        }
      })();

      return () => { mounted = false; if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId, reloadKey]),
  );

  const openNoteModal = (logId: string, existing?: string) => {
    setNoteModal({ logId, existing });
    setNoteText(existing ?? '');
  };

  const saveNote = async () => {
    if (!noteModal) return;
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await WorkoutAPI.addNoteOnLog(getTrainerId(), clientId, noteModal.logId, noteText.trim());
      setNoteModal(null);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save note');
    } finally { setSavingNote(false); }
  };

  // ─── Load plan days and open day picker ─────────────────────────────────
  const openDayPicker = async () => {
    setStarting(true);
    try {
      const gymId = await getGymId();
      setCachedGymId(gymId);

      const assignSnap = await getDoc(doc(db, 'gyms', gymId, 'assignments', clientId)).catch(() => null);
      if (!assignSnap?.exists() || !assignSnap.data().planId) {
        Alert.alert('No Plan Assigned', `${clientName} doesn't have a workout plan assigned yet.\nAssign a plan first from the Clients tab.`);
        return;
      }
      const assign = assignSnap.data();
      const planSnap = await getDoc(doc(db, 'gyms', gymId, 'clientPlans', assign.planId)).catch(() => null);
      if (!planSnap?.exists()) {
        Alert.alert('Plan Not Found', 'The assigned plan could not be loaded.');
        return;
      }
      const plan = planSnap.data();
      const workoutDays = (plan.days ?? []).filter((d: any) => !d.restDay && d.exercises?.length > 0);
      if (workoutDays.length === 0) {
        Alert.alert('Empty Plan', 'The plan has no workout days with exercises.');
        return;
      }
      setCachedPlan(plan);
      setPlanDays(workoutDays);
      setDayPickerVisible(true);
    } catch (e: any) {
      console.log('openDayPicker error:', e);
      Alert.alert('Error', e.message ?? 'Failed to load plan');
    } finally { setStarting(false); }
  };

  // ─── Start a workout log for a specific plan day ─────────────────────────
  const startWorkoutForDay = async (day: any) => {
    setDayPickerVisible(false);
    setStarting(true);
    try {
      const trainerId = getTrainerId();
      const gymId = cachedGymId ?? await getGymId();
      const plan = cachedPlan;
      if (!plan) return;

      const assignSnap = await getDoc(doc(db, 'gyms', gymId, 'assignments', clientId)).catch(() => null);
      const assign = assignSnap?.data() ?? {};

      const logRef = doc(collection(db, 'gyms', gymId, 'workoutLogs'));
      const now = Date.now();
      const newLog = {
        id: logRef.id,
        memberId: clientId,
        memberName: clientName,
        trainerId,
        gymId,
        planId: assign.planId ?? plan.id ?? '',
        planName: plan.name ?? assign.planName ?? 'Workout',
        dayLabel: day.dayLabel,
        status: 'incomplete',
        completedExercises: day.exercises.map((ex: any) => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          muscleGroup: ex.muscleGroup ?? 'Other',
          targetSets: ex.mainSets ?? 3,
          targetReps: ex.mainReps ?? 10,
          actualSets: ex.mainSets ?? 3,
          actualReps: String(ex.mainReps ?? 10),
          weight: 0,
          restSeconds: ex.mainRestSeconds ?? 60,
          completed: false,
          notes: ex.notes ?? '',
        })),
        startedAt: now,
        loggedAt: new Date(now).toISOString(),
        completedAt: now,
        startedBy: 'trainer',
        updatedAt: now,
      };

      await setDoc(logRef, newLog);
      setExpandedLogId(logRef.id);
    } catch (e: any) {
      console.log('startWorkoutForDay error:', e);
      Alert.alert('Error', e.message ?? 'Failed to start workout');
    } finally { setStarting(false); }
  };

  // ─── Update a single exercise in a log (Firestore write) ────────────────
  const updateExerciseInLog = async (logId: string, exerciseId: string, patch: any) => {
    try {
      const gymId = await getGymId();
      const logRef = doc(db, 'gyms', gymId, 'workoutLogs', logId);
      const logSnap = await getDoc(logRef);
      if (!logSnap.exists()) return;

      const data = logSnap.data();
      const exercises = (data.completedExercises ?? []).map((ex: any) =>
        ex.exerciseId === exerciseId ? { ...ex, ...patch } : ex,
      );

      // Auto-determine status
      const allDone = exercises.every((ex: any) => ex.completed);
      const anyDone = exercises.some((ex: any) => ex.completed);
      const status = allDone ? 'completed' : 'incomplete';

      await updateDoc(logRef, {
        completedExercises: exercises,
        status,
        updatedAt: Date.now(),
        ...(allDone ? { completedAt: Date.now() } : {}),
      });
    } catch (e: any) {
      console.log('updateExercise error:', e);
    }
  };

  // ─── Mark entire workout as completed ────────────────────────────────────
  const markWorkoutComplete = async (logId: string) => {
    try {
      const gymId = await getGymId();
      const logRef = doc(db, 'gyms', gymId, 'workoutLogs', logId);
      const logSnap = await getDoc(logRef);
      if (!logSnap.exists()) return;
      const data = logSnap.data();
      const exercises = (data.completedExercises ?? []).map((ex: any) => ({ ...ex, completed: true }));
      await updateDoc(logRef, {
        completedExercises: exercises,
        status: 'completed',
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update');
    }
  };

  // ─── Render exercise row (interactive) ──────────────────────────────────
  const renderExercise = (logId: string, ex: any, isExpanded: boolean) => {
    const statusColor = ex.completed ? C.green : C.mid;

    return (
      <View key={ex.exerciseId} style={styles.exCard}>
        <View style={styles.exTopRow}>
          <TouchableOpacity
            style={styles.exCheckBtn}
            onPress={() => isExpanded && updateExerciseInLog(logId, ex.exerciseId, { completed: !ex.completed })}>
            {ex.completed
              ? <IconSymbol name="checkmark" size={16} color={C.green} />
              : <IconSymbol name="square" size={16} color={C.mid} />}
          </TouchableOpacity>
          <Text style={[styles.exName, ex.completed && styles.exNameDone]}>{ex.exerciseName}</Text>
          {ex.muscleGroup ? <Text style={styles.exMuscle}>{ex.muscleGroup}</Text> : null}
        </View>

        {isExpanded && (
          <View style={styles.exFields}>
            {/* Weight */}
            <View style={styles.exField}>
              <Text style={styles.exFieldLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.exFieldInput}
                keyboardType="numeric"
                value={String(ex.weight ?? 0)}
                onEndEditing={(e) => {
                  const val = parseFloat(e.nativeEvent.text) || 0;
                  updateExerciseInLog(logId, ex.exerciseId, { weight: val });
                }}
              />
            </View>
            {/* Sets */}
            <View style={styles.exField}>
              <Text style={styles.exFieldLabel}>Sets</Text>
              <TextInput
                style={styles.exFieldInput}
                keyboardType="numeric"
                value={String(ex.actualSets ?? 0)}
                onEndEditing={(e) => {
                  const val = parseInt(e.nativeEvent.text) || 0;
                  updateExerciseInLog(logId, ex.exerciseId, { actualSets: val });
                }}
              />
            </View>
            {/* Reps */}
            <View style={styles.exField}>
              <Text style={styles.exFieldLabel}>Reps</Text>
              <TextInput
                style={styles.exFieldInput}
                keyboardType="numeric"
                value={String(ex.actualReps ?? 0)}
                onEndEditing={(e) => {
                  const val = e.nativeEvent.text || '0';
                  updateExerciseInLog(logId, ex.exerciseId, { actualReps: val });
                }}
              />
            </View>
            {/* Rest Time */}
            <View style={styles.exField}>
              <Text style={styles.exFieldLabel}>Rest (s)</Text>
              <View style={styles.restRow}>
                <TouchableOpacity style={styles.restBtn}
                  onPress={() => updateExerciseInLog(logId, ex.exerciseId, { restSeconds: Math.max(0, (ex.restSeconds ?? 60) - 15) })}>
                  <Text style={styles.restBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.restValue}>{ex.restSeconds ?? 60}s</Text>
                <TouchableOpacity style={styles.restBtn}
                  onPress={() => updateExerciseInLog(logId, ex.exerciseId, { restSeconds: (ex.restSeconds ?? 60) + 15 })}>
                  <Text style={styles.restBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {!isExpanded && (
          <View style={styles.exSummaryRow}>
            <Text style={styles.exDetail}>{ex.actualSets}×{ex.actualReps}</Text>
            {ex.weight > 0 && <Text style={styles.exDetail}>{ex.weight}kg</Text>}
            {ex.restSeconds ? <Text style={styles.exDetail}>{ex.restSeconds}s rest</Text> : null}
          </View>
        )}
      </View>
    );
  };

  const renderLog = ({ item }: { item: WorkoutLog }) => {
    const statusColor = item.status === 'completed' ? C.green : C.mid;
    const completedCount = (item.completedExercises ?? []).filter((ex: any) => ex.completed).length;
    const totalCount = (item.completedExercises ?? []).length;
    const isExpanded = expandedLogId === item.id;

    return (
      <View style={[styles.logCard, isExpanded && styles.logCardExpanded]}>
        <TouchableOpacity
          style={styles.logHeader}
          onPress={() => setExpandedLogId(isExpanded ? null : item.id)}>
          <View>
            <Text style={styles.logPlan}>{item.planName}</Text>
            <Text style={styles.logDay}>{item.dayLabel}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <StatusBadge label={item.status === 'completed' ? 'Completed' : 'In Progress'} color={statusColor} />
            <Text style={styles.logTime}>{formatDateTime(item.loggedAt)}</Text>
            <IconSymbol name={isExpanded ? 'chevron.up' : 'chevron.down'} size={14} color={C.mid} />
          </View>
        </TouchableOpacity>

        {/* Exercise breakdown */}
        <View style={styles.exBreakdown}>
          <Text style={styles.exBreakdownText}>{completedCount}/{totalCount} exercises done</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` as any, backgroundColor: statusColor }]} />
          </View>
        </View>

        {/* Exercises list */}
        {(item.completedExercises ?? []).map((ex: any) => renderExercise(item.id, ex, isExpanded))}

        {/* Actions when expanded */}
        {isExpanded && item.status !== 'completed' && (
          <TouchableOpacity style={styles.completeBtn}
            onPress={() => markWorkoutComplete(item.id)}>
            <IconSymbol name="checkmark" size={16} color={C.white} />
            <Text style={styles.completeBtnText}>Mark Workout Complete</Text>
          </TouchableOpacity>
        )}

        {/* Trainer note */}
        {item.trainerNote ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Your note:</Text>
            <Text style={styles.noteText}>{item.trainerNote}</Text>
            <TouchableOpacity onPress={() => openNoteModal(item.id, item.trainerNote)}>
              <Text style={styles.editNote}>Edit note</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addNoteBtn} onPress={() => openNoteModal(item.id)}>
            <Text style={styles.addNoteBtnText}>+ Add trainer note</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IconSymbol name="chevron.left" size={20} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{clientName}'s Workout Logs</Text>
      </View>

      {/* Log Workout button — opens day picker */}
      <TouchableOpacity style={styles.startBtn} onPress={openDayPicker} disabled={starting}>
        <IconSymbol name="play.fill" size={18} color={C.white} />
        <Text style={styles.startBtnText}>{starting ? 'Loading Plan…' : 'Log Workout for Client'}</Text>
      </TouchableOpacity>

      {loading && !logs ? (
        <View style={{ padding: 16, gap: 10 }}>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</View>
      ) : (
        <FlatList
          data={logs ?? []}
          keyExtractor={item => item.id}
          renderItem={renderLog}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={triggerReload} tintColor={C.primary} />}
          ListEmptyComponent={<EmptyState icon={<IconSymbol name="clipboard" size={40} color={C.mid} />} title="No workout logs yet" subtitle={`${clientName} hasn't logged any workouts yet.`} />}
        />
      )}

      {/* Day Picker Modal */}
      <Modal visible={dayPickerVisible} transparent animationType="slide" onRequestClose={() => setDayPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 40 }]}>
            <Text style={styles.modalTitle}>Select Workout Day</Text>
            <Text style={{ fontSize: 13, color: C.mid, marginBottom: 16 }}>
              {cachedPlan?.name || 'Assigned Plan'} · Choose the day to log for {clientName}
            </Text>
            {planDays.map((day: any, idx: number) => {
              const exCount = day.exercises?.length ?? 0;
              const muscles = (day.exercises ?? [])
                .map((e: any) => e.muscleGroup).filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i)
                .join(', ');
              return (
                <TouchableOpacity
                  key={day.dayLabel ?? idx}
                  style={styles.dayPickerRow}
                  onPress={() => startWorkoutForDay(day)}
                >
                  <View style={styles.dayPickerLeft}>
                    <Text style={styles.dayPickerLabel}>{day.dayLabel}</Text>
                    <Text style={styles.dayPickerSub}>{exCount} exercises{muscles ? ` · ${muscles}` : ''}</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={C.mid} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={{ marginTop: 16, alignSelf: 'center' }} onPress={() => setDayPickerVisible(false)}>
              <Text style={{ color: C.mid, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!noteModal} transparent animationType="slide" onRequestClose={() => setNoteModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{noteModal?.existing ? 'Edit Note' : 'Add Trainer Note'}</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Write your feedback or coaching note…"
              multiline
              numberOfLines={4}
              value={noteText}
              onChangeText={setNoteText}
              autoFocus
            />
            <PrimaryButton label="Save Note" onPress={saveNote} loading={savingNote} />
            <TouchableOpacity style={{ marginTop: 10, alignSelf: 'center' }} onPress={() => setNoteModal(null)}>
              <Text style={{ color: C.mid, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, gap: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12 },
  startBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },
  logCard: { backgroundColor: C.white, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 10 },
  logCardExpanded: { borderWidth: 1.5, borderColor: C.primary },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logPlan: { fontSize: 15, fontWeight: '700', color: C.dark },
  logDay: { fontSize: 12, color: C.mid },
  logTime: { fontSize: 11, color: C.light },
  exBreakdown: { gap: 4 },
  exBreakdownText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  progressBar: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },

  // Exercise card styles
  exCard: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, marginVertical: 2 },
  exTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exCheckBtn: { padding: 4 },
  exName: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
  exNameDone: { textDecorationLine: 'line-through', color: C.mid },
  exMuscle: { fontSize: 10, color: C.mid, backgroundColor: '#E5E7EB', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  exSummaryRow: { flexDirection: 'row', gap: 12, marginTop: 4, paddingLeft: 28 },
  exDetail: { fontSize: 12, color: C.mid, fontWeight: '500' },

  // Editable fields
  exFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, paddingLeft: 28 },
  exField: { gap: 2 },
  exFieldLabel: { fontSize: 10, color: C.mid, fontWeight: '600' },
  exFieldInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, fontWeight: '600', color: C.dark, width: 60, textAlign: 'center', backgroundColor: C.white },

  // Rest time controls
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  restBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  restBtnText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  restValue: { fontSize: 14, fontWeight: '600', color: C.dark, minWidth: 36, textAlign: 'center' },

  // Complete workout button
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: 10, padding: 12, marginTop: 4 },
  completeBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  noteBox: { backgroundColor: C.primary + '10', borderRadius: 8, padding: 10, gap: 4 },
  noteLabel: { fontSize: 11, fontWeight: '700', color: C.primary },
  noteText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  editNote: { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 2 },
  addNoteBtn: { paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 8, borderStyle: 'dashed' },
  addNoteBtnText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 16 },
  noteInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, textAlignVertical: 'top', minHeight: 100, marginBottom: 16, color: C.dark },
  dayPickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dayPickerLeft: { flex: 1, gap: 2 },
  dayPickerLabel: { fontSize: 15, fontWeight: '700', color: C.dark },
  dayPickerSub: { fontSize: 12, color: C.mid },
});
