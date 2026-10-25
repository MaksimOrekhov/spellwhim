import { MAX_HAND_SIZE, cardDefinition, encounters, startingDeck } from './types'
import { drawForTurn, gameEconomy, manaForTurn } from './economy'
import type { EconomyConfig } from './economy'
import { discardHand, drawCards, shuffle } from './deck'
import { resolveCardDefinition } from './cardProgression'
import type { DeckInput } from './types'
import { artifactDefinition } from './artifacts'
import { composeHit, splitDamage, sumParts } from './damage'
import { cardOwner, characterGenitive, heroForClass, heroIdsInPartyOrder, partnerOf as partnerOfHero, resolveArmorTarget } from './party'
import { applyStatus, carrierHasStatus, clearStatuses, cloneStatuses, consumeStatus, createStatuses, decayStatus, dueTicks, hitBonuses, lifetimeTickDamage, outgoingReductions, statusDefinition, statusValue } from './statuses'
import type { ArtifactInstance, BattleArtifactState, BattleState, CardClassId, CardEffect, CardDefinition, CardPreview, ConsumedStatus, EncounterDefinition, EnemyAction, EnemyHit, HeroId, HitPart, PendingArtifactTrigger, PendingPlay, StatusCarrierId, StatusId } from './types'

export interface BattleOptions {
  deck?: DeckInput
  seed?: number
  battleId?: string
  openingHandSize?: number
  /** Mana curve and draw schedule; standard model B when omitted. Balance Lab passes model A explicitly. */
  economy?: EconomyConfig
  artifacts?: readonly ArtifactInstance[]
  /** Armor a hero already carries when the battle begins (a one-battle boon from a dungeon event); applied after the usual armor reset. */
  startingArmor?: Partial<Record<HeroId, number>>
}
const ENEMY_ARMOR_CAP = 8
/** B1: the most a raging enemy can add to its announced hits. */
const ENEMY_POWER_CAP = 6

type Failure = { ok: false; reason: 'mana' | 'finished' | 'busy' | 'not-in-hand' | 'stale-action' }
export type PlayStartResult = { ok: true; play: PendingPlay } | Failure
export type PlayResult = { ok: true; outcome: CardPreview; drawn: number; damageDealt: number } | Failure

function updateResult(state: BattleState): void {
  if (state.result) return
  if (Object.values(state.heroes).some(hero => hero.health <= 0)) state.result = 'defeat'
  else if (state.enemy.health <= 0) state.result = 'victory'
  if (state.result) clearStatuses(state)
}

export function createBattle(encounter: EncounterDefinition = encounters[1]!, previousHeroes?: BattleState['heroes'], options: BattleOptions = {}): BattleState {
  const seed = (options.seed ?? 1) >>> 0
  const economy = options.economy ?? gameEconomy
  const battleId = options.battleId ?? encounter.id + ':' + seed
  const heroes = previousHeroes
    ? { warrior: { ...previousHeroes.warrior, armor: 0 }, mage: { ...previousHeroes.mage, armor: 0 } }
    : {
      warrior: { id: 'warrior' as const, characterId: 'varian', classId: 'warrior' as const, partySlot: 'first' as const, instanceId: battleId + '/hero/first', name: 'Вариан Ринн', title: 'Король Штормграда', health: 25, maxHealth: 25, armor: 0, icon: '⚔' },
      mage: { id: 'mage' as const, characterId: 'jaina', classId: 'mage' as const, partySlot: 'second' as const, instanceId: battleId + '/hero/second', name: 'Джайна Праудмур', title: 'Верховная волшебница Кирин-Тора', health: 18, maxHealth: 18, armor: 0, icon: '✦' },
    }
  for (const id of Object.keys(options.startingArmor ?? {}) as HeroId[]) heroes[id].armor += Math.max(0, options.startingArmor![id] ?? 0)
  const artifacts: BattleArtifactState[] = (options.artifacts ?? []).map(item => ({ ...item, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false }))
  const state: BattleState = {
    battleId, seed, rngState: seed, nextActionId: 1, heroes, statuses: createStatuses(), artifacts, artifactNotices: [],
    enemy: { encounterId: encounter.id, name: encounter.name, title: encounter.title, health: encounter.maxHealth, maxHealth: encounter.maxHealth, armor: 0, appearance: encounter.appearance, phase: 1, nextActionPhase: 1, behavior: encounter.behavior, behaviorIndex: 1, nextAction: encounter.behavior.phase1[0]!, focus: initialFocus(heroes, encounter.behavior.phase1[0]!), ...(encounter.phaseNote ? { phaseNote: encounter.phaseNote } : {}) },
    hand: [], classesPlayedThisTurn: [], blockedDraws: 0, drawPile: [], discardPile: [], exhausted: [], pending: null,
    economy, mana: manaForTurn(economy, 1), maxMana: manaForTurn(economy, 1), turn: 1, result: null,
  }
  const copies = (options.deck ?? startingDeck).map((card, index) => {
    if (typeof card === 'string') return { instanceId: battleId + '/card/' + (index + 1), definitionId: cardDefinition(card).id }
    resolveCardDefinition(card)
    return { ...card }
  })
  if (new Set(copies.map(card => card.instanceId)).size !== copies.length) throw new Error('Duplicate card instance')
  state.drawPile = shuffle(state, copies)
  updateResult(state)
  drawCards(state, options.openingHandSize ?? economy.openingHand)
  return state
}

