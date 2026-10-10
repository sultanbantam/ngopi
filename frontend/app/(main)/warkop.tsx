import { coffee } from '../../src/theme/coffee';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Modal,
  Pressable,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { socketService } from '../../src/utils/socket';
import * as SecureStore from '../../src/utils/storage';
import { getMimeType } from '../../src/utils/fileHelpers';
import { AmbientPlayer } from '../../src/components/AmbientPlayer';
import { JukeboxWidget } from '../../src/components/JukeboxWidget';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { WARKOP_TEBAK_TEBAKAN, TebakTebakan } from '../../src/data/tebakTebakan';
import { FEATURE_TIPS, FeatureTip } from '../../src/data/tips';

const API_URL = 'https://api.ngopi.top/api';
const ROOM_ID = 'bambupedia-room';
const ROOM_NAME = 'Warung Kopi';
const BAMBOO_ICON = '☕';
const TIP_ICON = '\uD83D\uDCA1';
const SYSTEM_ICON = '\uD83E\uDD16';
const WAVE_ICON = '\uD83D\uDC4B';
const SMILE = '\uD83D\uDE0A';
const WARKOP_EMOJIS = ['☕', '🍵', '🚬', '🎵', '🍜', '🌙'];
const EMOJI_LIST = [
  '☕', '🍵', '🚬', '🍜', '🎵', '🌙',
  '😊', '😂', '🤣', '😍', '😎', '😋',
  '👍', '🙏', '🔥', '❤️', '👏', '🙌',
  '🤝', '🎉', '💡', '⭐', '👀', '💯'
];
const NoTranslateText = Text as any;

export function sanitizeWarkopText(text: string): string {
  if (!text) return text;
  return text
    .replace(/rumpun\s*\/\s*grup/gi, 'warkop')
    .replace(/grup\s*\/\s*rumpun/gi, 'warkop')
    .replace(/Rumpun\s+Bambupedia/gi, 'Warung Kopi')
    .replace(/Rumpun\s+bambupedia/gi, 'Warung Kopi')
    .replace(/Admin\s+rumpun/gi, 'Admin warkop')
    .replace(/admin\s+rumpun/gi, 'admin warkop')
    .replace(/Pengaturan\s+rumpun/gi, 'Pengaturan warkop')
    .replace(/pengaturan\s+rumpun/gi, 'pengaturan warkop')
    .replace(/Buat\s+Rumpun/gi, 'Buat Warkop')
    .replace(/buat\s+rumpun/gi, 'buat warkop')
    .replace(/tab\s+Rumpun/gi, 'tab Warkop')
    .replace(/tab\s+rumpun/gi, 'tab warkop')
    .replace(/Info\s+Rumpun/gi, 'Info Warkop')
    .replace(/info\s+rumpun/gi, 'info warkop')
    .replace(/rumpun/gi, 'warkop')
    .replace(/Rumpun/g, 'Warkop')
    .replace(/🎋/g, '☕')
    .replace(/BambooCS/g, 'NgopiCS')
    .replace(/BambooBot/g, 'WarkopBot')
    .replace(/BambooChat/g, 'Ngopi di Warkop');
}

type MessageType = 'text' | 'audio' | 'image' | 'file' | 'document' | 'system';

interface Member {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online?: boolean;
  user_status?: 'online' | 'offline';
  last_seen?: string | null;
}

interface ChatMessage {
  id: string;
  message_id?: string;
  room_id?: string;
  room_name?: string;
  type: 'user' | 'system' | 'tip' | 'pinned';
  message_type?: MessageType;
  content: string;
  message_text?: string;
  sender_id: string;
  sender_name: string;
  username?: string;
  avatar_url?: string | null;
  attachment_url?: string | null;
  mentioned_users?: string[];
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
  const colors = [coffee.avatar1, coffee.avatar2, coffee.avatar3, coffee.avatar4, coffee.avatar5, coffee.avatar6];
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

function formatLastSeen(iso?: string | null) {
  if (!iso) return 'Offline';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Offline';
  return `Offline - ${date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

function normalizeUsername(username: string) {
  return username.replace(/^@/, '').trim();
}

function getMentionQuery(text: string) {
  const match = text.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/);
  return match ? match[1].toLowerCase() : null;
}

function createLocalWelcomeMessage(member: Member): ChatMessage {
  const createdAt = new Date().toISOString();
  return {
    id: `local-welcome-${member.id}-${createdAt}`,
    room_id: ROOM_ID,
    room_name: ROOM_NAME,
    type: 'system',
    message_type: 'system',
    content: `${BAMBOO_ICON} Selamat datang, ${member.display_name || member.username}! Senang kamu bergabung di ${ROOM_NAME}! ${WAVE_ICON}`,
    sender_id: 'system',
    sender_name: 'SISTEM',
    created_at: createdAt,
  };
}

function createLocalRiddleMessage(index?: number): ChatMessage {
  const idx = typeof index === 'number' ? index : Math.floor(Math.random() * WARKOP_TEBAK_TEBAKAN.length);
  const riddle = WARKOP_TEBAK_TEBAKAN[idx] || WARKOP_TEBAK_TEBAKAN[0];
  const createdAt = new Date().toISOString();
  return {
    id: `local-riddle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    room_id: ROOM_ID,
    room_name: ROOM_NAME,
    type: 'system',
    message_type: 'system',
    content: `🎯 [TEBAK-TEBAKAN WARKOP]\n${riddle.question}\n\nKetik jawabanmu langsung di chat! Penjawab TERCEPAT yang benar mendapat +10 Poin Kopi ☕!`,
    sender_id: 'system',
    sender_name: 'WarkopBot',
    created_at: createdAt,
  };
}

