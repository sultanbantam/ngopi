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

interface MerchantDashboardModalProps {
  visible: boolean;
  onClose: () => void;
  currentUserId?: string;
}

export default function MerchantDashboardModal({
  visible,
  onClose,
  currentUserId,
}: MerchantDashboardModalProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'promos' | 'visitors' | 'settings'>('stats');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);

  // New promo form state
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [savingPromo, setSavingPromo] = useState(false);

  // Profile form state
  const [cafeName, setCafeName] = useState('');
  const [cafeAddress, setCafeAddress] = useState('');
  const [cafeDesc, setCafeDesc] = useState('');
  const [cafePhone, setCafePhone] = useState('');
  const [rewardPoints, setRewardPoints] = useState('50');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (visible) {
      loadDashboard();
    }
  }, [visible]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const uid = currentUserId || (Platform.OS === 'web' ? localStorage.getItem('userId') : '');
      const res = await axios.get(`${API_BASE}/merchant/dashboard`, {
        headers,
        params: { user_id: uid },
      });

      if (res.data?.success && res.data.dashboard) {
        const d = res.data.dashboard;
        setDashboard(d);
        if (d.profile) {
          setCafeName(d.profile.cafe_name || '');
          setCafeAddress(d.profile.address || '');
          setCafeDesc(d.profile.description || '');
          setCafePhone(d.profile.phone || '');
          setRewardPoints(String(d.profile.reward_points || 50));
        }
      }
    } catch (_) {
      // Fallback sample dashboard
      setDashboard({
        profile: {
          id: 'm_warkop_sahabat',
          cafe_name: 'Warkop Seduh Sahabat',
          address: 'Jl. Veteran No. 12, Jakarta',
          description: 'Warkop kopi nusantara tradisional dengan area turnamen gapleh.',
          phone: '0812-3456-7890',
          qr_code_token: 'NGOPI_WARKOP_SEDUH',
          reward_points: 50,
          is_verified: true,
        },
        stats: {
          totalCheckins: 48,
          todayCheckins: 12,
          totalPointsGiven: 2400,
          uniqueVisitors: 31,
          activePromosCount: 2,
        },
        recentCheckins: [
          { id: '1', username: 'BudiSantoso', points: 50, created_at: new Date().toISOString() },
          { id: '2', username: 'KawanNgopi_07', points: 50, created_at: new Date(Date.now() - 3600000).toISOString() },
          { id: '3', username: 'GaplehMaster', points: 50, created_at: new Date(Date.now() - 7200000).toISOString() },
        ],
        promos: [
          { id: 'p1', title: 'Diskon 20% Kopi Tubruk', discount: '20%', description: 'Khusus member Ngopi' },
          { id: 'p2', title: 'Beli 2 Es Kopi Susu Gratis 1', discount: 'Beli 2 Gratis 1', description: 'Promo nongkrong sore' },
        ],
        standingTableUrl: 'https://ngopi.top/warung/NGOPI_WARKOP_SEDUH',
      });
      setCafeName('Warkop Seduh Sahabat');
      setCafeAddress('Jl. Veteran No. 12, Jakarta');
      setRewardPoints('50');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePromo = async () => {
    if (!promoTitle.trim() || !promoDesc.trim()) {
      Alert.alert('Perhatian', 'Judul dan deskripsi promo wajib diisi.');
      return;
    }
    try {
      setSavingPromo(true);
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_BASE}/merchant/promo`,
        {
          merchant_id: dashboard?.profile?.id,
          title: promoTitle,
          discount: promoDiscount || undefined,
          description: promoDesc,
          valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
        { headers }
      );
      if (res.data?.success) {
        Alert.alert('Berhasil', 'Promo cafe berhasil ditambahkan!');
        setPromoTitle('');
        setPromoDiscount('');
        setPromoDesc('');
        loadDashboard();
      }
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.error || 'Gagal menambahkan promo.');
    } finally {
      setSavingPromo(false);
    }
  };

  const handleDeletePromo = async (promoId: string) => {
    try {
      const headers = await getAuthHeaders();
      await axios.delete(`${API_BASE}/merchant/promo/${promoId}`, {
        headers,
        params: { merchant_id: dashboard?.profile?.id },
      });
      Alert.alert('Dihapus', 'Promo berhasil dihapus.');
      loadDashboard();
    } catch (_) {
      Alert.alert('Gagal', 'Gagal menghapus promo.');
    }
  };

  const handleSaveProfile = async () => {
    if (!cafeName.trim()) {
      Alert.alert('Perhatian', 'Nama cafe/warung tidak boleh kosong.');
      return;
    }
    try {
      setSavingProfile(true);
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_BASE}/merchant/profile`,
        {
          cafe_name: cafeName,
          address: cafeAddress,
          description: cafeDesc,
          phone: cafePhone,
          reward_points: Number(rewardPoints) || 50,
        },
        { headers }
      );
      if (res.data?.success) {
        Alert.alert('Sukses', 'Profil cafe partner berhasil diperbarui!');
        loadDashboard();
      }
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.error || 'Gagal menyimpan profil.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.iconBadge}>
                <Ionicons name="bar-chart" size={18} color={coffee.accent} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Merchant Cafe Dashboard</Text>
                <Text style={styles.headerSubtitle}>
                  {dashboard?.profile?.cafe_name || 'Ngopi for Business'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={coffee.text} />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'stats' && styles.tabBtnActive]}
              onPress={() => setActiveTab('stats')}
            >
              <Ionicons
                name="stats-chart"
                size={14}
                color={activeTab === 'stats' ? coffee.accent : coffee.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'stats' && styles.tabBtnTextActive]}>
                Meja QR & Stats
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'promos' && styles.tabBtnActive]}
              onPress={() => setActiveTab('promos')}
            >
              <Ionicons
                name="pricetags"
                size={14}
                color={activeTab === 'promos' ? coffee.accent : coffee.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'promos' && styles.tabBtnTextActive]}>
                Kelola Promo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'visitors' && styles.tabBtnActive]}
              onPress={() => setActiveTab('visitors')}
            >
              <Ionicons
                name="people"
                size={14}
                color={activeTab === 'visitors' ? coffee.accent : coffee.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'visitors' && styles.tabBtnTextActive]}>
                Pengunjung
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'settings' && styles.tabBtnActive]}
              onPress={() => setActiveTab('settings')}
            >
              <Ionicons
                name="settings-sharp"
                size={14}
                color={activeTab === 'settings' ? coffee.accent : coffee.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'settings' && styles.tabBtnTextActive]}>
                Profil
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={coffee.accent} />
              <Text style={{ color: coffee.secondary, marginTop: 10, fontSize: 12 }}>
                Memuat data dashboard...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 28 }}>
              {/* TAB 1: STATS & PLAKAT MEJA QR */}
              {activeTab === 'stats' && (
                <View>
                  {/* Grid 4 Stats */}
                  <View style={styles.statsGrid}>
                    <View style={styles.statTile}>
                      <Text style={styles.statVal}>{dashboard?.stats?.todayCheckins || 0}</Text>
                      <Text style={styles.statLabel}>Check-in Hari Ini</Text>
                    </View>
                    <View style={styles.statTile}>
                      <Text style={styles.statVal}>{dashboard?.stats?.totalCheckins || 0}</Text>
                      <Text style={styles.statLabel}>Total Kunjungan</Text>
                    </View>
                    <View style={styles.statTile}>
                      <Text style={[styles.statVal, { color: '#10b981' }]}>
                        {dashboard?.stats?.totalPointsGiven || 0}
                      </Text>
                      <Text style={styles.statLabel}>Poin Dibagikan</Text>
                    </View>
                    <View style={styles.statTile}>
                      <Text style={styles.statVal}>{dashboard?.stats?.uniqueVisitors || 0}</Text>
                      <Text style={styles.statLabel}>Pelanggan Unik</Text>
                    </View>
                  </View>

                  {/* Standing Table Card (Plakat Meja Cafe) */}
                  <View style={styles.standingCardWrapper}>
                    <View style={styles.standingCardHeader}>
                      <Ionicons name="tablet-landscape" size={18} color={coffee.accent} />
                      <Text style={styles.standingCardTitle}>Plakat Meja Cafe (Standing Table Card)</Text>
                    </View>
                    <Text style={styles.standingCardSub}>
                      Cetak atau tampilkan desain standing table ini di meja cafe teman Anda agar pelanggan scan dan repeat-order:
                    </Text>

                    <View style={styles.plakatMockup}>
                      <View style={styles.plakatBrandBadge}>
                        <Text style={styles.plakatBrandText}>NGOPI FOR BUSINESS ☕</Text>
                      </View>
                      <Text style={styles.plakatCafeName}>
                        {dashboard?.profile?.cafe_name || 'Cafe Partner'}
                      </Text>
                      <Text style={styles.plakatInstruction}>
                        Scan QR di meja ini untuk dapat Kopi Gratis & Main Gapleh bareng komunitas!
                      </Text>

                      {dashboard?.qrCodeDataUrl ? (
                        <Image source={{ uri: dashboard.qrCodeDataUrl }} style={styles.qrImage} />
                      ) : (
                        <View style={[styles.qrImage, { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="qr-code" size={90} color="#3d2616" />
                        </View>
                      )}

                      <View style={styles.plakatTokenBox}>
                        <Text style={styles.plakatTokenText}>
                          Token: {dashboard?.profile?.qr_code_token}
                        </Text>
                      </View>
                      <Text style={styles.plakatFooterUrl}>ngopi.top/warung/{dashboard?.profile?.qr_code_token}</Text>
                    </View>

                    <View style={styles.plakatActions}>
                      <TouchableOpacity
                        style={styles.plakatActionBtn}
                        onPress={() => {
                          const url = dashboard?.standingTableUrl || `https://ngopi.top/warung/${dashboard?.profile?.qr_code_token}`;
                          if (Platform.OS === 'web' && navigator.clipboard) {
                            navigator.clipboard.writeText(url);
                            Alert.alert('Disalin!', 'Tautan meja cafe berhasil disalin ke clipboard.');
                          } else {
                            Alert.alert('Tautan Meja Cafe', url);
                          }
                        }}
                      >
                        <Ionicons name="copy-outline" size={15} color={coffee.accent} />
                        <Text style={styles.plakatActionText}>Salin Link Meja</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.plakatActionBtn, { backgroundColor: coffee.accent }]}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            window.print();
                          } else {
                            Alert.alert('Cetak Plakat', 'Buka di peramban web desktop untuk mencetak plakat ukuran meja.');
                          }
                        }}
                      >
                        <Ionicons name="print" size={15} color="#fff" />
                        <Text style={[styles.plakatActionText, { color: '#fff' }]}>Cetak Plakat Meja</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 2: KELOLA PROMO */}
              {activeTab === 'promos' && (
                <View>
                  <View style={styles.cardBox}>
                    <Text style={styles.cardBoxTitle}>Tambah Promo Baru 🎟️</Text>
                    <Text style={styles.cardBoxSub}>
                      Promo akan langsung muncul di halaman Warung cafe dan dapat ditunjukkan pelanggan ke kasir.
                    </Text>

                    <TextInput
                      style={styles.inputField}
                      placeholder="Judul Promo (contoh: Diskon 20% Kopi Tubruk)..."
                      placeholderTextColor={coffee.secondary}
                      value={promoTitle}
                      onChangeText={setPromoTitle}
                    />

                    <TextInput
                      style={styles.inputField}
                      placeholder="Label Diskon (contoh: 20%, Beli 2 Gratis 1, dsb)..."
                      placeholderTextColor={coffee.secondary}
                      value={promoDiscount}
                      onChangeText={setPromoDiscount}
                    />

                    <TextInput
                      style={[styles.inputField, { height: 60 }]}
                      placeholder="Deskripsi & Syarat Ketentuan Promo..."
                      placeholderTextColor={coffee.secondary}
                      value={promoDesc}
                      onChangeText={setPromoDesc}
                      multiline
                    />

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, savingPromo && { opacity: 0.6 }]}
                      onPress={handleCreatePromo}
                      disabled={savingPromo}
                    >
                      {savingPromo ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="add-circle" size={16} color="#fff" />
                          <Text style={styles.primaryActionText}>Terbitkan Promo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Daftar Promo Aktif</Text>
                  {(dashboard?.promos || []).length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada promo aktif untuk cafe ini.</Text>
                  ) : (
                    (dashboard?.promos || []).map((p: any) => (
                      <View key={p.id} style={styles.promoItemRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.promoItemTitle}>{p.title}</Text>
                            {p.discount ? (
                              <View style={styles.discountTag}>
                                <Text style={styles.discountTagText}>{p.discount}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.promoItemDesc}>{p.description}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deletePromoBtn}
                          onPress={() => handleDeletePromo(p.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 3: DAFTAR PENGUNJUNG (LIVE CHECK-IN FEED) */}
              {activeTab === 'visitors' && (
                <View>
                  <Text style={styles.sectionHeading}>Riwayat Check-in Meja Cafe</Text>
                  <Text style={styles.sectionSubHeading}>
                    Pelanggan yang hadir secara fisik dan memindai QR code di meja:
                  </Text>

                  {(dashboard?.recentCheckins || []).length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada riwayat check-in yang tercatat.</Text>
                  ) : (
                    (dashboard?.recentCheckins || []).map((c: any, i: number) => (
                      <View key={c.id || i} style={styles.visitorRow}>
                        <View style={styles.visitorAvatar}>
                          <Text style={{ fontSize: 16 }}>☕</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.visitorName}>@{c.username || 'Pengunjung'}</Text>
                          <Text style={styles.visitorTime}>
                            {new Date(c.created_at).toLocaleString('id-ID')}
                          </Text>
                        </View>
                        <View style={styles.ptsBadge}>
                          <Text style={styles.ptsBadgeText}>+{c.points || 50} Poin</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 4: PENGATURAN PROFIL CAFE */}
              {activeTab === 'settings' && (
                <View style={styles.cardBox}>
                  <Text style={styles.cardBoxTitle}>Pengaturan Cafe Partner ⚙️</Text>
                  <Text style={styles.cardBoxSub}>
                    Perbarui profil fisik cafe Anda agar menarik minat kawan-kawan komunitas Ngopi:
                  </Text>

                  <Text style={styles.fieldLabel}>Nama Cafe / Warung Kopi:</Text>
                  <TextInput
                    style={styles.inputField}
                    value={cafeName}
                    onChangeText={setCafeName}
                    placeholder="Nama Cafe..."
                    placeholderTextColor={coffee.secondary}
                  />

                  <Text style={styles.fieldLabel}>Alamat Fisik Cafe:</Text>
                  <TextInput
                    style={styles.inputField}
                    value={cafeAddress}
                    onChangeText={setCafeAddress}
                    placeholder="Alamat lengkap cafe..."
                    placeholderTextColor={coffee.secondary}
                  />

                  <Text style={styles.fieldLabel}>Nomor WhatsApp / Barista (Panggil Pelayan):</Text>
                  <TextInput
                    style={styles.inputField}
                    value={cafePhone}
                    onChangeText={setCafePhone}
                    placeholder="0812-xxxx-xxxx"
                    placeholderTextColor={coffee.secondary}
                  />

                  <Text style={styles.fieldLabel}>Deskripsi / Fasilitas (WiFi, Gapleh, dsb):</Text>
                  <TextInput
                    style={[styles.inputField, { height: 60 }]}
                    value={cafeDesc}
                    onChangeText={setCafeDesc}
                    placeholder="Deskripsi cafe..."
                    placeholderTextColor={coffee.secondary}
                    multiline
                  />

                  <Text style={styles.fieldLabel}>Reward Poin per Check-in (Default: 50):</Text>
                  <TextInput
                    style={styles.inputField}
                    value={rewardPoints}
                    onChangeText={setRewardPoints}
                    keyboardType="numeric"
                    placeholder="50"
                    placeholderTextColor={coffee.secondary}
                  />

                  <TouchableOpacity
                    style={[styles.primaryActionBtn, savingProfile && { opacity: 0.6 }]}
                    onPress={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="save" size={16} color="#fff" />
                        <Text style={styles.primaryActionText}>Simpan Pengaturan Cafe</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
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
    padding: 14,
  },
  container: {
    width: '100%',
    maxWidth: 600,
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
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: coffee.accentWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: coffee.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: coffee.secondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: coffee.background,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingHorizontal: 8,
    gap: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: coffee.accent,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: coffee.secondary,
  },
  tabBtnTextActive: {
    color: coffee.accent,
  },
  body: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: coffee.raised,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    color: coffee.accent,
  },
  statLabel: {
    fontSize: 10,
    color: coffee.secondary,
    marginTop: 2,
  },
  standingCardWrapper: {
    backgroundColor: coffee.raised,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  standingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  standingCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.text,
  },
  standingCardSub: {
    fontSize: 11,
    color: coffee.secondary,
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 16,
  },
  plakatMockup: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d4a373',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  plakatBrandBadge: {
    backgroundColor: '#3d2616',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  plakatBrandText: {
    color: '#d4a373',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  plakatCafeName: {
    color: '#2b1704',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  plakatInstruction: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    maxWidth: 280,
  },
  qrImage: {
    width: 170,
    height: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  plakatTokenBox: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 12,
  },
  plakatTokenText: {
    color: '#3d2616',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  plakatFooterUrl: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  plakatActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  plakatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: coffee.background,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  plakatActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: coffee.text,
  },
  cardBox: {
    backgroundColor: coffee.raised,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 14,
  },
  cardBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.text,
  },
  cardBoxSub: {
    fontSize: 11,
    color: coffee.secondary,
    marginTop: 2,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: coffee.text,
    marginTop: 8,
    marginBottom: 4,
  },
  inputField: {
    backgroundColor: coffee.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: coffee.text,
    fontSize: 12,
    marginBottom: 8,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: coffee.accent,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: coffee.text,
    marginBottom: 2,
  },
  sectionSubHeading: {
    fontSize: 11,
    color: coffee.secondary,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 11,
    color: coffee.secondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  promoItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    padding: 10,
    marginBottom: 8,
  },
  promoItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: coffee.text,
  },
  promoItemDesc: {
    fontSize: 10,
    color: coffee.secondary,
    marginTop: 2,
  },
  discountTag: {
    backgroundColor: 'rgba(234, 88, 12, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ea580c',
  },
  deletePromoBtn: {
    padding: 6,
  },
  visitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.background,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 8,
  },
  visitorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorName: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.text,
  },
  visitorTime: {
    fontSize: 10,
    color: coffee.secondary,
    marginTop: 1,
  },
  ptsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ptsBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10b981',
  },
});
