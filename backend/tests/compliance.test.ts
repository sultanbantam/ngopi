import assert from 'assert';
import { ComplianceService, CURRENT_POLICY_VERSION, DPO_EMAIL, CONTROLLER_NAME } from '../src/services/compliance.service';

async function runComplianceTests() {
  console.log('--- RUNNING SPRINT 8: KEPATUHAN REGULASI (UU PDP, PSE, ISO 27001) UNIT TESTS ---');

  const compliance = new ComplianceService();
  compliance.resetForTesting();

  // TEST 1: Initial Consent Check
  console.log('Test 1: Initial Consent Status');
  const initialStatus = compliance.getConsentStatus('user_bambang_01');
  assert.strictEqual(initialStatus.has_consented, false, 'Initial user has not consented');
  assert.strictEqual(initialStatus.needs_reconsent, true, 'User needs to consent');
  assert.strictEqual(initialStatus.record, null, 'No consent record exists yet');
  console.log('  ✅ PASS: Initial consent status correctly reported as false');

  // TEST 2: Record User Consent (UU PDP Pasal 20 & 22)
  console.log('Test 2: Record User Consent');
  const consentRecord = compliance.recordConsent({
    userId: 'user_bambang_01',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  });
  assert.strictEqual(consentRecord.user_id, 'user_bambang_01', 'User ID matches');
  assert.strictEqual(consentRecord.has_consented, true, 'Consent is true');
  assert.strictEqual(consentRecord.policy_version, CURRENT_POLICY_VERSION, 'Policy version matches');
  assert.ok(consentRecord.consented_at.length > 0, 'Consent timestamp recorded');

  const updatedStatus = compliance.getConsentStatus('user_bambang_01');
  assert.strictEqual(updatedStatus.has_consented, true, 'Consent status updated');
  assert.strictEqual(updatedStatus.needs_reconsent, false, 'No re-consent needed for current version');
  console.log('  ✅ PASS: Consent recorded with timestamp and version');

  // TEST 3: Outdated Policy Re-consent Detection
  console.log('Test 3: Re-consent Trigger on Policy Version Change');
  compliance.recordConsent({
    userId: 'user_old_policy',
    policyVersion: 'v1.0-2024', // Old policy
  });
  const oldStatus = compliance.getConsentStatus('user_old_policy');
  assert.strictEqual(oldStatus.has_consented, true, 'User consented to old policy');
  assert.strictEqual(oldStatus.needs_reconsent, true, 'Re-consent flagged due to version difference');
  console.log('  ✅ PASS: Policy update triggers re-consent requirement');

  // TEST 4: Data Export (Hak Portabilitas Data UU PDP Pasal 7 & 8)
  console.log('Test 4: Data Export (Hak Akses & Portabilitas Data)');
  const exportedData = await compliance.exportUserData('user_bambang_01', 'Bambang Warkop', '192.168.1.100');
  assert.ok(exportedData.export_metadata.export_id.startsWith('exp_'), 'Export ID generated');
  assert.strictEqual(exportedData.export_metadata.controller, CONTROLLER_NAME, 'Controller name matches');
  assert.ok(exportedData.export_metadata.regulatory_framework.includes('UU No. 27/2022'), 'Cites UU PDP 27/2022');
  assert.strictEqual(exportedData.profile.user_id, 'user_bambang_01', 'Profile user ID matches');
  assert.strictEqual(exportedData.consents?.has_consented, true, 'Consent record included in export');
  assert.ok(typeof exportedData.points_economy.balance === 'number', 'Points balance included');
  assert.ok(typeof exportedData.pokemon_tcg.cards_count === 'number', 'Pokemon card count included');
  assert.ok(Array.isArray(exportedData.game_events.hosted_events), 'Game events array included');
  assert.ok(exportedData.chats_metadata.note.includes('E2EE'), 'E2EE notice included in chat metadata');
  console.log('  ✅ PASS: Full JSON data export generated according to UU PDP standards');

  // TEST 5: Right to be Forgotten / Deletion Grace Period (UU PDP Pasal 9)
  console.log('Test 5: Account Deletion with 30-Day Grace Period');
  const deleteReq = compliance.requestAccountDeletion({
    userId: 'user_bambang_01',
    reason: 'Pindah ke luar negeri',
    ipAddress: '192.168.1.100',
  });
  assert.strictEqual(deleteReq.user_id, 'user_bambang_01', 'User ID matches');
  assert.strictEqual(deleteReq.status, 'pending_deletion', 'Status is pending_deletion');
  assert.strictEqual(deleteReq.grace_period_days, 30, 'Grace period is exactly 30 days');

  const purgeDate = new Date(deleteReq.scheduled_purge_at).getTime();
  const now = Date.now();
  const diffDays = Math.round((purgeDate - now) / (1000 * 60 * 60 * 24));
  assert.strictEqual(diffDays, 30, 'Scheduled purge date is ~30 days in future');

  const checkStatus = compliance.getDeletionStatus('user_bambang_01');
  assert.strictEqual(checkStatus?.status, 'pending_deletion', 'Deletion status queryable');
  console.log('  ✅ PASS: 30-day grace period account deletion scheduled');

  // TEST 6: Cancel Account Deletion during Grace Period
  console.log('Test 6: Cancel Account Deletion');
  const cancelSuccess = compliance.cancelAccountDeletion('user_bambang_01', '192.168.1.100');
  assert.strictEqual(cancelSuccess, true, 'Cancellation succeeded');
  assert.strictEqual(compliance.getDeletionStatus('user_bambang_01')?.status, 'cancelled', 'Status changed to cancelled');

  const secondCancel = compliance.cancelAccountDeletion('user_bambang_01');
  assert.strictEqual(secondCancel, false, 'Cannot cancel already cancelled request');
  console.log('  ✅ PASS: Cancellation during grace period restores account state');

  // TEST 7: Audit Trail Logging (ISO 27001 A.8.16)
  console.log('Test 7: Audit Trail Logs');
  const logs = compliance.getAuditLogs('user_bambang_01');
  assert.ok(logs.length >= 4, 'At least 4 audit logs recorded for user actions');
  const actions = logs.map(l => l.action);
  assert.ok(actions.includes('CONSENT_GRANTED'), 'CONSENT_GRANTED logged');
  assert.ok(actions.includes('DATA_EXPORT'), 'DATA_EXPORT logged');
  assert.ok(actions.includes('ACCOUNT_DELETE_REQUESTED'), 'ACCOUNT_DELETE_REQUESTED logged');
  assert.ok(actions.includes('ACCOUNT_DELETE_CANCELLED'), 'ACCOUNT_DELETE_CANCELLED logged');
  console.log('  ✅ PASS: Immutable audit trail records security and privacy events');

  // TEST 8: Data Breach Notification (UU PDP Pasal 46: 3x24 Jam Deadline)
  console.log('Test 8: Data Breach Notification (3x24 Jam Deadline)');
  const breach = compliance.reportSecurityIncident({
    severity: 'HIGH',
    description: 'Percobaan akses unauthorized credential stuffing terdeteksi dan diisolasi',
    affectedCount: 5,
  });
  assert.ok(breach.incident_id.startsWith('inc_'), 'Incident ID generated');
  assert.strictEqual(breach.severity, 'HIGH', 'Severity matches');
  assert.strictEqual(breach.dpo_contact, DPO_EMAIL, 'DPO contact is dpo@ngopi.top');

  const detectTime = new Date(breach.detected_at).getTime();
  const deadlineTime = new Date(breach.notification_deadline_kominfo).getTime();
  const diffHours = Math.round((deadlineTime - detectTime) / (1000 * 60 * 60));
  assert.strictEqual(diffHours, 72, 'Kominfo notification deadline is exactly 72 hours (3x24 jam)');
  console.log('  ✅ PASS: 3x24 jam breach notification timer and DPO contact verified');

  console.log('--- ALL SPRINT 8 KEPATUHAN REGULASI UNIT TESTS PASSED (100% PASS) ---');
}

runComplianceTests();
