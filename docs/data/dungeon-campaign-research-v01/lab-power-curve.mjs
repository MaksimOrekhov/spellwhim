import { writeFileSync } from 'node:fs'
// Experiment C: how much stronger does the party get from card rewards alone? Same enemies, decks after 0 / 4 / 8 scripted picks.
import { loadGame, loadRewardRank, playBattle, mean, fmt } from './lab-common.mjs'

const runs = Number(process.argv[2] ?? 40)
const g = await loadGame()
const dungeonRewardRank = await loadRewardRank()
const pool = g.types.cards.filter(card => card.reward)
const enemies = [...g.v10.normalEncounterCatalogV10.map(e => ({ ...e, group: 'normal' })), ...g.v10.eliteEncounterCatalogV10.map(e => ({ ...e, group: 'elite' })), { ...g.v10.finalEncounterV10, group: 'boss' }]
function grow(seed, picks, mode) {
  let r = seed >>> 0
  const rand = () => { r = (r + 0x6d2b79f5) >>> 0; let v = r; v = Math.imul(v ^ v >>> 15, v | 1); v ^= v + Math.imul(v ^ v >>> 7, v | 61); return ((v ^ v >>> 14) >>> 0) / 4294967296 }
  const deck = [...g.types.startingDeck]
  const bleed = new Set(['rend', 'reaping-blow', 'boil-blood', 'wound-clamp', 'ice-echo', 'frost-seal', 'blood-resonance'])
  for (let i = 0; i < picks; i += 1) {
    const offer = [...pool].sort(() => rand() - 0.5).slice(0, 3)
    const score = c => dungeonRewardRank(c.id, 'balanced') + (mode === 'bleed' && bleed.has(c.id) ? 10 : 0)
    deck.push(offer.sort((a, b) => score(b) - score(a))[0].id)
  }
  // 'thin' removes the two weakest starters for every 4 picks (models a forge/removal service).
  if (mode === 'thin') for (const id of ['arcane-insight', 'arcane-insight', 'interpose', 'parry'].slice(0, Math.floor(picks / 2))) deck.splice(deck.indexOf(id), 1)
  return deck
}
const rows = []
for (const [picks, mode] of [[0, 'rank'], [4, 'rank'], [8, 'rank'], [8, 'thin'], [8, 'bleed']]) for (const strategy of ['balanced', 'planner']) {
  const by = { normal: [], elite: [], boss: [] }
  for (const enemy of enemies) for (let i = 0; i < runs; i += 1) {
    const deck = grow(777 + i * 13, picks, mode)
    const state = g.rules.createBattle(enemy, undefined, { deck, seed: 3000 + i * 7919, economy: g.economy.gameEconomy, battleId: `pc/${picks}/${enemy.id}/${i}` })
    by[enemy.group].push(playBattle(g, state, strategy))
  }
  for (const [group, list] of Object.entries(by)) rows.push({ picks, mode, strategy, group, deck: 18 + picks - (mode === 'thin' ? Math.floor(picks / 2) : 0), win: fmt(100 * list.filter(m => m.result === 'victory').length / list.length), turns: fmt(mean(list.map(m => m.turns)), 2), hpLost: fmt(mean(list.map(m => m.lost.warrior + m.lost.mage))) })
}
console.table(rows)
writeFileSync(new URL('./power-curve.json', import.meta.url), JSON.stringify(rows, null, 1))
await g.server.close()
