export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  streamUrl: string;
  tagline: string;
  icon: string;
  location: string;
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'sonora-fm',
    name: 'Sonora FM 92 Jakarta',
    genre: 'Pop, Berita & Suasana',
    streamUrl: 'https://sonora-radio.arenastreaming.com/8130/stream',
    tagline: 'Musik Populer & Kabar Terhangat',
    icon: '📻',
    location: 'Jakarta',
  },
  {
    id: 'iradio-jakarta',
    name: 'I-Radio 89.6 FM',
    genre: '100% Musik Indonesia',
    streamUrl: 'https://stream.radiojar.com/4ywdgup3bnzuv',
    tagline: 'Barometer Musik Pop Indonesia',
    icon: '🎵',
    location: 'Jakarta',
  },
  {
    id: 'dengerin-indo',
    name: 'Dengerin Musik Indonesia',
    genre: 'Pop & Top 40 Hits',
    streamUrl: 'https://stream.denger.in/',
    tagline: 'Lagu-Lagu Hits Indonesia 24 Jam',
    icon: '🎧',
    location: 'Streaming',
  },
  {
    id: 'hardrock-fm',
    name: 'Hard Rock FM 87.6',
    genre: 'Rock, Pop & Lifestyle',
    streamUrl: 'https://stream.radiojar.com/7csmg90fuqruv',
    tagline: 'Music & Lifestyle Radio',
    icon: '🎸',
    location: 'Jakarta',
  },
  {
    id: 'suara-surabaya',
    name: 'Suara Surabaya 100 FM',
    genre: 'Informasi & Musik Santai',
    streamUrl: 'https://c5.siar.us/proxy/ssfm/stream',
    tagline: 'Kelana Kota Suara Surabaya',
    icon: '☕',
    location: 'Surabaya',
  },
  {
    id: 'suara-soneta',
    name: 'Suara Soneta Radio',
    genre: 'Dangdut Klasik & Warkop',
    streamUrl: 'https://a2.siar.us/listen/suarasoneta/radio.mp3',
    tagline: 'Nostalgia Dangdut & Musik Melayu',
    icon: '🪘',
    location: 'Indonesia',
  },
  {
    id: 'elshinta-fm',
    name: 'Elshinta News and Talk',
    genre: 'Berita & Informasi Terkini',
    streamUrl: 'https://stream-ssl.arenastreaming.com:8000/jakarta',
    tagline: 'Kabar Utama & Obrolan Warung Terkini',
    icon: '🎙️',
    location: 'Nasional',
  },
];
