import { cardOwner, heroIdsInPartyOrder } from '../game/party'
import { pendingTickDamage, statusDefinition, statusValue } from '../game/statuses'
import { publicIntent } from '../game/observableIntent'
import { enemyTier } from '../ui/enemyTier'
import type { EnemyActionForecast, EnemyTargetForecast } from '../game/battle'
import type { BattleState, CardDefinition, CardEffect, HeroId, PendingPlay, StatusId } from '../game/types'
import { cardVfxStyle } from './cardStyles'
import {
  ARMOR_FX_DUR, BREAK_TIMING, DRAW_DUR, FALLBACK_MARGIN, GATHER_TIMING, GUARD_TIMING, MIN_AFTER_IMPACT, NUMBER_DUR, NUMBER_STAGGER, PLATE_TIMING,
  RECOVERY_MARGIN, RESULT_DUR, RUNE_TIMING, STATUS_DUR, STRIKE_TIMING,
} from './timing'
import type { GuardStyle, HeroOutcome, Motion, NumberSize, NumberTone, Paint, Reaction, School, StrikeStyle, VfxAnchor, VfxBeat, VfxPlan, Weight } from './types'

/**
 * Builds the VFX plan of one action from what the engine has ALREADY decided.
 *  - `cardVfxPlan` reads the pending play: its resolved effects, its preview (damage split between enemy armor and health, armor per hero,
 *    draw, statuses to apply, bonuses itemised by `damageParts`) and the statuses it will spend (`consumedStatuses`);
 *  - `enemyVfxPlan` reads the enemy forecast (hits with their armor/health split, traits, statuses spent) — but for a preparation only the
 *    public intent (targets), so a hidden size can never shape an effect.
 * Nothing here rolls dice, subtracts armor or decides a rule: a beat exists only because the engine says the thing happens.
 */

/** Light/normal/heavy by the number the player sees. */
export function weightOf(amount: number): Weight { return amount >= 9 ? 'heavy' : amount <= 3 ? 'light' : 'normal' }

const cardsWord = (n: number) => n === 1 ? 'карта' : n >= 2 && n <= 4 ? 'карты' : 'карт'

type Raw = Paint & { at: number }
class Beats {
  readonly list: Raw[] = []
  add(at: number, paint: Paint): Raw { const beat = { at: Math.max(0, Math.round(at)), ...paint } as Raw; this.list.push(beat); return beat }
  /** Floating text. Lane and final time are decided in `finalize`, where all the numbers of one portrait are known. */
  number(anchor: VfxAnchor, at: number, tone: NumberTone, size: NumberSize, text: string, priority: number, heavy = false): void {
    this.add(at, { kind: 'number', anchor, tone, size, text, priority, lane: 0, durMs: NUMBER_DUR[size], ...(heavy ? { heavy } : {}) })
  }
}

const MAX_LANES = 4
/** One portrait never carries more than four labels at once; the most important ones keep the lowest lanes, the rest are dropped. */
function arrangeNumbers(list: Raw[]): Raw[] {
  const numbers = list.filter((beat): beat is Raw & { kind: 'number' } => beat.kind === 'number')
  const others = list.filter(beat => beat.kind !== 'number')
  const placed: (Raw & { kind: 'number' })[] = []
  for (const beat of [...numbers].sort((a, b) => a.priority - b.priority || a.at - b.at)) {
    let lane = 0
    const overlaps = (other: Raw & { kind: 'number' }) => other.anchor === beat.anchor && other.lane === lane && other.at < beat.at + beat.durMs && beat.at < other.at + other.durMs
    while (placed.some(overlaps)) lane += 1
    if (lane >= MAX_LANES) continue
    placed.push({ ...beat, lane, at: beat.at + lane * NUMBER_STAGGER })
  }
  return [...others, ...placed]
}

function reduceMotion(beats: Raw[], impactMs: number, lead: Raw | null): { beats: Raw[]; impactMs: number } {
  const factor = 0.4
  const impact = Math.max(80, Math.round(impactMs * factor))
  const reduced = beats.map((beat): Raw => {
    const at = Math.round(beat.at * factor)
    if (beat.kind === 'number') return { ...beat, at, durMs: 460 }
    const durMs = Math.max(240, Math.round(beat.durMs * 0.5))
    if ('landMs' in beat) {
      const landMs = beat === lead ? Math.max(50, impact - at) : Math.max(50, Math.round(beat.landMs * factor))
      return { ...beat, at, landMs, durMs: Math.max(durMs, landMs + 220) }
    }
    return { ...beat, at, durMs }
  })
  return { beats: reduced, impactMs: impact }
}

