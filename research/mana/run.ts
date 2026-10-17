/**
 * CLI for the mana research harness.
 *
 *   vite-node research/mana/run.ts job    --suite s1 --runs 200 --seed 42 --shard 0/12
 *   vite-node research/mana/run.ts report --suite s1
 *   vite-node research/mana/run.ts trace  --config B --bot plan-even --seed 7 --turns 4
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { manaModels, runCampaign } from './core'
import type { BotId } from './core'
import { summarize } from './stats'
import type { Summary } from './stats'
import { cfg, suites } from './suites'
import { calibrate, leverConfig } from './calibrate'
import { loadCalibrations } from './suites.extra'
import type { Lever } from './calibrate'
import './suites.extra'

function args(): Record<string, string> {
  const out: Record<string, string> = {}
  const argv = process.argv.slice(2).filter(a => a !== '--')
  out._ = argv[0] ?? ''
  for (let i = 1; i < argv.length; i += 1) if (argv[i]!.startsWith('--')) out[argv[i]!.slice(2)] = argv[i + 1] ?? 'true'
  return out
}
const resultsDir = (suite: string) => join('research', 'mana', 'results', suite)

function job(a: Record<string, string>): void {
  const suite = suites[a.suite!]
  if (!suite) throw new Error('unknown suite ' + a.suite)
  const runs = Number(a.runs ?? 200)
  const seed = Number(a.seed ?? 42) >>> 0
  const [shard, shards] = (a.shard ?? '0/1').split('/').map(Number) as [number, number]
  const jobs = suite.jobs().filter((_, i) => i % shards === shard)
  const out: Summary[] = []
  const started = Date.now()
  for (const { config, bot } of jobs) {
    const records = Array.from({ length: runs }, (_, i) => runCampaign((seed + i) >>> 0, bot, config, { probe: a.probe === 'true' && bot === 'plan-even' }))
    out.push(summarize(records, bot, config.id, config.enemy?.encounters?.length ?? 3))
    process.stderr.write(`[${shard}/${shards}] ${config.id} ${bot} ${((Date.now() - started) / 1000).toFixed(0)}s\n`)
  }
  mkdirSync(resultsDir(suite.id), { recursive: true })
  writeFileSync(join(resultsDir(suite.id), `shard-${shard}.json`), JSON.stringify({ runs, seed, summaries: out }))
}

export function loadSuite(id: string): { runs: number; seed: number; summaries: Summary[] } {
  const dir = resultsDir(id)
  const parts = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as { runs: number; seed: number; summaries: Summary[] })
  return { runs: parts[0]!.runs, seed: parts[0]!.seed, summaries: parts.flatMap(p => p.summaries) }
}

const f = (n: number, d = 1) => n.toFixed(d)
function table(rows: string[][], header: string[]): string {
  return ['| ' + header.join(' | ') + ' |', '|' + header.map(() => '---').join('|') + '|', ...rows.map(r => '| ' + r.join(' | ') + ' |')].join('\n')
}

function report(a: Record<string, string>): void {
  const { runs, seed, summaries } = loadSuite(a.suite!)
  const order = [...new Set(summaries.map(s => s.config))]
  const botFilter = a.bots?.split(',')
  console.log(`# ${a.suite} · ${runs} seeds (${seed}–${seed + runs - 1})\n`)
  const bots = [...new Set(summaries.map(s => s.bot))].filter(b => !botFilter || botFilter.includes(b))
  for (const bot of bots) {
    console.log(`## ${bot}\n`)
    const rows = order.map(id => summaries.find(s => s.config === id && s.bot === bot)).filter(Boolean).map(s => [
      s!.config, f(s!.winPct), s!.encounterWinPct.map(x => f(x, 0)).join('/'), s!.encounterTurns.map(x => f(x)).join('/'), f(s!.turnsPerRun),
      f(s!.perTurn.available), f(s!.perTurn.spent), f(s!.perTurn.unused), f(s!.perTurn.plays), f(s!.perTurn.handStart), f(s!.perTurn.handEnd),
      f(s!.perTurn.links, 2), f(s!.endHp.warrior) + '/' + f(s!.endHp.mage), f(s!.atCapPct, 0), f(s!.endedBeforeCapPct, 0), f(s!.flowLimitedPct, 0), f(s!.manaBoundPct, 0), f(s!.holdPct, 0),
    ])
    console.log(table(rows, ['конфиг', 'победы %', 'по боям %', 'ходов/бой', 'ходов всего', 'мана', 'потрачено', 'остаток', 'карт/ход', 'рука нач.', 'рука кон.', 'связок/ход', 'HP В/М', 'на потолке %', 'бой раньше потолка %', 'нет карт %', 'не хватает маны %', 'держит %']))
    console.log()
  }
}

function reportPressure(a: Record<string, string>): void {
  const { runs, seed, summaries } = loadSuite(a.suite!)
  const order = [...new Set(summaries.map(s => s.config))]
  const botFilter = a.bots?.split(',')
  console.log(`# ${a.suite} · давление и решения · ${runs} seeds (${seed}–${seed + runs - 1})\n`)
  const bots = [...new Set(summaries.map(s => s.bot))].filter(b => !botFilter || botFilter.includes(b))
  for (const bot of bots) {
    console.log(`## ${bot}\n`)
    const rows = order.map(id => summaries.find(s => s.config === id && s.bot === bot)).filter(Boolean).map(s => [
      s!.config, f(s!.winPct), s!.encounterTurns.map(x => f(x)).join('/'), s!.hpLostPerBattle.map(x => f(x)).join('/'),
      f(s!.pressure.incomingPerTurn), f(s!.pressure.absorbedPerTurn), f(s!.pressure.hpLostPerTurn, 2), f(s!.pressure.defenseManaShare, 0),
      f(s!.pressure.lowHpBattlePct, 0), f(s!.pressure.criticalBattlePct, 0), f(s!.pressure.minHpFrac * 100, 0),
      s!.decisions.probed ? f(s!.decisions.marginalMana, 2) : '—', s!.decisions.probed ? f(s!.decisions.bindingPct, 0) : '—', s!.decisions.probed ? f(s!.decisions.sets) : '—', s!.decisions.probed ? f(s!.decisions.nearBest) : '—', s!.decisions.probed ? f(s!.decisions.gap) : '—',
    ])
    console.log(table(rows, ['конфиг', 'победы %', 'ходов/бой', 'потеря HP/бой', 'угроза/ход', 'поглощено/ход', 'потеря HP/ход', 'доля маны в защиту %', 'бои ≤40% HP %', 'бои ≤20% HP %', 'мин. HP %', 'ценность +1 маны', '+1 мана меняет ход %', 'наборов', 'почти лучших', 'отрыв']))
    console.log()
  }
}


function reportGrid(a: Record<string, string>): void {
  const { runs, seed, summaries } = loadSuite(a.suite!)
  const bot = a.bot ?? 'plan-even'
  console.log(`# ${a.suite} · ${bot} · ${runs} seeds (${seed}–${seed + runs - 1})`)
  console.log('')
  console.log('Ячейка: победы % · ходов в боях 1/2/3 · потеря HP за поход (из 43) · бои ≤40% HP %')
  console.log('')
  const models = [...new Set(summaries.map(s => s.config.split('|')[0]!))]
  for (const model of models) {
    const rows = summaries.filter(s => s.bot === bot && s.config.startsWith(model + '|'))
    const hps = [...new Set(rows.map(s => s.config.split('|')[1]!))]
    const dmgs = [...new Set(rows.map(s => s.config.split('|')[2]!))]
    console.log(`### ${model}`)
    console.log('')
    const cell = (h: string, d: string) => {
      const s = rows.find(x => x.config === `${model}|${h}|${d}`)
      return s ? `${f(s.winPct, 0)}% · ${s.encounterTurns.map(x => f(x)).join('/')} · −${f(s.hpLostPerBattle.reduce((x, y) => x + y, 0), 0)} · ${f(s.pressure.lowHpBattlePct, 0)}%` : '—'
    }
    console.log(table(hps.map(h => [h, ...dmgs.map(d => cell(h, d))]), ['HP', ...dmgs]))
    console.log('')
  }
}


function calibrateCommand(a: Record<string, string>): void {
  const turns = (a.turns ?? '4,5,8').split(',').map(Number)
  const loss = Number(a.loss ?? 20)
  const tag = a.tag ?? 'std'
  const dir = join('research', 'mana', 'results', 'calib-' + tag)
  mkdirSync(dir, { recursive: true })
  for (const model of (a.model ?? 'A').split(',')) {
    for (const lever of (a.lever ?? 'hp').split(',')) {
      const out = calibrate(model, lever as Lever, turns, loss, (a.bot ?? 'plan-even') as BotId, Number(a.runs ?? 120), Number(a.seed ?? 42), a.variant ?? 'base')
      writeFileSync(join(dir, `${model}-${lever}.json`), JSON.stringify(out))
      process.stderr.write(`${model} ${lever}: hp=${out.hp.join('/')} dmg=${out.dmg} turns=${out.summary.encounterTurns.map(x => x.toFixed(1)).join('/')} loss=${out.summary.hpLostPerBattle.reduce((x, y) => x + y, 0).toFixed(1)} win=${out.summary.winPct.toFixed(0)}% iter=${out.iterations}${String.fromCharCode(10)}`)
    }
  }
}

function trace(a: Record<string, string>): void {
  const model = a.config ?? 'A'
  let c = cfg(model, model)
  if (a.calib) {
    const found = (a.tag ?? 'std').split(',').flatMap(tag => loadCalibrations(tag)).find(x => x.model === model && x.lever === (a.lever ?? 'hp') && (x.variant ?? 'base') === (a.variant ?? 'base'))
    if (!found) throw new Error('no calibration for ' + model)
    c = leverConfig(found.model, found.lever, found.hp, found.dmg, found.variant ?? 'base')
  }
  const start = Number(a.encounter ?? 0)
  const record = runCampaign(Number(a.seed ?? 7), (a.bot ?? 'plan-even') as BotId, c, { trace: true, traceHand: true, stopAfterTurns: Number(a.turns ?? 4), startAt: start, encounterLimit: start + 1 })
  console.log(record.trace!.join(String.fromCharCode(10)))
}

/** One compact row per configuration, joining all bots: the table used in the research report. */
function reportCompare(a: Record<string, string>): void {
  const { runs, seed, summaries } = loadSuite(a.suite!)
  const ids = [...new Set(summaries.map(s => s.config))].filter(id => !a.match || id.includes(a.match))
  const get = (id: string, bot: string) => summaries.find(s => s.config === id && s.bot === bot)
  console.log(`# ${a.suite} · compare · ${runs} seeds (${seed}–${seed + runs - 1})`)
  console.log('')
  const header = ['конфиг', 'побед. even/aggro/safe/greedy %', 'ходов/бой (even)', 'потеря HP', 'бои ≤40% HP %', 'мана в защиту %', 'поглощено/угроза %', 'связок/ход', 'карт/ход', 'рука нач./кон.', 'потолок %', 'нет карт %', '+1 мана меняет ход %', 'почти лучших', 'ждёт в руке, ходов', 'не сыграно к концу боя']
  const rows = ids.map(id => {
    const e = get(id, 'plan-even')
    if (!e) return null
    const w = ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced'].map(b => { const s = get(id, b); return s ? f(s.winPct, 0) : '—' }).join('/')
    return [id, w, e.encounterTurns.map(x => f(x)).join('/'), f(e.hpLostPerBattle.reduce((x, y) => x + y, 0), 0), f(e.pressure.lowHpBattlePct, 0), f(e.pressure.defenseManaShare, 0), f(e.pressure.incomingPerTurn ? e.pressure.absorbedPerTurn / e.pressure.incomingPerTurn * 100 : 0, 0), f(e.perTurn.links, 2), f(e.perTurn.plays, 2), f(e.perTurn.handStart) + '/' + f(e.perTurn.handEnd), f(e.atCapPct, 0), f(e.flowLimitedPct, 0), e.decisions.probed ? f(e.decisions.bindingPct, 0) : '—', e.decisions.probed ? f(e.decisions.nearBest, 1) : '—', f(e.waiting?.meanAge ?? 0, 2), f(e.waiting?.stuckPerBattle ?? 0, 1)]
  }).filter((row): row is string[] => row !== null)
  console.log(table(rows, header))
}

const a = args()
if (a._ === 'compare') reportCompare(a)
else if (a._ === 'job') job(a)
else if (a._ === 'report') report(a)
else if (a._ === 'trace') trace(a)
else if (a._ === 'pressure') reportPressure(a)
else if (a._ === 'grid') reportGrid(a)
else if (a._ === 'calibrate') calibrateCommand(a)
else console.log('commands: job | report | trace')
void manaModels
