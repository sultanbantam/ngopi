import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PassiveTelemetryState } from './useCekkesPassiveAgent';
import { CarePlanResult, DetectedFinding } from './medicalKnowledgeBase';
import { speakAndroidTts, stopAndroidTts, isCekkesNativeAndroidAvailableCheck } from './nativeAndroidBridge';
import { MoveDailySummary } from './moveProcessors';

export type CekkesLang = 'id' | 'en';

export function buildDoctorBriefingScript(
  lang: CekkesLang,
  telemetry: PassiveTelemetryState,
  findings: DetectedFinding[],
  carePlan: CarePlanResult,
  moveSummary?: MoveDailySummary
): string {
  const hr = Math.round(telemetry.passiveHeartRateBpm);
  const fatigue = Math.round(telemetry.fingerFatiguePct);
  const tremor = telemetry.tremorHz.toFixed(1).replace('.', ',');
  const blink = Math.round(telemetry.blinkRatePerMin);
  const hnr = telemetry.hnrDb.toFixed(1);
  const otcNames = carePlan.otcList
    .filter((o) => !o.blockedReason)
    .slice(0, 2)
    .map((o) => o.activeIngredient.split('(')[0].trim())
    .join(', ');
  const herbalNames = carePlan.herbalList
    .slice(0, 2)
    .map((h) => h.plantName.split('(')[0].trim())
    .join(' dan ');

  if (lang === 'en') {
    const issueSummary =
      findings.length > 0
        ? `I detected ${findings.length} early wellness alerts: finger motor fatigue at ${fatigue} percent with a ${telemetry.tremorHz.toFixed(1)} Hertz micro-tremor, blink rate at ${blink} times per minute, and vocal HNR at ${hnr} decibels.`
        : `all 4 routine indicators look balanced: finger fatigue ${fatigue} percent, blink rate ${blink} times per minute, and vocal clarity ${hnr} decibels.`;
    const careSummary =
      otcNames || herbalNames
        ? `For early self-care today, I recommend ${otcNames || 'adequate screen rest'}, supported by ${herbalNames || 'warm hydration'} and ${carePlan.nutrition.waterMinMl} milliliters of water.`
        : `Keep up your daily hydration target of ${carePlan.nutrition.waterMinMl} milliliters and take a 20-20-20 eye break.`;

    const moveNoteEn = moveSummary
      ? moveSummary.steps >= 7000
        ? ` You have also logged ${moveSummary.steps.toLocaleString('en-US')} steps (${(
            moveSummary.walkingKm + moveSummary.runningKm
          ).toFixed(1)} kilometers) and burned ${moveSummary.caloriesKcal} kilocalories, so extra electrolytes and calf recovery care are included.`
        : moveSummary.steps > 0 && moveSummary.steps < 2000 && telemetry.screenTimeHours >= 4
        ? ` Your step count is still low at ${moveSummary.steps} steps, so try a 15-minute brisk walk to refresh circulation.`
        : ''
      : '';

    return `Hello, I am your ceKKes Digital Health Assistant. Based on 24-hour passive monitoring of how you hold your phone, touch the screen, gaze at the display, and speak during calls: your passive heart rate is ${hr} BPM, and ${issueSummary}${moveNoteEn} ${careSummary} If you want to examine a specific symptom on your chest, abdomen, eyes, mouth, or skin, tap the Deep Check tab below.`;
  }

  const issueId =
    findings.length > 0
      ? `saya mendeteksi kelelahan pada saraf jari sebesar ${fatigue} persen dengan getaran halus ${tremor} Hertz, laju kedipan mata ${blink} kali per menit, serta kejernihan suara ${hnr} desibel.`
      : `keempat indikator rutin Anda terpantau seimbang dengan kelelahan jari ${fatigue} persen, kedipan ${blink} kali per menit, dan kejernihan suara ${hnr} desibel.`;

  const careId =
    otcNames || herbalNames
      ? `Untuk penanganan awal hari ini, saya merekomendasikan istirahat layar sejenak, ${otcNames || 'hidrasi cukup'}, serta seduhan herbal ${herbalNames || 'air hangat'} dengan target minum minimal ${carePlan.nutrition.waterMinMl} mililiter.`
      : `Pertahankan minum air putih minimal ${carePlan.nutrition.waterMinMl} mililiter hari ini dan lakukan peregangan ringan setiap satu jam.`;

  const moveNoteId = moveSummary
    ? moveSummary.steps >= 7000
      ? ` Anda juga tercatat aktif bergerak sebanyak ${moveSummary.steps.toLocaleString('id-ID')} langkah sejauh ${(
          moveSummary.walkingKm + moveSummary.runningKm
        ).toFixed(1)} kilometer dengan ${moveSummary.caloriesKcal} kilokalori terbakar, sehingga tambahan elektrolit dan pemulihan otot betis sudah saya siapkan.`
      : moveSummary.steps > 0 && moveSummary.steps < 2000 && telemetry.screenTimeHours >= 4
      ? ` Jumlah langkah Anda hari ini masih rendah (${moveSummary.steps} langkah), disarankan berjalan kaki santai 15 menit untuk melancarkan peredaran darah.`
      : ''
    : '';

  return `Halo, saya dokter digital ceKKes Anda. Berdasarkan pemantauan otomatis selama 24 jam dari aktivitas Anda memegang handphone, mengetik di layar, menatap layar, dan berbicara di telepon: saat ini detak jantung pasif Anda ${hr} kali per menit, dan ${issueId}${moveNoteId} ${careId} Jika Anda merasakan keluhan lain di dada, perut, kulit, atau tenggorokan, silakan sentuh menu Cek Detail di bawah untuk pemeriksaan langsung dengan sensor handphone Anda.`;
}

