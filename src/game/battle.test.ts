import { describe, expect, it } from 'vitest'
import { createBattle, endTurn, hasStatus, playCard, previewCard, resolveCardPlay, startCardPlay } from './battle'
import { drawCards } from './deck'
import { cardDefinition, encounters, startingDeck } from './types'
import type { BattleState, CardId } from './types'
import { useBattle } from '../composables/useBattle'

function fixture(deck: CardId[], health = 100) {
  return createBattle({ ...encounters[1]!, maxHealth: health }, undefined, { deck, seed: 17, openingHandSize: deck.length })
}
function copyId(state: BattleState, id: CardId): string {
  const card = state.hand.find(instance => instance.definitionId === id)
  if (!card) throw new Error('Missing copy of ' + id)
  return card.instanceId
}
function cast(state: BattleState, id: CardId) { return playCard(state, copyId(state, id)) }
function identities(state: BattleState) {
  return [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhausted, ...(state.pending ? [state.pending.card] : [])].map(card => card.instanceId).sort()
}

describe('card transactions and identities', () => {
  it('plays only the selected copy and leaves other copies playable in the same turn', () => {
    const state = fixture(['sword-strike', 'sword-strike'])
    const first = state.hand[0]!.instanceId
    const second = state.hand[1]!.instanceId
    expect(first).not.toBe(second)
    expect(playCard(state, first).ok).toBe(true)
    expect(state.hand.map(card => card.instanceId)).toEqual([second])
    expect(playCard(state, second).ok).toBe(true)
    expect(state.enemy.health).toBe(88)
    expect(state.mana).toBe(1)
    expect(state.discardPile).toHaveLength(2)
  })

  it('pays once at launch and applies the effect exactly once at impact', () => {
    const state = fixture(['sword-strike', 'sword-strike'])
    const start = startCardPlay(state, state.hand[0]!.instanceId)
    if (!start.ok) throw new Error('Expected a valid launch')
    expect(state.mana).toBe(2)
    expect(state.enemy.health).toBe(100)
    expect(state.hand).toHaveLength(1)
    expect(identities(state)).toHaveLength(2)
    expect(startCardPlay(state, state.hand[0]!.instanceId)).toEqual({ ok: false, reason: 'busy' })
    expect(endTurn(state)).toBe(false)
    expect(resolveCardPlay(state, 'wrong-id')).toEqual({ ok: false, reason: 'stale-action' })
    expect(state.pending?.actionId).toBe(start.play.actionId)
    expect(resolveCardPlay(state, start.play.actionId).ok).toBe(true)
    const after = structuredClone(state)
    expect(resolveCardPlay(state, start.play.actionId)).toEqual({ ok: false, reason: 'stale-action' })
    expect(state).toEqual(after)
    expect(state.enemy.health).toBe(94)
  })

  it('rejects insufficient mana without moving the copy or consuming a state', () => {
    const state = fixture(['fireball', 'fireball', 'guard'])
    cast(state, 'fireball')
    const before = structuredClone(state)
    expect(cast(state, 'fireball')).toEqual({ ok: false, reason: 'mana' })
    expect(state).toEqual(before)
    expect(startCardPlay(state, 'nonexistent')).toEqual({ ok: false, reason: 'not-in-hand' })
    expect(state).toEqual(before)
  })

  it('gives the same result for an atomic play and launch/impact presentation', () => {
    const atomic = fixture(['fireball', 'sword-strike'])
    const animated = structuredClone(atomic)
    cast(atomic, 'fireball')
    const start = startCardPlay(animated, copyId(animated, 'fireball'))
    if (!start.ok) throw new Error('Expected a valid launch')
    resolveCardPlay(animated, start.play.actionId)
    expect(animated).toEqual(atomic)
  })
})

