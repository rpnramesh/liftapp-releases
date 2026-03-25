// ── NOTIFICATIONS SCREEN ─────────────────────────────────
// Lists app notifications. Unread ones have a blue left border and dot.
// "Mark all read" button clears all unread indicators.
//
// Props:
//   onBack – function to go back to the previous screen

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import C from '../constants/colors';
import { NOTIFS } from '../constants/data';

export default function NotificationsScreen({ onBack }) {
  const [notifs, setNotifs] = useState(NOTIFS);

  const markAll = () => setNotifs(notifs.map(n => ({ ...n, read: true })));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color: C.primary, fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
        <TouchableOpacity onPress={markAll}>
          <Text style={{ color: C.primary, fontSize: 13 }}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* ── Notification List ── */}
      <ScrollView style={{ padding: 16 }}>
        {notifs.map(n => (
          <View key={n.id} style={[s.card, !n.read && s.cardUnread]}>
            <Text style={{ fontSize: 24 }}>{n.icon}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.nTitle}>{n.title}</Text>
              <Text style={s.nBody}>{n.body}</Text>
              <Text style={s.nTime}>{n.time}</Text>
            </View>
            {!n.read && <View style={s.dot} />}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.light },
  title:      { fontSize: 16, fontWeight: '700', color: C.dark },
  card:       { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: C.primary },
  nTitle:     { fontSize: 14, fontWeight: '600', color: C.dark },
  nBody:      { fontSize: 13, color: C.mid, marginTop: 2 },
  nTime:      { fontSize: 11, color: C.light, marginTop: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
});