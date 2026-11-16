import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CekkesLang } from './DoctorVoicePlayer';
import { DetectedFinding } from './medicalKnowledgeBase';
import { PassiveTelemetryState } from './useCekkesPassiveAgent';

interface SmartHealthBannerProps {
  visible: boolean;
  lang: CekkesLang;
  telemetry: PassiveTelemetryState;
  findings: DetectedFinding[];
  isSpeaking: boolean;
  onOpenDashboard: () => void;
  onPlayVoice: () => void;
  onDismiss: () => void;
}

export default function SmartHealthBanner({
  visible,
  lang,
  telemetry,
  findings,
  isSpeaking,
  onOpenDashboard,
  onPlayVoice,
  onDismiss,
}: SmartHealthBannerProps) {
  if (!visible) return null;

  const summary =
    lang === 'en'
      ? findings.length > 0
        ? `24h screen & call scan detected ${findings.length} alert(s): blink ${Math.round(
            telemetry.blinkRatePerMin
          )}/min & finger fatigue ${Math.round(telemetry.fingerFatiguePct)}%.`
        : `24h routine summary ready: HR ${Math.round(
            telemetry.passiveHeartRateBpm
          )} bpm, blink ${Math.round(telemetry.blinkRatePerMin)}/min, vocal ${Math.round(
            telemetry.vocalEnergyPct
          )}%.`
      : findings.length > 0
      ? `Dari aktivitas layar & telepon 24 jam, terdeteksi ${findings.length} perhatian: kedipan ${Math.round(
          telemetry.blinkRatePerMin
        )}x/mnt & kelelahan jari ${Math.round(telemetry.fingerFatiguePct)}% (${Math.round(
          telemetry.motorResponseMs
        )} ms).`
      : `Ringkasan 24 jam siap: HR pasif ${Math.round(
          telemetry.passiveHeartRateBpm
        )} bpm, kedipan ${Math.round(telemetry.blinkRatePerMin)}x/mnt, vokal ${Math.round(
          telemetry.vocalEnergyPct
        )}%.`;

  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="notifications" size={16} color="#38BDF8" />
          <Text style={styles.title}>
            {lang === 'en'
              ? 'dr. ceKKes AI — 24h Routine Report Ready'
              : 'dr. ceKKes AI — Laporan Rutinitas 24 Jam Siap'}
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <Text style={styles.body}>{summary}</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.dashBtn} onPress={onOpenDashboard}>
          <Ionicons name="stats-chart" size={14} color="#1A120B" />
          <Text style={styles.dashBtnText}>
            {lang === 'en' ? 'Open Dashboard' : 'Buka Dashboard'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.voiceBtn, isSpeaking && styles.voiceBtnActive]}
          onPress={onPlayVoice}
        >
          <Ionicons name={isSpeaking ? 'stop-circle' : 'volume-high'} size={15} color="#0F172A" />
          <Text style={styles.voiceBtnText}>
            {isSpeaking
              ? lang === 'en'
                ? 'Stop Audio'
                : 'Hentikan Suara'
              : lang === 'en'
              ? 'Play Doctor Voice'
              : 'Putar Suara Dokter'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  body: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  dashBtnText: {
    color: '#1A120B',
    fontSize: 12,
    fontWeight: '800',
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  voiceBtnActive: {
    backgroundColor: '#FB7185',
  },
  voiceBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
});
