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
  speakText?(text: string, langCode: string): Promise<boolean>;
  stopSpeaking?(): Promise<boolean>;
  setLanguageCode?(langCode: string): Promise<boolean>;
}

const directNativeMod: CekkesNativeModuleInterface | null =
  Platform.OS === 'android' && NativeModules?.CekkesBackgroundModule
    ? (NativeModules.CekkesBackgroundModule as CekkesNativeModuleInterface)
    : null;

function getWebViewBridge(): ((method: string, args?: any[]) => Promise<any>) | null {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window as any).__ngopiCekkesNativeAvailable &&
    typeof (window as any).__ngopiCekkesCall === 'function'
  ) {
    return (window as any).__ngopiCekkesCall;
  }
  return null;
}

export function isCekkesNativeAndroidAvailableCheck(): boolean {
  return Boolean(directNativeMod || getWebViewBridge());
}

export const isCekkesNativeAndroidAvailable = Boolean(directNativeMod);

async function callNative<T>(method: keyof CekkesNativeModuleInterface, args: any[] = []): Promise<T | null> {
  if (directNativeMod && typeof (directNativeMod as any)[method] === 'function') {
    return (directNativeMod as any)[method](...args);
  }
  const webCall = getWebViewBridge();
  if (webCall) {
    return webCall(method as string, args);
  }
  return null;
}

export async function startAndroidForegroundImu(): Promise<boolean> {
  return Boolean(await callNative<boolean>('startForegroundImuService'));
}

export async function stopAndroidForegroundImu(): Promise<boolean> {
  return Boolean(await callNative<boolean>('stopForegroundImuService'));
}

export async function readAndroidImuMetrics(): Promise<NativeImuMetrics | null> {
  return callNative<NativeImuMetrics>('getLatestImuMetrics');
}

export async function checkAndroidUsageStatsPermission(): Promise<boolean> {
  return Boolean(await callNative<boolean>('hasUsageStatsPermission'));
}

export async function openAndroidUsageStatsSettings(): Promise<boolean> {
  return Boolean(await callNative<boolean>('openUsageStatsSettings'));
}

export async function readAndroidUsageStatsSummary(
  hoursBack = 16
): Promise<NativeUsageStatsSummary | null> {
  return callNative<NativeUsageStatsSummary>('getUsageStatsSummary', [hoursBack]);
}

export async function speakAndroidTts(text: string, langCode: 'id' | 'en'): Promise<boolean> {
  return Boolean(await callNative<boolean>('speakText', [text, langCode]));
}

export async function stopAndroidTts(): Promise<boolean> {
  return Boolean(await callNative<boolean>('stopSpeaking'));
}

export async function syncAndroidLanguageCode(langCode: 'id' | 'en'): Promise<boolean> {
  return Boolean(await callNative<boolean>('setLanguageCode', [langCode]));
}