function hitFocus(action: EnemyAction, fallback: HeroId): HeroId {
  const hit = action.kind === 'prepare' ? action.prepared : action
  return hit.kind === 'attack' ? hit.target : hit.kind === 'attack_all' ? hit.primaryTarget : fallback
}
function hitOf(action: EnemyAction): EnemyHit | null { return action.kind === 'attack' || action.kind === 'attack_all' ? action : null }
/** B1: a hit announced after the enemy has raged is that much harder. The action it replaces is never edited once announced. */
function withPower(action: EnemyAction, power: number): EnemyAction {
  if (power <= 0) return action
  if (action.kind === 'attack' || action.kind === 'attack_all') return { ...action, damage: action.damage + power }
  if (action.kind === 'prepare') return { ...action, prepared: withPower(action.prepared, power) as EnemyHit }
  return action
}
function schedule(state: BattleState): EnemyAction[] { return state.enemy.phase === 2 ? state.enemy.behavior.phase2 ?? state.enemy.behavior.phase1 : state.enemy.behavior.phase1 }
/** Without a named target the focus starts on the first party slot. */
function initialFocus(heroes: BattleState['heroes'], action: EnemyAction): HeroId { return hitFocus(action, heroIdsInPartyOrder(heroes)[0]!) }

function heroForArtifact(state: BattleState, artifact: BattleArtifactState): HeroId | undefined {
  return (Object.keys(state.heroes) as HeroId[]).find(id => state.heroes[id].instanceId === artifact.ownerInstanceId)
}

function markArtifactUsed(state: BattleState, artifact: BattleArtifactState, reason: string, perTurn = false): void {
  if (perTurn) artifact.lastTriggeredTurn = state.turn
  else artifact.usedThisBattle = true
  state.artifactNotices.push(`${artifactDefinition(artifact.definitionId).name}: ${reason}`)
}

/** Whether `carrier` (the enemy unless stated) currently holds the status. A finished battle holds none. */
export function hasStatus(state: BattleState, status: StatusId, carrier: StatusCarrierId = 'enemy'): boolean {
  return !state.result && carrierHasStatus(state, carrier, status)
}

function zeroArmor(heroes: BattleState['heroes']): Record<HeroId, number> {
  const result = {} as Record<HeroId, number>
  for (const id of heroIdsInPartyOrder(heroes)) result[id] = 0
  return result
}

function resolvedClassHeroes(heroes: BattleState['heroes']): Partial<Record<CardClassId, HeroId>> {
  const result: Partial<Record<CardClassId, HeroId>> = {}
  for (const id of heroIdsInPartyOrder(heroes)) {
    const lookup = heroForClass(heroes, heroes[id].classId)
    if (lookup.ok) result[heroes[id].classId] = lookup.hero
  }
  return result
}

/**
 * The only place where the enemy loses armor and health, shared by card damage and (future) status ticks, so both
 * reach the same phase threshold and the same end of battle. Returns the health actually lost.
 */
function damageEnemy(state: BattleState, amount: number, ignoresArmor = false): number {
  const enemy = state.enemy
  const split = splitDamage({ armor: ignoresArmor ? 0 : enemy.armor, health: enemy.health }, amount)
  enemy.armor -= split.absorbed
  enemy.health = Math.max(0, enemy.health - split.healthLoss)
  if (enemy.phase === 1 && enemy.behavior.phase2 && enemy.health * 2 <= enemy.maxHealth) {
    enemy.phase = 2
    enemy.behaviorIndex = 0
    enemy.phaseShiftTurn = state.turn
  }
  return split.healthLoss
}

/** Runs one tick of an enemy status: damage (through `damageEnemy`, so phases and victory stay in step), then decay. Returns the health lost. */
function tickEnemyStatus(state: BattleState, due: { id: StatusId; value: number; tick: { damage: boolean; ignoresArmor: boolean; decay: number } }): number {
  const lost = due.tick.damage ? damageEnemy(state, due.value, due.tick.ignoresArmor) : 0
  decayStatus(state, 'enemy', due.id, due.tick.decay)
  return lost
}

/**
 * Start of the enemy's turn, after "end turn" and before its announced action. Statuses with a `tick` rule act here
 * (today Bleeding): the loop is data-driven, and the same tick is what a `status-tick` card runs ahead of time.
 */
