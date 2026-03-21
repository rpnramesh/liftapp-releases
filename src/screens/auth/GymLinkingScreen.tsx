// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — TS-005 Gym Linking / Freelance Setup
// ─────────────────────────────────────────────────────────────────────────────

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AuthStackParamList } from '../../navigation/TrainerNavigator';
import { AuthAPI } from '../../services/mockApi';

import { PrimaryButton } from '../../components/common';
import { C } from '../../constants/theme';
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

  // Stub — get token from SecureStore in production
  const token = '';

  const handleGymLink = async () => {
    const code = normaliseGymCode(gymCode);
    if (!isValidGymCode(code)) {
      setError('Enter a valid gym code (letters and numbers only)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await AuthAPI.linkGym(trainerId, code, token);
      setGymName(res.gymName);
      setPath('gym_success');
    } catch (e: any) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setError('Code not found after 3 attempts. Tap below to contact Lift support.');
      } else if (e?.status === 409) {
        Alert.alert('Conflict', 'This gym is linked to another account with the same phone.');
      } else if (e?.status === 403) {
        setError("This gym's trainer limit has been reached. Contact Lift support.");
      } else {
        setError('Code not found. Please check with your gym admin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFreelanceSetup = async () => {
    const fee = Number(monthlyFee);
    if (!fee || fee < 100) {
      setError('Enter a valid monthly fee (min ₹100)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await AuthAPI.setupFreelance(trainerId, fee, token);
      const linkRes = await AuthAPI.getInviteLink(trainerId, token);
      setInviteLink(linkRes.inviteLink);
      setPath('freelance_success');
    } catch (e: any) {
      setError(e.message ?? 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareInviteLink = async () => {
    await Share.share({
      message: `Hi! I'm inviting you to join my training program on Lift. Click this link to sign up: ${inviteLink}`,
    });
  };

  const copyLink = () => {
    Clipboard.setString(inviteLink);
    Alert.alert('Copied!', 'Invite link copied to clipboard.');
  };

  const goToDashboard = () => navigation.replace('Main' as any);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Choose path ── */}
        {path === 'choose' && (
          <>
            <Text style={styles.title}>How would you like to work?</Text>
            <Text style={styles.subtitle}>You can change this later from your profile.</Text>
            <View style={styles.cards}>
              <TouchableOpacity style={styles.card} onPress={() => setPath('gym')} activeOpacity={0.85}>
                <Text style={styles.cardIcon}>🏛</Text>
                <Text style={styles.cardTitle}>Join a Gym</Text>
                <Text style={styles.cardDesc}>Enter your gym's invite code to link your account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.card} onPress={() => setPath('freelance')} activeOpacity={0.85}>
                <Text style={styles.cardIcon}>🌟</Text>
                <Text style={styles.cardTitle}>Go Freelance</Text>
                <Text style={styles.cardDesc}>Manage your own clients independently with Razorpay payments</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ marginTop: 16, alignSelf: 'center' }} onPress={goToDashboard}>
              <Text style={styles.skipText}>Skip for now — I'll set this up later</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Gym code entry ── */}
        {path === 'gym' && (
          <>
            <TouchableOpacity onPress={() => setPath('choose')}><Text style={styles.back}>← Back</Text></TouchableOpacity>
            <Text style={styles.title}>Enter Gym Code</Text>
            <Text style={styles.subtitle}>Ask your gym admin for the invite code.</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="e.g. GYM12345"
              value={gymCode}
              onChangeText={v => { setGymCode(normaliseGymCode(v)); setError(''); }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
            {attempts >= 3 && (
              <TouchableOpacity onPress={() => {/* open WhatsApp to Lift support */}}>
                <Text style={styles.supportLink}>Contact Lift Support on WhatsApp →</Text>
              </TouchableOpacity>
            )}
            <PrimaryButton label="Link Gym" onPress={handleGymLink} loading={loading} />
          </>
        )}

        {/* ── Gym link success ── */}
        {path === 'gym_success' && (
          <>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.title}>You're linked to{'\n'}{gymName}!</Text>
            <Text style={styles.subtitle}>Your gym admin can now assign members to you.</Text>
            <PrimaryButton label="Go to Dashboard" onPress={goToDashboard} />
          </>
        )}

        {/* ── Freelance setup ── */}
        {path === 'freelance' && (
          <>
            <TouchableOpacity onPress={() => setPath('choose')}><Text style={styles.back}>← Back</Text></TouchableOpacity>
            <Text style={styles.title}>Set Your Monthly Fee</Text>
            <Text style={styles.subtitle}>This is what your freelance clients will be charged each month.</Text>
            <View style={styles.feeRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={[styles.input, { flex: 1 }, error && styles.inputError]}
                placeholder="e.g. 2500"
                keyboardType="number-pad"
                value={monthlyFee}
                onChangeText={v => { setMonthlyFee(v); setError(''); }}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <PrimaryButton label="Set Up Freelance" onPress={handleFreelanceSetup} loading={loading} />
          </>
        )}

        {/* ── Freelance success ── */}
        {path === 'freelance_success' && (
          <>
            <Text style={styles.successEmoji}>🌟</Text>
            <Text style={styles.title}>You're set up as a Freelance Trainer!</Text>
            <Text style={styles.subtitle}>Share your invite link to start onboarding clients.</Text>
            <View style={styles.linkCard}>
              <Text style={styles.linkText} numberOfLines={2}>{inviteLink}</Text>
            </View>
            <View style={styles.shareRow}>
              <TouchableOpacity style={styles.shareBtn} onPress={shareInviteLink}>
                <Text style={styles.shareBtnText}>📲 Share on WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtn, styles.copyBtn]} onPress={copyLink}>
                <Text style={[styles.shareBtnText, { color: C.primary }]}>📋 Copy Link</Text>
              </TouchableOpacity>
            </View>
            <PrimaryButton label="Go to Dashboard" onPress={goToDashboard} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: C.dark, marginBottom: 6, marginTop: 8 },
  subtitle: { fontSize: 14, color: C.mid, marginBottom: 24, lineHeight: 20 },
  back: { color: C.primary, fontSize: 15, fontWeight: '500', marginBottom: 16 },
  cards: { gap: 14 },
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  cardIcon: { fontSize: 32 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: C.dark },
  cardDesc: { fontSize: 13, color: C.mid, lineHeight: 18 },
  skipText: { color: C.light, fontSize: 13, textDecorationLine: 'underline' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: C.dark,
    backgroundColor: C.white,
    marginBottom: 12,
  },
  inputError: { borderColor: C.red },
  errorText: { color: C.red, fontSize: 13, marginBottom: 12 },
  supportLink: { color: C.primary, textDecorationLine: 'underline', fontSize: 13, marginBottom: 16 },
  successEmoji: { fontSize: 52, marginBottom: 12, textAlign: 'center' },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupee: { fontSize: 20, fontWeight: '700', color: '#374151' },
  linkCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  linkText: { fontSize: 13, color: '#374151' },
  shareRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  shareBtn: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  copyBtn: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.primary },
  shareBtnText: { color: C.white, fontWeight: '600', fontSize: 14 },
});
