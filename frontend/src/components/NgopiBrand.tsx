import { Image, StyleSheet, Text, View } from 'react-native';

/** Keep brand text native so it stays sharp and follows accessibility text scaling. */
export default function NgopiBrand() {
  return (
    <View style={styles.brand} accessibilityLabel="Ngopi, ngobrol paling intim">
      <Image source={require('../../assets/logo.png')} style={styles.mark} resizeMode="contain" accessible={false} />
      <Text style={styles.name}>Ngopi</Text>
      <Text style={styles.tagline}>ngobrol paling intim</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  brand: { alignItems: 'center', width: '100%', marginBottom: 20 },
  mark: { width: 112, height: 112 },
  name: { color: '#F6E6D2', fontSize: 42, lineHeight: 52, fontWeight: '700', textAlign: 'center' },
  tagline: { color: '#D6A16D', fontSize: 15, lineHeight: 24, textAlign: 'center', marginTop: 4 },
});