function runEnemyTurnStart(state: BattleState): void {
  for (const due of dueTicks(state, 'enemy', 'enemy-turn-start')) {
    if (state.result) return
    tickEnemyStatus(state, due)
    updateResult(state)
  }
}

/** True when the announced hit lands on both heroes, so "the threatened hero" is a choice and not a fact. */
function hitsBothHeroes(state: BattleState): boolean {
  const action = state.enemy.nextAction
  const hit = action.kind === 'prepare' ? action.prepared : action
  return hit.kind === 'attack_all'
}

/**
 * The hero a card's "threatened" armor goes to. Against one target it is that target, always. Against a hit on both heroes the player may
 * choose (`chosen`); without a choice the enemy's own focus (the hit's main target) is used, exactly as before.
 */
export function armorFocusOf(state: BattleState, chosen?: HeroId): HeroId {
  return chosen !== undefined && chosen in state.heroes && hitsBothHeroes(state) ? chosen : state.enemy.focus
}

function buildPlan(state: BattleState, card: CardDefinition, historical = false, chosen?: HeroId): Omit<PendingPlay, 'actionId' | 'card' | 'handIndex'> {
  const focus = armorFocusOf(state, chosen)
  const enemyAction = state.enemy.nextAction
  const enemyAttacking = enemyAction.kind === 'attack' || enemyAction.kind === 'attack_all'
  const allEffects = card.effects.filter(effect => effect.type !== 'damage' || effect.when !== 'enemy-attacking' || enemyAttacking)
  const baseDamage = allEffects.reduce((sum, effect) => sum + (effect.type === 'damage' ? effect.amount : 0), 0)
  // One list of labelled parts, in the order fixed by damage.ts: base, class condition, statuses, artifacts.
  const owner = cardOwner(state.heroes, card)
  const parts: HitPart[] = []
  const consumedStatuses: ConsumedStatus[] = []
  const spool = state.artifacts.find(artifact => artifact.definitionId === 'tension-spool' && artifact.armedThisTurn && artifact.lastTriggeredTurn !== state.turn && baseDamage > 0)
  if (baseDamage > 0) {
    parts.push({ kind: 'base', id: 'card', label: 'Урон карты', amount: baseDamage })
    if (card.damageBonus?.condition === 'owner-has-armor' && owner.ok && state.heroes[owner.hero].armor > 0) {
      parts.push({ kind: 'class-bonus', id: 'owner-armor', label: 'Броня ' + characterGenitive(state.heroes[owner.hero].characterId), amount: card.damageBonus.amount })
    } else if (card.damageBonus?.condition === 'other-class-played' && state.classesPlayedThisTurn.some(classId => classId !== card.className)) {
      parts.push({ kind: 'class-bonus', id: 'other-class', label: 'Карта другого класса', detail: 'Уже сыграна карта другого класса', amount: card.damageBonus.amount })
    }
    for (const bonus of hitBonuses(state, 'enemy')) {
      parts.push({ kind: 'status', id: bonus.id, label: bonus.label, amount: bonus.amount })
      consumedStatuses.push({ carrier: 'enemy', id: bonus.id })
    }
    for (const effect of allEffects) {
      if (effect.type !== 'status-burst') continue
      const value = statusValue(state, 'enemy', effect.status)
      if (value <= 0) continue
      const name = statusDefinition(effect.status).name
      parts.push({ kind: 'status', id: effect.status + '-burst', label: name, detail: `${name} · ${value} × ${effect.perPoint}`, amount: value * effect.perPoint })
      consumedStatuses.push({ carrier: 'enemy', id: effect.status, amount: value })
    }
    if (spool) parts.push({ kind: 'artifact', id: 'tension-spool', label: 'Натяжной шкив', detail: 'Натяжной шкив · первая атакующая карта отряда', amount: 2 })
  }
  const hit = composeHit(parts)
  const damage = hit.total
  // Most plays carry no modifier at all, so the per-kind totals are only gathered when there is one.
  let vulnerabilityBonus = 0
  let armorBonus = 0
  let artifactDamage = 0
  const bonusLabels: string[] = []
  if (hit.parts.length > 1) {
    for (const part of hit.parts) {
      if (part.kind === 'status' && part.id === 'vulnerability') vulnerabilityBonus += part.amount
      else if (part.kind === 'class-bonus' && part.id === 'owner-armor') armorBonus += part.amount
      else if (part.kind === 'artifact') artifactDamage += part.amount
    }
    // Labels keep the established reading order of the log: statuses, then class condition, then artifacts.
    for (const kind of ['status', 'class-bonus', 'artifact'] as const) for (const part of hit.parts) if (part.kind === kind && part.amount > 0) bonusLabels.push(part.label)
  }
  const split = splitDamage(state.enemy, damage)
  const armorDamage = split.absorbed
  const healthDamage = split.healthLoss
  const effects: CardEffect[] = allEffects.filter(effect => effect.type !== 'damage' && effect.type !== 'status-burst')
  // Deal the entire hit together, before secondary effects. A lethal hit stops the action.
  if (damage > 0) effects.unshift({ type: 'damage', amount: damage })
  // Probe the already composed plan in order. Reuse the actual status/damage operations; no RNG or live mutation.
  const probe = { ...state, enemy: { ...state.enemy }, statuses: cloneStatuses(state.statuses) }
  for (const spent of consumedStatuses) consumeStatus(probe, spent.carrier, spent.id, spent.amount ?? 1)
  const reachable: CardEffect[] = []
  let statusDamage = 0
  let statusFuture = 0
  let draw = 0
  let drawRoom = Math.max(0, MAX_HAND_SIZE - Math.max(0, state.hand.length - 1))
  let drawAvailable = state.drawPile.length + state.discardPile.length
  for (const effect of effects) {
    if (!historical && (state.result || probe.enemy.health <= 0)) break
    reachable.push(effect)
    if (effect.type === 'damage') damageEnemy(probe, effect.amount)
    else if (effect.type === 'status-tick') {
      const due = dueTicks(probe, 'enemy', 'enemy-turn-start').find(item => item.id === effect.status)
      if (due) statusDamage += tickEnemyStatus(probe, due)
    } else if (effect.type === 'status') {
      const before = lifetimeTickDamage(effect.status, statusValue(probe, 'enemy', effect.status))
      applyStatus(probe, 'enemy', effect.status, effect.amount ?? 1)
      statusFuture += lifetimeTickDamage(effect.status, statusValue(probe, 'enemy', effect.status)) - before
    } else if (effect.type === 'draw') {
      const amount = Math.min(effect.amount, drawAvailable, drawRoom)
      draw += historical ? effect.amount : amount
      drawRoom -= amount
      drawAvailable -= amount
    }
  }
  if (!historical && probe.enemy.health <= 0) statusFuture = 0
  const armor = zeroArmor(state.heroes)
  for (const effect of reachable) {
    if (effect.type !== 'armor') continue
    const target = resolveArmorTarget(state.heroes, effect.target, focus)
    if (target) armor[target] += effect.amount
  }
  const artifactArmor = zeroArmor(state.heroes)
  const artifactTriggers: PendingArtifactTrigger[] = []
  const consumesVulnerability = consumedStatuses.some(item => item.carrier === 'enemy' && item.id === 'vulnerability')
  if (spool) {
    const spoolOwner = heroForArtifact(state, spool)
    if (spoolOwner) artifactTriggers.push({ artifactInstanceId: spool.instanceId, reason: 'Натяжной шкив: +2 к первой наносящей урон карте отряда этого хода', kind: 'turn-damage', owner: spoolOwner, amount: 2 })
  }
  for (const artifact of state.artifacts) {
    const artifactOwner = heroForArtifact(state, artifact)
    if (!artifactOwner) continue
    if (artifact.definitionId === 'weakpoint-lens' && consumesVulnerability && state.enemy.health - healthDamage > 0 && !artifact.usedThisBattle) {
      artifactArmor[artifactOwner] += 2
      artifactTriggers.push({ artifactInstanceId: artifact.instanceId, reason: 'Уязвимость была израсходована', kind: 'armor', owner: artifactOwner, amount: 2, target: artifactOwner })
    }
    if (artifact.definitionId === 'double-pulley' && armor[artifactOwner] > 0 && artifact.lastTriggeredTurn !== state.turn) {
      const partner = partnerOfHero(state.heroes, artifactOwner)
      artifactArmor[partner] += 2
      artifactTriggers.push({ artifactInstanceId: artifact.instanceId, reason: 'Карта укрепила владельца', kind: 'armor', owner: artifactOwner, amount: 2, target: partner })
    }
  }
  for (const id of heroIdsInPartyOrder(state.heroes)) armor[id] += artifactArmor[id]
  const usesClassTarget = effects.some(effect => effect.type === 'armor' && effect.target.startsWith('class:'))
  return {
    effects,
    consumedStatuses,
    artifactTriggers,
    preview: {
      ...(!historical ? { resolvedEffects: reachable } : {}),
      damage, armorDamage, healthDamage, armor, artifactDamage, artifactArmor,
      bonusDamage: damage > 0 && hit.parts.length > 1 ? sumParts(hit.parts) - baseDamage : 0, vulnerabilityBonus, armorBonus,
      draw,
      bonuses: bonusLabels,
      artifactBonuses: artifactTriggers.map(trigger => trigger.reason),
      appliedStatuses: reachable.flatMap(effect => effect.type === 'status' ? [effect.status] : []), statusDamage, statusFuture,
      damageParts: hit.parts,
      bonusOwner: card.damageBonus?.condition === 'owner-has-armor' && owner.ok ? { hero: owner.hero, characterId: state.heroes[owner.hero].characterId } : null,
      classHeroes: usesClassTarget ? resolvedClassHeroes(state.heroes) : {},
    },
  }
}

