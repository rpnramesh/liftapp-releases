// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Progress Screen
// Weight tracking + Body Measurements with Firestore persistence
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import {
    logMeasurement,
    logWeight,
    subscribeToMeasurements,
    subscribeToWeightLog,
} from '../../services/progress.service';

// ─── Constants ────────────────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 180;
const ACCENT = '#4F8EF7';
const GREEN = '#10B981';
const RED = '#EF4444';
const AMBER = '#F59E0B';
const BG = '#0A0B0F';
const CARD = '#13151C';
const BORDER = '#2A2D38';
const TXT = '#F1F3F9';
const SUB = '#8B8FA3';

const MEASUREMENT_TYPES = [
  'Chest', 'Waist', 'Hips',
  'Left Arm', 'Right Arm',
  'Left Thigh', 'Right Thigh',
  'Left Calf', 'Right Calf',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function fmtFullDate(ts) {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MemberProgressScreen() {
  const { memberId, gymId } = useAuth();
  const [tab, setTab] = useState('weight'); // 'weight' | 'measurements'

  if (!gymId || !memberId) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <View style={st.emptyCenter}>
          <Text style={st.emptyIcon}>🏋️</Text>
          <Text style={st.emptyTitle}>No Gym Linked</Text>
          <Text style={st.emptySub}>
            Ask your gym to add you to the system to start tracking progress.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.headerTitle}>Body Progress</Text>
      </View>

      {/* Tab Switcher */}
      <View style={st.tabRow}>
        <Pressable
          style={[st.tabBtn, tab === 'weight' && st.tabBtnActive]}
          onPress={() => setTab('weight')}
        >
          <Ionicons name="scale-outline" size={16} color={tab === 'weight' ? ACCENT : SUB} />
          <Text style={[st.tabLabel, tab === 'weight' && st.tabLabelActive]}>Weight</Text>
        </Pressable>
        <Pressable
          style={[st.tabBtn, tab === 'measurements' && st.tabBtnActive]}
          onPress={() => setTab('measurements')}
        >
          <Ionicons name="resize-outline" size={16} color={tab === 'measurements' ? ACCENT : SUB} />
          <Text style={[st.tabLabel, tab === 'measurements' && st.tabLabelActive]}>Measurements</Text>
        </Pressable>
      </View>

      {tab === 'weight' ? (
        <WeightTab gymId={gymId} memberId={memberId} />
      ) : (
        <MeasurementsTab gymId={gymId} memberId={memberId} />
      )}
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// WEIGHT TAB
// ═════════════════════════════════════════════════════════════════════════════
function WeightTab({ gymId, memberId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    const unsub = subscribeToWeightLog(gymId, memberId, (data) => {
      setEntries(data);
      setLoading(false);
    }, 50);
    return unsub;
  }, [gymId, memberId]);

  const handleSave = useCallback(async () => {
    const w = parseFloat(newWeight);
    if (!w || w < 20 || w > 300) {
      Alert.alert('Invalid Weight', 'Enter a weight between 20 and 300 kg.');
      return;
    }
    setSaving(true);
    try {
      await logWeight(gymId, memberId, w, newNote.trim() || undefined);
      setNewWeight('');
      setNewNote('');
      setShowAdd(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save weight. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [gymId, memberId, newWeight, newNote]);

  // Stats
  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const previous = entries.length > 1 ? entries[entries.length - 2] : null;
  const diff = latest && previous ? latest.weight - previous.weight : null;

  if (loading) {
    return (
      <View style={st.emptyCenter}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Current Weight Card */}
        <View style={st.card}>
          <Text style={st.cardLabel}>Current Weight</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={st.bigNum}>{latest ? `${latest.weight}` : '—'}</Text>
            <Text style={st.bigUnit}>kg</Text>
            {diff !== null && (
              <View style={[st.diffBadge, { backgroundColor: diff > 0 ? 'rgba(239,68,68,0.15)' : diff < 0 ? 'rgba(16,185,129,0.15)' : 'rgba(139,143,163,0.15)' }]}>
                <Ionicons
                  name={diff > 0 ? 'arrow-up' : diff < 0 ? 'arrow-down' : 'remove'}
                  size={12}
                  color={diff > 0 ? RED : diff < 0 ? GREEN : SUB}
                />
                <Text style={[st.diffText, { color: diff > 0 ? RED : diff < 0 ? GREEN : SUB }]}>
                  {Math.abs(diff).toFixed(1)} kg
                </Text>
              </View>
            )}
          </View>
          {latest && <Text style={st.cardSub}>{fmtFullDate(latest.loggedAt)}</Text>}
        </View>

        {/* Mini Chart */}
        {entries.length >= 2 && (
          <View style={st.card}>
            <Text style={st.cardLabel}>Trend</Text>
            <MiniWeightChart entries={entries.slice(-20)} />
          </View>
        )}

        {/* Weight History */}
        <View style={st.card}>
          <Text style={st.cardLabel}>History</Text>
          {entries.length === 0 ? (
            <Text style={st.emptySub}>No entries yet. Tap + to log your first weight.</Text>
          ) : (
            [...entries].reverse().map((e, i) => {
              const prev = entries[entries.length - 1 - i - 1];
              const d = prev ? e.weight - prev.weight : null;
              return (
                <View key={e.id} style={st.historyRow}>
                  <View>
                    <Text style={st.histWeight}>{e.weight} kg</Text>
                    {e.note ? <Text style={st.histNote}>{e.note}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.histDate}>{fmtFullDate(e.loggedAt)}</Text>
                    {d !== null && (
                      <Text style={{ fontSize: 11, color: d > 0 ? RED : d < 0 ? GREEN : SUB }}>
                        {d > 0 ? '+' : ''}{d.toFixed(1)} kg
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable style={st.fab} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={28} color="#FFF" />
      </Pressable>

      {/* Add Weight Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView
          style={st.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Log Weight</Text>

            <Text style={st.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={st.input}
              keyboardType="decimal-pad"
              value={newWeight}
              onChangeText={setNewWeight}
              placeholder="e.g. 72.5"
              placeholderTextColor="#5A5F6B"
              autoFocus
            />

            <Text style={st.inputLabel}>Note (optional)</Text>
            <TextInput
              style={[st.input, { height: 60 }]}
              value={newNote}
              onChangeText={setNewNote}
              placeholder="Morning weight, post-workout…"
              placeholderTextColor="#5A5F6B"
              multiline
            />

            <View style={st.modalBtns}>
              <Pressable style={st.cancelBtn} onPress={() => { setShowAdd(false); setNewWeight(''); setNewNote(''); }}>
                <Text style={st.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[st.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={st.saveText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Mini line chart ───────────────────────────────────────────────────────────
function MiniWeightChart({ entries }) {
  if (entries.length < 2) return null;
  const weights = entries.map(e => e.weight);
  const min = Math.min(...weights) - 1;
  const max = Math.max(...weights) + 1;
  const range = max - min || 1;
  const w = SCREEN_W - 64;
  const h = CHART_H;
  const step = w / (entries.length - 1);

  const points = entries.map((e, i) => ({
    x: i * step,
    y: h - ((e.weight - min) / range) * (h - 20) - 10,
  }));

  return (
    <View style={{ height: h, marginTop: 8 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: h - frac * (h - 20) - 10,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: BORDER,
          }}
        />
      ))}
      {/* Y labels */}
      <Text style={[st.chartLabel, { top: 0 }]}>{max.toFixed(0)}</Text>
      <Text style={[st.chartLabel, { top: h / 2 - 6 }]}>{((min + max) / 2).toFixed(0)}</Text>
      <Text style={[st.chartLabel, { top: h - 16 }]}>{min.toFixed(0)}</Text>

      {/* Dots + connecting lines */}
      {points.map((p, i) => (
        <React.Fragment key={i}>
          {i < points.length - 1 && (
            <View
              style={{
                position: 'absolute',
                left: p.x + 24,
                top: p.y,
                width: Math.sqrt(
                  Math.pow(points[i + 1].x - p.x, 2) + Math.pow(points[i + 1].y - p.y, 2),
                ),
                height: 2,
                backgroundColor: ACCENT,
                transformOrigin: 'left center',
                transform: [
                  {
                    rotate: `${Math.atan2(points[i + 1].y - p.y, points[i + 1].x - p.x)}rad`,
                  },
                ],
              }}
            />
          )}
          <View
            style={{
              position: 'absolute',
              left: p.x + 24 - 4,
              top: p.y - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === points.length - 1 ? ACCENT : '#1E2030',
              borderWidth: 2,
              borderColor: ACCENT,
            }}
          />
        </React.Fragment>
      ))}

      {/* X labels */}
      <Text style={[st.chartLabelX, { left: 24 }]}>{fmtDate(entries[0].loggedAt)}</Text>
      <Text style={[st.chartLabelX, { right: 0, textAlign: 'right' }]}>
        {fmtDate(entries[entries.length - 1].loggedAt)}
      </Text>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MEASUREMENTS TAB
// ═════════════════════════════════════════════════════════════════════════════
function MeasurementsTab({ gymId, memberId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState(MEASUREMENT_TYPES[0]);
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    const unsub = subscribeToMeasurements(gymId, memberId, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, [gymId, memberId]);

  // Group entries by type — latest + previous
  const grouped = useMemo(() => {
    const map = {};
    for (const e of entries) {
      if (!map[e.type]) map[e.type] = [];
      map[e.type].push(e);
    }
    return MEASUREMENT_TYPES.map((t) => {
      const list = map[t] || [];
      return {
        type: t,
        latest: list[0] || null,
        previous: list[1] || null,
      };
    });
  }, [entries]);

  const handleSave = useCallback(async () => {
    const v = parseFloat(newValue);
    if (!v || v < 1 || v > 300) {
      Alert.alert('Invalid Value', 'Enter a measurement between 1 and 300 cm.');
      return;
    }
    setSaving(true);
    try {
      await logMeasurement(gymId, memberId, selectedType, v);
      setNewValue('');
      setShowAdd(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save measurement. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [gymId, memberId, selectedType, newValue]);

  if (loading) {
    return (
      <View style={st.emptyCenter}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Measurement Cards Grid */}
        <View style={st.measGrid}>
          {grouped.map((g) => {
            const delta = g.latest && g.previous ? g.latest.value - g.previous.value : null;
            return (
              <View key={g.type} style={st.measCard}>
                <Text style={st.measType}>{g.type}</Text>
                <Text style={st.measValue}>
                  {g.latest ? `${g.latest.value}` : '—'}
                  <Text style={st.measUnit}> cm</Text>
                </Text>
                {delta !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                    <Ionicons
                      name={delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'remove'}
                      size={10}
                      color={delta > 0 ? AMBER : delta < 0 ? GREEN : SUB}
                    />
                    <Text style={{ fontSize: 11, color: delta > 0 ? AMBER : delta < 0 ? GREEN : SUB }}>
                      {Math.abs(delta).toFixed(1)}
                    </Text>
                  </View>
                )}
                {g.latest && (
                  <Text style={st.measDate}>{fmtDate(g.latest.loggedAt)}</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable style={st.fab} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={28} color="#FFF" />
      </Pressable>

      {/* Add Measurement Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView
          style={st.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Log Measurement</Text>

            <Text style={st.inputLabel}>Body Part</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {MEASUREMENT_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[st.typeChip, selectedType === t && st.typeChipActive]}
                  onPress={() => setSelectedType(t)}
                >
                  <Text style={[st.typeChipText, selectedType === t && st.typeChipTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={st.inputLabel}>Measurement (cm)</Text>
            <TextInput
              style={st.input}
              keyboardType="decimal-pad"
              value={newValue}
              onChangeText={setNewValue}
              placeholder="e.g. 90.5"
              placeholderTextColor="#5A5F6B"
              autoFocus
            />

            <View style={st.modalBtns}>
              <Pressable style={st.cancelBtn} onPress={() => { setShowAdd(false); setNewValue(''); }}>
                <Text style={st.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[st.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={st.saveText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: TXT, fontSize: 20, fontWeight: '700' },
  emptySub: { color: SUB, fontSize: 14, marginTop: 6, textAlign: 'center' },

  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: TXT, fontSize: 22, fontWeight: '800' },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: { backgroundColor: '#1E2030' },
  tabLabel: { color: SUB, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: ACCENT },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardLabel: { color: SUB, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardSub: { color: SUB, fontSize: 12, marginTop: 4 },
  bigNum: { color: TXT, fontSize: 36, fontWeight: '800' },
  bigUnit: { color: SUB, fontSize: 16, fontWeight: '600' },

  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  diffText: { fontSize: 12, fontWeight: '600' },

  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  histWeight: { color: TXT, fontSize: 15, fontWeight: '700' },
  histNote: { color: SUB, fontSize: 12, marginTop: 2 },
  histDate: { color: SUB, fontSize: 12 },

  chartLabel: { position: 'absolute', left: 0, color: SUB, fontSize: 10 },
  chartLabelX: { position: 'absolute', bottom: -14, color: SUB, fontSize: 10 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { color: TXT, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  inputLabel: { color: SUB, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#1E2030',
    color: TXT,
    fontSize: 16,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  cancelText: { color: SUB, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  saveText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // ── Measurements Grid ──
  measGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  measCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    width: (SCREEN_W - 42) / 2,
    borderWidth: 1,
    borderColor: BORDER,
  },
  measType: { color: SUB, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  measValue: { color: TXT, fontSize: 22, fontWeight: '800' },
  measUnit: { color: SUB, fontSize: 13, fontWeight: '600' },
  measDate: { color: SUB, fontSize: 10, marginTop: 4 },

  // ── Type chips ──
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E2030',
    marginRight: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  typeChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  typeChipText: { color: SUB, fontSize: 13, fontWeight: '600' },
  typeChipTextActive: { color: '#FFF' },
});
