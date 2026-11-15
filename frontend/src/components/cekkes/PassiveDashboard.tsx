import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ImuPermissionStatus,
  PassiveTelemetryState,
  SCENARIO_PRESETS,
  ScenarioPresetKey,
} from './useCekkesPassiveAgent';
import { DetectedFinding } from './medicalKnowledgeBase';
import { analyzeVocalPcm } from './sensorProcessors';

interface PassiveDashboardProps {
  telemetry: PassiveTelemetryState;
  imuStatus?: ImuPermissionStatus;
  findings: DetectedFinding[];
  onApplyPreset: (preset: ScenarioPresetKey) => void;
  onUpdateTelemetry: (updater: (prev: PassiveTelemetryState) => PassiveTelemetryState) => void;
  onRecordKeystroke: (isBackspace: boolean, dwellMs: number, flightMs: number) => void;
  onRequestImuPermission?: () => Promise<ImuPermissionStatus>;
  onGoToCarePlan: () => void;
}

export default function PassiveDashboard({
  telemetry,
  imuStatus = 'idle',
  findings,
  onApplyPreset,
  onUpdateTelemetry,
  onRecordKeystroke,
  onRequestImuPermission,
  onGoToCarePlan,
}: PassiveDashboardProps) {
  const [sandboxText, setSandboxText] = useState('');
  const [micSimActive, setMicSimActive] = useState(false);
  const [sensorMsg, setSensorMsg] = useState<string | null>(null);
  const lastTypeTimeRef = useRef<number>(Date.now());

  const handleSandboxChange = (text: string) => {
    const now = Date.now();
    const flight = now - lastTypeTimeRef.current;
    lastTypeTimeRef.current = now;
    const isBackspace = text.length < sandboxText.length;
    setSandboxText(text);
    onRecordKeystroke(isBackspace, 90, flight);
  };

  const handleSimulateVoiceCall = async () => {
    if (micSimActive) return;
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setSensorMsg('Browser ini tidak mendukung akses mikrofon WebRTC.');
      return;
    }

    setMicSimActive(true);
    setSensorMsg('Merekam suara 2.5 detik secara lokal (Zero Content Recording)... Silakan bicara.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        stream.getTracks().forEach((t) => t.stop());
        setSensorMsg('Web AudioContext tidak tersedia.');
        setMicSimActive(false);
        return;
      }

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
        const sampleRate = ctx.sampleRate || 44100;
        ctx.close().catch(() => {});

        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }

        const res = analyzeVocalPcm(merged, sampleRate);
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
          `Terukur real-time: F0 ${res.f0Hz} Hz, Energi ${res.rmsEnergyPct}%, HNR ${res.hnrDb} dB, Jitter ${res.jitterPct}%.`
        );
        setMicSimActive(false);
      }, 2500);
    } catch (err: any) {
      setSensorMsg(
        err?.name === 'NotAllowedError'
          ? 'Izin mikrofon ditolak oleh browser.'
          : 'Mikrofon tidak ditemukan atau sedang dipakai aplikasi lain.'
      );
      setMicSimActive(false);
    }
  };

  const adjustMetric = (key: keyof PassiveTelemetryState, delta: number, min: number, max: number) => {
    onUpdateTelemetry((prev) => ({
      ...prev,
      [key]: Number(Math.min(max, Math.max(min, (prev[key] as number) + delta)).toFixed(1)),
      activePreset: 'live',
    }));
  };

  const statusColor = (ok: boolean, warn?: boolean) =>
    ok ? '#10B981' : warn ? '#F59E0B' : '#F43F5E';

  return (
    <View style={{ gap: 14 }}>
      {/* Executive Summary Banner */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGap}>
            <Ionicons name="pulse" size={20} color="#10B981" />
            <Text style={styles.sectionTitle}>Rangkuman Eksekutif Harian Agent AI</Text>
          </View>
          <View style={styles.badgeGreen}>
            <Text style={styles.badgeText}>100% On-Device Privacy</Text>
          </View>
        </View>
        {findings.length === 0 ? (
          <Text style={styles.bodyText}>
            Kondisi 4 aktivitas harian Anda terpantau stabil dan normal. Pertahankan postur ergonomis dan aturan mata 20-20-20.
          </Text>
        ) : (
          <View style={{ gap: 6 }}>
            {findings.map((f) => (
              <View key={f.id} style={styles.findingRow}>
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={f.severity === 'waspada' ? '#F43F5E' : '#F59E0B'}
                />
                <Text style={styles.bodyText}>
                  <Text style={{ fontWeight: '800', color: '#F59E0B' }}>{f.title}: </Text>
                  {f.summary}
                </Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.goldBtn} onPress={onGoToCarePlan}>
          <Text style={styles.goldBtnText}>Buka Solusi Otomatis (OTC, Herbal & Jadwal) →</Text>
        </TouchableOpacity>
      </View>

      {/* Preset Skenario Simulasi */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preset Skenario Simulasi Real-Time</Text>
        <Text style={styles.mutedText}>
          Uji perubahan diagnosis Agent AI secara langsung atau gunakan slider kontrol di bawah:
        </Text>
        <View style={styles.presetGrid}>
          {(Object.keys(SCENARIO_PRESETS) as ScenarioPresetKey[]).map((key) => {
            const p = SCENARIO_PRESETS[key];
            const active = telemetry.activePreset === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.presetChip, active && styles.presetChipActive]}
                onPress={() => onApplyPreset(key)}
              >
                <Text style={[styles.presetLabel, active && { color: '#1A120B' }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 4 Passive Activity Modules */}
      <View style={styles.grid}>
        {/* 1. Memegang Perangkat */}
        <View style={styles.metricCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.metricTitle}>1. Memegang Perangkat (IMU)</Text>
            <View style={[styles.dot, { backgroundColor: statusColor(telemetry.posturePitchDeg >= 35 && telemetry.tremorHz < 6.5) }]} />
          </View>
          <Text style={styles.metricVal}>{telemetry.tremorHz.toFixed(1)} Hz Tremor</Text>
          <Text style={styles.mutedText}>
            Sudut Postur: {Math.round(telemetry.posturePitchDeg)}° {telemetry.posturePitchDeg < 35 ? '(Text Neck!)' : '(Normal)'} • Beban Statis: {telemetry.wristStaticHours.toFixed(1)} jam
          </Text>
          <View style={styles.adjustRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('posturePitchDeg', -5, 10, 85)}>
              <Text style={styles.stepText}>Sudut -5°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('posturePitchDeg', 5, 10, 85)}>
              <Text style={styles.stepText}>+5°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('tremorHz', 0.8, 3, 12)}>
              <Text style={styles.stepText}>Tremor +</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Jari Menyentuh Layar */}
        <View style={styles.metricCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.metricTitle}>2. Jari Menyentuh Layar (/warkop)</Text>
            <View style={[styles.dot, { backgroundColor: statusColor(telemetry.fingerFatiguePct < 55) }]} />
          </View>
          <Text style={styles.metricVal}>{Math.round(telemetry.motorResponseMs)} ms Respon</Text>
          <Text style={styles.mutedText}>
            Kelelahan Jari: {Math.round(telemetry.fingerFatiguePct)}% • Akurasi: {Math.round(telemetry.touchAccuracyPct)}% • Backspace: {telemetry.backspaceRatePct}%
          </Text>
          <View style={styles.adjustRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('fingerFatiguePct', -10, 5, 95)}>
              <Text style={styles.stepText}>Lelah -10%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('fingerFatiguePct', 10, 5, 95)}>
              <Text style={styles.stepText}>+10%</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Mata Menatap Layar & Video Call */}
        <View style={styles.metricCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.metricTitle}>3. Mata & Facial rPPG</Text>
            <View style={[styles.dot, { backgroundColor: statusColor(telemetry.blinkRatePerMin >= 12) }]} />
          </View>
          <Text style={styles.metricVal}>{Math.round(telemetry.blinkRatePerMin)} Kedipan/mnt</Text>
          <Text style={styles.mutedText}>
            Screen Time: {telemetry.screenTimeHours.toFixed(1)} jam • HR Pasif: {Math.round(telemetry.passiveHeartRateBpm)} bpm • HRV: {Math.round(telemetry.hrvRmssdMs)} ms
          </Text>
          <View style={styles.adjustRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('blinkRatePerMin', -2, 3, 24)}>
              <Text style={styles.stepText}>Kedip -2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('blinkRatePerMin', 2, 3, 24)}>
              <Text style={styles.stepText}>+2</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Menelepon di ngopi.top */}
        <View style={styles.metricCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.metricTitle}>4. Menelepon (Vocal Biomarker)</Text>
            <View style={[styles.dot, { backgroundColor: statusColor(telemetry.hnrDb >= 14) }]} />
          </View>
          <Text style={styles.metricVal}>{Math.round(telemetry.vocalEnergyPct)}% Energi Vokal</Text>
          <Text style={styles.mutedText}>
            HNR: {telemetry.hnrDb.toFixed(1)} dB • Napas: {Math.round(telemetry.breathRatePerMin)}/mnt • Telepon: {Math.round(telemetry.dailyCallMinutes)} mnt
          </Text>
          <View style={styles.adjustRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('hnrDb', -2, 8, 25)}>
              <Text style={styles.stepText}>HNR -2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustMetric('hnrDb', 2, 8, 25)}>
              <Text style={styles.stepText}>+2</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Live Typing & Voice Call Simulator */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Live Telemetry Sandbox (Zero Content Recording)</Text>
        <Text style={styles.mutedText}>
          Ketik bebas di kotak ini untuk mengukur dinamika dwell/flight time secara real-time (teks tidak disimpan):
        </Text>
        <TextInput
          value={sandboxText}
          onChangeText={handleSandboxChange}
          placeholder="Ketik pesan simulasi chat /warkop di sini..."
          placeholderTextColor="#8B735B"
          style={styles.input}
        />
        <View style={[styles.rowBetween, { flexWrap: 'wrap', gap: 8 }]}>
          <Text style={styles.mutedText}>
            Sampel sesi: {telemetry.samplesCount} • IMU: {imuStatus}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {onRequestImuPermission && (
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={async () => {
                  const st = await onRequestImuPermission();
                  setSensorMsg(
                    st === 'listening'
                      ? 'Sensor IMU (Accelerometer/Orientation) aktif mendengarkan gerakan perangkat.'
                      : st === 'denied'
                      ? 'Izin sensor gerak ditolak browser.'
                      : 'Sensor IMU tidak tersedia pada perangkat desktop ini.'
                  );
                }}
              >
                <Text style={styles.stepText}>Aktifkan Sensor IMU</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cyanBtn} onPress={handleSimulateVoiceCall}>
              <Ionicons name="mic-outline" size={16} color="#0F172A" />
              <Text style={styles.cyanBtnText}>
                {micSimActive ? 'Merekam 2.5d...' : 'Uji Biomarka Suara (Mikrofon)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {sensorMsg && (
          <Text style={[styles.mutedText, { color: '#38BDF8', marginTop: 4 }]}>{sensorMsg}</Text>
        )}
      </View>

      {/* 24-Hour Timeline Telemetry Chart */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Grafik Tren 24 Jam (Energi Vokal, Ketik & Kedipan)</Text>
        <View style={styles.chartRow}>
          {telemetry.timeline24h.map((pt) => (
            <View key={pt.hourLabel} style={styles.chartCol}>
              <View style={styles.barsGroup}>
                <View style={[styles.bar, { height: Math.max(8, pt.vocalEnergy * 0.7), backgroundColor: '#0EA5E9' }]} />
                <View style={[styles.bar, { height: Math.max(8, pt.typingSpeedScore * 0.7), backgroundColor: '#D4AF37' }]} />
                <View style={[styles.bar, { height: Math.max(8, pt.blinkRate * 3), backgroundColor: '#10B981' }]} />
              </View>
              <Text style={styles.chartLabel}>{pt.hourLabel}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legendRow}>
          <Text style={[styles.legendItem, { color: '#0EA5E9' }]}>■ Energi Vokal (%)</Text>
          <Text style={[styles.legendItem, { color: '#D4AF37' }]}>■ Kecepatan Ketik (%)</Text>
          <Text style={[styles.legendItem, { color: '#10B981' }]}>■ Kedipan Mata (x/mnt)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#261C15', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4A3728', gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#D4AF37', fontSize: 15, fontWeight: '800' },
  badgeGreen: { backgroundColor: 'rgba(16,185,129,0.16)', borderColor: '#10B981', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { color: '#10B981', fontSize: 11, fontWeight: '800' },
  bodyText: { color: '#F5E6D3', fontSize: 13, lineHeight: 19, flex: 1 },
  mutedText: { color: '#BFA995', fontSize: 12, lineHeight: 17 },
  findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#1A120B', padding: 8, borderRadius: 8 },
  goldBtn: { backgroundColor: '#D4AF37', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignSelf: 'flex-start' },
  goldBtnText: { color: '#1A120B', fontSize: 13, fontWeight: '800' },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: '#1A120B', borderWidth: 1, borderColor: '#4A3728' },
  presetChipActive: { backgroundColor: '#D4AF37', borderColor: '#F59E0B' },
  presetLabel: { color: '#F5E6D3', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { flex: 1, minWidth: 240, backgroundColor: '#261C15', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4A3728', gap: 6 },
  metricTitle: { color: '#38BDF8', fontSize: 13, fontWeight: '800' },
  metricVal: { color: '#F5E6D3', fontSize: 20, fontWeight: '900' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  adjustRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  stepBtn: { backgroundColor: '#1A120B', borderWidth: 1, borderColor: '#4A3728', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  stepText: { color: '#D4AF37', fontSize: 11, fontWeight: '700' },
  input: { backgroundColor: '#1A120B', color: '#F5E6D3', borderRadius: 10, borderWidth: 1, borderColor: '#4A3728', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  cyanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#38BDF8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  cyanBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  chartRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 90, backgroundColor: '#1A120B', borderRadius: 10, padding: 10 },
  chartCol: { alignItems: 'center', gap: 4 },
  barsGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 8, borderRadius: 4 },
  chartLabel: { color: '#BFA995', fontSize: 10, fontWeight: '700' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { fontSize: 11, fontWeight: '700' },
});