function AudioMessage({ url }: { url: string }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  const playSound = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      const { sound: nextSound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      setSound(nextSound);
      setIsPlaying(true);
      nextSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          nextSound.setPositionAsync(0);
        }
      });
    } catch (error) {
      console.error('Error playing audio', error);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.audioPlayer}>
        <audio controls src={url} style={{ height: 32, width: 230, maxWidth: '100%' }} />
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.audioPlayer} onPress={playSound}>
      <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={coffee.text} />
      <Text style={styles.audioText}>Voice message</Text>
    </TouchableOpacity>
  );
}

export default function BambupediaRoom() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isCompact = width < 720;
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [suasanaExpanded, setSuasanaExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [memberSummary, setMemberSummary] = useState({ online: 0, total: 0, label: 'Memuat anggota' });
  const webMediaRecorderRef = useRef<any>(null);
  const webAudioChunksRef = useRef<Blob[]>([]);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const seenMessageIds = useRef(new Set<string>());
  const hasWelcomedRef = useRef(false);
  const currentUsernameRef = useRef<string | null>(null);
  currentUsernameRef.current = currentUsername;

  const appendMessage = useCallback((rawMessage: ChatMessage) => {
    if (!rawMessage?.id) return;

    const content = sanitizeWarkopText(rawMessage.content || '');
    const messageText = sanitizeWarkopText(rawMessage.message_text || rawMessage.content || '');
    const message: ChatMessage = {
      ...rawMessage,
      content,
      message_text: messageText,
    };

    // Drop any promotional links from WarkopBot / BambooBot
    if (
      ['WarkopBot', 'BambooBot', 'SISTEM'].includes(message.sender_name) &&
      (message.content.includes('http://') ||
       message.content.includes('https://') ||
       message.content.includes('www.') ||
       message.content.includes('.click') ||
       message.content.includes('bamboochain') ||
       message.content.includes('advipi') ||
       message.content.includes('aichitect') ||
       message.content.includes('bamboogame'))
    ) {
      return;
    }

    setMessages((previous) => {
      if (seenMessageIds.current.has(message.id)) return previous;
      seenMessageIds.current.add(message.id);
      const next = [...previous, message];
      return next.length > 240 ? next.slice(next.length - 240) : next;
    });
  }, []);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const userId = await SecureStore.getItemAsync('userId');
      const username = await SecureStore.getItemAsync('username');
      setCurrentUserId(userId);
      setCurrentUsername(username);

      if (username) {
        const key = `ngopi_points_${username}`;
        const storedPoints = Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
        if (storedPoints) {
          setUserPoints(parseInt(storedPoints, 10) || 0);
        }
      }

      // Sapaan sekali saja dan tebak-tebakan pembuka
      if (userId && username && !hasWelcomedRef.current) {
        hasWelcomedRef.current = true;
        setTimeout(() => {
          appendMessage(createLocalWelcomeMessage({
            id: userId,
            username: username,
            display_name: username,
            avatar_url: null
          }));
        }, 400);

        setTimeout(() => {
          appendMessage(createLocalRiddleMessage(0));
        }, 1000);
      }
    };
    loadCurrentUser();
  }, [appendMessage]);

  useEffect(() => {
    let active = true;
    let removeSocketListeners: (() => void) | null = null;

    const setupSocket = async () => {
      const socket = await socketService.connect();
      if (!active || !socket) return;

      const handleConnect = () => {
        setSocketConnected(true);
        socket.emit('request_bambupedia_members');
        socket.emit('request_warkop_points');
        socket.emit('bambupedia_send_message', { content: '/tebak', message_type: 'text' });
      };

      const handleDisconnect = () => setSocketConnected(false);

      const handlePointsUpdate = (data: { username: string; points: number }) => {
        if (!data?.username) return;
        const currentUName = currentUsernameRef.current;
        if (currentUName && data.username.toLowerCase() === currentUName.toLowerCase()) {
          const validated = Number(data.points) || 0;
          setUserPoints(validated);
          const key = `ngopi_points_${currentUName}`;
          if (Platform.OS === 'web') {
            localStorage.setItem(key, validated.toString());
          } else {
            SecureStore.setItemAsync(key, validated.toString());
          }
        }
      };

      const handleMembers = (memberList: Member[]) => {
        if (!Array.isArray(memberList)) return;
        const unique = new Map<string, Member>();
        memberList.forEach((item) => {
          if (!item?.id || !item?.username) return;
          const hasOnlineFlag = typeof item.is_online === 'boolean';
          const isOnline = hasOnlineFlag ? item.is_online : item.user_status ? item.user_status === 'online' : true;
          unique.set(item.id, {
            ...item,
            display_name: item.display_name || item.username,
            avatar_url: item.avatar_url || null,
            is_online: isOnline,
            user_status: isOnline ? 'online' : 'offline',
          });
        });

        const nextMembers = Array.from(unique.values()).sort((a, b) => {
          const aOnline = a.is_online || a.user_status === 'online';
          const bOnline = b.is_online || b.user_status === 'online';
          if (aOnline !== bOnline) return aOnline ? -1 : 1;
          return (a.display_name || a.username).localeCompare(b.display_name || b.username);
        });
        const nextOnline = nextMembers.filter((member) => member.is_online || member.user_status === 'online').length;
        setMembers(nextMembers);
        setMemberSummary({
          online: nextOnline,
          total: nextMembers.length,
          label: nextMembers.length > 0 ? `${nextOnline} online - ${nextMembers.length} anggota` : 'Memuat anggota',
        });
      };

      const handleTip = (payload: ChatMessage | string) => {
        if (typeof payload === 'string') {
          const cleanText = sanitizeWarkopText(payload);
          appendMessage({
            id: `sys-tip-${Date.now()}`,
            room_id: ROOM_ID,
            room_name: ROOM_NAME,
            type: 'tip',
            message_type: 'system',
            content: `${TIP_ICON} Tips Fitur: ${cleanText}`,
            sender_id: 'system',
            sender_name: 'SISTEM',
            created_at: new Date().toISOString(),
          });
          return;
        }
        appendMessage({
          ...payload,
          content: sanitizeWarkopText(payload.content || ''),
        });
      };

      const handleUserJoined = (payload: UserJoinedPayload) => {
        const joinId = payload?.user?.id || payload?.message?.sender_id;
        const joinUsername = payload?.user?.username || payload?.message?.username;
        if (joinId === currentUserId || (currentUsername && joinUsername === currentUsername)) {
          return; // Ignore greeting for self
        }
        if (payload?.message) appendMessage(payload.message);
        else if (payload?.user) appendMessage(createLocalWelcomeMessage(payload.user));
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('bambupedia_online_users', handleMembers);
      socket.on('bambupedia_members', handleMembers);
      socket.on('bambupedia_message', appendMessage);
      socket.on('system_message', appendMessage);
      socket.on('bambupedia_system_tip', handleTip);
      socket.on('bambupedia_user_joined', handleUserJoined);
      socket.on('warkop_user_points', handlePointsUpdate);

      removeSocketListeners = () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('bambupedia_online_users', handleMembers);
        socket.off('bambupedia_members', handleMembers);
        socket.off('bambupedia_message', appendMessage);
        socket.off('system_message', appendMessage);
        socket.off('bambupedia_system_tip', handleTip);
        socket.off('bambupedia_user_joined', handleUserJoined);
        socket.off('warkop_user_points', handlePointsUpdate);
      };

      setSocketConnected(socket.connected);
      socket.emit('request_bambupedia_members');
      socket.emit('request_warkop_points');
    };

    setupSocket();
    return () => {
      active = false;
      removeSocketListeners?.();
    };
  }, [appendMessage]);

  useEffect(() => {
    if (drawerVisible) socketService.socket?.emit('request_bambupedia_members');
  }, [drawerVisible]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length]);

  useEffect(() => {
    // Rotate rich educational tips every 90 seconds
    let tipIdx = 0;
    const tipsTimer = setInterval(() => {
      const tip = FEATURE_TIPS[tipIdx % FEATURE_TIPS.length];
      tipIdx++;
      appendMessage({
        id: `tip-cycle-${Date.now()}`,
        room_id: ROOM_ID,
        room_name: ROOM_NAME,
        type: 'tip',
        message_type: 'system',
        content: `💡 Tips: ${tip.title}\n${tip.content}`,
        sender_id: 'system',
        sender_name: 'SISTEM',
        created_at: new Date().toISOString(),
      });
    }, 90000);

    return () => {
      clearInterval(tipsTimer);
    };
  }, [appendMessage]);

  const sortedMembers = members;
  const onlineCount = memberSummary.online;
  const roomSummaryLabel = memberSummary.label;
  const hasDraft = inputText.trim().length > 0;
  const currentMember = sortedMembers.find((member) => member.id === currentUserId);
  const activeUsername = currentUsername || currentMember?.username || null;
  const mentionQuery = getMentionQuery(inputText);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    return sortedMembers.filter((member) => {
      const displayName = member.display_name || member.username;
      const handle = normalizeUsername(member.username).toLowerCase();
      return handle.includes(mentionQuery) || displayName.toLowerCase().includes(mentionQuery);
    }).slice(0, 6);
  }, [mentionQuery, sortedMembers]);

  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return messages.filter((message) => {
      const content = message.content || '';
      const sender = message.sender_name || '';

      // 1. Drop any message from WarkopBot / BambooBot that contains web links or URLs
      if (
        ['WarkopBot', 'BambooBot', 'SISTEM'].includes(sender) &&
        (content.includes('http://') ||
         content.includes('https://') ||
         content.includes('www.') ||
         content.includes('.click') ||
         content.includes('.org') ||
         content.includes('.id'))
      ) {
        return false;
      }

      // 2. Drop any promotional platforms
      if (
        content.includes('bamboochain') ||
        content.includes('advipi') ||
        content.includes('votiva') ||
        content.includes('bamboogame') ||
        content.includes('aichitect') ||
        content.includes('xignalx') ||
        content.includes('whaleofsavu') ||
        content.includes('BaMbooChain') ||
        content.includes('Whale of Savu') ||
        content.includes('Aplikasi signal trading')
      ) {
        return false;
      }

      if (!query) return true;
      return `${content} ${sender}`.toLowerCase().includes(query);
    });
  }, [messages, searchQuery]);

  const visibleMembers = useMemo(() => {
    const query = searchMemberQuery.trim().toLowerCase();
    if (!query) return sortedMembers;
    return sortedMembers.filter((member) =>
      `${member.display_name || ''} ${member.username || ''}`.toLowerCase().includes(query)
    );
  }, [sortedMembers, searchMemberQuery]);

  const sendSocketMessage = (payload: { content?: string; message_type?: MessageType; attachment_url?: string | null }) => {
    if (!socketService.socket) return;
    socketService.socket.emit('bambupedia_message', payload);
  };

  const sendMessage = () => {
    const content = inputText.trim();
    if (!content) return;

    sendSocketMessage({ content, message_type: 'text' });
    setInputText('');
  };

  const sendQuickGreeting = () => {
    sendSocketMessage({ content: `Halo semuanya, saya standby di ${ROOM_NAME}.`, message_type: 'text' });
    setDrawerVisible(false);
  };

  const insertMention = (member: Member) => {
    const username = normalizeUsername(member.username);
    setInputText((previous) => {
      const match = previous.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/);
      if (!match || match.index === undefined) {
        return `${previous}${previous.endsWith(' ') || previous.length === 0 ? '' : ' '}@${username} `;
      }
      const prefixEnd = match.index + (match[0].startsWith(' ') ? 1 : 0);
      return `${previous.slice(0, prefixEnd)}@${username} `;
    });
    setDrawerVisible(false);
  };

  const startPrivateMessage = (member: Member) => {
    if (member.id === currentUserId) return;
    setDrawerVisible(false);
    router.push({
      pathname: '/(main)/chat/[id]',
      params: { id: member.id, name: member.display_name || member.username },
    } as any);
  };

  const uploadFile = async (uri: string, type: MessageType, originalName?: string, mimeType?: string, rawFile?: any) => {
    try {
      const resolvedMime = getMimeType(originalName, mimeType);
      const fallbackName = originalName || `upload_${Date.now()}.${resolvedMime.split('/')[1] || (type === 'image' ? 'jpg' : type === 'audio' ? 'm4a' : 'bin')}`;

      const formData = new FormData();
      if (Platform.OS === 'web') {
        let fileObj: File;
        if (rawFile && (rawFile instanceof File || rawFile instanceof Blob)) {
          fileObj = new File([rawFile], fallbackName, { type: resolvedMime || rawFile.type || 'application/octet-stream' });
        } else if (uri.startsWith('data:')) {
          const arr = uri.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: resolvedMime || mimeMatch?.[1] || 'application/octet-stream' });
          fileObj = new File([blob], fallbackName, { type: blob.type });
        } else {
          try {
            const response = await fetch(uri);
            const blob = await response.blob();
            fileObj = new File([blob], fallbackName, { type: resolvedMime || blob.type || 'application/octet-stream' });
          } catch (fetchErr: any) {
            console.warn('Bambupedia fetch uri failed:', fetchErr);
            throw new Error(`Gagal membaca file lokal: ${fetchErr?.message || fetchErr}`);
          }
        }
        formData.append('file', fileObj);
      } else {
        formData.append('file', {
          uri,
          name: fallbackName,
          type: resolvedMime,
        } as any);
      }

      const token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await axios.post(`${API_URL}/upload`, formData, { headers });
      return response.data.url as string;
    } catch (error: any) {
      console.error('Bambupedia upload failed:', error?.response?.data || error?.message || error);
      return null;
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `image_${Date.now()}.${asset.mimeType?.split('/')[1] || 'jpg'}`;
      const url = await uploadFile(asset.uri, 'image', fileName, asset.mimeType, (asset as any).file);
      if (url) sendSocketMessage({ content: 'Image', message_type: 'image', attachment_url: url });
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const doc = result.assets[0];
      const url = await uploadFile(doc.uri, 'document', doc.name, doc.mimeType, (doc as any).file);
      if (url) sendSocketMessage({ content: doc.name || 'Document', message_type: 'document', attachment_url: url });
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        webAudioChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) webAudioChunksRef.current.push(event.data);
        };
        mediaRecorder.start();
        webMediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        return;
      }

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: nextRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(nextRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start Bambupedia recording:', error);
    }
  };

  const stopRecording = async () => {
    if (Platform.OS === 'web') {
      if (!webMediaRecorderRef.current) return;
      setIsRecording(false);
      const mediaRecorder = webMediaRecorderRef.current;
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(webAudioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        const fileObj = new File([audioBlob], 'bambupedia-voice.webm', { type: 'audio/webm' });
        formData.append('file', fileObj);
        try {
          const token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
          const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const response = await axios.post(`${API_URL}/upload`, formData, { headers });
          if (response.data.url) sendSocketMessage({ content: 'Voice message', message_type: 'audio', attachment_url: response.data.url });
        } catch (error) {
          console.error('Bambupedia voice upload failed:', error);
        }
      };
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      webMediaRecorderRef.current = null;
      return;
    }

    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (uri) {
      const url = await uploadFile(uri, 'audio');
      if (url) sendSocketMessage({ content: 'Voice message', message_type: 'audio', attachment_url: url });
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const openAttachment = async (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    await Linking.openURL(url);
  };

  const renderAvatar = (name: string, avatarUrl?: string | null, size = 40) => {
    const avatarStyle = [styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: getAvatarColor(name) }];
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

  const renderMentionedText = (content: string, style: any) => {
    const parts = content.split(/(https?:\/\/[^\s]+|www\.[^\s]+|@[A-Za-z0-9_.-]+)/gi);
    return (
      <NoTranslateText style={style} className="notranslate" translate="no">
        {parts.map((part, index) => {
          if (/^@[A-Za-z0-9_.-]+$/.test(part)) {
            return <Text key={part + '-' + index} style={styles.mentionText}>{part}</Text>;
          }

          if (/^(https?:\/\/|www\.)/i.test(part)) {
            const url = part.replace(/[),.!?;:]+$/, '');
            const trailingText = part.slice(url.length);
            const href = /^www\./i.test(url) ? 'https://' + url : url;
            return (
              <React.Fragment key={part + '-' + index}>
                <Text
                  style={styles.linkText}
                  onPress={() => openAttachment(href)}
                  accessibilityRole="link"
                  accessibilityLabel={'Buka tautan ' + url}
                >
                  {url}
                </Text>
                {trailingText ? <Text>{trailingText}</Text> : null}
              </React.Fragment>
            );
          }

          return <Text key={part + '-' + index}>{part}</Text>;
        })}
      </NoTranslateText>
    );
  };
  const renderSystemContent = (message: ChatMessage) => {
    const content = sanitizeWarkopText(message.content || '');
    if (['WarkopBot', 'BambooBot'].includes(message.sender_name)) {
      const [headline = '', ...bodyLines] = content.split('\n');
      return (
        <View>
          {headline ? (
            <NoTranslateText style={[styles.systemText, styles.ecosystemTitle]} className="notranslate" translate="no">
              {headline}
            </NoTranslateText>
          ) : null}
          {bodyLines.length > 0 ? renderMentionedText(bodyLines.join('\n'), styles.systemText) : null}
        </View>
      );
    }

    return renderMentionedText(content, styles.systemText);
  };

  const renderAttachment = (message: ChatMessage) => {
    const messageType = message.message_type || 'text';
    if (!message.attachment_url) return null;

    if (messageType === 'image') {
      return (
        <TouchableOpacity onPress={() => openAttachment(message.attachment_url!)}>
          <Image source={{ uri: message.attachment_url }} style={styles.attachedImage} resizeMode="cover" />
        </TouchableOpacity>
      );
    }

    if (messageType === 'audio') return <AudioMessage url={message.attachment_url} />;

    return (
      <TouchableOpacity style={styles.documentAttachment} onPress={() => openAttachment(message.attachment_url!)}>
        <Ionicons name="document-text-outline" size={20} color={coffee.accent} />
        <Text style={styles.documentName} numberOfLines={1}>{message.content || 'Attachment'}</Text>
      </TouchableOpacity>
    );
  };

  const renderMember = ({ item }: { item: Member }) => {
    const displayName = item.display_name || item.username;
    const isMe = item.id === currentUserId;
    const isOnline = item.is_online || item.user_status === 'online';

    return (
      <View style={[styles.memberItem, isMe && styles.memberItemActive]}>
        {renderAvatar(displayName, item.avatar_url, 38)}
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName} numberOfLines={1}>{displayName}</Text>
            {isMe ? <Text style={styles.meBadge}>kamu</Text> : null}
          </View>
          <Text style={styles.memberHandle} numberOfLines={1}>@{normalizeUsername(item.username)}</Text>
          <Text style={[styles.presenceText, isOnline ? styles.presenceTextOnline : styles.presenceTextOffline]} numberOfLines={1}>
            {isOnline ? 'Online' : formatLastSeen(item.last_seen)}
          </Text>
        </View>
        <View style={[styles.presenceDot, isOnline ? styles.presenceDotOnline : styles.presenceDotOffline]} />
        <View style={styles.memberActions}>
          <TouchableOpacity style={styles.memberActionButton} onPress={() => insertMention(item)} accessibilityLabel={`Mention ${displayName}`}>
            <Ionicons name="at" size={17} color={coffee.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.memberActionButton, isMe && styles.memberActionDisabled]}
            onPress={() => startPrivateMessage(item)}
            disabled={isMe}
            accessibilityLabel={`Private message ${displayName}`}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={isMe ? coffee.muted : coffee.accent} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwn = item.sender_id === currentUserId;
    const isSystem = item.type === 'system' || item.type === 'tip';
    const mentionedUsers = item.mentioned_users || [];
    const normalizedActive = activeUsername ? normalizeUsername(activeUsername).toLowerCase() : '';
    const isMentioned = !!normalizedActive && mentionedUsers.map((username) => normalizeUsername(username).toLowerCase()).includes(normalizedActive);

    if (isSystem) {
      const isTip = item.type === 'tip';
      const systemSender = (item.sender_name || 'SISTEM').replace(/BambooBot/g, 'WarkopBot').replace(/BambooCS/g, 'NgopiCS');
      return (
        <View style={[styles.systemMessage, isTip ? styles.tipMessage : styles.joinMessage, isMentioned && styles.mentionedSystemMessage]}>
          <Text style={[styles.systemLabel, isTip ? styles.tipLabel : styles.joinLabel]}>{isTip ? `${TIP_ICON} TIPS` : `${SYSTEM_ICON} ${systemSender}`}</Text>
          {renderSystemContent(item)}
        </View>
      );
    }

    const displayContent = sanitizeWarkopText(item.message_text || item.content || '');
    const hasMediaOnly = (item.message_type || 'text') === 'image' || (item.message_type || 'text') === 'audio';
    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {!isOwn && renderAvatar(item.sender_name, item.avatar_url, 34)}
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble, isMentioned && styles.mentionedBubble]}>
          {!isOwn && <Text style={styles.senderName} numberOfLines={1}>{item.sender_name}</Text>}
          {renderAttachment(item)}
          {displayContent && !hasMediaOnly ? renderMentionedText(displayContent, styles.messageText) : null}
          <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  const renderDrawer = () => (
    <Modal visible={drawerVisible} transparent animationType={isCompact ? 'slide' : 'fade'} onRequestClose={() => setDrawerVisible(false)}>
      <View style={[styles.drawerOverlay, isCompact && styles.drawerOverlayCompact]}>
        <Pressable style={styles.drawerScrim} onPress={() => setDrawerVisible(false)} />
        <View style={[styles.drawerPanel, isCompact && styles.drawerPanelCompact]}>
          <View style={styles.drawerHeader}>
            <View>
              <Text style={styles.drawerTitle}>{ROOM_NAME}</Text>
              <Text style={styles.drawerSubtitle}>{roomSummaryLabel}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => setDrawerVisible(false)} accessibilityLabel="Tutup menu">
              <Ionicons name="close" size={22} color={coffee.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.drawerContent} contentContainerStyle={styles.drawerContentInner} showsVerticalScrollIndicator={false}>
          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Sapaan</Text>
            <TouchableOpacity style={styles.drawerAction} onPress={sendQuickGreeting}>
              <Ionicons name="hand-left-outline" size={18} color={coffee.accent} />
              <Text style={styles.drawerActionText}>Kirim sapaan</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Pencarian Pesan</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={coffee.secondary} />
              <TextInput style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholder="Cari pesan" placeholderTextColor={coffee.muted} />
            </View>
          </View>

          <View style={[styles.drawerSection, styles.membersSection]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.drawerSectionTitle}>DAFTAR USER/WARKOP</Text>
              <Text style={styles.memberCounter}>{visibleMembers.length}</Text>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={coffee.secondary} />
              <TextInput style={styles.searchInput} value={searchMemberQuery} onChangeText={setSearchMemberQuery} placeholder="Cari nama user..." placeholderTextColor={coffee.muted} />
            </View>
            <View style={styles.drawerMemberList}>
              {visibleMembers.length === 0 ? (
                <Text style={styles.emptyMembers}>{sortedMembers.length === 0 ? "Menghubungkan daftar anggota..." : "User tidak ditemukan"}</Text>
              ) : (
                visibleMembers.map((member) => <React.Fragment key={member.id}>{renderMember({ item: member })}</React.Fragment>)
              )}
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Menu Tambahan</Text>
            <View style={styles.menuGrid}>
              <TouchableOpacity style={[styles.menuTile, { backgroundColor: coffee.accentWash, borderColor: coffee.accent }]} onPress={() => {
                if (Platform.OS === 'web') {
                  window.location.assign('/alihbahasa');
                } else {
                  router.push('/(main)/alihbahasa' as any);
                }
              }}>
                <Ionicons name="mic" size={18} color={coffee.accent} />
                <Text style={[styles.menuTileText, { color: coffee.accent, fontWeight: 'bold' }]}>Alih Bahasa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuTile} onPress={() => router.push('/(main)/help-center')}>
                <Ionicons name="headset-outline" size={18} color={coffee.accent} />
                <Text style={styles.menuTileText}>Pusat Bantuan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuTile} onPress={() => router.push('/(main)/contacts')}>
                <Ionicons name="people-outline" size={18} color={coffee.accent} />
                <Text style={styles.menuTileText}>Kontak</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuTile} onPress={() => router.push('/privacy')}>
                <Ionicons name="shield-checkmark-outline" size={18} color={coffee.accent} />
                <Text style={styles.menuTileText}>Privasi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuTile} onPress={() => router.push('/terms')}>
                <Ionicons name="document-text-outline" size={18} color={coffee.accent} />
                <Text style={styles.menuTileText}>Ketentuan</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Poin Kopi Tebak-Tebakan</Text>
            <View style={styles.pointsCard}>
              <Text style={{ fontSize: 26 }}>☕</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.pointsValue}>{userPoints} Poin Kopi</Text>
                <Text style={styles.pointsSub}>Tercatat di @{activeUsername || 'kamu'}</Text>
                <Text style={styles.pointsHint}>Jawab benar tebak-tebakan warkop untuk +10 poin!</Text>
              </View>
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Pengaturan Room</Text>
            <View style={styles.infoRow}>
              <Ionicons name={socketConnected ? 'radio-button-on' : 'radio-button-off'} size={17} color={socketConnected ? coffee.success : coffee.warning} />
              <Text style={styles.infoText}>{socketConnected ? 'Live' : 'Menghubungkan'}</Text>
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Informasi Room</Text>
            <Text style={styles.roomInfoText}>Ruang komunitas publik ekosistem WARKOP untuk santai, tebak-tebakan lucu, mendengarkan musik, dan obrolan bebas tekanan.</Text>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, width < 600 && styles.headerCompact]}>
        <View style={styles.headerIdentity}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => (router.canGoBack() ? router.back() : setDrawerVisible(true))} accessibilityLabel="Kembali">
            <Ionicons name="arrow-back" size={22} color={coffee.text} />
          </TouchableOpacity>

          <Image source={require('../../assets/logo.png')} style={{ width: 36, height: 36 }} resizeMode="contain" accessibilityLabel="Warung Kopi" />

          <TouchableOpacity style={styles.headerTitleArea} onPress={() => setDrawerVisible(true)} activeOpacity={0.85}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>{ROOM_NAME}</Text>
              <Ionicons name="chevron-down" size={15} color={coffee.secondary} />
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{roomSummaryLabel} • {socketConnected ? 'Live' : 'Menghubungkan'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.headerActions, width < 600 && styles.headerActionsCompact]}>
          <TouchableOpacity
            style={styles.pointsBadgeHeader}
            onPress={() => setDrawerVisible(true)}
            accessibilityLabel={`Poin Kopi: ${userPoints}`}
          >
            <Text style={styles.pointsBadgeText}>☕ {userPoints} Poin</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push({ pathname: '/(main)/contacts', params: { createWarkop: '1' } })} accessibilityLabel="Buat Warkop baru">
            <Ionicons name="add-circle-outline" size={22} color={coffee.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: coffee.raised }]}
            onPress={() => router.push('/(main)/games' as any)}
            accessibilityLabel="Meja Warkop (Game)"
          >
            <Ionicons name="game-controller-outline" size={20} color={coffee.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: coffee.accentWash }]}
            onPress={() => {
              if (Platform.OS === 'web') {
                window.location.assign('/alihbahasa');
              } else {
                router.push('/(main)/alihbahasa' as any);
              }
            }}
            accessibilityLabel="Alih Bahasa Live Meeting"
          >
            <Ionicons name="mic" size={18} color={coffee.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setDrawerVisible(true)} accessibilityLabel="Cari pesan">
            <Ionicons name="search" size={20} color={coffee.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setDrawerVisible(true)} accessibilityLabel="Menu Warung Kopi">
            <Ionicons name="ellipsis-vertical" size={20} color={coffee.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push({ pathname: '/(main)/contacts', params: { openMenu: '1' } })}
            accessibilityLabel="Pengaturan akun"
          >
            <Ionicons name="settings-outline" size={20} color={coffee.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SPRINT 1: Suasana Warkop (Compact & Collapsible for maximum chat space) */}
      <ErrorBoundary name="SuasanaWarkop">
        <View style={styles.suasanaBarWrapper}>
          <View style={styles.suasanaCompactHeader}>
            <TouchableOpacity
              style={styles.suasanaToggleBtn}
              onPress={() => setSuasanaExpanded((prev) => !prev)}
              accessibilityLabel="Buka / Tutup Musik Jukebox"
            >
              <Text style={{ fontSize: 13 }}>☕</Text>
              <Text style={styles.suasanaToggleTitle}>SUASANA WARKOP</Text>
              <Ionicons name={suasanaExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={coffee.accent} />
            </TouchableOpacity>

            <AmbientPlayer />
          </View>

          {suasanaExpanded && (
            <View style={{ paddingTop: 4 }}>
              <JukeboxWidget warungId={ROOM_ID} />
            </View>
          )}
        </View>
      </ErrorBoundary>

      <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={[styles.messageListContent, visibleMessages.length === 0 && { flexGrow: 1, justifyContent: 'center' }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="☕"
              title="Selamat Datang di Warung Kopi!"
              description="Nongkrong santai, dengarkan musik bersama di Jukebox, dan nikmati obrolan tanpa tekanan medsos."
              primaryAction={{
                label: 'Sapa Warkop: "Halo semuanya! ☕"',
                onPress: () => setInputText('Halo semuanya! ☕'),
              }}
            />
          }
        />

        <View style={styles.composerWrap}>
          {mentionCandidates.length > 0 && (
            <View style={styles.mentionBox}>
              {mentionCandidates.map((member) => {
                const displayName = member.display_name || member.username;
                return (
                  <TouchableOpacity key={member.id} style={styles.mentionItem} onPress={() => insertMention(member)}>
                    {renderAvatar(displayName, member.avatar_url, 30)}
                    <View style={styles.mentionInfo}>
                      <Text style={styles.mentionName} numberOfLines={1}>{displayName}</Text>
                      <Text style={styles.mentionHandle} numberOfLines={1}>@{normalizeUsername(member.username)}</Text>
                    </View>
                    <View style={[styles.presenceDotSmall, member.is_online ? styles.presenceDotOnline : styles.presenceDotOffline]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Quick Emoji Selection if opened */}
          {showEmojiPicker && (
            <View style={styles.emojiPickerContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.emojiSectionTitle}>Pilih Emoji</Text>
                <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                  <Ionicons name="close" size={16} color={coffee.secondary} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {EMOJI_LIST.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiBtn}
                    onPress={() => setInputText((prev) => `${prev} ${emoji}`.trim())}
                  >
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quick Action Chips Bar (Tebak-tebakan, Poin, Sapa) */}
          <View style={styles.quickChipsBar}>
            <TouchableOpacity
              style={styles.quickChipBtn}
              onPress={() => {
                sendSocketMessage({ content: '/tebak', message_type: 'text' });
                setTimeout(() => {
                  appendMessage(createLocalRiddleMessage());
                }, 300);
              }}
              accessibilityLabel="Minta tebak-tebakan baru"
            >
              <Text style={styles.quickChipText}>🎯 Minta Tebakan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChipBtn}
              onPress={() => {
                sendSocketMessage({ content: '/poin', message_type: 'text' });
              }}
              accessibilityLabel="Cek poin kopi saya"
            >
              <Text style={styles.quickChipText}>⭐ Poin: {userPoints} Pts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChipBtn}
              onPress={() => {
                setInputText('Halo kawan warkop! ☕');
              }}
              accessibilityLabel="Sapa warkop"
            >
              <Text style={styles.quickChipText}>☕ Sapa Warung</Text>
            </TouchableOpacity>
          </View>

          {/* Modern Unified Single-Row Input Bar */}
          <View style={styles.inputBarRow}>
            <TouchableOpacity style={styles.inlineActionBtn} onPress={pickDocument} accessibilityLabel="Kirim file">
              <Ionicons name="attach" size={20} color={coffee.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.inlineActionBtn} onPress={pickImage} accessibilityLabel="Kirim gambar">
              <Ionicons name="camera-outline" size={20} color={coffee.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inlineActionBtn, showEmojiPicker && { backgroundColor: coffee.button }]}
              onPress={() => setShowEmojiPicker((prev) => !prev)}
              accessibilityLabel="Buka pilihan emoji"
            >
              <Ionicons name="happy-outline" size={20} color={showEmojiPicker ? coffee.buttonText : coffee.secondary} />
            </TouchableOpacity>

            <TextInput
              style={styles.textInputCompact}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ketik pesan di Warung Kopi..."
              placeholderTextColor={coffee.muted}
              multiline
              maxLength={1000}
              onSubmitEditing={Platform.OS === 'web' ? sendMessage : undefined}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              style={[styles.voiceBtnCompact, isRecording && styles.recordingButton]}
              onPress={toggleRecording}
              accessibilityLabel={isRecording ? 'Stop voice note' : 'Voice note'}
            >
              <Ionicons name={isRecording ? 'stop' : 'mic'} size={18} color={coffee.buttonText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendBtnCompact, !hasDraft && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!hasDraft}
              accessibilityLabel="Kirim pesan"
            >
              <Ionicons name="send" size={17} color={coffee.buttonText} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {renderDrawer()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', minWidth: 0, overflow: 'hidden', backgroundColor: coffee.background },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.surface,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    zIndex: 5,
  },
  headerCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerActionsCompact: { justifyContent: 'flex-end' },
  headerIconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  headerTitleArea: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  headerTitle: { color: coffee.text, fontSize: 18, fontWeight: '800', marginRight: 4, flexShrink: 1 },
  headerSubtitle: { color: coffee.secondary, fontSize: 11, marginTop: 1 },
  chatArea: { flex: 1, minHeight: 0 },
  suasanaBarWrapper: {
    backgroundColor: coffee.surface,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  suasanaCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  suasanaToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: coffee.raised,
  },
  suasanaToggleTitle: {
    color: coffee.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  messageList: { flex: 1, minHeight: 0, backgroundColor: coffee.background },
  messageListContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  messageRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-start' },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, minWidth: 72 },
  ownBubble: { backgroundColor: coffee.button, borderBottomRightRadius: 6 },
  otherBubble: { backgroundColor: coffee.surface, borderBottomLeftRadius: 6, marginLeft: 8, borderWidth: 1, borderColor: coffee.raised },
  mentionedBubble: { borderWidth: 1, borderColor: coffee.accent, shadowColor: coffee.accent, shadowOpacity: 0.22, shadowRadius: 8 },
  senderName: { color: coffee.accent, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  messageText: { color: coffee.text, fontSize: 15, lineHeight: 21 },
  mentionText: { color: coffee.accent, fontWeight: '800' },
  linkText: { color: coffee.accent, fontWeight: '700', textDecorationLine: 'underline' },
  messageTime: { color: coffee.secondary, fontSize: 10, alignSelf: 'flex-end', marginTop: 5 },
  systemMessage: { alignSelf: 'center', width: '100%', maxWidth: 760, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  joinMessage: { backgroundColor: coffee.highlight, borderLeftWidth: 3, borderLeftColor: coffee.accent },
  tipMessage: { backgroundColor: coffee.highlight, borderLeftWidth: 3, borderLeftColor: coffee.success },
  mentionedSystemMessage: { borderWidth: 1, borderColor: coffee.accent },
  systemLabel: { fontSize: 11, fontWeight: '900', marginBottom: 5 },
  joinLabel: { color: coffee.accent },
  tipLabel: { color: coffee.accent },
  systemText: { color: coffee.text, fontSize: 14, lineHeight: 21 },
  ecosystemTitle: { color: coffee.text, fontSize: 15, fontWeight: '900', marginBottom: 4 },
  composerWrap: {
    backgroundColor: coffee.surface,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  emojiPickerContainer: {
    backgroundColor: coffee.raised,
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  emojiSectionTitle: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '800',
  },
  emojiBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: coffee.surface,
  },
  inputBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInputCompact: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    borderRadius: 20,
    backgroundColor: coffee.background,
    color: coffee.text,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    outlineStyle: 'none' as any,
  },
  voiceBtnCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: coffee.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: coffee.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: coffee.border,
    opacity: 0.5,
  },
  recordingButton: { backgroundColor: coffee.dangerButton },
  mentionBox: { backgroundColor: coffee.surface, borderWidth: 1, borderColor: coffee.highlight, borderRadius: 8, marginBottom: 10, overflow: 'hidden' },
  mentionItem: { minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: coffee.raised },
  mentionInfo: { flex: 1, minWidth: 0, marginLeft: 8 },
  mentionName: { color: coffee.text, fontSize: 13, fontWeight: '800' },
  mentionHandle: { color: coffee.accent, fontSize: 12, marginTop: 2 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyChatIcon: { width: 64, height: 64, marginBottom: 12 },
  emptyChatTitle: { color: coffee.secondary, fontSize: 15, fontWeight: '700' },
  avatar: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: coffee.text, fontWeight: '900' },
  drawerOverlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  drawerOverlayCompact: { justifyContent: 'flex-end' },
  drawerScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: coffee.overlay },
  drawerPanel: { width: 380, maxWidth: '100%', height: '100%', backgroundColor: coffee.surface, borderLeftWidth: 1, borderLeftColor: coffee.raised, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 0 },
  drawerPanelCompact: { width: '100%', height: '88%', alignSelf: 'flex-end', borderLeftWidth: 0, borderTopWidth: 1, borderTopColor: coffee.raised, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: coffee.raised },
  drawerContent: { flex: 1 },
  drawerContentInner: { paddingBottom: 28 },
  drawerTitle: { color: coffee.text, fontSize: 18, fontWeight: '900' },
  drawerSubtitle: { color: coffee.secondary, fontSize: 12, marginTop: 3 },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: coffee.surface, alignItems: 'center', justifyContent: 'center' },
  drawerSection: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: coffee.surface },
  membersSection: { minHeight: 160 },
  drawerSectionTitle: { color: coffee.accent, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0, marginBottom: 8 },
  drawerAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 8, backgroundColor: coffee.highlight },
  drawerActionText: { color: coffee.text, fontSize: 14, fontWeight: '800' },
  searchBox: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: coffee.surface, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: coffee.raised },
  searchInput: { flex: 1, color: coffee.text, fontSize: 14, outlineStyle: 'none' as any },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberCounter: { color: coffee.accent, fontSize: 12, fontWeight: '900' },
  drawerMemberList: { paddingBottom: 8 },
  memberItem: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, marginBottom: 4 },
  memberItemActive: { backgroundColor: coffee.highlight },
  memberInfo: { flex: 1, minWidth: 0, marginLeft: 10 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 6 },
  memberName: { color: coffee.text, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  meBadge: { color: coffee.buttonText, backgroundColor: coffee.button, borderRadius: 7, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 1, fontSize: 10, fontWeight: '900' },
  memberHandle: { color: coffee.muted, fontSize: 12, marginTop: 2 },
  presenceText: { fontSize: 11, marginTop: 3 },
  presenceTextOnline: { color: coffee.accent },
  presenceTextOffline: { color: coffee.secondary },
  presenceDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 8 },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  memberActionButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: coffee.surface, borderWidth: 1, borderColor: coffee.highlight, alignItems: 'center', justifyContent: 'center' },
  memberActionDisabled: { opacity: 0.45 },
  presenceDotSmall: { width: 8, height: 8, borderRadius: 4 },
  presenceDotOnline: { backgroundColor: coffee.success },
  presenceDotOffline: { backgroundColor: coffee.muted },
  emptyMembers: { color: coffee.muted, fontSize: 12, textAlign: 'center', marginTop: 18 },
  menuGrid: { flexDirection: 'row', gap: 8 },
  menuTile: { flex: 1, minHeight: 42, borderRadius: 8, backgroundColor: coffee.surface, borderWidth: 1, borderColor: coffee.raised, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  menuTileText: { color: coffee.text, fontSize: 13, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { color: coffee.text, fontSize: 13, fontWeight: '700' },
  roomInfoText: { color: coffee.secondary, fontSize: 13, lineHeight: 20 },
  attachedImage: { width: 250, maxWidth: '100%' as any, height: 180, borderRadius: 8, marginBottom: 6, backgroundColor: coffee.background },
  audioPlayer: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 4 },
  audioText: { color: coffee.text, fontSize: 14, fontWeight: '700' },
  documentAttachment: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: coffee.overlay, paddingHorizontal: 10, marginBottom: 5 },
  documentName: { color: coffee.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  pointsBadgeHeader: {
    backgroundColor: coffee.raised,
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsBadgeText: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.raised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    padding: 12,
  },
  pointsValue: {
    color: coffee.accent,
    fontSize: 16,
    fontWeight: '900',
  },
  pointsSub: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  pointsHint: {
    color: coffee.muted,
    fontSize: 11,
    marginTop: 2,
  },
  quickChipsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  quickChipBtn: {
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  quickChipText: {
    fontSize: 11,
    color: coffee.text,
    fontWeight: '700',
  },
});








