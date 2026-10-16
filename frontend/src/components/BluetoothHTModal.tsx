import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import { bluetoothHT, BluetoothHTState } from '../ht/bluetoothHT';
import { serialHT, SerialHTState } from '../ht/serialHT';
import { AcousticModemFrontend } from '../ht/acousticModem';
import { htManager, HTLocalMessage } from '../ht/htManager';

interface BluetoothHTModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BluetoothHTModal({ visible, onClose }: BluetoothHTModalProps) {
  const [connectionMode, setConnectionMode] = useState<'bluetooth' | 'serial' | 'acoustic'>('bluetooth');
  const [htState, setHtState] = useState<BluetoothHTState>(bluetoothHT.getState());
  const [serialState, setSerialState] = useState<SerialHTState>(serialHT.getState());
  const [pendingMessages, setPendingMessages] = useState<HTLocalMessage[]>([]);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [inputFreq, setInputFreq] = useState('145.500');
  const [inputText, setInputText] = useState('');
  const [logs, setLogs] = useState<Array<{ id: string; time: string; type: 'tx' | 'rx' | 'sys'; text: string }>>([
    {
      id: 'init',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      type: 'sys',
      text: 'Modul HT Siap (Bluetooth, USB Serial & Akustik). Frekuensi default: 145.500 MHz.',
    },
  ]);

  useEffect(() => {
    // 1. Bluetooth HT State & Msg subscription
    const unsubBleState = bluetoothHT.subscribeState((newState) => {
      setHtState(newState);
      if (newState.frequency && connectionMode === 'bluetooth') {
        setInputFreq(newState.frequency.toFixed(3));
      }
    });

    const unsubBleMsg = bluetoothHT.onMessage((text) => {
      setLogs((prev) => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'rx',
          text: `[BLE] ${text}`,
        },
        ...prev.slice(0, 30),
      ]);
    });

    // 2. Serial HT State & Msg subscription
    const unsubSerialState = serialHT.subscribeState((newState) => {
      setSerialState(newState);
      if (newState.frequency && connectionMode === 'serial') {
        setInputFreq(newState.frequency.toFixed(3));
      }
    });

