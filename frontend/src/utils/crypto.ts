import CryptoJS from 'crypto-js';
import { decryptWithSharedSecret, encryptWithSharedSecret, NACL_MESSAGE_PREFIX, NACL_SECRET_PREFIX } from './e2ee';

const getKey = (secret: string) => CryptoJS.SHA256(secret).toString();

export const encryptMessage = (message: string, secret: string): string => {
  if (secret.startsWith(NACL_SECRET_PREFIX)) return encryptWithSharedSecret(message, secret);
  const key = getKey(secret);
  return CryptoJS.AES.encrypt(message, key).toString();
};

const tryAes = (ct: string, rawSec?: string): string | null => {
  if (!rawSec) return null;
  try {
    const s = rawSec.startsWith(NACL_SECRET_PREFIX) ? rawSec.slice(NACL_SECRET_PREFIX.length) : rawSec;
    const key = getKey(s);
    const bytes = CryptoJS.AES.decrypt(ct, key);
    const text = bytes.toString(CryptoJS.enc.Utf8);
    return text || null;
  } catch {
    return null;
  }
};

export const decryptMessage = (ciphertext: string, secret: string, fallbackSecret?: string): string => {
  try {
    if (ciphertext.startsWith(NACL_MESSAGE_PREFIX)) {
      const candidates = [secret, fallbackSecret].filter(Boolean) as string[];
      for (const candidate of candidates) {
        if (!candidate || !candidate.startsWith(NACL_SECRET_PREFIX)) continue;
        try {
          const res = decryptWithSharedSecret(ciphertext, candidate);
          if (res && !res.startsWith(NACL_MESSAGE_PREFIX)) return res;
        } catch {}
      }
      return '*(Pesan tidak bisa didekripsi - kunci perangkat belum cocok)*';
    }

    const effectiveSecret = (secret.startsWith(NACL_SECRET_PREFIX) && fallbackSecret) ? fallbackSecret : secret;
    const res1 = tryAes(ciphertext, effectiveSecret);
    if (res1) return res1;

    if (fallbackSecret && fallbackSecret !== effectiveSecret) {
      const res2 = tryAes(ciphertext, fallbackSecret);
      if (res2) return res2;
    }

    if (secret && secret !== effectiveSecret) {
      const res3 = tryAes(ciphertext, secret);
      if (res3) return res3;
    }

    return '*(Gagal mendekripsi)*';
  } catch (e) {
    return '*(Gagal mendekripsi)*';
  }
};