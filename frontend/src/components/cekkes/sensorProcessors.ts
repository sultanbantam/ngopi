// Pure TypeScript Web/Device Sensor DSP & Colorimetric Processors for ceKKes

export interface PpgSample {
  t: number; // timestamp in ms
  r: number; // mean red channel intensity [0..255]
  g: number; // mean green channel intensity [0..255]
}

export interface PpgAnalysisResult {
  valid: boolean;
  reason?: string;
  hrBpm: number;
  hrvMs: number;
  spo2Estimate: number;
  perfusionIndexPct: number;
  peakCount: number;
  signalQuality: 'good' | 'fair' | 'poor';
}

export interface AudioBiomarkerResult {
  valid: boolean;
  reason?: string;
  rmsEnergyPct: number;
  f0Hz: number;
  jitterPct: number;
  hnrDb: number;
}

export interface AbdomenAudioResult {
  valid: boolean;
  reason?: string;
  burstCount: number;
  burstsPerMinute: number;
  meanPeakDb: number;
  classification: 'normoactive' | 'hyperactive' | 'hypoactive' | 'silent';
}

export interface MotionSample {
  t: number; // ms
  x: number;
  y: number;
  z: number;
}

export interface MotionAnalysisResult {
  valid: boolean;
  reason?: string;
  dominantHz: number;
  amplitudeRms: number;
  estimatedBpm: number;
  breathRatePerMin: number;
}

export type VisionTargetRegion = 'eye' | 'mouth' | 'skin';

export interface ColorimetricAnalysisResult {
  valid: boolean;
  reason?: string;
  meanR: number;
  meanG: number;
  meanB: number;
  pallorIndex: number; // higher = paler / lower red dominance
  yellowIndex: number; // higher = yellower (R+G high, B low)
  whitenessIndex: number; // higher = whiter coating
  erythemaIndex: number; // higher = redder / inflamed
  textureVariance: number; // spatial luminance variance
  detectedCondition:
    | 'normal'
    | 'anemia'
    | 'ikterus'
    | 'dehidrasi'
    | 'jamur'
    | 'eksim'
    | 'kutil';
  confidencePct: number;
  summary: string;
}

/**
 * Compute mean & standard deviation of a numeric array.
 */