    const unsubSerialMsg = serialHT.onMessage((text) => {
      setLogs((prev) => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'rx',
          text: `[USB] ${text}`,
        },
        ...prev.slice(0, 30),
      ]);
    });

    // 3. HTManager pending messages subscription
    const unsubPending = htManager.subscribePending((pending) => {
      setPendingMessages(pending);
    });

    return () => {
      unsubBleState();
      unsubBleMsg();
      unsubSerialState();
      unsubSerialMsg();
      unsubPending();
      AcousticModemFrontend.stopListening();
    };
  }, [connectionMode]);

  const activeConnected = connectionMode === 'bluetooth'
    ? htState.isConnected
    : connectionMode === 'serial'
    ? serialState.isConnected
    : true; // Mode Akustik selalu aktif via Web Audio API bawaan

  const activePtt = connectionMode === 'bluetooth'
    ? htState.pttActive
    : connectionMode === 'serial'
    ? serialState.pttActive
    : false;

  const activeStatusMsg = connectionMode === 'bluetooth'
    ? htState.statusMessage
    : connectionMode === 'serial'
    ? serialState.statusMessage
    : isListeningMic
    ? 'Mikrofon RX Aktif: Mendengarkan audio dari speaker HT...'
    : 'Siap transmit nada AFSK 1200 Baud (Speaker HP ↔ Mic HT)';

  const activeDeviceName = connectionMode === 'bluetooth'
    ? (htState.deviceName || 'HT Bluetooth')
    : connectionMode === 'serial'
    ? (serialState.portName || `USB Dongle HT (${serialState.baudRate} baud)`)
    : 'Modem Akustik Web Audio (Tanpa Hardware)';

  const activeCompat = connectionMode === 'bluetooth'
    ? bluetoothHT.getCompatibilityInfo()
    : connectionMode === 'serial'
    ? serialHT.getCompatibilityInfo()
    : {
        supported: AcousticModemFrontend.isSupported(),
        advice: 'Mode Akustik Web Audio didukung di semua browser (Chrome, Edge, Safari iOS, Firefox, Android).',
      };

  const handleConnect = async () => {
    setConnecting(true);
    const res = connectionMode === 'bluetooth'
      ? await bluetoothHT.connect()
      : await serialHT.connect({ baudRate: 9600 });
    setConnecting(false);
    if (res.success) {
      setLogs((prev) => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'sys',
          text: `Berhasil terhubung ke radio HT (${connectionMode === 'bluetooth' ? 'Bluetooth' : 'USB Serial'}).`,
        },
        ...prev,
      ]);
    }
  };

  const handleDisconnect = async () => {
    if (connectionMode === 'bluetooth') {
      await bluetoothHT.disconnect();
    } else {
      await serialHT.disconnect();
    }
    setLogs((prev) => [
      {
        id: String(Date.now()),
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'sys',
        text: `Koneksi HT (${connectionMode === 'bluetooth' ? 'Bluetooth' : 'USB Serial'}) diputus.`,
      },
      ...prev,
    ]);
  };

  const handleToggleMic = async () => {
    if (isListeningMic) {
      AcousticModemFrontend.stopListening();
      setIsListeningMic(false);
      setLogs((prev) => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'sys',
          text: 'Mikrofon RX Akustik dimatikan.',
        },
        ...prev,
      ]);
    } else {
      try {
        await AcousticModemFrontend.startListening((decodedText) => {
          setLogs((prev) => [
            {
              id: String(Date.now()),
              time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              type: 'rx',
              text: `[AKUSTIK RX] ${decodedText}`,
            },
            ...prev.slice(0, 30),
          ]);
        });
        setIsListeningMic(true);
        setLogs((prev) => [
          {
            id: String(Date.now()),
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            type: 'sys',
            text: 'Mikrofon RX Akustik aktif. Dekatkan speaker radio HT ke mikrofon perangkat.',
          },
          ...prev,
        ]);
      } catch (e: any) {
        setLogs((prev) => [
          {
            id: String(Date.now()),
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            type: 'sys',
            text: `Gagal mengaktifkan mikrofon RX: ${e?.message || e}`,
          },
          ...prev,
        ]);
      }
    }
  };

  const handleSetFrequency = (freqMHz: number) => {
    setInputFreq(freqMHz.toFixed(3));
    if (connectionMode === 'bluetooth') {
      bluetoothHT.setFrequency(freqMHz);
    } else if (connectionMode === 'serial') {
      serialHT.setFrequency(freqMHz);
    }
    setLogs((prev) => [
      {
        id: String(Date.now()),
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'sys',
        text: `Frekuensi disetel ke: ${freqMHz.toFixed(3)} MHz`,
      },
      ...prev,
    ]);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const msg = inputText.trim();
    setInputText('');

    let success = false;
    if (connectionMode === 'bluetooth') {
      success = await bluetoothHT.sendText(msg);
    } else if (connectionMode === 'serial') {
      success = await serialHT.sendText(msg);
    } else {
      await AcousticModemFrontend.playAfsktone(msg);
      success = true;
    }

    // Simpan ke IndexedDB lokal dan kelola sinkronisasi via HTManager (Task 5.7)
    htManager.setMode(connectionMode);
    await htManager.sendMessage(msg, { freq: parseFloat(inputFreq) || 145.500 });

    setLogs((prev) => [
      {
        id: String(Date.now()),
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'tx',
        text: connectionMode === 'acoustic' ? `[AFSK TX] ${msg}` : msg,
      },
      ...prev,
    ]);

    if (!success && !activeConnected) {
      setLogs((prev) => [
        {
          id: String(Date.now() + 1),
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'sys',
          text: `Peringatan: HT belum tersambung via ${connectionMode === 'bluetooth' ? 'Bluetooth' : 'USB Serial'}.`,
        },
        ...prev,
      ]);
    }
  };

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    const res = await htManager.syncToServer();
    setIsSyncingNow(false);
    setLogs((prev) => [
      {
        id: String(Date.now()),
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'sys',
        text: res.success
          ? `Sinkronisasi selesai: ${res.syncedCount} pesan offline tersinkron ke server.`
          : `Hasil sinkronisasi: ${res.syncedCount} tersinkron, ${res.errors} gagal.`,
      },
      ...prev,
    ]);
  };

  const handlePttDown = () => {
    AcousticModemFrontend.playPttChirp();
    if (connectionMode === 'bluetooth') {
      bluetoothHT.setPTT(true);
    } else if (connectionMode === 'serial') {
      serialHT.startPTT();
    }
  };

  const handlePttUp = () => {
    AcousticModemFrontend.playRogerBeep();
    if (connectionMode === 'bluetooth') {
      bluetoothHT.setPTT(false);
    } else if (connectionMode === 'serial') {
      serialHT.stopPTT();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.radioIconWrap}>
                <Text style={{ fontSize: 20 }}>📻</Text>
              </View>
              <View>
                <Text style={styles.title}>Radio Handy Talky (HT)</Text>
                <Text style={styles.subtitle}>Komunikasi Gelombang Radio Tanpa Internet</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={coffee.secondary} />
            </TouchableOpacity>
          </View>

          {/* Mode Selector Tabs (Bluetooth vs USB Serial vs Akustik) */}
          <View style={styles.modeTabsRow}>
            <TouchableOpacity
              style={[styles.modeTabBtn, connectionMode === 'bluetooth' && styles.modeTabBtnActive]}
              onPress={() => setConnectionMode('bluetooth')}
            >
              <Ionicons
                name="bluetooth"
                size={13}
                color={connectionMode === 'bluetooth' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.modeTabText, connectionMode === 'bluetooth' && styles.modeTabTextActive]}>
                📡 Bluetooth
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTabBtn, connectionMode === 'serial' && styles.modeTabBtnActive]}
              onPress={() => setConnectionMode('serial')}
            >
              <MaterialCommunityIcons
                name="usb"
                size={13}
                color={connectionMode === 'serial' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.modeTabText, connectionMode === 'serial' && styles.modeTabTextActive]}>
                🔌 USB Serial
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTabBtn, connectionMode === 'acoustic' && styles.modeTabBtnActive]}
              onPress={() => setConnectionMode('acoustic')}
            >
              <Ionicons
                name="volume-high"
                size={13}
                color={connectionMode === 'acoustic' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.modeTabText, connectionMode === 'acoustic' && styles.modeTabTextActive]}>
                🔊 Akustik (Semua HP)
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Connection Banner */}
            <View style={[styles.statusCard, activeConnected ? styles.connectedCard : styles.disconnectedCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.indicatorDot, { backgroundColor: activeConnected ? '#4ade80' : '#ef4444' }]} />
                  <Text style={styles.statusCardTitle}>
                    {activeConnected ? `Terhubung: ${activeDeviceName}` : `HT ${connectionMode === 'bluetooth' ? 'Bluetooth' : 'USB Serial'} Belum Terhubung`}
                  </Text>
                </View>

                {connectionMode === 'bluetooth' && htState.batteryLevel !== undefined && (
                  <View style={styles.batteryPill}>
                    <Ionicons name="battery-charging" size={12} color="#4ade80" />
                    <Text style={styles.batteryText}>{htState.batteryLevel}%</Text>
                  </View>
                )}
              </View>

              <Text style={styles.statusDescText}>{activeStatusMsg}</Text>

              <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
                {connectionMode === 'acoustic' ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, isListeningMic ? styles.disconnectBtn : styles.connectBtn]}
                    onPress={handleToggleMic}
                  >
                    <Ionicons name={isListeningMic ? 'mic-off' : 'mic'} size={15} color="#FFF" />
                    <Text style={styles.actionBtnText}>
                      {isListeningMic ? 'Matikan Dengar Mic' : 'Aktifkan Dengar Mic (RX Demodulator)'}
                    </Text>
                  </TouchableOpacity>
                ) : !activeConnected ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.connectBtn]}
                    onPress={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        {connectionMode === 'bluetooth' ? (
                          <Ionicons name="bluetooth" size={15} color="#FFF" />
                        ) : (
                          <MaterialCommunityIcons name="usb" size={15} color="#FFF" />
                        )}
                        <Text style={styles.actionBtnText}>
                          {connectionMode === 'bluetooth' ? 'Sambungkan HT Bluetooth' : 'Pilih Port USB Serial HT'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.disconnectBtn]}
                    onPress={handleDisconnect}
                  >
                    <Ionicons name="close-circle-outline" size={15} color="#FFF" />
                    <Text style={styles.actionBtnText}>Putuskan Koneksi</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Compatibility Notice if unsupported */}
              {!activeCompat.supported && (
                <View style={styles.compatWarning}>
                  <Text style={styles.compatWarningText}>
                    ⚠️ {activeCompat.advice}
                  </Text>
                </View>
              )}
            </View>

            {/* Frequency Selector */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📡 Frekuensi Kerja (MHz)</Text>
              <View style={styles.freqPresetsRow}>
                <TouchableOpacity
                  style={[styles.freqPresetBtn, inputFreq === '145.500' && styles.freqPresetBtnActive]}
                  onPress={() => handleSetFrequency(145.500)}
                >
                  <Text style={styles.freqPresetText}>145.500 (Simplex)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.freqPresetBtn, inputFreq === '145.000' && styles.freqPresetBtnActive]}
                  onPress={() => handleSetFrequency(145.000)}
                >
                  <Text style={[styles.freqPresetText, { color: '#f87171' }]}>145.000 (SAR/SOS)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.freqPresetBtn, inputFreq === '433.000' && styles.freqPresetBtnActive]}
                  onPress={() => handleSetFrequency(433.000)}
                >
                  <Text style={styles.freqPresetText}>433.000 (UHF)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* PTT (Push To Talk) Button */}
            <View style={styles.pttSection}>
              <TouchableOpacity
                style={[styles.pttBigBtn, activePtt && styles.pttBigBtnActive]}
                onPressIn={handlePttDown}
                onPressOut={handlePttUp}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={activePtt ? 'mic' : 'mic-outline'}
                  size={36}
                  color={activePtt ? '#FFF' : coffee.accent}
                />
                <Text style={[styles.pttBigBtnText, activePtt && { color: '#FFF' }]}>
                  {activePtt ? 'TRANSMIT (PTT AKTIF)' : 'TEKAN & TAHAN PTT'}
                </Text>
                <Text style={styles.pttSubtext}>Lepas untuk Roger Beep 🔊</Text>
              </TouchableOpacity>
            </View>

            {/* Text Transmission via HT Radio */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>💬 Kirim Teks via Gelombang HT</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ketik pesan radio / sandi warkop..."
                  placeholderTextColor={coffee.muted}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSendText}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSendText}>
                  <Ionicons name="send" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Quick Sandi Buttons */}
              <View style={styles.quickSandiRow}>
                {['CQ CQ CQ', 'Roger Roger! ☕', '10-4 Dimengerti', 'SOS Darurat 🚨'].map((sandi) => (
                  <TouchableOpacity
                    key={sandi}
                    style={styles.quickSandiPill}
                    onPress={() => {
                      setInputText(sandi);
                    }}
                  >
                    <Text style={styles.quickSandiText}>{sandi}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Live Radio Log Monitor */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📻 Log Transmisi Radio Live</Text>
              <View style={styles.logBox}>
                {logs.map((log) => (
                  <View key={log.id} style={styles.logItem}>
                    <Text style={styles.logTime}>[{log.time}]</Text>
                    <Text
                      style={[
                        styles.logText,
                        log.type === 'rx' && { color: '#4ade80' },
                        log.type === 'tx' && { color: '#60a5fa' },
                        log.type === 'sys' && { color: '#fbbf24' },
                      ]}
                    >
                      {log.type === 'rx' ? '📥 RX: ' : log.type === 'tx' ? '📤 TX: ' : 'ℹ️ '}
                      {log.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Task 5.8.1: Sync & Peer Status Footer */}
            <View style={styles.syncFooterCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13 }}>📥</Text>
                  <Text style={styles.syncFooterText}>
                    {pendingMessages.length > 0
                      ? `${pendingMessages.length} pesan offline menunggu sinkronisasi`
                      : 'Semua pesan offline telah tersinkron'}
                  </Text>
                </View>
                {pendingMessages.length > 0 && (
                  <TouchableOpacity
                    style={styles.syncNowBtn}
                    onPress={handleManualSync}
                    disabled={isSyncingNow}
                  >
                    <Ionicons name="sync" size={11} color="#FFF" />
                    <Text style={styles.syncNowText}>
                      {isSyncingNow ? 'Sinkron...' : 'Sinkronkan'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: '#1b120c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: coffee.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    backgroundColor: '#241a12',
  },
  radioIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 163, 115, 0.15)',
    borderWidth: 1,
    borderColor: coffee.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: coffee.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: coffee.secondary,
    fontSize: 11,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#2e1f14',
  },
  modeTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#170e08',
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeTabBtnActive: {
    borderBottomColor: coffee.accent,
    backgroundColor: 'rgba(212, 163, 115, 0.08)',
  },
  modeTabText: {
    color: coffee.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  contentScroll: {
    padding: 14,
  },
  statusCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  connectedCard: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderColor: '#4ade80',
  },
  disconnectedCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#7f1d1d',
  },
  statusCardTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statusDescText: {
    color: coffee.muted,
    fontSize: 11,
    marginTop: 4,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  batteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  batteryText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '700',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
  connectBtn: {
    backgroundColor: '#0284c7', // Blue
  },
  disconnectBtn: {
    backgroundColor: '#dc2626', // Red
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  compatWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  compatWarningText: {
    color: '#fef08a',
    fontSize: 10,
    lineHeight: 14,
  },
  sectionCard: {
    backgroundColor: '#241a12',
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  freqPresetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  freqPresetBtn: {
    flex: 1,
    backgroundColor: '#1b120c',
    borderWidth: 1,
    borderColor: coffee.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  freqPresetBtnActive: {
    borderColor: coffee.accent,
    backgroundColor: 'rgba(212, 163, 115, 0.15)',
  },
  freqPresetText: {
    color: coffee.text,
    fontSize: 11,
    fontWeight: '600',
  },
  pttSection: {
    alignItems: 'center',
    marginVertical: 4,
    marginBottom: 12,
  },
  pttBigBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2e1f14',
    borderWidth: 3,
    borderColor: coffee.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  pttBigBtnActive: {
    backgroundColor: '#dc2626',
    borderColor: '#f87171',
    transform: [{ scale: 0.96 }],
  },
  pttBigBtnText: {
    color: coffee.accent,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  pttSubtext: {
    color: coffee.muted,
    fontSize: 9,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 6,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#170e08',
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 8,
    color: coffee.text,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  sendBtn: {
    backgroundColor: coffee.accent,
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickSandiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickSandiPill: {
    backgroundColor: 'rgba(212, 163, 115, 0.1)',
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  quickSandiText: {
    color: coffee.secondary,
    fontSize: 10,
  },
  logBox: {
    backgroundColor: '#120a05',
    borderWidth: 1,
    borderColor: '#382215',
    borderRadius: 8,
    padding: 8,
    maxHeight: 140,
  },
  logItem: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  logTime: {
    color: coffee.muted,
    fontSize: 9,
  },
  logText: {
    fontSize: 10,
    flex: 1,
  },
  syncFooterCard: {
    backgroundColor: '#20150d',
    borderWidth: 1,
    borderColor: '#3a2416',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  syncFooterText: {
    color: coffee.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: coffee.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  syncNowText: {
    color: '#1b120c',
    fontSize: 10,
    fontWeight: '700',
  },
});
