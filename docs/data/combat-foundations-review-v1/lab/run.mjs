// Usage (repo root):  node docs/data/combat-foundations-review-v1/lab/run.mjs <experiment> [--runs N] [--seed S] [--workers K]
// Experiments are defined in experiments.mjs. Results: docs/data/combat-foundations-review-v1/results/<experiment>.json (+ .md table).
import { fork } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { loadEngine, playBattle, POLICIES, scaleEncounter, summarizeTension } from './engine.mjs'
import { experiments, cellKey } from './experiments.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d }
const name = args[0]
const runs = Number(flag('runs', 150))
const seed0 = Number(flag('seed', 1000))
const workers = Number(flag('workers', 10))
const shard = flag('shard', null)

function lcg(seed) { let x = (seed >>> 0) || 1; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296 }

/** A short Sector-I-like chain: no rewards, no healing, hero health carried over. */
function gauntlet(E, cell, seed) {
  const rng = lcg(seed * 7919 + 13)
  const normals = [...E.sector.sectorOneEnemies]
  const pick = []
  while (pick.length < (cell.shape.normals ?? 2)) pick.push(normals.splice(Math.floor(rng() * normals.length), 1)[0])
  const chain = [...pick, ...(cell.shape.elite ? [E.sector.sectorOneElite] : []), ...(cell.shape.boss === false ? [] : [E.sector.rhahkZor])]
  const start = E.campaign.createCampaignBattle({ seed: 1 }).heroes
  if (cell.heroHp) { start.warrior.health = start.warrior.maxHealth = cell.heroHp[0]; start.mage.health = start.mage.maxHealth = cell.heroHp[1] }
  let heroes = start
  const out = { seed, win: false, fights: [], tension: [], hpLost: 0, hpW: 0, hpM: 0, turns: 0, lowest: 1, enemyHits: 0, plays: 0, manaSpent: 0, manaAvail: 0, armorGiven: 0, bothClass: 0, extraUses: 0, kept: 0, paid: 0, xs: {}, variant: 0, windups: 0, broken: 0, hand: 0, playable: 0, diedAt: null }
  for (const [i, enc] of chain.entries()) {
    const rec = playBattle(E, { encounter: scaleEncounter(enc, cell.scale ?? {}), heroes, deck: cell.rules.deck ?? cell.deck ?? E.types.startingDeck, seed: seed * 31 + i, rules: cell.rules, policy: POLICIES[cell.policy] })
    out.fights.push({ enc: enc.id, result: rec.result, turns: rec.turns, hp: rec.hpLost.warrior + rec.hpLost.mage, p2: rec.p2 })
    out.tension.push(...rec.tension)
    out.hpW += rec.hpLost.warrior; out.hpM += rec.hpLost.mage; out.turns += rec.turns; out.enemyHits += rec.enemyHits
    out.plays += rec.plays; out.manaSpent += rec.manaSpent; out.manaAvail += rec.manaAvail; out.armorGiven += rec.armorGiven; out.bothClass += rec.bothClassTurns
    out.paid += rec.paid; for (const [k, v] of Object.entries(rec.xstats ?? {})) out.xs[k] = (out.xs[k] ?? 0) + v
    out.variant += rec.variantPlays; out.windups += rec.xstats?.windups ?? 0; out.broken += rec.xstats?.windupsBroken ?? 0; out.extraUses += rec.extraUses; out.kept += rec.keptCards; out.hand += rec.handAtStart; out.playable += rec.playable
    out.lowest = Math.min(out.lowest, rec.heroesEnd.warrior / rec.final.heroes.warrior.maxHealth, rec.heroesEnd.mage / rec.final.heroes.mage.maxHealth)
    if (rec.result !== 'victory') { out.diedAt = i; break }
    heroes = E.campaign.carriedHeroes(rec.final)
  }
  out.win = out.diedAt === null
  out.hpLost = out.hpW + out.hpM
  out.endW = heroes.warrior.health; out.endM = heroes.mage.health
  return out
}

async function child() {
  const [k, K] = shard.split('/').map(Number)
  const E = await loadEngine()
  const exp = experiments(E)[name]
  const rows = []
  for (const cell of exp.cells) {
    for (let i = k; i < runs; i += K) rows.push({ cell: cellKey(cell), ...gauntlet(E, cell, seed0 + i) })
  }
  await E.close()
  process.stdout.write('@@' + JSON.stringify(rows) + '\n')
}

const mean = (xs, f = x => x) => xs.length ? xs.reduce((a, x) => a + f(x), 0) / xs.length : NaN
const pct = x => (100 * x).toFixed(1)
const f1 = x => Number.isFinite(x) ? x.toFixed(1) : '–'

