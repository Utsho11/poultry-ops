import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, ScrollView, StyleSheet, ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { formatEggCount, cratesAndLooseToTotal } from '../utils/crates';
import { DatePickerInput } from './DatePickerInput';
import { Zap, Egg, Wheat, AlertCircle, CheckCircle2, X } from 'lucide-react-native';

export interface DailyLogModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialBatchId?: string;
  batches?: any[];
}

export const DailyLogModal: React.FC<DailyLogModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialBatchId,
  batches: propBatches
}) => {
  const { token, activeFarm } = useAuth();

  const [batches, setBatches] = useState<any[]>(propBatches || []);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || '');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [crates, setCrates] = useState('0');
  const [looseEggs, setLooseEggs] = useState('0');
  const [brokenEggCount, setBrokenEggCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedBags, setFeedBags] = useState('1');
  const [feedLooseKg, setFeedLooseKg] = useState('5');
  const [waterGivenLiters, setWaterGivenLiters] = useState('100');
  const [notes, setNotes] = useState('');

  const [summaryData, setSummaryData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync batch selection and load dependencies on open
  useEffect(() => {
    if (visible) {
      if (initialBatchId) {
        setSelectedBatchId(initialBatchId);
      }
      setLogDate(new Date().toISOString().split('T')[0]);

      // Load batches if not provided or empty
      if (!propBatches || propBatches.length === 0) {
        apiFetch('/batches?status=active', {}, token)
          .then((data) => {
            setBatches(data);
            if (!initialBatchId && data.length > 0) {
              setSelectedBatchId(data[0]._id);
            }
          })
          .catch(() => {});
      } else {
        setBatches(propBatches);
        if (!initialBatchId && propBatches.length > 0) {
          setSelectedBatchId(propBatches[0]._id);
        }
      }

      // Load stock summary
      apiFetch('/reports/summary', {}, token)
        .then((res) => setSummaryData(res))
        .catch(() => {});
    }
  }, [visible, initialBatchId, propBatches, token]);

  const totalCalculatedEggs = cratesAndLooseToTotal(crates, looseEggs);
  const totalFeedGivenKg = (Number(feedBags || 0) * 50) + Number(feedLooseKg || 0);

  const availableStockKg = summaryData?.availableFeedStockKg ?? Infinity;
  const isFeedExceeded = (summaryData?.purchasedFeedKg || 0) > 0 && totalFeedGivenKg > availableStockKg;

  const currentBatchObj = batches.find((b) => b._id === selectedBatchId);
  const isLayer = activeFarm?.animalType === 'layer' || currentBatchObj?.type === 'layer';

  const resetForm = () => {
    setCrates('0');
    setLooseEggs('0');
    setBrokenEggCount('0');
    setDeadCount('0');
    setFeedBags('1');
    setFeedLooseKg('5');
    setWaterGivenLiters('100');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!selectedBatchId) {
      showAlert('Validation Error', 'Please select an active flock/batch');
      return;
    }
    if (!logDate) {
      showAlert('Validation Error', 'Log date is required');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(
        '/logs',
        {
          method: 'POST',
          body: JSON.stringify({
            batchId: selectedBatchId,
            date: logDate,
            eggCount: isLayer ? totalCalculatedEggs : 0,
            brokenEggCount: isLayer ? Number(brokenEggCount || 0) : 0,
            deadCount: Number(deadCount || 0),
            feedGivenKg: Number(totalFeedGivenKg || 0),
            waterGivenLiters: Number(waterGivenLiters || 0),
            notes
          })
        },
        token
      );

      resetForm();
      onClose();
      showAlert('Success', `Daily log for ${currentBatchObj?.name || 'flock'} saved successfully!`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showAlert('Submission Error', err.message || 'Failed to submit daily log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Zap size={20} color={colors.brand} />
              <Text style={{ color: colors.textMain, fontSize: 17, fontWeight: '800' }}>
                Log Daily Yield & Feeding
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Flock / Batch selection */}
          <Text style={common.label}>Select Flock / Batch *</Text>
          {initialBatchId && currentBatchObj ? (
            <View style={s.autoSelectedBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} color={colors.secondary} />
                <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: '700' }}>
                  Auto-Selected: {currentBatchObj.name} ({currentBatchObj.breed || 'Flock'})
                </Text>
              </View>
              {currentBatchObj.startDate && (
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  Started: {new Date(currentBatchObj.startDate).toISOString().split('T')[0]} | Birds: {currentBatchObj.currentCount}
                </Text>
              )}
            </View>
          ) : (
            <View style={s.pickerWrapper}>
              <Picker
                selectedValue={selectedBatchId}
                onValueChange={(val) => setSelectedBatchId(val)}
                dropdownIconColor={colors.brand}
                style={s.pickerStyle}
              >
                {batches
                  .filter((b) => !activeFarm?.animalType || b.type === (activeFarm.animalType === 'broiler' ? 'broiler' : 'layer'))
                  .map((b) => (
                    <Picker.Item key={b._id} label={`${b.name} (${b.breed || 'Flock'})`} value={b._id} />
                  ))}
              </Picker>
            </View>
          )}

          {/* Log Date */}
          <DatePickerInput
            label="Log Date *"
            value={logDate}
            onChange={setLogDate}
            style={{ marginBottom: 14 }}
          />

          {/* Egg Yield Section (Only for Layer Farms) */}
          {isLayer && (
            <>
              <View style={s.crateBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Egg size={15} color={colors.brand} />
                  <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 14 }}>
                    Eggs Collected (1 Crate = 30 Eggs)
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Full Crates</Text>
                    <TextInput
                      style={common.input}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      value={crates}
                      onChangeText={setCrates}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Loose Eggs</Text>
                    <TextInput
                      style={common.input}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      value={looseEggs}
                      onChangeText={setLooseEggs}
                    />
                  </View>
                </View>
                <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13, marginTop: 6 }}>
                  Total: {formatEggCount(totalCalculatedEggs)} ({totalCalculatedEggs} eggs)
                </Text>
              </View>

              <Text style={common.label}>Broken Eggs</Text>
              <TextInput
                style={common.input}
                keyboardType="numeric"
                value={brokenEggCount}
                onChangeText={setBrokenEggCount}
              />
            </>
          )}

          {/* Mortality */}
          <Text style={common.label}>Dead Birds</Text>
          <TextInput
            style={common.input}
            keyboardType="numeric"
            value={deadCount}
            onChangeText={setDeadCount}
          />

          {/* Dual Feed Input */}
          <View style={[s.feedBox, isFeedExceeded && { borderColor: colors.rose, backgroundColor: 'rgba(244,63,94,0.1)' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Wheat size={14} color={isFeedExceeded ? colors.rose : colors.amber} />
                <Text style={{ color: isFeedExceeded ? colors.rose : colors.amber, fontWeight: '800', fontSize: 13 }}>
                  Feed Given (Full Bags + Loose kg) *
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
              Stock Available: {(summaryData?.availableFeedStockKg || 0).toLocaleString()} kg ({summaryData?.availableFeedStockBags || 0} Bags)
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={common.label}>Full Bags (50kg/bag)</Text>
                <TextInput
                  style={common.input}
                  keyboardType="numeric"
                  placeholder="1"
                  value={feedBags}
                  onChangeText={setFeedBags}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={common.label}>Loose kg</Text>
                <TextInput
                  style={common.input}
                  keyboardType="numeric"
                  placeholder="5"
                  value={feedLooseKg}
                  onChangeText={setFeedLooseKg}
                />
              </View>
            </View>

            <Text style={{ color: isFeedExceeded ? colors.rose : colors.textMain, fontWeight: '800', fontSize: 13, marginTop: 8 }}>
              Total: {totalFeedGivenKg.toLocaleString()} kg ({feedBags || 0} Bags + {feedLooseKg || 0} kg)
            </Text>
            {isFeedExceeded && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <AlertCircle size={12} color={colors.rose} />
                <Text style={{ color: colors.rose, fontWeight: '800', fontSize: 11 }}>
                  Exceeds store feed stock ({availableStockKg.toLocaleString()} kg max)!
                </Text>
              </View>
            )}
          </View>

          {/* Water Given */}
          <Text style={common.label}>Water Given (Liters)</Text>
          <TextInput
            style={common.input}
            keyboardType="numeric"
            value={waterGivenLiters}
            onChangeText={setWaterGivenLiters}
          />

          {/* Notes */}
          <Text style={common.label}>Notes / Observations</Text>
          <TextInput
            style={[common.input, { minHeight: 55 }]}
            placeholder="Optional health notes..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={onClose}>
              <Text style={common.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={common.btnText}>Save Log</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  pickerWrapper: { backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 14, overflow: 'hidden' },
  pickerStyle: { color: colors.textMain, height: 50 },
  crateBox: { backgroundColor: 'rgba(16,185,129,0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 14 },
  feedBox: { backgroundColor: 'rgba(217, 164, 65, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217, 164, 65, 0.3)', marginBottom: 14 },
  autoSelectedBox: { backgroundColor: 'rgba(74, 124, 89, 0.15)', borderWidth: 1, borderColor: 'rgba(74, 124, 89, 0.3)', borderRadius: 10, padding: 12, marginBottom: 14 }
});
