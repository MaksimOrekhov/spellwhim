/**
 * Prints the curated markdown tables used in docs/mana-progression-research.md straight from the result files,
 * so no number in the report is typed by hand.   vite-node research/mana/tables.ts
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Summary } from './stats'
import { manaModels } from './core'

function load(suite: string): Summary[] {
  const dir = join('research', 'mana', 'results', suite)
  return readdirSync(dir).filter(f => f.endsWith('.json')).flatMap(f => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { summaries: Summary[] }).summaries)
}
function loadCalib(tag: string): { model: string; lever: string; variant?: string; hp: number[]; dmg: number }[] {
  const dir = join('research', 'mana', 'results', 'calib-' + tag)
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')))
}
const f = (n: number, d = 1) => n.toFixed(d)
const md = (header: string[], rows: string[][]) => ['| ' + header.join(' | ') + ' |', '|' + header.map(() => '---').join('|') + '|', ...rows.map(r => '| ' + r.join(' | ') + ' |')].join('\n')
const modelOf = (id: string) => id.split('|')[0]!
const row = (list: Summary[], id: string, bot: string) => list.find(s => modelOf(s.config) === id && s.bot === bot)
const label = (id: string) => { const [m, v] = id.split('+'); return (manaModels[m!]?.label ?? m) + (v ? ' + ' + v : '') }
const sumLoss = (s: Summary) => s.hpLostPerBattle.reduce((x, y) => x + y, 0)

const which = process.argv[2] ?? 'all'
const section = (name: string, body: () => string) => { if (which === 'all' || which === name) { console.log(`<!-- ${name} -->`); console.log(body()); console.log() } }

section('baseline', () => {
  const s1 = load('s1')
  const rows = ['plan-even', 'greedy-balanced', 'greedy-aggressive', 'greedy-defensive'].map(bot => {
    const s = row(s1, 'A', bot)!
    return [bot, f(s.winPct, 1), s.encounterTurns.map(x => f(x)).join(' / '), s.encounterTurns.map(x => f(x - 1)).join(' / '), f(s.perTurn.available) + ' / ' + f(s.perTurn.spent) + ' / ' + f(s.perTurn.unused), f(s.perTurn.plays, 2), f(s.perTurn.handStart) + ' → ' + f(s.perTurn.handEnd), f(s.perTurn.links, 2), s.hpLostPerBattle.map(x => f(x)).join(' / '), f(s.pressure.defenseManaShare, 0) + '%', f(s.waiting.meanAge, 2)]
  })
  return md(['бот', 'победы %', 'ходов в боях 1/2/3', 'действий врага 1/2/3', 'мана: есть / потрачено / остаток', 'карт за ход', 'рука: начало → конец хода', 'связок за ход', 'потеря HP по боям (из 43)', 'мана в защиту', 'ждёт в руке, ходов'], rows)
})

section('scale', () => {
  const calibs = [...loadCalib('std'), ...loadCalib('std2')]
  const s6 = load('s6')
  const order = ['A', 'D0', 'D', 'S', 'U', 'B', 'C', 'F4', 'F5', 'P4', 'K', 'G1', 'G', 'PG', 'PG1', 'BG', 'BG1']
  const rows = order.map(id => {
    const c = calibs.find(x => x.model === id && x.lever === 'hp' && (x.variant ?? 'base') === 'base')
    if (!c) return null
    const base = calibs.find(x => x.model === 'A' && x.lever === 'hp')!
    const names = [24, 30, 46]
    return [label(id), c.hp.map((h, i) => f(h, 2) + '× (' + Math.round(names[i]! * h) + ')').join(' / '), f(c.dmg, 2) + '×', f(c.hp.reduce((a, b) => a + b, 0) / base.hp.reduce((a, b) => a + b, 0) * 100 - 100, 0) + '%']
  }).filter((x): x is string[] => x !== null)
  void s6
  return md(['модель', 'HP врагов: множитель (итоговое HP) для боёв 1/2/3', 'урон врагов', 'HP относительно A'], rows)
})

section('scorecard', () => {
  const s6 = load('s6')
  const calibs = [...loadCalib('std'), ...loadCalib('std2')]
  const order = ['A', 'D', 'S', 'U', 'B', 'C', 'G1', 'G', 'PG1', 'BG1']
  const rows = order.map(id => {
    const e = row(s6, id, 'plan-even')!
    const wins = ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced'].map(b => f(row(s6, id, b)!.winPct, 0)).join(' / ')
    return [label(id), wins, f(e.perTurn.plays, 2), f(e.perTurn.links, 2), f(e.perTurn.handStart) + ' → ' + f(e.perTurn.handEnd), f(e.flowLimitedPct, 0) + '%', f(e.decisions.bindingPct, 0) + '%', f(e.atCapPct, 0) + '%', f(e.endedBeforeCapPct, 0) + '%', f(e.waiting.meanAge, 2)]
  })
  void calibs
  return md(['модель', 'победы % (planner even / aggro / safe / greedy)', 'карт за ход', 'связок за ход', 'рука: начало → конец', 'нет карт при остатке маны', '+1 мана меняет ход', 'ходов на потолке маны', 'боёв закончено до потолка', 'ждёт в руке, ходов'], rows)
})

section('levers', () => {
  const s3b = load('s3b')
  const rows: string[][] = []
  for (const m of ['A', 'B', 'D']) {
    for (const lever of ['hp', 'escalate', 'reactive', 'pattern']) {
      const s = s3b.filter(x => x.config.startsWith(m + '|' + lever + '|'))
      const e = s.find(x => x.bot === 'plan-even')
      if (!e) continue
      const wins = ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced'].map(b => f(s.find(x => x.bot === b)!.winPct, 0)).join(' / ')
      const cal = e.config.split('|')
      rows.push([m, lever, cal[2]!.replace('hp', '') + ' · ' + cal[3]!.replace('d', 'урон '), wins, f(sumLoss(e), 0), f(e.pressure.lowHpBattlePct, 0) + '%', f(e.pressure.defenseManaShare, 0) + '%', f(e.decisions.bindingPct, 0) + '%'])
    }
  }
  return md(['мана', 'рычаг', 'калибровка (HP × бои · урон)', 'победы % (even / aggro / safe / greedy)', 'потеря HP', 'бои ≤40% HP', 'мана в защиту', '+1 мана меняет ход'], rows)
})

section('cards', () => {
  const s4 = load('s4')
  const rows: string[][] = []
  for (const m of ['A', 'B', 'C', 'D', 'G']) {
    for (const v of ['', '+concept', '+costup', '+concept-costup']) {
      const e = s4.find(x => x.bot === 'plan-even' && x.config.split('|')[0] === m + v)
      if (!e) continue
      const wins = ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced'].map(b => f(s4.find(x => x.bot === b && x.config.split('|')[0] === m + v)!.winPct, 0)).join(' / ')
      rows.push([m + v, wins, f(e.perTurn.plays, 2), f(e.perTurn.links, 2), f(e.perTurn.handStart) + ' → ' + f(e.perTurn.handEnd), f(e.flowLimitedPct, 0) + '%', f(e.decisions.bindingPct, 0) + '%', f(e.decisions.nearBest, 1)])
    }
  }
  return md(['конфигурация', 'победы % (even / aggro / safe / greedy)', 'карт за ход', 'связок за ход', 'рука: начало → конец', 'нет карт при остатке маны', '+1 мана меняет ход', 'почти равных планов'], rows)
})

section('conceptUsage', () => {
  const s4 = load('s4')
  const names: Record<string, string> = { 'concept-blade-and-flame': 'Клинок и пламя (3)', 'concept-arcane-barrage': 'Арканный шквал (4)', 'concept-oath-of-the-wall': 'Клятва стены (3)', 'concept-battle-signal': 'Сигнал к бою (3)' }
  const rows = Object.keys(names).map(id => {
    const cells = ['B+concept', 'C+concept', 'G+concept'].flatMap(m => ['plan-even', 'greedy-balanced'].map(bot => {
      const s = s4.find(x => x.bot === bot && x.config.split('|')[0] === m)!
      return f((s.cardPlays[id] ?? 0) / s.runs, 2)
    }))
    return [names[id]!, ...cells]
  })
  return md(['карта (стоимость)', 'B даёт planner', 'B greedy', 'C planner', 'C greedy', 'G planner', 'G greedy'], rows)
})

section('draw', () => {
  const s5 = [...load('s5'), ...load('s10')]
  const rows: string[][] = []
  const add = (label2: string, s: Summary[], id: string) => {
    const e = s.find(x => x.bot === 'plan-even' && x.config.split('|')[0] === id)
    if (!e) return
    const wins = ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced'].map(b => f(s.find(x => x.bot === b && x.config.split('|')[0] === id)!.winPct, 0)).join(' / ')
    rows.push([label2, wins, f(e.perTurn.handStart) + ' → ' + f(e.perTurn.handEnd), f(e.flowLimitedPct, 0) + '%', f(e.blockedDraws, 2), f(e.perTurn.links, 2), f(e.perTurn.plays, 2)])
  }
  const s5only = load('s5')
  for (const m of ['A', 'B', 'C', 'D']) {
    add(m + ' · добор 2', s5only, m)
    add(m + ' · добор 3', s5only, m + '+draw3')
    add(m + ' · добор 4', s5only, m + '+draw4')
    add(m + ' · старт 6, добор 3', s5only, m + '+open6draw3')
  }
  const s10 = load('s10')
  for (const m of ['B', 'U', 'S']) {
    add(m + ' · добор 2 (пакет «босс»)', s10, m)
    add(m + ' · добор 3 (пакет «босс»)', s10, m + '+draw3')
    add(m + ' · добор 3 с 5-го хода (пакет «босс»)', s10, m + '+draw3late')
  }
  void s5
  return md(['конфигурация', 'победы % (even / aggro / safe / greedy)', 'рука: начало → конец', 'нет карт при остатке маны', 'потеряно доборов за бой', 'связок за ход', 'карт за ход'], rows)
})

section('package', () => {
  const s10 = load('s10')
  const rows = ['A', 'B+draw3late', 'U', 'U+draw3', 'U+draw3late', 'S+draw3late', 'G1+draw3', 'UG1+draw3'].map(id => {
    const e = s10.find(x => x.bot === 'plan-even' && x.config.split('|')[0] === id)!
    const wins = ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced'].map(b => f(s10.find(x => x.bot === b && x.config.split('|')[0] === id)!.winPct, 0)).join(' / ')
    return [id, e.config.split('|')[2]!.replace('hp', '') + ' · ' + e.config.split('|')[3]!.replace('d', 'урон '), wins, e.encounterTurns.map(x => f(x)).join(' / '), e.hpLostPerBattle.map(x => f(x)).join(' / '), f(e.pressure.lowHpBattlePct, 0) + '%', f(e.pressure.criticalBattlePct, 0) + '%', f(e.pressure.defenseManaShare, 0) + '%', f(e.perTurn.links, 2), f(e.perTurn.plays, 2), f(e.perTurn.handStart) + ' → ' + f(e.perTurn.handEnd), f(e.decisions.bindingPct, 0) + '%']
  })
  return md(['конфигурация', 'калибровка (HP × бои · урон)', 'победы % (even / aggro / safe / greedy)', 'ходов в боях', 'потеря HP по боям', 'бои ≤40% HP', 'бои ≤20% HP', 'мана в защиту', 'связок за ход', 'карт за ход', 'рука', '+1 мана меняет ход'], rows)
})

section('usage', () => {
  const s6 = load('s6')
  const ids = ['sword-strike', 'shield-bash', 'parry', 'guard', 'interpose', 'quick-cut', 'bastion', 'fireball', 'frostbolt', 'thunderbolt', 'arcane-insight', 'ice-ward']
  const models = ['A', 'D', 'U', 'B', 'C', 'G1']
  const rows = ids.map(id => [id, ...models.map(m => { const s = row(s6, m, 'plan-even')!; return f((s.cardPlays[id] ?? 0) / s.runs, 1) })])
  return md(['карта (розыгрышей за поход)', ...models], rows)
})

section('stuck', () => {
  const s6 = load('s6')
  const ids = ['guard', 'ice-ward', 'arcane-insight', 'interpose', 'parry', 'shield-bash', 'fireball', 'sword-strike', 'frostbolt']
  const models = ['A', 'U', 'B']
  const rows = ids.map(id => [id, ...models.flatMap(m => { const s = row(s6, m, 'plan-even')!; const w = s.waiting.byCard[id]!; return [f(w.meanAge, 1), f(w.stuck / s.runs / 3, 2)] })])
  return md(['карта', 'A: ждёт, ходов', 'A: копий в руке к концу боя (из 2)', 'U: ждёт', 'U: копий к концу', 'B: ждёт', 'B: копий к концу'], rows)
})

section('style', () => {
  const s6 = load('s6')
  const rows = ['A', 'D', 'S', 'U', 'B', 'C', 'G1', 'G'].map(id => {
    const a = row(s6, id, 'plan-aggro')!, e = row(s6, id, 'plan-even')!, sf = row(s6, id, 'plan-safe')!
    return [label(id), [a, e, sf].map(s => f(s.turnsPerRun, 1)).join(' / '), [a, e, sf].map(s => f(sumLoss(s), 0)).join(' / '), [a, e, sf].map(s => f(s.pressure.defenseManaShare, 0) + '%').join(' / ')]
  })
  return md(['модель', 'ходов за поход (aggro / even / safe)', 'потеря HP (aggro / even / safe)', 'мана в защиту'], rows)
})
