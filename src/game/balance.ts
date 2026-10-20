import { endTurn, forecastEnemyAction, hasStatus, playCard, previewCard } from './battle'
import { addCampaignReward, advanceCampaign, campaignEncounter, campaignEncounters, HISTORICAL_BALANCE_REWARD_EXCLUSIONS, campaignRewardOptions, campaignRewards, carriedHeroes, createCampaignBattle } from './campaign'
import { baselineEconomy } from './economy'
import type { EconomyConfig } from './economy'
import { createTurnPlanner } from './balancePlanner'
import { visibleThreat } from './observableIntent'
import type { Information } from './observableIntent'
import type { PlannerStats } from './balancePlanner'
import { resolveCardDefinition } from './cardProgression'
import { MAX_HAND_SIZE, startingDeck } from './types'
import type { BattleState, CardId, CardInstance, EnemyAction, HeroId } from './types'

/** One-card-at-a-time heuristics: the original controls. */
export type ClassicStrategy = 'aggressive' | 'defensive' | 'balanced'
/** `planner` searches whole-turn card sequences (see balancePlanner.ts); the other three score single cards. */
export type BalanceStrategy = ClassicStrategy | 'planner'
export const classicStrategies: readonly ClassicStrategy[] = ['aggressive', 'defensive', 'balanced']
export const allStrategies: readonly BalanceStrategy[] = [...classicStrategies, 'planner']
export type RunStatus = 'victory' | 'defeat' | 'timeout'

export interface CardStats {
  plays: number
  healthDamage: number
  armorGranted: number
  cardsDrawn: number
  manaSpent: number
  vulnerabilitySetups: number
  vulnerabilityTriggers: number
  armorBonusTriggers: number
}

/** One player turn of a battle, for the per-turn curves of the economy report. */
export interface TurnRecord {
  turn: number
  /** Mana available when the turn began (equals the curve's value for that turn). */
  maxMana: number
  manaSpent: number
  cardsPlayed: number
  handStart: number
  handEnd: number
  vulnerabilityTriggers: number
  /** Cards still affordable with the mana left when the party ended the turn. */
  playableLeft: number
  /** Mana left unspent when the turn ended. */
  manaLeft: number
  /** Health lost by both heroes to the enemy action that followed. */
  healthLost: number
  /** True when the battle ended during this turn (the party won before the enemy acted). */
  decisive: boolean
  /** The enemy action announced for this turn (`prepare` turns are quiet; the strike follows next turn). */
  intent: EnemyAction['kind']
  /** Health damage dealt to the enemy, armor granted to heroes and mana spent on defense cards this turn. */
  damage: number
  armorGained: number
  defenseMana: number
}

/** Why a battle was lost: the enemy action that ended it, and whether the party had been warned a turn earlier. */
export interface DefeatInfo {
  turn: number
  action: string
  announced: boolean
  fallen: HeroId[]
  damage: number
}

export interface TraceCard { name: string; cost: number; damage: number; armor: Record<HeroId, number>; drawn: number; bonuses: string[] }
export interface TraceTurn {
  turn: number
  mana: number
  hand: string[]
  intent: string
  enemy: { health: number; armor: number }
  heroes: Record<HeroId, { health: number; armor: number }>
  plays: TraceCard[]
  afterPlays: { enemy: { health: number; armor: number }; heroes: Record<HeroId, { health: number; armor: number }> }
}

export interface BattleRecord {
  encounterId: string
  encounterName: string
  deckSizeStart: number
  turns: number
  result: 'victory' | 'defeat' | 'timeout'
  heroesStart: Record<HeroId, number>
  heroesEnd: Record<HeroId, number>
  healthDamageTaken: Record<HeroId, number>
  armorDamagePrevented: Record<HeroId, number>
  enemyHealthDamage: number
  cardsPlayedTotal: number
  /** Mana available at the start of each of this battle's turns, and mana actually spent. */
  manaAvailable: number
  manaSpent: number
  averageCardsPlayedPerTurn: number
  averageHandSizeAtTurnStart: number
  averagePlayableCardsAtTurnStart: number
  averageHandSizeAfterActions: number
  fullHandAtTurnStart: number
  fullHandAfterActions: number
  blockedDraws: number
  cardsPlayed: Record<string, number>
  enemyActions: Record<string, number>
  vulnerabilitySetups: number
  vulnerabilityTriggers: number
  armorBonusTriggers: number
  vulnerabilityWaitTurns: number
  actionLog: string[]
  /** Economy fields: the curve actually played, per-turn data, health lows and the cause of a defeat. */
  economyId: string
  turnLog: TurnRecord[]
  maxManaReached: boolean
  lowestHealth: Record<HeroId, number>
  defeat: DefeatInfo | null
  /** Only with `trace: true`: a readable record of every turn. */
  trace?: TraceTurn[]
}

