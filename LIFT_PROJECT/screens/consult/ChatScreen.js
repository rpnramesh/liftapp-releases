// ── CHAT SCREEN (CONSULT SESSION) ────────────────────────
// Timed chat session between member and a consultant.
// Session auto-ends after 10 minutes. Supports text, voice, and images.
// Can be opened in read-only mode to review a past session.
//
// Props:
//   consultant       – the consultant object { name, spec, avatar }
//   onEnd            – function(messages) called when session ends or user exits
//   readOnly         – boolean, if true the session is view-only (past session)
//   existingMessages – array of messages to pre-populate (for read-only mode)

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, TextInput,
} from 'react-native';
import C from '../../constants/colors';
import { CONSULT_PRICING } from '../../constants/data';

const REPLIES = [
  'Based on your fitness goals, I recommend focusing on macronutrient balance first.',
  'Great question. I suggest starting with small sustainable changes.',
  'For someone at your training level, here is what I advise...',
  'Absolutely. Let me put together a plan that works for your schedule.',
  'Yes, that is a common concern. Consistency is the best approach here.',
];

export default function ChatScreen({ consultant, onEnd, readOnly, existingMessages }) {
  const DURATION = CONSULT_PRICING.chat.duration; // 600 seconds = 10 min

  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [messages, setMessages] = useState(
    existingMessages || [{
      id: '0',
      role: 'consultant',
      type: 'text',
      text: `Hi! I'm ${consultant.name.split(' ')[0]}. How can I help you today?`,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }]
  );
  const [input, setInput]         = useState('');
  const [ended, setEnded]         = useState(readOnly || false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordTimer               = useRef(null);
  const scrollRef                 = useRef(null);

  // ── Countdown Timer ──
  useEffect(() => {
    if (readOnly || ended) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); setEnded(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [readOnly]);

  const formatTime  = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const timerColor  = timeLeft < 60 ? C.red : timeLeft < 180 ? C.amber : C.green;

  const sendMessage = (text, type = 'text') => {
    if (!text || ended) return;
    const now      = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const userMsg  = { id: Date.now().toString(), role: 'user', text, time: now, type };
    const replyMsg = {
      id: (Date.now() + 1).toString(), role: 'consultant', type: 'text',
      text: REPLIES[Math.floor(Math.random() * REPLIES.length)],
      time: now,
    };
    setMessages(prev => [...prev, userMsg, replyMsg]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const startRecording = () => {
    if (ended) return;
    setRecording(true);
    setRecordTime(0);
    recordTimer.current = setInterval(() => setRecordTime(t => t + 1), 1000);
  };

  const stopRecording = () => {
    clearInterval(recordTimer.current);
    setRecording(false);
    if (recordTime > 0) sendMessage(`Voice note (${formatTime(recordTime)})`, 'voice');
    setRecordTime(0);
  };

  const renderBubbleContent = (msg) => {
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

      {/* ── Chat Header ── */}
      <View style={s.chatHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.chatHeaderName}>{consultant.name}</Text>
          <Text style={s.chatHeaderSpec}>{consultant.spec}</Text>
        </View>
        {!readOnly && !ended && (
          <View style={[s.timerBadge, { backgroundColor: timerColor + '22', borderColor: timerColor }]}>
            <Text style={[s.timerTxt, { color: timerColor }]}>⏱ {formatTime(timeLeft)}</Text>
          </View>
        )}
        {(ended || readOnly) && (
          <View style={s.endedBadge}><Text style={s.endedBadgeTxt}>Ended</Text></View>
        )}
        <TouchableOpacity style={s.endBtn} onPress={() => onEnd(messages)}>
          <Text style={s.endBtnTxt}>{readOnly || ended ? '← Back' : 'End'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Status Banners ── */}
      {ended && !readOnly && (
        <View style={s.sessionEndedBanner}>
          <Text style={s.sessionEndedTxt}>Session ended · This chat is now read-only</Text>
        </View>
      )}
      {readOnly && (
        <View style={[s.sessionEndedBanner, { backgroundColor: C.blue2 }]}>
          <Text style={[s.sessionEndedTxt, { color: C.primary }]}>
            📋 Previous session · Read-only
          </Text>
        </View>
      )}

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, padding: 16 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map(msg => (
          <View key={msg.id} style={[s.msgRow, msg.role === 'user' && s.msgRowUser]}>
            {msg.role === 'consultant' && (
              <Text style={s.msgAvatar}>{consultant.avatar}</Text>
            )}
            <View style={[s.msgBubble, msg.role === 'user' ? s.msgBubbleUser : s.msgBubbleConsultant]}>
              {renderBubbleContent(msg)}
              <Text style={[s.msgTime, msg.role === 'user' && { color: 'rgba(255,255,255,0.6)' }]}>
                {msg.time}
              </Text>
            </View>
          </View>
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Input or Read-Only Bar ── */}
      {!ended && !readOnly ? (
        <>
          {recording && (
            <View style={s.recordingBar}>
              <View style={s.recordingDot} />
              <Text style={s.recordingTxt}>Recording… {formatTime(recordTime)}</Text>
              <Text style={s.recordingHint}>Release to send</Text>
            </View>
          )}
          <View style={s.chatInputRow}>
            <TouchableOpacity style={s.attachBtn} onPress={() => sendMessage('Image shared', 'image')}>
              <Text style={{ fontSize: 20 }}>📎</Text>
            </TouchableOpacity>
            <TextInput
              style={s.chatInput}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message…"
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
        </>
      ) : (
        <View style={s.readOnlyBar}>
          <Text style={s.readOnlyTxt}>🔒 Session ended · Read-only</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  chatHeader:          { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.light, backgroundColor: C.card, gap: 10 },
  chatHeaderName:      { fontSize: 15, fontWeight: '700', color: C.dark },
  chatHeaderSpec:      { fontSize: 11, color: C.mid, marginTop: 1 },
  timerBadge:          { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 4 },
  timerTxt:            { fontSize: 13, fontWeight: '700' },
  endBtn:              { backgroundColor: C.blue2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  endBtnTxt:           { color: C.primary, fontWeight: '700', fontSize: 13 },
  endedBadge:          { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  endedBadgeTxt:       { color: C.red, fontSize: 12, fontWeight: '700' },
  sessionEndedBanner:  { backgroundColor: '#FEE2E2', padding: 10, alignItems: 'center' },
  sessionEndedTxt:     { color: C.red, fontSize: 13, fontWeight: '600' },
  msgRow:              { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  msgRowUser:          { flexDirection: 'row-reverse' },
  msgAvatar:           { fontSize: 24, width: 32, textAlign: 'center' },
  msgBubble:           { maxWidth: '75%', borderRadius: 16, padding: 12 },
  msgBubbleConsultant: { backgroundColor: C.card, borderWidth: 1, borderColor: C.light, borderBottomLeftRadius: 4 },
  msgBubbleUser:       { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  msgText:             { fontSize: 14, color: C.dark, lineHeight: 20 },
  msgTime:             { fontSize: 10, color: C.mid, marginTop: 4, textAlign: 'right' },
  recordingBar:        { backgroundColor: '#FEE2E2', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  recordingDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: C.red },
  recordingTxt:        { fontSize: 14, color: C.red, fontWeight: '600', flex: 1 },
  recordingHint:       { fontSize: 12, color: C.mid },
  chatInputRow:        { flexDirection: 'row', padding: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.light, gap: 10, alignItems: 'flex-end' },
  chatInput:           { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 12, fontSize: 15, color: C.dark, borderWidth: 1, borderColor: C.light, maxHeight: 100 },
  attachBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.light },
  sendBtn:             { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff:          { backgroundColor: C.light },
  sendBtnTxt:          { color: '#fff', fontSize: 16 },
  readOnlyBar:         { padding: 14, backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: C.light, alignItems: 'center' },
  readOnlyTxt:         { color: C.mid, fontSize: 13, fontWeight: '500' },
});