import regular from '../assets/backgrounds/deadmines-regular.webp'
import eliteCrystal from '../assets/backgrounds/deadmines-elite-crystal.webp'
import rakzorForge from '../assets/backgrounds/deadmines-rakzor-forge.webp'
import { enemyTier, type EnemyTier } from './enemyTier'

/** One painted background: the file and where the crop of a wide battle area should stay (CSS object-position). */
export interface BattleBackground { id: string; src: string; focus: string }
/** Backgrounds of one sector, by the tier of the enemy. `normal` is also the fallback for anything the sector does not list. */
export type SectorBackgrounds = Record<'normal', BattleBackground> & Partial<Record<EnemyTier, BattleBackground>>

export const deadminesBackgrounds: SectorBackgrounds = {
  normal: { id: 'deadmines-regular', src: regular, focus: '50% 42%' },
  elite: { id: 'deadmines-elite-crystal', src: eliteCrystal, focus: '50% 40%' },
  boss: { id: 'deadmines-rakzor-forge', src: rakzorForge, focus: '50% 14%' },
}

/** Sector I is the only sector with paintings so far; a later sector adds its own set here, and the battle scene does not change. */
const sectors: Record<string, SectorBackgrounds> = { 'deadmines-1': deadminesBackgrounds }
export const DEFAULT_SECTOR = 'deadmines-1'

/** Presentation only. The background follows the enemy's stable encounter ID (through its tier), never the room's place on the map or a random number. */
export function battleBackground(encounterId: string, sector: string = DEFAULT_SECTOR): BattleBackground {
  const set = sectors[sector]
  // An unknown sector has no paintings of its own, so every fight there gets the standard mine, whatever the enemy's tier.
  if (!set) return deadminesBackgrounds.normal
  return set[enemyTier(encounterId)] ?? set.normal
}

/** Every background of the game, for the scene to keep them all loaded so a change of fight swaps them without a flash. */
export const allBattleBackgrounds: readonly BattleBackground[] = Object.values(sectors).flatMap(set => Object.values(set) as BattleBackground[])
