import type { EnemyActionForecast, EnemyTargetForecast } from '../game/battle'
import type { EnemyAction, HeroId } from '../game/types'

/**
 * The PUBLIC intent: the only description of the enemy's announced action that the scene may draw, read or speak.
 *
 * `forecastEnemyAction` is the engine's full truth and also carries the exact numbers of a prepared strike (`futureTargets`).
 * The player is not told those while the enemy is still preparing, so the scene never receives the forecast: BattleBoard turns it
 * into a `PublicIntent` here, and the `prepare` variant of that type has no numeric field at all. A leak through a banner, a
 * tooltip, a `title`, an `aria-label`, a health bar, a portrait or a ray is therefore a type error, not a review finding.
 * The engine, the tests and the bots keep reading the real forecast; nothing here changes a rule.
 *
 * The order of a prepared strike is: prepare (target known, size hidden) → the strike announced with exact numbers on the
 * next turn → execution. The announced strike is an ordinary `attack` and is drawn exactly like one.
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
}

export type PublicIntent =
  | { kind: 'attack' | 'attack_all'; name: string; phase: 1 | 2; hits: RevealedHit[]; primaryTarget: HeroId | null }
  /** Preparation: who is aimed at and what kind of blow, never how hard. */
  | { kind: 'prepare'; name: string; phase: 1 | 2; targets: HeroId[]; blow: 'attack' | 'attack_all' }
  | { kind: 'defend' | 'recover'; name: string; phase: 1 | 2; armor: number }

function toHit(hit: EnemyTargetForecast): RevealedHit {
  return { hero: hit.target, attack: hit.attack, absorbed: hit.absorbed, healthLoss: hit.healthLoss, lethal: hit.lethal, blocked: hit.attack > 0 && hit.healthLoss === 0, artifactReduction: hit.artifactReduction }
}

const warriorFirst = (a: { hero: HeroId }, b: { hero: HeroId }) => (a.hero === 'warrior' ? -1 : 1) - (b.hero === 'warrior' ? -1 : 1)

export function publicIntent(forecast: EnemyActionForecast): PublicIntent {
  const action = forecast.action
  const { name } = action
  const phase = forecast.phase
  switch (action.kind) {
    case 'attack':
    case 'attack_all':
      return { kind: action.kind, name, phase, hits: forecast.targets.map(toHit).sort(warriorFirst), primaryTarget: action.kind === 'attack_all' ? action.primaryTarget : null }
    case 'prepare':
      // Only the announced targets are read; the forecast's `futureTargets` numbers are deliberately not touched.
      return { kind: 'prepare', name, phase, targets: [...forecast.threatened], blow: action.prepared.kind }
    default:
      return { kind: action.kind, name, phase, armor: forecast.armorGain }
  }
}

/** What a portrait shows about the announced action: a marker, never a number for a strike that is still being prepared. */
export type HeroMark =
  | ({ when: 'now' } & RevealedHit)
  | { when: 'prepared'; hero: HeroId }

export function heroMarks(intent: PublicIntent): Partial<Record<HeroId, HeroMark>> {
  const marks: Partial<Record<HeroId, HeroMark>> = {}
  if (intent.kind === 'attack' || intent.kind === 'attack_all') for (const hit of intent.hits) marks[hit.hero] = { when: 'now', ...hit }
  else if (intent.kind === 'prepare') for (const hero of intent.targets) marks[hero] = { when: 'prepared', hero }
  return marks
}

/** Heroes the current attack would kill. Empty for a preparation: its size, and so its lethality, is not public yet. */
export function lethalHeroes(intent: PublicIntent): HeroId[] {
  return intent.kind === 'attack' || intent.kind === 'attack_all' ? intent.hits.filter(hit => hit.lethal).map(hit => hit.hero) : []
}

export type HeroNames = Record<HeroId, string>

const kindLabel: Record<IntentKind, string> = { attack: 'Атака', attack_all: 'Атака по обоим', defend: 'Защита', prepare: 'Готовит удар', recover: 'Передышка' }

/** One screen-reader sentence; the visible banner carries no text beyond icons and numbers. */
export function intentSpoken(intent: PublicIntent, names: HeroNames): string {
  const head = `Намерение противника: ${kindLabel[intent.kind]}, ${intent.name}`
  switch (intent.kind) {
    case 'prepare': return `${head}. Цель: ${intent.targets.map(id => names[id]).join(' и ')}. Сейчас урона нет, точный урон станет известен на следующем ходу.`
    case 'defend': return `${head}. Получит ${intent.armor} брони.`
    case 'recover': return `${head}. Восстановит ${intent.armor} брони.`
    default: return `${head}. ${intent.hits.map(hit => hitSpoken(hit, names[hit.hero])).join(' ')}`
  }
}

export function hitSpoken(hit: RevealedHit, name: string): string {
  return `${name}: ${hit.blocked ? 'удар поглощён бронёй' : 'потеряет ' + hit.healthLoss + ' здоровья'}${hit.lethal ? ', смертельно' : ''}.`
}

/** Tooltip paragraphs: the detailed breakdown, only for numbers that are public. */
export function intentTooltip(intent: PublicIntent, names: HeroNames): string[] {
  switch (intent.kind) {
    case 'prepare':
      return [`${intent.name}. Готовит удар: ${intent.targets.map(id => names[id]).join(' и ')} — цель${intent.targets.length > 1 ? 'и' : ''}. Урона сейчас нет.`, 'Сколько урона принесёт удар, станет известно на следующем ходу, перед самым ударом: тогда можно успеть защититься.']
    case 'defend': return [`${intent.name}. Противник получит ${intent.armor} брони.`]
    case 'recover': return [`${intent.name}. Противник восстановит ${intent.armor} брони.`]
    default: {
      const lines = intent.hits.map(hit => `${names[hit.hero]}: удар ${hit.attack}${hit.absorbed ? ', броня поглощает ' + hit.absorbed : ''}${hit.blocked ? ' — здоровье цело' : ', здоровье −' + hit.healthLoss}${hit.lethal ? '. Смертельно.' : '.'}`)
      if (intent.kind === 'attack_all') lines.push('Стойка защищает главную цель, Бастион — и напарника.')
      return [intent.name + '.', ...lines]
    }
  }
}

/** Spoken marker for a portrait. */
export function markSpoken(mark: HeroMark, name: string): string {
  return mark.when === 'prepared' ? 'Цель подготовленного удара, урон пока неизвестен' : hitSpoken(mark, name)
}
