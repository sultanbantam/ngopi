import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import axios from 'axios';
import { getAuthHeaders } from '../utils/api';

const API_URL = 'https://api.ngopi.top/api';

export const ELEMENT_COLORS: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  fire: { bg: '#451a1a', border: '#ef4444', text: '#fca5a5', icon: '🔥', label: 'Api' },
  water: { bg: '#172554', border: '#3b82f6', text: '#93c5fd', icon: '💧', label: 'Air' },
  earth: { bg: '#3e2723', border: '#b45309', text: '#fcd34d', icon: '🌍', label: 'Tanah' },
  electric: { bg: '#422006', border: '#eab308', text: '#fef08a', icon: '⚡', label: 'Listrik' },
  grass: { bg: '#14532d', border: '#22c55e', text: '#86efac', icon: '🌿', label: 'Tumbuhan' },
  psychic: { bg: '#3b0764', border: '#a855f7', text: '#d8b4fe', icon: '🔮', label: 'Psikis' },
};

export const RARITY_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  common: { bg: '#334155', border: '#64748b', text: '#cbd5e1', label: 'BIASA' },
  rare: { bg: '#1e3a8a', border: '#3b82f6', text: '#93c5fd', label: 'LANGKA' },
  epic: { bg: '#581c87', border: '#a855f7', text: '#e9d5ff', label: 'EPIK' },
  legendary: { bg: '#78350f', border: '#f59e0b', text: '#fef08a', label: 'LEGENDA' },
};

interface UserCardItem {
  id: string;
  defId: string;
  name: string;
  type: string;
  rarity: string;
  isShiny: boolean;
  quantity: number;
  acquiredAt: string;
}

interface CardDef {
  id: string;
  name: string;
  type: string;
  hp: number;
  attack: number;
  defense: number;
  rarity: string;
  description: string;
  skillName: string;
  skillPower: number;
  skillDescription: string;
  icon: string;
}

interface TradeOffer {
  id: string;
  initiatorId: string;
  initiatorName: string;
  receiverId?: string;
  receiverName?: string;
  offerCardDefIds: string[];
  requestCardDefIds: string[];
  status: string;
  createdAt: string;
}

interface PokemonHubModalProps {
  visible: boolean;
  onClose: () => void;
  onStartBattle?: () => void;
}

