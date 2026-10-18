// Fair Bot Information lab: the same complete Deadmines runs (same seeds) played with the historical bot policy that also reads the
// hidden size of a prepared strike ("omniscient") and with the fair policy ("public"). Diagnostic comparison, not a game rule.
// npm run information:lab -- --runs 250 --planner-runs 40 --seed 42 [--json docs/data/fair-bot-information-v01/comparison.json]
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const runs = Math.max(1, Math.floor(Number(option('--runs', 250))))
const plannerRuns = Math.max(0, Math.floor(Number(option('--planner-runs', 40))))
const baseSeed = Number(option('--seed', 42)) >>> 0
const jsonPath = option('--json', null)
const policies = ['safe', 'mixed', 'risky']
const infoModes = ['omniscient', 'public']

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const load = path => server.ssrLoadModule(path)
  const [campaign, routePolicy, balance, rules, plannerModule, types, economy, experiments] = await Promise.all([
    load('/src/game/campaign.ts'), load('/src/game/dungeonRoutePolicy.ts'), load('/src/game/balance.ts'), load('/src/game/battle.ts'),
    load('/src/game/balancePlanner.ts'), load('/src/game/types.ts'), load('/src/game/economy.ts'), load('/src/game/encounterExperiments.ts'),
  ])
  const roster = experiments.rosterFromSpec('E')
  const artifactRank = { 'reliable-wedge': 6, 'shift-whistle': 5, 'double-pulley': 5, 'weakpoint-lens': 4, 'tension-spool': 4 }
  const artifactOwner = { 'reliable-wedge': 'mage', 'shift-whistle': 'mage', 'double-pulley': 'warrior', 'weakpoint-lens': 'mage', 'tension-spool': 'warrior' }

  function addReward(run, strategy) {
    if (!run.pendingReward) return run
    if (run.pendingReward.elite && run.artifacts.length < 2) {
      const choice = [...campaign.dungeonArtifactOptions(run)].sort((a, b) => (artifactRank[b.id] ?? 0) - (artifactRank[a.id] ?? 0))[0]
      const taken = new Set(run.artifacts.map(item => item.ownerInstanceId))
      const owner = ['warrior', 'mage'].map(key => run.heroes[key]).find(hero => hero.id === artifactOwner[choice?.id] && !taken.has(hero.instanceId)) ?? ['warrior', 'mage'].map(key => run.heroes[key]).find(hero => !taken.has(hero.instanceId))
      if (choice && owner) return campaign.claimDungeonArtifact(run, choice.id, owner.instanceId)
    }
    const offers = campaign.dungeonRewardOptions(run)
    const rank = { thunderbolt: 8, frostbolt: 7, parry: 6, 'shield-bash': 6, bastion: strategy === 'defensive' ? 7 : 5, interpose: strategy === 'defensive' ? 7 : 4, 'ice-ward': strategy === 'defensive' ? 7 : 5, 'quick-cut': 5, 'arcane-insight': 4 }
    return campaign.claimDungeonReward(run, [...offers].sort((a, b) => (rank[b.id] ?? 0) - (rank[a.id] ?? 0))[0])
  }

  /** One battle; counts what the bot does on turns where the enemy prepares and on turns where a prepared strike is announced. */
  function playBattle(state, strategy, information) {
    const planner = strategy === 'planner' ? plannerModule.createTurnPlanner() : undefined
    const m = { turns: 0, prepareTurns: 0, prepareDefense: 0, prepareDefenseMana: 0, prepareCards: 0, revealedTurns: 0, revealedDefense: 0, revealedDefenseMana: 0, revealedCards: 0, revealedLethalTurns: 0, revealedLethalSaved: 0 }
    let previous = null
    let killedBy = null
    while (!state.result && m.turns < 24) {
      m.turns += 1
      const forecast = rules.forecastEnemyAction(state)
      const isPrepare = forecast.action.kind === 'prepare'
      const isRevealed = previous === 'prepare' && (forecast.action.kind === 'attack' || forecast.action.kind === 'attack_all')
      const lethalBefore = isRevealed && forecast.targets.some(hit => hit.lethal)
      if (isPrepare) m.prepareTurns += 1
      if (isRevealed) m.revealedTurns += 1
      if (lethalBefore) m.revealedLethalTurns += 1
      let plays = 0
      while (!state.result && plays < 12) {
        const instanceId = planner?.next(state)
        const card = instanceId ? state.hand.find(item => item.instanceId === instanceId) : strategy === 'planner' ? undefined : balance.chooseCard(state, strategy, information)
        if (!card) break
        const definition = types.cardDefinition(card.definitionId)
        if (!rules.playCard(state, card.instanceId).ok) break
        plays += 1
        const defense = definition.kind === 'defense'
        if (isPrepare) { m.prepareCards += 1; m.prepareDefense += Number(defense); m.prepareDefenseMana += defense ? definition.cost : 0 }
        if (isRevealed) { m.revealedCards += 1; m.revealedDefense += Number(defense); m.revealedDefenseMana += defense ? definition.cost : 0 }
      }
      if (lethalBefore && !state.result && rules.forecastEnemyAction(state).targets.every(hit => !hit.lethal)) m.revealedLethalSaved += 1
      previous = forecast.action.kind
      if (!state.result) {
        rules.endTurn(state)
        // The strike that ended the battle: one announced after a preparation (the player could answer it knowing the size), or not.
        if (state.result === 'defeat') killedBy = isRevealed ? 'revealed' : 'immediate'
      }
    }
    return { ...m, result: state.result ?? 'timeout', killedBy }
  }

  function simulate(seed, policy, strategy, information) {
    let run = campaign.createDungeonRun(seed, economy.gameEconomy, types.startingDeck, roster)
    const t = { status: 'active', battles: 0, rests: 0, turns: 0, warriorAfter: 0, mageAfter: 0, fights: 0, defeatRevealed: 0, defeatImmediate: 0, defeatOther: 0, prepareTurns: 0, prepareDefense: 0, prepareDefenseMana: 0, prepareCards: 0, revealedTurns: 0, revealedDefense: 0, revealedDefenseMana: 0, revealedCards: 0, revealedLethalTurns: 0, revealedLethalSaved: 0, bossWarrior: null, bossMage: null }
    while (run.status === 'active') {
      const available = campaign.availableDungeonNodes(run)
      const selected = routePolicy.chooseDungeonRouteNode(available.map(routePolicy.publicDungeonNodeView), run.heroes, policy)
      if (!selected) break
      const node = available.find(item => item.id === selected.id)
      run = campaign.enterDungeonNode(run, node.id)
      if (node.type === 'rest') {
        const injured = ['warrior', 'mage'].sort((a, b) => run.heroes[a].health / run.heroes[a].maxHealth - run.heroes[b].health / run.heroes[b].maxHealth)[0]
        run = campaign.resolveDungeonRest(run, run.heroes[injured].health < run.heroes[injured].maxHealth ? injured : null)
        t.rests += 1
        continue
      }
      const encounter = campaign.dungeonEncounter(node, economy.gameEconomy, roster)
      if (node.type === 'final') { t.bossWarrior = run.heroes.warrior.health; t.bossMage = run.heroes.mage.health }
      const state = campaign.createCampaignBattle({ encounter, heroes: run.heroes, deck: run.deck, artifacts: run.artifacts, seed: campaign.deriveDungeonSeed(seed, `battle:${node.id}`), battleId: `info/${seed}/${policy}/${strategy}/${node.id}`, economy: economy.gameEconomy })
      const outcome = playBattle(state, strategy, information)
      t.battles += 1; t.fights += 1; t.turns += outcome.turns
      for (const key of ['prepareTurns', 'prepareDefense', 'prepareDefenseMana', 'prepareCards', 'revealedTurns', 'revealedDefense', 'revealedDefenseMana', 'revealedCards', 'revealedLethalTurns', 'revealedLethalSaved']) t[key] += outcome[key]
      t.warriorAfter += state.heroes.warrior.health; t.mageAfter += state.heroes.mage.health
      if (outcome.result === 'defeat') {
        if (outcome.killedBy === 'revealed') t.defeatRevealed += 1
        else if (outcome.killedBy === 'immediate') t.defeatImmediate += 1
        else t.defeatOther += 1
      }
      run = campaign.resolveDungeonBattle(run, state)
      if (run.status === 'active' && run.pendingReward) run = addReward(run, strategy)
    }
    t.status = run.status
    return t
  }

  const rows = []
  const cases = [
    ...['aggressive', 'balanced', 'defensive'].map(strategy => ({ strategy, count: runs })),
    ...(plannerRuns ? [{ strategy: 'planner', count: plannerRuns }] : []),
  ]
  for (const { strategy, count } of cases) {
    for (const policy of policies) {
      for (const information of infoModes) {
        const samples = Array.from({ length: count }, (_, i) => simulate((baseSeed + i) >>> 0, policy, strategy, information))
        const sum = key => samples.reduce((total, item) => total + item[key], 0)
        const wins = samples.filter(item => item.status === 'victory').length
        const defeats = samples.length - wins
        const f = (value, digits = 2) => +value.toFixed(digits)
        rows.push({
          strategy, policy, information, runs: count, winRate: f(100 * wins / count, 1), defeats,
          avgWarriorAfterFight: f(sum('warriorAfter') / sum('fights'), 1), avgMageAfterFight: f(sum('mageAfter') / sum('fights'), 1),
          avgTurnsPerFight: f(sum('turns') / sum('fights')), avgRests: f(sum('rests') / count),
          prepareTurns: sum('prepareTurns'), prepareDefensePlaysPerTurn: f(sum('prepareDefense') / Math.max(1, sum('prepareTurns'))), prepareDefenseManaPerTurn: f(sum('prepareDefenseMana') / Math.max(1, sum('prepareTurns'))),
          revealedTurns: sum('revealedTurns'), revealedDefensePlaysPerTurn: f(sum('revealedDefense') / Math.max(1, sum('revealedTurns'))), revealedDefenseManaPerTurn: f(sum('revealedDefenseMana') / Math.max(1, sum('revealedTurns'))),
          revealedLethalTurns: sum('revealedLethalTurns'), revealedLethalSaved: sum('revealedLethalSaved'),
          deathsByRevealedStrike: sum('defeatRevealed'), deathsByImmediateAttack: sum('defeatImmediate'), deathsOther: sum('defeatOther'),
          avgBossWarrior: f(samples.filter(i => i.bossWarrior !== null).reduce((x, i) => x + i.bossWarrior, 0) / Math.max(1, samples.filter(i => i.bossWarrior !== null).length), 1),
          avgBossMage: f(samples.filter(i => i.bossMage !== null).reduce((x, i) => x + i.bossMage, 0) / Math.max(1, samples.filter(i => i.bossMage !== null).length), 1),
        })
      }
    }
    console.log(`done ${strategy}`)
  }
  console.log(`Information comparison · roster E (the game's) · economy B · seeds ${baseSeed}–${(baseSeed + runs - 1) >>> 0} (planner: first ${plannerRuns})`)
  console.table(rows.map(({ strategy, policy, information, runs: n, winRate, avgWarriorAfterFight, avgMageAfterFight, avgTurnsPerFight, avgRests, deathsByRevealedStrike, deathsByImmediateAttack }) => ({ strategy, policy, information, n, winRate, warriorHP: avgWarriorAfterFight, mageHP: avgMageAfterFight, turns: avgTurnsPerFight, rests: avgRests, diedRevealed: deathsByRevealedStrike, diedImmediate: deathsByImmediateAttack })))
  console.table(rows.map(({ strategy, policy, information, prepareDefensePlaysPerTurn, prepareDefenseManaPerTurn, revealedDefensePlaysPerTurn, revealedDefenseManaPerTurn, revealedLethalTurns, revealedLethalSaved }) => ({ strategy, policy, information, prepDefPlays: prepareDefensePlaysPerTurn, prepDefMana: prepareDefenseManaPerTurn, revealDefPlays: revealedDefensePlaysPerTurn, revealDefMana: revealedDefenseManaPerTurn, lethalRevealed: revealedLethalTurns, lethalSaved: revealedLethalSaved })))
  if (jsonPath) {
    mkdirSync(dirname(jsonPath), { recursive: true })
    writeFileSync(jsonPath, JSON.stringify({ schemaVersion: 1, note: 'omniscient = historical bot policy that reads the hidden size of a prepared strike; public = fair policy. Same seeds, same runs; the two policies are NOT directly comparable as game difficulty.', options: { runs, plannerRuns, seed: baseSeed, roster: 'E', economy: 'B' }, rows }, null, 2) + '\n')
    console.log('JSON saved: ' + jsonPath)
  }
} finally {
  await server.close()
}
