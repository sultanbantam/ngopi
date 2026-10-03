import { coffee } from '../src/theme/coffee';
import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsOfServiceScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={coffee.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Ngopi Terms of Service</Text>
        <Text style={styles.date}>Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By accessing or using Ngopi, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our application. Since Ngopi operates within the Pi Network ecosystem, you must also comply with the Pi Network Terms of Service.
        </Text>

        <Text style={styles.sectionTitle}>2. Description of Service</Text>
        <Text style={styles.paragraph}>
          Ngopi is a messaging platform designed for the Pi Network community, allowing users to communicate, share media, and interact with other Pioneers.
        </Text>

        <Text style={styles.sectionTitle}>3. User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to use Ngopi to:{"\n"}
          - Transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable.{"\n"}
          - Spam, phish, or defraud other users.{"\n"}
          - Distribute viruses or any other technologies that may harm the app or its users.
        </Text>

        <Text style={styles.sectionTitle}>4. User Content</Text>
        <Text style={styles.paragraph}>
          You retain all rights to the content you send through Ngopi. However, you grant us a worldwide, non-exclusive, royalty-free license to use, copy, reproduce, and process your content solely for the purpose of providing the service. We reserve the right to remove any content that violates these terms.
        </Text>

        <Text style={styles.sectionTitle}>5. Termination</Text>
        <Text style={styles.paragraph}>
          We may suspend or terminate your access to Ngopi at any time, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
        </Text>

        <Text style={styles.sectionTitle}>6. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify these Terms at any time. We will notify users of any significant changes. Your continued use of Ngopi after such modifications constitutes your acceptance of the new Terms.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: coffee.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: coffee.surface,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: coffee.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: coffee.accent,
    marginBottom: 5,
  },
  date: {
    fontSize: 14,
    color: coffee.secondary,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: coffee.text,
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 15,
    color: coffee.secondary,
    lineHeight: 24,
  },
  bold: {
    fontWeight: 'bold',
    color: coffee.text,
  }
});
