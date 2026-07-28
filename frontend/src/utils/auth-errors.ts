type ApiErrorDetail = { field?: string; message?: string };

export const explainAuthError = (error: any, action: 'login' | 'register') => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const details = Array.isArray(data?.details) ? data.details as ApiErrorDetail[] : [];
  const firstField = details[0]?.field;
  const rawMessage = String(details[0]?.message || data?.error || '').toLowerCase();

  if (!error?.response) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet, lalu coba lagi.';
  }
  if (status === 429) {
    return 'Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba kembali.';
  }
  if (status >= 500) {
    return 'Server sedang mengalami gangguan. Akun kamu tidak berubah; silakan coba lagi beberapa saat lagi.';
  }
  if (action === 'login' && status === 401) {
    return 'Username atau password tidak cocok. Periksa ejaan username dan pastikan password benar.';
  }
  if (action === 'register' && status === 409) {
    return 'Username sudah digunakan. Pilih username lain atau masuk melalui halaman Login.';
  }
  if (firstField === 'mfa_code' || rawMessage.includes('mfa')) {
    return 'Kode MFA harus berisi 6 angka dari aplikasi authenticator.';
  }
  if (firstField === 'password' || rawMessage.includes('password')) {
    return action === 'register' ? 'Password minimal 8 karakter dan maksimal 128 karakter.' : 'Password wajib diisi.';
  }
  if (firstField === 'username' || rawMessage.includes('username')) {
    return 'Username harus 3-30 karakter: huruf kecil, angka, titik, garis bawah, atau tanda minus.';
  }
  if (firstField === 'display_name' || rawMessage.includes('display_name')) {
    return 'Nama tampilan wajib diisi dan maksimal 50 karakter.';
  }
  if (firstField === 'public_key' || rawMessage.includes('public_key')) {
    return 'Kunci keamanan perangkat gagal dibuat. Muat ulang halaman lalu coba mendaftar kembali.';
  }

  return action === 'login'
    ? 'Login gagal. Periksa data akun dan coba kembali.'
    : 'Pendaftaran gagal. Periksa kembali semua data lalu coba lagi.';
};
