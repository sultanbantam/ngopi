import { afterProfileLogin } from '../../src/utils/profileLink';
import { coffee } from '../../src/theme/coffee';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from '../../src/utils/storage';
import axios from 'axios';
import { API_URL, refreshAccessToken, setStoredRefreshToken, setStoredToken } from '../../src/utils/session';
import { explainAuthError } from '../../src/utils/auth-errors';
import { deriveKeyPairFromSeed } from '../../src/utils/e2ee';

import NgopiBrand from '../../src/components/NgopiBrand';


export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleSSO = async () => {
      if (params.error) {
        const errorCode = String(params.error);
        setError(errorCode === 'sso_failed' ? 'Login BambooChain gagal. Silakan coba lagi atau gunakan username dan password.' : errorCode === 'session_expired' ? 'Sesi login 30 hari telah berakhir atau dicabut. Silakan login ulang.' : 'Login gagal. Silakan coba kembali.');
      }
      if (params.sso_token) {
        setLoading(true);
        if (Platform.OS === 'web') {
          await setStoredToken(String(params.sso_token));
          localStorage.setItem('username', String(params.sso_username || ''));
          localStorage.setItem('userId', String(params.sso_userid || ''));
        } else {
          await setStoredToken(String(params.sso_token));
          await SecureStore.setItemAsync('username', String(params.sso_username || ''));
          await SecureStore.setItemAsync('userId', String(params.sso_userid || ''));
        }
        await afterProfileLogin();
      } else if (params.sso === 'success') {
        setLoading(true);
        const token = await refreshAccessToken(true);
        if (!token) {
          setLoading(false);
          setError('SSO berhasil, tetapi sesi belum bisa dibuat. Silakan coba login ulang.');
          return;
        }
        if (Platform.OS === 'web') {
          localStorage.setItem('username', String(params.sso_username || ''));
          localStorage.setItem('userId', String(params.sso_userid || ''));
        } else {
          await SecureStore.setItemAsync('username', String(params.sso_username || ''));
          await SecureStore.setItemAsync('userId', String(params.sso_userid || ''));
        }
        await afterProfileLogin();
      }
    };
    handleSSO();
  }, [params]);

  const handleLogin = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }
    if (!/^[a-z0-9_.-]{3,30}$/.test(normalizedUsername)) {
      setError('Username harus 3-30 karakter: huruf kecil, angka, titik, garis bawah, atau tanda minus.');
      return;
    }
    if (password.length > 128) {
      setError('Password maksimal 128 karakter.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, { username: normalizedUsername, password, mfa_code: mfaCode || undefined }, { withCredentials: true, headers: { 'x-skip-auth-refresh': 'true' } });
      if (response.status === 202 || response.data?.requires_mfa) {
        setChallengeToken(response.data?.challenge_token || challengeToken);
        setError('Masukkan kode MFA 6 digit dari aplikasi authenticator.');
        return;
      }
      const { token, refresh_token: refreshToken, user } = response.data;

      await setStoredToken(token);
      await setStoredRefreshToken(refreshToken);

      const deviceKeys = deriveKeyPairFromSeed(`ngopi:e2ee:v1:${normalizedUsername}:${password}`);

      if (Platform.OS === 'web') {
        localStorage.setItem('temp_key', password);
        localStorage.setItem('username', normalizedUsername);
        localStorage.setItem('userId', user.id);
        localStorage.setItem('private_key', deviceKeys.privateKey);
      } else {
        await SecureStore.setItemAsync('temp_key', password);
        await SecureStore.setItemAsync('username', normalizedUsername);
        await SecureStore.setItemAsync('userId', user.id);
        await SecureStore.setItemAsync('private_key', deviceKeys.privateKey);
      }

      try {
        await axios.post(`${API_URL}/auth/profile`, { public_key: deviceKeys.publicKey }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {}

      await afterProfileLogin();
    } catch (err: any) {
      setError(explainAuthError(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <NgopiBrand />
        <Text style={styles.subtitle}>Selamat datang kembali.</Text>

        {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={coffee.muted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor={coffee.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="off"
            textContentType="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Text style={{ color: coffee.secondary }}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        {challengeToken ? (
          <TextInput
            style={styles.input}
            placeholder="Kode MFA 6 digit"
            placeholderTextColor={coffee.muted}
            value={mfaCode}
            onChangeText={setMfaCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        ) : null}

        <TouchableOpacity onPress={() => alert('Karena ini aplikasi desentralisasi tanpa email, reset password otomatis tidak tersedia. Silakan hubungi admin untuk bantuan lebih lanjut.')}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color={coffee.text} /> : <Text style={styles.buttonText}>Login</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.linkText}> Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: coffee.raised }}>
          <TouchableOpacity onPress={() => router.push('/privacy')}>
            <Text style={{ color: coffee.muted, fontSize: 12 }}>Kebijakan Privasi</Text>
          </TouchableOpacity>
          <Text style={{ color: coffee.muted, fontSize: 12 }}>•</Text>
          <TouchableOpacity onPress={() => router.push('/terms')}>
            <Text style={{ color: coffee.muted, fontSize: 12 }}>Syarat & Ketentuan</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: coffee.background,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: coffee.surface,
    padding: 24,
    borderRadius: 20,
    shadowColor: coffee.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  subtitle: {
    fontSize: 16,
    color: coffee.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: coffee.background,
    color: coffee.text,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    color: coffee.text,
    padding: 16,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 16,
  },
  forgotPasswordText: {
    color: coffee.secondary,
    textAlign: 'right',
    marginBottom: 16,
  },
  button: {
    backgroundColor: coffee.button,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: coffee.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: coffee.danger,
    marginBottom: 16,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: coffee.secondary,
  },
  linkText: {
    color: coffee.accent,
    fontWeight: 'bold',
  }
});