export function previewCard(state: BattleState, card: CardDefinition, mode?: 'historical', armorFocus?: HeroId): CardPreview {
  return buildPlan(state, card, mode === 'historical', armorFocus).preview
}

/** One way to spend a card's armor against a hit on both heroes: who ends up with how much, and what the hit then costs each of them. */
export interface ArmorChoiceOption {
  /** Pass this to `startCardPlay` / `playCard` to play the card this way. */
  focus: HeroId
  /** Armor each hero really gains from this play (artifact triggers included; a play stopped by a lethal blow gives less). */
  armor: Record<HeroId, number>
  /** Health each hero loses to the announced hit after this play; `null` when no hit lands before the armor would expire. */
  loss: Record<HeroId, number> | null
  /** Some hero would die from the announced hit. */
  lethal: boolean
  /** `hit`: the blow lands; `broken`: this play's damage stops it; `victory`: this play defeats the enemy, so there is no blow; `expired`: armor is gone before a prepared blow. */
  outcome: 'hit' | 'broken' | 'victory' | 'expired'
}
export interface ArmorChoice {
  options: ArmorChoiceOption[]
  /** What the card does without a choice (the hit's main target). */
  auto: HeroId
  /** The announced hit: its name and whether it lands this enemy turn (a prepared hit lands on the next one). */
  hit: { name: string; imminent: boolean }
}

