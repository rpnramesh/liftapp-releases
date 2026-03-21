// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-016 Freelance Client Onboarding
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Share, Clipboard, Modal, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { FreelanceAPI } from '../../services/mockApi';
import { INVITE_EXPIRY_DAYS, MAX_FREELANCE_CLIENTS } from '../../constants/trainer.constants';
import { EmptyState, PrimaryButton, StatusBadge } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { FreelanceInvite, ManualClientPayload, InviteStatus } from '../../types/trainer.types';
import { formatDate, formatINR, freelanceInviteMessage, isValidIndianPhone } from '../../utils/trainer.utils';

const TRAINER_ID = 'trainer-001';
const TOKEN = '';

type Props = NativeStackScreenProps<ClientsStackParamList, 'FreelanceOnboarding'>;

const INVITE_STATUS_COLORS: Record<InviteStatus, string> = {
  Pending: C.amber,
  Accepted: C.green,
  Expired: C.red,
};

export default function FreelanceOnboardingScreen({ navigation }: Props) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const fetchInvites = useCallback(() => FreelanceAPI.getInvites(TRAINER_ID, TOKEN), []);
  const { data: invites, loading, refresh } = useAsync<FreelanceInvite[]>(fetchInvites);

  const handleResend = async (invite: FreelanceInvite) => {
    try {
      const res = await FreelanceAPI.createInvite(TRAINER_ID, { monthlyFee: invite.monthlyFee }, TOKEN);
      await Share.share({ message: freelanceInviteMessage('Trainer', res.inviteLink) });
      refresh();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const renderInvite = ({ item }: { item: FreelanceInvite }) => (
    <View style={styles.inviteCard}>
      <View style={{ flex: 1 }}>
        {item.clientName ? (
          <Text style={styles.clientName}>{item.clientName}</Text>
        ) : (
          <Text style={styles.inviteCode}>Code: {item.inviteCode}</Text>
        )}
        <Text style={styles.inviteFee}>{formatINR(item.monthlyFee)}/month · Sent {formatDate(item.createdAt)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <StatusBadge label={item.status} color={INVITE_STATUS_COLORS[item.status]} />
        {item.status === 'Expired' && (
          <TouchableOpacity style={styles.resendBtn} onPress={() => handleResend(item)}>
            <Text style={styles.resendBtnText}>Resend</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: C.primary, fontWeight: '500' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Freelance Clients</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowInviteModal(true)}>
            <Text style={styles.addBtnText}>+ Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#F3F4F6' }]} onPress={() => setShowManualModal(true)}>
            <Text style={[styles.addBtnText, { color: '#374151' }]}>+ Manual</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={invites ?? []}
        keyExtractor={item => item.id}
        renderItem={renderInvite}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.primary} />}
        ListEmptyComponent={
          <EmptyState
            emoji="🌟"
            title="No freelance clients yet"
            subtitle="Invite clients with a personalised link and set up Razorpay payment."
            ctaLabel="Send an Invite"
            onCTA={() => setShowInviteModal(true)}
          />
        }
      />

      <InviteModal visible={showInviteModal} onClose={() => setShowInviteModal(false)} onCreated={refresh} />
      <ManualClientModal visible={showManualModal} onClose={() => setShowManualModal(false)} onCreated={refresh} />
    </View>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [fee, setFee] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const feeNum = parseFloat(fee);
    if (!feeNum || feeNum < 100) { Alert.alert('Validation', 'Enter a valid fee (min ₹100)'); return; }
    setLoading(true);
    try {
      const res = await FreelanceAPI.createInvite(TRAINER_ID, { monthlyFee: feeNum }, TOKEN);
      setInviteLink(res.inviteLink);
      onCreated();
    } catch (e: any) {
      if (e?.status === 403) Alert.alert('Limit Reached', `You've reached the maximum of ${MAX_FREELANCE_CLIENTS} freelance clients. Upgrade to add more.`);
      else Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  const handleShare = () => {
    Share.share({ message: freelanceInviteMessage('Trainer', inviteLink) });
  };

  const handleCopy = () => {
    Clipboard.setString(inviteLink);
    Alert.alert('Copied!', 'Invite link copied to clipboard.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Send Client Invite</Text>
          {!inviteLink ? (
            <>
              <Text style={styles.fieldLabel}>Monthly Subscription Fee (₹)</Text>
              <View style={styles.feeRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput style={styles.feeInput} keyboardType="number-pad" placeholder="e.g. 2500" value={fee} onChangeText={setFee} />
              </View>
              <Text style={styles.hint}>This can be unique per client. Payment collected via Razorpay.</Text>
              <PrimaryButton label="Generate Invite Link" onPress={handleCreate} loading={loading} />
            </>
          ) : (
            <>
              <Text style={styles.successText}>✅ Invite link ready!</Text>
              <View style={styles.linkBox}><Text style={styles.linkText} numberOfLines={2}>{inviteLink}</Text></View>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Text style={styles.shareBtnText}>📲 Share on WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtn, styles.copyBtn]} onPress={handleCopy}>
                <Text style={[styles.shareBtnText, { color: C.primary }]}>📋 Copy Link</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={{ marginTop: 10, alignSelf: 'center' }} onPress={onClose}>
            <Text style={{ color: C.mid }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Manual Client Modal ──────────────────────────────────────────────────────

function ManualClientModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<ManualClientPayload>({ name: '', phone: '', planName: '', monthlyFee: 0, paymentType: 'Offline' });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof ManualClientPayload, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.name.trim() || !isValidIndianPhone(form.phone)) {
      Alert.alert('Validation', 'Enter a valid name and 10-digit phone.'); return;
    }
    setLoading(true);
    try {
      await FreelanceAPI.addManualClient(TRAINER_ID, form, TOKEN);
      onCreated();
      onClose();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Add Client Manually</Text>
          <Text style={styles.hint}>For clients who pay offline. No payment tracking — marked as 'Offline Payment'.</Text>
          {[
            { key: 'name', label: 'Full Name *', placeholder: 'e.g. Arun Kumar' },
            { key: 'phone', label: 'Phone *', placeholder: '10-digit mobile' },
            { key: 'planName', label: 'Plan Name', placeholder: 'e.g. 3-Month Strength' },
          ].map(f => (
            <View key={f.key} style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                style={styles.feeInput}
                placeholder={f.placeholder}
                value={String(form[f.key as keyof ManualClientPayload] ?? '')}
                onChangeText={v => set(f.key as keyof ManualClientPayload, v)}
                keyboardType={f.key === 'phone' ? 'number-pad' : 'default'}
              />
            </View>
          ))}
          <Text style={styles.fieldLabel}>Monthly Fee (₹)</Text>
          <TextInput style={[styles.feeInput, { marginBottom: 12 }]} keyboardType="number-pad" placeholder="e.g. 2000" value={String(form.monthlyFee || '')} onChangeText={v => set('monthlyFee', parseFloat(v) || 0)} />
          <View style={styles.paymentTypeRow}>
            {(['Online', 'Offline'] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.typeChip, form.paymentType === t && styles.typeChipActive]} onPress={() => set('paymentType', t)}>
                <Text style={[styles.typeChipText, form.paymentType === t && { color: C.white }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <PrimaryButton label="Add Client" onPress={handleAdd} loading={loading} />
          <TouchableOpacity style={{ marginTop: 10, alignSelf: 'center' }} onPress={onClose}>
            <Text style={{ color: C.mid }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, gap: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: C.white, fontWeight: '600', fontSize: 13 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  clientName: { fontSize: 15, fontWeight: '600', color: C.dark },
  inviteCode: { fontSize: 13, color: C.mid, fontFamily: 'monospace' },
  inviteFee: { fontSize: 12, color: C.mid, marginTop: 2 },
  resendBtn: { backgroundColor: C.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  resendBtnText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rupee: { fontSize: 20, fontWeight: '700', color: '#374151' },
  feeInput: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 15, color: C.dark, backgroundColor: C.bg },
  hint: { fontSize: 12, color: C.light, marginBottom: 16 },
  successText: { fontSize: 16, fontWeight: '600', color: C.green, marginBottom: 12 },
  linkBox: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 12 },
  linkText: { fontSize: 12, color: '#374151' },
  shareBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  copyBtn: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.primary },
  shareBtnText: { color: C.white, fontWeight: '600', fontSize: 14 },
  paymentTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  typeChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  typeChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
});
