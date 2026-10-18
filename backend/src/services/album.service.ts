import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PointsManager } from '../utils/pointsManager';
import { pointsEconomyService } from './points.service';

export interface CompilationTrack {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  uri: string;
  duration: number; // in seconds
  thumbnail?: string | null;
  is_full: boolean;
}

export interface CompilationAlbum {
  id: string;
  user_id: string;
  creator_username: string;
  creator_display_name: string;
  title: string;
  description: string;
  cover_emoji: string;
  capacity: number; // 10, 20, 30, ...
  points_cost: number; // 1000, 2000, 3000, ...
  tracks: CompilationTrack[];
  created_at: string;
  play_count: number;
  share_url: string;
}

const ALBUMS_FILE = path.join(__dirname, '../../uploads/warkop_compilation_albums.json');

// Pre-seeded curated full songs library available for instant compilation
export const CURATED_FULL_TRACKS: CompilationTrack[] = [
  {
    id: 'trk_dealova',
    title: 'Dealova',
    artist: 'Once Mekel',
    genre: 'Pop Rock Ballad',
    uri: 'https://archive.org/download/OnceDealova_201905/Once%20-%20Dealova.mp3',
    duration: 269,
    thumbnail: 'https://archive.org/services/img/OnceDealova_201905',
    is_full: true,
  },
  {
    id: 'trk_kopi_dangdut',
    title: 'Kopi Dangdut',
    artist: 'Fahmi Shahab',
    genre: 'Dangdut Klasik',
    uri: 'https://archive.org/download/KopiDangdut/KopiDangdutFahmiSahab.mp3',
    duration: 238,
    thumbnail: 'https://archive.org/services/img/KopiDangdut',
    is_full: true,
  },
  {
    id: 'trk_begadang',
    title: 'Begadang',
    artist: 'Rhoma Irama',
    genre: 'Dangdut Warkop',
    uri: 'https://archive.org/download/rhoma-irama-begadang/Rhoma%20Irama%20-%20Begadang.mp3',
    duration: 215,
    thumbnail: 'https://archive.org/services/img/rhoma-irama-begadang',
    is_full: true,
  },
  {
    id: 'trk_mangu',
    title: 'Mangu (feat. Charita Utami)',
    artist: 'Fourtwnty',
    genre: 'Indie Folk Santai',
    uri: 'https://archive.org/download/fourtwnty-mangu/Fourtwnty%20-%20Mangu.mp3',
    duration: 245,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_menghitung_hari',
    title: 'Menghitung Hari',
    artist: 'Krisdayanti',
    genre: 'Pop Romantis',
    uri: 'https://archive.org/download/krisdayanti-menghitung-hari/Krisdayanti%20-%20Menghitung%20Hari.mp3',
    duration: 230,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dan',
    title: 'Dan...',
    artist: 'Sheila on 7',
    genre: 'Pop Rock 90s',
    uri: 'https://archive.org/download/sheila-on-7-dan/Sheila%20on%207%20-%20Dan.mp3',
    duration: 285,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kangen',
    title: 'Kangen',
    artist: 'Dewa 19',
    genre: 'Slow Rock Legendaris',
    uri: 'https://archive.org/download/dewa-19-kangen/Dewa%2019%20-%20Kangen.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_berita_kepada_kawan',
    title: 'Berita Kepada Kawan',
    artist: 'Ebiet G. Ade',
    genre: 'Balada Akustik',
    uri: 'https://archive.org/download/ebiet-g-ade-berita-kepada-kawan/Ebiet%20G.%20Ade%20-%20Berita%20Kepada%20Kawan.mp3',
    duration: 340,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kemesraan',
    title: 'Kemesraan',
    artist: 'Iwan Fals & All Stars',
    genre: 'Akustik Warkop',
    uri: 'https://archive.org/download/iwan-fals-kemesraan/Iwan%20Fals%20-%20Kemesraan.mp3',
    duration: 325,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_surat_cinta_starla',
    title: 'Surat Cinta untuk Starla',
    artist: 'Virgoun',
    genre: 'Pop Akustik',
    uri: 'https://archive.org/download/virgoun-surat-cinta-untuk-starla/Virgoun%20-%20Surat%20Cinta%20Untuk%20Starla.mp3',
    duration: 275,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_akad',
    title: 'Akad',
    artist: 'Payung Teduh',
    genre: 'Folk Jazz Santai',
    uri: 'https://archive.org/download/payung-teduh-akad/Payung%20Teduh%20-%20Akad.mp3',
    duration: 258,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_monokrom',
    title: 'Monokrom',
    artist: 'Tulus',
    genre: 'Soul Pop Santai',
    uri: 'https://archive.org/download/tulus-monokrom/Tulus%20-%20Monokrom.mp3',
    duration: 214,
    thumbnail: null,
    is_full: true,
  },
];

