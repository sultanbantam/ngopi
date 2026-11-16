import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { DetectedFinding } from './medicalKnowledgeBase';
import { analyzeMotionSamples, MotionSample } from './sensorProcessors';

export const CEKKES_STORAGE_KEY = 'ngopi_cekkes_telemetry';
export const CEKKES_SCAN_HISTORY_KEY = 'ngopi_cekkes_scan_history';

export type ImuPermissionStatus = 'idle' | 'listening' | 'unavailable' | 'denied';

export type ScenarioPresetKey = 'normal' | 'overwork_screen' | 'vocal_ispa' | 'motor_stress';

export interface PassiveTelemetryState {
  // 1. Memegang Perangkat (IMU)
  tremorHz: number; // 3-12 Hz band; normal < 5.5
  posturePitchDeg: number; // < 35 deg = text neck risk
  wristStaticHours: number;

  // 2. Jari Menyentuh Layar (Keystroke & Touch Dynamics)
  motorResponseMs: number; // Dwell + flight average
  backspaceRatePct: number;
  fingerFatiguePct: number;
  touchAccuracyPct: number;

  // 3. Mata Menatap Layar & Video Call (Ocular + rPPG)
  blinkRatePerMin: number; // Normal 15-20; < 8 dry eye risk
  screenTimeHours: number;
  viewingDistanceCm: number;
  passiveHeartRateBpm: number;
  hrvRmssdMs: number; // Lower = higher autonomic stress

  // 4. Aktivitas Menelepon (Vocal Biomarkers)
  vocalEnergyPct: number;
  hnrDb: number; // Harmonics-to-noise ratio; < 14 dB = hoarseness/fatigue
  breathRatePerMin: number;
  dailyCallMinutes: number;

  // Metadata & Timeline
  lastUpdatedIso: string;
  localTimezone?: string;
  estimatedSleepHours?: number;
  activePreset: ScenarioPresetKey | 'live';
  samplesCount: number;
  timeline24h: Array<{
    hourLabel: string;
    vocalEnergy: number;
    typingSpeedScore: number;
    blinkRate: number;
    heartRate: number;
  }>;
}

const DEFAULT_TIMELINE = [
  { hourLabel: '08:00', vocalEnergy: 88, typingSpeedScore: 90, blinkRate: 18, heartRate: 70 },
  { hourLabel: '11:00', vocalEnergy: 84, typingSpeedScore: 86, blinkRate: 16, heartRate: 74 },
  { hourLabel: '14:00', vocalEnergy: 76, typingSpeedScore: 79, blinkRate: 13, heartRate: 78 },
  { hourLabel: '17:00', vocalEnergy: 68, typingSpeedScore: 72, blinkRate: 11, heartRate: 82 },
  { hourLabel: '20:00', vocalEnergy: 62, typingSpeedScore: 68, blinkRate: 9, heartRate: 79 },
];

export const SCENARIO_PRESETS: Record<
  ScenarioPresetKey,
  { label: string; description: string; values: Partial<PassiveTelemetryState> }
