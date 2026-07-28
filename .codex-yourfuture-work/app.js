const cloneData = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

function getBackendConfig() {
  const baseUrl = String(window.BMC_API_URL || localStorage.getItem("bmc-api-url") || "").trim().replace(/\/+$/, "");
  const apiKey = String(window.BMC_API_KEY || localStorage.getItem("bmc-api-key") || "").trim();
  return { baseUrl, apiKey };
}

function hasBackendConfig() {
  return Boolean(getBackendConfig().baseUrl);
}

const ADMIN_SESSION_KEY = "bmc-admin-key";

function getAdminKey() {
  try {
    return String(sessionStorage.getItem(ADMIN_SESSION_KEY) || "").trim();
  } catch {
    return "";
  }
}

function hasAdminIntent() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.toLowerCase();
  return params.has("admin") || hash === "#admin" || hash.startsWith("#admin-") || Boolean(getAdminKey());
}

function isKnowledgeAdmin() {
  return Boolean(getAdminKey());
}

async function requestBackend(path, payload, options = {}) {
  const { baseUrl, apiKey } = getBackendConfig();
  if (!baseUrl) throw new Error(t("apiUrlMissing"));

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-app-key"] = apiKey;
  if (options.admin) {
    const adminKey = getAdminKey();
    if (!adminKey) throw new Error(t("adminKeyMissing"));
    headers["x-admin-key"] = adminKey;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Backend error ${response.status}`);
  }

  return data;
}

async function generateBmcViaBackend(idea) {
  const data = await requestBackend("/api/bmc/generate", { idea, language: state.language });
  return normalizeRemoteBmc(data, idea);
}

async function answerQuestionWithBackend(question) {
  if (!hasBackendConfig()) return answerQuestion(question);
  const data = await requestBackend("/api/bmc/chat", {
    idea: state.idea,
    bmc: state.bmc,
    risks: state.risks,
    question,
    language: state.language
  });
  return String(data.answer || answerQuestion(question)).trim();
}

function normalizeRemoteBmc(data, idea) {
  const sector = detectSector(idea);
  const fallbackBmc = buildBmc(idea, sector);
  const fallbackRisks = buildRisks(idea, sector);
  const bmc = {};

  blocks.forEach((block) => {
    const items = data?.bmc?.[block.key];
    bmc[block.key] = Array.isArray(items) && items.length ? items : fallbackBmc[block.key];
  });

  return {
    title: String(data?.title || summarizeIdea(idea)).trim(),
    source: data?.source || "backend",
    bmc,
    risks: Array.isArray(data?.risks) && data.risks.length ? data.risks : fallbackRisks
  };
}

const blocks = [
  { key: "customerSegments", title: "Customer Segments", tone: "teal" },
  { key: "valuePropositions", title: "Value Propositions", tone: "coral" },
  { key: "channels", title: "Channels", tone: "amber" },
  { key: "customerRelationships", title: "Customer Relationships", tone: "green" },
  { key: "revenueStreams", title: "Revenue Streams", tone: "blue" },
  { key: "keyActivities", title: "Key Activities", tone: "teal" },
  { key: "keyResources", title: "Key Resources", tone: "coral" },
  { key: "keyPartnerships", title: "Key Partnerships", tone: "amber" },
  { key: "costStructure", title: "Cost Structure", tone: "green" }
];

const blockSynonyms = {
  customerSegments: ["customer", "pelanggan", "segmen", "target", "pasar", "user"],
  valuePropositions: ["value", "nilai", "proposisi", "solusi", "masalah", "pain"],
  channels: ["channel", "kanal", "saluran", "marketing", "distribusi", "akuisisi"],
  customerRelationships: ["relationship", "relasi", "loyal", "retensi", "komunitas", "crm"],
  revenueStreams: ["revenue", "pendapatan", "harga", "pricing", "uang", "bayar", "monetisasi"],
  keyActivities: ["aktivitas", "activity", "operasi", "produksi", "proses"],
  keyResources: ["resource", "sumber daya", "aset", "tim", "teknologi"],
  keyPartnerships: ["partner", "mitra", "partnership", "vendor", "supplier"],
  costStructure: ["cost", "biaya", "modal", "pengeluaran", "budget"]
};

const sectorRules = [
  {
    name: "tourism",
    match: ["wisata", "eko wisata", "ekowisata", "desa wisata", "travel", "tour", "homestay", "alam", "budaya", "kasepuhan", "cibarani", "lebak", "baduy"],
    label: "eko wisata/desa wisata",
    customer: [
      "wisatawan keluarga dan komunitas dari kota besar yang mencari pengalaman alam-budaya 1-2 hari",
      "sekolah, kampus, dan komunitas pecinta alam yang butuh paket edukasi konservasi dan budaya",
      "perusahaan atau instansi untuk outing, CSR, dan team building berbasis desa",
      "traveler niche yang tertarik budaya lokal, pertanian, dan pariwisata berkelanjutan"
    ],
    value: [
      "pengalaman eko wisata berbasis kearifan lokal: alam, pertanian, tradisi, kuliner, dan cerita warga",
      "paket siap jalan dengan itinerary, guide lokal, aturan kunjungan, keamanan, dan estimasi biaya jelas",
      "dampak ekonomi langsung untuk warga melalui guide, homestay, kuliner, kerajinan, dan konservasi",
      "konten edukatif yang membantu pengunjung memahami etika berkunjung dan pelestarian lingkungan"
    ],
    channel: [
      "Instagram, TikTok, dan Google Business Profile dengan foto rute, aktivitas, harga paket, dan testimoni",
      "kemitraan komunitas hiking, kampus, sekolah, travel organizer, dan kantor di kota sekitar",
      "landing page sederhana dengan WhatsApp booking, kalender trip, dan FAQ akses lokasi",
      "artikel SEO seperti paket eko wisata Lebak, wisata budaya Banten, dan itinerary desa wisata"
    ],
    revenue: [
      "paket one-day trip per orang termasuk guide, makan lokal, dan aktivitas utama",
      "paket overnight dengan homestay, makan, guide, dan aktivitas budaya/alam",
      "paket edukasi sekolah/kampus dan corporate outing dengan harga grup",
      "komisi penjualan produk lokal, kuliner, dokumentasi foto/video, dan transport tambahan"
    ],
    activity: [
      "mapping aset wisata, rute aman, aturan adat, kapasitas kunjungan, dan SOP keselamatan",
      "melatih guide lokal untuk storytelling, hospitality, first aid dasar, dan manajemen rombongan",
      "membuat itinerary, harga paket, kalender trip, materi promosi, dan sistem booking WhatsApp",
      "mengumpulkan feedback, testimoni, foto, dan data biaya per trip untuk memperbaiki paket"
    ],
    resource: [
      "guide lokal, tokoh adat/warga, rute alam, cerita budaya, homestay, dan titik aktivitas",
      "SOP kunjungan, aturan adat, standar keselamatan, daftar harga, dan template itinerary",
      "aset konten foto/video, landing page, WhatsApp Business, Google Maps, dan database calon tamu",
      "modal kerja untuk pelatihan, perlengkapan keselamatan, signage, kebersihan, dan promosi awal"
    ],
    partner: [
      "pemerintah desa, tokoh adat, kelompok sadar wisata, karang taruna, dan pemilik homestay",
      "komunitas traveler, sekolah/kampus, kantor, travel organizer, dan creator lokal",
      "penyedia transport, asuransi/perlengkapan outdoor, UMKM kuliner, dan pengrajin lokal",
      "dinas pariwisata, NGO konservasi, inkubator UMKM, dan media lokal"
    ],
    cost: [
      "honor guide, konsumsi, homestay, transport lokal, kebersihan, dan kontribusi warga/adat per trip",
      "biaya promosi konten, iklan kecil, website/landing page, foto/video, dan admin booking",
      "pelatihan guide, perlengkapan keselamatan, signage rute, dokumentasi SOP, dan perizinan",
      "cadangan risiko cuaca, refund, perawatan fasilitas, dan peningkatan kualitas pengalaman"
    ]
  },
  {
    name: "fnb",
    match: ["kopi", "cafe", "kafe", "restoran", "makanan", "minuman", "f&b", "kuliner", "menu"],
    label: "F&B",
    customer: ["pekerja urban yang butuh pilihan praktis", "komunitas lokal di radius 3-5 km", "pelanggan repeat yang mencari kualitas konsisten"],
    value: ["rasa dan kualitas yang stabil", "pengalaman beli yang cepat dan nyaman", "menu yang mudah disesuaikan dengan preferensi pelanggan"],
    channel: ["Google Maps dan review lokal", "Instagram/TikTok untuk menu visual", "kemitraan delivery dan komunitas kantor"],
    revenue: ["penjualan produk satuan", "paket langganan mingguan", "bundle corporate atau event kecil"],
    activity: ["pengadaan bahan baku", "standardisasi resep dan SOP", "kampanye konten menu harian"],
    resource: ["dapur atau bar produksi", "supplier bahan baku", "brand visual dan sistem pemesanan"],
    partner: ["supplier lokal", "platform delivery", "komunitas kantor atau coworking"],
    cost: ["bahan baku", "sewa dan utilitas", "tenaga kerja dan packaging"]
  },
  {
    name: "education",
    match: ["kursus", "belajar", "edukasi", "sekolah", "kelas", "pelatihan", "training", "mentor"],
    label: "edtech",
    customer: ["pemula yang ingin skill praktis", "pemilik UMKM yang butuh hasil cepat", "komunitas profesional yang ingin naik kelas"],
    value: ["materi ringkas dan langsung dipraktikkan", "mentor atau AI tutor untuk feedback", "template kerja yang mempercepat implementasi"],
    channel: ["webinar gratis", "LinkedIn dan komunitas WhatsApp", "referral alumni"],
    revenue: ["kelas satuan", "langganan konten premium", "program cohort berbayar"],
    activity: ["kurasi kurikulum", "produksi materi", "mentoring dan evaluasi progres"],
    resource: ["expert/mentor", "platform pembelajaran", "library template dan contoh kasus"],
    partner: ["komunitas UMKM", "kampus atau inkubator", "tools SaaS pendukung"],
    cost: ["honor mentor", "produksi konten", "platform dan akuisisi peserta"]
  },
  {
    name: "agri",
    match: ["pertanian", "petani", "sayur", "buah", "panen", "agribisnis", "agritech", "beras"],
    label: "agritech",
    customer: ["petani kecil dan koperasi", "restoran dan katering", "pembeli rumah tangga yang peduli asal produk"],
    value: ["akses pasar yang lebih jelas", "pasokan lebih segar dan terlacak", "harga lebih transparan untuk kedua sisi"],
    channel: ["kemitraan koperasi", "sales B2B ke restoran", "marketplace dan grup komunitas lokal"],
    revenue: ["margin transaksi", "biaya langganan pembeli B2B", "layanan logistik atau quality control"],
    activity: ["verifikasi pasokan", "manajemen order dan pengiriman", "quality control panen"],
    resource: ["jaringan petani", "data inventori panen", "operasi logistik"],
    partner: ["koperasi tani", "cold chain/logistik", "restoran anchor customer"],
    cost: ["logistik", "quality control", "operasional lapangan dan teknologi"]
  },
  {
    name: "health",
    match: ["sehat", "kesehatan", "klinik", "dokter", "wellness", "nutrisi", "mental"],
    label: "health/wellness",
    customer: ["profesional sibuk yang ingin hidup lebih sehat", "keluarga muda", "komunitas dengan kebutuhan kesehatan spesifik"],
    value: ["rekomendasi personal yang mudah dijalankan", "akses layanan lebih praktis", "monitoring progres yang membuat pengguna konsisten"],
    channel: ["konten edukasi", "kemitraan klinik/komunitas", "referral pengguna"],
    revenue: ["langganan program", "paket konsultasi", "komisi produk atau layanan pendukung"],
    activity: ["assessment pengguna", "kurasi rekomendasi", "follow-up berkala"],
    resource: ["tenaga ahli", "data kesehatan pengguna", "sistem booking dan reminder"],
    partner: ["dokter/nutrisionis", "klinik", "brand produk kesehatan"],
    cost: ["honor profesional", "compliance dan keamanan data", "akuisisi pengguna"]
  },
  {
    name: "tech",
    match: ["aplikasi", "platform", "saas", "ai", "software", "marketplace", "digital", "otomatis"],
    label: "digital/SaaS",
    customer: ["pengguna early adopter", "tim kecil yang butuh otomasi", "pemilik bisnis yang ingin efisiensi"],
    value: ["otomasi pekerjaan manual", "insight yang lebih cepat dari data", "workflow yang mudah diulang dan diukur"],
    channel: ["landing page SEO", "konten edukasi dan demo", "partnership komunitas dan referral"],
    revenue: ["langganan bulanan", "paket output satu kali", "layanan premium atau konsultasi"],
    activity: ["pengembangan produk", "customer support", "eksperimen akuisisi dan onboarding"],
    resource: ["tim produk dan engineering", "model AI/API", "database pengguna dan knowledge base"],
    partner: ["provider AI", "payment gateway", "komunitas bisnis atau inkubator"],
    cost: ["hosting dan API", "pengembangan produk", "marketing dan support"]
  }
];

const defaultBmc = {
  customerSegments: [
    "Aspiring entrepreneur dan pemilik bisnis tahap awal yang punya ide tetapi belum punya struktur model bisnis.",
    "UMKM yang ingin menyusun strategi sebelum meluncurkan produk baru.",
    "Mentor, inkubator, dan konsultan yang perlu mempercepat sesi validasi bisnis."
  ],
  valuePropositions: [
    "Mengubah ide mentah menjadi Business Model Canvas lengkap dalam beberapa menit.",
    "Memberi poin spesifik dan actionable untuk setiap blok BMC.",
    "Menandai asumsi paling berisiko dan menyarankan eksperimen validasi."
  ],
  channels: [
    "Landing page dengan chatbot sebagai pengalaman utama.",
    "Konten edukasi BMC di Instagram, LinkedIn, X, TikTok, dan Facebook.",
    "Referral dari komunitas startup, UMKM, kampus, dan inkubator."
  ],
  customerRelationships: [
    "Self-service AI chat untuk eksplorasi awal.",
    "Guided refinement per blok BMC agar pengguna merasa didampingi.",
    "Konsultasi premium untuk pengguna yang butuh review mendalam."
  ],
  revenueStreams: [
    "Langganan Rp50.000/bulan untuk BMC generation dan basic AI chat.",
    "Pembelian output BMC satu kali Rp30.000 di Indonesia atau $5-10 global.",
    "Konsultasi premium Rp500.000-1.000.000/jam."
  ],
  keyActivities: [
    "Mengelola prompt, knowledge base, dan evaluasi kualitas output BMC.",
    "Mengembangkan chatbot, export, upload dokumen, dan voice input.",
    "Membuat dan menjadwalkan konten sosial media untuk akuisisi."
  ],
  keyResources: [
    "Model AI dan pipeline RAG berisi referensi BMC terkurasi.",
    "Database pengguna, subscription, dan BMC tersimpan.",
    "Tim produk, founder/mentor, dan sistem analitik pertumbuhan."
  ],
  keyPartnerships: [
    "OpenAI/Claude API dan vector database seperti pgvector atau Pinecone.",
    "Supabase, Midtrans/Stripe, dan Vercel untuk infrastruktur produk.",
    "Komunitas UMKM, inkubator, kampus, dan MCP social publishing provider."
  ],
  costStructure: [
    "Biaya LLM/API, hosting, storage, dan vector database.",
    "Akuisisi pelanggan melalui konten, iklan, dan partnership.",
    "Operasional support, riset knowledge base, dan konsultasi expert."
  ]
};

const defaultRisks = [
  {
    title: "Pengguna mau membayar untuk BMC otomatis",
    why: "Harga Rp50.000/bulan harus terbukti lebih bernilai dibanding template gratis atau konsultasi manual.",
    test: "Jalankan landing page waitlist dengan dua paket harga dan ukur conversion dari 200 visitor pertama."
  },
  {
    title: "Output AI cukup dipercaya untuk keputusan bisnis",
    why: "Jika isi terlalu generik, pengguna tidak akan repeat atau merekomendasikan produk.",
    test: "Bandingkan rating output AI vs review mentor untuk 20 ide bisnis nyata."
  },
  {
    title: "Konten sosial membawa traffic yang relevan",
    why: "Social agent harus menghasilkan followers yang memang ingin membuat BMC, bukan sekadar engagement vanity.",
    test: "Publikasikan 30 post edukasi BMC dan ukur klik, signup, serta BMC generated per kanal."
  }
];

const topicsByLanguage = {
  id: [
    "Cara membuat BMC untuk bisnis F&B",
    "9 blok BMC yang wajib dipahami",
    "Kesalahan umum saat bikin BMC",
    "Contoh BMC bisnis kafe sukses",
    "Revenue streams yang cocok untuk UMKM",
    "Dari ide ke BMC dalam 5 menit"
  ],
  en: [
    "How to build a BMC for an F&B business",
    "The 9 BMC blocks every founder should know",
    "Common mistakes when creating a BMC",
    "Example BMC for a successful coffee shop",
    "Revenue streams that fit small businesses",
    "From business idea to BMC in 5 minutes"
  ]
};

const topics = topicsByLanguage.id;
const platforms = ["Instagram", "LinkedIn", "X", "TikTok", "Facebook"];

const translations = {
  id: {
    navKnowledge: "Knowledge",
    navPricing: "Harga",
    navFaq: "FAQ",
    start: "Mulai",
    heroEyebrow: "Untuk founder, UMKM, dan ide bisnis tahap awal",
    heroCopy: "Ubah ide bisnis menjadi Business Model Canvas lengkap dalam beberapa menit, lalu refine dengan chatbot dan siapkan konten sosial media untuk menarik calon pelanggan.",
    heroIdeaLabel: "Tulis ide bisnis",
    heroPlaceholder: "Contoh: kedai kopi langganan untuk pekerja hybrid di Jakarta",
    heroButton: "Buat BMC",
    metricBlocks: "blok BMC",
    metricRisks: "risiko utama",
    metricPlatforms: "platform sosial",
    workspaceTitle: "Landing Page dengan BMC AI Chatbot",
    workspaceCopy: "Masukkan ide, rekam suara, atau unggah dokumen. Aplikasi ini menghasilkan BMC terstruktur, asumsi risiko, dan bahan diskusi lanjutan.",
    inputKicker: "Input ide",
    inputTitle: "Jelaskan bisnis Anda",
    ideaLabel: "Ide bisnis",
    ideaPlaceholder: "Tuliskan target pelanggan, produk, harga, lokasi, masalah yang ingin diselesaikan, atau bahan mentah apa pun yang Anda punya.",
    generateButton: "Buat BMC",
    voiceButton: "Suara",
    uploadButton: "Upload",
    canvasKicker: "AI generated BMC",
    canvasTitle: "Business Model Canvas",
    tabCanvas: "Canvas",
    tabRisk: "Risiko",
    tabChat: "Chat",
    riskKicker: "Assumption radar",
    riskTitle: "Asumsi paling berisiko",
    riskCopy: "AI menandai bagian yang perlu diuji sebelum Anda menghabiskan terlalu banyak biaya.",
    chatLabel: "Tanya AI",
    chatPlaceholder: "Tanya: revenue stream saya apa yang paling kuat?",
    chatSubmit: "Kirim",
    workflowTitle: "Dari ide mentah ke BMC yang bisa diuji",
    step1Title: "Masukkan konteks",
    step1Copy: "Teks, suara, atau dokumen menjadi bahan awal untuk memahami masalah, pelanggan, dan penawaran.",
    step2Title: "Generate 9 blok",
    step2Copy: "Agent menyusun customer segments, value proposition, channel, revenue, hingga cost structure.",
    step3Title: "Uji asumsi",
    step3Copy: "Risiko paling mahal diprioritaskan, lalu AI menyarankan eksperimen sederhana untuk validasi.",
    socialCopy: "Buat draft konten BMC dan entrepreneurship untuk Instagram, LinkedIn, X, TikTok, dan Facebook. Cocok sebagai lapisan awal sebelum integrasi MCP publishing.",
    socialTopicLabel: "Topik konten",
    socialTopicPlaceholder: "Contoh: kesalahan umum saat membuat BMC",
    socialPlatformLabel: "Platform",
    socialButton: "Buat 5 Post",
    featureEyebrow: "Fitur produk",
    featureTitle: "Dirancang untuk founder yang butuh arah cepat",
    feature1Title: "Voice input",
    feature1Copy: "Gunakan Web Speech API untuk menangkap ide saat pengguna belum siap menulis panjang.",
    feature2Title: "Document intake",
    feature2Copy: "Unggah brief, catatan, atau deck awal sebagai konteks ide bisnis yang ingin diubah menjadi BMC.",
    feature3Title: "Risk analysis",
    feature3Copy: "Agent membantu memisahkan ide yang menarik dari asumsi yang belum terbukti.",
    feature4Title: "Export ready",
    feature4Copy: "Output BMC bisa diunduh sebagai Markdown, HTML, atau dicetak menjadi PDF dari browser.",
    pricingEyebrow: "Monetisasi",
    pricingTitle: "Paket yang mengikuti brief",
    price1Copy: "BMC generation, basic AI chat, simpan kanvas, export.",
    price1Cta: "Coba sekarang",
    price2Copy: "Pembelian satu kali untuk hasil BMC Indonesia atau $5-10 global.",
    price3Copy: "Konsultasi langsung dengan founder untuk validasi dan strategi go-to-market.",
    testimonialEyebrow: "Validasi pasar",
    testimonialTitle: "Untuk pengguna yang ingin mulai dengan jelas",
    testimonial1Quote: "Saya bisa melihat pelanggan, channel, dan biaya utama dalam satu layar sebelum mulai produksi.",
    testimonial1Name: "Rani, founder F&B rumahan",
    testimonial2Quote: "Bagian risiko membantu tim kami tahu eksperimen apa yang harus diuji minggu ini.",
    testimonial2Name: "Bagas, mentor inkubator",
    testimonial3Quote: "Konten sosialnya membuat edukasi BMC jadi konsisten tanpa mulai dari halaman kosong.",
    testimonial3Name: "Nadia, konsultan UMKM",
    faqTitle: "Pertanyaan umum",
    faq1Question: "Apakah ini sudah memakai API OpenAI atau Claude?",
    faq1Answer: "Frontend tetap punya fallback offline, dan backend Express sudah tersedia untuk memakai OpenAI API jika config.js diarahkan ke domain API Contabo.",
    faq2Question: "Apakah social agent langsung publish?",
    faq2Answer: "Prototype ini membuat draft, jadwal, dan saran visual. Untuk publish otomatis, integrasikan MCP seperti Kadenzo atau Outpost dengan kredensial platform sosial.",
    faq3Question: "Apakah bisa dipakai untuk pasar Indonesia dan global?",
    faq3Answer: "Ya. Konten default berbahasa Indonesia dan paket global sudah disiapkan dalam pricing. Copy dan prompt bisa dibuat bilingual pada fase berikutnya.",
    finalTitle: "Mulai Sekarang - Gratis Coba 7 Hari",
    finalCopy: "Uji ide pertama Anda, lihat risiko asumsi, lalu ubah insight menjadi konten akuisisi.",
    finalButton: "Buat BMC pertama",
    statusReady: "Siap",
    statusSaved: "Tersimpan",
    statusFillIdea: "Isi ide dulu",
    statusProcessing: "Memproses",
    statusProcessingAi: "Memproses AI",
    statusBmcReady: "BMC siap",
    statusFallback: "Fallback lokal",
    statusChatProcessing: "Memproses chat",
    statusChatReady: "Chat siap",
    statusVoiceUnavailable: "Voice tidak tersedia",
    statusListening: "Mendengar",
    statusVoiceCaptured: "Suara masuk",
    statusVoiceFailed: "Voice gagal",
    statusFileRead: "File dibaca",
    statusFileAccepted: "File diterima",
    statusExportReady: "Export dibuat",
    chatPending: "Memproses jawaban...",
    chatIntro: "Saya siap membantu refine BMC Anda. Coba tanya: \"Apa langkah 30 hari pertama?\", \"Berapa harga paket yang masuk akal?\", \"Asumsi paling berisiko apa?\", atau klik Refine pada salah satu blok.",
    fallbackNotice: "Backend belum bisa dihubungi ({message}). BMC ini dibuat dengan fallback lokal dulu. Setelah API Contabo aktif dan HTTPS/CORS benar, hasil akan memakai backend AI.",
    chatFallbackNotice: "Catatan: backend belum bisa dihubungi ({message}). Saya pakai fallback lokal dulu.",
    voiceUnsupported: "Browser ini belum mendukung Web Speech API. Anda tetap bisa mengetik ide di kolom input.",
    fileContext: "Konteks dokumen: {file}. Prototype offline ini menerima file tersebut sebagai sinyal konteks; parsing PDF/DOCX/PPTX perlu backend parser seperti pdf-parse, mammoth.js, atau extractor deck.",
    userLabel: "Anda",
    whyLabel: "Mengapa",
    testLabel: "Cara uji",
    refineButton: "Refine",
    refinePrompt: "Refine {block} saya",
    socialHashtags: "Hashtags",
    socialVisual: "Visual",
    socialSchedule: "Jadwal",
    knowledgeTitle: "Upload Buku dan Paper Kurasi",
    knowledgeTitlePlaceholder: "Contoh: Business Model Generation - bab Value Proposition",
    knowledgeTagsPlaceholder: "customer-segments, pricing, validation",
    knowledgeContentPlaceholder: "Paste ringkasan atau teks yang sudah boleh dipakai oleh AI.",
    knowledgeUploadButton: "Upload Knowledge",
    knowledgeRefreshButton: "Refresh",
    adminGateTitle: "Area admin",
    adminGateCopy: "Masukkan admin key untuk membuka upload knowledge. User biasa tidak melihat halaman ini.",
    adminKeyPlaceholder: "Admin key",
    adminUnlockButton: "Buka Admin",
    adminLogoutButton: "Keluar Admin",
    adminKeyMissing: "Masukkan admin key.",
    adminUnlocked: "Mode admin aktif.",
    adminLocked: "Knowledge base hanya untuk admin.",
    socialScheduleLabel: "Jadwal mulai",
    socialSaveDrafts: "Simpan Draft",
    socialSchedulePosts: "Jadwalkan",
    socialPublishDue: "Publish Due",
    apiUrlMissing: "BMC_API_URL belum diatur.",
    exportTitle: "Export",
    exportMarkdown: "Markdown",
    exportHtml: "HTML",
    exportPdf: "Print PDF",
    price1Title: "Rp50.000/bulan",
    price2Title: "Rp30.000",
    price3Title: "Rp500k-1jt/jam",
    sampleMenuHealth: "Menu sehat",
    sampleAiCourse: "Kursus AI UMKM",
    sampleAgriLocal: "Agritech lokal",
    sampleMenuHealthIdea: "Aplikasi langganan menu sehat rumahan untuk pekerja kantor di Jakarta yang ingin makan teratur tanpa memasak.",
    sampleAiCourseIdea: "Platform kursus singkat AI untuk pemilik UMKM Indonesia yang ingin membuat konten dan laporan bisnis lebih cepat.",
    sampleAgriLocalIdea: "Marketplace produk pertanian lokal yang menghubungkan petani kecil dengan restoran dan katering di kota besar.",
    knowledgeAuthorLabel: "Penulis",
    knowledgeYearLabel: "Tahun",
    knowledgeTagsLabel: "Tag",
    knowledgeFileLabel: "File teks",
    knowledgeContentLabel: "Isi kurasi",
    knowledgeStatusReady: "Knowledge siap menerima sumber kurasi.",
    knowledgeUnsupportedFile: "MVP ini menerima .txt/.md. Untuk PDF/DOCX, paste teks kurasi dulu.",
    knowledgeFileReady: "File {file} siap di-upload.",
    backendConfigMissing: "Backend API belum aktif di config.js.",
    knowledgeSaved: "Knowledge tersimpan: {title} ({chunks} chunk).",
    knowledgeUploadFailed: "Upload gagal: {message}",
    knowledgeBackendInactiveTitle: "Backend belum aktif",
    knowledgeBackendInactiveBody: "Isi BMC_API_URL agar knowledge base bisa dipakai.",
    knowledgeUnavailableTitle: "Knowledge belum tersedia",
    knowledgeNoSourcesTitle: "Belum ada sumber",
    knowledgeNoSourcesBody: "Upload teks kurasi buku/paper untuk mulai memberi pengetahuan ke agent.",
    curatedSourceFallback: "Sumber kurasi",
    socialStatusReady: "Draft sosial siap dibuat.",
    socialDraftsSaved: "{count} draft tersimpan.",
    socialDraftSaveFailed: "Simpan draft gagal: {message}",
    socialScheduled: "{count} post dijadwalkan.",
    socialScheduleFailed: "Jadwal gagal: {message}",
    socialPublishProcessed: "{count} post due diproses.",
    socialPublishFailed: "Publish due gagal: {message}",
    socialQueueInactiveTitle: "Queue belum aktif",
    socialQueueInactiveBody: "Backend diperlukan untuk menyimpan draft dan jadwal.",
    socialQueueUnavailableTitle: "Queue belum tersedia",
    socialNoScheduleTitle: "Belum ada jadwal",
    socialNoScheduleBody: "Simpan draft atau jadwalkan post dari hasil Social Agent.",
    socialDraftLabel: "Draft"
  },
  en: {
    navKnowledge: "Knowledge",
    navPricing: "Pricing",
    navFaq: "FAQ",
    start: "Start",
    heroEyebrow: "For founders, SMEs, and early-stage business ideas",
    heroCopy: "Turn a raw business idea into a complete Business Model Canvas in minutes, refine it with the chatbot, and prepare social content to attract potential customers.",
    heroIdeaLabel: "Write your business idea",
    heroPlaceholder: "Example: subscription coffee shop for hybrid workers in Jakarta",
    heroButton: "Create BMC",
    metricBlocks: "BMC blocks",
    metricRisks: "key risks",
    metricPlatforms: "social platforms",
    workspaceTitle: "Landing Page with BMC AI Chatbot",
    workspaceCopy: "Enter an idea, record your voice, or upload a document. The app produces a structured BMC, risk assumptions, and follow-up discussion material.",
    inputKicker: "Idea input",
    inputTitle: "Describe your business",
    ideaLabel: "Business idea",
    ideaPlaceholder: "Write your target customer, product, pricing, location, problem to solve, or any raw context you already have.",
    generateButton: "Create BMC",
    voiceButton: "Voice",
    uploadButton: "Upload",
    canvasKicker: "AI generated BMC",
    canvasTitle: "Business Model Canvas",
    tabCanvas: "Canvas",
    tabRisk: "Risk",
    tabChat: "Chat",
    riskKicker: "Assumption radar",
    riskTitle: "Riskiest assumptions",
    riskCopy: "AI highlights what should be tested before you spend too much money.",
    chatLabel: "Ask AI",
    chatPlaceholder: "Ask: which revenue stream is strongest?",
    chatSubmit: "Send",
    workflowTitle: "From raw idea to a testable BMC",
    step1Title: "Add context",
    step1Copy: "Text, voice, or documents become the starting material for understanding the problem, customer, and offer.",
    step2Title: "Generate 9 blocks",
    step2Copy: "The agent drafts customer segments, value proposition, channels, revenue, cost structure, and more.",
    step3Title: "Test assumptions",
    step3Copy: "The most expensive risks are prioritized, then AI suggests simple validation experiments.",
    socialCopy: "Create BMC and entrepreneurship content drafts for Instagram, LinkedIn, X, TikTok, and Facebook before publishing integrations are added.",
    socialTopicLabel: "Content topic",
    socialTopicPlaceholder: "Example: common mistakes when creating a BMC",
    socialPlatformLabel: "Platform",
    socialButton: "Create 5 Posts",
    featureEyebrow: "Product features",
    featureTitle: "Designed for founders who need clarity fast",
    feature1Title: "Voice input",
    feature1Copy: "Use the Web Speech API to capture ideas when users are not ready to write a long brief.",
    feature2Title: "Document intake",
    feature2Copy: "Upload briefs, notes, or early decks as business context to convert into a BMC.",
    feature3Title: "Risk analysis",
    feature3Copy: "The agent separates attractive ideas from assumptions that still need evidence.",
    feature4Title: "Export ready",
    feature4Copy: "BMC output can be downloaded as Markdown, HTML, or printed to PDF from the browser.",
    pricingEyebrow: "Monetization",
    pricingTitle: "Plans aligned with the product brief",
    price1Copy: "BMC generation, basic AI chat, saved canvas, and export.",
    price1Cta: "Try now",
    price2Copy: "One-time purchase for Indonesian BMC output or $5-10 global output.",
    price3Copy: "Live consulting with the founder for validation and go-to-market strategy.",
    testimonialEyebrow: "Market validation",
    testimonialTitle: "For users who want to start clearly",
    testimonial1Quote: "I can see customers, channels, and key costs on one screen before starting production.",
    testimonial1Name: "Rani, home F&B founder",
    testimonial2Quote: "The risk section helps our team know which experiment to run this week.",
    testimonial2Name: "Bagas, incubator mentor",
    testimonial3Quote: "The social content keeps BMC education consistent without starting from a blank page.",
    testimonial3Name: "Nadia, SME consultant",
    faqTitle: "Common questions",
    faq1Question: "Does this already use the OpenAI or Claude API?",
    faq1Answer: "The frontend still has an offline fallback, and the Express backend is ready to use the OpenAI API when config.js points to the Contabo API domain.",
    faq2Question: "Does the social agent publish automatically?",
    faq2Answer: "This prototype creates drafts, schedules, and visual suggestions. For automatic publishing, integrate MCP tools such as Kadenzo or Outpost with social platform credentials.",
    faq3Question: "Can it be used for Indonesian and global markets?",
    faq3Answer: "Yes. The app now supports Indonesian and English UI/output, with global pricing prepared in the product brief.",
    finalTitle: "Start Now - Free 7-Day Trial",
    finalCopy: "Test your first idea, review risky assumptions, then turn insights into acquisition content.",
    finalButton: "Create first BMC",
    statusReady: "Ready",
    statusSaved: "Saved",
    statusFillIdea: "Add an idea first",
    statusProcessing: "Processing",
    statusProcessingAi: "Processing AI",
    statusBmcReady: "BMC ready",
    statusFallback: "Local fallback",
    statusChatProcessing: "Processing chat",
    statusChatReady: "Chat ready",
    statusVoiceUnavailable: "Voice unavailable",
    statusListening: "Listening",
    statusVoiceCaptured: "Voice captured",
    statusVoiceFailed: "Voice failed",
    statusFileRead: "File read",
    statusFileAccepted: "File accepted",
    statusExportReady: "Export ready",
    chatPending: "Processing answer...",
    chatIntro: "I am ready to help refine your BMC. Try asking: \"What are the first 30-day actions?\", \"What package price makes sense?\", \"Which assumption is riskiest?\", or click Refine on any block.",
    fallbackNotice: "The backend could not be reached ({message}). This BMC was created with the local fallback. Once the Contabo API, HTTPS, and CORS are ready, results will use backend AI.",
    chatFallbackNotice: "Note: the backend could not be reached ({message}). I used the local fallback for now.",
    voiceUnsupported: "This browser does not support the Web Speech API yet. You can still type your idea in the input field.",
    fileContext: "Document context: {file}. This offline prototype accepts the file as a context signal; PDF/DOCX/PPTX parsing needs a backend parser such as pdf-parse, mammoth.js, or a deck extractor.",
    userLabel: "You",
    whyLabel: "Why",
    testLabel: "How to test",
    refineButton: "Refine",
    refinePrompt: "Refine my {block}",
    socialHashtags: "Hashtags",
    socialVisual: "Visual",
    socialSchedule: "Schedule",
    knowledgeTitle: "Upload Curated Books and Papers",
    knowledgeTitlePlaceholder: "Example: Business Model Generation - Value Proposition chapter",
    knowledgeTagsPlaceholder: "customer-segments, pricing, validation",
    knowledgeContentPlaceholder: "Paste a curated summary or text that AI is allowed to use.",
    knowledgeUploadButton: "Upload Knowledge",
    knowledgeRefreshButton: "Refresh",
    adminGateTitle: "Admin area",
    adminGateCopy: "Enter the admin key to unlock knowledge uploads. Regular users cannot see this area.",
    adminKeyPlaceholder: "Admin key",
    adminUnlockButton: "Unlock Admin",
    adminLogoutButton: "Logout Admin",
    adminKeyMissing: "Enter the admin key.",
    adminUnlocked: "Admin mode is active.",
    adminLocked: "Knowledge base is admin-only.",
    socialScheduleLabel: "Start schedule",
    socialSaveDrafts: "Save Drafts",
    socialSchedulePosts: "Schedule",
    socialPublishDue: "Publish Due",
    apiUrlMissing: "BMC_API_URL is not configured.",
    exportTitle: "Export",
    exportMarkdown: "Markdown",
    exportHtml: "HTML",
    exportPdf: "Print PDF",
    price1Title: "Rp50,000/month",
    price2Title: "Rp30,000",
    price3Title: "Rp500k-1m/hour",
    sampleMenuHealth: "Healthy meals",
    sampleAiCourse: "AI course for SMEs",
    sampleAgriLocal: "Local agritech",
    sampleMenuHealthIdea: "Home-style healthy meal subscription for office workers in Jakarta who want regular meals without cooking.",
    sampleAiCourseIdea: "Short AI course platform for Indonesian SME owners who want to create content and business reports faster.",
    sampleAgriLocalIdea: "Local agriculture marketplace connecting small farmers with restaurants and caterers in large cities.",
    knowledgeAuthorLabel: "Author",
    knowledgeYearLabel: "Year",
    knowledgeTagsLabel: "Tags",
    knowledgeFileLabel: "Text file",
    knowledgeContentLabel: "Curated content",
    knowledgeStatusReady: "Knowledge is ready to receive curated sources.",
    knowledgeUnsupportedFile: "This MVP accepts .txt/.md files. For PDF/DOCX, paste the curated text first.",
    knowledgeFileReady: "File {file} is ready to upload.",
    backendConfigMissing: "Backend API is not active in config.js.",
    knowledgeSaved: "Knowledge saved: {title} ({chunks} chunks).",
    knowledgeUploadFailed: "Upload failed: {message}",
    knowledgeBackendInactiveTitle: "Backend inactive",
    knowledgeBackendInactiveBody: "Set BMC_API_URL so the knowledge base can be used.",
    knowledgeUnavailableTitle: "Knowledge unavailable",
    knowledgeNoSourcesTitle: "No sources yet",
    knowledgeNoSourcesBody: "Upload curated book/paper text to start giving the agent approved knowledge.",
    curatedSourceFallback: "Curated source",
    socialStatusReady: "Social drafts are ready to create.",
    socialDraftsSaved: "{count} drafts saved.",
    socialDraftSaveFailed: "Save draft failed: {message}",
    socialScheduled: "{count} posts scheduled.",
    socialScheduleFailed: "Schedule failed: {message}",
    socialPublishProcessed: "{count} due posts processed.",
    socialPublishFailed: "Publish due failed: {message}",
    socialQueueInactiveTitle: "Queue inactive",
    socialQueueInactiveBody: "The backend is required to save drafts and schedules.",
    socialQueueUnavailableTitle: "Queue unavailable",
    socialNoScheduleTitle: "No schedule yet",
    socialNoScheduleBody: "Save drafts or schedule posts from the Social Agent output.",
    socialDraftLabel: "Draft"
  }
};

const state = {
  bmc: cloneData(defaultBmc),
  risks: cloneData(defaultRisks),
  idea: "",
  language: "id",
  selectedPlatforms: new Set(["Instagram", "LinkedIn", "X"]),
  selectedTopic: topicsByLanguage.id[0],
  socialPosts: []
};

const els = {
  heroForm: document.querySelector("#hero-form"),
  heroIdea: document.querySelector("#hero-idea"),
  ideaInput: document.querySelector("#idea-input"),
  generateBtn: document.querySelector("#generate-btn"),
  voiceBtn: document.querySelector("#voice-btn"),
  fileInput: document.querySelector("#file-input"),
  saveStatus: document.querySelector("#save-status"),
  grid: document.querySelector("#bmc-grid"),
  riskList: document.querySelector("#risk-list"),
  chatLog: document.querySelector("#chat-log"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  canvasTitle: document.querySelector("#canvas-title"),
  blockTemplate: document.querySelector("#block-template"),
  topicRow: document.querySelector("#topic-row"),
  platformRow: document.querySelector("#platform-row"),
  topicInput: document.querySelector("#topic-input"),
  postBoard: document.querySelector("#post-board"),
  generatePosts: document.querySelector("#generate-posts"),
  languageButtons: document.querySelectorAll(".lang-button"),
  knowledgeNav: document.querySelector('.nav-links a[href="#knowledge-base"]'),
  knowledgeSection: document.querySelector("#knowledge-base"),
  adminGate: document.querySelector("#admin-gate"),
  adminGateStatus: document.querySelector("#admin-gate-status"),
  adminKeyInput: document.querySelector("#admin-key-input"),
  adminLogout: document.querySelector("#admin-logout"),
  knowledgeWorkbench: document.querySelector("#knowledge-workbench"),
  knowledgeForm: document.querySelector("#knowledge-form"),
  knowledgeTitle: document.querySelector("#knowledge-title"),
  knowledgeAuthor: document.querySelector("#knowledge-author"),
  knowledgeYear: document.querySelector("#knowledge-year"),
  knowledgeTags: document.querySelector("#knowledge-tags"),
  knowledgeFile: document.querySelector("#knowledge-file"),
  knowledgeContent: document.querySelector("#knowledge-content"),
  knowledgeRefresh: document.querySelector("#knowledge-refresh"),
  knowledgeStatus: document.querySelector("#knowledge-status"),
  knowledgeList: document.querySelector("#knowledge-list"),
  scheduleAt: document.querySelector("#schedule-at"),
  saveSocialDrafts: document.querySelector("#save-social-drafts"),
  scheduleSocialPosts: document.querySelector("#schedule-social-posts"),
  publishDuePosts: document.querySelector("#publish-due-posts"),
  socialStatus: document.querySelector("#social-status"),
  socialQueue: document.querySelector("#social-queue")
};

function init() {
  restoreState();
  updateAdminVisibility();
  applyLanguage();
  updateAdminVisibility();
  renderCanvas();
  renderRisks();
  renderChatIntro();
  renderSocialControls();
  renderPosts(generatePosts());
  bindEvents();
  setDefaultSchedule();
  if (isKnowledgeAdmin()) loadKnowledgeSources();
  loadSocialQueue();
  setStatus(t("statusReady"));
}

function bindEvents() {
  els.heroForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const idea = els.heroIdea.value.trim();
    if (idea) {
      els.ideaInput.value = idea;
      await generateBmcFromInput();
      document.querySelector("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  els.generateBtn.addEventListener("click", generateBmcFromInput);

  els.languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });

  document.querySelectorAll(".prompt-chip").forEach((button) => {
    button.addEventListener("click", async () => {
      els.ideaInput.value = button.dataset.idea;
      await generateBmcFromInput();
    });
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  els.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = els.chatInput.value.trim();
    if (!question) return;
    addMessage("user", question);
    els.chatInput.value = "";
    switchTab("chat");

    const pending = addMessage("ai", t("chatPending"));
    setStatus(t("statusChatProcessing"));

    try {
      const answer = await answerQuestionWithBackend(question);
      updateMessage(pending, "ai", answer);
      setStatus(t("statusChatReady"));
    } catch (error) {
      updateMessage(pending, "ai", `${answerQuestion(question)}\n\n${interpolate(t("chatFallbackNotice"), { message: error.message })}`);
      setStatus(t("statusFallback"));
    }
  });

  els.voiceBtn.addEventListener("click", startVoiceInput);
  els.fileInput.addEventListener("change", handleFile);
  document.querySelector("#export-md").addEventListener("click", () => downloadFile("bmc-output.md", toMarkdown(), "text/markdown"));
  document.querySelector("#export-html").addEventListener("click", () => downloadFile("bmc-output.html", toStandaloneHtml(), "text/html"));
  document.querySelector("#print-pdf").addEventListener("click", () => window.print());
  els.generatePosts.addEventListener("click", () => renderPosts(generatePosts()));
  els.adminGate?.addEventListener("submit", unlockAdminKnowledge);
  els.adminLogout?.addEventListener("click", logoutAdminKnowledge);
  els.knowledgeForm?.addEventListener("submit", uploadKnowledge);
  els.knowledgeFile?.addEventListener("change", loadKnowledgeFile);
  els.knowledgeRefresh?.addEventListener("click", loadKnowledgeSources);
  els.saveSocialDrafts?.addEventListener("click", saveSocialDrafts);
  els.scheduleSocialPosts?.addEventListener("click", scheduleSocialPosts);
  els.publishDuePosts?.addEventListener("click", publishDuePosts);
  els.topicInput.addEventListener("input", () => {
    state.selectedTopic = els.topicInput.value.trim() || getTopics()[0];
  });
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem("bmc-ai-platform") || "null");
    if (!saved) return;
    state.bmc = saved.bmc || state.bmc;
    state.risks = saved.risks || state.risks;
    state.idea = saved.idea || "";
    state.language = ["id", "en"].includes(saved.language) ? saved.language : "id";
    els.ideaInput.value = state.idea;
  } catch {
    localStorage.removeItem("bmc-ai-platform");
  }
}

function persistState() {
  localStorage.setItem(
    "bmc-ai-platform",
    JSON.stringify({
      bmc: state.bmc,
      risks: state.risks,
      idea: state.idea,
      language: state.language
    })
  );
  setStatus(t("statusSaved"));
}

function setStatus(text) {
  els.saveStatus.textContent = text;
}

function t(key) {
  return translations[state.language]?.[key] || translations.id[key] || key;
}

function getTopics() {
  return topicsByLanguage[state.language] || topicsByLanguage.id;
}

function setLanguage(language) {
  if (!["id", "en"].includes(language) || language === state.language) return;
  state.language = language;
  const defaults = [...topicsByLanguage.id, ...topicsByLanguage.en];
  if (!els.topicInput.value.trim() || defaults.includes(state.selectedTopic)) {
    state.selectedTopic = getTopics()[0];
    els.topicInput.value = "";
  }
  applyLanguage();
  updateAdminVisibility();
  renderCanvas();
  renderRisks();
  renderChatIntro();
  renderSocialControls();
  renderPosts(generatePosts());
  if (isKnowledgeAdmin()) loadKnowledgeSources();
  loadSocialQueue();
  persistState();
  if (state.idea && els.ideaInput.value.trim()) {
    void generateBmcFromInput();
  } else {
    setStatus(t("statusReady"));
  }
}

function applyLanguage() {
  document.documentElement.lang = state.language === "en" ? "en" : "id";
  els.languageButtons.forEach((button) => {
    const active = button.dataset.lang === state.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const textTargets = [
    ['.nav-links a[href="#knowledge-base"]', 'navKnowledge'],
    ['.nav-links a[href="#pricing"]', 'navPricing'],
    ['.nav-links a[href="#faq"]', 'navFaq'],
    [".topbar-cta", "start"],
    [".hero .eyebrow", "heroEyebrow"],
    [".hero-copy", "heroCopy"],
    [".hero-form label", "heroIdeaLabel"],
    [".hero-form button", "heroButton"],
    [".hero-metrics span:nth-child(1)", "metricBlocks", (value) => `<strong>9</strong> ${value}`],
    [".hero-metrics span:nth-child(2)", "metricRisks", (value) => `<strong>3</strong> ${value}`],
    [".hero-metrics span:nth-child(3)", "metricPlatforms", (value) => `<strong>5</strong> ${value}`],
    ["#workspace .section-heading h2", "workspaceTitle"],
    ["#workspace .section-heading p:last-child", "workspaceCopy"],
    [".panel-header .panel-kicker", "inputKicker"],
    [".panel-header h3", "inputTitle"],
    ['label[for="idea-input"]', "ideaLabel"],
    ["#generate-btn span:last-child", "generateButton"],
    ["#voice-btn span:last-child", "voiceButton"],
    [".file-button span:last-of-type", "uploadButton"],
    [".canvas-toolbar .panel-kicker", "canvasKicker"],
    ['.tab-button[data-tab="canvas"]', "tabCanvas"],
    ['.tab-button[data-tab="risk"]', "tabRisk"],
    ['.tab-button[data-tab="chat"]', "tabChat"],
    ["#tab-risk .panel-kicker", "riskKicker"],
    ["#tab-risk h3", "riskTitle"],
    ["#tab-risk .muted", "riskCopy"],
    ['label[for="chat-input"]', "chatLabel"],
    [".chat-form button", "chatSubmit"],
    ["#knowledge-base .section-heading h2", "knowledgeTitle"],
    ["#admin-gate h3", "adminGateTitle"],
    ["#admin-gate p:first-of-type", "adminGateCopy"],
    ["#admin-gate button span:last-child", "adminUnlockButton"],
    ["#admin-logout span:last-child", "adminLogoutButton"],
    [".knowledge-actions button:first-child span:last-child", "knowledgeUploadButton"],
    [".knowledge-actions button:last-child span:last-child", "knowledgeRefreshButton"],
    ["#how-it-works .section-heading h2", "workflowTitle"],
    [".step-grid article:nth-child(1) h3", "step1Title"],
    [".step-grid article:nth-child(1) p", "step1Copy"],
    [".step-grid article:nth-child(2) h3", "step2Title"],
    [".step-grid article:nth-child(2) p", "step2Copy"],
    [".step-grid article:nth-child(3) h3", "step3Title"],
    [".step-grid article:nth-child(3) p", "step3Copy"],
    ["#social-agent .section-heading p:last-child", "socialCopy"],
    ['label[for="topic-input"]', "socialTopicLabel"],
    [".social-controls label:nth-of-type(2)", "socialPlatformLabel"],
    ["#generate-posts span:last-child", "socialButton"],
    [".social-scheduler label", "socialScheduleLabel"],
    ["#save-social-drafts span:last-child", "socialSaveDrafts"],
    ["#schedule-social-posts span:last-child", "socialSchedulePosts"],
    ["#publish-due-posts span:last-child", "socialPublishDue"],
    [".export-box h4", "exportTitle"],
    ["#export-md", "exportMarkdown"],
    ["#export-html", "exportHtml"],
    ["#print-pdf", "exportPdf"],
    ['label[for="knowledge-author"]', "knowledgeAuthorLabel"],
    ['label[for="knowledge-year"]', "knowledgeYearLabel"],
    ['label[for="knowledge-tags"]', "knowledgeTagsLabel"],
    ['label[for="knowledge-file"]', "knowledgeFileLabel"],
    ['label[for="knowledge-content"]', "knowledgeContentLabel"],
    ["#features .section-heading .eyebrow", "featureEyebrow"],
    ["#features .section-heading h2", "featureTitle"],
    [".feature-grid article:nth-child(1) h3", "feature1Title"],
    [".feature-grid article:nth-child(1) p", "feature1Copy"],
    [".feature-grid article:nth-child(2) h3", "feature2Title"],
    [".feature-grid article:nth-child(2) p", "feature2Copy"],
    [".feature-grid article:nth-child(3) h3", "feature3Title"],
    [".feature-grid article:nth-child(3) p", "feature3Copy"],
    [".feature-grid article:nth-child(4) h3", "feature4Title"],
    [".feature-grid article:nth-child(4) p", "feature4Copy"],
    ["#pricing .section-heading .eyebrow", "pricingEyebrow"],
    ["#pricing .section-heading h2", "pricingTitle"],
    [".pricing-grid article:nth-child(1) h3", "price1Title"],
    [".pricing-grid article:nth-child(1) p", "price1Copy"],
    [".pricing-grid article:nth-child(1) a", "price1Cta"],
    [".pricing-grid article:nth-child(2) h3", "price2Title"],
    [".pricing-grid article:nth-child(2) p", "price2Copy"],
    [".pricing-grid article:nth-child(3) h3", "price3Title"],
    [".pricing-grid article:nth-child(3) p", "price3Copy"],
    ["#testimonials .section-heading .eyebrow", "testimonialEyebrow"],
    ["#testimonials .section-heading h2", "testimonialTitle"],
    [".testimonial-grid figure:nth-child(1) blockquote", "testimonial1Quote", (value) => `"${value}"`],
    [".testimonial-grid figure:nth-child(1) figcaption", "testimonial1Name"],
    [".testimonial-grid figure:nth-child(2) blockquote", "testimonial2Quote", (value) => `"${value}"`],
    [".testimonial-grid figure:nth-child(2) figcaption", "testimonial2Name"],
    [".testimonial-grid figure:nth-child(3) blockquote", "testimonial3Quote", (value) => `"${value}"`],
    [".testimonial-grid figure:nth-child(3) figcaption", "testimonial3Name"],
    ["#faq .section-heading h2", "faqTitle"],
    [".faq-list details:nth-child(1) summary", "faq1Question"],
    [".faq-list details:nth-child(1) p", "faq1Answer"],
    [".faq-list details:nth-child(2) summary", "faq2Question"],
    [".faq-list details:nth-child(2) p", "faq2Answer"],
    [".faq-list details:nth-child(3) summary", "faq3Question"],
    [".faq-list details:nth-child(3) p", "faq3Answer"],
    [".final-cta h2", "finalTitle"],
    [".final-cta p", "finalCopy"],
    [".final-cta a", "finalButton"]
  ];

  textTargets.forEach(([selector, key, render]) => {
    const element = document.querySelector(selector);
    if (!element) return;
    const value = t(key);
    if (render) element.innerHTML = render(value);
    else element.textContent = value;
  });

  const placeholderTargets = [
    [els.heroIdea, "heroPlaceholder"],
    [els.ideaInput, "ideaPlaceholder"],
    [els.chatInput, "chatPlaceholder"],
    [els.topicInput, "socialTopicPlaceholder"],
    [els.knowledgeTitle, "knowledgeTitlePlaceholder"],
    [els.knowledgeTags, "knowledgeTagsPlaceholder"],
    [els.knowledgeContent, "knowledgeContentPlaceholder"],
    [els.adminKeyInput, "adminKeyPlaceholder"]
  ];
  placeholderTargets.forEach(([element, key]) => {
    if (element) element.setAttribute("placeholder", t(key));
  });

  const sampleTargets = [
    [".prompt-chip:nth-child(1)", "sampleMenuHealth", "sampleMenuHealthIdea"],
    [".prompt-chip:nth-child(2)", "sampleAiCourse", "sampleAiCourseIdea"],
    [".prompt-chip:nth-child(3)", "sampleAgriLocal", "sampleAgriLocalIdea"]
  ];
  sampleTargets.forEach(([selector, labelKey, ideaKey]) => {
    const element = document.querySelector(selector);
    if (!element) return;
    element.textContent = t(labelKey);
    element.dataset.idea = t(ideaKey);
  });

  if (els.adminGateStatus && !els.adminGateStatus.dataset.custom) setAdminGateStatus(t("adminLocked"));
  if (els.knowledgeStatus && !els.knowledgeStatus.dataset.custom) setKnowledgeStatus(t("knowledgeStatusReady"));
  if (els.socialStatus && !els.socialStatus.dataset.custom) setSocialStatus(t("socialStatusReady"));

  if (!state.idea) els.canvasTitle.textContent = t("canvasTitle");
  setStatus(t("statusReady"));
}

function interpolate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value), template);
}

function switchTab(tab) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.toggle("active", view.id === `tab-${tab}`);
  });
}

async function generateBmcFromInput() {
  const idea = els.ideaInput.value.trim();
  if (!idea) {
    setStatus(t("statusFillIdea"));
    els.ideaInput.focus();
    return;
  }

  state.idea = idea;
  setStatus(hasBackendConfig() ? t("statusProcessingAi") : t("statusProcessing"));
  els.generateBtn.disabled = true;

  let fallbackNotice = "";
  try {
    if (hasBackendConfig()) {
      const result = await generateBmcViaBackend(idea);
      state.bmc = result.bmc;
      state.risks = result.risks;
      els.canvasTitle.textContent = `BMC - ${result.title || summarizeIdea(idea)}`;
    } else {
      useLocalBmc(idea);
    }
  } catch (error) {
    useLocalBmc(idea);
    fallbackNotice = interpolate(t("fallbackNotice"), { message: error.message });
  } finally {
    els.generateBtn.disabled = false;
  }

  renderCanvas();
  renderRisks();
  renderChatIntro();
  if (fallbackNotice) addMessage("ai", fallbackNotice);
  persistState();
  setStatus(fallbackNotice ? t("statusFallback") : t("statusBmcReady"));
  switchTab(fallbackNotice ? "chat" : "canvas");
}

function useLocalBmc(idea) {
  const sector = detectSector(idea);
  const businessName = summarizeIdea(idea);
  if (state.language === "en") {
    state.bmc = buildEnglishBmc(idea, sector);
    state.risks = buildEnglishRisks(idea, sector);
  } else {
    state.bmc = buildBmc(idea, sector);
    state.risks = buildRisks(idea, sector);
  }
  els.canvasTitle.textContent = `BMC - ${businessName}`;
}

function detectSector(idea) {
  const lower = idea.toLowerCase();
  const matched = sectorRules.find((rule) => rule.match.some((keyword) => lower.includes(keyword)));
  return matched || {
    name: "general",
    label: "early-stage business",
    customer: ["early adopter dengan masalah yang jelas", "segmen niche yang mudah dijangkau", "pelanggan yang sudah mencari alternatif solusi"],
    value: ["solusi yang lebih cepat atau lebih sederhana", "pengalaman pelanggan yang mudah dipahami", "hasil yang bisa diukur dalam waktu singkat"],
    channel: ["landing page dan SEO", "komunitas niche", "konten edukasi dan referral"],
    revenue: ["penjualan produk/layanan inti", "paket langganan atau retainer", "upsell konsultasi atau add-on"],
    activity: ["validasi masalah", "pengembangan penawaran", "akuisisi dan onboarding pelanggan"],
    resource: ["tim inti", "data pelanggan", "brand dan sistem operasional"],
    partner: ["komunitas target", "vendor operasional", "partner distribusi"],
    cost: ["pengembangan produk", "operasional", "marketing dan support"]
  };
}

function summarizeIdea(idea) {
  const cleaned = idea.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 46) return cleaned;
  return `${cleaned.slice(0, 43).trim()}...`;
}

function buildBmc(idea, sector) {
  const userContext = extractContext(idea, sector);
  const isTourism = sector.name === "tourism";

  if (isTourism) {
    return {
      customerSegments: [
        `Wisatawan dari ${userContext.primaryMarkets} yang ingin pengalaman ${userContext.product} di ${userContext.location} tanpa repot menyusun itinerary sendiri.`,
        ...sector.customer
      ].slice(0, 5),
      valuePropositions: [
        `Paket ${userContext.product} ${userContext.location} yang menggabungkan alam, budaya lokal, kuliner, cerita warga, dan aktivitas edukatif.`,
        ...sector.value
      ].slice(0, 5),
      channels: [
        "WhatsApp Business untuk booking, katalog paket, FAQ akses lokasi, dan follow-up calon tamu.",
        ...sector.channel
      ].slice(0, 5),
      customerRelationships: [
        "Sebelum trip: konsultasi via WhatsApp untuk jumlah peserta, usia, transport, minat aktivitas, dan batasan fisik.",
        "Saat trip: guide lokal menjadi host, storyteller, penjaga etika kunjungan, dan koordinator keamanan rombongan.",
        "Sesudah trip: kirim dokumentasi, minta review Google/Instagram, dan tawarkan referral atau paket berikutnya.",
        "Untuk sekolah/kantor: proposal singkat, invoice, rundown, surat izin bila perlu, dan laporan dampak sederhana.",
        "Komunitas alumni trip untuk update kalender panen, event budaya, dan open trip berikutnya."
      ],
      revenueStreams: [
        ...sector.revenue,
        "DP/pre-booking untuk membuktikan demand sebelum menyiapkan guide, konsumsi, homestay, dan transport."
      ].slice(0, 5),
      keyActivities: [
        ...sector.activity,
        "Pilot trip 10-15 peserta untuk menguji itinerary, harga, SOP, biaya aktual, dan kualitas pengalaman."
      ].slice(0, 5),
      keyResources: [
        ...sector.resource,
        "Data HPP per peserta, margin per paket, minimum peserta per trip, dan daftar calon partner komunitas."
      ].slice(0, 5),
      keyPartnerships: [
        ...sector.partner,
        "Kesepakatan sederhana tentang peran, pembagian manfaat, kapasitas kunjungan, dan aktivitas yang tidak boleh dilakukan."
      ].slice(0, 5),
      costStructure: [
        ...sector.cost,
        "Pisahkan biaya variabel per peserta dan biaya tetap agar tahu minimum peserta untuk tidak rugi."
      ].slice(0, 5)
    };
  }

  return {
    customerSegments: [
      ...sector.customer,
      `Segmen awal yang paling mudah diuji: ${userContext.target}.`
    ].slice(0, 5),
    valuePropositions: [
      ...sector.value,
      `Janji utama: membantu pelanggan menyelesaikan "${userContext.problem}" dengan cara yang lebih praktis.`
    ].slice(0, 5),
    channels: [
      ...sector.channel,
      "Landing page dengan CTA jelas untuk mengumpulkan leads dan mengukur minat."
    ].slice(0, 5),
    customerRelationships: [
      "Onboarding singkat yang menanyakan kebutuhan, budget, dan konteks pelanggan.",
      "Follow-up otomatis setelah pengguna mencoba produk atau menerima output awal.",
      "Komunitas atau newsletter untuk edukasi, studi kasus, dan retensi.",
      "Jalur konsultasi premium untuk pelanggan bernilai tinggi."
    ],
    revenueStreams: [
      ...sector.revenue,
      "Eksperimen harga awal dengan paket entry, pro, dan premium."
    ].slice(0, 5),
    keyActivities: [
      ...sector.activity,
      "Mengukur conversion, activation, dan repeat usage setiap minggu."
    ].slice(0, 5),
    keyResources: [
      ...sector.resource,
      "Template, SOP, dan data pembelajaran dari pelanggan awal."
    ].slice(0, 5),
    keyPartnerships: [
      ...sector.partner,
      "Partner akuisisi yang sudah dipercaya oleh target pelanggan."
    ].slice(0, 5),
    costStructure: [
      ...sector.cost,
      "Biaya eksperimen validasi seperti landing page, sample produk, dan campaign kecil."
    ].slice(0, 5)
  };
}
function extractContext(idea, sector) {
  const lower = idea.toLowerCase();
  const location = detectLocation(idea);
  const isTourism = sector?.name === "tourism";
  const product = lower.includes("eko") || lower.includes("ekowisata") ? "eko wisata" : lower.includes("wisata") ? "wisata" : sector?.label || "bisnis";
  const primaryMarkets = isTourism && /cibarani|lebak|banten|kasepuhan/i.test(idea)
    ? "Jakarta, Tangerang, Serang, Bogor, Bandung, dan komunitas traveler Banten"
    : "kota sekitar lokasi dan komunitas niche yang relevan";

  const target = isTourism
    ? `calon pengunjung yang ingin ${product} autentik di ${location}`
    : lower.includes("umkm")
      ? "pemilik UMKM yang ingin hasil praktis"
      : lower.includes("jakarta")
        ? "pelanggan urban di Jakarta"
        : lower.includes("petani")
          ? "petani dan pembeli hasil panen"
          : "kelompok pelanggan awal yang paling sering merasakan masalah ini";

  const problem = isTourism
    ? "sulit menemukan paket wisata yang jelas, aman, autentik, menghormati warga/adat, dan mudah dipesan"
    : lower.includes("tanpa")
      ? idea.split(/tanpa/i)[1]?.slice(0, 80).trim() || "mengurangi hambatan utama"
      : lower.includes("ingin")
        ? idea.split(/ingin/i)[1]?.slice(0, 80).trim() || "mencapai hasil yang diinginkan"
        : "memulai solusi dengan risiko dan biaya yang lebih kecil";

  return { location, product, primaryMarkets, target, problem };
}

function detectLocation(idea) {
  const lower = idea.toLowerCase();
  if (lower.includes("cibarani") && lower.includes("lebak")) return "Kasepuhan Cibarani, Lebak";
  if (lower.includes("cibarani")) return "Kasepuhan Cibarani";
  if (lower.includes("lebak")) return "Lebak, Banten";
  if (lower.includes("kasepuhan")) return "kawasan Kasepuhan";
  const match = idea.match(/\bdi\s+([A-Za-z\s]{3,70})/i);
  if (!match) return "lokasi usaha";
  return titleCase(match[1].replace(/[.,;:!?].*$/, "").split(/\s+/).slice(0, 5).join(" "));
}

function titleCase(value) {
  return value.trim().split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}
function buildRisks(idea, sector) {
  const context = extractContext(idea, sector);

  if (sector.name === "tourism") {
    return [
      {
        title: "Izin sosial, aturan adat, dan kapasitas lokasi belum jelas",
        why: `Bisnis wisata di ${context.location} hanya sehat jika warga, tokoh adat, dan pengelola lokal merasa dilibatkan dan manfaatnya adil.`,
        test: "Adakan diskusi kecil dengan tokoh adat/desa, calon guide, pemilik homestay, dan warga terdampak. Sepakati aturan kunjungan, kapasitas, pembagian manfaat, dan aktivitas yang tidak boleh dilakukan."
      },
      {
        title: "Wisatawan mau membayar paket, bukan hanya datang sendiri",
        why: "Eko wisata perlu membuktikan bahwa itinerary, guide lokal, keamanan, cerita budaya, dan kemudahan booking cukup bernilai untuk dibayar.",
        test: "Buat 2 paket dan buka pre-booking ke 30 calon peserta/komunitas. Target awal: minimal 10 orang bersedia bayar DP untuk pilot trip."
      },
      {
        title: "Kualitas pengalaman belum konsisten dari trip ke trip",
        why: "Review buruk bisa muncul dari akses sulit, cuaca, guide belum siap, homestay kurang bersih, atau ekspektasi pengunjung tidak sesuai.",
        test: "Jalankan pilot trip 10-15 orang dengan checklist SOP, form feedback, data biaya aktual, dan review terbuka. Perbaiki paket sebelum promosi besar."
      }
    ];
  }

  return [
    {
      title: "Segmen awal benar-benar merasakan masalah ini",
      why: `BMC terlihat kuat hanya jika ${context.target} punya pain yang sering, mahal, atau mendesak.`,
      test: "Wawancarai 15 calon pelanggan dan minta mereka menceritakan solusi yang saat ini dipakai, bukan sekadar opini."
    },
    {
      title: "Value proposition cukup berbeda dari alternatif",
      why: `Di kategori ${sector.label}, pelanggan biasanya punya opsi gratis, manual, atau kompetitor yang sudah dikenal.`,
      test: "Buat landing page dengan tiga variasi pesan nilai, lalu ukur klik CTA dan signup per pesan."
    },
    {
      title: "Unit economics masuk akal sejak transaksi awal",
      why: "Revenue harus bisa menutup biaya akuisisi, produksi, support, dan eksperimen pertumbuhan.",
      test: "Hitung margin per paket dan jalankan pre-order kecil sebelum membangun fitur atau operasi penuh."
    }
  ];
}
function buildEnglishBmc(idea, sector) {
  const context = extractEnglishContext(idea, sector);
  if (sector.name === "tourism") {
    return {
      customerSegments: [
        `Visitors from ${context.primaryMarkets} who want an authentic ${context.product} experience in ${context.location} without building the itinerary themselves.`,
        "families, schools, campuses, and travel communities seeking a 1-2 day nature-and-culture trip",
        "companies and institutions looking for village-based outing, CSR, or team-building programs",
        "niche travelers interested in local culture, farming, sustainability, and community-based tourism"
      ],
      valuePropositions: [
        `A ${context.product} package in ${context.location} combining nature, local culture, food, community stories, and educational activities.`,
        "clear itinerary, local guide, visitor rules, safety checklist, and transparent cost estimate before booking",
        "direct local economic impact through guides, homestays, meals, crafts, documentation, and conservation work",
        "ethical visitor briefing that helps guests respect community rules and environmental limits"
      ],
      channels: [
        "WhatsApp Business for booking, package catalog, access FAQ, deposit confirmation, and follow-up messages.",
        "Instagram Reels and TikTok clips showing routes, activities, package prices, safety notes, and visitor reviews.",
        "Google Business Profile with location photos, opening hours, reviews, and clear directions.",
        "Direct outreach to hiking communities, campuses, schools, travel organizers, and offices in nearby cities."
      ],
      customerRelationships: [
        "Before the trip: WhatsApp consultation about group size, age, transport, interests, and physical limits.",
        "During the trip: local guide acts as host, storyteller, visitor-ethics guardian, and safety coordinator.",
        "After the trip: send documentation, request Google/Instagram reviews, and offer referral or next package.",
        "For schools/offices: provide proposal, invoice, itinerary, permit notes if needed, and a simple impact report."
      ],
      revenueStreams: [
        "One-day trip package per person including guide, local meal, and main activity; starting price is an initial assumption.",
        "Overnight package with homestay, meals, guide, and culture/nature activities; validate with deposit first.",
        "School/campus and corporate group package with group pricing, custom itinerary, and simple impact report.",
        "Add-on revenue from local products, meals, photo/video documentation, and additional transport."
      ],
      keyActivities: [
        "Map tourism assets, safe routes, community rules, visitor capacity, and prohibited activities in week 1.",
        "Train local guides for storytelling, hospitality, basic first aid, and group coordination before pilot trips.",
        "Create itinerary, price list, package catalog, WhatsApp booking flow, and 10 authentic photos/videos.",
        "Run a 10-15 person pilot trip within 30 days to test price, SOP, cost, and satisfaction."
      ],
      keyResources: [
        "Local guides, community leaders, safe routes, cultural stories, homestays, food providers, and activity locations.",
        "Visitor SOP, community rules, safety checklist, price list, itinerary templates, and booking scripts.",
        "Content assets, WhatsApp Business, Google Maps listing, landing page, and list of 30 potential buyers.",
        "Cost data per participant, margin per package, minimum group size, and working capital for pilot operations."
      ],
      keyPartnerships: [
        "Village leaders, customary leaders, tourism awareness group, youth group, homestay owners, and local SMEs.",
        "Travel communities, schools, campuses, offices, travel organizers, and local creators who can bring groups.",
        "Transport providers, outdoor/safety equipment providers, food SMEs, craft makers, and local media.",
        "Tourism office, conservation NGOs, SME incubators, and community organizations for legitimacy and training."
      ],
      costStructure: [
        "Variable cost per participant: guide fee, meals, homestay, local transport, cleaning, and community contribution.",
        "Fixed costs: guide training, signage, safety tools, SOP documentation, website, and content production.",
        "Marketing costs: small ads, creator collaboration, photo/video editing, WhatsApp admin, and Google listing upkeep.",
        "Risk buffer for weather, refunds, route maintenance, facility repairs, and guest safety incidents."
      ]
    };
  }

  return {
    customerSegments: [
      `Most testable first segment: ${context.target}.`,
      "buyers who already use a manual workaround and can explain the problem without education",
      "small teams or business owners who can approve a pilot within 7-14 days",
      "communities or niches where the founder can reach at least 30 prospects directly"
    ],
    valuePropositions: [
      `Core promise: help customers solve "${context.problem}" in a faster, clearer, or lower-risk way.`,
      "a simple first offer with visible output, clear delivery time, and measurable before/after result",
      "lower switching friction than manual work or existing alternatives through templates, onboarding, or concierge help",
      "evidence-based guidance that turns user input into next actions, pricing, channels, and validation metrics"
    ],
    channels: [
      "SEO landing page targeting one pain keyword and one clear CTA for a pilot or waitlist.",
      "Direct outreach to 30 named prospects from communities, LinkedIn, WhatsApp groups, or existing relationships.",
      "Short demo content on LinkedIn/X/TikTok showing the before-after result and one concrete use case.",
      "Partnership with one trusted community, consultant, campus, incubator, or operator serving the same segment."
    ],
    customerRelationships: [
      "Onboarding asks the user's goal, budget, urgency, current workaround, and success metric before giving output.",
      "Follow-up within 24-48 hours after first use to collect objections, missing features, and willingness to pay.",
      "Weekly education email or WhatsApp update with examples, templates, and one action users can complete.",
      "Premium help path for users who want review, implementation support, or go-to-market decisions."
    ],
    revenueStreams: [
      "Entry plan for first validation, pro plan for recurring use, and premium help for high-touch support.",
      "One-time paid output or paid pilot to test willingness to pay before building full automation.",
      "Monthly subscription after activation is proven, with usage limit or feature tier based on real demand.",
      "Add-on revenue from templates, implementation review, done-with-you sessions, or partner referrals."
    ],
    keyActivities: [
      "Interview 15 prospects in week 1 and capture exact phrases, current alternatives, budget, and buying trigger.",
      "Launch one landing page and one offer in week 2, then track CTA clicks, signups, and booked calls.",
      "Run a small paid pilot or concierge MVP in week 3 before automating the full workflow.",
      "Review conversion, margin, retention intent, and objections in week 4 before scaling channels."
    ],
    keyResources: [
      "Founder expertise, customer interview notes, lead list, offer copy, landing page, and conversion tracking.",
      "Templates, SOPs, product workflow, pricing sheet, support scripts, and examples from early users.",
      "Technical stack, AI/API access, hosting, analytics, and data privacy checklist for user inputs.",
      "Community access, partner relationships, early testimonials, case studies, and proof of willingness to pay."
    ],
    keyPartnerships: [
      "Communities where the target segment already asks for help and trusts moderators or mentors.",
      "Payment, hosting, AI/API, analytics, and email/WhatsApp tools that support the first workflow.",
      "Consultants, incubators, campuses, or operators who can refer users and validate the offer.",
      "One anchor customer or pilot partner willing to give feedback, testimonial, and usage data."
    ],
    costStructure: [
      "Fixed costs: hosting, domain, AI/API, analytics, design, documentation, and basic operations.",
      "Variable costs: support time, manual fulfillment, API usage per output, payment fees, and content production.",
      "Acquisition costs: outreach tools, small ads, community sponsorship, demo production, and partner incentives.",
      "Validation budget for landing page tests, paid pilots, sample outputs, interviews, and customer support."
    ]
  };
}

function buildEnglishRisks(idea, sector) {
  const context = extractEnglishContext(idea, sector);
  if (sector.name === "tourism") {
    return [
      {
        title: "Local permission, visitor rules, and site capacity are not clear yet",
        why: `Tourism in ${context.location} is only healthy if local leaders, residents, guides, and operators feel involved and fairly benefit.`,
        test: "Run a small discussion with local/customary leaders, guide candidates, homestay owners, and affected residents. Agree on rules, capacity, benefit sharing, and prohibited activities."
      },
      {
        title: "Visitors may not pay for a package instead of coming independently",
        why: "Eco-tourism must prove that itinerary, guide, safety, cultural stories, and easy booking are valuable enough to pay for.",
        test: "Create two packages and offer pre-booking to 30 potential participants or communities. Initial target: at least 10 people pay a deposit for the pilot trip."
      },
      {
        title: "Experience quality may not be consistent from trip to trip",
        why: "Bad reviews can come from difficult access, weather, unprepared guides, homestay quality, or mismatched expectations.",
        test: "Run a 10-15 person pilot trip with SOP checklist, feedback form, actual cost data, and public reviews. Improve before scaling promotion."
      }
    ];
  }

  return [
    {
      title: "The first segment may not feel the problem strongly enough",
      why: `The BMC only becomes useful if ${context.target} has a frequent, expensive, or urgent pain.`,
      test: "Interview 15 potential customers and ask them to describe current alternatives, not just opinions."
    },
    {
      title: "The value proposition may not be different enough from alternatives",
      why: "Customers often have free, manual, or familiar competitor options, so the first offer must prove a clearer outcome.",
      test: "Create a landing page with three value-message variants, then measure CTA clicks and signups per message."
    },
    {
      title: "Unit economics may not work from early transactions",
      why: "Revenue must cover acquisition, production, support, and growth experiments.",
      test: "Calculate margin per package and run a small pre-order before building full features or operations."
    }
  ];
}

function extractEnglishContext(idea, sector) {
  const lower = idea.toLowerCase();
  const location = detectLocation(idea);
  const isTourism = sector?.name === "tourism";
  const product = lower.includes("eco") || lower.includes("eko") || lower.includes("ekowisata")
    ? "eco-tourism"
    : lower.includes("wisata") || lower.includes("tour")
      ? "tourism"
      : "business";
  const primaryMarkets = isTourism && /cibarani|lebak|banten|kasepuhan/i.test(idea)
    ? "Jakarta, Tangerang, Serang, Bogor, Bandung, and Banten travel communities"
    : "nearby cities and relevant niche communities";
  const target = isTourism
    ? `potential visitors seeking an authentic ${product} experience in ${location}`
    : lower.includes("umkm") || lower.includes("sme")
      ? "SME owners who need practical business outcomes"
      : lower.includes("jakarta")
        ? "urban customers in Jakarta"
        : lower.includes("petani") || lower.includes("farmer")
          ? "farmers and harvest buyers"
          : "the customer group that feels this problem most often";
  const problem = isTourism
    ? "finding a clear, safe, authentic, locally respectful, and easy-to-book tourism package"
    : lower.includes("tanpa")
      ? idea.split(/tanpa/i)[1]?.slice(0, 80).trim() || "removing the main friction"
      : lower.includes("without")
        ? idea.split(/without/i)[1]?.slice(0, 80).trim() || "removing the main friction"
        : "starting with lower risk and lower cost";
  return { location, product, primaryMarkets, target, problem };
}

function renderCanvas() {
  els.grid.innerHTML = "";
  blocks.forEach((block, index) => {
    const node = els.blockTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.tone = block.tone;
    if (block.key === "costStructure" || block.key === "revenueStreams") node.classList.add("wide");
    node.querySelector(".block-index").textContent = String(index + 1).padStart(2, "0");
    node.querySelector("h4").textContent = block.title;
    const list = node.querySelector("ul");
    (state.bmc[block.key] || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    });
    node.querySelector(".block-refine").textContent = t("refineButton");
    node.querySelector(".block-refine").addEventListener("click", () => {
      switchTab("chat");
      const prompt = interpolate(t("refinePrompt"), { block: block.title });
      els.chatInput.value = prompt;
      els.chatInput.focus();
    });
    els.grid.append(node);
  });
}

function renderRisks() {
  els.riskList.innerHTML = "";
  state.risks.forEach((risk, index) => {
    const article = document.createElement("article");
    article.className = "risk-card";
    article.innerHTML = `
      <h4>${index + 1}. ${escapeHtml(risk.title)}</h4>
      <p><strong>${t("whyLabel")}:</strong> ${escapeHtml(risk.why)}</p>
      <p><strong>${t("testLabel")}:</strong> ${escapeHtml(risk.test)}</p>
    `;
    els.riskList.append(article);
  });
}

function renderChatIntro() {
  els.chatLog.innerHTML = "";
  addMessage("ai", t("chatIntro"));
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  updateMessage(message, role, text);
  els.chatLog.append(message);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
  return message;
}

function updateMessage(message, role, text) {
  const label = role === "ai" ? "BMC AI" : t("userLabel");
  message.innerHTML = `<strong>${label}</strong>${formatChatText(text)}`;
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function answerQuestion(question) {
  if (state.language === "en") return answerQuestionEnglish(question);

  const lower = question.toLowerCase();
  const sector = detectSector(state.idea || "");
  const context = extractContext(state.idea || "", sector);

  if (lower.includes("langkah") || lower.includes("action") || lower.includes("30 hari") || lower.includes("jalankan") || lower.includes("mulai")) {
    return buildActionPlanResponse(sector, context);
  }

  if (lower.includes("risiko") || lower.includes("risky") || lower.includes("asumsi")) {
    return `Tiga asumsi paling penting untuk diuji:\n\n1. ${state.risks[0].title}\nCara uji: ${state.risks[0].test}\n\n2. ${state.risks[1].title}\nCara uji: ${state.risks[1].test}\n\n3. ${state.risks[2].title}\nCara uji: ${state.risks[2].test}`;
  }

  if (lower.includes("harga") || lower.includes("pricing") || lower.includes("tarif")) {
    if (sector.name === "tourism") {
      return "Untuk eko wisata, jangan mulai dari harga tebak-tebakan. Hitung HPP per peserta dulu: guide, makan, homestay, transport lokal, kontribusi warga/adat, dokumentasi, kebersihan, dan cadangan risiko. Buat 3 paket awal: one-day, overnight, dan grup sekolah/kantor. Minta DP untuk pilot trip agar demand terbukti sebelum operasional disiapkan.";
    }
    return "Mulai dengan tiga level harga: entry untuk validasi cepat, pro untuk pengguna rutin, dan premium untuk bantuan intensif. Ukur willingness to pay dengan pre-order, bukan survei opini saja.";
  }

  if (lower.includes("mvp") || lower.includes("pertama") || lower.includes("pilot")) {
    if (sector.name === "tourism") {
      return "MVP eko wisata paling ringan: satu paket pilot untuk 10-15 peserta, satu rute aman, satu guide utama, satu opsi makan lokal, briefing etika kunjungan, dan form feedback. Jangan buat banyak paket dulu. Tujuan pilot adalah membuktikan itinerary, harga, keamanan, dan kepuasan peserta.";
    }
    return "MVP paling ringan: landing page, satu CTA, 10-20 wawancara calon pelanggan, dan satu output manual/concierge. Setelah ada bukti minat, baru otomatisasi fitur yang paling sering dipakai.";
  }

  const block = blocks.find((item) => blockSynonyms[item.key].some((word) => lower.includes(word)) || lower.includes(item.title.toLowerCase()));
  if (block) {
    const points = state.bmc[block.key] || [];
    return `Untuk ${block.title}, arah saat ini:\n\n${points.map((point, index) => `${index + 1}. ${point}`).join("\n")}\n\nSaran eksekusi: ${blockActionAdvice(block, sector, context)}`;
  }

  return buildActionPlanResponse(sector, context);
}

function answerQuestionEnglish(question) {
  const lower = question.toLowerCase();
  const sector = detectSector(state.idea || "");
  const context = extractEnglishContext(state.idea || "", sector);
  const riskList = state.risks.length ? state.risks : buildEnglishRisks(state.idea || "", sector);

  if (lower.includes("step") || lower.includes("action") || lower.includes("30 day") || lower.includes("start") || lower.includes("execute")) {
    return buildActionPlanResponseEnglish(sector, context);
  }

  if (lower.includes("risk") || lower.includes("assumption")) {
    return `The three assumptions to test first:\n\n1. ${riskList[0].title}\nHow to test: ${riskList[0].test}\n\n2. ${riskList[1].title}\nHow to test: ${riskList[1].test}\n\n3. ${riskList[2].title}\nHow to test: ${riskList[2].test}`;
  }

  if (lower.includes("price") || lower.includes("pricing") || lower.includes("revenue")) {
    if (sector.name === "tourism") {
      return "For an eco-tourism business, start from cost per participant: guide, meals, homestay, local transport, community contribution, documentation, cleaning, and risk buffer. Test three packages first: one-day, overnight, and school/corporate group. Ask for a deposit before preparing full operations so demand is proven early.";
    }
    return "Start with three price levels: entry for quick validation, pro for recurring users, and premium for intensive help. Measure willingness to pay with pre-orders or paid pilots, not opinion surveys.";
  }

  if (lower.includes("mvp") || lower.includes("pilot") || lower.includes("first")) {
    if (sector.name === "tourism") {
      return "The lightest eco-tourism MVP is one pilot package for 10-15 participants, one safe route, one lead guide, one local meal option, a visitor ethics briefing, and a feedback form. Do not launch many packages yet. The goal is to prove itinerary, pricing, safety, and satisfaction.";
    }
    return "The lightest MVP is a landing page, one clear CTA, 10-20 customer interviews, and one manual concierge-style output. Automate only after you see repeated demand.";
  }

  const block = blocks.find((item) => blockSynonyms[item.key].some((word) => lower.includes(word)) || lower.includes(item.title.toLowerCase()));
  if (block) {
    const points = state.bmc[block.key] || [];
    return `For ${block.title}, the current direction is:\n\n${points.map((point, index) => `${index + 1}. ${point}`).join("\n")}\n\nExecution advice: ${blockActionAdviceEnglish(block, sector, context)}`;
  }

  return buildActionPlanResponseEnglish(sector, context);
}

function buildActionPlanResponseEnglish(sector, context) {
  if (sector.name === "tourism") {
    return `30-day plan to make ${context.product} in ${context.location} easier to run:\n\nWeek 1 - Local validation\n1. Meet community leaders, potential guides, homestay owners, and local SMEs.\n2. Map tourism assets, restrictions, visitor capacity, safe routes, and benefit sharing.\n3. Choose one safe pilot package.\n\nWeek 2 - Shape the offer\n1. Create one-day and overnight packages with itinerary, price, cost, margin, and risk checklist.\n2. Prepare WhatsApp Business, booking form, a simple catalog, and 10 authentic photos/videos.\n3. Draft visitor ethics briefing and bad-weather SOP.\n\nWeek 3 - Find early buyers\n1. Contact 30 targets: travel communities, campuses, schools, offices, and local creators.\n2. Offer a limited pilot trip for 10-15 people with deposit.\n3. Track chats, deposits, objections, and frequently asked questions.\n\nWeek 4 - Run pilot and improve\n1. Run the small trip, record actual costs and operational issues.\n2. Ask for Google/Instagram reviews and short video testimonials.\n3. Revise price, itinerary, SOP, and capacity before scaling promotion.\n\nMain metrics: deposits collected, margin per participant, experience rating, repeat/referral intent, and number of local people/SMEs who benefit.`;
  }

  return "30-day plan: week 1 interview 15 potential customers, week 2 create a landing page and offer, week 3 run a small pre-order or pilot, week 4 evaluate conversion, margin, and feedback, then decide whether to continue, narrow the segment, or change the value proposition.";
}

function blockActionAdviceEnglish(block, sector, context) {
  if (sector.name !== "tourism") {
    return "Turn this block into one practical decision, then validate it within 7 days through interviews, a landing page, pre-order, a small pilot, or real cost data.";
  }

  const advice = {
    customerSegments: "Start with one reachable segment, such as Jabodetabek travel communities or campuses around Banten. Build a list of 30 potential buyers and contact them directly.",
    valuePropositions: `Make the value proposition concrete: itinerary, duration, price, inclusions/exclusions, local impact, visitor rules, and why ${context.location} is different from ordinary tourism.`,
    channels: "Prioritize WhatsApp booking, Instagram/TikTok short videos, Google Maps, and community partners. First content should answer access, price, activities, safety, and visitor ethics.",
    customerRelationships: "Build trust through fast WhatsApp responses, pre-trip briefing, friendly guides, post-trip documentation, and review/referral follow-up within 24 hours.",
    revenueStreams: "Calculate cost per participant first. Build one-day, overnight, and group packages. Use deposits to prove demand before preparing food, guides, and homestays.",
    keyActivities: "The key activity is not large-scale promotion yet; validate local permission, safety SOP, package design, pilot trip, then content and partnerships.",
    keyResources: "The most important assets are community trust, local guides, cultural stories, SOPs, and authentic content. Without them, eco-tourism feels like a generic trip.",
    keyPartnerships: "Create a simple written agreement with local leaders, guides, homestays, SMEs, transport providers, and community partners so roles and benefit sharing are clear.",
    costStructure: "Separate variable cost per participant from fixed costs. This reveals the minimum participant count per trip and prevents a popular package from losing money."
  };
  return advice[block.key] || advice.keyActivities;
}

function buildActionPlanResponse(sector, context) {
  if (sector.name === "tourism") {
    return `Rencana 30 hari untuk membuat ${context.product} di ${context.location} lebih siap dijalankan:\n\nMinggu 1 - Validasi lokal\n1. Temui tokoh adat/desa, calon guide, pemilik homestay, dan UMKM lokal.\n2. Catat aset wisata, larangan, kapasitas kunjungan, rute aman, dan siapa mendapat manfaat.\n3. Pilih 1 paket pilot yang paling aman dijalankan.\n\nMinggu 2 - Bentuk produk\n1. Buat paket one-day dan overnight lengkap dengan rundown, harga, HPP, margin, dan checklist risiko.\n2. Siapkan WhatsApp Business, Google Form booking, katalog sederhana, dan 10 foto/video asli.\n3. Buat script briefing etika kunjungan dan SOP cuaca buruk.\n\nMinggu 3 - Cari pembeli awal\n1. Hubungi 30 target: komunitas traveler, kampus, sekolah, kantor, dan creator lokal.\n2. Tawarkan pilot trip terbatas 10-15 orang dengan DP.\n3. Ukur jumlah chat masuk, DP, alasan menolak, dan pertanyaan paling sering.\n\nMinggu 4 - Pilot dan perbaikan\n1. Jalankan trip kecil, rekam biaya aktual dan masalah operasional.\n2. Minta review Google/Instagram dan testimoni video pendek.\n3. Revisi harga, itinerary, SOP, dan kapasitas sebelum promosi lebih besar.\n\nMetrik utama: DP terkumpul, margin per peserta, rating pengalaman, repeat/referral intent, dan jumlah warga/UMKM yang mendapat manfaat.`;
  }

  return "Rencana 30 hari: minggu 1 wawancara 15 calon pelanggan, minggu 2 buat landing page dan penawaran, minggu 3 jalankan pre-order/pilot kecil, minggu 4 evaluasi conversion, margin, dan feedback lalu tentukan apakah lanjut, ubah segmen, atau ubah value proposition.";
}

function blockActionAdvice(block, sector, context) {
  if (sector.name !== "tourism") {
    return "Tentukan satu keputusan praktis dari blok ini, lalu validasi dalam 7 hari lewat interview, landing page, pre-order, pilot kecil, atau data biaya nyata.";
  }

  const advice = {
    customerSegments: "Mulai dari satu segmen paling mudah dijangkau, misalnya komunitas traveler Jabodetabek atau kampus sekitar Banten. Buat daftar 30 calon pembeli dan hubungi langsung.",
    valuePropositions: `Ubah value menjadi paket konkret: itinerary, durasi, harga, include/exclude, dampak untuk warga, aturan adat, dan alasan kenapa pengalaman ${context.location} berbeda dari wisata biasa.`,
    channels: "Prioritaskan WhatsApp booking, Instagram/TikTok short video, Google Maps, dan partner komunitas. Konten pertama harus menjawab akses lokasi, harga, aktivitas, keamanan, dan etika kunjungan.",
    customerRelationships: "Bangun trust lewat respons WhatsApp cepat, briefing sebelum trip, guide yang ramah, dokumentasi setelah trip, dan follow-up review/referral 24 jam setelah pulang.",
    revenueStreams: "Hitung HPP per peserta dulu. Buat paket one-day, overnight, dan grup. Targetkan DP agar demand terbukti sebelum tim menyiapkan konsumsi, guide, dan homestay.",
    keyActivities: "Aktivitas terpenting bukan promosi besar dulu, tapi validasi izin sosial, SOP keamanan, desain paket, pilot trip, lalu baru konten dan partnership.",
    keyResources: "Aset paling penting adalah kepercayaan warga, guide lokal, cerita budaya, SOP, dan konten asli. Tanpa ini, eko wisata mudah terasa seperti trip biasa.",
    keyPartnerships: "Buat kesepakatan tertulis sederhana dengan tokoh lokal, guide, homestay, UMKM, transport, dan partner komunitas agar peran serta pembagian manfaat jelas.",
    costStructure: "Pisahkan biaya variabel per peserta dan biaya tetap. Ini membantu menentukan minimum peserta per trip dan mencegah paket ramai tetapi rugi."
  };
  return advice[block.key] || advice.keyActivities;
}
function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus(t("statusVoiceUnavailable"));
    addMessage("ai", t("voiceUnsupported"));
    switchTab("chat");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = state.language === "en" ? "en-US" : "id-ID";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  setStatus(t("statusListening"));
  recognition.start();
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    els.ideaInput.value = `${els.ideaInput.value} ${transcript}`.trim();
    setStatus(t("statusVoiceCaptured"));
  };
  recognition.onerror = () => setStatus(t("statusVoiceFailed"));
  recognition.onend = () => setTimeout(() => setStatus(t("statusReady")), 1200);
}

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  if (["txt", "md"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = () => {
      els.ideaInput.value = `${els.ideaInput.value}\n\n${reader.result}`.trim();
      setStatus(t("statusFileRead"));
    };
    reader.readAsText(file);
  } else {
    els.ideaInput.value = `${els.ideaInput.value}\n\n${interpolate(t("fileContext"), { file: file.name })}`.trim();
    setStatus(t("statusFileAccepted"));
  }
}

function toMarkdown() {
  const lines = [
    "# Business Model Canvas",
    "",
    state.idea ? `${state.language === "en" ? "Business idea" : "Ide bisnis"}: ${state.idea}` : "",
    ""
  ];
  blocks.forEach((block) => {
    lines.push(`## ${block.title}`);
    (state.bmc[block.key] || []).forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  });
  lines.push(`## ${state.language === "en" ? "Risky Assumptions" : "Asumsi Berisiko"}`);
  state.risks.forEach((risk, index) => {
    lines.push(`${index + 1}. ${risk.title}`);
    lines.push(`   - ${t("whyLabel")}: ${risk.why}`);
    lines.push(`   - ${t("testLabel")}: ${risk.test}`);
  });
  return lines.filter((line, index, arr) => !(line === "" && arr[index - 1] === "")).join("\n");
}

