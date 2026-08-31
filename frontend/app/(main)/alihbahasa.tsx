import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface TranscriptItem {
  id: string;
  speaker: string;
  sourceText: string;
  translatedText: string;
  startMs: number;
  confidence: number;
}

export default function AlihBahasaScreen() {
  const [meetingTitle, setMeetingTitle] = useState('Rapat Koordinasi BambooChat');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [sourceLang, setSourceLang] = useState('id-ID');
  const [targetLang, setTargetLang] = useState('en-US');
  const [activeProvider, setActiveProvider] = useState<'openai' | 'google'>('openai');

  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [partialText, setPartialText] = useState('');
  const [partialTranslation, setPartialTranslation] = useState('');
  const [waveform, setWaveform] = useState<number[]>(new Array(24).fill(10));
  const [activeTab, setActiveTab] = useState<'live' | 'notulen'>('live');
  const [notulenTab, setNotulenTab] = useState<'summary' | 'decisions' | 'actions'>('summary');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const simIndexRef = useRef(0);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sampleDemoPhrases = [
    {
      id: 'Selamat datang di fitur Alih Bahasa resmi di dalam aplikasi BambooChat.',
      en: 'Welcome to the official Alih Bahasa feature inside the BambooChat application.',
      ja: 'BambooChatアプリ内の公式Alih Bahasa機能へようこそ。',
      zh: '欢迎使用BambooChat应用内的官方Alih Bahasa功能。',
    },
    {
      id: 'Fitur ini memungkinkan transkripsi suara real-time dan penerjemahan multibahasa otomatis.',
      en: 'This feature enables real-time speech transcription and automatic multilingual translation.',
      ja: 'この機能により、リアルタイムの音声文字起こしと自動多言語翻訳が可能になります。',
      zh: '该功能支持实时语音转录和自动多语言翻译。',
    },
    {
      id: 'Keputusan Rapat: Mengintegrasikan notulen cerdas dan ekspor format Markdown ke obrolan.',
      en: 'Meeting Decision: Integrating smart meeting minutes and Markdown export into chat.',
      ja: '会議決定事項：スマート議事録とMarkdownエクスポートをチャットに統合します。',
      zh: '会议决定：将智能会议纪要和Markdown导出整合到聊天中。',
    },
    {
      id: 'Tindak lanjut: Tim pengembang akan merilis update ini ke seluruh pengguna bamboochat.click.',
      en: 'Action item: The developer team will release this update to all bamboochat.click users.',
      ja: 'アクションアイテム：開発チームはこのアップデートをbamboochat.clickの全ユーザーにリリースします。',
      zh: '跟进事项：开发团队将把此更新推送给bamboochat.click的所有用户。',
    },
  ];

  // Timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setDurationSec((prev) => prev + 1);
        // Animate waveform
        setWaveform(new Array(24).fill(0).map(() => Math.floor(Math.random() * 80) + 15));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (!isRecording) setWaveform(new Array(24).fill(10));
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  const scheduleNextSimPhrase = useCallback(() => {
    const phraseObj = sampleDemoPhrases[simIndexRef.current % sampleDemoPhrases.length]!;
    simIndexRef.current += 1;

    const words = phraseObj.id.split(' ');
    let currentIdx = 0;
    let currText = '';

    simIntervalRef.current = setInterval(() => {
      if (currentIdx < words.length) {
        currText += (currText ? ' ' : '') + words[currentIdx];
        setPartialText(currText);
        setPartialTranslation(phraseObj.en.slice(0, Math.min(phraseObj.en.length, (currentIdx + 1) * 12)) + '...');
        currentIdx++;
      } else {
        if (simIntervalRef.current) clearInterval(simIntervalRef.current);
        const newItem: TranscriptItem = {
          id: 'item_' + Date.now(),
          speaker: simIndexRef.current % 2 === 1 ? 'Pembicara 1' : 'Pembicara 2',
          sourceText: phraseObj.id,
          translatedText: targetLang === 'ja-JP' ? phraseObj.ja : targetLang === 'zh-CN' ? phraseObj.zh : phraseObj.en,
          startMs: (simIndexRef.current - 1) * 5000,
          confidence: 0.97,
        };
        setItems((prev) => [...prev, newItem]);
        setPartialText('');
        setPartialTranslation('');

        // Next phrase in 3 seconds if still recording
        if (isRecording && !isPaused) {
          setTimeout(scheduleNextSimPhrase, 2800);
        }
      }
    }, 320);
  }, [sampleDemoPhrases, isRecording, isPaused, targetLang]);

  const startRecord = () => {
    setIsRecording(true);
    setIsPaused(false);
    setDurationSec(0);
    simIndexRef.current = 0;
    scheduleNextSimPhrase();
  };

  const pauseRecord = () => {
    setIsPaused(true);
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
  };

  const resumeRecord = () => {
    setIsPaused(false);
    scheduleNextSimPhrase();
  };

  const stopRecord = () => {
    setIsRecording(false);
    setIsPaused(false);
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setPartialText('');
    setPartialTranslation('');
  };

  const clearAll = () => {
    stopRecord();
    setItems([]);
    setDurationSec(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSpeak = (text: string) => {
    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = targetLang;
      window.speechSynthesis.speak(u);
    } else {
      Alert.alert('Sintesis Suara', `Memutar audio: "${text}"`);
    }
  };

  const handleCopy = (text: string, id: string) => {
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      Share.share({ message: text });
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.location.assign('/contacts');
            } else {
              router.replace('/(main)/contacts' as any);
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
          <Text style={styles.backButtonText}>BambooChat</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>🎙️ Alih Bahasa Real-Time</Text>
          <Text style={styles.headerSubtitle}>Platform Penerjemah Suara & Notulen Cerdas</Text>
        </View>

        <View style={styles.providerBadge}>
          <Text style={styles.providerBadgeText}>{activeProvider.toUpperCase()}</Text>
        </View>
      </View>

      {/* Main Studio Controls */}
      <View style={styles.studioCard}>
        <View style={styles.studioRow}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.titleInput}
              value={meetingTitle}
              onChangeText={setMeetingTitle}
              placeholder="Judul Rapat..."
              placeholderTextColor="#64748B"
            />
            <Text style={styles.metaText}>
              Bahasa: <Text style={{ color: '#38BDF8', fontWeight: 'bold' }}>Indonesia (id-ID)</Text> ➔ <Text style={{ color: '#34D399', fontWeight: 'bold' }}>{targetLang}</Text>
            </Text>
          </View>

          {/* Record button */}
          <View style={styles.controlButtons}>
            {!isRecording ? (
              <TouchableOpacity style={styles.recordButton} onPress={startRecord} activeOpacity={0.85}>
                <View style={styles.recordInnerDot} />
                <Text style={styles.recordButtonText}>Rekam</Text>
              </TouchableOpacity>
            ) : isPaused ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.resumeButton} onPress={resumeRecord}>
                  <Ionicons name="play" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopButton} onPress={stopRecord}>
                  <Ionicons name="square" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.pauseButton} onPress={pauseRecord}>
                  <Ionicons name="pause" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopButton} onPress={stopRecord}>
                  <Ionicons name="square" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Waveform & Timer Bar */}
        <View style={styles.waveformContainer}>
          <View style={styles.waveformBars}>
            {waveform.map((val, idx) => (
              <View
                key={idx}
                style={[
                  styles.waveformBar,
                  {
                    height: `${Math.max(10, val)}%`,
                    backgroundColor: isRecording ? '#06B6D4' : '#334155',
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.timerText, isRecording && { color: '#EF4444' }]}>
            {formatTime(durationSec)} {isRecording ? '• LIVE' : ''}
          </Text>
        </View>
      </View>

      {/* Tab Switcher: Live Transcript vs Notulen */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'live' && styles.tabButtonActive]}
          onPress={() => setActiveTab('live')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'live' && styles.tabButtonTextActive]}>
            💬 Live Transkrip ({items.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'notulen' && styles.tabButtonActive]}
          onPress={() => setActiveTab('notulen')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'notulen' && styles.tabButtonTextActive]}>
            📝 AI Notulen Rapat
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'live' ? (
        <ScrollView style={styles.scrollList} contentContainerStyle={{ paddingBottom: 30 }}>
          {items.length === 0 && !partialText ? (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 36, opacity: 0.6 }}>🎙️</Text>
              <Text style={styles.emptyTitle}>Belum ada audio yang direkam</Text>
              <Text style={styles.emptySub}>Tekan tombol rekam di atas untuk mulai menerjemahkan suara secara langsung.</Text>
            </View>
          ) : (
            <>
              {items.map((item) => (
                <View key={item.id} style={styles.segmentCard}>
                  <View style={styles.segmentHeader}>
                    <View style={styles.speakerTag}>
                      <Text style={styles.speakerTagText}>{item.speaker}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleSpeak(item.translatedText)}>
                        <Text style={styles.actionBtnText}>🔈 TTS</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleCopy(item.translatedText, item.id)}>
                        <Text style={styles.actionBtnText}>{copiedId === item.id ? '✓ Disalin' : 'Salin'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.sourceText}>{item.sourceText}</Text>
                  <View style={styles.translatedWrap}>
                    <Text style={styles.translatedLabel}>Terjemahan ({targetLang}):</Text>
                    <Text style={styles.translatedText}>{item.translatedText}</Text>
                  </View>
                </View>
              ))}

              {/* Interim partial spoken text */}
              {partialText ? (
                <View style={[styles.segmentCard, styles.partialCard]}>
                  <Text style={styles.partialBadge}>Sedang Berbicara...</Text>
                  <Text style={styles.partialSourceText}>{partialText}</Text>
                  <Text style={styles.partialTransText}>{partialTranslation}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scrollList} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.notulenCard}>
            <Text style={styles.notulenTitle}>Notulen: {meetingTitle}</Text>
            <Text style={styles.notulenDate}>Tanggal: {new Date().toLocaleDateString('id-ID')}</Text>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecTitle}>📌 Ringkasan Eksekutif</Text>
              <Text style={styles.notulenBody}>
                {items.length > 0
                  ? `Rapat membahas koordinasi teknis dan integrasi fitur Alih Bahasa pada aplikasi BambooChat. Tim menyepakati penggunaan pipeline terjemahan multi-provider berlatensi rendah untuk transkripsi dan sintesis suara.`
                  : 'Rekam sesi terlebih dahulu untuk membuat ringkasan notulen otomatis.'}
              </Text>
            </View>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecTitle}>✅ Keputusan Kunci</Text>
              <Text style={styles.notulenBullet}>• Mengaktifkan proxy Alih Bahasa di server Nginx bamboochat.click.</Text>
              <Text style={styles.notulenBullet}>• Menyediakan fitur Live Speech Translation dan TTS langsung di aplikasi.</Text>
              <Text style={styles.notulenBullet}>• Format ekspor standar: Markdown, SRT, WebVTT, dan JSON.</Text>
            </View>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecTitle}>🚀 Tindak Lanjut</Text>
              <Text style={styles.notulenBullet}>• [ ] Uji coba panggilan suara antar pengguna dengan terjemahan subtitle langsung.</Text>
              <Text style={styles.notulenBullet}>• [ ] Sinkronisasi token autentikasi user BambooChat ke Alih Bahasa API.</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 14 : 48,
    paddingBottom: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
  },
  providerBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderWidth: 1,
    borderColor: '#06B6D4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  providerBadgeText: {
    color: '#22D3EE',
    fontSize: 10,
    fontWeight: '900',
  },
  studioCard: {
    margin: 14,
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  studioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleInput: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    paddingVertical: 4,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  controlButtons: {
    marginLeft: 12,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  recordInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
  recordButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pauseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  waveformBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 3,
    marginRight: 14,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
  },
  timerText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  tabNav: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#A5B4FC',
    fontWeight: 'bold',
  },
  scrollList: {
    flex: 1,
    paddingHorizontal: 14,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  segmentCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  speakerTag: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  speakerTagText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  actionBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  sourceText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  translatedWrap: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  translatedLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 2,
  },
  translatedText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  partialCard: {
    borderColor: '#6366F1',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  partialBadge: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  partialSourceText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontStyle: 'italic',
  },
  partialTransText: {
    color: '#94A3B8',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  notulenCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  notulenTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notulenDate: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  notulenSection: {
    marginBottom: 14,
  },
  notulenSecTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notulenBody: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
  },
  notulenBullet: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 4,
  },
});
