/**
 * Combo reachability: for random opening hands of the real starting deck, what is the best single turn
 * (exhaustive search over every ordering) as a function of available mana? Answers "which combos are
 * impossible at 3 mana?" without any bot heuristics. Draw effects are ignored (empty piles) => lower bound.
 *
 *   vite-node research/mana/reach.ts [--hands 400] [--seed 1000]
 */
import { createBattle } from '../../src/game/battle'
import { cardDefinition, encounters, startingDeck } from '../../src/game/types'
import { cfg } from './suites'
import { cloneCtx, tryPlay } from './core'
import type { Ctx } from './core'

const argv = process.argv.slice(2)
const opt = (name: string, fallback: number) => { const i = argv.indexOf('--' + name); return i >= 0 ? Number(argv[i + 1]) : fallback }
const hands = opt('hands', 400)
const seed0 = opt('seed', 1000)

interface Best { links: number; markLinks: number; resonanceLinks: number; damage: number; cards: number; bothDirections: boolean }

function search(root: Ctx): Best {
  const best: Best = { links: 0, markLinks: 0, resonanceLinks: 0, damage: 0, cards: 0, bothDirections: false }
  const seen = new Set<string>()
  const walk = (ctx: Ctx, stats: { mark: number; res: number; damage: number; cards: number }) => {
    const links = stats.mark + stats.res
    if (links > best.links || (links === best.links && stats.damage > best.damage)) best.links = links
    best.markLinks = Math.max(best.markLinks, stats.mark)
    best.resonanceLinks = Math.max(best.resonanceLinks, stats.res)
    if (stats.damage > best.damage) { best.damage = stats.damage; best.cards = stats.cards }
    if (stats.mark > 0 && stats.res > 0) best.bothDirections = true
    const tried = new Set<string>()
    for (const card of ctx.s.hand) {
      if (tried.has(card.definitionId) || cardDefinition(card.definitionId).cost > ctx.s.mana) continue
      tried.add(card.definitionId)
      const child = cloneCtx(ctx)
      const result = tryPlay(child, card.instanceId)
      if (!result.ok) continue
      const next = { mark: stats.mark + (result.outcome.links.includes('Магическая метка') ? 1 : 0), res: stats.res + (result.outcome.links.includes('Защитный резонанс') ? 1 : 0), damage: stats.damage + result.damageDealt, cards: stats.cards + 1 }
      const key = [child.s.mana, child.s.hand.map(c => c.definitionId).sort().join(','), Object.keys(child.s.statuses).sort().join(''), next.mark, next.res, next.damage].join('|')
      if (seen.has(key)) continue
      seen.add(key)
      walk(child, next)
    }
  }
  walk(root, { mark: 0, res: 0, damage: 0, cards: 0 })
  return best
}

const encounter = { ...encounters[2]!, maxHealth: 999 }
const settings: [number, number][] = [[3, 0], [3, 1], [3, 2], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]]
const rows = settings.map(([m, echo]) => {
  const results: Best[] = []
  for (let i = 0; i < hands; i += 1) {
    const state = createBattle(encounter, undefined, { seed: seed0 + i, deck: startingDeck })
    state.drawPile = []
    state.discardPile = []
    state.maxMana = m
    state.mana = m
    const ctx: Ctx = { s: state, cfg: cfg('reach', 'A'), encounter: 2, discounts: echo, turnDamage: 0 }
    results.push(search(ctx))
  }
  const mean = (f: (b: Best) => number) => results.reduce((s, b) => s + f(b), 0) / results.length
  const share = (f: (b: Best) => boolean) => results.filter(f).length / results.length * 100
  return { mana: m + (echo ? ' + эхо ×' + echo : ''), links: mean(b => b.links), p1: share(b => b.links >= 1), p2: share(b => b.links >= 2), p3: share(b => b.links >= 3), both: share(b => b.bothDirections), damage: mean(b => b.damage), cards: mean(b => b.cards) }
})
console.log(`Достижимость связок за один ход: ${hands} случайных стартовых рук по 8 карт, перебор всех порядков (без добора)`)
console.log('')
console.log('| мана | макс. связок за ход (среднее) | рук, где ≥1 связка % | ≥2 связок % | ≥3 связок % | обе связки (метка и резонанс) за ход % | макс. урон за ход | карт в плане макс. урона |')
console.log('|---|---|---|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.mana} | ${r.links.toFixed(2)} | ${r.p1.toFixed(0)} | ${r.p2.toFixed(0)} | ${r.p3.toFixed(0)} | ${r.both.toFixed(0)} | ${r.damage.toFixed(1)} | ${r.cards.toFixed(1)} |`)
