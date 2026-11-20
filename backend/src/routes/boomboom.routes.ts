import { Router, Response } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';
import { pointsEconomyService } from '../services/points.service';
import { earnPoints, ensureUserIdentity } from '../services/ngopinomic/ngopinomicEconomy.service';
import {
  authorizeBoomBoomIdentity,
  ensureEcosystemApps,
  setEcosystemConsent,
} from '../services/ngopinomic/ngopinomicEcosystem.service';

const router = Router();

const VALID_SERVICES = ['BoomRide', 'BoomCar', 'BoomSend', 'BoomSchedule', 'BoomTogether'] as const;

export function calculateBoomBoomQuote(
  distanceKm: number,
  isEv: boolean,
  serviceType: string
) {
  const safeKm = Math.max(0.5, Math.min(250, Number.isFinite(distanceKm) ? distanceKm : 3));
  const evMultiplier = isEv ? 1.5 : 1.0;
  const poolMultiplier = serviceType === 'BoomTogether' ? 1.25 : 1.0;

  const passengerPoints = Math.max(10, Math.round(safeKm * 5 * evMultiplier * poolMultiplier));
  const driverPoints = Math.max(15, Math.round(safeKm * 8 * evMultiplier * poolMultiplier));

  let baseFare = 3000;
  let perKm = 2500;
  if (serviceType === 'BoomCar') {
    baseFare = 7000;
    perKm = 4500;
  } else if (serviceType === 'BoomSend') {
    baseFare = 4000;
    perKm = 3000;
  } else if (serviceType === 'BoomSchedule') {
    baseFare = 5000;
    perKm = 3500;
  } else if (serviceType === 'BoomTogether') {
    baseFare = 2500;
    perKm = 1800;
  }
  const estimatedFareIdr = Math.round((baseFare + safeKm * perKm) / 500) * 500;

  return {
    distanceKm: Number(safeKm.toFixed(2)),
    estimatedFareIdr,
    passengerPoints,
    driverPoints,
    evMultiplier,
    poolMultiplier,
  };
}

// GET /api/boomboom/dashboard — Mandatory Ngopi account + identity + trips + driver profile
router.get('/dashboard', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Wajib login dengan akun ngopi.top untuk mengakses BoomBoom.' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, display_name: true, bmc_id: true },
    });
    if (!user) return res.status(404).json({ error: 'Akun Ngopi tidak ditemukan.' });

    await ensureEcosystemApps(prisma);
    const identity = await ensureUserIdentity(prisma, {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bmc_id: user.bmc_id,
    });

    const [boomApp, pointsAcc, driverProfile, myTrips, openRequests, onlineDrivers] = await Promise.all([
      prisma.ecosystemApplication.findUnique({ where: { app_code: 'boomboom' } }),
      prisma.pointsAccount.findUnique({ where: { user_id: userId } }),
      prisma.boomBoomDriverProfile.findUnique({ where: { user_id: userId } }),
      prisma.boomBoomTrip.findMany({
        where: { OR: [{ passenger_id: userId }, { driver_id: userId }] },
        orderBy: { created_at: 'desc' },
        take: 30,
      }),
      prisma.boomBoomTrip.findMany({
        where: { status: 'requested', passenger_id: { not: userId } },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      prisma.boomBoomDriverProfile.findMany({
        where: { is_online: true, status: 'active' },
        orderBy: { total_trips: 'desc' },
        take: 15,
      }),
    ]);

    const consent = boomApp
      ? await prisma.userConsent.findUnique({
          where: { user_id_app_id: { user_id: userId, app_id: boomApp.id } },
        })
      : null;

    pointsEconomyService.syncWithPointsManager(userId, user.username);
    const legacyPts = pointsEconomyService.getUserPoints(userId)?.balance ?? 0;
    const pointsBalance = Math.max(pointsAcc?.balance ?? 0, legacyPts);

    const passengerEarnedTotal = myTrips
      .filter((t) => t.status === 'completed' && t.passenger_id === userId)
      .reduce((acc, t) => acc + t.passenger_points, 0);
    const driverEarnedTotal = myTrips
      .filter((t) => t.status === 'completed' && t.driver_id === userId)
      .reduce((acc, t) => acc + t.driver_points, 0);

    return res.json({
      ok: true,
      pointsBalance,
      ngopi_identity: {
        ngopi_id: identity.ngopi_id,
        ngopi_number: identity.ngopi_number,
        ngopi_email: identity.ngopi_email,
        username: user.username,
        display_name: user.display_name,
      },
      consent_active: Boolean(consent && !consent.revoked_at && consent.granted_scopes.includes('identity:basic')),
      driverProfile,
      myTrips,
      openRequests,
      onlineDriversCount: onlineDrivers.length,
      rewardsSummary: {
        passengerEarnedTotal,
        driverEarnedTotal,
        formula: {
          passengerPerKm: 5,
          driverPerKm: 8,
          evMultiplier: 1.5,
          carpoolMultiplier: 1.25,
        },
      },
    });
  } catch (err: any) {
    console.error('GET /api/boomboom/dashboard error:', err);
    return res.status(500).json({ error: 'Gagal memuat dashboard BoomBoom.' });
  }
});

