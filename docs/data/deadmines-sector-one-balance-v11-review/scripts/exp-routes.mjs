// Full Sector I runs with research policies plugged into Codex's unchanged route/room/reward/rest harness.
// Usage: CODEX_PKG=... node exp-routes.mjs <variant> <policy: tempo|oracleN|aggressive|balanced|defensive|aggressive-fill> <N> <seedStart> [routes=safe,mixed,risky]
import { writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { withGame } from './harness.mjs'
import { MODULES, makeLab } from './lib.mjs'
import { makeOracle } from './oracle.mjs'

const pkg = resolve(process.env.CODEX_PKG ?? new URL('../../deadmines-sector-one-balance-v11', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const { simulation, modules } = await import(pathToFileURL(resolve(pkg, 'scripts/simulation.mjs')).href)
const [variant = 'PA', policy = 'tempo', nArg = '300', startArg = '42', routesArg = 'safe,mixed,risky'] = process.argv.slice(2)
const N = Number(nArg), start = Number(startArg)
await withGame([...new Set([...MODULES, ...modules])], async real => {
  const lab = makeLab(real), oracle = makeOracle(lab)
  // Codex's fight() calls balance.chooseCard(state, strategy) or balancePlanner.createTurnPlanner(); route those to the research policy.
  let current = null
  const m = { ...real,
    balance: { ...real.balance, chooseCard: (s, strategy, info) => strategy === 'research' ? s.hand.find(x => x.instanceId === current.next(s)) : real.balance.chooseCard(s, strategy, info) },
    balancePlanner: { ...real.balancePlanner, createTurnPlanner: () => oracle.policy(Number(policy.slice(6))) },
  }
  const sim = simulation(m)
  sim.apply(variant === 'PA' ? 'V2' : variant)
  const strategy = policy.startsWith('oracle') ? 'planner' : policy === 'tempo' ? 'research' : policy
  const rows = []
  for (const route of routesArg.split(',')) for (let i = 0; i < N; i++) {
    current = policy === 'tempo' ? lab.policies.tempo() : null
    // tempo needs a fresh policy object per battle only for bookkeeping; it is stateless.
    const r = sim.route(start + i, { policy: route, strategy })
    const { run, preRest, finalDeck, journal, ...rest } = r
    rows.push({ variant, policy, route, ...rest, battles: r.battles.map(({ actions, trace, ...b }) => b) })
  }
  mkdirSync(new URL('../results/raw/', import.meta.url), { recursive: true })
  const stem = `routes-${variant}-${policy}-${start}-${N}`
  writeFileSync(new URL(`../results/raw/${stem}.jsonl.gz`, import.meta.url), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n', { mtime: 0 }))
  console.log('saved', stem, rows.length)
})
