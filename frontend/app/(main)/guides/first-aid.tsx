import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { coffee } from '../../../src/theme/coffee';
import BluetoothHTModal from '../../../src/components/BluetoothHTModal';
import EmergencySOSModal from '../../../src/components/EmergencySOSModal';

interface FirstAidSection {
  id: string;
  number: number;
  icon: string;
  title: string;
  badge?: string;
  summary: string;
  steps: Array<{
    title: string;
    description: string;
    do?: string[];
    dont?: string[];
  }>;
}

const EMERGENCY_NUMBERS = [
  { name: 'Panggilan Darurat Terpadu', number: '112', icon: 'call', color: '#ef4444' },
  { name: 'Ambulans Kemenkes / PSC', number: '119', icon: 'medical', color: '#f87171' },
  { name: 'Basarnas (Pencarian & SAR)', number: '115', icon: 'boat', color: '#f59e0b' },
  { name: 'Pemadam Kebakaran', number: '113', icon: 'flame', color: '#f97316' },
  { name: 'Kepolisian RI', number: '110', icon: 'shield', color: '#3b82f6' },
  { name: 'BNPB (Bencana Alam)', number: '117', icon: 'warning', color: '#10b981' },
];

const FIRST_AID_DATA: FirstAidSection[] = [
  {
    id: 'prinsip-dasar',
    number: 1,
    icon: 'medkit-outline',
    title: 'Prinsip Dasar P3K (DRSABCD)',
    badge: 'Prosedur Utama',
    summary: 'Protokol penyelamatan nyawa internasional untuk menilai kondisi korban sebelum tindakan lanjutan.',
    steps: [
      {
        title: '1.1 Langkah Berurutan DRSABCD',
        description: '• D - Danger: Pastikan keselamatan diri sendiri, orang sekitar, dan korban dari bahaya (arus listrik, api, lalu lintas).\n• R - Response: Cek respon korban (panggil namanya, tepuk pundak dengan tegas).\n• S - Send for help: Hubungi nomor darurat 112 / 119 atau minta bantuan orang di sekitar.\n• A - Airway: Buka jalan napas dengan mendongakkan kepala dan mengangkat dagu (head-tilt chin-lift).\n• B - Breathing: Lihat, dengar, dan rasakan hembusan napas selama 10 detik.\n• C - CPR: Jika korban tidak bernapas, segera lakukan kompresi dada.\n• D - Defibrillator: Pasang AED (jika tersedia) dan ikuti instruksi suara.',
        do: [
          'Selalu utamakan keselamatan penolong sebelum menyentuh korban.',
          'Gunakan sarung tangan medis atau pelindung jika ada kontak darah.',
        ],
        dont: [
          'Jangan panik dan jangan bertindak sendirian tanpa meminta bantuan.',
        ],
      },
    ],
  },
  {
    id: 'kecelakaan-lalin',
    number: 2,
    icon: 'car-outline',
    title: 'Kecelakaan Lalu Lintas',
    badge: 'Trauma Fisik',
    summary: 'Mengamankan lokasi kejadian jalan raya dan mencegah cedera permanen pada tulang belakang korban.',
    steps: [
      {
        title: '2.1 Pengamanan TKP & Penanganan Cedera Tulang Belakang',
        description: 'Amankan lokasi dengan segitiga pengaman atau tanda bahaya agar tidak terjadi tabrakan beruntun. Matikan kunci kontak kendaraan yang terlibat kecelakaan.',
        do: [
          'Pertahankan posisi leher dan kepala korban tetap lurus segaris dengan tubuh (fiksasi manual).',
          'Tenangkan korban dan instruksikan untuk tidak menggerakkan leher.',
        ],
        dont: [
          'JANGAN melepas helm korban motor kecuali jalan napasnya tersumbat total.',
          'JANGAN menarik atau memindahkan tubuh korban kecuali ada bahaya kebakaran atau ledakan mendesak.',
        ],
      },
    ],
  },
  {
    id: 'luka-bakar',
    number: 3,
    icon: 'flame-outline',
    title: 'Luka Bakar (Derajat 1, 2, dan 3)',
    badge: 'Termal & Kimia',
    summary: 'Penanganan pendinginan jaringan kulit secara tepat dan meluruskan mitos pengobatan rumahan berbahaya.',
    steps: [
      {
        title: '3.1 Penanganan Luka Bakar yang Tepat',
        description: '• Derajat 1: Kulit kemerahan, nyeri, tidak melepuh (misal: terbakar matahari).\n• Derajat 2: Kulit melepuh, terbentuk gelembung berisi cairan, nyeri hebat.\n• Derajat 3: Kulit hangus kehitaman atau memutih pucat, merusak saraf sehingga kadang tidak terasa sakit.',
        do: [
          'Siram atau alirkan air bersih bersuhu normal (bukan air es) selama 15 - 20 menit.',
          'Lepaskan cincin, jam tangan, atau pakaian ketat sebelum area membengkak.',
          'Tutup luka secara longgar dengan kain kasa steril atau plastik wrap bersih.',
        ],
        dont: [
          'JANGAN oleskan pasta gigi, mentega, kecap, minyak goreng, atau tepung!',
          'JANGAN memecahkan gelembung lepuhan luka karena akan membuka pintu infeksi bakteri.',
        ],
      },
    ],
  },
  {
    id: 'cpr-jantung',
    number: 4,
    icon: 'heart-outline',
    title: 'Serangan Jantung & CPR (RJP)',
    badge: 'Kritis Gawat Darurat',
    summary: 'Teknik Resusitasi Jantung Paru (RJP) untuk memompa sirkulasi oksigen ke otak pada korban henti jantung.',
    steps: [
      {
        title: '4.1 Teknik Kompresi Dada (Hands-Only CPR)',
        description: 'Tempatkan tumit tangan Anda di tengah dada korban (setengah bawah tulang dada). Kunci jari tangan lainnya di atasnya. Posisikan bahu tegak lurus di atas dada korban dengan siku lurus.',
        do: [
          'Tekan dada sedalam 5 - 6 cm dengan kecepatan 100 - 120 kali per menit (ritme lagu "Stayin\' Alive").',
          'Biarkan dada mengembang sempurna (full recoil) setelah setiap kompresi.',
          'Lakukan terus tanpa henti sampai tim medis datang atau korban menunjukkan tanda sadar.',
        ],
        dont: [
          'Jangan membungkukkan lengan; gunakan berat tubuh bagian atas untuk menekan.',
        ],
      },
    ],
  },
  {
    id: 'tersedak',
    number: 5,
    icon: 'body-outline',
    title: 'Tersedak (Heimlich Maneuver)',
    badge: 'Obstruksi Napas',
    summary: 'Tindakan cepat membebaskan sumbatan benda asing pada saluran pernapasan dewasa, anak, dan bayi.',
    steps: [
      {
        title: '5.1 Manuver Heimlich Dewasa & Anak',
        description: 'Jika korban memegang leher, tidak bisa bersuara, batuk, atau bernapas:\n1. Berdiri di belakang korban, lingkarkan lengan di pinggangnya.\n2. Kepalkan satu tangan, tempatkan di atas pusar dan di bawah tulang rusuk korban.\n3. Genggam kepalan tangan dengan tangan satunya, lalu lakukan hentakan cepat ke dalam dan ke atas.',
        do: [
          'Dorong korban untuk terus batuk sekuat tenaga jika ia masih bisa bersuara.',
          'Untuk wanita hamil atau orang obesitas: lakukan hentakan di bagian tengah tulang dada (chest thrust).',
        ],
        dont: [
          'Jangan melakukan hentakan perut pada bayi di bawah 1 tahun (gunakan 5 pukulan punggung & 5 dorongan dada).',
        ],
      },
    ],
  },
  {
    id: 'pendarahan',
    number: 6,
    icon: 'water-outline',
    title: 'Pendarahan Berat & Tourniquet',
    badge: 'Trauma Sirkulasi',
    summary: 'Menghentikan pendarahan arteri yang berpotensi memicu syok hipovolemik fatal dalam hitungan menit.',
    steps: [
      {
        title: '6.1 Tekan Langsung & Pemasangan Tourniquet',
        description: 'Pendarahan deras berwarna merah terang yang memancar menandakan luka arteri besar.',
        do: [
          'Tekan langsung luka (Direct Pressure) menggunakan kain bersih atau kasa steril dengan kuat tanpa ragu.',
          'Tinggikan (elevasi) anggota tubuh yang terluka di atas posisi jantung jika tidak ada patah tulang.',
          'Gunakan Tourniquet pada lengan/tungkai (5 cm di atas luka) jika tekanan langsung gagal menghentikan darah.',
          'Catat jam pemasangan tourniquet di dahi korban atau kain balut.',
        ],
        dont: [
          'Jangan melepas kain kasa pertama yang basah oleh darah; tumpuk kain baru di atasnya.',
        ],
      },
    ],
  },
  {
    id: 'tenggelam',
    number: 7,
    icon: 'boat-outline',
    title: 'Tenggelam & Asfiksia Air',
    badge: 'Bahaya Air',
    summary: 'Prinsip penyelamatan di air tanpa membahayakan penolong dan pemulihan oksigen paru-paru.',
    steps: [
      {
        title: '7.1 Prinsip Reach, Throw, Row, Go',
        description: 'Utamakan menyelamatkan korban dari darat:\n1. Reach: Ulurkan galah, cabang kayu, atau tali.\n2. Throw: Lempar pelampung atau jeriken kosong bertali.\n3. Row: Gunakan perahu mendekati korban.\n4. Go: Berenang HANYA jika Anda perenang terlatih berpelampung.',
        do: [
          'Segera lakukan 5 kali bantuan napas buatan penyelamat begitu korban diangkat ke darat, diikuti CPR jika tidak ada napas.',
          'Ganti pakaian basah dengan selimut kering untuk mencegah hipotermia.',
        ],
        dont: [
          'Jangan mencoba membuang air dari perut korban dengan membalik badannya karena bisa memicu muntah masuk paru-paru.',
        ],
      },
    ],
  },
  {
    id: 'bencana-alam',
    number: 8,
    icon: 'earth-outline',
    title: 'Bencana Alam (Gempa, Banjir, Tsunami)',
    badge: 'Mitigasi Bencana',
    summary: 'Tindakan penyelamatan diri mandiri saat terjadi goncangan gempa bumi, banjir bandang, dan ancaman tsunami.',
    steps: [
      {
        title: '8.1 Protokol Keselamatan Gempa & Tsunami',
        description: '• Gempa Bumi: DROP, COVER, HOLD ON! (Merunduk, Berlindung di bawah meja kokoh, dan Berpegangan). Jauhi kaca jendela dan lemari tinggi.\n• Tsunami (Hukum 20-20-20): Jika gempa berlangsung selama 20 detik atau lebih, Anda memiliki waktu 20 menit untuk segera lari ke tempat dengan ketinggian minimal 20 meter.',
        do: [
          'Matikan saklar listrik utama dan kompor gas sebelum keluar ruangan.',
          'Gunakan tangga darurat, jangan pernah menggunakan lift saat bencana gempa/kebakaran.',
        ],
        dont: [
          'Jangan menunggu sirine resmi jika merasakan gempa kuat di tepi pantai.',
        ],
      },
    ],
  },
  {
    id: 'evakuasi-shelter',
    number: 9,
    icon: 'home-outline',
    title: 'Evakuasi & Tempat Pengungsian',
    badge: 'Logistik Posko',
    summary: 'Teknik mobilisasi korban selamat, pemilahan darurat (triage), dan higienitas sanitasi posko bencana.',
    steps: [
      {
        title: '9.1 Teknik Membopong Korban & Tandu Darurat',
        description: 'Tandu darurat dapat dibuat menggunakan dua bilah bambu kokoh dan selimut tebal atau dua buah kemeja lengan panjang yang dibalik.',
        do: [
          'Gunakan metode tarikan selimut (blanket drag) jika harus memindahkan korban sendirian di lorong sempit.',
          'Pastikan air minum di shelter dimasak mendidih untuk mencegah wabah kolera dan diare.',
        ],
      },
    ],
  },
  {
    id: 'kontak-darurat',
    number: 10,
    icon: 'call-outline',
    title: 'Kontak Darurat Resmi Indonesia',
    badge: 'Hotline Nasional',
    summary: 'Daftar nomor kontak instansi resmi pemerintah untuk koordinasi penyelamatan cepat bebas pulsa.',
    steps: [
      {
        title: '10.1 Nomor Penting Bebas Pulsa',
        description: 'Semua nomor darurat di bawah ini dapat dihubungi melalui ponsel meskipun tanpa pulsa seluler.',
        do: [
          'Sampaikan lokasi patokan dengan jelas saat menghubungi operator.',
          'Tetap di sambungan telepon sampai operator mengizinkan Anda menutup panggilan.',
        ],
      },
    ],
  },
];

