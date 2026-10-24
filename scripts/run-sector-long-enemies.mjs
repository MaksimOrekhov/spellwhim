// One battle per enemy, strategy and seed from full health, B2 rules: the three long-route enemies next to the standard ones.
//   node scripts/run-sector-long-enemies.mjs [--seeds 200] [--output docs/data/sector-one-long]
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
const args = process.argv.slice(2)
const flag = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const seeds = Number(flag('--seeds', 200)), output = flag('--output', 'docs/data/sector-one-long')
await mkdir(output, { recursive: true })
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const load = path => server.ssrLoadModule('/src/game/' + path + '.ts')
  const [lab, economy, decks, rules] = await Promise.all(['honestLab', 'economy', 'honestDecks', 'rulesMode'].map(load))
  const eco = economy.honestEconomies['honest-b2-long'], m = rules.rulesModes.find(item => item.id === 'honest-b2-long')
  const deck = decks.honestDeck(m.defaultDeck, true)
  const mean = v => v.reduce((a, b) => a + b, 0) / v.length, r = (n, d = 2) => +n.toFixed(d)
  const rows = []
  for (const enemy of [...lab.sectorEnemyIds.slice(0, 4), ...lab.longEnemyIds]) for (const strategy of ['planner', 'balanced', 'defensive']) {
    const fights = []
    for (let seed = 1; seed <= seeds; seed += 1) fights.push(lab.fightEnemy(eco, enemy, deck, strategy, seed))
    rows.push({ enemy: enemy.replace('old-mines-', ''), strategy, win: r(fights.filter(f => f.result === 'victory').length / seeds), turns: r(mean(fights.map(f => f.turns)), 1), lostV: r(mean(fights.map(f => f.lost.warrior)), 1), lostJ: r(mean(fights.map(f => f.lost.mage)), 1), lostTotal: r(mean(fights.map(f => f.lost.warrior + f.lost.mage)), 1) })
  }
  await writeFile(`${output}/enemies.json`, JSON.stringify(rows, null, 1) + '\n')
  for (const row of rows) console.log(row.enemy.padEnd(10), row.strategy.padEnd(10), 'win', row.win, 'turns', row.turns, 'lost V/J', row.lostV, row.lostJ, 'total', row.lostTotal)
} finally { await server.close() }
