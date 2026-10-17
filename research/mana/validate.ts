/**
 * Validation: with the control model A, unchanged enemies/cards and the three greedy bots, the research harness must
 * reproduce Balance Lab v0.6 (docs/combat-depth-v06.md): wins 195/200, 200/200, 200/200; mean turns 10.4 / 13.6 / 11.9.
 * Also checks that the harness is deterministic.
 *
 *   vite-node research/mana/validate.ts
 */
import { runCampaign } from './core'
import type { BotId } from './core'
import { cfg } from './suites'
import { simulateBalance, summarizeBalance } from '../../src/game/balance'

const config = cfg('A', 'A')
const bots: [BotId, 'aggressive' | 'defensive' | 'balanced'][] = [['greedy-aggressive', 'aggressive'], ['greedy-defensive', 'defensive'], ['greedy-balanced', 'balanced']]
const lab = summarizeBalance(simulateBalance({ runs: 200, seed: 42 }))
let ok = true
console.log('| бот | Balance Lab: победы, ходы | исследовательский симулятор: победы, ходы | совпадение |')
console.log('|---|---|---|---|')
for (const [bot, strategy] of bots) {
  const runs = Array.from({ length: 200 }, (_, i) => runCampaign(42 + i, bot, config))
  const wins = runs.filter(r => r.status === 'victory').length
  const turns = runs.reduce((sum, r) => sum + r.battles.reduce((s, b) => s + b.turns, 0), 0) / runs.length
  const reference = lab.find(row => row.strategy === strategy)!
  const same = wins === reference.victories && Math.abs(turns - reference.averageTurns) < 1e-9
  if (!same) ok = false
  console.log(`| ${bot} | ${reference.victories}/200, ${reference.averageTurns.toFixed(2)} | ${wins}/200, ${turns.toFixed(2)} | ${same ? 'да' : 'НЕТ'} |`)
}
const again = JSON.stringify(Array.from({ length: 20 }, (_, i) => runCampaign(7 + i, 'plan-even', cfg('B', 'B'))))
const twice = JSON.stringify(Array.from({ length: 20 }, (_, i) => runCampaign(7 + i, 'plan-even', cfg('B', 'B'))))
console.log(`\nДетерминизм планировщика (20 походов, дважды): ${again === twice ? 'да' : 'НЕТ'}`)
if (again !== twice) ok = false
process.exitCode = ok ? 0 : 1
