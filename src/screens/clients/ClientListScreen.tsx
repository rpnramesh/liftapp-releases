// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-007 Client List & Client Profile
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { ClientsAPI } from '../../services/mockApi';
import { PAGE_SIZE } from '../../constants/trainer.constants';
import { SkeletonCard, EmptyState, Avatar, StatusBadge, PrimaryButton } from '../../components/common';
import { RiskFlagBadge } from '../../components/common';
import { useAsync, useDebounce } from '../../hooks/useTrainer';
import { ClientCard as ClientCardType, ClientProfile } from '../../types/trainer.types';
import { membershipStatusColor, timeAgo, whatsappURL } from '../../utils/trainer.utils';

const TRAINER_ID = 'trainer-001';
const TOKEN = '';

type SortKey = 'last_activity' | 'name_az' | 'streak' | 'expiry';
type TabKey = 'all' | 'gym' | 'freelance';

// ─── Client List ─────────────────────────────────────────────────────────────

type ListProps = NativeStackScreenProps<ClientsStackParamList, 'ClientList'>;

export default function ClientListScreen({ navigation, route }: ListProps) {
  const filter = (route.params as any)?.filter;
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('last_activity');
  const [allClients, setAllClients] = useState<ClientCardType[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const fetchClients = useCallback(async () => {
    const type = tab === 'all' ? 'all' : tab;
    const res = await ClientsAPI.getClients(TRAINER_ID, type, 1, TOKEN);
    setAllClients(res.clients);
    setPage(1);
    setHasMore(res.clients.length === PAGE_SIZE);
    return res;
  }, [tab]);

  const { loading, refresh } = useAsync(fetchClients);

  const loadMore = async () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    const type = tab === 'all' ? 'all' : tab;
    const res = await ClientsAPI.getClients(TRAINER_ID, type, next, TOKEN);
    setAllClients(prev => [...prev, ...res.clients]);
    setPage(next);
    setHasMore(res.clients.length === PAGE_SIZE);
  };

  const filtered = allClients
    .filter(c => {
      if (debouncedSearch) return c.fullName.toLowerCase().includes(debouncedSearch.toLowerCase());
      if (filter === 'fee_due') return c.membershipStatus === 'Expired' || c.membershipStatus === 'Expiring';
      if (filter === 'no_plan') return !c.assignedPlanName;
      if (filter === 'missed') return c.hasRiskFlag;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'name_az') return a.fullName.localeCompare(b.fullName);
      if (sort === 'streak') return b.streak - a.streak;
      if (a.hasRiskFlag && !b.hasRiskFlag) return -1;
      if (!a.hasRiskFlag && b.hasRiskFlag) return 1;
      return 0;
    });

  const renderItem = ({ item }: { item: ClientCardType }) => (
    <TouchableOpacity
      style={styles.clientCard}
      onPress={() => navigation.navigate('ClientProfile', { clientId: item.id, clientName: item.fullName })}
      activeOpacity={0.85}
    >
      <Avatar uri={item.profilePhotoUrl} name={item.fullName} size={48} />
      <View style={styles.clientInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.clientName}>{item.fullName}</Text>
          {item.hasRiskFlag && <RiskFlagBadge />}
          {item.clientType === 'freelance' && (
            <View style={styles.freelanceBadge}>
              <Text style={styles.freelanceBadgeText}>Freelance</Text>
            </View>
          )}
        </View>
        <StatusBadge label={item.membershipStatus} color={membershipStatusColor(item.membershipStatus)} />
        <Text style={styles.clientMeta}>
          {item.lastWorkoutDate ? `Last workout: ${timeAgo(item.lastWorkoutDate)}` : 'No workouts yet'}
        </Text>
        {item.assignedPlanName
          ? <Text style={styles.planName}>📋 {item.assignedPlanName}</Text>
          : <Text style={styles.noPlan}>⚠ No plan assigned</Text>}
        <Text style={styles.streak}>🔥 {item.streak}-day streak</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone…"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View style={styles.tabRow}>
        {(['all', 'gym', 'freelance'] as TabKey[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => { setTab(t); refresh(); }}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'all' ? 'All Clients' : t === 'gym' ? 'Gym' : 'Freelance'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {([['last_activity', 'Last Active'], ['name_az', 'A–Z'], ['streak', 'Streak'], ['expiry', 'Expiry']] as [SortKey, string][]).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.sortChip, sort === key && styles.sortChipActive]} onPress={() => setSort(key)}>
            <Text style={[styles.sortChipText, sort === key && { color: C.primary, fontWeight: '600' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading && allClients.length === 0 ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            tab === 'freelance'
              ? <EmptyState emoji="🌟" title="No freelance clients yet" subtitle="Share your invite link to start onboarding clients." ctaLabel="Invite a Client" onCTA={() => navigation.navigate('FreelanceOnboarding')} />
              : <EmptyState emoji="👥" title="No clients found" subtitle="Your gym admin will assign members to you." />
          }
        />
      )}
    </View>
  );
}

