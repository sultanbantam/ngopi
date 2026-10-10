import { coffee } from '../src/theme/coffee';
import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsOfServiceScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Kembali">
          <Ionicons name="arrow-back" size={24} color={coffee.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Syarat & Ketentuan</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Syarat & Ketentuan Ngopi</Text>
        <Text style={styles.tagline}>"ngobrol paling intim" — https://ngopi.top</Text>
        <Text style={styles.date}>Terakhir diperbarui: 10 Oktober 2026</Text>

        <Text style={styles.sectionTitle}>1. Penerimaan Ketentuan</Text>
        <Text style={styles.paragraph}>
          Dengan mendaftar, mengakses, atau menggunakan aplikasi Ngopi, Anda menyetujui untuk terikat dengan Syarat dan Ketentuan ini. Jika Anda tidak menyetujui ketentuan ini, Anda dipersilakan untuk tidak menggunakan layanan kami.
        </Text>

        <Text style={styles.sectionTitle}>2. Deskripsi Layanan</Text>
        <Text style={styles.paragraph}>
          Ngopi adalah platform komunikasi privat dan warkop virtual yang mengedepankan obrolan tenang, autentik, dan bebas tekanan media sosial. Fitur mencakup pesan terenkripsi ujung-ke-ujung (E2EE), Jukebox Warung, Suara Latar (Ambient), panggilan suara/video sejawat, dan integrasi mikro-transaksi Bamboochain (BMC).
        </Text>

        <Text style={styles.sectionTitle}>3. Tata Krama Warung Kopi & Etika Pengguna</Text>
        <Text style={styles.paragraph}>
          Kami menjunjung tinggi kenyamanan bersama seperti suasana nongkrong di warkop yang ramah dan saling menghargai. Pengguna dilarang keras untuk:{"\n"}
          - Mengirim spam, phishing, penipuan, atau materi yang melanggar hukum.{"\n"}
          - Melakukan pelecehan, ancaman, atau ujaran kebencian kepada pengguna lain.{"\n"}
          - Berupaya merusak infrastruktur, mengeksploitasi bug sistem, atau menyebarkan malware.
        </Text>

        <Text style={styles.sectionTitle}>4. Kepemilikan Konten & Kunci Privat</Text>
        <Text style={styles.paragraph}>
          Anda memegang kendali penuh atas akun dan konten Anda. Karena Ngopi menggunakan enkripsi ujung-ke-ujung, Anda bertanggung jawab menjaga keamanan kunci sandi dan cadangan data perangkat Anda.
        </Text>

        <Text style={styles.sectionTitle}>5. Fitur Warung & Jukebox</Text>
        <Text style={styles.paragraph}>
          Musik dan audio yang diputar melalui Jukebox Warung dan Ambient Sound ditujukan untuk hiburan bersama dalam komunitas warkop secara wajar. Hak cipta lagu tetap milik pencipta/penyedia aslinya.
        </Text>

        <Text style={styles.sectionTitle}>6. Perubahan Ketentuan</Text>
        <Text style={styles.paragraph}>
          Kami dapat memperbarui Syarat dan Ketentuan ini sewaktu-waktu demi meningkatkan kenyamanan dan keamanan pengguna. Pembaruan akan selalu diumumkan secara transparan di aplikasi.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: coffee.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: coffee.surface,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: coffee.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: coffee.accent,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    fontStyle: 'italic',
    color: coffee.muted,
    marginBottom: 6,
  },
  date: {
    fontSize: 13,
    color: coffee.secondary,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: coffee.text,
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    color: coffee.secondary,
    lineHeight: 24,
  },
});
