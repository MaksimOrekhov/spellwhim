// Combat Overhaul v0.2 lab: replays complete Deadmines routes with real card and artifact rewards against several enemy rosters.
// npm run challenge:lab -- --runs 100 --seed 42 --rosters A,B,C,D [--artifacts real|none] [--json out.json]
import { createServer } from 'vite'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const runs = Math.max(1, Math.floor(Number(option('--runs', 100))))
const seed = Number(option('--seed', 42)) >>> 0
const rosterIds = option('--rosters', 'A,B,C,D').split(',')
const artifactModes = option('--artifacts', 'real,none').split(',')
const strategies = option('--strategies', 'balanced,defensive,planner').split(',')
const policies = option('--policies', 'safe,risky,mixed').split(',')
const jsonPath = option('--json', null)
const cardPackage = option('--cards', 'base')
const skipArchetypes = args.includes('--no-archetypes')
const archetypeRuns = Math.max(1, Math.floor(Number(option('--archetype-runs', 20))))

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const load = path => server.ssrLoadModule(path)
  const [campaign, routePolicy, balance, rules, plannerModule, types, economy, variants, rosterModule, artifactModule] = await Promise.all([
    load('/src/game/campaign.ts'), load('/src/game/dungeonRoutePolicy.ts'), load('/src/game/balance.ts'), load('/src/game/battle.ts'),
    load('/src/game/balancePlanner.ts'), load('/src/game/types.ts'), load('/src/game/economy.ts'), load('/src/game/encounterExperiments.ts'), load('/src/game/rosters.ts'),
    load('/src/game/artifacts.ts'),
  ])
    const rank = { thunderbolt: 8, frostbolt: 7, parry: 6, 'shield-bash': 6, bastion: 5, interpose: 4, 'ice-ward': 5, 'quick-cut': 5, 'arcane-insight': 4 }
  const artifactRank = { 'reliable-wedge': 6, 'shift-whistle': 5, 'double-pulley': 5, 'weakpoint-lens': 4, 'tension-spool': 4 }
  const artifactOwner = { 'reliable-wedge': 'mage', 'shift-whistle': 'mage', 'double-pulley': 'warrior', 'weakpoint-lens': 'mage', 'tension-spool': 'warrior' }
  const heroKeys = ['warrior', 'mage']
  const sum = values => values.reduce((total, value) => total + value, 0)

  function claimReward(run, strategy, artifactMode) {
    const offer = run.pendingReward
    if (!offer) return run
    if (offer.elite && artifactMode === 'real') {
      const options = campaign.dungeonArtifactOptions(run).filter(item => run.artifacts.length < 2 || run.artifacts.some(owned => owned.ownerInstanceId))
      const choice = [...options].sort((a, b) => (artifactRank[b.id] ?? 0) - (artifactRank[a.id] ?? 0))[0]
      if (choice && run.artifacts.length < 2) {
        const preferred = artifactOwner[choice.id]
        const taken = new Set(run.artifacts.map(item => item.ownerInstanceId))
        const owner = heroKeys.map(key => run.heroes[key]).find(hero => hero.id === preferred && !taken.has(hero.instanceId)) ?? heroKeys.map(key => run.heroes[key]).find(hero => !taken.has(hero.instanceId))
        if (owner) return campaign.claimDungeonArtifact(run, choice.id, owner.instanceId)
      }
    }
    const offers = campaign.dungeonRewardOptions(run)
    const picked = [...offers].sort((a, b) => ((rank[b.id] ?? 0) - (rank[a.id] ?? 0)) || (strategy === 'defensive' && ((b.kind === 'defense') - (a.kind === 'defense'))))[0]
    return campaign.claimDungeonReward(run, picked)
  }

  function playBattle(state, strategy) {
    const planner = strategy === 'planner' ? plannerModule.createTurnPlanner() : undefined
    const stats = { turns: 0, cards: 0, defensePlays: 0, threatTurns: 0, mitigatedTurns: 0, lethalThreatTurns: 0, lostTo: { warrior: 0, mage: 0 }, bleedDamage: 0 }
    const startHealth = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
    while (!state.result && stats.turns < 40) {
      stats.turns += 1
      const before = rules.forecastEnemyAction(state)
      const startLoss = sum(before.targets.map(item => item.healthLoss))
      const startLethal = before.targets.some(item => item.lethal)
      let plays = 0
      while (!state.result && plays < 14) {
        const id = planner?.next(state)
        const card = id ? state.hand.find(item => item.instanceId === id) : strategy === 'planner' ? undefined : balance.chooseCard(state, strategy)
        if (!card) break
        const definition = types.cardDefinition(card.definitionId)
        if (!rules.playCard(state, card.instanceId).ok) break
        plays += 1; stats.cards += 1
        if (definition.kind === 'defense') stats.defensePlays += 1
      }
      if (state.result) break
      const after = rules.forecastEnemyAction(state)
      const endLoss = sum(after.targets.map(item => item.healthLoss))
      if (startLoss > 0) { stats.threatTurns += 1; if (endLoss < startLoss) stats.mitigatedTurns += 1 }
      if (startLethal) stats.lethalThreatTurns += 1
      rules.endTurn(state)
    }
    for (const key of heroKeys) stats.lostTo[key] = startHealth[key] - state.heroes[key].health
    return { ...stats, result: state.result ?? 'timeout', lost: stats.lostTo.warrior + stats.lostTo.mage }
  }

  function simulate(runSeed, roster, policy, strategy, artifactMode) {
    let run = campaign.createDungeonRun(runSeed, economy.gameEconomy, types.startingDeck, roster)
    const out = { status: 'active', fights: [], rests: 0, artifactsTaken: 0, bossEntry: null }
    while (run.status === 'active') {
      const available = campaign.availableDungeonNodes(run)
      const view = routePolicy.chooseDungeonRouteNode(available.map(routePolicy.publicDungeonNodeView), run.heroes, policy)
      const node = available.find(item => item.id === view?.id)
      if (!node) break
      run = campaign.enterDungeonNode(run, node.id)
      if (node.type === 'rest') {
        const injured = [...heroKeys].sort((a, b) => run.heroes[a].health / run.heroes[a].maxHealth - run.heroes[b].health / run.heroes[b].maxHealth)[0]
        run = campaign.resolveDungeonRest(run, run.heroes[injured].health < run.heroes[injured].maxHealth ? injured : null)
        out.rests += 1
        continue
      }
      if (node.type === 'final') out.bossEntry = { warrior: run.heroes.warrior.health, mage: run.heroes.mage.health }
      const state = campaign.createCampaignBattle({
        encounter: campaign.dungeonEncounter(node, economy.gameEconomy, roster), heroes: run.heroes, deck: run.deck, artifacts: run.artifacts,
        seed: campaign.deriveDungeonSeed(runSeed, `battle:${node.id}`), battleId: `challenge/${roster.id}/${runSeed}/${policy}/${strategy}/${node.id}`, economy: economy.gameEconomy,
      })
      const fight = playBattle(state, strategy)
      out.fights.push({ type: node.type, layer: node.layer, encounter: node.encounterId, ...fight })
      run = campaign.resolveDungeonBattle(run, state)
      if (run.status === 'active' && run.pendingReward) {
        const before = run.artifacts.length
        run = claimReward(run, strategy, artifactMode)
        out.artifactsTaken += run.artifacts.length - before
      }
    }
    out.status = run.status
    out.finalHealth = { warrior: run.heroes.warrior.health, mage: run.heroes.mage.health }
    return out
  }

  const mean = (list, pick) => list.length ? sum(list.map(pick)) / list.length : 0
  const fmt = (value, digits = 2) => +value.toFixed(digits)
  function summarize(samples) {
    const fights = samples.flatMap(item => item.fights)
    const byType = type => fights.filter(item => item.type === type)
    const normal = byType('battle'), elite = byType('elite'), boss = byType('final')
    const threat = sum(fights.map(item => item.threatTurns))
    return {
      runs: samples.length,
      winRate: fmt(100 * samples.filter(item => item.status === 'victory').length / samples.length, 1),
      normalLoss: normal.filter(item => item.result !== 'victory').length, eliteLoss: elite.filter(item => item.result !== 'victory').length, bossLoss: boss.filter(item => item.result !== 'victory').length,
      normalTurns: fmt(mean(normal, item => item.turns)), eliteTurns: fmt(mean(elite, item => item.turns)),
      normalHpLost: fmt(mean(normal, item => item.lost), 1), eliteHpLost: fmt(mean(elite, item => item.lost), 1), bossHpLost: fmt(mean(boss, item => item.lost), 1),
      warriorLost: fmt(mean(fights, item => item.lostTo.warrior), 1), mageLost: fmt(mean(fights, item => item.lostTo.mage), 1),
      noLossFights: fmt(100 * fights.filter(item => item.lost === 0).length / Math.max(1, fights.length), 1),
      bossEntryHp: fmt(mean(samples.filter(item => item.bossEntry), item => item.bossEntry.warrior + item.bossEntry.mage), 1),
      finalHp: fmt(mean(samples, item => item.finalHealth.warrior + item.finalHealth.mage), 1),
      defensePerFight: fmt(mean(fights, item => item.defensePlays)),
      threatShare: fmt(100 * threat / Math.max(1, sum(fights.map(item => item.turns))), 1),
      mitigated: fmt(100 * sum(fights.map(item => item.mitigatedTurns)) / Math.max(1, threat), 1),
      lethalThreats: sum(fights.map(item => item.lethalThreatTurns)),
      rests: fmt(mean(samples, item => item.rests)), artifactsTaken: fmt(mean(samples, item => item.artifactsTaken)),
    }
  }

  const results = []
  for (const rosterId of rosterIds) {
    const roster = variants.rosterFromSpec(rosterId)
    for (const artifactMode of artifactModes) {
      for (const policy of policies) {
        for (const strategy of strategies) {
          const samples = Array.from({ length: runs }, (_, index) => simulate((seed + index) >>> 0, roster, policy, strategy, artifactMode))
          results.push({ roster: rosterId, artMode: artifactMode, policy, strategy, ...summarize(samples) })
        }
      }
    }
  }
  console.log(`COMBAT CHALLENGE LAB · ${runs} routes per row · seeds ${seed}–${(seed + runs - 1) >>> 0} · economy B · cards: ${cardPackage}`)
  console.table(results)

  const collapse = (keys) => {
    const groups = new Map()
    for (const row of results) {
      const key = keys.map(name => row[name]).join('|')
      groups.set(key, [...(groups.get(key) ?? []), row])
    }
    return [...groups.entries()].map(([key, rows]) => {
      const entry = Object.fromEntries(keys.map((name, index) => [name, key.split('|')[index]]))
      for (const metric of ['winRate', 'normalTurns', 'eliteTurns', 'normalHpLost', 'eliteHpLost', 'bossHpLost', 'noLossFights', 'bossEntryHp', 'finalHp', 'defensePerFight', 'threatShare', 'mitigated']) entry[metric] = fmt(mean(rows, row => row[metric]), 1)
      entry.losses = sum(rows.map(row => row.normalLoss + row.eliteLoss + row.bossLoss))
      return entry
    })
  }
  console.log('\nBy roster and artifact mode (mean of policies and strategies)')
  console.table(collapse(['roster', 'artMode']))
  console.log('\nBy roster and route policy')
  console.table(collapse(['roster', 'policy']))
  console.log('\nBy roster and strategy')
  console.table(collapse(['roster', 'strategy']))

  // Archetype lab: every encounter alone, shuffled-deck seeds, starting deck, no artifacts.
  const labRows = []
  for (const rosterId of skipArchetypes ? [] : rosterIds) {
    const roster = variants.rosterFromSpec(rosterId)
    for (const encounter of [...roster.normal, ...roster.elite]) {
      for (const strategy of strategies) {
        const samples = []
        for (let sample = 0; sample < archetypeRuns; sample += 1) {
          const state = campaign.createCampaignBattle({ encounter, seed: campaign.deriveDungeonSeed(seed + sample, encounter.id), battleId: `lab/${rosterId}/${encounter.id}/${strategy}/${sample}`, economy: economy.gameEconomy })
          samples.push(playBattle(state, strategy))
        }
        labRows.push({
          roster: rosterId, enemy: encounter.name, hp: encounter.maxHealth, strategy, win: fmt(100 * samples.filter(item => item.result === 'victory').length / samples.length, 0),
          turns: fmt(mean(samples, item => item.turns)), hpLost: fmt(mean(samples, item => item.lost), 1), warrior: fmt(mean(samples, item => item.lostTo.warrior), 1), mage: fmt(mean(samples, item => item.lostTo.mage), 1),
          defense: fmt(mean(samples, item => item.defensePlays)), noLoss: fmt(100 * samples.filter(item => item.lost === 0).length / samples.length, 0),
        })
      }
    }
  }
  console.log(`\nArchetype lab · ${archetypeRuns} shuffled-deck seeds per enemy and strategy (no artifacts, starting deck)`)
  console.table(labRows)
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ runs, seed, rosterIds, results, labRows }, null, 2))
} finally {
  await server.close()
}
