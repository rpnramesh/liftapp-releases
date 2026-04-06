// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Home Screen (Dashboard)
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { subscribeToMember } from '../../services/member.service';
import { subscribeToWeightLog } from '../../services/progress.service';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT = '#4F8EF7';
const GREEN = '#10B981';
const RED = '#EF4444';
const AMBER = '#F59E0B';
const BG = '#0A0B0F';
const CARD = '#13151C';
const BORDER = '#2A2D38';
const TXT = '#F1F3F9';
const SUB = '#8B8FA3';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function daysLeft(endTs) {
  if (!endTs) return 0;
  const diff = endTs - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getMembershipStatus(member) {
  if (!member) return { label: 'Unknown', color: SUB };
  if (member.isFrozen) return { label: 'Frozen', color: '#8B5CF6' };
  const days = daysLeft(member.planEndDate);
  if (days <= 0) return { label: 'Expired', color: RED };
  if (days <= 7) return { label: 'Expiring Soon', color: AMBER };
  return { label: 'Active', color: GREEN };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MemberHomeScreen({ navigation }) {
  const { memberId, gymId } = useAuth();
  const [member, setMember] = useState(null);
  const [latestWeight, setLatestWeight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) return;
    const unsub = subscribeToMember(memberId, (m) => {
      setMember(m);
      setLoading(false);
    });
    return unsub;
  }, [memberId]);

  useEffect(() => {
    if (!gymId || !memberId) return;
    const unsub = subscribeToWeightLog(gymId, memberId, (entries) => {
      if (entries.length > 0) {
        setLatestWeight(entries[entries.length - 1]);
      }
    }, 1);
    return unsub;
  }, [gymId, memberId]);

  if (loading) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <View style={st.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  const status = member ? getMembershipStatus(member) : null;
  const days = member ? daysLeft(member.planEndDate) : 0;
  const bmi = member && member.height && member.weight
    ? (member.weight / ((member.height / 100) ** 2)).toFixed(1)
    : null;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        {/* Greeting */}
        <Text style={st.greeting}>{greetingText()},</Text>
        <Text style={st.name}>{member?.name || 'Member'}</Text>

        {/* ── Gym Membership Tile ── */}
        <Pressable
          style={st.membershipTile}
          onPress={() => navigation.navigate('Membership')}
        >
          <View style={st.membershipHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[st.membershipIcon, { backgroundColor: status ? `${status.color}20` : '#1E2030' }]}>
                <Ionicons name="card-outline" size={22} color={status?.color || ACCENT} />
              </View>
              <View>
                <Text style={st.membershipLabel}>Gym Membership</Text>
                {status && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <View style={[st.statusDot, { backgroundColor: status.color }]} />
                    <Text style={[st.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SUB} />
          </View>

          {member && (
            <View style={st.membershipBody}>
              <View style={st.membershipRow}>
                <Text style={st.membershipKey}>Plan</Text>
                <Text style={st.membershipVal}>{member.plan || '—'}</Text>
              </View>
              <View style={st.membershipRow}>
                <Text style={st.membershipKey}>Expires</Text>
                <Text style={st.membershipVal}>{fmtDate(member.planEndDate)}</Text>
              </View>
              {days > 0 && status?.label !== 'Frozen' && (
                <View style={st.membershipRow}>
                  <Text style={st.membershipKey}>Days Left</Text>
                  <Text style={[st.membershipVal, { color: days <= 7 ? AMBER : GREEN, fontWeight: '700' }]}>
                    {days}
                  </Text>
                </View>
              )}
              {member.paymentStatus && (
                <View style={st.membershipRow}>
                  <Text style={st.membershipKey}>Payment</Text>
                  <Text style={[
                    st.membershipVal,
                    {
                      color: member.paymentStatus === 'paid' ? GREEN
                        : member.paymentStatus === 'overdue' ? RED : AMBER,
                      fontWeight: '700',
                    },
                  ]}>
                    {member.paymentStatus.charAt(0).toUpperCase() + member.paymentStatus.slice(1)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Pressable>

        {/* ── Quick Stats ── */}
        <View style={st.statsRow}>
          <View style={st.statCard}>
            <Text style={st.statIcon}>⚖️</Text>
            <Text style={st.statValue}>
              {latestWeight ? `${latestWeight.weight} kg` : member?.weight ? `${member.weight} kg` : '—'}
            </Text>
            <Text style={st.statLabel}>Weight</Text>
          </View>
          <View style={st.statCard}>
            <Text style={st.statIcon}>📊</Text>
            <Text style={st.statValue}>{bmi || '—'}</Text>
            <Text style={st.statLabel}>BMI</Text>
          </View>
          <View style={st.statCard}>
            <Text style={st.statIcon}>🎯</Text>
            <Text style={st.statValue}>{member?.goalWeight ? `${member.goalWeight} kg` : '—'}</Text>
            <Text style={st.statLabel}>Goal</Text>
          </View>
        </View>

        {/* ── Trainer Card ── */}
        {member?.trainerName && (
          <View style={st.trainerCard}>
            <View style={st.trainerAvatar}>
              <Ionicons name="person" size={20} color={ACCENT} />
            </View>
            <View>
              <Text style={st.trainerName}>{member.trainerName}</Text>
              <Text style={st.trainerRole}>Your Trainer</Text>
            </View>
          </View>
        )}

        {/* ── Current Plan ── */}
        {member?.currentPlanName && (
          <View style={st.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="barbell-outline" size={18} color={ACCENT} />
              <Text style={st.cardTitle}>Current Workout Plan</Text>
            </View>
            <Text style={st.planName}>{member.currentPlanName}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  greeting: { color: SUB, fontSize: 15, fontWeight: '500' },
  name: { color: TXT, fontSize: 24, fontWeight: '800', marginBottom: 20 },

  // ── Membership Tile ──
  membershipTile: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    overflow: 'hidden',
  },
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  membershipIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipLabel: { color: TXT, fontSize: 16, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  membershipBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
  },
  membershipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  membershipKey: { color: SUB, fontSize: 13 },
  membershipVal: { color: TXT, fontSize: 13, fontWeight: '600' },

  // ── Quick Stats ──
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statValue: { color: TXT, fontSize: 16, fontWeight: '800' },
  statLabel: { color: SUB, fontSize: 11, fontWeight: '600', marginTop: 2 },

  // ── Trainer Card ──
  trainerCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  trainerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(79,142,247,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerName: { color: TXT, fontSize: 15, fontWeight: '700' },
  trainerRole: { color: SUB, fontSize: 12, marginTop: 2 },

  // ── Generic Card ──
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  cardTitle: { color: TXT, fontSize: 14, fontWeight: '700' },
  planName: { color: ACCENT, fontSize: 16, fontWeight: '700' },
});
