import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCekkesPassiveAgent } from './useCekkesPassiveAgent';
import { DetectedFinding } from './medicalKnowledgeBase';
import PassiveDashboard from './PassiveDashboard';
import ActiveScanner from './ActiveScanner';
import CarePlanEngine from './CarePlanEngine';

type CekkesTab = 'passive' | 'active' | 'careplan';
const ACTIVE_FINDINGS_KEY = 'ngopi_cekkes_active_findings';

export default function CekkesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<CekkesTab>('passive');
  const [activeFindings, setActiveFindings] = useState<DetectedFinding[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(ACTIVE_FINDINGS_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ACTIVE_FINDINGS_KEY, JSON.stringify(activeFindings));
      }
    } catch {
      // ignore
    }
  }, [activeFindings]);

  const {
    telemetry,
    imuStatus,
    requestImuPermission,
    updateTelemetry,
    applyPreset,
    recordKeystrokeSample,
    findings: passiveFindings,
  } = useCekkesPassiveAgent(false);

  const upsertActiveFinding = (finding: DetectedFinding) => {
    setActiveFindings((prev) => {
      const filtered = prev.filter((f) => f.id !== finding.id);
      return [...filtered, finding];
    });
  };

  const combinedFindings = useMemo(
    () => [...passiveFindings, ...activeFindings],
    [passiveFindings, activeFindings]
  );

  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#F5E6D3" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>ceKKes — Cek Kesehatan Mandiri</Text>
            <View style={styles.agentBadge}>
              <View style={styles.agentDot} />
              <Text style={styles.agentBadgeText}>Agent Active</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Autonomous Personal Health AI Agent • Terintegrasi Aktivitas ngopi.top
          </Text>
        </View>
      </View>

      {/* 3-Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'passive' && styles.tabBtnActive]}
          onPress={() => setTab('passive')}
        >
          <Text style={[styles.tabText, tab === 'passive' && styles.tabTextActive]}>
            Dashboard Harian (Passive Agent)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Pemeriksaan Aktif (6-Sensor)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'careplan' && styles.tabBtnActive]}
          onPress={() => setTab('careplan')}
        >
          <Text style={[styles.tabText, tab === 'careplan' && styles.tabTextActive]}>
            Resep & Jadwal Otonom ({combinedFindings.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {tab === 'passive' ? (
          <PassiveDashboard
            telemetry={telemetry}
            imuStatus={imuStatus}
            findings={passiveFindings}
            onApplyPreset={applyPreset}
            onUpdateTelemetry={updateTelemetry}
            onRecordKeystroke={recordKeystrokeSample}
            onRequestImuPermission={requestImuPermission}
            onGoToCarePlan={() => setTab('careplan')}
          />
        ) : null}

        {tab === 'active' ? (
          <ActiveScanner
            activeFindings={activeFindings}
            onUpsertFinding={upsertActiveFinding}
            onUpdateTelemetry={(metrics) => {
              updateTelemetry((prev) => ({
                ...prev,
                passiveHeartRateBpm: metrics.hrBpm ?? prev.passiveHeartRateBpm,
                hrvRmssdMs: metrics.hrvMs ?? prev.hrvRmssdMs,
                vocalEnergyPct: metrics.vocalEnergyPct ?? prev.vocalEnergyPct,
                hnrDb: metrics.hnrDb ?? prev.hnrDb,
                breathRatePerMin: metrics.breathRatePerMin ?? prev.breathRatePerMin,
                samplesCount: prev.samplesCount + 1,
                activePreset: 'live',
              }));
            }}
            onGoToCarePlan={() => setTab('careplan')}
          />
        ) : null}

        {tab === 'careplan' ? <CarePlanEngine findings={combinedFindings} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#120D08' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1A120B',
    borderBottomWidth: 1,
    borderBottomColor: '#3B2B1E',
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#4A3728',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { color: '#F5E6D3', fontSize: 18, fontWeight: '900' },
  subtitle: { color: '#D4AF37', fontSize: 12, marginTop: 2 },
  agentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  agentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  agentBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '800' },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1A120B',
    borderBottomWidth: 1,
    borderBottomColor: '#3B2B1E',
    flexWrap: 'wrap',
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#4A3728',
  },
  tabBtnActive: { backgroundColor: '#D4AF37', borderColor: '#F59E0B' },
  tabText: { color: '#F5E6D3', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#1A120B', fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
});
