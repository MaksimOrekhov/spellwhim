// Gold Cards v1 laboratory: what one gold card is worth in a fight, next to the control deck and next to an ordinary reward card.
// One battle per enemy, deck, strategy and seed from full health, under the rules the game plays (Honest Turn B2, long Sector I).
//   node scripts/run-gold-lab.mjs [--seeds 80] [--strategies planner,balanced] [--output docs/data/gold-cards-v1]
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
const args = process.argv.slice(2)
const flag = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const seeds = Number(flag('--seeds', 80)), output = flag('--output', 'docs/data/gold-cards-v1')
const strategies = flag('--strategies', 'planner,balanced').split(',')
await mkdir(output, { recursive: true })
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const load = path => server.ssrLoadModule('/src/game/' + path + '.ts')
  const [lab, economy, decks, rules, types] = await Promise.all(['honestLab', 'economy', 'honestDecks', 'rulesMode', 'types'].map(load))
  const eco = economy.honestEconomies['honest-b2-long'], m = rules.rulesModes.find(item => item.id === 'honest-b2-long')
  const control = decks.honestDeck(m.defaultDeck, true)
  const gold = types.goldCards.map(card => card.id)
  // The elite used to give one ordinary card out of five: the best of them is the yardstick for "what the old prize was worth".
  const variants = [
    ['control', control],
    ['+thunderbolt (old elite prize)', [...control, 'thunderbolt']],
    ['+rend (old elite prize)', [...control, 'rend']],
    ...gold.map(id => ['+' + id, [...control, id]]),
    ['+all four gold', [...control, ...gold]],
    // Bloody Finale is a build-around: the starting deck has no Bleeding at all, so it is also measured in a deck that has drafted two sources.
    ['bleed package (+rend, +ice-echo)', [...control, 'rend', 'ice-echo']],
    ['bleed package +bloody-finale', [...control, 'rend', 'ice-echo', 'bloody-finale']],
  ]
  const enemies = [...lab.sectorEnemyIds, ...lab.longEnemyIds]
  const mean = v => v.reduce((a, b) => a + b, 0) / v.length, r = (n, d = 2) => +n.toFixed(d)
  const rows = []
  for (const enemy of enemies) for (const strategy of strategies) for (const [name, deck] of variants) {
    const fights = []
    for (let seed = 1; seed <= seeds; seed += 1) fights.push(lab.fightEnemy(eco, enemy, deck, strategy, seed))
    const won = fights.filter(f => f.result === 'victory')
    rows.push({ enemy: enemy.replace('old-mines-', ''), strategy, deck: name, win: r(won.length / seeds), turns: r(mean(fights.map(f => f.turns)), 2), lost: r(mean(fights.map(f => f.lost.warrior + f.lost.mage)), 2), lostWon: won.length ? r(mean(won.map(f => f.lost.warrior + f.lost.mage)), 2) : null, value: r(mean(fights.map(lab.outcomeValue)), 3) })
  }
  await writeFile(`${output}/fights.json`, JSON.stringify({ seeds, strategies, rows }, null, 1) + '\n')
  // One table per strategy: each deck's mean outcome value over all enemies, and the change against the control deck.
  for (const strategy of strategies) {
    console.log('\n== ' + strategy + ' (' + seeds + ' seeds × ' + enemies.length + ' enemies)')
    const base = rows.filter(row => row.strategy === strategy && row.deck === 'control')
    for (const [name] of variants) {
      const own = rows.filter(row => row.strategy === strategy && row.deck === name)
      const dLost = mean(own.map((row, i) => row.lost - base[i].lost)), dTurns = mean(own.map((row, i) => row.turns - base[i].turns)), dWin = mean(own.map((row, i) => row.win - base[i].win))
      console.log(name.padEnd(36), 'value', r(mean(own.map(row => row.value)), 3), ' dLost', r(dLost, 2), ' dTurns', r(dTurns, 2), ' dWin', r(dWin, 3))
    }
  }
  console.log('\nper enemy, planner, health lost: control vs +all four gold')
  for (const enemy of enemies.map(id => id.replace('old-mines-', ''))) {
    const pick = name => rows.find(row => row.enemy === enemy && row.strategy === strategies[0] && row.deck === name)
    console.log(enemy.padEnd(14), 'control', pick('control').lost, ' gold×4', pick('+all four gold').lost, ' turns', pick('control').turns, '→', pick('+all four gold').turns)
  }
} finally { await server.close() }
