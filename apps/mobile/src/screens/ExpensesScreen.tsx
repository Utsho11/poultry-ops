import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { DatePickerInput } from '../components/DatePickerInput';

const CATEGORIES = ['medicine', 'labor', 'utility', 'equipment', 'other'];
const HEALTH_TYPES = ['vaccination', 'checkup', 'injection', 'treatment'];

const categoryColor: Record<string, string> = {
  medicine: colors.blue,
  labor: colors.amber,
  utility: colors.purple,
  equipment: '#14b8a6',
  other: colors.textMuted,
};

export const ExpensesScreen: React.FC = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'expenses' | 'health'>('expenses');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const canManage = user?.role === 'owner' || user?.role === 'manager';

  // Expense form
  const [expModal, setExpModal] = useState(false);
  const [expBatchId, setExpBatchId] = useState('');
  const [expCategory, setExpCategory] = useState('medicine');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expNote, setExpNote] = useState('');
  const [expSubmitting, setExpSubmitting] = useState(false);

  // Health form
  const [healthModal, setHealthModal] = useState(false);
  const [healthBatchId, setHealthBatchId] = useState('');
  const [healthDate, setHealthDate] = useState(new Date().toISOString().split('T')[0]);
  const [healthType, setHealthType] = useState('vaccination');
  const [healthDesc, setHealthDesc] = useState('');
  const [healthMedicine, setHealthMedicine] = useState('');
  const [healthVet, setHealthVet] = useState('');
  const [healthSubmitting, setHealthSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [expData, healthData, batchData] = await Promise.all([
        apiFetch('/expenses', {}, token),
        apiFetch('/health-records', {}, token),
        apiFetch('/batches', {}, token),
      ]);
      setExpenses(expData);
      setHealth(healthData);
      setBatches(batchData);
      if (batchData.length > 0) {
        if (!expBatchId) setExpBatchId(batchData[0]._id);
        if (!healthBatchId) setHealthBatchId(batchData[0]._id);
      }
    } catch (e) {}
    finally { setRefreshing(false); }
  }, [token, expBatchId, healthBatchId]);

  useEffect(() => { load(); }, [load]);

  const handleCreateExpense = async () => {
    if (!expBatchId) { showAlert('Error', 'Please select a target Flock / Batch.'); return; }
    if (!expAmount) { showAlert('Error', 'Amount is required'); return; }
    if (!expDate) { showAlert('Error', 'Date is required (YYYY-MM-DD)'); return; }

    setExpSubmitting(true);
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          batchId: expBatchId,
          category: expCategory,
          amount: Number(expAmount),
          currency: 'BDT',
          date: expDate,
          note: expNote
        })
      }, token);
      setExpModal(false);
      setExpAmount('');
      setExpNote('');
      load();
    } catch (err: any) { showAlert('Error', err.message); }
    finally { setExpSubmitting(false); }
  };

  const handleCreateHealth = async () => {
    if (!healthBatchId) { showAlert('Error', 'Please select a target Flock / Batch.'); return; }
    if (!healthDesc || !healthVet) { showAlert('Error', 'Description and vet name required'); return; }
    if (!healthDate) { showAlert('Error', 'Date is required (YYYY-MM-DD)'); return; }

    setHealthSubmitting(true);
    try {
      await apiFetch('/health-records', {
        method: 'POST',
        body: JSON.stringify({
          batchId: healthBatchId,
          date: healthDate,
          type: healthType,
          description: healthDesc,
          medicineUsed: healthMedicine,
          performedBy: healthVet
        })
      }, token);
      setHealthModal(false);
      setHealthDesc('');
      setHealthMedicine('');
      setHealthVet('');
      load();
    } catch (err: any) { showAlert('Error', err.message); }
    finally { setHealthSubmitting(false); }
  };

  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <View style={common.screen}>
      {/* Tabs */}
      <View style={s.tabBar}>
        {(['expenses', 'health'] as const).map(tab => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'expenses' ? '💰 Expenses' : '🏥 Health Records'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {activeTab === 'expenses' ? (
          <>
            <View style={[common.row, { marginBottom: 16 }]}>
              <View>
                <Text style={common.sectionTitle}>Batch Expenses</Text>
                <Text style={common.sectionSubtitle}>Total: ৳{totalExpenses.toLocaleString()}</Text>
              </View>
              {canManage && (
                <TouchableOpacity style={s.addBtn} onPress={() => setExpModal(true)}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {expenses.length === 0
              ? <Text style={common.emptyText}>No expenses recorded yet.</Text>
              : expenses.map(exp => {
                const bObj = batches.find(b => b._id === exp.batchId);
                return (
                  <View key={exp._id} style={common.card}>
                    <View style={common.row}>
                      <View style={[s.catBadge, { backgroundColor: `${categoryColor[exp.category]}20` }]}>
                        <Text style={{ color: categoryColor[exp.category], fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{exp.category}</Text>
                      </View>
                      <Text style={{ color: colors.brand, fontSize: 17, fontWeight: '800' }}>৳{exp.amount.toLocaleString()}</Text>
                    </View>
                    <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '700', marginTop: 4 }}>🐔 Flock: {bObj ? bObj.name : 'All Flocks'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>📅 {exp.date} {exp.note ? `• ${exp.note}` : ''}</Text>
                  </View>
                );
              })
            }
          </>
        ) : (
          <>
            <View style={[common.row, { marginBottom: 16 }]}>
              <View>
                <Text style={common.sectionTitle}>Health Records</Text>
                <Text style={common.sectionSubtitle}>{health.length} records</Text>
              </View>
              <TouchableOpacity style={s.addBtn} onPress={() => setHealthModal(true)}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {health.length === 0
              ? <Text style={common.emptyText}>No health records yet.</Text>
              : health.map(hr => {
                const bObj = batches.find(b => b._id === hr.batchId);
                return (
                  <View key={hr._id} style={common.card}>
                    <View style={common.row}>
                      <View style={[s.catBadge, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                        <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{hr.type}</Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>📅 {hr.date}</Text>
                    </View>
                    <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '700', marginTop: 4 }}>🐔 Flock: {bObj ? bObj.name : '—'}</Text>
                    <Text style={{ color: colors.textMain, fontWeight: '600', marginTop: 6 }}>{hr.description}</Text>
                    {hr.medicineUsed && <Text style={{ color: colors.blue, fontSize: 12, marginTop: 4 }}>💊 {hr.medicineUsed}</Text>}
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>👨‍⚕️ {hr.performedBy}</Text>
                  </View>
                );
              })
            }
          </>
        )}
      </ScrollView>

      {/* Expense Modal */}
      <Modal visible={expModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Add Batch Expense</Text>
            
            <Text style={common.label}>Select Flock / Batch *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {batches.map(b => (
                <TouchableOpacity key={b._id} onPress={() => setExpBatchId(b._id)}
                  style={[s.catChip, expBatchId === b._id && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                  <Text style={{ color: expBatchId === b._id ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '600' }}>🐔 {b.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <DatePickerInput
              label="Expense Date *"
              value={expDate}
              onChange={setExpDate}
              style={{ marginBottom: 14 }}
            />

            <Text style={common.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} onPress={() => setExpCategory(cat)}
                  style={[s.catChip, expCategory === cat && { backgroundColor: categoryColor[cat] || colors.brand, borderColor: categoryColor[cat] || colors.brand }]}>
                  <Text style={{ color: expCategory === cat ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={common.label}>Amount (BDT ৳) *</Text>
            <TextInput style={common.input} keyboardType="numeric" placeholder="5000" placeholderTextColor="#64748b" value={expAmount} onChangeText={setExpAmount} />

            <Text style={common.label}>Note</Text>
            <TextInput style={common.input} placeholder="Receipt or vendor details..." placeholderTextColor="#64748b" value={expNote} onChangeText={setExpNote} />

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setExpModal(false)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleCreateExpense} disabled={expSubmitting}>
                {expSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Health Modal */}
      <Modal visible={healthModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Add Health Record</Text>
            
            <Text style={common.label}>Select Flock / Batch *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {batches.map(b => (
                <TouchableOpacity key={b._id} onPress={() => setHealthBatchId(b._id)}
                  style={[s.catChip, healthBatchId === b._id && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                  <Text style={{ color: healthBatchId === b._id ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '600' }}>🐔 {b.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <DatePickerInput
              label="Record Date *"
              value={healthDate}
              onChange={setHealthDate}
              style={{ marginBottom: 14 }}
            />

            <Text style={common.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {HEALTH_TYPES.map(t => (
                <TouchableOpacity key={t} onPress={() => setHealthType(t)}
                  style={[s.catChip, healthType === t && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                  <Text style={{ color: healthType === t ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={common.label}>Description *</Text>
            <TextInput style={common.input} placeholder="e.g. Gumboro Vaccine 1st Dose" placeholderTextColor="#64748b" value={healthDesc} onChangeText={setHealthDesc} />

            <Text style={common.label}>Medicine Used</Text>
            <TextInput style={common.input} placeholder="Vaccine/Medicine Name" placeholderTextColor="#64748b" value={healthMedicine} onChangeText={setHealthMedicine} />

            <Text style={common.label}>Performed By (Vet/Staff) *</Text>
            <TextInput style={common.input} placeholder="Dr. Rahat / Staff Name" placeholderTextColor="#64748b" value={healthVet} onChangeText={setHealthVet} />

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setHealthModal(false)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleCreateHealth} disabled={healthSubmitting}>
                {healthSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: colors.brand },
  addBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
});
