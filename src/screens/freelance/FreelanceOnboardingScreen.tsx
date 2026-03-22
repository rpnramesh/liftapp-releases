// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Freelance Onboarding Screen
// Fix: client list refreshes immediately after adding, inputs work properly
// ─────────────────────────────────────────────────────────────────────────────
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState, PrimaryButton, SkeletonCard } from '../../components/common';
import { C, R, S } from '../../constants/theme';
import { getTrainerId } from '../../services/session';
import { ClientsAPI, FreelanceAPI } from '../../services/trainer.api';
import { formatINR } from '../../utils/trainer.utils';

export default function FreelanceOnboardingScreen({ navigation }: any) {
  const [invites, setInvites] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [tab, setTab] = useState<'clients' | 'invites'>('clients');

  const loadData = useCallback(async () => {
    const trainerId = getTrainerId();
    if (!trainerId) return;
    setLoading(true);
    try {
      const [inviteData, clientData] = await Promise.all([
        FreelanceAPI.getInvites(trainerId),
        ClientsAPI.getClients(trainerId, 'freelance'),
      ]);
      setInvites(inviteData);
      setClients(clientData.clients);
    } catch (e) {
      console.log('Freelance load error:', e);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Freelance Clients</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]}
          onPress={() => setShowInviteModal(true)}>
          <Text style={styles.actionBtnText}>📲 Generate Invite Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary, { flex: 1 }]}
          onPress={() => setShowManualModal(true)}>
          <Text style={[styles.actionBtnText, { color: C.primary }]}>+ Add Manually</Text>
        </TouchableOpacity>
      </View>

      {/* Tab selector */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'clients' && styles.tabActive]}
          onPress={() => setTab('clients')}>
          <Text style={[styles.tabText, tab === 'clients' && styles.tabTextActive]}>
            Clients ({clients.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'invites' && styles.tabActive]}
          onPress={() => setTab('invites')}>
          <Text style={[styles.tabText, tab === 'invites' && styles.tabTextActive]}>
            Invites ({invites.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'clients' ? (
        <FlatList
          data={clients}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: S.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={C.primary} />}
          ListHeaderComponent={loading && clients.length === 0 ? (
            <View style={{ gap: S.sm }}>{[1, 2].map(i => <SkeletonCard key={i} />)}</View>
          ) : null}
          ListEmptyComponent={loading ? null : (
            <EmptyState emoji="👥" title="No freelance clients yet"
              subtitle="Add a client manually or generate an invite link." />
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.clientCard}
              onPress={() => navigation?.navigate?.('Clients', { screen: 'ClientProfile', params: { clientId: item.id, clientName: item.fullName } })}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientAvatarText}>{(item.fullName ?? '?')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{item.fullName}</Text>
                <Text style={styles.clientMeta}>{item.membershipStatus} · {item.assignedPlanName ?? 'No plan'}</Text>
              </View>
              <Text style={{ color: C.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={invites}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: S.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={C.primary} />}
          ListEmptyComponent={loading ? null : (
            <EmptyState emoji="🔗" title="No invite links yet"
              subtitle="Generate an invite link to start onboarding clients." />
          )}
          renderItem={({ item }) => (
            <View style={styles.inviteCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteCode}>Code: {item.inviteCode}</Text>
                <Text style={styles.inviteMeta}>Fee: {formatINR(item.monthlyFee ?? 0)}/mo · Status: {item.status}</Text>
                {item.clientName && <Text style={styles.inviteMeta}>Client: {item.clientName}</Text>}
              </View>
              <TouchableOpacity style={styles.shareBtn}
                onPress={() => Share.share({ message: `Join my training on Lift: ${item.inviteLink}` })}>
                <Text style={styles.shareBtnText}>📲 Share</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onCreated={() => { setShowInviteModal(false); loadData(); }}
        />
      )}

      {showManualModal && (
        <ManualClientModal
          onClose={() => setShowManualModal(false)}
          onCreated={() => { setShowManualModal(false); loadData(); }}
        />
      )}
    </View>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ onClose, onCreated }: any) {
  const [fee, setFee] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleCreate = async () => {
    const feeNum = Number(fee);
    if (!feeNum || feeNum < 100) { setError('Enter a valid monthly fee (min ₹100)'); return; }
    const trainerId = getTrainerId();
    if (!trainerId) { setError('You are not logged in'); return; }
    setLoading(true); setError('');
    try {
      const res = await FreelanceAPI.createInvite(trainerId, { monthlyFee: feeNum });
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? 'Failed to create invite');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: C.bg, padding: S.lg }}>
          <View style={modal.header}>
            <Text style={modal.title}>{result ? 'Invite Created!' : 'Generate Invite Link'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: C.mid, fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>

          {!result ? (
            <>
              <Text style={modal.label}>Monthly Fee (₹) *</Text>
              <View style={modal.feeRow}>
                <Text style={modal.rupee}>₹</Text>
                <TextInput style={modal.input} placeholder="e.g. 2500"
                  placeholderTextColor={C.mid} keyboardType="number-pad"
                  value={fee} onChangeText={v => { setFee(v); setError(''); }} autoFocus />
              </View>
              {!!error && <Text style={modal.error}>{error}</Text>}
              <PrimaryButton label="Create Invite Link" onPress={handleCreate} loading={loading} />
            </>
          ) : (
            <>
              <Text style={modal.successEmoji}>🎉</Text>
              <Text style={modal.successText}>Your invite link is ready!</Text>
              <View style={modal.linkBox}>
                <Text style={modal.linkText} numberOfLines={2}>{result.inviteLink}</Text>
              </View>
              <View style={{ gap: S.md, marginTop: S.md }}>
                <TouchableOpacity style={modal.shareBtn}
                  onPress={() => Share.share({ message: `Join my training on Lift: ${result.inviteLink}` })}>
                  <Text style={modal.shareBtnText}>📲 Share on WhatsApp</Text>
                </TouchableOpacity>
                <PrimaryButton label="Done" onPress={onCreated} />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Manual Client Modal ──────────────────────────────────────────────────────
function ManualClientModal({ onClose, onCreated }: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [planName, setPlanName] = useState('Monthly');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [paymentType, setPaymentType] = useState<'Online' | 'Offline'>('Offline');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    const e: any = {};
    if (!name.trim()) e.name = 'Name is required';
    if (phone.trim().length < 10) e.phone = 'Enter a valid 10-digit number';
    if (!monthlyFee || isNaN(Number(monthlyFee))) e.monthlyFee = 'Enter a valid fee';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    const trainerId = getTrainerId();
    if (!trainerId) { Alert.alert('Error', 'You are not logged in'); return; }
    setLoading(true);
    try {
      await FreelanceAPI.addManualClient(trainerId, {
        name: name.trim(),
        phone: phone.trim(),
        planName,
        monthlyFee: Number(monthlyFee),
        paymentType,
      });
      // Dismiss and trigger refresh in parent immediately
      onCreated();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to add client');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1, backgroundColor: C.white, padding: S.lg }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={modal.header}>
            <Text style={modal.title}>Add Client Manually</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: C.mid, fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>

          <View style={modal.field}>
            <Text style={modal.label}>Full Name *</Text>
            <TextInput style={[modal.input, errors.name && modal.inputError]}
              placeholder="Client's full name" placeholderTextColor={C.mid}
              value={name} onChangeText={v => { setName(v); setErrors((p: any) => ({ ...p, name: '' })); }}
              autoFocus />
            {errors.name ? <Text style={modal.error}>{errors.name}</Text> : null}
          </View>

          <View style={modal.field}>
            <Text style={modal.label}>Phone Number *</Text>
            <View style={modal.phoneRow}>
              <Text style={modal.prefix}>+91</Text>
              <TextInput style={[modal.phoneInput, errors.phone && modal.inputError]}
                placeholder="10-digit number" placeholderTextColor={C.mid}
                keyboardType="phone-pad" maxLength={10}
                value={phone} onChangeText={v => { setPhone(v); setErrors((p: any) => ({ ...p, phone: '' })); }} />
            </View>
            {errors.phone ? <Text style={modal.error}>{errors.phone}</Text> : null}
          </View>

          <View style={modal.field}>
            <Text style={modal.label}>Plan Name</Text>
            <TextInput style={modal.input} placeholder="e.g. Monthly, Weekly, Custom"
              placeholderTextColor={C.mid} value={planName}
              onChangeText={setPlanName} />
          </View>

          <View style={modal.field}>
            <Text style={modal.label}>Monthly Fee (₹) *</Text>
            <View style={modal.feeRow}>
              <Text style={modal.rupee}>₹</Text>
              <TextInput style={[modal.input, { flex: 1 }, errors.monthlyFee && modal.inputError]}
                placeholder="e.g. 2500" placeholderTextColor={C.mid}
                keyboardType="number-pad"
                value={monthlyFee} onChangeText={v => { setMonthlyFee(v); setErrors((p: any) => ({ ...p, monthlyFee: '' })); }} />
            </View>
            {errors.monthlyFee ? <Text style={modal.error}>{errors.monthlyFee}</Text> : null}
          </View>

          <View style={modal.field}>
            <Text style={modal.label}>Payment Type</Text>
            <View style={modal.toggleRow}>
              {(['Online', 'Offline'] as const).map(t => (
                <TouchableOpacity key={t}
                  style={[modal.typeBtn, paymentType === t && modal.typeBtnActive]}
                  onPress={() => setPaymentType(t)}>
                  <Text style={[modal.typeBtnText, paymentType === t && { color: C.white }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <PrimaryButton label="Add Client" onPress={handleAdd} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.dark },
  actionRow: { flexDirection: 'row', gap: S.sm, padding: S.lg, paddingBottom: S.sm },
  actionBtn: { backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' },
  actionBtnSecondary: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.primary },
  actionBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  tabRow: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: C.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: C.mid },
  tabTextActive: { color: C.primary },
  clientCard: { backgroundColor: C.white, borderRadius: R.lg, padding: S.md, marginBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.md, elevation: 1 },
  clientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { color: C.white, fontWeight: '700', fontSize: 18 },
  clientName: { fontSize: 15, fontWeight: '600', color: C.dark },
  clientMeta: { fontSize: 12, color: C.mid, marginTop: 2 },
  inviteCard: { backgroundColor: C.white, borderRadius: R.lg, padding: S.lg, marginBottom: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md, elevation: 1 },
  inviteCode: { fontSize: 15, fontWeight: '700', color: C.dark },
  inviteMeta: { fontSize: 12, color: C.mid, marginTop: 2 },
  shareBtn: { backgroundColor: C.primaryBg, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm },
  shareBtnText: { color: C.primary, fontWeight: '600', fontSize: 13 },
});

const modal = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
  title: { fontSize: 20, fontWeight: '700', color: C.dark },
  field: { marginBottom: S.md },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 15, color: C.dark },
  inputError: { borderColor: C.red },
  error: { fontSize: 12, color: C.red, marginTop: 4 },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupee: { fontSize: 20, fontWeight: '700', color: '#374151' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefix: { fontSize: 15, fontWeight: '600', color: '#374151' },
  phoneInput: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 15, color: C.dark },
  toggleRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: R.md, alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: C.white },
  typeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: C.mid },
  shareBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  shareBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },
  successEmoji: { fontSize: 52, textAlign: 'center', marginVertical: 12 },
  successText: { fontSize: 18, fontWeight: '700', color: C.dark, textAlign: 'center', marginBottom: 16 },
  linkBox: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 14, marginBottom: 8 },
  linkText: { fontSize: 13, color: '#374151' },
});
