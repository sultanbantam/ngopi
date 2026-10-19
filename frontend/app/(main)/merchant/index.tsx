import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import MerchantDashboardModal from '../../../src/components/MerchantDashboardModal';
import { coffee } from '../../../src/theme/coffee';

export default function MerchantDashboardPage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <MerchantDashboardModal
        visible={true}
        onClose={() => router.replace('/(main)/warkop' as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: coffee.background,
  },
});
