// ─────────────────────────────────────────────────────────────────────────────
// Lift Member App — App.js
// Firebase OTP Auth · Real-time Firestore · Live Chat · No dummy data
// ─────────────────────────────────────────────────────────────────────────────

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResizeMode, Video } from 'expo-av';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    AppState,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';

// ── Firebase ──────────────────────────────────────────────────────────────────
import { onAuthStateChanged, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
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

const { width } = Dimensions.get('window');

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  primary: '#1A56DB', bg: '#F8FAFF', card: '#FFFFFF',
  dark: '#111827', mid: '#6B7280', light: '#E5E7EB',
  green: '#10B981', amber: '#F59E0B', red: '#EF4444',
  blue2: '#EFF6FF', accent: '#1A56DB',
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
function WelcomeScreen({ onLogin }) {
  return (
    <View style={wl.container}>
      <View style={wl.top}>
        <Text style={wl.logo}>LIFT</Text>
        <Text style={wl.tagline}>Your fitness. Your gym.{'\n'}All in one place.</Text>
      </View>
      <View style={wl.bottom}>
        <TouchableOpacity style={wl.btnPrimary} onPress={onLogin}>
          <Text style={wl.btnPrimaryTxt}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={wl.btnSecondary} onPress={onLogin}>
          <Text style={wl.btnSecondaryTxt}>Log In</Text>
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

function OtpLoginScreen({ onSuccess }) {
  const phoneAuthRef = useRef(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationId, setVerificationId] = useState(null);
  const [webviewReady, setWebviewReady] = useState(false);

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
      console.log('OTP error:', e?.message);
      if (e?.message?.includes('too-many-requests') || e?.message?.includes('Too many')) {
        setError('Too many attempts. Please try again later.');
      } else if (e?.message?.includes('invalid-phone-number')) {
        setError('Invalid phone number format.');
      } else {
        setError(e?.message || 'Could not send OTP. Please try again.');
      }
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
        await setDoc(doc(db, 'members', uid), {
          id: uid,
          phone: `+91${phone}`,
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
      <PhoneAuthWebView ref={phoneAuthRef} onReady={setWebviewReady} />
      <Text style={ot.heading}>{step === 'phone' ? 'Welcome to Lift' : 'Verify OTP'}</Text>
      <Text style={ot.sub}>
        {step === 'phone'
          ? 'Enter your mobile number to continue'
          : `OTP sent to +91 ${phone}`}
      </Text>
      {!webviewReady && step === 'phone' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <ActivityIndicator size="small" color={C.primary} />
          <Text style={{ fontSize: 12, color: C.mid }}>Preparing secure verification…</Text>
        </View>
      )}

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

// ── HOME DASHBOARD ────────────────────────────────────────────────────────────
function HomeScreen({ onNavigate, member, workoutTimer, assignment, todayWorkout, fullPlan, unreadNotifCount, onStartWorkout }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
  const daysLeft = member ? daysUntilExpiry(member) : 0;
  const daysColor = daysLeft <= 7 ? C.red : daysLeft <= 30 ? C.amber : C.green;
  const bmi = member && member.height > 0
    ? (member.weight / ((member.height / 100) ** 2)).toFixed(1)
    : '—';

  // Plan name: prefer fullPlan.name, fallback to assignment.planName or member.currentPlanName
  const planName = fullPlan?.name || assignment?.planName || member?.currentPlanName || '';
  const hasPlan = !!(fullPlan || assignment?.planId || member?.currentPlanId);

  return (
    <ScrollView style={g.screen} showsVerticalScrollIndicator={false}>
      <View style={hm.header}>
        <View>
          <Text style={hm.greet}>{greet}, {member?.name?.split(' ')[0] || 'there'}! 👋</Text>
          <Text style={hm.date}>{new Date().toDateString()}</Text>
        </View>
        <TouchableOpacity style={hm.notifBtn} onPress={() => onNavigate('Notifications')}>
          <Ionicons name="notifications-outline" size={22} color={C.dark} />
          {unreadNotifCount > 0 && (
            <View style={hm.badge}><Text style={hm.badgeTxt}>{unreadNotifCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* Today's Workout Card */}
      {todayWorkout?.isRestDay ? (
        <TouchableOpacity style={[hm.workoutCard, { backgroundColor: '#374151' }]} onPress={() => onNavigate('Workouts')} activeOpacity={0.85}>
          {planName ? <Text style={hm.planNameTag}>{planName}</Text> : null}
          <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="moon-outline" size={22} color="#fff" />
            <Text style={hm.workoutName}>Rest Day</Text>
          </View>
          <Text style={hm.workoutSub}>Recovery is part of progress. Take it easy today.</Text>
          <View style={hm.startBtn}>
            <Text style={hm.startBtnTxt}>View Weekly Plan →</Text>
          </View>
        </TouchableOpacity>
      ) : todayWorkout ? (
        <TouchableOpacity style={hm.workoutCard} onPress={() => { if (onStartWorkout && !workoutTimer?.completed) onStartWorkout(); else onNavigate('Workouts'); }} activeOpacity={0.9}>
          <View style={hm.workoutTop}>
            <View>
              {planName ? <Text style={hm.planNameTag}>{planName}</Text> : null}
              <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={hm.workoutTime}>{todayWorkout.estimatedMinutes || '—'} min</Text>
            </View>
          </View>
          <Text style={hm.workoutName}>{todayWorkout.dayLabel || todayWorkout.name}</Text>
          {workoutTimer?.running && (
            <View style={hm.timerPill}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={12} color="#fff" />
                <Text style={hm.timerPillTxt}>{formatElapsed(workoutTimer.elapsed)} · In progress</Text>
              </View>
            </View>
          )}
          {workoutTimer?.completed && (
            <View style={[hm.timerPill, { backgroundColor: 'rgba(16,185,129,0.25)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle-outline" size={12} color="#fff" />
                <Text style={hm.timerPillTxt}>Done in {formatElapsed(workoutTimer.elapsed)}</Text>
              </View>
            </View>
          )}
          <Text style={hm.workoutSub}>
            {todayWorkout.exercises?.length || 0} exercises · {todayWorkout.exercises?.map(e => e.muscleGroup).filter((v, i, a) => v && a.indexOf(v) === i).join(', ') || 'Assigned by ' + (member?.trainerName || member?.trainer || 'your trainer')}
          </Text>
          {/* Direct Start Workout button — opens logging view immediately */}
          <TouchableOpacity
            style={[hm.startBtn, workoutTimer?.completed && { backgroundColor: 'rgba(16,185,129,0.35)' }]}
            onPress={() => {
              if (onStartWorkout && !workoutTimer?.completed) onStartWorkout();
              else onNavigate('Workouts');
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ionicons
                name={workoutTimer?.completed ? 'checkmark-circle-outline' : workoutTimer?.running ? 'time-outline' : 'play-circle-outline'}
                size={16} color="#fff"
              />
              <Text style={hm.startBtnTxt}>
                {workoutTimer?.running ? 'Continue Workout →' : workoutTimer?.completed ? 'View Completed →' : 'Start Workout →'}
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      ) : hasPlan ? (
        <TouchableOpacity style={[hm.workoutCard, { backgroundColor: '#1E40AF' }]} onPress={() => onNavigate('Workouts')} activeOpacity={0.85}>
          {planName ? <Text style={hm.planNameTag}>{planName}</Text> : null}
          <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={hm.workoutName}>No session today</Text>
          </View>
          <Text style={hm.workoutSub}>Tap to view your full weekly workout plan</Text>
          <View style={hm.startBtn}>
            <Text style={hm.startBtnTxt}>View Weekly Plan →</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[hm.workoutCard, { opacity: 0.7 }]}>
          <Text style={hm.workoutLabel}>TODAY'S WORKOUT</Text>
          <Text style={hm.workoutName}>{member?.trainerId ? 'No plan assigned yet' : 'No trainer assigned'}</Text>
          <Text style={hm.workoutSub}>{member?.trainerId ? 'Your trainer will assign a workout plan soon' : 'Accept a trainer invite in Profile'}</Text>
        </View>
      )}

      <Text style={g.sec}>Quick Stats</Text>
      <View style={hm.statsRow}>
        <View style={hm.statChip}>
          <Text style={hm.statVal}>{member?.weight ? `${member.weight} kg` : '—'}</Text>
          <Text style={hm.statLbl}>Weight</Text>
        </View>
        <View style={hm.statChip}>
          <Text style={hm.statVal}>{bmi}</Text>
          <Text style={hm.statLbl}>BMI</Text>
        </View>
        <View style={hm.statChip}>
          <Text style={hm.statVal}>{todayWorkout ? `${todayWorkout.exercises?.length || 0}` : '—'}</Text>
          <Text style={hm.statLbl}>Exercises</Text>
        </View>
      </View>

      {(member?.trainerId || member?.gymId) && member?.planEndDate > 0 && (
        <View>
          {member?.trainerId && (
            <View style={[hm.memberStrip, { borderLeftColor: daysColor }]}>
              <View>
                <Text style={hm.memberPlan}>
                  {member?.gymId ? 'Personal Training' : 'Training Plan'}
                </Text>
                <Text style={hm.memberSub}>Valid until {formatDate(member.planEndDate)}</Text>
              </View>
              <Text style={[hm.daysLeft, { color: daysColor }]}>{daysLeft}d</Text>
            </View>
          )}
          {member?.gymId && !member?.trainerId && (
            <View style={[hm.memberStrip, { borderLeftColor: C.primary }]}>
              <View>
                <Text style={hm.memberPlan}>Gym Membership</Text>
                <Text style={hm.memberSub}>Valid until {formatDate(member.planEndDate)}</Text>
              </View>
              <Text style={[hm.daysLeft, { color: C.primary }]}>{daysLeft}d</Text>
            </View>
          )}
        </View>
      )}

      <Text style={g.sec}>Your Trainer</Text>
      {member?.trainerId ? (
        <TouchableOpacity style={hm.trainerCard} onPress={() => onNavigate('TrainerChat')}>
          <Ionicons name="barbell-outline" size={28} color={C.primary} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={hm.trainerCardTitle}>Chat with {member?.trainerName || 'your trainer'}</Text>
            <Text style={hm.trainerCardSub}>Messages, voice notes & images</Text>
          </View>
          <View style={hm.onlineChip}><Text style={hm.onlineChipTxt}>● Online</Text></View>
        </TouchableOpacity>
      ) : (
        <View style={[hm.trainerCard, { opacity: 0.45 }]}>
          <Ionicons name="barbell-outline" size={28} color={C.primary} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={hm.trainerCardTitle}>No trainer assigned yet</Text>
            <Text style={hm.trainerCardSub}>Accept a trainer invite in Profile</Text>
          </View>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const hm = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 20 },
  greet: { fontSize: 22, fontWeight: '800', color: C.dark },
  date: { fontSize: 13, color: C.mid, marginTop: 2 },
  notifBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: C.red, borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
  workoutCard: { backgroundColor: C.primary, borderRadius: 18, padding: 20, marginBottom: 20 },
  workoutTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  planNameTag: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  workoutLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  workoutTime: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  workoutName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  timerPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 6 },
  timerPillTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },
  workoutSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 14 },
  startBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 12, alignItems: 'center' },
  startBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statChip: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', elevation: 1 },
  statVal: { fontSize: 18, fontWeight: '800', color: C.dark },
  statLbl: { fontSize: 11, color: C.mid, marginTop: 4 },
  memberStrip: { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, marginTop: 10 },
  memberPlan: { fontSize: 14, fontWeight: '700', color: C.dark },
  memberSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  daysLeft: { fontSize: 22, fontWeight: '800' },
  trainerCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: C.light },
  trainerCardTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  trainerCardSub: { fontSize: 12, color: C.mid, marginTop: 3 },
  onlineChip: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  onlineChipTxt: { color: C.green, fontSize: 12, fontWeight: '700' },
});

// ── EXERCISE VIDEO ────────────────────────────────────────────────────────────
function ExerciseVideo({ uri, exerciseName }) {
  const [visible, setVisible] = useState(false);
  if (!uri) return null;
  return (
    <>
      <TouchableOpacity style={ev.thumb} onPress={() => setVisible(true)}>
        <View style={ev.playIcon}><Text style={{ fontSize: 22 }}>▶️</Text></View>
        <Text style={ev.thumbTxt}>Watch {exerciseName}</Text>
      </TouchableOpacity>
      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity style={ev.closeBtn} onPress={() => setVisible(false)}>
            <Text style={ev.closeBtnTxt}>✕ Close</Text>
          </TouchableOpacity>
          <Video
            source={{ uri }}
            style={{ flex: 1 }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
          />
        </SafeAreaView>
      </Modal>
    </>
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
  thumb: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.blue2, borderRadius: 10, padding: 10, marginBottom: 10, gap: 10 },
  playIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  thumbTxt: { fontSize: 13, fontWeight: '600', color: C.primary },
  closeBtn: { padding: 16 },
  closeBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

// ── WORKOUT LOGGING VIEW ──────────────────────────────────────────────────────
function LoggingView({ exercises, onBack, memberName, workoutTimer, stopWorkoutTimer, gymId, memberId, workoutId, workoutName, todayWorkout, doneSets: doneSetsExternal, setDoneSetsExternal, setWeightsExternal, setSetWeightsExternal, restEndTimes, setRestEndTimes, activeWorkoutLogId }) {
  const [expanded, setExpanded] = useState(null);
  const [setWeights, setSetWeights] = useState(setWeightsExternal || {});
  const [lastWeights, setLastWeights] = useState({});
  const [doneSets, setDoneSets] = useState(doneSetsExternal || {});
  // restTimers: computed from restEndTimes each tick
  const [restTimers, setRestTimers] = useState({});
  const [allDone, setAllDone] = useState(!!workoutTimer?.completed);
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
      Array.from({ length: ex.sets }, (_, i) => `${ex.id}_${i + 1}`).every(k => newDone[k])
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
              actualSets: ex.sets,
              actualReps: String(ex.reps),
              weight: parseFloat(setWeights[`${ex.id}_1`] || lastWeights[`${ex.id}_1`] || '0'),
              restSeconds: ex.rest || 60,
              completed: true,
              notes: ex.note || '',
            })),
            // Legacy format for backward compat
            exerciseLogs: exercises.map(ex => ({
              exerciseId: ex.id,
              exerciseName: ex.name,
              sets: Array.from({ length: ex.sets }, (_, i) => ({
                setNo: i + 1,
                reps: ex.reps,
                weight: parseFloat(setWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
                done: true,
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

  const allSetsOf = (ex) =>
    Array.from({ length: ex.sets }, (_, i) => `${ex.id}_${i + 1}`).every(k => doneSets[k]);

  const doneCount = exercises.filter(ex => allSetsOf(ex)).length;
  const elapsed = workoutTimer?.elapsed || 0;
  const elapsedColor = allDone ? C.green : elapsed > 3600 ? C.red : elapsed > 1800 ? C.amber : C.green;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={lv.logHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color: C.primary, fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={lv.logTitle}>Workout Log</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={allDone ? 'checkmark-circle-outline' : 'time-outline'} size={14} color={elapsedColor} />
            <Text style={[lv.globalTimer, { color: elapsedColor }]}>{formatElapsed(elapsed)}</Text>
          </View>
        </View>
        <Text style={lv.logCount}>{doneCount}/{exercises.length}</Text>
      </View>

      <ScrollView style={{ padding: 16 }}>
        {exercises.map((ex) => {
          const isOpen = expanded === ex.id;
          const isDone = allSetsOf(ex);
          const doneSetsCount = Array.from({ length: ex.sets }, (_, i) => doneSets[`${ex.id}_${i + 1}`]).filter(Boolean).length;
          const isInProgress = doneSetsCount > 0 && !isDone;
          return (
            <View key={ex.id} style={[lv.exWrap, isDone && lv.exWrapDone, isInProgress && lv.exWrapActive]}>
              <TouchableOpacity style={lv.exHeader} onPress={() => setExpanded(isOpen ? null : ex.id)}>
                <View style={[lv.exCheck, isDone && lv.exCheckDone, isInProgress && lv.exCheckActive]}>
                  <Text style={{ color: isDone ? '#fff' : isInProgress ? C.amber : C.mid }}>{isDone ? '✓' : isInProgress ? '…' : ''}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[lv.exName, isDone && { color: C.mid }]}>{ex.name}</Text>
                  <Text style={lv.exMeta}>{ex.sets} sets × {ex.reps} reps · Rest {ex.rest}s</Text>
                  {isInProgress && (
                    <Text style={{ fontSize: 11, color: C.amber, fontWeight: '700', marginTop: 2 }}>
                      {doneSetsCount}/{ex.sets} sets done
                    </Text>
                  )}
                </View>
                <Text style={{ color: C.mid, fontSize: 13 }}>{isOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={lv.setsContainer}>
                  <ExerciseVideo uri={ex.videoUri} exerciseName={ex.name} />
                  {Array.from({ length: ex.sets }, (_, i) => {
                    const setNo = i + 1;
                    const stateKey = `${ex.id}_${setNo}`;
                    const isDoneSet = doneSets[stateKey];
                    const lastW = lastWeights[stateKey];
                    const restLeft = restTimers[stateKey];
                    const restColor = restLeft !== undefined
                      ? (restLeft < 20 ? C.red : restLeft < 40 ? C.amber : C.green)
                      : C.green;
                    return (
                      <View key={setNo}>
                        <View style={[lv.setRow, isDoneSet && lv.setRowDone]}>
                          <View style={lv.setNumBadge}>
                            <Text style={lv.setNumTxt}>S{setNo}</Text>
                          </View>
                          <View style={lv.repsBox}>
                            <Text style={lv.repsVal}>{ex.reps}</Text>
                            <Text style={lv.repsLbl}>reps</Text>
                          </View>
                          <View style={lv.lastBox}>
                            <Text style={lv.lastVal}>{lastW || '—'}</Text>
                            <Text style={lv.lastLbl}>last</Text>
                          </View>
                          <TextInput
                            style={[lv.weightInput, isDoneSet && { opacity: 0.5 }]}
                            placeholder={lastW || '0'}
                            placeholderTextColor={C.mid}
                            keyboardType="decimal-pad"
                            value={setWeights[stateKey] || ''}
                            editable={!isDoneSet}
                            onChangeText={val => {
                              const updated = { ...setWeights, [stateKey]: val };
                              setSetWeights(updated);
                              setSetWeightsExternal(updated);
                            }}
                          />
                          <Text style={lv.kgLbl}>kg</Text>
                          {!isDoneSet ? (
                            <TouchableOpacity
                              style={lv.doneBtn}
                              onPress={() => markSetDone(ex.id, setNo, ex.rest, ex.sets)}>
                              <Text style={lv.doneBtnTxt}>✓ Done</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={lv.donedTag}><Text style={lv.donedTxt}>✓</Text></View>
                          )}
                        </View>
                        {isDoneSet && restLeft !== undefined && restLeft > 0 && (
                          <View style={lv.restRow}>
                            <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(stateKey, -10)}>
                              <Text style={lv.restAdjTxt}>−10s</Text>
                            </TouchableOpacity>
                            <View style={[lv.restTimerBox, { borderColor: restColor, backgroundColor: restColor + '15' }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Ionicons name="sync-outline" size={14} color={restColor} />
                              <Text style={[lv.restTimerTxt, { color: restColor }]}>Rest {formatRest(restLeft)}</Text>
                            </View>
                            </View>
                            <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(stateKey, 10)}>
                              <Text style={lv.restAdjTxt}>+10s</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {isDoneSet && restLeft === 0 && (
                          <View style={lv.restDoneRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Ionicons name="checkmark-circle-outline" size={14} color={C.green} />
                              <Text style={lv.restDoneTxt}>Rest complete · Start next set!</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {ex.note ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="chatbubble-outline" size={12} color={C.primary} />
                      <Text style={lv.trainerNote}>"{ex.note}"</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}
        {allDone && (
          <View style={lv.finishCard}>
            <Ionicons name="trophy-outline" size={36} color={C.green} />
            <Text style={lv.finishTitle}>Workout Complete!</Text>
            <Text style={lv.finishSub}>Great job, {memberName}!{'\n'}Total time: {formatElapsed(elapsed)}</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const lv = StyleSheet.create({
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.light, backgroundColor: C.card },
  logTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  globalTimer: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  logCount: { fontSize: 14, fontWeight: '600', color: C.primary },
  exWrap: { backgroundColor: C.card, borderRadius: 14, marginBottom: 12, overflow: 'hidden', elevation: 1, borderWidth: 1, borderColor: C.light },
  exWrapDone: { borderColor: C.green, borderWidth: 1.5 },
  exWrapActive: { borderColor: C.amber, borderWidth: 1.5 },
  exCheckActive: { borderColor: C.amber },
  exHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  exCheck: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.light, alignItems: 'center', justifyContent: 'center' },
  exCheckDone: { backgroundColor: C.green, borderColor: C.green },
  exName: { fontSize: 15, fontWeight: '700', color: C.dark },
  exMeta: { fontSize: 12, color: C.mid, marginTop: 2 },
  setsContainer: { borderTopWidth: 1, borderTopColor: C.light, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.light, gap: 6 },
  setRowDone: { backgroundColor: '#F0FDF4', marginHorizontal: -14, paddingHorizontal: 14 },
  setNumBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  setNumTxt: { fontSize: 11, fontWeight: '700', color: C.primary },
  repsBox: { alignItems: 'center', width: 34 },
  repsVal: { fontSize: 14, fontWeight: '700', color: C.dark },
  repsLbl: { fontSize: 9, color: C.mid },
  lastBox: { alignItems: 'center', width: 40 },
  lastVal: { fontSize: 12, fontWeight: '600', color: C.amber },
  lastLbl: { fontSize: 9, color: C.mid },
  weightInput: { flex: 1, backgroundColor: C.bg, borderRadius: 8, padding: 7, fontSize: 14, color: C.dark, borderWidth: 1, borderColor: C.light, textAlign: 'center' },
  kgLbl: { fontSize: 11, color: C.mid, fontWeight: '600' },
  doneBtn: { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  doneBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 11 },
  donedTag: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  donedTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  restRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 10, backgroundColor: '#F8FAFF', marginHorizontal: -14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.light },
  restAdjBtn: { backgroundColor: C.light, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  restAdjTxt: { fontSize: 13, color: C.dark, fontWeight: '700' },
  restTimerBox: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6, minWidth: 130, alignItems: 'center' },
  restTimerTxt: { fontSize: 16, fontWeight: '800' },
  restDoneRow: { alignItems: 'center', paddingVertical: 8, backgroundColor: '#F0FDF4', marginHorizontal: -14, paddingHorizontal: 14 },
  restDoneTxt: { fontSize: 13, color: C.green, fontWeight: '600' },
  trainerNote: { fontSize: 12, color: C.primary, fontStyle: 'italic', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.light },
  finishCard: { backgroundColor: '#F0FDF4', borderRadius: 18, padding: 32, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: C.green },
  finishTitle: { fontSize: 22, fontWeight: '800', color: C.dark, marginTop: 10 },
  finishSub: { fontSize: 14, color: C.mid, marginTop: 4, textAlign: 'center', lineHeight: 22 },
});

// ── WORKOUTS SCREEN ───────────────────────────────────────────────────────────
function WorkoutsScreen({ member, assignment, planWeek, fullPlan, todayWorkout, setTodayWorkout, activeWorkoutLog, workoutTimer, startWorkoutTimer, stopWorkoutTimer, pauseWorkoutTimer, resumeWorkoutTimer, workoutDoneSets, setWorkoutDoneSets, workoutSetWeights, setWorkoutSetWeights, restEndTimes, setRestEndTimes, autoStartLogging, setAutoStartLogging }) {
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
  const [restTimers, setRestTimers] = useState({});
  const [isPaused, setIsPaused] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const tickRef = useRef(null);
  const vibratedRef = useRef({});
  const notifIdRef = useRef(null);
  const activeLogRef = useRef(null);
  const pausedAtRef = useRef(null);
  const pausedEndTimesRef = useRef(null);

  // ── Day helpers ─────────────────────────────────────────────────────────────
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayFullDay = fullDayNames[new Date().getDay()];
  // Plan days: Mon=0…Sun=6; JS getDay(): Sun=0,Mon=1… → (getDay()+6)%7
  const todayPlanIdx = (new Date().getDay() + 6) % 7;

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

  // ── Load last weights from AsyncStorage when logging starts ──────────────────
  useEffect(() => {
    if (!isLogging) return;
    const exs = (loggingWorkout ?? todayWorkout)?.exercises || [];
    const load = async () => {
      const stored = {};
      for (const ex of exs) {
        for (let s = 1; s <= ex.sets; s++) {
          try {
            const val = await AsyncStorage.getItem(`lift_w_${ex.id}_s${s}`);
            if (val) stored[`${ex.id}_${s}`] = val;
          } catch (_) {}
        }
      }
      setLastWeights(stored);
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

    const workoutSlotIndices = days.map((_, i) => i).filter(i => !days[i].restDay);
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
      Alert.alert('Workout Postponed ✓', 'Your cycle has been rotated. The updated schedule takes effect from next week.');
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
      if (!nextDay?.restDay) { performRotation(); return; }
      const restDate = getDateForPlanIdx(nextIdx);
      const restDayName = planIdxToName(nextIdx);
      Alert.alert(
        'Rest Day',
        `${restDayName}, ${formatDateLocal(restDate)} is a rest day.\nAssign your workout here or skip to rotate the cycle?`,
        [
          { text: `Assign to ${restDayName}`, onPress: () => assignToRestDay(nextIdx) },
          { text: 'Skip (Rotate Cycle)', style: 'cancel', onPress: () => checkPath(nextIdx, depth + 1) },
        ]
      );
    };

    checkPath(dayPlanIdx);
  };

  // ── Inline logging helpers ───────────────────────────────────────────────────
  const activeWorkout = loggingWorkout ?? todayWorkout;
  const logExercises = activeWorkout?.exercises || [];
  const gymOrTrainer = member?.gymId || member?.trainerId;
  const memberId = member?.id;
  const memberName = member?.name || 'there';

  const allSetsOf = (ex) =>
    Array.from({ length: ex.sets }, (_, i) => `${ex.id}_${i + 1}`).every(k => workoutDoneSets[k]);
  const allDone = logExercises.length > 0 && logExercises.every(allSetsOf);
  const doneCount = logExercises.filter(ex => allSetsOf(ex)).length;
  const elapsed = workoutTimer?.elapsed || 0;
  const elapsedColor = allDone ? C.green : elapsed > 3600 ? C.red : elapsed > 1800 ? C.amber : C.green;
  const formatRest = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startRestTimer = (stateKey, secs) => {
    setRestEndTimes({ [stateKey]: Date.now() + secs * 1000 });
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
    const val = localSetWeights[stateKey];
    if (val) {
      try { await AsyncStorage.setItem(`lift_w_${exId}_s${setNo}`, val); } catch (_) {}
    }
    const newDone = { ...workoutDoneSets, [stateKey]: true };
    setWorkoutDoneSets(newDone);
    vibratedRef.current = {};
    setRestEndTimes({});

    const allSetsOfThisExDone = Array.from(
      { length: totalSets }, (_, i) => `${exId}_${i + 1}`
    ).every(k => newDone[k]);
    if (!allSetsOfThisExDone) startRestTimer(stateKey, defaultRest || 60);

    const isAllDone = logExercises.every(ex =>
      Array.from({ length: ex.sets }, (_, i) => `${ex.id}_${i + 1}`).every(k => newDone[k])
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
            const todayIdx = (new Date().getDay() + 6) % 7;
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
              const todayIdx = (new Date().getDay() + 6) % 7;
              const days = (planSnap.data().days ?? []).map((d, i) =>
                i === todayIdx
                  ? { ...d, completedAt: Date.now(), startedAt: d.startedAt ?? Date.now(), durationSeconds: curElapsed }
                  : d
              );
              await upDoc(planRef, { days }).catch(() => {});
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
              actualSets: ex.sets, actualReps: String(ex.reps),
              weight: parseFloat(localSetWeights[`${ex.id}_1`] || lastWeights[`${ex.id}_1`] || '0'),
              restSeconds: ex.rest || 60, completed: true, notes: ex.note || '',
            })),
            exerciseLogs: logExercises.map(ex => ({
              exerciseId: ex.id, exerciseName: ex.name,
              sets: Array.from({ length: ex.sets }, (_, i) => ({
                setNo: i + 1, reps: ex.reps,
                weight: parseFloat(localSetWeights[`${ex.id}_${i + 1}`] || lastWeights[`${ex.id}_${i + 1}`] || '0'),
                done: true,
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
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Sticky workout timer header — visible only while logging */}
      {isLogging && (
        <View style={wk.stickyHeader}>
          <View style={{ alignItems: 'center' }}>
            <Text style={wk.stickyTitle}>Workout Log</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={allDone ? 'checkmark-circle-outline' : 'time-outline'} size={13} color={elapsedColor} />
              <Text style={[wk.stickyTimer, { color: elapsedColor }]}>{formatElapsed(elapsed)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Text style={wk.stickyCount}>{doneCount}/{logExercises.length} done</Text>
            <TouchableOpacity onPress={handlePauseToggle} style={wk.pauseBtn}>
              <Ionicons name={isPaused ? 'play' : 'pause-circle-outline'} size={28} color={C.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={g.screen}>
        {/* Plan header */}
        {fullPlan?.name && (
          <View style={{ marginBottom: 4 }}>
            <Text style={g.pageTitle}>{fullPlan.name}</Text>
            <Text style={{ fontSize: 13, color: C.mid, marginTop: -4, marginBottom: 8 }}>
              {fullPlan.days?.length || 0} day plan · Assigned by {member?.trainerName || member?.trainer || 'your trainer'}
            </Text>
          </View>
        )}
        {!fullPlan?.name && <Text style={g.pageTitle}>Workouts</Text>}

        {/* Weekly Plan - tappable day cards */}
        {(planWeek || assignment?.weekPlan) && (
          <>
            <Text style={g.sec}>This Week</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {(planWeek || assignment.weekPlan).map((d, i) => {
                const isToday = d.isToday ?? (i === todayPlanIdx);
                const planIdxForDay = d.planIdx ?? i;
                const isSelected = selectedDayIdx === planIdxForDay;
                const isActive = isSelected || (selectedDayIdx === null && isToday);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[wk.dayCard, isActive && wk.dayCardActive, !isActive && d.rest && wk.dayCardRest]}
                    onPress={() => handleDayPress(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[wk.dayName, isActive && { color: '#fff' }]}>{d.day}</Text>
                    <Text style={[{ fontSize: 9, color: C.mid, marginTop: 1 }, isActive && { color: 'rgba(255,255,255,0.8)' }]}>{d.date}</Text>
                    {isToday && <View style={wk.todayDot} />}
                    <Text style={[wk.dayLabel, isActive && { color: '#fff' }, !isActive && d.rest && { color: C.mid }]} numberOfLines={2}>
                      {d.rest ? 'Rest' : d.label}
                    </Text>
                    {d.exerciseCount > 0 && !d.rest && (
                      <Text style={[{ fontSize: 9, color: C.mid, marginTop: 2 }, isActive && { color: 'rgba(255,255,255,0.7)' }]}>
                        {d.exerciseCount} ex
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Trainer-started workout notification */}
        {activeWorkoutLog?.startedBy === 'trainer' && activeWorkoutLog.status === 'incomplete' && (
          <View style={{ backgroundColor: '#DBEAFE', borderRadius: 12, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="person-outline" size={20} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary }}>Trainer started a workout for you</Text>
              <Text style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>{activeWorkoutLog.dayLabel || activeWorkoutLog.planName} · Tap Start to begin</Text>
            </View>
          </View>
        )}

        {/* Selected day view (non-today) */}
        {selectedDayIdx !== null && selectedDay ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={g.sec}>{selectedDay.dayLabel || 'Day ' + (selectedDayIdx + 1)}</Text>
              <TouchableOpacity onPress={() => setSelectedDayIdx(null)}>
                <Text style={{ fontSize: 13, color: C.primary, fontWeight: '600' }}>← Back to today</Text>
              </TouchableOpacity>
            </View>
            {selectedDay.restDay ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="moon-outline" size={40} color={C.mid} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: C.dark, marginTop: 12 }}>Rest Day</Text>
                <Text style={{ fontSize: 14, color: C.mid, marginTop: 6, textAlign: 'center' }}>Recovery is part of progress</Text>
              </View>
            ) : selectedDay.exercises?.length > 0 ? (
              <>
                <Text style={{ fontSize: 13, color: C.mid, marginBottom: 10 }}>
                  {selectedDay.exercises.length} exercises · tap to expand
                </Text>
                {selectedDay.exercises.map((ex, idx) => {
                  const exKey = ex.id || idx;
                  const isOpen = expandedOverview === exKey;
                  const sets = ex.mainSets || 3;
                  const reps = ex.mainReps || 10;
                  const rest = ex.mainRestSeconds || 60;
                  return (
                    <View key={exKey} style={wk.exCardStatic}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                        onPress={() => setExpandedOverview(isOpen ? null : exKey)}
                        activeOpacity={0.7}
                      >
                        <View style={wk.exIcon}>
                          <Ionicons name="barbell-outline" size={20} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={wk.exName}>{ex.name}</Text>
                          <Text style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>
                            {sets} sets · {ex.muscleGroup || 'General'}
                          </Text>
                        </View>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.mid} />
                      </TouchableOpacity>
                      {isOpen && (
                        <View style={{ paddingTop: 10, paddingLeft: 54, gap: 4 }}>
                          <Text style={wk.exDetail}>{sets} sets × {reps} reps · {rest}s rest</Text>
                          {ex.muscleGroup ? <Text style={{ fontSize: 11, color: C.primary }}>{ex.muscleGroup}</Text> : null}
                          {ex.notes ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="chatbubble-outline" size={11} color={C.mid} />
                              <Text style={{ fontSize: 11, color: C.mid }}>{ex.notes}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })}
                {!isLogging && (
                  <>
                    <TouchableOpacity
                      style={[wk.startBtn, workoutTimer?.completed && { backgroundColor: C.green }]}
                      onPress={() => {
                        const exs = selectedDay.exercises.map(ex => ({
                          id: ex.id || ex.name, name: ex.name,
                          sets: ex.mainSets || 3, reps: ex.mainReps || 10,
                          rest: ex.mainRestSeconds || 60, note: ex.notes || '',
                          muscleGroup: ex.muscleGroup || '',
                        }));
                        const estSecs = exs.reduce((acc, ex) => acc + ex.sets * (45 + ex.rest), 0);
                        setLoggingWorkout({
                          id: fullPlan?.id || selectedDay.dayLabel,
                          name: fullPlan?.name || selectedDay.dayLabel || "Today's Workout",
                          estimatedMinutes: Math.max(10, Math.round(estSecs / 60)),
                          exercises: exs,
                          dayLabel: selectedDay.dayLabel || todayFullDay,
                        });
                        setSelectedDayIdx(null);
                        if (!workoutTimer?.running && !workoutTimer?.completed) startWorkoutTimer();
                        setIsLogging(true);
                      }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name={workoutTimer?.completed ? 'checkmark-circle-outline' : 'play'} size={16} color="#fff" />
                        <Text style={wk.startBtnTxt}>{workoutTimer?.completed ? 'View Completed' : 'Start Workout'}</Text>
                      </View>
                    </TouchableOpacity>
                    {selectedDayIdx > todayPlanIdx && !selectedDay.completedAt && (
                      <TouchableOpacity style={wk.postponeBtn} onPress={() => handlePostpone(selectedDayIdx)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="calendar-outline" size={15} color={C.amber} />
                          <Text style={wk.postponeBtnTxt}>Postpone to Next Day</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </>
            ) : (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="barbell-outline" size={40} color={C.mid} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: C.dark, marginTop: 12 }}>No exercises assigned</Text>
              </View>
            )}
          </>
        ) : (
          /* Today's Workout (default view) */
          <>
            {todayWorkout && !todayWorkout.isRestDay ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={g.sec}>Today — {todayWorkout.dayLabel || todayWorkout.name}</Text>
                  {workoutTimer?.running && !isLogging && (
                    <View style={wk.liveChip}>
                      <View style={wk.liveDot} />
                      <Text style={wk.liveTxt}>In Progress</Text>
                    </View>
                  )}
                  {workoutTimer?.completed && (
                    <View style={[wk.liveChip, { backgroundColor: C.green + '22' }]}>
                      <Text style={[wk.liveTxt, { color: C.green }]}>✓ Done</Text>
                    </View>
                  )}
                </View>

                {/* Expandable exercise list — shown when not logging */}
                {!isLogging && todayWorkout.exercises?.map(ex => {
                  const isOpen = expandedOverview === ex.id;
                  return (
                    <View key={ex.id} style={wk.exCardStatic}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                        onPress={() => setExpandedOverview(isOpen ? null : ex.id)}
                        activeOpacity={0.7}
                      >
                        <View style={wk.exIcon}>
                          <Ionicons name="barbell-outline" size={20} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={wk.exName}>{ex.name}</Text>
                          <Text style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>
                            {ex.sets} sets · {ex.muscleGroup || 'General'}
                          </Text>
                        </View>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.mid} />
                      </TouchableOpacity>
                      {isOpen && (
                        <View style={{ paddingTop: 10, paddingLeft: 54, gap: 4 }}>
                          <Text style={wk.exDetail}>{ex.sets} sets × {ex.reps} reps · {ex.rest}s rest</Text>
                          {ex.muscleGroup ? <Text style={{ fontSize: 11, color: C.primary }}>{ex.muscleGroup}</Text> : null}
                          {ex.note ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="chatbubble-outline" size={11} color={C.primary} />
                              <Text style={{ fontSize: 11, color: C.primary }}>{ex.note}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Start / Postpone — hidden once logging begins */}
                {!isLogging && (
                  <>
                    <TouchableOpacity
                      style={[wk.startBtn, workoutTimer?.completed && { backgroundColor: C.green }]}
                      onPress={() => {
                        if (!workoutTimer?.running && !workoutTimer?.completed) startWorkoutTimer();
                        setIsLogging(true);
                      }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons
                          name={workoutTimer?.completed ? 'checkmark-circle-outline' : workoutTimer?.running ? 'time-outline' : 'play'}
                          size={16} color="#fff"
                        />
                        <Text style={wk.startBtnTxt}>
                          {workoutTimer?.completed ? 'View Completed' : workoutTimer?.running ? 'Continue Workout' : 'Start Workout'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {!workoutTimer?.running && !workoutTimer?.completed && (
                      <TouchableOpacity style={wk.postponeBtn} onPress={() => handlePostpone(todayPlanIdx)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="calendar-outline" size={15} color={C.amber} />
                          <Text style={wk.postponeBtnTxt}>Postpone to Next Day</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </>
            ) : todayWorkout?.isRestDay ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="moon-outline" size={40} color={C.mid} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: C.dark, marginTop: 12 }}>Rest Day</Text>
                <Text style={{ fontSize: 14, color: C.mid, marginTop: 6, textAlign: 'center' }}>Recovery is part of progress. Take it easy today.</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="barbell-outline" size={40} color={C.mid} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: C.dark, marginTop: 12 }}>No workout yet</Text>
                <Text style={{ fontSize: 14, color: C.mid, marginTop: 6, textAlign: 'center' }}>Your trainer will assign a workout plan soon</Text>
              </View>
            )}
          </>
        )}

        {/* ── Inline workout logging cards ─────────────────────────────────── */}
        {isLogging && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Text style={[g.sec, { marginTop: 24 }]}>Exercises</Text>
            {logExercises.map((ex) => {
              const isOpen = expanded === ex.id;
              const isDone = allSetsOf(ex);
              const doneSetsCount = Array.from({ length: ex.sets }, (_, i) => workoutDoneSets[`${ex.id}_${i + 1}`]).filter(Boolean).length;
              const isInProgress = doneSetsCount > 0 && !isDone;
              return (
                <View key={ex.id} style={[lv.exWrap, isDone && lv.exWrapDone, isInProgress && lv.exWrapActive]}>
                  <TouchableOpacity style={lv.exHeader} onPress={() => setExpanded(isOpen ? null : ex.id)}>
                    <View style={[lv.exCheck, isDone && lv.exCheckDone, isInProgress && lv.exCheckActive]}>
                      <Text style={{ color: isDone ? '#fff' : isInProgress ? C.amber : C.mid }}>{isDone ? '✓' : isInProgress ? '…' : ''}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[lv.exName, isDone && { color: C.mid }]}>{ex.name}</Text>
                      <Text style={lv.exMeta}>{ex.sets} sets × {ex.reps} reps · Rest {ex.rest}s</Text>
                      {isInProgress && (
                        <Text style={{ fontSize: 11, color: C.amber, fontWeight: '700', marginTop: 2 }}>
                          {doneSetsCount}/{ex.sets} sets done
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: C.mid, fontSize: 13 }}>{isOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={lv.setsContainer}>
                      <ExerciseVideo uri={ex.videoUri} exerciseName={ex.name} />
                      {Array.from({ length: ex.sets }, (_, i) => {
                        const setNo = i + 1;
                        const stateKey = `${ex.id}_${setNo}`;
                        const isDoneSet = workoutDoneSets[stateKey];
                        const lastW = lastWeights[stateKey];
                        const restLeft = restTimers[stateKey];
                        const restColor = restLeft !== undefined
                          ? (restLeft < 20 ? C.red : restLeft < 40 ? C.amber : C.green)
                          : C.green;
                        return (
                          <View key={setNo}>
                            <View style={[lv.setRow, isDoneSet && lv.setRowDone]}>
                              <View style={lv.setNumBadge}>
                                <Text style={lv.setNumTxt}>S{setNo}</Text>
                              </View>
                              <View style={lv.repsBox}>
                                <Text style={lv.repsVal}>{ex.reps}</Text>
                                <Text style={lv.repsLbl}>reps</Text>
                              </View>
                              <View style={lv.lastBox}>
                                <Text style={lv.lastVal}>{lastW || '—'}</Text>
                                <Text style={lv.lastLbl}>last</Text>
                              </View>
                              <TextInput
                                style={[lv.weightInput, isDoneSet && { opacity: 0.5 }]}
                                placeholder={lastW || '0'}
                                placeholderTextColor={C.mid}
                                keyboardType="decimal-pad"
                                value={localSetWeights[stateKey] || ''}
                                editable={!isDoneSet}
                                onChangeText={val => {
                                  const updated = { ...localSetWeights, [stateKey]: val };
                                  setLocalSetWeights(updated);
                                  setWorkoutSetWeights(updated);
                                }}
                              />
                              <Text style={lv.kgLbl}>kg</Text>
                              {!isDoneSet ? (
                                <TouchableOpacity
                                  style={lv.doneBtn}
                                  onPress={() => markSetDone(ex.id, setNo, ex.rest, ex.sets)}>
                                  <Text style={lv.doneBtnTxt}>✓ Done</Text>
                                </TouchableOpacity>
                              ) : (
                                <View style={lv.donedTag}><Text style={lv.donedTxt}>✓</Text></View>
                              )}
                            </View>
                            {isDoneSet && restLeft !== undefined && restLeft > 0 && (
                              <View style={lv.restRow}>
                                <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(stateKey, -10)}>
                                  <Text style={lv.restAdjTxt}>−10s</Text>
                                </TouchableOpacity>
                                <View style={[lv.restTimerBox, { borderColor: restColor, backgroundColor: restColor + '15' }]}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Ionicons name="sync-outline" size={14} color={restColor} />
                                    <Text style={[lv.restTimerTxt, { color: restColor }]}>
                                      {isPaused ? 'Paused' : `Rest ${formatRest(restLeft)}`}
                                    </Text>
                                  </View>
                                </View>
                                <TouchableOpacity style={lv.restAdjBtn} onPress={() => adjustRest(stateKey, 10)}>
                                  <Text style={lv.restAdjTxt}>+10s</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            {isDoneSet && restLeft === 0 && (
                              <View style={lv.restDoneRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  <Ionicons name="checkmark-circle-outline" size={14} color={C.green} />
                                  <Text style={lv.restDoneTxt}>Rest complete · Start next set!</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                      {ex.note ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="chatbubble-outline" size={12} color={C.primary} />
                          <Text style={lv.trainerNote}>"{ex.note}"</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
            {allDone && (
              <View style={lv.finishCard}>
                <Ionicons name="trophy-outline" size={36} color={C.green} />
                <Text style={lv.finishTitle}>Workout Complete!</Text>
                <Text style={lv.finishSub}>Great job, {memberName}!{'\n'}Total time: {formatElapsed(elapsed)}</Text>
              </View>
            )}
          </KeyboardAvoidingView>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const wk = StyleSheet.create({
  dayCard: { backgroundColor: C.card, borderRadius: 12, padding: 12, marginRight: 8, alignItems: 'center', minWidth: 72, borderWidth: 1, borderColor: C.light },
  dayCardActive: { backgroundColor: C.primary, borderColor: C.primary },
  dayCardRest: { opacity: 0.5 },
  dayName: { fontSize: 12, fontWeight: '700', color: C.mid },
  dayLabel: { fontSize: 10, color: C.dark, marginTop: 4, textAlign: 'center', fontWeight: '500' },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginTop: 6 },
  exCardStatic: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  exCardActive: { borderWidth: 1.5, borderColor: C.primary },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primary + '15', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  liveTxt: { fontSize: 11, fontWeight: '700', color: C.primary },
  exIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 15, fontWeight: '600', color: C.dark },
  exDetail: { fontSize: 12, color: C.mid, marginTop: 2 },
  startBtn: { backgroundColor: C.primary, borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 8 },
  startBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  postponeBtn: { borderWidth: 1.5, borderColor: C.amber, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 10 },
  postponeBtnTxt: { color: C.amber, fontWeight: '600', fontSize: 14 },
  stickyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.light },
  stickyTitle: { fontSize: 12, fontWeight: '700', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5 },
  stickyTimer: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  stickyCount: { fontSize: 13, fontWeight: '600', color: C.primary },
  pauseBtn: { padding: 4 },
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
  const TYPES = ['Chest', 'Waist', 'Hips', 'Bicep', 'Thigh', 'Shoulder', 'Calf'];
  const [editing, setEditing] = React.useState(null);
  const [inputVal, setInputVal] = React.useState('');
  const [saving, setSaving] = React.useState(false);

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
      const { doc, collection, setDoc } = require('firebase/firestore');
      const { db } = require('./shared/firebase/config');
      const ref = doc(collection(db, 'gyms', ns, 'measurements'));
      await setDoc(ref, {
        id: ref.id,
        memberId,
        gymId: gymId || null,
        type,
        value: val,
        loggedAt: Date.now(),
      });
      setEditing(null);
      setInputVal('');
    } catch (e) {
      console.log('Measurement save error:', e);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <View style={{ marginTop: 8 }}>
      {TYPES.map(type => {
        const latest = getLatest(type);
        const isEditing = editing === type;
        return (
          <View key={type} style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: isEditing ? C.primary : C.light }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.dark }}>{type}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {latest && <Text style={{ fontSize: 14, fontWeight: '600', color: C.primary }}>{latest.value} cm</Text>}
                <TouchableOpacity
                  style={{ backgroundColor: isEditing ? C.light : C.blue2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                  onPress={() => { setEditing(isEditing ? null : type); setInputVal(''); }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isEditing ? C.mid : C.primary }}>
                    {isEditing ? 'Cancel' : latest ? 'Update' : '+ Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {!latest && !isEditing && <Text style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>Not logged yet</Text>}
            {isEditing && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: C.bg, borderRadius: 10, padding: 10, fontSize: 16, color: C.dark, borderWidth: 1, borderColor: C.primary }}
                  placeholder={'Enter ' + type + ' in cm'}
                  placeholderTextColor={C.mid}
                  keyboardType="decimal-pad"
                  value={inputVal}
                  onChangeText={setInputVal}
                  autoFocus
                />
                <TouchableOpacity
                  style={{ backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, opacity: (!inputVal || saving) ? 0.5 : 1 }}
                  onPress={() => handleSave(type)}
                  disabled={!inputVal || saving}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{saving ? '…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── BMI Zone Chart (Weight tab) ─────────────────────────────────────────────
// Matches the trainer app's WeightBMIScreen chart exactly.
// weightLog entries: { weight, loggedAt }  (from subscribeToWeightLog)
// memberHeight: cm (from member.height)
function MemberBMIZoneChart({ weightLog, memberHeight }) {
  const [chartW, setChartW] = useState(0);
  const CHART_H = 200;
  const PADDING_L = 40;

  const BMI_COLORS = {
    uw:     '#3B82F6',
    normal: '#10B981',
    ow:     '#F59E0B',
    obese:  '#EF4444',
  };

  const getDotColor = (bmi) => {
    if (bmi < 18.5) return BMI_COLORS.uw;
    if (bmi < 25)   return BMI_COLORS.normal;
    if (bmi < 30)   return BMI_COLORS.ow;
    return BMI_COLORS.obese;
  };

  if (!memberHeight || memberHeight <= 0 || weightLog.length === 0) return null;

  const heightM = memberHeight / 100;

  // weightLog is newest-first; take last 12 and reverse so oldest is on left
  const chartData = [...weightLog].slice(0, 12).reverse();

  // Compute BMI per entry
  const entries = chartData.map(e => ({
    weight: e.weight,
    loggedAt: e.loggedAt,
    bmi: parseFloat((e.weight / (heightM * heightM)).toFixed(1)),
  }));

  // Weight thresholds for each BMI boundary
  const thresholds = {
    uw:   18.5 * heightM * heightM,
    norm: 24.9 * heightM * heightM,
    ow:   29.9 * heightM * heightM,
  };

  const weights = entries.map(e => e.weight);
  const allW = [...weights, thresholds.uw - 3, thresholds.ow + 3];
  const minW = Math.max(0, Math.floor(Math.min(...allW) - 1));
  const maxW = Math.ceil(Math.max(...allW) + 1);
  const range = maxW - minW || 1;

  const innerW = Math.max(0, chartW - PADDING_L);
  const toY = (w) => CHART_H * (1 - (w - minW) / range);
  const toX = (i) => PADDING_L + (entries.length > 1 ? (i / (entries.length - 1)) * innerW : innerW / 2);
  const clamp = (y) => Math.max(0, Math.min(CHART_H, y));

  const points = entries.map((e, i) => ({
    x: toX(i), y: clamp(toY(e.weight)), bmi: e.bmi, weight: e.weight, loggedAt: e.loggedAt,
  }));

  // Zone counts across ALL entries (not just visible 12)
  const counts = weightLog.reduce((acc, e) => {
    const b = e.weight / (heightM * heightM);
    if (b < 18.5)     acc.uw++;
    else if (b < 25)  acc.normal++;
    else if (b < 30)  acc.ow++;
    else              acc.obese++;
    return acc;
  }, { uw: 0, normal: 0, ow: 0, obese: 0 });

  const yOW   = clamp(toY(thresholds.ow));
  const yNorm = clamp(toY(thresholds.norm));
  const yUW   = clamp(toY(thresholds.uw));

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginVertical: 16, elevation: 1 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.dark }}>⚖️ Weight Progress</Text>
      <Text style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>
        {weightLog.length > 12
          ? `Showing last 12 of ${weightLog.length} entries`
          : `${weightLog.length} ${weightLog.length === 1 ? 'entry' : 'entries'} total`}
      </Text>

      {/* Chart area */}
      <View
        style={{ height: CHART_H, marginTop: 12 }}
        onLayout={ev => setChartW(ev.nativeEvent.layout.width)}
      >
        {chartW > 0 && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: CHART_H, overflow: 'hidden' }}>

            {/* Zone background bands */}
            <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: 0, height: yOW, backgroundColor: 'rgba(239,68,68,0.09)' }} />
            <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yOW, height: Math.max(0, yNorm - yOW), backgroundColor: 'rgba(245,158,11,0.09)' }} />
            <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yNorm, height: Math.max(0, yUW - yNorm), backgroundColor: 'rgba(16,185,129,0.09)' }} />
            <View style={{ position: 'absolute', left: PADDING_L, right: 0, top: yUW, height: Math.max(0, CHART_H - yUW), backgroundColor: 'rgba(59,130,246,0.09)' }} />

            {/* Threshold reference lines + weight labels */}
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

            {/* Y-axis grid lines + labels */}
            {[minW, Math.round((minW + maxW) / 2), maxW].map((w, i) => {
              const y = clamp(toY(w));
              return (
                <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: y }}>
                  <Text style={{ position: 'absolute', left: 0, top: -7, fontSize: 8, color: '#9CA3AF', width: PADDING_L - 4, textAlign: 'right' }}>{w}</Text>
                  <View style={{ position: 'absolute', left: PADDING_L, right: 0, height: 1, backgroundColor: '#F3F4F6' }} />
                </View>
              );
            })}

            {/* Y-axis line */}
            <View style={{ position: 'absolute', left: PADDING_L - 1, top: 0, width: 1, height: CHART_H, backgroundColor: '#E5E7EB' }} />

            {/* Line segments between dots */}
            {points.slice(0, -1).map((p, i) => {
              const q = points[i + 1];
              const dx = q.x - p.x;
              const dy = q.y - p.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              const cx = (p.x + q.x) / 2;
              const cy = (p.y + q.y) / 2;
              return (
                <View key={i} style={{
                  position: 'absolute',
                  left: cx - length / 2, top: cy - 1,
                  width: length, height: 2,
                  backgroundColor: '#CBD5E1',
                  transform: [{ rotate: `${angle}deg` }],
                }} />
              );
            })}

            {/* Data dots colored by BMI zone */}
            {points.map((p, i) => (
              <View key={i} style={{
                position: 'absolute',
                left: p.x - 5, top: p.y - 5,
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: getDotColor(p.bmi),
                borderWidth: 1.5, borderColor: '#FFFFFF',
                elevation: 3, zIndex: 10,
              }} />
            ))}
          </View>
        )}
      </View>

      {/* X-axis date labels — first / middle / last */}
      {points.length > 0 && (
        <View style={{ flexDirection: 'row', marginLeft: PADDING_L, marginTop: 4 }}>
          <Text style={{ fontSize: 9, color: '#9CA3AF', flex: 1, textAlign: 'left' }}>
            {formatDate(points[0].loggedAt)}
          </Text>
          {points.length > 2 && (
            <Text style={{ fontSize: 9, color: '#9CA3AF', flex: 1, textAlign: 'center' }}>
              {formatDate(points[Math.floor(points.length / 2)].loggedAt)}
            </Text>
          )}
          <Text style={{ fontSize: 9, color: '#9CA3AF', flex: 1, textAlign: 'right' }}>
            {formatDate(points[points.length - 1].loggedAt)}
          </Text>
        </View>
      )}

      {/* Zone legend + occurrence counts */}
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

function ProgressScreen({ member, gymId, memberId }) {
  const [activeTab, setActiveTab] = useState('Weight');
  const [weightLog, setWeightLog] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [workoutLogs, setWorkoutLogs] = useState([]);

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
    // Use the same namespace as weight logs/measurements so gym members and freelance members both work
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!ns) return;
    const { collection, query, where, orderBy, onSnapshot } = require('firebase/firestore');
    const { db } = require('./shared/firebase/config');
    const q = query(
      collection(db, 'gyms', ns, 'workoutLogs'),
      where('memberId', '==', memberId),
      orderBy('completedAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setWorkoutLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [memberId, gymId, member?.trainerId]);

  const handleLogWeight = async () => {
    const val = parseFloat(weightInput);
    const ns = gymId || (member && (member.trainerId || member.id));
    if (!val || !ns || !memberId) { Alert.alert('Error', 'Could not save. Try again.'); return; }
    setSaving(true);
    try {
      // Write directly to Firestore — works for both gym and freelance members
      const { doc, collection, setDoc, updateDoc } = require('firebase/firestore');
      const { db } = require('./shared/firebase/config');
      const logRef = doc(collection(db, 'gyms', ns, 'weightLogs'));
      await setDoc(logRef, {
        id: logRef.id,
        memberId,
        gymId: gymId || null,
        weight: val,
        height: member?.height || 0,
        loggedAt: Date.now(),
      });
      // Also update member's current weight
      await updateDoc(doc(db, 'members', memberId), { weight: val, updatedAt: Date.now() }).catch(() => {});
      setWeightInput('');
    } catch (e) {
      console.log('Weight log error:', e);
      Alert.alert('Error', 'Failed to save weight. Please try again.');
    } finally { setSaving(false); }
  };

  const bmi = member && member.height > 0
    ? (member.weight / ((member.height / 100) ** 2)).toFixed(1)
    : null;


  return (
    <ScrollView style={g.screen}>
      <Text style={g.pageTitle}>Progress</Text>
      <View style={pr.tabs}>
        {['Weight', 'Measurements', 'Photos', 'Workouts'].map(t => (
          <TouchableOpacity key={t} style={[pr.tab, activeTab === t && pr.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[pr.tabTxt, activeTab === t && pr.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Weight' && (
        <>
          {bmi && (() => {
            const bmiNum = parseFloat(bmi);
            const bmiColor = bmiNum < 18.5 ? '#3B82F6' : bmiNum < 25 ? C.green : bmiNum < 30 ? C.amber : C.red;
            const bmiCat   = bmiNum < 18.5 ? 'Underweight' : bmiNum < 25 ? 'Normal' : bmiNum < 30 ? 'Overweight' : 'Obese';
            return (
              <View style={pr.bmiCard}>
                <View>
                  <Text style={pr.bmiLabel}>Current BMI</Text>
                  <Text style={[pr.bmiVal, { color: bmiColor }]}>{bmi}</Text>
                  <View style={[pr.bmiTag, { backgroundColor: bmiColor + '22' }]}>
                    <Text style={[pr.bmiTagTxt, { color: bmiColor }]}>{bmiCat}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={pr.weightBig}>{member.weight} kg</Text>
                  <Text style={pr.weightSub}>Goal: {member.goalWeight} kg</Text>
                </View>
              </View>
            );
          })()}

          <MemberBMIZoneChart weightLog={weightLog} memberHeight={member?.height || 0} />

          {/* Goal progress bar */}
          {(() => {
            const cw = member?.weight;
            const gw = member?.goalWeight;
            const sw = weightLog.length > 0 ? weightLog[weightLog.length - 1]?.weight : cw;
            if (!cw || !gw || !sw || gw >= sw) return null;
            const total = sw - gw;
            const done = sw - cw;
            const pct = Math.min(100, Math.max(0, (done / total) * 100));
            return (
              <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: C.mid, fontWeight: '600' }}>Goal Progress</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>{pct.toFixed(0)}%</Text>
                </View>
                <View style={{ height: 10, backgroundColor: '#E5E7EB', borderRadius: 5 }}>
                  <View style={{ height: 10, width: `${pct}%`, backgroundColor: C.green, borderRadius: 5 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                  <Text style={{ fontSize: 11, color: C.mid }}>Start: {sw} kg</Text>
                  <Text style={{ fontSize: 11, color: C.mid }}>{Math.max(0, cw - gw).toFixed(1)} kg to goal ({gw} kg)</Text>
                </View>
              </View>
            );
          })()}

          <View style={[pr.logRow, { marginBottom: 16 }]}>
            <TextInput
              style={pr.logInput}
              placeholder="Today's weight"
              placeholderTextColor={C.mid}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <Text style={pr.unit}>kg</Text>
            <TouchableOpacity
              style={[pr.logBtn, (!weightInput || saving) && pr.logBtnOff]}
              onPress={handleLogWeight}
              disabled={!weightInput || saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={pr.logBtnTxt}>Log</Text>}
            </TouchableOpacity>
          </View>

          {weightLog.length === 0 && (
            <Text style={{ color: C.mid, textAlign: 'center', marginTop: 20 }}>No weight entries yet. Log your first weight above!</Text>
          )}
        </>
      )}

      {activeTab === 'Measurements' && (
        <MeasurementLogger
          member={member}
          gymId={gymId || (member && (member.trainerId || member.id))}
          memberId={memberId}
          measurements={measurements}
        />
      )}
      {activeTab === 'Photos' && (
        <ProgressPhotosTab gymId={gymId} memberId={memberId} />
      )}
      {activeTab === 'Workouts' && (() => {
        const recent = workoutLogs.slice(0, 10);
        const totalMins = Math.round(workoutLogs.reduce((s, w) => s + (w.durationSeconds || 0), 0) / 60);
        const avgMins = workoutLogs.length
          ? Math.round(workoutLogs.reduce((s, w) => s + (w.durationSeconds || 0), 0) / workoutLogs.length / 60)
          : 0;
        const maxSecs = Math.max(...recent.map(w => w.durationSeconds || 0), 1);
        return (
          <View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={[pr.bmiCard, { flex: 1 }]}>
                <View>
                  <Text style={pr.bmiLabel}>Total Time</Text>
                  <Text style={[pr.bmiVal, { color: C.primary, fontSize: 22 }]}>{totalMins} min</Text>
                </View>
              </View>
              <View style={[pr.bmiCard, { flex: 1 }]}>
                <View>
                  <Text style={pr.bmiLabel}>Avg Duration</Text>
                  <Text style={[pr.bmiVal, { color: C.green, fontSize: 22 }]}>{avgMins} min</Text>
                </View>
              </View>
            </View>
            {/* 4-week consistency bars */}
            {(() => {
              const now = Date.now();
              const weeks = [3, 2, 1, 0].map(ago => {
                const end   = now - ago * 7 * 24 * 3600 * 1000;
                const start = end - 7 * 24 * 3600 * 1000;
                const count = workoutLogs.filter(w => (w.completedAt ?? 0) >= start && (w.completedAt ?? 0) < end).length;
                return { label: ago === 0 ? 'This\nweek' : `${ago}w\nago`, count };
              });
              const maxC = Math.max(...weeks.map(w => w.count), 1);
              return (
                <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: C.mid, fontWeight: '600', marginBottom: 10 }}>4-Week Consistency</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80 }}>
                    {weeks.map((w, i) => (
                      <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: C.primary, marginBottom: 3 }}>{w.count}</Text>
                        <View style={{ width: '60%', height: Math.max(6, (w.count / maxC) * 48), backgroundColor: i === 3 ? C.primary : C.primary + '33', borderRadius: 4 }} />
                        <Text style={{ fontSize: 10, color: C.mid, marginTop: 4, textAlign: 'center' }}>{w.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {recent.length === 0 ? (
              <Text style={{ color: C.mid, textAlign: 'center', marginTop: 20 }}>Complete workouts to see your time trends here.</Text>
            ) : (
              <>
                <Text style={[g.sec, { marginBottom: 12 }]}>Recent Sessions</Text>
                <View style={[pr.chart, { height: 160, alignItems: 'flex-end' }]}>
                  {recent.slice(0, 7).reverse().map((w, i) => {
                    const mins = Math.round((w.durationSeconds || 0) / 60);
                    const barH = Math.max(8, Math.round(((w.durationSeconds || 0) / maxSecs) * 100));
                    return (
                      <View key={w.id || i} style={pr.barGroup}>
                        <Text style={pr.barVal}>{mins}m</Text>
                        <View style={[pr.bar, { height: barH, backgroundColor: C.primary }]} />
                        <Text style={pr.barDate}>{w.completedAt ? new Date(w.completedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}</Text>
                      </View>
                    );
                  })}
                </View>
                {recent.map((w, i) => (
                  <View key={w.id || i} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                    <Text style={{ color: C.dark, fontWeight: '600' }}>{w.workoutName || 'Workout'}</Text>
                    <Text style={{ color: C.mid, fontSize: 13 }}>
                      {Math.round((w.durationSeconds || 0) / 60)} min · {w.completedAt ? new Date(w.completedAt).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        );
      })()}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const pr = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: C.light, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabTxt: { fontSize: 14, fontWeight: '600', color: C.mid },
  tabTxtActive: { color: C.primary },
  bmiCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  bmiLabel: { fontSize: 12, color: C.mid, fontWeight: '500', marginBottom: 4 },
  bmiVal: { fontSize: 32, fontWeight: '800' },
  weightBig: { fontSize: 28, fontWeight: '800', color: C.dark },
  weightSub: { fontSize: 13, color: C.mid },
  bmiTag: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' },
  bmiTagTxt: { fontSize: 11, fontWeight: '700' },
  chart: { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 130, elevation: 1 },
  barGroup: { alignItems: 'center' },
  bar: { width: 28, backgroundColor: C.primary, borderRadius: 6 },
  barVal: { fontSize: 10, color: C.mid, marginBottom: 4 },
  barDate: { fontSize: 10, color: C.mid, marginTop: 4 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logInput: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, fontSize: 18, color: C.dark, borderWidth: 1, borderColor: C.light },
  unit: { fontSize: 15, color: C.mid, fontWeight: '600' },
  logBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14 },
  logBtnOff: { backgroundColor: C.light },
  logBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

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
  backBtn: { color: '#1A56DB', fontSize: 15, fontWeight: '500', width: 60 },
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
  bubbleMe: { backgroundColor: '#1A56DB', borderBottomRightRadius: 4 },
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
    backgroundColor: '#1A56DB',
    alignItems: 'center', justifyContent: 'center',
  },
});

// ── NOTIFICATIONS SCREEN ──────────────────────────────────────────────────────
function NotificationsScreen({ onBack, memberId }) {
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
        <TouchableOpacity onPress={onBack}><Text style={{ color: C.primary, fontSize: 15 }}>← Back</Text></TouchableOpacity>
        <Text style={nt.title}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAll}><Text style={{ color: C.primary, fontSize: 13 }}>Mark all read</Text></TouchableOpacity>
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

const nt = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.light },
  title: { fontSize: 16, fontWeight: '700', color: C.dark },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: C.primary },
  nTitle: { fontSize: 14, fontWeight: '600', color: C.dark },
  nBody: { fontSize: 13, color: C.mid, marginTop: 2 },
  nTime: { fontSize: 11, color: C.light, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
});

// ── PROFILE SCREEN ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — Trainer Invite Section
// Paste this entire block into App.js BEFORE the ProfileScreen function.
// Then inside ProfileScreen, after the Trainer Chat card, add:
//   <TrainerInviteSection member={member} onTrainerLinked={onUpdateMember} />
// ─────────────────────────────────────────────────────────────────────────────

function TrainerInviteSection({ member, onTrainerLinked }) {
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

const ti = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, elevation: 1, borderWidth: 1, borderColor: C.light },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: C.dark },
  toggleSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: C.light, justifyContent: 'center', padding: 3 },
  toggleOn: { backgroundColor: C.primary },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.card },
  toggleKnobOn: { alignSelf: 'flex-end' },
  divider: { height: 1, backgroundColor: C.light, marginVertical: 14 },
  pendingTitle: { fontSize: 11, fontWeight: '700', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  inviteAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  inviteAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  inviteName: { fontSize: 14, fontWeight: '700', color: C.dark },
  inviteSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  inviteActions: { flexDirection: 'row', gap: 6 },
  inviteBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  acceptBtn: { backgroundColor: C.primary },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rejectBtn: { backgroundColor: C.light },
  rejectBtnText: { color: C.mid, fontWeight: '600', fontSize: 13 },
  linkTitle: { fontSize: 14, fontWeight: '700', color: C.dark, marginBottom: 3 },
  linkSub: { fontSize: 12, color: C.mid, marginBottom: 10 },
  linkRow: { flexDirection: 'row', gap: 8 },
  linkInput: { flex: 1, backgroundColor: C.bg, borderRadius: 10, padding: 12, fontSize: 14, color: C.dark, borderWidth: 1, borderColor: C.light },
  inputDisabled: { opacity: 0.5 },
  goBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, justifyContent: 'center' },
  goBtnDisabled: { backgroundColor: C.light },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});


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

function ProfileScreen({ member, onLogout, onTrainerChat, onUpdateMember }) {
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
            <View style={pf.memberCard}>
              <Text style={pf.planName}>
                {member?.gymId ? '🏋️ Personal Training' : '🏋️ Training Plan'}
              </Text>
              <Text style={pf.planSub}>Valid until {formatDate(member.planEndDate)} · {daysLeft} days left</Text>
            </View>
          )}
          {member?.gymId && !member?.trainerId && (
            <View style={pf.memberCard}>
              <Text style={pf.planName}>🏛 Gym Membership</Text>
              <Text style={pf.planSub}>Valid until {formatDate(member.planEndDate)} · {daysLeft} days left</Text>
            </View>
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
    </ScrollView>
  );
}
const pf = StyleSheet.create({
  trainerCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.primary, marginBottom: 8 },
  trainerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  trainerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  trainerName: { fontSize: 16, fontWeight: '700', color: C.dark },
  trainerSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  trainerChatCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: C.light, marginBottom: 8 },
  trainerChatTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  trainerChatSub: { fontSize: 12, color: C.mid, marginTop: 3 },
  onlineBadge: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  onlineTxt: { color: C.green, fontSize: 12, fontWeight: '700' },
  removeTrainerBtn: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 4 },
  removeTrainerTxt: { color: C.red, fontWeight: '600', fontSize: 14 },
  noTrainerCard: { backgroundColor: C.card, borderRadius: 14, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.light },
  noTrainerTitle: { fontSize: 16, fontWeight: '700', color: C.dark },
  noTrainerSub: { fontSize: 13, color: C.mid, textAlign: 'center', lineHeight: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.light },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.dark },
  trainerModalAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  trainerModalAvatarText: { color: '#fff', fontWeight: '800', fontSize: 32 },
  trainerModalName: { fontSize: 22, fontWeight: '800', color: C.dark },
  verifiedBadge: { backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 6 },
  verifiedText: { color: C.green, fontSize: 12, fontWeight: '700' },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.card, padding: 14, marginBottom: 1, borderRadius: 2 },
  modalRowKey: { fontSize: 14, color: C.mid },
  modalRowVal: { fontSize: 14, fontWeight: '600', color: C.dark },
  modalSectionTitle: { fontSize: 13, fontWeight: '700', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5 },
  specChip: { backgroundColor: C.blue2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  specChipText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  modalBio: { fontSize: 14, color: C.dark, lineHeight: 22, marginTop: 8 },
  header: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTxt: { fontSize: 34, fontWeight: '800', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: C.dark },
  memberTag: { backgroundColor: C.blue2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 6 },
  memberTagTxt: { color: C.primary, fontSize: 12, fontWeight: '600' },
  row: { backgroundColor: C.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 1, borderRadius: 2 },
  rowKey: { fontSize: 14, color: C.mid, flex: 1 },
  rowVal: { fontSize: 14, fontWeight: '600', color: C.dark },
  editWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput: { fontSize: 14, fontWeight: '600', color: C.dark, borderBottomWidth: 1.5, borderBottomColor: C.primary, paddingVertical: 2, paddingHorizontal: 4, minWidth: 80, textAlign: 'right' },
  editBtn: { padding: 4 },
  editBtnTxt: { fontSize: 14 },
  trainerChatCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: C.light },
  trainerChatTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  trainerChatSub: { fontSize: 12, color: C.mid, marginTop: 3 },
  onlineBadge: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  onlineTxt: { color: C.green, fontSize: 12, fontWeight: '700' },
  memberCard: { backgroundColor: C.card, borderRadius: 14, padding: 18, elevation: 1 },
  planName: { fontSize: 17, fontWeight: '700', color: C.dark },
  planSub: { fontSize: 13, color: C.mid, marginTop: 4 },
  logoutBtn: { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 24 },
  logoutTxt: { color: C.red, fontWeight: '700', fontSize: 16 },
});

// ── GLOBAL STYLES ─────────────────────────────────────────────────────────────
const g = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, padding: 16 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: C.dark, marginBottom: 20, marginTop: 8 },
  sec: { fontSize: 13, fontWeight: '700', color: C.mid, marginTop: 20, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
});

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('splash');
  const [tab, setTab] = useState('Home');
  const [uid, setUid] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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
  const timerRef = useRef(null);
  const planUnsubRef = useRef(null); // nested plan onSnapshot cleanup

  // ── Auth state listener ─────────────────────────────────────────────────────
  useEffect(() => {
    // Timeout fallback — if Firebase takes too long, go to welcome
    const timeout = setTimeout(() => {
      setAuthLoading(false);
      setScreen('welcome');
    }, 5000);

    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      if (user) {
        setUid(user.uid);
        setScreen('main');
      } else {
        setUid(null);
        setScreen('welcome');
      }
      setAuthLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  // ── Member profile listener ─────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToMember(uid, (m) => setMember(m));
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
      const postponedToday = plan.postponedOn === todayDateStr && plan.postponedDayIdx === todayPlanIdx;

      // Build week view: 7 slots centred on today (offset −3 … +3)
      if (plan.days?.length) {
        const todayDate = new Date();
        const wp = Array.from({ length: 7 }, (_, displayIdx) => {
          const offset = displayIdx - 3; // today always at display index 3
          const cardDate = new Date(todayDate);
          cardDate.setDate(todayDate.getDate() + offset);
          const planIdx = (cardDate.getDay() + 6) % 7;
          const d = plan.days[planIdx] || {};
          const isPostponed = plan.postponedOn === todayDateStr && plan.postponedDayIdx === planIdx;
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
          id: ex.id || ex.name,
          name: ex.name,
          sets: ex.mainSets || 3,
          reps: ex.mainReps || 10,
          rest: ex.mainRestSeconds || 60,
          note: ex.notes || '',
          muscleGroup: ex.muscleGroup || '',
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

    const assignRef = doc(db, 'gyms', gymOrTrainer, 'assignments', uid);
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
    await auth.signOut();
    setMember(null);
    setAssignment(null);
    setTodayWorkout(null);
    setUid(null);
    setScreen('welcome');
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (screen === 'splash') {
    return <SplashScreen onDone={() => setScreen('loading')} />;
  }

  if (authLoading || screen === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A56DB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: 6 }}>LIFT</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
      </View>
    );
  }

  if (screen === 'welcome') return <WelcomeScreen onLogin={() => setScreen('login')} />;
  if (screen === 'login') return <OtpLoginScreen onSuccess={(id) => { setUid(id); setScreen('main'); }} />;
  if (screen === 'notifications') return (
    <NotificationsScreen onBack={() => setScreen('main')} memberId={uid} />
  );
  if (screen === 'trainerChat') return (
    <TrainerChatScreen member={member} onBack={() => setScreen('main')} />
  );

  const tabs = [
    { name: 'Home', icon: 'home', iconOutline: 'home-outline' },
    { name: 'Workouts', icon: 'barbell', iconOutline: 'barbell-outline' },
    { name: 'Progress', icon: 'trending-up', iconOutline: 'trending-up-outline' },
    { name: 'Profile', icon: 'person-circle', iconOutline: 'person-circle-outline' },
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
      case 'Profile':
        return (
          <ProfileScreen
            member={member}
            onLogout={handleLogout}
            onTrainerChat={() => setScreen('trainerChat')}
            onUpdateMember={(changes) => setMember(prev => ({ ...prev, ...changes }))}
          />
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>{renderTab()}</View>
      <View style={mn.tabBar}>
        {tabs.map(t => {
          const active = tab === t.name;
          return (
            <TouchableOpacity key={t.name} style={mn.tabItem} onPress={() => setTab(t.name)}>
              <Ionicons name={active ? t.icon : t.iconOutline} size={24} color={active ? C.primary : C.mid} />
              <Text style={[mn.tabLbl, active && mn.tabLblActive]}>{t.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const mn = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: C.card, paddingVertical: 8, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.light },
  tabItem: { flex: 1, alignItems: 'center' },
  tabLbl: { fontSize: 9, color: C.mid, marginTop: 2, fontWeight: '500' },
  tabLblActive: { color: C.primary, fontWeight: '700' },
});