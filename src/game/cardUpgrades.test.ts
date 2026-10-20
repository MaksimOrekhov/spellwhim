import { describe, expect, it } from 'vitest'
import { createBattle, endTurn, playCard, previewCard, resolveCardPlay, startCardPlay } from './battle'
import { canUpgradeCard, resolveCardDefinition } from './cardProgression'
import { cardUpgrades } from './cardUpgrades'
import { cards, encounters, startingDeck } from './types'
import type { CardId, PersistentCard } from './types'
import { applyStatus, lifetimeTickDamage, statusValue } from './statuses'
import { createTurnPlanner, determinize, observableSeed } from './balancePlanner'
import { cardFace, neutralPreview } from '../ui/cardDisplay'

const copy = (id: CardId, upgrade: 0 | 1 = 1, index = 1): PersistentCard => ({ definitionId: id, upgrade, instanceId: `test/card/${index}` })
const upgraded = (id: CardId) => resolveCardDefinition(copy(id))

// Independent expected values from GDD, including the index of every changed/inserted effect.
const deltas: [CardId, number, number][] = [
  ['sword-strike', 0, 8], ['fireball', 0, 10], ['guard', 0, 5], ['parry', 0, 4], ['shield-bash', 0, 7], ['interpose', 0, 7],
  ['frostbolt', 0, 5], ['arcane-insight', 1, 2], ['ice-ward', 0, 4], ['quick-cut', 0, 4], ['thunderbolt', 0, 5], ['rend', 0, 6],
  ['reaping-blow', 0, 6], ['boil-blood', 1, 2], ['bastion', 0, 8], ['stance-strike', 0, 4], ['wound-clamp', 1, 5],
  ['covering-counter', 0, 9], ['crushing-swing', 0, 12], ['arcane-mark', 2, 2], ['ice-echo', 0, 3], ['frost-seal', 2, 2], ['blood-resonance', 0, 5],
]

describe('the complete canonical upgrade catalogue', () => {
  it('covers exactly all 23 definitions and leaves the shipped starting deck unchanged', () => {
    expect(cards).toHaveLength(23)
    expect(Object.keys(cardUpgrades).sort()).toEqual(cards.map(card => card.id).sort())
    expect(startingDeck).toHaveLength(18)
  })
  it.each(deltas)('%s changes only its declared effect at %i to %i', (id, index, amount) => {
    const base = resolveCardDefinition(copy(id, 0))
    const before = structuredClone(base)
    const variant = upgraded(id)
    expect(variant.effects[index]).toMatchObject({ amount })
    expect(variant).toMatchObject({ id, cost: base.cost, className: base.className, tags: base.tags, kind: base.kind, upgrade: 1 })
    expect(variant.exhaust).toBe(base.exhaust)
    expect(variant.damageBonus).toEqual(base.damageBonus)
    const oldEffects = structuredClone(base.effects)
    if (['arcane-insight', 'boil-blood', 'arcane-mark', 'frost-seal'].includes(id)) oldEffects.splice(index, 0, variant.effects[index]!)
    else Object.assign(oldEffects[index]!, { amount })
    expect(variant.effects).toEqual(oldEffects)
    expect(canUpgradeCard(copy(id, 0))).toBe(true)
    expect(canUpgradeCard(copy(id))).toBe(false)
    // All nested variant data is detached from the base and another resolution.
    variant.effects.splice(0)
    variant.tags.push('strike')
    if (variant.damageBonus) variant.damageBonus.amount = 99
    expect(base).toEqual(before)
    expect(upgraded(id).effects).toEqual(oldEffects)
  })
})

