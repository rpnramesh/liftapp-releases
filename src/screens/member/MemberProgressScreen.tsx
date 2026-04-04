// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Progress Screen (placeholder)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MemberProgressScreen() {
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.center}>
        <Text style={st.icon}>📈</Text>
        <Text style={st.title}>Body Progress</Text>
        <Text style={st.sub}>Weight & measurements tracking coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0B0F' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { color: '#F1F3F9', fontSize: 20, fontWeight: '700' },
  sub: { color: '#5A5F6B', fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
});
