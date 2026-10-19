// Experiment B: a longer run built from today's v1.0 enemies (stand-ins), with HP carry-over, deck growth and different heal rules.
// Linear paths only (route choice is studied separately). Nothing in the game changes: encounters are copied in memory.
import { writeFileSync } from 'node:fs'
import { loadGame, loadRewardRank, playBattle, mean, fmt } from './lab-common.mjs'

const runs = Number(process.argv[2] ?? 60)
const g = await loadGame()
const dungeonRewardRank = await loadRewardRank()
const normals = g.v10.normalEncounterCatalogV10
const [veteran, chief] = g.v10.eliteEncounterCatalogV10
const heart = g.v10.finalEncounterV10
const rewardPool = g.types.cards.filter(card => card.reward)
const rep = (id, n) => Array(n).fill(id)
const decks = {
  D18: [...g.types.startingDeck],
  D14: [...rep('sword-strike', 2), 'shield-bash', ...rep('guard', 2), 'parry', 'interpose', ...rep('fireball', 2), ...rep('frostbolt', 2), ...rep('ice-ward', 2), 'arcane-insight'],
}
const nDmg = Number(process.argv[4] ?? 1), nHp = Number(process.argv[5] ?? 1)
const scaleHit = (h, d) => h.kind === 'attack' || h.kind === 'attack_all' ? { ...h, damage: Math.max(1, Math.round(h.damage * d)) } : h
const scaleAction = (a, d) => a.kind === 'prepare' ? { ...a, prepared: scaleHit(a.prepared, d) } : scaleHit(a, d)
const scaled = (e, k, tag, d = 1) => ({ ...e, id: `${e.id}/${tag}`, maxHealth: Math.round(e.maxHealth * k), behavior: d === 1 ? e.behavior : { phase1: e.behavior.phase1.map(a => scaleAction(a, d)), ...(e.behavior.phase2 ? { phase2: e.behavior.phase2.map(a => scaleAction(a, d)) } : {}) } })
// Sector pools: 0 → first four normals, 1 → five, 2 → six. Health multiplier grows by sector.
const sectorPool = s => normals.slice(0, [4, 5, 6][s])
const sectorScale = [0.9, 1.0, 1.1]
// Paths: N normal, E elite, R rest, B boss of the sector (stand-ins: veteran ×1.25, chief ×1.3, heart).
const paths = {
  current7: ['N', 'R', 'E', 'N', 'E', 'R', 'B3'].map(x => x), // one typical current route (6 layers + final)
  short: ['N', 'N', 'R', 'E', 'N', 'B1', 'N', 'R', 'N', 'E', 'B3'],
  medium: ['N', 'N', 'E', 'R', 'N', 'B1', 'N', 'N', 'R', 'E', 'N', 'B2', 'N', 'E', 'R', 'N', 'B3'],
  // The structure recommended by the report: three sectors, a rest before every boss, 11 fights on this path.
  rec11: ['N', 'N', 'E', 'R', 'B1', 'N', 'N', 'R', 'B2', 'N', 'E', 'N', 'R', 'B3'],
  long: ['N', 'N', 'N', 'E', 'R', 'N', 'B1', 'N', 'N', 'E', 'R', 'N', 'N', 'B2', 'N', 'N', 'E', 'R', 'N', 'N', 'E', 'B3'],
}
const bossOf = { B1: scaled(veteran, 1.25, 'b1'), B2: scaled(chief, 1.3, 'b2'), B3: heart }
const heals = {
  fixed6: { rest: () => ({ one: 6 }), boss: 0 },
  pct30: { rest: () => ({ pct: 0.3 }), boss: 0 },
  pct30boss50: { rest: () => ({ pct: 0.3 }), boss: 0.5 },
  fixed6boss50: { rest: () => ({ one: 6 }), boss: 0.5 },
  split10boss50: { rest: () => ({ split: 10 }), boss: 0.5 },
}
function healParty(heroes, rule) {
  if (rule.split) {
    // Ten points shared by the player: the more wounded hero (by share of maximum) first, the remainder to the partner.
    let left = rule.split
    for (const id of ['warrior', 'mage'].sort((a, b) => heroes[a].health / heroes[a].maxHealth - heroes[b].health / heroes[b].maxHealth)) {
      const add = Math.min(left, heroes[id].maxHealth - heroes[id].health)
      heroes[id].health += add; left -= add
    }
  } else if (rule.one) {
    const target = ['warrior', 'mage'].sort((a, b) => heroes[a].health / heroes[a].maxHealth - heroes[b].health / heroes[b].maxHealth)[0]
    heroes[target].health = Math.min(heroes[target].maxHealth, heroes[target].health + rule.one)
  } else for (const id of ['warrior', 'mage']) heroes[id].health = Math.min(heroes[id].maxHealth, heroes[id].health + Math.round(heroes[id].maxHealth * rule.pct))
}

