import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL, getAuthHeaders } from '../../../src/utils/api';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

type TicketItem = {
  id: string;
  title: string;
  status: TicketStatus;
  is_escalated: boolean;
  created_at: string;
  updated_at: string;
  platform: { id: string; name: string; display_name: string; icon?: string | null };
  user: { id: string; username: string; display_name: string };
  assigned_agent?: { id: string; display_name: string; username: string } | null;
  messages?: Array<{ content: string; created_at: string }>;
};

type TicketMessage = {
  id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  sender: { display_name: string; username: string; role?: string };
};

type TicketStats = {
  by_status: Array<{ status: TicketStatus; count: number }>;
  by_platform: Array<{ platform_id: string; display_name: string; count: number }>;
  average_response_ms: number | null;
};

const columns: Array<{ status: TicketStatus; label: string; color: string }> = [
  { status: 'open', label: 'Open', color: '#38BDF8' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { status: 'resolved', label: 'Resolved', color: '#10B981' },
  { status: 'closed', label: 'Closed', color: '#94A3B8' },
];

const formatDate = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

const formatDuration = (ms: number | null) => {
  if (ms === null) return 'Belum ada respon';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.round(minutes / 60)} jam`;
};

export default function AdminDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [draggedTicketId, setDraggedTicketId] = useState('');
  const [error, setError] = useState('');

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const statusCounts = useMemo(() => {
    const map: Record<TicketStatus, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    stats?.by_status.forEach((item) => { map[item.status] = item.count; });
    return map;
  }, [stats]);

  const loadDashboard = async () => {
    const headers = await getAuthHeaders();
    const [ticketResponse, statsResponse] = await Promise.all([
      axios.get(`${API_URL}/admin/tickets`, { headers }),
      axios.get(`${API_URL}/admin/tickets/stats`, { headers }),
    ]);
    setTickets(ticketResponse.data);
    setStats(statsResponse.data);
    if (!selectedTicketId && ticketResponse.data[0]?.id) setSelectedTicketId(ticketResponse.data[0].id);
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
        await loadDashboard();
      } catch (err: any) {
        console.error('Admin dashboard init error:', err);
        setError(err.response?.status === 403 ? 'Akses dashboard membutuhkan role admin atau agent.' : 'Dashboard belum bisa dimuat.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (selectedTicketId) loadMessages(selectedTicketId).catch(console.error);
    else setMessages([]);
  }, [selectedTicketId]);

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    const headers = await getAuthHeaders();
    const response = await axios.patch(`${API_URL}/admin/tickets/${ticketId}/status`, { status }, { headers });
    setTickets((current) => current.map((ticket) => ticket.id === ticketId ? response.data : ticket));
    loadDashboard().catch(console.error);
  };

  const assignToMe = async () => {
    if (!selectedTicketId) return;
    const headers = await getAuthHeaders();
    const response = await axios.patch(`${API_URL}/admin/tickets/${selectedTicketId}/assign`, {}, { headers });
    setTickets((current) => current.map((ticket) => ticket.id === selectedTicketId ? response.data : ticket));
    loadDashboard().catch(console.error);
  };

  const sendReply = async () => {
    if (!selectedTicketId || !reply.trim()) return;
    const headers = await getAuthHeaders();
    const response = await axios.post(`${API_URL}/admin/tickets/${selectedTicketId}/messages`, {
      content: reply.trim(),
      is_internal: internalNote,
    }, { headers });
    setMessages((current) => [...current, response.data]);
    setReply('');
    setInternalNote(false);
    loadDashboard().catch(console.error);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={38} color="#F59E0B" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>CS Dashboard</Text>
          <Text style={styles.subtitle}>Tiket, routing agent, dan statistik BambooCS</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadDashboard().catch(console.error)}>
          <Ionicons name="refresh" size={18} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {columns.map((column) => (
          <View key={column.status} style={styles.statCard}>
            <Text style={[styles.statValue, { color: column.color }]}>{statusCounts[column.status]}</Text>
            <Text style={styles.statLabel}>{column.label}</Text>
          </View>
        ))}
        <View style={styles.statCardWide}>
          <Text style={styles.statValue}>{formatDuration(stats?.average_response_ms ?? null)}</Text>
          <Text style={styles.statLabel}>Rata-rata respon</Text>
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView horizontal style={styles.board} contentContainerStyle={styles.boardContent}>
          {columns.map((column) => {
            const columnTickets = tickets.filter((ticket) => ticket.status === column.status);
            const webDropProps = Platform.OS === 'web'
              ? ({
                  onDragOver: (event: any) => event.preventDefault(),
                  onDrop: (event: any) => {
                    event.preventDefault();
                    if (draggedTicketId) updateTicketStatus(draggedTicketId, column.status).catch(console.error);
                    setDraggedTicketId('');
                  },
                } as any)
              : {};

            return (
              <View key={column.status} style={styles.column} {...webDropProps}>
                <View style={styles.columnHeader}>
                  <View style={[styles.columnDot, { backgroundColor: column.color }]} />
                  <Text style={styles.columnTitle}>{column.label}</Text>
                  <Text style={styles.columnCount}>{columnTickets.length}</Text>
                </View>

                {columnTickets.map((ticket) => {
                  const webDragProps = Platform.OS === 'web'
                    ? ({
                        draggable: true,
                        onDragStart: () => setDraggedTicketId(ticket.id),
                        onDragEnd: () => setDraggedTicketId(''),
                      } as any)
                    : {};

                  return (
                    <TouchableOpacity key={ticket.id} style={[styles.ticketCard, selectedTicketId === ticket.id && styles.ticketCardActive]} onPress={() => setSelectedTicketId(ticket.id)} {...webDragProps}>
                      <View style={styles.ticketTopRow}>
                        <Text style={styles.ticketPlatform}>{ticket.platform.display_name}</Text>
                        {ticket.is_escalated && <Ionicons name="sparkles-outline" size={15} color="#F59E0B" />}
                      </View>
                      <Text style={styles.ticketTitle} numberOfLines={2}>{ticket.title}</Text>
                      <Text style={styles.ticketUser}>@{ticket.user.username}</Text>
                      <Text style={styles.ticketTime}>{formatDate(ticket.updated_at)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.detailPanel}>
          {selectedTicket ? (
            <>
              <View style={styles.detailHeader}>
                <View style={styles.detailTitleBlock}>
                  <Text style={styles.detailPlatform}>{selectedTicket.platform.display_name}</Text>
                  <Text style={styles.detailTitle}>{selectedTicket.title}</Text>
                  <Text style={styles.detailMeta}>User @{selectedTicket.user.username} - {formatDate(selectedTicket.created_at)}</Text>
                </View>
                <TouchableOpacity style={styles.assignButton} onPress={assignToMe}>
                  <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.assignButtonText}>Ambil</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statusButtonRow}>
                {columns.map((column) => (
                  <TouchableOpacity key={column.status} style={[styles.statusButton, selectedTicket.status === column.status && { borderColor: column.color }]} onPress={() => updateTicketStatus(selectedTicket.id, column.status)}>
                    <Text style={[styles.statusButtonText, selectedTicket.status === column.status && { color: column.color }]}>{column.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
                {messages.map((message) => {
                  const internal = message.is_internal;
                  const staff = message.sender?.role === 'admin' || message.sender?.role === 'agent';
                  return (
                    <View key={message.id} style={[styles.messageBubble, staff ? styles.staffBubble : styles.userBubble, internal && styles.internalBubble]}>
                      <Text style={styles.messageSender}>{internal ? 'Internal Note' : staff ? 'BambooCS' : message.sender.display_name}</Text>
                      <Text style={styles.messageText}>{message.content}</Text>
                      <Text style={styles.messageTime}>{formatDate(message.created_at)}</Text>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.replyPanel}>
                <View style={styles.internalRow}>
                  <Text style={styles.internalLabel}>Catatan internal</Text>
                  <Switch value={internalNote} onValueChange={setInternalNote} thumbColor={internalNote ? '#10B981' : '#CBD5E1'} />
                </View>
                <View style={styles.replyRow}>
                  <TextInput
                    style={styles.replyInput}
                    value={reply}
                    onChangeText={setReply}
                    placeholder={internalNote ? 'Tulis catatan internal' : 'Tulis balasan ke user'}
                    placeholderTextColor="#64748B"
                    multiline
                  />
                  <TouchableOpacity style={styles.sendButton} onPress={sendReply} disabled={!reply.trim()}>
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyDetail}>
              <Ionicons name="file-tray-outline" size={34} color="#64748B" />
              <Text style={styles.emptyDetailText}>Pilih tiket untuk melihat detail.</Text>
            </View>
          )}
        </View>
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
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#F8FAFC',
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
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
    fontWeight: '900',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexWrap: 'wrap',
  },
  statCard: {
    minWidth: 110,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
  },
  statCardWide: {
    minWidth: 170,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  body: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    minHeight: 0,
  },
  board: {
    flex: 1,
  },
  boardContent: {
    padding: 12,
    gap: 12,
  },
  column: {
    width: 260,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  columnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  columnTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    flex: 1,
  },
  columnCount: {
    color: '#64748B',
    fontWeight: '800',
  },
  ticketCard: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 11,
    marginBottom: 9,
  },
  ticketCardActive: {
    borderColor: '#10B981',
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketPlatform: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '900',
  },
  ticketTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7,
    minHeight: 38,
  },
  ticketUser: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 6,
  },
  ticketTime: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  detailPanel: {
    width: Platform.OS === 'web' ? 430 : '100%',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderTopWidth: Platform.OS === 'web' ? 0 : 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B1120',
    minHeight: 0,
  },
  detailHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  detailTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  detailPlatform: {
    color: '#34D399',
    fontWeight: '900',
    fontSize: 12,
    marginBottom: 5,
  },
  detailTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  detailMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 5,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  assignButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  statusButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  statusButton: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  statusButtonText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '900',
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 12,
  },
  messageBubble: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 9,
    maxWidth: '88%',
  },
  staffBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#065F46',
  },
  internalBubble: {
    backgroundColor: '#3B2F12',
    borderWidth: 1,
    borderColor: '#92400E',
  },
  messageSender: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '900',
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
  replyPanel: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    padding: 12,
  },
  internalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  internalLabel: {
    color: '#CBD5E1',
    fontWeight: '800',
  },
  replyRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-end',
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
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDetail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyDetailText: {
    color: '#94A3B8',
    marginTop: 10,
    textAlign: 'center',
  },
});