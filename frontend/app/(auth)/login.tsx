import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from '../../src/utils/storage';
import axios from 'axios';

const API_URL = 'https://api.bamboochat.click/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoImage = require('../../assets/logo.png');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleSSO = async () => {
      if (params.error) {
        setError(params.error === 'sso_failed' ? 'SSO Login Failed' : String(params.error));
      }
      if (params.sso_token) {
        setLoading(true);
        if (Platform.OS === 'web') {
          localStorage.setItem('token', String(params.sso_token));
          localStorage.setItem('username', String(params.sso_username || ''));
          localStorage.setItem('userId', String(params.sso_userid || ''));
        } else {
          await SecureStore.setItemAsync('token', String(params.sso_token));
          await SecureStore.setItemAsync('username', String(params.sso_username || ''));
          await SecureStore.setItemAsync('userId', String(params.sso_userid || ''));
        }
        router.replace('/(main)/contacts');
      }
    };
    handleSSO();
  }, [params]);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please fill all fields');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, { username, password });
      const { token, user } = response.data;
      
      if (Platform.OS === 'web') {
        localStorage.setItem('token', token);
        localStorage.setItem('temp_key', password);
        localStorage.setItem('username', username);
        localStorage.setItem('userId', user.id);
      } else {
        await SecureStore.setItemAsync('token', token);
        await SecureStore.setItemAsync('temp_key', password);
        await SecureStore.setItemAsync('username', username);
        await SecureStore.setItemAsync('userId', user.id);
      }

      router.replace('/(main)/contacts');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
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
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
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
