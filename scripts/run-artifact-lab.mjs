import { createServer } from 'vite'

const args = process.argv.slice(2)
const positional = args.filter((value, index) => !value.startsWith('--') && !args[index - 1]?.startsWith('--'))
const numberArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index < 0 ? fallback : Number(args[index + 1])
}
const runs = Math.max(1, Math.floor(numberArg('--runs', Number(positional[0]) || 5)))
const seed = numberArg('--seed', Number(positional[1]) || 42) >>> 0
const strategies = args.includes('--strategy') ? args[args.indexOf('--strategy') + 1].split(',') : positional[2] ? positional[2].split(',') : ['balanced', 'defensive', 'planner']
const allowedStrategies = new Set(['balanced', 'defensive', 'planner'])
if (strategies.some(strategy => !allowedStrategies.has(strategy))) throw new Error('--strategy принимает balanced, defensive, planner или список через запятую')

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const [campaign, routes, balance, battle, plannerModule, economy, types, artifacts] = await Promise.all([
    server.ssrLoadModule('/src/game/campaign.ts'), server.ssrLoadModule('/src/game/dungeonRoutePolicy.ts'),
    server.ssrLoadModule('/src/game/balance.ts'), server.ssrLoadModule('/src/game/battle.ts'),
    server.ssrLoadModule('/src/game/balancePlanner.ts'), server.ssrLoadModule('/src/game/economy.ts'),
    server.ssrLoadModule('/src/game/types.ts'), server.ssrLoadModule('/src/game/artifacts.ts'),
  ])
  const item = (definitionId, owner) => ({ definitionId, owner })
  const loadouts = [
    { id: 'без предметов', items: [] },
    { id: 'расклин · первый герой', items: [item('reliable-wedge', 'warrior')] },
    { id: 'расклин · второй герой', items: [item('reliable-wedge', 'mage')] },
    { id: 'полиспаст + линза', items: [item('double-pulley', 'warrior'), item('weakpoint-lens', 'mage')] },
    { id: 'свисток + шкив', items: [item('shift-whistle', 'warrior'), item('tension-spool', 'mage')] },
  ]
  const rankings = { thunderbolt: 8, frostbolt: 7, parry: 6, 'shield-bash': 6, bastion: 6, interpose: 5, 'ice-ward': 5, 'quick-cut': 5, 'arcane-insight': 4 }

  function claimCard(run) {
    const offers = campaign.dungeonRewardOptions(run)
    const chosen = [...offers].sort((a, b) => (rankings[b.id] ?? 0) - (rankings[a.id] ?? 0))[0]
    return chosen ? campaign.claimDungeonReward(run, chosen) : run
  }

  function battleLoop(state, strategy, metrics) {
    const planner = strategy === 'planner' ? plannerModule.createTurnPlanner() : null
    let turns = 0
    let cardPlays = 0
    let defensivePlays = 0
    while (!state.result && turns < 60) {
      turns += 1
      let plays = 0
      while (!state.result && plays < 12) {
        const plannedId = planner?.next(state)
        const card = plannedId ? state.hand.find(value => value.instanceId === plannedId) : strategy === 'planner' ? undefined : balance.chooseCard(state, strategy)
        if (!card) break
        const definition = types.cardDefinition(card.definitionId)
        const preview = battle.previewCard(state, definition)
        const result = battle.playCard(state, card.instanceId)
        if (!result.ok) break
        cardPlays += 1
        plays += 1
        defensivePlays += Number(definition.kind === 'defense')
        metrics.artifactDamage += preview.artifactDamage
        if (definition.kind === 'defense') metrics.armorFromCards += preview.armor.warrior + preview.armor.mage
        recordNotices(state, metrics)
      }
      if (state.result) break
      const forecast = battle.forecastEnemyAction(state)
      for (const hit of forecast.targets) {
        metrics.healthDamage += hit.healthLoss
        metrics.armorPrevented += hit.absorbed
        metrics.wedgeReduction += hit.artifactReduction
      }
      battle.endTurn(state)
      recordNotices(state, metrics)
    }
    return { turns, cardPlays, defensivePlays, result: state.result ?? 'timeout' }
  }

  function recordNotices(state, metrics) {
    for (const notice of state.artifactNotices) {
      const name = notice.split(':')[0]
      metrics.triggers[name] = (metrics.triggers[name] ?? 0) + 1
    }
  }

  function simulate(runSeed, strategy, loadout) {
    let run = campaign.createDungeonRun(runSeed, economy.gameEconomy)
    run.artifacts = loadout.items.map((configured, index) => ({
      instanceId: `diagnostic/${runSeed}/${loadout.id}/${index}`,
      definitionId: configured.definitionId,
      ownerInstanceId: run.heroes[configured.owner].instanceId,
    }))
    const metrics = { healthDamage: 0, armorPrevented: 0, wedgeReduction: 0, artifactDamage: 0, armorFromCards: 0, triggers: {}, noTriggerBattles: {} }
    let turns = 0, cardPlays = 0, defensivePlays = 0, battles = 0
    while (run.status === 'active') {
      const available = campaign.availableDungeonNodes(run)
      const selectedView = routes.chooseDungeonRouteNode(available.map(routes.publicDungeonNodeView), run.heroes, 'mixed')
      const node = available.find(candidate => candidate.id === selectedView?.id)
      if (!node) break
      run = campaign.enterDungeonNode(run, node.id)
      if (node.type === 'rest') {
        const injured = ['warrior', 'mage'].sort((a, b) => run.heroes[a].health / run.heroes[a].maxHealth - run.heroes[b].health / run.heroes[b].maxHealth)[0]
        run = campaign.resolveDungeonRest(run, run.heroes[injured].health < run.heroes[injured].maxHealth ? injured : null)
        continue
      }
      const state = campaign.createCampaignBattle({
        encounter: campaign.dungeonEncounter(node), heroes: run.heroes, deck: run.deck,
        artifacts: run.artifacts, seed: campaign.deriveDungeonSeed(runSeed, `battle:${node.id}`),
        battleId: `artifact-lab/${runSeed}/${strategy}/${loadout.id}/${node.id}`, economy: economy.gameEconomy,
      })
      const result = battleLoop(state, strategy, metrics)
      for (const runtime of state.artifacts) {
        const definition = artifacts.artifactDefinitions.find(value => value.id === runtime.definitionId)
        const activated = runtime.usedThisBattle || runtime.lastTriggeredTurn !== null
        if (!activated) metrics.noTriggerBattles[definition.name] = (metrics.noTriggerBattles[definition.name] ?? 0) + 1
      }
      turns += result.turns; cardPlays += result.cardPlays; defensivePlays += result.defensivePlays; battles += 1
      run = campaign.resolveDungeonBattle(run, state)
      if (run.status === 'active' && run.pendingReward) run = claimCard(run)
    }
    for (const configured of loadout.items) metrics.triggers[artifacts.artifactDefinitions.find(value => value.id === configured.definitionId).name] ??= 0
    return {
      seed: runSeed, strategy, loadout: loadout.id, status: run.status, battles, turns, cardPlays, defensivePlays,
      finalHealth: { warrior: run.heroes.warrior.health, mage: run.heroes.mage.health },
      ...metrics,
    }
  }

  const rows = []
  for (const strategy of strategies) {
    for (const loadout of loadouts) {
      const samples = Array.from({ length: runs }, (_, index) => simulate((seed + index) >>> 0, strategy, loadout))
      const mean = selector => samples.reduce((sum, sample) => sum + selector(sample), 0) / samples.length
      const names = [...new Set(samples.flatMap(sample => Object.keys(sample.triggers)))]
      rows.push({
        strategy, loadout: loadout.id, runs: samples.length,
        wins: samples.filter(sample => sample.status === 'victory').length,
        averageBattles: +mean(sample => sample.battles).toFixed(2), averageTurns: +mean(sample => sample.turns).toFixed(2),
        averageCards: +mean(sample => sample.cardPlays).toFixed(2), defensivePlays: +mean(sample => sample.defensivePlays).toFixed(2),
        warriorHP: +mean(sample => sample.finalHealth.warrior).toFixed(1), mageHP: +mean(sample => sample.finalHealth.mage).toFixed(1),
        hpLost: +mean(sample => sample.healthDamage).toFixed(1), armorAbsorbed: +mean(sample => sample.armorPrevented).toFixed(1),
        wedgeDamageReduced: +mean(sample => sample.wedgeReduction).toFixed(1), artifactDamage: +mean(sample => sample.artifactDamage).toFixed(1),
        triggers: Object.fromEntries(names.map(name => [name, samples.reduce((sum, sample) => sum + sample.triggers[name], 0)])),
        noTriggerBattles: Object.fromEntries(names.map(name => [name, samples.reduce((sum, sample) => sum + (sample.noTriggerBattles[name] ?? 0), 0)])),
      })
    }
  }
  console.log(`ARTIFACT FOUNDATION LAB · ${runs} complete routes per loadout/strategy · seeds ${seed}–${(seed + runs - 1) >>> 0} · mixed route · economy B`)
  console.log('Artifacts are diagnostically equipped before layer 1. This is a matched-engine comparison, not a normal reward-choice or human-preference model.')
  console.table(rows.map(({ triggers, noTriggerBattles, ...row }) => row))
  console.log('\nArtifact trigger totals and battles with zero activations (by loadout/strategy):')
  for (const row of rows) console.log(JSON.stringify({ strategy: row.strategy, loadout: row.loadout, triggers: row.triggers, noTriggerBattles: row.noTriggerBattles }))
} finally {
  await server.close()
}
