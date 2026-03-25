// ── CONSULT HOME SCREEN ──────────────────────────────────
// Landing page for the Expert Consult feature.
// Shows Nutrition and Physio categories, pricing, and past sessions.
//
// Props:
//   onBack           – go back to main app
//   chatHistory      – array of previous session records
//   onSelectCategory – function(category) called when a card is tapped

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import C from '../../constants/colors';
import g from '../../styles/global';
import { CONSULTANTS } from '../../constants/data';

export function ConsultHomeScreen({ onSelectCategory, onBack, chatHistory }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}><Text style={s.backBtn}>← Back</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Consult</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView style={{ padding: 16 }}>
        <Text style={s.heroTitle}>Talk to an Expert</Text>
        <Text style={s.heroSub}>Get personalised advice from certified professionals</Text>

        {/* ── Nutrition Card ── */}
        <TouchableOpacity style={s.categoryCard} onPress={() => onSelectCategory('Nutrition')}>
          <View style={[s.categoryIcon, { backgroundColor: '#D1FAE5' }]}>
            <Text style={{ fontSize: 32 }}>🥗</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.categoryName}>Nutrition</Text>
            <Text style={s.categorySub}>Diet plans, weight management & sports nutrition</Text>
            <Text style={s.categoryAvail}>
              {CONSULTANTS.Nutrition.filter(c => c.available).length} available now
            </Text>
          </View>
          <Text style={{ color: C.mid, fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* ── Physio Card ── */}
        <TouchableOpacity style={s.categoryCard} onPress={() => onSelectCategory('Physio')}>
          <View style={[s.categoryIcon, { backgroundColor: '#DBEAFE' }]}>
            <Text style={{ fontSize: 32 }}>🦴</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.categoryName}>Physiotherapy</Text>
            <Text style={s.categorySub}>Injury rehab, muscle recovery & joint care</Text>
            <Text style={s.categoryAvail}>
              {CONSULTANTS.Physio.filter(c => c.available).length} available now
            </Text>
          </View>
          <Text style={{ color: C.mid, fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* ── Pricing ── */}
        <Text style={g.sec}>Pricing</Text>
        <View style={s.pricingCard}>
          <View style={s.pricingRow}>
            <View style={s.pricingIcon}><Text style={{ fontSize: 20 }}>💬</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.pricingTitle}>Text Chat</Text>
              <Text style={s.pricingSub}>10 minute chat window</Text>
            </View>
            <Text style={s.pricingAmt}>₹25</Text>
          </View>
        </View>

        {/* ── Previous Sessions ── */}
        {chatHistory.length > 0 && (
          <>
            <Text style={g.sec}>Previous Sessions</Text>
            {[...chatHistory].reverse().slice(0, 3).map((session) => (
              <TouchableOpacity
                key={session.id}
                style={s.prevCard}
                onPress={() => onSelectCategory('prev_' + session.id)}>
                <Text style={{ fontSize: 22 }}>💬</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.prevName}>{session.consultantName}</Text>
                  <Text style={s.prevMeta}>
                    {session.category} · {session.date} · 10 min chat
                  </Text>
                </View>
                <View style={s.endedBadge}><Text style={s.endedBadgeTxt}>View</Text></View>
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── CONSULTANT LIST SCREEN ────────────────────────────────
// Lists all consultants in a given category (Nutrition or Physio).
// Offline consultants are greyed out and not tappable.
//
// Props:
//   category          – 'Nutrition' or 'Physio'
//   onBack            – go back to ConsultHomeScreen
//   onSelectConsultant– function(consultant) when a card is tapped

export function ConsultantListScreen({ category, onSelectConsultant, onBack }) {
  const consultants = CONSULTANTS[category];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}><Text style={s.backBtn}>← Back</Text></TouchableOpacity>
        <Text style={s.headerTitle}>{category}</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView style={{ padding: 16 }}>
        <Text style={s.listHint}>
          {consultants.filter(c => c.available).length} of {consultants.length} consultants available now
        </Text>
        {consultants.map(consultant => (
          <TouchableOpacity
            key={consultant.id}
            style={[s.consultantCard, !consultant.available && s.consultantCardOff]}
            onPress={() => consultant.available && onSelectConsultant(consultant)}
            disabled={!consultant.available}>
            <View style={s.consultantAvatarWrap}>
              <Text style={{ fontSize: 28 }}>{consultant.avatar}</Text>
              <View style={[s.availDot, { backgroundColor: consultant.available ? C.green : C.mid }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.consultantName}>{consultant.name}</Text>
              <Text style={s.consultantSpec}>{consultant.spec}</Text>
              <Text style={s.consultantHours}>🕐 {consultant.hours}</Text>
              <View style={s.consultantMeta}>
                <Text style={s.metaStar}>⭐ {consultant.rating}</Text>
                <Text style={s.metaSessions}>{consultant.sessions} sessions</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[s.statusBadge, { backgroundColor: consultant.available ? '#D1FAE5' : '#F3F4F6' }]}>
                <Text style={[s.statusBadgeTxt, { color: consultant.available ? C.green : C.mid }]}>
                  {consultant.available ? 'Available' : 'Offline'}
                </Text>
              </View>
              {consultant.available && (
                <Text style={{ color: C.primary, marginTop: 8, fontSize: 13 }}>Consult →</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── CONSULT DETAIL SCREEN ─────────────────────────────────
// Shows full profile of a selected consultant and the session options.
//
// Props:
//   consultant  – the selected consultant object
//   category    – 'Nutrition' or 'Physio'
//   onBack      – go back to the list
//   onStartChat – function to begin a chat session

export function ConsultDetailScreen({ consultant, category, onStartChat, onBack }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}><Text style={s.backBtn}>← Back</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Choose Session</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView style={{ padding: 16 }}>
        <View style={s.profileCard}>
          <Text style={{ fontSize: 56, marginBottom: 10 }}>{consultant.avatar}</Text>
          <Text style={s.profileName}>{consultant.name}</Text>
          <Text style={s.profileSpec}>{consultant.spec} · {category}</Text>
          <View style={s.profileMeta}>
            <Text style={s.metaStar}>⭐ {consultant.rating}</Text>
            <Text style={{ color: C.mid, marginHorizontal: 8 }}>·</Text>
            <Text style={s.metaSessions}>{consultant.sessions} sessions</Text>
          </View>
          <View style={s.availBadgeLarge}>
            <View style={[s.availDotLarge, { backgroundColor: C.green }]} />
            <Text style={s.availBadgeTxt}>Available now · {consultant.hours}</Text>
          </View>
        </View>

        <Text style={g.sec}>Session Details</Text>
        <TouchableOpacity style={s.sessionCard} onPress={onStartChat}>
          <View style={[s.sessionIcon, { backgroundColor: '#D1FAE5' }]}>
            <Text style={{ fontSize: 28 }}>💬</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.sessionTitle}>Text & Voice Chat</Text>
            <Text style={s.sessionDesc}>
              Send text messages, voice notes and images for 10 minutes.
              Session auto-closes after the window ends.
            </Text>
            <Text style={s.sessionDuration}>⏱ 10 min window</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.sessionPrice}>₹25</Text>
            <Text style={s.sessionPriceSub}>per session</Text>
          </View>
        </TouchableOpacity>

        <View style={s.noteCard}>
          <Text style={s.noteTxt}>
            💡 Sessions are paid and non-refundable. The session will automatically end after the time limit.
          </Text>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── SHARED STYLES ─────────────────────────────────────────
const s = StyleSheet.create({
  header:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.light, backgroundColor: C.card },
  backBtn:             { color: C.primary, fontSize: 15, width: 60 },
  headerTitle:         { fontSize: 16, fontWeight: '700', color: C.dark },
  heroTitle:           { fontSize: 24, fontWeight: '800', color: C.dark, marginBottom: 6 },
  heroSub:             { fontSize: 14, color: C.mid, marginBottom: 24 },
  categoryCard:        { backgroundColor: C.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.light },
  categoryIcon:        { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  categoryName:        { fontSize: 17, fontWeight: '700', color: C.dark },
  categorySub:         { fontSize: 12, color: C.mid, marginTop: 3, lineHeight: 18 },
  categoryAvail:       { fontSize: 12, color: C.green, fontWeight: '600', marginTop: 6 },
  pricingCard:         { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', elevation: 1 },
  pricingRow:          { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  pricingIcon:         { width: 40, height: 40, borderRadius: 12, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  pricingTitle:        { fontSize: 15, fontWeight: '600', color: C.dark },
  pricingSub:          { fontSize: 12, color: C.mid, marginTop: 2 },
  pricingAmt:          { fontSize: 20, fontWeight: '800', color: C.primary },
  prevCard:            { backgroundColor: C.card, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, elevation: 1 },
  prevName:            { fontSize: 14, fontWeight: '600', color: C.dark },
  prevMeta:            { fontSize: 12, color: C.mid, marginTop: 2 },
  endedBadge:          { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  endedBadgeTxt:       { color: C.red, fontSize: 12, fontWeight: '700' },
  listHint:            { fontSize: 13, color: C.mid, marginBottom: 16, fontStyle: 'italic' },
  consultantCard:      { backgroundColor: C.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: C.light },
  consultantCardOff:   { opacity: 0.55 },
  consultantAvatarWrap:{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue2, alignItems: 'center', justifyContent: 'center' },
  availDot:            { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: C.card },
  consultantName:      { fontSize: 15, fontWeight: '700', color: C.dark },
  consultantSpec:      { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 2 },
  consultantHours:     { fontSize: 12, color: C.mid, marginTop: 4 },
  consultantMeta:      { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  metaStar:            { fontSize: 12, color: C.amber, fontWeight: '600' },
  metaSessions:        { fontSize: 12, color: C.mid },
  statusBadge:         { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeTxt:      { fontSize: 12, fontWeight: '700' },
  profileCard:         { backgroundColor: C.card, borderRadius: 18, padding: 24, alignItems: 'center', elevation: 1, marginBottom: 8 },
  profileName:         { fontSize: 20, fontWeight: '800', color: C.dark, marginBottom: 4 },
  profileSpec:         { fontSize: 14, color: C.mid },
  profileMeta:         { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  availBadgeLarge:     { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, gap: 6 },
  availDotLarge:       { width: 8, height: 8, borderRadius: 4 },
  availBadgeTxt:       { fontSize: 12, color: C.green, fontWeight: '600' },
  sessionCard:         { backgroundColor: C.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14, elevation: 1, borderWidth: 1, borderColor: C.light },
  sessionIcon:         { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sessionTitle:        { fontSize: 16, fontWeight: '700', color: C.dark, marginBottom: 4 },
  sessionDesc:         { fontSize: 12, color: C.mid, lineHeight: 18 },
  sessionDuration:     { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 6 },
  sessionPrice:        { fontSize: 22, fontWeight: '800', color: C.primary },
  sessionPriceSub:     { fontSize: 11, color: C.mid, marginTop: 2 },
  noteCard:            { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14 },
  noteTxt:             { fontSize: 13, color: '#92400E', lineHeight: 20 },
});