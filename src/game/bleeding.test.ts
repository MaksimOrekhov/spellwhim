import { describe, expect, it } from 'vitest'
import { createBattle, endTurn, forecastEnemyAction, playCard, previewCard, resolveCardPlay, startCardPlay } from './battle'
import { createTurnPlanner } from './balancePlanner'
import { applyStatus, lifetimeTickDamage, pendingTickDamage, statusSignature, statusValue } from './statuses'
import { artifactDefinitions } from './artifacts'
import { eliteEncounterCatalogV10, normalEncounterCatalogV10 } from './encountersV10'
import { cardDefinition, cards, startingDeck } from './types'
import type { BattleState, CardId, EncounterDefinition } from './types'

const dummy = (health: number): EncounterDefinition => ({
  id: 'dummy', name: 'Чучело', title: 'Мишень', maxHealth: health, appearance: 'defias', mapLabel: 'тест',
  behavior: { phase1: [{ kind: 'attack', name: 'Тычок', damage: 3, target: 'warrior' }] },
})
function fight(health = 40, hand: CardId[] = [], encounter: EncounterDefinition = dummy(health)): BattleState {
  const state = createBattle(encounter, undefined, { seed: 3 })
  state.hand = hand.map((id, index) => ({ instanceId: `t/${index}`, definitionId: id }))
  state.mana = state.maxMana = 10
  return state
}
const bleed = (state: BattleState) => statusValue(state, 'enemy', 'bleeding')

describe('Bleeding rules', () => {
  it('stacks by adding, up to the cap of 5, and only enemies can carry it', () => {
    const state = fight()
    expect(applyStatus(state, 'enemy', 'bleeding', 2).value).toBe(2)
    expect(applyStatus(state, 'enemy', 'bleeding', 2).value).toBe(4)
    expect(applyStatus(state, 'enemy', 'bleeding', 5).value).toBe(5)
    expect(applyStatus(state, 'mage', 'bleeding', 2).applied).toBe(false)
  })

  it('Rend hits first and applies Bleeding only if the enemy survives', () => {
    const state = fight(40, ['rend'])
    playCard(state, 't/0')
    expect(state.enemy.health).toBe(35)
    expect(bleed(state)).toBe(3)
    const lethal = fight(5, ['rend'])
    playCard(lethal, 't/0')
    expect(lethal.result).toBe('victory')
    expect(bleed(lethal)).toBe(0)
  })

  it('ticks at the start of the enemy turn, ignores armor, decays by one and ends at zero', () => {
    const state = fight(40)
    state.enemy.armor = 5
    applyStatus(state, 'enemy', 'bleeding', 2)
    expect(pendingTickDamage(state, 'enemy')).toBe(2)
    endTurn(state)
    expect(state.enemy.health).toBe(38)
    expect(state.enemy.armor).toBe(5)
    expect(bleed(state)).toBe(1)
    endTurn(state)
    expect(state.enemy.health).toBe(37)
    expect(bleed(state)).toBe(0)
    expect(state.statuses.enemy).toEqual([])
    endTurn(state)
    expect(state.enemy.health).toBe(37)
  })

  it('can kill the enemy before its action, so the heroes take no damage', () => {
    const state = fight(3)
    applyStatus(state, 'enemy', 'bleeding', 3)
    const before = state.heroes.warrior.health
    expect(endTurn(state)).toBe(true)
    expect(state.result).toBe('victory')
    expect(state.heroes.warrior.health).toBe(before)
    expect(state.statuses.enemy).toEqual([])
  })

  it('moves the enemy into phase 2 through the tick, finishes the announced action and then starts the new pattern', () => {
    const chief = eliteEncounterCatalogV10.find(item => item.id === 'goblin-foundry-chief')!
    const state = fight(0, [], chief)
    state.enemy.health = 40
    applyStatus(state, 'enemy', 'bleeding', 3)
    expect(state.enemy.phase).toBe(1)
    endTurn(state)
    expect(state.enemy.health).toBe(37)
    expect(state.enemy.phase).toBe(2)
    // The announced preparation still resolves into its strike; the phase 2 pattern starts right after it.
    expect(state.enemy.nextAction.kind).toBe('attack_all')
    state.heroes.warrior.health = state.heroes.mage.health = 1000
    endTurn(state)
    expect(state.enemy.nextAction).toEqual(state.enemy.behavior.phase2![0])
    expect(state.enemy.nextActionPhase).toBe(2)
  })

  it('executes exactly the health loss that the forecast showed after the tick', () => {
    const state = fight(40)
    applyStatus(state, 'enemy', 'bleeding', 2)
    const forecast = forecastEnemyAction(state)
    const before = state.heroes.warrior.health
    endTurn(state)
    expect(before - state.heroes.warrior.health).toBe(forecast.targets[0]!.healthLoss)
  })
})

