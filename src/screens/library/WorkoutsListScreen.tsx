// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Workouts List Screen
// Refreshes on focus so newly created workouts appear immediately
// ─────────────────────────────────────────────────────────────────────────────
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { collectionGroup, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState, SkeletonCard } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { C, R, S } from '../../constants/theme';
import { auth, db } from '../../firebase/config';
import { MUSCLE_GROUP_ICONS } from '../../services/workoutDemoData';
import { WorkoutAPI } from '../../services/workoutMockApi';
import { formatDate } from '../../utils/trainer.utils';

export default function WorkoutsListScreen() {
  const navigation = useNavigation<any>();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await WorkoutAPI.getAll();
      setWorkouts(data);
    } catch (e) {
      console.log('Workout load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh every time this tab comes into view
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  // Subscribe to this member's workout logs (so the member sees recent logs on same page)
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collectionGroup(db, 'workoutLogs'), where('memberId', '==', uid), orderBy('completedAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const logs = snap.docs.map(d => d.data()).sort((a: any, b: any) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
      setWorkoutLogs(logs);
    }, err => { /* ignore */ });
    return () => unsub();
  }, []);

  const handleDelete = (wkt) => {
    Alert.alert('Delete Workout', `Delete "${wkt.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await WorkoutAPI.delete(wkt.id);
          setWorkouts(prev => prev.filter(w => w.id !== wkt.id));
        },
      },
    ]);
  };

  const renderWorkout = ({ item }) => {
    const muscleGroups = [...new Set((item.exercises ?? []).map(e => e.exerciseMuscleGroup).filter(Boolean))];
    const totalWarmupSets = (item.exercises ?? []).reduce((s, e) => s + ((e.warmupSets ?? 0)), 0);
    const warmupExerciseCount = (item.exercises ?? []).filter(e => (e.warmupSets ?? 0) > 0).length;
    return (
      <TouchableOpacity style={styles.card}
        onPress={() => navigation.navigate('CreateWorkout', { workout: item })} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workoutName}>{item.name}</Text>
            {item.description ? <Text style={styles.workoutDesc} numberOfLines={1}>{item.description}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <IconSymbol name="trash" size={18} color={C.mid} />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <StatPill icon="figure.strengthtraining.traditional" label={`${(item.exercises ?? []).length} exercises`} />
          <StatPill icon="number" label={`${item.totalSets ?? 0} sets`} />
          {totalWarmupSets > 0 && (
            <StatPill icon="bolt.fill" label={`${totalWarmupSets} warm-up sets`} />
          )}
          <StatPill icon="timer" label={`~${item.estimatedMinutes ?? 0} min`} />
        </View>
        {muscleGroups.length > 0 && (
          <View style={styles.muscleRow}>
            {muscleGroups.slice(0, 5).map(g => (
              <View key={g} style={styles.muscleChip}>
                <IconSymbol name={MUSCLE_GROUP_ICONS[g] ?? 'dumbbell'} size={14} color={C.primary} />
                <Text style={[styles.muscleChipText, { marginLeft: 8 }]}>{g}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.createdAt}>Created {formatDate(item.createdAt)}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('CreateWorkout', { workout: item })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.editBtnText}>Edit Workout</Text>
              <IconSymbol name="chevron.right" size={14} color={C.primary} />
            </View>
          </TouchableOpacity>
        </View>
        {/* Recent personal workout logs (member) */}
        {workoutLogs.length > 0 && (
          <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 12, color: C.mid, marginBottom: 6 }}>Your recent workout logs</Text>
            {workoutLogs.slice(0, 3).map((log, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>{log.workoutName ?? log.name ?? 'Workout'}</Text>
                  <Text style={{ fontSize: 12, color: C.mid }}>{log.completedAt ? new Date(log.completedAt).toLocaleDateString() : '—'} · {Math.round((log.durationSeconds ?? 0) / 60)} min</Text>
                </View>
                <TouchableOpacity onPress={() => {/* future: open log detail */}}>
                  <Text style={{ color: C.primary }}>View</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={workouts}
        keyExtractor={item => item.id}
        renderItem={renderWorkout}
        contentContainerStyle={{ padding: S.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadWorkouts} tintColor={C.primary} />}
        ListHeaderComponent={loading && workouts.length === 0 ? (
          <View style={{ gap: S.sm }}>
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </View>
        ) : null}
        ListEmptyComponent={loading ? null : (
          <EmptyState icon={<IconSymbol name="dumbbell" size={48} color={C.mid} />} title="No workouts yet"
            subtitle="Add exercises first, then tap + Workout to create your first workout" />
        )}
      />
    </View>
  );
}

function StatPill({ icon, label }) {
  return (
    <View style={styles.statPill}>
      {typeof icon === 'string' ? (
        <IconSymbol name={icon} size={16} color={C.primary} style={{ marginRight: 8 }} />
      ) : (
        <Text style={styles.statPillIcon}>{icon}</Text>
      )}
      <Text style={styles.statPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: R.lg, padding: S.lg, marginBottom: S.md, gap: S.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm },
  workoutName: { fontSize: 18, fontWeight: '700', color: C.dark },
  workoutDesc: { fontSize: 13, color: C.mid, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: S.sm },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bg, paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.full },
  statPillIcon: { fontSize: 12 },
  statPillText: { fontSize: 12, color: C.mid, fontWeight: '500' },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  muscleChip: { backgroundColor: C.primaryBg, paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.full },
  muscleChipText: { fontSize: 11, color: C.primary, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  createdAt: { fontSize: 11, color: C.mid },
  editBtn: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, backgroundColor: C.primaryBg, borderRadius: R.md },
  editBtnText: { fontSize: 13, color: C.primary, fontWeight: '600' },
});
