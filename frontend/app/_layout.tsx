import { useEffect } from 'react';
import { Platform } from 'react-native';
import { coffee } from '../src/theme/coffee';
import { Stack } from 'expo-router';
import '../src/interceptors/axios.interceptor';
import * as serviceWorkerRegistration from '../src/serviceWorkerRegistration';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      serviceWorkerRegistration.register();
    }
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: coffee.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="terms" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="test-payment" options={{ headerShown: false }} />
    </Stack>
  );
}