// POST /api/boomboom/consent — Activate Ngopi SSO Identity Consent for BoomBoom
router.post('/consent', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, display_name: true, bmc_id: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const requestedRole = (req.body?.requested_role || 'passenger') as any;
    await setEcosystemConsent(prisma, {
      userId,
      appCode: 'boomboom',
      grantedScopes: ['identity:basic', 'identity:email', 'boomboom:role_hint'],
    });

    const authPayload = await authorizeBoomBoomIdentity(prisma, {
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        bmc_id: user.bmc_id,
      },
      requestedRole,
      requiredScope: 'identity:basic',
    });

    return res.json({ ok: true, authPayload });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Gagal mengaktifkan integrasi BoomBoom.' });
  }
});

// POST /api/boomboom/driver/register — Register / update BoomBoom Driver (requires Ngopi account)
router.post('/driver/register', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Wajib punya akun ngopi.top untuk mendaftar BoomBoom.' });

    const vehicleType = String(req.body?.vehicleType || 'motor_ev').trim();
    const vehiclePlate = String(req.body?.vehiclePlate || '').trim().toUpperCase();
    const vehicleModel = String(req.body?.vehicleModel || '').trim() || null;
    const serviceArea = String(req.body?.serviceArea || 'Jabodetabek').trim();
    const isEv = req.body?.isEv !== false;

    if (vehiclePlate.length < 4) {
      return res.status(400).json({ error: 'Nomor plat kendaraan wajib diisi (min 4 karakter).' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, display_name: true, bmc_id: true },
    });
    if (!user) return res.status(404).json({ error: 'Akun Ngopi tidak ditemukan.' });

    const identity = await ensureUserIdentity(prisma, user);
    await setEcosystemConsent(prisma, {
      userId,
      appCode: 'boomboom',
      grantedScopes: ['identity:basic', 'identity:email', 'boomboom:role_hint'],
    });

    const driverProfile = await prisma.boomBoomDriverProfile.upsert({
      where: { user_id: userId },
      update: {
        ngopi_id: identity.ngopi_id,
        vehicle_type: vehicleType,
        vehicle_plate: vehiclePlate,
        vehicle_model: vehicleModel,
        service_area: serviceArea,
        is_ev: isEv,
        is_online: true,
      },
      create: {
        user_id: userId,
        ngopi_id: identity.ngopi_id,
        vehicle_type: vehicleType,
        vehicle_plate: vehiclePlate,
        vehicle_model: vehicleModel,
        service_area: serviceArea,
        is_ev: isEv,
        is_online: true,
      },
    });

    return res.status(201).json({ ok: true, driverProfile });
  } catch (err: any) {
    console.error('POST /api/boomboom/driver/register error:', err);
    return res.status(400).json({ error: err?.message || 'Gagal mendaftar sebagai pengemudi BoomBoom.' });
  }
});

