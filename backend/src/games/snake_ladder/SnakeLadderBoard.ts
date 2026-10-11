export class SnakeLadderBoard {
  public static readonly TOTAL_CELLS = 100;

  // Tangga resmi dari ngopiv3.md
  public static readonly LADDERS: Record<number, number> = {
    2: 38,
    7: 14,
    8: 31,
    15: 26,
    21: 42,
    28: 84,
    36: 44,
    51: 67,
    71: 91,
    78: 98,
  };

  // Ular resmi dari ngopiv3.md
  public static readonly SNAKES: Record<number, number> = {
    16: 6,
    46: 25,
    49: 11,
    62: 19,
    64: 60,
    74: 53,
    89: 68,
    92: 88,
    95: 75,
    99: 80,
  };

  /**
   * Roll random dice 1 to 6
   */
  public static rollDice(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  /**
   * Hitung posisi setelah lempar dadu dengan aturan mantul (bounce back)
   */
  public static calculateMove(currentPos: number, roll: number): {
    targetPos: number;
    finalPos: number;
    transitionType: 'normal' | 'ladder' | 'snake' | 'bounce';
    message: string;
  } {
    let targetPos = currentPos + roll;
    let transitionType: 'normal' | 'ladder' | 'snake' | 'bounce' = 'normal';
    let message = `Maju ${roll} langkah ke kotak ${targetPos}.`;

    // Rule: Harus tepat di 100. Jika berlebih, pantulkan mundur.
    if (targetPos > this.TOTAL_CELLS) {
      const overshoot = targetPos - this.TOTAL_CELLS;
      targetPos = this.TOTAL_CELLS - overshoot;
      transitionType = 'bounce';
      message = `Memantul dari 100 mundur ${overshoot} langkah ke kotak ${targetPos}.`;
    }

    let finalPos = targetPos;

    // Periksa apakah mendarat di tangga
    if (this.LADDERS[targetPos] !== undefined) {
      finalPos = this.LADDERS[targetPos]!;
      transitionType = 'ladder';
      message = `Naik tangga 🪜 dari kotak ${targetPos} melesat ke kotak ${finalPos}!`;
    }
    // Periksa apakah mendarat di kepala ular
    else if (this.SNAKES[targetPos] !== undefined) {
      finalPos = this.SNAKES[targetPos]!;
      transitionType = 'snake';
      message = `Digigit ular 🐍 di kotak ${targetPos}, melorot turun ke kotak ${finalPos}!`;
    } else if (finalPos === this.TOTAL_CELLS) {
      message = `Tepat mencapai kotak 100! 🏆 Selamat!`;
    }

    return {
      targetPos,
      finalPos,
      transitionType,
      message,
    };
  }
}
