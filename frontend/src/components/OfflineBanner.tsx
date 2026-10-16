import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import { meshManager } from '../utils/meshManager';

interface OfflineBannerProps {
  onPressPeers?: () => void;
  onPressHT?: () => void;
  onPressSOS?: () => void;
}

export default function OfflineBanner({ onPressPeers, onPressHT, onPressSOS }: OfflineBannerProps) {
  const [isBrowserOffline, setIsBrowserOffline] = useState(
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [isMeshOffline, setIsMeshOffline] = useState(meshManager.isOffline());
  const [peerCount, setPeerCount] = useState(meshManager.getPeers().length);
  const [unsyncedCount, setUnsyncedCount] = useState(meshManager.getUnsyncedMessages().length);

  useEffect(() => {
    // 1. Mesh Manager subscription
    const unsubscribe = meshManager.subscribe(() => {
      setIsMeshOffline(meshManager.isOffline());
      setPeerCount(meshManager.getPeers().length);
      setUnsyncedCount(meshManager.getUnsyncedMessages().length);
    });

    // 2. Browser online/offline event listeners
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        setIsBrowserOffline(false);
      };
      const handleOffline = () => {
        setIsBrowserOffline(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        unsubscribe();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return unsubscribe;
  }, []);

  const isOffline = isBrowserOffline || isMeshOffline;
  if (!isOffline) return null;

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.leftSection}>
        <View style={styles.badgeWrapper}>
          <Text style={styles.badgeText}>OFFLINE</Text>
        </View>
        <View style={styles.textCol}>
          <Text style={styles.bannerTitle}>📡 Mode Offline Aktif — HT Siap</Text>
          <Text style={styles.bannerSubtitle}>
            Pesan akan disinkronkan saat online.
            {peerCount > 0 ? ` • ${peerCount} perangkat warkop terdeteksi` : ' • HT & Bluetooth Mesh Standby'}
            {unsyncedCount > 0 ? ` • ${unsyncedCount} pending` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        {onPressSOS && (
          <TouchableOpacity style={styles.sosButton} onPress={onPressSOS}>
            <Text style={{ fontSize: 13 }}>🚨</Text>
            <Text style={styles.sosButtonText}>SOS</Text>
          </TouchableOpacity>
        )}
        {onPressHT && (
          <TouchableOpacity style={styles.htButton} onPress={onPressHT}>
            <Text style={{ fontSize: 13 }}>📻</Text>
            <Text style={styles.htButtonText}>HT</Text>
          </TouchableOpacity>
        )}
        {onPressPeers && (
          <TouchableOpacity style={styles.peersButton} onPress={onPressPeers}>
            <Ionicons name="people" size={13} color={coffee.text} />
            <Text style={styles.peersButtonText}>Peer ({peerCount})</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.modeToggle}
          onPress={() => {
            meshManager.setOfflineMode(false);
            if (Platform.OS === 'web' && typeof window !== 'undefined' && navigator.onLine) {
              window.location.reload();
            }
          }}
        >
          <Ionicons name="globe-outline" size={13} color="#FFF" />
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
  badgeWrapper: {
    backgroundColor: '#b91c1c', // Warning Red
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b91c1c',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  sosButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  htButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 163, 115, 0.25)',
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  htButtonText: {
    color: coffee.accent,
    fontSize: 11,
    fontWeight: '700',
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
