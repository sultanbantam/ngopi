import { coffee } from '../../../src/theme/coffee';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Image, Linking, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { socketService } from '../../../src/utils/socket';
import { encryptMessage, decryptMessage } from '../../../src/utils/crypto';
import { deriveSharedSecret, isValidPublicKey, NACL_SECRET_PREFIX } from '../../../src/utils/e2ee';
import * as SecureStore from '../../../src/utils/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import axios from 'axios';
import BambupediaRoom from '../warkop';
import { Ionicons } from '@expo/vector-icons';
import { getMimeType } from '../../../src/utils/fileHelpers';
import { API_URL } from '../../../src/utils/session';

const NoTranslateText = Text as any;
const API_ORIGIN = 'https://api.ngopi.top';
const emojiOptions = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}', '\u{1F525}', '\u{1F389}', '\u{1F60D}', '\u{1F914}', '\u{1F605}', '\u{1F973}'];

const normalizeAttachmentUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://api.ngopi.top')) return url.replace('http://', 'https://');
  if (url.startsWith('/uploads/')) return `${API_ORIGIN}${url}`;
  return url;
};

const looksEncrypted = (value?: string | null) => !!value && (value.startsWith('U2FsdGVkX1') || value.startsWith('nacl:v1:'));

const decodeMessageContent = (content: unknown, type: string | undefined, secretKey: string) => {
  if (typeof content !== 'string' || !content) return '';
  if ((type === 'text' || type === 'document') && looksEncrypted(content)) {
    return decryptMessage(content, secretKey);
  }
  return content;
};

interface Message {
  id: string;
  sender_id: string;
  content?: string; // Will store decrypted content in state
  isMine: boolean;
  timestamp: string;
  isRead?: boolean;
  type?: string;
  attachment_url?: string;
  reactions?: Record<string, string>;
  is_edited?: boolean;
  is_pinned?: boolean;
  reply_to_id?: string;
  sender?: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}
const AudioMessage = ({ url }: { url: string }) => {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.audioPlayer}>
        <audio controls src={url} style={{ height: 30, width: 200, outline: 'none' }} />
      </View>
    );
  }

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);
        newSound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            newSound.setPositionAsync(0);
          }
        });
      }
    } catch (err) {
      console.error('Error playing audio', err);
    }
  };

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  return (
    <TouchableOpacity style={styles.audioPlayer} onPress={playSound}>
      <Text style={styles.audioText}>{isPlaying ? 'Pause' : 'Play'} Voice Note</Text>
    </TouchableOpacity>
  );
};

export default function ChatRoomScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const routeLabel = `${rawName || ''} ${rawId || ''}`;
  const isBambupediaLink = rawType !== 'group' && (/bamboo(cs|pedia)|rumpun/i.test(routeLabel) || rawId === 'bambupedia');

  useEffect(() => {
    if (isBambupediaLink) router.replace('/(main)/warkop');
  }, [isBambupediaLink, router]);

  if (isBambupediaLink) return <BambupediaRoom />;
  return <PrivateChatRoomScreen />;
}

