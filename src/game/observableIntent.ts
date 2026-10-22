import type { EnemyActionForecast, EnemyTargetForecast } from './battle'
import type { EnemyAction, HeroId } from './types'

/**
 * The single visibility policy for the enemy's announced action: what anyone at the table, human or bot, may know.
 *
 * `forecastEnemyAction` is the engine's full truth and also carries the exact numbers of a prepared strike (`futureTargets`).
 * While the enemy is still preparing, those are not public: the player sees the target and the kind of blow, never its size.
 * Everything that must respect that (the battle scene via ui/threatDisplay.ts, the Balance Lab bots via `visibleThreat`)
 * goes through `publicIntent`; the `prepare` variant of `PublicIntent` has no numeric field at all. The engine, the rules tests
 * and the diagnostic "omniscient" policy keep reading the real forecast; nothing here changes a rule.
 *
 * The order of a prepared strike is: prepare (target known, size hidden) → the strike announced with exact numbers on the
 * next turn → execution. The announced strike is an ordinary `attack`.
 */
export type IntentKind = EnemyAction['kind']

/** One announced hit on one hero, exact: this is what lands when the turn ends. Armor, statuses and artifacts are inside it. */
export interface RevealedHit {
  hero: HeroId
  /** Damage that reaches the hero's armor (after statuses and artifacts). */
  attack: number
  absorbed: number
  healthLoss: number
  lethal: boolean
  /** The hit is fully soaked up by armor. */
  blocked: boolean
  /** Damage removed by an artifact (Reliable Wedge). */
  artifactReduction: number
  /** B1/B2, each present only when it applies: armor this hit ignores; damage the enemy's Frostbite takes off it; it leaves the hero Vulnerable; it was stopped by the party this turn. */
  pierce?: number
  pierced?: number
  chill?: number
  exposes?: true
  cancelled?: true
}

/** B1: how far the party is from stopping an announced hit this turn. */
export interface InterruptProgress { need: number; dealt: number; broken: boolean }
/** B1: what is public about a strike that is still being prepared: the kind of trick it carries, never a number. */
export interface PreparedTraits { pierce?: true; interruptible?: true; exposes?: true }

export type PublicIntent =
  | { kind: 'attack' | 'attack_all'; name: string; phase: 1 | 2; hits: RevealedHit[]; primaryTarget: HeroId | null; interrupt?: InterruptProgress }
  /** Preparation: who is aimed at and what kind of blow, never how hard. */
  | { kind: 'prepare'; name: string; phase: 1 | 2; targets: HeroId[]; blow: 'attack' | 'attack_all'; traits?: PreparedTraits }
  | { kind: 'defend' | 'recover'; name: string; phase: 1 | 2; armor: number; power?: number }

function toHit(hit: EnemyTargetForecast, cancelled: boolean): RevealedHit {
  return {
    hero: hit.target, attack: hit.attack, absorbed: hit.absorbed, healthLoss: hit.healthLoss, lethal: hit.lethal && !cancelled, blocked: hit.attack > 0 && hit.healthLoss === 0, artifactReduction: hit.artifactReduction,
    ...(hit.pierce ? { pierce: hit.pierce } : {}), ...(hit.pierced ? { pierced: hit.pierced } : {}), ...(hit.chill ? { chill: hit.chill } : {}), ...(hit.exposes ? { exposes: true as const } : {}), ...(cancelled ? { cancelled: true as const } : {}),
  }
}

const warriorFirst = (a: { hero: HeroId }, b: { hero: HeroId }) => (a.hero === 'warrior' ? -1 : 1) - (b.hero === 'warrior' ? -1 : 1)

export function publicIntent(forecast: EnemyActionForecast): PublicIntent {
  const action = forecast.action
  const { name } = action
  const phase = forecast.phase
  switch (action.kind) {
    case 'attack':
    case 'attack_all':
      return { kind: action.kind, name, phase, hits: forecast.targets.map(hit => toHit(hit, forecast.interrupt?.broken === true)).sort(warriorFirst), primaryTarget: action.kind === 'attack_all' ? action.primaryTarget : null, ...(forecast.interrupt ? { interrupt: { ...forecast.interrupt } } : {}) }
    case 'prepare': {
      // Only the announced targets and the kind of trick are read; the forecast's `futureTargets` numbers are deliberately not touched.
      const { pierce, interrupt, exposes } = action.prepared
      const traits: PreparedTraits = { ...(pierce ? { pierce: true as const } : {}), ...(interrupt !== undefined ? { interruptible: true as const } : {}), ...(exposes ? { exposes: true as const } : {}) }
      return { kind: 'prepare', name, phase, targets: [...forecast.threatened], blow: action.prepared.kind, ...(Object.keys(traits).length ? { traits } : {}) }
    }
    default:
      return { kind: action.kind, name, phase, armor: forecast.armorGain, ...(forecast.powerGain ? { power: forecast.powerGain } : {}) }
  }
}


/** How a simulated player reads the enemy's intent. `public` is the rule; `omniscient` is the historical diagnostic that also reads the hidden size of a prepared strike. */
export type Information = 'public' | 'omniscient'

/**
 * A prepared strike has a public target and kind but no public size. A bot that wants to guard the target has to assume one:
 * this fixed prior is the same for every enemy and every state, so it cannot depend on the hidden value.
 */
export const PREPARED_BLOW_PRIOR = 8

/** One hit as a bot weighs it. `estimated` marks the prior for a preparation: it never counts as lethal. */
export interface VisibleHit { target: HeroId; attack: number; healthLoss: number; lethal: boolean; estimated: boolean }

/** The hits a bot may plan around this turn, under the given information policy. */
export function visibleThreat(forecast: EnemyActionForecast, heroes: Record<HeroId, { armor: number }>, information: Information = 'public'): VisibleHit[] {
  // A hit the party has already stopped this turn is public too: the banner shows it struck out.
  if (information === 'public' && forecast.interrupt?.broken) return []
  if (information === 'omniscient') {
    return (forecast.targets.length ? forecast.targets : forecast.futureTargets).map(hit => ({ target: hit.target, attack: hit.attack, healthLoss: hit.healthLoss, lethal: hit.lethal, estimated: false }))
  }
  const intent = publicIntent(forecast)
  if (intent.kind === 'attack' || intent.kind === 'attack_all') return intent.hits.map(hit => ({ target: hit.hero, attack: hit.attack, healthLoss: hit.healthLoss, lethal: hit.lethal, estimated: false }))
  if (intent.kind === 'prepare') return intent.targets.map(target => ({ target, attack: PREPARED_BLOW_PRIOR, healthLoss: Math.max(0, PREPARED_BLOW_PRIOR - heroes[target].armor), lethal: false, estimated: true }))
  return []
}
