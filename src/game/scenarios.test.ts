import { describe, expect, it } from 'vitest'
import { combatScenarios, runCombatScenario, runStrategyComparison } from './scenarios'

describe('repeatable headless combat scenarios', () => {
  it.each(combatScenarios)('$name is repeatable', scenario => {
    expect(runCombatScenario(scenario, 42)).toEqual(runCombatScenario(scenario, 42))
  })
  it('offers a damage versus health tradeoff for three mana without changing boss stats', () => {
    const offense = runCombatScenario(combatScenarios[1]!)
    const defense = runCombatScenario(combatScenarios[2]!)
    expect(offense).toMatchObject({ damage: 17, manaSpent: 3, health: { lira: 12 } })
    expect(defense).toMatchObject({ damage: 10, manaSpent: 3, health: { lira: 16 } })
  })
  it('reports mana rejection, empty draws, victory and defeat', () => {
    expect(runCombatScenario(combatScenarios[4]!).rejected).toEqual(['mana'])
    expect(runCombatScenario(combatScenarios[5]!).drawn).toBe(0)
    expect(runCombatScenario(combatScenarios[7]!).result).toBe('victory')
    expect(runCombatScenario(combatScenarios[8]!).result).toBe('defeat')
  })
  it('compares distinct deterministic strategies against all encounters', () => {
    const first = runStrategyComparison(42)
    expect(runStrategyComparison(42)).toEqual(first)
    expect(runStrategyComparison(43)).toEqual(runStrategyComparison(43))
    expect(first).toHaveLength(9)
    for (const encounter of ['root-sentinel', 'twilight-guardian', 'twilight-heart']) {
      const results = first.filter(result => result.encounter === encounter)
      expect(new Set(results.map(result => result.choices.join(','))).size).toBeGreaterThan(1)
      expect(new Set(results.map(result => [result.turns, result.hp.warrior, result.hp.mage, result.result].join('/'))).size).toBeGreaterThan(1)
      expect(results.every(result => result.turns <= 13)).toBe(true)
    }
  })
})
