import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DetectedFinding } from './medicalKnowledgeBase';
import ThermalTherapyGuide, { SkinConditionFlag } from './ThermalTherapyGuide';
import { CekkesLang } from './DoctorVoicePlayer';
import {
  analyzeAbdominalAudio,
  analyzeColorimetricImage,
  analyzeMotionSamples,
  analyzePpgSamples,
  analyzeVocalPcm,
  MotionSample,
  PpgSample,
  VisionTargetRegion,
} from './sensorProcessors';

export type SensorModuleId = 'ppg' | 'ocular' | 'chest_abdomen' | 'voice' | 'vision' | 'thermal';

interface ActiveScannerProps {
  lang: CekkesLang;
  activeFindings: DetectedFinding[];
  onUpsertFinding: (finding: DetectedFinding) => void;
  onSpeakResult?: (message: string) => void;
  onUpdateTelemetry?: (metrics: {
    hrBpm?: number;
    hrvMs?: number;
    vocalEnergyPct?: number;
    hnrDb?: number;
    breathRatePerMin?: number;
  }) => void;
  onGoToCarePlan: () => void;
}

const SENSOR_CARDS: Array<{
  id: SensorModuleId;
  emoji: string;
  titleId: string;
  titleEn: string;
  subId: string;
  subEn: string;
  color: string;
}> = [
  {
    id: 'ppg',
    emoji: '👆',
    titleId: 'Sentuhan Jari',
    titleEn: 'Fingertip Pulse',
    subId: 'Nadi PPG & Motorik',
    subEn: 'PPG & Finger Tap',
    color: '#38BDF8',
  },
  {
    id: 'ocular',
    emoji: '👁️',
    titleId: 'Tatapan & Mata',
    titleEn: 'Eye & Blink Test',
    subId: 'Uji Tahan Kedip',
    subEn: 'Tear Film (TBUT)',
    color: '#10B981',
  },
  {
    id: 'chest_abdomen',
    emoji: '❤️',
    titleId: 'Dada, Perut & Ginjal',
    titleEn: 'Chest & Abdomen',
    subId: 'SCG, Usus & Ginjal',
    subEn: 'SCG, Bowel & Kidney',
    color: '#FB7185',
  },
  {
    id: 'voice',
    emoji: '🗣️',
    titleId: 'Suara & Keluhan',
    titleEn: 'Voice & Symptoms',
    subId: 'Rekam 5d & NLP',
    subEn: '5s Voice & NLP',
    color: '#A78BFA',
  },
  {
    id: 'vision',
    emoji: '📸',
    titleId: 'Foto Mata/Mulut/Kulit',
    titleEn: 'Clinical Photo',
    subId: 'Kamera & Galeri',
    subEn: 'Camera & Upload',
    color: '#D4AF37',
  },
  {
    id: 'thermal',
    emoji: '🌡️',
    titleId: 'Terapi Hangat 43°C',
    titleEn: '43°C Heat Guide',
    subId: 'Kutil & Batas Aman',
    subEn: 'Safe Thermal Timer',
    color: '#F59E0B',
  },
];

