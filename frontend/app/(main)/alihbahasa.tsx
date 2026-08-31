import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
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

const LANGUAGES = [
  { code: 'id', label: '🇮🇩 Bahasa Indonesia', name: 'Indonesian', bcp: 'id-ID' },
  { code: 'en', label: '🇬🇧 English', name: 'English', bcp: 'en-US' },
  { code: 'pt', label: '🇵🇹 Português', name: 'Portuguese', bcp: 'pt-PT' },
  { code: 'ja', label: '🇯🇵 日本語 (Japanese)', name: 'Japanese', bcp: 'ja-JP' },
  { code: 'zh', label: '🇨🇳 中文 (Chinese)', name: 'Chinese', bcp: 'zh-CN' },
  { code: 'ar', label: '🇸🇦 العربية (Arabic)', name: 'Arabic', bcp: 'ar-SA' },
  { code: 'ko', label: '🇰🇷 한국어 (Korean)', name: 'Korean', bcp: 'ko-KR' },
  { code: 'de', label: '🇩🇪 Deutsch (German)', name: 'German', bcp: 'de-DE' },
  { code: 'fr', label: '🇫🇷 Français (French)', name: 'French', bcp: 'fr-FR' },
  { code: 'es', label: '🇪🇸 Español (Spanish)', name: 'Spanish', bcp: 'es-ES' },
];

