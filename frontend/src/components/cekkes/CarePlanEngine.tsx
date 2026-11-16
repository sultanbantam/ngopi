import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DetectedFinding,
  UserHealthProfile,
  generateAutonomousCarePlan,
} from './medicalKnowledgeBase';
import { CekkesLang } from './DoctorVoicePlayer';
import { fetchCekkesServerState, queueCekkesServerSync } from './cekkesSync';

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
    let mounted = true;
    fetchCekkesServerState().then((remote) => {
      if (!mounted || !remote) return;
      if (remote.profile && typeof remote.profile === 'object') {
        setProfile((prev) => ({ ...prev, ...remote.profile }));
      }
      const today = new Date().toISOString().slice(0, 10);
      if (remote.checklist && remote.checklistDate === today) {
        setCheckedSchedule(remote.checklist);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      }
    } catch {
      // ignore
    }
    queueCekkesServerSync({ profile });
  }, [profile]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(getChecklistKey(), JSON.stringify(checkedSchedule));
      }
    } catch {
      // ignore
    }
    queueCekkesServerSync({
      checklist: checkedSchedule,
      checklistDate: new Date().toISOString().slice(0, 10),
    });
  }, [checkedSchedule]);

  const isEn = lang === 'en';
  const plan = useMemo(() => generateAutonomousCarePlan(profile, findings, lang), [profile, findings, lang]);

  const formatSlot = (slot: string) => {
    if (!isEn) return slot;
    if (slot === '07:00 Pagi') return '07:00 AM';
    if (slot === '12:30 Siang') return '12:30 PM';
    if (slot === '16:30 Sore') return '04:30 PM';
    if (slot === '20:30 Malam') return '08:30 PM';
    return slot;
  };

  const formatCategoryCircle = (circle: string) => {
    if (!isEn) return circle;
    return circle.startsWith('Hijau') ? 'Green (OTC)' : 'Blue (Limited OTC)';
  };

  const handlePrintMedicalSummary = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const win = window.open('', '_blank', 'width=760,height=900');
      if (win) {
        const title = isEn ? 'ceKKes AI — Personal Medical & Self-Care Summary' : 'ceKKes AI — Ringkasan Medis & Swamedikasi Mandiri';
        const profLine = isEn
          ? `Age: ${profile.age} yrs | Weight: ${profile.weightKg} kg | Allergies: ${profile.allergies.trim() || 'None'} | Water Target: ${plan.nutrition.waterMinMl}–${plan.nutrition.waterMaxMl} ml/day`
          : `Usia: ${profile.age} thn | BB: ${profile.weightKg} kg | Alergi: ${profile.allergies.trim() || 'Tidak ada'} | Target Air: ${plan.nutrition.waterMinMl}–${plan.nutrition.waterMaxMl} ml/hari`;
        const otcHtml = plan.otcList
          .map(
            (o) =>
              `<li><strong>${o.activeIngredient}</strong> (${formatCategoryCircle(o.categoryCircle)})<br/>${isEn ? 'Indication' : 'Indikasi'}: ${o.condition}<br/>${isEn ? 'Dosage' : 'Dosis'}: ${o.dosage} (${o.frequency}) — ${o.usageRule}</li>`
          )
          .join('');
        const herbHtml = plan.herbalList
          .map(
            (h) =>
              `<li><strong>${h.plantName}</strong><br/>${isEn ? 'Amount' : 'Takaran'}: ${h.dosageAmount}<br/>${isEn ? 'Preparation' : 'Cara Pakai'}: ${h.preparation} (${h.schedule})</li>`
          )
          .join('');
        const schHtml = plan.schedule
          .map((s) => `<li><strong>[${formatSlot(s.timeSlot)}] ${s.action}</strong>: ${s.detail}</li>`)
          .join('');
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#111;line-height:1.5}h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;margin-top:18px;border-bottom:1px solid #ddd;padding-bottom:4px}ul{padding-left:18px}li{margin-bottom:8px}.note{font-size:12px;color:#555;margin-top:20px;border-top:1px solid #eee;padding-top:10px}</style></head><body><h1>${title}</h1><p>${profLine}</p><h2>${isEn ? '1. Over-the-Counter (OTC) Medications' : '1. Obat Bebas (OTC)'}</h2><ul>${otcHtml}</ul><h2>${isEn ? '2. Herbal & Phytopharmaceuticals' : '2. Obat Herbal & Fitofarmaka'}</h2><ul>${herbHtml}</ul><h2>${isEn ? '3. Daily Schedule' : '3. Jadwal Harian'}</h2><ul>${schHtml}</ul><p class="note">${isEn ? 'Non-diagnostic self-care screening summary generated by ceKKes AI (ngopi.top).' : 'Ringkasan skrining kesehatan mandiri non-diagnostik oleh ceKKes AI (ngopi.top).'}</p></body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
        return;
      }
      if (typeof window.print === 'function') {
        window.print();
        return;
      }
    }
    setExportMsg(isEn ? 'Medical summary is ready to save on your device.' : 'Ringkasan medis siap disimpan dari perangkat Anda.');
  };

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
            <Text style={styles.redFlagTitle}>
              {isEn ? 'MEDICAL EMERGENCY WARNING (RED FLAG)' : 'PERINGATAN DARURAT MEDIS (RED FLAG)'}
            </Text>
            <Text style={styles.redFlagText}>
              {isEn
                ? `Emergency symptom(s) detected: ${plan.redFlagReasons.join(', ')}. Stop self-care immediately and visit a Doctor or ER!`
                : `Terdeteksi gejala darurat: ${plan.redFlagReasons.join(', ')}. Segera hentikan swamedikasi dan kunjungi Dokter atau IGD terdekat!`}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Safety Guardrails */}
      {plan.safetyWarnings.length > 0 ? (
        <View style={styles.guardrailBox}>
          <Text style={styles.guardrailTitle}>
            {isEn ? 'Automatic Drug-Herb Interaction Guardrail' : 'Guardrail Interaksi Obat-Herbal Otomatis'}
          </Text>
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
              {isEn ? 'Profile: ' : 'Profil: '}
            </Text>
            {isEn
              ? `${profile.age} yrs • ${profile.weightKg} kg • Allergies: ${profile.allergies.trim() || 'None'} • Water: ${plan.nutrition.waterMinMl.toLocaleString('en-US')} ml/day`
              : `${profile.age} thn • BB ${profile.weightKg} kg • Alergi: ${profile.allergies.trim() || 'Tidak ada'} • Air: ${plan.nutrition.waterMinMl.toLocaleString('id-ID')} ml/hr`}
          </Text>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setProfileOpen((v) => !v)}
          >
            <Text style={styles.toggleBtnText}>
              {profileOpen
                ? isEn
                  ? 'Close'
                  : 'Tutup'
                : isEn
                ? 'Edit Profile & Red Flags'
                : 'Ubah Profil & Red Flags'}
            </Text>
          </TouchableOpacity>
        </View>

        {profileOpen && (
          <View style={{ gap: 10, marginTop: 6 }}>
            <View style={styles.rowInputs}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text style={styles.label}>{isEn ? 'Age (years)' : 'Usia (tahun)'}</Text>
            <TextInput
              keyboardType="numeric"
              value={String(profile.age)}
              onChangeText={(v) => setProfile((p) => ({ ...p, age: Number(v.replace(/[^0-9]/g, '')) || 0 }))}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text style={styles.label}>{isEn ? 'Weight (kg)' : 'Berat Badan (kg)'}</Text>
            <TextInput
              keyboardType="numeric"
              value={String(profile.weightKg)}
              onChangeText={(v) => setProfile((p) => ({ ...p, weightKg: Number(v.replace(/[^0-9]/g, '')) || 0 }))}
              style={styles.input}
            />
          </View>
        </View>
        <Text style={styles.label}>{isEn ? 'Drug / Food Allergies' : 'Riwayat Alergi Obat / Makanan'}</Text>
        <TextInput
          value={profile.allergies}
          onChangeText={(v) => setProfile((p) => ({ ...p, allergies: v }))}
          placeholder={isEn ? 'e.g., clotrimazole, seafood, paracetamol...' : 'Contoh: clotrimazole, seafood, paracetamol...'}
          placeholderTextColor="#8B735B"
          style={styles.input}
        />

        <Text style={styles.label}>{isEn ? 'Special Conditions & Drug Interactions:' : 'Kondisi Khusus & Interaksi Obat:'}</Text>
        <View style={styles.chipWrap}>
          {[
            { key: 'isPregnantOrBreastfeeding', label: isEn ? 'Pregnant / Breastfeeding' : 'Hamil / Menyusui' },
            { key: 'onBloodThinners', label: isEn ? 'On Blood Thinners' : 'Minum Pengencer Darah' },
            { key: 'hasGerd', label: isEn ? 'Acute GERD / Ulcer' : 'GERD / Maag Akut' },
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

        <Text style={styles.label}>{isEn ? 'Red Flag Screening (Emergency):' : 'Skrining Red Flag (Gejala Darurat):'}</Text>
        <View style={styles.chipWrap}>
          {[
            { key: 'redFlagChestPain', label: isEn ? 'Radiating Chest Pain' : 'Nyeri Dada Menjalar' },
            { key: 'redFlagShortnessOfBreath', label: isEn ? 'Severe Breathlessness' : 'Sesak Napas Berat' },
            { key: 'redFlagHighFever3Days', label: isEn ? 'High Fever > 3 Days' : 'Demam Tinggi > 3 Hari' },
            { key: 'redFlagPurulentWound', label: isEn ? 'Spreading Purulent Wound' : 'Luka Bernanah Luas' },
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
        <Text style={styles.sectionTitle}>
          {isEn ? '1. Over-the-Counter (OTC) & Calculated Dosage' : '1. Rekomendasi Obat Bebas (OTC) & Dosis Terkalkulasi'}
        </Text>
        {plan.otcList.map((o) => (
          <View key={o.id} style={styles.itemBox}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{o.activeIngredient}</Text>
              <Text style={o.categoryCircle.startsWith('Hijau') ? styles.badgeGreen : styles.badgeBlue}>
                {formatCategoryCircle(o.categoryCircle)}
              </Text>
            </View>
            <Text style={styles.mutedText}>{isEn ? 'Indication' : 'Indikasi'}: {o.condition}</Text>
            <Text style={styles.bodyText}>• {isEn ? 'Dosage' : 'Dosis'}: {o.dosage} ({o.frequency})</Text>
            <Text style={styles.bodyText}>• {isEn ? 'Max Duration' : 'Durasi Maksimal'}: {o.maxDuration}</Text>
            <Text style={styles.mutedText}>• {isEn ? 'Usage Rule' : 'Aturan Pakai'}: {o.usageRule}</Text>
            {o.blockedReason ? <Text style={styles.dangerNote}>⛔ {o.blockedReason}</Text> : null}
          </View>
        ))}
      </View>

      {/* 2. Obat Herbal & Fitofarmaka */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {isEn ? '2. Herbal & Phytopharmaceuticals' : '2. Obat Herbal & Tanaman Obat (Fitofarmaka Terukur)'}
        </Text>
        {plan.herbalList.map((h) => (
          <View key={h.id} style={styles.itemBox}>
            <Text style={styles.itemTitle}>{h.plantName}</Text>
            <Text style={styles.mutedText}>
              {isEn ? 'Part' : 'Bagian'}: {h.partUsed} | {isEn ? 'Indication' : 'Indikasi'}: {h.condition}
            </Text>
            <Text style={styles.bodyText}>• {isEn ? 'Amount' : 'Takaran'}: {h.dosageAmount}</Text>
            <Text style={styles.bodyText}>• {isEn ? 'Preparation' : 'Cara Penyeduhan/Pakai'}: {h.preparation}</Text>
            <Text style={styles.mutedText}>• {isEn ? 'Schedule' : 'Jadwal'}: {h.schedule}</Text>
            {h.interactionWarning ? <Text style={styles.dangerNote}>⚠ {h.interactionWarning}</Text> : null}
          </View>
        ))}
      </View>

      {/* 3. Nutrisi & Target Air Putih */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {isEn ? '3. Functional Foods & Hydration Target' : '3. Makanan, Minuman Fungsional & Target Hidrasi'}
        </Text>
        <Text style={styles.hydrationText}>
          {isEn
            ? `Daily Water Target: ${plan.nutrition.waterMinMl.toLocaleString('en-US')} – ${plan.nutrition.waterMaxMl.toLocaleString('en-US')} ml/day`
            : `Target Air Putih Harian: ${plan.nutrition.waterMinMl.toLocaleString('id-ID')} – ${plan.nutrition.waterMaxMl.toLocaleString('id-ID')} ml/hari`}
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
        <Text style={styles.sectionTitle}>
          {isEn ? '4. Chronological Daily Care Checklist' : '4. Jadwal Pengingat Otonom Harian (Checklist)'}
        </Text>
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
                  [{formatSlot(s.timeSlot)}] {s.action}
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
              🧠 {isEn ? (reasoningOpen ? 'Hide' : 'View') + ' AI Agent Reasoning Trace' : (reasoningOpen ? 'Tutup' : 'Lihat') + ' Alur Penalaran Agent AI'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.printBtn} onPress={handlePrintMedicalSummary}>
            <Ionicons name="document-text-outline" size={14} color="#1A120B" />
            <Text style={styles.printBtnText}>
              📄 {isEn ? 'Print / Save Medical Summary' : 'Cetak / Simpan Ringkasan Medis'}
            </Text>
          </TouchableOpacity>
        </View>

        {reasoningOpen && (
          <View style={styles.itemBox}>
            <Text style={styles.itemTitle}>
              {isEn ? `Agentic Reasoning Trace (${findings.length} Findings):` : `Agentic Reasoning Trace (${findings.length} Temuan):`}
            </Text>
            {findings.length === 0 ? (
              <Text style={styles.mutedText}>
                {isEn
                  ? `• No active risk findings. Agent maintains preventive hydration (${plan.nutrition.waterMinMl} ml/day) & 08:30 PM sleep protocol.`
                  : `• Tidak ada temuan risiko aktif. Agent mempertahankan protokol preventif hidrasi ${plan.nutrition.waterMinMl} ml/hari & istirahat tidur 20:30.`}
              </Text>
            ) : (
              findings.map((f) => (
                <Text key={f.id} style={styles.mutedText}>
                  • [{f.source.toUpperCase()} / {f.severity.toUpperCase()}] {f.title} → {f.summary}
                </Text>
              ))
            )}
            <Text style={styles.mutedText}>
              {isEn
                ? `• Guardrail: ${plan.safetyWarnings.length} interaction warning(s) checked before composing ${plan.otcList.length} OTC & ${plan.herbalList.length} herbal items.`
                : `• Guardrail: ${plan.safetyWarnings.length} peringatan interaksi diperiksa sebelum menyusun ${plan.otcList.length} OTC & ${plan.herbalList.length} herbal.`}
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
