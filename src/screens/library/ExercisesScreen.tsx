// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Exercises Screen
// Fix 1: Prevent deleting exercise if used in a workout, show which workouts
// Fix 2: User must remove exercise from workouts first before deleting
// ─────────────────────────────────────────────────────────────────────────────
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { EmptyState, SkeletonCard } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { C, GS, R, S } from '../../constants/theme';
import { useDebounce } from '../../hooks/useTrainer';
import { MUSCLE_GROUP_ICONS, MUSCLE_GROUPS } from '../../services/workoutDemoData';
import { TRACKING_METRICS } from '../../types/workout.types';
import { ExerciseAPI, WorkoutAPI } from '../../services/workoutMockApi';

interface Props {
  onExerciseCountChange?: (count: number) => void;
}

export default function ExercisesScreen({ onExerciseCountChange }: Props) {
  const navigation = useNavigation<any>();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const debouncedSearch = useDebounce(search, 250);

  const loadExercises = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ExerciseAPI.getAll();
      setExercises(data);
      onExerciseCountChange?.(data.length);
    } catch (e) {
      console.log('Exercise load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadExercises(); }, [loadExercises]));

  const filtered = exercises.filter(ex => {
    const matchSearch =
      (ex.name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (ex.muscleGroup ?? '').toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchGroup = !filterGroup || ex.muscleGroup === filterGroup;
    return matchSearch && matchGroup;
  });

  const grouped = filtered.reduce((acc, ex) => {
    const key = ex.muscleGroup ?? 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ex);
    return acc;
  }, {});

  // Check which library workouts use this exercise, then block or allow delete
  const handleDelete = async (ex) => {
    try {
      // Load all library workouts to check usage
      const workouts = await WorkoutAPI.getAll();
      const usingWorkouts = workouts.filter(w =>
        (w.exercises ?? []).some(e =>
          (e.exerciseId === ex.id) || (e.exerciseName === ex.name)
        )
      );

      if (usingWorkouts.length > 0) {
        const workoutNames = usingWorkouts.map(w => `• ${w.name}`).join('\n');
        Alert.alert(
          'Cannot Delete Exercise',
          `"${ex.name}" is used in ${usingWorkouts.length} workout${usingWorkouts.length > 1 ? 's' : ''}:\n\n${workoutNames}\n\nRemove this exercise from the above workouts first, then try deleting again.`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Safe to delete — confirm first
      Alert.alert(
        'Delete Exercise',
        `Delete "${ex.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete', style: 'destructive',
            onPress: async () => {
              await ExerciseAPI.delete(ex.id);
              setExercises(prev => {
                const updated = prev.filter(e => e.id !== ex.id);
                onExerciseCountChange?.(updated.length);
                return updated;
              });
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Error', 'Could not check workout usage. Please try again.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <IconSymbol name="magnifyingglass" size={16} color={C.mid} />
        <TextInput style={styles.searchInput} placeholder="Search exercises…"
          placeholderTextColor={C.mid} value={search} onChangeText={setSearch}
          clearButtonMode="while-editing" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: S.lg, gap: S.sm, paddingVertical: S.xs }}>
        <TouchableOpacity
          style={[styles.filterChip, !filterGroup && styles.filterChipActive]}
          onPress={() => setFilterGroup(null)}>
          <Text style={[styles.filterText, !filterGroup && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        {MUSCLE_GROUPS.map(g => (
          <TouchableOpacity key={g}
            style={[styles.filterChip, filterGroup === g && styles.filterChipActive]}
            onPress={() => setFilterGroup(filterGroup === g ? null : g)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconSymbol name={MUSCLE_GROUP_ICONS[g] ?? 'dumbbell'} size={14} color={filterGroup === g ? C.white : C.primary} />
              <Text style={[styles.filterText, filterGroup === g && styles.filterTextActive]}>{g}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ padding: S.lg, gap: S.sm }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={Object.entries(grouped)}
          keyExtractor={([group]) => group}
          contentContainerStyle={{ padding: S.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadExercises} tintColor={C.primary} />}
          ListEmptyComponent={
              <EmptyState icon={<IconSymbol name="dumbbell" size={48} color={C.mid} />}
                title={search ? 'No exercises found' : 'No exercises yet'}
                subtitle={search ? 'Try a different search' : 'Tap + Exercise above to add your first exercise'} />
          }
          renderItem={({ item: [group, exList] }) => (
            <View style={{ marginBottom: S.lg }}>
              <View style={styles.groupHeader}>
                <IconSymbol name={MUSCLE_GROUP_ICONS[group] ?? 'dumbbell'} size={16} color={C.primary} />
                <Text style={styles.groupTitle}>{group}</Text>
                <Text style={styles.groupCount}>{exList.length}</Text>
              </View>
              {exList.map(ex => (
                <TouchableOpacity key={ex.id} style={styles.exerciseCard}
                  onPress={() => setEditModal(ex)} activeOpacity={0.85}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseDesc} numberOfLines={1}>{ex.description}</Text>
                    {ex.trackingMetric && (
                      <Text style={styles.trackingBadge}>
                        {TRACKING_METRICS.find(m => m.value === ex.trackingMetric)?.label ?? ex.trackingMetric}
                      </Text>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.editBtn}
                      onPress={() => navigation.navigate('CreateExercise', { exercise: ex })}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(ex)}>
                      <IconSymbol name="trash" size={18} color={C.mid} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}

      {editModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditModal(null)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModal(null)}>
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>{editModal.name}</Text>
              <View style={styles.modalGroupBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <IconSymbol name={MUSCLE_GROUP_ICONS[editModal.muscleGroup] ?? 'dumbbell'} size={16} color={C.primary} />
                  <Text style={styles.modalGroupText}>{editModal.muscleGroup}</Text>
                  {editModal.trackingMetric && (
                    <Text style={styles.modalTrackingText}>
                      {'· ' + (TRACKING_METRICS.find(m => m.value === editModal.trackingMetric)?.label ?? editModal.trackingMetric)}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.modalDesc}>{editModal.description}</Text>
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={[GS.btnOutline, { flex: 1 }]}
                  onPress={() => { setEditModal(null); navigation.navigate('CreateExercise', { exercise: editModal }); }}>
                  <Text style={{ color: C.primary, fontWeight: '600' }}>Edit Exercise</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[GS.btnPrimary, { flex: 1 }]} onPress={() => setEditModal(null)}>
                  <Text style={{ color: C.white, fontWeight: '600' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginHorizontal: S.lg, marginTop: S.md, marginBottom: S.xs, backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: S.md, height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: C.dark },
  filterRow: { maxHeight: 44 },
  filterChip: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 12, color: C.mid, fontWeight: '500' },
  filterTextActive: { color: C.white, fontWeight: '700' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  groupIcon: { fontSize: 16 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  groupCount: { fontSize: 12, color: C.mid, backgroundColor: C.border, paddingHorizontal: S.sm, paddingVertical: 2, borderRadius: R.full },
  exerciseCard: { backgroundColor: C.white, borderRadius: R.lg, padding: S.md, marginBottom: S.sm, flexDirection: 'row', alignItems: 'flex-start', gap: S.md, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: C.dark, marginBottom: 3 },
  exerciseDesc: { fontSize: 12, color: C.mid, lineHeight: 17 },
  trackingBadge: { fontSize: 11, color: C.primary, fontWeight: '600', marginTop: 4 },
  modalTrackingText: { fontSize: 13, color: C.primary, fontWeight: '600' },
  cardActions: { alignItems: 'center', gap: S.sm, paddingTop: 2 },
  editBtn: { backgroundColor: C.primaryBg, paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.sm },
  editBtnText: { fontSize: 12, color: C.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: S.xl, paddingBottom: 36, gap: S.md },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: S.sm },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.dark },
  modalGroupBadge: { backgroundColor: C.primaryBg, paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full, alignSelf: 'flex-start' },
  modalGroupText: { fontSize: 13, color: C.primary, fontWeight: '600' },
  modalDesc: { fontSize: 14, color: '#374151', lineHeight: 22 },
  modalBtnRow: { flexDirection: 'row', gap: S.md, marginTop: S.sm },
});
