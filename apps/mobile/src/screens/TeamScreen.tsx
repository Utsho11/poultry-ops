import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';

const ROLES = ['manager', 'worker'];

const roleColor: Record<string, string> = {
  owner: colors.amber,
  manager: colors.blue,
  worker: colors.brand,
};

export const TeamScreen: React.FC = () => {
  const { token, user, logout } = useAuth();
  const [team, setTeam] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isOwner = user?.role === 'owner';

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberRole, setMemberRole] = useState('worker');
  const [memberPhone, setMemberPhone] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/team', {}, token);
      setTeam(data);
    } catch (e) {}
    finally { setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAddMember = async () => {
    if (!memberName || !memberEmail || !memberPassword) {
      showAlert('Error', 'Name, email, and password are required');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ name: memberName, email: memberEmail, password: memberPassword, role: memberRole, phone: memberPhone })
      }, token);
      setModalVisible(false);
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      setMemberPhone('');
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmitting(false); }
  };

  const handleDeleteMember = (member: any) => {
    if (member.role === 'owner') {
      showAlert('Error', 'Cannot delete farm owner');
      return;
    }
    showAlert(
      'Delete Worker',
      `Delete worker ${member.name}? This will remove them from DB and unassign them from all flocks (batch info will be preserved).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/users/${member._id}`, { method: 'DELETE' }, token);
              load();
            } catch (err: any) {
              showAlert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={common.screen}>
      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {/* Profile Card */}
        <View style={[common.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <View style={s.avatar}>
            <Text style={{ fontSize: 32 }}>👤</Text>
          </View>
          <Text style={{ color: colors.textMain, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{user?.name}</Text>
          <View style={[s.roleBadge, { backgroundColor: `${roleColor[user?.role || 'worker']}20` }]}>
            <Text style={{ color: roleColor[user?.role || 'worker'], fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{user?.role}</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>{user?.email}</Text>
          <Text style={{ color: colors.brand, fontSize: 13, marginTop: 2 }}>🏠 {user?.farmName}</Text>
        </View>

        {/* Team section */}
        <View style={[common.row, { marginBottom: 16 }]}>
          <View>
            <Text style={common.sectionTitle}>Team Members</Text>
            <Text style={common.sectionSubtitle}>{team.length} members on your farm</Text>
          </View>
          {isOwner && (
            <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Worker</Text>
            </TouchableOpacity>
          )}
        </View>

        {team.length === 0
          ? <Text style={common.emptyText}>No team members found.</Text>
          : team.map(member => (
            <View key={member._id} style={common.card}>
              <View style={common.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 15 }}>{member.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{member.email}</Text>
                  {member.phone && <Text style={{ color: colors.textMuted, fontSize: 12 }}>📞 {member.phone}</Text>}
                </View>
                <View style={[s.roleBadge, { backgroundColor: `${roleColor[member.role] || colors.brand}20` }]}>
                  <Text style={{ color: roleColor[member.role] || colors.brand, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{member.role}</Text>
                </View>
              </View>

              {isOwner && member.role !== 'owner' && (
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => handleDeleteMember(member)}
                >
                  <Text style={{ color: colors.rose, fontSize: 12, fontWeight: '700' }}>🗑️ Delete Worker from DB & Unassign</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        }

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={{ color: colors.rose, fontWeight: '700', fontSize: 15 }}>🚪 Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Member Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Add Team Member</Text>
            <Text style={common.label}>Full Name *</Text>
            <TextInput style={common.input} placeholder="Rahim Uddin" placeholderTextColor="#64748b" value={memberName} onChangeText={setMemberName} />
            <Text style={common.label}>Email *</Text>
            <TextInput style={common.input} placeholder="worker@yourfarm.com" placeholderTextColor="#64748b" value={memberEmail} onChangeText={setMemberEmail} autoCapitalize="none" keyboardType="email-address" />
            <Text style={common.label}>Password *</Text>
            <TextInput style={common.input} placeholder="Temporary password" placeholderTextColor="#64748b" value={memberPassword} onChangeText={setMemberPassword} secureTextEntry />
            <Text style={common.label}>Phone</Text>
            <TextInput style={common.input} placeholder="+8801700000000" placeholderTextColor="#64748b" value={memberPhone} onChangeText={setMemberPhone} keyboardType="phone-pad" />
            <Text style={common.label}>Role</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {ROLES.map(r => (
                <TouchableOpacity key={r} style={[s.roleChip, memberRole === r && { backgroundColor: roleColor[r] || colors.brand, borderColor: roleColor[r] || colors.brand }]} onPress={() => setMemberRole(r)}>
                  <Text style={{ color: memberRole === r ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setModalVisible(false)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleAddMember} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>Add Member</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.brand },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 8 },
  addBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  deleteBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(244,63,94,0.15)', alignItems: 'center' },
  roleChip: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  logoutBtn: { backgroundColor: 'rgba(244,63,94,0.1)', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: 'rgba(244,63,94,0.2)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
});
