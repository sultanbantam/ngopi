import React, { useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import axios from 'axios';
import { API_URL } from '../../utils/api';

export default function MFASetup() {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await axios.post(`${API_URL}/auth/mfa/setup`, {}, { withCredentials: true });
      setQrCodeDataUrl(response.data.qr_code_data_url || '');
      setOtpAuthUrl(response.data.otpauth_url || '');
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Gagal memulai MFA.');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    setLoading(true);
    setMessage('');
    try {
      await axios.post(`${API_URL}/auth/mfa/verify`, { code }, { withCredentials: true });
      setMessage('MFA berhasil diaktifkan.');
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Kode MFA tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <TouchableOpacity onPress={startSetup} disabled={loading} style={{ backgroundColor: '#10B981', padding: 12, borderRadius: 8 }}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Aktifkan MFA</Text>}
      </TouchableOpacity>
      {qrCodeDataUrl ? <Image source={{ uri: qrCodeDataUrl }} style={{ width: 220, height: 220 }} /> : null}
      {otpAuthUrl ? <Text selectable style={{ color: '#94A3B8' }}>{otpAuthUrl}</Text> : null}
      {qrCodeDataUrl ? (
        <>
          <TextInput value={code} onChangeText={setCode} placeholder="Kode 6 digit" keyboardType="number-pad" maxLength={6} />
          <TouchableOpacity onPress={verifySetup} disabled={loading || code.length !== 6} style={{ backgroundColor: '#0EA5E9', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Verifikasi MFA</Text>
          </TouchableOpacity>
        </>
      ) : null}
      {message ? <Text>{message}</Text> : null}
    </View>
  );
}