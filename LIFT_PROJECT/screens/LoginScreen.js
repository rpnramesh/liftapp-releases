// ── LOGIN SCREEN ─────────────────────────────────────────
// Handles user sign-in. Shows username/email + password fields.
// Props:
//   onSuccess – function called after successful login

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import C from '../constants/colors';

export default function LoginScreen({ onSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState('');

  const handleLogin = () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your username / email and password.');
      return;
    }
    setError('');
    onSuccess();
  };

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.heading}>Welcome back!</Text>
      <Text style={s.sub}>Sign in to continue</Text>

      <Text style={s.label}>Username or Email</Text>
      <TextInput
        style={s.input}
        placeholder="Enter username or email"
        placeholderTextColor={C.mid}
        value={identifier}
        onChangeText={t => { setIdentifier(t); setError(''); }}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={s.label}>Password</Text>
      <View style={s.passRow}>
        <TextInput
          style={s.passInput}
          placeholder="Enter password"
          placeholderTextColor={C.mid}
          value={password}
          onChangeText={t => { setPassword(t); setError(''); }}
          secureTextEntry={!showPass}
        />
        <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
          <Text style={{ fontSize: 20 }}>{showPass ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.forgotRow}>
        <Text style={s.forgotTxt}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btn, (!identifier.trim() || !password.trim()) && s.btnDisabled]}
        disabled={!identifier.trim() || !password.trim()}
        onPress={handleLogin}>
        <Text style={s.btnTxt}>Log In</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, padding: 28, paddingTop: 60 },
  heading:    { fontSize: 28, fontWeight: '800', color: C.dark, lineHeight: 38 },
  sub:        { fontSize: 14, color: C.mid, marginTop: 8, marginBottom: 24 },
  label:      { fontSize: 13, fontWeight: '700', color: C.dark, marginBottom: 6, marginTop: 20 },
  input:      { backgroundColor: C.card, borderRadius: 12, padding: 16, fontSize: 16, color: C.dark, borderWidth: 1, borderColor: C.light },
  passRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.light, paddingRight: 12 },
  passInput:  { flex: 1, padding: 16, fontSize: 16, color: C.dark },
  eyeBtn:     { padding: 4 },
  error:      { color: C.red, fontSize: 13, marginTop: 10, fontWeight: '500' },
  forgotRow:  { alignSelf: 'flex-end', marginTop: 10, marginBottom: 20 },
  forgotTxt:  { color: C.primary, fontSize: 13, fontWeight: '600' },
  btn:        { backgroundColor: C.primary, borderRadius: 14, padding: 17, alignItems: 'center' },
  btnDisabled:{ backgroundColor: C.light },
  btnTxt:     { color: '#fff', fontWeight: '700', fontSize: 16 },
});