function toStandaloneHtml() {
  const blockHtml = blocks
    .map((block) => {
      const items = (state.bmc[block.key] || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      return `<section><h2>${escapeHtml(block.title)}</h2><ul>${items}</ul></section>`;
    })
    .join("");
  const riskHtml = state.risks
    .map((risk) => `<li><strong>${escapeHtml(risk.title)}</strong><br>${escapeHtml(risk.why)}<br><em>${escapeHtml(risk.test)}</em></li>`)
    .join("");
  return `<!doctype html><html lang="${state.language}"><head><meta charset="utf-8"><title>Business Model Canvas</title><style>body{font-family:Arial,sans-serif;line-height:1.55;max-width:980px;margin:40px auto;padding:0 18px;color:#17211f}section{border:1px solid #dce4df;border-radius:8px;padding:16px;margin:12px 0}h1,h2{line-height:1.1}</style></head><body><h1>Business Model Canvas</h1><p>${escapeHtml(state.idea || "")}</p>${blockHtml}<section><h2>${state.language === "en" ? "Risky Assumptions" : "Asumsi Berisiko"}</h2><ol>${riskHtml}</ol></section></body></html>`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(t("statusExportReady"));
}

function renderSocialControls() {
  els.topicRow.innerHTML = "";
  getTopics().forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `topic-chip${topic === state.selectedTopic ? " active" : ""}`;
    button.textContent = topic;
    button.addEventListener("click", () => {
      state.selectedTopic = topic;
      els.topicInput.value = topic;
      renderSocialControls();
    });
    els.topicRow.append(button);
  });

  els.platformRow.innerHTML = "";
  platforms.forEach((platform) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `platform-toggle${state.selectedPlatforms.has(platform) ? " active" : ""}`;
    button.textContent = platform;
    button.addEventListener("click", () => {
      if (state.selectedPlatforms.has(platform)) state.selectedPlatforms.delete(platform);
      else state.selectedPlatforms.add(platform);
      if (state.selectedPlatforms.size === 0) state.selectedPlatforms.add(platform);
      renderSocialControls();
    });
    els.platformRow.append(button);
  });
}

