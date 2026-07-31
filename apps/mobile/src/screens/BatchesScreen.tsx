import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';

export const BatchesScreen: React.FC = () => {
  const { token, user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [teamWorkers, setTeamWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [assignModalBatch, setAssignModalBatch] = useState<any | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  // Form
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('Cobb 500');
  const [type, setType] = useState<'broiler' | 'layer'>('broiler');
  const [initialCount, setInitialCount] = useState('1000');
  const [shed, setShed] = useState('Shed A');

  const load = useCallback(async () => {
    try {
      const [batchData, usersData] = await Promise.all([
        apiFetch('/batches', {}, token),
        canManage ? apiFetch('/team', {}, token) : Promise.resolve([])
      ]);
      setBatches(batchData);
      if (Array.isArray(usersData)) {
        setTeamWorkers(usersData.filter((u: any) => u.role === 'worker'));
      }
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [canManage, token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name) { showAlert('Error', 'Batch name is required'); return; }
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await apiFetch('/batches', {
        method: 'POST',
        body: JSON.stringify({
          name, breed, type, startDate: today,
          initialCount: Number(initialCount), shed,
          assignedWorkerIds: selectedWorkerIds
        })
      }, token);
      setModalVisible(false);
      setName('');
      setSelectedWorkerIds([]);
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmitting(false); }
  };

  const handleOpenAssignModal = (batch: any) => {
    setAssignModalBatch(batch);
    setSelectedWorkerIds(batch.assignedWorkerIds || []);
  };

  const handleSaveAssignments = async () => {
    if (!assignModalBatch) return;
    try {
      await apiFetch(`/batches/${assignModalBatch._id}/assign-workers`, {
        method: 'PATCH',
        body: JSON.stringify({ workerIds: selectedWorkerIds })
      }, token);
      setAssignModalBatch(null);
      setSelectedWorkerIds([]);
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    }
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const handleClose = async (id: string, batchName: string) => {
    showAlert('Close Batch', `Close "${batchName}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive', onPress: async () => {
          try {
            await apiFetch(`/batches/${id}/close`, { method: 'POST' }, token);
            load();
          } catch (err: any) { showAlert('Error', err.message); }
        }
      }
    ]);
  };

  if (loading) return (
    <View style={[common.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );

  return (
    <View style={common.screen}>
      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        <View style={[common.row, { marginBottom: 20 }]}>
          <View>
            <Text style={common.sectionTitle}>Batches</Text>
            <Text style={common.sectionSubtitle}>
              {user?.role === 'worker' ? 'Your Assigned Bird Flocks' : `${batches.filter(b => b.status === 'active').length} active flocks`}
            </Text>
          </View>
          {canManage && (
            <TouchableOpacity style={s.addBtn} onPress={() => { setSelectedWorkerIds([]); setModalVisible(true); }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ New Batch</Text>
            </TouchableOpacity>
          )}
        </View>

        {batches.length === 0
          ? <Text style={common.emptyText}>{user?.role === 'worker' ? 'No batches assigned to you yet.' : 'No batches found.'}</Text>
          : batches.map(batch => {
            const mortalityCount = batch.initialCount - batch.currentCount;
            const mortalityPct = ((mortalityCount / batch.initialCount) * 100).toFixed(1);
            const isClosed = batch.status === 'closed';
            const assignedWorkers = teamWorkers.filter(w => (batch.assignedWorkerIds || []).includes(w._id));

            return (
              <View key={batch._id} style={[common.card, isClosed && { opacity: 0.65 }]}>
                <View style={common.row}>
                  <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 16, flex: 1 }}>{batch.name}</Text>
                  <View style={[s.badge, { backgroundColor: isClosed ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                    <Text style={{ color: isClosed ? colors.rose : colors.brand, fontSize: 11, fontWeight: '700' }}>
                      {batch.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 10, gap: 6 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>🐔 Breed: <Text style={{ color: colors.textMain }}>{batch.breed} ({batch.type})</Text></Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>🏠 Location: <Text style={{ color: colors.textMain }}>{batch.shed || 'Main Shed'}</Text></Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>📅 Started: <Text style={{ color: colors.textMain }}>{new Date(batch.startDate).toLocaleDateString()}</Text></Text>
                </View>

                {/* Progress bar */}
                <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 12, marginTop: 12 }}>
                  <View style={common.row}>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Current: <Text style={{ color: colors.textMain, fontWeight: '700' }}>{batch.currentCount}</Text></Text>
                    <Text style={{ color: colors.rose, fontSize: 12 }}>Mortality: {mortalityPct}% ({mortalityCount})</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                    <View style={{ height: 6, width: `${(batch.currentCount / batch.initialCount) * 100}%`, backgroundColor: colors.brand, borderRadius: 3 }} />
                  </View>
                </View>

                {/* Assigned Workers Bar */}
                <View style={{ backgroundColor: 'rgba(16,185,129,0.1)', padding: 10, borderRadius: 10, marginTop: 10 }}>
                  <View style={common.row}>
                    <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700' }}>👥 Workers ({assignedWorkers.length})</Text>
                    {canManage && (
                      <TouchableOpacity onPress={() => handleOpenAssignModal(batch)}>
                        <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' }}>Assign Workers</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {assignedWorkers.length > 0 ? (
                    <Text style={{ color: colors.textMain, fontSize: 11, marginTop: 4 }}>
                      {assignedWorkers.map(w => w.name).join(', ')}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Accessible to all workers</Text>
                  )}
                </View>

                {canManage && !isClosed && (
                  <TouchableOpacity style={[s.closeBtn]} onPress={() => handleClose(batch._id, batch.name)}>
                    <Text style={{ color: colors.rose, fontSize: 13, fontWeight: '600' }}>🔒 Close Batch</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        }
      </ScrollView>

      {/* Assign Workers Modal */}
      <Modal visible={!!assignModalBatch} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Assign Workers to {assignModalBatch?.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 14 }}>Selected workers can log daily data for this flock.</Text>

            <ScrollView style={{ maxHeight: 220, marginBottom: 14 }}>
              {teamWorkers.length > 0 ? (
                teamWorkers.map(worker => {
                  const isAssigned = selectedWorkerIds.includes(worker._id);
                  return (
                    <TouchableOpacity
                      key={worker._id}
                      style={[s.workerRow, isAssigned && s.workerRowActive]}
                      onPress={() => toggleWorkerSelection(worker._id)}
                    >
                      <Text style={{ color: colors.textMain, fontWeight: '700' }}>👤 {worker.name}</Text>
                      <Text style={{ color: isAssigned ? colors.brand : colors.textMuted, fontWeight: '800' }}>{isAssigned ? '✓ Assigned' : '+ Add'}</Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{ color: colors.textMuted, textAlign: 'center', padding: 14 }}>No team workers available.</Text>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setAssignModalBatch(null)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1, backgroundColor: colors.brand }]} onPress={handleSaveAssignments}>
                <Text style={common.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Batch Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>New Poultry Batch</Text>
            <Text style={common.label}>Batch Name *</Text>
            <TextInput style={common.input} placeholder="Batch 14 - Broiler" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
            <Text style={common.label}>Type</Text>
            <View style={s.typeRow}>
              {(['broiler', 'layer'] as const).map(t => (
                <TouchableOpacity key={t} style={[s.typeBtn, type === t && s.typeBtnActive]} onPress={() => setType(t)}>
                  <Text style={{ color: type === t ? '#fff' : colors.textMuted, fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={common.label}>Breed</Text>
            <TextInput style={common.input} placeholder="Cobb 500 / Sonali" placeholderTextColor="#64748b" value={breed} onChangeText={setBreed} />
            <Text style={common.label}>Initial Bird Count</Text>
            <TextInput style={common.input} keyboardType="numeric" value={initialCount} onChangeText={setInitialCount} />
            <Text style={common.label}>Shed / Location</Text>
            <TextInput style={common.input} placeholder="Shed A" placeholderTextColor="#64748b" value={shed} onChangeText={setShed} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setModalVisible(false)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  addBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  closeBtn: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: 'rgba(244,63,94,0.1)', alignItems: 'center' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  typeBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  workerRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 10, backgroundColor: colors.surfaceElevated, marginBottom: 8 },
  workerRowActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: colors.brand },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
});
