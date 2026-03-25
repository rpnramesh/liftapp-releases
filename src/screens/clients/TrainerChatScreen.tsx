// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Trainer Chat Screen
// Fix #3: Chat ID namespace matches Member App exactly
//   Gym member:    gymId_trainerId_memberId
//   Freelance:     trainerId_trainerId_memberId (null gymId → trainerId as ns)
// ─────────────────────────────────────────────────────────────────────────────
import {
    collection,
    doc, getDoc,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { Avatar } from '../../components/common';
import { IconSymbol } from '../../components/ui/icon-symbol';
import KeyboardSafeView from '../../components/ui/KeyboardSafeView';
import { C, S } from '../../constants/theme';
import { db } from '../../firebase/config';
import { getTrainerId } from '../../services/session';

let ImagePicker: any = null;
let Audio: any = null;
try { ImagePicker = require('expo-image-picker'); } catch {}
try { Audio = require('expo-av').Audio; } catch {}

// Must match Member App's buildChatId in chat.service.ts exactly:
// getNamespace(gymId, trainerId) = gymId if gymId is non-null/non-empty, else trainerId
function buildChatId(gymId: string | null | undefined, trainerId: string, memberId: string): string {
  const ns = (gymId && gymId.trim() !== '') ? gymId : trainerId;
  return `${ns}_${trainerId}_${memberId}`;
}

export default function TrainerChatScreen({ navigation, route }: any) {
  const { clientId, clientName, clientPhotoUrl } = route.params;
  const trainerId = getTrainerId();

  const [chatId, setChatId] = useState<string | null>(null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [soundObj, setSoundObj] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<any>(null);
  const unsubRef = useRef<any>(null);

  useEffect(() => {
    if (!trainerId || !clientId) return;

    const init = async () => {
      try {
        // Get trainer's gymId
        const trainerSnap = await getDoc(doc(db, 'trainers', trainerId));
        const trainerGymId: string | null = trainerSnap.data()?.gymId ?? null;

        // Get member's gymId as fallback
        const memberSnap = await getDoc(doc(db, 'members', clientId)).catch(() => null);
        const memberGymId: string | null = memberSnap?.data()?.gymId ?? null;

        // Use the first available gymId — same logic as member app
        const effectiveGymId: string | null = trainerGymId ?? memberGymId ?? null;
        setGymId(effectiveGymId);

        const cId = buildChatId(effectiveGymId, trainerId, clientId);
        setChatId(cId);

        // Ensure chat document exists
        const chatRef = doc(db, 'chats', cId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) {
          await setDoc(chatRef, {
            id: cId, gymId: effectiveGymId, trainerId, memberId: clientId,
            lastMessage: '', lastMessageAt: Date.now(),
            unreadCount: { [trainerId]: 0, [clientId]: 0 },
          });
        }

        // Subscribe
        const q = query(
          collection(db, 'chats', cId, 'messages'),
          orderBy('createdAt', 'asc'),
          limit(100),
        );
        unsubRef.current = onSnapshot(q, (snap) => {
          setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
          updateDoc(chatRef, { [`unreadCount.${trainerId}`]: 0 }).catch(() => {});
        });
      } catch (e: any) {
        console.log('Chat init error:', e?.message ?? e);
        setLoading(false);
      }
    };

    init();
    return () => { unsubRef.current?.(); };
  }, [trainerId, clientId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSendText = async () => {
    const content = text.trim();
    if (!content || !chatId) return;
    setSending(true);
    setText('');
    try {
      const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
      await setDoc(msgRef, {
        id: msgRef.id, chatId, senderId: trainerId,
        senderRole: 'trainer', type: 'text', text: content,
        readBy: [trainerId], createdAt: Date.now(),
      });
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: content, lastMessageAt: Date.now(),
        [`unreadCount.${clientId}`]: increment(1),
      });
    } catch (e: any) {
      console.log('Send error:', e?.message);
      Alert.alert('Error', 'Failed to send message.');
      setText(content);
    } finally { setSending(false); }
  };

  const handleSendImage = async () => {
    if (!ImagePicker || !chatId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled) return;
    setSending(true);
    try {
      const uri = result.assets[0].uri;
      const storage = getStorage();
      const imgRef = storageRef(storage, `chats/${chatId}/${Date.now()}.jpg`);
      const blob = await (await fetch(uri)).blob();
      await uploadBytes(imgRef, blob);
      const mediaUrl = await getDownloadURL(imgRef);
      const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
      await setDoc(msgRef, { id: msgRef.id, chatId, senderId: trainerId, senderRole: 'trainer', type: 'image', mediaUrl, readBy: [trainerId], createdAt: Date.now() });
      await updateDoc(doc(db, 'chats', chatId), { lastMessage: 'Image', lastMessageAt: Date.now(), [`unreadCount.${clientId}`]: increment(1) });
    } catch (e) { Alert.alert('Error', 'Failed to send image.'); }
    finally { setSending(false); }
  };

  const startRecording = async () => {
    if (!Audio) { Alert.alert('Not Available', 'Run: npx expo install expo-av'); return; }
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow microphone.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec); setIsRecording(true);
    } catch { Alert.alert('Error', 'Failed to start recording'); }
  };

  const stopRecording = async () => {
    if (!recording || !chatId) return;
    setIsRecording(false); setSending(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI(); setRecording(null);
      const storage = getStorage();
      const vRef = storageRef(storage, `chats/${chatId}/voice_${Date.now()}.m4a`);
      const blob = await (await fetch(uri)).blob();
      await uploadBytes(vRef, blob);
      const mediaUrl = await getDownloadURL(vRef);
      const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
      await setDoc(msgRef, { id: msgRef.id, chatId, senderId: trainerId, senderRole: 'trainer', type: 'voice', mediaUrl, readBy: [trainerId], createdAt: Date.now() });
      await updateDoc(doc(db, 'chats', chatId), { lastMessage: 'Voice note', lastMessageAt: Date.now(), [`unreadCount.${clientId}`]: increment(1) });
    } catch { Alert.alert('Error', 'Failed to send voice note.'); }
    finally { setSending(false); }
  };

  const playVoice = async (msg: any) => {
    if (!Audio) return;
    if (soundObj) { await soundObj.unloadAsync(); setSoundObj(null); setPlayingId(null); }
    if (playingId === msg.id) return;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: msg.mediaUrl });
      setSoundObj(sound); setPlayingId(msg.id);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.didJustFinish) { setPlayingId(null); sound.unloadAsync(); }
      });
    } catch { Alert.alert('Error', 'Failed to play voice note'); }
  };

  const renderMessage = ({ item }: any) => {
    const isMe = item.senderRole === 'trainer';
    const time = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '';
    const isRead = Array.isArray(item.readBy) ? item.readBy.includes(clientId) : false;
    return (
      <View style={[ms.row, isMe ? ms.rowRight : ms.rowLeft]}>
        {!isMe && <Avatar uri={clientPhotoUrl} name={clientName} size={28} />}
        <View style={[ms.bubble, isMe ? ms.bubbleMe : ms.bubbleThem]}>
          {item.type === 'text' && <Text style={[ms.text, isMe && ms.textMe]}>{item.text}</Text>}
          {item.type === 'image' && item.mediaUrl && <Image source={{ uri: item.mediaUrl }} style={ms.imageMsg} resizeMode="cover" />}
          {item.type === 'voice' && (
            <TouchableOpacity style={ms.voiceRow} onPress={() => playVoice(item)}>
              <IconSymbol name={playingId === item.id ? 'pause.fill' : 'play.fill'} size={20} color={playingId === item.id ? (isMe ? C.white : C.primary) : C.mid} />
              <View style={ms.voiceBar}>
                {[...Array(12)].map((_, i) => <View key={i} style={[ms.voiceBarSeg, isMe && { backgroundColor: 'rgba(255,255,255,0.6)' }]} />)}
              </View>
              <Text style={[ms.voiceLbl, isMe && { color: 'rgba(255,255,255,0.8)' }]}> 
                <IconSymbol name="mic" size={12} color={isMe ? C.white : C.mid} />{' '}Voice
              </Text>
            </TouchableOpacity>
          )}
          <Text style={[ms.time, isMe && ms.timeMe]}>{time}{isMe && (isRead ? ' ✓✓' : ' ✓')}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardSafeView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={cs.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <IconSymbol name="chevron.left" size={20} color={C.primary} />
        </TouchableOpacity>
        <Avatar uri={clientPhotoUrl} name={clientName} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={cs.headerName}>{clientName}</Text>
          <Text style={cs.headerSub}>{gymId ? 'Gym Member' : 'Freelance Member'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={{ color: C.mid, marginTop: 12 }}>Loading chat…</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: S.md, paddingBottom: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={cs.empty}>
                <IconSymbol name="bubble.left" size={40} color={C.mid} />
                  <Text style={cs.emptyText}>No messages yet</Text>
                  <Text style={cs.emptySub}>Send a message to {clientName?.split(' ')[0]}</Text>
            </View>
          }
        />
      )}

      {isRecording && (
        <View style={cs.recordingBar}>
          <View style={cs.recordingDot} />
          <Text style={cs.recordingText}>Recording… tap <IconSymbol name="record" size={12} color="#EF4444" /> to send</Text>
        </View>
      )}

      <View style={cs.inputBar}>
        <TouchableOpacity style={cs.iconBtn} onPress={handleSendImage} disabled={!chatId || sending}>
          <IconSymbol name="camera" size={22} color={C.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[cs.iconBtn, isRecording && { backgroundColor: '#FEE2E2' }]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={!chatId || sending}>
          {isRecording ? (
            <IconSymbol name="record" size={20} color="#EF4444" />
          ) : (
            <IconSymbol name="mic" size={20} color={C.mid} />
          )}
        </TouchableOpacity>
        <TextInput
          style={cs.input}
          placeholder={chatId ? `Message ${clientName?.split(' ')[0]}…` : 'Loading…'}
          placeholderTextColor={C.mid}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          editable={!!chatId}
        />
        <TouchableOpacity
          style={[cs.sendBtn, (!text.trim() || !chatId || sending) && { opacity: 0.4 }]}
          onPress={handleSendText}
          disabled={!text.trim() || !chatId || sending}>
          {sending ? <ActivityIndicator size="small" color={C.white} /> : <IconSymbol name="paperplane.fill" size={18} color={C.white} />}
        </TouchableOpacity>
      </View>
    </KeyboardSafeView>
  );
}

