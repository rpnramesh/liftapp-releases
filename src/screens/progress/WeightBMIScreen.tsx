// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — TS-013 View Client Weight & BMI | TS-014 Measurements | TS-015 Photos
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, Image, FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { ProgressAPI } from '../../services/mockApi';

import { C, T, S, R, GS } from '../../constants/theme';
import { SkeletonLoader, EmptyState, PrimaryButton } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { WeightEntry, BodyMeasurement } from '../../types/trainer.types';
import { formatDate, bmiCategory } from '../../utils/trainer.utils';

const TRAINER_ID = 'trainer-001';
const TOKEN = '';

// ─── Weight & BMI ─────────────────────────────────────────────────────────────

type WeightProps = NativeStackScreenProps<ClientsStackParamList, 'WeightBMI'>;

export default function WeightBMIScreen({ navigation, route }: WeightProps) {
  const { clientId, clientName } = route.params;
  const [annotationModal, setAnnotationModal] = useState<{ date: string } | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchWeight = useCallback(() => ProgressAPI.getWeightHistory(TRAINER_ID, clientId, TOKEN), [clientId]);
  const { data: entries, loading, refresh } = useAsync<WeightEntry[]>(fetchWeight);

  const saveAnnotation = async () => {
    if (!annotationModal || !annotationText.trim()) return;
    setSaving(true);
    try {
      await ProgressAPI.addAnnotation(TRAINER_ID, clientId, annotationModal.date, annotationText.trim(), TOKEN);
      setAnnotationModal(null);
      refresh();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const latestEntry = entries?.[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: C.primary, fontWeight: '500' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{clientName}'s Weight & BMI</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Latest summary */}
        {latestEntry && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{latestEntry.weightKg} kg</Text>
              <Text style={styles.summaryLabel}>Latest Weight</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{latestEntry.bmi}</Text>
              <Text style={styles.summaryLabel}>{bmiCategory(latestEntry.bmi)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatDate(entries![0].date)}</Text>
              <Text style={styles.summaryLabel}>Last Updated</Text>
            </View>
          </View>
        )}

        {/* Simple chart placeholder — replace with react-native-chart-kit or Victory */}
        {entries && entries.length > 1 && (
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartText}>📈 Weight trend chart</Text>
            <Text style={styles.chartSub}>(Integrate react-native-chart-kit or Victory Native)</Text>
            <View style={styles.chartBars}>
              {entries.slice(0, 8).reverse().map((e, i) => {
                const max = Math.max(...entries.map(x => x.weightKg));
                const min = Math.min(...entries.map(x => x.weightKg));
                const range = max - min || 1;
                const h = 40 + ((e.weightKg - min) / range) * 60;
                return (
                  <View key={i} style={[styles.chartBar, { height: h }]}>
                    <Text style={styles.chartBarLabel}>{e.weightKg}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* History list */}
        <Text style={styles.sectionTitle}>History</Text>
        {loading ? (
          <SkeletonLoader height={48} />
        ) : entries?.length === 0 ? (
          <EmptyState emoji="⚖️" title="No weight data yet" subtitle={`${clientName} hasn't logged their weight yet.`} />
        ) : (
          entries?.map(entry => (
            <View key={entry.date} style={styles.entryRow}>
              <View>
                <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                {entry.trainerAnnotation && (
                  <Text style={styles.annotation}>📌 {entry.trainerAnnotation}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.entryWeight}>{entry.weightKg} kg</Text>
                <Text style={styles.entryBMI}>BMI {entry.bmi} · {bmiCategory(entry.bmi)}</Text>
              </View>
              <TouchableOpacity
                style={styles.annotateBtn}
                onPress={() => { setAnnotationModal({ date: entry.date }); setAnnotationText(entry.trainerAnnotation ?? ''); }}
              >
                <Text style={styles.annotateBtnText}>📌</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Annotation modal */}
      <Modal visible={!!annotationModal} transparent animationType="slide" onRequestClose={() => setAnnotationModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add Chart Annotation</Text>
            <Text style={styles.modalSub}>for {annotationModal?.date} — visible as a flag on {clientName}'s chart too</Text>
            <TextInput
              style={styles.annotInput}
              placeholder="e.g. Started creatine, increased calories"
              value={annotationText}
              onChangeText={setAnnotationText}
              multiline
              autoFocus
            />
            <PrimaryButton label="Save Annotation" onPress={saveAnnotation} loading={saving} />
            <TouchableOpacity style={{ marginTop: 10, alignSelf: 'center' }} onPress={() => setAnnotationModal(null)}>
              <Text style={{ color: C.mid }}>Cancel</Text>
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
  summaryCard: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700', color: C.dark },
  summaryLabel: { fontSize: 11, color: C.mid, marginTop: 2 },
  divider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  chartPlaceholder: { backgroundColor: C.white, borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center', gap: 6 },
  chartText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chartSub: { fontSize: 11, color: C.light },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8 },
  chartBar: { width: 28, backgroundColor: C.primary + '50', borderRadius: 4, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  chartBarLabel: { fontSize: 8, color: C.primary, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.dark, marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 10, padding: 14, marginBottom: 8, gap: 8 },
  entryDate: { fontSize: 13, fontWeight: '600', color: '#374151' },
  annotation: { fontSize: 11, color: C.mid, marginTop: 2, maxWidth: 160 },
  entryWeight: { fontSize: 16, fontWeight: '700', color: C.dark },
  entryBMI: { fontSize: 11, color: C.mid, marginTop: 2 },
  annotateBtn: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 6 },
  annotateBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 4 },
  modalSub: { fontSize: 12, color: C.mid, marginBottom: 16 },
  annotInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
});
