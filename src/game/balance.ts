import { endTurn, forecastEnemyAction, playCard, previewCard } from './battle'
import { addCampaignReward, advanceCampaign, campaignEncounter, campaignRewards, carriedHeroes, createCampaignBattle } from './campaign'
import { cardDefinition, startingDeck } from './types'
import type { BattleState, CardId, CardInstance, HeroId } from './types'

export type BalanceStrategy = 'aggressive' | 'defensive' | 'balanced'
export type RunStatus = 'victory' | 'defeat' | 'timeout'

export interface CardStats {
  plays: number
  healthDamage: number
  armorGranted: number
  cardsDrawn: number
  manaSpent: number
  linkSetups: number
  linkTriggers: number
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
  cardsPlayed: Record<string, number>
  enemyActions: Record<string, number>
  linkTriggers: Record<string, number>
  actionLog: string[]
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
  linkTriggers: Record<string, number>
  actionCount: number
}

export interface BalanceLimits { maxTurnsPerBattle: number; maxPlaysPerTurn: number; maxActionsPerRun: number }
export const defaultBalanceLimits: BalanceLimits = { maxTurnsPerBattle: 60, maxPlaysPerTurn: 12, maxActionsPerRun: 10_000 }

const linksByStatus = new Map([['mark', 'Магическая метка'], ['resonance', 'Защитный резонанс']])

function blankCardStats(): CardStats { return { plays: 0, healthDamage: 0, armorGranted: 0, cardsDrawn: 0, manaSpent: 0, linkSetups: 0, linkTriggers: 0 } }
function ensureCard(stats: Record<string, CardStats>, id: string): CardStats { return stats[id] ??= blankCardStats() }
function opponentForecast(state: BattleState) {
  const forecast = forecastEnemyAction(state)
  return forecast.targets.length ? forecast.targets : forecast.futureTargets
}

function evaluateCard(state: BattleState, instance: CardInstance, strategy: BalanceStrategy): number {
  const card = cardDefinition(instance.definitionId)
  const preview = previewCard(state, card)
  const forecast = opponentForecast(state)
  const remainingEnemyHp = state.enemy.health + state.enemy.armor
  const damage = Math.min(preview.damage, remainingEnemyHp)
  const lethal = damage >= remainingEnemyHp
  const incomingHealth = forecast.reduce((sum, hit) => sum + hit.healthLoss, 0)
  const block = forecast.reduce((sum, hit) => {
    const added = preview.armor[hit.target]
    return sum + Math.min(added, Math.max(0, hit.attack - state.heroes[hit.target].armor))
  }, 0)
  const lethalThreat = forecast.some(hit => hit.lethal || hit.healthLoss >= state.heroes[hit.target].health)
  const blocksLethal = forecast.some(hit => hit.lethal && preview.armor[hit.target] >= hit.healthLoss)
  const linkValue = preview.bonusDamage + preview.draw * 1.4 + preview.links.length * 1.2
  const drawValue = preview.draw * 1.7
  if (strategy === 'aggressive') {
    if (lethal) return 10_000 + damage
    if (lethalThreat && blocksLethal) return 9_000 + block
    return damage * 1.15 + linkValue * 0.75 + drawValue - card.cost * 0.65 + (card.kind === 'defense' ? -3 : 0)
  }
  if (strategy === 'defensive') {
    if (lethal) return 10_000 + damage
    const defenseWeight = lethalThreat ? 8 : incomingHealth > 0 ? 2.8 : 0.45
    return block * defenseWeight + (lethalThreat && blocksLethal ? 2_000 : 0) + damage * 0.42 + linkValue * 0.7 + drawValue * 0.6 - card.cost * 0.35
  }
  if (lethal) return 10_000 + damage
  const danger = lethalThreat ? 5 : incomingHealth > 0 ? 1.6 : 0.35
  return damage * 0.9 + block * danger + linkValue + drawValue * 0.7 - card.cost * 0.45
}

