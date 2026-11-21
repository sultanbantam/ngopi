import { afterProfileLogin } from '../../src/utils/profileLink';
import { coffee } from '../../src/theme/coffee';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, ScrollView, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from '../../src/utils/storage';
import axios from 'axios';
import { API_URL, refreshAccessToken, setStoredRefreshToken, setStoredToken } from '../../src/utils/session';
import { explainAuthError } from '../../src/utils/auth-errors';
import { deriveKeyPairFromSeed } from '../../src/utils/e2ee';

import NgopiBrand from '../../src/components/NgopiBrand';
import { useLanguage } from '../../src/utils/i18n';


export default function LoginScreen() {
  const { lang, toggleLang, t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtpOrPin, setForgotOtpOrPin] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [hasRecoveryPin, setHasRecoveryPin] = useState(false);
  const params = useLocalSearchParams();

  const handleRequestPasswordReset = async () => {
    if (!forgotIdentifier.trim()) {
      setForgotError('Masukkan Email @ngopi.top, Username, atau Nomor ID Ngopi Anda.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    setForgotInfo('');
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, {
        identifier: forgotIdentifier.trim(),
      });
      setHasRecoveryPin(Boolean(res.data?.has_recovery_pin));
      setForgotInfo(
        res.data?.message ||
          `Permintaan pemulihan untuk ${res.data?.ngopi_email || forgotIdentifier} berhasil diproses.`
      );
      setForgotStep('reset');
    } catch (err: any) {
      setForgotError(err?.response?.data?.error || 'Gagal memproses permintaan lupa kata sandi.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    if (!forgotOtpOrPin.trim() || forgotNewPassword.length < 8) {
      setForgotError('Masukkan Kode OTP / PIN Pemulihan dan kata sandi baru minimal 8 karakter.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      const res = await axios.post(`${API_URL}/auth/reset-password`, {
        identifier: forgotIdentifier.trim(),
        new_password: forgotNewPassword,
        otp: forgotOtpOrPin.trim(),
        recovery_pin: forgotOtpOrPin.trim(),
      });
      setForgotVisible(false);
      setForgotStep('request');
      setForgotOtpOrPin('');
      setForgotNewPassword('');
      setError('');
      alert(res.data?.message || 'Kata sandi berhasil diperbarui! Silakan login.');
    } catch (err: any) {
      setForgotError(err?.response?.data?.error || 'Kode OTP atau PIN Pemulihan tidak valid.');
    } finally {
      setForgotLoading(false);
    }
  };

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
    const trimmedInput = username.trim();
    if (!trimmedInput || !password) {
      setError('Username / nama akun dan password wajib diisi.');
      return;
    }
    if (trimmedInput.length < 2 || trimmedInput.length > 50) {
      setError('Username atau nama akun harus antara 2-50 karakter.');
      return;
    }
    if (password.length > 128) {
      setError('Password maksimal 128 karakter.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, { username: trimmedInput, password, mfa_code: mfaCode || undefined }, { withCredentials: true, headers: { 'x-skip-auth-refresh': 'true' } });
      if (response.status === 202 || response.data?.requires_mfa) {
        setChallengeToken(response.data?.challenge_token || challengeToken);
        setError('Masukkan kode MFA 6 digit dari aplikasi authenticator.');
        return;
      }
      const { token, refresh_token: refreshToken, user } = response.data;

      await setStoredToken(token);
      await setStoredRefreshToken(refreshToken);

      const canonicalUsername = (user?.username || trimmedInput).toLowerCase();
      const deviceKeys = deriveKeyPairFromSeed(`ngopi:e2ee:v1:${canonicalUsername}:${password}`);

      if (Platform.OS === 'web') {
        localStorage.setItem('temp_key', password);
        localStorage.setItem('username', canonicalUsername);
        localStorage.setItem('userId', user.id);
        localStorage.setItem('private_key', deviceKeys.privateKey);
      } else {
        await SecureStore.setItemAsync('temp_key', password);
        await SecureStore.setItemAsync('username', canonicalUsername);
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
        <Text style={styles.subtitle}>{t('Selamat datang kembali.', 'Welcome back.')}</Text>

        {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder={t(
            'Username, Nomor Ngopi (0 / 101+), atau Email @ngopi.top',
            'Username, Ngopi Number (0 / 101+), or @ngopi.top Email'
          )}
          placeholderTextColor={coffee.muted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder={t('Kata Sandi', 'Password')}
            placeholderTextColor={coffee.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="off"
            textContentType="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Text style={{ color: coffee.secondary }}>
              {showPassword ? t('Sembunyikan', 'Hide') : t('Tampilkan', 'Show')}
            </Text>
          </TouchableOpacity>
        </View>

        {challengeToken ? (
          <TextInput
            style={styles.input}
            placeholder={t('Kode MFA 6 digit', '6-digit MFA Code')}
            placeholderTextColor={coffee.muted}
            value={mfaCode}
            onChangeText={setMfaCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        ) : null}

        <TouchableOpacity
          onPress={() => {
            setForgotIdentifier(username.trim());
            setForgotStep('request');
            setForgotError('');
            setForgotInfo('');
            setForgotVisible(true);
          }}
        >
          <Text style={styles.forgotPasswordText}>{t('Lupa Kata Sandi?', 'Forgot Password?')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={coffee.text} />
          ) : (
            <Text style={styles.buttonText}>{t('Masuk', 'Login')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('Belum punya akun?', "Don't have an account?")}</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.linkText}> {t('Daftar', 'Sign Up')}</Text>
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

      <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={[styles.card, { maxWidth: 420, width: '100%' }]}>
            <Text style={{ color: '#D4AF37', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>
              🔑 {t('Pemulihan Kata Sandi', 'Password Recovery')}
            </Text>
            <Text style={{ color: coffee.secondary, fontSize: 12, marginBottom: 14 }}>
              {t(
                'Pulihkan akun menggunakan Email @ngopi.top, Username, atau Nomor ID Ngopi Anda.',
                'Recover your account via @ngopi.top Email, Username, or Ngopi ID Number.'
              )}
            </Text>

            {forgotError ? <Text style={[styles.errorText, { marginBottom: 10 }]}>{forgotError}</Text> : null}
            {forgotInfo ? (
              <Text style={{ color: '#22C55E', fontSize: 12, marginBottom: 10, backgroundColor: 'rgba(34,197,94,0.1)', padding: 8, borderRadius: 8 }}>
                {forgotInfo}
              </Text>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder={t('Email @ngopi.top / Username / Nomor ID Ngopi', '@ngopi.top Email / Username / Ngopi ID')}
              placeholderTextColor={coffee.muted}
              value={forgotIdentifier}
              onChangeText={setForgotIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {forgotStep === 'reset' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={
                    hasRecoveryPin
                      ? t('PIN Pemulihan atau Kode OTP 6 digit', 'Recovery PIN or 6-digit OTP')
                      : t('Kode OTP 6 digit dari Inbox / Email', '6-digit OTP from Inbox / Email')
                  }
                  placeholderTextColor={coffee.muted}
                  value={forgotOtpOrPin}
                  onChangeText={setForgotOtpOrPin}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('Kata Sandi Baru (min. 8 karakter)', 'New Password (min. 8 chars)')}
                  placeholderTextColor={coffee.muted}
                  value={forgotNewPassword}
                  onChangeText={setForgotNewPassword}
                  secureTextEntry
                />
              </>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={[styles.button, { flex: 1, backgroundColor: '#261C15', borderWidth: 1, borderColor: '#4A3728' }]}
                onPress={() => setForgotVisible(false)}
              >
                <Text style={[styles.buttonText, { color: coffee.secondary }]}>{t('Batal', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { flex: 1.5 }]}
                onPress={forgotStep === 'request' ? handleRequestPasswordReset : handleConfirmPasswordReset}
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <ActivityIndicator color={coffee.text} />
                ) : (
                  <Text style={styles.buttonText}>
                    {forgotStep === 'request' ? t('Kirim Kode / Cek', 'Send Code / Next') : t('Reset Sandi', 'Reset Password')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    color: coffee.text,
    padding: 16,
    fontSize: 16,
  },
  eyeIcon: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexShrink: 0,
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
