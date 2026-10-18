import { createServer } from 'vite'

const args = process.argv.slice(2)
const information = args.includes('--information') ? args[args.indexOf('--information') + 1] : 'public'
if (!['public', 'omniscient'].includes(information)) throw new Error('--information: public (default, fair) или omniscient (историческая диагностика: видит размер подготовленного удара)')
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const { combatScenarios, runCombatScenario, runStrategyComparison } = await server.ssrLoadModule('/src/game/scenarios.ts')
  const seed = Number(args.find(value => /^\d+$/.test(value)) ?? 42) >>> 0
  console.table(combatScenarios.map(scenario => {
    const result = runCombatScenario(scenario, seed)
    return { scenario: result.name, seed, damage: result.damage, mana: result.manaSpent, varianHP: result.health.varian, jainaHP: result.health.jaina, drawn: result.drawn, rejected: result.rejected.join(', '), result: result.result ?? 'ongoing' }
  }))
  console.log(`Стратегии по противникам (information: ${information}):`)
  console.table(runStrategyComparison(seed, information).map(result => ({ encounter: result.encounter, strategy: result.strategy, seed, turns: result.turns, damage: result.damage, varianHP: result.hp.warrior, jainaHP: result.hp.mage, result: result.result, choices: result.choices.join(' → ') })))
} finally {
  await server.close()
}
