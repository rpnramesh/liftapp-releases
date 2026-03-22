// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../constants/theme';
// Lift Trainer App — TS-010 Video Library | TS-011 Upload Personalised Video
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image, RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState, SkeletonCard, StatusBadge } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { VideoAPI } from '../../services/trainer.api';
import { TrainerVideo } from '../../types/trainer.types';
import { durationLabel, formatDate, watchStatusColor, watchStatusLabel } from '../../utils/trainer.utils';

import { getTrainerId } from '../../services/session';

// Accept optional hideHeader for use inside Library sub-tab
export default function VideoLibraryScreen({ navigation, hideHeader }: { navigation?: any; hideHeader?: boolean }) {
  const [filter, setFilter] = useState<'all' | 'general' | 'personal'>('all');

  const fetchVideos = useCallback(() => VideoAPI.getVideos(getTrainerId()), []);
  const { data: videos, loading, refresh } = useAsync<TrainerVideo[]>(fetchVideos);

  const filtered = (videos ?? []).filter(v => {
    if (filter === 'general') return !v.isPersonalized;
    if (filter === 'personal') return v.isPersonalized;
    return true;
  });

  const handleDelete = (videoId: string, title: string) => {
    Alert.alert('Delete Video', `Delete "${title}"? This will immediately remove client access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await VideoAPI.deleteVideo(videoId);
            refresh();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const renderVideo = ({ item }: { item: TrainerVideo }) => (
    <View style={styles.videoCard}>
      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={{ fontSize: 28 }}>🎬</Text>
        </View>
      )}
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
        {item.isPersonalized && item.assignedMemberName && (
          <Text style={styles.assignedTo}>👤 {item.assignedMemberName}</Text>
        )}
        {item.isPersonalized && item.watchStatus && (
          <StatusBadge
            label={watchStatusLabel(item.watchStatus, item.watchedPercent)}
            color={watchStatusColor(item.watchStatus)}
          />
        )}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{durationLabel(item.durationSeconds)}</Text>
          <Text style={styles.metaText}>{formatDate(item.uploadedAt)}</Text>
          {item.isExpired && <StatusBadge label="Expired" color={C.red} />}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.title)}>
            <Text style={styles.deleteBtnText}>🗑 Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {!hideHeader && (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Video Library</Text>
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={() => navigation?.navigate('UploadVideo', {})}
        >
          <Text style={styles.uploadBtnText}>+ Upload</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'general', 'personal'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'general' ? 'General' : 'Personalised'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !videos ? (
        <View style={{ padding: 16, gap: 10 }}>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderVideo}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.primary} />}
          ListEmptyComponent={
            <EmptyState
              emoji="🎬"
              title="No videos yet"
              subtitle="Upload workout videos for your clients."
              ctaLabel="Upload a Video"
              onCTA={() => navigation.navigate('UploadVideo', {})}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.dark },
  uploadBtn: { backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  uploadBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#F3F4F6' },
  filterTabActive: { backgroundColor: C.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: C.mid },
  filterTextActive: { color: C.white },
  videoCard: { flexDirection: 'row', gap: 12, backgroundColor: C.white, borderRadius: 12, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  thumbnail: { width: 100, height: 90 },
  thumbnailPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  videoInfo: { flex: 1, padding: 12, gap: 4 },
  videoTitle: { fontSize: 14, fontWeight: '600', color: C.dark, lineHeight: 18 },
  assignedTo: { fontSize: 12, color: C.mid },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: C.light },
  actions: { flexDirection: 'row', marginTop: 4 },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FEE2E2' },
  deleteBtnText: { color: C.red, fontSize: 12, fontWeight: '600' },
});
