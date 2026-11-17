import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../utils/i18n';

export type SkinConditionFlag = 'none' | 'wart_clavus' | 'folliculitis' | 'eczema_acute' | 'bleeding_wound' | 'fungal_active';

interface ThermalTherapyGuideProps {
  detectedSkinCondition: SkinConditionFlag;
  onSelectSkinCondition: (cond: SkinConditionFlag) => void;
}

export default function ThermalTherapyGuide({
  detectedSkinCondition,
  onSelectSkinCondition,
}: ThermalTherapyGuideProps) {
  const { t } = useLanguage();
  const [deviceTempC, setDeviceTempC] = useState(35.4);
  const [secondsLeft, setSecondsLeft] = useState(30 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const isLocked =
    detectedSkinCondition === 'eczema_acute' ||
    detectedSkinCondition === 'bleeding_wound' ||
    detectedSkinCondition === 'fungal_active';

  useEffect(() => {
    if (!timerRunning || isLocked) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, isLocked]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="thermometer-outline" size={20} color="#F59E0B" />
        <Text style={styles.title}>
          {t('Modul 6: Asisten Terapi Termal Terukur & Keamanan Kulit', 'Module 6: Guided Thermal Therapy & Skin Safety')}
        </Text>
      </View>

      {/* Mandatory Medical & Device Safety Guardrail */}
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>
          {t('GUARDRAIL KEAMANAN PERANGKAT & MEDIS (WAJIB)', 'DEVICE & MEDICAL SAFETY GUARDRAIL (MANDATORY)')}
        </Text>
        <Text style={styles.warningText}>
          •{' '}
          {t(
            'DILARANG KERAS memanaskan bodi HP/tablet dan menempelkannya langsung ke kulit yang luka, eksim, atau berjamur.',
            'STRICTLY PROHIBITED to heat your phone/tablet body and press it onto wounded, eczematous, or fungal skin.'
          )}
        </Text>
        <Text style={styles.warningText}>
          •{' '}
          {t(
            'Suhu di atas 44°C memicu luka bakar jaringan, memperparah inflamasi eksim, merusak baterai Lithium-Ion (risiko thermal burn), dan menyebarkan spora jamur/virus HPV ke layar HP.',
            'Temperatures above 44°C can cause tissue burns, worsen eczema inflammation, damage Lithium-Ion batteries, and spread fungal spores/HPV onto the screen.'
          )}
        </Text>
      </View>

      {/* Device Thermal Monitor */}
      <View style={styles.tempRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            {t('Estimasi Suhu Perangkat (Batas Aman < 40°C)', 'Estimated Device Temp (Safe Limit < 40°C)')}
          </Text>
          <Text style={[styles.tempVal, { color: deviceTempC >= 40 ? '#F43F5E' : '#10B981' }]}>
            {deviceTempC.toFixed(1)} °C —{' '}
            {deviceTempC >= 40
              ? t('TERLALU PANAS (Istirahatkan HP)', 'TOO HOT (Rest Device)')
              : t('AMAN', 'SAFE')}
          </Text>
        </View>
        <View style={styles.stepBtns}>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => setDeviceTempC((prev) => Math.max(30, Number((prev - 1.5).toFixed(1))))}
          >
            <Text style={styles.smallBtnText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => setDeviceTempC((prev) => Math.min(46, Number((prev + 1.5).toFixed(1))))}
          >
            <Text style={styles.smallBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Skin Condition Selector */}
      <Text style={styles.label}>
        {t('Simulasi / Hasil Pemeriksaan Kondisi Kulit:', 'Skin Condition Screening / Simulation:')}
      </Text>
      <View style={styles.chipWrap}>
        {[
          { id: 'wart_clavus', label: t('Kutil / HPV (Aman 43°C)', 'Wart / HPV (Safe 43°C)') },
          { id: 'folliculitis', label: t('Bisul Ringan (Aman 42°C)', 'Mild Boil (Safe 42°C)') },
          { id: 'eczema_acute', label: t('Eksim Meradang (Terkunci)', 'Acute Eczema (Locked)') },
          { id: 'bleeding_wound', label: t('Luka Berdarah (Terkunci)', 'Bleeding Wound (Locked)') },
          { id: 'fungal_active', label: t('Jamur Aktif (Terkunci)', 'Active Fungal (Locked)') },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.chip, detectedSkinCondition === opt.id && styles.chipActive]}
            onPress={() => {
              onSelectSkinCondition(opt.id as SkinConditionFlag);
              if (opt.id === 'eczema_acute' || opt.id === 'bleeding_wound' || opt.id === 'fungal_active') {
                setTimerRunning(false);
              }
            }}
          >
            <Text style={styles.chipText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Locked vs Clinical Guided Hyperthermia */}
      {isLocked ? (
        <View style={styles.lockedBox}>
          <Ionicons name="lock-closed" size={18} color="#F43F5E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.lockedTitle}>
              {t('KOMPRES PANAS DIKUNCI OTOMATIS', 'HEAT COMPRESS AUTO-LOCKED')}
            </Text>
            <Text style={styles.bodyText}>
              {t(
                `Terdeteksi indikasi kontraindikasi (${detectedSkinCondition.replace('_', ' ')}). Agen mengalihkan penanganan ke kompres dingin bersih atau terapi antijamur/pelembap kering.`,
                `Contraindication detected (${detectedSkinCondition.replace('_', ' ')}). Switched guidance to clean cool compress or targeted antifungal/dry moisturizer care.`
              )}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.timerBox}>
          <Text style={styles.timerTitle}>
            {t(
              'Guided Local Hyperthermia Timer (Kompres Hangat Bersih / Medical Warming Patch 42°C–44°C)',
              'Guided Local Hyperthermia Timer (Clean Warm Compress / Medical Warming Patch 42°C–44°C)'
            )}
          </Text>
          <Text style={styles.timerClock}>{timeFormatted}</Text>
          <Text style={styles.mutedText}>
            {t(
              'Jadwal Klinis: 1 sesi 30 menit/hari (Pukul 20:30 WIB) menggunakan kompres hangat bersih atau medical patch — bukan bodi HP.',
              'Clinical Schedule: 1 session 30 min/day (20:30 local time) using a clean warm compress or medical patch — never the phone body.'
            )}
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setTimerRunning((v) => !v)}
            >
              <Text style={styles.btnText}>
                {timerRunning ? t('Jeda Timer', 'Pause Timer') : t('Mulai Sesi 30 Menit', 'Start 30-Min Session')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setTimerRunning(false);
                setSecondsLeft(30 * 60);
              }}
            >
              <Text style={styles.btnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#261C15', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4A3728', gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#D4AF37', fontSize: 15, fontWeight: '800', flex: 1 },
  warningBox: { backgroundColor: 'rgba(244,63,94,0.12)', borderWidth: 1, borderColor: '#F43F5E', borderRadius: 10, padding: 10, gap: 4 },
  warningTitle: { color: '#FDA4AF', fontSize: 12, fontWeight: '800' },
  warningText: { color: '#FFE4E6', fontSize: 12, lineHeight: 17 },
  tempRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A120B', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#3B2B1E', gap: 10 },
  label: { color: '#D6C7B8', fontSize: 12, fontWeight: '700' },
  tempVal: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  stepBtns: { flexDirection: 'row', gap: 6 },
  smallBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#3B2B1E', alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: '#F5E6D3', fontSize: 16, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1A120B', borderWidth: 1, borderColor: '#4A3728' },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#F59E0B' },
  chipText: { color: '#F5E6D3', fontSize: 11, fontWeight: '700' },
  lockedBox: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(244,63,94,0.15)', borderColor: '#F43F5E', borderWidth: 1, padding: 12, borderRadius: 10 },
  lockedTitle: { color: '#FDA4AF', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  bodyText: { color: '#F5E6D3', fontSize: 12, lineHeight: 17 },
  timerBox: { backgroundColor: '#1A120B', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#0EA5E9', gap: 6, alignItems: 'center' },
  timerTitle: { color: '#38BDF8', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  timerClock: { color: '#10B981', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  mutedText: { color: '#BFA995', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  secondaryBtn: { backgroundColor: '#3B2B1E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#1A120B', fontSize: 12, fontWeight: '800' },
});
