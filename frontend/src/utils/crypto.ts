import CryptoJS from 'crypto-js';

// Derive a secret key from password
const getKey = (secret: string) => {
  return CryptoJS.SHA256(secret).toString();
};

export const encryptMessage = (message: string, secret: string): string => {
  const key = getKey(secret);
  const encrypted = CryptoJS.AES.encrypt(message, key).toString();
  return encrypted;
};

export const decryptMessage = (ciphertext: string, secret: string): string => {
  try {
    const key = getKey(secret);
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || "*(Pesan tidak bisa didekripsi)*";
  } catch (e) {
    return "*(Gagal mendekripsi)*";
  }
};
