// ── HOME SCREEN (DASHBOARD) ──────────────────────────────
// The main dashboard shown after login.
// Displays greeting, today's workout, quick stats, membership strip,
// video of the day, trainer chat card, and expert consult card.
//
// Props:
//   member        – member data object
//   workoutTimer  – { running, elapsed, completed }
//   onNavigate    – function(screenName) to switch tabs or screens

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import C from '../constants/colors';
import g from '../styles/global';
import { formatElapsed } from '../utils/formatters';
import { TODAY_WORKOUT } from '../constants/data';

export default function HomeScreen({ member, workoutTimer, onNavigate }) {
  const hour    = new Date().getHours();
  const greet   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
  const daysColor = member.daysLeft <= 7 ? C.red : member.daysLeft <= 30 ? C.amber : C.green;

  return (
    <ScrollView style={g.screen} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.greet}>{greet}, {member.name.split(' ')[0]}! 👋</Text>
          <Text style={s.date}>{new Date().toDateString()}</Text>
        </View>
        <TouchableOpacity style={s.notifBtn} onPress={() => onNavigate('Notifications')}>
          <Text style={{ fontSize: 22 }}>🔔</Text>
          <View style={s.badge}><Text style={s.badgeTxt}>2</Text></View>
        </TouchableOpacity>
      </View>

      {/* ── Today's Workout Card ── */}
      <TouchableOpacity style={s.workoutCard} onPress={() => onNavigate('Workouts')}>
        <View style={s.workoutTop}>
          <Text style={s.workoutLabel}>TODAY'S WORKOUT</Text>
          <Text style={s.workoutTime}>⏱ {TODAY_WORKOUT.time}</Text>
        </View>
        <Text style={s.workoutName}>{TODAY_WORKOUT.name}</Text>

        {workoutTimer?.running && (
          <View style={s.timerPill}>
            <Text style={s.timerPillTxt}>⏱ {formatElapsed(workoutTimer.elapsed)} · In progress</Text>
          </View>
        )}
        {workoutTimer?.completed && (
          <View style={[s.timerPill, { backgroundColor: 'rgba(16,185,129,0.25)' }]}>
            <Text style={s.timerPillTxt}>✅ Done in {formatElapsed(workoutTimer.elapsed)}</Text>
          </View>
        )}

        <Text style={s.workoutSub}>{TODAY_WORKOUT.exercises.length} exercises · Assigned by {member.trainer}</Text>
        <View style={s.startBtn}>
          <Text style={s.startBtnTxt}>
            {workoutTimer?.running || workoutTimer?.completed ? 'View Details →' : 'Start Workout →'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── Quick Stats ── */}
      <Text style={g.sec}>Quick Stats</Text>
      <View style={s.statsRow}>
        <View style={s.statChip}>
          <Text style={s.statVal}>{member.weight} kg</Text>
          <Text style={s.statLbl}>Weight</Text>
        </View>
        <View style={s.statChip}>
          <Text style={s.statVal}>{(member.weight / ((member.height / 100) ** 2)).toFixed(1)}</Text>
          <Text style={s.statLbl}>BMI</Text>
        </View>
        <View style={s.statChip}>
          <Text style={s.statVal}>17 Mar</Text>
          <Text style={s.statLbl}>Last Workout</Text>
        </View>
      </View>

      {/* ── Membership Strip ── */}
      <View style={[s.memberStrip, { borderLeftColor: daysColor }]}>
        <View>
          <Text style={s.memberPlan}>{member.plan} · {member.gym}</Text>
          <Text style={s.memberSub}>Valid until {member.validUntil}</Text>
        </View>
        <Text style={[s.daysLeft, { color: daysColor }]}>{member.daysLeft}d</Text>
      </View>

      {/* ── Video of the Day ── */}
      <Text style={g.sec}>Video of the Day</Text>
      <TouchableOpacity style={s.videoCard} onPress={() => onNavigate('Videos')}>
        <View style={s.videoThumb}>
          <Text style={{ fontSize: 32 }}>▶️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.videoTitle}>Full Body Warmup</Text>
          <Text style={s.videoSub}>Vishnu · 12 min · Cardio</Text>
        </View>
      </TouchableOpacity>

      {/* ── Trainer Chat ── */}
      <Text style={g.sec}>Your Trainer</Text>
      <TouchableOpacity style={s.trainerCard} onPress={() => onNavigate('TrainerChat')}>
        <Text style={{ fontSize: 28 }}>🏋️</Text>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.trainerCardTitle}>Chat with {member.trainer}</Text>
          <Text style={s.trainerCardSub}>Messages, voice notes & images</Text>
        </View>
        <View style={s.onlineChip}><Text style={s.onlineChipTxt}>● Online</Text></View>
      </TouchableOpacity>

      {/* ── Expert Consult ── */}
      <Text style={g.sec}>Expert Consult</Text>
      <TouchableOpacity style={s.consultCard} onPress={() => onNavigate('Consult')}>
        <View style={s.consultLeft}>
          <Text style={{ fontSize: 32 }}>🩺</Text>
          <View style={{ marginLeft: 14 }}>
            <Text style={s.consultTitle}>Talk to an Expert</Text>
            <Text style={s.consultSub}>Nutrition · Physiotherapy</Text>
            <Text style={s.consultPrice}>From ₹25 per session</Text>
          </View>
        </View>
        <Text style={s.consultArrow}>›</Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 20 },
  greet:           { fontSize: 22, fontWeight: '800', color: C.dark },
  date:            { fontSize: 13, color: C.mid, marginTop: 2 },
  notifBtn:        { position: 'relative', padding: 4 },
  badge:           { position: 'absolute', top: 0, right: 0, backgroundColor: C.red, borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeTxt:        { color: '#fff', fontSize: 9, fontWeight: '700' },
  workoutCard:     { backgroundColor: C.primary, borderRadius: 18, padding: 20, marginBottom: 20 },
  workoutTop:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  workoutLabel:    { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  workoutTime:     { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  workoutName:     { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  workoutSub:      { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  startBtn:        { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 12, alignItems: 'center' },
  startBtnTxt:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  timerPill:       { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6, marginBottom: 4, alignSelf: 'flex-start' },
  timerPillTxt:    { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  statsRow:        { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statChip:        { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, alignItems: 'center', elevation: 1 },
  statVal:         { fontSize: 15, fontWeight: '700', color: C.dark },
  statLbl:         { fontSize: 11, color: C.mid, marginTop: 3 },
  memberStrip:     { backgroundColor: C.card, borderRadius: 12, padding: 16, marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, elevation: 1 },
  memberPlan:      { fontSize: 13, fontWeight: '600', color: C.dark },
  memberSub:       { fontSize: 12, color: C.mid, marginTop: 2 },
  daysLeft:        { fontSize: 20, fontWeight: '800' },
  videoCard:       { backgroundColor: C.card, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, elevation: 1 },
  videoThumb:      { width: 60, height: 60, borderRadius: 12, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  videoTitle:      { fontSize: 15, fontWeight: '600', color: C.dark },
  videoSub:        { fontSize: 12, color: C.mid, marginTop: 3 },
  trainerCard:     { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: C.light, marginBottom: 4 },
  trainerCardTitle:{ fontSize: 15, fontWeight: '700', color: C.dark },
  trainerCardSub:  { fontSize: 12, color: C.mid, marginTop: 3 },
  onlineChip:      { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  onlineChipTxt:   { color: C.green, fontSize: 12, fontWeight: '700' },
  consultCard:     { backgroundColor: C.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2, borderWidth: 1, borderColor: C.light },
  consultLeft:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  consultTitle:    { fontSize: 16, fontWeight: '700', color: C.dark },
  consultSub:      { fontSize: 12, color: C.mid, marginTop: 3 },
  consultPrice:    { fontSize: 12, color: C.green, fontWeight: '600', marginTop: 4 },
  consultArrow:    { fontSize: 24, color: C.mid },
});