describe('Reaping Blow (immediate use) and Boil Blood (earlier tick)', () => {
  it('adds 2 per point of Bleeding to its hit, takes the whole status, and itemises the hit in rule order', () => {
    const state = fight(60, ['reaping-blow'])
    applyStatus(state, 'enemy', 'bleeding', 3)
    applyStatus(state, 'enemy', 'vulnerability')
    const preview = previewCard(state, cardDefinition('reaping-blow'))
    expect(preview.damage).toBe(4 + 3 + 6)
    expect(preview.damageParts.map(part => part.id)).toEqual(['card', 'vulnerability', 'bleeding-burst'])
    const result = playCard(state, 't/0')
    expect(result.ok && result.damageDealt).toBe(13)
    expect(state.enemy.health).toBe(47)
    expect(bleed(state)).toBe(0)
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(0)
  })

  it('is no double win: the spent Bleeding never ticks afterwards', () => {
    const state = fight(60, ['reaping-blow'])
    applyStatus(state, 'enemy', 'bleeding', 4)
    playCard(state, 't/0')
    const health = state.enemy.health
    endTurn(state)
    expect(state.enemy.health).toBe(health)
  })

  it('goes through enemy armor like any card hit, and still spends Bleeding when armor soaks it all', () => {
    const state = fight(60, ['reaping-blow'])
    state.enemy.armor = 8
    applyStatus(state, 'enemy', 'bleeding', 3)
    const preview = previewCard(state, cardDefinition('reaping-blow'))
    expect(preview.armorDamage).toBe(8)
    expect(preview.healthDamage).toBe(2)
    playCard(state, 't/0')
    expect(bleed(state)).toBe(0)
    expect(state.enemy.armor).toBe(0)
    const soaked = fight(60, ['reaping-blow'])
    soaked.enemy.armor = 8
    applyStatus(soaked, 'enemy', 'bleeding', 1)
    playCard(soaked, 't/0')
    expect(soaked.enemy.health).toBe(60)
    expect(bleed(soaked)).toBe(0)
  })

  it('is a plain 4-damage card without Bleeding and spends nothing', () => {
    const state = fight(60, ['reaping-blow'])
    expect(previewCard(state, cardDefinition('reaping-blow')).damage).toBe(4)
    playCard(state, 't/0')
    expect(state.enemy.health).toBe(56)
  })

  it('Boil Blood runs the tick now, through armor, and the total Bleeding damage does not grow', () => {
    const natural = fight(80)
    applyStatus(natural, 'enemy', 'bleeding', 4)
    for (let turn = 0; turn < 5; turn += 1) endTurn(natural)
    const boosted = fight(80, ['boil-blood'])
    boosted.enemy.armor = 6
    applyStatus(boosted, 'enemy', 'bleeding', 4)
    const preview = previewCard(boosted, cardDefinition('boil-blood'))
    expect(preview.statusDamage).toBe(4)
    expect(preview.damage).toBe(0)
    playCard(boosted, 't/0')
    expect(boosted.hand).toHaveLength(1)
    expect(boosted.enemy.health).toBe(76)
    expect(boosted.enemy.armor).toBe(6)
    expect(bleed(boosted)).toBe(3)
    for (let turn = 0; turn < 5; turn += 1) endTurn(boosted)
    expect(boosted.enemy.health).toBe(natural.enemy.health)
    expect(lifetimeTickDamage('bleeding', 4)).toBe(10)
  })

  it('Boil Blood does nothing without Bleeding but cost its mana', () => {
    const state = fight(40, ['boil-blood'])
    playCard(state, 't/0')
    expect(state.enemy.health).toBe(40)
    expect(state.mana).toBe(9)
  })

  it('can finish the enemy, which ends the fight at once', () => {
    const state = fight(3, ['boil-blood'])
    applyStatus(state, 'enemy', 'bleeding', 3)
    playCard(state, 't/0')
    expect(state.result).toBe('victory')
  })

  it('resolves once: a repeated action id changes nothing', () => {
    const state = fight(60, ['rend'])
    const started = startCardPlay(state, 't/0')
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(resolveCardPlay(state, started.play.actionId).ok).toBe(true)
    const snapshot = JSON.stringify(state)
    expect(resolveCardPlay(state, started.play.actionId).ok).toBe(false)
    expect(JSON.stringify(state)).toBe(snapshot)
    expect(bleed(state)).toBe(3)
  })

  it('previews exactly the lifetime damage that a Rend adds to the Bleeding already there', () => {
    const state = fight(60, ['rend'])
    expect(previewCard(state, cardDefinition('rend')).statusFuture).toBe(6)
    applyStatus(state, 'enemy', 'bleeding', 2)
    expect(previewCard(state, cardDefinition('rend')).statusFuture).toBe(lifetimeTickDamage('bleeding', 5) - lifetimeTickDamage('bleeding', 2))
  })
})