export default function ActiveScanner({
  lang,
  activeFindings,
  onUpsertFinding,
  onSpeakResult,
  onUpdateTelemetry,
  onGoToCarePlan,
}: ActiveScannerProps) {
  const [selectedModule, setSelectedModule] = useState<SensorModuleId | null>(null);

  // Modul 1: PPG & Finger Tap
  const [ppgRunning, setPpgRunning] = useState(false);
  const [ppgProgress, setPpgProgress] = useState(0);
  const [ppgResult, setPpgResult] = useState<string | null>(null);
  const [ppgError, setPpgError] = useState<string | null>(null);
  const [ppgWave, setPpgWave] = useState<number[]>([20, 35, 28, 45, 32, 24, 48, 30, 22, 42]);
  const [tapRunning, setTapRunning] = useState(false);
  const [tapSeconds, setTapSeconds] = useState(15);
  const [tapCount, setTapCount] = useState(0);
  const ppgVideoRef = useRef<HTMLVideoElement | null>(null);
  const ppgStreamRef = useRef<MediaStream | null>(null);

  // Modul 2: TBUT
  const [tbutRunning, setTbutRunning] = useState(false);
  const [tbutSeconds, setTbutSeconds] = useState(0);
  const [ocularResult, setOcularResult] = useState<string | null>(null);

  // Modul 3: SCG + Abdomen + Kidney
  const [scgRunning, setScgRunning] = useState(false);
  const [abdomenRunning, setAbdomenRunning] = useState(false);
  const [scgResult, setScgResult] = useState<string | null>(null);
  const [scgError, setScgError] = useState<string | null>(null);
  const [kidneySymptom, setKidneySymptom] = useState<'normal' | 'edema_or_foamy'>('normal');

  // Modul 4: Voice & NLP
  const [voiceActive, setVoiceActive] = useState(false);
  const [symptomText, setSymptomText] = useState('');
  const [nlpResult, setNlpResult] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Modul 5: Clinical Vision
  const [visionMode, setVisionMode] = useState<'mata' | 'mulut' | 'kulit'>('mata');
  const [visionCameraActive, setVisionCameraActive] = useState(false);
  const [visionFinding, setVisionFinding] = useState<string | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const visionVideoRef = useRef<HTMLVideoElement | null>(null);
  const visionStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modul 6: Thermal
  const [skinCondition, setSkinCondition] = useState<SkinConditionFlag>('wart_clavus');

  useEffect(() => {
    return () => {
      ppgStreamRef.current?.getTracks().forEach((t) => t.stop());
      visionStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!tapRunning) return;
    if (tapSeconds <= 0) {
      setTapRunning(false);
      const speed =
        tapCount >= 45
          ? 'Normal / Cepat'
          : tapCount >= 28
          ? 'Sedang (Agak Lelah)'
          : 'Melambat (Kelelahan Motorik)';
      const msg = `Finger Tap 15d: ${tapCount} ketukan (${speed}).`;
      setPpgResult(msg);
      if (tapCount < 28) {
        onUpsertFinding({
          id: 'active-tap-fatigue',
          title: 'Penurunan Kecepatan Motorik Jari',
          source: 'active',
          severity: 'perhatian',
          category: 'motor_nerve',
          summary: `Skor ketuk 15 detik hanya ${tapCount}x. Disarankan istirahat tangan & vitamin B-kompleks.`,
        });
      }
      onSpeakResult?.(msg);
      return;
    }
    const timer = setTimeout(() => setTapSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [tapRunning, tapSeconds, tapCount, onUpsertFinding, onSpeakResult]);

  useEffect(() => {
    if (!tbutRunning) return;
    const timer = setInterval(() => setTbutSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [tbutRunning]);

  // MODUL 1: Real Camera PPG
  const runPpgScan = async () => {
    if (ppgRunning) return;
    setPpgError(null);
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPpgError('Browser ini tidak mendukung kamera WebRTC.');
      return;
    }
    setPpgRunning(true);
    setPpgProgress(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 240 } },
      });
      ppgStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      try {
        await (videoTrack as any).applyConstraints?.({ advanced: [{ torch: true }] });
      } catch {
        // optional torch
      }
      const video = ppgVideoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        setPpgRunning(false);
        setPpgError('Elemen video PPG belum siap.');
        return;
      }
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        stream.getTracks().forEach((t) => t.stop());
        setPpgRunning(false);
        return;
      }

      const samples: PpgSample[] = [];
      const startTime = performance.now();
      const durationMs = 8000;

      const intervalId = window.setInterval(() => {
        const elapsed = performance.now() - startTime;
        setPpgProgress(Math.min(100, Math.round((elapsed / durationMs) * 100)));
        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, 64, 64);
          const frame = ctx.getImageData(16, 16, 32, 32).data;
          let sumR = 0;
          let sumG = 0;
          const pixels = frame.length / 4;
          for (let i = 0; i < frame.length; i += 4) {
            sumR += frame[i];
            sumG += frame[i + 1];
          }
          const rMean = sumR / pixels;
          samples.push({ t: performance.now(), r: rMean, g: sumG / pixels });
          setPpgWave((prev) => [...prev.slice(-11), Math.max(12, Math.min(95, Math.round((rMean % 25) * 3.8)))]);
        }

        if (elapsed >= durationMs) {
          window.clearInterval(intervalId);
          stream.getTracks().forEach((t) => t.stop());
          ppgStreamRef.current = null;
          setPpgRunning(false);

          const res = analyzePpgSamples(samples);
          if (!res.valid) {
            setPpgError(res.reason || 'Sinyal PPG tidak terdeteksi.');
            return;
          }
          const summary = `PPG Terukur: Detak Jantung ${res.hrBpm} bpm, SpO2 ${res.spo2Estimate}%, HRV ${res.hrvMs} ms.`;
          setPpgResult(summary);
          onUpdateTelemetry?.({ hrBpm: res.hrBpm, hrvMs: res.hrvMs });
          if (res.hrBpm > 105 || res.hrvMs < 25) {
            onUpsertFinding({
              id: 'active-ppg-stress',
              title: 'Takikardia Ringan / Beban Stres Otonom',
              source: 'active',
              severity: 'perhatian',
              category: 'motor_nerve',
              summary: `HR terukur ${res.hrBpm} bpm dan HRV ${res.hrvMs} ms.`,
            });
          }
          onSpeakResult?.(summary);
        }
      }, 40);
    } catch {
      setPpgRunning(false);
      setPpgError('Izin kamera ditolak atau kamera tidak tersedia. Gunakan Uji Ketuk atau Simulasi Cepat.');
    }
  };

  // MODUL 2: TBUT
  const stopTbutTest = () => {
    setTbutRunning(false);
    const status = tbutSeconds < 10 ? 'Indikasi Mata Kering (TBUT < 10 dtk)' : 'Stabil (TBUT >= 10 dtk)';
    const msg = `Hasil TBUT: Tahan kedip ${tbutSeconds} detik. ${status}.`;
    setOcularResult(msg);
    if (tbutSeconds < 10) {
      onUpsertFinding({
        id: 'active-ocular-tbut',
        title: 'Mata Kering (Tear Break-Up Time Rendah)',
        source: 'active',
        severity: 'perhatian',
        category: 'ocular',
        summary: `TBUT hanya ${tbutSeconds} detik. Terapkan aturan 20-20-20 & tetes mata lubrikan.`,
      });
    }
    onSpeakResult?.(msg);
  };

  // MODUL 3A: Chest SCG IMU
  const runChestScgScan = async () => {
    if (scgRunning) return;
    setScgError(null);
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      setScgError('Sensor IMU DeviceMotion tidak tersedia di perangkat ini.');
      return;
    }
    try {
      const DME = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (DME && typeof DME.requestPermission === 'function') {
        const perm = await DME.requestPermission();
        if (perm !== 'granted') {
          setScgError('Izin sensor gerak ditolak.');
          return;
        }
      }
    } catch {
      setScgError('Gagal meminta izin sensor gerak.');
      return;
    }
    setScgRunning(true);
    const samples: MotionSample[] = [];
    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration ?? e.accelerationIncludingGravity;
      if (!acc) return;
      samples.push({ t: performance.now(), x: acc.x ?? 0, y: acc.y ?? 0, z: acc.z ?? 0 });
    };
    window.addEventListener('devicemotion', onMotion, { passive: true });
    window.setTimeout(() => {
      window.removeEventListener('devicemotion', onMotion);
      setScgRunning(false);
      const res = analyzeMotionSamples(samples);
      if (!res.valid) {
        setScgError(res.reason || 'Data IMU tidak mencukupi (tersedia di HP/tablet).');
        return;
      }
      const msg = `SCG Dada Terukur: Nadi ${res.estimatedBpm} bpm, Napas ${res.breathRatePerMin} kali per menit.`;
      setScgResult(msg);
      onUpdateTelemetry?.({ hrBpm: res.estimatedBpm, breathRatePerMin: res.breathRatePerMin });
      onSpeakResult?.(msg);
    }, 8000);
  };

  // MODUL 3B: Abdomen Bowel Sound
  const runAbdomenAudioScan = async () => {
    if (abdomenRunning) return;
    setScgError(null);
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScgError('Browser tidak mendukung mikrofon.');
      return;
    }
    setAbdomenRunning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const chunks: Float32Array[] = [];
      const temp = new Float32Array(analyser.fftSize);
      const sampler = window.setInterval(() => {
        analyser.getFloatTimeDomainData(temp);
        chunks.push(new Float32Array(temp));
      }, 45);
      window.setTimeout(() => {
        window.clearInterval(sampler);
        stream.getTracks().forEach((t) => t.stop());
        const sr = ctx.sampleRate || 44100;
        ctx.close().catch(() => { });
        setAbdomenRunning(false);

        const total = chunks.reduce((a, b) => a + b.length, 0);
        const merged = new Float32Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        const res = analyzeAbdominalAudio(merged, sr);
        if (!res.valid) {
          setScgError(res.reason || 'Gagal menganalisis audio perut.');
          return;
        }
        const msg = `Auskultasi Perut: ${res.burstCount} letupan (${res.burstsPerMinute}x/mnt), status ${res.classification}.`;
        setScgResult(msg);
        if (res.classification === 'hyperactive') {
          onUpsertFinding({
            id: 'active-abdomen-hyper',
            title: 'Peristaltik Usus Meningkat (Hiperaktif)',
            source: 'active',
            severity: 'perhatian',
            category: 'gastric',
            summary: `Terdeteksi ${res.burstsPerMinute}x/menit bunyi usus. Jaga hidrasi oralit/air putih.`,
          });
        }
        onSpeakResult?.(msg);
      }, 10000);
    } catch {
      setAbdomenRunning(false);
      setScgError('Mikrofon ditolak atau tidak tersedia.');
    }
  };

  // MODUL 4: Voice & Symptom NLP
  const runVoiceAndSymptomAnalysis = async () => {
    if (voiceActive) return;
    setVoiceError(null);
    setVoiceActive(true);
    let vocalSummary = '';
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          src.connect(analyser);
          const chunks: Float32Array[] = [];
          const temp = new Float32Array(analyser.fftSize);
          await new Promise<void>((resolve) => {
            const sampler = window.setInterval(() => {
              analyser.getFloatTimeDomainData(temp);
              chunks.push(new Float32Array(temp));
            }, 45);
            window.setTimeout(() => {
              window.clearInterval(sampler);
              resolve();
            }, 5000);
          });
          stream.getTracks().forEach((t) => t.stop());
          const sr = ctx.sampleRate || 44100;
          ctx.close().catch(() => { });

          const total = chunks.reduce((a, b) => a + b.length, 0);
          const merged = new Float32Array(total);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          const res = analyzeVocalPcm(merged, sr);
          if (res.valid) {
            vocalSummary = `Vokal Terukur: F0 ${res.f0Hz} Hz, Energi ${res.rmsEnergyPct}%, HNR ${res.hnrDb} dB.`;
            onUpdateTelemetry?.({ vocalEnergyPct: res.rmsEnergyPct, hnrDb: res.hnrDb });
            if (res.hnrDb < 14 || res.jitterPct > 2.2) {
              onUpsertFinding({
                id: 'active-voice-hoarse',
                title: 'Suara Serak / Kelelahan Pita Suara',
                source: 'active',
                severity: 'perhatian',
                category: 'vocal_throat',
                summary: `Terukur HNR ${res.hnrDb} dB. Perbanyak air hangat, madu kencur & lozenges.`,
              });
            }
          } else {
            setVoiceError(res.reason || 'Suara terlalu pelan.');
          }
        }
      } catch {
        setVoiceError('Mikrofon tidak tersedia; analisis teks keluhan tetap dijalankan.');
      }
    }

    const lower = symptomText.toLowerCase();
    const detectedTags: string[] = [];
    if (lower.includes('serak') || lower.includes('batuk') || lower.includes('tenggorok')) {
      detectedTags.push('Tenggorokan/ISPA');
      onUpsertFinding({
        id: 'active-nlp-throat',
        title: 'Keluhan Tenggorokan / Batuk Ringan',
        source: 'active',
        severity: 'perhatian',
        category: 'vocal_throat',
        summary: `Keluhan terdeteksi: "${symptomText.slice(0, 60)}"`,
      });
    }
    if (lower.includes('maag') || lower.includes('perih') || lower.includes('mual') || lower.includes('kembung')) {
      detectedTags.push('Lambung/Maag');
      onUpsertFinding({
        id: 'active-nlp-gi',
        title: 'Dispepsia / Asam Lambung Ringan',
        source: 'active',
        severity: 'perhatian',
        category: 'gastric',
        summary: 'Keluhan lambung terdeteksi. Rekomendasi antasida / temulawak hangat.',
      });
    }
    if (lower.includes('mata') || lower.includes('buram') || lower.includes('kering')) {
      detectedTags.push('Kelelahan Mata');
      onUpsertFinding({
        id: 'active-nlp-eye',
        title: 'Kelelahan & Ketegangan Mata',
        source: 'active',
        severity: 'perhatian',
        category: 'ocular',
        summary: 'Keluhan mata kering/buram terdeteksi.',
      });
    }

    const finalMsg = `${vocalSummary || 'Audio belum terukur.'} NLP: ${
      detectedTags.length > 0 ? detectedTags.join(', ') : 'Tidak ada gejala akut.'
    }`;
    setNlpResult(finalMsg);
    setVoiceActive(false);
    onSpeakResult?.(finalMsg);
  };

  // MODUL 5: Vision
  const mapVisionModeToTarget = (): VisionTargetRegion =>
    visionMode === 'mata' ? 'eye' : visionMode === 'mulut' ? 'mouth' : 'skin';

  const applyColorimetricResult = (res: ReturnType<typeof analyzeColorimetricImage>) => {
    if (!res.valid) {
      setVisionError(res.reason || 'Gambar tidak valid.');
      return;
    }
    setVisionFinding(`Analisis Piksel (${res.confidencePct}%): ${res.summary}`);
    if (res.detectedCondition === 'anemia') {
      onUpsertFinding({
        id: 'active-vision-anemia',
        title: 'Indikasi Konjungtiva Pucat (Skrining Awal Anemia)',
        source: 'active',
        severity: 'perhatian',
        category: 'anemia_fatigue',
        summary: res.summary,
      });
    } else if (res.detectedCondition === 'dehidrasi') {
      onUpsertFinding({
        id: 'active-vision-dehidrasi',
        title: 'Dehidrasi Ringan (Lidah/Mukosa Kering)',
        source: 'active',
        severity: 'perhatian',
        category: 'anemia_fatigue',
        summary: res.summary,
      });
    } else if (res.detectedCondition === 'eksim') {
      setSkinCondition('eczema_acute');
      onUpsertFinding({
        id: 'active-vision-eczema',
        title: 'Eksim / Dermatitis Ringan',
        source: 'active',
        severity: 'waspada',
        category: 'skin_eczema',
        summary: 'Kompres dingin, Hydrocortisone 1% tipis atau gel Aloe vera dingin.',
      });
    } else if (res.detectedCondition === 'jamur') {
      setSkinCondition('fungal_active');
      onUpsertFinding({
        id: 'active-vision-fungal',
        title: 'Infeksi Jamur Kulit (Panu/Kurap)',
        source: 'active',
        severity: 'perhatian',
        category: 'skin_fungal',
        summary: 'Gunakan salep antijamur topikal & jaga area tetap kering.',
      });
    } else if (res.detectedCondition === 'kutil') {
      setSkinCondition('wart_clavus');
      onUpsertFinding({
        id: 'active-vision-wart',
        title: 'Kutil / Mata Ikan (Clavus)',
        source: 'active',
        severity: 'perhatian',
        category: 'skin_wart',
        summary: 'Salicylic Acid 10-20% + Guided Hyperthermia 43°C 30 menit/hari.',
      });
    }
    onSpeakResult?.(res.summary);
  };

  const toggleVisionCamera = async () => {
    setVisionError(null);
    if (visionCameraActive) {
      visionStreamRef.current?.getTracks().forEach((t) => t.stop());
      visionStreamRef.current = null;
      setVisionCameraActive(false);
      return;
    }
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVisionError('Kamera WebRTC tidak tersedia. Gunakan Unggah Foto.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: visionMode === 'mata' || visionMode === 'mulut' ? 'user' : 'environment' },
      });
      visionStreamRef.current = stream;
      setVisionCameraActive(true);
      setTimeout(() => {
        if (visionVideoRef.current) {
          visionVideoRef.current.srcObject = stream;
          visionVideoRef.current.play().catch(() => { });
        }
      }, 60);
    } catch {
      setVisionError('Izin kamera ditolak. Gunakan Unggah Foto dari galeri.');
    }
  };

  const captureVisionSnapshot = () => {
    const video = visionVideoRef.current;
    if (!video || video.readyState < 2) {
      setVisionError('Kamera belum siap.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 180;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 240, 180);
    const imgData = ctx.getImageData(0, 0, 240, 180);
    applyColorimetricResult(analyzeColorimetricImage(imgData.data, 240, 180, mapVisionModeToTarget()));
  };

  const handleImageFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVisionError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 180;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 240, 180);
        const imgData = ctx.getImageData(0, 0, 240, 180);
        applyColorimetricResult(analyzeColorimetricImage(imgData.data, 240, 180, mapVisionModeToTarget()));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const runSimulationPreset = (presetCase: 'anemia' | 'dehidrasi' | 'jamur' | 'kutil' | 'eksim') => {
    setVisionError(null);
    let msg = '';
    if (presetCase === 'anemia') {
      msg = 'Simulasi Mata: Konjungtiva pucat terdeteksi (indikasi skrining Hb/zat besi).';
      onUpsertFinding({
        id: 'active-vision-anemia',
        title: 'Indikasi Konjungtiva Pucat (Skrining Awal Anemia)',
        source: 'active',
        severity: 'perhatian',
        category: 'anemia_fatigue',
        summary: 'Periksa kadar Hb di faskes terdekat. Perbanyak asupan zat besi & vitamin C.',
      });
    } else if (presetCase === 'dehidrasi') {
      msg = 'Simulasi Mulut: Lidah putih & bibir kering (dehidrasi ringan).';
      onUpsertFinding({
        id: 'active-vision-dehidrasi',
        title: 'Dehidrasi Ringan (Lidah/Mukosa Kering)',
        source: 'active',
        severity: 'perhatian',
        category: 'anemia_fatigue',
        summary: 'Tingkatkan hidrasi bertahap (200 ml tiap jam) & elektrolit.',
      });
    } else if (presetCase === 'jamur') {
      setSkinCondition('fungal_active');
      msg = 'Simulasi Kulit: Lesi jamur terdeteksi. Terapi panas dikunci otomatis!';
      onUpsertFinding({
        id: 'active-vision-fungal',
        title: 'Infeksi Jamur Kulit (Panu/Kurap)',
        source: 'active',
        severity: 'perhatian',
        category: 'skin_fungal',
        summary: 'Gunakan salep antijamur topikal & jaga area tetap kering.',
      });
    } else if (presetCase === 'kutil') {
      setSkinCondition('wart_clavus');
      msg = 'Simulasi Kulit: Kutil atau mata ikan terdeteksi. Aman untuk terapi hangat 43 derajat Celsius.';
      onUpsertFinding({
        id: 'active-vision-wart',
        title: 'Kutil / Mata Ikan (Clavus)',
        source: 'active',
        severity: 'perhatian',
        category: 'skin_wart',
        summary: 'Salicylic Acid 10-20% + Guided Hyperthermia 43°C 30 menit/hari.',
      });
    } else {
      setSkinCondition('eczema_acute');
      msg = 'Simulasi Kulit: Eksim meradang terdeteksi. Kompres panas dikunci otomatis!';
      onUpsertFinding({
        id: 'active-vision-eczema',
        title: 'Eksim / Dermatitis Ringan',
        source: 'active',
        severity: 'waspada',
        category: 'skin_eczema',
        summary: 'Gunakan kompres dingin, Hydrocortisone 1% tipis atau gel Aloe vera dingin.',
      });
    }
    setVisionFinding(msg);
    onSpeakResult?.(msg);
  };

  // GRID VIEW (Default: 6 Clean Icon Cards)
  if (!selectedModule) {
    return (
      <View style={{ gap: 12 }}>
        <View style={styles.headerCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>
              {lang === 'en' ? 'Tap 1 Sensor to Check' : 'Pilih 1 Sensor Pemeriksaan'}
            </Text>
            <TouchableOpacity style={styles.goldPill} onPress={onGoToCarePlan}>
              <Text style={styles.goldPillText}>
                {lang === 'en' ? `Plan (${activeFindings.length})` : `Resep (${activeFindings.length})`} →
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.mutedText}>
            {lang === 'en'
              ? 'Tap any icon card below for step-by-step guided physical screening.'
              : 'Sentuh salah satu kartu ikon di bawah untuk panduan pemeriksaan fisik langkah demi langkah.'}
          </Text>
        </View>

        <View style={styles.iconGrid}>
          {SENSOR_CARDS.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              style={[styles.iconCard, { borderColor: item.color + '55' }]}
              onPress={() => setSelectedModule(item.id)}
            >
              <Text style={styles.iconEmoji}>{item.emoji}</Text>
              <Text style={styles.iconTitle}>{lang === 'en' ? item.titleEn : item.titleId}</Text>
              <Text style={styles.iconSub}>{lang === 'en' ? item.subEn : item.subId}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // FOCUSED SENSOR WIZARD VIEW
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.rowBetween}>
        <TouchableOpacity style={styles.backSensorBtn} onPress={() => setSelectedModule(null)}>
          <Ionicons name="arrow-back" size={16} color="#F5E6D3" />
          <Text style={styles.backSensorText}>
            {lang === 'en' ? 'All 6 Sensors' : 'Kembali ke 6 Ikon Sensor'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.goldPill} onPress={onGoToCarePlan}>
          <Text style={styles.goldPillText}>
            {lang === 'en' ? `View Plan (${activeFindings.length})` : `Lihat Resep (${activeFindings.length})`} →
          </Text>
        </TouchableOpacity>
      </View>

      {selectedModule === 'ppg' && (
        <View style={styles.card}>
          <Text style={styles.modTitle}>👆 Sentuhan Jari (Nadi PPG & Uji Ketuk 15 Detik)</Text>
          <Text style={styles.mutedText}>
            Tempelkan ujung jari telunjuk di kamera belakang HP (atau uji kecepatan ketuk layar 15 detik).
          </Text>
          {/* Live PPG Waveform Bars */}
          <View style={styles.waveBox}>
            {ppgWave.map((v, i) => (
              <View key={i} style={[styles.waveBar, { height: Math.max(8, Math.round(v * 0.45)) }]} />
            ))}
          </View>
          <View style={styles.rowGap}>
            <TouchableOpacity style={styles.cyanBtn} onPress={runPpgScan} disabled={ppgRunning}>
              <Text style={styles.cyanBtnText}>
                {ppgRunning ? `Memindai (${ppgProgress}%)...` : 'Ukur PPG Kamera (8d)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setTapCount(0);
                setTapSeconds(15);
                setTapRunning(true);
              }}
            >
              <Text style={styles.secBtnText}>
                {tapRunning ? `Ketuk (${tapSeconds}s)` : 'Uji Ketuk 15s'}
              </Text>
            </TouchableOpacity>
            {tapRunning && (
              <TouchableOpacity style={styles.goldBtn} onPress={() => setTapCount((c) => c + 1)}>
                <Text style={styles.goldBtnText}>KETUK ({tapCount})</Text>
              </TouchableOpacity>
            )}
          </View>
          {Platform.OS === 'web' && (
            <View style={{ display: ppgRunning ? 'flex' : 'none', alignItems: 'center' }}>
              {React.createElement('video', {
                ref: ppgVideoRef,
                muted: true,
                playsInline: true,
                style: { width: 120, height: 88, borderRadius: 10, objectFit: 'cover', border: '1px solid #38BDF8' },
              })}
            </View>
          )}
          {ppgError ? <Text style={styles.errorText}>{ppgError}</Text> : null}
          {ppgResult ? <Text style={styles.resultText}>{ppgResult}</Text> : null}
        </View>
      )}

      {selectedModule === 'ocular' && (
        <View style={styles.card}>
          <Text style={styles.modTitle}>👁️ Tatapan & Kelelahan Mata (TBUT)</Text>
          <Text style={styles.mutedText}>
            Tekan Mulai, tahan mata terbuka tanpa berkedip senyaman mungkin, lalu tekan Saya Berkedip.
          </Text>
          {!tbutRunning ? (
            <TouchableOpacity
              style={styles.cyanBtn}
              onPress={() => {
                setTbutSeconds(0);
                setTbutRunning(true);
              }}
            >
              <Text style={styles.cyanBtnText}>Mulai Uji Tahan Kedip</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.goldBtn} onPress={stopTbutTest}>
              <Text style={styles.goldBtnText}>Saya Berkedip ({tbutSeconds} dtk) — Selesai</Text>
            </TouchableOpacity>
          )}
          {ocularResult ? <Text style={styles.resultText}>{ocularResult}</Text> : null}
        </View>
      )}

      {selectedModule === 'chest_abdomen' && (
        <View style={styles.card}>
          <Text style={styles.modTitle}>❤️ Dada (SCG), Perut & Skrining Ginjal</Text>
          <Text style={styles.mutedText}>
            Tempelkan bagian belakang HP ke dada kiri (SCG) atau perut kanan bawah untuk bising usus.
          </Text>
          <View style={styles.eduBox}>
            <Ionicons name="information-circle" size={18} color="#38BDF8" />
            <Text style={styles.eduText}>
              Catatan Medis Ginjal: Ginjal berada jauh di rongga retroperitoneal sehingga tidak memancarkan suara/getaran ke permukaan perut. Skrining awal dialihkan ke bengkak kelopak mata & pola urin.
            </Text>
          </View>
          <View style={styles.rowGap}>
            <TouchableOpacity style={styles.cyanBtn} onPress={runChestScgScan} disabled={scgRunning}>
              <Text style={styles.cyanBtnText}>
                {scgRunning ? 'Mengukur Dada (8d)...' : 'Rekam SCG Dada (IMU 8d)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={runAbdomenAudioScan} disabled={abdomenRunning}>
              <Text style={styles.secBtnText}>
                {abdomenRunning ? 'Mendengarkan Perut (10d)...' : 'Rekam Bising Usus (10d)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, kidneySymptom === 'edema_or_foamy' && styles.chipWarn]}
              onPress={() => {
                const next = kidneySymptom === 'normal' ? 'edema_or_foamy' : 'normal';
                setKidneySymptom(next);
                if (next === 'edema_or_foamy') {
                  onUpsertFinding({
                    id: 'active-kidney-screen',
                    title: 'Skrining Ginjal: Bengkak Kelopak Mata / Urin Berbusa',
                    source: 'active',
                    severity: 'waspada',
                    category: 'kidney_screen',
                    summary: 'Disarankan cek laboratorium urinalisis & ureum/kreatinin di faskes.',
                  });
                }
              }}
            >
              <Text style={styles.secBtnText}>
                {kidneySymptom === 'edema_or_foamy' ? '⚠ Ada Bengkak Mata/Urin Berbusa' : 'Kelopak Mata & Urin: Normal'}
              </Text>
            </TouchableOpacity>
          </View>
          {scgError ? <Text style={styles.errorText}>{scgError}</Text> : null}
          {scgResult ? <Text style={styles.resultText}>{scgResult}</Text> : null}
        </View>
      )}

      {selectedModule === 'voice' && (
        <View style={styles.card}>
          <Text style={styles.modTitle}>🗣️ Analisis Suara ("Aaaaa..." 5d) & Keluhan</Text>
          <Text style={styles.mutedText}>
            Tulis keluhan Anda lalu ucapkan "Aaaaa..." selama 5 detik untuk mengukur F0, energi & HNR pita suara.
          </Text>
          <TextInput
            value={symptomText}
            onChangeText={setSymptomText}
            placeholder="Mis. suara serak, perut perih/maag, mata buram..."
            placeholderTextColor="#8B735B"
            style={styles.input}
          />
          <TouchableOpacity style={styles.cyanBtn} onPress={runVoiceAndSymptomAnalysis} disabled={voiceActive}>
            <Text style={styles.cyanBtnText}>
              {voiceActive ? 'Merekam Vokal 5 Detik...' : 'Rekam Vokal 5d & Analisis'}
            </Text>
          </TouchableOpacity>
          {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}
          {nlpResult ? <Text style={styles.resultText}>{nlpResult}</Text> : null}
        </View>
      )}

      {selectedModule === 'vision' && (
        <View style={styles.card}>
          <Text style={styles.modTitle}>📸 Kamera Klinis Mata, Mulut & Kulit</Text>
          <Text style={styles.mutedText}>
            Pilih target area, lalu ambil foto kamera atau unggah gambar untuk analisis warna klinis piksel.
          </Text>
          <View style={styles.rowGap}>
            {(['mata', 'mulut', 'kulit'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, visionMode === m && styles.chipActive]}
                onPress={() => setVisionMode(m)}
              >
                <Text style={[styles.secBtnText, visionMode === m && { color: '#1A120B' }]}>
                  {m.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {Platform.OS === 'web' && (
            <View style={styles.rowGap}>
              <TouchableOpacity style={styles.cyanBtn} onPress={toggleVisionCamera}>
                <Text style={styles.cyanBtnText}>
                  {visionCameraActive ? 'Tutup Kamera' : `Buka Kamera (${visionMode.toUpperCase()})`}
                </Text>
              </TouchableOpacity>
              {visionCameraActive && (
                <TouchableOpacity style={styles.goldBtn} onPress={captureVisionSnapshot}>
                  <Text style={styles.goldBtnText}>Ambil & Analisis Foto</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => fileInputRef.current?.click()}>
                <Text style={styles.secBtnText}>Unggah Foto</Text>
              </TouchableOpacity>
              {React.createElement('input', {
                ref: fileInputRef,
                type: 'file',
                accept: 'image/*',
                onChange: handleImageFileUpload,
                style: { display: 'none' },
              })}
            </View>
          )}

          {Platform.OS === 'web' && visionCameraActive && (
            <View style={{ alignItems: 'center' }}>
              {React.createElement('video', {
                ref: visionVideoRef,
                muted: true,
                playsInline: true,
                style: { width: 220, height: 165, borderRadius: 10, objectFit: 'cover', border: '1px solid #D4AF37' },
              })}
            </View>
          )}

          <Text style={styles.mutedText}>Simulasi Uji Cepat (untuk demo desktop):</Text>
          <View style={styles.rowGap}>
            {visionMode === 'mata' && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('anemia')}>
                <Text style={styles.secBtnText}>Simulasi Konjungtiva Pucat</Text>
              </TouchableOpacity>
            )}
            {visionMode === 'mulut' && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('dehidrasi')}>
                <Text style={styles.secBtnText}>Simulasi Mukosa Kering</Text>
              </TouchableOpacity>
            )}
            {visionMode === 'kulit' && (
              <>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('jamur')}>
                  <Text style={styles.secBtnText}>Simulasi Jamur</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('kutil')}>
                  <Text style={styles.secBtnText}>Simulasi Kutil</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('eksim')}>
                  <Text style={styles.secBtnText}>Simulasi Eksim</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          {visionError ? <Text style={styles.errorText}>{visionError}</Text> : null}
          {visionFinding ? <Text style={styles.resultText}>{visionFinding}</Text> : null}
        </View>
      )}

      {selectedModule === 'thermal' && (
        <ThermalTherapyGuide
          detectedSkinCondition={skinCondition}
          onSelectSkinCondition={setSkinCondition}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: { backgroundColor: '#261C15', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#4A3728', gap: 6 },
  card: { backgroundColor: '#261C15', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4A3728', gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { color: '#D4AF37', fontSize: 15, fontWeight: '800' },
  modTitle: { color: '#38BDF8', fontSize: 14, fontWeight: '800' },
  mutedText: { color: '#BFA995', fontSize: 12, lineHeight: 17 },
  goldPill: { backgroundColor: '#D4AF37', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14 },
  goldPillText: { color: '#1A120B', fontSize: 11.5, fontWeight: '800' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconCard: {
    width: '48.4%',
    flexGrow: 1,
    minWidth: 148,
    backgroundColor: '#261C15',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 5,
  },
  iconEmoji: { fontSize: 28 },
  iconTitle: { color: '#F5E6D3', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  iconSub: { color: '#94A3B8', fontSize: 11, textAlign: 'center' },
  backSensorBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#261C15', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: '#4A3728' },
  backSensorText: { color: '#F5E6D3', fontSize: 12, fontWeight: '700' },
  waveBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 48, backgroundColor: '#1A120B', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  waveBar: { flex: 1, backgroundColor: '#38BDF8', borderRadius: 3 },
  resultText: { color: '#10B981', fontSize: 12, fontWeight: '700', backgroundColor: '#1A120B', padding: 9, borderRadius: 8 },
  errorText: { color: '#FCA5A5', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(244,63,94,0.12)', padding: 9, borderRadius: 8 },
  goldBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  goldBtnText: { color: '#1A120B', fontSize: 12, fontWeight: '800' },
  cyanBtn: { backgroundColor: '#38BDF8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start' },
  cyanBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  secondaryBtn: { backgroundColor: '#1A120B', borderWidth: 1, borderColor: '#4A3728', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  secBtnText: { color: '#F5E6D3', fontSize: 12, fontWeight: '700' },
  chip: { backgroundColor: '#1A120B', borderWidth: 1, borderColor: '#4A3728', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#F59E0B' },
  chipWarn: { backgroundColor: 'rgba(244,63,94,0.2)', borderColor: '#F43F5E' },
  eduBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(14,165,233,0.12)', borderColor: '#0EA5E9', borderWidth: 1, padding: 10, borderRadius: 10 },
  eduText: { color: '#E0F2FE', fontSize: 11.5, lineHeight: 16, flex: 1 },
  input: { backgroundColor: '#1A120B', color: '#F5E6D3', borderRadius: 10, borderWidth: 1, borderColor: '#4A3728', paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
});
