import React, { useEffect, useState } from 'react';
import { Stack, Slot, usePathname } from 'expo-router';
import { View, useWindowDimensions, StyleSheet, Text, Platform } from 'react-native';
import BambupediaRoom from './bambupedia';
import { socketService } from '../../src/utils/socket';
import * as SecureStore from '../../src/utils/storage';


export default function MainLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const pathname = usePathname();
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Minta izin notifikasi browser dan ambil user ID
  useEffect(() => {
    const init = async () => {
      let uid = null;
      if (Platform.OS === 'web') {
        uid = localStorage.getItem('userId');
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

  const showNotification = (title: string, body: string) => {
    setToastMessage(`${title}: ${body}`);
    setTimeout(() => setToastMessage(null), 4000);
    playNotificationSound();

    if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
      if (document.hidden) {
        new Notification(title, { body });
      }
    }
  };

  useEffect(() => {
    const handleReaction = (data: any) => {
      showNotification('Reaction', `Someone reacted to your message!`);
    };

    const handleNewMessage = (data: any) => {
      if (currentUserId && data.sender_id !== currentUserId) {
        // Jangan notifikasi jika kita sedang membuka chat tersebut? 
        // Untuk sederhananya, kita selalu notif jika document.hidden atau selalu muncul toast
        showNotification('New Message', 'You received a new message');
      }
    };

    const handleCallIncoming = (data: any) => {
      showNotification('Incoming Call', `${data.name} is calling you...`);
    };

    if (socketService.socket) {
      socketService.socket.on('message_reacted', handleReaction);
      socketService.socket.on('receive_message', handleNewMessage);
      socketService.socket.on('call_incoming', handleCallIncoming);
    }
    
    return () => {
      if (socketService.socket) {
        socketService.socket.off('message_reacted', handleReaction);
        socketService.socket.off('receive_message', handleNewMessage);
        socketService.socket.off('call_incoming', handleCallIncoming);
      }
    };
  }, [currentUserId]);

  const renderToast = () => {
    if (!toastMessage) return null;
    return (
      <View style={styles.toastContainer}>
        <Text style={styles.toastText}>{toastMessage}</Text>
      </View>
    );
  };

  if (isLargeScreen) {
    const showBambupedia =
      pathname === '/contacts' ||
      pathname === '/' ||
      pathname === '/bambupedia' ||
      pathname.startsWith('/chat');

    return (
      <View style={styles.singleContainer}>
        {showBambupedia ? <BambupediaRoom /> : <Slot />}
        {renderToast()}
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
  }
});

