import { describe, expect, it } from 'vitest'
import { createBattle, endTurn, forecastEnemyAttack, hasStatus, playCard, previewCard, resolveCardPlay, startCardPlay } from './battle'
import { drawCards } from './deck'
import { CARDS_DRAWN_PER_TURN, MAX_HAND_SIZE, OPENING_HAND_SIZE, cardDefinition, encounters, startingDeck } from './types'
import type { BattleState, CardId, EnemyAction, HeroId } from './types'
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
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 4, target: 'mage' }
    state.enemy.focus = 'mage'
    cast(state, 'guard')
    endTurn(state)
    expect(state.heroes.mage.health).toBe(18)
    expect(state.heroes.mage.armor).toBe(0)
    expect(state.heroes.warrior.health).toBe(25)
  })

  it('keeps Bastion’s partner shield until that hero is attacked, without healing', () => {
    const state = fixture(['bastion'])
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 5, target: 'warrior' }
    state.enemy.focus = 'warrior'
    cast(state, 'bastion')
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(25)
    expect(state.heroes.warrior.armor).toBe(0)
    expect(state.heroes.mage.armor).toBe(3)
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 5, target: 'mage' }
    state.enemy.focus = 'mage'
    endTurn(state)
    expect(state.heroes.mage.health).toBe(16)
    expect(state.heroes.mage.armor).toBe(0)
  })
})

