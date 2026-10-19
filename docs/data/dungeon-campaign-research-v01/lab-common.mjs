// Shared loader for the dungeon redesign research labs. Read-only use of the game modules through Vite SSR.
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Repository root: three levels above this folder, or SPELLWHIM_ROOT when the labs are run from a copy. */
export const root = process.env.SPELLWHIM_ROOT ?? fileURLToPath(new URL('../../../', import.meta.url))
const fromRoot = path => pathToFileURL(root.replace(/[\/]?$/, '/') + path).href
export const loadRewardRank = async () => (await import(fromRoot('scripts/lib/dungeonRewardRank.mjs'))).dungeonRewardRank

export async function loadGame() {
  const { createServer } = await import(fromRoot('node_modules/vite/dist/node/index.js'))
  const server = await createServer({ root, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
  const load = path => server.ssrLoadModule(path)
  const [rules, types, economy, balance, planner, v10, campaign, statuses] = await Promise.all([
    load('/src/game/battle.ts'), load('/src/game/types.ts'), load('/src/game/economy.ts'), load('/src/game/balance.ts'),
    load('/src/game/balancePlanner.ts'), load('/src/game/encountersV10.ts'), load('/src/game/campaign.ts'), load('/src/game/statuses.ts'),
  ])
  return { server, rules, types, economy, balance, planner, v10, campaign, statuses }
}

/** Plays one battle to the end with a bot; returns metrics. `state` is mutated. */
export function playBattle(g, state, strategy) {
  const turnPlanner = strategy === 'planner' ? g.planner.createTurnPlanner() : undefined
  const start = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
  let turns = 0, cards = 0, manaLeft = 0, starvedTurns = 0, handStart = 0
  let drawn = state.hand.length
  while (!state.result && turns < 40) {
    turns += 1
    handStart += state.hand.length
    if (state.hand.length <= 2) starvedTurns += 1
    let plays = 0
    while (!state.result && plays < 14) {
      const id = turnPlanner?.next(state)
      const card = id ? state.hand.find(item => item.instanceId === id) : strategy === 'planner' ? undefined : g.balance.chooseCard(state, strategy, 'public')
      if (!card) break
      const before = state.hand.length
      const result = g.rules.playCard(state, card.instanceId)
      if (!result.ok) break
      drawn += result.drawn
      plays += 1; cards += 1
      void before
    }
    if (state.result) break
    manaLeft += state.mana
    const handBefore = state.hand.length
    g.rules.endTurn(state)
    if (!state.result) drawn += state.hand.length - handBefore
  }
  return {
    result: state.result ?? 'timeout', turns, cards,
    lost: { warrior: start.warrior - state.heroes.warrior.health, mage: start.mage - state.heroes.mage.health },
    manaLeftPerTurn: manaLeft / Math.max(1, turns), starvedTurns, handStart: handStart / Math.max(1, turns), drawn, blocked: state.blockedDraws,
  }
}

export const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
export const fmt = (value, digits = 1) => Number(value.toFixed(digits))
