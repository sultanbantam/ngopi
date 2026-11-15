import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DetectedFinding } from './medicalKnowledgeBase';
import ThermalTherapyGuide, { SkinConditionFlag } from './ThermalTherapyGuide';
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

interface ActiveScannerProps {
  activeFindings: DetectedFinding[];
  onUpsertFinding: (finding: DetectedFinding) => void;
  onUpdateTelemetry?: (metrics: {
    hrBpm?: number;
    hrvMs?: number;
    vocalEnergyPct?: number;
    hnrDb?: number;
    breathRatePerMin?: number;
  }) => void;
  onGoToCarePlan: () => void;
}

export default function ActiveScanner({
  activeFindings,
  onUpsertFinding,
  onUpdateTelemetry,
  onGoToCarePlan,
}: ActiveScannerProps) {
  // Modul 1: PPG & Finger Tapping Test (15s)
  const [ppgRunning, setPpgRunning] = useState(false);
  const [ppgProgress, setPpgProgress] = useState(0);
  const [ppgResult, setPpgResult] = useState<string | null>(null);
  const [ppgError, setPpgError] = useState<string | null>(null);
  const [tapRunning, setTapRunning] = useState(false);
  const [tapSeconds, setTapSeconds] = useState(15);
  const [tapCount, setTapCount] = useState(0);
  const ppgVideoRef = useRef<HTMLVideoElement | null>(null);
  const ppgStreamRef = useRef<MediaStream | null>(null);

  // Modul 2: Active Ocular Scan (TBUT)
  const [tbutRunning, setTbutRunning] = useState(false);
  const [tbutSeconds, setTbutSeconds] = useState(0);
  const [ocularResult, setOcularResult] = useState<string | null>(null);

  // Modul 3: SCG Chest (IMU) + Abdominal Bowel Sound (Mic) + Kidney Screening
  const [scgRunning, setScgRunning] = useState(false);
  const [abdomenRunning, setAbdomenRunning] = useState(false);
  const [scgResult, setScgResult] = useState<string | null>(null);
  const [scgError, setScgError] = useState<string | null>(null);
  const [kidneySymptom, setKidneySymptom] = useState<'normal' | 'edema_or_foamy'>('normal');

  // Modul 4: Active Voice & Symptom NLP
  const [voiceActive, setVoiceActive] = useState(false);
  const [symptomText, setSymptomText] = useState('');
  const [nlpResult, setNlpResult] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Modul 5: Clinical Computer Vision (Kamera Live / Upload Gambar + Simulasi Uji)
  const [visionMode, setVisionMode] = useState<'mata' | 'mulut' | 'kulit'>('mata');
  const [visionCameraActive, setVisionCameraActive] = useState(false);
  const [visionFinding, setVisionFinding] = useState<string | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const visionVideoRef = useRef<HTMLVideoElement | null>(null);
  const visionStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modul 6: Thermal Safety & Skin Condition
  const [skinCondition, setSkinCondition] = useState<SkinConditionFlag>('wart_clavus');

  // Cleanup active media streams on unmount
  useEffect(() => {
    return () => {
      ppgStreamRef.current?.getTracks().forEach((t) => t.stop());
      visionStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Finger Tapping 15s countdown
  useEffect(() => {
    if (!tapRunning) return;
    if (tapSeconds <= 0) {
      setTapRunning(false);
      const speed = tapCount >= 45 ? 'Normal / Cepat' : tapCount >= 28 ? 'Sedang (Agak Lelah)' : 'Melambat (Kelelahan Motorik)';
      setPpgResult((prev) => `${prev ? prev + '\n' : ''}Finger Tap 15d: ${tapCount} ketukan (${speed}).`);
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
      return;
    }
    const timer = setTimeout(() => setTapSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [tapRunning, tapSeconds, tapCount, onUpsertFinding]);

  // TBUT timer
  useEffect(() => {
    if (!tbutRunning) return;
    const timer = setInterval(() => setTbutSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [tbutRunning]);

  // MODUL 1: Real Fingertip Camera PPG via <video> + <canvas>
  const runPpgScan = async () => {
    if (ppgRunning) return;
    setPpgError(null);
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPpgError('Browser ini tidak mendukung akses kamera WebRTC.');
      return;
    }

    setPpgRunning(true);
    setPpgProgress(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 240 } },
      });
      ppgStreamRef.current = stream;

      // Try enabling torch on mobile browsers that support it
      const videoTrack = stream.getVideoTracks()[0];
      try {
        await (videoTrack as any).applyConstraints?.({ advanced: [{ torch: true }] });
      } catch {
        // Torch optional
      }

      const video = ppgVideoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        setPpgRunning(false);
        setPpgError('Elemen video pratinjau PPG belum siap.');
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
        setPpgError('Canvas 2D context tidak tersedia.');
        return;
      }

      const samples: PpgSample[] = [];
      const startTime = performance.now();
      const durationMs = 8000; // 8 seconds real sampling

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
          samples.push({
            t: performance.now(),
            r: sumR / pixels,
            g: sumG / pixels,
          });
        }

        if (elapsed >= durationMs) {
          window.clearInterval(intervalId);
          stream.getTracks().forEach((t) => t.stop());
          ppgStreamRef.current = null;
          setPpgRunning(false);

          const res = analyzePpgSamples(samples);
          if (!res.valid) {
            setPpgError(res.reason || 'Sinyal PPG tidak cukup jelas.');
            return;
          }

          setPpgResult(
            `PPG Terukur (${samples.length} frame, Kualitas: ${res.signalQuality.toUpperCase()}): Detak Jantung ${res.hrBpm} bpm • Est. SpO2 ${res.spo2Estimate}% • HRV ${res.hrvMs} ms • Indeks Perfusi ${res.perfusionIndexPct}%.`
          );
          onUpdateTelemetry?.({ hrBpm: res.hrBpm, hrvMs: res.hrvMs });

          if (res.hrBpm > 105 || res.hrvMs < 25) {
            onUpsertFinding({
              id: 'active-ppg-stress',
              title: 'Takikardia Ringan / Beban Stres Otonom',
              source: 'active',
              severity: 'perhatian',
              category: 'motor_nerve',
              summary: `HR terukur ${res.hrBpm} bpm dan HRV ${res.hrvMs} ms. Disarankan relaksasi & hidrasi.`,
            });
          }
        }
      }, 40); // ~25 fps
    } catch (err: any) {
      setPpgRunning(false);
      setPpgError(
        err?.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Aktifkan izin kamera pada browser Anda.'
          : 'Kamera belakang/webcam tidak ditemukan atau sedang digunakan aplikasi lain.'
      );
    }
  };

  // MODUL 2: TBUT
  const stopTbutTest = () => {
    setTbutRunning(false);
    const status = tbutSeconds < 10 ? 'Indikasi Mata Kering (TBUT < 10 dtk)' : 'Stabil (TBUT >= 10 dtk)';
    setOcularResult(`Hasil TBUT: Tahan kedip ${tbutSeconds} detik → ${status}.`);
    if (tbutSeconds < 10) {
      onUpsertFinding({
        id: 'active-ocular-tbut',
        title: 'Mata Kering (Tear Break-Up Time Rendah)',
        source: 'active',
        severity: 'perhatian',
        category: 'ocular',
        summary: `TBUT hanya ${tbutSeconds} detik (< 10 dtk). Terapkan aturan 20-20-20 & kompres hangat kelopak mata.`,
      });
    }
  };

  // MODUL 3A: Real Chest SCG via DeviceMotionEvent (8 detik)
  const runChestScgScan = async () => {
    if (scgRunning) return;
    setScgError(null);
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      setScgError('Sensor akselerometer (DeviceMotion) tidak tersedia pada perangkat ini.');
      return;
    }

    try {
      const DME = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (DME && typeof DME.requestPermission === 'function') {
        const perm = await DME.requestPermission();
        if (perm !== 'granted') {
          setScgError('Izin sensor gerak ditolak oleh perangkat.');
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
      samples.push({
        t: performance.now(),
        x: acc.x ?? 0,
        y: acc.y ?? 0,
        z: acc.z ?? 0,
      });
    };

    window.addEventListener('devicemotion', onMotion, { passive: true });
    window.setTimeout(() => {
      window.removeEventListener('devicemotion', onMotion);
      setScgRunning(false);
      const res = analyzeMotionSamples(samples);
      if (!res.valid) {
        setScgError(res.reason || 'Data SCG IMU tidak mencukupi (biasanya hanya tersedia di HP/tablet).');
        return;
      }
      setScgResult(
        `SCG IMU Terukur (${samples.length} sampel): Est. Nadi ${res.estimatedBpm} bpm • Napas ${res.breathRatePerMin}x/mnt • Frekuensi Dominan ${res.dominantHz} Hz.`
      );
      onUpdateTelemetry?.({ hrBpm: res.estimatedBpm, breathRatePerMin: res.breathRatePerMin });
    }, 8000);
  };

  // MODUL 3B: Real Abdominal Bowel Sound via Web AudioContext (10 detik)
  const runAbdomenAudioScan = async () => {
    if (abdomenRunning) return;
    setScgError(null);
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScgError('Browser ini tidak mendukung akses mikrofon.');
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
        ctx.close().catch(() => {});
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
          setScgError(res.reason || 'Gagal menganalisis audio abdomen.');
          return;
        }
        const label =
          res.classification === 'normoactive'
            ? 'Normal (Normoaktif)'
            : res.classification === 'hyperactive'
            ? 'Hiperaktif (Peristaltik Meningkat)'
            : res.classification === 'hypoactive'
            ? 'Hipoaktif (Melambat)'
            : 'Hening (Tidak ada bunyi usus terdengar)';
        setScgResult(
          `Auskultasi Perut (10 dtk): ${res.burstCount} letupan (${res.burstsPerMinute}x/mnt) • Puncak ${res.meanPeakDb} dBFS → ${label}.`
        );
        if (res.classification === 'hyperactive') {
          onUpsertFinding({
            id: 'active-abdomen-hyper',
            title: 'Peristaltik Usus Meningkat (Hiperaktif)',
            source: 'active',
            severity: 'perhatian',
            category: 'gastric',
            summary: `Terdeteksi ${res.burstsPerMinute}x/menit bunyi usus. Jaga hidrasi oralit/air putih dan pantau gejala diare/kembung.`,
          });
        }
      }, 10000);
    } catch (err: any) {
      setAbdomenRunning(false);
      setScgError(
        err?.name === 'NotAllowedError'
          ? 'Izin mikrofon ditolak.'
          : 'Mikrofon tidak tersedia di perangkat ini.'
      );
    }
  };

  // MODUL 4: Real 5s Microphone Vocal Biomarkers + Symptom NLP
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
          ctx.close().catch(() => {});

          const total = chunks.reduce((a, b) => a + b.length, 0);
          const merged = new Float32Array(total);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }

          const res = analyzeVocalPcm(merged, sr);
          if (res.valid) {
            vocalSummary = `Vokal Terukur (5d): F0 ${res.f0Hz} Hz • Energi ${res.rmsEnergyPct}% • HNR ${res.hnrDb} dB • Jitter ${res.jitterPct}%.`;
            onUpdateTelemetry?.({ vocalEnergyPct: res.rmsEnergyPct, hnrDb: res.hnrDb });
            if (res.hnrDb < 14 || res.jitterPct > 2.2) {
              onUpsertFinding({
                id: 'active-voice-hoarse',
                title: 'Suara Serak / Kelelahan Pita Suara (HNR Rendah)',
                source: 'active',
                severity: 'perhatian',
                category: 'vocal_throat',
                summary: `Terukur HNR ${res.hnrDb} dB & Jitter ${res.jitterPct}%. Perbanyak air hangat, madu, dan istirahatkan suara.`,
              });
            }
          } else {
            setVoiceError(res.reason || 'Suara terlalu pelan untuk dihitung F0/HNR.');
          }
        }
      } catch (err: any) {
        setVoiceError(
          err?.name === 'NotAllowedError'
            ? 'Izin mikrofon ditolak; hanya analisis teks keluhan yang dijalankan.'
            : 'Mikrofon tidak tersedia; hanya analisis teks keluhan yang dijalankan.'
        );
      }
    }

    const lower = symptomText.toLowerCase();
    const detectedTags: string[] = [];
    if (lower.includes('serak') || lower.includes('batuk') || lower.includes('tenggorok') || lower.includes('pilek')) {
      detectedTags.push('ISPA / Tenggorokan');
      onUpsertFinding({
        id: 'active-nlp-throat',
        title: 'Keluhan Tenggorokan / Batuk Ringan (NLP)',
        source: 'active',
        severity: 'perhatian',
        category: 'vocal_throat',
        summary: `Keluhan terdeteksi dari teks: "${symptomText.slice(0, 60)}"`,
      });
    }
    if (lower.includes('maag') || lower.includes('perih') || lower.includes('mual') || lower.includes('kembung')) {
      detectedTags.push('Lambung / Dispepsia');
      onUpsertFinding({
        id: 'active-nlp-gi',
        title: 'Dispepsia / Asam Lambung Ringan',
        source: 'active',
        severity: 'perhatian',
        category: 'gastric',
        summary: 'Keluhan lambung terdeteksi. Rekomendasi antasida / jahe hangat.',
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

    setNlpResult(
      `${vocalSummary || 'Audio belum terukur.'}\nNLP Keluhan: ${
        detectedTags.length > 0 ? detectedTags.join(', ') : 'Tidak ada kata kunci gejala akut.'
      }`
    );
    setVoiceActive(false);
  };

  // MODUL 5: Real Camera / Upload Colorimetric Vision Analysis
  const mapVisionModeToTarget = (): VisionTargetRegion =>
    visionMode === 'mata' ? 'eye' : visionMode === 'mulut' ? 'mouth' : 'skin';

  const applyColorimetricResult = (res: ReturnType<typeof analyzeColorimetricImage>) => {
    if (!res.valid) {
      setVisionError(res.reason || 'Gambar tidak dapat dianalisis.');
      return;
    }
    setVisionFinding(
      `Hasil Analisis Piksel Nyata (${res.confidencePct}% keyakinan) • RGB(${res.meanR},${res.meanG},${res.meanB}):\n${res.summary}`
    );

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
        summary: 'Gunakan kompres dingin, Hydrocortisone 1% tipis atau gel Aloe vera dingin.',
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
        summary: 'Rekomendasi Salicylic Acid 10-20% + Guided Hyperthermia 43°C 30 menit/hari.',
      });
    }
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
      setVisionError('Browser tidak mendukung kamera WebRTC. Gunakan unggah foto.');
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
          visionVideoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err: any) {
      setVisionError(
        err?.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Anda masih bisa mengunggah foto dari galeri.'
          : 'Kamera tidak tersedia. Gunakan tombol Unggah Foto untuk analisis nyata.'
      );
    }
  };

  const captureVisionSnapshot = () => {
    const video = visionVideoRef.current;
    if (!video || video.readyState < 2) {
      setVisionError('Kamera belum siap. Tunggu 1 detik atau unggah foto.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 180;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 240, 180);
    const imgData = ctx.getImageData(0, 0, 240, 180);
    const res = analyzeColorimetricImage(imgData.data, 240, 180, mapVisionModeToTarget());
    applyColorimetricResult(res);
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
        const res = analyzeColorimetricImage(imgData.data, 240, 180, mapVisionModeToTarget());
        applyColorimetricResult(res);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const runSimulationPreset = (presetCase: 'anemia' | 'dehidrasi' | 'jamur' | 'kutil' | 'eksim') => {
    setVisionError(null);
    if (presetCase === 'anemia') {
      setVisionFinding('[Simulasi Uji] Mata: Konjungtiva pucat (indikasi awal Hb rendah / anemia ringan).');
      onUpsertFinding({
        id: 'active-vision-anemia',
        title: 'Indikasi Konjungtiva Pucat (Skrining Awal Anemia)',
        source: 'active',
        severity: 'perhatian',
        category: 'anemia_fatigue',
        summary: 'Periksa kadar Hb di faskes terdekat. Perbanyak asupan zat besi & vitamin C.',
      });
    } else if (presetCase === 'dehidrasi') {
      setVisionFinding('[Simulasi Uji] Mulut: Lapisan lidah putih & bibir kering → Indikasi dehidrasi ringan.');
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
      setVisionFinding('[Simulasi Uji] Kulit: Lesi tepi aktif → Indikasi infeksi jamur (Panu/Kurap). Kompres hangat dikunci!');
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
      setVisionFinding('[Simulasi Uji] Kulit: Hiperkeratosis terlokalisir (Kutil / Mata Ikan). Aman untuk terapi 43°C.');
      onUpsertFinding({
        id: 'active-vision-wart',
        title: 'Kutil / Mata Ikan (Clavus)',
        source: 'active',
        severity: 'perhatian',
        category: 'skin_wart',
        summary: 'Rekomendasi Salicylic Acid 10-20% + Guided Hyperthermia 43°C 30 menit/hari.',
      });
    } else {
      setSkinCondition('eczema_acute');
      setVisionFinding('[Simulasi Uji] Kulit: Eritema meradang (Eksim). Kompres panas dikunci otomatis!');
      onUpsertFinding({
        id: 'active-vision-eczema',
        title: 'Eksim / Dermatitis Ringan',
        source: 'active',
        severity: 'waspada',
        category: 'skin_eczema',
        summary: 'Gunakan kompres dingin, Hydrocortisone 1% tipis atau gel Aloe vera dingin.',
      });
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Summary Header */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Pemeriksaan Mandiri 6 Modul Sensor Nyata</Text>
          <TouchableOpacity style={styles.goldBtn} onPress={onGoToCarePlan}>
            <Text style={styles.goldBtnText}>Lihat Resep ({activeFindings.length} Temuan) →</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.mutedText}>
          Menggunakan sensor perangkat nyata: Kamera PPG (detak nadi & HRV), Mikrofon DSP (F0, HNR, bising usus), IMU Akselerometer (SCG), serta Analisis Warna Piksel Kamera/Foto.
        </Text>
      </View>

      {/* Modul 1: Sentuhan Jari */}
      <View style={styles.card}>
        <Text style={styles.modTitle}>Modul 1: Sentuhan Jari (Fingertip Camera PPG 8d & Finger Tap 15d)</Text>
        <View style={styles.rowGap}>
          <TouchableOpacity
            style={styles.cyanBtn}
            onPress={() => {
              setTapCount(0);
              setTapSeconds(15);
              setTapRunning(true);
            }}
          >
            <Text style={styles.cyanBtnText}>{tapRunning ? `Ketuk Cepat (${tapSeconds}s)` : 'Mulai Uji Ketuk 15s'}</Text>
          </TouchableOpacity>
          {tapRunning ? (
            <TouchableOpacity style={styles.goldBtn} onPress={() => setTapCount((c) => c + 1)}>
              <Text style={styles.goldBtnText}>KETUK DI SINI ({tapCount})</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.secondaryBtn} onPress={runPpgScan} disabled={ppgRunning}>
            <Text style={styles.secBtnText}>
              {ppgRunning ? `Memindai PPG (${ppgProgress}%)...` : 'Ukur PPG Jari (Kamera 8d)'}
            </Text>
          </TouchableOpacity>
        </View>
        {Platform.OS === 'web' && (
          <View style={{ display: ppgRunning ? 'flex' : 'none', alignItems: 'center', marginTop: 4 }}>
            {React.createElement('video', {
              ref: ppgVideoRef,
              muted: true,
              playsInline: true,
              style: { width: 140, height: 100, borderRadius: 10, objectFit: 'cover', border: '1px solid #38BDF8' },
            })}
            <Text style={styles.mutedText}>Tempelkan ujung jari menutupi lensa kamera belakang dengan pencahayaan cukup.</Text>
          </View>
        )}
        {ppgError ? <Text style={styles.errorText}>{ppgError}</Text> : null}
        {ppgResult ? <Text style={styles.resultText}>{ppgResult}</Text> : null}
      </View>

      {/* Modul 2: Intensitas Tatapan & Mata */}
      <View style={styles.card}>
        <Text style={styles.modTitle}>Modul 2: Intensitas Tatapan & Kelelahan Mata (Active Ocular Scan / TBUT)</Text>
        <View style={styles.rowGap}>
          {!tbutRunning ? (
            <TouchableOpacity
              style={styles.cyanBtn}
              onPress={() => {
                setTbutSeconds(0);
                setTbutRunning(true);
              }}
            >
              <Text style={styles.cyanBtnText}>Mulai Uji Tahan Kedip (Stopwatch Nyata)</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.goldBtn} onPress={stopTbutTest}>
              <Text style={styles.goldBtnText}>Saya Berkedip ({tbutSeconds} dtk) — Selesai</Text>
            </TouchableOpacity>
          )}
        </View>
        {ocularResult ? <Text style={styles.resultText}>{ocularResult}</Text> : null}
      </View>

      {/* Modul 3: Dada, Perut & Skrining Ginjal */}
      <View style={styles.card}>
        <Text style={styles.modTitle}>Modul 3: SCG Dada (IMU) & Auskultasi Perut (Mikrofon) + Skrining Ginjal</Text>
        <View style={styles.eduBox}>
          <Ionicons name="information-circle" size={18} color="#38BDF8" />
          <Text style={styles.eduText}>
            Catatan Medis Ginjal: Ginjal berada jauh di rongga retroperitoneal sehingga tidak memancarkan getaran mekanis/suara ke permukaan perut. Skrining awal ginjal dialihkan ke deteksi bengkak kelopak mata & pola urin.
          </Text>
        </View>
        <View style={styles.rowGap}>
          <TouchableOpacity style={styles.cyanBtn} onPress={runChestScgScan} disabled={scgRunning}>
            <Text style={styles.cyanBtnText}>
              {scgRunning ? 'Mengukur Getaran Dada (8d)...' : 'Ukur SCG Dada (IMU 8d)'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={runAbdomenAudioScan} disabled={abdomenRunning}>
            <Text style={styles.secBtnText}>
              {abdomenRunning ? 'Mendengarkan Perut (10d)...' : 'Rekam Bising Usus (Mikrofon 10d)'}
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
                  summary: 'Disarankan cek laboratorium urinalisis & fungsi ginjal (ureum/kreatinin) ke fasilitas kesehatan.',
                });
              }
            }}
          >
            <Text style={styles.secBtnText}>
              {kidneySymptom === 'edema_or_foamy' ? '⚠ Ada Bengkak Mata/Urin Berbusa' : 'Kuesioner Ginjal: Normal'}
            </Text>
          </TouchableOpacity>
        </View>
        {scgError ? <Text style={styles.errorText}>{scgError}</Text> : null}
        {scgResult ? <Text style={styles.resultText}>{scgResult}</Text> : null}
      </View>

      {/* Modul 4: Analisis Suara Aktif & Keluhan */}
      <View style={styles.card}>
        <Text style={styles.modTitle}>Modul 4: Analisis Suara Aktif ("Aaaaa..." 5 Detik) & NLP Keluhan</Text>
        <TextInput
          value={symptomText}
          onChangeText={setSymptomText}
          placeholder="Tulis keluhan Anda (mis. suara serak, perut perih/maag, mata buram)..."
          placeholderTextColor="#8B735B"
          style={styles.input}
        />
        <TouchableOpacity style={styles.cyanBtn} onPress={runVoiceAndSymptomAnalysis} disabled={voiceActive}>
          <Text style={styles.cyanBtnText}>
            {voiceActive ? 'Merekam Vokal 5 Detik...' : 'Rekam Vokal 5 Detik & Analisis Keluhan'}
          </Text>
        </TouchableOpacity>
        {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}
        {nlpResult ? <Text style={styles.resultText}>{nlpResult}</Text> : null}
      </View>

      {/* Modul 5: Kamera Klinis Mata, Mulut & Kulit */}
      <View style={styles.card}>
        <Text style={styles.modTitle}>Modul 5: Kamera Klinis Mata, Mulut & Kulit (Colorimetric Vision)</Text>
        <View style={styles.rowGap}>
          {(['mata', 'mulut', 'kulit'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, visionMode === m && styles.chipActive]}
              onPress={() => setVisionMode(m)}
            >
              <Text style={[styles.secBtnText, visionMode === m && { color: '#1A120B' }]}>
                Mode {m.toUpperCase()}
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
                <Text style={styles.goldBtnText}>Ambil & Analisis Foto Sekarang</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => fileInputRef.current?.click()}
            >
              <Text style={styles.secBtnText}>Unggah Foto dari Galeri</Text>
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
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            {React.createElement('video', {
              ref: visionVideoRef,
              muted: true,
              playsInline: true,
              style: { width: 240, height: 180, borderRadius: 10, objectFit: 'cover', border: '1px solid #D4AF37' },
            })}
          </View>
        )}

        <Text style={styles.mutedText}>Atau pilih Simulasi Uji Kasus (jika menguji di desktop tanpa foto):</Text>
        <View style={styles.rowGap}>
          {visionMode === 'mata' ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('anemia')}>
              <Text style={styles.secBtnText}>Simulasi Uji: Konjungtiva Pucat</Text>
            </TouchableOpacity>
          ) : null}
          {visionMode === 'mulut' ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('dehidrasi')}>
              <Text style={styles.secBtnText}>Simulasi Uji: Mukosa Kering</Text>
            </TouchableOpacity>
          ) : null}
          {visionMode === 'kulit' ? (
            <>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('jamur')}>
                <Text style={styles.secBtnText}>Simulasi Uji: Jamur</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('kutil')}>
                <Text style={styles.secBtnText}>Simulasi Uji: Kutil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => runSimulationPreset('eksim')}>
                <Text style={styles.secBtnText}>Simulasi Uji: Eksim</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
        {visionError ? <Text style={styles.errorText}>{visionError}</Text> : null}
        {visionFinding ? <Text style={styles.resultText}>{visionFinding}</Text> : null}
      </View>

      {/* Modul 6: Thermal Safety & Guided Hyperthermia */}
      <ThermalTherapyGuide
        detectedSkinCondition={skinCondition}
        onSelectSkinCondition={setSkinCondition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#261C15', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4A3728', gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { color: '#D4AF37', fontSize: 16, fontWeight: '800' },
  modTitle: { color: '#38BDF8', fontSize: 14, fontWeight: '800' },
  mutedText: { color: '#BFA995', fontSize: 12, lineHeight: 17 },
  resultText: { color: '#10B981', fontSize: 12, fontWeight: '700', backgroundColor: '#1A120B', padding: 8, borderRadius: 8 },
  errorText: { color: '#FCA5A5', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(244,63,94,0.12)', padding: 8, borderRadius: 8 },
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
  eduText: { color: '#E0F2FE', fontSize: 12, lineHeight: 17, flex: 1 },
  input: { backgroundColor: '#1A120B', color: '#F5E6D3', borderRadius: 10, borderWidth: 1, borderColor: '#4A3728', paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
});
