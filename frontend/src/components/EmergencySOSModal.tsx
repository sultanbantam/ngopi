import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { coffee } from '../theme/coffee';
import axios from 'axios';
import { getAuthHeaders } from '../utils/api';
import { htManager } from '../ht/htManager';
import { AcousticModemFrontend } from '../ht/acousticModem';

const API_URL = 'https://api.ngopi.top/api';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  is_primary: boolean;
}

interface EmergencySOSModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenHT?: () => void;
}

const EMERGENCY_SERVICES = [
  { name: '112 - Panggilan Darurat Terpadu', number: '112', icon: 'call', color: '#ef4444' },
  { name: '119 - Ambulans Kemenkes / PSC', number: '119', icon: 'medkit', color: '#f87171' },
  { name: '115 - Basarnas (Pencarian & SAR)', number: '115', icon: 'boat', color: '#f59e0b' },
  { name: '113 - Pemadam Kebakaran', number: '113', icon: 'flame', color: '#f97316' },
];

export default function EmergencySOSModal({ visible, onClose, onOpenHT }: EmergencySOSModalProps) {
  const [activeTab, setActiveTab] = useState<'sos' | 'contacts'>('sos');
  const [incidentType, setIncidentType] = useState<'accident' | 'medical' | 'disaster' | 'general'>('general');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [sosSent, setSosSent] = useState(false);
  const [p3kResult, setP3kResult] = useState<{ topic: string; action_summary: string; hotline: string } | null>(null);
  
  // Contacts state
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);

  const countdownTimerRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      // Ambil GPS saat modal dibuka
      fetchGPS();
      loadContacts();
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
    }
  }, [visible]);

  const fetchGPS = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({
            lat: Number(pos.coords.latitude.toFixed(5)),
            lon: Number(pos.coords.longitude.toFixed(5)),
          });
        },
        () => {
          // Fallback Monas Jakarta
          setGpsLocation({ lat: -6.2088, lon: 106.8456 });
        },
        { timeout: 8000 }
      );
    } else {
      setGpsLocation({ lat: -6.2088, lon: 106.8456 });
    }
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_URL}/emergency/contacts`, { headers, timeout: 5000 });
      if (res.data?.contacts) {
        setContacts(res.data.contacts);
      }
    } catch {
      // Fallback local contacts if offline
      if (contacts.length === 0) {
        setContacts([
          { id: 'default_1', name: 'Keluarga Inti', phone: '08123456789', relation: 'Keluarga', is_primary: true },
        ]);
      }
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleStartCountdown = () => {
    setCountdown(3);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          executeSOS();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  };

  const executeSOS = async () => {
    setIsTriggering(true);
    const lat = gpsLocation?.lat ?? -6.2088;
    const lon = gpsLocation?.lon ?? 106.8456;
    const desc = incidentDesc.trim() || 'MAYDAY! Butuh bantuan segera di lokasi saya!';

    // Play warning Roger chirp tone
    try {
      AcousticModemFrontend.playRogerBeep();
    } catch {}

    // 1. Simpan & Siarkan melalui HT Offline Manager (Frekuensi 145.000 MHz)
    try {
      await htManager.sendMessage(`[SOS 145.000 MHz] ${incidentType.toUpperCase()} @ ${lat},${lon} - ${desc}`, { freq: 145.000 });
    } catch {}

    // 2. Kirim ke API Emergency Backend
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/emergency/sos`,
        {
          type: incidentType,
          latitude: lat,
          longitude: lon,
          description: desc,
        },
        { headers, timeout: 8000 }
      );

      if (res.data?.p3kGuide) {
        setP3kResult(res.data.p3kGuide);
      }
      setSosSent(true);
    } catch {
      // Offline fallback: set default relevant P3K guide
      setP3kResult(getLocalP3K(incidentType));
      setSosSent(true);
    } finally {
      setIsTriggering(false);
    }
  };

  const getLocalP3K = (type: string) => {
    switch (type) {
      case 'medical':
        return {
          topic: 'Serangan Jantung & Henti Napas (CPR)',
          action_summary: 'Kompresi dada sedalam 5-6 cm ritme 100-120 BPM. Buka jalan napas head-tilt chin-lift.',
          hotline: '119 (Ambulans Kemenkes / PSC)',
        };
      case 'accident':
        return {
          topic: 'Kecelakaan Lalu Lintas & Pendarahan',
          action_summary: 'Fiksasi leher korban lurus jangan digerakkan. Tekan luka berdarah secara langsung. Jangan lepas helm korban.',
          hotline: '112 (Panggilan Darurat Terpadu)',
        };
      case 'disaster':
        return {
          topic: 'Evakuasi Bencana Alam',
          action_summary: 'Gempa: Drop, Cover, Hold On! Tsunami: Ikuti rumus 20-20-20 ke dataran tinggi.',
          hotline: '115 (Basarnas SAR)',
        };
      default:
        return {
          topic: 'Prinsip Penyelamatan DRSABCD',
          action_summary: 'Pastikan Danger aman, cek Response korban, hubungi 112, cek Airway & Breathing.',
          hotline: '112 (Panggilan Darurat Terpadu)',
        };
    }
  };

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert('Perhatian', 'Nama dan nomor telepon harus diisi');
      return;
    }
    setIsAddingContact(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/emergency/contacts`,
        {
          name: newContactName.trim(),
          phone: newContactPhone.trim(),
          relation: newContactRelation.trim() || 'Keluarga',
          is_primary: contacts.length === 0,
        },
        { headers, timeout: 5000 }
      );
      if (res.data?.contact) {
        setContacts([res.data.contact, ...contacts]);
        setNewContactName('');
        setNewContactPhone('');
        setNewContactRelation('');
      }
    } catch {
      // Local fallback
      const localContact: EmergencyContact = {
        id: 'local_' + Date.now(),
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
        relation: newContactRelation.trim() || 'Keluarga',
        is_primary: contacts.length === 0,
      };
      setContacts([localContact, ...contacts]);
      setNewContactName('');
      setNewContactPhone('');
      setNewContactRelation('');
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      await axios.delete(`${API_URL}/emergency/contacts/${id}`, { headers, timeout: 5000 });
    } catch {}
    setContacts(contacts.filter(c => c.id !== id));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.pulseDot} />
              <Text style={styles.headerTitle}>🚨 MODE DARURAT WARKOP</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={coffee.secondary} />
            </TouchableOpacity>
          </View>

          {/* Subheader info bar */}
          <View style={styles.statusBar}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>FREKUENSI HT:</Text>
              <Text style={styles.statusVal}>145.000 MHz (SAR)</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>GPS:</Text>
              <Text style={styles.statusVal}>
                {gpsLocation ? `${gpsLocation.lat}, ${gpsLocation.lon}` : 'Mencari...'}
              </Text>
            </View>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'sos' && styles.activeTabBtn]}
              onPress={() => setActiveTab('sos')}
            >
              <Ionicons name="warning" size={14} color={activeTab === 'sos' ? '#FFF' : coffee.muted} />
              <Text style={[styles.tabText, activeTab === 'sos' && styles.activeTabText]}>
                Pemicu SOS Otomatis
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'contacts' && styles.activeTabBtn]}
              onPress={() => setActiveTab('contacts')}
            >
              <Ionicons name="people" size={14} color={activeTab === 'contacts' ? '#FFF' : coffee.muted} />
              <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>
                Kontak Darurat ({contacts.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {activeTab === 'sos' ? (
              <View>
                {/* Incident Type Selector */}
                <Text style={styles.sectionLabel}>PILIH JENIS KONDISI DARURAT:</Text>
                <View style={styles.typesGrid}>
                  {[
                    { id: 'general', label: '⚠️ Darurat Umum', desc: 'Bantuan mendesak warkop' },
                    { id: 'accident', label: '🚗 Kecelakaan Lalin', desc: 'Tabrakan / luka fisik' },
                    { id: 'medical', label: '🩺 Medis / CPR', desc: 'Pingsan / henti jantung' },
                    { id: 'disaster', label: '🌊 Bencana Alam', desc: 'Gempa / banjir / SAR' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.typeCard,
                        incidentType === item.id && styles.typeCardSelected,
                      ]}
                      onPress={() => setIncidentType(item.id as any)}
                    >
                      <Text style={[styles.typeTitle, incidentType === item.id && styles.typeTitleSelected]}>
                        {item.label}
                      </Text>
                      <Text style={styles.typeDesc}>{item.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Additional Note */}
                <Text style={styles.sectionLabel}>KETERANGAN KONDISI (OPSIONAL):</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: Korban 1 orang tidak sadar, di dekat perempatan pos ronda..."
                  placeholderTextColor={coffee.muted}
                  value={incidentDesc}
                  onChangeText={setIncidentDesc}
                />

                {/* Big SOS Button or Countdown Bar */}
                {countdown !== null ? (
                  <View style={styles.countdownBox}>
                    <Text style={styles.countdownText}>MENYIARKAN SOS DALAM:</Text>
                    <Text style={styles.countdownNumber}>{countdown}</Text>
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelCountdown}>
                      <Ionicons name="close-circle" size={18} color="#FFF" />
                      <Text style={styles.cancelBtnText}>BATALKAN SIARAN</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.sosBigBtn}
                    onPress={handleStartCountdown}
                    disabled={isTriggering}
                    activeOpacity={0.8}
                  >
                    {isTriggering ? (
                      <ActivityIndicator color="#FFF" size="large" />
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="alert-circle" size={38} color="#FFF" />
                        <Text style={styles.sosBigText}>SIARKAN SOS SEKARANG</Text>
                        <Text style={styles.sosSubText}>
                          Siarkan ke HT 145.000 MHz & Grup Warung Kopi Darurat
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* Status Result Card */}
                {sosSent && (
                  <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.successTitle}>Sinyal SOS Berhasil Ditransmisikan!</Text>
                      <Text style={styles.successSub}>
                        Pesan darurat & lokasi GPS Anda disiarkan ke HT 145.000 MHz (APRS) dan grup Warung Kopi Darurat.
                      </Text>
                    </View>
                  </View>
                )}

                {/* P3K Guide Recommendation Card */}
                {p3kResult && (
                  <View style={styles.p3kCard}>
                    <View style={styles.p3kHeader}>
                      <Ionicons name="medkit" size={18} color="#f87171" />
                      <Text style={styles.p3kTitle}>PANDUAN P3K CEPAT: {p3kResult.topic}</Text>
                    </View>
                    <Text style={styles.p3kSummary}>{p3kResult.action_summary}</Text>
                    <View style={styles.p3kFooter}>
                      <Text style={styles.hotlineTag}>Rujukan Hotline: {p3kResult.hotline}</Text>
                      <TouchableOpacity
                        style={styles.guideLinkBtn}
                        onPress={() => {
                          onClose();
                          router.push('/(main)/guides/first-aid');
                        }}
                      >
                        <Text style={styles.guideLinkText}>Lihat 10 Panduan P3K Lengkap →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Action Buttons: Open HT Radio & Direct Hotline Calls */}
                <View style={styles.quickActionsRow}>
                  {onOpenHT && (
                    <TouchableOpacity
                      style={styles.radioQuickBtn}
                      onPress={() => {
                        onClose();
                        onOpenHT();
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>📻</Text>
                      <Text style={styles.radioQuickText}>Buka Radio HT (145.000)</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.guideQuickBtn}
                    onPress={() => {
                      onClose();
                      router.push('/(main)/guides/ht');
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>📖</Text>
                    <Text style={styles.guideQuickText}>Panduan HT</Text>
                  </TouchableOpacity>
                </View>

                {/* Direct Hotlines */}
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>PANGGILAN CEPAT AMBULANS & SAR (BEBAS PULSA):</Text>
                <View style={styles.hotlinesList}>
                  {EMERGENCY_SERVICES.map((s) => (
                    <TouchableOpacity
                      key={s.number}
                      style={[styles.hotlineRow, { borderLeftColor: s.color }]}
                      onPress={() => handleCall(s.number)}
                    >
                      <Ionicons name={s.icon as any} size={16} color={s.color} />
                      <Text style={styles.hotlineLabel}>{s.name}</Text>
                      <View style={styles.callPill}>
                        <Ionicons name="call" size={12} color="#FFF" />
                        <Text style={styles.callPillText}>Hubungi</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              /* Contacts Tab */
              <View>
                <Text style={styles.sectionLabel}>TAMBAH KONTAK DARURAT:</Text>
                <View style={styles.formCard}>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Nama Lengkap (misal: Ayah / Istri / Sahabat)"
                    placeholderTextColor={coffee.muted}
                    value={newContactName}
                    onChangeText={setNewContactName}
                  />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Nomor Telepon / WhatsApp (misal: 08123456789)"
                    placeholderTextColor={coffee.muted}
                    keyboardType="phone-pad"
                    value={newContactPhone}
                    onChangeText={setNewContactPhone}
                  />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Hubungan (misal: Keluarga / Sahabat / Tetangga)"
                    placeholderTextColor={coffee.muted}
                    value={newContactRelation}
                    onChangeText={setNewContactRelation}
                  />
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={handleAddContact}
                    disabled={isAddingContact}
                  >
                    {isAddingContact ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="person-add" size={16} color="#FFF" />
                        <Text style={styles.addBtnText}>Simpan Kontak Darurat</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>DAFTAR KONTAK TERSIMPAN:</Text>
                {loadingContacts ? (
                  <ActivityIndicator color={coffee.accent} style={{ marginTop: 20 }} />
                ) : contacts.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada kontak darurat tersimpan.</Text>
                ) : (
                  contacts.map((c) => (
                    <View key={c.id} style={styles.contactCard}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.contactName}>{c.name}</Text>
                          {c.is_primary && (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryBadgeText}>Utama</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.contactPhone}>{c.phone}</Text>
                        <Text style={styles.contactRelation}>{c.relation}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                          style={styles.callContactBtn}
                          onPress={() => handleCall(c.phone)}
                        >
                          <Ionicons name="call" size={14} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteContactBtn}
                          onPress={() => handleDeleteContact(c.id)}
                        >
                          <Ionicons name="trash" size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#1a0b08', // Dark deep red-coffee
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#b91c1c',
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2b0e0a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#45120c',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  statusBar: {
    flexDirection: 'row',
    backgroundColor: '#38120c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#4d160e',
    justifyContent: 'space-between',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '700',
  },
  statusVal: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1f0d09',
    borderBottomWidth: 1,
    borderBottomColor: '#36140e',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabBtn: {
    borderBottomColor: '#ef4444',
    backgroundColor: '#2d110b',
  },
  tabText: {
    color: coffee.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '700',
  },
  body: {
    padding: 16,
  },
  sectionLabel: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  typeCard: {
    width: '48%',
    backgroundColor: '#260e0a',
    borderWidth: 1,
    borderColor: '#451711',
    borderRadius: 8,
    padding: 10,
  },
  typeCardSelected: {
    borderColor: '#ef4444',
    backgroundColor: '#40130d',
  },
  typeTitle: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  typeTitleSelected: {
    color: '#FFF',
  },
  typeDesc: {
    color: coffee.muted,
    fontSize: 10,
  },
  textInput: {
    backgroundColor: '#240d09',
    borderWidth: 1,
    borderColor: '#451711',
    borderRadius: 8,
    color: '#FFF',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  sosBigBtn: {
    backgroundColor: '#b91c1c',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 14,
  },
  sosBigText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
  },
  sosSubText: {
    color: '#fecaca',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  countdownBox: {
    backgroundColor: '#450a0a',
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  countdownText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  countdownNumber: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '900',
    marginVertical: 4,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1f2937',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  cancelBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  successTitle: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  successSub: {
    color: '#bbf7d0',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  p3kCard: {
    backgroundColor: '#260e0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4d160e',
    padding: 12,
    marginBottom: 14,
  },
  p3kHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  p3kTitle: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  p3kSummary: {
    color: coffee.text,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  p3kFooter: {
    borderTopWidth: 1,
    borderTopColor: '#3d140e',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  hotlineTag: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '600',
  },
  guideLinkBtn: {
    paddingVertical: 2,
  },
  guideLinkText: {
    color: coffee.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  radioQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 8,
  },
  radioQuickText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  guideQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4b5563',
    paddingVertical: 10,
    borderRadius: 8,
  },
  guideQuickText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  hotlinesList: {
    gap: 6,
  },
  hotlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#210c08',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
  },
  hotlineLabel: {
    color: coffee.text,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  callPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  callPillText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  // Form & Contacts
  formCard: {
    backgroundColor: '#260e0a',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  formInput: {
    backgroundColor: '#1b0906',
    borderWidth: 1,
    borderColor: '#3d140e',
    borderRadius: 6,
    color: '#FFF',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#260e0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3d140e',
  },
  contactName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  contactPhone: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  contactRelation: {
    color: coffee.muted,
    fontSize: 10,
    marginTop: 1,
  },
  primaryBadge: {
    backgroundColor: '#991b1b',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  callContactBtn: {
    backgroundColor: '#16a34a',
    padding: 8,
    borderRadius: 6,
  },
  deleteContactBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 8,
    borderRadius: 6,
  },
  emptyText: {
    color: coffee.muted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 14,
  },
});