const ms = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 6 },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleThem: { backgroundColor: C.white, borderBottomLeftRadius: 4, elevation: 1 },
  text: { fontSize: 15, color: C.dark, lineHeight: 21 },
  textMe: { color: C.white },
  imageMsg: { width: 200, height: 150, borderRadius: 10 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  voiceIcon: { fontSize: 20, color: C.mid },
  voiceBar: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 80 },
  voiceBarSeg: { width: 3, height: 12, backgroundColor: C.mid, borderRadius: 2 },
  voiceLbl: { fontSize: 11, color: C.mid },
  time: { fontSize: 10, color: C.mid, alignSelf: 'flex-end', marginTop: 4 },
  timeMe: { color: 'rgba(255,255,255,0.7)' },
});
const cs = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, paddingHorizontal: S.lg, paddingTop: 52, paddingBottom: S.md, borderBottomWidth: 1, borderBottomColor: C.border },
  headerName: { fontSize: 16, fontWeight: '700', color: C.dark },
  headerSub: { fontSize: 11, color: C.mid },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 17, fontWeight: '600', color: C.dark },
  emptySub: { fontSize: 14, color: C.mid },
  recordingBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', paddingHorizontal: S.lg, paddingVertical: 10 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.red },
  recordingText: { fontSize: 13, color: C.red, fontWeight: '500' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  input: { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, color: C.dark, maxHeight: 100, minHeight: 40 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
});