describe('dual-class links', () => {
  it('consumes Lira’s mark on one warrior strike for +3 damage and one real draw', () => {
    const state = fixture(['fireball', 'sword-strike', 'sword-strike'])
    cast(state, 'fireball')
    expect(hasStatus(state, 'mark')).toBe(true)
    const beforePreview = structuredClone(state)
    expect(previewCard(state, cardDefinition('sword-strike'))).toMatchObject({ damage: 9, bonusDamage: 3, draw: 1 })
    expect(state).toEqual(beforePreview)
    const hit = cast(state, 'sword-strike')
    expect(hit).toMatchObject({ ok: true, damageDealt: 9, drawn: 1 })
    expect(hasStatus(state, 'mark')).toBe(false)
    expect(previewCard(state, cardDefinition('sword-strike')).damage).toBe(6)
    expect(state.enemy.health).toBe(83)
    expect(state.hand).toHaveLength(2)
  })

  it('creates resonance with protection and consumes it with an offensive mage spell', () => {
    const state = fixture(['guard', 'fireball'])
    cast(state, 'guard')
    expect(state.heroes.warrior.armor).toBe(4)
    expect(hasStatus(state, 'resonance')).toBe(true)
    expect(previewCard(state, cardDefinition('fireball')).bonusDamage).toBe(2)
    expect(cast(state, 'fireball')).toMatchObject({ ok: true, damageDealt: 10 })
    expect(hasStatus(state, 'resonance')).toBe(false)
    expect(hasStatus(state, 'mark')).toBe(true)
    expect(state.mana).toBe(0)
  })

  it('does not trigger a link just because hero classes alternate', () => {
    const state = fixture(['thunderbolt', 'sword-strike'])
    expect(cast(state, 'thunderbolt')).toMatchObject({ ok: true, damageDealt: 4 })
    expect(hasStatus(state, 'mark')).toBe(false)
    expect(cast(state, 'sword-strike')).toMatchObject({ ok: true, damageDealt: 6 })
    expect(hasStatus(state, 'resonance')).toBe(false)
  })

  it('requires both the correct class and an eligible tag to use a state', () => {
    const state = fixture(['fireball'])
    cast(state, 'fireball')
    const sword = cardDefinition('sword-strike')
    expect(previewCard(state, { ...sword, className: 'mage' }).bonusDamage).toBe(0)
    expect(previewCard(state, { ...sword, tags: [] }).bonusDamage).toBe(0)
    expect(hasStatus(state, 'mark')).toBe(true)
  })

  it('can complete both directions in one paid turn with a finite free finisher', () => {
    const state = fixture(['guard', 'fireball', 'quick-cut'])
    cast(state, 'guard')
    expect(cast(state, 'fireball')).toMatchObject({ ok: true, damageDealt: 10 })
    expect(cast(state, 'quick-cut')).toMatchObject({ ok: true, damageDealt: 6 })
    expect(state.enemy.health).toBe(84)
    expect(state.mana).toBe(0)
    expect(state.heroes.warrior.armor).toBe(4)
    expect(state.statuses).toEqual({})
    expect(state.exhausted).toHaveLength(1)
  })

  it('refreshes a state without stacking its bonus', () => {
    const state = fixture(['guard', 'guard', 'thunderbolt'])
    cast(state, 'guard')
    cast(state, 'guard')
    expect(cast(state, 'thunderbolt')).toMatchObject({ ok: true, damageDealt: 6 })
    expect(hasStatus(state, 'resonance')).toBe(false)
  })

  it('expires unused mark and resonance at the end of the current player turn', () => {
    const state = fixture(['guard', 'fireball'])
    cast(state, 'guard')
    cast(state, 'fireball')
    expect(hasStatus(state, 'mark')).toBe(true)
    endTurn(state)
    expect(state.statuses).toEqual({})
    expect(previewCard(state, cardDefinition('sword-strike')).bonusDamage).toBe(0)
    const second = fixture(['guard'])
    cast(second, 'guard')
    endTurn(second)
    expect(hasStatus(second, 'resonance')).toBe(false)
    expect(previewCard(second, cardDefinition('fireball')).bonusDamage).toBe(0)
  })

  it('protects Lira when she is the announced target', () => {
    const state = fixture(['guard'])
    state.enemy.intent = 'mage'
    cast(state, 'guard')
    endTurn(state)
    expect(state.heroes.mage.health).toBe(17)
    expect(state.heroes.mage.armor).toBe(0)
    expect(state.heroes.warrior.health).toBe(25)
  })

  it('keeps Bastion’s partner shield until that hero is attacked, without healing', () => {
    const state = fixture(['bastion'])
    cast(state, 'bastion')
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(25)
    expect(state.heroes.warrior.armor).toBe(0)
    expect(state.heroes.mage.armor).toBe(3)
    endTurn(state)
    expect(state.heroes.mage.health).toBe(16)
    expect(state.heroes.mage.armor).toBe(0)
  })
})