function finalize(input: { scenario: string; actor: 'card' | 'enemy'; motion: Motion; raw: Raw[]; impactMs: number; reaction: Reaction; lead: Raw | null }): VfxPlan {
  let beats = arrangeNumbers(input.raw)
  let impactMs = input.impactMs
  // Reduced motion rewrites the lead beat as a copy and moves `impactMs` with it, so the landing and the impact stay one moment.
  if (input.motion === 'reduced') ({ beats, impactMs } = reduceMotion(beats, impactMs, input.lead))
  beats.sort((a, b) => a.at - b.at)
  const endMs = beats.reduce((end, beat) => Math.max(end, beat.at + beat.durMs), impactMs)
  return {
    scenario: input.scenario + (input.motion === 'reduced' ? ':reduced' : ''), actor: input.actor, motion: input.motion, beats: beats as VfxBeat[],
    impactMs, fallbackImpactMs: impactMs + FALLBACK_MARGIN, recoveryMs: Math.max(endMs + RECOVERY_MARGIN, impactMs + MIN_AFTER_IMPACT), endMs, reaction: input.reaction,
  }
}

const statusTone: Record<StatusId, NumberTone> = { vulnerability: 'vulnerability', bleeding: 'bleed', frostbite: 'frost' }

/* ───────────────────────────── cards ───────────────────────────── */

export interface CardPlanInput { card: CardDefinition; play: PendingPlay; state: BattleState; motion?: Motion }

