import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';
import * as SecureStore from './storage';

export type DeviceKeyPair = {
  publicKey: string;
  privateKey: string;
};

export const NACL_SECRET_PREFIX = 'nacl:';
export const NACL_MESSAGE_PREFIX = 'nacl:v1:';

export const generateDeviceKeyPair = (): DeviceKeyPair => {
  const pair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(pair.publicKey),
    privateKey: encodeBase64(pair.secretKey),
  };
};

export const deriveKeyPairFromSeed = (seedString: string): DeviceKeyPair => {
  const hash = CryptoJS.SHA256(seedString);
  const hashHex = hash.toString(CryptoJS.enc.Hex);
  const secretKey = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    secretKey[i] = parseInt(hashHex.substring(i * 2, i * 2 + 2), 16);
  }
  const pair = nacl.box.keyPair.fromSecretKey(secretKey);
  return {
    publicKey: encodeBase64(pair.publicKey),
    privateKey: encodeBase64(pair.secretKey),
  };
};

export const getOrEnsureDeviceKeyPair = async (): Promise<DeviceKeyPair> => {
  let privateKey = '';
  let storedUsername = '';
  let tempKey = '';
  let userId = '';

  if (Platform.OS === 'web') {
    privateKey = localStorage.getItem('private_key') || '';
    storedUsername = localStorage.getItem('username') || '';
    tempKey = localStorage.getItem('temp_key') || '';
    userId = localStorage.getItem('userId') || '';
  } else {
    privateKey = (await SecureStore.getItemAsync('private_key')) || '';
    storedUsername = (await SecureStore.getItemAsync('username')) || '';
    tempKey = (await SecureStore.getItemAsync('temp_key')) || '';
    userId = (await SecureStore.getItemAsync('userId')) || '';
  }

  if (privateKey) {
    try {
      const privBytes = decodeBase64(privateKey);
      if (privBytes.length === nacl.box.secretKeyLength) {
        const pair = nacl.box.keyPair.fromSecretKey(privBytes);
        return {
          publicKey: encodeBase64(pair.publicKey),
          privateKey,
        };
      }
    } catch {}
  }

  let keyPair: DeviceKeyPair;
  if (storedUsername && tempKey) {
    keyPair = deriveKeyPairFromSeed(`ngopi:e2ee:v1:${storedUsername}:${tempKey}`);
  } else if (userId) {
    keyPair = deriveKeyPairFromSeed(`ngopi:e2ee:v1:user:${userId}`);
  } else {
    keyPair = generateDeviceKeyPair();
  }

  if (Platform.OS === 'web') {
    localStorage.setItem('private_key', keyPair.privateKey);
  } else {
    await SecureStore.setItemAsync('private_key', keyPair.privateKey);
  }

  return keyPair;
};

export const isValidPublicKey = (publicKey?: string | null) => {
  if (!publicKey || publicKey === 'TEMP_PUB_KEY') return false;
  try {
    return decodeBase64(publicKey).length === nacl.box.publicKeyLength;
  } catch {
    return false;
  }
};

export const deriveSharedSecret = (privateKey: string, peerPublicKey: string) => {
  const privateKeyBytes = decodeBase64(privateKey);
  const publicKeyBytes = decodeBase64(peerPublicKey);
  if (privateKeyBytes.length !== nacl.box.secretKeyLength || publicKeyBytes.length !== nacl.box.publicKeyLength) {
    throw new Error('Invalid X25519 key material');
  }
  return encodeBase64(nacl.scalarMult(privateKeyBytes, publicKeyBytes));
};

const getSecretboxKey = (sharedSecret: string) => {
  const secret = sharedSecret.startsWith(NACL_SECRET_PREFIX) ? sharedSecret.slice(NACL_SECRET_PREFIX.length) : sharedSecret;
  const key = decodeBase64(secret);
  if (key.length !== nacl.secretbox.keyLength) throw new Error('Invalid shared secret length');
  return key;
};

export const encryptWithSharedSecret = (message: string, sharedSecret: string) => {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(decodeUTF8(message), nonce, getSecretboxKey(sharedSecret));
  return `${NACL_MESSAGE_PREFIX}${encodeBase64(nonce)}:${encodeBase64(box)}`;
};

export const decryptWithSharedSecret = (ciphertext: string, sharedSecret: string) => {
  if (!ciphertext.startsWith(NACL_MESSAGE_PREFIX)) return ciphertext;
  const payload = ciphertext.slice(NACL_MESSAGE_PREFIX.length);
  const [nonceRaw, boxRaw] = payload.split(':');
  if (!nonceRaw || !boxRaw) throw new Error('Invalid encrypted message');
  const opened = nacl.secretbox.open(decodeBase64(boxRaw), decodeBase64(nonceRaw), getSecretboxKey(sharedSecret));
  if (!opened) throw new Error('Unable to decrypt message');
  return encodeUTF8(opened);
};