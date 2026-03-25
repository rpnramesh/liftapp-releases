// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — TS-013 View Client Weight & BMI
// Weight/BMI chart with zone bands (Underweight / Normal / Overweight / Obese)
// ─────────────────────────────────────────────────────────────────────────────

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert, Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { ProgressAPI } from '../../services/trainer.api';

import { EmptyState, PrimaryButton, SkeletonLoader } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { C } from '../../constants/theme';
import { useAsync } from '../../hooks/useTrainer';
import { WeightEntry } from '../../types/trainer.types';
import { bmiCategory, formatDate } from '../../utils/trainer.utils';

import { getTrainerId } from '../../services/session';

// ─── BMI Zone colors ──────────────────────────────────────────────────────────
const BMI_COLORS = {
  uw:     '#3B82F6', // blue  — underweight
  normal: '#10B981', // green — normal/ideal
  ow:     '#F59E0B', // amber — overweight
  obese:  '#EF4444', // red   — obese
};

function getDotColor(bmi: number): string {
  if (bmi < 18.5) return BMI_COLORS.uw;
  if (bmi < 25)   return BMI_COLORS.normal;
  if (bmi < 30)   return BMI_COLORS.ow;
  return BMI_COLORS.obese;
}

// ─── BMI Zone Chart ───────────────────────────────────────────────────────────

interface BMIZoneChartProps {
  entries: WeightEntry[];
}

