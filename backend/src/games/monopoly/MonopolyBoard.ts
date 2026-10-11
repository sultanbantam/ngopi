import { MonopolySquare } from './types';

export class MonopolyBoard {
  public static readonly TOTAL_SQUARES = 24;

  public static readonly SQUARES: MonopolySquare[] = [
    { id: 0, name: 'START', type: 'start' },
    { id: 1, name: 'Kopi Tubruk', type: 'property', group: 'brown', price: 60, rentBase: 6, houseCost: 50 },
    { id: 2, name: 'Dana Umum', type: 'community' },
    { id: 3, name: 'Kopi Hitam', type: 'property', group: 'brown', price: 60, rentBase: 6, houseCost: 50 },
    { id: 4, name: 'Pajak Warkop', type: 'tax', taxAmount: 100 },
    { id: 5, name: 'Stasiun Senen', type: 'station', group: 'station', price: 200, rentBase: 25 },
    { id: 6, name: 'Penjara', type: 'jail' },
    { id: 7, name: 'Teh Manis', type: 'property', group: 'light_blue', price: 100, rentBase: 10, houseCost: 50 },
    { id: 8, name: 'Kesempatan', type: 'chance' },
    { id: 9, name: 'Teh Tarik', type: 'property', group: 'light_blue', price: 120, rentBase: 12, houseCost: 50 },
    { id: 10, name: 'PLN Listrik', type: 'utility', group: 'utility', price: 150, rentBase: 20 },
    { id: 11, name: 'Kopi Susu', type: 'property', group: 'pink', price: 140, rentBase: 14, houseCost: 100 },
    { id: 12, name: 'Parkir Santai', type: 'free_parking' },
    { id: 13, name: 'Roti Bakar', type: 'property', group: 'orange', price: 180, rentBase: 18, houseCost: 100 },
    { id: 14, name: 'Dana Umum', type: 'community' },
    { id: 15, name: 'Pisang Goreng', type: 'property', group: 'orange', price: 200, rentBase: 20, houseCost: 100 },
    { id: 16, name: 'Stasiun Gambir', type: 'station', group: 'station', price: 200, rentBase: 25 },
    { id: 17, name: 'Mie Dok-Dok', type: 'property', group: 'red', price: 220, rentBase: 22, houseCost: 150 },
    { id: 18, name: 'Masuk Penjara', type: 'go_to_jail' },
    { id: 19, name: 'Nasi Gila', type: 'property', group: 'yellow', price: 260, rentBase: 26, houseCost: 150 },
    { id: 20, name: 'Kesempatan', type: 'chance' },
    { id: 21, name: 'Nasi Goreng', type: 'property', group: 'yellow', price: 280, rentBase: 28, houseCost: 150 },
    { id: 22, name: 'Pajak Mewah', type: 'tax', taxAmount: 75 },
    { id: 23, name: 'Kopi Luwak', type: 'property', group: 'dark_blue', price: 350, rentBase: 35, houseCost: 200 },
  ];

  public static getSquare(id: number): MonopolySquare {
    return this.SQUARES[id % this.TOTAL_SQUARES] || this.SQUARES[0]!;
  }

  public static getGroupSquares(group: string): MonopolySquare[] {
    return this.SQUARES.filter((s) => s.group === group);
  }

  public static rollDice(): [number, number] {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    return [d1, d2];
  }

  public static calculateRent(
    square: MonopolySquare,
    houses: number,
    ownsAllInGroup: boolean,
    stationsOwnedCount: number = 1
  ): number {
    if (square.type === 'station') {
      // 1 station = 25, 2 stations = 50
      return (square.rentBase || 25) * Math.max(1, stationsOwnedCount);
    }

    if (square.type === 'utility') {
      return square.rentBase || 20;
    }

    const base = square.rentBase || 10;
    if (houses === 0) {
      return ownsAllInGroup ? base * 2 : base;
    } else if (houses === 1) {
      return base * 5;
    } else if (houses === 2) {
      return base * 15;
    } else if (houses === 3) {
      return base * 35;
    } else if (houses === 4) {
      return base * 60;
    } else if (houses >= 5) {
      // Hotel
      return base * 100;
    }
    return base;
  }
}
