import { generateSecret, generateURI, verifySync } from 'otplib';
import { EncryptionService } from './encryption.service';

export const MFA_ISSUER = process.env.MFA_ISSUER || 'BambooChat';

export const generateMfaSecret = () => generateSecret({ length: 20 });

export const getOtpAuthUrl = (username: string, secret: string) => generateURI({ issuer: MFA_ISSUER, label: username, secret, strategy: 'totp', digits: 6, period: 30 });

export const encryptMfaSecret = (secret: string) => EncryptionService.encryptString(secret) as string;

export const decryptMfaSecret = (encryptedSecret?: string | null) => {
  if (!encryptedSecret) return null;
  return EncryptionService.decryptStringSafe(encryptedSecret);
};

export const verifyMfaCode = (encryptedSecret: string | null | undefined, token: string) => {
  const secret = decryptMfaSecret(encryptedSecret);
  if (!secret || !token) return false;
  const result = verifySync({ secret, token: token.replace(/\s+/g, ''), strategy: 'totp', digits: 6, period: 30 });
  return typeof result === 'boolean' ? result : Boolean((result as any).valid ?? result);
};