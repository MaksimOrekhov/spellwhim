// Rak'Zor with real boss-entry states: the natural route (Codex's route/room/reward/rest policies, public
// information) is played up to the rest; then the SAME entry (HP, seed, map) is fought by several policies
// with (a) the developed deck/items and (b) the literal 18-card starter without items.
// Usage: CODEX_PKG=<path to docs/data/deadmines-sector-one-balance-v11> node exp-boss.mjs <variant> <N> <seedStart> [routeStrategy]
import { writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { withGame } from './harness.mjs'
import { MODULES, makeLab } from './lib.mjs'
import { makeOracle } from './oracle.mjs'

const pkg = resolve(process.env.CODEX_PKG ?? new URL('../../deadmines-sector-one-balance-v11', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const { simulation, modules } = await import(pathToFileURL(resolve(pkg, 'scripts/simulation.mjs')).href)
const [variant = 'PA', nArg = '200', startArg = '42', routeStrategy = 'balanced', policiesArg = 'aggressive,tempo,balanced,defensive,oracle3'] = process.argv.slice(2)
const N = Number(nArg), start = Number(startArg), policies = policiesArg.split(',')
await withGame([...new Set([...MODULES, ...modules])], async m => {
  const sim = simulation(m), lab = makeLab(m), o = makeOracle(lab)
  // Codex's sim knows V0/V1/V2/V3; review probes (Z*) are PA plus a boss change installed on top.
  sim.apply(['V0', 'V1', 'V3'].includes(variant) ? variant : 'V2')
  lab.apply(variant)
  const rows = []
  for (let i = 0; i < N; i++) {
    const seed = start + i
    const pre = sim.route(seed, { policy: 'mixed', strategy: routeStrategy, stopAfter: 4 })
    if (pre.result !== 'active' || pre.run.status !== 'active') { rows.push({ seed, variant, reached: false }); continue }
    const finalNode = m.campaign.availableDungeonNodes(pre.run).find(n => n.type === 'final')
    const entered = m.campaign.enterDungeonNode(pre.run, finalNode.id)
    const developed = entered
    const starter = { ...structuredClone(entered), deck: sim.newRun(seed).deck, artifacts: [], nextCardId: 19 }
    const info = { deck: entered.deck.length, upgrades: entered.deck.filter(c => c.upgrade).length, acquired: entered.deck.filter(c => Number(c.instanceId.match(/\/card\/(\d+)$/)?.[1]) > 18).length, artifacts: entered.artifacts.map(a => a.definitionId), hp: [entered.heroes.warrior.health, entered.heroes.mage.health] }
    for (const [deckKind, run] of [['developed', developed], ['starter', starter]]) for (const policy of policies) {
      const state = m.campaign.restoreDungeonBattle(run, m.economy.gameEconomy, 'review/boss')
      const pol = policy.startsWith('oracle') ? o.policy(Number(policy.slice(6))) : policy
      const { turnsLog, ...r } = lab.fight(state, pol, { trace: true })
      rows.push({ seed, variant, reached: true, routeStrategy, deckKind, policy, entry: info, ...r, perTurn: turnsLog.map(t => ({ turn: t.turn, intent: t.intent, phase: t.intentPhase, enemy: t.enemy, hp: t.hp, plays: t.plays })) })
    }
  }
  mkdirSync(new URL('../results/raw/', import.meta.url), { recursive: true })
  const stem = `boss-${variant}-${routeStrategy}-${start}-${N}`
  writeFileSync(new URL(`../results/raw/${stem}.jsonl.gz`, import.meta.url), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n', { mtime: 0 }))
  console.log('saved', stem, rows.length)
})
