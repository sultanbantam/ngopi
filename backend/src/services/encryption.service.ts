import crypto from 'crypto';

const ENCRYPTION_PREFIX = 'enc:v1';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const decodeConfiguredKey = (rawKey: string) => {
  const trimmed = rawKey.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return Buffer.from(trimmed, 'hex');

  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === KEY_LENGTH) return base64;

  const utf8 = Buffer.from(trimmed, 'utf8');
  if (utf8.length === KEY_LENGTH) return utf8;

  return crypto.createHash('sha256').update(trimmed).digest();
};

const getMasterKey = () => {
  const configuredKey = process.env.ENCRYPTION_KEY;
  if (configuredKey) return decodeConfiguredKey(configuredKey);

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY is required in production');
  }

  // Development fallback keeps local environments usable, but production must provide ENCRYPTION_KEY.
  return crypto.createHash('sha256').update(process.env.JWT_SECRET || 'dev-only-bamboochat-key').digest();
};

export class EncryptionService {
  static isEncrypted(value?: string | null) {
    return typeof value === 'string' && value.startsWith(`${ENCRYPTION_PREFIX}:`);
  }

  static encryptString(plaintext?: string | null): string | null {
    if (plaintext === undefined || plaintext === null) return null;
    if (EncryptionService.isEncrypted(plaintext)) return plaintext;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [ENCRYPTION_PREFIX, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
  }

  static decryptString(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    if (!EncryptionService.isEncrypted(value)) return value;

    const [, , ivRaw, tagRaw, ciphertextRaw] = value.split(':');
    if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Invalid encrypted payload format');

    const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), Buffer.from(ivRaw, 'base64url'), { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
  }

  static decryptStringSafe(value?: string | null): string | null {
    try {
      return EncryptionService.decryptString(value);
    } catch (error) {
      console.error('Failed to decrypt protected field:', error);
      return null;
    }
  }
}