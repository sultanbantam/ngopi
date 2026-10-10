import { Router, Request, Response } from 'express';

const router = Router();

export interface AmbientSound {
  id: string;
  name: string;
  description: string;
  icon: string;
  audioUrl: string;
  category: 'nature' | 'warkop' | 'night';
}

const AMBIENT_SOUNDS: AmbientSound[] = [
  {
    id: 'hujan',
    name: 'Hujan Rintik',
    description: 'Suasana gerimis santai di teras warkop',
    icon: '🌧️',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_bb630cc098.mp3?filename=rain-and-thunder-16705.mp3',
    category: 'nature',
  },
  {
    id: 'kafe_ramai',
    name: 'Kafe Ramai',
    description: 'Denting cangkir kopi & celoteh warkop',
    icon: '☕',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_8340d8987b.mp3?filename=coffee-shop-ambience-19597.mp3',
    category: 'warkop',
  },
  {
    id: 'ombak',
    name: 'Ombak Pantai',
    description: 'Deburan ombak tenang di tepi laut',
    icon: '🌊',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_9242d992f8.mp3?filename=waves-ambient-3023.mp3',
    category: 'nature',
  },
  {
    id: 'hutan',
    name: 'Hutan Senja',
    description: 'Kicau burung lembut di pepohonan rindang',
    icon: '🌲',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_cbee1284d7.mp3?filename=forest-birds-and-wind-11234.mp3',
    category: 'nature',
  },
  {
    id: 'jangkrik',
    name: 'Jangkrik Malam',
    description: 'Suara serangga malam di bawah langit berbintang',
    icon: '🦗',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_24e207908b.mp3?filename=night-crickets-ambient-19601.mp3',
    category: 'night',
  },
  {
    id: 'api_unggun',
    name: 'Api Unggun',
    description: 'Gemeretak kayu bakar hangat di malam hari',
    icon: '🔥',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_dc39bde808.mp3?filename=campfire-crackling-fireplace-sound-119594.mp3',
    category: 'night',
  },
  {
    id: 'pasar',
    name: 'Pasar Tradisional',
    description: 'Suasana hangat pasar tradisional pagi hari',
    icon: '🏮',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c36bfdc250.mp3?filename=market-chatter-crowd-6713.mp3',
    category: 'warkop',
  },
];

// GET /api/ambient/list
router.get('/list', (_req: Request, res: Response): void => {
  res.status(200).json({
    sounds: AMBIENT_SOUNDS,
    default_sound: 'kafe_ramai',
  });
});

export default router;
