// ─────────────────────────────────────────────────────────────────────────────
// Lift Member App — App.js
// Firebase OTP Auth · Real-time Firestore · Live Chat · No dummy data
// v1.8.6 — Complete button, warm-up lock, time entry on complete
// GitHub Actions build with Android SDK
// ─────────────────────────────────────────────────────────────────────────────

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  LayoutAnimation,
  BackHandler,
  PanResponder,
  Platform,
  Pressable,
  Share,
  UIManager,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Audio } from 'expo-av';

// ── Firebase ──────────────────────────────────────────────────────────────────
import { onAuthStateChanged, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { WebView } from 'react-native-webview';
import PhoneAuthWebView from './shared/components/PhoneAuthWebView';
import { auth, db } from './shared/firebase/config';

// ── Shared services ───────────────────────────────────────────────────────────
import { daysUntilExpiry, subscribeToMember, updateMember } from './shared/services/member.service';
import {
  markAllRead as markAllNotifsRead,
  markNotificationRead,
  subscribeToNotifications,
} from './shared/services/notification.service';
import {
  subscribeToMeasurements,
  subscribeToWeightLog
} from './shared/services/progress.service';
import STORAGE_KEYS from './LIFT_PROJECT/constants/storageKeys';

// ── Design system (matches web admin dashboard — Indigo-Blue) ─────────────────
import theme from './LIFT_PROJECT/constants/theme';
import sharedC from './LIFT_PROJECT/constants/colors';
import { Pill as UiPill } from './LIFT_PROJECT/components/ui';
import SwipeableSetRow from './LIFT_PROJECT/components/ui/SwipeableSetRow';
import { useTheme, makeStyles, usePalette } from './LIFT_PROJECT/theme/ThemeProvider';
import ThemeToggle from './LIFT_PROJECT/theme/ThemeToggle';

const { width } = Dimensions.get('window');

// Show notifications even when app is in foreground (lock screen always handled by OS)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

// ── Colors ────────────────────────────────────────────────────────────────────
// Aliased to the shared design tokens so the 450+ existing C.* references now
// render in the indigo-blue brand palette used by the web dashboard. Keys are
// preserved for backwards compatibility.
const C = {
  primary:  theme.brand[600],    // #4f46e5 (was #2563EB)
  accent:   theme.brand[600],
  deepBlue: theme.brand[700],    // #4338ca — pressed/hover tone
  bg:       theme.surface.raised,// #fafafa (was #F8F9FA)
  card:     theme.surface.default,
  dark:     theme.text.primary,  // #111111 (was #1A1A2E)
  mid:      theme.text.secondary,// #525252 (was #8E8E93) — better contrast
  light:    theme.neutral[100],  // #f5f5f5
  green:    theme.success[600],  // #16a34a (deeper than old #22C55E)
  amber:    theme.warning[600],  // #ca8a04
  red:      theme.danger[600],   // #e11d48 (rose-red, matches web)
  blue2:    theme.brand[50],     // #eef2ff (was #EBF2FF)
};

const formatElapsed = (s) => {
  if (!s) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const formatDate = (ts) =>
  new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const MEMBER_SESSION_KEY = 'lift_member_session';

const normalizePhone = (value = '') => value.replace(/\D/g, '').slice(-10);

async function findMemberByPhone(phone) {
  const digits = normalizePhone(phone);
  if (digits.length !== 10) {
    console.log('findMemberByPhone: invalid phone length', phone, '→', digits);
    return null;
  }
  console.log('findMemberByPhone: searching for', phone, '→', digits);
  for (const candidate of [`+91${digits}`, digits]) {
    console.log('findMemberByPhone: querying with candidate:', candidate);
    const snap = await getDocs(query(collection(db, 'members'), where('phone', '==', candidate)));
    console.log('findMemberByPhone: query result for', candidate, '→', snap.size, 'docs found');
    if (!snap.empty) {
      const memberDoc = snap.docs[0];
      const result = { id: memberDoc.id, ...memberDoc.data() };
      console.log('findMemberByPhone: member found:', result.id, 'phone:', result.phone);
      return result;
    }
  }
  console.log('findMemberByPhone: no member found for', phone);
  return null;
}

async function saveMemberSession(memberId, phone = '') {
  try {
    await AsyncStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify({
      memberId,
      phone: normalizePhone(phone),
      savedAt: Date.now(),
    }));
  } catch (_) {}
}

async function clearMemberSession() {
  try {
    await AsyncStorage.removeItem(MEMBER_SESSION_KEY);
  } catch (_) {}
}

// ── Rest complete sound player ────────────────────────────────────────────────
const playRestCompleteSound = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true, volume: 1.0 }
    );
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.didJustFinish) sound.unloadAsync().catch(() => {});
    });
  } catch (e) { console.log('Sound play error:', e); }
};

// ── SPLASH ────────────────────────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View style={[sp.container, { opacity: fade }]}>
      <Text style={sp.logo}>LIFT</Text>
    </Animated.View>
  );
}
const sp = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: 6 },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 10 },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, letterSpacing: 3 },
});

// ── WELCOME ───────────────────────────────────────────────────────────────────
function WelcomeScreen({ onRegister, onExistingUser }) {
  return (
    <View style={wl.container}>
      <View style={wl.top}>
        <Text style={wl.logo}>LIFT</Text>
        <Text style={wl.tagline}>Your fitness. Your gym.{'\n'}All in one place.</Text>
      </View>
      <View style={wl.bottom}>
        <TouchableOpacity style={wl.btnPrimary} onPress={onRegister}>
          <Text style={wl.btnPrimaryTxt}>Register With Phone & OTP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={wl.btnSecondary} onPress={onExistingUser}>
          <Text style={wl.btnSecondaryTxt}>Existing User</Text>
        </TouchableOpacity>
        <Text style={wl.hint}>Available in English | മലയാളം</Text>
      </View>
    </View>
  );
}
const wl = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.primary },
  top: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  logo: { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: 5 },
  tagline: { fontSize: 17, color: 'rgba(255,255,255,0.85)', marginTop: 16, textAlign: 'center', lineHeight: 26 },
  bottom: { padding: 32, paddingBottom: 48 },
  btnPrimary: { backgroundColor: '#fff', borderRadius: 14, padding: 17, alignItems: 'center', marginBottom: 12 },
  btnPrimaryTxt: { color: C.primary, fontWeight: '700', fontSize: 16 },
  btnSecondary: { borderWidth: 2, borderColor: '#fff', borderRadius: 14, padding: 17, alignItems: 'center', marginBottom: 20 },
  btnSecondaryTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 12 },
});

// ── OTP LOGIN ─────────────────────────────────────────────────────────────────
// ── OTP LOGIN — replace the entire OtpLoginScreen function in App.js ──────────
// Also remove this import at the top:
// import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
// Replace it with nothing — we no longer need it.

// Also change this import at the top of App.js:
// FROM: import { signInWithPhoneNumber, onAuthStateChanged } from 'firebase/auth';
// TO:   import { signInWithPhoneNumber, onAuthStateChanged, RecaptchaVerifier } from 'firebase/auth';

// Never surface raw Firebase / reCAPTCHA internal error strings to users.
// Returns a clean, human-readable message regardless of what Firebase throws.
function friendlyOtpError(e) {
  const code = e?.code || '';
  const msg  = (e?.message || '').toLowerCase();
  if (code === 'auth/too-many-requests'    || msg.includes('too many'))       return 'Too many attempts. Please wait a few minutes and try again.';
  if (code === 'auth/invalid-phone-number' || msg.includes('invalid phone'))  return 'Invalid phone number format. Please check and try again.';
  if (code === 'auth/quota-exceeded')                                          return 'SMS quota exceeded. Please try again later.';
  if (code === 'auth/network-request-failed' || msg.includes('network'))      return 'Network error. Please check your connection and try again.';
  // reCAPTCHA internals — must never be shown to users
  if (msg.includes('recaptcha') || msg.includes('captcha') || msg.includes('already been rendered') || msg.includes('render')) {
    return 'Verification service reset. Please tap "Receive OTP" again.';
  }
  if (msg.includes('timeout') || msg.includes('timed out'))                  return 'OTP request timed out. Please try again.';
  if (code === 'auth/app-not-authorized')                                     return 'App not authorised for phone auth. Please contact support.';
  // Fallback — show something generic, not the raw Firebase message
  return 'Could not send OTP. Please try again.';
}

function OtpLoginScreen({ onSuccess }) {
  const phoneAuthRef = useRef(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationId, setVerificationId] = useState(null);

  const sendOtp = async () => {
    if (phone.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setError(''); setLoading(true);
    try {
      const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
      const vId = await phoneAuthRef.current?.sendOtp(formatted);
      if (!vId) throw new Error('Failed to send OTP');
      setVerificationId(vId);
      setStep('otp');
    } catch (e) {
      console.log('OTP send error:', e?.code, e?.message);
      setError(friendlyOtpError(e));
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    if (!verificationId) { setError('Please request OTP first'); return; }
    setError(''); setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(auth, credential);
      const uid = result.user.uid;
      const snap = await getDoc(doc(db, 'members', uid));
      if (!snap.exists()) {
        // ── First login: check if a gym pre-created a member doc with the same phone ──
        // Gym management app creates member docs with auto-generated IDs (not the auth UID).
        // If found, inherit gym/plan data and migrate the workout assignment to this UID path.
        let inherited = {};
        let oldMemberId = null;
        try {
          const phone10 = phone.replace(/\D/g, '').slice(-10);
          for (const fmt of [`+91${phone10}`, phone10]) {
            const qsnap = await getDocs(query(collection(db, 'members'), where('phone', '==', fmt)));
            if (!qsnap.empty) {
              const d = qsnap.docs[0];
              if (d.id !== uid) {
                oldMemberId = d.id;
                const data = d.data();
                inherited = {
                  name:             data.name            || '',
                  gymId:            data.gymId            || '',
                  trainerId:        data.trainerId        || null,
                  height:           data.height           || 0,
                  weight:           data.weight           || 0,
                  goalWeight:       data.goalWeight       || 0,
                  plan:             data.plan             || '',
                  planStartDate:    data.planStartDate    || Date.now(),
                  planEndDate:      data.planEndDate      || Date.now(),
                  feePaidDate:      data.feePaidDate      || null,
                  lastPaymentAmount:data.lastPaymentAmount|| null,
                  createdAt:        data.createdAt        || Date.now(),
                };
              }
              break;
            }
          }
        } catch (e) { console.log('Phone lookup error:', e.message); }

        // Create the auth-linked member document, merging any inherited gym data.
        // gymMemberId stores the original gym-created Firestore doc ID so the
        // assignment listener can read workouts from the correct path regardless
        // of whether the gym assigned BEFORE or AFTER the member's first login.
        await setDoc(doc(db, 'members', uid), {
          id: uid,
          phone: `+91${phone}`,
          name: '', gymId: '', trainerId: null,
          height: 0, weight: 0, goalWeight: 0,
          plan: '', planStartDate: Date.now(), planEndDate: Date.now(),
          active: true, createdAt: Date.now(),
          ...inherited,
          gymMemberId: oldMemberId || null,
        });

        // Mark the gym-created member doc with this auth UID so the gym app
        // can write new workout assignments to the path this listener watches.
        if (oldMemberId) {
          updateDoc(doc(db, 'members', oldMemberId), { linkedUid: uid }).catch(() => {});
        }

        // If the pre-created member had a gym assignment, copy it to this UID's path
        // so the workout plan shows up immediately without the gym needing to reassign.
        if (inherited.gymId && oldMemberId) {
          try {
            const oldAssign = await getDoc(doc(db, 'gyms', inherited.gymId, 'assignments', oldMemberId));
            if (oldAssign.exists()) {
              await setDoc(doc(db, 'gyms', inherited.gymId, 'assignments', uid), {
                ...oldAssign.data(), id: uid, memberId: uid,
              });
            }
          } catch (e) { console.log('Assignment migration error:', e.message); }
        }
      } else {
        // Returning member: ensure gymMemberId is set (needed for assignment listener).
        // This was only written on first login in older versions — patch it here if missing.
        const existingData = snap.data();
        if (!existingData?.gymMemberId && existingData?.gymId) {
          try {
            const phone10 = phone.replace(/\D/g, '').slice(-10);
            let foundOldId = null;
            for (const fmt of [`+91${phone10}`, phone10]) {
              const qsnap = await getDocs(query(collection(db, 'members'), where('phone', '==', fmt)));
              for (const d of qsnap.docs) {
                if (d.id !== uid) { foundOldId = d.id; break; }
              }
              if (foundOldId) break;
            }
            if (foundOldId) {
              // Patch gymMemberId on auth doc + linkedUid on old doc (background, no-throw)
              updateDoc(doc(db, 'members', uid),        { gymMemberId: foundOldId }).catch(() => {});
              updateDoc(doc(db, 'members', foundOldId), { linkedUid:   uid        }).catch(() => {});
              // Also copy assignment if not already at auth UID path
              const existingAssign = await getDoc(
                doc(db, 'gyms', existingData.gymId, 'assignments', uid)
              ).catch(() => null);
              if (!existingAssign?.exists()) {
                const oldAssign = await getDoc(
                  doc(db, 'gyms', existingData.gymId, 'assignments', foundOldId)
                ).catch(() => null);
                if (oldAssign?.exists()) {
                  setDoc(doc(db, 'gyms', existingData.gymId, 'assignments', uid), {
                    ...oldAssign.data(), id: uid, memberId: uid,
                  }).catch(() => {});
                }
              }
            }
          } catch (e) { console.log('gymMemberId patch error:', e.message); }
        }
      }
      onSuccess(uid);
    } catch (e) {
      console.log('Verify error:', e?.code, e?.message);
      if (e?.code === 'auth/invalid-verification-code') setError('Invalid OTP. Please check and try again.');
      else if (e?.code === 'auth/code-expired') setError('OTP expired. Please request a new one.');
      else setError('Verification failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={ot.container}>
      <PhoneAuthWebView ref={phoneAuthRef} />
      <Text style={ot.heading}>{step === 'phone' ? 'Welcome to Lift' : 'Verify OTP'}</Text>
      <Text style={ot.sub}>
        {step === 'phone'
          ? 'Enter your mobile number to continue'
          : `OTP sent to +91 ${phone}`}
      </Text>

      {step === 'phone' ? (
        <>
          <View style={ot.phoneRow}>
            <View style={ot.countryCode}><Text style={ot.countryCodeTxt}>🇮🇳 +91</Text></View>
            <TextInput
              style={ot.phoneInput}
              placeholder="Mobile number"
              placeholderTextColor={C.mid}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={t => { setPhone(t); setError(''); }}
            />
          </View>
          {!!error && <Text style={ot.error}>{error}</Text>}
          <TouchableOpacity
            style={[ot.btn, (phone.length < 10 || loading) && ot.btnDisabled]}
            disabled={phone.length < 10 || loading}
            onPress={sendOtp}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={ot.btnTxt}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={ot.otpInput}
            placeholder="Enter 6-digit OTP"
            placeholderTextColor={C.mid}
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={t => { setOtp(t); setError(''); }}
            autoFocus
          />
          {!!error && <Text style={ot.error}>{error}</Text>}
          <TouchableOpacity
            style={[ot.btn, (otp.length !== 6 || loading) && ot.btnDisabled]}
            disabled={otp.length !== 6 || loading}
            onPress={verifyOtp}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={ot.btnTxt}>Verify & Continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={ot.resend} onPress={() => { setStep('phone'); setOtp(''); setError(''); }}>
            <Text style={ot.resendTxt}>← Change number</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

function ProfileRegisterModal({ visible, onClose, onRegistered }) {
  // Dark mode: usePalette() gives reactive C.* values so the sheet, inputs,
  // and buttons all switch automatically with the system/app theme toggle.
  const C = usePalette();
  const t = C._theme;
  const prg = usePrgStyles();  // themed registration modal styles
  const phoneAuthRef = useRef(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationId, setVerificationId] = useState(null);
  const [existingMember, setExistingMember] = useState(null);
  const [precheckUnavailable, setPrecheckUnavailable] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPhone('');
      setOtp('');
      setStep('phone');
      setLoading(false);
      setError('');
      setVerificationId(null);
      setExistingMember(null);
      setPrecheckUnavailable(false);
    }
  }, [visible]);

  const sendOtp = async (confirmedExisting = false) => {
    const digits = normalizePhone(phone);
    if (digits.length !== 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setError('');
    setLoading(true);
    try {
      let existing = null;
      try {
        existing = await findMemberByPhone(digits);
        setPrecheckUnavailable(false);
      } catch (lookupErr) {
        if (lookupErr?.code === 'permission-denied' || /missing or insufficient permissions/i.test(String(lookupErr?.message || ''))) {
          // User is not yet authenticated, so member pre-check may be blocked by rules.
          // Continue with OTP and resolve/link membership after verification.
          existing = null;
          setPrecheckUnavailable(true);
        } else {
          throw lookupErr;
        }
      }
      if (existing && !confirmedExisting) {
        setExistingMember(existing);
        setLoading(false);
        Alert.alert(
          'Number already registered',
          'This number already exists in member records. Do you want to continue and receive OTP?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Receive OTP', onPress: () => sendOtp(true) },
          ]
        );
        return;
      }

      setExistingMember(existing || null);
      const formatted = `+91${digits}`;
      const vId = await phoneAuthRef.current?.sendOtp(formatted);
      if (!vId) throw new Error('Failed to send OTP');
      setVerificationId(vId);
      setStep('otp');
    } catch (e) {
      console.log('Profile OTP send error:', e?.code, e?.message);
      setError(friendlyOtpError(e));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const digits = normalizePhone(phone);
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    if (!verificationId) { setError('Please request OTP first'); return; }
    setError('');
    setLoading(true);
    console.log('verifyOtp: starting verification for phone', digits);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(auth, credential);
      const authUid = result.user.uid;
      console.log('verifyOtp: authenticated with UID:', authUid);

      // Re-check by phone after OTP so we always attach to the latest existing member record.
      let matchedMember = null;
      try {
        matchedMember = await findMemberByPhone(digits);
        console.log('verifyOtp: findMemberByPhone result:', matchedMember?.id, 'phone:', matchedMember?.phone);
      } catch (lookupErr) {
        console.log('verifyOtp: findMemberByPhone error:', lookupErr?.message);
        if (!(/permission|insufficient/i.test(String(lookupErr?.message || '')))) throw lookupErr;
        console.log('verifyOtp: falling back to existingMember:', existingMember?.id);
        matchedMember = existingMember;
      }

      // If still no member found, try querying by authUid (in case member was created with this UID earlier)
      if (!matchedMember?.id) {
        try {
          const snap = await getDoc(doc(db, 'members', authUid));
          if (snap.exists()) {
            console.log('verifyOtp: found existing member by authUid:', authUid, 'phone:', snap.data().phone);
            matchedMember = { id: snap.id, ...snap.data() };
          }
        } catch (err) {
          console.log('verifyOtp: failed to query by authUid:', err?.message);
        }
      }

      if (matchedMember?.id) {
        console.log('verifyOtp: using existing member:', matchedMember.id);
        await saveMemberSession(matchedMember.id, digits);
        onRegistered(matchedMember.id);
        onClose();
        return;
      }

      console.log('verifyOtp: no existing member found, creating new member with UID:', authUid);
      const memberRef = doc(db, 'members', authUid);
      const memberSnap = await getDoc(memberRef);
      if (!memberSnap.exists()) {
        console.log('verifyOtp: member document does not exist, creating new one with phone:', `+91${digits}`);
        await setDoc(memberRef, {
          id: authUid,
          phone: `+91${digits}`,
          name: '',
          gymId: '',
          trainerId: null,
          height: 0,
          weight: 0,
          goalWeight: 0,
          plan: '',
          planStartDate: Date.now(),
          planEndDate: Date.now(),
          active: true,
          createdAt: Date.now(),
        });
      } else {
        // Member exists but had no phone set; update it
        const existingData = memberSnap.data();
        if (!existingData.phone) {
          console.log('verifyOtp: member document exists but phone was missing, updating it');
          await updateDoc(memberRef, { phone: `+91${digits}` });
        } else {
          console.log('verifyOtp: member document already exists with phone:', existingData.phone);
        }
      }

      console.log('verifyOtp: saving session and calling onRegistered with UID:', authUid);
      await saveMemberSession(authUid, digits);
      onRegistered(authUid);
      onClose();
    } catch (e) {
      console.log('Profile OTP verify error:', e?.code, e?.message);
      if (e?.code === 'auth/invalid-verification-code') setError('Invalid OTP. Please check and try again.');
      else if (e?.code === 'auth/code-expired') setError('OTP expired. Please request a new one.');
      else setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={prg.backdrop}>
        {/* Sheet uses t.surface.default so it's #fff in light, #111 in dark */}
        <SafeAreaView style={prg.sheet}>
          <PhoneAuthWebView ref={phoneAuthRef} />
          {/* Handle bar — visual affordance for the bottom sheet */}
          <View style={prg.handleBar} />

          <View style={prg.header}>
            <Text style={prg.title}>
              {step === 'phone' ? 'Register With Phone & OTP' : 'Enter OTP'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={prg.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>

          <Text style={prg.sub}>
            {step === 'phone'
              ? 'Enter your phone number. If already registered, we will confirm before sending OTP.'
              : `OTP sent to +91 ${normalizePhone(phone)}`}
          </Text>

          {precheckUnavailable && step === 'phone' && (
            <Text style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
              Existing-number pre-check is unavailable before verification. Continue with OTP and we will sync after verify.
            </Text>
          )}

          {step === 'phone' ? (
            <>
              {/* Phone row — uses prg.* themed inputs (not frozen ot.*) */}
              <View style={prg.phoneRow}>
                <View style={prg.countryChip}>
                  <Text style={prg.countryChipTxt}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={prg.phoneInput}
                  placeholder="Mobile number"
                  placeholderTextColor={C.muted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={val => { setPhone(val); setError(''); }}
                  autoCorrect={false}
                />
              </View>
              {!!error && <Text style={prg.error}>{error}</Text>}
              <TouchableOpacity
                style={[prg.btn, (normalizePhone(phone).length < 10 || loading) && prg.btnDisabled]}
                disabled={normalizePhone(phone).length < 10 || loading}
                onPress={() => sendOtp(false)}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={prg.btnTxt}>Receive OTP</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* OTP input — full-width, themed */}
              <TextInput
                style={prg.otpInput}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={val => { setOtp(val); setError(''); }}
                autoFocus
                autoCorrect={false}
              />
              {!!error && <Text style={prg.error}>{error}</Text>}
              <TouchableOpacity
                style={[prg.btn, (otp.length !== 6 || loading) && prg.btnDisabled]}
                disabled={otp.length !== 6 || loading}
                onPress={verifyOtp}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={prg.btnTxt}>Verify & Sync</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={prg.resend}
                onPress={() => { setStep('phone'); setOtp(''); setError(''); }}
              >
                <Text style={prg.resendTxt}>← Change number</Text>
              </TouchableOpacity>
            </>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// prg: registration modal styles — makeStyles so dark mode works.
// Uses t.* tokens so sheet bg, text and borders switch with the theme.
const usePrgStyles = makeStyles((t) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.surface.default,        // white in light, #111 in dark
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: t.border.default,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    minHeight: '62%',
  },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: t.border.strong, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '800', color: t.text.primary, letterSpacing: -0.2 },
  closeTxt: { fontSize: 14, color: t.brand[600], fontWeight: '700' },
  sub: { fontSize: 13, color: t.text.secondary, marginBottom: 14, lineHeight: 18 },
  // Phone/OTP input styles — token-driven for dark mode
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countryChip: {
    backgroundColor: t.surface.sunken,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: t.border.default,
  },
  countryChipTxt: { fontSize: 15, fontWeight: '600', color: t.text.primary },
  phoneInput: {
    flex: 1, backgroundColor: t.surface.default,
    borderRadius: 12, padding: 14,
    fontSize: 18, color: t.text.primary,
    borderWidth: 1.5, borderColor: t.border.default,
    letterSpacing: 1,
  },
  otpInput: {
    backgroundColor: t.surface.default,
    borderRadius: 12, padding: 18,
    fontSize: 24, color: t.text.primary,
    borderWidth: 1.5, borderColor: t.border.default,
    textAlign: 'center', letterSpacing: 8,
  },
  inputFocused: { borderColor: t.brand[500] },
  error: { color: t.danger[500], fontSize: 13, marginTop: 10, fontWeight: '500' },
  btn: {
    backgroundColor: t.brand[600],
    borderWidth: 1, borderColor: t.brand[700],
    borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 20,
    ...t.shadow.brand,
  },
  btnDisabled: {
    backgroundColor: t.surface.sunken,
    borderColor: t.border.default,
    shadowOpacity: 0,
  },
  btnTxt: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  resend: { alignItems: 'center', marginTop: 16 },
  resendTxt: { color: t.brand[600], fontSize: 14, fontWeight: '600' },
}));

// ── MEMBERSHIP DETAIL MODAL ──────────────────────────────────────────────────
const formatFullDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function MembershipDetailModal({ visible, onClose, member }) {
  const C  = usePalette();
  const { theme } = useTheme();
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const statusBarPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

  useEffect(() => {
    if (!member?.id || !visible) return;
    const unsub = onSnapshot(
      collection(db, 'members', member.id, 'payments'),
      snap => {
        setPayments(
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.paidDate || 0) - (a.paidDate || 0))
        );
        setLoadingPayments(false);
      },
      () => setLoadingPayments(false)
    );
    return () => unsub();
  }, [member?.id, visible]);

  if (!member) return null;
  const daysLeft = daysUntilExpiry(member);
  const expired = Date.now() > (member.planEndDate || 0);
  const status = !member.active ? 'Inactive' : expired ? 'Expired' : daysLeft <= 7 ? 'Expiring Soon' : 'Active';
  const statusColor = !member.active ? C.muted : expired ? C.red : daysLeft <= 7 ? C.amber : C.green;
  const border = theme.border.default;

  const rows = [
    { label: 'Membership Status', value: status, color: statusColor, bold: true },
    { label: 'Membership Plan', value: member.plan || '—' },
    { label: 'Plan Duration', value: member.planDurationMonths ? `${member.planDurationMonths} month${member.planDurationMonths > 1 ? 's' : ''}` : '—' },
    { label: 'Joining Date', value: formatFullDate(member.createdAt) },
    { label: 'Plan Start Date', value: formatFullDate(member.planStartDate) },
    { label: 'Plan Expiry Date', value: formatFullDate(member.planEndDate) },
    { label: 'Days Remaining', value: expired ? 'Expired' : `${daysLeft} days`, color: statusColor },
    { label: 'Last Payment Amount', value: member.lastPaymentAmount != null ? `₹${Number(member.lastPaymentAmount).toLocaleString('en-IN')}` : '—' },
    { label: 'Last Fee Paid Date', value: formatFullDate(member.feePaidDate) },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.raised }}>
        {statusBarPad > 0 && <View style={{ height: statusBarPad, backgroundColor: theme.surface.raised }} />}
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border }}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={{ color: C.primary, fontSize: 15, fontWeight: '600' }}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.dark }}>Membership Details</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Status badge */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: statusColor + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 28 }}>{expired ? '⚠️' : '💳'}</Text>
            </View>
            <View style={{ backgroundColor: statusColor + '22', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 }}>
              <Text style={{ color: statusColor, fontSize: 14, fontWeight: '700' }}>{status}</Text>
            </View>
          </View>

          {/* Detail rows */}
          {rows.map((r, i) => (
            <View key={i} style={{ backgroundColor: theme.surface.default, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: border }}>
              <Text style={{ fontSize: 13, color: C.mid, fontWeight: '500', flex: 1 }}>{r.label}</Text>
              <Text style={{ fontSize: 14, fontWeight: r.bold ? '800' : '600', color: r.color || C.dark, textAlign: 'right', flex: 1 }}>{r.value}</Text>
            </View>
          ))}

          {/* Payment History */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.dark, marginBottom: 12 }}>💰 Payment History</Text>
            {loadingPayments ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : payments.length === 0 ? (
              <View style={{ backgroundColor: theme.surface.default, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: border, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: C.mid }}>No payment records yet</Text>
              </View>
            ) : (
              payments.map((p, i) => (
                <View key={p.id || i} style={{ backgroundColor: theme.surface.default, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.dark }}>
                      {p.amount != null ? `₹${Number(p.amount).toLocaleString('en-IN')}` : '—'}
                    </Text>
                    <View style={{ backgroundColor: C.blue2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: C.primary }}>{p.plan || '—'}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>
                    Paid on {formatFullDate(p.paidDate)}
                    {p.planStartDate && p.planEndDate ? ` · Valid ${formatFullDate(p.planStartDate)} – ${formatFullDate(p.planEndDate)}` : ''}
                  </Text>
                </View>
              ))
            )}
            {payments.length > 0 && (
              <View style={{ backgroundColor: C.primary + '12', borderRadius: 12, padding: 14, marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.mid }}>Total Paid</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.primary }}>
                  ₹{payments.reduce((s, p) => s + (Number(p.amount) || 0), 0).toLocaleString('en-IN')}
                </Text>
              </View>
            )}
          </View>

          {/* Gym info if available */}
          {member.gymName && (
            <View style={{ backgroundColor: theme.surface.default, borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: border }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.dark, marginBottom: 6 }}>🏛 Gym</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: C.dark }}>{member.gymName}</Text>
              {member.gymAddress && <Text style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>{member.gymAddress}</Text>}
              {member.gymPhone && <Text style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>📞 {member.gymPhone}</Text>}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── HOME DASHBOARD ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// HomeScreen — redesigned to match the web admin Gym Management dashboard.
//
//   Design parity notes (vs. /Users/admin/lift-gym-app/src/index.css):
//   • Cards use web `.card` / `.card-raised` / `.info-card-brand` geometry:
//     radius 14–16 px, 1 px neutral-200 border, layered shadow-card.
//   • Hero workout card = gradient-like indigo surface with inset highlight
//     (mirrors web .btn-primary: linear-gradient 500 → 600 + inset white).
//   • Quick Stats = 3 equal-width surface cards with a tinted icon chip
//     (mirrors web .num-badge-brand / success / warning) + tabular-num metric
//     typography for thumb-readable glanceability.
//   • Typography: all labels use the `text-label` uppercase/tracked style;
//     stat numbers use `text-metric-sm` (tabular, tight).
//   • Spacing rhythm: 24 px between sections (theme.spacing.section).
//   • Micro-delight: greeting fades+slides in on mount, play-icon gently
//     pulses on the primary CTA. Animations are subtle (≤250 ms, ≤1.06×
//     scale) so mid-age users read it as polish, not noise.
//   • Touch targets: all interactive rows are ≥56 px tall, button height
//     ≥48 px (finger-friendly; exceeds Apple's 44 pt minimum).
// ═══════════════════════════════════════════════════════════════════════════════
function HomeScreen({ onNavigate, member, workoutTimer, assignment, todayWorkout, fullPlan, unreadNotifCount, onStartWorkout }) {
  const C = usePalette();
  const { theme } = useTheme();
  const g = useGlobalStyles();
  const hm = useHmStyles();
  const [showMembership, setShowMembership] = useState(false);

  // ── Derived values ───────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
  const firstName = member?.name?.split(' ')[0] || 'there';
  const daysLeft = member ? daysUntilExpiry(member) : 0;

  // Membership chip tone uses the same semantic tokens as web status pills
  // (status-pill-danger / -warning / -success).
  const membershipTone = daysLeft <= 7 ? 'danger' : daysLeft <= 30 ? 'warning' : 'success';
  const membershipColor = daysLeft <= 7 ? theme.danger[600] : daysLeft <= 30 ? theme.warning[600] : theme.success[600];

  const bmi = member && member.height > 0
    ? (member.weight / ((member.height / 100) ** 2)).toFixed(1)
    : '—';
  // BMI band — tiny color dot under the metric, matches web health banding.
  const bmiVal = parseFloat(bmi);
  const bmiBand = isNaN(bmiVal) ? null
    : bmiVal < 18.5 ? { color: theme.info[500],    label: 'Under'  }
    : bmiVal < 25   ? { color: theme.success[600], label: 'Normal' }
    : bmiVal < 30   ? { color: theme.warning[600], label: 'Over'   }
    :                 { color: theme.danger[600],  label: 'High'   };

  const exercisesCount = todayWorkout?.exercises?.length || 0;
  const planName = fullPlan?.name || assignment?.planName || member?.currentPlanName || '';
  const hasPlan = !!(fullPlan || assignment?.planId || member?.currentPlanId);

  // ── Subtle entrance animation for the greeting block ─────────────────────
  const greetOpacity = useRef(new Animated.Value(0)).current;
  const greetTranslate = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(greetOpacity,   { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(greetTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [greetOpacity, greetTranslate]);

  // ── Gentle infinite pulse on the play-icon inside the primary CTA ────────
  // Loops 1.0 → 1.08 → 1.0 every 1.6 s. Only runs while a workout is
  // available & not completed, so it cues "tap to start" without being noisy.
  const pulse = useRef(new Animated.Value(1)).current;
  const shouldPulse = !!todayWorkout && !todayWorkout.isRestDay && !workoutTimer?.completed && !workoutTimer?.running;
  useEffect(() => {
    if (!shouldPulse) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shouldPulse, pulse]);

  return (
    <>
    <ScrollView style={g.screenNoPad} contentContainerStyle={hm.scrollContent} showsVerticalScrollIndicator={false}>

      {/* ─── Header: greeting + date + bell ────────────────────────────────
          Uses web text-h2 for greeting and text-caption for date. The
          notification bell has a 44×44 tap area and a danger-toned badge
          matching web `.status-pill-danger`. */}
      <Animated.View
        style={[hm.header, { opacity: greetOpacity, transform: [{ translateY: greetTranslate }] }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={hm.greet} numberOfLines={1}>
            {greet}, <Text style={hm.greetName}>{firstName}</Text>
            <Text style={hm.greetWave}> 👋</Text>
          </Text>
          <Text style={hm.greetDate}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity
          style={hm.bellBtn}
          onPress={() => onNavigate('Notifications')}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.text.primary} />
          {unreadNotifCount > 0 && (
            <View style={hm.bellBadge}>
              <Text style={hm.bellBadgeTxt}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ─── Hero: Today's Workout ─────────────────────────────────────────
          Four visual states — rest day, active session, plan-but-no-day,
          empty. All share:
            • 20 px padding (cardPad token)
            • radius 20 px ('2xl' — larger than other cards so the hero reads
              as the focal point, matches web modal feel)
            • brand indigo gradient simulated with solid brand[600] + white
              diagonal overlay
            • shadow.brand for the floating, branded elevation
      */}
      {todayWorkout?.isRestDay ? (
        <TouchableOpacity
          style={[hm.hero, hm.heroRest]}
          onPress={() => onNavigate('Workouts')}
          activeOpacity={0.92}
        >
          <HeroHighlight />
          {planName ? <Text style={hm.heroPlanTag}>{planName}</Text> : null}
          <Text style={hm.heroLabel}>TODAY'S WORKOUT</Text>
          <View style={hm.heroTitleRow}>
            <Ionicons name="moon" size={22} color="#fff" />
            <Text style={hm.heroTitle}>Rest Day</Text>
          </View>
          <Text style={hm.heroSub}>Recovery is part of progress. Take it easy today.</Text>
          <View style={hm.heroCta}>
            <Text style={hm.heroCtaTxt}>View Weekly Plan</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      ) : todayWorkout ? (
        <TouchableOpacity
          style={hm.hero}
          onPress={() => { if (onStartWorkout && !workoutTimer?.completed) onStartWorkout(); else onNavigate('Workouts'); }}
          activeOpacity={0.92}
        >
          <HeroHighlight />

          {/* Top row: plan tag + estimate pill */}
          <View style={hm.heroTop}>
            <View style={{ flex: 1 }}>
              {planName ? <Text style={hm.heroPlanTag}>{planName}</Text> : null}
              <Text style={hm.heroLabel}>TODAY'S WORKOUT</Text>
            </View>
            {todayWorkout.estimatedMinutes ? (
              <View style={hm.heroTimePill}>
                <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={hm.heroTimeTxt}>{todayWorkout.estimatedMinutes} min</Text>
              </View>
            ) : null}
          </View>

          <Text style={hm.heroTitle}>{todayWorkout.dayLabel || todayWorkout.name}</Text>

          {/* Status pill — mirrors web inline status-pill inside colored hero */}
          {workoutTimer?.running && (
            <View style={hm.statusPill}>
              <Ionicons name="time-outline" size={12} color="#fff" />
              <Text style={hm.statusPillTxt}>{formatElapsed(workoutTimer.elapsed)} · In progress</Text>
            </View>
          )}
          {workoutTimer?.completed && (
            <View style={[hm.statusPill, hm.statusPillDone]}>
              <Ionicons name="checkmark-circle" size={12} color="#fff" />
              <Text style={hm.statusPillTxt}>Done in {formatElapsed(workoutTimer.elapsed)}</Text>
            </View>
          )}

          <Text style={hm.heroSub}>
            {exercisesCount || 0} exercises · {todayWorkout.exercises?.map(e => e.muscleGroup).filter((v, i, a) => v && a.indexOf(v) === i).join(', ') || 'Assigned by ' + (member?.trainerName || member?.trainer || 'your trainer')}
          </Text>

          {/* Primary CTA — matches web `.btn` anatomy (semibold, 12 px radius,
              inset white highlight, pressed translateY). The play icon
              wrapper pulses when the session hasn't started. */}
          <TouchableOpacity
            style={[hm.heroCta, workoutTimer?.completed && hm.heroCtaDone]}
            onPress={() => {
              if (onStartWorkout && !workoutTimer?.completed) onStartWorkout();
              else onNavigate('Workouts');
            }}
            activeOpacity={0.85}
          >
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <Ionicons
                name={workoutTimer?.completed ? 'checkmark-circle' : workoutTimer?.running ? 'time' : 'play-circle'}
                size={18} color="#fff"
              />
            </Animated.View>
            <Text style={hm.heroCtaTxt}>
              {workoutTimer?.running ? 'Continue Workout' : workoutTimer?.completed ? 'View Completed' : 'Start Workout'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      ) : hasPlan ? (
        <TouchableOpacity
          style={[hm.hero, hm.heroMuted]}
          onPress={() => onNavigate('Workouts')}
          activeOpacity={0.92}
        >
          <HeroHighlight />
          {planName ? <Text style={hm.heroPlanTag}>{planName}</Text> : null}
          <Text style={hm.heroLabel}>TODAY'S WORKOUT</Text>
          <View style={hm.heroTitleRow}>
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={hm.heroTitle}>No session today</Text>
          </View>
          <Text style={hm.heroSub}>Tap to view your full weekly workout plan</Text>
          <View style={hm.heroCta}>
            <Text style={hm.heroCtaTxt}>View Weekly Plan</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={hm.emptyHero}>
          <View style={hm.emptyHeroIcon}>
            <Ionicons name="barbell-outline" size={22} color={theme.brand[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={hm.emptyHeroTitle}>
              {member?.trainerId || member?.gymId ? 'No plan assigned yet' : 'No trainer assigned'}
            </Text>
            <Text style={hm.emptyHeroSub}>
              {member?.trainerId
                ? 'Your trainer will assign a workout plan soon'
                : member?.gymId
                  ? 'Your gym will assign a workout plan soon'
                  : 'Accept a trainer invite in Profile'}
            </Text>
          </View>
        </View>
      )}

      {/* ─── Quick Stats ───────────────────────────────────────────────────
          Three equal-width cards. Each card has:
            • tinted square icon chip (brand / success / warning)
            • big tabular-num value + small unit
            • uppercase tracked label
            • tiny micro-visual under the value (BMI → band dot, Exercises →
              mini segmented bar, Weight → delta indicator).
      */}
      <View style={hm.sectionHeader}>
        <Text style={hm.sectionLabel}>QUICK STATS</Text>
        <TouchableOpacity onPress={() => onNavigate('Progress')} hitSlop={8}>
          <Text style={hm.sectionAction}>See all →</Text>
        </TouchableOpacity>
      </View>
      <View style={hm.statsRow}>
        <QuickStat
          icon="scale-outline"
          tone="brand"
          value={member?.weight ?? '—'}
          unit="kg"
          label="Weight"
          onPress={() => onNavigate('Progress')}
        />
        <QuickStat
          icon="pulse-outline"
          tone="success"
          value={bmi}
          unit=""
          label="BMI"
          footer={bmiBand ? (
            <View style={hm.bmiBand}>
              <View style={[hm.bmiDot, { backgroundColor: bmiBand.color }]} />
              <Text style={[hm.bmiBandTxt, { color: bmiBand.color }]}>{bmiBand.label}</Text>
            </View>
          ) : null}
          onPress={() => onNavigate('Progress')}
        />
        <QuickStat
          icon="flame-outline"
          tone="warning"
          value={exercisesCount || '—'}
          unit={exercisesCount === 1 ? 'exercise' : 'exercises'}
          label="Today"
          footer={exercisesCount > 0 ? (
            <View style={hm.segRow}>
              {[...Array(Math.min(exercisesCount, 6))].map((_, i) => (
                <View key={i} style={hm.seg} />
              ))}
            </View>
          ) : null}
          onPress={() => onNavigate('Workouts')}
        />
      </View>

      {/* ─── Membership ────────────────────────────────────────────────────
          Surface card with a left accent bar (web list-card feel). The
          days-left number uses text-metric-sm with the semantic tone color. */}
      {(member?.trainerId || member?.gymId) && member?.planEndDate > 0 ? (
        <>
          <Text style={hm.sectionLabel}>MEMBERSHIP</Text>
          {member?.trainerId && (
            <TouchableOpacity
              style={hm.memberCard}
              onPress={() => setShowMembership(true)}
              activeOpacity={0.85}
            >
              <View style={[hm.memberAccent, { backgroundColor: membershipColor }]} />
              <View style={hm.memberIconWrap}>
                <Ionicons name="fitness-outline" size={20} color={theme.brand[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={hm.memberTitle}>
                  {member?.gymId ? 'Personal Training' : 'Training Plan'}
                </Text>
                <Text style={hm.memberSub}>Valid until {formatDate(member.planEndDate)}</Text>
              </View>
              <View style={hm.memberRight}>
                <UiPill
                  label={`${daysLeft}d left`}
                  tone={membershipTone}
                  size="sm"
                />
                <Ionicons name="chevron-forward" size={18} color={theme.text.tertiary} style={{ marginLeft: 6 }} />
              </View>
            </TouchableOpacity>
          )}
          {member?.gymId && !member?.trainerId && (
            <TouchableOpacity
              style={hm.memberCard}
              onPress={() => setShowMembership(true)}
              activeOpacity={0.85}
            >
              <View style={[hm.memberAccent, { backgroundColor: theme.brand[600] }]} />
              <View style={hm.memberIconWrap}>
                <Ionicons name="business-outline" size={20} color={theme.brand[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={hm.memberTitle}>Gym Membership</Text>
                <Text style={hm.memberSub}>Valid until {formatDate(member.planEndDate)}</Text>
              </View>
              <View style={hm.memberRight}>
                <UiPill label={`${daysLeft}d left`} tone="brand" size="sm" />
                <Ionicons name="chevron-forward" size={18} color={theme.text.tertiary} style={{ marginLeft: 6 }} />
              </View>
            </TouchableOpacity>
          )}
        </>
      ) : null}

      {/* ─── Trainer ───────────────────────────────────────────────────────
          Pressable surface card with brand-tinted icon chip + Online pill.
          56 px tall icon zone ensures an easy tap target. */}
      <Text style={hm.sectionLabel}>YOUR TRAINER</Text>
      {member?.trainerId ? (
        <TouchableOpacity
          style={hm.trainerCard}
          onPress={() => onNavigate('TrainerChat')}
          activeOpacity={0.85}
        >
          <View style={hm.trainerIconWrap}>
            <Ionicons name="barbell" size={22} color={theme.brand[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={hm.trainerTitle}>
              Chat with {member?.trainerName || 'your trainer'}
            </Text>
            <Text style={hm.trainerSub}>Messages, voice notes & images</Text>
          </View>
          <UiPill label="● Online" tone="success" size="sm" />
        </TouchableOpacity>
      ) : (
        <View style={[hm.trainerCard, { opacity: 0.55 }]}>
          <View style={hm.trainerIconWrap}>
            <Ionicons name="barbell-outline" size={22} color={theme.brand[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={hm.trainerTitle}>No trainer assigned yet</Text>
            <Text style={hm.trainerSub}>Accept a trainer invite in Profile</Text>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
    <MembershipDetailModal visible={showMembership} onClose={() => setShowMembership(false)} member={member} />
    </>
  );
}

// ── HeroHighlight ──────────────────────────────────────────────────────────
// Simulates the web gradient-primary's inset white highlight without pulling
// in expo-linear-gradient. Two absolute layers:
//   • a soft white diagonal wash in the top-left (like .stat-card::before)
//   • a thin 1px white inset edge at the top (like btn-primary inset shadow)
function HeroHighlight() {
  const hm = useHmStyles();
  return (
    <>
      <View pointerEvents="none" style={hm.heroGlowTL} />
      <View pointerEvents="none" style={hm.heroGlowBR} />
      <View pointerEvents="none" style={hm.heroTopEdge} />
    </>
  );
}

// ── QuickStat ──────────────────────────────────────────────────────────────
// One of the 3 home stat cards. Uses the surface-card look from
// `/src/index.css > .stat-card`.
function QuickStat({ icon, tone = 'brand', value, unit, label, footer, onPress }) {
  const hm = useHmStyles();
  const tones = {
    brand:   { icon: theme.brand[600],   chip: 'rgba(79,70,229,0.10)'  },
    success: { icon: theme.success[600], chip: 'rgba(22,163,74,0.10)'  },
    warning: { icon: theme.warning[600], chip: 'rgba(217,119,6,0.12)'  },
  }[tone];
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={hm.statCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[hm.statIconChip, { backgroundColor: tones.chip }]}>
        <Ionicons name={icon} size={16} color={tones.icon} />
      </View>
      <View style={hm.statValueRow}>
        <Text style={hm.statValue} numberOfLines={1}>{value}</Text>
        {unit ? <Text style={hm.statUnit} numberOfLines={1}>{unit}</Text> : null}
      </View>
      <Text style={hm.statLabel}>{label}</Text>
      {footer ? <View style={hm.statFooter}>{footer}</View> : null}
    </Wrapper>
  );
}

const useHmStyles = makeStyles((t) => StyleSheet.create({
  // ── Scroll wrap ────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: t.spacing.pageX,
    paddingTop: t.spacing[3],
    paddingBottom: t.spacing[6],
  },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: t.spacing[5],
  },
  // Greeting: h1 weight, tight tracking — the one big moment of typography
  greet:     { fontSize: t.fontSize['3xl'], fontWeight: '700', color: t.text.primary, letterSpacing: -0.4 },
  greetName: { color: t.brand[700] },
  greetWave: { fontSize: t.fontSize['2xl'] },
  greetDate: { ...t.typography.caption, marginTop: 2, color: t.text.secondary },

  // Bell — 44×44 tap zone, subtle neutral pill bg on press
  bellBtn: {
    width: 44, height: 44,
    borderRadius: t.radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.surface.default,
    borderWidth: 1, borderColor: t.border.default,
    ...t.shadow.xs,
  },
  bellBadge: {
    position: 'absolute', top: 8, right: 8,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: t.danger[500],
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: t.surface.default,
  },
  bellBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // ── Hero workout card ──────────────────────────────────────────────────
  hero: {
    backgroundColor: t.brand[600],          // indigo-600, matches web
    borderRadius: t.radius['2xl'],          // 20 — larger than generic cards
    padding: 20,
    marginBottom: t.spacing.section,
    overflow: 'hidden',
    position: 'relative',
    ...t.shadow.brand,                      // branded glow (brand[600] @ 0.3)
  },
  heroMuted: { backgroundColor: t.brand[700] }, // "no session today"
  heroRest:  { backgroundColor: t.neutral[700] }, // "rest day" — neutral, not brand

  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: t.spacing[2],
  },

  heroPlanTag: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: t.fontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: t.fontSize['2xs'],
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTimePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  heroTimeTxt: { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '600' },

  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  heroTitle: {
    fontSize: t.fontSize['3xl'],
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.6,
    marginTop: 6,
    marginBottom: 6,
  },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'flex-start',
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 8,
  },
  statusPillDone: { backgroundColor: 'rgba(34,197,94,0.35)' },
  statusPillTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },

  heroSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: t.fontSize.sm,
    lineHeight: 20,
    marginBottom: 16,
  },

  // Primary CTA inside hero — 48 px tall, semibold, white-translucent fill
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: t.radius.md,
    paddingVertical: 14, paddingHorizontal: 16,
    minHeight: 48,
  },
  heroCtaDone: { backgroundColor: 'rgba(34,197,94,0.28)', borderColor: 'rgba(34,197,94,0.4)' },
  heroCtaTxt: { color: '#fff', fontWeight: '700', fontSize: t.fontSize.md, letterSpacing: -0.1 },

  // Diagonal highlight wash — top-left (simulates .stat-card::before)
  heroGlowTL: {
    position: 'absolute', top: -40, left: -40,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  // Secondary glow — bottom-right, tighter
  heroGlowBR: {
    position: 'absolute', bottom: -60, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  // 1 px top edge highlight (matches web btn-primary inset 0 1px white)
  heroTopEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  // ── Empty hero (no plan/trainer) ───────────────────────────────────────
  emptyHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    // brand[50] is too light in dark mode; use transparent brand tint instead
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.12)' : t.brand[50],
    borderWidth: 1,
    borderColor: t.mode === 'dark' ? 'rgba(99,102,241,0.28)' : t.brand[100],
    borderRadius: t.radius.xl,
    padding: 16,
    marginBottom: t.spacing.section,
  },
  emptyHeroIcon: {
    width: 44, height: 44,
    borderRadius: t.radius.md,
    backgroundColor: t.surface.default,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.mode === 'dark' ? 'rgba(99,102,241,0.28)' : t.brand[100],
  },
  emptyHeroTitle: { fontSize: t.fontSize.md, fontWeight: '700', color: t.text.primary },
  emptyHeroSub:   { fontSize: t.fontSize.xs, color: t.text.secondary, marginTop: 2 },

  // ── Section label + right action ───────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: t.spacing[3],
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: t.text.tertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: t.spacing[3],
    marginTop: t.spacing[5],
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: '600',
    color: t.brand[600],
    marginTop: t.spacing[5],
    marginBottom: t.spacing[3],
  },

  // ── Quick Stats ────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: t.surface.default,
    borderWidth: 1, borderColor: t.border.default,
    borderRadius: t.radius.xl,
    padding: 12,
    minHeight: 112,            // finger-friendly tap target
    ...t.shadow.card,
  },
  statIconChip: {
    width: 28, height: 28,
    borderRadius: t.radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: {
    fontSize: t.fontSize['2xl'],      // 20 — mirrors web text-metric-sm
    fontWeight: '800',
    color: t.text.primary,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: t.text.tertiary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: t.text.tertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statFooter: { marginTop: 8 },

  // Micro-visual: BMI band dot + label
  bmiBand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bmiDot:   { width: 6, height: 6, borderRadius: 3 },
  bmiBandTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  // Micro-visual: segmented bar for exercise count
  segRow: { flexDirection: 'row', gap: 2 },
  seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: t.warning[400] },

  // ── Membership card ────────────────────────────────────────────────────
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: t.surface.default,
    borderWidth: 1, borderColor: t.border.default,
    borderRadius: t.radius.lg,
    padding: 14,
    paddingLeft: 18,            // leaves room for accent bar
    marginBottom: t.spacing[3],
    overflow: 'hidden',
    minHeight: 68,              // finger-friendly
    ...t.shadow.card,
  },
  memberAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4,
  },
  memberIconWrap: {
    width: 40, height: 40,
    borderRadius: t.radius.md,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.18)' : t.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },
  memberTitle: { fontSize: t.fontSize.md, fontWeight: '700', color: t.text.primary, letterSpacing: -0.1 },
  memberSub:   { fontSize: t.fontSize.xs, color: t.text.secondary, marginTop: 2 },
  memberRight: { flexDirection: 'row', alignItems: 'center' },

  // ── Trainer card ───────────────────────────────────────────────────────
  trainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: t.surface.default,
    borderWidth: 1, borderColor: t.border.default,
    borderRadius: t.radius.lg,
    padding: 14,
    minHeight: 68,
    ...t.shadow.card,
  },
  trainerIconWrap: {
    width: 44, height: 44,
    borderRadius: t.radius.md,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.18)' : t.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },
  trainerTitle: { fontSize: t.fontSize.md, fontWeight: '700', color: t.text.primary, letterSpacing: -0.1 },
  trainerSub:   { fontSize: t.fontSize.xs, color: t.text.secondary, marginTop: 2 },
}));

// ── EXERCISE VIDEO ────────────────────────────────────────────────────────────
function ExerciseVideoModal({ visible, exerciseName, videoUrl, onClose }) {
  const [isMaximized, setIsMaximized] = useState(false);
  if (!visible || !exerciseName) return null;
  const searchQuery = encodeURIComponent(exerciseName + ' exercise how to form');
  const fallbackUrl = `https://m.youtube.com/results?search_query=${searchQuery}`;
  const uri = videoUrl || fallbackUrl;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* No statusBarTranslucent — let the OS handle status bar so SafeAreaView
          correctly insets the content and no overlap occurs on Android.        */}
      <SafeAreaView style={[ev.modalContainer, isMaximized && { paddingTop: 0 }]}>
        <View style={ev.toolbar}>
          <TouchableOpacity style={ev.toolBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={ev.toolTitle} numberOfLines={1}>{exerciseName}</Text>
          <TouchableOpacity style={ev.toolBtn} onPress={() => setIsMaximized(m => !m)} activeOpacity={0.7}>
            <Ionicons name={isMaximized ? 'contract-outline' : 'expand-outline'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri }}
          style={{ flex: 1 }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
        />
      </SafeAreaView>
    </Modal>
  );
}
const ot = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 28, paddingTop: 60 },
  heading: { fontSize: 28, fontWeight: '800', color: C.dark },
  sub: { fontSize: 14, color: C.mid, marginTop: 8, marginBottom: 32 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countryCode: { backgroundColor: C.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.light },
  countryCodeTxt: { fontSize: 15, fontWeight: '600', color: C.dark },
  phoneInput: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 16, fontSize: 18, color: C.dark, borderWidth: 1, borderColor: C.light, letterSpacing: 1 },
  otpInput: { backgroundColor: C.card, borderRadius: 12, padding: 18, fontSize: 24, color: C.dark, borderWidth: 1, borderColor: C.light, textAlign: 'center', letterSpacing: 8 },
  error: { color: C.red, fontSize: 13, marginTop: 10, fontWeight: '500' },
  btn: { backgroundColor: C.primary, borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 24 },
  btnDisabled: { backgroundColor: C.light },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resend: { alignItems: 'center', marginTop: 16 },
  resendTxt: { color: C.primary, fontSize: 14, fontWeight: '600' },
});
const ev = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#000' },
  toolbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 8, paddingVertical: 6, gap: 8 },
  toolBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  toolTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  thumb: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.blue2, borderRadius: 10, padding: 10, marginBottom: 10, gap: 10 },
  playIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  thumbTxt: { fontSize: 13, fontWeight: '600', color: C.primary },
});

// ── Group exercises into display items (superset / circuit / regular) ─────────
function processExercisesForDisplay(exercises) {
  const items = [];
  const seen  = new Set();
  exercises.forEach(ex => {
    if (ex.circuitId) {
      const key = `c_${ex.circuitId}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          type:        'circuit',
          id:          ex.circuitId,
          exercises:   exercises.filter(e => e.circuitId === ex.circuitId),
          rounds:      ex.circuitRounds      || 3,
          restSeconds: ex.circuitRestSeconds || 60,
        });
      }
    } else if (ex.supersetGroup) {
      const key = `ss_${ex.supersetGroup}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          type:        'superset',
          id:          ex.supersetGroup,
          exercises:   exercises.filter(e => e.supersetGroup === ex.supersetGroup),
          restSeconds: ex.rest || 60,
        });
      }
    } else {
      items.push({ type: 'regular', exercises: [ex] });
    }
  });
  return items;
}

// ── buildWorkoutFinishData — module-level helper ──────────────────────────────
// Extracted from LoggingView (where it was a local closure) to module scope so
// WorkoutsScreen can call it too. Previously WorkoutsScreen referenced it at
// line 4631 but it was out of scope → ReferenceError crash on tap.
function buildWorkoutFinishData({ dayLabel, planName, durationSeconds, exercises, actualResolver }) {
  return {
    planName: planName || '',
    dayLabel: dayLabel || '',
    durationSeconds: Math.max(0, durationSeconds || 0),
    exerciseCount: exercises?.length || 0,
    exercises: (exercises || []).map((ex, index) => {
      const actual = actualResolver ? actualResolver(ex, index) : null;
      return {
        exerciseName: ex.exerciseName || ex.name,
        muscleGroup:  ex.muscleGroup  || '',
        videoUrl:     ex.videoUrl     || '',  // preserved so post-workout YT icon works
        targetSets: ex.targetSets || ex.sets || ex.mainSets || 0,
        targetReps: ex.targetReps || ex.reps || ex.mainReps || 0,
        actualSets: actual?.actualSets ?? ex.actualSets ?? ex.targetSets ?? ex.sets ?? ex.mainSets ?? 0,
        actualReps: actual?.actualReps ?? ex.actualReps ?? ex.targetReps ?? ex.reps ?? ex.mainReps ?? 0,
        weight: actual?.weight ?? ex.weight ?? 0,
      };
    }),
  };
}

// ── WORKOUT LOGGING VIEW ──────────────────────────────────────────────────────
function LoggingView({ exercises, onBack, memberName, workoutTimer, stopWorkoutTimer, gymId, memberId, workoutId, workoutName, todayWorkout, doneSets: doneSetsExternal, setDoneSetsExternal, setWeightsExternal, setSetWeightsExternal, restEndTimes, setRestEndTimes, activeWorkoutLogId }) {
  const C = usePalette();
  const lv = useLvStyles();
  const [expanded, setExpanded] = useState(null);
  const [setWeights, setSetWeights] = useState(setWeightsExternal || {});
  const [lastWeights, setLastWeights] = useState({});
  const [doneSets, setDoneSets] = useState(doneSetsExternal || {});
  // restTimers: computed from restEndTimes each tick
  const [restTimers, setRestTimers] = useState({});
  const [allDone, setAllDone] = useState(!!workoutTimer?.completed);
  const [customReps, setCustomReps] = useState({});
  const [extraSets, setExtraSets] = useState({});
  // Circuit state
  const [circuitRound,     setCircuitRound]     = useState({}); // {id: currentRound}
  const [circuitActuals,   setCircuitActuals]   = useState({}); // {`${id}_${round}_${exId}`: value}
  const [circuitCompleted, setCircuitCompleted] = useState({}); // {id: true}
  const displayItems = processExercisesForDisplay(exercises);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeMinutes, setCompleteMinutes] = useState('');
  const [videoExName, setVideoExName] = useState(null);
  const tickRef = useRef(null);
  const vibratedRef = useRef({});
  const notifIdRef = useRef(null);
  const activeLogRef = useRef(null); // Firestore ref for the in-progress workout log

  // ── Notification setup (once on mount) ──────────────────────────────────────
  useEffect(() => {
    const setup = async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('rest-timer', {
          name: 'Rest Timer',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 500, 500],
          sound: null,
          bypassDnd: true,
        });
      }
      await Notifications.requestPermissionsAsync();
    };
    setup().catch(() => {});
    return () => {
      // Cancel any pending notification when leaving the workout view
      if (notifIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
        notifIdRef.current = null;
      }
    };
  }, []);

  // ── Schedule/cancel background notification whenever restEndTimes changes ───
  useEffect(() => {
    const entries = Object.entries(restEndTimes || {});
    if (entries.length === 0) {
      if (notifIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
        notifIdRef.current = null;
      }
      return;
    }
    const [, endTime] = entries[0];
    const secsLeft = Math.ceil((endTime - Date.now()) / 1000);
    if (secsLeft <= 0) return;
    // Cancel previous notification then schedule new one
    const prev = notifIdRef.current;
    Notifications.scheduleNotificationAsync({
      content: {
        title: '💪 Rest Complete!',
        body: 'Time to start your next set!',
        sound: false,
        vibrate: [0, 500, 500, 500],
        channelId: 'rest-timer',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endTime),
      },
    }).then(id => {
      notifIdRef.current = id;
      if (prev) Notifications.cancelScheduledNotificationAsync(prev).catch(() => {});
    }).catch(() => {});
  }, [restEndTimes]);

  // ── Tick: recompute display timers every 500ms ───────────────────────────────
  // Absolute timestamps survive tab switches and minimize (display is correct on resume).
  // Vibrate twice (in-app) when timer first hits 0.
  useEffect(() => {
    const compute = () => {
      const now = Date.now();
      const active = restEndTimes || {};
      const newTimers = {};
      for (const [k, end] of Object.entries(active)) {
        const remaining = Math.max(0, Math.ceil((end - now) / 1000));
        newTimers[k] = remaining;
        if (remaining === 0 && !vibratedRef.current[k]) {
          vibratedRef.current[k] = true;
          Vibration.vibrate([0, 500, 500, 500]); // two vibrations
          playRestCompleteSound();
        }
      }
      setRestTimers(newTimers);
    };
    compute();
    tickRef.current = setInterval(compute, 500);
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') compute();
    });
    return () => {
      clearInterval(tickRef.current);
      appSub.remove();
    };
  }, [restEndTimes]);

  useEffect(() => {
    const load = async () => {
      const stored = {};
      for (const ex of exercises) {
        for (let s = 1; s <= ex.sets; s++) {
          const key = `lift_w_${ex.id}_s${s}`;
          try {
            const val = await AsyncStorage.getItem(key);
            if (val) stored[`${ex.id}_${s}`] = val;
          } catch (_) {}
        }
      }
      setLastWeights(stored);
    };
    load();
  }, []);

  // Create (or reference) an incomplete workoutLog so the trainer sees "In Progress" immediately
  useEffect(() => {
    const gymOrTrainer = gymId || memberId;
    if (!gymOrTrainer || !memberId) return;
    if (workoutTimer?.completed) return; // already finished, don't create a new log
    (async () => {
      try {
        const { collection: col, doc: docFn, setDoc: setDocFn, getDoc: getDocFn } = require('firebase/firestore');
        const { db: fdb } = require('./shared/firebase/config');
        if (activeWorkoutLogId) {
          // Trainer already created this log — just reference it
          activeLogRef.current = docFn(fdb, 'gyms', gymOrTrainer, 'workoutLogs', activeWorkoutLogId);
        } else {
          // Member-started workout — create an incomplete log so trainer can see "In Progress"
          const logRef = docFn(col(fdb, 'gyms', gymOrTrainer, 'workoutLogs'));
          activeLogRef.current = logRef;
          await setDocFn(logRef, {
            id: logRef.id,
            memberId,
            memberName: memberName || '',
            gymId: gymId || null,
            planId: workoutId || '',
            planName: workoutName || '',
            dayLabel: todayWorkout?.dayLabel || '',
            status: 'incomplete',
            completedExercises: exercises.map(ex => ({
              exerciseId: ex.id,
              exerciseName: ex.name,
              muscleGroup: ex.muscleGroup || 'Other',
              targetSets: ex.sets,
              targetReps: ex.reps,
              actualSets: ex.sets,
              actualReps: String(ex.reps),
              weight: 0,
              restSeconds: ex.rest || 60,
              completed: false,
              notes: ex.note || '',
            })),
            startedAt: Date.now(),
            startedBy: 'member',
            loggedAt: new Date().toISOString(),
            completedAt: null,
            updatedAt: Date.now(),
          });
        }
      } catch (e) { console.log('LoggingView: create incomplete log error:', e); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatRest = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // buildWorkoutFinishData is now module-level (extracted to fix ReferenceError crash)

  // Only one timer ever active — replaces any existing timer
  const startRestTimer = (stateKey, secs) => {
    const endTime = Date.now() + secs * 1000;
    setRestEndTimes({ [stateKey]: endTime });
  };

  // Adjust the single active timer; keeps it as the only timer
  const adjustRest = (stateKey, delta) => {
    setRestEndTimes(prev => {
      const cur = prev?.[stateKey] ?? Date.now();
      const newEnd = Math.max(Date.now() + 10000, cur + delta * 1000);
      return { [stateKey]: newEnd };
    });
  };

  const markSetDone = async (exId, setNo, defaultRest, totalSets) => {
    const stateKey = `${exId}_${setNo}`;
    const val = setWeights[stateKey];
    if (val) {
      try { await AsyncStorage.setItem(`lift_w_${exId}_s${setNo}`, val); } catch (_) {}
    }
    const newDone = { ...doneSets, [stateKey]: true };
    setDoneSets(newDone);
    setDoneSetsExternal(newDone);

    // Clear ALL active timers and vibration tracking immediately (fix 1 & 2)
    vibratedRef.current = {};
    setRestEndTimes({});

    const allSetsOfThisExDone = Array.from(
      { length: totalSets }, (_, i) => `${exId}_${i + 1}`
    ).every(k => newDone[k]);

    // Start rest timer only if this is NOT the final set (fix 3)
    if (!allSetsOfThisExDone) startRestTimer(stateKey, defaultRest || 60);

    const isAllDone = exercises.every(ex =>
      isSkipped(ex) || Array.from({ length: getTotalSets(ex) }, (_, i) => `${ex.id}_${i + 1}`).every(k => newDone[k])
    );

    // Write startedAt on first set completed (so trainer sees "In Progress")
    const totalDoneCount = Object.values(newDone).filter(Boolean).length;
    const gymOrTrainer = gymId || memberId; // fallback for freelance members
    if (totalDoneCount === 1 && gymOrTrainer && memberId) {
      try {
        // Write startedAt to the assignment doc's day entry
        const { doc, updateDoc, getDoc } = require('firebase/firestore');
        const { db } = require('./shared/firebase/config');
        const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', memberId);
        const assignSnap = await getDoc(assignRef).catch(() => null);
        if (assignSnap?.exists() && assignSnap.data()?.planId) {
          const planId = assignSnap.data().planId;
          const planRef = doc(db, 'gyms', gymOrTrainer, 'clientPlans', planId);
          const planSnap = await getDoc(planRef).catch(() => null);
          if (planSnap?.exists()) {
            const plan = planSnap.data();
            const todayPlanIdx = (new Date().getDay() + 6) % 7;
            const days = (plan.days ?? []).map((d, i) =>
              i === todayPlanIdx
                ? { ...d, startedAt: Date.now() }
                : d
            );
            await updateDoc(planRef, { days }).catch(() => {});
          }
        }
      } catch (e) { console.log('startedAt write error:', e); }
    }

    if (isAllDone) {
      setAllDone(true);
      const elapsed = workoutTimer?.elapsed || 0;
      stopWorkoutTimer(elapsed);

      // Write completedAt to the plan day (so trainer sees "Completed")
      if (gymOrTrainer && memberId) {
        try {
          const { doc, updateDoc, getDoc, collection, setDoc } = require('firebase/firestore');
          const { db } = require('./shared/firebase/config');
          const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', memberId);
          const assignSnap = await getDoc(assignRef).catch(() => null);
          if (assignSnap?.exists() && assignSnap.data()?.planId) {
            const planId = assignSnap.data().planId;
            const planRef = doc(db, 'gyms', gymOrTrainer, 'clientPlans', planId);
            const planSnap = await getDoc(planRef).catch(() => null);
            if (planSnap?.exists()) {
              const plan = planSnap.data();
              const todayPlanIdx = (new Date().getDay() + 6) % 7;
              const days = (plan.days ?? []).map((d, i) =>
                i === todayPlanIdx
                  ? { ...d, completedAt: Date.now(), startedAt: d.startedAt ?? Date.now(), durationSeconds: elapsed }
                  : d
              );
              await updateDoc(planRef, { days }).catch(() => {});
            }
          }

          // Save (or update) workout log so trainer can see completion immediately
          const completionData = {
            memberId,
            memberName: memberName || '',
            gymId: gymId || null,
            planId: workoutId || '',
            planName: workoutName || '',
            dayLabel: todayWorkout?.dayLabel || '',
            status: 'completed',
            completedExercises: exercises.map(ex => ({
              exerciseId: ex.id,
              exerciseName: ex.name,
              muscleGroup: ex.muscleGroup || 'Other',
              targetSets: ex.sets,
              targetReps: ex.reps,
              actualSets: getTotalSets(ex),
              actualReps: String(customReps[`${ex.id}_1`] || ex.reps),
              weight: parseFloat(setWeights[`${ex.id}_1`] || lastWeights[`${ex.id}_1`] || '0'),
              restSeconds: ex.rest || 60,
              completed: !isSkipped(ex),
              skipped: isSkipped(ex),
              notes: ex.note || '',
              setDetails: isSkipped(ex) ? [] : Array.from({ length: getTotalSets(ex) }, (_, i) => ({
                setNo: i + 1,
                reps: parseInt(customReps[`${ex.id}_${i + 1}`] || ex.reps, 10),
                weight: parseFloat(setWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
              })),
            })),
            // Legacy format for backward compat
            exerciseLogs: exercises.map(ex => ({
              exerciseId: ex.id,
              exerciseName: ex.name,
              skipped: isSkipped(ex),
              sets: isSkipped(ex) ? [] : Array.from({ length: getTotalSets(ex) }, (_, i) => ({
                setNo: i + 1,
                reps: parseInt(customReps[`${ex.id}_${i + 1}`] || ex.reps, 10),
                weight: parseFloat(setWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
                done: !!doneSets[`${ex.id}_${i + 1}`],
              })),
            })),
            durationSeconds: elapsed,
            startedAt: Date.now() - (elapsed * 1000),
            completedAt: Date.now(),
            loggedAt: new Date().toISOString(),
            updatedAt: Date.now(),
          };
          if (activeLogRef.current) {
            // Update the in-progress log we created on mount (or the trainer-started log)
            await updateDoc(activeLogRef.current, completionData).catch(async () => {
              // Fallback: create new if update fails (doc may not exist)
              const fb = doc(collection(db, 'gyms', gymOrTrainer, 'workoutLogs'));
              await setDoc(fb, { id: fb.id, ...completionData });
            });
          } else {
            const logRef = doc(collection(db, 'gyms', gymOrTrainer, 'workoutLogs'));
            await setDoc(logRef, { id: logRef.id, ...completionData });
          }

          // Update member's lastWorkoutAt
          const { updateDoc: upd, doc: d } = require('firebase/firestore');
          await upd(d(db, 'members', memberId), { lastWorkoutAt: Date.now() }).catch(() => {});
        } catch (e) { console.log('Workout complete write error:', e); }
      }
    }
  };

  const getTotalSets = (ex) => Math.max(0, ex.sets + (extraSets[ex.id] || 0));
  const isSkipped = (ex) => getTotalSets(ex) === 0;

  const allSetsOf = (ex) =>
    isSkipped(ex) || Array.from({ length: getTotalSets(ex) }, (_, i) => `${ex.id}_${i + 1}`).every(k => doneSets[k]);

  const doneCount = exercises.filter(ex => allSetsOf(ex)).length;
  const elapsed = workoutTimer?.elapsed || 0;
  const elapsedColor = allDone ? C.green : elapsed > 3600 ? C.red : elapsed > 1800 ? C.amber : C.green;

  // ── Flash animation for set completion micro-interaction ─────────────────
  // A single Animated.Value drives a brief green-flash on whichever set was
  // just marked done. The flash (opacity 0.6 → 0) runs in 500 ms then the
  // latestDone key is cleared so normal styles resume.
  const flashAnim  = useRef(new Animated.Value(0)).current;
  const [latestDone, setLatestDone] = useState(null);

  const triggerFlash = (stateKey) => {
    setLatestDone(stateKey);
    flashAnim.setValue(0.6);
    Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(
      () => setLatestDone(null)
    );
  };

  // Wrap markSetDone to also fire the flash
  const markSetDoneWithFlash = (...args) => {
    const stateKey = `${args[0]}_${args[1]}`;
    markSetDone(...args);
    triggerFlash(stateKey);
  };

  // ── Quick-adjust weight helpers ───────────────────────────────────────────
  const adjustWeight = (stateKey, delta) => {
    const cur = parseFloat(setWeights[stateKey] || lastWeights[stateKey] || '0');
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
    const updated = { ...setWeights, [stateKey]: String(next) };
    setSetWeights(updated);
    setSetWeightsExternal(updated);
  };

  const matchLast = (stateKey) => {
    const lastW = lastWeights[stateKey];
    if (!lastW) return;
    const updated = { ...setWeights, [stateKey]: lastW };
    setSetWeights(updated);
    setSetWeightsExternal(updated);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>

      {/* ── Header bar ────────────────────────────────────────────────────
          Back chevron · centered workout name + live timer · done count
      */}
      <View style={lv.logHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={8} style={lv.backChip}>
          <Ionicons name="chevron-back" size={24} color={C.dark} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={lv.logTitle} numberOfLines={1}>{workoutName || 'Workout Log'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons
              name={allDone ? 'checkmark-circle' : 'time-outline'}
              size={13}
              color={elapsedColor}
            />
            <Text style={[lv.globalTimer, { color: elapsedColor }]}>{formatElapsed(elapsed)}</Text>
          </View>
        </View>

        {/* Done pill — X/N exercises */}
        <View style={[lv.doneCountPill, allDone && lv.doneCountPillDone]}>
          <Text style={[lv.doneCountTxt, allDone && lv.doneCountTxtDone]}>
            {doneCount}/{exercises.length}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={lv.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Exercise cards ─────────────────────────────────────────────
            State stripe on left edge:
              • brand-500 = active / in-progress
              • success-600 = done
              • neutral = pending / skipped
        */}
        {/* ── Render grouped display items ──────────────────────────────
            Groups: superset → one card, circuit → one card, regular → one card each */}
        {displayItems.map((item, itemIdx) => {

          /* ── SUPERSET GROUP CARD ──────────────────────────────────── */
          if (item.type === 'superset') {
            const SS_COLORS = { A:'#ef4444', B:'#f97316', C:'#8b5cf6', D:'#06b6d4' };
            const ssColor   = SS_COLORS[item.id] || C.primary;
            const allSSDone = item.exercises.every(e => allSetsOf(e));
            return (
              <View key={`ss_${item.id}_${itemIdx}`} style={[lv.exCard, allSSDone && lv.exCardDone, { borderLeftWidth: 4, borderLeftColor: ssColor }]}>
                {/* Superset header */}
                <View style={[lv.exHeader, { borderBottomWidth: 1, borderBottomColor: `${ssColor}25` }]}>
                  <View style={[lv.exStatusChip, { backgroundColor: `${ssColor}18`, borderColor: `${ssColor}40` }]}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: ssColor }}>SS</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[lv.exName, { color: ssColor }]}>Superset {item.id}</Text>
                    <Text style={lv.exMeta}>{item.exercises.length} exercises · {item.restSeconds}s rest after pair</Text>
                  </View>
                  {allSSDone && <Ionicons name="checkmark-circle" size={22} color={C.green} />}
                </View>
                {/* Each exercise in superset */}
                {item.exercises.map((ex, ei) => {
                  const isOpen    = expanded === ex.id;
                  const totalSets = getTotalSets(ex);
                  const isDone    = allSetsOf(ex);
                  const doneCnt   = Array.from({ length: totalSets }, (_, i) => doneSets[`${ex.id}_${i+1}`]).filter(Boolean).length;
                  return (
                    <View key={ex.id} style={{ borderTopWidth: ei > 0 ? 1 : 0, borderTopColor: `${ssColor}18` }}>
                      <TouchableOpacity style={[lv.exHeader, { paddingVertical: 8 }]}
                        onPress={() => setExpanded(isOpen ? null : ex.id)} activeOpacity={0.8}>
                        <View style={[lv.exStatusChip, isDone ? lv.exStatusChipDone : doneCnt > 0 ? lv.exStatusChipActive : lv.exStatusChipIdle]}>
                          {isDone ? <Ionicons name="checkmark" size={16} color="#fff" />
                            : doneCnt > 0 ? <Text style={lv.exStatusCount}>{doneCnt}</Text>
                            : <Ionicons name="play" size={13} color={C.mid} />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[lv.exName, isDone && lv.exNameDone]} numberOfLines={1}>{ex.name}</Text>
                          <Text style={lv.exMeta}>{totalSets} sets × {ex.trackingType === 'time' ? `${ex.durationSeconds||30}${ex.durationSecondsMax?`–${ex.durationSecondsMax}`:''}s` : `${ex.reps}${ex.repsMax?`–${ex.repsMax}`:''} reps`}</Text>
                        </View>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
                      </TouchableOpacity>
                      {isOpen && (
                        <View style={lv.setList}>
                          {Array.from({ length: totalSets }, (_, i) => {
                            const setNo   = i + 1;
                            const sk      = `${ex.id}_${setNo}`;
                            const done    = doneSets[sk];
                            const cur     = !done && Array.from({ length: setNo-1 }, (_, j) => `${ex.id}_${j+1}`).every(k => doneSets[k]);
                            const lastW   = lastWeights[sk];
                            const isFlash = latestDone === sk;
                            return (
                              <View key={setNo}>
                                <View style={[lv.setRow, done && lv.setRowDone, cur && lv.setRowCurrent, isFlash && { overflow: 'hidden' }]}>
                                  {isFlash && <Animated.View pointerEvents="none" style={[lv.flashOverlay, { opacity: flashAnim }]} />}
                                  <View style={[lv.setNumBadge, done ? lv.setNumBadgeDone : cur ? lv.setNumBadgeCurrent : null]}>
                                    {done ? <Ionicons name="checkmark" size={13} color="#fff" />
                                      : <Text style={[lv.setNumTxt, cur && lv.setNumTxtCurrent]}>{setNo}</Text>}
                                  </View>
                                  <View style={lv.repsCol}>
                                    <Text style={lv.fieldLabel}>{ex.trackingType === 'time' ? 'SEC' : 'REPS'}</Text>
                                    {done
                                      ? <Text style={lv.fieldValueDone}>{customReps[sk] ?? (ex.trackingType === 'time' ? ex.durationSeconds ?? 30 : ex.reps)}</Text>
                                      : <TextInput style={[lv.fieldInput, cur && lv.fieldInputActive]} keyboardType="number-pad" maxLength={4}
                                          value={String(customReps[sk] ?? (ex.trackingType === 'time' ? ex.durationSeconds ?? 30 : ex.reps))}
                                          onChangeText={v => setCustomReps(p => ({ ...p, [sk]: v.replace(/\D/g,'') }))} selectTextOnFocus />}
                                  </View>
                                  {ex.trackingType !== 'time' && (
                                    <View style={lv.weightCol}>
                                      <Text style={lv.fieldLabel}>KG</Text>
                                      {done ? <Text style={lv.fieldValueDone}>{setWeights[sk] || lastW || '—'}</Text>
                                        : <TextInput style={[lv.fieldInput, lv.fieldInputWide, cur && lv.fieldInputActive]} keyboardType="decimal-pad"
                                            placeholder={lastW || '0'} placeholderTextColor={C.muted} value={setWeights[sk] || ''}
                                            onChangeText={v => { const u = { ...setWeights, [sk]: v }; setSetWeights(u); setSetWeightsExternal(u); }} selectTextOnFocus />}
                                    </View>
                                  )}
                                  {done
                                    ? <View style={lv.doneTick}><Ionicons name="checkmark-circle" size={30} color={C.green} /></View>
                                    : <TouchableOpacity style={[lv.completeSetBtn, cur && lv.completeSetBtnActive]}
                                        onPress={() => markSetDoneWithFlash(ex.id, setNo, ex.rest, totalSets)} activeOpacity={0.75}>
                                        <Ionicons name="checkmark" size={20} color={cur ? '#fff' : C.muted} />
                                      </TouchableOpacity>}
                                </View>
                                {done && restTimers[sk] > 0 && <RestTimerStrip stateKey={sk} restTimers={restTimers} adjustRest={adjustRest} C={C} />}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          }

          /* ── CIRCUIT GROUP CARD ───────────────────────────────────── */
          if (item.type === 'circuit') {
            const cId         = item.id;
            const totalRounds = item.rounds;
            const curRound    = circuitRound[cId] || 1;
            const isDone      = !!circuitCompleted[cId];

            const getActual = (exId) => {
              const key = `${cId}_${curRound}_${exId}`;
              return circuitActuals[key] ?? null;
            };
            const setActual = (exId, val) => {
              setCircuitActuals(prev => ({ ...prev, [`${cId}_${curRound}_${exId}`]: val }));
            };

            const completeRound = () => {
              if (curRound >= totalRounds) {
                setCircuitCompleted(prev => ({ ...prev, [cId]: true }));
                // Fire rest timer on a dummy key so it shows
                const endKey = `circuit_${cId}_done`;
                setRestEndTimes(prev => ({ ...prev, [endKey]: Date.now() + item.restSeconds * 1000 }));
              } else {
                const endKey = `circuit_${cId}_r${curRound}`;
                setRestEndTimes(prev => ({ ...prev, [endKey]: Date.now() + item.restSeconds * 1000 }));
                setCircuitRound(prev => ({ ...prev, [cId]: curRound + 1 }));
              }
            };

            return (
              <View key={`c_${cId}_${itemIdx}`} style={[lv.exCard, isDone && lv.exCardDone, { borderLeftWidth: 4, borderLeftColor: C.primary }]}>
                {/* Circuit header */}
                <View style={[lv.exHeader, { borderBottomWidth: 1, borderBottomColor: 'rgba(79,70,229,0.15)' }]}>
                  <View style={[lv.exStatusChip, { backgroundColor: 'rgba(79,70,229,0.12)', borderColor: 'rgba(79,70,229,0.3)' }]}>
                    {isDone ? <Ionicons name="checkmark" size={16} color="#fff" style={{ backgroundColor: C.green, borderRadius: 12 }} />
                      : <Text style={{ fontSize: 12, fontWeight: '800', color: C.primary }}>⚡</Text>}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[lv.exName, { color: C.primary }]}>Circuit {cId}</Text>
                    <Text style={lv.exMeta}>{totalRounds} rounds · {item.restSeconds}s rest between rounds</Text>
                  </View>
                  {isDone && <Ionicons name="checkmark-circle" size={22} color={C.green} />}
                </View>

                {!isDone && (
                  <View style={{ padding: 14 }}>
                    {/* Round tracker */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: C.mid }}>ROUND</Text>
                      {Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => (
                        <View key={r} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: r < curRound ? C.green : r === curRound ? C.primary : 'rgba(79,70,229,0.1)',
                          borderWidth: r === curRound ? 0 : 1.5, borderColor: r < curRound ? C.green : 'rgba(79,70,229,0.25)' }}>
                          {r < curRound
                            ? <Ionicons name="checkmark" size={14} color="#fff" />
                            : <Text style={{ fontSize: 12, fontWeight: '800', color: r === curRound ? '#fff' : C.primary }}>{r}</Text>}
                        </View>
                      ))}
                    </View>

                    {/* Exercise rows — one per exercise in the circuit */}
                    {item.exercises.map((ex, ei) => {
                      const isTime = ex.trackingType === 'time';
                      const target = isTime ? (ex.durationSeconds || 30) : ex.reps;
                      const actual = getActual(ex.id);
                      return (
                        <View key={ex.id} style={{ marginBottom: 10, paddingBottom: 10,
                          borderBottomWidth: ei < item.exercises.length - 1 ? 1 : 0,
                          borderBottomColor: 'rgba(79,70,229,0.1)' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 15, fontWeight: '600', color: C.dark }}>{ex.name}</Text>
                              <Text style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>
                                Target: {target}{isTime ? 's' : ' reps'}
                                {(isTime && ex.durationSecondsMax) ? `–${ex.durationSecondsMax}s` : ''}
                                {(!isTime && ex.repsMax) ? `–${ex.repsMax} reps` : ''}
                              </Text>
                            </View>
                            {/* Actual input */}
                            <View style={{ alignItems: 'center', minWidth: 64 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: C.primary, marginBottom: 3 }}>
                                {isTime ? 'SEC DONE' : 'REPS DONE'}
                              </Text>
                              <TextInput
                                style={{ width: 64, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: C.primary + '60',
                                  backgroundColor: 'rgba(79,70,229,0.06)', textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.dark }}
                                keyboardType="number-pad"
                                maxLength={4}
                                value={actual != null ? String(actual) : String(target)}
                                onChangeText={v => setActual(ex.id, v.replace(/\D/g, ''))}
                                selectTextOnFocus
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    {/* Complete Round button */}
                    <TouchableOpacity
                      style={{ backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 }}
                      activeOpacity={0.8}
                      onPress={completeRound}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                        {curRound >= totalRounds ? '✓ Complete Circuit' : `Complete Round ${curRound}`}
                      </Text>
                    </TouchableOpacity>

                    {/* Rest timer after round */}
                    {Object.entries(restTimers).filter(([k]) => k.startsWith(`circuit_${cId}`)).map(([k, secs]) =>
                      secs > 0 ? <RestTimerStrip key={k} stateKey={k} restTimers={restTimers} adjustRest={adjustRest} C={C} /> : null
                    )}
                  </View>
                )}

                {isDone && (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: C.green, fontWeight: '700', fontSize: 15 }}>
                      ✓ All {totalRounds} rounds complete!
                    </Text>
                  </View>
                )}
              </View>
            );
          }

          /* ── REGULAR EXERCISE CARD (unchanged logic) ──────────────── */
          const ex = item.exercises[0];
          {
          const isOpen        = expanded === ex.id;
          const totalSets     = getTotalSets(ex);
          const skipped       = isSkipped(ex);
          const isDone        = allSetsOf(ex);
          const doneSetsCount = Array.from({ length: totalSets }, (_, i) => doneSets[`${ex.id}_${i + 1}`]).filter(Boolean).length;
          const isInProgress  = doneSetsCount > 0 && !isDone;

          // "Previous workout" summary: best weight across all sets last time
          const prevWeightVals = Array.from({ length: totalSets }, (_, i) => lastWeights[`${ex.id}_${i + 1}`]).filter(Boolean);
          const prevSummary    = prevWeightVals.length
            ? `Last: ${ex.reps}×${prevWeightVals[0]}kg`
            : null;

          // Left stripe color encodes exercise state
          const stripeColor = isDone && !skipped
            ? C.green
            : isInProgress
              ? C.primary
              : C.light;

          return (
            <View key={ex.id} style={[lv.exCard, isDone && !skipped && lv.exCardDone, isInProgress && lv.exCardActive]}>
              {/* Colored left accent stripe */}
              <View style={[lv.exStripe, { backgroundColor: stripeColor }]} />

              {/* Card header — tap to expand/collapse */}
              <TouchableOpacity
                style={lv.exHeader}
                onPress={() => setExpanded(isOpen ? null : ex.id)}
                activeOpacity={0.8}
              >
                {/* Status icon chip — tap to open video */}
                <TouchableOpacity
                  style={[lv.exStatusChip,
                    isDone && !skipped ? lv.exStatusChipDone :
                    isInProgress       ? lv.exStatusChipActive :
                    lv.exStatusChipIdle]}
                  onPress={() => setVideoExName({ name: ex.name, videoUrl: ex.videoUrl })}
                  activeOpacity={0.7}
                  hitSlop={4}
                >
                  {isDone && !skipped
                    ? <Ionicons name="checkmark" size={18} color="#fff" />
                    : isInProgress
                      ? <Text style={lv.exStatusCount}>{doneSetsCount}</Text>
                      : <Ionicons name="play" size={15} color={C.mid} />}
                </TouchableOpacity>

                {/* Name · meta · prev · progress */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[lv.exName, (isDone || skipped) && lv.exNameDone]} numberOfLines={1}>
                    {ex.name}
                    {skipped ? <Text style={lv.skippedTag}> · Skipped</Text> : null}
                  </Text>

                  <Text style={lv.exMeta}>
                    {skipped ? 'Exercise skipped' : (() => {
                      const isTime = ex.trackingType === 'time';
                      const metric = isTime
                        ? `${ex.durationSeconds || 30}${ex.durationSecondsMax ? `–${ex.durationSecondsMax}` : ''}s`
                        : `${ex.reps}${ex.repsMax ? `–${ex.repsMax}` : ''} reps`;
                      if (ex.circuitId) {
                        return `Circuit ${ex.circuitId}  ·  ${metric}  ·  ${ex.circuitRounds || 3} rounds`;
                      }
                      return `${totalSets} sets × ${metric} · ${ex.rest}s rest`;
                    })()}
                    {ex.supersetGroup && !ex.circuitId ? `  ·  SS:${ex.supersetGroup}` : ''}
                  </Text>

                  {/* Previous workout data — "Last: 8×35kg" */}
                  {prevSummary && !isDone ? (
                    <Text style={lv.exPrev}>{prevSummary}</Text>
                  ) : null}

                  {/* Progress bar + fraction (only when in progress) */}
                  {isInProgress && (
                    <View style={lv.progressRow}>
                      <View style={lv.progressTrack}>
                        <View style={[lv.progressFill, { width: `${(doneSetsCount / totalSets) * 100}%` }]} />
                      </View>
                      <Text style={lv.progressFraction}>{doneSetsCount}/{totalSets} sets</Text>
                    </View>
                  )}
                </View>

                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={isDone ? C.green : isInProgress ? C.primary : C.muted}
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>

              {/* ── Expanded: set rows ────────────────────────────────── */}
              {isOpen && (
                <View style={lv.setList}>
                  {skipped ? (
                    <View style={lv.skippedBody}>
                      <Text style={lv.skippedBodyTxt}>Exercise was skipped</Text>
                      <TouchableOpacity
                        style={lv.addSetBtn}
                        onPress={() => setExtraSets(prev => ({ ...prev, [ex.id]: (prev[ex.id] || 0) + 1 }))}>
                        <Ionicons name="add" size={14} color={C.primary} />
                        <Text style={lv.addSetTxt}>Add Set</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {Array.from({ length: totalSets }, (_, i) => {
                        const setNo    = i + 1;
                        const stateKey = `${ex.id}_${setNo}`;
                        const isDoneSet = doneSets[stateKey];
                        const lastW    = lastWeights[stateKey];

                        // "Current" = first undone set in this exercise
                        const isCurrent = !isDoneSet && Array.from(
                          { length: setNo - 1 }, (_, j) => `${ex.id}_${j + 1}`
                        ).every(k => doneSets[k]);

                        // Flash overlay opacity — only on the just-completed set
                        const isFlashing = latestDone === stateKey;

                        return (
                          <View key={setNo}>
                            {/* Set row — three visual states: done / current / pending */}
                            <View style={[
                              lv.setRow,
                              isDoneSet  && lv.setRowDone,
                              isCurrent  && lv.setRowCurrent,
                              isFlashing && { overflow: 'hidden' },
                            ]}>
                              {/* Green flash overlay on completion */}
                              {isFlashing && (
                                <Animated.View
                                  pointerEvents="none"
                                  style={[lv.flashOverlay, { opacity: flashAnim }]}
                                />
                              )}

                              {/* Set number badge */}
                              <View style={[
                                lv.setNumBadge,
                                isDoneSet  ? lv.setNumBadgeDone :
                                isCurrent  ? lv.setNumBadgeCurrent : null,
                              ]}>
                                {isDoneSet
                                  ? <Ionicons name="checkmark" size={13} color="#fff" />
                                  : <Text style={[
                                      lv.setNumTxt,
                                      isCurrent && lv.setNumTxtCurrent,
                                    ]}>{setNo}</Text>}
                              </View>

                              {/* Reps / Duration input */}
                              <View style={lv.repsCol}>
                                <Text style={lv.fieldLabel}>
                                  {ex.trackingType === 'time' ? 'SEC' : 'REPS'}
                                </Text>
                                {isDoneSet ? (
                                  <Text style={[lv.fieldValueDone]}>
                                    {ex.trackingType === 'time'
                                      ? (customReps[stateKey] ?? ex.durationSeconds ?? 30)
                                      : (customReps[stateKey] ?? ex.reps)}
                                  </Text>
                                ) : (
                                  <TextInput
                                    style={[lv.fieldInput, isCurrent && lv.fieldInputActive]}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    value={String(customReps[stateKey] ?? (ex.trackingType === 'time' ? (ex.durationSeconds ?? 30) : ex.reps))}
                                    onChangeText={val =>
                                      setCustomReps(prev => ({ ...prev, [stateKey]: val.replace(/[^0-9]/g, '') }))
                                    }
                                    selectTextOnFocus
                                  />
                                )}
                              </View>

                              {/* Weight input — hidden for time-based exercises */}
                              {ex.trackingType !== 'time' && (
                              <View style={lv.weightCol}>
                                <Text style={lv.fieldLabel}>KG</Text>
                                {isDoneSet ? (
                                  <Text style={lv.fieldValueDone}>
                                    {setWeights[stateKey] || lastW || '—'}
                                  </Text>
                                ) : (
                                  <View style={lv.weightInputRow}>
                                    <TextInput
                                      style={[lv.fieldInput, lv.fieldInputWide, isCurrent && lv.fieldInputActive]}
                                      keyboardType="decimal-pad"
                                      placeholder={lastW || '0'}
                                      placeholderTextColor={C.muted}
                                      value={setWeights[stateKey] || ''}
                                      editable={!isDoneSet}
                                      onFocus={() => {}}
                                      onChangeText={val => {
                                        const updated = { ...setWeights, [stateKey]: val };
                                        setSetWeights(updated);
                                        setSetWeightsExternal(updated);
                                      }}
                                      selectTextOnFocus
                                    />
                                  </View>
                                )}
                              </View>
                              )}

                              {/* Complete-set button or done tick */}
                              {isDoneSet ? (
                                <View style={lv.doneTick}>
                                  <Ionicons name="checkmark-circle" size={30} color={C.green} />
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={[lv.completeSetBtn, isCurrent && lv.completeSetBtnActive]}
                                  onPress={() => markSetDoneWithFlash(ex.id, setNo, ex.rest, totalSets)}
                                  activeOpacity={0.75}
                                >
                                  <Ionicons name="checkmark" size={20} color={isCurrent ? '#fff' : C.muted} />
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Quick-action bar — hidden for time-based, shown only below the current active set */}
                            {isCurrent && !isDoneSet && ex.trackingType !== 'time' && (
                              <View style={lv.quickActions}>
                                {lastW ? (
                                  <TouchableOpacity
                                    style={lv.quickBtn}
                                    onPress={() => matchLast(stateKey)}
                                  >
                                    <Text style={lv.quickBtnTxt}>Match last</Text>
                                  </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity
                                  style={lv.quickBtn}
                                  onPress={() => adjustWeight(stateKey, 2.5)}
                                >
                                  <Text style={lv.quickBtnTxt}>+2.5 kg</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={lv.quickBtn}
                                  onPress={() => adjustWeight(stateKey, 5)}
                                >
                                  <Text style={lv.quickBtnTxt}>+5 kg</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={lv.quickBtn}
                                  onPress={() => adjustWeight(stateKey, -2.5)}
                                >
                                  <Text style={lv.quickBtnTxt}>−2.5</Text>
                                </TouchableOpacity>
                              </View>
                            )}

                            {/* Rest timer strip — shown after completing a set */}
                            {isDoneSet && restTimers[stateKey] !== undefined && restTimers[stateKey] > 0 && (
                              <RestTimerStrip
                                stateKey={stateKey}
                                restTimers={restTimers}
                                adjustRest={adjustRest}
                                C={C}
                              />
                            )}
                          </View>
                        );
                      })}

                      {/* Add / Remove set row */}
                      <View style={lv.setActions}>
                        <TouchableOpacity
                          style={lv.addSetBtn}
                          onPress={() => setExtraSets(prev => ({ ...prev, [ex.id]: (prev[ex.id] || 0) + 1 }))}>
                          <Ionicons name="add-circle-outline" size={15} color={C.primary} />
                          <Text style={lv.addSetTxt}>Add Set</Text>
                        </TouchableOpacity>
                        {totalSets > 0 && (
                          <TouchableOpacity
                            style={lv.removeSetBtn}
                            onPress={() => {
                              const key = `${ex.id}_${totalSets}`;
                              if (doneSets[key]) setDoneSets(prev => { const n = { ...prev }; delete n[key]; return n; });
                              if (setWeights[key]) setSetWeights(prev => { const n = { ...prev }; delete n[key]; return n; });
                              setExtraSets(prev => ({ ...prev, [ex.id]: (prev[ex.id] || 0) - 1 }));
                            }}>
                            <Ionicons name="remove-circle-outline" size={15} color={C.red} />
                            <Text style={lv.removeSetTxt}>Remove Set</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Trainer note */}
                      {ex.note ? (
                        <View style={lv.trainerNoteRow}>
                          <Ionicons name="chatbubble-ellipses-outline" size={13} color={C.primary} />
                          <Text style={lv.trainerNote}>{ex.note}</Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              )}
            </View>
          );
          } // end regular exercise block
        })}

        {/* ── Mark Workout Complete CTA ─────────────────────────────────── */}
        {exercises.length > 0 && isLogging && !allDone && (
          <TouchableOpacity
            style={lv.markCompleteBtn}
            activeOpacity={0.85}
            onPress={() => { setCompleteMinutes(''); setShowCompleteModal(true); }}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={lv.markCompleteTxt}>Mark Workout Complete</Text>
          </TouchableOpacity>
        )}

        {/* ── Complete-workout duration modal ───────────────────────────── */}
        <Modal visible={showCompleteModal} transparent animationType="fade" onRequestClose={() => setShowCompleteModal(false)}>
          <View style={lv.modalBackdrop}>
            <View style={lv.modalSheet}>
              <Text style={lv.modalTitle}>Finish Workout?</Text>
              <Text style={lv.modalSub}>Override duration (optional — we'll use the elapsed timer if left empty)</Text>
              <TextInput
                style={lv.modalInput}
                keyboardType="number-pad"
                placeholder="Minutes (e.g. 45)"
                placeholderTextColor={C.muted}
                value={completeMinutes}
                onChangeText={setCompleteMinutes}
                autoFocus
              />
              <View style={lv.modalBtnRow}>
                <TouchableOpacity style={lv.modalCancelBtn} onPress={() => setShowCompleteModal(false)}>
                  <Text style={lv.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={lv.modalConfirmBtn}
                  onPress={async () => {
                    const mins = parseInt(completeMinutes, 10);
                    const overrideSeconds = (Number.isFinite(mins) && mins > 0)
                      ? mins * 60
                      : Math.max(0, workoutTimer?.elapsed || 0);
                    setShowCompleteModal(false);
                    stopWorkoutTimer(overrideSeconds);
                    setAllDone(true);
                    const gymOrTrainer = gymId || memberId;
                    if (gymOrTrainer && memberId) {
                      try {
                        const { doc, updateDoc, getDoc, collection, setDoc } = require('firebase/firestore');
                        const { db } = require('./shared/firebase/config');
                        const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', memberId);
                        const assignSnap = await getDoc(assignRef).catch(() => null);
                        if (assignSnap?.exists() && assignSnap.data()?.planId) {
                          const planRef = doc(db, 'gyms', gymOrTrainer, 'clientPlans', assignSnap.data().planId);
                          const planSnap = await getDoc(planRef).catch(() => null);
                          if (planSnap?.exists()) {
                            const todayIdx = (new Date().getDay() + 6) % 7;
                            const days = (planSnap.data().days ?? []).map((d, i) =>
                              i === todayIdx
                                ? { ...d, completedAt: Date.now(), startedAt: d.startedAt ?? Date.now(), durationSeconds: overrideSeconds }
                                : d
                            );
                            await updateDoc(planRef, { days }).catch(() => {});
                          }
                        }
                        const completionData = {
                          memberId, memberName: memberName || '', gymId: gymId || null,
                          planId: workoutId || '', planName: workoutName || '',
                          dayLabel: todayWorkout?.dayLabel || '', status: 'completed',
                          completedExercises: exercises.map(ex => ({
                            exerciseId: ex.id, exerciseName: ex.name,
                            muscleGroup: ex.muscleGroup || 'Other',
                            targetSets: ex.sets, targetReps: ex.reps,
                            actualSets: getTotalSets(ex), actualReps: String(customReps[`${ex.id}_1`] || ex.reps),
                            weight: parseFloat(setWeights[`${ex.id}_1`] || lastWeights[`${ex.id}_1`] || '0'),
                            restSeconds: ex.rest || 60, completed: !isSkipped(ex), skipped: isSkipped(ex),
                            notes: ex.note || '',
                            setDetails: isSkipped(ex) ? [] : Array.from({ length: getTotalSets(ex) }, (_, i) => ({
                              setNo: i + 1, reps: parseInt(customReps[`${ex.id}_${i + 1}`] || ex.reps, 10),
                              weight: parseFloat(setWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
                            })),
                          })),
                          exerciseLogs: exercises.map(ex => ({
                            exerciseId: ex.id, exerciseName: ex.name, skipped: isSkipped(ex),
                            sets: isSkipped(ex) ? [] : Array.from({ length: getTotalSets(ex) }, (_, i) => ({
                              setNo: i + 1, reps: parseInt(customReps[`${ex.id}_${i + 1}`] || ex.reps, 10),
                              weight: parseFloat(setWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
                              done: !!doneSets[`${ex.id}_${i + 1}`],
                            })),
                          })),
                          durationSeconds: overrideSeconds,
                          startedAt: Date.now() - overrideSeconds * 1000,
                          completedAt: Date.now(),
                          loggedAt: new Date().toISOString(),
                          updatedAt: Date.now(),
                          manualComplete: true,
                        };
                        if (activeLogRef.current) {
                          await updateDoc(activeLogRef.current, completionData).catch(async () => {
                            const fb = doc(collection(db, 'gyms', gymOrTrainer, 'workoutLogs'));
                            await setDoc(fb, { id: fb.id, ...completionData });
                          });
                        } else {
                          const logRef = doc(collection(db, 'gyms', gymOrTrainer, 'workoutLogs'));
                          await setDoc(logRef, { id: logRef.id, ...completionData });
                        }
                        await updateDoc(doc(db, 'members', memberId), { lastWorkoutAt: Date.now() }).catch(() => {});
                      } catch (e) { console.log('Manual complete write error:', e); }
                    }
                  }}
                >
                  <Text style={lv.modalConfirmTxt}>Complete Workout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Celebration finish overlay ─────────────────────────────────── */}
        {allDone && (
          <View style={lv.finishOverlay}>
            <View style={lv.finishGlow} />
            <View style={lv.finishIconCircle}>
              <Ionicons name="trophy" size={44} color="#fff" />
            </View>
            <Text style={lv.finishTitle}>Workout Complete!</Text>
            <Text style={lv.finishGreeting}>Great job, {memberName}! 💪</Text>
            <View style={lv.finishTimerRow}>
              <Ionicons name="time-outline" size={20} color={C.green} />
              <Text style={lv.finishTimerTxt}>{formatElapsed(elapsed)}</Text>
            </View>
            <Text style={lv.finishTimerLabel}>Total Duration</Text>
            <View style={lv.finishDivider} />
            <View style={lv.finishStatRow}>
              <View style={lv.finishStatBox}>
                <Text style={lv.finishStatVal}>{exercises.length}</Text>
                <Text style={lv.finishStatLbl}>Exercises</Text>
              </View>
              <View style={[lv.finishStatBox, { borderLeftWidth: 1, borderLeftColor: C.border }]}>
                <Text style={lv.finishStatVal}>{exercises.reduce((a, e) => a + getTotalSets(e), 0)}</Text>
                <Text style={lv.finishStatLbl}>Total Sets</Text>
              </View>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <ExerciseVideoModal
        visible={!!videoExName}
        exerciseName={videoExName?.name || videoExName}
        videoUrl={videoExName?.videoUrl}
        onClose={() => setVideoExName(null)}
      />
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RPEPickerRow — inline Rate of Perceived Exertion selector.
//   Appears below a set row immediately after it is marked done.
//   Auto-dismisses after 4 s if not tapped (parent sets pendingRpeKey=null).
//   Zones: 1-3 easy (success), 4-6 moderate (brand), 7-8 hard (warning),
//          9-10 max (danger) — colour-coded for intuition, not just numbers.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ManualBreakTimer — user-controlled countdown timer for set breaks.
//
//   Separate from the auto-rest timer (which fires after marking a set done
//   based on the exercise's rest period). This one the user starts manually:
//   "I'm taking a break now — start counting."
//
//   Behaviour:
//     • Default target: 60 s. +30/−30 adjust before or during countdown.
//     • Start/Pause toggles the countdown. Pause preserves remaining time.
//     • Reaches 0: haptic double-buzz, shows "Done!" in green.
//     • Reset: returns to 60 s, stopped.
//     • A thin progress bar across the top drains as time runs out — turns
//       amber < 20 s, red < 10 s to signal urgency without a sound.
//
//   Design: compact, ≤60px tall — doesn't compete with the exercise cards.
// ─────────────────────────────────────────────────────────────────────────────
function ManualBreakTimer({ C, t }) {
  const DEFAULT = 60;
  const [remaining, setRemaining] = useState(DEFAULT);
  const [target,    setTarget]    = useState(DEFAULT);
  const [running,   setRunning]   = useState(false);
  const endTimeRef  = useRef(null);
  const tickRef     = useRef(null);

  // ── Tick ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const r = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) {
        clearInterval(tickRef.current);
        setRunning(false);
        Vibration.vibrate([0, 300, 150, 300]);  // double buzz at done
      }
    };
    tick();
    tickRef.current = setInterval(tick, 300);
    return () => clearInterval(tickRef.current);
  }, [running]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const handleStartPause = () => {
    if (running) {
      clearInterval(tickRef.current);
      setRunning(false);
      setTarget(remaining);      // next start will count from current remaining
      endTimeRef.current = null;
    } else {
      Vibration.vibrate(8);
      endTimeRef.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  };

  const handleAdjust = (delta) => {
    Vibration.vibrate(8);
    setRemaining(prev => {
      const next = Math.max(10, prev + delta);
      if (running && endTimeRef.current) {
        endTimeRef.current = endTimeRef.current + delta * 1000;
      }
      setTarget(t2 => running ? t2 + delta : next);
      return next;
    });
  };

  const handleReset = () => {
    clearInterval(tickRef.current);
    setRunning(false);
    setRemaining(DEFAULT);
    setTarget(DEFAULT);
    endTimeRef.current = null;
  };

  // ── Display ──────────────────────────────────────────────────────────────
  const mins  = Math.floor(remaining / 60);
  const secs  = remaining % 60;
  const done  = remaining === 0;
  const pct   = target > 0 ? remaining / target : 0;

  // Color: green=idle, amber=running, red<20s, brand=done
  const barColor = done       ? t.success[500]
    : !running              ? t.brand[600]
    : remaining < 10        ? t.danger[500]
    : remaining < 20        ? t.warning[500]
    : t.success[500];

  return (
    <View style={[bt.wrap, { backgroundColor: C.card, borderColor: C.border }]}>
      {/* Thin drain bar — fills left to right as time elapses */}
      <View style={[bt.barTrack, { backgroundColor: C.light }]}>
        <View style={[bt.barFill, { width: `${(1 - pct) * 100}%`, backgroundColor: barColor }]} />
      </View>

      <View style={bt.body}>
        {/* Time display */}
        <View style={bt.timeBlock}>
          <Text style={[bt.label, { color: C.muted }]}>BREAK</Text>
          <Text style={[bt.time, { color: done ? C.green : C.dark }]}>
            {mins}:{String(secs).padStart(2, '0')}
          </Text>
        </View>

        {/* Controls */}
        <View style={bt.controls}>
          <TouchableOpacity
            style={[bt.adjBtn, { borderColor: C.border }]}
            onPress={() => handleAdjust(-30)}
            hitSlop={8}
          >
            <Text style={[bt.adjTxt, { color: C.mid }]}>−30s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[bt.playBtn, {
              backgroundColor: running
                ? (remaining < 20 ? t.danger[600] : t.warning[600])
                : t.brand[600],
            }]}
            onPress={handleStartPause}
          >
            <Ionicons name={running ? 'pause' : 'play'} size={15} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[bt.adjBtn, { borderColor: C.border }]}
            onPress={() => handleAdjust(30)}
            hitSlop={8}
          >
            <Text style={[bt.adjTxt, { color: C.mid }]}>+30s</Text>
          </TouchableOpacity>

          {/* Reset — only shown when not at default */}
          {(remaining !== DEFAULT || running) && (
            <TouchableOpacity onPress={handleReset} hitSlop={8} style={bt.resetBtn}>
              <Ionicons name="refresh" size={14} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const bt = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  // Drain bar — sits flush at top of card, 3 px tall
  barTrack: { height: 3 },
  barFill:  { height: '100%' },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  timeBlock: {},
  label: {
    fontSize: 9, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 1,
  },
  time: {
    fontSize: 26, fontWeight: '800',
    letterSpacing: -0.5, fontVariant: ['tabular-nums'],
    lineHeight: 30,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 46,
    alignItems: 'center',
  },
  adjTxt: { fontSize: 12, fontWeight: '700' },
  playBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  resetBtn: { padding: 6 },
});

// Break Timer Modal styles — used inline (colours passed via C prop)
const breakModalSheet = {
  borderTopLeftRadius: 24, borderTopRightRadius: 24,
  borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
  padding: 20, paddingTop: 12,
};
const breakModalHandle = {
  width: 36, height: 4, borderRadius: 2, backgroundColor: '#d4d4d4',
  alignSelf: 'center', marginBottom: 16,
};

function RPEPickerRow({ onSelect, onSkip, C, t }) {
  const rpeZone = (n) => {
    if (n <= 3) return t.success[600];
    if (n <= 6) return t.brand[600];
    if (n <= 8) return t.warning[600];
    return t.danger[600];
  };
  const rpeZoneBg = (n) => {
    if (n <= 3) return 'rgba(22,163,74,0.12)';
    if (n <= 6) return 'rgba(79,70,229,0.10)';
    if (n <= 8) return 'rgba(217,119,6,0.12)';
    return 'rgba(225,29,72,0.10)';
  };
  const rpeLabel = (n) => {
    if (n <= 3) return 'Easy';
    if (n <= 6) return 'Mod';
    if (n <= 8) return 'Hard';
    return 'Max';
  };

  return (
    <View style={rpe.row}>
      <Text style={[rpe.prompt, { color: C.mid }]}>RPE</Text>
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <TouchableOpacity
          key={n}
          style={[rpe.btn, { backgroundColor: rpeZoneBg(n), borderColor: rpeZone(n) + '30' }]}
          onPress={() => { Vibration.vibrate(8); onSelect(n); }}
          activeOpacity={0.75}
        >
          <Text style={[rpe.num, { color: rpeZone(n) }]}>{n}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={onSkip} style={rpe.skip} hitSlop={8}>
        <Ionicons name="close" size={14} color={C.muted} />
      </TouchableOpacity>
    </View>
  );
}

const rpe = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: theme.surface.sunken,
    borderTopWidth: 1,
    borderTopColor: theme.border.subtle,
  },
  prompt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: 26,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  num: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  skip: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── RestTimerStrip — inline rest countdown, extracted to avoid re-rendering
// the entire exercise card on every tick. Only the set whose timer is active
// renders this strip.
function RestTimerStrip({ stateKey, restTimers, adjustRest, C }) {
  const left = restTimers[stateKey] ?? 0;
  const color = left < 20 ? C.red : left < 40 ? C.amber : C.green;
  const mins = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, '0');
  return (
    <View style={lv.restStrip}>
      <Ionicons name="hourglass-outline" size={14} color={color} />
      <Text style={[lv.restStripTime, { color }]}>{mins}:{secs}</Text>
      <Text style={[lv.restStripLabel, { color }]}>rest</Text>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(stateKey, -15)}>
        <Text style={lv.restAdjTxt}>−15s</Text>
      </TouchableOpacity>
      <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(stateKey, 30)}>
        <Text style={lv.restAdjTxt}>+30s</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkoutProgressRing — pure-RN circular progress ring.
//   Uses the two-half-container technique:
//     • Background track: full-circle border at dim opacity.
//     • Right arc:  clips to right 50% of space, inner ring rotates to reveal
//                   0–180° of fill.
//     • Left arc:   clips to left 50%, reveals 180–360° when progress > 50%.
//   Rotation formula (both panels start with ring centered on the clip edge):
//     rightRotation = clamp(angle, 0, 180) − 90   →  sweeps 0° at 0%, 90° at 25%, 180° at 50%
//     leftRotation  = angle − 270                 →  sweeps 0° at 50%, 90° at 75%, 180° at 100%
// ─────────────────────────────────────────────────────────────────────────────
function WorkoutProgressRing({ progress = 0, size = 100, stroke = 8, color, trackColor, children }) {
  const half = size / 2;
  const p = Math.max(0, Math.min(1, progress));
  const angle = p * 360;

  const ringBase = {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: stroke,
  };

  return (
    <View style={{ width: size, height: size }}>
      {/* Track ring */}
      <View style={[ringBase, { borderColor: trackColor }]} />

      {/* Right clip — reveals 0-180° of progress */}
      {p > 0 && (
        <View style={{
          position: 'absolute',
          width: half, height: size,
          right: 0, overflow: 'hidden',
        }}>
          {/* Ring center (by right:0) aligns to left edge of panel = center of full circle */}
          <View style={[
            ringBase,
            { right: 0, borderColor: color },
            { transform: [{ rotate: `${Math.min(angle, 180) - 90}deg` }] },
          ]} />
        </View>
      )}

      {/* Left clip — reveals 180-360° when progress > 50% */}
      {p > 0.5 && (
        <View style={{
          position: 'absolute',
          width: half, height: size,
          left: 0, overflow: 'hidden',
        }}>
          {/* Ring center (by left:0) aligns to right edge of panel = center of full circle */}
          <View style={[
            ringBase,
            { left: 0, borderColor: color },
            { transform: [{ rotate: `${angle - 270}deg` }] },
          ]} />
        </View>
      )}

      {/* Center content overlay */}
      <View style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkoutHeroHeader — replaces the minimal sticky header during active logging.
//
//   Layout (pinned above the ScrollView, same z-layer as stickyHeader):
//
//   ┌────────────────────────────────────────────────────────┐
//   │ Row 1:  ← workout name                [■ pause] [✓]  │  48px
//   ├────────────────────────────────────────────────────────┤
//   │ Row 2:  ◯ BIG TIMER ◯    2/6 exercises    ●●●●○○    │  96px
//   ├────────────────────────────────────────────────────────┤
//   │ Row 3:  ↳ Current: Incline Barbell Press · Set 2/4   │  36px
//   ├────────────────────────────────────────────────────────┤
//   │ Row 4:  ████████████░░░░░░░░  thin progress bar       │  4px
//   └────────────────────────────────────────────────────────┘
//
//   Design parity: surface card look matching web `.card-raised`, brand-600
//   ring/accent matching web primary buttons, typography uses token scale.
// ─────────────────────────────────────────────────────────────────────────────
function WorkoutHeroHeader({
  workoutName,
  elapsed,
  doneCount,
  totalExercises,
  currentExName,
  totalDoneSets,
  totalSets,
  allDone,
  isPaused,
  elapsedColor,
  isLogging,
  C,
  t,
  onPauseToggle,
  onFinish,
  onContinue,      // enters / returns to the inline logging view
  onOpenTimer,     // opens the ManualBreakTimer modal
}) {
  const progress = totalExercises > 0 ? doneCount / totalExercises : 0;

  // Ring color: matches exercise completion state
  const ringColor = allDone ? C.green
    : progress >= 0.67 ? t.success[500]
    : progress >= 0.33 ? t.brand[400]
    : t.brand[600];

  const ringTrack = t.mode === 'dark'
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.06)';

  return (
    <View style={wkh.container}>
      {/* ── Row 1: Workout name + controls ─────────────────────── */}
      <View style={wkh.topRow}>
        {/* workoutName uses C.dark (reactive) not the frozen theme.text.primary */}
        <Text style={[wkh.workoutName, { color: C.dark }]} numberOfLines={1}>
          {workoutName || 'Workout Log'}
        </Text>
        <View style={wkh.controls}>
          {/* Pause / Resume — always visible during active workout */}
          <TouchableOpacity
            onPress={onPauseToggle}
            style={wkh.controlBtn}
            hitSlop={8}
          >
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={18}
              color={C.primary}
            />
          </TouchableOpacity>

          {/* Break timer — small clock icon, opens ManualBreakTimer modal */}
          {onOpenTimer && (
            <TouchableOpacity
              onPress={onOpenTimer}
              style={wkh.controlBtn}
              hitSlop={8}
            >
              <Ionicons name="timer-outline" size={18} color={C.primary} />
            </TouchableOpacity>
          )}

          {/* Continue → enters / re-enters the logging exercise list
              Only shown when NOT already in logging view               */}
          {!isLogging && onContinue && !allDone && (
            <TouchableOpacity
              onPress={onContinue}
              style={[wkh.controlBtn, { borderColor: C.primary + '40' }]}
              hitSlop={8}
            >
              <Ionicons name="list-outline" size={18} color={C.primary} />
            </TouchableOpacity>
          )}

          {/* Complete / Finish — icon-only, no text */}
          {!allDone && (
            <TouchableOpacity
              onPress={onFinish}
              style={[wkh.controlBtn, wkh.finishBtnIcon]}
              hitSlop={8}
            >
              <Ionicons name="checkmark-done" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Row 2: Ring timer + progress info ──────────────────── */}
      <View style={wkh.midRow}>
        {/* Circular timer ring */}
        <WorkoutProgressRing
          progress={progress}
          size={88}
          stroke={7}
          color={ringColor}
          trackColor={ringTrack}
        >
          {/* Timer inside ring */}
          <View style={{ alignItems: 'center' }}>
            {isPaused ? (
              <Ionicons name="pause" size={22} color={C.mid} />
            ) : (
              <Text style={[wkh.timerText, { color: elapsedColor }]}>
                {formatElapsed(elapsed)}
              </Text>
            )}
            <Text style={[wkh.timerLabel, { color: C.muted }]}>
              {allDone ? 'DONE' : isPaused ? 'PAUSED' : 'ELAPSED'}
            </Text>
          </View>
        </WorkoutProgressRing>

        {/* Right side: exercise count + set dots */}
        <View style={wkh.statsCol}>
          {/* Exercise fraction */}
          <View style={wkh.exFractionRow}>
            <Text style={[wkh.exDone, { color: ringColor }]}>
              {doneCount}
            </Text>
            <Text style={[wkh.exTotal, { color: C.mid }]}> of {totalExercises} exercises</Text>
          </View>

          {/* Exercise dot indicators (max 8 shown) */}
          <View style={wkh.dotsRow}>
            {Array.from({ length: Math.min(totalExercises, 8) }, (_, i) => (
              <View
                key={i}
                style={[
                  wkh.dot,
                  i < doneCount
                    ? [wkh.dotDone, { backgroundColor: ringColor }]
                    : wkh.dotPending,
                ]}
              />
            ))}
            {totalExercises > 8 && (
              <Text style={[wkh.dotsOverflow, { color: C.muted }]}>+{totalExercises - 8}</Text>
            )}
          </View>

          {/* Sets fraction */}
          {totalSets > 0 && (
            <Text style={[wkh.setsFraction, { color: C.muted }]}>
              {totalDoneSets}/{totalSets} sets logged
            </Text>
          )}
        </View>
      </View>

      {/* ── Row 3: Current exercise ─────────────────────────────── */}
      {currentExName && !allDone && (
        <View style={wkh.currentRow}>
          <View style={[wkh.currentAccent, { backgroundColor: ringColor }]} />
          <Ionicons name="barbell-outline" size={12} color={C.mid} />
          <Text style={[wkh.currentLabel, { color: C.muted }]}>NOW  </Text>
          <Text style={[wkh.currentName, { color: C.dark }]} numberOfLines={1}>{currentExName}</Text>
        </View>
      )}
      {allDone && (
        <View style={wkh.currentRow}>
          <View style={[wkh.currentAccent, { backgroundColor: C.green }]} />
          <Ionicons name="checkmark-circle" size={14} color={C.green} />
          <Text style={[wkh.currentName, { color: C.green, marginLeft: 6 }]}>
            All exercises complete!
          </Text>
        </View>
      )}

      {/* ── Row 4: Thin horizontal progress bar ─────────────────── */}
      <View style={wkh.progressTrack}>
        <View style={[
          wkh.progressFill,
          {
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: ringColor,
          },
        ]} />
      </View>
    </View>
  );
}

// WorkoutHeroHeader styles — inlined rather than makeStyles since this
// component also uses C (palette) which is already reactive.
const wkh = StyleSheet.create({
  container: {
    backgroundColor: '#0000',  // transparent — takes parent bg
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
    borderBottomWidth: 1,
    // borderColor set inline from theme
  },
  /* Row 1 */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  workoutName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
    marginRight: 10,
    color: theme.text.primary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.border.default,
  },
  finishBtn: {
    flexDirection: 'row', gap: 5,
    width: 'auto', paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
  },
  // Icon-only finish button (no text label)
  finishBtnIcon: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
  },
  finishBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  /* Row 2 */
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 10,
  },
  timerText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  timerLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.5,
    marginTop: 1,
  },
  statsCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  exFractionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  exDone: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  exTotal: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.55,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 4,
  },
  dot: {
    width: 8, height: 8,
    borderRadius: 4,
  },
  dotDone: {},
  dotPending: {
    backgroundColor: theme.border.default,
  },
  dotsOverflow: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.5,
    marginLeft: 2,
  },
  setsFraction: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.45,
    letterSpacing: 0.1,
  },

  /* Row 3 */
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingLeft: 2,
  },
  currentAccent: {
    width: 3, height: 14, borderRadius: 2,
  },
  currentLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.4,
    textTransform: 'uppercase',
  },
  currentName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  /* Row 4 — thin progress bar */
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.border.subtle,
    overflow: 'hidden',
    marginHorizontal: -16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    minWidth: 3,
  },
});

// Wrapper style for the hero header — positioned outside ScrollView so it
// stays fixed above the exercise list. Color values are set inline (C.card,
// C.border) so they respond to the live palette (dark mode).
const wk_heroHeaderBase = {
  borderBottomWidth: 1,
};

// ═══════════════════════════════════════════════════════════════════════════════
// LoggingView styles (lv) — restyled to match web admin design system.
//   Every key name is preserved so the 760-line JSX in LoggingView() continues
//   to render unchanged. What's different:
//     • Cards use theme.surface.default + border.default + shadow.card
//       (web `.card`), not ad-hoc #E8E8ED greys.
//     • "Done" tick = web `.btn-success` — solid emerald fill + shadow-success.
//     • Set rows get more breathing room: 10 → 12 pt vertical, tabular-num
//       value typography, 1 px border-subtle divider.
//     • Active exercise uses brand-50 tint (not amber-yellow) — matches web
//       "currently editing" section feel.
//     • Finish overlay uses success-500 fill + shadow-success (web `.btn-success`).
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// LoggingView styles — redesigned 2026 elite fitness app standard.
//   Design language: web admin `.card` geometry + Hevy/Strong set-row clarity.
//   Key decisions:
//     • exCard  = web `.card-raised` (radius-xl, border, shadow.raised)
//     • Left accent stripe encodes exercise state (idle/active/done)
//     • Set rows have 3 visual states: done (success tint), current (brand tint
//       with glow), pending (neutral)
//     • Quick-action bar (Match last / +2.5 / +5 / −2.5) below current set
//     • Flash overlay = instant visual confirmation without nav change
// ═══════════════════════════════════════════════════════════════════════════════
const useLvStyles = makeStyles((t) => StyleSheet.create({
  /* ── Header ──────────────────────────────────────────────────── */
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: t.surface.default,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  backChip: {
    width: 36, height: 36,
    borderRadius: t.radius.full,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -8,
  },
  logTitle:    { fontSize: t.fontSize.lg, fontWeight: '700', color: t.text.primary, letterSpacing: -0.2 },
  globalTimer: { fontSize: t.fontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 0.2 },
  doneCountPill: {
    backgroundColor: t.surface.sunken,
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: t.border.default,
  },
  doneCountPillDone: { backgroundColor: 'rgba(22,163,74,0.12)', borderColor: 'rgba(22,163,74,0.25)' },
  doneCountTxt:      { fontSize: 13, fontWeight: '700', color: t.text.secondary },
  doneCountTxtDone:  { color: t.success[600] },

  /* ── Scroll container ────────────────────────────────────────── */
  scrollContent: {
    padding: 16,
    paddingBottom: 120,  // keyboard handled by adjustResize + KAV; was 320
  },

  /* ── Exercise card ───────────────────────────────────────────── */
  exCard: {
    backgroundColor: t.surface.default,
    borderRadius: t.radius.xl,
    marginBottom: 8,    // ↓ was 14
    overflow: 'hidden',
    borderWidth: 1, borderColor: t.border.default,
    ...t.shadow.card,
    position: 'relative',
  },
  exCardDone:   { borderColor: 'rgba(22,163,74,0.45)' },
  exCardActive: { borderColor: t.brand[400], borderWidth: 1.5, ...t.shadow.raised },

  // Left accent stripe — 4 px, full card height
  exStripe: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    borderTopLeftRadius: t.radius.xl,
    borderBottomLeftRadius: t.radius.xl,
  },

  /* ── Exercise header (name · meta · progress) ────────────────── */
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,  // matches wk.exCardTouch
    paddingVertical: 11,    // matches wk.exCardTouch
    minHeight: 60,
  },
  exStatusChip: {
    width: 40, height: 40,
    borderRadius: t.radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.surface.sunken,
    borderWidth: 1, borderColor: t.border.default,
  },
  exStatusChipIdle:   {},
  exStatusChipActive: { backgroundColor: 'rgba(79,70,229,0.12)', borderColor: t.brand[300] },
  exStatusChipDone:   { backgroundColor: t.success[600], borderColor: t.success[700], ...t.shadow.success },
  exStatusCount:      { fontSize: 15, fontWeight: '800', color: t.brand[600] },

  exName:     { fontSize: t.fontSize.lg, fontWeight: '700', color: t.text.primary, letterSpacing: -0.3 },
  exNameDone: { color: t.text.tertiary, textDecorationLine: 'line-through', textDecorationColor: t.neutral[400] },
  skippedTag: { fontSize: 12, fontWeight: '600', color: t.text.tertiary },
  exMeta:     { fontSize: t.fontSize.xs, color: t.text.secondary, marginTop: 3, letterSpacing: 0.1 },
  exPrev:     { fontSize: t.fontSize.xs, color: t.brand[t.mode === 'dark' ? 400 : 600], fontWeight: '600', marginTop: 3 },

  // "Last session" button — compact pill below the exercise name
  lastSessionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: t.radius.full,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.14)' : t.brand[50],
    borderWidth: 1, borderColor: t.brand[100],
  },
  lastSessionBtnTxt: { fontSize: 11, fontWeight: '700', color: t.brand[t.mode === 'dark' ? 400 : 600] },

  // Mini progress bar
  progressRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressTrack:   { flex: 1, height: 5, borderRadius: 3, backgroundColor: t.brand[100], maxWidth: 100 },
  progressFill:    { height: 5, borderRadius: 3, backgroundColor: t.brand[600] },
  progressFraction: { fontSize: 11, fontWeight: '700', color: t.brand[t.mode === 'dark' ? 400 : 600], letterSpacing: 0.2 },

  /* ── Set list container ──────────────────────────────────────── */
  setList: {
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },

  /* ── Set row — three states: done / current / pending ────────── */
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
    gap: 10,
    position: 'relative',
    minHeight: 40,
  },
  // Done set: light success wash
  setRowDone: {
    backgroundColor: 'rgba(22,163,74,0.06)',
    borderBottomColor: 'rgba(22,163,74,0.12)',
  },
  setRowCurrent: {
    backgroundColor: t.mode === 'dark'
      ? 'rgba(99,102,241,0.12)'
      : 'rgba(79,70,229,0.06)',
    paddingVertical: 6,
  },

  // Green flash overlay — animated, absolute
  flashOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: t.success[400],
    zIndex: 1,
  },

  // Set number badge
  setNumBadge: {
    width: 28, height: 28,     // ↓ was 32
    borderRadius: t.radius.sm,
    backgroundColor: t.surface.sunken,
    borderWidth: 1, borderColor: t.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  setNumBadgeDone:    { backgroundColor: t.success[600], borderColor: t.success[700] },
  setNumBadgeCurrent: { backgroundColor: t.brand[600], borderColor: t.brand[700] },
  setNumTxt:          { fontSize: 13, fontWeight: '800', color: t.text.secondary, fontVariant: ['tabular-nums'] },
  setNumTxtCurrent:   { color: '#ffffff' },

  /* ── Reps column ─────────────────────────────────────────────── */
  repsCol: {
    width: 54,               // ↓ was 62
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: t.text.tertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  // Read-only done value
  fieldValueDone: {
    fontSize: t.fontSize.md,   // ↓ was xl(18) → md(15)
    fontWeight: '700',
    color: t.success[t.mode === 'dark' ? 400 : 700],
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  // Editable field (current / pending)
  fieldInput: {
    fontSize: t.fontSize.md,   // ↓ was xl(18) → md(15)
    fontWeight: '800',
    color: t.text.primary,
    textAlign: 'center',
    paddingVertical: 3,        // ↓ was 6
    paddingHorizontal: 2,
    minWidth: 40, minHeight: 40,  // 40pt min (Apple guideline) for reliable touch
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  fieldInputActive: {
    color: t.brand[t.mode === 'dark' ? 300 : 700],
  },

  /* ── Weight column ───────────────────────────────────────────── */
  weightCol:      { flex: 1, alignItems: 'center' },
  weightInputRow: { flexDirection: 'row', alignItems: 'center' },
  fieldInputWide: { minWidth: 72 },

  /* ── Complete set button ─────────────────────────────────────── */
  completeSetBtn: {
    width: 34, height: 34,     // ↓ was 44 — still 34 pt finger-friendly
    borderRadius: t.radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.surface.sunken,
    borderWidth: 1, borderColor: t.border.default,
  },
  completeSetBtnActive: {
    backgroundColor: t.success[600],
    borderColor: t.success[700],
    ...t.shadow.success,
  },
  doneTick: {
    width: 34, height: 34,     // ↓ matches completeSetBtn
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── Quick-action bar (Match last / ±kg) ─────────────────────── */
  quickActions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.08)' : t.brand[50],
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: t.surface.default,
    borderRadius: t.radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.border.default,
  },
  quickBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: t.brand[t.mode === 'dark' ? 300 : 700],
    letterSpacing: -0.1,
  },
  // "Match last" button — slightly elevated vs. plain adjust buttons
  quickBtnMatch: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.18)' : t.brand[50],
    borderColor: t.brand[t.mode === 'dark' ? 700 : 200],
  },

  /* ── RPE badge on done set row ───────────────────────────────── */
  /* ── Exercise state labels (active logging right-side badges) ────────────
     Each encodes status without relying on color alone (accessibility).
     DONE: success-tinted · UP NEXT: neutral · X/Y: brand · SKIP: muted  */
  /* ── Set count adjuster (±) — compact inline buttons in exercise header */
  setAdjRow:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  setAdjBtn:   {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: t.surface.sunken,
    borderWidth: 1, borderColor: t.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  setAdjCount: {
    fontSize: 12, fontWeight: '700', color: t.text.secondary,
    minWidth: 18, textAlign: 'center', fontVariant: ['tabular-nums'],
  },

  exStateLabelBase: {
    borderRadius: t.radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  exStateLabelDone:    { borderRadius: t.radius.full, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: 'rgba(22,163,74,0.12)' },
  exStateLabelActive:  { borderRadius: t.radius.full, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.20)' : t.brand[50] },
  exStateLabelIdle:    { borderRadius: t.radius.full, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: t.surface.sunken },
  exStateLabelSkip:    { borderRadius: t.radius.full, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.06)' },
  exStateLabelTxtDone:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: t.success[t.mode === 'dark' ? 400 : 700] },
  exStateLabelTxtActive: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: t.brand[t.mode === 'dark' ? 300 : 700], fontVariant: ['tabular-nums'] },
  exStateLabelTxtIdle:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: t.text.tertiary },
  exStateLabelTxtSkip:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: t.text.disabled },

  rpeBadge: {
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.18)' : t.brand[50],
    borderRadius: t.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: t.brand[t.mode === 'dark' ? 700 : 200],
  },
  rpeBadgeTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: t.brand[t.mode === 'dark' ? 300 : 700],
    letterSpacing: 0.1,
  },

  /* ── Rest timer strip (inline, below set row) ────────────────── */
  restStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: t.surface.sunken,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  restStripTime:  { fontSize: t.fontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  restStripLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  restAdjBtn: {
    backgroundColor: t.surface.default,
    borderRadius: t.radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: t.border.default,
  },
  restAdjTxt: { fontSize: 12, fontWeight: '700', color: t.text.primary },

  /* ── Add / Remove set row ────────────────────────────────────── */
  setActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
    marginTop: 4,
  },
  addSetBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10 },
  addSetTxt:    { fontSize: 13, fontWeight: '700', color: t.brand[t.mode === 'dark' ? 400 : 600] },
  removeSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10 },
  removeSetTxt: { fontSize: 13, fontWeight: '700', color: t.danger[t.mode === 'dark' ? 400 : 600] },

  /* ── Skipped body ────────────────────────────────────────────── */
  skippedBody: {
    alignItems: 'center', paddingVertical: 20,
    borderTopWidth: 1, borderTopColor: t.border.subtle,
    gap: 10,
  },
  skippedBodyTxt: { fontSize: 13, color: t.text.secondary },

  /* ── Trainer note ────────────────────────────────────────────── */
  trainerNoteRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 4, padding: 14,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.06)' : t.brand[50],
    borderTopWidth: 1, borderTopColor: t.border.subtle,
  },
  trainerNote: {
    fontSize: 13, color: t.text.secondary,
    fontStyle: 'italic', flex: 1, lineHeight: 20,
  },

  /* ── Mark Workout Complete CTA ───────────────────────────────── */
  markCompleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: t.success[600],
    borderWidth: 1, borderColor: t.success[700],
    borderRadius: t.radius.lg,
    paddingVertical: 16,
    marginTop: 24, marginBottom: 8,
    minHeight: 52,
    ...t.shadow.success,
  },
  markCompleteTxt: { fontSize: t.fontSize.lg, fontWeight: '700', color: '#ffffff', letterSpacing: 0.1 },

  /* ── Complete-workout modal ──────────────────────────────────── */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalSheet: {
    backgroundColor: t.surface.default,
    borderRadius: t.radius['2xl'],
    padding: 24, width: '100%', maxWidth: 360,
    ...t.shadow.modal,
  },
  modalTitle: { fontSize: t.fontSize['2xl'], fontWeight: '800', color: t.text.primary, letterSpacing: -0.4, marginBottom: 8 },
  modalSub:   { fontSize: t.fontSize.sm, color: t.text.secondary, marginBottom: 16, lineHeight: 20 },
  modalInput: {
    borderWidth: 1.5, borderColor: t.border.default,
    borderRadius: t.radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: t.fontSize.xl, textAlign: 'center',
    color: t.text.primary,
    backgroundColor: t.surface.default,
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  modalBtnRow:    { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: t.radius.md, backgroundColor: t.surface.sunken, alignItems: 'center', borderWidth: 1, borderColor: t.border.default },
  modalCancelTxt: { fontSize: t.fontSize.md, fontWeight: '600', color: t.text.secondary },
  modalConfirmBtn:{ flex: 1.6, paddingVertical: 14, borderRadius: t.radius.md, backgroundColor: t.success[600], alignItems: 'center', borderWidth: 1, borderColor: t.success[700], ...t.shadow.success },
  modalConfirmTxt:{ fontSize: t.fontSize.md, fontWeight: '700', color: '#ffffff' },

  /* ── Finish / celebration overlay ────────────────────────────── */
  finishOverlay: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 24, paddingTop: 52, paddingBottom: 40,
    backgroundColor: 'rgba(22,163,74,0.06)',
    borderWidth: 1, borderColor: 'rgba(22,163,74,0.15)',
    borderRadius: t.radius.xl,
    overflow: 'hidden',
  },
  finishGlow: {
    position: 'absolute', top: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(22,163,74,0.10)',
  },
  finishIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: t.success[600],
    borderWidth: 1, borderColor: t.success[700],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    ...t.shadow.success,
  },
  finishTitle:    { fontSize: 30, fontWeight: '800', color: t.text.primary, letterSpacing: -0.6 },
  finishGreeting: { fontSize: t.fontSize.lg, fontWeight: '500', color: t.text.secondary, marginTop: 6 },
  finishTimerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 28,
    backgroundColor: t.surface.default,
    borderRadius: t.radius.xl,
    paddingHorizontal: 28, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(22,163,74,0.2)',
    ...t.shadow.card,
  },
  finishTimerTxt:   { fontSize: 34, fontWeight: '800', color: t.text.primary, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  finishTimerLabel: { fontSize: 11, fontWeight: '700', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 10 },
  finishDivider:    { width: 60, height: 2, borderRadius: 1, backgroundColor: t.border.default, marginVertical: 26 },
  finishStatRow:    { flexDirection: 'row', alignItems: 'center' },
  finishStatBox:    { flex: 1, alignItems: 'center', paddingVertical: 8 },
  finishStatVal:    { fontSize: 28, fontWeight: '800', color: t.text.primary, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  finishStatLbl:    { fontSize: 11, fontWeight: '700', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },

  /* ── Compat aliases: overview + standalone LoggingView old keys ──────── */
  setsContainer:  { borderTopWidth: 1, borderTopColor: t.border.subtle, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 6 },
  setHeaderRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border.subtle, marginBottom: 4 },
  setHeaderTxt:   { fontSize: 10, fontWeight: '700', color: t.text.tertiary, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  repsBox:        { alignItems: 'center', justifyContent: 'center', width: 50 },
  repsVal:        { fontSize: 18, fontWeight: '800', color: t.text.primary, fontVariant: ['tabular-nums'] },
  lastBox:        { alignItems: 'center', justifyContent: 'center', width: 50 },
  lastVal:        { fontSize: 13, fontWeight: '600', color: t.text.tertiary, fontVariant: ['tabular-nums'] },
  weightGroup:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  weightInput:    { flex: 1, borderRadius: t.radius.sm, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1 },
  kgLbl:          { fontSize: 12, color: t.text.tertiary, fontWeight: '700' },
  exWrap:         { backgroundColor: t.surface.default, borderRadius: t.radius.xl, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: t.border.default, ...t.shadow.card },
  exWrapDone:     { borderColor: 'rgba(22,163,74,0.30)', backgroundColor: 'rgba(22,163,74,0.03)' },
  exWrapActive:   { borderColor: t.brand[300], borderWidth: 1.5, ...t.shadow.raised },
  exCheck:        { width: 44, height: 44, borderRadius: t.radius.md, borderWidth: 2, borderColor: t.border.strong, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface.default },
  exCheckDone:    { backgroundColor: t.success[600], borderColor: t.success[700], ...t.shadow.success },
  exCheckActive:  { backgroundColor: t.brand[600], borderColor: t.brand[700] },
  exercisesLabel: { fontSize: 11, fontWeight: '700', color: t.text.tertiary, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4, marginBottom: 6 },
  repsInput:      { fontSize: 18, fontWeight: '800', color: t.text.primary, textAlign: 'center', paddingVertical: 4, fontVariant: ['tabular-nums'] },
  weightInputDone:{ color: t.success[700], opacity: 0.85 },
  doneBtn:        { width: 38, height: 38, borderRadius: t.radius.md, backgroundColor: t.success[600], borderWidth: 1, borderColor: t.success[700], alignItems: 'center', justifyContent: 'center', ...t.shadow.success },
  donedTag:       { width: 38, alignItems: 'center', justifyContent: 'center' },
  progressBarBg:  { flex: 1, height: 5, borderRadius: 3, backgroundColor: t.brand[100], maxWidth: 100 },
  progressBarFill:{ height: 5, borderRadius: 3, backgroundColor: t.brand[600] },
  progressText:   { fontSize: 11, fontWeight: '700', color: t.brand[600], letterSpacing: 0.2 },
}));

// ── WORKOUTS SCREEN ───────────────────────────────────────────────────────────
function WorkoutsScreen({ member, assignment, planWeek, fullPlan, todayWorkout, setTodayWorkout, activeWorkoutLog, workoutTimer, startWorkoutTimer, stopWorkoutTimer, pauseWorkoutTimer, resumeWorkoutTimer, workoutDoneSets, setWorkoutDoneSets, workoutSetWeights, setWorkoutSetWeights, restEndTimes, setRestEndTimes, autoStartLogging, setAutoStartLogging, onWorkoutFinish, onViewHistory, restDays, setRestDays }) {
  const C = usePalette();
  const g = useGlobalStyles();
  const wk = useWkStyles();
  // Enable LayoutAnimation on Android — required once per screen mount.
  useEffect(() => {
    if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
  }, []);

  // ── Break timer modal — ManualBreakTimer accessed via icon in hero header ──
  const [showBreakModal, setShowBreakModal] = useState(false);

  // ── Collapsible metadata section (day pills + workout title) ──────────────
  // Collapses automatically when logging starts so the hero header + exercises
  // get the full screen without the week strip cluttering the view.
  const [metaCollapsed, setMetaCollapsed] = useState(false);
  useEffect(() => {
    if (isLogging) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMetaCollapsed(true);
    }
  }, [isLogging]);

  // ── Keyboard scroll fix: track scroll Y + per-input refs ─────────────────
  // currentScrollY feeds the measureInWindow calculation so we scroll exactly
  // the right amount when a weight/reps input is focused.
  const currentScrollY = useRef(0);
  // inputRefs: stateKey → TextInput ref, used for measureInWindow on focus.
  const inputRefs = useRef({});
  const lv = useLvStyles();
  // ── View state ──────────────────────────────────────────────────────────────
  const [isLogging, setIsLogging] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState(null); // null = today
  // loggingWorkout: set when starting a non-today day to avoid overwriting todayWorkout
  const [loggingWorkout, setLoggingWorkout] = useState(null);

  // ── Inline logging state ────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(null);
  const [expandedOverview, setExpandedOverview] = useState(null); // overview card expand
  const [localSetWeights, setLocalSetWeights] = useState({});
  const [lastWeights, setLastWeights] = useState({});
  const [lastReps, setLastReps] = useState({});   // reps from previous session
  const [rpeLog, setRpeLog] = useState({});        // RPE recorded per stateKey
  const [pendingRpeKey, setPendingRpeKey] = useState(null); // awaiting RPE input
  const rpeTimerRef = useRef(null);                // auto-dismiss timer
  const [restTimers, setRestTimers] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  const [scrolledPastHeader, setScrolledPastHeader] = useState(false);
  const [customReps, setCustomReps] = useState({});
  const [extraSets, setExtraSets] = useState({});
  // Circuit tracking state
  const [circuitRound,     setCircuitRound]     = useState({}); // {circuitId: currentRound 1-based}
  const [circuitActuals,   setCircuitActuals]   = useState({}); // {`${cId}_${round}_${exId}`: value}
  const [circuitCompleted, setCircuitCompleted] = useState({}); // {circuitId: true}
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeMinutes, setCompleteMinutes] = useState('');
  const [showPastCompleteModal, setShowPastCompleteModal] = useState(false);
  const [pastCompleteMinutes, setPastCompleteMinutes] = useState('');
  const [pastCompleteDayIdx, setPastCompleteDayIdx] = useState(null);
  const [pastCompleteDay, setPastCompleteDay] = useState(null);
  const [showEditDurationModal, setShowEditDurationModal] = useState(false);
  const [editDurationMinutes, setEditDurationMinutes] = useState('');
  const [videoExName, setVideoExName] = useState(null);
  // lastSessionModal: { name, sets: [{setNo, weight, reps}] } — shows prev session data
  const [lastSessionModal, setLastSessionModal] = useState(null);

  // ── Custom modal state replacing Alert.alert calls ───────────────────────────
  // dayOptionsModal: long-press on a day chip → shows "Mark Rest / Postpone"
  const [dayOptionsModal, setDayOptionsModal] = useState(null);
  // restAssignModal: during postpone, if next slot is a rest day
  const [restAssignModal, setRestAssignModal] = useState(null);
  // postponeSuccessModal: after successful postpone
  const [postponeSuccessModal, setPostponeSuccessModal] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const tickRef = useRef(null);
  const vibratedRef = useRef({});
  const notifIdRef = useRef(null);
  const activeLogRef = useRef(null);
  const pausedAtRef = useRef(null);
  const loggingDayIdxRef = useRef(null); // planIdx of the day being actively logged (null=today)
  const pausedEndTimesRef = useRef(null);
  const scrollRef = useRef(null);
  // cardLayoutY: records the Y offset of each exercise card inside the ScrollView.
  // Populated by onLayout on each exercise card View.
  const cardLayoutY = useRef({});
  const keyboardHeight = useRef(0);

  // kbPadding: dynamic paddingBottom for the main ScrollView.
  // Expands to keyboard height + 16px when keyboard shows so inputs always
  // have scroll room. Resets to 24px when keyboard hides — no dead space.
  const [kbPadding, setKbPadding] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
      keyboardHeight.current = e.endCoordinates.height;
      setKbPadding(e.endCoordinates.height + 24);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeight.current = 0;
      setKbPadding(0);  // zero phantom space when keyboard hides
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // scrollToInput — called from weight/reps TextInput onFocus via inputRef.
  //   Waits 400ms for the keyboard animation to finish, then uses
  //   measureInWindow to get the input's exact screen Y, calculates
  //   how much to scroll so the input sits above the keyboard with
  //   32px breathing room, and fires scrollRef.scrollTo.
  //   This fixes the bug where cardLayoutY was relative to the logging
  //   section View (not the ScrollView root) causing wrong offsets.
  // scrollToInput — called on weight/reps TextInput focus.
  // On Android, `adjustResize` in AndroidManifest shrinks the window so the
  // scroll area naturally exposes the focused field — no programmatic scroll
  // needed and attempting one can steal focus and break text entry.
  // On iOS, KeyboardAvoidingView behavior="padding" handles avoidance.
  // We keep the function as a no-op so call sites don't need changing; if
  // iOS needs fine-tuning in future, add: `if (Platform.OS === 'ios') { ... }`
  // scrollToInput — scroll the active input above the keyboard.
  //
  //   Android: adjustResize in AndroidManifest shrinks the window — the
  //   kbPadding state expansion (via Keyboard.addListener above) combined
  //   with the existing scrollRef gives the user enough scroll room without
  //   any programmatic scroll needed.  Programmatic scroll was previously
  //   causing focus loss on Android, so we skip it there.
  //
  //   iOS: KeyboardAvoidingView behavior="padding" handles the container
  //   shrink, but doesn't auto-scroll to the focused input. We do that with
  //   measureInWindow + scrollTo, waiting 350ms for the keyboard animation.
  // scrollToInput — intentionally a no-op.
  // Keyboard avoidance is handled entirely by:
  //   Android: adjustResize (AndroidManifest) + kbPadding Keyboard.addListener
  //   iOS: KeyboardAvoidingView behavior='padding' + kbPadding expansion
  // Previous measureInWindow + scrollRef.scrollTo was REMOVING FOCUS from the
  // TextInput on some devices (programmatic scroll competed with the native
  // focus animation), which was the primary cause of the keyboard not appearing.
  // scrollToInput — scroll so the focused TextInput is above the keyboard.
  // Uses measureLayout(scrollRef.current, ...) — gives Y relative to the
  // ScrollView content, which is exactly what scrollTo(y) needs.
  // Called from onFocus with a 350ms delay so the keyboard has started
  // animating in (kbPadding has expanded) before we attempt to scroll.
  const scrollToInput = (inputRef) => {
    if (!inputRef?.current || !scrollRef.current) return;
    setTimeout(() => {
      if (!inputRef.current) return;
      inputRef.current.measureInWindow((_x, screenY, _w, h) => {
        const kbH = keyboardHeight.current || 300;
        const screenH = Dimensions.get('window').height;
        const inputBottom = screenY + h;
        const visibleBottom = screenH - kbH;
        const margin = 32;
        if (inputBottom + margin > visibleBottom) {
          const delta = inputBottom + margin - visibleBottom;
          scrollRef.current?.scrollTo({
            y: Math.max(0, currentScrollY.current + delta),
            animated: true,
          });
        }
      });
    }, 350);
  };

  // ── Flash animation + quick-action helpers for inline workout logging ─────
  const wkFlashAnim = useRef(new Animated.Value(0)).current;
  const [wkLatestDone, setWkLatestDone] = useState(null);
  const triggerWkFlash = (stateKey) => {
    setWkLatestDone(stateKey);
    wkFlashAnim.setValue(0.6);
    Animated.timing(wkFlashAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(
      () => setWkLatestDone(null)
    );
  };
  const adjustWkWeight = (stateKey, delta) => {
    Vibration.vibrate(8); // light haptic confirms action
    const cur = parseFloat(localSetWeights[stateKey] || lastWeights[stateKey] || '0');
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
    const updated = { ...localSetWeights, [stateKey]: String(next) };
    setLocalSetWeights(updated);
    setWorkoutSetWeights(updated);
  };
  const matchWkLast = (stateKey) => {
    Vibration.vibrate(8);
    const lastW = lastWeights[stateKey];
    const lastR = lastReps[stateKey];
    if (!lastW && !lastR) return;
    // Match weight
    if (lastW) {
      const updatedW = { ...localSetWeights, [stateKey]: lastW };
      setLocalSetWeights(updatedW);
      setWorkoutSetWeights(updatedW);
    }
    // Match reps from previous session
    if (lastR) {
      setCustomReps(prev => ({ ...prev, [stateKey]: lastR }));
    }
  };

  // Floating rest timer removed — auto-rest now uses the unified bottom sheet.

  // ── Day helpers ─────────────────────────────────────────────────────────────
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayFullDay = fullDayNames[new Date().getDay()];
  // Plan days: Mon=0…Sun=6; JS getDay(): Sun=0,Mon=1… → (getDay()+6)%7
  const todayPlanIdx = (new Date().getDay() + 6) % 7;

  // ── Auto-resume logging when returning to tab with active workout ──────────
  useEffect(() => {
    if (workoutTimer?.running && !isLogging && todayWorkout && !todayWorkout.isRestDay) {
      setIsLogging(true);
    }
  }, [todayWorkout]);

  // ── Auto-launch inline logging from dashboard "Start Workout" button ──────────
  useEffect(() => {
    if (autoStartLogging && todayWorkout && !todayWorkout.isRestDay && !isLogging) {
      if (!workoutTimer?.running && !workoutTimer?.completed) startWorkoutTimer();
      setIsLogging(true);
      if (setAutoStartLogging) setAutoStartLogging(false);
    }
  }, [autoStartLogging, todayWorkout]);

  // ── Notification channel setup ───────────────────────────────────────────────
  useEffect(() => {
    const setup = async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('rest-timer', {
          name: 'Rest Timer',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 500, 500],
          sound: null,
          bypassDnd: true,
        });
      }
      await Notifications.requestPermissionsAsync();
    };
    setup().catch(() => {});
    return () => {
      if (notifIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
        notifIdRef.current = null;
      }
    };
  }, []);

  // ── Schedule/cancel background rest-complete notification ────────────────────
  useEffect(() => {
    if (!isLogging || isPaused) return;
    const entries = Object.entries(restEndTimes || {});
    if (entries.length === 0) {
      if (notifIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
        notifIdRef.current = null;
      }
      return;
    }
    const [, endTime] = entries[0];
    const secsLeft = Math.ceil((endTime - Date.now()) / 1000);
    if (secsLeft <= 0) return;
    const prev = notifIdRef.current;
    Notifications.scheduleNotificationAsync({
      content: {
        title: '💪 Rest Complete!',
        body: 'Time to start your next set!',
        sound: false,
        vibrate: [0, 500, 500, 500],
        channelId: 'rest-timer',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endTime),
      },
    }).then(id => {
      notifIdRef.current = id;
      if (prev) Notifications.cancelScheduledNotificationAsync(prev).catch(() => {});
    }).catch(() => {});
  }, [restEndTimes, isLogging, isPaused]);

  // ── Tick: recompute display timers every 500ms while logging ─────────────────
  useEffect(() => {
    if (!isLogging) {
      clearInterval(tickRef.current);
      return;
    }
    const compute = () => {
      if (isPaused) return;
      const now = Date.now();
      const active = restEndTimes || {};
      const newTimers = {};
      for (const [k, end] of Object.entries(active)) {
        const remaining = Math.max(0, Math.ceil((end - now) / 1000));
        newTimers[k] = remaining;
        if (remaining === 0 && !vibratedRef.current[k]) {
          vibratedRef.current[k] = true;
          Vibration.vibrate([0, 500, 500, 500]);
          playRestCompleteSound();
        }
      }
      setRestTimers(newTimers);
    };
    compute();
    tickRef.current = setInterval(compute, 500);
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') compute();
    });
    return () => {
      clearInterval(tickRef.current);
      appSub.remove();
    };
  }, [isLogging, restEndTimes, isPaused]);

  // ── Load last weights + reps from AsyncStorage when logging starts ───────────
  useEffect(() => {
    if (!isLogging) return;
    const exs = (loggingWorkout ?? todayWorkout)?.exercises || [];
    const load = async () => {
      const storedW = {};
      const storedR = {};
      for (const ex of exs) {
        for (let s = 1; s <= ex.sets; s++) {
          try {
            const w = await AsyncStorage.getItem(`lift_w_${ex.id}_s${s}`);
            if (w) storedW[`${ex.id}_${s}`] = w;
            const r = await AsyncStorage.getItem(`lift_r_${ex.id}_s${s}`);
            if (r) storedR[`${ex.id}_${s}`] = r;
          } catch (_) {}
        }
      }
      setLastWeights(storedW);
      setLastReps(storedR);
    };
    load();
    setLocalSetWeights(workoutSetWeights || {});
  }, [isLogging]);

  // ── Create incomplete Firestore log when logging starts ──────────────────────
  useEffect(() => {
    if (!isLogging) return;
    const gymOrTrainer = member?.gymId || member?.trainerId;
    const memberId = member?.id;
    if (!gymOrTrainer || !memberId || workoutTimer?.completed) return;
    const activeWorkout = loggingWorkout ?? todayWorkout;
    const exs = activeWorkout?.exercises || [];
    (async () => {
      try {
        const { collection: col, doc: docFn, setDoc: setDocFn } = require('firebase/firestore');
        const { db: fdb } = require('./shared/firebase/config');
        const activeWorkoutLogId = activeWorkoutLog?.id;
        if (activeWorkoutLogId) {
          activeLogRef.current = docFn(fdb, 'gyms', gymOrTrainer, 'workoutLogs', activeWorkoutLogId);
        } else {
          const logRef = docFn(col(fdb, 'gyms', gymOrTrainer, 'workoutLogs'));
          activeLogRef.current = logRef;
          await setDocFn(logRef, {
            id: logRef.id,
            memberId,
            memberName: member?.name || '',
            gymId: member?.gymId || null,
            planId: activeWorkout?.id || '',
            planName: activeWorkout?.name || '',
            dayLabel: activeWorkout?.dayLabel || '',
            status: 'incomplete',
            completedExercises: exs.map(ex => ({
              exerciseId: ex.id,
              exerciseName: ex.name,
              muscleGroup: ex.muscleGroup || 'Other',
              targetSets: ex.sets,
              targetReps: ex.reps,
              actualSets: ex.sets,
              actualReps: String(ex.reps),
              weight: 0,
              restSeconds: ex.rest || 60,
              completed: false,
              notes: ex.note || '',
            })),
            startedAt: Date.now(),
            startedBy: 'member',
            loggedAt: new Date().toISOString(),
            completedAt: null,
            updatedAt: Date.now(),
          });
        }
      } catch (e) { console.log('Create incomplete log error:', e); }
    })();
  }, [isLogging]);

  // ── Selected day helper ──────────────────────────────────────────────────────
  const getSelectedDayData = () => {
    if (selectedDayIdx === null || !fullPlan?.days) return null;
    return fullPlan.days[selectedDayIdx] || null;
  };
  const selectedDay = getSelectedDayData();

  const handleDayPress = (displayIdx) => {
    const item = planWeek?.[displayIdx];
    if (!item) return;
    if (item.isToday) {
      setSelectedDayIdx(null);
    } else {
      setSelectedDayIdx(item.planIdx);
    }
  };

  const handleToggleRestDay = (displayIdx) => {
    const item = planWeek?.[displayIdx];
    if (!item) return;
    const dayIdx = item.planIdx ?? displayIdx;
    const newRestDays = { ...restDays };
    if (newRestDays[dayIdx]) {
      delete newRestDays[dayIdx];
    } else {
      newRestDays[dayIdx] = true;
    }
    setRestDays(newRestDays);
  };

  const handleDayLongPress = (displayIdx) => {
    const item = planWeek?.[displayIdx];
    if (!item) return;
    const dayIdx = item.planIdx ?? displayIdx;
    const FULL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = FULL_DAY_NAMES[(dayIdx + 1) % 7];
    const isRest = item.rest || restDays?.[dayIdx];
    // Open the custom day-options modal instead of system Alert.alert
    setDayOptionsModal({
      dayName,
      displayIdx,
      dayIdx,
      isRest,
      canPostpone: !isRest && item.exerciseCount > 0,
    });
  };

  // ── Postpone handler ─────────────────────────────────────────────────────────
  const handlePostpone = (dayPlanIdx) => {
    if (!fullPlan?.days || !assignment?.planId) return;
    const gymId = member?.gymId || member?.trainerId;
    if (!gymId) return;

    const days = fullPlan.days;
    const dayData = days[dayPlanIdx];
    if (!dayData || dayData.restDay || dayData.completedAt) return;

    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0];

    const getDateForPlanIdx = (idx) => {
      const diff = (idx - todayPlanIdx + 7) % 7;
      const d = new Date(today);
      d.setDate(today.getDate() + diff);
      return d;
    };
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formatDateLocal = (d) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
    const FULL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const planIdxToName = (idx) => FULL_DAY_NAMES[(idx + 1) % 7];

    const isLocalRestDay = (idx) => restDays?.[idx];
    const workoutSlotIndices = days.map((_, i) => i).filter(i => !days[i].restDay && !isLocalRestDay(i));
    const N = workoutSlotIndices.length;
    if (N === 0) return;
    const postponedWorkoutPos = workoutSlotIndices.indexOf(dayPlanIdx);
    if (postponedWorkoutPos === -1) return;

    const performRotation = () => {
      const newDays = days.map((d, i) => {
        if (d.restDay) return { dayLabel: d.dayLabel, restDay: true, exercises: [] };
        const workoutPos = workoutSlotIndices.indexOf(i);
        const sourcePos = (postponedWorkoutPos + workoutPos) % N;
        const sourceIdx = workoutSlotIndices[sourcePos];
        const src = days[sourceIdx];
        return { dayLabel: src.dayLabel || d.dayLabel, restDay: false, exercises: src.exercises || [] };
      });
      const planRef = doc(db, 'gyms', gymId, 'clientPlans', assignment.planId);
      updateDoc(planRef, { days: newDays, postponedDayIdx: dayPlanIdx, postponedOn: todayDateStr })
        .catch(e => console.log('Postpone rotation error:', e));
      // Replace system Alert with custom success modal
      setPostponeSuccessModal(true);
    };

    const assignToRestDay = (restDayIdx) => {
      const newDays = days.map((d, i) => {
        if (i === dayPlanIdx) return { dayLabel: d.dayLabel, restDay: true, exercises: [] };
        if (i === restDayIdx) return { dayLabel: d.dayLabel, restDay: false, exercises: days[dayPlanIdx].exercises || [] };
        return { dayLabel: d.dayLabel, restDay: !!d.restDay, exercises: d.exercises || [] };
      });
      const planRef = doc(db, 'gyms', gymId, 'clientPlans', assignment.planId);
      updateDoc(planRef, { days: newDays, postponedDayIdx: dayPlanIdx, postponedOn: todayDateStr })
        .catch(e => console.log('Postpone assign error:', e));
    };

    const checkPath = (fromIdx, depth = 0) => {
      if (depth >= 7) { performRotation(); return; }
      const nextIdx = (fromIdx + 1) % 7;
      const nextDay = days[nextIdx];
      const isNextDayRest = nextDay?.restDay || isLocalRestDay(nextIdx);
      if (!isNextDayRest) { performRotation(); return; }
      const restDate = getDateForPlanIdx(nextIdx);
      const restDayName = planIdxToName(nextIdx);
      // Replace system Alert with custom rest-assignment modal
      setRestAssignModal({
        restDayName,
        restDateLabel: formatDateLocal(restDate),
        onAssign: () => { setRestAssignModal(null); assignToRestDay(nextIdx); },
        onSkip:   () => { setRestAssignModal(null); checkPath(nextIdx, depth + 1); },
      });
    };

    checkPath(dayPlanIdx);
  };

  // ── Inline logging helpers ───────────────────────────────────────────────────
  const activeWorkout = loggingWorkout ?? todayWorkout;
  const logExercises = activeWorkout?.exercises || [];
  const gymOrTrainer = member?.gymId || member?.trainerId;
  const memberId = member?.id;
  const memberName = member?.name || 'there';

  const getTotalSets = (ex) => Math.max(0, ex.sets + (extraSets[ex.id] || 0));
  const isSkipped = (ex) => getTotalSets(ex) === 0;

  const allSetsOf = (ex) =>
    isSkipped(ex) || Array.from({ length: getTotalSets(ex) }, (_, i) => `${ex.id}_${i + 1}`).every(k => workoutDoneSets[k]);
  const allDone = logExercises.length > 0 && logExercises.every(allSetsOf);
  const doneCount = logExercises.filter(ex => allSetsOf(ex)).length;
  const elapsed = workoutTimer?.elapsed || 0;
  const elapsedColor = allDone ? C.green : elapsed > 3600 ? C.red : elapsed > 1800 ? C.amber : C.green;

  // Total set counts for hero header "X/Y sets logged"
  const totalSetsAll = logExercises.reduce((s, ex) => s + getTotalSets(ex), 0);
  const totalDoneSetsAll = logExercises.reduce((s, ex) => {
    return s + Array.from({ length: getTotalSets(ex) }, (_, i) => `${ex.id}_${i + 1}`).filter(k => workoutDoneSets[k]).length;
  }, 0);
  // Name of first incomplete exercise — shown in "NOW" line
  const currentExName = isLogging
    ? (logExercises.find(ex => !allSetsOf(ex) && !isSkipped(ex))?.name || null)
    : null;
  const formatRest = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startRestTimer = (stateKey, secs) => {
    setRestEndTimes({ [stateKey]: Date.now() + secs * 1000 });
    setShowBreakModal(true); // unified sheet: auto-open on every set completion
  };

  const adjustRest = (stateKey, delta) => {
    setRestEndTimes(prev => {
      const cur = prev?.[stateKey] ?? Date.now();
      return { [stateKey]: Math.max(Date.now() + 10000, cur + delta * 1000) };
    });
  };

  const pausedElapsedRef = useRef(0);

  const handlePauseToggle = () => {
    if (!isPaused) {
      // Capture state before pausing
      pausedAtRef.current = Date.now();
      pausedElapsedRef.current = workoutTimer?.elapsed || 0;
      pausedEndTimesRef.current = { ...restEndTimes };
      setIsPaused(true);
      pauseWorkoutTimer();
    } else {
      // Extend rest end-times by how long we were paused
      const pauseDuration = Date.now() - (pausedAtRef.current || Date.now());
      if (pausedEndTimesRef.current && Object.keys(pausedEndTimesRef.current).length > 0) {
        const extended = {};
        for (const [k, endTime] of Object.entries(pausedEndTimesRef.current)) {
          extended[k] = endTime + pauseDuration;
        }
        setRestEndTimes(extended);
      }
      pausedAtRef.current = null;
      pausedEndTimesRef.current = null;
      setIsPaused(false);
      resumeWorkoutTimer(pausedElapsedRef.current);
    }
  };

  const markSetDone = async (exId, setNo, defaultRest, totalSets) => {
    const stateKey = `${exId}_${setNo}`;
    // Persist weight
    const val = localSetWeights[stateKey];
    if (val) {
      try { await AsyncStorage.setItem(`lift_w_${exId}_s${setNo}`, val); } catch (_) {}
    }
    // Persist reps so "Match last" can fill them next session
    const repsVal = customReps[stateKey];
    if (repsVal != null) {
      try { await AsyncStorage.setItem(`lift_r_${exId}_s${setNo}`, String(repsVal)); } catch (_) {}
    }
    const newDone = { ...workoutDoneSets, [stateKey]: true };
    setWorkoutDoneSets(newDone);
    vibratedRef.current = {};
    setRestEndTimes({});

    // ── RPE picker timing ─────────────────────────────────────────────────
    // Clear previous set's picker/timer immediately (tapping next set dismisses it)
    if (rpeTimerRef.current) clearTimeout(rpeTimerRef.current);
    rpeTimerRef.current = null;
    setPendingRpeKey(null);

    const allSetsOfThisExDone = Array.from(
      { length: totalSets }, (_, i) => `${exId}_${i + 1}`
    ).every(k => newDone[k]);

    // Show RPE picker after a short delay (let the flash animation play first)
    setTimeout(() => {
      setPendingRpeKey(stateKey);
      if (allSetsOfThisExDone) {
        // Last set of this exercise: auto-dismiss after 60 s if not answered
        rpeTimerRef.current = setTimeout(() => setPendingRpeKey(null), 60000);
      }
      // Non-last sets: NO timer — picker stays visible until the user taps
      // the NEXT set's ✓, which calls markSetDone again and clears it above.
    }, 350);
    if (!allSetsOfThisExDone) startRestTimer(stateKey, defaultRest || 60);

    const isAllDone = logExercises.every(ex =>
      isSkipped(ex) || Array.from({ length: getTotalSets(ex) }, (_, i) => `${ex.id}_${i + 1}`).every(k => newDone[k])
    );

    const totalDoneCount = Object.values(newDone).filter(Boolean).length;
    if (totalDoneCount === 1 && gymOrTrainer && memberId) {
      try {
        const { doc: docFn, updateDoc: upDoc, getDoc: gdoc } = require('firebase/firestore');
        const { db: fdb } = require('./shared/firebase/config');
        const assignRef = docFn(fdb, 'gyms', gymOrTrainer, 'assignments', memberId);
        const assignSnap = await gdoc(assignRef).catch(() => null);
        if (assignSnap?.exists() && assignSnap.data()?.planId) {
          const planRef = docFn(fdb, 'gyms', gymOrTrainer, 'clientPlans', assignSnap.data().planId);
          const planSnap = await gdoc(planRef).catch(() => null);
          if (planSnap?.exists()) {
            const todayIdx = loggingDayIdxRef.current ?? (new Date().getDay() + 6) % 7;
            const days = (planSnap.data().days ?? []).map((d, i) =>
              i === todayIdx ? { ...d, startedAt: Date.now() } : d
            );
            await upDoc(planRef, { days }).catch(() => {});
          }
        }
      } catch (e) { console.log('startedAt write error:', e); }
    }

    if (isAllDone) {
      const curElapsed = workoutTimer?.elapsed || 0;
      stopWorkoutTimer(curElapsed);
      if (gymOrTrainer && memberId) {
        try {
          const { doc: docFn, updateDoc: upDoc, getDoc: gdoc, collection: col, setDoc: sdoc } = require('firebase/firestore');
          const { db: fdb } = require('./shared/firebase/config');
          const assignRef = docFn(fdb, 'gyms', gymOrTrainer, 'assignments', memberId);
          const assignSnap = await gdoc(assignRef).catch(() => null);
          if (assignSnap?.exists() && assignSnap.data()?.planId) {
            const planRef = docFn(fdb, 'gyms', gymOrTrainer, 'clientPlans', assignSnap.data().planId);
            const planSnap = await gdoc(planRef).catch(() => null);
            if (planSnap?.exists()) {
              const todayIdx = loggingDayIdxRef.current ?? (new Date().getDay() + 6) % 7;
              const days = (planSnap.data().days ?? []).map((d, i) =>
                i === todayIdx
                  ? { ...d, completedAt: Date.now(), startedAt: d.startedAt ?? Date.now(), durationSeconds: curElapsed }
                  : d
              );
              await upDoc(planRef, { days }).catch(() => {});
              loggingDayIdxRef.current = null; // Clear after workout completion
            }
          }
          const completionData = {
            memberId, memberName,
            gymId: member?.gymId || null,
            planId: activeWorkout?.id || '',
            planName: activeWorkout?.name || '',
            dayLabel: activeWorkout?.dayLabel || '',
            status: 'completed',
            completedExercises: logExercises.map(ex => ({
              exerciseId: ex.id, exerciseName: ex.name,
              muscleGroup: ex.muscleGroup || 'Other',
              targetSets: ex.sets, targetReps: ex.reps,
              actualSets: getTotalSets(ex), actualReps: String(customReps[`${ex.id}_1`] || ex.reps),
              weight: parseFloat(localSetWeights[`${ex.id}_1`] || lastWeights[`${ex.id}_1`] || '0'),
              restSeconds: ex.rest || 60, completed: !isSkipped(ex), skipped: isSkipped(ex), notes: ex.note || '',
              setDetails: isSkipped(ex) ? [] : Array.from({ length: getTotalSets(ex) }, (_, i) => ({
                setNo: i + 1,
                reps: parseInt(customReps[`${ex.id}_${i + 1}`] || ex.reps, 10),
                weight: parseFloat(localSetWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
              })),
            })),
            exerciseLogs: logExercises.map(ex => ({
              exerciseId: ex.id, exerciseName: ex.name,
              skipped: isSkipped(ex),
              sets: isSkipped(ex) ? [] : Array.from({ length: getTotalSets(ex) }, (_, i) => ({
                setNo: i + 1, reps: parseInt(customReps[`${ex.id}_${i + 1}`] || ex.reps, 10),
                weight: parseFloat(localSetWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
                done: !!newDone[`${ex.id}_${i + 1}`],
              })),
            })),
            durationSeconds: curElapsed,
            startedAt: Date.now() - (curElapsed * 1000),
            completedAt: Date.now(),
            loggedAt: new Date().toISOString(),
            updatedAt: Date.now(),
          };
          if (activeLogRef.current) {
            await upDoc(activeLogRef.current, completionData).catch(async () => {
              const fb = docFn(col(fdb, 'gyms', gymOrTrainer, 'workoutLogs'));
              await sdoc(fb, { id: fb.id, ...completionData });
            });
          } else {
            const logRef = docFn(col(fdb, 'gyms', gymOrTrainer, 'workoutLogs'));
            await sdoc(logRef, { id: logRef.id, ...completionData });
          }
          await upDoc(docFn(fdb, 'members', memberId), { lastWorkoutAt: Date.now() }).catch(() => {});
        } catch (e) { console.log('Workout complete write error:', e); }
      }

      // Navigate to finish summary AFTER writes (or immediately if no gym).
      // setIsLogging(false) clears the logging state so the hero header
      // and exercise list don't remain visible behind the finish screen.
      setIsLogging(false);
      onWorkoutFinish?.(buildWorkoutFinishData({
        dayLabel:        activeWorkout?.dayLabel || '',
        planName:        activeWorkout?.name || '',
        durationSeconds: curElapsed,
        exercises:       logExercises,
        // Scan ALL sets for best weight and reps — not just set 1.
        // User may have entered weight on set 2/3 but not set 1, or modified
        // reps on a non-first set. First non-zero value wins.
        actualResolver: (ex) => {
          const n = getTotalSets(ex);
          let bestW = 0;
          for (let i = 1; i <= n; i++) {
            const w = parseFloat(localSetWeights[`${ex.id}_${i}`] || '0');
            if (w > 0) { bestW = w; break; }
          }
          if (bestW === 0) {
            for (let i = 1; i <= n; i++) {
              const w = parseFloat(lastWeights[`${ex.id}_${i}`] || '0');
              if (w > 0) { bestW = w; break; }
            }
          }
          let bestReps = ex.reps;
          for (let i = 1; i <= n; i++) {
            const r = customReps[`${ex.id}_${i}`];
            if (r != null && r !== '') { bestReps = parseInt(r, 10) || ex.reps; break; }
          }
          return { actualSets: n, actualReps: bestReps, weight: bestW };
        },
      }));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  // Active rest timer data for floating bubble
  const activeRestEntry = Object.entries(restTimers).find(([, v]) => v > 0);
  const activeRestKey = activeRestEntry?.[0];
  const activeRestLeft = activeRestEntry?.[1];
  const restDone = Object.entries(restTimers).some(([, v]) => v === 0) && !activeRestEntry;
  const activeRestColor = activeRestLeft !== undefined
    ? (activeRestLeft < 20 ? C.red : activeRestLeft < 40 ? C.amber : C.green)
    : C.green;

  // ── Pre-compute grouped display items for the logging exercise list ─────────
  // Must be computed BEFORE return() so renderExCard can be a clean function
  // definition (not nested inside JSX), avoiding Babel JSX parser confusion.
  const logDisplayItems = processExercisesForDisplay(logExercises);

  // renderExCard: renders one exercise card (header + expandable set rows).
  // Used for regular exercises and nested inside superset group cards.
  const renderExCard = (ex, keyOverride) => {
    const isOpen        = expanded === ex.id;
    const totalSets     = getTotalSets(ex);
    const skipped       = isSkipped(ex);
    const isDone        = allSetsOf(ex);
    const doneSetsCount = Array.from({ length: totalSets }, (_, i) => workoutDoneSets[`${ex.id}_${i + 1}`]).filter(Boolean).length;
    const isInProgress  = doneSetsCount > 0 && !isDone;
    const prevWeights   = Array.from({ length: totalSets }, (_, i) => lastWeights[`${ex.id}_${i + 1}`]).filter(Boolean);
    const stripeColor   = isDone && !skipped ? C.green : isInProgress ? C.primary : C.light;
    const isTimeBased   = ex.trackingType === 'time';
    return (
      <View key={keyOverride || ex.id}
        style={[lv.exCard, isDone && !skipped && lv.exCardDone, isInProgress && lv.exCardActive]}
        onLayout={e => { cardLayoutY.current[ex.id] = e.nativeEvent.layout.y; }}>
        <View style={[lv.exStripe, { backgroundColor: stripeColor }]} />
        <TouchableOpacity style={lv.exHeader}
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(isOpen ? null : ex.id); }}
          activeOpacity={0.8}>
          <TouchableOpacity
            style={[lv.exStatusChip, isDone && !skipped ? lv.exStatusChipDone : isInProgress ? lv.exStatusChipActive : lv.exStatusChipIdle]}
            onPress={() => setVideoExName({ name: ex.name, videoUrl: ex.videoUrl })}
            activeOpacity={0.7} hitSlop={4}>
            {isDone && !skipped ? <Ionicons name="checkmark" size={18} color="#fff" />
              : isInProgress ? <Text style={lv.exStatusCount}>{doneSetsCount}</Text>
              : <Ionicons name="play" size={15} color={C.mid} />}
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[lv.exName, (isDone || skipped) && lv.exNameDone]} numberOfLines={1}>
              {ex.name}{skipped ? <Text style={lv.skippedTag}> · Skipped</Text> : null}
            </Text>
            <Text style={lv.exMeta}>
              {skipped ? 'Skipped'
                : isTimeBased ? `${totalSets} sets · ${ex.durationSeconds || 30}s · ${ex.rest}s rest`
                : `${totalSets} sets · ${ex.rest}s rest`}
            </Text>
            {!isDone && prevWeights.some(Boolean) && (
              <TouchableOpacity style={lv.lastSessionBtn} hitSlop={6} activeOpacity={0.75}
                onPress={() => { const sets = Array.from({ length: getTotalSets(ex) }, (_, i) => ({ setNo: i + 1, weight: lastWeights[`${ex.id}_${i + 1}`] || null, reps: lastReps[`${ex.id}_${i + 1}`] || null })); setLastSessionModal({ name: ex.name, sets }); }}>
                <Ionicons name="time-outline" size={11} color={C.primary} />
                <Text style={lv.lastSessionBtnTxt}>Last session</Text>
              </TouchableOpacity>
            )}
            {isInProgress && (
              <View style={lv.progressRow}>
                <View style={lv.progressTrack}>
                  <View style={[lv.progressFill, { width: `${(doneSetsCount / totalSets) * 100}%` }]} />
                </View>
                <Text style={lv.progressFraction}>{doneSetsCount}/{totalSets} sets</Text>
              </View>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 3, marginLeft: 8 }}>
            {!isDone && !skipped && (
              <View style={lv.setAdjRow}>
                <TouchableOpacity style={lv.setAdjBtn} hitSlop={8} onPress={() => {
                  if (totalSets <= 1) return;
                  const key = `${ex.id}_${totalSets}`;
                  if (workoutDoneSets[key]) setWorkoutDoneSets(prev => { const n = {...prev}; delete n[key]; return n; });
                  if (localSetWeights[key]) setLocalSetWeights(prev => { const n = {...prev}; delete n[key]; return n; });
                  setExtraSets(prev => ({ ...prev, [ex.id]: (prev[ex.id] || 0) - 1 }));
                }}><Ionicons name="remove" size={13} color={C.muted} /></TouchableOpacity>
                <Text style={lv.setAdjCount}>{totalSets}</Text>
                <TouchableOpacity style={lv.setAdjBtn} hitSlop={8}
                  onPress={() => setExtraSets(prev => ({ ...prev, [ex.id]: (prev[ex.id] || 0) + 1 }))}>
                  <Ionicons name="add" size={13} color={C.muted} />
                </TouchableOpacity>
              </View>
            )}
            {isDone && !skipped ? <View style={lv.exStateLabelDone}><Text style={lv.exStateLabelTxtDone}>DONE</Text></View>
              : isInProgress ? <View style={lv.exStateLabelActive}><Text style={lv.exStateLabelTxtActive}>{doneSetsCount}/{totalSets}</Text></View>
              : skipped ? <View style={lv.exStateLabelSkip}><Text style={lv.exStateLabelTxtSkip}>SKIP</Text></View>
              : null}
            <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14}
              color={isDone ? C.green : isInProgress ? C.primary : C.muted} />
          </View>
        </TouchableOpacity>
        {isOpen && (
          <View style={lv.setList}>
            {skipped ? (
              <View style={lv.skippedBody}>
                <Text style={lv.skippedBodyTxt}>Exercise was skipped</Text>
                <TouchableOpacity style={lv.addSetBtn}
                  onPress={() => setExtraSets(prev => ({ ...prev, [ex.id]: (prev[ex.id] || 0) + 1 }))}>
                  <Ionicons name="add" size={14} color={C.primary} />
                  <Text style={lv.addSetTxt}>Add Set</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>{(ex.warmupSets > 0) && Array.from({ length: ex.warmupSets }, (_, wi) => {
                  const sk = `${ex.id}_w_${wi + 1}`;
                  const doneW = workoutDoneSets[sk]; const lastWW = lastWeights[sk];
                  const curW = !doneW && Array.from({ length: wi }, (_, j) => `${ex.id}_w_${j + 1}`).every(k => workoutDoneSets[k]);
                  const flashW = wkLatestDone === sk;
                  return (
                    <View key={sk}>
                      <View style={[lv.setRow, doneW && lv.setRowDone, curW && lv.setRowCurrent, flashW && { overflow: 'hidden' }]}>
                        {flashW && <Animated.View pointerEvents="none" style={[lv.flashOverlay, { opacity: wkFlashAnim }]} />}
                        <View style={[lv.setNumBadge, doneW ? lv.setNumBadgeDone : curW ? lv.setNumBadgeCurrent : lv.setNumBadgeWarmup]}>
                          {doneW ? <Ionicons name="checkmark" size={13} color="#fff" />
                            : <Text style={[lv.setNumTxt, curW && lv.setNumTxtCurrent, lv.setNumTxtWarmup]}>W</Text>}
                        </View>
                        <View style={lv.repsCol}>
                          <Text style={lv.fieldLabel}>REPS</Text>
                          {doneW ? <Text style={lv.fieldValueDone}>{customReps[sk] ?? ex.reps}</Text>
                            : <TextInput style={[lv.fieldInput, curW && lv.fieldInputActive]} keyboardType="number-pad"
                                maxLength={3} value={String(customReps[sk] ?? ex.reps)}
                                onChangeText={val => setCustomReps(prev => ({ ...prev, [sk]: val.replace(/[^0-9]/g, '') }))}
                                selectTextOnFocus autoCorrect={false} autoCapitalize="none" />}
                        </View>
                        <View style={lv.weightCol}>
                          <Text style={lv.fieldLabel}>KG</Text>
                          {doneW ? <Text style={lv.fieldValueDone}>{localSetWeights[sk] || lastWW || '—'}</Text>
                            : <TextInput ref={ref => { inputRefs.current[sk + '_w'] = ref; }}
                                style={[lv.fieldInput, lv.fieldInputWide, curW && lv.fieldInputActive]}
                                keyboardType="decimal-pad" placeholder={lastWW || '0'} placeholderTextColor={C.muted}
                                value={localSetWeights[sk] || ''}
                                onFocus={() => scrollToInput({ current: inputRefs.current[sk + '_w'] })}
                                onChangeText={val => { const u = { ...localSetWeights, [sk]: val }; setLocalSetWeights(u); setWorkoutSetWeights(u); }}
                                selectTextOnFocus autoCorrect={false} autoCapitalize="none" />}
                        </View>
                        {doneW ? <View style={lv.doneTick}><Ionicons name="checkmark-circle" size={22} color={C.green} /></View>
                          : <TouchableOpacity style={[lv.completeSetBtn, curW && lv.completeSetBtnActive]}
                              onPress={() => { markSetDone(ex.id, `w_${wi + 1}`, 0, ex.warmupSets); triggerWkFlash(sk); }}
                              activeOpacity={0.75}><Ionicons name="checkmark" size={20} color={curW ? '#fff' : C.muted} /></TouchableOpacity>}
                      </View>
                      {curW && !doneW && (
                        <View style={lv.quickActions}>
                          {lastWW && <TouchableOpacity style={lv.quickBtn} onPress={() => matchWkLast(sk)}><Text style={lv.quickBtnTxt}>Match last</Text></TouchableOpacity>}
                          <TouchableOpacity style={lv.quickBtn} onPress={() => adjustWkWeight(sk, 2.5)}><Text style={lv.quickBtnTxt}>+2.5 kg</Text></TouchableOpacity>
                          <TouchableOpacity style={lv.quickBtn} onPress={() => adjustWkWeight(sk, 5)}><Text style={lv.quickBtnTxt}>+5 kg</Text></TouchableOpacity>
                          <TouchableOpacity style={lv.quickBtn} onPress={() => adjustWkWeight(sk, -2.5)}><Text style={lv.quickBtnTxt}>−2.5</Text></TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
                {Array.from({ length: totalSets }, (_, i) => {
                  const setNo = i + 1; const sk = `${ex.id}_${setNo}`;
                  const doneS = workoutDoneSets[sk]; const lastW = lastWeights[sk]; const restLeft = restTimers[sk];
                  const curS = !doneS &&
                    Array.from({ length: setNo - 1 }, (_, j) => `${ex.id}_${j + 1}`).every(k => workoutDoneSets[k]) &&
                    Array.from({ length: ex.warmupSets || 0 }, (_, j) => `${ex.id}_w_${j + 1}`).every(k => workoutDoneSets[k]);
                  const flashS = wkLatestDone === sk;
                  const defaultVal = isTimeBased ? (ex.durationSeconds ?? 30) : ex.reps;
                  return (
                    <View key={setNo}>
                      <SwipeableSetRow done={!!doneS} enabled={!doneS}
                        onComplete={() => { markSetDone(ex.id, setNo, ex.rest, totalSets); triggerWkFlash(sk); }}>
                        <View style={[lv.setRow, doneS && lv.setRowDone, curS && lv.setRowCurrent, flashS && { overflow: 'hidden' }]}>
                          {flashS && <Animated.View pointerEvents="none" style={[lv.flashOverlay, { opacity: wkFlashAnim }]} />}
                          <View style={[lv.setNumBadge, doneS ? lv.setNumBadgeDone : curS ? lv.setNumBadgeCurrent : null]}>
                            {doneS ? <Ionicons name="checkmark" size={13} color="#fff" />
                              : <Text style={[lv.setNumTxt, curS && lv.setNumTxtCurrent]}>{setNo}</Text>}
                          </View>
                          <View style={lv.repsCol}>
                            <Text style={lv.fieldLabel}>{isTimeBased ? 'SEC' : 'REPS'}</Text>
                            {doneS ? <Text style={lv.fieldValueDone}>{customReps[sk] ?? defaultVal}</Text>
                              : <TextInput style={[lv.fieldInput, curS && lv.fieldInputActive]}
                                  keyboardType="number-pad" returnKeyType="next" blurOnSubmit={false} maxLength={4}
                                  value={String(customReps[sk] ?? defaultVal)}
                                  onChangeText={val => setCustomReps(prev => ({ ...prev, [sk]: val.replace(/[^0-9]/g, '') }))}
                                  selectTextOnFocus autoCorrect={false} autoCapitalize="none" />}
                          </View>
                          {!isTimeBased && (
                            <View style={lv.weightCol}>
                              <Text style={lv.fieldLabel}>KG</Text>
                              {doneS ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={lv.fieldValueDone}>{localSetWeights[sk] || lastW || '—'}</Text>
                                  {rpeLog[sk] != null && <View style={lv.rpeBadge}><Text style={lv.rpeBadgeTxt}>RPE {rpeLog[sk]}</Text></View>}
                                </View>
                              ) : (
                                <TextInput ref={ref => { inputRefs.current[sk + '_kg'] = ref; }}
                                  style={[lv.fieldInput, lv.fieldInputWide, curS && lv.fieldInputActive]}
                                  keyboardType="decimal-pad" returnKeyType="done" blurOnSubmit={false}
                                  placeholder={lastW || '0'} placeholderTextColor={C.muted}
                                  value={localSetWeights[sk] || ''}
                                  onFocus={() => scrollToInput({ current: inputRefs.current[sk + '_kg'] })}
                                  onChangeText={val => { const u = { ...localSetWeights, [sk]: val }; setLocalSetWeights(u); setWorkoutSetWeights(u); }}
                                  selectTextOnFocus autoCorrect={false} autoCapitalize="none" />
                              )}
                            </View>
                          )}
                          {doneS ? <View style={lv.doneTick}><Ionicons name="checkmark-circle" size={22} color={C.green} /></View>
                            : <TouchableOpacity style={[lv.completeSetBtn, curS && lv.completeSetBtnActive]}
                                onPress={() => { markSetDone(ex.id, setNo, ex.rest, totalSets); triggerWkFlash(sk); }}
                                activeOpacity={0.75}><Ionicons name="checkmark" size={20} color={curS ? '#fff' : C.muted} /></TouchableOpacity>}
                        </View>
                      </SwipeableSetRow>
                      {curS && !doneS && !isTimeBased && (
                        <View style={lv.quickActions}>
                          {(lastW || lastReps[sk]) && <TouchableOpacity style={[lv.quickBtn, lv.quickBtnMatch]} onPress={() => matchWkLast(sk)}>
                            <Ionicons name="copy-outline" size={11} color={C.primary} />
                            <Text style={[lv.quickBtnTxt, { color: C.primary }]}>Match last</Text>
                          </TouchableOpacity>}
                          <TouchableOpacity style={lv.quickBtn} onPress={() => adjustWkWeight(sk, 2.5)}><Text style={lv.quickBtnTxt}>+2.5 kg</Text></TouchableOpacity>
                          <TouchableOpacity style={lv.quickBtn} onPress={() => adjustWkWeight(sk, 5)}><Text style={lv.quickBtnTxt}>+5 kg</Text></TouchableOpacity>
                          <TouchableOpacity style={lv.quickBtn} onPress={() => adjustWkWeight(sk, -2.5)}><Text style={lv.quickBtnTxt}>−2.5</Text></TouchableOpacity>
                        </View>
                      )}
                      {pendingRpeKey === sk && (
                        <RPEPickerRow C={C} t={theme}
                          onSelect={rating => { if (rpeTimerRef.current) clearTimeout(rpeTimerRef.current); setRpeLog(prev => ({ ...prev, [sk]: rating })); setPendingRpeKey(null); }}
                          onSkip={() => { if (rpeTimerRef.current) clearTimeout(rpeTimerRef.current); setPendingRpeKey(null); }} />
                      )}
                      {doneS && restLeft !== undefined && restLeft > 0 && (
                        <View style={lv.restStrip}>
                          <Ionicons name="hourglass-outline" size={14} color={restLeft < 20 ? C.red : restLeft < 40 ? C.amber : C.green} />
                          <Text style={[lv.restStripTime, { color: restLeft < 20 ? C.red : restLeft < 40 ? C.amber : C.green }]}>
                            {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
                          </Text>
                          <Text style={[lv.restStripLabel, { color: restLeft < 20 ? C.red : restLeft < 40 ? C.amber : C.green }]}>rest</Text>
                          <View style={{ flex: 1 }} />
                          <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(sk, -15)}><Text style={lv.restAdjTxt}>−15s</Text></TouchableOpacity>
                          <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(sk, 30)}><Text style={lv.restAdjTxt}>+30s</Text></TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
                {ex.note ? (
                  <View style={lv.trainerNoteRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={C.primary} />
                    <Text style={lv.trainerNote}>{ex.note}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        )}
      </View>
    );
  };
  // end renderExCard — defined before return() to avoid Babel JSX parse issues

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Hero workout header ──────────────────────────────────────────
          Show whenever the timer is running OR completed (not just isLogging)
          so the user can see the elapsed time and access Continue / Complete
          even from the overview tab without re-entering the logging view.   */}
      {(isLogging || workoutTimer?.running) && logExercises.length > 0 && (
        <View style={[wk.heroHeader, {
          backgroundColor: C.card,
          borderBottomColor: C.border,
        }]}>
          <WorkoutHeroHeader
            workoutName={activeWorkout?.dayLabel || activeWorkout?.name || 'Workout'}
            elapsed={elapsed}
            doneCount={doneCount}
            totalExercises={logExercises.length}
            currentExName={currentExName}
            totalDoneSets={totalDoneSetsAll}
            totalSets={totalSetsAll}
            allDone={allDone}
            isPaused={isPaused}
            elapsedColor={elapsedColor}
            isLogging={isLogging}
            C={C}
            t={theme}
            onPauseToggle={handlePauseToggle}
            onFinish={() => { setCompleteMinutes(''); setShowCompleteModal(true); }}
            onContinue={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setMetaCollapsed(true);
              if (!workoutTimer?.running && !workoutTimer?.completed) startWorkoutTimer();
              setIsLogging(true);
            }}
            onOpenTimer={() => setShowBreakModal(true)}
          />
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={[g.screen, isLogging && { paddingTop: 0 }]}
        contentContainerStyle={{ paddingBottom: Math.max(24, kbPadding) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          currentScrollY.current = y;   // tracked for keyboard scroll calculation
          setScrolledPastHeader(y > 120);
        }}
        scrollEventThrottle={16}
      >
        {/* ═══ HEADER ROW ═══
            Hidden when logging — the hero header above the scroll already
            shows the workout name, timer, and all controls. Showing it
            again in the scroll creates the "duplicate name" the user reported.
            When NOT logging: show "Workouts" title + History button + collapse
            chevron for the day-strip metadata section.                       */}
        {!isLogging && (
          <View style={wk.headerRow}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={wk.headerTitle}>Workouts</Text>
              {/* Collapse toggle — shown whenever metadata section exists */}
              {(planWeek || assignment?.weekPlan) && (
                <TouchableOpacity
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setMetaCollapsed(v => !v);
                  }}
                  hitSlop={10}
                  style={wk.metaToggleBtn}
                >
                  <Ionicons
                    name={metaCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={16}
                    color={C.muted}
                  />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ marginLeft: 12, alignItems: 'flex-end', paddingTop: 2 }}>
              {onViewHistory && (
                <TouchableOpacity onPress={onViewHistory} style={wk.historyBtn}>
                  <Ionicons name="time-outline" size={14} color={C.deepBlue} />
                  <Text style={wk.historyTxt}>History</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Collapsible metadata: day pills + workout name ─────────────
            Hidden by default when isLogging (auto-collapses on start).
            User can toggle with the chevron in the header row.          */}
        {!metaCollapsed && (planWeek || assignment?.weekPlan) && (
          <>
            <View style={{ marginTop: 12 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10, paddingHorizontal: 2 }}>
              {(planWeek || assignment.weekPlan).map((d, i) => {
                const isToday = d.isToday ?? (i === todayPlanIdx);
                const planIdxForDay = d.planIdx ?? i;
                const isSelected = selectedDayIdx === planIdxForDay;
                const isActive = isSelected || (selectedDayIdx === null && isToday);
                const isRestOverride = restDays?.[planIdxForDay];
                const isRest = d.rest || isRestOverride;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[wk.dayCard, isActive && wk.dayCardActive, !isActive && isRest && wk.dayCardRest]}
                    onPress={() => handleDayPress(i)}
                    onLongPress={() => handleDayLongPress(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[wk.dayName, isActive && wk.weekTxtW]}>{d.day}</Text>
                    {isActive && <View style={wk.activeLine} />}
                    {!isActive && !isRest && d.exerciseCount > 0 && (
                      <View style={[wk.dayExPill]}>
                        <Text style={[wk.dayExCount]}>{d.exerciseCount}</Text>
                      </View>
                    )}
                    {isRest && !isActive && <Text style={[wk.dayLabel, { color: C.mid }]}>Rest</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ marginBottom: 4 }} />
          </>
        )}

        {/* Workout day title — hidden when collapsed or when logging
            (hero header already shows the name when logging)           */}
        {!metaCollapsed && !isLogging && (() => {
          const selectedDayRest = selectedDayIdx !== null ? (selectedDay?.restDay || restDays?.[selectedDayIdx]) : (todayWorkout?.isRestDay || restDays?.[todayPlanIdx]);
          if (selectedDayRest) return null;
          const title = selectedDayIdx !== null && selectedDay
            ? (selectedDay.dayLabel || '')
            : (todayWorkout?.dayLabel || todayWorkout?.name || '');
          if (!title) return null;
          return (
            <Text style={wk.dayWorkoutTitle} numberOfLines={2}>{title}</Text>
          );
        })()}

        {/* Trainer-started workout notification */}
        {activeWorkoutLog?.startedBy === 'trainer' && activeWorkoutLog.status === 'incomplete' && (
          <View style={wk.trainerNotif}>
            <View style={wk.trainerNotifIcon}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={wk.trainerNotifTitle}>Trainer started a workout</Text>
              <Text style={wk.trainerNotifSub}>{activeWorkoutLog.dayLabel || activeWorkoutLog.planName} · Tap Start to begin</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.primary} />
          </View>
        )}

        {/* Selected day view + today view — hidden entirely when actively logging.
            When isLogging, only the exercise cards section below renders.
            This prevents Rest Day / empty state from showing below the hero. */}
        {!isLogging && selectedDayIdx !== null && selectedDay ? (
          <>
            {/* Header row: ← Today  |  ✓ (completed badge, icon-only) */}
            <View style={wk.selectedDayHeader}>
              <TouchableOpacity onPress={() => setSelectedDayIdx(null)} style={wk.backBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={14} color={C.primary} />
                <Text style={wk.backBtnTxt}>Today</Text>
              </TouchableOpacity>
              {selectedDay.completedAt ? (
                /* Completed badge — icon only, tappable to view summary */
                <TouchableOpacity
                  style={wk.completedBadge}
                  activeOpacity={0.8}
                  onPress={() => onWorkoutFinish?.(buildWorkoutFinishData({
                    dayLabel: selectedDay.dayLabel || todayFullDay,
                    planName: fullPlan?.name || selectedDay.dayLabel || 'Workout',
                    durationSeconds: selectedDay.durationSeconds || 0,
                    exercises: selectedDay.exercises || [],
                  }))}
                >
                  <Ionicons name="checkmark-circle" size={16} color={C.green} />
                  <Text style={wk.completedBadgeTxt}>Done</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {(selectedDay.restDay || restDays?.[selectedDayIdx]) ? (
              <View style={wk.emptyState}>
                <View style={wk.emptyIconCircle}>
                  <Ionicons name="moon" size={32} color={C.deepBlue} />
                </View>
                <Text style={wk.emptyTitle}>Rest Day</Text>
                <Text style={wk.emptySub}>Recovery is part of progress</Text>
              </View>
            ) : selectedDay.exercises?.length > 0 ? (
              <>
                {(() => {
                  // Group exercises into display items before rendering
                  const rawExs = selectedDay.exercises || [];
                  const groups = processExercisesForDisplay(rawExs.map(ex => ({
                    ...ex, id: ex.id || ex.name,
                    circuitId: ex.circuitId || null,
                    supersetGroup: ex.supersetGroup || null,
                  })));
                  const totalDisplay = groups.length;
                  const SS_COLORS = { A:'#ef4444', B:'#f97316', C:'#8b5cf6', D:'#06b6d4' };

                  return (
                    <>
                      <Text style={wk.exCountHint}>
                        {totalDisplay} item{totalDisplay !== 1 ? 's' : ''} · {rawExs.length} exercises
                      </Text>

                      {groups.map((item, gIdx) => {
                        /* ── SUPERSET ── */
                        if (item.type === 'superset') {
                          const ssBg = SS_COLORS[item.id] || C.primary;
                          return (
                            <View key={`ss_${item.id}_${gIdx}`} style={[wk.exCardStatic, { borderLeftWidth: 4, borderLeftColor: ssBg, paddingLeft: 0 }]}>
                              {/* Superset header */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
                                borderBottomWidth: 1, borderBottomColor: `${ssBg}25` }}>
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${ssBg}18`, borderWidth: 1,
                                  borderColor: `${ssBg}40`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: ssBg }}>SS</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: ssBg }}>Superset {item.id}</Text>
                                  <Text style={wk.exMeta}>{item.exercises.length} exercises · {item.exercises[0]?.mainRestSeconds || 60}s rest after pair</Text>
                                </View>
                              </View>
                              {/* Superset exercises */}
                              {item.exercises.map((ex, ei) => {
                                const isTime = ex.trackingType === 'time';
                                const metric = isTime
                                  ? `${ex.mainDurationSeconds || 30}${ex.mainDurationSecondsMax ? `–${ex.mainDurationSecondsMax}` : ''}s`
                                  : `${ex.mainReps || 10}${ex.mainRepsMax ? `–${ex.mainRepsMax}` : ''} reps`;
                                return (
                                  <View key={ex.id || ei} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
                                    borderTopWidth: ei > 0 ? 1 : 0, borderTopColor: `${ssBg}18` }}>
                                    <TouchableOpacity style={wk.ytChip} onPress={() => setVideoExName({ name: ex.name, videoUrl: ex.videoUrl })} hitSlop={6} activeOpacity={0.75}>
                                      <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                      <Text style={wk.exName}>{ex.name}</Text>
                                      <Text style={wk.exMeta}>{(ex.mainSets || 3)} × {metric}</Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        }

                        /* ── CIRCUIT ── */
                        if (item.type === 'circuit') {
                          return (
                            <View key={`c_${item.id}_${gIdx}`} style={[wk.exCardStatic, { borderLeftWidth: 4, borderLeftColor: C.primary }]}>
                              {/* Circuit header */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
                                borderBottomWidth: 1, borderBottomColor: 'rgba(79,70,229,0.15)' }}>
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(79,70,229,0.12)',
                                  borderWidth: 1, borderColor: 'rgba(79,70,229,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                  <Text style={{ fontSize: 12 }}>⚡</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary }}>Circuit {item.id}</Text>
                                  <Text style={wk.exMeta}>{item.rounds} rounds · {item.restSeconds}s rest between rounds · {item.exercises.length} exercises</Text>
                                </View>
                              </View>
                              {/* Circuit exercises */}
                              {item.exercises.map((ex, ei) => {
                                const isTime = ex.trackingType === 'time';
                                const metric = isTime
                                  ? `${ex.mainDurationSeconds || 30}${ex.mainDurationSecondsMax ? `–${ex.mainDurationSecondsMax}` : ''}s`
                                  : `${ex.mainReps || 10}${ex.mainRepsMax ? `–${ex.mainRepsMax}` : ''} reps`;
                                return (
                                  <View key={ex.id || ei} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
                                    borderTopWidth: ei > 0 ? 1 : 0, borderTopColor: 'rgba(79,70,229,0.1)' }}>
                                    <TouchableOpacity style={wk.ytChip} onPress={() => setVideoExName({ name: ex.name, videoUrl: ex.videoUrl })} hitSlop={6} activeOpacity={0.75}>
                                      <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                      <Text style={wk.exName}>{ex.name}</Text>
                                      <Text style={wk.exMeta}>{isTime ? '⏱' : ''} {metric}</Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        }

                        /* ── REGULAR ── */
                        const ex = item.exercises[0];
                        const sets = ex.mainSets || 3;
                        const rest = ex.mainRestSeconds || 60;
                        const isTime = ex.trackingType === 'time';
                        const metric = isTime
                          ? `${ex.mainDurationSeconds || 30}${ex.mainDurationSecondsMax ? `–${ex.mainDurationSecondsMax}` : ''}s`
                          : `${ex.mainReps || 10}${ex.mainRepsMax ? `–${ex.mainRepsMax}` : ''} reps`;
                        return (
                          <View key={ex.id || gIdx} style={wk.exCardStatic}>
                            <View style={wk.exCardTouch}>
                              <TouchableOpacity style={wk.ytChip} onPress={() => setVideoExName({ name: ex.name, videoUrl: ex.videoUrl })} hitSlop={6} activeOpacity={0.75}>
                                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                              </TouchableOpacity>
                              <View style={{ flex: 1 }}>
                                <Text style={wk.exName}>{ex.name}</Text>
                                <Text style={wk.exMeta}>
                                  {isTime ? `⏱ ${metric} × ${sets} sets` : `${sets} × ${metric}`} · {rest}s rest
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  );
                })()}
                {/* Start / Mark Complete buttons — only shown for incomplete days.
                    The "Completed" status is now shown as a badge in the header. */}
                {!selectedDay.completedAt && (
                  <View style={wk.btnRow}>
                    <TouchableOpacity
                      style={[wk.startBtn, { flex: 1 }]}
                      onPress={() => {
                        const exs = selectedDay.exercises.map(ex => ({
                          id:                 ex.id || ex.name,
                          name:               ex.name,
                          sets:               ex.mainSets || 3,
                          trackingType:       ex.trackingType || 'reps',
                          reps:               ex.mainReps || 10,
                          repsMax:            ex.mainRepsMax || null,
                          durationSeconds:    ex.mainDurationSeconds || null,
                          durationSecondsMax: ex.mainDurationSecondsMax || null,
                          rest:               ex.mainRestSeconds || 60,
                          note:               ex.notes || '',
                          warmupSets:         ex.warmupSets || 0,
                          supersetGroup:      ex.supersetGroup      || null,
                          circuitId:          ex.circuitId          || null,
                          circuitRounds:      ex.circuitRounds      || null,
                          circuitRestSeconds: ex.circuitRestSeconds || null,
                          muscleGroup:        ex.muscleGroup || '',
                          videoUrl:           ex.videoUrl || '',
                        }));
                        const estSecs = exs.reduce((acc, ex) => acc + ex.sets * (45 + ex.rest), 0);
                        setWorkoutDoneSets({});
                        setWorkoutSetWeights({});
                        setRestEndTimes({});
                        setLoggingWorkout({
                          id: fullPlan?.id || selectedDay.dayLabel,
                          name: fullPlan?.name || selectedDay.dayLabel || "Today's Workout",
                          estimatedMinutes: Math.max(10, Math.round(estSecs / 60)),
                          exercises: exs,
                          dayLabel: selectedDay.dayLabel || todayFullDay,
                        });
                        loggingDayIdxRef.current = selectedDayIdx;
                        setSelectedDayIdx(null);
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setMetaCollapsed(true);
                        startWorkoutTimer();
                        setIsLogging(true);
                      }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="play" size={16} color="#fff" />
                        <Text style={wk.startBtnTxt}>Start</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={[wk.startBtn, { flex: 1, backgroundColor: C.green }]} onPress={() => {
                      setPastCompleteDayIdx(selectedDayIdx);
                      setPastCompleteDay(selectedDay);
                      setPastCompleteMinutes('');
                      setShowPastCompleteModal(true);
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="checkmark-done" size={16} color="#fff" />
                        <Text style={wk.startBtnTxt}>Complete</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <View style={wk.emptyState}>
                <View style={wk.emptyIconCircle}>
                  <Ionicons name="barbell-outline" size={32} color={C.mid} />
                </View>
                <Text style={wk.emptyTitle}>No exercises assigned</Text>
              </View>
            )}
          </>
        ) : (
          /* Today's Workout (default view) */
          <>
            {todayWorkout && !todayWorkout.isRestDay ? (
              <>
                {workoutTimer?.running && !isLogging && (
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                    <View style={wk.liveChip}>
                      <View style={wk.liveDot} />
                      <Text style={wk.liveTxt}>In Progress</Text>
                    </View>
                  </View>
                )}

                {workoutTimer?.completed && (
                  <TouchableOpacity
                    style={wk.completionCard}
                    activeOpacity={0.8}
                    onPress={() => onWorkoutFinish?.(buildWorkoutFinishData({
                      dayLabel:        activeWorkout?.dayLabel || todayWorkout?.dayLabel || '',
                      planName:        activeWorkout?.name || todayWorkout?.name || 'Workout',
                      durationSeconds: elapsed,
                      exercises:       logExercises.length > 0 ? logExercises : (todayWorkout?.exercises || []),
                    }))}>
                    <View style={wk.completionCardLeft}>
                      <View style={wk.completionIconCircle}>
                        <Ionicons name="trophy" size={22} color="#fff" />
                      </View>
                      <View>
                        <Text style={wk.completionTitle}>Workout Complete!</Text>
                        <Text style={wk.completionSub}>
                          {elapsed > 0 ? `Finished in ${formatElapsed(elapsed)}` : 'Great job today'}
                        </Text>
                      </View>
                    </View>
                    <View style={wk.completionViewBtn}>
                      <Text style={wk.completionViewTxt}>View</Text>
                      <Ionicons name="chevron-forward" size={14} color={C.green} />
                    </View>
                  </TouchableOpacity>
                )}

                {/* ── Overview exercise cards (pre-logging state) ─────────────
                    Improvements vs before:
                    • Exercise sequence number (01, 02…) in the icon chip
                    • Status badge: "DONE ✓" / "Xkg last" — at-a-glance info
                    • Muscle group tag visible in collapsed state
                    • Placeholder rows use token colors (not hardcoded greys)
                    • LayoutAnimation on expand for smooth height transition  */}
                {!isLogging && todayWorkout.exercises?.map((ex, exIdx) => {
                  const isDone    = allSetsOf(ex);
                  const bestPrevW = lastWeights[`${ex.id}_1`];
                  return (
                    // Same compact style as selected-day cards — no expand, no chevron,
                    // no inner white set-table box. Consistent across all workout screens.
                    <View key={ex.id} style={wk.exCardStatic}>
                      <View style={wk.exCardTouch}>
                        {/* YouTube chip */}
                        <TouchableOpacity
                          style={wk.ytChip}
                          onPress={() => setVideoExName({ name: ex.name, videoUrl: ex.videoUrl })}
                          hitSlop={6}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                        </TouchableOpacity>

                        <View style={{ flex: 1 }}>
                          <Text style={[wk.exName, isDone && wk.exNameDone]} numberOfLines={1}>
                            {ex.name}
                          </Text>
                          <Text style={wk.exMeta}>
                            {ex.sets} sets · {ex.rest}s rest
                          </Text>
                          {(ex.muscleGroup || (bestPrevW && !isDone)) ? (
                            <View style={wk.exMetaRow}>
                              {ex.muscleGroup ? (
                                <View style={wk.exMusclePill}>
                                  <Text style={wk.exMuscleText}>{ex.muscleGroup}</Text>
                                </View>
                              ) : null}
                              {bestPrevW && !isDone ? (
                                <Text style={wk.exLastWeight}>Last: {bestPrevW} kg</Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>

                        {/* Status pip only — no chevron */}
                      </View>
                    </View>
                  );
                })}

                {/* Start button — only shown before workout is running.
                    Once running, Continue + Complete are in the hero header
                    as icon buttons, so we don't duplicate them here.       */}
                {!workoutTimer?.running && !workoutTimer?.completed && (
                  <TouchableOpacity
                    style={[wk.startBtn, { alignSelf: 'stretch' }]}
                    onPress={() => {
                      // Immediately collapse day chips + workout name — no useEffect delay
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setMetaCollapsed(true);
                      startWorkoutTimer();
                      setIsLogging(true);
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="play" size={16} color="#fff" />
                      <Text style={wk.startBtnTxt}>Start Workout</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>
            ) : (todayWorkout?.isRestDay || restDays?.[todayPlanIdx]) ? (
              <View style={wk.emptyState}>
                <View style={wk.emptyIconCircle}>
                  <Ionicons name="moon" size={32} color={C.deepBlue} />
                </View>
                <Text style={wk.emptyTitle}>Rest Day</Text>
                <Text style={wk.emptySub}>Recovery is part of progress.{"\n"}Take it easy today.</Text>
              </View>
            ) : (
              <View style={wk.emptyState}>
                <View style={wk.emptyIconCircle}>
                  <Ionicons name="barbell-outline" size={32} color={C.mid} />
                </View>
                <Text style={wk.emptyTitle}>No workout yet</Text>
                <Text style={wk.emptySub}>Your trainer will assign a{"\n"}workout plan soon</Text>
              </View>
            )}
          </>
        )}

        {/* ── Inline workout logging cards ─────────────────────────────────── */}
        {isLogging && selectedDayIdx === null && (
          <View>
            <Text style={lv.exercisesLabel}>EXERCISES</Text>
            {/* ── Grouped render: supersets + circuits + regular ─────────── */}
            {/* renderExCard and logDisplayItems are defined before return() */}
            {logDisplayItems.map((item, gIdx) => {
              const SS_COLORS = { A:'#ef4444', B:'#f97316', C:'#8b5cf6', D:'#06b6d4' };

              // SUPERSET GROUP ─────────────────────────────────────────────
              if (item.type === 'superset') {
                const ssBg = SS_COLORS[item.id] || C.primary;
                const allSSDone = item.exercises.every(e => allSetsOf(e));
                return (
                  <View key={`ss_${item.id}_${gIdx}`}
                    style={[lv.exCard, allSSDone && lv.exCardDone, { borderLeftWidth: 4, borderLeftColor: ssBg }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
                      borderBottomWidth: 1, borderBottomColor: ssBg + '30' }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ssBg + '18',
                        borderWidth: 1.5, borderColor: ssBg + '50', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: ssBg }}>SS{item.id}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: ssBg }}>Superset {item.id}</Text>
                        <Text style={lv.exMeta}>{item.exercises.length} exercises · {item.exercises[0] && item.exercises[0].rest ? item.exercises[0].rest : 60}s rest after pair</Text>
                      </View>
                      {allSSDone && <Ionicons name="checkmark-circle" size={22} color={C.green} />}
                    </View>
                    {item.exercises.map(ex => renderExCard(ex, 'ss_' + item.id + '_' + ex.id))}
                  </View>
                );
              }

              // CIRCUIT GROUP ──────────────────────────────────────────────
              if (item.type === 'circuit') {
                const cId = item.id;
                const totalRounds = item.rounds;
                const curRound = circuitRound[cId] || 1;
                const isDone = !!circuitCompleted[cId];
                const getActual = exId => circuitActuals[cId + '_' + curRound + '_' + exId] ?? null;
                const setActual = (exId, val) => setCircuitActuals(prev => {
                  const next = Object.assign({}, prev);
                  next[cId + '_' + curRound + '_' + exId] = val;
                  return next;
                });
                const completeRound = () => {
                  const restKey = curRound >= totalRounds
                    ? 'circuit_' + cId + '_done'
                    : 'circuit_' + cId + '_r' + curRound;
                  setRestEndTimes(prev => Object.assign({}, prev, { [restKey]: Date.now() + item.restSeconds * 1000 }));
                  if (curRound >= totalRounds) {
                    setCircuitCompleted(prev => Object.assign({}, prev, { [cId]: true }));
                  } else {
                    setCircuitRound(prev => Object.assign({}, prev, { [cId]: curRound + 1 }));
                  }
                };
                const circuitRestKey = Object.keys(restTimers).find(k => k.startsWith('circuit_' + cId) && restTimers[k] > 0);
                const circuitRestLeft = circuitRestKey ? restTimers[circuitRestKey] : null;
                return (
                  <View key={'c_' + cId + '_' + gIdx}
                    style={[lv.exCard, isDone && lv.exCardDone, { borderLeftWidth: 4, borderLeftColor: C.primary }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
                      borderBottomWidth: 1, borderBottomColor: 'rgba(79,70,229,0.2)' }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(79,70,229,0.12)',
                        borderWidth: 1.5, borderColor: 'rgba(79,70,229,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ fontSize: 14 }}>{'⚡'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: C.primary }}>{'Circuit ' + cId}</Text>
                        <Text style={lv.exMeta}>{totalRounds + ' rounds · ' + item.restSeconds + 's rest between rounds'}</Text>
                      </View>
                      {isDone && <Ionicons name="checkmark-circle" size={22} color={C.green} />}
                    </View>
                    {!isDone ? (
                      <View style={{ padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: C.mid, letterSpacing: 1 }}>ROUND</Text>
                          {Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => (
                            <View key={r} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                              backgroundColor: r < curRound ? C.green : r === curRound ? C.primary : 'rgba(79,70,229,0.1)',
                              borderWidth: r === curRound ? 0 : 1.5,
                              borderColor: r < curRound ? C.green : 'rgba(79,70,229,0.3)' }}>
                              {r < curRound
                                ? <Ionicons name="checkmark" size={15} color="#fff" />
                                : <Text style={{ fontSize: 13, fontWeight: '800', color: r === curRound ? '#fff' : C.primary }}>{r}</Text>}
                            </View>
                          ))}
                        </View>
                        {item.exercises.map((ex, ei) => {
                          const isTimeBased = ex.trackingType === 'time';
                          const target = isTimeBased ? (ex.durationSeconds || 30) : (ex.reps || 10);
                          const actual = getActual(ex.id);
                          return (
                            <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12,
                              borderBottomWidth: ei < item.exercises.length - 1 ? 1 : 0, borderBottomColor: 'rgba(79,70,229,0.1)' }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: C.dark }}>{ex.name}</Text>
                                <Text style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>
                                  {'Target: ' + target + (isTimeBased ? 's' : ' reps')}
                                </Text>
                              </View>
                              <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: C.primary, marginBottom: 4 }}>
                                  {isTimeBased ? 'SEC' : 'REPS'}
                                </Text>
                                <TextInput
                                  style={{ width: 64, height: 42, borderRadius: 10, borderWidth: 1.5,
                                    borderColor: 'rgba(79,70,229,0.5)', backgroundColor: 'rgba(79,70,229,0.06)',
                                    textAlign: 'center', fontSize: 20, fontWeight: '800', color: C.dark }}
                                  keyboardType="number-pad" maxLength={4}
                                  value={actual != null ? String(actual) : String(target)}
                                  onChangeText={val => setActual(ex.id, val.replace(/[^0-9]/g, ''))}
                                  selectTextOnFocus
                                />
                              </View>
                            </View>
                          );
                        })}
                        <TouchableOpacity
                          style={{ backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 }}
                          activeOpacity={0.8} onPress={completeRound}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                            {curRound >= totalRounds ? '✓ Complete Circuit' : 'Complete Round ' + curRound + ' of ' + totalRounds}
                          </Text>
                        </TouchableOpacity>
                        {circuitRestLeft != null && circuitRestLeft > 0 && (
                          <View style={[lv.restStrip, { marginTop: 10 }]}>
                            <Ionicons name="hourglass-outline" size={14} color={circuitRestLeft < 20 ? C.red : circuitRestLeft < 40 ? C.amber : C.green} />
                            <Text style={[lv.restStripTime, { color: circuitRestLeft < 20 ? C.red : circuitRestLeft < 40 ? C.amber : C.green }]}>
                              {Math.floor(circuitRestLeft / 60) + ':' + String(circuitRestLeft % 60).padStart(2, '0')}
                            </Text>
                            <Text style={[lv.restStripLabel, { color: circuitRestLeft < 20 ? C.red : circuitRestLeft < 40 ? C.amber : C.green }]}>rest</Text>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(circuitRestKey, -15)}><Text style={lv.restAdjTxt}>-15s</Text></TouchableOpacity>
                            <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(circuitRestKey, 30)}><Text style={lv.restAdjTxt}>+30s</Text></TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: C.green, fontWeight: '700', fontSize: 16 }}>{'✓ All ' + totalRounds + ' rounds complete!'}</Text>
                      </View>
                    )}
                  </View>
                );
              }

              // REGULAR EXERCISE ───────────────────────────────────────────
              return renderExCard(item.exercises[0], 'reg_' + gIdx + '_' + (item.exercises[0] && item.exercises[0].id));
            })}
            {/* end logDisplayItems.map */}
          </View>
        )}

      </ScrollView>

      {/* ── Unified Timer Bottom Sheet ─────────────────────────────────────
          Opens automatically when a set is completed (startRestTimer calls
          setShowBreakModal). Also opens manually via the clock icon in the
          hero header. Content switches based on active state:
            • Auto-rest active  → countdown + Skip/±10s controls
            • No active rest    → ManualBreakTimer (unchanged component)   */}
      <Modal
        visible={showBreakModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBreakModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={[breakModalSheet, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={breakModalHandle} />

            {/* ── Mode label + close ── */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.dark, letterSpacing: -0.2 }}>
                {activeRestLeft !== undefined && activeRestLeft > 0 ? 'Rest Timer' : 'Break Timer'}
              </Text>
              <TouchableOpacity onPress={() => setShowBreakModal(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={C.muted} />
              </TouchableOpacity>
            </View>

            {/* ── Auto-rest mode: driven by restEndTimes ── */}
            {activeRestLeft !== undefined && activeRestLeft > 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                {/* Big countdown — colour shifts amber→red as time runs out */}
                <Text style={{
                  fontSize: 56, fontWeight: '800', letterSpacing: -1,
                  fontVariant: ['tabular-nums'],
                  color: activeRestLeft < 10 ? C.red : activeRestLeft < 20 ? C.amber : C.green,
                }}>
                  {formatRest(activeRestLeft)}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.2, marginTop: 4, textTransform: 'uppercase' }}>
                  Rest · {activeRestKey ? (() => { const m = activeRestKey.match(/_(\d+)$/); return m ? `Set ${m[1]}` : ''; })() : ''}
                </Text>

                {/* Controls row: −10s · Skip · +10s */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 }}>
                  <TouchableOpacity
                    style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => adjustRest(activeRestKey, -10)}
                    hitSlop={6} activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.mid }}>−10s</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => { setRestEndTimes({}); setRestTimers({}); setShowBreakModal(false); }}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Skip Rest</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => adjustRest(activeRestKey, 10)}
                    hitSlop={6} activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.mid }}>+10s</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ── Manual mode: unchanged ManualBreakTimer component ── */
              <ManualBreakTimer C={C} t={theme} />
            )}
          </View>
        </View>
      </Modal>

      {/* Floating timer removed — auto-rest appears in the unified bottom sheet */}
      <Modal visible={showCompleteModal} transparent animationType="fade" onRequestClose={() => setShowCompleteModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '80%', maxWidth: 320 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.dark, marginBottom: 4 }}>Mark Workout Complete</Text>
            <Text style={{ fontSize: 13, color: C.mid, marginBottom: 16 }}>How many minutes did this workout take? (Optional)</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, textAlign: 'center', marginBottom: 16 }}
              keyboardType="number-pad"
              placeholder="e.g. 45 (leave empty to use elapsed)"
              value={completeMinutes}
              onChangeText={setCompleteMinutes}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F0F0F0', alignItems: 'center' }} onPress={() => setShowCompleteModal(false)}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: C.mid }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.green, alignItems: 'center' }} onPress={async () => {
                const mins = parseInt(completeMinutes, 10);
                const overrideSeconds = (Number.isFinite(mins) && mins > 0)
                  ? mins * 60
                  : Math.max(0, workoutTimer?.elapsed || 0);
                setShowCompleteModal(false);
                stopWorkoutTimer(overrideSeconds);
                if (gymOrTrainer && memberId) {
                  try {
                    const { doc: docFn, updateDoc: upDoc, getDoc: gdoc, collection: col, setDoc: sdoc } = require('firebase/firestore');
                    const { db: fdb } = require('./shared/firebase/config');
                    const assignRef = docFn(fdb, 'gyms', gymOrTrainer, 'assignments', memberId);
                    const assignSnap = await gdoc(assignRef).catch(() => null);
                    if (assignSnap?.exists() && assignSnap.data()?.planId) {
                      const planRef = docFn(fdb, 'gyms', gymOrTrainer, 'clientPlans', assignSnap.data().planId);
                      const planSnap = await gdoc(planRef).catch(() => null);
                      if (planSnap?.exists()) {
                        const todayIdx = loggingDayIdxRef.current ?? (new Date().getDay() + 6) % 7;
                        const days = (planSnap.data().days ?? []).map((d, i) =>
                          i === todayIdx
                            ? { ...d, completedAt: Date.now(), startedAt: d.startedAt ?? Date.now(), durationSeconds: overrideSeconds }
                            : d
                        );
                        await upDoc(planRef, { days }).catch(() => {});
                        loggingDayIdxRef.current = null;
                      }
                    }
                    const completionData = {
                      memberId, memberName,
                      gymId: member?.gymId || null,
                      planId: activeWorkout?.id || '',
                      planName: activeWorkout?.name || '',
                      dayLabel: activeWorkout?.dayLabel || '',
                      status: 'completed',
                      completedExercises: logExercises.map(ex => ({
                        exerciseId: ex.id, exerciseName: ex.name,
                        muscleGroup: ex.muscleGroup || 'Other',
                        targetSets: ex.sets, targetReps: ex.reps,
                        actualSets: getTotalSets(ex), actualReps: String(customReps[`${ex.id}_1`] || ex.reps),
                        weight: parseFloat(localSetWeights[`${ex.id}_1`] || lastWeights[`${ex.id}_1`] || '0'),
                        restSeconds: ex.rest || 60,
                        completed: !isSkipped(ex), skipped: isSkipped(ex),
                        notes: ex.note || '',
                        setDetails: isSkipped(ex) ? [] : Array.from({ length: getTotalSets(ex) }, (_, i) => ({
                          setNo: i + 1,
                          reps: parseInt(customReps[`${ex.id}_${i + 1}`] || ex.reps, 10),
                          weight: parseFloat(localSetWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
                        })),
                      })),
                      exerciseLogs: logExercises.map(ex => ({
                        exerciseId: ex.id, exerciseName: ex.name,
                        skipped: isSkipped(ex),
                        sets: isSkipped(ex) ? [] : Array.from({ length: getTotalSets(ex) }, (_, i) => ({
                          setNo: i + 1, reps: parseInt(customReps[`${ex.id}_${i + 1}`] || ex.reps, 10),
                          weight: parseFloat(localSetWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
                          done: !!workoutDoneSets[`${ex.id}_${i + 1}`],
                        })),
                      })),
                      durationSeconds: overrideSeconds,
                      startedAt: Date.now() - (overrideSeconds * 1000),
                      completedAt: Date.now(),
                      loggedAt: new Date().toISOString(),
                      updatedAt: Date.now(),
                      manualComplete: true,
                    };
                    if (activeLogRef.current) {
                      await upDoc(activeLogRef.current, completionData).catch(async () => {
                        const fb = docFn(col(fdb, 'gyms', gymOrTrainer, 'workoutLogs'));
                        await sdoc(fb, { id: fb.id, ...completionData });
                      });
                    } else {
                      const logRef = docFn(col(fdb, 'gyms', gymOrTrainer, 'workoutLogs'));
                      await sdoc(logRef, { id: logRef.id, ...completionData });
                    }
                    await upDoc(docFn(fdb, 'members', memberId), { lastWorkoutAt: Date.now() }).catch(() => {});
                  } catch (e) { console.log('Manual complete write error:', e); }
                }

                // Navigate to finish summary after all writes complete.
                // setIsLogging(false) prevents the logging UI from flashing
                // behind the WorkoutFinishScreen transition.
                setIsLogging(false);
                onWorkoutFinish?.(buildWorkoutFinishData({
                  dayLabel:        activeWorkout?.dayLabel || '',
                  planName:        activeWorkout?.name || '',
                  durationSeconds: overrideSeconds,
                  exercises:       logExercises,
                  actualResolver: (ex) => {
                    const n = getTotalSets(ex);
                    let bestW = 0;
                    for (let i = 1; i <= n; i++) {
                      const w = parseFloat(localSetWeights[`${ex.id}_${i}`] || '0');
                      if (w > 0) { bestW = w; break; }
                    }
                    if (bestW === 0) {
                      for (let i = 1; i <= n; i++) {
                        const w = parseFloat(lastWeights[`${ex.id}_${i}`] || '0');
                        if (w > 0) { bestW = w; break; }
                      }
                    }
                    let bestReps = ex.reps;
                    for (let i = 1; i <= n; i++) {
                      const r = customReps[`${ex.id}_${i}`];
                      if (r != null && r !== '') { bestReps = parseInt(r, 10) || ex.reps; break; }
                    }
                    return { actualSets: n, actualReps: bestReps, weight: bestW };
                  },
                }));
              }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ExerciseVideoModal visible={!!videoExName} exerciseName={videoExName?.name || videoExName} videoUrl={videoExName?.videoUrl} onClose={() => setVideoExName(null)} />

      {/* ── Last Session Modal ───────────────────────────────────────────────
          Opens when user taps "Last session" on an exercise card during logging.
          Shows per-set weight and reps from the previous workout session.      */}
      {lastSessionModal && (
        <Modal transparent animationType="slide" visible={!!lastSessionModal} onRequestClose={() => setLastSessionModal(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setLastSessionModal(null)}>
            <Pressable onPress={e => e.stopPropagation()}
              style={{ backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
              {/* Handle */}
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 }} />
              {/* Title */}
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.dark, marginBottom: 4, letterSpacing: -0.2 }}>{lastSessionModal.name}</Text>
              <Text style={{ fontSize: 12, color: C.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>Last Session</Text>
              {/* Header row */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 4, marginBottom: 8 }}>
                <Text style={{ width: 40, fontSize: 11, fontWeight: '700', color: C.muted }}>SET</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: C.muted, textAlign: 'center' }}>REPS</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: C.muted, textAlign: 'center' }}>WEIGHT</Text>
              </View>
              {/* Set rows */}
              {lastSessionModal.sets.map((s, i) => (
                <View key={s.setNo} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.light }}>
                  <View style={{ width: 40, height: 28, borderRadius: 8, backgroundColor: C.sunken, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.mid }}>{s.setNo}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: s.reps ? C.dark : C.muted, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                    {s.reps ?? '—'}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: s.weight ? C.primary : C.muted, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                    {s.weight ? `${s.weight} kg` : '—'}
                  </Text>
                </View>
              ))}
              {/* No data fallback */}
              {lastSessionModal.sets.every(s => !s.weight && !s.reps) && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ fontSize: 14, color: C.muted }}>No data from previous session</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setLastSessionModal(null)}
                style={{ marginTop: 20, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Got it</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Day Options Modal ────────────────────────────────────────────────
          Replaces: Alert.alert(`${dayName} Options`, ...) from handleDayLongPress.
          Shows on long-press of a day chip. Offers "Mark as Rest Day" /
          "Mark as Workout Day" and, when applicable, "Postpone Workout".
          Design: lv.modalBackdrop/Sheet pattern, warning-tinted postpone,
          danger-tinted rest-toggle, ghost cancel — all dark-mode aware.    */}
      <Modal
        visible={!!dayOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDayOptionsModal(null)}
      >
        <View style={wkModal.backdrop}>
          <View style={[wkModal.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
            {/* Header */}
            <View style={wkModal.titleRow}>
              <View style={wkModal.titleIcon}>
                <Ionicons name="calendar-outline" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[wkModal.title, { color: C.dark }]}>
                  {dayOptionsModal?.dayName}
                </Text>
                <Text style={[wkModal.sub, { color: C.mid }]}>
                  {dayOptionsModal?.isRest ? 'Currently a rest day' : 'Choose an action'}
                </Text>
              </View>
            </View>

            {/* Option buttons — full-width, vertically stacked */}
            <View style={wkModal.optionList}>
              {/* Toggle Rest Day / Workout Day */}
              <TouchableOpacity
                style={[wkModal.optionBtn, {
                  backgroundColor: dayOptionsModal?.isRest
                    ? (C._dark ? 'rgba(99,102,241,0.14)' : C.blue2)
                    : (C._dark ? 'rgba(244,63,94,0.12)' : C.redSoft || 'rgba(244,63,94,0.08)'),
                  borderColor: dayOptionsModal?.isRest ? C.primary + '40' : C.red + '40',
                }]}
                onPress={() => {
                  setDayOptionsModal(null);
                  handleToggleRestDay(dayOptionsModal.displayIdx);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={dayOptionsModal?.isRest ? 'barbell-outline' : 'moon-outline'}
                  size={18}
                  color={dayOptionsModal?.isRest ? C.primary : C.red}
                />
                <Text style={[wkModal.optionTxt, {
                  color: dayOptionsModal?.isRest ? C.primary : C.red,
                }]}>
                  {dayOptionsModal?.isRest ? 'Mark as Workout Day' : 'Mark as Rest Day'}
                </Text>
              </TouchableOpacity>

              {/* Postpone Workout — only when workout day with exercises */}
              {dayOptionsModal?.canPostpone && (
                <TouchableOpacity
                  style={[wkModal.optionBtn, {
                    backgroundColor: C._dark ? 'rgba(234,179,8,0.12)' : C.amberSoft || 'rgba(234,179,8,0.08)',
                    borderColor: C.amber + '40',
                  }]}
                  onPress={() => {
                    setDayOptionsModal(null);
                    handlePostpone(dayOptionsModal.dayIdx);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-forward-circle-outline" size={18} color={C.amber} />
                  <Text style={[wkModal.optionTxt, { color: C.amber }]}>
                    Postpone Workout
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Cancel — ghost button */}
            <TouchableOpacity
              style={[wkModal.cancelBtn, { backgroundColor: C.sunken, borderColor: C.border }]}
              onPress={() => setDayOptionsModal(null)}
              activeOpacity={0.75}
            >
              <Text style={[wkModal.cancelTxt, { color: C.mid }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Rest Day Assignment Modal ─────────────────────────────────────────
          Replaces: Alert.alert('Rest Day', `${restDayName} is a rest day...`)
          from the checkPath() function during postpone flow.
          Offers: "Assign to [Day]" (primary action) or "Skip — Rotate Cycle"
          (secondary ghost). Shows the specific date so user can decide.       */}
      <Modal
        visible={!!restAssignModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRestAssignModal(null)}
      >
        <View style={wkModal.backdrop}>
          <View style={[wkModal.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={wkModal.titleRow}>
              <View style={[wkModal.titleIcon, {
                backgroundColor: C._dark ? 'rgba(234,179,8,0.14)' : C.amberSoft || 'rgba(234,179,8,0.10)',
              }]}>
                <Ionicons name="moon-outline" size={20} color={C.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[wkModal.title, { color: C.dark }]}>Rest Day Conflict</Text>
                <Text style={[wkModal.sub, { color: C.mid }]}>
                  {restAssignModal?.restDayName}
                  {restAssignModal?.restDateLabel ? `, ${restAssignModal.restDateLabel}` : ''} is a rest day
                </Text>
              </View>
            </View>

            <Text style={[wkModal.bodyText, { color: C.mid }]}>
              Would you like to assign your postponed workout to this rest day, or skip it and rotate your weekly cycle instead?
            </Text>

            <View style={wkModal.optionList}>
              {/* Primary: assign to rest day */}
              <TouchableOpacity
                style={[wkModal.optionBtn, {
                  backgroundColor: C._dark ? 'rgba(99,102,241,0.14)' : C.blue2,
                  borderColor: C.primary + '40',
                }]}
                onPress={restAssignModal?.onAssign}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={C.primary} />
                <Text style={[wkModal.optionTxt, { color: C.primary }]}>
                  Assign to {restAssignModal?.restDayName}
                </Text>
              </TouchableOpacity>

              {/* Secondary: rotate cycle */}
              <TouchableOpacity
                style={[wkModal.optionBtn, { backgroundColor: C.sunken, borderColor: C.border }]}
                onPress={restAssignModal?.onSkip}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={18} color={C.mid} />
                <Text style={[wkModal.optionTxt, { color: C.mid }]}>
                  Skip — Rotate Cycle
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[wkModal.cancelBtn, { backgroundColor: C.sunken, borderColor: C.border }]}
              onPress={() => setRestAssignModal(null)}
              activeOpacity={0.75}
            >
              <Text style={[wkModal.cancelTxt, { color: C.mid }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Postpone Success Modal ────────────────────────────────────────────
          Replaces: Alert.alert('Workout Postponed ✓', '...')
          Clean confirmation with success-tinted icon and single dismiss CTA. */}
      <Modal
        visible={postponeSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPostponeSuccessModal(false)}
      >
        <View style={wkModal.backdrop}>
          <View style={[wkModal.sheet, { backgroundColor: C.card, borderColor: C.border, alignItems: 'center' }]}>
            <View style={[wkModal.successIcon, {
              backgroundColor: C._dark ? 'rgba(34,197,94,0.14)' : C.greenSoft || 'rgba(22,163,74,0.10)',
            }]}>
              <Ionicons name="checkmark-circle" size={36} color={C.green} />
            </View>
            <Text style={[wkModal.title, { color: C.dark, textAlign: 'center', marginTop: 16 }]}>
              Workout Postponed
            </Text>
            <Text style={[wkModal.bodyText, { color: C.mid, textAlign: 'center', marginTop: 8 }]}>
              Your weekly cycle has been rotated. The updated schedule takes effect from next week.
            </Text>
            <TouchableOpacity
              style={[wkModal.primaryBtn, { backgroundColor: C.green, borderColor: C.green, marginTop: 24 }]}
              onPress={() => setPostponeSuccessModal(false)}
              activeOpacity={0.85}
            >
              <Text style={wkModal.primaryBtnTxt}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WorkoutsScreen styles (wk) — restyled to match web admin design system.
//   All key names preserved for JSX compatibility. Changes:
//     • Exercise cards use web `.card` geometry (radius-xl, border-default, shadow-card).
//     • "Start Workout" = web .btn-primary (brand-600 + shadow-brand, 52 pt tall).
//     • "Postpone" = web .btn outline-warning (warning-tinted secondary).
//     • History chip = web .btn-secondary (brand-50 bg, brand-200 border).
//     • Week strip active day = brand-600 (matches web selected-state).
//     • Trainer notif = web .info-card-brand (brand-50 + brand-100 border).
// ═══════════════════════════════════════════════════════════════════════════════
const useWkStyles = makeStyles((t) => StyleSheet.create({
  /* ── Header ──────────────────────────────────────────────────── */
  headerRow:         { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 10, marginBottom: 4 },
  headerTitle:       { fontSize: t.fontSize['3xl'], fontWeight: '800', color: t.text.primary, letterSpacing: -0.5 },
  headerTitleLogging: { fontSize: t.fontSize.xl, fontWeight: '700', color: t.text.primary, letterSpacing: -0.3, flex: 1 },
  metaToggleBtn: { padding: 6, borderRadius: t.radius.sm },
  dayWorkoutTitle:   { fontSize: t.fontSize['3xl'], fontWeight: '800', color: t.text.primary, letterSpacing: -0.5, marginBottom: 10, lineHeight: 32 }, // ↓ 28→24, matches header
  headerSub:         { fontSize: t.fontSize.sm, color: t.text.secondary, marginTop: 6, lineHeight: 20, letterSpacing: 0 },

  /* Live timer pill — displays during active session */
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: t.surface.default,
    borderRadius: t.radius.full,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: t.border.default,
    ...t.shadow.card,
  },
  timerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.success[500] },
  timerVal: { fontSize: t.fontSize['2xl'], fontWeight: '800', color: t.text.primary, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },

  /* History button — web .btn-secondary */
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: t.radius.full,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.12)' : t.brand[50],
    borderWidth: 1.5, borderColor: t.brand[200],
  },
  historyTxt: { fontSize: 13, fontWeight: '700', color: t.brand[700], letterSpacing: -0.1 },

  /* ── Section labels ──────────────────────────────────────────── */
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: t.text.tertiary,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: t.spacing[7], marginBottom: t.spacing[4],
  },
  todayLabel: {
    fontSize: 12, fontWeight: '700', color: t.text.tertiary,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },

  /* ── Week day strip ──────────────────────────────────────────── */
  dayCard: {
    width: 48, paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: t.radius.lg,
    backgroundColor: t.surface.default,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1, borderColor: t.border.default,
    ...t.shadow.xs,
  },
  // Active day = web brand-600 selected state with branded shadow
  dayCardActive: {
    backgroundColor: t.brand[600],
    borderColor: t.brand[700],
    ...t.shadow.brand,
  },
  dayCardRest: { opacity: 0.45 },
  dayName:     { fontSize: 10, fontWeight: '700', color: t.text.tertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  dayDate:     { fontSize: 18, fontWeight: '800', color: t.text.primary, marginTop: 2, fontVariant: ['tabular-nums'] },
  weekTxtW:    { color: '#FFFFFF' },
  activeLine:  { width: 16, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.55)', marginTop: 5 },
  dayLabel:    { fontSize: 9, fontWeight: '600', color: t.text.primary, marginTop: 5, textAlign: 'center', lineHeight: 11, opacity: 0.7 },
  dayExPill:   { marginTop: 4, backgroundColor: t.neutral[100], borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 },
  dayExCount:  { fontSize: 9, fontWeight: '700', color: t.text.tertiary },

  /* ── Exercise cards (web .card) ──────────────────────────────── */
  exCardStatic: {
    backgroundColor: t.surface.default,
    borderRadius: t.radius.lg,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1, borderColor: t.border.default,
    ...t.shadow.card,
  },
  exCardDone:   { borderColor: 'rgba(22,163,74,0.28)', backgroundColor: 'rgba(22,163,74,0.04)' },
  exCardActive: { borderWidth: 1.5, borderColor: t.brand[500], ...t.shadow.raised },

  exCardTouch: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11, gap: 12,
    minHeight: 60,
  },
  // Legacy icon chip — kept for safety; ytChip is used in JSX now
  exIcon: {
    width: 40, height: 40, borderRadius: t.radius.md,
    backgroundColor: 'rgba(79,70,229,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  exIconDone: {
    backgroundColor: t.success[600],
    borderWidth: 1, borderColor: t.success[700],
    ...t.shadow.success,
  },

  // YouTube chip — replaces the seq-number/green-tick icon chip.
  // Transparent red tint background keeps the icon visible on dark cards
  // without being harsh. Touch target is 40×40 + hitSlop:6 = ~52px effective.
  // Icon sits directly on the card — no tinted square behind it
  ytChip: {
    width: 40, height: 40, borderRadius: t.radius.md,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },

  exName:     { fontSize: t.fontSize.base, fontWeight: '600', color: t.text.primary, letterSpacing: -0.2 },  // ↓ xl(18)→base(14) matches lv.exName
  exNameDone: { color: t.neutral[400], textDecorationLine: 'line-through', textDecorationColor: t.neutral[300] },
  exMeta:     { fontSize: t.fontSize.xs, color: t.text.secondary, marginTop: 4, letterSpacing: 0 },

  exExpandedContent: { paddingHorizontal: 18, paddingBottom: 16, paddingLeft: 82, gap: 8 },

  /* Muscle tag — web .tag-pill */
  exMusclePill: {
    backgroundColor: 'rgba(79,70,229,0.08)',
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  exMuscleText: { fontSize: 11, fontWeight: '700', color: t.brand[700], letterSpacing: 0.2 },
  exNoteText:   { fontSize: 12, color: t.text.secondary, fontStyle: 'italic', flex: 1, lineHeight: 18 },

  /* ── Overview card additions ────────────────────────────────────────────── */
  // Sequence number inside icon chip (01, 02…)
  exSeqNum: { fontSize: 14, fontWeight: '800', color: t.brand[t.mode === 'dark' ? 300 : 600], letterSpacing: -0.5 },
  // Bottom metadata row (muscle tag + last weight)
  exMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  exLastWeight: { fontSize: 11, fontWeight: '600', color: t.brand[t.mode === 'dark' ? 400 : 600] },
  // "DONE" pip — icon only, no text. Small green pill with a single checkmark.
  // Icon-only is cleaner: the green card tint + line-through name already
  // communicate completion without a noisy "DONE" label.
  exStatusDone:  { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(22,163,74,0.12)', alignItems: 'center', justifyContent: 'center' },
  // "READY" pip — neutral dot, almost invisible, just enough to fill the slot.
  exStatusReady: { width: 20, height: 20, borderRadius: 10, backgroundColor: t.surface.sunken, alignItems: 'center', justifyContent: 'center' },
  exStatusDot:   { width: 5, height: 5, borderRadius: 2.5, backgroundColor: t.border.strong },
  exStatusTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  /* ── Live chip ("in progress") — web status-pill-brand ───────── */
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(79,70,229,0.10)',
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.brand[600] },
  liveTxt: { fontSize: 11, fontWeight: '700', color: t.brand[700], letterSpacing: 0.2 },

  /* ── Primary / secondary action buttons ──────────────────────── */
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },

  // "Start Workout" = web .btn-primary (solid brand-600, 52 pt, brand shadow)
  startBtn: {
    backgroundColor: t.brand[600],
    borderWidth: 1, borderColor: t.brand[700],
    borderRadius: t.radius.md,              // 12 — web .btn radius
    paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 52,
    ...t.shadow.brand,
  },
  startBtnTxt: { color: '#fff', fontWeight: '700', fontSize: t.fontSize.md, letterSpacing: 0.1 },

  // "Postpone" = web outline-warning secondary
  postponeBtn: {
    borderWidth: 1.5, borderColor: 'rgba(234,179,8,0.45)',
    borderRadius: t.radius.md,
    paddingVertical: 14, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.warning[50],
    minHeight: 48,
  },
  postponeBtnTxt: { color: t.warning[700], fontWeight: '700', fontSize: t.fontSize.base },

  /* ── Sticky logging header (appears when scrolled past hero) ─── */
  /* heroHeader wrapper — color set inline from C.card / C.border */
  heroHeader: {
    borderBottomWidth: 1,
  },
  /* Keep stickyHeader for non-logging use (if ever restored) */
  stickyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: t.surface.default,
    borderBottomWidth: 1, borderBottomColor: t.border.default,
    ...t.shadow.raised,
  },
  stickyTitle: { fontSize: 11, fontWeight: '700', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 1.2 },
  stickyTimer: { fontSize: t.fontSize['2xl'], fontWeight: '800', marginTop: 2, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  stickyCount: { fontSize: 13, fontWeight: '700', color: t.brand[600] },
  pauseBtn:    { padding: 8, borderRadius: t.radius.sm },

  /* ── Trainer notification — web .info-card-brand ─────────────── */
  trainerNotif: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.12)' : t.brand[50],
    borderRadius: t.radius.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1, borderColor: t.brand[100],
  },
  trainerNotifIcon: {
    width: 40, height: 40, borderRadius: t.radius.md,
    backgroundColor: t.brand[600],
    alignItems: 'center', justifyContent: 'center',
    ...t.shadow.brand,
  },
  trainerNotifTitle: { fontSize: t.fontSize.md, fontWeight: '700', color: t.text.primary, letterSpacing: -0.1 },
  trainerNotifSub:   { fontSize: t.fontSize.xs, color: t.text.secondary, marginTop: 2 },

  /* ── Selected day header (viewing a non-today day) ───────────── */
  selectedDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  selectedDayTitle:  { fontSize: t.fontSize['2xl'], fontWeight: '800', color: t.text.primary, letterSpacing: -0.5 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: t.radius.full,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.12)' : t.brand[50],
    minHeight: 36,
  },
  backBtnTxt: { fontSize: 13, fontWeight: '700', color: t.brand[700] },
  // Completed badge — sits in the header row next to "Today", icon + tiny label
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: t.radius.full,
    backgroundColor: 'rgba(22,163,74,0.10)',
  },
  completedBadgeTxt: { fontSize: 12, fontWeight: '700', color: t.success[700] },
  exCountHint: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.text.secondary, marginBottom: 10 },

  /* ── Done chip — web status-pill-success ─────────────────────── */
  doneChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(22,163,74,0.10)',
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  doneTxt: { fontSize: 11, fontWeight: '700', color: t.success[700], letterSpacing: 0.2 },

  /* ── Completion card (replaces hero header when workout is done) ── */
  completionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: t.success[50],
    borderRadius: t.radius.xl,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: t.success[200],
  },
  completionCardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  completionIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.success[600], justifyContent: 'center', alignItems: 'center' },
  completionTitle:      { fontSize: 15, fontWeight: '800', color: t.success[800], letterSpacing: -0.2 },
  completionSub:        { fontSize: 12, color: t.success[700], marginTop: 2 },
  completionViewBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 8 },
  completionViewTxt:    { fontSize: 12, fontWeight: '700', color: t.success[700] },

  /* ── Empty states ────────────────────────────────────────────── */
  emptyState: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.10)' : t.brand[50],
    borderWidth: 1, borderColor: t.brand[100],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontSize: t.fontSize['2xl'], fontWeight: '800', color: t.text.primary, letterSpacing: -0.4 },
  emptySub:   { fontSize: t.fontSize.base, color: t.text.secondary, marginTop: 8, textAlign: 'center', lineHeight: 22 },

  // floatRest* styles removed — auto-rest uses the unified bottom sheet
}));

// ── wkModal — shared styles for the three custom day-action modals ────────────
// These modals replace the system Alert.alert sheets with a consistent design
// that matches the rest of the app: surface-default card, border-default edge,
// radius-2xl, shadow-modal, usePalette() colors for dark mode parity.
//
// Colour values use C.* (from usePalette() in WorkoutsScreen) so they switch
// automatically when the user toggles dark/light in the Profile screen.
// The stylesheet itself is plain (not makeStyles) because the colours are
// applied inline via C.* — the layout geometry is theme-independent.
const wkModal = StyleSheet.create({
  // Full-screen semi-transparent backdrop — same as lv.modalBackdrop
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  // Card shell — radius-2xl, shadow-modal, max 360 pt wide
  sheet: {
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    // Shadow applied inline via t.shadow.modal or C._theme.shadow.modal
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 16,
  },
  // Header row: coloured icon chip + title + subtitle
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
  },
  titleIcon: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.12)',  // overridden inline per-modal
  },
  // Success circle used in the postpone-confirmed modal
  successIcon: {
    width: 68, height: 68,
    borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Body paragraph (used in multi-line explanation)
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  // Vertical list of action options
  optionList: {
    gap: 8,
    marginBottom: 12,
  },
  // Single option row — icon + label, tinted by action type
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
  },
  optionTxt: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    flex: 1,
  },
  // Ghost cancel button — sits below the option list
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 44,
  },
  cancelTxt: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Success-modal primary CTA — matches .btn-success anatomy
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    width: '100%',
    minHeight: 50,
  },
  primaryBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.1,
  },
});

// ── PROGRESS SCREEN ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — Progress Photos Section
// Add to App.js:
//   1. Paste this block BEFORE the ProgressScreen function
//   2. Inside ProgressScreen, after the Measurements tab content,
//      add: <ProgressPhotosTab gymId={gymId} memberId={memberId} />
//   3. Add 'Photos' to the tabs array in ProgressScreen:
//      Change: {['Weight', 'Measurements'].map(...
//      To:     {['Weight', 'Measurements', 'Photos'].map(...
// ─────────────────────────────────────────────────────────────────────────────

function ProgressPhotosTab({ gymId, memberId }) {
  const [photos, setPhotos] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!gymId || !memberId) return;
    const q = query(
      collection(db, 'gyms', gymId, 'progressPhotos'),
      where('memberId', '==', memberId)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.takenAt || 0) - (a.takenAt || 0));
      setPhotos(list);
    });
    return () => unsub();
  }, [gymId, memberId]);

  const handleUpload = async () => {
    try {
      // Use expo-image-picker if available
      let ImagePicker;
      try { ImagePicker = require('expo-image-picker'); } catch { 
        Alert.alert('Not available', 'Run: npx expo install expo-image-picker');
        return;
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to upload progress photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (result.canceled) return;
      setUploading(true);

      // Upload to Firebase Storage
      const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
      const storage = getStorage();
      const uri = result.assets[0].uri;
      const photoRef = storageRef(storage, `progressPhotos/${memberId}/${Date.now()}.jpg`);
      const response = await fetch(uri);
      const blob = await response.blob();
      await uploadBytes(photoRef, blob);
      const photoUrl = await getDownloadURL(photoRef);

      // Save to Firestore
      const photoDocRef = doc(collection(db, 'gyms', gymId, 'progressPhotos'));
      await setDoc(photoDocRef, {
        id: photoDocRef.id,
        memberId,
        gymId,
        photoUrl,
        takenAt: Date.now(),
        sharedWithTrainer: true,
        note: '',
      });

      Alert.alert('Uploaded ✅', 'Your progress photo has been shared with your trainer.');
    } catch (e) {
      console.log('Photo upload error:', e);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally { setUploading(false); }
  };

  const formatDateShort = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View>
      <TouchableOpacity
        style={pp.uploadBtn}
        onPress={handleUpload}
        disabled={uploading}>
        {uploading
          ? <ActivityIndicator color={C.white} size="small" />
          : <Text style={pp.uploadBtnText}>📷 Upload Progress Photo</Text>}
      </TouchableOpacity>

      {photos.length === 0 ? (
        <View style={pp.empty}>
          <Text style={{ fontSize: 40 }}>📸</Text>
          <Text style={pp.emptyTitle}>No photos yet</Text>
          <Text style={pp.emptySub}>Upload your first progress photo above. Your trainer can view these.</Text>
        </View>
      ) : (
        <View style={pp.grid}>
          {photos.map(photo => (
            <View key={photo.id} style={pp.photoCard}>
              <Image
                source={{ uri: photo.photoUrl }}
                style={pp.photoImage}
                resizeMode="cover"
              />
              <Text style={pp.photoDate}>{formatDateShort(photo.takenAt)}</Text>
              {photo.trainerComment ? (
                <Text style={pp.trainerComment}>💬 {photo.trainerComment}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const pp = StyleSheet.create({
  uploadBtn: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.dark },
  emptySub: { fontSize: 13, color: C.mid, textAlign: 'center', lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '47%', backgroundColor: C.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.light },
  photoImage: { width: '100%', height: 180 },
  photoDate: { fontSize: 11, color: C.mid, padding: 8, fontWeight: '500' },
  trainerComment: { fontSize: 11, color: C.primary, paddingHorizontal: 8, paddingBottom: 8 },
});

// ── MeasurementLogger — lets member log body measurements ────────────────────
function MeasurementLogger({ member, gymId, memberId, measurements }) {
  const C  = usePalette();
  const ml = useMlStyles();
  const TYPES = ['Chest', 'Waist', 'Hips', 'Bicep', 'Thigh', 'Shoulder', 'Calf'];
  const [editing,  setEditing]  = React.useState(null);
  const [inputVal, setInputVal] = React.useState('');
  const [saving,   setSaving]   = React.useState(false);

  const getLatest = (type) => {
    const entries = (measurements || []).filter(m => m.type === type);
    if (!entries.length) return null;
    return entries.sort((a, b) => (b.loggedAt || 0) - (a.loggedAt || 0))[0];
  };

  const handleSave = async (type) => {
    const val = parseFloat(inputVal);
    if (!val) { Alert.alert('Invalid', 'Enter a valid number'); return; }
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!ns || !memberId) { Alert.alert('Error', 'Cannot save. Try again.'); return; }
    setSaving(true);
    try {
      const ref = doc(collection(db, 'gyms', ns, 'measurements'));
      await setDoc(ref, { id: ref.id, memberId, gymId: gymId || null, type, value: val, loggedAt: Date.now() });
      setEditing(null);
      setInputVal('');
    } catch (e) {
      console.log('Measurement save error:', e);
      Alert.alert('Save Error', (e && e.message) || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <View style={ml.container}>
      {TYPES.map(type => {
        const latest    = getLatest(type);
        const isEditing = editing === type;
        return (
          <View key={type} style={[ml.row, isEditing && ml.rowActive]}>
            <View style={ml.rowHeader}>
              <Text style={ml.typeName}>{type}</Text>
              <View style={ml.rowRight}>
                {latest && <Text style={ml.latestVal}>{latest.value} cm</Text>}
                <TouchableOpacity
                  style={[ml.actionChip, isEditing && ml.actionChipCancel]}
                  onPress={() => { setEditing(isEditing ? null : type); setInputVal(''); }}>
                  <Text style={[ml.actionChipTxt, isEditing && ml.actionChipCancelTxt]}>
                    {isEditing ? 'Cancel' : latest ? 'Update' : '+ Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {!latest && !isEditing && <Text style={ml.notLogged}>Not logged yet</Text>}
            {isEditing && (
              <View style={ml.inputRow}>
                <TextInput
                  style={ml.input}
                  placeholder={'Enter ' + type + ' in cm'}
                  placeholderTextColor={C.muted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  value={inputVal}
                  onChangeText={setInputVal}
                  autoFocus
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[ml.saveBtn, (!inputVal || saving) && ml.saveBtnOff]}
                  onPress={() => handleSave(type)}
                  disabled={!inputVal || saving}>
                  <Text style={ml.saveBtnTxt}>{saving ? '…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const useMlStyles = makeStyles((t) => StyleSheet.create({
  container:          { marginTop: 8 },
  row:                { backgroundColor: t.surface.default, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: t.border.default },
  rowActive:          { borderColor: t.brand[500] },
  rowHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeName:           { fontSize: 15, fontWeight: '700', color: t.text.primary },
  rowRight:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  latestVal:          { fontSize: 14, fontWeight: '700', color: t.brand[600] },
  actionChip:         { backgroundColor: t.brand[50], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: t.brand[200] },
  actionChipCancel:   { backgroundColor: t.surface.sunken, borderColor: t.border.default },
  actionChipTxt:      { fontSize: 12, fontWeight: '600', color: t.brand[600] },
  actionChipCancelTxt:{ color: t.text.secondary },
  notLogged:          { fontSize: 12, color: t.text.tertiary, marginTop: 4 },
  inputRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  input:              { flex: 1, backgroundColor: t.surface.sunken, borderRadius: 10, padding: 12, fontSize: 16, color: t.text.primary, borderWidth: 1.5, borderColor: t.brand[500] },
  saveBtn:            { backgroundColor: t.brand[600], borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  saveBtnOff:         { opacity: 0.45 },
  saveBtnTxt:         { color: '#fff', fontWeight: '700', fontSize: 14 },
}));

// ─── BMI Zone Chart (Weight tab) ─────────────────────────────────────────────
// Matches the trainer app's WeightBMIScreen chart exactly.
// weightLog entries: { weight, loggedAt }  (from subscribeToWeightLog)
// memberHeight: cm (from member.height)
function MemberBMIZoneChart({ weightLog, memberHeight }) {
  const C = usePalette();
  const t = C._theme;

  // ── Layout ────────────────────────────────────────────────────────────────
  const [chartW, setChartW] = useState(0);
  const CHART_H  = 220;
  const PADDING_L = 30;  // reduced 40→30: gains 10 px of plot width
  const TT_W     = 140; // tooltip width

  // ── Interaction state ─────────────────────────────────────────────────────
  // selectedIdx: which data point is highlighted (null = none)
  const [selectedIdx, setSelectedIdx] = useState(null);
  const dismissTimer = useRef(null);   // auto-dismiss after 3 s of no touch
  const pointsRef    = useRef([]);     // always holds the latest computed points

  // ── BMI palette ───────────────────────────────────────────────────────────
  const BMI_COLORS = { uw: '#3B82F6', normal: '#10B981', ow: '#F59E0B', obese: '#EF4444' };
  const getDotColor  = (bmi) =>
    bmi < 18.5 ? BMI_COLORS.uw : bmi < 25 ? BMI_COLORS.normal : bmi < 30 ? BMI_COLORS.ow : BMI_COLORS.obese;
  const getZoneName  = (bmi) =>
    bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';

  // ── PanResponder — stable ref, reads from pointsRef each gesture ──────────
  // Created once so the chart view never remounts due to a changed handler ref.
  const pan = useRef(
    PanResponder.create({
      // Capture the touch immediately so it doesn't scroll the parent ScrollView
      onStartShouldSetPanResponder: () => pointsRef.current.length > 0,
      onMoveShouldSetPanResponder:  () => pointsRef.current.length > 0,

      onPanResponderGrant: (e) => {
        clearTimeout(dismissTimer.current);
        const tx  = e.nativeEvent.locationX;
        const pts = pointsRef.current;
        const idx = pts.reduce(
          (best, p, i) => Math.abs(p.x - tx) < Math.abs(pts[best].x - tx) ? i : best, 0,
        );
        setSelectedIdx(idx);
      },

      onPanResponderMove: (e) => {
        clearTimeout(dismissTimer.current);
        const tx  = e.nativeEvent.locationX;
        const pts = pointsRef.current;
        const idx = pts.reduce(
          (best, p, i) => Math.abs(p.x - tx) < Math.abs(pts[best].x - tx) ? i : best, 0,
        );
        setSelectedIdx(idx);
      },

      // Auto-dismiss selection 3 s after finger lifts
      onPanResponderRelease: () => {
        dismissTimer.current = setTimeout(() => setSelectedIdx(null), 3000);
      },
    }),
  ).current;

  // ── Guard — hooks above, early return below ───────────────────────────────
  if (!memberHeight || memberHeight <= 0 || weightLog.length === 0) return null;

  const heightM = memberHeight / 100;

  // Newest-first log → take last 12 → reverse to oldest-left
  const chartData = [...weightLog].slice(0, 12).reverse();
  const entries   = chartData.map(e => ({
    weight:    e.weight,
    loggedAt:  e.loggedAt,
    bmi:       parseFloat((e.weight / (heightM * heightM)).toFixed(1)),
  }));

  const thresholds = {
    uw:   18.5 * heightM * heightM,
    norm: 24.9 * heightM * heightM,
    ow:   29.9 * heightM * heightM,
  };

  const weights = entries.map(e => e.weight);
  const allW    = [...weights, thresholds.uw - 3, thresholds.ow + 3];
  const minW    = Math.max(0, Math.floor(Math.min(...allW) - 1));
  const maxW    = Math.ceil(Math.max(...allW) + 1);
  const range   = maxW - minW || 1;
  const innerW  = Math.max(0, chartW - PADDING_L);

  const toY   = (w) => CHART_H * (1 - (w - minW) / range);
  const toX   = (i) => PADDING_L + (entries.length > 1 ? (i / (entries.length - 1)) * innerW : innerW / 2);
  const clamp = (v) => Math.max(0, Math.min(CHART_H, v));

  const points = entries.map((e, i) => ({
    x: toX(i), y: clamp(toY(e.weight)),
    bmi: e.bmi, weight: e.weight, loggedAt: e.loggedAt,
  }));

  // Keep ref in sync — used by PanResponder closures
  pointsRef.current = points;

  const counts = weightLog.reduce((acc, e) => {
    const b = e.weight / (heightM * heightM);
    if (b < 18.5)    acc.uw++;
    else if (b < 25) acc.normal++;
    else if (b < 30) acc.ow++;
    else             acc.obese++;
    return acc;
  }, { uw: 0, normal: 0, ow: 0, obese: 0 });

  const yOW   = clamp(toY(thresholds.ow));
  const yNorm = clamp(toY(thresholds.norm));
  const yUW   = clamp(toY(thresholds.uw));

  // ── Tooltip geometry ──────────────────────────────────────────────────────
  const sel      = selectedIdx !== null ? points[selectedIdx] : null;
  const selColor = sel ? getDotColor(sel.bmi) : null;
  const ttLeft   = sel
    ? Math.max(PADDING_L, Math.min(chartW - TT_W - 4, sel.x - TT_W / 2))
    : 0;
  // Show tooltip above dot when dot is in lower half of chart, otherwise below
  const ttTop    = sel
    ? (sel.y > CHART_H / 2 ? sel.y - 82 : sel.y + 16)
    : 0;

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 14, marginVertical: 12, elevation: 1 }}>

      {/* Header */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.dark }}>⚖️ Weight Progress</Text>
      <Text style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>
        {weightLog.length > 12
          ? `Showing last 12 of ${weightLog.length} entries · tap a point`
          : `${weightLog.length} ${weightLog.length === 1 ? 'entry' : 'entries'} · tap a point`}
      </Text>

      {/* ── Chart canvas ─────────────────────────────────────────────────── */}
      <View
        style={{ height: CHART_H, marginTop: 12 }}
        onLayout={ev => setChartW(ev.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        {chartW > 0 && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: CHART_H }}>

            {/* Zone background bands */}
            <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: 0,    height: yOW,                         backgroundColor: 'rgba(239,68,68,0.09)' }} />
            <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yOW,  height: Math.max(0, yNorm - yOW),    backgroundColor: 'rgba(245,158,11,0.09)' }} />
            <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yNorm, height: Math.max(0, yUW - yNorm),   backgroundColor: 'rgba(16,185,129,0.09)' }} />
            <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yUW,  height: Math.max(0, CHART_H - yUW),  backgroundColor: 'rgba(59,130,246,0.09)' }} />

            {/* BMI threshold dashed lines + axis labels */}
            {[
              { y: yUW,   w: thresholds.uw,   color: BMI_COLORS.uw },
              { y: yNorm, w: thresholds.norm,  color: BMI_COLORS.ow },
              { y: yOW,   w: thresholds.ow,    color: BMI_COLORS.obese },
            ].map((item, i) => {
              if (item.y <= 4 || item.y >= CHART_H - 4) return null;
              return (
                <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: item.y }}>
                  <Text style={{ position: 'absolute', left: 0, top: -8, fontSize: 8, color: item.color, fontWeight: '600', width: PADDING_L - 2, textAlign: 'right' }}>
                    {Math.round(item.w)}
                  </Text>
                  <View style={{ position: 'absolute', left: PADDING_L, right: 0, height: 1, backgroundColor: item.color, opacity: 0.25 }} />
                </View>
              );
            })}

            {/* Y-axis grid lines */}
            {[minW, Math.round((minW + maxW) / 2), maxW].map((w, i) => {
              const y = clamp(toY(w));
              return (
                <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: y }}>
                  <Text style={{ position: 'absolute', left: 0, top: -7, fontSize: 8, color: t.text.tertiary, width: PADDING_L - 4, textAlign: 'right' }}>{w}</Text>
                  <View style={{ position: 'absolute', left: PADDING_L, right: 0, height: 1, backgroundColor: t.border.subtle }} />
                </View>
              );
            })}

            {/* Y-axis spine */}
            <View style={{ position: 'absolute', left: PADDING_L - 1, top: 0, width: 1, height: CHART_H, backgroundColor: t.border.default }} />

            {/* Vertical crosshair on selected point */}
            {sel && (
              <View style={{
                position: 'absolute',
                left: sel.x - 0.5, top: 0,
                width: 1, height: CHART_H,
                backgroundColor: selColor,
                opacity: 0.35,
                zIndex: 5,
              }} />
            )}

            {/* Connecting line segments */}
            {points.slice(0, -1).map((p, i) => {
              const q      = points[i + 1];
              const dx     = q.x - p.x;
              const dy     = q.y - p.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle  = Math.atan2(dy, dx) * 180 / Math.PI;
              const cx     = (p.x + q.x) / 2;
              const cy     = (p.y + q.y) / 2;
              // Highlight segment touching selected point
              const isActive = selectedIdx !== null && (i === selectedIdx || i + 1 === selectedIdx);
              return (
                <View key={i} style={{
                  position: 'absolute',
                  left: cx - length / 2, top: cy - 1,
                  width: length, height: isActive ? 2.5 : 1.5,
                  backgroundColor: isActive
                    ? (selColor || t.brand[500])
                    : (t.mode === 'dark' ? t.neutral[600] : t.neutral[300]),
                  opacity: isActive ? 1 : 0.7,
                  transform: [{ rotate: `${angle}deg` }],
                  zIndex: isActive ? 8 : 3,
                }} />
              );
            })}

            {/* Data dots — selected dot grows and gets a ring */}
            {points.map((p, i) => {
              const isSelected = i === selectedIdx;
              const dotColor   = getDotColor(p.bmi);
              const size       = isSelected ? 14 : 9;
              const offset     = size / 2;
              return (
                <View key={i} style={{
                  position: 'absolute',
                  left: p.x - offset, top: p.y - offset,
                  width: size, height: size, borderRadius: size / 2,
                  backgroundColor: dotColor,
                  borderWidth: isSelected ? 2.5 : 1.5,
                  borderColor: isSelected ? t.surface.default : t.surface.default,
                  elevation: isSelected ? 6 : 2,
                  zIndex: isSelected ? 15 : 10,
                  // Outer glow ring on selected
                  ...(isSelected && {
                    shadowColor: dotColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.55,
                    shadowRadius: 5,
                  }),
                }} />
              );
            })}

            {/* ── Tooltip ─────────────────────────────────────────────────
                Appears above dot in lower half, below in upper half.
                Clamped horizontally so it never clips the card edge.      */}
            {sel && (
              <View style={{
                position: 'absolute',
                left: ttLeft, top: ttTop,
                width: TT_W,
                backgroundColor: t.surface.default,
                borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 9,
                borderWidth: 1.5, borderColor: selColor + '50',
                elevation: 8,
                shadowColor: selColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25, shadowRadius: 6,
                zIndex: 30,
              }}>
                {/* Weight — largest, in zone colour */}
                <Text style={{ fontSize: 18, fontWeight: '800', color: selColor, letterSpacing: -0.4, fontVariant: ['tabular-nums'] }}>
                  {sel.weight} kg
                </Text>
                {/* BMI + zone name */}
                <Text style={{ fontSize: 11, color: t.text.secondary, marginTop: 2, fontWeight: '600' }}>
                  BMI {sel.bmi} · {getZoneName(sel.bmi)}
                </Text>
                {/* Date */}
                <Text style={{ fontSize: 10, color: t.text.tertiary, marginTop: 2 }}>
                  {formatDate(sel.loggedAt)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* X-axis date labels */}
      {points.length > 0 && (
        <View style={{ flexDirection: 'row', marginLeft: PADDING_L, marginTop: 4 }}>
          <Text style={{ fontSize: 9, color: t.text.tertiary, flex: 1, textAlign: 'left' }}>
            {formatDate(points[0].loggedAt)}
          </Text>
          {points.length > 2 && (
            <Text style={{ fontSize: 9, color: t.text.tertiary, flex: 1, textAlign: 'center' }}>
              {formatDate(points[Math.floor(points.length / 2)].loggedAt)}
            </Text>
          )}
          <Text style={{ fontSize: 9, color: t.text.tertiary, flex: 1, textAlign: 'right' }}>
            {formatDate(points[points.length - 1].loggedAt)}
          </Text>
        </View>
      )}

      {/* Zone legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {[
          { color: BMI_COLORS.uw,     label: 'Underweight',  count: counts.uw },
          { color: BMI_COLORS.normal, label: 'Normal/Ideal', count: counts.normal },
          { color: BMI_COLORS.ow,     label: 'Overweight',   count: counts.ow },
          { color: BMI_COLORS.obese,  label: 'Obese',        count: counts.obese },
        ].map(({ color, label, count }) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: '45%', flex: 1 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
            <Text style={{ fontSize: 11, color: C.mid, flex: 1 }}>{label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color }}>{count}×</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ProgressScreen — redesigned to match the web admin dashboard.
//
//   Parity touchpoints (vs. lift-gym-app/src/index.css):
//   • Tab bar is a 1:1 port of web `.modal-tabs` / `.modal-tab` — sunken
//     container, radius-lg, active tab = surface white + brand-600 text +
//     shadow-card.
//   • Cards reuse web `.card` geometry via theme tokens (radius-xl, border
//     default, shadow.card).
//   • Chart containers use `.surface-card` look with a section header pattern
//     matching web dashboard panels.
//   • Stats at the top of the Workouts tab use the same `QuickStat` anatomy
//     as the Home screen so the product reads as one system.
//   • Bar-chart bars tinted brand-600 (indigo), with a track line at the
//     chart baseline — matches web `.stat-card` internal chart tone.
//   • Goal-progress bar uses success-tinted fill inside a brand-tinted info
//     panel (web `.info-card-brand`).
//   • Weight input bar uses web `.input-base` focus ring (brand-500 glow) +
//     web `.btn-primary` anatomy for the Log button.
// ═══════════════════════════════════════════════════════════════════════════════
const PROGRESS_TABS = [
  { key: 'Weight',       label: 'Weight'       },
  { key: 'Measurements', label: 'Measurements' },
  { key: 'Photos',       label: 'Photos'       },
  { key: 'Workouts',     label: 'Workouts'     },
];

function ProgressScreen({ member, gymId, memberId }) {
  const C = usePalette();
  const { theme } = useTheme();
  const g = useGlobalStyles();
  const pr = usePrStyles();
  const [activeTab, setActiveTab] = useState('Weight');
  const [weightLog, setWeightLog] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [workoutLogs, setWorkoutLogs] = useState([]);

  const { scrollRef: progressScrollRef, kbPadding: progressKbPad, scrollToInput: progressScrollToInput, onScroll: progressOnScroll } = useKeyboardScroll();
  const weightInputRef = useRef(null);

  useEffect(() => {
    // Fix: use gymId OR trainerId as namespace for freelance members
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!ns || !memberId) return;
    const unsub1 = subscribeToWeightLog(ns, memberId, setWeightLog);
    const unsub2 = subscribeToMeasurements(ns, memberId, setMeasurements);
    return () => { unsub1(); unsub2(); };
  }, [gymId, memberId, member?.trainerId]);

  useEffect(() => {
    if (!memberId) return;
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!ns) return;
    const q = query(
      collection(db, 'gyms', ns, 'workoutLogs'),
      where('memberId', '==', memberId),
    );
    const unsub = onSnapshot(q, snap => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
      setWorkoutLogs(logs);
    }, () => {});
    return () => unsub();
  }, [memberId, gymId, member?.trainerId]);

  const handleLogWeight = async () => {
    const val = parseFloat(weightInput);
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!val || !ns || !memberId) { Alert.alert('Error', 'Could not save. Try again.'); return; }
    setSaving(true);
    try {
      const logRef = doc(collection(db, 'gyms', ns, 'weightLogs'));
      await setDoc(logRef, {
        id: logRef.id,
        memberId,
        gymId: gymId || null,
        weight: val,
        height: member?.height || 0,
        loggedAt: Date.now(),
      });
      await updateDoc(doc(db, 'members', memberId), { weight: val, updatedAt: Date.now() }).catch(() => {});
      setWeightInput('');
    } catch (e) {
      console.log('Weight log error:', e);
      Alert.alert('Save Error', (e && e.message) || 'Failed to save weight. Please try again.');
    } finally { setSaving(false); }
  };

  const bmi = member && member.height > 0
    ? (member.weight / ((member.height / 100) ** 2)).toFixed(1)
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView
      ref={progressScrollRef}
      style={g.screen}
      contentContainerStyle={{ paddingBottom: progressKbPad }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={progressOnScroll}
      scrollEventThrottle={16}>
      <Text style={pr.pageTitle}>Progress</Text>
      <Text style={pr.pageSub}>Track your body, workouts and photos — stay on the wave.</Text>

      {/* ─── Tab bar — ported from web `.modal-tabs` ─────────────────── */}
      <View style={pr.tabs}>
        {PROGRESS_TABS.map(t => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[pr.tab, isActive && pr.tabActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.85}
            >
              <Text style={[pr.tabTxt, isActive && pr.tabTxtActive]} numberOfLines={1}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── WEIGHT TAB ──────────────────────────────────────────────── */}
      {activeTab === 'Weight' && (
        <>
          {bmi && (() => {
            const bmiNum = parseFloat(bmi);
            // Semantic BMI colors match web: info / success / warning / danger
            const bmiColor = bmiNum < 18.5 ? theme.info[500]
                           : bmiNum < 25   ? theme.success[600]
                           : bmiNum < 30   ? theme.warning[600]
                           :                 theme.danger[600];
            const bmiCat   = bmiNum < 18.5 ? 'Underweight'
                           : bmiNum < 25   ? 'Normal'
                           : bmiNum < 30   ? 'Overweight'
                           :                 'Obese';
            return (
              <View style={pr.bmiCard}>
                {/* Left — current BMI with semantic tag */}
                <View style={{ flex: 1 }}>
                  <Text style={pr.cardLabel}>Current BMI</Text>
                  <Text style={[pr.bmiVal, { color: bmiColor }]}>{bmi}</Text>
                  <View style={[pr.bmiTag, { backgroundColor: bmiColor + '1A', borderColor: bmiColor + '33' }]}>
                    <View style={[pr.bmiTagDot, { backgroundColor: bmiColor }]} />
                    <Text style={[pr.bmiTagTxt, { color: bmiColor }]}>{bmiCat}</Text>
                  </View>
                </View>
                {/* Right — weight + goal */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={pr.cardLabel}>Current weight</Text>
                  <Text style={pr.weightBig}>
                    {member.weight}<Text style={pr.weightUnit}> kg</Text>
                  </Text>
                  {member.goalWeight ? (
                    <View style={pr.goalChip}>
                      <Ionicons name="flag-outline" size={11} color={theme.text.secondary} />
                      <Text style={pr.goalChipTxt}>Goal {member.goalWeight} kg</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })()}

          {/* Weight chart — inside a surface-card panel with section header */}
          {weightLog.length > 0 && (
            <View style={pr.chartPanel}>
              <View style={pr.panelHeader}>
                <Text style={pr.panelTitle}>Weight Trend</Text>
                <Text style={pr.panelSub}>Last {Math.min(12, weightLog.length)} entries · BMI zones</Text>
              </View>
              <MemberBMIZoneChart weightLog={weightLog} memberHeight={member?.height || 0} />
            </View>
          )}

          {/* Goal progress — web `.info-card-brand` tint */}
          {(() => {
            const cw = member?.weight;
            const gw = member?.goalWeight;
            const sw = weightLog.length > 0 ? weightLog[weightLog.length - 1]?.weight : cw;
            if (!cw || !gw || !sw || gw >= sw) return null;
            const total = sw - gw;
            const done = sw - cw;
            const pct = Math.min(100, Math.max(0, (done / total) * 100));
            return (
              <View style={pr.goalPanel}>
                <View style={pr.goalHeader}>
                  <View>
                    <Text style={pr.cardLabel}>Goal Progress</Text>
                    <Text style={pr.goalPanelTitle}>
                      {Math.max(0, cw - gw).toFixed(1)} kg to goal
                    </Text>
                  </View>
                  <View style={pr.goalPctBadge}>
                    <Text style={pr.goalPctTxt}>{pct.toFixed(0)}%</Text>
                  </View>
                </View>
                <View style={pr.goalBarBg}>
                  <View style={[pr.goalBarFill, { width: `${pct}%` }]} />
                </View>
                <View style={pr.goalFooter}>
                  <Text style={pr.goalFooterTxt}>Start · {sw} kg</Text>
                  <Text style={pr.goalFooterTxt}>Goal · {gw} kg</Text>
                </View>
              </View>
            );
          })()}

          {/* Log weight row — web `.input-base` + `.btn-primary` */}
          <Text style={pr.sectionLabel}>LOG TODAY'S WEIGHT</Text>
          <View style={pr.logRow}>
            <View style={pr.logInputWrap}>
              <Ionicons name="scale-outline" size={18} color={theme.text.tertiary} />
              <TextInput
                ref={weightInputRef}
                style={pr.logInput}
                placeholder="Enter weight"
                placeholderTextColor={C.muted}
                keyboardType="decimal-pad"
                returnKeyType="done"
                blurOnSubmit={true}
                autoCorrect={false}
                value={weightInput}
                onChangeText={setWeightInput}
                onFocus={() => progressScrollToInput(weightInputRef)}
              />
              <Text style={pr.logUnit}>kg</Text>
            </View>
            <TouchableOpacity
              style={[pr.logBtn, (!weightInput || saving) && pr.logBtnOff]}
              onPress={handleLogWeight}
              disabled={!weightInput || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="add" size={24} color="#fff" />
              }
            </TouchableOpacity>
          </View>

          {weightLog.length === 0 && (
            <View style={pr.emptyState}>
              <View style={pr.emptyIconCircle}>
                <Ionicons name="trending-up" size={22} color={theme.brand[600]} />
              </View>
              <Text style={pr.emptyTitle}>Start tracking</Text>
              <Text style={pr.emptySub}>Log your first weight to see your trend and goal progress appear here.</Text>
            </View>
          )}
        </>
      )}

      {/* ─── MEASUREMENTS TAB ───────────────────────────────────────── */}
      {activeTab === 'Measurements' && (
        <MeasurementLogger
          member={member}
          gymId={gymId || (member && (member.trainerId || member.id))}
          memberId={memberId}
          measurements={measurements}
        />
      )}

      {/* ─── PHOTOS TAB ─────────────────────────────────────────────── */}
      {activeTab === 'Photos' && (
        <ProgressPhotosTab gymId={gymId} memberId={memberId} />
      )}

      {/* ─── WORKOUTS TAB ───────────────────────────────────────────── */}
      {activeTab === 'Workouts' && (() => {
        const now = Date.now();
        const completedWorkouts = workoutLogs.filter(w => w.completedAt && w.completedAt > 0 && w.completedAt <= now);
        const recent = completedWorkouts.slice(0, 10);
        const totalMins = Math.round(completedWorkouts.reduce((s, w) => s + (w.durationSeconds || 0), 0) / 60);
        const avgMins = completedWorkouts.length
          ? Math.round(completedWorkouts.reduce((s, w) => s + (w.durationSeconds || 0), 0) / completedWorkouts.length / 60)
          : 0;
        const sessionCount = completedWorkouts.length;
        const maxSecs = Math.max(...recent.map(w => w.durationSeconds || 0), 1);

        // 4-week consistency rows — pre-compute so we can reference in header
        const weeks = [3, 2, 1, 0].map(ago => {
          const end   = now - ago * 7 * 24 * 3600 * 1000;
          const start = end - 7 * 24 * 3600 * 1000;
          const count = completedWorkouts.filter(w => (w.completedAt ?? 0) >= start && (w.completedAt ?? 0) < end).length;
          return { label: ago === 0 ? 'This week' : `${ago}w ago`, count, current: ago === 0 };
        });
        const maxC = Math.max(...weeks.map(w => w.count), 1);
        const thisWeekCount = weeks[weeks.length - 1].count;

        return (
          <View>
            {/* Three stat cards — same anatomy as Home QuickStat */}
            <View style={pr.statGrid}>
              <ProgressStatCard
                icon="time-outline" tone="brand"
                value={totalMins} unit="min" label="Total time"
              />
              <ProgressStatCard
                icon="trophy-outline" tone="success"
                value={sessionCount} unit={sessionCount === 1 ? 'session' : 'sessions'} label="Completed"
              />
              <ProgressStatCard
                icon="pulse-outline" tone="warning"
                value={avgMins} unit="min" label="Avg / session"
              />
            </View>

            {/* 4-week consistency — branded bars in surface-card */}
            <View style={pr.chartPanel}>
              <View style={pr.panelHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={pr.panelTitle}>4-Week Consistency</Text>
                  <Text style={pr.panelSub}>{thisWeekCount} session{thisWeekCount === 1 ? '' : 's'} this week</Text>
                </View>
                {thisWeekCount > 0 ? (
                  <View style={pr.streakBadge}>
                    <Ionicons name="flame" size={12} color={theme.warning[600]} />
                    <Text style={pr.streakBadgeTxt}>On pace</Text>
                  </View>
                ) : null}
              </View>
              <View style={pr.consistRow}>
                {weeks.map((w, i) => {
                  const barH = Math.max(6, (w.count / maxC) * 72);
                  return (
                    <View key={i} style={pr.consistCol}>
                      <Text style={pr.consistVal}>{w.count}</Text>
                      <View style={pr.consistBarTrack}>
                        <View style={[pr.consistBarFill, {
                          height: barH,
                          backgroundColor: w.current ? theme.brand[600] : theme.brand[200],
                        }]} />
                      </View>
                      <Text style={[pr.consistLbl, w.current && pr.consistLblCurrent]}>{w.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {recent.length === 0 ? (
              <View style={pr.emptyState}>
                <View style={pr.emptyIconCircle}>
                  <Ionicons name="barbell-outline" size={22} color={theme.brand[600]} />
                </View>
                <Text style={pr.emptyTitle}>No sessions yet</Text>
                <Text style={pr.emptySub}>Complete a workout to see your time trends and session history here.</Text>
              </View>
            ) : (
              <>
                {/* Recent-sessions bar chart */}
                <View style={[pr.chartPanel, { paddingBottom: 20 }]}>
                  <View style={pr.panelHeader}>
                    <Text style={pr.panelTitle}>Session Duration</Text>
                    <Text style={pr.panelSub}>Last {Math.min(7, recent.length)} workouts</Text>
                  </View>
                  <View style={pr.barChartRow}>
                    {recent.slice(0, 7).reverse().map((w, i) => {
                      const mins = Math.round((w.durationSeconds || 0) / 60);
                      const barH = Math.max(8, Math.round(((w.durationSeconds || 0) / maxSecs) * 110));
                      return (
                        <View key={w.id || i} style={pr.barCol}>
                          <Text style={pr.barVal}>{mins}m</Text>
                          <View style={pr.barTrack}>
                            <View style={[pr.barFill, { height: barH }]} />
                          </View>
                          <Text style={pr.barDate} numberOfLines={1}>
                            {w.completedAt ? new Date(w.completedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Recent sessions list */}
                <View style={pr.sectionHeader}>
                  <Text style={pr.sectionLabel}>RECENT SESSIONS</Text>
                  <Text style={pr.sectionCount}>{recent.length} shown</Text>
                </View>
                <View style={pr.sessionList}>
                  {recent.map((w, i) => {
                    const mins = Math.round((w.durationSeconds || 0) / 60);
                    const dateTxt = w.completedAt
                      ? new Date(w.completedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';
                    return (
                      <View key={w.id || i} style={[pr.sessionRow, i > 0 && pr.sessionRowDivider]}>
                        <View style={pr.sessionIcon}>
                          <Ionicons name="checkmark" size={16} color={theme.success[700]} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={pr.sessionTitle} numberOfLines={1}>
                            {w.workoutName || 'Workout'}
                          </Text>
                          <Text style={pr.sessionSub}>{dateTxt}</Text>
                        </View>
                        <View style={pr.sessionMetric}>
                          <Text style={pr.sessionMetricVal}>{mins}</Text>
                          <Text style={pr.sessionMetricUnit}>min</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        );
      })()}
      <View style={{ height: 40 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── ProgressStatCard ─────────────────────────────────────────────────────────
// Reuses the anatomy of Home's QuickStat so the mobile app reads as one
// system across screens.
function ProgressStatCard({ icon, tone = 'brand', value, unit, label }) {
  const pr = usePrStyles();
  const tones = {
    brand:   { icon: theme.brand[600],   chip: 'rgba(79,70,229,0.10)' },
    success: { icon: theme.success[600], chip: 'rgba(22,163,74,0.10)' },
    warning: { icon: theme.warning[600], chip: 'rgba(217,119,6,0.12)' },
  }[tone];
  return (
    <View style={pr.statCard}>
      <View style={[pr.statIconChip, { backgroundColor: tones.chip }]}>
        <Ionicons name={icon} size={15} color={tones.icon} />
      </View>
      <View style={pr.statValueRow}>
        <Text style={pr.statValue} numberOfLines={1}>{value}</Text>
        {unit ? <Text style={pr.statUnit} numberOfLines={1}>{unit}</Text> : null}
      </View>
      <Text style={pr.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const usePrStyles = makeStyles((t) => StyleSheet.create({
  /* ── Page header ──────────────────────────────────────────────────── */
  pageTitle: {
    fontSize: t.fontSize['3xl'],
    fontWeight: '800',
    color: t.text.primary,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  pageSub: {
    fontSize: t.fontSize.sm,
    color: t.text.secondary,
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 20,
  },

  /* ── Tabs — ported from web .modal-tabs (line 1364, src/index.css) ── */
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: t.radius.lg,           // 14 — matches web .modal-tabs
    backgroundColor: t.surface.sunken,   // sunken container
    borderWidth: 1, borderColor: t.border.default,
    marginBottom: 22,
  },
  tab: {
    flex: 1,
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: t.radius.md,           // 12 — matches web .modal-tab
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  tabActive: {
    backgroundColor: t.surface.default,  // white on sunken track
    ...t.shadow.card,                    // shadow-card lift
  },
  tabTxt:       { fontSize: 13, fontWeight: '600', color: t.text.secondary, letterSpacing: -0.1 },
  tabTxtActive: { color: t.brand[600] },

  /* ── Generic card label (UPPERCASE, tracked) ──────────────────────── */
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: t.text.tertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  /* ── BMI + weight card ────────────────────────────────────────────── */
  bmiCard: {
    backgroundColor: t.surface.default,
    borderRadius: t.radius.xl,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderWidth: 1, borderColor: t.border.default,
    marginBottom: 16,
    ...t.shadow.card,
  },
  bmiVal:     { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'], marginTop: 2 },
  bmiTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  bmiTagDot:  { width: 5, height: 5, borderRadius: 3 },
  bmiTagTxt:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  weightBig:  { fontSize: 28, fontWeight: '800', color: t.text.primary, letterSpacing: -0.6, fontVariant: ['tabular-nums'], marginTop: 2 },
  weightUnit: { fontSize: 14, fontWeight: '600', color: t.text.tertiary },
  goalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: t.surface.sunken,
    borderRadius: t.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    marginTop: 8,
  },
  goalChipTxt: { fontSize: 11, fontWeight: '600', color: t.text.secondary, letterSpacing: -0.1 },

  /* ── Chart / surface panel (wraps chart components) ───────────────── */
  chartPanel: {
    backgroundColor: t.surface.default,
    borderRadius: t.radius.xl,
    padding: 18,
    borderWidth: 1, borderColor: t.border.default,
    marginBottom: 16,
    ...t.shadow.card,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  panelTitle: { fontSize: t.fontSize.md, fontWeight: '700', color: t.text.primary, letterSpacing: -0.2 },
  panelSub:   { fontSize: 11, color: t.text.tertiary, marginTop: 2, letterSpacing: 0.1 },

  /* ── Goal-progress panel — web .info-card-brand ───────────────────── */
  goalPanel: {
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.12)' : t.brand[50],
    borderWidth: 1, borderColor: t.brand[100],
    borderRadius: t.radius.xl,
    padding: 16,
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  goalPanelTitle: { fontSize: t.fontSize.md, fontWeight: '700', color: t.text.primary, marginTop: 2, letterSpacing: -0.2 },
  goalPctBadge: {
    backgroundColor: t.success[600],
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    ...t.shadow.success,
  },
  goalPctTxt: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.1, fontVariant: ['tabular-nums'] },
  goalBarBg: {
    height: 10,
    backgroundColor: t.surface.default,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1, borderColor: t.brand[100],
  },
  goalBarFill: {
    height: '100%',
    backgroundColor: t.success[600],
    borderRadius: 5,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  goalFooterTxt: { fontSize: 11, color: t.text.secondary, fontWeight: '600', letterSpacing: 0.1 },

  /* ── Section labels ───────────────────────────────────────────────── */
  sectionLabel: {
    fontSize: 11, fontWeight: '700',
    color: t.text.tertiary,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10, marginTop: 12,
  },
  sectionCount: { fontSize: 11, color: t.text.tertiary, fontWeight: '600', letterSpacing: 0.1 },

  /* ── Weight logger (input + log button) — web .input-base + .btn-primary */
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  logInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: t.surface.default,
    borderWidth: 1.5, borderColor: t.border.default,
    borderRadius: t.radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  logInputWrapFocus: {
    borderColor: t.brand[500],
    shadowColor: t.brand[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18, shadowRadius: 4,
    elevation: 2,
  },
  logInput: {
    flex: 1,
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: t.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
    paddingVertical: 12,
  },
  logUnit: { fontSize: 13, color: t.text.tertiary, fontWeight: '700' },
  logBtn: {
    width: 52, height: 52,
    borderRadius: 16,
    backgroundColor: t.brand[600],
    alignItems: 'center', justifyContent: 'center',
    ...t.shadow.brand,
  },
  logBtnOff: {
    backgroundColor: t.neutral[200],
    shadowOpacity: 0,
  },

  /* ── Workouts-tab stat grid ───────────────────────────────────────── */
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: t.surface.default,
    borderWidth: 1, borderColor: t.border.default,
    borderRadius: t.radius.xl,
    padding: 12,
    minHeight: 100,
    ...t.shadow.card,
  },
  statIconChip: {
    width: 26, height: 26,
    borderRadius: t.radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: {
    fontSize: t.fontSize['2xl'],
    fontWeight: '800',
    color: t.text.primary,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statUnit:  { fontSize: 11, fontWeight: '600', color: t.text.tertiary },
  statLabel: {
    fontSize: 10, fontWeight: '700',
    color: t.text.tertiary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 4,
  },

  /* ── Streak / on-pace badge — web .status-pill-warning ────────────── */
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(217,119,6,0.12)',
    borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  streakBadgeTxt: { fontSize: 11, fontWeight: '700', color: t.warning[700], letterSpacing: 0.2 },

  /* ── 4-week consistency bars ──────────────────────────────────────── */
  consistRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 110,
    paddingBottom: 4,
  },
  consistCol: { flex: 1, alignItems: 'center' },
  consistVal: {
    fontSize: 14, fontWeight: '800',
    color: t.text.primary,
    marginBottom: 6,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  consistBarTrack: {
    width: '55%',
    height: 72,
    borderRadius: 5,
    backgroundColor: t.surface.sunken,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  consistBarFill: {
    width: '100%',
    borderTopLeftRadius: 5, borderTopRightRadius: 5,
  },
  consistLbl: {
    fontSize: 10,
    color: t.text.tertiary,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  consistLblCurrent: { color: t.brand[600], fontWeight: '700' },

  /* ── Session-duration bar chart ───────────────────────────────────── */
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    paddingBottom: 6,
  },
  barCol: { flex: 1, alignItems: 'center' },
  barVal: {
    fontSize: 10,
    color: t.text.secondary,
    fontWeight: '700',
    marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    width: '55%',
    height: 120,
    borderRadius: 5,
    backgroundColor: t.surface.sunken,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: t.brand[600],
    borderTopLeftRadius: 5, borderTopRightRadius: 5,
  },
  barDate: {
    fontSize: 9,
    color: t.text.tertiary,
    marginTop: 6,
    textAlign: 'center',
    letterSpacing: 0.1,
    fontWeight: '600',
  },

  /* ── Recent-sessions list ─────────────────────────────────────────── */
  sessionList: {
    backgroundColor: t.surface.default,
    borderRadius: t.radius.xl,
    borderWidth: 1, borderColor: t.border.default,
    overflow: 'hidden',
    ...t.shadow.card,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  sessionRowDivider: {
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },
  sessionIcon: {
    width: 32, height: 32,
    borderRadius: t.radius.md,
    backgroundColor: 'rgba(22,163,74,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  sessionTitle: { fontSize: t.fontSize.base, fontWeight: '700', color: t.text.primary, letterSpacing: -0.1 },
  sessionSub:   { fontSize: t.fontSize.xs, color: t.text.secondary, marginTop: 2 },
  sessionMetric: { alignItems: 'flex-end' },
  sessionMetricVal: {
    fontSize: t.fontSize.xl,
    fontWeight: '800',
    color: t.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  sessionMetricUnit: { fontSize: 10, color: t.text.tertiary, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },

  /* ── Empty state ──────────────────────────────────────────────────── */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40, paddingHorizontal: 24,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.10)' : t.brand[50],
    borderWidth: 1, borderColor: t.brand[100],
    borderRadius: t.radius.xl,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: t.surface.default,
    borderWidth: 1, borderColor: t.brand[100],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: t.fontSize.xl, fontWeight: '800', color: t.text.primary, letterSpacing: -0.3 },
  emptySub:   { fontSize: t.fontSize.sm, color: t.text.secondary, marginTop: 6, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
}));

// ── TRAINER CHAT SCREEN ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — TrainerChatScreen (FULL REPLACEMENT)
//
// PASTE THIS ENTIRE BLOCK INTO App.js REPLACING THE EXISTING TrainerChatScreen
// function (from `function TrainerChatScreen` to the matching closing `}`).
//
// FIXES:
//   1. Member messages now appear — undefined mediaUrl stripped → null
//   2. Real-time auto-sync via onSnapshot (no orderBy → no index needed)
//   3. Image sending via expo-image-picker + Firebase Storage
//   4. Voice recording via expo-av + Firebase Storage
//   5. Correct chatId formula matching trainer app exactly
//
// REQUIRES (already in your project):
//   expo-image-picker, expo-av, firebase/storage
//   If missing: expo install expo-image-picker expo-av
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper: build chat ID (must match trainer app exactly) ───────────────────
// namespace = gymId if non-empty, else trainerId
function buildMemberChatId(gymId, trainerId, memberId) {
  const ns = (gymId && gymId.trim()) ? gymId : trainerId;
  return `${ns}_${trainerId}_${memberId}`;
}

// ─── Supplements Screen ───────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// KeyboardAwareLayout — universal keyboard-safe scroll container.
//
//   Problem: Every screen had its own ad-hoc keyboard listener, kbPadding state,
//   and scrollToInput function — all subtly broken in different ways (wrong
//   coordinate spaces, missing cleanup, keyboardDismissMode side-effects).
//
//   Solution: One component + one hook that every screen can use:
//     • ScrollView with keyboardShouldPersistTaps="handled" and NO
//       keyboardDismissMode (never accidentally dismiss on layout shift).
//     • KeyboardAvoidingView with behavior="padding" on iOS (adjustResize
//       in AndroidManifest covers Android natively).
//     • kbPadding: 0 when keyboard hidden → ZERO phantom bottom space.
//       Grows to keyboardHeight+24 when shown → enough scroll room.
//     • scrollToInput uses measureInWindow (screen coords) + tracked
//       scrollY so the delta calculation is always in the same space.
//     • 300 ms delay so keyboard animation is complete before measuring.
//
// Usage:
//   <KeyboardAwareLayout scrollRef={ref}>
//     <TextInput onFocus={() => scrollToInputRef.current?.(inputRef)} ... />
//   </KeyboardAwareLayout>
//
//   Or via render-prop for scrollToInput access:
//   <KeyboardAwareLayout>
//     {({ scrollToInput }) => <TextInput onFocus={() => scrollToInput(inputRef)} />}
//   </KeyboardAwareLayout>
// ─────────────────────────────────────────────────────────────────────────────

function useKeyboardScroll() {
  const scrollRef    = useRef(null);
  const scrollY      = useRef(0);
  const kbHeightRef  = useRef(0);
  const [kbPadding, setKbPadding] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
      kbHeightRef.current = e.endCoordinates.height;
      setKbPadding(e.endCoordinates.height + 24);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      kbHeightRef.current = 0;
      setKbPadding(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // scrollToInput: call from onFocus of any TextInput.
  // Uses measureInWindow (absolute screen coords) so it works regardless of
  // scroll position. Waits 300ms for keyboard animation to finish.
  const scrollToInput = (inputRef) => {
    if (!inputRef?.current || !scrollRef.current) return;
    setTimeout(() => {
      if (!inputRef?.current) return;
      inputRef.current.measureInWindow((_x, screenY, _w, h) => {
        const kbH = kbHeightRef.current || 300;
        const screenH = Dimensions.get('window').height;
        const inputBottom = screenY + h;
        const visibleBottom = screenH - kbH;
        const margin = 32;
        if (inputBottom + margin > visibleBottom) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollY.current + (inputBottom + margin - visibleBottom)),
            animated: true,
          });
        }
      });
    }, 300);
  };

  const onScroll = (e) => { scrollY.current = e.nativeEvent.contentOffset.y; };

  return { scrollRef, kbPadding, scrollToInput, onScroll };
}

function KeyboardAwareLayout({
  children,
  style,
  contentStyle,
  scrollRef: externalRef,
  noTopPad,
}) {
  const { scrollRef: internalRef, kbPadding, scrollToInput, onScroll } = useKeyboardScroll();
  const ref = externalRef || internalRef;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={ref}
        style={[{ flex: 1 }, style]}
        contentContainerStyle={[
          { paddingBottom: kbPadding, paddingHorizontal: 16, paddingTop: noTopPad ? 0 : 16 },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {typeof children === 'function'
          ? children({ scrollToInput })
          : children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Supplement constants ─────────────────────────────────────────────────────
const SUPP_PRESETS = [
  { name: 'Whey Protein', dose: '30g',      icon: 'barbell-outline' },
  { name: 'Creatine',     dose: '5g',       icon: 'flash-outline' },
  { name: 'Vitamin D',    dose: '2000 IU',  icon: 'sunny-outline' },
  { name: 'Vitamin C',    dose: '500mg',    icon: 'leaf-outline' },
  { name: 'Omega-3',      dose: '1000mg',   icon: 'water-outline' },
  { name: 'Magnesium',    dose: '400mg',    icon: 'medical-outline' },
  { name: 'Multivitamin', dose: '1 tablet', icon: 'star-outline' },
  { name: 'BCAA',         dose: '10g',      icon: 'fitness-outline' },
  { name: 'Pre-workout',  dose: '1 scoop',  icon: 'thunderstorm-outline' },
  { name: 'Zinc',         dose: '25mg',     icon: 'shield-outline' },
];

const SUPP_FREQ   = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];
const SUPP_DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SUPP_STORAGE_KEY = (uid) => `LIFT_SUPPLEMENTS_${uid}`;
const SUPP_TAKEN_KEY   = (uid) => {
  const d = new Date();
  return `LIFT_SUPPTAKEN_${uid}_${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const SUPP_NOTIF_KEY = (id) => `LIFT_SUPPNOTIF2_${id}`;

// Build all reminder times for a supplement (accounts for timesPerDay spacing)
function suppReminderTimes(supp) {
  const times = [];
  const spacing = supp.timesPerDay === 3 ? 6 : supp.timesPerDay === 2 ? 8 : 0;
  for (let i = 0; i < (supp.timesPerDay || 1); i++) {
    times.push({
      hour:   (supp.reminderHour + i * spacing) % 24,
      minute: supp.reminderMinute,
    });
  }
  return times;
}

async function scheduleSupplementNotif(supp) {
  // Cancel all previous notifications for this supplement
  await cancelSupplementNotif(supp.id);

  const freq   = (supp.frequency || 'Daily').toLowerCase();
  const times  = suppReminderTimes(supp);
  const ids    = [];

  const content = {
    title: '💊 Supplement Reminder',
    body: `Time to take your ${supp.name}${supp.dose ? ` — ${supp.dose}` : ''}`,
    sound: true,
    channelId: 'supplements',
    priority: 'high',
  };

  for (const { hour, minute } of times) {
    if (freq === 'daily') {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, repeats: true },
      }).catch(() => null);
      if (id) ids.push(id);

    } else if (freq === 'weekly') {
      // weekday: 1=Sun…7=Sat in expo-notifications
      const weekday = (supp.weekday ?? 2); // default Monday (2)
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, repeats: true },
      }).catch(() => null);
      if (id) ids.push(id);

    } else if (freq === 'monthly') {
      const day = supp.monthDay ?? 1;
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day, hour, minute, repeats: true },
      }).catch(() => null);
      if (id) ids.push(id);

    } else if (freq === 'quarterly') {
      // 4 YEARLY triggers — Jan, Apr, Jul, Oct — on monthDay
      const day = supp.monthDay ?? 1;
      for (const month of [1, 4, 7, 10]) {
        const id = await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.YEARLY, month, day, hour, minute, repeats: true },
        }).catch(() => null);
        if (id) ids.push(id);
      }
    }
  }

  await AsyncStorage.setItem(SUPP_NOTIF_KEY(supp.id), JSON.stringify(ids)).catch(() => {});
}

async function cancelSupplementNotif(suppId) {
  const raw = await AsyncStorage.getItem(SUPP_NOTIF_KEY(suppId)).catch(() => null);
  if (raw) {
    const ids = JSON.parse(raw);
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    await AsyncStorage.removeItem(SUPP_NOTIF_KEY(suppId)).catch(() => {});
  }
  // Also clean up old single-id key from previous implementation
  const oldRaw = await AsyncStorage.getItem(`LIFT_SUPPNOTIF_${suppId}`).catch(() => null);
  if (oldRaw) {
    await Notifications.cancelScheduledNotificationAsync(oldRaw).catch(() => {});
    await AsyncStorage.removeItem(`LIFT_SUPPNOTIF_${suppId}`).catch(() => {});
  }
}

// ─── SuppFormModal — shared Add / Edit sheet ─────────────────────────────────
//
//  Layout architecture (why each piece exists):
//
//  Modal
//    Pressable overlay (flex:1, dismiss on tap-outside)
//      Pressable sheet (stops propagation, maxHeight = screenH - kbH)
//        ┌─ Fixed header ─────────────────────────────────────────────┐
//        │  handle bar + title — never scrolls away                   │
//        └────────────────────────────────────────────────────────────┘
//        ┌─ ScrollView (flex:1) ──────────────────────────────────────┐
//        │  All form content. flex:1 fills the space between the      │
//        │  fixed header and fixed footer. Scrollable when content     │
//        │  is taller than the available gap.                         │
//        └────────────────────────────────────────────────────────────┘
//        ┌─ Fixed footer (buttons) ───────────────────────────────────┐
//        │  Cancel + Add/Save. OUTSIDE the ScrollView so they are     │
//        │  always visible and never scroll off screen.               │
//        └────────────────────────────────────────────────────────────┘
//
//  Keyboard handling (NO KeyboardAvoidingView needed):
//    We track keyboard height via Keyboard.addListener and subtract it
//    from the sheet's maxHeight. When the keyboard opens, the sheet
//    shrinks from the top — ScrollView compresses, form stays scrollable,
//    buttons remain anchored at the bottom. Works identically on iOS and
//    Android because Modal does NOT receive adjustResize from the manifest.
//
function SuppFormModal({ visible, initial, onSave, onClose }) {
  const C  = usePalette();
  const sp = useSpStyles();

  const blank = { name: '', dose: '', frequency: 'Daily', timesPerDay: 1, reminderEnabled: false, reminderHour: 8, reminderMinute: 0, weekday: 2, monthDay: 1 };
  const seed  = initial ?? blank;

  const [name,        setName]       = useState(seed.name);
  const [dose,        setDose]       = useState(seed.dose);
  const [freq,        setFreq]       = useState(seed.frequency    ?? 'Daily');
  const [timesDay,    setTimesDay]   = useState(seed.timesPerDay  ?? 1);
  const [hour,        setHour]       = useState(seed.reminderHour   ?? 8);
  const [minute,      setMinute]     = useState(seed.reminderMinute ?? 0);
  const [weekday,     setWeekday]    = useState(seed.weekday  ?? 2);
  const [monthDay,    setMonthDay]   = useState(seed.monthDay ?? 1);
  const [showPresets, setShowPresets] = useState(!initial);
  const [saving,      setSaving]     = useState(false);

  // ── Keyboard height tracking ────────────────────────────────────────────────
  // We listen for keyboard events inside the modal itself. When the keyboard
  // shows, we shrink maxHeight so the sheet fits above the keyboard.
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Reset keyboard height when modal closes
  useEffect(() => { if (!visible) setKbH(0); }, [visible]);

  // ── Form reset on open ──────────────────────────────────────────────────────
  useEffect(() => {
    setName(seed.name);      setDose(seed.dose);
    setFreq(seed.frequency   ?? 'Daily');
    setTimesDay(seed.timesPerDay ?? 1);
    setHour(seed.reminderHour   ?? 8);
    setMinute(seed.reminderMinute ?? 0);
    setWeekday(seed.weekday  ?? 2);
    setMonthDay(seed.monthDay ?? 1);
    setShowPresets(!initial);
  }, [visible]);

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), dose: dose.trim(), frequency: freq, timesPerDay: timesDay, reminderHour: hour, reminderMinute: minute, weekday, monthDay });
    setSaving(false);
  };

  // ── Sheet height computation ────────────────────────────────────────────────
  // maxHeight = min(90% screen, screen - keyboard - statusBar - safe margin).
  // This is computed fresh on every render so it reacts to keyboard changes
  // without needing any animation or ref updates.
  const screenH   = Dimensions.get('window').height;
  const statusBar = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const sheetMaxH = Math.min(
    screenH * 0.90,
    screenH - kbH - statusBar - 16,
  );
  // scrollMaxH: concrete pixel height for the ScrollView.
  // flex:1 in an unconstrained parent collapses to 0 in React Native —
  // this explicit value avoids that and gives the ScrollView a real height.
  // 166 = handle(18) + title(36) + footer(80) + sheet padding(32)
  const scrollMaxH = Math.max(120, sheetMaxH - 166);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>

      {/* ── Full-screen overlay — tap to dismiss ────────────────────────────── */}
      <Pressable
        style={sp.modalOverlay}
        onPress={onClose}
      >

        {/* ── Sheet — stops tap propagation, slides above keyboard via marginBottom ── */}
        <Pressable
          style={[sp.modalSheet, { marginBottom: kbH, maxHeight: sheetMaxH }]}
          onPress={e => e.stopPropagation()}
        >

          {/* ── FIXED HEADER ───────────────────────────────────────────────── */}
          <View style={sp.modalHandle} />
          <Text style={sp.modalTitle}>{initial ? 'Edit Supplement' : 'Add Supplement'}</Text>

          {/* ── SCROLLABLE BODY ─────────────────────────────────────────────
              flex:1 fills all available space between the fixed header and
              the fixed footer. React Native's flex algorithm will give this
              ScrollView exactly (sheetMaxH - headerHeight - footerHeight)
              pixels of visible height. Content that exceeds this scrolls.  */}
          <ScrollView
            style={{ maxHeight: scrollMaxH }}
            contentContainerStyle={sp.modalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            {/* ── Presets (add mode only) ──────────────────────────────── */}
            {!initial && (
              <>
                <TouchableOpacity
                  style={sp.presetsToggle}
                  onPress={() => setShowPresets(p => !p)}
                >
                  <Text style={sp.presetsToggleTxt}>
                    {showPresets ? 'Hide presets' : 'Choose from presets'}
                  </Text>
                  <Ionicons name={showPresets ? 'chevron-up' : 'chevron-down'} size={14} color={C.primary} />
                </TouchableOpacity>
                {showPresets && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={sp.presetScroll}
                    contentContainerStyle={{ gap: 8 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {SUPP_PRESETS.map(p => (
                      <TouchableOpacity
                        key={p.name}
                        style={sp.presetChip}
                        onPress={() => { setName(p.name); setDose(p.dose); setShowPresets(false); }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={p.icon} size={14} color={C.primary} />
                        <Text style={sp.presetChipTxt}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* ── Name ────────────────────────────────────────────────── */}
            <Text style={sp.inputLabel}>Supplement Name</Text>
            <TextInput
              style={sp.input}
              placeholder="e.g. Vitamin B12"
              placeholderTextColor={C.muted}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              autoCorrect={false}
            />

            {/* ── Dose ────────────────────────────────────────────────── */}
            <Text style={sp.inputLabel}>Dose (optional)</Text>
            <TextInput
              style={sp.input}
              placeholder="e.g. 1000mcg"
              placeholderTextColor={C.muted}
              value={dose}
              onChangeText={setDose}
              returnKeyType="done"
              autoCorrect={false}
            />

            {/* ── Frequency ───────────────────────────────────────────── */}
            <Text style={sp.inputLabel}>Reminder Frequency</Text>
            <View style={sp.segRow}>
              {SUPP_FREQ.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[sp.segBtn, freq === f && sp.segBtnActive]}
                  onPress={() => setFreq(f)}
                  activeOpacity={0.75}
                >
                  <Text style={[sp.segTxt, freq === f && sp.segTxtActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Weekly day picker ───────────────────────────────────── */}
            {freq === 'Weekly' && (
              <>
                <Text style={sp.inputLabel}>Day of Week</Text>
                <View style={sp.segRow}>
                  {SUPP_DAYS.map((d, i) => (
                    <TouchableOpacity
                      key={d}
                      style={[sp.segBtn, weekday === i + 1 && sp.segBtnActive]}
                      onPress={() => setWeekday(i + 1)}
                      activeOpacity={0.75}
                    >
                      <Text style={[sp.segTxt, weekday === i + 1 && sp.segTxtActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* ── Monthly / Quarterly day-of-month picker ─────────────── */}
            {(freq === 'Monthly' || freq === 'Quarterly') && (
              <>
                <Text style={sp.inputLabel}>
                  {freq === 'Quarterly' ? 'Day of each quarter month' : 'Day of month'}
                </Text>
                <View style={sp.dayNumRow}>
                  <TouchableOpacity style={sp.timeArrow} onPress={() => setMonthDay(d => Math.max(1, d - 1))}>
                    <Ionicons name="remove-circle-outline" size={24} color={C.primary} />
                  </TouchableOpacity>
                  <Text style={sp.dayNumVal}>{monthDay}</Text>
                  <TouchableOpacity style={sp.timeArrow} onPress={() => setMonthDay(d => Math.min(28, d + 1))}>
                    <Ionicons name="add-circle-outline" size={24} color={C.primary} />
                  </TouchableOpacity>
                  <Text style={sp.dayNumUnit}>of the month</Text>
                </View>
                {freq === 'Quarterly' && (
                  <Text style={sp.inputHint}>
                    Fires on Jan {monthDay}, Apr {monthDay}, Jul {monthDay}, Oct {monthDay}
                  </Text>
                )}
              </>
            )}

            {/* ── Times per day ───────────────────────────────────────── */}
            <Text style={sp.inputLabel}>Times Per Day</Text>
            <View style={sp.segRow}>
              {[1, 2, 3].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[sp.segBtn, timesDay === n && sp.segBtnActive]}
                  onPress={() => setTimesDay(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[sp.segTxt, timesDay === n && sp.segTxtActive]}>{n}×</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Time picker ─────────────────────────────────────────── */}
            <Text style={sp.inputLabel}>First reminder time</Text>
            <View style={sp.timePicker}>
              <View style={sp.timePickerRow}>
                <View style={sp.timeUnit}>
                  <TouchableOpacity style={sp.timeArrow} onPress={() => setHour(h => (h + 1) % 24)}>
                    <Ionicons name="chevron-up" size={20} color={C.primary} />
                  </TouchableOpacity>
                  <Text style={sp.timeVal}>{hh}</Text>
                  <TouchableOpacity style={sp.timeArrow} onPress={() => setHour(h => (h + 23) % 24)}>
                    <Ionicons name="chevron-down" size={20} color={C.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={sp.timeSep}>:</Text>
                <View style={sp.timeUnit}>
                  <TouchableOpacity style={sp.timeArrow} onPress={() => setMinute(m => (m + 5) % 60)}>
                    <Ionicons name="chevron-up" size={20} color={C.primary} />
                  </TouchableOpacity>
                  <Text style={sp.timeVal}>{mm}</Text>
                  <TouchableOpacity style={sp.timeArrow} onPress={() => setMinute(m => (m + 55) % 60)}>
                    <Ionicons name="chevron-down" size={20} color={C.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              {timesDay > 1 && (
                <Text style={[sp.inputHint, { marginTop: 8 }]}>
                  {timesDay === 2
                    ? `Also at ${String((hour + 8) % 24).padStart(2, '0')}:${mm}`
                    : `Also at ${String((hour + 6) % 24).padStart(2, '0')}:${mm} and ${String((hour + 12) % 24).padStart(2, '0')}:${mm}`}
                </Text>
              )}
            </View>
          </ScrollView>

          {/* ── FIXED FOOTER — buttons always visible ───────────────────────
              Sits outside the ScrollView. Anchored to the sheet bottom.
              When keyboard is open, sheetMaxH shrinks → sheet is shorter →
              ScrollView compresses → these buttons remain right here.      */}
          <View style={sp.modalActions}>
            {/* Cancel — ghost square, icon only */}
            <TouchableOpacity
              style={sp.modalCancelBtn}
              onPress={onClose}
              hitSlop={4}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#9ca3af" />
            </TouchableOpacity>
            {/* Confirm — icon + label, full flex */}
            <TouchableOpacity
              style={[sp.modalAddBtn, (!name.trim() || saving) && sp.modalAddBtnOff]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <View style={sp.modalAddInner}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={sp.modalAddTxt}>{initial ? 'Save' : 'Add'}</Text>
                  </View>
              }
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── SupplementsScreen ────────────────────────────────────────────────────────
function SupplementsScreen({ memberId }) {
  const C  = usePalette();
  const { theme } = useTheme();
  const sp = useSpStyles();

  const [supplements, setSupplements] = useState([]);
  const [takenToday,  setTakenToday]  = useState(new Set());
  const [formModal,   setFormModal]   = useState(null); // null | 'add' | {supplement object for edit}

  const storageKey = SUPP_STORAGE_KEY(memberId);
  const takenKey   = SUPP_TAKEN_KEY(memberId);

  const persist = async (list) => {
    setSupplements(list);
    await AsyncStorage.setItem(storageKey, JSON.stringify(list)).catch(() => {});
  };

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then(raw => { if (raw) setSupplements(JSON.parse(raw)); }).catch(() => {});
    AsyncStorage.getItem(takenKey).then(raw => { if (raw) setTakenToday(new Set(JSON.parse(raw))); }).catch(() => {});
  }, [storageKey, takenKey]);

  const toggleTaken = async (id) => {
    const next = new Set(takenToday);
    if (next.has(id)) next.delete(id); else next.add(id);
    setTakenToday(next);
    await AsyncStorage.setItem(takenKey, JSON.stringify([...next])).catch(() => {});
  };

  const toggleReminder = async (id) => {
    const list = supplements.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, reminderEnabled: !s.reminderEnabled };
      if (updated.reminderEnabled) scheduleSupplementNotif(updated);
      else cancelSupplementNotif(id);
      return updated;
    });
    await persist(list);
  };

  const handleFormSave = async (fields) => {
    if (formModal === 'add') {
      const supp = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ...fields,
        reminderEnabled: false,
        createdAt: Date.now(),
      };
      await persist([...supplements, supp]);
    } else {
      // edit
      const list = supplements.map(s => {
        if (s.id !== formModal.id) return s;
        const updated = { ...s, ...fields };
        if (updated.reminderEnabled) scheduleSupplementNotif(updated);
        return updated;
      });
      await persist(list);
    }
    setFormModal(null);
  };

  const deleteSupplement = (id) => {
    Alert.alert('Remove Supplement', 'Remove this supplement?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await cancelSupplementNotif(id);
        await persist(supplements.filter(s => s.id !== id));
      }},
    ]);
  };

  // Returns true if this supplement is scheduled for today.
  // Daily: always. Weekly: only on matching day-of-week.
  // Monthly/Quarterly: only on the configured day of month.
  const isScheduledToday = (s) => {
    const freq = (s.frequency || 'Daily').toLowerCase();
    if (freq === 'daily') return true;
    if (freq === 'weekly') {
      // SUPP weekday stored as 1=Sun…7=Sat; JS getDay() 0=Sun…6=Sat
      const todayJS  = new Date().getDay();          // 0–6
      const suppJS   = ((s.weekday ?? 2) - 1) % 7;  // convert 1-7 → 0-6
      return todayJS === suppJS;
    }
    if (freq === 'monthly') {
      return new Date().getDate() === (s.monthDay ?? 1);
    }
    if (freq === 'quarterly') {
      const today = new Date();
      return today.getDate() === (s.monthDay ?? 1) &&
             [1, 4, 7, 10].includes(today.getMonth() + 1);
    }
    return true;
  };

  // Only count supplements that are due today for the chip.
  const todaySupplements = supplements.filter(isScheduledToday);
  const takenCount       = todaySupplements.filter(s => takenToday.has(s.id)).length;

  const freqLabel = (s) => {
    const f = s.frequency ?? 'Daily';
    if (f === 'Weekly') return `${f} · ${SUPP_DAYS[(s.weekday ?? 2) - 1]}`;
    if (f === 'Monthly' || f === 'Quarterly') return `${f} · Day ${s.monthDay ?? 1}`;
    return f;
  };

  return (
    <KeyboardAwareLayout style={{ backgroundColor: theme.surface.raised }} contentStyle={{ paddingTop: 20 }}>
      <Text style={sp.pageTitle}>Supplements</Text>
      <Text style={sp.pageSub}>Track your supplements and never miss a dose.</Text>

      {supplements.length > 0 && (
        <View style={sp.summaryRow}>
          <View style={[sp.summaryChip, {
            backgroundColor: todaySupplements.length > 0 && takenCount === todaySupplements.length
              ? C.green + '22' : C.card,
          }]}>
            <Ionicons
              name={todaySupplements.length > 0 && takenCount === todaySupplements.length
                ? 'checkmark-circle' : 'time-outline'}
              size={15}
              color={todaySupplements.length > 0 && takenCount === todaySupplements.length
                ? C.green : C.muted}
            />
            <Text style={[sp.summaryTxt, {
              color: todaySupplements.length > 0 && takenCount === todaySupplements.length
                ? C.green : C.muted,
            }]}>
              {takenCount}/{todaySupplements.length} taken today
            </Text>
          </View>
        </View>
      )}

      {supplements.map(supp => {
        const taken     = takenToday.has(supp.id);
        const dueToday  = isScheduledToday(supp);
        const hh = String(supp.reminderHour ?? 8).padStart(2, '0');
        const mm = String(supp.reminderMinute ?? 0).padStart(2, '0');
        const tpd = supp.timesPerDay ?? 1;
        return (
          <View key={supp.id} style={[sp.card, taken && sp.cardTaken, !dueToday && { opacity: 0.45 }]}>
            <View style={sp.cardTop}>
              <View style={sp.cardLeft}>
                <Text style={sp.cardName}>{supp.name}</Text>
                {!!supp.dose && <Text style={sp.cardDose}>{supp.dose}</Text>}
              </View>
              <View style={sp.cardActions}>
                {/* Take button disabled and hidden when supplement is not due today */}
                <TouchableOpacity
                  style={[sp.takenBtn, taken && sp.takenBtnActive]}
                  onPress={() => dueToday && toggleTaken(supp.id)}
                  activeOpacity={dueToday ? 0.75 : 1}
                  disabled={!dueToday}
                >
                  <Ionicons name={taken ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18}
                    color={taken ? '#fff' : C.muted} />
                  <Text style={[sp.takenTxt, taken && sp.takenTxtActive]}>
                    {taken ? 'Taken' : dueToday ? 'Take' : 'Not today'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={sp.iconBtn} onPress={() => setFormModal(supp)} hitSlop={8}>
                  <Ionicons name="pencil-outline" size={15} color={C.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={sp.iconBtn} onPress={() => deleteSupplement(supp.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={15} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Reminder row */}
            <View style={sp.reminderRow}>
              <Ionicons name="alarm-outline" size={13} color={supp.reminderEnabled ? C.primary : C.muted} />
              <Text style={[sp.reminderLabel, supp.reminderEnabled && { color: C.primary }]}>
                {supp.reminderEnabled
                  ? `${freqLabel(supp)} · ${hh}:${mm}${tpd > 1 ? ` · ${tpd}×/day` : ''}`
                  : 'No reminder'}
              </Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => toggleReminder(supp.id)} hitSlop={8}
                style={[sp.toggle, supp.reminderEnabled && sp.toggleOn]}>
                <View style={[sp.toggleThumb, supp.reminderEnabled && sp.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {supplements.length === 0 && (
        <View style={sp.emptyState}>
          <View style={sp.emptyCircle}>
            <Ionicons name="flask-outline" size={28} color={C.primary} />
          </View>
          <Text style={sp.emptyTitle}>No supplements yet</Text>
          <Text style={sp.emptySub}>Add your supplements and set reminders so you never miss a dose.</Text>
        </View>
      )}

      <TouchableOpacity style={sp.addBtn} onPress={() => setFormModal('add')} activeOpacity={0.85}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={sp.addBtnTxt}>Add Supplement</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />

      <SuppFormModal
        visible={!!formModal}
        initial={formModal === 'add' ? null : formModal}
        onSave={handleFormSave}
        onClose={() => setFormModal(null)}
      />
    </KeyboardAwareLayout>
  );
}

const useSpStyles = makeStyles((t) => StyleSheet.create({
  screen:    { flex: 1, backgroundColor: t.surface.raised, paddingHorizontal: 16, paddingTop: 20 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: t.text.primary, letterSpacing: -0.5, marginBottom: 4 },
  pageSub:   { fontSize: 14, color: t.text.secondary, marginBottom: 20 },

  summaryRow:  { marginBottom: 16 },
  summaryChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: t.border.default },
  summaryTxt:  { fontSize: 13, fontWeight: '600' },

  card:        { backgroundColor: t.surface.default, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: t.border.default },
  cardTaken:   { borderColor: t.success[400] + '55' },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardLeft:    { flex: 1 },
  cardName:    { fontSize: 15, fontWeight: '700', color: t.text.primary, marginBottom: 2 },
  cardDose:    { fontSize: 12, color: t.text.secondary, fontWeight: '500' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  takenBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: t.border.default, backgroundColor: t.surface.sunken },
  takenBtnActive: { backgroundColor: t.success[600], borderColor: t.success[600] },
  takenTxt:       { fontSize: 12, fontWeight: '600', color: t.text.secondary },
  takenTxtActive: { color: '#fff' },
  iconBtn:        { padding: 4 },

  reminderRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reminderLabel: { fontSize: 12, color: t.text.secondary, fontWeight: '500', flex: 1 },

  toggle:        { width: 38, height: 22, borderRadius: 11, backgroundColor: t.border.default, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn:      { backgroundColor: t.brand[500] },
  toggleThumb:   { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  emptyState:  { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.surface.sunken, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: t.text.primary, marginBottom: 6 },
  emptySub:    { fontSize: 13, color: t.text.secondary, textAlign: 'center', lineHeight: 19 },

  addBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: t.brand[600], borderRadius: 12, paddingVertical: 13, marginTop: 8 },
  addBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Modal styles ──────────────────────────────────────────────────────────
  // Overlay: full-screen semi-transparent backdrop, sheet anchored at bottom
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },

  // Sheet: maxHeight is set inline (computed from screen - keyboard).
  // flexDirection:'column' so header, ScrollView, and footer stack vertically.
  // paddingBottom covers device safe area + gives footer breathing room.
  modalSheet: {
    backgroundColor: t.surface.default,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: 'column',
  },

  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: t.border.default,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: t.text.primary, marginBottom: 14 },

  // Content inside the scrollable body (the flex:1 ScrollView)
  modalScrollContent: { paddingBottom: 4 },

  presetsToggle:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  presetsToggleTxt: { fontSize: 13, fontWeight: '600', color: t.brand[600] },
  presetScroll:     { marginBottom: 14 },
  presetChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: t.brand[200], backgroundColor: t.surface.sunken },
  presetChipTxt:    { fontSize: 12, fontWeight: '600', color: t.text.primary },

  inputLabel: { fontSize: 12, fontWeight: '600', color: t.text.secondary, marginBottom: 6, marginTop: 14 },
  inputHint:  { fontSize: 11, color: t.text.tertiary, marginTop: 4 },
  input:      { backgroundColor: t.surface.sunken, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, color: t.text.primary, borderWidth: 1, borderColor: t.border.default },

  // Segmented buttons (frequency / days / times)
  segRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segBtn:       { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: t.border.default, backgroundColor: t.surface.sunken },
  segBtnActive: { backgroundColor: t.brand[600], borderColor: t.brand[600] },
  segTxt:       { fontSize: 13, fontWeight: '600', color: t.text.secondary },
  segTxtActive: { color: '#fff' },

  // Time picker
  timePicker:    { backgroundColor: t.surface.sunken, borderRadius: 12, padding: 14, alignItems: 'center' },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeUnit:      { alignItems: 'center', gap: 2 },
  timeArrow:     { padding: 6 },
  timeVal:       { fontSize: 32, fontWeight: '700', color: t.text.primary, fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'center' },
  timeSep:       { fontSize: 28, fontWeight: '700', color: t.text.secondary, marginTop: -4 },

  // Day of month picker
  dayNumRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayNumVal:  { fontSize: 28, fontWeight: '700', color: t.text.primary, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'center' },
  dayNumUnit: { fontSize: 13, color: t.text.secondary },

  // Footer: always visible below the ScrollView
  modalActions: {
    flexDirection: 'row', gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: t.border.subtle,
    alignItems: 'center',
  },

  // Ghost dismiss — square, icon-only, sits left at fixed width
  modalCancelBtn: {
    width: 52, height: 52,
    borderRadius: 14,
    borderWidth: 1.5, borderColor: t.border.default,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.surface.sunken,
  },

  // Primary confirm — fills remaining space, strong brand fill
  modalAddBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: t.brand[600],
    alignItems: 'center', justifyContent: 'center',
    ...t.shadow.brand,
  },
  modalAddBtnOff: { opacity: 0.38, shadowOpacity: 0 },
  modalAddInner:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalAddTxt:    { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.1 },
}));

// ── Helper: strip undefined values before any Firestore write ─────────────────
function cleanForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore).filter(v => v !== undefined);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = cleanForFirestore(v);
  }
  return result;
}

// ── Main component ─────────────────────────────────────────────────────────────
function TrainerChatScreen({ member, onBack }) {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [recording, setRecording] = React.useState(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [playingId, setPlayingId] = React.useState(null);
  const soundRef = React.useRef(null);
  const scrollRef = React.useRef(null);

  // Resolve chat ID
  const gymId = member?.gymId || null;
  const trainerId = member?.trainerId || null;
  const memberId = member?.id;
  const chatId = (trainerId && memberId)
    ? buildMemberChatId(gymId, trainerId, memberId)
    : null;

  // ── Subscribe to messages in real time ─────────────────────────────────────
  React.useEffect(() => {
    if (!chatId) {
      setLoading(false);
      return;
    }

    const { collection, query, onSnapshot, doc, setDoc } = require('firebase/firestore');

    // Ensure chat thread document exists
    const threadRef = doc(db, 'chats', chatId);
    setDoc(threadRef, cleanForFirestore({
      id: chatId,
      gymId: gymId,
      trainerId,
      memberId,
      createdAt: Date.now(),
    }), { merge: true }).catch(() => {});

    // Subscribe — NO orderBy to avoid composite index requirement
    const q = query(collection(db, 'chats', chatId, 'messages'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)); // oldest first, client-side
      setMessages(msgs);
      setLoading(false);
      // Scroll to bottom after render
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
    }, (err) => {
      console.log('[chat] snapshot error:', err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [chatId]);

  // ── Send text message ───────────────────────────────────────────────────────
  const handleSendText = async () => {
    const text = input.trim();
    if (!text || !chatId || sending) return;
    setInput('');
    setSending(true);
    try {
      const { collection, doc, setDoc } = require('firebase/firestore');
      const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
      // ⚠️ KEY FIX: mediaUrl must be null, not undefined
      await setDoc(msgRef, cleanForFirestore({
        id: msgRef.id,
        chatId,
        senderId: memberId,
        senderRole: 'member',
        type: 'text',
        text,
        mediaUrl: null,    // explicitly null — Firestore rejects undefined
        isRead: false,
        createdAt: Date.now(),
      }));
      // Update thread
      const { doc: d2, setDoc: sd2 } = require('firebase/firestore');
      await sd2(d2(db, 'chats', chatId), cleanForFirestore({
        lastMessage: text,
        lastMessageAt: Date.now(),
      }), { merge: true }).catch(() => {});
    } catch (e) {
      console.log('[chat] send error:', e.message);
      Alert.alert('Send failed', 'Could not send message. Please try again.');
    } finally { setSending(false); }
  };

  // ── Send image ──────────────────────────────────────────────────────────────
  const handleSendImage = async () => {
    try {
      // Request permission
      const ImagePicker = require('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to send images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;

      setSending(true);
      // Upload to Firebase Storage
      const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
      const storage = getStorage();
      const ext = uri.split('.').pop() || 'jpg';
      const path = `chats/${chatId}/${memberId}_${Date.now()}.${ext}`;
      const imgRef = storageRef(storage, path);

      // Fetch as blob
      const response = await fetch(uri);
      const blob = await response.blob();
      await uploadBytes(imgRef, blob);
      const mediaUrl = await getDownloadURL(imgRef);

      // Write message
      const { collection, doc, setDoc } = require('firebase/firestore');
      const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
      await setDoc(msgRef, cleanForFirestore({
        id: msgRef.id,
        chatId,
        senderId: memberId,
        senderRole: 'member',
        type: 'image',
        text: '',
        mediaUrl,          // URL string — never undefined
        isRead: false,
        createdAt: Date.now(),
      }));
      await setDoc(doc(db, 'chats', chatId), cleanForFirestore({
        lastMessage: '📷 Image',
        lastMessageAt: Date.now(),
      }), { merge: true }).catch(() => {});
    } catch (e) {
      console.log('[chat] image send error:', e.message);
      Alert.alert('Failed', 'Could not send image. Please try again.');
    } finally { setSending(false); }
  };

  // ── Voice recording ─────────────────────────────────────────────────────────
  const handleVoicePress = async () => {
    if (isRecording) {
      // Stop recording and send
      try {
        setIsRecording(false);
        const { Audio } = require('expo-av');
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);

        setSending(true);
        // Upload to Firebase Storage
        const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
        const storage = getStorage();
        const path = `chats/${chatId}/${memberId}_voice_${Date.now()}.m4a`;
        const voiceRef = storageRef(storage, path);
        const resp = await fetch(uri);
        const blob = await resp.blob();
        await uploadBytes(voiceRef, blob);
        const mediaUrl = await getDownloadURL(voiceRef);

        // Write message
        const { collection, doc, setDoc } = require('firebase/firestore');
        const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
        await setDoc(msgRef, cleanForFirestore({
          id: msgRef.id,
          chatId,
          senderId: memberId,
          senderRole: 'member',
          type: 'voice',
          text: '',
          mediaUrl,
          isRead: false,
          createdAt: Date.now(),
        }));
        await setDoc(doc(db, 'chats', chatId), cleanForFirestore({
          lastMessage: '🎙️ Voice note',
          lastMessageAt: Date.now(),
        }), { merge: true }).catch(() => {});
      } catch (e) {
        console.log('[chat] voice send error:', e.message);
        Alert.alert('Failed', 'Could not send voice note.');
      } finally { setSending(false); }
    } else {
      // Start recording
      try {
        const { Audio } = require('expo-av');
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Allow microphone access to send voice notes.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: rec } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        setRecording(rec);
        setIsRecording(true);
      } catch (e) {
        console.log('[chat] voice start error:', e.message);
        Alert.alert('Error', 'Could not start recording.');
      }
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // ── No trainer guard ────────────────────────────────────────────────────────
  if (!member?.trainerId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={tcStyles.header}>
          <TouchableOpacity onPress={onBack}><Text style={tcStyles.backBtn}>← Back</Text></TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.dark }}>Chat</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40 }}>🏋️</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.dark, marginTop: 12 }}>No trainer linked yet</Text>
          <Text style={{ fontSize: 14, color: C.mid, marginTop: 6, textAlign: 'center' }}>
            Accept a trainer invite to start chatting.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Voice playback ───────────────────────────────────────────────────────────
  const playVoice = async (msg) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingId === msg.id) { setPlayingId(null); return; }
      const { Audio: Av } = require('expo-av');
      await Av.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Av.Sound.createAsync({ uri: msg.mediaUrl }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(msg.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) { setPlayingId(null); soundRef.current = null; }
      });
    } catch (e) {
      console.log('[chat] voice play error:', e.message);
    }
  };

  // ── Message bubble renderer ─────────────────────────────────────────────────
  const renderMessage = (msg) => {
    const isMine = msg.senderRole === 'member';
    const isPlaying = playingId === msg.id;
    return (
      <View key={msg.id} style={[tcStyles.msgRow, isMine && tcStyles.msgRowMe]}>
        {!isMine && <Text style={tcStyles.avatar}>🏋️</Text>}
        <View style={[tcStyles.bubble, isMine ? tcStyles.bubbleMe : tcStyles.bubbleThem]}>
          {msg.type === 'image' && msg.mediaUrl ? (
            <Image
              source={{ uri: msg.mediaUrl }}
              style={{ width: 200, height: 150, borderRadius: 10 }}
              resizeMode="cover"
            />
          ) : msg.type === 'voice' && msg.mediaUrl ? (
            <TouchableOpacity onPress={() => playVoice(msg)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>{isPlaying ? '⏸️' : '▶️'}</Text>
              <Text style={[tcStyles.bubbleText, isMine && { color: '#fff' }]}>
                {isPlaying ? 'Playing…' : 'Voice note'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[tcStyles.bubbleText, isMine && { color: '#fff' }]}>
              {msg.text || '...'}
            </Text>
          )}
          <Text style={[tcStyles.bubbleTime, isMine && { color: 'rgba(255,255,255,0.6)' }]}>
            {formatTime(msg.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={tcStyles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={tcStyles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22 }}>🏋️</Text>
          <View>
            <Text style={tcStyles.headerName}>{member.trainerName || 'Your Trainer'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
              <Text style={{ fontSize: 11, color: C.green, fontWeight: '500' }}>Online</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontSize: 40 }}>👋</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: C.dark, marginTop: 12 }}>
                Say hello to your trainer!
              </Text>
              <Text style={{ fontSize: 13, color: C.mid, marginTop: 4 }}>
                Messages appear here in real time
              </Text>
            </View>
          ) : (
            messages.map(renderMessage)
          )}
        </ScrollView>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={tcStyles.inputBar}>
          {/* Image picker button */}
          <TouchableOpacity
            style={tcStyles.mediaBtn}
            onPress={handleSendImage}
            disabled={sending}
          >
            <Text style={{ fontSize: 22 }}>📷</Text>
          </TouchableOpacity>

          {/* Voice button */}
          <TouchableOpacity
            style={[tcStyles.mediaBtn, isRecording && { backgroundColor: '#FEE2E2' }]}
            onPress={handleVoicePress}
            disabled={sending && !isRecording}
          >
            <Text style={{ fontSize: 22 }}>{isRecording ? '⏹️' : '🎙️'}</Text>
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            style={tcStyles.input}
            value={isRecording ? '🔴 Recording… tap ⏹️ to send' : input}
            onChangeText={isRecording ? undefined : setInput}
            placeholder="Message your trainer…"
            placeholderTextColor={C.mid}
            multiline
            editable={!isRecording && !sending}
          />

          {/* Send button */}
          <TouchableOpacity
            style={[tcStyles.sendBtn, (!input.trim() || sending) && { backgroundColor: C.light }]}
            onPress={handleSendText}
            disabled={!input.trim() || sending || isRecording}
          >
            {sending
              ? <ActivityIndicator color={C.primary} size="small" />
              : <Text style={{ color: input.trim() ? '#fff' : C.mid, fontSize: 18 }}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── TrainerChatScreen styles ──────────────────────────────────────────────────
const tcStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, paddingTop: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { color: C.primary, fontSize: 15, fontWeight: '500', width: 60 },
  headerName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  avatar: { fontSize: 22, width: 30, textAlign: 'center' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  bubbleMe: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: '#111827', lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: '#6B7280', marginTop: 4, textAlign: 'right' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 10, paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    gap: 8,
  },
  mediaBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1, borderColor: '#E5E7EB',
    maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ── NOTIFICATIONS SCREEN ──────────────────────────────────────────────────────
function NotificationsScreen({ onBack, memberId }) {
  const C = usePalette();
  const g = useGlobalStyles();
  const nt = useNtStyles();
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!memberId) return;
    const unsub = subscribeToNotifications(memberId, setNotifs);
    return () => unsub();
  }, [memberId]);

  const handleMarkAll = async () => {
    if (!memberId) return;
    await markAllNotifsRead(memberId).catch(() => {});
  };

  const iconFor = (type) => {
    switch (type) {
      case 'workout_assigned': return '🏋️';
      case 'message_received': return '💬';
      case 'membership_expiring': return '💳';
      case 'progress_reminder': return '📸';
      case 'class_reminder': return '📅';
      default: return '🔔';
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={nt.header}>
        {/* Back chevron matches web modal-back pattern — 36×36 tap zone */}
        <TouchableOpacity onPress={onBack} hitSlop={8} style={nt.backChip}>
          <Ionicons name="chevron-back" size={22} color={C.dark} />
        </TouchableOpacity>
        <Text style={nt.title}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAll} hitSlop={8}>
          <Text style={nt.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ padding: 16 }}>
        {notifs.length === 0 && (
          <Text style={{ color: C.mid, textAlign: 'center', marginTop: 40 }}>No notifications yet</Text>
        )}
        {notifs.map(n => (
          <TouchableOpacity
            key={n.id}
            style={[nt.card, !n.read && nt.cardUnread]}
            onPress={() => markNotificationRead(n.id).catch(() => {})}>
            <Text style={{ fontSize: 24 }}>{iconFor(n.type)}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={nt.nTitle}>{n.title}</Text>
              <Text style={nt.nBody}>{n.body}</Text>
              <Text style={nt.nTime}>{formatDate(n.createdAt)}</Text>
            </View>
            {!n.read && <View style={nt.dot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const useNtStyles = makeStyles((t) => StyleSheet.create({
  // Header — matches web modal-header pattern: surface bg, subtle hairline,
  // centered title with flanking back chevron + action link.
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: t.spacing.pageX,
    paddingVertical: t.spacing[3],
    backgroundColor: t.surface.default,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  // Back chevron chip — 36×36 tap zone
  backChip: {
    width: 36, height: 36,
    borderRadius: t.radius.full,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -8,
  },
  title:   { fontSize: t.fontSize.lg, fontWeight: '700', color: t.text.primary, letterSpacing: -0.2 },
  markAll: { fontSize: 13, fontWeight: '600', color: t.brand[600] },
  // Notification cards — now token-driven with shadow.card parity
  card: {
    backgroundColor: t.surface.default,
    borderRadius: t.radius.lg,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: t.border.default,
    ...t.shadow.card,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: t.brand[600] },
  nTitle: { fontSize: 14, fontWeight: '600', color: t.text.primary },
  nBody:  { fontSize: 13, color: t.text.secondary, marginTop: 2 },
  nTime:  { fontSize: 11, color: t.text.tertiary, marginTop: 4 },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: t.brand[600] },
}));

// ── PROFILE SCREEN ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — Trainer Invite Section
// Paste this entire block into App.js BEFORE the ProfileScreen function.
// Then inside ProfileScreen, after the Trainer Chat card, add:
//   <TrainerInviteSection member={member} onTrainerLinked={onUpdateMember} />
// ─────────────────────────────────────────────────────────────────────────────

function TrainerInviteSection({ member, onTrainerLinked }) {
  const ti = useTiStyles();
  const [invitesEnabled, setInvitesEnabled] = React.useState(member?.acceptingTrainerInvites ?? false);
  const [linkInput, setLinkInput] = React.useState('');
  const [linkResult, setLinkResult] = React.useState(null);
  const [pendingInvites, setPendingInvites] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [linkLoading, setLinkLoading] = React.useState(false);

  React.useEffect(() => {
    if (!member?.id) return;
    const q = query(
      collection(db, 'trainerInvites'),
      where('memberId', '==', member.id),
      where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(q, snap => {
      setPendingInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [member?.id]);

  const handleToggle = async () => {
    const newVal = !invitesEnabled;
    setInvitesEnabled(newVal);
    if (member?.id) {
      await updateDoc(doc(db, 'members', member.id), {
        acceptingTrainerInvites: newVal,
      }).catch(() => {});
    }
  };

  const handleLinkLookup = async () => {
    const input = linkInput.trim();
    if (!input) return;
    setLinkLoading(true);
    setLinkResult(null);
    try {
      const code = input.includes('/')
        ? input.split('/').pop().toUpperCase()
        : input.toUpperCase();
      const inviteSnap = await getDocs(
        query(collection(db, 'freelanceInvites'), where('inviteCode', '==', code))
      );
      if (inviteSnap.empty) {
        Alert.alert('Not Found', 'This invite link is invalid or expired. Check with your trainer.');
        return;
      }
      const invite = inviteSnap.docs[0].data();
      const inviteId = inviteSnap.docs[0].id;
      const trainerSnap = await getDoc(doc(db, 'trainers', invite.trainerId));
      const trainerName = trainerSnap.data()?.fullName ?? trainerSnap.data()?.name ?? 'Trainer';
      setLinkResult({ trainerId: invite.trainerId, trainerName, inviteId, monthlyFee: invite.monthlyFee, planEndDate: invite.planEndDate ?? null });
    } catch (e) {
      Alert.alert('Error', 'Could not look up this invite. Please try again.');
    } finally { setLinkLoading(false); }
  };

  const acceptInvite = async (trainerId, inviteId, planEndDate) => {
    const trainerSnap = await getDoc(doc(db, 'trainers', trainerId));
    const trainer = trainerSnap.data();
    const trainerGymId = trainer?.gymId ?? null;
    const now = Date.now();

    await updateDoc(doc(db, 'members', member.id), {
      trainerId,
      trainerName: trainer?.fullName ?? trainer?.name ?? '',
      gymId: trainerGymId,
      active: true,
      planEndDate: planEndDate ?? (now + 30 * 24 * 60 * 60 * 1000),
      planStartDate: now,
      updatedAt: now,
    });

    await updateDoc(doc(db, 'trainerInvites', inviteId), {
      status: 'accepted', acceptedAt: now,
    }).catch(() => {});

    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      id: notifRef.id,
      recipientId: trainerId,
      type: 'client_invited_accepted',
      title: 'New Client Connected',
      body: (member.name || 'A member') + ' accepted your training invite',
      isRead: false, read: false,
      createdAt: now,
    });

    onTrainerLinked({
      trainerId,
      trainer: trainer?.fullName ?? trainer?.name ?? 'Trainer',
      gymId: trainerGymId,
      planEndDate: planEndDate ?? (now + 30 * 24 * 60 * 60 * 1000),
      planStartDate: now,
      active: true,
    });
  };

  const handleAcceptLink = async () => {
    if (!linkResult || !member?.id) return;
    setLoading(true);
    try {
      await acceptInvite(linkResult.trainerId, linkResult.inviteId, linkResult.planEndDate ?? null);
      setLinkResult(null);
      setLinkInput('');
      Alert.alert('✅ Connected!', 'You are now connected with ' + linkResult.trainerName + '. Your workout plan will appear shortly.');
    } catch (e) {
      Alert.alert('Error', 'Failed to accept invite. Please try again.');
    } finally { setLoading(false); }
  };

  const handleRespondInvite = async (invite, accept) => {
    setLoading(true);
    try {
      if (accept) {
        await acceptInvite(invite.trainerId, invite.id, invite.planEndDate ?? null);
        Alert.alert('✅ Connected!', 'You are now connected with ' + invite.trainerName + '.');
      } else {
        await updateDoc(doc(db, 'trainerInvites', invite.id), { status: 'rejected', rejectedAt: Date.now() });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to process invite.');
    } finally { setLoading(false); }
  };

  return (
    <View>
      <Text style={g.sec}>Trainer Invites</Text>
      <View style={ti.card}>
        <View style={ti.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={ti.toggleLabel}>Accept Trainer Invites</Text>
            <Text style={ti.toggleSub}>
              {invitesEnabled ? 'Trainers can find and invite you' : 'Turn on to receive trainer invites'}
            </Text>
          </View>
          <TouchableOpacity style={[ti.toggle, invitesEnabled && ti.toggleOn]} onPress={handleToggle} activeOpacity={0.8}>
            <View style={[ti.toggleKnob, invitesEnabled && ti.toggleKnobOn]} />
          </TouchableOpacity>
        </View>

        {pendingInvites.length > 0 && (
          <View>
            <View style={ti.divider} />
            <Text style={ti.pendingTitle}>Pending Invites</Text>
            {pendingInvites.map(invite => (
              <View key={invite.id} style={ti.inviteCard}>
                <View style={ti.inviteAvatar}>
                  <Text style={ti.inviteAvatarText}>{(invite.trainerName ?? 'T')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ti.inviteName}>{invite.trainerName}</Text>
                  <Text style={ti.inviteSub}>{invite.monthlyFee ? '₹' + invite.monthlyFee + '/month' : 'Training invite'}</Text>
                </View>
                <View style={ti.inviteActions}>
                  <TouchableOpacity style={[ti.inviteBtn, ti.rejectBtn]} onPress={() => handleRespondInvite(invite, false)} disabled={loading}>
                    <Text style={ti.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[ti.inviteBtn, ti.acceptBtn]} onPress={() => handleRespondInvite(invite, true)} disabled={loading}>
                    <Text style={ti.acceptBtnText}>{loading ? '…' : 'Accept'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={ti.divider} />
        <Text style={ti.linkTitle}>Have an invite link?</Text>
        <Text style={ti.linkSub}>{invitesEnabled ? 'Paste the link or code your trainer shared' : 'Turn on invites above, then paste your trainer\'s link'}</Text>
        <View style={ti.linkRow}>
          <TextInput
            style={[ti.linkInput, !invitesEnabled && ti.inputDisabled]}
            placeholder={invitesEnabled ? 'Paste invite link or code…' : 'Enable invites above first'}
            placeholderTextColor={C.mid}
            value={linkInput}
            onChangeText={setLinkInput}
            editable={invitesEnabled}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[ti.goBtn, (!invitesEnabled || !linkInput.trim()) && ti.goBtnDisabled]}
            onPress={handleLinkLookup}
            disabled={!invitesEnabled || !linkInput.trim() || linkLoading}>
            <Text style={ti.goBtnText}>{linkLoading ? '…' : 'Go'}</Text>
          </TouchableOpacity>
        </View>

        {linkResult && (
          <View style={ti.resultCard}>
            <View style={ti.inviteAvatar}>
              <Text style={ti.inviteAvatarText}>{(linkResult.trainerName ?? 'T')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ti.inviteName}>{linkResult.trainerName}</Text>
              <Text style={ti.inviteSub}>{linkResult.monthlyFee ? '₹' + linkResult.monthlyFee + '/month' : 'Personal Trainer'}</Text>
            </View>
            <View style={ti.inviteActions}>
              <TouchableOpacity style={[ti.inviteBtn, ti.rejectBtn]} onPress={() => { setLinkResult(null); setLinkInput(''); }} disabled={loading}>
                <Text style={ti.rejectBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ti.inviteBtn, ti.acceptBtn]} onPress={handleAcceptLink} disabled={loading}>
                <Text style={ti.acceptBtnText}>{loading ? '…' : 'Accept'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const useTiStyles = makeStyles((t) => StyleSheet.create({
  card:           { backgroundColor: t.surface.default, borderRadius: 14, padding: 16, elevation: 1, borderWidth: 1, borderColor: t.border.default },
  toggleRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel:    { fontSize: 15, fontWeight: '700', color: t.text.primary },
  toggleSub:      { fontSize: 12, color: t.text.secondary, marginTop: 2 },
  toggle:         { width: 50, height: 28, borderRadius: 14, backgroundColor: t.border.default, justifyContent: 'center', padding: 3 },
  toggleOn:       { backgroundColor: t.brand[600] },
  toggleKnob:     { width: 22, height: 22, borderRadius: 11, backgroundColor: t.surface.default },
  toggleKnobOn:   { alignSelf: 'flex-end' },
  divider:        { height: 1, backgroundColor: t.border.default, marginVertical: 14 },
  pendingTitle:   { fontSize: 11, fontWeight: '700', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  inviteCard:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.success[50], borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: t.success[200] },
  resultCard:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.brand[50], borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: t.brand[200] },
  inviteAvatar:   { width: 40, height: 40, borderRadius: 20, backgroundColor: t.brand[600], alignItems: 'center', justifyContent: 'center' },
  inviteAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  inviteName:     { fontSize: 14, fontWeight: '700', color: t.text.primary },
  inviteSub:      { fontSize: 12, color: t.text.secondary, marginTop: 2 },
  inviteActions:  { flexDirection: 'row', gap: 6 },
  inviteBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  acceptBtn:      { backgroundColor: t.brand[600] },
  acceptBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  rejectBtn:      { backgroundColor: t.surface.sunken },
  rejectBtnText:  { color: t.text.secondary, fontWeight: '600', fontSize: 13 },
  linkTitle:      { fontSize: 14, fontWeight: '700', color: t.text.primary, marginBottom: 3 },
  linkSub:        { fontSize: 12, color: t.text.secondary, marginBottom: 10 },
  linkRow:        { flexDirection: 'row', gap: 8 },
  linkInput:      { flex: 1, backgroundColor: t.surface.sunken, borderRadius: 10, padding: 12, fontSize: 14, color: t.text.primary, borderWidth: 1, borderColor: t.border.default },
  inputDisabled:  { opacity: 0.5 },
  goBtn:          { backgroundColor: t.brand[600], borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, justifyContent: 'center' },
  goBtnDisabled:  { backgroundColor: t.border.default },
  goBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
}));


// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — ProfileScreen COMPLETE REPLACEMENT
// Fixes:
//   #1  Trainer info section shows trainer name immediately after accept
//   #2  Tap trainer name → TrainerDetailModal with basic info
//   #3  Remove Trainer option → unlinks trainer, clears workouts, disables chat
//   #4  Chat disabled when no trainer
// ─────────────────────────────────────────────────────────────────────────────
// In App.js:
//   1. Find the entire ProfileScreen function (starts with
//      "function ProfileScreen({ member, onLogout, onTrainerChat, onUpdateMember })")
//   2. Delete everything from that line to its closing "}"
//      (stop BEFORE "const pf = StyleSheet.create")
//   3. Paste this entire block in its place
// ─────────────────────────────────────────────────────────────────────────────

function ProfileScreen({ member, onLogout, onTrainerChat, onUpdateMember, onRegisterSuccess }) {
  const C = usePalette();
  const g = useGlobalStyles();
  const pf = usePfStyles();
  const [showMembership, setShowMembership] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [draft, setDraft] = useState({
    name: member?.name || '',
    phone: member?.phone || '',
    height: String(member?.height || ''),
    weight: String(member?.weight || ''),
    goalWeight: String(member?.goalWeight || ''),
  });
  const [trainerDetail, setTrainerDetail] = useState(null);
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [removingTrainer, setRemovingTrainer] = useState(false);

  const editableFields = [
    { key: '👤 Name', field: 'name', keyboard: 'default', suffix: '' },
    { key: '📱 Phone', field: 'phone', keyboard: 'phone-pad', suffix: '' },
    { key: '📏 Height', field: 'height', keyboard: 'decimal-pad', suffix: ' cm' },
    { key: '⚖️ Current Weight', field: 'weight', keyboard: 'decimal-pad', suffix: ' kg' },
    { key: '🎯 Goal Weight', field: 'goalWeight', keyboard: 'decimal-pad', suffix: ' kg' },
  ];

  const handleConfirm = async (field) => {
    setEditingField(null);
    const numericFields = ['height', 'weight', 'goalWeight'];
    const val = numericFields.includes(field)
      ? parseFloat(draft[field]) || member?.[field]
      : draft[field];
    if (member?.id) {
      await updateMember(member.id, { [field]: val }).catch(() => {});
    }
    onUpdateMember({ [field]: val });
  };

  // Load trainer details when tapping trainer name
  const handleViewTrainer = async () => {
    if (!member?.trainerId) return;
    try {
      const snap = await getDoc(doc(db, 'trainers', member.trainerId));
      if (snap.exists()) {
        setTrainerDetail(snap.data());
        setShowTrainerModal(true);
      }
    } catch (e) {
      console.log('Trainer detail error:', e);
    }
  };

  // Remove trainer — unlinks everything immediately
  const handleRemoveTrainer = () => {
    Alert.alert(
      'Remove Trainer',
      'Are you sure you want to remove your trainer? Your workout plan will be cleared and chat will be disabled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Trainer', style: 'destructive',
          onPress: async () => {
            setRemovingTrainer(true);
            try {
              if (!member?.id) return;
              // Clear trainer link and workout plan from member record
              await updateDoc(doc(db, 'members', member.id), {
                trainerId: null,
                trainerName: null,
                gymId: null,
                currentPlanId: null,
                currentPlanName: null,
                planEndDate: 0,
                removedTrainerAt: Date.now(),
              });

              // Clear assignment so workouts disappear immediately
              if (member.gymId || member.trainerId) {
                const ns = member.gymId || member.trainerId;
                await updateDoc(
                  doc(db, 'gyms', ns, 'assignments', member.id),
                  { planId: null, planName: null, days: [], updatedAt: Date.now() }
                ).catch(() => {});
              }

              // Update local state immediately
              onUpdateMember({
                trainerId: null,
                trainerName: null,
                gymId: null,
                currentPlanId: null,
                currentPlanName: null,
              });

              Alert.alert('Trainer Removed', 'Your trainer has been unlinked. You can connect with a new trainer anytime from this section.');
            } catch (e) {
              Alert.alert('Error', 'Failed to remove trainer. Please try again.');
            } finally {
              setRemovingTrainer(false);
            }
          },
        },
      ]
    );
  };

  const daysLeft = member ? daysUntilExpiry(member) : 0;
  const hasTrainer = !!(member?.trainerId);

  return (
    <ScrollView style={g.screen}>
      <View style={pf.header}>
        <View style={pf.avatar}>
          <Text style={pf.avatarTxt}>{(member?.name || '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={pf.name}>{member?.name || 'Member'}</Text>
        <View style={pf.memberTag}><Text style={pf.memberTagTxt}>Gym Member</Text></View>
      </View>

      <Text style={g.sec}>My Details</Text>
      {editableFields.map(({ key, field, keyboard, suffix }) => {
        const isEditing = editingField === field;
        return (
          <View key={field} style={pf.row}>
            <Text style={pf.rowKey}>{key}</Text>
            <View style={pf.editWrapper}>
              {isEditing ? (
                <TextInput
                  style={pf.inlineInput}
                  value={draft[field]}
                  onChangeText={val => setDraft(prev => ({ ...prev, [field]: val }))}
                  keyboardType={keyboard}
                  autoFocus
                  onBlur={() => handleConfirm(field)}
                  onSubmitEditing={() => handleConfirm(field)}
                />
              ) : (
                <Text style={pf.rowVal}>{draft[field]}{draft[field] ? suffix : '—'}</Text>
              )}
              <TouchableOpacity
                style={pf.editBtn}
                onPress={() => isEditing ? handleConfirm(field) : setEditingField(field)}>
                <Text style={pf.editBtnTxt}>{isEditing ? '✓' : '✏️'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* ── Appearance ───────────────────────────────────────────────── */}
      <ThemeToggle style={{ marginBottom: 8 }} />

      <Text style={g.sec}>Account</Text>
      <View style={pf.memberCard}>
        <Text style={pf.planName}>📱 Register / Sync Member Data</Text>
        <Text style={pf.planSub}>Link your phone with OTP to sync profile, workout history, and all member data.</Text>
        <TouchableOpacity
          style={[pf.logoutBtn, { marginTop: 10, marginBottom: 0, backgroundColor: C.primary }]}
          onPress={() => setShowRegisterModal(true)}
        >
          <Text style={[pf.logoutTxt, { color: '#fff' }]}>Open Registration</Text>
        </TouchableOpacity>
      </View>

      {/* ── Trainer Section ─────────────────────────────────────────────── */}
      <Text style={g.sec}>Trainer</Text>
      {hasTrainer ? (
        <View>
          {/* Trainer info card — tap to view details */}
          <TouchableOpacity style={pf.trainerCard} onPress={handleViewTrainer} activeOpacity={0.85}>
            <View style={pf.trainerAvatar}>
              <Text style={pf.trainerAvatarText}>
                {(member?.trainerName || member?.trainer || 'T')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pf.trainerName}>
                {member?.trainerName || member?.trainer || 'Your Trainer'}
              </Text>
              <Text style={pf.trainerSub}>Tap to view trainer profile</Text>
            </View>
            <Text style={{ color: C.primary, fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          {/* Chat button */}
          <TouchableOpacity style={pf.trainerChatCard} onPress={onTrainerChat}>
            <Text style={{ fontSize: 24 }}>💬</Text>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={pf.trainerChatTitle}>Chat with your trainer</Text>
              <Text style={pf.trainerChatSub}>Send messages & voice notes</Text>
            </View>
            <View style={pf.onlineBadge}><Text style={pf.onlineTxt}>● Online</Text></View>
          </TouchableOpacity>

          {/* Remove trainer */}
          <TouchableOpacity
            style={pf.removeTrainerBtn}
            onPress={handleRemoveTrainer}
            disabled={removingTrainer}>
            <Text style={pf.removeTrainerTxt}>
              {removingTrainer ? 'Removing…' : '✕ Remove Trainer'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={pf.noTrainerCard}>
          <Text style={{ fontSize: 32 }}>🏋️</Text>
          <Text style={pf.noTrainerTitle}>No trainer connected</Text>
          <Text style={pf.noTrainerSub}>
            Use the Trainer Invites section below to connect with a trainer
          </Text>
        </View>
      )}

      {/* ── Trainer Invites ──────────────────────────────────────────────── */}
      <TrainerInviteSection member={member} onTrainerLinked={onUpdateMember} />

      {/* ── Membership ──────────────────────────────────────────────────── */}
      {(member?.trainerId || member?.gymId) && member?.planEndDate > 0 && (
        <>
          <Text style={g.sec}>Membership</Text>
          {member?.trainerId && (
            <TouchableOpacity style={pf.memberCard} onPress={() => setShowMembership(true)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={pf.planName}>
                    {member?.gymId ? '🏋️ Personal Training' : '🏋️ Training Plan'}
                  </Text>
                  <Text style={pf.planSub}>Valid until {formatDate(member.planEndDate)} · {daysLeft} days left</Text>
                </View>
                <Text style={{ color: C.mid, fontSize: 18 }}>›</Text>
              </View>
            </TouchableOpacity>
          )}
          {member?.gymId && !member?.trainerId && (
            <TouchableOpacity style={pf.memberCard} onPress={() => setShowMembership(true)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={pf.planName}>🏛 Gym Membership</Text>
                  <Text style={pf.planSub}>Valid until {formatDate(member.planEndDate)} · {daysLeft} days left</Text>
                </View>
                <Text style={{ color: C.mid, fontSize: 18 }}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}

      <TouchableOpacity style={pf.logoutBtn} onPress={onLogout}>
        <Text style={pf.logoutTxt}>Log Out</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />

      {/* ── Trainer Detail Modal ─────────────────────────────────────────── */}
      <Modal
        visible={showTrainerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTrainerModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={pf.modalHeader}>
            <TouchableOpacity onPress={() => setShowTrainerModal(false)}>
              <Text style={{ color: C.primary, fontSize: 15 }}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={pf.modalTitle}>Trainer Profile</Text>
            <View style={{ width: 60 }} />
          </View>

          {trainerDetail ? (
            <ScrollView style={{ padding: 20 }}>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={pf.trainerModalAvatar}>
                  <Text style={pf.trainerModalAvatarText}>
                    {(trainerDetail.fullName || trainerDetail.name || 'T')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={pf.trainerModalName}>
                  {trainerDetail.fullName || trainerDetail.name || 'Trainer'}
                </Text>
                {trainerDetail.isLifeVerified && (
                  <View style={pf.verifiedBadge}>
                    <Text style={pf.verifiedText}>✓ Lift Verified</Text>
                  </View>
                )}
              </View>

              {[
                { label: '📱 Phone', value: trainerDetail.phone },
                { label: '🎂 Age', value: trainerDetail.age ? `${trainerDetail.age} yrs` : null },
                { label: '⚥ Gender', value: trainerDetail.gender },
                { label: '💼 Experience', value: trainerDetail.yearsOfExperience ? `${trainerDetail.yearsOfExperience} years` : null },
                { label: '🏛 Gym', value: trainerDetail.gymName },
              ].filter(f => f.value).map(({ label, value }) => (
                <View key={label} style={pf.modalRow}>
                  <Text style={pf.modalRowKey}>{label}</Text>
                  <Text style={pf.modalRowVal}>{value}</Text>
                </View>
              ))}

              {trainerDetail.specializations?.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={pf.modalSectionTitle}>Specializations</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {trainerDetail.specializations.map(s => (
                      <View key={s} style={pf.specChip}>
                        <Text style={pf.specChipText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {trainerDetail.bio ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={pf.modalSectionTitle}>About</Text>
                  <Text style={pf.modalBio}>{trainerDetail.bio}</Text>
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={C.primary} />
            </View>
          )}
        </SafeAreaView>
      </Modal>
      <MembershipDetailModal visible={showMembership} onClose={() => setShowMembership(false)} member={member} />

      <ProfileRegisterModal
        visible={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onRegistered={(memberId) => {
          setShowRegisterModal(false);
          onRegisterSuccess?.(memberId);
        }}
      />
    </ScrollView>
  );
}
const usePfStyles = makeStyles((t) => StyleSheet.create({
  trainerCard: { backgroundColor: t.surface.default, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: t.brand[600], marginBottom: 8 },
  trainerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.brand[600], alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  trainerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  trainerName: { fontSize: 16, fontWeight: '700', color: t.text.primary },
  trainerSub: { fontSize: 12, color: t.text.secondary, marginTop: 2 },
  trainerChatCard: { backgroundColor: t.surface.default, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: t.border.default, marginBottom: 8 },
  trainerChatTitle: { fontSize: 15, fontWeight: '700', color: t.text.primary },
  trainerChatSub: { fontSize: 12, color: t.text.secondary, marginTop: 3 },
  onlineBadge: { backgroundColor: t.mode === 'dark' ? 'rgba(34,197,94,0.18)' : t.success[50], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  onlineTxt: { color: t.success[600], fontSize: 12, fontWeight: '700' },
  removeTrainerBtn: { backgroundColor: t.mode === 'dark' ? 'rgba(244,63,94,0.12)' : t.danger[50], borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 4 },
  removeTrainerTxt: { color: t.danger[600], fontWeight: '600', fontSize: 14 },
  noTrainerCard: { backgroundColor: t.surface.default, borderRadius: 14, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: t.border.default },
  noTrainerTitle: { fontSize: 16, fontWeight: '700', color: t.text.primary },
  noTrainerSub: { fontSize: 13, color: t.text.secondary, textAlign: 'center', lineHeight: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: t.border.default },
  modalTitle: { fontSize: 17, fontWeight: '700', color: t.text.primary },
  trainerModalAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: t.brand[600], alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  trainerModalAvatarText: { color: '#fff', fontWeight: '800', fontSize: 32 },
  trainerModalName: { fontSize: 22, fontWeight: '800', color: t.text.primary },
  verifiedBadge: { backgroundColor: t.mode === 'dark' ? 'rgba(34,197,94,0.18)' : t.success[50], borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 6 },
  verifiedText: { color: t.success[600], fontSize: 12, fontWeight: '700' },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: t.surface.default, padding: 14, marginBottom: 1, borderRadius: 2 },
  modalRowKey: { fontSize: 14, color: t.text.secondary },
  modalRowVal: { fontSize: 14, fontWeight: '600', color: t.text.primary },
  modalSectionTitle: { fontSize: 13, fontWeight: '700', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  specChip: { backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.18)' : t.brand[50], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  specChipText: { color: t.brand[600], fontSize: 13, fontWeight: '600' },
  modalBio: { fontSize: 14, color: t.text.primary, lineHeight: 22, marginTop: 8 },
  header: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: t.brand[600], alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTxt: { fontSize: 34, fontWeight: '800', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: t.text.primary },
  memberTag: { backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.18)' : t.brand[50], borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 6 },
  memberTagTxt: { color: t.brand[600], fontSize: 12, fontWeight: '600' },
  row: { backgroundColor: t.surface.default, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 1, borderRadius: 2 },
  rowKey: { fontSize: 14, color: t.text.secondary, flex: 1 },
  rowVal: { fontSize: 14, fontWeight: '600', color: t.text.primary },
  editWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput: { fontSize: 14, fontWeight: '600', color: t.text.primary, borderBottomWidth: 1.5, borderBottomColor: t.brand[600], paddingVertical: 2, paddingHorizontal: 4, minWidth: 80, textAlign: 'right' },
  editBtn: { padding: 4 },
  editBtnTxt: { fontSize: 14 },
  trainerChatCard: { backgroundColor: t.surface.default, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: t.border.default },
  trainerChatTitle: { fontSize: 15, fontWeight: '700', color: t.text.primary },
  trainerChatSub: { fontSize: 12, color: t.text.secondary, marginTop: 3 },
  onlineBadge: { backgroundColor: t.mode === 'dark' ? 'rgba(34,197,94,0.18)' : t.success[50], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  onlineTxt: { color: t.success[600], fontSize: 12, fontWeight: '700' },
  memberCard: { backgroundColor: t.surface.default, borderRadius: 14, padding: 18, elevation: 1 },
  planName: { fontSize: 17, fontWeight: '700', color: t.text.primary },
  planSub: { fontSize: 13, color: t.text.secondary, marginTop: 4 },
  logoutBtn: { backgroundColor: t.mode === 'dark' ? 'rgba(244,63,94,0.12)' : t.danger[50], borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 24 },
  logoutTxt: { color: t.danger[600], fontWeight: '700', fontSize: 16 },
}));

// ── GLOBAL STYLES ─────────────────────────────────────────────────────────────
// App-wide page chrome. Token-driven so every Profile/Notification/Invites-style
// screen renders with the same spacing rhythm and typography as the web app.
//   • screen: 16 pt horizontal pad + 16 pt top pad (matches web --spacing-page-x)
//   • screenNoPad: used by screens (HomeScreen) that manage their own padding
//   • pageTitle: 30 pt display heading with -0.5 tracking (web .text-heading-1)
//   • sec: uppercase 11 pt label with 1.2 letter-spacing (web .text-label)
// makeStyles factory — rebuilt on every theme change via useGlobalStyles()
const useGlobalStyles = makeStyles((t) => StyleSheet.create({
  screen:      { flex: 1, backgroundColor: t.surface.raised, paddingHorizontal: t.spacing.pageX, paddingTop: t.spacing.pageY },
  screenNoPad: { flex: 1, backgroundColor: t.surface.raised },
  pageTitle:   { fontSize: t.fontSize['3xl'], fontWeight: '800', color: t.text.primary, letterSpacing: -0.5, marginBottom: t.spacing[5], marginTop: t.spacing[1] },
  sec:         { fontSize: 11, fontWeight: '700', color: t.text.tertiary, marginTop: t.spacing[5], marginBottom: t.spacing[3], letterSpacing: 1.2, textTransform: 'uppercase' },
}));
// Frozen fallback for non-reactive contexts (modals, one-off screens)
const g = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: theme.surface.raised, paddingHorizontal: theme.spacing.pageX, paddingTop: theme.spacing.pageY },
  screenNoPad: { flex: 1, backgroundColor: theme.surface.raised },
  pageTitle:   { fontSize: theme.fontSize['3xl'], fontWeight: '800', color: theme.text.primary, letterSpacing: -0.5, marginBottom: theme.spacing[5], marginTop: theme.spacing[1] },
  sec:         { fontSize: 11, fontWeight: '700', color: theme.text.tertiary, marginTop: theme.spacing[5], marginBottom: theme.spacing[3], letterSpacing: 1.2, textTransform: 'uppercase' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SwipeBackScreen — left-edge swipe gesture to navigate back.
//
//   Matches the native iOS/Android back-swipe interaction:
//   • Touch must START within the first EDGE_PX (28 px) from the left edge.
//     This prevents conflicts with ScrollViews, TextInputs, and inner pickers.
//   • Movement must be primarily rightward (|dx|>|dy|×1.5) and at least 6 px.
//   • Release past THRESHOLD (38% of width) OR with velocity > 0.5 → navigate.
//   • Otherwise spring back to center.
//
//   Uses useNativeDriver:true for 60fps transform — no JS thread involvement
//   during the drag. The parent View's background shows through as the screen
//   slides right, giving a natural depth cue without rendering a fake backdrop.
//
//   Wraps only the "child" screens that have an onBack:
//     notifications / trainerChat / workoutFinish / workoutHistory
//   The main tab view is NOT wrapped (no back action + SwipeableSetRow conflict).
// ─────────────────────────────────────────────────────────────────────────────
function SwipeBackScreen({ children, onBack, enabled = true }) {
  const SCREEN_W  = Dimensions.get('window').width;
  const EDGE_PX   = 28;               // px from LEFT edge that activates gesture
  const THRESHOLD = SCREEN_W * 0.38;  // drag this far → commit navigation

  const translateX = useRef(new Animated.Value(0)).current;
  const startX     = useRef(0);       // touch-start X, sampled on every touch-down

  const pan = useRef(PanResponder.create({
    // ── Touch START — record position but do NOT claim the touch. ─────────────
    // Returning false lets child components (buttons, inputs, lists) receive
    // the tap normally. We only record startX so the MOVE phase can check it.
    onStartShouldSetPanResponder: (e) => {
      startX.current = e.nativeEvent.pageX;
      return false;
    },
    onStartShouldSetPanResponderCapture: () => false,

    // ── Touch MOVE — claim the gesture iff three conditions are met: ──────────
    //   1. Touch started within the left-edge zone
    //   2. Moving rightward (dx > 0) by at least 6 px
    //   3. Mostly horizontal (not a vertical scroll)
    onMoveShouldSetPanResponder: (_, g) =>
      enabled                               &&
      startX.current <= EDGE_PX             &&
      g.dx > 6                              &&
      Math.abs(g.dx) > Math.abs(g.dy) * 1.5,

    // Never capture — inner PanResponders (SwipeableSetRow) are unaffected
    onMoveShouldSetPanResponderCapture: () => false,

    // ── Track finger position — only allow rightward movement ─────────────────
    onPanResponderMove: (_, g) => {
      translateX.setValue(Math.max(0, g.dx));
    },

    // ── Release — decide: commit navigation or snap back ─────────────────────
    onPanResponderRelease: (_, g) => {
      if (g.dx >= THRESHOLD || g.vx > 0.5) {
        // Fast flick or dragged far enough → fly off screen then navigate
        Animated.timing(translateX, {
          toValue: SCREEN_W,
          duration: 180,
          useNativeDriver: true,
        }).start(() => {
          translateX.setValue(0); // reset so next visit starts at 0
          onBack?.();
        });
      } else {
        // Not far/fast enough → spring back to resting position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 180,
          friction: 12,
        }).start();
      }
    },

    // Gesture cancelled externally (e.g. phone call, another modal) → reset
    onPanResponderTerminate: () => {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
  })).current;

  return (
    // The parent View's bg (#000) is briefly visible as the screen slides away —
    // this gives a natural "depth" illusion without needing to render the
    // previous screen (which isn't in the React tree at this point).
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Animated.View
        {...pan.panHandlers}
        style={{ flex: 1, transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ── WORKOUT FINISH SCREEN ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// ConfettiLayer — pure-RN particle celebration, no external library.
//   55 particles (mix of circles + rectangles) fall from the top of the screen
//   with rotation and staggered delays. Uses native driver (GPU) for 60fps.
//   pointerEvents="none" so the scroll/buttons beneath remain fully interactive.
// ═══════════════════════════════════════════════════════════════════════════════
function ConfettiLayer() {
  const { width, height } = Dimensions.get('window');

  // Brand + accent colors — vivid so they pop on both light and dark backgrounds
  const COLORS = [
    '#4f46e5', '#818cf8',   // brand indigo
    '#22c55e', '#4ade80',   // success green
    '#f59e0b', '#fbbf24',   // warning gold
    '#f43f5e', '#fb7185',   // danger rose
    '#a855f7', '#c084fc',   // accent violet
    '#06b6d4', '#22d3ee',   // info cyan
  ];

  // Build stable particle configs (useMemo prevents recreation on re-render)
  const particles = React.useMemo(() =>
    Array.from({ length: 55 }, (_, i) => ({
      startX:   Math.random() * width,
      startY:   -20 - Math.random() * 80,
      color:    COLORS[i % COLORS.length],
      size:     5 + Math.random() * 7,
      isCircle: Math.random() > 0.45,
      duration: 2400 + Math.random() * 1800,
      delay:    Math.random() * 1400,
      animY:    new Animated.Value(0),
      animR:    new Animated.Value(0),
      animO:    new Animated.Value(1),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  useEffect(() => {
    const anims = particles.map(p =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          // Fall the full screen height
          Animated.timing(p.animY, { toValue: 1, duration: p.duration, useNativeDriver: true }),
          // Spin 2-3 full rotations
          Animated.timing(p.animR, { toValue: 1, duration: p.duration, useNativeDriver: true }),
          // Fade out in the bottom third
          Animated.sequence([
            Animated.delay(p.duration * 0.65),
            Animated.timing(p.animO, { toValue: 0, duration: p.duration * 0.35, useNativeDriver: true }),
          ]),
        ]),
      ])
    );
    Animated.parallel(anims).start();
    return () => anims.forEach(a => a.stop?.());
  }, [particles]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {particles.map((p, i) => {
        const translateY = p.animY.interpolate({
          inputRange: [0, 1],
          outputRange: [p.startY, p.startY + height + 100],
        });
        const rotate = p.animR.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${540 + Math.random() * 360}deg`],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.startX,
              top: 0,
              width: p.size,
              height: p.isCircle ? p.size : p.size * 1.6,
              borderRadius: p.isCircle ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: p.animO,
              transform: [{ translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WorkoutFinishScreen — premium post-workout summary.
//
//   Sections:
//     1. Confetti celebration (absolute, pointerEvents none)
//     2. Hero: success ring + trophy + workout name + date
//     3. XP earned (volume-based gamification, display only)
//     4. Stats 2×2 grid: Total Volume · Duration · Exercises · Total Sets
//     5. Motivational quote (performance-adaptive)
//     6. Muscles worked chips
//     7. Exercise breakdown list
//     8. Action row: Share · Log Notes · View Progress
//     9. "Save & Close" primary CTA
//
//   Design: web `.card` geometry (radius-xl, shadow-card, brand-600 accents),
//   dark mode via usePalette(), `tabular-nums` on all numbers.
// ═══════════════════════════════════════════════════════════════════════════════
function WorkoutFinishScreen({ data, member, memberName, onBack, onViewHistory, onViewProgress }) {
  const C  = usePalette();
  const wf = useWfStyles();
  const t  = C._theme;
  const [showNotes,    setShowNotes]    = useState(false);
  const [notes,        setNotes]        = useState('');
  // Video modal — same ExerciseVideoModal used in WorkoutsScreen
  const [videoExName,  setVideoExName]  = useState(null);

  // ── Derived stats ────────────────────────────────────────────────────────
  const exs = data?.exercises || [];
  const exerciseCount = data?.exerciseCount || exs.length;
  const totalSets = exs.reduce((a, e) => a + (e.actualSets || e.targetSets || 0), 0);

  // Total volume (kg): Σ weight × reps × sets
  const totalVolume = exs.reduce((sum, ex) => {
    const w = parseFloat(ex.weight) || 0;
    const r = parseInt(ex.actualReps ?? ex.targetReps, 10) || 0;
    const s = ex.actualSets || ex.targetSets || 0;
    return sum + w * r * s;
  }, 0);

  const muscles = [...new Set(exs.map(e => e.muscleGroup).filter(Boolean))];

  const durationMins = Math.round((data?.durationSeconds || 0) / 60);
  const durationDisplay = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
    : `${durationMins}m`;

  // ── XP calculation (display only — no backend) ───────────────────────────
  const xpBase      = 100;
  const xpExercises = exerciseCount * 20;
  const xpSets      = totalSets * 5;
  const xpVolume    = Math.min(150, Math.floor(totalVolume / 500) * 10);
  const xpTotal     = xpBase + xpExercises + xpSets + xpVolume;
  const xpLevel     = Math.floor(xpTotal / 100);

  // ── Motivational message ─────────────────────────────────────────────────
  const motivate = () => {
    if (totalVolume > 8000) return { title: 'Absolute beast! 🔥', sub: 'That volume is elite-level. Your body will thank you tomorrow.' };
    if (durationMins > 70)  return { title: 'Iron will! ⚡', sub: 'Over an hour of grinding. Mental strength is real strength.' };
    if (exerciseCount >= 7) return { title: 'Full-body warrior! 💪', sub: 'Covered every angle. That\'s how champions train.' };
    if (totalSets >= 20)    return { title: 'Set machine! 🏆', sub: `${totalSets} sets completed — consistency builds legends.` };
    const defaults = [
      { title: 'Crushed it! 🎯',   sub: 'Every rep counts. Showing up is the hardest part — you did it.' },
      { title: 'Stronger today! ✨', sub: 'Progress isn\'t always visible, but it\'s always real.' },
      { title: 'Well done! 🙌',    sub: 'Another session in the bank. Your future self is grateful.' },
    ];
    return defaults[Math.floor(Date.now() / 86400000) % defaults.length];
  };
  const { title: motivTitle, sub: motivSub } = motivate();

  // ── Share text ───────────────────────────────────────────────────────────
  const handleShare = async () => {
    const vol = totalVolume > 0 ? `${Math.round(totalVolume).toLocaleString()} kg volume · ` : '';
    const txt = [
      '🏋️ Workout complete!',
      '━━━━━━━━━━━━━━━',
      `${data?.planName || 'Workout'}${data?.dayLabel ? ` · ${data.dayLabel}` : ''}`,
      `⏱ ${durationDisplay} · ${vol}${exerciseCount} exercises · ${totalSets} sets`,
      '',
      '💪 via LIFT Fitness App',
    ].join('\n');
    try { await Share.share({ message: txt }); } catch (_) {}
  };

  // ── Celebration ring animation (scale in) ────────────────────────────────
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(ringScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [ringScale, ringOpacity]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Confetti — absolute, non-blocking ── */}
      <ConfettiLayer />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={wf.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero: ring + trophy + headline ── */}
          <View style={wf.hero}>
            <Animated.View style={{ transform: [{ scale: ringScale }], opacity: ringOpacity }}>
              <WorkoutProgressRing
                progress={1}
                size={108}
                stroke={8}
                color={t.success[500]}
                trackColor={t.success[100]}
              >
                <Ionicons name="trophy" size={38} color={t.success[600]} />
              </WorkoutProgressRing>
            </Animated.View>

            <Text style={[wf.headline, { color: C.dark }]}>Workout Complete!</Text>
            <Text style={[wf.subline, { color: C.mid }]}>{motivTitle}</Text>

            {(data?.planName || data?.dayLabel) ? (
              <View style={[wf.planChip, { backgroundColor: C.blue2 }]}>
                <Text style={[wf.planChipTxt, { color: C.primary }]}>
                  {[data.planName, data.dayLabel].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ) : null}

            <Text style={[wf.date, { color: C.muted }]}>
              {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>

          {/* ── XP Earned banner ── */}
          <View style={[wf.xpBanner, { backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.15)' : t.brand[50], borderColor: t.mode === 'dark' ? 'rgba(99,102,241,0.3)' : t.brand[100] }]}>
            <View style={wf.xpLeft}>
              <Text style={[wf.xpLabel, { color: C.muted }]}>XP EARNED</Text>
              <Text style={[wf.xpValue, { color: C.primary }]}>+{xpTotal}</Text>
            </View>
            <View style={[wf.xpDivider, { backgroundColor: C.border }]} />
            <View style={wf.xpRight}>
              <Text style={[wf.xpLabel, { color: C.muted }]}>SESSION LEVEL</Text>
              <Text style={[wf.xpValue, { color: C.primary }]}>Lv.{xpLevel}</Text>
            </View>
            <View style={wf.xpBarWrap}>
              <View style={[wf.xpBarTrack, { backgroundColor: C.border }]}>
                <View style={[wf.xpBarFill, {
                  width: `${(xpTotal % 100)}%`,
                  backgroundColor: C.primary,
                }]} />
              </View>
              <Text style={[wf.xpBarTxt, { color: C.muted }]}>{xpTotal % 100}/100 to Lv.{xpLevel + 1}</Text>
            </View>
          </View>

          {/* ── Stats 2×2 grid ── */}
          <View style={wf.statsGrid}>
            {[
              { icon: 'barbell-outline',        color: C.primary,        val: totalVolume > 0 ? String(Math.round(totalVolume).toLocaleString()) : '—', unit: totalVolume > 0 ? 'kg' : '', lbl: 'Total Volume' },
              { icon: 'time-outline',            color: C.green,          val: durationDisplay,              unit: '',   lbl: 'Duration' },
              { icon: 'fitness-outline',         color: t.warning[600],   val: String(exerciseCount),        unit: '',   lbl: 'Exercises' },
              { icon: 'checkmark-circle-outline',color: t.success[600],   val: String(totalSets),            unit: '',   lbl: 'Sets Done' },
            ].map((s, i) => (
              <View key={i} style={[wf.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={[wf.statIcon, { backgroundColor: s.color + '15' }]}>
                  <Ionicons name={s.icon} size={18} color={s.color} />
                </View>
                <View style={wf.statValRow}>
                  <Text style={[wf.statVal, { color: C.dark }]}>{s.val}</Text>
                  {s.unit ? <Text style={[wf.statUnit, { color: C.muted }]}>{s.unit}</Text> : null}
                </View>
                <Text style={[wf.statLbl, { color: C.muted }]}>{s.lbl}</Text>
              </View>
            ))}
          </View>

          {/* ── Motivational quote card ── */}
          <View style={[wf.quoteCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[wf.quoteAccent, { backgroundColor: C.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={[wf.quoteTitle, { color: C.dark }]}>{motivTitle}</Text>
              <Text style={[wf.quoteSub, { color: C.mid }]}>{motivSub}</Text>
            </View>
          </View>

          {/* ── Muscles worked ── */}
          {muscles.length > 0 && (
            <View style={[wf.section, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[wf.sectionLabel, { color: C.muted }]}>MUSCLES WORKED</Text>
              <View style={wf.chips}>
                {muscles.map(m => (
                  <View key={m} style={[wf.chip, { backgroundColor: C.blue2 }]}>
                    <Text style={[wf.chipTxt, { color: C.primary }]}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Exercise breakdown ── */}
          {/* Each exercise is its own card — matches the pre-workout exercise list style.
              No outer grey wrapper so there are no "white boxes inside grey boxes". */}
          {exs.length > 0 && (
            <>
              <Text style={[wf.sectionLabel, { color: C.muted, alignSelf: 'flex-start', marginBottom: 8 }]}>
                SESSION BREAKDOWN
              </Text>
              {exs.map((ex, i) => {
                const w   = parseFloat(ex.weight) || 0;
                const vol = w > 0
                  ? `${Math.round(w * (parseInt(ex.actualReps ?? ex.targetReps, 10) || 0) * (ex.actualSets || ex.targetSets || 0))} kg`
                  : null;
                const hasVideo = !!ex.videoUrl;
                return (
                  /* Individual card per exercise — same look as pre-workout exCardStatic */
                  <View key={i} style={[wf.exCard, { backgroundColor: C.card, borderColor: C.border }]}>
                    {/* YouTube / done indicator */}
                    {hasVideo ? (
                      <TouchableOpacity
                        style={wf.ytChip}
                        onPress={() => setVideoExName({ name: ex.exerciseName || ex.name, videoUrl: ex.videoUrl })}
                        hitSlop={6}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                      </TouchableOpacity>
                    ) : (
                      <View style={wf.exDoneDot}>
                        <Ionicons name="checkmark" size={11} color={C.green} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[wf.exName, { color: C.dark }]} numberOfLines={1}>
                        {ex.exerciseName || ex.name}
                      </Text>
                      <Text style={[wf.exMeta, { color: C.muted }]}>
                        {ex.actualSets || ex.targetSets} sets
                        {' · '}{ex.actualReps || ex.targetReps} reps
                        {w > 0 ? `  ·  ${w} kg` : ''}
                      </Text>
                    </View>
                    {vol && (
                      <View style={[wf.volChip, { backgroundColor: C.blue2 }]}>
                        <Text style={[wf.volChipTxt, { color: C.primary }]}>{vol}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* ── Action buttons ── */}
          <View style={wf.actionRow}>
            <TouchableOpacity
              style={[wf.actionBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={20} color={C.primary} />
              <Text style={[wf.actionBtnTxt, { color: C.primary }]}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[wf.actionBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setShowNotes(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={20} color={C.primary} />
              <Text style={[wf.actionBtnTxt, { color: C.primary }]}>Notes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[wf.actionBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={onViewProgress}
              activeOpacity={0.8}
            >
              <Ionicons name="trending-up-outline" size={20} color={C.primary} />
              <Text style={[wf.actionBtnTxt, { color: C.primary }]}>Progress</Text>
            </TouchableOpacity>
          </View>

          {/* ── Save & Close primary CTA ── */}
          <TouchableOpacity
            style={[wf.saveBtn, { backgroundColor: C.green, borderColor: t.success[700] }]}
            onPress={onBack}
            activeOpacity={0.88}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={wf.saveBtnTxt}>Save & Close</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onViewHistory} style={wf.histLink}>
            <Ionicons name="time-outline" size={14} color={C.mid} />
            <Text style={[wf.histLinkTxt, { color: C.mid }]}>View full workout history</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Log Notes modal ── */}
      <Modal
        visible={showNotes}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotes(false)}
      >
        <View style={[wf.notesBackdrop]}>
          <View style={[wf.notesSheet, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={wf.notesHandle} />
            <Text style={[wf.notesTitle, { color: C.dark }]}>Session Notes</Text>
            <Text style={[wf.notesSub, { color: C.mid }]}>How did this session feel? Any PRs or form cues?</Text>
            <TextInput
              style={[wf.notesInput, { backgroundColor: C.sunken, borderColor: C.border, color: C.dark }]}
              multiline
              placeholder="e.g. Felt strong on bench. Left shoulder tight on overhead press."
              placeholderTextColor={C.muted}
              value={notes}
              onChangeText={setNotes}
              maxLength={500}
              textAlignVertical="top"
              autoFocus
            />
            <View style={wf.notesBtnRow}>
              <TouchableOpacity
                style={[wf.notesCancelBtn, { backgroundColor: C.light, borderColor: C.border }]}
                onPress={() => setShowNotes(false)}
              >
                <Text style={[wf.notesCancelTxt, { color: C.mid }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[wf.notesSaveBtn, { backgroundColor: C.primary, borderColor: t.brand[700] }]}
                onPress={() => setShowNotes(false)}
              >
                <Text style={wf.notesSaveTxt}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reference video modal — same component used in WorkoutsScreen */}
      <ExerciseVideoModal
        visible={!!videoExName}
        exerciseName={videoExName?.name}
        videoUrl={videoExName?.videoUrl}
        onClose={() => setVideoExName(null)}
      />
    </View>
  );
}

// makeStyles for WorkoutFinishScreen — theme-reactive
const useWfStyles = makeStyles((t) => StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },

  /* ── Hero ── */
  hero: { alignItems: 'center', paddingTop: 16, paddingBottom: 24, width: '100%' },
  headline: {
    fontSize: 30, fontWeight: '800', letterSpacing: -0.6,
    marginTop: 20, textAlign: 'center',
  },
  subline: { fontSize: 16, fontWeight: '500', marginTop: 6, textAlign: 'center' },
  planChip: {
    borderRadius: t.radius.full,
    paddingHorizontal: 14, paddingVertical: 5,
    marginTop: 10,
  },
  planChipTxt: { fontSize: 13, fontWeight: '600', letterSpacing: -0.1 },
  date: { fontSize: 12, marginTop: 8, letterSpacing: 0.2 },

  /* ── XP banner ── */
  xpBanner: {
    width: '100%',
    borderRadius: t.radius.xl,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  xpLeft:  { alignItems: 'center', flex: 1 },
  xpRight: { alignItems: 'center', flex: 1 },
  xpDivider: { width: 1, height: 40 },
  xpLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  xpValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  xpBarWrap: { width: '100%', marginTop: 2 },
  xpBarTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  xpBarFill: { height: '100%', borderRadius: 2 },
  xpBarTxt: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  /* ── Stats 2×2 grid ── */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  statCard: {
    width: '47.5%',
    borderRadius: t.radius.xl,
    padding: 14,
    borderWidth: 1,
    ...t.shadow.card,
  },
  statIcon: {
    width: 34, height: 34,
    borderRadius: t.radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  statValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statVal:  { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 12, fontWeight: '600' },
  statLbl:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },

  /* ── Motivational quote ── */
  quoteCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.radius.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    gap: 12,
    ...t.shadow.card,
    overflow: 'hidden',
  },
  quoteAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  quoteTitle:  { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  quoteSub:    { fontSize: 13, marginTop: 4, lineHeight: 18 },

  /* ── Generic section card ── */
  section: {
    width: '100%',
    borderRadius: t.radius.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    ...t.shadow.card,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 12,
  },

  /* ── Muscles chips ── */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: t.radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  chipTxt: { fontSize: 12, fontWeight: '600' },

  /* ── Exercise row (legacy, kept for safety) ── */
  exRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingVertical: 10,
  },
  /* ── Standalone exercise card — matches pre-workout exCardStatic ── */
  exCard: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12,
    borderRadius: t.radius.xl,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    width: '100%',
    ...t.shadow.card,
  },
  // Legacy badge — kept but replaced by ytChip / exDoneDot in JSX
  exBadge: {
    width: 28, height: 28, borderRadius: t.radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  // YouTube chip for post-workout review.
  // Slightly smaller than the pre-workout chip to suit the tighter summary list.
  // Icon floats directly on the summary card — no background
  ytChip: {
    width: 36, height: 36, borderRadius: t.radius.sm,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  // Fallback for exercises with no stored videoUrl.
  // Minimal green circle — quieter than the old solid checkmark badge.
  exDoneDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(22,163,74,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  exName: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  exMeta: { fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  volChip: { borderRadius: t.radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  volChipTxt: { fontSize: 11, fontWeight: '700' },

  /* ── Action buttons row ── */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: t.radius.xl,
    borderWidth: 1,
    ...t.shadow.card,
    minHeight: 64,
  },
  actionBtnTxt: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },

  /* ── Save & Close CTA ── */
  saveBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    minHeight: 54,
    ...t.shadow.success,
    marginBottom: 12,
  },
  saveBtnTxt: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.1 },

  histLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10,
  },
  histLinkTxt: { fontSize: 13, fontWeight: '600' },

  /* ── Notes modal ── */
  notesBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  notesSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    padding: 24, paddingTop: 16,
  },
  notesHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#d4d4d4',
    alignSelf: 'center', marginBottom: 18,
  },
  notesTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6 },
  notesSub:   { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  notesInput: {
    borderWidth: 1.5, borderRadius: 12,
    padding: 14, fontSize: 15,
    minHeight: 120, marginBottom: 20,
  },
  notesBtnRow: { flexDirection: 'row', gap: 10 },
  notesCancelBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', borderWidth: 1,
  },
  notesCancelTxt: { fontSize: 15, fontWeight: '600' },
  notesSaveBtn: {
    flex: 1.4, paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', borderWidth: 1,
  },
  notesSaveTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
}));

// ── WORKOUT HISTORY SCREEN ─────────────────────────────────────────────────────
function WorkoutHistoryScreen({ member, memberId, onBack }) {
  const gymOrTrainer = member?.gymId || member?.trainerId;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!gymOrTrainer || !memberId) { setLoading(false); return; }
    const { collection: col, query: qFn, where: whr, orderBy, getDocs } = require('firebase/firestore');
    const { db: fdb } = require('./shared/firebase/config');
    // Note: only one where() + orderBy() to avoid requiring a composite Firestore index.
    // status === 'completed' is filtered client-side.
    const qr = qFn(
      col(fdb, 'gyms', gymOrTrainer, 'workoutLogs'),
      whr('memberId', '==', memberId),
      orderBy('completedAt', 'desc')
    );
    getDocs(qr).then(snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(all.filter(l => l.status === 'completed' || !l.status));
      setLoading(false);
    }).catch(e => { console.log('WorkoutHistory query error:', e); setLoading(false); });
  }, [gymOrTrainer, memberId]);

  const formatDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };
  const formatDur = (secs) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    return m > 0 ? `${m} min` : `${secs}s`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={wh.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color: C.primary, fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={wh.headerTitle}>Workout History</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView style={{ padding: 16 }}>
        {loading && <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />}
        {!loading && logs.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="barbell-outline" size={48} color={C.light} />
            <Text style={{ fontSize: 16, color: C.mid, marginTop: 12 }}>No workouts logged yet.</Text>
            <Text style={{ fontSize: 13, color: C.mid, marginTop: 4 }}>Finish your first workout to see it here!</Text>
          </View>
        )}
        {logs.map(log => {
          const isOpen = expanded === log.id;
          const exercises = log.completedExercises || log.exerciseLogs || [];
          const exCount = exercises.length;
          return (
            <TouchableOpacity
              key={log.id}
              style={[wh.card, isOpen && wh.cardOpen]}
              onPress={() => setExpanded(isOpen ? null : log.id)}
              activeOpacity={0.8}
            >
              <View style={wh.cardHeader}>
                <View style={wh.greenDot} />
                <View style={{ flex: 1 }}>
                  <Text style={wh.cardTitle}>{log.planName || 'Workout'}{log.dayLabel ? ` · ${log.dayLabel}` : ''}</Text>
                  <Text style={wh.cardDate}>{formatDate(log.completedAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={wh.cardDur}>{formatDur(log.durationSeconds)}</Text>
                  <Text style={{ fontSize: 11, color: C.mid }}>{exCount} ex</Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.mid} style={{ marginLeft: 4 }} />
              </View>
              {isOpen && exercises.length > 0 && (
                <View style={wh.exList}>
                  {exercises.map((ex, i) => (
                    <View key={i} style={wh.exRow}>
                      <View style={wh.exBadge}><Text style={wh.exBadgeTxt}>{i + 1}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={wh.exName}>{ex.exerciseName || ex.name}</Text>
                        <Text style={wh.exMeta}>
                          {(ex.targetSets || ex.actualSets || (ex.sets?.length))} sets
                          {ex.weight > 0 ? ` · ${ex.weight} kg` : ''}
                          {ex.muscleGroup ? ` · ${ex.muscleGroup}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const wh = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.light, backgroundColor: C.card },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.dark },
  card: { backgroundColor: C.card, borderRadius: 14, marginBottom: 12, padding: 16, borderWidth: 1, borderColor: C.light, elevation: 1 },
  cardOpen: { borderColor: C.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  cardDate: { fontSize: 12, color: C.mid, marginTop: 2 },
  cardDur: { fontSize: 14, fontWeight: '700', color: C.primary },
  exList: { borderTopWidth: 1, borderTopColor: C.light, marginTop: 12, paddingTop: 12, gap: 8 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  exBadgeTxt: { fontSize: 11, fontWeight: '700', color: C.primary },
  exName: { fontSize: 14, fontWeight: '600', color: C.dark },
  exMeta: { fontSize: 11, color: C.mid, marginTop: 1 },
});

// ── Theme provider (wraps the entire tree) ───────────────────────────────────
import { ThemeProvider } from './LIFT_PROJECT/theme/ThemeProvider';

// ── MAIN APP ──────────────────────────────────────────────────────────────────
// Root default export wraps the app body with the ThemeProvider so every
// screen below it can call useTheme(). The inner <AppBody/> holds the real
// navigation/auth state — same logic as before, just decoupled for the wrap.
export default function App() {
  return (
    <ThemeProvider>
      <AppBody />
    </ThemeProvider>
  );
}

function AppBody() {
  const [screen, setScreen] = useState('splash');
  const [tab, setTab] = useState('Home');
  const [uid, setUid] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Notification channels + permission (once on app start) ────────────────
  useEffect(() => {
    const setup = async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('supplements', {
          name: 'Supplement Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }
      await Notifications.requestPermissionsAsync();
    };
    setup().catch(() => {});
  }, []);

  // ── Android hardware back button ───────────────────────────────────────────
  // Mirrors the SwipeBackScreen gesture: on any non-main screen, pressing the
  // Android back button returns to main instead of exiting the app.
  // On the main screen, we return false so Android handles it (minimize/exit).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const childScreens = ['notifications', 'trainerChat', 'workoutFinish', 'workoutHistory'];
      if (childScreens.includes(screen)) {
        setScreen('main');
        return true; // consumed — prevent default (exit)
      }
      return false;  // not consumed — let Android minimize/exit
    });
    return () => sub.remove();
  }, [screen]);

  // Real data from Firestore
  const [member, setMember] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [planWeek, setPlanWeek] = useState(null); // built from clientPlan days
  const [fullPlan, setFullPlan] = useState(null); // full plan with all days & exercises
  const [activeWorkoutLog, setActiveWorkoutLog] = useState(null); // real-time sync with trainer
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Workout timer
  const [workoutTimer, setWorkoutTimer] = useState({ running: false, elapsed: 0, completed: false });
  const [workoutDoneSets, setWorkoutDoneSets] = useState({});
  const [workoutSetWeights, setWorkoutSetWeights] = useState({});
  const [workoutRestEndTimes, setWorkoutRestEndTimes] = useState({});
  const [autoStartWorkout, setAutoStartWorkout] = useState(false);
  const [workoutFinishData, setWorkoutFinishData] = useState(null);
  const [restDays, setRestDaysState] = useState({});
  const timerRef = useRef(null);
  const planUnsubRef = useRef(null); // nested plan onSnapshot cleanup
  const sessionRestoredRef = useRef(false);

  // ── Persist workout session to AsyncStorage ─────────────────────────────────
  const SESS_KEY = 'lift_active_session';

  const saveSession = async (data) => {
    try { await AsyncStorage.setItem(SESS_KEY, JSON.stringify(data)); } catch (_) {}
  };
  const clearSession = async () => {
    try { await AsyncStorage.removeItem(SESS_KEY); } catch (_) {}
  };

  // Save session whenever key workout state changes
  useEffect(() => {
    if (!sessionRestoredRef.current) return; // don't save before restore completes
    if (!workoutTimer.running && !workoutTimer.completed && workoutTimer.elapsed === 0) {
      // No active workout — clear any stale session
      clearSession();
      return;
    }
    saveSession({
      timer: workoutTimer,
      startedAt: Date.now() - (workoutTimer.elapsed * 1000),
      doneSets: workoutDoneSets,
      setWeights: workoutSetWeights,
    });
  }, [workoutTimer, workoutDoneSets, workoutSetWeights]);

  // Restore session on app launch
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESS_KEY);
        if (raw) {
          const sess = JSON.parse(raw);
          // Clear stale sessions from previous calendar days
          const sessDay = new Date(sess.startedAt).toDateString();
          const todayDay = new Date().toDateString();
          if (sessDay !== todayDay) {
            await AsyncStorage.removeItem(SESS_KEY);
          } else if (sess.timer && !sess.timer.completed) {
            // Compute how much time has passed since the session was saved
            const realElapsed = Math.floor((Date.now() - sess.startedAt) / 1000);
            setWorkoutTimer({ running: true, elapsed: realElapsed, completed: false });
            setWorkoutDoneSets(sess.doneSets || {});
            setWorkoutSetWeights(sess.setWeights || {});
            // Resume the ticking interval
            const resumeAt = Date.now();
            timerRef.current = setInterval(() => {
              setWorkoutTimer(prev => prev.running
                ? { ...prev, elapsed: realElapsed + Math.floor((Date.now() - resumeAt) / 1000) }
                : prev
              );
            }, 1000);
          } else if (sess.timer?.completed) {
            setWorkoutTimer(sess.timer);
            setWorkoutDoneSets(sess.doneSets || {});
            setWorkoutSetWeights(sess.setWeights || {});
          }
        }
      } catch (_) {}
      sessionRestoredRef.current = true;
    })();
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(MEMBER_SESSION_KEY);
        if (!active) return;
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.memberId) setUid(saved.memberId);
      } catch (_) {}
      if (!active) return;
      setScreen('main');
      setAuthLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // ── Load rest days from storage on app startup ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.restDays);
        if (raw) {
          const saved = JSON.parse(raw);
          setRestDaysState(saved);
        }
      } catch (_) {}
    })();
  }, []);

  // ── Save rest days to storage whenever they change ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.restDays, JSON.stringify(restDays));
      } catch (_) {}
    })();
  }, [restDays]);

  // ── Member profile listener ─────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToMember(uid, (m) => {
      setMember(m);
      if (!m) {
        clearMemberSession();
        setAssignment(null);
        setTodayWorkout(null);
        setPlanWeek(null);
        setFullPlan(null);
        setUid(null);
        setScreen('main');
      }
    });
    return () => unsub();
  }, [uid]);

  // ── Notifications unread count ──────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const { subscribeToUnreadNotifCount } = require('./shared/services/notification.service');
    const unsub = subscribeToUnreadNotifCount(uid, setUnreadNotifCount);
    return () => unsub();
  }, [uid]);

  // ── Workout assignment listener ─────────────────────────────────────────────
  // Uses nested onSnapshot on the plan so any change (e.g. postpone) auto-refreshes
  useEffect(() => {
    const gymOrTrainer = member?.gymId || member?.trainerId;
    if (!gymOrTrainer || !uid) return;

    const applyPlan = (plan) => {
      setFullPlan(plan);
      const PLAN_DAY_ABBRS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const todayPlanIdx = (new Date().getDay() + 6) % 7;
      const todayDateStr = new Date().toISOString().split('T')[0];
      // If the trainer updated the plan AFTER the member postponed, the postponement
      // is stale — the new plan should show as a regular workout day.
      // plan.updatedAt (trainer write) vs postponedOn date (member write, no updatedAt bump).
      const postponedDateMs = plan.postponedOn ? new Date(plan.postponedOn).getTime() : 0;
      const postponementOverriddenByTrainer = !!plan.postponedOn && (plan.updatedAt || 0) > postponedDateMs;
      if (postponementOverriddenByTrainer) {
        // Silently clear the stale fields from Firestore so this check isn't repeated
        updateDoc(doc(db, 'gyms', gymOrTrainer, 'clientPlans', plan.id), {
          postponedOn: deleteField(), postponedDayIdx: deleteField(),
        }).catch(() => {});
      }
      const postponedToday = !postponementOverriddenByTrainer && plan.postponedOn === todayDateStr && plan.postponedDayIdx === todayPlanIdx;

      // Build week view: 7 slots centred on today (offset −3 … +3)
      if (plan.days?.length) {
        const todayDate = new Date();
        const wp = Array.from({ length: 7 }, (_, displayIdx) => {
          const offset = displayIdx - 3; // today always at display index 3
          const cardDate = new Date(todayDate);
          cardDate.setDate(todayDate.getDate() + offset);
          const planIdx = (cardDate.getDay() + 6) % 7;
          const d = plan.days[planIdx] || {};
          const isPostponed = !postponementOverriddenByTrainer && plan.postponedOn === todayDateStr && plan.postponedDayIdx === planIdx;
          return {
            day: PLAN_DAY_ABBRS[planIdx] || '?',
            date: `${cardDate.getDate()} ${MONTH_SHORT[cardDate.getMonth()]}`,
            label: d.dayLabel || '',
            rest: !!d.restDay || isPostponed,
            exerciseCount: d.exercises?.length || 0,
            planIdx,
            isToday: offset === 0,
          };
        });
        setPlanWeek(wp);
      }

      // Today's workout
      const todayDay = plan.days?.[todayPlanIdx];
      const todayLabel = todayDay?.dayLabel ||
        ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
      if (postponedToday) {
        setTodayWorkout({ id: 'rest', name: 'Rest Day', isRestDay: true, exercises: [] });
      } else if (todayDay && !todayDay.restDay && todayDay.exercises?.length > 0) {
        const exercises = todayDay.exercises.map(ex => ({
          id:                  ex.id || ex.name,
          name:                ex.name,
          sets:                ex.mainSets || 3,
          trackingType:        ex.trackingType || 'reps',
          reps:                ex.mainReps || 10,
          repsMax:             ex.mainRepsMax || null,
          durationSeconds:     ex.mainDurationSeconds || null,
          durationSecondsMax:  ex.mainDurationSecondsMax || null,
          rest:                ex.mainRestSeconds || 60,
          warmupSets:          ex.warmupSets || 0,
          supersetGroup:       ex.supersetGroup      || null,
          circuitId:           ex.circuitId          || null,
          circuitRounds:       ex.circuitRounds      || null,
          circuitRestSeconds:  ex.circuitRestSeconds || null,
          note:                ex.notes || '',
          muscleGroup:         ex.muscleGroup || '',
          videoUrl:            ex.videoUrl || '',
        }));
        const estSecs = exercises.reduce((acc, ex) => acc + ex.sets * (45 + ex.rest), 0);
        setTodayWorkout({
          id: plan.id,
          name: plan.name || "Today's Workout",
          estimatedMinutes: Math.max(10, Math.round(estSecs / 60)),
          exercises,
          dayLabel: todayLabel,
        });
        if (todayDay.completedAt) {
          const c = new Date(todayDay.completedAt);
          const now = new Date();
          if (c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth() && c.getDate() === now.getDate()) {
            const allDoneSets = {};
            exercises.forEach(ex => { for (let s = 1; s <= ex.sets; s++) allDoneSets[`${ex.id}_${s}`] = true; });
            setWorkoutDoneSets(allDoneSets);
            setWorkoutTimer({ running: false, elapsed: todayDay.durationSeconds || 0, completed: true });
          }
        }
      } else if (todayDay?.restDay) {
        setTodayWorkout({ id: 'rest', name: 'Rest Day', isRestDay: true, exercises: [] });
      } else {
        setTodayWorkout(null);
      }
    };

    // Use the gym-created member doc ID when available (gymMemberId), because the
    // gym app writes assignments keyed by the Firestore auto-generated member ID.
    // Fall back to the Firebase Auth UID for members who haven't re-logged in yet.
    const assignDocId = member?.gymMemberId || uid;
    const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', assignDocId);
    const unsub = onSnapshot(assignRef, (snap) => {
      if (!snap.exists()) {
        setAssignment(null); setTodayWorkout(null); setPlanWeek(null); setFullPlan(null);
        if (planUnsubRef.current) { planUnsubRef.current(); planUnsubRef.current = null; }
        return;
      }
      const a = snap.data();
      setAssignment(a);
      // Cancel previous plan listener if planId changed
      if (planUnsubRef.current) { planUnsubRef.current(); planUnsubRef.current = null; }
      if (a?.planId) {
        const planRef = doc(db, 'gyms', gymOrTrainer, 'clientPlans', a.planId);
        planUnsubRef.current = onSnapshot(planRef, (planSnap) => {
          if (planSnap.exists()) {
            applyPlan(planSnap.data());
          } else {
            setTodayWorkout(null); setFullPlan(null);
          }
        }, e => { console.log('Plan listen error:', e); setTodayWorkout(null); setFullPlan(null); });
      } else {
        setTodayWorkout(null); setFullPlan(null);
      }
    });
    return () => { unsub(); if (planUnsubRef.current) { planUnsubRef.current(); planUnsubRef.current = null; } };
  }, [member?.gymId, member?.trainerId, uid]);

  // ── Active workout log listener (real-time sync with trainer edits) ─────────
  useEffect(() => {
    const gymOrTrainer = member?.gymId || member?.trainerId;
    if (!gymOrTrainer || !uid) return;
    // Listen for today's incomplete workout logs (trainer may start one)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, 'gyms', gymOrTrainer, 'workoutLogs'),
      where('memberId', '==', uid),
      where('status', '==', 'incomplete'),
    );
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) { setActiveWorkoutLog(null); return; }
      // Get the most recent incomplete log
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => (b.startedAt || b.completedAt || 0) - (a.startedAt || a.completedAt || 0));
      const latest = logs[0];
      // Only show if started today
      if (latest.startedAt && latest.startedAt >= todayStart.getTime()) {
        setActiveWorkoutLog(latest);
        // If trainer started this workout, sync exercises to todayWorkout format
        if (latest.startedBy === 'trainer' && latest.completedExercises?.length > 0) {
          // Apply trainer's exercise edits (weight, sets, reps, rest) to local state
          const wDone = {};
          const wWeights = {};
          latest.completedExercises.forEach(ex => {
            if (ex.completed) {
              for (let s = 1; s <= (ex.actualSets || 3); s++) {
                wDone[`${ex.exerciseId}_${s}`] = true;
              }
            }
            if (ex.weight > 0) {
              for (let s = 1; s <= (ex.actualSets || 3); s++) {
                wWeights[`${ex.exerciseId}_${s}`] = String(ex.weight);
              }
            }
          });
          setWorkoutDoneSets(prev => ({ ...prev, ...wDone }));
          setWorkoutSetWeights(prev => ({ ...prev, ...wWeights }));
        }
      } else {
        setActiveWorkoutLog(null);
      }
    });
    return () => unsub();
  }, [member?.gymId, member?.trainerId, uid]);

  // ── Derive todayWorkout from active trainer-started log when plan has no match ─
  useEffect(() => {
    if (todayWorkout) return; // plan already provided one
    if (!activeWorkoutLog) return;
    if (activeWorkoutLog.status !== 'incomplete') return;
    if (!activeWorkoutLog.completedExercises?.length) return;
    const exercises = activeWorkoutLog.completedExercises.map(ex => ({
      id: ex.exerciseId,
      name: ex.exerciseName,
      sets: ex.actualSets || ex.targetSets || 3,
      reps: ex.actualReps || ex.targetReps || 10,
      rest: ex.restSeconds || 60,
      note: ex.notes || '',
      muscleGroup: ex.muscleGroup || '',
    }));
    const estSecs = exercises.reduce((acc, ex) => acc + ex.sets * (45 + ex.rest), 0);
    const estimatedMinutes = Math.max(10, Math.round(estSecs / 60));
    setTodayWorkout({
      id: activeWorkoutLog.planId || activeWorkoutLog.id,
      name: activeWorkoutLog.planName || "Today's Workout",
      estimatedMinutes,
      exercises,
      dayLabel: activeWorkoutLog.dayLabel || new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    });
  }, [activeWorkoutLog, todayWorkout]);

  // ── Workout timer ───────────────────────────────────────────────────────────
  const startWorkoutTimer = () => {
    clearInterval(timerRef.current);
    const startTime = Date.now();
    setWorkoutTimer({ running: true, elapsed: 0, completed: false });
    timerRef.current = setInterval(() => {
      setWorkoutTimer(prev => prev.running
        ? { ...prev, elapsed: Math.floor((Date.now() - startTime) / 1000) }
        : prev
      );
    }, 1000);
  };

  const stopWorkoutTimer = (elapsed) => {
    clearInterval(timerRef.current);
    setWorkoutTimer({ running: false, elapsed, completed: true });
    clearSession();
  };

  const pauseWorkoutTimer = () => {
    clearInterval(timerRef.current);
    setWorkoutTimer(prev => ({ ...prev, running: false }));
  };

  const resumeWorkoutTimer = (fromElapsed) => {
    clearInterval(timerRef.current);
    const resumeAt = Date.now();
    setWorkoutTimer(prev => ({ ...prev, running: true }));
    timerRef.current = setInterval(() => {
      setWorkoutTimer(prev => prev.running
        ? { ...prev, elapsed: fromElapsed + Math.floor((Date.now() - resumeAt) / 1000) }
        : prev
      );
    }, 1000);
  };

  const handleLogout = async () => {
    await clearMemberSession();
    await auth.signOut().catch(() => {});
    setMember(null);
    setAssignment(null);
    setTodayWorkout(null);
    setPlanWeek(null);
    setFullPlan(null);
    setUid(null);
    setScreen('main');
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (screen === 'splash') {
    return <SplashScreen onDone={() => setScreen('loading')} />;
  }

  if (authLoading || screen === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: 6 }}>LIFT</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
      </View>
    );
  }

  if (screen === 'notifications') return (
    // SwipeBackScreen: left-edge swipe navigates back, hardware back button handled globally
    <SwipeBackScreen onBack={() => setScreen('main')}>
      <NotificationsScreen onBack={() => setScreen('main')} memberId={uid} />
    </SwipeBackScreen>
  );
  if (screen === 'trainerChat') return (
    <SwipeBackScreen onBack={() => setScreen('main')}>
      <TrainerChatScreen member={member} onBack={() => setScreen('main')} />
    </SwipeBackScreen>
  );
  if (screen === 'workoutFinish') return (
    <SwipeBackScreen onBack={() => { setScreen('main'); setTab('Workouts'); setWorkoutTimer({ running: false, elapsed: 0, completed: false }); setWorkoutDoneSets({}); setWorkoutSetWeights({}); }}>
      <WorkoutFinishScreen
        data={workoutFinishData}
        member={member}
        memberName={member?.name || 'there'}
        onBack={() => { setScreen('main'); setTab('Workouts'); setWorkoutTimer({ running: false, elapsed: 0, completed: false }); setWorkoutDoneSets({}); setWorkoutSetWeights({}); }}
        onViewHistory={() => setScreen('workoutHistory')}
        onViewProgress={() => { setScreen('main'); setTab('Progress'); }}
      />
    </SwipeBackScreen>
  );
  if (screen === 'workoutHistory') return (
    <SwipeBackScreen onBack={() => setScreen('main')}>
      <WorkoutHistoryScreen
        member={member}
        memberId={uid}
        onBack={() => setScreen('main')}
      />
    </SwipeBackScreen>
  );

  const tabs = [
    { name: 'Home',        icon: 'home',          iconOutline: 'home-outline' },
    { name: 'Workouts',    icon: 'barbell',        iconOutline: 'barbell-outline' },
    { name: 'Progress',    icon: 'trending-up',    iconOutline: 'trending-up-outline' },
    { name: 'Supplements', icon: 'flask',          iconOutline: 'flask-outline' },
    { name: 'Profile',     icon: 'person-circle',  iconOutline: 'person-circle-outline' },
  ];

  const renderTab = () => {
    switch (tab) {
      case 'Home':
        return (
          <HomeScreen
            member={member}
            workoutTimer={workoutTimer}
            assignment={assignment}
            todayWorkout={todayWorkout}
            fullPlan={fullPlan}
            unreadNotifCount={unreadNotifCount}
            onStartWorkout={() => {
              setAutoStartWorkout(true);
              setTab('Workouts');
            }}
            onNavigate={(dest) => {
              if (dest === 'Notifications') setScreen('notifications');
              else if (dest === 'TrainerChat') setScreen('trainerChat');
              else setTab(dest);
            }}
          />
        );
      case 'Workouts':
        return (
          <WorkoutsScreen
            member={member}
            assignment={assignment}
            planWeek={planWeek}
            fullPlan={fullPlan}
            todayWorkout={todayWorkout}
            setTodayWorkout={setTodayWorkout}
            activeWorkoutLog={activeWorkoutLog}
            workoutTimer={workoutTimer}
            startWorkoutTimer={startWorkoutTimer}
            stopWorkoutTimer={stopWorkoutTimer}
            pauseWorkoutTimer={pauseWorkoutTimer}
            resumeWorkoutTimer={resumeWorkoutTimer}
            workoutDoneSets={workoutDoneSets}
            setWorkoutDoneSets={setWorkoutDoneSets}
            workoutSetWeights={workoutSetWeights}
            setWorkoutSetWeights={setWorkoutSetWeights}
            restEndTimes={workoutRestEndTimes}
            setRestEndTimes={setWorkoutRestEndTimes}
            autoStartLogging={autoStartWorkout}
            setAutoStartLogging={setAutoStartWorkout}
            onWorkoutFinish={(data) => { setWorkoutFinishData(data); setScreen('workoutFinish'); }}
            onViewHistory={() => setScreen('workoutHistory')}
            restDays={restDays}
            setRestDays={setRestDaysState}
          />
        );
      case 'Progress':
        return (
          <ProgressScreen
            member={member}
            gymId={member?.gymId}
            memberId={uid}
          />
        );
      case 'Supplements':
        return <SupplementsScreen memberId={uid} />;
      case 'Profile':
        return (
          <ProfileScreen
            member={member}
            onLogout={handleLogout}
            onTrainerChat={() => setScreen('trainerChat')}
            onUpdateMember={(changes) => setMember(prev => ({ ...prev, ...changes }))}
            onRegisterSuccess={(memberId) => {
              setUid(memberId);
              setMember(null);
              setAssignment(null);
              setTodayWorkout(null);
              setPlanWeek(null);
              setFullPlan(null);
              setTab('Home');
              setScreen('main');
            }}
          />
        );
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ThemedSafeArea>
      <View style={{ flex: 1 }}>{renderTab()}</View>
      {!keyboardVisible && (
        <BottomTabBar tabs={tabs} activeTab={tab} onSelect={setTab} />
      )}
    </ThemedSafeArea>
    </KeyboardAvoidingView>
  );
}

// ThemedSafeArea — pulls bg color from the active theme so the safe-area
// insets match the dark surface instead of bleeding the old light C.bg color.
// ThemedSafeArea — global status-bar + safe-area handler.
//
//   iOS: SafeAreaView handles the notch/status-bar inset automatically.
//   Android: SafeAreaView from react-native does NOT add status-bar padding
//   unless the Activity theme sets windowTranslucentStatus. We add it
//   manually via StatusBar.currentHeight (available on Android only).
//   This keeps the fix in ONE place so every screen benefits without
//   individual SafeAreaView usage needing to change.
function ThemedSafeArea({ children }) {
  const { theme } = useTheme();
  // Android needs explicit status-bar padding; iOS SafeAreaView handles it.
  const statusBarPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.raised }}>
      {statusBarPad > 0 && <View style={{ height: statusBarPad, backgroundColor: theme.surface.raised }} />}
      {children}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BottomTabBar — ported from the web admin sidebar (src/components/Layout.jsx).
//
//   Web pattern per tab:
//     • 28 × 28 rounded-lg icon chip (brand-100 bg when active, transparent else)
//     • Icon inside chip is brand-600 when active, text-tertiary otherwise
//     • Label is brand-700 when active, text-secondary otherwise
//     • Tiny 6 px brand-500 active dot
//   Stroke-width bump: active items use slightly thicker icons to feel "solid".
//
//   Mobile adaptation:
//     • Icon chip grows to 34 × 34 for thumb-friendliness.
//     • Active pill: light brand-50 wash behind the chip+label row (web-equivalent
//       of the sidebar's nav-active pill) — brand-tinted but subtle.
//     • Selected icon scales 1 → 1.05 on activation via spring, per the "subtle
//       micro-interaction" brief.
//     • Pressable opacity dims to 0.6 while finger is down.
// ═══════════════════════════════════════════════════════════════════════════════
function BottomTabBar({ tabs, activeTab, onSelect }) {
  const mn = useTabBarStyles();
  return (
    <View style={mn.tabBar}>
      {tabs.map(t => (
        <BottomTabItem
          key={t.name}
          tab={t}
          active={activeTab === t.name}
          onPress={() => onSelect(t.name)}
        />
      ))}
    </View>
  );
}

function BottomTabItem({ tab, active, onPress }) {
  const { theme, resolved } = useTheme();
  const dark = resolved === 'dark';
  const mn = useTabBarStyles();

  const scale = useRef(new Animated.Value(active ? 1.05 : 1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1.05 : 1, useNativeDriver: true, friction: 7, tension: 140 }).start();
  }, [active, scale]);

  // Icon / label colors shift with mode. Web light: brand-600/700; dark: brand-400/300.
  const iconActive = theme.brand[dark ? 400 : 600];
  const iconIdle   = theme.text.tertiary;
  const labelActive = theme.brand[dark ? 300 : 700];
  const dotColor    = theme.brand[dark ? 400 : 500];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [mn.tabItem, pressed && { opacity: 0.6 }]}
      hitSlop={4}
    >
      {active && <View style={mn.tabActivePill} pointerEvents="none" />}
      <Animated.View
        style={[
          mn.tabIconChip,
          active && mn.tabIconChipActive,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name={active ? tab.icon : tab.iconOutline}
          size={20}
          color={active ? iconActive : iconIdle}
        />
      </Animated.View>
      <Text
        style={[mn.tabLbl, active && { color: labelActive, fontWeight: '700' }]}
        numberOfLines={1}
      >
        {tab.name}
      </Text>
      {active && <View style={[mn.tabActiveDot, { backgroundColor: dotColor }]} pointerEvents="none" />}
    </Pressable>
  );
}

// Theme-reactive stylesheet: rebuilt whenever theme changes via makeStyles().
const useTabBarStyles = makeStyles((t) => StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: t.surface.default,
    paddingTop: 8, paddingBottom: 24, paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: t.border.subtle,
    gap: 4,
    ...t.shadow.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: t.radius.lg,
    minHeight: 56,
    position: 'relative',
  },
  // Active pill — brand-50 on light; brand-900-tinted wash on dark.
  tabActivePill: {
    position: 'absolute',
    top: 2, bottom: 2, left: 8, right: 8,
    borderRadius: t.radius.lg,
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.12)' : t.brand[50],
  },
  tabIconChip: {
    width: 34, height: 34,
    borderRadius: t.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  // Icon chip fill when active: brand-100 on light, brand-900 tint on dark.
  tabIconChipActive: {
    backgroundColor: t.mode === 'dark' ? 'rgba(99,102,241,0.20)' : t.brand[100],
  },
  tabLbl: {
    fontSize: 10,
    color: t.text.tertiary,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  tabActiveDot: {
    position: 'absolute',
    top: 4,
    width: 4, height: 4, borderRadius: 2,
  },
}));