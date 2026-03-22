// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Member Details Screen
// Shows member's name, height, weight, goal weight, measurements
// Trainer can edit — changes sync to member app immediately
// ─────────────────────────────────────────────────────────────────────────────
import { useFocusEffect } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenHeader } from '../../components/common';
import { C, R, S } from '../../constants/theme';
import { db } from '../../firebase/config';

const MEASUREMENT_TYPES = ['Chest', 'Waist', 'Hips', 'Bicep (L)', 'Bicep (R)', 'Thigh (L)', 'Thigh (R)', 'Shoulder', 'Calf'];

export default function MemberDetailsScreen({ navigation, route }: any) {
  const { clientId, clientName } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState<any>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [gymId, setGymId] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [editingMeasure, setEditingMeasure] = useState<string | null>(null);
  const [measureInput, setMeasureInput] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get trainer's gymId
      const trainerSnap = await getDoc(doc(db, 'trainers', require('../../services/session').getTrainerId()));
      const gId = trainerSnap.data()?.gymId ?? require('../../services/session').getTrainerId();
      setGymId(gId);

      // Get member data
      const memberSnap = await getDoc(doc(db, 'members', clientId));
      if (!memberSnap.exists()) return;
      const m = memberSnap.data();
      setMember(m);
      setName(m.name ?? m.fullName ?? '');
      setHeight(m.height ? String(m.height) : '');
      setWeight(m.weight ? String(m.weight) : '');
      setGoalWeight(m.goalWeight ? String(m.goalWeight) : '');

      // Get measurements
      const measureSnap = await getDocs(
        query(collection(db, 'gyms', gId, 'measurements'), where('memberId', '==', clientId))
      ).catch(() => ({ docs: [] }));
      const allMeasures = measureSnap.docs.map((d: any) => d.data());
      // Get latest value for each type
      const latestByType: Record<string, any> = {};
      for (const m of allMeasures) {
        if (!latestByType[m.type] || m.loggedAt > latestByType[m.type].loggedAt) {
          latestByType[m.type] = m;
        }
      }
      setMeasurements(Object.values(latestByType));
    } catch (e) {
      console.log('Load member details error:', e);
    } finally { setLoading(false); }
  }, [clientId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSaveBasics = async () => {
    setSaving(true);
    try {
      const updates: any = {};
      if (name.trim()) updates.name = name.trim();
      if (height) updates.height = parseFloat(height) || 0;
      if (weight) updates.weight = parseFloat(weight) || 0;
      if (goalWeight) updates.goalWeight = parseFloat(goalWeight) || 0;
      updates.updatedAt = Date.now();
      await updateDoc(doc(db, 'members', clientId), updates);
      Alert.alert('Saved ✅', 'Member details updated and synced to their app.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const handleSaveMeasurement = async (type: string) => {
    const val = parseFloat(measureInput);
    if (!val || !gymId) return;
    try {
      const ref = doc(collection(db, 'gyms', gymId, 'measurements'));
      await setDoc(ref, {
        id: ref.id,
        memberId: clientId,
        gymId,
        type,
        value: val,
        loggedAt: Date.now(),
        addedByTrainer: true,
      });
      setEditingMeasure(null);
      setMeasureInput('');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to save measurement.');
    }
  };

  const getMeasure = (type: string) => {
    const m = measurements.find(m => m.type === type || m.type === type.split(' ')[0]);
    return m ? `${m.value} cm` : '—';
  };

  const parsedH = parseFloat(height);
  const parsedW = parseFloat(weight);
  // Use member's saved values as fallback so BMI doesn't disappear while editing
  const effH = parsedH > 0 ? parsedH : (member?.height ?? 0);
  const effW = parsedW > 0 ? parsedW : (member?.weight ?? 0);
  const bmiNum = effH > 0 && effW > 0
    ? effW / ((effH / 100) ** 2)
    : null;
  const bmi = bmiNum ? bmiNum.toFixed(1) : null;
  const bmiCat = bmiNum
    ? (bmiNum < 18.5 ? 'Underweight' : bmiNum < 25 ? 'Normal' : bmiNum < 30 ? 'Overweight' : 'Obese')
    : null;
  const bmiColor = bmiNum
    ? (bmiNum < 18.5 ? '#3B82F6' : bmiNum < 25 ? C.green : bmiNum < 30 ? C.amber : C.red)
    : C.mid;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader
        title={`${clientName} — Details`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={{ padding: S.lg, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={C.primary} />}>

        {/* ── Basic Info ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Basic Information</Text>
          <Text style={s.hint}>Changes sync to the member's app immediately</Text>

          {[
            { label: '👤 Full Name', value: name, onChange: setName, keyboard: 'default' },
            { label: '📏 Height (cm)', value: height, onChange: setHeight, keyboard: 'decimal-pad' },
            { label: '⚖️ Current Weight (kg)', value: weight, onChange: setWeight, keyboard: 'decimal-pad' },
            { label: '🎯 Goal Weight (kg)', value: goalWeight, onChange: setGoalWeight, keyboard: 'decimal-pad' },
          ].map(({ label, value, onChange, keyboard }) => (
            <View key={label} style={s.fieldRow}>
              <Text style={s.fieldLabel}>{label}</Text>
              <TextInput
                style={s.fieldInput}
                value={value}
                onChangeText={onChange}
                keyboardType={keyboard as any}
                placeholderTextColor={C.mid}
                placeholder="—"
              />
            </View>
          ))}

          {bmi && (
            <View style={s.bmiRow}>
              <Text style={s.bmiLabel}>Calculated BMI</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.bmiValue, { color: bmiColor }]}>{bmi}</Text>
                <Text style={{ fontSize: 11, color: bmiColor, fontWeight: '600', marginTop: 1 }}>{bmiCat}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={s.saveBtn} onPress={handleSaveBasics} disabled={saving}>
            {saving
              ? <ActivityIndicator color={C.white} size="small" />
              : <Text style={s.saveBtnText}>Save Basic Info</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Measurements ── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Body Measurements</Text>
            <TouchableOpacity onPress={loadData}>
              <Text style={{ color: C.primary, fontSize: 13 }}>↻ Refresh</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.hint}>Tap any measurement to update it</Text>

          {MEASUREMENT_TYPES.map(type => (
            <View key={type}>
              <TouchableOpacity
                style={s.measureRow}
                onPress={() => {
                  setEditingMeasure(editingMeasure === type ? null : type);
                  setMeasureInput('');
                }}>
                <Text style={s.measureType}>{type}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.measureValue}>{getMeasure(type)}</Text>
                  <Text style={{ color: C.primary, fontSize: 13 }}>
                    {editingMeasure === type ? '▲' : '✏️'}
                  </Text>
                </View>
              </TouchableOpacity>

              {editingMeasure === type && (
                <View style={s.measureEditRow}>
                  <TextInput
                    style={s.measureInput}
                    placeholder="Enter value in cm"
                    placeholderTextColor={C.mid}
                    keyboardType="decimal-pad"
                    value={measureInput}
                    onChangeText={setMeasureInput}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[s.measureSaveBtn, !measureInput && { opacity: 0.4 }]}
                    onPress={() => handleSaveMeasurement(type)}
                    disabled={!measureInput}>
                    <Text style={s.measureSaveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingMeasure(null)}>
                    <Text style={{ color: C.mid, fontSize: 13, marginLeft: 8 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: C.white, borderRadius: R.lg, padding: S.lg, marginBottom: S.lg, elevation: 1 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.dark },
  hint: { fontSize: 12, color: C.mid, marginBottom: S.md },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  fieldLabel: { fontSize: 14, color: C.mid, flex: 1 },
  fieldInput: { fontSize: 15, fontWeight: '600', color: C.dark, textAlign: 'right', flex: 1 },
  bmiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  bmiLabel: { fontSize: 14, color: C.mid },
  bmiValue: { fontSize: 20, fontWeight: '800' },
  saveBtn: { backgroundColor: C.primary, borderRadius: R.md, padding: 14, alignItems: 'center', marginTop: S.lg },
  saveBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  measureType: { fontSize: 14, color: C.dark, fontWeight: '500' },
  measureValue: { fontSize: 14, fontWeight: '600', color: C.primary },
  measureEditRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  measureInput: { flex: 1, backgroundColor: C.bg, borderRadius: R.sm, padding: 10, fontSize: 15, color: C.dark, borderWidth: 1, borderColor: C.border },
  measureSaveBtn: { backgroundColor: C.primary, borderRadius: R.sm, paddingHorizontal: 16, paddingVertical: 10 },
  measureSaveBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
});
