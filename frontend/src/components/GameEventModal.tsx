import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { coffee } from '../theme/coffee';
import axios from 'axios';
import { getAuthHeaders } from '../utils/api';

const API_URL = 'https://api.ngopi.top/api';

const GAME_OPTIONS = [
  { id: 'gapleh', label: 'Gapleh', icon: 'dots-vertical', emoji: '🁫' },
  { id: 'catur', label: 'Catur', icon: 'chess-knight', emoji: '♟️' },
  { id: 'uno', label: 'UNO', icon: 'cards-playing-outline', emoji: '🂠' },
  { id: 'snake_ladder', label: 'Ular Tangga', icon: 'dice-multiple', emoji: '🎲' },
  { id: 'monopoly', label: 'Monopoli', icon: 'home-city-outline', emoji: '🏢' },
  { id: 'pokemon', label: 'Monster TCG', icon: 'sword-cross', emoji: '🎴' },
  { id: 'remi', label: 'Remi', icon: 'cards-playing-outline', emoji: '🃏' },
  { id: 'poker', label: 'Poker', icon: 'cards-spade', emoji: '♠️' },
  { id: 'bridge', label: 'Bridge', icon: 'bridge', emoji: '🌉' },
  { id: 'truf', label: 'Truf', icon: 'cards-diamond', emoji: '♦️' },
];

interface GameEventInvitation {
  id: string;
  eventId: string;
  inviteeId: string;
  inviteeName: string;
  message?: string | null;
  status: 'pending' | 'accepted' | 'declined';
  respondedAt?: string | null;
  createdAt: string;
}

interface GameEvent {
  id: string;
  hostId: string;
  hostName: string;
  warungId?: string | null;
  gameType: string;
  title: string;
  description?: string | null;
  scheduledAt: string;
  durationMin: number;
  maxPlayers: number;
  isPrivate: boolean;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  tableId?: string | null;
  invitations: GameEventInvitation[];
  createdAt: string;
}

interface GameEventModalProps {
  visible: boolean;
  onClose: () => void;
  onEventStarted?: (tableId: string) => void;
}

