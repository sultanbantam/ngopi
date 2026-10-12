import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee as baseCoffee } from '../theme/coffee';
import { meshManager, MeshPeerItem } from '../utils/meshManager';

const coffee = {
  ...baseCoffee,
  cream: baseCoffee.text,
  textSecondary: baseCoffee.secondary,
  primary: baseCoffee.accent,
};

interface MeshPeerModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenChatWithPeer?: (peerId: string, peerName: string) => void;
}

export default function MeshPeerModal({ visible, onClose, onOpenChatWithPeer }: MeshPeerModalProps) {
  const [peers, setPeers] = useState<MeshPeerItem[]>([]);
  const [myPeerId, setMyPeerId] = useState(meshManager.getMyPeerId());
  const [isOffline, setIsOffline] = useState(meshManager.isOffline());
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [verifyModalPeer, setVerifyModalPeer] = useState<MeshPeerItem | null>(null);
  const [inputFingerprint, setInputFingerprint] = useState('');

  useEffect(() => {
    const update = () => {
      setPeers(meshManager.getPeers());
      setMyPeerId(meshManager.getMyPeerId());
      setIsOffline(meshManager.isOffline());
      setUnsyncedCount(meshManager.getUnsyncedMessages().length);
    };

    update();
    const unsubscribe = meshManager.subscribe(update);
    return unsubscribe;
  }, [visible]);

  const handleAnnounce = () => {
    meshManager.announcePresence();
    Alert.alert('Sinyal Dipancarkan 📡', 'Perangkat mengumumkan keberadaannya ke jaringan mesh Bluetooth di sekitar.');
  };

  const handleToggleOffline = () => {
    const nextState = !isOffline;
    meshManager.setOfflineMode(nextState);
  };

  const handleSendBroadcast = () => {
    if (!broadcastText.trim()) return;

    const res = meshManager.sendOfflineMessage('BROADCAST', broadcastText.trim());
    if (res.success) {
      setBroadcastText('');
      Alert.alert('Pesan Terkirim', 'Pesan offline berhasil disiarkan ke seluruh perangkat terdekat via mesh!');
    } else {
      Alert.alert('Gagal Mengirim', res.error || 'Terjadi kesalahan');
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    const res = await meshManager.syncPendingMessages();
    setIsSyncing(false);
    Alert.alert(
      'Sinkronisasi Selesai ☁️',
      `Berhasil menyinkronkan ${res.synced} pesan ke server.${res.failed > 0 ? ` (${res.failed} gagal/tertunda)` : ''}`
    );
  };

  const handleConfirmVerification = () => {
    if (!verifyModalPeer) return;
    if (!inputFingerprint.trim()) {
      Alert.alert('Error', 'Masukkan kode sidik jari kunci publik peer.');
      return;
    }

    meshManager.verifyPeer(verifyModalPeer.peer_id, inputFingerprint.trim());
    setVerifyModalPeer(null);
    setInputFingerprint('');
    Alert.alert('Terverifikasi 🛡️', `Identitas ${verifyModalPeer.display_name} berhasil diverifikasi aman.`);
  };

  const getHopBadge = (hopCount: number) => {
    if (hopCount <= 1) {
      return { label: '1 Hop (Langsung)', color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.15)' };
    }
    if (hopCount === 2) {
      return { label: '2 Hop (Relay 1)', color: '#F57C00', bg: 'rgba(245, 124, 0, 0.15)' };
    }
    return { label: `${hopCount} Hop (Multi-hop)`, color: '#1976D2', bg: 'rgba(25, 118, 210, 0.15)' };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.bluetoothBadge}>
                <Ionicons name="bluetooth" size={18} color="#FFF" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Mode Offline (Bluetooth Mesh)</Text>
                <Text style={styles.headerSubtitle}>Jaringan P2P Multi-hop Tanpa Internet</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={coffee.cream} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  <Text style={styles.statusLabel}>ID Perangkat Saya:</Text>
                  <Text style={styles.statusValue}>{myPeerId}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.modePill, isOffline ? styles.modeOfflinePill : styles.modeOnlinePill]}
                  onPress={handleToggleOffline}
                >
                  <Ionicons
                    name={isOffline ? 'cloud-offline-outline' : 'globe-outline'}
                    size={14}
                    color="#FFF"
                  />
                  <Text style={styles.modePillText}>{isOffline ? 'Offline Mesh' : 'Online Server'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statusBarActions}>
                <TouchableOpacity style={styles.announceBtn} onPress={handleAnnounce}>
                  <Ionicons name="radio" size={14} color="#FFF" />
                  <Text style={styles.announceBtnText}>Pancarkan Sinyal (Announce)</Text>
                </TouchableOpacity>

                {unsyncedCount > 0 && (
                  <TouchableOpacity
                    style={styles.syncBtn}
                    onPress={handleSyncNow}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={14} color="#FFF" />
                        <Text style={styles.syncBtnText}>Sync ({unsyncedCount})</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Quick Broadcast Section */}
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="bullhorn-outline" size={16} color={coffee.primary} />
              <Text style={styles.sectionTitle}>Siaran Warkop Offline (Broadcast)</Text>
            </View>
            <View style={styles.broadcastBox}>
              <TextInput
                style={styles.broadcastInput}
                placeholder="Tulis pesan ke seluruh kawan warkop terdekat..."
                placeholderTextColor={coffee.textSecondary}
                value={broadcastText}
                onChangeText={setBroadcastText}
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.broadcastSendBtn, !broadcastText.trim() && { opacity: 0.5 }]}
                onPress={handleSendBroadcast}
                disabled={!broadcastText.trim()}
              >
                <Ionicons name="send" size={14} color="#FFF" />
                <Text style={styles.broadcastSendText}>Siarkan</Text>
              </TouchableOpacity>
            </View>

            {/* Peer List */}
            <View style={styles.sectionHeader}>
              <Ionicons name="people-outline" size={16} color={coffee.primary} />
              <Text style={styles.sectionTitle}>Perangkat Terdekat ({peers.length})</Text>
            </View>

            {peers.length === 0 ? (
              <View style={styles.emptyPeersBox}>
                <Ionicons name="scan-outline" size={36} color={coffee.border} />
                <Text style={styles.emptyPeersTitle}>Belum Ada Perangkat Terdeteksi</Text>
                <Text style={styles.emptyPeersDesc}>
                  Pastikan Bluetooth aktif pada perangkat sekitar. Tekan "Pancarkan Sinyal" untuk mempercepat penemuan peer.
                </Text>
              </View>
            ) : (
              peers.map((peer) => {
                const badge = getHopBadge(peer.hop_count);
                return (
                  <View key={peer.peer_id} style={styles.peerCard}>
                    <View style={styles.peerMainRow}>
                      <View style={styles.peerAvatar}>
                        <Text style={styles.peerAvatarText}>
                          {peer.display_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.peerInfoCol}>
                        <View style={styles.peerNameRow}>
                          <Text style={styles.peerName}>{peer.display_name}</Text>
                          {peer.verified ? (
                            <View style={styles.verifiedBadge}>
                              <Ionicons name="shield-checkmark" size={12} color="#2E7D32" />
                              <Text style={styles.verifiedText}>Aman</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.unverifiedBadge}
                              onPress={() => setVerifyModalPeer(peer)}
                            >
                              <Ionicons name="shield-outline" size={12} color="#F57C00" />
                              <Text style={styles.unverifiedText}>Verifikasi</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={styles.peerSubRow}>
                          <View style={[styles.hopBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.hopBadgeText, { color: badge.color }]}>
                              {badge.label}
                            </Text>
                          </View>
                          <Text style={styles.signalText}>Sinyal: {peer.signal_strength}%</Text>
                        </View>
                      </View>

                      {onOpenChatWithPeer && (
                        <TouchableOpacity
                          style={styles.chatPeerBtn}
                          onPress={() => {
                            onClose();
                            onOpenChatWithPeer(peer.peer_id, peer.display_name);
                          }}
                        >
                          <Ionicons name="chatbubble-ellipses" size={16} color="#FFF" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            {/* Mesh Architecture Info */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={18} color={coffee.primary} />
              <View style={styles.infoTextCol}>
                <Text style={styles.infoTitle}>Bagaimana Cara Kerja Mesh Ini?</Text>
                <Text style={styles.infoDesc}>
                  Pesan diteruskan antar ponsel secara aman (E2EE X25519) dari satu kawan warkop ke kawan berikutnya hingga radius 500 meter. Saat internet menyala, pesan otomatis disinkronkan ke server.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Peer QR Verification Modal */}
      {verifyModalPeer && (
        <Modal visible transparent animationType="fade">
          <View style={styles.innerModalOverlay}>
            <View style={styles.innerModalContainer}>
              <Text style={styles.innerModalTitle}>Verifikasi Kunci Peer</Text>
              <Text style={styles.innerModalSubtitle}>
                Verifikasi {verifyModalPeer.display_name} untuk mencegah pemalsuan identitas (Anti-Man-in-the-Middle).
              </Text>

              <View style={styles.qrMockBox}>
                <Ionicons name="qr-code-outline" size={64} color={coffee.primary} />
                <Text style={styles.qrFingerprintLabel}>Sidik Jari Kunci Publik:</Text>
                <Text style={styles.qrFingerprintCode}>
                  {verifyModalPeer.peer_id.slice(0, 4).toUpperCase()}-
                  {verifyModalPeer.peer_id.slice(4, 8).toUpperCase() || 'A1B2'}-C3D4-E5F6
                </Text>
              </View>

              <TextInput
                style={styles.innerModalInput}
                placeholder="Masukkan kode sidik jari kawan..."
                placeholderTextColor={coffee.textSecondary}
                value={inputFingerprint}
                onChangeText={setInputFingerprint}
                autoCapitalize="characters"
              />

              <View style={styles.innerModalButtons}>
                <TouchableOpacity
                  style={styles.cancelVerifyBtn}
                  onPress={() => setVerifyModalPeer(null)}
                >
                  <Text style={styles.cancelVerifyText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmVerifyBtn}
                  onPress={handleConfirmVerification}
                >
                  <Text style={styles.confirmVerifyText}>Verifikasi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: coffee.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bluetoothBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0288D1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: coffee.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: coffee.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  statusCard: {
    backgroundColor: coffee.raised,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusLeft: {
    flex: 1,
  },
  statusLabel: {
    color: coffee.textSecondary,
    fontSize: 11,
  },
  statusValue: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  modeOfflinePill: {
    backgroundColor: '#E65100',
  },
  modeOnlinePill: {
    backgroundColor: '#2E7D32',
  },
  modePillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  announceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0288D1',
    paddingVertical: 8,
    borderRadius: 8,
  },
  announceBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#388E3C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  broadcastBox: {
    backgroundColor: coffee.raised,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 16,
  },
  broadcastInput: {
    color: coffee.cream,
    fontSize: 12,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  broadcastSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    backgroundColor: coffee.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 6,
  },
  broadcastSendText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyPeersBox: {
    backgroundColor: coffee.raised,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 16,
  },
  emptyPeersTitle: {
    color: coffee.cream,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyPeersDesc: {
    color: coffee.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  peerCard: {
    backgroundColor: coffee.raised,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 8,
  },
  peerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: coffee.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  peerAvatarText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  peerInfoCol: {
    flex: 1,
  },
  peerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  peerName: {
    color: coffee.cream,
    fontSize: 13,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '600',
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(245, 124, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unverifiedText: {
    color: '#F57C00',
    fontSize: 10,
    fontWeight: '600',
  },
  peerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  hopBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hopBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  signalText: {
    color: coffee.textSecondary,
    fontSize: 10,
  },
  chatPeerBtn: {
    backgroundColor: coffee.primary,
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(160, 82, 45, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(160, 82, 45, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  infoTextCol: {
    flex: 1,
  },
  infoTitle: {
    color: coffee.cream,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoDesc: {
    color: coffee.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  innerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  innerModalContainer: {
    backgroundColor: coffee.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  innerModalTitle: {
    color: coffee.cream,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  innerModalSubtitle: {
    color: coffee.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 16,
  },
  qrMockBox: {
    backgroundColor: coffee.raised,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 16,
  },
  qrFingerprintLabel: {
    color: coffee.textSecondary,
    fontSize: 10,
    marginTop: 8,
  },
  qrFingerprintCode: {
    color: coffee.cream,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  innerModalInput: {
    backgroundColor: coffee.raised,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: coffee.cream,
    borderWidth: 1,
    borderColor: coffee.border,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  innerModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelVerifyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
  },
  cancelVerifyText: {
    color: coffee.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmVerifyBtn: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmVerifyText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