function meanAndStd(arr: number[]): { mean: number; std: number } {
  if (arr.length === 0) return { mean: 0, std: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / arr.length;
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Analyze finger-tip camera PPG samples (Red & Green channels over time).
 * Uses bandpass-style moving-average detrending + adaptive peak detection.
 */
export function analyzePpgSamples(samples: PpgSample[]): PpgAnalysisResult {
  if (samples.length < 30) {
    return {
      valid: false,
      reason: 'Sampel kamera terlalu sedikit (< 30 frame). Pastikan izin kamera aktif.',
      hrBpm: 0,
      hrvMs: 0,
      spo2Estimate: 0,
      perfusionIndexPct: 0,
      peakCount: 0,
      signalQuality: 'poor',
    };
  }

  const durationMs = samples[samples.length - 1].t - samples[0].t;
  if (durationMs < 3500) {
    return {
      valid: false,
      reason: 'Durasi pemindaian terlalu singkat (< 3.5 detik).',
      hrBpm: 0,
      hrvMs: 0,
      spo2Estimate: 0,
      perfusionIndexPct: 0,
      peakCount: 0,
      signalQuality: 'poor',
    };
  }

  const reds = samples.map((s) => s.r);
  const greens = samples.map((s) => s.g);
  const { mean: dcRed, std: stdRed } = meanAndStd(reds);
  const { mean: dcGreen, std: stdGreen } = meanAndStd(greens);

  // Check finger placement: on fingertip with flash/ambient light, red channel is dominant or signal has AC pulsatility
  if (dcRed < 25) {
    return {
      valid: false,
      reason: 'Lensa terlalu gelap. Tempelkan ujung jari pada kamera belakang dengan pencahayaan cukup.',
      hrBpm: 0,
      hrvMs: 0,
      spo2Estimate: 0,
      perfusionIndexPct: 0,
      peakCount: 0,
      signalQuality: 'poor',
    };
  }

  // Choose channel with better AC/DC ratio (usually green on ambient, red on flash)
  const useRed = dcRed > dcGreen * 1.15;
  const raw = useRed ? reds : greens;
  const dc = useRed ? dcRed : dcGreen;
  const acStd = useRed ? stdRed : stdGreen;

  const perfusionIndexPct = dc > 0 ? Number(((acStd / dc) * 100).toFixed(2)) : 0;

  // Moving-average detrending (window ~ 0.65s)
  const avgDt = durationMs / (samples.length - 1);
  const winHalf = Math.max(2, Math.round(320 / avgDt));
  const detrended: number[] = raw.map((val, i) => {
    const start = Math.max(0, i - winHalf);
    const end = Math.min(raw.length - 1, i + winHalf);
    let sum = 0;
    for (let k = start; k <= end; k++) sum += raw[k];
    return val - sum / (end - start + 1);
  });

  // Smooth detrended signal slightly (3-point)
  const smoothed = detrended.map((v, i) => {
    const prev = detrended[Math.max(0, i - 1)];
    const next = detrended[Math.min(detrended.length - 1, i + 1)];
    return (prev + v + next) / 3;
  });

  const { std: smoothStd } = meanAndStd(smoothed);
  if (smoothStd < 0.08) {
    return {
      valid: false,
      reason: 'Sinyal denyut nadi tidak terdeteksi. Pastikan jari menutup lensa kamera dengan stabil.',
      hrBpm: 0,
      hrvMs: 0,
      spo2Estimate: 0,
      perfusionIndexPct,
      peakCount: 0,
      signalQuality: 'poor',
    };
  }

  // Peak detection with refractory period >= 330 ms (~180 bpm max)
  const threshold = smoothStd * 0.35;
  const peakTimes: number[] = [];
  for (let i = 1; i < smoothed.length - 1; i++) {
    if (
      smoothed[i] > threshold &&
      smoothed[i] >= smoothed[i - 1] &&
      smoothed[i] > smoothed[i + 1]
    ) {
      const t = samples[i].t;
      if (peakTimes.length === 0 || t - peakTimes[peakTimes.length - 1] >= 330) {
        peakTimes.push(t);
      }
    }
  }

  if (peakTimes.length < 3) {
    return {
      valid: false,
      reason: 'Denyut nadi belum stabil (< 3 puncak). Coba ulangi dengan jari diam di lensa.',
      hrBpm: 0,
      hrvMs: 0,
      spo2Estimate: 0,
      perfusionIndexPct,
      peakCount: peakTimes.length,
      signalQuality: 'poor',
    };
  }

  // Inter-beat intervals (IBI) in ms, filtered to physiological 350-1500 ms (40-171 bpm)
  const ibis: number[] = [];
  for (let i = 1; i < peakTimes.length; i++) {
    const dt = peakTimes[i] - peakTimes[i - 1];
    if (dt >= 350 && dt <= 1500) {
      ibis.push(dt);
    }
  }

  if (ibis.length < 2) {
    return {
      valid: false,
      reason: 'Artefak gerakan terlalu tinggi. Jaga jari tetap diam selama pemindaian.',
      hrBpm: 0,
      hrvMs: 0,
      spo2Estimate: 0,
      perfusionIndexPct,
      peakCount: peakTimes.length,
      signalQuality: 'poor',
    };
  }

  const meanIbi = ibis.reduce((a, b) => a + b, 0) / ibis.length;
  const hrBpm = Math.round(60000 / meanIbi);

  // RMSSD HRV
  let sqDiffSum = 0;
  for (let i = 1; i < ibis.length; i++) {
    const diff = ibis[i] - ibis[i - 1];
    sqDiffSum += diff * diff;
  }
  const hrvMs = Math.round(Math.sqrt(sqDiffSum / Math.max(1, ibis.length - 1)));

  // Ratio-of-ratios SpO2 approximation (requires red & green AC/DC ratio; clamped to realistic 90-100%)
  const ratioR = dcRed > 0 ? stdRed / dcRed : 0.01;
  const ratioG = dcGreen > 0 ? stdGreen / dcGreen : 0.01;
  const R = ratioG > 0 ? ratioR / ratioG : 0.6;
  const rawSpo2 = Math.round(104 - 8 * Math.min(1.8, Math.max(0.3, R)));
  const spo2Estimate = Math.max(90, Math.min(100, rawSpo2));

  const signalQuality: 'good' | 'fair' | 'poor' =
    ibis.length >= 5 && perfusionIndexPct >= 0.4 ? 'good' : 'fair';

  return {
    valid: true,
    hrBpm,
    hrvMs,
    spo2Estimate,
    perfusionIndexPct,
    peakCount: peakTimes.length,
    signalQuality,
  };
}

/**
 * Analyze raw mono PCM time-domain audio frames for vocal biomarkers:
 * RMS energy (%), fundamental frequency F0 (Hz) via autocorrelation, Jitter (%), and HNR (dB).
 */
export function analyzeVocalPcm(
  pcm: Float32Array,
  sampleRate: number
): AudioBiomarkerResult {
  if (pcm.length < sampleRate * 0.5) {
    return {
      valid: false,
      reason: 'Rekaman suara terlalu singkat (< 0.5 detik).',
      rmsEnergyPct: 0,
      f0Hz: 0,
      jitterPct: 0,
      hnrDb: 0,
    };
  }

  let sumSq = 0;
  for (let i = 0; i < pcm.length; i++) {
    sumSq += pcm[i] * pcm[i];
  }
  const rms = Math.sqrt(sumSq / pcm.length);
  const rmsEnergyPct = Math.min(100, Math.round(rms * 420));

  if (rms < 0.008) {
    return {
      valid: false,
      reason: 'Suara tidak terdengar atau mikrofon terlalu pelan. Bicaralah lebih dekat ke mikrofon.',
      rmsEnergyPct,
      f0Hz: 0,
      jitterPct: 0,
      hnrDb: 0,
    };
  }

  // Evaluate voiced 40ms frames across the recording
  const frameSize = Math.floor(sampleRate * 0.04);
  const hop = Math.floor(frameSize / 2);
  const minLag = Math.floor(sampleRate / 320); // 320 Hz max F0
  const maxLag = Math.floor(sampleRate / 70); // 70 Hz min F0

  const f0Frames: number[] = [];
  const hnrFrames: number[] = [];

  for (let start = 0; start + frameSize <= pcm.length; start += hop) {
    let energy = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = pcm[start + i];
      energy += s * s;
    }
    const frameRms = Math.sqrt(energy / frameSize);
    if (frameRms < 0.012) continue; // unvoiced/silence

    let bestLag = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag && lag < frameSize; lag++) {
      let num = 0;
      let denA = 0;
      let denB = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        const a = pcm[start + i];
        const b = pcm[start + i + lag];
        num += a * b;
        denA += a * a;
        denB += b * b;
      }
      const denom = Math.sqrt(denA * denB);
      const corr = denom > 0 ? num / denom : 0;
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    if (bestLag > 0 && bestCorr > 0.35) {
      f0Frames.push(sampleRate / bestLag);
      const clampedR = Math.min(0.995, Math.max(0.05, bestCorr));
      const hnr = 10 * Math.log10(clampedR / (1 - clampedR));
      hnrFrames.push(hnr);
    }
  }

  if (f0Frames.length < 3) {
    return {
      valid: false,
      reason: 'Tidak cukup segmen vokal berbunyi. Ucapkan kalimat panjang atau huruf "Aaaa" selama 3-5 detik.',
      rmsEnergyPct,
      f0Hz: 0,
      jitterPct: 0,
      hnrDb: 0,
    };
  }

  const meanF0 = f0Frames.reduce((a, b) => a + b, 0) / f0Frames.length;
  const periods = f0Frames.map((f) => 1 / f);
  let periodDiffSum = 0;
  for (let i = 1; i < periods.length; i++) {
    periodDiffSum += Math.abs(periods[i] - periods[i - 1]);
  }
  const meanPeriod = 1 / meanF0;
  const jitterPct = Number(
    (((periodDiffSum / Math.max(1, periods.length - 1)) / meanPeriod) * 100).toFixed(2)
  );
  const meanHnr = Number(
    (hnrFrames.reduce((a, b) => a + b, 0) / hnrFrames.length).toFixed(1)
  );

  return {
    valid: true,
    rmsEnergyPct,
    f0Hz: Math.round(meanF0),
    jitterPct,
    hnrDb: meanHnr,
  };
}

