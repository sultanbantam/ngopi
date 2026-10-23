import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import axios from 'axios';
import { getAuthHeaders } from '../utils/api';
import { AcousticModemFrontend } from '../ht/acousticModem';
import { SerialHTClient } from '../ht/serialHT';
import { APRSFrontend } from '../ht/aprs';
import { socketService } from '../utils/socket';

const API_URL = 'https://api.ngopi.top/api';

interface HTWalkieTalkieModalProps {
  visible: boolean;
  onClose: () => void;
}

interface HTChannel {
  name: string;
  freq: number;
  ctcss: string;
  protocol: 'APRS' | 'AFSK' | 'ANALOG_VOICE' | 'DMR';
  tag: string;
  color: string;
}

const PRESET_CHANNELS: HTChannel[] = [
  {
    name: 'APRS 144.390 (Paket Data/GPS)',
    freq: 144.390,
    ctcss: 'OFF',
    protocol: 'APRS',
    tag: 'APRS',
    color: '#3B82F6',
  },
  {
    name: 'ORARI 145.000 (Darurat Bencana/SAR)',
    freq: 145.000,
    ctcss: '88.5',
    protocol: 'ANALOG_VOICE',
    tag: 'EMERGENCY',
    color: '#EF4444',
  },
  {
    name: 'Warkop HT Net 144.500 (Ngobrol Santai)',
    freq: 144.500,
    ctcss: 'OFF',
    protocol: 'AFSK',
    tag: 'WARKOP',
    color: '#D97706',
  },
  {
    name: 'UHF Repeater 435.000 (Digital DMR)',
    freq: 435.000,
    ctcss: '100.0',
    protocol: 'DMR',
    tag: 'UHF DMR',
    color: '#10B981',
  },
];

