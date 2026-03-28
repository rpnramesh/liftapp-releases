// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Auth Screens (Firebase)
// Fixes: profile save, duplicate phone check, OTP flow
// ─────────────────────────────────────────────────────────────────────────────
import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { onAuthStateChanged, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert, Animated, BackHandler,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
    View,
} from 'react-native';
import { PrimaryButton } from '../../components/common';
import PhoneAuthWebView, { PhoneAuthHandle } from '../../components/common/PhoneAuthWebView';
import { IconSymbol } from '../../components/ui/icon-symbol';
import KeyboardSafeView from '../../components/ui/KeyboardSafeView';
import { C } from '../../constants/theme';
import { SPECIALIZATIONS } from '../../constants/trainer.constants';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebase/config';
import { AuthStackParamList } from '../../navigation/TrainerNavigator';
import { isValidIndianPhone, isValidOTP } from '../../utils/trainer.utils';

// ── Navigation helper: reset to Main (works across nested navigators) ─────────
function resetToMain(navigation: any) {
  navigation.dispatch(
    CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })
  );
}
function resetToGymLinking(navigation: any, trainerId: string) {
  navigation.dispatch(
    CommonActions.reset({ index: 0, routes: [{ name: 'Auth', state: { routes: [{ name: 'GymLinking', params: { trainerId } }] } }] })
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────
type SplashProps = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: SplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setTimeout(() => navigation.replace('Welcome'), 1500); return; }
      const snap = await getDoc(doc(db, 'trainers', user.uid)).catch(() => null);
      if (!snap?.exists()) { setTimeout(() => navigation.replace('Registration'), 1500); return; }
      const data = snap.data();
      if (!data.gymId && !data.isFreelance) {
        setTimeout(() => resetToGymLinking(navigation, user.uid), 1500);
        return;
      }
      setTimeout(() => resetToMain(navigation), 1500);
    });
    const timeout = setTimeout(() => { unsub(); navigation.replace('Welcome'); }, 5000);
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  return (
    <View style={ss.container}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Text style={ss.wordmark}>LIFT</Text>
        <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
      </Animated.View>
    </View>
  );
}
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 48, fontWeight: '800', color: C.primary, letterSpacing: 6 },
  tagline: { fontSize: 13, color: C.mid, marginTop: 8, textAlign: 'center' },
});

// ─── Welcome ──────────────────────────────────────────────────────────────────
type WelcomeProps = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: WelcomeProps) {
  useEffect(() => {
    const onBack = () => { BackHandler.exitApp(); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);
  return (
    <View style={ws.container}>
      <View style={ws.overlay} />
      <View style={ws.content}>
        <Text style={ws.logo}>LIFT</Text>
        <Text style={ws.tagline}>Manage your clients.{'\n'}Grow your fitness business.</Text>
        <View style={ws.buttons}>
          <PrimaryButton label="Register as Trainer" onPress={() => navigation.navigate('Registration')} />
          <PrimaryButton label="Log In" onPress={() => navigation.navigate('OTP', { phone: '', isNewUser: false })} variant="outlined" />
        </View>
        <TouchableOpacity style={{ marginTop: 24 }}>
          <Text style={ws.memberLink}>Are you a gym member? Download the Lift Member App</Text>
        </TouchableOpacity>
      </View>
      <View style={ws.langToggle}><Text style={ws.langText}>EN | ML</Text></View>
    </View>
  );
}
const ws = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.primary },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,116,144,0.6)' },
  content: { flex: 1, padding: 32, justifyContent: 'flex-end', paddingBottom: 56, gap: 16 },
  logo: { fontSize: 42, fontWeight: '800', color: C.white, letterSpacing: 6, marginBottom: 8 },
  tagline: { fontSize: 20, color: C.white, fontWeight: '600', lineHeight: 28, marginBottom: 16 },
  buttons: { gap: 12 },
  memberLink: { color: '#CFFAFE', textDecorationLine: 'underline', fontSize: 13, textAlign: 'center' },
  langToggle: { position: 'absolute', top: 52, right: 20 },
  langText: { color: C.white, fontWeight: '600', fontSize: 13 },
});

