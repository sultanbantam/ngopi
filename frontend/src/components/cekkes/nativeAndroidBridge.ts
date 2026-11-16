import { NativeModules, Platform } from 'react-native';

export interface NativeImuMetrics {
  running: boolean;
  tremorHz: number;
  posturePitchDeg: number;
  updatedAtMs: number;
}

export interface NativeUsageStatsSummary {
  totalScreenMinutes: number;
  activeAppCount: number;
}

interface CekkesNativeModuleInterface {
  startForegroundImuService(): Promise<boolean>;
  stopForegroundImuService(): Promise<boolean>;
  getLatestImuMetrics(): Promise<NativeImuMetrics>;
  hasUsageStatsPermission(): Promise<boolean>;
  openUsageStatsSettings(): Promise<boolean>;
  getUsageStatsSummary(hoursBack: number): Promise<NativeUsageStatsSummary>;
}

const nativeMod: CekkesNativeModuleInterface | null =
  Platform.OS === 'android' && NativeModules?.CekkesBackgroundModule
    ? (NativeModules.CekkesBackgroundModule as CekkesNativeModuleInterface)
    : null;

export const isCekkesNativeAndroidAvailable = Boolean(nativeMod);

export async function startAndroidForegroundImu(): Promise<boolean> {
  if (!nativeMod) return false;
  return nativeMod.startForegroundImuService();
}

export async function stopAndroidForegroundImu(): Promise<boolean> {
  if (!nativeMod) return false;
  return nativeMod.stopForegroundImuService();
}

export async function readAndroidImuMetrics(): Promise<NativeImuMetrics | null> {
  if (!nativeMod) return null;
  return nativeMod.getLatestImuMetrics();
}

export async function checkAndroidUsageStatsPermission(): Promise<boolean> {
  if (!nativeMod) return false;
  return nativeMod.hasUsageStatsPermission();
}

export async function openAndroidUsageStatsSettings(): Promise<boolean> {
  if (!nativeMod) return false;
  return nativeMod.openUsageStatsSettings();
}

export async function readAndroidUsageStatsSummary(
  hoursBack = 16
): Promise<NativeUsageStatsSummary | null> {
  if (!nativeMod) return null;
  return nativeMod.getUsageStatsSummary(hoursBack);
}