export function speakDoctorText(
  text: string,
  lang: CekkesLang,
  onStart?: () => void,
  onEnd?: () => void
) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    onStart?.();
    if (Platform.OS === 'android') {
      speakAndroidTts(text, lang).catch(() => {});
    }
    const fallbackMs = Math.min(22000, Math.max(4000, text.length * 60));
    setTimeout(() => onEnd?.(), fallbackMs);
    return;
  }

  // If running inside Android APK WebView, use native Android TextToSpeech directly!
  if (isCekkesNativeAndroidAvailableCheck()) {
    onStart?.();
    speakAndroidTts(text, lang).catch(() => {});
    const fallbackMs = Math.min(22000, Math.max(4000, text.length * 60));
    setTimeout(() => onEnd?.(), fallbackMs);
    return;
  }

  // Subtle AudioContext chime so user hears immediate feedback even if TTS voice loads slowly
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(528, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
      setTimeout(() => ctx.close().catch(() => {}), 350);
    }
  } catch {
    // ignore audio context errors
  }

  const synth = window.speechSynthesis;
  if (synth && typeof SpeechSynthesisUtterance !== 'undefined') {
    try {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === 'en' ? 'en-US' : 'id-ID';
      utter.rate = 0.98;
      utter.pitch = 1.02;
      const voices = synth.getVoices();
      const preferred = voices.find((v) =>
        v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'id')
      );
      if (preferred) utter.voice = preferred;
      utter.onstart = () => onStart?.();
      utter.onend = () => onEnd?.();
      utter.onerror = () => onEnd?.();
      onStart?.();
      synth.speak(utter);
      return;
    } catch {
      // Fallback to caption timer
    }
  }

  onStart?.();
  const fallbackMs = Math.min(12000, Math.max(3500, text.length * 45));
  setTimeout(() => onEnd?.(), fallbackMs);
}

export function stopDoctorSpeech() {
  if (Platform.OS === 'android' || isCekkesNativeAndroidAvailableCheck()) {
    stopAndroidTts().catch(() => {});
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

interface DoctorVoicePlayerProps {
  lang: CekkesLang;
  script: string;
  isSpeaking: boolean;
  onToggleSpeak: () => void;
}

export default function DoctorVoicePlayer({
  lang,
  script,
  isSpeaking,
  onToggleSpeak,
}: DoctorVoicePlayerProps) {
  const [bars, setBars] = useState<number[]>([25, 45, 70, 40, 85, 55, 35, 65, 50, 30, 75, 40]);
  const [showTranscript, setShowTranscript] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSpeaking) {
      if (timerRef.current) clearInterval(timerRef.current);
      setBars([20, 28, 22, 30, 24, 20, 26, 22, 28, 20, 24, 22]);
      return;
    }
    timerRef.current = setInterval(() => {
      setBars((prev) => prev.map(() => 22 + Math.round(Math.random() * 76)));
    }, 140);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSpeaking]);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[styles.playBtn, isSpeaking && styles.playBtnActive]}
          onPress={onToggleSpeak}
        >
          <Ionicons
            name={isSpeaking ? 'stop-circle' : 'volume-high'}
            size={20}
            color={isSpeaking ? '#FFF' : '#0F172A'}
          />
          <Text style={[styles.playBtnText, isSpeaking && { color: '#FFF' }]}>
            {isSpeaking
              ? lang === 'en'
                ? 'Stop Digital Doctor'
                : 'Hentikan Suara'
              : lang === 'en'
              ? 'Listen to Digital Doctor'
              : 'Dengarkan Dokter Digital'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.captionToggle}
          onPress={() => setShowTranscript((v) => !v)}
        >
          <Ionicons name="document-text-outline" size={14} color="#D4AF37" />
          <Text style={styles.captionToggleText}>
            {showTranscript
              ? lang === 'en'
                ? 'Hide Text'
                : 'Tutup Teks'
              : lang === 'en'
              ? 'Captions'
              : 'Teks'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Audio Equalizer Waveform */}
      <View style={styles.waveRow}>
        {bars.map((h, idx) => (
          <View
            key={idx}
            style={[
              styles.waveBar,
              {
                height: Math.max(6, Math.round((h / 100) * 26)),
                backgroundColor: isSpeaking ? '#38BDF8' : '#4A3728',
              },
            ]}
          />
        ))}
        <Text style={styles.waveStatus}>
          {isSpeaking
            ? lang === 'en'
              ? 'dr. ceKKes speaking...'
              : 'dr. ceKKes berbicara...'
            : lang === 'en'
            ? 'Voice AI Ready (EN)'
            : 'Suara AI Siap (ID)'}
        </Text>
      </View>

      {(showTranscript || isSpeaking) && (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>{script}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A120B',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3B2C20',
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  playBtnActive: {
    backgroundColor: '#E11D48',
  },
  playBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  captionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A3728',
    backgroundColor: '#261C15',
  },
  captionToggleText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 4,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  waveStatus: {
    marginLeft: 'auto',
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  transcriptBox: {
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderRadius: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  transcriptText: {
    color: '#E0F2FE',
    fontSize: 11.5,
    lineHeight: 17,
  },
});
