import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { clearStoredSession, getLastRefreshFailureReason, getValidAccessToken, refreshAccessToken } from './session';

const SOCKET_URL = 'https://api.ngopi.top';

class SocketService {
  public socket: Socket | null = null;
  private authRetryCount = 0;

  private isAuthError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '');
    return /auth|token/i.test(message);
  }

  private createSocket(token: string) {
    return io(SOCKET_URL, {
      auth: { token },
      query: { token },
      extraHeaders: {
        'ngrok-skip-browser-warning': '69420'
      },
      transports: ['websocket'],
      withCredentials: true
    });
  }

  private async handleExpiredSession(error: unknown) {
    console.error('WebSocket authentication failed:', error);
    if (getLastRefreshFailureReason() !== 'unauthorized') {
      // Gangguan jaringan/server membuat user tetap berada di aplikasi sebagai offline.
      this.disconnect();
      return;
    }

    await clearStoredSession();
    this.disconnect();

    if (Platform.OS === 'web') {
      window.location.href = '/login?error=session_expired';
    }
  }

  public async connect(): Promise<Socket | null> {
    if (this.socket) {
      if (!this.socket.connected && this.socket.disconnected) {
        this.socket.connect();
      }
      return this.socket;
    }

    const token = await getValidAccessToken();
    if (!token) {
      await this.handleExpiredSession('No valid token available');
      return null;
    }

    this.socket = this.createSocket(token);

    this.socket.on('connect', () => {
      this.authRetryCount = 0;
      console.log('Connected to WebSocket server:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
    });

    this.socket.on('connect_error', async (error) => {
      if (!this.isAuthError(error)) {
        console.error('WebSocket connection error:', error);
        return;
      }

      if (this.authRetryCount >= 1) {
        await this.handleExpiredSession(error);
        return;
      }

      this.authRetryCount += 1;
      const nextToken = await refreshAccessToken(true);
      if (!nextToken || !this.socket) {
        await this.handleExpiredSession(error);
        return;
      }

      this.socket.auth = { token: nextToken };
      this.socket.io.opts.query = { token: nextToken };
      this.socket.connect();
    });

    return this.socket;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.authRetryCount = 0;
    }
  }
}

export const socketService = new SocketService();
