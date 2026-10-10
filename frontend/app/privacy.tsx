import { coffee } from '../src/theme/coffee';
import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Kembali">
          <Ionicons name="arrow-back" size={24} color={coffee.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kebijakan Privasi</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Kebijakan Privasi Ngopi</Text>
        <Text style={styles.tagline}>"ngobrol paling intim" — https://ngopi.top</Text>
        <Text style={styles.date}>Terakhir diperbarui: 10 Oktober 2026</Text>

        <Text style={styles.sectionTitle}>1. Komitmen Privasi Kami</Text>
        <Text style={styles.paragraph}>
          Ngopi dirancang sebagai ruang komunikasi privat, tenang, dan bermakna untuk semua generasi (Gen Z, Gen Alpha, hingga para penikmat obrolan santai warkop). Privasi dan ketenangan Anda adalah prioritas mutlak kami.
        </Text>

        <Text style={styles.sectionTitle}>2. Enkripsi Ujung-ke-Ujung (End-to-End Encryption / E2EE)</Text>
        <Text style={styles.paragraph}>
          - Seluruh pesan pribadi, catatan suara, dan berkas dienkripsi menggunakan standar kriptografi modern (X25519 TweetNaCl dan AES-256-GCM).{"\n"}
          - Kunci enkripsi privat Anda hanya disimpan di perangkat Anda sendiri. Pihak server maupun pihak ketiga mana pun tidak dapat membaca isi pesan Anda.
        </Text>

        <Text style={styles.sectionTitle}>3. Tanpa Nomor Telepon</Text>
        <Text style={styles.paragraph}>
          Ngopi tidak pernah meminta nomor telepon pribadi Anda. Pendaftaran dilakukan secara mandiri dengan username privat atau akun terdesentralisasi Bamboochain, sehingga identitas dunia nyata Anda tetap aman dan terlindungi dari spam maupun pelacakan komersial.
        </Text>

        <Text style={styles.sectionTitle}>4. Tidak Ada Penjualan Data atau Iklan</Text>
        <Text style={styles.paragraph}>
          Kami tidak pernah menjual, menyewakan, atau memonetisasi data pribadi, riwayat percakapan, atau kontak Anda kepada pihak mana pun. Tidak ada pelacak iklan pihak ketiga di dalam aplikasi Ngopi.
        </Text>

        <Text style={styles.sectionTitle}>5. Penyimpanan Data & Warung Kopi</Text>
        <Text style={styles.paragraph}>
          - Data interaksi publik di Warung Kopi (seperti lagu di Jukebox Warung, buku tamu, dan reaksi emoji) disimpan untuk memfasilitasi interaksi komunitas yang hangat.{"\n"}
          - Anda memiliki kendali penuh atas akun Anda dan dapat menghapus akun beserta data riwayat kapan saja melalui menu pengaturan profil.
        </Text>

        <Text style={styles.sectionTitle}>6. Keamanan & Kepatuhan</Text>
        <Text style={styles.paragraph}>
          Seluruh komunikasi jaringan diproteksi melalui protokol terenkripsi HTTPS dan WSS (Secure WebSockets). Jika Anda memiliki pertanyaan mengenai privasi, Anda dapat menghubungi tim kami melalui Warkop NgopiCS.
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
