import { createServer } from 'vite'

const args = process.argv.slice(2)
const flag = name => { const index = args.indexOf(name); return index < 0 ? undefined : Number(args[index + 1]) }
const seedArg = args.find((value, index) => !value.startsWith('--') && (index === 0 || args[index - 1] !== '--runs' && args[index - 1] !== '--archetype-runs'))
const baseSeed = Number(seedArg ?? 42) >>> 0
const positionalRunCount = args.slice(args.indexOf(seedArg) + 1).find(value => /^\d+$/.test(value))
const runCount = Math.max(1, Math.floor(flag('--runs') ?? (Number(positionalRunCount) || 100)))
const archetypeRuns = Math.max(1, Math.floor(flag('--archetype-runs') ?? 20))

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const campaign = await server.ssrLoadModule('/src/game/campaign.ts')
  const routePolicy = await server.ssrLoadModule('/src/game/dungeonRoutePolicy.ts')
  const balance = await server.ssrLoadModule('/src/game/balance.ts')
  const battleRules = await server.ssrLoadModule('/src/game/battle.ts')
  const plannerModule = await server.ssrLoadModule('/src/game/balancePlanner.ts')
  const types = await server.ssrLoadModule('/src/game/types.ts')
  const economy = await server.ssrLoadModule('/src/game/economy.ts')
  const roster = await server.ssrLoadModule('/src/game/encountersV09.ts')

  function addReward(run, strategy) {
    if (!run.pendingReward) return run
    const offers = campaign.dungeonRewardOptions(run)
    const rank = { thunderbolt: 8, frostbolt: 7, parry: 6, 'shield-bash': 6, bastion: strategy === 'defensive' ? 7 : 5, interpose: strategy === 'defensive' ? 7 : 4, 'ice-ward': strategy === 'defensive' ? 7 : 5, 'quick-cut': 5, 'arcane-insight': 4 }
    return campaign.claimDungeonReward(run, [...offers].sort((a, b) => (rank[b.id] ?? 0) - (rank[a.id] ?? 0))[0])
  }

  function playBattle(state, strategy) {
    const planner = strategy === 'planner' ? plannerModule.createTurnPlanner() : undefined
    let turns = 0, cardsPlayed = 0, manaSpent = 0
    while (!state.result && turns < 24) {
      turns += 1
      let plays = 0
      while (!state.result && plays < 12) {
        const instanceId = planner?.next(state)
        const card = instanceId ? state.hand.find(item => item.instanceId === instanceId) : strategy === 'planner' ? undefined : balance.chooseCard(state, strategy)
        if (!card) break
        const definition = types.cardDefinition(card.definitionId)
        const outcome = battleRules.playCard(state, card.instanceId)
        if (!outcome.ok) break
        cardsPlayed += 1; manaSpent += definition.cost; plays += 1
      }
      if (!state.result) battleRules.endTurn(state)
    }
    return { turns, cardsPlayed, manaSpent, result: state.result ?? 'timeout' }
  }

  function simulate(seed, policy, strategy) {
    let run = campaign.createDungeonRun(seed, economy.gameEconomy)
    let battles = 0, elites = 0, rests = 0, turns = 0, cards = 0, mana = 0
    let normalLosses = 0, eliteLosses = 0, bossLosses = 0, totalHealthAfterFights = 0, healthAfterFightCount = 0, bossHealth = null
    let normalTurns = 0, normalFightCount = 0, eliteTurns = 0, eliteFightCount = 0
    let warriorHealthAfterFights = 0, mageHealthAfterFights = 0
    let bossWarriorHealth = null, bossMageHealth = null
    let adjacentRepeats = 0, repeatedEncounterCount = 0, previousBattleLayer = -2
    const routeEncounters = []
    const seenEncounterTypes = new Set()
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
      const encounter = campaign.dungeonEncounter(node, economy.gameEconomy)
      if (node.type === 'final') {
        bossHealth = run.heroes.warrior.health + run.heroes.mage.health
        bossWarriorHealth = run.heroes.warrior.health; bossMageHealth = run.heroes.mage.health
      }
      if (previousBattleLayer + 1 === node.layer && routeEncounters.at(-1) === node.encounterId) adjacentRepeats += 1
      if (seenEncounterTypes.has(node.encounterId)) repeatedEncounterCount += 1
      seenEncounterTypes.add(node.encounterId)
      routeEncounters.push(node.encounterId)
      previousBattleLayer = node.layer
      const state = campaign.createCampaignBattle({ encounter, heroes: run.heroes, deck: run.deck, seed: campaign.deriveDungeonSeed(seed, `battle:${node.id}`), battleId: `route/${seed}/${policy}/${strategy}/${node.id}`, economy: economy.gameEconomy })
      const outcome = playBattle(state, strategy)
      battles += 1; elites += Number(node.type === 'elite'); turns += outcome.turns; cards += outcome.cardsPlayed; mana += outcome.manaSpent
      if (node.type === 'elite') { eliteTurns += outcome.turns; eliteFightCount += 1 }
      else if (node.type === 'battle') { normalTurns += outcome.turns; normalFightCount += 1 }
      if (outcome.result === 'defeat') {
        if (node.type === 'elite') eliteLosses += 1
        else if (node.type === 'battle') normalLosses += 1
        else bossLosses += 1
      }
      const health = state.heroes.warrior.health + state.heroes.mage.health
      warriorHealthAfterFights += state.heroes.warrior.health
      mageHealthAfterFights += state.heroes.mage.health
      totalHealthAfterFights += health; healthAfterFightCount += 1
      run = campaign.resolveDungeonBattle(run, state)
      if (run.status === 'active' && run.pendingReward) run = addReward(run, strategy)
    }
    return { seed, policy, strategy, status: run.status, battles, elites, rests, turns, cards, mana, normalLosses, eliteLosses, bossLosses, normalTurns, normalFightCount, eliteTurns, eliteFightCount, avgWarriorAfterFight: healthAfterFightCount ? warriorHealthAfterFights / healthAfterFightCount : 0, avgMageAfterFight: healthAfterFightCount ? mageHealthAfterFights / healthAfterFightCount : 0, avgHealthAfterFight: healthAfterFightCount ? totalHealthAfterFights / healthAfterFightCount : 0, bossHealth, bossWarriorHealth, bossMageHealth, adjacentRepeats, repeatedEncounterCount, routeEncounters }
  }

  const routeRows = []
  for (const policy of ['safe', 'risky', 'mixed']) {
    for (const strategy of ['balanced', 'defensive', 'planner']) {
      const samples = Array.from({ length: runCount }, (_, sample) => simulate((baseSeed + sample) >>> 0, policy, strategy))
      const avg = key => samples.reduce((sum, item) => sum + item[key], 0) / samples.length
      routeRows.push({
        policy, strategy, runs: samples.length, wins: samples.filter(item => item.status === 'victory').length,
        winRate: +(100 * samples.filter(item => item.status === 'victory').length / samples.length).toFixed(1),
        normalLosses: samples.reduce((sum, item) => sum + item.normalLosses, 0), eliteLosses: samples.reduce((sum, item) => sum + item.eliteLosses, 0), bossLosses: samples.reduce((sum, item) => sum + item.bossLosses, 0),
        avgBattles: +avg('battles').toFixed(2), avgElites: +avg('elites').toFixed(2), avgRests: +avg('rests').toFixed(2),
        avgNormalTurns: +(samples.reduce((sum, item) => sum + item.normalTurns, 0) / samples.reduce((sum, item) => sum + item.normalFightCount, 0) || 0).toFixed(2),
        avgEliteTurns: +(samples.reduce((sum, item) => sum + item.eliteTurns, 0) / samples.reduce((sum, item) => sum + item.eliteFightCount, 0) || 0).toFixed(2),
        avgWarriorAfterFight: +avg('avgWarriorAfterFight').toFixed(1), avgMageAfterFight: +avg('avgMageAfterFight').toFixed(1),
        avgBossEntryHP: +(samples.reduce((sum, item) => sum + (item.bossHealth ?? 0), 0) / samples.filter(item => item.bossHealth !== null).length || 0).toFixed(1),
        avgBossWarriorHP: +(samples.reduce((sum, item) => sum + (item.bossWarriorHealth ?? 0), 0) / samples.filter(item => item.bossWarriorHealth !== null).length || 0).toFixed(1),
        avgBossMageHP: +(samples.reduce((sum, item) => sum + (item.bossMageHealth ?? 0), 0) / samples.filter(item => item.bossMageHealth !== null).length || 0).toFixed(1),
        avgTurnsPerRun: +avg('turns').toFixed(2), repeatedEncounters: samples.reduce((sum, item) => sum + item.repeatedEncounterCount, 0), adjacentRepeats: samples.reduce((sum, item) => sum + item.adjacentRepeats, 0),
      })
    }
  }
  console.log(`Dungeon routes · ${runCount} seeds per route/strategy · seed range ${baseSeed}–${(baseSeed + runCount - 1) >>> 0} · economy B`)
  console.table(routeRows)
  const policySummary = ['safe', 'risky', 'mixed'].map(policy => {
    const rows = routeRows.filter(row => row.policy === policy)
    return { policy, avgWinRate: +(rows.reduce((sum, row) => sum + row.winRate, 0) / rows.length).toFixed(1), normalLosses: rows.reduce((sum, row) => sum + row.normalLosses, 0), eliteLosses: rows.reduce((sum, row) => sum + row.eliteLosses, 0), avgRests: +(rows.reduce((sum, row) => sum + row.avgRests, 0) / rows.length).toFixed(2) }
  })
  console.log('\nRoute policy summary averaged across the three combat strategies')
  console.table(policySummary)

  console.log(`\nArchetype Balance Lab · ${archetypeRuns} shuffled-deck seeds per enemy and strategy`)
  const labRows = []
  for (const encounter of [...roster.normalEncounterCatalog, ...roster.eliteEncounterCatalog]) {
    for (const strategy of ['balanced', 'defensive', 'planner']) {
      const samples = []
      for (let sample = 0; sample < archetypeRuns; sample += 1) {
        const state = campaign.createCampaignBattle({ encounter, seed: campaign.deriveDungeonSeed(baseSeed + sample, encounter.id), battleId: `lab/${encounter.id}/${strategy}/${sample}`, economy: economy.gameEconomy })
        const item = playBattle(state, strategy)
        samples.push({ ...item, healthLeft: state.heroes.warrior.health + state.heroes.mage.health })
      }
      labRows.push({ enemy: encounter.name, tier: roster.eliteEncounterCatalog.includes(encounter) ? 'elite' : 'normal', strategy, samples: samples.length, wins: samples.filter(item => item.result === 'victory').length, winRate: +(100 * samples.filter(item => item.result === 'victory').length / samples.length).toFixed(1), avgTurns: +(samples.reduce((sum, item) => sum + item.turns, 0) / samples.length).toFixed(2), avgHPLeft: +(samples.reduce((sum, item) => sum + item.healthLeft, 0) / samples.length).toFixed(1) })
    }
  }
  console.table(labRows)
  console.log('\nMetrics: losses are recorded at the node where defeat occurred; boss entry HP is the party total before the final fight; adjacent repeats count consecutive identical encounters. These simulations measure this bot, reward picker and economy B, not human win rates.')
} finally {
  await server.close()
}
