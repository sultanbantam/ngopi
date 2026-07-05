import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import * as SecureStore from './storage';

const SOCKET_URL = 'http://localhost:3000';

class SocketService {
  public socket: Socket | null = null;

  public async connect() {
    if (this.socket?.connected) return;

    let token = null;
    if (Platform.OS === 'web') {
      token = localStorage.getItem('token');
    } else {
      token = await SecureStore.getItemAsync('token');
    }

    if (!token) return;

    this.socket = io(SOCKET_URL, {
      query: { token },
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