async function parent() {
  const E = await loadEngine()
  const exp = experiments(E)[name]
  if (!exp) throw new Error('unknown experiment ' + name + '; have ' + Object.keys(experiments(E)).join(', '))
  await E.close()
  const procs = Array.from({ length: workers }, (_, k) => new Promise((ok, fail) => {
    const p = fork(fileURLToPath(import.meta.url), [name, '--runs', runs, '--seed', seed0, '--shard', `${k}/${workers}`], { silent: true })
    let buf = ''
    p.stdout.on('data', d => { buf += d })
    p.stderr.on('data', d => process.stderr.write(d))
    p.on('exit', code => { const m = buf.split('\n').find(l => l.startsWith('@@')); if (code !== 0 || !m) fail(new Error('shard ' + k + ' failed (' + code + ')')); else ok(JSON.parse(m.slice(2))) })
  }))
  const rows = (await Promise.all(procs)).flat()
  const table = []
  for (const cell of exp.cells) {
    const key = cellKey(cell)
    const rs = rows.filter(r => r.cell === key)
    const ts = rs.flatMap(r => r.tension)
    const t = summarizeTension(ts)
    const wins = rs.filter(r => r.win)
    table.push({
      key, group: cell.group ?? '', rules: cell.rules.id, policy: cell.policy, scale: cell.scale ?? {}, shape: cell.shape, heroHp: cell.heroHp ?? [25, 18], n: rs.length,
      win: mean(rs, r => +r.win), hpLost: mean(rs, r => r.hpLost), hpW: mean(rs, r => r.hpW), hpM: mean(rs, r => r.hpM),
      hpLostWins: mean(wins, r => r.hpLost), turns: mean(rs, r => r.turns), fights: mean(rs, r => r.fights.length),
      enemyHits: mean(rs, r => r.enemyHits), manaUse: mean(rs, r => r.manaSpent) / mean(rs, r => r.manaAvail), plays: mean(rs, r => r.plays), armorGiven: mean(rs, r => r.armorGiven), xs: Object.fromEntries([...new Set(rs.flatMap(r => Object.keys(r.xs)))].map(k => [k, mean(rs, r => r.xs[k] ?? 0)])), extraUses: mean(rs, r => r.extraUses), paid: mean(rs, r => r.paid), variantShare: mean(rs, r => r.variant) / mean(rs, r => r.plays), windupBroken: mean(rs, r => r.broken) / Math.max(1e-9, mean(rs, r => r.windups)), kept: mean(rs, r => r.kept),
      bothClass: mean(rs, r => r.bothClass) / mean(rs, r => r.turns), hand: mean(rs, r => r.hand) / mean(rs, r => r.turns), playable: mean(rs, r => r.playable) / mean(rs, r => r.turns),
      lowestMean: mean(rs, r => r.lowest), p10Hp: [...rs.map(r => r.hpLost)].sort((a, b) => a - b)[Math.floor(rs.length * 0.9)],
      perFight: Object.fromEntries([...new Set(rs.flatMap(r => r.fights.map(f => f.enc)))].map(enc => { const fs = rs.flatMap(r => r.fights.filter(f => f.enc === enc)); return [enc, { n: fs.length, turns: mean(fs, f => f.turns), hp: mean(fs, f => f.hp), p2: mean(fs, f => f.p2), win: mean(fs, f => +(f.result === 'victory')) }] })),
      tension: t,
    })
  }
  mkdirSync(resolve(here, '../results'), { recursive: true })
  writeFileSync(resolve(here, '../results', name + '.json'), JSON.stringify({ experiment: name, runs, seed0, table }, null, 1))
  const md = ['| правила | бот | сцена | N | побед % | потеря HP (В/М) | % от макс. HP | ходов | ударов по героям | мана % | своб. защита % | нет безопасной линии % | спорных ходов % | расхождение ботов % | цена безопасности |', '|---|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
  for (const r of table) md.push(`| ${r.rules}${Object.keys(r.scale).length ? ' ' + JSON.stringify(r.scale) : ''} | ${r.policy} | ${r.shape.name} | ${r.n} | ${pct(r.win)} | ${f1(r.hpLost)} (${f1(r.hpW)}/${f1(r.hpM)})${r.paid ? ' +' + f1(r.paid) + ' по клятве' : ''} | ${pct(r.hpLost / (r.heroHp[0] + r.heroHp[1]))} | ${f1(r.turns)} | ${f1(r.enemyHits)} | ${pct(r.manaUse)} | ${pct(r.tension.pctFree)} | ${pct(r.tension.pctUnsafe)} | ${pct(r.tension.pctContested)} | ${pct(r.tension.pctDiverge)} | ${f1(r.tension.meanTrade)} |`)
  writeFileSync(resolve(here, '../results', name + '.md'), md.join('\n') + '\n')
  console.log(md.join('\n'))
}

if (shard) await child(); else await parent()
