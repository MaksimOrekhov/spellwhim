import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { withGame } from '../../deadmines-sector-one-v1-review/scripts/harness.mjs'
import { simulation, modules, summarize, mean, won } from './simulation.mjs'
import { splits, definitions, classic, loadouts } from './config.mjs'

const args = process.argv.slice(2)
const arg = (key, fallback) => args.includes('--' + key) ? args[args.indexOf('--' + key) + 1] : fallback
const split = arg('split', 'main'), phase = arg('phase', 'classic'), variants = arg('variants', 'V0,V1,V2').split(',')
if (!splits[split]) throw Error('Unknown split')
const spec = splits[split], n = Number(arg('runs', phase === 'planner' ? spec.planner : spec.n))
if (!Number.isSafeInteger(n) || n < 1) throw Error('Run count must be a positive integer')
const output = new URL('../results/', import.meta.url)
await mkdir(output, { recursive: true })
const stem = `${split}-${phase}-${variants.join('-')}-${n}`
const summaries = [], rows = []
await withGame(modules, async m => {
  const sim = simulation(m)
  const manifest = { baseCommit: '1afabb357dc8b541bfe7bb04b1d4ae6d2b5c0c0f', harnessCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), split, phase, n, seedStart: spec.start, seedEnd: spec.start + n - 1, information: 'public', variants: Object.fromEntries(variants.map(v => [v, definitions(v)])), decks: sim.decks, economy: m.economy.gameEconomy, loadouts, planner: { profile: m.balancePlanner.defaultPlannerProfile, limits: m.balancePlanner.defaultPlannerLimits }, limits: { turns: 30, playsPerTurn: 40 }, route: 'chooseDungeonRouteNode(public available categories/edges, current HP); no future encounter/event/offer access', roomPolicy: 'same as Claude, corrected roomReplacementOptions; first legal eligible copy/seeded offer', reward: 'first offered card; elite first artifact to free slot; ordinary skipped at deck>=21', rest: 'lowest health fraction <.65 => heal 6; otherwise upgrade first eligible copy', diagnosticPolicy: 'aggressive-fill = original aggressive; only when it stops, original balanced fills leftover mana', missingPreBoss: 'zero for non-arrivals, separately record reachedBoss; final HP always includes defeats', immutableHoldout: 'V2 decision locked in selection.json before holdout; no parameter tuning on holdout' }
  await writeFile(new URL(stem + '-manifest.json', output), JSON.stringify(manifest, null, 2) + '\n')
  function record(meta, group) {
    rows.push(...group.map(r => ({ ...meta, ...r })))
    const summary = { ...meta, ...summarize(group) }
    if (group[0]?.battles) {
      summary.reachedBoss = group.filter(r => r.reachedBoss).length
      summary.healPct = 100 * mean(group, r => Number(r.restChoices.includes('heal')))
      summary.upgradeRestPct = 100 * mean(group, r => Number(r.restChoices.includes('upgrade')))
      summary.deaths = Object.fromEntries([...new Set(group.map(r => r.deadAt).filter(Boolean))].map(id => [id, group.filter(r => r.deadAt === id).length]))
      const allFights = group.flatMap(r => r.battles)
      summary.battleMetrics = summarize(allFights)
      summary.byEnemy = Object.fromEntries([...new Set(allFights.map(b => b.encounter))].map(id => [id, summarize(allFights.filter(b => b.encounter === id))]))
      summary.elites = mean(group, r => r.battles.filter(b => b.type === 'elite').length)
      summary.bossAmongArrivals = summarize(group.filter(r => r.reachedBoss))
      summary.hpByLayer = Array.from({ length: 6 }, (_, layer) => ({ layer, n: group.filter(r => r.checkpoints.some(c => c.layer === layer)).length, warriorAll: mean(group, r => r.checkpoints.find(c => c.layer === layer)?.hp[0] ?? 0), mageAll: mean(group, r => r.checkpoints.find(c => c.layer === layer)?.hp[1] ?? 0) }))
    }
    summaries.push(summary)
    console.log(JSON.stringify({ ...meta, n: group.length, winPct: summary.winPct, hp: [summary.endW, summary.endM], turns: summary.turns }))
  }
  const compact = row => { const { run, preRest, ...rest } = row; return rest }
  for (const variant of variants) {
    sim.apply(variant)
    if (phase === 'classic' || phase === 'planner' || phase === 'diagnostic') {
      const strategies = phase === 'planner' ? ['planner'] : phase === 'diagnostic' ? ['aggressive', 'aggressive-fill'] : classic
      for (const encounter of m.sectorContent.sectorEncounters) for (const strategy of strategies) {
        const group = []
        for (let i = 0; i < n; i++) { const seed = spec.start + i; group.push({ seed, ...sim.fight(sim.battle(encounter, seed), strategy, phase === 'diagnostic' && i < 3) }) }
        record({ kind: 'battle', variant, encounter: encounter.id, strategy, deck: 18, health: '25/18', loadout: 'none' }, group)
      }
      if (phase !== 'diagnostic') for (const policy of ['safe', 'mixed', 'risky']) for (const strategy of strategies) {
        const group = []
        for (let i = 0; i < n; i++) group.push(compact(sim.route(spec.start + i, { policy, strategy })))
        record({ kind: 'route', variant, policy, strategy }, group)
      }
    } else if (phase === 'routes-extra') {
      const conditions = [{ deck: 18, noArtifacts: true }, { deck: 16, noArtifacts: false }, { deck: 14, noArtifacts: false }]
      for (const condition of conditions) for (const policy of ['safe', 'mixed', 'risky']) for (const strategy of classic) {
        const group = []
        for (let i = 0; i < n; i++) group.push(compact(sim.route(spec.start + i, { ...condition, policy, strategy })))
        record({ kind: 'route-extra', variant, policy, strategy, ...condition }, group)
      }
    } else if (phase === 'sensitivity') {
      const conditions = [
        { deck: 18, health: [16, 12], loadout: 'none' }, { deck: 18, health: [8, 6], loadout: 'none' },
        { deck: 16, health: [25, 18], loadout: 'none' }, { deck: 14, health: [25, 18], loadout: 'none' },
        { deck: 18, health: [16, 12], loadout: 'wedgeWhistle' }, { deck: 18, health: [16, 12], loadout: 'pulleySpool' },
      ]
      for (const condition of conditions) for (const encounter of m.sectorContent.sectorEncounters) for (const strategy of classic) {
        const group = []
        for (let i = 0; i < n; i++) { const seed = spec.start + i; group.push({ seed, ...sim.fight(sim.battle(encounter, seed, condition.deck, condition.health, condition.loadout), strategy) }) }
        record({ kind: 'sensitivity', variant, encounter: encounter.id, strategy, ...condition, health: condition.health.join('/') }, group)
      }
    } else if (phase === 'rest') {
      for (const policy of ['safe', 'mixed', 'risky']) for (const strategy of classic) {
        const group = []
        for (let i = 0; i < n; i++) {
          const seed = spec.start + i, natural = sim.route(seed, { policy, strategy })
          const pair = { seed, natural: compact(natural), reachedRest: !!natural.preRest, branches: {} }
          if (natural.preRest) for (const rest of ['heal', 'upgrade', 'skip']) pair.branches[rest] = compact(sim.route(seed, { policy, strategy, run: natural.preRest, rest }))
          group.push(pair)
        }
        rows.push(...group.map(r => ({ kind: 'rest', variant, policy, strategy, ...r })))
        summaries.push({ kind: 'rest', variant, policy, strategy, n, reached: group.filter(r => r.reachedRest).length, branches: Object.fromEntries(['heal', 'upgrade', 'skip'].map(branch => [branch, { ...summarize(group.map(r => r.branches[branch] ?? r.natural)), helpsVsSkip: group.filter(r => r.branches[branch] && won(r.branches[branch]) && !won(r.branches.skip)).length, hurtsVsSkip: group.filter(r => r.branches[branch] && !won(r.branches[branch]) && won(r.branches.skip)).length }])) })
        console.log('rest', variant, policy, strategy)
      }
    } else if (phase === 'elite' || phase === 'elite-noart') {
      for (const strategy of [...classic]) for (const loadout of phase === 'elite-noart' ? ['none'] : ['none', 'wedgeWhistle', 'pulleySpool']) {
        const group = []
        let missingFork = 0, prefixDefeats = 0
        for (let i = 0; i < n; i++) {
          const seed = spec.start + i, opts = { policy: 'mixed', strategy, loadout, noArtifacts: phase === 'elite-noart' }, prefix = sim.elitePrefix(seed, opts)
          if (!prefix) { missingFork++; continue }
          if (prefix.dead) { prefixDefeats++; group.push({ seed, prefixDefeat: true, prefix: prefix.history }); continue }
          const entry = { health: ['warrior', 'mage'].map(h => prefix.run.heroes[h].health), deck: prefix.run.deck, artifacts: prefix.run.artifacts, visited: prefix.run.visitedNodeIds }
          const branches = {}
          for (const rewards of ['normal', 'neutral']) for (const path of ['elite', 'safe']) branches[rewards + '-' + path] = compact(sim.route(seed, { ...opts, run: prefix.run, firstNode: prefix[path].id, skipReward: rewards === 'neutral', leaveService: rewards === 'neutral' }))
          group.push({ seed, entry, branches })
        }
        rows.push(...group.map(r => ({ kind: 'elite', variant, strategy, loadout, ...r })))
        const pairs = group.filter(r => !r.prefixDefeat)
        summaries.push({ kind: 'elite', variant, strategy, loadout, eligible: group.length, missingFork, prefixDefeats, pairs: pairs.length, directLoss: mean(pairs, r => { const b = r.branches['normal-elite'].battles[0]; return b.lossW + b.lossM }), routeCostNormal: mean(pairs, r => r.branches['normal-safe'].endW + r.branches['normal-safe'].endM - r.branches['normal-elite'].endW - r.branches['normal-elite'].endM), routeCostNeutral: mean(pairs, r => r.branches['neutral-safe'].endW + r.branches['neutral-safe'].endM - r.branches['neutral-elite'].endW - r.branches['neutral-elite'].endM), eliteRewardValue: mean(pairs, r => r.branches['normal-elite'].endW + r.branches['normal-elite'].endM - r.branches['neutral-elite'].endW - r.branches['neutral-elite'].endM), branches: Object.fromEntries(['normal-elite', 'normal-safe', 'neutral-elite', 'neutral-safe'].map(k => [k, summarize(pairs.map(r => r.branches[k]))])) })
        console.log('elite', variant, strategy, loadout, pairs.length)
      }
    } else if (phase === 'development') {
      for (const strategy of classic) {
        const group = []
        for (let i = 0; i < n; i++) {
          const seed = spec.start + i, natural = sim.route(seed, { policy: 'mixed', strategy })
          const pair = { seed, natural: compact(natural), developed: null, replay: null }
          // Identical recorded boss-entry state/seed; remove only acquired cards, upgrades and items.
          // This is a package diagnostic, not a claim about any one acquisition.
          if (natural.preRest) {
            pair.developed = compact(sim.route(seed, { policy: 'mixed', strategy, run: natural.preRest, rest: 'skip' }))
            let r = structuredClone(natural.preRest)
            r.deck = sim.newRun(seed).deck; r.nextCardId = 19; r.artifacts = []
            pair.replay = compact(sim.route(seed, { policy: 'mixed', strategy, run: r, rest: 'skip' }))
          }
          group.push(pair)
        }
        rows.push(...group.map(r => ({ kind: 'development', variant, strategy, ...r })))
        summaries.push({ kind: 'development', variant, strategy, natural: summarize(group.map(r => r.natural)), developed: summarize(group.map(r => r.developed ?? r.natural)), noDevelopment: summarize(group.map(r => r.replay ?? r.natural)) })
        console.log('development', variant, strategy)
      }
    } else throw Error('Unknown phase')
  }
})
await writeFile(new URL(stem + '.jsonl.gz', output), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n', { mtime: 0 }))
await writeFile(new URL(stem + '.json', output), JSON.stringify(summaries, null, 2) + '\n')
console.log('saved', stem, rows.length)
