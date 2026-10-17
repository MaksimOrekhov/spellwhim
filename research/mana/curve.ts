/**
 * Per-turn "arc" of a battle: mean mana, plays, links and hand size by turn number for calibrated configurations.
 *   vite-node research/mana/curve.ts --encounter 2 --models A,B,C,U --tag std
 */
import { runCampaign } from './core'
import type { BotId } from './core'
import { leverConfig } from './calibrate'
import { loadCalibrations } from './suites.extra'

const argv = process.argv.slice(2)
const opt = (name: string, fallback: string) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1]! : fallback }
const encounter = Number(opt('encounter', '2'))
const models = opt('models', 'A,B,C').split(',')
const tags = opt('tag', 'std').split(',')
const bot = opt('bot', 'plan-even') as BotId
const seed = Number(opt('seed', '20000'))
const runs = Number(opt('runs', '300'))
const maxTurn = Number(opt('turns', '8'))

console.log(`Бой ${encounter + 1}, бот ${bot}, ${runs} seed (${seed}–${seed + runs - 1}). Ячейка: мана / потрачено · карт · связок · рука в начале`)
console.log('')
console.log('| конфиг | ' + Array.from({ length: maxTurn }, (_, i) => 'ход ' + (i + 1)).join(' | ') + ' |')
console.log('|---|' + Array.from({ length: maxTurn }, () => '---').join('|') + '|')
for (const model of models) {
  const calibration = tags.flatMap(tag => loadCalibrations(tag)).find(c => c.model === model)
  if (!calibration) { console.log(`| ${model} | нет калибровки |`); continue }
  const config = leverConfig(calibration.model, calibration.lever, calibration.hp, calibration.dmg, calibration.variant ?? 'base')
  const byTurn: { available: number; spent: number; plays: number; links: number; hand: number; n: number }[] = Array.from({ length: maxTurn }, () => ({ available: 0, spent: 0, plays: 0, links: 0, hand: 0, n: 0 }))
  for (let i = 0; i < runs; i += 1) {
    const record = runCampaign((seed + i) >>> 0, bot, config)
    const battle = record.battles[encounter]
    if (!battle) continue
    battle.turnLog.slice(0, maxTurn).forEach((t, index) => {
      const row = byTurn[index]!
      row.available += t.available; row.spent += t.spent; row.plays += t.plays; row.links += t.links; row.hand += t.handStart; row.n += 1
    })
  }
  console.log(`| ${model} | ` + byTurn.map(r => r.n < runs * 0.2 ? '—' : `${(r.available / r.n).toFixed(1)} / ${(r.spent / r.n).toFixed(1)} · ${(r.plays / r.n).toFixed(1)} · ${(r.links / r.n).toFixed(1)} · ${(r.hand / r.n).toFixed(1)}`).join(' | ') + ' |')
}