> = {
  normal: {
    label: 'Hari Normal',
    description: 'Postur leher tegak, kedipan mata sehat, suara jernih, dan motorik jari stabil.',
    values: {
      tremorHz: 4.1,
      posturePitchDeg: 52,
      wristStaticHours: 1.5,
      motorResponseMs: 145,
      backspaceRatePct: 4,
      fingerFatiguePct: 18,
      touchAccuracyPct: 96,
      blinkRatePerMin: 17,
      screenTimeHours: 2.8,
      viewingDistanceCm: 40,
      passiveHeartRateBpm: 72,
      hrvRmssdMs: 48,
      vocalEnergyPct: 86,
      hnrDb: 21.4,
      breathRatePerMin: 15,
      dailyCallMinutes: 25,
      timeline24h: DEFAULT_TIMELINE,
    },
  },
  overwork_screen: {
    label: 'Overwork & Layar Intensif',
    description: 'Screen time tinggi, kedipan menurun drastis (risiko mata kering), dan text neck.',
    values: {
      tremorHz: 5.8,
      posturePitchDeg: 26,
      wristStaticHours: 5.4,
      motorResponseMs: 215,
      backspaceRatePct: 11,
      fingerFatiguePct: 62,
      touchAccuracyPct: 86,
      blinkRatePerMin: 6,
      screenTimeHours: 8.5,
      viewingDistanceCm: 26,
      passiveHeartRateBpm: 86,
      hrvRmssdMs: 26,
      vocalEnergyPct: 71,
      hnrDb: 18.0,
      breathRatePerMin: 18,
      dailyCallMinutes: 45,
      timeline24h: [
        { hourLabel: '08:00', vocalEnergy: 84, typingSpeedScore: 88, blinkRate: 16, heartRate: 74 },
        { hourLabel: '11:00', vocalEnergy: 79, typingSpeedScore: 80, blinkRate: 12, heartRate: 80 },
        { hourLabel: '14:00', vocalEnergy: 74, typingSpeedScore: 70, blinkRate: 9, heartRate: 84 },
        { hourLabel: '17:00', vocalEnergy: 72, typingSpeedScore: 60, blinkRate: 7, heartRate: 88 },
        { hourLabel: '20:00', vocalEnergy: 71, typingSpeedScore: 54, blinkRate: 6, heartRate: 86 },
      ],
    },
  },
  vocal_ispa: {
    label: 'Kelelahan Vokal Telepon & ISPA Ringan',
    description: 'Durasi telepon lama, suara serak (HNR rendah), dan jeda napas meningkat.',
    values: {
      tremorHz: 4.9,
      posturePitchDeg: 44,
      wristStaticHours: 2.8,
      motorResponseMs: 170,
      backspaceRatePct: 7,
      fingerFatiguePct: 35,
      touchAccuracyPct: 91,
      blinkRatePerMin: 13,
      screenTimeHours: 4.2,
      viewingDistanceCm: 36,
      passiveHeartRateBpm: 88,
      hrvRmssdMs: 29,
      vocalEnergyPct: 44,
      hnrDb: 11.2,
      breathRatePerMin: 22,
      dailyCallMinutes: 145,
      timeline24h: [
        { hourLabel: '08:00', vocalEnergy: 82, typingSpeedScore: 85, blinkRate: 16, heartRate: 75 },
        { hourLabel: '11:00', vocalEnergy: 68, typingSpeedScore: 81, blinkRate: 15, heartRate: 81 },
        { hourLabel: '14:00', vocalEnergy: 56, typingSpeedScore: 78, blinkRate: 14, heartRate: 85 },
        { hourLabel: '17:00', vocalEnergy: 48, typingSpeedScore: 74, blinkRate: 13, heartRate: 87 },
        { hourLabel: '20:00', vocalEnergy: 44, typingSpeedScore: 72, blinkRate: 13, heartRate: 88 },
      ],
    },
  },
  motor_stress: {
    label: 'Kelelahan Motorik & Stres Tinggi',
    description: 'Tremor tangan meningkat (8.2 Hz), respon ketik melambat, dan HRV rendah.',
    values: {
      tremorHz: 8.2,
      posturePitchDeg: 29,
      wristStaticHours: 6.1,
      motorResponseMs: 295,
      backspaceRatePct: 16,
      fingerFatiguePct: 78,
      touchAccuracyPct: 77,
      blinkRatePerMin: 8,
      screenTimeHours: 7.1,
      viewingDistanceCm: 29,
      passiveHeartRateBpm: 96,
      hrvRmssdMs: 19,
      vocalEnergyPct: 58,
      hnrDb: 15.6,
      breathRatePerMin: 20,
      dailyCallMinutes: 60,
      timeline24h: [
        { hourLabel: '08:00', vocalEnergy: 78, typingSpeedScore: 80, blinkRate: 14, heartRate: 80 },
        { hourLabel: '11:00', vocalEnergy: 70, typingSpeedScore: 68, blinkRate: 12, heartRate: 86 },
        { hourLabel: '14:00', vocalEnergy: 65, typingSpeedScore: 55, blinkRate: 10, heartRate: 91 },
        { hourLabel: '17:00', vocalEnergy: 60, typingSpeedScore: 46, blinkRate: 9, heartRate: 94 },
        { hourLabel: '20:00', vocalEnergy: 58, typingSpeedScore: 42, blinkRate: 8, heartRate: 96 },
      ],
    },
  },
};

export const INITIAL_PASSIVE_TELEMETRY: PassiveTelemetryState = {
  ...(SCENARIO_PRESETS.normal.values as PassiveTelemetryState),
  lastUpdatedIso: new Date().toISOString(),
  activePreset: 'normal',
  samplesCount: 0,
  timeline24h: DEFAULT_TIMELINE,
};

export function readStoredTelemetry(): PassiveTelemetryState {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(CEKKES_STORAGE_KEY);
      if (raw) {
        return { ...INITIAL_PASSIVE_TELEMETRY, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore storage errors
    }
  }
  return INITIAL_PASSIVE_TELEMETRY;
}

export function writeStoredTelemetry(next: PassiveTelemetryState) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CEKKES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
}

