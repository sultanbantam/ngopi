import React, { useEffect, useMemo, useState } from 'react';
import { Stack, Slot, router, usePathname } from 'expo-router';
import { View, useWindowDimensions, StyleSheet, Text, Platform, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BambupediaRoom from './bambupedia';
import { socketService } from '../../src/utils/socket';
import * as SecureStore from '../../src/utils/storage';


const API_URL = 'https://api.bamboochat.click/api';
const NOTIFICATION_STORAGE_KEY = 'bamboochat.notifications.v1';

type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  target?: { pathname: string; params?: Record<string, string> };
};

type DirectoryUser = { id: string; username: string; display_name?: string; avatar_url?: string | null };
export default function MainLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const pathname = usePathname();
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationCenterVisible, setNotificationCenterVisible] = useState(false);
  const [userDirectory, setUserDirectory] = useState<Record<string, DirectoryUser>>({});

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  // Minta izin notifikasi browser dan ambil user ID
  useEffect(() => {
    const init = async () => {
      let uid = null;
      if (Platform.OS === 'web') {
        document.documentElement.setAttribute('translate', 'no');
        document.documentElement.classList.add('notranslate');
        document.body?.setAttribute('translate', 'no');
        document.body?.classList.add('notranslate');

        uid = localStorage.getItem('userId');
        const storedNotifications = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
        if (storedNotifications) {
          try {
            setNotifications(JSON.parse(storedNotifications));
          } catch (error) {
            console.log('Failed to load notifications:', error);
          }
        }
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      } else {
        uid = await SecureStore.getItemAsync('userId');
      }
      setCurrentUserId(uid);
    };
    init();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications.slice(0, 60)));
  }, [notifications]);

  useEffect(() => {
    const loadUserDirectory = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        const response = await fetch(`${API_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const users = (await response.json()) as DirectoryUser[];
        setUserDirectory(
          users.reduce<Record<string, DirectoryUser>>((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {})
        );
      } catch (error) {
        console.log('Failed to load user directory:', error);
      }
    };
    loadUserDirectory();
  }, [currentUserId]);

  const playNotificationSound = () => {
    if (Platform.OS !== 'web') return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  const showNotification = (title: string, body: string, target?: AppNotification['target']) => {
    const notification: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      body,
      target,
      read: false,
      createdAt: new Date().toISOString(),
    };

    setNotifications((previous) => [notification, ...previous].slice(0, 60));
    setToastMessage(`${title}: ${body}`);
    setTimeout(() => setToastMessage(null), 4500);
    playNotificationSound();

    if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(title, { body, tag: notification.id });
      browserNotification.onclick = () => {
        window.focus();
        setNotificationCenterVisible(true);
      };
    }
  };

  const openNotification = (item: AppNotification) => {
    setNotifications((previous) => previous.map((notification) => (
      notification.id === item.id ? { ...notification, read: true } : notification
    )));
    setNotificationCenterVisible(false);
    if (item.target) router.push(item.target as any);
  };

  const markAllNotificationsRead = () => {
    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
  };

  const formatNotificationTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    let subscribedSocket: any = null;

    const getSenderName = (data: any) => {
      const user = data?.sender_id ? userDirectory[data.sender_id] : null;
      return data?.sender?.display_name || data?.sender?.username || user?.display_name || user?.username || data?.sender_name || data?.name || 'Seseorang';
    };

    const describeMessage = (data: any) => {
      if (data?.type === 'audio') return 'mengirim voice message';
      if (data?.type === 'image') return 'mengirim gambar';
      if (data?.type === 'document' || data?.type === 'file') return 'mengirim dokumen';
      return 'mengirim private message';
    };

    const handleReaction = (data: any) => {
      showNotification('Reaction', `${getSenderName(data)} memberi reaksi`);
    };

    const handleNewMessage = (data: any) => {
      if (currentUserId && data.sender_id !== currentUserId) {
        const senderName = getSenderName(data);
        showNotification('BambooChat', `${senderName} ${describeMessage(data)}`, {
          pathname: '/(main)/chat/[id]',
          params: { id: data.sender_id, name: senderName },
        });
      }
    };

    const handleCallIncoming = (data: any) => {
      const callerName = data?.name || 'Seseorang';
      showNotification(data?.isVideo ? 'Video Call' : 'Incoming Call', `${callerName} memanggil kamu`, {
        pathname: '/(main)/chat/[id]',
        params: { id: data.from, name: callerName },
      });
    };

    const handleBambupediaMention = (data: any) => {
      if (currentUserId && data.sender_id === currentUserId) return;
      showNotification('Mention Bambupedia', `${data.sender_name || 'Seseorang'} menandai kamu`, {
        pathname: '/(main)/bambupedia',
      });
    };

    const setupListeners = async () => {
      const socket = await socketService.connect();
      if (!socket) return;
      subscribedSocket = socket;
      socket.on('message_reacted', handleReaction);
      socket.on('receive_message', handleNewMessage);
      socket.on('call_incoming', handleCallIncoming);
      socket.on('bambupedia_mention', handleBambupediaMention);
    };

    setupListeners();

    return () => {
      subscribedSocket?.off('message_reacted', handleReaction);
      subscribedSocket?.off('receive_message', handleNewMessage);
      subscribedSocket?.off('call_incoming', handleCallIncoming);
      subscribedSocket?.off('bambupedia_mention', handleBambupediaMention);
    };
  }, [currentUserId, userDirectory]);

  const renderToast = () => {
    if (!toastMessage) return null;
    return (
      <TouchableOpacity style={styles.toastContainer} onPress={() => setNotificationCenterVisible(true)} activeOpacity={0.9}>
        <Text style={styles.toastText}>{toastMessage}</Text>
      </TouchableOpacity>
    );
  };

  const renderNotificationCenter = () => (
    <>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.notificationButton} onPress={() => setNotificationCenterVisible(true)} activeOpacity={0.9}>
          <Ionicons name="notifications" size={22} color="#E2E8F0" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        </TouchableOpacity>
      )}

      <Modal transparent visible={notificationCenterVisible} animationType="fade" onRequestClose={() => setNotificationCenterVisible(false)}>
        <View style={styles.notificationOverlay}>
          <TouchableOpacity style={styles.notificationScrim} activeOpacity={1} onPress={() => setNotificationCenterVisible(false)} />
          <View style={styles.notificationPanel}>
            <View style={styles.notificationHeader}>
              <View>
                <Text style={styles.notificationTitle}>Notifikasi</Text>
                <Text style={styles.notificationSubtitle}>{unreadCount} belum dibaca</Text>
              </View>
              <TouchableOpacity style={styles.notificationCloseButton} onPress={() => setNotificationCenterVisible(false)}>
                <Ionicons name="close" size={22} color="#E2E8F0" />
              </TouchableOpacity>
            </View>

            {notifications.length > 0 ? (
              <ScrollView style={styles.notificationList} showsVerticalScrollIndicator={false}>
                {notifications.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.notificationItem, !item.read && styles.notificationItemUnread]} onPress={() => openNotification(item)} activeOpacity={0.86}>
                    <View style={[styles.notificationDot, item.read && styles.notificationDotRead]} />
                    <View style={styles.notificationTextWrap}>
                      <Text style={styles.notificationItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.notificationItemBody} numberOfLines={2}>{item.body}</Text>
                      <Text style={styles.notificationItemTime}>{formatNotificationTime(item.createdAt)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.notificationEmpty}>
                <Text style={styles.notificationEmptyText}>Belum ada notifikasi.</Text>
              </View>
            )}

            {notifications.length > 0 && (
              <TouchableOpacity style={styles.markReadButton} onPress={markAllNotificationsRead}>
                <Text style={styles.markReadButtonText}>Tandai semua dibaca</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );

  if (isLargeScreen) {
    const showBambupedia =
      pathname === '/contacts' ||
      pathname === '/' ||
      pathname === '/bambupedia';

    return (
      <View style={styles.singleContainer}>
        {showBambupedia ? <BambupediaRoom /> : <Slot />}
        {renderToast()}
        {renderNotificationCenter()}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ 
        headerStyle: { backgroundColor: '#1E293B' },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: '#0F172A' }
      }}>
        <Stack.Screen name="contacts" options={{ title: 'BambooChat' }} />
        <Stack.Screen name="bambupedia" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="help-center" options={{ title: "Pusat Bantuan" }} />
        <Stack.Screen name="admin/dashboard" options={{ title: "CS Dashboard" }} />
      </Stack>
      {renderToast()}
      {renderNotificationCenter()}
    </View>
  );
}

const styles = StyleSheet.create({
  singleContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0F172A',
  },
  sidebar: {
    width: '30%',
    minWidth: 300,
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  main: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  emptyStateLogo: {
    width: 200,
    height: 200,
    marginBottom: 20,
    opacity: 0.8,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyStateSubtext: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 8,
  },
  toastContainer: {
    position: 'absolute',
    top: 40,
    left: '50%',
    transform: [{ translateX: Platform.OS === 'web' ? '-50%' : 0 }],
    alignSelf: Platform.OS === 'web' ? 'auto' : 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  notificationButton: {
    position: 'absolute',
    top: 96,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  notificationOverlay: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  notificationScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  notificationPanel: {
    width: 420,
    maxWidth: '94%',
    maxHeight: '78%',
    marginTop: 86,
    marginRight: 14,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  notificationHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  notificationSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  notificationCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationList: {
    maxHeight: 430,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  notificationItemUnread: {
    backgroundColor: '#122138',
  },
  notificationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginTop: 5,
  },
  notificationDotRead: {
    backgroundColor: '#475569',
  },
  notificationTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  notificationItemTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '900',
  },
  notificationItemBody: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  notificationItemTime: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 5,
  },
  notificationEmpty: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationEmptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  markReadButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102A2A',
  },
  markReadButtonText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '900',
  }
});

















