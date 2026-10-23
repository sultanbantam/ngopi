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
import HTWalkieTalkieModal from '../../../src/components/HTWalkieTalkieModal';

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
    id: 'p2p-hotspot',
    number: 1,
    icon: 'wifi-outline',
    title: 'Mode P2P Hotspot (Offline Total di Hutan / Terpencil)',
    badge: 'Fitur Baru 🔥',
    summary: 'Komunikasi suara PTT dan teks langsung antar HP/Laptop tanpa internet, tanpa pulsa, dan tanpa menara seluler BTS menggunakan Hotspot Portabel.',
    subsections: [
      {
        title: '1.1 Mengapa Bisa Berfungsi Tanpa Internet & BTS?',
        content: 'Meskipun smartphone biasa tidak memiliki chip radio pemancar VHF/UHF (144/430 MHz), setiap HP dan laptop memiliki pemancar gelombang radio Wi-Fi 2.4 GHz bawaan.\n\nKetika 1 HP mengaktifkan fitur "Hotspot Portabel / Tethering" (meskipun paket data seluler dimatikan atau tidak ada sinyal sama sekali), HP tersebut bertindak sebagai Menara Base Station Lokal yang memancarkan sinyal radio LAN nirkabel mandiri.\n\nAplikasi Ngopi secara cerdas memanfaatkan WebRTC Local Direct Host Candidates (UDP LAN) sehingga suara PTT dan pesan darurat dialirkan langsung dari antena HP ke HP lainnya secara instan, suara jernih, dan 100% GRATIS!',
        tips: [
          'Tidak membutuhkan pulsa atau kuota internet sedikitpun.',
          'Dapat digunakan di tengah hutan belantara, lereng gunung, ruang bawah tanah (basement), atau saat bencana mati listrik total.',
        ],
      },
      {
        title: '1.2 Langkah 1: Pengaturan HP 1 (Sebagai Posko / Host)',
        content: '1. Buka Pengaturan HP Anda → Nyalakan "Hotspot Portabel / Tethering Wi-Fi" (Data seluler boleh dimatikan).\n2. Buka aplikasi Ngopi → Buka menu HT Radio.\n3. Di deretan tombol mode, pilih [ 📶 P2P Hotspot (Offline HP) ].\n4. Klik tombol [ 👑 Host Posko ]. Layar akan menampilkan status aktif dan mendeteksi rekan yang bergabung.',
      },
      {
        title: '1.3 Langkah 2: Pengaturan HP 2 / Laptop (Sebagai Klien / Anggota)',
        content: '1. Nyalakan Wi-Fi di HP 2 atau Laptop Anda, lalu sambungkan ke Hotspot HP 1 tadi.\n(Abaikan peringatan HP seperti "Wi-Fi tidak ada internet", tetap pilih "Tetap Terhubung").\n2. Buka aplikasi Ngopi → Buka menu HT Radio.\n3. Pilih [ 📶 P2P Hotspot (Offline HP) ].\n4. Klik tombol [ 📱 Klien / Anggota ], lalu klik [ 🔄 Pindai Rekan ]. Status langsung berubah menjadi TERKONEKSI!',
        tips: [
          'Setelah terhubung, jika HP 1 bicara via tombol PTT, suara akan langsung terdengar jernih di HP 2 lengkap dengan nada Roger Beep saat tombol selesai dilepas!',
        ],
      },
      {
        title: '1.4 Jangkauan Sinyal & Cara Memperluas Radius',
        content: '• Jangkauan Standar: Sekitar 50 – 150 meter di alam terbuka tanpa halangan.\n• Tips Memperluas Jangkauan:\n  1. Tempatkan HP Host di posisi lebih tinggi (gantung di dahan pohon, taruh di atap mobil tenda posko, atau di puncak bukit).\n  2. Gunakan Mini Wi-Fi Extender / Repeater USB murah bertenaga Powerbank untuk memperluas jangkauan hingga 300+ meter di area camping / SAR.',
      },
    ],
  },
  {
    id: 'cara-tekan-ptt',
    number: 2,
    icon: 'finger-print-outline',
    title: 'Cara Menekan Tombol PTT: HP vs Laptop',
    badge: 'Tips Praktis',
    summary: 'Fitur sekali ketuk yang ramah layar sentuh HP agar jari tidak pegal, serta penggunaan tombol spasi pada laptop.',
    subsections: [
      {
        title: '2.1 Mode Sekali Ketuk (Sangat Direkomendasikan di HP)',
        content: 'Menekan dan menahan tombol bulat terus-menerus di layar sentuh HP sering membuat jari lelah, kram, atau tidak sengaja tergelincir.\n\nKini Ngopi menyediakan fitur tombol pintar:\n• Aktifkan toggle [ 👆 Sekali Ketuk (Mudah di HP) ] di atas tombol PTT.\n• Cukup KETUK SEKALI untuk mulai berbicara (Lampu TX menyala merah & muncul tulisan "SEDANG BICARA...").\n• Bicaralah dengan santai tanpa perlu menahan jari di layar.\n• KETUK SEKALI LAGI jika sudah selesai bicara. Transmisi langsung berakhir dan nada "Roger Beep" khas radio akan terkirim otomatis ke lawan bicara!',
        tips: [
          'Sangat praktis saat tangan sedang kotor waktu masak di perkemahan atau saat memegang perlengkapan outdoor.',
        ],
      },
      {
        title: '2.2 Mode Tahan Terus (Klasik untuk Laptop & Desktop)',
        content: '• Jika Anda menggunakan Laptop / PC, atau menyukai gaya HT konvensional, gunakan mode [ ⏳ Tahan Terus ].\n• Tekan dan tahan tombol bulat PTT dengan mouse/trackpad selama berbicara, lalu lepaskan untuk mengakhiri transmisi.\n• Shortcut Keyboard Laptop: Anda juga dapat menekan dan menahan tombol [ SPASI ] di keyboard laptop untuk mengudara!',
      },
    ],
  },
  {
    id: 'hutan-vs-jakarta',
    number: 3,
    icon: 'earth-outline',
    title: 'Hutan vs Jakarta: Cara Kerja Offline vs Online',
    badge: 'Wajib Tahu',
    summary: 'Penjelasan lengkap apakah HP offline di hutan (misal Lebak) bisa menghubungi laptop online di Jakarta.',
    subsections: [
      {
        title: '3.1 Bisakah HP Offline di Hutan Bicara ke Jakarta Tanpa Internet?',
        content: 'Jawabannya: TIDAK BISA secara langsung murni antar HP tanpa bantuan perantara apapun.\n\nAlasan Hukum Fisika Radio:\n• Gelombang Wi-Fi HP hanya berdaya ~0.1 Watt dengan jangkauan 100-200 meter.\n• Untuk menembus ratusan kilometer (dari pedalaman hutan Banten/Lebak ke Jakarta) tanpa internet sama sekali, dibutuhkan pemancar radio HF (High Frequency) berdaya 100 Watt dengan antena bentang kawat puluhan meter yang memantulkan sinyal ke lapisan ionosfer bumi, atau menggunakan jaringan satelit.',
      },
      {
        title: '3.2 Skenario 1: Jika Salah Satu Punya Sinyal (Cloud RoIP)',
        content: 'Jika salah satu atau kedua perangkat memiliki koneksi internet (4G, Wi-Fi warkop, atau Starlink):\n• Masuk ke frekuensi warkop (misal 145.500 MHz) di Ngopi.\n• Fitur Cloud RoIP (Radio over IP) Ngopi akan menyambungkan suara Anda ke server cloud, sehingga rekan di Jakarta, Surabaya, maupun luar negeri dapat mendengar suara Anda secara jernih di frekuensi yang sama!',
      },
      {
        title: '3.3 Skenario 2: Keduanya Offline di Hutan (Jarak Jauh Berkilo-kilometer)',
        content: 'Jika kedua-duanya berada di hutan tanpa sinyal internet, bagaimana caranya berkomunikasi jarak jauh?\n• Gunakan Radio HT Fisik Sungguhan (Baofeng UV-5R, Icom, Alinco, Kenwood).\n• Di aplikasi Ngopi, pilih [ Moda Akustik FSK ] atau [ Kabel K-Plug / USB Serial ].\n• Dekatkan speaker HP ke mic HT fisik. HP Anda akan mengeluarkan nada data digital radio (bunyi tut-tet-tot FSK) yang dipancarkan oleh HT fisik dengan daya 5 Watt VHF menembus gunung dan lembah hingga 5 – 20 km ke HT rekan!',
        tips: [
          'Teknik inilah yang digunakan oleh para pegiat radio amatir (APRS) dan tim SAR penyelamat saat terjadi gempa bumi atau tsunami ketika seluruh BTS seluler roboh.',
        ],
      },
      {
        title: '3.4 Skenario Gateway (Jembatan Hutan ke Kota)',
        content: 'Jika ada 1 rekan yang berada di puncak bukit yang masih mendapatkan sinyal 4G lemah, perangkatnya bisa difungsikan sebagai "Gateway".\nPerangkat tersebut menerima sinyal Hotspot/HT lokal dari dalam lembah hutan, lalu meneruskannya secara otomatis ke internet Ngopi menuju Jakarta.',
      },
    ],
  },
  {
    id: 'modamodem',
    number: 4,
    icon: 'options-outline',
    title: '4 Moda Transmisi HT di Aplikasi Ngopi',
    badge: 'Fitur Lengkap',
    summary: 'Perbandingan 4 jalur transmisi di Ngopi untuk berbagai situasi: dari camping santai hingga ekspedisi darurat.',
    subsections: [
      {
        title: '4.1 📶 Moda 1: P2P Local Hotspot (Offline Tanpa Alat Tambahan)',
        content: '• Media: Gelombang Wi-Fi Lokal smartphone.\n• Jarak: 50 – 150 meter.\n• Keperluan: Komunikasi antar tenda camping, konvoi mobil dekat, keluarga saat mati lampu, atau tim SAR di sekitar posko darurat.',
      },
      {
        title: '4.2 🔊 Moda 2: Modulasi Akustik FSK (Speaker HP ↔ Mic HT Fisik)',
        content: '• Media: Nada suara audio frekuensi Bell-202 AFSK 1200 baud yang dipancarkan via HT analog fisik.\n• Jarak: 2 – 15 km (tergantung HT fisik dan antena yang digunakan).\n• Cara Kerja: HP memancarkan suara "chirp/tut-tet", mic HT menangkapnya dan memancarkannya ke udara. Di sisi penerima, suara kresek dari speaker HT didengarkan oleh mic HP dan diterjemahkan kembali menjadi teks/koordinat!',
      },
      {
        title: '4.3 🔌 Moda 3: USB Serial / Kabel Audio K-Plug',
        content: '• Media: Kabel data USB Serial (CH340/CP2102) atau kabel K-Plug audio dari jack headset HP ke HT.\n• Kelebihan: Tidak ada suara berisik dari speaker luar, PTT terpicu otomatis secara elektrik, transmisi lebih stabil dan bebas distorsi suara sekitar.',
      },
      {
        title: '4.4 ☁️ Moda 4: Cloud RoIP (Digital Internet)',
        content: '• Media: Jaringan internet (4G / 5G / Fiber Optik / Wi-Fi).\n• Jarak: Seluruh dunia tanpa batas.\n• Keperluan: Nongkrong bareng komunitas radio dan warkop dari berbagai kota secara interlokal.',
      },
    ],
  },
  {
    id: 'istilah-brik',
    number: 5,
    icon: 'chatbubbles-outline',
    title: 'Kamus "Brik-Brik" & Etika Komunikasi Komunitas',
    badge: 'Komunitas Warkop',
    summary: 'Kamus istilah radio amatir, tata krama memotong frekuensi, dan sandi radio legendaris Indonesia.',
    subsections: [
      {
        title: '5.1 Mengapa Komunitas Suka Menyebut "Brik-Brik"?',
        content: 'Istilah "Brik-Brik" berasal dari kata serapan bahasa Inggris "Break... Break...".\nDalam tradisi komunikasi radio dua arah (half-duplex):\n• Ketika ada stasiun yang sedang mengudara, kita tidak boleh langsung berbicara menimpa suaranya.\n• Bila ingin bergabung atau menyampaikan pesan singkat, tunggu ada jeda bicara 1-2 detik, lalu tekan PTT dan ucapkan: "Brik... brik... izin masuk, di sini [Nama Anda]... ganti."\n• Moderator atau rekan yang sedang pegang frekuensi akan menjawab: "Masuk silakan, ganti."',
      },
      {
        title: '5.2 Istilah-Istilah Wajib Anak Radio',
        content: '• Roger / 10-4: Pesan sudah didengar dan dimengerti dengan baik.\n• Ganti (Over): Tanda saya sudah selesai bicara, sekarang giliran Anda yang bicara.\n• Roger Beep: Nada tit-tet pendek otomatis setelah PTT dilepas sebagai tanda ganti bicara.\n• 10-20: Menanyakan posisi / lokasi ("10-20 Anda di sebelah mana rekan?").\n• 10-8: Siap memonitor / bertugas kembali.\n• Monitor / Standby: Mendengarkan frekuensi tanpa berbicara.\n• Copy That: Dipahami / diterima laporannya.',
        tips: [
          'Gunakan istilah-istilah ini di fitur HT Ngopi saat ngobrol santai agar suasana warkop terasa seperti komunitas radio brik-brik sungguhan!',
        ],
      },
    ],
  },
  {
    id: 'darurat-sar',
    number: 6,
    icon: 'alert-circle-outline',
    title: 'Mode Darurat SOS & Koordinat GPS (SAR & Bencana)',
    badge: 'Penyelamatan',
    summary: 'Pengiriman sinyal SOS darurat, koordinat garis lintang/bujur, serta prosedur evakuasi MAYDAY.',
    subsections: [
      {
        title: '6.1 Siaran Darurat SOS dengan Koordinat GPS',
        content: 'Di aplikasi Ngopi, tombol [ 🚨 SOS Darurat ] dirancang untuk situasi kritis:\n• Sekali tekan, aplikasi membaca sensor GPS perangkat Anda secara offline.\n• Pesan darurat beserta koordinat akurat (misal: LAT -6.2088, LON 106.8456) langsung disiarkan ke seluruh rekan yang sedang memonitor frekuensi.\n• Di perangkat penerima, layar akan berkedip merah dan memutar sirene darurat.',
      },
      {
        title: '6.2 Panggilan Bahaya: MAYDAY vs PAN-PAN',
        content: '1. MAYDAY (3x): HANYA untuk ancaman langsung terhadap keselamatan jiwa (banjir bandang, longsor menimbun jalan, pendaki patah tulang/koma).\n2. PAN-PAN (3x): Untuk keadaan darurat mendesak namun belum mengancam jiwa saat itu (tenda sobek diterjang badai, logistik habis, kendaraan mogok di pedalaman).',
      },
    ],
  },
  {
    id: 'legalitas-frekuensi',
    number: 7,
    icon: 'shield-checkmark-outline',
    title: 'Alokasi Frekuensi Resmi & Legalitas di Indonesia',
    badge: 'Regulasi',
    summary: 'Daftar frekuensi resmi ORARI, RAPI, BNPB, dan regulasi spektrum frekuensi radio Kominfo.',
    subsections: [
      {
        title: '7.1 Daftar Alokasi Frekuensi Penting',
        content: '• 145.000 MHz: Kanal Darurat Nasional ORARI & SAR Penyelamatan Bencana.\n• 145.500 MHz: Saluran Simplex Komunitas Warkop Ngopi (Default).\n• 143.500 MHz: Saluran Bantuan Komunikasi RAPI Nasional.\n• 433.000 MHz: Frekuensi Panggil Calling UHF Nasional.',
        tips: [
          'Jangan gunakan frekuensi darurat (145.000 MHz) untuk bercanda atau mengobrol biasa!',
        ],
      },
      {
        title: '7.2 Legalitas Hukum di Indonesia',
        content: '• Mode P2P Hotspot Ngopi menggunakan frekuensi Wi-Fi 2.4 GHz (ISM Band) yang bebas lisensi dan 100% legal digunakan oleh masyarakat umum tanpa izin khusus.\n• Jika Anda menghubungkan Ngopi ke radio transceiver fisik VHF/UHF berdaya pancar tinggi (1-50 Watt), pastikan Anda memiliki Izin Amatir Radio (IAR) dari ORARI atau KRAP dari RAPI sesuai UU Telekomunikasi No. 36 Tahun 1999.',
      },
    ],
  },
  {
    id: 'faq-tanya-jawab',
    number: 8,
    icon: 'help-circle-outline',
    title: 'Tanya Jawab Populer (FAQ HT Ngopi)',
    badge: 'Tanya Jawab',
    summary: 'Jawaban atas pertanyaan-pertanyaan yang paling sering diajukan seputar HT radio di Ngopi.',
    subsections: [
      {
        title: 'Q1: Apakah suara FSK yang bunyi "tut-tet-tot" itu rusak?',
        content: 'Bukan rusak! Itu adalah nada data digital Bell-202 AFSK (Audio Frequency Shift Keying). Mirip suara modem internet telepon zaman dulu atau nada fax, di mana teks dan koordinat GPS diubah menjadi suara nada biner untuk dipancarkan ke mic radio HT.',
      },
      {
        title: 'Q2: Apakah aplikasi Ngopi bisa tetap dibuka saat tidak ada internet?',
        content: 'Bisa! Ngopi dibuat dengan teknologi PWA (Progressive Web App). Jika Anda sudah pernah membuka https://ngopi.top di browser HP atau sudah menambahkannya ke Layar Utama (Add to Home Screen), seluruh tampilan HT, panduan, dan pengirim pesan offline tetap bisa dibuka dan dijalankan tanpa internet.',
      },
      {
        title: 'Q3: Apakah teman saya yang mantan pemain HT brik-brik bisa gabung?',
        content: 'Sangat bisa! Ajak teman-teman komunitas brik-brik Anda bernostalgia. Di Ngopi, sensasi klasik radio HT (S-Meter jarum, lampu TX/RX, Roger Beep, pilihan kanal frekuensi, dan sandi radio) dikemas secara modern di smartphone tanpa harus membeli perangkat radio mahal.',
      },
    ],
  },
];

export default function HTGuideScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('p2p-hotspot');
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
          placeholder="Cari topik panduan (misal: hotspot, PTT, hutan, brik-brik, frekuensi)..."
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
              <Text style={styles.heroTitle}>HT Offline Tanpa Pulsa & Kuota</Text>
              <Text style={styles.heroDesc}>
                Bisa berkomunikasi langsung menggunakan P2P Wi-Fi Hotspot HP, Akustik FSK (Speaker HP ↔ Mic HT), atau USB Serial Cable.
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
      <HTWalkieTalkieModal visible={isHtModalOpen} onClose={() => setHtModalOpen(false)} />
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