describe('deck, draw, recycle and exhaustion', () => {
  it('starts with eight cards from an 18-instance deck and holds the hand at ten', () => {
    const state = createBattle(undefined, undefined, { seed: 4 })
    expect(startingDeck).toHaveLength(18)
    expect(state.hand).toHaveLength(OPENING_HAND_SIZE)
    expect(MAX_HAND_SIZE).toBe(10)
    expect(state.hand.length + state.drawPile.length).toBe(18)
  })

  it('keeps unplayed cards between turns, draws two, and leaves blocked draws in the pile', () => {
    const state = createBattle(undefined, undefined, { seed: 23, deck: Array(18).fill('sword-strike') as CardId[] })
    const originalHand = state.hand.map(card => card.instanceId)
    expect(endTurn(state)).toBe(true)
    expect(state.hand.slice(0, OPENING_HAND_SIZE).map(card => card.instanceId)).toEqual(originalHand)
    expect(state.hand).toHaveLength(OPENING_HAND_SIZE + CARDS_DRAWN_PER_TURN)
    expect(endTurn(state)).toBe(true)
    expect(state.hand).toHaveLength(MAX_HAND_SIZE)
    const remainingBefore = state.drawPile.length
    expect(drawCards(state, 2)).toHaveLength(0)
    expect(state.drawPile).toHaveLength(remainingBefore)
    expect(state.blockedDraws).toBeGreaterThan(0)
  })

  it('counts blocked cards only when cards remain available to draw', () => {
    const state = fixture(['sword-strike'])
    state.hand = Array.from({ length: MAX_HAND_SIZE }, (_, index) => ({ instanceId: 'held-' + index, definitionId: 'sword-strike' }))
    state.drawPile = [{ instanceId: 'waiting', definitionId: 'fireball' }]
    expect(drawCards(state, 2)).toHaveLength(0)
    expect(state.drawPile[0]?.instanceId).toBe('waiting')
    expect(state.blockedDraws).toBe(1)
    state.drawPile = []
    state.discardPile = []
    expect(drawCards(state, 2)).toHaveLength(0)
    expect(state.blockedDraws).toBe(1)
  })

  it.each([
    ['attack', { kind: 'attack', name: 'Удар', damage: 4, target: 'warrior' }, 3],
    ['attack_all', { kind: 'attack_all', name: 'Волна', damage: 4, primaryTarget: 'warrior' }, 3],
    ['prepare', { kind: 'prepare', name: 'Готовит удар', prepared: { kind: 'attack', name: 'Удар', damage: 4, target: 'warrior' } }, 0],
    ['defend', { kind: 'defend', name: 'Защита', armor: 3 }, 0],
  ] as [string, EnemyAction, number][])('Parry deals its counter damage only for a current %s action', (_name, action, damage) => {
    const state = fixture(['parry'])
    state.enemy.nextAction = action
    expect(previewCard(state, cardDefinition('parry'))).toMatchObject({ damage, armor: { warrior: 3, mage: 0 } })
    expect(cast(state, 'parry')).toMatchObject({ ok: true, damageDealt: damage })
    expect(state.enemy.health).toBe(100 - damage)
  })

  it.each(['warrior', 'mage'] as HeroId[])('Interpose always protects the mage when enemy focus is %s', focus => {
    const state = fixture(['interpose'])
    state.enemy.focus = focus
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 4, target: focus }
    expect(previewCard(state, cardDefinition('interpose'))).toMatchObject({ armor: { warrior: 0, mage: 5 } })
    expect(cast(state, 'interpose').ok).toBe(true)
    expect(state.heroes).toMatchObject({ warrior: { armor: 0 }, mage: { armor: 5 } })
  })

  it.each([
    ['warrior', { warrior: 6, mage: 3 }],
    ['mage', { warrior: 3, mage: 6 }],
  ] as [HeroId, Record<HeroId, number>][])('Bastion keeps its threatened-plus-partner armor split for focus %s', focus => {
    const state = fixture(['bastion'])
    state.enemy.focus = focus
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 4, target: focus }
    expect(previewCard(state, cardDefinition('bastion')).armor).toEqual(focus === 'warrior' ? { warrior: 6, mage: 3 } : { warrior: 3, mage: 6 })
    expect(cast(state, 'bastion').ok).toBe(true)
    expect({ warrior: state.heroes.warrior.armor, mage: state.heroes.mage.armor }).toEqual(focus === 'warrior' ? { warrior: 6, mage: 3 } : { warrior: 3, mage: 6 })
  })

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
      const state = createBattle({ ...encounters[2]!, maxHealth: 1000 }, undefined, { seed, deck })
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
  it('uses enemy armor first, previews the split, and applies only overflow to health', () => {
    const state = fixture(['sword-strike'])
    state.enemy.armor = 5
    const preview = previewCard(state, cardDefinition('sword-strike'))
    expect(preview).toMatchObject({ damage: 6, armorDamage: 5, healthDamage: 1 })
    expect(cast(state, 'sword-strike')).toMatchObject({ ok: true, damageDealt: 1 })
    expect(state.enemy.armor).toBe(0)
    expect(state.enemy.health).toBe(99)
  })

  it('gives root sentinel its declared defensive action and caps armor at eight', () => {
    const state = createBattle(encounters[0], undefined, { seed: 6, deck: [] })
    state.enemy.nextAction = { kind: 'defend', name: 'Кора', armor: 5 }
    state.enemy.armor = 6
    expect(forecastEnemyAttack(state)).toMatchObject({ armorGain: 2, targets: [] })
    endTurn(state)
    expect(state.enemy.armor).toBe(8)
    expect(state.heroes.warrior.health).toBe(25)
  })

  it('resolves every AoE target from the same snapshot before declaring defeat', () => {
    const state = createBattle(encounters[2], undefined, { seed: 11, deck: [] })
    state.enemy.nextAction = { kind: 'attack_all', name: 'Волна', damage: 4, primaryTarget: 'warrior' }
    state.heroes.warrior.health = 1
    state.heroes.warrior.armor = 2
    state.heroes.mage.health = 2
    state.heroes.mage.armor = 1
    const forecast = forecastEnemyAttack(state)
    expect(forecast.targets).toMatchObject([{ target: 'warrior', healthLoss: 1 }, { target: 'mage', healthLoss: 2 }])
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(0)
    expect(state.heroes.mage.health).toBe(0)
    expect(state.result).toBe('defeat')
  })

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
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 4, target: 'mage' }
    state.enemy.focus = 'mage'
    state.heroes.mage.health = 3
    endTurn(state)
    expect(state.result).toBe('defeat')
    expect(state.heroes.mage.health).toBe(0)
    expect(state.turn).toBe(1)
    expect(state.hand).toHaveLength(1)
    expect(state.discardPile).toHaveLength(0)
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

  it('restarts a fixed-seed run with the same draws but fresh action identities', () => {
    const battle = useBattle({ seed: 42 })
    battle.startBattle(encounters[0]!)
    const before = structuredClone(battle.state.value)
    const sameSeedBattle = createBattle(encounters[0]!, undefined, { seed: 42, deck: startingDeck })
    expect(before.seed).toBe(42)
    expect(before.rngState).toBe(sameSeedBattle.rngState)
    expect(before.hand.map(card => card.definitionId)).toEqual(sameSeedBattle.hand.map(card => card.definitionId))
    expect(before.drawPile.map(card => card.definitionId)).toEqual(sameSeedBattle.drawPile.map(card => card.definitionId))
    const stale = battle.beginPlay(battle.cards.value.find(card => card.card.cost <= 3)!.instanceId)!
    battle.finishTurn()
    battle.restart()
    battle.startBattle(encounters[0]!)
    const after = battle.state.value
    expect(after.seed).toBe(before.seed)
    expect(after.rngState).toBe(before.rngState)
    expect(after.hand.map(card => card.definitionId)).toEqual(before.hand.map(card => card.definitionId))
    expect(after.drawPile.map(card => card.definitionId)).toEqual(before.drawPile.map(card => card.definitionId))
    expect(after.battleId).not.toBe(before.battleId)
    const current = battle.beginPlay(battle.cards.value[0]!.instanceId)!
    battle.resolvePlay(stale.actionId)
    expect(battle.state.value.pending?.actionId).toBe(current.actionId)
    expect(battle.state.value.enemy.health).toBe(24)
  })

  it('uses the same armor forecast for UI and actual incoming health loss', () => {
    const state = fixture(['guard'])
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 7, target: 'mage' }
    state.enemy.focus = 'mage'
    state.heroes.mage.armor = 4
    const forecast = forecastEnemyAttack(state)
    expect(forecast).toMatchObject({ target: 'mage', attack: 7, absorbed: 4, healthLoss: 3, lethal: false })
    endTurn(state)
    expect(state.heroes.mage.health).toBe(18 - forecast.healthLoss)
    const lethal = fixture([])
    lethal.heroes.warrior.health = 2
    expect(forecastEnemyAttack(lethal)).toMatchObject({ healthLoss: 2, lethal: true })
  })

  it('announces and resolves the guardian heavy strike against the same hero', () => {
    const state = fixture([])
    const announced = forecastEnemyAttack(state)
    expect(announced.action).toMatchObject({ kind: 'prepare' })
    expect(announced.futureTargets![0]).toMatchObject({ target: 'warrior', attack: 10 })
    endTurn(state)
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack', target: 'warrior', damage: 10 })
    const attack = forecastEnemyAttack(state)
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(25 - attack.healthLoss)
  })

  it('applies boss area damage from one snapshot and defers phase behavior until the announced action ends', () => {
    const state = createBattle(encounters[2], undefined, { seed: 9, deck: ['sword-strike', 'sword-strike'], openingHandSize: 2 })
    state.enemy.health = 24
    state.enemy.nextAction = { kind: 'attack_all', name: 'Волна', damage: 4, primaryTarget: 'mage' }
    const announced = forecastEnemyAttack(state)
    cast(state, 'sword-strike')
    expect(state.enemy.phase).toBe(2)
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack_all', damage: 4 })
    expect(forecastEnemyAttack(state).phase).toBe(1)
    expect(announced.targets).toHaveLength(2)
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(21)
    expect(state.heroes.mage.health).toBe(14)
    expect(state.enemy.nextAction).toEqual(encounters[2]!.behavior.phase2![0])
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