export interface BalanceRun {
  seed: number
  strategy: BalanceStrategy
  status: RunStatus
  battlesCompleted: number
  failedEncounter: string | null
  turns: number
  finalHealth: Record<HeroId, number>
  rewards: CardId[]
  battles: BattleRecord[]
  cards: Record<string, CardStats>
  vulnerabilitySetups: number
  vulnerabilityTriggers: number
  armorBonusTriggers: number
  vulnerabilityWaitTurns: number
  actionCount: number
  /** Cost of planning (planner strategy only; zeros otherwise). Deterministic: counts search nodes, not milliseconds. */
  planning: PlannerStats
}

export interface BalanceLimits { maxTurnsPerBattle: number; maxPlaysPerTurn: number; maxActionsPerRun: number }
/** Simulation options beyond the limits: the economy to play (the standard game by default) and a readable trace. */
export interface RunOptions extends Partial<BalanceLimits> { economy?: EconomyConfig; trace?: boolean; information?: Information }
export const defaultBalanceLimits: BalanceLimits = { maxTurnsPerBattle: 60, maxPlaysPerTurn: 12, maxActionsPerRun: 10_000 }

function blankCardStats(): CardStats { return { plays: 0, healthDamage: 0, armorGranted: 0, cardsDrawn: 0, manaSpent: 0, vulnerabilitySetups: 0, vulnerabilityTriggers: 0, armorBonusTriggers: 0 } }
function ensureCard(stats: Record<string, CardStats>, id: string): CardStats { return stats[id] ??= blankCardStats() }
function describeAction(action: EnemyAction, heroes: BattleState['heroes']): string {
  const name = (id: HeroId) => heroes[id].name
  switch (action.kind) {
    case 'attack': return `${action.name}: ${action.damage} по ${name(action.target)}`
    case 'attack_all': return `${action.name}: ${action.damage} по обоим (главная цель — ${name(action.primaryTarget)})`
    case 'defend': case 'recover': return `${action.name}: +${action.armor} брони`
    case 'prepare': return `${action.name} → ${describeAction(action.prepared, heroes)}`
  }
}
function snapshot(state: BattleState) {
  return { enemy: { health: state.enemy.health, armor: state.enemy.armor }, heroes: { warrior: { health: state.heroes.warrior.health, armor: state.heroes.warrior.armor }, mage: { health: state.heroes.mage.health, armor: state.heroes.mage.armor } } }
}
/** What the bot may plan around: the exact hits of an announced strike, only target and kind (a fixed prior) for a preparation. */
function opponentForecast(state: BattleState, information: Information) {
  return visibleThreat(forecastEnemyAction(state), state.heroes, information)
}

function evaluateCard(state: BattleState, instance: CardInstance, strategy: ClassicStrategy, information: Information): number {
  const card = resolveCardDefinition(instance)
  const preview = previewCard(state, card, information === 'omniscient' ? 'historical' : undefined)
  const forecast = opponentForecast(state, information)
  const remainingEnemyHp = state.enemy.health + state.enemy.armor
  const damage = Math.min(preview.damage + preview.statusDamage, remainingEnemyHp)
  const lethal = damage >= remainingEnemyHp
  const incomingHealth = forecast.reduce((sum, hit) => sum + hit.healthLoss, 0)
  const block = forecast.reduce((sum, hit) => {
    const added = preview.armor[hit.target]
    return sum + Math.min(added, Math.max(0, hit.attack - state.heroes[hit.target].armor))
  }, 0)
  // A prior for a preparation is never a lethal threat: the real size, and so the lethality, is not public yet.
  const lethalThreat = forecast.some(hit => !hit.estimated && (hit.lethal || hit.healthLoss >= state.heroes[hit.target].health))
  const blocksLethal = forecast.some(hit => !hit.estimated && hit.lethal && preview.armor[hit.target] >= hit.healthLoss)
  const bonusValue = preview.bonusDamage + preview.draw * 1.4 + preview.bonuses.length * 1.2 + preview.statusFuture * 0.6
  const drawValue = preview.draw * 1.7
  if (strategy === 'aggressive') {
    if (lethal) return 10_000 + damage
    if (lethalThreat && blocksLethal) return 9_000 + block
    return damage * 1.15 + bonusValue * 0.75 + drawValue - card.cost * 0.65 + (card.kind === 'defense' ? -3 : 0)
  }
  if (strategy === 'defensive') {
    if (lethal) return 10_000 + damage
    const defenseWeight = lethalThreat ? 8 : incomingHealth > 0 ? 2.8 : 0.45
    return block * defenseWeight + (lethalThreat && blocksLethal ? 2_000 : 0) + damage * 0.42 + bonusValue * 0.7 + drawValue * 0.6 - card.cost * 0.35
  }
  if (lethal) return 10_000 + damage
  const danger = lethalThreat ? 5 : incomingHealth > 0 ? 1.6 : 0.35
  return damage * 0.9 + block * danger + bonusValue + drawValue * 0.7 - card.cost * 0.45
}

