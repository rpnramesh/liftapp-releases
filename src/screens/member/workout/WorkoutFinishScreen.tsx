// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Workout Finish / Summary Screen (Member)
// Shown after completing a workout. Recap stats, effort rating, notes,
// optional progress photo, and "Send to Trainer" action.
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import {
    calculateSessionVolume,
    clearDraft,
    saveWorkoutSession,
} from '../../../services/member.workout.service';
import type { PREntry, WorkoutSession } from '../../../types/member.workout.types';

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
  white: '#FFFFFF',
};

const fmtDuration = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtVol = (vol: number): string => {
  if (vol >= 10000) return `${(vol / 1000).toFixed(1)}t`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k kg`;
  return `${Math.round(vol)} kg`;
};

const EFFORT_LABELS = ['', 'Easy', 'Light', 'Moderate', 'Hard', 'Max Effort'];
const EFFORT_COLORS = ['', D.textMuted, '#3B82F6', D.green, D.amber, D.red];

// ─────────────────────────────────────────────────────────────────────────────
export default function WorkoutFinishScreen({ navigation, route }: any) {
  const { memberId, gymId } = useAuth();
  const { session: incomingSession }: { session: WorkoutSession } = route.params;

  const [memberNotes, setMemberNotes] = useState('');
  const [effortRating, setEffortRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  // Derived stats
  const totalVolume = incomingSession.totalVolume || calculateSessionVolume(incomingSession);
  const durationSecs = incomingSession.durationSeconds || 0;
  const prs = incomingSession.newPRs || [];
  const completedSets = (incomingSession.exercises || []).reduce(
    (n, ex) => n + ex.sets.filter((s) => s.isCompleted).length,
    0,
  );
  const completedExercises = incomingSession.exercises?.length ?? 0;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(confettiAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start();
  }, []);

  // Save workout
  const handleSave = useCallback(
    async (sendToTrainer: boolean) => {
      if (!gymId || saving) return;
      setSaving(true);
      try {
        const finalSession: WorkoutSession = {
          ...incomingSession,
          memberNotes: memberNotes.trim(),
          effortRating: effortRating || undefined,
          sentToTrainer: sendToTrainer,
          totalVolume,
          totalSets: completedSets,
        };
        await saveWorkoutSession(gymId, finalSession);
        if (memberId) await clearDraft(memberId);
        setSaved(true);

        if (sendToTrainer) {
          Alert.alert(
            '✅ Sent to Trainer',
            'Your workout has been saved and shared with your trainer.',
            [{ text: 'Done', onPress: () => navigation.popToTop() }],
          );
        } else {
          navigation.popToTop();
        }
      } catch (err) {
        Alert.alert('Error', 'Could not save your workout. Please try again.');
        setSaving(false);
      }
    },
    [gymId, memberId, incomingSession, memberNotes, effortRating, totalVolume, completedSets, saving],
  );

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Confetti/celebration header */}
        <Animated.View
          style={[st.celebrationHeader, { opacity: confettiAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={st.celebIcon}>🎉</Text>
          <Text style={st.celebTitle}>Workout Complete!</Text>
          <Text style={st.celebSub}>{incomingSession.workoutName}</Text>
          {incomingSession.dayLabel ? (
            <Text style={st.celebDay}>{incomingSession.dayLabel}</Text>
          ) : null}
        </Animated.View>

        {/* Key stats */}
        <Animated.View
          style={[
            st.statsGrid,
            { opacity: confettiAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <StatCard
            icon="time-outline"
            value={fmtDuration(durationSecs)}
            label="Duration"
            color={D.primary}
          />
          <StatCard
            icon="barbell-outline"
            value={fmtVol(totalVolume)}
            label="Total Volume"
            color={D.green}
          />
          <StatCard
            icon="layers-outline"
            value={String(completedSets)}
            label="Sets"
            color={D.amber}
          />
          <StatCard
            icon="fitness-outline"
            value={String(completedExercises)}
            label="Exercises"
            color={D.purple || '#A78BFA'}
          />
        </Animated.View>

        {/* New PRs */}
        {prs.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>🏆 New Personal Records</Text>
            {prs.map((pr, i) => (
              <PRRow key={i} pr={pr} />
            ))}
          </View>
        )}

        {/* Exercise breakdown */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Exercise Breakdown</Text>
          {incomingSession.exercises?.map((ex, i) => {
            const done = ex.sets.filter((s) => s.isCompleted);
            if (done.length === 0) return null;
            const maxWeight = Math.max(...done.map((s) => s.weight || 0));
            const totalExVol = done.reduce((n, s) => n + (s.weight || 0) * (s.reps || 0), 0);
            return (
              <View key={i} style={st.exBreakRow}>
                <Text style={st.exBreakName} numberOfLines={1}>{ex.exerciseName}</Text>
                <View style={st.exBreakRight}>
                  <Text style={st.exBreakSets}>{done.length} sets</Text>
                  <Text style={st.exBreakWeight}>{maxWeight}kg</Text>
                  <Text style={st.exBreakVol}>{Math.round(totalExVol)}kg vol</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Effort rating */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>How was your effort?</Text>
          <View style={st.effortRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                style={[
                  st.effortBtn,
                  effortRating === star && { borderColor: EFFORT_COLORS[star], backgroundColor: EFFORT_COLORS[star] + '20' },
                ]}
                onPress={() => setEffortRating((prev) => (prev === star ? 0 : star))}
                activeOpacity={0.75}
              >
                <Text style={st.effortStar}>{'⭐'.slice(0, star > 0 ? 1 : 0) || '☆'}</Text>
                <Text style={[st.effortLabel, effortRating === star && { color: EFFORT_COLORS[star] }]}>
                  {EFFORT_LABELS[star]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Workout Notes</Text>
          <TextInput
            style={st.notesInput}
            value={memberNotes}
            onChangeText={setMemberNotes}
            placeholder="How did it go? Any form notes, pain points, or wins..."
            placeholderTextColor={D.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Action buttons */}
        <View style={st.actionSection}>
          <TouchableOpacity
            style={[st.sendBtn, saving && st.btnDisabled]}
            onPress={() => handleSave(true)}
            disabled={saving || saved}
            activeOpacity={0.85}
          >
            <Ionicons name="paper-plane" size={20} color={D.white} />
            <Text style={st.sendBtnText}>
              {saving ? 'Saving…' : 'Send to Trainer'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[st.saveBtn, saving && st.btnDisabled]}
            onPress={() => handleSave(false)}
            disabled={saving || saved}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={18} color={D.text} />
            <Text style={st.saveBtnText}>Save Workout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={st.discardBtn}
            onPress={() => {
              Alert.alert(
                'Discard Workout?',
                "This will delete your workout data. Are you sure?",
                [
                  { text: 'Keep', style: 'cancel' },
                  {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: async () => {
                      if (memberId) await clearDraft(memberId);
                      navigation.popToTop();
                    },
                  },
                ],
              );
            }}
            activeOpacity={0.75}
          >
            <Text style={st.discardText}>Discard Workout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }: any) {
  return (
    <View style={[st.statCard, { borderColor: color + '40' }]}>
      <View style={[st.statIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

// ─── PR Row ───────────────────────────────────────────────────────────────────
function PRRow({ pr }: { pr: PREntry }) {
  const increase = pr.previousValue
    ? `+${(((pr.value - pr.previousValue) / pr.previousValue) * 100).toFixed(0)}%`
    : 'First log!';
  return (
    <View style={st.prRow}>
      <Text style={st.prIcon}>🏆</Text>
      <View style={{ flex: 1 }}>
        <Text style={st.prName}>{pr.exerciseName}</Text>
        <Text style={st.prDetail}>
          {pr.prType === 'weight'
            ? `${pr.value}kg — new max weight`
            : `${pr.value}kg estimated 1RM`}
        </Text>
      </View>
      <View style={[st.prBadge, { backgroundColor: D.amberSoft }]}>
        <Text style={[st.prBadgeText, { color: D.amber }]}>{increase}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D.bg },
  celebrationHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  celebIcon: { fontSize: 52, marginBottom: 12 },
  celebTitle: { color: D.text, fontSize: 26, fontWeight: '800', marginBottom: 6 },
  celebSub: { color: D.textSub, fontSize: 15, fontWeight: '600' },
  celebDay: { color: D.textMuted, fontSize: 13, marginTop: 4 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: D.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: D.border,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { color: D.text, fontSize: 20, fontWeight: '800', marginBottom: 3 },
  statLabel: { color: D.textMuted, fontSize: 12 },

  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: D.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: D.border,
  },
  sectionTitle: { color: D.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },

  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  prIcon: { fontSize: 20 },
  prName: { color: D.text, fontSize: 14, fontWeight: '600' },
  prDetail: { color: D.textMuted, fontSize: 12, marginTop: 2 },
  prBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  prBadgeText: { fontSize: 12, fontWeight: '700' },

  exBreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  exBreakName: { color: D.text, fontSize: 13, fontWeight: '600', flex: 1 },
  exBreakRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  exBreakSets: { color: D.textMuted, fontSize: 12 },
  exBreakWeight: { color: D.primary, fontSize: 12, fontWeight: '600' },
  exBreakVol: { color: D.textMuted, fontSize: 12 },

  effortRow: { flexDirection: 'row', gap: 6 },
  effortBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: D.elevated,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: D.border,
  },
  effortStar: { fontSize: 18, marginBottom: 2 },
  effortLabel: { color: D.textMuted, fontSize: 9, fontWeight: '600', textAlign: 'center' },

  notesInput: {
    backgroundColor: D.elevated,
    borderRadius: 10,
    padding: 12,
    color: D.text,
    fontSize: 14,
    minHeight: 90,
    borderWidth: 1,
    borderColor: D.border,
  },

  actionSection: { paddingHorizontal: 16, gap: 10 },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: D.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  sendBtnText: { color: D.white, fontSize: 16, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: D.card,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: D.border,
  },
  saveBtnText: { color: D.text, fontSize: 15, fontWeight: '600' },
  discardBtn: { alignItems: 'center', paddingVertical: 12 },
  discardText: { color: D.red, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
