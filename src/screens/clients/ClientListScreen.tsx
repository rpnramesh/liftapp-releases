// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Client List + Client Profile Screens
// Fixes:
//   1. Workout status: loads plan.days from clientPlans, not assignment
//   2. Add Client button; Remove / Freeze from profile
//   3. In-app chat button (routes to TrainerChatScreen)
//   4. Remove "Current Plan" box — plan shown in View/Edit button
//   5. MembershipStatusCard added after statsRow in ClientProfileScreen
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator, Alert,
    FlatList,
    Linking, RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Avatar, EmptyState, PrimaryButton, RiskFlagBadge,
    SkeletonCard, StatusBadge,
} from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { C } from '../../constants/theme';
import { db } from '../../firebase/config';
import { useDebounce } from '../../hooks/useTrainer';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { getTrainerId } from '../../services/session';
import { ClientsAPI } from '../../services/trainer.api';
import { membershipStatusColor, whatsappURL } from '../../utils/trainer.utils';
import { MembershipStatusCard } from './MembershipStatusCard';

type TabKey = 'all' | 'gym' | 'freelance';
type SortKey = 'last_activity' | 'name_az' | 'streak';

// ─── Today's day label ────────────────────────────────────────────────────────
function getTodayLabel(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

// ─── Derive today's workout status from plan days ─────────────────────────────
// planDays comes from clientPlans/{planId}.days — the full day array
function getTodayStatus(planDays: any[]): { label: string; color: string } | null {
  if (!planDays || planDays.length === 0) return null;
  const todayLabel = getTodayLabel();
  // Try multiple day label formats
  const today = planDays.find(d => {
    const raw = (d.dayLabel ?? d.day ?? '').toString().toLowerCase();
    // direct string match (full or short)
    if (raw === todayLabel.toLowerCase() || raw === todayLabel.slice(0, 3).toLowerCase()) return true;
    // numeric day index (0=Sunday..6=Saturday) or dayNumber/dayIndex properties
    const dayIndex = d.dayIndex ?? d.dayNumber ?? d.day;
    if (typeof dayIndex === 'number') return dayIndex === new Date().getDay();
    // patterns like 'day 1', 'day1'
    const m = raw.match(/day\s*(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10) - 1; // day1 -> index 0
      return n === new Date().getDay();
    }
    return false;
  });
  if (!today) return null;
  if (today.restDay) return { label: 'Rest Day', color: C.mid };
  const exercises = today.exercises ?? [];
  if (exercises.length === 0) return { label: 'Rest Day', color: C.mid };
  // Check both timestamp and boolean flags for max compatibility
  if (today.completedAt || today.completed === true) return { label: 'Completed', color: '#16A34A' };
  if (today.startedAt || today.inProgress === true) return { label: 'In Progress', color: '#D97706' };
  return { label: 'Not Started', color: C.primary };
}

// ─── Fetch enriched clients with plan name + today status ────────────────────
async function fetchEnrichedClients(trainerId: string, type: string) {
  const res = await ClientsAPI.getClients(trainerId, type as any);
  const clients = res.clients;
  if (clients.length === 0) return clients;

  const trainerSnap = await getDoc(doc(db, 'trainers', trainerId)).catch(() => null);
  const gymId = trainerSnap?.data()?.gymId ?? trainerId;

  return await Promise.all(clients.map(async (client) => {
    try {
      // 1. Get assignment
      const assignSnap = await getDoc(doc(db, 'gyms', gymId, 'assignments', client.id)).catch(() => null);
      const assign = assignSnap?.exists() ? assignSnap.data() : null;

      // 2. Get plan name + days from clientPlans (authoritative source)
      let planName: string | null = null;
      let planDays: any[] = [];

      if (assign?.planId) {
        const planSnap = await getDoc(doc(db, 'gyms', gymId, 'clientPlans', assign.planId)).catch(() => null);
        if (planSnap?.exists()) {
          planName = planSnap.data().name ?? null;
          planDays = planSnap.data().days ?? [];
        }
      }

      // Fallback to member record
      if (!planName) {
        planName = assign?.planName ?? client.assignedPlanName ?? null;
      }

      const todayStatus = getTodayStatus(planDays);

      return {
        ...client,
        assignedPlanName: planName,
        hasPlan: !!planName,
        todayStatus,
        isFrozen: client.isFrozen ?? false,
      };
    } catch {
      return { ...client, hasPlan: !!client.assignedPlanName, todayStatus: null };
    }
  }));
}

// ─── Client List Screen ───────────────────────────────────────────────────────
type ListProps = NativeStackScreenProps<ClientsStackParamList, 'ClientList'>;

export default function ClientListScreen({ navigation }: ListProps) {
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('last_activity');
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const loadClients = useCallback(async () => {
    const trainerId = getTrainerId();
    if (!trainerId) return;
    setLoading(true);
    try {
      const enriched = await fetchEnrichedClients(trainerId, tab === 'all' ? 'all' : tab);
      setAllClients(enriched);
    } catch (e) {
      console.log('Client load error:', e);
    } finally { setLoading(false); }
  }, [tab]);

  useFocusEffect(useCallback(() => { loadClients(); }, [loadClients]));

  const filtered = allClients
    .filter(c => {
      if (debouncedSearch) return (c.fullName ?? '').toLowerCase().includes(debouncedSearch.toLowerCase());
      return true;
    })
    .sort((a, b) => {
      if (sort === 'name_az') return (a.fullName ?? '').localeCompare(b.fullName ?? '');
      if (sort === 'streak') return (b.streak ?? 0) - (a.streak ?? 0);
      return 0;
    });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.clientCard, item.isFrozen && styles.clientCardFrozen]}
      onPress={() => navigation.navigate('ClientProfile', {
        clientId: item.id, clientName: item.fullName,
      })}
      activeOpacity={0.85}
    >
      <Avatar uri={item.profilePhotoUrl} name={item.fullName} size={48} />
      <View style={styles.clientInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.clientName}>{item.fullName}</Text>
          {item.hasRiskFlag && <RiskFlagBadge />}
          {item.isFrozen && (
            <View style={styles.frozenBadge}><Text style={styles.frozenBadgeText}>Frozen</Text></View>
          )}
          {item.clientType === 'freelance' && (
            <View style={styles.freelanceBadge}>
              <Text style={styles.freelanceBadgeText}>Freelance</Text>
            </View>
          )}
        </View>

        <StatusBadge label={item.membershipStatus} color={membershipStatusColor(item.membershipStatus)} />

        {/* Plan name or No plan */}
        {item.hasPlan
          ? <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
              <Ionicons name="clipboard-outline" size={13} color="#374151" />
              <Text style={styles.planName}>{item.assignedPlanName}</Text>
            </View>
          : <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
              <Ionicons name="warning-outline" size={13} color={C.red} />
              <Text style={styles.noPlan}>No plan assigned</Text>
            </View>
        }

        {/* Today's workout status — only when plan assigned AND status exists */}
        {item.hasPlan && item.todayStatus && (
          <Text style={[styles.todayStatus, { color: item.todayStatus.color }]}>
            {item.todayStatus.label}
          </Text>
        )}

        <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
          <IconSymbol name="flame.fill" size={13} color={C.amber} />
          <Text style={styles.streak}>{item.streak ?? 0}-day streak</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with Invite + Pending buttons */}
      <View style={styles.listHeader}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients…"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: C.amber }]}
          onPress={() => navigation.navigate('PendingInvites')}
        >
          <Ionicons name="notifications-outline" size={18} color={C.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('PhoneInvite')}
        >
          <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={styles.addBtnText}>Invite</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['all', 'gym', 'freelance'] as TabKey[]).map(t => (
          <TouchableOpacity key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'all' ? 'All Clients' : t === 'gym' ? 'Gym' : 'Freelance'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {([['last_activity', 'Recent'], ['name_az', 'A–Z'], ['streak', 'Streak']] as [SortKey, string][]).map(([key, label]) => (
          <TouchableOpacity key={key}
            style={[styles.sortChip, sort === key && styles.sortChipActive]}
            onPress={() => setSort(key)}>
            <Text style={[styles.sortChipText, sort === key && { color: C.primary, fontWeight: '600' }]}>
              {label}
            </Text>
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
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadClients} tintColor={C.primary} />}
          ListEmptyComponent={
            tab === 'freelance'
                ? <EmptyState icon={<IconSymbol name="person.2.fill" size={48} color={C.mid} />} title="No freelance clients yet"
                    subtitle="Tap + Add to onboard a client."
                    ctaLabel="+ Add Client" onCTA={() => navigation.navigate('FreelanceOnboarding')} />
                  : <EmptyState icon={<IconSymbol name="person.2.fill" size={48} color={C.mid} />} title="No clients found"
                    subtitle="Clients assigned to you will appear here." />
          }
        />
      )}
    </View>
  );
}

