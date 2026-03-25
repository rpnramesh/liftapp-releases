// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../constants/theme';
// Lift Trainer App — TS-014 View Client Body Measurements
// ─────────────────────────────────────────────────────────────────────────────

import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { ProgressAPI } from '../../services/trainer.api';

import { EmptyState, SkeletonLoader } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { useAsync } from '../../hooks/useTrainer';
import { getTrainerId } from '../../services/session';
import { BodyMeasurement } from '../../types/trainer.types';
import { formatDate } from '../../utils/trainer.utils';

type Props = NativeStackScreenProps<ClientsStackParamList, 'Measurements'>;

const MEASUREMENT_FIELDS: { key: keyof BodyMeasurement; label: string }[] = [
  { key: 'chestCm', label: 'Chest' },
  { key: 'waistCm', label: 'Waist' },
  { key: 'hipsCm', label: 'Hips' },
  { key: 'armsLeftCm', label: 'Left Arm' },
  { key: 'armsRightCm', label: 'Right Arm' },
  { key: 'thighsLeftCm', label: 'Left Thigh' },
  { key: 'thighsRightCm', label: 'Right Thigh' },
  { key: 'calfLeftCm', label: 'Left Calf' },
  { key: 'calfRightCm', label: 'Right Calf' },
];

export default function MeasurementsScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const fetchMeasurements = useCallback(() => ProgressAPI.getMeasurements(getTrainerId(), clientId), [clientId]);
  const { data: measurements, loading, refresh } = useAsync<BodyMeasurement[]>(fetchMeasurements, [clientId]);

  // Refresh when screen comes into focus so recent measurements appear after updates
  useFocusEffect(
    useCallback(() => {
      if (typeof refresh === 'function') refresh();
    }, [refresh]),
  );

  const latest = measurements?.[0];
  const previous = measurements?.[1];

  const delta = (key: keyof BodyMeasurement) => {
    if (!latest || !previous) return null;
    const l = latest[key] as number | undefined;
    const p = previous[key] as number | undefined;
    if (l == null || p == null) return null;
    return (l - p).toFixed(1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IconSymbol name="chevron.left" size={20} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{clientName}'s Measurements</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {loading ? (
          <SkeletonLoader height={200} />
        ) : !latest ? (
          <EmptyState icon={<IconSymbol name="scalemass" size={48} color={C.mid} />} title="No measurements logged" subtitle={`${clientName} hasn't logged body measurements yet.`} />
        ) : (
          <>
            <Text style={styles.dateLabel}>Latest: {formatDate(latest.date)}</Text>
            <View style={styles.grid}>
              {MEASUREMENT_FIELDS.map(({ key, label }) => {
                const val = latest[key] as number | undefined;
                const d = delta(key);
                if (val == null) return null;
                return (
                  <View key={key} style={styles.measureCard}>
                    <Text style={styles.measureLabel}>{label}</Text>
                    <Text style={styles.measureValue}>{val} cm</Text>
                    {d != null && (
                      <Text style={[styles.measureDelta, { color: parseFloat(d) < 0 ? C.green : C.red }]}>
                        {parseFloat(d) >= 0 ? '+' : ''}{d} cm
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, gap: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  dateLabel: { fontSize: 14, color: C.mid, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  measureCard: { width: '30%', backgroundColor: C.white, borderRadius: 10, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  measureLabel: { fontSize: 11, color: C.mid },
  measureValue: { fontSize: 18, fontWeight: '700', color: C.dark, marginTop: 2 },
  measureDelta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
