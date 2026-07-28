import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { getLastRefreshFailureReason, getValidAccessToken, hasStoredSession } from '../src/utils/session';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoImage = require('../assets/logo.png');

export default function IndexScreen() {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const hadSession = await hasStoredSession();
        const token = await getValidAccessToken();
        const canOpenOffline = hadSession && getLastRefreshFailureReason() === 'unavailable';

        if (token || canOpenOffline) {
          router.replace('/(main)/bambupedia');
        } else {
          router.replace('/(auth)/login');
        }
      } catch (error) {
        router.replace('/(auth)/login');
      }
    };
    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Image source={logoImage} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator size="large" color="#10B981" />
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
  }
});