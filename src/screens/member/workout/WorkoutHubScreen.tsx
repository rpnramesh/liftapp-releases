// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Workout Hub Screen (Member)
// Entry point for the member's workout section. Shows:
//   • Assigned weekly plan with today highlighted
//   • Quick-start for today's workout
//   • Recent workout history
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import {
    getMemberPlan,
    getWorkoutHistory,
    subscribeToPlan,
} from '../../../services/member.workout.service';
import type { MemberPlan, MemberPlanDay, WorkoutSession } from '../../../types/member.workout.types';

// ─── Dark theme ───────────────────────────────────────────────────────────────
const D = {
  bg: '#0A0B0F',
  surface: '#13151C',
  card: '#1C1F28',
  elevated: '#252830',
  border: '#2A2D38',
  text: '#F1F3F9',
  textSub: '#8B9099',
  textMuted: '#5A5F6B',
  primary: '#4F8EF7',
  primarySoft: 'rgba(79,142,247,0.12)',
  green: '#22C55E',
  greenSoft: 'rgba(34,197,94,0.12)',
  amber: '#F59E0B',
  amberSoft: 'rgba(245,158,11,0.12)',
  red: '#EF4444',
  white: '#FFFFFF',
};

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDayIndex(): number {
  const day = new Date().getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1; // Map to Mon=0…Sun=6
}

