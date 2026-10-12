import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coffee as baseCoffee } from '../theme/coffee';
import axios from 'axios';
import { getAuthHeaders } from '../utils/api';

const coffee = {
  ...baseCoffee,
  cream: baseCoffee.text,
  textSecondary: baseCoffee.secondary,
  primary: baseCoffee.accent,
};

const API_URL = 'https://api.ngopi.top/api';

interface PrivacyModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrivacyModal({ visible, onClose }: PrivacyModalProps) {
  const [activeTab, setActiveTab] = useState<'policy' | 'terms' | 'rights'>('policy');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_URL}/user/export`, { headers });

      if (res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ngopi_data_export_${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          Alert.alert('Unduhan Berhasil 📥', 'Salinan data pribadi Anda berhasil diunduh dalam format JSON.');
        } else {
          Alert.alert('Ekspor Berhasil 📥', `Data pribadi berhasil diekspor. ID Ekspor: ${res.data.export_metadata?.export_id}`);
        }
      }
    } catch (err: any) {
      Alert.alert('Gagal Ekspor', err.response?.data?.error || 'Terjadi kesalahan saat mengekspor data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRequestDeletion = () => {
    Alert.alert(
      'Konfirmasi Penghapusan Akun',
      'Sesuai UU PDP No. 27/2022, akun Anda akan masuk masa tenggang (grace period) 30 hari sebelum seluruh data dihapus permanen. Anda dapat membatalkannya kapan saja dalam 30 hari.\n\nYakin ingin mengajukan penghapusan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Akun',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const headers = await getAuthHeaders();
              const res = await axios.delete(`${API_URL}/user/delete`, {
                headers,
                data: { reason: 'Permintaan pengguna via Pengaturan Privasi' },
              });

              if (res.data?.success) {
                Alert.alert(
                  'Permintaan Diterima ⏳',
                  res.data.message || 'Akun Anda dalam masa tenggang 30 hari sebelum dihapus permanen.'
                );
              }
            } catch (err: any) {
              Alert.alert('Gagal Mengajukan', err.response?.data?.error || 'Terjadi kesalahan.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.shieldBadge}>
                <Ionicons name="shield-checkmark" size={18} color="#FFF" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Privasi & Kepatuhan UU PDP</Text>
                <Text style={styles.headerSubtitle}>UU No. 27/2022 • DPO: dpo@ngopi.top</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={coffee.cream} />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'policy' && styles.tabBtnActive]}
              onPress={() => setActiveTab('policy')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'policy' && styles.tabBtnTextActive]}>
                Kebijakan Privasi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'terms' && styles.tabBtnActive]}
              onPress={() => setActiveTab('terms')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'terms' && styles.tabBtnTextActive]}>
                Syarat Layanan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'rights' && styles.tabBtnActive]}
              onPress={() => setActiveTab('rights')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'rights' && styles.tabBtnTextActive]}>
                Hak Data Anda
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {activeTab === 'policy' && (
              <View style={styles.textSection}>
                <Text style={styles.sectionHeading}>Komitmen Perlindungan Data Pribadi</Text>
                <Text style={styles.paragraph}>
                  PT Ngopi Kreasi Digital tunduk sepenuhnya pada Undang-Undang No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP).
                </Text>

                <Text style={styles.subHeading}>Prinsip Utama Ngopi:</Text>
                <Text style={styles.bulletPoint}>
                  🔒 <Text style={styles.boldText}>Enkripsi Ujung-ke-Ujung (E2EE):</Text> Seluruh pesan obrolan dienkripsi menggunakan X25519 dan AES-256-GCM. Hanya Anda dan teman bicara yang memegang kunci untuk membaca pesan.
                </Text>
                <Text style={styles.bulletPoint}>
                  🛡️ <Text style={styles.boldText}>Tanpa Nomor HP:</Text> Kami tidak mewajibkan nomor telepon pribadi untuk mendaftar atau menggunakan warkop.
                </Text>
                <Text style={styles.bulletPoint}>
                  🚫 <Text style={styles.boldText}>Bebas Pelacak & Iklan Pihak Ketiga:</Text> Data Anda tidak pernah diperjualbelikan kepada broker data atau pengiklan.
                </Text>
                <Text style={styles.bulletPoint}>
                  ⏰ <Text style={styles.boldText}>Notifikasi Insiden 3x24 Jam:</Text> Sesuai Pasal 46 UU PDP, jika terjadi gangguan keamanan, kami wajib memberitahu Anda dan Kominfo paling lambat 72 jam.
                </Text>
              </View>
            )}

            {activeTab === 'terms' && (
              <View style={styles.textSection}>
                <Text style={styles.sectionHeading}>Syarat & Ketentuan Penggunaan (v3.0)</Text>
                <Text style={styles.paragraph}>
                  Ngopi dirancang sebagai ruang komunikasi santai, privat, dan aman berfilosofi Warung Kopi Nusantara.
                </Text>

                <Text style={styles.subHeading}>Kewajiban Pengguna:</Text>
                <Text style={styles.bulletPoint}>
                  • Menjaga etika nongkrong warkop yang damai dan saling menghargai.
                </Text>
                <Text style={styles.bulletPoint}>
                  • Tidak menyebarkan spam bot, materi ilegal, penipuan, atau ujaran kebencian.
                </Text>
                <Text style={styles.bulletPoint}>
                  • Bertanggung jawab atas kunci privat enkripsi dan keamanan perangkat masing-masing.
                </Text>
              </View>
            )}

            {activeTab === 'rights' && (
              <View style={styles.textSection}>
                <Text style={styles.sectionHeading}>Hak Subjek Data Anda (UU PDP)</Text>
                <Text style={styles.paragraph}>
                  Anda memiliki kendali penuh atas data pribadi Anda yang tersimpan di platform Ngopi.
                </Text>

                {/* Export Data Action Card */}
                <View style={styles.actionCard}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="download-outline" size={22} color={coffee.primary} />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionTitle}>Unduh Salinan Data Saya</Text>
                    <Text style={styles.actionDesc}>
                      Dapatkan seluruh data akun, perolehan Poin Ngopi, kartu TCG, dan audit trail dalam format JSON terstruktur (Pasal 7 & 8 UU PDP).
                    </Text>
                    <TouchableOpacity
                      style={styles.exportBtn}
                      onPress={handleExportData}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.exportBtnText}>Ekspor Data (JSON)</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Right to be Forgotten Action Card */}
                <View style={[styles.actionCard, { borderColor: '#B71C1C' }]}>
                  <View style={[styles.actionIconBox, { backgroundColor: 'rgba(183, 28, 28, 0.15)' }]}>
                    <Ionicons name="trash-outline" size={22} color="#EF5350" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionTitle}>Hapus Akun & Data (Hak Dilupakan)</Text>
                    <Text style={styles.actionDesc}>
                      Ajukan penghapusan akun permanen (Pasal 9 UU PDP). Tersedia masa tenggang 30 hari untuk membatalkan jika berubah pikiran.
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={handleRequestDeletion}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.deleteBtnText}>Ajukan Penghapusan (Grace Period 30 Hari)</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* DPO Contact Box */}
            <View style={styles.dpoCard}>
              <Ionicons name="mail-outline" size={16} color={coffee.primary} />
              <Text style={styles.dpoText}>
                Hubungi Pejabat Perlindungan Data (DPO): <Text style={styles.boldText}>dpo@ngopi.top</Text>
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: coffee.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shieldBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: coffee.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: coffee.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: coffee.raised,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: coffee.primary,
  },
  tabBtnText: {
    color: coffee.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  textSection: {
    marginBottom: 16,
  },
  sectionHeading: {
    color: coffee.cream,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  subHeading: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    color: coffee.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  bulletPoint: {
    color: coffee.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  boldText: {
    color: coffee.cream,
    fontWeight: '700',
  },
  actionCard: {
    flexDirection: 'row',
    backgroundColor: coffee.raised,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 12,
    gap: 12,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(228, 181, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  actionDesc: {
    color: coffee.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    marginBottom: 10,
  },
  exportBtn: {
    backgroundColor: coffee.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  exportBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#C62828',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  deleteBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dpoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  dpoText: {
    color: coffee.textSecondary,
    fontSize: 11,
  },
});