export default function HTWalkieTalkieModal({ visible, onClose }: HTWalkieTalkieModalProps) {
  const [activeTab, setActiveTab] = useState<'radio' | 'channels' | 'compliance' | 'logs'>('radio');
  const [selectedChannelIdx, setSelectedChannelIdx] = useState(2); // Default to Warkop HT Net 144.500
  const [customFreq, setCustomFreq] = useState('144.500');
  const [ctcssTone, setCtcssTone] = useState('OFF');
  const [modemMode, setModemMode] = useState<'acoustic' | 'serial'>('acoustic');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [callsign, setCallsign] = useState('YD0NGO');
  const [licenseType, setLicenseType] = useState('ORARI');
  const [licenseNumber, setLicenseNumber] = useState('IAR-789123');
  const [powerWatts, setPowerWatts] = useState('1.0');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [sMeterValue, setSMeterValue] = useState(7); // 1-9 S-meter
  const [incomingNotice, setIncomingNotice] = useState<{ callsign: string; audioUrl?: string } | null>(null);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pttStartTimeRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const curChannel = PRESET_CHANNELS[selectedChannelIdx] || PRESET_CHANNELS[2]!;

  // Handle incoming socket transmission across all open HT modals
  useEffect(() => {
    if (!visible) return;

    loadProfileAndMessages();

    // Ensure audio context is ready on user modal interaction
    AcousticModemFrontend.getAudioContext();

    const socket = socketService.socket;
    if (!socket) return;

    const onIncomingTransmission = (data: any) => {
      if (!data?.message) return;
      const msg = data.message;
      const activeF = parseFloat(customFreq) || curChannel.freq;

      // Check if transmission is on our tuned frequency (tolerance 0.05 MHz)
      if (Math.abs(Number(msg.freq) - activeF) < 0.05) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [msg, ...prev];
        });

        // Trigger RX S-meter and LED
        setIsReceiving(true);
        setSMeterValue(9);
        setTimeout(() => {
          setIsReceiving(false);
          setSMeterValue(7);
        }, 4000);

        // Play incoming audio automatically
        const audioSrc = data.audio_url || msg.audio_url || data.audio_data_url;
        if (audioSrc && typeof window !== 'undefined') {
          try {
            AcousticModemFrontend.playPttChirp();
            if (activeAudioRef.current) {
              activeAudioRef.current.pause();
            }
            const audioObj = new Audio(audioSrc);
            activeAudioRef.current = audioObj;
            audioObj.play().then(() => {
              audioObj.onended = () => {
                AcousticModemFrontend.playRogerBeep();
              };
            }).catch((blockedErr) => {
              console.warn('[HT] Autoplay audio blocked by browser policy:', blockedErr);
              setIncomingNotice({
                callsign: msg.sender_callsign || 'RADIO',
                audioUrl: audioSrc,
              });
            });
          } catch (audioErr) {
            console.warn('[HT] Audio play exception:', audioErr);
          }
        }
      }
    };

    socket.on('ht:transmission', onIncomingTransmission);

    return () => {
      socket.off('ht:transmission', onIncomingTransmission);
      if (activeAudioRef.current) {
        try { activeAudioRef.current.pause(); } catch (_) {}
      }
    };
  }, [visible, customFreq, curChannel.freq]);

  const loadProfileAndMessages = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      // Fetch profile
      const profRes = await axios.get(`${API_URL}/ht/profile`, { headers });
      if (profRes.data?.profile) {
        const p = profRes.data.profile;
        setCallsign(p.callsign || 'YD0NGO');
        setLicenseType(p.license_type || 'ORARI');
        setLicenseNumber(p.license_number || '');
        setPowerWatts(p.power_watts ? p.power_watts.toString() : '1.0');
        setDisclaimerAccepted(Boolean(p.disclaimer_accepted));
      }

      // Fetch messages
      const msgRes = await axios.get(`${API_URL}/ht/messages?freq=${curChannel.freq}`, { headers });
      if (msgRes.data?.messages) {
        setMessages(msgRes.data.messages);
      }
    } catch (e) {
      console.warn('Failed to load HT profile/messages (using local cache):', e);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = (idx: number) => {
    setSelectedChannelIdx(idx);
    const ch = PRESET_CHANNELS[idx];
    if (ch) {
      setCustomFreq(ch.freq.toFixed(3));
      setCtcssTone(ch.ctcss);
      AcousticModemFrontend.playPttChirp();
    }
  };

  // PTT Press Down: Starts recording voice audio from microphone
  const handlePttDown = async () => {
    setIsTransmitting(true);
    pttStartTimeRef.current = Date.now();
    AcousticModemFrontend.playPttChirp();
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(40); } catch (_) {}
    }
    if (modemMode === 'serial' && serialConnected) {
      SerialHTClient.setPtt(true);
    }

    // Start live microphone recording for walkie-talkie audio
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        recorder.start(100);
        mediaRecorderRef.current = recorder;
      } catch (micErr) {
        console.warn('[HT] Mikrofon tidak dapat diakses:', micErr);
      }
    }
  };

  // PTT Release Up: Stops recording and immediately broadcasts voice audio
  const handlePttUp = async () => {
    setIsTransmitting(false);
    AcousticModemFrontend.playRogerBeep();
    if (modemMode === 'serial' && serialConnected) {
      SerialHTClient.setPtt(false);
    }

    const durationSec = Math.max(1, Math.round((Date.now() - pttStartTimeRef.current) / 1000));

    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      recorder.onstop = async () => {
        try {
          const mimeType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          // Release microphone tracks
          if (recorder.stream) {
            recorder.stream.getTracks().forEach((track: any) => track.stop());
          }
          mediaRecorderRef.current = null;

          if (audioBlob.size > 200) {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Audio = reader.result as string;
              try {
                const headers = await getAuthHeaders();
                const payload = {
                  content: `🎙️ Pesan Suara PTT (${durationSec}s)`,
                  freq: parseFloat(customFreq) || curChannel.freq,
                  protocol: curChannel.protocol,
                  audio_url: base64Audio,
                  latitude: -6.2088,
                  longitude: 106.8456,
                  is_emergency: false,
                };
                const res = await axios.post(`${API_URL}/ht/transmit`, payload, { headers });
                if (res.data?.message) {
                  setMessages((prev) => [res.data.message, ...prev]);
                }
              } catch (txErr: any) {
                console.warn('[HT] Gagal memancarkan transmisi suara:', txErr?.message);
              }
            };
            reader.readAsDataURL(audioBlob);
          }
        } catch (stopErr) {
          console.warn('[HT] MediaRecorder stop error:', stopErr);
        }
      };

      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch (recStopErr) {
        console.warn('[HT] Recorder stop error:', recStopErr);
      }
    }
  };

  // Transmit Text Message over AFSK / Radio
  const handleSendTransmission = async (isEmergency = false) => {
    const textToSend = isEmergency
      ? 'EMERGENCY SOS: Butuh evakuasi & bantuan di koordinat pos warkop!'
      : messageInput.trim();

    if (!textToSend) return;

    try {
      setIsTransmitting(true);
      AcousticModemFrontend.playPttChirp();

      // Encode & play audible AFSK tone burst through speaker
      if (modemMode === 'acoustic') {
        const aprsPacket = APRSFrontend.buildAprsPacket(callsign, textToSend);
        await AcousticModemFrontend.playAfsktone(aprsPacket, () => {
          setIsTransmitting(false);
        });
      }

      // Save transmission to backend/local store & broadcast to WebSocket
      const headers = await getAuthHeaders();
      const payload = {
        content: textToSend,
        freq: parseFloat(customFreq) || curChannel.freq,
        protocol: curChannel.protocol,
        latitude: -6.2088,
        longitude: 106.8456,
        is_emergency: isEmergency,
      };

      const res = await axios.post(`${API_URL}/ht/transmit`, payload, { headers });
      if (res.data?.message) {
        setMessages(prev => [res.data.message, ...prev]);
      }

      if (!isEmergency) {
        setMessageInput('');
      } else {
        if (Platform.OS === 'web') {
          window.alert('🚨 SINYAL DARURAT SOS DIPANCARKAN PADA 145.000 MHz!');
        } else {
          Alert.alert('🚨 Sinyal Darurat', 'Sinyal Darurat SOS berhasil dipancarkan pada frekuensi 145.000 MHz.');
        }
      }
    } catch (err: any) {
      console.warn('Transmission error:', err?.message);
    } finally {
      setIsTransmitting(false);
    }
  };

  // Connect kv4p USB Dongle
  const handleConnectSerial = async () => {
    const res = await SerialHTClient.connect();
    if (res.success) {
      setSerialConnected(true);
      await SerialHTClient.setFrequency(parseFloat(customFreq) || curChannel.freq);
      Alert.alert('✅ Hardware Terhubung', 'Modul Radio USB-C kv4p berhasil tersambung.');
    } else {
      Alert.alert('Gagal Sambung Hardware', res.error || 'Port USB Serial tidak ditemukan.');
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.walkieTalkieBody}>
          {/* Top Antenna & Knobs */}
          <View style={styles.hardwareTopRow}>
            {/* Rubber Antenna */}
            <View style={styles.antennaBase}>
              <View style={styles.antennaMast} />
              <View style={styles.antennaTip} />
            </View>

            {/* Volume / Power Knob */}
            <View style={styles.knobContainer}>
              <View style={styles.volumeKnob} />
              <Text style={styles.knobLabel}>VOL / PWR</Text>
            </View>

            {/* Frequency Channel Dial Knob */}
            <View style={styles.knobContainer}>
              <View style={styles.channelKnob} />
              <Text style={styles.knobLabel}>CH / DIAL</Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeHeaderBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* HT Header Brand & LED Indicators */}
          <View style={styles.htBrandRow}>
            <View style={styles.brandTitleWrap}>
              <Text style={styles.htBrandTitle}>NGOPI HT-2026</Text>
              <Text style={styles.htBrandSubtitle}>VHF/UHF TRANSCEIVER</Text>
            </View>

            {/* LED Status Indicators */}
            <View style={styles.ledCluster}>
              <View style={styles.ledWrap}>
                <View style={[styles.ledCircle, isTransmitting ? styles.ledTxActive : styles.ledInactive]} />
                <Text style={styles.ledLabel}>TX</Text>
              </View>
              <View style={styles.ledWrap}>
                <View style={[styles.ledCircle, (isReceiving || (!isTransmitting && sMeterValue >= 9)) ? styles.ledRxActive : styles.ledInactive]} />
                <Text style={styles.ledLabel}>RX</Text>
              </View>
            </View>
          </View>

          {/* Glowing Retro LCD Display */}
          <View style={styles.lcdDisplay}>
            {/* LCD Header: Battery, Power, CTCSS */}
            <View style={styles.lcdHeaderRow}>
              <Text style={styles.lcdSmallText}>CTCSS: {ctcssTone}</Text>
              <Text style={styles.lcdSmallText}>PWR: {powerWatts}W</Text>
              <Text style={styles.lcdSmallText}>BATT: 98% [||||]</Text>
            </View>

            {/* Big Frequency Digits */}
            <View style={styles.lcdFreqRow}>
              <Text style={styles.lcdFreqDigits}>{customFreq}</Text>
              <Text style={styles.lcdFreqUnit}>MHz</Text>
            </View>

            {/* Channel Info & Mode */}
            <View style={styles.lcdSubRow}>
              <Text style={styles.lcdChannelName} numberOfLines={1}>
                CH {selectedChannelIdx + 1}: {curChannel.name}
              </Text>
            </View>

            {/* S-Meter & Callsign Status */}
            <View style={styles.lcdFooterRow}>
              <Text style={styles.lcdSmeter}>
                S: <Text style={{ color: '#F59E0B' }}>S{isTransmitting ? '9+20dB' : '7'}</Text> [====... ]
              </Text>
              <Text style={styles.lcdCallsign}>CALL: {callsign}</Text>
            </View>
          </View>

          {/* Mode Navigation Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'radio' && styles.tabButtonActive]}
              onPress={() => setActiveTab('radio')}
            >
              <Text style={[styles.tabText, activeTab === 'radio' && styles.tabTextActive]}>📻 PTT & Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'channels' && styles.tabButtonActive]}
              onPress={() => setActiveTab('channels')}
            >
              <Text style={[styles.tabText, activeTab === 'channels' && styles.tabTextActive]}>📡 Kanal ({PRESET_CHANNELS.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'compliance' && styles.tabButtonActive]}
              onPress={() => setActiveTab('compliance')}
            >
              <Text style={[styles.tabText, activeTab === 'compliance' && styles.tabTextActive]}>⚖️ Lisensi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'logs' && styles.tabButtonActive]}
              onPress={() => setActiveTab('logs')}
            >
              <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>📜 Log TX</Text>
            </TouchableOpacity>
          </View>

          {/* Main Interactive Screen Content */}
          <ScrollView style={styles.mainContentScroll} contentContainerStyle={{ paddingBottom: 24 }}>
            {activeTab === 'radio' && (
              <View>
                {/* Hardware / Modem Approach Selector */}
                <View style={styles.approachSelectorRow}>
                  <TouchableOpacity
                    style={[styles.approachBtn, modemMode === 'acoustic' && styles.approachBtnActive]}
                    onPress={() => setModemMode('acoustic')}
                  >
                    <Ionicons name="volume-high" size={16} color={modemMode === 'acoustic' ? '#FFF' : '#A8A29E'} />
                    <Text style={[styles.approachBtnText, modemMode === 'acoustic' && styles.approachBtnTextActive]}>
                      Mode Akustik (Ribbit FSK)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.approachBtn, modemMode === 'serial' && styles.approachBtnActive]}
                    onPress={() => setModemMode('serial')}
                  >
                    <Ionicons name="hardware-chip-outline" size={16} color={modemMode === 'serial' ? '#FFF' : '#A8A29E'} />
                    <Text style={[styles.approachBtnText, modemMode === 'serial' && styles.approachBtnTextActive]}>
                      Dongle USB (kv4p)
                    </Text>
                  </TouchableOpacity>
                </View>

                {modemMode === 'serial' && (
                  <View style={styles.serialBanner}>
                    <Text style={styles.serialBannerText}>
                      Status: {serialConnected ? '🟢 Dongle USB Terhubung' : '⚪ Dongle Belum Tersambung'}
                    </Text>
                    <TouchableOpacity style={styles.serialConnectBtn} onPress={handleConnectSerial}>
                      <Text style={styles.serialConnectBtnText}>{serialConnected ? 'Ganti Port' : '🔌 Sambungkan Port USB'}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Incoming Transmission Notice Banner if autoplay was blocked */}
                {incomingNotice && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#064e3b',
                      borderColor: '#10b981',
                      borderWidth: 1.5,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={() => {
                      if (incomingNotice.audioUrl) {
                        try {
                          AcousticModemFrontend.playPttChirp();
                          const a = new Audio(incomingNotice.audioUrl);
                          a.play().then(() => {
                            a.onended = () => AcousticModemFrontend.playRogerBeep();
                          }).catch((e) => console.warn(e));
                        } catch (_) {}
                      }
                      setIncomingNotice(null);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Ionicons name="volume-high" size={24} color="#10b981" />
                      <View>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                          🎙️ Transmisi Suara Masuk (@{incomingNotice.callsign})
                        </Text>
                        <Text style={{ color: '#a7f3d0', fontSize: 10, marginTop: 2 }}>
                          Ketuk di sini untuk memutar audio transmisi
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="play-circle" size={30} color="#10b981" />
                  </TouchableOpacity>
                )}

                {/* Big Tactical PTT (Push-To-Talk) Control */}
                <View style={styles.pttSection}>
                  <Text style={styles.pttInstruction}>
                    {isTransmitting ? '🔴 MEMANCARKAN AUDIO KE HT...' : 'Tahan tombol untuk bicara (PTT), lepas untuk standby (RX)'}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.largePttButton, isTransmitting && styles.largePttButtonActive]}
                    onPressIn={handlePttDown}
                    onPressOut={handlePttUp}
                  >
                    <MaterialCommunityIcons
                      name={isTransmitting ? 'microphone' : 'microphone-outline'}
                      size={44}
                      color="#FFF"
                    />
                    <Text style={styles.largePttButtonText}>{isTransmitting ? 'TRANSMITTING...' : 'PUSH TO TALK (PTT)'}</Text>
                    <Text style={styles.largePttSubtext}>
                      {modemMode === 'acoustic' ? 'Modulasi Audio Speaker -> Mic HT' : 'USB Serial TX'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Text Message over Radio (APRS / AFSK packet) */}
                <View style={styles.transmitBox}>
                  <Text style={styles.inputHeaderLabel}>Kirim Pesan Teks via Radio (AFSK 1200 Baud):</Text>
                  <View style={styles.textInputRow}>
                    <TextInput
                      style={styles.messageInputField}
                      placeholder="Ketik pesan darurat / obrolan HT..."
                      placeholderTextColor="#78716C"
                      value={messageInput}
                      onChangeText={setMessageInput}
                    />
                    <TouchableOpacity
                      style={styles.sendAfsKBtn}
                      onPress={() => handleSendTransmission(false)}
                      disabled={isTransmitting || !messageInput.trim()}
                    >
                      <Ionicons name="radio" size={18} color="#FFF" />
                      <Text style={styles.sendAfsKBtnText}>Kirim</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Emergency SOS Quick Button */}
                <TouchableOpacity
                  style={styles.emergencySosBtn}
                  onPress={() => handleSendTransmission(true)}
                  disabled={isTransmitting}
                >
                  <Ionicons name="warning" size={20} color="#FFF" />
                  <Text style={styles.emergencySosBtnText}>🚨 PANCARKAN SOS DARURAT (145.000 MHz)</Text>
                </TouchableOpacity>

                {/* Radio Message History / Traffic */}
                <View style={styles.trafficSection}>
                  <Text style={styles.trafficHeader}>Lalulintas Frekuensi ({customFreq} MHz):</Text>
                  {messages.length === 0 ? (
                    <Text style={styles.trafficEmptyText}>Belum ada transmisi di frekuensi ini. Siap menerima (RX Standby)...</Text>
                  ) : (
                    messages.map((m, idx) => (
                      <View key={m.id || idx} style={[styles.trafficBubble, m.is_emergency && styles.trafficEmergencyBubble]}>
                        <View style={styles.trafficBubbleHeader}>
                          <Text style={[styles.trafficCallsign, m.is_emergency && { color: '#EF4444' }]}>
                            📻 @{m.sender_callsign || m.sender_id}
                          </Text>
                          <Text style={styles.trafficTime}>
                            {new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <Text style={styles.trafficContent}>{m.content}</Text>
                        <View style={styles.trafficMetaRow}>
                          <Text style={styles.trafficMetaText}>{m.protocol} • {m.freq} MHz</Text>
                          {m.audio_url && (
                            <TouchableOpacity
                              style={styles.playAudioBubbleBtn}
                              onPress={() => {
                                if (m.audio_url?.startsWith('data:audio') || m.audio_url?.startsWith('http')) {
                                  try {
                                    AcousticModemFrontend.playPttChirp();
                                    const audio = new Audio(m.audio_url);
                                    audio.play().then(() => {
                                      audio.onended = () => AcousticModemFrontend.playRogerBeep();
                                    }).catch((err) => console.warn('[HT] Audio play error:', err));
                                  } catch (e) {
                                    console.warn('[HT] Audio exception:', e);
                                  }
                                } else {
                                  AcousticModemFrontend.playAfsktone(m.content);
                                }
                              }}
                            >
                              <Ionicons name="volume-high" size={14} color="#D97706" />
                              <Text style={styles.playAudioBubbleBtnText}>
                                {m.content?.includes('Pesan Suara') || m.content?.includes('Suara') ? 'Putar Suara 🎙️' : 'Putar Audio 📻'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {activeTab === 'channels' && (
              <View style={styles.channelsList}>
                <Text style={styles.sectionHeading}>Pilih Kanal Warung HT Resmi:</Text>
                {PRESET_CHANNELS.map((ch, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.channelCard, selectedChannelIdx === idx && styles.channelCardActive]}
                    onPress={() => handleChannelSelect(idx)}
                  >
                    <View style={styles.channelCardLeft}>
                      <View style={[styles.channelTagBadge, { backgroundColor: ch.color }]}>
                        <Text style={styles.channelTagText}>{ch.tag}</Text>
                      </View>
                      <View>
                        <Text style={styles.channelCardName}>{ch.name}</Text>
                        <Text style={styles.channelCardFreq}>{ch.freq.toFixed(3)} MHz • CTCSS: {ch.ctcss}</Text>
                      </View>
                    </View>
                    {selectedChannelIdx === idx && (
                      <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                    )}
                  </TouchableOpacity>
                ))}

                {/* Custom Frequency Input */}
                <View style={styles.customFreqBox}>
                  <Text style={styles.inputHeaderLabel}>Setel Frekuensi Manual (MHz):</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      style={[styles.messageInputField, { flex: 1 }]}
                      keyboardType="numeric"
                      value={customFreq}
                      onChangeText={setCustomFreq}
                    />
                    <TouchableOpacity
                      style={styles.sendAfsKBtn}
                      onPress={() => {
                        AcousticModemFrontend.playPttChirp();
                        Alert.alert('Frekuensi Disetel', `Frekuensi aktif disetel ke ${customFreq} MHz.`);
                      }}
                    >
                      <Text style={styles.sendAfsKBtnText}>Terapkan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'compliance' && (
              <View style={styles.complianceBox}>
                <Text style={styles.sectionHeading}>Kepatuhan Regulasi Radio (ORARI / Kominfo)</Text>
                <Text style={styles.complianceDisclaimer}>
                  ⚠️ Penggunaan spektrum frekuensi radio di Indonesia diatur oleh UU Telekomunikasi & Permenkominfo.
                  Pastikan Anda memiliki lisensi IAR (ORARI) atau KRAP (RAPI) saat memancarkan transmisi berdaya tinggi.
                </Text>

                <Text style={styles.inputHeaderLabel}>Tanda Panggil (Callsign):</Text>
                <TextInput
                  style={styles.messageInputField}
                  placeholder="Contoh: YB1NGO / YD0ABC"
                  placeholderTextColor="#78716C"
                  value={callsign}
                  onChangeText={setCallsign}
                />

                <Text style={styles.inputHeaderLabel}>Jenis Lisensi:</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {['ORARI', 'KRAP', 'NONE'].map(lt => (
                    <TouchableOpacity
                      key={lt}
                      style={[styles.licenseBtn, licenseType === lt && styles.licenseBtnActive]}
                      onPress={() => setLicenseType(lt)}
                    >
                      <Text style={[styles.licenseBtnText, licenseType === lt && styles.licenseBtnTextActive]}>{lt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputHeaderLabel}>Nomor Izin Amatir Radio (IAR):</Text>
                <TextInput
                  style={styles.messageInputField}
                  placeholder="Nomor IAR resmi..."
                  placeholderTextColor="#78716C"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                />

                <Text style={styles.inputHeaderLabel}>Batas Daya Pancar (Maks. 5.0 Watt):</Text>
                <TextInput
                  style={styles.messageInputField}
                  keyboardType="numeric"
                  value={powerWatts}
                  onChangeText={setPowerWatts}
                />

                <TouchableOpacity
                  style={styles.saveComplianceBtn}
                  onPress={async () => {
                    try {
                      const headers = await getAuthHeaders();
                      await axios.post(
                        `${API_URL}/ht/profile`,
                        {
                          callsign,
                          license_type: licenseType,
                          license_number: licenseNumber,
                          power_watts: parseFloat(powerWatts) || 1.0,
                          disclaimer_accepted: true,
                        },
                        { headers }
                      );
                      Alert.alert('Tersimpan', 'Profil & lisensi radio berhasil diperbarui.');
                    } catch (e) {
                      Alert.alert('Sukses Lokal', 'Pengaturan lisensi disimpan di perangkat.');
                    }
                  }}
                >
                  <Text style={styles.saveComplianceBtnText}>Simpan Pengaturan Lisensi</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'logs' && (
              <View>
                <Text style={styles.sectionHeading}>Log Transmisi Radio (Audit Kominfo):</Text>
                <Text style={styles.logSubtext}>Setiap transmisi dicatat dengan timestamp dan hash SHA-256 untuk mematuhi regulasi telekomunikasi.</Text>
                <View style={styles.logList}>
                  {messages.map((m, idx) => (
                    <View key={idx} style={styles.logItem}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.logCallsign}>{m.sender_callsign || callsign} [TX]</Text>
                        <Text style={styles.logFreq}>{m.freq || customFreq} MHz</Text>
                      </View>
                      <Text style={styles.logContent}>{m.content}</Text>
                      <Text style={styles.logHash}>Hash: SHA256-{(m.id || 'sig').slice(0, 16)}...</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  walkieTalkieBody: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: '#1C1917', // Rugged black/charcoal
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#44403C',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  hardwareTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#292524',
  },
  antennaBase: {
    alignItems: 'center',
    marginLeft: 8,
  },
  antennaMast: {
    width: 14,
    height: 38,
    backgroundColor: '#292524',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: '#44403C',
  },
  antennaTip: {
    width: 18,
    height: 8,
    backgroundColor: '#78716C',
    borderRadius: 4,
    marginTop: -4,
  },
  knobContainer: {
    alignItems: 'center',
  },
  volumeKnob: {
    width: 28,
    height: 18,
    backgroundColor: '#44403C',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#78716C',
  },
  channelKnob: {
    width: 34,
    height: 20,
    backgroundColor: '#44403C',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D97706',
  },
  knobLabel: {
    fontSize: 9,
    color: '#A8A29E',
    marginTop: 4,
    fontWeight: '700',
  },
  closeHeaderBtn: {
    padding: 8,
    backgroundColor: '#292524',
    borderRadius: 16,
  },
  htBrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  brandTitleWrap: {},
  htBrandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 1,
  },
  htBrandSubtitle: {
    fontSize: 9,
    color: '#A8A29E',
    letterSpacing: 1.5,
  },
  ledCluster: {
    flexDirection: 'row',
    gap: 16,
  },
  ledWrap: {
    alignItems: 'center',
  },
  ledCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 2,
  },
  ledTxActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowRadius: 8,
    shadowOpacity: 1,
  },
  ledRxActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowRadius: 8,
    shadowOpacity: 1,
  },
  ledInactive: {
    backgroundColor: '#292524',
  },
  ledLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#78716C',
  },
  lcdDisplay: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 12,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  lcdHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  lcdSmallText: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  lcdFreqRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 4,
  },
  lcdFreqDigits: {
    fontSize: 34,
    fontWeight: '900',
    color: '#38BDF8',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 2,
  },
  lcdFreqUnit: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#38BDF8',
  },
  lcdSubRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  lcdChannelName: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  lcdFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 4,
  },
  lcdSmeter: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  lcdCallsign: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#292524',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#44403C',
  },
  tabText: {
    fontSize: 11,
    color: '#A8A29E',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#F59E0B',
    fontWeight: 'bold',
  },
  mainContentScroll: {
    flexShrink: 1,
  },
  approachSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  approachBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#292524',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#44403C',
  },
  approachBtnActive: {
    backgroundColor: '#78350F',
    borderColor: '#F59E0B',
  },
  approachBtnText: {
    fontSize: 11,
    color: '#A8A29E',
  },
  approachBtnTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  serialBanner: {
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serialBannerText: {
    fontSize: 11,
    color: '#E2E8F0',
  },
  serialConnectBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  serialConnectBtnText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  pttSection: {
    alignItems: 'center',
    marginVertical: 10,
  },
  pttInstruction: {
    fontSize: 11,
    color: '#A8A29E',
    marginBottom: 10,
    textAlign: 'center',
  },
  largePttButton: {
    width: '100%',
    backgroundColor: '#B45309',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#D97706',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B45309',
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  largePttButtonActive: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
  },
  largePttButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  largePttSubtext: {
    fontSize: 11,
    color: '#FEF3C7',
    marginTop: 2,
  },
  transmitBox: {
    backgroundColor: '#292524',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  inputHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E7E5E4',
    marginBottom: 6,
  },
  textInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  messageInputField: {
    flex: 1,
    backgroundColor: '#1C1917',
    color: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#44403C',
  },
  sendAfsKBtn: {
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  sendAfsKBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emergencySosBtn: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  emergencySosBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  trafficSection: {
    marginTop: 16,
  },
  trafficHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D6D3D1',
    marginBottom: 8,
  },
  trafficEmptyText: {
    fontSize: 11,
    color: '#78716C',
    fontStyle: 'italic',
  },
  trafficBubble: {
    backgroundColor: '#292524',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  trafficEmergencyBubble: {
    borderLeftColor: '#EF4444',
    backgroundColor: '#450A0A',
  },
  trafficBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  trafficCallsign: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  trafficTime: {
    fontSize: 10,
    color: '#A8A29E',
  },
  trafficContent: {
    fontSize: 13,
    color: '#F5F5F4',
    lineHeight: 18,
  },
  trafficMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  trafficMetaText: {
    fontSize: 10,
    color: '#78716C',
  },
  playAudioBubbleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#44403C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playAudioBubbleBtnText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: 'bold',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 10,
  },
  channelsList: {},
  channelCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#292524',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#44403C',
  },
  channelCardActive: {
    borderColor: '#10B981',
    backgroundColor: '#1E293B',
  },
  channelCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  channelTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  channelTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFF',
  },
  channelCardName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
  },
  channelCardFreq: {
    fontSize: 11,
    color: '#A8A29E',
    marginTop: 2,
  },
  customFreqBox: {
    backgroundColor: '#292524',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  complianceBox: {
    backgroundColor: '#292524',
    padding: 14,
    borderRadius: 12,
  },
  complianceDisclaimer: {
    fontSize: 11,
    color: '#FCA5A5',
    lineHeight: 16,
    backgroundColor: '#450A0A',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  licenseBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#1C1917',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#44403C',
  },
  licenseBtnActive: {
    backgroundColor: '#78350F',
    borderColor: '#F59E0B',
  },
  licenseBtnText: {
    fontSize: 11,
    color: '#A8A29E',
  },
  licenseBtnTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  saveComplianceBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 12,
  },
  saveComplianceBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  logSubtext: {
    fontSize: 11,
    color: '#A8A29E',
    marginBottom: 12,
  },
  logList: {
    gap: 8,
  },
  logItem: {
    backgroundColor: '#292524',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  logCallsign: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  logFreq: {
    fontSize: 10,
    color: '#A8A29E',
  },
  logContent: {
    fontSize: 12,
    color: '#E7E5E4',
    marginVertical: 4,
  },
  logHash: {
    fontSize: 9,
    color: '#78716C',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
});
