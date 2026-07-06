import { Stack } from 'expo-router';
import axios from 'axios';

// Skip ngrok browser warning for all API requests
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
    </Stack>
  );
}
