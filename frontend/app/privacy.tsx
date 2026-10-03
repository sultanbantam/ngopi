import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Ngopi Privacy Policy</Text>
        <Text style={styles.date}>Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        
        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Welcome to Ngopi. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and protect your information when you use our application within the Pi Network ecosystem.
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.paragraph}>
          - <Text style={styles.bold}>Pi Network Information:</Text> We collect your Pi Network username and authentication token when you log in using the Pi Browser.{"\n"}
          - <Text style={styles.bold}>Communications:</Text> We store the messages, images, and files you send and receive through Ngopi to provide the messaging service.{"\n"}
          - <Text style={styles.bold}>Usage Data:</Text> We may collect diagnostic information and usage data to help us improve the app.
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          - To provide, maintain, and improve our messaging services.{"\n"}
          - To authenticate your identity via the Pi Network.{"\n"}
          - To send technical notices, updates, and security alerts.
        </Text>

        <Text style={styles.sectionTitle}>4. Data Sharing</Text>
        <Text style={styles.paragraph}>
          We do not sell, rent, or share your personal information with third parties for their commercial purposes. Your data is only shared with other users when you participate in chats or group conversations.
        </Text>

        <Text style={styles.sectionTitle}>5. Security</Text>
        <Text style={styles.paragraph}>
          We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.
        </Text>

        <Text style={styles.sectionTitle}>6. Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to request the deletion of your account and data. You can exercise this right within the app settings or by contacting our support team.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#1E293B',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    color: '#10B981',
    marginBottom: 5,
  },
  date: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 24,
  },
  bold: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  }
});
