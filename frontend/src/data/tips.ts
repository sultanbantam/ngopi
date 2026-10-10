export interface FeatureTip {
  title: string;
  category: 'account' | 'privacy' | 'terms' | 'features' | 'security';
  content: string;
}

export const FEATURE_TIPS: FeatureTip[] = [
  {
    title: 'Pengaturan Akun & Profil',
    category: 'account',
    content: 'Ingin mengubah nama tampilan atau avatar? Buka menu Kontak lalu tekan ikon Pengaturan (Gear ⚙️) di pojok kanan atas. Kamu bisa memperbarui foto profil, status kehadiran, dan bio warkopmu kapan saja.',
  },
  {
    title: 'Keamanan Privasi End-to-End Encryption (E2EE)',
    category: 'privacy',
    content: 'Semua pesan obrolan dan panggilan di Ngopi dilindungi Signal Protocol dengan enkripsi ujung-ke-ujung (E2EE). Tidak ada pihak ketiga—bahkan server Ngopi sekalipun—yang bisa mengintip obrolan atau mendengarkan panggilanmu.',
  },
  {
    title: 'Syarat & Ketentuan Komunitas Warkop',
    category: 'terms',
    content: 'Warung Kopi adalah ruang publik yang ramah untuk semua generasi. Harap menjaga kesantunan, dilarang menyebarkan hoaks, ujaran kebencian, spam, atau konten yang melanggar hukum demi kenyamanan bersama.',
  },
  {
    title: 'Fitur Suasana Warung Kopi',
    category: 'features',
    content: 'Kamu bisa memutar suara latar alami (Suasana Warkop) seperti Hujan Rintik, Ramai Cafe, Ombak Pantai, Hutan Malam, hingga Api Unggun untuk menemani waktu santaimu mengobrol.',
  },
  {
    title: 'Jukebox Warung & Pencarian Lagu',
    category: 'features',
    content: 'Gunakan Jukebox untuk memutar musik pilihan warkop atau mencari lagu favoritmu! Kamu bisa langsung memutarnya dengan tombol "▶ Putar" atau menambahkannya ke antrian dengan "+ Antrian".',
  },
  {
    title: 'Verifikasi Kunci Enkripsi (Safety Numbers)',
    category: 'security',
    content: 'Pastikan keamanan komunikasi privatmu dengan memverifikasi Kode Keamanan (Safety Numbers) di info kontak rekan bicaramu untuk memastikan tidak ada penyadapan di tengah jalan.',
  },
  {
    title: 'Alih Bahasa Real-time',
    category: 'features',
    content: 'Butuh berkomunikasi lintas bahasa? Gunakan fitur Alih Bahasa untuk menerjemahkan percakapan suara atau panggilan secara real-time dengan akurasi tinggi.',
  },
  {
    title: 'Game Tebak-tebakan Warkop',
    category: 'features',
    content: 'Ikuti game tebak-tebakan lucu dari WarkopBot di chatroom! Setiap jawaban benar yang kamu kirimkan akan memberimu 10 Poin Kopi yang tercatat di akunmu.',
  },
  {
    title: 'Pesan Suara (Voice Note)',
    category: 'features',
    content: 'Kirim pesan suara instan dengan menekan tombol mikrofon 🎙️ di kolom pesan. Lepaskan atau tekan centang untuk mengirim ke teman warkop.',
  },
  {
    title: 'Mention Rekan Ngopi',
    category: 'features',
    content: 'Panggil teman di Warung Kopi dengan mengetik simbol "@" diikuti nama pengguna mereka agar mereka mendapat notifikasi obrolan.',
  },
  {
    title: 'Mode Privasi Layar & Penghapusan Pesan',
    category: 'privacy',
    content: 'Kamu memegang kendali penuh atas privasimu! Riwayat obrolan privat dapat dibersihkan kapan saja dari kedua sisi perangkat.',
  },
  {
    title: 'Daftar Kontak & Undangan Teman',
    category: 'account',
    content: 'Tambahkan teman baru lewat username mereka di halaman Kontak, atau bagikan ID Ngopi-mu agar teman-temanmu bisa langsung terhubung.',
  },
  {
    title: 'Perlindungan Metadata',
    category: 'privacy',
    content: 'Ngopi meminimalkan penyimpanan data server. Pesan yang telah terkirim disimpan dalam bentuk terenkripsi di perangkat lokalmu menggunakan Secure Storage.',
  },
  {
    title: 'Pusat Bantuan & Layanan Komunitas',
    category: 'terms',
    content: 'Jika kamu mengalami kendala teknis atau memiliki saran pengembangan, kunjungi menu Pusat Bantuan di laci menu samping atau hubungi tim NgopiCS.',
  },
  {
    title: 'Suara Panggilan Jernih WebRTC',
    category: 'features',
    content: 'Panggilan suara dan video di Ngopi ditenagai teknologi WebRTC peer-to-peer terenkripsi, menghasilkan latensi sangat rendah dan kualitas audio jernih.',
  },
  {
    title: 'Poin Kopi & Hadiah Komunitas',
    category: 'features',
    content: 'Kumpulkan Poin Kopi sebanyak-banyaknya dari tebak-tebakan warkop dan keaktifan nongkrong di room publik. Poinmu akan terpampang di papan profil tokomu!',
  },
];