/** `information` defaults to the fair policy; `'omniscient'` reproduces the historical bots (diagnostic only: it reads a prepared strike's hidden size). */
export function chooseCard(state: BattleState, strategy: ClassicStrategy, information: Information = 'public'): CardInstance | undefined {
  const choice = state.hand
    .filter(instance => resolveCardDefinition(instance).cost <= state.mana)
    .map((instance, index) => ({ instance, index, score: evaluateCard(state, instance, strategy, information) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]
  return choice && choice.score > 0.15 ? choice.instance : undefined
}

function chooseReward(state: BattleState, deck: readonly CardId[], strategy: ClassicStrategy): CardId {
  const counts = new Map<CardId, number>()
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1)
  const hpRatio = Math.min(state.heroes.warrior.health / state.heroes.warrior.maxHealth, state.heroes.mage.health / state.heroes.mage.maxHealth)
  const recoveryNeed = Math.max(0, 1 - hpRatio)
  const scores: Partial<Record<CardId, number>> = {
    'quick-cut': strategy === 'aggressive' ? 3.5 : strategy === 'defensive' ? 2.7 : 3.1,
    thunderbolt: strategy === 'aggressive' ? 3.35 : strategy === 'defensive' ? 2.7 : 3.1,
    bastion: strategy === 'aggressive' ? 2 : strategy === 'defensive' ? 3.15 : 3,
    parry: strategy === 'defensive' ? 3.5 : 2.8,
    'shield-bash': strategy === 'aggressive' ? 3.6 : 2.8,
    interpose: strategy === 'defensive' ? 3.6 : 2.5,
    frostbolt: strategy === 'aggressive' ? 3.2 : 2.9,
    'arcane-insight': strategy === 'balanced' ? 3.6 : 2.8,
    'ice-ward': strategy === 'defensive' ? 3.4 : 2.5,
  }
  const reward = campaignRewardOptions(state).map(card => {
    const synergy = card.className === 'warrior' ? (counts.get('fireball') ?? 0) * 0.08 : (counts.get('guard') ?? 0) * 0.08
    const urgency = card.kind === 'defense' ? recoveryNeed * (strategy === 'defensive' ? 1.8 : 0.8) : 0
    return { card, score: (scores[card.id] ?? 0) + synergy + urgency }
  }).sort((a, b) => b.score - a.score)[0]!.card
  return reward.id
}

interface HandMetrics {
  handSizeAtTurnStartTotal: number
  playableCardsAtTurnStartTotal: number
  handSizeAfterActionsTotal: number
  fullHandAtTurnStart: number
  fullHandAfterActions: number
}

function recordBattle(state: BattleState, encounterId: string, encounterName: string, deckSizeStart: number, startHealth: Record<HeroId, number>, turns: number, result: BattleRecord['result'], cardsPlayed: Record<string, number>, enemyActions: Record<string, number>, healthDamageTaken: Record<HeroId, number>, armorDamagePrevented: Record<HeroId, number>, enemyHealthDamage: number, cardsPlayedTotal: number, manaAvailable: number, manaSpent: number, handMetrics: HandMetrics, blockedDraws: number, vulnerabilitySetups: number, vulnerabilityTriggers: number, armorBonusTriggers: number, vulnerabilityWaitTurns: number, actionLog: string[], extra: Pick<BattleRecord, 'economyId' | 'turnLog' | 'maxManaReached' | 'lowestHealth' | 'defeat' | 'trace'>): BattleRecord {
  const samples = Math.max(1, turns)
  return {
    encounterId, encounterName, deckSizeStart, turns, result, heroesStart: startHealth,
    heroesEnd: { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health },
    healthDamageTaken, armorDamagePrevented, enemyHealthDamage, cardsPlayedTotal, manaAvailable, manaSpent,
    averageCardsPlayedPerTurn: cardsPlayedTotal / samples,
    averageHandSizeAtTurnStart: handMetrics.handSizeAtTurnStartTotal / samples,
    averagePlayableCardsAtTurnStart: handMetrics.playableCardsAtTurnStartTotal / samples,
    averageHandSizeAfterActions: handMetrics.handSizeAfterActionsTotal / samples,
    fullHandAtTurnStart: handMetrics.fullHandAtTurnStart,
    fullHandAfterActions: handMetrics.fullHandAfterActions,
    blockedDraws, cardsPlayed, enemyActions, vulnerabilitySetups, vulnerabilityTriggers, armorBonusTriggers, vulnerabilityWaitTurns, actionLog, ...extra,
  }
}

export function simulateRun(seed: number, strategy: BalanceStrategy, options: RunOptions = {}): BalanceRun {
  const { economy = baselineEconomy, trace: wantTrace = false, information = 'public', ...limits } = options
  const max = { ...defaultBalanceLimits, ...limits }
  const encounterList = campaignEncounters(economy)
  const topMana = Math.max(...economy.manaByTurn)
  let deck: CardId[] = [...startingDeck]
  let battle: BattleState | undefined
  let status: RunStatus = 'timeout'
  let failedEncounter: string | null = null
  let battlesCompleted = 0
  let turns = 0
  let actionCount = 0
  const rewards: CardId[] = []
  const battles: BattleRecord[] = []
  const cardStats: Record<string, CardStats> = {}
  let vulnerabilitySetups = 0
  let vulnerabilityTriggers = 0
  let armorBonusTriggers = 0
  let vulnerabilityWaitTurns = 0
  const planning: PlannerStats = { plans: 0, nodes: 0, truncated: 0, maxNodes: 0 }
  const rewardStrategy: ClassicStrategy = strategy === 'planner' ? 'balanced' : strategy

  for (let encounterIndex = 0; encounterIndex < encounterList.length; encounterIndex += 1) {
    const encounter = campaignEncounter(encounterIndex, economy)!
    battle = createCampaignBattle({
      encounter,
      heroes: battle ? carriedHeroes(battle) : undefined,
      deck,
      seed: (seed + encounterIndex) >>> 0,
      battleId: 'balance/' + (seed >>> 0) + '/' + strategy + '/' + encounter.id,
      economy,
    })
    const startHealth = { warrior: battle.heroes.warrior.health, mage: battle.heroes.mage.health }
    const blockedDrawsStart = battle.blockedDraws
    const cardsPlayed: Record<string, number> = {}
    const enemyActions: Record<string, number> = {}
    const healthDamageTaken: Record<HeroId, number> = { warrior: 0, mage: 0 }
    const armorDamagePrevented: Record<HeroId, number> = { warrior: 0, mage: 0 }
    let battleVulnerabilitySetups = 0
    let battleVulnerabilityTriggers = 0
    let battleArmorBonusTriggers = 0
    let battleVulnerabilityWaitTurns = 0
    const actionLog: string[] = []
    let enemyHealthDamage = 0
    let cardsPlayedTotal = 0
    let manaAvailable = 0
    let manaSpent = 0
    // The planner derives its own sampling from the observable situation only: no seed, RNG state, draw order or card ids.
    const planner = strategy === 'planner' ? createTurnPlanner() : undefined
    const handMetrics: HandMetrics = { handSizeAtTurnStartTotal: 0, playableCardsAtTurnStartTotal: 0, handSizeAfterActionsTotal: 0, fullHandAtTurnStart: 0, fullHandAfterActions: 0 }
    let battleTurns = 0
    let battleStatus: BattleRecord['result'] = 'timeout'
    const turnLog: TurnRecord[] = []
    const traceLog: TraceTurn[] = []
    const lowestHealth: Record<HeroId, number> = { warrior: battle.heroes.warrior.health, mage: battle.heroes.mage.health }
    let maxManaReached = false
    let defeat: DefeatInfo | null = null
    let previousActionKind: EnemyAction['kind'] | null = null

    while (!battle.result && battleTurns < max.maxTurnsPerBattle && actionCount < max.maxActionsPerRun) {
      battleTurns += 1
      actionLog.push(`Ход ${battle.turn}: мана ${battle.mana}/${battle.maxMana}`)
      handMetrics.handSizeAtTurnStartTotal += battle.hand.length
      manaAvailable += battle.mana
      handMetrics.playableCardsAtTurnStartTotal += battle.hand.filter(instance => resolveCardDefinition(instance).cost <= battle!.mana).length
      if (battle.hand.length >= MAX_HAND_SIZE) handMetrics.fullHandAtTurnStart += 1
      const turnNumber = battle.turn
      const turnMaxMana = battle.mana
      const turnHandStart = battle.hand.length
      let turnSpent = 0
      let turnVulnerabilityTriggers = 0
      let turnDamage = 0
      let turnArmor = 0
      let turnDefenseMana = 0
      const turnIntent = battle.enemy.nextAction.kind
      if (battle.maxMana >= topMana) maxManaReached = true
      const traceTurn: TraceTurn | undefined = wantTrace ? { turn: turnNumber, mana: battle.mana, hand: battle.hand.map(instance => resolveCardDefinition(instance).name).sort(), intent: describeAction(battle.enemy.nextAction, battle.heroes), enemy: snapshot(battle).enemy, heroes: snapshot(battle).heroes, plays: [], afterPlays: snapshot(battle) } : undefined
      let playsThisTurn = 0
      while (!battle.result && playsThisTurn < max.maxPlaysPerTurn && actionCount < max.maxActionsPerRun) {
        const plannedId = planner?.next(battle)
        const chosen = planner ? battle.hand.find(instance => instance.instanceId === plannedId) : chooseCard(battle, strategy as ClassicStrategy, information)
        if (!chosen) break
        const card = resolveCardDefinition(chosen)
        const outcome = playCard(battle, chosen.instanceId)
        actionCount += 1
        playsThisTurn += 1
        cardsPlayedTotal += 1
        if (!outcome.ok) break
        manaSpent += card.cost
        turnSpent += card.cost
        const usedVulnerability = outcome.outcome.vulnerabilityBonus > 0
        const usedArmorBonus = outcome.outcome.armorBonus > 0
        turnVulnerabilityTriggers += Number(usedVulnerability)
        vulnerabilityTriggers += Number(usedVulnerability)
        battleVulnerabilityTriggers += Number(usedVulnerability)
        armorBonusTriggers += Number(usedArmorBonus)
        battleArmorBonusTriggers += Number(usedArmorBonus)
        turnDamage += outcome.damageDealt
        turnArmor += outcome.outcome.armor.warrior + outcome.outcome.armor.mage
        if (card.kind === 'defense') turnDefenseMana += card.cost
        traceTurn?.plays.push({ name: card.name, cost: card.cost, damage: outcome.damageDealt, armor: { ...outcome.outcome.armor }, drawn: outcome.drawn, bonuses: [...outcome.outcome.bonuses] })
        actionLog.push(`Карта: ${card.name}; урон здоровью врага ${outcome.damageDealt}; мана ${card.cost}`)
        const stats = ensureCard(cardStats, card.id)
        stats.plays += 1
        stats.healthDamage += outcome.damageDealt
        stats.armorGranted += outcome.outcome.armor.warrior + outcome.outcome.armor.mage
        stats.cardsDrawn += outcome.drawn
        stats.manaSpent += card.cost
        stats.vulnerabilityTriggers += Number(usedVulnerability)
        stats.armorBonusTriggers += Number(usedArmorBonus)
        const appliedVulnerability = outcome.outcome.appliedStatuses.includes('vulnerability') && hasStatus(battle, 'vulnerability')
        if (appliedVulnerability) {
          stats.vulnerabilitySetups += 1
          vulnerabilitySetups += 1
          battleVulnerabilitySetups += 1
        }
        cardsPlayed[card.id] = (cardsPlayed[card.id] ?? 0) + 1
        enemyHealthDamage += outcome.damageDealt
      }
      handMetrics.handSizeAfterActionsTotal += battle.hand.length
      if (battle.hand.length >= MAX_HAND_SIZE) handMetrics.fullHandAfterActions += 1
      const turnRecord: TurnRecord = {
        turn: turnNumber, maxMana: turnMaxMana, manaSpent: turnSpent, cardsPlayed: playsThisTurn, handStart: turnHandStart, handEnd: battle.hand.length,
        vulnerabilityTriggers: turnVulnerabilityTriggers, manaLeft: battle.mana, playableLeft: battle.hand.filter(instance => resolveCardDefinition(instance).cost <= battle!.mana).length, healthLost: 0, decisive: !!battle.result,
        intent: turnIntent, damage: turnDamage, armorGained: turnArmor, defenseMana: turnDefenseMana,
      }
      turnLog.push(turnRecord)
      if (traceTurn) { traceTurn.afterPlays = snapshot(battle); traceLog.push(traceTurn) }
      if (battle.result) break
      if (playsThisTurn >= max.maxPlaysPerTurn || actionCount >= max.maxActionsPerRun) break
      const forecast = forecastEnemyAction(battle)
      const enemyAction = battle.enemy.nextAction
      enemyActions[enemyAction.name] = (enemyActions[enemyAction.name] ?? 0) + 1
      actionLog.push(`Действие врага: ${enemyAction.name}`)
      const predicted = forecast.targets
      predicted.forEach(hit => {
        healthDamageTaken[hit.target] += hit.healthLoss
        armorDamagePrevented[hit.target] += hit.absorbed
      })
      turnRecord.healthLost = predicted.reduce((sum, hit) => sum + hit.healthLoss, 0)
      const wasPrepared = previousActionKind === 'prepare'
      previousActionKind = enemyAction.kind
      if (hasStatus(battle, 'vulnerability')) {
        vulnerabilityWaitTurns += 1
        battleVulnerabilityWaitTurns += 1
      }
      if (!endTurn(battle)) break
      actionCount += 1
      lowestHealth.warrior = Math.min(lowestHealth.warrior, battle.heroes.warrior.health)
      lowestHealth.mage = Math.min(lowestHealth.mage, battle.heroes.mage.health)
      if (battle.result === 'defeat') {
        defeat = { turn: turnNumber, action: enemyAction.name, announced: wasPrepared, fallen: (['warrior', 'mage'] as HeroId[]).filter(id => battle!.heroes[id].health <= 0), damage: Math.max(0, ...predicted.map(hit => hit.attack)) }
      }
    }
    if (planner) {
      planning.plans += planner.stats.plans; planning.nodes += planner.stats.nodes; planning.truncated += planner.stats.truncated
      planning.maxNodes = Math.max(planning.maxNodes, planner.stats.maxNodes)
    }
    turns += battleTurns
    if (battle.result === 'victory') { battleStatus = 'victory'; battlesCompleted += 1 }
    else if (battle.result === 'defeat') battleStatus = 'defeat'
    if (battle.result) actionLog.push(battle.result === 'victory' ? 'Бой выигран' : 'Бой проигран')
    else actionLog.push('Ограничение симуляции: бой остановлен техническим таймаутом')
    battles.push(recordBattle(battle, encounter.id, encounter.name, deck.length, startHealth, battleTurns, battleStatus, cardsPlayed, enemyActions, healthDamageTaken, armorDamagePrevented, enemyHealthDamage, cardsPlayedTotal, manaAvailable, manaSpent, handMetrics, battle.blockedDraws - blockedDrawsStart, battleVulnerabilitySetups, battleVulnerabilityTriggers, battleArmorBonusTriggers, battleVulnerabilityWaitTurns, actionLog, { economyId: economy.id, turnLog, maxManaReached, lowestHealth, defeat, ...(wantTrace ? { trace: traceLog } : {}) }))
    if (!battle.result) {
      status = 'timeout'
      failedEncounter = encounter.id
      break
    }
    const advance = advanceCampaign(battle, encounterIndex)
    if (advance.kind === 'defeat') { status = 'defeat'; failedEncounter = encounter.id; break }
    if (advance.kind === 'complete') { status = 'victory'; break }
    const rewardId = chooseReward(battle, deck, rewardStrategy)
    const reward = campaignRewards(HISTORICAL_BALANCE_REWARD_EXCLUSIONS).find(card => card.id === rewardId)!
    deck = addCampaignReward(deck, reward)
    rewards.push(rewardId)
    actionLog.push(`Награда похода: ${reward.name}`)
  }
  return {
    seed: seed >>> 0, strategy, status, battlesCompleted, failedEncounter, turns,
    finalHealth: { warrior: battle?.heroes.warrior.health ?? 25, mage: battle?.heroes.mage.health ?? 18 },
    rewards, battles, cards: cardStats, vulnerabilitySetups, vulnerabilityTriggers, armorBonusTriggers, vulnerabilityWaitTurns, actionCount, planning,
  }
}

export function simulateBalance(options: { runs: number; seed: number; strategies?: BalanceStrategy[]; limits?: Partial<BalanceLimits>; economy?: EconomyConfig; information?: Information }): BalanceRun[] {
  // The default stays the three classic controls so existing reports are unchanged; pass `allStrategies` to add the planner.
  const strategies = options.strategies ?? [...classicStrategies]
  const results: BalanceRun[] = []
  for (const strategy of strategies) for (let index = 0; index < options.runs; index += 1) results.push(simulateRun((options.seed + index) >>> 0, strategy, { ...options.limits, economy: options.economy, information: options.information }))
  return results
}

const ENCOUNTER_COUNT = campaignEncounters().length

export function summarizeBalance(runs: BalanceRun[]) {
  const strategies = [...new Set(runs.map(run => run.strategy))]
  return strategies.map(strategy => {
    const sample = runs.filter(run => run.strategy === strategy)
    const wins = sample.filter(run => run.status === 'victory').length
    const defeats = sample.filter(run => run.status === 'defeat').length
    const timeouts = sample.filter(run => run.status === 'timeout').length
    const denominator = sample.length || 1
    const hp = sample.filter(run => run.status !== 'timeout')
    const hpDenominator = hp.length || 1
    const battles = sample.flatMap(run => run.battles)
    const totalTurns = Math.max(1, sample.reduce((sum, run) => sum + run.turns, 0))
    const manaAvailable = battles.reduce((sum, battle) => sum + battle.manaAvailable, 0)
    const manaSpent = battles.reduce((sum, battle) => sum + battle.manaSpent, 0)
    const vulnerabilityTriggers = sample.reduce((sum, run) => sum + run.vulnerabilityTriggers, 0)
    const armorBonusTriggers = sample.reduce((sum, run) => sum + run.armorBonusTriggers, 0)
    return {
      // Mana economy, combo frequency, fight length and planning cost (nodes are deterministic search counts).
      averageManaAvailablePerTurn: manaAvailable / totalTurns,
      averageManaSpentPerTurn: manaSpent / totalTurns,
      manaUtilization: manaAvailable ? manaSpent / manaAvailable : 0,
      vulnerabilitySetupsPerRun: sample.reduce((sum, run) => sum + run.vulnerabilitySetups, 0) / denominator,
      vulnerabilityTriggersPerRun: vulnerabilityTriggers / denominator,
      vulnerabilityTriggersPerTurn: vulnerabilityTriggers / totalTurns,
      vulnerabilityWaitTurnsPerTrigger: vulnerabilityTriggers ? sample.reduce((sum, run) => sum + run.vulnerabilityWaitTurns, 0) / vulnerabilityTriggers : 0,
      armorBonusTriggersPerRun: armorBonusTriggers / denominator,
      armorBonusTriggersPerTurn: armorBonusTriggers / totalTurns,
      encounterTurns: Array.from({ length: ENCOUNTER_COUNT }, (_, index) => {
        const fights = sample.filter(run => run.battles[index])
        return fights.length ? fights.reduce((sum, run) => sum + run.battles[index]!.turns, 0) / fights.length : 0
      }),
      planningNodesPerTurn: sample.reduce((sum, run) => sum + run.planning.nodes, 0) / totalTurns,
      planningTruncatedPlans: sample.reduce((sum, run) => sum + run.planning.truncated, 0),
      planningMaxNodes: sample.reduce((max, run) => Math.max(max, run.planning.maxNodes), 0),
      strategy, runs: sample.length, victories: wins, defeats, timeouts, winRate: wins / denominator,
      averageTurns: sample.reduce((sum, run) => sum + run.turns, 0) / denominator,
      averageCardsPlayedPerTurn: sample.reduce((sum, run) => sum + run.battles.reduce((total, battle) => total + battle.cardsPlayedTotal, 0), 0) / Math.max(1, sample.reduce((sum, run) => sum + run.turns, 0)),
      averageHandSizeAtTurnStart: sample.reduce((sum, run) => sum + run.battles.reduce((total, battle) => total + battle.averageHandSizeAtTurnStart * battle.turns, 0), 0) / Math.max(1, sample.reduce((sum, run) => sum + run.turns, 0)),
      averagePlayableCardsAtTurnStart: sample.reduce((sum, run) => sum + run.battles.reduce((total, battle) => total + battle.averagePlayableCardsAtTurnStart * battle.turns, 0), 0) / Math.max(1, sample.reduce((sum, run) => sum + run.turns, 0)),
      averageHandSizeAfterActions: sample.reduce((sum, run) => sum + run.battles.reduce((total, battle) => total + battle.averageHandSizeAfterActions * battle.turns, 0), 0) / Math.max(1, sample.reduce((sum, run) => sum + run.turns, 0)),
      fullHandAtTurnStart: sample.reduce((sum, run) => sum + run.battles.reduce((total, battle) => total + battle.fullHandAtTurnStart, 0), 0),
      fullHandAfterActions: sample.reduce((sum, run) => sum + run.battles.reduce((total, battle) => total + battle.fullHandAfterActions, 0), 0),
      blockedDraws: sample.reduce((sum, run) => sum + run.battles.reduce((total, battle) => total + battle.blockedDraws, 0), 0),
      medianTurns: median(sample.map(run => run.turns)),
      averageVarianHp: hp.reduce((sum, run) => sum + run.finalHealth.warrior, 0) / hpDenominator,
      averageJainaHp: hp.reduce((sum, run) => sum + run.finalHealth.mage, 0) / hpDenominator,
      battlesReached: Array.from({ length: ENCOUNTER_COUNT }, (_, index) => sample.filter(run => run.battles.length > index).length),
      battleWins: Array.from({ length: ENCOUNTER_COUNT }, (_, index) => sample.filter(run => run.battles[index]?.result === 'victory').length),
    }
  })
}

function median(numbers: number[]): number {
  if (!numbers.length) return 0
  const ordered = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2
}

const mean = (numbers: number[]) => numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0
const share = (part: number, whole: number) => whole ? part / whole : 0

/**
 * Economy metrics per strategy (Combat Economy v0.7): fight length and enemy actions, hero health after each battle,
 * mana use (including hoarding vs. starving), hand size, blocked draws, combos, how often the top of the mana curve is
 * reached, the per-turn curve and why runs were lost. `economy` supplies the top of the mana curve.
 * "Unused mana" ignores the decisive turn of a won battle, where leftover mana only means the enemy fell early.
 */
export function summarizeEconomy(runs: BalanceRun[], economy: EconomyConfig = baselineEconomy) {
  const topMana = Math.max(...economy.manaByTurn)
  return [...new Set(runs.map(run => run.strategy))].map(strategy => {
    const sample = runs.filter(run => run.strategy === strategy)
    const battles = sample.flatMap(run => run.battles)
    const turnRows = battles.flatMap(battle => battle.turnLog)
    const open = turnRows.filter(turn => !turn.decisive)
    const leftover = open.filter(turn => turn.manaLeft > 0)
    const deaths: Record<string, number> = {}
    for (const run of sample) {
      const lost = run.battles.find(battle => battle.defeat)
      if (!lost?.defeat) continue
      const key = `${lost.encounterName} · ${lost.defeat.action}${lost.defeat.announced ? ' (подготовленный удар)' : ''} → ${lost.defeat.fallen.map(id => id === 'mage' ? 'Джайна' : 'Вариан').join('+')}`
      deaths[key] = (deaths[key] ?? 0) + 1
    }
    const lastTurn = Math.max(0, ...turnRows.map(turn => turn.turn))
    return {
      strategy, runs: sample.length,
      wins: sample.filter(run => run.status === 'victory').length,
      encounters: Array.from({ length: ENCOUNTER_COUNT }, (_, index) => {
        const fought = sample.map(run => run.battles[index]).filter((battle): battle is BattleRecord => !!battle)
        const won = fought.filter(battle => battle.result === 'victory')
        return {
          reached: fought.length, wins: won.length,
          turns: mean(fought.map(battle => battle.turns)),
          turnsWon: mean(won.map(battle => battle.turns)),
          enemyActions: mean(fought.map(battle => Object.values(battle.enemyActions).reduce((sum, count) => sum + count, 0))),
          healthEnd: { warrior: mean(fought.map(battle => battle.heroesEnd.warrior)), mage: mean(fought.map(battle => battle.heroesEnd.mage)) },
          healthLost: { warrior: mean(fought.map(battle => battle.heroesStart.warrior - battle.heroesEnd.warrior)), mage: mean(fought.map(battle => battle.heroesStart.mage - battle.heroesEnd.mage)) },
          lowestMage: mean(fought.map(battle => battle.lowestHealth.mage)),
          lowestVarian: mean(fought.map(battle => battle.lowestHealth.warrior)),
          /** Battles in which Jaina / Varian was at 5 health or less at some moment, and the battles each of them fell in. */
          mageLow: share(fought.filter(battle => battle.lowestHealth.mage <= 5).length, fought.length),
          varianLow: share(fought.filter(battle => battle.lowestHealth.warrior <= 5).length, fought.length),
          mageFell: fought.filter(battle => battle.defeat?.fallen.includes('mage')).length,
          varianFell: fought.filter(battle => battle.defeat?.fallen.includes('warrior')).length,
          /** Battles in which either hero was at 5 health or less at some moment. */
          closeCalls: share(fought.filter(battle => battle.lowestHealth.warrior <= 5 || battle.lowestHealth.mage <= 5).length, fought.length),
          reachedTopMana: share(fought.filter(battle => battle.maxManaReached).length, fought.length),
        }
      }),
      runEnd: {
        varian: mean(sample.filter(run => run.status === 'victory').map(run => run.finalHealth.warrior)),
        jaina: mean(sample.filter(run => run.status === 'victory').map(run => run.finalHealth.mage)),
      },
      mana: {
        availablePerTurn: mean(turnRows.map(turn => turn.maxMana)),
        spentPerTurn: mean(turnRows.map(turn => turn.manaSpent)),
        utilization: share(turnRows.reduce((sum, turn) => sum + turn.manaSpent, 0), turnRows.reduce((sum, turn) => sum + turn.maxMana, 0)),
        turnsWithUnused: share(leftover.length, open.length),
        /** Mana left while a card that fits was still in hand: the planner chose to keep it. */
        turnsHoarding: share(leftover.filter(turn => turn.playableLeft > 0).length, open.length),
        /** Mana left and nothing in hand that fits: the hand ran dry (or only expensive cards remain). */
        turnsStarved: share(leftover.filter(turn => turn.playableLeft === 0).length, open.length),
        turnsAtTop: share(turnRows.filter(turn => turn.maxMana >= topMana).length, turnRows.length),
      },
      cardsPerTurn: mean(turnRows.map(turn => turn.cardsPlayed)),
      handStart: mean(turnRows.map(turn => turn.handStart)),
      handEnd: mean(turnRows.map(turn => turn.handEnd)),
      blockedDrawsPerBattle: mean(battles.map(battle => battle.blockedDraws)),
      vulnerabilityTriggersPerTurn: share(turnRows.reduce((sum, turn) => sum + turn.vulnerabilityTriggers, 0), turnRows.length),
      vulnerabilitySetupsPerBattle: mean(battles.map(battle => battle.vulnerabilitySetups)),
      vulnerabilityWaitTurnsPerTrigger: share(battles.reduce((sum, battle) => sum + battle.vulnerabilityWaitTurns, 0), battles.reduce((sum, battle) => sum + battle.vulnerabilityTriggers, 0)),
      armorBonusTriggersPerBattle: mean(battles.map(battle => battle.armorBonusTriggers)),
      vulnerabilityTurns: battles.reduce((sum, battle) => sum + battle.vulnerabilityWaitTurns, 0),
      emptyHandTurns: share(turnRows.filter(turn => turn.handEnd === 0).length, turnRows.length),
      defenseManaShare: share(turnRows.reduce((sum, turn) => sum + turn.defenseMana, 0), turnRows.reduce((sum, turn) => sum + turn.manaSpent, 0)),
      /** What the party does on each kind of announced enemy action: quiet turns (prepare, defend, recover) vs. strikes. */
      byIntent: (['attack', 'attack_all', 'prepare', 'defend', 'recover'] as const).map(kind => {
        const rows = turnRows.filter(turn => turn.intent === kind)
        return {
          kind, turns: rows.length, damage: mean(rows.map(turn => turn.damage)), armorGained: mean(rows.map(turn => turn.armorGained)),
          defenseMana: mean(rows.map(turn => turn.defenseMana)), cards: mean(rows.map(turn => turn.cardsPlayed)), healthLost: mean(rows.filter(turn => !turn.decisive).map(turn => turn.healthLost)),
          armoredShare: share(rows.filter(turn => turn.armorGained > 0).length, rows.length),
        }
      }),
      deaths,
      turnCurve: Array.from({ length: lastTurn }, (_, index) => {
        const rows = turnRows.filter(turn => turn.turn === index + 1)
        return {
          turn: index + 1, battles: rows.length, maxMana: mean(rows.map(turn => turn.maxMana)), spent: mean(rows.map(turn => turn.manaSpent)),
          cards: mean(rows.map(turn => turn.cardsPlayed)), handStart: mean(rows.map(turn => turn.handStart)), handEnd: mean(rows.map(turn => turn.handEnd)),
          vulnerabilityTriggers: mean(rows.map(turn => turn.vulnerabilityTriggers)), healthLost: mean(rows.map(turn => turn.healthLost)), defenseMana: mean(rows.map(turn => turn.defenseMana)),
        }
      }).filter(row => row.battles >= 20),
    }
  })
}