export default function AlihBahasaScreen() {
  // Two-way Language Selection
  const [sourceLangCode, setSourceLangCode] = useState('id');
  const [targetLangCode, setTargetLangCode] = useState('en');

  // Modal Picker for Mobile
  const [langPickerVisible, setLangPickerVisible] = useState<'source' | 'target' | null>(null);

  // Voice Gender Selection (Female / Male)
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [micStatus, setMicStatus] = useState<string>('Siap');

  // Headset Mode
  const [isHeadsetMode, setIsHeadsetMode] = useState(true);

  const [messages, setMessages] = useState<TranscriptItem[]>([]);
  const [currentSpokenText, setCurrentSpokenText] = useState('');
  const [waveform, setWaveform] = useState<number[]>(new Array(16).fill(12));
  const [activeView, setActiveView] = useState<'conversation' | 'notulen'>('conversation');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [browserWarning, setBrowserWarning] = useState<string | null>(null);

  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const sourceLangRef = useRef('id');
  const targetLangRef = useRef('en');
  const voiceGenderRef = useRef<'female' | 'male'>('female');
  const isHeadsetModeRef = useRef(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSpeechRef = useRef<string>('');
  const lastCommittedSentenceRef = useRef<string>('');

  useEffect(() => {
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
    sourceLangRef.current = sourceLangCode;
    targetLangRef.current = targetLangCode;
    voiceGenderRef.current = voiceGender;
    isHeadsetModeRef.current = isHeadsetMode;
  }, [isRecording, isPaused, sourceLangCode, targetLangCode, voiceGender, isHeadsetMode]);

  // Pure Neural Machine Translation (No crowdsourced memory / No weird application letters)
  const translateText = async (text: string, srcLang: string, tgtLang: string): Promise<string> => {
    if (!text || !text.trim() || srcLang === tgtLang) return text;
    const clean = text.trim();

    // Split long text by punctuation or into ~150-char chunks
    const chunks = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      let translated = '';

      // High-accuracy Google Neural Machine Translation
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${srcLang}&tl=${tgtLang}&dt=t&q=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && Array.isArray(data[0])) {
            translated = data[0].map((c: any) => c[0]).filter(Boolean).join('');
          }
        }
      } catch (err) {
        console.warn('Google NMT chunk error:', err);
      }

      translatedChunks.push(translated || trimmed);
    }

    return translatedChunks.join(' ').trim();
  };

  // Text-To-Speech Playback with Voice Gender Matching
  const speakTranslation = useCallback((text: string, langCode: string, genderOverride?: 'female' | 'male') => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const targetObj = LANGUAGES.find((l) => l.code === langCode);
        const bcp = targetObj?.bcp || 'en-US';
        u.lang = bcp;

        const activeGender = genderOverride || voiceGenderRef.current;

        const voices = window.speechSynthesis.getVoices();
        const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langCode) || v.lang.replace('_', '-').startsWith(bcp.slice(0, 2)));

        if (langVoices.length > 0) {
          const femaleKeywords = ['female', 'woman', 'girl', 'zira', 'jenny', 'samantha', 'victoria', 'aria', 'hazel', 'katja', 'kyoko', 'yuna'];
          const maleKeywords = ['male', 'man', 'guy', 'david', 'george', 'mark', 'richard', 'brian', 'stefan', 'otoya', 'minsu'];

          const targetKeywords = activeGender === 'female' ? femaleKeywords : maleKeywords;
          const foundVoice = langVoices.find((v) => targetKeywords.some((kw) => v.name.toLowerCase().includes(kw)));

          if (foundVoice) {
            u.voice = foundVoice;
          } else {
            u.voice = langVoices[0];
          }
        }

        if (activeGender === 'female') {
          u.pitch = 1.18;
          u.rate = 1.02;
        } else {
          u.pitch = 0.82;
          u.rate = 0.95;
        }

        window.speechSynthesis.speak(u);
      } catch (e) {
        console.warn('TTS playback error:', e);
      }
    }
  }, []);

  // Unlock mobile browser audio context
  const unlockAudioContext = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0.01;
        window.speechSynthesis.speak(u);
      } catch (_) {}
    }
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

  // Audio Spectrum Waveform
  const updateWaveformLoop = () => {
    if (!analyserRef.current || !isRecordingRef.current || isPausedRef.current) return;
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

  // Commit single finished sentence cleanly
  const commitFinishedSentence = useCallback(async (textToCommit: string) => {
    const clean = textToCommit.trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
    if (!clean || clean.length < 2) return;

    if (clean === lastCommittedSentenceRef.current) {
      return;
    }
    lastCommittedSentenceRef.current = clean;

    const currentSrc = sourceLangRef.current;
    const currentTgt = targetLangRef.current;

    const translated = await translateText(clean, currentSrc, currentTgt);

    const newItem: TranscriptItem = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      speaker: 'Pembicara',
      sourceText: clean,
      translatedText: translated,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      sourceLang: currentSrc,
      targetLang: currentTgt,
    };

    setMessages((prev) => [...prev, newItem]);
    setCurrentSpokenText('');
    pendingSpeechRef.current = '';

    if (isHeadsetModeRef.current && translated) {
      speakTranslation(translated, currentTgt);
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [speakTranslation]);

  // Start Real Recording
  const startRecording = async () => {
    try {
      unlockAudioContext();
      setMicStatus('Menghubungkan...');
      setBrowserWarning(null);

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
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

        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          const recognition = new SpeechRec();
          recognition.continuous = true;
          recognition.interimResults = true;
          const currentSrcObj = LANGUAGES.find((l) => l.code === sourceLangCode);
          recognition.lang = currentSrcObj?.bcp || 'id-ID';
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
              commitFinishedSentence(finalChunk.trim());
            } else if (interim.trim()) {
              pendingSpeechRef.current = interim.trim();
              setCurrentSpokenText(interim.trim());

              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = setTimeout(() => {
                if (pendingSpeechRef.current) {
                  commitFinishedSentence(pendingSpeechRef.current);
                }
              }, 1200);
            }
          };

          recognition.onerror = (err: any) => {
            console.log('Recognition error:', err.error);
            if (err.error === 'not-allowed') {
              Alert.alert('Izin Mikrofon Ditolak', 'Izinkan akses mikrofon di browser.');
            } else if (err.error === 'network' || err.error === 'service-not-allowed') {
              setBrowserWarning('Jika menggunakan Brave Browser di Laptop, matikan "Brave Shields" pada situs ini agar fitur speech recognition diizinkan.');
            }
          };

          recognition.onend = () => {
            if (isRecordingRef.current && !isPausedRef.current && recognitionRef.current) {
              try { recognitionRef.current.start(); } catch (_) {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } else {
          setBrowserWarning('Browser ini tidak mendukung Web Speech Recognition. Disarankan menggunakan Google Chrome, Microsoft Edge, atau Safari.');
        }
      }

      setIsRecording(true);
      setIsPaused(false);
    } catch (err: any) {
      console.error('Recording start error:', err);
      Alert.alert('Izin Mikrofon', 'Pastikan Anda telah mengizinkan mikrofon di browser.');
      setMicStatus('Mikrofon Ditolak');
    }
  };

  const pauseRecording = () => {
    setIsPaused(true);
    setMicStatus('Dijeda');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (pendingSpeechRef.current) {
      commitFinishedSentence(pendingSpeechRef.current);
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
    if (pendingSpeechRef.current) {
      commitFinishedSentence(pendingSpeechRef.current);
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
    setWaveform(new Array(16).fill(12));
    setCurrentSpokenText('');
  };

  const clearAll = () => {
    stopRecording();
    setMessages([]);
    lastCommittedSentenceRef.current = '';
    setDurationSec(0);
    setMicStatus('Siap');
  };

  const swapLanguages = () => {
    const prevSrc = sourceLangCode;
    const prevTgt = targetLangCode;
    setSourceLangCode(prevTgt);
    setTargetLangCode(prevSrc);

    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        const newSrcObj = LANGUAGES.find((l) => l.code === prevTgt);
        recognitionRef.current.lang = newSrcObj?.bcp || 'en-US';
      } catch (_) {}
    }
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

  const getCleanSummary = () => {
    if (messages.length === 0) return 'Belum ada data rekaman.';
    return messages.map((m) => m.sourceText).join('. ') + '.';
  };

  const srcLangObj = LANGUAGES.find((l) => l.code === sourceLangCode) || LANGUAGES[0]!;
  const tgtLangObj = LANGUAGES.find((l) => l.code === targetLangCode) || LANGUAGES[1]!;

  return (
    <View style={styles.container}>
      {/* 1. Sleek Mobile Header */}
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
          <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          <Text style={styles.backBtnText}>Chat</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>🎙️ Alih Bahasa Live</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isRecording && !isPaused ? styles.statusDotActive : null]} />
            <Text style={styles.statusLabel}>{isRecording ? (isPaused ? 'Dijeda' : '🔴 Merekam') : micStatus}</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.viewSwitchBtn, activeView === 'notulen' && styles.viewSwitchBtnActive]}
            onPress={() => setActiveView(activeView === 'conversation' ? 'notulen' : 'conversation')}
          >
            <Ionicons name={activeView === 'conversation' ? 'document-text-outline' : 'chatbubbles-outline'} size={15} color={activeView === 'notulen' ? '#22D3EE' : '#94A3B8'} />
            <Text style={[styles.viewSwitchBtnText, activeView === 'notulen' && styles.viewSwitchBtnTextActive]}>
              {activeView === 'conversation' ? 'Notulen' : 'Live'}
            </Text>
          </TouchableOpacity>

          {messages.length > 0 && (
            <TouchableOpacity style={styles.resetBtn} onPress={clearAll}>
              <Ionicons name="trash-outline" size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Browser Warning */}
      {browserWarning && (
        <View style={styles.warningBanner}>
          <Ionicons name="alert-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={styles.warningText}>{browserWarning}</Text>
        </View>
      )}

      {/* 2. Modern Compact Dual-Language Bar (Benchmarked against Google/Apple Translate) */}
      <View style={styles.compactLangBar}>
        {/* Source Dropdown Button */}
        <TouchableOpacity
          style={styles.langPickerButton}
          onPress={() => setLangPickerVisible('source')}
          activeOpacity={0.8}
        >
          <Text style={styles.pickerSubLabel}>Bicara</Text>
          <View style={styles.pickerMainRow}>
            <Text style={styles.pickerMainText} numberOfLines={1}>{srcLangObj.label}</Text>
            <Ionicons name="chevron-down" size={14} color="#38BDF8" style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>

        {/* Swap Button */}
        <TouchableOpacity style={styles.swapRoundButton} onPress={swapLanguages} activeOpacity={0.75}>
          <Ionicons name="swap-horizontal" size={18} color="#06B6D4" />
        </TouchableOpacity>

        {/* Target Dropdown Button */}
        <TouchableOpacity
          style={styles.langPickerButton}
          onPress={() => setLangPickerVisible('target')}
          activeOpacity={0.8}
        >
          <Text style={styles.pickerSubLabel}>Terjemah</Text>
          <View style={styles.pickerMainRow}>
            <Text style={[styles.pickerMainText, { color: '#34D399' }]} numberOfLines={1}>{tgtLangObj.label}</Text>
            <Ionicons name="chevron-down" size={14} color="#34D399" style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>
      </View>

      {/* 3. Quick Audio Settings Strip */}
      <View style={styles.quickSettingsStrip}>
        {/* Voice Gender Toggle */}
        <View style={styles.genderSegment}>
          <TouchableOpacity
            style={[styles.genderSegmentBtn, voiceGender === 'female' && styles.genderSegmentBtnActive]}
            onPress={() => {
              setVoiceGender('female');
              speakTranslation('Suara perempuan aktif', targetLangCode, 'female');
            }}
          >
            <Text style={[styles.genderSegmentText, voiceGender === 'female' && styles.genderSegmentTextActive]}>
              👩 Wanita
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderSegmentBtn, voiceGender === 'male' && styles.genderSegmentBtnActive]}
            onPress={() => {
              setVoiceGender('male');
              speakTranslation('Suara laki-laki aktif', targetLangCode, 'male');
            }}
          >
            <Text style={[styles.genderSegmentText, voiceGender === 'male' && styles.genderSegmentTextActive]}>
              👨 Pria
            </Text>
          </TouchableOpacity>
        </View>

        {/* Headset Mode Toggle */}
        <TouchableOpacity
          style={[styles.headsetToggleChip, isHeadsetMode && styles.headsetToggleChipActive]}
          onPress={() => setIsHeadsetMode(!isHeadsetMode)}
        >
          <Ionicons name={isHeadsetMode ? 'headset' : 'headset-outline'} size={14} color={isHeadsetMode ? '#22D3EE' : '#64748B'} />
          <Text style={[styles.headsetToggleChipText, isHeadsetMode && styles.headsetToggleChipTextActive]}>
            {isHeadsetMode ? 'Headset: ON' : 'Headset: OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Main Single Conversation Window */}
      {activeView === 'conversation' ? (
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatStreamContainer}
          contentContainerStyle={styles.chatStreamContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && !currentSpokenText ? (
            <View style={styles.emptyPrompt}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="mic-circle-outline" size={54} color="#06B6D4" />
              </View>
              <Text style={styles.emptyTitle}>Penerjemah Suara Real-Time</Text>
              <Text style={styles.emptySub}>
                Bicara dalam bahasa <Text style={{ color: '#38BDF8', fontWeight: 'bold' }}>{srcLangObj.name}</Text> dan sistem akan menerjemahkan secara otomatis ke <Text style={{ color: '#34D399', fontWeight: 'bold' }}>{tgtLangObj.name}</Text>. Tekan tombol merah di bawah untuk mulai.
              </Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View key={msg.id} style={styles.chatCard}>
                <View style={styles.chatCardHeader}>
                  <View style={styles.speakerPill}>
                    <Ionicons name="mic-outline" size={13} color="#06B6D4" />
                    <Text style={styles.speakerPillText}>{msg.speaker}</Text>
                    <Text style={styles.timestampPill}>{msg.timestamp}</Text>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => speakTranslation(msg.translatedText, msg.targetLang)}>
                      <Ionicons name="volume-high" size={16} color="#38BDF8" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleCopy(`${msg.sourceText}\n↳ ${msg.translatedText}`, msg.id)}>
                      <Ionicons name={copiedId === msg.id ? 'checkmark' : 'copy-outline'} size={16} color={copiedId === msg.id ? '#34D399' : '#94A3B8'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Spoken Original Text */}
                <Text style={styles.cardSourceText}>{msg.sourceText}</Text>

                {/* Clean Neural Translation Box */}
                <View style={styles.cardTranslatedBlock}>
                  <View style={styles.langBadge}>
                    <Text style={styles.langBadgeText}>↳ {msg.targetLang.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.cardTranslatedText}>{msg.translatedText}</Text>
                </View>
              </View>
            ))
          )}

          {/* Live Speaking Indicator */}
          {currentSpokenText ? (
            <View style={[styles.chatCard, styles.liveSpeakingCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <ActivityIndicator size="small" color="#EF4444" />
                <Text style={styles.liveSpeakingTag}>Sedang Berbicara ({sourceLangCode.toUpperCase()})...</Text>
              </View>
              <Text style={styles.liveSpeakingText}>"{currentSpokenText}"</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        /* Notulen Summary View */
        <ScrollView style={styles.chatStreamContainer} contentContainerStyle={styles.notulenScrollContent}>
          <View style={styles.notulenBox}>
            <View style={styles.notulenHeaderRow}>
              <Text style={styles.notulenMainTitle}>📋 Notulen Percakapan</Text>
              <TouchableOpacity
                style={styles.notulenCopyBtn}
                onPress={() => {
                  const full = messages.map((m, i) => `${i + 1}. [${m.sourceLang.toUpperCase()}] ${m.sourceText}\n   ↳ [${m.targetLang.toUpperCase()}]: ${m.translatedText}`).join('\n\n');
                  handleCopy(full, 'notulen_all');
                }}
              >
                <Ionicons name="copy-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.notulenCopyBtnText}>{copiedId === 'notulen_all' ? 'Tersalin' : 'Salin Semua'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecHeader}>📌 Rangkuman Kalimat:</Text>
              <Text style={styles.notulenSecBody}>{getCleanSummary()}</Text>
            </View>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecHeader}>🌐 Transkrip & Terjemahan Lengkap:</Text>
              {messages.map((m, i) => (
                <View key={m.id} style={styles.notulenListRow}>
                  <Text style={styles.notulenListSrc}>#{i + 1} ({m.sourceLang.toUpperCase()}): {m.sourceText}</Text>
                  <Text style={styles.notulenListTgt}>↳ ({m.targetLang.toUpperCase()}): {m.translatedText}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* 5. Docked Bottom Control Bar */}
      <View style={styles.bottomDock}>
        <View style={styles.dockRow}>
          {/* Audio Waveform Spectrum */}
          <View style={styles.dockWaveform}>
            {waveform.map((val, idx) => (
              <View
                key={idx}
                style={[
                  styles.waveformStick,
                  {
                    height: `${val}%`,
                    backgroundColor: isRecording && !isPaused ? '#06B6D4' : '#334155',
                  },
                ]}
              />
            ))}
          </View>

          {/* Timer Display */}
          <Text style={[styles.dockTimer, isRecording && !isPaused && { color: '#EF4444' }]}>
            {formatTime(durationSec)}
          </Text>

          {/* Main Record Control Buttons */}
          <View style={styles.dockBtnGroup}>
            {!isRecording ? (
              <TouchableOpacity style={styles.recordMainBtn} onPress={startRecording} activeOpacity={0.85}>
                <Ionicons name="mic" size={20} color="#FFF" />
                <Text style={styles.recordMainBtnText}>Rekam</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {isPaused ? (
                  <TouchableOpacity style={styles.resumeCircle} onPress={resumeRecording}>
                    <Ionicons name="play" size={18} color="#FFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.pauseCircle} onPress={pauseRecording}>
                    <Ionicons name="pause" size={18} color="#FFF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.stopCircle} onPress={stopRecording}>
                  <Ionicons name="square" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Modal Language Selection Sheet for Mobile */}
      <Modal
        visible={langPickerVisible !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLangPickerVisible(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Pilih Bahasa {langPickerVisible === 'source' ? 'Bicara (Input)' : 'Terjemahan (Output)'}
              </Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setLangPickerVisible(null)}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => {
                const isSelected = (langPickerVisible === 'source' ? sourceLangCode : targetLangCode) === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                    onPress={() => {
                      if (langPickerVisible === 'source') {
                        setSourceLangCode(lang.code);
                        if (isRecording && recognitionRef.current) {
                          try {
                            recognitionRef.current.stop();
                            recognitionRef.current.lang = lang.bcp;
                          } catch (_) {}
                        }
                      } else {
                        setTargetLangCode(lang.code);
                      }
                      setLangPickerVisible(null);
                    }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                      {lang.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#06B6D4" />}
                  </TouchableOpacity>
                );
              })}
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
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'web' ? 14 : 46,
    paddingBottom: 12,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
    gap: 8,
  },
  viewSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewSwitchBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  viewSwitchBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewSwitchBtnTextActive: {
    color: '#22D3EE',
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
  },
  warningText: {
    color: '#FCD34D',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  compactLangBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    gap: 8,
  },
  langPickerButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerSubLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  pickerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  pickerMainText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  swapRoundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickSettingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  genderSegment: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  genderSegmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  genderSegmentBtnActive: {
    backgroundColor: '#06B6D4',
  },
  genderSegmentText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  genderSegmentTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  headsetToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headsetToggleChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  headsetToggleChipText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: 'bold',
  },
  headsetToggleChipTextActive: {
    color: '#22D3EE',
  },
  chatStreamContainer: {
    flex: 1,
  },
  chatStreamContent: {
    padding: 14,
    paddingBottom: 30,
  },
  emptyPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 320,
  },
  chatCard: {
    backgroundColor: '#161F30',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#243044',
  },
  chatCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  speakerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speakerPillText: {
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timestampPill: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardSourceText: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  cardTranslatedBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#243044',
  },
  langBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  langBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
  },
  cardTranslatedText: {
    color: '#34D399',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  liveSpeakingCard: {
    borderColor: '#EF4444',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  liveSpeakingTag: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  liveSpeakingText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
  },
  notulenScrollContent: {
    padding: 14,
    paddingBottom: 30,
  },
  notulenBox: {
    backgroundColor: '#161F30',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#243044',
  },
  notulenHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#243044',
    marginBottom: 14,
  },
  notulenMainTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notulenCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  notulenCopyBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notulenSection: {
    marginBottom: 16,
  },
  notulenSecHeader: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  notulenSecBody: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 21,
  },
  notulenListRow: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#243044',
  },
  notulenListSrc: {
    color: '#F8FAFC',
    fontSize: 13,
  },
  notulenListTgt: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  bottomDock: {
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'web' ? 14 : 30,
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dockWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 3,
    marginRight: 12,
  },
  waveformStick: {
    flex: 1,
    borderRadius: 2,
  },
  dockTimer: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    marginRight: 12,
  },
  dockBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#EF4444',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  recordMainBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pauseCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalList: {
    marginVertical: 6,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#161F30',
  },
  modalItemActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  modalItemText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  modalItemTextActive: {
    color: '#22D3EE',
    fontWeight: 'bold',
  },
});
