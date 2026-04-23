// ─────────────────────────────────────────────────────────────────────────────
// SwipeableSetRow — wraps a set row with a horizontal swipe-right gesture that
// triggers the same "mark set done" action as tapping the green checkmark.
//
//   Behavior:
//     • Pan right past `threshold` → fires onComplete(), row snaps back.
//     • Pan left is ignored (sets don't un-complete via swipe — tap the check
//       instead; prevents accidental reverts).
//     • As the user drags, a green success wash fades in behind the row at
//       proportional opacity — so the action is discoverable without a label.
//     • Disabled when `done === true`, so completed rows stay static.
//
//   Usage — wrap the existing <View style={[lv.setRow, ...]}> like this:
//
//     <SwipeableSetRow
//       done={isDoneSet}
//       onComplete={() => markSetDone(exIdx, setIdx)}
//     >
//       <View style={[lv.setRow, isDoneSet && lv.setRowDone]}>
//         ...set number · last · reps · weight · done button...
//       </View>
//     </SwipeableSetRow>
//
//   The original tap-to-complete button stays — swipe is additive, not a
//   replacement. Mid-age users still get the familiar button; younger users
//   discover the gesture.
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

const THRESHOLD = 72;        // px of right-pan required to trigger complete
const MAX_TRANSLATE = 120;   // clamp max drag distance

export default function SwipeableSetRow({
  children,
  done = false,
  onComplete,
  enabled = true,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);

  const pan = useRef(
    PanResponder.create({
      // Only activate for clearly horizontal right-swipes; vertical scrolls
      // bubble up to the parent ScrollView.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        enabled && !done && g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,

      onPanResponderGrant: () => {
        fired.current = false;
      },

      onPanResponderMove: (_, g) => {
        if (!enabled || done || fired.current) return;
        // Clamp: allow slight over-drag with a rubber-band feel past max
        const dx = g.dx < 0
          ? 0
          : g.dx <= MAX_TRANSLATE
            ? g.dx
            : MAX_TRANSLATE + (g.dx - MAX_TRANSLATE) * 0.35;
        translateX.setValue(dx);

        // Haptic tick + fire once we cross the threshold during the drag,
        // so the action feels instant and the user doesn't have to fully
        // release to confirm.
        if (!fired.current && g.dx >= THRESHOLD) {
          fired.current = true;
          Vibration.vibrate(12);
          onComplete && onComplete();
        }
      },

      onPanResponderRelease: () => {
        // Always snap back — the row's new "done" style is what confirms
        // completion, not a persistent offset.
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

  // Success wash — fades from transparent to success-100 as user drags.
  const washOpacity = translateX.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Check-mark hint on the left edge — scales up as threshold approaches.
  const checkScale = translateX.interpolate({
    inputRange: [0, THRESHOLD / 2, THRESHOLD],
    outputRange: [0.4, 0.8, 1.1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrap}>
      {/* Underlying success wash + hint icon */}
      <Animated.View
        pointerEvents="none"
        style={[styles.wash, { opacity: washOpacity }]}
      >
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          <Ionicons name="checkmark-circle" size={28} color={theme.success[600]} />
        </Animated.View>
      </Animated.View>

      {/* Draggable content */}
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  wash: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: theme.success[50],
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
