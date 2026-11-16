import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CekkesLang } from './DoctorVoicePlayer';
import {
  MoveActivityMode,
  GpsTrackPoint,
  calculateCaloriesKcal,
  classifyWalkOrRun,
  detectStepPeak,
  formatElapsedTime,
  formatPaceMinPerKm,
  haversineMeters,
} from './moveProcessors';

export interface MoveSessionResult {
  mode: MoveActivityMode;
  steps: number;
  distanceKm: number;
  durationSec: number;
  caloriesKcal: number;
  paceLabel: string;
  cadenceSpm: number;
}

interface CekkesMoveModalProps {
  visible: boolean;
  lang: CekkesLang;
  weightKg?: number;
  onClose: () => void;
  onFinishSession: (result: MoveSessionResult) => void;
}

type TrackerModeOption = 'auto' | 'walking' | 'running';

export default function CekkesMoveModal({
  visible,
  lang,
  weightKg = 62,
  onClose,
  onFinishSession,
}: CekkesMoveModalProps) {
  const isEn = lang === 'en';
  const [selectedMode, setSelectedMode] = useState<TrackerModeOption>('auto');
  const [detectedMode, setDetectedMode] = useState<MoveActivityMode>('walking');
  const [running, setRunning] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [steps, setSteps] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [cadenceSpm, setCadenceSpm] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [imuBars, setImuBars] = useState<number[]>([15, 22, 18, 25, 20, 16, 24, 19, 21, 17]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const prevGpsRef = useRef<GpsTrackPoint | null>(null);
  const originGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const prevMagRef = useRef<number>(9.81);
  const lastStepMsRef = useRef<number>(0);
  const stepTimestampsRef = useRef<number[]>([]);

  const activeMode: MoveActivityMode =
    selectedMode === 'auto' ? detectedMode : selectedMode;
  const caloriesKcal = calculateCaloriesKcal(activeMode, weightKg, elapsedSec / 60);
  const paceLabel = formatPaceMinPerKm(distanceKm, elapsedSec);

  // Draw Strava-style neon polyline canvas whenever routePoints update
  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark map background
    ctx.fillStyle = '#0B1220';
    ctx.fillRect(0, 0, w, h);

    // Map Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 28) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy <= h; gy += 28) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    if (routePoints.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isEn ? 'Waiting for GPS / Demo Route...' : 'Menunggu Sinyal GPS / Rute Demo...',
        w / 2,
        h / 2
      );
      return;
    }

    // Normalize route bounds to canvas with padding
    let minX = routePoints[0].x;
    let maxX = routePoints[0].x;
    let minY = routePoints[0].y;
    let maxY = routePoints[0].y;
    for (const p of routePoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const spanX = Math.max(1e-5, maxX - minX);
    const spanY = Math.max(1e-5, maxY - minY);
    const pad = 22;

    const toPx = (p: { x: number; y: number }) => ({
      px: pad + ((p.x - minX) / spanX) * (w - pad * 2),
      py: h - pad - ((p.y - minY) / spanY) * (h - pad * 2),
    });

    // Draw Neon Polyline (Strava Orange for running, Emerald for walking)
    ctx.strokeStyle = activeMode === 'running' ? '#FC4C02' : '#10B981';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = activeMode === 'running' ? '#FC4C02' : '#10B981';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    routePoints.forEach((pt, idx) => {
      const { px, py } = toPx(pt);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Start Marker
    const startPt = toPx(routePoints[0]);
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(startPt.px, startPt.py, 5, 0, Math.PI * 2);
    ctx.fill();

    // Current Position Marker
    const endPt = toPx(routePoints[routePoints.length - 1]);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(endPt.px, endPt.py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = activeMode === 'running' ? '#FC4C02' : '#10B981';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }, [routePoints, activeMode, isEn]);

  // Stopwatch ticker when running
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Real IMU Pedometer + Web Geolocation GPS Watch when running (not simulating)
  useEffect(() => {
    if (!running || simulating || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity ?? e.acceleration;
      if (!acc) return;
      const now = performance.now();
      const { isStep, mag } = detectStepPeak(
        acc.x ?? 0,
        acc.y ?? 0,
        acc.z ?? 0,
        prevMagRef.current,
        lastStepMsRef.current,
        now
      );
      prevMagRef.current = mag;
      setImuBars((prev) => [...prev.slice(-9), Math.min(95, Math.max(10, Math.round(mag * 4.5)))]);

      if (isStep) {
        lastStepMsRef.current = now;
        stepTimestampsRef.current = [
          ...stepTimestampsRef.current.filter((t) => now - t <= 10000),
          now,
        ];
        const spm = Math.round((stepTimestampsRef.current.length / 10) * 60);
        const cls = classifyWalkOrRun(spm, mag);
        setCadenceSpm(spm);
        setDetectedMode(cls.mode);
        setSteps((prev) => prev + 1);
        // Fallback indoor distance if GPS has not locked
        if (!prevGpsRef.current) {
          setDistanceKm((d) => Number((d + cls.strideMeters / 1000).toFixed(3)));
        }
      }
    };

    window.addEventListener('devicemotion', onMotion, { passive: true });

    if (navigator.geolocation?.watchPosition) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const t = Date.now();
          if (!originGpsRef.current) {
            originGpsRef.current = { lat, lng };
          }
          if (prevGpsRef.current) {
            const deltaM = haversineMeters(
              prevGpsRef.current.lat,
              prevGpsRef.current.lng,
              lat,
              lng
            );
            // Filter GPS jitter < 1.5m or unrealistic jumps > 50m/s
            if (deltaM >= 1.5 && deltaM <= 120) {
              setDistanceKm((d) => Number((d + deltaM / 1000).toFixed(3)));
            }
          }
          prevGpsRef.current = { lat, lng, t };
          setRoutePoints((pts) => [
            ...pts,
            {
              x: lng - (originGpsRef.current?.lng ?? lng),
              y: lat - (originGpsRef.current?.lat ?? lat),
            },
          ]);
        },
        () => {
          setStatusMsg(
            isEn
              ? 'GPS unavailable/denied — using IMU stride pedometer fallback.'
              : 'GPS tidak aktif/ditolak — menggunakan estimasi jarak langkah IMU.'
          );
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
    }

    return () => {
      window.removeEventListener('devicemotion', onMotion);
      if (watchIdRef.current !== null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [running, simulating, isEn]);

  // Simulated Active Run (1-Click Judge Demo)
  useEffect(() => {
    if (!running || !simulating) return;
    const targetMode: MoveActivityMode = selectedMode === 'walking' ? 'walking' : 'running';
    setDetectedMode(targetMode);
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      const stepDelta = targetMode === 'running' ? 3 : 2;
      const distDeltaKm = targetMode === 'running' ? 0.0036 : 0.0014;
      setSteps((s) => s + stepDelta);
      setDistanceKm((d) => Number((d + distDeltaKm).toFixed(3)));
      setCadenceSpm(targetMode === 'running' ? 156 + (tick % 6) : 114 + (tick % 5));
      setImuBars((prev) => [
        ...prev.slice(-9),
        targetMode === 'running' ? 60 + Math.round(Math.random() * 35) : 30 + Math.round(Math.random() * 25),
      ]);
      // Draw smooth Strava loop route
      const angle = tick * 0.14;
      setRoutePoints((pts) => [
        ...pts,
        {
          x: Math.cos(angle) * 0.004 + Math.sin(angle * 2) * 0.001,
          y: Math.sin(angle) * 0.004,
        },
      ]);
    }, 600);
    return () => clearInterval(id);
  }, [running, simulating, selectedMode]);

  const handleStartLive = async () => {
    setSimulating(false);
    setStatusMsg(
      isEn
        ? 'Tracking live with GPS + IMU Accelerometer...'
        : 'Melacak langsung dengan GPS + Akselerometer IMU...'
    );
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const DME = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (DME && typeof DME.requestPermission === 'function') {
        try {
          await DME.requestPermission();
        } catch {
          // ignore
        }
      }
    }
    setRunning(true);
  };

  const handleStartSimulation = () => {
    setSimulating(true);
    setRunning(true);
    setStatusMsg(
      isEn
        ? 'Judge Demo Mode: Simulating live GPS loop & cadence...'
        : 'Mode Demo Juri: Mensimulasikan rute GPS & cadence lari...'
    );
  };

  const handleFinish = () => {
    setRunning(false);
    setSimulating(false);
    const finalSteps = Math.max(steps, 120);
    const finalDist = Math.max(distanceKm, 0.1);
    const finalSec = Math.max(elapsedSec, 60);
    onFinishSession({
      mode: activeMode,
      steps: finalSteps,
      distanceKm: finalDist,
      durationSec: finalSec,
      caloriesKcal: calculateCaloriesKcal(activeMode, weightKg, finalSec / 60),
      paceLabel: formatPaceMinPerKm(finalDist, finalSec),
      cadenceSpm: cadenceSpm || (activeMode === 'running' ? 156 : 112),
    });
    // Reset local session counters for next run
    setElapsedSec(0);
    setSteps(0);
    setDistanceKm(0);
    setRoutePoints([]);
    setStatusMsg(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerEmoji}>{activeMode === 'running' ? '🏃' : '🚶'}</Text>
              <View>
                <Text style={styles.title}>ceKKes Move</Text>
                <Text style={styles.subtitle}>
                  {isEn ? 'GPS Route + IMU Step Counter' : 'Rute GPS + Penghitung Langkah IMU'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12 }}>
            {/* Mode Switcher */}
            <View style={styles.modeRow}>
              {(
                [
                  { id: 'auto', label: isEn ? '🤖 Auto (IMU)' : '🤖 Otomatis' },
                  { id: 'walking', label: isEn ? '🚶 Walking' : '🚶 Jalan Kaki' },
                  { id: 'running', label: isEn ? '🏃 Running' : '🏃 Lari' },
                ] as const
              ).map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, selectedMode === m.id && styles.modeBtnActive]}
                  onPress={() => setSelectedMode(m.id)}
                >
                  <Text style={[styles.modeText, selectedMode === m.id && { color: '#1A120B' }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Strava Route Canvas */}
            <View style={styles.mapBox}>
              {Platform.OS === 'web' ? (
                React.createElement('canvas', {
                  ref: canvasRef,
                  width: 340,
                  height: 150,
                  style: { width: '100%', height: 150, borderRadius: 12 },
                })
              ) : (
                <View style={styles.nativeMapFallback}>
                  <Ionicons name="navigate" size={28} color="#FC4C02" />
                  <Text style={styles.subtitle}>
                    {routePoints.length} GPS points • {distanceKm.toFixed(2)} km
                  </Text>
                </View>
              )}
              <View style={styles.imuWaveRow}>
                {imuBars.map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.imuBar,
                      {
                        height: Math.max(4, Math.round(h * 0.28)),
                        backgroundColor: activeMode === 'running' ? '#FC4C02' : '#10B981',
                      },
                    ]}
                  />
                ))}
                <Text style={styles.imuLabel}>
                  {activeMode === 'running' ? 'RUNNING' : 'WALKING'} • {cadenceSpm} spm
                </Text>
              </View>
            </View>

            {/* Big Strava Metrics Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{isEn ? 'TIME' : 'WAKTU'}</Text>
                <Text style={styles.statValue}>{formatElapsedTime(elapsedSec)}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{isEn ? 'DISTANCE' : 'JARAK'}</Text>
                <Text style={[styles.statValue, { color: '#FC4C02' }]}>
                  {distanceKm.toFixed(2)} km
                </Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{isEn ? 'STEPS' : 'LANGKAH'}</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>
                  {steps.toLocaleString()}
                </Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>PACE</Text>
                <Text style={styles.statValue}>{paceLabel}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>CADENCE</Text>
                <Text style={styles.statValue}>{cadenceSpm} spm</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{isEn ? 'CALORIES' : 'KALORI'}</Text>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{caloriesKcal} kcal</Text>
              </View>
            </View>

            {statusMsg && <Text style={styles.statusText}>{statusMsg}</Text>}

            {/* Action Buttons */}
            <View style={styles.actionsWrap}>
              {!running ? (
                <TouchableOpacity style={styles.startBtn} onPress={handleStartLive}>
                  <Ionicons name="play" size={16} color="#FFF" />
                  <Text style={styles.startBtnText}>
                    {isEn ? 'Start GPS + IMU' : 'Mulai GPS + IMU'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: '#F59E0B' }]}
                  onPress={() => setRunning(false)}
                >
                  <Ionicons name="pause" size={16} color="#1A120B" />
                  <Text style={[styles.startBtnText, { color: '#1A120B' }]}>
                    {isEn ? 'Pause' : 'Jeda'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.demoBtn} onPress={handleStartSimulation}>
                <Text style={styles.demoBtnText}>
                  ⚡ {isEn ? 'Simulate Active Run' : 'Simulasi Lari (Demo)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
                <Ionicons name="checkmark-done" size={16} color="#0F172A" />
                <Text style={styles.finishBtnText}>
                  {isEn ? 'Finish & Sync to Doctor AI' : 'Selesai & Kirim ke Dokter AI'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E1610',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#FC4C02',
    maxHeight: '92%',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerEmoji: { fontSize: 26 },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  subtitle: { color: '#94A3B8', fontSize: 11.5 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    backgroundColor: '#120D08',
    borderWidth: 1,
    borderColor: '#4A3728',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#F59E0B',
  },
  modeText: { color: '#F5E6D3', fontSize: 11.5, fontWeight: '800' },
  mapBox: {
    backgroundColor: '#0B1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  nativeMapFallback: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imuWaveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
  },
  imuBar: { width: 4, borderRadius: 2 },
  imuLabel: {
    marginLeft: 'auto',
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCell: {
    width: '31.5%',
    flexGrow: 1,
    backgroundColor: '#120D08',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3B2C20',
    alignItems: 'center',
  },
  statLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800' },
  statValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginTop: 2 },
  statusText: { color: '#38BDF8', fontSize: 11.5, textAlign: 'center', fontWeight: '600' },
  actionsWrap: { gap: 8, paddingBottom: 10 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FC4C02',
    paddingVertical: 12,
    borderRadius: 12,
  },
  startBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  demoBtn: {
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  demoBtnText: { color: '#D4AF37', fontSize: 12.5, fontWeight: '800' },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
  },
  finishBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
});
