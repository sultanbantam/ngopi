import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PokemonCatalog } from '../games/pokemon/PokemonCatalog';
import { PokemonCardDef, PokemonCardInstance } from '../games/pokemon/types';
import { PointsManager } from '../utils/pointsManager';

const STORAGE_FILE = path.join(__dirname, '../../uploads/pokemon_storage.json');

export interface UserCardItem {
  id: string; // unique item id
  defId: string;
  name: string;
  type: string;
  rarity: string;
  isShiny: boolean;
  quantity: number;
  acquiredAt: string;
}

export interface PokemonTradeOffer {
  id: string;
  initiatorId: string;
  initiatorName: string;
  receiverId?: string; // empty means public trade board
  receiverName?: string;
  offerCardDefIds: string[];
  requestCardDefIds: string[];
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

interface PokemonStorageData {
  collections: Record<string, UserCardItem[]>; // userId -> cards
  trades: PokemonTradeOffer[];
}

const loadStorage = (): PokemonStorageData => {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn('Failed to load pokemon storage, using fallback:', e);
  }
  return { collections: {}, trades: [] };
};

const saveStorage = (data: PokemonStorageData) => {
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save pokemon storage:', e);
  }
};

const memoryStore = loadStorage();

export class PokemonService {
  /**
   * Get all card definitions from the catalog
   */
  public static getCatalog(): PokemonCardDef[] {
    return PokemonCatalog.getAll();
  }

  /**
   * Get user collection. If empty, give free starter cards!
   */
  public static getUserCollection(userId: string, username = 'Pelatih'): { cards: UserCardItem[]; points: number } {
    if (!memoryStore.collections[userId] || memoryStore.collections[userId]!.length === 0) {
      // Grant starter cards
      const starterDeck = PokemonCatalog.getStarterTeam();
      const items: UserCardItem[] = starterDeck.map((c) => ({
        id: `card_${crypto.randomUUID().slice(0, 8)}`,
        defId: c.defId,
        name: c.name,
        type: c.type,
        rarity: c.rarity,
        isShiny: c.isShiny,
        quantity: 1,
        acquiredAt: new Date().toISOString(),
      }));

      memoryStore.collections[userId] = items;
      saveStorage(memoryStore);
    }

    const points = PointsManager.getPoints(username) || PointsManager.getPoints(userId);
    return {
      cards: memoryStore.collections[userId] || [],
      points,
    };
  }

  /**
   * Open booster pack of 3 cards (cost: 100 points, or free if first pack)
   */
  public static openBoosterPack(userId: string, username = 'Pelatih'): { success: boolean; error?: string; cards?: PokemonCardInstance[]; remainingPoints?: number } {
    const currentPoints = PointsManager.getPoints(username) || PointsManager.getPoints(userId);
    const userCards = this.getUserCollection(userId, username).cards;

    // Check cost (free if under 3 cards, otherwise 100 points)
    const cost = userCards.length <= 3 ? 0 : 100;
    if (cost > 0 && currentPoints < cost) {
      return {
        success: false,
        error: `Poin tidak mencukupi! Butuh ${cost} Poin Ngopi untuk membuka paket booster (Saldo: ${currentPoints}). Mainkan game untuk mendapat poin!`,
      };
    }

    // Deduct points if cost > 0
    let updatedPoints = currentPoints;
    if (cost > 0) {
      updatedPoints = PointsManager.addPoints(username || userId, -cost);
    }

    // Open pack
    const pulledCards = PokemonCatalog.openBoosterPack();

    // Add to collection
    const collection = memoryStore.collections[userId] || [];
    for (const card of pulledCards) {
      const existing = collection.find((item) => item.defId === card.defId && item.isShiny === card.isShiny);
      if (existing) {
        existing.quantity += 1;
      } else {
        collection.push({
          id: `card_${crypto.randomUUID().slice(0, 8)}`,
          defId: card.defId,
          name: card.name,
          type: card.type,
          rarity: card.rarity,
          isShiny: card.isShiny,
          quantity: 1,
          acquiredAt: new Date().toISOString(),
        });
      }
    }

    memoryStore.collections[userId] = collection;
    saveStorage(memoryStore);

    return {
      success: true,
      cards: pulledCards,
      remainingPoints: updatedPoints,
    };
  }

