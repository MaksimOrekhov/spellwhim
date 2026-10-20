// Elite vs safe service from the SAME public fork (Codex's elitePrefix), with injured-entry conditions and the
// research policies. Reports HP and, separately, win-rate differences (HP of a defeated party is not a cost metric).
// Usage: CODEX_PKG=... node exp-elite.mjs <variant> <policy: balanced|defensive|aggressive|tempo|oracleN> <N> <seedStart>
import { writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { withGame } from './harness.mjs'
import { MODULES, makeLab } from './lib.mjs'
import { makeOracle } from './oracle.mjs'

const pkg = resolve(process.env.CODEX_PKG ?? new URL('../../deadmines-sector-one-balance-v11', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const { simulation, modules } = await import(pathToFileURL(resolve(pkg, 'scripts/simulation.mjs')).href)
const [variant = 'PA', policy = 'balanced', nArg = '300', startArg = '42'] = process.argv.slice(2)
const N = Number(nArg), start = Number(startArg)
// Entry conditions applied at the fork (cap, never heal): natural, ~60% and ~40% of max HP.
const conditions = { natural: null, hurt60: [15, 11], hurt40: [10, 7] }
await withGame([...new Set([...MODULES, ...modules])], async real => {
  const lab = makeLab(real), oracle = makeOracle(lab)
  let current = null
  const m = { ...real,
    balance: { ...real.balance, chooseCard: (s, strategy, info) => strategy === 'research' ? s.hand.find(x => x.instanceId === current.next(s)) : real.balance.chooseCard(s, strategy, info) },
    balancePlanner: { ...real.balancePlanner, createTurnPlanner: () => oracle.policy(Number(policy.slice(6))) },
  }
  const sim = simulation(m)
  sim.apply(['V0', 'V1', 'V3'].includes(variant) ? variant : 'V2')
  lab.apply(variant)
  const strategy = policy.startsWith('oracle') ? 'planner' : policy === 'tempo' ? 'research' : policy
  current = lab.policies.tempo()
  const rows = []
  for (let i = 0; i < N; i++) {
    const seed = start + i, opts = { policy: 'mixed', strategy, loadout: 'none' }
    const prefix = sim.elitePrefix(seed, opts)
    if (!prefix || prefix.dead) { rows.push({ seed, skipped: !prefix ? 'no-fork' : 'prefix-defeat' }); continue }
    for (const [cond, cap] of Object.entries(conditions)) {
      const run = structuredClone(prefix.run)
      if (cap) ['warrior', 'mage'].forEach((h, k) => { run.heroes[h].health = Math.min(run.heroes[h].health, cap[k]) })
      const entry = [run.heroes.warrior.health, run.heroes.mage.health]
      const branch = path => { const { run: _r, preRest, finalDeck, journal, ...r } = sim.route(seed, { ...opts, run, firstNode: prefix[path].id }); return { result: r.result, endW: r.endW, endM: r.endM, battles: r.battles.map(b => ({ encounter: b.encounter, type: b.type, lossW: b.lossW, lossM: b.lossM, turns: b.turns, result: b.result })), restChoices: r.restChoices } }
      rows.push({ seed, variant, policy, cond, entry, safeType: prefix.safe.type, elite: branch('elite'), safe: branch('safe') })
    }
  }
  mkdirSync(new URL('../results/raw/', import.meta.url), { recursive: true })
  const stem = `elite-${variant}-${policy}-${start}-${N}`
  writeFileSync(new URL(`../results/raw/${stem}.jsonl.gz`, import.meta.url), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n', { mtime: 0 }))
  console.log('saved', stem, rows.length)
})