function generatePosts() {
  const topic = els.topicInput.value.trim() || state.selectedTopic || getTopics()[0];
  const selected = Array.from(state.selectedPlatforms);
  const templates = state.language === "en"
    ? [
        {
          hook: "Many businesses fail not because the idea is bad, but because the model is unclear.",
          angle: "Use the BMC to see customers, value, channels, and revenue on one page.",
          cta: "Write one idea today, then turn it into 9 blocks."
        },
        {
          hook: "One question often saves founders money: who is the most specific first customer?",
          angle: "BMC forces you to choose a segment instead of chasing everyone.",
          cta: "Start with the narrowest segment, then validate it through interviews."
        },
        {
          hook: "Revenue stream is not just price.",
          angle: "You can test subscriptions, one-off outputs, commission, bundles, or premium consulting.",
          cta: "Choose the easiest one to test this week."
        },
        {
          hook: "A strong value proposition sounds like a solution to a real problem.",
          angle: "If customers cannot describe the problem, even the best copywriting will struggle.",
          cta: "Ask customers: when did this problem last happen?"
        },
        {
          hook: "The best BMC is not a final document. It is an experiment map.",
          angle: "Every block needs evidence: clicks, signups, pre-orders, repeat orders, or referrals.",
          cta: "Pick one riskiest assumption and test it in 7 days."
        }
      ]
    : [
        {
          hook: "Banyak bisnis gagal bukan karena idenya jelek, tapi karena modelnya belum jelas.",
          angle: "Pakai BMC untuk melihat pelanggan, nilai, channel, dan revenue dalam satu halaman.",
          cta: "Tulis satu ide Anda hari ini, lalu ubah menjadi 9 blok."
        },
        {
          hook: "Satu pertanyaan yang sering menghemat biaya founder: siapa pelanggan pertama yang paling spesifik?",
          angle: "BMC memaksa kita memilih segmen, bukan mengejar semua orang.",
          cta: "Mulai dari segmen paling sempit, lalu validasi dengan wawancara."
        },
        {
          hook: "Revenue stream bukan sekadar harga.",
          angle: "Anda bisa menguji langganan, paket output, komisi, bundling, atau konsultasi premium.",
          cta: "Pilih satu yang paling mudah diuji minggu ini."
        },
        {
          hook: "Value proposition yang kuat terdengar seperti solusi untuk masalah nyata.",
          angle: "Jika pelanggan tidak bisa menyebutkan masalahnya, copywriting terbaik pun sulit menjual.",
          cta: "Tanya pelanggan: kapan terakhir kali masalah ini terjadi?"
        },
        {
          hook: "BMC terbaik bukan dokumen final. Ia adalah peta eksperimen.",
          angle: "Setiap blok perlu bukti: klik, signup, pre-order, repeat order, atau referral.",
          cta: "Tentukan satu asumsi paling berisiko dan uji dalam 7 hari."
        }
      ];

  return templates.map((template, index) => {
    const platform = selected[index % selected.length] || "LinkedIn";
    return {
      platform,
      title: `${platform} - ${topic}`,
      caption: adaptCaption(platform, template, topic),
      hashtags: hashtagsFor(platform),
      image: imageSuggestion(platform, topic),
      time: bestTime(platform, index)
    };
  });
}

