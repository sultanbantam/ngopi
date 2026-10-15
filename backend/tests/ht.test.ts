import assert from 'assert';
import { AcousticModem } from '../src/ht/acousticModem.service';
import { APRSService } from '../src/ht/aprs.service';
import { SerialHTService } from '../src/ht/serialHT.service';
import { HTManagerService } from '../src/ht/htManager.service';

function runHTUnitTests() {
  console.log('--- RUNNING NGOPI HT (HANDY TALKY) & RADIO AMATIR UNIT TESTS ---');

  // TEST 1: CRC-16 CCITT
  console.log('Test 1: CRC-16 CCITT Calculation');
  const testData = new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]); // "123456789"
  const crc = AcousticModem.calculateCRC16(testData);
  assert.strictEqual(crc, 0x29B1, 'Standard CRC-16 CCITT for 123456789 is 0x29B1');
  console.log('  ✅ PASS: CRC-16 CCITT calculation verified');

  // TEST 2: AFSK 1200/2200 Hz Audio Modulation (Text to Samples & WAV)
  console.log('Test 2: AFSK Modulation & WAV Buffer Generation');
  const textMsg = 'NGOPI HT 144.390';
  const samples = AcousticModem.encodeTextToSamples(textMsg);
  assert.ok(samples.length > 0, 'Audio samples generated');
  assert.ok(samples.length > textMsg.length * 8 * 15, 'Sufficient audio sample length for 1200 baud');

  const wavBuffer = AcousticModem.samplesToWav(samples, 22050);
  assert.ok(wavBuffer.length > 44, 'Valid WAV buffer with RIFF header generated');
  assert.strictEqual(wavBuffer.toString('ascii', 0, 4), 'RIFF', 'RIFF header present');
  assert.strictEqual(wavBuffer.toString('ascii', 8, 12), 'WAVE', 'WAVE format present');

  const dataUrl = AcousticModem.encodeToWavDataUrl(textMsg);
  assert.ok(dataUrl.startsWith('data:audio/wav;base64,'), 'Playable base64 audio data URL generated');
  console.log('  ✅ PASS: AFSK modulation and WAV audio synthesis verified');

  // TEST 3: AFSK Demodulation & Audio Loopback
  console.log('Test 3: AFSK Demodulation & Loopback');
  const shortMsg = 'WARKOP';
  const shortSamples = AcousticModem.encodeTextToSamples(shortMsg);
  const decodedText = AcousticModem.decodeSamplesToText(shortSamples);
  assert.strictEqual(decodedText, shortMsg, 'Decoded message exactly matches original text through AFSK loopback');
  console.log('  ✅ PASS: AFSK 1200/2200Hz loopback demodulation verified');

  // TEST 4: APRS Coordinate Formatting & Parsing
  console.log('Test 4: APRS Coordinate Transformations');
  // Jakarta Warkop: -6.2088 S, 106.8456 E
  const { latStr, lonStr } = APRSService.formatCoordinates(-6.2088, 106.8456);
  assert.ok(latStr.endsWith('S'), 'Southern hemisphere formatted with S');
  assert.ok(lonStr.endsWith('E'), 'Eastern hemisphere formatted with E');
  assert.strictEqual(latStr.slice(0, 2), '06', 'Degrees formatted with 2 digits');
  assert.strictEqual(lonStr.slice(0, 3), '106', 'Degrees formatted with 3 digits');

  const parsedCoords = APRSService.parseCoordinates(latStr, lonStr);
  assert.ok(parsedCoords, 'Coordinates parsed successfully');
  assert.ok(Math.abs(parsedCoords.latitude - (-6.2088)) < 0.01, 'Latitude within 0.01 deg');
  assert.ok(Math.abs(parsedCoords.longitude - 106.8456) < 0.01, 'Longitude within 0.01 deg');
  console.log('  ✅ PASS: APRS coordinate conversion and parsing verified');

  // TEST 5: APRS Packet Construction & Parsing
  console.log('Test 5: APRS Message, Position, and Emergency Packet');
  // Directed message
  const msgPkt = APRSService.buildMessagePacket({
    sourceCall: 'YB1NGO',
    sourceSsid: '7',
    addresseeCall: 'YC0BAM',
    message: 'Halo kawan warkop!',
  });
  assert.ok(msgPkt.startsWith('YB1NGO-7>APNGO1'), 'Correct APRS header');
  assert.ok(msgPkt.includes('::YC0BAM   :Halo kawan warkop!'), 'Correct directed message body');

  const parsedMsg = APRSService.parsePacket(msgPkt);
  assert.ok(parsedMsg, 'Parsed message packet');
  assert.strictEqual(parsedMsg?.sourceCall, 'YB1NGO', 'Source call matches');
  assert.strictEqual(parsedMsg?.sourceSsid, '7', 'Source SSID matches');
  assert.strictEqual(parsedMsg?.addressee, 'YC0BAM', 'Addressee matches');
  assert.strictEqual(parsedMsg?.messageText, 'Halo kawan warkop!', 'Message text matches');

  // Emergency SOS packet
  const sosPkt = APRSService.buildEmergencyPacket({
    sourceCall: 'YB1NGO',
    latitude: -6.2088,
    longitude: 106.8456,
    emergencyText: 'Banjir bandang, butuh evakuasi perahu karet!',
  });
  assert.ok(sosPkt.includes('!EMERGENCY SOS:'), 'Contains emergency flag');
  const parsedSos = APRSService.parsePacket(sosPkt);
  assert.ok(parsedSos, 'Parsed emergency packet');
  assert.ok(parsedSos.messageText?.includes('Banjir bandang'), 'Distress text preserved');
  console.log('  ✅ PASS: APRS packet encoding and decoding verified');

  // TEST 6: Hardware Dongle Serial Protocol (kv4p Controller)
  console.log('Test 6: Serial HT Hardware Controller');
  const serial = new SerialHTService();
  const c1 = serial.processCommand('CONNECT COM_RADIO_01');
  assert.strictEqual(c1.success, true, 'Connected to dongle');
  assert.strictEqual(c1.state.connected, true, 'State connected is true');

  const c2 = serial.processCommand('FREQ 144.500');
  assert.strictEqual(c2.success, true, 'Frequency changed');
  assert.strictEqual(c2.state.frequency, 144.500, 'State frequency is 144.500 MHz');

  const c3 = serial.processCommand('PTT ON');
  assert.strictEqual(c3.state.pttActive, true, 'PTT activated');

  const c4 = serial.processCommand('PTT OFF');
  assert.strictEqual(c4.state.pttActive, false, 'PTT deactivated');

  const c5 = serial.processCommand('POWER 2.5');
  assert.strictEqual(c5.state.powerWatts, 2.5, 'Power updated to 2.5W');

  const cInvalid = serial.processCommand('FREQ 999.000');
  assert.strictEqual(cInvalid.success, false, 'Out of band frequency rejected');
  console.log('  ✅ PASS: Hardware dongle serial protocol commands verified');

  // TEST 7: HT Manager Service (Profiles, Transmission & Legal Logging)
  console.log('Test 7: HT Manager Profiles & Transmission');
  const htMgr = new HTManagerService();
  htMgr.resetForTesting();

  // Create Profile
  const p1 = htMgr.getOrCreateProfile('user_andi', 'YB1AND');
  assert.strictEqual(p1.callsign, 'YB1AND', 'Profile created with callsign');
  assert.strictEqual(p1.default_freq, 144.390, 'Default frequency is 144.390 MHz');

  // Update Profile with ORARI license
  const pUpdated = htMgr.updateProfile('user_andi', {
    license_type: 'ORARI',
    license_number: 'IAR-123456',
    disclaimer_accepted: true,
    power_watts: 2.0,
  });
  assert.strictEqual(pUpdated.license_type, 'ORARI', 'License type updated');
  assert.strictEqual(pUpdated.disclaimer_accepted, true, 'Legal disclaimer accepted');

  // Prepare Transmission
  const tx = htMgr.prepareTransmission({
    userId: 'user_andi',
    content: 'Nongkrong di Warkop Babakan sambil main catur',
    freq: 144.500,
    protocol: 'AFSK',
  });
  assert.ok(tx.message.id.startsWith('htm_'), 'Message ID created');
  assert.ok(tx.audioDataUrl.startsWith('data:audio/wav;base64,'), 'Playable AFSK audio URL generated');
  assert.strictEqual(tx.log.callsign, 'YB1AND', 'Transmission logged with operator callsign');
  assert.strictEqual(tx.log.freq_mhz, 144.500, 'Transmission logged with exact frequency');

  // Verify transmission audit trail
  const logs = htMgr.getTransmissionLogs('user_andi');
  assert.strictEqual(logs.length, 1, 'One audit record present');
  assert.ok(logs[0]?.hash, 'Audit record has immutable SHA-256 integrity hash');
  console.log('  ✅ PASS: HT Manager profile, transmission, and legal audit trail verified');

  // TEST 8: Store-and-Forward Sync
  console.log('Test 8: Store-and-Forward Offline Batch Sync');
  const offlineMsgs = [
    {
      id: 'htm_offline_1',
      sender_id: 'user_andi',
      sender_callsign: 'YB1AND',
      content: 'Pesan dari jalur pendakian Gunung Salak (Offline)',
      freq: 144.390,
      protocol: 'APRS' as const,
      status: 'pending' as const,
      created_at: Date.now() - 3600000,
    },
  ];

  const syncRes = htMgr.syncOfflineBatch(offlineMsgs as any);
  assert.strictEqual(syncRes.received, 1, '1 offline message synced');
  const stored = htMgr.getMessages({ userId: 'user_andi' });
  assert.ok(stored.some(m => m.id === 'htm_offline_1'), 'Offline message now in server store');
  console.log('  ✅ PASS: Store-and-forward batch sync verified');

  // TEST 9: Warung HT Channels / Groups
  console.log('Test 9: Warung HT Radio Channels');
  const groups = htMgr.listGroups();
  assert.ok(groups.length >= 4, 'Includes standard Indonesian emergency and APRS frequencies');
  assert.ok(groups.some(g => g.freq === 144.390), 'APRS 144.390 MHz channel present');
  assert.ok(groups.some(g => g.freq === 145.000), 'ORARI Emergency 145.000 MHz channel present');
  console.log('  ✅ PASS: Pre-seeded Indonesian HT channels verified');

  console.log('\n======================================================');
  console.log('🎉 ALL NGOPI HT (HANDY TALKY) TESTS PASSED SUCCESSFULLY! (100% PASS)');
  console.log('======================================================\n');
}

runHTUnitTests();
