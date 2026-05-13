// NutritionScreen.js — Firebase-backed nutrition tracker
// Foods: Firestore nutritionFoods collection (admin-managed)
// Daily log: members/{uid}/nutritionLogs/{YYYY-MM-DD}
// Goals: members/{uid}.nutritionGoals
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './shared/firebase/config';
import { usePalette, useTheme } from './LIFT_PROJECT/theme/ThemeProvider';

const { width } = Dimensions.get('window');

// ── BMR / TDEE helpers ────────────────────────────────────────────────────────
const ACTIVITY = [
  { key: 'sedentary',   label: 'Sedentary',         sub: 'Little / no exercise',       factor: 1.2  },
  { key: 'light',       label: 'Lightly Active',     sub: '1–3 days/week',              factor: 1.375 },
  { key: 'moderate',    label: 'Moderately Active',  sub: '3–5 days/week',              factor: 1.55 },
  { key: 'very',        label: 'Very Active',        sub: '6–7 days/week',              factor: 1.725 },
];

function calcBMR(weight, height, age = 30, sex = 'male') {
  // Mifflin-St Jeor
  if (sex === 'female') return 10 * weight + 6.25 * height - 5 * age - 161;
  return 10 * weight + 6.25 * height - 5 * age + 5;
}

function calcGoals(type, weight, height, activityFactor) {
  const bmr = calcBMR(weight, height);
  const tdee = Math.round(bmr * activityFactor);
  if (type === 'weight_loss') {
    const cal = Math.max(1200, tdee - 500);
    const pro = Math.round(weight * 1.8);
    const fat = Math.round((cal * 0.25) / 9);
    const carb = Math.round((cal - pro * 4 - fat * 9) / 4);
    return { calories: cal, protein: pro, carbs: Math.max(carb, 50), fat };
  }
  if (type === 'muscle_gain') {
    const cal = tdee + 300;
    const pro = Math.round(weight * 2.1);
    const fat = Math.round((cal * 0.25) / 9);
    const carb = Math.round((cal - pro * 4 - fat * 9) / 4);
    return { calories: cal, protein: pro, carbs: Math.max(carb, 100), fat };
  }
  // maintain
  const pro = Math.round(weight * 1.6);
  const fat = Math.round((tdee * 0.3) / 9);
  const carb = Math.round((tdee - pro * 4 - fat * 9) / 4);
  return { calories: tdee, protein: pro, carbs: Math.max(carb, 80), fat };
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Macro progress bar ────────────────────────────────────────────────────────
function MacroBar({ label, value, goal, color, unit = 'g' }) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 700, useNativeDriver: false }).start();
  }, [pct]);
  const over = goal > 0 && value > goal;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#888' }}>{label}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: over ? '#ef4444' : '#111' }}>
          {value}{unit} <Text style={{ color: '#aaa', fontWeight: '400' }}>/ {goal}{unit}</Text>
        </Text>
      </View>
      <View style={{ height: 7, borderRadius: 4, backgroundColor: '#f0f0f0', overflow: 'hidden' }}>
        <Animated.View style={{
          height: 7, borderRadius: 4,
          backgroundColor: over ? '#ef4444' : color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }} />
      </View>
    </View>
  );
}

