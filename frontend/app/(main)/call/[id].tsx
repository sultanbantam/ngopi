import { coffee } from '../../../src/theme/coffee';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { socketService } from '../../../src/utils/socket';
import * as SecureStore from '../../../src/utils/storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const CALL_TIMEOUT_MS = 30_000;
const ICE_GATHERING_TIMEOUT_MS = 5_000;
const MEDIA_CONNECT_TIMEOUT_MS = 12_000;
const ICE_RESTART_DELAY_MS = 2_500;
const MEDIA_WATCHDOG_INTERVAL_MS = 5_000;
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }];


const formatCallDuration = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const getIceServers = (socket: any) => new Promise<RTCIceServer[]>((resolve) => {
  if (!socket) {
    resolve(FALLBACK_ICE_SERVERS);
    return;
  }
  socket.timeout(5_000).emit('get_ice_servers', (error: unknown, response: any) => {
    const iceServers = response?.iceServers;
    resolve(!error && Array.isArray(iceServers) && iceServers.length > 0 ? iceServers : FALLBACK_ICE_SERVERS);
  });
});

const waitForIceGatheringComplete = (peer: RTCPeerConnection) => new Promise<void>((resolve) => {
  if (peer.iceGatheringState === 'complete') {
    resolve();
    return;
  }

  let timeout: ReturnType<typeof setTimeout>;
  const finish = () => {
    clearTimeout(timeout);
    peer.removeEventListener('icegatheringstatechange', handleStateChange);
    resolve();
  };
  const handleStateChange = () => {
    if (peer.iceGatheringState === 'complete') finish();
  };
  timeout = setTimeout(finish, ICE_GATHERING_TIMEOUT_MS);
  peer.addEventListener('icegatheringstatechange', handleStateChange);
});

