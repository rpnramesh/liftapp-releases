// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-012 Host Live Class (Agora.io WebRTC — Trainer Host)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScheduleStackParamList } from '../../navigation/TrainerNavigator';
import { LiveClassAPI } from '../../services/trainer.api';
import { useAsync } from '../../hooks/useTrainer';
import { ClassAttendee } from '../../types/trainer.types';
import { LIVE_CLASS } from '../../constants/trainer.constants';
import { Avatar, LiveBadge } from '../../components/common';

const TOKEN = '';
type Props = NativeStackScreenProps<ScheduleStackParamList, 'LiveClass'>;

export default function LiveClassScreen({ navigation, route }: Props) {
  const { classId } = route.params;
  const [isLive, setIsLive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [endingSummary, setEndingSummary] = useState<{ attendeeCount: number; averageRating: number | null } | null>(null);

  const fetchAttendees = useCallback(() => LiveClassAPI.getAttendees(classId), [classId]);
  const { data: attendees, refresh: refreshAttendees } = useAsync<ClassAttendee[]>(fetchAttendees);

  // Elapsed timer
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isLive]);

  // Poll attendees every 10s during class
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(refreshAttendees, 10_000);
    return () => clearInterval(t);
  }, [isLive, refreshAttendees]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleStartClass = async () => {
    try {
      const res = await LiveClassAPI.getHostToken(classId);
      // In production: init Agora SDK with res.agoraToken + res.channelName
      // RtcEngine.joinChannel(res.agoraToken, res.channelName, null, 0)
      setIsLive(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to start class');
    }
  };

  const handleEndClass = () => {
    Alert.alert('End Class', 'Are you sure you want to end the class for all participants?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'End Class', style: 'destructive',
        onPress: async () => {
          try {
            const summary = await LiveClassAPI.endClass(classId);
            setIsLive(false);
            setEndingSummary(summary);
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleMuteAll = () => {
    // Agora SDK: mute all audience
  };

  const handleUnmuteParticipant = (memberId: string) => {
    // Agora SDK: unmute specific participant
  };

  // Post-class summary screen
  if (endingSummary) {
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryEmoji}>🎉</Text>
        <Text style={styles.summaryTitle}>Class Ended!</Text>
        <Text style={styles.summaryMeta}>{endingSummary.attendeeCount} attended</Text>
        {endingSummary.averageRating != null && (
          <Text style={styles.summaryRating}>⭐ {endingSummary.averageRating.toFixed(1)} average rating</Text>
        )}
        {endingSummary.averageRating === null && (
          <Text style={styles.summaryRatingSub}>Ratings will appear once members submit them.</Text>
        )}
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.doneBtnText}>Back to Schedule</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera preview area — in production: Agora RtcLocalView.SurfaceView */}
      <View style={styles.cameraArea}>
        <Text style={styles.cameraPlaceholder}>📷 Camera Preview (Agora SDK)</Text>
        {isLive && (
          <View style={styles.liveOverlay}>
            <LiveBadge />
            <Text style={styles.elapsed}>{formatElapsed(elapsedSeconds)}</Text>
            <Text style={styles.participantCount}>{attendees?.length ?? 0} participants</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlBtn, micMuted && styles.controlBtnOff]} onPress={() => setMicMuted(m => !m)}>
          <Text style={styles.controlIcon}>{micMuted ? '🔇' : '🎤'}</Text>
          <Text style={styles.controlLabel}>{micMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, camOff && styles.controlBtnOff]} onPress={() => setCamOff(c => !c)}>
          <Text style={styles.controlIcon}>{camOff ? '📵' : '📷'}</Text>
          <Text style={styles.controlLabel}>{camOff ? 'Camera Off' : 'Camera On'}</Text>
        </TouchableOpacity>
        {isLive && (
          <TouchableOpacity style={styles.controlBtn} onPress={handleMuteAll}>
            <Text style={styles.controlIcon}>🔕</Text>
            <Text style={styles.controlLabel}>Mute All</Text>
          </TouchableOpacity>
        )}
        {!isLive ? (
          <TouchableOpacity style={styles.startBtn} onPress={handleStartClass}>
            <Text style={styles.startBtnText}>🔴 Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.endBtn} onPress={handleEndClass}>
            <Text style={styles.endBtnText}>⏹ End</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Participants with raised hands */}
      {isLive && attendees && attendees.some(a => a.hasRaisedHand) && (
        <View style={styles.raisedHandSection}>
          <Text style={styles.raisedHandTitle}>✋ Raised Hands</Text>
          {attendees.filter(a => a.hasRaisedHand).map(a => (
            <View key={a.memberId} style={styles.participantRow}>
              <Avatar uri={a.memberPhotoUrl} name={a.memberName} size={32} />
              <Text style={styles.participantName}>{a.memberName}</Text>
              <TouchableOpacity style={styles.unmuteBtn} onPress={() => handleUnmuteParticipant(a.memberId)}>
                <Text style={styles.unmuteBtnText}>Unmute</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* All participants list */}
      {attendees && attendees.length > 0 && (
        <View style={styles.attendeeList}>
          <Text style={styles.attendeeTitle}>Participants ({attendees.length})</Text>
          <FlatList
            data={attendees}
            horizontal
            keyExtractor={a => a.memberId}
            renderItem={({ item }) => (
              <View style={styles.attendeeChip}>
                <Avatar uri={item.memberPhotoUrl} name={item.memberName} size={28} />
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.dark },
  cameraArea: { flex: 1, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cameraPlaceholder: { color: C.mid, fontSize: 14 },
  liveOverlay: { position: 'absolute', top: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, alignItems: 'center' },
  elapsed: { color: C.white, fontWeight: '700', fontSize: 16 },
  participantCount: { color: C.white, fontSize: 13, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  controls: { flexDirection: 'row', backgroundColor: '#1F2937', padding: 16, gap: 12, justifyContent: 'center', alignItems: 'center' },
  controlBtn: { alignItems: 'center', backgroundColor: '#374151', borderRadius: 12, padding: 12, minWidth: 64 },
  controlBtnOff: { backgroundColor: C.red },
  controlIcon: { fontSize: 24 },
  controlLabel: { color: C.white, fontSize: 10, marginTop: 4 },
  startBtn: { backgroundColor: C.red, borderRadius: 12, padding: 14, minWidth: 80, alignItems: 'center' },
  startBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  endBtn: { backgroundColor: '#374151', borderRadius: 12, padding: 14, minWidth: 80, alignItems: 'center' },
  endBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  raisedHandSection: { backgroundColor: '#1F2937', padding: 12, gap: 8 },
  raisedHandTitle: { color: C.white, fontWeight: '700', fontSize: 14 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  participantName: { flex: 1, color: C.white, fontSize: 14 },
  unmuteBtn: { backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  unmuteBtnText: { color: C.white, fontSize: 12, fontWeight: '600' },
  attendeeList: { backgroundColor: C.dark, padding: 12 },
  attendeeTitle: { color: C.light, fontSize: 12, marginBottom: 8 },
  attendeeChip: { marginRight: 6 },
  summaryContainer: { flex: 1, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  summaryEmoji: { fontSize: 60 },
  summaryTitle: { fontSize: 26, fontWeight: '700', color: C.dark },
  summaryMeta: { fontSize: 16, color: '#374151' },
  summaryRating: { fontSize: 18, color: C.amber, fontWeight: '700' },
  summaryRatingSub: { fontSize: 13, color: C.light, textAlign: 'center' },
  doneBtn: { marginTop: 16, backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 },
  doneBtnText: { color: C.white, fontWeight: '700', fontSize: 16 },
});
