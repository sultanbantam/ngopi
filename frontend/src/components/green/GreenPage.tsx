import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../../utils/i18n';
import * as SecureStore from '../../utils/storage';
import {
  fetchAdminGreenQueue,
  fetchGreenCatalog,
  fetchGreenDashboard,
  fetchGreenReports,
  fetchGreenSubmissions,
  joinGreenChallenge,
  monitorGreenPlant,
  submitGreenActivity,
  uploadPrivateEvidenceFile,
  verifyAdminGreenSubmission,
} from './greenApi';

export type GreenTab = 'dashboard' | 'submit' | 'history' | 'map_edu' | 'admin';

const BOTTLE_SIZES_ML = [220, 240, 330, 350, 500, 600, 750, 1000, 1500, 2000, 5000, 10000, 19000];
const PLASTIC_MATERIALS = ['PET', 'HDPE', 'LDPE', 'PP', 'PS', 'PVC', 'Multilayer/Sachet'];
const REPORT_SUBCATEGORIES = [
  { code: 'trees_vegetation', id: 'Pohon & Ruang Hijau', en: 'Trees & Vegetation' },
  { code: 'water_flooding', id: 'Air, Banjir & Drainase', en: 'Water, Flooding & Drains' },
  { code: 'infrastructure', id: 'Infrastruktur Publik', en: 'Public Infrastructure' },
  { code: 'waste_pollution', id: 'Sampah Liar & Polusi', en: 'Illegal Dumping & Pollution' },
  { code: 'fire_land', id: 'Kebakaran & Lahan', en: 'Fire & Land' },
  { code: 'transport_space', id: 'Transportasi & Ruang Publik', en: 'Transport & Public Space' },
  { code: 'biodiversity_coastal', id: 'Biodiversitas & Pesisir', en: 'Biodiversity & Coastal' },
];