// ─── Client Profile Screen ────────────────────────────────────────────────────
type ProfileProps = NativeStackScreenProps<ClientsStackParamList, 'ClientProfile'>;

export function ClientProfileScreen({ navigation, route }: ProfileProps) {
  const { clientId, clientName } = route.params;
  const [profile, setProfile] = useState(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [planDays, setPlanDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    const trainerId = getTrainerId();
    if (!trainerId) return;
    setLoading(true); setError('');
    try {
      const data = await ClientsAPI.getClientProfile(trainerId, clientId);
      setProfile(data);

      const trainerSnap = await getDoc(doc(db, 'trainers', trainerId)).catch(() => null);
      const gymId = trainerSnap?.data()?.gymId ?? trainerId;

      const assignSnap = await getDoc(doc(db, 'gyms', gymId, 'assignments', clientId)).catch(() => null);
      const assign = assignSnap?.exists() ? assignSnap.data() : null;

      if (assign?.planId) {
        const planSnap = await getDoc(doc(db, 'gyms', gymId, 'clientPlans', assign.planId)).catch(() => null);
        if (planSnap?.exists()) {
          setPlanName(planSnap.data().name ?? null);
          setPlanDays(planSnap.data().days ?? []);
        } else {
          setPlanName(assign?.planName ?? data.currentPlanName ?? null);
        }
      } else {
        setPlanName(data.currentPlanName ?? null);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load profile');
    } finally { setLoading(false); }
  }, [clientId]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const hasPlan = !!planName;
  const todayStatus = getTodayStatus(planDays);

  // ── Remove client ──────────────────────────────────────────────────────────
  const handleRemove = () => {
    Alert.alert(
      'Remove Client',
      `Remove ${clientName} from your client list? They will no longer appear in your clients and their plan will be unassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await updateDoc(doc(db, 'members', clientId), {
                trainerId: null,
                removedAt: Date.now(),
              });
              Alert.alert('Removed', `${clientName} has been removed from your client list.`);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Failed to remove client');
            } finally { setActionLoading(false); }
          },
        },
      ]
    );
  };

  // ── Freeze / Unfreeze client ───────────────────────────────────────────────
  const handleFreeze = () => {
    const isFrozen = (profile as any)?.isFrozen ?? false;
    const action = isFrozen ? 'Unfreeze' : 'Freeze';
    const desc = isFrozen
      ? `Unfreeze ${clientName}? They will be able to access their workouts again.`
      : `Freeze ${clientName}? Their access to workouts and plans will be suspended until unfrozen.`;

    Alert.alert(action + ' Client', desc, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action, style: isFrozen ? 'default' : 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await updateDoc(doc(db, 'members', clientId), {
              isFrozen: !isFrozen,
              frozenAt: !isFrozen ? Date.now() : null,
            });
            setProfile((p: any) => ({ ...p, isFrozen: !isFrozen }));
            Alert.alert(
              !isFrozen ? 'Frozen' : 'Unfrozen',
              `${clientName} has been ${!isFrozen ? 'frozen' : 'unfrozen'}.`
            );
          } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Failed to update client');
          } finally { setActionLoading(false); }
        },
      },
    ]);
  };

  const handleWhatsApp = () => {
    if (!profile) return;
    Linking.openURL(whatsappURL(profile.phone,
      `Hi ${(profile.fullName ?? '').split(' ')[0]}, checking in on your training!`
    ));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }
  if (error || !profile) {
    return <EmptyState icon={<IconSymbol name="exclamationmark.triangle.fill" size={40} color={C.mid} />} title="Failed to load profile"
      subtitle={error ?? ''} ctaLabel="Retry" onCTA={loadProfile} />;
  }

  const isFrozen = (profile as any)?.isFrozen ?? false;

  return (
    // ── Wrap everything in ScrollView so MembershipStatusCard
    //    (which can be tall) doesn't get clipped off screen
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} showsVerticalScrollIndicator={false}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={pStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginBottom: 10 }}>
          <IconSymbol name="chevron.left" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={pStyles.headerRow}>
          <Avatar uri={profile.profilePhotoUrl} name={profile.fullName} size={72} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={pStyles.name}>{profile.fullName}</Text>
              {isFrozen && (
                <View style={pStyles.frozenBadge}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <IconSymbol name="shield" size={12} color="#3B82F6" />
                        <Text style={pStyles.frozenBadgeText}>Frozen</Text>
                      </View>
                    </View>
              )}
            </View>
            <Text style={pStyles.meta}>{profile.age} yrs · {profile.gender}</Text>
            <StatusBadge label={profile.membershipStatus}
              color={membershipStatusColor(profile.membershipStatus)} />
          </View>
        </View>
      </View>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <View style={pStyles.statsRow}>
        {[
          ['Workouts', profile.totalWorkoutsLogged],
          ['Streak', profile.currentStreak],
          ['Attendance', `${profile.attendanceThisMonth}/mo`],
        ].map(([label, value]) => (
          <View key={label as string} style={pStyles.stat}>
            {label === 'Streak' ? (
              <Text style={pStyles.statValue}><IconSymbol name="flame.fill" size={16} color={C.amber} /> {value}d</Text>
            ) : (
              <Text style={pStyles.statValue}>{value}</Text>
            )}
            <Text style={pStyles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Membership Status Card ─────────────────────────────────────────── */}
      {/* Shows plan dates, days left, body metrics, personal info from Firestore */}
      <MembershipStatusCard memberId={clientId} />

      {/* ── Health goals ───────────────────────────────────────────────────── */}
      {profile.healthGoals?.length > 0 && (
        <View style={pStyles.goalsSection}>
          <Text style={pStyles.sectionTitle}>Health Goals</Text>
          <View style={pStyles.goalsRow}>
            {profile.healthGoals.map(g => (
              <View key={g} style={pStyles.goalChip}>
                <Text style={pStyles.goalText}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <View style={pStyles.actions}>

        {/* Create Plan OR View/Edit Plan */}
        {hasPlan ? (
          <TouchableOpacity
            style={pStyles.editPlanBtn}
            onPress={() => navigation.navigate('CreatePlan', {
              clientId: profile.id, clientName: profile.fullName,
            })}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol name="pencil" size={16} color={C.white} />
                <Text style={pStyles.editPlanBtnTitle}>View / Edit Plan</Text>
              </View>
              <Text style={[pStyles.editPlanBtnSub]}>{planName}</Text>
              {todayStatus && (
                <Text style={[pStyles.editPlanBtnStatus, { color: todayStatus.color }]}>
                  Today: {todayStatus.label}
                </Text>
              )}
            </View>
              <IconSymbol name="chevron.right" size={20} color={C.primary} />
          </TouchableOpacity>
        ) : (
          <PrimaryButton
            label="+ Create Plan"
            onPress={() => navigation.navigate('CreatePlan', {
              clientId: profile.id, clientName: profile.fullName,
            })}
          />
        )}

        <TouchableOpacity
          style={[pStyles.secondBtn, { backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryMid }]}
          onPress={() => navigation.navigate('MemberDetails', {
            clientId: profile.id, clientName: profile.fullName,
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconSymbol name="paperplane.fill" size={14} color={C.primary} />
            <Text style={[pStyles.secondBtnText, { color: C.primary, marginLeft: 8 }]}>Member Details & Measurements</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={pStyles.secondBtn}
          onPress={() => navigation.navigate('WorkoutLogs', {
            clientId: profile.id, clientName: profile.fullName,
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconSymbol name="number" size={14} color={C.primary} />
            <Text style={[pStyles.secondBtnText, { marginLeft: 8 }]}>View Workout Logs</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={pStyles.secondBtn}
          onPress={() => navigation.navigate('ProgressDashboard', {
            clientId: profile.id, clientName: profile.fullName,
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconSymbol name="scalemass" size={14} color={C.primary} />
            <Text style={[pStyles.secondBtnText, { marginLeft: 8 }]}>View Progress</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={pStyles.secondBtn}
          onPress={() => navigation.navigate('ProgressPhotos', {
            clientId: profile.id, clientName: profile.fullName,
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconSymbol name="camera" size={14} color={C.primary} />
            <Text style={[pStyles.secondBtnText, { marginLeft: 8 }]}>Progress Photos</Text>
          </View>
        </TouchableOpacity>

        {/* In-app chat */}
        <TouchableOpacity
          style={[pStyles.secondBtn, { backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryMid }]}
          onPress={() => navigation.navigate('TrainerChat', {
            clientId: profile.id, clientName: profile.fullName,
            clientPhone: profile.phone, clientPhotoUrl: profile.profilePhotoUrl,
          })}>
          <Text style={[pStyles.secondBtnText, { color: C.primary }]}><IconSymbol name="paperplane.fill" size={14} color={C.primary} /> Chat with {profile.fullName?.split(' ')[0]}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[pStyles.secondBtn, { backgroundColor: '#DCFCE7' }]}
          onPress={handleWhatsApp}>
          <Text style={[pStyles.secondBtnText, { color: C.green }]}>WhatsApp Message</Text>
        </TouchableOpacity>

        {/* Freeze + Remove */}
        <View style={pStyles.dangerRow}>
          <TouchableOpacity
            style={[pStyles.dangerBtn, { backgroundColor: isFrozen ? '#DCFCE7' : '#EFF6FF', borderColor: isFrozen ? C.green : '#3B82F6' }]}
            onPress={handleFreeze}
            disabled={actionLoading}>
            <Text style={[pStyles.dangerBtnText, { color: isFrozen ? C.green : '#3B82F6' }]}>
              {isFrozen ? (<><IconSymbol name="shield" size={12} color={C.green} /> Unfreeze Client</>) : (<><IconSymbol name="shield" size={12} color="#3B82F6" /> Freeze Client</>)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pStyles.dangerBtn, { backgroundColor: '#FEF2F2', borderColor: C.red }]}
            onPress={handleRemove}
            disabled={actionLoading}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconSymbol name="trash" size={14} color={C.red} />
              <Text style={[pStyles.dangerBtnText, { color: C.red }]}>Remove Client</Text>
            </View>
          </TouchableOpacity>
        </View>

      </View>

      {/* Bottom padding so last button isn't flush against edge */}
      <View style={{ height: 40 }} />

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 },
  searchInput: { flex: 1, backgroundColor: C.white, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: C.border },
  addBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  addBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: C.mid },
  tabTextActive: { color: C.white },
  sortRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, alignItems: 'center', marginBottom: 4 },
  sortLabel: { fontSize: 12, color: C.mid },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F3F4F6' },
  sortChipActive: { backgroundColor: C.primary + '18' },
  sortChipText: { fontSize: 12, color: C.mid },
  clientCard: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: C.white, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  clientCardFrozen: { opacity: 0.6, borderWidth: 1, borderColor: '#93C5FD' },
  clientInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  clientName: { fontSize: 15, fontWeight: '600', color: C.dark },
  frozenBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  frozenBadgeText: { fontSize: 10, color: '#3B82F6', fontWeight: '600' },
  freelanceBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  freelanceBadgeText: { fontSize: 10, color: '#7C3AED', fontWeight: '600' },
  planName: { fontSize: 12, color: '#374151', fontWeight: '500' },
  noPlan: { fontSize: 12, color: C.red, fontWeight: '500' },
  todayStatus: { fontSize: 12, fontWeight: '600' },
  streak: { fontSize: 12, color: C.mid },
});

const pStyles = StyleSheet.create({
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '700', color: C.dark, marginBottom: 2 },
  meta: { fontSize: 13, color: C.mid, marginBottom: 6 },
  frozenBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  frozenBadgeText: { fontSize: 11, color: '#3B82F6', fontWeight: '600' },
  statsRow: { flexDirection: 'row', backgroundColor: C.white, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '700', color: C.dark },
  statLabel: { fontSize: 11, color: C.mid, marginTop: 2 },
  goalsSection: { padding: 16, paddingBottom: 0 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  goalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goalChip: { backgroundColor: C.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  goalText: { fontSize: 12, color: C.primary, fontWeight: '500' },
  actions: { padding: 16, gap: 10 },
  editPlanBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: C.primary, gap: 8 },
  editPlanBtnTitle: { fontSize: 15, fontWeight: '700', color: C.primary },
  editPlanBtnSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  editPlanBtnStatus: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  secondBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', minHeight: 44 },
  secondBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  dangerRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dangerBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  dangerBtnText: { fontSize: 13, fontWeight: '600' },
});
