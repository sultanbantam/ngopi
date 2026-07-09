import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL, getAuthHeaders } from '../../src/utils/api';
import { socketService } from '../../src/utils/socket';

type PlatformItem = {
  id: string;
  name: string;
  display_name: string;
  description: string;
  website_url: string;
  icon?: string | null;
};

type TicketItem = {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  platform: PlatformItem;
  assigned_agent?: { display_name: string } | null;
};

type TicketMessage = {
  id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  sender: {
    id: string;
    display_name: string;
    username: string;
    role?: string;
  };
};

const statusLabels: Record<TicketItem['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const statusColors: Record<TicketItem['status'], string> = {
  open: '#38BDF8',
  in_progress: '#F59E0B',
  resolved: '#10B981',
  closed: '#94A3B8',
};

const formatDate = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export default function HelpCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<PlatformItem[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState('');
  const [question, setQuestion] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [aiAnswer, setAiAnswer] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedPlatform = useMemo(
    () => platforms.find((platform) => platform.id === selectedPlatformId) || null,
    [platforms, selectedPlatformId]
  );

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const loadTickets = async () => {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_URL}/tickets/my`, { headers });
    setTickets(response.data);
    if (!selectedTicketId && response.data[0]?.id) setSelectedTicketId(response.data[0].id);
  };

  const loadMessages = async (ticketId: string) => {
    if (!ticketId) return;
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_URL}/tickets/${ticketId}/messages`, { headers });
    setMessages(response.data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const headers = await getAuthHeaders();
        const [platformResponse, ticketResponse] = await Promise.all([
          axios.get(`${API_URL}/platforms`, { headers }),
          axios.get(`${API_URL}/tickets/my`, { headers }),
        ]);
        setPlatforms(platformResponse.data);
        setTickets(ticketResponse.data);
        if (platformResponse.data[0]?.id) setSelectedPlatformId(platformResponse.data[0].id);
        if (ticketResponse.data[0]?.id) setSelectedTicketId(ticketResponse.data[0].id);
      } catch (error) {
        console.error('Help center init error:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }

    loadMessages(selectedTicketId);

    let active = true;
    const setupSocket = async () => {
      const socket = await socketService.connect();
      if (!socket || !active) return;

      const handleTicketMessage = (message: TicketMessage) => {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      };
      const handleTicketUpdated = (payload: { ticket_id?: string }) => {
        if (!payload?.ticket_id || payload.ticket_id === selectedTicketId) {
          loadTickets().catch(console.error);
        }
      };

      socket.emit('join_ticket', selectedTicketId);
      socket.on('ticket_message', handleTicketMessage);
      socket.on('ticket_updated', handleTicketUpdated);
      socket.on('ticket_status_changed', handleTicketUpdated);

      return () => {
        socket.off('ticket_message', handleTicketMessage);
        socket.off('ticket_updated', handleTicketUpdated);
        socket.off('ticket_status_changed', handleTicketUpdated);
      };
    };

    let cleanup: undefined | (() => void);
    setupSocket().then((fn) => { cleanup = fn; });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [selectedTicketId]);

  const askAi = async () => {
    if (!question.trim()) return;
    try {
      setAiLoading(true);
      const headers = await getAuthHeaders();
      const response = await axios.post(`${API_URL}/ai/query`, {
        question: question.trim(),
        platform_id: selectedPlatformId || undefined,
      }, { headers });
      setAiAnswer(response.data);
      setTicketTitle(question.trim().slice(0, 80));
    } catch (error) {
      console.error('AI query failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const createTicket = async () => {
    if (!selectedPlatformId || !question.trim()) return;
    try {
      setSaving(true);
      const headers = await getAuthHeaders();
      const response = await axios.post(`${API_URL}/tickets`, {
        platform_id: selectedPlatformId,
        title: ticketTitle.trim() || question.trim().slice(0, 80),
        message: question.trim(),
        is_escalated: Boolean(aiAnswer?.suggest_ticket),
      }, { headers });
      setTickets((current) => [response.data, ...current.filter((ticket) => ticket.id !== response.data.id)]);
      setSelectedTicketId(response.data.id);
      setQuestion('');
      setAiAnswer(null);
    } catch (error) {
      console.error('Create ticket failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicketId || !reply.trim()) return;
    const content = reply.trim();
    setReply('');

    const socket = await socketService.connect();
    if (socket?.connected) {
      socket.emit('ticket_send_message', { ticket_id: selectedTicketId, content });
      return;
    }

    const headers = await getAuthHeaders();
    const response = await axios.post(`${API_URL}/tickets/${selectedTicketId}/messages`, { content }, { headers });
    setMessages((current) => [...current, response.data]);
  };

  const closeTicket = async () => {
    if (!selectedTicketId) return;
    const headers = await getAuthHeaders();
    const response = await axios.patch(`${API_URL}/tickets/${selectedTicketId}/close`, {}, { headers });
    setTickets((current) => current.map((ticket) => ticket.id === response.data.id ? response.data : ticket));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Pusat Bantuan</Text>
          <Text style={styles.subtitle}>BambooCS AI dan tiket dukungan ekosistem</Text>
        </View>
        <View style={styles.liveBadge}>
          <Ionicons name="headset-outline" size={16} color="#34D399" />
          <Text style={styles.liveBadgeText}>BambooCS Online</Text>
        </View>
      </View>

      <View style={styles.contentGrid}>
        <View style={styles.platformPanel}>
          <Text style={styles.sectionTitle}>Platform</Text>
          <FlatList
            data={platforms}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const active = item.id === selectedPlatformId;
              return (
                <TouchableOpacity style={[styles.platformItem, active && styles.platformItemActive]} onPress={() => setSelectedPlatformId(item.id)}>
                  <View style={styles.platformIcon}><Text style={styles.platformIconText}>{item.icon || item.display_name.slice(0, 2)}</Text></View>
                  <View style={styles.platformInfo}>
                    <Text style={styles.platformName}>{item.display_name}</Text>
                    <Text style={styles.platformLink}>{item.website_url}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <ScrollView style={styles.mainPanel} contentContainerStyle={styles.mainContent}>
          <View style={styles.aiPanel}>
            <Text style={styles.sectionTitle}>BambooCS AI</Text>
            {selectedPlatform && <Text style={styles.platformDescription}>{selectedPlatform.description}</Text>}
            <TextInput
              style={styles.questionInput}
              value={question}
              onChangeText={setQuestion}
              placeholder="Tulis pertanyaan atau keluhan"
              placeholderTextColor="#64748B"
              multiline
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.primaryButton, aiLoading && styles.buttonDisabled]} onPress={askAi} disabled={aiLoading || !question.trim()}>
                <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{aiLoading ? 'Memeriksa' : 'Tanya AI'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, saving && styles.buttonDisabled]} onPress={createTicket} disabled={saving || !question.trim()}>
                <Ionicons name="ticket-outline" size={16} color="#34D399" />
                <Text style={styles.secondaryButtonText}>{saving ? 'Membuat' : 'Buat Tiket'}</Text>
              </TouchableOpacity>
            </View>
            {aiAnswer && (
              <View style={styles.answerBox}>
                <Text style={styles.answerMeta}>Confidence {Math.round((aiAnswer.confidence || 0) * 100)}% {aiAnswer.suggest_ticket ? '- Disarankan tiket' : '- Terjawab FAQ'}</Text>
                <Text style={styles.answerText}>{aiAnswer.answer}</Text>
              </View>
            )}
          </View>

          <View style={styles.ticketPanel}>
            <View style={styles.ticketHeaderRow}>
              <Text style={styles.sectionTitle}>Tiket Saya</Text>
              <Text style={styles.ticketCount}>{tickets.length} tiket</Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={tickets}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.ticketList}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.ticketCard, item.id === selectedTicketId && styles.ticketCardActive]} onPress={() => setSelectedTicketId(item.id)}>
                  <Text style={styles.ticketPlatform}>{item.platform.display_name}</Text>
                  <Text style={styles.ticketTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={[styles.statusPill, { borderColor: statusColors[item.status] }]}>
                    <Text style={[styles.statusText, { color: statusColors[item.status] }]}>{statusLabels[item.status]}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Belum ada tiket.</Text>}
            />
          </View>

          {selectedTicket && (
            <View style={styles.threadPanel}>
              <View style={styles.threadHeader}>
                <View>
                  <Text style={styles.threadTitle}>{selectedTicket.title}</Text>
                  <Text style={styles.threadMeta}>{selectedTicket.platform.display_name} - {formatDate(selectedTicket.updated_at)}</Text>
                </View>
                {selectedTicket.status !== 'closed' && (
                  <TouchableOpacity style={styles.closeButton} onPress={closeTicket}>
                    <Ionicons name="checkmark-done-outline" size={16} color="#F8FAFC" />
                    <Text style={styles.closeButtonText}>Tutup</Text>
                  </TouchableOpacity>
                )}
              </View>

              {messages.map((message) => {
                const staff = message.sender?.role === 'admin' || message.sender?.role === 'agent';
                return (
                  <View key={message.id} style={[styles.messageBubble, staff ? styles.staffBubble : styles.userBubble]}>
                    <Text style={styles.messageSender}>{staff ? 'BambooCS' : message.sender.display_name}</Text>
                    <Text style={styles.messageText}>{message.content}</Text>
                    <Text style={styles.messageTime}>{formatDate(message.created_at)}</Text>
                  </View>
                );
              })}

              {selectedTicket.status !== 'closed' && (
                <View style={styles.replyRow}>
                  <TextInput
                    style={styles.replyInput}
                    value={reply}
                    onChangeText={setReply}
                    placeholder="Balas tiket"
                    placeholderTextColor="#64748B"
                    multiline
                  />
                  <TouchableOpacity style={styles.sendReplyButton} onPress={sendReply} disabled={!reply.trim()}>
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 3,
    fontSize: 13,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#14532D',
    backgroundColor: '#052E1A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveBadgeText: {
    color: '#A7F3D0',
    fontWeight: '700',
    fontSize: 12,
  },
  contentGrid: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  platformPanel: {
    width: Platform.OS === 'web' ? 280 : '100%',
    maxHeight: Platform.OS === 'web' ? undefined : 230,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderColor: '#1E293B',
    padding: 14,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  platformItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 7,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  platformItemActive: {
    borderColor: '#10B981',
    backgroundColor: '#082F24',
  },
  platformIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  platformIconText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  platformInfo: {
    flex: 1,
    minWidth: 0,
  },
  platformName: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13,
  },
  platformLink: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  mainPanel: {
    flex: 1,
  },
  mainContent: {
    padding: 16,
    gap: 14,
  },
  aiPanel: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  platformDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  questionInput: {
    minHeight: 100,
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as any,
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#34D399',
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  answerBox: {
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    backgroundColor: '#0B2A22',
    padding: 12,
    borderRadius: 8,
  },
  answerMeta: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  answerText: {
    color: '#D1FAE5',
    lineHeight: 20,
  },
  ticketPanel: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketCount: {
    color: '#64748B',
    fontSize: 12,
  },
  ticketList: {
    gap: 10,
  },
  ticketCard: {
    width: 210,
    minHeight: 118,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
  },
  ticketCardActive: {
    borderColor: '#10B981',
  },
  ticketPlatform: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  ticketTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    minHeight: 38,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    paddingVertical: 20,
  },
  threadPanel: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  threadTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  threadMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  closeButtonText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 12,
  },
  messageBubble: {
    maxWidth: '86%',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#059669',
  },
  staffBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
  },
  messageSender: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageText: {
    color: '#F8FAFC',
    lineHeight: 20,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginTop: 6,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    outlineStyle: 'none',
  } as any,
  sendReplyButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
});