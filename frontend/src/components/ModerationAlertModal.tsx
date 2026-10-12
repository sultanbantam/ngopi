import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coffee as baseCoffee } from '../theme/coffee';
import { socketService } from '../utils/socket';
import { getAuthHeaders } from '../utils/api';
import axios from 'axios';

const coffee = {
  ...baseCoffee,
  cream: baseCoffee.text,
  textSecondary: baseCoffee.secondary,
  primary: baseCoffee.accent,
};

const API_URL = 'https://api.ngopi.top/api';

export interface ModerationBlockedData {
  reason?: string;
  actionTaken?: 'warning' | 'mute' | 'kick' | 'ban' | 'blacklist';
  classification?: {
    isHarmful: boolean;
    detected_by: string;
    details?: string;
    categories?: Record<string, boolean>;
  };
}

interface ModerationAlertModalProps {
  reportModalVisible?: boolean;
  onCloseReport?: () => void;
  targetUserId?: string;
  targetUserName?: string;
}

export default function ModerationAlertModal({
  reportModalVisible = false,
  onCloseReport,
  targetUserId = '',
  targetUserName = '',
}: ModerationAlertModalProps) {
  // Alert modal state (triggered on moderation block)
  const [alertVisible, setAlertVisible] = useState(false);
  const [blockedData, setBlockedData] = useState<ModerationBlockedData | null>(null);

  // Reporting modal state
  const [showReport, setShowReport] = useState(reportModalVisible);
  const [reportedUserId, setReportedUserId] = useState(targetUserId);
  const [reportedUserName, setReportedUserName] = useState(targetUserName);
  const [reportReason, setReportReason] = useState('');
  const [reportEvidence, setReportEvidence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setShowReport(reportModalVisible);
    if (targetUserId) setReportedUserId(targetUserId);
    if (targetUserName) setReportedUserName(targetUserName);
  }, [reportModalVisible, targetUserId, targetUserName]);

  // Subscribe to socket events for real-time moderation feedback
  useEffect(() => {
    const handleBlocked = (data: ModerationBlockedData) => {
      setBlockedData(data);
      setAlertVisible(true);
    };

    const socket = socketService.socket;
    if (socket) {
      socket.on('moderation_blocked', handleBlocked);
    }

    return () => {
      if (socket) {
        socket.off('moderation_blocked', handleBlocked);
      }
    };
  }, []);

  const handleSendReport = async () => {
    if (!reportedUserId.trim()) {
      alert('Masukkan ID atau username pengguna yang ingin dilaporkan.');
      return;
    }
    if (!reportReason.trim()) {
      alert('Pilih atau tuliskan alasan pelaporan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_URL}/moderation/report`,
        {
          reported_user_id: reportedUserId.trim(),
          reported_user_name: reportedUserName.trim() || undefined,
          reason: reportReason.trim(),
          message_content: reportEvidence.trim() || undefined,
        },
        { headers }
      );

      alert('Laporan Anda berhasil dikirim ke moderator warkop.');
      setReportReason('');
      setReportEvidence('');
      setShowReport(false);
      if (onCloseReport) onCloseReport();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal mengirim laporan. Coba lagi.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionBadgeColor = (action?: string) => {
    switch (action) {
      case 'warning': return '#F59E0B'; // Amber
      case 'mute': return '#EA580C'; // Orange
      case 'kick': return '#DC2626'; // Red
      case 'ban': return '#B91C1C'; // Deep red
      case 'blacklist': return '#7F1D1D'; // Maroon
      default: return '#E11D48';
    }
  };

  return (
    <>
      {/* 1. Modal Peringatan / Blokir Moderasi Otomatis */}
      <Modal
        visible={alertVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: getActionBadgeColor(blockedData?.actionTaken) + '22' }]}>
              <Ionicons
                name="shield-half"
                size={36}
                color={getActionBadgeColor(blockedData?.actionTaken)}
              />
            </View>

            <Text style={styles.title}>Perlindungan Komunitas Warkop</Text>

            {blockedData?.actionTaken && (
              <View style={[styles.badge, { backgroundColor: getActionBadgeColor(blockedData.actionTaken) }]}>
                <Text style={styles.badgeText}>
                  Tindakan: {blockedData.actionTaken.toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={styles.reasonText}>
              {blockedData?.reason || 'Pesan Anda tidak dapat dikirim karena melanggar aturan tata tertib warkop.'}
            </Text>

            {blockedData?.classification?.details && (
              <View style={styles.detailBox}>
                <Text style={styles.detailTitle}>Keterangan Sistem AI:</Text>
                <Text style={styles.detailContent}>{blockedData.classification.details}</Text>
              </View>
            )}

            <View style={styles.ruleNotice}>
              <Ionicons name="information-circle-outline" size={16} color={coffee.secondary} />
              <Text style={styles.ruleText}>
                Warkop Ngopi menerapkan 5 lapisan moderasi aktif untuk mencegah spam, link berbahaya, dan judi online.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setAlertVisible(false)}
            >
              <Text style={styles.primaryButtonText}>Saya Mengerti</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Modal Pelaporan Pengguna (User Report Dialog) */}
      <Modal
        visible={showReport}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowReport(false);
          if (onCloseReport) onCloseReport();
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.reportHeader}>
              <Ionicons name="flag" size={24} color={coffee.accent} />
              <Text style={styles.reportTitle}>Laporkan Pelanggaran</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReport(false);
                  if (onCloseReport) onCloseReport();
                }}
              >
                <Ionicons name="close" size={22} color={coffee.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>ID Pengguna yang Dilaporkan:</Text>
            <TextInput
              style={styles.input}
              value={reportedUserId}
              onChangeText={setReportedUserId}
              placeholder="Contoh: user_123"
              placeholderTextColor={coffee.secondary}
            />

            <Text style={styles.label}>Alasan Pelaporan:</Text>
            <View style={styles.reasonsContainer}>
              {['Spam Berulang', 'Promosi Judi Online', 'Ujaran Kebencian / Kasar', 'Pelecehan / Konten Tak Pantas'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.tagButton,
                    reportReason === r && styles.tagButtonSelected,
                  ]}
                  onPress={() => setReportReason(r)}
                >
                  <Text style={[styles.tagText, reportReason === r && styles.tagTextSelected]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Bukti Pesan / Keterangan Tambahan:</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={reportEvidence}
              onChangeText={setReportEvidence}
              placeholder="Tuliskan pesan yang melanggar atau kronologi..."
              placeholderTextColor={coffee.secondary}
              multiline
              numberOfLines={3}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowReport(false);
                  if (onCloseReport) onCloseReport();
                }}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.disabledButton]}
                onPress={handleSendReport}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Kirim Laporan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: coffee.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: coffee.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: coffee.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 14,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: 14,
    color: coffee.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  detailBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: coffee.accent,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.accent,
    marginBottom: 4,
  },
  detailContent: {
    fontSize: 13,
    color: coffee.text,
  },
  ruleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  ruleText: {
    flex: 1,
    fontSize: 11,
    color: coffee.secondary,
    lineHeight: 16,
  },
  primaryButton: {
    backgroundColor: coffee.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: coffee.text,
    flex: 1,
    marginLeft: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: coffee.text,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: coffee.text,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  tagButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  tagButtonSelected: {
    backgroundColor: coffee.accent,
    borderColor: coffee.accent,
  },
  tagText: {
    fontSize: 12,
    color: coffee.secondary,
  },
  tagTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelButtonText: {
    color: coffee.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: coffee.accent,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
