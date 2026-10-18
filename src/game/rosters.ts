import type { EncounterDefinition } from './types'
import { eliteEncounterCatalog, eliteEncountersForLayer, encounterPoolForLayer, normalEncounterCatalog } from './encountersV09'

/**
 * A dungeon roster is everything the map generator and the encounter lookup need to know about the enemies of one
 * balance generation: the normal and elite catalogs, which of them can appear on which layer, and how their health is
 * scaled by position. Rosters are plain data, so the headless labs can play several of them with the same seeds;
 * the playable game always uses `defaultDungeonRoster`.
 */
export interface DungeonRoster {
  id: string
  label: string
  normal: readonly EncounterDefinition[]
  elite: readonly EncounterDefinition[]
  /** Replaces the economy's last encounter as the final fight when present. */
  final?: EncounterDefinition
  poolForLayer(layer: number): readonly string[]
  eliteForLayer(layer: number): readonly EncounterDefinition[]
  /**
   * Multiplier of the catalog health at a map position. `random` draws from the map's own stream: a roster must call it
   * exactly when the control does (normal fights after the first layer), so rosters share one map for one seed.
   */
  healthScale(type: 'battle' | 'elite' | 'final', layer: number, column: number, random: () => number): number
}

/** The v0.9 roster, kept unchanged as the control of every Combat Overhaul comparison. */
export const rosterV09: DungeonRoster = {
  id: 'v09',
  label: 'Штреки v0.9 (контроль)',
  normal: normalEncounterCatalog,
  elite: eliteEncounterCatalog,
  poolForLayer: encounterPoolForLayer,
  eliteForLayer: eliteEncountersForLayer,
  healthScale: (type, layer, column, random) => type === 'elite'
    ? (layer >= 4 ? 1.06 : 1)
    : layer === 0 ? [0.78, 0.82, 0.86][column]! : 0.84 + Math.min(layer, 5) * 0.025 + random() * 0.04,
}

/** Builds a roster that keeps v0.9's map shape (pools, elite layers) around different encounter data. */
export function rosterFrom(base: DungeonRoster, id: string, label: string, parts: Partial<Pick<DungeonRoster, 'normal' | 'elite' | 'final' | 'healthScale'>>): DungeonRoster {
  const normal = parts.normal ?? base.normal
  const elite = parts.elite ?? base.elite
  const byId = (list: readonly EncounterDefinition[], ids: readonly string[]) => list.filter(encounter => ids.includes(encounter.id))
  return {
    ...base, id, label, normal, elite, final: parts.final ?? base.final,
    healthScale: parts.healthScale ?? base.healthScale,
    poolForLayer: layer => base.poolForLayer(layer),
    eliteForLayer: layer => byId(elite, base.eliteForLayer(layer).map(encounter => encounter.id)),
  }
}
