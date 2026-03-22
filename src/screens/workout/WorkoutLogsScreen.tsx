// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../constants/theme';
// Lift Trainer App — TS-009 View Client Workout Logs & Add Notes
// ─────────────────────────────────────────────────────────────────────────────

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal, RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState, PrimaryButton, SkeletonCard, StatusBadge } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { WorkoutAPI } from '../../services/trainer.api';
import { WorkoutLog } from '../../types/trainer.types';
import { formatDateTime } from '../../utils/trainer.utils';

import { getTrainerId } from '../../services/session';

type Props = NativeStackScreenProps<ClientsStackParamList, 'WorkoutLogs'>;

export default function WorkoutLogsScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const [noteModal, setNoteModal] = useState<{ logId: string; existing?: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchLogs = useCallback(
    () => WorkoutAPI.getWorkoutLogs(getTrainerId(), clientId, 1).then(r => r.logs),
    [clientId],
  );
  const { data: logs, loading, refresh } = useAsync<WorkoutLog[]>(fetchLogs);

  const openNoteModal = (logId: string, existing?: string) => {
    setNoteModal({ logId, existing });
    setNoteText(existing ?? '');
  };

  const saveNote = async () => {
    if (!noteModal || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await WorkoutAPI.addNoteOnLog(getTrainerId(), clientId, noteModal.logId, noteText.trim());
      setNoteModal(null);
      refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const renderLog = ({ item }: { item: WorkoutLog }) => {
    const statusColor = item.status === 'completed' ? C.green : C.mid;
    const completedCount = item.completedExercises.filter(ex => ex.completed).length;
    const totalCount = item.completedExercises.length;

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <View>
            <Text style={styles.logPlan}>{item.planName}</Text>
            <Text style={styles.logDay}>{item.dayLabel}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <StatusBadge label={item.status === 'completed' ? 'Completed' : 'Incomplete'} color={statusColor} />
            <Text style={styles.logTime}>{formatDateTime(item.loggedAt)}</Text>
          </View>
        </View>

        {/* Exercise breakdown */}
        <View style={styles.exBreakdown}>
          <Text style={styles.exBreakdownText}>
            {completedCount}/{totalCount} exercises done
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` as any, backgroundColor: statusColor }]} />
          </View>
        </View>

        {/* Exercises list */}
        {item.completedExercises.map(ex => (
          <View key={ex.exerciseId} style={styles.exRow}>
            <Text style={{ fontSize: 14 }}>{ex.completed ? '✅' : '⬜'}</Text>
            <Text style={styles.exName}>{ex.exerciseName}</Text>
            <Text style={styles.exDetail}>{ex.actualSets}×{ex.actualReps}</Text>
          </View>
        ))}

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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: C.primary, fontWeight: '500' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{clientName}'s Workout Logs</Text>
      </View>

      {loading && !logs ? (
        <View style={{ padding: 16, gap: 10 }}>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</View>
      ) : (
        <FlatList
          data={logs ?? []}
          keyExtractor={item => item.id}
          renderItem={renderLog}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.primary} />}
          ListEmptyComponent={<EmptyState emoji="📋" title="No workout logs yet" subtitle={`${clientName} hasn't logged any workouts yet.`} />}
        />
      )}

      {/* Note modal */}
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
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, gap: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  logCard: { backgroundColor: C.white, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 10 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logPlan: { fontSize: 15, fontWeight: '700', color: C.dark },
  logDay: { fontSize: 12, color: C.mid },
  logTime: { fontSize: 11, color: C.light },
  exBreakdown: { gap: 4 },
  exBreakdownText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  progressBar: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  exName: { flex: 1, fontSize: 13, color: '#374151' },
  exDetail: { fontSize: 12, color: C.mid, fontWeight: '500' },
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
});
