import { PokemonCardInstance, PokemonElementType } from './types';

export class PokemonRules {
  /**
   * Elemental Advantage Matrix:
   * Fire beats Grass
   * Grass beats Earth
   * Earth beats Electric
   * Electric beats Water
   * Water beats Fire
   * Psychic is neutral to all (1.0x) except slight advantage vs Psychic (1.1x)
   */
  public static getElementalMultiplier(attackerType: PokemonElementType, defenderType: PokemonElementType): {
    multiplier: number;
    effectiveness: 'super' | 'weak' | 'normal';
  } {
    if (attackerType === defenderType) {
      return { multiplier: 1.0, effectiveness: 'normal' };
    }

    const SUPER_EFFECTIVE: Record<PokemonElementType, PokemonElementType> = {
      fire: 'grass',
      grass: 'earth',
      earth: 'electric',
      electric: 'water',
      water: 'fire',
      psychic: 'earth', // Psychic penetrates physical earth defense
    };

    const WEAK_TO: Record<PokemonElementType, PokemonElementType> = {
      grass: 'fire',
      earth: 'grass',
      electric: 'earth',
      water: 'electric',
      fire: 'water',
      psychic: 'psychic',
    };

    if (SUPER_EFFECTIVE[attackerType] === defenderType) {
      return { multiplier: 1.5, effectiveness: 'super' };
    }

    if (WEAK_TO[attackerType] === defenderType) {
      return { multiplier: 0.7, effectiveness: 'weak' };
    }

    return { multiplier: 1.0, effectiveness: 'normal' };
  }

  /**
   * Damage Formula:
   * Normal attack: basePower = attacker.attack
   * Skill attack: basePower = attacker.skillPower
   * rawDamage = basePower - (defender.defense * 0.4)
   * finalDamage = Math.max(8, Math.round(rawDamage * elementalMultiplier))
   */
  public static calculateDamage(
    attacker: PokemonCardInstance,
    defender: PokemonCardInstance,
    isSkill = false
  ): {
    damage: number;
    effectiveness: 'super' | 'weak' | 'normal';
    multiplier: number;
  } {
    const basePower = isSkill ? attacker.skillPower : attacker.attack;
    const { multiplier, effectiveness } = this.getElementalMultiplier(attacker.type, defender.type);

    const defenseMitigation = defender.defense * 0.4;
    const baseDamage = Math.max(10, basePower - defenseMitigation);
    const finalDamage = Math.max(8, Math.round(baseDamage * multiplier));

    return {
      damage: finalDamage,
      effectiveness,
      multiplier,
    };
  }

  /**
   * Checks if all monsters in a player's team are fainted.
   */
  public static isTeamDefeated(team: PokemonCardInstance[]): boolean {
    return team.every((c) => c.isFainted || c.currentHp <= 0);
  }

  /**
   * Finds the first available non-fainted bench index.
   */
  public static getNextAvailableIndex(team: PokemonCardInstance[]): number | null {
    const idx = team.findIndex((c) => !c.isFainted && c.currentHp > 0);
    return idx >= 0 ? idx : null;
  }
}
