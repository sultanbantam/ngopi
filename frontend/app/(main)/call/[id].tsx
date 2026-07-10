import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { socketService } from '../../../src/utils/socket';
import * as SecureStore from '../../../src/utils/storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export default function CallScreen() {
  const { id: partnerId, name, isVideo, isCaller = 'true', incomingSignal } = useLocalSearchParams();
  const router = useRouter();
  
  const isVideoCall = isVideo === 'true';
  const caller = isCaller === 'true';

  const [status, setStatus] = useState(caller ? 'Calling...' : 'Connecting...');
  
  // Call controls state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(!isVideoCall);
  const [isSpeaker, setIsSpeaker] = useState(false);
  
  // Refs for video elements (Web only)
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  
  const peerRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const actualRoomIdRef = useRef<string>('');
  const pendingCandidates = useRef<any[]>([]);
  const hasNavigatedBack = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      alert('Fitur Panggilan (WebRTC) saat ini baru dioptimalkan untuk versi Web (Browser).');
      if (router.canGoBack()) router.back();
      else router.replace('/(main)/contacts');
      return;
    }

    let isCallActive = true;
    let activeSocket: any = null;

    const initCall = async () => {
      let myId = localStorage.getItem('userId') || '';
      if (!myId) myId = (await SecureStore.getItemAsync('userId')) || '';
      
      const sharedKey = [myId, partnerId].sort().join('-');
      actualRoomIdRef.current = sharedKey;
      const socket = await socketService.connect();

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
        const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };
        const peer = new (window as any).RTCPeerConnection(configuration);
        peerRef.current = peer;

        // Add local stream to peer
        stream.getTracks().forEach((track: any) => {
          peer.addTrack(track, stream);
        });

        // Handle incoming stream
        peer.ontrack = (event: any) => {
          setStatus('Connected');
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE candidates
        peer.onicecandidate = (event: any) => {
          if (event.candidate && socket) {
            socket.emit('ice_candidate', {
              candidate: event.candidate,
              to: partnerId,
              room_id: sharedKey
            });
          }
        };

        if (caller) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);

          if (socket) {
            socket.emit('call_user', {
              userToCall: partnerId,
              signalData: offer,
              from: myId,
              name: localStorage.getItem('username'),
              room_id: sharedKey,
              isVideo: isVideoCall
            });
          }
        } else {
          // Receiver logic
          if (incomingSignal) {
            const signal = JSON.parse(decodeURIComponent(incomingSignal as string));
            await peer.setRemoteDescription(new (window as any).RTCSessionDescription(signal));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            
            // Process pending candidates if any
            pendingCandidates.current.forEach(c => {
               peer.addIceCandidate(new (window as any).RTCIceCandidate(c)).catch((e:any) => console.error(e));
            });
            pendingCandidates.current = [];

            if (socket) {
              socket.emit('answer_call', {
                signal: answer,
                to: partnerId,
                room_id: sharedKey
              });
            }
          }
        }
      } catch (err) {
        console.error('Error starting call:', err);
        setStatus('Failed to access camera/mic');
      }
    };

    // Socket listeners for signaling
    const handleCallAccepted = async (signal: any) => {
      setStatus('Connected');
      if (peerRef.current && caller) {
        await peerRef.current.setRemoteDescription(new (window as any).RTCSessionDescription(signal));
        pendingCandidates.current.forEach(c => {
           peerRef.current.addIceCandidate(new (window as any).RTCIceCandidate(c)).catch((e:any) => console.error(e));
        });
        pendingCandidates.current = [];
      }
    };

    const handleIceCandidate = (candidate: any) => {
      if (peerRef.current && peerRef.current.remoteDescription) {
        peerRef.current.addIceCandidate(new (window as any).RTCIceCandidate(candidate)).catch((e:any) => console.error(e));
      } else {
        pendingCandidates.current.push(candidate);
      }
    };

    const handleCallEnded = () => {
      setStatus('Call Ended');
      endCall(false);
    };

    const attachSignalingListeners = async () => {
      const socket = await socketService.connect();
      activeSocket = socket;
      if (socket) {
        socket.on('call_accepted', handleCallAccepted);
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
      endCall(false, true); // true = isUnmounting
      if (activeSocket) {
        activeSocket.off('call_accepted', handleCallAccepted);
        activeSocket.off('ice_candidate', handleIceCandidate);
        activeSocket.off('call_ended', handleCallEnded);
      }
    };
  }, []);

  const endCall = (emitEvent = true, isUnmounting = false) => {
    if (emitEvent && socketService.socket && actualRoomIdRef.current) {
      socketService.socket.emit('end_call', {
        to: partnerId,
        room_id: actualRoomIdRef.current
      });
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
            style={styles.remoteVideo as any}
          />
        </View>
      )}

      {/* Background for Voice Call */}
      {!isVideoCall && (
        <View style={styles.voiceBackground}>
          {/* Avatar center */}
          <View style={styles.largeAvatarContainer}>
            <Ionicons name="person" size={80} color="#fff" />
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => endCall(true)}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.nameText}>{name || 'Contact'}</Text>
          <View style={styles.encryptionInfo}>
            <Ionicons name="lock-closed" size={12} color="#A0AAB3" />
            <Text style={styles.encryptionText}> Terenkripsi secara end-to-end</Text>
          </View>
          <Text style={styles.statusText}>{status}</Text>
        </View>
        
        <TouchableOpacity style={styles.headerIconBtn}>
          <Ionicons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Right Side Icons (Video Call only) */}
      {isVideoCall && (
        <View style={styles.rightSideIcons}>
          <TouchableOpacity style={styles.sideBtn}>
            <Ionicons name="camera-reverse" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideBtn}>
            <Ionicons name="color-wand" size={22} color="#fff" />
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
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlBtn} onPress={toggleVideo} disabled={!isVideoCall}>
            <Ionicons 
              name={isCameraOff ? "videocam-off" : "videocam"} 
              size={24} 
              color={!isVideoCall ? "#555" : (isCameraOff ? "#fff" : "#fff")} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlBtn} onPress={() => setIsSpeaker(!isSpeaker)}>
            <Ionicons name={isSpeaker ? "volume-high" : "volume-medium"} size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={isMuted ? "#fff" : "#fff"} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.endCallBtn} onPress={() => endCall(true)}>
            <MaterialIcons name="call-end" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  voiceBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111B21',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAvatarContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#6b7280',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
    marginTop: 4,
  },
  nameText: {
    color: '#fff',
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
    color: '#A0AAB3',
    fontSize: 12,
  },
  statusText: {
    color: '#A0AAB3',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    backgroundColor: '#1E293B',
    zIndex: 10,
    shadowColor: '#000',
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
    backgroundColor: '#1E2329',
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
    backgroundColor: '#2A3138',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  }
});
