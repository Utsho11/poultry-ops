import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth, IFirm } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { DatePickerInput } from './DatePickerInput';

import { Building2, Egg, Bird, X } from 'lucide-react-native';

interface CreateFirmModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newFirm: IFirm) => void;
}

export const CreateFirmModal: React.FC<CreateFirmModalProps> = ({ visible, onClose, onSuccess }) => {
  const { token, switchFarm } = useAuth();
  const [name, setName] = useState('');
  const [animalType, setAnimalType] = useState<'layer' | 'poultry'>('layer');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      showAlert('Validation Error', 'Firm name is required');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch('/farms', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          animalType,
          date,
          location: location.trim()
        })
      }, token);

      const createdFirm: IFirm = {
        _id: data.farm._id,
        name: data.farm.name,
        animalType: data.farm.animalType,
        date: data.farm.date,
        location: data.farm.location
      };

      await switchFarm(createdFirm, data.accessToken);
      showAlert('Success', `Firm '${createdFirm.name}' created successfully!`);
      setName('');
      setLocation('');
      onClose();
      if (onSuccess) onSuccess(createdFirm);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create firm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Building2 size={20} color={colors.brand} />
              <Text style={s.title}>Create New Firm / Farm</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={common.label}>Firm / Business Name *</Text>
          <TextInput
            style={common.input}
            placeholder="e.g. Gazipur Layer Farm Unit-2"
            placeholderTextColor="#64748b"
            value={name}
            onChangeText={setName}
          />

          <Text style={common.label}>Animal / Farm Type *</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <TouchableOpacity
              style={[s.typeChip, animalType === 'layer' && s.typeChipActive]}
              onPress={() => setAnimalType('layer')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Egg size={16} color={animalType === 'layer' ? '#fff' : colors.textMuted} />
                <Text style={[s.typeChipText, animalType === 'layer' && s.typeChipTextActive]}>Layer Farm</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeChip, animalType === 'poultry' && s.typeChipActive]}
              onPress={() => setAnimalType('poultry')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Bird size={16} color={animalType === 'poultry' ? '#fff' : colors.textMuted} />
                <Text style={[s.typeChipText, animalType === 'poultry' && s.typeChipTextActive]}>Broiler / Poultry</Text>
              </View>
            </TouchableOpacity>
          </View>

          <DatePickerInput
            label="📅 Established / Start Date"
            value={date}
            onChange={setDate}
            style={{ marginBottom: 14 }}
          />

          <Text style={common.label}>Location / Shed Address</Text>
          <TextInput
            style={common.input}
            placeholder="e.g. Gazipur, Dhaka"
            placeholderTextColor="#64748b"
            value={location}
            onChangeText={setLocation}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={onClose}>
              <Text style={common.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleCreate} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>Create Firm</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, alignItems: 'center' },
  typeChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  typeChipTextActive: { color: '#fff', fontWeight: '800' }
});
