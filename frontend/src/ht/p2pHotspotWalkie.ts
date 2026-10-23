/**
 * P2P Local Hotspot Walkie-Talkie (Offline Wi-Fi / LAN)
 * Memungkinkan komunikasi suara PTT & teks antar-perangkat secara langsung
 * melalui koneksi Hotspot HP / Wi-Fi lokal tanpa internet dan tanpa kuota.
 *
 * Menggunakan WebRTC Peer-to-Peer murni (Local Host ICE Candidates)
 * sehingga stream audio Opus langsung mengalir via Wi-Fi lokal (UDP).
 */

export interface P2PPeerInfo {
  id: string;
  callsign: string;
  ip?: string;
  isHost: boolean;
  connectedAt: number;
}

export type P2PVoiceListener = (audioBlob: Blob, senderCallsign: string) => void;
export type P2PMessageListener = (content: string, senderCallsign: string, isEmergency?: boolean) => void;
export type P2PPeersChangeListener = (peers: P2PPeerInfo[]) => void;

export class P2PHotspotWalkie {
  private static isInitialized = false;
  private static localCallsign = 'YD0NGO';
  private static peers: Map<string, RTCPeerConnection> = new Map();
  private static dataChannels: Map<string, RTCDataChannel> = new Map();
  private static connectedPeersList: P2PPeerInfo[] = [];

  private static voiceListeners: Set<P2PVoiceListener> = new Set();
  private static messageListeners: Set<P2PMessageListener> = new Set();
  private static peerChangeListeners: Set<P2PPeersChangeListener> = new Set();

  private static localStream: MediaStream | null = null;
  private static mediaRecorder: any = null;
  private static isHostMode = false;
  private static localHotspotIp = '192.168.43.1'; // Default Android tethering IP

  /**
   * Inisialisasi controller P2P Walkie-Talkie
   */
  public static init(callsign: string): void {
    this.localCallsign = callsign || 'YD0NGO';
    this.isInitialized = true;
  }

  public static setCallsign(callsign: string): void {
    this.localCallsign = callsign;
  }

  public static setHostMode(isHost: boolean, hotspotIp = '192.168.43.1'): void {
    this.isHostMode = isHost;
    this.localHotspotIp = hotspotIp;
  }

  public static getHostMode(): boolean {
    return this.isHostMode;
  }

  public static getHotspotIp(): string {
    return this.localHotspotIp;
  }

  public static getConnectedPeers(): P2PPeerInfo[] {
    return [...this.connectedPeersList];
  }

  public static onVoice(listener: P2PVoiceListener): () => void {
    this.voiceListeners.add(listener);
    return () => this.voiceListeners.delete(listener);
  }

  public static onMessage(listener: P2PMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public static onPeersChange(listener: P2PPeersChangeListener): () => void {
    this.peerChangeListeners.add(listener);
    return () => this.peerChangeListeners.delete(listener);
  }

  private static notifyPeersChanged(): void {
    this.peerChangeListeners.forEach((fn) => fn([...this.connectedPeersList]));
  }

  /**
   * Buat koneksi WebRTC baru untuk peer di LAN / Hotspot
   * Tanpa STUN/TURN server (iceServers: []) karena murni di jaringan lokal (host candidate).
   */
  public static createPeerConnection(peerId: string, peerCallsign: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [], // 100% Offline LAN: Hanya gunakan local host candidates
    });

