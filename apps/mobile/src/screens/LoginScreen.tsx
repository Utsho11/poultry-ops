import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, ScrollView, Image
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors } from '../styles';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [farmName, setFarmName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { showAlert('Error', 'Email and password required'); return; }
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      await login(data.accessToken, data.user);
    } catch (err: any) {
      showAlert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!farmName || !ownerName || !email || !password) {
      showAlert('Error', 'Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/auth/register-farm', {
        method: 'POST',
        body: JSON.stringify({ farmName, ownerName, email, password, phone, timezone: 'Asia/Dhaka' })
      });
      await login(data.accessToken, data.user);
    } catch (err: any) {
      showAlert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {/* Logo */}
      <View style={s.logoBox}>
        <Image source={require('../../assets/icon.png')} style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 8, borderWidth: 1, borderColor: colors.brand }} />
        <Text style={s.appName}>PoultryOps</Text>
        <Text style={s.tagline}>Poultry Farm Management</Text>
      </View>

      {/* Tab switcher */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, !isRegister && s.tabActive]}
          onPress={() => setIsRegister(false)}
        >
          <Text style={[s.tabText, !isRegister && s.tabTextActive]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, isRegister && s.tabActive]}
          onPress={() => setIsRegister(true)}
        >
          <Text style={[s.tabText, isRegister && s.tabTextActive]}>Register Farm</Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={s.card}>
        {isRegister && (
          <>
            <Text style={s.label}>Farm / Business Name *</Text>
            <TextInput style={s.input} placeholder="e.g. Green Valley Agro Farm" placeholderTextColor="#64748b"
              value={farmName} onChangeText={setFarmName} />
            <Text style={s.label}>Owner Full Name *</Text>
            <TextInput style={s.input} placeholder="Karim Chowdhury" placeholderTextColor="#64748b"
              value={ownerName} onChangeText={setOwnerName} />
            <Text style={s.label}>Phone Number</Text>
            <TextInput style={s.input} placeholder="+8801700000000" placeholderTextColor="#64748b"
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </>
        )}

        <Text style={s.label}>Email Address *</Text>
        <TextInput style={s.input} placeholder="owner@farm.com" placeholderTextColor="#64748b"
          value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

        <Text style={s.label}>Password *</Text>
        <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="#64748b"
          value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity
          style={s.btn}
          onPress={isRegister ? handleRegister : handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{isRegister ? 'Create Farm Account' : 'Sign In'}</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 60 },
  logoBox: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 64 },
  appName: { fontSize: 32, fontWeight: '800', color: colors.brand, marginTop: 8 },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.textMain, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: colors.surfaceElevated, color: colors.textMain, padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 15 },
  btn: { backgroundColor: colors.brand, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
