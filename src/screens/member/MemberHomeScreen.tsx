// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Home Screen (placeholder)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

export default function MemberHomeScreen() {
  const { gymId } = useAuth();
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.center}>
        <Text style={st.icon}>🏠</Text>
        <Text style={st.title}>Member Home</Text>
        <Text style={st.sub}>Dashboard coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0B0F' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { color: '#F1F3F9', fontSize: 20, fontWeight: '700' },
  sub: { color: '#5A5F6B', fontSize: 14, marginTop: 6 },
});
