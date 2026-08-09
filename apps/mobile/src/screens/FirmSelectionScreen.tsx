import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator, Image
} from 'react-native';
import { useAuth, IFirm } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { CreateFirmModal } from '../components/CreateFirmModal';

import { Building2, Plus, ChevronRight, Egg, Bird, ArrowRight, MapPin, Calendar, LogOut } from 'lucide-react-native';

export const FirmSelectionScreen: React.FC<any> = ({ navigation }) => {
  const { token, user, switchFarm, logout } = useAuth();
  const [firms, setFirms] = useState<IFirm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const fetchFirms = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/farms', {}, token);
      setFirms(data);
    } catch (err: any) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFirms();
  }, [fetchFirms]);

  const handleSelectFirm = async (firm: IFirm) => {
    try {
      const data = await apiFetch('/auth/switch-firm', {
        method: 'POST',
        body: JSON.stringify({ farmId: firm._id })
      }, token);
      await switchFarm(firm, data.accessToken);
      if (navigation) {
        navigation.navigate('Main', { screen: 'Dashboard' });
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to select firm');
    }
  };

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFirms(); }} tintColor={colors.brand} />}
      >
        {/* User Info & Logout Header */}
        <View style={s.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 44, height: 44, borderRadius: 12 }} />
            <View>
              <Text style={s.welcomeText}>Welcome back,</Text>
              <Text style={s.userName}>{user?.name || 'Farm Owner'}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={logout}>
            <LogOut size={14} color={colors.rose} style={{ marginRight: 4 }} />
            <Text style={s.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Section Header */}
        <Text style={s.sectionTitle}>Select or Create Firm</Text>
        <Text style={s.sectionSub}>Manage your layer and poultry farms separately</Text>

        {/* TOP BUTTON: Create New Firm */}
        <TouchableOpacity style={s.createFirmBtn} onPress={() => setCreateModalVisible(true)} activeOpacity={0.85}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 }}>
            <Plus size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.createFirmTitle}>Create New Firm</Text>
            <Text style={s.createFirmSub}>Setup Layer Farm or Broiler/Poultry Farm</Text>
          </View>
          <ChevronRight size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* BELOW BUTTON: All Firm List */}
        <View style={s.listHeader}>
          <Text style={s.listTitle}>All Your Firms ({firms.length})</Text>
          <Text style={s.listSub}>Tap a firm below to open its dashboard</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginVertical: 30 }} />
        ) : firms.length === 0 ? (
          <View style={s.emptyCard}>
            <Building2 size={40} color={colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 16 }}>No Firms Created Yet</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
              Tap the "Create New Firm" button above to set up your first farm!
            </Text>
          </View>
        ) : (
          firms.map((firm) => (
            <TouchableOpacity
              key={firm._id}
              style={s.firmCard}
              onPress={() => handleSelectFirm(firm)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[s.typeBadge, firm.animalType === 'layer' ? s.layerBadge : s.poultryBadge]}>
                    {firm.animalType === 'layer' ? (
                      <Egg size={22} color={colors.secondary} />
                    ) : (
                      <Bird size={22} color={colors.brand} />
                    )}
                  </View>
                  <View>
                    <Text style={s.firmName}>{firm.name}</Text>
                    <Text style={s.firmTypeLabel}>
                      {firm.animalType === 'layer' ? 'LAYER FARM' : 'POULTRY / BROILER'}
                    </Text>
                  </View>
                </View>
                <View style={s.openBtn}>
                  <Text style={s.openBtnText}>Open</Text>
                  <ArrowRight size={12} color={colors.brand} style={{ marginLeft: 4 }} />
                </View>
              </View>

              {(firm.location || firm.date) && (
                <View style={s.firmMetaRow}>
                  {firm.location ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} color={colors.textMuted} />
                      <Text style={s.metaText}>{firm.location}</Text>
                    </View>
                  ) : null}
                  {firm.date ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} color={colors.textMuted} />
                      <Text style={s.metaText}>{new Date(firm.date).toLocaleDateString()}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <CreateFirmModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          fetchFirms();
          if (navigation) {
            navigation.navigate('Main', { screen: 'Dashboard' });
          }
        }}
      />
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 50 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, backgroundColor: colors.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  welcomeText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  userName: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  logoutBtn: { backgroundColor: 'rgba(244, 63, 94, 0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  logoutText: { color: colors.rose, fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 24, fontWeight: '900', color: colors.brand },
  sectionSub: { fontSize: 13, color: colors.textMuted, marginBottom: 18 },
  createFirmBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brand, padding: 18, borderRadius: 16, marginBottom: 24, gap: 12, elevation: 3 },
  createFirmIcon: { fontSize: 24 },
  createFirmTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },
  createFirmSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  arrowText: { fontSize: 20, color: '#FFFFFF', fontWeight: '900' },
  listHeader: { marginBottom: 12 },
  listTitle: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  listSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  emptyCard: { backgroundColor: colors.surface, padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  firmCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12, elevation: 1 },
  typeBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  layerBadge: { backgroundColor: 'rgba(74, 124, 89, 0.15)' },
  poultryBadge: { backgroundColor: 'rgba(199, 81, 31, 0.15)' },
  firmName: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  firmTypeLabel: { fontSize: 10, fontWeight: '800', color: colors.brand, marginTop: 2 },
  openBtn: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  openBtnText: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  firmMetaRow: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' }
});
