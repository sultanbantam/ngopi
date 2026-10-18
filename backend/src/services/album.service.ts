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
  era?: '80s' | '90s' | '2000s' | 'west' | 'warkop';
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

// Master Catalog: Koleksi Lengkap Lagu Utuh Era 80an, 90an, 2000an (Luar Negeri & Dalam Negeri)
export const CURATED_FULL_TRACKS: CompilationTrack[] = [
  // =========================================================================
  // 1. ROCK & METAL KLASIK BARAT (ERA 80-an & 90-an)
  // =========================================================================
  {
    id: 'trk_dt_spirit',
    title: 'The Spirit Carries On',
    artist: 'Dream Theater',
    genre: 'Progressive Metal Ballad',
    era: 'west',
    uri: 'https://archive.org/download/dream-theater-the-spirit-carries-on/Dream%20Theater%20-%20The%20Spirit%20Carries%20On.mp3',
    duration: 398,
    thumbnail: 'https://archive.org/services/img/dream-theater',
    is_full: true,
  },
  {
    id: 'trk_dt_pull_me',
    title: 'Pull Me Under',
    artist: 'Dream Theater',
    genre: 'Progressive Metal',
    era: 'west',
    uri: 'https://archive.org/download/08-breaking-all-illusions/Dream%20Theater%20-%20A%20Dramatic%20Turn%20Of%20Events%20%282011%29%20%5BFLAC%5D/08%20-%20Breaking%20All%20Illusions.mp3',
    duration: 494,
    thumbnail: 'https://archive.org/services/img/dream-theater',
    is_full: true,
  },
  {
    id: 'trk_dt_another_day',
    title: 'Another Day',
    artist: 'Dream Theater',
    genre: 'Progressive Rock Ballad',
    era: 'west',
    uri: 'https://archive.org/download/dream-theater-another-day/Dream%20Theater%20-%20Another%20Day.mp3',
    duration: 263,
    thumbnail: 'https://archive.org/services/img/dream-theater',
    is_full: true,
  },
  {
    id: 'trk_queen_bohemian',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    genre: 'Classic Rock',
    era: 'west',
    uri: 'https://archive.org/download/queen_bohemian-rhapsody_202605/queen_bohemian-rhapsody.mp3',
    duration: 354,
    thumbnail: 'https://archive.org/services/img/queen_bohemian-rhapsody_202605',
    is_full: true,
  },
  {
    id: 'trk_queen_love_of_my_life',
    title: 'Love of My Life',
    artist: 'Queen',
    genre: 'Classic Rock Ballad',
    era: 'west',
    uri: 'https://archive.org/download/queen-love-of-my-life/Queen%20-%20Love%20of%20My%20Life.mp3',
    duration: 218,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_queen_dont_stop',
    title: "Don't Stop Me Now",
    artist: 'Queen',
    genre: 'Glam Rock',
    era: 'west',
    uri: 'https://archive.org/download/queen-dont-stop-me-now/Queen%20-%20Don%27t%20Stop%20Me%20Now.mp3',
    duration: 209,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_gnr_sweet_child',
    title: "Sweet Child O' Mine",
    artist: "Guns N' Roses",
    genre: 'Hard Rock',
    era: 'west',
    uri: 'https://archive.org/download/guns-n-roses-sweet-child-o-mine/Guns%20N%27%20Roses%20-%20Sweet%20Child%20O%27%20Mine.mp3',
    duration: 356,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_gnr_november_rain',
    title: 'November Rain',
    artist: "Guns N' Roses",
    genre: 'Hard Rock Ballad',
    era: 'west',
    uri: 'https://archive.org/download/guns-n-roses-november-rain/Guns%20N%27%20Roses%20-%20November%20Rain.mp3',
    duration: 537,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_gnr_dont_cry',
    title: "Don't Cry",
    artist: "Guns N' Roses",
    genre: 'Hard Rock Ballad',
    era: 'west',
    uri: 'https://archive.org/download/guns-n-roses-dont-cry/Guns%20N%27%20Roses%20-%20Don%27t%20Cry.mp3',
    duration: 284,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_met_nothing_else',
    title: 'Nothing Else Matters',
    artist: 'Metallica',
    genre: 'Heavy Metal Ballad',
    era: 'west',
    uri: 'https://archive.org/download/metallica-nothing-else-matters/Metallica%20-%20Nothing%20Else%20Matters.mp3',
    duration: 388,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_met_enter_sandman',
    title: 'Enter Sandman',
    artist: 'Metallica',
    genre: 'Heavy Metal',
    era: 'west',
    uri: 'https://archive.org/download/metallica-enter-sandman/Metallica%20-%20Enter%20Sandman.mp3',
    duration: 331,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_met_the_unforgiven',
    title: 'The Unforgiven',
    artist: 'Metallica',
    genre: 'Heavy Metal',
    era: 'west',
    uri: 'https://archive.org/download/metallica-the-unforgiven/Metallica%20-%20The%20Unforgiven.mp3',
    duration: 387,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_bonjovi_always',
    title: 'Always',
    artist: 'Bon Jovi',
    genre: 'Rock Ballad',
    era: 'west',
    uri: 'https://archive.org/download/bon-jovi-always/Bon%20Jovi%20-%20Always.mp3',
    duration: 353,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_bonjovi_livin',
    title: "Livin' on a Prayer",
    artist: 'Bon Jovi',
    genre: 'Arena Rock',
    era: 'west',
    uri: 'https://archive.org/download/bon-jovi-livin-on-a-prayer/Bon%20Jovi%20-%20Livin%20on%20a%20Prayer.mp3',
    duration: 250,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_bonjovi_bed_of_roses',
    title: 'Bed of Roses',
    artist: 'Bon Jovi',
    genre: 'Rock Ballad',
    era: 'west',
    uri: 'https://archive.org/download/bon-jovi-bed-of-roses/Bon%20Jovi%20-%20Bed%20of%20Roses.mp3',
    duration: 394,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_scorpions_wind',
    title: 'Wind of Change',
    artist: 'Scorpions',
    genre: 'Hard Rock',
    era: 'west',
    uri: 'https://archive.org/download/scorpions-wind-of-change/Scorpions%20-%20Wind%20of%20Change.mp3',
    duration: 312,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_scorpions_still_loving',
    title: 'Still Loving You',
    artist: 'Scorpions',
    genre: 'Slow Rock',
    era: 'west',
    uri: 'https://archive.org/download/scorpions-still-loving-you/Scorpions%20-%20Still%20Loving%20You.mp3',
    duration: 388,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_scorpions_always_somewhere',
    title: 'Always Somewhere',
    artist: 'Scorpions',
    genre: 'Slow Rock Ballad',
    era: 'west',
    uri: 'https://archive.org/download/scorpions-always-somewhere/Scorpions%20-%20Always%20Somewhere.mp3',
    duration: 295,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nirvana_smells',
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    genre: 'Grunge Rock',
    era: 'west',
    uri: 'https://archive.org/download/nirvana-smells-like-teen-spirit/Nirvana%20-%20Smells%20Like%20Teen%20Spirit.mp3',
    duration: 301,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nirvana_come_as_you_are',
    title: 'Come As You Are',
    artist: 'Nirvana',
    genre: 'Grunge Rock',
    era: 'west',
    uri: 'https://archive.org/download/nirvana-come-as-you-are/Nirvana%20-%20Come%20As%20You%20Are.mp3',
    duration: 219,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_oasis_wonderwall',
    title: 'Wonderwall',
    artist: 'Oasis',
    genre: 'Britpop',
    era: 'west',
    uri: 'https://archive.org/download/oasis-wonderwall/Oasis%20-%20Wonderwall.mp3',
    duration: 258,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_oasis_dont_look_back',
    title: "Don't Look Back in Anger",
    artist: 'Oasis',
    genre: 'Britpop',
    era: 'west',
    uri: 'https://archive.org/download/oasis-dont-look-back-in-anger/Oasis%20-%20Don%27t%20Look%20Back%20in%20Anger.mp3',
    duration: 288,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_oasis_stand_by_me',
    title: 'Stand By Me',
    artist: 'Oasis',
    genre: 'Britpop',
    era: 'west',
    uri: 'https://archive.org/download/oasis-stand-by-me/Oasis%20-%20Stand%20By%20Me.mp3',
    duration: 356,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_radiohead_creep',
    title: 'Creep',
    artist: 'Radiohead',
    genre: 'Alternative Rock',
    era: 'west',
    uri: 'https://archive.org/download/radiohead-creep/Radiohead%20-%20Creep.mp3',
    duration: 238,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_cranberries_zombie',
    title: 'Zombie',
    artist: 'The Cranberries',
    genre: 'Alternative Rock',
    era: 'west',
    uri: 'https://archive.org/download/the-cranberries-zombie/The%20Cranberries%20-%20Zombie.mp3',
    duration: 306,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_cranberries_ode',
    title: 'Ode to My Family',
    artist: 'The Cranberries',
    genre: 'Alternative Pop Rock',
    era: 'west',
    uri: 'https://archive.org/download/the-cranberries-ode-to-my-family/The%20Cranberries%20-%20Ode%20To%20My%20Family.mp3',
    duration: 271,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_eagles_hotel_california',
    title: 'Hotel California',
    artist: 'Eagles',
    genre: 'Classic Rock',
    era: 'west',
    uri: 'https://archive.org/download/eagles-hotel-california/Eagles%20-%20Hotel%20California.mp3',
    duration: 390,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_deep_purple_soldier',
    title: 'Soldier of Fortune',
    artist: 'Deep Purple',
    genre: 'Hard Rock Ballad',
    era: 'west',
    uri: 'https://archive.org/download/deep-purple-soldier-of-fortune/Deep%20Purple%20-%20Soldier%20of%20Fortune.mp3',
    duration: 194,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_white_lion_when_children_cry',
    title: 'When the Children Cry',
    artist: 'White Lion',
    genre: 'Glam Metal Ballad',
    era: 'west',
    uri: 'https://archive.org/download/white-lion-when-the-children-cry/White%20Lion%20-%20When%20the%20Children%20Cry.mp3',
    duration: 258,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_firehouse_when_i_look',
    title: 'When I Look Into Your Eyes',
    artist: 'Firehouse',
    genre: 'Glam Metal Ballad',
    era: 'west',
    uri: 'https://archive.org/download/firehouse-when-i-look-into-your-eyes/FireHouse%20-%20When%20I%20Look%20Into%20Your%20Eyes.mp3',
    duration: 242,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_steelheart_shes_gone',
    title: "She's Gone",
    artist: 'Steelheart',
    genre: 'Heavy Metal Ballad',
    era: 'west',
    uri: 'https://archive.org/download/steelheart-shes-gone/Steelheart%20-%20She%27s%20Gone.mp3',
    duration: 395,
    thumbnail: null,
    is_full: true,
  },
  // U2
  {
    id: 'trk_u2_with_or_without',
    title: 'With or Without You',
    artist: 'U2',
    genre: 'Rock Anthemic 80s',
    era: 'west',
    uri: 'https://archive.org/download/u2-with-or-without-you/U2%20-%20With%20or%20Without%20You.mp3',
    duration: 296,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_u2_one',
    title: 'One',
    artist: 'U2',
    genre: 'Rock Ballad 90s',
    era: 'west',
    uri: 'https://archive.org/download/u2-one/U2%20-%20One.mp3',
    duration: 276,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_u2_still_havent_found',
    title: "I Still Haven't Found What I'm Looking For",
    artist: 'U2',
    genre: 'Classic Rock 80s',
    era: 'west',
    uri: 'https://archive.org/download/u2-i-still-havent-found-what-im-looking-for/U2%20-%20I%20Still%20Haven%27t%20Found%20What%20I%27m%20Looking%20For.mp3',
    duration: 277,
    thumbnail: null,
    is_full: true,
  },
  // Manowar
  {
    id: 'trk_manowar_warriors',
    title: 'Warriors of the World United',
    artist: 'Manowar',
    genre: 'Heavy Metal Anthemic',
    era: 'west',
    uri: 'https://archive.org/download/manowar-warriors-of-the-world-united/Manowar%20-%20Warriors%20of%20the%20World%20United.mp3',
    duration: 351,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_manowar_heart_of_steel',
    title: 'Heart of Steel',
    artist: 'Manowar',
    genre: 'Heavy Metal Ballad',
    era: 'west',
    uri: 'https://archive.org/download/manowar-heart-of-steel/Manowar%20-%20Heart%20of%20Steel.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_manowar_battle_hymn',
    title: 'Battle Hymn',
    artist: 'Manowar',
    genre: 'Epic Heavy Metal',
    era: 'west',
    uri: 'https://archive.org/download/manowar-battle-hymn/Manowar%20-%20Battle%20Hymn.mp3',
    duration: 418,
    thumbnail: null,
    is_full: true,
  },
  // Pearl Jam
  {
    id: 'trk_pearljam_black',
    title: 'Black',
    artist: 'Pearl Jam',
    genre: 'Grunge Rock 90s',
    era: 'west',
    uri: 'https://archive.org/download/pearl-jam-black/Pearl%20Jam%20-%20Black.mp3',
    duration: 343,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_pearljam_alive',
    title: 'Alive',
    artist: 'Pearl Jam',
    genre: 'Grunge Rock',
    era: 'west',
    uri: 'https://archive.org/download/pearl-jam-alive/Pearl%20Jam%20-%20Alive.mp3',
    duration: 341,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_pearljam_jeremy',
    title: 'Jeremy',
    artist: 'Pearl Jam',
    genre: 'Grunge Rock 90s',
    era: 'west',
    uri: 'https://archive.org/download/pearl-jam-jeremy/Pearl%20Jam%20-%20Jeremy.mp3',
    duration: 318,
    thumbnail: null,
    is_full: true,
  },
  // Red Hot Chili Peppers (RHCP)
  {
    id: 'trk_rhcp_under_the_bridge',
    title: 'Under the Bridge',
    artist: 'Red Hot Chili Peppers',
    genre: 'Alternative Funk Rock',
    era: 'west',
    uri: 'https://archive.org/download/red-hot-chili-peppers-under-the-bridge/Red%20Hot%20Chili%20Peppers%20-%20Under%20the%20Bridge.mp3',
    duration: 264,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_rhcp_californication',
    title: 'Californication',
    artist: 'Red Hot Chili Peppers',
    genre: 'Alternative Rock',
    era: 'west',
    uri: 'https://archive.org/download/red-hot-chili-peppers-californication/Red%20Hot%20Chili%20Peppers%20-%20Californication.mp3',
    duration: 321,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_rhcp_otherside',
    title: 'Otherside',
    artist: 'Red Hot Chili Peppers',
    genre: 'Alternative Rock',
    era: 'west',
    uri: 'https://archive.org/download/red-hot-chili-peppers-otherside/Red%20Hot%20Chili%20Peppers%20-%20Otherside.mp3',
    duration: 255,
    thumbnail: null,
    is_full: true,
  },
  // Nirvana (Tambahan)
  {
    id: 'trk_nirvana_lithium',
    title: 'Lithium',
    artist: 'Nirvana',
    genre: 'Grunge Rock 90s',
    era: 'west',
    uri: 'https://archive.org/download/nirvana-lithium/Nirvana%20-%20Lithium.mp3',
    duration: 257,
    thumbnail: null,
    is_full: true,
  },
  // Heavy Metal Legends
  {
    id: 'trk_ironmaiden_trooper',
    title: 'The Trooper',
    artist: 'Iron Maiden',
    genre: 'Heavy Metal 80s',
    era: 'west',
    uri: 'https://archive.org/download/iron-maiden-the-trooper/Iron%20Maiden%20-%20The%20Trooper.mp3',
    duration: 252,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_judaspriest_breaking_law',
    title: 'Breaking the Law',
    artist: 'Judas Priest',
    genre: 'Heavy Metal 80s',
    era: 'west',
    uri: 'https://archive.org/download/judas-priest-breaking-the-law/Judas%20Priest%20-%20Breaking%20the%20Law.mp3',
    duration: 155,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_blacksabbath_paranoid',
    title: 'Paranoid',
    artist: 'Black Sabbath',
    genre: 'Heavy Metal Klasik',
    era: 'west',
    uri: 'https://archive.org/download/black-sabbath-paranoid/Black%20Sabbath%20-%20Paranoid.mp3',
    duration: 170,
    thumbnail: null,
    is_full: true,
  },

  // =========================================================================
  // 2. TEMBANG KENANGAN & LEGENDA INDONESIA (ERA 80-an)
  // =========================================================================
  {
    id: 'trk_chrisye_pergilah_kasih',
    title: 'Pergilah Kasih',
    artist: 'Chrisye',
    genre: 'Pop Klasik 80an',
    era: '80s',
    uri: 'https://archive.org/download/chrisye-pergilah-kasih/Chrisye%20-%20Pergilah%20Kasih.mp3',
    duration: 284,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_chrisye_kala_cinta',
    title: 'Kala Cinta Menggoda',
    artist: 'Chrisye',
    genre: 'Pop Nostalgia',
    era: '80s',
    uri: 'https://archive.org/download/chrisye-kala-cinta-menggoda/Chrisye%20-%20Kala%20Cinta%20Menggoda.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_chrisye_aku_cinta_dia',
    title: 'Aku Cinta Dia',
    artist: 'Chrisye',
    genre: 'Pop Disco 80an',
    era: '80s',
    uri: 'https://archive.org/download/chrisye-aku-cinta-dia/Chrisye%20-%20Aku%20Cinta%20Dia.mp3',
    duration: 235,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_chrisye_lilin_lilin',
    title: 'Lilin-Lilin Kecil',
    artist: 'Chrisye',
    genre: 'Balada Nostalgia',
    era: '80s',
    uri: 'https://archive.org/download/chrisye-lilin-lilin-kecil/Chrisye%20-%20Lilin-Lilin%20Kecil.mp3',
    duration: 300,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_iwan_bento',
    title: 'Bento',
    artist: 'Iwan Fals & SWAMI',
    genre: 'Rock Balada Warkop',
    era: '80s',
    uri: 'https://archive.org/download/iwan-fals-bento/Iwan%20Fals%20-%20Bento.mp3',
    duration: 350,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_iwan_bongkar',
    title: 'Bongkar',
    artist: 'Iwan Fals & SWAMI',
    genre: 'Rock Balada Kritis',
    era: '80s',
    uri: 'https://archive.org/download/iwan-fals-bongkar/Iwan%20Fals%20-%20Bongkar.mp3',
    duration: 270,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_iwan_surat_wakil',
    title: 'Surat Buat Wakil Rakyat',
    artist: 'Iwan Fals',
    genre: 'Balada Akustik',
    era: '80s',
    uri: 'https://archive.org/download/iwan-fals-surat-buat-wakil-rakyat/Iwan%20Fals%20-%20Surat%20Buat%20Wakil%20Rakyat.mp3',
    duration: 260,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_iwan_ibu',
    title: 'Ibu',
    artist: 'Iwan Fals',
    genre: 'Balada Menyentuh Hati',
    era: '80s',
    uri: 'https://archive.org/download/iwan-fals-ibu/Iwan%20Fals%20-%20Ibu.mp3',
    duration: 250,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_ebiet_berita_kawan',
    title: 'Berita Kepada Kawan',
    artist: 'Ebiet G. Ade',
    genre: 'Balada Akustik Legendaris',
    era: '80s',
    uri: 'https://archive.org/download/ebiet-g-ade-berita-kepada-kawan/Ebiet%20G.%20Ade%20-%20Berita%20Kepada%20Kawan.mp3',
    duration: 340,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_ebiet_camelia',
    title: 'Camelia I',
    artist: 'Ebiet G. Ade',
    genre: 'Balada Puitis',
    era: '80s',
    uri: 'https://archive.org/download/ebiet-g-ade-camelia-1/Ebiet%20G.%20Ade%20-%20Camelia%201.mp3',
    duration: 275,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_ebiet_untuk_renungkan',
    title: 'Untuk Kita Renungkan',
    artist: 'Ebiet G. Ade',
    genre: 'Balada Renungan',
    era: '80s',
    uri: 'https://archive.org/download/ebiet-g-ade-untuk-kita-renungkan/Ebiet%20G.%20Ade%20-%20Untuk%20Kita%20Renungkan.mp3',
    duration: 285,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_godbless_rumah_kita',
    title: 'Rumah Kita',
    artist: 'God Bless',
    genre: 'Rock Legendaris 80an',
    era: '80s',
    uri: 'https://archive.org/download/god-bless-rumah-kita/God%20Bless%20-%20Rumah%20Kita.mp3',
    duration: 288,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_godbless_panggung_sandiwara',
    title: 'Panggung Sandiwara',
    artist: 'God Bless',
    genre: 'Rock Klasik Indonesia',
    era: '80s',
    uri: 'https://archive.org/download/god-bless-panggung-sandiwara/God%20Bless%20-%20Panggung%20Sandiwara.mp3',
    duration: 265,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_godbless_semut_hitam',
    title: 'Semut Hitam',
    artist: 'God Bless',
    genre: 'Hard Rock 80an',
    era: '80s',
    uri: 'https://archive.org/download/god-bless-semut-hitam/God%20Bless%20-%20Semut%20Hitam.mp3',
    duration: 350,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_koesplus_kolam_susu',
    title: 'Kolam Susu',
    artist: 'Koes Plus',
    genre: 'Nostalgia Nusantara',
    era: '80s',
    uri: 'https://archive.org/download/koes-plus-kolam-susu/Koes%20Plus%20-%20Kolam%20Susu.mp3',
    duration: 172,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_koesplus_andaikan',
    title: 'Andaikan Kau Datang',
    artist: 'Koes Plus',
    genre: 'Pop Melankolis Abadi',
    era: '80s',
    uri: 'https://archive.org/download/koes-plus-andaikan-kau-datang/Koes%20Plus%20-%20Andaikan%20Kau%20Datang.mp3',
    duration: 210,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_farizrm_sakura',
    title: 'Sakura',
    artist: 'Fariz RM',
    genre: 'City Pop Indonesia 80an',
    era: '80s',
    uri: 'https://archive.org/download/fariz-rm-sakura/Fariz%20RM%20-%20Sakura.mp3',
    duration: 360,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_farizrm_barcelona',
    title: 'Barcelona',
    artist: 'Fariz RM',
    genre: 'City Pop 80an',
    era: '80s',
    uri: 'https://archive.org/download/fariz-rm-barcelona/Fariz%20RM%20-%20Barcelona.mp3',
    duration: 410,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_panbers_gereja_tua',
    title: 'Gereja Tua',
    artist: 'Panbers',
    genre: 'Tembang Kenangan 80an',
    era: '80s',
    uri: 'https://archive.org/download/panbers-gereja-tua/Panbers%20-%20Gereja%20Tua.mp3',
    duration: 215,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_broery_widuri',
    title: 'Widuri',
    artist: 'Broery Pesolima',
    genre: 'Pop Romantis Klasik',
    era: '80s',
    uri: 'https://archive.org/download/broery-pesolima-widuri/Broery%20Pesolima%20-%20Widuri.mp3',
    duration: 240,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dian_tak_ingin_sendiri',
    title: 'Tak Ingin Sendiri',
    artist: 'Dian Piesesha',
    genre: 'Tembang Kenangan Sendu',
    era: '80s',
    uri: 'https://archive.org/download/dian-piesesha-tak-ingin-sendiri/Dian%20Piesesha%20-%20Tak%20Ingin%20Sendiri.mp3',
    duration: 260,
    thumbnail: null,
    is_full: true,
  },
  // Kantata Takwa
  {
    id: 'trk_kantata_kesaksian',
    title: 'Kesaksian',
    artist: 'Kantata Takwa',
    genre: 'Art Rock / Balada Kebangsaan',
    era: '80s',
    uri: 'https://archive.org/download/kantata-takwa-kesaksian/Kantata%20Takwa%20-%20Kesaksian.mp3',
    duration: 365,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kantata_kantata_takwa',
    title: 'Kantata Takwa',
    artist: 'Kantata Takwa',
    genre: 'Art Rock Progresif',
    era: '80s',
    uri: 'https://archive.org/download/kantata-takwa-kantata-takwa/Kantata%20Takwa%20-%20Kantata%20Takwa.mp3',
    duration: 345,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kantata_paman_doblang',
    title: 'Paman Doblang',
    artist: 'Kantata Takwa',
    genre: 'Art Rock Puitis Rendra',
    era: '80s',
    uri: 'https://archive.org/download/kantata-takwa-paman-doblang/Kantata%20Takwa%20-%20Paman%20Doblang.mp3',
    duration: 375,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kantata_rajawali',
    title: 'Rajawali',
    artist: 'Kantata Takwa',
    genre: 'Rock Balada Menggugah',
    era: '80s',
    uri: 'https://archive.org/download/kantata-takwa-rajawali/Kantata%20Takwa%20-%20Rajawali.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },
  // Kantata Samsara
  {
    id: 'trk_kantata_nyanyian_jiwa',
    title: 'Nyanyian Jiwa',
    artist: 'Kantata Samsara',
    genre: 'Art Rock Spiritual',
    era: '80s',
    uri: 'https://archive.org/download/kantata-samsara-nyanyian-jiwa/Kantata%20Samsara%20-%20Nyanyian%20Jiwa.mp3',
    duration: 380,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kantata_asmara',
    title: 'Asmara',
    artist: 'Kantata Samsara',
    genre: 'Rock Balada Puitis',
    era: '80s',
    uri: 'https://archive.org/download/kantata-samsara-asmara/Kantata%20Samsara%20-%20Asmara.mp3',
    duration: 330,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kantata_noktah',
    title: 'Noktah',
    artist: 'Kantata Samsara',
    genre: 'Art Rock Renungan',
    era: '80s',
    uri: 'https://archive.org/download/kantata-samsara-noktah/Kantata%20Samsara%20-%20Noktah.mp3',
    duration: 290,
    thumbnail: null,
    is_full: true,
  },
  // Nicky Astria (Lady Rocker Indonesia)
  {
    id: 'trk_nicky_jarum_neraka',
    title: 'Jarum Neraka',
    artist: 'Nicky Astria',
    genre: 'Slow Rock Indonesia 80an',
    era: '80s',
    uri: 'https://archive.org/download/nicky-astria-jarum-neraka/Nicky%20Astria%20-%20Jarum%20Neraka.mp3',
    duration: 275,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nicky_mengapa',
    title: 'Mengapa',
    artist: 'Nicky Astria',
    genre: 'Slow Rock Legendaris',
    era: '80s',
    uri: 'https://archive.org/download/nicky-astria-mengapa/Nicky%20Astria%20-%20Mengapa.mp3',
    duration: 285,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nicky_samar_bayangan',
    title: 'Samar Bayangan',
    artist: 'Nicky Astria',
    genre: 'Slow Rock Melow',
    era: '80s',
    uri: 'https://archive.org/download/nicky-astria-samar-bayangan/Nicky%20Astria%20-%20Samar%20Bayangan.mp3',
    duration: 268,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nicky_bias_sinar',
    title: 'Bias Sinar',
    artist: 'Nicky Astria',
    genre: 'Slow Rock Romantis',
    era: '80s',
    uri: 'https://archive.org/download/nicky-astria-bias-sinar/Nicky%20Astria%20-%20Bias%20Sinar.mp3',
    duration: 260,
    thumbnail: null,
    is_full: true,
  },
  // Nike Ardilla (Tambahan Hits Terbesar)
  {
    id: 'trk_nike_seberkas_sinar',
    title: 'Seberkas Sinar',
    artist: 'Nike Ardilla',
    genre: 'Slow Rock Abadi',
    era: '80s',
    uri: 'https://archive.org/download/nike-ardilla-seberkas-sinar/Nike%20Ardilla%20-%20Seberkas%20Sinar.mp3',
    duration: 290,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nike_duri_terlindung',
    title: 'Duri Terlindung',
    artist: 'Nike Ardilla',
    genre: 'Slow Rock Sendu',
    era: '80s',
    uri: 'https://archive.org/download/nike-ardilla-duri-terlindung/Nike%20Ardilla%20-%20Duri%20Terlindung.mp3',
    duration: 245,
    thumbnail: null,
    is_full: true,
  },
  // Roxx
  {
    id: 'trk_roxx_rock_bergema',
    title: 'Rock Bergema (50 G dropped)',
    artist: 'Roxx',
    genre: 'Trash Metal Klasik Indonesia',
    era: '80s',
    uri: 'https://archive.org/download/roxx-rock-bergema/Roxx%20-%20Rock%20Bergema.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },

  // =========================================================================
  // 3. ERA KEEMASAN BAND & SLOW ROCK INDONESIA (ERA 90-an)
  // =========================================================================
  {
    id: 'trk_so7_dan',
    title: 'Dan...',
    artist: 'Sheila on 7',
    genre: 'Pop Rock 90s',
    era: '90s',
    uri: 'https://archive.org/download/sheila-on-7-dan/Sheila%20on%207%20-%20Dan.mp3',
    duration: 285,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_so7_sephia',
    title: 'Sephia',
    artist: 'Sheila on 7',
    genre: 'Pop Rock 90s',
    era: '90s',
    uri: 'https://archive.org/download/sheila-on-7-lapang-dada-official-music-video_202409/Sheila%20On%207%20Lapang%20Dada%20%28%20Official%20Music%20Video%29.mp3',
    duration: 298,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_so7_kita',
    title: 'Kita',
    artist: 'Sheila on 7',
    genre: 'Pop Rock Klasik 90s',
    era: '90s',
    uri: 'https://archive.org/download/sheila-on-7-kita/Sheila%20on%207%20-%20Kita.mp3',
    duration: 275,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_so7_anugerah_terindah',
    title: 'Anugerah Terindah yang Pernah Kumiliki',
    artist: 'Sheila on 7',
    genre: 'Pop Akustik Romantis',
    era: '90s',
    uri: 'https://archive.org/download/sheila-on-7-anugerah-terindah/Sheila%20on%207%20-%20Anugerah%20Terindah.mp3',
    duration: 220,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_so7_melompat_tinggi',
    title: 'Melompat Lebih Tinggi',
    artist: 'Sheila on 7',
    genre: 'Pop Rock Semangat',
    era: '90s',
    uri: 'https://archive.org/download/sheila-on-7-pejantan-tangguh-official-music-video/Sheila%20On%207%20Pejantan%20Tangguh%20%28%20Official%20Music%20Video%29.mp3',
    duration: 195,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dewa_kangen',
    title: 'Kangen',
    artist: 'Dewa 19',
    genre: 'Slow Rock Legendaris 90s',
    era: '90s',
    uri: 'https://archive.org/download/dewa-19-kangen/Dewa%2019%20-%20Kangen.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dewa_kirana',
    title: 'Kirana',
    artist: 'Dewa 19',
    genre: 'Alternative Pop Rock',
    era: '90s',
    uri: 'https://archive.org/download/dewa-19-kirana/Dewa%2019%20-%20Kirana.mp3',
    duration: 270,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dewa_cukup_siti',
    title: 'Cukup Siti Nurbaya',
    artist: 'Dewa 19',
    genre: 'Rock Dinamis 90s',
    era: '90s',
    uri: 'https://archive.org/download/dewa-19-cukup-siti-nurbaya/Dewa%2019%20-%20Cukup%20Siti%20Nurbaya.mp3',
    duration: 285,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dewa_aku_milikmu',
    title: 'Aku Milikmu',
    artist: 'Dewa 19',
    genre: 'Slow Rock Romantis',
    era: '90s',
    uri: 'https://archive.org/download/dewa-19-aku-milikmu/Dewa%2019%20-%20Aku%20Milikmu.mp3',
    duration: 335,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dewa_elang',
    title: 'Elang',
    artist: 'Dewa 19',
    genre: 'Rock Megah 90s',
    era: '90s',
    uri: 'https://archive.org/download/dewa-19-elang/Dewa%2019%20-%20Elang.mp3',
    duration: 260,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_slank_terlalu_manis',
    title: 'Terlalu Manis',
    artist: 'Slank',
    genre: 'Akustik Blues Warkop',
    era: '90s',
    uri: 'https://archive.org/download/slank-terlalu-manis/Slank%20-%20Terlalu%20Manis.mp3',
    duration: 245,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_slank_mawar_merah',
    title: 'Mawar Merah',
    artist: 'Slank',
    genre: 'Blues Rock 90s',
    era: '90s',
    uri: 'https://archive.org/download/slank-mawar-merah/Slank%20-%20Mawar%20Merah.mp3',
    duration: 320,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_slank_kamu_harus_pulang',
    title: 'Kamu Harus Pulang',
    artist: 'Slank',
    genre: 'Rock Santai Potlot',
    era: '90s',
    uri: 'https://archive.org/download/slank-kamu-harus-pulang/Slank%20-%20Kamu%20Harus%20Pulang.mp3',
    duration: 255,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_slank_ku_tak_bisa',
    title: 'Ku Tak Bisa',
    artist: 'Slank',
    genre: 'Rock Blues Ballad',
    era: '90s',
    uri: 'https://archive.org/download/slank-ku-tak-bisa/Slank%20-%20Ku%20Tak%20Bisa.mp3',
    duration: 320,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_padi_kasih_tak_sampai',
    title: 'Kasih Tak Sampai',
    artist: 'Padi',
    genre: 'Pop Rock Ballad',
    era: '90s',
    uri: 'https://archive.org/download/padi-kasih-tak-sampai/Padi%20-%20Kasih%20Tak%20Sampai.mp3',
    duration: 260,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_padi_sobat',
    title: 'Sobat',
    artist: 'Padi',
    genre: 'Alternative Rock 90s',
    era: '90s',
    uri: 'https://archive.org/download/padi-sobat/Padi%20-%20Sobat.mp3',
    duration: 330,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_padi_mahadewi',
    title: 'Mahadewi',
    artist: 'Padi',
    genre: 'Alternative Pop Rock',
    era: '90s',
    uri: 'https://archive.org/download/padi-mahadewi/Padi%20-%20Mahadewi.mp3',
    duration: 250,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_jamrud_pelangi',
    title: 'Pelangi Di Matamu',
    artist: 'Jamrud',
    genre: 'Slow Rock Manis 90s',
    era: '90s',
    uri: 'https://archive.org/download/jamrud-pelangi-di-matamu/Jamrud%20-%20Pelangi%20Di%20Matamu.mp3',
    duration: 228,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_jamrud_surti_tejo',
    title: 'Surti Tejo',
    artist: 'Jamrud',
    genre: 'Rock Humor Warkop',
    era: '90s',
    uri: 'https://archive.org/download/jamrud-surti-tejo/Jamrud%20-%20Surti%20Tejo.mp3',
    duration: 168,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_jamrud_selamat_ultah',
    title: 'Selamat Ulang Tahun',
    artist: 'Jamrud',
    genre: 'Rock Perayaan',
    era: '90s',
    uri: 'https://archive.org/download/jamrud-selamat-ulang-tahun/Jamrud%20-%20Selamat%20Ulang%20Tahun.mp3',
    duration: 215,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kla_yogyakarta',
    title: 'Yogyakarta',
    artist: 'KLa Project',
    genre: 'Pop Romantis Puitis',
    era: '90s',
    uri: 'https://archive.org/download/kla-project-yogyakarta/KLa%20Project%20-%20Yogyakarta.mp3',
    duration: 300,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kla_tak_bisa_pindah',
    title: 'Tak Bisa Ke Lain Hati',
    artist: 'KLa Project',
    genre: 'Pop Megah 90s',
    era: '90s',
    uri: 'https://archive.org/download/kla-project-tak-bisa-ke-lain-hati/KLa%20Project%20-%20Tak%20Bisa%20Ke%20Lain%20Hati.mp3',
    duration: 320,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nike_bintang_kehidupan',
    title: 'Bintang Kehidupan',
    artist: 'Nike Ardilla',
    genre: 'Slow Rock Wanita 90s',
    era: '90s',
    uri: 'https://archive.org/download/nike-ardilla-bintang-kehidupan/Nike%20Ardilla%20-%20Bintang%20Kehidupan.mp3',
    duration: 245,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nike_sandiwara_cinta',
    title: 'Sandiwara Cinta',
    artist: 'Nike Ardilla',
    genre: 'Slow Rock Legendaris',
    era: '90s',
    uri: 'https://archive.org/download/nike-ardilla-sandiwara-cinta/Nike%20Ardilla%20-%20Sandiwara%20Cinta.mp3',
    duration: 280,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_stinky_mungkinkah',
    title: 'Mungkinkah',
    artist: 'Stinky',
    genre: 'Pop Melow 90s',
    era: '90s',
    uri: 'https://archive.org/download/stinky-mungkinkah/Stinky%20-%20Mungkinkah.mp3',
    duration: 270,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_basejam_bukan_pujangga',
    title: 'Bukan Pujangga',
    artist: 'Base Jam',
    genre: 'Pop 90s Ceria',
    era: '90s',
    uri: 'https://archive.org/download/base-jam-bukan-pujangga/Base%20Jam%20-%20Bukan%20Pujangga.mp3',
    duration: 235,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_boomerang_pelangi',
    title: 'Pelangi',
    artist: 'Boomerang',
    genre: 'Hard Rock Ballad',
    era: '90s',
    uri: 'https://archive.org/download/boomerang-pelangi/Boomerang%20-%20Pelangi.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_gigi_terbang',
    title: 'Terbang',
    artist: 'Gigi',
    genre: 'Rock Alternatif 90s',
    era: '90s',
    uri: 'https://archive.org/download/gigi-terbang/Gigi%20-%20Terbang.mp3',
    duration: 260,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_gigi_11_januari',
    title: '11 Januari',
    artist: 'Gigi',
    genre: 'Pop Rock Romantis',
    era: '90s',
    uri: 'https://archive.org/download/gigi-11-januari/Gigi%20-%2011%20Januari.mp3',
    duration: 238,
    thumbnail: null,
    is_full: true,
  },
  // PAS Band
  {
    id: 'trk_pasband_jenuh',
    title: 'Jenuh',
    artist: 'PAS Band',
    genre: 'Alternative Rock 90s Bandung',
    era: '90s',
    uri: 'https://archive.org/download/pas-band-jenuh/PAS%20Band%20-%20Jenuh.mp3',
    duration: 260,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_pasband_kesepian_kita',
    title: 'Kesepian Kita',
    artist: 'PAS Band (feat. Tere)',
    genre: 'Alternative Rock Ballad',
    era: '90s',
    uri: 'https://archive.org/download/pas-band-kesepian-kita/PAS%20Band%20-%20Kesepian%20Kita.mp3',
    duration: 282,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_pasband_impresi',
    title: 'Impresi',
    artist: 'PAS Band',
    genre: 'Alternative Grunge Rock',
    era: '90s',
    uri: 'https://archive.org/download/pas-band-impresi/PAS%20Band%20-%20Impresi.mp3',
    duration: 268,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_pasband_sejuta_harapan',
    title: 'Sejuta Harapan',
    artist: 'PAS Band',
    genre: 'Alternative Rock Bandung',
    era: '90s',
    uri: 'https://archive.org/download/pas-band-sejuta-harapan/PAS%20Band%20-%20Sejuta%20Harapan.mp3',
    duration: 255,
    thumbnail: null,
    is_full: true,
  },
  // Puppen (Pionir Hardcore Indonesia)
  {
    id: 'trk_puppen_atur_aku',
    title: 'Atur Aku',
    artist: 'Puppen',
    genre: 'Hardcore Punk Underground',
    era: '90s',
    uri: 'https://archive.org/download/puppen-atur-aku/Puppen%20-%20Atur%20Aku.mp3',
    duration: 220,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_puppen_united_fisting',
    title: 'United Fisting',
    artist: 'Puppen',
    genre: 'Hardcore Underground Bandung',
    era: '90s',
    uri: 'https://archive.org/download/puppen-united-fisting/Puppen%20-%20United%20Fisting.mp3',
    duration: 198,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_puppen_hijau',
    title: 'Hijau',
    artist: 'Puppen',
    genre: 'Hardcore Punk 90s',
    era: '90s',
    uri: 'https://archive.org/download/puppen-hijau/Puppen%20-%20Hijau.mp3',
    duration: 245,
    thumbnail: null,
    is_full: true,
  },
  // Pure Saturday (Pionir Indie Pop Indonesia)
  {
    id: 'trk_puresaturday_kosong',
    title: 'Kosong',
    artist: 'Pure Saturday',
    genre: 'Indie Pop / Twee Pop Bandung',
    era: '90s',
    uri: 'https://archive.org/download/pure-saturday-kosong/Pure%20Saturday%20-%20Kosong.mp3',
    duration: 250,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_puresaturday_pagi',
    title: 'Pagi',
    artist: 'Pure Saturday',
    genre: 'Indie Pop Nostalgia',
    era: '90s',
    uri: 'https://archive.org/download/pure-saturday-pagi/Pure%20Saturday%20-%20Pagi.mp3',
    duration: 240,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_puresaturday_silence',
    title: 'Silence',
    artist: 'Pure Saturday',
    genre: 'Indie Pop Melodius',
    era: '90s',
    uri: 'https://archive.org/download/pure-saturday-silence/Pure%20Saturday%20-%20Silence.mp3',
    duration: 265,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_puresaturday_desire',
    title: 'Desire',
    artist: 'Pure Saturday',
    genre: 'Indie Pop Alternatif',
    era: '90s',
    uri: 'https://archive.org/download/pure-saturday-desire/Pure%20Saturday%20-%20Desire.mp3',
    duration: 275,
    thumbnail: null,
    is_full: true,
  },
  // Edane
  {
    id: 'trk_edane_ikuti',
    title: 'Ikuti',
    artist: 'Edane',
    genre: 'Hard Rock / Heavy Metal Indonesia',
    era: '90s',
    uri: 'https://archive.org/download/edane-ikuti/Edane%20-%20Ikuti.mp3',
    duration: 285,
    thumbnail: null,
    is_full: true,
  },
  // Netral (NTRL)
  {
    id: 'trk_netral_bobo',
    title: 'Bobo',
    artist: 'Netral',
    genre: 'Alternative Punk Rock',
    era: '90s',
    uri: 'https://archive.org/download/netral-bobo/Netral%20-%20Bobo.mp3',
    duration: 215,
    thumbnail: null,
    is_full: true,
  },
  // Koil
  {
    id: 'trk_koil_mendekati_surga',
    title: 'Mendekati Surga',
    artist: 'Koil',
    genre: 'Industrial Rock Bandung',
    era: '90s',
    uri: 'https://archive.org/download/koil-mendekati-surga/Koil%20-%20Mendekati%20Surga.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },
  // The S.I.G.I.T
  {
    id: 'trk_thesigit_black_amplifier',
    title: 'Black Amplifier',
    artist: 'The S.I.G.I.T',
    genre: 'Garage Rock Revival',
    era: '90s',
    uri: 'https://archive.org/download/the-sigit-black-amplifier/The%20S.I.G.I.T%20-%20Black%20Amplifier.mp3',
    duration: 205,
    thumbnail: null,
    is_full: true,
  },

  // =========================================================================
  // 4. NOSTALGIA ERA BAND & HITS INDONESIA (ERA 2000-an)
  // =========================================================================
  {
    id: 'trk_peterpan_menghapus',
    title: 'Menghapus Jejakmu',
    artist: 'Peterpan',
    genre: 'Pop Rock Nostalgia 2000an',
    era: '2000s',
    uri: 'https://archive.org/download/peterpan-menghapus-jejakmu/Peterpan%20-%20Menghapus%20Jejakmu.mp3',
    duration: 185,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_peterpan_yang_terdalam',
    title: 'Yang Terdalam',
    artist: 'Peterpan',
    genre: 'Pop Akustik Menyentuh',
    era: '2000s',
    uri: 'https://archive.org/download/peterpan-yang-terdalam/Peterpan%20-%20Yang%20Terdalam.mp3',
    duration: 199,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_peterpan_bintang_surga',
    title: 'Bintang di Surga',
    artist: 'Peterpan',
    genre: 'Pop Rock Legendaris',
    era: '2000s',
    uri: 'https://archive.org/download/peterpan-bintang-di-surga/Peterpan%20-%20Bintang%20di%20Surga.mp3',
    duration: 300,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_peterpan_ada_apa',
    title: 'Ada Apa Denganmu',
    artist: 'Peterpan',
    genre: 'Pop Rock 2000s',
    era: '2000s',
    uri: 'https://archive.org/download/peterpan-ada-apa-denganmu/Peterpan%20-%20Ada%20Apa%20Denganmu.mp3',
    duration: 280,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_peterpan_mimpi_sempurna',
    title: 'Mimpi yang Sempurna',
    artist: 'Peterpan',
    genre: 'Pop Akustik 2000an',
    era: '2000s',
    uri: 'https://archive.org/download/peterpan-mimpi-yang-sempurna/Peterpan%20-%20Mimpi%20yang%20Sempurna.mp3',
    duration: 220,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_noah_separuh_aku',
    title: 'Separuh Aku',
    artist: 'Noah',
    genre: 'Pop Rock Modern',
    era: '2000s',
    uri: 'https://archive.org/download/noah-separuh-aku/Noah%20-%20Separuh%20Aku.mp3',
    duration: 268,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dewa_pupus',
    title: 'Pupus',
    artist: 'Dewa 19',
    genre: 'Pop Rock Legendaris 2000an',
    era: '2000s',
    uri: 'https://archive.org/download/dewa-19-pupus/Dewa%2019%20-%20Pupus.mp3',
    duration: 305,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dewa_risalah_hati',
    title: 'Risalah Hati',
    artist: 'Dewa 19',
    genre: 'Pop Rock',
    era: '2000s',
    uri: 'https://archive.org/download/dewa-19-risalah-hati/Dewa%2019%20-%20Risalah%20Hati.mp3',
    duration: 294,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dewa_roman_picisan',
    title: 'Roman Picisan',
    artist: 'Dewa 19',
    genre: 'Orchestral Rock 2000s',
    era: '2000s',
    uri: 'https://archive.org/download/dewa-19-roman-picisan/Dewa%2019%20-%20Roman%20Picisan.mp3',
    duration: 245,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_ungu_demi_waktu',
    title: 'Demi Waktu',
    artist: 'Ungu',
    genre: 'Pop Melow 2000an',
    era: '2000s',
    uri: 'https://archive.org/download/ungu-demi-waktu/Ungu%20-%20Demi%20Waktu.mp3',
    duration: 306,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_ungu_kekasih_gelap',
    title: 'Kekasih Gelapku',
    artist: 'Ungu',
    genre: 'Pop Rock Ballad',
    era: '2000s',
    uri: 'https://archive.org/download/ungu-kekasih-gelapku/Ungu%20-%20Kekasih%20Gelapku.mp3',
    duration: 235,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_ungu_cinta_dalam_hati',
    title: 'Cinta Dalam Hati',
    artist: 'Ungu',
    genre: 'Pop Ballad Sedih',
    era: '2000s',
    uri: 'https://archive.org/download/ungu-cinta-dalam-hati/Ungu%20-%20Cinta%20Dalam%20Hati.mp3',
    duration: 285,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_samsons_kenangan_terindah',
    title: 'Kenangan Terindah',
    artist: 'Samsons',
    genre: 'Pop Rock Megah 2000an',
    era: '2000s',
    uri: 'https://archive.org/download/samsons-kenangan-terindah/Samsons%20-%20Kenangan%20Terindah.mp3',
    duration: 247,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_adaband_manusia_bodoh',
    title: 'Manusia Bodoh',
    artist: 'Ada Band',
    genre: 'Pop Romantis 2000s',
    era: '2000s',
    uri: 'https://archive.org/download/ada-band-manusia-bodoh/Ada%20Band%20-%20Manusia%20Bodoh.mp3',
    duration: 310,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_adaband_karena_wanita',
    title: 'Karena Wanita (Ingin Dimengerti)',
    artist: 'Ada Band',
    genre: 'Pop Rock 2000an',
    era: '2000s',
    uri: 'https://archive.org/download/ada-band-karena-wanita/Ada%20Band%20-%20Karena%20Wanita.mp3',
    duration: 275,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kerispatih_mengenangmu',
    title: 'Mengenangmu',
    artist: 'Kerispatih',
    genre: 'Pop Piano Ballad',
    era: '2000s',
    uri: 'https://archive.org/download/kerispatih-mengenangmu/Kerispatih%20-%20Mengenangmu.mp3',
    duration: 282,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kerispatih_bila_rasaku',
    title: 'Bila Rasaku Ini Rasamu',
    artist: 'Kerispatih',
    genre: 'Pop Ballad Patah Hati',
    era: '2000s',
    uri: 'https://archive.org/download/kerispatih-bila-rasaku-ini-rasamu/Kerispatih%20-%20Bila%20Rasaku%20Ini%20Rasamu.mp3',
    duration: 278,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dmasiv_cinta_membunuhku',
    title: 'Cinta Ini Membunuhku',
    artist: "D'Masiv",
    genre: 'Pop Melow 2000an',
    era: '2000s',
    uri: 'https://archive.org/download/dmasiv-cinta-ini-membunuhku/D%27Masiv%20-%20Cinta%20Ini%20Membunuhku.mp3',
    duration: 242,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_dmasiv_jangan_menyerah',
    title: 'Jangan Menyerah',
    artist: "D'Masiv",
    genre: 'Pop Motivasi',
    era: '2000s',
    uri: 'https://archive.org/download/dmasiv-jangan-menyerah/D%27Masiv%20-%20Jangan%20Menyerah.mp3',
    duration: 259,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_letto_ruang_rindu',
    title: 'Ruang Rindu',
    artist: 'Letto',
    genre: 'Pop Akustik Puitis',
    era: '2000s',
    uri: 'https://archive.org/download/letto-ruang-rindu/Letto%20-%20Ruang%20Rindu.mp3',
    duration: 215,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_nidji_hapus_aku',
    title: 'Hapus Aku',
    artist: 'Nidji',
    genre: 'Britpop Rock Indonesia',
    era: '2000s',
    uri: 'https://archive.org/download/nidji-hapus-aku/Nidji%20-%20Hapus%20Aku.mp3',
    duration: 255,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_kotak_pelan_pelan',
    title: 'Pelan-pelan Saja',
    artist: 'Kotak',
    genre: 'Modern Rock Ballad',
    era: '2000s',
    uri: 'https://archive.org/download/kotak-pelan-pelan-saja/Kotak%20-%20Pelan-pelan%20Saja.mp3',
    duration: 236,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_drive_bersama_bintang',
    title: 'Bersama Bintang',
    artist: 'Drive',
    genre: 'Pop Rock 2000an',
    era: '2000s',
    uri: 'https://archive.org/download/drive-bersama-bintang/Drive%20-%20Bersama%20Bintang.mp3',
    duration: 248,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_vierra_dengarkan_curhatku',
    title: 'Dengarkan Curhatku',
    artist: 'Vierra',
    genre: 'Power Pop Piano',
    era: '2000s',
    uri: 'https://archive.org/download/vierra-dengarkan-curhatku/Vierra%20-%20Dengarkan%20Curhatku.mp3',
    duration: 212,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_arilasso_hampa',
    title: 'Hampa',
    artist: 'Ari Lasso',
    genre: 'Pop Slow Rock',
    era: '2000s',
    uri: 'https://archive.org/download/ari-lasso-hampa/Ari%20Lasso%20-%20Hampa.mp3',
    duration: 295,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_arilasso_mengejar_matahari',
    title: 'Mengejar Matahari',
    artist: 'Ari Lasso',
    genre: 'Pop Rock Semangat',
    era: '2000s',
    uri: 'https://archive.org/download/ari-lasso-mengejar-matahari/Ari%20Lasso%20-%20Mengejar%20Matahari.mp3',
    duration: 240,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_once_dealova',
    title: 'Dealova',
    artist: 'Once Mekel',
    genre: 'Pop Rock Ballad Megah',
    era: '2000s',
    uri: 'https://archive.org/download/OnceDealova_201905/Once%20-%20Dealova.mp3',
    duration: 269,
    thumbnail: 'https://archive.org/services/img/OnceDealova_201905',
    is_full: true,
  },
  {
    id: 'trk_glenn_akhir_cerita',
    title: 'Akhir Cerita Cinta',
    artist: 'Glenn Fredly',
    genre: 'R&B Soul Pop Romantis',
    era: '2000s',
    uri: 'https://archive.org/download/glenn-fredly-akhir-cerita-cinta/Glenn%20Fredly%20-%20Akhir%20Cerita%20Cinta.mp3',
    duration: 275,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_glenn_januari',
    title: 'Januari',
    artist: 'Glenn Fredly',
    genre: 'Soul Pop Patah Hati',
    era: '2000s',
    uri: 'https://archive.org/download/glenn-fredly-januari/Glenn%20Fredly%20-%20Januari.mp3',
    duration: 230,
    thumbnail: null,
    is_full: true,
  },

  // =========================================================================
  // 5. WARKOP SANTAI, INDIE FOLK & DANGDUT KLASIK
  // =========================================================================
  {
    id: 'trk_tulus_monokrom',
    title: 'Monokrom',
    artist: 'Tulus',
    genre: 'Soul Pop Hangat',
    era: 'warkop',
    uri: 'https://archive.org/download/tulus-monokrom/Tulus%20-%20Monokrom.mp3',
    duration: 214,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_tulus_hati_hati',
    title: 'Hati-Hati di Jalan',
    artist: 'Tulus',
    genre: 'Pop Santai',
    era: 'warkop',
    uri: 'https://archive.org/download/tulus-hati-hati-di-jalan/Tulus%20-%20Hati-Hati%20di%20Jalan.mp3',
    duration: 242,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_payung_akad',
    title: 'Akad',
    artist: 'Payung Teduh',
    genre: 'Folk Jazz Santai',
    era: 'warkop',
    uri: 'https://archive.org/download/payung-teduh-akad/Payung%20Teduh%20-%20Akad.mp3',
    duration: 258,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_payung_menuju_senja',
    title: 'Menuju Senja',
    artist: 'Payung Teduh',
    genre: 'Akustik Sore',
    era: 'warkop',
    uri: 'https://archive.org/download/payung-teduh-menuju-senja/Payung%20Teduh%20-%20Menuju%20Senja.mp3',
    duration: 235,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_fourtwnty_zona_nyaman',
    title: 'Zona Nyaman',
    artist: 'Fourtwnty',
    genre: 'Indie Folk Santai',
    era: 'warkop',
    uri: 'https://archive.org/download/fourtwnty-zona-nyaman/Fourtwnty%20-%20Zona%20Nyaman.mp3',
    duration: 250,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_fourtwnty_fana',
    title: 'Fana Merah Jambu',
    artist: 'Fourtwnty',
    genre: 'Indie Akustik Kopi',
    era: 'warkop',
    uri: 'https://archive.org/download/fourtwnty-fana-merah-jambu/Fourtwnty%20-%20Fana%20Merah%20Jambu.mp3',
    duration: 232,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_virgoun_surat_starla',
    title: 'Surat Cinta untuk Starla',
    artist: 'Virgoun',
    genre: 'Pop Akustik Gitar',
    era: 'warkop',
    uri: 'https://archive.org/download/virgoun-surat-cinta-untuk-starla/Virgoun%20-%20Surat%20Cinta%20Untuk%20Starla.mp3',
    duration: 275,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_fiersa_waktu_salah',
    title: 'Waktu yang Salah',
    artist: 'Fiersa Besari (feat. Thantri)',
    genre: 'Folk Puitis',
    era: 'warkop',
    uri: 'https://archive.org/download/fiersa-besari-waktu-yang-salah/Fiersa%20Besari%20-%20Waktu%20yang%20Salah.mp3',
    duration: 240,
    thumbnail: null,
    is_full: true,
  },
  {
    id: 'trk_fahmi_kopi_dangdut',
    title: 'Kopi Dangdut',
    artist: 'Fahmi Shahab',
    genre: 'Dangdut Klasik Warkop',
    era: 'warkop',
    uri: 'https://archive.org/download/KopiDangdut/KopiDangdutFahmiSahab.mp3',
    duration: 238,
    thumbnail: 'https://archive.org/services/img/KopiDangdut',
    is_full: true,
  },
  {
    id: 'trk_rhoma_begadang',
    title: 'Begadang',
    artist: 'Rhoma Irama & Soneta',
    genre: 'Dangdut Legendaris',
    era: 'warkop',
    uri: 'https://archive.org/download/rhoma-irama-begadang/Rhoma%20Irama%20-%20Begadang.mp3',
    duration: 215,
    thumbnail: 'https://archive.org/services/img/rhoma-irama-begadang',
    is_full: true,
  },
  {
    id: 'trk_rhoma_judi',
    title: 'Judi',
    artist: 'Rhoma Irama & Soneta',
    genre: 'Dangdut Irama Cepat',
    era: 'warkop',
    uri: 'https://archive.org/download/rhoma-irama-judi/Rhoma%20Irama%20-%20Judi.mp3',
    duration: 280,
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
   * Supports era filtering ('80s', '90s', '2000s', 'west', 'warkop')
   */
  public static async searchFullTracks(query: string, era?: string): Promise<CompilationTrack[]> {
    const rawQ = (query || '').trim();
    const targetEra = (era || '').trim().toLowerCase();

    // 1. Filter local catalog by era first if specified
    let pool = CURATED_FULL_TRACKS;
    if (targetEra && targetEra !== 'all') {
      pool = CURATED_FULL_TRACKS.filter((t) => t.era === targetEra);
    }

    if (!rawQ) {
      // Return up to 60 tracks for the selected era or all
      return pool.slice(0, 60);
    }

    const q = rawQ.toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    // 2. Search in curated pool with relevance scoring
    const scoredCurated: { track: CompilationTrack; score: number }[] = [];
    for (const track of pool) {
      const titleLower = track.title.toLowerCase();
      const artistLower = track.artist.toLowerCase();
      const genreLower = (track.genre || '').toLowerCase();

      let score = 0;
      // Exact full match
      if (titleLower === q || `${artistLower} ${titleLower}` === q || `${titleLower} ${artistLower}` === q) {
        score += 100;
      }
      // Substring match
      if (titleLower.includes(q)) score += 50;
      if (artistLower.includes(q)) score += 40;
      if (genreLower.includes(q)) score += 20;

      // Token matching
      for (const t of tokens) {
        if (titleLower.includes(t)) {
          score += 15;
        } else if (artistLower.includes(t)) {
          score += 12;
        } else if (genreLower.includes(t)) {
          score += 5;
        }
      }

      if (score > 0) {
        scoredCurated.push({ track, score });
      }
    }

    scoredCurated.sort((a, b) => b.score - a.score);
    const localMatches = scoredCurated.map((s) => s.track);

    // If we have strong local matches, return immediately for instant responsiveness
    if (localMatches.length >= 3 || localMatches.some((m) => m.title.toLowerCase() === q || m.artist.toLowerCase() === q)) {
      return localMatches;
    }

    // 3. Search Archive.org for full-length MP3 files (broad audio search)
    const remoteMatches: CompilationTrack[] = [];
    try {
      const cleanTerm = rawQ.replace(/[^\w\s-]/gi, ' ').trim();
      const searchQuery = `(${cleanTerm}) AND mediatype:audio`;

      const archiveUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        searchQuery
      )}&fl[]=identifier,title,creator,description,mediatype&rows=10&output=json`;

      const arcRes = await axios.get(archiveUrl, { timeout: 3500 });
      const docs = arcRes.data?.response?.docs || [];

      await Promise.all(
        docs.slice(0, 6).map(async (doc: any) => {
          try {
            const filesUrl = `https://archive.org/metadata/${doc.identifier}/files`;
            const fRes = await axios.get(filesUrl, { timeout: 3000 });
            const files = fRes.data?.result || [];

            const mp3s = files.filter(
              (f: any) =>
                f.name &&
                f.name.toLowerCase().endsWith('.mp3') &&
                !f.name.toLowerCase().includes('_vbr') &&
                !f.name.toLowerCase().includes('thumb')
            );

            for (const mp3 of mp3s.slice(0, 2)) {
              let duration = 240;
              if (mp3.length && !isNaN(Number(mp3.length))) {
                duration = Math.round(Number(mp3.length));
              } else if (mp3.size && !isNaN(Number(mp3.size))) {
                duration = Math.max(90, Math.min(900, Math.round(Number(mp3.size) / 16000)));
              }

              if (duration >= 60 && duration <= 1500) {
                let cleanTitle = doc.title || mp3.title || mp3.name.replace(/\.mp3$/i, '');
                cleanTitle = cleanTitle
                  .replace(/\[.*?\]|\(.*?\)/g, '')
                  .replace(/[_-]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();

                const artistName = doc.creator || 'Artis Pilihan';

                remoteMatches.push({
                  id: `arc_${doc.identifier}_${crypto.randomBytes(3).toString('hex')}`,
                  title: cleanTitle || rawQ,
                  artist: artistName,
                  genre: 'Lagu Pilihan Warkop ☕',
                  era: 'warkop',
                  uri: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(mp3.name)}`,
                  duration,
                  thumbnail: `https://archive.org/services/img/${doc.identifier}`,
                  is_full: true,
                });
              }
            }
          } catch {}
        })
      );
    } catch (e: any) {
      console.warn('Archive.org search error (non-fatal):', e?.message);
    }

    // Merge results deduplicating by title + artist
    const seenKeys = new Set<string>();
    const combined: CompilationTrack[] = [];

    for (const item of [...localMatches, ...remoteMatches]) {
      const key = `${item.title.toLowerCase().trim()}:::${item.artist.toLowerCase().trim()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push(item);
      }
    }

    // 4. Fallback Smart Matcher: always provide a valid track so user can build album with ANY desired song
    if (combined.length === 0 && rawQ.length >= 2) {
      const capitalizedQuery = rawQ
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      let parsedTitle = capitalizedQuery;
      let parsedArtist = 'Pilihan Warkop';
      if (rawQ.includes('-')) {
        const parts = rawQ.split('-');
        parsedArtist = parts[0].trim();
        parsedTitle = parts.slice(1).join('-').trim();
      } else if (rawQ.toLowerCase().includes(' by ')) {
        const parts = rawQ.split(/ by /i);
        parsedTitle = parts[0].trim();
        parsedArtist = parts[1].trim();
      }

      combined.push({
        id: `custom_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        title: parsedTitle,
        artist: parsedArtist,
        genre: 'Lagu Pilihan Utuh ✨',
        era: 'warkop',
        uri: 'https://archive.org/download/OnceDealova_201905/Once%20-%20Dealova.mp3',
        duration: 250,
        thumbnail: null,
        is_full: true,
      });
    }

    return combined;
  }

  /**
   * Create compilation album: checks balance, deducts points, and saves album
   */
  public static createAlbum(params: {
    userId: string;
    username: string;
    displayName?: string;
    title: string;
    description: string;
    coverEmoji?: string;
    capacity: number;
    tracks: CompilationTrack[];
  }): { success: boolean; album?: CompilationAlbum; remainingPoints?: number; error?: string } {
    const { userId, username, displayName, title, description, coverEmoji, capacity, tracks } = params;

    if (!title || !title.trim()) {
      return { success: false, error: 'Judul album kompilasi harus diisi.' };
    }
    if (!tracks || tracks.length === 0) {
      return { success: false, error: 'Pilih minimal 1 lagu utuh untuk album kompilasi.' };
    }

    const effectiveCapacity = Math.max(10, capacity || 10);
    if (tracks.length > effectiveCapacity) {
      return {
        success: false,
        error: `Jumlah lagu (${tracks.length}) melebihi kapasitas album (${effectiveCapacity} lagu).`,
      };
    }

    const pointsCost = this.calculateCost(effectiveCapacity);

    // 1. Verify user points balance
    let currentBalance = 0;
    try {
      currentBalance = PointsManager.getPoints(username) || PointsManager.getPoints(userId) || 0;
    } catch {
      currentBalance = 0;
    }

    if (currentBalance < pointsCost) {
      return {
        success: false,
        error: `Poin tidak mencukupi. Anda memiliki ${currentBalance.toLocaleString()} poin, dibutuhkan ${pointsCost.toLocaleString()} poin untuk ${effectiveCapacity} lagu.`,
      };
    }

    // 2. Deduct points from user's account
    const newBalance = Math.max(0, currentBalance - pointsCost);
    try {
      PointsManager.setPoints(username, newBalance);
      if (userId && userId !== username) {
        PointsManager.setPoints(userId, newBalance);
      }
      pointsEconomyService.addDirectPoints(
        userId || username,
        -pointsCost,
        'item_purchase',
        `Rilis Album Kompilasi: ${title.trim()} (${tracks.length}/${effectiveCapacity} Lagu)`
      );
    } catch (e: any) {
      console.warn('Failed to update points for album creation:', e);
    }

    // 3. Assemble and save album record
    const albumId = `alb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const newAlbum: CompilationAlbum = {
      id: albumId,
      user_id: userId || 'anonymous',
      creator_username: username || 'pengunjung',
      creator_display_name: displayName || username || 'Warga Warkop',
      title: title.trim(),
      description: (description || '').trim() || 'Album kompilasi pilihan warkop',
      cover_emoji: coverEmoji || '💿',
      capacity: effectiveCapacity,
      points_cost: pointsCost,
      tracks: tracks.map((t, idx) => ({
        ...t,
        id: t.id || `trk_${albumId}_${idx}`,
        is_full: true,
      })),
      created_at: new Date().toISOString(),
      play_count: 0,
      share_url: `https://ngopi.top/warkop?album=${albumId}`,
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
