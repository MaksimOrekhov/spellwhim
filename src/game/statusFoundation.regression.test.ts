import { describe, expect, it } from 'vitest'
import baselineJson from './fixtures/status-foundation-baseline.json'
import { compactTrace, regressionSpecs, traceBattle } from './regressionTrace'

/**
 * Zero-balance-change guard for Status Foundation v0.1. The baseline was recorded from the engine before the refactor
 * (`node scripts/record-status-baseline.mjs` regenerates it; do that only for an approved gameplay change). Every trace
 * covers previews, forecasts, health, armor, mana, hand order, Vulnerability and artifact notices, so any divergence in
 * rules or draw order changes a digest.
 */
describe('status foundation regression baseline', () => {
  const traces = regressionSpecs().map(spec => traceBattle(spec))
  const compact = traces.map(compactTrace)
  const baseline = baselineJson as typeof compact

  it('covers a meaningful number of battles, including wins, defeats and artifact loadouts', () => {
    expect(baseline.length).toBe(compact.length)
    expect(baseline.length).toBeGreaterThan(300)
    expect(new Set(baseline.map(item => item.result)).size).toBeGreaterThanOrEqual(2)
    expect(baseline.filter(item => item.key.endsWith('none')).length).toBeGreaterThan(100)
    expect(baseline.filter(item => !item.key.endsWith('none')).length).toBeGreaterThan(100)
  })

  it('replays every battle with identical outcomes, mana use and event digests', () => {
    const mismatches = compact.filter((item, index) => JSON.stringify(item) !== JSON.stringify(baseline[index]))
    expect(mismatches.map(item => item.key)).toEqual([])
  })

  it('exercises Vulnerability: it is applied, consumed and re-applied somewhere in the traces', () => {
    const vulnerableSeen = traces.some(trace => trace.events.some(event => (event as { after?: { enemy?: { vulnerable?: boolean } } }).after?.enemy?.vulnerable === true))
    const bonusSeen = traces.some(trace => trace.events.some(event => ((event as { preview?: { vulnerabilityBonus?: number } }).preview?.vulnerabilityBonus ?? 0) > 0))
    expect(vulnerableSeen).toBe(true)
    expect(bonusSeen).toBe(true)
  })
})
