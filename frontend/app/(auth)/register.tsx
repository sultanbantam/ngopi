import { afterProfileLogin } from '../../src/utils/profileLink';
import { coffee } from '../../src/theme/coffee';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from '../../src/utils/storage';
import axios from 'axios';
import { deriveKeyPairFromSeed, generateDeviceKeyPair } from '../../src/utils/e2ee';
import { setStoredRefreshToken, setStoredToken } from '../../src/utils/session';
import { explainAuthError } from '../../src/utils/auth-errors';

const API_URL = 'https://api.ngopi.top/api';

import NgopiBrand from '../../src/components/NgopiBrand';
import { useLanguage } from '../../src/utils/i18n';


export default function RegisterScreen() {
  const { lang, toggleLang, t } = useLanguage();
  const params = useLocalSearchParams<{ ref?: string }>();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initRef = async () => {
      let code = params.ref ? String(params.ref) : '';
      if (!code) {
        if (Platform.OS === 'web') {
          code = localStorage.getItem('referral_code') || '';
        } else {
          code = (await SecureStore.getItemAsync('referral_code')) || '';
        }
      }
      if (code) {
        setReferralCode(code.replace(/^@/, ''));
      }
    };
    initRef();
  }, [params.ref]);

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
      deviceKeys = deriveKeyPairFromSeed(`ngopi:e2ee:v1:${normalizedUsername}:${password}`);
    } catch {
      deviceKeys = generateDeviceKeyPair();
    }

    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        username: normalizedUsername,
        password,
        display_name: normalizedDisplayName,
        public_key: deviceKeys.publicKey,
        referral_code: referralCode ? referralCode.trim() : undefined,
      }, { withCredentials: true, headers: { 'x-skip-auth-refresh': 'true' } });
      const { token, refresh_token: refreshToken, user } = response.data;

      await setStoredToken(token);
      await setStoredRefreshToken(refreshToken);

      if (Platform.OS === 'web') {
        localStorage.setItem('temp_key', password);
        localStorage.setItem('username', normalizedUsername);
        localStorage.setItem('userId', user.id);
        localStorage.setItem('private_key', deviceKeys.privateKey);
        localStorage.removeItem('referral_code');
      } else {
        await SecureStore.setItemAsync('temp_key', password);
        await SecureStore.setItemAsync('username', normalizedUsername);
        await SecureStore.setItemAsync('userId', user.id);
        await SecureStore.setItemAsync('private_key', deviceKeys.privateKey);
        try { await SecureStore.deleteItemAsync('referral_code'); } catch (_) {}
      }

      await afterProfileLogin();
    } catch (err: any) {
      setError(explainAuthError(err, 'register'));

    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <TouchableOpacity
          onPress={toggleLang}
          style={{
            alignSelf: 'flex-end',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: '#261C15',
            borderWidth: 1,
            borderColor: '#4A3728',
            marginBottom: 8,
          }}
        >
          <Text style={{ color: '#D4AF37', fontSize: 11, fontWeight: '800' }}>
            {lang === 'id' ? 'ID | en' : 'EN | id'}
          </Text>
        </TouchableOpacity>
        <NgopiBrand />
        <Text style={styles.subtitle}>{t('Mulai obrolan dengan akun unikmu.', 'Start chatting with your unique account.')}</Text>

        {referralCode ? (
          <View style={{
            backgroundColor: 'rgba(234, 88, 12, 0.15)',
            borderColor: '#ea580c',
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Text style={{ fontSize: 20 }}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: coffee.accent, fontSize: 12, fontWeight: '700' }}>
                {t(`Undangan dari @${referralCode}`, `Invited by @${referralCode}`)}
              </Text>
              <Text style={{ color: coffee.secondary, fontSize: 10 }}>
                {t(
                  'Bergabung melalui link kemenangan! Kawan Anda akan menerima +50 Poin Referral.',
                  'Joined via referral link! Your friend will receive +50 Referral Points.'
                )}
              </Text>
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder={t('Nama Tampilan', 'Display Name')}
          placeholderTextColor={coffee.muted}
          value={displayName}
          onChangeText={setDisplayName}
        />

        <TextInput
          style={styles.input}
          placeholder={t('Nama Pengguna (Username)', 'Username')}
          placeholderTextColor={coffee.muted}
          value={username}
          onChangeText={setUsername}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder={t('Kata Sandi', 'Password')}
            placeholderTextColor={coffee.muted}
            value={password}
            onChangeText={setPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Text style={{ color: coffee.secondary }}>
              {showPassword ? t('Sembunyikan', 'Hide') : t('Tampilkan', 'Show')}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: coffee.secondary, fontSize: 12, marginTop: -8, marginBottom: 12 }}>
          {t('Minimal 8 karakter', 'Minimum 8 characters')}
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={coffee.text} />
          ) : (
            <Text style={styles.buttonText}>{t('Daftar', 'Sign Up')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('Sudah punya akun?', 'Already have an account?')}</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.linkText}> {t('Masuk', 'Login')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: coffee.raised }}>
          <TouchableOpacity onPress={() => router.push('/privacy')}>
            <Text style={{ color: coffee.muted, fontSize: 12 }}>{t('Kebijakan Privasi', 'Privacy Policy')}</Text>
          </TouchableOpacity>
          <Text style={{ color: coffee.muted, fontSize: 12 }}>•</Text>
          <TouchableOpacity onPress={() => router.push('/terms')}>
            <Text style={{ color: coffee.muted, fontSize: 12 }}>{t('Syarat & Ketentuan', 'Terms & Conditions')}</Text>
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
  button: {
    backgroundColor: coffee.button, // Emerald green
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

