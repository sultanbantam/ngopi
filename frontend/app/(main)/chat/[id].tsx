import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Image, Linking, Modal } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { socketService } from '../../../src/utils/socket';
import { encryptMessage, decryptMessage } from '../../../src/utils/crypto';
import * as SecureStore from '../../../src/utils/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import axios from 'axios';

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
      <Text style={styles.audioText}>{isPlaying ? '⏸' : '▶️'} Voice Note</Text>
    </TouchableOpacity>
  );
};

export default function ChatRoomScreen() {
  const { id: roomId, name } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [actualRoomId, setActualRoomId] = useState('');
  
  // Real-time states
  const [isTyping, setIsTyping] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<string>('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  useEffect(() => {
    const initRoom = async () => {
      // Create a shared symmetric key for E2EE based on sorted IDs
      let myId = '';
      if (Platform.OS === 'web') {
        myId = localStorage.getItem('userId') || '';
      } else {
        myId = (await SecureStore.getItemAsync('userId')) || '';
      }
      
      const partnerId = roomId as string;
      // Define a consistent room ID for 1-on-1 chats regardless of who opens it
      const sharedKey = [myId, partnerId].sort().join('-');
      setSecretKey(sharedKey);
      setActualRoomId(sharedKey);

      // Fetch history
      try {
        const response = await axios.get(`http://localhost:3000/api/messages/${sharedKey}`, {
          headers: { Authorization: `Bearer ${await SecureStore.getItemAsync('token') || localStorage.getItem('token')}` }
        });
        const history = response.data.map((msg: any) => {
          let decryptedText = '';
          if (msg.type === 'text' && msg.content) {
            decryptedText = decryptMessage(msg.content, sharedKey);
          }
          return {
            id: msg.id,
            sender_id: msg.sender_id,
            content: decryptedText,
            isMine: msg.sender_id === myId,
            timestamp: msg.timestamp,
            isRead: msg.is_read,
            type: msg.type,
            attachment_url: msg.attachment_url,
            reactions: msg.reactions || {},
            is_edited: msg.is_edited,
            is_pinned: msg.is_pinned
          };
        });
        setMessages(history);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 500);
      } catch (err) {
        console.error('Failed to fetch history', err);
      }

      // Join room
      if (socketService.socket) {
        socketService.socket.emit('join_room', sharedKey);

        // Listen for incoming messages
        socketService.socket.on('receive_message', (data: any) => {
          // Prevent double messages if we sent it (from our own optimistic UI)
          if (data.sender_id === myId) return;

          // Decrypt the message
          let decryptedText = '';
          if (data.type === 'text' && data.content) {
            decryptedText = decryptMessage(data.content, sharedKey);
          }
          
          setMessages(prev => [...prev, {
            id: data.id || Math.random().toString(),
            sender_id: data.sender_id,
            content: decryptedText,
            isMine: false, 
            timestamp: new Date().toISOString(),
            type: data.type || 'text',
            attachment_url: data.attachment_url,
            reactions: data.reactions || {},
            is_edited: data.is_edited,
            is_pinned: data.is_pinned
          }]);

          // Emit read receipt immediately since we are in the room!
          socketService.socket?.emit('mark_messages_read', { sender_id: data.sender_id, room_id: sharedKey });
        });

        // Listen for errors (like token gating)
        socketService.socket.on('error', (err: any) => {
          alert(`Error: ${err.message}`);
        });

        // Typing events
        socketService.socket.on('typing_start', () => setIsTyping(true));
        socketService.socket.on('typing_stop', () => setIsTyping(false));

        // Status events
        socketService.socket.on('user_status_change', (data: any) => {
          if (data.user_id === roomId) {
            setPartnerStatus(data.is_online ? 'Online' : data.last_seen ? `Last seen: ${new Date(data.last_seen).toLocaleTimeString()}` : '');
          }
        });

        // Messages read event
        socketService.socket.on('messages_read', (data: any) => {
          if (data.room_id === sharedKey) {
            setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
          }
        });

        // WhatsApp Features Listeners
        socketService.socket.on('message_reacted', (data: any) => {
          setMessages(prev => prev.map(msg => msg.id === data.id ? { ...msg, reactions: data.reactions } : msg));
        });
        socketService.socket.on('message_edited', (data: any) => {
          setMessages(prev => prev.map(msg => {
            if (msg.id === data.id) {
              const newContent = (data.type === 'text' && data.content) ? decryptMessage(data.content, sharedKey) : data.content;
              return { ...msg, content: newContent, is_edited: true };
            }
            return msg;
          }));
        });
        socketService.socket.on('message_pinned', (data: any) => {
          setMessages(prev => prev.map(msg => msg.id === data.id ? { ...msg, is_pinned: data.is_pinned } : msg));
        });

        // WebRTC Incoming Call
        socketService.socket.on('call_incoming', (data: any) => {
          // data: { signal, from, name, room_id, isVideo }
          if (window.confirm(`${data.name} sedang memanggil Anda. Jawab?`)) {
            const signalStr = encodeURIComponent(JSON.stringify(data.signal));
            router.push({ 
              pathname: '/(main)/call/[id]', 
              params: { id: data.from, name: data.name, isVideo: data.isVideo ? 'true' : 'false', isCaller: 'false', incomingSignal: signalStr } 
            });
          }
        });

        // Mark messages as read since we just opened the chat
        socketService.socket.emit('mark_messages_read', { sender_id: partnerId, room_id: sharedKey });
      }
    };
    initRoom();

    return () => {
      if (socketService.socket) {
        socketService.socket.off('receive_message');
        socketService.socket.off('error');
        socketService.socket.off('typing_start');
        socketService.socket.off('typing_stop');
        socketService.socket.off('user_status_change');
        socketService.socket.off('messages_read');
        socketService.socket.off('message_reacted');
        socketService.socket.off('message_edited');
        socketService.socket.off('message_pinned');
        socketService.socket.off('call_incoming');
      }
    };
  }, [roomId]);

  const sendMessage = () => {
    if (!inputText.trim()) return;

    if (isEditing && editingMessageId) {
      if (socketService.socket) {
        // E2EE: Encrypt the new content
        const ciphertext = encryptMessage(inputText.trim(), secretKey);
        socketService.socket.emit('edit_message', {
          message_id: editingMessageId,
          room_id: actualRoomId,
          receiver_id: roomId,
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
      receiver_id: roomId, // Pass receiver_id so backend broadcasts to them globally
      content: ciphertext
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
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  };

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (socketService.socket && actualRoomId) {
      socketService.socket.emit('typing_start', { room_id: actualRoomId, receiver_id: roomId });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socketService.socket?.emit('typing_stop', { room_id: actualRoomId, receiver_id: roomId });
      }, 1500);
    }
  };

  const uploadFile = async (uri: string, type: string, originalName?: string) => {
    try {
      const formData = new FormData();
      // Need to append file depending on platform
      if (Platform.OS === 'web') {
        // fetch blob
        const res = await fetch(uri);
        const blob = await res.blob();
        const fallbackName = `upload.${type === 'image' ? 'jpg' : type === 'audio' ? 'webm' : 'bin'}`;
        formData.append('file', blob, originalName || fallbackName);
      } else {
        const fallbackName = `upload.${type === 'image' ? 'jpg' : type === 'audio' ? 'm4a' : 'bin'}`;
        formData.append('file', {
          uri,
          name: originalName || fallbackName,
          type: type === 'image' ? 'image/jpeg' : type === 'audio' ? 'audio/m4a' : 'application/octet-stream',
        } as any);
      }

      const response = await axios.post('http://localhost:3000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.url;
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload file');
      return null;
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const url = await uploadFile(uri, 'image');
      
      if (url) {
        // Send image message
        const messageData = {
          room_id: actualRoomId,
          receiver_id: roomId,
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
      const url = await uploadFile(doc.uri, 'document', doc.name);
      
      if (url) {
        // We will store the original file name in the content (encrypted)
        const encryptedName = encryptMessage(doc.name, secretKey);
        const messageData = {
          room_id: actualRoomId,
          receiver_id: roomId,
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
        formData.append('file', audioBlob, 'upload.webm');
        
        try {
          const response = await axios.post('http://localhost:3000/api/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          const url = response.data.url;
          
          if (url) {
            const messageData = { room_id: actualRoomId, receiver_id: roomId, type: 'audio', attachment_url: url };
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
            receiver_id: roomId,
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
        receiver_id: roomId,
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
        receiver_id: roomId,
        is_pinned: newPinStatus
      });
      // Optimistic
      setMessages(prev => prev.map(msg => msg.id === selectedMessage.id ? { ...msg, is_pinned: newPinStatus } : msg));
    }
    setIsMenuVisible(false);
  };

  const handleCopy = () => {
    // Basic copy to clipboard
    if (selectedMessage && selectedMessage.type === 'text') {
      if (Platform.OS === 'web') {
        navigator.clipboard.writeText(selectedMessage.content || '');
      }
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

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* WhatsApp Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.headerIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{(name as string)?.charAt(0) || 'U'}</Text>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{name || 'Chat Room'}</Text>
          {isTyping ? (
            <Text style={styles.headerSubtitle}>typing...</Text>
          ) : partnerStatus ? (
            <Text style={styles.headerSubtitleOffline}>{partnerStatus}</Text>
          ) : null}
        </View>
        <View style={styles.headerRightIcons}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push({ pathname: '/(main)/call/[id]', params: { id: roomId, name, isVideo: 'true' } })}><Text style={styles.headerIcon}>📹</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push({ pathname: '/(main)/call/[id]', params: { id: roomId, name, isVideo: 'false' } })}><Text style={styles.headerIcon}>📞</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}><Text style={styles.headerIcon}>⋮</Text></TouchableOpacity>
        </View>
      </View>

      {pinnedMessage && (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedBannerTitle}>📌 Pinned Message</Text>
          <Text style={styles.pinnedBannerContent} numberOfLines={1}>{pinnedMessage.content || 'Attachment'}</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.messageBubble, item.isMine ? styles.myMessage : styles.theirMessage]}
            onLongPress={() => {
              setSelectedMessage(item);
              setIsMenuVisible(true);
            }}
            delayLongPress={300}
          >
            {item.type === 'image' && item.attachment_url ? (
              <TouchableOpacity onPress={() => Linking.openURL(item.attachment_url!)}>
                <Image source={{ uri: item.attachment_url }} style={styles.attachedImage} />
              </TouchableOpacity>
            ) : item.type === 'audio' && item.attachment_url ? (
              <AudioMessage url={item.attachment_url} />
            ) : item.type === 'document' && item.attachment_url ? (
              <TouchableOpacity style={styles.documentContainer} onPress={() => Linking.openURL(item.attachment_url!)}>
                <Text style={styles.documentIcon}>📄</Text>
                <Text style={styles.documentName}>{item.content}</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.messageText}>{item.content}</Text>
                {item.is_edited && <Text style={styles.editedText}>(edited)</Text>}
              </View>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={styles.timeText}>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
              {item.isMine && (
                <Text style={styles.statusText}>
                  {item.isRead ? '✓✓' : '✓'}
                </Text>
              )}
            </View>

            {renderReactions(item.reactions)}
          </TouchableOpacity>
        )}
      />

      {/* Context Menu Modal */}
      <Modal transparent visible={isMenuVisible} animationType="fade" onRequestClose={() => setIsMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.emojiRow}>
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => handleReact(emoji)}>
                  <Text style={styles.menuEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.menuActions}>
              <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                <Text style={styles.menuItemText}>Copy</Text>
              </TouchableOpacity>
              {selectedMessage?.isMine && selectedMessage?.type === 'text' && (
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={handlePin}>
                <Text style={styles.menuItemText}>{selectedMessage?.is_pinned ? 'Unpin' : 'Pin'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.inputContainer}>
        {isEditing && (
          <View style={styles.editingBanner}>
            <Text style={styles.editingBannerText}>Editing message...</Text>
            <TouchableOpacity onPress={() => { setIsEditing(false); setEditingMessageId(null); setInputText(''); }}>
              <Text style={styles.editingBannerClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.attachButton} onPress={pickDocument}>
            <Text style={styles.attachButtonText}>📎</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
            <Text style={styles.attachButtonText}>📷</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type an encrypted message..."
            placeholderTextColor="#64748b"
            value={inputText}
            onChangeText={handleTextChange}
            multiline
          />

          {inputText.trim() === '' ? (
            <TouchableOpacity 
              style={[styles.sendButton, isRecording ? { backgroundColor: '#EF4444' } : {}]} 
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Text style={styles.sendButtonText}>{isRecording ? '⏺' : '🎤'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    backgroundColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  statusText: {
    color: '#0F172A', // Dark color for high contrast against green background
    fontSize: 12, // Slightly larger
    fontWeight: 'bold',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#1E293B',
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
    backgroundColor: '#0F172A',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    fontSize: 16,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  attachButton: {
    padding: 12,
    marginRight: 8,
    backgroundColor: '#334155',
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
    backgroundColor: '#334155',
    padding: 8,
    borderRadius: 20,
    width: 150,
  },
  audioText: {
    color: '#fff',
    fontSize: 14,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
  },
  documentIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  documentName: {
    color: '#fff',
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
    color: '#94A3B8',
    fontSize: 10,
    marginRight: 4,
  },
  editedText: {
    color: '#94A3B8',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },
  reactionsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: -10,
    right: 10,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 2,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#0F172A'
  },
  reactionText: {
    fontSize: 12,
  },
  pinnedBanner: {
    backgroundColor: '#334155',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  pinnedBannerTitle: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 12,
  },
  pinnedBannerContent: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },
  editingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#334155',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  editingBannerText: {
    color: '#10B981',
    fontSize: 12,
  },
  editingBannerClose: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    width: '80%',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
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
    color: '#fff',
    fontSize: 16,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#10B981',
    fontSize: 12,
  },
  headerSubtitleOffline: {
    color: '#94A3B8',
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
    color: '#F8FAFC',
    fontSize: 20,
  }
});
