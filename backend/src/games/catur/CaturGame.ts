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

// Full Piece-Square Tables (White's perspective; inverted for Black)
const PAWN_TABLE = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [ 5,  5, 10, 27, 27, 10,  5,  5],
  [ 0,  0,  0, 25, 25,  0,  0,  0],
  [ 5, -5,-10,  0,  0,-10, -5,  5],
  [ 5, 10, 10,-20,-20, 10, 10,  5],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
];

const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],
];

const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20],
];

const ROOK_TABLE = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [ 5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [ 0,  0,  0,  5,  5,  0,  0,  0],
];

const QUEEN_TABLE = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20],
];

const KING_TABLE_MID = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20],
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
    // Row 0 is Black's pieces (Rank 8)
    // Row 7 is White's pieces (Rank 1)
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
      currentTurn: whitePlayer.user_id, // White always moves first
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
        return { success: false, error: 'Langkah catur tersebut tidak sah atau membuat raja dalam posisi skak.' };
      }

      const destPiece = this.state.board[toRow]![toCol]!;

      // Record capture
      if (destPiece) {
        if (destPiece.charAt(0) === 'w') {
          this.state.capturedWhite.push(destPiece);
        } else {
          this.state.capturedBlack.push(destPiece);
        }

        // Win immediately if King captured (fallback safety)
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
        const nextColor = this.state.turnColor === 'w' ? 'b' : 'w';
        const nextPlayerId = nextColor === 'w' ? this.state.whitePlayerId : this.state.blackPlayerId;
        this.state.turnColor = nextColor;
        this.state.currentTurn = nextPlayerId;

        // Check if next player has any legal moves (Checkmate / Stalemate detection)
        const nextMoves = this.generateLegalMoves(this.state.board, nextColor);
        if (nextMoves.length === 0) {
          const inCheck = this.isKingInCheck(this.state.board, nextColor);
          this.state.isFinished = true;
          if (inCheck) {
            // Checkmate! Current player wins!
            this.state.winnerId = userId;
          } else {
            // Stalemate (Draw)
            this.state.winnerId = null;
          }
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
    const isWhiteTurn = this.state.turnColor === 'w';
    const activeColor = this.state.turnColor;
    const inCheck = this.isKingInCheck(this.state.board, activeColor);

    return {
      ...this.state,
      gameType: 'catur',
      inCheck,
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
    const winner = this.state.winnerId;
    const playerIds = [this.state.whitePlayerId, this.state.blackPlayerId];
    const winners = winner ? [winner] : [];
    const losers = winner ? playerIds.filter((id) => id !== winner) : [];

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

    const winnerName = winner === this.state.whitePlayerId ? 'Bidak Putih' : winner === this.state.blackPlayerId ? 'Bidak Hitam' : 'Permainan Seri';

    return {
      winners,
      losers,
      scores: {
        [this.state.whitePlayerId]: winner === this.state.whitePlayerId ? 1 : 0,
        [this.state.blackPlayerId]: winner === this.state.blackPlayerId ? 1 : 0,
      },
      summary: winner ? `Skakmat! ${winnerName} Memenangkan Pertandingan!` : 'Permainan Berakhir Remis (Stalemate)!',
      pointsAwarded: winner ? pointsAwarded : 0,
    };
  }

  // Generate legal moves that do NOT leave the King in check
  public getValidMoves(userId: string): ChessMove[] {
    if (this.state.currentTurn !== userId) return [];
    return this.generateLegalMoves(this.state.board, this.state.turnColor);
  }

  public generateLegalMoves(board: ChessPiece[][], color: 'w' | 'b'): ChessMove[] {
    const pseudoMoves = this.generatePseudoMoves(board, color);
    const legalMoves: ChessMove[] = [];

    for (const move of pseudoMoves) {
      // Simulate move
      const originalDest = board[move.toRow]![move.toCol];
      const movingPiece = board[move.fromRow]![move.fromCol];

      board[move.toRow]![move.toCol] = movingPiece;
      board[move.fromRow]![move.fromCol] = null;

      // Ensure King is not under check after this move
      if (!this.isKingInCheck(board, color)) {
        legalMoves.push(move);
      }

      // Revert simulation
      board[move.fromRow]![move.fromCol] = movingPiece;
      board[move.toRow]![move.toCol] = originalDest;
    }

    return legalMoves;
  }

  // Check if a specific square is under attack by opponent
  public isSquareAttacked(board: ChessPiece[][], row: number, col: number, byColor: 'w' | 'b'): boolean {
    const oppColor = byColor;

    // 1. Pawns attack
    const pawnRow = byColor === 'w' ? row + 1 : row - 1;
    if (pawnRow >= 0 && pawnRow < 8) {
      if (col - 1 >= 0 && board[pawnRow]![col - 1] === `${oppColor}P`) return true;
      if (col + 1 < 8 && board[pawnRow]![col + 1] === `${oppColor}P`) return true;
    }

    // 2. Knights attack
    const knightDirs = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ];
    for (const [dr, dc] of knightDirs) {
      const nr = row + dr!;
      const nc = col + dc!;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        if (board[nr]![nc] === `${oppColor}N`) return true;
      }
    }

    // 3. Diagonal rays (Bishop & Queen)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagDirs) {
      let step = 1;
      while (true) {
        const nr = row + dr! * step;
        const nc = col + dc! * step;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
        const piece = board[nr]![nc];
        if (piece) {
          if (piece === `${oppColor}B` || piece === `${oppColor}Q`) return true;
          break;
        }
        step++;
      }
    }

    // 4. Orthogonal rays (Rook & Queen)
    const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of straightDirs) {
      let step = 1;
      while (true) {
        const nr = row + dr! * step;
        const nc = col + dc! * step;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
        const piece = board[nr]![nc];
        if (piece) {
          if (piece === `${oppColor}R` || piece === `${oppColor}Q`) return true;
          break;
        }
        step++;
      }
    }

    // 5. Adjacent King
    const kingDirs = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1],
    ];
    for (const [dr, dc] of kingDirs) {
      const nr = row + dr!;
      const nc = col + dc!;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        if (board[nr]![nc] === `${oppColor}K`) return true;
      }
    }

    return false;
  }

  // Check if king of a given color is in check
  public isKingInCheck(board: ChessPiece[][], color: 'w' | 'b'): boolean {
    const kingPiece = `${color}K`;
    let kr = -1;
    let kc = -1;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r]![c] === kingPiece) {
          kr = r;
          kc = c;
          break;
        }
      }
      if (kr !== -1) break;
    }

    if (kr === -1) return false;
    const oppColor = color === 'w' ? 'b' : 'w';
    return this.isSquareAttacked(board, kr, kc, oppColor);
  }

  // Generate pseudo-legal moves based on geometry
  private generatePseudoMoves(board: ChessPiece[][], color: 'w' | 'b'): ChessMove[] {
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

  // --- BOT AI BRAIN (Smarter, Tactical, Non-Blundering Chess AI) ---
  public getBotAction(userId: string): { action: string; payload: any } | null {
    const moves = this.getValidMoves(userId);
    if (moves.length === 0) return null;

    const diff = this.state.botDifficulty || 'medium';
    const myColor = this.state.turnColor;
    const oppColor = myColor === 'w' ? 'b' : 'w';

    // --- LEVEL 1: EASY (Pemula) ---
    // Mostly basic evaluations with intentional small noise
    if (diff === 'easy') {
      let bestScore = -Infinity;
      let bestMove = moves[0]!;

      for (const m of moves) {
        let score = (Math.random() - 0.5) * 40;
        const target = this.state.board[m.toRow]![m.toCol];
        if (target) {
          score += (PIECE_VALUES[target.charAt(1)] || 100);
        }
        if (score > bestScore) {
          bestScore = score;
          bestMove = m;
        }
      }
      return { action: 'move', payload: bestMove };
    }

    // --- LEVEL 2: MEDIUM (Menengah - Solid Tactical Play, No Dumb Blunders) ---
    if (diff === 'medium') {
      let bestScore = -Infinity;
      let bestMove = moves[0]!;

      for (const m of moves) {
        const movingPiece = this.state.board[m.fromRow]![m.fromCol]!;
        const targetPiece = this.state.board[m.toRow]![m.toCol];
        const movingVal = PIECE_VALUES[movingPiece.charAt(1)] || 100;
        const targetVal = targetPiece ? (PIECE_VALUES[targetPiece.charAt(1)] || 100) : 0;

        // Simulate move
        this.state.board[m.toRow]![m.toCol] = movingPiece;
        this.state.board[m.fromRow]![m.fromCol] = null;

        // 1. Immediate Win Check (Checkmate)
        const oppReplies = this.generateLegalMoves(this.state.board, oppColor);
        if (oppReplies.length === 0 && this.isKingInCheck(this.state.board, oppColor)) {
          // Checkmate! Win immediately!
          this.state.board[m.fromRow]![m.fromCol] = movingPiece;
          this.state.board[m.toRow]![m.toCol] = targetPiece;
          return { action: 'move', payload: m };
        }

        // 2. Base Evaluation
        let score = this.evaluateBoard(this.state.board, myColor);

        // 3. Tactical safety check: Is the square we moved to attacked?
        const isTargetSquareAttacked = this.isSquareAttacked(this.state.board, m.toRow, m.toCol, oppColor);
        const isTargetSquareDefended = this.isSquareAttacked(this.state.board, m.toRow, m.toCol, myColor);

        if (isTargetSquareAttacked) {
          if (!isTargetSquareDefended) {
            // Unconditionally hanging our piece! Heavy penalty!
            score -= movingVal * 2.5;
          } else {
            // Defended, but if we sacrificed high value for low value (e.g. Q for P)
            if (movingVal > targetVal) {
              score -= (movingVal - targetVal) * 1.5;
            }
          }
        }

        // 4. Capture bonus (MVV-LVA)
        if (targetPiece) {
          score += targetVal * 1.5 - movingVal * 0.1;
        }

        // 5. Check bonus
        if (this.isKingInCheck(this.state.board, oppColor)) {
          score += 55;
        }

        // 6. Promotion bonus
        if (movingPiece.charAt(1) === 'P' && (m.toRow === 0 || m.toRow === 7)) {
          score += 850;
        }

        // Small variety noise
        score += Math.random() * 6;

        // Restore board
        this.state.board[m.fromRow]![m.fromCol] = movingPiece;
        this.state.board[m.toRow]![m.toCol] = targetPiece;

        if (score > bestScore) {
          bestScore = score;
          bestMove = m;
        }
      }

      return { action: 'move', payload: bestMove };
    }

    // --- LEVEL 3: HARD / MASTER (Deep Minimax with Alpha-Beta Pruning) ---
    let bestScore = -Infinity;
    let bestMove = moves[0]!;
    const depth = 3;

    // Sort moves for Alpha-Beta efficiency (captures and checks first)
    const sortedMoves = [...moves].sort((a, b) => {
      const aCap = Boolean(this.state.board[a.toRow]![a.toCol]) ? 100 : 0;
      const bCap = Boolean(this.state.board[b.toRow]![b.toCol]) ? 100 : 0;
      return bCap - aCap;
    });

    for (const m of sortedMoves) {
      const originalDest = this.state.board[m.toRow]![m.toCol];
      const movingPiece = this.state.board[m.fromRow]![m.fromCol]!;

      // Simulate
      this.state.board[m.toRow]![m.toCol] = movingPiece;
      this.state.board[m.fromRow]![m.fromCol] = null;

      const evalScore = this.minimax(this.state.board, depth - 1, -Infinity, Infinity, false, myColor);

      // Revert
      this.state.board[m.fromRow]![m.fromCol] = movingPiece;
      this.state.board[m.toRow]![m.toCol] = originalDest;

      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestMove = m;
      }
    }

    return { action: 'move', payload: bestMove };
  }

  // Minimax with Alpha-Beta Pruning
  private minimax(
    board: ChessPiece[][],
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    botColor: 'w' | 'b'
  ): number {
    const currentColor = isMaximizing ? botColor : (botColor === 'w' ? 'b' : 'w');
    const legalMoves = this.generateLegalMoves(board, currentColor);

    // Terminal state: Checkmate or Stalemate
    if (legalMoves.length === 0) {
      if (this.isKingInCheck(board, currentColor)) {
        return isMaximizing ? -100000 + (3 - depth) * 100 : 100000 - (3 - depth) * 100;
      }
      return 0; // Stalemate
    }

    if (depth <= 0) {
      return this.evaluateBoard(board, botColor);
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const m of legalMoves) {
        const dest = board[m.toRow]![m.toCol];
        const piece = board[m.fromRow]![m.fromCol]!;

        board[m.toRow]![m.toCol] = piece;
        board[m.fromRow]![m.fromCol] = null;

        const score = this.minimax(board, depth - 1, alpha, beta, false, botColor);

        board[m.fromRow]![m.fromCol] = piece;
        board[m.toRow]![m.toCol] = dest;

        maxEval = Math.max(maxEval, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Beta cutoff
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of legalMoves) {
        const dest = board[m.toRow]![m.toCol];
        const piece = board[m.fromRow]![m.fromCol]!;

        board[m.toRow]![m.toCol] = piece;
        board[m.fromRow]![m.fromCol] = null;

        const score = this.minimax(board, depth - 1, alpha, beta, true, botColor);

        board[m.fromRow]![m.fromCol] = piece;
        board[m.toRow]![m.toCol] = dest;

        minEval = Math.min(minEval, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break; // Alpha cutoff
      }
      return minEval;
    }
  }

  // Board evaluation function
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
        const rowIdx = pColor === 'w' ? r : 7 - r;

        if (pType === 'P') {
          positional = PAWN_TABLE[rowIdx]![c]!;
        } else if (pType === 'N') {
          positional = KNIGHT_TABLE[rowIdx]![c]!;
        } else if (pType === 'B') {
          positional = BISHOP_TABLE[rowIdx]![c]!;
        } else if (pType === 'R') {
          positional = ROOK_TABLE[rowIdx]![c]!;
        } else if (pType === 'Q') {
          positional = QUEEN_TABLE[rowIdx]![c]!;
        } else if (pType === 'K') {
          positional = KING_TABLE_MID[rowIdx]![c]!;
        }

        const totalVal = val + positional;

        if (pColor === myColor) {
          score += totalVal;
          // Check for hanging pieces
          if (this.isSquareAttacked(board, r, c, oppColor)) {
            const isDefended = this.isSquareAttacked(board, r, c, myColor);
            if (!isDefended) {
              score -= val * 0.8;
            }
          }
        } else {
          score -= totalVal;
          // Check for opponent hanging pieces (reward attacking them)
          if (this.isSquareAttacked(board, r, c, myColor)) {
            const isDefended = this.isSquareAttacked(board, r, c, oppColor);
            if (!isDefended) {
              score += val * 0.7;
            }
          }
        }
      }
    }

    return score;
  }
}
