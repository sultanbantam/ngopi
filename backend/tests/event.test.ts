import { EventService } from '../src/services/event.service';
import { TableManager } from '../src/games/TableManager';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

async function runTests() {
  console.log('--- RUNNING SPRINT 5: GAME EVENT & INVITATION SYSTEM UNIT TESTS ---');

  // ==========================================
  // 1. EVENT CREATION & VALIDATION
  // ==========================================
  const invalidTitle = EventService.createEvent('user_host_1', 'Bang Juragan', {
    title: '',
    gameType: 'gapleh',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    invitees: [],
  });
  assert(invalidTitle.success === false, 'Event with empty title is rejected');

  const invalidDate = EventService.createEvent('user_host_1', 'Bang Juragan', {
    title: 'Turnamen Gapleh Malam Minggu',
    gameType: 'gapleh',
    scheduledAt: 'invalid-date-string',
    invitees: [],
  });
  assert(invalidDate.success === false, 'Event with invalid date is rejected');

  const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
  const createRes = EventService.createEvent('user_host_1', 'Bang Juragan', {
    title: 'Turnamen Gapleh Kampung Warkop',
    description: 'Main santai 4 orang, kopi gratis untuk pemenang!',
    gameType: 'gapleh',
    scheduledAt: futureTime,
    durationMin: 90,
    maxPlayers: 4,
    isPrivate: false,
    warungId: 'warung_blok_m',
    invitees: [
      { id: 'user_budi', name: 'Budi Santoso', message: 'Ayo main Budi!' },
      { id: 'user_siti', name: 'Siti Rahma', message: 'Tunjukkan kehebatanmu Siti!' },
    ],
  });

  assert(createRes.success === true, 'Event created successfully');
  const event = createRes.event!;
  assert(event.title === 'Turnamen Gapleh Kampung Warkop', 'Event title is preserved');
  assert(event.hostId === 'user_host_1', 'Host ID is user_host_1');
  assert(event.hostName === 'Bang Juragan', 'Host Name is Bang Juragan');
  assert(event.gameType === 'gapleh', 'Game type is gapleh');
  assert(event.status === 'scheduled', 'Initial status is scheduled');
  assert(event.invitations.length === 2, '2 invitations created');
  assert(event.invitations[0]?.inviteeId === 'user_budi', 'First invitee is user_budi');
  assert(event.invitations[0]?.status === 'pending', 'Initial invitation status is pending');

  // ==========================================
  // 2. QUERYING EVENTS (HOST & INVITEE)
  // ==========================================
  const hostEvents = EventService.getMyEvents('user_host_1');
  assert(hostEvents.some((e) => e.id === event.id), 'Host can retrieve their event');

  const budiInvited = EventService.getInvitedEvents('user_budi');
  assert(budiInvited.some((item) => item.event.id === event.id), 'Budi finds the event in their invitations');

  const sitiInvited = EventService.getInvitedEvents('user_siti');
  assert(sitiInvited.some((item) => item.event.id === event.id), 'Siti finds the event in their invitations');

  const singleEvent = EventService.getEventById(event.id);
  assert(singleEvent !== undefined, 'Event found by ID');
  assert(singleEvent?.durationMin === 90, 'Duration is 90 minutes');

  // ==========================================
  // 3. RESPONDING TO INVITATIONS
  // ==========================================
  // Uninvited user cannot respond
  const uninvitedRes = EventService.respondInvitation(event.id, 'user_unknown', 'accepted');
  assert(uninvitedRes.success === false, 'Uninvited user cannot respond to invitation');

  // Budi accepts
  const budiAcceptRes = EventService.respondInvitation(event.id, 'user_budi', 'accepted');
  assert(budiAcceptRes.success === true, 'Budi accepted invitation');
  assert(budiAcceptRes.invitation?.status === 'accepted', 'Budi invitation status is accepted');
  assert(budiAcceptRes.invitation?.respondedAt !== null, 'RespondedAt timestamp is set');

  // Siti declines
  const sitiDeclineRes = EventService.respondInvitation(event.id, 'user_siti', 'declined');
  assert(sitiDeclineRes.success === true, 'Siti declined invitation');
  assert(sitiDeclineRes.invitation?.status === 'declined', 'Siti invitation status is declined');

  // ==========================================
  // 4. EVENT START & AUTO-TABLE CREATION
  // ==========================================
  // Non-host cannot start event
  const nonHostStart = await EventService.startEvent(event.id, 'user_budi');
  assert(nonHostStart.success === false, 'Non-host cannot start event');

  // Host starts event
  const hostStart = await EventService.startEvent(event.id, 'user_host_1');
  assert(hostStart.success === true, 'Host successfully started event');
  assert(typeof hostStart.tableId === 'string', 'Table ID is generated and returned');
  assert(hostStart.event?.status === 'ongoing', 'Event status transitioned to ongoing');
  assert(hostStart.event?.tableId === hostStart.tableId, 'tableId saved on event model');

  // Verify table actually exists in TableManager
  const createdTable = TableManager.getTable(hostStart.tableId!);
  assert(createdTable !== null, 'Game table exists in TableManager');
  assert(createdTable?.game_type === 'gapleh', 'Table game type matches event game type');
  assert(createdTable?.name.includes('Turnamen Gapleh') === true, 'Table name includes event title');

  // ==========================================
  // 5. CANCELLATION & REMINDERS
  // ==========================================
  const cancelEvtRes = EventService.createEvent('user_host_2', 'Host 2', {
    title: 'Event yang Dibatalkan',
    gameType: 'uno',
    scheduledAt: new Date(Date.now() + 7200000).toISOString(),
    invitees: [],
  });
  const cancelEvt = cancelEvtRes.event!;

  const cancelFailed = EventService.cancelEvent(cancelEvt.id, 'user_not_host');
  assert(cancelFailed.success === false, 'Stranger cannot cancel event');

  const cancelSuccess = EventService.cancelEvent(cancelEvt.id, 'user_host_2');
  assert(cancelSuccess.success === true, 'Host can cancel event');
  assert(cancelSuccess.event?.status === 'cancelled', 'Event status is cancelled');

  // Reminder check
  const reminderEvt = EventService.createEvent('user_host_3', 'Host 3', {
    title: 'Event Menjelang Mulai',
    gameType: 'monopoly',
    scheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
    invitees: [{ id: 'user_tester', name: 'Tester', message: 'Siap-siap ya' }],
  });
  EventService.respondInvitation(reminderEvt.event!.id, 'user_tester', 'accepted');

  const reminders = EventService.checkReminders();
  assert(typeof reminders === 'number', 'checkReminders returns number of reminders checked');

  console.log('--- ALL SPRINT 5 GAME EVENT TESTS PASSED SUCCESSFULLY! (100% PASS) ---');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
