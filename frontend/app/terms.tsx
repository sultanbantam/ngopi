import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { coffee } from '../src/theme/coffee';

const sections = [
  {
    title: '1. Persetujuan dan kelayakan / Acceptance and eligibility',
    id: 'Dengan membuat akun atau menggunakan Ngopi, Anda menyetujui Ketentuan ini dan Kebijakan Privasi. Jika tidak setuju, hentikan penggunaan layanan. Anda harus memenuhi usia minimum dan ketentuan hukum yang berlaku di tempat Anda. Jika Anda belum dewasa, gunakan layanan dengan izin orang tua/wali jika diwajibkan hukum.',
    en: 'By creating an account or using Ngopi, you agree to these Terms and the Privacy Policy. If you do not agree, stop using the service. You must meet the minimum age and legal requirements where you live. If you are a minor, use the service with parent/guardian permission where required by law.',
  },
  {
    title: '2. Layanan Ngopi / The Ngopi service',
    id: 'Ngopi menyediakan akun berbasis username, chat pribadi, Warkop/komunitas, berbagi gambar, dokumen, pesan suara, panggilan suara/video, profil, penerjemahan, dan pusat bantuan. Fitur dapat berubah, ditangguhkan, atau tidak tersedia karena pemeliharaan, jaringan, keamanan, atau faktor di luar kendali kami. Membuka Ngopi melalui Pi Browser tidak berarti Pi Network mengoperasikan atau menjamin Ngopi.',
    en: 'Ngopi provides username-based accounts, private chats, Warkop/communities, image and document sharing, voice messages, voice/video calls, profiles, translation, and a help center. Features may change, be suspended, or become unavailable due to maintenance, network, security, or factors beyond our control. Accessing Ngopi through Pi Browser does not mean Pi Network operates or endorses Ngopi.',
  },
  {
    title: '3. Akun dan keamanan / Accounts and security',
    id: 'Berikan informasi akun yang benar, jaga kerahasiaan kata sandi, dan segera laporkan penggunaan akun tanpa izin melalui Pusat Bantuan. Anda bertanggung jawab atas aktivitas yang terjadi melalui akun Anda selama tidak disebabkan oleh kesalahan Ngopi. Ngopi tidak meminta kata sandi Pi, private key, atau seed phrase.',
    en: 'Provide accurate account information, keep your password confidential, and promptly report unauthorized account use through the Help Center. You are responsible for activity through your account unless caused by Ngopi’s fault. Ngopi will never ask for your Pi password, private key, or seed phrase.',
  },
  {
    title: '4. Konten pengguna / User content',
    id: 'Anda tetap memiliki hak atas konten yang Anda buat. Anda memberi Ngopi izin terbatas, non-eksklusif, dan selama diperlukan untuk menyimpan, memproses, menyalin, serta mengirim konten hanya untuk menyediakan, menjaga, dan mengamankan layanan. Izin ini berakhir ketika konten dihapus atau tidak lagi diperlukan, kecuali salinan tertentu harus dipertahankan menurut hukum atau untuk keamanan. Anda bertanggung jawab memastikan Anda memiliki hak dan izin untuk mengirim konten.',
    en: 'You retain your rights in the content you create. You grant Ngopi a limited, non-exclusive license, for as long as necessary, to store, process, copy, and transmit content solely to provide, maintain, and secure the service. This license ends when content is deleted or no longer needed, except for copies that must be retained by law or for security. You are responsible for having the rights and permissions needed to share content.',
  },
  {
    title: '5. Perilaku yang dilarang / Prohibited conduct',
    id: 'Anda tidak boleh menggunakan Ngopi untuk melanggar hukum; mengancam, melecehkan, menipu, menguntit, atau menyamar sebagai orang lain; menyebarkan spam, malware, atau tautan berbahaya; melanggar privasi, hak cipta, atau hak orang lain; mengeksploitasi anak atau menyebarkan konten seksual anak; mengganggu layanan, mencoba mengakses akun/sistem tanpa izin, atau menghindari pembatasan keamanan. Anda juga tidak boleh membagikan konten yang dilarang hukum.',
    en: 'You may not use Ngopi to break the law; threaten, harass, defraud, stalk, or impersonate anyone; distribute spam, malware, or harmful links; violate privacy, copyright, or other rights; exploit children or share child sexual abuse material; disrupt the service, attempt unauthorized access to accounts/systems, or bypass security restrictions. You may not share content prohibited by law.',
  },
  {
    title: '6. Komunitas dan laporan / Communities and reports',
    id: 'Pesan atau file yang Anda kirim ke Warkop dapat dilihat oleh anggota yang memiliki akses ke Warkop tersebut. Hormati aturan dan privasi anggota. Laporkan konten atau akun bermasalah melalui Pusat Bantuan. Kami dapat meninjau laporan dan mengambil tindakan yang wajar, termasuk menghapus konten atau membatasi akun, dengan mempertimbangkan keselamatan, bukti, dan hukum yang berlaku.',
    en: 'Messages or files you post in a Warkop may be seen by members who have access to that space. Respect community rules and members’ privacy. Report problematic content or accounts through the Help Center. We may review reports and take reasonable action, including removing content or restricting accounts, taking safety, evidence, and applicable law into account.',
  },
  {
    title: '7. Panggilan dan layanan pihak ketiga / Calls and third-party services',
    id: 'Anda bertanggung jawab meminta izin sebelum merekam, menyimpan, atau membagikan percakapan peserta lain. Ngopi tidak menyediakan fitur perekaman panggilan dan tidak menjamin kualitas panggilan di semua jaringan/perangkat. Penerjemahan dapat mengirim teks pilihan Anda ke Google Translate. Browser, Pi Network, jaringan, dan penyedia layanan lain tunduk pada ketentuan serta kebijakan masing-masing.',
    en: 'You are responsible for obtaining participants’ permission before recording, saving, or sharing a conversation. Ngopi does not provide a call-recording feature and cannot guarantee call quality on every network/device. Translation may send text you select to Google Translate. Browsers, Pi Network, networks, and other providers are governed by their own terms and policies.',
  },
  {
    title: '8. Akses, penangguhan, dan penghapusan akun / Access, suspension, and account deletion',
    id: 'Anda dapat berhenti menggunakan Ngopi kapan saja dan meminta penghapusan akun melalui NgopiCS di Pusat Bantuan. Kami dapat membatasi atau menangguhkan akses jika diperlukan untuk melindungi pengguna/layanan, menyelidiki dugaan pelanggaran, memenuhi hukum, atau jika Anda melanggar Ketentuan ini. Jika memungkinkan, kami akan memberi tahu alasan dan langkah untuk mengajukan keberatan. Penghapusan tidak selalu menghapus salinan yang sudah diterima pengguna lain atau yang wajib disimpan.',
    en: 'You may stop using Ngopi at any time and request account deletion through NgopiCS in the Help Center. We may restrict or suspend access when needed to protect users/the service, investigate suspected violations, comply with law, or address a breach of these Terms. Where practical, we will explain the reason and how to appeal. Deletion may not remove copies already received by other users or data that must be retained.',
  },
  {
    title: '9. Penafian dan tanggung jawab / Disclaimers and liability',
    id: 'Ngopi disediakan sebagaimana tersedia. Kami berupaya menjaga layanan berjalan dan aman, tetapi tidak menjamin bebas gangguan, selalu tersedia, atau sesuai semua kebutuhan. Sejauh diizinkan hukum, Ngopi tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari penggunaan layanan, tindakan pengguna lain, gangguan jaringan, atau layanan pihak ketiga. Ketentuan ini tidak menghapus hak konsumen atau tanggung jawab yang tidak dapat dikesampingkan menurut hukum.',
    en: 'Ngopi is provided as available. We work to keep the service running and secure, but do not guarantee uninterrupted availability or suitability for every purpose. To the extent permitted by law, Ngopi is not liable for indirect losses arising from use of the service, other users’ conduct, network outages, or third-party services. Nothing in these Terms removes consumer rights or liability that cannot be excluded by law.',
  },
  {
    title: '10. Perubahan, hukum, dan kontak / Changes, governing law, and contact',
    id: 'Kami dapat memperbarui Ketentuan ini dengan mencantumkan versi terbaru dan tanggal berlaku di halaman ini. Untuk perubahan penting, kami akan memberi pemberitahuan yang wajar melalui layanan jika memungkinkan. Ketentuan ini ditafsirkan berdasarkan hukum Republik Indonesia, tanpa mengurangi hak wajib yang berlaku bagi konsumen. Ngopi dikelola oleh Yayasan Sabumi Nusantara Jaya. Untuk pertanyaan, laporan, atau permintaan terkait akun, email founder@ngopi.top atau hubungi @ngopi di Ngopi.',
    en: 'We may update these Terms by posting the current version and effective date on this page. For material changes, we will provide reasonable notice through the service where practical. These Terms are governed by the laws of the Republic of Indonesia, without limiting mandatory consumer rights. Ngopi is operated by Yayasan Sabumi Nusantara Jaya. For questions, reports, or account requests, email founder@ngopi.top or contact @ngopi on Ngopi.',
  },
];

export default function TermsOfServiceScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Kembali">
          <Ionicons name="arrow-back" size={24} color={coffee.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Ketentuan Layanan Ngopi</Text>
        <Text style={styles.subtitle}>Ngopi Terms of Service</Text>
        <Text style={styles.date}>Berlaku sejak / Effective: 3 October 2026</Text>
        <Text style={styles.intro}>Dengan memakai Ngopi, Anda menyetujui ketentuan ini. / By using Ngopi, you agree to these Terms.</Text>
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
