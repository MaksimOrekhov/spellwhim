import { CARDS_DRAWN_PER_TURN, OPENING_HAND_SIZE, encounters } from './types'
import type { EncounterDefinition } from './types'
import { reinforcedEncounters } from './encountersV07'

/**
 * Combat Economy v0.7 — the single description of the rules that differ between the standard game (model A)
 * and the experimental mana-progression models (B, U). The headless Balance Lab and the playable app read the
 * same object, and `battle.ts` is the only place that applies it: there is no second copy of the rules.
 *
 * An economy is three independent parts, so the Lab can add them one at a time (stages A–D of the report):
 *  - a mana curve (mana on turn 1, 2, 3 … ; the last value repeats; restored in full at the start of every turn);
 *  - a draw schedule (cards drawn at the start of each turn after the first);
 *  - an enemy package (the encounters a campaign plays).
 * The standard game is `baselineEconomy`: flat 3 mana, draw 2, the v0.6 enemies. It is the default everywhere.
 */

export type ManaCurveId = 'A' | 'B' | 'U'
/** `late3` is the proposal (3 cards from turn 5); `from4`, `from6` and `all3` exist for the sensitivity runs of the report. */
export type DrawScheduleId = 'base' | 'late3' | 'from4' | 'from6' | 'all3'
export type EnemyPackageId = 'v06' | 'v07'

export interface DrawSchedule {
  /** Cards drawn at the start of every turn after the first. */
  perTurn: number
  /** From this turn on, `perTurn` is replaced by `amount`. */
  boost?: { fromTurn: number; amount: number }
}

export interface EconomyConfig {
  /** Stable key used in reports and URLs, e.g. `A`, `U`, `U/v07/late3`. */
  id: string
  label: string
  manaCurve: ManaCurveId
  draw: DrawScheduleId
  enemies: EnemyPackageId
  /** Maximum (and refreshed) mana on turn 1, 2, 3 …; the last entry applies to every later turn. */
  manaByTurn: readonly number[]
  drawSchedule: DrawSchedule
  openingHand: number
  /** Multiplier of every enemy's maximum health (1 for the presets); only for calibration runs of the Balance Lab. */
  enemyHealthScale: number
}

export const manaCurves: Record<ManaCurveId, { label: string; manaByTurn: readonly number[] }> = {
  A: { label: 'плоские 3', manaByTurn: [3] },
  B: { label: '3→4→5', manaByTurn: [3, 4, 5] },
  U: { label: '3→4→4→5→5→6', manaByTurn: [3, 4, 4, 5, 5, 6] },
}

export const drawSchedules: Record<DrawScheduleId, { label: string; schedule: DrawSchedule }> = {
  base: { label: 'добор 2', schedule: { perTurn: CARDS_DRAWN_PER_TURN } },
  late3: { label: 'добор 2, с 5-го хода 3', schedule: { perTurn: CARDS_DRAWN_PER_TURN, boost: { fromTurn: 5, amount: 3 } } },
  from4: { label: 'добор 2, с 4-го хода 3', schedule: { perTurn: CARDS_DRAWN_PER_TURN, boost: { fromTurn: 4, amount: 3 } } },
  from6: { label: 'добор 2, с 6-го хода 3', schedule: { perTurn: CARDS_DRAWN_PER_TURN, boost: { fromTurn: 6, amount: 3 } } },
  all3: { label: 'добор 3 всегда', schedule: { perTurn: 3 } },
}

export const enemyPackages: Record<EnemyPackageId, { label: string; encounters: readonly EncounterDefinition[] }> = {
  v06: { label: 'враги v0.6', encounters },
  v07: { label: 'враги v0.7', encounters: reinforcedEncounters },
}

export interface EconomyParts { mana?: ManaCurveId; draw?: DrawScheduleId; enemies?: EnemyPackageId; healthScale?: number }

/** Composes an economy from its parts. Omitted parts are the standard game's. */
export function buildEconomy(parts: EconomyParts = {}, id?: string): EconomyConfig {
  const manaCurve = parts.mana ?? 'A'
  const draw = parts.draw ?? 'base'
  const enemies = parts.enemies ?? 'v06'
  const healthScale = parts.healthScale ?? 1
  const key = id ?? (manaCurve === 'A' && draw === 'base' && enemies === 'v06' && healthScale === 1 ? 'A' : [manaCurve, enemies, draw, ...(healthScale === 1 ? [] : ['x' + healthScale])].join('/'))
  return {
    id: key,
    label: [manaCurves[manaCurve].label, drawSchedules[draw].label, enemyPackages[enemies].label].join(' · '),
    manaCurve, draw, enemies,
    manaByTurn: manaCurves[manaCurve].manaByTurn,
    drawSchedule: drawSchedules[draw].schedule,
    openingHand: OPENING_HAND_SIZE,
    enemyHealthScale: healthScale,
  }
}