// ── Quantity entry modal ──────────────────────────────────────────────────────
function QuantityModal({ food, visible, onClose, onAdd, theme }) {
  const [grams, setGrams] = useState('');
  const slideY = useRef(new Animated.Value(600)).current;
  const brand = theme?.brand?.[600] || '#4f46e5';
  const bg    = theme?.surface?.raised || '#fff';
  const textP = theme?.text?.primary || '#111';
  const textS = theme?.text?.secondary || '#555';
  const bord  = theme?.border?.subtle || '#e5e7eb';

  useEffect(() => {
    if (visible) {
      setGrams(food ? String(food.servingGrams || 100) : '');
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, food]);

  if (!food) return null;
  const g = parseFloat(grams) || 0;
  const scale = g / 100;
  const cal  = +(food.caloriesPer100g  * scale).toFixed(1);
  const pro  = +(food.proteinPer100g   * scale).toFixed(1);
  const carb = +(food.carbsPer100g     * scale).toFixed(1);
  const fat  = +(food.fatPer100g       * scale).toFixed(1);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        transform: [{ translateY: slideY }],
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
      }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: bord, alignSelf: 'center', marginTop: 12 }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
            {/* Food header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 44 }}>{food.emoji || '🍽️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: textP, letterSpacing: -0.3 }}>{food.name}</Text>
                <Text style={{ fontSize: 12, color: textS, marginTop: 2 }}>
                  Std. serving: {food.servingLabel} ({food.servingGrams}g)
                </Text>
              </View>
            </View>

            {/* Quantity input */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: textS, marginBottom: 6 }}>How many grams?</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              borderWidth: 2, borderColor: brand, borderRadius: 14,
              paddingHorizontal: 16, marginBottom: 20,
            }}>
              <TextInput
                style={{ flex: 1, fontSize: 28, fontWeight: '800', color: textP, paddingVertical: 12 }}
                keyboardType="numeric"
                value={grams}
                onChangeText={setGrams}
                selectTextOnFocus
              />
              <Text style={{ fontSize: 16, fontWeight: '600', color: textS }}>g</Text>
            </View>

            {/* Quick size buttons */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}
              contentContainerStyle={{ gap: 8 }}>
              {[50, food.servingGrams, 150, 200, 250, 300].filter((v, i, a) => a.indexOf(v) === i).map(v => (
                <TouchableOpacity key={v} onPress={() => setGrams(String(v))}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: +grams === v ? brand : (theme?.surface?.sunken || '#f3f4f6'),
                    borderWidth: 1, borderColor: +grams === v ? brand : bord,
                  }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: +grams === v ? '#fff' : textS }}>{v}g</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Live macro preview */}
            {g > 0 && (
              <View style={{
                flexDirection: 'row', gap: 8, marginBottom: 24,
                backgroundColor: theme?.surface?.sunken || '#f9fafb',
                borderRadius: 14, padding: 14,
              }}>
                {[
                  { label: 'kcal', val: cal, bg: '#fff7ed', color: '#ea580c' },
                  { label: 'P',    val: `${pro}g`,  bg: '#eff6ff', color: '#2563eb' },
                  { label: 'C',    val: `${carb}g`, bg: '#fffbeb', color: '#d97706' },
                  { label: 'F',    val: `${fat}g`,  bg: '#fef2f2', color: '#dc2626' },
                ].map(m => (
                  <View key={m.label} style={{ flex: 1, backgroundColor: m.bg, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: m.color }}>{m.val}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: m.color, marginTop: 2 }}>{m.label}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              disabled={g <= 0}
              onPress={() => onAdd({ food, grams: g, cal, pro, carb, fat })}
              style={{
                backgroundColor: g > 0 ? brand : '#d1d5db', borderRadius: 14,
                padding: 16, alignItems: 'center', marginBottom: 8,
              }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Add to Today's Log</Text>
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Goals setup modal ─────────────────────────────────────────────────────────
function GoalsModal({ visible, current, member, onClose, onSave, theme }) {
  const GOAL_TYPES = [
    { key: 'weight_loss',  label: 'Weight Loss',   emoji: '🔥', desc: 'Calorie deficit based on your weight & height' },
    { key: 'muscle_gain',  label: 'Muscle Gain',   emoji: '💪', desc: 'Calorie surplus with high protein targets' },
    { key: 'maintain',     label: 'Maintain',      emoji: '⚖️', desc: 'Eat at your maintenance level' },
    { key: 'custom',       label: 'Custom',        emoji: '✏️', desc: 'Set your own targets manually' },
  ];

  const [step, setStep]         = useState(0); // 0=type, 1=activity(auto only), 2=review/custom
  const [goalType, setGoalType] = useState(current?.goalType || 'weight_loss');
  const [activity, setActivity] = useState('moderate');
  const [suggested, setSuggested] = useState(null);
  const [form, setForm]         = useState({
    calories: current?.calories || '',
    protein:  current?.protein  || '',
    carbs:    current?.carbs    || '',
    fat:      current?.fat      || '',
  });

  const brand = theme?.brand?.[600] || '#4f46e5';
  const brand50 = theme?.brand?.[50] || '#eef2ff';
  const bg    = theme?.surface?.raised || '#fff';
  const textP = theme?.text?.primary || '#111';
  const textS = theme?.text?.secondary || '#555';
  const bord  = theme?.border?.subtle || '#e5e7eb';

  const slideY = useRef(new Animated.Value(700)).current;
  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 160 }).start();
    } else {
      Animated.timing(slideY, { toValue: 700, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleNext = () => {
    if (goalType === 'custom') { setStep(2); return; }
    if (step === 0) { setStep(1); return; }
    // step 1: calculate suggestions
    const w = member?.weight || 70;
    const h = member?.height || 170;
    const af = ACTIVITY.find(a => a.key === activity)?.factor || 1.55;
    const g = calcGoals(goalType, w, h, af);
    setSuggested(g);
    setForm({ calories: String(g.calories), protein: String(g.protein), carbs: String(g.carbs), fat: String(g.fat) });
    setStep(2);
  };

  const handleSave = () => {
    const goals = {
      goalType,
      calories: +form.calories || 2000,
      protein:  +form.protein  || 150,
      carbs:    +form.carbs    || 200,
      fat:      +form.fat      || 65,
    };
    onSave(goals);
  };

  const canProceed = step === 0 ? !!goalType : step === 1 ? !!activity : (form.calories && form.protein);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '90%', transform: [{ translateY: slideY }],
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
      }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: bord, alignSelf: 'center', marginTop: 12 }} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingTop: 16 }}>
          {/* Step 0 — Goal type */}
          {step === 0 && (
            <>
              <Text style={{ fontSize: 20, fontWeight: '800', color: textP, marginBottom: 4 }}>Set Your Goal</Text>
              <Text style={{ fontSize: 13, color: textS, marginBottom: 20 }}>
                Choose a goal and we'll calculate targets based on your body data.
              </Text>
              {GOAL_TYPES.map(g => {
                const active = goalType === g.key;
                return (
                  <TouchableOpacity key={g.key} onPress={() => setGoalType(g.key)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      borderWidth: 2, borderRadius: 16,
                      borderColor: active ? brand : bord,
                      backgroundColor: active ? brand50 : (theme?.surface?.default || '#fafafa'),
                      padding: 16, marginBottom: 10,
                    }}>
                    <Text style={{ fontSize: 28 }}>{g.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: active ? brand : textP }}>{g.label}</Text>
                      <Text style={{ fontSize: 12, color: textS, marginTop: 2 }}>{g.desc}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={brand} />}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Step 1 — Activity level (auto goals only) */}
          {step === 1 && (
            <>
              <Text style={{ fontSize: 20, fontWeight: '800', color: textP, marginBottom: 4 }}>Activity Level</Text>
              <Text style={{ fontSize: 13, color: textS, marginBottom: 6 }}>
                Used to calculate your daily calorie needs.
              </Text>
              {(member?.weight && member?.height) ? (
                <Text style={{ fontSize: 12, color: brand, marginBottom: 16, fontWeight: '600' }}>
                  Based on: {member.weight}kg · {member.height}cm
                </Text>
              ) : (
                <Text style={{ fontSize: 12, color: '#f59e0b', marginBottom: 16, fontWeight: '600' }}>
                  ⚠ Weight/height not set in your profile — using defaults (70kg, 170cm)
                </Text>
              )}
              {ACTIVITY.map(a => {
                const active = activity === a.key;
                return (
                  <TouchableOpacity key={a.key} onPress={() => setActivity(a.key)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      borderWidth: 2, borderRadius: 16,
                      borderColor: active ? brand : bord,
                      backgroundColor: active ? brand50 : (theme?.surface?.default || '#fafafa'),
                      padding: 14, marginBottom: 10,
                    }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: active ? brand : textP }}>{a.label}</Text>
                      <Text style={{ fontSize: 12, color: textS, marginTop: 1 }}>{a.sub}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={brand} />}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Step 2 — Review / Custom input */}
          {step === 2 && (
            <>
              <Text style={{ fontSize: 20, fontWeight: '800', color: textP, marginBottom: 4 }}>
                {goalType === 'custom' ? 'Set Your Targets' : 'Suggested Targets'}
              </Text>
              {goalType !== 'custom' && suggested && (
                <Text style={{ fontSize: 13, color: textS, marginBottom: 16 }}>
                  Based on your body data and activity level. You can adjust these before saving.
                </Text>
              )}
              {goalType === 'custom' && (
                <Text style={{ fontSize: 13, color: textS, marginBottom: 16 }}>
                  Enter your daily macro targets.
                </Text>
              )}
              <View style={{ gap: 12, marginBottom: 20 }}>
                {[
                  { key: 'calories', label: 'Daily Calories', unit: 'kcal', color: '#f97316' },
                  { key: 'protein',  label: 'Protein',         unit: 'g',    color: '#3b82f6' },
                  { key: 'carbs',    label: 'Carbs',            unit: 'g',    color: '#f59e0b' },
                  { key: 'fat',      label: 'Fat',              unit: 'g',    color: '#ef4444' },
                ].map(({ key, label, unit, color }) => (
                  <View key={key} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    borderWidth: 1.5, borderColor: color + '60', borderRadius: 14,
                    padding: 14, backgroundColor: color + '08',
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: textS }}>{label}</Text>
                    </View>
                    <TextInput
                      style={{ fontSize: 22, fontWeight: '800', color, width: 80, textAlign: 'right' }}
                      keyboardType="numeric"
                      value={String(form[key])}
                      onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                    />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: textS, width: 32 }}>{unit}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Navigation buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {step > 0 && (
              <TouchableOpacity onPress={() => setStep(s => s - 1)}
                style={{ flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: bord }}>
                <Text style={{ fontWeight: '700', color: textS }}>Back</Text>
              </TouchableOpacity>
            )}
            {step < 2 ? (
              <TouchableOpacity onPress={handleNext} disabled={!canProceed}
                style={{ flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: canProceed ? brand : '#d1d5db' }}>
                <Text style={{ fontWeight: '800', color: '#fff' }}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleSave}
                style={{ flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: brand }}>
                <Text style={{ fontWeight: '800', color: '#fff' }}>Save Goals</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ height: 20 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Main NutritionScreen ──────────────────────────────────────────────────────
export default function NutritionScreen({ memberId }) {
  const { theme } = useTheme();
  const C = usePalette();

  const brand   = theme?.brand?.[600]    || '#4f46e5';
  const brand50 = theme?.brand?.[50]     || '#eef2ff';
  const bg      = theme?.surface?.raised || '#fafafa';
  const cardBg  = theme?.surface?.default || '#fff';
  const textP   = theme?.text?.primary   || '#111';
  const textS   = theme?.text?.secondary || '#555';
  const textT   = theme?.text?.tertiary  || '#888';
  const bord    = theme?.border?.subtle  || '#e5e7eb';

  // ── State ──────────────────────────────────────────────────────────────────
  const [foods, setFoods]           = useState([]);
  const [foodsLoading, setFoodsLoading] = useState(true);
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('All');
  const [member, setMember]         = useState(null);

  const [goals, setGoals]           = useState(null);
  const [goalsModal, setGoalsModal] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);

  const [logEntries, setLogEntries] = useState([]);
  const [logLoading, setLogLoading] = useState(true);

  const [selectedFood, setSelectedFood] = useState(null);
  const [qtyModal, setQtyModal]     = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);

  const dateKey = todayKey();

  // ── Load all foods from Firestore ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'nutritionFoods'), orderBy('name')),
      snap => { setFoods(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setFoodsLoading(false); },
      () => setFoodsLoading(false),
    );
    return unsub;
  }, []);

  // ── Load member profile (for weight/height in goals) ──────────────────────
  useEffect(() => {
    if (!memberId) return;
    getDoc(doc(db, 'members', memberId)).then(snap => {
      if (snap.exists()) setMember(snap.data());
    }).catch(() => {});
  }, [memberId]);

  // ── Load goals from member doc ─────────────────────────────────────────────
  useEffect(() => {
    if (!memberId) return;
    const unsub = onSnapshot(doc(db, 'members', memberId), snap => {
      if (snap.exists()) setGoals(snap.data().nutritionGoals || null);
    }, () => {});
    return unsub;
  }, [memberId]);

  // ── Load today's log ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!memberId) return;
    const unsub = onSnapshot(
      doc(db, 'members', memberId, 'nutritionLogs', dateKey),
      snap => { setLogEntries(snap.exists() ? (snap.data().entries || []) : []); setLogLoading(false); },
      () => setLogLoading(false),
    );
    return unsub;
  }, [memberId, dateKey]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => logEntries.reduce(
    (acc, e) => ({ cal: acc.cal + e.cal, pro: acc.pro + e.pro, carb: acc.carb + e.carb, fat: acc.fat + e.fat }),
    { cal: 0, pro: 0, carb: 0, fat: 0 },
  ), [logEntries]);

  // ── Filtered food search ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q && catFilter === 'All') return [];
    return foods.filter(f => {
      const matchCat = catFilter === 'All' || f.category === catFilter;
      const matchQ = !q || f.name?.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [foods, search, catFilter]);

  const categories = useMemo(() => ['All', ...new Set(foods.map(f => f.category).filter(Boolean).sort())], [foods]);

  // ── Save goals ─────────────────────────────────────────────────────────────
  const handleSaveGoals = useCallback(async (g) => {
    if (!memberId) return;
    setSavingGoals(true);
    try {
      await updateDoc(doc(db, 'members', memberId), { nutritionGoals: g });
      setGoalsModal(false);
    } catch {
      try { await setDoc(doc(db, 'members', memberId), { nutritionGoals: g }, { merge: true }); setGoalsModal(false); }
      catch (e) { console.warn('save goals error', e); }
    } finally { setSavingGoals(false); }
  }, [memberId]);

  // ── Add log entry ──────────────────────────────────────────────────────────
  const handleAddEntry = useCallback(async ({ food, grams, cal, pro, carb, fat }) => {
    if (!memberId) return;
    setAddingEntry(true);
    const entry = {
      foodId: food.id, name: food.name, emoji: food.emoji || '🍽️',
      grams, cal, pro, carb, fat, loggedAt: Date.now(),
    };
    const ref = doc(db, 'members', memberId, 'nutritionLogs', dateKey);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { entries: [...(snap.data().entries || []), entry] });
      } else {
        await setDoc(ref, { entries: [entry], date: dateKey });
      }
      setQtyModal(false);
      setSelectedFood(null);
      setSearch('');
    } catch (e) { console.warn('add entry error', e); }
    finally { setAddingEntry(false); }
  }, [memberId, dateKey]);

  // ── Remove log entry ───────────────────────────────────────────────────────
  const handleRemoveEntry = useCallback(async (idx) => {
    if (!memberId) return;
    const newEntries = logEntries.filter((_, i) => i !== idx);
    const ref = doc(db, 'members', memberId, 'nutritionLogs', dateKey);
    try { await updateDoc(ref, { entries: newEntries }); }
    catch (e) { console.warn('remove entry error', e); }
  }, [memberId, dateKey, logEntries]);

  const hasGoals = !!(goals?.calories);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* ── Header ── */}
      <View style={{ backgroundColor: brand, paddingTop: Platform.OS === 'android' ? 16 : 12, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>Nutrition</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
              {todayKey().split('-').reverse().join('/')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setGoalsModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Ionicons name="flag-outline" size={14} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
              {hasGoals ? 'Edit Goals' : 'Set Goals'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ── Daily summary ── */}
        <View style={{ margin: 16, borderRadius: 20, padding: 18, backgroundColor: cardBg, borderWidth: 1, borderColor: bord }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: textP }}>Today's Totals</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ backgroundColor: '#f97316' + '18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#f97316' }}>
                  {Math.round(totals.cal)} <Text style={{ fontSize: 10 }}>kcal</Text>
                </Text>
              </View>
            </View>
          </View>
          {!hasGoals ? (
            <TouchableOpacity onPress={() => setGoalsModal(true)}
              style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: brand }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: brand }}>Tap to set your daily goals</Text>
            </TouchableOpacity>
          ) : (
            <>
              <MacroBar label="Calories" value={Math.round(totals.cal)} goal={goals.calories} color="#f97316" unit=" kcal" />
              <MacroBar label="Protein"  value={+(totals.pro.toFixed(1))} goal={goals.protein}  color="#3b82f6" />
              <MacroBar label="Carbs"    value={+(totals.carb.toFixed(1))} goal={goals.carbs}   color="#f59e0b" />
              <MacroBar label="Fat"      value={+(totals.fat.toFixed(1))} goal={goals.fat}      color="#ef4444" />
            </>
          )}
        </View>

        {/* ── Search ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: textP, marginBottom: 10 }}>Add Food</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, borderRadius: 14, borderWidth: 1.5, borderColor: search ? brand : bord, paddingHorizontal: 14, marginBottom: 10 }}>
            <Ionicons name="search" size={18} color={textT} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: textP, paddingVertical: 12 }}
              placeholder="Search food to add…"
              placeholderTextColor={textT}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={textT} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {categories.map(c => {
              const active = catFilter === c;
              return (
                <TouchableOpacity key={c} onPress={() => setCatFilter(c)} activeOpacity={0.7}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: active ? brand : brand50, borderWidth: 1, borderColor: active ? brand : bord }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : textS }}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Search results ── */}
        {foodsLoading ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color={brand} />
          </View>
        ) : (search || catFilter !== 'All') ? (
          filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ fontSize: 13, color: textT }}>No foods found</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              {filtered.map(food => (
                <TouchableOpacity key={food.id} onPress={() => { setSelectedFood(food); setQtyModal(true); }}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: bord }}>
                  <Text style={{ fontSize: 32, marginRight: 12 }}>{food.emoji || '🍽️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: textP }}>{food.name}</Text>
                    <Text style={{ fontSize: 11, color: textT, marginTop: 1 }}>{food.servingLabel} · {food.servingGrams}g</Text>
                    <View style={{ flexDirection: 'row', gap: 5, marginTop: 5 }}>
                      {[
                        { label: `${food.caloriesPer100g} kcal`, bg: '#fff7ed', color: '#ea580c' },
                        { label: `P ${food.proteinPer100g}g`,    bg: '#eff6ff', color: '#2563eb' },
                        { label: `C ${food.carbsPer100g}g`,      bg: '#fffbeb', color: '#d97706' },
                        { label: `F ${food.fatPer100g}g`,        bg: '#fef2f2', color: '#dc2626' },
                      ].map(m => (
                        <View key={m.label} style={{ backgroundColor: m.bg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: m.color }}>{m.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={{ backgroundColor: brand, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 12, marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: textT }}>Type a food name or pick a category above</Text>
          </View>
        )}

        {/* ── Today's log ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: textP, marginBottom: 10 }}>
            Today's Log
            {logEntries.length > 0 && (
              <Text style={{ fontSize: 12, fontWeight: '500', color: textT }}> · {logEntries.length} item{logEntries.length !== 1 ? 's' : ''}</Text>
            )}
          </Text>

          {logLoading ? (
            <ActivityIndicator color={brand} />
          ) : logEntries.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: bord }}>
              <Text style={{ fontSize: 28 }}>🥗</Text>
              <Text style={{ fontSize: 13, color: textT, marginTop: 8 }}>No foods logged yet today</Text>
            </View>
          ) : (
            logEntries.map((entry, i) => (
              <View key={`${entry.foodId}-${entry.loggedAt}-${i}`}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: bord }}>
                <Text style={{ fontSize: 28, marginRight: 12 }}>{entry.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: textP }}>{entry.name}</Text>
                  <Text style={{ fontSize: 11, color: textT }}>{entry.grams}g</Text>
                  <View style={{ flexDirection: 'row', gap: 5, marginTop: 4 }}>
                    {[
                      { label: `${Math.round(entry.cal)} kcal`, color: '#ea580c' },
                      { label: `P ${entry.pro}g`,    color: '#2563eb' },
                      { label: `C ${entry.carb}g`,   color: '#d97706' },
                      { label: `F ${entry.fat}g`,    color: '#dc2626' },
                    ].map(m => (
                      <Text key={m.label} style={{ fontSize: 10, fontWeight: '700', color: m.color }}>{m.label}</Text>
                    ))}
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleRemoveEntry(i)} hitSlop={8}
                  style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={14} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Quantity modal ── */}
      <QuantityModal
        food={selectedFood}
        visible={qtyModal}
        onClose={() => { setQtyModal(false); setSelectedFood(null); }}
        onAdd={handleAddEntry}
        theme={theme}
      />

      {/* ── Goals modal ── */}
      <GoalsModal
        visible={goalsModal}
        current={goals}
        member={member}
        onClose={() => setGoalsModal(false)}
        onSave={handleSaveGoals}
        theme={theme}
      />
    </View>
  );
}
