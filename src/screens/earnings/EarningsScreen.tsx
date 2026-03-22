// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../../constants/theme';
// Lift Trainer App — TS-017 Trainer Earnings Dashboard
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { EarningsAPI } from '../../services/trainer.api';

import { EmptyState, SkeletonLoader, StatusBadge } from '../../components/common';
import { useAsync } from '../../hooks/useTrainer';
import { FeeDue, PaymentRecord, TrainerEarnings } from '../../types/trainer.types';
import { feeReminderMessage, formatDate, formatINR, paymentStatusColor, razorpayPayoutDate, whatsappURL } from '../../utils/trainer.utils';

import { getTrainerId } from '../../services/session';

export default function EarningsScreen() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tab, setTab] = useState<'overview' | 'dues' | 'history'>('overview');

  const fetchEarnings = useCallback(() => EarningsAPI.getEarnings(getTrainerId(), selectedMonth), [selectedMonth]);
  const fetchDues = useCallback(() => EarningsAPI.getFeeDues(getTrainerId()), []);
  const fetchHistory = useCallback(() => EarningsAPI.getPaymentHistory(getTrainerId(), 1).then(r => r.payments), []);

  const earningsAsync = useAsync<TrainerEarnings>(fetchEarnings);
  const duesAsync = useAsync<FeeDue[]>(fetchDues);
  const historyAsync = useAsync<PaymentRecord[]>(fetchHistory);

  const sendReminder = async (due: FeeDue) => {
    try {
      await EarningsAPI.sendReminder(getTrainerId(), due.clientId);
      const msg = feeReminderMessage(due.clientName, due.amountDue, due.paymentLink);
      Linking.openURL(whatsappURL(due.clientPhone, msg));
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const earnings = earningsAsync.data;
  const dues = duesAsync.data;
  const history = historyAsync.data;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Earnings</Text>
      </View>

      {/* Month selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
        {[-2, -1, 0].map(offset => {
          const d = new Date();
          d.setMonth(d.getMonth() + offset);
          const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
          return (
            <TouchableOpacity
              key={val}
              style={[styles.monthChip, selectedMonth === val && styles.monthChipActive]}
              onPress={() => setSelectedMonth(val)}
            >
              <Text style={[styles.monthChipText, selectedMonth === val && { color: C.white }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Summary tiles */}
      {earnings && (
        <View style={styles.summaryRow}>
          <SummaryTile label="Received" value={formatINR(earnings.totalReceived)} color="#16A34A" />
          <SummaryTile label="Pending" value={formatINR(earnings.pendingPayouts)} color="#D97706" />
          <SummaryTile label="This Year" value={formatINR(earnings.thisYearTotal)} color={C.primary} />
        </View>
      )}

      {/* Breakdown */}
      {earnings && (
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Gym Salary</Text>
            <Text style={styles.breakdownValue}>{formatINR(earnings.gymSalary)}</Text>
            {earnings.gymSalary === 0 && (
              <Text style={styles.gymNote}>Not yet recorded. Contact your gym admin.</Text>
            )}
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Freelance Fees</Text>
            <Text style={styles.breakdownValue}>{formatINR(earnings.freelanceFees)}</Text>
          </View>
        </View>
      )}

      {/* Simple bar chart */}
      {earnings?.monthlyTrend && earnings.monthlyTrend.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>6-Month Trend</Text>
          <View style={styles.bars}>
            {earnings.monthlyTrend.map((m, i) => {
              const maxTotal = Math.max(...earnings.monthlyTrend.map(x => x.total), 1);
              const gymH = (m.gymSalary / maxTotal) * 60;
              const freelanceH = (m.freelanceFees / maxTotal) * 60;
              return (
                <View key={i} style={styles.barGroup}>
                  <View style={styles.stackedBar}>
                    <View style={[styles.barSegment, { height: freelanceH, backgroundColor: '#7C3AED' }]} />
                    <View style={[styles.barSegment, { height: gymH, backgroundColor: C.primary }]} />
                  </View>
                  <Text style={styles.barLabel}>{m.month.slice(5)}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C.primary }]} /><Text style={styles.legendText}>Gym</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#7C3AED' }]} /><Text style={styles.legendText}>Freelance</Text></View>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['overview', 'dues', 'history'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'overview' ? 'Overview' : t === 'dues' ? `Dues${dues?.length ? ` (${dues.length})` : ''}` : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dues list */}
      {tab === 'dues' && (
        duesAsync.loading ? <SkeletonLoader height={80} style={{ margin: 16 }} /> :
        dues?.length === 0 ? (
          <EmptyState emoji="✅" title="No outstanding dues" subtitle="All freelance clients are up to date!" />
        ) : (
          <FlatList
            data={dues?.sort((a, b) => b.daysOverdue - a.daysOverdue)}
            keyExtractor={item => item.clientId}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View style={styles.dueCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dueName}>{item.clientName}</Text>
                  <Text style={styles.dueMeta}>{item.daysOverdue} days overdue</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.dueAmount}>{formatINR(item.amountDue)}</Text>
                  <TouchableOpacity style={styles.reminderBtn} onPress={() => sendReminder(item)}>
                    <Text style={styles.reminderBtnText}>📲 Remind</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )
      )}

      {/* History list */}
      {tab === 'history' && (
        historyAsync.loading ? <SkeletonLoader height={80} style={{ margin: 16 }} /> :
        history?.length === 0 ? (
          <EmptyState emoji="📄" title="No payment history" subtitle="Received payments will appear here." />
        ) : (
          <FlatList
            data={history}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View style={styles.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentClient}>{item.clientName}</Text>
                  <Text style={styles.paymentDesc}>{item.description}</Text>
                  <Text style={styles.paymentDate}>{formatDate(item.date)}</Text>
                  {item.status === 'Received' && item.payoutDate && (
                    <Text style={styles.payoutDate}>Payout: {razorpayPayoutDate(item.date)}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.paymentAmount}>{formatINR(item.amount)}</Text>
                  <StatusBadge label={item.status} color={paymentStatusColor(item.status)} />
                  {item.receiptUrl && (
                    <TouchableOpacity onPress={() => Linking.openURL(item.receiptUrl!)}>
                      <Text style={styles.receiptLink}>📥 Receipt</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />
        )
      )}
    </View>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.summaryTile, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, padding: 20, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.dark },
  monthScroll: { paddingHorizontal: 16, paddingVertical: 12, maxHeight: 52 },
  monthChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6', marginRight: 8 },
  monthChipActive: { backgroundColor: C.primary },
  monthChipText: { fontSize: 13, fontWeight: '600', color: C.mid },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  summaryTile: { flex: 1, backgroundColor: C.white, borderRadius: 10, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryLabel: { fontSize: 11, color: C.mid, marginTop: 2 },
  breakdownRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  breakdownItem: { flex: 1, backgroundColor: C.white, borderRadius: 10, padding: 14 },
  breakdownLabel: { fontSize: 12, color: C.mid },
  breakdownValue: { fontSize: 18, fontWeight: '700', color: C.dark, marginTop: 2 },
  gymNote: { fontSize: 10, color: C.red, marginTop: 4 },
  chartCard: { backgroundColor: C.white, marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 4 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },
  bars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 80 },
  barGroup: { flex: 1, alignItems: 'center', gap: 4 },
  stackedBar: { flexDirection: 'column-reverse', alignItems: 'center', width: 24 },
  barSegment: { width: 20, borderRadius: 3 },
  barLabel: { fontSize: 10, color: C.mid },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: C.mid },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: C.mid },
  tabTextActive: { color: C.white },
  dueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  dueName: { fontSize: 15, fontWeight: '600', color: C.dark },
  dueMeta: { fontSize: 12, color: C.red, marginTop: 2 },
  dueAmount: { fontSize: 17, fontWeight: '700', color: C.dark },
  reminderBtn: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  reminderBtnText: { color: C.green, fontSize: 12, fontWeight: '600' },
  paymentRow: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  paymentClient: { fontSize: 14, fontWeight: '600', color: C.dark },
  paymentDesc: { fontSize: 12, color: C.mid },
  paymentDate: { fontSize: 11, color: C.light },
  payoutDate: { fontSize: 11, color: C.primary, marginTop: 2 },
  paymentAmount: { fontSize: 16, fontWeight: '700', color: C.dark },
  receiptLink: { fontSize: 12, color: C.primary, fontWeight: '600' },
});
