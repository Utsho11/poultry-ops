import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, ScrollView, Image
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, STATUS_BAR_PADDING } from '../styles';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login fields (Email OR Phone)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      showAlert('Error', 'Please enter your Email or Phone Number and Password');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password })
      });
      await login(data.accessToken, data.user);
    } catch (err: any) {
      showAlert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !password) {
      showAlert('Error', 'Name and Password are required');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      showAlert('Error', 'Please enter either an Email address OR a Phone number');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password
        })
      });
      await login(data.accessToken, data.user);
      showAlert('Success', 'Account created! Now create your first Firm.');
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
        <Text style={s.appName}>PoultryDex</Text>
        <Text style={s.tagline}>Farm & Firm Management System</Text>
      </View>

      {/* Tab switcher */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, !isRegister && s.tabActive]}
          onPress={() => {
            setIsRegister(false);
            setShowPassword(false);
          }}
        >
          <Text style={[s.tabText, !isRegister && s.tabTextActive]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, isRegister && s.tabActive]}
          onPress={() => {
            setIsRegister(true);
            setShowPassword(false);
          }}
        >
          <Text style={[s.tabText, isRegister && s.tabTextActive]}>Create Account</Text>
        </TouchableOpacity>
      </View>

      {/* Form Card */}
      <View style={s.card}>
        {!isRegister ? (
          <>
            <Text style={s.label}>Phone Number or Email Address *</Text>
            <TextInput
              style={s.input}
              placeholder="01700000000 or email@domain.com"
              placeholderTextColor={colors.textMuted}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />

            <Text style={s.label}>Password *</Text>
            <View style={s.passwordContainer}>
              <TextInput
                style={s.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={s.eyeBtn}
                onPress={() => setShowPassword(prev => !prev)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.brand} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={s.label}>Full Name *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Karim Chowdhury"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={s.label}>Phone Number (Use for login)</Text>
            <TextInput
              style={s.input}
              placeholder="+8801700000000"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={s.label}>Email Address (Use for login)</Text>
            <TextInput
              style={s.input}
              placeholder="owner@farm.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={s.label}>Password *</Text>
            <View style={s.passwordContainer}>
              <TextInput
                style={s.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={s.eyeBtn}
                onPress={() => setShowPassword(prev => !prev)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.brand} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity
          style={s.btn}
          onPress={isRegister ? handleRegister : handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: STATUS_BAR_PADDING + 16 },
  logoBox: { alignItems: 'center', marginBottom: 24 },
  appName: { fontSize: 32, fontWeight: '800', color: colors.brand, marginTop: 8 },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.textMain, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textMain,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    color: colors.textMain,
    padding: 12,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: { backgroundColor: colors.brand, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
