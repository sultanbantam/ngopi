import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee } from '../../../src/theme/coffee';
import BluetoothHTModal from '../../../src/components/BluetoothHTModal';

interface GuideSection {
  id: string;
  number: number;
  icon: string;
  title: string;
  badge?: string;
  summary: string;
  subsections: Array<{
    title: string;
    content: string;
    tips?: string[];
  }>;
}

const HT_GUIDE_DATA: GuideSection[] = [
  {
    id: 'pengenalan',
    number: 1,
    icon: 'radio-outline',
    title: 'Pengenalan HT (Handy Talky)',
    badge: 'Dasar',
    summary: 'Memahami prinsip radio dua arah, perbedaan frekuensi VHF vs UHF, daya pancar, dan karakteristik rambatan gelombang radio.',
    subsections: [
      {
        title: '1.1 Apa Itu Handy Talky (HT)?',
        content: 'Handy Talky (HT) adalah perangkat transceiver radio portabel dua arah (half-duplex) yang dapat memancarkan dan menerima sinyal radio secara mandiri tanpa memerlukan pulsa, paket data, maupun menara BTS seluler.',
        tips: [
          'Half-Duplex: Pengguna harus bergantian bicara (satu memancar, yang lain mendengarkan).',
          'Sinyal radio merambat lurus (Line of Sight) dan dapat menembus area tanpa sinyal seluler.',
        ],
      },
      {
        title: '1.2 VHF vs UHF: Mana yang Harus Dipilih?',
        content: 'VHF (Very High Frequency: 136 - 174 MHz) sangat ideal untuk daerah terbuka, hutan, pegunungan, perkebunan, dan perairan. UHF (Ultra High Frequency: 400 - 470 MHz) memiliki panjang gelombang lebih pendek sehingga lebih mampu memantul dan menembus gedung beton, basement, serta perkotaan padat.',
        tips: [
          'VHF (145.500 MHz): Frekuensi default Ngopi untuk komunikasi jarak jauh pedesaan & warkop.',
          'UHF (433.000 MHz): Direkomendasikan untuk komunikasi antar gedung bertingkat.',
        ],
      },
      {
        title: '1.3 Daya Pancar (Watt) dan Jangkauan',
        content: 'HT portabel umumnya memiliki daya 1 Watt sampai 5 Watt. Dengan antena standar, jangkauan rata-rata adalah 1 - 5 km di perkotaan dan hingga 10 - 20 km jika berada di posisi ketinggian (puncak bukit/atap gedung) tanpa halangan.',
      },
    ],
  },
  {
    id: 'legalitas',
    number: 2,
    icon: 'shield-checkmark-outline',
    title: 'Legalitas Radio di Indonesia',
    badge: 'Wajib Tahu',
    summary: 'Aturan hukum penggunaan gelombang radio di Indonesia, organisasi resmi ORARI dan RAPI, serta perizinan IAR / KRAP.',
    subsections: [
      {
        title: '2.1 Payung Hukum & Regulasi',
        content: 'Spektrum frekuensi radio adalah sumber daya alam terbatas yang dikuasai negara berdasarkan UU No. 36 Tahun 1999 tentang Telekomunikasi dan Peraturan Menteri Kominfo. Penggunaan frekuensi tanpa hak dapat dikenakan sanksi pidana dan denda.',
      },
      {
        title: '2.2 Organisasi Resmi: ORARI & RAPI',
        content: 'Di Indonesia terdapat dua organisasi radio resmi yang diakui pemerintah:\n1. ORARI (Organisasi Amatir Radio Indonesia): Menggunakan Izin Amatir Radio (IAR) dengan alokasi frekuensi amatir (misal: 144 - 148 MHz).\n2. RAPI (Radio Antar Penduduk Indonesia): Menggunakan Komunikasi Radio Antar Penduduk (KRAP) untuk komunikasi kekeluargaan dan penanggulangan bencana.',
        tips: [
          'Tingkat IAR ORARI: Siaga (YD/YG), Penggalang (YC/YF), Penegak (YB/YA).',
          'Selalu cantumkan Callsign resmi Anda saat mengudara di frekuensi publik.',
        ],
      },
    ],
  },
  {
    id: 'cara-pakai',
    number: 3,
    icon: 'phone-portrait-outline',
    title: 'Cara Menggunakan HT di Ngopi (Mode Offline)',
    badge: 'Panduan Aplikasi',
    summary: 'Langkah praktis menggunakan ngopi.top sebagai terminal komunikasi HT saat jaringan internet mati total.',
    subsections: [
      {
        title: '3.1 Install Ngopi sebagai PWA',
        content: '1. Buka https://ngopi.top di browser Chrome (Android/Desktop) atau Safari (iOS).\n2. Ketuk ikon Menu browser → Pilih "Install App" atau "Add to Home Screen" (Tambahkan ke Layar Utama).\n3. Aplikasi Ngopi akan terpasang di perangkat Anda dan bisa dibuka secara mandiri tanpa internet.',
      },
      {
        title: '3.2 Aktifkan Mode Offline & Pilih Jalur HT',
        content: 'Buka menu HT Radio dari header atau banner offline. Pilih salah satu dari 3 mode transmisi:\n- 📡 Bluetooth: Untuk HT yang memiliki Bluetooth bawaan (Baofeng UV-5R BLE, SenHaiX, BTECH).\n- 🔌 USB Serial: Untuk laptop/PC menggunakan kabel data flash USB (PL2303, CH340) atau kv4p HT dongle.\n- 🔊 Akustik (Semua HP): Tanpa dongle tambahan! Cukup dekatkan speaker HP ke mic HT.',
      },
      {
        title: '3.3 Mengatur Frekuensi & CTCSS',
        content: 'Frekuensi standar komunitas warkop adalah 145.500 MHz Simplex VHF. Gunakan preset 145.000 MHz khusus keadaan darurat / SAR. Aktifkan CTCSS tone jika frekuensi mengalami interferensi suara bising.',
      },
      {
        title: '3.4 Mengirim Pesan Teks & Voice PTT',
        content: '- Teks: Ketik pesan atau pilih sandi cepat warkop lalu tekan Kirim.\n- Voice PTT: Tekan dan tahan tombol bulat PTT untuk berbicara, lalu lepaskan untuk memicu nada Roger Beep.\n- Emergency: Ketuk tombol SOS Darurat untuk menyiarkan koordinat GPS posko.',
      },
      {
        title: '3.5 Sinkronisasi Otomatis Saat Online',
        content: 'Setiap pesan yang Anda kirim via radio saat offline akan dicatat ke penyimpanan IndexedDB lokal browser. Ketika koneksi internet pulih, aplikasi secara otomatis menyinkronkan seluruh log ke server Ngopi.',
      },
    ],
  },
  {
    id: 'etika',
    number: 4,
    icon: 'chatbubbles-outline',
    title: 'Etika Berkomunikasi Radio',
    badge: 'Etika',
    summary: 'Tata krama di frekuensi publik, sandi 10 Indonesia, panggilan umum CQ, dan sopan santun komunikasi warkop.',
    subsections: [
      {
        title: '4.1 Panggilan Umum (CQ Call)',
        content: 'Gunakan frasa "CQ CQ CQ" untuk memanggil stasiun mana saja yang sedang memonitor frekuensi. Contoh: "CQ CQ CQ, di sini YD0NGOPI memonitor frekuensi 145.500 MHz, adakah rekan yang mendengar? Ganti."',
      },
      {
        title: '4.2 Aturan Emas: Dengar Dulu Sebelum Bicara',
        content: 'Sebelum menekan PTT, dengarkan frekuensi selama beberapa detik untuk memastikan tidak ada rekan lain atau panggilan darurat yang sedang berlangsung. Jangan menimpa (jamming) stasiun lain.',
      },
      {
        title: '4.3 Sandi 10 Populer di Indonesia',
        content: 'Sandi 10 mempercepat penyampaian informasi penting:\n• 10-1: Penerimaan buruk / tidak jelas\n• 10-4: Dimengerti / pesan diterima baik\n• 10-7: Berhenti memancar / istirahat (off air)\n• 10-8: Siap bertugas / memonitor kembali\n• 10-20: Posisi / lokasi stasiun saat ini\n• 10-33: Keadaan darurat lalu lintas / butuh prioritas',
      },
    ],
  },
  {
    id: 'frekuensi',
    number: 5,
    icon: 'cellular-outline',
    title: 'Frekuensi Penting di Indonesia',
    badge: 'Referensi',
    summary: 'Daftar alokasi frekuensi radio nasional untuk komunikasi darurat, SAR, kebencanaan, dan komunitas.',
    subsections: [
      {
        title: '5.1 Kanal Darurat Nasional & Penyelamatan',
        content: '• 145.000 MHz: Frekuensi Darurat ORARI Nasional / Bantuan Komunikasi Bencana SAR.\n• 143.500 MHz: Saluran Kerja Bantuan Bencana RAPI Nasional.\n• 143.600 MHz: Saluran Siaga Bencana BNPB & PMI di beberapa daerah.\n• 433.000 MHz: Frekuensi Panggil Calling UHF Nasional.',
        tips: [
          'DILARANG menggunakan frekuensi darurat (145.000 MHz) untuk obrolan santai!',
          'Utamakan berita marabahaya dan evakuasi di frekuensi ini.',
        ],
      },
      {
        title: '5.2 Frekuensi Komunitas Warung Kopi Ngopi',
        content: '• 145.500 MHz: Kanal Simplex Ngopi Warkop Digital (Default).\n• 145.520 MHz: Kanal Cadangan Obrolan Warkop.',
      },
    ],
  },
  {
    id: 'aprs',
    number: 6,
    icon: 'location-outline',
    title: 'APRS (Automatic Packet Reporting)',
    badge: 'Data Paket',
    summary: 'Pengiriman data posisi GPS, status posko pengungsian, dan telemetri cuaca tanpa koneksi seluler.',
    subsections: [
      {
        title: '6.1 Apa Itu APRS?',
        content: 'APRS adalah protokol komunikasi data digital berbasis paket radio Bell 202 AFSK 1200 baud pada frekuensi 144.390 MHz (atau 145.500 MHz di jaringan privat). APRS memungkinkan stasiun radio mentransmisikan lokasi koordinat lintang/bujur secara akurat.',
      },
      {
        title: '6.2 APRS di Aplikasi Ngopi',
        content: 'Aplikasi Ngopi secara otomatis mengemas pesan darurat SOS ke dalam format packet APRS standar (misal: !0612.50S/10650.73E>Posko Relawan Banjir). Data ini bisa diterima oleh radio HT lain yang terhubung ke modem Ngopi.',
      },
    ],
  },
  {
    id: 'darurat',
    number: 7,
    icon: 'alert-circle-outline',
    title: 'Mode Darurat (Emergency / MAYDAY)',
    badge: 'Prosedur SAR',
    summary: 'Prosedur keselamatan jiwa, panggilan bahaya MAYDAY dan PAN-PAN, serta koordinasi evakuasi darurat.',
    subsections: [
      {
        title: '7.1 Prosedur Panggilan Bahaya (Distress)',
        content: '1. MAYDAY, MAYDAY, MAYDAY: Gunakan HANYA saat ada ancaman langsung terhadap keselamatan jiwa (bencana gempa, tanah longsor, kapal tenggelam, serangan medis kritis).\n2. PAN-PAN, PAN-PAN, PAN-PAN: Digunakan untuk situasi mendesak namun belum mengancam jiwa seketika (kehabisan bahan bakar, mobil mogok di pedalaman terisolir).',
      },
      {
        title: '7.2 Format Laporan Darurat yang Benar',
        content: 'Sampaikan dengan tenang dan jelas:\n1. Identitas / Callsign stasiun Anda.\n2. Posisi koordinat GPS atau patokan lokasi geografis yang jelas.\n3. Jenis keadaan darurat (jumlah korban, kondisi luka).\n4. Bantuan spesifik yang dibutuhkan (ambulans, perahu karet, logistik).',
      },
    ],
  },
];

