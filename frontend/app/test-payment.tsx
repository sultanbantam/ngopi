import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

declare global {
  interface Window {
    Pi: any;
    __piInitialized?: boolean;
  }
}

export default function TestPaymentScreen() {
  const [loading, setLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [isSandbox, setIsSandbox] = useState(true);

  useEffect(() => {
    let useSandbox = true;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('sandbox') === 'false') {
        useSandbox = false;
      }
      setIsSandbox(useSandbox);

      if (window.Pi) {
        setSdkLoaded(true);
        if (!window.__piInitialized) {
          window.Pi.init({ version: '2.0', sandbox: useSandbox });
          window.__piInitialized = true;
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.minepi.com/pi-sdk.js';
      script.onload = () => {
        setSdkLoaded(true);
        if (window.Pi && !window.__piInitialized) {
          window.Pi.init({ version: '2.0', sandbox: useSandbox });
          window.__piInitialized = true;
        }
      };
      document.body.appendChild(script);
    }
  }, []);

  const handlePayment = async () => {
    if (!window.Pi) {
      setMessage('Pi SDK is not loaded yet.');
      return;
    }

    setLoading(true);
    setMessage('Authenticating...');

    try {
      // Authenticate first
      await window.Pi.authenticate(['username', 'payments'], (payment: any) => {
        console.log('Incomplete payment found', payment);
      });

      setMessage('Initiating payment...');

      const paymentData = {
        amount: 1, // 1 Test-Pi
        memo: 'Test transaction for BambooChat Developer Portal step 10',
        metadata: { type: 'test' },
      };

      const callbacks = {
        onReadyForServerApproval: async (paymentId: string) => {
          console.log('onReadyForServerApproval:', paymentId);
          try {
            await axios.post('https://api.bamboochat.click/api/payments/approve', { paymentId });
          } catch (err) {
            console.error('Approval failed:', err);
            setMessage('Backend failed to approve payment.');
          }
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          console.log('onReadyForServerCompletion:', paymentId, txid);
          try {
            await axios.post('https://api.bamboochat.click/api/payments/complete', { paymentId, txid });
            setMessage('Payment Completed Successfully! ✅');
          } catch (err) {
            console.error('Completion failed:', err);
            setMessage('Backend failed to complete payment.');
          }
        },
        onCancel: (paymentId: string) => {
          console.log('onCancel:', paymentId);
          setMessage('Payment Cancelled by user.');
          setLoading(false);
        },
        onError: (error: any, payment: any) => {
          console.error('onError:', error);
          setMessage('An error occurred during payment.');
          setLoading(false);
        },
      };

      window.Pi.createPayment(paymentData, callbacks);
    } catch (error: any) {
      console.error(error);
      const isAuthFailed = error.message === 'Authentication failed.' || error === 'Authentication failed.';
      
      if (isAuthFailed) {
        setMessage('GAGAL (Auth Failed). Kemungkinan penyebab:\\n1. Segitiga Kuning ⚠️: Anda harus ketik pi://bamboochat.click di kotak atas.\\n2. Salah Mode: Coba ganti ke Mode Production (tombol biru) jika Sandbox gagal.\\n3. Belum Testnet: Pastikan HP ini login dengan akun Developer aplikasi.');
      } else {
        setMessage(`Failed to initiate: ${error.message || 'Unknown error'}`);
      }
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Test Payment</Text>
      </View>

      <View style={styles.content}>
        <Ionicons name="wallet-outline" size={80} color="#10B981" style={styles.icon} />
        <Text style={styles.title}>Developer Test Payment</Text>
        <Text style={styles.description}>
          Klik tombol di bawah ini untuk mensimulasikan transaksi 1 Pi (Testnet) agar langkah ke-10 di Pi Developer Portal tercapai.
        </Text>

        {!sdkLoaded ? (
          <ActivityIndicator size="large" color="#10B981" />
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled, { marginBottom: 15 }]} 
              onPress={handlePayment}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Memproses...' : `Bayar 1 Pi (${isSandbox ? 'Testnet/Sandbox' : 'Mainnet/Production'})`}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#3B82F6' }]} 
              onPress={() => {
                const newSandbox = !isSandbox;
                window.location.href = `/test-payment?sandbox=${newSandbox}`;
              }}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Ganti ke Mode {isSandbox ? 'Production (Mainnet)' : 'Sandbox (Testnet)'}</Text>
            </TouchableOpacity>
          </>
        )}

        {message ? (
          <Text style={[styles.message, { marginTop: 30 }]}>{message}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#1E293B',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#059669',
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  message: {
    marginTop: 20,
    fontSize: 16,
    color: '#FCD34D',
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});