export function derivePassiveFindings(t: PassiveTelemetryState): DetectedFinding[] {
  const findings: DetectedFinding[] = [];

  if (t.posturePitchDeg < 35 || t.tremorHz >= 6.5 || t.fingerFatiguePct >= 55) {
    findings.push({
      id: 'passive-motor',
      title: 'Kelelahan Motorik Halus / Postur Leher (Text Neck)',
      source: 'passive',
      severity: t.tremorHz >= 7.5 || t.fingerFatiguePct >= 70 ? 'waspada' : 'perhatian',
      category: 'motor_nerve',
      summary: `Tremor ${t.tremorHz.toFixed(1)} Hz, sudut leher ${Math.round(t.posturePitchDeg)}°, dan kelelahan jari ${Math.round(t.fingerFatiguePct)}%.`,
    });
  }

  if (t.blinkRatePerMin < 10 || t.screenTimeHours >= 6) {
    findings.push({
      id: 'passive-ocular',
      title: 'Risiko Mata Kering Digital (Digital Eye Strain)',
      source: 'passive',
      severity: t.blinkRatePerMin <= 7 ? 'waspada' : 'perhatian',
      category: 'ocular',
      summary: `Laju kedipan ${Math.round(t.blinkRatePerMin)}x/menit dengan screen time ${t.screenTimeHours.toFixed(1)} jam.`,
    });
  }

  if (t.hnrDb < 14 || t.vocalEnergyPct < 55 || t.dailyCallMinutes >= 120) {
    findings.push({
      id: 'passive-vocal',
      title: 'Kelelahan Vokal & Iritasi Tenggorokan Ringan',
      source: 'passive',
      severity: t.hnrDb < 12 ? 'waspada' : 'perhatian',
      category: 'vocal_throat',
      summary: `Energi vokal ${Math.round(t.vocalEnergyPct)}%, HNR ${t.hnrDb.toFixed(1)} dB, panggilan ${Math.round(t.dailyCallMinutes)} menit/hari.`,
    });
  }

  return findings;
}

/**
 * Global lightweight passive telemetry hook.
 * Attaches non-intrusive keystroke timing & device motion listeners on web
 * (Zero content recording — only timing intervals & accelerometer magnitude).
 */
