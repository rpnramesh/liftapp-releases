// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Active Workout Logging Screen (Member)
// Highest-priority screen. Built for speed, gym-friendly UX, sweaty hands.
// Every action is 1–2 taps. Auto-save. Live PR detection. Rest timer.
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Alert,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import {
    buildSessionFromPlanDay,
    estimate1RM,
    getPreviousPerformance
} from '../../../services/member.workout.service';
import type {
    ActiveExercise,
    ExpandedSetLog,
    PREntry,
    PreviousPerformance,
    SetType,
    WorkoutSession,
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
  redSoft: 'rgba(239,68,68,0.14)',
  purple: '#A78BFA',
  purpleSoft: 'rgba(167,139,250,0.14)',
  cyan: '#06B6D4',
  white: '#FFFFFF',
};

const SET_TYPE_META: Record<SetType, { color: string; label: string }> = {
  warmup: { color: D.amber, label: 'W' },
  working: { color: D.primary, label: 'W' },
  drop: { color: D.purple, label: 'D' },
  failure: { color: D.red, label: 'F' },
  tempo: { color: D.cyan, label: 'T' },
  paused: { color: '#10B981', label: 'P' },
};

const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#EF4444',
  Back: '#3B82F6',
  Shoulders: '#F59E0B',
  Biceps: '#8B5CF6',
  Triceps: '#EC4899',
  Legs: '#10B981',
  Glutes: '#06B6D4',
  Core: '#F97316',
  Cardio: '#22D3EE',
  'Full Body': '#A78BFA',
  Other: '#6B7280',
};
const getMuscleColor = (m: string) => MUSCLE_COLORS[m] || MUSCLE_COLORS.Other;