/**
 * Cards that give armor to "the threatened hero" and/or "the partner" (guard, Ice Ward, Bastion, ...) need a decision only against a
 * hit on both heroes. Returns `null` otherwise, so a single-target hit keeps its automatic choice and costs the player no click.
 * Each option is the real thing: the card is played through the engine on a copy of the battle (damage, statuses, interrupt progress,
 * armor, artifacts, a lethal blow that stops the rest of the card), and the enemy's announced hit is forecast on the result.
 */
export function armorChoice(state: BattleState, instanceId: string): ArmorChoice | null {
  const instance = state.hand.find(item => item.instanceId === instanceId)
  if (!instance || state.result || state.pending || !hitsBothHeroes(state)) return null
  const card = resolveCardDefinition(instance)
  if (!card.effects.some(effect => effect.type === 'armor' && (effect.target === 'threatened' || effect.target === 'partner'))) return null
  // Equal shares (Commander's Order: 5 and 5) leave nothing to decide: either choice gives each hero the same armor, so nobody is asked.
  const share = (target: 'threatened' | 'partner') => card.effects.reduce((sum, effect) => sum + (effect.type === 'armor' && effect.target === target ? effect.amount : 0), 0)
  if (share('threatened') === share('partner')) return null
  const prepared = state.enemy.nextAction.kind === 'prepare'
  const ids = heroIdsInPartyOrder(state.heroes)
  const options = ids.map((focus): ArmorChoiceOption => {
    const copy = structuredClone(state)
    copy.mana = Math.max(copy.mana, card.cost)
    const played = playCard(copy, instanceId, focus)
    const armor = Object.fromEntries(ids.map(id => [id, copy.heroes[id].armor - state.heroes[id].armor])) as Record<HeroId, number>
    const zero = Object.fromEntries(ids.map(id => [id, 0])) as Record<HeroId, number>
    if (!played.ok) return { focus, armor, loss: null, lethal: false, outcome: 'expired' }
    if (copy.result === 'victory') return { focus, armor, loss: zero, lethal: false, outcome: 'victory' }
    const forecast = forecastEnemyAction(copy)
    // Under "armor lasts one enemy action" a prepared hit finds the armor already gone.
    if (prepared && state.economy.armorExpiry === 'turn') return { focus, armor, loss: null, lethal: false, outcome: 'expired' }
    if (!prepared && forecast.interrupt?.broken) return { focus, armor, loss: zero, lethal: false, outcome: 'broken' }
    const hits = prepared ? forecast.futureTargets : forecast.targets
    return { focus, armor, loss: Object.fromEntries(hits.map(hit => [hit.target, hit.healthLoss])) as Record<HeroId, number>, lethal: hits.some(hit => hit.lethal), outcome: 'hit' }
  })
  const action = state.enemy.nextAction
  return { options, auto: state.enemy.focus, hit: { name: action.kind === 'prepare' ? action.prepared.name : action.name, imminent: !prepared } }
}

