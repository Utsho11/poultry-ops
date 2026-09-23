import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { formatEggCount } from '../utils/crates';
import { DatePickerInput } from './DatePickerInput';
import { ShoppingCart, Bird, Egg, X, Check, DollarSign } from 'lucide-react-native';

export interface RecordSaleModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  batchId?: string;
  batches?: any[];
}

export const RecordSaleModal: React.FC<RecordSaleModalProps> = ({
  visible,
  onClose,
  onSuccess,
  batchId: propBatchId,
  batches: propBatches,
}) => {
  const { token, activeFarm } = useAuth();

  const isLayerFarm = activeFarm?.animalType === 'layer';

  // Data sources
  const [batches, setBatches] = useState<any[]>(propBatches || []);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Form State
  const [selectedBatchId, setSelectedBatchId] = useState<string>(propBatchId || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);

  // Item category
  const [itemType, setItemType] = useState<'egg' | 'chicken'>(isLayerFarm ? 'egg' : 'chicken');

  // Egg fields
  const [cratesInput, setCratesInput] = useState('0');
  const [looseEggsInput, setLooseEggsInput] = useState('0');
  const [eggUnit, setEggUnit] = useState<'tray' | 'piece'>('tray');

  // Chicken fields
  const [birdCountInput, setBirdCountInput] = useState('');
  const [weightKgInput, setWeightKgInput] = useState('');
  const [chickenUnit, setChickenUnit] = useState<'kg' | 'bird'>('kg');

  // Price & Payment
  const [unitPrice, setUnitPrice] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load batches and customers on open
  useEffect(() => {
    if (visible) {
      setSaleDate(new Date().toISOString().split('T')[0]);
      setSelectedBatchId(propBatchId || '');
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setItemType(isLayerFarm ? 'egg' : 'chicken');
      setCratesInput('0');
      setLooseEggsInput('0');
      setEggUnit('tray');
      setBirdCountInput('');
      setWeightKgInput('');
      setChickenUnit('kg');
      setUnitPrice('');
      setAmountPaid('');

      setLoadingInitial(true);
      Promise.all([
        !propBatches || propBatches.length === 0
          ? apiFetch('/batches?status=active', {}, token)
          : Promise.resolve(propBatches),
        apiFetch('/customers', {}, token).catch(() => []),
      ])
        .then(([batchList, custList]) => {
          if (Array.isArray(batchList)) {
            setBatches(batchList);
            if (!propBatchId && batchList.length > 0) {
              setSelectedBatchId(batchList[0]._id);
            }
          }
          if (Array.isArray(custList)) {
            setCustomers(custList);
          }
        })
        .finally(() => setLoadingInitial(false));
    }
  }, [visible, propBatchId, propBatches, isLayerFarm, token]);

  // Egg calculation
  const crates = Math.max(0, parseInt(cratesInput, 10) || 0);
  const loose = Math.max(0, parseInt(looseEggsInput, 10) || 0);
  const totalEggs = crates * 30 + loose;

  // Chicken calculation
  const birds = Math.max(0, parseInt(birdCountInput, 10) || 0);
  const weight = Math.max(0, parseFloat(weightKgInput) || 0);

  // Unit price
  const price = Math.max(0, parseFloat(unitPrice) || 0);

  // Total invoice calculation
  const totalInvoice = useMemo(() => {
    if (itemType === 'egg') {
      if (eggUnit === 'tray') {
        return Math.round((totalEggs / 30) * price);
      }
      return Math.round(totalEggs * price);
    } else {
      if (chickenUnit === 'kg') {
        return Math.round(weight * price);
      }
      return Math.round(birds * price);
    }
  }, [itemType, eggUnit, chickenUnit, totalEggs, price, weight, birds]);

  // Keep amountPaid updated to totalInvoice by default if untouched
  useEffect(() => {
    if (totalInvoice > 0 && amountPaid === '') {
      setAmountPaid(String(totalInvoice));
    }
  }, [totalInvoice, amountPaid]);

  const paidAmt = Math.max(0, parseFloat(amountPaid) || 0);
  const dueAmt = Math.max(0, totalInvoice - paidAmt);

  const handleSubmit = async () => {
    if (!selectedBatchId) {
      showAlert('Validation Error', 'Please select a flock / batch.');
      return;
    }

    if (totalInvoice <= 0) {
      showAlert('Validation Error', 'Please enter valid quantity and unit price.');
      return;
    }

    if (!saleDate) {
      showAlert('Validation Error', 'Sale date is required (YYYY-MM-DD).');
      return;
    }

    const actualQty = itemType === 'egg' ? totalEggs : (birds || weight || 0);
    const unit = itemType === 'egg' ? eggUnit : chickenUnit;

    const chosenCust = customers.find(c => c._id === selectedCustomerId);
    const finalCustName = chosenCust ? chosenCust.name : customerName.trim();
    const finalCustPhone = chosenCust ? chosenCust.phone : customerPhone.trim();

    setSubmitting(true);
    try {
      await apiFetch(
        '/sales',
        {
          method: 'POST',
          body: JSON.stringify({
            batchId: selectedBatchId,
            customerId: selectedCustomerId || undefined,
            customerName: finalCustName || undefined,
            customerPhone: finalCustPhone || undefined,
            items: [
              {
                type: itemType,
                quantity: actualQty,
                crates: itemType === 'egg' ? crates : undefined,
                looseEggs: itemType === 'egg' ? loose : undefined,
                birdCount: itemType === 'chicken' ? birds : undefined,
                weightKg: itemType === 'chicken' ? weight : undefined,
                unit,
                unitPrice: price,
              },
            ],
            // Top-level fallbacks for various controller versions
            itemType,
            quantity: actualQty,
            unitPrice: price,
            totalAmount: totalInvoice,
            amountPaid: paidAmt,
            date: saleDate,
          }),
        },
        token
      );

      showAlert('Success', `Sale of ৳${totalInvoice.toLocaleString()} recorded successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to record sale.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBatch = batches.find(b => b._id === selectedBatchId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalContainer}>
          {/* Header */}
          <View style={s.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={s.iconBox}>
                <ShoppingCart size={18} color="#fff" />
              </View>
              <View>
                <Text style={s.modalTitle}>Record Sale Invoice</Text>
                {selectedBatch && (
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    {selectedBatch.name} ({selectedBatch.breed})
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loadingInitial ? (
            <ActivityIndicator size="large" color={colors.brand} style={{ padding: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Sale Date Input */}
              <DatePickerInput
                label="Sale Date *"
                value={saleDate}
                onChange={setSaleDate}
                style={{ marginBottom: 14 }}
              />

              {/* Flock / Batch Selector (shown if not pre-locked) */}
              {!propBatchId && batches.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={common.label}>Select Flock / Batch *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    {batches.map(b => {
                      const isSel = selectedBatchId === b._id;
                      return (
                        <TouchableOpacity
                          key={b._id}
                          style={[s.chip, isSel && s.chipActive]}
                          onPress={() => setSelectedBatchId(b._id)}
                        >
                          <Bird size={14} color={isSel ? '#fff' : colors.textMain} style={{ marginRight: 4 }} />
                          <Text style={[s.chipText, isSel && s.chipTextActive]}>
                            {b.name} ({b.breed})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Customer Selector */}
              <Text style={common.label}>Customer (Select or Walk-in)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <TouchableOpacity
                  style={[s.chip, !selectedCustomerId && s.chipActive]}
                  onPress={() => {
                    setSelectedCustomerId('');
                    setCustomerName('');
                    setCustomerPhone('');
                  }}
                >
                  <Text style={[s.chipText, !selectedCustomerId && s.chipTextActive]}>
                    Walk-in Customer
                  </Text>
                </TouchableOpacity>

                {customers.map(c => {
                  const isSel = selectedCustomerId === c._id;
                  return (
                    <TouchableOpacity
                      key={c._id}
                      style={[s.chip, isSel && s.chipActive]}
                      onPress={() => {
                        setSelectedCustomerId(c._id);
                        setCustomerName(c.name);
                        setCustomerPhone(c.phone || '');
                      }}
                    >
                      <Text style={[s.chipText, isSel && s.chipTextActive]}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Walk-in Customer Inputs */}
              {!selectedCustomerId && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  <TextInput
                    style={[common.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Customer Name (Optional)"
                    placeholderTextColor={colors.textMuted}
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                  <TextInput
                    style={[common.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Phone (Optional)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                  />
                </View>
              )}

              {/* Item Type Selector (Layer farm allows both Egg & Chicken; Broiler is Chicken only) */}
              {isLayerFarm && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={common.label}>Item Category</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[s.categoryBtn, itemType === 'egg' && s.categoryBtnActiveEgg]}
                      onPress={() => setItemType('egg')}
                    >
                      <Egg size={15} color={itemType === 'egg' ? colors.secondary : colors.textMuted} />
                      <Text style={[s.categoryBtnText, itemType === 'egg' && { color: colors.secondary }]}>
                        Layer Eggs
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.categoryBtn, itemType === 'chicken' && s.categoryBtnActiveChicken]}
                      onPress={() => setItemType('chicken')}
                    >
                      <Bird size={15} color={itemType === 'chicken' ? colors.brand : colors.textMuted} />
                      <Text style={[s.categoryBtnText, itemType === 'chicken' && { color: colors.brand }]}>
                        Birds / Chickens
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Quantity & Unit Pricing Section */}
              {itemType === 'egg' ? (
                <View style={s.detailsCard}>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Full Crates (30 eggs)</Text>
                      <TextInput
                        style={common.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        value={cratesInput}
                        onChangeText={setCratesInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Loose Eggs</Text>
                      <TextInput
                        style={common.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        value={looseEggsInput}
                        onChangeText={setLooseEggsInput}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Pricing Unit</Text>
                      <TouchableOpacity
                        style={[common.input, { justifyContent: 'center' }]}
                        onPress={() => setEggUnit(eggUnit === 'tray' ? 'piece' : 'tray')}
                      >
                        <Text style={{ fontWeight: '800', color: colors.textMain }}>
                          {eggUnit === 'tray' ? 'Per Crate (৳)' : 'Per Piece (৳)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Unit Price (৳) *</Text>
                      <TextInput
                        style={common.input}
                        keyboardType="numeric"
                        placeholder={eggUnit === 'tray' ? '330' : '11'}
                        placeholderTextColor={colors.textMuted}
                        value={unitPrice}
                        onChangeText={setUnitPrice}
                      />
                    </View>
                  </View>

                  <View style={s.qtySummaryBox}>
                    <Text style={{ color: colors.secondary, fontWeight: '800', fontSize: 12 }}>
                      Total Eggs: {formatEggCount(totalEggs)} ({totalEggs} eggs)
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={s.detailsCard}>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Bird Count (Qty)</Text>
                      <TextInput
                        style={common.input}
                        keyboardType="numeric"
                        placeholder="50"
                        placeholderTextColor={colors.textMuted}
                        value={birdCountInput}
                        onChangeText={setBirdCountInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Total Weight (kg)</Text>
                      <TextInput
                        style={common.input}
                        keyboardType="numeric"
                        placeholder="100.5"
                        placeholderTextColor={colors.textMuted}
                        value={weightKgInput}
                        onChangeText={setWeightKgInput}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Pricing Unit</Text>
                      <TouchableOpacity
                        style={[common.input, { justifyContent: 'center' }]}
                        onPress={() => setChickenUnit(chickenUnit === 'kg' ? 'bird' : 'kg')}
                      >
                        <Text style={{ fontWeight: '800', color: colors.textMain }}>
                          {chickenUnit === 'kg' ? 'Per kg (৳)' : 'Per Bird (৳)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Unit Price (৳) *</Text>
                      <TextInput
                        style={common.input}
                        keyboardType="numeric"
                        placeholder={chickenUnit === 'kg' ? '180' : '350'}
                        placeholderTextColor={colors.textMuted}
                        value={unitPrice}
                        onChangeText={setUnitPrice}
                      />
                    </View>
                  </View>

                  <View style={[s.qtySummaryBox, { backgroundColor: 'rgba(61, 107, 140, 0.12)' }]}>
                    <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 12 }}>
                      Total Poultry: {birds} birds ({weight} kg)
                    </Text>
                  </View>
                </View>
              )}

              {/* Financial Calculation Breakdown */}
              <View style={s.financeCard}>
                <View style={common.row}>
                  <Text style={s.financeLabel}>Total Invoice Amount:</Text>
                  <Text style={s.financeTotal}>৳{totalInvoice.toLocaleString()}</Text>
                </View>

                <Text style={[common.label, { marginTop: 10 }]}>Amount Paid Now (৳)</Text>
                <TextInput
                  style={[common.input, { backgroundColor: colors.surface, marginBottom: 6 }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={amountPaid}
                  onChangeText={setAmountPaid}
                />

                <View style={[common.row, { marginTop: 6 }]}>
                  <Text style={s.financeLabel}>Remaining Due:</Text>
                  <Text style={[s.financeDue, { color: dueAmt > 0 ? colors.rose : colors.secondary }]}>
                    ৳{dueAmt.toLocaleString()}
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          {/* Action Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting || loadingInitial}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Check size={16} color="#fff" />
                  <Text style={s.submitBtnText}>Confirm Sale</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 42, 38, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBox: {
    backgroundColor: colors.brand,
    padding: 6,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textMain,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 12,
    color: colors.textMain,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#fff',
  },
  categoryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
  },
  categoryBtnActiveEgg: {
    borderColor: colors.secondary,
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
  },
  categoryBtnActiveChicken: {
    borderColor: colors.brand,
    backgroundColor: 'rgba(199, 81, 31, 0.15)',
  },
  categoryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
  },
  detailsCard: {
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  qtySummaryBox: {
    backgroundColor: 'rgba(74, 124, 89, 0.12)',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  financeCard: {
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  financeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  financeTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textMain,
  },
  financeDue: {
    fontSize: 15,
    fontWeight: '800',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    padding: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.textMain,
    fontWeight: '700',
    fontSize: 14,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.brand,
    padding: 13,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
