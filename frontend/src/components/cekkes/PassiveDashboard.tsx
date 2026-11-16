import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ImuPermissionStatus,
  PassiveTelemetryState,
  SCENARIO_PRESETS,
  ScenarioPresetKey,
} from './useCekkesPassiveAgent';
import { CarePlanResult, DetectedFinding } from './medicalKnowledgeBase';
import { analyzeVocalPcm } from './sensorProcessors';
import DoctorVoicePlayer, { CekkesLang } from './DoctorVoicePlayer';
import {
  checkAndroidUsageStatsPermission,
  isCekkesNativeAndroidAvailable,
  openAndroidUsageStatsSettings,
  readAndroidImuMetrics,
  readAndroidUsageStatsSummary,
  startAndroidForegroundImu,
  stopAndroidForegroundImu,
} from './nativeAndroidBridge';

interface PassiveDashboardProps {
  lang: CekkesLang;
  telemetry: PassiveTelemetryState;
  imuStatus?: ImuPermissionStatus;
  findings: DetectedFinding[];
  carePlan: CarePlanResult;
  doctorScript: string;
  isSpeaking: boolean;
  onToggleSpeak: () => void;
  onTrigger24hNotification: () => void;
  onApplyPreset: (preset: ScenarioPresetKey) => void;
  onUpdateTelemetry: (updater: (prev: PassiveTelemetryState) => PassiveTelemetryState) => void;
  onRecordKeystroke: (isBackspace: boolean, dwellMs: number, flightMs: number) => void;
  onRequestImuPermission?: () => Promise<ImuPermissionStatus>;
  onGoToActiveCheck: () => void;
  onGoToCarePlan: () => void;
}

