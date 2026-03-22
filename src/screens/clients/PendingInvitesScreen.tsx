// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Pending Invites Screen
// Shows all pending trainer invites (phone + link). Trainer can cancel them.
// ─────────────────────────────────────────────────────────────────────────────
import { useFocusEffect } from '@react-navigation/native';
import {
  collection,
  getDocs,
  query,
  updateDoc,
  doc,
  where,
  orderBy,
} from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenHeader } from '../../components/common';
import { C, R, S } from '../../constants/theme';
import { db } from '../../firebase/config';
import { getTrainerId } from '../../services/session';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatValidity(invite: any) {
  if (invite.planEndDate) return `Valid until ${formatDate(invite.planEndDate)}`;
  return '';
}

export default function PendingInvitesScreen({ navigation }: any) {
  const trainerId = getTrainerId();
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'trainerInvites'),
          where('trainerId', '==', trainerId),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc'),
        )
      ).catch(() => ({ docs: [] }));
      setInvites(snap.docs.map((d: any) => d.data()));
    } catch (e) {
      console.log('Load pending invites error:', e);
    } finally {
      setLoading(false);
    }
  }, [trainerId]);

  useFocusEffect(useCallback(() => { loadInvites(); }, [loadInvites]));

  const handleCancel = (invite: any) => {
    Alert.alert(
      'Cancel Invite',
      `Cancel the invite sent to ${invite.memberName || invite.memberPhone}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Invite', style: 'destructive',
          onPress: async () => {
            setCancelling(invite.id);
            try {
              await updateDoc(doc(db, 'trainerInvites', invite.id), { status: 'cancelled' });
              setInvites(prev => prev.filter(i => i.id !== invite.id));
            } catch {
              Alert.alert('Error', 'Failed to cancel invite. Please try again.');
            } finally {
              setCancelling(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Pending Invites" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: S.lg, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadInvites} tintColor={C.primary} />}
      >
        {loading && invites.length === 0 ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : invites.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>📭</Text>
            <Text style={s.emptyTitle}>No Pending Invites</Text>
            <Text style={s.emptySub}>All your invites have been responded to.</Text>
          </View>
        ) : (
          <>
            <Text style={s.countText}>{invites.length} pending invite{invites.length > 1 ? 's' : ''}</Text>
            {invites.map(invite => (
              <View key={invite.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.avatarCircle}>
                    <Text style={s.avatarText}>
                      {(invite.memberName || invite.memberPhone || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName}>{invite.memberName || '—'}</Text>
                    <Text style={s.memberPhone}>{invite.memberPhone || ''}</Text>
                  </View>
                  <View style={s.typeBadge}>
                    <Text style={s.typeBadgeText}>
                      {invite.type === 'link' ? '🔗 Link' : '📱 Phone'}
                    </Text>
                  </View>
                </View>

                <View style={s.cardMeta}>
                  <Text style={s.metaText}>📅 Sent {formatDate(invite.createdAt)}</Text>
                  {!!formatValidity(invite) && (
                    <Text style={s.metaText}>⏳ {formatValidity(invite)}</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => handleCancel(invite)}
                  disabled={cancelling === invite.id}
                >
                  {cancelling === invite.id
                    ? <ActivityIndicator color={C.red} size="small" />
                    : <Text style={s.cancelBtnText}>Cancel Invite</Text>}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  countText: { fontSize: 13, color: C.mid, marginBottom: S.md },
  card: {
    backgroundColor: C.white, borderRadius: R.lg, padding: S.lg,
    marginBottom: S.md, elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: C.primary },
  memberName: { fontSize: 15, fontWeight: '700', color: C.dark },
  memberPhone: { fontSize: 13, color: C.mid, marginTop: 1 },
  typeBadge: {
    backgroundColor: C.primaryBg, borderRadius: R.sm,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  typeBadgeText: { fontSize: 12, color: C.primary, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginBottom: 12 },
  metaText: { fontSize: 12, color: C.mid },
  cancelBtn: {
    borderWidth: 1, borderColor: C.red, borderRadius: R.md,
    paddingVertical: 10, alignItems: 'center',
  },
  cancelBtnText: { color: C.red, fontWeight: '600', fontSize: 14 },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  emptySub: { fontSize: 14, color: C.mid, textAlign: 'center' },
});
