// ── SPLASH SCREEN ────────────────────────────────────────
// Shown for ~2 seconds when the app first opens.
// Props:
//   onDone – function called when animation finishes (navigates to Welcome)

import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import C from '../constants/colors';

export default function SplashScreen({ onDone }) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: fade }]}>
      <Text style={s.logo}>LIFT</Text>
      <Text style={s.tagline}>The Complete Fitness Ecosystem</Text>
      <Text style={s.sub}>Kerala</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  logo:      { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: 6 },
  tagline:   { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 10 },
  sub:       { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, letterSpacing: 3 },
});