export default function FirstAidGuideScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('prinsip-dasar');
  const [isHtModalOpen, setHtModalOpen] = useState(false);
  const [isSosModalOpen, setSosModalOpen] = useState(false);

  const filteredSections = FIRST_AID_DATA.filter((sec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sec.title.toLowerCase().includes(q) ||
      sec.summary.toLowerCase().includes(q) ||
      sec.steps.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.do?.some((d) => d.toLowerCase().includes(q)) ||
          s.dont?.some((d) => d.toLowerCase().includes(q))
      )
    );
  });

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch((err) => {
      console.warn('Gagal memanggil nomor darurat:', err);
    });
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
          <Text style={styles.headerTitle}>🚨 Panduan P3K & Darurat</Text>
          <Text style={styles.headerSubtitle}>Prosedur Medis Pertama & Penyelamatan Nyawa</Text>
        </View>
        <TouchableOpacity
          style={styles.sosButton}
          onPress={() => setSosModalOpen(true)}
          accessibilityLabel="Mode Darurat & SOS HT"
        >
          <Ionicons name="warning" size={16} color="#FFF" />
          <Text style={styles.sosButtonText}>🚨 SOS</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Hotlines Horizontal Bar */}
      <View style={styles.hotlinesContainer}>
        <Text style={styles.hotlinesLabel}>PANGGILAN CEPAT DARURAT (BEBAS PULSA):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotlinesScroll}>
          {EMERGENCY_NUMBERS.map((item) => (
            <TouchableOpacity
              key={item.number}
              style={[styles.hotlinePill, { borderColor: item.color }]}
              onPress={() => handleCall(item.number)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon as any} size={14} color={item.color} />
              <Text style={styles.hotlineNum}>{item.number}</Text>
              <Text style={styles.hotlineName} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={coffee.muted} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari cedera atau panduan (misal: CPR, luka bakar, pendarahan, gempa)..."
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
        {/* DRSABCD Banner Card */}
        <View style={styles.drsabcdCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.crossIconWrap}>
              <FontAwesome5 name="plus" size={18} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.drsabcdTitle}>Ingat Rumus Utama: DRSABCD</Text>
              <Text style={styles.drsabcdDesc}>
                Danger → Response → Send Help → Airway → Breathing → CPR → Defibrillation
              </Text>
            </View>
          </View>
        </View>

        {/* 10 Modules List */}
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
                <View style={styles.stepsList}>
                  {sec.steps.map((step, idx) => (
                    <View key={idx} style={styles.stepCard}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDesc}>{step.description}</Text>

                      {step.do && step.do.length > 0 && (
                        <View style={styles.doBox}>
                          <Text style={styles.boxHeaderDo}>✅ YANG HARUS DILAKUKAN:</Text>
                          {step.do.map((item, dIdx) => (
                            <View key={dIdx} style={{ flexDirection: 'row', gap: 6, marginBottom: 3 }}>
                              <Text style={{ color: '#4ade80', fontSize: 11 }}>•</Text>
                              <Text style={styles.doText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {step.dont && step.dont.length > 0 && (
                        <View style={styles.dontBox}>
                          <Text style={styles.boxHeaderDont}>❌ JANGAN DILAKUKAN:</Text>
                          {step.dont.map((item, dnIdx) => (
                            <View key={dnIdx} style={{ flexDirection: 'row', gap: 6, marginBottom: 3 }}>
                              <Text style={{ color: '#f87171', fontSize: 11 }}>•</Text>
                              <Text style={styles.dontText}>{item}</Text>
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

      {/* Quick Radio HT Modal integration */}
      <BluetoothHTModal visible={isHtModalOpen} onClose={() => setHtModalOpen(false)} />

      {/* Emergency Mode SOS Modal */}
      <EmergencySOSModal
        visible={isSosModalOpen}
        onClose={() => setSosModalOpen(false)}
        onOpenHT={() => setHtModalOpen(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#140806',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2f1510',
    backgroundColor: '#200c09',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#2f1510',
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
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sosButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  hotlinesContainer: {
    backgroundColor: '#1b0d0a',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2b130e',
  },
  hotlinesLabel: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  hotlinesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  hotlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#26120e',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hotlineNum: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  hotlineName: {
    color: coffee.muted,
    fontSize: 10,
    maxWidth: 130,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e0e0a',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#381a13',
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
  drsabcdCard: {
    backgroundColor: '#28100b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4d1e15',
    padding: 12,
    marginVertical: 10,
  },
  crossIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drsabcdTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  drsabcdDesc: {
    color: '#fca5a5',
    fontSize: 11,
    lineHeight: 15,
  },
  sectionCard: {
    backgroundColor: '#1b0c09',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#341611',
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
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  sectionNumText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '700',
  },
  tagBadge: {
    backgroundColor: '#331510',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagBadgeText: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '600',
  },
  sectionSummary: {
    color: coffee.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  stepsList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#2b120c',
    paddingTop: 10,
    gap: 10,
  },
  stepCard: {
    backgroundColor: '#140806',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2f140e',
  },
  stepTitle: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepDesc: {
    color: coffee.text,
    fontSize: 11,
    lineHeight: 16,
  },
  doBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  boxHeaderDo: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  doText: {
    color: '#bbf7d0',
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
  dontBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    padding: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  boxHeaderDont: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  dontText: {
    color: '#fecaca',
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
});