export default function GreenPage({ initialTab = 'dashboard' }: { initialTab?: GreenTab }) {
  const router = useRouter();
  const { lang, toggleLang, t } = useLanguage();
  const isEn = lang === 'en';

  const [tab, setTab] = useState<GreenTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('user');

  // Server Data
  const [catalog, setCatalog] = useState<any>({
    categories: [],
    activityTypes: [],
    emissionFactors: [],
    rewardRules: [],
    challenges: [],
  });
  const [dashboard, setDashboard] = useState<any>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [adminQueue, setAdminQueue] = useState<any[]>([]);

  // Filters
  const [historyCat, setHistoryCat] = useState('all');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [adminStatusFilter, setAdminStatusFilter] = useState('pending');
  const [adminReason, setAdminReason] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Submission Form State
  const [selectedCat, setSelectedCat] = useState('mobility');
  const [selectedTypeCode, setSelectedTypeCode] = useState('mobility_walk_cycle');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationConsent, setLocationConsent] = useState(false);
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);

  // Conditional Category Metadata
  const [replacedPrivateTrip, setReplacedPrivateTrip] = useState(false);
  const [bottleCapacityMl, setBottleCapacityMl] = useState<number>(600);
  const [materialType, setMaterialType] = useState('PET');
  const [plantCommonName, setPlantCommonName] = useState('');
  const [plantScientificName, setPlantScientificName] = useState('');
  const [ecosystemType, setEcosystemType] = useState('urban');
  const [reportCategory, setReportCategory] = useState('waste_pollution');
  const [reportSeverity, setReportSeverity] = useState('medium');
  const [isAnonymousReport, setIsAnonymousReport] = useState(false);

  // Evidence Upload State
  const [uploadedEvidences, setUploadedEvidences] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const role = (await SecureStore.getItemAsync('role')) || 'user';
      setUserRole(role.toLowerCase());

      const [catRes, dashRes] = await Promise.all([
        fetchGreenCatalog(),
        fetchGreenDashboard(),
      ]);
      setCatalog(catRes);
      setDashboard(dashRes);
    } catch (err: any) {
      setErrorMsg(
        err?.message?.includes('401') || err?.message?.includes('Unauthorized')
          ? t(
              'Silakan login ke akun Ngopi Anda untuk menggunakan NGOPI GREEN.',
              'Please sign in to your Ngopi account to use NGOPI GREEN.'
            )
          : err?.message || t('Gagal memuat data NGOPI GREEN.', 'Failed to load NGOPI GREEN data.')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'history') {
      fetchGreenSubmissions(historyCat, historyStatus)
        .then(setHistoryItems)
        .catch((e) => setErrorMsg(e.message));
    } else if (tab === 'map_edu') {
      fetchGreenReports('all', 'all')
        .then(setReports)
        .catch(() => {});
    } else if (tab === 'admin') {
      fetchAdminGreenQueue(adminStatusFilter)
        .then(setAdminQueue)
        .catch((e) => setErrorMsg(e.message));
    }
  }, [tab, historyCat, historyStatus, adminStatusFilter]);

  const typesForCategory = useMemo(
    () => (catalog.activityTypes || []).filter((a: any) => a.category_code === selectedCat),
    [catalog.activityTypes, selectedCat]
  );

  const activeType = useMemo(
    () => (catalog.activityTypes || []).find((a: any) => a.code === selectedTypeCode),
    [catalog.activityTypes, selectedTypeCode]
  );

  const handleSelectCategory = (catCode: string) => {
    setSelectedCat(catCode);
    const first = (catalog.activityTypes || []).find((a: any) => a.category_code === catCode);
    if (first) setSelectedTypeCode(first.code);
  };

  const handlePickEvidence = async () => {
    setErrorMsg(null);
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setUploading(true);
      const uploaded = await uploadPrivateEvidenceFile({
        uri: asset.uri,
        name: asset.fileName || 'evidence.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      setUploadedEvidences((prev) => [...prev, uploaded]);
    } catch (err: any) {
      setErrorMsg(err?.message || t('Gagal mengunggah bukti.', 'Evidence upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const handleWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploading(true);
    try {
      const uploaded = await uploadPrivateEvidenceFile(file);
      setUploadedEvidences((prev) => [...prev, uploaded]);
    } catch (err: any) {
      setErrorMsg(err?.message || t('Gagal mengunggah bukti.', 'Evidence upload failed.'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRequestGps = () => {
    if (Platform.OS !== 'web' || !navigator.geolocation) {
      setErrorMsg(t('GPS browser tidak tersedia.', 'Browser GPS is unavailable.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setLocationConsent(true);
      },
      () => {
        setErrorMsg(t('Izin lokasi ditolak.', 'Location permission denied.'));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmitActivity = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!accuracyConfirmed) {
      setErrorMsg(
        t(
          'Centang pernyataan kejujuran data sebelum mengirim.',
          'Please confirm the data accuracy declaration before submitting.'
        )
      );
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg(t('Masukkan jumlah/kuantitas yang valid (> 0).', 'Enter a valid positive quantity (> 0).'));
      return;
    }
    if (activeType?.requires_evidence && uploadedEvidences.length === 0) {
      setErrorMsg(
        t(
          'Bukti foto/dokumen wajib diunggah untuk kategori aktivitas ini.',
          'Supporting evidence upload is required for this activity type.'
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      const metadata: Record<string, any> = {};
      if (selectedCat === 'mobility') metadata.replaced_private_trip = replacedPrivateTrip;
      if (selectedTypeCode === 'waste_ecobrick') {
        metadata.bottle_capacity_ml = bottleCapacityMl;
        metadata.material_type = materialType;
      }
      if (selectedCat === 'planting') {
        metadata.common_name = plantCommonName || title;
        metadata.scientific_name = plantScientificName;
        metadata.ecosystem_type = ecosystemType;
      }
      if (selectedCat === 'eco_report') {
        metadata.report_category = reportCategory;
        metadata.severity = reportSeverity;
        metadata.is_anonymous = isAnonymousReport;
      }

      const created = await submitGreenActivity({
        activityTypeCode: selectedTypeCode,
        title: title.trim() || (isEn ? activeType?.name_en : activeType?.name_id) || 'Green Action',
        description: description.trim() || undefined,
        quantity: qty,
        locationName: locationName.trim() || undefined,
        latitude,
        longitude,
        locationConsent,
        metadata,
        evidences: uploadedEvidences,
      });

      setSuccessMsg(
        t(
          `Aktivitas tersimpan (ID: ${created.id.slice(0, 8)} • Status: MENUNGGU VERIFIKASI). Poin akan masuk setelah diverifikasi admin.`,
          `Activity saved (ID: ${created.id.slice(0, 8)} • Status: PENDING). Points are credited after server-side admin verification.`
        )
      );
      setTitle('');
      setDescription('');
      setQuantity('');
      setUploadedEvidences([]);
      setAccuracyConfirmed(false);
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err?.message || t('Gagal mengirim aktivitas.', 'Failed to submit activity.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminVerify = async (
    submissionId: string,
    decision: 'verified' | 'rejected' | 'needs_info' | 'reversed'
  ) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!adminReason || adminReason.trim().length < 3) {
      setErrorMsg(t('Alasan verifikasi wajib diisi (min 3 karakter).', 'Verification reason is required (min 3 chars).'));
      return;
    }
    setVerifyingId(submissionId);
    try {
      const res = await verifyAdminGreenSubmission(submissionId, decision, adminReason.trim());
      setSuccessMsg(
        t(
          `Keputusan '${decision}' tersimpan. Poin diberikan: +${res.awardedPoints ?? 0}.`,
          `Decision '${decision}' saved. Points awarded: +${res.awardedPoints ?? 0}.`
        )
      );
      setAdminReason('');
      const [queue, dash] = await Promise.all([
        fetchAdminGreenQueue(adminStatusFilter),
        fetchGreenDashboard(),
      ]);
      setAdminQueue(queue);
      setDashboard(dash);
    } catch (err: any) {
      setErrorMsg(err?.message || t('Verifikasi gagal.', 'Verification failed.'));
    } finally {
      setVerifyingId(null);
    }
  };

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  return (
    <View style={styles.root}>
      {/* Compact Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(main)/warkop' as any))}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#F5E6D3" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="leaf" size={16} color="#10B981" />
            <Text style={styles.headerTitle}>NGOPI GREEN</Text>
          </View>
          <Text style={styles.headerSub} numberOfLines={1}>
            {t('Aksi Nyata, Dampak Terukur & Poin Ngopi', 'Verified Eco Actions & Ngopi Points')}
          </Text>
        </View>
        <TouchableOpacity onPress={toggleLang} style={styles.langBtn}>
          <Text style={styles.langBtnText}>{isEn ? 'EN | id' : 'ID | en'}</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scroll */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
        {successMsg && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#6EE7B7" />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        {loading && !dashboard ? (
          <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.mutedText}>{t('Memuat NGOPI GREEN...', 'Loading NGOPI GREEN...')}</Text>
          </View>
        ) : null}

        {/* TAB 1: DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <View style={{ gap: 12 }}>
            {/* Canonical Ngopi Points + Eco Level */}
            <View style={styles.heroCard}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.mutedText}>{t('Saldo Poin Ngopi (Kanoni)', 'Canonical Ngopi Points')}</Text>
                  <Text style={styles.pointsBig}>☕ {Number(dashboard.pointsBalance || 0).toLocaleString()} {t('Poin', 'Pts')}</Text>
                  <Text style={styles.ecoLevelText}>
                    {dashboard.ecoLevel} • +{dashboard.greenPointsEarned} {t('Poin Hijau Terverifikasi', 'Verified Green Pts')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.primaryGreenBtn} onPress={() => setTab('submit')}>
                  <Ionicons name="add-circle" size={16} color="#052E16" />
                  <Text style={styles.primaryGreenText}>{t('Catat Aksi', 'Log Action')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.countsRow}>
                <View style={styles.countChip}>
                  <Text style={styles.countVal}>{dashboard.counts?.pending ?? 0}</Text>
                  <Text style={styles.countLbl}>{t('Menunggu', 'Pending')}</Text>
                </View>
                <View style={styles.countChip}>
                  <Text style={[styles.countVal, { color: '#10B981' }]}>{dashboard.counts?.verified ?? 0}</Text>
                  <Text style={styles.countLbl}>{t('Terverifikasi', 'Verified')}</Text>
                </View>
                <View style={styles.countChip}>
                  <Text style={[styles.countVal, { color: '#FB7185' }]}>{dashboard.counts?.rejected ?? 0}</Text>
                  <Text style={styles.countLbl}>{t('Ditolak', 'Rejected')}</Text>
                </View>
              </View>
            </View>

            {/* Verified Environmental Impact (Zero Fabricated Numbers) */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {t('Dampak Terverifikasi Anda', 'Your Verified Impact')}
              </Text>
              <View style={styles.impactGrid}>
                <View style={styles.impactCell}>
                  <Text style={styles.impactVal}>{dashboard.impact?.avoided_emissions_kgco2e ?? 0} kg</Text>
                  <Text style={styles.impactLbl}>{t('CO2e Dihindari (Est.)', 'CO2e Avoided (Est.)')}</Text>
                </View>
                <View style={styles.impactCell}>
                  <Text style={styles.impactVal}>{dashboard.impact?.waste_prevented_kg ?? 0} kg</Text>
                  <Text style={styles.impactLbl}>{t('Sampah Dikelola', 'Waste Managed')}</Text>
                </View>
                <View style={styles.impactCell}>
                  <Text style={styles.impactVal}>{dashboard.impact?.plants_count ?? 0}</Text>
                  <Text style={styles.impactLbl}>{t('Tanaman Tercatat', 'Plants Logged')}</Text>
                </View>
                <View style={styles.impactCell}>
                  <Text style={styles.impactVal}>
                    {dashboard.impact?.energy_saved_kwh ?? 0} kWh / {dashboard.impact?.water_saved_liters ?? 0} L
                  </Text>
                  <Text style={styles.impactLbl}>{t('Energi & Air Hemat', 'Energy & Water Saved')}</Text>
                </View>
              </View>
              <Text style={styles.footnote}>
                {t(
                  'Hanya menghitung aktivitas berstatus Terverifikasi dengan faktor emisi resmi. Tidak mengklaim kredit karbon instan.',
                  'Counts only Verified records with disclosed factors. No instant carbon-offset claims.'
                )}
              </Text>
            </View>

            {/* 7 Quick Action Categories */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('7 Kategori Aksi Lingkungan', '7 Environmental Categories')}</Text>
              <View style={styles.catGrid}>
                {(catalog.categories || []).map((c: any) => (
                  <TouchableOpacity
                    key={c.code}
                    style={styles.catCard}
                    onPress={() => {
                      handleSelectCategory(c.code);
                      setTab('submit');
                    }}
                  >
                    <Ionicons name={(c.icon || 'leaf-outline') as any} size={20} color="#10B981" />
                    <Text style={styles.catName}>{isEn ? c.name_en : c.name_id}</Text>
                    <Text style={styles.catDesc} numberOfLines={2}>
                      {isEn ? c.description_en : c.description_id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Active Challenges */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('Tantangan Aktif', 'Active Challenges')}</Text>
              {(dashboard.challenges || []).map((ch: any) => {
                const joined = (dashboard.joinedChallengeIds || []).includes(ch.id);
                return (
                  <View key={ch.id} style={styles.itemBox}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.itemTitle}>{isEn ? ch.title_en : ch.title_id}</Text>
                      <TouchableOpacity
                        style={[styles.smallBtn, joined && { backgroundColor: '#10B981' }]}
                        disabled={joined}
                        onPress={async () => {
                          await joinGreenChallenge(ch.id, false);
                          loadAll();
                        }}
                      >
                        <Text style={[styles.smallBtnText, joined && { color: '#052E16' }]}>
                          {joined ? t('Bergabung ✓', 'Joined ✓') : t('Ikuti', 'Join')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.mutedText}>{isEn ? ch.description_en : ch.description_id}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* TAB 2: SUBMIT ACTIVITY (ALL 7 CATEGORIES) */}
        {tab === 'submit' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('Kirim Aktivitas Lingkungan', 'Submit Environmental Activity')}</Text>

            <Text style={styles.label}>{t('1. Pilih Kategori', '1. Select Category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(catalog.categories || []).map((c: any) => {
                const active = selectedCat === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => handleSelectCategory(c.code)}
                  >
                    <Text style={[styles.chipText, active && { color: '#052E16' }]}>
                      {isEn ? c.name_en : c.name_id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>{t('2. Pilih Jenis Aktivitas', '2. Select Activity Type')}</Text>
            <View style={{ gap: 6 }}>
              {typesForCategory.map((a: any) => {
                const active = selectedTypeCode === a.code;
                return (
                  <TouchableOpacity
                    key={a.code}
                    style={[styles.typeRow, active && styles.typeRowActive]}
                    onPress={() => setSelectedTypeCode(a.code)}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={active ? '#10B981' : '#8B735B'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{isEn ? a.name_en : a.name_id}</Text>
                      <Text style={styles.mutedText}>
                        {t('Satuan', 'Unit')}: {a.unit} •{' '}
                        {a.requires_evidence
                          ? t('Wajib Bukti', 'Evidence Required')
                          : t('Bukti Opsional', 'Evidence Optional')}
                        {!a.is_green_eligible
                          ? ` • ${t('Catat Emisi (0 Poin Hijau)', 'Log Emissions Only (0 Green Pts)')}`
                          : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('Judul Singkat', 'Short Title')}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={isEn ? 'e.g. Commuter rail trip to office' : 'Contoh: Naik KRL ke kantor'}
              placeholderTextColor="#8B735B"
              style={styles.input}
            />

            <Text style={styles.label}>
              {t('Jumlah / Kuantitas', 'Quantity')} ({activeType?.unit || 'unit'})
            </Text>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder={isEn ? 'Enter measured number...' : 'Masukkan angka terukur...'}
              placeholderTextColor="#8B735B"
              style={styles.input}
            />

            {/* Conditional Fields by Category */}
            {selectedCat === 'mobility' && (
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setReplacedPrivateTrip((v) => !v)}
              >
                <Ionicons
                  name={replacedPrivateTrip ? 'checkbox' : 'square-outline'}
                  size={20}
                  color="#10B981"
                />
                <Text style={styles.bodyText}>
                  {t(
                    'Perjalanan ini menggantikan kendaraan bermotor pribadi (untuk estimasi emisi terhindari).',
                    'This trip replaced a private motorized vehicle (used for avoided-emission baseline).'
                  )}
                </Text>
              </TouchableOpacity>
            )}

            {selectedTypeCode === 'waste_ecobrick' && (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>{t('Kapasitas Botol (ml)', 'Bottle Capacity (ml)')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {BOTTLE_SIZES_ML.map((sz) => (
                    <TouchableOpacity
                      key={sz}
                      style={[styles.chip, bottleCapacityMl === sz && styles.chipActive]}
                      onPress={() => setBottleCapacityMl(sz)}
                    >
                      <Text style={[styles.chipText, bottleCapacityMl === sz && { color: '#052E16' }]}>
                        {sz >= 1000 ? `${sz / 1000} L` : `${sz} ml`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.label}>{t('Jenis Plastik Bersih (Kering)', 'Clean Dry Plastic Type')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {PLASTIC_MATERIALS.map((mat) => (
                    <TouchableOpacity
                      key={mat}
                      style={[styles.chip, materialType === mat && styles.chipActive]}
                      onPress={() => setMaterialType(mat)}
                    >
                      <Text style={[styles.chipText, materialType === mat && { color: '#052E16' }]}>
                        {mat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {selectedCat === 'planting' && (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>{t('Nama Tanaman / Pohon', 'Plant / Tree Common Name')}</Text>
                <TextInput
                  value={plantCommonName}
                  onChangeText={setPlantCommonName}
                  placeholder={isEn ? 'e.g. Mangrove / Bamboo / Mango' : 'Contoh: Bambu / Mangga / Trembesi'}
                  placeholderTextColor="#8B735B"
                  style={styles.input}
                />
                <Text style={styles.label}>{t('Nama Ilmiah (Opsional)', 'Scientific Name (Optional)')}</Text>
                <TextInput
                  value={plantScientificName}
                  onChangeText={setPlantScientificName}
                  placeholder="e.g. Mangifera indica"
                  placeholderTextColor="#8B735B"
                  style={styles.input}
                />
                <Text style={styles.mutedText}>
                  {t(
                    'Peringatan: Gunakan spesies lokal yang sesuai ekosistem dan pastikan izin pemilik lahan.',
                    'Warning: Use locally appropriate native species and obtain landowner/authority permission.'
                  )}
                </Text>
              </View>
            )}

            {selectedCat === 'eco_report' && (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>{t('Subkategori Laporan', 'Report Subcategory')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {REPORT_SUBCATEGORIES.map((rc) => (
                    <TouchableOpacity
                      key={rc.code}
                      style={[styles.chip, reportCategory === rc.code && styles.chipActive]}
                      onPress={() => setReportCategory(rc.code)}
                    >
                      <Text style={[styles.chipText, reportCategory === rc.code && { color: '#052E16' }]}>
                        {isEn ? rc.en : rc.id}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['low', 'medium', 'high'] as const).map((sev) => (
                    <TouchableOpacity
                      key={sev}
                      style={[styles.chip, reportSeverity === sev && styles.chipActive]}
                      onPress={() => setReportSeverity(sev)}
                    >
                      <Text style={[styles.chipText, reportSeverity === sev && { color: '#052E16' }]}>
                        {sev.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.chip, isAnonymousReport && styles.chipActive]}
                    onPress={() => setIsAnonymousReport((v) => !v)}
                  >
                    <Text style={[styles.chipText, isAnonymousReport && { color: '#052E16' }]}>
                      {t('Anonim', 'Anonymous')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.label}>{t('Lokasi & Izin GPS (Opsional)', 'Location & GPS Consent (Optional)')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder={isEn ? 'Area / City name' : 'Nama wilayah / kota'}
                placeholderTextColor="#8B735B"
                style={[styles.input, { flex: 1 }]}
              />
              <TouchableOpacity style={styles.smallBtn} onPress={handleRequestGps}>
                <Text style={styles.smallBtnText}>
                  {latitude != null ? `GPS ✓` : t('Ambil GPS', 'Get GPS')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('Catatan Tambahan', 'Notes')}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder={isEn ? 'Describe method, source, or details...' : 'Jelaskan detail aktivitas...'}
              placeholderTextColor="#8B735B"
              style={[styles.input, { minHeight: 68 }]}
            />

            {/* Real Private Evidence Upload */}
            <Text style={styles.label}>{t('Unggah Bukti Foto/Dokumen (Privat)', 'Upload Evidence (Private Storage)')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <TouchableOpacity style={styles.uploadBtn} onPress={handlePickEvidence} disabled={uploading}>
                <Ionicons name="cloud-upload-outline" size={16} color="#0F172A" />
                <Text style={styles.uploadBtnText}>
                  {uploading
                    ? t('Mengunggah...', 'Uploading...')
                    : t('Pilih & Unggah Bukti', 'Select & Upload Evidence')}
                </Text>
              </TouchableOpacity>
              {Platform.OS === 'web' &&
                React.createElement('input', {
                  ref: fileInputRef,
                  type: 'file',
                  accept: 'image/*,application/pdf',
                  onChange: handleWebFileChange,
                  style: { display: 'none' },
                })}
            </View>
            {uploadedEvidences.map((ev, i) => (
              <View key={i} style={styles.evidenceRow}>
                <Ionicons name="document-attach" size={15} color="#10B981" />
                <Text style={styles.mutedText} numberOfLines={1}>
                  {ev.fileName} ({Math.round((ev.fileSize || 0) / 1024)} KB) ✓
                </Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAccuracyConfirmed((v) => !v)}
            >
              <Ionicons name={accuracyConfirmed ? 'checkbox' : 'square-outline'} size={20} color="#D4AF37" />
              <Text style={styles.bodyText}>
                {t(
                  'Saya menyatakan data dan bukti ini benar & akurat untuk verifikasi server.',
                  'I confirm this data and evidence are truthful & accurate for server verification.'
                )}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryGreenBtn, { justifyContent: 'center', paddingVertical: 12 }]}
              onPress={handleSubmitActivity}
              disabled={submitting}
            >
              <Text style={styles.primaryGreenText}>
                {submitting ? t('Mengirim...', 'Submitting...') : t('Kirim Aktivitas Sekarang', 'Submit Activity')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 3: HISTORY & MY PLANTS */}
        {tab === 'history' && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('Riwayat Aktivitas & Verifikasi', 'Activity History & Verification')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(['all', 'pending', 'verified', 'rejected', 'needs_info'] as const).map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.chip, historyStatus === st && styles.chipActive]}
                    onPress={() => setHistoryStatus(st)}
                  >
                    <Text style={[styles.chipText, historyStatus === st && { color: '#052E16' }]}>
                      {st.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {historyItems.length === 0 ? (
                <Text style={styles.mutedText}>
                  {t('Belum ada aktivitas untuk filter ini.', 'No submissions match this filter.')}
                </Text>
              ) : (
                historyItems.map((item) => (
                  <View key={item.id} style={styles.itemBox}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.statusTag}>{String(item.status).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.mutedText}>
                      {item.quantity} {item.unit} • {t('Poin', 'Pts')}: +{item.awarded_points}
                      {item.points_tx_id ? ` • Tx: ${String(item.points_tx_id).slice(0, 8)}` : ''}
                    </Text>
                    {item.impactRecords?.[0] && (
                      <Text style={styles.mutedText}>
                        {t('Metode', 'Method')}: {item.impactRecords[0].method_id} ({item.impactRecords[0].factor_version})
                      </Text>
                    )}
                    {item.verifications?.[0] && (
                      <Text style={[styles.mutedText, { color: '#38BDF8' }]}>
                        {t('Catatan Verifikasi', 'Reviewer Note')}: {item.verifications[0].reason}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* My Plants Survival Monitoring */}
            {dashboard?.plants?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t('Pemantauan Pohon Saya', 'My Plant Monitoring')}</Text>
                {dashboard.plants.map((pl: any) => (
                  <View key={pl.id} style={styles.itemBox}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.itemTitle}>
                        🌱 {pl.common_name} ({pl.quantity}x)
                      </Text>
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={async () => {
                          await monitorGreenPlant(pl.id, 'healthy', 'Follow-up check');
                          loadAll();
                        }}
                      >
                        <Text style={styles.smallBtnText}>{t('Cek Hidup ✓', 'Log Alive ✓')}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.mutedText}>
                      Status: {pl.survival_status} • {t('Ekosistem', 'Ecosystem')}: {pl.ecosystem_type}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* TAB 4: ECO MAP & EDUCATION */}
        {tab === 'map_edu' && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('Peta Laporan Lingkungan Publik', 'Public Environmental Reports')}</Text>
              <Text style={styles.disclaimerText}>
                {t(
                  'Peringatan Darurat: NGOPI GREEN bukan layanan tanggap darurat. Segera hubungi layanan darurat/pemadam/BPBD setempat jika ada bahaya mengancam jiwa.',
                  'Emergency Disclaimer: NGOPI GREEN is not an emergency response service. Contact local emergency services for imminent danger.'
                )}
              </Text>
              {reports.length === 0 ? (
                <Text style={styles.mutedText}>
                  {t('Belum ada laporan lingkungan publik.', 'No public environmental reports yet.')}
                </Text>
              ) : (
                reports.map((r) => (
                  <View key={r.id} style={styles.itemBox}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.itemTitle}>{r.title}</Text>
                      <Text style={styles.statusTag}>{r.status}</Text>
                    </View>
                    <Text style={styles.mutedText}>
                      {r.report_category} • {r.severity} • {r.public_area_label || t('Area Umum', 'General Area')}
                      {r.approx_lat ? ` (~${r.approx_lat}, ${r.approx_lng})` : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('Edukasi & Metodologi Karbon', 'Education & Carbon Methodology')}</Text>
              <Text style={styles.bodyText}>
                • {t('Emisi Aktual vs Dihindari vs Terserap (Sequestered): Penanaman pohon tidak diklaim sebagai serapan karbon instan.', 'Actual vs Avoided vs Sequestered: Tree planting never claims instant carbon sequestration.')}
              </Text>
              <Text style={styles.bodyText}>
                • {t('Ecobrick: Kriteria kepadatan 0,33 g/ml digunakan sebagai panduan terkonfigurasi, bukan standar hukum universal. Kertas/kaca/logam/organik dilarang.', 'Ecobrick: The 0.33 g/ml density criterion is a configurable guideline; paper/glass/metal/organic waste is disallowed.')}
              </Text>
              <Text style={styles.bodyText}>
                • {t('Poin Ngopi vs Karbon vs BMC: Poin Ngopi adalah poin loyalitas dalam aplikasi (bukan uang tunai dan tidak otomatis dikonversi ke BMC).', 'Ngopi Points vs Carbon vs BMC: Ngopi Points are in-app loyalty points, separate from carbon metrics and BMC.')}
              </Text>
            </View>
          </View>
        )}

        {/* TAB 5: ADMIN VERIFICATION QUEUE */}
        {tab === 'admin' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('Antrean Verifikasi Admin', 'Admin Verification Queue')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {(['pending', 'verified', 'rejected', 'reversed', 'all'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.chip, adminStatusFilter === st && styles.chipActive]}
                  onPress={() => setAdminStatusFilter(st)}
                >
                  <Text style={[styles.chipText, adminStatusFilter === st && { color: '#052E16' }]}>
                    {st.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              value={adminReason}
              onChangeText={setAdminReason}
              placeholder={t('Tulis alasan verifikasi/penolakan (wajib)...', 'Enter verification/rejection reason (required)...')}
              placeholderTextColor="#8B735B"
              style={styles.input}
            />

            {adminQueue.length === 0 ? (
              <Text style={styles.mutedText}>{t('Antrean kosong.', 'Queue is empty.')}</Text>
            ) : (
              adminQueue.map((item) => (
                <View key={item.id} style={styles.itemBox}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle}>
                      {item.title} ({item.user?.display_name || item.user?.username})
                    </Text>
                    <Text style={styles.statusTag}>{item.status}</Text>
                  </View>
                  <Text style={styles.mutedText}>
                    {item.category_code} • {item.quantity} {item.unit} •{' '}
                    {t('Bukti', 'Evidence')}: {item.evidences?.length || 0}
                    {item.duplicate_warning ? ' • ⚠ DUPLICATE HASH' : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: '#10B981' }]}
                      disabled={verifyingId === item.id}
                      onPress={() => handleAdminVerify(item.id, 'verified')}
                    >
                      <Text style={[styles.smallBtnText, { color: '#052E16' }]}>{t('Setujui', 'Approve')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: '#F43F5E' }]}
                      disabled={verifyingId === item.id}
                      onPress={() => handleAdminVerify(item.id, 'rejected')}
                    >
                      <Text style={styles.smallBtnText}>{t('Tolak', 'Reject')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.smallBtn}
                      disabled={verifyingId === item.id}
                      onPress={() => handleAdminVerify(item.id, 'needs_info')}
                    >
                      <Text style={styles.smallBtnText}>{t('Minta Info', 'Needs Info')}</Text>
                    </TouchableOpacity>
                    {item.status === 'verified' && (
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#F59E0B' }]}
                        disabled={verifyingId === item.id}
                        onPress={() => handleAdminVerify(item.id, 'reversed')}
                      >
                        <Text style={[styles.smallBtnText, { color: '#1A120B' }]}>{t('Batalkan (Reverse)', 'Reverse')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {(
          [
            { id: 'dashboard', icon: 'leaf', label: t('Beranda', 'Home') },
            { id: 'submit', icon: 'add-circle', label: t('Kirim', 'Submit') },
            { id: 'history', icon: 'time', label: t('Riwayat', 'History') },
            { id: 'map_edu', icon: 'map', label: t('Peta & Info', 'Map & Edu') },
            ...(isAdmin ? [{ id: 'admin', icon: 'shield-checkmark', label: 'Admin' }] : []),
          ] as Array<{ id: GreenTab; icon: any; label: string }>
        ).map((item) => {
          const active = tab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => setTab(item.id)}
            >
              <Ionicons name={item.icon} size={19} color={active ? '#10B981' : '#94A3B8'} />
              <Text style={[styles.navText, active && { color: '#10B981' }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#120D08' },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#1E1610',
    borderBottomWidth: 1,
    borderBottomColor: '#3B2C20',
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#261C15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#D4AF37', fontSize: 15, fontWeight: '900' },
  headerSub: { color: '#BFA995', fontSize: 11 },
  langBtn: {
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#4A3728',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  langBtnText: { color: '#D4AF37', fontSize: 11, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 12,
    paddingBottom: 84,
    gap: 12,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    backgroundColor: '#261C15',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 10,
  },
  card: {
    backgroundColor: '#261C15',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4A3728',
    gap: 10,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pointsBig: { color: '#F5E6D3', fontSize: 22, fontWeight: '900' },
  ecoLevelText: { color: '#10B981', fontSize: 12, fontWeight: '800' },
  primaryGreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
  },
  primaryGreenText: { color: '#052E16', fontSize: 12.5, fontWeight: '900' },
  countsRow: { flexDirection: 'row', gap: 8 },
  countChip: {
    flex: 1,
    backgroundColor: '#1A120B',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B2C20',
  },
  countVal: { color: '#F5E6D3', fontSize: 16, fontWeight: '900' },
  countLbl: { color: '#94A3B8', fontSize: 10.5 },
  sectionTitle: { color: '#D4AF37', fontSize: 14.5, fontWeight: '800' },
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  impactCell: {
    width: '48.4%',
    flexGrow: 1,
    backgroundColor: '#1A120B',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3B2C20',
  },
  impactVal: { color: '#10B981', fontSize: 15, fontWeight: '900' },
  impactLbl: { color: '#BFA995', fontSize: 11, marginTop: 2 },
  footnote: { color: '#94A3B8', fontSize: 10.5, fontStyle: 'italic' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catCard: {
    width: '48.4%',
    flexGrow: 1,
    minWidth: 145,
    backgroundColor: '#1A120B',
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: '#3B2C20',
    gap: 4,
  },
  catName: { color: '#F5E6D3', fontSize: 12.5, fontWeight: '800' },
  catDesc: { color: '#94A3B8', fontSize: 10.5, lineHeight: 15 },
  itemBox: {
    backgroundColor: '#1A120B',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3B2C20',
    gap: 4,
  },
  itemTitle: { color: '#F5E6D3', fontSize: 13, fontWeight: '800', flex: 1 },
  mutedText: { color: '#BFA995', fontSize: 11.5, lineHeight: 16 },
  bodyText: { color: '#F5E6D3', fontSize: 12, lineHeight: 17, flex: 1 },
  label: { color: '#D4AF37', fontSize: 12, fontWeight: '800', marginTop: 2 },
  input: {
    backgroundColor: '#1A120B',
    color: '#F5E6D3',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A3728',
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
  },
  chip: {
    backgroundColor: '#1A120B',
    borderWidth: 1,
    borderColor: '#4A3728',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipActive: { backgroundColor: '#10B981', borderColor: '#34D399' },
  chipText: { color: '#F5E6D3', fontSize: 11, fontWeight: '800' },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A120B',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B2C20',
  },
  typeRowActive: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  uploadBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallBtn: {
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#4A3728',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallBtnText: { color: '#F5E6D3', fontSize: 11, fontWeight: '800' },
  statusTag: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: 'rgba(16,185,129,0.14)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  disclaimerText: {
    color: '#FDE68A',
    fontSize: 11,
    backgroundColor: 'rgba(245,158,11,0.12)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244,63,94,0.16)',
    borderColor: '#F43F5E',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
  },
  errorText: { color: '#FECDD3', fontSize: 12, flex: 1 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderColor: '#10B981',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
  },
  successText: { color: '#A7F3D0', fontSize: 12, flex: 1 },
  bottomNav: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#1A120B',
    borderTopWidth: 1,
    borderTopColor: '#3B2C20',
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 4,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, gap: 2 },
  navItemActive: { backgroundColor: '#261C15' },
  navText: { color: '#94A3B8', fontSize: 10.5, fontWeight: '700' },
});
