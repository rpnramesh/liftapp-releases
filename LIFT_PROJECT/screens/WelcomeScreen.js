// ── WELCOME SCREEN ───────────────────────────────────────
// The landing screen with "Join Now" and "Log In" buttons.
// Props:
//   onLogin – function called when either button is pressed

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import C from '../constants/colors';

export default function WelcomeScreen({ onLogin }) {
  return (
    <View style={s.container}>
      <View style={s.top}>
        <Text style={s.logo}>LIFT</Text>
        <Text style={s.tagline}>Your fitness. Your gym.{'\n'}All in one place.</Text>
      </View>
      <View style={s.bottom}>
        <TouchableOpacity style={s.btnPrimary} onPress={onLogin}>
          <Text style={s.btnPrimaryTxt}>Join Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={onLogin}>
          <Text style={s.btnSecondaryTxt}>Log In</Text>
        </TouchableOpacity>
        <Text style={s.hint}>Available in English | മലയാളം</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.primary },
  top:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  logo:         { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: 5 },
  tagline:      { fontSize: 17, color: 'rgba(255,255,255,0.85)', marginTop: 16, textAlign: 'center', lineHeight: 26 },
  bottom:       { padding: 32, paddingBottom: 48 },
  btnPrimary:   { backgroundColor: '#fff', borderRadius: 14, padding: 17, alignItems: 'center', marginBottom: 12 },
  btnPrimaryTxt:{ color: C.primary, fontWeight: '700', fontSize: 16 },
  btnSecondary: { borderWidth: 2, borderColor: '#fff', borderRadius: 14, padding: 17, alignItems: 'center', marginBottom: 20 },
  btnSecondaryTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint:         { color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 12 },
});