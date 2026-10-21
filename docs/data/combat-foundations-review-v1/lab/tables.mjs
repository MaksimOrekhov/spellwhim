// Builds results/tables.md (the compact tables quoted in the report) from the experiment JSON files.
//   node docs/data/combat-foundations-review-v1/lab/tables.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../results')
const load = n => (existsSync(resolve(dir, n + '.json')) ? JSON.parse(readFileSync(resolve(dir, n + '.json'), 'utf8')) : null)
const pc = x => (100 * x).toFixed(0)
const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : '–')
const out = []
const rowsOf = (exp, f) => (load(exp)?.table ?? []).filter(f)
const triple = (rows, extra) => ['tempo', 'balanced', 'careful'].map(p => rows.find(r => r.policy === p)).map(r => (r ? `${pc(r.win)}% · ${pc(r.hpLost / (r.heroHp[0] + r.heroHp[1]))}%` : '–')).join(' / ') + (extra ? ' ' + extra : '')

// ---- factors: balanced / careful, win · HP lost
const fac = load('factors')
if (fac) {
  out.push('## Факторы: рука × мана × срок жизни брони (сцена S4, сброс руки)\n', 'Ячейка: победы % · потеря HP % от 43; боты tempo / balanced / careful.\n', '| карт | мана | броня сгорает | броня сохраняется |', '|---:|---|---|---|')
  for (const hand of [5, 6, 7, 8]) for (const mn of ['3', '4', '34', '345']) {
    const c = rowsOf('factors', r => r.rules === `F${hand}M${mn}c`), p = rowsOf('factors', r => r.rules === `F${hand}M${mn}p`)
    const t = rs => ['balanced', 'careful'].map(pol => { const r = rs.find(x => x.policy === pol); return r ? `${pc(r.win)}·${pc(r.hpLost / 43)}` : '–' }).join(' / ')
    out.push(`| ${hand} | ${mn.split('').join('→')} | ${t(c)} | ${t(p)} |`)
  }
  out.push('\n(формат «balanced / careful»: победы % · потеря HP %)\n')
}

// ---- iso: for each variant the damage scale where the balanced bot wins closest to the target
const iso = load('iso')
if (iso && iso.runs >= 100) {
  const target = 0.85
  const variants = [...new Set(iso.table.map(r => r.rules))]
  out.push(`## Равная сложность: масштаб урона врагов, при котором balanced выигрывает ≈${pc(target)}% (S4, N=${iso.runs})\n`, '| вариант | масштаб урона | tempo / balanced / careful: победы % · потеря HP % | своб. защита % | нет безопасной линии % | спорных ходов % | расхождение ботов % | цена безопасности | ударов по героям | доля бонусных розыгрышей / доп. действий |', '|---|---:|---|---:|---:|---:|---:|---:|---:|---|')
  for (const v of variants) {
    const rs = iso.table.filter(r => r.rules === v)
    const scales = [...new Set(rs.map(r => r.scale.dmg ?? 1))]
    const best = scales.map(s => ({ s, b: rs.find(r => (r.scale.dmg ?? 1) === s && r.policy === 'balanced') })).sort((a, b) => Math.abs(a.b.win - target) - Math.abs(b.b.win - target))[0]
    const at = rs.filter(r => (r.scale.dmg ?? 1) === best.s)
    const b = best.b
    out.push(`| ${v} | ×${best.s} | ${triple(at)} | ${pc(b.tension.pctFree)} | ${pc(b.tension.pctUnsafe)} | ${pc(b.tension.pctContested)} | ${pc(b.tension.pctDiverge)} | ${f1(b.tension.meanTrade)} | ${f1(b.enemyHits)} | ${b.variantShare ? pc(b.variantShare) + '% ' : ''}${b.extraUses ? f1(b.extraUses) + ' пл./бой ' : ''}${b.windupBroken ? 'срыв ' + pc(b.windupBroken) + '%' : ''} |`)
  }
  out.push('')
}

// ---- generic compact table
function compact(title, exp, filter, label, note) {
  const j = load(exp); if (!j) return
  const rows = j.table.filter(filter)
  const keys = [...new Set(rows.map(label))]
  out.push('## ' + title + '\n', note ? note + '\n' : '', '| вариант | tempo | balanced | careful | своб. защита % | нет безопасной линии % | спорных ходов % | расхождение ботов % | ходов (balanced) | ударов по героям |', '|---|---|---|---|---:|---:|---:|---:|---:|---:|')
  for (const k of keys) {
    const rs = rows.filter(r => label(r) === k)
    const cell = p => { const r = rs.find(x => x.policy === p); return r ? pc(r.win) + '% · ' + pc(r.hpLost / (r.heroHp[0] + r.heroHp[1])) + '%' : '–' }
    const b = rs.find(r => r.policy === 'balanced') ?? rs[0]
    out.push('| ' + k + ' | ' + cell('tempo') + ' | ' + cell('balanced') + ' | ' + cell('careful') + ' | ' + pc(b.tension.pctFree) + ' | ' + pc(b.tension.pctUnsafe) + ' | ' + pc(b.tension.pctContested) + ' | ' + pc(b.tension.pctDiverge) + ' | ' + f1(b.turns) + ' | ' + f1(b.enemyHits) + ' |')
  }
  out.push('')
}
const sc = r => Object.entries(r.scale).map(([k, v]) => k + '×' + v).join(' ')
compact('Базовая линия: текущая игра (R0), цепочка Сектора I', 'baseline', () => true, r => r.rules + ' · ' + r.shape.name, 'Ячейка: победы % · потеря HP % от 43. S3 = два обычных боя + Рак’Зор, S4 = + Джонсон. Без наград, лечения и улучшений.')
compact('Пакеты правил (S4)', 'grid', () => true, r => r.rules)
compact('Давление: масштаб урона врагов (S4)', 'pressure', () => true, r => r.rules + ' ' + sc(r))
compact('Длина боя: масштаб здоровья врагов (S4)', 'length', () => true, r => r.rules + ' ' + sc(r))
compact('Срок жизни брони × замахи (S4)', 'armor', () => true, r => r.rules + ' ' + sc(r))
compact('Механики при равных условиях (S4)', 'mech2', () => true, r => r.rules + ' ' + sc(r))
compact('Темп: больше здоровья врагов при меньшем уроне (S4)', 'pace', () => true, r => r.rules + ' ' + sc(r))
compact('Босс отдельно', 'phase2', () => true, r => r.rules + ' · ' + r.shape.name)
writeFileSync(resolve(dir, 'tables.md'), out.join('\n') + '\n')
console.log(out.join('\n'))