const situations = ['plain', 'vulnerable', 'owner-armor', 'bleeding', 'armor', 'lethal', 'lethal-tick', 'nonattack', 'artifacts', 'empty-draw'] as const
describe.each(situations)('preview equals execution: %s', situation => {
  it.each(cards.map(card => card.id))('%s, both levels', id => {
    for (const upgrade of [0, 1] as const) {
      const card = copy(id, upgrade)
      const state = createBattle(encounters[1], undefined, { deck: [card, copy('guard', 0, 2), copy('sword-strike', 1, 3)], openingHandSize: 0 })
      state.hand = [card]
      state.drawPile = state.drawPile.filter(item => item.instanceId !== card.instanceId)
      state.mana = 10
      state.enemy.health = state.enemy.maxHealth = 100
      state.enemy.nextAction = situation === 'nonattack' ? { kind: 'defend', name: 'Блок', armor: 3 } : { kind: 'attack', name: 'Удар', damage: 5, target: 'mage' }
      state.enemy.focus = 'mage'
      if (situation === 'armor' || situation === 'artifacts') state.enemy.armor = 8
      if (situation === 'lethal') state.enemy.health = 1
      if (situation === 'lethal-tick') { state.enemy.health = 2; applyStatus(state, 'enemy', 'bleeding', 5) }
      if (situation === 'bleeding' || situation === 'artifacts') applyStatus(state, 'enemy', 'bleeding', 4)
      if (situation === 'vulnerable' || situation === 'artifacts') applyStatus(state, 'enemy', 'vulnerability')
      if (situation === 'owner-armor' || situation === 'artifacts') state.heroes.warrior.armor = state.heroes.mage.armor = 3
      if (situation === 'empty-draw') state.drawPile = []
      if (situation === 'artifacts') state.artifacts = [
        { definitionId: 'double-pulley', instanceId: 'pulley', ownerInstanceId: state.heroes.mage.instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false },
        { definitionId: 'weakpoint-lens', instanceId: 'lens', ownerInstanceId: state.heroes.warrior.instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false },
      ]
      const before = structuredClone(state)
      const preview = previewCard(state, resolveCardDefinition(card))
      expect(state).toEqual(before)
      const result = playCard(state, card.instanceId)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error(result.reason)
      expect(result.damageDealt).toBe(preview.healthDamage + preview.statusDamage)
      expect(before.enemy.armor - state.enemy.armor).toBe(preview.armorDamage)
      expect(result.drawn).toBe(preview.draw)
      for (const hero of ['warrior', 'mage'] as const) expect(state.heroes[hero].armor - before.heroes[hero].armor).toBe(preview.armor[hero])
      const face = cardFace(resolveCardDefinition(card), preview)
      expect(face.chips.filter(chip => chip.kind === 'armor').reduce((sum, chip) => sum + chip.value, 0)).toBe(preview.armor.warrior + preview.armor.mage - preview.artifactArmor.warrior - preview.artifactArmor.mage)
      if (state.result) expect(state.statuses.enemy).toEqual([])
      expect([...state.discardPile, ...state.exhausted]).toContainEqual(card)
    }
  })
})

