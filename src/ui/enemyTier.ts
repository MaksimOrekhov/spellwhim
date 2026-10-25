import { defaultDungeonRoster } from '../game/encountersV10'
import { rhahkZor, sectorOneElite } from '../game/sectorContent'
import { expansionElites } from '../game/sectorLong'

/** How dangerous an enemy looks on the board. Presentation only: it never changes a rule, and the map still shows only the room's category. */
export type EnemyTier = 'normal' | 'elite' | 'boss'

/** Tier of an encounter by its stable catalog ID (a campaign battle appends `/<node>` to it). */
export function enemyTier(encounterId: string): EnemyTier {
  const id = encounterId.split('/')[0]!
  if (id === rhahkZor.id || defaultDungeonRoster.final?.id === id) return 'boss'
  if (id === sectorOneElite.id || expansionElites.some(item => item.id === id) || defaultDungeonRoster.elite.some(item => item.id === id)) return 'elite'
  return 'normal'
}

export const tierLabel: Record<EnemyTier, string> = { normal: '', elite: 'Элита', boss: 'Босс' }
