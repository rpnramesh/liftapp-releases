// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../constants/theme';
// Lift Trainer App — Auth Screens
// TS-001 Splash | TS-002 Welcome | TS-003 Registration | TS-004 OTP
// ─────────────────────────────────────────────────────────────────────────────

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { PrimaryButton } from '../../components/common';
import { I18N, SPECIALIZATIONS } from '../../constants/trainer.constants';
import { AuthStackParamList } from '../../navigation/TrainerNavigator';
import { AuthAPI } from '../../services/mockApi';
import { isValidIndianPhone, isValidOTP } from '../../utils/trainer.utils';

// ─── TS-001 SplashScreen ─────────────────────────────────────────────────────

type SplashProps = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: SplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    const check = async () => {
      const token = await getStoredToken(); // implement via SecureStore / Keystore
      if (!token) {
        setTimeout(() => navigation.replace('Welcome'), 1500);
        return;
      }

      try {
        const res = await AuthAPI.validateToken(token);
        if (res.role !== 'TRAINER') {
          await clearToken();
          Alert.alert('Wrong App', I18N.ROLE_ERROR);
          navigation.replace('Welcome');
          return;
        }
        setTimeout(() => navigation.replace('Main' as any), 1500);
      } catch (err: any) {
        if (err?.status === 401) {
          await clearToken();
          navigation.replace('Welcome');
        } else {
          // offline — go to dashboard in offline mode
          navigation.replace('Main' as any);
        }
      }
    };

    check();
  }, []);

  return (
    <View style={splashStyles.container}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        {/* Replace with actual Lift SVG/Image asset */}
        <Text style={splashStyles.wordmark}>LIFT</Text>
        <Text style={splashStyles.tagline}>The Complete Fitness Ecosystem for Kerala</Text>
      </Animated.View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 48,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: 6,
  },
  tagline: { fontSize: 13, color: C.mid, marginTop: 8, textAlign: 'center' },
});

// Stubs — replace with actual Keystore / SecureStore implementation
async function getStoredToken(): Promise<string | null> { return null; }
async function clearToken(): Promise<void> {}

// ─────────────────────────────────────────────────────────────────────────────

// ─── TS-002 WelcomeScreen ────────────────────────────────────────────────────

type WelcomeProps = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: WelcomeProps) {
  useEffect(() => {
    const onBack = () => {
      BackHandler.exitApp();
      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBack);
  }, []);

  return (
    <View style={welcomeStyles.container}>
      {/* Background overlay — in production use ImageBackground */}
      <View style={welcomeStyles.overlay} />
      <View style={welcomeStyles.content}>
        <Text style={welcomeStyles.logo}>LIFT</Text>
        <Text style={welcomeStyles.tagline}>Manage your clients.{'\n'}Grow your fitness business.</Text>
        <View style={welcomeStyles.buttons}>
          <PrimaryButton
            label="Register as Trainer"
            onPress={() => navigation.navigate('Registration')}
          />
          <PrimaryButton
            label="Log In"
            onPress={() => navigation.navigate('OTP', { phone: '', isNewUser: false })}
            variant="outlined"
          />
        </View>
        <TouchableOpacity
          onPress={() => {/* deep link to Play Store */}}
          style={{ marginTop: 24 }}
        >
          <Text style={welcomeStyles.memberLink}>
            Are you a gym member? Download the Lift Member App
          </Text>
        </TouchableOpacity>
      </View>
      {/* Language toggle top-right */}
      <View style={welcomeStyles.langToggle}>
        <Text style={welcomeStyles.langText}>EN | ML</Text>
      </View>
    </View>
  );
}

