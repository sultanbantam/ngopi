import React, { useEffect, useState } from 'react';
import { Stack, Slot, usePathname } from 'expo-router';
import { View, useWindowDimensions, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import ContactsScreen from './contacts';
import { socketService } from '../../src/utils/socket';

export default function MainLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const pathname = usePathname();
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleReaction = (data: any) => {
      // Just a simple toast for demo
      setToastMessage(`Someone reacted with ${data.reactions['me'] || 'an emoji'} to your message!`);
      setTimeout(() => setToastMessage(null), 3000);
    };

    if (socketService.socket) {
      socketService.socket.on('message_reacted', handleReaction);
    }
    
    return () => {
      if (socketService.socket) {
        socketService.socket.off('message_reacted', handleReaction);
      }
    };
  }, []);

  const renderToast = () => {
    if (!toastMessage) return null;
    return (
      <View style={styles.toastContainer}>
        <Text style={styles.toastText}>{toastMessage}</Text>
      </View>
    );
  };

  if (isLargeScreen) {
    return (
      <View style={styles.splitContainer}>
        <View style={styles.sidebar}>
          <ContactsScreen />
        </View>
        <View style={styles.main}>
          {pathname === '/contacts' || pathname === '/' ? (
             <View style={styles.emptyState}>
               <Text style={styles.emptyStateText}>BambooChat Web</Text>
               <Text style={styles.emptyStateSubtext}>Select a chat to start messaging</Text>
             </View>
          ) : (
             <Slot />
          )}
        </View>
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
        <Stack.Screen name="contacts" options={{ title: 'WhatsApp' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      </Stack>
      {renderToast()}
    </View>
  );
}

const styles = StyleSheet.create({
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
