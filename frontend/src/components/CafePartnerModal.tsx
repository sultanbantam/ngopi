import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
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

const API_BASE = 'https://api.ngopi.top/api';

interface PromoItem {
  id: string;
  title: string;
  description: string;
  discount?: string;
  valid_until?: string;
  image_url?: string;
}

interface CafeDetail {
  id: string;
  cafe_name: string;
  address?: string;
  description?: string;
  phone?: string;
  logo?: string;
  banner_url?: string;
  qr_code_token: string;
  qr_code_data_url?: string;
  reward_points?: number;
  promos?: PromoItem[];
}

interface CafePartnerModalProps {
  visible: boolean;
  onClose: () => void;
  cafeTokenOrId?: string;
  onCheckinSuccess?: (points: number, newTotal: number, cafeName: string) => void;
}

const SAMPLE_MENU = [
  { name: 'Kopi Tubruk Robusta Gayo', price: 'Rp 12.000', note: 'Biji kopi sangrai gelap khas warkop' },
  { name: 'Es Kopi Susu Gula Aren', price: 'Rp 18.000', note: 'Kopi susu legit primadona nongkrong' },
  { name: 'Kopi Jahe Susu Rempah', price: 'Rp 15.000', note: 'Hangat menyegarkan tubuh saat malam' },
  { name: 'Pisang Bakar Keju Cokelat', price: 'Rp 16.000', note: 'Cemilan pas kawan main gapleh' },
];

