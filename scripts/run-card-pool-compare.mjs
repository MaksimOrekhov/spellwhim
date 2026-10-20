// Paired reward-pool comparison through the canonical campaign and battle engines.
// npm run card-pool:compare -- 100 42
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createServer } from 'vite'
import { dungeonRewardRank } from './lib/dungeonRewardRank.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const positional = args.filter(value => !value.startsWith('--'))
const runs = Math.max(1, Math.floor(Number(option('--runs', positional[0] ?? 100))))
const baseSeed = Number(option('--seed', positional[1] ?? 42)) >>> 0
const jsonPath = option('--json', 'docs/data/card-pool-art-v01/comparison.json')
const policies = option('--policies', 'safe,risky,mixed').split(',')
const strategies = option('--strategies', 'aggressive,balanced,defensive,planner').split(',')
const pools = ['before', 'expanded']
const bleedRank = { rend: 6.5, 'reaping-blow': 5.5, 'boil-blood': 4.5 }
const artifactRank = { 'reliable-wedge': 6, 'shift-whistle': 5, 'double-pulley': 5, 'weakpoint-lens': 4, 'tension-spool': 4 }
const artifactOwner = { 'reliable-wedge': 'mage', 'shift-whistle': 'mage', 'double-pulley': 'warrior', 'weakpoint-lens': 'mage', 'tension-spool': 'warrior' }
const expansionIds = ['stance-strike', 'wound-clamp', 'covering-counter', 'crushing-swing', 'arcane-mark', 'ice-echo', 'frost-seal', 'blood-resonance']

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const progression = await server.ssrLoadModule('/src/game/cardProgression.ts')
  const load = path => server.ssrLoadModule(path)
  const [campaign, routePolicy, balance, battleRules, plannerModule, types, economy, rosterModule, statusModule] = await Promise.all([
    load('/src/game/campaign.ts'), load('/src/game/dungeonRoutePolicy.ts'), load('/src/game/balance.ts'), load('/src/game/battle.ts'),
    load('/src/game/balancePlanner.ts'), load('/src/game/types.ts'), load('/src/game/economy.ts'), load('/src/game/encountersV10.ts'), load('/src/game/statuses.ts'),
  ])
  const roster = rosterModule.defaultDungeonRoster
  const blankCardStats = () => ({ offerEvents: 0, offeredSlots: 0, selected: 0, plays: 0, damage: 0, enemyArmorDamage: 0, enemyHealthDamage: 0, armorPoints: 0, drawAttempts: 0, cardsDrawn: 0, vulnerabilityConsumed: 0, bleedingApplied: 0, bleedingTicks: 0, bleedingTickDamage: 0, bleedingBurstUses: 0, bleedingBurstStrength: 0, bleedingBurstDamage: 0, artifactTriggerPlays: 0, artifactBonusDamage: 0, artifactBonusArmor: 0, manaSpent: 0 })
  const cardStats = Object.fromEntries(pools.map(pool => [pool, Object.fromEntries(strategies.map(strategy => [strategy, {}]))]))
  const rewardEvents = Object.fromEntries(pools.map(pool => [pool, Object.fromEntries(strategies.map(strategy => [strategy, 0]))]))
  const resultSamples = Object.fromEntries(pools.map(pool => [pool, Object.fromEntries(policies.map(policy => [policy, Object.fromEntries(strategies.map(strategy => [strategy, []]))]))]))

  function ensureCard(pool, strategy, id) {
    return cardStats[pool][strategy][id] ??= blankCardStats()
  }

  function recordOffer(run, pool, strategy) {
    const offers = campaign.dungeonRewardOptions(run)
    rewardEvents[pool][strategy] += 1
    const ids = new Set(offers.map(card => card.id))
    for (const card of offers) ensureCard(pool, strategy, card.id).offeredSlots += 1
    for (const id of ids) ensureCard(pool, strategy, id).offerEvents += 1
    return offers
  }

  function claimReward(run, pool, strategy) {
    const offer = run.pendingReward
    if (!offer) return run
    const cardOffers = recordOffer(run, pool, strategy)
    if (offer.elite && run.artifacts.length < 2) {
      const artifacts = [...campaign.dungeonArtifactOptions(run)].sort((a, b) => (artifactRank[b.id] ?? 0) - (artifactRank[a.id] ?? 0))
      const choice = artifacts[0]
      const occupied = new Set(run.artifacts.map(item => item.ownerInstanceId))
      const owners = ['warrior', 'mage'].map(key => run.heroes[key])
      const owner = owners.find(hero => hero.id === artifactOwner[choice?.id] && !occupied.has(hero.instanceId))
        ?? owners.find(hero => !occupied.has(hero.instanceId))
      if (choice && owner) return campaign.claimDungeonArtifact(run, choice.id, owner.instanceId)
    }
    const rank = id => bleedRank[id] ?? dungeonRewardRank(id, strategy)
    const chosen = [...cardOffers].sort((a, b) => rank(b.id) - rank(a.id))[0]
    if (!chosen) return run
    ensureCard(pool, strategy, chosen.id).selected += 1
    return campaign.claimDungeonReward(run, chosen)
  }

  function playBattle(state, pool, strategy) {
    const planner = strategy === 'planner' ? plannerModule.createTurnPlanner() : undefined
    let turns = 0, cardsPlayed = 0, manaSpent = 0, bleedTurnDamage = 0
    while (!state.result && turns < 24) {
      turns += 1
      let plays = 0
      while (!state.result && plays < 12) {
        const instanceId = planner?.next(state)
        const card = instanceId ? state.hand.find(item => item.instanceId === instanceId) : strategy === 'planner' ? undefined : balance.chooseCard(state, strategy)
        if (!card) break
        const definition = progression.resolveCardDefinition(card)
        const preview = battleRules.previewCard(state, definition)
        const beforeHealth = state.enemy.health
        const beforeArmor = state.enemy.armor
        const beforeBleeding = statusModule.statusValue(state, 'enemy', 'bleeding')
        const blockedBefore = state.blockedDraws
        const item = ensureCard(pool, strategy, definition.id)
        if (!battleRules.playCard(state, card.instanceId).ok) break
        const healthLoss = Math.max(0, beforeHealth - state.enemy.health)
        const armorLoss = Math.max(0, beforeArmor - state.enemy.armor)
        const tickEffects = definition.effects.filter(effect => effect.type === 'status-tick' && effect.status === 'bleeding').length
        const burstEffects = definition.effects.filter(effect => effect.type === 'status-burst' && effect.status === 'bleeding')
        const burstDamage = preview.damageParts.filter(part => part.id === 'bleeding-burst').reduce((sum, part) => sum + part.amount, 0)
        item.plays += 1
        item.damage += healthLoss + armorLoss
        item.enemyArmorDamage += armorLoss
        item.enemyHealthDamage += healthLoss
        item.armorPoints += Object.values(preview.armor).reduce((sum, value) => sum + value, 0) + Object.values(preview.artifactArmor).reduce((sum, value) => sum + value, 0)
        item.drawAttempts += preview.draw
        item.cardsDrawn += Math.max(0, preview.draw - (state.blockedDraws - blockedBefore))
        item.vulnerabilityConsumed += Number(preview.vulnerabilityBonus > 0)
        item.bleedingApplied += definition.effects.filter(effect => effect.type === 'status' && effect.status === 'bleeding').reduce((sum, effect) => sum + (effect.amount ?? 1), 0)
        item.bleedingTicks += Math.min(tickEffects, beforeBleeding > 0 ? tickEffects : 0)
        item.bleedingTickDamage += preview.statusDamage
        item.bleedingBurstUses += Number(burstEffects.length > 0 && beforeBleeding > 0)
        item.bleedingBurstStrength += burstEffects.length > 0 ? beforeBleeding : 0
        item.bleedingBurstDamage += burstDamage
        item.artifactTriggerPlays += Number(preview.artifactBonuses.length > 0)
        item.artifactBonusDamage += preview.artifactDamage
        item.artifactBonusArmor += Object.values(preview.artifactArmor).reduce((sum, value) => sum + value, 0)
        item.manaSpent += definition.cost
        cardsPlayed += 1; manaSpent += definition.cost; plays += 1
      }
      if (state.result) break
      const tick = Math.min(state.enemy.health, statusModule.pendingTickDamage(state, 'enemy'))
      battleRules.endTurn(state)
      bleedTurnDamage += tick
    }
    return { turns, cardsPlayed, manaSpent, bleedTurnDamage, result: state.result ?? 'timeout' }
  }

  function mapSignature(map) {
    return JSON.stringify(map.layers.flat().map(node => [node.id, node.type, node.edges, node.encounterId, node.encounterHealth]))
  }

  function simulate(seed, pool, policy, strategy) {
    let run = campaign.createDungeonRun(seed, economy.gameEconomy, types.startingDeck, roster)
    if (pool === 'before') run = { ...run, excludedRewards: [...campaign.CARD_POOL_EXPANSION_V01_IDS] }
    const signature = mapSignature(run.map)
    let battles = 0, elites = 0, rests = 0, turns = 0, cards = 0, mana = 0
    let normalTurns = 0, normalFights = 0, eliteTurns = 0, eliteFights = 0, bleedTurnDamage = 0
    let warriorAfterFight = 0, mageAfterFight = 0, postFightCount = 0, bossEntryHealth = null, bossEntryWarrior = null, bossEntryMage = null
    while (run.status === 'active') {
      const available = campaign.availableDungeonNodes(run)
      const visible = available.map(routePolicy.publicDungeonNodeView)
      const selected = routePolicy.chooseDungeonRouteNode(visible, run.heroes, policy)
      if (!selected) break
      const node = available.find(item => item.id === selected.id)
      if (!node) break
      run = campaign.enterDungeonNode(run, node.id)
      if (node.type === 'rest') {
        const injured = ['warrior', 'mage'].sort((a, b) => run.heroes[a].health / run.heroes[a].maxHealth - run.heroes[b].health / run.heroes[b].maxHealth)[0]
        run = campaign.resolveDungeonRest(run, run.heroes[injured].health < run.heroes[injured].maxHealth ? injured : null)
        rests += 1
        continue
      }
      const encounter = campaign.dungeonEncounter(node, economy.gameEconomy, roster)
      if (node.type === 'final') {
        bossEntryWarrior = run.heroes.warrior.health
        bossEntryMage = run.heroes.mage.health
        bossEntryHealth = bossEntryWarrior + bossEntryMage
      }
      const state = campaign.createCampaignBattle({
        encounter, heroes: run.heroes, deck: run.deck, artifacts: run.artifacts,
        seed: campaign.deriveDungeonSeed(seed, `battle:${node.id}`),
        battleId: `card-pool-compare/${pool}/${seed}/${policy}/${strategy}/${node.id}`, economy: economy.gameEconomy,
      })
      const result = playBattle(state, pool, strategy)
      battles += 1; elites += Number(node.type === 'elite'); turns += result.turns; cards += result.cardsPlayed; mana += result.manaSpent; bleedTurnDamage += result.bleedTurnDamage
      if (node.type === 'elite') { eliteTurns += result.turns; eliteFights += 1 }
      else if (node.type === 'battle') { normalTurns += result.turns; normalFights += 1 }
      warriorAfterFight += state.heroes.warrior.health
      mageAfterFight += state.heroes.mage.health
      postFightCount += 1
      run = campaign.resolveDungeonBattle(run, state)
      if (run.status === 'active' && run.pendingReward) run = claimReward(run, pool, strategy)
    }
    return {
      seed, pool, policy, strategy, status: run.status, battles, elites, rests, turns, cards, mana,
      normalTurns, normalFights, eliteTurns, eliteFights, bleedTurnDamage,
      avgWarriorAfterFight: postFightCount ? warriorAfterFight / postFightCount : 0,
      avgMageAfterFight: postFightCount ? mageAfterFight / postFightCount : 0,
      bossEntryHealth, bossEntryWarrior, bossEntryMage,
      finalWarriorHealth: run.heroes.warrior.health, finalMageHealth: run.heroes.mage.health, mapSignature: signature,
    }
  }

  const metric = (items, select) => items.length ? items.reduce((sum, item) => sum + select(item), 0) / items.length : 0
  const summary = samples => {
    const fights = samples.reduce((sum, item) => sum + item.battles, 0)
    const normalFights = samples.reduce((sum, item) => sum + item.normalFights, 0)
    const eliteFights = samples.reduce((sum, item) => sum + item.eliteFights, 0)
    const bossEntries = samples.filter(item => item.bossEntryHealth !== null)
    return {
      runs: samples.length, wins: samples.filter(item => item.status === 'victory').length,
      winRate: +(100 * samples.filter(item => item.status === 'victory').length / samples.length).toFixed(1),
      avgFights: +metric(samples, item => item.battles).toFixed(2), avgElites: +metric(samples, item => item.elites).toFixed(2), avgRests: +metric(samples, item => item.rests).toFixed(2),
      avgTurnsPerRun: +metric(samples, item => item.turns).toFixed(2), avgCardsPerRun: +metric(samples, item => item.cards).toFixed(2), avgManaPerRun: +metric(samples, item => item.mana).toFixed(2),
      avgNormalTurns: +(samples.reduce((sum, item) => sum + item.normalTurns, 0) / Math.max(1, normalFights)).toFixed(2),
      avgEliteTurns: +(samples.reduce((sum, item) => sum + item.eliteTurns, 0) / Math.max(1, eliteFights)).toFixed(2),
      avgWarriorHPAfterFight: +(samples.reduce((sum, item) => sum + item.avgWarriorAfterFight * item.battles, 0) / Math.max(1, fights)).toFixed(1),
      avgMageHPAfterFight: +(samples.reduce((sum, item) => sum + item.avgMageAfterFight * item.battles, 0) / Math.max(1, fights)).toFixed(1),
      avgBossEntryHP: +metric(bossEntries, item => item.bossEntryHealth).toFixed(1),
      avgFinalPartyHP: +metric(samples, item => item.finalWarriorHealth + item.finalMageHealth).toFixed(1),
      bleedTurnDamagePerRun: +metric(samples, item => item.bleedTurnDamage).toFixed(2),
    }
  }

  for (const policy of policies) for (const strategy of strategies) for (let index = 0; index < runs; index += 1) {
    const seed = (baseSeed + index) >>> 0
    for (const pool of pools) resultSamples[pool][policy][strategy].push(simulate(seed, pool, policy, strategy))
  }

  const rows = []
  const paired = []
  for (const policy of policies) for (const strategy of strategies) {
    const before = resultSamples.before[policy][strategy]
    const expanded = resultSamples.expanded[policy][strategy]
    rows.push({ pool: 'before', policy, strategy, ...summary(before) }, { pool: 'expanded', policy, strategy, ...summary(expanded) })
    let expandedOnly = 0, beforeOnly = 0, mapsEqual = 0
    for (let index = 0; index < before.length; index += 1) {
      if (before[index].status !== expanded[index].status) {
        if (expanded[index].status === 'victory') expandedOnly += 1
        else if (before[index].status === 'victory') beforeOnly += 1
      }
      if (before[index].mapSignature === expanded[index].mapSignature) mapsEqual += 1
    }
    const beforeSummary = summary(before), expandedSummary = summary(expanded)
    paired.push({
      policy, strategy, runs, mapSeedsMatched: mapsEqual,
      beforeWinRate: beforeSummary.winRate, expandedWinRate: expandedSummary.winRate,
      deltaWinRate: +(expandedSummary.winRate - beforeSummary.winRate).toFixed(1), expandedOnlyWins: expandedOnly, beforeOnlyWins: beforeOnly,
      deltaTurnsPerRun: +(expandedSummary.avgTurnsPerRun - beforeSummary.avgTurnsPerRun).toFixed(2),
      deltaWarriorHPAfterFight: +(expandedSummary.avgWarriorHPAfterFight - beforeSummary.avgWarriorHPAfterFight).toFixed(1),
      deltaMageHPAfterFight: +(expandedSummary.avgMageHPAfterFight - beforeSummary.avgMageHPAfterFight).toFixed(1),
      deltaBossEntryHP: +(expandedSummary.avgBossEntryHP - beforeSummary.avgBossEntryHP).toFixed(1),
    })
  }

  const newCardRows = []
  for (const pool of pools) for (const strategy of strategies) for (const id of expansionIds) {
    const stats = cardStats[pool][strategy][id] ?? blankCardStats()
    const selected = stats.selected
    newCardRows.push({ pool, strategy, id, name: types.cardDefinition(id).name, ...stats,
      offerRate: +(100 * stats.offerEvents / Math.max(1, rewardEvents[pool][strategy])).toFixed(2),
      selectionPerAppearance: +(100 * stats.selected / Math.max(1, stats.offerEvents)).toFixed(1),
      playsPerSelection: +(stats.plays / Math.max(1, selected)).toFixed(2),
    })
  }

  console.log(`Card pool comparison · ${runs} paired seeds · ${baseSeed}–${(baseSeed + runs - 1) >>> 0} · economy ${economy.gameEconomy.id} · roster ${roster.id}`)
  console.log('Before = existing 15-card catalog / current Bleeding cards available; Expanded = same catalog plus eight v0.1 rewards. Same maps, route policies, strategies, artifacts, and canonical engine.')
  console.table(rows.map(({ pool, policy, strategy, runs: count, winRate, avgTurnsPerRun, avgWarriorHPAfterFight, avgMageHPAfterFight, avgBossEntryHP, bleedTurnDamagePerRun }) => ({ pool, policy, strategy, runs: count, winRate, avgTurnsPerRun, avgWarriorHPAfterFight, avgMageHPAfterFight, avgBossEntryHP, bleedTurnDamagePerRun })))
  console.log('\nPaired results (same seed, route policy, and combat strategy)')
  console.table(paired)
  console.log('\nNew-card reward and play metrics')
  console.table(newCardRows.map(({ pool, strategy, id, offerEvents, selected, plays, damage, armorPoints, cardsDrawn, vulnerabilityConsumed, bleedingTicks, bleedingBurstUses, artifactTriggerPlays }) => ({ pool, strategy, id, offerEvents, selected, plays, damage, armorPoints, cardsDrawn, vulnerabilityConsumed, bleedingTicks, bleedingBurstUses, artifactTriggerPlays })))

  if (jsonPath) {
    mkdirSync(dirname(jsonPath), { recursive: true })
    const fullCardStats = Object.fromEntries(pools.map(pool => [pool, Object.fromEntries(strategies.map(strategy => [strategy, cardStats[pool][strategy]]))]))
    writeFileSync(jsonPath, JSON.stringify({
      metadata: { runs, seed: baseSeed, seedEnd: (baseSeed + runs - 1) >>> 0, economy: economy.gameEconomy.id, roster: roster.id, pools: ['before (expansion IDs excluded; Bleeding cards retained)', 'expanded (all reward cards)'], routePolicies: policies, strategies },
      summaries: rows, paired, expansionCardMetrics: newCardRows, rewardEvents, cardMetrics: fullCardStats,
      method: 'The battle engine, campaign, reward offer seeding, route policy, artifacts, and combat strategies are loaded from the game source via Vite SSR. The comparison differs only in whether the eight v0.1 card IDs are excluded from reward offers. Map signatures are compared for each paired seed. The reward picker is a deterministic scripted preference using the route-lab ranks plus the existing Bleeding-package ranks from the challenge lab; these runs are not human win rates.',
    }, null, 2))
  }
} finally {
  await server.close()
}
