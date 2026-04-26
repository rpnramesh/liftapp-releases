// ─────────────────────────────────────────────────────────────────────────────
// SwipeableSetRow — swipe-right gesture to mark a set complete.
//
//   CRITICAL ARCHITECTURE NOTE (keyboard focus bug fix):
//   ─────────────────────────────────────────────────────
//   The {…pan.panHandlers} MUST live on the outer wrapper View, NOT on the
//   Animated.View that translates the content.
//
//   WHY: When panHandlers are spread onto Animated.View, Android's native
//   animation layer processes the touch event BEFORE the JS PanResponder
//   negotiation. Even though onStartShouldSetPanResponder returns false at
//   the JS level, the native layer can still intercept the touch — preventing
//   TextInput.focus() from firing. No keyboard appears, no cursor, nothing.
//
//   SOLUTION: Put panHandlers on the outer plain View (no native animation
//   layer). The Animated.View inside only carries {transform: [{translateX}]}
//   for visual movement — it has NO touch handlers at all. TextInputs inside
//   the Animated.View now receive touches through their own responder path,
//   completely bypassing the pan responder hierarchy until a real swipe starts.
//
//   Gesture rules:
//     • Touch START: outer View returns false → TextInput claims the responder
//       and gets focus → keyboard appears. ✓
//     • Touch MOVE (dx > 8, mostly horizontal): outer View claims the
//       responder from whoever has it → swipe proceeds. ✓
//     • Released: snap back. Both capture variants are false so TextInput
//       text-selection drag is never blocked. ✓
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../constants/theme';

const THRESHOLD    = 72;   // px of rightward drag to trigger complete
const MAX_DRAG     = 120;  // rubber-band clamp at this px

export default function SwipeableSetRow({
  children,
  done    = false,
  onComplete,
  enabled = true,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const fired      = useRef(false);

  const pan = useRef(
    PanResponder.create({
      // ── Never claim the touch on START ────────────────────────────────────
      // This is what lets TextInput children receive focus when tapped.
      // Both the regular and capture variants return false so we never steal
      // the initial touch from any child component.
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // ── Claim on MOVE only for a clear rightward swipe ────────────────────
      // Requires > 8px horizontal movement that is more horizontal than vertical.
      // The capture variant stays false so TextInput text-selection drag works.
      onMoveShouldSetPanResponder: (_, g) =>
        enabled && !done && g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: () => {
        fired.current = false;
      },

      onPanResponderMove: (_, g) => {
        if (!enabled || done || fired.current) return;
        // Rubber-band: free movement up to MAX_DRAG, then 35% rate beyond it
        const dx = g.dx <= 0
          ? 0
          : g.dx <= MAX_DRAG
            ? g.dx
            : MAX_DRAG + (g.dx - MAX_DRAG) * 0.35;
        translateX.setValue(dx);

        // Fire at threshold with haptic — action is instant, no need to release
        if (!fired.current && g.dx >= THRESHOLD) {
          fired.current = true;
          Vibration.vibrate(12);
          onComplete?.();
        }
      },

      onPanResponderRelease: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
          speed: 14,
        }).start();
      },

      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Success wash opacity — grows as the row approaches threshold
  const washOpacity = translateX.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Check-mark hint scales in as threshold approaches
  const checkScale = translateX.interpolate({
    inputRange: [0, THRESHOLD / 2, THRESHOLD],
    outputRange: [0.4, 0.8, 1.1],
    extrapolate: 'clamp',
  });

  return (
    // ── panHandlers go HERE (outer plain View) ────────────────────────────────
    // A plain View has NO native animation layer, so it never intercepts touches
    // at the native level. onStartShouldSetPanResponder:()=>false ensures children
    // (TextInputs) get the touch on tap. panHandlers only kick in on a swipe move.
    <View style={styles.wrap} {...pan.panHandlers}>

      {/* Success wash — rendered behind, pointerEvents none so it's purely visual */}
      <Animated.View
        pointerEvents="none"
        style={[styles.wash, { opacity: washOpacity }]}
      >
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          <Ionicons name="checkmark-circle" size={28} color={theme.success[600]} />
        </Animated.View>
      </Animated.View>

      {/* Content — Animated.View with ONLY the transform, zero touch handlers.
          This is the key fix: no {…pan.panHandlers} here, so Android's native
          animation layer doesn't intercept child TextInput touch events.       */}
      <Animated.View style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    // No overflow: 'hidden' here — that can clip touch areas on Android
  },
  wash: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: theme.success[50],
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
