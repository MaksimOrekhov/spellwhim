import { createServer } from 'vite'

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const campaign = await server.ssrLoadModule('/src/game/campaign.ts')
  const balance = await server.ssrLoadModule('/src/game/balance.ts')
  const battleRules = await server.ssrLoadModule('/src/game/battle.ts')
  const plannerModule = await server.ssrLoadModule('/src/game/balancePlanner.ts')
  const types = await server.ssrLoadModule('/src/game/types.ts')
  const economy = await server.ssrLoadModule('/src/game/economy.ts')
  const roster = await server.ssrLoadModule('/src/game/encountersV09.ts')
  const seed = Number(process.argv[2] ?? 42) >>> 0

  function chooseRouteNode(run, policy) {
    const nodes = campaign.availableDungeonNodes(run)
    const ratio = Math.min(run.heroes.warrior.health / run.heroes.warrior.maxHealth, run.heroes.mage.health / run.heroes.mage.maxHealth)
    return [...nodes].sort((a, b) => score(b) - score(a) || a.column - b.column)[0]
    function score(node) {
      if (policy === 'safe') return (node.type === 'rest' ? 100 : node.type === 'battle' ? 20 : -30) - (node.encounterHealth ?? 0) * 0.15
      if (policy === 'risky') return (node.type === 'elite' ? 100 : node.type === 'battle' ? 20 : -10) + (node.encounterHealth ?? 0) * 0.08
      if (node.type === 'rest') return ratio < 0.7 ? 120 : 35
      return (node.type === 'elite' ? (ratio > 0.82 ? 65 : -35) : 40) - (node.encounterHealth ?? 0) * 0.12
    }
  }

  function addReward(run, strategy) {
    if (!run.pendingReward) return run
    const offers = campaign.dungeonRewardOptions(run)
    const rank = { 'thunderbolt': 8, 'frostbolt': 7, 'parry': 6, 'shield-bash': 6, 'bastion': strategy === 'defensive' ? 7 : 5, 'interpose': strategy === 'defensive' ? 7 : 4, 'ice-ward': strategy === 'defensive' ? 7 : 5, 'quick-cut': 5, 'arcane-insight': 4 }
    const choice = [...offers].sort((a, b) => (rank[b.id] ?? 0) - (rank[a.id] ?? 0))[0]
    return campaign.claimDungeonReward(run, choice)
  }

  function playBattle(state, strategy) {
    const planner = strategy === 'planner' ? plannerModule.createTurnPlanner() : undefined
    let turns = 0
    let cardsPlayed = 0
    let manaSpent = 0
    let vulnerabilitySetups = 0
    let vulnerabilityTriggers = 0
    const defenses = { warrior: 0, mage: 0 }
    while (!state.result && turns < 24) {
      turns += 1
      let plays = 0
      while (!state.result && plays < 12) {
        const instanceId = planner?.next(state)
        const card = instanceId ? state.hand.find(item => item.instanceId === instanceId) : strategy === 'planner' ? undefined : balance.chooseCard(state, strategy)
        if (!card) break
        const definition = types.cardDefinition(card.definitionId)
        const result = battleRules.playCard(state, card.instanceId)
        if (!result.ok) break
        cardsPlayed += 1
        manaSpent += definition.cost
        vulnerabilitySetups += Number(result.outcome.appliedStatuses.includes('vulnerability') && state.enemy.vulnerable)
        vulnerabilityTriggers += Number(result.outcome.vulnerabilityBonus > 0)
        defenses.warrior += result.outcome.armor.warrior
        defenses.mage += result.outcome.armor.mage
        plays += 1
      }
      if (!state.result) battleRules.endTurn(state)
    }
    return { turns, cardsPlayed, manaSpent, vulnerabilitySetups, vulnerabilityTriggers, defenses, result: state.result ?? 'timeout' }
  }

  function simulate(policy, strategy) {
    let run = campaign.createDungeonRun(seed, economy.gameEconomy)
    let battles = 0, elites = 0, rests = 0, turns = 0, cards = 0, mana = 0
    const enemyStats = new Map()
    while (run.status === 'active') {
      const node = chooseRouteNode(run, policy)
      if (!node) break
      run = campaign.enterDungeonNode(run, node.id)
      if (node.type === 'rest') {
        const injured = ['warrior', 'mage'].sort((a, b) => run.heroes[a].health / run.heroes[a].maxHealth - run.heroes[b].health / run.heroes[b].maxHealth)[0]
        run = campaign.resolveDungeonRest(run, run.heroes[injured].health < run.heroes[injured].maxHealth ? injured : null)
        rests += 1
        continue
      }
      const encounter = campaign.dungeonEncounter(node, economy.gameEconomy)
      const state = campaign.createCampaignBattle({ encounter, heroes: run.heroes, deck: run.deck, seed: campaign.deriveDungeonSeed(seed, `battle:${node.id}`), battleId: `route/${seed}/${policy}/${strategy}/${node.id}`, economy: economy.gameEconomy })
      const start = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
      const outcome = playBattle(state, strategy)
      battles += 1; elites += Number(node.type === 'elite'); turns += outcome.turns; cards += outcome.cardsPlayed; mana += outcome.manaSpent
      const row = enemyStats.get(encounter.name) ?? { name: encounter.name, count: 0, turns: 0, cards: 0, mana: 0, hpLostWarrior: 0, hpLostMage: 0, wins: 0, vulnerabilitySetups: 0, vulnerabilityTriggers: 0, defenseCardsArmor: 0 }
      row.count += 1; row.turns += outcome.turns; row.cards += outcome.cardsPlayed; row.mana += outcome.manaSpent
      row.hpLostWarrior += start.warrior - state.heroes.warrior.health; row.hpLostMage += start.mage - state.heroes.mage.health
      row.wins += Number(outcome.result === 'victory'); row.vulnerabilitySetups += outcome.vulnerabilitySetups; row.vulnerabilityTriggers += outcome.vulnerabilityTriggers
      row.defenseCardsArmor += outcome.defenses.warrior + outcome.defenses.mage
      enemyStats.set(encounter.name, row)
      run = campaign.resolveDungeonBattle(run, state)
      if (run.status === 'active' && run.pendingReward) run = addReward(run, strategy)
    }
    return { policy, strategy, status: run.status, battles, elites, rests, turns, cards, mana, health: run.heroes.warrior.health + run.heroes.mage.health, enemyStats: [...enemyStats.values()] }
  }

  const result = []
  for (const policy of ['safe', 'risky', 'mixed']) {
    for (const strategy of ['balanced', 'defensive', 'planner']) result.push(simulate(policy, strategy))
  }
  console.log(`Dungeon route simulation · run seed ${seed} · economy B · actual battle/reward/rest rules`)
  console.table(result.map(({ policy, strategy, status, battles, elites, rests, turns, cards, mana, health }) => ({ route: policy, strategy, status, battles, elites, rests, turns, cards, mana, health })))
  for (const item of result) {
    console.log(`\n${item.policy} / ${item.strategy} · enemy details (single deterministic run)`)
    console.table(item.enemyStats.map(row => ({ enemy: row.name, fights: row.count, turns: +(row.turns / row.count).toFixed(1), cards: +(row.cards / row.count).toFixed(1), mana: +(row.mana / row.count).toFixed(1), warriorHP: row.hpLostWarrior, mageHP: row.hpLostMage, wins: row.wins, vulnerability: `${row.vulnerabilitySetups}/${row.vulnerabilityTriggers}`, armor: row.defenseCardsArmor })))
  }
  console.log('\nArchetype Balance Lab · 3 deterministic deck seeds per enemy and strategy')
  const archetypes = [...roster.normalEncounterCatalog, ...roster.eliteEncounterCatalog]
  const labRows = []
  for (const encounter of archetypes) {
    for (const strategy of ['balanced', 'defensive', 'planner']) {
      const samples = []
      for (let sample = 0; sample < 3; sample += 1) {
        const state = campaign.createCampaignBattle({ encounter, seed: campaign.deriveDungeonSeed(9000 + sample, encounter.id), battleId: `lab/${encounter.id}/${strategy}/${sample}`, economy: economy.gameEconomy })
        const start = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
        const item = playBattle(state, strategy)
        samples.push({ ...item, lossWarrior: start.warrior - state.heroes.warrior.health, lossMage: start.mage - state.heroes.mage.health })
      }
      const avg = key => samples.reduce((sum, item) => sum + item[key], 0) / samples.length
      labRows.push({ enemy: encounter.name, tier: roster.eliteEncounterCatalog.includes(encounter) ? 'elite' : 'normal', strategy, wins: samples.filter(item => item.result === 'victory').length, turns: +avg('turns').toFixed(1), cards: +avg('cardsPlayed').toFixed(1), mana: +avg('manaSpent').toFixed(1), warriorHP: +avg('lossWarrior').toFixed(1), mageHP: +avg('lossMage').toFixed(1), vulnerability: `${avg('vulnerabilitySetups').toFixed(1)}/${avg('vulnerabilityTriggers').toFixed(1)}`, armor: +(samples.reduce((sum, item) => sum + item.defenses.warrior + item.defenses.mage, 0) / samples.length).toFixed(1) })
    }
  }
  console.table(labRows)
  console.log('\nNote: route rows are one deterministic seed; archetype rows are three card-order samples each. These are diagnostics, not population win-rate estimates.')
} finally {
  await server.close()
}
