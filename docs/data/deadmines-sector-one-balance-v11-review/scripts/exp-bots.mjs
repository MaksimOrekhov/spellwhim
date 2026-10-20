// Isolated battles with full per-turn/phase telemetry for every policy, variant and condition.
// Usage: node exp-bots.mjs <variant> <N> <seedStart> [policies] [condition]
// condition: base (18 cards, 25/18) | hurt (18, 16/12) | d14 | d16
import { writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { withGame } from './harness.mjs'
import { MODULES, makeLab } from './lib.mjs'

const [variant = 'PA', nArg = '300', startArg = '42', policiesArg = 'aggressive,aggressive-fill,tempo,balanced,defensive', condition = 'base'] = process.argv.slice(2)
const N = Number(nArg), start = Number(startArg), policies = policiesArg.split(',')
const conditions = { base: {}, hurt: { health: [16, 12] }, d14: { deck: 14 }, d16: { deck: 16 } }
await withGame(MODULES, async m => {
  const lab = makeLab(m)
  lab.apply(variant)
  const rows = []
  for (const e of m.sectorContent.sectorEncounters) for (const policy of policies) {
    const n = policy === 'planner' ? Math.min(N, 100) : N
    for (let i = 0; i < n; i++) {
      const seed = start + i
      const { turnsLog, ...r } = lab.fight(lab.battle(e.id, seed, conditions[condition]), policy, { trace: true })
      rows.push({ variant, encounter: e.id, policy, condition, seed, ...r, perTurn: turnsLog.map(t => ({ turn: t.turn, mana: t.mana, intent: t.intent, phase: t.intentPhase, plays: t.plays.length, enemyBefore: t.enemy[0] + t.enemy[1] })) })
    }
  }
  mkdirSync(new URL('../results/raw/', import.meta.url), { recursive: true })
  const stem = `bots-${variant}-${condition}-${start}-${N}${policies.includes('planner') ? '-planner' : ''}`
  writeFileSync(new URL(`../results/raw/${stem}.jsonl.gz`, import.meta.url), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n', { mtime: 0 }))
  console.log('saved', stem, rows.length)
})
