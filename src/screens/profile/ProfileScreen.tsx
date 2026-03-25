// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Profile Screen
// Fixes: phone change via OTP, name updates propagate, all fields save
// ─────────────────────────────────────────────────────────────────────────────
import { useFocusEffect } from '@react-navigation/native';
import { signInWithPhoneNumber } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { PrimaryButton } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import KeyboardSafeView from '../../components/ui/KeyboardSafeView';
import { C, R, S } from '../../constants/theme';
import { SPECIALIZATIONS } from '../../constants/trainer.constants';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebase/config';
import { ProfileAPI } from '../../services/trainer.api';

export default function ProfileScreen() {
  const { trainerId, logout, reloadProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [phoneModal, setPhoneModal] = useState(false);

  const loadProfile = useCallback(async () => {
    const id = trainerId;
    if (!id) { setError('Not logged in'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const p = await ProfileAPI.getProfile(id);
      setProfile(p);
      setDraft({
        fullName: p.fullName ?? '',
        phone: p.phone ?? '',
        age: String(p.age ?? ''),
        bio: p.bio ?? '',
        yearsOfExperience: String(p.yearsOfExperience ?? ''),
        specializations: p.specializations ?? [],
        acceptingNewClients: p.acceptingNewClients ?? true,
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load profile');
    } finally { setLoading(false); }
  }, [trainerId]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const saveField = async (field: string, value: any) => {
    if (!trainerId) return;
    setSaving(true);
    try {
      const update: any = { [field]: value };
      // Keep name in sync for backward compat
      if (field === 'fullName') update.name = value;
      await ProfileAPI.updateProfile(trainerId, update);
      setProfile((prev: any) => ({ ...prev, ...update }));
      // Reload profile in AuthContext so dashboard name updates too
      await reloadProfile();
      setEditingField(null);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message ?? 'Could not save changes');
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const toggleSpec = (s: string) => {
    const current = draft.specializations ?? [];
    const updated = current.includes(s)
      ? current.filter((x: string) => x !== s)
      : [...current, s];
    setDraft((prev: any) => ({ ...prev, specializations: updated }));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={styles.centered}>
        <IconSymbol name="exclamationmark.triangle.fill" size={40} color="#F59E0B" />
        <Text style={styles.errorTitle}>Failed to load profile</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProfile} tintColor={C.primary} />}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.fullName ?? profile?.name ?? '?')[0]?.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.headerName}>{profile?.fullName ?? profile?.name ?? 'Trainer'}</Text>
        <View style={styles.roleBadge}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconSymbol name={profile?.adminAccess ? 'shield' : 'figure.strengthtraining.traditional' as any} size={14} color={C.primary} />
            <Text style={[styles.roleBadgeText, { marginLeft: 8 }]}>
              {profile?.adminAccess ? 'Admin + Trainer' : 'Trainer'}
            </Text>
          </View>
        </View>
        {profile?.gymName && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconSymbol name="location" size={12} color={C.mid} />
            <Text style={[styles.gymText, { marginLeft: 6 }]}>{profile.gymName}</Text>
          </View>
        )}
        {profile?.isFreelance && !profile?.gymName && <Text style={styles.gymText}>Freelance Trainer</Text>}
      </View>

      {/* Personal Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PERSONAL INFO</Text>

        <EditRow label="Full Name" value={draft.fullName}
          editing={editingField === 'fullName'}
          onEdit={() => setEditingField('fullName')}
          onChange={v => setDraft((p: any) => ({ ...p, fullName: v }))}
          onSave={() => saveField('fullName', draft.fullName)}
          onCancel={() => { setDraft((p: any) => ({ ...p, fullName: profile.fullName })); setEditingField(null); }}
          saving={saving} />

        {/* Phone — tapping opens OTP flow */}
        <View style={styles.editRow}>
          <Text style={styles.editRowLabel}>Phone</Text>
          <View style={styles.editRowRight}>
            <Text style={styles.editRowValue}>{profile?.phone ?? '—'}</Text>
            <TouchableOpacity onPress={() => setPhoneModal(true)} style={{ padding: 6 }}>
              <IconSymbol name="pencil" size={14} color={C.mid} />
            </TouchableOpacity>
          </View>
        </View>

        <EditRow label="Age" value={draft.age} keyboardType="number-pad"
          editing={editingField === 'age'}
          onEdit={() => setEditingField('age')}
          onChange={v => setDraft((p: any) => ({ ...p, age: v }))}
          onSave={() => saveField('age', Number(draft.age) || 0)}
          onCancel={() => { setDraft((p: any) => ({ ...p, age: String(profile.age) })); setEditingField(null); }}
          saving={saving} />

        <EditRow label="Experience (years)" value={draft.yearsOfExperience} keyboardType="number-pad"
          editing={editingField === 'yearsOfExperience'}
          onEdit={() => setEditingField('yearsOfExperience')}
          onChange={v => setDraft((p: any) => ({ ...p, yearsOfExperience: v }))}
          onSave={() => saveField('yearsOfExperience', Number(draft.yearsOfExperience) || 0)}
          onCancel={() => { setDraft((p: any) => ({ ...p, yearsOfExperience: String(profile.yearsOfExperience) })); setEditingField(null); }}
          saving={saving} />
      </View>

      {/* Bio */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BIO</Text>
        <View style={styles.bioCard}>
          {editingField === 'bio' ? (
            <>
              <TextInput style={styles.bioInput} value={draft.bio}
                onChangeText={v => setDraft((p: any) => ({ ...p, bio: v }))}
                multiline maxLength={300} autoFocus />
              <View style={styles.bioActions}>
                <TouchableOpacity onPress={() => { setDraft((p: any) => ({ ...p, bio: profile.bio })); setEditingField(null); }}>
                  <Text style={{ color: C.mid, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={() => saveField('bio', draft.bio)} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setEditingField('bio')}>
              <Text style={styles.bioText}>{profile?.bio || 'Tap to add a bio…'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol name="pencil" size={12} color={C.mid} />
                <Text style={styles.editHint}>Tap to edit</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Specializations */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>SPECIALIZATIONS</Text>
          {editingField === 'specializations' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => { setDraft((p: any) => ({ ...p, specializations: profile.specializations })); setEditingField(null); }}>
                <Text style={{ color: C.mid, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => saveField('specializations', draft.specializations)} disabled={saving}>
                <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
              <TouchableOpacity onPress={() => setEditingField('specializations')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol name="pencil" size={14} color={C.primary} />
                <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Edit</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.specWrap}>
          {SPECIALIZATIONS.map(s => {
            const active = (editingField === 'specializations' ? draft.specializations : profile?.specializations ?? []).includes(s);
            return (
              <TouchableOpacity key={s}
                style={[styles.specChip, active && styles.specChipActive]}
                onPress={() => editingField === 'specializations' && toggleSpec(s)}
                disabled={editingField !== 'specializations'}>
                <Text style={[styles.specText, active && { color: C.white }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Accepting clients */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AVAILABILITY</Text>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Accepting New Clients</Text>
            <Text style={styles.toggleSub}>Show/hide your profile to new clients</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, profile?.acceptingNewClients && styles.toggleOn]}
            onPress={() => saveField('acceptingNewClients', !profile.acceptingNewClients)}>
            <View style={[styles.toggleKnob, profile?.acceptingNewClients && styles.toggleKnobOn]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Gym */}
      {(profile?.gymId || profile?.gymName) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GYM</Text>
          <View style={styles.gymCard}>
            <Text style={styles.gymName}>{profile.gymName ?? 'Linked Gym'}</Text>
            <TouchableOpacity onPress={() => Alert.alert('Leave Gym', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: async () => { await ProfileAPI.leaveGym(trainerId); loadProfile(); } },
            ])}>
              <Text style={{ color: C.red, fontSize: 13, fontWeight: '600' }}>Leave Gym</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Logout */}
      <View style={{ padding: S.lg, paddingBottom: 40 }}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Phone change modal */}
      {phoneModal && (
        <PhoneChangeModal
          currentPhone={profile?.phone ?? ''}
          trainerId={trainerId}
          onClose={() => setPhoneModal(false)}
          onSuccess={(newPhone) => {
            setProfile((p: any) => ({ ...p, phone: newPhone }));
            setPhoneModal(false);
            Alert.alert('Phone Updated', 'Your phone number has been updated successfully.');
          }}
        />
      )}
    </ScrollView>
  );
}

// ─── Phone Change Modal ───────────────────────────────────────────────────────
function PhoneChangeModal({ currentPhone, trainerId, onClose, onSuccess }: any) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);

  React.useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const sendOTP = async () => {
    if (phone.length < 10) { setError('Enter a valid 10-digit number'); return; }
    const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
    if (formatted === currentPhone) { setError('This is already your current number'); return; }
    setLoading(true); setError('');
    try {
      const result = await signInWithPhoneNumber(auth, formatted, {
        type: 'recaptcha',
        verify() { return Promise.resolve('profile-phone-change'); },
        _reset() {}, clear() {},
      } as any);
      setConfirmation(result);
      setStep('otp');
      setTimer(30);
    } catch (e: any) {
      setError('Failed to send OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      // Verify OTP and get credential
      const credential = await confirmation.confirm(otp);
      const newPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      // Update phone in Firestore
      await updateDoc(doc(db, 'trainers', trainerId), { phone: newPhone, updatedAt: Date.now() });
      onSuccess(newPhone);
    } catch (e: any) {
      setError('Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardSafeView style={{ flex: 1 }}>
        <View style={pm.container}>
          <View style={pm.header}>
            <Text style={pm.title}>Change Phone Number</Text>
            <TouchableOpacity onPress={onClose}><IconSymbol name="xmark" size={16} color={C.mid} /></TouchableOpacity>
          </View>

          <Text style={pm.current}>Current: {currentPhone}</Text>

          {step === 'phone' ? (
            <>
              <Text style={pm.label}>New Mobile Number</Text>
              <View style={pm.phoneRow}>
                <Text style={pm.prefix}>+91</Text>
                <TextInput style={pm.input} placeholder="10-digit number"
                  placeholderTextColor={C.mid} keyboardType="phone-pad" maxLength={10}
                  value={phone} onChangeText={v => { setPhone(v); setError(''); }} autoFocus />
              </View>
              {!!error && <Text style={pm.error}>{error}</Text>}
              <PrimaryButton label="Send OTP" onPress={sendOTP} loading={loading} />
            </>
          ) : (
            <>
              <Text style={pm.label}>Enter OTP sent to +91 {phone}</Text>
              <TextInput style={pm.otpInput} placeholder="6-digit OTP"
                placeholderTextColor={C.mid} keyboardType="number-pad" maxLength={6}
                value={otp} onChangeText={v => { setOtp(v); setError(''); }} autoFocus />
              {!!error && <Text style={pm.error}>{error}</Text>}
              <PrimaryButton label="Verify & Update" onPress={verifyOTP} loading={loading} />
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 12 }}
                onPress={sendOTP} disabled={timer > 0}>
                <Text style={[pm.resend, timer > 0 && { color: C.mid }]}>
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 8 }}
                onPress={() => { setStep('phone'); setOtp(''); setError(''); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconSymbol name="chevron.left" size={14} color={C.mid} />
                  <Text style={pm.resend}>Change number</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

// ─── EditRow ──────────────────────────────────────────────────────────────────
function EditRow({ label, value, editing, onEdit, onChange, onSave, onCancel, saving, keyboardType = 'default' }: any) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.editRowLabel}>{label}</Text>
      {editing ? (
        <View style={styles.editRowRight}>
          <TextInput style={styles.editRowInput} value={value} onChangeText={onChange}
            keyboardType={keyboardType} autoFocus onSubmitEditing={onSave} />
          <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? '…' : '✓'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={{ padding: 6 }}>
            <IconSymbol name="xmark" size={16} color={C.mid} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.editRowRight}>
          <Text style={styles.editRowValue}>{value || '—'}</Text>
          <TouchableOpacity onPress={onEdit} style={{ padding: 4 }}>
            <IconSymbol name="pencil" size={14} color={C.mid} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { color: C.mid, fontSize: 14, marginTop: 8 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: C.dark, textAlign: 'center' },
  errorSub: { fontSize: 13, color: C.mid, textAlign: 'center' },
  retryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: C.white, fontWeight: '700' },
  header: { alignItems: 'center', padding: 28, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 34, fontWeight: '800', color: C.white },
  headerName: { fontSize: 22, fontWeight: '800', color: C.dark },
  roleBadge: { backgroundColor: C.primaryBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 6 },
  roleBadgeText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  gymText: { fontSize: 13, color: C.mid, marginTop: 4 },
  section: { backgroundColor: C.white, marginTop: 12, paddingHorizontal: S.lg, paddingVertical: S.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.mid, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: S.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  editRowLabel: { fontSize: 14, color: C.mid, flex: 1 },
  editRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 2, justifyContent: 'flex-end' },
  editRowValue: { fontSize: 14, fontWeight: '600', color: C.dark },
  editRowInput: { fontSize: 14, fontWeight: '600', color: C.dark, borderBottomWidth: 1.5, borderBottomColor: C.primary, paddingVertical: 2, paddingHorizontal: 4, minWidth: 80, textAlign: 'right' },
  saveBtn: { backgroundColor: C.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  saveBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  bioCard: { backgroundColor: C.bg, borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: C.border },
  bioText: { fontSize: 14, color: C.dark, lineHeight: 22 },
  editHint: { fontSize: 11, color: C.mid, marginTop: 6 },
  bioInput: { fontSize: 14, color: C.dark, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  bioActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  specWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: C.white },
  specChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  specText: { fontSize: 12, color: '#374151' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: C.dark },
  toggleSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.border, justifyContent: 'center', padding: 3 },
  toggleOn: { backgroundColor: C.primary },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.white },
  toggleKnobOn: { alignSelf: 'flex-end' },
  gymCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  gymName: { fontSize: 15, fontWeight: '600', color: C.dark },
  logoutBtn: { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 17, alignItems: 'center' },
  logoutText: { color: C.red, fontWeight: '700', fontSize: 16 },
});

const pm = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white, padding: S.lg, paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
  title: { fontSize: 20, fontWeight: '700', color: C.dark },
  current: { fontSize: 13, color: C.mid, marginBottom: S.lg, backgroundColor: C.bg, padding: 10, borderRadius: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  prefix: { fontSize: 16, fontWeight: '600', color: '#374151' },
  input: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 16, color: C.dark, backgroundColor: C.white },
  otpInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 18, fontSize: 24, color: C.dark, textAlign: 'center', letterSpacing: 8, marginBottom: 12 },
  error: { color: C.red, fontSize: 13, marginBottom: 8 },
  resend: { color: C.primary, fontSize: 14, fontWeight: '500' },
});
