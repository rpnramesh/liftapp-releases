// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Profile Screen
// Shows profile info + membership section + sign-out
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

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function daysLeft(endTs) {
  if (!endTs) return 0;
  return Math.max(0, Math.ceil((endTs - Date.now()) / (1000 * 60 * 60 * 24)));
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
export default function MemberProfileScreen({ navigation }) {
  const { memberId, logout } = useAuth();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
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

  const status = member ? getMembershipStatus(member) : null;
  const days = member ? daysLeft(member.planEndDate) : 0;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header */}
        <Text style={st.headerTitle}>Profile</Text>

        {/* Avatar + Name */}
        <View style={st.avatarSection}>
          <View style={st.avatar}>
            <Ionicons name="person" size={36} color={ACCENT} />
          </View>
          <Text style={st.name}>{member?.name || 'Member'}</Text>
          {member?.phone && <Text style={st.phone}>{member.phone}</Text>}
          {member?.email && <Text style={st.phone}>{member.email}</Text>}
        </View>

        {/* ── Gym Membership Section ── */}
        <Pressable
          style={st.membershipTile}
          onPress={() => navigation.navigate('Membership')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[st.tileIcon, { backgroundColor: status ? `${status.color}20` : '#1E2030' }]}>
              <Ionicons name="card-outline" size={20} color={status?.color || ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.tileLabel}>Gym Membership</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {status && (
                  <>
                    <View style={[st.dot, { backgroundColor: status.color }]} />
                    <Text style={[st.tileStatus, { color: status.color }]}>{status.label}</Text>
                  </>
                )}
                {member?.plan && (
                  <Text style={st.tilePlan}> · {member.plan}</Text>
                )}
              </View>
              {days > 0 && status?.label !== 'Frozen' && (
                <Text style={st.tileDays}>{days} day{days !== 1 ? 's' : ''} remaining</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={SUB} />
          </View>
        </Pressable>

        {/* ── Personal Info Card ── */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>Personal Information</Text>
          <InfoRow label="Height" value={member?.height ? `${member.height} cm` : '—'} />
          <InfoRow label="Weight" value={member?.weight ? `${member.weight} kg` : '—'} />
          <InfoRow label="Goal Weight" value={member?.goalWeight ? `${member.goalWeight} kg` : '—'} />
          {member?.age && <InfoRow label="Age" value={`${member.age}`} />}
          {member?.gender && <InfoRow label="Gender" value={member.gender} />}
        </View>

        {/* ── Trainer Card ── */}
        {member?.trainerName && (
          <View style={st.card}>
            <Text style={st.sectionTitle}>Your Trainer</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <View style={st.trainerAvatar}>
                <Ionicons name="person" size={18} color={ACCENT} />
              </View>
              <Text style={st.trainerName}>{member.trainerName}</Text>
            </View>
          </View>
        )}

        {/* ── Sign Out ── */}
        <Pressable style={st.signOutBtn} onPress={() => logout()}>
          <Ionicons name="log-out-outline" size={18} color={RED} />
          <Text style={st.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <View style={st.infoRow}>
      <Text style={st.infoLabel}>{label}</Text>
      <Text style={st.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerTitle: { color: TXT, fontSize: 22, fontWeight: '800', marginBottom: 20 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(79,142,247,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  name: { color: TXT, fontSize: 20, fontWeight: '800' },
  phone: { color: SUB, fontSize: 13, marginTop: 2 },

  // ── Membership Tile ──
  membershipTile: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { color: TXT, fontSize: 15, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tileStatus: { fontSize: 12, fontWeight: '600' },
  tilePlan: { color: SUB, fontSize: 12 },
  tileDays: { color: SUB, fontSize: 11, marginTop: 2 },

  // ── Cards ──
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  sectionTitle: { color: TXT, fontSize: 15, fontWeight: '700', marginBottom: 8 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  infoLabel: { color: SUB, fontSize: 13 },
  infoValue: { color: TXT, fontSize: 14, fontWeight: '600' },

  trainerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79,142,247,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerName: { color: TXT, fontSize: 15, fontWeight: '600' },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 15,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    marginTop: 8,
  },
  signOutText: { color: RED, fontSize: 15, fontWeight: '700' },
});
