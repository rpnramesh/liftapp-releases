// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — TS-006 Trainer Home Dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DashboardAPI } from '../../services/trainer.api';

import {
  Avatar,
  EmptyState,
  OfflineBanner,
  SkeletonCard,
  SkeletonLoader,
  StatusBadge,
} from '../../components/common';
import {
  ActivityFeedItem,
  EarningsStrip,
  PendingActionChip,
} from '../../components/trainer';
import { C } from '../../constants/theme';
import { useAppForeground, useAsync, useGreeting, useNetworkStatus } from '../../hooks/useTrainer';
import { ScheduledSession, TrainerDashboard } from '../../types/trainer.types';

import { useAuth } from '../../context/AuthContext';
import { getTrainerId } from '../../services/session';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();
const greeting = useGreeting(profile?.fullName ?? profile?.name ?? '');
  const { isOnline } = useNetworkStatus();

  const fetchDashboard = useCallback(
    () => DashboardAPI.getDashboard(getTrainerId()),
    [],
  );

  const { data, loading, error, refresh } = useAsync<TrainerDashboard>(fetchDashboard);

  // Re-fetch on foreground (AC2)
  useAppForeground(refresh);

  const navigateToFilteredClients = (filter: string) => {
    navigation.navigate('Clients', { screen: 'ClientList', params: { filter } });
  };

  if (loading && !data) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <SkeletonLoader height={28} width="50%" />
        <SkeletonLoader height={14} width="30%" />
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </ScrollView>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        emoji="⚠️"
        title="Failed to load dashboard"
        subtitle={error}
        ctaLabel="Retry"
        onCTA={refresh}
      />
    );
  }

  if (!data) return null;

  const { todaySchedule, recentActivity, pendingActions, quickStats, earningsSummary } = data;

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner visible={!isOnline} />
      {error && data && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleBannerText}>Data may be outdated. Pull to refresh.</Text>
        </View>
      )}
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.primary} />}
      >
        {/* Greeting (AC1.1) */}
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>

        {/* Quick Stats (AC1.5) */}
        <View style={styles.statsRow}>
          <StatTile label="Active Clients" value={quickStats.totalActiveClients} />
          <StatTile label="Sessions This Week" value={quickStats.sessionsThisWeek} />
          <StatTile label="Unread Logs" value={quickStats.unreadLogs} color={quickStats.unreadLogs > 0 ? C.amber : undefined} />
        </View>

        {/* Pending Actions (AC1.4) */}
        {(pendingActions.clientsWithoutPlan > 0 || pendingActions.missedWorkouts > 0 || pendingActions.feeDue > 0) && (
          <View>
            <Text style={styles.sectionTitle}>Pending Actions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              <PendingActionChip type="feeDue" count={pendingActions.feeDue} onPress={() => navigateToFilteredClients('fee_due')} />
              <PendingActionChip type="missedWorkouts" count={pendingActions.missedWorkouts} onPress={() => navigateToFilteredClients('missed')} />
              <PendingActionChip type="clientsWithoutPlan" count={pendingActions.clientsWithoutPlan} onPress={() => navigateToFilteredClients('no_plan')} />
            </ScrollView>
          </View>
        )}

        {/* Today's Schedule (AC1.2) */}
        <View>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          {todaySchedule.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No sessions scheduled for today</Text>
            </View>
          ) : (
            todaySchedule.map(session => (
              <SessionRow
                key={session.clientId}
                session={session}
                onPress={() => navigation.navigate('Clients', {
                  screen: 'ClientProfile',
                  params: { clientId: session.clientId, clientName: session.clientName },
                })}
              />
            ))
          )}
        </View>

        {/* Recent Activity Feed (AC1.3, AC5) */}
        <View>
          <Text style={styles.sectionTitle}>Recent Client Activity</Text>
          {recentActivity.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No recent activity from clients</Text>
            </View>
          ) : (
            recentActivity.slice(0, 5).map(item => (
              <ActivityFeedItem
                key={item.logId}
                item={item}
                onPress={() => navigation.navigate('Clients', {
                  screen: 'WorkoutLogs',
                  params: { clientId: item.clientId, clientName: item.clientName },
                })}
              />
            ))
          )}
        </View>

        {/* Earnings Strip (AC1.6) */}
        <EarningsStrip
          summary={earningsSummary}
          onViewDetails={() => navigation.navigate('Profile', { screen: 'Earnings' })}
        />
      </ScrollView>
    </View>
  );
}

// ─── SessionRow ───────────────────────────────────────────────────────────────

function SessionRow({ session, onPress }: { session: ScheduledSession; onPress: () => void }) {
  const statusColor =
    session.lastWorkoutStatus === 'completed'
      ? C.green
      : session.lastWorkoutStatus === 'incomplete'
      ? C.amber
      : C.mid;

  const statusLabel =
    session.lastWorkoutStatus === 'completed'
      ? 'Done'
      : session.lastWorkoutStatus === 'incomplete'
      ? 'Incomplete'
      : 'Not started';

  return (
    <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.85}>
      <Avatar uri={null} name={session.clientName} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sessionName}>{session.clientName}</Text>
        <Text style={styles.sessionPlan}>{session.planName}</Text>
      </View>
      <StatusBadge label={statusLabel} color={statusColor} />
    </TouchableOpacity>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  greeting: { fontSize: 24, fontWeight: '700', color: C.dark },
  date: { fontSize: 13, color: C.mid, marginTop: 2 },
  staleBanner: {
    backgroundColor: '#FEF3C7',
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  staleBannerText: { color: '#92400E', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.dark, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statTile: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: C.dark },
  statLabel: { fontSize: 11, color: C.mid, textAlign: 'center', marginTop: 2 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sessionName: { fontSize: 14, fontWeight: '600', color: C.dark },
  sessionPlan: { fontSize: 12, color: C.mid },
  emptySection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  emptySectionText: { color: C.light, fontSize: 13 },
});
