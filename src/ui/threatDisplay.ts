import type { EnemyActionForecast, EnemyTargetForecast } from '../game/battle'
import type { EnemyAction, HeroId } from '../game/types'

/**
 * Presentation model of the enemy's announced action, read straight from `forecastEnemyAction`: every number shown on a
 * portrait is a number of that forecast (armor, statuses and artifacts are already inside it), nothing is recomputed here.
 * The one thing this module adds is the distinction the player must never miss: a `now` threat lands when the turn ends,
 * a `later` threat belongs to a prepared strike and lands one turn after.
 */
export type ThreatTiming = 'now' | 'later'

export interface HeroThreat {
  hero: HeroId
  timing: ThreatTiming
  /** Damage that reaches the hero's armor (after statuses and artifacts). */
  attack: number
  absorbed: number
  healthLoss: number
  lethal: boolean
  /** The hit is fully soaked up by armor. */
  blocked: boolean
  /** Damage removed by an artifact (Reliable Wedge). */
  artifactReduction: number
}

function toThreat(hit: EnemyTargetForecast, timing: ThreatTiming): HeroThreat {
  return { hero: hit.target, timing, attack: hit.attack, absorbed: hit.absorbed, healthLoss: hit.healthLoss, lethal: hit.lethal, blocked: hit.attack > 0 && hit.healthLoss === 0, artifactReduction: hit.artifactReduction }
}

export function heroThreats(forecast: EnemyActionForecast): Partial<Record<HeroId, HeroThreat>> {
  const result: Partial<Record<HeroId, HeroThreat>> = {}
  for (const hit of forecast.targets) result[hit.target] = toThreat(hit, 'now')
  for (const hit of forecast.futureTargets) result[hit.target] ??= toThreat(hit, 'later')
  return result
}

export type IntentKind = EnemyAction['kind']

export interface IntentSummary {
  kind: IntentKind
  label: string
  name: string
  /** True while the shown hits belong to a prepared strike (the current turn deals no damage). */
  later: boolean
  armorGain: number
  phase: 1 | 2
  hits: HeroThreat[]
  /** The hero named as the main target of an attack on both, when there is one. */
  primaryTarget: HeroId | null
}

const labels: Record<IntentKind, string> = { attack: 'Атака', attack_all: 'Атака по обоим', defend: 'Защита', prepare: 'Готовит удар', recover: 'Передышка' }

export function intentSummary(forecast: EnemyActionForecast): IntentSummary {
  const threats = heroThreats(forecast)
  const hits = (Object.values(threats) as HeroThreat[]).sort((a, b) => (a.hero === 'warrior' ? -1 : 1) - (b.hero === 'warrior' ? -1 : 1))
  const action = forecast.action
  return {
    kind: action.kind, label: labels[action.kind], name: action.name,
    later: forecast.targets.length === 0 && forecast.futureTargets.length > 0,
    armorGain: forecast.armorGain, phase: forecast.phase, hits,
    primaryTarget: action.kind === 'attack_all' ? action.primaryTarget : null,
  }
}

/** The lethal warning is only ever raised for damage that lands this turn; a prepared lethal strike is labelled as a later threat. */
export function lethalNow(forecast: EnemyActionForecast): HeroId[] {
  return forecast.targets.filter(hit => hit.lethal).map(hit => hit.target)
}
export function lethalLater(forecast: EnemyActionForecast): HeroId[] {
  return forecast.futureTargets.filter(hit => hit.lethal).map(hit => hit.target)
}