function PrivateChatRoomScreen() {
  const { id: roomId, name, type } = useLocalSearchParams();
  const chatType = Array.isArray(type) ? type[0] : type;
  const isGroupChat = chatType === 'group';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [actualRoomId, setActualRoomId] = useState('');

  // Pagination state
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Auto-scroll control
  const shouldAutoScroll = useRef(true);

  // Real-time states
  const [isTyping, setIsTyping] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<string>('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attachments
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const webMediaRecorderRef = useRef<any>(null);
  const webAudioChunksRef = useRef<Blob[]>([]);

  // WhatsApp Features State
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);

  // Chat Enhancements State
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Online Contacts State
  const [rawOnlineList, setRawOnlineList] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [myUserId, setMyUserId] = useState<string>('');
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [isGroupInfoVisible, setIsGroupInfoVisible] = useState(false);
  const [isGroupDetailsLoading, setIsGroupDetailsLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const currentRoomId = Array.isArray(roomId) ? roomId[0] : (roomId as string);
  const chatTitle = Array.isArray(name) ? name[0] : (name as string) || 'Chat Room';
  const groupMembers = groupDetails?.members || [];
  const activeGroupMembers = groupMembers.filter((member: any) => member.status === 'active');
  const onlineGroupMembers = activeGroupMembers.filter((member: any) => member.is_online);
  const pendingGroupMembers = groupMembers.filter((member: any) => member.status === 'pending');
  const groupMemberIds = new Set(groupMembers.map((member: any) => member.user_id));
  const availableGroupUsers = allUsers.filter(user => user.id !== myUserId && !groupMemberIds.has(user.id));

  const getAuthToken = async () => {
    if (Platform.OS === 'web') return localStorage.getItem('token') || '';
    return (await SecureStore.getItemAsync('token')) || '';
  };

  const loadGroupDetails = async () => {
    if (!isGroupChat || !currentRoomId) return;
    try {
      setIsGroupDetailsLoading(true);
      const token = await getAuthToken();
      const res = await axios.get(`${API_ORIGIN}/api/groups/${currentRoomId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroupDetails(res.data);
    } catch (error) {
      console.error('Failed to load group details', error);
    } finally {
      setIsGroupDetailsLoading(false);
    }
  };

  const copyInviteLink = async () => {
    const link = groupDetails?.invite_url;
    if (!link) return;
    if (Platform.OS === 'web' && navigator?.clipboard) {
      await navigator.clipboard.writeText(link);
      alert('Link undangan disalin.');
      return;
    }
    alert(link);
  };

  const regenerateInviteLink = async () => {
    try {
      const token = await getAuthToken();
      const res = await axios.post(`${API_ORIGIN}/api/groups/${currentRoomId}/invite/regenerate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroupDetails((prev: any) => ({ ...prev, invite_code: res.data.invite_code, invite_url: res.data.invite_url }));
      alert('Link undangan baru sudah dibuat.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Gagal membuat ulang link undangan.');
    }
  };

  const addSelectedGroupMember = async () => {
    if (!selectedMemberId) {
      alert('Pilih user yang mau ditambahkan.');
      return;
    }
    try {
      const token = await getAuthToken();
      await axios.post(`${API_ORIGIN}/api/groups/${currentRoomId}/members`, { userId: selectedMemberId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMemberId('');
      await loadGroupDetails();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Gagal menambahkan user.');
    }
  };

  const approveGroupMember = async (userId: string) => {
    try {
      const token = await getAuthToken();
      await axios.post(`${API_ORIGIN}/api/groups/${currentRoomId}/members/${userId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadGroupDetails();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Gagal menyetujui member.');
    }
  };

  const updateGroupMemberRole = async (userId: string, role: 'admin' | 'member') => {
    try {
      const token = await getAuthToken();
      await axios.patch(`${API_ORIGIN}/api/groups/${currentRoomId}/members/${userId}/role`, { role }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadGroupDetails();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Gagal mengubah role member.');
    }
  };

  const removeGroupMember = async (userId: string) => {
    try {
      const token = await getAuthToken();
      await axios.delete(`${API_ORIGIN}/api/groups/${currentRoomId}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadGroupDetails();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Gagal menghapus member.');
    }
  };

  const openGroupInfo = () => {
    setIsGroupInfoVisible(true);
    loadGroupDetails();
  };

  const getSenderLabel = (item: Message) => {
    const fromPayload = item.sender?.display_name || item.sender?.username;
    if (fromPayload) return fromPayload;
    const fromDirectory = allUsers.find(user => user.id === item.sender_id);
    return fromDirectory?.display_name || fromDirectory?.username || 'Anggota Warkop';
  };

  useEffect(() => {
    const cleanupSocketListeners: Array<() => void> = [];

    const initRoom = async () => {
      // Create a shared symmetric key for E2EE based on sorted IDs
      let myId = '';
      if (Platform.OS === 'web') {
        myId = localStorage.getItem('userId') || '';
      } else {
        myId = (await SecureStore.getItemAsync('userId')) || '';
      }

      const partnerId = roomId as string;
      const roomKey = isGroupChat ? partnerId : [myId, partnerId].sort().join('-');
      let encryptionSecret = roomKey;
      setSecretKey(roomKey);
      setActualRoomId(roomKey);
      setMyUserId(myId);

      // Fetch history
      try {
        const token = await SecureStore.getItemAsync('token') || localStorage.getItem('token');
        const usersResponse = await axios.get(`https://api.ngopi.top/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userDirectory = Array.isArray(usersResponse.data) ? usersResponse.data : [];
        setAllUsers(userDirectory);

        if (!isGroupChat) {
          const privateKey = Platform.OS === 'web' ? localStorage.getItem('private_key') || '' : (await SecureStore.getItemAsync('private_key')) || '';
          const partner = userDirectory.find((item: any) => item.id === partnerId);
          if (privateKey && isValidPublicKey(partner?.public_key)) {
            encryptionSecret = `${NACL_SECRET_PREFIX}${deriveSharedSecret(privateKey, partner.public_key)}`;
          }
        }
        setSecretKey(encryptionSecret);

        const response = await axios.get(`https://api.ngopi.top/api/messages/${roomKey}?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = response.data;
        const messageList = Array.isArray(data) ? data : (data.messages || []);
        const history = messageList.map((msg: any) => {
          const messageType = msg.type || 'text';
          return {
            id: msg.id,
            sender_id: msg.sender_id,
            content: decodeMessageContent(msg.content, messageType, encryptionSecret),
            isMine: msg.sender_id === myId,
            timestamp: msg.timestamp,
            isRead: msg.is_read,
            type: messageType,
            attachment_url: normalizeAttachmentUrl(msg.attachment_url),
            reactions: msg.reactions || {},
            is_edited: msg.is_edited,
            is_pinned: msg.is_pinned
          };
        });
        setMessages(history);
        setHasMoreMessages(data.hasMore ?? false);
        setNextCursor(data.nextCursor ?? undefined);
        // Auto-scroll will be triggered by onContentSizeChange
      } catch (err) {
        console.error('Failed to fetch history', err);
      }

      // Join room
      const socket = await socketService.connect();
      if (socket) {
        socket.emit('join_room', roomKey);

        const handleReceiveMessage = (data: any) => {
          if (data.room_id !== roomKey) return;
          if (data.sender_id === myId) return;

          const messageType = data.type || 'text';
          setMessages(prev => [...prev, {
            id: data.id || Math.random().toString(),
            sender_id: data.sender_id,
            content: decodeMessageContent(data.content, messageType, encryptionSecret),
            isMine: false,
            timestamp: new Date().toISOString(),
            type: messageType,
            attachment_url: normalizeAttachmentUrl(data.attachment_url),
            reactions: data.reactions || {},
            is_edited: data.is_edited,
            is_pinned: data.is_pinned
          }]);
          // Auto-scroll to bottom on new message
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);

          socket.emit('mark_messages_read', { sender_id: data.sender_id, room_id: roomKey });
        };

        const handleSocketError = (err: any) => {
          alert(`Error: ${err.message}`);
        };

        const handleTypingStart = () => setIsTyping(true);
        const handleTypingStop = () => setIsTyping(false);

        const handleUserStatusChange = (data: any) => {
          if (data.user_id === roomId) {
            setPartnerStatus(data.is_online ? 'Online' : data.last_seen ? `Last seen: ${new Date(data.last_seen).toLocaleTimeString()}` : '');
          }
        };

        const handleMessagesRead = (data: any) => {
          if (data.room_id === roomKey) {
            setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
          }
        };

        const handleMessageReacted = (data: any) => {
          setMessages(prev => prev.map(msg => msg.id === data.id ? { ...msg, reactions: data.reactions } : msg));
        };

        const handleMessageEdited = (data: any) => {
          setMessages(prev => prev.map(msg => {
            if (msg.id === data.id) {
              return { ...msg, content: decodeMessageContent(data.content, data.type, encryptionSecret), is_edited: true, sender: data.sender || msg.sender };
            }
            return msg;
          }));
        };

        const handleMessagePinned = (data: any) => {
          setMessages(prev => prev.map(msg => msg.id === data.id ? { ...msg, is_pinned: data.is_pinned } : msg));
        };

        const handleMessageDeleted = (data: any) => {
          setMessages(prev => prev.filter(msg => msg.id !== data.id));
        };

        const handleOnlineList = (data: any[]) => {
          setRawOnlineList(data);
        };


        socket.on('receive_message', handleReceiveMessage);
        socket.on('error', handleSocketError);
        socket.on('typing_start', handleTypingStart);
        socket.on('typing_stop', handleTypingStop);
        socket.on('user_status_change', handleUserStatusChange);
        socket.on('messages_read', handleMessagesRead);
        socket.on('message_reacted', handleMessageReacted);
        socket.on('message_edited', handleMessageEdited);
        socket.on('message_pinned', handleMessagePinned);
        socket.on('message_deleted', handleMessageDeleted);
        socket.on('online_list', handleOnlineList);

        cleanupSocketListeners.push(() => {
          socket.off('receive_message', handleReceiveMessage);
          socket.off('error', handleSocketError);
          socket.off('typing_start', handleTypingStart);
          socket.off('typing_stop', handleTypingStop);
          socket.off('user_status_change', handleUserStatusChange);
          socket.off('messages_read', handleMessagesRead);
          socket.off('message_reacted', handleMessageReacted);
          socket.off('message_edited', handleMessageEdited);
          socket.off('message_pinned', handleMessagePinned);
          socket.off('message_deleted', handleMessageDeleted);
          socket.off('online_list', handleOnlineList);
        });

        socket.emit('request_online_list');
        socket.emit('mark_messages_read', { sender_id: partnerId, room_id: roomKey });
      }
    };
    initRoom();

    return () => {
      cleanupSocketListeners.forEach((cleanup) => cleanup());
    };
  }, [roomId]);

  const sendMessage = () => {
    if (!inputText.trim()) return;

    if (inputText.trim().toLowerCase() === '/cs') {
      setInputText('');
      router.push('/(main)/help-center' as any);
      return;
    }

    if (isEditing && editingMessageId) {
      if (socketService.socket) {
        // E2EE: Encrypt the new content
        const ciphertext = encryptMessage(inputText.trim(), secretKey);
        socketService.socket.emit('edit_message', {
          message_id: editingMessageId,
          room_id: actualRoomId,
          receiver_id: isGroupChat ? undefined : roomId,
          new_content: ciphertext
        });

        setMessages(prev => prev.map(msg =>
          msg.id === editingMessageId ? { ...msg, content: inputText.trim(), is_edited: true } : msg
        ));
      }
      setIsEditing(false);
      setEditingMessageId(null);
      setInputText('');
      return;
    }

    // E2EE: Encrypt the message before sending
    const ciphertext = encryptMessage(inputText.trim(), secretKey);

    const messageData = {
      room_id: actualRoomId,
      receiver_id: isGroupChat ? undefined : roomId, // Pass receiver_id only for private chats
      content: ciphertext,
      reply_to_id: replyingToMessageId
    };

    if (socketService.socket) {
      socketService.socket.emit('send_message', messageData);
    }

    // Add locally for optimistic UI
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender_id: 'me',
      content: inputText.trim(),
      isMine: true,
      timestamp: new Date().toISOString()
    }]);

    setInputText('');
    setReplyingToMessageId(null);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  };

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (socketService.socket && actualRoomId) {
      socketService.socket.emit('typing_start', { room_id: actualRoomId, receiver_id: isGroupChat ? undefined : roomId });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socketService.socket?.emit('typing_stop', { room_id: actualRoomId, receiver_id: isGroupChat ? undefined : roomId });
      }, 1500);
    }
  };

  // Load older messages (pagination)
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !nextCursor) return;
    setIsLoadingMore(true);
    try {
      const token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      const response = await axios.get(`https://api.ngopi.top/api/messages/${actualRoomId}?cursor=${nextCursor}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      const messageList = Array.isArray(data) ? data : (data.messages || []);
      const olderMessages = messageList.map((msg: any) => {
        const messageType = msg.type || 'text';
        return {
          id: msg.id,
          sender_id: msg.sender_id,
          content: decodeMessageContent(msg.content, messageType, secretKey),
          isMine: msg.sender_id === myUserId,
          timestamp: msg.timestamp,
          isRead: msg.is_read,
          type: messageType,
          attachment_url: normalizeAttachmentUrl(msg.attachment_url),
          reactions: msg.reactions || {},
          is_edited: msg.is_edited,
          is_pinned: msg.is_pinned
        };
      });
      // Prepend older messages
      setMessages(prev => [...olderMessages, ...prev]);
      setHasMoreMessages(data.hasMore ?? false);
      setNextCursor(data.nextCursor ?? undefined);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const uploadFile = async (uri: string, type: string, originalName?: string, mimeType?: string, rawFile?: any) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
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
            const res = await fetch(uri);
            const blob = await res.blob();
            fileObj = new File([blob], fallbackName, { type: resolvedMime || blob.type || 'application/octet-stream' });
          } catch (fetchErr: any) {
            console.warn('Fetch uri failed:', fetchErr);
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
      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });
      return normalizeAttachmentUrl(response.data.url);
    } catch (error: any) {
      console.error('Upload failed:', error?.response?.data || error?.message || error);
      const errMsg = error?.response?.data?.error || error?.message || 'Gagal mengunggah file';
      alert(`Upload failed: ${errMsg}`);
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `image_${Date.now()}.${asset.mimeType?.split('/')[1] || 'jpg'}`;
      const url = await uploadFile(asset.uri, 'image', fileName, asset.mimeType, (asset as any).file);

      if (url) {
        // Send image message
        const messageData = {
          room_id: actualRoomId,
          receiver_id: isGroupChat ? undefined : roomId,
          type: 'image',
          attachment_url: url
        };
        if (socketService.socket) {
          socketService.socket.emit('send_message', messageData);
        }
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender_id: 'me',
          isMine: true,
          timestamp: new Date().toISOString(),
          type: 'image',
          attachment_url: url
        }]);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      }
    }
  };

  const pickDocument = async () => {
    let result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const doc = result.assets[0];
      const url = await uploadFile(doc.uri, 'document', doc.name, doc.mimeType, (doc as any).file);

      if (url) {
        // We will store the original file name in the content (encrypted)
        const encryptedName = encryptMessage(doc.name, secretKey);
        const messageData = {
          room_id: actualRoomId,
          receiver_id: isGroupChat ? undefined : roomId,
          type: 'document',
          content: encryptedName,
          attachment_url: url
        };
        if (socketService.socket) {
          socketService.socket.emit('send_message', messageData);
        }
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender_id: 'me',
          isMine: true,
          content: doc.name,
          timestamp: new Date().toISOString(),
          type: 'document',
          attachment_url: url
        }]);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      }
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        webAudioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) webAudioChunksRef.current.push(e.data);
        };
        mediaRecorder.start();
        webMediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } else {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync( Audio.RecordingOptionsPresets.HIGH_QUALITY );
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err: any) {
      console.error('Failed to start recording', err);
      alert('Gagal merekam: ' + err.message);
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
        const fileObj = new File([audioBlob], 'upload.webm', { type: 'audio/webm' });
        formData.append('file', fileObj);

        try {
          const token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
          const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const response = await axios.post(`${API_URL}/upload`, formData, { headers });
          const url = normalizeAttachmentUrl(response.data.url);

          if (url) {
            const messageData = { room_id: actualRoomId, receiver_id: isGroupChat ? undefined : roomId, type: 'audio', attachment_url: url };
            if (socketService.socket) socketService.socket.emit('send_message', messageData);

            setMessages(prev => [...prev, {
              id: Math.random().toString(), sender_id: 'me', isMine: true,
              timestamp: new Date().toISOString(), type: 'audio', attachment_url: url
            }]);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
          }
        } catch (e) {
          console.error('Upload failed', e);
        }
      };
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((t: any) => t.stop());
      webMediaRecorderRef.current = null;
    } else {
      if (!recording) return;
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        const url = await uploadFile(uri, 'audio');
        if (url) {
          // Send audio message
          const messageData = {
            room_id: actualRoomId,
            receiver_id: isGroupChat ? undefined : roomId,
            type: 'audio',
            attachment_url: url
          };
          if (socketService.socket) {
            socketService.socket.emit('send_message', messageData);
          }
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            sender_id: 'me',
            isMine: true,
            timestamp: new Date().toISOString(),
            type: 'audio',
            attachment_url: url
          }]);
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        }
      }
    }
  };

  // Menu Actions
  const handleReact = (emoji: string) => {
    if (selectedMessage && socketService.socket) {
      socketService.socket.emit('react_message', {
        message_id: selectedMessage.id,
        room_id: actualRoomId,
        receiver_id: isGroupChat ? undefined : roomId,
        emoji
      });
      // Optimistic update
      setMessages(prev => prev.map(msg => {
        if (msg.id === selectedMessage.id) {
          const reactions = { ...msg.reactions };
          // For simplicity, we just use 'me' as key for optimistic update
          if (reactions['me'] === emoji) delete reactions['me'];
          else reactions['me'] = emoji;
          return { ...msg, reactions };
        }
        return msg;
      }));
    }
    setIsMenuVisible(false);
  };

  const handleEdit = () => {
    if (selectedMessage) {
      setIsEditing(true);
      setEditingMessageId(selectedMessage.id);
      setInputText(selectedMessage.content || '');
    }
    setIsMenuVisible(false);
  };

  const handlePin = () => {
    if (selectedMessage && socketService.socket) {
      const newPinStatus = !selectedMessage.is_pinned;
      socketService.socket.emit('pin_message', {
        message_id: selectedMessage.id,
        room_id: actualRoomId,
        receiver_id: isGroupChat ? undefined : roomId,
        is_pinned: newPinStatus
      });
      // Optimistic
      setMessages(prev => prev.map(msg => msg.id === selectedMessage.id ? { ...msg, is_pinned: newPinStatus } : msg));
    }
    setIsMenuVisible(false);
  };

  const handleCopy = () => {
    if (selectedMessage && selectedMessage.type === 'text') {
      if (Platform.OS === 'web') {
        navigator.clipboard.writeText(selectedMessage.content || '');
      }
    }
    setIsMenuVisible(false);
  };

  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);

  const handleReply = () => {
    if (selectedMessage) {
      setReplyingToMessageId(selectedMessage.id);
    }
    setIsMenuVisible(false);
  };

  const [isForwardModalVisible, setIsForwardModalVisible] = useState(false);
  const [forwardContacts, setForwardContacts] = useState<any[]>([]);
  const [forwardGroups, setForwardGroups] = useState<any[]>([]);

  const handleForwardClick = async () => {
    setIsMenuVisible(false);
    setIsForwardModalVisible(true);
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [usersRes, groupsRes] = await Promise.all([
        axios.get(`https://api.ngopi.top/api/auth/users`, { headers }),
        axios.get(`https://api.ngopi.top/api/groups`, { headers })
      ]);
      let myId = Platform.OS === 'web' ? localStorage.getItem('userId') : await SecureStore.getItemAsync('userId');
      setForwardContacts(usersRes.data.filter((u: any) => u.id !== myId));
      setForwardGroups(groupsRes.data);
    } catch (e) {
      console.error('Failed to fetch for forward', e);
    }
  };

  const confirmForward = async (targetId: string) => {
    let myId = Platform.OS === 'web' ? localStorage.getItem('userId') : await SecureStore.getItemAsync('userId');
    const target_room_id = [myId, targetId].sort().join('-');
    if (selectedMessage && socketService.socket) {
      socketService.socket.emit('forward_message', {
        message_id: selectedMessage.id,
        target_room_id: target_room_id
      });
      setIsForwardModalVisible(false);
      if (Platform.OS === 'web') alert('Pesan diteruskan');
    }
  };

  const handleDeleteSelf = () => {
    if (selectedMessage && socketService.socket) {
      socketService.socket.emit('delete_message', {
        message_id: selectedMessage.id,
        room_id: actualRoomId,
        receiver_id: isGroupChat ? undefined : roomId,
        for_everyone: false
      });
      setMessages(prev => prev.filter(msg => msg.id !== selectedMessage.id));
    }
    setIsMenuVisible(false);
  };

  const handleDeleteEveryone = () => {
    if (selectedMessage && socketService.socket) {
      socketService.socket.emit('delete_message', {
        message_id: selectedMessage.id,
        room_id: actualRoomId,
        receiver_id: isGroupChat ? undefined : roomId,
        for_everyone: true
      });
      setMessages(prev => prev.filter(msg => msg.id !== selectedMessage.id));
    }
    setIsMenuVisible(false);
  };

  const getAttachmentFilename = (message: Message) => {
    if (message.content) return message.content;
    if (message.type === 'image') return 'image.jpg';
    if (message.type === 'audio') return 'voice-message.webm';
    return 'document.pdf';
  };

  const downloadFile = async (url: string, filename: string) => {
    const safeUrl = normalizeAttachmentUrl(url);
    const safeFilename = filename || 'download';

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(safeUrl);
        if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download failed, opening attachment instead:', error);
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      Linking.openURL(safeUrl).catch(e => console.error('Failed to open URL', e));
    }
  };

  const handleDownloadSelected = () => {
    if (selectedMessage?.attachment_url) {
      downloadFile(selectedMessage.attachment_url, getAttachmentFilename(selectedMessage));
    }
    setIsMenuVisible(false);
  };

  const renderReactions = (reactions?: Record<string, string>) => {
    if (!reactions) return null;
    const values = Object.values(reactions);
    if (values.length === 0) return null;
    return (
      <View style={styles.reactionsContainer}>
        {values.map((v, i) => (
          <Text key={i} style={styles.reactionText}>{v}</Text>
        ))}
      </View>
    );
  };

  const pinnedMessage = messages.find(m => m.is_pinned);

  const filteredMessages = React.useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const lowerQuery = searchQuery.toLowerCase();
    return messages.filter(m => {
      const text = m.content || m.attachment_url || '';
      return text.toLowerCase().includes(lowerQuery);
    });
  }, [messages, searchQuery]);

  const onlineUsersList = React.useMemo(() => {
    return rawOnlineList
      .filter(u => u.is_online && u.id !== myUserId && u.id !== roomId)
      .map(u => allUsers.find(user => user.id === u.id))
      .filter(Boolean);
  }, [rawOnlineList, allUsers, myUserId, roomId]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* WhatsApp Custom Header */}
      <View style={styles.customHeader}>
        {isSearchMode ? (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => { setIsSearchMode(false); setSearchQuery(''); }}>
              <Ionicons name="arrow-back" size={22} color={coffee.text} />
            </TouchableOpacity>
            <TextInput
              style={{ flex: 1, color: coffee.text, fontSize: 16, paddingHorizontal: 10, outlineStyle: 'none' } as any}
              placeholder="Cari pesan atau dokumen..."
              placeholderTextColor={coffee.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={coffee.text} />
            </TouchableOpacity>
            <View style={styles.headerAvatar}>
              {isGroupChat && groupDetails?.avatar_url ? (
                <Image source={{ uri: groupDetails.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.headerAvatarText}>{(groupDetails?.group_name || chatTitle)?.charAt(0) || 'U'}</Text>
              )}
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>{groupDetails?.group_name || chatTitle || 'Chat Room'}</Text>
              {isGroupChat ? (
                <Text style={styles.headerSubtitleOffline}>
                  {isGroupDetailsLoading ? 'Memuat anggota...' : `${onlineGroupMembers.length} online - ${activeGroupMembers.length} anggota`}
                </Text>
              ) : isTyping ? (
                <Text style={styles.headerSubtitle}>typing...</Text>
              ) : partnerStatus ? (
                <Text style={styles.headerSubtitleOffline}>{partnerStatus}</Text>
              ) : null}
            </View>
            <View style={styles.headerRightIcons}>
              <TouchableOpacity style={styles.headerIconButton} onPress={() => setIsSearchMode(true)}>
                <Ionicons name="search" size={22} color={coffee.text} />
              </TouchableOpacity>
              {isGroupChat ? (
                <TouchableOpacity style={styles.headerIconButton} onPress={openGroupInfo}>
                  <Ionicons name="information-circle-outline" size={24} color={coffee.text} />
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push({ pathname: '/(main)/call/[id]', params: { id: roomId, name: chatTitle, isVideo: 'true' } })}><Ionicons name="videocam" size={22} color={coffee.text} /></TouchableOpacity>
                  <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push({ pathname: '/(main)/call/[id]', params: { id: roomId, name: chatTitle, isVideo: 'false' } })}><Ionicons name="call" size={22} color={coffee.text} /></TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}
      </View>
      {pinnedMessage && (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedBannerTitle}>Pinned Message</Text>
          <Text style={styles.pinnedBannerContent} numberOfLines={1}>{pinnedMessage.content || 'Attachment'}</Text>
        </View>
      )}

      {/* Loading more indicator */}
      {isLoadingMore && (
        <View style={{ padding: 12, alignItems: 'center' }}>
          <Text style={{ color: coffee.muted, fontSize: 13 }}>Memuat pesan lama...</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => {
          if (shouldAutoScroll.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onLayout={() => {
          if (shouldAutoScroll.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          // If user is near the bottom, enable auto-scroll
          const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
          shouldAutoScroll.current = distanceFromBottom < 150;
          setShowScrollButton(distanceFromBottom > 300);

          // Load more when scrolling near the top
          if (contentOffset.y < 100 && hasMoreMessages && !isLoadingMore) {
            loadMoreMessages();
          }
        }}
        scrollEventThrottle={100}
        renderItem={({ item }) => {
          const repliedMsg = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;
          return (
            <TouchableOpacity
              style={[styles.messageBubble, item.isMine ? styles.myMessage : styles.theirMessage]}
              onLongPress={() => {
                setSelectedMessage(item);
                setIsMenuVisible(true);
              }}
              delayLongPress={300}
            >
              {isGroupChat && !item.isMine && (
                <Text style={styles.groupSenderName} numberOfLines={1}>{getSenderLabel(item)}</Text>
              )}
              {repliedMsg && (
                <View style={[styles.repliedBanner, item.isMine ? styles.myRepliedBanner : styles.theirRepliedBanner]}>
                  <Text style={styles.repliedBannerSender}>{repliedMsg.isMine ? 'You' : 'Them'}</Text>
                  <NoTranslateText style={styles.repliedBannerContent} numberOfLines={1} className="notranslate" translate="no">{repliedMsg.content || 'Attachment'}</NoTranslateText>
                </View>
              )}
              {item.type === 'image' && item.attachment_url ? (
                <TouchableOpacity onPress={() => downloadFile(item.attachment_url!, item.content || 'image.jpg')}>
                  <Image source={{ uri: normalizeAttachmentUrl(item.attachment_url) }} style={styles.attachedImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : item.type === 'audio' && item.attachment_url ? (
                <AudioMessage url={normalizeAttachmentUrl(item.attachment_url)} />
              ) : item.type === 'document' && item.attachment_url ? (
                <TouchableOpacity style={styles.documentContainer} onPress={() => downloadFile(item.attachment_url!, item.content || 'document.pdf')}>
                  <Text style={styles.documentIcon}>FILE</Text>
                  <NoTranslateText style={styles.documentName} className="notranslate" translate="no">{item.content}</NoTranslateText>
                </TouchableOpacity>
              ) : (
                <View>
                  <NoTranslateText style={styles.messageText} className="notranslate" translate="no">{item.content}</NoTranslateText>
                  {item.is_edited && <Text style={styles.editedText}>(edited)</Text>}
                </View>
              )}

              <View style={styles.messageFooter}>
                <Text style={styles.timeText}>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                {item.isMine && (
                  <Text style={styles.statusText}>
                    {item.isRead ? 'read' : 'sent'}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => {
                  setSelectedMessage(item);
                  setIsMenuVisible(true);
                }}
              >
                <Text style={styles.dropdownIcon}>v</Text>
              </TouchableOpacity>

              {renderReactions(item.reactions)}
            </TouchableOpacity>
          );
        }}
      />

      {showScrollButton && !isSearchMode && (
        <TouchableOpacity
          style={styles.scrollToBottomBtn}
          onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
        >
          <Ionicons name="chevron-down" size={24} color={coffee.text} />
        </TouchableOpacity>
      )}

      <Modal transparent visible={isGroupInfoVisible} animationType="slide" onRequestClose={() => setIsGroupInfoVisible(false)}>
        <View style={styles.groupInfoOverlay}>
          <View style={styles.groupInfoPanel}>
            <View style={styles.groupInfoHeader}>
              <Text style={styles.groupInfoTitle}>Info Warkop</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setIsGroupInfoVisible(false)}>
                <Ionicons name="close" size={22} color={coffee.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.groupHero}>
                <View style={styles.groupHeroAvatar}>
                  {groupDetails?.avatar_url ? (
                    <Image source={{ uri: groupDetails.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.headerAvatarText}>{(groupDetails?.group_name || chatTitle)?.charAt(0) || 'R'}</Text>
                  )}
                </View>
                <Text style={styles.groupHeroTitle}>{groupDetails?.group_name || chatTitle}</Text>
                <Text style={styles.groupHeroMeta}>{onlineGroupMembers.length} online - {activeGroupMembers.length} anggota</Text>
                {!!groupDetails?.description && <Text style={styles.groupDescription}>{groupDetails.description}</Text>}
              </View>

              <View style={styles.groupStatusRow}>
                <View style={styles.groupStatusChip}><Text style={styles.groupStatusLabel}>{groupDetails?.join_policy === 'approval' ? 'Join disetujui admin' : 'Join terbuka'}</Text></View>
                <View style={styles.groupStatusChip}><Text style={styles.groupStatusLabel}>{Number(groupDetails?.min_bmc_balance || 0) > 0 ? `Min ${groupDetails.min_bmc_balance} BMC` : '0 BMC'}</Text></View>
                <View style={styles.groupStatusChip}><Text style={styles.groupStatusLabel}>{groupDetails?.only_admins_can_send ? 'Admin only' : 'Semua bisa chat'}</Text></View>
              </View>

              <Text style={styles.groupInfoSectionTitle}>Link Undangan</Text>
              <View style={styles.groupInviteBox}>
                <Text style={styles.groupInviteText} numberOfLines={2}>{groupDetails?.invite_url || 'Memuat link...'}</Text>
              </View>
              <View style={styles.groupActionRow}>
                <TouchableOpacity style={styles.groupPrimaryButton} onPress={copyInviteLink}>
                  <Text style={styles.groupButtonText}>Salin Link</Text>
                </TouchableOpacity>
                {groupDetails?.is_admin && (
                  <TouchableOpacity style={styles.groupSecondaryButton} onPress={regenerateInviteLink}>
                    <Text style={styles.groupSecondaryButtonText}>Buat Ulang</Text>
                  </TouchableOpacity>
                )}
              </View>

              {groupDetails?.is_admin && (
                <View style={styles.groupAdminBox}>
                  <Text style={styles.groupInfoSectionTitle}>Tambah User</Text>
                  {availableGroupUsers.length > 0 ? (
                    <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupUserPickerRow}>
                        {availableGroupUsers.slice(0, 24).map(user => (
                          <TouchableOpacity key={user.id} style={[styles.groupUserChip, selectedMemberId === user.id && styles.groupUserChipActive]} onPress={() => setSelectedMemberId(user.id)}>
                            <Text style={styles.groupUserChipText} numberOfLines={1}>{user.display_name || user.username}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <TouchableOpacity style={[styles.groupPrimaryButton, !selectedMemberId && styles.groupButtonDisabled]} onPress={addSelectedGroupMember} disabled={!selectedMemberId}>
                        <Text style={styles.groupButtonText}>Tambah ke Warkop</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.groupHeroMeta}>Semua user terdaftar sudah ada di Warkop ini.</Text>
                  )}
                </View>
              )}

              {pendingGroupMembers.length > 0 && groupDetails?.is_admin && (
                <View style={styles.groupAdminBox}>
                  <Text style={styles.groupInfoSectionTitle}>Menunggu Persetujuan</Text>
                  {pendingGroupMembers.map((member: any) => (
                    <View key={member.user_id} style={styles.groupMemberRow}>
                      <View style={styles.groupMemberAvatar}>
                        {member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{(member.display_name || member.username || 'U').charAt(0)}</Text>}
                      </View>
                      <View style={styles.groupMemberInfo}>
                        <Text style={styles.groupMemberName}>{member.display_name || member.username}</Text>
                        <Text style={styles.groupMemberMeta}>@{member.username} - pending</Text>
                      </View>
                      <TouchableOpacity style={styles.miniButton} onPress={() => approveGroupMember(member.user_id)}>
                        <Text style={styles.miniButtonText}>Setujui</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.groupInfoSectionTitle}>Anggota</Text>
              {groupMembers.map((member: any) => {
                const displayName = member.display_name || member.username || 'User';
                const roleLabel = member.role === 'admin' ? 'Admin' : 'Member';
                const isCreator = groupDetails?.created_by === member.user_id;
                return (
                  <View key={member.user_id} style={styles.groupMemberRow}>
                    <View style={styles.groupMemberAvatar}>
                      {member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>}
                    </View>
                    <View style={styles.groupMemberInfo}>
                      <Text style={styles.groupMemberName} numberOfLines={1}>{displayName}{member.user_id === myUserId ? ' (kamu)' : ''}</Text>
                      <Text style={styles.groupMemberMeta}>@{member.username} - {roleLabel}{isCreator ? ' - pembuat' : ''} - {member.status}</Text>
                    </View>
                    <View style={[styles.groupStatusDot, member.is_online ? styles.groupStatusDotOnline : styles.groupStatusDotOffline]} />
                    {groupDetails?.is_admin && member.user_id !== myUserId && !isCreator && (
                      <View style={styles.groupMemberActions}>
                        {member.status === 'active' && (
                          <TouchableOpacity style={styles.miniButton} onPress={() => updateGroupMemberRole(member.user_id, member.role === 'admin' ? 'member' : 'admin')}>
                            <Text style={styles.miniButtonText}>{member.role === 'admin' ? 'Member' : 'Admin'}</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.miniButton, styles.miniButtonDanger]} onPress={() => removeGroupMember(member.user_id)}>
                          <Text style={styles.miniButtonText}>Hapus</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Context Menu Modal */}
      <Modal transparent visible={isMenuVisible} animationType="fade" onRequestClose={() => setIsMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMenuVisible(false)}>
          <View style={styles.menuContainer}>
            {/* Quick Emojis */}
            <View style={styles.emojiRow}>
              {emojiOptions.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => handleReact(emoji)}>
                  <Text style={styles.menuEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.menuActions}>
              <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                <Text style={styles.menuItemText}>Salin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleReply}>
                <Text style={styles.menuItemText}>Balas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleForwardClick}>
                <Text style={styles.menuItemText}>Teruskan</Text>
              </TouchableOpacity>
              {selectedMessage?.attachment_url && (
                <TouchableOpacity style={styles.menuItem} onPress={handleDownloadSelected}>
                  <Text style={styles.menuItemText}>Download</Text>
                </TouchableOpacity>
              )}
              {selectedMessage?.isMine && selectedMessage?.type === 'text' && (
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={handlePin}>
                <Text style={styles.menuItemText}>{selectedMessage?.is_pinned ? 'Unpin' : 'Pin'}</Text>
              </TouchableOpacity>
              {selectedMessage?.isMine && (
                <TouchableOpacity style={styles.menuItem} onPress={handleDeleteEveryone}>
                  <Text style={[styles.menuItemText, { color: coffee.danger }]}>Hapus untuk Semua</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={handleDeleteSelf}>
                <Text style={[styles.menuItemText, { color: coffee.danger }]}>Hapus untuk Saya</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Forward Modal */}
      <Modal transparent visible={isForwardModalVisible} animationType="slide" onRequestClose={() => setIsForwardModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.menuContainer, { maxHeight: '80%', padding: 0 }]}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: coffee.border }}>
              <Text style={styles.headerTitle}>Teruskan Pesan</Text>
            </View>
            <FlatList
              data={[...forwardContacts, ...forwardGroups]}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.contactItem} onPress={() => confirmForward(item.id)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(item.display_name || item.name || 'U').charAt(0)}</Text>
                  </View>
                  <Text style={styles.contactName}>{item.display_name || item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setIsForwardModalVisible(false)} style={{ padding: 16, borderTopWidth: 1, borderTopColor: coffee.border, alignItems: 'center' }}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Upload Progress Bar */}
      {isUploading && (
        <View style={{ backgroundColor: coffee.surface, paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, height: 4, backgroundColor: coffee.border, borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: coffee.button, borderRadius: 2 } as any} />
            </View>
            <Text style={{ color: coffee.secondary, fontSize: 12, minWidth: 36 }}>{uploadProgress}%</Text>
          </View>
          <Text style={{ color: coffee.muted, fontSize: 11, marginTop: 4 }}>Mengunggah file...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        {replyingToMessageId && (
          <View style={styles.editingBanner}>
            <Text style={styles.editingBannerText}>Replying to message...</Text>
            <TouchableOpacity onPress={() => setReplyingToMessageId(null)}>
              <Text style={styles.editingBannerClose}>x</Text>
            </TouchableOpacity>
          </View>
        )}
        {isEditing && (
          <View style={styles.editingBanner}>
            <Text style={styles.editingBannerText}>Editing message...</Text>
            <TouchableOpacity onPress={() => { setIsEditing(false); setEditingMessageId(null); setInputText(''); }}>
              <Text style={styles.editingBannerClose}>x</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.attachButton} onPress={pickDocument}>
            <Ionicons name="attach" size={20} color={coffee.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
            <Ionicons name="camera" size={20} color={coffee.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachButton} onPress={() => setShowEmojiPanel(!showEmojiPanel)}>
            <Ionicons name="happy-outline" size={20} color={coffee.text} />
          </TouchableOpacity>
        </View>
        {showEmojiPanel && (
          <View style={styles.emojiInputPanel}>
            {emojiOptions.map(emoji => (
              <TouchableOpacity key={emoji} style={styles.emojiInputBtn}
                onPress={() => {
                  setInputText(prev => prev + emoji);
                }}>
                <Text style={styles.emojiInputText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type an encrypted message..."
            placeholderTextColor={coffee.muted}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
          />

          {inputText.trim() === '' ? (
            <TouchableOpacity
              style={[styles.sendButton, isRecording ? { backgroundColor: coffee.dangerButton } : {}]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Text style={styles.sendButtonText}>{isRecording ? 'Stop' : 'Mic'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Online Users Horizontal Bar */}
      {onlineUsersList.length > 0 && (
        <View style={styles.onlineChatBar}>
          <Text style={{ color: coffee.accent, fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>Online Contacts</Text>
          <FlatList
            horizontal
            data={onlineUsersList}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.onlineUserItem} onPress={() => {
                router.push({ pathname: '/(main)/chat/[id]', params: { id: item.id, name: item.display_name } });
              }}>
                <View style={[styles.onlineAvatar, { width: 36, height: 36, borderRadius: 18, marginRight: 8, borderWidth: 2, borderColor: coffee.accent }]}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{item.display_name.charAt(0)}</Text>
                  )}
                </View>
                <Text style={{color: coffee.secondary, fontSize: 10, textAlign: 'center', width: 44}} numberOfLines={1}>{item.display_name.split(' ')[0]}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollToBottomBtn: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: coffee.border,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: coffee.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  container: {
    flex: 1,
    backgroundColor: coffee.background,
  },
  messageList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: coffee.button,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: coffee.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: coffee.text,
    fontSize: 16,
  },
  statusText: {
    color: coffee.buttonText, // Readable label on coffee-colored buttons
    fontSize: 12, // Slightly larger
    fontWeight: 'bold',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    padding: 16,
    backgroundColor: coffee.surface,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: coffee.background,
    color: coffee.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    fontSize: 16,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: coffee.button,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: coffee.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  attachButton: {
    padding: 12,
    marginRight: 8,
    backgroundColor: coffee.border,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButtonText: {
    fontSize: 16,
  },
  attachedImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.border,
    padding: 8,
    borderRadius: 20,
    width: 150,
  },
  audioText: {
    color: coffee.text,
    fontSize: 14,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.border,
    padding: 12,
    borderRadius: 8,
  },
  documentIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  documentName: {
    color: coffee.text,
    fontSize: 14,
    maxWidth: 200,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    color: coffee.secondary,
    fontSize: 10,
    marginRight: 4,
  },
  editedText: {
    color: coffee.secondary,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },
  reactionsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: -10,
    right: 10,
    backgroundColor: coffee.border,
    borderRadius: 12,
    padding: 2,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: coffee.background
  },
  reactionText: {
    fontSize: 12,
  },
  pinnedBanner: {
    backgroundColor: coffee.border,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: coffee.surface
  },
  pinnedBannerTitle: {
    color: coffee.accent,
    fontWeight: 'bold',
    fontSize: 12,
  },
  pinnedBannerContent: {
    color: coffee.text,
    fontSize: 14,
    marginTop: 2,
  },
  editingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: coffee.border,
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  editingBannerText: {
    color: coffee.accent,
    fontSize: 12,
  },
  editingBannerClose: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: coffee.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: coffee.surface,
    borderRadius: 16,
    padding: 16,
    width: '80%',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingBottom: 16,
  },
  menuEmoji: {
    fontSize: 24,
  },
  menuActions: {
    marginTop: 8,
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuItemText: {
    color: coffee.text,
    fontSize: 16,
  },
  dropdownButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
  },
  dropdownIcon: {
    color: coffee.secondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineChatBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: coffee.surface,
    borderTopWidth: 1,
    borderTopColor: coffee.background,
  },
  onlineUserItem: {
    alignItems: 'center',
    marginRight: 8,
  },
  onlineAvatar: {
    backgroundColor: coffee.button,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: coffee.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.surface,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: coffee.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: coffee.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: coffee.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: coffee.accent,
    fontSize: 12,
  },
  headerSubtitleOffline: {
    color: coffee.secondary,
    fontSize: 12,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerIcon: {
    color: coffee.text,
    fontSize: 20,
  },
  emojiInputPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: coffee.surface,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
    gap: 4,
  },
  emojiInputBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: coffee.background,
    margin: 2,
  },
  emojiInputText: {
    fontSize: 22,
  },
  repliedBanner: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  myRepliedBanner: {
    backgroundColor: coffee.button, // Darker emerald for my message
    borderLeftColor: coffee.accent,
  },
  theirRepliedBanner: {
    backgroundColor: coffee.border, // Slate for their message
    borderLeftColor: coffee.border,
  },
  repliedBannerSender: {
    fontSize: 12,
    fontWeight: 'bold',
    color: coffee.accent, // Emerald text
    marginBottom: 2,
  },
  repliedBannerContent: {
    fontSize: 14,
    color: coffee.secondary, // Slate-300 text
  },
  groupSenderName: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  groupInfoOverlay: {
    flex: 1,
    backgroundColor: coffee.overlay,
    justifyContent: 'flex-end',
  },
  groupInfoPanel: {
    backgroundColor: coffee.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: coffee.surface,
    maxHeight: '92%',
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  groupInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: coffee.surface,
  },
  groupInfoTitle: {
    color: coffee.text,
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: coffee.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHero: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  groupHeroAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: coffee.button,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  groupHeroTitle: {
    color: coffee.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  groupHeroMeta: {
    color: coffee.secondary,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  groupDescription: {
    color: coffee.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  groupStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  groupStatusChip: {
    backgroundColor: coffee.highlight,
    borderWidth: 1,
    borderColor: coffee.highlight,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  groupStatusLabel: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  groupInfoSectionTitle: {
    color: coffee.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  groupInviteBox: {
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 12,
    padding: 12,
  },
  groupInviteText: {
    color: coffee.text,
    fontSize: 13,
    lineHeight: 18,
  },
  groupActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  groupPrimaryButton: {
    backgroundColor: coffee.button,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSecondaryButton: {
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupButtonText: {
    color: coffee.buttonText,
    fontWeight: '800',
    fontSize: 13,
  },
  groupSecondaryButtonText: {
    color: coffee.text,
    fontWeight: '800',
    fontSize: 13,
  },
  groupButtonDisabled: {
    opacity: 0.45,
  },
  groupAdminBox: {
    borderTopWidth: 1,
    borderTopColor: coffee.surface,
    marginTop: 12,
    paddingTop: 4,
  },
  groupUserPickerRow: {
    gap: 8,
    paddingBottom: 10,
  },
  groupUserChip: {
    maxWidth: 140,
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  groupUserChipActive: {
    borderColor: coffee.accent,
    backgroundColor: coffee.highlight,
  },
  groupUserChipText: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '700',
  },
  groupMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: coffee.surface,
  },
  groupMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: coffee.button,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  groupMemberInfo: {
    flex: 1,
    minWidth: 0,
  },
  groupMemberName: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '800',
  },
  groupMemberMeta: {
    color: coffee.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  groupStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginHorizontal: 8,
  },
  groupStatusDotOnline: {
    backgroundColor: coffee.successButton,
  },
  groupStatusDotOffline: {
    backgroundColor: coffee.muted,
  },
  groupMemberActions: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  miniButton: {
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  miniButtonDanger: {
    borderColor: coffee.dangerSurface,
    backgroundColor: coffee.dangerSurface,
  },
  miniButtonText: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '800',
  },  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: coffee.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  contactName: {
    color: coffee.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtnText: {
    color: coffee.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  }
});
