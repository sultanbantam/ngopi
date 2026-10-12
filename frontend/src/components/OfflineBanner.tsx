import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import { meshManager } from '../utils/meshManager';

interface OfflineBannerProps {
  onPressPeers?: () => void;
}

export default function OfflineBanner({ onPressPeers }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(meshManager.isOffline());
  const [peerCount, setPeerCount] = useState(meshManager.getPeers().length);
  const [unsyncedCount, setUnsyncedCount] = useState(meshManager.getUnsyncedMessages().length);

  useEffect(() => {
    const unsubscribe = meshManager.subscribe(() => {
      setIsOffline(meshManager.isOffline());
      setPeerCount(meshManager.getPeers().length);
      setUnsyncedCount(meshManager.getUnsyncedMessages().length);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.leftSection}>
        <View style={styles.badgeIcon}>
          <Ionicons name="bluetooth" size={16} color="#FFF" />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.bannerTitle}>Mode Offline (Bluetooth Mesh) Aktif</Text>
          <Text style={styles.bannerSubtitle}>
            {peerCount > 0 ? `${peerCount} perangkat warkop terdeteksi` : 'Mencari perangkat di sekitar...'}
            {unsyncedCount > 0 ? ` • ${unsyncedCount} pesan pending` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        {onPressPeers && (
          <TouchableOpacity style={styles.peersButton} onPress={onPressPeers}>
            <Ionicons name="people" size={14} color={coffee.text} />
            <Text style={styles.peersButtonText}>Peer ({peerCount})</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.modeToggle}
          onPress={() => meshManager.setOfflineMode(false)}
        >
          <Ionicons name="globe-outline" size={14} color="#FFF" />
          <Text style={styles.modeToggleText}>Online</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#3E2723', // Deep coffee brown
    borderBottomWidth: 1,
    borderBottomColor: '#5D4037',
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  badgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0288D1', // Bluetooth blue
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: '#B0BEC5',
    fontSize: 10,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  peersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  peersButtonText: {
    color: coffee.text,
    fontSize: 11,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32', // Green
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  modeToggleText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
