// ── EXERCISE VIDEO PLAYER ────────────────────────────────
// Reusable video player used inside the workout logging screen.
// Props:
//   uri          (string) – URL of the video to play
//   exerciseName (string) – Label shown above the player

import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import C from '../constants/colors';
import { formatMs } from '../utils/formatters';

export default function ExerciseVideo({ uri, exerciseName }) {
  const videoRef = useRef(null);
  const [status, setStatus]   = useState({});
  const [loading, setLoading] = useState(true);

  const isPlaying = status.isPlaying;

  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      if (status.didJustFinish) {
        await videoRef.current.replayAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
  };

  const progress = status.durationMillis
    ? status.positionMillis / status.durationMillis
    : 0;

  return (
    <View style={s.container}>
      {/* Label */}
      <View style={s.labelRow}>
        <Text style={s.labelIcon}>🎬</Text>
        <Text style={s.labelText}>Exercise Demo · {exerciseName}</Text>
      </View>

      {/* Video */}
      <View style={s.videoWrapper}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={s.video}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={st => {
            setStatus(st);
            if (st.isLoaded) setLoading(false);
          }}
          onLoadStart={() => setLoading(true)}
          shouldPlay={false}
          isLooping={false}
          useNativeControls={false}
        />

        {/* Loading overlay */}
        {loading && (
          <View style={s.overlay}>
            <Text style={s.overlayText}>Loading…</Text>
          </View>
        )}

        {/* Replay overlay */}
        {status.didJustFinish && !isPlaying && (
          <View style={s.overlay}>
            <TouchableOpacity onPress={togglePlay} style={s.replayBtn}>
              <Text style={s.replayIcon}>↺</Text>
              <Text style={s.replayText}>Replay</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={s.controls}>
        <TouchableOpacity onPress={togglePlay} style={s.playBtn} disabled={loading}>
          <Text style={s.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>

        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <Text style={s.time}>
          {formatMs(status.positionMillis)} / {formatMs(status.durationMillis)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { backgroundColor: '#0F172A', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  labelRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 6 },
  labelIcon:    { fontSize: 13 },
  labelText:    { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.4 },
  videoWrapper: { width: '100%', height: 190, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  video:        { width: '100%', height: '100%' },
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  overlayText:  { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  replayBtn:    { alignItems: 'center' },
  replayIcon:   { fontSize: 36, color: '#fff' },
  replayText:   { color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '600' },
  controls:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  playBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  playIcon:     { fontSize: 14 },
  progressTrack:{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  time:         { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500', minWidth: 72, textAlign: 'right' },
});