function BMIZoneChart({ entries }: BMIZoneChartProps) {
  const [chartW, setChartW] = useState(0);
  const CHART_H = 200;
  const PADDING_L = 40; // space for Y-axis labels

  // Show up to 12 most recent entries, oldest on left
  const sorted = useMemo(
    () => [...entries].reverse().slice(-12),
    [entries],
  );

  // Back-calculate member's height (m) from first valid entry
  let heightM = 0;
  for (const e of sorted) {
    if (e.bmi > 0 && e.weightKg > 0) {
      heightM = Math.sqrt(e.weightKg / e.bmi);
      break;
    }
  }

  // Weight thresholds for each BMI boundary (requires height)
  const thresholds = heightM > 0 ? {
    uw:   18.5 * heightM * heightM, // underweight / normal border
    norm: 24.9 * heightM * heightM, // normal / overweight border
    ow:   29.9 * heightM * heightM, // overweight / obese border
  } : null;

  // Y-axis range — include zone threshold weights so bands appear
  const weights = sorted.map(e => e.weightKg);
  const refWeights = thresholds ? [thresholds.uw - 3, thresholds.ow + 3] : [];
  const allW = [...weights, ...refWeights];
  const minW = Math.max(0, Math.floor(Math.min(...allW) - 1));
  const maxW = Math.ceil(Math.max(...allW) + 1);
  const range = maxW - minW || 1;

  const innerW = Math.max(0, chartW - PADDING_L);

  const toY = (w: number) => CHART_H * (1 - (w - minW) / range);
  const toX = (i: number) =>
    PADDING_L + (sorted.length > 1 ? (i / (sorted.length - 1)) * innerW : innerW / 2);

  const clamp = (y: number) => Math.max(0, Math.min(CHART_H, y));

  const points = sorted.map((e, i) => ({
    x: toX(i),
    y: clamp(toY(e.weightKg)),
    bmi: e.bmi,
    weight: e.weightKg,
    date: e.date,
  }));

  // Zone-occurrence counts across ALL entries (not just the visible 12)
  const counts = useMemo(() => entries.reduce(
    (acc, e) => {
      if (e.bmi < 18.5)      acc.uw++;
      else if (e.bmi < 25)   acc.normal++;
      else if (e.bmi < 30)   acc.ow++;
      else                   acc.obese++;
      return acc;
    },
    { uw: 0, normal: 0, ow: 0, obese: 0 },
  ), [entries]);

  return (
    <View style={cs.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconSymbol name="scalemass" size={18} color={C.primary} />
        <Text style={[cs.title, { marginLeft: 8 }]}>Weight Progress</Text>
      </View>
      <Text style={cs.sub}>
        {sorted.length >= entries.length
          ? `${entries.length} entries total`
          : `Showing last ${sorted.length} of ${entries.length} entries`}
        {thresholds ? '' : '  ·  BMI zones unavailable'}
      </Text>

      {/* ── Chart area ── */}
      <View
        style={{ height: CHART_H, marginTop: 12 }}
        onLayout={ev => setChartW(ev.nativeEvent.layout.width)}
      >
        {chartW > 0 && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: CHART_H, overflow: 'hidden' }}>

            {/* Zone background bands */}
            {thresholds && (() => {
              const yOW = clamp(toY(thresholds.ow));
              const yNorm = clamp(toY(thresholds.norm));
              const yUW = clamp(toY(thresholds.uw));
              return (
                <>
                  {/* Obese band — above overweight threshold */}
                  <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: 0, height: yOW, backgroundColor: 'rgba(239,68,68,0.09)' }} />
                  {/* Overweight band */}
                  <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yOW, height: Math.max(0, yNorm - yOW), backgroundColor: 'rgba(245,158,11,0.09)' }} />
                  {/* Normal band */}
                  <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yNorm, height: Math.max(0, yUW - yNorm), backgroundColor: 'rgba(16,185,129,0.09)' }} />
                  {/* Underweight band */}
                  <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yUW, height: Math.max(0, CHART_H - yUW), backgroundColor: 'rgba(59,130,246,0.09)' }} />

                  {/* Threshold lines & weight labels */}
                  {([
                    { y: yUW,   w: thresholds.uw,   color: BMI_COLORS.uw },
                    { y: yNorm, w: thresholds.norm,  color: BMI_COLORS.ow },
                    { y: yOW,   w: thresholds.ow,    color: BMI_COLORS.obese },
                  ] as { y: number; w: number; color: string }[]).map((item, i) => {
                    if (item.y <= 4 || item.y >= CHART_H - 4) return null;
                    return (
                      <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: item.y }}>
                        <Text style={{ position: 'absolute', left: 0, top: -8, fontSize: 8, color: item.color, fontWeight: '600', width: PADDING_L - 2, textAlign: 'right' }}>
                          {Math.round(item.w)}
                        </Text>
                        <View style={{ position: 'absolute', left: PADDING_L, right: 0, height: 1, backgroundColor: item.color, opacity: 0.25 }} />
                      </View>
                    );
                  })}
                </>
              );
            })()}

            {/* Y-axis grid lines + labels */}
            {[minW, Math.round((minW + maxW) / 2), maxW].map((w, i) => {
              const y = clamp(toY(w));
              return (
                <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: y }}>
                  <Text style={{ position: 'absolute', left: 0, top: -7, fontSize: 8, color: '#9CA3AF', width: PADDING_L - 4, textAlign: 'right' }}>{w}</Text>
                  <View style={{ position: 'absolute', left: PADDING_L, right: 0, height: 1, backgroundColor: '#F3F4F6' }} />
                </View>
              );
            })}

            {/* Y-axis line */}
            <View style={{ position: 'absolute', left: PADDING_L - 1, top: 0, width: 1, height: CHART_H, backgroundColor: '#E5E7EB' }} />

            {/* Line segments between dots */}
            {points.slice(0, -1).map((p, i) => {
              const q = points[i + 1];
              const dx = q.x - p.x;
              const dy = q.y - p.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              const cx = (p.x + q.x) / 2;
              const cy = (p.y + q.y) / 2;
              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: cx - length / 2,
                    top: cy - 1,
                    width: length,
                    height: 2,
                    backgroundColor: '#CBD5E1',
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

            {/* Data dots — colored by BMI zone */}
            {points.map((p, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: p.x - 5,
                  top: p.y - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: getDotColor(p.bmi),
                  borderWidth: 1.5,
                  borderColor: '#FFFFFF',
                  elevation: 3,
                  zIndex: 10,
                }}
              />
            ))}
          </View>
        )}
      </View>

      {/* X-axis date labels */}
      {sorted.length > 0 && (
        <View style={{ flexDirection: 'row', marginLeft: PADDING_L, marginTop: 4 }}>
          <Text style={{ fontSize: 9, color: '#9CA3AF', flex: 1, textAlign: 'left' }}>
            {formatShortDate(sorted[0].date)}
          </Text>
          {sorted.length > 2 && (
            <Text style={{ fontSize: 9, color: '#9CA3AF', flex: 1, textAlign: 'center' }}>
              {formatShortDate(sorted[Math.floor(sorted.length / 2)].date)}
            </Text>
          )}
          <Text style={{ fontSize: 9, color: '#9CA3AF', flex: 1, textAlign: 'right' }}>
            {formatShortDate(sorted[sorted.length - 1].date)}
          </Text>
        </View>
      )}

      {/* Zone legend + occurrence counts */}
      <View style={cs.legend}>
        {([
          { color: BMI_COLORS.uw,     label: 'Underweight',  count: counts.uw },
          { color: BMI_COLORS.normal, label: 'Normal/Ideal', count: counts.normal },
          { color: BMI_COLORS.ow,     label: 'Overweight',   count: counts.ow },
          { color: BMI_COLORS.obese,  label: 'Obese',        count: counts.obese },
        ] as { color: string; label: string; count: number }[]).map(({ color, label, count }) => (
          <View key={label} style={cs.legendItem}>
            <View style={[cs.legendDot, { backgroundColor: color }]} />
            <Text style={cs.legendLabel}>{label}</Text>
            <Text style={[cs.legendCount, { color }]}>{count}×</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return iso.slice(0, 10);
  }
}

const cs = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  title: { fontSize: 15, fontWeight: '700', color: C.dark },
  sub: { fontSize: 11, color: C.mid, marginTop: 2 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: '45%',
    flex: 1,
  },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: C.mid, flex: 1 },
  legendCount: { fontSize: 12, fontWeight: '700' },
});

