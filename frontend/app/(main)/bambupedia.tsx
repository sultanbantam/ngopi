import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { socketService } from '../../src/utils/socket';
import * as SecureStore from '../../src/utils/storage';

const BAMBOO_ICON = '\uD83C\uDF8B';
const TIP_ICON = '\uD83D\uDCA1';
const SYSTEM_ICON = '\uD83E\uDD16';
const SEND_ICON = '\u27A4';
const WAVE_ICON = '\uD83D\uDC4B';

interface Member {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'tip' | 'pinned';
  content: string;
  sender_id: string;
  sender_name: string;
  avatar_url?: string | null;
  created_at: string;
}

interface UserJoinedPayload {
  user?: Member;
  message?: ChatMessage;
  created_at?: string;
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return initials || 'U';
}

function getAvatarColor(name: string) {
  const colors = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function createLocalWelcomeMessage(member: Member): ChatMessage {
  const createdAt = new Date().toISOString();
  return {
    id: `local-welcome-${member.id}-${createdAt}`,
    type: 'system',
    content: `${BAMBOO_ICON} Selamat datang, ${member.display_name || member.username}! Senang kamu bergabung di Rumpun Bambupedia! ${WAVE_ICON}`,
    sender_id: 'system',
    sender_name: 'SISTEM',
    created_at: createdAt,
  };
}

export default function BambupediaRoom() {
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const seenMessageIds = useRef(new Set<string>());

  const appendMessage = useCallback((message: ChatMessage) => {
    if (!message?.id) return;

    setMessages((previous) => {
      if (seenMessageIds.current.has(message.id)) return previous;
      seenMessageIds.current.add(message.id);

      const next = [...previous, message];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }, []);

  useEffect(() => {
    const loadCurrentUser = async () => {
      if (Platform.OS === 'web') {
        setCurrentUserId(localStorage.getItem('userId'));
        return;
      }

      setCurrentUserId(await SecureStore.getItemAsync('userId'));
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    let active = true;
    let removeSocketListeners: (() => void) | null = null;

    const setupSocket = async () => {
      const socket = await socketService.connect();
      if (!active || !socket) return;

      const handleConnect = () => {
        setSocketConnected(true);
        socket.emit('request_bambupedia_members');
      };

      const handleDisconnect = () => {
        setSocketConnected(false);
      };

      const handleMembers = (memberList: Member[]) => {
        if (!Array.isArray(memberList)) return;
        setMembers(
          [...memberList].sort((a, b) =>
            (a.display_name || a.username).localeCompare(b.display_name || b.username)
          )
        );
      };

      const handleMessage = (message: ChatMessage) => {
        appendMessage(message);
      };

      const handlePinnedMessage = (message: ChatMessage) => {
        setPinnedMessage(message);
      };

      const handleTip = (payload: ChatMessage | string) => {
        if (typeof payload === 'string') {
          appendMessage({
            id: `sys-tip-${Date.now()}`,
            type: 'tip',
            content: `${TIP_ICON} Tips Fitur: ${payload}`,
            sender_id: 'system',
            sender_name: 'SISTEM',
            created_at: new Date().toISOString(),
          });
          return;
        }

        appendMessage(payload);
      };

      const handleUserJoined = (payload: UserJoinedPayload) => {
        if (payload?.message) {
          appendMessage(payload.message);
          return;
        }

        if (payload?.user) {
          appendMessage(createLocalWelcomeMessage(payload.user));
        }
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('bambupedia_online_users', handleMembers);
      socket.on('bambupedia_members', handleMembers);
      socket.on('bambupedia_message', handleMessage);
      socket.on('bambupedia_pinned_message', handlePinnedMessage);
      socket.on('bambupedia_system_tip', handleTip);
      socket.on('bambupedia_user_joined', handleUserJoined);

      removeSocketListeners = () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('bambupedia_online_users', handleMembers);
        socket.off('bambupedia_members', handleMembers);
        socket.off('bambupedia_message', handleMessage);
        socket.off('bambupedia_pinned_message', handlePinnedMessage);
        socket.off('bambupedia_system_tip', handleTip);
        socket.off('bambupedia_user_joined', handleUserJoined);
      };

      setSocketConnected(socket.connected);
      socket.emit('request_bambupedia_members');
    };

    setupSocket();

    return () => {
      active = false;
      removeSocketListeners?.();
    };
  }, [appendMessage]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [messages.length]);

  const sendMessage = () => {
    const content = inputText.trim();
    if (!content || !socketService.socket) return;

    socketService.socket.emit('bambupedia_message', { content });
    setInputText('');
  };

  const renderAvatar = (name: string, avatarUrl?: string | null, size = 36) => {
    const avatarStyle = [
      styles.avatar,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: getAvatarColor(name),
      },
    ];

    return (
      <View style={avatarStyle}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatarImage, { borderRadius: size / 2 }]} />
        ) : (
          <Text style={[styles.avatarText, { fontSize: Math.max(11, size * 0.34) }]}>{getInitials(name)}</Text>
        )}
      </View>
    );
  };

  const renderMember = ({ item }: { item: Member }) => {
    const displayName = item.display_name || item.username;
    const isMe = item.id === currentUserId;

    return (
      <View style={[styles.memberItem, isMe && styles.memberItemActive]}>
        {renderAvatar(displayName, item.avatar_url, 34)}
        <View style={styles.memberInfo}>
          <Text style={styles.memberName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.memberHandle} numberOfLines={1}>@{item.username}{isMe ? ' (kamu)' : ''}</Text>
        </View>
        <View style={styles.onlineDot} />
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwn = item.sender_id === currentUserId;
    const isSystem = item.type === 'system' || item.type === 'tip';

    if (isSystem) {
      const isTip = item.type === 'tip';
      return (
        <View style={[styles.systemMessage, isTip ? styles.tipMessage : styles.joinMessage]}>
          <Text style={[styles.systemLabel, isTip ? styles.tipLabel : styles.joinLabel]}>
            {isTip ? `${TIP_ICON} TIPS` : `${SYSTEM_ICON} SISTEM`}
          </Text>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {!isOwn && renderAvatar(item.sender_name, item.avatar_url, 32)}
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          {!isOwn && <Text style={styles.senderName} numberOfLines={1}>{item.sender_name}</Text>}
          <Text style={styles.messageText}>{item.content}</Text>
          <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      <View style={[styles.memberPanel, isCompact && styles.memberPanelCompact]}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{BAMBOO_ICON} Rumpun Bambupedia</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, socketConnected ? styles.statusDotLive : styles.statusDotOffline]} />
            <Text style={styles.statusText}>{socketConnected ? 'Live' : 'Menghubungkan'}</Text>
          </View>
        </View>

        <View style={styles.memberCountPill}>
          <Text style={styles.memberCountText}>{members.length} anggota aktif</Text>
        </View>

        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          style={styles.memberList}
          contentContainerStyle={styles.memberListContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyMembers}>
              {socketConnected ? 'Belum ada anggota online.' : 'Menghubungkan ke lobby...'}
            </Text>
          }
        />
      </View>

      <View style={styles.chatPanel}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>{BAMBOO_ICON} Rumpun Bambupedia</Text>
          <Text style={styles.chatSubtitle}>Ruang komunitas publik - sesi real-time - {members.length} aktif</Text>
        </View>

        <KeyboardAvoidingView style={styles.chatBody} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {pinnedMessage && (
            <View style={styles.pinnedHubCard}>
              <Text style={styles.pinnedHubTitle}>Pusat Informasi Ekosistem</Text>
              <Text style={styles.pinnedHubText}>{pinnedMessage.content}</Text>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatIcon}>{BAMBOO_ICON}</Text>
                <Text style={styles.emptyChatTitle}>Belum ada percakapan di sesi ini.</Text>
              </View>
            }
          />

          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Tulis pesan di Rumpun Bambupedia..."
              placeholderTextColor="#64748B"
              multiline
              maxLength={1000}
              onSubmitEditing={Platform.OS === 'web' ? sendMessage : undefined}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
              accessibilityLabel="Kirim pesan"
            >
              <Text style={styles.sendButtonText}>{SEND_ICON}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0A0F1A',
  },
  containerCompact: {
    flexDirection: 'column',
  },
  memberPanel: {
    width: 248,
    backgroundColor: '#0D1420',
    borderRightWidth: 1,
    borderRightColor: '#1E2D3D',
  },
  memberPanelCompact: {
    width: '100%',
    maxHeight: 220,
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2D3D',
  },
  panelHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  panelTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotLive: {
    backgroundColor: '#22C55E',
  },
  statusDotOffline: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  memberCountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#063A32',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  memberCountText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  memberList: {
    flex: 1,
  },
  memberListContent: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 3,
  },
  memberItemActive: {
    backgroundColor: '#102A2A',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 10,
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  memberHandle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginLeft: 8,
  },
  emptyMembers: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
  },
  chatPanel: {
    flex: 1,
    minWidth: 0,
  },
  chatHeader: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2D3D',
  },
  chatTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  chatSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  chatBody: {
    flex: 1,
  },
  messageList: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  pinnedHubCard: {
    backgroundColor: '#102A20',
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A2F',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pinnedHubTitle: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  pinnedHubText: {
    color: '#D1FAE5',
    fontSize: 12,
    lineHeight: 18,
  },
  messageListContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  messageRowOwn: {
    flexDirection: 'row-reverse',
  },
  messageBubble: {
    maxWidth: '76%',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ownBubble: {
    backgroundColor: '#059669',
    marginLeft: 44,
  },
  otherBubble: {
    backgroundColor: '#1E293B',
  },
  senderName: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  systemMessage: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 6,
    marginHorizontal: 6,
  },
  joinMessage: {
    backgroundColor: '#0B2733',
    borderLeftColor: '#0EA5E9',
  },
  tipMessage: {
    backgroundColor: '#102A20',
    borderLeftColor: '#22C55E',
  },
  systemLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  joinLabel: {
    color: '#38BDF8',
  },
  tipLabel: {
    color: '#34D399',
  },
  systemText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyChatIcon: {
    fontSize: 46,
    marginBottom: 12,
  },
  emptyChatTitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1E2D3D',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
    outlineStyle: 'none',
  } as any,
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#28433B',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});