function chooseCard(state: BattleState, strategy: BalanceStrategy): CardInstance | undefined {
  const choice = state.hand
    .filter(instance => cardDefinition(instance.definitionId).cost <= state.mana)
    .map((instance, index) => ({ instance, index, score: evaluateCard(state, instance, strategy) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]
  return choice && choice.score > 0.15 ? choice.instance : undefined
}

function chooseReward(state: BattleState, deck: readonly CardId[], strategy: BalanceStrategy): CardId {
  const counts = new Map<CardId, number>()
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1)
  const hpRatio = Math.min(state.heroes.warrior.health / state.heroes.warrior.maxHealth, state.heroes.mage.health / state.heroes.mage.maxHealth)
  const recoveryNeed = Math.max(0, 1 - hpRatio)
  const scores: Partial<Record<CardId, number>> = {
    'quick-cut': strategy === 'aggressive' ? 3.5 : strategy === 'defensive' ? 2.7 : 3.1,
    thunderbolt: strategy === 'aggressive' ? 3.35 : strategy === 'defensive' ? 2.7 : 3.1,
    bastion: strategy === 'aggressive' ? 2 : strategy === 'defensive' ? 3.15 : 3,
  }
  const reward = campaignRewards().map(card => {
    const synergy = card.id === 'thunderbolt' ? (counts.get('fireball') ?? 0) * 0.1 : card.id === 'quick-cut' ? (counts.get('sword-strike') ?? 0) * 0.1 : (counts.get('guard') ?? 0) * 0.1
    const urgency = card.id === 'bastion' ? recoveryNeed * (strategy === 'defensive' ? 2.2 : 1.3) : card.id === 'thunderbolt' ? (1 - recoveryNeed) * (strategy === 'defensive' ? 1.2 : 0.2) : 0
    return { card, score: (scores[card.id] ?? 0) + synergy + urgency }
  }).sort((a, b) => b.score - a.score)[0]!.card
  return reward.id
}

function recordBattle(state: BattleState, encounterId: string, encounterName: string, deckSizeStart: number, startHealth: Record<HeroId, number>, turns: number, result: BattleRecord['result'], cardsPlayed: Record<string, number>, enemyActions: Record<string, number>, healthDamageTaken: Record<HeroId, number>, armorDamagePrevented: Record<HeroId, number>, enemyHealthDamage: number, links: Record<string, number>, actionLog: string[]): BattleRecord {
  return { encounterId, encounterName, deckSizeStart, turns, result, heroesStart: startHealth, heroesEnd: { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }, healthDamageTaken, armorDamagePrevented, enemyHealthDamage, cardsPlayed, enemyActions, linkTriggers: links, actionLog }
}

export function simulateRun(seed: number, strategy: BalanceStrategy, limits: Partial<BalanceLimits> = {}): BalanceRun {
  const max = { ...defaultBalanceLimits, ...limits }
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
  const linkTriggers: Record<string, number> = { 'Магическая метка': 0, 'Защитный резонанс': 0 }

  for (let encounterIndex = 0; encounterIndex < 3; encounterIndex += 1) {
    const encounter = campaignEncounter(encounterIndex)!
    battle = createCampaignBattle({
      encounter,
      heroes: battle ? carriedHeroes(battle) : undefined,
      deck,
      seed: (seed + encounterIndex) >>> 0,
      battleId: 'balance/' + (seed >>> 0) + '/' + strategy + '/' + encounter.id,
    })
    const startHealth = { warrior: battle.heroes.warrior.health, mage: battle.heroes.mage.health }
    const cardsPlayed: Record<string, number> = {}
    const enemyActions: Record<string, number> = {}
    const healthDamageTaken: Record<HeroId, number> = { warrior: 0, mage: 0 }
    const armorDamagePrevented: Record<HeroId, number> = { warrior: 0, mage: 0 }
    const localLinks: Record<string, number> = {}
    const actionLog: string[] = []
    let enemyHealthDamage = 0
    let battleTurns = 0
    let battleStatus: BattleRecord['result'] = 'timeout'

    while (!battle.result && battleTurns < max.maxTurnsPerBattle && actionCount < max.maxActionsPerRun) {
      battleTurns += 1
      actionLog.push(`Ход ${battle.turn}: мана ${battle.mana}/${battle.maxMana}`)
      let playsThisTurn = 0
      while (!battle.result && playsThisTurn < max.maxPlaysPerTurn && actionCount < max.maxActionsPerRun) {
        const chosen = chooseCard(battle, strategy)
        if (!chosen) break
        const card = cardDefinition(chosen.definitionId)
        const outcome = playCard(battle, chosen.instanceId)
        actionCount += 1
        playsThisTurn += 1
        if (!outcome.ok) break
        actionLog.push(`Карта: ${card.name}; урон здоровью врага ${outcome.damageDealt}; мана ${card.cost}`)
        const stats = ensureCard(cardStats, card.id)
        stats.plays += 1
        stats.healthDamage += outcome.damageDealt
        stats.armorGranted += outcome.outcome.armor.warrior + outcome.outcome.armor.mage
        stats.cardsDrawn += outcome.drawn
        stats.manaSpent += card.cost
        for (const name of outcome.outcome.links) {
          localLinks[name] = (localLinks[name] ?? 0) + 1
          linkTriggers[name] = (linkTriggers[name] ?? 0) + 1
          stats.linkTriggers += 1
        }
        for (const status of outcome.outcome.appliedStatuses) {
          if (linksByStatus.has(status) && battle.statuses[status]) stats.linkSetups += 1
        }
        cardsPlayed[card.id] = (cardsPlayed[card.id] ?? 0) + 1
        enemyHealthDamage += outcome.damageDealt
      }
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
      if (!endTurn(battle)) break
      actionCount += 1
    }
    turns += battleTurns
    if (battle.result === 'victory') { battleStatus = 'victory'; battlesCompleted += 1 }
    else if (battle.result === 'defeat') battleStatus = 'defeat'
    if (battle.result) actionLog.push(battle.result === 'victory' ? 'Бой выигран' : 'Бой проигран')
    else actionLog.push('Ограничение симуляции: бой остановлен техническим таймаутом')
    battles.push(recordBattle(battle, encounter.id, encounter.name, deck.length, startHealth, battleTurns, battleStatus, cardsPlayed, enemyActions, healthDamageTaken, armorDamagePrevented, enemyHealthDamage, localLinks, actionLog))
    if (!battle.result) {
      status = 'timeout'
      failedEncounter = encounter.id
      break
    }
    const advance = advanceCampaign(battle, encounterIndex)
    if (advance.kind === 'defeat') { status = 'defeat'; failedEncounter = encounter.id; break }
    if (advance.kind === 'complete') { status = 'victory'; break }
    const rewardId = chooseReward(battle, deck, strategy)
    const reward = campaignRewards().find(card => card.id === rewardId)!
    deck = addCampaignReward(deck, reward)
    rewards.push(rewardId)
    actionLog.push(`Награда похода: ${reward.name}`)
  }
  return {
    seed: seed >>> 0, strategy, status, battlesCompleted, failedEncounter, turns,
    finalHealth: { warrior: battle?.heroes.warrior.health ?? 25, mage: battle?.heroes.mage.health ?? 18 },
    rewards, battles, cards: cardStats, linkTriggers, actionCount,
  }
}

export function simulateBalance(options: { runs: number; seed: number; strategies?: BalanceStrategy[]; limits?: Partial<BalanceLimits> }): BalanceRun[] {
  const strategies = options.strategies ?? ['aggressive', 'defensive', 'balanced']
  const results: BalanceRun[] = []
  for (const strategy of strategies) for (let index = 0; index < options.runs; index += 1) results.push(simulateRun((options.seed + index) >>> 0, strategy, options.limits))
  return results
}

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
    return {
      strategy, runs: sample.length, victories: wins, defeats, timeouts, winRate: wins / denominator,
      averageTurns: sample.reduce((sum, run) => sum + run.turns, 0) / denominator,
      medianTurns: median(sample.map(run => run.turns)),
      averageBrannHp: hp.reduce((sum, run) => sum + run.finalHealth.warrior, 0) / hpDenominator,
      averageLiraHp: hp.reduce((sum, run) => sum + run.finalHealth.mage, 0) / hpDenominator,
      battlesReached: [0, 1, 2].map(index => sample.filter(run => run.battles.length > index).length),
      battleWins: [0, 1, 2].map(index => sample.filter(run => run.battles[index]?.result === 'victory').length),
    }
  })
}

function median(numbers: number[]): number {
  if (!numbers.length) return 0
  const ordered = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2
}

