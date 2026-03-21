// ─────────────────────────────────────────────────────────────────────────────
import { C, T, S, R, GS } from '../../constants/theme';
// Lift Trainer App — TS-012 Schedule & Host Live Classes
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ScrollView, TextInput, Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScheduleStackParamList } from '../../navigation/TrainerNavigator';
import { LiveClassAPI } from '../../services/mockApi';
import { CLASS_CATEGORIES, CLASS_DURATIONS, LIVE_CLASS } from '../../constants/trainer.constants';
import { SkeletonCard, EmptyState, PrimaryButton, LiveBadge } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { LiveClass, CreateClassPayload, ClassCategory } from '../../types/trainer.types';
import { formatDateTime, daysUntil } from '../../utils/trainer.utils';

const TRAINER_ID = 'trainer-001';
const GYM_ID = 'gym-001';
const TOKEN = '';

type Props = NativeStackScreenProps<ScheduleStackParamList, 'ScheduleList'>;

export default function ScheduleScreen({ navigation }: Props) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showCreate, setShowCreate] = useState(false);

  const fetchUpcoming = useCallback(() => LiveClassAPI.getUpcomingClasses(TRAINER_ID, TOKEN), []);
  const fetchPast = useCallback(() => LiveClassAPI.getPastClasses(TRAINER_ID, 1, TOKEN).then(r => r.classes), []);
  const upcoming = useAsync<LiveClass[]>(fetchUpcoming);
  const past = useAsync<LiveClass[]>(fetchPast);

  const data = tab === 'upcoming' ? upcoming : past;

  const handleCancel = (cls: LiveClass) => {
    Alert.alert('Cancel Class', `Cancel "${cls.name}"? All RSVPed members will be notified.`, [
      { text: 'Keep Class', style: 'cancel' },
      {
        text: 'Cancel Class', style: 'destructive',
        onPress: async () => {
          try {
            await LiveClassAPI.cancelClass(cls.id, TOKEN);
            upcoming.refresh();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const isStartable = (cls: LiveClass) => {
    const minutesUntil = (new Date(cls.scheduledAt).getTime() - Date.now()) / 60000;
    return minutesUntil <= LIVE_CLASS.START_BUTTON_ACTIVE_BEFORE_MINUTES && minutesUntil > -120;
  };

  const isEditable = (cls: LiveClass) => {
    const hoursUntil = (new Date(cls.scheduledAt).getTime() - Date.now()) / 3600000;
    return hoursUntil > LIVE_CLASS.EDIT_ALLOWED_BEFORE_HOURS;
  };

  const renderClass = ({ item }: { item: LiveClass }) => {
    const live = item.status === 'Live';
    const rsvpPct = (item.rsvpCount / item.maxParticipants) * 100;

    return (
      <View style={styles.classCard}>
        <View style={styles.classHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.className}>{item.name}</Text>
            <Text style={styles.classMeta}>{item.category} · {item.durationMinutes} min</Text>
          </View>
          {live && <LiveBadge />}
        </View>
        <Text style={styles.classTime}>{formatDateTime(item.scheduledAt)}</Text>

        {tab === 'upcoming' && (
          <View style={styles.rsvpSection}>
            <Text style={styles.rsvpText}>{item.rsvpCount}/{item.maxParticipants} spots taken</Text>
            <View style={styles.rsvpBar}>
              <View style={[styles.rsvpFill, { width: `${rsvpPct}%` as any }]} />
            </View>
          </View>
        )}

        {tab === 'past' && item.averageRating != null && (
          <Text style={styles.rating}>⭐ {item.averageRating.toFixed(1)} avg · {item.rsvpCount} attended</Text>
        )}

        <View style={styles.classActions}>
          {tab === 'upcoming' && isStartable(item) && (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => navigation.navigate('LiveClass', { classId: item.id })}
            >
              <Text style={styles.startBtnText}>🔴 Start Class</Text>
            </TouchableOpacity>
          )}
          {tab === 'upcoming' && isEditable(item) && (
            <TouchableOpacity style={styles.editBtn} onPress={() => {/* edit */}}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          {tab === 'upcoming' && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
          {tab === 'past' && item.recordingUrl && (
            <TouchableOpacity style={styles.editBtn}>
              <Text style={styles.editBtnText}>View Recording</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Classes</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.createBtnText}>+ Schedule</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {(['upcoming', 'past'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'upcoming' ? 'Upcoming' : 'Past Classes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {data.loading ? (
        <View style={{ padding: 16, gap: 10 }}>{[1, 2].map(i => <SkeletonCard key={i} />)}</View>
      ) : (
        <FlatList
          data={data.data ?? []}
          keyExtractor={item => item.id}
          renderItem={renderClass}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.refresh} tintColor={C.primary} />}
          ListEmptyComponent={
            <EmptyState
              emoji="📅"
              title={tab === 'upcoming' ? 'No classes scheduled' : 'No past classes'}
              subtitle={tab === 'upcoming' ? 'Tap "+ Schedule" to create a live class for your clients.' : ''}
              ctaLabel={tab === 'upcoming' ? 'Schedule a Class' : undefined}
              onCTA={tab === 'upcoming' ? () => setShowCreate(true) : undefined}
            />
          }
        />
      )}

      <CreateClassModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); upcoming.refresh(); }}
      />
    </View>
  );
}

// ─── Create Class Modal ───────────────────────────────────────────────────────

function CreateClassModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateClassPayload>({
    name: '', category: 'General', scheduledAt: '', durationMinutes: 60,
    maxParticipants: 20, description: '', recordSession: false,
  });
  const [loading, setLoading] = useState(false);
  const TOKEN_STUB = '';

  const set = (key: keyof CreateClassPayload, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    if (!form.name.trim() || !form.scheduledAt) {
      Alert.alert('Validation', 'Please fill class name and scheduled date/time.'); return;
    }
    setLoading(true);
    try {
      await LiveClassAPI.createClass(form, TRAINER_ID, GYM_ID, TOKEN_STUB);
      onCreated();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Schedule Live Class</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 20, color: C.mid }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            <Text style={modalStyles.label}>Class Name *</Text>
            <TextInput style={modalStyles.input} placeholder="e.g. Morning HIIT" value={form.name} onChangeText={v => set('name', v)} />

            <Text style={modalStyles.label}>Category</Text>
            <View style={modalStyles.chipRow}>
              {CLASS_CATEGORIES.map(c => (
                <TouchableOpacity key={c} style={[modalStyles.chip, form.category === c && modalStyles.chipActive]} onPress={() => set('category', c as ClassCategory)}>
                  <Text style={[modalStyles.chipText, form.category === c && { color: C.white }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modalStyles.label}>Date & Time * (ISO format)</Text>
            <TextInput style={modalStyles.input} placeholder="2026-03-25T07:00:00" value={form.scheduledAt} onChangeText={v => set('scheduledAt', v)} />

            <Text style={modalStyles.label}>Duration</Text>
            <View style={modalStyles.chipRow}>
              {CLASS_DURATIONS.map(d => (
                <TouchableOpacity key={d} style={[modalStyles.chip, form.durationMinutes === d && modalStyles.chipActive]} onPress={() => set('durationMinutes', d)}>
                  <Text style={[modalStyles.chipText, form.durationMinutes === d && { color: C.white }]}>{d} min</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modalStyles.label}>Max Participants (1–50)</Text>
            <TextInput style={modalStyles.input} keyboardType="number-pad" maxLength={2} value={String(form.maxParticipants)} onChangeText={v => set('maxParticipants', parseInt(v) || 1)} />

            <View style={modalStyles.recordRow}>
              <Text style={modalStyles.label}>Record This Class</Text>
              <TouchableOpacity
                style={[modalStyles.toggle, form.recordSession && modalStyles.toggleOn]}
                onPress={() => set('recordSession', !form.recordSession)}
              >
                <View style={[modalStyles.toggleThumb, form.recordSession && modalStyles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            <PrimaryButton label="Schedule Class" onPress={handleCreate} loading={loading} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.dark },
  createBtn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  createBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  tabRow: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: C.mid },
  tabTextActive: { color: C.white },
  classCard: { backgroundColor: C.white, borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 8 },
  classHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  className: { fontSize: 16, fontWeight: '700', color: C.dark },
  classMeta: { fontSize: 12, color: C.mid, marginTop: 2 },
  classTime: { fontSize: 13, color: '#374151' },
  rsvpSection: { gap: 4 },
  rsvpText: { fontSize: 12, color: C.mid },
  rsvpBar: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  rsvpFill: { height: 5, backgroundColor: C.primary, borderRadius: 3 },
  rating: { fontSize: 13, color: C.amber, fontWeight: '500' },
  classActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  startBtn: { backgroundColor: C.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  startBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  editBtn: { backgroundColor: C.primary + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  editBtnText: { color: C.primary, fontWeight: '600', fontSize: 13 },
  cancelBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  cancelBtnText: { color: C.red, fontWeight: '600', fontSize: 13 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: C.dark },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 15, color: C.dark, backgroundColor: C.bg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: C.white },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 12, color: '#374151' },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: C.border, padding: 3 },
  toggleOn: { backgroundColor: C.primary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.white },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
});
