import { describe, expect, it } from 'vitest'
import { createBattle, endTurn, payCardCost, playCard, resolveCardEffect } from './battle'
import { useBattle } from '../composables/useBattle'
import { cards, encounters } from './types'

describe('battle rules', () => {
  it('spends mana and rejects a card that costs too much', () => {
    const state = createBattle()
    expect(playCard(state, cards[1]!).ok).toBe(true)
    expect(state.mana).toBe(1)
    expect(playCard(state, cards[1]!)).toEqual({ ok: false, reason: 'mana' })
    expect(state.mana).toBe(1)
  })

  it('spends mana when a card starts, then applies its effect on impact', () => {
    const state = createBattle()
    expect(payCardCost(state, cards[1]!)).toEqual({ ok: true })
    expect(state.mana).toBe(1)
    expect(state.enemy.health).toBe(30)

    expect(resolveCardEffect(state, cards[1]!)).toEqual({ ok: true, damage: 8 })
    expect(state.enemy.health).toBe(22)
  })

  it('carries party health into the next encounter and clears temporary armor', () => {
    const previous = createBattle()
    previous.heroes.warrior.health = 17
    previous.heroes.warrior.armor = 5
    const next = createBattle(encounters[0]!, previous.heroes)
    expect(next.heroes.warrior.health).toBe(17)
    expect(next.heroes.warrior.armor).toBe(0)
    expect(next.enemy.name).toBe('Корневой дозорный')
    expect(next.enemy.attack).toBe(4)
  })

  it('applies new reward card effects from their card data', () => {
    const state = createBattle()
    expect(playCard(state, cards.find(card => card.id === 'quick-cut')!)).toEqual({ ok: true, damage: 3 })
    expect(playCard(state, cards.find(card => card.id === 'bastion')!)).toEqual({ ok: true, armor: 6, partnerArmor: 3 })
    expect(state.enemy.health).toBe(27)
    expect(state.heroes.warrior.armor).toBe(6)
    expect(state.heroes.mage.armor).toBe(3)
  })

  it('lets Lira mark an enemy for Brann, who consumes the mark for damage and a draw', () => {
    const state = createBattle()
    const fireball = cards.find(card => card.id === 'fireball')!
    const sword = cards.find(card => card.id === 'sword-strike')!
    expect(playCard(state, fireball)).toEqual({ ok: true, damage: 8 })
    expect(state.enemy.marked).toBe(true)
    expect(playCard(state, sword)).toEqual({ ok: true, damage: 9, draw: 1 })
    expect(state.enemy.marked).toBe(false)
    expect(state.enemy.health).toBe(13)
  })

  it('lets defense protect the targeted hero and share armor with their partner', () => {
    const state = createBattle(encounters[0]!)
    const guard = cards.find(card => card.id === 'guard')!
    expect(state.enemy.intent).toBe('mage')
    expect(playCard(state, guard)).toEqual({ ok: true, armor: 4, partnerArmor: 2 })
    endTurn(state)
    expect(state.heroes.mage.health).toBe(18)
    expect(state.heroes.warrior.health).toBe(25)
    expect(state.heroes.mage.armor).toBe(0)
    expect(state.heroes.warrior.armor).toBe(0)
  })

  it('draws and discards cards between turns instead of repeating the full collection', () => {
    const battle = useBattle()
    battle.startBattle(encounters[0]!)
    expect(battle.cards.value).toHaveLength(3)
    expect(battle.drawCount.value).toBe(0)
    const played = battle.cards.value[0]!
    expect(battle.beginPlay(played)).toBe(true)
    battle.resolvePlay(played)
    expect(battle.cards.value).toHaveLength(2)
    expect(battle.discardCount.value).toBe(1)
    battle.finishTurn()
    expect(battle.cards.value).toHaveLength(3)
    expect(battle.state.value.turn).toBe(2)
  })

  it('deals damage and wins when the enemy reaches zero health', () => {
    const state = createBattle()
    state.enemy.health = 6
    expect(playCard(state, cards[0]!)).toEqual({ ok: true, damage: 6 })
    expect(state.enemy.health).toBe(0)
    expect(state.result).toBe('victory')
  })

  it('grants armor, absorbs incoming damage, and clears armor on the next player turn', () => {
    const state = createBattle()
    expect(playCard(state, cards[2]!)).toEqual({ ok: true, armor: 4, partnerArmor: 2 })
    expect(state.heroes.warrior.armor).toBe(4)
    expect(state.heroes.mage.armor).toBe(2)
    endTurn(state)
    expect(state.heroes.warrior.armor).toBe(0)
    expect(state.heroes.warrior.health).toBe(24)
    expect(state.heroes.mage.armor).toBe(0)
  })

  it('ends a turn, restores mana, and changes the announced target', () => {
    const state = createBattle()
    state.mana = 0
    endTurn(state)
    expect(state.mana).toBe(3)
    expect(state.turn).toBe(2)
    expect(state.enemy.intent).toBe('mage')
    expect(state.heroes.warrior.health).toBe(20)
  })

  it('defeats the player when the targeted hero loses all health', () => {
    const state = createBattle()
    state.enemy.intent = 'mage'
    state.heroes.mage.health = 5
    endTurn(state)
    expect(state.heroes.mage.health).toBe(0)
    expect(state.result).toBe('defeat')
    expect(playCard(state, cards[0]!)).toEqual({ ok: false, reason: 'finished' })
  })
})
