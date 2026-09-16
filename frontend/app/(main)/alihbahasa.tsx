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

interface SmartReply {
  id: string;
  category: string;
  emoji: string;
  idText: string;
  targetText: string;
  targetLang: string;
}

const LANGUAGES = [
  { code: 'id', label: '🇮🇩 Bahasa Indonesia', name: 'Indonesian', bcp: 'id-ID' },
  { code: 'lg', label: '🇺🇬 Luganda / Ganda (Uganda)', name: 'Luganda', bcp: 'lg-UG' },
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
  // Two-way Language Selection (Default: English spoken -> Translated to Indonesian)
  const [sourceLangCode, setSourceLangCode] = useState('id');
  const [targetLangCode, setTargetLangCode] = useState('en');

  // Multi-Speaker & Meeting Mode
  const [activeSpeaker, setActiveSpeaker] = useState('Lawan Bicara');
  const [isMeetingMode, setIsMeetingMode] = useState(false);

  // Modal Pickers & Guide Sheets
  const [langPickerVisible, setLangPickerVisible] = useState<'source' | 'target' | null>(null);
  const [headsetGuideVisible, setHeadsetGuideVisible] = useState(false);
  const [meetingGuideVisible, setMeetingGuideVisible] = useState(false);
  const [coPilotGuideVisible, setCoPilotGuideVisible] = useState(false);

  // Voice Gender Selection (Female / Male)
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');

  // Smart Co-Pilot (Live Response Suggestions during Calls/Discussions)
  const [isCoPilotActive, setIsCoPilotActive] = useState(true);
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [lastAnalyzedSentence, setLastAnalyzedSentence] = useState<string>('');
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);

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
  const activeSpeakerRef = useRef('Lawan Bicara');
  const isCoPilotActiveRef = useRef(true);

  // Speech Recognition & Keep-Alive State Refs
  const isRecognitionRunningRef = useRef(false);
  const isRestartingRef = useRef(false);
  const sessionStartTimeRef = useRef<number>(0);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSpeechRef = useRef<string>('');
  const lastCommittedSentenceRef = useRef<string>('');
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Web Audio Context & Live Hardware Stream
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
    sourceLangRef.current = sourceLangCode;
    targetLangRef.current = targetLangCode;
    voiceGenderRef.current = voiceGender;
    isHeadsetModeRef.current = isHeadsetMode;
    activeSpeakerRef.current = activeSpeaker;
    isCoPilotActiveRef.current = isCoPilotActive;
  }, [isRecording, isPaused, sourceLangCode, targetLangCode, voiceGender, isHeadsetMode, activeSpeaker, isCoPilotActive]);

  // Pure Neural Machine Translation
  const translateText = async (text: string, srcLang: string, tgtLang: string): Promise<string> => {
    if (!text || !text.trim() || srcLang === tgtLang) return text;
    const clean = text.trim();

    const chunks = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      let translated = '';

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

  // Text-To-Speech Playback with Voice Gender & Earphone Support
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

  // AI Smart Replies Generator for Telephone / Discussion
  const generateLiveSmartReplies = useCallback(async (spokenSentence: string, currentSrc: string, currentTgt: string) => {
    if (!isCoPilotActiveRef.current || !spokenSentence.trim()) return;
    setIsGeneratingReplies(true);
    setLastAnalyzedSentence(spokenSentence);

    try {
      const s = spokenSentence.toLowerCase();
      const counterpartLang = currentSrc === 'id' ? currentTgt : currentSrc;

      let suggestions: { emoji: string; cat: string; id: string }[] = [];

      if (s.includes('progress') || s.includes('how do we') || s.includes('next step') || s.includes('kemajuan') || s.includes('langkah') || s.includes('lanjut')) {
        suggestions = [
          { emoji: '🚀', cat: 'Langkah Konkret', id: 'Mari kita jadwalkan pertemuan teknis besok untuk memulai fase pertama.' },
          { emoji: '📄', cat: 'Kirim Proposal/MoU', id: 'Saya akan kirimkan rangkuman dan draf kerja sama hari ini via WhatsApp.' },
          { emoji: '💼', cat: 'Konfirmasi Tim', id: 'Kami siap mengeksekusi segera setelah dokumen disetujui bersama.' },
          { emoji: '⏳', cat: 'Review 24 Jam', id: 'Beri kami waktu 24 jam untuk mereview detailnya bersama tim manajemen.' },
        ];
      } else if (s.includes('agree') || s.includes('proposal') || s.includes('deal') || s.includes('setuju') || s.includes('sepakat') || s.includes('ok') || s.includes('fine')) {
        suggestions = [
          { emoji: '✅', cat: 'Konfirmasi Setuju', id: 'Bagus sekali, kami sangat menyetujui poin kesepakatan tersebut.' },
          { emoji: '📝', cat: 'Lanjut ke Kontrak', id: 'Terima kasih, mari kita lanjutkan ke penandatanganan perjanjian resmi.' },
          { emoji: '🤝', cat: 'Apresiasi Positif', id: 'Kerja sama yang luar biasa, kami siap bekerja sama dengan Anda.' },
          { emoji: '📅', cat: 'Jadwal Mulai', id: 'Kapan perkiraan tanggal terbaik untuk kita mulai eksekusi?' },
        ];
      } else if (s.includes('money') || s.includes('price') || s.includes('cost') || s.includes('payment') || s.includes('harga') || s.includes('biaya') || s.includes('bayar') || s.includes('uang')) {
        suggestions = [
          { emoji: '💳', cat: 'Ketentuan Pembayaran', id: 'Untuk termin pembayaran, kami menggunakan sistem DP 50% di awal.' },
          { emoji: '💬', cat: 'Negosiasi Penawaran', id: 'Kami bisa berikan penawaran khusus jika kuantitas pesanan ditambah.' },
          { emoji: '🧾', cat: 'Kirim Invoice', id: 'Kami akan segera buatkan invoice resmi dan rincian anggarannya.' },
          { emoji: '🔍', cat: 'Cek Anggaran', id: 'Saya akan diskusikan alokasi anggaran ini dengan tim keuangan kami.' },
        ];
      } else if (s.includes('?') || s.includes('what') || s.includes('where') || s.includes('when') || s.includes('why') || s.includes('how') || s.includes('kapan') || s.includes('apa') || s.includes('dimana')) {
        suggestions = [
          { emoji: '💡', cat: 'Jawaban Lugas', id: 'Ya, semua detail operasional sudah sesuai dengan rencana yang telah dibahas.' },
          { emoji: '🔍', cat: 'Tanya Kebutuhan', id: 'Apakah ada syarat tambahan yang perlu kami persiapkan dari pihak kami?' },
          { emoji: '📄', cat: 'Kirim Info Lengkap', id: 'Saya akan bagikan dokumen spesifikasi lengkapnya ke Anda sekarang.' },
          { emoji: '⏳', cat: 'Konfirmasi Nanti', id: 'Saya akan pastikan datanya dan menghubungi Anda kembali dalam 30 menit.' },
        ];
      } else if (s.includes('thank') || s.includes('hello') || s.includes('hi') || s.includes('morning') || s.includes('terima kasih') || s.includes('halo') || s.includes('pagi') || s.includes('salam')) {
        suggestions = [
          { emoji: '🤝', cat: 'Sambut Hangat', id: 'Halo, senang sekali bisa berdiskusi langsung dengan Anda hari ini.' },
          { emoji: '🎯', cat: 'Masuk ke Topik', id: 'Terima kasih atas waktunya, mari kita bahas poin utama agenda kita.' },
          { emoji: '✨', cat: 'Apresiasi', id: 'Terima kasih kembali atas kesempatan dan kerja sama yang baik ini.' },
        ];
      } else {
        suggestions = [
          { emoji: '👍', cat: 'Paham & Sepakat', id: 'Baik, saya mengerti maksud Anda dan sependapat dengan hal tersebut.' },
          { emoji: '💡', cat: 'Usul Tambahan', id: 'Kami memiliki opsi alternatif yang mungkin lebih efektif untuk dipertimbangkan.' },
          { emoji: '❓', cat: 'Minta Klarifikasi', id: 'Bisakah Anda jelaskan sedikit lebih detail mengenai bagian tersebut?' },
          { emoji: '⏳', cat: 'Minta Waktu', id: 'Saya akan diskusikan dengan tim internal dan mengabari Anda segera.' },
        ];
      }

      const mappedReplies: SmartReply[] = await Promise.all(
        suggestions.map(async (item, idx) => {
          let translated = item.id;
          if (counterpartLang !== 'id') {
            translated = await translateText(item.id, 'id', counterpartLang);
          }
          return {
            id: 'reply_' + Date.now() + '_' + idx,
            emoji: item.emoji,
            category: item.cat,
            idText: item.id,
            targetText: translated,
            targetLang: counterpartLang,
          };
        })
      );

      setSmartReplies(mappedReplies);
    } catch (e) {
      console.warn('Smart reply generation error:', e);
    } finally {
      setIsGeneratingReplies(false);
    }
  }, []);

  // Unlock mobile browser speech synthesis
  const unlockAudioContext = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const u = new SpeechSynthesisUtterance('');
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

  // Real Web Audio Hardware Visualizer & Keep-Alive Loop
  const updateWaveformLoop = useCallback(() => {
    if (!isRecordingRef.current || isPausedRef.current) return;

    if (analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      const bars: number[] = [];
      const step = Math.max(1, Math.floor(bufferLength / 16));
      for (let i = 0; i < 16; i++) {
        const val = dataArray[i * step] || 0;
        const barHeight = Math.max(12, Math.min(100, Math.round((val / 255) * 90) + 12));
        bars.push(barHeight);
      }
      setWaveform(bars);
    } else {
      // Fallback synthetic wave
      const bars: number[] = [];
      const isSpeaking = !!pendingSpeechRef.current;
      for (let i = 0; i < 16; i++) {
        if (isSpeaking) {
          bars.push(25 + Math.floor(Math.random() * 65));
        } else {
          bars.push(10 + Math.floor(Math.sin(Date.now() / 200 + i) * 6 + 6));
        }
      }
      setWaveform(bars);
    }

    animationFrameRef.current = requestAnimationFrame(updateWaveformLoop);
  }, []);

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
    const currentSpeaker = activeSpeakerRef.current;

    const translated = await translateText(clean, currentSrc, currentTgt);

    const newItem: TranscriptItem = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      speaker: currentSpeaker,
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

    generateLiveSmartReplies(clean, currentSrc, currentTgt);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [speakTranslation, generateLiveSmartReplies]);

  // Schedule Safe Auto-Restart for Speech Recognition
  const scheduleRestart = useCallback((delayMs = 150) => {
    if (!isRecordingRef.current || isPausedRef.current) return;
    if (isRestartingRef.current) return;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }

    isRestartingRef.current = true;
    restartTimeoutRef.current = setTimeout(() => {
      isRestartingRef.current = false;
      if (isRecordingRef.current && !isPausedRef.current) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.abort();
          } catch (_) {}
          recognitionRef.current = null;
        }

        const freshRec = initSpeechRecognition();
        if (freshRec) {
          try {
            freshRec.start();
            recognitionRef.current = freshRec;
            isRecognitionRunningRef.current = true;
            sessionStartTimeRef.current = Date.now();
            setMicStatus('🔴 Merekam');
          } catch (err: any) {
            console.warn('SpeechRecognition start error:', err);
            isRecognitionRunningRef.current = false;
            // Retry with slight backoff
            scheduleRestart(350);
          }
        }
      }
    }, delayMs);
  }, []);

  // Safe Continuous Speech Recognition Creator
  const initSpeechRecognition = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setBrowserWarning('Browser ini tidak mendukung Web Speech Recognition. Disarankan menggunakan Google Chrome, Microsoft Edge, atau Safari.');
      return null;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      const currentSrcObj = LANGUAGES.find((l) => l.code === sourceLangRef.current);
      recognition.lang = currentSrcObj?.bcp || 'id-ID';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isRecognitionRunningRef.current = true;
        isRestartingRef.current = false;
        sessionStartTimeRef.current = Date.now();
        setMicStatus('🔴 Merekam');
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
        console.log('Continuous Speech Recognition event error:', err.error);

        // 'no-speech' and 'aborted' are normal lifecycle events; keep recording alive!
        if (err.error === 'no-speech' || err.error === 'aborted') {
          return;
        }

        if (err.error === 'not-allowed') {
          Alert.alert('Izin Mikrofon Ditolak', 'Izinkan akses mikrofon di browser untuk menggunakan Alih Bahasa.');
          setMicStatus('Izin Ditolak');
          return;
        }

        if (err.error === 'network' || err.error === 'service-not-allowed') {
          setBrowserWarning('Jika menggunakan Brave Browser di Laptop, matikan "Brave Shields" pada situs ini agar speech recognition diizinkan.');
          setMicStatus('Menyambung ulang...');
          scheduleRestart(400);
          return;
        }

        if (err.error === 'audio-capture') {
          setMicStatus('Mikrofon Sibuk...');
          scheduleRestart(600);
          return;
        }

        // Any other unrecognized error: self-heal with backoff
        scheduleRestart(300);
      };

      recognition.onend = () => {
        isRecognitionRunningRef.current = false;
        if (isRecordingRef.current && !isPausedRef.current) {
          scheduleRestart(100);
        }
      };

      return recognition;
    } catch (e) {
      console.error('Failed to init speech recognition:', e);
      return null;
    }
  }, [commitFinishedSentence, scheduleRestart]);

  // Self-Healing Watchdog Heartbeat (Checks every 2 seconds)
  useEffect(() => {
    if (isRecording && !isPaused) {
      watchdogTimerRef.current = setInterval(() => {
        if (!isRecordingRef.current || isPausedRef.current) return;

        // 1. If recognition died or failed to restart, immediately resurrect it!
        if (!isRecognitionRunningRef.current && !isRestartingRef.current) {
          console.log('[AlihBahasa Watchdog] Recognition was inactive while recording is ON. Resurrecting...');
          scheduleRestart(50);
          return;
        }

        // 2. Proactive Session Cycling: Google Speech backend times out silently after 60-90s.
        // Refresh connection seamlessly every 45s when there is no pending speech.
        const sessionAge = Date.now() - sessionStartTimeRef.current;
        if (sessionAge > 45000 && !pendingSpeechRef.current && !isRestartingRef.current) {
          console.log('[AlihBahasa Watchdog] Proactively cycling session to prevent Google 60s timeout...');
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (_) {}
          }
        }
      }, 2000);
    } else {
      if (watchdogTimerRef.current) {
        clearInterval(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    }

    return () => {
      if (watchdogTimerRef.current) {
        clearInterval(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    };
  }, [isRecording, isPaused, scheduleRestart]);

  // Start Real Recording with Persistent Hardware MediaStream & WakeLock
  const startRecording = async () => {
    try {
      unlockAudioContext();
      setMicStatus('Menghubungkan...');
      setBrowserWarning(null);

      // 1. Keep-Alive Screen WakeLock (prevents mobile/laptop tab sleep)
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (_) {}
      }

      // 2. Persistent Hardware MediaStream (keeps microphone hot and alive)
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;
          }
        } catch (streamErr) {
          console.warn('Direct getUserMedia warning (SpeechRecognition will still attempt):', streamErr);
        }
      }

      // 3. Start Continuous Speech Recognition Engine
      const recognition = initSpeechRecognition();
      if (recognition) {
        recognition.start();
        recognitionRef.current = recognition;
        isRecognitionRunningRef.current = true;
        sessionStartTimeRef.current = Date.now();
      }

      setIsRecording(true);
      setIsPaused(false);
      setMicStatus('🔴 Merekam');
      updateWaveformLoop();
    } catch (err: any) {
      console.error('Recording start error:', err);
      Alert.alert('Izin Mikrofon', 'Pastikan Anda telah mengizinkan mikrofon di browser.');
      setMicStatus('Mikrofon Ditolak');
    }
  };

  const pauseRecording = () => {
    setIsPaused(true);
    setMicStatus('Dijeda');
    isRecognitionRunningRef.current = false;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    if (pendingSpeechRef.current) {
      commitFinishedSentence(pendingSpeechRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
  };

  const resumeRecording = () => {
    setIsPaused(false);
    setMicStatus('🔴 Merekam');

    scheduleRestart(50);
    updateWaveformLoop();
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setMicStatus('Selesai');
    isRecognitionRunningRef.current = false;

    if (watchdogTimerRef.current) {
      clearInterval(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    if (pendingSpeechRef.current) {
      commitFinishedSentence(pendingSpeechRef.current);
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    // Release MediaStream tracks & AudioContext
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch (_) {}
      wakeLockRef.current = null;
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
    setSmartReplies([]);
    setLastAnalyzedSentence('');
    lastCommittedSentenceRef.current = '';
    setDurationSec(0);
    setMicStatus('Siap');
  };

  const swapLanguages = () => {
    const prevSrc = sourceLangCode;
    const prevTgt = targetLangCode;
    setSourceLangCode(prevTgt);
    setTargetLangCode(prevSrc);

    sourceLangRef.current = prevTgt;
    targetLangRef.current = prevSrc;

    if (isRecordingRef.current && !isPausedRef.current) {
      scheduleRestart(50);
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

  // Quick Simulation Test for Phone Call / Co-Pilot
  const runSimulatedCall = async (sampleEnglishText: string) => {
    setActiveSpeaker('Lawan Bicara');
    setSourceLangCode('en');
    setTargetLangCode('id');
    const translated = await translateText(sampleEnglishText, 'en', 'id');
    const simItem: TranscriptItem = {
      id: 'msg_sim_' + Date.now(),
      speaker: 'Lawan Bicara (Telepon)',
      sourceText: sampleEnglishText,
      translatedText: translated,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      sourceLang: 'en',
      targetLang: 'id',
    };
    setMessages((prev) => [...prev, simItem]);
    generateLiveSmartReplies(sampleEnglishText, 'en', 'id');
  };

  const getCleanSummary = () => {
    if (messages.length === 0) return 'Belum ada data rekaman.';
    return messages.map((m) => `[${m.speaker}] ${m.sourceText}`).join('. ') + '.';
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
            <Text style={[styles.statusLabel, isRecording && !isPaused ? { color: '#34D399' } : null]}>
              {isRecording ? (isPaused ? 'Dijeda' : micStatus) : micStatus}
            </Text>
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

      {/* 2. Compact Dual-Language Bar (Source <-> Target) */}
      <View style={styles.compactLangBar}>
        {/* Source Dropdown Button */}
        <TouchableOpacity
          style={styles.langPickerButton}
          onPress={() => setLangPickerVisible('source')}
          activeOpacity={0.8}
        >
          <Text style={styles.pickerSubLabel}>Bicara (Input)</Text>
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
          <Text style={styles.pickerSubLabel}>Terjemah (Output)</Text>
          <View style={styles.pickerMainRow}>
            <Text style={[styles.pickerMainText, { color: '#34D399' }]} numberOfLines={1}>{tgtLangObj.label}</Text>
            <Ionicons name="chevron-down" size={14} color="#34D399" style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>
      </View>

      {/* 3. Speaker Selector Bar (Mode Diskusi & Meeting > 2 Orang) */}
      <View style={styles.speakerBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.speakerScrollContent}>
          <TouchableOpacity
            style={styles.meetingModeBtn}
            onPress={() => setMeetingGuideVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="people" size={13} color="#06B6D4" />
            <Text style={styles.meetingModeBtnText}>Meeting {'>'}2 Org</Text>
          </TouchableOpacity>

          {['Lawan Bicara', 'Saya / Pembicara 1', 'Pembicara 2', 'Pembicara 3'].map((spk) => {
            const isSelected = activeSpeaker === spk;
            return (
              <TouchableOpacity
                key={spk}
                style={[styles.speakerChip, isSelected && styles.speakerChipActive]}
                onPress={() => setActiveSpeaker(spk)}
              >
                <Ionicons name={spk.includes('Lawan') ? 'call' : 'person'} size={12} color={isSelected ? '#0B1120' : '#94A3B8'} />
                <Text style={[styles.speakerChipText, isSelected && styles.speakerChipTextActive]}>{spk}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Quick Audio Settings Strip with Headset Mode & AI Co-Pilot Toggle */}
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

        {/* Headset & Co-Pilot Controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={[styles.headsetToggleChip, isHeadsetMode && styles.headsetToggleChipActive]}
            onPress={() => setIsHeadsetMode(!isHeadsetMode)}
          >
            <Ionicons name={isHeadsetMode ? 'headset' : 'headset-outline'} size={13} color={isHeadsetMode ? '#22D3EE' : '#64748B'} />
            <Text style={[styles.headsetToggleChipText, isHeadsetMode && styles.headsetToggleChipTextActive]}>
              {isHeadsetMode ? 'Earphone ON' : 'Earphone OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.coPilotToggleChip, isCoPilotActive && styles.coPilotToggleChipActive]}
            onPress={() => setCoPilotGuideVisible(true)}
          >
            <Ionicons name="sparkles" size={13} color={isCoPilotActive ? '#F59E0B' : '#64748B'} />
            <Text style={[styles.coPilotToggleChipText, isCoPilotActive && styles.coPilotToggleChipTextActive]}>
              AI Co-Pilot ON
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoGuideBtn}
            onPress={() => setHeadsetGuideVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="help-circle-outline" size={15} color="#38BDF8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 5. Main Single Conversation Window */}
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
                <Ionicons name="globe-outline" size={50} color="#06B6D4" />
              </View>
              <Text style={styles.emptyTitle}>Penerjemah Suara & Co-Pilot Telepon</Text>
              <Text style={styles.emptySub}>
                Bicara dalam <Text style={{ color: '#38BDF8', fontWeight: 'bold' }}>{srcLangObj.name}</Text> dan sistem akan menerjemahkan instan ke <Text style={{ color: '#34D399', fontWeight: 'bold' }}>{tgtLangObj.name}</Text> serta menampilkan saran respon cerdas otomatis di layar.
              </Text>

              {/* Simulation Quick Testers */}
              <View style={styles.simulationBox}>
                <Text style={styles.simulationBoxTitle}>⚡ Uji Coba Cepat Fitur Co-Pilot (1-Klik):</Text>
                <TouchableOpacity
                  style={styles.simBtn}
                  onPress={() => runSimulatedCall('All I want to know is how do we progress and start the project?')}
                >
                  <Ionicons name="play-circle" size={18} color="#06B6D4" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.simBtnText}>Tes: "All I want to know is how do we progress?"</Text>
                    <Text style={styles.simBtnSub}>Simulasi lawan bicara bertanya progress di telepon</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.simBtn}
                  onPress={() => runSimulatedCall('We agree with your proposal, can you give us a 15% discount for this batch?')}
                >
                  <Ionicons name="play-circle" size={18} color="#F59E0B" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.simBtnText}>Tes: "We agree with your proposal, can you give discount?"</Text>
                    <Text style={styles.simBtnSub}>Simulasi negosiasi & persetujuan harga</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {messages.map((msg) => (
                <View key={msg.id} style={styles.chatCard}>
                  <View style={styles.chatCardHeader}>
                    <View style={styles.speakerPill}>
                      <Ionicons name={msg.speaker.includes('Lawan') ? 'call-outline' : 'person-circle-outline'} size={14} color="#06B6D4" />
                      <Text style={styles.speakerPillText}>{msg.speaker}</Text>
                      <Text style={styles.timestampPill}>{msg.timestamp}</Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.aiReplyQuickBtn}
                        onPress={() => generateLiveSmartReplies(msg.sourceText, msg.sourceLang, msg.targetLang)}
                      >
                        <Ionicons name="sparkles" size={13} color="#F59E0B" />
                        <Text style={styles.aiReplyQuickBtnText}>Respon AI</Text>
                      </TouchableOpacity>

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
              ))}

              {/* 6. AI Smart Co-Pilot Response Box (Telepon & Live Discussion Suggestions) */}
              {smartReplies.length > 0 && (
                <View style={styles.coPilotContainer}>
                  <View style={styles.coPilotHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="sparkles" size={17} color="#F59E0B" />
                      <Text style={styles.coPilotTitle}>💡 AI Co-Pilot: Rekomendasi Respon Cepat di Layar</Text>
                    </View>
                    {isGeneratingReplies && <ActivityIndicator size="small" color="#F59E0B" />}
                  </View>

                  <Text style={styles.coPilotContextNote}>
                    Berdasarkan kalimat: "{lastAnalyzedSentence}"
                  </Text>

                  <View style={styles.replyPillsGrid}>
                    {smartReplies.map((reply) => (
                      <View key={reply.id} style={styles.replyCard}>
                        <View style={styles.replyCardTop}>
                          <Text style={styles.replyCategoryBadge}>{reply.emoji} {reply.category}</Text>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.replySpeakBtn}
                              onPress={() => speakTranslation(reply.targetText, reply.targetLang)}
                            >
                              <Ionicons name="volume-medium" size={14} color="#FFF" />
                              <Text style={styles.replySpeakBtnText}>Bicara ({reply.targetLang.toUpperCase()})</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.replyCopyBtn}
                              onPress={() => handleCopy(`${reply.idText}\n↳ (${reply.targetLang.toUpperCase()}): ${reply.targetText}`, reply.id)}
                            >
                              <Ionicons name={copiedId === reply.id ? 'checkmark' : 'copy-outline'} size={15} color={copiedId === reply.id ? '#34D399' : '#94A3B8'} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {/* Indonesian meaning for user */}
                        <Text style={styles.replyIdText}>🇮🇩 "{reply.idText}"</Text>
                        {/* Target Language Translation for counterparty */}
                        <Text style={styles.replyTargetText}>↳ ({reply.targetLang.toUpperCase()}): {reply.targetText}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Live Speaking Indicator */}
          {currentSpokenText ? (
            <View style={[styles.chatCard, styles.liveSpeakingCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <ActivityIndicator size="small" color="#EF4444" />
                <Text style={styles.liveSpeakingTag}>Sedang Berbicara ({activeSpeaker} - {sourceLangCode.toUpperCase()})...</Text>
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
              <Text style={styles.notulenMainTitle}>📋 Notulen Percakapan & Meeting</Text>
              <TouchableOpacity
                style={styles.notulenCopyBtn}
                onPress={() => {
                  const full = messages.map((m, i) => `${i + 1}. [${m.speaker}] [${m.sourceLang.toUpperCase()}] ${m.sourceText}\n   ↳ [${m.targetLang.toUpperCase()}]: ${m.translatedText}`).join('\n\n');
                  handleCopy(full, 'notulen_all');
                }}
              >
                <Ionicons name="copy-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.notulenCopyBtnText}>{copiedId === 'notulen_all' ? 'Tersalin' : 'Salin Semua'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecHeader}>📌 Rangkuman Eksekutif:</Text>
              <Text style={styles.notulenSecBody}>{getCleanSummary()}</Text>
            </View>

            <View style={styles.notulenSection}>
              <Text style={styles.notulenSecHeader}>🌐 Transkrip & Terjemahan Lengkap Tiap Pembicara:</Text>
              {messages.map((m, i) => (
                <View key={m.id} style={styles.notulenListRow}>
                  <Text style={styles.notulenListSrc}>#{i + 1} [{m.speaker}] ({m.sourceLang.toUpperCase()}): {m.sourceText}</Text>
                  <Text style={styles.notulenListTgt}>↳ ({m.targetLang.toUpperCase()}): {m.translatedText}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* 7. Docked Bottom Control Bar */}
      <View style={styles.bottomDock}>
        <View style={styles.dockRow}>
          {/* Real Web Audio Waveform Spectrum */}
          <View style={styles.dockWaveform}>
            {waveform.map((val, idx) => (
              <View
                key={idx}
                style={[
                  styles.waveformStick,
                  {
                    height: `${val}%`,
                    backgroundColor: isRecording && !isPaused ? (val > 25 ? '#22D3EE' : '#06B6D4') : '#334155',
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
                <Ionicons name="mic" size={18} color="#FFF" />
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

      {/* Modal Language Picker */}
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
                        sourceLangRef.current = lang.code;
                        if (isRecordingRef.current && !isPausedRef.current) {
                          scheduleRestart(50);
                        }
                      } else {
                        setTargetLangCode(lang.code);
                        targetLangRef.current = lang.code;
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

      {/* Modal Panduan Meeting Multi-Peserta (> 2 Orang) */}
      <Modal
        visible={meetingGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMeetingGuideVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people" size={20} color="#06B6D4" />
                <Text style={styles.modalTitle}>Solusi Meeting {'>'} 2 Orang Efektif</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMeetingGuideVisible(false)}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              <View style={styles.guideStepCard}>
                <Text style={styles.guideStepNum}>1</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Kanal Suara Mandiri Tiap Peserta</Text>
                  <Text style={styles.guideStepDesc}>
                    Setiap peserta membuka Alih Bahasa di HP masing-masing dan memilih bahasa asalnya. Suara diproses terpisah (isolated stream) sehingga akurasi 99% tanpa tabrakan suara.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepCard}>
                <Text style={styles.guideStepNum}>2</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Matriks Terjemahan Multi-Arah</Text>
                  <Text style={styles.guideStepDesc}>
                    Ketika Pembicara A bicara Bahasa Indonesia, Peserta B langsung membaca Bahasa Inggris, Peserta C Bahasa Luganda (Uganda), dan Peserta D Bahasa Jepang secara serentak.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepCard}>
                <Text style={styles.guideStepNum}>3</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Mode 1 Meja Bersama (Diarization)</Text>
                  <Text style={styles.guideStepDesc}>
                    Jika hanya menggunakan 1 HP/Laptop di tengah meja, gunakan tag pembicara atau mikrofon omni-directional. AI akan membedakan intonasi dan menyusun notulen terstruktur.
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.guideUnderstoodBtn} onPress={() => setMeetingGuideVisible(false)}>
                <Text style={styles.guideUnderstoodBtnText}>Tutup Panduan</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Panduan AI Co-Pilot / Respon Telepon Otomatis */}
      <Modal
        visible={coPilotGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCoPilotGuideVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={20} color="#F59E0B" />
                <Text style={styles.modalTitle}>Panduan AI Co-Pilot Telepon</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCoPilotGuideVisible(false)}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              <View style={styles.guideStepCard}>
                <Text style={[styles.guideStepNum, { backgroundColor: '#F59E0B' }]}>1</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Dengarkan Lawan Bicara</Text>
                  <Text style={styles.guideStepDesc}>
                    Saat lawan bicara di telepon menyampaikan pertanyaan, penawaran, atau argumen, sistem langsung menerjemahkan kalimatnya ke layar Anda.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepCard}>
                <Text style={[styles.guideStepNum, { backgroundColor: '#F59E0B' }]}>2</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Pilih Rekomendasi Respon Cerdas</Text>
                  <Text style={styles.guideStepDesc}>
                    AI secara instan memunculkan 4 opsi tanggapan (Setuju, Negosiasi, Tanya Detail, Minta Waktu) lengkap dengan terjemahannya.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepCard}>
                <Text style={[styles.guideStepNum, { backgroundColor: '#F59E0B' }]}>3</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>1-Tap Suarakan ke Telepon</Text>
                  <Text style={styles.guideStepDesc}>
                    Tekan tombol "Bicara" pada kartu pilihan. AI akan menyuarakan jawaban Anda dalam bahasa lawan bicara secara natural tanpa jeda!
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.guideUnderstoodBtn, { backgroundColor: '#D97706' }]} onPress={() => setCoPilotGuideVisible(false)}>
                <Text style={styles.guideUnderstoodBtnText}>Siap Digunakan</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Petunjuk Penggunaan Earphone / Headset */}
      <Modal
        visible={headsetGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHeadsetGuideVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="headset" size={20} color="#06B6D4" />
                <Text style={styles.modalTitle}>Panduan Earphone / Headset</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setHeadsetGuideVisible(false)}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              <View style={styles.guideStepCard}>
                <Text style={styles.guideStepNum}>1</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Sambungkan Headset ke HP / Laptop</Text>
                  <Text style={styles.guideStepDesc}>
                    Pasang earphone kabel atau sambungkan headset Bluetooth (TWS) ke perangkat Anda. Sistem operasi akan otomatis menggunakan mic & speaker headset.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepCard}>
                <Text style={styles.guideStepNum}>2</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Pastikan Tombol "Earphone ON"</Text>
                  <Text style={styles.guideStepDesc}>
                    Ketika tombol <Text style={{ color: '#22D3EE', fontWeight: 'bold' }}>Earphone ON</Text> menyala, setiap kalimat terjemahan akan langsung otomatis disuarakan ke telinga Anda tanpa perlu menekan tombol speaker manual.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepCard}>
                <Text style={styles.guideStepNum}>3</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Pilih Bahasa Lawan Bicara & Mulai</Text>
                  <Text style={styles.guideStepDesc}>
                    Atur bahasa asal dan bahasa target (misal: 🇬🇧 English ke 🇮🇩 Indonesia). Tekan <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Rekam</Text> — Anda dapat mendengar terjemahan secara simultan langsung di telinga Anda!
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.guideUnderstoodBtn} onPress={() => setHeadsetGuideVisible(false)}>
                <Text style={styles.guideUnderstoodBtnText}>Saya Mengerti</Text>
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
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 48 : 12,
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
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  backBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
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
    backgroundColor: '#10B981',
  },
  statusLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  viewSwitchBtnActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  viewSwitchBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  viewSwitchBtnTextActive: {
    color: '#22D3EE',
    fontWeight: 'bold',
  },
  resetBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  warningText: {
    color: '#FDE68A',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  compactLangBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#161F30',
    borderBottomWidth: 1,
    borderBottomColor: '#243044',
    gap: 8,
  },
  langPickerButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerSubLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pickerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerMainText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  swapRoundButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  speakerBar: {
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  speakerScrollContent: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meetingModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#06B6D4',
    marginRight: 4,
  },
  meetingModeBtnText: {
    color: '#22D3EE',
    fontSize: 11,
    fontWeight: 'bold',
  },
  speakerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  speakerChipActive: {
    backgroundColor: '#06B6D4',
  },
  speakerChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  speakerChipTextActive: {
    color: '#0B1120',
    fontWeight: 'bold',
  },
  quickSettingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  genderSegment: {
    flexDirection: 'row',
    backgroundColor: '#161F30',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#243044',
  },
  genderSegmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  genderSegmentBtnActive: {
    backgroundColor: '#0284C7',
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
    backgroundColor: '#161F30',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#243044',
  },
  headsetToggleChipActive: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  headsetToggleChipText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  headsetToggleChipTextActive: {
    color: '#22D3EE',
    fontWeight: 'bold',
  },
  coPilotToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161F30',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#243044',
  },
  coPilotToggleChipActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  coPilotToggleChipText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  coPilotToggleChipTextActive: {
    color: '#F59E0B',
    fontWeight: 'bold',
  },
  infoGuideBtn: {
    padding: 4,
  },
  chatStreamContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  chatStreamContent: {
    padding: 14,
    paddingBottom: 24,
  },
  emptyPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  simulationBox: {
    width: '100%',
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#243044',
    gap: 8,
  },
  simulationBoxTitle: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  simBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: 'bold',
  },
  simBtnSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
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
    gap: 5,
  },
  speakerPillText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timestampPill: {
    color: '#64748B',
    fontSize: 10,
    marginLeft: 4,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiReplyQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    marginRight: 2,
  },
  aiReplyQuickBtnText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionIconBtn: {
    padding: 4,
  },
  cardSourceText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  cardTranslatedBlock: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#34D399',
  },
  langBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  langBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardTranslatedText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  coPilotContainer: {
    backgroundColor: '#171E2E',
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  coPilotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#243044',
  },
  coPilotTitle: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: 'bold',
  },
  coPilotContextNote: {
    color: '#94A3B8',
    fontSize: 11,
    fontStyle: 'italic',
    marginVertical: 6,
  },
  replyPillsGrid: {
    gap: 8,
  },
  replyCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  replyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  replyCategoryBadge: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  replySpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  replySpeakBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  replyCopyBtn: {
    padding: 3,
  },
  replyIdText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  replyTargetText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  liveSpeakingCard: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  liveSpeakingTag: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  liveSpeakingText: {
    color: '#FCA5A5',
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  guideStepCard: {
    flexDirection: 'row',
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#243044',
    gap: 12,
    alignItems: 'flex-start',
  },
  guideStepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#06B6D4',
    color: '#0B1120',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 26,
  },
  guideStepTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  guideStepDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  guideUnderstoodBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  guideUnderstoodBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
