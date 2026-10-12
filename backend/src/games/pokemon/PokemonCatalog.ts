import crypto from 'crypto';
import { PokemonCardDef, PokemonCardInstance, PokemonElementType, PokemonRarity } from './types';

export const POKEMON_CATALOG: PokemonCardDef[] = [
  // Common (6 kartu)
  {
    id: 'pk_01',
    name: 'Kelinci Petir',
    type: 'electric',
    hp: 90,
    attack: 35,
    defense: 20,
    rarity: 'common',
    description: 'Kelinci lincah dengan bulu yang menyimpan muatan listrik statis.',
    skillName: 'Sengatan Cepat',
    skillPower: 45,
    skillDescription: 'Menembakkan kejutan listrik kilat ke lawan.',
    icon: '⚡',
  },
  {
    id: 'pk_02',
    name: 'Merpati Angin',
    type: 'grass',
    hp: 85,
    attack: 30,
    defense: 25,
    rarity: 'common',
    description: 'Burung pembawa pesan rimba yang mengepakkan badai dedaunan.',
    skillName: 'Tebasan Daun',
    skillPower: 42,
    skillDescription: 'Mengibaskan sayap berdaun tajam.',
    icon: '🌿',
  },
  {
    id: 'pk_03',
    name: 'Kodok Rawa',
    type: 'water',
    hp: 100,
    attack: 28,
    defense: 30,
    rarity: 'common',
    description: 'Amfibi tangguh yang berkamuflase di teratai rawa.',
    skillName: 'Semburan Lumpur',
    skillPower: 40,
    skillDescription: 'Menyemprotkan air bercampur lumpur tebal.',
    icon: '💧',
  },
  {
    id: 'pk_04',
    name: 'Landak Cadas',
    type: 'earth',
    hp: 110,
    attack: 25,
    defense: 38,
    rarity: 'common',
    description: 'Duri-durinya sekeras batu cadas pegunungan kapur.',
    skillName: 'Tusukan Granit',
    skillPower: 38,
    skillDescription: 'Menggulung tubuh dan menghantam seperti batu cadas.',
    icon: '🌍',
  },
  {
    id: 'pk_05',
    name: 'Kucing Bara',
    type: 'fire',
    hp: 95,
    attack: 36,
    defense: 22,
    rarity: 'common',
    description: 'Kucing nakal yang ekornya menyala dengan api merah hangat.',
    skillName: 'Cakaran Membara',
    skillPower: 46,
    skillDescription: 'Mencakar musuh dengan kuku berpijar api.',
    icon: '🔥',
  },
  {
    id: 'pk_06',
    name: 'Gagak Bayang',
    type: 'psychic',
    hp: 90,
    attack: 32,
    defense: 26,
    rarity: 'common',
    description: 'Burung misterius penyerap gelombang pikiran di malam hari.',
    skillName: 'Gelombang Hipnotis',
    skillPower: 44,
    skillDescription: 'Memancarkan aura ungu yang mengacaukan konsentrasi.',
    icon: '🔮',
  },

  // Rare (6 kartu)
  {
    id: 'pk_07',
    name: 'Harimau Api',
    type: 'fire',
    hp: 135,
    attack: 55,
    defense: 35,
    rarity: 'rare',
    description: 'Raja rimba bergaris api yang melompat di puncak kawah gunung berapi.',
    skillName: 'Auman Lahar',
    skillPower: 70,
    skillDescription: 'Mengaum kencang memuntahkan semburan lahar panas.',
    icon: '🐯',
  },
  {
    id: 'pk_08',
    name: 'Lumba Samudera',
    type: 'water',
    hp: 140,
    attack: 48,
    defense: 45,
    rarity: 'rare',
    description: 'Penjaga selat nusantara dengan renang berkecepatan tinggi.',
    skillName: 'Pusaran Arus',
    skillPower: 65,
    skillDescription: 'Membuat pusaran air besar yang menenggelamkan pertahanan.',
    icon: '🐬',
  },
  {
    id: 'pk_09',
    name: 'Elang Badai',
    type: 'electric',
    hp: 125,
    attack: 60,
    defense: 30,
    rarity: 'rare',
    description: 'Elang perkasa yang menukik bersama halilintar petir.',
    skillName: 'Sambaran Petir Biru',
    skillPower: 75,
    skillDescription: 'Menukik dengan seluruh sayap bermuatan jutaan volt.',
    icon: '🦅',
  },
  {
    id: 'pk_10',
    name: 'Kancil Sakti',
    type: 'grass',
    hp: 120,
    attack: 52,
    defense: 40,
    rarity: 'rare',
    description: 'Legenda kecerdikan rimba yang menguasai seni herba purba.',
    skillName: 'Akar Pembelit',
    skillPower: 68,
    skillDescription: 'Memanggil akar-akar pohon beringin untuk membelenggu musuh.',
    icon: '🦌',
  },
  {
    id: 'pk_11',
    name: 'Badak Batu',
    type: 'earth',
    hp: 160,
    attack: 45,
    defense: 60,
    rarity: 'rare',
    description: 'Badak bercula tunggal dari lempeng tektonik purba Ujung Kulon.',
    skillName: 'Tabrakan Gempa',
    skillPower: 66,
    skillDescription: 'Menghentakkan kaki menciptakan retakan gempa lokal.',
    icon: '🦏',
  },
  {
    id: 'pk_12',
    name: 'Rubah Ilusi',
    type: 'psychic',
    hp: 130,
    attack: 56,
    defense: 36,
    rarity: 'rare',
    description: 'Rubah sembilan bayangan yang mahir memanipulasi persepsi waktu.',
    skillName: 'Cermin Pikiran',
    skillPower: 72,
    skillDescription: 'Menembakkan ilusi psikis beruntun yang memusingkan.',
    icon: '🦊',
  },

  // Epic (4 kartu)
  {
    id: 'pk_13',
    name: 'Naga Mahameru',
    type: 'fire',
    hp: 185,
    attack: 80,
    defense: 55,
    rarity: 'epic',
    description: 'Naga mistis yang tidur di dasar kawah Mahameru dan menjaga keseimbangan alam.',
    skillName: 'Nafas Inferno',
    skillPower: 95,
    skillDescription: 'Menghembuskan api murni sedalam seribu meter magma.',
    icon: '🐉',
  },
  {
    id: 'pk_14',
    name: 'Pohon Purba Rimba',
    type: 'grass',
    hp: 210,
    attack: 62,
    defense: 75,
    rarity: 'epic',
    description: 'Ent pohon raksasa berusia ribuan tahun dengan kulit kayu setebal baja.',
    skillName: 'Hantaman Batang Baja',
    skillPower: 85,
    skillDescription: 'Menghantamkan cabang raksasa dengan tenaga ratusan ton.',
    icon: '🌳',
  },
  {
    id: 'pk_15',
    name: 'Rajawali Halilintar',
    type: 'electric',
    hp: 175,
    attack: 85,
    defense: 50,
    rarity: 'epic',
    description: 'Penguasa langit khatulistiwa yang membelah awan badai hitam.',
    skillName: 'Supercell Megavolt',
    skillPower: 100,
    skillDescription: 'Memanggil tornado bermuatan listrik murni berkilau.',
    icon: '⚡',
  },
  {
    id: 'pk_16',
    name: 'Leviathan Nusantara',
    type: 'water',
    hp: 195,
    attack: 78,
    defense: 65,
    rarity: 'epic',
    description: 'Ular laut legendaris yang mendiami Palung Jawa terdalam.',
    skillName: 'Tsunami Penghancur',
    skillPower: 96,
    skillDescription: 'Mengibaskan ekor menciptakan gelombang tsunami dahsyat.',
    icon: '🌊',
  },

  // Legendary (2 kartu)
  {
    id: 'pk_17',
    name: 'Garuda Emas Sakti',
    type: 'psychic',
    hp: 240,
    attack: 100,
    defense: 80,
    rarity: 'legendary',
    description: 'Makhluk mitologi tertinggi bersayap emas abadi lambang kejayaan nusantara.',
    skillName: 'Sinar Surya Purba',
    skillPower: 120,
    skillDescription: 'Memancarkan pendaran cahaya suci yang melumpuhkan semua kegelapan.',
    icon: '🦅',
  },
  {
    id: 'pk_18',
    name: 'Gajah Ganesha Perkasa',
    type: 'earth',
    hp: 260,
    attack: 95,
    defense: 90,
    rarity: 'legendary',
    description: 'Perwujudan kebijaksanaan dan keteguhan bumi yang tak tergoyahkan.',
    skillName: 'Hentakan Benua',
    skillPower: 115,
    skillDescription: 'Menggetarkan seluruh daratan hingga musuh bertekuk lutut.',
    icon: '🐘',
  },
];

