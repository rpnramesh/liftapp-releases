// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Membership Details Screen
// Shows full gym membership info with real-time Firestore updates
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
  if (!member) return { label: 'Unknown', color: SUB, bg: 'rgba(139,143,163,0.12)' };
  if (member.isFrozen) return { label: 'Frozen', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' };
  const days = daysLeft(member.planEndDate);
  if (days <= 0) return { label: 'Expired', color: RED, bg: 'rgba(239,68,68,0.12)' };
  if (days <= 7) return { label: 'Expiring Soon', color: AMBER, bg: 'rgba(245,158,11,0.12)' };
  return { label: 'Active', color: GREEN, bg: 'rgba(16,185,129,0.12)' };
}

function getPaymentBadge(status) {
  switch (status) {
    case 'paid': return { label: 'Paid', color: GREEN, bg: 'rgba(16,185,129,0.12)', icon: 'checkmark-circle' };
    case 'pending': return { label: 'Pending', color: AMBER, bg: 'rgba(245,158,11,0.12)', icon: 'time' };
    case 'overdue': return { label: 'Overdue', color: RED, bg: 'rgba(239,68,68,0.12)', icon: 'alert-circle' };
    default: return { label: '—', color: SUB, bg: 'rgba(139,143,163,0.12)', icon: 'help-circle' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MemberMembershipScreen({ navigation }) {
  const { memberId } = useAuth();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) return;
    const unsub = subscribeToMember(memberId, (m) => {
      setMember(m);
      setLoading(false);
    });
    return unsub;
  }, [memberId]);

  if (loading) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <View style={st.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <View style={st.center}>
          <Text style={{ fontSize: 48 }}>🏢</Text>
          <Text style={st.emptyTitle}>No Membership Found</Text>
          <Text style={st.emptySub}>Your gym has not added your membership details yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = getMembershipStatus(member);
  const days = daysLeft(member.planEndDate);
  const payBadge = getPaymentBadge(member.paymentStatus);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={() => navigation.goBack()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color={TXT} />
        </Pressable>
        <Text style={st.headerTitle}>Gym Membership</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Status Banner */}
        <View style={[st.statusBanner, { backgroundColor: status.bg }]}>
          <Ionicons
            name={status.label === 'Active' ? 'shield-checkmark' : status.label === 'Frozen' ? 'snow' : 'warning'}
            size={28}
            color={status.color}
          />
          <View style={{ flex: 1 }}>
            <Text style={[st.statusLabel, { color: status.color }]}>{status.label}</Text>
            {days > 0 && status.label !== 'Frozen' && (
              <Text style={st.statusSub}>{days} day{days !== 1 ? 's' : ''} remaining</Text>
            )}
            {status.label === 'Expired' && (
              <Text style={st.statusSub}>Please renew your membership</Text>
            )}
          </View>
        </View>

        {/* Membership Plan Card */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>Membership Plan</Text>
          <InfoRow icon="layers-outline" label="Plan" value={member.plan || '—'} />
          <InfoRow icon="calendar-outline" label="Start Date" value={fmtDate(member.planStartDate)} />
          <InfoRow icon="calendar-outline" label="Expiry Date" value={fmtDate(member.planEndDate)} />
          <InfoRow
            icon="time-outline"
            label="Duration"
            value={
              member.planStartDate && member.planEndDate
                ? `${Math.ceil((member.planEndDate - member.planStartDate) / (1000 * 60 * 60 * 24))} days`
                : '—'
            }
          />
        </View>

        {/* Joining Info */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>Joining Details</Text>
          <InfoRow icon="log-in-outline" label="Joining Date" value={fmtDate(member.joiningDate || member.createdAt)} />
          <InfoRow icon="person-outline" label="Member ID" value={member.id ? member.id.slice(0, 8).toUpperCase() : '—'} />
          {member.trainerName && (
            <InfoRow icon="fitness-outline" label="Assigned Trainer" value={member.trainerName} />
          )}
        </View>

        {/* Payment Card */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>Payment Details</Text>
          <View style={st.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={payBadge.icon} size={18} color={payBadge.color} />
              <Text style={st.infoLabel}>Payment Status</Text>
            </View>
            <View style={[st.payBadge, { backgroundColor: payBadge.bg }]}>
              <Text style={[st.payBadgeText, { color: payBadge.color }]}>{payBadge.label}</Text>
            </View>
          </View>
          <InfoRow icon="cash-outline" label="Amount Paid" value={member.amountPaid ? `₹${member.amountPaid}` : '—'} />
          <InfoRow icon="calendar-outline" label="Paid Date" value={fmtDate(member.paidDate)} />
          {member.paymentMethod && (
            <InfoRow icon="card-outline" label="Payment Method" value={member.paymentMethod.toUpperCase()} />
          )}
        </View>

        {/* Body Metrics */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>Body Metrics</Text>
          <View style={st.metricsGrid}>
            <MetricBox label="Height" value={member.height ? `${member.height} cm` : '—'} />
            <MetricBox label="Weight" value={member.weight ? `${member.weight} kg` : '—'} />
            <MetricBox label="Goal" value={member.goalWeight ? `${member.goalWeight} kg` : '—'} />
            <MetricBox
              label="BMI"
              value={
                member.height && member.weight
                  ? (member.weight / ((member.height / 100) ** 2)).toFixed(1)
                  : '—'
              }
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  return (
    <View style={st.infoRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={SUB} />
        <Text style={st.infoLabel}>{label}</Text>
      </View>
      <Text style={st.infoValue}>{value}</Text>
    </View>
  );
}

function MetricBox({ label, value }) {
  return (
    <View style={st.metricBox}>
      <Text style={st.metricLabel}>{label}</Text>
      <Text style={st.metricValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: TXT, fontSize: 20, fontWeight: '700', marginTop: 12 },
  emptySub: { color: SUB, fontSize: 14, marginTop: 6, textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: TXT, fontSize: 18, fontWeight: '700' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  statusLabel: { fontSize: 18, fontWeight: '800' },
  statusSub: { color: SUB, fontSize: 13, marginTop: 2 },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    color: TXT,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  infoLabel: { color: SUB, fontSize: 13, fontWeight: '500' },
  infoValue: { color: TXT, fontSize: 14, fontWeight: '600' },

  payBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  payBadgeText: { fontSize: 12, fontWeight: '700' },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1E2030',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  metricLabel: { color: SUB, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  metricValue: { color: TXT, fontSize: 18, fontWeight: '800' },
});
