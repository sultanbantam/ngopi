import { coffee } from '../../src/theme/coffee';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stack, Slot, router, usePathname } from 'expo-router';
import { View, useWindowDimensions, StyleSheet, Text, Platform, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import BambupediaRoom from './bambupedia';
import { socketService } from '../../src/utils/socket';
import * as SecureStore from '../../src/utils/storage';


const API_URL = 'https://api.bamboochat.click/api';
const NOTIFICATION_STORAGE_KEY = 'bamboochat.notifications.v1';
const CALL_ALERT_STORAGE_KEY = 'bamboochat.call-alert-mode.v1';
const CALL_RING_DURATION_MS = 30_000;
const CALL_RING_REPEAT_MS = 2_500;

type CallAlertMode = 'ringtone' | 'vibrate' | 'silent';


type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  target?: { pathname: string; params?: Record<string, string> };
};

type ActiveIncomingCall = {
  callId: string;
  from: string;
  callerName: string;
  isVideo: boolean;
  target: AppNotification['target'];
  data: any;
};

type DirectoryUser = { id: string; username: string; display_name?: string; avatar_url?: string | null };

const normalizeStoredNotifications = (items: unknown): AppNotification[] => {
  if (!Array.isArray(items)) return [];
  const semanticKeys = new Set<string>();
  return items.filter((item): item is AppNotification => {
    if (!item || typeof item !== 'object') return false;
    const notification = item as AppNotification;
    if (!notification.id || !notification.title || !notification.createdAt) return false;
    if (/^(incoming call|video call)$/i.test(notification.title.trim())) return false;
    const key = `${notification.title}|${notification.body}|${notification.createdAt.slice(0, 16)}`;
    if (semanticKeys.has(key)) return false;
    semanticKeys.add(key);
    return true;
  }).slice(0, 60);
};

