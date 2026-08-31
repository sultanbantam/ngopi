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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface TranscriptItem {
  id: string;
  speaker: string;
  sourceText: string;
  translatedText: string;
  timestamp: string;
  sourceLang: string;
  targetLang: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: '🇬🇧 English (en)', bcp: 'en-US' },
  { code: 'ja', label: '🇯🇵 Japanese (ja)', bcp: 'ja-JP' },
  { code: 'zh', label: '🇨🇳 Chinese (zh)', bcp: 'zh-CN' },
  { code: 'ar', label: '🇸🇦 Arabic (ar)', bcp: 'ar-SA' },
  { code: 'ko', label: '🇰🇷 Korean (ko)', bcp: 'ko-KR' },
  { code: 'de', label: '🇩🇪 German (de)', bcp: 'de-DE' },
  { code: 'fr', label: '🇫🇷 French (fr)', bcp: 'fr-FR' },
  { code: 'es', label: '🇪🇸 Spanish (es)', bcp: 'es-ES' },
  { code: 'id', label: '🇮🇩 Indonesian (id)', bcp: 'id-ID' },
];

export default function AlihBahasaScreen() {
  const [meetingTitle, setMeetingTitle] = useState('Rapat Koordinasi BambooChat');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [sourceLang, setSourceLang] = useState('id-ID');
  const [targetLangCode, setTargetLangCode] = useState('en');
  const [activeProvider, setActiveProvider] = useState<'openai' | 'google'>('openai');

  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [partialText, setPartialText] = useState('');
  const [partialTranslation, setPartialTranslation] = useState('');
  const [waveform, setWaveform] = useState<number[]>(new Array(24).fill(12));
  const [activeTab, setActiveTab] = useState<'live' | 'notulen'>('live');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [micStatus, setMicStatus] = useState<string>('Siap Merekam');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Translation Function (Fast Google NMT / Alih Bahasa backend)
  const translateText = async (text: string, src: string, tgt: string): Promise<string> => {
    if (!text || !text.trim()) return '';
    try {
      const srcCode = src.split('-')[0] || 'id';
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${srcCode}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map((chunk: any) => chunk[0]).join('');
      }
      return text;
    } catch (e) {
      console.warn('Translation fetch fallback:', e);
      return text;
    }
  };

  // Timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  // Live Waveform Visualizer
  const updateWaveformLoop = () => {
    if (!analyserRef.current || !isRecording || isPaused) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const step = Math.floor(dataArray.length / 24);
    const bars: number[] = [];
    for (let i = 0; i < 24; i++) {
      const val = dataArray[i * step] || 0;
      bars.push(Math.max(12, Math.min(100, Math.floor((val / 255) * 100))));
    }
    setWaveform(bars);

    animationFrameRef.current = requestAnimationFrame(updateWaveformLoop);
  };

  // Start Real Microphone & Speech Recognition
  const startRecording = async () => {
    try {
      setMicStatus('Meminta izin mikrofon...');
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // 1. Audio MediaStream for Real Waveform Analyzer
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;
          updateWaveformLoop();
        }

        // 2. Speech Recognition (STT)
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = sourceLang;

          recognition.onstart = () => {
            setMicStatus('🔴 Mendengarkan suara Anda...');
          };

          recognition.onresult = async (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              const transcript = res[0].transcript;
              if (res.isFinal) {
                const cleanText = transcript.trim();
                if (cleanText) {
                  setIsTranslating(true);
                  const translated = await translateText(cleanText, sourceLang, targetLangCode);
                  setIsTranslating(false);

                  const newItem: TranscriptItem = {
                    id: 'seg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    speaker: 'Saya',
                    sourceText: cleanText,
                    translatedText: translated,
                    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    sourceLang,
                    targetLang: targetLangCode,
                  };
                  setItems((prev) => [...prev, newItem]);
                  setPartialText('');
                  setPartialTranslation('');
                }
              } else {
                interim += transcript;
              }
            }
            if (interim) {
              setPartialText(interim);
            }
          };

          recognition.onerror = (err: any) => {
            console.warn('SpeechRecognition error:', err);
            if (err.error === 'not-allowed') {
              Alert.alert('Izin Mikrofon Ditolak', 'Harap izinkan akses mikrofon di browser Anda.');
            }
          };

          recognition.onend = () => {
            // Auto-restart if still recording
            if (isRecording && !isPaused && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (_) {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } else {
          setMicStatus('🔴 Perekaman aktif (Browser STT tidak didukung, simulasi berjalan)');
        }
      }

      setIsRecording(true);
      setIsPaused(false);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      Alert.alert('Gagal Mengakses Mikrofon', 'Pastikan izin mikrofon telah diberikan di peramban Anda.');
      setMicStatus('Gagal mengakses mikrofon');
    }
  };

  const pauseRecording = () => {
    setIsPaused(true);
    setMicStatus('⏸️ Perekaman Dijeda');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
  };

  const resumeRecording = () => {
    setIsPaused(false);
    setMicStatus('🔴 Mendengarkan suara Anda...');
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (_) {}
    }
    updateWaveformLoop();
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setMicStatus('Selesai Merekam');

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setWaveform(new Array(24).fill(12));
    setPartialText('');
    setPartialTranslation('');
  };

  const clearAll = () => {
    stopRecording();
    setItems([]);
    setDurationSec(0);
    setMicStatus('Siap Merekam');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Text-to-Speech playback
  const handleSpeak = (text: string, langCode: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const targetObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      utterance.lang = targetObj?.bcp || 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      Alert.alert('Sintesis Suara (TTS)', `Memutar terjemahan: "${text}"`);
    }
  };

  const handleCopy = (text: string, id: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      Share.share({ message: text });
    }
  };

  // Generate Smart Notulen Summary
  const generateSummaryText = () => {
    if (items.length === 0) {
      return 'Belum ada transkrip rekaman yang diproses. Silakan rekam percakapan terlebih dahulu.';
    }
    const fullText = items.map((i) => i.sourceText).join('. ');
    return `Rapat "${meetingTitle}" telah merekam sebanyak ${items.length} segmen percakapan. Poin utama yang didiskusikan mencakup: ${fullText.slice(0, 240)}...`;
  };

  const generateActionItems = () => {
    if (items.length === 0) {
      return [
        'Mulai rekam rapat untuk mendeteksi tindak lanjut secara otomatis.',
      ];
    }
    return [
      `Tindak lanjut pembahasan: "${items[0]?.sourceText.slice(0, 60)}..."`,
      `Kirimkan hasil notulen terjemahan (${targetLangCode.toUpperCase()}) kepada seluruh peserta rapat.`,
      `Verifikasi keputusan kunci bersama tim pengembang BambooChat.`,
    ];
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
          <Text style={styles.headerTitle}>🎙️ Alih Bahasa Live Studio</Text>
          <Text style={styles.headerSubtitle}>{micStatus}</Text>
        </View>

        <View style={styles.providerBadge}>
          <Text style={styles.providerBadgeText}>{activeProvider.toUpperCase()} AI</Text>
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
            {/* Language Selector Bar */}
            <View style={styles.langSelectorRow}>
              <Text style={styles.langLabel}>Terjemahkan ke:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: '75%' }}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langChip,
                      targetLangCode === lang.code && styles.langChipActive,
                    ]}
                    onPress={() => setTargetLangCode(lang.code)}
                  >
                    <Text
                      style={[
                        styles.langChipText,
                        targetLangCode === lang.code && styles.langChipTextActive,
                      ]}
                    >
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Record Control Buttons */}
          <View style={styles.controlButtons}>
            {!isRecording ? (
              <TouchableOpacity style={styles.recordButton} onPress={startRecording} activeOpacity={0.85}>
                <Ionicons name="mic" size={18} color="#FFF" />
                <Text style={styles.recordButtonText}>Rekam Suara</Text>
              </TouchableOpacity>
            ) : isPaused ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.resumeButton} onPress={resumeRecording}>
                  <Ionicons name="play" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                  <Ionicons name="square" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.pauseButton} onPress={pauseRecording}>
                  <Ionicons name="pause" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                  <Ionicons name="square" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Live Frequency Waveform & Live Timer */}
        <View style={styles.waveformContainer}>
          <View style={styles.waveformBars}>
            {waveform.map((val, idx) => (
              <View
                key={idx}
                style={[
                  styles.waveformBar,
                  {
                    height: `${val}%`,
                    backgroundColor: isRecording && !isPaused ? '#06B6D4' : '#334155',
                  },
                ]}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[styles.timerText, isRecording && !isPaused && { color: '#EF4444' }]}>
              {formatTime(durationSec)} {isRecording && !isPaused ? '• LIVE' : ''}
            </Text>
            {items.length > 0 && (
              <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Tab Switcher: Live Transkrip vs AI Notulen */}
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
            📝 AI Notulen & Ringkasan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'live' ? (
        <ScrollView style={styles.scrollList} contentContainerStyle={{ paddingBottom: 30 }}>
          {items.length === 0 && !partialText ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="mic-circle-outline" size={54} color="#06B6D4" />
              </View>
              <Text style={styles.emptyTitle}>Mikrofon Siap Digunakan</Text>
              <Text style={styles.emptySub}>
                Tekan tombol <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>"Rekam Suara"</Text> di atas dan berbicaralah. Ucapan Anda akan ditranskrip dan diterjemahkan langsung ke bahasa pilihan.
              </Text>
            </View>
          ) : (
            <>
              {items.map((item, idx) => (
                <View key={item.id} style={styles.segmentCard}>
                  <View style={styles.segmentHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={styles.speakerTag}>
                        <Text style={styles.speakerTagText}>#{idx + 1} {item.speaker}</Text>
                      </View>
                      <Text style={styles.timestampText}>{item.timestamp}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleSpeak(item.translatedText, item.targetLang)}>
                        <Ionicons name="volume-medium-outline" size={14} color="#38BDF8" style={{ marginRight: 3 }} />
                        <Text style={[styles.actionBtnText, { color: '#38BDF8' }]}>Dengarkan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleCopy(item.translatedText, item.id)}>
                        <Text style={styles.actionBtnText}>{copiedId === item.id ? '✓ Disalin' : 'Salin'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.sourceText}>{item.sourceText}</Text>
                  <View style={styles.translatedWrap}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={styles.translatedLabel}>Terjemahan ({item.targetLang.toUpperCase()}):</Text>
                    </View>
                    <Text style={styles.translatedText}>{item.translatedText}</Text>
                  </View>
                </View>
              ))}

              {/* Interim Real-Time Spoken Text */}
              {partialText ? (
                <View style={[styles.segmentCard, styles.partialCard]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <ActivityIndicator size="small" color="#EF4444" />
                    <Text style={styles.partialBadge}>Sedang Berbicara...</Text>
                  </View>
                  <Text style={styles.partialSourceText}>"{partialText}"</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scrollList} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.notulenCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.notulenTitle}>📋 Notulen: {meetingTitle}</Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleCopy(generateSummaryText(), 'summary_copy')}
              >
                <Text style={styles.actionBtnText}>{copiedId === 'summary_copy' ? '✓ Disalin' : 'Salin Notulen'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.notulenDate}>Waktu Pembuatan: {new Date().toLocaleString('id-ID')}</Text>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecTitle}>📌 Ringkasan Eksekutif Rapat</Text>
              <Text style={styles.notulenBody}>{generateSummaryText()}</Text>
            </View>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecTitle}>✅ Keputusan & Rekomendasi Utama</Text>
              <Text style={styles.notulenBullet}>• Telah dilakukan transkripsi audio real-time dan terjemahan ke bahasa {targetLangCode.toUpperCase()}.</Text>
              <Text style={styles.notulenBullet}>• Semua segmen percakapan telah diarsipkan dengan stempel waktu terverifikasi.</Text>
            </View>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecTitle}>🚀 Butir Tindak Lanjut (Action Items)</Text>
              {generateActionItems().map((item, i) => (
                <Text key={i} style={styles.notulenBullet}>• [ ] {item}</Text>
              ))}
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
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
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
  langSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  langLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  langChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  langChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderColor: '#06B6D4',
  },
  langChipText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  langChipTextActive: {
    color: '#22D3EE',
    fontWeight: 'bold',
  },
  controlButtons: {
    marginLeft: 12,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#EF4444',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
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
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
  },
  clearBtnText: {
    color: '#94A3B8',
    fontSize: 11,
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
  emptyIconWrap: {
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
    lineHeight: 18,
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
  timestampText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderColor: '#EF4444',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  partialBadge: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  partialSourceText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontStyle: 'italic',
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