export function useCekkesPassiveAgent(enableGlobalListeners = false) {
  const [telemetry, setTelemetry] = useState<PassiveTelemetryState>(() => readStoredTelemetry());
  const [imuStatus, setImuStatus] = useState<ImuPermissionStatus>('idle');
  const lastKeyDownRef = useRef<number | null>(null);
  const keyDownTimesRef = useRef<Record<string, number>>({});
  const motionBufferRef = useRef<MotionSample[]>([]);
  const lastMotionTimeRef = useRef<number>(0);

  const updateTelemetry = useCallback((updater: (prev: PassiveTelemetryState) => PassiveTelemetryState) => {
    setTelemetry((prev) => {
      const next = { ...updater(prev), lastUpdatedIso: new Date().toISOString() };
      writeStoredTelemetry(next);
      return next;
    });
  }, []);

  const applyPreset = useCallback(
    (preset: ScenarioPresetKey) => {
      const p = SCENARIO_PRESETS[preset];
      updateTelemetry((prev) => ({
        ...prev,
        ...p.values,
        activePreset: preset,
      }));
    },
    [updateTelemetry]
  );

  const recordKeystrokeSample = useCallback(
    (isBackspace: boolean, dwellMs: number, flightMs: number) => {
      const safeDwell = Math.min(600, Math.max(25, dwellMs));
      const safeFlight = Math.min(900, Math.max(35, flightMs));
      const combinedMs = Math.round((safeDwell + safeFlight) / 2);

      updateTelemetry((prev) => {
        const nextMotor = Math.round(prev.motorResponseMs * 0.8 + combinedMs * 0.2);
        const nextBackspace = Number(
          Math.min(40, prev.backspaceRatePct * 0.85 + (isBackspace ? 18 : 2) * 0.15).toFixed(1)
        );
        const nextFatigue = Math.min(
          100,
          Math.max(10, Math.round((nextMotor - 110) * 0.25 + nextBackspace * 2.2))
        );
        return {
          ...prev,
          motorResponseMs: nextMotor,
          backspaceRatePct: nextBackspace,
          fingerFatiguePct: nextFatigue,
          touchAccuracyPct: Math.max(60, 100 - Math.round(nextBackspace * 1.4)),
          samplesCount: prev.samplesCount + 1,
          activePreset: 'live',
        };
      });
    },
    [updateTelemetry]
  );

  const requestImuPermission = useCallback(async (): Promise<ImuPermissionStatus> => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setImuStatus('unavailable');
      return 'unavailable';
    }
    try {
      const DME = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (DME && typeof DME.requestPermission === 'function') {
        const res = await DME.requestPermission();
        const status: ImuPermissionStatus = res === 'granted' ? 'listening' : 'denied';
        setImuStatus(status);
        return status;
      }
      if ('DeviceMotionEvent' in window) {
        setImuStatus('listening');
        return 'listening';
      }
      setImuStatus('unavailable');
      return 'unavailable';
    } catch {
      setImuStatus('denied');
      return 'denied';
    }
  }, []);

  useEffect(() => {
    if (!enableGlobalListeners || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // Timezone-aware Wake-to-Sleep cycle detection: if user returns after >= 4h inactivity,
    // log it as rest/sleep window instead of counting towards continuous screen strain.
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
      const lastMs = Date.parse(telemetry.lastUpdatedIso || '');
      const gapHours = Number.isFinite(lastMs) ? (Date.now() - lastMs) / 3600000 : 0;
      if (gapHours >= 4 && gapHours <= 16) {
        updateTelemetry((prev) => ({
          ...prev,
          localTimezone: tz,
          estimatedSleepHours: Number(gapHours.toFixed(1)),
          screenTimeHours: 0.1,
          wristStaticHours: 0.1,
        }));
      } else if (!telemetry.localTimezone) {
        updateTelemetry((prev) => ({ ...prev, localTimezone: tz }));
      }
    } catch {
      // ignore timezone errors
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      if (!keyDownTimesRef.current[e.code]) {
        keyDownTimesRef.current[e.code] = now;
      }
      lastKeyDownRef.current = now;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const now = performance.now();
      const downTime = keyDownTimesRef.current[e.code];
      delete keyDownTimesRef.current[e.code];
      const dwell = downTime ? now - downTime : 90;
      const flight = lastKeyDownRef.current ? now - lastKeyDownRef.current : 140;
      if (e.key === 'Backspace' || e.key.length === 1) {
        recordKeystrokeSample(e.key === 'Backspace', dwell, flight);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const now = performance.now();
      const flight = lastKeyDownRef.current ? now - lastKeyDownRef.current : 180;
      lastKeyDownRef.current = now;
      // Record tap cadence without counting as backspace
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        recordKeystrokeSample(false, 85, Math.min(800, flight));
      }
    };

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.beta === 'number' && Number.isFinite(e.beta)) {
        setImuStatus('listening');
        const pitch = Math.min(90, Math.max(0, Math.abs(e.beta)));
        updateTelemetry((prev) => ({
          ...prev,
          posturePitchDeg: Math.round(prev.posturePitchDeg * 0.85 + pitch * 0.15),
          activePreset: 'live',
        }));
      }
    };

    const onDeviceMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration ?? e.accelerationIncludingGravity;
      if (!acc || (acc.x == null && acc.y == null && acc.z == null)) return;
      const now = performance.now();
      if (now - lastMotionTimeRef.current < 40) return; // cap ~25 Hz
      lastMotionTimeRef.current = now;
      setImuStatus('listening');

      motionBufferRef.current.push({
        t: now,
        x: acc.x ?? 0,
        y: acc.y ?? 0,
        z: acc.z ?? 0,
      });

      if (motionBufferRef.current.length >= 45) {
        const res = analyzeMotionSamples(motionBufferRef.current);
        motionBufferRef.current = motionBufferRef.current.slice(-15);
        if (res.valid) {
          updateTelemetry((prev) => ({
            ...prev,
            tremorHz: Number((prev.tremorHz * 0.6 + res.dominantHz * 0.4).toFixed(1)),
            samplesCount: prev.samplesCount + 1,
            activePreset: 'live',
          }));
        }
      }
    };

    // Increment active screen time every 60 seconds while tab is visible
    const screenTimer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        updateTelemetry((prev) => ({
          ...prev,
          screenTimeHours: Number((prev.screenTimeHours + 1 / 60).toFixed(2)),
          wristStaticHours: Number((prev.wristStaticHours + 1 / 60).toFixed(2)),
        }));
      }
    }, 60000);

    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('keyup', onKeyUp, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    window.addEventListener('devicemotion', onDeviceMotion, { passive: true });
    return () => {
      window.clearInterval(screenTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      window.removeEventListener('devicemotion', onDeviceMotion);
    };
  }, [enableGlobalListeners, recordKeystrokeSample, updateTelemetry]);

  return {
    telemetry,
    imuStatus,
    requestImuPermission,
    updateTelemetry,
    applyPreset,
    recordKeystrokeSample,
    findings: derivePassiveFindings(telemetry),
  };
}
