import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from '../src/utils/storage';

export default function IndexScreen() {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        let token = null;
        if (Platform.OS === 'web') {
          token = localStorage.getItem('token');
        } else {
          token = await SecureStore.getItemAsync('token');
        }
        
        if (token) {
          router.replace('/(main)/contacts');
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
  }
});