export default function CafePartnerModal({
  visible,
  onClose,
  cafeTokenOrId,
  onCheckinSuccess,
}: CafePartnerModalProps) {
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [cafe, setCafe] = useState<CafeDetail | null>(null);
  const [claimedPromo, setClaimedPromo] = useState<string | null>(null);

  useEffect(() => {
    if (visible && cafeTokenOrId) {
      loadCafe(cafeTokenOrId);
    }
  }, [visible, cafeTokenOrId]);

  const loadCafe = async (tokenOrId: string) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/merchant/cafe/${encodeURIComponent(tokenOrId)}`);
      if (res.data?.success && res.data.cafe) {
        setCafe(res.data.cafe);
      }
    } catch (_) {
      // Fallback fallback cafe data
      setCafe({
        id: 'm_warkop_sahabat',
        cafe_name: 'Warkop Seduh Sahabat',
        address: 'Jl. Veteran No. 12, Gambir, Jakarta Pusat',
        description: 'Warkop kopi nusantara tradisional dengan racikan kopi tubruk, jahe hangat, dan area turnamen gapleh.',
        phone: '0812-3456-7890',
        banner_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80',
        logo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80',
        qr_code_token: 'NGOPI_WARKOP_SEDUH',
        reward_points: 50,
        promos: [
          {
            id: 'prm_1',
            title: 'Diskon 20% Kopi Tubruk Robusta',
            description: 'Tunjukkan akun Ngopi kamu ke kasir dan nikmati potongan harga langsung.',
            discount: '20%',
            valid_until: 'Aktif Bulan Ini',
          },
          {
            id: 'prm_2',
            title: 'Beli 2 Es Kopi Susu Gratis 1',
            description: 'Khusus kawan nongkrong yang check-in di meja cafe via Ngopi.',
            discount: 'Beli 2 Gratis 1',
            valid_until: 'Aktif Bulan Ini',
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!cafe) return;
    try {
      setCheckingIn(true);
      const headers = await getAuthHeaders();
      const currentUsername = Platform.OS === 'web' ? localStorage.getItem('username') : '';
      const currentUserId = Platform.OS === 'web' ? localStorage.getItem('userId') : '';

      const res = await axios.post(
        `${API_BASE}/merchant/checkin`,
        {
          qr_code_token: cafe.qr_code_token,
          username: currentUsername || undefined,
          userId: currentUserId || undefined,
        },
        { headers }
      );

      if (res.data?.success) {
        const pts = res.data.pointsAwarded || 50;
        Alert.alert(
          'Check-in Berhasil! ☕🎉',
          `Selamat! Kamu mendapatkan +${pts} Poin Ngopi di ${cafe.cafe_name}. Poin dapat ditukarkan kopi gratis atau fitur premium.`
        );
        if (onCheckinSuccess) {
          onCheckinSuccess(pts, res.data.newTotalPoints || 0, cafe.cafe_name);
        }
      }
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.alreadyCheckedIn) {
        Alert.alert('Sudah Check-in Hari Ini ⏳', errData.error || 'Maksimal 1x check-in sehari per cafe.');
      } else {
        Alert.alert('Gagal Check-in', errData?.error || 'Terjadi kesalahan saat memproses check-in.');
      }
    } finally {
      setCheckingIn(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="storefront" size={20} color={coffee.accent} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                Warung {cafe?.cafe_name || 'Cafe Partner'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={coffee.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={coffee.accent} />
              <Text style={{ color: coffee.secondary, marginTop: 12, fontSize: 12 }}>
                Memuat Warung Cafe...
              </Text>
            </View>
          ) : cafe ? (
            <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 28 }}>
              {/* Hero Banner */}
              <View style={styles.bannerContainer}>
                {cafe.banner_url ? (
                  <Image source={{ uri: cafe.banner_url }} style={styles.bannerImage} />
                ) : (
                  <View style={[styles.bannerImage, { backgroundColor: coffee.raised, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 36 }}>☕</Text>
                  </View>
                )}
                <View style={styles.bannerOverlay}>
                  <View style={styles.partnerTag}>
                    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                    <Text style={styles.partnerTagText}>VERIFIED CAFE PARTNER</Text>
                  </View>
                  <Text style={styles.cafeTitleOverlay}>{cafe.cafe_name}</Text>
                  {cafe.address && (
                    <Text style={styles.cafeAddressOverlay} numberOfLines={1}>
                      📍 {cafe.address}
                    </Text>
                  )}
                </View>
              </View>

              {/* Action Bar (Check-in + Panggil Barista) */}
              <View style={styles.actionBar}>
                <TouchableOpacity
                  style={[styles.bigCheckinBtn, checkingIn && { opacity: 0.6 }]}
                  onPress={handleCheckin}
                  disabled={checkingIn}
                >
                  {checkingIn ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color="#fff" />
                      <Text style={styles.bigCheckinBtnText}>
                        Check-in di Meja (+{cafe.reward_points || 50} Poin)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {cafe.phone && (
                  <TouchableOpacity
                    style={styles.baristaBtn}
                    onPress={() => {
                      Alert.alert(
                        'Panggil Barista / Pelayan 🛎️',
                        `Hubungi kasir/barista ${cafe.cafe_name} di: ${cafe.phone}`
                      );
                    }}
                  >
                    <Ionicons name="call-outline" size={16} color={coffee.accent} />
                    <Text style={styles.baristaBtnText}>Hubungi</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* About Cafe */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Tentang Warung Kopi</Text>
                <Text style={styles.sectionDesc}>
                  {cafe.description ||
                    'Cafe partner resmi komunitas Ngopi. Tempat berkumpul, ngobrol santai, dan main gapleh offline bersama kawan.'}
                </Text>
                <View style={styles.tableTokenBox}>
                  <Text style={styles.tokenBoxLabel}>KODE MEJA RESMI:</Text>
                  <Text style={styles.tokenBoxVal}>{cafe.qr_code_token}</Text>
                </View>
              </View>

              {/* Promosi & Voucher Kasir */}
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.sectionTitle}>Promo & Voucher Kasir 🎟️</Text>
                  <View style={styles.promoCountBadge}>
                    <Text style={styles.promoCountText}>{(cafe.promos || []).length} Promo</Text>
                  </View>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Tunjukkan voucher ini ke kasir {cafe.cafe_name} saat membayar:
                </Text>

                {(cafe.promos || []).map((promo) => (
                  <View key={promo.id} style={styles.promoCard}>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>{promo.discount || 'PROMO'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.promoTitle}>{promo.title}</Text>
                      <Text style={styles.promoDesc}>{promo.description}</Text>
                      <TouchableOpacity
                        style={styles.claimBtn}
                        onPress={() => {
                          setClaimedPromo(promo.id);
                          Alert.alert('Voucher Ditunjukkan', `Voucher "${promo.title}" siap digunakan di kasir!`);
                        }}
                      >
                        <Ionicons
                          name={claimedPromo === promo.id ? 'checkmark' : 'ticket-outline'}
                          size={14}
                          color={coffee.accent}
                        />
                        <Text style={styles.claimBtnText}>
                          {claimedPromo === promo.id ? 'Voucher Aktif di Kasir' : 'Gunakan Voucher'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Menu Andalan */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Daftar Menu Favorit ☕🍽️</Text>
                <Text style={styles.sectionSubtitle}>Rekomendasi racikan barista untuk santai kamu:</Text>
                {SAMPLE_MENU.map((item, idx) => (
                  <View key={idx} style={styles.menuRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      <Text style={styles.menuItemNote}>{item.note}</Text>
                    </View>
                    <Text style={styles.menuItemPrice}>{item.price}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}
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
    maxWidth: 540,
    maxHeight: '92%',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    backgroundColor: coffee.background,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: coffee.text,
    maxWidth: 340,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  bannerContainer: {
    height: 160,
    position: 'relative',
    backgroundColor: '#000',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  partnerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  partnerTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  cafeTitleOverlay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  cafeAddressOverlay: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: coffee.background,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  bigCheckinBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: coffee.accent,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bigCheckinBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  baristaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: coffee.raised,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  baristaBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.text,
  },
  sectionCard: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: coffee.raised,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: coffee.border,
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
    marginBottom: 10,
  },
  sectionDesc: {
    fontSize: 12,
    color: coffee.text,
    lineHeight: 18,
    marginTop: 4,
  },
  tableTokenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: coffee.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  tokenBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: coffee.secondary,
  },
  tokenBoxVal: {
    fontSize: 12,
    fontWeight: '800',
    color: coffee.accent,
    letterSpacing: 0.5,
  },
  promoCountBadge: {
    backgroundColor: coffee.accentWash,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promoCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: coffee.accent,
  },
  promoCard: {
    flexDirection: 'row',
    backgroundColor: coffee.background,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 8,
    alignItems: 'center',
  },
  discountBadge: {
    backgroundColor: 'rgba(234, 88, 12, 0.2)',
    borderWidth: 1,
    borderColor: '#ea580c',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ea580c',
  },
  promoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: coffee.text,
  },
  promoDesc: {
    fontSize: 10,
    color: coffee.secondary,
    marginTop: 2,
    lineHeight: 14,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: coffee.raised,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  claimBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: coffee.accent,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  menuItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.text,
  },
  menuItemNote: {
    fontSize: 10,
    color: coffee.secondary,
    marginTop: 1,
  },
  menuItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: coffee.accent,
    marginLeft: 8,
  },
});