// POST /api/boomboom/driver/toggle-online
router.post('/driver/toggle-online', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.boomBoomDriverProfile.findUnique({ where: { user_id: userId } });
    if (!existing) return res.status(404).json({ error: 'Anda belum terdaftar sebagai pengemudi BoomBoom.' });

    const updated = await prisma.boomBoomDriverProfile.update({
      where: { user_id: userId },
      data: { is_online: !existing.is_online },
    });
    return res.json({ ok: true, driverProfile: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Gagal mengubah status online.' });
  }
});

// POST /api/boomboom/trips — Create a BoomBoom ride/delivery booking
router.post('/trips', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Wajib login akun ngopi.top untuk memesan BoomBoom.' });

    const serviceType = String(req.body?.serviceType || 'BoomRide');
    if (!VALID_SERVICES.includes(serviceType as any)) {
      return res.status(400).json({ error: 'Jenis layanan BoomBoom tidak valid.' });
    }

    const pickupAddress = String(req.body?.pickupAddress || '').trim();
    const destinationAddress = String(req.body?.destinationAddress || '').trim();
    if (pickupAddress.length < 3 || destinationAddress.length < 3) {
      return res.status(400).json({ error: 'Alamat jemput dan tujuan wajib diisi.' });
    }

    const distanceKm = Number(req.body?.distanceKm || 3);
    const isEv = req.body?.isEv !== false;
    const quote = calculateBoomBoomQuote(distanceKm, isEv, serviceType);

    // Ensure user has BoomBoom SSO consent recorded automatically when booking via Ngopi
    await setEcosystemConsent(prisma, {
      userId,
      appCode: 'boomboom',
      grantedScopes: ['identity:basic', 'identity:email', 'boomboom:role_hint'],
    });

    const trip = await prisma.boomBoomTrip.create({
      data: {
        passenger_id: userId,
        service_type: serviceType,
        pickup_address: pickupAddress,
        destination_address: destinationAddress,
        pickup_lat: req.body?.pickupLat != null ? Number(req.body.pickupLat) : null,
        pickup_lng: req.body?.pickupLng != null ? Number(req.body.pickupLng) : null,
        dest_lat: req.body?.destLat != null ? Number(req.body.destLat) : null,
        dest_lng: req.body?.destLng != null ? Number(req.body.destLng) : null,
        distance_km: quote.distanceKm,
        estimated_fare_idr: quote.estimatedFareIdr,
        is_ev: isEv,
        passenger_points: quote.passengerPoints,
        driver_points: quote.driverPoints,
        notes: req.body?.notes ? String(req.body.notes).trim() : null,
        status: 'requested',
      },
    });

    return res.status(201).json({ ok: true, trip, quote });
  } catch (err: any) {
    console.error('POST /api/boomboom/trips error:', err);
    return res.status(400).json({ error: err?.message || 'Gagal membuat pesanan BoomBoom.' });
  }
});

// POST /api/boomboom/trips/:id/accept — Driver accepts trip
router.post('/trips/:id/accept', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const driver = await prisma.boomBoomDriverProfile.findUnique({ where: { user_id: userId } });
    if (!driver) {
      return res.status(403).json({ error: 'Daftar sebagai pengemudi BoomBoom terlebih dahulu.' });
    }

    const tripId = String(req.params.id || '');
    const trip = await prisma.boomBoomTrip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (trip.status !== 'requested') {
      return res.status(400).json({ error: `Pesanan sudah berstatus ${trip.status}.` });
    }
    if (trip.passenger_id === userId) {
      return res.status(400).json({ error: 'Tidak dapat menerima pesanan Anda sendiri.' });
    }

    const updated = await prisma.boomBoomTrip.update({
      where: { id: tripId },
      data: { driver_id: userId, status: 'accepted' },
    });

    return res.json({ ok: true, trip: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Gagal menerima pesanan.' });
  }
});

