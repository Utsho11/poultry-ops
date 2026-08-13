import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, RefreshControl, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config';
import { colors, common, STATUS_BAR_PADDING } from '../styles';
import { formatEggCount } from '../utils/crates';
import { ISale, ICustomer, IBatch, IPayment } from '@poultry-ops/types';
import { DatePickerInput } from '../components/DatePickerInput';
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
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

  // New Sale Form
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [itemType, setItemType] = useState<'egg' | 'chicken'>('egg');
  const [cratesInput, setCratesInput] = useState('10');
  const [looseEggsInput, setLooseEggsInput] = useState('0');
  const [birdCountInput, setBirdCountInput] = useState('50');
  const [weightKgInput, setWeightKgInput] = useState('85');
  const [unit, setUnit] = useState<'piece' | 'tray' | 'kg' | 'bird'>('tray');
  const [unitPrice, setUnitPrice] = useState('360');
  const [amountPaid, setAmountPaid] = useState('0');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);

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
      if (bData.length > 0 && !selectedBatchId) {
        setSelectedBatchId(bData[0]._id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, selectedBatchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Calculations for new sale form
  const crates = parseFloat(cratesInput) || 0;
  const loose = parseFloat(looseEggsInput) || 0;
  const birds = parseFloat(birdCountInput) || 0;
  const weight = parseFloat(weightKgInput) || 0;
  const price = parseFloat(unitPrice) || 0;

  let totalInvoice = 0;
  let actualQty = 0;

  if (itemType === 'egg') {
    actualQty = (crates * 30) + loose;
    if (unit === 'tray') {
      const totalTrays = crates + (loose / 30);
      totalInvoice = Number((totalTrays * price).toFixed(2));
    } else {
      totalInvoice = Number((actualQty * price).toFixed(2));
    }
  } else {
    actualQty = birds;
    if (unit === 'kg' && weight > 0) {
      totalInvoice = Number((weight * price).toFixed(2));
    } else {
      totalInvoice = Number((birds * price).toFixed(2));
    }
  }

  const paidAmt = parseFloat(amountPaid) || 0;
  const dueAmt = Math.max(0, Number((totalInvoice - paidAmt).toFixed(2)));

  const handleCreateCustomer = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      Alert.alert('Validation Error', 'Customer Name and Phone Number are required.');
      return;
    }

    try {
      const newCust = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: customerName.trim(),
          phone: customerPhone.trim()
        })
      }, token);

      setCustomers(prev => [...prev, newCust]);
      setSelectedCustomerId(newCust._id);
      setNewCustomerModalOpen(false);
      Alert.alert('Success', `Customer ${newCust.name} added!`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create customer');
    }
  };

  const handleCreateSale = async () => {
    if (!selectedBatchId) {
      Alert.alert('Validation Error', 'Please select a target Flock / Batch.');
      return;
    }
    if (totalInvoice <= 0) {
      Alert.alert('Validation Error', 'Please enter valid quantities and unit price.');
      return;
    }
    if (!saleDate) {
      Alert.alert('Validation Error', 'Please enter a valid sale date (YYYY-MM-DD).');
      return;
    }

    try {
      await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId || undefined,
          customerId: selectedCustomerId || undefined,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          items: [{
            type: itemType,
            quantity: actualQty,
            crates: itemType === 'egg' ? crates : undefined,
            looseEggs: itemType === 'egg' ? loose : undefined,
            birdCount: itemType === 'chicken' ? birds : undefined,
            weightKg: itemType === 'chicken' ? weight : undefined,
            unit,
            unitPrice: price
          }],
          date: saleDate,
          amountPaid: paidAmt
        })
      }, token);

      setNewSaleModalOpen(false);
      loadData();
      Alert.alert('Success', 'Sale invoice recorded successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record sale');
    }
  };

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

              {!isWorker && (
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

      {/* NEW SALE MODAL */}
      <Modal visible={newSaleModalOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <ShoppingCart size={18} color={colors.textMain} />
              <Text style={[s.modalTitle, { marginBottom: 0 }]}>Record New Sale Invoice</Text>
            </View>
            <ScrollView>
              {/* Sale Date Input (TOP) */}
              <DatePickerInput
                label="Sale Date *"
                value={saleDate}
                onChange={setSaleDate}
                style={{ marginBottom: 14 }}
              />

              {/* Batch Selector (Required) */}
              <Text style={s.inputLabel}>Select Flock / Batch *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {batches.map(b => (
                  <TouchableOpacity
                    key={b._id}
                    style={[s.custChip, selectedBatchId === b._id && s.custChipActive]}
                    onPress={() => setSelectedBatchId(b._id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Bird size={14} color={selectedBatchId === b._id ? '#FFFFFF' : colors.textMain} />
                      <Text style={[s.chipText, selectedBatchId === b._id && { color: '#FFFFFF' }]}>
                        {b.name} ({b.breed})
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Customer Selector */}
              <Text style={s.inputLabel}>Select Customer</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <TouchableOpacity
                  style={[s.custChip, !selectedCustomerId && s.custChipActive]}
                  onPress={() => { setSelectedCustomerId(''); setCustomerName(''); setCustomerPhone(''); }}
                >
                  <Text style={s.chipText}>Walk-in Customer</Text>
                </TouchableOpacity>
                {customers.map(c => (
                  <TouchableOpacity
                    key={c._id}
                    style={[s.custChip, selectedCustomerId === c._id && s.custChipActive]}
                    onPress={() => {
                      setSelectedCustomerId(c._id);
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone);
                    }}
                  >
                    <Text style={s.chipText}>{c.name} ({c.phone})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {!selectedCustomerId && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Customer Name"
                    placeholderTextColor={colors.textMuted}
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Phone (Required)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                  />
                </View>
              )}

              {/* Item Type Selector */}
              {activeFarm?.animalType === 'layer' ? (
                <>
                  <Text style={s.inputLabel}>Item Category</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[s.typeChip, itemType === 'egg' && s.typeChipActive]}
                      onPress={() => { setItemType('egg'); setUnit('tray'); }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Egg size={14} color={itemType === 'egg' ? colors.secondary : colors.textMuted} />
                        <Text style={s.chipText}>Layer Eggs</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.typeChip, itemType === 'chicken' && s.typeChipActive]}
                      onPress={() => { setItemType('chicken'); setUnit('kg'); }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Bird size={14} color={itemType === 'chicken' ? colors.brand : colors.textMuted} />
                        <Text style={s.chipText}>Poultry / Birds</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {/* DYNAMIC FORM FIELDS DEPENDING ON CATEGORY */}
              {itemType === 'egg' ? (
                <View style={{ gap: 10, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>Crates (30 eggs/crate)</Text>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={cratesInput}
                        onChangeText={setCratesInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>Loose Eggs</Text>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={looseEggsInput}
                        onChangeText={setLooseEggsInput}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>Pricing Unit</Text>
                      <TouchableOpacity
                        style={[s.input, { justifyContent: 'center' }]}
                        onPress={() => setUnit(unit === 'tray' ? 'piece' : 'tray')}
                      >
                        <Text style={{ fontWeight: '700', color: colors.textMain }}>
                          {unit === 'tray' ? 'Per Crate ৳' : 'Per Piece ৳'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>Unit Price ৳</Text>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={unitPrice}
                        onChangeText={setUnitPrice}
                      />
                    </View>
                  </View>

                  <View style={{ backgroundColor: 'rgba(74, 124, 89, 0.12)', padding: 8, borderRadius: 6 }}>
                    <Text style={{ color: colors.secondary, fontWeight: '800', fontSize: 11 }}>
                      Total Eggs: {actualQty} eggs ({crates} Crates + {loose} Loose)
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 10, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>Bird Count (Birds)</Text>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={birdCountInput}
                        onChangeText={setBirdCountInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>Total Weight (kg)</Text>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={weightKgInput}
                        onChangeText={setWeightKgInput}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>Pricing Unit</Text>
                      <TouchableOpacity
                        style={[s.input, { justifyContent: 'center' }]}
                        onPress={() => setUnit(unit === 'kg' ? 'bird' : 'kg')}
                      >
                        <Text style={{ fontWeight: '700', color: colors.textMain }}>
                          {unit === 'kg' ? 'Per kg ৳' : 'Per Bird ৳'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>Unit Price ৳</Text>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={unitPrice}
                        onChangeText={setUnitPrice}
                      />
                    </View>
                  </View>

                  <View style={{ backgroundColor: 'rgba(61, 107, 140, 0.12)', padding: 8, borderRadius: 6 }}>
                    <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 11 }}>
                      Total Poultry: {birds} birds ({weight} kg)
                    </Text>
                  </View>
                </View>
              )}

              {/* Money Breakdown */}
              <View style={{ backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 8, marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textMain }}>
                  Total Invoice: ৳{totalInvoice.toLocaleString()}
                </Text>

                <Text style={[s.inputLabel, { marginTop: 8 }]}>Amount Paid Now ৳</Text>
                <TextInput
                  style={s.input}
                  keyboardType="numeric"
                  value={amountPaid}
                  onChangeText={setAmountPaid}
                />

                <Text style={{ fontSize: 13, fontWeight: '800', color: dueAmt > 0 ? colors.rose : colors.secondary, marginTop: 6 }}>
                  Remaining Due: ৳{dueAmt.toLocaleString()}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setNewSaleModalOpen(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.submitBtn} onPress={handleCreateSale}>
                  <Text style={s.submitText}>Save Sale</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
