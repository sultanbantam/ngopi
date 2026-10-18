import { describe, it, expect, beforeEach } from 'vitest';
import { GameStatsService, recordGameMatch, updateGameStats, getTopGames } from '../src/services/gameStats.service';
import { TableManager } from '../src/games/TableManager';

describe('Warkop Game Leaderboard & Statistics', () => {
  beforeEach(() => {
    // Reset test stats
    updateGameStats({
      gapleh: 124,
      catur: 86,
      uno: 58,
      snake_ladder: 49,
      remi: 42,
    });
  });

  it('harus mengembalikan daftar game terpopuler yang terurut berdasarkan jumlah pertandingan', () => {
    const topGames = getTopGames();
    expect(Array.isArray(topGames)).toBe(true);
    expect(topGames.length).toBeGreaterThanOrEqual(5);

    // Verify ordering
    for (let i = 0; i < topGames.length - 1; i++) {
      expect(topGames[i].matchesPlayed).toBeGreaterThanOrEqual(topGames[i + 1].matchesPlayed);
    }

    const gaplehItem = topGames.find((g) => g.id === 'gapleh');
    expect(gaplehItem).toBeDefined();
    expect(gaplehItem?.matchesPlayed).toBeGreaterThanOrEqual(124);
  });

  it('harus dapat menambah jumlah pertandingan saat recordGameMatch dipanggil', () => {
    const initialGames = getTopGames();
    const initialGapleh = initialGames.find((g) => g.id === 'gapleh')?.matchesPlayed || 0;

    const newMatches = recordGameMatch('gapleh', 2);
    expect(newMatches).toBe(initialGapleh + 2);

    const updatedGames = getTopGames();
    const updatedGapleh = updatedGames.find((g) => g.id === 'gapleh')?.matchesPlayed;
    expect(updatedGapleh).toBe(initialGapleh + 2);
  });

  it('harus dapat mengupdate jumlah pertandingan secara kustom via updateGameStats', () => {
    updateGameStats({
      catur: 200,
      monopoly: 150,
    });

    const topGames = getTopGames();
    const caturItem = topGames.find((g) => g.id === 'catur');
    const monopolyItem = topGames.find((g) => g.id === 'monopoly');

    expect(caturItem?.matchesPlayed).toBe(200);
    expect(monopolyItem?.matchesPlayed).toBe(150);
  });

  it('harus otomatis menambah statistik pertandingan saat TableManager.startGame dijalankan', async () => {
    const beforeGames = getTopGames();
    const initialCatur = beforeGames.find((g) => g.id === 'catur')?.matchesPlayed || 0;

    // Create a table and start it
    const table = await TableManager.createTable({
      gameType: 'catur',
      name: 'Meja Tes Klasemen',
      maxPlayers: 2,
      minPlayers: 2,
      host: { id: 'host_test_klasemen', username: 'testhost', display_name: 'Test Host' },
    });

    // Add bot to reach minPlayers
    TableManager.addBot(table.id, 'host_test_klasemen');

    // Start game
    const startRes = TableManager.startGame(table.id, 'host_test_klasemen');
    if (!startRes.success) {
      console.error('START GAME FAILED WITH ERROR:', startRes.error);
    }
    expect(startRes.success).toBe(true);

    const afterGames = getTopGames();
    const afterCatur = afterGames.find((g) => g.id === 'catur')?.matchesPlayed || 0;
    expect(afterCatur).toBe(initialCatur + 1);

    // Clean up
    TableManager.leaveTable(table.id, 'host_test_klasemen');
  });
});