export class AlbumService {
  private static loadAlbums(): CompilationAlbum[] {
    try {
      if (fs.existsSync(ALBUMS_FILE)) {
        const raw = fs.readFileSync(ALBUMS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load compilation albums:', e);
    }
    return [];
  }

  private static saveAlbums(albums: CompilationAlbum[]): void {
    try {
      const dir = path.dirname(ALBUMS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save compilation albums:', e);
    }
  }

  /**
   * Calculate required points for a compilation album:
   * 1.000 points per 10 songs (multiples: 2.000 for 20 songs, 3.000 for 30 songs, etc.)
   */
  public static calculateCost(capacity: number): number {
    const slots = Math.max(1, Math.ceil(capacity / 10));
    return slots * 1000;
  }

  /**
   * Search for full-length tracks across curated library and Archive.org
   */
  public static async searchFullTracks(query: string): Promise<CompilationTrack[]> {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return CURATED_FULL_TRACKS;
    }

    // 1. Search in curated warkop library first
    const localMatches = CURATED_FULL_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.genre && t.genre.toLowerCase().includes(q))
    );

    // 2. Search Archive.org for full-length MP3 files
    let remoteMatches: CompilationTrack[] = [];
    try {
      const cleanTerm = q.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
      const words = cleanTerm.split(/\s+/).filter(Boolean);
      const searchQuery =
        words.length > 0
          ? '(' + words.map((w) => 'title:' + w).join(' AND ') + ') AND mediatype:audio'
          : cleanTerm + ' AND mediatype:audio';

      const archiveUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        searchQuery
      )}&fl[]=identifier,title,creator,description&rows=8&output=json`;

      const arcRes = await axios.get(archiveUrl, { timeout: 5000 });
      const docs = arcRes.data?.response?.docs || [];

      await Promise.all(
        docs.slice(0, 5).map(async (doc: any) => {
          try {
            const filesUrl = `https://archive.org/metadata/${doc.identifier}/files`;
            const fRes = await axios.get(filesUrl, { timeout: 4000 });
            const files = fRes.data?.result || [];
            const mp3 = files.find(
              (f: any) =>
                f.name &&
                f.name.toLowerCase().endsWith('.mp3') &&
                !f.name.includes('_vbr') &&
                !f.name.includes('thumb')
            );
            if (mp3 && mp3.length && Number(mp3.length) >= 60 && Number(mp3.length) <= 900) {
              const rawTitle = doc.title || mp3.title || mp3.name.replace(/\.mp3$/i, '');
              remoteMatches.push({
                id: `arc_${doc.identifier}_${crypto.randomBytes(3).toString('hex')}`,
                title: rawTitle,
                artist: doc.creator || 'Lagu Pilihan Warkop',
                genre: 'Lagu Utuh ☕',
                uri: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(mp3.name)}`,
                duration: Math.round(Number(mp3.length)),
                thumbnail: `https://archive.org/services/img/${doc.identifier}`,
                is_full: true,
              });
            }
          } catch {}
        })
      );
    } catch (e: any) {
      console.warn('Archive.org compilation search error:', e?.message);
    }

    // Merge without duplicates by title
    const seenTitles = new Set<string>();
    const combined: CompilationTrack[] = [];

    for (const item of [...localMatches, ...remoteMatches]) {
      const key = `${item.title}:::${item.artist}`.toLowerCase();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        combined.push(item);
      }
    }

    return combined;
  }

  /**
   * Create compilation album: checks balance, deducts points, and saves album
   */
  public static createAlbum(params: {
    userId: string;
    username: string;
    displayName: string;
    title: string;
    description?: string;
    coverEmoji?: string;
    capacity?: number;
    tracks: CompilationTrack[];
  }): { success: boolean; error?: string; album?: CompilationAlbum; remainingPoints?: number } {
    const { userId, username, displayName, title, tracks } = params;

    if (!title || !title.trim()) {
      return { success: false, error: 'Judul album kompilasi wajib diisi.' };
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return { success: false, error: 'Pilih minimal 1 lagu utuh untuk album kompilasi Anda.' };
    }

    // Capacity must be in multiples of 10: 10, 20, 30, ...
    const rawCapacity = params.capacity || Math.max(10, Math.ceil(tracks.length / 10) * 10);
    const capacity = Math.max(10, Math.ceil(rawCapacity / 10) * 10);

    if (tracks.length > capacity) {
      return {
        success: false,
        error: `Jumlah lagu (${tracks.length}) melebihi kapasitas album yang dipilih (${capacity} lagu).`,
      };
    }

    const pointsCost = this.calculateCost(capacity);

    // Check user points balance
    const currentPoints = Math.max(
      PointsManager.getPoints(username),
      PointsManager.getPoints(userId),
      pointsEconomyService ? pointsEconomyService.getUserPoints(userId)?.balance || 0 : 0
    );

    if (currentPoints < pointsCost) {
      return {
        success: false,
        error: `Poin tidak mencukupi. Anda memiliki ${currentPoints.toLocaleString()} Poin, dibutuhkan ${pointsCost.toLocaleString()} Poin untuk ${capacity} lagu.`,
      };
    }

    // Deduct points from user
    const newBalance = Math.max(0, currentPoints - pointsCost);
    PointsManager.setPoints(username, newBalance);
    PointsManager.setPoints(userId, newBalance);

    if (pointsEconomyService) {
      pointsEconomyService.addDirectPoints(
        userId,
        -pointsCost,
        'item_purchase',
        `Pembuatan Album Kompilasi Warkop: "${title.trim()}" (${capacity} Lagu)`,
        `album_create_${Date.now()}`
      );
    }

    const albumId = 'alb_' + crypto.randomBytes(6).toString('hex');
    const shareUrl = `https://ngopi.top/warkop?album=${albumId}`;

    const newAlbum: CompilationAlbum = {
      id: albumId,
      user_id: userId,
      creator_username: username,
      creator_display_name: displayName || username,
      title: title.trim(),
      description: params.description?.trim() || 'Kompilasi lagu pilihan warga warung kopi.',
      cover_emoji: params.coverEmoji || '💿',
      capacity,
      points_cost: pointsCost,
      tracks: tracks.map((t, idx) => ({
        ...t,
        id: t.id || `trk_${albumId}_${idx + 1}`,
        is_full: true,
      })),
      created_at: new Date().toISOString(),
      play_count: 0,
      share_url: shareUrl,
    };

    const albums = this.loadAlbums();
    albums.unshift(newAlbum);
    this.saveAlbums(albums);

    return {
      success: true,
      album: newAlbum,
      remainingPoints: newBalance,
    };
  }

  public static getAlbums(userId?: string): CompilationAlbum[] {
    const albums = this.loadAlbums();
    if (userId) {
      return albums.filter((a) => a.user_id === userId);
    }
    return albums;
  }

  public static getAlbumById(albumId: string): CompilationAlbum | null {
    const albums = this.loadAlbums();
    return albums.find((a) => a.id === albumId) || null;
  }

  public static recordAlbumPlay(albumId: string): number {
    const albums = this.loadAlbums();
    const album = albums.find((a) => a.id === albumId);
    if (album) {
      album.play_count = (album.play_count || 0) + 1;
      this.saveAlbums(albums);
      return album.play_count;
    }
    return 0;
  }
}
