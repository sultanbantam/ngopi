import { describe, it, expect, beforeEach } from 'vitest';
import { AlbumService, CURATED_FULL_TRACKS } from '../src/services/album.service';
import { PointsManager } from '../src/utils/pointsManager';

describe('Sistem Album Kompilasi Warkop & Pengurangan Poin', () => {
  const testUserId = 'user_test_mixtape_1';
  const testUsername = 'juragan_warkop';

  beforeEach(() => {
    // Reset test user points
    PointsManager.setPoints(testUserId, 2500);
    PointsManager.setPoints(testUsername, 2500);
  });

  it('harus menghitung biaya poin sesuai kelipatan 1.000 per 10 lagu utuh', () => {
    expect(AlbumService.calculateCost(10)).toBe(1000);
    expect(AlbumService.calculateCost(20)).toBe(2000);
    expect(AlbumService.calculateCost(30)).toBe(3000);
    expect(AlbumService.calculateCost(15)).toBe(2000); // 15 lagu masuk tier slot 20 lagu
  });

  it('harus dapat mencari dan menyediakan daftar lagu pilihan utuh (full tracks)', async () => {
    const tracks = await AlbumService.searchFullTracks('');
    expect(Array.isArray(tracks)).toBe(true);
    expect(tracks.length).toBeGreaterThanOrEqual(10);
    expect(tracks[0].is_full).toBe(true);
    expect(tracks[0].uri).toBeDefined();

    // Search keyword
    const dealovaMatches = await AlbumService.searchFullTracks('Dealova');
    expect(dealovaMatches.some((t) => t.title.toLowerCase().includes('dealova'))).toBe(true);
  });

  it('harus menolak pembuatan album jika poin user tidak mencukupi', () => {
    PointsManager.setPoints(testUserId, 500);
    PointsManager.setPoints(testUsername, 500);

    const tracks = CURATED_FULL_TRACKS.slice(0, 10);
    const result = AlbumService.createAlbum({
      userId: testUserId,
      username: testUsername,
      displayName: 'Juragan Warkop',
      title: 'Album Gagal Poin',
      capacity: 10,
      tracks,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Poin tidak mencukupi');
    expect(PointsManager.getPoints(testUserId)).toBe(500); // Poin tidak berkurang
  });

  it('harus sukses membuat album kompilasi 10 lagu dan memotong 1.000 poin secara permanen', () => {
    const initialPoints = PointsManager.getPoints(testUserId);
    expect(initialPoints).toBe(2500);

    const tracks = CURATED_FULL_TRACKS.slice(0, 10);
    const result = AlbumService.createAlbum({
      userId: testUserId,
      username: testUsername,
      displayName: 'Juragan Warkop',
      title: 'Kompilasi Santai Sore Warkop',
      description: 'Lagu akustik dan dangdut santai pengantar kopi tubruk.',
      coverEmoji: '☕',
      capacity: 10,
      tracks,
    });

    expect(result.success).toBe(true);
    expect(result.album).toBeDefined();
    expect(result.album?.title).toBe('Kompilasi Santai Sore Warkop');
    expect(result.album?.points_cost).toBe(1000);
    expect(result.album?.capacity).toBe(10);
    expect(result.album?.tracks.length).toBe(10);
    expect(result.album?.share_url).toContain('https://ngopi.top/warkop?album=');

    // Cek sisa poin berkurang tepat 1.000 poin (2500 - 1000 = 1500)
    const currentPoints = PointsManager.getPoints(testUserId);
    expect(currentPoints).toBe(1500);
    expect(result.remainingPoints).toBe(1500);

    // Verifikasi album tersimpan dan dapat diambil kembali
    const albumId = result.album!.id;
    const fetched = AlbumService.getAlbumById(albumId);
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(albumId);

    // Verifikasi penambahan play count
    const playCount = AlbumService.recordAlbumPlay(albumId);
    expect(playCount).toBe(1);
  });

  it('harus memotong 2.000 poin untuk album ganda 20 lagu pilihan', () => {
    PointsManager.setPoints(testUserId, 3000);
    PointsManager.setPoints(testUsername, 3000);

    // Duplikasi tracks sampai 20 lagu
    const tracks20 = [...CURATED_FULL_TRACKS, ...CURATED_FULL_TRACKS].slice(0, 20);
    const result = AlbumService.createAlbum({
      userId: testUserId,
      username: testUsername,
      displayName: 'Juragan Warkop',
      title: 'Mega Album 20 Lagu',
      capacity: 20,
      tracks: tracks20,
    });

    expect(result.success).toBe(true);
    expect(result.album?.points_cost).toBe(2000);
    expect(result.remainingPoints).toBe(1000); // 3000 - 2000 = 1000
    expect(PointsManager.getPoints(testUserId)).toBe(1000);
  });
});
