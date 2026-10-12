import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coffee as baseCoffee } from '../theme/coffee';
import axios from 'axios';
import { getAuthHeaders } from '../utils/api';
import PrivacyModal from './PrivacyModal';

const coffee = {
  ...baseCoffee,
  cream: baseCoffee.text,
  textSecondary: baseCoffee.secondary,
  primary: baseCoffee.accent,
};

const API_URL = 'https://api.ngopi.top/api';
const CONSENT_STORAGE_KEY = 'ngopi_consent_v3';

export default function ConsentBannerModal() {
  const [visible, setVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const consented = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (consented !== 'accepted') {
        setVisible(true);
      }
    }
  }, []);

  const handleAccept = async () => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
      }
      setVisible(false);

      // Async record to server if authenticated
      const headers = await getAuthHeaders().catch(() => null);
      if (headers) {
        await axios.post(
          `${API_URL}/compliance/consent`,
          {
            policy_version: 'v3.0-2026',
            terms_version: 'v3.0-2026',
          },
          { headers }
        ).catch(() => null);
      }
    } catch {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.shieldIcon}>
                <Ionicons name="shield-checkmark" size={18} color="#FFF" />
              </View>
              <View style={styles.titleCol}>
                <Text style={styles.title}>Perlindungan Data Pribadi (UU PDP)</Text>
                <Text style={styles.subtitle}>UU No. 27/2022 • Atmosfer Warkop Privat & Aman</Text>
              </View>
            </View>

            <Text style={styles.bodyText}>
              Ngopi menjamin privasi Anda: Chat terenkripsi penuh (E2EE X25519/AES-256-GCM), tanpa nomor HP, dan data Anda tidak pernah dijual ke pengiklan. Dengan melanjutkan, Anda menyetujui Kebijakan Privasi dan Syarat Ketentuan kami.
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.readPolicyBtn}
                onPress={() => setPrivacyModalVisible(true)}
              >
                <Text style={styles.readPolicyText}>Baca Kebijakan</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                <Text style={styles.acceptBtnText}>Saya Paham & Setuju</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PrivacyModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: coffee.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: coffee.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  shieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2E7D32', // Green
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  title: {
    color: coffee.cream,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: coffee.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  bodyText: {
    color: coffee.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  readPolicyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readPolicyText: {
    color: coffee.cream,
    fontSize: 12,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 1.4,
    backgroundColor: '#2E7D32',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