export class PokemonCatalog {
  public static getAll(): PokemonCardDef[] {
    return POKEMON_CATALOG;
  }

  public static getById(id: string): PokemonCardDef | undefined {
    return POKEMON_CATALOG.find((c) => c.id === id);
  }

  public static getByName(name: string): PokemonCardDef | undefined {
    return POKEMON_CATALOG.find((c) => c.name.toLowerCase() === name.toLowerCase());
  }

  public static createInstance(defId: string, isShiny = false): PokemonCardInstance {
    const def = this.getById(defId) || POKEMON_CATALOG[0]!;
    // Shiny cards get 10% bonus HP and attack
    const shinyMult = isShiny ? 1.1 : 1.0;
    const maxHp = Math.round(def.hp * shinyMult);
    const attack = Math.round(def.attack * shinyMult);

    return {
      instanceId: `inst_${crypto.randomUUID().slice(0, 8)}`,
      defId: def.id,
      name: def.name,
      type: def.type,
      maxHp,
      currentHp: maxHp,
      attack,
      defense: def.defense,
      rarity: def.rarity,
      skillName: def.skillName,
      skillPower: Math.round(def.skillPower * shinyMult),
      isShiny,
      isFainted: false,
      icon: def.icon,
    };
  }

  /**
   * Generates a starter team of 3 complementary common/rare cards.
   */
  public static getStarterTeam(): PokemonCardInstance[] {
    return [
      this.createInstance('pk_05'), // Kucing Bara (Fire)
      this.createInstance('pk_03'), // Kodok Rawa (Water)
      this.createInstance('pk_01'), // Kelinci Petir (Electric)
    ];
  }

  /**
   * Generates a booster pack containing 3 cards with defined rarity probabilities:
   * Common: 65%, Rare: 23%, Epic: 9%, Legendary: 3%
   * Shiny chance: 6%
   */
  public static openBoosterPack(): PokemonCardInstance[] {
    const pack: PokemonCardInstance[] = [];

    for (let i = 0; i < 3; i++) {
      const rand = Math.random() * 100;
      let targetRarity: PokemonRarity = 'common';
      if (rand < 3) targetRarity = 'legendary';
      else if (rand < 12) targetRarity = 'epic';
      else if (rand < 35) targetRarity = 'rare';
      else targetRarity = 'common';

      // Pick random card of target rarity
      const candidates = POKEMON_CATALOG.filter((c) => c.rarity === targetRarity);
      const chosenDef = candidates[Math.floor(Math.random() * candidates.length)] || POKEMON_CATALOG[0]!;
      const isShiny = Math.random() < 0.06;

      pack.push(this.createInstance(chosenDef.id, isShiny));
    }

    return pack;
  }
}
