// ── VIDEOS SCREEN ────────────────────────────────────────
// Grid of trainer videos with category filter chips and search bar.
// No props required — uses VIDEOS data from constants/data.js

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Dimensions,
} from 'react-native';
import C from '../constants/colors';
import g from '../styles/global';
import { VIDEOS } from '../constants/data';

const { width } = Dimensions.get('window');

const CATEGORIES    = ['All', 'Cardio', 'Strength', 'Yoga', 'Core', 'Mobility'];
const CATEGORY_COLORS = {
  Cardio:   '#FEE2E2',
  Strength: '#DBEAFE',
  Yoga:     '#D1FAE5',
  Core:     '#FEF3C7',
  Mobility: '#EDE9FE',
  All:      C.light,
};

export default function VideosScreen() {
  const [cat, setCat]     = useState('All');
  const [search, setSearch] = useState('');

  const filtered = VIDEOS.filter(v => {
    const matchesCat    = cat === 'All' || v.category === cat;
    const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase())
      || v.trainer.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <ScrollView style={g.screen}>
      <Text style={g.pageTitle}>🎬 Videos</Text>

      {/* ── Search ── */}
      <TextInput
        style={s.search}
        placeholder="Search videos or trainer…"
        placeholderTextColor={C.mid}
        value={search}
        onChangeText={setSearch}
      />

      {/* ── Category Chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c}
            style={[s.catChip, cat === c && s.catChipActive]}
            onPress={() => setCat(c)}>
            <Text style={[s.catTxt, cat === c && { color: '#fff' }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Video Grid ── */}
      <View style={s.grid}>
        {filtered.map(v => (
          <TouchableOpacity key={v.id} style={s.videoCard}>
            <View style={[s.thumb, { backgroundColor: CATEGORY_COLORS[v.category] || C.blue2 }]}>
              <Text style={{ fontSize: 28 }}>▶</Text>
              <View style={s.durationBadge}>
                <Text style={s.durationTxt}>{v.duration}</Text>
              </View>
              {v.watched && (
                <View style={s.watchedBadge}>
                  <Text style={{ color: '#fff', fontSize: 10 }}>✓ Watched</Text>
                </View>
              )}
            </View>
            <Text style={s.videoTitle} numberOfLines={1}>{v.title}</Text>
            <Text style={s.videoSub}>{v.trainer}</Text>
            <View style={[s.catTag, { backgroundColor: CATEGORY_COLORS[v.category] }]}>
              <Text style={{ fontSize: 10, color: C.dark, fontWeight: '600' }}>{v.category}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  search:        { backgroundColor: C.card, borderRadius: 12, padding: 14, fontSize: 15, color: C.dark, marginBottom: 16, borderWidth: 1, borderColor: C.light },
  catChip:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, marginRight: 8, borderWidth: 1, borderColor: C.light },
  catChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  catTxt:        { fontSize: 13, fontWeight: '600', color: C.mid },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  videoCard:     { width: (width - 44) / 2, backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', elevation: 1 },
  thumb:         { height: 110, alignItems: 'center', justifyContent: 'center' },
  durationBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  durationTxt:   { color: '#fff', fontSize: 10, fontWeight: '600' },
  watchedBadge:  { position: 'absolute', top: 6, left: 6, backgroundColor: C.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  videoTitle:    { fontSize: 13, fontWeight: '600', color: C.dark, padding: 10, paddingBottom: 2 },
  videoSub:      { fontSize: 11, color: C.mid, paddingHorizontal: 10 },
  catTag:        { margin: 10, marginTop: 6, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
});