/** Model A: the standard game (v0.6), the control of every comparison. */
export const baselineEconomy: EconomyConfig = buildEconomy()

/** The complete experimental packages offered for play: the curve plus v0.7 enemies plus the late draw. */
export const playableEconomies: Record<ManaCurveId, EconomyConfig> = {
  A: baselineEconomy,
  B: buildEconomy({ mana: 'B', enemies: 'v07', draw: 'late3' }, 'B'),
  U: buildEconomy({ mana: 'U', enemies: 'v07', draw: 'late3' }, 'U'),
}

export type EconomyStage = 'A' | 'B' | 'C' | 'D'
/**
 * The four comparison stages of the report, for a mana curve:
 *  A — the standard game; B — the curve only; C — curve + v0.7 enemies; D — curve + enemies + late draw.
 */
export function economyStage(stage: EconomyStage, curve: ManaCurveId): EconomyConfig {
  if (stage === 'A') return baselineEconomy
  // With curve A the later stages isolate the enemy and draw changes from the mana change (control rows of the report).
  return buildEconomy({ mana: curve, enemies: stage === 'B' ? 'v06' : 'v07', draw: stage === 'D' ? 'late3' : 'base' }, curve + '/' + stage)
}

/** A detached copy (arrays included), for state copies that must share no object with the original. */
export function cloneEconomy(economy: EconomyConfig): EconomyConfig {
  const { boost } = economy.drawSchedule
  return { ...economy, manaByTurn: [...economy.manaByTurn], drawSchedule: boost ? { ...economy.drawSchedule, boost: { ...boost } } : { ...economy.drawSchedule } }
}

export function manaForTurn(economy: EconomyConfig, turn: number): number {
  const curve = economy.manaByTurn
  return curve[Math.min(Math.max(1, Math.floor(turn)), curve.length) - 1]!
}

/** Cards drawn when `turn` begins (turn 2 is the first draw after the opening hand). */
export function drawForTurn(economy: EconomyConfig, turn: number): number {
  const { perTurn, boost } = economy.drawSchedule
  return boost && turn >= boost.fromTurn ? boost.amount : perTurn
}

/** The first turn on which the curve reaches its highest value. */
export function maxManaTurn(economy: EconomyConfig): number {
  const top = Math.max(...economy.manaByTurn)
  return economy.manaByTurn.indexOf(top) + 1
}

export function economyEncounters(economy: EconomyConfig): readonly EncounterDefinition[] {
  const list = enemyPackages[economy.enemies].encounters
  const scale = economy.enemyHealthScale ?? 1
  return scale === 1 ? list : list.map(encounter => ({ ...encounter, maxHealth: Math.max(1, Math.round(encounter.maxHealth * scale)) }))
}

/**
 * Parses a configuration name used by the CLI tools: `A`, `B`, `U` (the complete packages), `B/C` (stage C of curve B),
 * or `U/v06/base` style (curve/enemies/draw[/enemy health multiplier]) for any single combination.
 */
export function economyFromSpec(spec: string): EconomyConfig {
  const parts = spec.split('/')
  const curve = parts[0]!.toUpperCase()
  if (!(curve in manaCurves)) throw new Error('Unknown mana curve: ' + parts[0])
  if (parts.length === 1) return playableEconomies[curve as ManaCurveId]
  if (parts.length === 2 && ['A', 'B', 'C', 'D'].includes(parts[1]!.toUpperCase())) return economyStage(parts[1]!.toUpperCase() as EconomyStage, curve as ManaCurveId)
  const [, enemies = 'v06', draw = 'base', scale = '1'] = parts
  const healthScale = Number(scale)
  if (!(enemies in enemyPackages) || !(draw in drawSchedules) || !(healthScale > 0)) throw new Error('Unknown economy: ' + spec)
  return buildEconomy({ mana: curve as ManaCurveId, enemies: enemies as EnemyPackageId, draw: draw as DrawScheduleId, healthScale })
}

/**
 * Reads the dev-only launch parameters: `?economy=B|U` selects a complete experimental package;
 * `&enemies=v06|v07` and `&draw=base|late3` override one part of it (`?economy=U&enemies=v06` is stage B for U).
 */
export function economyFromSearch(search: string): EconomyConfig {
  const params = new URLSearchParams(search)
  const name = (params.get('economy') ?? 'A').toUpperCase()
  const curve: ManaCurveId = name in manaCurves ? name as ManaCurveId : 'A'
  const enemies = params.get('enemies')
  const draw = params.get('draw')
  const enemiesPart = enemies && enemies in enemyPackages ? enemies as EnemyPackageId : undefined
  const drawPart = draw && draw in drawSchedules ? draw as DrawScheduleId : undefined
  if (!enemiesPart && !drawPart) return playableEconomies[curve]
  const full = playableEconomies[curve]
  return buildEconomy({ mana: curve, enemies: enemiesPart ?? full.enemies, draw: drawPart ?? full.draw })
}
