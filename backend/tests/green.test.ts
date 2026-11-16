import assert from 'node:assert/strict';
import { calculateGreenImpact } from '../src/services/green/greenImpact.service';
import {
  calculateEligibleRewardPoints,
  createGreenSubmission,
  verifyGreenSubmission,
} from '../src/services/green/greenSubmission.service';

async function runTests() {
  // 1. Carbon & Impact Engine tests
  const walkNoBaseline = calculateGreenImpact({
    categoryCode: 'mobility',
    activityTypeCode: 'mobility_walk_cycle',
    quantity: 5,
    unit: 'km',
    metadata: { replaced_private_trip: false },
    factor: {
      code: 'ef_walk_cycle_v1',
      version: 'v1.0-2026',
      factor_kgco2e_per_unit: '0.000000',
      baseline_factor_kgco2e_unit: '0.110000',
      confidence: 'estimated',
      methodology: 'zero_tailpipe_vs_disclosed_baseline',
    },
  });
  assert.equal(walkNoBaseline.actual_emissions_kgco2e, '0.0000');
  assert.equal(walkNoBaseline.avoided_emissions_kgco2e, null);

  const walkWithBaseline = calculateGreenImpact({
    categoryCode: 'mobility',
    activityTypeCode: 'mobility_walk_cycle',
    quantity: 5,
    unit: 'km',
    metadata: { replaced_private_trip: true },
    factor: {
      code: 'ef_walk_cycle_v1',
      version: 'v1.0-2026',
      factor_kgco2e_per_unit: '0.000000',
      baseline_factor_kgco2e_unit: '0.110000',
      confidence: 'estimated',
      methodology: 'zero_tailpipe_vs_disclosed_baseline',
    },
  });
  assert.equal(walkWithBaseline.avoided_emissions_kgco2e, '0.5500');

  const plantImpact = calculateGreenImpact({
    categoryCode: 'planting',
    activityTypeCode: 'planting_native_conservation',
    quantity: 3,
    unit: 'plant',
  });
  assert.equal(plantImpact.sequestered_carbon_kgco2e, null);
  assert.equal(plantImpact.data_quality, 'not_calculated');

  const energyImpact = calculateGreenImpact({
    categoryCode: 'energy_water',
    activityTypeCode: 'energy_kwh_saving',
    quantity: 10,
    unit: 'kwh',
    factor: {
      code: 'ef_electricity_id_v1',
      version: 'v1.0-2026',
      factor_kgco2e_per_unit: '0.000000',
      baseline_factor_kgco2e_unit: '0.800000',
      confidence: 'calculated',
      methodology: 'grid_kwh_saved',
    },
  });
  assert.equal(energyImpact.energy_saved_kwh, '10.0000');
  assert.equal(energyImpact.avoided_emissions_kgco2e, '8.0000');

  // 2. Reward rule calculation tests
  assert.equal(
    calculateEligibleRewardPoints(500, true, {
      base_points: 1,
      unit_step: '100.00',
      max_points_per_submission: 25,
      is_active: true,
    }),
    5
  );
  assert.equal(
    calculateEligibleRewardPoints(100, false, {
      base_points: 10,
      unit_step: '1.00',
      max_points_per_submission: 50,
      is_active: true,
    }),
    0
  );

  // 3. Mock DB submission, validation, duplicate detection, idempotent approval & reversal
  const state = {
    submissions: [] as any[],
    evidences: [] as any[],
    impacts: [] as any[],
    verifications: [] as any[],
    auditLogs: [] as any[],
    pointsAccounts: new Map<string, { id: string; user_id: string; balance: number; total_earned: number }>(),
    pointsTxs: [] as any[],
  };

  const mockDb: any = {
    $transaction: async (fn: any) => fn(mockDb),
    greenActivityType: {
      findUnique: async ({ where }: any) => {
        if (where.code === 'waste_ecobrick') {
          return {
            code: 'waste_ecobrick',
            category_code: 'waste',
            unit: 'gram',
            requires_evidence: true,
            is_green_eligible: true,
            is_active: true,
          };
        }
        return null;
      },
    },
    greenEmissionFactor: { findFirst: async () => null },
    greenRewardRule: {
      findUnique: async ({ where }: any) => {
        if (where.activity_type_code === 'waste_ecobrick') {
          return {
            activity_type_code: 'waste_ecobrick',
            base_points: 1,
            unit_step: '100.00',
            max_points_per_submission: 25,
            daily_cap_points: 50,
            is_active: true,
          };
        }
        return null;
      },
    },
    greenEvidence: {
      findFirst: async ({ where }: any) =>
        state.evidences.find((e) => where.sha256_hash.in.includes(e.sha256_hash)) || null,
      create: async ({ data }: any) => {
        const row = { id: `ev_${state.evidences.length + 1}`, ...data };
        state.evidences.push(row);
        return row;
      },
    },
    greenSubmission: {
      create: async ({ data }: any) => {
        const row = { id: `sub_${state.submissions.length + 1}`, points_tx_id: null, ...data };
        state.submissions.push(row);
        return row;
      },
      findUnique: async ({ where }: any) =>
        state.submissions.find((s) => s.id === where.id) || null,
      findMany: async () =>
        state.submissions.filter((s) => s.status === 'verified'),
      update: async ({ where, data }: any) => {
        const idx = state.submissions.findIndex((s) => s.id === where.id);
        state.submissions[idx] = { ...state.submissions[idx], ...data };
        return state.submissions[idx];
      },
    },
    greenImpactRecord: {
      create: async ({ data }: any) => {
        state.impacts.push(data);
        return data;
      },
    },
    greenVerification: {
      create: async ({ data }: any) => {
        state.verifications.push(data);
        return data;
      },
    },
    greenAuditLog: {
      create: async ({ data }: any) => {
        state.auditLogs.push(data);
        return data;
      },
    },
    pointsTransaction: {
      findUnique: async ({ where }: any) =>
        state.pointsTxs.find((t) => t.idempotency_key === where.idempotency_key) || null,
      findMany: async ({ where }: any) =>
        state.pointsTxs.filter((t) => t.user_id === where.user_id && t.tx_type === where.tx_type),
      create: async ({ data }: any) => {
        const tx = { id: `ptx_${state.pointsTxs.length + 1}`, created_at: new Date(), ...data };
        state.pointsTxs.push(tx);
        return tx;
      },
    },
    pointsAccount: {
      findUnique: async ({ where }: any) => state.pointsAccounts.get(where.user_id) || null,
      create: async ({ data }: any) => {
        const acc = { id: `pa_${data.user_id}`, balance: 0, total_earned: 0, ...data };
        state.pointsAccounts.set(data.user_id, acc);
        return acc;
      },
      update: async ({ where, data }: any) => {
        for (const [k, v] of state.pointsAccounts.entries()) {
          if (v.id === where.id) {
            const updated = { ...v, ...data };
            state.pointsAccounts.set(k, updated);
            return updated;
          }
        }
        return null;
      },
    },
    fraudEvent: { create: async () => ({}) },
  };

  // Reject disallowed ecobrick filler
  await assert.rejects(
    createGreenSubmission(mockDb, {
      userId: 'u1',
      activityTypeCode: 'waste_ecobrick',
      title: 'Bad Ecobrick',
      quantity: 300,
      metadata: { material_type: 'paper', bottle_capacity_ml: 600 },
      evidences: [{ fileUrl: '/u/1.jpg', fileName: '1.jpg', mimeType: 'image/jpeg', fileSize: 100 }],
    }),
    /cannot be submitted as ecobrick filler/
  );

  // Reject missing evidence
  await assert.rejects(
    createGreenSubmission(mockDb, {
      userId: 'u1',
      activityTypeCode: 'waste_ecobrick',
      title: 'No Evidence Ecobrick',
      quantity: 300,
      metadata: { material_type: 'PET', bottle_capacity_ml: 600 },
      evidences: [],
    }),
    /evidence upload is required/
  );

  // Valid submission
  const sub = await createGreenSubmission(mockDb, {
    userId: 'u1',
    activityTypeCode: 'waste_ecobrick',
    title: 'Ecobrick 600ml PET',
    quantity: 300,
    metadata: { material_type: 'PET', bottle_capacity_ml: 600 },
    evidences: [
      {
        fileUrl: '/api/upload/private/u1/eco.jpg',
        fileName: 'eco.jpg',
        mimeType: 'image/jpeg',
        fileSize: 2048,
        sha256Hash: 'hash_abc',
      },
    ],
  });
  assert.equal(sub.status, 'pending');
  assert.equal(sub.awarded_points, 0);

  // Admin verify -> awards 3 points (300g / 100g * 1)
  const v1 = await verifyGreenSubmission(mockDb, {
    submissionId: sub.id,
    reviewerUserId: 'admin_1',
    decision: 'verified',
    reason: 'Foto botol dan timbangan valid',
  });
  assert.equal(v1.awardedPoints, 3);
  assert.equal(v1.idempotent, false);
  assert.equal(state.pointsAccounts.get('u1')?.balance, 3);

  // Repeated approval -> idempotent, balance remains 3
  const v2 = await verifyGreenSubmission(mockDb, {
    submissionId: sub.id,
    reviewerUserId: 'admin_1',
    decision: 'verified',
    reason: 'Retry click',
  });
  assert.equal(v2.idempotent, true);
  assert.equal(state.pointsAccounts.get('u1')?.balance, 3);

  // Reversal -> balance returns to 0 with compensating tx
  const rev = await verifyGreenSubmission(mockDb, {
    submissionId: sub.id,
    reviewerUserId: 'admin_1',
    decision: 'reversed',
    reason: 'Koreksi audit',
  });
  assert.equal(rev.submission.status, 'reversed');
  assert.equal(state.pointsAccounts.get('u1')?.balance, 0);
  assert.equal(state.auditLogs.length, 2);

  console.log('ALL_NGOPI_GREEN_BACKEND_TESTS_PASS');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
