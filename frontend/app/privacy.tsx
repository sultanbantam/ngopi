import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { coffee } from '../src/theme/coffee';

const sections = [
  {
    title: '1. Pengelola dan cakupan / Who operates Ngopi',
    id: 'Pengelola Ngopi adalah Yayasan Sabumi Nusantara Jaya. Kebijakan ini menjelaskan cara kami mengelola data saat Anda memakai https://ngopi.top, termasuk chat pribadi, Warkop/komunitas, profil, lampiran, pesan suara, panggilan, dan fitur terkait. Untuk pertanyaan privasi atau permintaan penghapusan akun, email founder@ngopi.top atau hubungi akun @ngopi di Ngopi. Kami dapat meminta verifikasi bahwa akun tersebut milik Anda.',
    en: 'Ngopi is operated by Yayasan Sabumi Nusantara Jaya. This policy explains how we handle data when you use https://ngopi.top, including private chats, Warkop/communities, profiles, attachments, voice messages, calls, and related features. For privacy questions or account deletion requests, email founder@ngopi.top or contact the @ngopi account on Ngopi. We may ask you to verify that you own the account.',
  },
  {
    title: '2. Data yang kami proses / Data we process',
    id: 'Akun: username, nama tampilan, hash kata sandi, dan ID akun. Anda dapat memilih menambahkan foto profil, bio, status, kunci publik, atau alamat wallet publik untuk fitur tertentu. Pendaftaran biasa tidak meminta nomor telepon atau email. Jangan kirimkan kata sandi Pi, private key, atau seed phrase kepada siapa pun.\n\nKomunikasi: pesan, waktu pengiriman, identitas pengirim/penerima atau Warkop, status terkirim/terbaca, reaksi, balasan, dan file yang Anda unggah, seperti gambar, audio, atau dokumen. Kami juga memproses nama, foto, deskripsi, anggota, dan pengaturan Warkop yang Anda buat.\n\nData teknis: alamat IP dan informasi browser/perangkat (user-agent) yang dapat dicatat saat sesi dibuat, token sesi/cookie yang diperlukan untuk login, serta catatan teknis untuk keamanan dan pemecahan masalah.',
    en: 'Account data: username, display name, password hash, and account ID. You may choose to add a profile photo, bio, status, public key, or public wallet address for certain features. Standard registration does not ask for a phone number or email address. Never give anyone your Pi password, private key, or seed phrase.\n\nCommunications: messages, timestamps, sender/recipient or Warkop, delivery/read status, reactions, replies, and files you upload, such as images, audio, or documents. We also process the name, photo, description, members, and settings of Warkop spaces you create.\n\nTechnical data: IP address and browser/device information (user-agent) that may be recorded when a session is created, session tokens/cookies needed for login, and technical logs for security and troubleshooting.',
  },
  {
    title: '3. Tujuan penggunaan / Why we use data',
    id: 'Kami memakai data untuk membuat dan mengamankan akun; mengirim pesan dan lampiran; menjalankan fitur Warkop, profil, panggilan, dukungan, dan pemeriksaan akses komunitas; mencegah spam, penyalahgunaan, dan gangguan keamanan; serta memperbaiki layanan dan memenuhi kewajiban hukum. Izin kamera dan mikrofon hanya digunakan saat Anda memilih fitur panggilan atau merekam pesan suara.',
    en: 'We use data to create and secure accounts; deliver messages and attachments; operate Warkop, profiles, calls, support, and community access checks; prevent spam, abuse, and security incidents; improve the service; and meet legal obligations. Camera and microphone permissions are used only when you choose a call or voice-message feature.',
  },
  {
    title: '4. Pesan, panggilan, dan enkripsi / Messages, calls, and encryption',
    id: 'Ngopi bukan layanan dengan enkripsi end-to-end. Pesan dan lampiran diproses melalui server untuk menyediakan layanan. Sebagian teks pesan dienkripsi saat tersimpan, tetapi petugas berwenang atau sistem Ngopi dapat memprosesnya untuk menjalankan layanan, dukungan, keamanan, dan penanganan laporan. Jangan mengirim data sangat rahasia.\n\nPanggilan suara/video memakai izin perangkat dan teknologi komunikasi real-time. Ngopi tidak menyediakan fitur perekaman panggilan. Data sinyal dan koneksi diperlukan untuk menghubungkan peserta; kualitas dan jalur media dapat bergantung pada jaringan dan penyedia relay.',
    en: 'Ngopi is not an end-to-end encrypted service. Messages and attachments are processed through servers to provide the service. Some message text is encrypted while stored, but authorized personnel or Ngopi systems may process it to operate the service, provide support, maintain security, and handle reports. Do not send highly sensitive information.\n\nVoice/video calls use device permissions and real-time communication technology. Ngopi does not provide a call-recording feature. Signaling and connection data are needed to connect participants; media quality and routing may depend on networks and relay providers.',
  },
  {
    title: '5. Penerjemahan dan layanan pihak ketiga / Translation and third parties',
    id: 'Jika Anda meminta penerjemahan, teks yang dipilih dikirim ke Google Translate untuk diterjemahkan. Google dapat memprosesnya berdasarkan kebijakan privasinya sendiri. Jika Anda membuka Ngopi melalui Pi Browser atau memakai integrasi Pi yang tersedia, Pi Network dan penyedia terkait dapat memproses data teknis atau transaksi mereka sendiri. Ngopi tidak meminta private key atau seed phrase. Penyedia hosting, database, penyimpanan file, dan keamanan juga dapat memproses data sebatas untuk menjalankan layanan.',
    en: 'If you request translation, the selected text is sent to Google Translate. Google may process it under its own privacy terms. If you access Ngopi through Pi Browser or use an available Pi integration, Pi Network and relevant providers may process their own technical or transaction data. Ngopi does not ask for private keys or seed phrases. Hosting, database, file-storage, and security providers may also process data as needed to operate the service.',
  },
  {
    title: '6. Pengungkapan data / When data may be shared',
    id: 'Pesan, profil, dan file dibagikan kepada orang atau anggota Warkop yang Anda pilih. File yang diunggah dapat diakses melalui tautan file; jangan unggah materi yang tidak ingin dibagikan kepada penerima atau siapa pun yang memperoleh tautannya. Kami tidak menjual data pribadi. Data dapat diberikan kepada penyedia teknis yang membantu layanan atau kepada pihak berwenang jika diwajibkan hukum atau diperlukan untuk melindungi pengguna dan layanan.',
    en: 'Messages, profile details, and files are shared with the people or Warkop members you choose. Uploaded files may be accessible through their file links; do not upload material you do not want recipients or someone with the link to access. We do not sell personal data. Data may be shared with technical providers that support the service, or with authorities when legally required or necessary to protect users and the service.',
  },
  {
    title: '7. Penyimpanan dan penghapusan / Retention and deletion',
    id: 'Data disimpan selama diperlukan untuk menyediakan layanan, menjaga keamanan, menyelesaikan sengketa, atau memenuhi kewajiban hukum. Anda dapat meminta akses, koreksi, atau penghapusan melalui NgopiCS di Pusat Bantuan. Setelah permintaan diverifikasi, kami akan menghapus atau menonaktifkan data yang dapat dihapus, kecuali data tertentu masih perlu disimpan berdasarkan hukum atau untuk keamanan. Salinan yang sudah diterima pengguna lain dan cadangan sistem mungkin tidak langsung hilang.',
    en: 'Data is kept as needed to provide the service, maintain security, resolve disputes, or meet legal obligations. You may request access, correction, or deletion through NgopiCS in the Help Center. After verifying a request, we will delete or disable data that can be removed unless certain data must be retained by law or for security. Copies already received by other users and system backups may not disappear immediately.',
  },
  {
    title: '8. Pilihan dan hak Anda / Your choices and rights',
    id: 'Anda dapat memilih informasi profil yang ditampilkan dan mengatur izin kamera/mikrofon dari perangkat. Sesuai hukum yang berlaku, Anda dapat meminta informasi tentang data Anda, memperbaiki data yang tidak tepat, menarik persetujuan untuk pemrosesan berbasis persetujuan, atau meminta penghapusan. Kami mungkin perlu memverifikasi identitas sebelum memenuhi permintaan.',
    en: 'You can choose which profile information to display and manage camera/microphone permissions through your device. Subject to applicable law, you may ask about your data, correct inaccurate information, withdraw consent where processing is based on consent, or request deletion. We may need to verify your identity before fulfilling a request.',
  },
  {
    title: '9. Keamanan dan lokasi pemrosesan / Security and processing locations',
    id: 'Kami menggunakan langkah teknis dan organisasi yang wajar, termasuk penyimpanan hash kata sandi dan perlindungan sesi. Tidak ada sistem yang dapat dijamin selalu aman. Penyedia layanan dapat memproses data di Indonesia atau negara lain tempat infrastruktur mereka berada, dengan perlindungan yang diwajibkan hukum.',
    en: 'We use reasonable technical and organizational measures, including password hashing and session protections. No system can be guaranteed to be completely secure. Service providers may process data in Indonesia or other countries where their infrastructure is located, subject to safeguards required by law.',
  },
  {
    title: '10. Anak-anak, perubahan, dan kontak / Children, changes, and contact',
    id: 'Ngopi tidak ditujukan untuk anak-anak yang belum memenuhi usia minimum menurut hukum yang berlaku. Pengguna di bawah umur harus menggunakan layanan dengan izin orang tua/wali jika diwajibkan hukum. Kebijakan ini dapat diperbarui; versi terbaru dan tanggal berlakunya akan ditampilkan di halaman ini. Untuk pertanyaan atau permintaan privasi, email founder@ngopi.top atau hubungi @ngopi di Ngopi.',
    en: 'Ngopi is not directed to children below the minimum age required by applicable law. Minors must use the service with parent/guardian permission where required by law. We may update this policy; the current version and effective date will appear on this page. For privacy questions or requests, email founder@ngopi.top or contact @ngopi on Ngopi.',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Kembali">
          <Ionicons name="arrow-back" size={24} color={coffee.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Kebijakan Privasi Ngopi</Text>
        <Text style={styles.subtitle}>Ngopi Privacy Policy</Text>
        <Text style={styles.date}>Berlaku sejak / Effective: 3 October 2026</Text>
        <Text style={styles.intro}>Bacalah dokumen ini sebelum menggunakan Ngopi. / Please read this policy before using Ngopi.</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.languageLabel}>Bahasa Indonesia</Text>
            <Text style={styles.paragraph}>{section.id}</Text>
            <Text style={styles.languageLabel}>English</Text>
            <Text style={styles.paragraph}>{section.en}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: coffee.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: coffee.surface },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: coffee.text },
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48, maxWidth: 900, width: '100%', alignSelf: 'center' },
  title: { fontSize: 27, fontWeight: 'bold', color: coffee.accent, marginBottom: 3 },
  subtitle: { fontSize: 19, fontWeight: '600', color: coffee.text, marginBottom: 6 },
  date: { fontSize: 14, color: coffee.secondary, marginBottom: 14 },
  intro: { fontSize: 15, color: coffee.secondary, lineHeight: 23, marginBottom: 10 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: coffee.text, marginBottom: 7 },
  languageLabel: { fontSize: 13, color: coffee.accent, fontWeight: '700', marginTop: 7, marginBottom: 3 },
  paragraph: { fontSize: 15, color: coffee.secondary, lineHeight: 23 },
});