// POST /api/boomboom/trips/:id/complete — Complete trip & credit proportional Ngopi Points to Driver & Passenger
router.post('/trips/:id/complete', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tripId = String(req.params.id || '');
    const trip = await prisma.boomBoomTrip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (trip.passenger_id !== userId && trip.driver_id !== userId) {
      return res.status(403).json({ error: 'Anda bukan peserta perjalanan ini.' });
    }
    if (trip.status === 'completed') {
      return res.status(400).json({ error: 'Perjalanan sudah diselesaikan & poin sudah diberikan.' });
    }
    if (trip.status === 'cancelled') {
      return res.status(400).json({ error: 'Perjalanan yang dibatalkan tidak dapat diselesaikan.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const pKey = `boomboom-passenger-${trip.id}`;
      const pRes = await earnPoints(tx, {
        userId: trip.passenger_id,
        activityCode: `boomboom_passenger_${trip.service_type.toLowerCase()}`,
        amount: trip.passenger_points,
        idempotencyKey: pKey,
        description: `Reward Penumpang BoomBoom (${trip.service_type} ${trip.distance_km} km)`,
        metadata: { trip_id: trip.id, role: 'passenger', distance_km: trip.distance_km, is_ev: trip.is_ev },
      });

      let dTxId: string | null = null;
      if (trip.driver_id && trip.driver_id !== trip.passenger_id) {
        const dKey = `boomboom-driver-${trip.id}`;
        const dRes = await earnPoints(tx, {
          userId: trip.driver_id,
          activityCode: `boomboom_driver_${trip.service_type.toLowerCase()}`,
          amount: trip.driver_points,
          idempotencyKey: dKey,
          description: `Reward Pengemudi BoomBoom (${trip.service_type} ${trip.distance_km} km)`,
          metadata: { trip_id: trip.id, role: 'driver', distance_km: trip.distance_km, is_ev: trip.is_ev },
        });
        dTxId = dRes.txId;

        await tx.boomBoomDriverProfile.updateMany({
          where: { user_id: trip.driver_id },
          data: {
            total_trips: { increment: 1 },
            total_points_earned: { increment: trip.driver_points },
          },
        });
      }

      const completedTrip = await tx.boomBoomTrip.update({
        where: { id: trip.id },
        data: {
          status: 'completed',
          completed_at: new Date(),
          passenger_tx_id: pRes.txId,
          driver_tx_id: dTxId,
        },
      });

      return completedTrip;
    });

    // Sync legacy PointsEconomyService
    pointsEconomyService.syncExternalCredit(
      trip.passenger_id,
      trip.passenger_points,
      `Reward Penumpang BoomBoom (${trip.service_type} ${trip.distance_km} km)`,
      `boomboom-passenger-${trip.id}`
    );
    if (trip.driver_id && trip.driver_id !== trip.passenger_id) {
      pointsEconomyService.syncExternalCredit(
        trip.driver_id,
        trip.driver_points,
        `Reward Pengemudi BoomBoom (${trip.service_type} ${trip.distance_km} km)`,
        `boomboom-driver-${trip.id}`
      );
    }

    return res.json({
      ok: true,
      trip: result,
      passengerPointsAwarded: trip.passenger_points,
      driverPointsAwarded: trip.driver_id && trip.driver_id !== trip.passenger_id ? trip.driver_points : 0,
    });
  } catch (err: any) {
    console.error('POST /api/boomboom/trips/:id/complete error:', err);
    return res.status(400).json({ error: err?.message || 'Gagal menyelesaikan perjalanan BoomBoom.' });
  }
});

// POST /api/boomboom/trips/:id/cancel
router.post('/trips/:id/cancel', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tripId = String(req.params.id || '');
    const trip = await prisma.boomBoomTrip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (trip.passenger_id !== userId && trip.driver_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return res.status(400).json({ error: `Tidak dapat membatalkan pesanan berstatus ${trip.status}.` });
    }

    const updated = await prisma.boomBoomTrip.update({
      where: { id: tripId },
      data: { status: 'cancelled' },
    });
    return res.json({ ok: true, trip: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Gagal membatalkan pesanan.' });
  }
});

export default router;
