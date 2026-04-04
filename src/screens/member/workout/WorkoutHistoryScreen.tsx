// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Workout History & Progress Screen (Member)
// Calendar view, workout logs, volume/1RM charts, PRs, weekly summaries
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
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
    buildExerciseTrend,
    buildWeeklyVolume,
    estimate1RM,
    getWorkoutHistory,
} from '../../../services/member.workout.service';
import type {
    ExerciseVolumeTrend,
    WeeklyVolumeSummary,
    WorkoutSession
} from '../../../types/member.workout.types';

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
  primarySoft: 'rgba(79,142,247,0.14)',
  green: '#22C55E',
  greenSoft: 'rgba(34,197,94,0.14)',
  amber: '#F59E0B',
  amberSoft: 'rgba(245,158,11,0.14)',
  red: '#EF4444',
  purple: '#A78BFA',
  white: '#FFFFFF',
};

type TabKey = 'calendar' | 'volume' | 'records';

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// ─────────────────────────────────────────────────────────────────────────────
export default function WorkoutHistoryScreen({ navigation }: any) {
  const { memberId, gymId } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('calendar');
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-indexed
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // 'YYYY-MM-DD'
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!gymId || !memberId) return;
    if (!quiet) setLoading(true);
    try {
      const data = await getWorkoutHistory(gymId, memberId, 90);
      setSessions(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [gymId, memberId]);

  useEffect(() => { load(); }, []);

  // ── Calendar: which days have workouts ───────────────────────────────────
  const workoutDaysSet = useMemo(() => {
    const s = new Set<string>();
    for (const session of sessions) {
      if (session.completedAt || session.startedAt) {
        const d = new Date(session.completedAt || session.startedAt);
        s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
    return s;
  }, [sessions]);

  // ── Selected day's sessions ──────────────────────────────────────────────
  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    const [y, m, day] = selectedDate.split('-').map(Number);
    return sessions.filter((s) => {
      const d = new Date(s.completedAt || s.startedAt);
      return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
    });
  }, [sessions, selectedDate]);

  // ── Weekly volume chart data ─────────────────────────────────────────────
  const weeklyVolume = useMemo(() => buildWeeklyVolume(sessions).slice(-8), [sessions]);

  // ── PRs: best weight per exercise ───────────────────────────────────────
  const personalRecords = useMemo(() => {
    const bests: Record<string, { exerciseName: string; weight: number; reps: number; date: number }> = {};
    for (const session of sessions) {
      for (const ex of session.exercises || []) {
        const done = ex.sets.filter((s) => s.isCompleted && s.weight > 0 && s.reps > 0);
        for (const set of done) {
          if (!bests[ex.exerciseId] || set.weight > bests[ex.exerciseId].weight) {
            bests[ex.exerciseId] = {
              exerciseName: ex.exerciseName,
              weight: set.weight,
              reps: set.reps,
              date: session.completedAt || session.startedAt,
            };
          }
        }
      }
    }
    return Object.values(bests).sort((a, b) => b.weight - a.weight);
  }, [sessions]);

  // ── Exercise list for trend chart ────────────────────────────────────────
  const exerciseList = useMemo(() => {
    const seen = new Map<string, string>();
    for (const session of sessions) {
      for (const ex of session.exercises || []) {
        if (!seen.has(ex.exerciseId)) seen.set(ex.exerciseId, ex.exerciseName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  // ── Trend data for selected exercise ────────────────────────────────────
  const exerciseTrend: ExerciseVolumeTrend | null = useMemo(() => {
    if (!selectedExerciseId) return null;
    return buildExerciseTrend(sessions, selectedExerciseId);
  }, [sessions, selectedExerciseId]);

  // ── Overall stats ────────────────────────────────────────────────────────
  const totalStats = useMemo(() => {
    const last30 = sessions.filter((s) => {
      const ts = s.completedAt || s.startedAt;
      return ts > Date.now() - 30 * 24 * 60 * 60 * 1000;
    });
    return {
      totalWorkouts: sessions.length,
      last30Count: last30.length,
      totalVolume: sessions.reduce((n, s) => n + (s.totalVolume || 0), 0),
      prCount: personalRecords.length,
    };
  }, [sessions, personalRecords]);

  if (loading) {
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.loadingCenter}><ActivityIndicator color={D.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={14} style={st.backBtn}>
          <Ionicons name="chevron-back" size={24} color={D.text} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Progress & History</Text>
      </View>

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
        {/* Overview stats */}
        <View style={st.overviewRow}>
          <OverviewCard label="Total Sessions" value={String(totalStats.totalWorkouts)} icon="calendar" color={D.primary} />
          <OverviewCard label="This Month" value={String(totalStats.last30Count)} icon="trending-up" color={D.green} />
          <OverviewCard label="Total Volume" value={totalStats.totalVolume >= 1000 ? `${(totalStats.totalVolume / 1000).toFixed(0)}t` : `${Math.round(totalStats.totalVolume)}kg`} icon="barbell" color={D.amber} />
          <OverviewCard label="Exercises PR'd" value={String(totalStats.prCount)} icon="trophy" color={D.purple} />
        </View>

        {/* Tab bar */}
        <View style={st.tabBar}>
          {(['calendar', 'volume', 'records'] as TabKey[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[st.tab, activeTab === tab && st.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[st.tabText, activeTab === tab && st.tabTextActive]}>
                {tab === 'calendar' ? '📅 Calendar' : tab === 'volume' ? '📊 Progress' : '🏆 Records'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calendar tab */}
        {activeTab === 'calendar' && (
          <View style={st.section}>
            <MonthCalendar
              year={calMonth.year}
              month={calMonth.month}
              workoutDays={workoutDaysSet}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onPrevMonth={() =>
                setCalMonth(({ year, month }) =>
                  month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
                )
              }
              onNextMonth={() =>
                setCalMonth(({ year, month }) =>
                  month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
                )
              }
            />

            {selectedDate && selectedDaySessions.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={st.dayDetailTitle}>
                  {new Date(selectedDate.split('-').map(Number)[0], selectedDate.split('-').map(Number)[1], selectedDate.split('-').map(Number)[2]).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                {selectedDaySessions.map((session) => (
                  <SessionReplay key={session.id} session={session} />
                ))}
              </View>
            )}

            {selectedDate && selectedDaySessions.length === 0 && (
              <View style={st.emptyDay}>
                <Text style={st.emptyDayText}>No workouts on this day</Text>
              </View>
            )}
          </View>
        )}

        {/* Volume/Progress tab */}
        {activeTab === 'volume' && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Weekly Volume</Text>
            {weeklyVolume.length > 0 ? (
              <VolumeBarChart data={weeklyVolume} />
            ) : (
              <Text style={st.emptyText}>No workout data yet</Text>
            )}

            <Text style={[st.sectionTitle, { marginTop: 24 }]}>Exercise Trends</Text>
            {/* Exercise picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                {exerciseList.slice(0, 10).map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      st.exChip,
                      selectedExerciseId === ex.id && st.exChipSelected,
                    ]}
                    onPress={() =>
                      setSelectedExerciseId((prev) => (prev === ex.id ? null : ex.id))
                    }
                  >
                    <Text
                      style={[
                        st.exChipText,
                        selectedExerciseId === ex.id && { color: D.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {ex.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {exerciseTrend && exerciseTrend.dataPoints.length > 0 ? (
              <ExerciseTrendChart trend={exerciseTrend} />
            ) : selectedExerciseId ? (
              <Text style={st.emptyText}>Not enough data for this exercise</Text>
            ) : (
              <Text style={st.emptyText}>Select an exercise above to view trends</Text>
            )}
          </View>
        )}

        {/* Personal Records tab */}
        {activeTab === 'records' && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Personal Records</Text>
            {personalRecords.length === 0 && (
              <Text style={st.emptyText}>Log some workouts to set your PRs!</Text>
            )}
            {personalRecords.map((pr, i) => (
              <View key={i} style={st.prRow}>
                <View style={st.prRank}>
                  <Text style={st.prRankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.prName}>{pr.exerciseName}</Text>
                  <Text style={st.prDate}>
                    {new Date(pr.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.prWeight}>{pr.weight}kg × {pr.reps}</Text>
                  <Text style={st.pr1RM}>
                    {estimate1RM(pr.weight, pr.reps)}kg e1RM
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month Calendar
// ─────────────────────────────────────────────────────────────────────────────
function MonthCalendar({ year, month, workoutDays, selectedDate, onSelectDate, onPrevMonth, onNextMonth }: any) {
  const monthName = new Date(year, month, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      {/* Month navigation */}
      <View style={st.calNav}>
        <TouchableOpacity onPress={onPrevMonth} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={D.text} />
        </TouchableOpacity>
        <Text style={st.calMonthTitle}>{monthName}</Text>
        <TouchableOpacity onPress={onNextMonth} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={D.text} />
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={st.calDayLabels}>
        {DAYS_OF_WEEK.map((d) => (
          <Text key={d} style={st.calDayLabel}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={st.calGrid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={st.calCell} />;
          const today = new Date();
          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
          const key = `${year}-${month}-${day}`;
          const hasWorkout = workoutDays.has(key);
          const isSelected = selectedDate === key;
          return (
            <TouchableOpacity
              key={i}
              style={[
                st.calCell,
                isToday && st.calCellToday,
                isSelected && st.calCellSelected,
                hasWorkout && !isSelected && st.calCellWorkout,
              ]}
              onPress={() => onSelectDate(isSelected ? null : key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  st.calDayNum,
                  isToday && st.calDayNumToday,
                  isSelected && { color: D.white },
                  hasWorkout && !isToday && !isSelected && { color: D.green },
                ]}
              >
                {day}
              </Text>
              {hasWorkout && !isSelected && <View style={st.calDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Replay Card (shows full workout from a selected day)
// ─────────────────────────────────────────────────────────────────────────────
function SessionReplay({ session }: { session: WorkoutSession }) {
  const [expanded, setExpanded] = useState(false);
  const totalVol = session.totalVolume || 0;
  const dur = session.durationSeconds;

  return (
    <View style={st.replayCard}>
      <TouchableOpacity onPress={() => setExpanded((e) => !e)} style={st.replayHeader} activeOpacity={0.75}>
        <View style={{ flex: 1 }}>
          <Text style={st.replayTitle}>{session.workoutName}</Text>
          <View style={st.replayMeta}>
            {dur ? <Text style={st.replayMetaText}>{Math.round(dur / 60)}m</Text> : null}
            {totalVol > 0 ? <Text style={st.replayMetaText}>{Math.round(totalVol)}kg vol</Text> : null}
            {session.effortRating ? (
              <Text style={st.replayMetaText}>{'⭐'.repeat(session.effortRating)}</Text>
            ) : null}
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={D.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={st.replayBody}>
          {session.exercises?.map((ex, i) => {
            const done = ex.sets.filter((s) => s.isCompleted);
            if (done.length === 0) return null;
            return (
              <View key={i} style={st.replayExRow}>
                <Text style={st.replayExName}>{ex.exerciseName}</Text>
                <View style={st.replaySetGrid}>
                  {done.map((set, si) => (
                    <View key={si} style={st.replaySetChip}>
                      <Text style={st.replaySetText}>{set.weight}kg×{set.reps}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          {session.memberNotes ? (
            <View style={st.replayNotes}>
              <Ionicons name="chatbubble-ellipses-outline" size={12} color={D.textMuted} />
              <Text style={st.replayNotesText}>{session.memberNotes}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume Bar Chart (simple React Native view-based chart, no library needed)
// ─────────────────────────────────────────────────────────────────────────────
function VolumeBarChart({ data }: { data: WeeklyVolumeSummary[] }) {
  const maxVol = Math.max(...data.map((d) => d.totalVolume), 1);

  return (
    <View style={st.chartWrap}>
      <View style={st.chartBars}>
        {data.map((week, i) => {
          const heightPct = week.totalVolume / maxVol;
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={st.chartBarCol}>
              <Text style={st.chartBarVal}>
                {week.totalVolume >= 1000
                  ? `${(week.totalVolume / 1000).toFixed(1)}k`
                  : Math.round(week.totalVolume) > 0
                  ? `${Math.round(week.totalVolume)}`
                  : ''}
              </Text>
              <View style={st.chartBarTrack}>
                <View
                  style={[
                    st.chartBarFill,
                    {
                      height: `${Math.max(heightPct * 100, 3)}%`,
                      backgroundColor: isLast ? D.primary : D.primary + '60',
                    },
                  ]}
                />
              </View>
              <Text style={st.chartBarLabel} numberOfLines={1}>
                {week.weekLabel.split('–')[0].trim()}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise Trend Chart (weight over time)
// ─────────────────────────────────────────────────────────────────────────────
function ExerciseTrendChart({ trend }: { trend: ExerciseVolumeTrend }) {
  const points = trend.dataPoints;
  const maxWeight = Math.max(...points.map((p) => p.maxWeight), 1);

  return (
    <View>
      <Text style={st.trendTitle}>{trend.exerciseName} — Max Weight</Text>
      <View style={st.chartWrap}>
        <View style={st.chartBars}>
          {points.slice(-10).map((p, i) => {
            const heightPct = p.maxWeight / maxWeight;
            const isLast = i === Math.min(points.length, 10) - 1;
            const date = new Date(p.date);
            return (
              <View key={i} style={st.chartBarCol}>
                <Text style={st.chartBarVal}>{p.maxWeight > 0 ? `${p.maxWeight}` : ''}</Text>
                <View style={st.chartBarTrack}>
                  <View
                    style={[
                      st.chartBarFill,
                      {
                        height: `${Math.max(heightPct * 100, 3)}%`,
                        backgroundColor: isLast ? D.green : D.green + '60',
                      },
                    ]}
                  />
                </View>
                <Text style={st.chartBarLabel}>
                  {date.toLocaleDateString('en', { month: 'numeric', day: 'numeric' })}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      {/* 1RM line */}
      <View style={st.trendStats}>
        <View style={st.trendStat}>
          <Text style={st.trendStatVal}>{Math.max(...points.map((p) => p.maxWeight))}kg</Text>
          <Text style={st.trendStatLbl}>Best Weight</Text>
        </View>
        <View style={st.trendStat}>
          <Text style={st.trendStatVal}>{Math.max(...points.map((p) => p.estimated1RM))}kg</Text>
          <Text style={st.trendStatLbl}>Est. 1RM</Text>
        </View>
        <View style={st.trendStat}>
          <Text style={st.trendStatVal}>{points.length}</Text>
          <Text style={st.trendStatLbl}>Sessions</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Overview card ────────────────────────────────────────────────────────────
function OverviewCard({ label, value, icon, color }: any) {
  return (
    <View style={[st.overviewCard, { borderColor: color + '30' }]}>
      <Ionicons name={icon} size={18} color={color} style={{ marginBottom: 6 }} />
      <Text style={st.overviewVal}>{value}</Text>
      <Text style={st.overviewLbl}>{label}</Text>
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: D.surface,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: D.text, fontSize: 17, fontWeight: '700' },

  overviewRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: D.card,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: D.border,
  },
  overviewVal: { color: D.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  overviewLbl: { color: D.textMuted, fontSize: 9, textAlign: 'center' },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: D.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: D.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: { backgroundColor: D.elevated },
  tabText: { color: D.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: D.text },

  section: {
    marginHorizontal: 16,
    backgroundColor: D.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: D.border,
    marginBottom: 12,
  },
  sectionTitle: { color: D.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  emptyText: { color: D.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  // Calendar
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calMonthTitle: { color: D.text, fontSize: 16, fontWeight: '700' },
  calDayLabels: { flexDirection: 'row', marginBottom: 4 },
  calDayLabel: {
    flex: 1,
    textAlign: 'center',
    color: D.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 2,
  },
  calCellToday: { borderWidth: 1.5, borderColor: D.primary },
  calCellSelected: { backgroundColor: D.primary },
  calCellWorkout: { backgroundColor: D.greenSoft },
  calDayNum: { color: D.textSub, fontSize: 13, fontWeight: '600' },
  calDayNumToday: { color: D.primary, fontWeight: '800' },
  calDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: D.green,
    marginTop: 1,
  },

  dayDetailTitle: {
    color: D.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyDay: { paddingVertical: 12, alignItems: 'center' },
  emptyDayText: { color: D.textMuted, fontSize: 13 },

  // Session replay
  replayCard: {
    backgroundColor: D.elevated,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
  },
  replayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  replayTitle: { color: D.text, fontSize: 14, fontWeight: '600' },
  replayMeta: { flexDirection: 'row', gap: 10, marginTop: 4 },
  replayMetaText: { color: D.textMuted, fontSize: 12 },
  replayBody: { padding: 12, paddingTop: 0, borderTopWidth: 1, borderTopColor: D.border },
  replayExRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: D.border },
  replayExName: { color: D.textSub, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  replaySetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  replaySetChip: {
    backgroundColor: D.card,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  replaySetText: { color: D.text, fontSize: 11 },
  replayNotes: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: D.border,
    alignItems: 'flex-start',
  },
  replayNotesText: { color: D.textMuted, fontSize: 12, flex: 1, fontStyle: 'italic' },

  // Bar chart
  chartWrap: { height: 160, marginBottom: 8 },
  chartBars: { flexDirection: 'row', height: '100%', alignItems: 'flex-end', gap: 4 },
  chartBarCol: { flex: 1, alignItems: 'center' },
  chartBarVal: { color: D.textMuted, fontSize: 9, marginBottom: 2 },
  chartBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', borderRadius: 4 },
  chartBarLabel: { color: D.textMuted, fontSize: 9, marginTop: 4, textAlign: 'center' },

  // Trend chart
  trendTitle: { color: D.text, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  trendStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  trendStat: {
    flex: 1,
    backgroundColor: D.elevated,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  trendStatVal: { color: D.text, fontSize: 16, fontWeight: '700' },
  trendStatLbl: { color: D.textMuted, fontSize: 11, marginTop: 2 },
  exChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: D.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: D.border,
  },
  exChipSelected: { borderColor: D.primary, backgroundColor: D.primarySoft },
  exChipText: { color: D.textSub, fontSize: 12 },

  // PRs
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
    gap: 10,
  },
  prRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: D.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prRankText: { color: D.textMuted, fontSize: 12, fontWeight: '700' },
  prName: { color: D.text, fontSize: 14, fontWeight: '600' },
  prDate: { color: D.textMuted, fontSize: 12, marginTop: 2 },
  prWeight: { color: D.green, fontSize: 14, fontWeight: '700' },
  pr1RM: { color: D.textMuted, fontSize: 11, marginTop: 2 },
});
