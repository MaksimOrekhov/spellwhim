import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const { combatScenarios, runCombatScenario } = await server.ssrLoadModule('/src/game/scenarios.ts')
  const seed = Number(process.argv[2] ?? 42) >>> 0
  console.table(combatScenarios.map(scenario => {
    const result = runCombatScenario(scenario, seed)
    return { scenario: result.name, seed, damage: result.damage, mana: result.manaSpent, brannHP: result.health.brann, liraHP: result.health.lira, drawn: result.drawn, rejected: result.rejected.join(', '), result: result.result ?? 'ongoing' }
  }))
} finally {
  await server.close()
}
