// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Invite Member Screen
// Fixes:
//   #1  Re-search after remove works (no active filter)
//   #5  Fee field removed from link tab
//   #6  Membership validity date/months picker added
// ─────────────────────────────────────────────────────────────────────────────
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { PrimaryButton } from '../../components/common';
import { C, R, S } from '../../constants/theme';
import { db } from '../../firebase/config';
import { getTrainerId } from '../../services/session';

// Membership months options
const MONTH_OPTIONS = [1, 2, 3, 6, 9, 12, 15];

function getMembershipEndDate(type: 'date' | 'months', value: string | number): number {
  if (type === 'months') {
    const d = new Date();
    d.setMonth(d.getMonth() + Number(value));
    return d.getTime();
  }
  // type === 'date'
  return new Date(value as string).getTime();
}

function formatDateDisplay(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PhoneInviteScreen({ navigation }: any) {
  const trainerId = getTrainerId();
  const [tab, setTab] = useState<'phone' | 'link'>('phone');

  // ── Phone tab state ──────────────────────────────────────────────────────────
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundMember, setFoundMember] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [notEnabled, setNotEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // ── Membership validity state (shared between both tabs) ─────────────────────
  const [validityType, setValidityType] = useState<'months' | 'date'>('months');
  const [validityMonths, setValidityMonths] = useState(1);
  const [validityDate, setValidityDate] = useState('');
  const [showValidityModal, setShowValidityModal] = useState(false);

  // ── Link tab state ───────────────────────────────────────────────────────────
  const [generatingLink, setGeneratingLink] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const getValidityEndDate = () => {
    if (validityType === 'months') return getMembershipEndDate('months', validityMonths);
    if (validityDate) return getMembershipEndDate('date', validityDate);
    return getMembershipEndDate('months', 1); // default 1 month
  };

  const validityLabel = validityType === 'months'
    ? `${validityMonths} month${validityMonths > 1 ? 's' : ''} (until ${formatDateDisplay(getMembershipEndDate('months', validityMonths))})`
    : validityDate ? `Until ${formatDateDisplay(new Date(validityDate).getTime())}` : 'Select date';

  const resetPhone = () => {
    setPhone(''); setFoundMember(null);
    setNotFound(false); setNotEnabled(false); setSent(false);
  };

  // ── Fix #1: Search without active filter — active is only for UI, not blocking ─
  const handleSearch = async () => {
    const clean = phone.trim().replace(/\s/g, '');
    if (clean.length < 10) { Alert.alert('Invalid', 'Enter a valid 10-digit number.'); return; }
    setSearching(true); setFoundMember(null); setNotFound(false); setNotEnabled(false); setSent(false);
    try {
      const formatted = clean.startsWith('+91') ? clean : `+91${clean}`;

      // Do NOT filter by active — removed/unfrozen members should be findable again
      const snap = await getDocs(query(
        collection(db, 'members'),
        where('phone', '==', formatted),
      ));

      if (snap.empty) { setNotFound(true); return; }

      const m = snap.docs[0].data();

      if (!m.acceptingTrainerInvites) { setNotEnabled(true); return; }

      // Already this trainer's active client
      if (m.trainerId === trainerId) {
        Alert.alert('Already Your Client', `${m.name ?? m.fullName} is already connected with you.`);
        return;
      }

      // Check for existing pending invite
      const existSnap = await getDocs(query(
        collection(db, 'trainerInvites'),
        where('trainerId', '==', trainerId),
        where('memberId', '==', m.id),
        where('status', '==', 'pending'),
      ));
      if (!existSnap.empty) {
        Alert.alert('Invite Pending', `You already have a pending invite to ${m.name ?? m.fullName}. Wait for them to respond, or ask them to check their Profile.`);
        return;
      }

      setFoundMember(m);
    } catch (e: any) {
      Alert.alert('Error', 'Search failed. Please try again.');
      console.log('Phone search error:', e);
    } finally { setSearching(false); }
  };

  const handleSendInvite = async () => {
    if (!foundMember) return;
    setSending(true);
    try {
      const trainerSnap = await getDoc(doc(db, 'trainers', trainerId));
      const trainer = trainerSnap.data();
      const trainerName = trainer?.fullName ?? trainer?.name ?? 'Trainer';
      const planEndDate = getValidityEndDate();

      const inviteRef = doc(collection(db, 'trainerInvites'));
      await setDoc(inviteRef, {
        id: inviteRef.id,
        trainerId,
        trainerName,
        memberId: foundMember.id,
        memberName: foundMember.name ?? foundMember.fullName ?? '',
        memberPhone: foundMember.phone,
        gymId: trainer?.gymId ?? null,
        type: 'phone',
        status: 'pending',
        planEndDate,       // ← membership validity
        validityMonths: validityType === 'months' ? validityMonths : null,
        createdAt: Date.now(),
      });

      // Notification to member
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        recipientId: foundMember.id,
        type: 'client_invited_accepted',
        title: 'New Trainer Invite',
        body: `${trainerName} has sent you a training invite`,
        isRead: false, read: false,
        createdAt: Date.now(),
      });

      setSent(true);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send invite.');
      console.log('Send invite error:', e);
    } finally { setSending(false); }
  };

  // ── Fix #5: No fee field. Just generate link with validity ───────────────────
  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const trainerSnap = await getDoc(doc(db, 'trainers', trainerId));
      const trainer = trainerSnap.data();
      const trainerName = trainer?.fullName ?? trainer?.name ?? 'Trainer';
      let code = trainer?.inviteCode;
      if (!code) {
        code = `${trainerId.slice(0, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        await updateDoc(doc(db, 'trainers', trainerId), { inviteCode: code }).catch(() => {});
      }
      const planEndDate = getValidityEndDate();
      const ref = doc(collection(db, 'freelanceInvites'));
      await setDoc(ref, {
        id: ref.id,
        trainerId,
        trainerName,
        gymId: trainer?.gymId ?? null,
        inviteCode: code,
        inviteLink: `https://lift.app/join/${code}`,
        planEndDate,
        validityMonths: validityType === 'months' ? validityMonths : null,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      });
      setInviteLink(`https://lift.app/join/${code}`);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to generate link.');
    } finally { setGeneratingLink(false); }
  };

  // ── Membership validity picker modal ─────────────────────────────────────────
  const ValidityModal = () => (
    <Modal visible={showValidityModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowValidityModal(false)}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Membership Validity</Text>
          <TouchableOpacity onPress={() => setShowValidityModal(false)}>
            <Text style={{ color: C.mid, fontSize: 16 }}>✕ Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: S.lg }} contentContainerStyle={{ gap: S.lg }}>
          {/* Type selector */}
          <View style={s.typeRow}>
            <TouchableOpacity
              style={[s.typeBtn, validityType === 'months' && s.typeBtnActive]}
              onPress={() => setValidityType('months')}>
              <Text style={[s.typeBtnText, validityType === 'months' && { color: C.white }]}>By Months</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeBtn, validityType === 'date' && s.typeBtnActive]}
              onPress={() => setValidityType('date')}>
              <Text style={[s.typeBtnText, validityType === 'date' && { color: C.white }]}>Fixed Date</Text>
            </TouchableOpacity>
          </View>

          {validityType === 'months' && (
            <View>
              <Text style={s.sectionLabel}>Select number of months</Text>
              <View style={s.monthsGrid}>
                {MONTH_OPTIONS.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.monthBtn, validityMonths === m && s.monthBtnActive]}
                    onPress={() => setValidityMonths(m)}>
                    <Text style={[s.monthBtnText, validityMonths === m && { color: C.white }]}>
                      {m} {m === 1 ? 'Month' : 'Months'}
                    </Text>
                    <Text style={[s.monthSubText, validityMonths === m && { color: 'rgba(255,255,255,0.8)' }]}>
                      Until {formatDateDisplay(getMembershipEndDate('months', m))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {validityType === 'date' && (
            <View>
              <Text style={s.sectionLabel}>Enter expiry date (YYYY-MM-DD)</Text>
              <TextInput
                style={s.dateInput}
                placeholder="e.g. 2025-12-31"
                placeholderTextColor={C.mid}
                value={validityDate}
                onChangeText={setValidityDate}
                keyboardType="numbers-and-punctuation"
              />
              {validityDate && !isNaN(new Date(validityDate).getTime()) && (
                <Text style={s.datePreview}>
                  Expires on {formatDateDisplay(new Date(validityDate).getTime())}
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: C.primary, fontSize: 15, fontWeight: '500' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Invite a Member</Text>
        <Text style={s.subtitle}>Works for gym members and freelance members</Text>
      </View>

      <View style={s.tabs}>
        {(['phone', 'link'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'phone' ? '📱 By Phone' : '🔗 Invite Link'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingBottom: 40 }}>

        {/* ── Membership Validity (shown on both tabs) ── */}
        <TouchableOpacity style={s.validityCard} onPress={() => setShowValidityModal(true)}>
          <View style={{ flex: 1 }}>
            <Text style={s.validityLabel}>📅 Membership Validity</Text>
            <Text style={s.validityValue}>{validityLabel}</Text>
          </View>
          <Text style={{ color: C.primary, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        {/* ── Phone tab ── */}
        {tab === 'phone' && (<>
          <View style={s.card}>
            <Text style={s.label}>Member's Phone Number</Text>
            <Text style={s.hint}>Member must have "Accept Trainer Invites" enabled in their profile</Text>
            <View style={s.row}>
              <Text style={s.prefix}>+91</Text>
              <TextInput style={s.input} placeholder="10-digit number"
                placeholderTextColor={C.mid} keyboardType="phone-pad" maxLength={10}
                value={phone}
                onChangeText={v => {
                  setPhone(v);
                  setFoundMember(null); setNotFound(false); setNotEnabled(false); setSent(false);
                }} />
            </View>
            <TouchableOpacity style={[s.btn, phone.length < 10 && s.btnOff]}
              onPress={handleSearch} disabled={phone.length < 10 || searching}>
              {searching
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={s.btnText}>Search</Text>}
            </TouchableOpacity>
          </View>

          {notFound && (
            <View style={s.statusCard}>
              <Text style={{ fontSize: 32 }}>🔍</Text>
              <Text style={s.statusTitle}>Member not found</Text>
              <Text style={s.statusSub}>This number isn't registered on Lift. Ask them to download and sign up first.</Text>
            </View>
          )}

          {notEnabled && (
            <View style={[s.statusCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <Text style={{ fontSize: 32 }}>🔒</Text>
              <Text style={s.statusTitle}>Invites not enabled</Text>
              <Text style={s.statusSub}>This member hasn't turned on "Accept Trainer Invites" in their Lift profile. Ask them to enable it first.</Text>
            </View>
          )}

          {foundMember && !sent && (<>
            <View style={[s.card, { borderColor: C.primary, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{(foundMember.name ?? foundMember.fullName ?? '?')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.foundName}>{foundMember.name ?? foundMember.fullName}</Text>
                <Text style={s.foundSub}>{foundMember.phone}</Text>
                <Text style={s.foundBadge}>{foundMember.gymId ? '🏛 Gym Member' : '🌟 Independent'}</Text>
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.hint}>
                {foundMember.name ?? foundMember.fullName} will receive a notification and can accept or reject your invite from their Lift app.
              </Text>
              <PrimaryButton label={sending ? 'Sending…' : 'Send Invite'} onPress={handleSendInvite} loading={sending} />
            </View>
          </>)}

          {sent && (
            <View style={[s.statusCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={{ fontSize: 48 }}>🎉</Text>
              <Text style={s.statusTitle}>Invite Sent!</Text>
              <Text style={s.statusSub}>{foundMember?.name ?? foundMember?.fullName} will see your invite in their Lift app Profile → Trainer Invites.</Text>
              <TouchableOpacity style={s.anotherBtn} onPress={resetPhone}>
                <Text style={s.anotherBtnText}>Invite Another Member</Text>
              </TouchableOpacity>
            </View>
          )}
        </>)}

        {/* ── Link tab (no fee field) ── */}
        {tab === 'link' && (<>
          {!inviteLink ? (
            <View style={s.card}>
              <Text style={s.label}>Generate Invite Link</Text>
              <Text style={s.hint}>Share this link with your member. They paste it in Lift → Profile → Trainer Invites.</Text>
              <PrimaryButton
                label={generatingLink ? 'Generating…' : 'Generate Link'}
                onPress={handleGenerateLink}
                loading={generatingLink}
              />
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.label}>Your Invite Link ✅</Text>
              <View style={s.linkBox}>
                <Text style={s.linkText} numberOfLines={3}>{inviteLink}</Text>
              </View>
              <PrimaryButton label="📲 Share Link" onPress={() => Share.share({ message: `Join my training program on Lift: ${inviteLink}` })} />
              <Text style={s.hint}>Member opens Lift → Profile → Trainer Invites → pastes this link → Accept</Text>
              <TouchableOpacity onPress={() => setInviteLink('')} style={{ alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: C.mid, fontSize: 13 }}>Generate new link</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[s.statusCard, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
            <Text style={{ fontSize: 32 }}>🔗</Text>
            <Text style={s.statusTitle}>How invite links work</Text>
            <Text style={[s.statusSub, { textAlign: 'left' }]}>
              {'1. Tap Generate Link above\n2. Share via WhatsApp or SMS\n3. Member opens Lift → Profile → Trainer Invites\n4. They paste the link and tap Go → Accept\n5. You see them in your Clients list immediately'}
            </Text>
          </View>
        </>)}
      </ScrollView>

      <ValidityModal />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: C.white, padding: S.lg, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: C.border, gap: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.dark },
  subtitle: { fontSize: 13, color: C.mid },
  tabs: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: C.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: C.mid },
  tabTextActive: { color: C.primary },
  validityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: R.lg, padding: S.lg, marginBottom: S.md, borderWidth: 1.5, borderColor: C.primary, elevation: 1 },
  validityLabel: { fontSize: 12, fontWeight: '700', color: C.primary, marginBottom: 3 },
  validityValue: { fontSize: 14, fontWeight: '600', color: C.dark },
  card: { backgroundColor: C.white, borderRadius: R.lg, padding: S.lg, marginBottom: S.md, gap: S.md, elevation: 1 },
  label: { fontSize: 14, fontWeight: '700', color: C.dark },
  hint: { fontSize: 12, color: C.mid, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefix: { fontSize: 16, fontWeight: '600', color: '#374151' },
  input: { flex: 1, backgroundColor: C.bg, borderRadius: R.md, padding: 12, fontSize: 16, color: C.dark, borderWidth: 1, borderColor: C.border },
  btn: { backgroundColor: C.primary, borderRadius: R.md, padding: 14, alignItems: 'center' },
  btnOff: { backgroundColor: C.border },
  btnText: { color: C.white, fontWeight: '700', fontSize: 15 },
  statusCard: { backgroundColor: C.white, borderRadius: R.lg, padding: S.xl, alignItems: 'center', gap: S.sm, marginBottom: S.md, borderWidth: 1, borderColor: C.border },
  statusTitle: { fontSize: 17, fontWeight: '700', color: C.dark },
  statusSub: { fontSize: 13, color: C.mid, textAlign: 'center', lineHeight: 22 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.white, fontWeight: '800', fontSize: 20 },
  foundName: { fontSize: 17, fontWeight: '700', color: C.dark },
  foundSub: { fontSize: 13, color: C.mid, marginTop: 2 },
  foundBadge: { fontSize: 12, color: C.primary, marginTop: 2 },
  anotherBtn: { backgroundColor: C.primaryBg, borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  anotherBtnText: { color: C.primary, fontWeight: '700', fontSize: 14 },
  linkBox: { backgroundColor: C.bg, borderRadius: R.md, padding: 14, borderWidth: 1, borderColor: C.border },
  linkText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  // Modal styles
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: S.lg, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  typeRow: { flexDirection: 'row', gap: S.md },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: R.md, alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  typeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: C.mid },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: C.mid, marginBottom: S.md },
  monthsGrid: { gap: S.sm },
  monthBtn: { backgroundColor: C.white, borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  monthBtnText: { fontSize: 15, fontWeight: '600', color: C.dark },
  monthSubText: { fontSize: 12, color: C.mid },
  dateInput: { backgroundColor: C.white, borderRadius: R.md, padding: 14, fontSize: 16, color: C.dark, borderWidth: 1, borderColor: C.border },
  datePreview: { fontSize: 13, color: C.primary, marginTop: 8, fontWeight: '500' },
});
