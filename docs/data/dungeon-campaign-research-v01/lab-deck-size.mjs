// Experiment A: starting deck size × opening hand against every v1.0 encounter at full health.
import { writeFileSync } from 'node:fs'
import { loadGame, playBattle, mean, fmt } from './lab-common.mjs'

const runs = Number(process.argv[2] ?? 40)
const strategies = (process.argv[3] ?? 'balanced,planner').split(',')
const g = await loadGame()
const rep = (id, n) => Array(n).fill(id)
const decks = {
  D18: [...g.types.startingDeck],
  D16: [...rep('sword-strike', 2), ...rep('guard', 2), 'parry', ...rep('shield-bash', 2), 'interpose', ...rep('fireball', 2), ...rep('frostbolt', 2), ...rep('arcane-insight', 2), ...rep('ice-ward', 2)],
  D14: [...rep('sword-strike', 2), ...rep('guard', 2), ...rep('shield-bash', 2), 'interpose', ...rep('fireball', 2), ...rep('frostbolt', 2), ...rep('ice-ward', 2), 'arcane-insight'],
  D12: [...rep('sword-strike', 2), ...rep('guard', 2), 'shield-bash', 'interpose', ...rep('fireball', 2), ...rep('frostbolt', 2), 'ice-ward', 'arcane-insight'],
}
const hands = (process.argv[4] ?? '8,7,6').split(',').map(Number)
const enemies = [...g.v10.normalEncounterCatalogV10.map(e => ({ ...e, group: 'normal' })), ...g.v10.eliteEncounterCatalogV10.map(e => ({ ...e, group: 'elite' })), { ...g.v10.finalEncounterV10, group: 'boss' }]
const rows = []
for (const [deckId, deck] of Object.entries(decks)) for (const hand of hands) for (const strategy of strategies) {
  const byGroup = { normal: [], elite: [], boss: [] }
  for (const enemy of enemies) for (let i = 0; i < runs; i += 1) {
    const state = g.rules.createBattle(enemy, undefined, { deck, seed: 1000 + i * 7919, economy: g.economy.gameEconomy, openingHandSize: hand, battleId: `lab/${deckId}/${hand}/${enemy.id}/${i}` })
    const m = playBattle(g, state, strategy)
    byGroup[enemy.group].push({ ...m, deckSize: deck.length })
  }
  for (const [group, list] of Object.entries(byGroup)) rows.push({
    deck: deckId, hand, strategy, group,
    win: fmt(100 * list.filter(m => m.result === 'victory').length / list.length),
    turns: fmt(mean(list.map(m => m.turns)), 2),
    hpLost: fmt(mean(list.map(m => m.lost.warrior + m.lost.mage))),
    varian: fmt(mean(list.map(m => m.lost.warrior))), jaina: fmt(mean(list.map(m => m.lost.mage))),
    manaLeft: fmt(mean(list.map(m => m.manaLeftPerTurn)), 2),
    starvedPct: fmt(100 * mean(list.map(m => m.starvedTurns / Math.max(1, m.turns)))),
    cycles: fmt(mean(list.map(m => m.drawn / m.deckSize)), 2),
    blocked: fmt(mean(list.map(m => m.blocked)), 2),
  })
  console.error('done', deckId, hand, strategy)
}
console.table(rows)
writeFileSync(new URL('./deck-size.json', import.meta.url), JSON.stringify(rows, null, 1))
await g.server.close()
