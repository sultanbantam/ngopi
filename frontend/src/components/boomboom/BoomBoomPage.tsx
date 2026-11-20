import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../utils/i18n';
import InteractiveStreetMap from '../common/InteractiveStreetMap';
import {
  acceptBoomBoomTrip,
  activateBoomBoomConsent,
  cancelBoomBoomTrip,
  completeBoomBoomTrip,
  createBoomBoomTrip,
  fetchBoomBoomDashboard,
  registerBoomBoomDriver,
  toggleBoomBoomDriverOnline,
} from './boomboomApi';

type BoomTab = 'book' | 'trips' | 'driver' | 'rewards';

const SERVICES = [
  { id: 'BoomRide', label: 'BoomRide', badgeId: 'Motor EV', badgeEn: 'EV Bike', icon: '🛵', color: '#10B981' },
  { id: 'BoomCar', label: 'BoomCar', badgeId: 'Mobil Hijau', badgeEn: 'Green Car', icon: '🚗', color: '#059669' },
  { id: 'BoomSend', label: 'BoomSend', badgeId: 'Kirim Cepat', badgeEn: 'Express', icon: '📦', color: '#0284C7' },
  { id: 'BoomSchedule', label: 'BoomSchedule', badgeId: 'Jadwal', badgeEn: 'Scheduled', icon: '🗓️', color: '#D97706' },
  { id: 'BoomTogether', label: 'BoomTogether', badgeId: 'Tumpangan', badgeEn: 'Carpool', icon: '🤝', color: '#7C3AED' },
] as const;

