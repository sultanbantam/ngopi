import CryptoJS from 'crypto-js';
import { decryptWithSharedSecret, encryptWithSharedSecret, NACL_MESSAGE_PREFIX, NACL_SECRET_PREFIX } from './e2ee';

const getKey = (secret: string) => CryptoJS.SHA256(secret).toString();

export const encryptMessage = (message: string, secret: string): string => {
  if (secret.startsWith(NACL_SECRET_PREFIX)) return encryptWithSharedSecret(message, secret);
  const key = getKey(secret);
  return CryptoJS.AES.encrypt(message, key).toString();
};

export const decryptMessage = (ciphertext: string, secret: string, fallbackSecret?: string): string => {
  try {
    if (ciphertext.startsWith(NACL_MESSAGE_PREFIX)) {
      if (secret && secret.startsWith(NACL_SECRET_PREFIX)) {
        try {
          return decryptWithSharedSecret(ciphertext, secret);
        } catch (err) {
          // If primary sharedSecret failed, try fallbackSecret if it has NACL prefix
          if (fallbackSecret && fallbackSecret.startsWith(NACL_SECRET_PREFIX) && fallbackSecret !== secret) {
            try {
              return decryptWithSharedSecret(ciphertext, fallbackSecret);
            } catch {}
          }
        }
      }
      return '*(Pesan tidak bisa didekripsi - kunci perangkat belum cocok)*';
    }

    const effectiveSecret = (secret.startsWith(NACL_SECRET_PREFIX) && fallbackSecret) ? fallbackSecret : secret;
    const key = getKey(effectiveSecret);
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || '*(Pesan tidak bisa didekripsi)*';
  } catch (e) {
    return '*(Gagal mendekripsi)*';
  }
};