export function startCardPlay(state: BattleState, instanceId: string, armorFocus?: HeroId): PlayStartResult {
  state.artifactNotices = []
  updateResult(state)
  if (state.result) return { ok: false, reason: 'finished' }
  if (state.pending) return { ok: false, reason: 'busy' }
  const index = state.hand.findIndex(card => card.instanceId === instanceId)
  const instance = state.hand[index]
  if (!instance) return { ok: false, reason: 'not-in-hand' }
  const definition = resolveCardDefinition(instance)
  if (state.mana < definition.cost) return { ok: false, reason: 'mana' }
  const plan = buildPlan(state, definition, false, armorFocus)
  state.mana -= definition.cost
  state.hand.splice(index, 1)
  state.pending = { actionId: state.battleId + '/action/' + state.nextActionId++, card: instance, handIndex: index, ...plan, ...(armorFocus !== undefined && hitsBothHeroes(state) && armorFocus in state.heroes ? { armorFocus } : {}) }
  return { ok: true, play: state.pending }
}

export function resolveCardPlay(state: BattleState, actionId: string): PlayResult {
  const pending = state.pending
  if (!pending || pending.actionId !== actionId) return { ok: false, reason: 'stale-action' }
  // Clear the transaction before applying anything; duplicate animation events are harmless.
  state.pending = null
  // The turn's class history grows as a play resolves, so a card previewed or started later this turn sees this one and a card never sees itself.
  state.classesPlayedThisTurn.push(resolveCardDefinition(pending.card).className)
  updateResult(state)
  const healthBefore = state.enemy.health
  let drawn = 0
  let damageDealt = 0
  if (!state.result) {
    for (const spent of pending.consumedStatuses) consumeStatus(state, spent.carrier, spent.id, spent.amount ?? 1)
    for (const effect of pending.effects) {
      if (effect.type === 'damage') {
        damageDealt += damageEnemy(state, effect.amount)
        for (const trigger of pending.artifactTriggers.filter(item => item.kind === 'turn-damage')) {
          const artifact = state.artifacts.find(item => item.instanceId === trigger.artifactInstanceId)
          if (artifact && artifact.lastTriggeredTurn !== state.turn) markArtifactUsed(state, artifact, trigger.reason, true)
        }
        if (pending.consumedStatuses.some(item => item.carrier === 'enemy' && item.id === 'vulnerability') && state.enemy.health > 0) {
          for (const trigger of pending.artifactTriggers.filter(item => item.kind === 'armor' && item.reason === 'Уязвимость была израсходована')) {
            const artifact = state.artifacts.find(item => item.instanceId === trigger.artifactInstanceId)
            if (!artifact || artifact.usedThisBattle) continue
            state.heroes[trigger.owner].armor += trigger.amount
            markArtifactUsed(state, artifact, trigger.reason)
          }
        }
      } else if (effect.type === 'armor') {
        const target = resolveArmorTarget(state.heroes, effect.target, pending.armorFocus ?? state.enemy.focus)
        if (target) state.heroes[target].armor += effect.amount
        for (const trigger of pending.artifactTriggers.filter(item => item.kind === 'armor' && item.reason === 'Карта укрепила владельца' && item.owner === target)) {
          const artifact = state.artifacts.find(item => item.instanceId === trigger.artifactInstanceId)
          if (!artifact || artifact.lastTriggeredTurn === state.turn) continue
          state.heroes[trigger.target!].armor += trigger.amount
          markArtifactUsed(state, artifact, trigger.reason, true)
        }
      } else if (effect.type === 'draw') {
        drawn += drawCards(state, effect.amount).length
      } else if (effect.type === 'status-tick') {
        const due = dueTicks(state, 'enemy', 'enemy-turn-start').find(item => item.id === effect.status)
        if (due) damageDealt += tickEnemyStatus(state, due)
      } else if (effect.type === 'status') {
        applyStatus(state, 'enemy', effect.status, effect.amount ?? 1)
      }
      updateResult(state)
      if (state.result) break
    }
  }
  // B1: damage dealt this turn counts toward breaking an announced hit that can be interrupted (and toward nothing else).
  if (hitOf(state.enemy.nextAction)?.interrupt !== undefined && state.enemy.health < healthBefore) state.enemy.hurt = (state.enemy.hurt ?? 0) + healthBefore - state.enemy.health
  // The resolving copy cannot draw itself. Free cards exhaust, so they cannot form recycle loops.
  const destination = resolveCardDefinition(pending.card).exhaust ? state.exhausted : state.discardPile
  destination.push(pending.card)
  return { ok: true, outcome: pending.preview, drawn, damageDealt }
}

// Atomic, rendering-free API for scenarios and future AI/simulation tools.
export function playCard(state: BattleState, instanceId: string, armorFocus?: HeroId): PlayResult {
  const start = startCardPlay(state, instanceId, armorFocus)
  return start.ok ? resolveCardPlay(state, start.play.actionId) : start
}

