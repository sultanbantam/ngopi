import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { coffee } from '../../src/theme/coffee';
import { API_URL, getStoredToken } from '../../src/utils/session';
import { payWithPi } from '../../src/utils/piSdk';

interface LibraryWork {
  id: string;
  author_id: string;
  author_username: string;
  author_name: string;
  title: string;
  synopsis: string;
  category: string;
  cover_emoji: string;
  views_count: number;
  total_tip_points: number;
  ai_score?: number;
  ai_grade?: string | null;
  ai_feedback?: string | null;
  points_awarded?: number;
  created_at: string;
  _count?: { chapters: number; tips: number };
  chapters?: LibraryChapter[];
}

interface LibraryChapter {
  id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  created_at: string;
}

const CATEGORIES = [
  { key: 'all', label: 'Semua' },
  { key: 'fiksi', label: 'Fiksi' },
  { key: 'novel', label: 'Novel' },
  { key: 'cerita', label: 'Cerita' },
  { key: 'dongeng', label: 'Dongeng' },
  { key: 'diary', label: 'Diary' },
  { key: 'esai', label: 'Esai' },
  { key: 'puisi', label: 'Puisi' },
  { key: 'edukasi', label: 'Edukasi' },
  { key: 'komunitas', label: 'Komunitas' },
];

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
};

