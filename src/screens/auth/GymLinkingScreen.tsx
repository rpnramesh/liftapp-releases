// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Gym Linking / Freelance Setup (Firebase)
// ─────────────────────────────────────────────────────────────────────────────
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert, Clipboard, KeyboardAvoidingView, Platform, ScrollView,
  Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { PrimaryButton } from '../../components/common';
import { C } from '../../constants/theme';
import { AuthStackParamList } from '../../navigation/TrainerNavigator';
import { AuthAPI } from '../../services/trainer.api';
import { isValidGymCode, normaliseGymCode } from '../../utils/trainer.utils';

type Props = NativeStackScreenProps<AuthStackParamList, 'GymLinking'>;
type Path = 'choose' | 'gym' | 'freelance' | 'gym_success' | 'freelance_success';

export default function GymLinkingScreen({ navigation, route }: Props) {
  const { trainerId } = route.params;
  const [path, setPath] = useState<Path>('choose');
  const [gymCode, setGymCode] = useState('');
  const [gymName, setGymName] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGymLink = async () => {
    const code = normaliseGymCode(gymCode);
    if (!isValidGymCode(code)) { setError('Enter a valid gym code (letters and numbers only)'); return; }
    setLoading(true); setError('');
    try {
      const res = await AuthAPI.linkGym(trainerId, code);
      setGymName(res.gymName);
      setPath('gym_success');
    } catch (e: any) {
      const n = attempts + 1; setAttempts(n);
      setError(n >= 3 ? 'Code not found after 3 attempts. Contact Lift support.' : 'Code not found. Please check with your gym admin.');
    } finally { setLoading(false); }
  };

  const handleFreelanceSetup = async () => {
    const fee = Number(monthlyFee);
    if (!fee || fee < 100) { setError('Enter a valid monthly fee (min ₹100)'); return; }
    setLoading(true); setError('');
    try {
      await AuthAPI.setupFreelance(trainerId, fee);
      const linkRes = await AuthAPI.getInviteLink(trainerId);
      setInviteLink(linkRes.inviteLink);
      setPath('freelance_success');
    } catch (e: any) {
      setError(e.message ?? 'Setup failed. Please try again.');
    } finally { setLoading(false); }
  };

  const goToDashboard = () => navigation.replace('Main' as any);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {path === 'choose' && (
          <>
            <Text style={s.title}>How would you like to work?</Text>
            <Text style={s.subtitle}>You can change this later from your profile.</Text>
            <View style={s.cards}>
              <TouchableOpacity style={s.card} onPress={() => setPath('gym')} activeOpacity={0.85}>
                <Text style={s.cardIcon}>🏛</Text>
                <Text style={s.cardTitle}>Join a Gym</Text>
                <Text style={s.cardDesc}>Enter your gym's invite code to link your account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.card} onPress={() => setPath('freelance')} activeOpacity={0.85}>
                <Text style={s.cardIcon}>🌟</Text>
                <Text style={s.cardTitle}>Go Freelance</Text>
                <Text style={s.cardDesc}>Manage your own clients independently</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ marginTop: 16, alignSelf: 'center' }} onPress={goToDashboard}>
              <Text style={s.skipText}>Skip for now — I'll set this up later</Text>
            </TouchableOpacity>
          </>
        )}

        {path === 'gym' && (
          <>
            <TouchableOpacity onPress={() => setPath('choose')}><Text style={s.back}>← Back</Text></TouchableOpacity>
            <Text style={s.title}>Enter Gym Code</Text>
            <Text style={s.subtitle}>Ask your gym admin for the invite code.</Text>
            <TextInput style={[s.input, error && s.inputError]} placeholder="e.g. GYM12345"
              value={gymCode} onChangeText={v => { setGymCode(normaliseGymCode(v)); setError(''); }}
              autoCapitalize="characters" autoCorrect={false} maxLength={10} />
            {!!error && <Text style={s.errorText}>{error}</Text>}
            <PrimaryButton label="Link Gym" onPress={handleGymLink} loading={loading} />
          </>
        )}

        {path === 'gym_success' && (
          <>
            <Text style={s.successEmoji}>🎉</Text>
            <Text style={s.title}>You're linked to{'\n'}{gymName}!</Text>
            <Text style={s.subtitle}>Your gym admin can now assign members to you.</Text>
            <PrimaryButton label="Go to Dashboard" onPress={goToDashboard} />
          </>
        )}

        {path === 'freelance' && (
          <>
            <TouchableOpacity onPress={() => setPath('choose')}><Text style={s.back}>← Back</Text></TouchableOpacity>
            <Text style={s.title}>Set Your Monthly Fee</Text>
            <Text style={s.subtitle}>This is what your freelance clients will be charged each month.</Text>
            <View style={s.feeRow}>
              <Text style={s.rupee}>₹</Text>
              <TextInput style={[s.input, { flex: 1 }, error && s.inputError]} placeholder="e.g. 2500"
                keyboardType="number-pad" value={monthlyFee}
                onChangeText={v => { setMonthlyFee(v); setError(''); }} />
            </View>
            {!!error && <Text style={s.errorText}>{error}</Text>}
            <PrimaryButton label="Set Up Freelance" onPress={handleFreelanceSetup} loading={loading} />
          </>
        )}

        {path === 'freelance_success' && (
          <>
            <Text style={s.successEmoji}>🌟</Text>
            <Text style={s.title}>You're set up as a Freelance Trainer!</Text>
            <Text style={s.subtitle}>Share your invite link to start onboarding clients.</Text>
            <View style={s.linkCard}><Text style={s.linkText} numberOfLines={2}>{inviteLink}</Text></View>
            <View style={s.shareRow}>
              <TouchableOpacity style={s.shareBtn} onPress={() => Share.share({ message: `Join my training on Lift: ${inviteLink}` })}>
                <Text style={s.shareBtnText}>📲 Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.shareBtn, s.copyBtn]} onPress={() => { Clipboard.setString(inviteLink); Alert.alert('Copied!'); }}>
                <Text style={[s.shareBtnText, { color: C.primary }]}>📋 Copy Link</Text>
              </TouchableOpacity>
            </View>
            <PrimaryButton label="Go to Dashboard" onPress={goToDashboard} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: C.dark, marginBottom: 6, marginTop: 8 },
  subtitle: { fontSize: 14, color: C.mid, marginBottom: 24, lineHeight: 20 },
  back: { color: C.primary, fontSize: 15, fontWeight: '500', marginBottom: 16 },
  cards: { gap: 14 },
  card: { backgroundColor: C.white, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: C.border, gap: 6 },
  cardIcon: { fontSize: 32 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: C.dark },
  cardDesc: { fontSize: 13, color: C.mid, lineHeight: 18 },
  skipText: { color: C.mid, fontSize: 13, textDecorationLine: 'underline' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 16, color: C.dark, backgroundColor: C.white, marginBottom: 12 },
  inputError: { borderColor: C.red },
  errorText: { color: C.red, fontSize: 13, marginBottom: 12 },
  successEmoji: { fontSize: 52, marginBottom: 12, textAlign: 'center' },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupee: { fontSize: 20, fontWeight: '700', color: '#374151' },
  linkCard: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 14, marginBottom: 16 },
  linkText: { fontSize: 13, color: '#374151' },
  shareRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  shareBtn: { flex: 1, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  copyBtn: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.primary },
  shareBtnText: { color: C.white, fontWeight: '600', fontSize: 14 },
});
