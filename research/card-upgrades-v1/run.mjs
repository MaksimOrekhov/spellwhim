// Run: node research/card-upgrades-v1/run.mjs [--phase classic|planner|routes|all] [--smoke]
import { createServer } from 'vite'
import { createWriteStream, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createGzip } from 'node:zlib'
import { finished } from 'node:stream/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { setImmediate } from 'node:timers/promises'
import { configurations, ranges, samples, upgradePriority } from './config.mjs'
import { dungeonRewardRank } from '../../scripts/lib/dungeonRewardRank.mjs'

const phase = process.argv.includes('--phase') ? process.argv[process.argv.indexOf('--phase') + 1] : 'all'
if (!['classic', 'planner', 'routes', 'all'].includes(phase)) throw Error('Unknown phase')
const smoke = process.argv.includes('--smoke')
const out = smoke ? '/tmp/spellwhim-power-smoke' : 'docs/data/card-upgrades-v1'
mkdirSync(out, { recursive: true })
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
const avg = values => values.length ? values.reduce((s, x) => s + x, 0) / values.length : null
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] ?? null
const numeric = ['turns', 'lostW', 'lostM', 'available', 'spent', 'seenUpgrades', 'upgradedPlays', 'excessArmor', 'leftArmor', 'bleedNow', 'bleedTicks', 'bleedApplied', 'vulnerability', 'blocked', 'missingDefense', 'missingAttack', 'missingBleed', 'decisionTurns', 'openingPlayable', 'openingDefense', 'openingKinds', 'fiveManaTurns', 'plannerPlans', 'plannerTruncated', 'plannerNodes']
function entropy(values) { const counts = new Map(); for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1); return -[...counts.values()].reduce((sum, n) => sum + n / values.length * Math.log2(n / values.length), 0) }
function summarize(list) {
  const wins = list.filter(row => row.result === 'victory').length
  const n = list.length, p = wins / n, z = 1.96
  const center = (p + z * z / (2 * n)) / (1 + z * z / n), half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
  return { n, wins, winRate: p, win95: [center - half, center + half], timeouts: list.filter(row => row.result === 'timeout').length,
    ...Object.fromEntries(numeric.map(key => [key, avg(list.map(row => row[key] ?? 0))])),
    turnQuantiles: [0.1, 0.5, 0.9, 0.99].map(p => percentile(list.map(row => row.turns), p)),
    turnHistogram: Object.fromEntries([...new Set(list.map(row => row.turns))].sort((a, b) => a - b).map(turn => [turn, list.filter(row => row.turns === turn).length])),
    openingSequenceEntropy: entropy(list.map(row => row.openingSequence)), distinctOpeningSequences: new Set(list.map(row => row.openingSequence)).size,
  }
}
function rawWriter(name) {
  const stream = createWriteStream(`${out}/${name}.jsonl.gz`), zip = createGzip({ level: 9 })
  zip.pipe(stream)
  return { write: row => zip.write(JSON.stringify(row) + '\n'), close: async () => { zip.end(); await finished(stream) } }
}
try {
  const load = name => server.ssrLoadModule(`/src/game/${name}.ts`)
  const [t, b, ai, p, c, e, rosters, route, progress, statuses, saves] = await Promise.all(['types', 'battle', 'balance', 'balancePlanner', 'campaign', 'economy', 'encountersV10', 'dungeonRoutePolicy', 'cardProgression', 'statuses', 'runSave'].map(load))
  const roster = rosters.defaultDungeonRoster
  const enemies = [...roster.normal, ...roster.elite, roster.final]
  const configs = configurations(t.startingDeck)
  const hash = createHash('sha256')
  const sourceFiles = [...readdirSync('src/game').filter(name => name.endsWith('.ts') && !name.includes('.test.')).map(name => `src/game/${name}`), 'research/card-upgrades-v1/config.mjs', 'research/card-upgrades-v1/run.mjs', 'scripts/lib/dungeonRewardRank.mjs'].sort()
  for (const path of sourceFiles) hash.update(path + '\n').update(readFileSync(path))
  const metadata = { baseRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceSha256: hash.digest('hex'), sourceFiles, rules: saves.RULES_VERSION, catalogue: saves.CATALOG_VERSION,
    ranges, samples, economy: e.gameEconomy, roster: 'v10', information: 'public', maxTurns: 40, maxPlaysPerTurn: 24, plannerLimits: p.defaultPlannerLimits, plannerProfile: p.defaultPlannerProfile,
    isolated: 'Full HP, no artifacts; identical enemy/seed/hand size for paired configurations. Raw files retain every defeat and timeout.',
    routes: 'Real seven-node campaign; seeded ordinary offers, artifact-first elite rewards, unchanged rank, no removal service. Rest develop: upgrade only if both health ratios >=0.65, else heal the lowest ratio. Safe/mixed routes use public categories only.',
    note: 'Planner main A–F 60+60; start/archetype 16+16 screening; route planner 30+30 screening. Holdout never tunes profiles. Turns count each started player turn including winning turn. Available mana includes all those turns.', configs }
  writeFileSync(`${out}/manifest.json`, JSON.stringify(metadata, null, 2) + '\n')
  function fight(state, strategy) {
    const startW = state.heroes.warrior.health, startM = state.heroes.mage.health
    const planner = strategy === 'planner' ? p.createTurnPlanner() : null
    const stats = Object.fromEntries(numeric.map(key => [key, 0]))
    const seen = new Set(), first = [], cardPlays = {}
    const observe = () => { for (const card of state.hand) if (card.upgrade === 1) seen.add(card.instanceId) }
    observe()
    const opening = state.hand.filter(card => progress.resolveCardDefinition(card).cost <= state.mana)
    stats.openingPlayable = opening.length
    stats.openingKinds = new Set(opening.map(card => card.definitionId + (card.upgrade ? '+1' : ''))).size
    stats.openingDefense = opening.filter(card => Object.values(b.previewCard(state, progress.resolveCardDefinition(card)).armor).some(value => value > 0)).length
    while (!state.result && stats.turns < 40) {
      stats.turns++; stats.available += state.maxMana; stats.decisionTurns++
      stats.fiveManaTurns += Number(state.maxMana === 5)
      const options = state.hand.filter(card => progress.resolveCardDefinition(card).cost <= state.mana).map(card => ({ card, definition: progress.resolveCardDefinition(card), preview: b.previewCard(state, progress.resolveCardDefinition(card)) }))
      const known = b.forecastEnemyAction(state).targets
      stats.missingDefense += Number(known.some(hit => hit.healthLoss > 0) && !options.some(item => known.some(hit => item.preview.armor[hit.target] > 0)))
      stats.missingAttack += Number(!options.some(item => item.preview.damage > 0 || item.preview.statusDamage > 0))
      const bleed = statuses.statusValue(state, 'enemy', 'bleeding')
      stats.missingBleed += Number(bleed === 0 && options.some(item => item.definition.effects.some(effect => effect.type === 'status-tick' || effect.type === 'status-burst')) && !options.some(item => item.definition.effects.some(effect => effect.type === 'status' && effect.status === 'bleeding')))
      for (let guard = 0; guard < 24 && !state.result; guard++) {
        observe()
        const id = planner ? planner.next(state) : ai.chooseCard(state, strategy, 'public')?.instanceId
        if (!id) break
        const copy = state.hand.find(card => card.instanceId === id)
        const definition = progress.resolveCardDefinition(copy)
        const before = state.mana, previousBleed = statuses.statusValue(state, 'enemy', 'bleeding')
        const preview = b.previewCard(state, definition)
        const result = b.playCard(state, id)
        if (!result.ok) throw Error('Bot chose invalid play: ' + result.reason)
        stats.spent += before - state.mana
        stats.upgradedPlays += Number(copy.upgrade === 1)
        stats.vulnerability += Number(preview.vulnerabilityBonus > 0)
        stats.bleedNow += preview.statusDamage
        stats.bleedApplied += Math.max(0, statuses.statusValue(state, 'enemy', 'bleeding') - previousBleed)
        const key = copy.definitionId + (copy.upgrade ? '+1' : '')
        cardPlays[key] = (cardPlays[key] ?? 0) + 1
        if (stats.turns === 1) first.push(key)
        observe()
      }
      if (!state.result) {
        const forecast = b.forecastEnemyAction(state)
        // Armor is discarded only after an actual hit. Leftover armor at victory is counted separately.
        const excess = forecast.targets.reduce((sum, hit) => sum + Math.max(0, state.heroes[hit.target].armor - hit.attack), 0)
        const enemyHp = state.enemy.health
        b.endTurn(state)
        if (state.result !== 'victory') stats.excessArmor += excess
        stats.bleedTicks += enemyHp - state.enemy.health
        observe()
      }
    }
    if (planner) { stats.plannerPlans = planner.stats.plans; stats.plannerTruncated = planner.stats.truncated; stats.plannerNodes = planner.stats.nodes }
    stats.seenUpgrades = seen.size; stats.lostW = startW - state.heroes.warrior.health; stats.lostM = startM - state.heroes.mage.health
    stats.leftArmor = state.heroes.warrior.armor + state.heroes.mage.armor; stats.blocked = state.blockedDraws
    return { ...stats, result: state.result ?? 'timeout', openingSequence: first.join('>'), cardPlays }
  }
  for (const part of ['classic', 'planner']) {
    if (phase !== part && phase !== 'all') continue
    const raw = rawWriter(part), rows = []
    try {
      for (const range of ranges) for (const config of configs) for (const strategy of part === 'planner' ? ['planner'] : ['aggressive', 'balanced', 'defensive']) {
        const count = smoke ? 2 : strategy === 'planner' ? config.planner : samples.classic
        for (const enemy of enemies) {
          const list = []
          for (let i = 0; i < count; i++) {
            const seed = range.seed + i
            const sample = fight(b.createBattle(enemy, undefined, { seed, deck: config.deck, openingHandSize: config.hand, economy: e.gameEconomy }), strategy)
            list.push(sample); raw.write({ range: range.id, config: config.id, strategy, enemy: enemy.id, seed, ...sample })
          }
          rows.push({ range: range.id, config: config.id, family: config.family, strategy, enemy: enemy.id, ...summarize(list) })
        }
        writeFileSync(`${out}/${part}.json`, JSON.stringify({ rows }, null, 2) + '\n')
        console.log(part, range.id, config.id, strategy, count * enemies.length)
        await setImmediate()
      }
    } finally { await raw.close() }
  }
  if (phase === 'routes' || phase === 'all') {
    const raw = rawWriter('routes'), rows = []
    const artifactRank = { 'reliable-wedge': 6, 'double-pulley': 5, 'shift-whistle': 4, 'weakpoint-lens': 3, 'tension-spool': 2 }
    function reward(run, strategy) {
      const artifact = c.dungeonArtifactOptions(run).sort((a, b) => artifactRank[b.id] - artifactRank[a.id])[0]
      if (artifact && run.artifacts.length < 2) {
        const pref = artifact.id === 'double-pulley' ? 'warrior' : 'mage'
        const owner = [pref, pref === 'warrior' ? 'mage' : 'warrior'].map(id => run.heroes[id]).find(hero => !run.artifacts.some(item => item.ownerInstanceId === hero.instanceId))
        return c.claimDungeonArtifact(run, artifact.id, owner.instanceId)
      }
      const rank = id => ({ rend: 6.5, 'reaping-blow': 5.5, 'boil-blood': 4.5 }[id] ?? dungeonRewardRank(id, strategy === 'planner' ? 'balanced' : strategy))
      const choice = c.dungeonRewardOptions(run).sort((a, b) => rank(b.id) - rank(a.id))[0]
      return c.claimDungeonReward(run, choice)
    }
    for (const range of ranges) for (const strategy of ['balanced', 'defensive', 'planner']) for (const policy of strategy === 'planner' ? ['safe'] : ['safe', 'mixed']) for (const restPolicy of ['heal', 'develop']) {
      const list = [], count = smoke ? 2 : strategy === 'planner' ? samples.plannerRoutes : samples.routes
      for (let i = 0; i < count; i++) {
        const seed = range.seed + i
        let run = c.createDungeonRun(seed, e.gameEconomy, t.startingDeck, roster, `route/${seed}`)
        let upgrades = 0, fights = 0, upgradedPlays = 0, seenUpgrades = 0, turns = 0
        const checkpoints = []
        while (run.status === 'active') {
          const nodes = c.availableDungeonNodes(run)
          const view = route.chooseDungeonRouteNode(nodes.map(route.publicDungeonNodeView), run.heroes, policy)
          const node = nodes.find(node => node.id === view.id)
          run = c.enterDungeonNode(run, node.id)
          if (node.type === 'rest') {
            const target = [...run.deck].sort((a, b) => (upgradePriority.includes(a.definitionId) ? upgradePriority.indexOf(a.definitionId) : 99) - (upgradePriority.includes(b.definitionId) ? upgradePriority.indexOf(b.definitionId) : 99)).find(progress.canUpgradeCard)
            if (restPolicy === 'develop' && target && Object.values(run.heroes).every(hero => hero.health / hero.maxHealth >= 0.65)) {
              run = c.upgradeDungeonRest(run, target.instanceId, `${run.runId}/${node.id}`); upgrades++
            } else {
              const hero = Object.values(run.heroes).sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]
              run = c.resolveDungeonRest(run, hero.health < hero.maxHealth ? hero.id : null)
            }
            continue
          }
          const state = b.createBattle(c.dungeonEncounter(node, e.gameEconomy, roster), run.heroes, { deck: run.deck, artifacts: run.artifacts, seed: c.deriveDungeonSeed(seed, `battle:${node.id}`), economy: e.gameEconomy })
          const outcome = fight(state, strategy)
          if (outcome.result === 'timeout') throw Error('Route timeout')
          checkpoints.push({ node: node.id, outcome, deck: run.deck.map(card => ({ definitionId: card.definitionId, upgrade: card.upgrade })) })
          fights++; upgradedPlays += outcome.upgradedPlays; seenUpgrades += outcome.seenUpgrades; turns += outcome.turns
          run = c.resolveDungeonBattle(run, state)
          if (run.pendingReward) run = reward(run, strategy)
        }
        const sample = { result: run.status, turns, upgrades, fights, upgradedPlays, seenUpgrades, lostW: 25 - run.heroes.warrior.health, lostM: 18 - run.heroes.mage.health, openingSequence: checkpoints[0]?.outcome.openingSequence ?? '', finalDeck: run.deck.map(card => ({ definitionId: card.definitionId, upgrade: card.upgrade })) }
        list.push(sample); raw.write({ range: range.id, strategy, policy, restPolicy, seed, ...sample, checkpoints })
      }
      rows.push({ range: range.id, strategy, policy, restPolicy, ...summarize(list), upgrades: avg(list.map(row => row.upgrades)), fights: avg(list.map(row => row.fights)), twoUpgrades: list.filter(row => row.upgrades >= 2).length / count, fourUpgrades: list.filter(row => row.upgrades >= 4).length / count, finalSize: avg(list.map(row => row.finalDeck.length)) })
      writeFileSync(`${out}/routes.json`, JSON.stringify({ rows }, null, 2) + '\n')
      console.log('routes', range.id, strategy, policy, restPolicy, count)
      await setImmediate()
    }
    await raw.close()
  }
} finally { await server.close() }