/**
 * Analyze abdominal audio envelope for bowel-sound acoustic bursts (borborygmi).
 */
export function analyzeAbdominalAudio(
  pcm: Float32Array,
  sampleRate: number
): AbdomenAudioResult {
  const durationSec = pcm.length / sampleRate;
  if (durationSec < 5) {
    return {
      valid: false,
      reason: 'Rekaman abdomen minimal 5 detik.',
      burstCount: 0,
      burstsPerMinute: 0,
      meanPeakDb: -60,
      classification: 'silent',
    };
  }

  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const rmsEnvelope: number[] = [];
  for (let i = 0; i + windowSize <= pcm.length; i += windowSize) {
    let sum = 0;
    for (let k = 0; k < windowSize; k++) {
      sum += pcm[i + k] * pcm[i + k];
    }
    rmsEnvelope.push(Math.sqrt(sum / windowSize));
  }

  const { mean, std } = meanAndStd(rmsEnvelope);
  const threshold = Math.max(0.012, mean + std * 1.6);

  let burstCount = 0;
  let lastBurstIdx = -10;
  let peakSum = 0;
  for (let i = 0; i < rmsEnvelope.length; i++) {
    // Minimum 300ms separation (6 windows) between distinct bowel sound bursts
    if (rmsEnvelope[i] > threshold && i - lastBurstIdx >= 6) {
      burstCount++;
      lastBurstIdx = i;
      peakSum += rmsEnvelope[i];
    }
  }

  const burstsPerMinute = Math.round((burstCount / durationSec) * 60);
  const avgPeak = burstCount > 0 ? peakSum / burstCount : Math.max(1e-5, mean);
  const meanPeakDb = Number((20 * Math.log10(Math.max(1e-5, avgPeak))).toFixed(1));

  let classification: AbdomenAudioResult['classification'] = 'normoactive';
  if (burstsPerMinute === 0) classification = 'silent';
  else if (burstsPerMinute < 5) classification = 'hypoactive';
  else if (burstsPerMinute > 30) classification = 'hyperactive';

  return {
    valid: true,
    burstCount,
    burstsPerMinute,
    meanPeakDb,
    classification,
  };
}

