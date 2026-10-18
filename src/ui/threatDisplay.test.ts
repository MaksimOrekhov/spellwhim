import { describe, expect, it } from 'vitest'
import { forecastEnemyAction, playCard } from '../game/battle'
import { battleScene, battleSceneIds } from './battleScenes'
import { heroThreats, intentSummary, lethalLater, lethalNow } from './threatDisplay'

const files = import.meta.glob('../components/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
/** Component source without comments, so the guards read code only. */
const source = (name: string) => files[`../components/${name}.vue`]!.replace(/\/\/[^\n]*/g, '').replace(/<!--[\s\S]*?-->/g, '')

describe('threat display model', () => {
  it('reads every number from the forecast, for every battle scene', () => {
    for (const id of battleSceneIds) {
      const state = battleScene(id)
      const forecast = forecastEnemyAction(state)
      const threats = heroThreats(forecast)
      for (const hit of [...forecast.targets, ...forecast.futureTargets]) {
        const threat = threats[hit.target]!
        expect(threat.healthLoss, id).toBe(hit.healthLoss)
        expect(threat.attack, id).toBe(hit.attack)
        expect(threat.absorbed, id).toBe(hit.absorbed)
        expect(threat.lethal, id).toBe(hit.lethal)
      }
    }
  })

  it('shows a hit on one hero, on both, and a prepared strike as a later threat', () => {
    const both = heroThreats(forecastEnemyAction(battleScene('both')))
    expect(Object.keys(both).sort()).toEqual(['mage', 'warrior'])
    expect(both.warrior!.timing).toBe('now')
    const prepared = forecastEnemyAction(battleScene('prepared'))
    const later = heroThreats(prepared)
    expect(prepared.targets).toHaveLength(0)
    expect(later.mage!.timing).toBe('later')
    expect(later.warrior).toBeUndefined()
    expect(intentSummary(prepared).later).toBe(true)
    expect(intentSummary(forecastEnemyAction(battleScene('both'))).later).toBe(false)
  })

  it('marks lethal strikes, and a prepared lethal strike only as a later one', () => {
    const lethal = forecastEnemyAction(battleScene('lethal'))
    expect(lethalNow(lethal)).toEqual(['mage'])
    const phase2 = forecastEnemyAction(battleScene('phase2'))
    expect(lethalNow(phase2)).toEqual([])
    expect(lethalLater(phase2)).toEqual(['warrior'])
    expect(phase2.phase).toBe(2)
  })

  it('shows a fully absorbed hit as blocked', () => {
    const absorbed = heroThreats(forecastEnemyAction(battleScene('absorbed')))
    expect(absorbed.warrior).toMatchObject({ blocked: true, healthLoss: 0, timing: 'now' })
  })

  it('changes the forecast after a protective card is played', () => {
    const state = battleScene('both')
    const before = heroThreats(forecastEnemyAction(state))
    const bastion = { instanceId: 'scene/bastion', definitionId: 'bastion' as const }
    state.hand = [bastion]
    expect(playCard(state, bastion.instanceId).ok).toBe(true)
    const after = heroThreats(forecastEnemyAction(state))
    expect(before.warrior!.healthLoss).toBeGreaterThan(0)
    expect(after.warrior!.blocked).toBe(true)
    expect(after.mage!.healthLoss).toBeLessThan(before.mage!.healthLoss)
  })
})

describe('battle scene components', () => {
  it('do no combat math: they never import the rules or the damage chain', () => {
    for (const name of ['HeroFrame', 'EnemyFrame', 'IntentBanner', 'VitalBar', 'ThreatRays', 'StatusChip']) {
      const text = source(name)
      expect(text, name).not.toMatch(/import (?!type)[^\n]*game\/(battle|damage|deck)'/)
      expect(text, name).not.toMatch(/splitDamage|composeHit|forecastEnemyAction/)
    }
  })

  it('keep the Pixi anchor protocol', () => {
    expect(source('HeroFrame')).toContain(':data-fx-anchor="hero.id"')
    expect(source('EnemyFrame')).toContain('data-fx-anchor="enemy"')
    expect(source('BattleBoard')).toContain('data-battle-scene')
  })
})
