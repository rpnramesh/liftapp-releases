// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Create / Edit Exercise Screen
// Validates duplicate names. Navigates back immediately on save so
// ExercisesScreen re-fetches via useFocusEffect.
// ─────────────────────────────────────────────────────────────────────────────
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PrimaryButton, ScreenHeader } from '../../components/common';
import { C, R, S } from '../../constants/theme';
import { LibraryStackParamList } from '../../navigation/TrainerNavigator';
import { MUSCLE_GROUPS, MUSCLE_GROUP_ICONS } from '../../services/workoutDemoData';
import { ExerciseAPI } from '../../services/workoutMockApi';

type Props = NativeStackScreenProps<LibraryStackParamList, 'CreateExercise'>;

export default function CreateExerciseScreen({ navigation, route }: Props) {
  const existing = route.params?.exercise;
  const isEditing = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [muscleGroup, setMuscleGroup] = useState(existing?.muscleGroup ?? 'Chest');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Exercise name is required';
    if (!description.trim()) e.description = 'Description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Check for duplicate name
      const allExercises = await ExerciseAPI.getAll();
      const duplicate = allExercises.find(ex =>
        ex.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        ex.id !== (existing?.id ?? '')
      );
      if (duplicate) {
        setErrors(e => ({ ...e, name: `An exercise named "${name.trim()}" already exists` }));
        setSaving(false);
        return;
      }

      if (isEditing && existing) {
        await ExerciseAPI.update(existing.id, {
          name: name.trim(),
          description: description.trim(),
          muscleGroup,
          exerciseName: name.trim(),
          exerciseMuscleGroup: muscleGroup,
        });
      } else {
        await ExerciseAPI.create({
          name: name.trim(),
          description: description.trim(),
          muscleGroup,
        });
      }
      // Go back — ExercisesScreen will auto-refresh via useFocusEffect
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Failed to save exercise');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader
          title={isEditing ? 'Edit Exercise' : 'New Exercise'}
          onBack={() => navigation.goBack()}
          rightLabel={saving ? 'Saving…' : 'Save'}
          onRight={handleSave}
          rightColor={C.primary}
        />

        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: 60 }}>
          {/* Name */}
          <View>
            <Text style={styles.label}>Exercise Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="e.g. Barbell Bench Press"
              placeholderTextColor={C.mid}
              value={name}
              onChangeText={v => { setName(v); setErrors(p => ({ ...p, name: '' })); }}
              autoFocus={!isEditing}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* Muscle Group */}
          <View>
            <Text style={styles.label}>Muscle Group *</Text>
            <View style={styles.chipWrap}>
              {MUSCLE_GROUPS.map(g => (
                <TouchableOpacity key={g}
                  style={[styles.groupChip, muscleGroup === g && styles.groupChipActive]}
                  onPress={() => setMuscleGroup(g)}>
                  <Text style={styles.groupChipIcon}>{MUSCLE_GROUP_ICONS[g] ?? '💪'}</Text>
                  <Text style={[styles.groupChipText, muscleGroup === g && styles.groupChipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View>
            <Text style={styles.label}>Description / Coaching Notes *</Text>
            <Text style={styles.labelHint}>
              Explain the movement, form cues, and tips. This appears when clients view the exercise.
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              placeholder="Describe how to perform this exercise correctly…"
              placeholderTextColor={C.mid}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              value={description}
              onChangeText={v => { setDescription(v); setErrors(p => ({ ...p, description: '' })); }}
            />
            {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
          </View>

          <PrimaryButton
            label={isEditing ? 'Save Changes' : 'Create Exercise'}
            onPress={handleSave}
            loading={saving}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: C.dark, marginBottom: S.xs },
  labelHint: { fontSize: 12, color: C.mid, marginBottom: S.sm, lineHeight: 17 },
  errorText: { fontSize: 12, color: C.red, marginTop: S.xs },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: S.md, fontSize: 15, color: C.dark, minHeight: 44 },
  inputError: { borderColor: C.red },
  textArea: { minHeight: 120, paddingTop: S.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  groupChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  groupChipIcon: { fontSize: 14 },
  groupChipText: { fontSize: 12, color: C.mid, fontWeight: '500' },
  groupChipTextActive: { color: C.white, fontWeight: '700' },
});