describe('Bleeding with the rest of the game', () => {
  it('works with every artifact: the same Bleeding damage with each of the five', () => {
    for (const artifact of artifactDefinitions) {
      const state = fight(50, ['rend', 'reaping-blow'])
      state.artifacts.push({ instanceId: 'a', definitionId: artifact.id, ownerInstanceId: state.heroes.warrior.instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false })
      playCard(state, 't/0')
      const health = state.enemy.health
      endTurn(state)
      expect(state.enemy.health, artifact.id).toBe(health - 3)
      expect(bleed(state), artifact.id).toBe(2)
    }
  })

  it('keeps Bleeding in the planner key and keeps copies of the state independent', () => {
    const a = fight(40)
    const b = structuredClone(a)
    applyStatus(a, 'enemy', 'bleeding', 2)
    applyStatus(b, 'enemy', 'bleeding', 3)
    expect(statusSignature(a)).not.toBe(statusSignature(b))
    const copy = structuredClone(a)
    applyStatus(copy, 'enemy', 'bleeding', 1)
    expect(bleed(a)).toBe(2)
  })

  it('plays complete battles with the new cards deterministically and finishes them', () => {
    const deck: CardId[] = [...startingDeck.slice(0, 14), 'rend', 'rend', 'reaping-blow', 'boil-blood']
    const run = () => {
      const state = createBattle(normalEncounterCatalogV10[1]!, undefined, { seed: 11, deck })
      const planner = createTurnPlanner()
      let turns = 0
      while (!state.result && turns < 30) {
        turns += 1
        for (let plays = 0; plays < 12 && !state.result; plays += 1) {
          const id = planner.next(state)
          if (!id || !playCard(state, id).ok) break
        }
        if (!state.result) endTurn(state)
      }
      return { result: state.result, turns, health: state.enemy.health, hp: [state.heroes.warrior.health, state.heroes.mage.health] }
    }
    const first = run()
    expect(first.result).not.toBeNull()
    expect(run()).toEqual(first)
  })

  it('adds reward cards only and keeps the starting deck as it was', () => {
    expect(startingDeck).toHaveLength(18)
    for (const id of ['rend', 'reaping-blow', 'boil-blood'] as const) {
      expect(startingDeck).not.toContain(id)
      expect(cards.find(card => card.id === id)!.reward).toBe(true)
    }
  })
})
