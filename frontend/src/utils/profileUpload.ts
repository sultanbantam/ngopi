import axios from 'axios';
import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { API_URL } from './api';

export async function uploadProfileAvatar(uri: string, asset: ImagePickerAsset | null, headers: Record<string, string>): Promise<string> {
  if (!uri || /^https?:\/\//i.test(uri)) return uri;
  if (uri.startsWith('/uploads/')) return `${API_URL.replace(/\/api$/, '')}${uri}`;
  if (!/^(blob:|data:image\/|file:|content:)/i.test(uri)) throw new Error('Format foto tidak dikenali. Pilih ulang foto.');
  const data = new FormData();
  if (Platform.OS === 'web') {
    const file = asset?.file || await (await fetch(uri)).blob();
    if (!file.size) throw new Error('Foto kosong. Pilih ulang foto.');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    data.append('file', file, asset?.fileName || `avatar.${ext}`);
  } else {
    data.append('file', { uri, name: asset?.fileName || 'avatar.jpg', type: asset?.mimeType || 'image/jpeg' } as any);
  }
  // Axios/browser supplies the multipart boundary; do not hardcode it.
  const response = await axios.post(`${API_URL}/upload`, data, { headers });
  const url = response.data?.url;
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('Server belum mengembalikan alamat foto. Coba lagi.');
  return url;
}

export function profileSaveError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 413) return 'Foto terlalu besar untuk server. Pilih foto yang lebih kecil.';
    if (error.response?.status === 401) return 'Sesi berakhir. Silakan login kembali.';
    const reason = error.response?.data?.error;
    if (typeof reason === 'string') return `Profil belum tersimpan: ${reason}`;
    if (!error.response) return 'Koneksi atau unggah foto gagal. Coba simpan tanpa mengganti foto, lalu pilih ulang foto.';
    return `Profil belum tersimpan (HTTP ${error.response.status}). Coba lagi.`;
  }
  return error instanceof Error ? error.message : 'Profil belum tersimpan. Coba lagi.';
}
