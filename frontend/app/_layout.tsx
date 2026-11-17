import { useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { coffee } from '../src/theme/coffee';
import { Stack, ErrorBoundaryProps } from 'expo-router';
import '../src/interceptors/axios.interceptor';
import * as serviceWorkerRegistration from '../src/serviceWorkerRegistration';
import NgopiWebViewContainer from '../src/components/NgopiWebViewContainer';
import { LanguageProvider } from '../src/utils/i18n';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const handleHardReset = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if ('caches' in window) {
          const keys = await window.caches.keys();
          await Promise.all(keys.map((k) => window.caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {
        // ignore
      }
      window.location.reload();
      return;
    }
    retry();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#120D08', justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14 }}>
      <Text style={{ color: '#F5E6D3', fontSize: 20, fontWeight: '900' }}>Terjadi Gangguan Tampilan</Text>
      <Text style={{ color: '#CBD5E1', fontSize: 13, textAlign: 'center' }}>
        {error?.message || 'Unexpected application error'}
      </Text>
      <TouchableOpacity
        onPress={handleHardReset}
        style={{ backgroundColor: '#D4AF37', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
      >
        <Text style={{ color: '#1A120B', fontWeight: '900' }}>Muat Ulang & Bersihkan Cache</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      serviceWorkerRegistration.register();
    }
  }, []);

  if (Platform.OS !== 'web') {
    return <NgopiWebViewContainer />;
  }

  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: coffee.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="terms" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="test-payment" options={{ headerShown: false }} />
      </Stack>
    </LanguageProvider>
  );
}
