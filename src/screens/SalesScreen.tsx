import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, RefreshControl, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config';
import { colors, common, STATUS_BAR_PADDING } from '../styles';
import { formatEggCount } from '../utils/crates';
import { ISale, ICustomer, IBatch, IPayment } from '../types';
import { RecordSaleModal } from '../components/RecordSaleModal';
import { Tag, Plus, Phone, Egg, Bird, DollarSign, Trash2, Users, CreditCard, ShoppingBag, Calendar, ShoppingCart } from 'lucide-react-native';

export const SalesScreen: React.FC<any> = ({ navigation }) => {
  const { token, user, activeFarm } = useAuth();
  const isWorker = user?.role === 'worker';

  const [activeTab, setActiveTab] = useState<'sales' | 'customers' | 'payments'>('sales');
  const [sales, setSales] = useState<ISale[]>([]);
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [payments, setPayments] = useState<IPayment[]>([]);
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [newSaleModalOpen, setNewSaleModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Payment Form
  const [targetCustomer, setTargetCustomer] = useState<ICustomer | null>(null);
  const [paymentAmt, setPaymentAmt] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'bank' | 'other'>('cash');

  const loadData = useCallback(async () => {
    try {
      const [sData, cData, pData, bData] = await Promise.all([
        apiFetch('/sales', {}, token),
        apiFetch('/customers', {}, token),
        apiFetch('/payments', {}, token),
        apiFetch('/batches', {}, token)
      ]);
      setSales(sData);
      setCustomers(cData);
      setPayments(pData);
      setBatches(bData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, activeFarm?._id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleRecordPayment = async () => {
    if (!targetCustomer) return;
    const amt = parseFloat(paymentAmt);
    if (!amt || amt <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    try {
      await apiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: targetCustomer._id,
          amount: amt,
          date: new Date().toISOString().split('T')[0],
          method: paymentMethod
        })
      }, token);

      setPaymentModalOpen(false);
      loadData();
      Alert.alert('Success', `Payment of ৳${amt} recorded for ${targetCustomer.name}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payment');
    }
  };

  const totalDues = customers.reduce((sum, c) => sum + (c.totalDue || 0), 0);

  if (loading) return (
    <View style={[common.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={{ color: colors.textMuted, marginTop: 10 }}>Loading Sales Ledger...</Text>
    </View>
  );

  return (
    <View style={common.screen}>
      {/* Top Banner Header */}
      <View style={s.topHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Tag size={18} color={colors.brand} />
            <Text style={s.headerTitle}>Sales & Customer Dues</Text>
          </View>
          <Text style={s.headerSub}>Total Outstanding Due: ৳{totalDues.toLocaleString()}</Text>
        </View>
        {!isWorker && (
          <TouchableOpacity style={s.addBtn} onPress={() => setNewSaleModalOpen(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Plus size={14} color="#fff" />
              <Text style={s.addBtnText}>New Sale</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, activeTab === 'sales' && s.tabActive]} onPress={() => setActiveTab('sales')}>
          <Text style={[s.tabText, activeTab === 'sales' && s.tabTextActive]}>Sales Ledger ({sales.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'customers' && s.tabActive]} onPress={() => setActiveTab('customers')}>
          <Text style={[s.tabText, activeTab === 'customers' && s.tabTextActive]}>Customers ({customers.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'payments' && s.tabActive]} onPress={() => setActiveTab('payments')}>
          <Text style={[s.tabText, activeTab === 'payments' && s.tabTextActive]}>Payments ({payments.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {activeTab === 'sales' && (
          sales.map(sale => (
            <View key={sale._id} style={s.card}>
              <View style={common.row}>
                <View>
                  <Text style={s.customerName}>{sale.customerName || 'Walk-in Customer'}</Text>
                  {sale.customerPhone ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Phone size={12} color={colors.textMuted} />
                      <Text style={s.phoneText}>{sale.customerPhone}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[
                  s.statusBadge,
                  sale.status === 'paid' ? { backgroundColor: 'rgba(74, 124, 89, 0.15)' } :
                  sale.status === 'partial' ? { backgroundColor: 'rgba(217, 164, 65, 0.15)' } : { backgroundColor: 'rgba(178, 58, 47, 0.15)' }
                ]}>
                  <Text style={[
                    s.statusText,
                    sale.status === 'paid' ? { color: colors.secondary } :
                    sale.status === 'partial' ? { color: colors.amber } : { color: colors.rose }
                  ]}>
                    {sale.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={{ marginVertical: 8, padding: 8, backgroundColor: colors.surfaceElevated, borderRadius: 6 }}>
                {sale.items && sale.items.length > 0 ? (
                  sale.items.map((item, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 }}>
                      {item.type === 'egg' ? <Egg size={13} color={colors.brand} /> : <Bird size={13} color={colors.brand} />}
                      <Text style={s.itemText}>
                        {item.type === 'egg' ? formatEggCount(item.quantity) : `${item.quantity} birds`} @ ৳{item.unitPrice} = ৳{item.subtotal}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {sale.itemType === 'egg' ? <Egg size={13} color={colors.brand} /> : <Bird size={13} color={colors.brand} />}
                    <Text style={s.itemText}>
                      {sale.quantity} @ ৳{sale.unitPrice} = ৳{sale.totalAmount}
                    </Text>
                  </View>
                )}
              </View>

              <View style={s.dashRow}>
                <Text style={s.label}>Total: <Text style={s.val}>৳{sale.totalAmount}</Text></Text>
                <Text style={s.label}>Paid: <Text style={[s.val, { color: colors.secondary }]}>৳{sale.amountPaid}</Text></Text>
                <Text style={s.label}>Due: <Text style={[s.val, { color: sale.amountDue > 0 ? colors.rose : colors.textMain }]}>৳{sale.amountDue}</Text></Text>
              </View>

              {user?.role === 'owner' && (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert("Confirm Delete Sale Invoice", "Deleting this sale invoice will restore flock stock and recalculate customer dues. Proceed?", [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete Invoice",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await apiFetch(`/sales/${sale._id}`, { method: "DELETE" }, token);
                              Alert.alert("Success", "Sale invoice deleted and dues updated");
                              loadData();
                            } catch (err: any) {
                              Alert.alert("Error", err.message);
                            }
                          },
                        },
                      ]);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Trash2 size={12} color="#DC2626" />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>Delete Invoice</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

        {activeTab === 'customers' && (
          customers.map(c => (
            <View key={c._id} style={[s.card, c.totalDue > 0 && { borderColor: colors.rose }]}>
              <View style={common.row}>
                <View>
                  <Text style={s.customerName}>{c.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Phone size={11} color={colors.textMuted} />
                    <Text style={[s.phoneText, { marginTop: 0 }]}>{c.phone}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Current Due</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: c.totalDue > 0 ? colors.rose : colors.secondary }}>
                    ৳{c.totalDue.toLocaleString()}
                  </Text>
                </View>
              </View>

              {c.totalDue > 0 && !isWorker && (
                <TouchableOpacity
                  style={[s.settleBtn, { marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}
                  onPress={() => {
                    setTargetCustomer(c);
                    setPaymentAmt(String(c.totalDue));
                    setPaymentModalOpen(true);
                  }}
                >
                  <CreditCard size={14} color="#FFFFFF" />
                  <Text style={s.settleBtnText}>Record Due Payment Settlement</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {activeTab === 'payments' && (
          payments.map(p => (
            <View key={p._id} style={s.card}>
              <View style={common.row}>
                <View>
                  <Text style={s.customerName}>{p.customerName || 'Customer'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Calendar size={11} color={colors.textMuted} />
                    <Text style={[s.phoneText, { marginTop: 0 }]}>{p.date} | {(p.method || 'CASH').toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.secondary }}>
                  +৳{p.amount.toLocaleString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* REUSABLE RECORD SALE MODAL */}
      <RecordSaleModal
        visible={newSaleModalOpen}
        onClose={() => setNewSaleModalOpen(false)}
        onSuccess={loadData}
        batches={batches}
      />

      {/* PAYMENT SETTLEMENT MODAL */}
      {paymentModalOpen && targetCustomer && (
        <Modal visible={paymentModalOpen} animationType="slide" transparent>
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <CreditCard size={18} color={colors.textMain} />
                <Text style={[s.modalTitle, { marginBottom: 0 }]}>Settle Due Payment</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                  Customer: {targetCustomer.name} -
                </Text>
                <Phone size={11} color={colors.textMuted} />
                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                  {targetCustomer.phone}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.rose, marginBottom: 14 }}>
                Current Outstanding Due: ৳{targetCustomer.totalDue.toLocaleString()}
              </Text>

              <Text style={s.inputLabel}>Payment Amount (৳)</Text>
              <TextInput
                style={[s.input, { marginBottom: 14 }]}
                keyboardType="numeric"
                value={paymentAmt}
                onChangeText={setPaymentAmt}
              />

              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setPaymentModalOpen(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.submitBtn} onPress={handleRecordPayment}>
                  <Text style={s.submitText}>Submit Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: STATUS_BAR_PADDING, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  headerTitle: { fontSize: 16, fontWeight: '900', color: colors.textMain },
  headerSub: { fontSize: 11, fontWeight: '700', color: colors.rose, marginTop: 2 },
  addBtn: { backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderColor: colors.brand },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brand, fontWeight: '800' },
  card: { backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  customerName: { fontSize: 14, fontWeight: '800', color: colors.textMain },
  phoneText: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  itemText: { fontSize: 12, fontWeight: '700', color: colors.textMain },
  dashRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label: { fontSize: 11, color: colors.textMuted },
  val: { fontSize: 12, fontWeight: '800', color: colors.textMain },
  settleBtn: { backgroundColor: colors.brand, padding: 10, borderRadius: 8, alignItems: 'center' },
  settleBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: colors.surface, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textMain, marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, color: colors.textMain },
  custChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.surfaceElevated, marginRight: 6, borderWidth: 1, borderColor: colors.border },
  custChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeChip: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: colors.surfaceElevated, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textMain },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surfaceElevated },
  cancelText: { color: colors.textMuted, fontWeight: '700' },
  submitBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.brand },
  submitText: { color: '#FFFFFF', fontWeight: '800' }
});