// ─── Client Profile ───────────────────────────────────────────────────────────

type ProfileProps = NativeStackScreenProps<ClientsStackParamList, 'ClientProfile'>;

export function ClientProfileScreen({ navigation, route }: ProfileProps) {
  const { clientId, clientName } = route.params;
  const fetchProfile = useCallback(() => ClientsAPI.getClientProfile(TRAINER_ID, clientId, TOKEN), [clientId]);
  const { data: profile, loading, error, refresh } = useAsync<ClientProfile>(fetchProfile);

  const handleWhatsApp = () => {
    if (!profile) return;
    Linking.openURL(whatsappURL(profile.phone, `Hi ${profile.fullName.split(' ')[0]}, checking in on your training!`));
  };

  if (loading) return <View style={styles.container}><SkeletonCard /></View>;
  if (error || !profile) return <EmptyState emoji="⚠️" title="Failed to load profile" subtitle={error ?? ''} ctaLabel="Retry" onCTA={refresh} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={pStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 10 }}>
          <Text style={{ color: C.primary, fontWeight: '500' }}>← Back</Text>
        </TouchableOpacity>
        <View style={pStyles.headerRow}>
          <Avatar uri={profile.profilePhotoUrl} name={profile.fullName} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={pStyles.name}>{profile.fullName}</Text>
            <Text style={pStyles.meta}>{profile.age} yrs · {profile.gender}</Text>
            <StatusBadge label={profile.membershipStatus} color={membershipStatusColor(profile.membershipStatus)} />
          </View>
        </View>
      </View>
      <View style={pStyles.statsRow}>
        {[
          ['Workouts', profile.totalWorkoutsLogged],
          ['Streak', `🔥 ${profile.currentStreak}d`],
          ['Attendance', `${profile.attendanceThisMonth}/mo`],
        ].map(([label, value]) => (
          <View key={label as string} style={pStyles.stat}>
            <Text style={pStyles.statValue}>{value}</Text>
            <Text style={pStyles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {profile.healthGoals.length > 0 && (
        <View style={pStyles.goalsSection}>
          <Text style={pStyles.sectionTitle}>Health Goals</Text>
          <View style={pStyles.goalsRow}>
            {profile.healthGoals.map(g => (
              <View key={g} style={pStyles.goalChip}><Text style={pStyles.goalText}>{g}</Text></View>
            ))}
          </View>
        </View>
      )}
      <View style={pStyles.actions}>
        <PrimaryButton label="Create / Edit Plan" onPress={() => navigation.navigate('CreatePlan', { clientId: profile.id, clientName: profile.fullName })} />
        <TouchableOpacity style={pStyles.secondBtn} onPress={() => navigation.navigate('WorkoutLogs', { clientId: profile.id, clientName: profile.fullName })}>
          <Text style={pStyles.secondBtnText}>📊 View Workout Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pStyles.secondBtn} onPress={() => navigation.navigate('WeightBMI', { clientId: profile.id, clientName: profile.fullName })}>
          <Text style={pStyles.secondBtnText}>📈 View Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pStyles.secondBtn} onPress={() => navigation.navigate('ProgressPhotos', { clientId: profile.id, clientName: profile.fullName })}>
          <Text style={pStyles.secondBtnText}>📷 Progress Photos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[pStyles.secondBtn, { backgroundColor: '#DCFCE7' }]} onPress={handleWhatsApp}>
          <Text style={[pStyles.secondBtnText, { color: C.green }]}>💬 Message on WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  searchRow: { padding: 16, paddingBottom: 8 },
  searchInput: { backgroundColor: C.white, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: C.border },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: C.mid },
  tabTextActive: { color: C.white },
  sortRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, alignItems: 'center', marginBottom: 4 },
  sortLabel: { fontSize: 12, color: C.light },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F3F4F6' },
  sortChipActive: { backgroundColor: C.primary + '18' },
  sortChipText: { fontSize: 12, color: C.mid },
  clientCard: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: C.white, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  clientInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  clientName: { fontSize: 15, fontWeight: '600', color: C.dark },
  freelanceBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  freelanceBadgeText: { fontSize: 10, color: '#7C3AED', fontWeight: '600' },
  clientMeta: { fontSize: 12, color: C.mid },
  planName: { fontSize: 12, color: '#374151' },
  noPlan: { fontSize: 12, color: C.red, fontWeight: '500' },
  streak: { fontSize: 12, color: '#374151' },
});

const pStyles = StyleSheet.create({
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '700', color: C.dark, marginBottom: 2 },
  meta: { fontSize: 13, color: C.mid, marginBottom: 6 },
  statsRow: { flexDirection: 'row', backgroundColor: C.white, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '700', color: C.dark },
  statLabel: { fontSize: 11, color: C.mid, marginTop: 2 },
  goalsSection: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  goalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goalChip: { backgroundColor: C.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  goalText: { fontSize: 12, color: C.primary, fontWeight: '500' },
  actions: { padding: 16, gap: 10 },
  secondBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', minHeight: 44 },
  secondBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
});