  /**
   * Create trade offer
   */
  public static createTrade(
    initiatorId: string,
    initiatorName: string,
    offerCardDefIds: string[],
    requestCardDefIds: string[],
    receiverId?: string,
    receiverName?: string
  ): { success: boolean; error?: string; trade?: PokemonTradeOffer } {
    if (!offerCardDefIds.length || !requestCardDefIds.length) {
      return { success: false, error: 'Harus memilih minimal 1 kartu yang ditawarkan dan diminta.' };
    }

    // Verify initiator owns the offered cards
    const collection = memoryStore.collections[initiatorId] || [];
    for (const defId of offerCardDefIds) {
      const item = collection.find((c) => c.defId === defId && c.quantity > 0);
      if (!item) {
        return { success: false, error: `Anda tidak memiliki kartu ${defId} untuk ditawarkan.` };
      }
    }

    const trade: PokemonTradeOffer = {
      id: `trade_${crypto.randomUUID().slice(0, 8)}`,
      initiatorId,
      initiatorName,
      receiverId,
      receiverName,
      offerCardDefIds,
      requestCardDefIds,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    memoryStore.trades.unshift(trade);
    saveStorage(memoryStore);

    return { success: true, trade };
  }

  /**
   * Respond to trade (accept / decline / cancel)
   */
  public static respondTrade(tradeId: string, respondentId: string, accept: boolean): { success: boolean; error?: string; trade?: PokemonTradeOffer } {
    const trade = memoryStore.trades.find((t) => t.id === tradeId);
    if (!trade) {
      return { success: false, error: 'Tawaran tukar tidak ditemukan.' };
    }

    if (trade.status !== 'pending') {
      return { success: false, error: `Tawaran ini sudah berstatus ${trade.status}.` };
    }

    if (respondentId === trade.initiatorId) {
      // Initiator canceling their own trade
      trade.status = 'cancelled';
      saveStorage(memoryStore);
      return { success: true, trade };
    }

    if (!accept) {
      trade.status = 'declined';
      saveStorage(memoryStore);
      return { success: true, trade };
    }

    // Accept trade: Verify receiver has the requested cards
    const receiverCollection = memoryStore.collections[respondentId] || [];
    for (const defId of trade.requestCardDefIds) {
      const item = receiverCollection.find((c) => c.defId === defId && c.quantity > 0);
      if (!item) {
        return { success: false, error: 'Anda tidak memiliki kartu yang diminta oleh penawar.' };
      }
    }

    // Verify initiator still has offered cards
    const initiatorCollection = memoryStore.collections[trade.initiatorId] || [];
    for (const defId of trade.offerCardDefIds) {
      const item = initiatorCollection.find((c) => c.defId === defId && c.quantity > 0);
      if (!item) {
        return { success: false, error: 'Penawar sudah tidak memiliki kartu yang ditawarkan.' };
      }
    }

    // Transfer cards:
    // Deduct offer from initiator and add to receiver
    for (const defId of trade.offerCardDefIds) {
      const initItem = initiatorCollection.find((c) => c.defId === defId && c.quantity > 0);
      if (initItem) initItem.quantity -= 1;

      const recItem = receiverCollection.find((c) => c.defId === defId);
      if (recItem) recItem.quantity += 1;
      else {
        const def = PokemonCatalog.getById(defId);
        receiverCollection.push({
          id: `card_${crypto.randomUUID().slice(0, 8)}`,
          defId,
          name: def?.name || 'Monster',
          type: def?.type || 'fire',
          rarity: def?.rarity || 'common',
          isShiny: false,
          quantity: 1,
          acquiredAt: new Date().toISOString(),
        });
      }
    }

    // Deduct request from receiver and add to initiator
    for (const defId of trade.requestCardDefIds) {
      const recItem = receiverCollection.find((c) => c.defId === defId && c.quantity > 0);
      if (recItem) recItem.quantity -= 1;

      const initItem = initiatorCollection.find((c) => c.defId === defId);
      if (initItem) initItem.quantity += 1;
      else {
        const def = PokemonCatalog.getById(defId);
        initiatorCollection.push({
          id: `card_${crypto.randomUUID().slice(0, 8)}`,
          defId,
          name: def?.name || 'Monster',
          type: def?.type || 'fire',
          rarity: def?.rarity || 'common',
          isShiny: false,
          quantity: 1,
          acquiredAt: new Date().toISOString(),
        });
      }
    }

    trade.status = 'accepted';
    trade.receiverId = respondentId;
    saveStorage(memoryStore);

    return { success: true, trade };
  }

  /**
   * Get list of trades
   */
  public static getTrades(userId?: string): PokemonTradeOffer[] {
    if (!userId) return memoryStore.trades.slice(0, 30);
    return memoryStore.trades.filter(
      (t) => !t.receiverId || t.receiverId === userId || t.initiatorId === userId
    );
  }
}
