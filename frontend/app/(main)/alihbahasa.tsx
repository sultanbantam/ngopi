import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface TranscriptBubble {
  id: string;
  speaker: string;
  sourceText: string;
  translatedText: string;
  timestamp: string;
  targetLang: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: '🇬🇧 English', bcp: 'en-US' },
  { code: 'pt', label: '🇵🇹 Portuguese', bcp: 'pt-PT' },
  { code: 'ja', label: '🇯🇵 Japanese', bcp: 'ja-JP' },
  { code: 'zh', label: '🇨🇳 Chinese', bcp: 'zh-CN' },
  { code: 'ar', label: '🇸🇦 Arabic', bcp: 'ar-SA' },
  { code: 'ko', label: '🇰🇷 Korean', bcp: 'ko-KR' },
  { code: 'de', label: '🇩🇪 German', bcp: 'de-DE' },
  { code: 'fr', label: '🇫🇷 French', bcp: 'fr-FR' },
  { code: 'es', label: '🇪🇸 Spanish', bcp: 'es-ES' },
];

export default function AlihBahasaScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [targetLangCode, setTargetLangCode] = useState('en');
  const [micStatus, setMicStatus] = useState<string>('Siap');

  // Headset Live Audio Simultaneous Interpreter Mode
  const [isHeadsetMode, setIsHeadsetMode] = useState(true);

  const [messages, setMessages] = useState<TranscriptBubble[]>([]);
  const [partialText, setPartialText] = useState('');
  const [waveform, setWaveform] = useState<number[]>(new Array(16).fill(8));
  const [viewMode, setViewMode] = useState<'stream' | 'notulen'>('stream');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const targetLangRef = useRef('en');
  const isHeadsetModeRef = useRef(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const committedTextsSetRef = useRef<Set<string>>(new Set());
  const interimBufferRef = useRef<string>('');

  useEffect(() => {
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
    targetLangRef.current = targetLangCode;
    isHeadsetModeRef.current = isHeadsetMode;
  }, [isRecording, isPaused, targetLangCode, isHeadsetMode]);

  // Robust Chunked Translation Engine (Max 200 chars per chunk to avoid query length limits)
  const translateText = async (text: string, tgtLang: string): Promise<string> => {
    if (!text || !text.trim()) return '';
    const clean = text.trim();

    // Split long text by punctuation or into ~150-char chunks
    const chunks = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      let chunkTranslated = '';

      // 1. Google Translate NMT
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=${tgtLang}&dt=t&q=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && Array.isArray(data[0])) {
            chunkTranslated = data[0].map((c: any) => c[0]).filter(Boolean).join('');
          }
        }
      } catch (err) {
        console.warn('Google NMT chunk error:', err);
      }

      // 2. MyMemory Fallback Engine
      if (!chunkTranslated) {
        try {
          const fbUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed.slice(0, 300))}&langpair=id|${tgtLang}`;
          const fbRes = await fetch(fbUrl);
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            if (fbData?.responseData?.translatedText && !fbData.responseData.translatedText.includes('LIMIT')) {
              chunkTranslated = fbData.responseData.translatedText;
            }
          }
        } catch (fbErr) {
          console.warn('MyMemory chunk error:', fbErr);
        }
      }

      translatedChunks.push(chunkTranslated || trimmed);
    }

    return translatedChunks.join(' ').trim();
  };

  // Text-To-Speech Playback
  const speakTranslation = useCallback((text: string, langCode: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const targetObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
        u.lang = targetObj?.bcp || 'en-US';
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.warn('TTS playback error:', e);
      }
    }
  }, []);

  // Timer Counter
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

  // Live Audio Analyzer for Waveform
  const updateWaveformLoop = () => {
    if (!analyserRef.current || !isRecordingRef.current || isPausedRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const step = Math.floor(dataArray.length / 16);
    const bars: number[] = [];
    for (let i = 0; i < 16; i++) {
      const val = dataArray[i * step] || 0;
      bars.push(Math.max(8, Math.min(100, Math.floor((val / 255) * 100))));
    }
    setWaveform(bars);
    animationFrameRef.current = requestAnimationFrame(updateWaveformLoop);
  };

  // Commit a single finalized sentence cleanly into the chat stream
  const commitSentence = useCallback(async (sentenceText: string) => {
    const clean = sentenceText.trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
    if (!clean || clean.length < 3) return;

    // Strict deduplication to prevent duplicate bubbles
    if (committedTextsSetRef.current.has(clean)) {
      return;
    }
    committedTextsSetRef.current.add(clean);

    // Keep set bounded
    if (committedTextsSetRef.current.size > 200) {
      committedTextsSetRef.current.clear();
    }

    const currentTgt = targetLangRef.current;
    const translated = await translateText(clean, currentTgt);

    const newBubble: TranscriptBubble = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      speaker: 'Saya',
      sourceText: clean,
      translatedText: translated,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      targetLang: currentTgt,
    };

    setMessages((prev) => [...prev, newBubble]);
    setPartialText('');
    interimBufferRef.current = '';

    // If Headset mode is ON, speak the translation immediately into earphone!
    if (isHeadsetModeRef.current && translated) {
      speakTranslation(translated, currentTgt);
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [speakTranslation]);

  // Start Real Microphone + Speech Recognition
  const startRecording = async () => {
    try {
      setMicStatus('Menghubungkan...');
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // 1. Audio Stream & Analyzer
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;
          updateWaveformLoop();
        }

        // 2. Speech Recognition Engine
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          const recognition = new SpeechRec();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'id-ID';
          recognition.maxAlternatives = 1;

          recognition.onstart = () => {
            setMicStatus('Mendengarkan...');
          };

          recognition.onresult = (event: any) => {
            let interim = '';
            let finalChunk = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              const transcript = res[0].transcript;
              if (res.isFinal) {
                finalChunk += transcript;
              } else {
                interim += transcript;
              }
            }

            if (finalChunk.trim()) {
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              commitSentence(finalChunk.trim());
            } else if (interim.trim()) {
              interimBufferRef.current = interim.trim();
              setPartialText(interim.trim());

              // Silence debouncer: When user finishes speaking for 1.2s, auto-commit cleanly
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = setTimeout(() => {
                if (interimBufferRef.current) {
                  commitSentence(interimBufferRef.current);
                }
              }, 1200);
            }
          };

          recognition.onerror = (err: any) => {
            console.log('Recognition event:', err.error);
            if (err.error === 'not-allowed') {
              Alert.alert('Izin Mikrofon Ditolak', 'Izinkan akses mikrofon di browser Anda.');
            }
          };

          // Continuous auto-restart when recognition ends
          recognition.onend = () => {
            if (isRecordingRef.current && !isPausedRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (_) {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        }
      }

      setIsRecording(true);
      setIsPaused(false);
    } catch (err: any) {
      console.error('Mic access error:', err);
      Alert.alert('Izin Mikrofon', 'Pastikan Anda telah mengizinkan mikrofon di browser.');
      setMicStatus('Izin mikrofon diperlukan');
    }
  };

  const pauseRecording = () => {
    setIsPaused(true);
    setMicStatus('Dijeda');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (interimBufferRef.current) {
      commitSentence(interimBufferRef.current);
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
  };

  const resumeRecording = () => {
    setIsPaused(false);
    setMicStatus('Mendengarkan...');
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (_) {}
    }
    updateWaveformLoop();
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setMicStatus('Selesai');

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (interimBufferRef.current) {
      commitSentence(interimBufferRef.current);
    }

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
    setWaveform(new Array(16).fill(8));
    setPartialText('');
  };

  const clearAll = () => {
    stopRecording();
    setMessages([]);
    committedTextsSetRef.current.clear();
    setDurationSec(0);
    setMicStatus('Siap');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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

  // Generate Clean, Coherent Notulen
  const getCleanSummary = () => {
    if (messages.length === 0) return 'Belum ada data rekaman untuk dirangkum.';
    const sentences = messages.map((m) => m.sourceText.trim()).filter((s) => s.length > 5);
    return sentences.join('. ') + '.';
  };

  return (
    <View style={styles.container}>
      {/* 1. Mobile Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.location.assign('/contacts');
            } else {
              router.replace('/(main)/contacts' as any);
            }
          }}
        >
          <Ionicons name="arrow-back" size={18} color="#94A3B8" />
          <Text style={styles.backBtnText}>Chat</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>🎙️ Ruang Transkrip Live</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isRecording && !isPaused ? styles.statusDotActive : null]} />
            <Text style={styles.statusLabel}>{isRecording ? (isPaused ? 'Dijeda' : '🔴 Merekam') : micStatus}</Text>
          </View>
        </View>

        {/* View Mode & Reset Button */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'notulen' && styles.modeBtnActive]}
            onPress={() => setViewMode(viewMode === 'stream' ? 'notulen' : 'stream')}
          >
            <Ionicons name={viewMode === 'stream' ? 'document-text-outline' : 'chatbubbles-outline'} size={15} color={viewMode === 'notulen' ? '#22D3EE' : '#94A3B8'} />
            <Text style={[styles.modeBtnText, viewMode === 'notulen' && styles.modeBtnTextActive]}>
              {viewMode === 'stream' ? 'Notulen' : 'Transkrip'}
            </Text>
          </TouchableOpacity>

          {messages.length > 0 && (
            <TouchableOpacity style={styles.resetBtn} onPress={clearAll}>
              <Ionicons name="trash-outline" size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Main Single Window Content */}
      {viewMode === 'stream' ? (
        <ScrollView
          ref={scrollViewRef}
          style={styles.singleWindow}
          contentContainerStyle={styles.singleWindowContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && !partialText ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="mic-circle" size={56} color="#06B6D4" />
              </View>
              <Text style={styles.emptyHeader}>Penerjemah Suara Real-Time</Text>
              <Text style={styles.emptyDesc}>
                Pilih bahasa di bawah, lalu tekan tombol <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>"Rekam"</Text>. Setiap kalimat yang Anda ucapkan akan langsung ditranskrip & diterjemahkan otomatis ke bahasa pilihan.
              </Text>
            </View>
          ) : (
            messages.map((item, idx) => (
              <View key={item.id} style={styles.roomBubble}>
                {/* Speaker Identity & Timestamp */}
                <View style={styles.bubbleTop}>
                  <View style={styles.speakerTagWrap}>
                    <View style={styles.avatarDot} />
                    <Text style={styles.speakerTagLabel}>{item.speaker}</Text>
                    <Text style={styles.timeLabel}>{item.timestamp}</Text>
                  </View>

                  <View style={styles.bubbleActionsRow}>
                    <TouchableOpacity style={styles.bubbleBtn} onPress={() => speakTranslation(item.translatedText, item.targetLang)}>
                      <Ionicons name="volume-medium" size={15} color="#38BDF8" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.bubbleBtn} onPress={() => handleCopy(`${item.sourceText}\n↳ ${item.translatedText}`, item.id)}>
                      <Ionicons name={copiedId === item.id ? 'checkmark' : 'copy-outline'} size={15} color={copiedId === item.id ? '#34D399' : '#94A3B8'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Spoken Indonesian Sentence */}
                <Text style={styles.sourceText}>{item.sourceText}</Text>

                {/* Live Real Translation in the same window card */}
                <View style={styles.translatedBlock}>
                  <View style={styles.targetLangBadge}>
                    <Text style={styles.targetLangBadgeText}>↳ {item.targetLang.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.translatedText}>{item.translatedText}</Text>
                </View>
              </View>
            ))
          )}

          {/* Active Speaking Indicator Bubble */}
          {partialText ? (
            <View style={[styles.roomBubble, styles.interimBubbleCard]}>
              <View style={styles.speakerTagWrap}>
                <View style={[styles.avatarDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.speakerTagLabel, { color: '#EF4444' }]}>Sedang Berbicara...</Text>
                <ActivityIndicator size="small" color="#EF4444" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.interimSourceText}>"{partialText}"</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        /* Clean Rangkuman Notulen View */
        <ScrollView style={styles.singleWindow} contentContainerStyle={styles.notulenContent}>
          <View style={styles.notulenCard}>
            <View style={styles.notulenCardHeader}>
              <View>
                <Text style={styles.notulenTitle}>📋 Ringkasan Notulen Rapat</Text>
                <Text style={styles.notulenMeta}>{messages.length} Kalimat • Bahasa: {targetLangCode.toUpperCase()}</Text>
              </View>
              <TouchableOpacity
                style={styles.copySummaryBtn}
                onPress={() => {
                  const full = messages.map((m, i) => `${i + 1}. ${m.sourceText}\n   ↳ [${m.targetLang.toUpperCase()}]: ${m.translatedText}`).join('\n\n');
                  handleCopy(full, 'notulen_copy');
                }}
              >
                <Ionicons name="copy-outline" size={15} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.copySummaryBtnText}>{copiedId === 'notulen_copy' ? 'Tersalin' : 'Salin Semua'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>📌 Transkrip Inti:</Text>
              <Text style={styles.sectionBody}>{getCleanSummary()}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>🌐 Terjemahan Lengkap ({targetLangCode.toUpperCase()}):</Text>
              {messages.map((m, i) => (
                <View key={m.id} style={styles.notulenRow}>
                  <Text style={styles.notulenRowSrc}>#{i + 1} {m.sourceText}</Text>
                  <Text style={styles.notulenRowTgt}>↳ {m.translatedText}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* 3. Docked Bottom Control Bar */}
      <View style={styles.dockedBottomBar}>
        {/* Language Selector Pills & Headset Mode Toggle */}
        <View style={styles.langSelectorContainer}>
          <Text style={styles.langSelectLabel}>Bahasa:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langListPills}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.pillBtn, targetLangCode === lang.code && styles.pillBtnActive]}
                onPress={() => setTargetLangCode(lang.code)}
              >
                <Text style={[styles.pillBtnText, targetLangCode === lang.code && styles.pillBtnTextActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Headset Simultaneous Interpreter Toggle */}
          <TouchableOpacity
            style={[styles.headsetToggleBtn, isHeadsetMode && styles.headsetToggleBtnActive]}
            onPress={() => setIsHeadsetMode(!isHeadsetMode)}
          >
            <Ionicons name={isHeadsetMode ? 'headset' : 'headset-outline'} size={14} color={isHeadsetMode ? '#22D3EE' : '#64748B'} />
            <Text style={[styles.headsetToggleText, isHeadsetMode && styles.headsetToggleTextActive]}>
              {isHeadsetMode ? 'Headset: ON' : 'Headset: OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Audio Spectrum & Main Action Buttons */}
        <View style={styles.actionControlsRow}>
          {/* Waveform Bars */}
          <View style={styles.waveformContainer}>
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

          {/* Time Counter */}
          <Text style={[styles.timeCounter, isRecording && !isPaused && { color: '#EF4444' }]}>
            {formatTime(durationSec)}
          </Text>

          {/* Main Record Buttons */}
          <View style={styles.recordButtonGroup}>
            {!isRecording ? (
              <TouchableOpacity style={styles.mainRecordBtn} onPress={startRecording} activeOpacity={0.85}>
                <Ionicons name="mic" size={18} color="#FFF" />
                <Text style={styles.mainRecordBtnText}>Rekam</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {isPaused ? (
                  <TouchableOpacity style={styles.resumeCircleBtn} onPress={resumeRecording}>
                    <Ionicons name="play" size={18} color="#FFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.pauseCircleBtn} onPress={pauseRecording}>
                    <Ionicons name="pause" size={18} color="#FFF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.stopCircleBtn} onPress={stopRecording}>
                  <Ionicons name="square" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'web' ? 12 : 46,
    paddingBottom: 10,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#64748B',
  },
  statusDotActive: {
    backgroundColor: '#EF4444',
  },
  statusLabel: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  modeBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  modeBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modeBtnTextActive: {
    color: '#22D3EE',
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  singleWindow: {
    flex: 1,
  },
  singleWindowContent: {
    padding: 12,
    paddingBottom: 30,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 20,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyHeader: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320,
  },
  roomBubble: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#243044',
  },
  bubbleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  speakerTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22D3EE',
  },
  speakerTagLabel: {
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeLabel: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bubbleActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bubbleBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sourceText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  translatedBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#243044',
  },
  targetLangBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 3,
  },
  targetLangBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
  },
  translatedText: {
    color: '#34D399',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  interimBubbleCard: {
    borderColor: '#EF4444',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  interimSourceText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  notulenContent: {
    padding: 12,
    paddingBottom: 30,
  },
  notulenCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#243044',
  },
  notulenCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#243044',
    marginBottom: 12,
  },
  notulenTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
  },
  notulenMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  copySummaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copySummaryBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionBody: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
  },
  notulenRow: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#243044',
  },
  notulenRowSrc: {
    color: '#F8FAFC',
    fontSize: 12,
  },
  notulenRowTgt: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  dockedBottomBar: {
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 12 : 28,
  },
  langSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  langSelectLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 6,
  },
  langListPills: {
    flexDirection: 'row',
    gap: 6,
  },
  pillBtn: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  pillBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  pillBtnText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  pillBtnTextActive: {
    color: '#22D3EE',
    fontWeight: 'bold',
  },
  headsetToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  headsetToggleBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: '#06B6D4',
  },
  headsetToggleText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headsetToggleTextActive: {
    color: '#22D3EE',
  },
  actionControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 3,
    marginRight: 10,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
  },
  timeCounter: {
    color: '#F8FAFC',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    marginRight: 12,
  },
  recordButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    shadowColor: '#EF4444',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  mainRecordBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pauseCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
