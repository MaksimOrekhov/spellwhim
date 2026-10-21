// Interpolates every variant of an experiment to the damage scale at which the balanced bot wins `target` of S4 chains,
// so mechanics are compared at EQUAL difficulty instead of at equal numbers.   node interp.mjs mech2 0.7
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../results')
const [exp = 'mech2', targetArg = '0.7'] = process.argv.slice(2)
const target = Number(targetArg)
const j = JSON.parse(readFileSync(resolve(dir, exp + '.json'), 'utf8'))
const lerp = (a, b, t) => a + (b - a) * t
const pc = x => (100 * x).toFixed(0)
const rows = []
for (const v of [...new Set(j.table.map(r => r.rules))]) {
  const at = p => j.table.filter(r => r.rules === v && r.policy === p).sort((a, b) => (a.scale.dmg ?? 1) - (b.scale.dmg ?? 1))
  const bal = at('balanced')
  // find bracket where win crosses the target (win decreases with scale)
  let i = bal.findIndex((r, k) => k > 0 && bal[k - 1].win >= target && r.win <= target)
  if (i < 0) { rows.push(`| ${v} | вне диапазона (win ${bal.map(r => pc(r.win)).join('/')}) |`); continue }
  const a = bal[i - 1], b = bal[i], t = (a.win - target) / Math.max(1e-9, a.win - b.win)
  const sc = lerp(a.scale.dmg ?? 1, b.scale.dmg ?? 1, t)
  const m = (p, f) => { const r = at(p); return lerp(f(r[i - 1]), f(r[i]), t) }
  const hp = r => r.hpLost / (r.heroHp[0] + r.heroHp[1])
  rows.push(`| ${v} | ×${sc.toFixed(2)} | ${pc(m('tempo', r => r.win))}·${pc(m('tempo', hp))} / ${pc(m('balanced', r => r.win))}·${pc(m('balanced', hp))} / ${pc(m('careful', r => r.win))}·${pc(m('careful', hp))} | ${pc(m('balanced', r => r.tension.pctFree))} | ${pc(m('balanced', r => r.tension.pctUnsafe))} | ${pc(m('balanced', r => r.tension.pctContested))} | ${pc(m('balanced', r => r.tension.pctDiverge))} | ${m('balanced', r => r.tension.meanTrade).toFixed(1)} | ${m('balanced', r => r.turns).toFixed(1)} |`)
}
console.log(`Равная сложность: balanced выигрывает ${pc(target)} % цепочек S4. Масштаб урона найден линейной интерполяцией между ячейками.\n`)
console.log('| вариант | масштаб урона | tempo / balanced / careful: победы % · потеря HP % | своб. защита % | нет безопасной линии % | спорных % | расхождение ботов % | цена безопасности | ходов |')
console.log('|---|---:|---|---:|---:|---:|---:|---:|---:|')
console.log(rows.join('\n'))