export default function PassiveDashboard({
  lang,
  telemetry,
  imuStatus = 'idle',
  findings,
  carePlan,
  doctorScript,
  isSpeaking,
  onToggleSpeak,
  onTrigger24hNotification,
  onApplyPreset,
  onUpdateTelemetry,
  onRecordKeystroke,
  onRequestImuPermission,
  onGoToActiveCheck,
  onGoToCarePlan,
}: PassiveDashboardProps) {
  const [expandedCard, setExpandedCard] = useState<'imu' | 'touch' | 'eye' | 'voice' | null>(null);
  const [sandboxText, setSandboxText] = useState('');
  const [micSimActive, setMicSimActive] = useState(false);
  const [sensorMsg, setSensorMsg] = useState<string | null>(null);
  const [nativeBgActive, setNativeBgActive] = useState(false);
  const [nativeStatusMsg, setNativeStatusMsg] = useState<string | null>(null);
  const lastTypeTimeRef = useRef<number>(Date.now());

  const handleToggleNativeBg = async () => {
    if (!isCekkesNativeAndroidAvailable) {
      setNativeStatusMsg(
        lang === 'en'
          ? 'Cross-app background IMU & UsageStats run on the Android APK (top.ngopi.app). Web mode monitors while ngopi.top is open.'
          : 'Layanan latar belakang IMU & UsageStats lintas-aplikasi berjalan di APK Android (top.ngopi.app). Mode Web memantau otomatis saat ngopi.top terbuka.'
      );
      return;
    }
    if (nativeBgActive) {
      await stopAndroidForegroundImu();
      setNativeBgActive(false);
      setNativeStatusMsg(lang === 'en' ? 'Background IMU stopped.' : 'Sensor latar belakang IMU dihentikan.');
    } else {
      const ok = await startAndroidForegroundImu();
      setNativeBgActive(ok);
      setNativeStatusMsg(
        ok
          ? lang === 'en'
            ? 'Foreground IMU active (monitoring vibration & posture across apps).'
            : 'Foreground IMU aktif (memantau getaran & postur lintas aplikasi).'
          : 'Gagal memulai Foreground Service.'
      );
    }
  };

  const handleSyncNativeUsageAndImu = async () => {
    if (!isCekkesNativeAndroidAvailable) return;
    const hasPerm = await checkAndroidUsageStatsPermission();
    if (!hasPerm) {
      await openAndroidUsageStatsSettings();
      setNativeStatusMsg(
        lang === 'en'
          ? 'Please grant Usage Access for Ngopi in Android Settings, then tap Sync again.'
          : 'Aktifkan izin Akses Penggunaan (Usage Access) untuk Ngopi di Pengaturan Android, lalu tekan Sinkronkan lagi.'
      );
      return;
    }
    const [imu, usage] = await Promise.all([
      readAndroidImuMetrics(),
      readAndroidUsageStatsSummary(16),
    ]);
    onUpdateTelemetry((prev) => ({
      ...prev,
      tremorHz: imu ? Number(imu.tremorHz.toFixed(1)) : prev.tremorHz,
      posturePitchDeg: imu ? imu.posturePitchDeg : prev.posturePitchDeg,
      screenTimeHours: usage
        ? Number((usage.totalScreenMinutes / 60).toFixed(2))
        : prev.screenTimeHours,
      activePreset: 'live',
    }));
    setNativeStatusMsg(
      lang === 'en'
        ? `Synced: ${usage?.totalScreenMinutes ?? 0} mins across ${usage?.activeAppCount ?? 0} apps.`
        : `Tersinkron: ${usage?.totalScreenMinutes ?? 0} mnt layar di ${usage?.activeAppCount ?? 0} aplikasi.`
    );
  };

  // Dynamic 24h Wellness Score (0 - 100)
  const wellnessScore = useMemo(() => {
    let score = 96;
    if (telemetry.fingerFatiguePct >= 55) score -= Math.round((telemetry.fingerFatiguePct - 40) * 0.3);
    if (telemetry.tremorHz >= 6.2) score -= 8;
    if (telemetry.posturePitchDeg < 35) score -= 7;
    if (telemetry.blinkRatePerMin < 11) score -= Math.round((13 - telemetry.blinkRatePerMin) * 2.5);
    if (telemetry.hnrDb < 15) score -= Math.round((16 - telemetry.hnrDb) * 2.5);
    if (telemetry.vocalEnergyPct < 60) score -= 6;
    return Math.max(35, Math.min(99, score));
  }, [telemetry]);

  const scoreLabel =
    wellnessScore >= 82
      ? lang === 'en'
        ? 'Optimal Balance'
        : 'Kondisi Bugar'
      : wellnessScore >= 65
      ? lang === 'en'
        ? 'Light Rest Advised'
        : 'Perlu Istirahat Ringan'
      : lang === 'en'
      ? 'High Strain Detected'
      : 'Perlu Perhatian Segera';

  const scoreColor = wellnessScore >= 82 ? '#10B981' : wellnessScore >= 65 ? '#F59E0B' : '#F43F5E';

  const handleSandboxChange = (text: string) => {
    const now = Date.now();
    const flight = now - lastTypeTimeRef.current;
    lastTypeTimeRef.current = now;
    const isBackspace = text.length < sandboxText.length;
    setSandboxText(text);
    onRecordKeystroke(isBackspace, 90, flight);
  };

  const handleMeasureVoice = async () => {
    if (micSimActive) return;
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setSensorMsg(lang === 'en' ? 'Microphone WebRTC unavailable.' : 'Browser tidak mendukung mikrofon WebRTC.');
      return;
    }
    setMicSimActive(true);
    setSensorMsg(
      lang === 'en'
        ? 'Recording 2.5s locally (zero content saved)... Speak naturally.'
        : 'Merekam suara 2.5 detik secara lokal... Silakan bicara.'
    );
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

        const total = chunks.reduce((a, c) => a + c.length, 0);
        const merged = new Float32Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        const res = analyzeVocalPcm(merged, sr);
        if (!res.valid) {
          setSensorMsg(res.reason || 'Suara belum terdeteksi jelas.');
          setMicSimActive(false);
          return;
        }
        onUpdateTelemetry((prev) => ({
          ...prev,
          vocalEnergyPct: res.rmsEnergyPct,
          hnrDb: res.hnrDb,
          dailyCallMinutes: prev.dailyCallMinutes + 1,
          samplesCount: prev.samplesCount + 1,
          activePreset: 'live',
        }));
        setSensorMsg(
          `Terukur: F0 ${res.f0Hz} Hz • Energi ${res.rmsEnergyPct}% • HNR ${res.hnrDb} dB`
        );
        setMicSimActive(false);
      }, 2500);
    } catch {
      setSensorMsg(lang === 'en' ? 'Mic permission denied.' : 'Izin mikrofon ditolak atau tidak ditemukan.');
      setMicSimActive(false);
    }
  };

  const adjustMetric = (key: keyof PassiveTelemetryState, delta: number, min: number, max: number) => {
    onUpdateTelemetry((prev) => {
      const current = Number(prev[key] ?? 0);
      const next = Math.min(max, Math.max(min, Number((current + delta).toFixed(1))));
      return { ...prev, [key]: next, activePreset: 'live' };
    });
  };

  const badgeInfo = (ok: boolean, warnLabel?: string) => ({
    bg: ok ? 'rgba(16,185,129,0.16)' : 'rgba(245,158,11,0.18)',
    color: ok ? '#34D399' : '#FBBF24',
    text: ok ? (lang === 'en' ? 'Normal' : 'Aman') : warnLabel || (lang === 'en' ? 'Alert' : 'Waspada'),
  });

  const imuOk = telemetry.posturePitchDeg >= 35 && telemetry.tremorHz < 6.5;
  const touchOk = telemetry.fingerFatiguePct < 55;
  const eyeOk = telemetry.blinkRatePerMin >= 11;
  const voiceOk = telemetry.hnrDb >= 14 && telemetry.vocalEnergyPct >= 55;

  const firstOtc = carePlan.otcList.find((o) => !o.blockedReason);
  const firstHerbal = carePlan.herbalList[0];

  return (
    <View style={{ gap: 12 }}>
      {/* 1. 24-Hour Wellness Score Ring + Digital Doctor Voice Player */}
      <View style={styles.card}>
        <View style={styles.scoreHeader}>
          <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{wellnessScore}</Text>
            <Text style={styles.scoreSub}>/100</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.scoreTitle}>
              {lang === 'en' ? '24h Routine Wellness Score' : 'Skor Kebugaran 24 Jam'}
            </Text>
            <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{scoreLabel}</Text>
            <Text style={styles.mutedText}>
              {findings.length > 0
                ? lang === 'en'
                  ? `${findings.length} early alerts from screen & call habits`
                  : `${findings.length} sinyal perhatian dari aktivitas layar & telepon`
                : lang === 'en'
                ? 'All 4 daily routines look balanced'
                : 'Ke-4 aktivitas harian terpantau seimbang'}
            </Text>
          </View>
        </View>

        <DoctorVoicePlayer
          lang={lang}
          script={doctorScript}
          isSpeaking={isSpeaking}
          onToggleSpeak={onToggleSpeak}
        />

        {/* Quick Scenario Chips + Notification Trigger */}
        <View style={styles.chipsRow}>
          {(Object.keys(SCENARIO_PRESETS) as ScenarioPresetKey[]).map((key) => {
            const active = telemetry.activePreset === key;
            const shortLabel =
              key === 'normal'
                ? lang === 'en'
                  ? 'Normal'
                  : 'Normal'
                : key === 'overwork_screen'
                ? lang === 'en'
                  ? 'Screen & Finger'
                  : 'Layar & Jari'
                : key === 'vocal_ispa'
                ? lang === 'en'
                  ? 'Hoarse Voice'
                  : 'Suara Serak'
                : lang === 'en'
                ? 'High Stress'
                : 'Stres Tinggi';
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onApplyPreset(key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{shortLabel}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.notifChip} onPress={onTrigger24hNotification}>
            <Ionicons name="notifications-outline" size={12} color="#38BDF8" />
            <Text style={styles.notifChipText}>
              {lang === 'en' ? 'Test 24h Alert' : 'Simulasikan Notifikasi 24 Jam'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Clean 2x2 Grid: 4 Routine 24h Activities */}
      <View style={styles.grid2x2}>
        {/* Card 1: Genggaman & Postur */}
        {(() => {
          const b = badgeInfo(imuOk);
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.miniCard}
              onPress={() => setExpandedCard((c) => (c === 'imu' ? null : 'imu'))}
            >
              <View style={styles.rowBetween}>
                <Ionicons name="hand-left-outline" size={18} color="#D4AF37" />
                <View style={[styles.statusPill, { backgroundColor: b.bg }]}>
                  <Text style={[styles.statusPillText, { color: b.color }]}>{b.text}</Text>
                </View>
              </View>
              <Text style={styles.miniLabel}>{lang === 'en' ? 'Grip & Posture' : 'Genggaman (IMU)'}</Text>
              <Text style={styles.miniValue}>{telemetry.tremorHz.toFixed(1)} Hz</Text>
              <Text style={styles.miniSub}>
                {lang === 'en' ? 'Neck' : 'Sudut'}: {Math.round(telemetry.posturePitchDeg)}° • + Detail
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* Card 2: Sentuhan Jari */}
        {(() => {
          const b = badgeInfo(touchOk);
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.miniCard}
              onPress={() => setExpandedCard((c) => (c === 'touch' ? null : 'touch'))}
            >
              <View style={styles.rowBetween}>
                <Ionicons name="finger-print-outline" size={18} color="#38BDF8" />
                <View style={[styles.statusPill, { backgroundColor: b.bg }]}>
                  <Text style={[styles.statusPillText, { color: b.color }]}>{b.text}</Text>
                </View>
              </View>
              <Text style={styles.miniLabel}>{lang === 'en' ? 'Finger Touch' : 'Sentuhan Jari'}</Text>
              <Text style={styles.miniValue}>{Math.round(telemetry.motorResponseMs)} ms</Text>
              <Text style={styles.miniSub}>
                {lang === 'en' ? 'Fatigue' : 'Lelah'}: {Math.round(telemetry.fingerFatiguePct)}% • + Detail
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* Card 3: Tatapan Mata */}
        {(() => {
          const b = badgeInfo(eyeOk);
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.miniCard}
              onPress={() => setExpandedCard((c) => (c === 'eye' ? null : 'eye'))}
            >
              <View style={styles.rowBetween}>
                <Ionicons name="eye-outline" size={18} color="#10B981" />
                <View style={[styles.statusPill, { backgroundColor: b.bg }]}>
                  <Text style={[styles.statusPillText, { color: b.color }]}>{b.text}</Text>
                </View>
              </View>
              <Text style={styles.miniLabel}>{lang === 'en' ? 'Eye Gaze & rPPG' : 'Tatapan Mata'}</Text>
              <Text style={styles.miniValue}>{Math.round(telemetry.blinkRatePerMin)} /mnt</Text>
              <Text style={styles.miniSub}>
                HR: {Math.round(telemetry.passiveHeartRateBpm)} bpm • + Detail
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* Card 4: Suara Telepon */}
        {(() => {
          const b = badgeInfo(voiceOk);
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.miniCard}
              onPress={() => setExpandedCard((c) => (c === 'voice' ? null : 'voice'))}
            >
              <View style={styles.rowBetween}>
                <Ionicons name="call-outline" size={18} color="#A78BFA" />
                <View style={[styles.statusPill, { backgroundColor: b.bg }]}>
                  <Text style={[styles.statusPillText, { color: b.color }]}>{b.text}</Text>
                </View>
              </View>
              <Text style={styles.miniLabel}>{lang === 'en' ? 'Call Voice' : 'Suara Telepon'}</Text>
              <Text style={styles.miniValue}>{Math.round(telemetry.vocalEnergyPct)}%</Text>
              <Text style={styles.miniSub}>
                HNR: {telemetry.hnrDb.toFixed(1)} dB • + Detail
              </Text>
            </TouchableOpacity>
          );
        })()}
      </View>

      {/* Expandable Detail / Sandbox Drawer when user taps one of the 4 cards */}
      {expandedCard && (
        <View style={styles.drawerCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.drawerTitle}>
              {expandedCard === 'imu'
                ? 'Detail Sensor IMU & Postur'
                : expandedCard === 'touch'
                ? 'Detail Motorik Jari & Sandbox Ketik'
                : expandedCard === 'eye'
                ? 'Detail Kedipan Mata & Screen Time'
                : 'Detail Biomarka Suara Telepon'}
            </Text>
            <TouchableOpacity onPress={() => setExpandedCard(null)}>
              <Ionicons name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {expandedCard === 'imu' && (
            <View style={{ gap: 8 }}>
              <Text style={styles.mutedText}>
                Tremor: {telemetry.tremorHz.toFixed(1)} Hz • Sudut Leher: {Math.round(telemetry.posturePitchDeg)}° • IMU: {imuStatus}
              </Text>
              <View style={styles.chipsRow}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('posturePitchDeg', -5, 10, 85)}>
                  <Text style={styles.stepText}>Sudut -5°</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('posturePitchDeg', 5, 10, 85)}>
                  <Text style={styles.stepText}>Sudut +5°</Text>
                </TouchableOpacity>
                {onRequestImuPermission && (
                  <TouchableOpacity
                    style={styles.cyanBtnSmall}
                    onPress={async () => {
                      const st = await onRequestImuPermission();
                      setSensorMsg(`Status IMU: ${st}`);
                    }}
                  >
                    <Text style={styles.cyanBtnSmallText}>Aktifkan IMU Nyata</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {expandedCard === 'touch' && (
            <View style={{ gap: 8 }}>
              <Text style={styles.mutedText}>
                Sampel sesi: {telemetry.samplesCount} • Backspace: {telemetry.backspaceRatePct}% • Akurasi: {Math.round(telemetry.touchAccuracyPct)}%
              </Text>
              <TextInput
                value={sandboxText}
                onChangeText={handleSandboxChange}
                placeholder="Ketik bebas di sini (zero content recording)..."
                placeholderTextColor="#8B735B"
                style={styles.input}
              />
              <View style={styles.chipsRow}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('fingerFatiguePct', -10, 5, 95)}>
                  <Text style={styles.stepText}>Lelah -10%</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('fingerFatiguePct', 10, 5, 95)}>
                  <Text style={styles.stepText}>Lelah +10%</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {expandedCard === 'eye' && (
            <View style={{ gap: 8 }}>
              <Text style={styles.mutedText}>
                Screen Time: {telemetry.screenTimeHours.toFixed(1)} jam • HRV: {Math.round(telemetry.hrvRmssdMs)} ms
              </Text>
              <View style={styles.chipsRow}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('blinkRatePerMin', -2, 3, 24)}>
                  <Text style={styles.stepText}>Kedip -2</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('blinkRatePerMin', 2, 3, 24)}>
                  <Text style={styles.stepText}>Kedip +2</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {expandedCard === 'voice' && (
            <View style={{ gap: 8 }}>
              <Text style={styles.mutedText}>
                Napas: {Math.round(telemetry.breathRatePerMin)}/mnt • Panggilan hari ini: {Math.round(telemetry.dailyCallMinutes)} mnt
              </Text>
              <View style={styles.chipsRow}>
                <TouchableOpacity style={styles.cyanBtnSmall} onPress={handleMeasureVoice}>
                  <Text style={styles.cyanBtnSmallText}>
                    {micSimActive ? 'Merekam 2.5d...' : 'Uji Mikrofon Nyata (2.5d)'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('hnrDb', -2, 8, 25)}>
                  <Text style={styles.stepText}>HNR -2</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('hnrDb', 2, 8, 25)}>
                  <Text style={styles.stepText}>HNR +2</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {sensorMsg && <Text style={[styles.mutedText, { color: '#38BDF8' }]}>{sensorMsg}</Text>}
        </View>
      )}

      {/* Compact Android Native Background Monitor & Wake-to-Sleep Info */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              {isCekkesNativeAndroidAvailable
                ? lang === 'en'
                  ? 'Android Background Monitor (IMU + UsageStats)'
                  : 'Monitor Latar Belakang Android (IMU + UsageStats)'
                : lang === 'en'
                ? 'Cross-App & Sleep Cycle Mode'
                : 'Mode Lintas-Aplikasi & Siklus Tidur'}
            </Text>
            <Text style={styles.mutedText}>
              {lang === 'en'
                ? `Timezone: ${telemetry.localTimezone || 'Local'}${
                    telemetry.estimatedSleepHours
                      ? ` • Last rest gap: ${telemetry.estimatedSleepHours}h`
                      : ''
                  }`
                : `Zona waktu: ${telemetry.localTimezone || 'Lokal'}${
                    telemetry.estimatedSleepHours
                      ? ` • Jeda istirahat: ${telemetry.estimatedSleepHours} jam`
                      : ''
                  }`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.stepBtn} onPress={handleToggleNativeBg}>
              <Text style={styles.stepText}>
                {isCekkesNativeAndroidAvailable
                  ? nativeBgActive
                    ? lang === 'en'
                      ? 'Stop IMU'
                      : 'Stop IMU'
                    : lang === 'en'
                    ? 'Start IMU'
                    : 'Aktifkan IMU'
                  : lang === 'en'
                  ? 'APK Info'
                  : 'Info APK'}
              </Text>
            </TouchableOpacity>
            {isCekkesNativeAndroidAvailable && (
              <TouchableOpacity style={styles.cyanBtnSmall} onPress={handleSyncNativeUsageAndImu}>
                <Text style={styles.cyanBtnSmallText}>
                  {lang === 'en' ? 'Sync Usage' : 'Sinkronkan'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {nativeStatusMsg && (
          <Text style={[styles.mutedText, { color: '#38BDF8' }]}>{nativeStatusMsg}</Text>
        )}
      </View>

      {/* 3. Automatic 24h Care Recommendations Preview (Right on Tab 1) */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>
            {lang === 'en' ? 'Today’s Auto Self-Care' : 'Rekomendasi Awal Hari Ini'}
          </Text>
          <TouchableOpacity onPress={onGoToCarePlan}>
            <Text style={styles.linkText}>
              {lang === 'en' ? 'Full Dosage & Schedule →' : 'Dosis & Jadwal →'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recRow}>
          <Ionicons name="medkit-outline" size={16} color="#10B981" />
          <Text style={styles.recText} numberOfLines={2}>
            <Text style={styles.recLabel}>OTC: </Text>
            {firstOtc ? `${firstOtc.activeIngredient} (${firstOtc.dosage})` : 'Istirahat layar & tetes mata lubrikan bila perlu.'}
          </Text>
        </View>

        <View style={styles.recRow}>
          <Ionicons name="leaf-outline" size={16} color="#D4AF37" />
          <Text style={styles.recText} numberOfLines={2}>
            <Text style={styles.recLabel}>Herbal: </Text>
            {firstHerbal ? `${firstHerbal.plantName} — ${firstHerbal.dosageAmount}` : 'Air jahe hangat / teh chamomile.'}
          </Text>
        </View>

        <View style={styles.recRow}>
          <Ionicons name="water-outline" size={16} color="#38BDF8" />
          <Text style={styles.recText}>
            <Text style={styles.recLabel}>{lang === 'en' ? 'Hydration: ' : 'Hidrasi: '}</Text>
            {carePlan.nutrition.waterMinMl.toLocaleString('id-ID')}–
            {carePlan.nutrition.waterMaxMl.toLocaleString('id-ID')} ml/hari
          </Text>
        </View>
      </View>

      {/* 4. Bridge to Active Sensors (Tab 2) */}
      <View style={styles.bridgeCard}>
        <Text style={styles.bridgeTitle}>
          {lang === 'en'
            ? '🔍 Have a specific body complaint today?'
            : '🔍 Ada keluhan spesifik di tubuh Anda hari ini?'}
        </Text>
        <Text style={styles.mutedText}>
          {lang === 'en'
            ? 'Use your phone sensors to check fingertip pulse, chest/stomach, eye/mouth/skin photo, or 43°C thermal therapy.'
            : 'Gunakan sensor HP untuk cek nadi jari, dada/perut, foto mata/mulut/kulit, atau terapi hangat 43°C.'}
        </Text>
        <TouchableOpacity style={styles.bridgeBtn} onPress={onGoToActiveCheck}>
          <Ionicons name="fitness" size={16} color="#0F172A" />
          <Text style={styles.bridgeBtnText}>
            {lang === 'en' ? 'Start 6-Sensor Deep Check →' : 'Mulai Pemeriksaan Sensor Detail →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#261C15',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#4A3728',
    gap: 10,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    backgroundColor: '#1A120B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  scoreSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  scoreTitle: {
    color: '#F5E6D3',
    fontSize: 15,
    fontWeight: '800',
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  mutedText: {
    color: '#BFA995',
    fontSize: 11.5,
    lineHeight: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#1A120B',
    borderWidth: 1,
    borderColor: '#4A3728',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  chipActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#F59E0B',
  },
  chipText: {
    color: '#E5D3B3',
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#1A120B',
  },
  notifChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: '#0EA5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  notifChipText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniCard: {
    width: '48.4%',
    flexGrow: 1,
    minWidth: 148,
    backgroundColor: '#261C15',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#4A3728',
    gap: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  miniLabel: {
    color: '#BFA995',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  miniValue: {
    color: '#F5E6D3',
    fontSize: 19,
    fontWeight: '900',
  },
  miniSub: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  drawerCard: {
    backgroundColor: '#1E1610',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D4AF37',
    gap: 8,
  },
  drawerTitle: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '800',
  },
  stepBtn: {
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#5C4433',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stepText: {
    color: '#E5D3B3',
    fontSize: 11,
    fontWeight: '700',
  },
  cyanBtnSmall: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cyanBtnSmallText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#120D08',
    color: '#F5E6D3',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#4A3728',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  sectionTitle: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '800',
  },
  linkText: {
    color: '#38BDF8',
    fontSize: 11.5,
    fontWeight: '800',
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1A120B',
    padding: 9,
    borderRadius: 10,
  },
  recText: {
    color: '#E5D3B3',
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  recLabel: {
    color: '#F5E6D3',
    fontWeight: '800',
  },
  bridgeCard: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    gap: 8,
  },
  bridgeTitle: {
    color: '#F8FAFC',
    fontSize: 13.5,
    fontWeight: '800',
  },
  bridgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#38BDF8',
    paddingVertical: 10,
    borderRadius: 10,
  },
  bridgeBtnText: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
