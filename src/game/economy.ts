import { CARDS_DRAWN_PER_TURN, OPENING_HAND_SIZE, encounters } from './types'
import type { ArtifactId, EncounterDefinition, EnemyAction, EnemyBehavior } from './types'
import type { SectorFoeSetId } from './sectorFoesB'
import { reinforcedEncounters } from './encountersV07'

/**
 * Combat Economy v0.7 — the single description of the standard game (model B) and experimental models (A, U).
 * The headless Balance Lab and the playable app read the
 * same object, and `battle.ts` is the only place that applies it: there is no second copy of the rules.
 *
 * An economy is three independent parts, so the Lab can add them one at a time (stages A–D of the report):
 *  - a mana curve (mana on turn 1, 2, 3 … ; the last value repeats; restored in full at the start of every turn);
 *  - a draw schedule (cards drawn at the start of each turn after the first);
 *  - an enemy package (the encounters a campaign plays).
 * The standard game is `gameEconomy` (B): 3→4→5 mana, late draw and the v0.7 enemies. `baselineEconomy` (A)
 * remains the explicit v0.6 control for Balance Lab and regression comparisons.
 */

/** `H` is the flat 4 of the experimental "Honest Turn" rules; A, B and U are the historical models. */
export type ManaCurveId = 'A' | 'B' | 'U' | 'H'
/** The models the standard game and the Balance Lab can play. */
export type PlayableCurveId = 'A' | 'B' | 'U'
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
  /** Multiplier of every enemy's maximum health (1 for the presets); calibration runs of the Balance Lab and the Honest Turn experiment. */
  enemyHealthScale: number
  /**
   * EXPERIMENT "Honest Turn" (docs/design/honest-turn-a-experiment-v1.md). The four fields below are ABSENT from every historical
   * economy on purpose: a saved copy of A, B or U stays byte-identical, and the engine reads an absent field as the current rules.
   * Cards left in hand when the player ends the turn go to the discard pile; the next hand comes from `drawSchedule`.
   */
  discardHand?: boolean
  /** `turn`: hero armor is cleared once the enemy action has resolved (a partner's armor too). Absent: armor stays until that hero is hit. */
  armorExpiry?: 'turn'
  /** Multiplier of every damaging number of an enemy action (a prepared strike included); absent means 1. */
  enemyDamageScale?: number
  /** Artifacts never offered in this economy, because their rule needs armor to survive a turn. */
  excludedArtifacts?: readonly ArtifactId[]
  /** EXPERIMENT "Honest Turn B1": the run's Sector I enemies take their cycles from this data set instead of `sectorContent.ts` (same ids, same map). Absent: the standard enemies. */
  sectorFoes?: SectorFoeSetId
}

