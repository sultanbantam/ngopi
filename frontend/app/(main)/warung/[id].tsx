import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CafePartnerModal from '../../../src/components/CafePartnerModal';
import { coffee } from '../../../src/theme/coffee';

export default function WarungCafePage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <CafePartnerModal
        visible={true}
        cafeTokenOrId={id}
        onClose={() => router.replace('/(main)/warkop' as any)}
        onCheckinSuccess={(_pts, _total, cafeName) => {
          // Keep page or redirect back to warkop after success
        }}
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
