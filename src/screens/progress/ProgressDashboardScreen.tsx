// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Progress Dashboard Screen
// Comprehensive progress view syncing all data available in member app:
//   • Weight & BMI zone chart
//   • Goal weight progress bar
//   • Workout consistency (4-week bars)
//   • Body measurements summary
//   • Progress photos count
//   • Trainer-specific stats
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ScreenHeader } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { C, R, S } from '../../constants/theme';
import { db } from '../../firebase/config';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { getTrainerId } from '../../services/session';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ProgressDashboard'>;

// ─── BMI helpers ──────────────────────────────────────────────────────────────
const BMI_COLORS = {
  uw:     '#3B82F6',
  normal: '#10B981',
  ow:     '#F59E0B',
  obese:  '#EF4444',
};

function getBmiColor(bmi: number) {
  if (bmi < 18.5) return BMI_COLORS.uw;
  if (bmi < 25)   return BMI_COLORS.normal;
  if (bmi < 30)   return BMI_COLORS.ow;
  return BMI_COLORS.obese;
}

function getBmiCategory(bmi: number) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25)   return 'Normal';
  if (bmi < 30)   return 'Overweight';
  return 'Obese';
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtDuration(secs: number) {
  if (!secs) return '—';
  const m = Math.round(secs / 60);
  return `${m} min`;
}

// ─── Mini BMI Zone Chart ──────────────────────────────────────────────────────
function MiniBMIChart({ entries }: { entries: any[] }) {
  const [chartW, setChartW] = useState(0);
  const CHART_H = 160;
  const PADDING_L = 36;

  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-12), [entries]);

  let heightM = 0;
  for (const e of sorted) {
    if (e.bmi > 0 && e.weightKg > 0) { heightM = Math.sqrt(e.weightKg / e.bmi); break; }
  }

  const thresholds = heightM > 0 ? {
    uw:   18.5 * heightM * heightM,
    norm: 24.9 * heightM * heightM,
    ow:   29.9 * heightM * heightM,
  } : null;

  const weights = sorted.map(e => e.weightKg);
  const refW = thresholds ? [thresholds.uw - 2, thresholds.ow + 2] : [];
  const allW = [...weights, ...refW];
  const minW = allW.length ? Math.floor(Math.min(...allW) - 1) : 0;
  const maxW = allW.length ? Math.ceil(Math.max(...allW) + 1) : 100;
  const range = maxW - minW || 1;
  const innerW = Math.max(0, chartW - PADDING_L);

  const toY = (w: number) => CHART_H * (1 - (w - minW) / range);
  const toX = (i: number) => PADDING_L + (sorted.length > 1 ? (i / (sorted.length - 1)) * innerW : innerW / 2);
  const clamp = (y: number) => Math.max(0, Math.min(CHART_H, y));

  const points = sorted.map((e, i) => ({
    x: toX(i), y: clamp(toY(e.weightKg)), bmi: e.bmi,
  }));

  if (sorted.length === 0) return null;

  return (
    <View onLayout={ev => setChartW(ev.nativeEvent.layout.width)} style={{ height: CHART_H + 16 }}>
      {chartW > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: CHART_H, overflow: 'hidden' }}>
          {thresholds && (() => {
            const yOW   = clamp(toY(thresholds.ow));
            const yNorm = clamp(toY(thresholds.norm));
            const yUW   = clamp(toY(thresholds.uw));
            return (
              <>
                <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: 0, height: yOW, backgroundColor: 'rgba(239,68,68,0.08)' }} />
                <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yOW, height: Math.max(0, yNorm - yOW), backgroundColor: 'rgba(245,158,11,0.08)' }} />
                <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yNorm, height: Math.max(0, yUW - yNorm), backgroundColor: 'rgba(16,185,129,0.08)' }} />
                <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yUW, height: Math.max(0, CHART_H - yUW), backgroundColor: 'rgba(59,130,246,0.08)' }} />
              </>
            );
          })()}
          <View style={{ position: 'absolute', left: PADDING_L - 1, top: 0, width: 1, height: CHART_H, backgroundColor: '#E5E7EB' }} />
          {[minW, Math.round((minW + maxW) / 2), maxW].map((w, i) => (
            <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: clamp(toY(w)) }}>
              <Text style={{ position: 'absolute', left: 0, top: -7, fontSize: 8, color: '#9CA3AF', width: PADDING_L - 3, textAlign: 'right' }}>{w}</Text>
              <View style={{ position: 'absolute', left: PADDING_L, right: 0, height: 1, backgroundColor: '#F3F4F6' }} />
            </View>
          ))}
          {points.slice(0, -1).map((p, i) => {
            const q = points[i + 1];
            const dx = q.x - p.x; const dy = q.y - p.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return (
              <View key={i} style={{ position: 'absolute', left: (p.x + q.x) / 2 - len / 2, top: (p.y + q.y) / 2 - 1, width: len, height: 2, backgroundColor: '#CBD5E1', transform: [{ rotate: `${angle}deg` }] }} />
            );
          })}
          {points.map((p, i) => (
            <View key={i} style={{ position: 'absolute', left: p.x - 5, top: p.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: getBmiColor(p.bmi), borderWidth: 1.5, borderColor: '#fff', elevation: 3, zIndex: 10 }} />
          ))}
        </View>
      )}
      <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: CHART_H + 2, flexDirection: 'row' }}>
        <Text style={{ fontSize: 9, color: '#9CA3AF', flex: 1 }}>{sorted[0]?.date?.slice(5)}</Text>
        <Text style={{ fontSize: 9, color: '#9CA3AF', flex: 1, textAlign: 'right' }}>{sorted[sorted.length - 1]?.date?.slice(5)}</Text>
      </View>
    </View>
  );
}

