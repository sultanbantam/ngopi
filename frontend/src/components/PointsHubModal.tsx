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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

interface UserPointsData {
  user_id: string;
  balance: number;
  lifetime: number;
  streak_days: number;
  last_login_date: string;
  daily_chat_count: number;
  daily_reaction_count: number;
}

interface PointsTransactionItem {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: number;
}

interface PremiumFeatureItem {
  id: string;
  name: string;
  price_points: number;
  price_bmc?: number;
  description: string;
  category: string;
  icon: string;
}

interface WatchPartyItem {
  id: string;
  host_id: string;
  host_name: string;
  title: string;
  video_url: string;
  current_time: number;
  is_playing: boolean;
  participants: Array<{ user_id: string; user_name: string }>;
}

interface PointsHubModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenWatchParty?: (partyId: string) => void;
}

export default function PointsHubModal({ visible, onClose, onOpenWatchParty }: PointsHubModalProps) {
  const [activeTab, setActiveTab] = useState<'balance' | 'premium' | 'convert' | 'cinema'>('balance');
  const [pointsData, setPointsData] = useState<UserPointsData | null>(null);
  const [transactions, setTransactions] = useState<PointsTransactionItem[]>([]);
  const [catalog, setCatalog] = useState<PremiumFeatureItem[]>([]);
  const [watchParties, setWatchParties] = useState<WatchPartyItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Conversion Form
  const [convertPointsAmount, setConvertPointsAmount] = useState(1000);
  const [walletAddress, setWalletAddress] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // Cinema Form
  const [cinemaTitle, setCinemaTitle] = useState('');
  const [cinemaUrl, setCinemaUrl] = useState('');
  const [isCreatingCinema, setIsCreatingCinema] = useState(false);

  const fetchEconomyData = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      // 1. Fetch points balance
      const resPoints = await axios.get(`${API_URL}/bmc/points/me`, { headers }).catch(() => null);
      if (resPoints?.data?.points) {
        setPointsData(resPoints.data.points);
      } else {
        // Fallback demo data
        setPointsData({
          user_id: 'me',
          balance: 350,
          lifetime: 420,
          streak_days: 3,
          last_login_date: new Date().toISOString().slice(0, 10),
          daily_chat_count: 14,
          daily_reaction_count: 6,
        });
      }

      // 2. Fetch transactions
      const resTx = await axios.get(`${API_URL}/bmc/points/transactions`, { headers }).catch(() => null);
      if (resTx?.data?.transactions) {
        setTransactions(resTx.data.transactions);
      }

      // 3. Fetch catalog
      const resCatalog = await axios.get(`${API_URL}/bmc/premium/catalog`, { headers }).catch(() => null);
      if (resCatalog?.data?.catalog) {
        setCatalog(resCatalog.data.catalog);
      }

      // 4. Fetch watch parties
      const resParties = await axios.get(`${API_URL}/bmc/watch-party/list`, { headers }).catch(() => null);
      if (resParties?.data?.parties) {
        setWatchParties(resParties.data.parties);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchEconomyData();
    }
  }, [visible]);

  const handleClaimStreak = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(`${API_URL}/bmc/points/streak/claim`, {}, { headers });
      if (res.data?.success) {
        Alert.alert('Streak Diklaim! 🔥', res.data.message || `+${res.data.pointsAdded} Poin ditambahkan!`);
        fetchEconomyData();
      } else {
        Alert.alert('Info', res.data?.message || 'Streak hari ini sudah diklaim.');
      }
    } catch (err: any) {
      Alert.alert('Info', err.response?.data?.error || 'Streak hari ini sudah diklaim.');
    }
  };

  const handlePurchaseFeature = async (feature: PremiumFeatureItem) => {
    Alert.alert(
      'Konfirmasi Pembelian',
      `Beli "${feature.name}" seharga ${feature.price_points} Poin Ngopi?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Beli Sekarang',
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const res = await axios.post(
                `${API_URL}/bmc/premium/buy`,
                { feature_id: feature.id },
                { headers }
              );
              if (res.data?.success) {
                Alert.alert('Berhasil! 🎉', `Fitur "${feature.name}" berhasil diaktifkan.`);
                fetchEconomyData();
              }
            } catch (err: any) {
              Alert.alert('Gagal Membeli', err.response?.data?.error || 'Poin tidak mencukupi.');
            }
          },
        },
      ]
    );
  };

  const handleConvertBmc = async () => {
    if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      Alert.alert('Alamat Dompet Tidak Valid', 'Masukkan alamat dompet BaMbooChain (0x... 42 karakter).');
      return;
    }

    if (convertPointsAmount < 1000 || convertPointsAmount % 1000 !== 0) {
      Alert.alert('Jumlah Tidak Valid', 'Konversi harus dalam kelipatan 1.000 Poin (1.000 Poin = 1 BMC).');
      return;
    }

    const bmcToReceive = convertPointsAmount / 1000;

    Alert.alert(
      'Konfirmasi Konversi On-Chain',
      `Tukar ${convertPointsAmount.toLocaleString()} Poin menjadi ${bmcToReceive} Token BMC ke alamat:\n${walletAddress}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Konversi Sekarang',
          onPress: async () => {
            try {
              setIsConverting(true);
              const headers = await getAuthHeaders();
              const res = await axios.post(
                `${API_URL}/bmc/points/convert`,
                {
                  points_to_convert: convertPointsAmount,
                  wallet_address: walletAddress,
                },
                { headers }
              );

              if (res.data?.success) {
                Alert.alert(
                  'Konversi Berhasil! 🚀',
                  `Berhasil mencetak ${res.data.bmc_awarded} Token BMC!\nHash Transaksi: ${res.data.tx_hash.slice(0, 14)}...`
                );
                fetchEconomyData();
              }
            } catch (err: any) {
              Alert.alert('Gagal Konversi', err.response?.data?.error || 'Terjadi kesalahan.');
            } finally {
              setIsConverting(false);
            }
          },
        },
      ]
    );
  };

  const handleCreateWatchParty = async () => {
    if (!cinemaTitle.trim() || !cinemaUrl.trim()) {
      Alert.alert('Data Belum Lengkap', 'Masukkan judul dan link YouTube/video.');
      return;
    }

    try {
      setIsCreatingCinema(true);
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/bmc/watch-party/create`,
        {
          title: cinemaTitle.trim(),
          video_url: cinemaUrl.trim(),
        },
        { headers }
      );

      if (res.data?.success) {
        Alert.alert('Ruang Bioskop Dibuka! 🎬', 'Ruang nonton bareng telah aktif.');
        setCinemaTitle('');
        setCinemaUrl('');
        fetchEconomyData();
        if (onOpenWatchParty && res.data.party?.id) {
          onClose();
          onOpenWatchParty(res.data.party.id);
        }
      }
    } catch (err: any) {
      Alert.alert('Gagal Membuat Ruang', err.response?.data?.error || 'Poin tidak mencukupi (100 Poin).');
    } finally {
      setIsCreatingCinema(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.coinIconBadge}>
                <Ionicons name="sparkles" size={16} color="#FFF" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Ekonomi Ngopi & BMC Token</Text>
                <Text style={styles.headerSubtitle}>
                  Saldo: {pointsData?.balance?.toLocaleString() || 0} Poin (~{( (pointsData?.balance || 0) / 1000).toFixed(2)} BMC)
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={coffee.cream} />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'balance' && styles.tabBtnActive]}
              onPress={() => setActiveTab('balance')}
            >
              <Ionicons
                name="wallet-outline"
                size={14}
                color={activeTab === 'balance' ? '#FFF' : coffee.textSecondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'balance' && styles.tabBtnTextActive]}>
                Poin & Misi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'premium' && styles.tabBtnActive]}
              onPress={() => setActiveTab('premium')}
            >
              <Ionicons
                name="ribbon-outline"
                size={14}
                color={activeTab === 'premium' ? '#FFF' : coffee.textSecondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'premium' && styles.tabBtnTextActive]}>
                Katalog
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'convert' && styles.tabBtnActive]}
              onPress={() => setActiveTab('convert')}
            >
              <Ionicons
                name="swap-horizontal"
                size={14}
                color={activeTab === 'convert' ? '#FFF' : coffee.textSecondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'convert' && styles.tabBtnTextActive]}>
                Tukar BMC
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'cinema' && styles.tabBtnActive]}
              onPress={() => setActiveTab('cinema')}
            >
              <Ionicons
                name="videocam-outline"
                size={14}
                color={activeTab === 'cinema' ? '#FFF' : coffee.textSecondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'cinema' && styles.tabBtnTextActive]}>
                Bioskop
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={coffee.primary} />
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* TAB 1: POIN & MISI */}
              {activeTab === 'balance' && (
                <View>
                  {/* Saldo Card */}
                  <View style={styles.balanceCard}>
                    <View style={styles.balanceTopRow}>
                      <View>
                        <Text style={styles.balanceLabel}>Total Saldo Poin Ngopi</Text>
                        <Text style={styles.balanceAmount}>
                          🪙 {pointsData?.balance?.toLocaleString() || 0}
                        </Text>
                      </View>
                      <View style={styles.streakBadge}>
                        <Text style={styles.streakBadgeText}>🔥 {pointsData?.streak_days || 1} Hari</Text>
                      </View>
                    </View>

                    <View style={styles.balanceBottomRow}>
                      <Text style={styles.lifetimeText}>
                        Total Perolehan: {pointsData?.lifetime?.toLocaleString() || 0} Poin
                      </Text>
                      <TouchableOpacity style={styles.claimStreakBtn} onPress={handleClaimStreak}>
                        <Text style={styles.claimStreakBtnText}>Klaim Streak Harian</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Cara Mendapat Poin Warkop */}
                  <Text style={styles.sectionTitle}>Cara Mendapat Poin Warkop</Text>
                  
                  {/* Banner Checkin 7 Hari */}
                  <View style={{ backgroundColor: 'rgba(212, 163, 115, 0.12)', borderWidth: 1, borderColor: coffee.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: coffee.accent, fontWeight: '800', fontSize: 13 }}>
                        📅 Check-in Harian (Siklus 07.00 - 07.00 WIB)
                      </Text>
                      <Text style={{ color: coffee.secondary, fontSize: 11 }}>Syarat Berturut-turut</Text>
                    </View>
                    <Text style={{ color: coffee.text, fontSize: 11, lineHeight: 16, marginBottom: 8 }}>
                      Check-in setiap hari untuk akumulasi poin makin besar. Dihitung mulai jam 07.00 sampai jam 07.00 WIB. Jika terlewat tidak check-in di hari tertentu, streak akan direset kembali ke Hari 1:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' }}>
                      {[
                        { day: 1, pts: 1 },
                        { day: 2, pts: 3 },
                        { day: 3, pts: 5 },
                        { day: 4, pts: 7 },
                        { day: 5, pts: 9 },
                        { day: 6, pts: 11 },
                        { day: 7, pts: 20 },
                      ].map((s) => {
                        const currentCycleDay = ((pointsData?.streak_days || 1) - 1) % 7 + 1;
                        const isCurrent = currentCycleDay === s.day;
                        return (
                          <View
                            key={s.day}
                            style={{
                              flex: 1,
                              minWidth: 40,
                              backgroundColor: isCurrent ? coffee.accent : 'rgba(0,0,0,0.3)',
                              borderRadius: 8,
                              paddingVertical: 6,
                              paddingHorizontal: 2,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: isCurrent ? '#fde047' : coffee.border,
                            }}
                          >
                            <Text style={{ fontSize: 9, color: isCurrent ? '#171411' : coffee.secondary, fontWeight: '700' }}>
                              H-{s.day}
                            </Text>
                            <Text style={{ fontSize: 12, color: isCurrent ? '#171411' : '#fff', fontWeight: '900' }}>
                              +{s.pts}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.earningGrid}>
                    <View style={styles.earningItem}>
                      <Text style={styles.earningEmoji}>🤝</Text>
                      <View style={styles.earningInfo}>
                        <Text style={styles.earningTitle}>Referral Teman (Kode Unik)</Text>
                        <Text style={styles.earningSub}>+50 Poin untuk setiap teman yang mendaftar menggunakan kode referral Anda!</Text>
                      </View>
                    </View>

                    <View style={styles.earningItem}>
                      <Text style={styles.earningEmoji}>💬</Text>
                      <View style={styles.earningInfo}>
                        <Text style={styles.earningTitle}>Kirim Pesan Chat Warkop</Text>
                        <Text style={styles.earningSub}>+1 Poin (maks 50/hari) • Hari ini: {pointsData?.daily_chat_count || 0}/50</Text>
                      </View>
                    </View>

                    <View style={styles.earningItem}>
                      <Text style={styles.earningEmoji}>☕</Text>
                      <View style={styles.earningInfo}>
                        <Text style={styles.earningTitle}>Dapat Reaksi Teman</Text>
                        <Text style={styles.earningSub}>+2 Poin (maks 20/hari) • Hari ini: {pointsData?.daily_reaction_count || 0}/20</Text>
                      </View>
                    </View>

                    <View style={styles.earningItem}>
                      <Text style={styles.earningEmoji}>🎮</Text>
                      <View style={styles.earningInfo}>
                        <Text style={styles.earningTitle}>Main & Menang Game</Text>
                        <Text style={styles.earningSub}>+10 Poin saat menyelesaikan match, +25 Poin bonus juara!</Text>
                      </View>
                    </View>
                  </View>

                  {/* Riwayat Transaksi */}
                  <Text style={styles.sectionTitle}>Riwayat Mutasi Poin</Text>
                  {transactions.length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada riwayat transaksi.</Text>
                  ) : (
                    transactions.slice(0, 10).map((tx) => (
                      <View key={tx.id} style={styles.txRow}>
                        <View style={styles.txLeft}>
                          <Text style={styles.txDesc}>{tx.description}</Text>
                          <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={[styles.txAmount, tx.amount > 0 ? styles.txPositive : styles.txNegative]}>
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 2: KATALOG PREMIUM */}
              {activeTab === 'premium' && (
                <View>
                  <Text style={styles.sectionTitle}>Katalog Fitur & Manfaat Premium</Text>
                  {catalog.map((item) => (
                    <View key={item.id} style={styles.catalogCard}>
                      <View style={styles.catalogTopRow}>
                        <View style={styles.catalogIconBox}>
                          <Ionicons name={item.icon as any || 'star'} size={20} color={coffee.primary} />
                        </View>
                        <View style={styles.catalogTextCol}>
                          <Text style={styles.catalogTitle}>{item.name}</Text>
                          <Text style={styles.catalogDesc}>{item.description}</Text>
                        </View>
                      </View>

                      <View style={styles.catalogBottomRow}>
                        <View style={styles.priceTagCol}>
                          <Text style={styles.pricePointsText}>🪙 {item.price_points} Poin</Text>
                          {item.price_bmc && (
                            <Text style={styles.priceBmcText}>atau {item.price_bmc} BMC</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.buyBtn}
                          onPress={() => handlePurchaseFeature(item)}
                        >
                          <Text style={styles.buyBtnText}>Beli Fitur</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* TAB 3: TUKAR KE BMC */}
              {activeTab === 'convert' && (
                <View>
                  <View style={styles.convertHeroCard}>
                    <Ionicons name="swap-horizontal-outline" size={32} color={coffee.primary} />
                    <Text style={styles.convertHeroTitle}>Bridge Poin Ngopi ➔ Token BMC</Text>
                    <Text style={styles.convertHeroSub}>
                      Tukarkan hasil interaksi dan kemenangan game Anda menjadi token crypto nyata di Bamboochain.
                    </Text>
                    <View style={styles.rateBadge}>
                      <Text style={styles.rateBadgeText}>Kurs Resmi: 1.000 Poin = 1 BMC Token</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>Pilih Jumlah Poin yang Ingin Ditukar</Text>
                  <View style={styles.presetRow}>
                    {[1000, 2000, 5000].map((amt) => (
                      <TouchableOpacity
                        key={amt}
                        style={[styles.presetBtn, convertPointsAmount === amt && styles.presetBtnActive]}
                        onPress={() => setConvertPointsAmount(amt)}
                      >
                        <Text style={[styles.presetText, convertPointsAmount === amt && styles.presetTextActive]}>
                          {amt.toLocaleString()} Poin
                        </Text>
                        <Text style={styles.presetSubText}>({amt / 1000} BMC)</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Alamat Dompet Bamboochain (0x...):</Text>
                  <TextInput
                    style={styles.walletInput}
                    placeholder="0x1234... (Alamat BSC / Bamboochain)"
                    placeholderTextColor={coffee.textSecondary}
                    value={walletAddress}
                    onChangeText={setWalletAddress}
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={[styles.convertSubmitBtn, isConverting && { opacity: 0.6 }]}
                    onPress={handleConvertBmc}
                    disabled={isConverting}
                  >
                    {isConverting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.convertSubmitText}>
                        Konversi {convertPointsAmount.toLocaleString()} Poin ➔ {convertPointsAmount / 1000} BMC
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB 4: RUANG BIOSKOP */}
              {activeTab === 'cinema' && (
                <View>
                  {/* Create Cinema Form */}
                  <View style={styles.cinemaCreateCard}>
                    <Text style={styles.cinemaFormTitle}>Buka Ruang Bioskop Warkop (100 Poin)</Text>
                    <Text style={styles.cinemaFormSub}>
                      Nonton video/YouTube bersama kawan warkop dengan kontrol playback tersinkron secara real-time.
                    </Text>

                    <TextInput
                      style={styles.cinemaInput}
                      placeholder="Judul Acara Nonton Bareng..."
                      placeholderTextColor={coffee.textSecondary}
                      value={cinemaTitle}
                      onChangeText={setCinemaTitle}
                    />

                    <TextInput
                      style={styles.cinemaInput}
                      placeholder="URL Video / YouTube..."
                      placeholderTextColor={coffee.textSecondary}
                      value={cinemaUrl}
                      onChangeText={setCinemaUrl}
                      autoCapitalize="none"
                    />

                    <TouchableOpacity
                      style={[styles.createCinemaBtn, isCreatingCinema && { opacity: 0.6 }]}
                      onPress={handleCreateWatchParty}
                      disabled={isCreatingCinema}
                    >
                      {isCreatingCinema ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.createCinemaBtnText}>Sewa Ruang (100 Poin)</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Active Watch Parties */}
                  <Text style={styles.sectionTitle}>Ruang Bioskop Sedang Berlangsung ({watchParties.length})</Text>
                  {watchParties.length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada ruang nonton bareng aktif. Jadilah yang pertama!</Text>
                  ) : (
                    watchParties.map((wp) => (
                      <View key={wp.id} style={styles.partyCard}>
                        <View style={styles.partyInfoCol}>
                          <Text style={styles.partyTitle}>{wp.title}</Text>
                          <Text style={styles.partyHost}>Host: {wp.host_name}</Text>
                          <Text style={styles.partyCount}>
                            👥 {wp.participants?.length || 1} Penonton • {wp.is_playing ? '▶️ Sedang Memutar' : '⏸️ Dijeda'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.joinPartyBtn}
                          onPress={() => {
                            onClose();
                            if (onOpenWatchParty) onOpenWatchParty(wp.id);
                          }}
                        >
                          <Text style={styles.joinPartyBtnText}>Masuk</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
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
  coinIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFA000', // Gold/amber
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: coffee.primary,
  },
  tabBtnText: {
    color: coffee.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  balanceCard: {
    backgroundColor: '#3E2723',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#5D4037',
    marginBottom: 16,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  balanceLabel: {
    color: '#D7CCC8',
    fontSize: 12,
  },
  balanceAmount: {
    color: '#FFD54F',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 160, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakBadgeText: {
    color: '#FFD54F',
    fontSize: 12,
    fontWeight: '700',
  },
  balanceBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
  },
  lifetimeText: {
    color: '#B0BEC5',
    fontSize: 11,
  },
  claimStreakBtn: {
    backgroundColor: '#FF8F00',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  claimStreakBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '700',
    marginVertical: 10,
  },
  earningGrid: {
    gap: 8,
    marginBottom: 16,
  },
  earningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.raised,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    gap: 10,
  },
  earningEmoji: {
    fontSize: 20,
  },
  earningInfo: {
    flex: 1,
  },
  earningTitle: {
    color: coffee.cream,
    fontSize: 12,
    fontWeight: '700',
  },
  earningSub: {
    color: coffee.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },
  emptyText: {
    color: coffee.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: coffee.raised,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 6,
  },
  txLeft: {
    flex: 1,
  },
  txDesc: {
    color: coffee.cream,
    fontSize: 11,
    fontWeight: '600',
  },
  txDate: {
    color: coffee.textSecondary,
    fontSize: 9,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  txPositive: {
    color: '#4CAF50',
  },
  txNegative: {
    color: '#FF7043',
  },
  catalogCard: {
    backgroundColor: coffee.raised,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 10,
  },
  catalogTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  catalogIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(228, 181, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogTextCol: {
    flex: 1,
  },
  catalogTitle: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  catalogDesc: {
    color: coffee.textSecondary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  catalogBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: coffee.border,
    paddingTop: 8,
  },
  priceTagCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pricePointsText: {
    color: '#FFD54F',
    fontSize: 13,
    fontWeight: '700',
  },
  priceBmcText: {
    color: coffee.textSecondary,
    fontSize: 10,
  },
  buyBtn: {
    backgroundColor: coffee.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buyBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  convertHeroCard: {
    backgroundColor: '#1E3A8A', // Deep navy
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6',
    marginBottom: 16,
  },
  convertHeroTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  convertHeroSub: {
    color: '#93C5FD',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  rateBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 10,
  },
  rateBadgeText: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: coffee.raised,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
  },
  presetBtnActive: {
    borderColor: coffee.primary,
    backgroundColor: 'rgba(228, 181, 128, 0.15)',
  },
  presetText: {
    color: coffee.cream,
    fontSize: 11,
    fontWeight: '700',
  },
  presetTextActive: {
    color: coffee.primary,
  },
  presetSubText: {
    color: coffee.textSecondary,
    fontSize: 9,
    marginTop: 1,
  },
  inputLabel: {
    color: coffee.cream,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  walletInput: {
    backgroundColor: coffee.raised,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: coffee.cream,
    borderWidth: 1,
    borderColor: coffee.border,
    fontSize: 11,
    marginBottom: 14,
  },
  convertSubmitBtn: {
    backgroundColor: '#059669', // Emerald green
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  convertSubmitText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cinemaCreateCard: {
    backgroundColor: coffee.raised,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 16,
  },
  cinemaFormTitle: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  cinemaFormSub: {
    color: coffee.textSecondary,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 15,
  },
  cinemaInput: {
    backgroundColor: coffee.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: coffee.cream,
    borderWidth: 1,
    borderColor: coffee.border,
    fontSize: 12,
    marginBottom: 8,
  },
  createCinemaBtn: {
    backgroundColor: coffee.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  createCinemaBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  partyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: coffee.raised,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 8,
  },
  partyInfoCol: {
    flex: 1,
  },
  partyTitle: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  partyHost: {
    color: coffee.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  partyCount: {
    color: coffee.primary,
    fontSize: 10,
    marginTop: 4,
  },
  joinPartyBtn: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  joinPartyBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
