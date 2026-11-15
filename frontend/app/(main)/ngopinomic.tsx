import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import { coffee } from '../../src/theme/coffee';
import { API_URL, getAuthHeaders } from '../../src/utils/api';

const formatIdr = (value: number) =>
  `Rp${Math.round(value || 0).toLocaleString('id-ID')}`;

export default function NgopinomicDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [marketplace, setMarketplace] = useState<any[]>([]);
  const [rules, setRules] = useState<any>(null);
  const [mouInfo, setMouInfo] = useState<any>(null);
  const [referralInput, setReferralInput] = useState('');
  const [mouFullName, setMouFullName] = useState('');
  const [mouRole, setMouRole] = useState<'affiliate_partner' | 'community_ambassador' | 'merchant_partner' | 'ecosystem_builder'>('affiliate_partner');
  const [mouSignature, setMouSignature] = useState('');
  const [mouAgreed, setMouAgreed] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const [dashRes, mktRes, rulesRes, mouRes] = await Promise.all([
        axios.get(`${API_URL}/ngopinomic/dashboard`, { headers }),
        axios.get(`${API_URL}/ngopinomic/marketplace/identities`, { headers }),
        axios.get(`${API_URL}/ngopinomic/rules`),
        axios.get(`${API_URL}/ngopinomic/mou`, { headers }).catch(() => ({ data: null })),
      ]);
      setDashboard(dashRes.data);
      setMarketplace(mktRes.data?.items || []);
      setRules(rulesRes.data);
      setMouInfo(mouRes.data);
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.error || 'Gagal memuat data NGOPINOMIC.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleDailyCheckin = async () => {
    setBusyAction('checkin');
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/ngopinomic/points/claim`,
        { activity_code: 'daily_checkin' },
        { headers }
      );
      setStatusMessage(
        res.data?.message ||
          (res.data?.idempotent
            ? 'Check-in harian sudah diklaim pada siklus 07.00 - 07.00 WIB hari ini.'
            : `Check-in harian berhasil (+${res.data?.pointsAdded ?? res.data?.transaction?.amount ?? 0} Poin Ngopi).`)
      );
      await loadAll();
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.error || 'Gagal check-in.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyReferral = async () => {
    const link = dashboard?.my_referral?.referral_link;
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setStatusMessage('Tautan Undang Teman berhasil disalin.');
  };

  const handleRegisterReferral = async () => {
    if (!referralInput.trim()) return;
    setBusyAction('referral');
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_URL}/ngopinomic/referral/register`,
        { referral_code: referralInput.trim() },
        { headers }
      );
      setReferralInput('');
      setStatusMessage('Kode undangan berhasil didaftarkan.');
      await loadAll();
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.error || 'Gagal mendaftarkan kode undangan.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreference = async (pref: 'rupiah' | 'points') => {
    setBusyAction('pref');
    try {
      const headers = await getAuthHeaders();
      await axios.patch(
        `${API_URL}/ngopinomic/affiliate/preference`,
        { payout_preference: pref },
        { headers }
      );
      setStatusMessage(`Preferensi pencairan komisi diubah ke ${pref === 'rupiah' ? 'Rupiah' : 'Poin Ngopi'}.`);
      await loadAll();
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.error || 'Gagal mengubah preferensi.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePurchaseIdentity = async (item: any, paymentMethod: 'rupiah' | 'points') => {
    setBusyAction(`buy:${item.id}`);
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_URL}/ngopinomic/marketplace/purchase`,
        {
          inventory_id: item.id,
          payment_method: paymentMethod,
          idempotency_key: `ui:${item.id}:${Date.now()}`,
        },
        { headers }
      );
      setStatusMessage(`Berhasil mengaktifkan ${item.display_value}!`);
      await loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Gagal membeli identitas.';
      setStatusMessage(msg);
      Alert.alert('Info', msg);
    } finally {
      setBusyAction(null);
    }
  };

  const handleBoomBoomConsent = async () => {
    setBusyAction('boomboom');
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_URL}/ngopinomic/ecosystem/consent`,
        { app_code: 'boomboom', scopes: ['identity:basic', 'identity:email', 'boomboom:role_hint'] },
        { headers }
      );
      setStatusMessage('Izin identitas (Nomor & Email Ngopi) untuk BoomBoom berhasil diaktifkan.');
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.error || 'Gagal mengatur izin BoomBoom.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSignMou = async () => {
    if (!mouAgreed) {
      Alert.alert('Persetujuan Diperlukan', 'Centang persetujuan isi MoU Digital terlebih dahulu.');
      return;
    }
    if (mouFullName.trim().length < 3 || mouSignature.trim().length < 3) {
      Alert.alert('Data Belum Lengkap', 'Isi nama lengkap dan tanda tangan digital minimal 3 karakter.');
      return;
    }
    setBusyAction('mou');
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/ngopinomic/mou/sign`,
        {
          full_name: mouFullName.trim(),
          partnership_role: mouRole,
          signature_text: mouSignature.trim(),
          agreed_to_terms: true,
        },
        { headers }
      );
      setStatusMessage(`MoU Digital berhasil ditandatangani (${res.data?.mou?.mou_number}).`);
      await loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Gagal menandatangani MoU Digital.';
      setStatusMessage(msg);
      Alert.alert('Info', msg);
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={coffee.accent} />
        <Text style={styles.mutedText}>Memuat NGOPINOMIC...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} />}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={coffee.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Dashboard NGOPINOMIC</Text>
          <Text style={styles.pageTagline}>Satu Identitas. Satu Komunitas. Banyak Peluang.</Text>
        </View>
      </View>

      {statusMessage ? (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Welcome Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{dashboard?.welcome?.title || 'Selamat datang di NGOPINOMIC'}</Text>
        <Text style={styles.bodyText}>{dashboard?.welcome?.subtitle}</Text>
      </View>

      {/* 1 & 2. ID Ngopi Saya & Email Ngopi Saya */}
      <View style={styles.gridRow}>
        <View style={[styles.card, styles.halfCard]}>
          <View style={styles.syncRow}>
            <Text style={styles.cardLabel}>1. ID Ngopi Saya</Text>
            <Text style={styles.syncBadge}>Sinkron Identitas Ngopi</Text>
          </View>
          <Text style={styles.highlightValue}>
            #{dashboard?.my_identity?.ngopi_number || dashboard?.my_identity?.ngopi_id || '-'}
          </Text>
          <Text style={styles.mutedText}>
            Status: {dashboard?.my_identity?.tier === 'premium' ? 'ID Ngopi Premium' : 'Identitas Dasar Gratis'} • Nomor Ngopi aktif
          </Text>
        </View>

        <View style={[styles.card, styles.halfCard]}>
          <View style={styles.syncRow}>
            <Text style={styles.cardLabel}>2. Email Ngopi Saya</Text>
            <Text style={styles.syncBadge}>Sinkron Identitas Ngopi</Text>
          </View>
          {(dashboard?.my_emails || []).map((e: any) => (
            <Text key={e.email_address} style={styles.emailItem}>
              • {e.email_address} ({e.type === 'premium' ? 'Email Ngopi Premium' : 'Dasar'})
            </Text>
          ))}
        </View>
      </View>

      {/* 3. Poin Ngopi */}
      <View style={styles.card}>
        <View style={styles.cardHeaderBetween}>
          <View>
            <View style={styles.syncRow}>
              <Text style={styles.cardLabel}>3. Poin Ngopi</Text>
              <Text style={styles.syncBadge}>Sinkron Ekonomi Ngopi & BMC</Text>
            </View>
            <Text style={styles.highlightValue}>{dashboard?.my_points?.balance ?? 0} Poin Ngopi</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleDailyCheckin}
            disabled={busyAction === 'checkin'}
          >
            <Text style={styles.btnText}>
              {busyAction === 'checkin' ? 'Memproses...' : 'Klaim Streak Harian'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.mutedText}>
          Total diperoleh: {dashboard?.my_points?.lifetime_earned ?? 0} | Ditukar: {dashboard?.my_points?.lifetime_redeemed ?? 0} | Streak: {dashboard?.my_points?.streak_days ?? 0} hari (Siklus 07.00–07.00 WIB: +1, +3, +5, +7, +9, +11, +20 Poin).
          Terhubung langsung dengan Ekonomi Ngopi & BMC Token.
        </Text>
      </View>

      {/* 4. Komisi Saya */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>4. Komisi Saya</Text>
        <View style={styles.gridRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mutedText}>Siap Dicairkan</Text>
            <Text style={styles.highlightValue}>{formatIdr(dashboard?.my_commissions?.available_idr)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mutedText}>Menunggu Penyelesaian</Text>
            <Text style={styles.secondaryValue}>{formatIdr(dashboard?.my_commissions?.pending_idr)}</Text>
          </View>
        </View>
        <Text style={styles.mutedText}>{dashboard?.my_commissions?.explanation}</Text>
        <View style={styles.prefRow}>
          <Text style={styles.mutedText}>Preferensi Penerimaan:</Text>
          <TouchableOpacity
            style={[
              styles.chipBtn,
              dashboard?.my_commissions?.payout_preference === 'rupiah' && styles.chipBtnActive,
            ]}
            onPress={() => handlePreference('rupiah')}
          >
            <Text style={styles.chipText}>Rupiah</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.chipBtn,
              dashboard?.my_commissions?.payout_preference === 'points' && styles.chipBtnActive,
            ]}
            onPress={() => handlePreference('points')}
          >
            <Text style={styles.chipText}>Poin Ngopi</Text>
          </TouchableOpacity>
        </View>
        {(dashboard?.my_commissions?.recent || []).map((c: any) => (
          <View key={c.id} style={styles.txRow}>
            <Text style={styles.bodyText}>
              {c.commission_type.toUpperCase()} ({c.rate_bps / 100}%) → {formatIdr(c.commission_amount_idr)} [{c.status}]
            </Text>
            <Text style={styles.mutedText}>
              Kotor: {formatIdr(c.gross_amount_idr)} | Pengurangan: {formatIdr(c.deductions_json?.total_deductions_idr)} | Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih): {formatIdr(c.net_distributable_idr)}
            </Text>
          </View>
        ))}
      </View>

      {/* 5. Manfaat BMC */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>5. Manfaat BMC</Text>
        <Text style={styles.bodyText}>
          Status Gerbang: {dashboard?.my_bmc_benefits?.mode === 'controlled_live' ? 'Aktif Terkendali' : 'Mode Konfigurasi'}
        </Text>
        <Text style={styles.mutedText}>{dashboard?.my_bmc_benefits?.compliance_notice}</Text>
      </View>

      {/* 6. Undang Teman */}
      <View style={styles.card}>
        <View style={styles.syncRow}>
          <Text style={styles.cardLabel}>6. Undang Teman & Kode Profil</Text>
          <Text style={styles.syncBadge}>Sinkron Profile Link</Text>
        </View>
        <Text style={styles.bodyText}>
          Kode Anda: <Text style={{ color: coffee.accent, fontWeight: '700' }}>{dashboard?.my_referral?.referral_code}</Text> ({dashboard?.my_referral?.total_invited ?? 0} teman)
        </Text>
        <Text style={styles.mutedText}>
          Profile Link: {dashboard?.my_referral?.profile_link}
        </Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyReferral}>
          <Text style={styles.btnText}>Salin Tautan Undang Teman</Text>
        </TouchableOpacity>
        <View style={styles.inputRow}>
          <TextInput
            value={referralInput}
            onChangeText={setReferralInput}
            placeholder="Masukkan kode pengundang (opsional)"
            placeholderTextColor={coffee.muted}
            style={styles.input}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleRegisterReferral} disabled={busyAction === 'referral'}>
            <Text style={styles.btnText}>Pakai</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Infografis & Diagram Skema Penghasilan NGOPINOMIC */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Infografis & Diagram Penghasilan NGOPINOMIC</Text>
        <Text style={styles.mutedText}>
          Alur Perhitungan Resmi: Harga Transaksi (100%) → Dikurangi Pajak (11%), Payment Fee (2%), Infrastruktur (3%), Cadangan Refund (4%), Operasional (10%) = 70% Dasar Komisi Bersih (NDR). Maksimal total komisi 35% dari NDR.
        </Text>

        {/* Visual Flow Diagram */}
        <View style={styles.diagramRow}>
          <View style={styles.diagramBox}>
            <Text style={styles.diagramTitle}>Transaksi Sah</Text>
            <Text style={styles.diagramValue}>Rp250.000</Text>
            <Text style={styles.mutedText}>Gross (100%)</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={coffee.accent} />
          <View style={styles.diagramBox}>
            <Text style={styles.diagramTitle}>Dasar Komisi (NDR)</Text>
            <Text style={styles.diagramValue}>Rp175.000</Text>
            <Text style={styles.mutedText}>70% Bersih</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={coffee.accent} />
          <View style={styles.diagramBox}>
            <Text style={styles.diagramTitle}>Porsi Komisi</Text>
            <Text style={styles.diagramValue}>Maks 35%</Text>
            <Text style={styles.mutedText}>s/d Rp61.250</Text>
          </View>
        </View>

        {/* a) Affiliate */}
        <View style={styles.infoBlock}>
          <Text style={styles.infoTitle}>a) Jadi Affiliate (Komisi Rupiah / Poin)</Text>
          <Text style={styles.bodyText}>• Affiliate Langsung (Level 1): 20% dari NDR (contoh: Rp35.000 dari transaksi Rp250.000)</Text>
          <Text style={styles.bodyText}>• Referral Level 2: 5% dari NDR (contoh: Rp8.750)</Text>
          <Text style={styles.bodyText}>• Community Ambassador: hingga 5% dari NDR</Text>
          <Text style={styles.bodyText}>• Campaign Promoter: 5% – 10% dari NDR (total semua komisi tetap dibatasi cap 35% NDR)</Text>
        </View>

        {/* b) Referral */}
        <View style={styles.infoBlock}>
          <Text style={styles.infoTitle}>b) Me-referral-kan Teman</Text>
          <Text style={styles.bodyText}>• Bonus Daftar Aktif: +50 Poin Ngopi per teman aktif di warkop</Text>
          <Text style={styles.bodyText}>• Komisi Berkelanjutan: 20% NDR (Level 1) + 5% NDR (Level 2) saat teman bertransaksi di marketplace</Text>
        </View>

        {/* c) Aktivitas Sosial */}
        <View style={styles.infoBlock}>
          <Text style={styles.infoTitle}>c) Membagi, Mentag, Follow, Like, Komen</Text>
          <Text style={styles.bodyText}>• Membagi (Share) Tautan Kampanye: 5% – 10% NDR bila terjadi transaksi + Misi Harian (+20 Poin)</Text>
          <Text style={styles.bodyText}>• Mentag / Bantu Jawab (Helper): +5 Poin Ngopi per jawaban membantu</Text>
          <Text style={styles.bodyText}>• Follow / Check-in Harian (Siklus 07.00–07.00 WIB): Streak H-1 s/d H-7 (+1, +3, +5, +7, +9, +11, +20 Poin)</Text>
          <Text style={styles.bodyText}>• Like / Reaction: +2 Poin Ngopi per reaksi (maks. 20 Poin/hari)</Text>
          <Text style={styles.bodyText}>• Komen / Chat Warkop: +1 Poin Ngopi per pesan (maks. 50 Poin/hari)</Text>
          <Text style={styles.mutedText}>Batas total perolehan poin harian: 500 Poin/hari. Konversi indikatif: 1.000 Poin ≈ 1 BMC (aktif setelah izin regulasi).</Text>
        </View>
      </View>

      {/* MoU Digital Kemitraan Ekosistem ngopi.top */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>MoU Digital Kemitraan Ekosistem ngopi.top</Text>
        {(dashboard?.my_mou || (mouInfo?.signed_mous || []).length > 0) ? (
          <View style={styles.mouSignedBox}>
            <Text style={styles.infoTitle}>Sertifikat MoU Digital Terverifikasi</Text>
            <Text style={styles.bodyText}>
              Nomor MoU: {(dashboard?.my_mou || mouInfo?.signed_mous?.[0])?.mou_number}
            </Text>
            <Text style={styles.bodyText}>
              Mitra: {(dashboard?.my_mou || mouInfo?.signed_mous?.[0])?.full_name} ({(dashboard?.my_mou || mouInfo?.signed_mous?.[0])?.partnership_role})
            </Text>
            <Text style={styles.mutedText}>
              SHA-256: {(dashboard?.my_mou || mouInfo?.signed_mous?.[0])?.signature_hash}
            </Text>
          </View>
        ) : null}

        <Text style={styles.mutedText}>
          Draft Perjanjian ({mouInfo?.version || 'v1.0-2026'}):
        </Text>
        {(mouInfo?.clauses || [
          '1. Mitra berperan aktif membangun komunitas & ekosistem ngopi.top secara jujur.',
          '2. Seluruh komisi dihitung dari Pendapatan Bersih yang Dapat Dibagikan (NDR) dengan batas cap 35%.',
          '3. Poin Ngopi adalah poin loyalitas; fitur BMC tunduk pada regulasi Indonesia.',
          '4. Dilarang spam, akun ganda, self-referral, atau transaksi fiktif.',
          '5. Kepatuhan UU PDP No. 27 Tahun 2022 dan hubungan kemitraan independen.',
        ]).map((c: string, idx: number) => (
          <Text key={idx} style={styles.mutedText}>{c}</Text>
        ))}

        <View style={styles.prefRow}>
          {[
            { id: 'affiliate_partner', label: 'Affiliate' },
            { id: 'community_ambassador', label: 'Ambassador' },
            { id: 'merchant_partner', label: 'Merchant' },
            { id: 'ecosystem_builder', label: 'Builder' },
          ].map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.chipBtn, mouRole === r.id && styles.chipBtnActive]}
              onPress={() => setMouRole(r.id as any)}
            >
              <Text style={styles.chipText}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          value={mouFullName}
          onChangeText={setMouFullName}
          placeholder="Nama Lengkap sesuai identitas"
          placeholderTextColor={coffee.muted}
          style={styles.input}
        />
        <TextInput
          value={mouSignature}
          onChangeText={setMouSignature}
          placeholder="Tanda Tangan Digital (ketik ulang nama lengkap)"
          placeholderTextColor={coffee.muted}
          style={styles.input}
        />
        <TouchableOpacity style={styles.checkRow} onPress={() => setMouAgreed((v) => !v)}>
          <Ionicons name={mouAgreed ? 'checkbox' : 'square-outline'} size={20} color={coffee.accent} />
          <Text style={[styles.mutedText, { flex: 1 }]}>
            Saya telah membaca, memahami, dan menyetujui seluruh klausul MoU Digital Ekosistem ngopi.top.
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSignMou} disabled={busyAction === 'mou'}>
          <Text style={styles.btnText}>
            {busyAction === 'mou' ? 'Menyimpan MoU...' : 'Tandatangani MoU Secara Digital'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 7. Keanggotaan Komunitas & BoomBoom */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>7. Keanggotaan Komunitas & Integrasi BoomBoom (bamboochain.id)</Text>
        <Text style={styles.bodyText}>
          Status Komunitas: {dashboard?.my_community?.membership_tier || 'komunitas'} | Koperasi: {dashboard?.my_community?.cooperative_status || 'not_enrolled'}
        </Text>
        <Text style={styles.mutedText}>
          Alur Integrasi BoomBoom: Saat mendaftar/login di BoomBoom (bamboochain.id), Nomor Ngopi (#{dashboard?.my_identity?.ngopi_number || '-'}) dan Email Ngopi ({dashboard?.my_identity?.ngopi_email || '-'}) digunakan sebagai identitas SSO terverifikasi (scope: identity:basic, identity:email, boomboom:role_hint). Verifikasi keselamatan, SIM, KYC, dan asuransi tetap diproses mandiri oleh sistem BoomBoom.
        </Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleBoomBoomConsent} disabled={busyAction === 'boomboom'}>
          <Text style={styles.btnText}>Izinkan Identitas Ngopi untuk BoomBoom</Text>
        </TouchableOpacity>
      </View>

      {/* Marketplace ID & Email Ngopi Premium */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Marketplace ID Ngopi Premium & Email Ngopi Premium (Opsional)</Text>
        {marketplace.filter((m) => m.status === 'Available').slice(0, 8).map((item) => (
          <View key={item.id} style={styles.marketRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyText}>
                {item.display_value} <Text style={styles.tierBadge}>[{item.rarity_tier}]</Text>
              </Text>
              <Text style={styles.mutedText}>
                {formatIdr(item.price_idr)} {item.price_points ? `atau ${item.price_points} Poin Ngopi` : ''}
              </Text>
            </View>
            <View style={styles.actionGroup}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handlePurchaseIdentity(item, 'rupiah')}
                disabled={busyAction === `buy:${item.id}`}
              >
                <Text style={styles.btnText}>Beli</Text>
              </TouchableOpacity>
              {item.price_points ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => handlePurchaseIdentity(item, 'points')}
                  disabled={busyAction === `buy:${item.id}`}
                >
                  <Text style={styles.btnText}>Tukar Poin</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* 8. Riwayat Transaksi */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>8. Riwayat Transaksi</Text>
        {(dashboard?.transaction_history || []).length === 0 ? (
          <Text style={styles.mutedText}>Belum ada transaksi Poin Ngopi.</Text>
        ) : (
          (dashboard?.transaction_history || []).map((tx: any) => (
            <View key={tx.id} style={styles.txRow}>
              <Text style={styles.bodyText}>{tx.description}</Text>
              <Text style={styles.mutedText}>
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount} Poin • Ref: {tx.reference_code}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* 9. Aturan dan Bantuan */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>9. Aturan dan Bantuan</Text>
        {(rules?.disclosures || []).map((d: string, i: number) => (
          <Text key={i} style={styles.mutedText}>• {d}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: coffee.background },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: coffee.background, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, backgroundColor: coffee.surface, borderRadius: 10, borderWidth: 1, borderColor: coffee.border },
  pageTitle: { color: coffee.text, fontSize: 22, fontWeight: '800' },
  pageTagline: { color: coffee.accent, fontSize: 13 },
  noticeBanner: { backgroundColor: coffee.highlight, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: coffee.accent },
  noticeText: { color: coffee.text, fontSize: 13 },
  card: { backgroundColor: coffee.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: coffee.border, gap: 8 },
  gridRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  halfCard: { flex: 1, minWidth: 240 },
  cardHeaderBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  cardTitle: { color: coffee.accent, fontSize: 17, fontWeight: '700' },
  cardLabel: { color: coffee.accent, fontSize: 14, fontWeight: '700' },
  highlightValue: { color: coffee.text, fontSize: 20, fontWeight: '800' },
  secondaryValue: { color: coffee.warning, fontSize: 18, fontWeight: '700' },
  bodyText: { color: coffee.text, fontSize: 14, lineHeight: 20 },
  mutedText: { color: coffee.secondary, fontSize: 12, lineHeight: 18 },
  emailItem: { color: coffee.text, fontSize: 13 },
  primaryBtn: { backgroundColor: coffee.button, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  secondaryBtn: { backgroundColor: coffee.raised, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: coffee.border, alignSelf: 'flex-start' },
  btnText: { color: coffee.buttonText, fontWeight: '700', fontSize: 13 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  chipBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: coffee.inset, borderWidth: 1, borderColor: coffee.border },
  chipBtnActive: { backgroundColor: coffee.button, borderColor: coffee.accent },
  chipText: { color: coffee.text, fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  input: { flex: 1, backgroundColor: coffee.inset, color: coffee.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: coffee.border },
  marketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: coffee.border, gap: 10 },
  tierBadge: { color: coffee.accent, fontWeight: '700' },
  actionGroup: { flexDirection: 'row', gap: 8 },
  txRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: coffee.border },
  syncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  syncBadge: { color: '#22c55e', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  diagramRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', marginVertical: 6 },
  diagramBox: { flex: 1, minWidth: 95, backgroundColor: coffee.inset, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: coffee.border, alignItems: 'center' },
  diagramTitle: { color: coffee.secondary, fontSize: 11, fontWeight: '700' },
  diagramValue: { color: coffee.accent, fontSize: 15, fontWeight: '800', marginVertical: 2 },
  infoBlock: { backgroundColor: coffee.inset, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: coffee.border, gap: 4 },
  infoTitle: { color: coffee.accent, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  mouSignedBox: { backgroundColor: 'rgba(34,197,94,0.10)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#22c55e', gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});

