import { router } from 'expo-router';
import * as storage from './storage';

const reserved = new Set(['login', 'register', 'contacts', 'warkop', 'bambupedia', 'chat', 'admin', 'help-center', 'privacy', 'terms', 'test-payment', 'index', 'api']);
export const profileSlug = (name: string): string => {
  const slug = name.normalize('NFKC').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'pengguna';
  return reserved.has(slug) ? `${slug}-profil` : slug;
};
export const rememberProfile = (slug: string) => storage.setItemAsync('ngopi.pending-profile', slug);
export const afterProfileLogin = async () => {
  const slug = await storage.getItemAsync('ngopi.pending-profile');
  await storage.deleteItemAsync('ngopi.pending-profile');
  if (slug) router.replace({ pathname: '/[profile]', params: { profile: profileSlug(slug) } });
  else router.replace('/(main)/warkop');
};