export default function HTGuideScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('cara-pakai');
  const [isHtModalOpen, setHtModalOpen] = useState(false);

  const filteredSections = HT_GUIDE_DATA.filter((sec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sec.title.toLowerCase().includes(q) ||
      sec.summary.toLowerCase().includes(q) ||
      sec.subsections.some(
        (sub) => sub.title.toLowerCase().includes(q) || sub.content.toLowerCase().includes(q)
      )
    );
  });

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={22} color={coffee.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>📻 Panduan HT (Handy Talky)</Text>
          <Text style={styles.headerSubtitle}>Protokol Komunikasi Radio Darurat & Warkop</Text>
        </View>
        <TouchableOpacity
          style={styles.openHtBtn}
          onPress={() => setHtModalOpen(true)}
          accessibilityLabel="Buka Radio HT"
        >
          <MaterialCommunityIcons name="radio-handheld" size={20} color="#FFF" />
          <Text style={styles.openHtBtnText}>Buka HT</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={coffee.muted} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari topik panduan (misal: frekuensi, PTT, legalitas, APRS)..."
          placeholderTextColor={coffee.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={16} color={coffee.secondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Quick Launch Hero Card */}
        <View style={styles.heroCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.heroIconWrap}>
              <Text style={{ fontSize: 26 }}>📻</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Komunikasi Radio Tanpa Internet</Text>
              <Text style={styles.heroDesc}>
                Ngopi mendukung Web Bluetooth, USB Serial Dongle, dan Modulasi Akustik FSK (Speaker HP ↔ Mic HT).
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.heroActionBtn}
            onPress={() => setHtModalOpen(true)}
          >
            <Ionicons name="mic" size={16} color="#1b120c" />
            <Text style={styles.heroActionBtnText}>Uji Coba Radio HT Sekarang</Text>
          </TouchableOpacity>
        </View>

        {/* Section List */}
        {filteredSections.map((sec) => {
          const isExpanded = expandedSection === sec.id;
          return (
            <View key={sec.id} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(sec.id)}
                activeOpacity={0.8}
              >
                <View style={styles.sectionNumBadge}>
                  <Text style={styles.sectionNumText}>{sec.number}</Text>
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={styles.sectionTitle}>{sec.title}</Text>
                    {sec.badge && (
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>{sec.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sectionSummary} numberOfLines={isExpanded ? undefined : 2}>
                    {sec.summary}
                  </Text>
                </View>

                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={coffee.accent}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.subsectionsList}>
                  {sec.subsections.map((sub, idx) => (
                    <View key={idx} style={styles.subsectionCard}>
                      <Text style={styles.subsectionTitle}>{sub.title}</Text>
                      <Text style={styles.subsectionContent}>{sub.content}</Text>
                      {sub.tips && sub.tips.length > 0 && (
                        <View style={styles.tipsBox}>
                          {sub.tips.map((tip, tIdx) => (
                            <View key={tIdx} style={{ flexDirection: 'row', gap: 6, marginBottom: 3 }}>
                              <Text style={{ color: coffee.accent, fontSize: 12 }}>💡</Text>
                              <Text style={styles.tipText}>{tip}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* HT Radio Modal Connected Directly */}
      <BluetoothHTModal visible={isHtModalOpen} onClose={() => setHtModalOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#140c07',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2b1a10',
    backgroundColor: '#1d120a',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#2b1a10',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: coffee.text,
    fontSize: 15,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: coffee.secondary,
    fontSize: 11,
  },
  openHtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#b45309',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openHtBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20140c',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#382215',
  },
  searchInput: {
    flex: 1,
    color: coffee.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: '#23160e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f2717',
    padding: 14,
    marginVertical: 10,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#352115',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroDesc: {
    color: coffee.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: coffee.accent,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  heroActionBtnText: {
    color: '#1b120c',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#1b110a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#331f13',
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  sectionNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#d97706',
  },
  sectionNumText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '700',
  },
  tagBadge: {
    backgroundColor: '#2e1c11',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagBadgeText: {
    color: coffee.accent,
    fontSize: 9,
    fontWeight: '600',
  },
  sectionSummary: {
    color: coffee.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  subsectionsList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#28170d',
    paddingTop: 10,
    gap: 10,
  },
  subsectionCard: {
    backgroundColor: '#150c07',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d1a0e',
  },
  subsectionTitle: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  subsectionContent: {
    color: coffee.text,
    fontSize: 11,
    lineHeight: 16,
  },
  tipsBox: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#d97706',
    padding: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  tipText: {
    color: '#fbbf24',
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
});