export default function BoomBoomPage() {
  const router = useRouter();
  const { lang, toggleLang, t } = useLanguage();
  const isEn = lang === 'en';

  const [tab, setTab] = useState<BoomTab>('book');
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Booking form state
  const [serviceType, setServiceType] = useState<string>('BoomRide');
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [distanceKmText, setDistanceKmText] = useState('4');
  const [isEv, setIsEv] = useState(true);
  const [notes, setNotes] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Driver form state
  const [vehicleType, setVehicleType] = useState('motor_ev');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [serviceArea, setServiceArea] = useState('Jabodetabek');
  const [driverIsEv, setDriverIsEv] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchBoomBoomDashboard();
      setDash(data);
      if (data?.driverProfile) {
        setVehicleType(data.driverProfile.vehicle_type || 'motor_ev');
        setVehiclePlate(data.driverProfile.vehicle_plate || '');
        setVehicleModel(data.driverProfile.vehicle_model || '');
        setServiceArea(data.driverProfile.service_area || 'Jabodetabek');
        setDriverIsEv(Boolean(data.driverProfile.is_ev));
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          t(
            'Wajib login dengan akun ngopi.top untuk menggunakan BoomBoom.',
            'Please sign in with your ngopi.top account to use BoomBoom.'
          )
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const quote = useMemo(() => {
    const km = Math.max(0.5, Math.min(250, Number(distanceKmText) || 3));
    const evMul = isEv ? 1.5 : 1.0;
    const poolMul = serviceType === 'BoomTogether' ? 1.25 : 1.0;
    const passengerPts = Math.max(10, Math.round(km * 5 * evMul * poolMul));
    const driverPts = Math.max(15, Math.round(km * 8 * evMul * poolMul));
    let base = 3000;
    let perKm = 2500;
    if (serviceType === 'BoomCar') {
      base = 7000;
      perKm = 4500;
    } else if (serviceType === 'BoomSend') {
      base = 4000;
      perKm = 3000;
    } else if (serviceType === 'BoomSchedule') {
      base = 5000;
      perKm = 3500;
    } else if (serviceType === 'BoomTogether') {
      base = 2500;
      perKm = 1800;
    }
    const fareIdr = Math.round((base + km * perKm) / 500) * 500;
    return { km, passengerPts, driverPts, fareIdr };
  }, [distanceKmText, isEv, serviceType]);

  const handleGetGps = () => {
    if (Platform.OS !== 'web' || !navigator?.geolocation) {
      setErrorMsg(t('GPS browser tidak tersedia.', 'Browser GPS is unavailable.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setGpsCoords({ lat, lng });
        if (!pickupAddress.trim()) {
          setPickupAddress(`GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
      },
      () => setErrorMsg(t('Izin lokasi ditolak.', 'Location permission denied.')),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleBookTrip = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!pickupAddress.trim() || !destinationAddress.trim()) {
      setErrorMsg(t('Alamat jemput dan tujuan wajib diisi.', 'Pickup and destination addresses are required.'));
      return;
    }
    setBusy(true);
    try {
      const res = await createBoomBoomTrip({
        serviceType,
        pickupAddress: pickupAddress.trim(),
        destinationAddress: destinationAddress.trim(),
        pickupLat: gpsCoords?.lat ?? null,
        pickupLng: gpsCoords?.lng ?? null,
        distanceKm: quote.km,
        isEv,
        notes: notes.trim() || undefined,
      });
      setSuccessMsg(
        t(
          `Pesanan ${serviceType} dibuat! Estimasi reward: +${res.quote?.passengerPoints} Poin Penumpang & +${res.quote?.driverPoints} Poin Pengemudi.`,
          `${serviceType} booked! Reward preview: +${res.quote?.passengerPoints} Passenger Pts & +${res.quote?.driverPoints} Driver Pts.`
        )
      );
      setDestinationAddress('');
      setNotes('');
      setTab('trips');
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || t('Gagal memesan BoomBoom.', 'Failed to book BoomBoom.'));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenExternalBoomBoom = () => {
    const url = 'https://www.bamboochain.id/#/boomboom';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(main)/warkop' as any))}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#F5E6D3" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🛵 BOOMBOOM</Text>
          <Text style={styles.headerSub}>
            {t('Mobilitas Komunitas Hijau • Ngopi × BaMbooChain', 'Green Community Mobility • Ngopi × BaMbooChain')}
          </Text>
        </View>
        <TouchableOpacity style={styles.langPill} onPress={toggleLang}>
          <Text style={styles.langPillText}>{lang === 'id' ? 'ID | en' : 'EN | id'}</Text>
        </TouchableOpacity>
        <View style={styles.ptsPill}>
          <Text style={styles.ptsPillText}>⭐ {(dash?.pointsBalance ?? 0).toLocaleString('id-ID')} Pts</Text>
        </View>
      </View>

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

      <ScrollView contentContainerStyle={styles.content}>
        {/* Mandatory Ngopi Account & SSO Integration Card */}
        {dash?.ngopi_identity && (
          <View style={[styles.card, { borderColor: '#10B981' }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>
                🔐 {t('Akun Ngopi Terhubung (Wajib BoomBoom)', 'Connected Ngopi Account (Required)')}
              </Text>
              <TouchableOpacity style={styles.smallBtn} onPress={handleOpenExternalBoomBoom}>
                <Text style={styles.smallBtnText}>BaMbooChain ↗</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.mutedText}>
              ID: {dash.ngopi_identity.ngopi_id} • #{dash.ngopi_identity.ngopi_number} •{' '}
              {dash.ngopi_identity.ngopi_email}
            </Text>
            <View style={styles.rowBetween}>
              <Text style={{ color: dash.consent_active ? '#34D399' : '#FBBF24', fontSize: 12, fontWeight: '800' }}>
                {dash.consent_active
                  ? t('Status SSO BoomBoom: AKTIF ✓', 'BoomBoom SSO Status: ACTIVE ✓')
                  : t('Status SSO BoomBoom: Belum diaktifkan', 'BoomBoom SSO Status: Not activated')}
              </Text>
              {!dash.consent_active && (
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: '#10B981' }]}
                  disabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await activateBoomBoomConsent(dash.driverProfile ? 'driver' : 'passenger');
                      setSuccessMsg(t('Integrasi SSO BoomBoom aktif!', 'BoomBoom SSO integration activated!'));
                      await loadDashboard();
                    } catch (e: any) {
                      setErrorMsg(e?.message || 'Error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Text style={[styles.smallBtnText, { color: '#052E16' }]}>
                    {t('Aktifkan SSO', 'Activate SSO')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {loading && !dash ? (
          <ActivityIndicator color="#10B981" size="large" style={{ marginTop: 28 }} />
        ) : null}

        {/* TAB 1: BOOK RIDE / DELIVERY */}
        {tab === 'book' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('Pilih Layanan BoomBoom', 'Select BoomBoom Service')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SERVICES.map((s) => {
                const active = serviceType === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.serviceCard, active && { borderColor: s.color, backgroundColor: '#052E16' }]}
                    onPress={() => setServiceType(s.id)}
                  >
                    <Text style={{ fontSize: 22 }}>{s.icon}</Text>
                    <Text style={styles.itemTitle}>{s.label}</Text>
                    <Text style={[styles.mutedText, { color: s.color, fontWeight: '800' }]}>
                      {isEn ? s.badgeEn : s.badgeId}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>{t('Lokasi Penjemputan', 'Pickup Location')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder={t('Contoh: Stasiun Cawang / Warkop...', 'e.g. Cawang Station / Coffee Lounge...')}
                placeholderTextColor="#8B735B"
                style={[styles.input, { flex: 1 }]}
              />
              <TouchableOpacity style={styles.smallBtn} onPress={handleGetGps}>
                <Text style={styles.smallBtnText}>📍 GPS</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('Tujuan', 'Destination')}</Text>
            <TextInput
              value={destinationAddress}
              onChangeText={setDestinationAddress}
              placeholder={t('Masukkan alamat tujuan...', 'Enter destination address...')}
              placeholderTextColor="#8B735B"
              style={styles.input}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t('Estimasi Jarak (km)', 'Est. Distance (km)')}</Text>
                <TextInput
                  value={distanceKmText}
                  onChangeText={setDistanceKmText}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  style={[styles.chip, isEv && styles.chipActive, { paddingVertical: 11, alignItems: 'center' }]}
                  onPress={() => setIsEv((v) => !v)}
                >
                  <Text style={[styles.chipText, isEv && { color: '#052E16' }]}>
                    ⚡ {isEv ? t('Kendaraan EV (1.5x Poin)', 'EV Mode (1.5x Pts)') : t('Non-EV (1.0x)', 'Standard (1.0x)')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {Platform.OS === 'web' && (
              <InteractiveStreetMap
                centerLat={gpsCoords?.lat ?? -6.2088}
                centerLng={gpsCoords?.lng ?? 106.8456}
                zoom={14}
                height={180}
              />
            )}

            {/* Proportional Reward & Fare Preview */}
            <View style={[styles.itemBox, { borderColor: '#10B981', backgroundColor: '#0B1F16' }]}>
              <Text style={styles.itemTitle}>
                {t('Estimasi Tarif & Reward Proporsional', 'Estimated Fare & Proportional Rewards')}
              </Text>
              <Text style={styles.mutedText}>
                {t('Tarif Perkiraan', 'Est. Fare')}: Rp {quote.fareIdr.toLocaleString('id-ID')} ({quote.km} km)
              </Text>
              <Text style={{ color: '#34D399', fontSize: 12.5, fontWeight: '800' }}>
                🧑 {t('Reward Penumpang', 'Passenger Reward')}: +{quote.passengerPts} {t('Poin Ngopi', 'Ngopi Pts')}
              </Text>
              <Text style={{ color: '#FBBF24', fontSize: 12.5, fontWeight: '800' }}>
                🛵 {t('Reward Pengemudi', 'Driver Reward')}: +{quote.driverPts} {t('Poin Ngopi', 'Ngopi Pts')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={handleBookTrip}
            >
              <Text style={styles.primaryBtnText}>
                {busy
                  ? t('Memproses...', 'Booking...')
                  : t(`Pesan ${serviceType} Sekarang`, `Book ${serviceType} Now`)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 2: MY TRIPS */}
        {tab === 'trips' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('Riwayat & Perjalanan Aktif', 'Active & Past Trips')}</Text>
            {(!dash?.myTrips || dash.myTrips.length === 0) ? (
              <Text style={styles.mutedText}>{t('Belum ada perjalanan BoomBoom.', 'No BoomBoom trips yet.')}</Text>
            ) : (
              dash.myTrips.map((tr: any) => (
                <View key={tr.id} style={styles.itemBox}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle}>
                      {tr.service_type} • {tr.distance_km} km
                    </Text>
                    <Text style={styles.statusTag}>{String(tr.status).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.mutedText}>
                    {tr.pickup_address} → {tr.destination_address}
                  </Text>
                  <Text style={{ color: '#34D399', fontSize: 11.5, fontWeight: '700' }}>
                    {t('Reward', 'Rewards')}: +{tr.passenger_points} {t('Poin Penumpang', 'Passenger Pts')} • +
                    {tr.driver_points} {t('Poin Pengemudi', 'Driver Pts')}
                  </Text>
                  {(tr.status === 'requested' || tr.status === 'accepted') && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#10B981' }]}
                        onPress={async () => {
                          try {
                            const r = await completeBoomBoomTrip(tr.id);
                            setSuccessMsg(
                              t(
                                `Perjalanan selesai! +${r.passengerPointsAwarded} Poin Penumpang & +${r.driverPointsAwarded} Poin Pengemudi dikreditkan.`,
                                `Trip completed! +${r.passengerPointsAwarded} Passenger Pts & +${r.driverPointsAwarded} Driver Pts credited.`
                              )
                            );
                            await loadDashboard();
                          } catch (e: any) {
                            setErrorMsg(e?.message || 'Error');
                          }
                        }}
                      >
                        <Text style={[styles.smallBtnText, { color: '#052E16' }]}>
                          ✓ {t('Selesaikan & Klaim Poin', 'Complete & Claim Pts')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, { borderColor: '#FB7185' }]}
                        onPress={async () => {
                          await cancelBoomBoomTrip(tr.id);
                          await loadDashboard();
                        }}
                      >
                        <Text style={[styles.smallBtnText, { color: '#FB7185' }]}>{t('Batal', 'Cancel')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: DRIVER HUB */}
        {tab === 'driver' && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                🛵 {t('Daftar / Kelola Pengemudi BoomBoom', 'BoomBoom Driver Registration & Hub')}
              </Text>
              <Text style={styles.mutedText}>
                {t(
                  'Pendaftaran pengemudi BoomBoom terhubung otomatis dengan akun ngopi.top Anda.',
                  'BoomBoom driver registration links directly to your ngopi.top account.'
                )}
              </Text>

              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'motor_ev', label: 'Motor EV' },
                  { id: 'car_ev', label: 'Mobil EV' },
                  { id: 'car_green', label: 'Mobil Hijau' },
                  { id: 'bike_ev', label: 'Sepeda Listrik' },
                ].map((vt) => (
                  <TouchableOpacity
                    key={vt.id}
                    style={[styles.chip, vehicleType === vt.id && styles.chipActive]}
                    onPress={() => setVehicleType(vt.id)}
                  >
                    <Text style={[styles.chipText, vehicleType === vt.id && { color: '#052E16' }]}>
                      {vt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('Plat Nomor Kendaraan', 'License Plate Number')}</Text>
              <TextInput
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
                placeholder="B 1234 EV"
                placeholderTextColor="#8B735B"
                style={styles.input}
              />

              <Text style={styles.label}>{t('Model Kendaraan & Area Layanan', 'Vehicle Model & Area')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  placeholder="Polytron Fox-R / Alva"
                  placeholderTextColor="#8B735B"
                  style={[styles.input, { flex: 1 }]}
                />
                <TextInput
                  value={serviceArea}
                  onChangeText={setServiceArea}
                  placeholder="Jabodetabek"
                  placeholderTextColor="#8B735B"
                  style={[styles.input, { flex: 1 }]}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }]}
                  disabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    setErrorMsg(null);
                    try {
                      await registerBoomBoomDriver({
                        vehicleType,
                        vehiclePlate,
                        vehicleModel,
                        serviceArea,
                        isEv: driverIsEv,
                      });
                      setSuccessMsg(t('Profil pengemudi BoomBoom tersimpan!', 'BoomBoom driver profile saved!'));
                      await loadDashboard();
                    } catch (e: any) {
                      setErrorMsg(e?.message || 'Error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Text style={styles.primaryBtnText}>
                    {dash?.driverProfile
                      ? t('Simpan Profil Driver', 'Update Driver Profile')
                      : t('Daftar Pengemudi BoomBoom', 'Register as Driver')}
                  </Text>
                </TouchableOpacity>
                {dash?.driverProfile && (
                  <TouchableOpacity
                    style={[
                      styles.smallBtn,
                      {
                        justifyContent: 'center',
                        paddingHorizontal: 14,
                        borderColor: dash.driverProfile.is_online ? '#10B981' : '#94A3B8',
                      },
                    ]}
                    onPress={async () => {
                      await toggleBoomBoomDriverOnline();
                      await loadDashboard();
                    }}
                  >
                    <Text style={styles.smallBtnText}>
                      {dash.driverProfile.is_online ? '🟢 ONLINE' : '⚫ OFFLINE'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('Order Komunitas Tersedia', 'Open Community Requests')}</Text>
              {(!dash?.openRequests || dash.openRequests.length === 0) ? (
                <Text style={styles.mutedText}>
                  {t('Belum ada permintaan tumpangan dari anggota lain saat ini.', 'No open requests from other members right now.')}
                </Text>
              ) : (
                dash.openRequests.map((reqItem: any) => (
                  <View key={reqItem.id} style={styles.itemBox}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.itemTitle}>
                        {reqItem.service_type} • {reqItem.distance_km} km
                      </Text>
                      <Text style={{ color: '#FBBF24', fontWeight: '800', fontSize: 12 }}>
                        +{reqItem.driver_points} Pts
                      </Text>
                    </View>
                    <Text style={styles.mutedText}>
                      {reqItem.pickup_address} → {reqItem.destination_address}
                    </Text>
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: '#10B981', alignSelf: 'flex-start' }]}
                      onPress={async () => {
                        try {
                          await acceptBoomBoomTrip(reqItem.id);
                          setSuccessMsg(t('Order diterima! Lihat di tab Perjalanan.', 'Order accepted! Check Trips tab.'));
                          setTab('trips');
                          await loadDashboard();
                        } catch (e: any) {
                          setErrorMsg(e?.message || 'Error');
                        }
                      }}
                    >
                      <Text style={[styles.smallBtnText, { color: '#052E16' }]}>
                        {t('Terima Order', 'Accept Order')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* TAB 4: PROPORTIONAL REWARDS */}
        {tab === 'rewards' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              ⭐ {t('Reward Poin Ngopi Proporsional', 'Proportional Ngopi Points Rewards')}
            </Text>
            <View style={styles.impactGrid}>
              <View style={styles.impactCell}>
                <Text style={styles.impactVal}>+{dash?.rewardsSummary?.passengerEarnedTotal ?? 0}</Text>
                <Text style={styles.impactLbl}>{t('Poin Penumpang', 'Passenger Pts')}</Text>
              </View>
              <View style={styles.impactCell}>
                <Text style={[styles.impactVal, { color: '#FBBF24' }]}>
                  +{dash?.rewardsSummary?.driverEarnedTotal ?? 0}
                </Text>
                <Text style={styles.impactLbl}>{t('Poin Pengemudi', 'Driver Pts')}</Text>
              </View>
            </View>
            <Text style={styles.bodyText}>
              • {t('Penumpang / Pengirim: 5 Poin Ngopi per km (min. 10 Poin).', 'Passenger / Sender: 5 Ngopi Points per km (min. 10 Pts).')}
            </Text>
            <Text style={styles.bodyText}>
              • {t('Pengemudi / Kurir: 8 Poin Ngopi per km (min. 15 Poin).', 'Driver / Courier: 8 Ngopi Points per km (min. 15 Pts).')}
            </Text>
            <Text style={styles.bodyText}>
              • {t('Bonus Kendaraan Listrik (EV): 1.5× untuk pengemudi & penumpang.', 'Electric Vehicle (EV) Bonus: 1.5× for both driver & passenger.')}
            </Text>
            <Text style={styles.bodyText}>
              • {t('Bonus Tumpangan Komunitas (BoomTogether): 1.25× ekstra.', 'Carpool Bonus (BoomTogether): extra 1.25× multiplier.')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {(
          [
            { id: 'book', icon: 'navigate', label: t('Pesan', 'Book') },
            { id: 'trips', icon: 'list', label: t('Perjalanan', 'Trips') },
            { id: 'driver', icon: 'bicycle', label: t('Pengemudi', 'Driver') },
            { id: 'rewards', icon: 'trophy', label: t('Reward', 'Rewards') },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <TouchableOpacity key={item.id} style={styles.navItem} onPress={() => setTab(item.id)}>
              <Ionicons name={item.icon as any} size={20} color={active ? '#10B981' : '#8B735B'} />
              <Text style={[styles.navText, active && { color: '#10B981', fontWeight: '900' }]}>{item.label}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1C140D',
    borderBottomWidth: 1,
    borderBottomColor: '#3D2B1F',
  },
  iconBtn: { padding: 6, borderRadius: 10, backgroundColor: '#261C15' },
  headerTitle: { color: '#34D399', fontSize: 16, fontWeight: '900' },
  headerSub: { color: '#BFA995', fontSize: 10.5 },
  langPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#261C15',
    borderWidth: 1,
    borderColor: '#4A3728',
  },
  langPillText: { color: '#D4AF37', fontSize: 11, fontWeight: '800' },
  ptsPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  ptsPillText: { color: '#34D399', fontSize: 11.5, fontWeight: '900' },
  errorBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(244,63,94,0.14)',
    borderColor: '#F43F5E',
    borderWidth: 1,
    margin: 12,
    marginBottom: 0,
    padding: 10,
    borderRadius: 10,
  },
  errorText: { color: '#FCA5A5', fontSize: 12, flex: 1 },
  successBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: '#10B981',
    borderWidth: 1,
    margin: 12,
    marginBottom: 0,
    padding: 10,
    borderRadius: 10,
  },
  successText: { color: '#6EE7B7', fontSize: 12, flex: 1 },
  content: { padding: 12, gap: 12, paddingBottom: 28 },
  card: {
    backgroundColor: '#1E1610',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3D2B1F',
    gap: 10,
  },
  sectionTitle: { color: '#F5E6D3', fontSize: 14.5, fontWeight: '900' },
  label: { color: '#D4AF37', fontSize: 12, fontWeight: '800', marginTop: 4 },
  bodyText: { color: '#E2E8F0', fontSize: 12.5, lineHeight: 18 },
  mutedText: { color: '#BFA995', fontSize: 11.5, lineHeight: 16 },
  itemTitle: { color: '#F5E6D3', fontSize: 13, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  serviceCard: {
    width: 112,
    backgroundColor: '#140F0A',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3D2B1F',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    backgroundColor: '#140F0A',
    color: '#F5E6D3',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3D2B1F',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#140F0A',
    borderWidth: 1,
    borderColor: '#3D2B1F',
  },
  chipActive: { backgroundColor: '#10B981', borderColor: '#34D399' },
  chipText: { color: '#F5E6D3', fontSize: 12, fontWeight: '800' },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#4A3728',
    backgroundColor: '#261C15',
  },
  smallBtnText: { color: '#F5E6D3', fontSize: 11.5, fontWeight: '800' },
  primaryBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#052E16', fontSize: 13.5, fontWeight: '900' },
  itemBox: {
    backgroundColor: '#140F0A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3D2B1F',
    gap: 6,
  },
  statusTag: { color: '#38BDF8', fontSize: 10.5, fontWeight: '900' },
  impactGrid: { flexDirection: 'row', gap: 10 },
  impactCell: {
    flex: 1,
    backgroundColor: '#140F0A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3D2B1F',
    alignItems: 'center',
  },
  impactVal: { color: '#34D399', fontSize: 18, fontWeight: '900' },
  impactLbl: { color: '#BFA995', fontSize: 11 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1C140D',
    borderTopWidth: 1,
    borderTopColor: '#3D2B1F',
    paddingVertical: 8,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navText: { color: '#8B735B', fontSize: 10.5, fontWeight: '700' },
});
