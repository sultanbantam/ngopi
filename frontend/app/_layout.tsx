import { coffee } from '../src/theme/coffee';
import { Stack } from 'expo-router';
import '../src/interceptors/axios.interceptor';
export default function RootLayout() {
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
