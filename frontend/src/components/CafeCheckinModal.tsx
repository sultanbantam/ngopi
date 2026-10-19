import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  Image,
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

const API_BASE = 'https://api.ngopi.top/api';

interface CafePartner {
  id: string;
  cafe_name: string;
  address?: string;
  description?: string;
  qr_code_token: string;
  qr_code_data_url?: string;
  reward_points?: number;
  promos?: Array<{ id: string; title: string; discount?: string }>;
}

interface CafeCheckinModalProps {
  visible: boolean;
  onClose: () => void;
  onCheckinSuccess?: (pointsAwarded: number, newTotal: number, cafeName: string) => void;
  onOpenCafeDetails?: (cafeTokenOrId: string) => void;
  initialToken?: string;
}

export default function CafeCheckinModal({
  visible,
  onClose,
  onCheckinSuccess,
  onOpenCafeDetails,
  initialToken,
}: CafeCheckinModalProps) {
  const [tokenInput, setTokenInput] = useState(initialToken || '');
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<CafePartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'error' | 'already';
    title: string;
    description: string;
    points?: number;
    cafeName?: string;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      setResultMessage(null);
      if (initialToken) {
        setTokenInput(initialToken);
      }
      fetchPartners();
    }
  }, [visible, initialToken]);

  const fetchPartners = async () => {
    try {
      setLoadingPartners(true);
      const res = await axios.get(`${API_BASE}/merchant/partners`);
      if (res.data?.success && Array.isArray(res.data.partners)) {
        setPartners(res.data.partners);
      }
    } catch (_) {
      // Fallback fallback list
      setPartners([
        {
          id: 'm_warkop_sahabat',
          cafe_name: 'Warkop Seduh Sahabat',
          address: 'Jl. Veteran No. 12, Jakarta',
          qr_code_token: 'NGOPI_WARKOP_SEDUH',
          reward_points: 50,
        },
        {
          id: 'm_kenangan_senja',
          cafe_name: 'Kopi Kenangan Senja',
          address: 'Jl. Gandaria Tengah II, Jakarta Selatan',
          qr_code_token: 'NGOPI_KENANGAN_SENJA',
          reward_points: 50,
        },
        {
          id: 'm_barista_corner',
          cafe_name: 'Barista Corner Roastery',
          address: 'Jl. Dago Asri No. 8, Bandung',
          qr_code_token: 'NGOPI_BARISTA_CORNER',
          reward_points: 50,
        },
      ]);
    } finally {
      setLoadingPartners(false);
    }
  };

  const handlePerformCheckin = async (codeToUse?: string) => {
    const rawToken = (codeToUse || tokenInput).trim();
    if (!rawToken) {
      Alert.alert('Perhatian', 'Silakan masukkan kode QR atau pilih cafe partner.');
      return;
    }

    try {
      setLoading(true);
      setResultMessage(null);
      const headers = await getAuthHeaders();
      const currentUsername = Platform.OS === 'web' ? localStorage.getItem('username') : '';
      const currentUserId = Platform.OS === 'web' ? localStorage.getItem('userId') : '';

      const res = await axios.post(
        `${API_BASE}/merchant/checkin`,
        {
          qr_code_token: rawToken,
          username: currentUsername || undefined,
          userId: currentUserId || undefined,
        },
        { headers }
      );

      if (res.data?.success) {
        const pts = res.data.pointsAwarded || 50;
        const cafeName = res.data.merchant?.cafe_name || 'Cafe Partner';
        setResultMessage({
          type: 'success',
          title: `Check-in Berhasil! ☕🎉`,
          description: `Kamu mendapatkan +${pts} Poin Ngopi di ${cafeName}. Voucher dan promo cafe aktif sudah dapat digunakan di kasir.`,
          points: pts,
          cafeName,
        });

        if (onCheckinSuccess) {
          onCheckinSuccess(pts, res.data.newTotalPoints || 0, cafeName);
        }
      }
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.alreadyCheckedIn) {
        setResultMessage({
          type: 'already',
          title: 'Sudah Check-in Hari Ini ⏳',
          description:
            errData.error ||
            'Kamu sudah mendapatkan poin di cafe ini hari ini (maks. 1x sehari). Kunjungi kembali besok untuk mengumpulkan poin!',
          cafeName: errData.merchant?.cafe_name,
        });
      } else {
        setResultMessage({
          type: 'error',
          title: 'Check-in Gagal',
          description:
            errData?.error || 'Kode QR tidak dikenali. Pastikan kamu memindai QR resmi Cafe Partner Ngopi.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="qr-code" size={20} color={coffee.accent} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Check-in Cafe Partner</Text>
                <Text style={styles.headerSubtitle}>Scan QR Meja & Dapatkan +50 Poin Ngopi</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={coffee.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Banner info */}
            <View style={styles.bannerInfo}>
              <Ionicons name="cafe" size={24} color={coffee.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.bannerInfoTitle}>Strategi Ngopi Phygital ☕📍</Text>
                <Text style={styles.bannerInfoText}>
                  Setiap kamu berkunjung dan scan QR di meja cafe partner, kamu otomatis mendapatkan{' '}
                  <Text style={{ fontWeight: '800', color: coffee.accent }}>50 Poin Ngopi</Text> (maksimal 1x
                  sehari per cafe). Kumpulkan poin untuk ditukar kopi gratis!
                </Text>
              </View>
            </View>

            {/* Result Alert Box if any */}
            {resultMessage && (
              <View
                style={[
                  styles.resultBox,
                  resultMessage.type === 'success' && styles.resultSuccess,
                  resultMessage.type === 'already' && styles.resultAlready,
                  resultMessage.type === 'error' && styles.resultError,
                ]}
              >
                <Ionicons
                  name={
                    resultMessage.type === 'success'
                      ? 'checkmark-circle'
                      : resultMessage.type === 'already'
                      ? 'time'
                      : 'alert-circle'
                  }
                  size={28}
                  color={
                    resultMessage.type === 'success'
                      ? '#10b981'
                      : resultMessage.type === 'already'
                      ? '#f59e0b'
                      : '#ef4444'
                  }
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.resultTitle}>{resultMessage.title}</Text>
                  <Text style={styles.resultDesc}>{resultMessage.description}</Text>
                  {resultMessage.cafeName && onOpenCafeDetails && (
                    <TouchableOpacity
                      style={styles.viewCafeBtn}
                      onPress={() => {
                        onClose();
                        onOpenCafeDetails(tokenInput);
                      }}
                    >
                      <Text style={styles.viewCafeBtnText}>Lihat Profil & Menu {resultMessage.cafeName} →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* QR Token Input */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pindai / Masukkan Token Meja</Text>
              <Text style={styles.cardSubtitle}>
                Masukkan kode yang ada di plakat meja cafe (contoh: NGOPI_WARKOP_SEDUH)
              </Text>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Kode QR Meja Cafe..."
                  placeholderTextColor={coffee.secondary}
                  value={tokenInput}
                  onChangeText={setTokenInput}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[styles.checkinActionBtn, (!tokenInput.trim() || loading) && styles.btnDisabled]}
                  onPress={() => handlePerformCheckin()}
                  disabled={!tokenInput.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={16} color="#fff" />
                      <Text style={styles.checkinActionText}>Check-in</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* List of Cafe Partners Nearby */}
            <View style={styles.sectionHeader}>
              <Ionicons name="storefront" size={18} color={coffee.accent} />
              <Text style={styles.sectionTitle}>Pilih Dari Cafe Partner Ngopi</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Kunjungi cafe berikut atau klik tombol untuk check-in langsung:
            </Text>

            {loadingPartners ? (
              <ActivityIndicator size="small" color={coffee.accent} style={{ marginTop: 14 }} />
            ) : (
              partners.map((partner) => (
                <View key={partner.id || partner.qr_code_token} style={styles.partnerCard}>
                  <View style={styles.partnerHeaderRow}>
                    <View style={styles.cafeLogoPlaceholder}>
                      <Text style={{ fontSize: 20 }}>☕</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.partnerName}>{partner.cafe_name}</Text>
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                          <Text style={styles.verifiedText}>Partner Resmi</Text>
                        </View>
                      </View>
                      {partner.address ? (
                        <Text style={styles.partnerAddress} numberOfLines={1}>
                          📍 {partner.address}
                        </Text>
                      ) : null}
                      <Text style={styles.partnerToken}>Token: {partner.qr_code_token}</Text>
                    </View>
                  </View>

                  <View style={styles.partnerActionRow}>
                    {onOpenCafeDetails && (
                      <TouchableOpacity
                        style={styles.detailBtn}
                        onPress={() => {
                          onClose();
                          onOpenCafeDetails(partner.qr_code_token);
                        }}
                      >
                        <Text style={styles.detailBtnText}>Lihat Promo</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.quickCheckinBtn}
                      onPress={() => {
                        setTokenInput(partner.qr_code_token);
                        handlePerformCheckin(partner.qr_code_token);
                      }}
                    >
                      <Ionicons name="checkmark-done" size={15} color="#fff" />
                      <Text style={styles.quickCheckinBtnText}>Check-in (+{partner.reward_points || 50} Pts)</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: coffee.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: coffee.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    backgroundColor: coffee.background,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: coffee.accentWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: coffee.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: coffee.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: coffee.raised,
  },
  content: {
    padding: 16,
  },
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(212, 163, 115, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  bannerInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.accent,
    marginBottom: 2,
  },
  bannerInfoText: {
    fontSize: 11,
    color: coffee.text,
    lineHeight: 16,
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  resultSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
  },
  resultAlready: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
  },
  resultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.text,
  },
  resultDesc: {
    fontSize: 11,
    color: coffee.text,
    marginTop: 2,
    lineHeight: 16,
  },
  viewCafeBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: coffee.accentWash,
  },
  viewCafeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: coffee.accent,
  },
  card: {
    backgroundColor: coffee.raised,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: coffee.secondary,
    marginTop: 2,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: coffee.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: coffee.text,
    fontSize: 13,
    fontWeight: '700',
  },
  checkinActionBtn: {
    backgroundColor: coffee.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  checkinActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: coffee.secondary,
    marginTop: 2,
    marginBottom: 12,
  },
  partnerCard: {
    backgroundColor: coffee.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    padding: 12,
    marginBottom: 10,
  },
  partnerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cafeLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
  },
  partnerName: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10b981',
  },
  partnerAddress: {
    fontSize: 10,
    color: coffee.secondary,
    marginTop: 2,
  },
  partnerToken: {
    fontSize: 10,
    color: coffee.accent,
    fontWeight: '700',
    marginTop: 1,
  },
  partnerActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
  },
  detailBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: coffee.raised,
  },
  detailBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: coffee.secondary,
  },
  quickCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: coffee.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  quickCheckinBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
});
