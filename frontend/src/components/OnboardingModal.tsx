import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { coffee } from '../theme/coffee';
import * as SecureStore from '../utils/storage';

const ONBOARDING_KEY = 'ngopi_has_seen_onboarding_v1';

const STEPS = [
  {
    icon: '☕',
    title: 'Selamat datang di Ngopi!',
    subtitle: 'ngobrol paling intim',
    description: 'Di sini obrolanmu privat, terenkripsi ujung-ke-ujung (E2EE), dan tanpa nomor HP. Santai seperti ngopi di warung.',
  },
  {
    icon: '🌿',
    title: 'Suasana Warung Kopi',
    subtitle: 'Nongkrong Tanpa Tekanan Medsos',
    description: 'Nikmati Warung Kopi bersama komunitas. Putar lagu bareng di Jukebox, hidupkan suara hujan, dan rasakan obrolan yang lebih hidup.',
  },
  {
    icon: '🤝',
    title: 'Mulai Obrolan Baru',
    subtitle: 'Ruang Privat untuk Semua Generasi',
    description: 'Cari teman lewat ID Ngopi, buat Warung pribadimu, atau saling traktir kopi dengan token BMC. Selamat bergabung!',
  },
];

export const OnboardingModal = () => {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        let seen = '';
        if (Platform.OS === 'web') {
          seen = localStorage.getItem(ONBOARDING_KEY) || '';
        } else {
          seen = (await SecureStore.getItemAsync(ONBOARDING_KEY)) || '';
        }
        if (!seen) {
          setVisible(true);
        }
      } catch {}
    };
    checkOnboarding();
  }, []);

  const handleFinish = async () => {
    setVisible(false);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(ONBOARDING_KEY, 'true');
      } else {
        await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
      }
    } catch {}
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  if (!visible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentStep ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          <View style={styles.iconCircle}>
            <Text style={styles.icon}>{step.icon}</Text>
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.buttonRow}>
            {!isLast && (
              <TouchableOpacity style={styles.skipButton} onPress={handleFinish}>
                <Text style={styles.skipText}>Lewati</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextText}>{isLast ? 'Mulai Ngopi ☕' : 'Lanjut →'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 8, 6, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: coffee.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: coffee.border,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: coffee.accent,
  },
  dotInactive: {
    width: 8,
    backgroundColor: coffee.raised,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: coffee.inset,
    borderWidth: 1.5,
    borderColor: coffee.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: coffee.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: coffee.accent,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: coffee.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    color: coffee.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    backgroundColor: coffee.button,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coffee.accentWash,
  },
  nextText: {
    color: coffee.buttonText,
    fontSize: 15,
    fontWeight: '700',
  },
});
