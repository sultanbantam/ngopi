import assert from 'assert';
import { MeshNetworkService } from '../src/services/mesh.service';
import { MeshPacket, SyncBatchRequest } from '../src/models/mesh.types';

function runMeshTests() {
  console.log('--- RUNNING SPRINT 6: BLUETOOTH MESH OFFLINE NETWORKING UNIT TESTS ---');

  const mesh = new MeshNetworkService();
  mesh.resetForTesting();

  // TEST 1: Peer Discovery & Registration
  console.log('Test 1: Peer Discovery & Registration');
  const peerA = mesh.registerOrUpdatePeer({
    peer_id: 'peer_warung_01',
    display_name: 'Budi Santoso',
    public_key: 'pubkey_budi_1234567890abcdef',
    hop_count: 1,
    signal_strength: 92,
  });
  assert.strictEqual(peerA.peer_id, 'peer_warung_01', 'Peer ID registered');
  assert.strictEqual(peerA.display_name, 'Budi Santoso', 'Display name saved');
  assert.strictEqual(peerA.hop_count, 1, 'Hop count is 1 (direct neighbor)');
  assert.strictEqual(peerA.verified, false, 'Initial verified status is false');
  console.log('  ✅ PASS: Peer registered successfully');

  // TEST 2: Multi-Peer Sorting & Lookup
  console.log('Test 2: Multi-Peer Sorting');
  mesh.registerOrUpdatePeer({
    peer_id: 'peer_warung_02',
    display_name: 'Siti Rohmah',
    public_key: 'pubkey_siti_abcdef1234567890',
    hop_count: 2,
    signal_strength: 65,
  });
  const peers = mesh.getPeers();
  assert.strictEqual(peers.length, 2, 'Two peers registered');
  assert.strictEqual(peers[0].peer_id, 'peer_warung_01', 'Direct 1-hop peer ordered first');
  assert.strictEqual(peers[1].peer_id, 'peer_warung_02', '2-hop peer ordered second');
  console.log('  ✅ PASS: Peers retrieved and sorted by hop proximity');

  // TEST 3: Peer Verification (QR Code Fingerprint)
  console.log('Test 3: Peer Verification via QR Code Fingerprint');
  const fingerprint = mesh.generatePeerVerificationFingerprint('pubkey_budi_1234567890abcdef');
  assert.ok(fingerprint.length >= 16, 'Fingerprint generated');
  assert.ok(fingerprint.includes('-'), 'Fingerprint has human-readable grouping dashes');

  const wrongVerify = mesh.verifyPeer('peer_warung_01', 'WRONG-CODE-0000');
  assert.strictEqual(wrongVerify, false, 'Mismatched fingerprint fails verification');

  const correctVerify = mesh.verifyPeer('peer_warung_01', fingerprint);
  assert.strictEqual(correctVerify, true, 'Valid fingerprint succeeds verification');
  const updatedPeerA = mesh.getPeer('peer_warung_01');
  assert.strictEqual(updatedPeerA?.verified, true, 'Peer A marked as verified');
  console.log('  ✅ PASS: Peer QR fingerprint verification verified');

  // TEST 4: Packet Creation
  console.log('Test 4: Packet Creation');
  const packet1 = mesh.createPacket({
    senderId: 'peer_node_me',
    senderName: 'Anto Kopi',
    recipientId: 'peer_warung_01',
    type: 'CHAT_MESSAGE',
    payload: 'enc_ciphertext_kopi_susu_123',
    publicKey: 'pubkey_anto',
  });
  assert.ok(packet1.packet_id.startsWith('pkt_'), 'Packet ID generated');
  assert.strictEqual(packet1.ttl_hops, MeshNetworkService.MAX_HOPS, 'Initial TTL is 5 hops');
  assert.strictEqual(packet1.hop_count, 0, 'Initial hop count is 0');
  assert.deepStrictEqual(packet1.visited_peers, ['peer_node_me'], 'Visited peers contains sender');
  console.log('  ✅ PASS: Packet created with valid headers');

  // TEST 5: Direct Local Delivery (Destination = My Node)
  console.log('Test 5: Local Packet Delivery');
  const incomingForMe: MeshPacket = {
    packet_id: 'pkt_incoming_01',
    type: 'CHAT_MESSAGE',
    sender_id: 'peer_warung_01',
    sender_name: 'Budi Santoso',
    recipient_id: 'my_phone_id',
    payload: 'enc_halo_mas_anto',
    timestamp: Date.now(),
    ttl_hops: 4,
    hop_count: 1,
    visited_peers: ['peer_warung_01'],
  };
  const result1 = mesh.processIncomingPacket('my_phone_id', incomingForMe);
  assert.strictEqual(result1.action, 'DELIVER_LOCAL', 'Action is DELIVER_LOCAL');
  assert.ok(result1.message, 'Message object created');
  assert.strictEqual(result1.message?.delivered, 1, 'Marked as delivered');
  assert.strictEqual(result1.message?.content, 'enc_halo_mas_anto', 'Content retained');
  console.log('  ✅ PASS: Local packet successfully received and delivered');

  // TEST 6: Message Deduplication
  console.log('Test 6: Packet Deduplication');
  const dupResult = mesh.processIncomingPacket('my_phone_id', incomingForMe);
  assert.strictEqual(dupResult.action, 'DROP', 'Duplicate packet dropped');
  assert.strictEqual(dupResult.reason, 'Duplicate packet already seen', 'Reason is duplicate');
  console.log('  ✅ PASS: Duplicate packet detected and dropped');

  // TEST 7: Loop Prevention
  console.log('Test 7: Loop Prevention');
  const loopPacket: MeshPacket = {
    packet_id: 'pkt_loop_01',
    type: 'CHAT_MESSAGE',
    sender_id: 'peer_warung_02',
    sender_name: 'Siti',
    recipient_id: 'peer_warung_03',
    payload: 'enc_test_loop',
    timestamp: Date.now(),
    ttl_hops: 3,
    hop_count: 2,
    visited_peers: ['peer_warung_02', 'my_phone_id', 'peer_relay_01'],
  };
  const loopResult = mesh.processIncomingPacket('my_phone_id', loopPacket);
  assert.strictEqual(loopResult.action, 'DROP', 'Routing loop dropped');
  assert.strictEqual(loopResult.reason, 'Routing loop detected (already visited this node)');
  console.log('  ✅ PASS: Routing loop prevented');

  // TEST 8: Hop Limit (TTL) Exhaustion
  console.log('Test 8: TTL Exhaustion');
  const expiredTtlPacket: MeshPacket = {
    packet_id: 'pkt_ttl_01',
    type: 'CHAT_MESSAGE',
    sender_id: 'peer_warung_02',
    sender_name: 'Siti',
    recipient_id: 'peer_warung_03',
    payload: 'enc_test_ttl',
    timestamp: Date.now(),
    ttl_hops: 0, // Exhausted!
    hop_count: 5,
    visited_peers: ['peer_warung_02'],
  };
  const ttlResult = mesh.processIncomingPacket('my_phone_id', expiredTtlPacket);
  assert.strictEqual(ttlResult.action, 'DROP', 'Exhausted TTL dropped');
  assert.strictEqual(ttlResult.reason, 'Hop limit TTL exhausted');
  console.log('  ✅ PASS: Zero TTL packet dropped');

  // TEST 9: Multi-Hop Relay Routing
  console.log('Test 9: Multi-Hop Relay Routing');
  const relayPacket: MeshPacket = {
    packet_id: 'pkt_relay_01',
    type: 'CHAT_MESSAGE',
    sender_id: 'peer_origin',
    sender_name: 'Origin User',
    recipient_id: 'peer_warung_01', // We know peer_warung_01 is active!
    payload: 'enc_relay_payload',
    timestamp: Date.now(),
    ttl_hops: 4,
    hop_count: 1,
    visited_peers: ['peer_origin'],
  };
  const relayResult = mesh.processIncomingPacket('my_phone_id', relayPacket);
  assert.strictEqual(relayResult.action, 'RELAY', 'Action is RELAY');
  assert.ok(relayResult.forwardPacket, 'Forward packet prepared');
  assert.strictEqual(relayResult.forwardPacket?.ttl_hops, 3, 'TTL decremented by 1');
  assert.strictEqual(relayResult.forwardPacket?.hop_count, 2, 'Hop count incremented by 1');
  assert.deepStrictEqual(relayResult.forwardPacket?.visited_peers, ['peer_origin', 'my_phone_id'], 'Node added to visited peers');
  console.log('  ✅ PASS: Multi-hop packet correctly prepared for relay');

  // TEST 10: Store-and-Forward When Recipient is Offline
  console.log('Test 10: Store-and-Forward Routing');
  const storeForwardPacket: MeshPacket = {
    packet_id: 'pkt_sf_01',
    type: 'CHAT_MESSAGE',
    sender_id: 'peer_warung_01',
    sender_name: 'Budi',
    recipient_id: 'peer_unknown_offline', // Not in known active peers!
    payload: 'enc_pesan_tertunda',
    timestamp: Date.now(),
    ttl_hops: 4,
    hop_count: 1,
    visited_peers: ['peer_warung_01'],
  };
  const sfResult = mesh.processIncomingPacket('my_phone_id', storeForwardPacket);
  assert.strictEqual(sfResult.action, 'STORE_FORWARD', 'Action is STORE_FORWARD');
  const storedMsgs = mesh.getMessages();
  const queuedMsg = storedMsgs.find(m => m.id === 'pkt_sf_01');
  assert.ok(queuedMsg, 'Message held in local store');
  assert.strictEqual(queuedMsg?.delivered, 0, 'Delivered is 0 (queued)');
  console.log('  ✅ PASS: Offline recipient packet queued in Store-and-Forward store');

  // TEST 11: Store-and-Forward Flush on Peer Announce
  console.log('Test 11: Store-and-Forward Queue Flush');
  const flushed = mesh.flushQueuedMessagesForPeer('peer_unknown_offline');
  assert.strictEqual(flushed.length, 1, 'Queued message found for newly announced peer');
  assert.strictEqual(flushed[0].id, 'pkt_sf_01', 'Correct message flushed');
  const afterFlush = mesh.flushQueuedMessagesForPeer('peer_unknown_offline');
  assert.strictEqual(afterFlush.length, 0, 'Queue is now empty for that peer');
  console.log('  ✅ PASS: Queued store-and-forward messages successfully flushed');

  // TEST 12: Anti-Spam Rate Limiter (Max 10 msg/min per peer)
  console.log('Test 12: Anti-Spam Rate Limiter');
  const spammerId = 'spammer_node_99';
  for (let i = 1; i <= 10; i++) {
    const ok = mesh.checkRateLimit(spammerId);
    assert.strictEqual(ok, true, `Message ${i} within rate limit`);
  }
  const blocked11th = mesh.checkRateLimit(spammerId);
  assert.strictEqual(blocked11th, false, '11th message blocked by rate limit');

  const spamPacket: MeshPacket = {
    packet_id: 'pkt_spam_11',
    type: 'CHAT_MESSAGE',
    sender_id: spammerId,
    sender_name: 'Spammer',
    recipient_id: 'my_phone_id',
    payload: 'enc_spam',
    timestamp: Date.now(),
    ttl_hops: 4,
    hop_count: 1,
    visited_peers: [spammerId],
  };
  const spamResult = mesh.processIncomingPacket('my_phone_id', spamPacket);
  assert.strictEqual(spamResult.action, 'DROP', 'Spam packet dropped');
  assert.ok(spamResult.reason?.includes('rate limit'), 'Reason contains rate limit');
  console.log('  ✅ PASS: Anti-spam rate limiting enforced (10 msg/min per peer)');

  // TEST 13: Local Store Queries & Expiration Pruning
  console.log('Test 13: Local Store Queries & TTL Pruning');
  const activeMessages = mesh.getMessages();
  assert.ok(activeMessages.length >= 2, 'Local messages retrieved');
  const pruned = mesh.pruneExpiredMessages();
  assert.strictEqual(pruned, 0, 'No fresh messages pruned');
  console.log('  ✅ PASS: Local message storage queries and TTL functional');

  // TEST 14: Server-Side Sync Engine (When Reconnected Online)
  console.log('Test 14: Server-Side Batch Sync');
  const syncPayload: SyncBatchRequest = {
    device_id: 'device_anto_android',
    user_id: 'user_anto_123',
    messages: [
      {
        id: 'msg_mesh_sync_01',
        sender_id: 'user_anto_123',
        recipient_id: 'user_budi_456',
        content: 'enc_pesan_saat_offline',
        created_at: Date.now() - 3600000,
        delivered: 1,
        ttl: 604800000,
      },
      {
        id: 'msg_mesh_sync_02',
        sender_id: 'user_anto_123',
        recipient_id: 'user_siti_789',
        content: 'enc_pesan_saat_offline_2',
        created_at: Date.now() - 1800000,
        delivered: 1,
        ttl: 604800000,
      }
    ],
    known_peers: [
      {
        peer_id: 'peer_discovered_at_warkop',
        display_name: 'Kang Asep',
        last_seen: Date.now(),
        hop_count: 1,
      }
    ]
  };

  mesh.syncOfflineBatch(syncPayload).then(syncRes => {
    assert.strictEqual(syncRes.success, true, 'Sync batch succeeded');
    assert.strictEqual(syncRes.synced_count, 2, '2 messages synced');
    assert.strictEqual(syncRes.synced_message_ids.length, 2, '2 message IDs returned');
    assert.ok(syncRes.server_timestamp > 0, 'Server timestamp present');

    const syncedPeers = mesh.getPeers();
    const kangAsep = syncedPeers.find(p => p.peer_id === 'peer_discovered_at_warkop');
    assert.ok(kangAsep, 'Kang Asep synced to network peers');

    console.log('  ✅ PASS: Offline messages and peers synced to server cleanly');
    console.log('--- ALL SPRINT 6 BLUETOOTH MESH UNIT TESTS PASSED (100% PASS) ---');
  }).catch(err => {
    console.error('Test 14 failed:', err);
    process.exit(1);
  });
}

runMeshTests();