function adaptCaption(platform, template, topic) {
  if (platform === "X") {
    const topicLabel = state.language === "en" ? "Topic" : "Topik";
    return `${template.hook}\n\n${topicLabel}: ${topic}.\n${template.cta}`;
  }
  if (platform === "TikTok") {
    if (state.language === "en") {
      return `First 3 seconds: "${template.hook}"\nBody: ${template.angle}\nCTA: ${template.cta}`;
    }
    return `Opening 3 detik: "${template.hook}"\nIsi: ${template.angle}\nCTA: ${template.cta}`;
  }
  if (platform === "LinkedIn") {
    if (state.language === "en") {
      return `${template.hook}\n\nToday topic: ${topic}.\n\n${template.angle}\n\n${template.cta} Share one business assumption you are testing.`;
    }
    return `${template.hook}\n\nTopik hari ini: ${topic}.\n\n${template.angle}\n\n${template.cta} Bagikan satu asumsi bisnis yang sedang Anda uji.`;
  }
  return `${template.hook}\n\n${template.angle}\n\n${template.cta}`;
}

function hashtagsFor(platform) {
  const base = state.language === "en"
    ? ["#BusinessModelCanvas", "#BMC", "#Entrepreneurship", "#SmallBusiness"]
    : ["#BusinessModelCanvas", "#BMC", "#Entrepreneurship", "#UMKM"];
  if (platform === "LinkedIn") return [...base, state.language === "en" ? "#Startup" : "#StartupIndonesia"].join(" ");
  if (platform === "TikTok") return [...base, state.language === "en" ? "#BusinessTips" : "#BelajarBisnis", "#FounderTips"].join(" ");
  if (platform === "X") return ["#BMC", "#Startup", state.language === "en" ? "#Business" : "#Bisnis"].join(" ");
  return [...base, state.language === "en" ? "#BusinessIdeas" : "#IdeBisnis"].join(" ");
}