export const manaCurves: Record<ManaCurveId, { label: string; manaByTurn: readonly number[] }> = {
  A: { label: 'плоские 3', manaByTurn: [3] },
  B: { label: '3→4→5', manaByTurn: [3, 4, 5] },
  U: { label: '3→4→4→5→5→6', manaByTurn: [3, 4, 4, 5, 5, 6] },
  H: { label: 'плоские 4', manaByTurn: [4] },
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

/** Model A: the v0.6 control economy used for Balance Lab and regression comparisons. */
export const baselineEconomy: EconomyConfig = buildEconomy()

/** The complete experimental packages offered for play: the curve plus v0.7 enemies plus the late draw. */
export const playableEconomies: Record<PlayableCurveId, EconomyConfig> = {
  A: baselineEconomy,
  B: buildEconomy({ mana: 'B', enemies: 'v07', draw: 'late3' }, 'B'),
  U: buildEconomy({ mana: 'U', enemies: 'v07', draw: 'late3' }, 'U'),
}

/** Model B is the standard economy used by the actual game. */
export const gameEconomy: EconomyConfig = playableEconomies.B

/**
 * EXPERIMENT A "Честный ход" (docs/design/honest-turn-a-experiment-v1.md, Decision Log X01). 7 cards every turn, unplayed cards are
 * discarded, 4 mana every turn, hero armor does not outlive the enemy action, enemies have 1.75x health and a fraction of their damage.
 * The two presets differ only in that fraction (0.8 and 0.9), so close settings can be compared by switching the rules, nothing else.
 * Hero health is the standard 25/18. These are NOT approved rules and never replace `gameEconomy`.
 */
function honestEconomy(id: string, damage: number): EconomyConfig {
  return {
    ...buildEconomy({ mana: 'H', enemies: 'v07', draw: 'base' }, id),
    label: `Честный ход A · 7 карт, мана 4 · враги: здоровье ×1,75, урон ×${String(damage).replace('.', ',')}`,
    drawSchedule: { perTurn: 7 }, openingHand: 7, enemyHealthScale: 1.75,
    discardHand: true, armorExpiry: 'turn', enemyDamageScale: damage,
    // The spool needs armor at the start of the turn, which these rules take away; offering it would hand out a dead item.
    excludedArtifacts: ['tension-spool'],
  }
}
/**
 * EXPERIMENT B1 "Новые угрозы" and B2 "Мороз и сталь" (docs/design/honest-turn-b-experiment-v1.md): the same economy as A (7 cards, 4 mana,
 * discard, armor for one enemy action, health x1.75) with the new Sector I enemy cycles. Their damage numbers are absolute, so no damage
 * fraction is applied. B2 is B1 plus the Frost and Steel starting deck; the two differ in nothing the engine reads, only in the deck
 * the mode starts with (rulesMode.ts), so each of them is a mode of its own with its own save slot.
 */
function honestEconomyB(id: string, label: string): EconomyConfig {
  const { enemyDamageScale: _scale, ...economy } = honestEconomy(id, 1)
  return { ...economy, label, sectorFoes: 'b1' }
}
export const honestEconomies = {
  'honest-a08': honestEconomy('honest-a08', 0.8),
  'honest-a09': honestEconomy('honest-a09', 0.9),
  'honest-b1': honestEconomyB('honest-b1', 'Честный ход B1 · 7 карт, мана 4 · новые угрозы шести врагов сектора I'),
  'honest-b2': honestEconomyB('honest-b2', 'Честный ход B2 · B1 + «Мороз и сталь»: Обморожение, Раскол льда'),
} as const
export type HonestEconomyId = keyof typeof honestEconomies
export const isHonestEconomy = (economy: Pick<EconomyConfig, 'discardHand'>): boolean => economy.discardHand === true
/** Every economy a saved run may carry: the three historical models and the experimental presets. */
export function knownEconomies(): EconomyConfig[] { return [...Object.values(playableEconomies), ...Object.values(honestEconomies)] }

/** A copy of the behaviour with every damaging number scaled (at least 1). Armor values and the order of actions are untouched. */
export function scaleEnemyDamage(behavior: EnemyBehavior, scale: number): EnemyBehavior {
  if (scale === 1) return behavior
  const scaled = (amount: number) => Math.max(1, Math.round(amount * scale))
  const action = (item: EnemyAction): EnemyAction => item.kind === 'attack' || item.kind === 'attack_all'
    ? { ...item, damage: scaled(item.damage) }
    : item.kind === 'prepare' ? { ...item, prepared: action(item.prepared) as typeof item.prepared } : item
  return { phase1: behavior.phase1.map(action), ...(behavior.phase2 ? { phase2: behavior.phase2.map(action) } : {}) }
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
  if (spec.toLowerCase() in honestEconomies) return honestEconomies[spec.toLowerCase() as HonestEconomyId]
  const parts = spec.split('/')
  const curve = parts[0]!.toUpperCase()
  if (!(curve in manaCurves)) throw new Error('Unknown mana curve: ' + parts[0])
  if (parts.length === 1) {
    if (!(curve in playableEconomies)) throw new Error('Unknown economy: ' + spec)
    return playableEconomies[curve as PlayableCurveId]
  }
  if (parts.length === 2 && ['A', 'B', 'C', 'D'].includes(parts[1]!.toUpperCase())) return economyStage(parts[1]!.toUpperCase() as EconomyStage, curve as ManaCurveId)
  const [, enemies = 'v06', draw = 'base', scale = '1'] = parts
  const healthScale = Number(scale)
  if (!(enemies in enemyPackages) || !(draw in drawSchedules) || !(healthScale > 0)) throw new Error('Unknown economy: ' + spec)
  return buildEconomy({ mana: curve as ManaCurveId, enemies: enemies as EnemyPackageId, draw: draw as DrawScheduleId, healthScale })
}

/**
 * Reads the dev-only launch parameters: `?economy=A|U` selects a comparison package (B is the default);
 * `&enemies=v06|v07` and `&draw=base|late3` override one part of it (`?economy=U&enemies=v06` is stage B for U).
 */
export function economyFromSearch(search: string): EconomyConfig {
  const params = new URLSearchParams(search)
  const name = (params.get('economy') ?? 'B').toUpperCase()
  const curve: PlayableCurveId = name in playableEconomies ? name as PlayableCurveId : 'B'
  const enemies = params.get('enemies')
  const draw = params.get('draw')
  const enemiesPart = enemies && enemies in enemyPackages ? enemies as EnemyPackageId : undefined
  const drawPart = draw && draw in drawSchedules ? draw as DrawScheduleId : undefined
  if (!enemiesPart && !drawPart) return playableEconomies[curve]
  const full = playableEconomies[curve]
  return buildEconomy({ mana: curve, enemies: enemiesPart ?? full.enemies, draw: drawPart ?? full.draw })
}