function simulate(seed, pathId, deckId, healId, strategy, skipBelow) {
  const path = paths[pathId]
  let deck = [...decks[deckId]]
  let heroes
  let fights = 0, elites = 0
  const lossByFight = []
  let rnd = seed >>> 0
  const rand = () => { rnd = (rnd + 0x6d2b79f5) >>> 0; let v = rnd; v = Math.imul(v ^ v >>> 15, v | 1); v ^= v + Math.imul(v ^ v >>> 7, v | 61); return ((v ^ v >>> 14) >>> 0) / 4294967296 }
  let sector = 0, last = ''
  for (const step of path) {
    if (step === 'R') { if (heroes) healParty(heroes, heals[healId].rest()); continue }
    let enemy
    if (step === 'N') { const pool = sectorPool(sector).filter(e => e.id !== last); const pick = pool[Math.floor(rand() * pool.length)]; last = pick.id; enemy = scaled(pick, sectorScale[sector] * nHp, `s${sector}`, nDmg) }
    else if (step === 'E') { enemy = scaled(elites % 2 === 0 ? veteran : chief, [0.9, 1.0, 1.1][sector], `e${sector}`); elites += 1 }
    else enemy = bossOf[step]
    const state = g.rules.createBattle(enemy, heroes, { deck, seed: (seed * 31 + fights * 977) >>> 0, economy: g.economy.gameEconomy, battleId: `long/${seed}/${fights}` })
    const before = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
    const m = playBattle(g, state, strategy)
    fights += 1
    lossByFight.push({ step, loss: m.lost.warrior + m.lost.mage, turns: m.turns })
    if (state.result !== 'victory') return { win: false, fights, diedAt: fights, step, deck: deck.length, lossByFight, bossHp: null }
    heroes = { warrior: { ...state.heroes.warrior, armor: 0 }, mage: { ...state.heroes.mage, armor: 0 } }
    void before
    if (step.startsWith('B')) {
      sector += 1
      const k = heals[healId].boss
      if (k) for (const id of ['warrior', 'mage']) heroes[id].health += Math.round((heroes[id].maxHealth - heroes[id].health) * k)
      if (step === 'B3') return { win: true, fights, deck: deck.length, lossByFight, endHp: heroes.warrior.health + heroes.mage.health }
    }
    // Reward: 3 cards (5 after an elite / boss); pick the best by the shared scripted rank, or skip if all are below the bar.
    const count = step === 'N' ? 3 : 5
    const offer = [...rewardPool].sort(() => rand() - 0.5).slice(0, count)
    const best = offer.sort((a, b) => dungeonRewardRank(b.id, strategy === 'planner' ? 'balanced' : strategy) - dungeonRewardRank(a.id, strategy === 'planner' ? 'balanced' : strategy))[0]
    if (dungeonRewardRank(best.id, 'balanced') >= skipBelow) deck = [...deck, best.id]
  }
  return { win: true, fights, deck: deck.length, lossByFight, endHp: heroes.warrior.health + heroes.mage.health }
}

const rows = []
const configs = (process.argv[3] ?? 'all').split(',')
for (const pathId of Object.keys(paths)) for (const deckId of Object.keys(decks)) for (const healId of Object.keys(heals)) for (const strategy of ['balanced', 'planner']) for (const skipBelow of [0, 6]) {
  if (configs[0] !== 'all' && !configs.includes(pathId)) continue
  if (pathId === 'current7' && healId !== 'fixed6') continue
  const list = Array.from({ length: runs }, (_, i) => simulate(5000 + i, pathId, deckId, healId, strategy, skipBelow))
  const normalLoss = list.flatMap(r => r.lossByFight.filter(f => f.step === 'N'))
  const early = list.flatMap(r => r.lossByFight.slice(0, 4).filter(f => f.step === 'N'))
  const late = list.flatMap(r => r.lossByFight.slice(-6).filter(f => f.step === 'N'))
  const deaths = list.filter(r => !r.win)
  rows.push({
    path: pathId, fights: paths[pathId].filter(s => s !== 'R').length, deck: deckId, heal: healId, strategy, skip: skipBelow ? 'rank<6' : 'never',
    win: fmt(100 * list.filter(r => r.win).length / list.length),
    diedOnBoss: fmt(100 * deaths.filter(r => r.step.startsWith('B')).length / list.length), diedOnElite: fmt(100 * deaths.filter(r => r.step === 'E').length / list.length), diedOnNormal: fmt(100 * deaths.filter(r => r.step === 'N').length / list.length),
    nLossEarly: fmt(mean(early.map(f => f.loss))), nLossLate: fmt(mean(late.map(f => f.loss))), nTurns: fmt(mean(normalLoss.map(f => f.turns)), 2),
    totalTurns: fmt(mean(list.filter(r => r.win).map(r => r.lossByFight.reduce((a, f) => a + f.turns, 0)))),
    finalDeck: fmt(mean(list.filter(r => r.win).map(r => r.deck))), endHp: fmt(mean(list.filter(r => r.win).map(r => r.endHp))),
  })
  console.error('done', pathId, deckId, healId, strategy, skipBelow)
}
console.table(rows)
writeFileSync(new URL(`./long-run-dmg${nDmg}-hp${nHp}.json`, import.meta.url), JSON.stringify(rows, null, 1))
await g.server.close()