function imageSuggestion(platform, topic) {
  if (state.language === "en") {
    if (platform === "TikTok") return `20-30 second video: founder placing sticky notes for the 9 BMC blocks with overlay text "${topic}".`;
    if (platform === "Instagram") return "5-slide carousel: problem, 9 blocks, short example, risky assumption, CTA to create a BMC.";
    if (platform === "LinkedIn") return "Clean one-page diagram comparing a raw idea with a test-ready BMC.";
    return "Simple BMC grid visual with the discussed block highlighted.";
  }

  if (platform === "TikTok") return `Video 20-30 detik: founder menempel sticky notes 9 blok BMC sambil teks overlay "${topic}".`;
  if (platform === "Instagram") return "Carousel 5 slide: problem, 9 blok, contoh singkat, asumsi risiko, CTA buat BMC.";
  if (platform === "LinkedIn") return "Diagram bersih satu halaman yang membandingkan ide mentah vs BMC siap diuji.";
  return "Visual ringkas BMC grid dengan highlight pada blok yang dibahas.";
}

function bestTime(platform, index) {
  const times = state.language === "en"
    ? {
        Instagram: ["Tuesday 19:30", "Thursday 12:15"],
        LinkedIn: ["Wednesday 08:30", "Tuesday 10:00"],
        X: ["Monday 12:00", "Friday 17:30"],
        TikTok: ["Thursday 20:00", "Sunday 18:30"],
        Facebook: ["Saturday 10:00", "Wednesday 19:00"]
      }
    : {
        Instagram: ["Selasa 19:30", "Kamis 12:15"],
        LinkedIn: ["Rabu 08:30", "Selasa 10:00"],
        X: ["Senin 12:00", "Jumat 17:30"],
        TikTok: ["Kamis 20:00", "Minggu 18:30"],
        Facebook: ["Sabtu 10:00", "Rabu 19:00"]
      };
  const list = times[platform] || [state.language === "en" ? "Wednesday 09:00" : "Rabu 09:00"];
  return list[index % list.length];
}
function renderPosts(posts) {
  state.socialPosts = posts;
  els.postBoard.innerHTML = "";
  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "post-card";
    article.innerHTML = `
      <header>
        <h3>${escapeHtml(post.title)}</h3>
        <span class="platform-badge">${escapeHtml(post.platform)}</span>
      </header>
      <p>${escapeHtml(post.caption).replace(/\n/g, "<br>")}</p>
      <div class="post-meta">
        <span><strong>${t("socialHashtags")}:</strong> ${escapeHtml(post.hashtags)}</span>
        <span><strong>${t("socialVisual")}:</strong> ${escapeHtml(post.image)}</span>
        <span><strong>${t("socialSchedule")}:</strong> ${escapeHtml(post.time)}</span>
      </div>
    `;
    els.postBoard.append(article);
  });
}