export function cardVfxPlan({ card, play, state, motion = 'full' }: CardPlanInput): VfxPlan {
  const p = play.preview
  const effects: readonly CardEffect[] = p.resolvedEffects ?? play.effects
  const style = cardVfxStyle(card)
  const owner = cardOwner(state.heroes, card)
  // The side a spell is cast from follows the card's class when the party has no unique owner of it.
  const caster: HeroId = owner.ok ? owner.hero : card.className === 'mage' ? 'mage' : 'warrior'
  const guardStyle: GuardStyle = style.guard ?? (card.className === 'mage' ? 'arcane' : 'steel')
  const armorHeroes = heroIdsInPartyOrder(state.heroes).filter(id => p.armor[id] > 0).sort((a, b) => p.armor[b] - p.armor[a])
  const dealsDamage = p.damage > 0
  const weight = weightOf(p.damage)
  const spent = (id: StatusId) => play.consumedStatuses.some(item => item.carrier === 'enemy' && item.id === id)
  const b = new Beats()
  let lead: Raw
  let land: number

  if (dealsDamage) {
    // A defensive card with a counterblow guards first; the blow is a quick one that lands as the shield completes.
    const counter = card.kind === 'defense'
    let strikeStyle: StrikeStyle = style.strike ?? (card.className === 'mage' ? 'arcane-bolt' : 'slash')
    if (!counter && p.damage >= 9 && (strikeStyle === 'slash' || strikeStyle === 'lunge')) strikeStyle = 'cleave'
    if (counter) strikeStyle = 'lunge'
    const timing = STRIKE_TIMING[strikeStyle]
    const startAt = counter ? GUARD_TIMING.land - timing.land + 10 : 0
    lead = b.add(startAt, {
      kind: 'strike', style: strikeStyle, school: style.school, from: caster, to: 'enemy', weight, landMs: timing.land, durMs: timing.land + timing.tail,
      ...(p.armorBonus > 0 || p.artifactDamage > 0 ? { empowered: true } : {}),
    })
    land = startAt + timing.land
    if (counter) for (const [index, hero] of armorHeroes.entries()) b.add(index * 70, { kind: 'guard', style: guardStyle, anchor: hero, landMs: GUARD_TIMING.land, durMs: GUARD_TIMING.dur })
    else for (const [index, hero] of armorHeroes.entries()) b.add(land - 100 + index * 80, { kind: 'guard', style: guardStyle, anchor: hero, landMs: GUARD_TIMING.land, durMs: GUARD_TIMING.dur })
  } else if (armorHeroes.length) {
    lead = b.add(0, { kind: 'guard', style: guardStyle, anchor: armorHeroes[0]!, landMs: GUARD_TIMING.land, durMs: GUARD_TIMING.dur })
    land = GUARD_TIMING.land
    for (const [index, hero] of armorHeroes.slice(1).entries()) b.add(80 * (index + 1), { kind: 'guard', style: guardStyle, anchor: hero, landMs: GUARD_TIMING.land, durMs: GUARD_TIMING.dur })
  } else {
    const onEnemy = effects.some(effect => effect.type === 'status' || effect.type === 'status-tick')
    lead = b.add(0, { kind: 'rune', sigil: style.rune ?? (onEnemy ? 'mark' : 'insight'), school: style.school, anchor: onEnemy ? 'enemy' : caster, landMs: RUNE_TIMING.land, durMs: RUNE_TIMING.dur })
    land = RUNE_TIMING.land
  }

  /* Enemy armor meeting the hit. It holds (sparks) or it is gone (shards): read from the engine's split. */
  if (p.armorDamage > 0) b.add(land, { kind: 'armor-fx', mode: state.enemy.armor - p.armorDamage <= 0 ? 'break' : 'hit', anchor: 'enemy', durMs: ARMOR_FX_DUR })

  /* Statuses the hit spends. The mark leaves with the blow; a spent Frostbite shatters only because it was really there. */
  if (spent('vulnerability')) b.add(land, { kind: 'status', status: 'vulnerability', mode: 'consume', anchor: 'enemy', durMs: STATUS_DUR.consume })
  if (spent('bleeding')) b.add(land, { kind: 'status', status: 'bleeding', mode: 'burst', anchor: 'enemy', durMs: STATUS_DUR.burst })
  if (spent('frostbite')) b.add(land, { kind: 'status', status: 'frostbite', mode: 'consume', anchor: 'enemy', durMs: STATUS_DUR.consume })

  /* A status acting on its own (a `status-tick` card): the same pulse the enemy turn shows. */
  if (p.statusDamage > 0) for (const effect of effects) if (effect.type === 'status-tick') b.add(land + 40, { kind: 'status', status: effect.status, mode: 'tick', anchor: 'enemy', durMs: STATUS_DUR.tick })

  /* Statuses put on the enemy. Re-applying one that is already there and does not stack changes nothing, so it shows nothing. */
  let applyAt = land + 110
  for (const effect of effects) {
    if (effect.type !== 'status') continue
    const definition = statusDefinition(effect.status)
    const held = statusValue(state, 'enemy', effect.status) > 0 && !spent(effect.status)
    if (held && definition.stacking === 'refresh') continue
    b.add(applyAt, { kind: 'status', status: effect.status, mode: 'apply', anchor: 'enemy', durMs: STATUS_DUR.apply })
    b.number('enemy', applyAt + 40, statusTone[effect.status], 's', definition.name, 5)
    applyAt += 70
  }

  /* New cards. The count is the engine's own (hand limit and piles already applied). */
  if (p.draw > 0) {
    b.add(land + 130, { kind: 'draw', from: caster, count: Math.min(3, p.draw), durMs: DRAW_DUR })
    b.number(caster, land + 130, 'draw', 'm', `+${p.draw} ${cardsWord(p.draw)}`, 3)
  }

  /* Numbers, most important first: health, enemy armor, health from a status tick, armor gained, bonuses. */
  if (p.healthDamage > 0) b.number('enemy', land + 30, 'damage', weight === 'heavy' ? 'xl' : weight === 'light' ? 'm' : 'l', `−${p.healthDamage}`, 1, weight === 'heavy')
  if (p.armorDamage > 0) b.number('enemy', land + 30, 'armor-hit', p.healthDamage > 0 ? 'm' : 'l', `−${p.armorDamage} брони`, p.healthDamage > 0 ? 2 : 1)
  if (p.statusDamage > 0) b.number('enemy', land + 140, 'bleed', 'm', `−${p.statusDamage}`, 2)
  for (const hero of armorHeroes) b.number(hero, land + 60, 'armor-gain', 'm', `+${p.armor[hero]} брони`, 3)
  for (const part of p.damageParts) if (part.kind !== 'base' && part.amount > 0) b.number('enemy', land + 90, part.kind === 'status' && part.id === 'vulnerability' ? 'vulnerability' : 'bonus', 's', `${part.label} +${part.amount}`, 4)

  const reaction: Reaction = p.healthDamage > 0 ? { enemy: weightOf(p.healthDamage) } : p.statusDamage > 0 ? { enemy: 'light' } : {}
  return finalize({ scenario: 'card:' + card.id, actor: 'card', motion, raw: b.list, impactMs: land, reaction, lead })
}

