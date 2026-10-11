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

export interface ChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

// Piece value mapping for AI evaluation
const PIECE_VALUES: Record<string, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 20000,
};

// Positional bonuses (Piece-Square Tables for positional intelligence)
const PAWN_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

export class CaturGame extends BaseGame {
  readonly gameType = 'catur';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  public initializeState(config: any) {
    const host = this.players[0]!;
    const opponent = this.players[1] || this.players[0]!;

    const preferredColor = config?.preferredColor || 'white'; // 'white' | 'black' | 'random'
    const botDifficulty = config?.botDifficulty || 'medium'; // 'easy' | 'medium' | 'hard'

    let whitePlayer: GamePlayerInfo = host;
    let blackPlayer: GamePlayerInfo = opponent;

    if (preferredColor === 'black') {
      whitePlayer = opponent;
      blackPlayer = host;
    } else if (preferredColor === 'random') {
      if (Math.random() < 0.5) {
        whitePlayer = opponent;
        blackPlayer = host;
      }
    }

    // 8x8 standard chess board
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
      botDifficulty,
      preferredColor,
      moveHistory: [] as string[],
      capturedWhite: [] as string[],
      capturedBlack: [] as string[],
      winnerId: null as string | null,
      isFinished: false,
    };
  }

  public override replacePlayer(oldUserId: string, newPlayer: GamePlayerInfo): boolean {
    const ok = super.replacePlayer(oldUserId, newPlayer);
    if (ok) {
      if (this.state.whitePlayerId === oldUserId) {
        this.state.whitePlayerId = newPlayer.user_id;
      }
      if (this.state.blackPlayerId === oldUserId) {
        this.state.blackPlayerId = newPlayer.user_id;
      }
    }
    return ok;
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

      // Check if the move is in the list of legal moves
      const legalMoves = this.getValidMoves(userId);
      const isLegal = legalMoves.some(
        (m) => m.fromRow === fromRow && m.fromCol === fromCol && m.toRow === toRow && m.toCol === toCol
      );

      if (!isLegal) {
        return { success: false, error: 'Langkah catur tersebut tidak sah menurut aturan.' };
      }

      const destPiece = this.state.board[toRow]![toCol]!;

      // Record capture
      if (destPiece) {
        if (destPiece.charAt(0) === 'w') {
          this.state.capturedWhite.push(destPiece);
        } else {
          this.state.capturedBlack.push(destPiece);
        }

        // Win immediately if King captured
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

      // Pawn promotion to Queen on opposite baseline
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

    // Dynamic points according to bot difficulty / match type
    const hasBot = this.players.some((p) => p.is_bot);
    let pointsAwarded = 50; // standard human vs human
    if (hasBot) {
      const diff = this.state.botDifficulty || 'medium';
      if (diff === 'easy') {
        pointsAwarded = 15;
      } else if (diff === 'medium') {
        pointsAwarded = 35;
      } else if (diff === 'hard') {
        pointsAwarded = 60;
      }
    }

    return {
      winners: [winner],
      losers,
      scores: {
        [this.state.whitePlayerId]: winner === this.state.whitePlayerId ? 1 : 0,
        [this.state.blackPlayerId]: winner === this.state.blackPlayerId ? 1 : 0,
      },
      summary: winner === this.state.whitePlayerId ? 'Bidak Putih Menang!' : 'Bidak Hitam Menang!',
      pointsAwarded,
    };
  }

  // Generate all legal moves for current player
  public getValidMoves(userId: string): ChessMove[] {
    if (this.state.currentTurn !== userId) return [];
    const color = this.state.turnColor;
    return this.generateMovesForColor(this.state.board, color);
  }

  private generateMovesForColor(board: ChessPiece[][], color: 'w' | 'b'): ChessMove[] {
    const moves: ChessMove[] = [];
    const oppColor = color === 'w' ? 'b' : 'w';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r]![c]!;
        if (!piece || piece.charAt(0) !== color) continue;

        const pieceType = piece.charAt(1);

        // 1. PAWN (P)
        if (pieceType === 'P') {
          const dir = color === 'w' ? -1 : 1;
          const startRow = color === 'w' ? 6 : 1;

          // One square forward
          const fRow = r + dir;
          if (fRow >= 0 && fRow < 8 && !board[fRow]![c]) {
            moves.push({ fromRow: r, fromCol: c, toRow: fRow, toCol: c });

            // Two squares forward from initial row
            const ffRow = r + 2 * dir;
            if (r === startRow && !board[ffRow]![c]) {
              moves.push({ fromRow: r, fromCol: c, toRow: ffRow, toCol: c });
            }
          }

          // Diagonal captures
          for (const dc of [-1, 1]) {
            const capCol = c + dc;
            if (fRow >= 0 && fRow < 8 && capCol >= 0 && capCol < 8) {
              const target = board[fRow]![capCol];
              if (target && target.charAt(0) === oppColor) {
                moves.push({ fromRow: r, fromCol: c, toRow: fRow, toCol: capCol });
              }
            }
          }
        }

        // 2. KNIGHT (N)
        if (pieceType === 'N') {
          const knightDirs = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1],
          ];
          for (const [dr, dc] of knightDirs) {
            const nr = r + dr!;
            const nc = c + dc!;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              const target = board[nr]![nc];
              if (!target || target.charAt(0) === oppColor) {
                moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
              }
            }
          }
        }

        // 3. BISHOP (B)
        if (pieceType === 'B') {
          const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
          for (const [dr, dc] of diagDirs) {
            let step = 1;
            while (true) {
              const nr = r + dr! * step;
              const nc = c + dc! * step;
              if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
              const target = board[nr]![nc];
              if (!target) {
                moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
              } else {
                if (target.charAt(0) === oppColor) {
                  moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
                }
                break;
              }
              step++;
            }
          }
        }

        // 4. ROOK (R)
        if (pieceType === 'R') {
          const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          for (const [dr, dc] of straightDirs) {
            let step = 1;
            while (true) {
              const nr = r + dr! * step;
              const nc = c + dc! * step;
              if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
              const target = board[nr]![nc];
              if (!target) {
                moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
              } else {
                if (target.charAt(0) === oppColor) {
                  moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
                }
                break;
              }
              step++;
            }
          }
        }

        // 5. QUEEN (Q)
        if (pieceType === 'Q') {
          const allDirs = [
            [-1, -1], [-1, 1], [1, -1], [1, 1],
            [-1, 0], [1, 0], [0, -1], [0, 1],
          ];
          for (const [dr, dc] of allDirs) {
            let step = 1;
            while (true) {
              const nr = r + dr! * step;
              const nc = c + dc! * step;
              if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
              const target = board[nr]![nc];
              if (!target) {
                moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
              } else {
                if (target.charAt(0) === oppColor) {
                  moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
                }
                break;
              }
              step++;
            }
          }
        }

        // 6. KING (K)
        if (pieceType === 'K') {
          const kingDirs = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1],
          ];
          for (const [dr, dc] of kingDirs) {
            const nr = r + dr!;
            const nc = c + dc!;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              const target = board[nr]![nc];
              if (!target || target.charAt(0) === oppColor) {
                moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
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

  // Bot AI automated intelligence
  public getBotAction(userId: string): { action: string; payload: any } | null {
    const moves = this.getValidMoves(userId);
    if (moves.length === 0) return null;

    const diff = this.state.botDifficulty || 'medium';
    const color = this.state.turnColor;

    // --- LEVEL 1: EASY (Pemula) ---
    // 50% random, 50% captures
    if (diff === 'easy') {
      const captures = moves.filter((m) => Boolean(this.state.board[m.toRow]![m.toCol]));
      if (captures.length > 0 && Math.random() < 0.5) {
        const move = captures[Math.floor(Math.random() * captures.length)]!;
        return { action: 'move', payload: move };
      }
      const move = moves[Math.floor(Math.random() * moves.length)]!;
      return { action: 'move', payload: move };
    }

    // --- LEVEL 2: MEDIUM (Menengah) ---
    // Greedy captures + center control + king check
    if (diff === 'medium') {
      let bestScore = -Infinity;
      let bestMove = moves[0]!;

      for (const m of moves) {
        let score = 0;
        const targetPiece = this.state.board[m.toRow]![m.toCol];
        const movingPiece = this.state.board[m.fromRow]![m.fromCol];

        if (targetPiece) {
          const targetVal = PIECE_VALUES[targetPiece.charAt(1)] || 100;
          const movingVal = movingPiece ? PIECE_VALUES[movingPiece.charAt(1)] || 100 : 100;
          score += targetVal * 2 - movingVal * 0.5;
        }

        // Center control incentive
        if ([3, 4].includes(m.toRow) && [3, 4].includes(m.toCol)) {
          score += 25;
        }

        // Add small random noise for variety
        score += Math.random() * 10;

        if (score > bestScore) {
          bestScore = score;
          bestMove = m;
        }
      }
      return { action: 'move', payload: bestMove };
    }

    // --- LEVEL 3: HARD / MASTER (Master AI) ---
    // 2-ply Minimax evaluation with piece-square tables
    let bestScore = -Infinity;
    let bestMove = moves[0]!;

    for (const m of moves) {
      // Simulate move
      const originalDest = this.state.board[m.toRow]![m.toCol];
      const movingPiece = this.state.board[m.fromRow]![m.fromCol];

      this.state.board[m.toRow]![m.toCol] = movingPiece;
      this.state.board[m.fromRow]![m.fromCol] = null;

      // Opponent response evaluation (Minimax 1-ply counter)
      const oppColor = color === 'w' ? 'b' : 'w';
      const oppMoves = this.generateMovesForColor(this.state.board, oppColor);

      let worstCounter = 0;
      for (const om of oppMoves) {
        const oppTarget = this.state.board[om.toRow]![om.toCol];
        if (oppTarget) {
          const capVal = PIECE_VALUES[oppTarget.charAt(1)] || 100;
          if (capVal > worstCounter) worstCounter = capVal;
        }
      }

      // Static Board Evaluation from Bot's perspective
      const evalScore = this.evaluateBoard(this.state.board, color) - worstCounter;

      // Restore board
      this.state.board[m.fromRow]![m.fromCol] = movingPiece;
      this.state.board[m.toRow]![m.toCol] = originalDest;

      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestMove = m;
      }
    }

    return { action: 'move', payload: bestMove };
  }

  // Board evaluation heuristic for Master AI
  private evaluateBoard(board: ChessPiece[][], myColor: 'w' | 'b'): number {
    let score = 0;
    const oppColor = myColor === 'w' ? 'b' : 'w';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r]![c];
        if (!piece) continue;

        const pColor = piece.charAt(0);
        const pType = piece.charAt(1);
        const val = PIECE_VALUES[pType] || 100;

        let positional = 0;
        if (pType === 'P') {
          positional = pColor === 'w' ? PAWN_TABLE[r]![c]! : PAWN_TABLE[7 - r]![c]!;
        } else if (pType === 'N') {
          positional = KNIGHT_TABLE[r]![c]!;
        }

        const totalVal = val + positional;

        if (pColor === myColor) {
          score += totalVal;
        } else if (pColor === oppColor) {
          score -= totalVal;
        }
      }
    }

    return score;
  }
}
