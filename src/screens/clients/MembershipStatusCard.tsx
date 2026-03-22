// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Client Membership Status Card
// File: src/screens/clients/MembershipStatusCard.tsx
//
// USAGE: Add this component inside ClientProfileScreen (ClientListScreen.tsx)
// right after the statsRow section, replacing the old planCard or adding new.
//
// PASTE the component below into the file, then use it in ClientProfileScreen:
//   <MembershipStatusCard memberId={clientId} />
// ─────────────────────────────────────────────────────────────────────────────

// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../../firebase/config';
import { C } from '../../constants/theme';

type MembershipInfo = {
  name: string;
  plan: string;
  planEndDate: number;
  planStartDate: number;
  trainerId: string | null;
  trainerName: string | null;
  gymId: string | null;
  height: number;
  weight: number;
  goalWeight: number;
  age: number;
  gender: string;
  isFrozen: boolean;
  phone: string;
};

function daysLeft(endDate: number): number {
  return Math.floor((endDate - Date.now()) / 86400000);
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MembershipStatusCard({ memberId }: { memberId: string }) {
  const [info, setInfo] = useState<MembershipInfo | null>(null);

  const load = useCallback(async () => {
    if (!memberId) return;
    try {
      const snap = await getDoc(doc(db, 'members', memberId));
      if (snap.exists()) setInfo(snap.data() as MembershipInfo);
    } catch (e) {
      console.log('[MembershipCard] error:', e);
    }
  }, [memberId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!info) return null;

  const days = daysLeft(info.planEndDate ?? 0);
  const isExpired = days < 0;
  const isExpiring = days >= 0 && days <= 7;
  const statusColor = isExpired ? C.red : isExpiring ? C.amber : C.green;
  const statusLabel = isExpired ? 'Expired' : isExpiring ? 'Expiring Soon' : 'Active';
  const bmi = info.height > 0
    ? (info.weight / ((info.height / 100) ** 2)).toFixed(1)
    : null;

  return (
    <View style={ms.container}>

      {/* Membership header */}
      <View style={ms.sectionHeader}>
        <Text style={ms.sectionTitle}>MEMBERSHIP</Text>
        <View style={[ms.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
          <Text style={[ms.statusText, { color: statusColor }]}>● {statusLabel}</Text>
        </View>
      </View>

      {/* Plan + dates */}
      <View style={ms.card}>
        <View style={ms.row}>
          <Text style={ms.label}>Plan</Text>
          <Text style={ms.value}>{info.plan || info.currentPlanName || '—'}</Text>
        </View>
        <View style={ms.divider} />
        <View style={ms.row}>
          <Text style={ms.label}>Started</Text>
          <Text style={ms.value}>{formatDate(info.planStartDate)}</Text>
        </View>
        <View style={ms.divider} />
        <View style={ms.row}>
          <Text style={ms.label}>Expires</Text>
          <Text style={[ms.value, { color: statusColor, fontWeight: '700' }]}>
            {formatDate(info.planEndDate)}
          </Text>
        </View>
        <View style={ms.divider} />
        <View style={ms.row}>
          <Text style={ms.label}>Days Left</Text>
          <Text style={[ms.value, { color: statusColor, fontWeight: '700' }]}>
            {isExpired ? `${Math.abs(days)} days overdue` : `${days} days`}
          </Text>
        </View>
        {info.isFrozen && (
          <>
            <View style={ms.divider} />
            <View style={[ms.row, { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8 }]}>
              <Text style={[ms.label, { color: '#3B82F6' }]}>❄ Status</Text>
              <Text style={[ms.value, { color: '#3B82F6', fontWeight: '700' }]}>Account Frozen</Text>
            </View>
          </>
        )}
      </View>

      {/* Body metrics */}
      <Text style={[ms.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>BODY METRICS</Text>
      <View style={ms.metricsRow}>
        {[
          ['Height', info.height ? `${info.height} cm` : '—'],
          ['Weight', info.weight ? `${info.weight} kg` : '—'],
          ['Goal', info.goalWeight ? `${info.goalWeight} kg` : '—'],
          ['BMI', bmi ? bmi : '—'],
        ].map(([label, val]) => (
          <View key={label} style={ms.metricChip}>
            <Text style={ms.metricVal}>{val}</Text>
            <Text style={ms.metricLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Personal info */}
      <Text style={[ms.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>PERSONAL INFO</Text>
      <View style={ms.card}>
        <View style={ms.row}>
          <Text style={ms.label}>📞 Phone</Text>
          <Text style={ms.value}>{info.phone || '—'}</Text>
        </View>
        {info.age > 0 && (
          <>
            <View style={ms.divider} />
            <View style={ms.row}>
              <Text style={ms.label}>🎂 Age</Text>
              <Text style={ms.value}>{info.age} years</Text>
            </View>
          </>
        )}
        {info.gender ? (
          <>
            <View style={ms.divider} />
            <View style={ms.row}>
              <Text style={ms.label}>Gender</Text>
              <Text style={ms.value}>{info.gender}</Text>
            </View>
          </>
        ) : null}
        <View style={ms.divider} />
        <View style={ms.row}>
          <Text style={ms.label}>Trainer</Text>
          <Text style={ms.value}>{info.trainerName || '—'}</Text>
        </View>
        <View style={ms.divider} />
        <View style={ms.row}>
          <Text style={ms.label}>Type</Text>
          <Text style={ms.value}>{info.gymId ? '🏢 Gym Member' : '🏃 Freelance'}</Text>
        </View>
      </View>

    </View>
  );
}

const ms = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.mid, letterSpacing: 0.8, textTransform: 'uppercase' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#F3F4F6',
    paddingHorizontal: 16, paddingVertical: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  label: { fontSize: 13, color: '#6B7280' },
  value: { fontSize: 14, color: '#111827', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricChip: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  metricVal: { fontSize: 17, fontWeight: '800', color: '#111827' },
  metricLabel: { fontSize: 11, color: '#6B7280', marginTop: 3 },
});
