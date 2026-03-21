// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-018 Notification Centre
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { NotificationsAPI } from '../../services/mockApi';
import { NOTIFICATION_TYPE_LABELS } from '../../constants/trainer.constants';
import { EmptyState, SkeletonCard } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { TrainerNotification } from '../../types/trainer.types';
import { timeAgo } from '../../utils/trainer.utils';

const TRAINER_ID = 'trainer-001';
const TOKEN = '';

const TYPE_ICONS: Record<string, string> = {
  workout_logged: '💪',
  client_invited_accepted: '🎉',
  membership_due: '💰',
  video_watched: '▶️',
  class_rsvp: '📅',
  class_reminder: '⏰',
  payment_received: '✅',
  payment_failed: '❌',
  client_reassigned: '🔄',
  system: 'ℹ️',
};

export default function NotificationsScreen() {
  const fetchNotifs = useCallback(
    () => NotificationsAPI.getNotifications(TRAINER_ID, 1, TOKEN).then(r => r.notifications),
    [],
  );
  const { data: notifications, loading, refresh } = useAsync<TrainerNotification[]>(fetchNotifs);

  const markAllRead = async () => {
    try {
      await NotificationsAPI.markAllRead(TRAINER_ID, TOKEN);
      refresh();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const deleteNotif = async (id: string) => {
    try {
      await NotificationsAPI.deleteNotification(TRAINER_ID, id, TOKEN);
      refresh();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const unreadCount = (notifications ?? []).filter(n => !n.isRead).length;

  const renderNotif = ({ item }: { item: TrainerNotification }) => (
    <TouchableOpacity
      style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
      activeOpacity={0.85}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{TYPE_ICONS[item.type] ?? 'ℹ️'}</Text>
        {!item.isRead && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.notifContent}>
        <Text style={styles.notifTitle}>{item.title}</Text>
        <Text style={styles.notifBody}>{item.body}</Text>
        <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteNotif(item.id)}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !notifications ? (
        <View style={{ padding: 16, gap: 10 }}>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</View>
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={item => item.id}
          renderItem={renderNotif}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.primary} />}
          ListEmptyComponent={
            <EmptyState emoji="🔔" title="No notifications" subtitle="You're all caught up! Notifications about your clients will appear here." />
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
  markAllRead: { color: C.primary, fontSize: 13, fontWeight: '600' },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  notifCardUnread: { backgroundColor: C.primary + '08', borderLeftWidth: 3, borderLeftColor: C.primary },
  iconContainer: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 18 },
  icon: { fontSize: 18 },
  unreadDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.white },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: C.dark, marginBottom: 2 },
  notifBody: { fontSize: 13, color: '#374151', lineHeight: 18 },
  notifTime: { fontSize: 11, color: C.light, marginTop: 4 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: C.light, fontSize: 16 },
});