/* ───────────────────────────── enemy turn ───────────────────────────── */

export interface EnemyPlanInput { state: BattleState; forecast: EnemyActionForecast; motion?: Motion }

function outcomeOf(hit: EnemyTargetForecast): HeroOutcome | null {
  if (hit.attack <= 0) return 'fizzle'
  if (hit.absorbed > 0 && hit.healthLoss === 0) return 'block'
  if (hit.absorbed > 0 && (hit.pierced ?? 0) > 0) return 'pierce'
  if (hit.absorbed > 0) return 'shatter'
  return null
}

export function enemyVfxPlan({ state, forecast, motion = 'full' }: EnemyPlanInput): VfxPlan {
  const action = forecast.action
  const boss = enemyTier(state.enemy.encounterId) === 'boss'
  const b = new Beats()
  const reaction: Reaction = {}
  let scenario = 'enemy:' + action.kind + (boss ? ':boss' : '')
  let lead: Raw | null = null
  let land = 0
  let start = 0

  /* Start of the enemy's turn: a Bleeding tick acts before the announced action, and may end the fight before it. */
  const tickTotal = pendingTickDamage(state, 'enemy')
  const tick = Math.min(state.enemy.health, tickTotal)
  if (tick > 0) {
    b.add(0, { kind: 'status', status: 'bleeding', mode: 'tick', anchor: 'enemy', durMs: STATUS_DUR.tick })
    b.number('enemy', 130, 'bleed', 'm', `−${tick}`, 2)
    reaction.enemy = 'light'
    land = 150
    start = 240
  }
  if (tickTotal >= state.enemy.health) return finalize({ scenario: 'enemy:bleed-out', actor: 'enemy', motion, raw: b.list, impactMs: 150, reaction, lead: null })

  const stopped = forecast.interrupt?.broken === true
  if (stopped) {
    scenario = 'enemy:stopped' + (boss ? ':boss' : '')
    lead = b.add(start, { kind: 'break', anchor: 'enemy', ...(boss ? { boss } : {}), landMs: BREAK_TIMING.land, durMs: BREAK_TIMING.dur })
    land = start + BREAK_TIMING.land
    b.number('enemy', land + 50, 'info', 'm', 'Удар сорван', 1)
  } else if (action.kind === 'attack' || action.kind === 'attack_all') {
    const hits = forecast.targets
    const frostSpent = hits.some(hit => hit.consumedStatuses.some(item => item.carrier === 'enemy' && item.id === 'frostbite'))
    if (frostSpent) b.add(start, { kind: 'status', status: 'frostbite', mode: 'consume', anchor: 'enemy', durMs: STATUS_DUR.consume })
    const from = start + (frostSpent ? 60 : 0)
    let last = 0
    for (const [index, hit] of hits.entries()) {
      const hero = state.heroes[hit.target]
      const weight = weightOf(hit.attack)
      const pierces = (hit.pierced ?? 0) > 0
      const strikeStyle: StrikeStyle = pierces && action.kind === 'attack' ? 'needle' : weight === 'heavy' || (boss && action.kind === 'attack_all') ? 'slam' : 'claw'
      const timing = STRIKE_TIMING[strikeStyle]
      const at = from + index * 110
      const hitLand = at + timing.land
      last = Math.max(last, hitLand)
      const spentVulnerability = hit.consumedStatuses.some(item => item.carrier === hit.target && item.id === 'vulnerability')
      // A hit weakened to nothing does not fly at all: its only trace is the word.
      if (hit.attack > 0) {
        const strike = b.add(at, {
          kind: 'strike', style: strikeStyle, school: 'physical', from: 'enemy', to: hit.target, weight, landMs: timing.land, durMs: timing.land + timing.tail,
          ...(boss ? { boss } : {}), ...(spentVulnerability ? { empowered: true } : {}), ...((hit.chill ?? 0) > 0 ? { chilled: true } : {}),
        })
        lead ??= strike
      }
      const outcome = outcomeOf(hit)
      if (outcome) b.add(hitLand, { kind: 'result', outcome, hero: hit.target, style: hero.classId === 'mage' ? 'arcane' : 'steel', durMs: RESULT_DUR })
      const size: NumberSize = weight === 'heavy' ? 'xl' : weight === 'light' ? 'm' : 'l'
      if (hit.healthLoss > 0) {
        b.number(hit.target, hitLand + 30, hit.lethal ? 'lethal' : 'damage', size, `−${hit.healthLoss}`, 1, weight === 'heavy')
        reaction[hit.target] = hit.lethal ? 'heavy' : weightOf(hit.healthLoss)
      }
      if (hit.absorbed > 0) {
        if (hit.healthLoss === 0) b.number(hit.target, hitLand + 30, 'block', 'l', 'БЛОК', 1)
        b.number(hit.target, hitLand + 30, 'armor-hit', 'm', `−${hit.absorbed} брони`, 2)
      }
      if (hit.attack <= 0) b.number(hit.target, hitLand, 'frost', 'm', 'Ослаблено', 1)
      if (pierces) b.number(hit.target, hitLand + 90, 'damage', 's', 'Бронебой', 4)
      if ((hit.chill ?? 0) > 0 && hit.attack > 0) b.number(hit.target, hitLand + 90, 'frost', 's', `Мороз −${hit.chill}`, 4)
      for (const part of hit.parts) if (part.kind === 'status' && part.amount > 0) b.number(hit.target, hitLand + 70, 'vulnerability', 's', `${part.label} +${part.amount}`, 3)
      if (hit.exposes && !hit.lethal) {
        b.add(hitLand + 130, { kind: 'status', status: 'vulnerability', mode: 'apply', anchor: hit.target, durMs: STATUS_DUR.apply })
        b.number(hit.target, hitLand + 170, 'vulnerability', 's', 'Уязвимость', 5)
      }
    }
    land = last
    scenario = `enemy:${action.kind}${hits.some(hit => hit.attack > 0 && weightOf(hit.attack) === 'heavy') ? ':heavy' : ''}${boss ? ':boss' : ''}`
  } else if (action.kind === 'defend' || action.kind === 'recover') {
    lead = b.add(start, { kind: 'guard', style: 'plate', anchor: 'enemy', landMs: PLATE_TIMING.land, durMs: PLATE_TIMING.dur })
    land = start + PLATE_TIMING.land
    if (forecast.armorGain > 0) b.number('enemy', land + 40, 'armor-gain', 'm', `+${forecast.armorGain} брони`, 1)
    else b.number('enemy', land + 40, 'info', 's', 'Броня на пределе', 1)
    if (forecast.powerGain) {
      b.add(land + 140, { kind: 'status', status: 'rage', mode: 'apply', anchor: 'enemy', durMs: STATUS_DUR.apply })
      b.number('enemy', land + 180, 'rage', 'm', `Ярость +${forecast.powerGain}`, 2)
    }
  } else {
    // A preparation: the party is shown who is aimed at and that something is coming, never how hard. Only the public intent is read.
    const intent = publicIntent(forecast)
    if (intent.kind !== 'prepare') throw new Error('Unexpected intent for a preparation')
    lead = b.add(start, { kind: 'gather', anchor: 'enemy', ...(boss ? { boss } : {}), targets: [...intent.targets], landMs: GATHER_TIMING.land, durMs: GATHER_TIMING.dur })
    land = start + GATHER_TIMING.land
    b.number('enemy', land + 20, 'info', 's', 'Готовит удар', 1)
  }
  return finalize({ scenario, actor: 'enemy', motion, raw: b.list, impactMs: land, reaction, lead })
}

/** Schools are used by painters for palettes; exported so a lab or a test can name them without importing the table. */
export const schools: readonly School[] = ['physical', 'fire', 'frost', 'lightning', 'arcane', 'blood']
