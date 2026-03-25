// ── PROGRESS SCREEN ──────────────────────────────────────
// Two tabs: Weight tracking and Body Measurements.
// Weight tab shows BMI card, trend chart, and daily log input.
// Measurements tab shows expandable body part cards.
//
// Props:
//   member         – member data (used for BMI calculation)
//   weightLog      – array of { date, weight } entries
//   setWeightLog   – function(newLog) to update weight log (also saves to storage)
//   measureData    – object of body part measurement arrays
//   setMeasureData – function(newData) to update measurements (also saves to storage)

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import C from '../constants/colors';
import g from '../styles/global';
import { MEASURE_HISTORY } from '../constants/data';

// ── BMI Zone Chart ───────────────────────────────────────
function WeightZoneChart({ weightLog, memberHeight }) {
  const CHART_H = 200;
  const CHART_W_PADDING = 16;

  if (!memberHeight || memberHeight <= 0 || weightLog.length === 0) {
    return (
      <View style={zc.empty}>
        <Text style={zc.emptyTxt}>Log weight entries to see your BMI zone chart</Text>
      </View>
    );
  }

  const hM = memberHeight / 100;
  // BMI threshold weights
  const wUnder  = 18.5 * hM * hM;   // below = underweight
  const wNormal = 25   * hM * hM;   // below = normal
  const wOver   = 30   * hM * hM;   // below = overweight, above = obese

  // Use only last 10 entries (sorted by order, assumed chronological)
  const entries = weightLog.slice(-10);
  const weights = entries.map(e => e.weight);
  const allWts  = [...weights, wUnder, wNormal, wOver];
  const minW    = Math.min(...allWts) - 2;
  const maxW    = Math.max(...allWts) + 2;
  const range   = maxW - minW;

  const toY = (w) => CHART_H - ((w - minW) / range) * CHART_H;

  // Zone band heights (in px)
  const yUnder  = toY(wUnder);
  const yNormal = toY(wNormal);
  const yOver   = toY(wOver);

  // Count zone occurrences
  let countUnder = 0, countNormal = 0, countOver = 0, countObese = 0;
  weights.forEach(w => {
    if (w < wUnder)       countUnder++;
    else if (w < wNormal) countNormal++;
    else if (w < wOver)   countOver++;
    else                  countObese++;
  });

  const getBmiColor = (w) => {
    if (w < wUnder)       return '#3B82F6';
    if (w < wNormal)      return '#10B981';
    if (w < wOver)        return '#F59E0B';
    return '#EF4444';
  };

  const DOT_R = 5;
  const totalW = 300; // approximate chart width

  return (
    <View style={zc.wrap}>
      {/* Zone bands + dots */}
      <View style={[zc.chartArea, { height: CHART_H }]}>
        {/* Obese band (top) */}
        <View style={[zc.band, { top: 0, height: Math.max(yOver, 0), backgroundColor: '#EF444422' }]} />
        {/* Overweight band */}
        <View style={[zc.band, { top: yOver, height: Math.max(yNormal - yOver, 0), backgroundColor: '#F59E0B22' }]} />
        {/* Normal band */}
        <View style={[zc.band, { top: yNormal, height: Math.max(yUnder - yNormal, 0), backgroundColor: '#10B98122' }]} />
        {/* Underweight band (bottom) */}
        <View style={[zc.band, { top: yUnder, height: Math.max(CHART_H - yUnder, 0), backgroundColor: '#3B82F622' }]} />

        {/* Threshold lines */}
        <View style={[zc.line, { top: yUnder }]} />
        <View style={[zc.line, { top: yNormal }]} />
        <View style={[zc.line, { top: yOver }]} />

        {/* Threshold labels */}
        <Text style={[zc.lineLabel, { top: yUnder + 2 }]}>{wUnder.toFixed(1)} kg</Text>
        <Text style={[zc.lineLabel, { top: yNormal + 2 }]}>{wNormal.toFixed(1)} kg</Text>
        <Text style={[zc.lineLabel, { top: yOver + 2 }]}>{wOver.toFixed(1)} kg</Text>

        {/* Dots + connecting line */}
        {entries.map((entry, i) => {
          const x = CHART_W_PADDING + (i / Math.max(entries.length - 1, 1)) * (totalW - CHART_W_PADDING * 2);
          const y = toY(entry.weight);
          const col = getBmiColor(entry.weight);
          return (
            <View key={i}>
              {i > 0 && (() => {
                const prevX = CHART_W_PADDING + ((i - 1) / Math.max(entries.length - 1, 1)) * (totalW - CHART_W_PADDING * 2);
                const prevY = toY(entries[i - 1].weight);
                const dx = x - prevX;
                const dy = y - prevY;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                return (
                  <View style={{
                    position: 'absolute',
                    left: prevX + DOT_R,
                    top: prevY,
                    width: len,
                    height: 1.5,
                    backgroundColor: '#9CA3AF',
                    transform: [{ rotate: `${angle}deg` }],
                    transformOrigin: '0 50%',
                  }} />
                );
              })()}
              <View style={[zc.dot, { left: x - DOT_R, top: y - DOT_R, backgroundColor: col, borderColor: col }]} />
              <Text style={[zc.dotLabel, { left: x - 16, top: y - 18, color: col }]}>{entry.weight}</Text>
            </View>
          );
        })}

        {/* X-axis date labels */}
        {entries.map((entry, i) => {
          const x = CHART_W_PADDING + (i / Math.max(entries.length - 1, 1)) * (totalW - CHART_W_PADDING * 2);
          return (
            <Text key={i} style={[zc.dateLabel, { left: x - 16 }]}>{entry.date}</Text>
          );
        })}
      </View>

      {/* Legend */}
      <View style={zc.legend}>
        {[
          { label: 'Obese',       color: '#EF4444', count: countObese  },
          { label: 'Overweight',  color: '#F59E0B', count: countOver   },
          { label: 'Normal',      color: '#10B981', count: countNormal },
          { label: 'Underweight', color: '#3B82F6', count: countUnder  },
        ].map(z => (
          <View key={z.label} style={zc.legendItem}>
            <View style={[zc.legendDot, { backgroundColor: z.color }]} />
            <Text style={zc.legendLabel}>{z.label}</Text>
            <Text style={[zc.legendCount, { color: z.color }]}>{z.count}×</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ProgressScreen({ member, weightLog, setWeightLog, measureData, setMeasureData }) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const [tab, setTab]             = useState('Weight');

  // ── Weight State ──
  const [weightInput, setWeightInput] = useState('');
  const [editingToday, setEditingToday] = useState(false);
  const [editInput, setEditInput]   = useState('');

  const log          = weightLog;
  const todayEntry   = log.find(l => l.date === today);
  const hasLoggedToday = !!todayEntry;
  const chartLog     = log.filter(l => l.date !== today).slice(-5);

  const saveWeight = () => {
    if (!weightInput) return;
    setWeightLog([...log, { date: today, weight: parseFloat(weightInput) }]);
    setWeightInput('');
  };

  const saveWeightEdit = () => {
    if (!editInput) return;
    setWeightLog(log.map(l =>
      l.date === today ? { ...l, weight: parseFloat(editInput) } : l
    ));
    setEditingToday(false);
    setEditInput('');
  };

  // ── Measurements State ──
  const [expandedMeasure, setExpandedMeasure] = useState(null);
  const [measureEditing, setMeasureEditing]   = useState({});
  const [measureInputs, setMeasureInputs]     = useState({});

  const getTodayMeasure = (key) => measureData[key].find(m => m.date === today);

  const saveMeasure = (key) => {
    const val = measureInputs[key];
    if (!val) return;
    const todayM = getTodayMeasure(key);
    const updated = todayM
      ? measureData[key].map(m => m.date === today ? { ...m, val: parseFloat(val) } : m)
      : [...measureData[key], { date: today, val: parseFloat(val) }];
    setMeasureData({ ...measureData, [key]: updated });
    setMeasureEditing(prev => ({ ...prev, [key]: false }));
    setMeasureInputs(prev => ({ ...prev, [key]: '' }));
  };

  // ── BMI Calculation ──
  const bmi      = (member.weight / ((member.height / 100) ** 2)).toFixed(1);
  const bmiColor = bmi < 18.5 ? '#3B82F6' : bmi < 25 ? C.green : bmi < 30 ? C.amber : C.red;
  const bmiLabel = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';

  return (
    <ScrollView style={g.screen}>
      <Text style={g.pageTitle}>📈 Progress</Text>

      {/* ── Tab Switcher ── */}
      <View style={s.tabs}>
        {['Weight', 'Measurements'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Weight' ? (
        <>
          {/* ── BMI Card ── */}
          <View style={s.bmiCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.bmiLabel}>Current BMI</Text>
              <Text style={[s.bmiVal, { color: bmiColor }]}>{bmi}</Text>
              <View style={[s.bmiTag, { backgroundColor: bmiColor + '22' }]}>
                <Text style={[s.bmiTagTxt, { color: bmiColor }]}>{bmiLabel}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.weightBig}>{member.weight} kg</Text>
              <Text style={s.weightSub}>Goal: {member.goalWeight} kg</Text>
              <Text style={{ color: C.green, fontSize: 13, marginTop: 4 }}>
                {member.weight > member.goalWeight
                  ? `↓ ${(member.weight - member.goalWeight).toFixed(1)} kg to go`
                  : '🎯 Goal reached!'}
              </Text>
            </View>
          </View>

          {/* ── BMI Zone Chart ── */}
          <Text style={g.sec}>Weight & BMI Zones</Text>
          <WeightZoneChart weightLog={log} memberHeight={member.height} />

          {/* ── Today's Weight Input ── */}
          <Text style={g.sec}>Today's Weight</Text>
          {!hasLoggedToday ? (
            <View style={s.logRow}>
              <TextInput
                style={s.logInput}
                placeholder="e.g. 72.5"
                placeholderTextColor={C.mid}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
              />
              <Text style={s.unit}>kg</Text>
              <TouchableOpacity
                style={[s.logBtn, !weightInput && s.logBtnOff]}
                onPress={saveWeight}
                disabled={!weightInput}>
                <Text style={s.logBtnTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : editingToday ? (
            <View style={s.logRow}>
              <TextInput
                style={s.logInput}
                placeholder={String(todayEntry.weight)}
                placeholderTextColor={C.mid}
                value={editInput}
                onChangeText={setEditInput}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={s.unit}>kg</Text>
              <TouchableOpacity
                style={[s.logBtn, !editInput && s.logBtnOff]}
                onPress={saveWeightEdit}
                disabled={!editInput}>
                <Text style={s.logBtnTxt}>Update</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingToday(false)}>
                <Text style={s.cancelBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={s.todayEntry}
              onPress={() => { setEditingToday(true); setEditInput(String(todayEntry.weight)); }}>
              <View>
                <Text style={s.todayEntryVal}>{todayEntry.weight} kg</Text>
                <Text style={s.todayEntryLbl}>Logged today · tap to edit</Text>
              </View>
              <Text style={{ fontSize: 16 }}>✏️</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        /* ── Measurements Tab ── */
        <View>
          <Text style={s.measureHint}>Tap a body part to expand history and log today's measurement.</Text>
          {Object.keys(measureData).map((key) => {
            const isExpanded   = expandedMeasure === key;
            const history      = measureData[key];
            const todayM       = getTodayMeasure(key);
            const latest       = history[history.length - 1];
            const isEditingThis = measureEditing[key];
            const historyOnly  = history.filter(m => m.date !== today);

            return (
              <View key={key} style={[s.measureWrap, isExpanded && s.measureWrapOpen]}>
                <TouchableOpacity
                  style={s.measureHeader}
                  onPress={() => setExpandedMeasure(isExpanded ? null : key)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.measureKey}>{key}</Text>
                    <Text style={s.measureLatest}>
                      {todayM ? `Today: ${todayM.val} cm` : `Last: ${latest.val} cm`}
                    </Text>
                  </View>
                  {todayM && <View style={s.loggedDot} />}
                  <Text style={s.measureChevron}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={s.measureExpanded}>
                    <Text style={s.measureSectionTitle}>History</Text>
                    {historyOnly.slice(-5).map((m, i) => (
                      <View key={i} style={s.measureHistRow}>
                        <Text style={s.measureHistDate}>{m.date}</Text>
                        <Text style={s.measureHistVal}>{m.val} cm</Text>
                        <Text style={{ fontSize: 11, color: C.mid }}>🔒</Text>
                      </View>
                    ))}

                    <Text style={[s.measureSectionTitle, { marginTop: 14 }]}>📍 Today</Text>
                    {todayM && !isEditingThis ? (
                      <TouchableOpacity
                        style={s.todayEntry}
                        onPress={() => {
                          setMeasureEditing(prev => ({ ...prev, [key]: true }));
                          setMeasureInputs(prev => ({ ...prev, [key]: String(todayM.val) }));
                        }}>
                        <View>
                          <Text style={s.todayEntryVal}>{todayM.val} cm</Text>
                          <Text style={s.todayEntryLbl}>Tap to edit</Text>
                        </View>
                        <Text style={{ fontSize: 16 }}>✏️</Text>
                      </TouchableOpacity>
                    ) : isEditingThis ? (
                      <View style={s.logRow}>
                        <TextInput
                          style={s.logInput}
                          value={measureInputs[key] || ''}
                          onChangeText={val => setMeasureInputs(prev => ({ ...prev, [key]: val }))}
                          keyboardType="decimal-pad"
                          placeholder={todayM ? String(todayM.val) : 'e.g. 96.5'}
                          placeholderTextColor={C.mid}
                          autoFocus
                        />
                        <Text style={s.unit}>cm</Text>
                        <TouchableOpacity
                          style={[s.logBtn, !measureInputs[key] && s.logBtnOff]}
                          onPress={() => saveMeasure(key)}
                          disabled={!measureInputs[key]}>
                          <Text style={s.logBtnTxt}>{todayM ? 'Update' : 'Save'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.cancelBtn}
                          onPress={() => setMeasureEditing(prev => ({ ...prev, [key]: false }))}>
                          <Text style={s.cancelBtnTxt}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={s.addTodayBtn}
                        onPress={() => setMeasureEditing(prev => ({ ...prev, [key]: true }))}>
                        <Text style={s.addTodayBtnTxt}>+ Log today's measurement</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tabs:               { flexDirection: 'row', backgroundColor: C.light, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab:                { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:          { backgroundColor: '#fff' },
  tabTxt:             { fontSize: 14, fontWeight: '600', color: C.mid },
  tabTxtActive:       { color: C.primary },
  bmiCard:            { backgroundColor: C.card, borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  bmiLabel:           { fontSize: 12, color: C.mid, fontWeight: '500', marginBottom: 4 },
  bmiVal:             { fontSize: 32, fontWeight: '800' },
  bmiTag:             { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start' },
  bmiTagTxt:          { fontSize: 12, fontWeight: '700' },
  weightBig:          { fontSize: 28, fontWeight: '800', color: C.dark },
  weightSub:          { fontSize: 13, color: C.mid },
  logRow:             { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logInput:           { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, fontSize: 18, color: C.dark, borderWidth: 1, borderColor: C.light },
  unit:               { fontSize: 15, color: C.mid, fontWeight: '600' },
  logBtn:             { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14 },
  logBtnOff:          { backgroundColor: C.light },
  logBtnTxt:          { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn:          { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt:       { color: C.red, fontWeight: '700', fontSize: 14 },
  todayEntry:         { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: C.green },
  todayEntryVal:      { fontSize: 20, fontWeight: '800', color: C.dark },
  todayEntryLbl:      { fontSize: 12, color: C.mid, marginTop: 2 },
  measureHint:        { fontSize: 13, color: C.mid, marginBottom: 14, fontStyle: 'italic' },
  measureWrap:        { backgroundColor: C.card, borderRadius: 14, marginBottom: 10, overflow: 'hidden', elevation: 1, borderWidth: 1, borderColor: C.light },
  measureWrapOpen:    { borderColor: C.primary },
  measureHeader:      { flexDirection: 'row', alignItems: 'center', padding: 16 },
  measureKey:         { fontSize: 15, fontWeight: '700', color: C.dark },
  measureLatest:      { fontSize: 12, color: C.mid, marginTop: 2 },
  measureChevron:     { fontSize: 13, color: C.mid, marginLeft: 8 },
  loggedDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginRight: 8 },
  measureExpanded:    { borderTopWidth: 1, borderTopColor: C.light, padding: 14 },
  measureSectionTitle:{ fontSize: 11, fontWeight: '700', color: C.mid, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  measureHistRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.light },
  measureHistDate:    { flex: 1, fontSize: 13, color: C.mid },
  measureHistVal:     { fontSize: 14, fontWeight: '600', color: C.dark, marginRight: 8 },
  addTodayBtn:        { borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  addTodayBtnTxt:     { color: C.primary, fontWeight: '600', fontSize: 14 },
});

const zc = StyleSheet.create({
  wrap:        { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', elevation: 1, marginBottom: 4 },
  chartArea:   { width: '100%', position: 'relative', overflow: 'hidden' },
  band:        { position: 'absolute', left: 0, right: 0 },
  line:        { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#D1D5DB' },
  lineLabel:   { position: 'absolute', right: 4, fontSize: 9, color: '#6B7280' },
  dot:         { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  dotLabel:    { position: 'absolute', fontSize: 9, fontWeight: '700', width: 32, textAlign: 'center' },
  dateLabel:   { position: 'absolute', bottom: 2, fontSize: 8, color: '#6B7280', width: 32, textAlign: 'center' },
  legend:      { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: '#374151' },
  legendCount: { fontSize: 11, fontWeight: '700' },
  empty:       { backgroundColor: C.card, borderRadius: 14, padding: 24, alignItems: 'center', elevation: 1 },
  emptyTxt:    { fontSize: 13, color: '#6B7280', textAlign: 'center' },
});