function updateAdminVisibility() {
  const canOpenAdmin = hasAdminIntent();
  const unlocked = isKnowledgeAdmin();
  if (els.knowledgeSection) els.knowledgeSection.hidden = !canOpenAdmin;
  if (els.knowledgeNav) els.knowledgeNav.hidden = !unlocked;
  if (els.adminGate) els.adminGate.hidden = !canOpenAdmin || unlocked;
  if (els.knowledgeWorkbench) els.knowledgeWorkbench.hidden = !unlocked;
}

function unlockAdminKnowledge(event) {
  event.preventDefault();
  const key = els.adminKeyInput?.value.trim() || "";
  if (!key) {
    setAdminGateStatus(t("adminKeyMissing"));
    return;
  }
  sessionStorage.setItem(ADMIN_SESSION_KEY, key);
  setAdminGateStatus(t("adminUnlocked"));
  updateAdminVisibility();
  loadKnowledgeSources();
}

function logoutAdminKnowledge() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  if (els.adminKeyInput) els.adminKeyInput.value = "";
  setAdminGateStatus(t("adminLocked"));
  updateAdminVisibility();
}

function setAdminGateStatus(message) {
  if (!els.adminGateStatus) return;
  els.adminGateStatus.dataset.custom = message === t("adminLocked") ? "" : "true";
  els.adminGateStatus.textContent = message;
}
async function loadKnowledgeFile() {
  if (!isKnowledgeAdmin()) return;
  const file = els.knowledgeFile?.files?.[0];
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["txt", "md"].includes(ext)) {
    setKnowledgeStatus(t("knowledgeUnsupportedFile"));
    return;
  }
  const content = await file.text();
  els.knowledgeContent.value = content;
  if (!els.knowledgeTitle.value.trim()) els.knowledgeTitle.value = file.name.replace(/\.[^.]+$/, "");
  setKnowledgeStatus(interpolate(t("knowledgeFileReady"), { file: file.name }));
}

