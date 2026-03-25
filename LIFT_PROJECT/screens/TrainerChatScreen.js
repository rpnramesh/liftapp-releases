// ── TRAINER CHAT SCREEN ──────────────────────────────────
// Direct messaging UI between the member and their assigned trainer.
// Supports text messages, voice notes (simulated), and image sharing.
//
// Props:
//   member           – member data object
//   onBack           – function to return to the previous screen
//   trainerMessages  – persisted message array from parent state
//   setTrainerMessages – function to update messages in parent state

import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, TextInput, Alert,
} from 'react-native';
import C from '../constants/colors';

let Audio;
try { Audio = require('expo-av').Audio; } catch (_) {}

const TRAINER_REPLIES = [
  'Great work! Keep pushing — you are making solid progress.',
  'For this exercise, focus on form over weight. Quality reps matter more.',
  'Make sure you are getting enough protein. Aim for 1.6g per kg of bodyweight.',
  'Rest days are just as important as training days. Recovery is key!',
  'Lets adjust your program next week. I will assign a new split for you.',
  'You are doing well! Stay consistent and the results will come.',
];

export default function TrainerChatScreen({ member, onBack, trainerMessages, setTrainerMessages }) {
  const [messages, setMessagesLocal] = useState(
    trainerMessages.length > 0 ? trainerMessages : [{
      id: '0',
      role: 'trainer',
      type: 'text',
      text: `Hey ${member.name.split(' ')[0]}! How's your training going? Feel free to ask me anything.`,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }]
  );
  const [input, setInput]         = useState('');
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordTimer               = useRef(null);
  const avRecording               = useRef(null);
  const scrollRef                 = useRef(null);

  const formatTime = (secs) =>
    `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  const updateMessages = (newMsgs) => {
    setMessagesLocal(newMsgs);
    setTrainerMessages(newMsgs);
  };

  const sendMessage = (text, type = 'text') => {
    if (!text) return;
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const userMsg  = { id: Date.now().toString(), role: 'user', text, time: now, type };
    const replyMsg = {
      id: (Date.now() + 1).toString(), role: 'trainer', type: 'text',
      text: TRAINER_REPLIES[Math.floor(Math.random() * TRAINER_REPLIES.length)],
      time: now,
    };
    updateMessages([...messages, userMsg, replyMsg]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const startRecording = async () => {
    try {
      if (Audio) {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) { Alert.alert('Permission needed', 'Microphone access is required to record voice notes.'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        avRecording.current = rec;
      }
    } catch (e) { /* fall back to timer-only mode */ }
    setRecording(true);
    setRecordTime(0);
    recordTimer.current = setInterval(() => setRecordTime(t => t + 1), 1000);
  };

  const stopRecording = async () => {
    clearInterval(recordTimer.current);
    const duration = recordTime;
    setRecording(false);
    setRecordTime(0);
    try {
      if (avRecording.current) {
        await avRecording.current.stopAndUnloadAsync();
        avRecording.current = null;
      }
    } catch (_) {}
    if (duration > 0) sendMessage(`🎙 Voice note (${formatTime(duration)})`, 'voice');
  };

  const renderBubble = (msg) => {
    if (msg.type === 'voice') return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 18 }}>🎙️</Text>
        <Text style={[s.msgText, msg.role === 'user' && { color: '#fff' }, { marginLeft: 6 }]}>
          {msg.text}
        </Text>
      </View>
    );
    if (msg.type === 'image') return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 22 }}>🖼️</Text>
        <Text style={[s.msgText, msg.role === 'user' && { color: '#fff' }, { marginLeft: 6 }]}>
          {msg.text}
        </Text>
      </View>
    );
    return <Text style={[s.msgText, msg.role === 'user' && { color: '#fff' }]}>{msg.text}</Text>;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={s.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={{ fontSize: 24 }}>🏋️</Text>
          <View style={{ marginLeft: 8 }}>
            <Text style={s.headerName}>{member.trainer}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} />
              <Text style={s.headerStatus}>Online · Your Trainer</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, padding: 16 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map(msg => (
          <View key={msg.id} style={[s.msgRow, msg.role === 'user' && s.msgRowUser]}>
            {msg.role === 'trainer' && <Text style={s.msgAvatar}>🏋️</Text>}
            <View style={[s.msgBubble, msg.role === 'user' ? s.msgBubbleUser : s.msgBubbleTrainer]}>
              {renderBubble(msg)}
              <Text style={[s.msgTime, msg.role === 'user' && { color: 'rgba(255,255,255,0.6)' }]}>
                {msg.time}
              </Text>
            </View>
          </View>
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Recording Bar ── */}
      {recording && (
        <View style={s.recordingBar}>
          <View style={s.recordingDot} />
          <Text style={s.recordingTxt}>Recording… {formatTime(recordTime)}</Text>
          <Text style={s.recordingHint}>Release to send</Text>
        </View>
      )}

      {/* ── Input Row ── */}
      <View style={s.inputRow}>
        <TouchableOpacity
          style={s.attachBtn}
          onPress={() => Alert.alert(
            'Attach Image',
            'Image picker requires expo-image-picker. Run: npx expo install expo-image-picker',
            [{ text: 'OK' }]
          )}>
          <Text style={{ fontSize: 20 }}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message your trainer…"
          placeholderTextColor={C.mid}
          multiline
        />
        {input.trim() ? (
          <TouchableOpacity style={s.sendBtn} onPress={() => sendMessage(input.trim())}>
            <Text style={s.sendBtnTxt}>➤</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: recording ? C.red : C.green }]}
            onPressIn={startRecording}
            onPressOut={stopRecording}>
            <Text style={{ fontSize: 18 }}>{recording ? '⏹' : '🎙️'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.light, backgroundColor: C.card },
  backBtn:         { color: C.primary, fontSize: 15, width: 60 },
  headerCenter:    { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerName:      { fontSize: 15, fontWeight: '700', color: C.dark },
  headerStatus:    { fontSize: 11, color: C.green, fontWeight: '500' },
  msgRow:          { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  msgRowUser:      { flexDirection: 'row-reverse' },
  msgAvatar:       { fontSize: 24, width: 32, textAlign: 'center' },
  msgBubble:       { maxWidth: '75%', borderRadius: 16, padding: 12 },
  msgBubbleTrainer:{ backgroundColor: C.card, borderWidth: 1, borderColor: C.light, borderBottomLeftRadius: 4 },
  msgBubbleUser:   { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  msgText:         { fontSize: 14, color: C.dark, lineHeight: 20 },
  msgTime:         { fontSize: 10, color: C.mid, marginTop: 4, textAlign: 'right' },
  recordingBar:    { backgroundColor: '#FEE2E2', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  recordingDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.red },
  recordingTxt:    { fontSize: 14, color: C.red, fontWeight: '600', flex: 1 },
  recordingHint:   { fontSize: 12, color: C.mid },
  inputRow:        { flexDirection: 'row', padding: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.light, gap: 10, alignItems: 'flex-end' },
  attachBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.light },
  input:           { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 12, fontSize: 15, color: C.dark, borderWidth: 1, borderColor: C.light, maxHeight: 100 },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnTxt:      { color: '#fff', fontSize: 16 },
});