export default function CallScreen() {
  const { id: partnerId, name, isVideo, isCaller = 'true', incomingSignal, callId } = useLocalSearchParams();
  const router = useRouter();

  const isVideoCall = isVideo === 'true';
  const caller = isCaller === 'true';

  const [status, setStatus] = useState(caller ? 'Calling...' : 'Connecting...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Call controls state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(!isVideoCall);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);

  // Refs for video elements (Web only)
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const peerRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const actualRoomIdRef = useRef<string>('');
  const pendingCandidates = useRef<any[]>([]);
  const hasNavigatedBack = useRef(false);
  const callIdRef = useRef(String(callId || `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`));
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringbackStopRef = useRef<() => void>(() => {});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaConnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaWatchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const restartInProgressRef = useRef(false);
  const lastInboundBytesRef = useRef(0);
  const stalledMediaChecksRef = useRef(0);
  const [connectionHint, setConnectionHint] = useState('');

  const playRemoteAudio = async () => {
    if (Platform.OS !== 'web') return;
    const audio = remoteAudioRef.current;
    const remoteStream = remoteStreamRef.current;
    if (!audio || !remoteStream) return;

    try {
      audio.srcObject = remoteStream;
      audio.muted = false;
      audio.volume = 1;
      await audio.play();
      setNeedsAudioTap(false);
    } catch (error) {
      console.log('Remote audio needs user tap:', error);
      setNeedsAudioTap(true);
    }
  };

  const stopOutgoingRingback = () => {
    ringbackStopRef.current();
    ringbackStopRef.current = () => {};
  };

  const startOutgoingRingback = () => {
    if (Platform.OS !== 'web' || !caller) return;
    stopOutgoingRingback();
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillators: OscillatorNode[] = [];
      for (let cycleMs = 0; cycleMs < CALL_TIMEOUT_MS; cycleMs += 2_500) {
        [425, 480].forEach((frequency, index) => {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          const startsAt = audioCtx.currentTime + cycleMs / 1000 + index * 0.22;
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, startsAt);
          gainNode.gain.setValueAtTime(0.0001, startsAt);
          gainNode.gain.exponentialRampToValueAtTime(0.22, startsAt + 0.03);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.38);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start(startsAt);
          oscillator.stop(startsAt + 0.4);
          oscillators.push(oscillator);
        });
      }
      void audioCtx.resume();
      ringbackStopRef.current = () => {
        oscillators.forEach((oscillator) => { try { oscillator.stop(); } catch { /* already stopped */ } });
        void audioCtx.close();
      };
    } catch (error) {
      console.log('Outgoing ringback error:', error);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') {
      alert('Fitur Panggilan (WebRTC) saat ini baru dioptimalkan untuk versi Web (Browser).');
      if (router.canGoBack()) router.back();
      else router.replace('/(main)/contacts');
      return;
    }

    let isCallActive = true;
    let activeSocket: any = null;
    let signalingReady = false;
    let localCandidates: RTCIceCandidateInit[] = [];
    let restartAttempts = 0;
    let hasTurn = false;
    const flushLocalCandidates = () => {
      if (!signalingReady || !activeSocket || !isCallActive) return;
      const queued = localCandidates;
      localCandidates = [];
      queued.forEach(candidate => activeSocket.emit('ice_candidate', {
        candidate, to: partnerId, room_id: actualRoomIdRef.current, call_id: callIdRef.current,
      }));
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const startDurationCounter = () => {
      if (!connectedAtRef.current) connectedAtRef.current = Date.now();
      if (durationIntervalRef.current) return;
      durationIntervalRef.current = setInterval(() => {
        if (connectedAtRef.current) setElapsedSeconds(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      }, 1_000);
    };

    const requestIceRestart = () => {
      if (!caller || !isCallActive || restartInProgressRef.current || reconnectTimerRef.current) return;
      if (restartAttempts >= 2) {
        setStatus('Sambungan media belum berhasil');
        setConnectionHint(hasTurn ? 'Periksa layanan TURN, kredensial, dan firewall server.' : 'Server belum menyediakan TURN. Koneksi langsung antarjaringan dapat terhalang.');
        return;
      }
      reconnectTimerRef.current = setTimeout(async () => {
        reconnectTimerRef.current = null;
        const peer = peerRef.current;
        if (!peer || peer.signalingState === 'closed' || peer.signalingState !== 'stable' || !activeSocket) return;
        restartInProgressRef.current = true;
        restartAttempts += 1;
        setStatus('Memulihkan koneksi...');
        try {
          const restartOffer = await peer.createOffer({ iceRestart: true });
          await peer.setLocalDescription(restartOffer);
          await waitForIceGatheringComplete(peer);
          activeSocket.emit('restart_call', {
            signal: peer.localDescription,
            to: partnerId,
            room_id: actualRoomIdRef.current,
            call_id: callIdRef.current,
          });
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            restartInProgressRef.current = false;
            if (peer.connectionState !== 'connected') requestIceRestart();
          }, MEDIA_CONNECT_TIMEOUT_MS);
        } catch (error) {
          console.error('ICE restart failed:', error);
          restartInProgressRef.current = false;
          setStatus('Koneksi media gagal');
        }
      }, ICE_RESTART_DELAY_MS);
    };

    const startMediaWatchdog = () => {
      if (!caller || mediaWatchdogRef.current) return;
      mediaWatchdogRef.current = setInterval(async () => {
        const peer = peerRef.current;
        if (!peer || peer.connectionState !== 'connected') return;
        try {
          const stats = await peer.getStats();
          let inboundBytes = 0;
          stats.forEach((report: any) => {
            if (report.type === 'inbound-rtp' && !report.isRemote) inboundBytes += Number(report.bytesReceived || 0);
          });
          if (inboundBytes > lastInboundBytesRef.current) {
            stalledMediaChecksRef.current = 0;
          } else {
            stalledMediaChecksRef.current += 1;
          }
          lastInboundBytesRef.current = inboundBytes;
          if (stalledMediaChecksRef.current >= 2) {
            stalledMediaChecksRef.current = 0;
            requestIceRestart();
          }
        } catch (error) {
          console.error('Media watchdog failed:', error);
        }
      }, MEDIA_WATCHDOG_INTERVAL_MS);
    };

    const initCall = async () => {
      let myId = localStorage.getItem('userId') || '';
      if (!myId) myId = (await SecureStore.getItemAsync('userId')) || '';

      const sharedKey = [myId, partnerId].sort().join('-');
      actualRoomIdRef.current = sharedKey;
      const socket = await socketService.connect();
      const iceServers = await getIceServers(socket);
      if (!isCallActive) return;
      hasTurn = iceServers.some(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).some(url => /^turns?:/i.test(url)));
      if (!hasTurn) setConnectionHint('TURN belum tersedia dari server; sedang mencoba koneksi langsung.');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoCall,
          audio: true
        });

        if (!isCallActive) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        if (myVideoRef.current && isVideoCall) {
          myVideoRef.current.srcObject = stream;
        }

        // Setup RTCPeerConnection
        const configuration = { iceServers };
        const peer = new (window as any).RTCPeerConnection(configuration);
        peerRef.current = peer;

        // Add local stream to peer
        stream.getTracks().forEach((track: any) => {
          peer.addTrack(track, stream);
        });

        // Handle incoming stream
        peer.ontrack = (event: any) => {
          const remoteStream = event.streams[0] || remoteStreamRef.current || new MediaStream();
          if (!event.streams[0] && !remoteStream.getTracks().some((track: MediaStreamTrack) => track.id === event.track.id)) {
            remoteStream.addTrack(event.track);
          }
          remoteStreamRef.current = remoteStream;
          if (mediaConnectTimeoutRef.current) clearTimeout(mediaConnectTimeoutRef.current);
          mediaConnectTimeoutRef.current = null;
          event.track.onunmute = () => void playRemoteAudio();
          event.track.onended = () => {
            if (!isCallActive) return;
            setStatus('Media terputus, memulihkan...');
            requestIceRestart();
          };
          if (isVideoCall && userVideoRef.current) {
            userVideoRef.current.srcObject = remoteStream;
            userVideoRef.current.muted = true;
            void userVideoRef.current.play().catch((error: unknown) => console.log('Remote video play failed:', error));
          }
          void playRemoteAudio();
        };

        peer.onconnectionstatechange = () => {
          if (!isCallActive) return;
          if (peer.connectionState === 'connected') {
            stopOutgoingRingback();
            clearReconnectTimer();
            restartInProgressRef.current = false;
            setStatus('Terhubung');
            setConnectionHint('');
            restartAttempts = 0;
            startDurationCounter();
            startMediaWatchdog();
            if (!remoteStreamRef.current?.getTracks().some((track) => track.readyState === 'live')) {
              if (mediaConnectTimeoutRef.current) clearTimeout(mediaConnectTimeoutRef.current);
              mediaConnectTimeoutRef.current = setTimeout(requestIceRestart, MEDIA_CONNECT_TIMEOUT_MS);
            }
          } else if (peer.connectionState === 'failed') {
            setStatus('Koneksi media gagal, mencoba kembali...');
            restartInProgressRef.current = false;
            clearReconnectTimer();
            requestIceRestart();
          } else if (peer.connectionState === 'disconnected') {
            setStatus('Koneksi terputus, mencoba kembali...');
            requestIceRestart();
          } else if (peer.connectionState === 'connecting') {
            setStatus('Connecting...');
          }
        };

        // Retain candidates until the receiving call screen has answered.
        // Sending them while its incoming-call modal is open loses late TURN candidates.
        peer.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
          if (event.candidate) {
            localCandidates.push(event.candidate.toJSON());
            flushLocalCandidates();
          }
        };
        peer.onicecandidateerror = (event: any) => {
          if (!isCallActive || !/^turns?:/i.test(event.url || '')) return;
          setConnectionHint(`Relay TURN tidak terjangkau atau ditolak (kode ${event.errorCode || '?'}).`);
        };

        if (caller) {
          startOutgoingRingback();
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await waitForIceGatheringComplete(peer);

          if (socket) {
            socket.emit('call_user', {
              userToCall: partnerId,
              signalData: peer.localDescription,
              from: myId,
              name: localStorage.getItem('username'),
              room_id: sharedKey,
              isVideo: isVideoCall,
              call_id: callIdRef.current
            });
            callTimeoutRef.current = setTimeout(() => {
              setStatus('Tidak dijawab');
              endCall(true);
            }, CALL_TIMEOUT_MS);
          }
        } else {
          // Receiver logic
          if (incomingSignal) {
            const signal = JSON.parse(decodeURIComponent(incomingSignal as string));
            await peer.setRemoteDescription(new (window as any).RTCSessionDescription(signal));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await waitForIceGatheringComplete(peer);

            // Process pending candidates if any
            pendingCandidates.current.forEach(c => {
               peer.addIceCandidate(new (window as any).RTCIceCandidate(c)).catch((e:any) => console.error(e));
            });
            pendingCandidates.current = [];

            if (socket) {
              socket.emit('answer_call', {
                signal: peer.localDescription,
                to: partnerId,
                room_id: sharedKey,
                call_id: callIdRef.current
              });
              signalingReady = true;
              flushLocalCandidates();
            }
          } else {
            throw new Error('Sinyal panggilan masuk tidak tersedia. Minta penelepon mencoba lagi.');
          }
        }
      } catch (err) {
        console.error('Error starting call:', err);
        const error = err as Error;
        setStatus(error.name === 'NotAllowedError' ? 'Izinkan mikrofon/kamera pada browser' : error.name === 'NotFoundError' ? 'Mikrofon/kamera tidak ditemukan' : 'Panggilan gagal dimulai');
        setConnectionHint(error.name === 'NotReadableError' ? 'Mikrofon/kamera sedang dipakai aplikasi lain.' : error.message);
        stopOutgoingRingback();
        streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };

    // Socket listeners for signaling
    const handleCallAccepted = async (payload: any) => {
      if (payload?.call_id && String(payload.call_id) !== callIdRef.current) return;
      stopOutgoingRingback();
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
      const signal = payload?.signal || payload;
      setStatus('Connecting...');
      if (peerRef.current && caller) {
        try {
          await peerRef.current.setRemoteDescription(new (window as any).RTCSessionDescription(signal));
        } catch (error) {
          setStatus('Jawaban panggilan gagal diproses');
          setConnectionHint('Tutup panggilan lalu coba kembali.');
          return;
        }
        signalingReady = true;
        flushLocalCandidates();
        pendingCandidates.current.forEach(c => {
           peerRef.current.addIceCandidate(new (window as any).RTCIceCandidate(c)).catch((e:any) => console.error(e));
        });
        pendingCandidates.current = [];
      }
    };

    const handleRestartOffer = async (payload: any) => {
      if (payload?.call_id && String(payload.call_id) !== callIdRef.current) return;
      const peer = peerRef.current;
      if (!peer || caller || !payload?.signal) return;
      try {
        restartInProgressRef.current = true;
        setStatus('Memulihkan koneksi...');
        await peer.setRemoteDescription(new (window as any).RTCSessionDescription(payload.signal));
        const restartAnswer = await peer.createAnswer();
        await peer.setLocalDescription(restartAnswer);
        await waitForIceGatheringComplete(peer);
        activeSocket?.emit('answer_restart_call', {
          signal: peer.localDescription,
          to: partnerId,
          room_id: actualRoomIdRef.current,
          call_id: callIdRef.current,
        });
        restartInProgressRef.current = false;
      } catch (error) {
        console.error('Answer ICE restart failed:', error);
        restartInProgressRef.current = false;
      }
    };

    const handleRestartAnswer = async (payload: any) => {
      if (payload?.call_id && String(payload.call_id) !== callIdRef.current) return;
      const peer = peerRef.current;
      if (!peer || !caller || !payload?.signal) return;
      try {
        await peer.setRemoteDescription(new (window as any).RTCSessionDescription(payload.signal));
        clearReconnectTimer();
        restartInProgressRef.current = false;
      } catch (error) {
        console.error('Apply ICE restart answer failed:', error);
        restartInProgressRef.current = false;
      }
    };

    const handleIceCandidate = (payload: any) => {
      if (payload?.call_id && String(payload.call_id) !== callIdRef.current) return;
      const candidate = payload?.candidate || payload;
      if (peerRef.current && peerRef.current.remoteDescription) {
        peerRef.current.addIceCandidate(new (window as any).RTCIceCandidate(candidate)).catch((e:any) => console.error(e));
      } else {
        pendingCandidates.current.push(candidate);
      }
    };

    const handleCallEnded = (payload: any) => {
      if (payload?.call_id && String(payload.call_id) !== callIdRef.current) return;
      setStatus('Call Ended');
      endCall(false);
    };

    const attachSignalingListeners = async () => {
      const socket = await socketService.connect();
      activeSocket = socket;
      if (socket) {
        socket.on('call_accepted', handleCallAccepted);
        socket.on('call_restart_offer', handleRestartOffer);
        socket.on('call_restart_answer', handleRestartAnswer);
        socket.on('ice_candidate', handleIceCandidate);
        socket.on('call_ended', handleCallEnded);
      }
    };

    const start = async () => {
      await attachSignalingListeners();
      await initCall();
    };
    start();

    return () => {
      isCallActive = false;
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      endCall(false, true); // true = isUnmounting
      if (activeSocket) {
        activeSocket.off('call_accepted', handleCallAccepted);
        activeSocket.off('call_restart_offer', handleRestartOffer);
        activeSocket.off('call_restart_answer', handleRestartAnswer);
        activeSocket.off('ice_candidate', handleIceCandidate);
        activeSocket.off('call_ended', handleCallEnded);
      }
    };
  }, []);

  const endCall = (emitEvent = true, isUnmounting = false) => {
    stopOutgoingRingback();
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = null;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (mediaConnectTimeoutRef.current) clearTimeout(mediaConnectTimeoutRef.current);
    if (mediaWatchdogRef.current) clearInterval(mediaWatchdogRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    reconnectTimerRef.current = null;
    mediaConnectTimeoutRef.current = null;
    mediaWatchdogRef.current = null;
    durationIntervalRef.current = null;
    restartInProgressRef.current = false;
    lastInboundBytesRef.current = 0;
    stalledMediaChecksRef.current = 0;

    if (emitEvent && socketService.socket && actualRoomIdRef.current) {
      socketService.socket.emit('end_call', {
        to: partnerId,
        room_id: actualRoomIdRef.current,
        call_id: callIdRef.current
      });
      if (caller && !connectedAtRef.current && status !== 'Call Ended') {
        socketService.socket.emit('send_message', {
          room_id: actualRoomIdRef.current,
          receiver_id: partnerId,
          content: isVideoCall ? 'Panggilan Video Tak Terjawab' : 'Panggilan Suara Tak Terjawab',
          type: 'call'
        });
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: any) => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.close();
    }

    if (!isUnmounting && !hasNavigatedBack.current) {
      hasNavigatedBack.current = true;
      if (router.canGoBack()) router.back();
      else router.replace('/(main)/contacts');
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background for Video Call */}
      {Platform.OS === 'web' && isVideoCall && (
        <View style={styles.absoluteFill}>
          <video
            ref={userVideoRef as any}
            autoPlay
            playsInline
            muted
            style={styles.remoteVideo as any}
          />
        </View>
      )}

      {/* Background for Voice Call */}
      {!isVideoCall && (
        <View style={styles.voiceBackground}>
          {/* Avatar center */}
          <View style={styles.largeAvatarContainer}>
            <Ionicons name="person" size={80} color={coffee.text} />
          </View>
          {needsAudioTap && (
            <TouchableOpacity style={styles.enableAudioButton} onPress={playRemoteAudio}>
              <Ionicons name="volume-high" size={20} color={coffee.buttonText} />
              <Text style={styles.enableAudioText}>Nyalakan suara</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {Platform.OS === 'web' && (
        <audio ref={remoteAudioRef as any} autoPlay playsInline style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      )}

      {isVideoCall && needsAudioTap && (
        <TouchableOpacity style={[styles.enableAudioButton, styles.enableAudioOverlay]} onPress={playRemoteAudio}>
          <Ionicons name="volume-high" size={20} color={coffee.buttonText} />
          <Text style={styles.enableAudioText}>Nyalakan suara</Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => endCall(true)}>
          <Ionicons name="chevron-down" size={28} color={coffee.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.nameText}>{name || 'Contact'}</Text>
          <View style={styles.encryptionInfo}>
            <Ionicons name="lock-closed" size={12} color={coffee.secondary} />
            <Text style={styles.encryptionText}> Terenkripsi secara end-to-end</Text>
          </View>
          <Text style={styles.statusText}>{status}{connectedAtRef.current ? ` - ${formatCallDuration(elapsedSeconds)}` : ''}</Text>
          {!!connectionHint && <Text style={[styles.statusText, { textAlign: 'center', marginTop: 8 }]}>{connectionHint}</Text>}
        </View>

        <TouchableOpacity style={styles.headerIconBtn}>
          <Ionicons name="person-add" size={24} color={coffee.text} />
        </TouchableOpacity>
      </View>

      {/* Right Side Icons (Video Call only) */}
      {isVideoCall && (
        <View style={styles.rightSideIcons}>
          <TouchableOpacity style={styles.sideBtn}>
            <Ionicons name="camera-reverse" size={22} color={coffee.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideBtn}>
            <Ionicons name="color-wand" size={22} color={coffee.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Local Video PIP (Video Call only) */}
      {Platform.OS === 'web' && isVideoCall && !isCameraOff && (
        <View style={styles.localVideoWrapper}>
          <video
            ref={myVideoRef as any}
            autoPlay
            playsInline
            muted
            style={styles.localVideo as any}
          />
        </View>
      )}

      {/* Bottom Floating Pill Controls */}
      <View style={styles.bottomControlsContainer}>
        <View style={styles.controlsPill}>
          <TouchableOpacity style={styles.controlBtn}>
            <Ionicons name="ellipsis-horizontal" size={24} color={coffee.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={toggleVideo} disabled={!isVideoCall}>
            <Ionicons
              name={isCameraOff ? "videocam-off" : "videocam"}
              size={24}
              color={!isVideoCall ? coffee.muted : (isCameraOff ? coffee.text : coffee.text)}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={() => setIsSpeaker(!isSpeaker)}>
            <Ionicons name={isSpeaker ? "volume-high" : "volume-medium"} size={24} color={coffee.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={isMuted ? coffee.text : coffee.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.endCallBtn} onPress={() => endCall(true)}>
            <MaterialIcons name="call-end" size={28} color={coffee.text} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: coffee.background,
    position: 'relative',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: coffee.shadow,
  },
  voiceBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: coffee.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAvatarContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: coffee.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enableAudioButton: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: coffee.successButton,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  enableAudioText: {
    color: coffee.buttonText,
    fontWeight: '800',
  },
  enableAudioOverlay: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    zIndex: 30,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 24 : 10,
    zIndex: 10,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: coffee.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
    marginTop: 4,
  },
  nameText: {
    color: coffee.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  encryptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  encryptionText: {
    color: coffee.secondary,
    fontSize: 12,
  },
  statusText: {
    color: coffee.secondary,
    fontSize: 14,
  },
  rightSideIcons: {
    position: 'absolute',
    right: 16,
    top: 100,
    zIndex: 10,
    alignItems: 'center',
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: coffee.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  localVideoWrapper: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: coffee.surface,
    zIndex: 10,
    shadowColor: coffee.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  localVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  bottomControlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  controlsPill: {
    flexDirection: 'row',
    backgroundColor: coffee.surface,
    borderRadius: 40,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: coffee.raised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: coffee.dangerButton,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  }
});