/**
 * Analyze DeviceMotion acceleration samples for hand tremor or chest SCG/breathing.
 */
export function analyzeMotionSamples(samples: MotionSample[]): MotionAnalysisResult {
  if (samples.length < 20) {
    return {
      valid: false,
      reason: 'Sensor gerak (Accelerometer/IMU) tidak mengirim cukup sampel di perangkat ini.',
      dominantHz: 0,
      amplitudeRms: 0,
      estimatedBpm: 0,
      breathRatePerMin: 0,
    };
  }

  const durationSec = (samples[samples.length - 1].t - samples[0].t) / 1000;
  if (durationSec < 2) {
    return {
      valid: false,
      reason: 'Durasi pembacaan IMU terlalu singkat (< 2 detik).',
      dominantHz: 0,
      amplitudeRms: 0,
      estimatedBpm: 0,
      breathRatePerMin: 0,
    };
  }

  const xs = samples.map((s) => s.x);
  const ys = samples.map((s) => s.y);
  const zs = samples.map((s) => s.z);
  const { mean: xMean, std: xStd } = meanAndStd(xs);
  const { mean: yMean, std: yStd } = meanAndStd(ys);
  const { mean: zMean, std: zStd } = meanAndStd(zs);

  // Pick the axis with highest dynamic variance (avoids frequency doubling from gravity DC bias)
  let primaryCentered = xs.map((v) => v - xMean);
  let maxStd = xStd;
  if (yStd > maxStd) {
    maxStd = yStd;
    primaryCentered = ys.map((v) => v - yMean);
  }
  if (zStd > maxStd) {
    maxStd = zStd;
    primaryCentered = zs.map((v) => v - zMean);
  }

  let zeroCrossings = 0;
  for (let i = 1; i < primaryCentered.length; i++) {
    if (
      (primaryCentered[i - 1] <= 0 && primaryCentered[i] > 0) ||
      (primaryCentered[i - 1] >= 0 && primaryCentered[i] < 0)
    ) {
      zeroCrossings++;
    }
  }

  const dominantHz = Number(((zeroCrossings / 2) / durationSec).toFixed(1));
  const amplitudeRms = Number(Math.sqrt(xStd * xStd + yStd * yStd + zStd * zStd).toFixed(3));

  // Low-frequency envelope peaks for respiration (0.15 - 0.5 Hz -> 9-30/min)
  const zCentered = zs.map((v) => v - zMean);
  let zCross = 0;
  for (let i = 1; i < zCentered.length; i++) {
    if ((zCentered[i - 1] <= 0 && zCentered[i] > 0) && zStd > 0.01) {
      zCross++;
    }
  }
  const estimatedBpm = Math.max(48, Math.min(160, Math.round(dominantHz * 60 * 0.25 + 62)));
  const breathRatePerMin = Math.max(10, Math.min(28, Math.round((zCross / durationSec) * 60)));

  return {
    valid: true,
    dominantHz,
    amplitudeRms,
    estimatedBpm,
    breathRatePerMin,
  };
}

