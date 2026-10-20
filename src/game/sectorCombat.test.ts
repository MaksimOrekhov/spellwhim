import { describe, expect, it } from 'vitest'
import { createCampaignBattle } from './campaign'
import { endTurn, forecastEnemyAction, playCard, previewCard } from './battle'
import { applyStatus } from './statuses'
import { rhahkZor, sectorEncounters, sectorOneEnemies } from './sectorContent'
import { cardDefinition } from './types'
import { publicIntent } from './observableIntent'

describe('sector I tactical contracts',()=>{
  it.each(sectorEncounters.map(e=>[e.name,e] as const))('%s uses the same preview and damage pipeline with armor and vulnerability',(_name,encounter)=>{
    const state=createCampaignBattle({encounter,deck:['fireball'],seed:42})
    state.enemy.armor=6
    applyStatus(state,'enemy','vulnerability')
    const hp=state.enemy.health,armor=state.enemy.armor,preview=previewCard(state,cardDefinition('fireball'))
    expect(playCard(state,state.hand[0]!.instanceId).ok).toBe(true)
    expect(hp-state.enemy.health).toBe(preview.healthDamage)
    expect(armor-state.enemy.armor).toBe(preview.armorDamage)
  })
  it('changes to phase II without retargeting the announced preparation or revealed blow',()=>{
    const state=createCampaignBattle({encounter:rhahkZor,deck:['fireball'],seed:42})
    endTurn(state)
    const announced=structuredClone(state.enemy.nextAction)
    expect(announced.kind).toBe('prepare')
    state.enemy.health=34
    playCard(state,state.hand[0]!.instanceId)
    expect(state.enemy.phase).toBe(2)
    expect(state.enemy.nextAction).toEqual(announced)
    endTurn(state)
    if(announced.kind!=='prepare') throw Error('Fixture')
    expect(state.enemy.nextAction).toEqual(announced.prepared)
    const forecast=forecastEnemyAction(state)
    const hp=state.heroes.warrior.health
    endTurn(state)
    expect(hp-state.heroes.warrior.health).toBe(forecast.targets.find(t=>t.target==='warrior')!.healthLoss)
    expect(state.enemy.nextAction).toEqual(rhahkZor.behavior.phase2![0])
  })
  it('bleeding may kill the boss before its lethal announced blow',()=>{
    const state=createCampaignBattle({encounter:rhahkZor,deck:['guard']})
    state.enemy.health=1;state.heroes.warrior.health=1
    applyStatus(state,'enemy','bleeding',1)
    endTurn(state)
    expect(state.result).toBe('victory')
    expect(state.heroes.warrior.health).toBe(1)
  })
  it('an unprotected hero death ends a sector fight',()=>{
    const state=createCampaignBattle({encounter:rhahkZor,deck:['guard']})
    state.heroes.warrior.health=1
    endTurn(state)
    expect(state.result).toBe('defeat')
  })
  it('the four ordinary openings ask different public tactical questions',()=>{
    const openings=sectorOneEnemies.map(encounter=>publicIntent(forecastEnemyAction(createCampaignBattle({encounter}))))
    expect(new Set(openings.map(i=>JSON.stringify(i))).size).toBe(4)
  })
})
