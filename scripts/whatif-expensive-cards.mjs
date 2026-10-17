import { createServer } from 'vite'

/**
 * WHAT-IF ONLY. Adds the two expensive example cards of docs/mana-progression-research.md to the starting deck at run time
 * (in memory, for this process) and compares the Balance Lab numbers with and without them.
 * The game data in src/ is NOT changed; these cards are not part of the game and need a separate decision.
 */
const concept = [
  { id: 'blade-and-flame', name: 'Клинок и пламя', className: 'warrior', cost: 3, description: '8 урона, 4 брони цели; использует метку; создаёт резонанс.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 8 }, { type: 'armor', amount: 4, target: 'threatened' }, { type: 'status', status: 'resonance', durationTurns: 1 }] },
  { id: 'arcane-barrage', name: 'Арканный шквал', className: 'mage', cost: 4, description: '12 урона, добор; использует резонанс; создаёт метку.', icon: '✹', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 12 }, { type: 'draw', amount: 1 }, { type: 'status', status: 'mark', durationTurns: 1 }] },
]
const args = process.argv.slice(2)
const runs = Number(args[args.indexOf('--runs') + 1] || 300)
const seed = Number(args[args.indexOf('--seed') + 1] || 20000)
const configs = (args.includes('--configs') ? args[args.indexOf('--configs') + 1] : 'A,B,U').split(',')

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const { simulateBalance, summarizeEconomy } = await server.ssrLoadModule('/src/game/balance.ts')
  const { economyFromSpec } = await server.ssrLoadModule('/src/game/economy.ts')
  const types = await server.ssrLoadModule('/src/game/types.ts')
  const original = [...types.startingDeck]
  const variants = [['18 карт (игра)', []], ['+ Клинок и пламя (3)', ['blade-and-flame']], ['+ Арканный шквал (4)', ['arcane-barrage']], ['+ обе', ['blade-and-flame', 'arcane-barrage']]]
  for (const card of concept) types.cards.push({ ...card, reward: false })
  const f = (value, digits = 1) => Number(value).toFixed(digits)
  const rows = []
  for (const spec of configs) {
    const economy = economyFromSpec(spec)
    for (const [label, extra] of variants) {
      types.startingDeck.length = 0
      types.startingDeck.push(...original, ...extra)
      for (const strategy of ['balanced', 'planner']) {
        const results = simulateBalance({ runs, seed, strategies: [strategy], economy })
        const [summary] = summarizeEconomy(results, economy)
        const played = Object.fromEntries(extra.map(id => [id, results.reduce((sum, run) => sum + (run.cards[id]?.plays ?? 0), 0) / runs]))
        rows.push({
          config: spec, deck: label, strategy, 'win %': f(summary.wins / summary.runs * 100),
          'turns 1/2/3': summary.encounters.map(x => f(x.turns)).join(' / '),
          'mana spent/avail': f(summary.mana.spentPerTurn, 2) + ' / ' + f(summary.mana.availablePerTurn, 2),
          'cards/turn': f(summary.cardsPerTurn, 2), 'hand s→e': f(summary.handStart, 1) + '→' + f(summary.handEnd, 1),
          'links/turn': f(summary.linksPerTurn, 2), 'chains 3+ %': f(summary.linkChains[3] * 100, 1),
          'plays per run': extra.length ? Object.entries(played).map(([id, plays]) => id + ' ' + f(plays, 2)).join(', ') : '—',
        })
      }
    }
  }
  console.table(rows)
} finally {
  await server.close()
}