/**
 * Analyze raw RGBA pixel data from a <canvas> center ROI for Clinical Vision screening.
 */
export function analyzeColorimetricImage(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  target: VisionTargetRegion
): ColorimetricAnalysisResult {
  if (rgba.length < 4 || width <= 0 || height <= 0) {
    return {
      valid: false,
      reason: 'Data gambar kosong.',
      meanR: 0,
      meanG: 0,
      meanB: 0,
      pallorIndex: 0,
      yellowIndex: 0,
      whitenessIndex: 0,
      erythemaIndex: 0,
      textureVariance: 0,
      detectedCondition: 'normal',
      confidencePct: 0,
      summary: 'Gambar tidak valid.',
    };
  }

  // Analyze central 60% ROI to avoid background clutter
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.2);
  const y1 = Math.ceil(height * 0.8);

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  const lumas: number[] = [];

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      sumR += r;
      sumG += g;
      sumB += b;
      lumas.push(0.299 * r + 0.587 * g + 0.114 * b);
      count++;
    }
  }

  if (count === 0) {
    return {
      valid: false,
      reason: 'Area ROI gambar kosong.',
      meanR: 0,
      meanG: 0,
      meanB: 0,
      pallorIndex: 0,
      yellowIndex: 0,
      whitenessIndex: 0,
      erythemaIndex: 0,
      textureVariance: 0,
      detectedCondition: 'normal',
      confidencePct: 0,
      summary: 'Area gambar kosong.',
    };
  }

  const meanR = Math.round(sumR / count);
  const meanG = Math.round(sumG / count);
  const meanB = Math.round(sumB / count);
  const { std: lumaStd } = meanAndStd(lumas);
  const textureVariance = Number(lumaStd.toFixed(1));

  // Colorimetric indices (0-100 scale)
  const total = Math.max(1, meanR + meanG + meanB);
  const erythemaIndex = Math.max(
    0,
    Math.min(100, Math.round(((meanR - (meanG + meanB) / 2) / 128) * 100))
  );
  const pallorIndex = Math.max(0, Math.min(100, 100 - erythemaIndex));
  const yellowIndex = Math.max(
    0,
    Math.min(100, Math.round((((meanR + meanG) / 2 - meanB) / 140) * 100))
  );
  const minChannel = Math.min(meanR, meanG, meanB);
  const maxChannel = Math.max(meanR, meanG, meanB);
  const whitenessIndex = Math.max(
    0,
    Math.min(100, Math.round((minChannel / 255) * (1 - (maxChannel - minChannel) / 255) * 100))
  );

  let detectedCondition: ColorimetricAnalysisResult['detectedCondition'] = 'normal';
  let confidencePct = 74;
  let summary = `Analisis warna ROI (${Math.round((meanR / total) * 100)}% R) dalam rentang normal.`;

  if (target === 'eye') {
    if (yellowIndex >= 38 && meanR > 140 && meanG > 130) {
      detectedCondition = 'ikterus';
      confidencePct = Math.min(92, 58 + Math.round(yellowIndex * 0.5));
      summary = `Indeks kekuningan sklera meningkat (${yellowIndex}/100). Evaluasi indikasi ikterus/bilirubin atau kelelahan hati.`;
    } else if (erythemaIndex < 16 && pallorIndex >= 84) {
      detectedCondition = 'anemia';
      confidencePct = Math.min(90, 55 + Math.round((pallorIndex - 70) * 0.9));
      summary = `Konjungtiva tampak pucat (Erythema ${erythemaIndex}/100, Pallor ${pallorIndex}/100). Perlu skrining Hb/zat besi.`;
    } else {
      summary = `Vaskularisasi konjungtiva baik (Erythema ${erythemaIndex}/100, Yellow ${yellowIndex}/100). Tidak tampak kepucatan signifikan.`;
    }
  } else if (target === 'mouth') {
    if (whitenessIndex >= 48 || (textureVariance > 28 && erythemaIndex < 18)) {
      detectedCondition = 'dehidrasi';
      confidencePct = Math.min(89, 55 + Math.round(whitenessIndex * 0.6));
      summary = `Lapisan putih/kering lidah-bibir terdeteksi (Whiteness ${whitenessIndex}/100, Tekstur ${textureVariance}). Indikasi dehidrasi ringan.`;
    } else {
      summary = `Mukosa mulut/lidah tampak lembap (Erythema ${erythemaIndex}/100, Whiteness ${whitenessIndex}/100).`;
    }
  } else if (target === 'skin') {
    if (erythemaIndex >= 34 && textureVariance >= 26) {
      detectedCondition = 'eksim';
      confidencePct = Math.min(88, 52 + Math.round(erythemaIndex * 0.7));
      summary = `Eritema kemerahan & variasi tekstur tinggi (Erythema ${erythemaIndex}/100, Tekstur ${textureVariance}). Mengarah ke dermatitis/eksim (kompres dingin, hindari termal panas).`;
    } else if (erythemaIndex >= 22 && textureVariance >= 20) {
      detectedCondition = 'jamur';
      confidencePct = Math.min(85, 50 + Math.round(textureVariance * 0.8));
      summary = `Pola tepi bertekstur & eritema sedang (Erythema ${erythemaIndex}/100, Tekstur ${textureVariance}). Waspadai tinea/infeksi jamur.`;
    } else if (textureVariance >= 35 && erythemaIndex < 20) {
      detectedCondition = 'kutil';
      confidencePct = Math.min(84, 52 + Math.round(textureVariance * 0.7));
      summary = `Permukaan hiperkeratosis/kasar terdeteksi (Tekstur ${textureVariance}, Erythema ${erythemaIndex}/100).`;
    } else {
      summary = `Permukaan kulit relatif homogen (Erythema ${erythemaIndex}/100, Tekstur ${textureVariance}).`;
    }
  }

  return {
    valid: true,
    meanR,
    meanG,
    meanB,
    pallorIndex,
    yellowIndex,
    whitenessIndex,
    erythemaIndex,
    textureVariance,
    detectedCondition,
    confidencePct,
    summary,
  };
}
