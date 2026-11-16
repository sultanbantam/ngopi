import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCekkesPassiveAgent } from './useCekkesPassiveAgent';
import {
  DetectedFinding,
  UserHealthProfile,
  generateAutonomousCarePlan,
} from './medicalKnowledgeBase';
import PassiveDashboard from './PassiveDashboard';
import ActiveScanner from './ActiveScanner';
import CarePlanEngine from './CarePlanEngine';
import SmartHealthBanner from './SmartHealthBanner';
import {
  CekkesLang,
  buildDoctorBriefingScript,
  speakDoctorText,
  stopDoctorSpeech,
} from './DoctorVoicePlayer';

type CekkesTab = 'passive' | 'active' | 'careplan';
const ACTIVE_FINDINGS_KEY = 'ngopi_cekkes_active_findings';
const PROFILE_KEY = 'ngopi_cekkes_profile';

const DEFAULT_PROFILE: UserHealthProfile = {
  age: 28,
  weightKg: 62,
  allergies: '',
  isPregnantOrBreastfeeding: false,
  onBloodThinners: false,
  hasGerd: false,
  redFlagChestPain: false,
  redFlagShortnessOfBreath: false,
  redFlagHighFever3Days: false,
  redFlagPurulentWound: false,
};

export default function CekkesPage() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const [tab, setTab] = useState<CekkesTab>('passive');
  const [lang, setLang] = useState<CekkesLang>('id');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [clinicalModalOpen, setClinicalModalOpen] = useState(false);

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

  useEffect(() => {
    return () => {
      stopDoctorSpeech();
    };
  }, []);

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

  // Read stored profile for synchronous 24h CarePlan preview & Doctor Voice script
  const previewProfile = useMemo<UserHealthProfile>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(PROFILE_KEY);
        if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROFILE;
  }, [tab, combinedFindings]);

  const carePlanPreview = useMemo(
    () => generateAutonomousCarePlan(previewProfile, combinedFindings, lang),
    [previewProfile, combinedFindings, lang]
  );

  const doctorScript = useMemo(
    () => buildDoctorBriefingScript(lang, telemetry, combinedFindings, carePlanPreview),
    [lang, telemetry, combinedFindings, carePlanPreview]
  );

  const toggleSpeak = (customText?: string) => {
    if (isSpeaking && !customText) {
      stopDoctorSpeech();
      setIsSpeaking(false);
      return;
    }
    speakDoctorText(
      customText || doctorScript,
      lang,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  };

  // Hack2skill 1-Click Judge Demo: triggers overwork screen scenario + 24h banner + Doctor Voice
  const runJudgeDemo = () => {
    applyPreset('overwork_screen');
    setBannerVisible(true);
    setTab('passive');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => {
      toggleSpeak();
    }, 250);
  };

  return (
    <View style={styles.root}>
      {/* Compact Single-Row Sticky Header (<= 56px) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/warkop' as any);
          }}
          style={styles.iconBtn}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={20} color="#F5E6D3" />
        </TouchableOpacity>

        <View style={styles.brandGroup}>
          <Text style={styles.title} numberOfLines={1}>
            ceKKes AI
          </Text>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>24h Active</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => {
              stopDoctorSpeech();
              setIsSpeaking(false);
              setLang((l) => (l === 'id' ? 'en' : 'id'));
            }}
          >
            <Text style={styles.langText}>{lang === 'id' ? 'ID | en' : 'EN | id'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.demoBtn} onPress={runJudgeDemo}>
            <Text style={styles.demoBtnText}>⚡ Demo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setClinicalModalOpen(true)}
            accessibilityLabel="Info Klinis & Batasan"
          >
            <Ionicons name="shield-checkmark-outline" size={19} color="#38BDF8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scrollable Area */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Smart 24h Proactive Notification Banner */}
        <SmartHealthBanner
          visible={bannerVisible}
          lang={lang}
          telemetry={telemetry}
          findings={combinedFindings}
          isSpeaking={isSpeaking}
          onOpenDashboard={() => {
            setTab('passive');
            scrollRef.current?.scrollTo({ y: 90, animated: true });
          }}
          onPlayVoice={() => toggleSpeak()}
          onDismiss={() => setBannerVisible(false)}
        />

        {tab === 'passive' && (
          <PassiveDashboard
            lang={lang}
            telemetry={telemetry}
            imuStatus={imuStatus}
            findings={passiveFindings}
            carePlan={carePlanPreview}
            doctorScript={doctorScript}
            isSpeaking={isSpeaking}
            onToggleSpeak={() => toggleSpeak()}
            onTrigger24hNotification={() => {
              setBannerVisible(true);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
            onApplyPreset={applyPreset}
            onUpdateTelemetry={updateTelemetry}
            onRecordKeystroke={recordKeystrokeSample}
            onRequestImuPermission={requestImuPermission}
            onGoToActiveCheck={() => {
              setTab('active');
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
            onGoToCarePlan={() => {
              setTab('careplan');
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
          />
        )}

        {tab === 'active' && (
          <ActiveScanner
            lang={lang}
            activeFindings={activeFindings}
            onUpsertFinding={upsertActiveFinding}
            onSpeakResult={(msg) => toggleSpeak(msg)}
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
            onGoToCarePlan={() => {
              setTab('careplan');
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
          />
        )}

        {tab === 'careplan' && <CarePlanEngine lang={lang} findings={combinedFindings} />}
      </ScrollView>

      {/* Fixed Thumb-Friendly 3-Tab Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, tab === 'passive' && styles.navItemActive]}
          onPress={() => {
            setTab('passive');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <Ionicons
            name={tab === 'passive' ? 'stats-chart' : 'stats-chart-outline'}
            size={20}
            color={tab === 'passive' ? '#D4AF37' : '#94A3B8'}
          />
          <Text style={[styles.navText, tab === 'passive' && styles.navTextActive]}>
            24h Routine
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, tab === 'active' && styles.navItemActive]}
          onPress={() => {
            setTab('active');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <Ionicons
            name={tab === 'active' ? 'medkit' : 'medkit-outline'}
            size={20}
            color={tab === 'active' ? '#38BDF8' : '#94A3B8'}
          />
          <Text style={[styles.navText, tab === 'active' && { color: '#38BDF8' }]}>
            {lang === 'en' ? 'Deep Check' : 'Cek Detail'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, tab === 'careplan' && styles.navItemActive]}
          onPress={() => {
            setTab('careplan');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <Ionicons
            name={tab === 'careplan' ? 'calendar' : 'calendar-outline'}
            size={20}
            color={tab === 'careplan' ? '#10B981' : '#94A3B8'}
          />
          <Text style={[styles.navText, tab === 'careplan' && { color: '#10B981' }]}>
            {lang === 'en'
              ? `Plan (${combinedFindings.length})`
              : `Resep (${combinedFindings.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal: Info Klinis, Asumsi & Batasan (Hack2skill Compliance) */}
      <Modal
        visible={clinicalModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setClinicalModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                🛡️ {lang === 'en' ? 'Clinical Info & Limitations' : 'Info Klinis, Asumsi & Batasan'}
              </Text>
              <TouchableOpacity onPress={() => setClinicalModalOpen(false)}>
                <Ionicons name="close" size={22} color="#F5E6D3" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
              <Text style={styles.modalHeading}>1. Non-Diagnostic Disclaimer</Text>
              <Text style={styles.modalBody}>
                ceKKes adalah alat skrining kesehatan mandiri & pendukung swamedikasi awal (OTC/Fitofarmaka), bukan pengganti diagnosis dokter atau fasilitas kesehatan. Jika muncul Red Flag (nyeri dada menjalar, sesak napas berat, demam &gt; 3 hari, luka bernanah), segera ke IGD/Dokter.
              </Text>
              <Text style={styles.modalHeading}>2. On-Device Zero-Content Privacy</Text>
              <Text style={styles.modalBody}>
                Seluruh pemrosesan ketikan (dwell/flight time), kamera PPG/warna, audio mikrofon (F0/HNR/bising usus), dan IMU berjalan lokal di perangkat Anda tanpa mengunggah teks chat atau rekaman suara mentah ke server.
              </Text>
              <Text style={styles.modalHeading}>3. Batasan Teknis & Anatomi</Text>
              <Text style={styles.modalBody}>
                • Optik/PPG & Vision dipengaruhi pencahayaan kamera.{'\n'}
                • Ginjal berada di rongga retroperitoneal sehingga tidak terdeteksi getaran perut; skrining ginjal dialihkan ke keluhan kelopak mata bengkak & urin berbusa.{'\n'}
                • Terapi panas 43°C hanya untuk kutil/clavus dengan kompres hangat eksternal (dilarang menempelkan bodi/baterai HP &gt; 44°C atau pada kulit luka/eksim/jamur).
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setClinicalModalOpen(false)}>
              <Text style={styles.modalCloseText}>{lang === 'en' ? 'Understood' : 'Saya Mengerti'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#120D08' },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: '#1E1610',
    borderBottomWidth: 1,
    borderBottomColor: '#3B2C20',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#261C15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  title: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: '900',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langBtn: {
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#4A3728',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  langText: {
    color: '#F5E6D3',
    fontSize: 10.5,
    fontWeight: '800',
  },
  demoBtn: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  demoBtnText: {
    color: '#1A120B',
    fontSize: 11,
    fontWeight: '900',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 12,
    paddingBottom: 88,
    gap: 12,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    height: 62,
    backgroundColor: '#1A120B',
    borderTopWidth: 1,
    borderTopColor: '#3B2C20',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 2,
  },
  navItemActive: {
    backgroundColor: '#261C15',
  },
  navText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  navTextActive: {
    color: '#D4AF37',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#1E1610',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D4AF37',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: '900',
  },
  modalHeading: {
    color: '#38BDF8',
    fontSize: 12.5,
    fontWeight: '800',
  },
  modalBody: {
    color: '#E5D3B3',
    fontSize: 12,
    lineHeight: 18,
  },
  modalCloseBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#1A120B',
    fontSize: 13,
    fontWeight: '800',
  },
});
