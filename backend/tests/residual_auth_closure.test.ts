import assert from 'assert';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import WebSocket from 'ws';
import { prisma } from '../src/utils/prisma';
import { AlbumService } from '../src/services/album.service';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

function makeToken(
  id: string,
  username: string,
  role = 'user',
  expiresIn: jwt.SignOptions['expiresIn'] = '10m',
  tokenType = 'access'
) {
  return jwt.sign({ id, username, role, token_type: tokenType }, JWT_SECRET, { expiresIn });
}

async function runTests() {
  const mockUsers = new Map<string, { id: string; username: string; display_name: string; role: string }>([
    ['album-user-1', { id: 'album-user-1', username: 'albumuser', display_name: 'Album User', role: 'user' }],
  ]);

  const origUser = (prisma as any).user;
  const origCreateAlbum = AlbumService.createAlbum;
  const origRecordPlay = AlbumService.recordAlbumPlay;
  const origGetAlbums = AlbumService.getAlbums;

  let lastCreatedAlbumUserId: string | null = null;
  let lastRecordedListenerId: string | undefined;

  (prisma as any).user = {
    ...origUser,
    findUnique: async (args: any) => {
      const id = args?.where?.id;
      return id ? mockUsers.get(id) || null : null;
    },
    findMany: async () => [],
    update: async () => null,
  };

  AlbumService.createAlbum = ((params: any) => {
    lastCreatedAlbumUserId = params.userId;
    return { success: true, album: { id: 'alb_test_1', userId: params.userId, title: params.title } };
  }) as any;

  AlbumService.recordAlbumPlay = ((_albumId: string, listener?: { userId: string; username?: string }) => {
    lastRecordedListenerId = listener?.userId;
    return 42;
  }) as any;

  AlbumService.getAlbums = (() => []) as any;

  const { default: albumRoutes } = await import('../src/routes/album.routes');
  const { setupSocket } = await import('../src/sockets/index');

  const app = express();
  app.use(express.json());
  app.use('/api/albums', albumRoutes);

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  setupSocket(io);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const validToken = makeToken('album-user-1', 'albumuser', 'user', '10m', 'access');
    const expiredToken = makeToken('album-user-1', 'albumuser', 'user', '-10s', 'access');
    const refreshToken = makeToken('album-user-1', 'albumuser', 'user', '10m', 'refresh');
    const missingDbUserToken = makeToken('non-existent-user', 'ghost', 'user', '10m', 'access');

    // 1. Public GET /api/albums remains accessible
    const listRes = await fetch(`${baseUrl}/api/albums`);
    assert.strictEqual(listRes.status, 200);

    // 2. Unauthenticated & body-spoofed POST /api/albums rejected (401)
    const unauthCreate = await fetch(`${baseUrl}/api/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'victim-id', username: 'victim', title: 'Spoofed Album' }),
    });
    assert.strictEqual(unauthCreate.status, 401, 'Spoofed body without JWT must return 401');

    const expiredCreate = await fetch(`${baseUrl}/api/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${expiredToken}` },
      body: JSON.stringify({ title: 'Expired Album' }),
    });
    assert.strictEqual(expiredCreate.status, 401, 'Expired JWT on POST /api/albums must return 401');

    const ghostCreate = await fetch(`${baseUrl}/api/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${missingDbUserToken}` },
      body: JSON.stringify({ title: 'Ghost Album' }),
    });
    assert.strictEqual(ghostCreate.status, 401, 'Missing DB user on POST /api/albums must return 401');
    console.log('✅ [PASS] 1. Unauthenticated, spoofed-body, expired-JWT & missing-DB-user POST /api/albums rejected (401)');

    // 3. Authenticated DB user POST /api/albums ignores spoofed body userId
    const validCreate = await fetch(`${baseUrl}/api/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({ userId: 'victim-id', username: 'victim', title: 'Ngopi Lo-Fi Vol 1' }),
    });
    assert.strictEqual(validCreate.status, 201);
    assert.strictEqual(lastCreatedAlbumUserId, 'album-user-1', 'Album creator must come from verified JWT/DB, not body');
    console.log('✅ [PASS] 2. Authenticated POST /api/albums uses verified DB user and ignores body userId');

    // 4. POST /api/albums/:id/play requires JWT and ignores body listenerId
    const unauthPlay = await fetch(`${baseUrl}/api/albums/alb_1/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listenerId: 'victim-id' }),
    });
    assert.strictEqual(unauthPlay.status, 401);

    const validPlay = await fetch(`${baseUrl}/api/albums/alb_1/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({ listenerId: 'victim-id', listenerUsername: 'victim' }),
    });
    assert.strictEqual(validPlay.status, 200);
    assert.strictEqual(lastRecordedListenerId, 'album-user-1', 'Listener identity must come from verified JWT/DB');
    console.log('✅ [PASS] 3. POST /api/albums/:id/play requires JWT and ignores spoofed listenerId');

    // 5. Socket.IO auth via Engine.IO v4 / WebSocket handshake: missing, expired, refresh-type, and invalid tokens are rejected
    const wsBase = baseUrl.replace('http://', 'ws://');
    const connectSocket = (token?: string) =>
      new Promise<{ connected: boolean; error?: string }>((resolve) => {
        const ws = new WebSocket(`${wsBase}/socket.io/?EIO=4&transport=websocket`);
        const timer = setTimeout(() => {
          ws.close();
          resolve({ connected: false, error: 'timeout' });
        }, 3000);

        ws.on('message', (raw) => {
          const msg = raw.toString();
          if (msg.startsWith('0')) {
            // Engine.IO open -> send Socket.IO CONNECT (40) with auth payload
            const payload = token ? JSON.stringify({ token }) : '';
            ws.send(`40${payload}`);
          } else if (msg.startsWith('40')) {
            clearTimeout(timer);
            ws.close();
            resolve({ connected: true });
          } else if (msg.startsWith('44')) {
            clearTimeout(timer);
            ws.close();
            try {
              const parsed = JSON.parse(msg.slice(2));
              resolve({ connected: false, error: parsed?.message || msg });
            } catch {
              resolve({ connected: false, error: msg });
            }
          }
        });

        ws.on('error', (err) => {
          clearTimeout(timer);
          resolve({ connected: false, error: err.message });
        });
      });

    const noTok = await connectSocket(undefined);
    assert.strictEqual(noTok.connected, false);
    assert.ok(noTok.error?.includes('No token'), `Expected No token error, got ${noTok.error}`);

    const expTok = await connectSocket(expiredToken);
    assert.strictEqual(expTok.connected, false, 'Expired access token must be rejected by Socket.IO');
    assert.ok(expTok.error?.includes('expired'), `Expected expired error, got ${expTok.error}`);

    const refTok = await connectSocket(refreshToken);
    assert.strictEqual(refTok.connected, false, 'Refresh token must be rejected by Socket.IO');
    assert.ok(refTok.error?.includes('Invalid token type'), `Expected invalid token type, got ${refTok.error}`);

    const badTok = await connectSocket('invalid.jwt.token');
    assert.strictEqual(badTok.connected, false);

    // 6. Valid fresh access token (reconnect after refresh) succeeds
    const okTok = await connectSocket(validToken);
    assert.strictEqual(okTok.connected, true, `Fresh valid access token must connect, got error: ${okTok.error}`);
    console.log('✅ [PASS] 4. Socket.IO rejects missing/expired/refresh/invalid tokens and accepts fresh access tokens');

    console.log('\n🎉 ALL RESIDUAL AUTH CLOSURE TESTS (ALBUM + SOCKET.IO) PASSED!');
  } finally {
    io.close();
    server.close();
    (prisma as any).user = origUser;
    AlbumService.createAlbum = origCreateAlbum;
    AlbumService.recordAlbumPlay = origRecordPlay;
    AlbumService.getAlbums = origGetAlbums;
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Residual auth closure test failed:', err);
    process.exit(1);
  });
