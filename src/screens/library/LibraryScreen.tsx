// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Library Screen
// ─────────────────────────────────────────────────────────────────────────────
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, R, S } from '../../constants/theme';
import { ExerciseAPI } from '../../services/workoutMockApi';
import VideoLibraryScreen from '../video/VideoLibraryScreen';
import ExercisesScreen from './ExercisesScreen';
import WorkoutsListScreen from './WorkoutsListScreen';

type LibraryTab = 'exercises' | 'workouts' | 'videos';

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('workouts');
  const [exerciseCount, setExerciseCount] = useState<number>(-1); // -1 = loading
  const navigation = useNavigation<any>();

  // Refresh exercise count every time this screen comes into focus
  // This ensures the +Workout button state is always accurate
  const loadExerciseCount = useCallback(async () => {
    try {
      const exercises = await ExerciseAPI.getAll();
      setExerciseCount(exercises.length);
    } catch {
      setExerciseCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExerciseCount();
    }, [loadExerciseCount])
  );

  const hasExercises = exerciseCount > 0;
  const countLoaded = exerciseCount >= 0;

  const tabs: { key: LibraryTab; label: string; icon: string }[] = [
    { key: 'workouts', label: 'Workouts', icon: '🏋️' },
    { key: 'exercises', label: 'Exercises', icon: '💪' },
    { key: 'videos', label: 'Videos', icon: '▶️' },
  ];

  const handleWorkoutPress = () => {
    if (!hasExercises) return; // button is visually disabled
    navigation.navigate('CreateWorkout', {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>

        {activeTab === 'workouts' && countLoaded && (
          <View>
            <TouchableOpacity
              style={[styles.headerBtn, !hasExercises && styles.headerBtnDisabled]}
              onPress={handleWorkoutPress}
              disabled={!hasExercises}
            >
              <Text style={[styles.headerBtnText, !hasExercises && styles.headerBtnTextDisabled]}>
                + Workout
              </Text>
            </TouchableOpacity>
            {!hasExercises && (
              <Text style={styles.noExercisesHint}>Add exercises first</Text>
            )}
          </View>
        )}

        {activeTab === 'exercises' && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('CreateExercise', {})}
          >
            <Text style={styles.headerBtnText}>+ Exercise</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'videos' && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('UploadVideo', {})}
          >
            <Text style={styles.headerBtnText}>+ Upload</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'exercises' && (
          <ExercisesScreen onExerciseCountChange={setExerciseCount} />
        )}
        {activeTab === 'workouts' && <WorkoutsListScreen />}
        {activeTab === 'videos' && <VideoLibraryScreen hideHeader />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.white, paddingHorizontal: S.lg, paddingTop: 52,
    paddingBottom: S.md, borderBottomWidth: 1, borderBottomColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.dark },
  headerBtn: {
    backgroundColor: C.primary, paddingHorizontal: S.md,
    paddingVertical: S.xs + 2, borderRadius: R.md,
  },
  headerBtnDisabled: { backgroundColor: C.border },
  headerBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  headerBtnTextDisabled: { color: C.mid },
  noExercisesHint: { fontSize: 10, color: C.red, marginTop: 3, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row', backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: S.sm + 2,
    borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 2,
  },
  tabActive: { borderBottomColor: C.primary },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 12, color: C.mid, fontWeight: '500' },
  tabLabelActive: { color: C.primary, fontWeight: '700' },
});