export default function GameEventModal({ visible, onClose, onEventStarted }: GameEventModalProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'invited' | 'create'>('my');
  const [loading, setLoading] = useState(false);
  const [myEvents, setMyEvents] = useState<GameEvent[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<Array<{ event: GameEvent; invitation: GameEventInvitation }>>([]);

  // Create Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGameType, setFormGameType] = useState('gapleh');
  const [formDatePreset, setFormDatePreset] = useState<'tonight' | 'tomorrow' | 'weekend'>('tonight');
  const [formMaxPlayers, setFormMaxPlayers] = useState(4);
  const [formInviteeInput, setFormInviteeInput] = useState('');
  const [formInvitees, setFormInvitees] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Time remaining helper
  const getRemainingTimeText = (scheduledAt: string) => {
    const diffMs = new Date(scheduledAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Sedang/Sudah Jadwalnya';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} hari lagi`;
    }
    return `${hours}j ${mins}m lagi`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [myRes, invRes] = await Promise.all([
        axios.get(`${API_URL}/events/my`, { headers }),
        axios.get(`${API_URL}/events/invited`, { headers }),
      ]);

      if (myRes.data?.success) setMyEvents(myRes.data.events || []);
      if (invRes.data?.success) setIncomingInvites(invRes.data.invitations || []);
    } catch (e) {
      console.warn('Gagal memuat event game:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible, fetchData]);

  // Add friend to invitee list
  const handleAddInvitee = () => {
    const trimmed = formInviteeInput.trim();
    if (!trimmed) return;
    const cleanName = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    if (formInvitees.some((i) => i.name.toLowerCase() === cleanName.toLowerCase())) {
      Alert.alert('Info', 'Teman ini sudah ada dalam daftar undangan.');
      return;
    }
    setFormInvitees([...formInvitees, { id: `user_${cleanName}`, name: cleanName }]);
    setFormInviteeInput('');
  };

  const handleRemoveInvitee = (name: string) => {
    setFormInvitees(formInvitees.filter((i) => i.name !== name));
  };

  // Create Event Submit
  const handleCreateEvent = async () => {
    if (!formTitle.trim()) {
      Alert.alert('Perhatian', 'Judul agenda tidak boleh kosong.');
      return;
    }

    // Calculate scheduled date based on preset
    const now = new Date();
    let scheduledDate = new Date();
    if (formDatePreset === 'tonight') {
      scheduledDate.setHours(20, 0, 0, 0);
      if (scheduledDate.getTime() <= now.getTime()) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }
    } else if (formDatePreset === 'tomorrow') {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      scheduledDate.setHours(20, 0, 0, 0);
    } else {
      // Weekend (next Saturday 20:00)
      const day = now.getDay();
      const distance = (6 - day + 7) % 7 || 7;
      scheduledDate.setDate(now.getDate() + distance);
      scheduledDate.setHours(20, 0, 0, 0);
    }

    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/events`,
        {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          gameType: formGameType,
          scheduledAt: scheduledDate.toISOString(),
          durationMin: 60,
          maxPlayers: formMaxPlayers,
          invitees: formInvitees,
        },
        { headers }
      );

      if (res.data?.success) {
        Alert.alert('Sukses', 'Agenda main bareng berhasil dibuat dan undangan telah dikirim! 📢');
        setFormTitle('');
        setFormDescription('');
        setFormInvitees([]);
        setActiveTab('my');
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.response?.data?.error || 'Gagal membuat agenda event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Respond Invitation (Accept / Decline)
  const handleRespond = async (eventId: string, status: 'accepted' | 'declined') => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.patch(
        `${API_URL}/events/${eventId}/respond`,
        { status },
        { headers }
      );
      if (res.data?.success) {
        Alert.alert('Berhasil', status === 'accepted' ? 'Undangan diterima! Sampai jumpa di warkop. ☕' : 'Undangan ditolak.');
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.response?.data?.error || 'Gagal merespons undangan.');
    }
  };

  // Start Event (Host) -> Creates Table & Navigates
  const handleStartEvent = async (eventId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(`${API_URL}/events/${eventId}/start`, {}, { headers });
      if (res.data?.success && res.data.tableId) {
        onClose();
        if (onEventStarted) {
          onEventStarted(res.data.tableId);
        } else {
          router.push({
            pathname: '/(main)/games/[id]' as any,
            params: { id: res.data.tableId },
          });
        }
      }
    } catch (err: any) {
      Alert.alert('Gagal Memulai', err?.response?.data?.error || 'Gagal memulai pertandingan event.');
    }
  };

  // Cancel Event (Host)
  const handleCancelEvent = async (eventId: string) => {
    Alert.alert('Konfirmasi', 'Apakah Anda yakin ingin membatalkan agenda event ini?', [
      { text: 'Tidak', style: 'cancel' },
      {
        text: 'Ya, Batalkan',
        style: 'destructive',
        onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            const res = await axios.delete(`${API_URL}/events/${eventId}`, { headers });
            if (res.data?.success) {
              Alert.alert('Dibatalkan', 'Event telah dibatalkan.');
              fetchData();
            }
          } catch (err: any) {
            Alert.alert('Gagal', err?.response?.data?.error || 'Gagal membatalkan event.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="calendar" size={22} color={coffee.accent} />
              </View>
              <View>
                <Text style={styles.title}>Agenda Main Bareng 📅</Text>
                <Text style={styles.subtitle}>Jadwal Tanding & Undangan Warung Kopi</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={coffee.text} />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'my' && styles.tabItemActive]}
              onPress={() => setActiveTab('my')}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={activeTab === 'my' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
                Agenda Saya ({myEvents.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'invited' && styles.tabItemActive]}
              onPress={() => setActiveTab('invited')}
            >
              <Ionicons
                name="mail-unread-outline"
                size={16}
                color={activeTab === 'invited' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'invited' && styles.tabTextActive]}>
                Undangan Masuk ({incomingInvites.length})
              </Text>
              {incomingInvites.some((i) => i.invitation.status === 'pending') && (
                <View style={styles.dotBadge} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'create' && styles.tabItemActive]}
              onPress={() => setActiveTab('create')}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={activeTab === 'create' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>
                Buat Agenda
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading */}
          {loading && (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={coffee.accent} />
            </View>
          )}

          {/* TAB 1: AGENDA SAYA */}
          {activeTab === 'my' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
              {myEvents.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>☕📭</Text>
                  <Text style={{ color: coffee.text, fontWeight: '700', fontSize: 14 }}>
                    Belum Ada Agenda yang Dibuat
                  </Text>
                  <Text style={{ color: coffee.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    Rencanakan pertandingan seru dengan teman-teman Anda di tab "Buat Agenda".
                  </Text>
                </View>
              ) : (
                myEvents.map((evt) => {
                  const gameOpt = GAME_OPTIONS.find((g) => g.id === evt.gameType) || GAME_OPTIONS[0]!;
                  const isScheduled = evt.status === 'scheduled';
                  const isOngoing = evt.status === 'ongoing';

                  return (
                    <View key={evt.id} style={styles.eventCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 16 }}>{gameOpt.emoji}</Text>
                          <Text style={{ color: coffee.accent, fontWeight: '900', fontSize: 13 }}>
                            {gameOpt.label.toUpperCase()}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, isScheduled && { backgroundColor: '#1e3a8a' }, isOngoing && { backgroundColor: '#15803d' }]}>
                          <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>
                            {evt.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 6 }}>
                        {evt.title}
                      </Text>

                      {evt.description && (
                        <Text style={{ color: coffee.muted, fontSize: 12, marginTop: 2 }}>
                          {evt.description}
                        </Text>
                      )}

                      {/* Scheduled Time & Countdown */}
                      <View style={styles.eventMetaRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="time-outline" size={14} color={coffee.accent} />
                          <Text style={{ color: coffee.text, fontSize: 11 }}>
                            {new Date(evt.scheduledAt).toLocaleDateString('id-ID', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>

                        {isScheduled && (
                          <View style={styles.countdownBadge}>
                            <Text style={{ fontSize: 10, color: '#fef08a', fontWeight: 'bold' }}>
                              ⏳ {getRemainingTimeText(evt.scheduledAt)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Invitations Status List */}
                      <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.25)', padding: 8, borderRadius: 8 }}>
                        <Text style={{ color: coffee.muted, fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                          PESERTA DIUNDANG ({evt.invitations.length}):
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {evt.invitations.map((inv) => (
                            <View key={inv.id} style={styles.inviteeChip}>
                              <Text style={{ color: '#fff', fontSize: 10 }}>
                                @{inv.inviteeName}
                              </Text>
                              <Text style={{ fontSize: 10 }}>
                                {inv.status === 'accepted' ? '✅' : inv.status === 'declined' ? '❌' : '⏳'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      {/* Action Buttons for Host */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                        {isScheduled && (
                          <>
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: '#7f1d1d' }]}
                              onPress={() => handleCancelEvent(evt.id)}
                            >
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Batalkan</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: '#15803d' }]}
                              onPress={() => handleStartEvent(evt.id)}
                            >
                              <Ionicons name="play" size={13} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                                Mulai Tanding 🚀
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}

                        {isOngoing && evt.tableId && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#2563eb' }]}
                            onPress={() => {
                              onClose();
                              router.push({
                                pathname: '/(main)/games/[id]' as any,
                                params: { id: evt.tableId! },
                              });
                            }}
                          >
                            <Ionicons name="enter" size={13} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                              Masuk ke Meja Tanding
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* TAB 2: UNDANGAN MASUK */}
          {activeTab === 'invited' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
              {incomingInvites.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>✉️</Text>
                  <Text style={{ color: coffee.text, fontWeight: '700', fontSize: 14 }}>
                    Belum Ada Undangan Masuk
                  </Text>
                  <Text style={{ color: coffee.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    Saat kawan warkop mengundang Anda untuk main bareng, undangannya akan muncul di sini.
                  </Text>
                </View>
              ) : (
                incomingInvites.map(({ event: evt, invitation: inv }) => {
                  const gameOpt = GAME_OPTIONS.find((g) => g.id === evt.gameType) || GAME_OPTIONS[0]!;
                  const isPending = inv.status === 'pending';

                  return (
                    <View key={inv.id} style={styles.eventCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: coffee.accent, fontWeight: 'bold', fontSize: 12 }}>
                          👤 Dari: @{evt.hostName}
                        </Text>
                        <View style={[styles.statusBadge, inv.status === 'accepted' ? { backgroundColor: '#15803d' } : isPending ? { backgroundColor: '#d97706' } : { backgroundColor: '#991b1b' }]}>
                          <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>
                            {inv.status === 'accepted' ? 'HADIR' : inv.status === 'declined' ? 'DITOLAK' : 'MENUNGGU KONFIRMASI'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 6 }}>
                        {evt.title}
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Text style={{ fontSize: 14 }}>{gameOpt.emoji}</Text>
                        <Text style={{ color: coffee.muted, fontSize: 12 }}>
                          Permainan: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{gameOpt.label}</Text>
                        </Text>
                      </View>

                      {inv.message && (
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, marginTop: 6 }}>
                          <Text style={{ color: '#fef08a', fontSize: 11, fontStyle: 'italic' }}>
                            💬 "{inv.message}"
                          </Text>
                        </View>
                      )}

                      <View style={styles.eventMetaRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="time-outline" size={14} color={coffee.accent} />
                          <Text style={{ color: coffee.text, fontSize: 11 }}>
                            {new Date(evt.scheduledAt).toLocaleDateString('id-ID', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: coffee.accent, fontWeight: 'bold' }}>
                          ⏰ {getRemainingTimeText(evt.scheduledAt)}
                        </Text>
                      </View>

                      {/* Action buttons */}
                      {isPending && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#7f1d1d' }]}
                            onPress={() => handleRespond(evt.id, 'declined')}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Tolak</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#15803d' }]}
                            onPress={() => handleRespond(evt.id, 'accepted')}
                          >
                            <Ionicons name="checkmark" size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Hadir (Terima)</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* If ongoing and accepted */}
                      {evt.status === 'ongoing' && evt.tableId && inv.status === 'accepted' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#2563eb', marginTop: 10, alignSelf: 'flex-end' }]}
                          onPress={() => {
                            onClose();
                            router.push({
                              pathname: '/(main)/games/[id]' as any,
                              params: { id: evt.tableId! },
                            });
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                            Pertandingan Dimulai! Masuk Meja 🚀
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* TAB 3: BUAT AGENDA BARU */}
          {activeTab === 'create' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              <View style={styles.formContainer}>
                {/* Title */}
                <Text style={styles.formLabel}>Judul Agenda / Event</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Misal: Turnamen Gapleh Malam Minggu"
                  placeholderTextColor={coffee.muted}
                  value={formTitle}
                  onChangeText={setFormTitle}
                />

                {/* Description */}
                <Text style={styles.formLabel}>Pesan Undangan / Catatan</Text>
                <TextInput
                  style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Tulis pesan personal untuk kawan yang diundang..."
                  placeholderTextColor={coffee.muted}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  multiline
                />

                {/* Game Type Selector */}
                <Text style={styles.formLabel}>Pilihan Permainan</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {GAME_OPTIONS.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        styles.gameChip,
                        formGameType === g.id && styles.gameChipActive,
                      ]}
                      onPress={() => setFormGameType(g.id)}
                    >
                      <Text style={{ fontSize: 16, marginRight: 4 }}>{g.emoji}</Text>
                      <Text style={[styles.gameChipText, formGameType === g.id && styles.gameChipTextActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Schedule Presets */}
                <Text style={styles.formLabel}>Waktu Pertandingan</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  <TouchableOpacity
                    style={[styles.presetBtn, formDatePreset === 'tonight' && styles.presetBtnActive]}
                    onPress={() => setFormDatePreset('tonight')}
                  >
                    <Text style={[styles.presetBtnText, formDatePreset === 'tonight' && styles.presetBtnTextActive]}>
                      🌙 Nanti Malam (20:00)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, formDatePreset === 'tomorrow' && styles.presetBtnActive]}
                    onPress={() => setFormDatePreset('tomorrow')}
                  >
                    <Text style={[styles.presetBtnText, formDatePreset === 'tomorrow' && styles.presetBtnTextActive]}>
                      ☀️ Besok Malam (20:00)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, formDatePreset === 'weekend' && styles.presetBtnActive]}
                    onPress={() => setFormDatePreset('weekend')}
                  >
                    <Text style={[styles.presetBtnText, formDatePreset === 'weekend' && styles.presetBtnTextActive]}>
                      🎉 Akhir Pekan
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Max Players */}
                <Text style={styles.formLabel}>Kapasitas Meja</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {[2, 3, 4, 6].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.numBtn, formMaxPlayers === num && styles.numBtnActive]}
                      onPress={() => setFormMaxPlayers(num)}
                    >
                      <Text style={[styles.numBtnText, formMaxPlayers === num && styles.numBtnTextActive]}>
                        {num} Pemain
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Invitees Input */}
                <Text style={styles.formLabel}>Undang Kawan Warkop</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TextInput
                    style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                    placeholder="Ketik username teman (cth: budi, siti)..."
                    placeholderTextColor={coffee.muted}
                    value={formInviteeInput}
                    onChangeText={setFormInviteeInput}
                    onSubmitEditing={handleAddInvitee}
                  />
                  <TouchableOpacity style={styles.addInviteeBtn} onPress={handleAddInvitee}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>+ Tambah</Text>
                  </TouchableOpacity>
                </View>

                {/* Invitees Tag List */}
                {formInvitees.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {formInvitees.map((inv) => (
                      <View key={inv.id} style={styles.inviteeTag}>
                        <Text style={{ color: coffee.accent, fontSize: 11, fontWeight: 'bold' }}>
                          @{inv.name}
                        </Text>
                        <TouchableOpacity onPress={() => handleRemoveInvitee(inv.name)}>
                          <Ionicons name="close-circle" size={14} color={coffee.muted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitEventBtn, isSubmitting && { opacity: 0.7 }]}
                  disabled={isSubmitting}
                  onPress={handleCreateEvent}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.submitEventBtnText}>Jadwalkan & Kirim Undangan</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    position: 'relative',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: coffee.accent,
    backgroundColor: 'rgba(212, 163, 115, 0.08)',
  },
  tabText: {
    fontSize: 11,
    color: coffee.muted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  dotBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    position: 'absolute',
    top: 8,
    right: 12,
  },
  eventCard: {
    backgroundColor: '#26180f',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4a3319',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eventMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#3a2512',
  },
  countdownBadge: {
    backgroundColor: '#422006',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#eab308',
  },
  inviteeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1b130e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  formContainer: {
    backgroundColor: '#26180f',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a3319',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.text,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#19110b',
    borderWidth: 1,
    borderColor: '#3a2512',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
    marginBottom: 12,
  },
  gameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#19110b',
    borderWidth: 1,
    borderColor: '#3a2512',
    marginRight: 6,
  },
  gameChipActive: {
    backgroundColor: coffee.accent,
    borderColor: '#fff',
  },
  gameChipText: {
    fontSize: 12,
    color: coffee.muted,
    fontWeight: '600',
  },
  gameChipTextActive: {
    color: '#1b130e',
    fontWeight: '800',
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#19110b',
    borderWidth: 1,
    borderColor: '#3a2512',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#3b2513',
    borderColor: coffee.accent,
  },
  presetBtnText: {
    fontSize: 10,
    color: coffee.muted,
    fontWeight: '600',
  },
  presetBtnTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  numBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#19110b',
    borderWidth: 1,
    borderColor: '#3a2512',
    alignItems: 'center',
  },
  numBtnActive: {
    backgroundColor: '#3b2513',
    borderColor: coffee.accent,
  },
  numBtnText: {
    fontSize: 11,
    color: coffee.muted,
    fontWeight: '600',
  },
  numBtnTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  addInviteeBtn: {
    backgroundColor: '#3b2513',
    borderWidth: 1,
    borderColor: coffee.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#19110b',
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  submitEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#15803d',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  submitEventBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
});