export interface EnemyTargetForecast {
  target: HeroId
  /** Damage that reaches armor: the announced damage after the target's statuses and artifacts. */
  attack: number
  absorbed: number
  healthLoss: number
  lethal: boolean
  artifactReduction: number
  /** The same `attack`, itemised in the order fixed by damage.ts. */
  parts: HitPart[]
  /** B1/B2, each present only when it applies: armor this hit ignores; damage a status of the enemy took off it; the hit leaves its target Vulnerable. */
  /** Nominal armor the hit ignores (its trait), and how much of it mattered because the hero had that much armor. */
  pierce?: number
  pierced?: number
  chill?: number
  exposes?: true
  /** Statuses this hit spends when it lands. */
  consumedStatuses: ConsumedStatus[]
}

export interface EnemyActionForecast {
  action: EnemyAction
  phase: 1 | 2
  targets: EnemyTargetForecast[]
  futureTargets: EnemyTargetForecast[]
  threatened: HeroId[]
  armorGain: number
  /** B1: an announced hit that the party can stop outright, with this turn's progress. Present only for such a hit. */
  interrupt?: { need: number; dealt: number; broken: boolean }
  /** B1: damage the enemy adds to its later hits when this action resolves. */
  powerGain?: number
}

function forecastHit(state: BattleState, hit: EnemyHit): EnemyTargetForecast[] {
  const targets = hit.kind === 'attack' ? [hit.target] : heroIdsInPartyOrder(state.heroes)
  const weakened = outgoingReductions(state, 'enemy', hit.damage)
  // Every AoE hit reads the same pre-hit armor/health snapshot; the same numbers are executed by endTurn.
  return targets.map(target => {
    const hero = state.heroes[target]
    const parts: HitPart[] = [{ kind: 'base', id: 'enemy-action', label: hit.name, amount: hit.damage }]
    const consumedStatuses: ConsumedStatus[] = []
    for (const bonus of hitBonuses(state, target)) {
      parts.push({ kind: 'status', id: bonus.id, label: bonus.label, amount: bonus.amount })
      consumedStatuses.push({ carrier: target, id: bonus.id })
    }
    const wedge = state.artifacts.find(artifact => artifact.definitionId === 'reliable-wedge' && !artifact.usedThisBattle && heroForArtifact(state, artifact) === target)
    if (wedge) parts.push({ kind: 'artifact', id: 'reliable-wedge', label: 'Верный расклин', amount: -2 })
    // B2: statuses on the enemy that weaken the hit come last, like every reduction, and are spent when it lands.
    for (const reduction of weakened) {
      parts.push({ kind: 'status', id: reduction.id, label: reduction.label, amount: -reduction.amount })
      consumedStatuses.push({ carrier: 'enemy', id: reduction.id })
    }
    const composed = composeHit(parts)
    // B1: a piercing hit ignores part of the armor; the hero's armor is spent either way once the hit lands.
    const pierced = Math.min(hit.pierce ?? 0, hero.armor)
    const split = splitDamage(pierced ? { armor: hero.armor - pierced, health: hero.health } : hero, composed.total)
    const artifactReduction = -composed.parts.filter(part => part.kind === 'artifact' && part.amount < 0).reduce((sum, part) => sum + part.amount, 0)
    const chill = weakened.length ? -composed.parts.filter(part => part.kind === 'status' && part.amount < 0).reduce((sum, part) => sum + part.amount, 0) : 0
    return { target, attack: composed.total, absorbed: split.absorbed, healthLoss: split.healthLoss, lethal: split.lethal, artifactReduction, parts: composed.parts, consumedStatuses, ...(hit.pierce ? { pierce: hit.pierce } : {}), ...(pierced ? { pierced } : {}), ...(chill ? { chill } : {}), ...(hit.exposes ? { exposes: true as const } : {}) }
  })
}

export function forecastEnemyAction(state: BattleState): EnemyActionForecast {
  const action = state.enemy.nextAction
  const hit = action.kind === 'prepare' ? null : action.kind === 'attack' || action.kind === 'attack_all' ? action : null
  const futureHit = action.kind === 'prepare' ? action.prepared : null
  const targets = hit ? forecastHit(state, hit) : []
  const futureTargets = futureHit ? forecastHit(state, futureHit) : []
  const announcedHit = hit ?? futureHit
  const threatened: HeroId[] = announcedHit?.kind === 'attack' ? [announcedHit.target] : announcedHit?.kind === 'attack_all' ? heroIdsInPartyOrder(state.heroes) : []
  const dealt = state.enemy.hurt ?? 0
  const powerGain = (action.kind === 'defend' || action.kind === 'recover') && action.power ? Math.min(action.power, ENEMY_POWER_CAP - (state.enemy.power ?? 0)) : 0
  return {
    action, phase: state.enemy.nextActionPhase, targets, futureTargets, threatened, armorGain: action.kind === 'defend' || action.kind === 'recover' ? Math.min(action.armor, Math.max(0, ENEMY_ARMOR_CAP - state.enemy.armor)) : 0,
    ...(hit?.interrupt !== undefined ? { interrupt: { need: hit.interrupt, dealt, broken: dealt >= hit.interrupt } } : {}),
    ...(powerGain > 0 ? { powerGain } : {}),
  }
}

