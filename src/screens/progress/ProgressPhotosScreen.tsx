// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-015 View Client Progress Photos
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Modal, TextInput, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClientsStackParamList } from '../../navigation/TrainerNavigator';
import { ProgressAPI } from '../../services/mockApi';

import { EmptyState, PrimaryButton } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { ProgressPhoto } from '../../types/trainer.types';
import { formatDate } from '../../utils/trainer.utils';

const TRAINER_ID = 'trainer-001';
const TOKEN = '';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ProgressPhotos'>;

export default function ProgressPhotosScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const [commentModal, setCommentModal] = useState<{ photoId: string; existing?: string } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPhotos = useCallback(() => ProgressAPI.getProgressPhotos(TRAINER_ID, clientId, TOKEN), [clientId]);
  const { data: photos, loading, refresh } = useAsync<ProgressPhoto[]>(fetchPhotos);

  const requestAccess = async () => {
    try {
      await ProgressAPI.requestPhotoAccess(TRAINER_ID, clientId, TOKEN);
      Alert.alert('Request Sent', `An access request has been sent to ${clientName}. It expires after 1 hour.`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const saveComment = async () => {
    if (!commentModal || !commentText.trim()) return;
    setSaving(true);
    try {
      await ProgressAPI.commentOnPhoto(TRAINER_ID, clientId, commentModal.photoId, commentText.trim(), TOKEN);
      setCommentModal(null);
      refresh();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const sharedPhotos = (photos ?? []).filter(p => p.isSharedWithTrainer);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: C.primary, fontWeight: '500' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{clientName}'s Progress Photos</Text>
      </View>

      {sharedPhotos.length === 0 ? (
        <EmptyState
          emoji="📷"
          title="No photos shared"
          subtitle={`${clientName} hasn't shared any progress photos with you yet.`}
          ctaLabel="Request Access"
          onCTA={requestAccess}
        />
      ) : (
        <FlatList
          data={sharedPhotos}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          columnWrapperStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.photoCard}>
              <Image source={{ uri: item.photoUrl }} style={styles.photo} />
              <View style={styles.photoInfo}>
                <Text style={styles.photoDate}>{formatDate(item.date)}</Text>
                {item.trainerComment ? (
                  <Text style={styles.comment} numberOfLines={2}>💬 {item.trainerComment}</Text>
                ) : (
                  <TouchableOpacity onPress={() => { setCommentModal({ photoId: item.id }); setCommentText(''); }}>
                    <Text style={styles.addComment}>+ Add comment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!commentModal} transparent animationType="slide" onRequestClose={() => setCommentModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Your feedback on this progress photo…"
              multiline
              value={commentText}
              onChangeText={setCommentText}
              autoFocus
            />
            <PrimaryButton label="Save Comment" onPress={saveComment} loading={saving} />
            <TouchableOpacity style={{ marginTop: 10, alignSelf: 'center' }} onPress={() => setCommentModal(null)}>
              <Text style={{ color: C.mid }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, gap: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  photoCard: { flex: 1, backgroundColor: C.white, borderRadius: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  photo: { width: '100%', aspectRatio: 1 },
  photoInfo: { padding: 8, gap: 4 },
  photoDate: { fontSize: 11, color: C.mid },
  comment: { fontSize: 11, color: '#374151' },
  addComment: { fontSize: 11, color: C.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 16 },
  commentInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
});
