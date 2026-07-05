import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { socketService } from '../../../src/utils/socket';
import * as SecureStore from '../../../src/utils/storage';

export default function CallScreen() {
  const { id: partnerId, name, isVideo, isCaller = 'true', incomingSignal } = useLocalSearchParams();
  const router = useRouter();
  
  const isVideoCall = isVideo === 'true';
  const caller = isCaller === 'true';

  const [status, setStatus] = useState(caller ? 'Calling...' : 'Connecting...');
  
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

    const initCall = async () => {
      let myId = localStorage.getItem('userId') || '';
      if (!myId) myId = (await SecureStore.getItemAsync('userId')) || '';
      
      const sharedKey = [myId, partnerId].sort().join('-');
      actualRoomIdRef.current = sharedKey;

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
          if (event.candidate && socketService.socket) {
            socketService.socket.emit('ice_candidate', {
              candidate: event.candidate,
              to: partnerId,
              room_id: sharedKey
            });
          }
        };

        if (caller) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);

          if (socketService.socket) {
            socketService.socket.emit('call_user', {
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

            if (socketService.socket) {
              socketService.socket.emit('answer_call', {
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

    initCall();

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

    if (socketService.socket) {
      socketService.socket.on('call_accepted', handleCallAccepted);
      socketService.socket.on('ice_candidate', handleIceCandidate);
      socketService.socket.on('call_ended', handleCallEnded);
    }

    return () => {
      isCallActive = false;
      endCall(false, true); // true = isUnmounting
      if (socketService.socket) {
        socketService.socket.off('call_accepted', handleCallAccepted);
        socketService.socket.off('ice_candidate', handleIceCandidate);
        socketService.socket.off('call_ended', handleCallEnded);
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.nameText}>{name || 'Contact'}</Text>
      </View>

      <View style={styles.videoContainer}>
        {/* Remote Stream Element (Always render for Audio/Video) */}
        {Platform.OS === 'web' && (
          <video
            ref={userVideoRef as any}
            autoPlay
            playsInline
            style={isVideoCall ? (styles.remoteVideo as any) : { display: 'none' }}
          />
        )}
        
        {(!Platform.OS || !isVideoCall) && (
          <View style={styles.placeholderAvatar}>
            <Text style={styles.avatarText}>{(name as string)?.charAt(0) || 'U'}</Text>
          </View>
        )}

        {/* Local Stream Element (Always render to capture audio/video locally) */}
        {Platform.OS === 'web' && (
          <View style={isVideoCall ? styles.localVideoWrapper : { display: 'none' }}>
            <video
              ref={myVideoRef as any}
              autoPlay
              playsInline
              muted
              style={styles.localVideo as any}
            />
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.endCallButton} onPress={() => endCall(true)}>
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 40,
    alignItems: 'center',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 8,
  },
  nameText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  localVideoWrapper: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#1E293B',
  },
  localVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 60,
    color: '#fff',
    fontWeight: 'bold',
  },
  controls: {
    padding: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  endCallText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