/** Compatibility helper for the previous single-target UI and tests. */
export interface EnemyAttackForecast extends EnemyTargetForecast { action?: EnemyAction; phase?: 1 | 2; targets?: EnemyTargetForecast[]; futureTargets?: EnemyTargetForecast[]; threatened?: HeroId[]; armorGain?: number }
export function forecastEnemyAttack(state: BattleState): EnemyAttackForecast {
  const forecast = forecastEnemyAction(state)
  const item = forecast.targets[0] ?? forecast.futureTargets[0] ?? { target: state.enemy.focus, attack: 0, absorbed: 0, healthLoss: 0, lethal: false, parts: [], consumedStatuses: [] }
  return { artifactReduction: 0, ...item, ...forecast }
}

export function endTurn(state: BattleState): boolean {
  state.artifactNotices = []
  updateResult(state)
  if (state.result || state.pending) return false
  // EXPERIMENT "Honest Turn": whatever was not played is gone before the enemy acts (and before the next hand is drawn).
  if (state.economy.discardHand) discardHand(state)
  // Enemy turn, step 1: statuses that act at its start (none yet). They may end the battle or move the phase threshold.
  runEnemyTurnStart(state)
  updateResult(state)
  if (state.result) return true
  // Step 2: the announced action, executed from the very forecast the player saw (recomputed only after step 1).
  const forecast = forecastEnemyAction(state)
  const action = state.enemy.nextAction
  if (action.kind === 'defend' || action.kind === 'recover') {
    state.enemy.armor = Math.min(ENEMY_ARMOR_CAP, state.enemy.armor + action.armor)
    if (forecast.powerGain) state.enemy.power = (state.enemy.power ?? 0) + forecast.powerGain
  }
  // B1: a hit the party stopped does nothing at all: no damage, no armor spent, no status gained or lost.
  const stopped = forecast.interrupt?.broken === true
  if (stopped) state.artifactNotices.push('Удар сорван: ' + action.name)
  for (const incoming of stopped ? [] : forecast.targets) {
    const hero = state.heroes[incoming.target]
    if (incoming.artifactReduction > 0) {
      const wedge = state.artifacts.find(artifact => artifact.definitionId === 'reliable-wedge' && !artifact.usedThisBattle && heroForArtifact(state, artifact) === incoming.target)
      if (wedge) markArtifactUsed(state, wedge, `удар по владельцу ослаблен на ${incoming.artifactReduction}`)
    }
    hero.health -= incoming.healthLoss
    // Only hit heroes consume armor; a partner shield remains available until that hero is hit.
    hero.armor = 0
    for (const spent of incoming.consumedStatuses) consumeStatus(state, spent.carrier, spent.id)
    if (incoming.exposes && hero.health > 0) applyStatus(state, incoming.target, 'vulnerability')
  }
  delete state.enemy.hurt
  updateResult(state)
  if (state.result) return true
  // EXPERIMENT "Honest Turn": armor lives exactly one enemy action. It is cleared HERE, after the hits and before the triggers below,
  // so the Shift Whistle's armor (granted right after a windup) is not cleared and is still on the hero when the announced strike lands.
  if (state.economy.armorExpiry === 'turn') for (const id of heroIdsInPartyOrder(state.heroes)) state.heroes[id].armor = 0
  if (action.kind === 'prepare' && action.prepared.kind === 'attack') {
    for (const artifact of state.artifacts) {
      const owner = heroForArtifact(state, artifact)
      if (artifact.definitionId !== 'shift-whistle' || !owner || artifact.usedThisBattle || action.prepared.target !== owner) continue
      state.heroes[owner].armor += 3
      markArtifactUsed(state, artifact, 'враг готовит удар по владельцу')
    }
  }
  state.turn += 1
  state.classesPlayedThisTurn = []
  // The curve grows at the start of the turn and the pool is refilled completely.
  state.maxMana = manaForTurn(state.economy, state.turn)
  state.mana = state.maxMana
  for (const artifact of state.artifacts) {
    const owner = heroForArtifact(state, artifact)
    artifact.armedThisTurn = artifact.definitionId === 'tension-spool' && !!owner && state.heroes[owner].armor > 0
  }
  if (action.kind === 'prepare') {
    state.enemy.nextAction = action.prepared
    state.enemy.focus = hitFocus(action.prepared, state.enemy.focus)
  } else {
    const actions = schedule(state)
    const index = state.enemy.behaviorIndex % actions.length
    state.enemy.nextAction = withPower(actions[index]!, state.enemy.power ?? 0)
    state.enemy.nextActionPhase = state.enemy.phase
    state.enemy.behaviorIndex = (index + 1) % actions.length
    state.enemy.focus = hitFocus(state.enemy.nextAction, state.enemy.focus)
  }
  drawCards(state, drawForTurn(state.economy, state.turn))
  return true
}