// ─── Registration ─────────────────────────────────────────────────────────────
type RegProps = NativeStackScreenProps<AuthStackParamList, 'Registration'>;

export function RegistrationScreen({ navigation }: RegProps) {
  const [form, setForm] = useState({
    fullName: '', phone: '', age: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    yearsOfExperience: '', bio: '', specializations: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };
  const toggleSpec = (s: string) => setForm(prev => ({
    ...prev,
    specializations: prev.specializations.includes(s)
      ? prev.specializations.filter(x => x !== s)
      : [...prev.specializations, s],
  }));
  const validate = () => {
    const e: any = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!isValidIndianPhone(form.phone)) e.phone = 'Enter a valid 10-digit mobile number';
    if (!form.age || isNaN(Number(form.age))) e.age = 'Enter a valid age';
    if (form.specializations.length === 0) e.specializations = 'Select at least one specialization';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Check if phone already registered as trainer
      const formattedPhone = `+91${form.phone.trim()}`;
      const trainerQ = query(collection(db, 'trainers'), where('phone', '==', formattedPhone));
      const trainerSnap = await getDocs(trainerQ);
      if (!trainerSnap.empty) {
        Alert.alert(
          'Already Registered',
          'This phone number is already registered as a trainer.',
          [
            { text: 'Log In Instead', onPress: () => navigation.navigate('OTP', { phone: form.phone.trim(), isNewUser: false }) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        setLoading(false);
        return;
      }
      // Check if phone registered as member
      const memberQ = query(collection(db, 'members'), where('phone', '==', formattedPhone));
      const memberSnap = await getDocs(memberQ);
      if (!memberSnap.empty) {
        Alert.alert(
          'Already a Member',
          'This phone number is registered as a gym member. Please use the Lift Member App instead.',
          [{ text: 'OK', style: 'cancel' }]
        );
        setLoading(false);
        return;
      }

      navigation.navigate('OTP', {
        phone: form.phone.trim(),
        isNewUser: true,
        registrationData: {
          fullName: form.fullName.trim(),
          age: Number(form.age),
          gender: form.gender,
          specializations: form.specializations,
          yearsOfExperience: Number(form.yearsOfExperience) || 0,
          bio: form.bio,
        },
      });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardSafeView style={{ flex: 1 }}>
      <ScrollView style={rs.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={rs.backBtn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconSymbol name="chevron.left" size={16} color={C.primary} />
            <Text style={rs.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={rs.title}>Create Trainer Account</Text>
        <Text style={rs.subtitle}>Build your professional profile on Lift</Text>

        <Field label="Full Name *" error={errors.fullName}>
          <TextInput style={[inp, errors.fullName && inpErr]} placeholder="Your full name"
            value={form.fullName} onChangeText={v => set('fullName', v)} />
        </Field>

        <Field label="Mobile Number *" error={errors.phone}>
          <View style={rs.phoneRow}>
            <Text style={rs.phonePrefix}>+91</Text>
            <TextInput style={[inp, { flex: 1 }, errors.phone && inpErr]}
              placeholder="10-digit mobile number" keyboardType="number-pad" maxLength={10}
              value={form.phone} onChangeText={v => set('phone', v)} />
          </View>
        </Field>

        <View style={rs.row}>
          <Field label="Age *" error={errors.age} style={{ flex: 1 }}>
            <TextInput style={[inp, errors.age && inpErr]} keyboardType="number-pad"
              maxLength={3} value={form.age} onChangeText={v => set('age', v)} placeholder="Age" />
          </Field>
          <Field label="Experience (yrs)" style={{ flex: 1 }}>
            <TextInput style={inp} keyboardType="number-pad" maxLength={2}
              value={form.yearsOfExperience} onChangeText={v => set('yearsOfExperience', v)} placeholder="Years" />
          </Field>
        </View>

        <Field label="Gender">
          <View style={rs.genderRow}>
            {(['Male', 'Female', 'Other'] as const).map(g => (
              <TouchableOpacity key={g}
                style={[rs.genderBtn, form.gender === g && rs.genderBtnActive]}
                onPress={() => setForm(prev => ({ ...prev, gender: g }))}>
                <Text style={[rs.genderText, form.gender === g && { color: C.primary, fontWeight: '600' }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Specializations *" error={errors.specializations}>
          <View style={rs.specWrap}>
            {SPECIALIZATIONS.map(s => (
              <TouchableOpacity key={s}
                style={[rs.specChip, form.specializations.includes(s) && rs.specChipActive]}
                onPress={() => toggleSpec(s)}>
                <Text style={[rs.specText, form.specializations.includes(s) && { color: C.white }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label={`Bio (${form.bio.length}/300)`}>
          <TextInput style={[inp, { height: 90, textAlignVertical: 'top' }]}
            placeholder="Tell your clients about your training style…"
            multiline maxLength={300} value={form.bio} onChangeText={v => set('bio', v)} />
        </Field>

        <PrimaryButton label="Continue to OTP" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </KeyboardSafeView>
  );
}
const rs = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 20 },
  backBtn: { marginTop: 8, marginBottom: 4 },
  backText: { color: C.primary, fontSize: 15, fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '700', color: C.dark, marginBottom: 4, marginTop: 8 },
  subtitle: { fontSize: 14, color: C.mid, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 12 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phonePrefix: { fontSize: 15, color: '#374151', fontWeight: '600' },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  genderBtnActive: { borderColor: C.primary, backgroundColor: C.primary + '10' },
  genderText: { color: '#374151', fontSize: 14 },
  specWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: C.white },
  specChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  specText: { fontSize: 12, color: '#374151' },
});

// ─── OTP ──────────────────────────────────────────────────────────────────────
type OTPProps = NativeStackScreenProps<AuthStackParamList, 'OTP'>;

export function OTPScreen({ navigation, route }: OTPProps) {
  const { phone: initialPhone, isNewUser, registrationData } = (route.params ?? {}) as any;
  const { setSession } = useAuth();
  const phoneAuthRef = useRef<PhoneAuthHandle>(null);
  const [phone, setPhone] = useState(initialPhone || '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [webviewReady, setWebviewReady] = useState(false);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const sendOTP = async () => {
    if (!isValidIndianPhone(phone)) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true); setError('');
    try {
      const vId = await phoneAuthRef.current?.sendOtp(`+91${phone}`);
      if (!vId) throw new Error('Failed to send OTP');
      setVerificationId(vId);
      setStep('otp');
      setTimer(30);
    } catch (e: any) {
      if (e?.message?.includes('too-many-requests') || e?.message?.includes('Too many'))
        setError('Too many attempts. Please try again later.');
      else setError(e?.message || 'Failed to send OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (!isValidOTP(otp)) { setError('Enter the 6-digit OTP'); return; }
    if (!verificationId) { setError('Please request OTP first'); return; }
    setLoading(true); setError('');
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(auth, credential);
      const user = result.user;
      const uid = user.uid;
      const token = await user.getIdToken();

      // Build full profile data
      const profileData = {
        id: uid,
        phone: `+91${phone}`,
        fullName: registrationData?.fullName ?? '',
        name: registrationData?.fullName ?? '', // legacy field
        age: registrationData?.age ?? 0,
        gender: registrationData?.gender ?? 'Male',
        specializations: registrationData?.specializations ?? [],
        yearsOfExperience: registrationData?.yearsOfExperience ?? 0,
        bio: registrationData?.bio ?? '',
        profilePhotoUrl: null,
        gymId: null,
        isFreelance: false,
        adminAccess: false,
        isLifeVerified: false,
        acceptingNewClients: true,
        certifications: [],
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const snap = await getDoc(doc(db, 'trainers', uid));
      if (!snap.exists()) {
        // New trainer — save full profile
        await setDoc(doc(db, 'trainers', uid), profileData);
      } else if (isNewUser && registrationData?.fullName) {
        // Existing Firebase user but re-registering — update profile fields
        const existing = snap.data();
        if (!existing.fullName || existing.fullName === '') {
          const { setDoc: _, ...updates } = profileData;
          await setDoc(doc(db, 'trainers', uid), { ...existing, ...profileData }, { merge: true });
        }
      }

      const trainerSnap = await getDoc(doc(db, 'trainers', uid));
      const trainerData = trainerSnap.data() ?? {};

      await setSession({
        trainerId: uid,
        accessToken: token,
        refreshToken: '',
        gymId: trainerData.gymId ?? null,
        isFreelance: trainerData.isFreelance ?? false,
      });

      if (isNewUser || (!trainerData.gymId && !trainerData.isFreelance)) {
        resetToGymLinking(navigation, uid);
      } else {
        resetToMain(navigation);
      }
    } catch (e: any) {
      console.log('Verify error:', e?.code, e?.message);
      if (e?.code === 'auth/invalid-verification-code') setError('Invalid OTP. Please check and try again.');
      else if (e?.code === 'auth/code-expired') setError('OTP expired. Please request a new one.');
      else setError('Verification failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardSafeView style={{ flex: 1 }}>
      <PhoneAuthWebView ref={phoneAuthRef} onReady={setWebviewReady} />
      <View style={os.container}>
        <TouchableOpacity style={os.back} onPress={() => {
          if (step === 'otp') { setStep('phone'); setOtp(''); setError(''); }
          else navigation.goBack();
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconSymbol name="chevron.left" size={16} color={C.primary} />
            <Text style={os.backText}>Back</Text>
          </View>
        </TouchableOpacity>

        {step === 'phone' ? (
          <>
            <Text style={os.title}>Enter your mobile number</Text>
            <Text style={os.subtitle}>We'll send you a 6-digit OTP to verify</Text>
            {!webviewReady && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={{ fontSize: 12, color: C.mid }}>Preparing secure verification…</Text>
              </View>
            )}
            <View style={os.phoneRow}>
              <Text style={os.prefix}>+91</Text>
              <TextInput style={[inp, { flex: 1 }]} placeholder="10-digit mobile number"
                keyboardType="number-pad" maxLength={10} value={phone}
                onChangeText={v => { setPhone(v); setError(''); }} autoFocus />
            </View>
            {!!error && <Text style={os.error}>{error}</Text>}
            <PrimaryButton label="Send OTP" onPress={sendOTP} loading={loading} />
          </>
        ) : (
          <>
            <Text style={os.title}>Enter OTP</Text>
            <Text style={os.subtitle}>Sent to +91 {phone}</Text>
            <TextInput style={[inp, os.otpInput]} placeholder="6-digit OTP"
              keyboardType="number-pad" maxLength={6} value={otp}
              onChangeText={v => { setOtp(v); setError(''); }} autoFocus />
            {!!error && <Text style={os.error}>{error}</Text>}
            <PrimaryButton label="Verify OTP" onPress={verifyOTP} loading={loading} />
            <TouchableOpacity style={{ marginTop: 16, alignSelf: 'center' }}
              onPress={sendOTP} disabled={timer > 0}>
              <Text style={[os.resend, timer > 0 && { color: C.mid }]}>
                {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardSafeView>
  );
}
const os = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white, padding: 24, paddingTop: 60, gap: 16 },
  back: { marginBottom: 8 },
  backText: { color: C.primary, fontSize: 15, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '700', color: C.dark },
  subtitle: { fontSize: 14, color: C.mid, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefix: { fontSize: 16, fontWeight: '600', color: '#374151' },
  otpInput: { fontSize: 24, textAlign: 'center', letterSpacing: 8 },
  error: { color: C.red, fontSize: 13 },
  resend: { color: C.primary, fontSize: 14, fontWeight: '500' },
});

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, error, style, children }: any) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={fs.label}>{label}</Text>
      {children}
      {error ? <Text style={fs.error}>{error}</Text> : null}
    </View>
  );
}
const fs = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  error: { fontSize: 12, color: C.red, marginTop: 4 },
});
const inp: any = { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 15, color: C.dark, backgroundColor: C.white };
const inpErr: any = { borderColor: C.red };
