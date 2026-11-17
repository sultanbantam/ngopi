import { coffee } from '../theme/coffee';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../utils/i18n';

/** Keep brand text native so it stays sharp and follows accessibility text scaling. */
export default function NgopiBrand() {
  const { t } = useLanguage();
  return (
    <View style={styles.brand} accessibilityLabel={t('Ngopi, ngobrol paling intim', 'Ngopi, the most intimate chats')}>
      <Image source={require('../../assets/logo.png')} style={styles.mark} resizeMode="contain" accessible={false} />
      <Text style={styles.name}>Ngopi</Text>
      <Text style={styles.tagline}>{t('ngobrol paling intim', 'the most intimate chats')}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  brand: { alignItems: 'center', width: '100%', marginBottom: 20 },
  mark: { width: 112, height: 112 },
  name: { color: coffee.text, fontSize: 42, lineHeight: 52, fontWeight: '700', textAlign: 'center' },
  tagline: { color: coffee.accent, fontSize: 15, lineHeight: 24, textAlign: 'center', marginTop: 4 },
});