export default function MainLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const pathname = usePathname();

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationCenterVisible, setNotificationCenterVisible] = useState(false);
  const [userDirectory, setUserDirectory] = useState<Record<string, DirectoryUser>>({});
  const [toastTarget, setToastTarget] = useState<AppNotification['target']>();
  const [callAlertMode, setCallAlertMode] = useState<CallAlertMode>('ringtone');
  const [activeIncomingCall, setActiveIncomingCall] = useState<ActiveIncomingCall | null>(null);


  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const handledCallIdsRef = useRef(new Set<string>());
  const pendingCallsRef = useRef<Record<string, { data: any; stopAlert: () => void; timeout: ReturnType<typeof setTimeout>; browserNotification?: Notification }>>({});
  const shownNotificationIdsRef = useRef(new Set<string>());

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
            setNotifications(normalizeStoredNotifications(JSON.parse(storedNotifications)));
          } catch (error) {
            console.log('Failed to load notifications:', error);
          }
        }
        const storedCallAlertMode = localStorage.getItem(CALL_ALERT_STORAGE_KEY);
        if (storedCallAlertMode === 'ringtone' || storedCallAlertMode === 'vibrate' || storedCallAlertMode === 'silent') {
          setCallAlertMode(storedCallAlertMode);
        }
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      } else {
        uid = await SecureStore.getItemAsync('userId');
      }

      if (!uid) {
        router.replace('/(auth)/register');
        return;
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
  const startCallAlert = () => {
    if (Platform.OS !== 'web' || callAlertMode === 'silent') return () => {};
    if (callAlertMode === 'vibrate') {
      navigator.vibrate?.([450, 250, 450, 600]);
      const vibrationInterval = setInterval(() => navigator.vibrate?.([450, 250, 450, 600]), CALL_RING_REPEAT_MS);
      return () => { clearInterval(vibrationInterval); navigator.vibrate?.(0); };
    }
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [659, 784, 988];
      const oscillators: OscillatorNode[] = [];
      for (let cycleMs = 0; cycleMs < CALL_RING_DURATION_MS; cycleMs += CALL_RING_REPEAT_MS) {
        notes.forEach((frequency, index) => {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          const startsAt = audioCtx.currentTime + (cycleMs / 1000) + index * 0.18;
          oscillator.type = index === 1 ? 'triangle' : 'sine';
          oscillator.frequency.setValueAtTime(frequency, startsAt);
          gainNode.gain.setValueAtTime(0.0001, startsAt);
          gainNode.gain.exponentialRampToValueAtTime(0.35, startsAt + 0.03);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.28);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start(startsAt);
          oscillator.stop(startsAt + 0.3);
          oscillators.push(oscillator);
        });
      }
      void audioCtx.resume();
      return () => {
        oscillators.forEach((oscillator) => { try { oscillator.stop(); } catch { /* already stopped */ } });
        void audioCtx.close();
      };
    } catch (error) {
      console.log('Call alert audio error:', error);
      return () => {};
    }
  };

  const showNotification = (title: string, body: string, target?: AppNotification['target'], notificationId?: string) => {
    const id = notificationId || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (shownNotificationIdsRef.current.has(id)) return;
    shownNotificationIdsRef.current.add(id);
    const notification: AppNotification = {
      id,
      title,
      body,
      target,
      read: false,
      createdAt: new Date().toISOString(),
    };

    setNotifications((previous) => [notification, ...previous].slice(0, 60));
    setToastTarget(target);
    setToastMessage(`${title}: ${body}`);
    setTimeout(() => setToastMessage(null), 4500);
    playNotificationSound();

    if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(title, { body, tag: notification.id });
      browserNotification.onclick = () => {
        window.focus();
        setNotifications((previous) => previous.map((item) => (
          item.id === notification.id ? { ...item, read: true } : item
        )));
        if (target) {
          router.push(target as any);
        } else {
          setNotificationCenterVisible(true);
        }
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
    let active = true;

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
      const actor = data?.reacted_by;
      if (!currentUserId || data?.sender_id !== currentUserId || actor?.id === currentUserId) return;
      const actorName = actor?.display_name || actor?.username || 'Seseorang';
      const reaction = data?.reactions?.[actor?.id] || '';
      if (!reaction) return;
      showNotification('Reaksi pesan', `${actorName} memberi reaksi ${reaction}`.trim(), actor?.id ? {
        pathname: '/(main)/chat/[id]',
        params: { id: actor.id, name: actorName },
      } : undefined, `reaction-${data?.id}-${actor?.id}-${reaction}`);
    };

    const handleNewMessage = (data: any) => {
      if (currentUserId && data.sender_id !== currentUserId) {
        const senderName = getSenderName(data);
        showNotification('Ngopi', `${senderName} ${describeMessage(data)}`, {
          pathname: '/(main)/chat/[id]',
          params: { id: data.sender_id, name: senderName },
        }, `message-${data.id}`);
      }
    };

    const finishPendingCall = (callId: string, missed: boolean) => {
      const pending = pendingCallsRef.current[callId];
      if (!pending) return;
      pending.stopAlert();
      clearTimeout(pending.timeout);
      pending.browserNotification?.close();
      if (Platform.OS === 'web') navigator.vibrate?.(0);
      delete pendingCallsRef.current[callId];
      setActiveIncomingCall((prev) => (prev?.callId === callId ? null : prev));

      if (missed) {
        const callerName = pending.data?.name || 'Seseorang';
        showNotification(
          pending.data?.isVideo ? 'Video call tak terjawab' : 'Panggilan tak terjawab',
          `${callerName} mencoba menghubungi kamu.`,
          { pathname: '/(main)/chat/[id]', params: { id: pending.data.from, name: callerName } },
          `missed-call-${callId}`,
        );
      }
    };

    const handleCallIncoming = (data: any) => {
      if (currentUserId && data?.from === currentUserId) return;
      const fallbackId = `legacy-${data?.from}-${data?.room_id}-${String(data?.signal?.sdp || '').slice(-32)}`;
      const callId = String(data?.call_id || fallbackId);
      if (handledCallIdsRef.current.has(callId)) return;
      handledCallIdsRef.current.add(callId);

      const callerName = data?.name || 'Seseorang';
      const incomingSignal = data?.signal ? encodeURIComponent(JSON.stringify(data.signal)) : undefined;
      const target: AppNotification['target'] = {
        pathname: '/(main)/call/[id]',
        params: {
          id: data.from,
          name: callerName,
          isVideo: data?.isVideo ? 'true' : 'false',
          isCaller: 'false',
          callId,
          ...(incomingSignal ? { incomingSignal } : {}),
        },
      };

      const stopAlert = startCallAlert();
      const timeout = setTimeout(() => finishPendingCall(callId, true), CALL_RING_DURATION_MS);
      pendingCallsRef.current[callId] = { data, stopAlert, timeout };
      setActiveIncomingCall({
        callId,
        from: data.from,
        callerName,
        isVideo: Boolean(data?.isVideo),
        target,
        data,
      });

      if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
        const browserNotification = new Notification(data?.isVideo ? 'Video Call Ngopi' : 'Panggilan Ngopi', {
          body: `${callerName} memanggil kamu. Ketuk untuk jawab.`,
          tag: callId,
          requireInteraction: true,
        });
        pendingCallsRef.current[callId].browserNotification = browserNotification;
        browserNotification.onclick = () => {
          window.focus();
          finishPendingCall(callId, false);
          setActiveIncomingCall(null);
          router.push(target as any);
        };
      }
    };

    const handleCallEnded = (payload: any) => {
      const callId = payload?.call_id ? String(payload.call_id) : Object.keys(pendingCallsRef.current)[0];
      if (callId) finishPendingCall(callId, true);
      setActiveIncomingCall(null);
    };

    const setupListeners = async () => {
      const socket = await socketService.connect();
      if (!socket || !active) return;
      subscribedSocket = socket;
      socket.on('message_reacted', handleReaction);
      socket.on('receive_message', handleNewMessage);
      socket.on('call_incoming', handleCallIncoming);
      socket.on('call_ended', handleCallEnded);
    };

    setupListeners();

    return () => {
      active = false;
      subscribedSocket?.off('message_reacted', handleReaction);
      subscribedSocket?.off('receive_message', handleNewMessage);
      subscribedSocket?.off('call_incoming', handleCallIncoming);
      subscribedSocket?.off('call_ended', handleCallEnded);
    };
  }, [currentUserId, userDirectory, callAlertMode]);

  useEffect(() => {
    if (!pathname.includes('/call/')) return;
    Object.entries(pendingCallsRef.current).forEach(([callId, pending]) => {
      pending.stopAlert();
      clearTimeout(pending.timeout);
      pending.browserNotification?.close();
      delete pendingCallsRef.current[callId];
    });
    if (Platform.OS === 'web') navigator.vibrate?.(0);
    setToastMessage(null);
    setToastTarget(undefined);
  }, [pathname]);

  const cycleCallAlertMode = () => {
    const nextMode: CallAlertMode = callAlertMode === 'ringtone' ? 'vibrate' : callAlertMode === 'vibrate' ? 'silent' : 'ringtone';
    setCallAlertMode(nextMode);
    if (Platform.OS === 'web') localStorage.setItem(CALL_ALERT_STORAGE_KEY, nextMode);
  };
  const renderToast = () => {
    if (!toastMessage) return null;
    return (
      <TouchableOpacity style={styles.toastContainer} onPress={() => toastTarget ? router.push(toastTarget as any) : setNotificationCenterVisible(true)} activeOpacity={0.9}>
        <Text style={styles.toastText}>{toastMessage}</Text>
      </TouchableOpacity>
    );
  };

  const renderNotificationCenter = () => (
    <>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.notificationButton} onPress={() => setNotificationCenterVisible(true)} activeOpacity={0.9}>
          <Ionicons name="notifications" size={22} color={coffee.text} />
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
                <Text style={styles.notificationSubtitle}>{unreadCount} belum dibaca - panggilan: {callAlertMode === 'ringtone' ? 'ringtone BMC' : callAlertMode === 'vibrate' ? 'getar' : 'senyap'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity style={styles.notificationCloseButton} onPress={cycleCallAlertMode}>
                  <Ionicons name={callAlertMode === 'ringtone' ? 'musical-notes' : callAlertMode === 'vibrate' ? 'phone-portrait' : 'volume-mute'} size={20} color={coffee.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.notificationCloseButton} onPress={() => setNotificationCenterVisible(false)}>
                  <Ionicons name="close" size={22} color={coffee.text} />
                </TouchableOpacity>
              </View>
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

  const renderIncomingCallModal = () => {
    if (!activeIncomingCall) return null;

    const handleAccept = () => {
      const call = activeIncomingCall;
      finishPendingCall(call.callId, false);
      setActiveIncomingCall(null);
      if (call.target) router.push(call.target as any);
    };

    const handleDecline = () => {
      const call = activeIncomingCall;
      if (socketService.socket && call.data?.room_id) {
        socketService.socket.emit('end_call', {
          to: call.from,
          room_id: call.data.room_id,
          call_id: call.callId,
        });
      }
      finishPendingCall(call.callId, false);
      setActiveIncomingCall(null);
    };

    return (
      <Modal transparent visible={Boolean(activeIncomingCall)} animationType="fade" onRequestClose={handleDecline}>
        <View style={styles.callModalOverlay}>
          <View style={styles.callModalCard}>
            <View style={[styles.callModalAvatar, { backgroundColor: coffee.button }]}>
              <Ionicons name={activeIncomingCall.isVideo ? 'videocam' : 'person'} size={48} color={coffee.text} />
            </View>

            <Text style={styles.callModalTitle}>{activeIncomingCall.callerName}</Text>
            <Text style={styles.callModalSubtitle}>
              {activeIncomingCall.isVideo ? '📹 Panggilan Video Masuk...' : '📞 Panggilan Suara Masuk...'}
            </Text>

            <View style={styles.callModalActions}>
              {/* Decline Button (RED) */}
              <View style={styles.callActionItem}>
                <TouchableOpacity style={[styles.callActionButton, styles.declineButton]} onPress={handleDecline} activeOpacity={0.8}>
                  <MaterialIcons name="call-end" size={32} color={coffee.text} />
                </TouchableOpacity>
                <Text style={styles.callActionText}>Tolak</Text>
              </View>

              {/* Accept Button (GREEN) */}
              <View style={styles.callActionItem}>
                <TouchableOpacity style={[styles.callActionButton, styles.acceptButton]} onPress={handleAccept} activeOpacity={0.8}>
                  <Ionicons name={activeIncomingCall.isVideo ? 'videocam' : 'call'} size={32} color={coffee.text} />
                </TouchableOpacity>
                <Text style={styles.callActionText}>Terima</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (isLargeScreen) {
    const showBambupedia =
      pathname === '/' ||
      pathname === '/bambupedia';

    return (
      <View style={styles.singleContainer}>
        {showBambupedia ? <BambupediaRoom /> : <Slot />}
        {renderIncomingCallModal()}
        {renderToast()}
        {renderNotificationCenter()}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{
        headerStyle: { backgroundColor: coffee.surface },
        headerTintColor: coffee.text,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: coffee.background }
      }}>
        <Stack.Screen name="contacts" options={{ title: 'Ngopi' }} />
        <Stack.Screen name="bambupedia" options={{ headerShown: false }} />
        <Stack.Screen name="alihbahasa" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="help-center" options={{ headerShown: false }} />
        <Stack.Screen name="admin/dashboard" options={{ title: "CS Dashboard" }} />
      </Stack>
      {renderIncomingCallModal()}
      {renderToast()}
      {renderNotificationCenter()}
    </View>
  );
}

const styles = StyleSheet.create({
  callModalOverlay: {
    flex: 1,
    backgroundColor: coffee.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  callModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: coffee.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
    shadowColor: coffee.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  callModalAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: coffee.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  callModalTitle: {
    color: coffee.text,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  callModalSubtitle: {
    color: coffee.secondary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  callModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  callActionItem: {
    alignItems: 'center',
    gap: 8,
  },
  callActionButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: coffee.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  declineButton: {
    backgroundColor: coffee.dangerButton,
  },
  acceptButton: {
    backgroundColor: coffee.button,
  },
  callActionText: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '600',
  },
  singleContainer: {
    flex: 1,
    backgroundColor: coffee.background,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: coffee.background,
  },
  sidebar: {
    width: '30%',
    minWidth: 300,
    borderRightWidth: 1,
    borderRightColor: coffee.border,
  },
  main: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: coffee.background,
  },
  emptyStateLogo: {
    width: 200,
    height: 200,
    marginBottom: 20,
    opacity: 0.8,
  },
  emptyStateText: {
    color: coffee.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyStateSubtext: {
    color: coffee.secondary,
    fontSize: 16,
    marginTop: 8,
  },
  toastContainer: {
    position: 'absolute',
    top: 40,
    left: '50%',
    transform: [{ translateX: Platform.OS === 'web' ? '-50%' : 0 }],
    alignSelf: Platform.OS === 'web' ? 'auto' : 'center',
    backgroundColor: coffee.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 9999,
    shadowColor: coffee.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: coffee.text,
    fontWeight: 'bold',
  },
  notificationButton: {
    position: 'absolute',
    top: 96,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
    shadowColor: coffee.shadow,
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
    backgroundColor: coffee.dangerButton,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: coffee.text,
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
    backgroundColor: coffee.overlay,
  },
  notificationPanel: {
    width: 420,
    maxWidth: '94%',
    maxHeight: '78%',
    marginTop: 86,
    marginRight: 14,
    borderRadius: 8,
    backgroundColor: coffee.background,
    borderWidth: 1,
    borderColor: coffee.border,
    overflow: 'hidden',
  },
  notificationHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: coffee.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTitle: {
    color: coffee.text,
    fontSize: 18,
    fontWeight: '900',
  },
  notificationSubtitle: {
    color: coffee.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  notificationCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: coffee.surface,
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
    borderBottomColor: coffee.surface,
  },
  notificationItemUnread: {
    backgroundColor: coffee.raised,
  },
  notificationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: coffee.successButton,
    marginTop: 5,
  },
  notificationDotRead: {
    backgroundColor: coffee.border,
  },
  notificationTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  notificationItemTitle: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '900',
  },
  notificationItemBody: {
    color: coffee.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  notificationItemTime: {
    color: coffee.muted,
    fontSize: 11,
    marginTop: 5,
  },
  notificationEmpty: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationEmptyText: {
    color: coffee.secondary,
    fontSize: 14,
  },
  markReadButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: coffee.highlight,
  },
  markReadButtonText: {
    color: coffee.accent,
    fontSize: 13,
    fontWeight: '900',
  }
});

















