import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
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
  { code: 'ja', label: '🇯🇵 Japanese', bcp: 'ja-JP' },
  { code: 'zh', label: '🇨🇳 Chinese', bcp: 'zh-CN' },
  { code: 'ar', label: '🇸🇦 Arabic', bcp: 'ar-SA' },
  { code: 'ko', label: '🇰🇷 Korean', bcp: 'ko-KR' },
  { code: 'de', label: '🇩🇪 German', bcp: 'de-DE' },
  { code: 'fr', label: '🇫🇷 French', bcp: 'fr-FR' },
  { code: 'es', label: '🇪🇸 Spanish', bcp: 'es-ES' },
];

export default function AlihBahasaScreen() {
  const [meetingTitle, setMeetingTitle] = useState('Rapat Suara BambooChat');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [targetLangCode, setTargetLangCode] = useState('en');
  const [micStatus, setMicStatus] = useState<string>('Siap');

  const [messages, setMessages] = useState<TranscriptBubble[]>([]);
  const [partialText, setPartialText] = useState('');
  const [waveform, setWaveform] = useState<number[]>(new Array(16).fill(10));
  const [isNotulenModalOpen, setIsNotulenModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // High-reliability translation engine (multi-source fallback)
  const translateText = async (text: string, tgtLang: string): Promise<string> => {
    if (!text || !text.trim()) return '';
    
    // 1. Google NMT Engine
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=${tgtLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map((chunk: any) => chunk[0]).filter(Boolean).join('');
          if (translated && translated.trim().length > 0) {
            return translated;
          }
        }
      }
    } catch (err) {
      console.warn('Google NMT fetch error:', err);
    }

    // 2. MyMemory Fallback Engine
    try {
      const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=id|${tgtLang}`;
      const fbRes = await fetch(fallbackUrl);
      if (fbRes.ok) {
        const fbData = await fbRes.json();
        if (fbData?.responseData?.translatedText) {
          return fbData.responseData.translatedText;
        }
      }
    } catch (fbErr) {
      console.warn('MyMemory fallback error:', fbErr);
    }

    return text;
  };

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
    if (!analyserRef.current || !isRecording || isPaused) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const step = Math.floor(dataArray.length / 16);
    const bars: number[] = [];
    for (let i = 0; i < 16; i++) {
      const val = dataArray[i * step] || 0;
      bars.push(Math.max(10, Math.min(100, Math.floor((val / 255) * 100))));
    }
    setWaveform(bars);
    animationFrameRef.current = requestAnimationFrame(updateWaveformLoop);
  };

  // Start Real Microphone + Speech Recognition
  const startRecording = async () => {
    try {
      setMicStatus('Menghubungkan Mikrofon...');
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // 1. Audio MediaStream
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

        // 2. Speech Recognition (Indonesian source)
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          const recognition = new SpeechRec();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'id-ID';

          recognition.onstart = () => {
            setMicStatus('Mendengarkan...');
          };

          recognition.onresult = async (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              const transcript = res[0].transcript;
              if (res.isFinal) {
                const cleanText = transcript.trim();
                if (cleanText) {
                  const translated = await translateText(cleanText, targetLangCode);
                  const newBubble: TranscriptBubble = {
                    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    speaker: 'Saya',
                    sourceText: cleanText,
                    translatedText: translated,
                    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    targetLang: targetLangCode,
                  };
                  setMessages((prev) => [...prev, newBubble]);
                  setPartialText('');
                  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                }
              } else {
                interim += transcript;
              }
            }
            if (interim) {
              setPartialText(interim);
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }
          };

          recognition.onerror = (err: any) => {
            console.warn('SpeechRecognition error:', err);
          };

          recognition.onend = () => {
            if (isRecording && !isPaused && recognitionRef.current) {
              try { recognitionRef.current.start(); } catch (_) {}
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
    setWaveform(new Array(16).fill(10));
    setPartialText('');
  };

  const clearAll = () => {
    stopRecording();
    setMessages([]);
    setDurationSec(0);
    setMicStatus('Siap');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSpeak = (text: string, langCode: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const targetObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      u.lang = targetObj?.bcp || 'en-US';
      window.speechSynthesis.speak(u);
    } else {
      Alert.alert('TTS Voice', `Memutar: "${text}"`);
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

  return (
    <View style={styles.container}>
      {/* 1. Mobile-Optimized Compact Header */}
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
          <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
          <Text style={styles.backBtnText}>Chat</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>🎙️ Ruang Transkrip Live</Text>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, isRecording && !isPaused ? styles.statusDotActive : null]} />
            <Text style={styles.statusText}>{isRecording ? (isPaused ? 'Dijeda' : '🔴 Merekam') : micStatus}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={styles.notulenHeaderBtn} onPress={() => setIsNotulenModalOpen(true)}>
            <Ionicons name="document-text" size={16} color="#38BDF8" />
            <Text style={styles.notulenHeaderBtnText}>Notulen</Text>
          </TouchableOpacity>
          {messages.length > 0 && (
            <TouchableOpacity style={styles.resetHeaderBtn} onPress={clearAll}>
              <Ionicons name="trash-outline" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Single Window Live Feed (Speaker, Original Indonesian, & Real-Time Translation in One Bubble) */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.feedContainer}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && !partialText ? (
          <View style={styles.emptyFeed}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="mic-circle" size={64} color="#06B6D4" />
            </View>
            <Text style={styles.emptyTitle}>Ruang Transkrip & Terjemahan Suara</Text>
            <Text style={styles.emptySub}>
              Tekan tombol <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>"Rekam"</Text> di bawah untuk mulai berbicara. Teks asli dan terjemahan otomatis ke bahasa <Text style={{ color: '#34D399', fontWeight: 'bold' }}>{targetLangCode.toUpperCase()}</Text> akan langsung muncul di sini.
            </Text>
          </View>
        ) : (
          messages.map((item, idx) => (
            <View key={item.id} style={styles.messageBubble}>
              {/* Speaker Header */}
              <View style={styles.bubbleHeader}>
                <View style={styles.speakerRow}>
                  <View style={styles.speakerAvatar}>
                    <Ionicons name="person" size={12} color="#06B6D4" />
                  </View>
                  <Text style={styles.speakerName}>{item.speaker}</Text>
                  <Text style={styles.bubbleTime}>{item.timestamp}</Text>
                </View>
                <View style={styles.bubbleActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleSpeak(item.translatedText, item.targetLang)}>
                    <Ionicons name="volume-medium" size={15} color="#38BDF8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleCopy(`${item.sourceText}\n↳ ${item.translatedText}`, item.id)}>
                    <Ionicons name={copiedId === item.id ? 'checkmark' : 'copy-outline'} size={15} color={copiedId === item.id ? '#34D399' : '#94A3B8'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Source Original Text (Indonesian) */}
              <Text style={styles.sourceText}>{item.sourceText}</Text>

              {/* Translated Text (Target Language in Vibrant Emerald) */}
              <View style={styles.translationBox}>
                <View style={styles.langTag}>
                  <Text style={styles.langTagText}>↳ {item.targetLang.toUpperCase()}</Text>
                </View>
                <Text style={styles.translatedText}>{item.translatedText}</Text>
              </View>
            </View>
          ))
        )}

        {/* Live Interim Speech Bubble (Animated Real-Time Typing) */}
        {partialText ? (
          <View style={[styles.messageBubble, styles.interimBubble]}>
            <View style={styles.speakerRow}>
              <View style={[styles.speakerAvatar, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="mic" size={12} color="#FFF" />
              </View>
              <Text style={[styles.speakerName, { color: '#EF4444' }]}>Sedang Berbicara...</Text>
              <ActivityIndicator size="small" color="#EF4444" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.interimText}>"{partialText}"</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* 3. Mobile Docked Bottom Control Bar */}
      <View style={styles.bottomControlBar}>
        {/* Horizontal Target Language Pills */}
        <View style={styles.langBar}>
          <Text style={styles.langBarLabel}>Terjemahkan:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langPills}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langPill, targetLangCode === lang.code && styles.langPillActive]}
                onPress={() => setTargetLangCode(lang.code)}
              >
                <Text style={[styles.langPillText, targetLangCode === lang.code && styles.langPillTextActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Action Controls & Waveform */}
        <View style={styles.controlsRow}>
          {/* Live Waveform Mini Bars */}
          <View style={styles.waveformWrap}>
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

          {/* Timer Display */}
          <Text style={[styles.timerLabel, isRecording && !isPaused && { color: '#EF4444' }]}>
            {formatTime(durationSec)}
          </Text>

          {/* Main Record Buttons */}
          <View style={styles.btnGroup}>
            {!isRecording ? (
              <TouchableOpacity style={styles.recordBtn} onPress={startRecording} activeOpacity={0.85}>
                <Ionicons name="mic" size={20} color="#FFF" />
                <Text style={styles.recordBtnText}>Rekam</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {isPaused ? (
                  <TouchableOpacity style={styles.resumeBtn} onPress={resumeRecording}>
                    <Ionicons name="play" size={18} color="#FFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.pauseBtn} onPress={pauseRecording}>
                    <Ionicons name="pause" size={18} color="#FFF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                  <Ionicons name="square" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 4. AI Notulen Modal Sheet */}
      <Modal visible={isNotulenModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.notulenSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>📋 AI Notulen Rapat</Text>
                <Text style={styles.sheetSub}>Total {messages.length} Segmen Percakapan</Text>
              </View>
              <TouchableOpacity onPress={() => setIsNotulenModalOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <View style={styles.notulenBlock}>
                <Text style={styles.blockTitle}>📌 Ringkasan Eksekutif</Text>
                <Text style={styles.blockText}>
                  {messages.length > 0
                    ? messages.map((m) => m.sourceText).join('. ').slice(0, 300) + '...'
                    : 'Belum ada percakapan yang direkam.'}
                </Text>
              </View>

              <View style={styles.notulenBlock}>
                <Text style={styles.blockTitle}>✅ Transkrip Lengkap & Terjemahan</Text>
                {messages.map((m, i) => (
                  <View key={m.id} style={styles.notulenItem}>
                    <Text style={styles.notulenSource}>#{i + 1} {m.sourceText}</Text>
                    <Text style={styles.notulenTarget}>↳ [{m.targetLang.toUpperCase()}]: {m.translatedText}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.copyNotulenBtn}
                onPress={() => {
                  const txt = messages.map((m, i) => `${i + 1}. ${m.sourceText}\n   Terjemahan: ${m.translatedText}`).join('\n\n');
                  handleCopy(txt, 'full_notulen');
                }}
              >
                <Ionicons name="copy-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.copyNotulenBtnText}>{copiedId === 'full_notulen' ? '✓ Notulen Disalin' : 'Salin Seluruh Notulen'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  statusPill: {
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
  statusText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  notulenHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  notulenHeaderBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  resetHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  feedContainer: {
    flex: 1,
  },
  feedContent: {
    padding: 12,
    paddingBottom: 24,
  },
  emptyFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  messageBubble: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#243044',
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speakerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerName: {
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bubbleTime: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bubbleActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
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
  translationBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#243044',
  },
  langTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 3,
  },
  langTagText: {
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
  interimBubble: {
    borderColor: '#EF4444',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  interimText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  bottomControlBar: {
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 12 : 28,
  },
  langBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  langBarLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 6,
  },
  langPills: {
    flexDirection: 'row',
    gap: 6,
  },
  langPill: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  langPillActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  langPillText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  langPillTextActive: {
    color: '#22D3EE',
    fontWeight: 'bold',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waveformWrap: {
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
  timerLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    marginRight: 12,
  },
  btnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordBtn: {
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
  recordBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pauseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  notulenSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '82%',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  sheetTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sheetSub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  closeBtn: {
    padding: 4,
  },
  sheetBody: {
    marginTop: 12,
  },
  notulenBlock: {
    backgroundColor: '#161F30',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  blockTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  blockText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
  },
  notulenItem: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#243044',
  },
  notulenSource: {
    color: '#F8FAFC',
    fontSize: 12,
  },
  notulenTarget: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  copyNotulenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
  },
  copyNotulenBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
