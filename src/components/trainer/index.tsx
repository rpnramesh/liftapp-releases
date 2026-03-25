// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Trainer Components (Member App Style)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '../../../components/ui/icon-symbol';
import { C, R, S, T } from '../../constants/theme';
import {
    ActivityFeedItem as ActivityFeedItemType,
    ClientCard as ClientCardType,
    EarningsSummary,
    LiveClass,
    PendingActions,
} from '../../types/trainer.types';
import { formatDateTime, formatINR, membershipStatusColor, timeAgo } from '../../utils/trainer.utils';
import { Avatar, Card, LiveBadge, RiskFlagBadge, StatusBadge } from '../common';

// ─── ClientCard ───────────────────────────────────────────────────────────────

export const ClientCard: React.FC<{
  client: ClientCardType;
  onPress: () => void;
  onAssignPlan?: () => void;
  onWhatsApp?: () => void;
}> = ({ client, onPress, onAssignPlan, onWhatsApp }) => (
  <Card onPress={onPress} style={{ flexDirection: 'row', gap: S.md, marginBottom: S.sm, alignItems: 'flex-start' }}>
    <Avatar uri={client.profilePhotoUrl} name={client.fullName} size={48} />
    <View style={{ flex: 1, gap: 5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
        <Text style={T.h4}>{client.fullName}</Text>
        {client.hasRiskFlag && <RiskFlagBadge />}
      </View>
      <StatusBadge label={client.membershipStatus} color={membershipStatusColor(client.membershipStatus)} />
      <Text style={T.small}>
        {client.lastWorkoutDate ? `Last workout: ${timeAgo(client.lastWorkoutDate)}` : 'No workouts logged yet'}
      </Text>
      {client.assignedPlanName
        ? <Text style={[T.small, { color: C.dark }]}><IconSymbol name="clipboard" size={12} color="#374151" /> {client.assignedPlanName}</Text>
        : <Text style={[T.small, { color: C.red, fontWeight: '500' }]}>⚠ No plan assigned</Text>
      }
      <Text style={T.small}><IconSymbol name="flame.fill" size={12} color={C.amber} /> {client.streak} day streak</Text>

      {/* Quick action row */}
      <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xs }}>
        {onAssignPlan && (
          <TouchableOpacity
            style={{ paddingHorizontal: S.md, paddingVertical: 5, borderRadius: R.full, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryMid }}
            onPress={onAssignPlan}
          >
            <Text style={{ fontSize: 11, color: C.primary, fontWeight: '600' }}>Assign Plan</Text>
          </TouchableOpacity>
        )}
        {onWhatsApp && (
          <TouchableOpacity
            style={{ paddingHorizontal: S.md, paddingVertical: 5, borderRadius: R.full, backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.green + '40' }}
            onPress={onWhatsApp}
          >
            <Text style={{ fontSize: 11, color: C.green, fontWeight: '600' }}>WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </Card>
);

// ─── ActivityFeedItem ─────────────────────────────────────────────────────────

export const ActivityFeedItem: React.FC<{
  item: ActivityFeedItemType;
  onPress: () => void;
}> = ({ item, onPress }) => (
  <TouchableOpacity
    style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, borderBottomWidth: 1, borderBottomColor: C.border }}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={{ position: 'relative' }}>
      <Avatar uri={item.clientPhotoUrl} name={item.clientName} size={40} />
      <View style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 11, height: 11, borderRadius: 6,
        backgroundColor: item.status === 'completed' ? C.green : C.mid,
        borderWidth: 1.5, borderColor: C.white,
      }} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={T.h4}>{item.clientName}</Text>
      <Text style={T.small}>{item.workoutName}</Text>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 4 }}>
      <StatusBadge
        label={item.status === 'completed' ? 'Done' : 'Incomplete'}
        color={item.status === 'completed' ? C.green : C.mid}
      />
      <Text style={T.tiny}>{item.timeAgo}</Text>
    </View>
  </TouchableOpacity>
);

// ─── PendingActionChip ────────────────────────────────────────────────────────

type PendingActionKey = keyof PendingActions;

const CHIP_CONFIG: Record<PendingActionKey, { label: (n: number) => string; color: string }> = {
  clientsWithoutPlan: { label: n => `${n} without plan`, color: '#3B82F6' },
  missedWorkouts:     { label: n => `${n} missed 3+ days`, color: C.amber },
  feeDue:             { label: n => `${n} fee${n > 1 ? 's' : ''} due`, color: C.red },
};

export const PendingActionChip: React.FC<{
  type: PendingActionKey; count: number; onPress: () => void;
}> = ({ type, count, onPress }) => {
  if (count === 0) return null;
  const config = CHIP_CONFIG[type];
  return (
    <Pressable
      style={{ paddingHorizontal: S.md, paddingVertical: 6, borderRadius: R.full, backgroundColor: config.color + '18', borderWidth: 1, borderColor: config.color + '40', marginRight: S.sm }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: config.color }}>{config.label(count)}</Text>
    </Pressable>
  );
};

// ─── EarningsStrip ────────────────────────────────────────────────────────────

export const EarningsStrip: React.FC<{
  summary: EarningsSummary; onViewDetails: () => void;
}> = ({ summary, onViewDetails }) => (
  <View style={{ backgroundColor: C.primary, borderRadius: R.lg, padding: S.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    <View>
      <Text style={{ fontSize: 12, color: C.primaryMid }}>This Month</Text>
      <Text style={{ fontSize: 24, fontWeight: '700', color: C.white, marginVertical: 3 }}>
        {formatINR(summary.thisMonthTotal)}
      </Text>
      <Text style={{ fontSize: 11, color: C.primaryMid }}>
        Gym {formatINR(summary.gymSalary)} + Freelance {formatINR(summary.freelanceFees)}
      </Text>
    </View>
    <TouchableOpacity
      onPress={onViewDetails}
      style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: C.white, fontSize: 13, fontWeight: '600' }}>Details</Text>
        <IconSymbol name="chevron.right" size={16} color={C.white} />
      </View>
    </TouchableOpacity>
  </View>
);

// ─── ClassCard ────────────────────────────────────────────────────────────────

export const ClassCard: React.FC<{
  cls: LiveClass; onPress: () => void; isUpcoming?: boolean;
}> = ({ cls, onPress, isUpcoming = false }) => {
  const isLive = cls.status === 'Live';
  const rsvpPercent = Math.min((cls.rsvpCount / cls.maxParticipants) * 100, 100);

  return (
    <Card onPress={onPress} style={{ marginBottom: S.sm, gap: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={T.h4}>{cls.name}</Text>
          <Text style={[T.small, { marginTop: 2 }]}>{cls.category} · {cls.durationMinutes} min</Text>
        </View>
        {isLive && <LiveBadge />}
      </View>

      <Text style={T.small}>{formatDateTime(cls.scheduledAt)}</Text>

      {isUpcoming && (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={T.tiny}>{cls.rsvpCount}/{cls.maxParticipants} spots taken</Text>
            <Text style={T.tiny}>{Math.round(rsvpPercent)}% full</Text>
          </View>
          <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: 5, width: `${rsvpPercent}%` as any, backgroundColor: rsvpPercent > 80 ? C.amber : C.primary, borderRadius: 3 }} />
          </View>
        </View>
      )}

      {cls.status === 'Completed' && cls.averageRating != null && (
          <Text style={[T.small, { color: C.amber }]}><IconSymbol name="star.fill" size={12} color={C.amber} /> {cls.averageRating.toFixed(1)} avg rating · {cls.rsvpCount} attended</Text>
        )}
    </Card>
  );
};