// ─── 4-Week Consistency Bars ──────────────────────────────────────────────────
function ConsistencyBars({ workoutLogs }: { workoutLogs: any[] }) {
  const weeks = useMemo(() => {
    const now = Date.now();
    return [3, 2, 1, 0].map(weeksAgo => {
      const end   = now - weeksAgo * 7 * 24 * 3600 * 1000;
      const start = end - 7 * 24 * 3600 * 1000;
      const count = workoutLogs.filter(w => w.completedAt >= start && w.completedAt < end).length;
      const label = weeksAgo === 0 ? 'This\nweek' : `${weeksAgo}w\nago`;
      return { label, count };
    });
  }, [workoutLogs]);

  const maxCount = Math.max(...weeks.map(w => w.count), 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 80, marginTop: 8 }}>
      {weeks.map((w, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary, marginBottom: 3 }}>{w.count}</Text>
          <View style={{ width: '70%', height: Math.max(6, (w.count / maxCount) * 52), backgroundColor: i === 3 ? C.primary : C.primaryBg, borderRadius: 4 }} />
          <Text style={{ fontSize: 10, color: C.mid, marginTop: 4, textAlign: 'center' }}>{w.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Goal Progress Bar ────────────────────────────────────────────────────────
function GoalProgressBar({ currentWeight, goalWeight, startWeight }: { currentWeight: number; goalWeight: number; startWeight: number }) {
  if (!currentWeight || !goalWeight || !startWeight || goalWeight >= startWeight) return null;
  const total = startWeight - goalWeight;
  const done  = startWeight - currentWeight;
  const pct   = Math.min(100, Math.max(0, (done / total) * 100));
  const remaining = Math.max(0, currentWeight - goalWeight).toFixed(1);

  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, color: C.mid }}>Goal Progress</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>{pct.toFixed(0)}%</Text>
      </View>
      <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4 }}>
        <View style={{ height: 8, width: `${pct}%`, backgroundColor: C.green, borderRadius: 4 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: C.mid }}>Start: {startWeight} kg</Text>
        <Text style={{ fontSize: 11, color: C.mid }}>{remaining} kg to goal ({goalWeight} kg)</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProgressDashboardScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const trainerId = getTrainerId();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<any>(null);
  const [weightEntries, setWeightEntries] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [photoCount, setPhotoCount] = useState(0);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Member basic info
      const memberSnap = await getDoc(doc(db, 'members', clientId));
      const m = memberSnap.exists() ? memberSnap.data() : {};
      setMember(m);

      // Trainer gymId
      const trainerSnap = await getDoc(doc(db, 'trainers', trainerId));
      const gymId = trainerSnap.data()?.gymId ?? trainerId;

      // Weight logs
      const weightSnap = await getDocs(
        query(collection(db, 'gyms', gymId, 'weightLogs'), where('memberId', '==', clientId))
      ).catch(() => ({ docs: [] }));
      const entries = weightSnap.docs.map((d: any) => {
        const w = d.data();
        const h = w.height ?? m?.height ?? 170;
        return {
          date: new Date(w.loggedAt).toISOString().split('T')[0],
          weightKg: w.weight,
          bmi: parseFloat((w.weight / ((h / 100) ** 2)).toFixed(1)),
          loggedAt: w.loggedAt,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));
      setWeightEntries(entries);

      // Measurements — get latest per type
      const measSnap = await getDocs(
        query(collection(db, 'gyms', gymId, 'measurements'), where('memberId', '==', clientId))
      ).catch(() => ({ docs: [] }));
      const allMeas = measSnap.docs.map((d: any) => d.data());
      const latestByType: Record<string, any> = {};
      for (const meas of allMeas) {
        if (!latestByType[meas.type] || meas.loggedAt > latestByType[meas.type].loggedAt) {
          latestByType[meas.type] = meas;
        }
      }
      setMeasurements(Object.values(latestByType));

      // Workout logs
      const logsSnap = await getDocs(
        query(collection(db, 'gyms', gymId, 'workoutLogs'), where('memberId', '==', clientId))
      ).catch(() => ({ docs: [] }));
      const logs = logsSnap.docs.map((d: any) => d.data()).sort((a: any, b: any) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
      setWorkoutLogs(logs);

      // Progress photos shared with trainer
      const photosSnap = await getDocs(
        query(collection(db, 'gyms', gymId, 'progressPhotos'), where('memberId', '==', clientId), where('sharedWithTrainer', '==', true))
      ).catch(() => ({ docs: [] }));
      setPhotoCount(photosSnap.docs.length);

    } catch (e) {
      console.log('Progress dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [clientId, trainerId]);

  // Auto-load and refresh on navigation focus
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // Also subscribe to realtime updates for workout logs so the UI refreshes
  // immediately when a new log is added elsewhere.
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const trainerSnap = await getDoc(doc(db, 'trainers', trainerId));
        const gymId = trainerSnap.data()?.gymId ?? trainerId;
        const q = query(collection(db, 'gyms', gymId, 'workoutLogs'), where('memberId', '==', clientId));
        unsub = onSnapshot(q, snap => {
          const logs = snap.docs.map((d: any) => d.data()).sort((a: any, b: any) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
          setWorkoutLogs(logs);
        }, () => {});
      } catch (e) {
        // ignore realtime subscribe errors
      }
    })();
    return () => { try { unsub(); } catch (_) {} };
  }, [clientId, trainerId]);

  // Derived stats
  const latestWeight = weightEntries.length ? weightEntries[weightEntries.length - 1] : null;
  const latestBmi = latestWeight?.bmi ?? null;

  const totalWorkouts = workoutLogs.length;
  const avgDurationSecs = totalWorkouts
    ? workoutLogs.reduce((s, w) => s + (w.durationSeconds ?? 0), 0) / totalWorkouts
    : 0;
  const lastWorkoutDate = workoutLogs[0]?.completedAt ? fmtDate(workoutLogs[0].completedAt) : null;

  const bmiCounts = useMemo(() => weightEntries.reduce(
    (acc, e) => {
      if (e.bmi < 18.5)     acc.uw++;
      else if (e.bmi < 25)  acc.normal++;
      else if (e.bmi < 30)  acc.ow++;
      else                  acc.obese++;
      return acc;
    }, { uw: 0, normal: 0, ow: 0, obese: 0 }
  ), [weightEntries]);

  // Workout consistency: last 4 weeks
  const now = Date.now();
  const last28Days = workoutLogs.filter(w => w.completedAt >= now - 28 * 24 * 3600 * 1000);
  const consistencyPct = Math.round((last28Days.length / 28) * 100);

  // Waist-to-hip ratio
  const waistMeas = measurements.find(m => m.type === 'Waist');
  const hipsMeas  = measurements.find(m => m.type === 'Hips');
  const whr = waistMeas && hipsMeas ? (waistMeas.value / hipsMeas.value).toFixed(2) : null;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={`${clientName}'s Progress`} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: S.lg, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} tintColor={C.primary} />}
      >

        {/* ── Quick Stats Row ── */}
        <View style={s.statsRow}>
          {[
            { label: 'Total\nWorkouts', value: String(totalWorkouts) },
            { label: 'Avg\nDuration',  value: fmtDuration(avgDurationSecs) },
            { label: 'Weight\nLogs',   value: String(weightEntries.length) },
            { label: 'Photos\nShared', value: String(photoCount) },
          ].map(({ label, value }) => (
            <View key={label} style={s.statBox}>
              <Text style={s.statValue}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Weight & BMI ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="scalemass" size={18} color={C.primary} />
              <Text style={[s.cardTitle, { marginLeft: 8 }]}>Weight & BMI</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('WeightBMI', { clientId, clientName })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.seeAll}>Full chart</Text>
                <IconSymbol name="chevron.right" size={14} color={C.mid} />
              </View>
            </TouchableOpacity>
          </View>

          {latestWeight ? (
            <>
              <View style={s.bmiRow}>
                <View style={s.bmiBox}>
                  <Text style={s.bmiWeight}>{latestWeight.weightKg} kg</Text>
                  <Text style={s.bmiSub}>Current Weight</Text>
                </View>
                {latestBmi && (
                  <View style={[s.bmiBox, { borderLeftWidth: 1, borderLeftColor: C.border }]}>
                    <Text style={[s.bmiNumber, { color: getBmiColor(latestBmi) }]}>{latestBmi}</Text>
                    <Text style={[s.bmiCat, { color: getBmiColor(latestBmi) }]}>{getBmiCategory(latestBmi)}</Text>
                  </View>
                )}
              </View>

              {/* Zone occurrence summary */}
              <View style={s.zoneRow}>
                {[
                  { color: BMI_COLORS.uw,     label: 'Underweight',  count: bmiCounts.uw },
                  { color: BMI_COLORS.normal,  label: 'Normal',       count: bmiCounts.normal },
                  { color: BMI_COLORS.ow,      label: 'Overweight',   count: bmiCounts.ow },
                  { color: BMI_COLORS.obese,   label: 'Obese',        count: bmiCounts.obese },
                ].map(({ color, label, count }) => count > 0 ? (
                  <View key={label} style={s.zoneChip}>
                    <View style={[s.zoneDot, { backgroundColor: color }]} />
                    <Text style={{ fontSize: 11, color: C.mid }}>{label} </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color }}>{count}×</Text>
                  </View>
                ) : null)}
              </View>

              <MiniBMIChart entries={weightEntries} />

              <GoalProgressBar
                currentWeight={latestWeight.weightKg}
                goalWeight={member?.goalWeight ?? 0}
                startWeight={weightEntries[0]?.weightKg ?? 0}
              />
            </>
          ) : (
            <Text style={s.noData}>No weight logs yet</Text>
          )}
        </View>

        {/* ── Workout Consistency ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="figure.strengthtraining.traditional" size={18} color={C.primary} />
              <Text style={[s.cardTitle, { marginLeft: 8 }]}>Workout Consistency</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('WorkoutLogs', { clientId, clientName })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.seeAll}>All logs</Text>
                <IconSymbol name="chevron.right" size={14} color={C.mid} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={s.consistencyStats}>
            <View style={s.cStatBox}>
              <Text style={s.cStatValue}>{last28Days.length}</Text>
              <Text style={s.cStatLabel}>workouts in{'\n'}last 28 days</Text>
            </View>
            <View style={[s.cStatBox, { borderLeftWidth: 1, borderLeftColor: C.border }]}>
              <Text style={[s.cStatValue, { color: consistencyPct >= 50 ? C.green : C.amber }]}>{consistencyPct}%</Text>
              <Text style={s.cStatLabel}>consistency{'\n'}rate</Text>
            </View>
            <View style={[s.cStatBox, { borderLeftWidth: 1, borderLeftColor: C.border }]}>
              <Text style={s.cStatValue}>{lastWorkoutDate ?? '—'}</Text>
              <Text style={s.cStatLabel}>last{'\n'}workout</Text>
            </View>
          </View>

          <ConsistencyBars workoutLogs={workoutLogs.map(w => ({ ...w, completedAt: w.completedAt ?? 0 }))} />

          {/* Recent workouts */}
          {workoutLogs.slice(0, 5).map((log, i) => (
            <View key={i} style={s.logRow}>
              <View style={s.logDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.logName}>{log.workoutName ?? log.name ?? 'Workout'}</Text>
                <Text style={s.logMeta}>{fmtDuration(log.durationSeconds)} · {log.completedAt ? fmtDate(log.completedAt) : '—'}</Text>
              </View>
            </View>
          ))}
          {workoutLogs.length === 0 && <Text style={s.noData}>No workouts logged yet</Text>}
        </View>

        {/* ── Body Measurements ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>📐 Body Measurements</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Measurements', { clientId, clientName })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.seeAll}>All</Text>
                <IconSymbol name="chevron.right" size={14} color={C.mid} />
              </View>
            </TouchableOpacity>
          </View>

          {measurements.length > 0 ? (
            <>
              <View style={s.measGrid}>
                {measurements.slice(0, 6).map(m => (
                  <View key={m.type} style={s.measBox}>
                    <Text style={s.measValue}>{m.value} cm</Text>
                    <Text style={s.measLabel}>{m.type}</Text>
                  </View>
                ))}
              </View>
              {whr && (
                <View style={s.whrRow}>
                  <Text style={s.whrLabel}>Waist-to-Hip Ratio</Text>
                  <Text style={[s.whrValue, { color: parseFloat(whr) > 0.9 ? C.red : C.green }]}>{whr}</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={s.noData}>No measurements recorded yet</Text>
          )}
        </View>

        {/* ── Progress Photos ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="camera" size={18} color={C.primary} />
              <Text style={[s.cardTitle, { marginLeft: 8 }]}>Progress Photos</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ProgressPhotos', { clientId, clientName })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.seeAll}>View all</Text>
                <IconSymbol name="chevron.right" size={14} color={C.mid} />
              </View>
            </TouchableOpacity>
          </View>
          {photoCount > 0 ? (
            <Text style={s.photoCount}>{photoCount} photo{photoCount !== 1 ? 's' : ''} shared with you</Text>
          ) : (
            <Text style={s.noData}>No photos shared yet. Request access from the photos screen.</Text>
          )}
        </View>

        {/* ── Body Info ── */}
        {member && (
          <View style={s.card}>
            <Text style={s.cardTitle}>👤 Body Info</Text>
            <View style={s.infoGrid}>
              {[
                { label: 'Height', value: member.height ? `${member.height} cm` : '—' },
                { label: 'Current Weight', value: member.weight ? `${member.weight} kg` : '—' },
                { label: 'Goal Weight', value: member.goalWeight ? `${member.goalWeight} kg` : '—' },
                { label: 'BMI (saved)', value: latestBmi ? String(latestBmi) : '—' },
              ].map(({ label, value }) => (
                <View key={label} style={s.infoRow}>
                  <Text style={s.infoLabel}>{label}</Text>
                  <Text style={s.infoValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: S.lg },
  statBox: { flex: 1, backgroundColor: C.white, borderRadius: R.md, padding: 10, alignItems: 'center', elevation: 1 },
  statValue: { fontSize: 16, fontWeight: '800', color: C.dark },
  statLabel: { fontSize: 10, color: C.mid, textAlign: 'center', marginTop: 2 },

  card: { backgroundColor: C.white, borderRadius: R.lg, padding: S.lg, marginBottom: S.lg, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: '600' },

  bmiRow: { flexDirection: 'row', marginBottom: 12 },
  bmiBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  bmiWeight: { fontSize: 22, fontWeight: '800', color: C.dark },
  bmiSub: { fontSize: 11, color: C.mid, marginTop: 2 },
  bmiNumber: { fontSize: 26, fontWeight: '900' },
  bmiCat: { fontSize: 12, fontWeight: '700', marginTop: 1 },

  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  zoneChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  zoneDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },

  consistencyStats: { flexDirection: 'row', marginBottom: 4 },
  cStatBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  cStatValue: { fontSize: 18, fontWeight: '800', color: C.dark },
  cStatLabel: { fontSize: 10, color: C.mid, textAlign: 'center', marginTop: 2 },

  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  logName: { fontSize: 13, fontWeight: '600', color: C.dark },
  logMeta: { fontSize: 11, color: C.mid, marginTop: 1 },

  measGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  measBox: { width: '30%', backgroundColor: C.bg, borderRadius: R.sm, padding: 10, alignItems: 'center' },
  measValue: { fontSize: 15, fontWeight: '700', color: C.primary },
  measLabel: { fontSize: 10, color: C.mid, marginTop: 2, textAlign: 'center' },

  whrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  whrLabel: { fontSize: 13, color: C.mid },
  whrValue: { fontSize: 16, fontWeight: '800' },

  photoCount: { fontSize: 14, color: C.mid, paddingVertical: 8 },

  infoGrid: {},
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel: { fontSize: 13, color: C.mid },
  infoValue: { fontSize: 13, fontWeight: '700', color: C.dark },

  noData: { fontSize: 13, color: C.mid, paddingVertical: 8, textAlign: 'center' },
});
