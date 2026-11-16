import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DetectedFinding,
  UserHealthProfile,
  generateAutonomousCarePlan,
} from './medicalKnowledgeBase';
import { CekkesLang } from './DoctorVoicePlayer';

const PROFILE_KEY = 'ngopi_cekkes_profile';
const getChecklistKey = () => `ngopi_cekkes_checklist_${new Date().toISOString().slice(0, 10)}`;

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

interface CarePlanEngineProps {
  lang?: CekkesLang;
  findings: DetectedFinding[];
}

export default function CarePlanEngine({ lang = 'id', findings }: CarePlanEngineProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserHealthProfile>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(PROFILE_KEY);
        if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROFILE;
  });

  const [checkedSchedule, setCheckedSchedule] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(getChecklistKey());
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      }
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(getChecklistKey(), JSON.stringify(checkedSchedule));
      }
    } catch {
      // ignore
    }
  }, [checkedSchedule]);

  const plan = useMemo(() => generateAutonomousCarePlan(profile, findings), [profile, findings]);

  const toggleFlag = (key: keyof UserHealthProfile) => {
    setProfile((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSchedule = (id: string) => {
    setCheckedSchedule((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Red Flag Emergency Banner */}
      {plan.hasRedFlag ? (
        <View style={styles.redFlagBanner}>
          <Ionicons name="warning" size={22} color="#FFE4E6" />
          <View style={{ flex: 1 }}>
            <Text style={styles.redFlagTitle}>PERINGATAN DARURAT MEDIS (RED FLAG)</Text>
            <Text style={styles.redFlagText}>
              Terdeteksi gejala darurat: {plan.redFlagReasons.join(', ')}. Segera hentikan swamedikasi dan kunjungi Dokter atau IGD terdekat!
            </Text>
          </View>
        </View>
      ) : null}

      {/* Safety Guardrails */}
      {plan.safetyWarnings.length > 0 ? (
        <View style={styles.guardrailBox}>
          <Text style={styles.guardrailTitle}>Guardrail Interaksi Obat-Herbal Otomatis</Text>
          {plan.safetyWarnings.map((w, i) => (
            <Text key={i} style={styles.guardrailText}>• {w}</Text>
          ))}
        </View>
      ) : null}

      {/* Compact Collapsible Profile Pill Bar */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.bodyText} numberOfLines={2}>
            <Text style={{ color: '#D4AF37', fontWeight: '800' }}>
              {lang === 'en' ? 'Profile: ' : 'Profil: '}
            </Text>
            {profile.age} thn • BB {profile.weightKg} kg • Alergi:{' '}
            {profile.allergies.trim() || 'Tidak ada'} • Air:{' '}
            {plan.nutrition.waterMinMl.toLocaleString('id-ID')} ml/hr
          </Text>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setProfileOpen((v) => !v)}
          >
            <Text style={styles.toggleBtnText}>
              {profileOpen
                ? lang === 'en'
                  ? 'Close'
                  : 'Tutup'
                : lang === 'en'
                ? 'Edit Profile & Red Flags'
                : 'Ubah Profil & Red Flags'}
            </Text>
          </TouchableOpacity>
        </View>

        {profileOpen && (
          <View style={{ gap: 10, marginTop: 6 }}>
            <View style={styles.rowInputs}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text style={styles.label}>Usia (tahun)</Text>
            <TextInput
              keyboardType="numeric"
              value={String(profile.age)}
              onChangeText={(v) => setProfile((p) => ({ ...p, age: Number(v.replace(/[^0-9]/g, '')) || 0 }))}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text style={styles.label}>Berat Badan (kg)</Text>
            <TextInput
              keyboardType="numeric"
              value={String(profile.weightKg)}
              onChangeText={(v) => setProfile((p) => ({ ...p, weightKg: Number(v.replace(/[^0-9]/g, '')) || 0 }))}
              style={styles.input}
            />
          </View>
        </View>
        <Text style={styles.label}>Riwayat Alergi Obat / Makanan</Text>
        <TextInput
          value={profile.allergies}
          onChangeText={(v) => setProfile((p) => ({ ...p, allergies: v }))}
          placeholder="Contoh: clotrimazole, seafood, paracetamol..."
          placeholderTextColor="#8B735B"
          style={styles.input}
        />

        <Text style={styles.label}>Kondisi Khusus & Interaksi Obat:</Text>
        <View style={styles.chipWrap}>
          {[
            { key: 'isPregnantOrBreastfeeding', label: 'Hamil / Menyusui' },
            { key: 'onBloodThinners', label: 'Minum Pengencer Darah' },
            { key: 'hasGerd', label: 'GERD / Maag Akut' },
          ].map((item) => {
            const active = Boolean(profile[item.key as keyof UserHealthProfile]);
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleFlag(item.key as keyof UserHealthProfile)}
              >
                <Text style={[styles.chipText, active && { color: '#1A120B' }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Skrining Red Flag (Gejala Darurat):</Text>
        <View style={styles.chipWrap}>
          {[
            { key: 'redFlagChestPain', label: 'Nyeri Dada Menjalar' },
            { key: 'redFlagShortnessOfBreath', label: 'Sesak Napas Berat' },
            { key: 'redFlagHighFever3Days', label: 'Demam Tinggi > 3 Hari' },
            { key: 'redFlagPurulentWound', label: 'Luka Bernanah Luas' },
          ].map((item) => {
            const active = Boolean(profile[item.key as keyof UserHealthProfile]);
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.chip, active && styles.chipDanger]}
                onPress={() => toggleFlag(item.key as keyof UserHealthProfile)}
              >
                <Text style={styles.chipText}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
            </View>
          </View>
        )}
      </View>

      {/* 1. Rekomendasi Obat Bebas (OTC) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Rekomendasi Obat Bebas (OTC) & Dosis Terkalkulasi</Text>
        {plan.otcList.map((o) => (
          <View key={o.id} style={styles.itemBox}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{o.activeIngredient}</Text>
              <Text style={o.categoryCircle.startsWith('Hijau') ? styles.badgeGreen : styles.badgeBlue}>
                {o.categoryCircle}
              </Text>
            </View>
            <Text style={styles.mutedText}>Indikasi: {o.condition}</Text>
            <Text style={styles.bodyText}>• Dosis: {o.dosage} ({o.frequency})</Text>
            <Text style={styles.bodyText}>• Durasi Maksimal: {o.maxDuration}</Text>
            <Text style={styles.mutedText}>• Aturan Pakai: {o.usageRule}</Text>
            {o.blockedReason ? <Text style={styles.dangerNote}>⛔ {o.blockedReason}</Text> : null}
          </View>
        ))}
      </View>

      {/* 2. Obat Herbal & Fitofarmaka */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Obat Herbal & Tanaman Obat (Fitofarmaka Terukur)</Text>
        {plan.herbalList.map((h) => (
          <View key={h.id} style={styles.itemBox}>
            <Text style={styles.itemTitle}>{h.plantName}</Text>
            <Text style={styles.mutedText}>Bagian: {h.partUsed} | Indikasi: {h.condition}</Text>
            <Text style={styles.bodyText}>• Takaran: {h.dosageAmount}</Text>
            <Text style={styles.bodyText}>• Cara Penyeduhan/Pakai: {h.preparation}</Text>
            <Text style={styles.mutedText}>• Jadwal: {h.schedule}</Text>
            {h.interactionWarning ? <Text style={styles.dangerNote}>⚠ {h.interactionWarning}</Text> : null}
          </View>
        ))}
      </View>

      {/* 3. Nutrisi & Target Air Putih */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3. Makanan, Minuman Fungsional & Target Hidrasi</Text>
        <Text style={styles.hydrationText}>
          Target Air Putih Harian: {plan.nutrition.waterMinMl.toLocaleString('id-ID')} – {plan.nutrition.waterMaxMl.toLocaleString('id-ID')} ml/hari
        </Text>
        {plan.nutrition.recommendedFoods.map((f, i) => (
          <Text key={i} style={styles.bodyText}>✅ {f}</Text>
        ))}
        {plan.nutrition.avoidFoods.map((f, i) => (
          <Text key={i} style={styles.mutedText}>⛔ {f}</Text>
        ))}
      </View>

      {/* 4. Autonomous Daily Scheduler */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Jadwal Pengingat Otonom Harian (Checklist)</Text>
        {plan.schedule.map((s) => {
          const done = Boolean(checkedSchedule[s.id]);
          return (
            <TouchableOpacity key={s.id} style={styles.scheduleRow} onPress={() => toggleSchedule(s.id)}>
              <Ionicons
                name={done ? 'checkbox' : 'square-outline'}
                size={20}
                color={done ? '#10B981' : '#D4AF37'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, done && { textDecorationLine: 'line-through', color: '#10B981' }]}>
                  [{s.timeSlot}] {s.action}
                </Text>
                <Text style={styles.mutedText}>{s.detail}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* 5. Collapsible AI Reasoning Trace & Print/Save Medical Summary */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setReasoningOpen((v) => !v)}
          >
            <Text style={styles.toggleBtnText}>
              🧠 {reasoningOpen ? 'Tutup' : 'Lihat'} Alur Penalaran Agent AI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.printBtn}
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function') {
                window.print();
              } else {
                setExportMsg('Ringkasan medis siap disimpan dari perangkat Anda.');
              }
            }}
          >
            <Ionicons name="document-text-outline" size={14} color="#1A120B" />
            <Text style={styles.printBtnText}>📄 Cetak / Simpan Ringkasan Medis</Text>
          </TouchableOpacity>
        </View>

        {reasoningOpen && (
          <View style={styles.itemBox}>
            <Text style={styles.itemTitle}>Agentic Reasoning Trace ({findings.length} Temuan):</Text>
            {findings.length === 0 ? (
              <Text style={styles.mutedText}>
                • Tidak ada temuan risiko aktif. Agent mempertahankan protokol preventif hidrasi {plan.nutrition.waterMinMl} ml/hari & istirahat tidur 20:30.
              </Text>
            ) : (
              findings.map((f) => (
                <Text key={f.id} style={styles.mutedText}>
                  • [{f.source.toUpperCase()} / {f.severity.toUpperCase()}] {f.title} → {f.summary}
                </Text>
              ))
            )}
            <Text style={styles.mutedText}>
              • Guardrail: {plan.safetyWarnings.length} peringatan interaksi diperiksa sebelum menyusun {plan.otcList.length} OTC & {plan.herbalList.length} herbal.
            </Text>
          </View>
        )}
        {exportMsg ? <Text style={styles.mutedText}>{exportMsg}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#261C15', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4A3728', gap: 10 },
  sectionTitle: { color: '#D4AF37', fontSize: 15, fontWeight: '800' },
  label: { color: '#D6C7B8', fontSize: 12, fontWeight: '700' },
  rowInputs: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  input: { backgroundColor: '#1A120B', color: '#F5E6D3', borderRadius: 10, borderWidth: 1, borderColor: '#4A3728', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1A120B', borderWidth: 1, borderColor: '#4A3728' },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#F59E0B' },
  chipDanger: { backgroundColor: 'rgba(244,63,94,0.25)', borderColor: '#F43F5E' },
  chipText: { color: '#F5E6D3', fontSize: 11, fontWeight: '700' },
  redFlagBanner: { flexDirection: 'row', gap: 10, backgroundColor: '#9F1239', borderColor: '#F43F5E', borderWidth: 1.5, borderRadius: 12, padding: 14 },
  redFlagTitle: { color: '#FFE4E6', fontSize: 14, fontWeight: '900' },
  redFlagText: { color: '#FFF1F2', fontSize: 12, lineHeight: 18, marginTop: 2 },
  guardrailBox: { backgroundColor: 'rgba(245,158,11,0.14)', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  guardrailTitle: { color: '#FBBF24', fontSize: 13, fontWeight: '800' },
  guardrailText: { color: '#FEF3C7', fontSize: 12, lineHeight: 17 },
  itemBox: { backgroundColor: '#1A120B', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#3B2B1E', gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  itemTitle: { color: '#F5E6D3', fontSize: 13, fontWeight: '800', flex: 1 },
  badgeGreen: { color: '#10B981', fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeBlue: { color: '#38BDF8', fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(14,165,233,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  bodyText: { color: '#F5E6D3', fontSize: 12, lineHeight: 18 },
  mutedText: { color: '#BFA995', fontSize: 11, lineHeight: 16 },
  dangerNote: { color: '#FDA4AF', fontSize: 11, fontWeight: '800', marginTop: 2 },
  hydrationText: { color: '#38BDF8', fontSize: 14, fontWeight: '800' },
  scheduleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#1A120B', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#3B2B1E' },
  toggleBtn: { backgroundColor: '#1A120B', borderWidth: 1, borderColor: '#D4AF37', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  toggleBtnText: { color: '#D4AF37', fontSize: 11, fontWeight: '800' },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D4AF37', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  printBtnText: { color: '#1A120B', fontSize: 11, fontWeight: '800' },
});