    const dc = pc.createDataChannel('ht-control', { ordered: true });
    this.setupDataChannel(dc, peerId, peerCallsign);
    this.dataChannels.set(peerId, dc);

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peerId, peerCallsign);
      this.dataChannels.set(peerId, event.channel);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private static setupDataChannel(dc: RTCDataChannel, peerId: string, peerCallsign: string): void {
    dc.onopen = () => {
      const existing = this.connectedPeersList.find((p) => p.id === peerId);
      if (!existing) {
        this.connectedPeersList.push({
          id: peerId,
          callsign: peerCallsign,
          isHost: this.isHostMode,
          connectedAt: Date.now(),
        });
        this.notifyPeersChanged();
      }
    };

    dc.onclose = () => {
      this.removePeer(peerId);
    };

    dc.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const packet = JSON.parse(event.data);
          if (packet.type === 'voice_audio' && packet.base64) {
            // Audio broadcast diterima
            fetch(packet.base64)
              .then((res) => res.blob())
              .then((blob) => {
                this.voiceListeners.forEach((fn) => fn(blob, packet.callsign || peerCallsign));
              })
              .catch((err) => console.warn('[P2P] Gagal decode audio base64:', err));
          } else if (packet.type === 'text') {
            this.messageListeners.forEach((fn) =>
              fn(packet.content, packet.callsign || peerCallsign, packet.isEmergency)
            );
          }
        }
      } catch (e) {
        console.warn('[P2P] Gagal memproses paket:', e);
      }
    };
  }

  /**
   * Hapus peer yang terputus
   */
  public static removePeer(peerId: string): void {
    const pc = this.peers.get(peerId);
    if (pc) {
      try { pc.close(); } catch (_) {}
      this.peers.delete(peerId);
    }
    this.dataChannels.delete(peerId);
    this.connectedPeersList = this.connectedPeersList.filter((p) => p.id !== peerId);
    this.notifyPeersChanged();
  }

  /**
   * Broadcast pesan teks / sinyal SOS ke seluruh perangkat di Hotspot lokal
   */
  public static broadcastText(content: string, isEmergency = false): void {
    const packet = JSON.stringify({
      type: 'text',
      callsign: this.localCallsign,
      content,
      isEmergency,
      timestamp: Date.now(),
    });

    this.dataChannels.forEach((dc) => {
      if (dc.readyState === 'open') {
        try {
          dc.send(packet);
        } catch (e) {
          console.warn('[P2P] Gagal kirim teks ke peer:', e);
        }
      }
    });
  }

  /**
   * Broadcast audio suara PTT ke seluruh perangkat di Hotspot lokal
   */
  public static broadcastVoice(base64Audio: string): void {
    const packet = JSON.stringify({
      type: 'voice_audio',
      callsign: this.localCallsign,
      base64: base64Audio,
      timestamp: Date.now(),
    });

    this.dataChannels.forEach((dc) => {
      if (dc.readyState === 'open') {
        try {
          dc.send(packet);
        } catch (e) {
          console.warn('[P2P] Gagal kirim suara ke peer:', e);
        }
      }
    });
  }

  /**
   * Buat Session Description Offer (untuk dibagikan via QR Code / Teks Kunci Cepat)
   */
  public static async createOffer(): Promise<string> {
    const tempPc = new RTCPeerConnection({ iceServers: [] });
    const dc = tempPc.createDataChannel('ht-control');
    const offer = await tempPc.createOffer();
    await tempPc.setLocalDescription(offer);

    // Tunggu ICE gathering selesai untuk mendapatkan host IP
    await new Promise<void>((resolve) => {
      if (tempPc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (tempPc.iceGatheringState === 'complete') {
            tempPc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        tempPc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 1500); // Batas waktu 1.5 detik
      }
    });

    const sdpData = JSON.stringify({
      callsign: this.localCallsign,
      sdp: tempPc.localDescription,
      isHost: this.isHostMode,
      hotspotIp: this.localHotspotIp,
    });

    tempPc.close();
    // Kompresi sederhana menjadi Base64 URL-safe
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(sdpData)));
    }
    return encodeURIComponent(sdpData);
  }

  /**
   * Simulasi Penemuan Peer Lokal di Subnet Hotspot
   * Menambahkan peer virtual / perangkat lokal di jaringan hotspot
   */
  public static registerLocalHotspotPeer(callsign: string, ip: string): void {
    const peerId = 'p2p_' + callsign.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = this.connectedPeersList.find((p) => p.id === peerId);
    if (!existing) {
      this.connectedPeersList.push({
        id: peerId,
        callsign,
        ip,
        isHost: false,
        connectedAt: Date.now(),
      });
      this.notifyPeersChanged();
    }
  }

  /**
   * Bersihkan seluruh koneksi P2P saat modal ditutup
   */
  public static disconnectAll(): void {
    this.peers.forEach((pc) => {
      try { pc.close(); } catch (_) {}
    });
    this.peers.clear();
    this.dataChannels.clear();
    this.connectedPeersList = [];
    this.notifyPeersChanged();
  }
}
