import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from '../../src/utils/storage';
import axios from 'axios';
import { API_URL, refreshAccessToken, setStoredRefreshToken, setStoredToken } from '../../src/utils/session';
import { explainAuthError } from '../../src/utils/auth-errors';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoImage = require('../../assets/logo.png');


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
        router.replace('/(main)/bambupedia');
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
        router.replace('/(main)/bambupedia');
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

      if (Platform.OS === 'web') {
        localStorage.setItem('temp_key', password);
        localStorage.setItem('username', normalizedUsername);
        localStorage.setItem('userId', user.id);
      } else {
        await SecureStore.setItemAsync('temp_key', password);
        await SecureStore.setItemAsync('username', normalizedUsername);
        await SecureStore.setItemAsync('userId', user.id);
      }

      router.replace('/(main)/bambupedia');
    } catch (err: any) {
      setError(explainAuthError(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const handleBamboochainLogin = () => {
    if (Platform.OS === 'web') {
      window.location.href = `${API_URL}/auth/bamboochain`;
    } else {
      alert('Mobile SSO not fully supported yet');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <Image source={logoImage} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.subtitle}>Decentralized • Secure • Connected</Text>
        
        {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Text style={{ color: '#94A3B8' }}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        {challengeToken ? (
          <TextInput
            style={styles.input}
            placeholder="Kode MFA 6 digit"
            placeholderTextColor="#64748b"
            value={mfaCode}
            onChangeText={setMfaCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        ) : null}

        <TouchableOpacity onPress={() => alert('Karena ini aplikasi desentralisasi tanpa email, reset password otomatis tidak tersedia. Silakan hubungi admin atau gunakan login BambooChain wallet Anda.')}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.bambooSsoButton} onPress={handleBamboochainLogin}>
          <Text style={styles.bambooSsoButtonText}>🎋 Login with BaMbooChain</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.linkText}> Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Temporary button for Pi Developer Portal Step 10 */}
        <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => router.push('/test-payment')}>
          <Text style={{ color: '#F59E0B', textDecorationLine: 'underline' }}>
            [Developer] Go to Test Payment (Step 10)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0F172A',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    padding: 30,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 140,
    height: 140,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    color: '#F8FAFC',
    padding: 16,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 16,
  },
  forgotPasswordText: {
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bambooSsoButton: {
    backgroundColor: '#34A853', // Hijau yang sesuai
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  bambooSsoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#94A3B8',
  },
  linkText: {
    color: '#10B981',
    fontWeight: 'bold',
  }
});