export default function PustakaScreen() {
  const [tab, setTab] = useState<'library' | 'studio'>('library');
  const [works, setWorks] = useState<LibraryWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Reader modal state
  const [selectedWork, setSelectedWork] = useState<LibraryWork | null>(null);
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(0);
  const [tipAmount, setTipAmount] = useState('50');
  const [tipSending, setTipSending] = useState(false);

  // Add chapter modal state
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);

  // Publish new work state
  const [newTitle, setNewTitle] = useState('');
  const [newSynopsis, setNewSynopsis] = useState('');
  const [newCategory, setNewCategory] = useState('fiksi');
  const [newEmoji, setNewEmoji] = useState('📖');
  const [firstChapterTitle, setFirstChapterTitle] = useState('Bab 1');
  const [firstChapterContent, setFirstChapterContent] = useState('');
  const [publishing, setPublishing] = useState(false);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/library/works`, {
        params: {
          category: category !== 'all' ? category : undefined,
          q: searchQuery.trim() || undefined,
        },
      });
      setWorks(res.data?.works || []);
    } catch {
      setWorks([]);
    } finally {
      setLoading(false);
    }
  }, [category, searchQuery]);

  useEffect(() => {
    loadWorks();
    if (Platform.OS === 'web') {
      setCurrentUserId(localStorage.getItem('userId') || '');
    }
  }, [loadWorks]);

  const openWorkReader = async (workId: string) => {
    try {
      const res = await axios.get(`${API_URL}/library/works/${workId}`);
      if (res.data?.work) {
        setSelectedWork(res.data.work);
        setSelectedChapterIdx(0);
      }
    } catch {
      showAlert('Gagal', 'Tidak dapat membuka karya ini.');
    }
  };

  const handlePublishWork = async () => {
    if (!newTitle.trim() || !newSynopsis.trim()) {
      showAlert('Lengkapi Data', 'Judul karya dan sinopsis wajib diisi.');
      return;
    }
    setPublishing(true);
    try {
      const token = await getStoredToken();
      const res = await axios.post(
        `${API_URL}/library/works`,
        {
          title: newTitle.trim(),
          synopsis: newSynopsis.trim(),
          category: newCategory,
          cover_emoji: newEmoji.trim() || '📚',
          first_chapter_title: firstChapterTitle.trim() || 'Bab 1',
          first_chapter_content: firstChapterContent.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const ev = res.data?.evaluation;
      const evalDetail = ev
        ? `\n\n🤖 Rapor AI (${ev.evaluatorMode === 'llm_verified' ? 'LLM + Rubrik Objektif' : 'Rubrik Objektif'}):\n• Skor: ${ev.score}/100 (Grade ${ev.grade} — ${ev.tierLabel})\n• Substansi: ${ev.breakdown?.substance}/25 | Diksi: ${ev.breakdown?.vocabulary}/20 | Struktur: ${ev.breakdown?.structure}/20\n• Koherensi: ${ev.breakdown?.coherence}/20 | Kedalaman: ${ev.breakdown?.depth}/15\n• Reward: +${ev.pointsAwarded} Poin Ngopi\n• Catatan: ${ev.feedback}`
        : '';
      showAlert('Karya Terbit & Tervalidasi AI!', `${res.data?.message || 'Karya Anda kini tersedia di Perpustakaan Ngopi.'}${evalDetail}`);
      setNewTitle('');
      setNewSynopsis('');
      setFirstChapterTitle('Bab 1');
      setFirstChapterContent('');
      setTab('library');
      loadWorks();
    } catch (err: any) {
      showAlert('Gagal Terbit', err?.response?.data?.error || 'Terjadi kesalahan saat menerbitkan karya.');
    } finally {
      setPublishing(false);
    }
  };

  const handleAddChapter = async () => {
    if (!selectedWork || !chapterTitle.trim() || !chapterContent.trim()) {
      showAlert('Lengkapi Bab', 'Judul bab dan isi tulisan wajib diisi.');
      return;
    }
    setAddingChapter(true);
    try {
      const token = await getStoredToken();
      const res = await axios.post(
        `${API_URL}/library/works/${selectedWork.id}/chapters`,
        { title: chapterTitle.trim(), content: chapterContent.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showAlert('Bab Ditambahkan', res.data?.message || 'Bab baru berhasil disimpan.');
      setChapterTitle('');
      setChapterContent('');
      openWorkReader(selectedWork.id);
    } catch (err: any) {
      showAlert('Gagal', err?.response?.data?.error || 'Tidak dapat menambah bab.');
    } finally {
      setAddingChapter(false);
    }
  };

  const handleSendTip = async () => {
    if (!selectedWork) return;
    const amt = Math.floor(Number(tipAmount || 0));
    if (amt < 10) {
      showAlert('Minimal 10 Poin', 'Masukkan jumlah tip minimal 10 Poin Ngopi.');
      return;
    }
    setTipSending(true);
    try {
      const token = await getStoredToken();
      const res = await axios.post(
        `${API_URL}/library/works/${selectedWork.id}/tip`,
        { amount: amt },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showAlert('Apresiasi Terkirim!', res.data?.message || 'Tip Poin berhasil dikirim ke penulis.');
      setSelectedWork((prev) =>
        prev ? { ...prev, total_tip_points: res.data?.total_tip_points ?? prev.total_tip_points + amt } : prev
      );
      loadWorks();
    } catch (err: any) {
      showAlert('Gagal Kirim Tip', err?.response?.data?.error || 'Saldo tidak cukup atau terjadi kesalahan.');
    } finally {
      setTipSending(false);
    }
  };

  const handleSendPiTip = async () => {
    if (!selectedWork) return;
    setTipSending(true);
    try {
      await payWithPi({
        amount: 1,
        memo: `Tip Penulis @${selectedWork.author_username}: ${selectedWork.title}`,
        metadata: {
          type: 'ngopi_library_tip',
          workId: selectedWork.id,
          userId: currentUserId || undefined,
        },
      });
      showAlert('Tip Pi Terkirim!', `1 Test-Pi (+1.000 Poin ekuivalen) berhasil dikirim ke @${selectedWork.author_username}!`);
      setSelectedWork((prev) =>
        prev ? { ...prev, total_tip_points: prev.total_tip_points + 1000 } : prev
      );
      loadWorks();
    } catch (err: any) {
      showAlert('Tip Pi Dibatalkan / Gagal', err?.message || 'Gagal memproses Tip Pi.');
    } finally {
      setTipSending(false);
    }
  };

  const chapters = selectedWork?.chapters || [];
  const activeChapter = chapters[selectedChapterIdx];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: '#D4AF37', fontWeight: '700' }}>← Kembali</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📚 Ngopi Pustaka</Text>
          <Text style={styles.headerSub}>Perpustakaan Komunitas & Studio Penulis</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'library' && styles.tabBtnActive]}
          onPress={() => setTab('library')}
        >
          <Text style={[styles.tabText, tab === 'library' && styles.tabTextActive]}>📚 Perpustakaan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'studio' && styles.tabBtnActive]}
          onPress={() => setTab('studio')}
        >
          <Text style={[styles.tabText, tab === 'studio' && styles.tabTextActive]}>✍️ Studio Penulis</Text>
        </TouchableOpacity>
      </View>

      {tab === 'library' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <TextInput
            style={styles.input}
            placeholder="Cari judul buku, esai, puisi, atau nama penulis..."
            placeholderTextColor={coffee.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={loadWorks}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[styles.catChip, category === c.key && styles.catChipActive]}
                >
                  <Text style={[styles.catText, category === c.key && styles.catTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {loading ? (
            <ActivityIndicator color="#D4AF37" style={{ marginTop: 32 }} />
          ) : works.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: '#F5ECE2', fontWeight: '700', fontSize: 15, marginBottom: 6 }}>
                Belum ada karya di kategori ini
              </Text>
              <Text style={{ color: coffee.secondary, fontSize: 13, textAlign: 'center', marginBottom: 14 }}>
                Jadilah penulis pertama yang menerbitkan cerita, esai, atau puisi di Ngopi Pustaka!
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setTab('studio')}>
                <Text style={styles.primaryBtnText}>✍️ Mulai Menulis</Text>
              </TouchableOpacity>
            </View>
          ) : (
            works.map((w) => (
              <TouchableOpacity key={w.id} style={styles.workCard} onPress={() => openWorkReader(w.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 32 }}>{w.cover_emoji || '📚'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workTitle}>{w.title}</Text>
                    <Text style={styles.workMeta}>
                      oleh {w.author_name} (@{w.author_username}) • {w.category.toUpperCase()}
                    </Text>
                    <Text style={styles.workSynopsis} numberOfLines={2}>
                      {w.synopsis}
                    </Text>
                    <Text style={styles.workStats}>
                      📖 {w._count?.chapters ?? 0} Bab  •  👁 {w.views_count} Dibaca  •  ⭐ {w.total_tip_points} Poin Tip
                      {w.ai_score ? `  •  🤖 AI ${w.ai_grade || ''} (${w.ai_score}/100)` : ''}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.studioCard}>
            <Text style={styles.studioHeading}>✍️ Terbitkan Karya (Validasi AI: 50 – 1.500 Poin Ngopi)</Text>
            <Text style={styles.studioSub}>
              Setiap naskah dinilai otomatis & objektif oleh AI berdasarkan substansi, kekayaan diksi, struktur, koherensi, dan kedalaman. Grade S (90–100): 800–1.500 Poin • Grade A (75–89): 400–750 Poin • Grade B (55–74): 150–350 Poin • Grade C (35–54): 50–120 Poin. Tulisan spam/asal mendapat 0 Poin.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Judul Karya"
              placeholderTextColor={coffee.muted}
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[styles.input, { width: 80, textAlign: 'center' }]}
                placeholder="📚"
                placeholderTextColor={coffee.muted}
                value={newEmoji}
                onChangeText={setNewEmoji}
                maxLength={4}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => setNewCategory(c.key)}
                      style={[styles.catChip, newCategory === c.key && styles.catChipActive]}
                    >
                      <Text style={[styles.catText, newCategory === c.key && styles.catTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Sinopsis / ringkasan singkat karya Anda..."
              placeholderTextColor={coffee.muted}
              value={newSynopsis}
              onChangeText={setNewSynopsis}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="Judul Bab 1 (opsional)"
              placeholderTextColor={coffee.muted}
              value={firstChapterTitle}
              onChangeText={setFirstChapterTitle}
            />
            <TextInput
              style={[styles.input, { minHeight: 160, textAlignVertical: 'top' }]}
              placeholder="Tulis isi Bab 1 di sini..."
              placeholderTextColor={coffee.muted}
              value={firstChapterContent}
              onChangeText={setFirstChapterContent}
              multiline
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handlePublishWork} disabled={publishing}>
              {publishing ? (
                <ActivityIndicator color="#1B130E" />
              ) : (
                <Text style={styles.primaryBtnText}>🚀 Terbitkan ke Perpustakaan</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Reader & Author Chapter Modal */}
      <Modal
        visible={Boolean(selectedWork)}
        animationType="slide"
        onRequestClose={() => setSelectedWork(null)}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedWork(null)} style={styles.backBtn}>
              <Text style={{ color: '#D4AF37', fontWeight: '700' }}>✕ Tutup</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {selectedWork?.cover_emoji} {selectedWork?.title}
              </Text>
              <Text style={styles.headerSub}>
                oleh {selectedWork?.author_name} (@{selectedWork?.author_username})
              </Text>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={{ color: coffee.secondary, fontSize: 13, marginBottom: 12 }}>
              {selectedWork?.synopsis}
            </Text>

            {/* Chapter selector */}
            {chapters.length > 0 ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {chapters.map((ch, idx) => (
                      <TouchableOpacity
                        key={ch.id}
                        onPress={() => setSelectedChapterIdx(idx)}
                        style={[styles.catChip, selectedChapterIdx === idx && styles.catChipActive]}
                      >
                        <Text style={[styles.catText, selectedChapterIdx === idx && styles.catTextActive]}>
                          Bab {ch.chapter_number}: {ch.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {activeChapter ? (
                  <View style={styles.readerBox}>
                    <Text style={{ color: '#D4AF37', fontSize: 16, fontWeight: '800', marginBottom: 8 }}>
                      Bab {activeChapter.chapter_number}: {activeChapter.title}
                    </Text>
                    <Text style={{ color: '#F5ECE2', fontSize: 15, lineHeight: 24 }}>
                      {activeChapter.content}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={{ color: coffee.muted, fontStyle: 'italic', marginBottom: 16 }}>
                Penulis belum menambahkan bab pada karya ini.
              </Text>
            )}

            {/* Tip author */}
            {selectedWork && selectedWork.author_id !== currentUserId ? (
              <View style={[styles.studioCard, { marginTop: 16 }]}>
                <Text style={{ color: '#D4AF37', fontWeight: '800', marginBottom: 6 }}>
                  ⭐ Apresiasi Penulis dengan Poin Ngopi
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={tipAmount}
                    onChangeText={setTipAmount}
                    keyboardType="number-pad"
                    placeholder="Jumlah Poin (min 10)"
                    placeholderTextColor={coffee.muted}
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, { paddingHorizontal: 16 }]}
                    onPress={handleSendTip}
                    disabled={tipSending}
                  >
                    <Text style={styles.primaryBtnText}>{tipSending ? '...' : 'Kirim Tip'}</Text>
                  </TouchableOpacity>
                </View>
                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    onPress={handleSendPiTip}
                    disabled={tipSending}
                    style={{
                      marginTop: 10,
                      backgroundColor: '#3B1E54',
                      borderWidth: 1,
                      borderColor: '#A855F7',
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#FDE047', fontWeight: '800', fontSize: 13 }}>
                      π Tip Penulis dengan 1 Test-Pi (+1.000 Poin)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Author: Add new chapter */}
            {selectedWork && selectedWork.author_id === currentUserId ? (
              <View style={[styles.studioCard, { marginTop: 16 }]}>
                <Text style={{ color: '#D4AF37', fontWeight: '800', marginBottom: 8 }}>
                  ➕ Tambah Bab Baru
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Judul Bab"
                  placeholderTextColor={coffee.muted}
                  value={chapterTitle}
                  onChangeText={setChapterTitle}
                />
                <TextInput
                  style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
                  placeholder="Isi bab baru..."
                  placeholderTextColor={coffee.muted}
                  value={chapterContent}
                  onChangeText={setChapterContent}
                  multiline
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleAddChapter} disabled={addingChapter}>
                  <Text style={styles.primaryBtnText}>
                    {addingChapter ? 'Menyimpan...' : 'Simpan Bab Baru'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#120D0A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2118',
    backgroundColor: '#1B130E',
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#4A3728',
  },
  headerTitle: { color: '#F5ECE2', fontSize: 18, fontWeight: '800' },
  headerSub: { color: coffee.secondary, fontSize: 12 },
  tabRow: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#16100C' },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#261C15',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A2A1E',
  },
  tabBtnActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  tabText: { color: coffee.secondary, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#1B130E' },
  input: {
    backgroundColor: '#1E1510',
    borderWidth: 1,
    borderColor: '#3A2A1E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F5ECE2',
    marginBottom: 10,
    fontSize: 14,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#3A2A1E',
  },
  catChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  catText: { color: coffee.secondary, fontSize: 12, fontWeight: '700' },
  catTextActive: { color: '#1B130E' },
  workCard: {
    backgroundColor: '#1B130E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3A2A1E',
  },
  workTitle: { color: '#F5ECE2', fontSize: 16, fontWeight: '800' },
  workMeta: { color: '#D4AF37', fontSize: 11, fontWeight: '700', marginTop: 2, marginBottom: 4 },
  workSynopsis: { color: coffee.secondary, fontSize: 13, lineHeight: 18 },
  workStats: { color: coffee.muted, fontSize: 11, marginTop: 6 },
  emptyCard: {
    backgroundColor: '#1B130E',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A2A1E',
  },
  studioCard: {
    backgroundColor: '#1B130E',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3A2A1E',
  },
  studioHeading: { color: '#D4AF37', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  studioSub: { color: coffee.secondary, fontSize: 12, marginBottom: 12 },
  readerBox: {
    backgroundColor: '#1B130E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3A2A1E',
  },
  primaryBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#1B130E', fontWeight: '800', fontSize: 14 },
});
