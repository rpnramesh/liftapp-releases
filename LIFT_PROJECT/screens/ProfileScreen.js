// ── PROFILE SCREEN ───────────────────────────────────────
// Shows member details, editable fields, trainer chat shortcut,
// language/unit preferences, membership info, and logout.
//
// Props:
//   member          – member data object
//   onUpdateMember  – function(changes) to update member fields
//   onLogout        – function called on logout
//   onTrainerChat   – function to open the trainer chat screen

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput,
} from 'react-native';
import C from '../constants/colors';
import g from '../styles/global';

export default function ProfileScreen({ member, onUpdateMember, onLogout, onTrainerChat }) {
  const [unit, setUnit]               = useState('Metric');
  const [lang, setLang]               = useState('EN');
  const [editingField, setEditingField] = useState(null);

  const [draft, setDraft] = useState({
    name:       member.name,
    phone:      member.phone,
    height:     String(member.height),
    weight:     String(member.weight),
    goalWeight: String(member.goalWeight),
  });

  const editableFields = [
    { key: '👤 Name',           field: 'name',       keyboard: 'default',     suffix: ''    },
    { key: '📱 Phone',          field: 'phone',      keyboard: 'phone-pad',   suffix: ''    },
    { key: '📏 Height',         field: 'height',     keyboard: 'decimal-pad', suffix: ' cm' },
    { key: '⚖️ Current Weight', field: 'weight',     keyboard: 'decimal-pad', suffix: ' kg' },
    { key: '🎯 Goal Weight',    field: 'goalWeight', keyboard: 'decimal-pad', suffix: ' kg' },
  ];

  const handleConfirm = (field) => {
    setEditingField(null);
    const numericFields = ['height', 'weight', 'goalWeight'];
    const val = numericFields.includes(field)
      ? parseFloat(draft[field]) || member[field]
      : draft[field];
    onUpdateMember({ [field]: val });
  };

  return (
    <ScrollView style={g.screen}>

      {/* ── Avatar & Name ── */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{member.name[0]}</Text>
        </View>
        <Text style={s.name}>{member.name}</Text>
        <View style={s.memberTag}><Text style={s.memberTagTxt}>Gym Member</Text></View>
        <Text style={s.gym}>{member.gym}</Text>
      </View>

      {/* ── Member Details ── */}
      <Text style={g.sec}>My Details</Text>
      <View style={s.row}>
        <Text style={s.rowKey}>🏋️ Trainer</Text>
        <Text style={s.rowVal}>{member.trainer}</Text>
      </View>

      {editableFields.map(({ key, field, keyboard, suffix }) => {
        const isEditing = editingField === field;
        return (
          <View key={field} style={s.row}>
            <Text style={s.rowKey}>{key}</Text>
            <View style={s.editWrapper}>
              {isEditing ? (
                <TextInput
                  style={s.inlineInput}
                  value={draft[field]}
                  onChangeText={val => setDraft(prev => ({ ...prev, [field]: val }))}
                  keyboardType={keyboard}
                  autoFocus
                  onBlur={() => handleConfirm(field)}
                  onSubmitEditing={() => handleConfirm(field)}
                />
              ) : (
                <Text style={s.rowVal}>{draft[field]}{suffix}</Text>
              )}
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => isEditing ? handleConfirm(field) : setEditingField(field)}>
                <Text style={s.editBtnTxt}>{isEditing ? '✓' : '✏️'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* ── Trainer Chat ── */}
      <Text style={g.sec}>Trainer</Text>
      <TouchableOpacity style={s.trainerChatCard} onPress={onTrainerChat}>
        <Text style={{ fontSize: 28 }}>🏋️</Text>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.trainerChatTitle}>Chat with {member.trainer}</Text>
          <Text style={s.trainerChatSub}>Send messages, voice notes & images</Text>
        </View>
        <View style={s.onlineBadge}><Text style={s.onlineTxt}>● Online</Text></View>
      </TouchableOpacity>

      {/* ── Preferences ── */}
      <Text style={g.sec}>Preferences</Text>
      <View style={s.prefCard}>
        <View style={s.prefRow}>
          <Text style={s.prefKey}>Language</Text>
          <View style={s.toggle}>
            {['EN', 'ML'].map(l => (
              <TouchableOpacity
                key={l}
                style={[s.toggleOpt, lang === l && s.toggleOptOn]}
                onPress={() => setLang(l)}>
                <Text style={[{ fontSize: 12, fontWeight: '600' }, lang === l && { color: '#fff' }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={s.prefRow}>
          <Text style={s.prefKey}>Units</Text>
          <View style={s.toggle}>
            {['Metric', 'Imperial'].map(u => (
              <TouchableOpacity
                key={u}
                style={[s.toggleOpt, unit === u && s.toggleOptOn]}
                onPress={() => setUnit(u)}>
                <Text style={[{ fontSize: 12, fontWeight: '600' }, unit === u && { color: '#fff' }]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── Membership ── */}
      <Text style={g.sec}>Membership</Text>
      <View style={s.memberCard}>
        <Text style={s.planName}>{member.plan} Plan</Text>
        <Text style={s.planSub}>Valid until {member.validUntil} · {member.daysLeft} days left</Text>
        <TouchableOpacity style={s.renewBtn}>
          <Text style={s.renewBtnTxt}>Renew Membership</Text>
        </TouchableOpacity>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
        <Text style={s.logoutTxt}>Log Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header:           { alignItems: 'center', paddingVertical: 24 },
  avatar:           { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTxt:        { fontSize: 34, fontWeight: '800', color: '#fff' },
  name:             { fontSize: 22, fontWeight: '800', color: C.dark },
  memberTag:        { backgroundColor: C.blue2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 6 },
  memberTagTxt:     { color: C.primary, fontSize: 12, fontWeight: '600' },
  gym:              { fontSize: 13, color: C.mid, marginTop: 6 },
  row:              { backgroundColor: C.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 1, borderRadius: 2 },
  rowKey:           { fontSize: 14, color: C.mid, flex: 1 },
  rowVal:           { fontSize: 14, fontWeight: '600', color: C.dark },
  editWrapper:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput:      { fontSize: 14, fontWeight: '600', color: C.dark, borderBottomWidth: 1.5, borderBottomColor: C.primary, paddingVertical: 2, paddingHorizontal: 4, minWidth: 80, textAlign: 'right' },
  editBtn:          { padding: 4 },
  editBtnTxt:       { fontSize: 14 },
  trainerChatCard:  { backgroundColor: C.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: C.light },
  trainerChatTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  trainerChatSub:   { fontSize: 12, color: C.mid, marginTop: 3 },
  onlineBadge:      { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  onlineTxt:        { color: C.green, fontSize: 12, fontWeight: '700' },
  prefCard:         { backgroundColor: C.card, borderRadius: 14, padding: 4, elevation: 1 },
  prefRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  prefKey:          { fontSize: 14, color: C.dark },
  toggle:           { flexDirection: 'row', backgroundColor: C.light, borderRadius: 8, padding: 2 },
  toggleOpt:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  toggleOptOn:      { backgroundColor: C.primary },
  memberCard:       { backgroundColor: C.card, borderRadius: 14, padding: 18, elevation: 1 },
  planName:         { fontSize: 17, fontWeight: '700', color: C.dark },
  planSub:          { fontSize: 13, color: C.mid, marginTop: 4 },
  renewBtn:         { marginTop: 14, backgroundColor: C.blue2, borderRadius: 10, padding: 12, alignItems: 'center' },
  renewBtnTxt:      { color: C.primary, fontWeight: '700', fontSize: 14 },
  logoutBtn:        { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 24 },
  logoutTxt:        { color: C.red, fontWeight: '700', fontSize: 16 },
});