const welcomeStyles = StyleSheet.create({
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

// ─────────────────────────────────────────────────────────────────────────────

// ─── TS-003 RegistrationScreen ───────────────────────────────────────────────

type RegProps = NativeStackScreenProps<AuthStackParamList, 'Registration'>;

export function RegistrationScreen({ navigation }: RegProps) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    age: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    yearsOfExperience: '',
    bio: '',
    specializations: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const toggleSpecialization = (s: string) => {
    setForm(prev => ({
      ...prev,
      specializations: prev.specializations.includes(s)
        ? prev.specializations.filter(x => x !== s)
        : [...prev.specializations, s],
    }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!isValidIndianPhone(form.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number';
    if (!form.age || isNaN(Number(form.age))) e.age = 'Enter a valid age';
    if (form.specializations.length === 0) e.specializations = 'Select at least one specialization';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await AuthAPI.register({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        age: Number(form.age),
        gender: form.gender,
        specializations: form.specializations,
        yearsOfExperience: Number(form.yearsOfExperience) || 0,
        bio: form.bio,
      });
      navigation.navigate('OTP', { phone: form.phone.trim(), isNewUser: true });
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message ?? 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={regStyles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={regStyles.title}>Create Trainer Account</Text>
        <Text style={regStyles.subtitle}>Build your professional profile on Lift</Text>

        <Field label="Full Name *" error={errors.fullName}>
          <TextInput
            style={[inputStyle, errors.fullName && inputErrorStyle]}
            placeholder="e.g. Rajan Nair"
            value={form.fullName}
            onChangeText={v => set('fullName', v)}
          />
        </Field>

        <Field label="Mobile Number *" error={errors.phone}>
          <View style={regStyles.phoneRow}>
            <Text style={regStyles.phonePrefix}>+91</Text>
            <TextInput
              style={[inputStyle, { flex: 1 }, errors.phone && inputErrorStyle]}
              placeholder="10-digit mobile number"
              keyboardType="number-pad"
              maxLength={10}
              value={form.phone}
              onChangeText={v => set('phone', v)}
            />
          </View>
        </Field>

        <View style={regStyles.row}>
          <Field label="Age *" error={errors.age} style={{ flex: 1 }}>
            <TextInput
              style={[inputStyle, errors.age && inputErrorStyle]}
              keyboardType="number-pad"
              maxLength={3}
              value={form.age}
              onChangeText={v => set('age', v)}
              placeholder="25"
            />
          </Field>
          <Field label="Experience (yrs)" style={{ flex: 1 }}>
            <TextInput
              style={inputStyle}
              keyboardType="number-pad"
              maxLength={2}
              value={form.yearsOfExperience}
              onChangeText={v => set('yearsOfExperience', v)}
              placeholder="3"
            />
          </Field>
        </View>

        <Field label="Gender">
          <View style={regStyles.genderRow}>
            {(['Male', 'Female', 'Other'] as const).map(g => (
              <TouchableOpacity
                key={g}
                style={[regStyles.genderBtn, form.gender === g && regStyles.genderBtnActive]}
                onPress={() => setForm(prev => ({ ...prev, gender: g }))}
              >
                <Text style={[regStyles.genderText, form.gender === g && { color: C.primary, fontWeight: '600' }]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Specializations *" error={errors.specializations}>
          <View style={regStyles.specWrap}>
            {SPECIALIZATIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  regStyles.specChip,
                  form.specializations.includes(s) && regStyles.specChipActive,
                ]}
                onPress={() => toggleSpecialization(s)}
              >
                <Text style={[regStyles.specText, form.specializations.includes(s) && { color: C.white }]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label={`Bio (${form.bio.length}/300)`}>
          <TextInput
            style={[inputStyle, { height: 90, textAlignVertical: 'top' }]}
            placeholder="Tell your clients about your training style…"
            multiline
            maxLength={300}
            value={form.bio}
            onChangeText={v => set('bio', v)}
          />
        </Field>

        <PrimaryButton label="Continue" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const regStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: C.dark, marginBottom: 4, marginTop: 8 },
  subtitle: { fontSize: 14, color: C.mid, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 12 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phonePrefix: { fontSize: 15, color: '#374151', fontWeight: '600' },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  genderBtnActive: { borderColor: C.primary, backgroundColor: C.primary + '10' },
  genderText: { color: '#374151', fontSize: 14 },
  specWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: C.white,
  },
  specChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  specText: { fontSize: 12, color: '#374151' },
});

// ─────────────────────────────────────────────────────────────────────────────

// ─── TS-004 OTPScreen ────────────────────────────────────────────────────────

type OTPProps = NativeStackScreenProps<AuthStackParamList, 'OTP'>;

export function OTPScreen({ navigation, route }: OTPProps) {
  const { phone: initialPhone, isNewUser } = route.params;
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>(initialPhone ? 'otp' : 'phone');
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Countdown timer for resend
  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const sendOTP = async () => {
    if (!isValidIndianPhone(phone)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await AuthAPI.requestOTP(phone);
      setStep('otp');
      setTimer(30);
    } catch (e: any) {
      setError(e.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!isValidOTP(otp)) {
      setError('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await AuthAPI.verifyOTP(phone, otp);
      // Store tokens securely
      // await SecureStore.setItemAsync('accessToken', res.accessToken);
      if (isNewUser) {
        navigation.replace('GymLinking', { trainerId: res.trainerId });
      } else {
        navigation.replace('Main' as any);
      }
    } catch (e: any) {
      setError(e.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={otpStyles.container}>
        <TouchableOpacity style={otpStyles.back} onPress={() => navigation.goBack()}>
          <Text style={otpStyles.backText}>← Back</Text>
        </TouchableOpacity>

        {step === 'phone' ? (
          <>
            <Text style={otpStyles.title}>Enter your mobile number</Text>
            <Text style={otpStyles.subtitle}>We'll send you a 6-digit OTP to verify</Text>
            <View style={otpStyles.phoneRow}>
              <Text style={otpStyles.prefix}>+91</Text>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                placeholder="10-digit mobile number"
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={v => { setPhone(v); setError(''); }}
                autoFocus
              />
            </View>
            {error ? <Text style={otpStyles.error}>{error}</Text> : null}
            <PrimaryButton label="Send OTP" onPress={sendOTP} loading={loading} />
          </>
        ) : (
          <>
            <Text style={otpStyles.title}>Enter OTP</Text>
            <Text style={otpStyles.subtitle}>Sent to +91 {phone}</Text>
            <TextInput
              style={[inputStyle, otpStyles.otpInput]}
              placeholder="6-digit OTP"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={v => { setOtp(v); setError(''); }}
              autoFocus
            />
            {error ? <Text style={otpStyles.error}>{error}</Text> : null}
            <PrimaryButton label="Verify OTP" onPress={verifyOTP} loading={loading} />
            <TouchableOpacity
              style={{ marginTop: 16, alignSelf: 'center' }}
              onPress={sendOTP}
              disabled={timer > 0}
            >
              <Text style={[otpStyles.resend, timer > 0 && { color: C.light }]}>
                {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const otpStyles = StyleSheet.create({
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

// ─────────────────────────────────────────────────────────────────────────────

// ─── Field Helper ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  style?: object;
  children: React.ReactNode;
}

function Field({ label, error, style, children }: FieldProps) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  error: { fontSize: 12, color: C.red, marginTop: 4 },
});

const inputStyle: object = {
  borderWidth: 1,
  borderColor: '#D1D5DB',
  borderRadius: 10,
  padding: 12,
  fontSize: 15,
  color: C.dark,
  backgroundColor: C.white,
};

const inputErrorStyle: object = { borderColor: C.red };