function fmtDuration(secs: number): string {
  const m = Math.round(secs / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WorkoutHubScreen({ navigation }: any) {
  const { memberId, gymId } = useAuth();
  const [plan, setPlan] = useState<MemberPlan | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const todayIdx = getDayIndex();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (quiet = false) => {
    if (!gymId || !memberId) return;
    if (!quiet) setLoading(true);
    try {
      const [p, h] = await Promise.all([
        getMemberPlan(gymId, memberId),
        getWorkoutHistory(gymId, memberId, 10),
      ]);
      setPlan(p);
      setHistory(h);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [gymId, memberId]);

  useEffect(() => {
    load();
    // Real-time plan updates from trainer
    if (!gymId || !memberId) return;
    const unsub = subscribeToPlan(gymId, memberId, (p) => setPlan(p));
    return unsub;
  }, [gymId, memberId]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [loading]);

  const handleStartWorkout = (dayIdx: number) => {
    if (!plan) return;
    const day = plan.days[dayIdx];
    if (!day || day.restDay || day.exercises.length === 0) return;
    navigation.navigate('ActiveWorkout', {
      gymId,
      memberId,
      trainerId: plan.trainerId,
      planId: plan.planId,
      planName: plan.planName,
      dayLabel: day.dayLabel,
      exercises: day.exercises,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.loadingCenter}>
          <ActivityIndicator color={D.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={D.primary}
            />
          }
        >
          {/* Header */}
          <View style={st.header}>
            <View>
              <Text style={st.greeting}>My Workouts</Text>
              <Text style={st.subGreet}>{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            </View>
            <TouchableOpacity
              style={st.historyBtn}
              onPress={() => navigation.navigate('WorkoutHistory')}
            >
              <Ionicons name="stats-chart" size={20} color={D.primary} />
            </TouchableOpacity>
          </View>

          {plan ? (
            <>
              {/* Today's Workout Card */}
              <TodayCard
                day={plan.days[todayIdx]}
                todayLabel={DAYS_SHORT[todayIdx]}
                onStart={() => handleStartWorkout(todayIdx)}
              />

              {/* Weekly Plan Strip */}
              <View style={st.sectionHeader}>
                <Text style={st.sectionTitle}>This Week's Plan</Text>
                <Text style={st.sectionSub}>{plan.planName}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.weekStrip}
              >
                {DAYS_SHORT.map((dayShort, i) => {
                  const planDay = plan.days[i];
                  const isToday = i === todayIdx;
                  const isRest = !planDay || planDay.restDay;
                  return (
                    <TouchableOpacity
                      key={dayShort}
                      style={[
                        st.dayChip,
                        isToday && st.dayChipToday,
                        isRest && st.dayChipRest,
                      ]}
                      onPress={() => !isRest && handleStartWorkout(i)}
                      activeOpacity={isRest ? 1 : 0.7}
                    >
                      <Text style={[st.dayChipLabel, isToday && { color: D.primary }]}>{dayShort}</Text>
                      {isRest ? (
                        <Text style={st.dayChipRest2}>Rest</Text>
                      ) : (
                        <>
                          <Text style={[st.dayChipWorkout, isToday && { color: D.text }]} numberOfLines={1}>
                            {planDay?.dayLabel || 'Workout'}
                          </Text>
                          <Text style={st.dayChipSets}>
                            {planDay?.exercises?.length ?? 0} exs
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            /* No plan assigned */
            <View style={st.emptyCard}>
              <Text style={st.emptyIcon}>🏋️</Text>
              <Text style={st.emptyTitle}>No Plan Assigned</Text>
              <Text style={st.emptyText}>
                Your trainer hasn't assigned a workout plan yet. Check back soon or message them directly.
              </Text>
            </View>
          )}

          {/* Recent Workouts */}
          {history.length > 0 && (
            <>
              <View style={st.sectionHeader}>
                <Text style={st.sectionTitle}>Recent Workouts</Text>
                <TouchableOpacity onPress={() => navigation.navigate('WorkoutHistory')}>
                  <Text style={st.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>
              {history.slice(0, 5).map((session) => (
                <RecentWorkoutRow key={session.id} session={session} />
              ))}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Today's Workout Card ─────────────────────────────────────────────────────
function TodayCard({ day, todayLabel, onStart }: { day: MemberPlanDay | undefined; todayLabel: string; onStart: () => void }) {
  const isRest = !day || day.restDay;

  if (isRest) {
    return (
      <View style={[st.todayCard, st.todayCardRest]}>
        <Text style={st.todayRestIcon}>😴</Text>
        <Text style={st.todayRestTitle}>Rest Day</Text>
        <Text style={st.todayRestSub}>Today is {todayLabel} — take it easy and recover.</Text>
      </View>
    );
  }

  const exerciseCount = day.exercises?.length ?? 0;
  const setCount = day.exercises?.reduce(
    (n, ex) => n + (ex.warmupSets || 0) + (ex.mainSets || 0),
    0,
  ) ?? 0;
  const estMinutes = Math.round(setCount * 1.5 + exerciseCount * 2);

  return (
    <View style={st.todayCard}>
      <View style={st.todayMeta}>
        <View style={st.todayBadge}>
          <Text style={st.todayBadgeText}>TODAY · {todayLabel.toUpperCase()}</Text>
        </View>
        <Text style={st.todayTime}>~{estMinutes} min</Text>
      </View>
      <Text style={st.todayTitle}>{day.dayLabel}</Text>
      <View style={st.todayStats}>
        <View style={st.todayStat}>
          <Ionicons name="barbell-outline" size={14} color={D.textSub} />
          <Text style={st.todayStatText}>{exerciseCount} exercises</Text>
        </View>
        <View style={st.todayStat}>
          <Ionicons name="layers-outline" size={14} color={D.textSub} />
          <Text style={st.todayStatText}>{setCount} sets</Text>
        </View>
      </View>

      {/* Exercise preview */}
      <View style={st.exPreview}>
        {day.exercises?.slice(0, 4).map((ex) => (
          <View key={ex.id} style={st.exPill}>
            <Text style={st.exPillText} numberOfLines={1}>{ex.name}</Text>
          </View>
        ))}
        {(day.exercises?.length ?? 0) > 4 && (
          <View style={[st.exPill, { backgroundColor: D.elevated }]}>
            <Text style={[st.exPillText, { color: D.textMuted }]}>+{day.exercises.length - 4} more</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={st.startBtn} onPress={onStart} activeOpacity={0.85}>
        <Ionicons name="play" size={18} color={D.white} />
        <Text style={st.startBtnText}>Start Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Recent Workout Row ───────────────────────────────────────────────────────
function RecentWorkoutRow({ session }: { session: WorkoutSession }) {
  const totalSets = session.totalSets ||
    (session.exercises || []).reduce((n, ex) => n + ex.sets.filter((s) => s.isCompleted).length, 0);
  const totalVol = session.totalVolume || 0;

  return (
    <View style={st.histRow}>
      <View style={st.histIcon}>
        <Ionicons name="barbell" size={18} color={D.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.histTitle} numberOfLines={1}>{session.workoutName}</Text>
        <Text style={st.histSub}>
          {session.dayLabel ? `${session.dayLabel} · ` : ''}
          {session.completedAt ? fmtDate(session.completedAt) : ''}
        </Text>
      </View>
      <View style={st.histRight}>
        {session.durationSeconds ? (
          <Text style={st.histDur}>{fmtDuration(session.durationSeconds)}</Text>
        ) : null}
        {totalVol > 0 && (
          <Text style={st.histVol}>{totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}t` : `${Math.round(totalVol)}kg`}</Text>
        )}
      </View>
      {session.newPRs && session.newPRs.length > 0 && (
        <View style={st.prTag}>
          <Text style={st.prTagText}>PR</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D.bg },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: { color: D.text, fontSize: 22, fontWeight: '800' },
  subGreet: { color: D.textMuted, fontSize: 13, marginTop: 2 },
  historyBtn: {
    padding: 10,
    backgroundColor: D.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: D.border,
  },
  todayCard: {
    margin: 16,
    marginTop: 8,
    backgroundColor: D.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: D.border,
  },
  todayCardRest: { alignItems: 'center', paddingVertical: 28 },
  todayRestIcon: { fontSize: 36, marginBottom: 8 },
  todayRestTitle: { color: D.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  todayRestSub: { color: D.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  todayMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  todayBadge: {
    backgroundColor: D.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  todayBadgeText: { color: D.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  todayTime: { color: D.textMuted, fontSize: 12 },
  todayTitle: { color: D.text, fontSize: 22, fontWeight: '800', marginBottom: 10 },
  todayStats: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  todayStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayStatText: { color: D.textSub, fontSize: 13 },
  exPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  exPill: {
    backgroundColor: D.elevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  exPillText: { color: D.textSub, fontSize: 12 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: D.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  startBtnText: { color: D.white, fontSize: 16, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: { color: D.text, fontSize: 16, fontWeight: '700' },
  sectionSub: { color: D.textMuted, fontSize: 12 },
  seeAll: { color: D.primary, fontSize: 13, fontWeight: '600' },
  weekStrip: { paddingHorizontal: 12, gap: 8 },
  dayChip: {
    width: 80,
    backgroundColor: D.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: D.border,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  dayChipToday: { borderColor: D.primary, borderWidth: 1.5 },
  dayChipRest: { opacity: 0.5 },
  dayChipLabel: { color: D.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  dayChipWorkout: { color: D.textSub, fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  dayChipRest2: { color: D.textMuted, fontSize: 11, fontStyle: 'italic' },
  dayChipSets: { color: D.textMuted, fontSize: 10 },
  emptyCard: {
    margin: 16,
    backgroundColor: D.card,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: D.border,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: D.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: D.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: D.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: D.border,
    gap: 10,
  },
  histIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: D.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histTitle: { color: D.text, fontSize: 14, fontWeight: '600' },
  histSub: { color: D.textMuted, fontSize: 12, marginTop: 2 },
  histRight: { alignItems: 'flex-end' },
  histDur: { color: D.textSub, fontSize: 13, fontWeight: '600' },
  histVol: { color: D.textMuted, fontSize: 12 },
  prTag: {
    backgroundColor: D.amberSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prTagText: { color: D.amber, fontSize: 11, fontWeight: '700' },
});
