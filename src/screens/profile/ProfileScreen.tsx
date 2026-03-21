// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-019 Trainer Profile & Settings
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Alert, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfileAPI } from '../../services/mockApi';
import { SPECIALIZATIONS } from '../../constants/trainer.constants';
import { Avatar, SkeletonLoader, EmptyState, PrimaryButton, StatusBadge } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { TrainerProfile, CertificationStatus } from '../../types/trainer.types';

const TRAINER_ID = 'trainer-001';
const TOKEN = '';

const CERT_COLORS: Record<CertificationStatus, string> = {
  'Lift-Verified': C.green,
  'Pending Review': C.amber,
  'Not Verified': C.red,
};

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ml'>('en');
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(() => ProfileAPI.getProfile(TRAINER_ID, TOKEN), []);
  const { data: profile, loading, refresh } = useAsync<TrainerProfile>(fetchProfile);

  const [editForm, setEditForm] = useState<Partial<TrainerProfile>>({});
  const set = (k: keyof TrainerProfile, v: any) => setEditForm(prev => ({ ...prev, [k]: v }));

  const startEdit = () => {
    if (!profile) return;
    setEditForm({
      fullName: profile.fullName,
      bio: profile.bio,
      specializations: profile.specializations,
      yearsOfExperience: profile.yearsOfExperience,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await ProfileAPI.updateProfile(TRAINER_ID, editForm, TOKEN);
      setEditing(false);
      refresh();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        try {
          await ProfileAPI.logout('fcm_token_stub', TOKEN);
          navigation.replace('Auth');
        } catch (e) { navigation.replace('Auth'); }
      }},
    ]);
  };

  const handleLeaveGym = () => {
    Alert.alert('Leave Gym', 'Are you sure? Your gym admin will be notified and you\'ll be unlinked from all gym clients.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave Gym', style: 'destructive', onPress: async () => {
        try { await ProfileAPI.leaveGym(TRAINER_ID, TOKEN); refresh(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'Your account will be scheduled for deletion in 30 days. You can recover by logging back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        // Navigate to OTP confirmation
      }},
    ]);
  };

  const toggleSpec = (s: string) => {
    const cur = editForm.specializations ?? profile?.specializations ?? [];
    set('specializations', cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]);
  };

  if (loading && !profile) return <View style={styles.container}><SkeletonLoader height={200} /></View>;
  if (!profile) return <EmptyState emoji="⚠️" title="Failed to load profile" ctaLabel="Retry" onCTA={refresh} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={{ position: 'relative' }}>
          <Avatar uri={profile.profilePhotoUrl} name={profile.fullName} size={88} />
          <TouchableOpacity style={styles.photoEditBtn}>
            <Text style={styles.photoEditIcon}>📷</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.profileName}>{profile.fullName}</Text>
        {profile.isLifeVerified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓ Lift-Verified Trainer</Text>
          </View>
        )}
        <View style={styles.specializations}>
          {profile.specializations.slice(0, 3).map(s => (
            <View key={s} style={styles.specChip}><Text style={styles.specChipText}>{s}</Text></View>
          ))}
        </View>
        <TouchableOpacity style={styles.editProfileBtn} onPress={editing ? saveEdit : startEdit}>
          <Text style={styles.editProfileBtnText}>{editing ? (saving ? 'Saving…' : 'Save Changes') : 'Edit Profile'}</Text>
        </TouchableOpacity>
        {editing && (
          <TouchableOpacity onPress={() => setEditing(false)} style={{ marginTop: 6 }}>
            <Text style={{ color: C.mid, textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Edit form */}
      {editing && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Edit Profile</Text>
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput style={styles.input} value={editForm.fullName ?? ''} onChangeText={v => set('fullName', v)} />
          <Text style={styles.fieldLabel}>Bio ({(editForm.bio ?? '').length}/300)</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline maxLength={300} value={editForm.bio ?? ''} onChangeText={v => set('bio', v)} />
          <Text style={styles.fieldLabel}>Years of Experience</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={String(editForm.yearsOfExperience ?? '')} onChangeText={v => set('yearsOfExperience', parseInt(v) || 0)} />
          <Text style={styles.fieldLabel}>Specializations</Text>
          <View style={styles.specWrap}>
            {SPECIALIZATIONS.map(s => {
              const selected = (editForm.specializations ?? []).includes(s);
              return (
                <TouchableOpacity key={s} style={[styles.specSelectChip, selected && styles.specSelectChipActive]} onPress={() => toggleSpec(s)}>
                  <Text style={[styles.specSelectText, selected && { color: C.white }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Bio */}
      {!editing && profile.bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bioText}>{profile.bio}</Text>
          <Text style={styles.metaText}>{profile.yearsOfExperience} years of experience</Text>
        </View>
      )}

      {/* Certifications */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Certifications</Text>
          <TouchableOpacity>
            <Text style={styles.addCert}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {profile.certifications.length === 0 ? (
          <Text style={styles.emptyCert}>No certifications added yet.</Text>
        ) : (
          profile.certifications.map(cert => (
            <View key={cert.id} style={styles.certRow}>
              <View style={styles.certThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.certName}>{cert.name}</Text>
                <Text style={styles.certDate}>Uploaded {cert.uploadedAt.slice(0, 10)}</Text>
              </View>
              <StatusBadge label={cert.status} color={CERT_COLORS[cert.status]} />
            </View>
          ))
        )}
      </View>

      {/* My Gym */}
      {profile.gymId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Gym</Text>
          <Text style={styles.gymName}>{profile.gymName}</Text>
          {profile.gymAddress && <Text style={styles.gymAddress}>{profile.gymAddress}</Text>}
          <TouchableOpacity style={styles.leaveGymBtn} onPress={handleLeaveGym}>
            <Text style={styles.leaveGymText}>Leave Gym</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick links */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Earnings')}>
          <Text style={styles.menuLabel}>💰 My Earnings</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.menuLabel}>🔔 Notification Centre</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuRow} onPress={() => setShowSettings(s => !s)}>
          <Text style={styles.menuLabel}>⚙️ Settings</Text>
          <Text style={styles.menuArrow}>{showSettings ? '↑' : '›'}</Text>
        </TouchableOpacity>
      </View>

      {/* Settings */}
      {showSettings && (
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Language</Text>
            <View style={styles.langRow}>
              {(['en', 'ml'] as const).map(l => (
                <TouchableOpacity key={l} style={[styles.langChip, language === l && styles.langChipActive]} onPress={() => setLanguage(l)}>
                  <Text style={[styles.langText, language === l && { color: C.white }]}>{l.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: C.primary }} />
          </View>
          {profile.isFreelance && (
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Accept New Freelance Clients</Text>
                <Text style={styles.settingDesc}>When off, no new invites can be generated</Text>
              </View>
              <Switch value={profile.acceptingNewClients} trackColor={{ true: C.primary }} />
            </View>
          )}
        </View>
      )}

      {/* Danger zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  profileHeader: { backgroundColor: C.white, padding: 24, paddingTop: 52, alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  photoEditBtn: { position: 'absolute', bottom: 0, right: -4, backgroundColor: C.border, borderRadius: 12, padding: 4 },
  photoEditIcon: { fontSize: 14 },
  profileName: { fontSize: 22, fontWeight: '700', color: C.dark },
  verifiedBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  verifiedText: { color: C.green, fontSize: 12, fontWeight: '700' },
  specializations: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  specChip: { backgroundColor: C.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  specChipText: { fontSize: 12, color: C.primary, fontWeight: '500' },
  editProfileBtn: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  editProfileBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  section: { backgroundColor: C.white, marginTop: 10, padding: 16, gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.dark },
  addCert: { color: C.primary, fontWeight: '600', fontSize: 14 },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  metaText: { fontSize: 13, color: C.mid },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 15, color: C.dark, backgroundColor: C.bg },
  specWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specSelectChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: C.white },
  specSelectChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  specSelectText: { fontSize: 12, color: '#374151' },
  emptyCert: { fontSize: 13, color: C.light },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  certThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: C.border },
  certName: { fontSize: 14, fontWeight: '600', color: C.dark },
  certDate: { fontSize: 11, color: C.light },
  gymName: { fontSize: 16, fontWeight: '700', color: C.dark },
  gymAddress: { fontSize: 13, color: C.mid },
  leaveGymBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#FEE2E2', borderRadius: 8, alignSelf: 'flex-start' },
  leaveGymText: { color: C.red, fontWeight: '600', fontSize: 13 },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  menuLabel: { fontSize: 15, color: '#374151', fontWeight: '500' },
  menuArrow: { fontSize: 18, color: C.light },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  settingLabel: { fontSize: 15, color: '#374151', fontWeight: '500' },
  settingDesc: { fontSize: 12, color: C.light },
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  langChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  langText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  logoutBtn: { paddingVertical: 12, alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10 },
  logoutText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  deleteBtn: { paddingVertical: 12, alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 10 },
  deleteBtnText: { color: C.red, fontWeight: '600', fontSize: 15 },
});
