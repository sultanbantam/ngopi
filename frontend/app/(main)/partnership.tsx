import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { coffee as baseCoffee } from '../../src/theme/coffee';
import { getAuthHeaders } from '../../src/utils/api';
import { socketService } from '../../src/utils/socket';
import { getValidAccessToken } from '../../src/utils/session';
import * as SecureStore from '../../src/utils/storage';

const coffee = {
  ...baseCoffee,
  cream: baseCoffee.text,
  textSecondary: baseCoffee.secondary,
  primary: baseCoffee.accent,
};

const API_BASE = 'https://api.ngopi.top/api';

export default function PartnershipPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [hasAgreement, setHasAgreement] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [agreementData, setAgreementData] = useState<any>(null);

  // Form states
  const [ownerName, setOwnerName] = useState('');
  const [cafeName, setCafeName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [commercialModel, setCommercialModel] = useState<'model_a' | 'model_b'>('model_a');
  const [agreedCheckbox, setAgreedCheckbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Verification Pop-up Modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationPayload, setVerificationPayload] = useState<any>(null);
  const [signing, setSigning] = useState(false);

  // Success state
  const [verifiedSuccess, setVerifiedSuccess] = useState<any>(null);

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    try {
      setLoadingStatus(true);
      const token = await getValidAccessToken();
      let uName = '';
      let uId = '';
      if (Platform.OS === 'web') {
        uName = localStorage.getItem('username') || '';
        uId = localStorage.getItem('userId') || '';
      } else {
        uName = (await SecureStore.getItemAsync('username')) || '';
        uId = (await SecureStore.getItemAsync('userId')) || '';
      }

      if (token && (uName || uId)) {
        const userObj = { id: uId, username: uName, display_name: uName };
        setCurrentUser(userObj);
        setOwnerName(uName);
      }

      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_BASE}/partnership/status`, { headers });
      if (res.data?.success) {
        if (res.data.has_agreement && res.data.agreement) {
          setHasAgreement(true);
          setIsAgreed(Boolean(res.data.is_agreed));
          setAgreementData(res.data.agreement);
          setCafeName(res.data.agreement.cafe_name || '');
          setAddress(res.data.agreement.address || '');
          setPhone(res.data.agreement.phone || '');
          setCommercialModel(res.data.agreement.commercial_model || 'model_a');
        }
      }
    } catch (err) {
      console.warn('[Partnership] Status fetch error:', err);
    } finally {
      setLoadingStatus(false);
    }

    // Connect WebSocket and listen for real-time verification event
    try {
      const socket = await socketService.connect();
      if (socket) {
        socket.on('partnership:request_verification', (data: any) => {
          setVerificationPayload(data);
          setShowVerifyModal(true);
        });

        socket.on('partnership:verified', (data: any) => {
          setShowVerifyModal(false);
          setVerifiedSuccess(data);
          setIsAgreed(true);
          setHasAgreement(true);
        });
      }
    } catch (sockErr) {
      console.warn('[Partnership] Socket connection error:', sockErr);
    }
  };

  const handleSubmitMoU = async () => {
    if (!ownerName.trim()) {
      Alert.alert('Perhatian', 'Nama pemilik cafe wajib diisi.');
      return;
    }
    if (!cafeName.trim()) {
      Alert.alert('Perhatian', 'Nama cafe/warkop wajib diisi.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Perhatian', 'Alamat lengkap cafe wajib diisi.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Perhatian', 'Nomor telepon/WhatsApp wajib diisi.');
      return;
    }
    if (!agreedCheckbox) {
      Alert.alert('Perhatian', 'Silakan centang persetujuan Syarat & Ketentuan Kemitraan terlebih dahulu.');
      return;
    }

    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_BASE}/partnership/submit`,
        {
          owner_name: ownerName.trim(),
          cafe_name: cafeName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          commercial_model: commercialModel,
        },
        { headers }
      );

      if (res.data?.success) {
        setAgreementData(res.data.agreement);
        setVerificationPayload({
          cafe_name: cafeName.trim(),
          owner_name: ownerName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          commercial_model: commercialModel,
          username: currentUser?.username || 'Anda',
        });
        setShowVerifyModal(true);
      } else {
        Alert.alert('Gagal', res.data?.error || 'Gagal mengajukan kerja sama.');
      }
    } catch (err: any) {
      console.error('[Partnership] Submit error:', err);
      Alert.alert('Error', err?.response?.data?.error || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndSign = async () => {
    try {
      setSigning(true);
      const headers = await getAuthHeaders();
      const res = await axios.post(`${API_BASE}/partnership/verify-sign`, {}, { headers });

      if (res.data?.success) {
        setShowVerifyModal(false);
        setVerifiedSuccess(res.data);
        setIsAgreed(true);
        setHasAgreement(true);
        setAgreementData(res.data.agreement);
        Alert.alert(
          '🎉 Kerja Sama Berhasil Disepakati!',
          `Selamat! Kemitraan resmi untuk "${res.data.agreement?.cafe_name}" telah aktif. QR Code meja Anda siap dicetak.`
        );
      } else {
        Alert.alert('Gagal', res.data?.error || 'Gagal menandatangani MoU.');
      }
    } catch (err: any) {
      console.error('[Partnership] Signing error:', err);
      Alert.alert('Error', err?.response?.data?.error || 'Gagal memproses tanda tangan digital.');
    } finally {
      setSigning(false);
    }
  };

  if (loadingStatus) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={coffee.accent} />
        <Text style={styles.loadingText}>Memeriksa status kemitraan warkop...</Text>
      </View>
    );
  }

  // If user is not logged in
  if (!currentUser) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={coffee.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kemitraan Cafe & Warkop</Text>
        </View>

        <View style={[styles.content, styles.center, { padding: 24 }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="cafe" size={54} color={coffee.accent} />
          </View>
          <Text style={styles.heroTitle}>Kemitraan Digital Ngopi</Text>
          <Text style={styles.heroDesc}>
            Jadikan cafe atau warkop Anda sebagai titik kumpul digital resmi. Dapatkan QR Code Check-in meja, bonus 50
            Poin Ngopi untuk pelanggan, turnamen komunitas, serta akses eksklusif Merchant Dashboard.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login' as any)}>
            <Ionicons name="log-in-outline" size={20} color={coffee.buttonText} />
            <Text style={styles.primaryBtnText}>Login untuk Menandatangani MoU</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // View for already verified & agreed partner
  if (isAgreed && agreementData) {
    const qrUrl = verifiedSuccess?.qr_image_url || agreementData.qr_image_url;
    const qrToken = verifiedSuccess?.qr_token || agreementData.qr_token;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={coffee.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mitra Resmi Cafe</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollPad}>
          <View style={styles.verifiedBadgeCard}>
            <View style={styles.badgeRow}>
              <View style={styles.badgeIcon}>
                <Ionicons name="checkmark-circle" size={28} color="#FFD700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifiedBadgeTitle}>Mitra Resmi Ngopi x Warkop</Text>
                <Text style={styles.verifiedBadgeSub}>MoU Digital Telah Ditandatangani & Sah</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama Cafe</Text>
              <Text style={styles.infoValue}>{agreementData.cafe_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pemilik Akun</Text>
              <Text style={styles.infoValue}>@{currentUser.username}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Alamat Fisik</Text>
              <Text style={styles.infoValue}>{agreementData.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Kontak WhatsApp</Text>
              <Text style={styles.infoValue}>{agreementData.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Model Kemitraan</Text>
              <Text style={[styles.infoValue, { color: coffee.accent }]}>
                {agreementData.commercial_model === 'model_b' ? 'Model B (Bagi Hasil 5%)' : 'Model A (Gratis / Trial)'}
              </Text>
            </View>
            {agreementData.signed_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Waktu Tanda Tangan</Text>
                <Text style={styles.infoValue}>
                  {new Date(agreementData.signed_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* QR Code Section */}
          <View style={styles.qrCard}>
            <Text style={styles.qrCardTitle}>QR Code Check-in Meja Cafe</Text>
            <Text style={styles.qrCardSub}>
              Cetak dan tempelkan QR Code ini di meja pengunjung cafe. Setiap scan (maks 1x sehari) memberikan 50 Poin
              Ngopi untuk pelanggan.
            </Text>

            {qrUrl ? (
              <View style={styles.qrImageContainer}>
                <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                <Text style={styles.qrTokenText}>Token: {qrToken}</Text>
              </View>
            ) : (
              <ActivityIndicator color={coffee.accent} style={{ marginVertical: 20 }} />
            )}

            <View style={styles.qrActions}>
              {qrUrl && Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.outlineBtn}
                  onPress={() => {
                    const win = window.open(qrUrl, '_blank');
                    win?.focus();
                  }}
                >
                  <Ionicons name="download-outline" size={18} color={coffee.accent} />
                  <Text style={styles.outlineBtnText}>Buka / Unduh File QR PNG</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push('/(main)/merchant' as any)}
              >
                <Ionicons name="stats-chart" size={18} color={coffee.buttonText} />
                <Text style={styles.primaryBtnText}>Buka Merchant Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Registration & MoU signing form
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={coffee.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kerja Sama Kemitraan Cafe</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollPad}>
        {/* Banner Intro */}
        <View style={styles.introCard}>
          <Ionicons name="document-text" size={32} color={coffee.accent} />
          <Text style={styles.introTitle}>Perjanjian Kerja Sama Kemitraan Digital</Text>
          <Text style={styles.introSub}>
            Gabungkan cafe fisik Anda dengan ekosistem digital Ngopi. Raih pelanggan baru, integrasikan QR check-in
            meja, dan adakan turnamen seru di warung Anda!
          </Text>
        </View>

        {/* Section 1: Form Data */}
        <View style={styles.formSection}>
          <Text style={styles.sectionHeading}>1. Data Pemilik & Lokasi Cafe</Text>

          <Text style={styles.inputLabel}>Nama Pemilik Cafe</Text>
          <TextInput
            style={styles.input}
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="Contoh: Budi Santoso"
            placeholderTextColor={coffee.muted}
          />

          <Text style={styles.inputLabel}>Nama Cafe / Warkop</Text>
          <TextInput
            style={styles.input}
            value={cafeName}
            onChangeText={setCafeName}
            placeholder="Contoh: Kopi Kenangan Senja"
            placeholderTextColor={coffee.muted}
          />

          <Text style={styles.inputLabel}>Alamat Lengkap Cafe</Text>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
            value={address}
            onChangeText={setAddress}
            placeholder="Alamat fisik cafe yang akan menjadi check-in point..."
            placeholderTextColor={coffee.muted}
            multiline
          />

          <Text style={styles.inputLabel}>Nomor WhatsApp / Telepon</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Contoh: 0812-3456-7890"
            placeholderTextColor={coffee.muted}
            keyboardType="phone-pad"
          />

          <Text style={styles.inputLabel}>Pilihan Skema Komersial</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[styles.radioCard, commercialModel === 'model_a' && styles.radioCardActive]}
              onPress={() => setCommercialModel('model_a')}
            >
              <View style={styles.radioHeader}>
                <Ionicons
                  name={commercialModel === 'model_a' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={commercialModel === 'model_a' ? coffee.accent : coffee.muted}
                />
                <Text style={styles.radioTitle}>Model A (Gratis / Trial) — Rekomendasi</Text>
              </View>
              <Text style={styles.radioDesc}>
                100% Gratis tanpa biaya. Ngopi mengambil data keterlibatan pengunjung secara anonim untuk peningkatan
                aplikasi & promosi cafe Anda.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.radioCard, commercialModel === 'model_b' && styles.radioCardActive]}
              onPress={() => setCommercialModel('model_b')}
            >
              <View style={styles.radioHeader}>
                <Ionicons
                  name={commercialModel === 'model_b' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={commercialModel === 'model_b' ? coffee.accent : coffee.muted}
                />
                <Text style={styles.radioTitle}>Model B (Bagi Hasil F&B 5%)</Text>
              </View>
              <Text style={styles.radioDesc}>
                Pihak Kedua mendapatkan potongan 5% dari setiap transaksi F&B yang dilakukan melalui fitur Order Ngopi.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Teks MoU Resmi */}
        <View style={styles.formSection}>
          <Text style={styles.sectionHeading}>2. Teks Naskah Perjanjian (MoU)</Text>
          <View style={styles.mouBox}>
            <ScrollView nestedScrollEnabled style={styles.mouScroll}>
              <Text style={styles.mouTitle}>PERJANJIAN KERJA SAMA KEMITRAAN DIGITAL</Text>
              <Text style={styles.mouSubtitle}>NGOPI x {cafeName.trim() ? cafeName.toUpperCase() : '[NAMA CAFE]'}</Text>

              <Text style={styles.mouParty}>
                <Text style={styles.bold}>PIHAK PERTAMA:</Text>
                {'\n'}Ngopi (dioperasikan oleh BaMbooChain)
                {'\n'}Website: https://bamboochain.id
              </Text>

              <Text style={styles.mouParty}>
                <Text style={styles.bold}>PIHAK KEDUA:</Text>
                {'\n'}Username Ngopi: @{currentUser?.username || '[username_anda]'}
                {'\n'}Nama Pemilik: {ownerName || '[Nama Pemilik]'}
                {'\n'}Nama Cafe: {cafeName || '[Nama Cafe]'}
                {'\n'}Alamat: {address || '[Alamat Lengkap]'}
                {'\n'}No. Telepon/WA: {phone || '[Nomor]'}
              </Text>

              <Text style={styles.mouPasalTitle}>PASAL 1: RUANG LINGKUP KERJA SAMA</Text>
              <Text style={styles.mouParagraph}>
                1. Pihak Pertama menyediakan platform aplikasi digital "Ngopi" (berbasis web dan PWA) untuk mendukung
                operasional dan komunitas Pihak Kedua.
                {'\n'}2. Pihak Kedua menyediakan lokasi fisik (Cafe) sebagai titik lokasi (Check-in Point) pengguna
                Ngopi.
              </Text>

              <Text style={styles.mouPasalTitle}>PASAL 2: FITUR DAN LAYANAN</Text>
              <Text style={styles.mouParagraph}>
                1. Check-in Digital & Loyalty: Pihak Pertama menyediakan QR Code unik khusus untuk Pihak Kedua. Setiap
                pengguna Ngopi yang melakukan scan (maks. 1x sehari) akan mendapatkan 50 Poin Ngopi.
                {'\n'}2. Merchant Dashboard: Pihak Pertama memberikan akses eksklusif kepada Pihak Kedua untuk melihat
                statistik kunjungan dan mengirim siaran promo (Broadcast) ke pengguna.
                {'\n'}3. Event Komunitas: Pihak Kedua dapat mengadakan turnamen (Gapleh/Catur) yang difasilitasi sistem
                matchmaking dan leaderboard dari Ngopi.
              </Text>

              <Text style={styles.mouPasalTitle}>PASAL 3: HAK DAN KEWAJIBAN</Text>
              <Text style={styles.mouParagraph}>
                1. Hak Pihak Pertama: Mendapatkan data statistik anonim untuk pengembangan aplikasi dan promosi bersama.
                {'\n'}2. Kewajiban Pihak Pertama: Menjaga kerahasiaan data pelanggan sesuai UU PDP dan memastikan sistem
                berjalan tanpa gangguan (uptime minimal 99%).
                {'\n'}3. Hak Pihak Kedua: Mendapatkan traffic tambahan, promosi gratis di aplikasi, dan alat loyalitas
                pelanggan.
                {'\n'}4. Kewajiban Pihak Kedua: Menyediakan QR Code fisik di meja, menghormati reward (misal: penukaran
                Poin dengan Kopi), dan menjaga reputasi baik di komunitas Ngopi.
              </Text>

              <Text style={styles.mouPasalTitle}>PASAL 4: KETENTUAN KOMERSIAL</Text>
              <Text style={styles.mouParagraph}>
                {commercialModel === 'model_b'
                  ? 'Model B (Bagi Hasil): Pihak Kedua mendapat potongan 5% dari setiap transaksi F&B yang dilakukan melalui fitur Order di Ngopi.'
                  : 'Model A (Gratis/Trial): Tidak ada biaya. Ngopi mengambil data engagement untuk case study.'}
              </Text>

              <Text style={styles.mouPasalTitle}>PASAL 5: JANGKA WAKTU & PENGAKHIRAN</Text>
              <Text style={styles.mouParagraph}>
                1. Perjanjian ini berlaku selama 1 (satu) tahun sejak tanggal persetujuan digital dan diperpanjang secara
                otomatis.
                {'\n'}2. Salah satu pihak dapat mengakhiri kerja sama dengan pemberitahuan tertulis (via fitur chat Ngopi
                atau email) minimal 30 hari sebelumnya.
              </Text>

              <Text style={styles.mouPasalTitle}>PASAL 6: PERSETUJUAN DIGITAL</Text>
              <Text style={styles.mouParagraph}>
                Dengan menekan tombol "Setuju & Tandatangani" pada pop-up verifikasi yang muncul di akun Ngopi Pihak
                Kedua, Pihak Kedua menyatakan telah membaca, memahami, dan menyetujui seluruh isi perjanjian ini. Tanda
                tangan digital ini memiliki kekuatan hukum yang sah.
              </Text>
            </ScrollView>
          </View>
        </View>

        {/* Section 3: Checkbox & Submit */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreedCheckbox(!agreedCheckbox)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={agreedCheckbox ? 'checkbox' : 'square-outline'}
            size={24}
            color={agreedCheckbox ? coffee.accent : coffee.muted}
          />
          <Text style={styles.checkboxLabel}>
            Saya menyatakan telah membaca, memahami, dan menyetujui seluruh isi Perjanjian Kerja Sama Kemitraan Digital
            di atas.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmitMoU}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={coffee.buttonText} />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={20} color={coffee.buttonText} />
              <Text style={styles.primaryBtnText}>Ajukan Kerja Sama & Verifikasi Digital</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* IN-APP REAL-TIME VERIFICATION POP-UP MODAL */}
      <Modal visible={showVerifyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.verifyModalCard}>
            <View style={styles.verifyModalIcon}>
              <Ionicons name="ribbon" size={42} color="#FFD700" />
            </View>

            <Text style={styles.verifyModalTitle}>Verifikasi Tanda Tangan Digital</Text>
            <Text style={styles.verifyModalSubtitle}>
              Sistem telah menerima draf kemitraan dari akun @{currentUser?.username}. Silakan konfirmasi untuk
              menandatangani secara digital.
            </Text>

            <View style={styles.summaryBox}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Nama Cafe:</Text>
                <Text style={styles.summaryVal}>{verificationPayload?.cafe_name || cafeName}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Pemilik:</Text>
                <Text style={styles.summaryVal}>{verificationPayload?.owner_name || ownerName}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Alamat:</Text>
                <Text style={styles.summaryVal} numberOfLines={2}>
                  {verificationPayload?.address || address}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>WhatsApp:</Text>
                <Text style={styles.summaryVal}>{verificationPayload?.phone || phone}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Skema:</Text>
                <Text style={[styles.summaryVal, { color: coffee.accent }]}>
                  {commercialModel === 'model_b' ? 'Model B (Bagi Hasil 5%)' : 'Model A (Gratis / Trial)'}
                </Text>
              </View>
            </View>

            <Text style={styles.legalDisclaimer}>
              ⚖️ Dengan menekan tombol di bawah, Anda secara sadar mengesahkan perjanjian kemitraan digital ini dengan
              identitas akun Ngopi Anda.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowVerifyModal(false)}
                disabled={signing}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.signBtn, signing && { opacity: 0.7 }]}
                onPress={handleVerifyAndSign}
                disabled={signing}
              >
                {signing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="create" size={18} color="#FFF" />
                    <Text style={styles.signBtnText}>Setuju & Tandatangani</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: coffee.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: coffee.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    backgroundColor: coffee.surface,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: coffee.text,
  },
  content: {
    flex: 1,
  },
  scrollPad: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: coffee.raised,
    borderWidth: 2,
    borderColor: coffee.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: coffee.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  heroDesc: {
    fontSize: 14,
    color: coffee.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 480,
  },
  introCard: {
    backgroundColor: coffee.surface,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 20,
    alignItems: 'center',
    textAlign: 'center',
  },
  introTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: coffee.text,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  introSub: {
    fontSize: 13,
    color: coffee.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  formSection: {
    backgroundColor: coffee.surface,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 18,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: coffee.accent,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: coffee.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: coffee.text,
    fontSize: 14,
  },
  radioGroup: {
    marginTop: 6,
    gap: 10,
  },
  radioCard: {
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 10,
    padding: 12,
  },
  radioCardActive: {
    borderColor: coffee.accent,
    backgroundColor: 'rgba(228, 181, 128, 0.08)',
  },
  radioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  radioTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: coffee.text,
  },
  radioDesc: {
    fontSize: 12,
    color: coffee.textSecondary,
    lineHeight: 17,
    paddingLeft: 28,
  },
  mouBox: {
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 10,
    height: 260,
    padding: 12,
  },
  mouScroll: {
    flex: 1,
  },
  mouTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.text,
    textAlign: 'center',
  },
  mouSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.accent,
    textAlign: 'center',
    marginBottom: 12,
  },
  mouParty: {
    fontSize: 12,
    color: coffee.text,
    lineHeight: 18,
    marginBottom: 10,
  },
  bold: {
    fontWeight: '700',
    color: coffee.accent,
  },
  mouPasalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.accent,
    marginTop: 8,
    marginBottom: 4,
  },
  mouParagraph: {
    fontSize: 11,
    color: coffee.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: coffee.text,
    lineHeight: 19,
  },
  primaryBtn: {
    backgroundColor: coffee.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: coffee.buttonText,
    fontSize: 15,
    fontWeight: '700',
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  outlineBtnText: {
    color: coffee.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedBadgeCard: {
    backgroundColor: coffee.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    padding: 18,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadgeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFD700',
  },
  verifiedBadgeSub: {
    fontSize: 12,
    color: coffee.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: coffee.border,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: coffee.muted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: coffee.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  qrCard: {
    backgroundColor: coffee.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: coffee.border,
    padding: 20,
    alignItems: 'center',
  },
  qrCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: coffee.text,
    marginBottom: 6,
  },
  qrCardSub: {
    fontSize: 12,
    color: coffee.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  qrImageContainer: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  qrTokenText: {
    color: '#333333',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrActions: {
    width: '100%',
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  verifyModalCard: {
    backgroundColor: coffee.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    padding: 22,
    maxWidth: 440,
    width: '100%',
    alignItems: 'center',
  },
  verifyModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: coffee.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  verifyModalSubtitle: {
    fontSize: 12,
    color: coffee.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  summaryBox: {
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 10,
    padding: 12,
    width: '100%',
    gap: 6,
    marginBottom: 14,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: coffee.muted,
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  legalDisclaimer: {
    fontSize: 11,
    color: coffee.muted,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: coffee.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  signBtn: {
    flex: 2,
    backgroundColor: '#80512F',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
