import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from '../../src/utils/storage';
import axios from 'axios';
import { generateDeviceKeyPair } from '../../src/utils/e2ee';
import { setStoredRefreshToken, setStoredToken } from '../../src/utils/session';
import { explainAuthError } from '../../src/utils/auth-errors';

const API_URL = 'https://api.bamboochat.click/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoImage = require('../../assets/logo.png');


export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();
    if (!normalizedUsername || !password || !normalizedDisplayName) {
      setError('Nama tampilan, username, dan password wajib diisi.');
      return;
    }
    if (!/^[a-z0-9_.-]{3,30}$/.test(normalizedUsername)) {
      setError('Username harus 3-30 karakter dan hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda minus.');
      return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }
    if (password.length > 128) {
      setError('Password maksimal 128 karakter.');
      return;
    }
    if (normalizedDisplayName.length > 50) {
      setError('Nama tampilan maksimal 50 karakter.');
      return;
    }
    setLoading(true);
    setError('');

    let deviceKeys: ReturnType<typeof generateDeviceKeyPair>;
    try {
      deviceKeys = generateDeviceKeyPair();
    } catch {
      setError('Kunci keamanan perangkat gagal dibuat. Muat ulang halaman atau gunakan browser terbaru.');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/register`, { 
        username: normalizedUsername,
        password, 
        display_name: normalizedDisplayName,
        public_key: deviceKeys.publicKey
      }, { withCredentials: true, headers: { 'x-skip-auth-refresh': 'true' } });
      const { token, refresh_token: refreshToken, user } = response.data;
      
      await setStoredToken(token);
      await setStoredRefreshToken(refreshToken);

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

      router.replace('/(main)/bambupedia');
    } catch (err: any) {
      setError(explainAuthError(err, 'register'));

    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <Image source={logoImage} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.subtitle}>Join Bamboochain today</Text>
        
        {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          placeholderTextColor="#64748b"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
          autoCorrect={false}
          autoCapitalize="none"
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            textContentType="newPassword"
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Text style={{ color: '#94A3B8' }}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: -8, marginBottom: 12 }}>Minimal 8 karakter</Text>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.linkText}> Login</Text>
          </TouchableOpacity>
        </View>
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
  button: {
    backgroundColor: '#10B981', // Emerald green
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

