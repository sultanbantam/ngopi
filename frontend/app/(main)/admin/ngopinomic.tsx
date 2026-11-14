import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { coffee } from '../../../src/theme/coffee';
import { API_URL, getAuthHeaders } from '../../../src/utils/api';

export default function NgopinomicAdminScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [directBps, setDirectBps] = useState('2000');
  const [maxCapBps, setMaxCapBps] = useState('3500');
  const [newInvValue, setNewInvValue] = useState('');
  const [newInvCategory, setNewInvCategory] = useState<'premium_id' | 'premium_email'>('premium_id');
  const [newInvPriceIdr, setNewInvPriceIdr] = useState('50000');
  const [reversalReason, setReversalReason] = useState('Permintaan refund staging');
  const [message, setMessage] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_URL}/ngopinomic/admin/config`, { headers });
      setConfig(res.data);
      if (res.data?.rule) {
        setDirectBps(String(res.data.rule.direct_rate_bps));
        setMaxCapBps(String(res.data.rule.max_total_cap_bps));
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Akses admin diperlukan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveRules = async () => {
    try {
      const headers = await getAuthHeaders();
      await axios.put(
        `${API_URL}/ngopinomic/admin/commission-rules`,
        {
          direct_rate_bps: Number(directBps),
          max_total_cap_bps: Number(maxCapBps),
          reason,
        },
        { headers }
      );
      setReason('');
      setMessage('Aturan komisi berhasil diperbarui dan dicatat di AdminAuditLog.');
      await loadConfig();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Gagal menyimpan aturan.');
    }
  };

  const handleAddInventory = async () => {
    if (!newInvValue.trim()) return;
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_URL}/ngopinomic/admin/inventory`,
        {
          category: newInvCategory,
          display_value: newInvValue.trim(),
          rarity_tier: 'Regular',
          price_idr: Number(newInvPriceIdr) || 50000,
          price_points: 5000,
          reason: reason.trim() || 'Penambahan inventaris dari Admin Control Center',
        },
        { headers }
      );
      setNewInvValue('');
      setMessage('Inventaris identitas premium berhasil ditambahkan.');
      await loadConfig();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Gagal menambah inventaris.');
    }
  };

  const handleReturnInventory = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_URL}/ngopinomic/admin/inventory/${id}/return`,
        { reason: reversalReason.trim() || 'Pengembalian inventaris oleh admin' },
        { headers }
      );
      setMessage('Status inventaris dikembalikan ke Returned.');
      await loadConfig();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Gagal mengembalikan inventaris.');
    }
  };

  const handleReverseTx = async (txId: string) => {
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_URL}/ngopinomic/admin/transactions/${txId}/reverse`,
        { reason: reversalReason.trim() || 'Reversal oleh admin' },
        { headers }
      );
      setMessage('Transaksi dan komisi terkait berhasil dibalik.');
      await loadConfig();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Gagal membalik transaksi.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={coffee.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backLink}>← Kembali</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Admin Control Center — NGOPINOMIC</Text>
      {message ? <Text style={styles.notice}>{message}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Konfigurasi Aturan Komisi (Basis Points)</Text>
        <Text style={styles.label}>Direct Affiliate (bps, default 2000 = 20%)</Text>
        <TextInput value={directBps} onChangeText={setDirectBps} style={styles.input} keyboardType="numeric" />
        <Text style={styles.label}>Plafon Total Komisi (bps, default 3500 = 35%)</Text>
        <TextInput value={maxCapBps} onChangeText={setMaxCapBps} style={styles.input} keyboardType="numeric" />
        <Text style={styles.label}>Alasan Perubahan (Wajib untuk Audit Log)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Contoh: Penyesuaian tarif kampanye Q4"
          placeholderTextColor={coffee.muted}
          style={styles.input}
        />
        <TouchableOpacity style={styles.btn} onPress={handleSaveRules}>
          <Text style={styles.btnText}>Simpan & Catat Audit Log</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Inventaris Identitas Premium ({config?.inventory?.length ?? 0})</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity
            style={[styles.chipBtn, newInvCategory === 'premium_id' && styles.chipActive]}
            onPress={() => setNewInvCategory('premium_id')}
          >
            <Text style={styles.btnText}>ID Premium</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chipBtn, newInvCategory === 'premium_email' && styles.chipActive]}
            onPress={() => setNewInvCategory('premium_email')}
          >
            <Text style={styles.btnText}>Email Premium</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={newInvValue}
          onChangeText={setNewInvValue}
          placeholder="Nama ID atau email@ngopi.top"
          placeholderTextColor={coffee.muted}
          style={styles.input}
        />
        <TextInput
          value={newInvPriceIdr}
          onChangeText={setNewInvPriceIdr}
          placeholder="Harga IDR"
          keyboardType="numeric"
          style={styles.input}
        />
        <TouchableOpacity style={styles.btn} onPress={handleAddInventory}>
          <Text style={styles.btnText}>Tambah / Perbarui Inventaris</Text>
        </TouchableOpacity>
        {(config?.inventory || []).slice(0, 8).map((inv: any) => (
          <View key={inv.id} style={styles.rowBetween}>
            <Text style={styles.logItem}>
              {inv.display_value} [{inv.rarity_tier}] — {inv.status}
            </Text>
            {inv.status === 'Active' || inv.status === 'Sold' ? (
              <TouchableOpacity style={styles.smallBtn} onPress={() => handleReturnInventory(inv.id)}>
                <Text style={styles.btnText}>Kembalikan</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Transaksi Ledger & Reversal ({config?.ledger_transactions?.length ?? 0})</Text>
        <TextInput
          value={reversalReason}
          onChangeText={setReversalReason}
          placeholder="Alasan reversal / pengembalian"
          placeholderTextColor={coffee.muted}
          style={styles.input}
        />
        {(config?.ledger_transactions || []).slice(0, 8).map((tx: any) => (
          <View key={tx.id} style={styles.rowBetween}>
            <Text style={styles.logItem}>
              {tx.reference_code} ({tx.tx_type}) — {tx.status}
            </Text>
            {tx.status === 'posted' && tx.tx_type !== 'refund_reversal' ? (
              <TouchableOpacity style={styles.smallBtn} onPress={() => handleReverseTx(tx.id)}>
                <Text style={styles.btnText}>Reversal</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Audit Log Perubahan Terbaru ({config?.audit_logs?.length ?? 0})</Text>
        {(config?.audit_logs || []).map((log: any) => (
          <Text key={log.id} style={styles.logItem}>
            • {log.action} ({log.target_entity}) — {log.reason}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: coffee.background },
  content: { padding: 16, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: coffee.background },
  backLink: { color: coffee.accent, fontSize: 14, fontWeight: '700' },
  title: { color: coffee.text, fontSize: 20, fontWeight: '800' },
  notice: { color: coffee.text, backgroundColor: coffee.highlight, padding: 10, borderRadius: 8 },
  card: { backgroundColor: coffee.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: coffee.border, gap: 8 },
  cardTitle: { color: coffee.accent, fontSize: 15, fontWeight: '700' },
  label: { color: coffee.secondary, fontSize: 12 },
  input: { backgroundColor: coffee.inset, color: coffee.text, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: coffee.border },
  btn: { backgroundColor: coffee.button, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnText: { color: coffee.buttonText, fontWeight: '700' },
  logItem: { color: coffee.secondary, fontSize: 12, flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: coffee.border },
  smallBtn: { backgroundColor: coffee.dangerButton, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  chipBtn: { backgroundColor: coffee.inset, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: coffee.border },
  chipActive: { backgroundColor: coffee.button, borderColor: coffee.accent },
});

