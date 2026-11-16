// Pure TypeScript Pedometer, GPS Haversine, Pace & METs Calorie Processors for ceKKes Move

export type MoveActivityMode = 'walking' | 'running';

export interface GpsTrackPoint {
  lat: number;
  lng: number;
  t: number; // ms
}

export interface MoveDailySummary {
  date: string; // YYYY-MM-DD
  steps: number;
  walkingKm: number;
  runningKm: number;
  durationMinutes: number;
  caloriesKcal: number;
  lastMode: MoveActivityMode;
}

/**
 * Compute great-circle distance in meters between two GPS coordinates using Haversine formula.
 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 3D Accelerometer Magnitude Peak Detection for step counting.
 * Threshold ~11.5 m/s^2 with 250ms minimum refractory interval.
 */
export function detectStepPeak(
  ax: number,
  ay: number,
  az: number,
  prevMag: number,
  lastPeakMs: number,
  nowMs: number,
  threshold = 11.5,
  minIntervalMs = 250
): { isStep: boolean; mag: number } {
  const mag = Math.sqrt(ax * ax + ay * ay + az * az);
  const isStep =
    mag >= threshold &&
    prevMag < threshold &&
    nowMs - lastPeakMs >= minIntervalMs;
  return { isStep, mag };
}

/**
 * Classify walking vs running from real-time cadence (steps/min) and peak amplitude (m/s^2).
 */
export function classifyWalkOrRun(
  cadenceSpm: number,
  peakAmplitude = 12.5,
  heightCm = 170
): { mode: MoveActivityMode; strideMeters: number } {
  const isRun = cadenceSpm > 140 || peakAmplitude > 16.0;
  if (isRun) {
    return { mode: 'running', strideMeters: Number(((heightCm * 0.66) / 100).toFixed(2)) }; // ~1.12m
  }
  return { mode: 'walking', strideMeters: Number(((heightCm * 0.415) / 100).toFixed(2)) }; // ~0.71m
}

/**
 * Format Strava-style pace string: e.g. `6'15" /km` or `--'--"` if distance < 0.01 km.
 */
export function formatPaceMinPerKm(distanceKm: number, elapsedSec: number): string {
  if (distanceKm < 0.01 || elapsedSec <= 0) return "--'--\" /km";
  const secPerKm = elapsedSec / distanceKm;
  if (secPerKm > 3600) return "--'--\" /km";
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}'${String(secs).padStart(2, '0')}" /km`;
}

/**
 * Format stopwatch MM:SS or HH:MM:SS.
 */
export function formatElapsedTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calculate calories burned using METs formula:
 * MET * 3.5 * weightKg / 200 * durationMin (Walking MET = 3.8, Running MET = 8.5).
 */
export function calculateCaloriesKcal(
  mode: MoveActivityMode,
  weightKg: number,
  durationMin: number
): number {
  const met = mode === 'running' ? 8.5 : 3.8;
  const safeWeight = Math.max(25, weightKg || 62);
  const safeMin = Math.max(0, durationMin);
  return Math.round(((met * 3.5 * safeWeight) / 200) * safeMin);
}
