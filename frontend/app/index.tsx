import { coffee } from '../src/theme/coffee';
import { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { getLastRefreshFailureReason, getValidAccessToken, hasStoredSession } from '../src/utils/session';

import NgopiBrand from '../src/components/NgopiBrand';

export default function IndexScreen() {
  useEffect(() => {
    const checkSession = async () => {
      const hasSession = await hasStoredSession();
      if (hasSession) {
        router.replace('/(main)/warkop');
      } else {
        router.replace('/(auth)/register');
      }
    };
    checkSession();
  }, []);

  return (
    <View style={styles.container}>
      <NgopiBrand />

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/test-payment')}
      >
        <Text style={styles.buttonText}>Langsung ke Test Payment</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: coffee.border, marginTop: 15 }]}
        onPress={() => router.push('/(auth)/login')}
      >
        <Text style={styles.buttonText}>Masuk ke Aplikasi</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: coffee.background,
  },
  button: {
    backgroundColor: coffee.button,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  buttonText: {
    color: coffee.text,
    fontSize: 16,
    fontWeight: 'bold',
  }
});