// ─── Time formatters ──────────────────────────────────────────────────────────
const fmtTime = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtVol = (vol: number): string => {
  if (vol >= 10000) return `${(vol / 1000).toFixed(1)}t`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return `${Math.round(vol)}kg`;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ActiveWorkoutScreen({ navigation, route }: any) {
  const { memberId, gymId } = useAuth();
  const { exercises: planExercises, planName, dayLabel, planId, trainerId } = route.params;
  const DRAFT_KEY = `@lift_draft_${memberId}`;

  // ── State ─────────────────────────────────────────────────────────────────
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [prevPerf, setPrevPerf] = useState<Record<string, PreviousPerformance>>({});
  const [expandedIdx, setExpandedIdx] = useState<number>(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [restTimer, setRestTimer] = useState<{
    exerciseId: string;
    remaining: number;
    total: number;
  } | null>(null);
  const [prFlash, setPrFlash] = useState<PREntry | null>(null);
  const [sessionPRs, setSessionPRs] = useState<PREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const prAnim = useRef(new Animated.Value(0)).current;
  const prSlide = useRef(new Animated.Value(30)).current;

  // ── Build initial session ─────────────────────────────────────────────────
  const buildInitialSession = useCallback(
    (perf: Record<string, PreviousPerformance>): WorkoutSession =>
      buildSessionFromPlanDay({
        gymId: gymId!,
        memberId: memberId!,
        trainerId,
        planId,
        planName,
        dayLabel,
        exercises: planExercises,
        prevPerf: perf,
      }),
    [gymId, memberId, trainerId, planId, planName, dayLabel, planExercises],
  );

  // ── Mount: load previous performance + check for draft ───────────────────
  useEffect(() => {
    (async () => {
      const perf =
        gymId && memberId
          ? await getPreviousPerformance(gymId, memberId).catch(() => ({}))
          : {};
      setPrevPerf(perf);

      // Check for existing draft for this plan
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft: WorkoutSession = JSON.parse(raw);
          if (draft.workoutId === planId && draft.status === 'active') {
            Alert.alert(
              'Resume Workout?',
              'You have an unfinished workout. Resume where you left off?',
              [
                { text: 'Start Fresh', onPress: () => setSession(buildInitialSession(perf)) },
                { text: 'Resume', style: 'default', onPress: () => setSession(draft) },
              ],
              { cancelable: false },
            );
            setLoading(false);
            return;
          }
        }
      } catch {}

      setSession(buildInitialSession(perf));
      setLoading(false);
    })();
  }, []);

  // ── Workout timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [!!session]);

  // ── Rest timer countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) {
      if (restTimer?.remaining === 0) {
        Vibration.vibrate([0, 150, 80, 150, 80, 200]);
        setRestTimer(null);
      }
      return;
    }
    const t = setTimeout(
      () => setRestTimer((prev) => prev ? { ...prev, remaining: prev.remaining - 1 } : null),
      1000,
    );
    return () => clearTimeout(t);
  }, [restTimer?.remaining]);

  // ── Auto-save draft ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || !memberId) return;
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(session)).catch(() => {});
  }, [session]);

  // ── PR flash animation ────────────────────────────────────────────────────
  const flashPR = useCallback((pr: PREntry) => {
    setPrFlash(pr);
    prAnim.setValue(0);
    prSlide.setValue(30);
    Animated.parallel([
      Animated.timing(prAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(prSlide, { toValue: 0, duration: 250, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(prAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(
          () => setPrFlash(null),
        );
      }, 2800);
    });
  }, []);

  // ── Live metrics ──────────────────────────────────────────────────────────
  const { totalVolume, completedSets, totalSets } = useMemo(() => {
    if (!session) return { totalVolume: 0, completedSets: 0, totalSets: 0 };
    let vol = 0, done = 0, total = 0;
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        total++;
        if (s.isCompleted) {
          done++;
          vol += (s.weight || 0) * (s.reps || 0);
        }
      }
    }
    return { totalVolume: vol, completedSets: done, totalSets: total };
  }, [session]);

  // ── Update a single set field ─────────────────────────────────────────────
  const updateSet = useCallback(
    (exIdx: number, setIdx: number, changes: Partial<ExpandedSetLog>) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((ex, ei) =>
            ei !== exIdx
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((s, si) =>
                    si === setIdx ? { ...s, ...changes } : s,
                  ),
                },
          ),
        };
      });
    },
    [],
  );

  // ── Complete a set (the main tap action) ─────────────────────────────────
  const completeSet = useCallback(
    (exIdx: number, setIdx: number, weight: number, reps: number) => {
      if (!session) return;
      const exercise = session.exercises[exIdx];
      const set = exercise.sets[setIdx];
      const now = Date.now();

      updateSet(exIdx, setIdx, {
        weight,
        reps,
        isCompleted: true,
        completedAt: now,
      });

      Vibration.vibrate(50);

      // PR detection
      const prev = prevPerf[exercise.exerciseId];
      if (prev && weight > 0 && reps > 0 && set.setType !== 'warmup') {
        const new1RM = estimate1RM(weight, reps);
        const old1RM = prev.estimated1RM || 0;
        let pr: PREntry | null = null;

        if (weight > prev.lastWeight) {
          pr = {
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            prType: 'weight',
            value: weight,
            previousValue: prev.lastWeight,
            achievedAt: now,
          };
        } else if (old1RM > 0 && new1RM > old1RM) {
          pr = {
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            prType: 'estimated1rm',
            value: new1RM,
            previousValue: old1RM,
            achievedAt: now,
          };
        }

        if (pr) {
          flashPR(pr);
          setSessionPRs((prs) => {
            const existing = prs.findIndex((p) => p.exerciseId === pr!.exerciseId);
            if (existing >= 0) {
              const updated = [...prs];
              updated[existing] = pr!;
              return updated;
            }
            return [...prs, pr!];
          });
        }
      }

      // Start rest timer for non-warmup sets
      if (set.setType !== 'warmup' && exercise.restSeconds > 0) {
        setRestTimer({
          exerciseId: exercise.exerciseId,
          remaining: exercise.restSeconds,
          total: exercise.restSeconds,
        });
      }
    },
    [session, prevPerf, updateSet, flashPR],
  );

  // ── Add a set to exercise ─────────────────────────────────────────────────
  const addSet = useCallback((exIdx: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const ex = prev.exercises[exIdx];
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet: ExpandedSetLog = {
        setNumber: ex.sets.length + 1,
        weight: lastSet?.weight ?? 0,
        reps: lastSet?.reps ?? ex.targetReps ?? 10,
        targetReps: ex.targetReps,
        setType: (lastSet?.setType as SetType) || 'working',
        isCompleted: false,
      };
      return {
        ...prev,
        exercises: prev.exercises.map((e, i) =>
          i === exIdx ? { ...e, sets: [...e.sets, newSet] } : e,
        ),
      };
    });
  }, []);

  // ── Copy previous set values into next incomplete set ────────────────────
  const copyPrevSet = useCallback((exIdx: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const ex = prev.exercises[exIdx];
      const lastCompleted = [...ex.sets].reverse().find((s) => s.isCompleted);
      if (!lastCompleted) return prev;
      const nextIdx = ex.sets.findIndex((s) => !s.isCompleted);
      if (nextIdx === -1) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((e, i) =>
          i !== exIdx
            ? e
            : {
                ...e,
                sets: e.sets.map((s, si) =>
                  si === nextIdx
                    ? { ...s, weight: lastCompleted.weight, reps: lastCompleted.reps }
                    : s,
                ),
              },
        ),
      };
    });
  }, []);

  // ── Navigate to finish screen ─────────────────────────────────────────────
  const handleFinish = useCallback(() => {
    if (!session) return;
    const incompleteSets = session.exercises.flatMap((ex) =>
      ex.sets.filter((s) => !s.isCompleted),
    ).length;

    if (incompleteSets > 0) {
      Alert.alert(
        'Finish Workout?',
        `You still have ${incompleteSets} incomplete set${incompleteSets > 1 ? 's' : ''}. Finish anyway?`,
        [
          { text: 'Keep Going', style: 'cancel' },
          { text: 'Finish', style: 'destructive', onPress: goToFinish },
        ],
      );
    } else {
      goToFinish();
    }
  }, [session, elapsedSecs]);

  const goToFinish = useCallback(() => {
    if (!session) return;
    const finishedSession: WorkoutSession = {
      ...session,
      durationSeconds: elapsedSecs,
      completedAt: Date.now(),
      status: 'completed',
      newPRs: sessionPRs,
    };
    navigation.navigate('WorkoutFinish', { session: finishedSession });
  }, [session, elapsedSecs, sessionPRs, navigation]);

  // ── Back with confirmation ────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    Alert.alert(
      'Leave Workout?',
      'Your progress is auto-saved. You can resume this workout later.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', onPress: () => navigation.goBack() },
      ],
    );
  }, [navigation]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (loading || !session) {
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.loadingCenter}>
          <Text style={{ color: D.textSub, fontSize: 15 }}>Loading workout…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const restPct = restTimer ? restTimer.remaining / restTimer.total : 0;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={st.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={14} style={st.backBtn}>
            <Ionicons name="chevron-back" size={26} color={D.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={st.headerTitle} numberOfLines={1}>{planName}</Text>
            {dayLabel ? <Text style={st.headerSub} numberOfLines={1}>{dayLabel}</Text> : null}
          </View>
          <View style={st.timerPill}>
            <Ionicons name="time-outline" size={13} color={D.primary} />
            <Text style={st.timerText}>{fmtTime(elapsedSecs)}</Text>
          </View>
        </View>

        {/* ── Live stats bar ──────────────────────────────────────────────── */}
        <View style={st.statsBar}>
          <View style={st.statItem}>
            <Text style={st.statVal}>{fmtVol(totalVolume)}</Text>
            <Text style={st.statLbl}>Volume</Text>
          </View>
          <View style={st.statDivider} />
          <View style={st.statItem}>
            <Text style={st.statVal}>{completedSets}</Text>
            <Text style={st.statLbl}>Sets Done</Text>
          </View>
          <View style={st.statDivider} />
          <View style={st.statItem}>
            <Text style={st.statVal}>{totalSets}</Text>
            <Text style={st.statLbl}>Total Sets</Text>
          </View>
          <View style={st.statDivider} />
          <View style={st.statItem}>
            <Text style={st.statVal}>{session.exercises.length}</Text>
            <Text style={st.statLbl}>Exercises</Text>
          </View>
        </View>

        {/* ── Rest timer banner ──────────────────────────────────────────── */}
        {restTimer && (
          <View style={st.restBanner}>
            {/* Progress bar */}
            <View style={st.restProgressTrack}>
              <View style={[st.restProgressFill, { width: `${restPct * 100}%` }]} />
            </View>
            <View style={st.restRow}>
              <View style={st.restLeft}>
                <Text style={st.restLabel}>REST</Text>
                <Text style={st.restTime}>{fmtTime(restTimer.remaining)}</Text>
              </View>
              <View style={st.restActions}>
                <TouchableOpacity
                  style={st.restAdjBtn}
                  onPress={() => setRestTimer((r) => r ? { ...r, remaining: Math.max(0, r.remaining - 15) } : null)}
                  hitSlop={10}
                >
                  <Text style={st.restAdjText}>-15s</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={st.restAdjBtn}
                  onPress={() => setRestTimer((r) => r ? { ...r, remaining: r.remaining + 15 } : null)}
                  hitSlop={10}
                >
                  <Text style={st.restAdjText}>+15s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.restSkipBtn} onPress={() => setRestTimer(null)} hitSlop={10}>
                  <Text style={st.restSkipText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── Exercise list ──────────────────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {session.exercises.map((exercise, exIdx) => (
            <ExerciseCard
              key={exercise.exerciseId + exIdx}
              exercise={exercise}
              exIdx={exIdx}
              expanded={expandedIdx === exIdx}
              onToggle={() => setExpandedIdx((prev) => (prev === exIdx ? -1 : exIdx))}
              prevPerf={prevPerf[exercise.exerciseId]}
              onUpdateSet={(setIdx, changes) => updateSet(exIdx, setIdx, changes)}
              onCompleteSet={(setIdx, w, r) => completeSet(exIdx, setIdx, w, r)}
              onAddSet={() => addSet(exIdx)}
              onCopyPrev={() => copyPrevSet(exIdx)}
            />
          ))}
        </ScrollView>

        {/* ── PR Toast ──────────────────────────────────────────────────── */}
        {prFlash && (
          <Animated.View
            style={[
              st.prToast,
              {
                opacity: prAnim,
                transform: [{ translateY: prSlide }],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={st.prToastIcon}>🏆</Text>
            <View>
              <Text style={st.prToastTitle}>New PR!</Text>
              <Text style={st.prToastSub}>
                {prFlash.exerciseName} — {prFlash.prType === 'weight' ? `${prFlash.value}kg` : `${prFlash.value}kg e1RM`}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── Bottom action bar ──────────────────────────────────────────── */}
        <View style={st.bottomBar}>
          <View style={st.bottomLeft}>
            <Text style={st.bottomVol}>{fmtVol(totalVolume)}</Text>
            <Text style={st.bottomSubs}>{completedSets}/{totalSets} sets · {fmtTime(elapsedSecs)}</Text>
          </View>
          <TouchableOpacity style={st.finishBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={20} color={D.white} />
            <Text style={st.finishBtnText}>Finish</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise Card Component
// ─────────────────────────────────────────────────────────────────────────────
function ExerciseCard({
  exercise,
  exIdx,
  expanded,
  onToggle,
  prevPerf,
  onUpdateSet,
  onCompleteSet,
  onAddSet,
  onCopyPrev,
}: {
  exercise: ActiveExercise;
  exIdx: number;
  expanded: boolean;
  onToggle: () => void;
  prevPerf: PreviousPerformance | undefined;
  onUpdateSet: (setIdx: number, changes: Partial<ExpandedSetLog>) => void;
  onCompleteSet: (setIdx: number, weight: number, reps: number) => void;
  onAddSet: () => void;
  onCopyPrev: () => void;
}) {
  const completedCount = exercise.sets.filter((s) => s.isCompleted).length;
  const allDone = completedCount === exercise.sets.length && exercise.sets.length > 0;
  const muscleColor = getMuscleColor(exercise.muscleGroup);

  return (
    <View style={[st.exerciseCard, allDone && st.exerciseCardDone]}>
      {/* Collapsed header — always visible */}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.75}
        style={st.exHeader}
      >
        <View style={[st.muscleBar, { backgroundColor: muscleColor }]} />
        <View style={{ flex: 1 }}>
          <View style={st.exTitleRow}>
            <Text style={st.exName} numberOfLines={1}>{exercise.exerciseName}</Text>
            {allDone && (
              <Ionicons name="checkmark-circle" size={18} color={D.green} style={{ marginLeft: 6 }} />
            )}
          </View>
          <View style={st.exMetaRow}>
            <View style={[st.musclePill, { backgroundColor: muscleColor + '20' }]}>
              <Text style={[st.musclePillText, { color: muscleColor }]}>{exercise.muscleGroup}</Text>
            </View>
            {prevPerf ? (
              <Text style={st.prevPerfText}>
                Last: {prevPerf.lastWeight}kg × {prevPerf.lastReps}
              </Text>
            ) : (
              <Text style={st.noPrevText}>No previous data</Text>
            )}
            <Text style={st.setProgress}>{completedCount}/{exercise.sets.length}</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={D.textMuted}
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {/* Expanded: set table */}
      {expanded && (
        <View style={st.setTableWrap}>
          {/* Target from trainer */}
          {(exercise.targetReps || exercise.targetWeight) && (
            <View style={st.targetRow}>
              <Ionicons name="person" size={12} color={D.amber} />
              <Text style={st.targetText}>
                Target: {exercise.targetSets} × {exercise.targetReps} reps
                {exercise.targetWeight ? ` @ ${exercise.targetWeight}kg` : ''}
              </Text>
            </View>
          )}

          {/* Column headers */}
          <View style={st.colHeaders}>
            <Text style={[st.colHdr, st.colSet]}>SET</Text>
            <Text style={[st.colHdr, st.colPrev]}>PREV</Text>
            <Text style={[st.colHdr, st.colKg]}>KG</Text>
            <Text style={[st.colHdr, st.colReps]}>REPS</Text>
            <Text style={[st.colHdr, st.colDone]}></Text>
          </View>

          {/* Set rows */}
          {exercise.sets.map((set, setIdx) => (
            <SetRow
              key={setIdx}
              set={set}
              setIdx={setIdx}
              prevPerf={prevPerf}
              onUpdate={(changes) => onUpdateSet(setIdx, changes)}
              onComplete={(w, r) => onCompleteSet(setIdx, w, r)}
            />
          ))}

          {/* Row actions */}
          <View style={st.rowActions}>
            <TouchableOpacity style={st.addSetBtn} onPress={onAddSet} activeOpacity={0.75}>
              <Ionicons name="add-circle-outline" size={16} color={D.primary} />
              <Text style={st.addSetText}>Add Set</Text>
            </TouchableOpacity>
            {exercise.sets.some((s) => s.isCompleted) && (
              <TouchableOpacity style={st.copyBtn} onPress={onCopyPrev} activeOpacity={0.75}>
                <Ionicons name="copy-outline" size={14} color={D.textSub} />
                <Text style={st.copyText}>Copy Last</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Trainer notes */}
          {!!exercise.notes && (
            <View style={st.trainerNote}>
              <Ionicons name="chatbubble-ellipses-outline" size={13} color={D.amber} />
              <Text style={st.trainerNoteText}>{exercise.notes}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Set Row Component
// Gym-friendly: large inputs, tap to complete, decimal weight support
// ─────────────────────────────────────────────────────────────────────────────
function SetRow({
  set,
  setIdx,
  prevPerf,
  onUpdate,
  onComplete,
}: {
  set: ExpandedSetLog;
  setIdx: number;
  prevPerf: PreviousPerformance | undefined;
  onUpdate: (changes: Partial<ExpandedSetLog>) => void;
  onComplete: (weight: number, reps: number) => void;
}) {
  const [weightStr, setWeightStr] = useState(
    set.weight > 0 ? String(set.weight) : '',
  );
  const [repsStr, setRepsStr] = useState(
    set.reps > 0 ? String(set.reps) : '',
  );

  // Sync external changes (e.g. copyPrevSet)
  useEffect(() => {
    if (!set.isCompleted) {
      setWeightStr(set.weight > 0 ? String(set.weight) : '');
      setRepsStr(set.reps > 0 ? String(set.reps) : '');
    }
  }, [set.weight, set.reps, set.isCompleted]);

  const meta = SET_TYPE_META[set.setType as SetType] || SET_TYPE_META.working;
  const prevLabel = prevPerf
    ? `${prevPerf.lastWeight}×${prevPerf.lastReps}`
    : '—';

  const handleComplete = () => {
    if (set.isCompleted) return;
    const w = parseFloat(weightStr) || 0;
    const r = parseInt(repsStr, 10) || 0;
    onUpdate({ weight: w, reps: r });
    onComplete(w, r);
  };

  const handleBlurWeight = () => {
    const parsed = parseFloat(weightStr);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdate({ weight: parsed });
    } else {
      setWeightStr(set.weight > 0 ? String(set.weight) : '');
    }
  };

  const handleBlurReps = () => {
    const parsed = parseInt(repsStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onUpdate({ reps: parsed });
    } else {
      setRepsStr(set.reps > 0 ? String(set.reps) : '');
    }
  };

  return (
    <View style={[st.setRow, set.isCompleted && st.setRowDone]}>
      {/* Set indicator */}
      <View style={[st.colSet, st.setNumWrap]}>
        <View style={[st.setTypeDot, { backgroundColor: meta.color }]} />
        <Text style={st.setNum}>{set.setNumber}</Text>
      </View>

      {/* Previous */}
      <Text style={[st.colPrev, st.setPrev]}>{prevLabel}</Text>

      {/* Weight input */}
      <View style={[st.colKg, st.inputWrap]}>
        <TextInput
          style={[st.numInput, set.isCompleted && st.numInputDone]}
          value={weightStr}
          onChangeText={setWeightStr}
          onBlur={handleBlurWeight}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={D.textMuted}
          selectTextOnFocus
          editable={!set.isCompleted}
          returnKeyType="done"
        />
        <Text style={st.inputUnit}>kg</Text>
      </View>

      {/* Reps input */}
      <View style={[st.colReps, st.inputWrap]}>
        <TextInput
          style={[st.numInput, set.isCompleted && st.numInputDone]}
          value={repsStr}
          onChangeText={setRepsStr}
          onBlur={handleBlurReps}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={D.textMuted}
          selectTextOnFocus
          editable={!set.isCompleted}
          returnKeyType="done"
        />
      </View>

      {/* Complete button — large hit area, gym friendly */}
      <TouchableOpacity
        style={[st.colDone, st.completeBtn]}
        onPress={handleComplete}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        activeOpacity={0.65}
        disabled={set.isCompleted}
      >
        <Ionicons
          name={set.isCompleted ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={32}
          color={set.isCompleted ? D.green : D.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D.bg },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: D.surface,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  backBtn: { padding: 4, marginRight: 2 },
  headerTitle: { color: D.text, fontSize: 16, fontWeight: '700' },
  headerSub: { color: D.textSub, fontSize: 12, marginTop: 1 },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: D.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timerText: {
    color: D.primary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // ── Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: D.surface,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  statVal: { color: D.text, fontSize: 17, fontWeight: '800' },
  statLbl: { color: D.textMuted, fontSize: 10, marginTop: 2, letterSpacing: 0.3 },
  statDivider: { width: 1, backgroundColor: D.border, marginVertical: 4 },

  // ── Rest timer banner
  restBanner: {
    backgroundColor: D.card,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  restProgressTrack: { height: 3, backgroundColor: D.elevated },
  restProgressFill: { height: 3, backgroundColor: D.primary },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  restLeft: { flex: 1 },
  restLabel: {
    color: D.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  restTime: {
    color: D.primary,
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  restActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  restAdjBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: D.elevated,
    borderRadius: 8,
  },
  restAdjText: { color: D.textSub, fontSize: 13, fontWeight: '600' },
  restSkipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: D.primarySoft,
    borderRadius: 8,
  },
  restSkipText: { color: D.primary, fontSize: 13, fontWeight: '700' },

  // ── Exercise card
  exerciseCard: {
    marginHorizontal: 10,
    marginBottom: 8,
    backgroundColor: D.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: D.border,
  },
  exerciseCardDone: { borderColor: D.green + '40' },
  exerciseBorderDone: { borderColor: D.green },
  muscleBar: { width: 4, borderRadius: 2, marginRight: 12, alignSelf: 'stretch' },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: 72,
  },
  exTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  exName: { color: D.text, fontSize: 16, fontWeight: '700', flex: 1 },
  exMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  musclePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  musclePillText: { fontSize: 11, fontWeight: '600' },
  prevPerfText: { color: D.textSub, fontSize: 12 },
  noPrevText: { color: D.textMuted, fontSize: 12, fontStyle: 'italic' },
  setProgress: { marginLeft: 'auto', color: D.textMuted, fontSize: 12 },

  // ── Set table
  setTableWrap: {
    borderTopWidth: 1,
    borderTopColor: D.border,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
    marginBottom: 4,
  },
  targetText: { color: D.amber, fontSize: 12 },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  colHdr: {
    color: D.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  // Column widths — used by both headers and rows
  colSet: { width: 36 },
  colPrev: { flex: 1, textAlign: 'center' },
  colKg: { width: 82 },
  colReps: { width: 62 },
  colDone: { width: 48, alignItems: 'center' },

  // ── Set rows
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginVertical: 2,
    minHeight: 52,
  },
  setRowDone: { backgroundColor: D.greenSoft },
  setNumWrap: { alignItems: 'center', justifyContent: 'center' },
  setTypeDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 2 },
  setNum: { color: D.textSub, fontSize: 13, fontWeight: '700' },
  setPrev: { color: D.textMuted, fontSize: 13, textAlign: 'center' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.elevated,
    borderRadius: 8,
    paddingHorizontal: 6,
    height: 44,
  },
  numInput: {
    flex: 1,
    color: D.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
    minWidth: 28,
  },
  numInputDone: { color: D.green },
  inputUnit: { color: D.textMuted, fontSize: 12, marginLeft: 2 },
  completeBtn: { justifyContent: 'center' },

  // ── Row actions
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: D.primarySoft,
    borderRadius: 8,
  },
  addSetText: { color: D.primary, fontSize: 13, fontWeight: '600' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: D.elevated,
    borderRadius: 8,
  },
  copyText: { color: D.textSub, fontSize: 13 },
  trainerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: D.amberSoft,
    borderRadius: 8,
    padding: 9,
    marginTop: 8,
  },
  trainerNoteText: { color: D.amber, fontSize: 12, flex: 1, lineHeight: 17 },

  // ── PR Toast
  prToast: {
    position: 'absolute',
    bottom: 88,
    left: 14,
    right: 14,
    backgroundColor: '#1C1F18',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: D.amber,
    shadowColor: D.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  prToastIcon: { fontSize: 30 },
  prToastTitle: { color: D.amber, fontSize: 15, fontWeight: '800' },
  prToastSub: { color: D.textSub, fontSize: 13, marginTop: 2 },

  // ── Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: D.surface,
    borderTopWidth: 1,
    borderTopColor: D.border,
    gap: 12,
  },
  bottomLeft: { flex: 1 },
  bottomVol: { color: D.text, fontSize: 20, fontWeight: '800' },
  bottomSubs: { color: D.textMuted, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: D.green,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  finishBtnText: { color: D.white, fontSize: 16, fontWeight: '700' },
});
