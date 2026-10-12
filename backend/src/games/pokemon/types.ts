export type PokemonElementType = 'fire' | 'water' | 'earth' | 'electric' | 'grass' | 'psychic';

export type PokemonRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PokemonCardDef {
  id: string;
  name: string;
  type: PokemonElementType;
  hp: number;
  attack: number;
  defense: number;
  rarity: PokemonRarity;
  description: string;
  skillName: string;
  skillPower: number;
  skillDescription: string;
  icon: string;
}

export interface PokemonCardInstance {
  instanceId: string;
  defId: string;
  name: string;
  type: PokemonElementType;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  rarity: PokemonRarity;
  skillName: string;
  skillPower: number;
  isShiny: boolean;
  isFainted: boolean;
  icon: string;
}

export interface PokemonPlayerState {
  userId: string;
  username: string;
  team: PokemonCardInstance[]; // 3 cards
  activeIndex: number;
  isReady: boolean;
}

export interface PokemonBattleLogEntry {
  id: string;
  turn: number;
  actorId: string;
  actorName: string;
  action: 'attack' | 'skill' | 'switch' | 'faint' | 'victory';
  message: string;
  damage?: number;
  effectiveness?: 'super' | 'weak' | 'normal';
  timestamp: string;
}

export interface PokemonGameState {
  players: Record<string, PokemonPlayerState>;
  playerOrder: string[];
  currentTurn: string;
  turnNumber: number;
  turnDeadline: number;
  status: 'waiting' | 'in_progress' | 'finished';
  winner: string | null;
  battleLog: PokemonBattleLogEntry[];
  lastAction?: {
    actorId: string;
    action: string;
    message: string;
  };
}
