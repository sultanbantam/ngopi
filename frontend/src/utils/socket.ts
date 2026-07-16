import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import * as SecureStore from './storage';

const SOCKET_URL = 'https://api.bamboochat.click';
const API_URL = 'https://api.bamboochat.click/api';

const getStoredToken = async () => {
  if (Platform.OS === 'web') return localStorage.getItem('token') || '';
  return (await SecureStore.getItemAsync('token')) || '';
};

const setStoredToken = async (token: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem('token', token);
    return;
  }
  await SecureStore.setItemAsync('token', token);
};

class SocketService {
  public socket: Socket | null = null;
  private authRetryCount = 0;
  private refreshPromise: Promise<string | null> | null = null;

  private async refreshAccessToken() {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420'
      }
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        const token = typeof data?.token === 'string' ? data.token : null;
        if (token) await setStoredToken(token);
        return token;
      })
      .catch(() => null)
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

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

  public async connect(): Promise<Socket | null> {
    if (this.socket) {
      if (!this.socket.connected && this.socket.disconnected) {
        this.socket.connect();
      }
      return this.socket;
    }

    const token = (await this.refreshAccessToken()) || (await getStoredToken());

    if (!token) return null;

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
        console.error('WebSocket authentication failed:', error);
        return;
      }

      this.authRetryCount += 1;
      const nextToken = await this.refreshAccessToken();
      if (!nextToken || !this.socket) {
        console.error('WebSocket authentication failed:', error);
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