async function uploadKnowledge(event) {
  event.preventDefault();
  if (!isKnowledgeAdmin()) {
    setKnowledgeStatus(t("adminLocked"));
    return;
  }
  if (!hasBackendConfig()) {
    setKnowledgeStatus(t("backendConfigMissing"));
    return;
  }

  try {
    const file = els.knowledgeFile?.files?.[0];
    const payload = {
      title: els.knowledgeTitle.value,
      author: els.knowledgeAuthor.value,
      year: els.knowledgeYear.value,
      tags: els.knowledgeTags.value,
      language: state.language,
      fileName: file?.name || "",
      content: els.knowledgeContent.value
    };
    const result = await requestBackend("/api/knowledge/upload", payload, { admin: true });
    setKnowledgeStatus(interpolate(t("knowledgeSaved"), { title: result.source.title, chunks: result.chunks }));
    els.knowledgeForm.reset();
    await loadKnowledgeSources();
  } catch (error) {
    setKnowledgeStatus(interpolate(t("knowledgeUploadFailed"), { message: error.message }));
  }
}

async function loadKnowledgeSources() {
  if (!els.knowledgeList || !isKnowledgeAdmin()) return;
  if (!hasBackendConfig()) {
    els.knowledgeList.innerHTML = `<article class="knowledge-item"><h3>${t("knowledgeBackendInactiveTitle")}</h3><p>${t("knowledgeBackendInactiveBody")}</p></article>`;
    return;
  }

  try {
    const data = await requestBackend("/api/knowledge/sources", { language: state.language }, { admin: true });
    renderKnowledgeSources(data.sources || []);
  } catch (error) {
    els.knowledgeList.innerHTML = `<article class="knowledge-item"><h3>${t("knowledgeUnavailableTitle")}</h3><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function renderKnowledgeSources(sources) {
  if (!sources.length) {
    els.knowledgeList.innerHTML = `<article class="knowledge-item"><h3>${t("knowledgeNoSourcesTitle")}</h3><p>${t("knowledgeNoSourcesBody")}</p></article>`;
    return;
  }

  els.knowledgeList.innerHTML = sources.map((source) => `
    <article class="knowledge-item">
      <h3>${escapeHtml(source.title)}</h3>
      <p>${escapeHtml([source.author, source.year].filter(Boolean).join(" - ") || t("curatedSourceFallback"))} � ${source.chunks} chunk � ${escapeHtml(source.language || "id")}</p>
      <p>${escapeHtml((source.tags || []).join(", "))}</p>
    </article>
  `).join("");
}

function setKnowledgeStatus(message) {
  if (!els.knowledgeStatus) return;
  els.knowledgeStatus.dataset.custom = message === t("knowledgeStatusReady") ? "" : "true";
  els.knowledgeStatus.textContent = message;
}

function setDefaultSchedule() {
  if (!els.scheduleAt || els.scheduleAt.value) return;
  const date = new Date(Date.now() + 30 * 60 * 1000);
  date.setSeconds(0, 0);
  els.scheduleAt.value = toDatetimeLocal(date);
}

async function saveSocialDrafts() {
  if (!hasBackendConfig()) {
    setSocialStatus(t("backendConfigMissing"));
    return;
  }
  try {
    const data = await requestBackend("/api/social/save", { posts: state.socialPosts });
    setSocialStatus(interpolate(t("socialDraftsSaved"), { count: data.count }));
    await loadSocialQueue();
  } catch (error) {
    setSocialStatus(interpolate(t("socialDraftSaveFailed"), { message: error.message }));
  }
}

async function scheduleSocialPosts() {
  if (!hasBackendConfig()) {
    setSocialStatus(t("backendConfigMissing"));
    return;
  }
  try {
    const data = await requestBackend("/api/social/schedule", {
      posts: state.socialPosts,
      scheduledAt: els.scheduleAt.value ? new Date(els.scheduleAt.value).toISOString() : undefined
    });
    setSocialStatus(interpolate(t("socialScheduled"), { count: data.count }));
    await loadSocialQueue();
  } catch (error) {
    setSocialStatus(interpolate(t("socialScheduleFailed"), { message: error.message }));
  }
}

async function publishDuePosts() {
  if (!hasBackendConfig()) {
    setSocialStatus(t("backendConfigMissing"));
    return;
  }
  try {
    const data = await requestBackend("/api/social/publish-due", {});
    setSocialStatus(interpolate(t("socialPublishProcessed"), { count: data.processed }));
    await loadSocialQueue();
  } catch (error) {
    setSocialStatus(interpolate(t("socialPublishFailed"), { message: error.message }));
  }
}

async function loadSocialQueue() {
  if (!els.socialQueue) return;
  if (!hasBackendConfig()) {
    els.socialQueue.innerHTML = `<article class="queue-item"><h3>${t("socialQueueInactiveTitle")}</h3><p>${t("socialQueueInactiveBody")}</p></article>`;
    return;
  }
  try {
    const data = await requestBackend("/api/social/list", { limit: 8 });
    renderSocialQueue(data.posts || []);
  } catch (error) {
    els.socialQueue.innerHTML = `<article class="queue-item"><h3>${t("socialQueueUnavailableTitle")}</h3><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function renderSocialQueue(posts) {
  if (!posts.length) {
    els.socialQueue.innerHTML = `<article class="queue-item"><h3>${t("socialNoScheduleTitle")}</h3><p>${t("socialNoScheduleBody")}</p></article>`;
    return;
  }

  els.socialQueue.innerHTML = posts.map((post) => `
    <article class="queue-item">
      <h3>${escapeHtml(post.platform)} � ${escapeHtml(post.status)}</h3>
      <p>${escapeHtml(post.title || post.caption).slice(0, 140)}</p>
      <p>${post.scheduledAt ? escapeHtml(new Date(post.scheduledAt).toLocaleString()) : t("socialDraftLabel")}</p>
    </article>
  `).join("");
}

function setSocialStatus(message) {
  if (!els.socialStatus) return;
  els.socialStatus.dataset.custom = message === t("socialStatusReady") ? "" : "true";
  els.socialStatus.textContent = message;
}

function toDatetimeLocal(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function formatChatText(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