describe('sequences and upgrades across zones', () => {
  it('keeps the exact added-armor order and stops immediately on a lethal tick', () => {
    for (const id of ['boil-blood', 'frost-seal', 'wound-clamp'] as const) {
      const state = createBattle(encounters[1], undefined, { deck: [copy(id)], openingHandSize: 1 })
      state.enemy.health = 2
      applyStatus(state, 'enemy', 'bleeding', 3)
      const preview = previewCard(state, upgraded(id))
      expect(preview).toMatchObject({ statusDamage: 2, draw: 0, armor: { warrior: 0, mage: 0 }, appliedStatuses: [] })
      playCard(state, state.hand[0]!.instanceId)
      expect(state.result).toBe('victory')
      expect(state.artifactNotices).toEqual([])
    }
    expect(upgraded('boil-blood').effects.map(effect => effect.type)).toEqual(['status-tick', 'armor', 'draw'])
    expect(upgraded('arcane-mark').effects.map(effect => effect.type)).toEqual(['status', 'draw', 'armor'])
    expect(upgraded('frost-seal').effects.map(effect => effect.type)).toEqual(['status-tick', 'status', 'armor'])
  })
  it('moves one Bleeding tick earlier without multiplying its lifetime damage, burst removes all future ticks', () => {
    const state = createBattle(encounters[1], undefined, { deck: [copy('boil-blood'), copy('reaping-blow', 1, 2)], openingHandSize: 2 })
    state.enemy.health = 100
    state.enemy.maxHealth = 100
    applyStatus(state, 'enemy', 'bleeding', 4)
    const result = playCard(state, state.hand.find(card => card.definitionId === 'boil-blood')!.instanceId)
    expect(result.ok && result.damageDealt).toBe(4)
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(3)
    expect(4 + lifetimeTickDamage('bleeding', 3)).toBe(lifetimeTickDamage('bleeding', 4))
    state.mana = 5
    playCard(state, state.hand[0]!.instanceId)
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(0)
  })
  it('preserves upgraded exhaust and copy identity, rejecting repeat action IDs', () => {
    const card = copy('quick-cut')
    const state = createBattle(encounters[1], undefined, { deck: [card], openingHandSize: 1 })
    const pending = startCardPlay(state, card.instanceId)
    if (!pending.ok) throw new Error('not started')
    expect(resolveCardPlay(state, pending.play.actionId)).toMatchObject({ ok: true, damageDealt: 4 })
    expect(resolveCardPlay(state, pending.play.actionId).ok).toBe(false)
    endTurn(state)
    expect(state.exhausted).toEqual([card])
    expect(createBattle(encounters[1], undefined, { deck: [card], openingHandSize: 1 }).hand).toEqual([card])
  })
  it('keeps upgrade in observable planner keys and chooses the stronger duplicate independently of ID/order', () => {
    const state = createBattle(encounters[1], undefined, { deck: [copy('sword-strike', 0), copy('sword-strike', 1, 2)], openingHandSize: 2 })
    state.enemy.health = 8
    state.mana = 1
    const upgradedCopy = state.hand.find(card => card.upgrade === 1)!
    expect(createTurnPlanner().next(state)).toBe(upgradedCopy.instanceId)
    const changed = structuredClone(state)
    changed.hand.forEach(card => { card.upgrade = 0 })
    expect(observableSeed(state)).not.toBe(observableSeed(changed))
    const relabeled = structuredClone(state)
    relabeled.seed = 99; relabeled.rngState = 200
    relabeled.hand.reverse().forEach((card, i) => { card.instanceId = 'different/' + i })
    expect(observableSeed(state)).toBe(observableSeed(relabeled))
    expect(determinize(state).hand.map(resolveCardDefinition).map(card => card.upgrade ?? 0).sort()).toEqual([0, 1])
  })
  it('stacks upgraded base damage with class armor, Vulnerability and the once-per-turn spool', () => {
    const card = copy('frostbolt')
    const state = createBattle(encounters[1], undefined, { deck: [card], openingHandSize: 1 })
    state.heroes.mage.armor = 2
    applyStatus(state, 'enemy', 'vulnerability')
    state.artifacts = [{ definitionId: 'tension-spool', instanceId: 'spool', ownerInstanceId: state.heroes.mage.instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: true }]
    const preview = previewCard(state, resolveCardDefinition(card))
    expect(preview).toMatchObject({ damage: 12, armorBonus: 2, vulnerabilityBonus: 3, artifactDamage: 2 })
    expect(playCard(state, card.instanceId)).toMatchObject({ ok: true, damageDealt: 12 })
    expect(state.artifacts[0]?.lastTriggeredTurn).toBe(1)
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(1) // old charge spent, new applied
  })
  it('draws an upgraded copy and retains its level through a paid recycle', () => {
    const insight = copy('arcane-insight'), strike = copy('sword-strike', 1, 2)
    const state = createBattle(encounters[1], undefined, { deck: [insight, strike], openingHandSize: 0 })
    state.hand = [insight]; state.drawPile = [strike]
    playCard(state, insight.instanceId)
    expect(state.hand).toEqual([strike])
    expect(state.heroes.mage.armor).toBe(2)
    expect(playCard(state, strike.instanceId)).toMatchObject({ ok: true, damageDealt: 8 })
    endTurn(state)
    expect(state.hand.map(card => card.upgrade)).toEqual([1, 1])
    expect(playCard(state, strike.instanceId)).toMatchObject({ ok: true, damageDealt: 8 })
    expect(state.discardPile).toContainEqual(strike)
  })
  it('neutral card presentation uses the upgraded version', () => {
    expect(cardFace(upgraded('sword-strike'), neutralPreview(upgraded('sword-strike'))).chips[0]?.value).toBe(8)
  })
})
