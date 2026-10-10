import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';

export type ChessPiece =
  | 'wP' | 'wR' | 'wN' | 'wB' | 'wQ' | 'wK'
  | 'bP' | 'bR' | 'bN' | 'bB' | 'bQ' | 'bK'
  | null;

export interface ChessBoardSquare {
  row: number; // 0 to 7
  col: number; // 0 to 7
  piece: ChessPiece;
}

export class CaturGame extends BaseGame {
  readonly gameType = 'catur';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  public initializeState(_config: any) {
    const whitePlayer = this.players[0]!;
    const blackPlayer = this.players[1] || this.players[0]!;

    // 8x8 initial board
    const board: ChessPiece[][] = [
      ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
      ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
      ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'],
    ];

    return {
      board,
      whitePlayerId: whitePlayer.user_id,
      blackPlayerId: blackPlayer.user_id,
      currentTurn: whitePlayer.user_id,
      turnColor: 'w' as 'w' | 'b',
      moveHistory: [] as string[],
      capturedWhite: [] as string[],
      capturedBlack: [] as string[],
      winnerId: null as string | null,
      isFinished: false,
    };
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.isFinished) {
      return { success: false, error: 'Permainan catur sudah selesai.' };
    }

    if (this.state.currentTurn !== userId) {
      return { success: false, error: 'Bukan giliran Anda.' };
    }

    if (action === 'move') {
      const { fromRow, fromCol, toRow, toCol } = payload;
      if (
        fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7 ||
        toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7
      ) {
        return { success: false, error: 'Posisi bidak di luar papan.' };
      }

      const piece = this.state.board[fromRow]![fromCol]!;
      if (!piece) {
        return { success: false, error: 'Tidak ada bidak di kotak asal.' };
      }

      const pieceColor = piece.charAt(0);
      if (pieceColor !== this.state.turnColor) {
        return { success: false, error: 'Hanya bisa menggerakkan bidak warna Anda.' };
      }

      const destPiece = this.state.board[toRow]![toCol]!;
      if (destPiece && destPiece.charAt(0) === pieceColor) {
        return { success: false, error: 'Tidak bisa memakan bidak sendiri.' };
      }

      // Record capture
      if (destPiece) {
        if (destPiece.charAt(0) === 'w') {
          this.state.capturedWhite.push(destPiece);
        } else {
          this.state.capturedBlack.push(destPiece);
        }

        // Win if King captured
        if (destPiece === 'wK') {
          this.state.winnerId = this.state.blackPlayerId;
          this.state.isFinished = true;
        } else if (destPiece === 'bK') {
          this.state.winnerId = this.state.whitePlayerId;
          this.state.isFinished = true;
        }
      }

      // Execute Move
      this.state.board[toRow]![toCol] = piece;
      this.state.board[fromRow]![fromCol] = null;

      // Pawn promotion to Queen on last rank
      if (piece === 'wP' && toRow === 0) {
        this.state.board[toRow]![toCol] = 'wQ';
      } else if (piece === 'bP' && toRow === 7) {
        this.state.board[toRow]![toCol] = 'bQ';
      }

      this.state.moveHistory.push(`${piece} (${fromRow},${fromCol}) -> (${toRow},${toCol})`);

      // Switch turn
      if (!this.state.isFinished) {
        if (this.state.turnColor === 'w') {
          this.state.turnColor = 'b';
          this.state.currentTurn = this.state.blackPlayerId;
        } else {
          this.state.turnColor = 'w';
          this.state.currentTurn = this.state.whitePlayerId;
        }
      }

      return {
        success: true,
        finished: this.state.isFinished,
        results: this.state.isFinished ? this.getResults() : undefined,
      };
    }

    if (action === 'resign') {
      this.state.winnerId =
        userId === this.state.whitePlayerId ? this.state.blackPlayerId : this.state.whitePlayerId;
      this.state.isFinished = true;
      return { success: true, finished: true, results: this.getResults() };
    }

    return { success: false, error: `Aksi "${action}" tidak dikenal di catur.` };
  }

  public getStateForPlayer(_userId: string) {
    return {
      ...this.state,
      gameType: 'catur',
    };
  }

  public getStateForSpectator() {
    return {
      ...this.state,
      gameType: 'catur',
    };
  }

  public isFinished(): boolean {
    return !!this.state.isFinished;
  }

  public getResults(): GameResult {
    const winner = this.state.winnerId || this.players[0]!.user_id;
    const losers = this.players.filter((p) => p.user_id !== winner).map((p) => p.user_id);
    return {
      winners: [winner],
      losers,
      scores: {
        [this.state.whitePlayerId]: winner === this.state.whitePlayerId ? 1 : 0,
        [this.state.blackPlayerId]: winner === this.state.blackPlayerId ? 1 : 0,
      },
      summary: winner === this.state.whitePlayerId ? 'Putih Menang!' : 'Hitam Menang!',
    };
  }

  public getValidMoves(userId: string): any[] {
    if (this.state.currentTurn !== userId) return [];
    const color = this.state.turnColor;
    const moves: any[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.state.board[r]![c]!;
        if (piece && piece.charAt(0) === color) {
          // Pawn moves
          const dir = color === 'w' ? -1 : 1;
          const nr = r + dir;
          if (nr >= 0 && nr < 8 && !this.state.board[nr]![c]) {
            moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: c });
          }
          // Simple captures
          for (const dc of [-1, 1]) {
            const nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              const target = this.state.board[nr]![nc];
              if (target && target.charAt(0) !== color) {
                moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
              }
            }
          }
          // Knight moves
          const knightD = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
          if (piece.charAt(1) === 'N') {
            for (const [dr, dc] of knightD) {
              const kr = r + dr!;
              const kc = c + dc!;
              if (kr >= 0 && kr < 8 && kc >= 0 && kc < 8) {
                const target = this.state.board[kr]![kc];
                if (!target || target.charAt(0) !== color) {
                  moves.push({ fromRow: r, fromCol: c, toRow: kr, toCol: kc });
                }
              }
            }
          }
        }
      }
    }
    return moves;
  }

  public handleTimeout(userId: string): ActionResult {
    const botAction = this.getBotAction(userId);
    if (botAction) {
      return this.handleAction(userId, botAction.action, botAction.payload);
    }
    return { success: false, error: 'Waktu habis.' };
  }

  public getBotAction(userId: string): { action: string; payload: any } | null {
    const moves = this.getValidMoves(userId);
    if (moves.length === 0) return null;
    const move = moves[Math.floor(Math.random() * moves.length)];
    return { action: 'move', payload: move };
  }
}