describe('deck, draw, recycle and exhaustion', () => {
  it('draws no cards from empty zones and cannot draw the resolving copy itself', () => {
    const state = fixture(['thunderbolt'])
    expect(cast(state, 'thunderbolt')).toMatchObject({ ok: true, drawn: 0 })
    expect(state.hand).toHaveLength(0)
    expect(state.discardPile).toHaveLength(1)
    expect(drawCards(state, 10)).toHaveLength(1)
    expect(drawCards(state, 10)).toHaveLength(0)
  })

  it('allows a legitimately redrawn copy to be played again while paying mana again', () => {
    const state = fixture(['thunderbolt'])
    const original = copyId(state, 'thunderbolt')
    playCard(state, original)
    endTurn(state)
    expect(state.hand[0]!.instanceId).toBe(original)
    expect(playCard(state, original)).toMatchObject({ ok: true, damageDealt: 4 })
    expect(state.mana).toBe(2)
  })

  it('exhausts free attacks for this battle so recycling cannot create an infinite free loop', () => {
    const state = fixture(['fireball', 'quick-cut'])
    cast(state, 'fireball')
    expect(cast(state, 'quick-cut')).toMatchObject({ ok: true, damageDealt: 6, drawn: 1 })
    expect(state.exhausted).toHaveLength(1)
    expect(state.exhausted[0]!.definitionId).toBe('quick-cut')
    endTurn(state)
    expect(state.hand.every(card => card.definitionId !== 'quick-cut')).toBe(true)
    expect(identities(state)).toHaveLength(2)
  })

  it('replays both opening and later shuffles with the same seed', () => {
    const a = createBattle(undefined, undefined, { seed: 123 })
    const b = createBattle(undefined, undefined, { seed: 123 })
    expect(a).toEqual(b)
    for (let index = 0; index < 4; index += 1) { endTurn(a); endTurn(b); expect(a).toEqual(b) }
    const different = createBattle(undefined, undefined, { seed: 124 })
    expect(different.hand.map(card => card.definitionId)).not.toEqual(createBattle(undefined, undefined, { seed: 123 }).hand.map(card => card.definitionId))
  })

  it('conserves every unique instance through many launch, draw, discard and shuffle operations', () => {
    for (let seed = 0; seed < 16; seed += 1) {
      const deck = [...startingDeck, 'quick-cut', 'thunderbolt', 'bastion'] as CardId[]
      const state = createBattle({ ...encounters[2]!, attack: 1, maxHealth: 1000 }, undefined, { seed, deck })
      const original = identities(state)
      for (let turn = 0; turn < 8; turn += 1) {
        for (let play = 0; play < 12; play += 1) {
          const next = state.hand.find(card => cardDefinition(card.definitionId).cost <= state.mana)
          if (!next) break
          const start = startCardPlay(state, next.instanceId)
          expect(identities(state)).toEqual(original)
          if (start.ok) resolveCardPlay(state, start.play.actionId)
          expect(identities(state)).toEqual(original)
          expect(new Set(identities(state)).size).toBe(deck.length)
        }
        endTurn(state)
        expect(identities(state)).toEqual(original)
      }
    }
  })
})

describe('terminal states and run adapter', () => {
  it('stops at lethal damage, with no draw or status applied to a defeated enemy', () => {
    const state = fixture(['fireball', 'sword-strike'], 8)
    expect(cast(state, 'fireball')).toMatchObject({ ok: true, damageDealt: 8 })
    expect(state.result).toBe('victory')
    expect(state.statuses).toEqual({})
    expect(state.pending).toBeNull()
    const won = structuredClone(state)
    expect(cast(state, 'sword-strike')).toEqual({ ok: false, reason: 'finished' })
    expect(endTurn(state)).toBe(false)
    expect(state).toEqual(won)
  })

  it('ends immediately when either hero dies, without starting another turn or draw', () => {
    const state = fixture(['sword-strike'])
    state.enemy.intent = 'mage'
    state.heroes.mage.health = 3
    endTurn(state)
    expect(state.result).toBe('defeat')
    expect(state.heroes.mage.health).toBe(0)
    expect(state.turn).toBe(1)
    expect(state.hand).toHaveLength(0)
    expect(state.discardPile).toHaveLength(1)
    expect(drawCards(state, 3)).toHaveLength(0)
    expect(startCardPlay(state, 'anything')).toEqual({ ok: false, reason: 'finished' })
  })

  it('clears temporary defenses between encounters and recognizes a dead carried hero', () => {
    const previous = fixture(['guard'])
    previous.heroes.warrior.health = 17
    previous.heroes.warrior.armor = 9
    previous.heroes.mage.armor = 3
    const next = createBattle(encounters[0]!, previous.heroes)
    expect(next.heroes.warrior.health).toBe(17)
    expect(next.heroes.warrior.armor).toBe(0)
    expect(next.heroes.mage.armor).toBe(0)
    expect(next.statuses).toEqual({})
    previous.heroes.mage.health = 0
    expect(createBattle(encounters[0]!, previous.heroes).result).toBe('defeat')
  })

  it('supports duplicate rewards and ignores a stale impact from a previous encounter', () => {
    const battle = useBattle({ seed: 42, deck: ['sword-strike'] })
    battle.addCard(cardDefinition('sword-strike'))
    battle.addCard(cardDefinition('sword-strike'))
    battle.startBattle(encounters[0]!)
    expect(battle.cards.value).toHaveLength(3)
    expect(new Set(battle.cards.value.map(card => card.instanceId)).size).toBe(3)
    const first = battle.beginPlay(battle.cards.value[0]!.instanceId)!
    battle.startBattle(encounters[1]!)
    const next = battle.beginPlay(battle.cards.value[0]!.instanceId)!
    battle.resolvePlay(first.actionId)
    expect(battle.state.value.enemy.health).toBe(30)
    expect(battle.state.value.pending?.actionId).toBe(next.actionId)
    battle.resolvePlay(next.actionId)
    battle.resolvePlay(next.actionId)
    expect(battle.state.value.enemy.health).toBe(24)
  })
})