export default function PokemonHubModal({ visible, onClose, onStartBattle }: PokemonHubModalProps) {
  const [activeTab, setActiveTab] = useState<'koleksi' | 'pack' | 'trade'>('koleksi');
  const [loading, setLoading] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [collection, setCollection] = useState<UserCardItem[]>([]);
  const [catalog, setCatalog] = useState<CardDef[]>([]);
  const [trades, setTrades] = useState<TradeOffer[]>([]);

  // Filter
  const [selectedElement, setSelectedElement] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');

  // Booster Pack Opening Animation State
  const [isOpeningPack, setIsOpeningPack] = useState(false);
  const [pulledCards, setPulledCards] = useState<any[] | null>(null);

  // Trade Modal State
  const [selectedOfferDefId, setSelectedOfferDefId] = useState<string>('');
  const [selectedRequestDefId, setSelectedRequestDefId] = useState<string>('');
  const [creatingTrade, setCreatingTrade] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [colRes, catRes, trdRes] = await Promise.all([
        axios.get(`${API_URL}/pokemon/collection`, { headers }),
        axios.get(`${API_URL}/pokemon/cards`, { headers }),
        axios.get(`${API_URL}/pokemon/trades`, { headers }),
      ]);

      if (colRes.data?.success) {
        setCollection(colRes.data.cards || []);
        setUserPoints(colRes.data.points || 0);
      }
      if (catRes.data?.success) {
        setCatalog(catRes.data.cards || []);
      }
      if (trdRes.data?.success) {
        setTrades(trdRes.data.trades || []);
      }
    } catch (e) {
      console.warn('Gagal memuat data pokemon:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible, fetchData]);

  // Open Booster Pack
  const handleOpenPack = async () => {
    setIsOpeningPack(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(`${API_URL}/pokemon/packs/open`, {}, { headers });
      if (res.data?.success) {
        setPulledCards(res.data.cards || []);
        if (typeof res.data.remainingPoints === 'number') {
          setUserPoints(res.data.remainingPoints);
        }
        // Refresh collection in background
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Gagal Membuka Paket', err?.response?.data?.error || 'Poin tidak mencukupi atau koneksi gagal.');
    } finally {
      setIsOpeningPack(false);
    }
  };

  // Create Trade Offer
  const handleCreateTrade = async () => {
    if (!selectedOfferDefId || !selectedRequestDefId) {
      Alert.alert('Peringatan', 'Pilih kartu yang ditawarkan dan kartu yang diinginkan.');
      return;
    }

    setCreatingTrade(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/pokemon/trade/create`,
        {
          offerCardDefIds: [selectedOfferDefId],
          requestCardDefIds: [selectedRequestDefId],
        },
        { headers }
      );

      if (res.data?.success) {
        Alert.alert('Sukses', 'Tawaran tukar kartu berhasil dipasang di bursa!');
        setSelectedOfferDefId('');
        setSelectedRequestDefId('');
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.response?.data?.error || 'Gagal membuat tawaran.');
    } finally {
      setCreatingTrade(false);
    }
  };

  // Respond Trade
  const handleRespondTrade = async (tradeId: string, accept: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.patch(
        `${API_URL}/pokemon/trade/${tradeId}/respond`,
        { accept },
        { headers }
      );

      if (res.data?.success) {
        Alert.alert('Berhasil', accept ? 'Tukar kartu berhasil dilaksanakan! 🎉' : 'Tawaran dibatalkan/ditolak.');
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.response?.data?.error || 'Gagal memproses tukar kartu.');
    }
  };

  // Filtered Cards
  const filteredCollection = collection.filter((item) => {
    if (selectedElement !== 'all' && item.type !== selectedElement) return false;
    if (selectedRarity !== 'all' && item.rarity !== selectedRarity) return false;
    return true;
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIconContainer}>
                <Text style={{ fontSize: 24 }}>🎴</Text>
              </View>
              <View>
                <Text style={styles.title}>Kartu Monster Nusantara</Text>
                <Text style={styles.subtitle}>Koleksi, Buka Booster & Duel Warkop</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.pointsBadge}>
                <Text style={{ fontSize: 13 }}>🪙</Text>
                <Text style={styles.pointsText}>{userPoints} Poin</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={coffee.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'koleksi' && styles.tabItemActive]}
              onPress={() => {
                setActiveTab('koleksi');
                setPulledCards(null);
              }}
            >
              <Ionicons
                name="albums-outline"
                size={18}
                color={activeTab === 'koleksi' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'koleksi' && styles.tabTextActive]}>
                Binder Koleksi ({collection.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'pack' && styles.tabItemActive]}
              onPress={() => setActiveTab('pack')}
            >
              <Ionicons
                name="gift-outline"
                size={18}
                color={activeTab === 'pack' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'pack' && styles.tabTextActive]}>
                Buka Paket Booster
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'trade' && styles.tabItemActive]}
              onPress={() => {
                setActiveTab('trade');
                setPulledCards(null);
              }}
            >
              <Ionicons
                name="swap-horizontal"
                size={18}
                color={activeTab === 'trade' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'trade' && styles.tabTextActive]}>
                Bursa Tukar ({trades.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading Indicator */}
          {loading && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={coffee.accent} />
              <Text style={{ color: coffee.muted, fontSize: 12, marginTop: 6 }}>Memuat kartu...</Text>
            </View>
          )}

          {/* TAB 1: BINDER KOLEKSI */}
          {activeTab === 'koleksi' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {/* Elemental Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <TouchableOpacity
                  style={[styles.chip, selectedElement === 'all' && styles.chipActive]}
                  onPress={() => setSelectedElement('all')}
                >
                  <Text style={[styles.chipText, selectedElement === 'all' && styles.chipTextActive]}>
                    Semua Elemen
                  </Text>
                </TouchableOpacity>
                {Object.entries(ELEMENT_COLORS).map(([key, meta]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.chip,
                      selectedElement === key && { backgroundColor: meta.border, borderColor: '#fff' },
                    ]}
                    onPress={() => setSelectedElement(key)}
                  >
                    <Text style={{ fontSize: 12, marginRight: 4 }}>{meta.icon}</Text>
                    <Text
                      style={[
                        styles.chipText,
                        selectedElement === key && { color: '#fff', fontWeight: 'bold' },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Rarity Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <TouchableOpacity
                  style={[styles.chip, selectedRarity === 'all' && styles.chipActive]}
                  onPress={() => setSelectedRarity('all')}
                >
                  <Text style={[styles.chipText, selectedRarity === 'all' && styles.chipTextActive]}>
                    Semua Kelangkaan
                  </Text>
                </TouchableOpacity>
                {Object.entries(RARITY_COLORS).map(([key, meta]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.chip,
                      selectedRarity === key && { backgroundColor: meta.border, borderColor: '#fff' },
                    ]}
                    onPress={() => setSelectedRarity(key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedRarity === key && { color: '#fff', fontWeight: 'bold' },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Cards Grid */}
              {filteredCollection.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>📭</Text>
                  <Text style={{ color: coffee.text, fontWeight: '700', fontSize: 15 }}>
                    Belum Ada Kartu yang Cocok
                  </Text>
                  <Text style={{ color: coffee.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    Buka paket booster untuk mendapatkan lebih banyak kartu makhluk mistis!
                  </Text>
                </View>
              ) : (
                <View style={styles.cardGrid}>
                  {filteredCollection.map((item) => {
                    const def = catalog.find((c) => c.id === item.defId);
                    const elem = ELEMENT_COLORS[item.type] || ELEMENT_COLORS.fire!;
                    const rar = RARITY_COLORS[item.rarity] || RARITY_COLORS.common!;

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.cardItem,
                          {
                            backgroundColor: elem.bg,
                            borderColor: item.isShiny ? '#fbbf24' : elem.border,
                            borderWidth: item.isShiny ? 2 : 1,
                          },
                        ]}
                      >
                        {/* Shiny Tag */}
                        {item.isShiny && (
                          <View style={styles.shinyBadge}>
                            <Text style={{ fontSize: 9, color: '#000', fontWeight: '900' }}>✨ SHINY</Text>
                          </View>
                        )}

                        {/* Top: Name & Type Icon */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12, flex: 1 }} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: 14 }}>{elem.icon}</Text>
                        </View>

                        {/* Creature Icon */}
                        <View style={{ alignItems: 'center', marginVertical: 6 }}>
                          <Text style={{ fontSize: 36 }}>{def?.icon || '🐾'}</Text>
                        </View>

                        {/* Stats Bar */}
                        <View style={styles.statsRow}>
                          <Text style={{ fontSize: 10, color: '#86efac', fontWeight: 'bold' }}>
                            HP {def?.hp || 100}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#fca5a5', fontWeight: 'bold' }}>
                            ATK {def?.attack || 30}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#93c5fd', fontWeight: 'bold' }}>
                            DEF {def?.defense || 20}
                          </Text>
                        </View>

                        {/* Skill Name */}
                        {def?.skillName && (
                          <View style={{ marginTop: 4, backgroundColor: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, color: '#fef08a', fontWeight: '700' }} numberOfLines={1}>
                              ⚡ {def.skillName} ({def.skillPower})
                            </Text>
                          </View>
                        )}

                        {/* Footer: Rarity & Quantity */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          <View style={[styles.rarityTag, { backgroundColor: rar.bg, borderColor: rar.border }]}>
                            <Text style={{ fontSize: 8, color: rar.text, fontWeight: 'bold' }}>{rar.label}</Text>
                          </View>
                          <Text style={{ fontSize: 10, color: coffee.accent, fontWeight: '900' }}>
                            x{item.quantity}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {/* TAB 2: BUKA PAKET BOOSTER (GACHA) */}
          {activeTab === 'pack' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
              <View style={styles.packHeroContainer}>
                <Text style={{ fontSize: 60, marginBottom: 10 }}>🎁</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: coffee.accent }}>
                  Booster Pack Kartu Monster
                </Text>
                <Text style={{ fontSize: 13, color: coffee.text, textAlign: 'center', marginTop: 4, maxWidth: 300 }}>
                  Setiap paket berisi 3 kartu acak dari seluruh kepulauan Nusantara. Peluang kartu Legendaris & Shiny Foil berkilau!
                </Text>

                <View style={styles.oddsBox}>
                  <Text style={{ fontSize: 11, color: coffee.muted }}>
                    📊 Peluang: Biasa 65% | Langka 23% | Epik 9% | Legenda 3% | Shiny 6%
                  </Text>
                </View>

                {/* Open Button */}
                <TouchableOpacity
                  style={[styles.openPackBtn, isOpeningPack && { opacity: 0.7 }]}
                  disabled={isOpeningPack}
                  onPress={handleOpenPack}
                >
                  {isOpeningPack ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="flash" size={18} color="#fff" />
                      <Text style={styles.openPackBtnText}>Buka Paket (100 Poin)</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={{ fontSize: 11, color: coffee.muted, marginTop: 8 }}>
                  Saldo Anda: {userPoints} Poin Ngopi
                </Text>
              </View>

              {/* Pulled Cards Reveal */}
              {pulledCards && (
                <View style={{ width: '100%', marginTop: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#fef08a', textAlign: 'center', marginBottom: 12 }}>
                    ✨ HASIL BUKA PAKET! ✨
                  </Text>
                  <View style={styles.cardGrid}>
                    {pulledCards.map((card, idx) => {
                      const elem = ELEMENT_COLORS[card.type] || ELEMENT_COLORS.fire!;
                      const rar = RARITY_COLORS[card.rarity] || RARITY_COLORS.common!;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.cardItem,
                            {
                              backgroundColor: elem.bg,
                              borderColor: card.isShiny ? '#fbbf24' : elem.border,
                              borderWidth: card.isShiny ? 2.5 : 1,
                            },
                          ]}
                        >
                          {card.isShiny && (
                            <View style={styles.shinyBadge}>
                              <Text style={{ fontSize: 9, color: '#000', fontWeight: '900' }}>✨ SHINY!</Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{card.name}</Text>
                            <Text>{elem.icon}</Text>
                          </View>
                          <View style={{ alignItems: 'center', marginVertical: 8 }}>
                            <Text style={{ fontSize: 40 }}>{card.icon || '🐾'}</Text>
                          </View>
                          <View style={styles.statsRow}>
                            <Text style={{ fontSize: 10, color: '#86efac', fontWeight: 'bold' }}>HP {card.maxHp}</Text>
                            <Text style={{ fontSize: 10, color: '#fca5a5', fontWeight: 'bold' }}>ATK {card.attack}</Text>
                          </View>
                          <View style={{ marginTop: 6, alignItems: 'center' }}>
                            <View style={[styles.rarityTag, { backgroundColor: rar.bg, borderColor: rar.border }]}>
                              <Text style={{ fontSize: 9, color: rar.text, fontWeight: 'bold' }}>{rar.label}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* TAB 3: BURSA TUKAR KARTU (TRADE) */}
          {activeTab === 'trade' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {/* Create Trade Offer Section */}
              <View style={styles.createTradeCard}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: coffee.accent, marginBottom: 8 }}>
                  🤝 Pasang Tawaran Tukar Baru
                </Text>

                <Text style={{ fontSize: 11, color: coffee.muted, marginBottom: 4 }}>Kartu yang Anda Tawarkan:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {collection.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.tradeSelectChip,
                        selectedOfferDefId === c.defId && styles.tradeSelectChipActive,
                      ]}
                      onPress={() => setSelectedOfferDefId(c.defId)}
                    >
                      <Text style={{ fontSize: 11, color: selectedOfferDefId === c.defId ? '#fff' : coffee.text }}>
                        {c.name} (x{c.quantity})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={{ fontSize: 11, color: coffee.muted, marginBottom: 4 }}>Kartu yang Anda Inginkan:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {catalog.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.tradeSelectChip,
                        selectedRequestDefId === c.id && styles.tradeSelectChipActive,
                      ]}
                      onPress={() => setSelectedRequestDefId(c.id)}
                    >
                      <Text style={{ fontSize: 11, color: selectedRequestDefId === c.id ? '#fff' : coffee.text }}>
                        {c.name} ({c.type.toUpperCase()})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.postTradeBtn, creatingTrade && { opacity: 0.7 }]}
                  disabled={creatingTrade}
                  onPress={handleCreateTrade}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                    {creatingTrade ? 'Memasang...' : 'Pasang Tawaran ke Bursa'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Active Trades List */}
              <Text style={{ fontSize: 14, fontWeight: '900', color: coffee.text, marginTop: 16, marginBottom: 8 }}>
                Daftar Tawaran di Warung Kopi:
              </Text>

              {trades.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 30, marginBottom: 6 }}>📭</Text>
                  <Text style={{ color: coffee.muted, fontSize: 13 }}>Belum ada tawaran tukar kartu yang aktif.</Text>
                </View>
              ) : (
                trades.map((trade) => {
                  const offerCard = catalog.find((c) => c.id === trade.offerCardDefIds[0]);
                  const reqCard = catalog.find((c) => c.id === trade.requestCardDefIds[0]);
                  const isPending = trade.status === 'pending';

                  return (
                    <View key={trade.id} style={styles.tradeItem}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: coffee.accent }}>
                          @{trade.initiatorName}
                        </Text>
                        <Text style={{ fontSize: 10, color: isPending ? '#22c55e' : coffee.muted, fontWeight: 'bold' }}>
                          {trade.status.toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginVertical: 10 }}>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 10, color: coffee.muted }}>Menawarkan:</Text>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', marginTop: 2 }}>
                            {offerCard?.name || trade.offerCardDefIds[0]}
                          </Text>
                        </View>

                        <Ionicons name="arrow-forward" size={18} color={coffee.accent} />

                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 10, color: coffee.muted }}>Mencari:</Text>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', marginTop: 2 }}>
                            {reqCard?.name || trade.requestCardDefIds[0]}
                          </Text>
                        </View>
                      </View>

                      {isPending && (
                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                          <TouchableOpacity
                            style={[styles.tradeActionBtn, { backgroundColor: '#15803d' }]}
                            onPress={() => handleRespondTrade(trade.id, true)}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Terima Tukar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.tradeActionBtn, { backgroundColor: '#991b1b' }]}
                            onPress={() => handleRespondTrade(trade.id, false)}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Batalkan</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Footer Action */}
          <View style={styles.footer}>
            {onStartBattle && (
              <TouchableOpacity style={styles.battleCtaBtn} onPress={onStartBattle}>
                <Ionicons name="game-controller" size={18} color="#fff" />
                <Text style={styles.battleCtaText}>Masuk Arena Duel Monster</Text>
              </TouchableOpacity>
            )}
          </View>
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
    padding: 12,
  },
  container: {
    width: '100%',
    maxWidth: 580,
    height: '90%',
    backgroundColor: '#1b130e',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#4a3319',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3a2512',
    backgroundColor: '#26180f',
  },
  headerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(212, 163, 115, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: coffee.accent,
  },
  subtitle: {
    fontSize: 11,
    color: coffee.muted,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3b2513',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: coffee.accent,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '800',
    color: coffee.accent,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#3a2512',
    backgroundColor: '#1f130a',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: coffee.accent,
    backgroundColor: 'rgba(212, 163, 115, 0.08)',
  },
  tabText: {
    fontSize: 12,
    color: coffee.muted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#2b1b11',
    borderWidth: 1,
    borderColor: '#4a3319',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: coffee.accent,
    borderColor: '#fff',
  },
  chipText: {
    fontSize: 11,
    color: coffee.muted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1b130e',
    fontWeight: '800',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardItem: {
    width: '48%',
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  shinyBadge: {
    position: 'absolute',
    top: -6,
    right: 8,
    backgroundColor: '#fef08a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#b45309',
    zIndex: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    paddingVertical: 3,
  },
  rarityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  packHeroContainer: {
    alignItems: 'center',
    backgroundColor: '#26180f',
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a3319',
    width: '100%',
  },
  oddsBox: {
    marginTop: 12,
    backgroundColor: '#1b110a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a2512',
  },
  openPackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ea580c',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
    shadowColor: '#ea580c',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  openPackBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  createTradeCard: {
    backgroundColor: '#26180f',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a3319',
  },
  tradeSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#19110b',
    borderWidth: 1,
    borderColor: '#3a2512',
    marginRight: 6,
  },
  tradeSelectChipActive: {
    backgroundColor: coffee.accent,
    borderColor: '#fff',
  },
  postTradeBtn: {
    backgroundColor: coffee.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  tradeItem: {
    backgroundColor: '#26180f',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a2512',
    marginBottom: 8,
  },
  tradeActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#3a2512',
    backgroundColor: '#1f130a',
  },
  battleCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c2d12',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ea580c',
  },
  battleCtaText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
});