// ─── Weight & BMI Screen ──────────────────────────────────────────────────────

type WeightProps = NativeStackScreenProps<ClientsStackParamList, 'WeightBMI'>;

export default function WeightBMIScreen({ navigation, route }: WeightProps) {
  const { clientId, clientName } = route.params;
  const [annotationModal, setAnnotationModal] = useState<{ date: string } | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchWeight = useCallback(() => ProgressAPI.getWeightHistory(getTrainerId(), clientId), [clientId]);
  const { data: entries, loading, refresh } = useAsync<WeightEntry[]>(fetchWeight);

  const saveAnnotation = async () => {
    if (!annotationModal || !annotationText.trim()) return;
    setSaving(true);
    try {
      await ProgressAPI.addAnnotation(getTrainerId(), clientId, annotationModal.date, annotationText.trim());
      setAnnotationModal(null);
      refresh();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const latestEntry = entries?.[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IconSymbol name="chevron.left" size={20} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{clientName}'s Weight & BMI</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Latest summary card */}
        {latestEntry && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{latestEntry.weightKg} kg</Text>
              <Text style={styles.summaryLabel}>Latest Weight</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: getDotColor(latestEntry.bmi) }]}>
                {latestEntry.bmi}
              </Text>
              <Text style={[styles.summaryLabel, { color: getDotColor(latestEntry.bmi) }]}>
                {bmiCategory(latestEntry.bmi)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatDate(entries![0].date)}</Text>
              <Text style={styles.summaryLabel}>Last Updated</Text>
            </View>
          </View>
        )}

        {/* BMI Zone Chart */}
        {entries && entries.length > 0 && (
          <BMIZoneChart entries={entries} />
        )}

        {/* History list */}
        <Text style={styles.sectionTitle}>History</Text>
        {loading ? (
          <SkeletonLoader height={48} />
        ) : entries?.length === 0 ? (
          <EmptyState icon={<IconSymbol name="scalemass" size={40} color={C.mid} />} title="No weight data yet" subtitle={`${clientName} hasn't logged their weight yet.`} />
        ) : (
          entries?.map(entry => (
            <View key={entry.date} style={styles.entryRow}>
              <View>
                <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                {entry.trainerAnnotation && (
                  <Text style={styles.annotation}><IconSymbol name="pin" size={12} color={C.mid} /> {entry.trainerAnnotation}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.entryWeight}>{entry.weightKg} kg</Text>
                <Text style={[styles.entryBMI, { color: getDotColor(entry.bmi) }]}>
                  BMI {entry.bmi} · {bmiCategory(entry.bmi)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.annotateBtn}
                onPress={() => { setAnnotationModal({ date: entry.date }); setAnnotationText(entry.trainerAnnotation ?? ''); }}
              >
                <IconSymbol name="pin" size={16} color={C.mid} />
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.dark, marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 10, padding: 14, marginBottom: 8, gap: 8 },
  entryDate: { fontSize: 13, fontWeight: '600', color: '#374151' },
  annotation: { fontSize: 11, color: C.mid, marginTop: 2, maxWidth: 160 },
  entryWeight: { fontSize: 16, fontWeight: '700', color: C.dark },
  entryBMI: { fontSize: 11, marginTop: 2 },
  annotateBtn: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 6 },
  annotateBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 4 },
  modalSub: { fontSize: 12, color: C.mid, marginBottom: 16 },
  annotInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
});
