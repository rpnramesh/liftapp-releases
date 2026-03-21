// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-011 Upload Personalised Session Video
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { VideosStackParamList } from '../../navigation/TrainerNavigator';
import { VideoAPI } from '../../services/mockApi';
import { UPLOAD_LIMITS, VIDEO_CATEGORIES } from '../../constants/trainer.constants';
import { PrimaryButton } from '../../components/common';

const TOKEN = '';
type Props = NativeStackScreenProps<VideosStackParamList, 'UploadVideo'>;

export default function UploadVideoScreen({ navigation, route }: Props) {
  const { preselectedClientId } = route.params ?? {};
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [memberId, setMemberId] = useState(preselectedClientId ?? '');
  const [expiresAt, setExpiresAt] = useState('');
  const [isPersonalized, setIsPersonalized] = useState(!!preselectedClientId);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (isPersonalized && !memberId.trim()) e.memberId = 'Select a client for personalised video';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleUpload = async () => {
    if (!validate()) return;
    setUploading(true);
    try {
      // In production: pick video file via DocumentPicker, pass URI
      await VideoAPI.uploadVideo({
        videoUri: 'selected_video_uri',
        title: title.trim(),
        description: description.trim(),
        category,
        memberId: isPersonalized ? memberId : undefined,
        expiresAt: expiresAt || undefined,
      }, TOKEN);
      Alert.alert('Upload Started', 'Your video is being uploaded and processed. You\'ll be notified when it\'s ready.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message ?? 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: C.primary, fontWeight: '500' }}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Video</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          {/* Video selector placeholder */}
          <TouchableOpacity style={styles.videoPicker}>
            <Text style={styles.videoPickerIcon}>🎬</Text>
            <Text style={styles.videoPickerText}>Tap to select video</Text>
            <Text style={styles.videoPickerSub}>MP4 format · Max {UPLOAD_LIMITS.VIDEO_MB} MB</Text>
          </TouchableOpacity>

          <Field label="Title *" error={errors.title}>
            <TextInput style={[styles.input, errors.title && styles.inputError]} placeholder="e.g. Upper Body Power – Week 3" value={title} onChangeText={setTitle} />
          </Field>

          <Field label="Description / Session Notes">
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Coaching notes visible to the client in the video player…" multiline value={description} onChangeText={setDescription} />
          </Field>

          <Field label="Category">
            <View style={styles.categoryWrap}>
              {VIDEO_CATEGORIES.slice(0, 8).map(c => (
                <TouchableOpacity key={c} style={[styles.catChip, category === c && styles.catChipActive]} onPress={() => setCategory(c)}>
                  <Text style={[styles.catText, category === c && { color: C.white }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {/* Personalised toggle */}
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Personalised Video</Text>
              <Text style={styles.toggleSub}>Visible only to a specific client, with watermark</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, isPersonalized && styles.toggleOn]}
              onPress={() => setIsPersonalized(p => !p)}
            >
              <View style={[styles.toggleThumb, isPersonalized && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {isPersonalized && (
            <Field label="Client ID / Name *" error={errors.memberId}>
              <TextInput style={[styles.input, errors.memberId && styles.inputError]} placeholder="Client member ID" value={memberId} onChangeText={setMemberId} />
              <Text style={styles.hint}>A subtle watermark with the client's name will be applied automatically.</Text>
            </Field>
          )}

          {isPersonalized && (
            <Field label="Expiry Date (optional)">
              <TextInput style={styles.input} placeholder="YYYY-MM-DD (e.g. 2026-04-30)" value={expiresAt} onChangeText={setExpiresAt} />
              <Text style={styles.hint}>After this date, the client can't access the video (stays in your library).</Text>
            </Field>
          )}

          {uploading && (
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` as any }]} />
              </View>
              <Text style={styles.progressText}>{uploadProgress}%</Text>
            </View>
          )}

          <PrimaryButton label="Upload Video" onPress={handleUpload} loading={uploading} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, gap: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  videoPicker: { backgroundColor: C.white, borderRadius: 12, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', padding: 32, alignItems: 'center', gap: 6 },
  videoPickerIcon: { fontSize: 40 },
  videoPickerText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  videoPickerSub: { fontSize: 12, color: C.light },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  fieldError: { fontSize: 12, color: C.red },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 15, color: C.dark, backgroundColor: C.white },
  inputError: { borderColor: C.red },
  hint: { fontSize: 11, color: C.light, marginTop: 2 },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: C.white },
  catChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  catText: { fontSize: 12, color: '#374151' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, padding: 14, borderRadius: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: C.dark },
  toggleSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: C.border, padding: 3 },
  toggleOn: { backgroundColor: C.primary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.white },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: C.primary, borderRadius: 3 },
  progressText: { fontSize: 13, fontWeight: '600', color: C.primary, width: 36 },
});
