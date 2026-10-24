// Sector I: short against long route (docs/design/sector-one-long-v1.md). Real engine, same seeds, same bot policy in both.
//   node scripts/run-sector-long.mjs [--runs 200] [--modes honest-b2,honest-b2-long] [--strategies planner,planner-careful,balanced,defensive] [--policies safe,mixed,risky] [--output docs/data/sector-one-long]
// Every number comes from simulateSectorRun; nothing is tuned to a target win rate. The bots expose problems and compare variants, they do not define difficulty.
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const flag = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const runs = Number(flag('--runs', 200))
const modes = flag('--modes', 'honest-b1,honest-b1-long,honest-b2,honest-b2-long').split(',')
const strategies = flag('--strategies', 'planner,planner-careful,balanced,defensive').split(',')
const policies = flag('--policies', 'safe,mixed,risky').split(',')
const output = flag('--output', 'docs/data/sector-one-long')
// A route variant to compare against the shipped one (the study edits the configuration in memory only): `rest6` lets row 7 (index 6) be a rest too.
const variant = flag('--variant', 'shipped')
await mkdir(output, { recursive: true })
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'unknown' } })()

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const load = path => server.ssrLoadModule('/src/game/' + path + '.ts')
  const [lab, economy, decks, rules] = await Promise.all(['honestLab', 'economy', 'honestDecks', 'rulesMode'].map(load))
  const mean = v => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
  const r = (n, d = 2) => +n.toFixed(d)
  const enemyName = id => id.replace('old-mines-', '')
  const long = await load('sectorLong')
  if (variant === 'rest6') long.sectorLongConfig.rows[6].types.push('rest')
  const rows = []
  for (const mode of modes) {
    const m = rules.rulesModes.find(item => item.id === mode)
    const deck = decks.honestDeck(m.defaultDeck ?? 'armor10', m.frost === true)
    for (const strategy of strategies) for (const policy of policies) {
      const logs = []
      for (let seed = 1; seed <= runs; seed += 1) logs.push(lab.simulateSectorRun(seed, economy.honestEconomies[mode], deck, strategy, policy))
      const won = logs.filter(l => l.result === 'victory'), reached = logs.filter(l => l.healthBeforeBoss)
      const fights = logs.flatMap(l => l.battles.map(b => b.fight))
      const diedAt = {}
      for (const l of logs.filter(item => item.result === 'defeat')) { const k = enemyName(l.battles.at(-1).enemy); diedAt[k] = (diedAt[k] ?? 0) + 1 }
      const lostPerBattle = (l, h) => l.battles.reduce((s, b) => s + b.fight.lost[h], 0)
      rows.push({
        mode, variant: mode.endsWith('-long') ? variant : '-', strategy, policy, runs,
        win: r(won.length / runs), timeouts: logs.filter(l => l.result === 'timeout').length, reachBoss: r(reached.length / runs),
        bossWinGivenReached: r(reached.length ? won.length / reached.length : 0),
        visits: r(mean(logs.map(l => l.route.length)), 1), battles: r(mean(logs.map(l => l.battles.length)), 1), elites: r(mean(logs.map(l => l.elites ?? 0)), 2),
        hpBeforeBossV: r(mean(reached.map(l => l.healthBeforeBoss.warrior)), 1), hpBeforeBossJ: r(mean(reached.map(l => l.healthBeforeBoss.mage)), 1),
        lowHpBeforeBoss: r(mean(reached.map(l => (l.healthBeforeBoss.warrior / 25 < 0.5 || l.healthBeforeBoss.mage / 18 < 0.5) ? 1 : 0))),
        healed: r(mean(logs.map(l => l.healed ?? 0)), 1), upgrades: r(mean(logs.map(l => l.upgrades ?? 0)), 1),
        lostV: r(mean(logs.map(l => lostPerBattle(l, 'warrior'))), 1), lostJ: r(mean(logs.map(l => lostPerBattle(l, 'mage'))), 1),
        turnsPerBattle: r(mean(fights.map(f => f.turns)), 1), diedAt,
      })
    }
  }
  await writeFile(`${output}/runs.json`, JSON.stringify(rows, null, 1) + '\n')
  await writeFile(`${output}/manifest.json`, JSON.stringify({ study: 'sector-one-long', variant, commit: sha, runs, modes, strategies, policies }, null, 1) + '\n')
  console.log('rows', rows.length)
} finally { await server.close() }
