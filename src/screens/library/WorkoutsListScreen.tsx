// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Workouts List Screen
// Refreshes on focus so newly created workouts appear immediately
// ─────────────────────────────────────────────────────────────────────────────
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState, SkeletonCard } from '../../components/common';
import { C, R, S } from '../../constants/theme';
import { MUSCLE_GROUP_ICONS } from '../../services/workoutDemoData';
import { WorkoutAPI } from '../../services/workoutMockApi';
import { formatDate } from '../../utils/trainer.utils';

export default function WorkoutsListScreen() {
  const navigation = useNavigation<any>();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

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
    return (
      <TouchableOpacity style={styles.card}
        onPress={() => navigation.navigate('CreateWorkout', { workout: item })} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workoutName}>{item.name}</Text>
            {item.description ? <Text style={styles.workoutDesc} numberOfLines={1}>{item.description}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 18, color: C.mid }}>🗑</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <StatPill icon="🏋️" label={`${(item.exercises ?? []).length} exercises`} />
          <StatPill icon="🔢" label={`${item.totalSets ?? 0} sets`} />
          <StatPill icon="⏱" label={`~${item.estimatedMinutes ?? 0} min`} />
        </View>
        {muscleGroups.length > 0 && (
          <View style={styles.muscleRow}>
            {muscleGroups.slice(0, 5).map(g => (
              <View key={g} style={styles.muscleChip}>
                <Text style={styles.muscleChipText}>{MUSCLE_GROUP_ICONS[g] ?? '💪'} {g}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.createdAt}>Created {formatDate(item.createdAt)}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('CreateWorkout', { workout: item })}>
            <Text style={styles.editBtnText}>Edit Workout →</Text>
          </TouchableOpacity>
        </View>
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
          <EmptyState emoji="🏋️" title="No workouts yet"
            subtitle="Add exercises first, then tap + Workout to create your first workout" />
        )}
      />
    </View>
  );
}

function StatPill({ icon, label }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillIcon}>{icon}</Text>
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
