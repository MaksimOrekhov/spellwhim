import { createServer } from 'vite'

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const { combatScenarios, runCombatScenario, runStrategyComparison } = await server.ssrLoadModule('/src/game/scenarios.ts')
  const seed = Number(process.argv[2] ?? 42) >>> 0
  console.table(combatScenarios.map(scenario => {
    const result = runCombatScenario(scenario, seed)
    return { scenario: result.name, seed, damage: result.damage, mana: result.manaSpent, brannHP: result.health.brann, liraHP: result.health.lira, drawn: result.drawn, rejected: result.rejected.join(', '), result: result.result ?? 'ongoing' }
  }))
  console.log('Стратегии по противникам:')
  console.table(runStrategyComparison(seed).map(result => ({ encounter: result.encounter, strategy: result.strategy, seed, turns: result.turns, damage: result.damage, brannHP: result.hp.warrior, liraHP: result.hp.mage, result: result.result, choices: result.choices.join(' → ') })))
} finally {
  await server.close()
}
