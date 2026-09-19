import { useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { getLastRefreshFailureReason, getValidAccessToken, hasStoredSession } from '../src/utils/session';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoImage = require('../assets/logo.png');

export default function IndexScreen() {
  useEffect(() => {
    const checkSession = async () => {
      const hasSession = await hasStoredSession();
      if (hasSession) {
        router.replace('/(main)/bambupedia');
      } else {
        router.replace('/(auth)/register');
      }
    };
    checkSession();
  }, []);

  return (
    <View style={styles.container}>
      <Image source={logoImage} style={styles.logo} resizeMode="contain" />
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/test-payment')}
      >
        <Text style={styles.buttonText}>Langsung ke Test Payment</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: '#3B82F6', marginTop: 15 }]}
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
    backgroundColor: '#0F172A',
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});