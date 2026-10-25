// Sector I Content Expansion v1 (docs/design/sector-one-content-expansion-v1.md): the two elites side by side on the real engine, B2 Long rules.
//   node scripts/run-sector-expansion.mjs elites [--seeds 300] [--output docs/data/sector-one-content-expansion]
// One battle per elite, strategy, party and seed. Two parties: `start` (the B2 Long starting deck, full health) and `mid` (the same deck with five upgrades and three
// reward cards, 75% health: roughly the party that reaches the optional elite in row 5). Nothing is tuned to a target win rate; the bots expose problems, they do not define difficulty.
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const command = args[0] ?? 'elites'
const flag = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const seeds = Number(flag('--seeds', 300)), output = flag('--output', 'docs/data/sector-one-content-expansion')
const only = flag('--elite', '')
await mkdir(output, { recursive: true })
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const load = path => server.ssrLoadModule('/src/game/' + path + '.ts')
  const [lab, economy, decks, campaign, progression, types] = await Promise.all(['honestLab', 'economy', 'honestDecks', 'campaign', 'cardProgression', 'types'].map(load))
  const eco = economy.honestEconomies['honest-b2-long']
  // `--variant '{"maxHealth":58,"phase1":[...]}'` replaces the foreman in memory only, to compare numbers before they are written into the game.
  if (flag('--variant', '')) Object.assign((await load('sectorLong')).thistlenettle, JSON.parse(flag('--variant', '')).maxHealth ? { maxHealth: JSON.parse(flag('--variant', '')).maxHealth } : {}, JSON.parse(flag('--variant', '')).phase1 ? { behavior: { phase1: JSON.parse(flag('--variant', '')).phase1 } } : {})
  const mean = v => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, r = (n, d = 2) => +n.toFixed(d)

  /** The two parties an elite is fought by. */
  function party(kind, seed) {
    const run = campaign.createSectorRun(seed, eco, decks.honestDeck('armor8', true), undefined, 'x')
    if (kind === 'start') return { heroes: run.heroes, deck: run.deck }
    const deck = run.deck.map(card => ({ ...card }))
    let upgraded = 0
    for (const card of deck) if (upgraded < 5 && progression.canUpgradeCard(card)) { card.upgrade = 1; upgraded += 1 }
    const rewards = types.cards.filter(card => card.reward)
    for (let i = 0; i < 3; i += 1) deck.push({ instanceId: 'x/card/' + (100 + i), definitionId: rewards[(seed * 3 + i * 5) % rewards.length].id, upgrade: 0 })
    const heroes = { warrior: { ...run.heroes.warrior }, mage: { ...run.heroes.mage } }
    heroes.warrior.health = Math.round(heroes.warrior.maxHealth * 0.75); heroes.mage.health = Math.round(heroes.mage.maxHealth * 0.75)
    return { heroes, deck }
  }
  function fight(elite, strategy, kind, seed) {
    const { heroes, deck } = party(kind, seed)
    const state = campaign.createCampaignBattle({ encounter: lab.labEncounter(eco, elite), economy: eco, deck, heroes, seed, battleId: `exp/${elite}/${strategy}/${kind}/${seed}` })
    return lab.runFight(state, lab.createChooser(strategy))
  }
  if (command === 'elites') {
    const rows = []
    for (const elite of lab.eliteIds.filter(id => !only || id.includes(only))) for (const kind of ['start', 'mid']) for (const strategy of flag('--strategies', lab.labStrategies.join(',')).split(',')) {
      const fights = []
      for (let seed = 1; seed <= seeds; seed += 1) fights.push(fight(elite, strategy, kind, seed))
      const wins = fights.filter(f => f.result === 'victory')
      const interruptTurns = fights.flatMap(f => f.log.filter(t => t.traits.interrupt && t.strike))
      const startHp = kind === 'start' ? 43 : 32
      rows.push({
        elite: elite.replace('old-mines-', ''), party: kind, strategy, seeds,
        win: r(wins.length / seeds), timeouts: fights.filter(f => f.result === 'timeout').length,
        turns: r(mean(fights.map(f => f.turns)), 1), turnsWon: r(mean(wins.map(f => f.turns)), 1),
        lostV: r(mean(fights.map(f => f.lost.warrior)), 1), lostJ: r(mean(fights.map(f => f.lost.mage)), 1), lostTotal: r(mean(fights.map(f => f.lost.warrior + f.lost.mage)), 1),
        lostTotalWon: r(mean(wins.map(f => f.lost.warrior + f.lost.mage)), 1),
        // A close call: a hero fell to 4 HP or less at some point of a won fight.
        closeCalls: r(wins.length ? wins.filter(f => f.lowest.warrior <= 4 || f.lowest.mage <= 4).length / wins.length : 0),
        peakTurnLoss: r(mean(fights.map(f => Math.max(0, ...f.log.map(t => t.lost.warrior + t.lost.mage)))), 1),
        interruptBroken: interruptTurns.length ? r(interruptTurns.filter(t => t.interruptBroken).length / interruptTurns.length) : null,
        armorWastedPerFight: r(mean(fights.map(f => f.log.reduce((s, t) => s + t.armorWasted, 0))), 1),
        frostShare: r(mean(fights.map(f => f.log.some(t => t.frostApplied) ? 1 : 0))),
        endPower: r(mean(fights.map(f => f.log.at(-1)?.enemyPower ?? 0)), 1), startHp,
      })
    }
    await writeFile(`${output}/elites.json`, JSON.stringify(rows, null, 1) + '\n')
    for (const row of rows) console.log(row.elite.padEnd(12), row.party.padEnd(5), row.strategy.padEnd(15), 'win', row.win, 'turns', row.turns, 'lostV/J', row.lostV, row.lostJ, 'tot', row.lostTotal, 'close', row.closeCalls, 'brk', row.interruptBroken, 'pwr', row.endPower)
  }
  const gen = await load('dungeonGenerator'), long = await load('sectorLong')
  const versions = { v1: long.sectorLongConfig, v2: long.sectorLongConfigV2 }
  const share = (items, test) => items.length ? items.filter(test).length / items.length : 0
  const tally = values => values.reduce((all, v) => { all[v] = (all[v] ?? 0) + 1; return all }, {})
  if (command === 'maps') {
    // Generation only: how the rooms and the two elites spread over many seeds, and whether some route is simply the best one.
    const maps = Number(flag('--maps', 500)), rows = []
    for (const [version, config] of Object.entries(versions)) {
      const per = []
      for (let seed = 1; seed <= maps; seed += 1) {
        const map = campaign.createSectorRun(seed, eco, decks.honestDeck('armor8', true), config, 'm' + seed).map
        const nodes = map.layers.flat(), routes = gen.sectorPaths(map)
        const count = (route, type) => route.filter(n => n.type === type).length
        const elites = [...new Set(nodes.filter(n => n.type === 'elite').map(n => n.encounterId))]
        const dinner = nodes.find(n => n.eventId === 'suspicious-dinner')
        const profile = route => ({ forge: count(route, 'forge'), treasure: count(route, 'treasure'), event: count(route, 'event'), rest: count(route, 'rest'), elite: count(route, 'elite'), battle: count(route, 'battle') })
        const profiles = routes.map(profile)
        // A route dominates another when it has at least as much of everything good (forge, treasure, event, rest) and no more fighting; ties do not count.
        const dominates = (a, b) => a.forge >= b.forge && a.treasure >= b.treasure && a.event >= b.event && a.rest >= b.rest && a.battle + a.elite <= b.battle + b.elite && (a.forge > b.forge || a.treasure > b.treasure || a.event > b.event || a.rest > b.rest || a.battle + a.elite < b.battle + b.elite)
        const best = profiles.filter(p => !profiles.some(q => dominates(q, p)))
        per.push({
          events: nodes.filter(n => n.type === 'event').length, eventIds: nodes.filter(n => n.eventId).map(n => n.eventId), elites, eliteNodes: nodes.filter(n => n.type === 'elite').length,
          dinnerOnMap: !!dinner, dinnerRoutes: dinner ? share(routes, route => route.some(n => n.id === dinner.id)) : 0,
          routes: routes.length, routesWithEvent: share(routes, route => route.some(n => n.type === 'event')), routesWithElite: share(routes, route => route.some(n => n.type === 'elite')),
          routesWithoutElite: routes.filter(route => !route.some(n => n.type === 'elite')).length,
          routesForgeCount: tally(routes.map(route => count(route, 'forge'))), undominated: best.length, undominatedShare: best.length / profiles.length,
          eventsOnRoute: routes.map(route => count(route, 'event')), forgeOnRoute: routes.map(route => count(route, 'forge')), treasureOnRoute: routes.map(route => count(route, 'treasure')), restOnRoute: routes.map(route => count(route, 'rest')),
          noEliteRoutes: routes.filter(route => !route.some(n => n.type === 'elite')).map(route => ({ forge: count(route, 'forge'), event: count(route, 'event'), treasure: count(route, 'treasure') })), distinctProfiles: new Set(profiles.map(p => JSON.stringify(p))).size,
          dinnerAlternatives: dinner ? share(routes.filter(route => route.some(n => n.id === dinner.id)), route => route.some(n => n.type === 'rest' && n.layer === 4)) : null,
        })
      }
      const all = per.flatMap(p => p.eventIds)
      rows.push({
        version, maps,
        eventsPerMap: r(mean(per.map(p => p.events)), 2), mapsWithoutEvent: r(share(per, p => p.events === 0)),
        routesWithEvent: r(mean(per.map(p => p.routesWithEvent))), meanEventsPerRoute: r(mean(per.flatMap(p => p.eventsOnRoute)), 2),
        eventShare: Object.fromEntries(Object.entries(tally(all)).map(([k, v]) => [k, r(v / all.length)])),
        mapsWithEvent: Object.fromEntries(['forgotten-forge', 'powder-store', 'goblin-trade', 'suspicious-dinner'].map(id => [id, r(share(per, p => p.eventIds.includes(id)))])),
        dinnerOnMap: r(share(per, p => p.dinnerOnMap)), dinnerOnRoute: r(mean(per.filter(p => p.dinnerOnMap).map(p => p.dinnerRoutes))), dinnerOnRouteOfAllMaps: r(mean(per.map(p => p.dinnerRoutes))),
        mapsWithElite: r(share(per, p => p.eliteNodes > 0)), eliteNodesPerMap: r(mean(per.map(p => p.eliteNodes)), 2),
        johnsonMaps: r(share(per, p => p.elites.includes('old-mines-johnson'))), foremanMaps: r(share(per, p => p.elites.includes('old-mines-thistlenettle'))), twoElitesOnAMap: per.filter(p => p.elites.length > 1).length,
        routesWithElite: r(mean(per.map(p => p.routesWithElite))), mapsEveryRouteHasElite: per.filter(p => p.routesWithoutElite === 0).length,
        meanForgePerRoute: r(mean(per.flatMap(p => p.forgeOnRoute)), 2), meanTreasurePerRoute: r(mean(per.flatMap(p => p.treasureOnRoute)), 2), meanRestPerRoute: r(mean(per.flatMap(p => p.restOnRoute)), 2),
        routesWithForge: r(share(per.flatMap(p => p.forgeOnRoute), v => v > 0)), routesWithTwoForges: r(share(per.flatMap(p => p.forgeOnRoute), v => v > 1)),
        noEliteRoutesWithForge: r(share(per.flatMap(p => p.noEliteRoutes), x => x.forge > 0)), noEliteRoutesWithForgeOrEvent: r(share(per.flatMap(p => p.noEliteRoutes), x => x.forge + x.event > 0)),
        mapsWhereNoEliteRouteHasTwoForges: r(share(per, p => !p.noEliteRoutes.some(x => x.forge > 1))),
        meanRoutes: r(mean(per.map(p => p.routes)), 1), distinctProfiles: r(mean(per.map(p => p.distinctProfiles)), 1),
        undominatedShare: r(mean(per.map(p => p.undominatedShare))), mapsWithOneBestRoute: r(share(per, p => p.undominated === 1)),
      })
    }
    await writeFile(`${output}/maps.json`, JSON.stringify(rows, null, 1) + '\n')
    console.log(JSON.stringify(rows, null, 1))
  }
  if (command === 'runs') {
    // Whole runs through the real rules by route policy and bot: which elite was met, what the dinner was used for, how the party fared.
    const n = Number(flag('--runs', 200)), rows = []
    const strategies = flag('--strategies', 'planner,planner-careful,balanced').split(',')
    const deck = decks.honestDeck('armor8', true)
    for (const [version, config] of Object.entries(versions)) for (const strategy of strategies) for (const policy of ['safe', 'mixed', 'risky']) {
      const logs = []
      for (let seed = 1; seed <= n; seed += 1) logs.push(lab.simulateSectorRun(seed, eco, deck, strategy, policy, config))
      const eliteFights = logs.flatMap(l => l.battles.filter(b => b.node === 'elite'))
      const dinners = logs.flatMap(l => (l.rooms ?? []).filter(room => room.event === 'suspicious-dinner'))
      const byElite = id => eliteFights.filter(b => b.enemy === id)
      const won = logs.filter(l => l.result === 'victory')
      rows.push({
        version, strategy, policy, runs: n, win: r(won.length / n), hpBeforeBoss: r(mean(logs.filter(l => l.healthBeforeBoss).map(l => l.healthBeforeBoss.warrior + l.healthBeforeBoss.mage)), 1),
        eliteRuns: r(share(logs, l => (l.elites ?? 0) > 0)), johnsonFights: byElite('old-mines-johnson').length, foremanFights: byElite('old-mines-thistlenettle').length,
        johnsonWin: r(share(byElite('old-mines-johnson'), b => b.fight.result === 'victory')), foremanWin: r(share(byElite('old-mines-thistlenettle'), b => b.fight.result === 'victory')),
        johnsonLost: r(mean(byElite('old-mines-johnson').map(b => b.fight.lost.warrior + b.fight.lost.mage)), 1), foremanLost: r(mean(byElite('old-mines-thistlenettle').map(b => b.fight.lost.warrior + b.fight.lost.mage)), 1),
        eventsVisited: r(mean(logs.map(l => (l.rooms ?? []).filter(room => room.type === 'event').length)), 2), dinnerRuns: r(share(logs, l => (l.rooms ?? []).some(room => room.event === 'suspicious-dinner'))),
        dinnerChoice: tally(dinners.map(room => room.action)),
        died: tally(logs.filter(l => l.result === 'defeat').map(l => l.battles.at(-1).enemy.replace('old-mines-', ''))),
      })
    }
    await writeFile(`${output}/runs.json`, JSON.stringify(rows, null, 1) + '\n')
    for (const row of rows) console.log(row.version, row.strategy.padEnd(15), row.policy.padEnd(6), 'win', row.win, 'hpBoss', row.hpBeforeBoss, 'elite', row.eliteRuns, 'J', row.johnsonFights, row.johnsonWin, row.johnsonLost, 'F', row.foremanFights, row.foremanWin, row.foremanLost, 'dinner', row.dinnerRuns, JSON.stringify(row.dinnerChoice))
  }
} finally { await server.close() }
