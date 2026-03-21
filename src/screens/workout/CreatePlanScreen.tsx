// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-008 Create & Assign Workout Plan
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { WorkoutAPI } from '../../services/mockApi';
import { WORKOUT_DAYS } from '../../constants/trainer.constants';
import { PrimaryButton } from '../../components/common';
import { WorkoutDay, Exercise } from '../../types/trainer.types';

const TRAINER_ID = 'trainer-001';
const TOKEN = '';

type Props = NativeStackScreenProps<ClientsStackParamList, 'CreatePlan'>;

export default function CreatePlanScreen({ navigation, route }: Props) {
  const { clientId, clientName, existingPlanId } = route.params;
  const [planName, setPlanName] = useState('');
  const [days, setDays] = useState<WorkoutDay[]>(
    WORKOUT_DAYS.map(d => ({ dayLabel: d, exercises: [], restDay: false }))
  );
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const activeDay = days[activeDayIdx];

  const toggleRestDay = (idx: number) => {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, restDay: !d.restDay, exercises: [] } : d));
  };

  const addExercise = () => {
    const blank: Exercise = { id: Date.now().toString(), name: '', sets: 3, reps: '10', restSeconds: 60 };
    setDays(prev => prev.map((d, i) => i === activeDayIdx
      ? { ...d, exercises: [...d.exercises, blank] }
      : d
    ));
  };

  const updateExercise = (exIdx: number, field: keyof Exercise, value: string | number) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== activeDayIdx) return d;
      const exs = d.exercises.map((ex, j) => j === exIdx ? { ...ex, [field]: value } : ex);
      return { ...d, exercises: exs };
    }));
  };

  const removeExercise = (exIdx: number) => {
    setDays(prev => prev.map((d, i) => i !== activeDayIdx ? d
      : { ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) }
    ));
  };

  const validate = (): boolean => {
    if (!planName.trim()) { Alert.alert('Validation', 'Please enter a plan name.'); return false; }
    const hasContent = days.some(d => !d.restDay && d.exercises.length > 0);
    if (!hasContent) { Alert.alert('Validation', 'Add at least one exercise to any day.'); return false; }
    return true;
  };

  const handleSaveAndAssign = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await WorkoutAPI.createPlan({ name: planName, trainerId: TRAINER_ID, memberId: clientId, memberName: clientName, days, isActive: true }, TOKEN);
      await WorkoutAPI.assignPlan(res.planId, clientId, TOKEN);
      Alert.alert('Success', `Plan "${planName}" assigned to ${clientName}!`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Plan for {clientName}</Text>
        </View>

        {/* Plan name */}
        <View style={styles.planNameRow}>
          <TextInput
            style={styles.planNameInput}
            placeholder="Plan name (e.g. 8-Week Strength)"
            value={planName}
            onChangeText={setPlanName}
          />
        </View>

        {/* Day tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
          {days.map((d, i) => (
            <TouchableOpacity
              key={d.dayLabel}
              style={[styles.dayTab, i === activeDayIdx && styles.dayTabActive, d.restDay && styles.dayTabRest]}
              onPress={() => setActiveDayIdx(i)}
            >
              <Text style={[styles.dayTabText, i === activeDayIdx && styles.dayTabTextActive]}>
                {d.dayLabel.slice(0, 3)}
              </Text>
              {d.restDay && <Text style={styles.restLabel}>REST</Text>}
              {!d.restDay && d.exercises.length > 0 && (
                <Text style={styles.exCount}>{d.exercises.length}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Day content */}
        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={styles.restToggleRow}>
            <Text style={styles.dayLabel}>{activeDay.dayLabel}</Text>
            <TouchableOpacity
              style={[styles.restToggle, activeDay.restDay && styles.restToggleActive]}
              onPress={() => toggleRestDay(activeDayIdx)}
            >
              <Text style={[styles.restToggleText, activeDay.restDay && { color: C.white }]}>
                {activeDay.restDay ? '✓ Rest Day' : 'Mark as Rest Day'}
              </Text>
            </TouchableOpacity>
          </View>

          {!activeDay.restDay && (
            <>
              {activeDay.exercises.map((ex, exIdx) => (
                <View key={ex.id} style={styles.exerciseCard}>
                  <View style={styles.exHeader}>
                    <Text style={styles.exNumber}>#{exIdx + 1}</Text>
                    <TouchableOpacity onPress={() => removeExercise(exIdx)}>
                      <Text style={styles.removeBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.exInput}
                    placeholder="Exercise name (e.g. Barbell Squat)"
                    value={ex.name}
                    onChangeText={v => updateExercise(exIdx, 'name', v)}
                  />
                  <View style={styles.exMetaRow}>
                    <View style={styles.exMeta}>
                      <Text style={styles.exMetaLabel}>Sets</Text>
                      <TextInput
                        style={styles.exMetaInput}
                        keyboardType="number-pad"
                        maxLength={2}
                        value={String(ex.sets)}
                        onChangeText={v => updateExercise(exIdx, 'sets', parseInt(v) || 1)}
                      />
                    </View>
                    <View style={styles.exMeta}>
                      <Text style={styles.exMetaLabel}>Reps</Text>
                      <TextInput
                        style={styles.exMetaInput}
                        placeholder="10"
                        value={ex.reps}
                        onChangeText={v => updateExercise(exIdx, 'reps', v)}
                      />
                    </View>
                    <View style={styles.exMeta}>
                      <Text style={styles.exMetaLabel}>Rest (sec)</Text>
                      <TextInput
                        style={styles.exMetaInput}
                        keyboardType="number-pad"
                        maxLength={3}
                        value={String(ex.restSeconds)}
                        onChangeText={v => updateExercise(exIdx, 'restSeconds', parseInt(v) || 0)}
                      />
                    </View>
                  </View>
                  <TextInput
                    style={[styles.exInput, { marginTop: 6 }]}
                    placeholder="Trainer notes (optional)"
                    value={ex.notes ?? ''}
                    onChangeText={v => updateExercise(exIdx, 'notes', v)}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.addExBtn} onPress={addExercise}>
                <Text style={styles.addExBtnText}>+ Add Exercise</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <PrimaryButton label="Save & Assign Plan" onPress={handleSaveAndAssign} loading={loading} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, gap: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back: { color: C.primary, fontSize: 15, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  planNameRow: { padding: 16, paddingBottom: 0 },
  planNameInput: { backgroundColor: C.white, borderRadius: 10, padding: 12, fontSize: 16, borderWidth: 1, borderColor: C.border, fontWeight: '600' },
  dayTabs: { paddingHorizontal: 12, paddingVertical: 12, maxHeight: 72 },
  dayTab: { alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 10, backgroundColor: '#F3F4F6', marginHorizontal: 4 },
  dayTabActive: { backgroundColor: C.primary },
  dayTabRest: { backgroundColor: C.border },
  dayTabText: { fontSize: 12, fontWeight: '700', color: C.mid },
  dayTabTextActive: { color: C.white },
  restLabel: { fontSize: 8, color: C.light, fontWeight: '700', letterSpacing: 0.5 },
  exCount: { fontSize: 9, color: C.white, fontWeight: '700', backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 4, marginTop: 2 },
  scroll: { flex: 1 },
  restToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dayLabel: { fontSize: 17, fontWeight: '700', color: C.dark },
  restToggle: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: C.white },
  restToggleActive: { backgroundColor: C.mid, borderColor: C.mid },
  restToggleText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  exerciseCard: { backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  exNumber: { fontSize: 13, fontWeight: '700', color: C.primary },
  removeBtn: { fontSize: 16, color: C.red },
  exInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, fontSize: 14, color: C.dark, backgroundColor: C.bg },
  exMetaRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  exMeta: { flex: 1 },
  exMetaLabel: { fontSize: 11, color: C.mid, marginBottom: 4 },
  exMetaInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 8, fontSize: 14, textAlign: 'center', backgroundColor: C.bg },
  addExBtn: { borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  addExBtnText: { color: C.primary, fontWeight: '600', fontSize: 15 },
  footer: { padding: 16, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
});
