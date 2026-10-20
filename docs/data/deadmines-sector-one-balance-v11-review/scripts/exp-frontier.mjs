// Speed/safety frontier and decision diagnostics with the rollout oracle, per enemy and variant.
// Usage: node exp-frontier.mjs <variant> <lambdas comma> <N> <seedStart> [deck=18] [base=balanced]
import { writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { withGame } from './harness.mjs'
import { MODULES, makeLab } from './lib.mjs'
import { makeOracle, decisionMetrics } from './oracle.mjs'

const [variant = 'PA', lambdasArg = '1,3,8', nArg = '100', startArg = '42', deckArg = '18', base = 'balanced'] = process.argv.slice(2)
const lambdas = lambdasArg.split(',').map(Number), N = Number(nArg), start = Number(startArg), deck = Number(deckArg)
await withGame(MODULES, async m => {
  const lab = makeLab(m), o = makeOracle(lab)
  lab.apply(variant)
  const rows = []
  for (const e of m.sectorContent.sectorEncounters) for (const lambda of lambdas) for (let i = 0; i < N; i++) {
    const seed = start + i, decisions = []
    const pol = o.policy(lambda, { basePolicy: base, onDecision: (s, cands) => {
      const d = decisionMetrics(cands, lambda, o.J)
      decisions.push({ turn: s.turn, mana: s.mana, replan: decisions.some(x => x.turn === s.turn), intent: lab.describe(s.enemy.nextAction), intentKind: s.enemy.nextAction.kind, phase: s.enemy.nextActionPhase, ...d })
    } })
    const r = lab.fight(lab.battle(e.id, seed, { deck }), pol)
    const { turnsLog, ...rest } = r
    rows.push({ variant, encounter: e.id, lambda, seed, deck, base, ...rest, decisions })
  }
  mkdirSync(new URL('../results/raw/', import.meta.url), { recursive: true })
  const stem = `frontier-${variant}-L${lambdas.join('_')}-d${deck}-${base}-${start}-${N}`
  writeFileSync(new URL(`../results/raw/${stem}.jsonl.gz`, import.meta.url), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n', { mtime: 0 }))
  console.log('saved', stem, rows.length)
})
