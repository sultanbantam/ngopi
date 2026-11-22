import { Platform } from 'react-native';
import axios from 'axios';
import { API_URL } from './session';

interface PiSdkInstance {
  init: (config: { version: string; sandbox?: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound?: (payment: any) => void
  ) => Promise<{ accessToken: string; user: { uid: string; username: string } }>;
  createPayment: (
    paymentData: { amount: number; memo: string; metadata?: Record<string, any> },
    callbacks: {
      onReadyForServerApproval: (paymentId: string) => void;
      onReadyForServerCompletion: (paymentId: string, txid: string) => void;
      onCancel: (paymentId: string) => void;
      onError: (error: Error, payment?: any) => void;
    }
  ) => void;
}

const PI_SANDBOX = process.env.EXPO_PUBLIC_PI_SANDBOX !== 'false'; // Staging (Testnet / Sandbox) by default
let piInitPromise: Promise<void> | null = null;

/**
 * Detects whether the app is running inside Pi Browser or Pi Sandbox.
 * Always returns false on native Android/iOS (Play Store builds).
 */
export function isRunningInPiBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  const win = window as any;
  const ua = String(window.navigator?.userAgent || '').toLowerCase();
  const ref = String(typeof document !== 'undefined' ? document.referrer || '' : '').toLowerCase();
  const ancestor = String(window.location?.ancestorOrigins?.[0] || '').toLowerCase();

  const hasPiUaOrSandbox =
    ua.includes('pibrowser') ||
    ref.includes('minepi.com') ||
    ancestor.includes('minepi.com');

  const hasGlobalPi = typeof win.Pi !== 'undefined' && win.Pi !== null;
  return hasPiUaOrSandbox || hasGlobalPi;
}

/**
 * Official Pi SDK v2.0 async environment check:
 * Loads pi-sdk.js on Web, initializes Pi, and checks Pi.nativeFeaturesList()
 * with a short timeout so normal browsers (Chrome/Safari) resolve false quickly
 * while Pi Browser / Pi Sandbox resolves true.
 */
export async function detectPiBrowserAsync(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  if (isRunningInPiBrowser()) {
    try {
      await ensurePiSdk();
    } catch {}
    return true;
  }
  try {
    const pi = (await ensurePiSdk()) as any;
    if (typeof pi.nativeFeaturesList === 'function') {
      const features = await Promise.race([
        pi.nativeFeaturesList(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 900)),
      ]);
      if (Array.isArray(features)) {
        return true;
      }
    }
  } catch {
    // Not in Pi Browser
  }
  return false;
}

export async function ensurePiSdk(): Promise<PiSdkInstance> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new Error('Pi Network SDK hanya tersedia di Web / Pi Browser.');
  }

  if (!(window as any).Pi) {
    if (!piInitPromise) {
      piInitPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[src*="sdk.minepi.com/pi-sdk.js"]');
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Gagal memuat Pi SDK.')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://sdk.minepi.com/pi-sdk.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Gagal memuat Pi SDK.'));
        document.head.appendChild(script);
      });
    }
    await piInitPromise;
  }

  const pi = (window as any).Pi as PiSdkInstance | undefined;
  if (!pi) {
    throw new Error('Pi SDK belum siap. Pastikan dibuka melalui Pi Browser atau Pi Sandbox.');
  }

  pi.init({ version: '2.0', sandbox: PI_SANDBOX });
  return pi;
}

const handleIncompletePayment = async (payment: any) => {
  try {
    const paymentId = payment?.identifier;
    const txid = payment?.transaction?.txid;
    if (paymentId && txid) {
      await axios.post(`${API_URL}/payments/complete`, { paymentId, txid });
    }
  } catch (e) {
    console.warn('[PiSDK] Incomplete payment recovery error:', e);
  }
};

export async function authenticateWithPi() {
  const Pi = await ensurePiSdk();
  const authResult = await Pi.authenticate(['username', 'payments'], handleIncompletePayment);
  return authResult;
}

export async function payWithPi(params: {
  amount: number;
  memo: string;
  metadata?: Record<string, any>;
  onStatus?: (status: string) => void;
}): Promise<{ paymentId: string; txid: string; newBalance?: number; pointsCredited?: number }> {
  const { amount, memo, metadata, onStatus } = params;
  onStatus?.('Menghubungkan ke Pi Network...');
  const Pi = await ensurePiSdk();

  onStatus?.('Meminta otorisasi Pi Wallet...');
  await Pi.authenticate(['username', 'payments'], handleIncompletePayment);

  return new Promise((resolve, reject) => {
    onStatus?.('Membuat transaksi Pi...');
    Pi.createPayment(
      { amount, memo, metadata: metadata || {} },
      {
        onReadyForServerApproval: async (paymentId: string) => {
          onStatus?.('Menyetujui transaksi di server Ngopi...');
          try {
            await axios.post(`${API_URL}/payments/approve`, { paymentId }, { timeout: 12000 });
          } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || 'Server approval gagal.';
            onStatus?.(`Gagal Approve: ${msg}`);
            reject(new Error(msg));
          }
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          onStatus?.('Menyelesaikan transaksi & mengkreditkan Poin Ngopi...');
          try {
            const res = await axios.post(`${API_URL}/payments/complete`, {
              paymentId,
              txid,
              userId: metadata?.userId,
              username: metadata?.username,
            });
            resolve({
              paymentId,
              txid,
              newBalance: res.data?.new_balance,
              pointsCredited: res.data?.points_credited,
            });
          } catch (err: any) {
            reject(new Error(err?.response?.data?.error || 'Server completion gagal.'));
          }
        },
        onCancel: () => {
          reject(new Error('Pembayaran Pi dibatalkan oleh pengguna.'));
        },
        onError: (error: Error) => {
          reject(error || new Error('Terjadi kesalahan pada pembayaran Pi.'));
        },
      }
    );
  });
}
