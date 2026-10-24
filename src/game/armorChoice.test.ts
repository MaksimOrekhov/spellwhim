import { describe, expect, it } from 'vitest'
import { armorChoice, armorFocusOf, createBattle, endTurn, forecastEnemyAction, playCard, previewCard, resolveCardPlay, startCardPlay } from './battle'
import { gameEconomy, honestEconomies } from './economy'
import type { EconomyConfig } from './economy'
import type { BattleState, CardId, EncounterDefinition, EnemyAction, HeroId } from './types'
import { cardDefinition, cards } from './types'

const B1 = honestEconomies['honest-b1']
const heroes: HeroId[] = ['warrior', 'mage']
const group = (damage: number, primaryTarget: HeroId = 'warrior', pierce?: number): EnemyAction => ({ kind: 'attack_all', name: 'Удар по обоим', damage, primaryTarget, ...(pierce ? { pierce } : {}) })
const single = (damage: number, target: HeroId = 'warrior'): EnemyAction => ({ kind: 'attack', name: 'Удар', damage, target })
const prepared = (hit: Extract<EnemyAction, { kind: 'attack' | 'attack_all' }>): EnemyAction => ({ kind: 'prepare', name: 'Замах', prepared: hit })

function start(economy: EconomyConfig, actions: EnemyAction[], hand: readonly CardId[], armor: Partial<Record<HeroId, number>> = {}) {
  const encounter: EncounterDefinition = { id: 'dummy', name: 'Чучело', title: 'Проверка', maxHealth: 10_000, appearance: 'defias', mapLabel: 'Проверка', behavior: { phase1: actions } }
  const deck: CardId[] = [...hand, ...Array.from({ length: 6 }, () => 'sword-strike' as CardId)]
  const state = createBattle(encounter, undefined, { deck, seed: 5, economy })
  state.heroes.warrior.health = state.heroes.warrior.maxHealth = 100
  state.heroes.mage.health = state.heroes.mage.maxHealth = 100
  const pool = [...state.hand, ...state.drawPile]
  state.hand = hand.map(id => pool.splice(pool.findIndex(card => card.definitionId === id), 1)[0]!)
  state.drawPile = pool
  state.mana = 10
  Object.assign(state.heroes.warrior, { armor: armor.warrior ?? 0 })
  Object.assign(state.heroes.mage, { armor: armor.mage ?? 0 })
  return state
}
const instance = (state: BattleState, id: CardId) => state.hand.find(card => card.definitionId === id)!
const armorOf = (state: BattleState) => ({ warrior: state.heroes.warrior.armor, mage: state.heroes.mage.armor })
const healthOf = (state: BattleState) => ({ warrior: state.heroes.warrior.health, mage: state.heroes.mage.health })

describe('armor focus: the hero a card protects', () => {
  it('stays the enemy focus without a choice, so an unchosen play is exactly what it always was', () => {
    for (const primary of heroes) {
      const state = start(B1, [group(8, primary)], ['ice-ward'])
      expect(armorFocusOf(state)).toBe(primary)
      const plain = structuredClone(state)
      expect(playCard(plain, instance(plain, 'ice-ward').instanceId).ok).toBe(true)
      const chosen = structuredClone(state)
      expect(playCard(chosen, instance(chosen, 'ice-ward').instanceId, primary).ok).toBe(true)
      expect(armorOf(chosen)).toEqual(armorOf(plain))
      expect(plain.heroes[primary].armor).toBe(3)
    }
  })

  it('lets the player give "the threatened hero" armor to either hero against a hit on both', () => {
    const state = start(B1, [group(8, 'warrior')], ['ice-ward'])
    const toMage = structuredClone(state)
    playCard(toMage, instance(toMage, 'ice-ward').instanceId, 'mage')
    expect(armorOf(toMage)).toEqual({ warrior: 2, mage: 3 })
    const toWarrior = structuredClone(state)
    playCard(toWarrior, instance(toWarrior, 'ice-ward').instanceId, 'warrior')
    expect(armorOf(toWarrior)).toEqual({ warrior: 3, mage: 2 })
  })

  it('ignores a choice against a single target: the hit target keeps the automatic armor and no choice is offered', () => {
    const state = start(B1, [single(8, 'warrior')], ['ice-ward', 'bastion'])
    expect(armorChoice(state, cardDefinition('ice-ward'))).toBeNull()
    expect(armorFocusOf(state, 'mage')).toBe('warrior')
    playCard(state, instance(state, 'ice-ward').instanceId, 'mage')
    expect(state.pending).toBeNull()
    expect(armorOf(state)).toEqual({ warrior: 3, mage: 2 })
    expect(armorChoice(start(B1, [prepared({ kind: 'attack', name: 'Удар', damage: 9, target: 'mage' })], ['bastion']), cardDefinition('bastion'))).toBeNull()
  })

  it('offers a choice only for cards whose armor depends on "threatened" or "partner"', () => {
    const state = start(B1, [group(8)], [])
    const wants = (id: CardId) => armorChoice(state, cardDefinition(id)) !== null
    for (const id of ['guard', 'parry', 'ice-ward', 'bastion', 'stance-strike', 'shield-bash', 'covering-counter', 'wound-clamp'] as CardId[]) expect(wants(id), id).toBe(true)
    for (const id of ['sword-strike', 'fireball', 'interpose', 'arcane-insight'] as CardId[]) expect(wants(id), id).toBe(false)
    // No choice at all when the enemy is not attacking.
    expect(armorChoice(start(B1, [{ kind: 'defend', name: 'Стойка', armor: 3 }], ['bastion']), cardDefinition('bastion'))).toBeNull()
  })

  it('previews the chosen distribution exactly as it resolves, for every armor card and both choices', () => {
    const armorCards = cards.filter(card => card.effects.some(effect => effect.type === 'armor' && (effect.target === 'threatened' || effect.target === 'partner')))
    expect(armorCards.length).toBeGreaterThanOrEqual(6)
    for (const card of armorCards) for (const focus of heroes) {
      const state = start(B1, [group(7, 'warrior')], [card.id], { warrior: 1, mage: 2 })
      const before = armorOf(state)
      const preview = previewCard(state, card, undefined, focus)
      const mutated = structuredClone(state)
      const started = startCardPlay(mutated, instance(mutated, card.id).instanceId, focus)
      expect(started.ok).toBe(true)
      expect(started.ok && started.play.preview.armor).toEqual(preview.armor)
      resolveCardPlay(mutated, mutated.pending!.actionId)
      const after = armorOf(mutated)
      for (const id of heroes) expect(after[id] - before[id], `${card.id} → ${focus}`).toBe(preview.armor[id])
    }
  })

  it('knows the Bastion and Ice Ward splits (6/3 and 3/2) either way round', () => {
    const state = start(B1, [group(9, 'mage')], [])
    const bastion = armorChoice(state, cardDefinition('bastion'))!
    expect(Object.fromEntries(bastion.options.map(option => [option.focus, option.armor]))).toEqual({ warrior: { warrior: 6, mage: 3 }, mage: { warrior: 3, mage: 6 } })
    expect(bastion.auto).toBe('mage')
    const ward = armorChoice(state, cardDefinition('ice-ward'))!
    expect(Object.fromEntries(ward.options.map(option => [option.focus, option.armor]))).toEqual({ warrior: { warrior: 3, mage: 2 }, mage: { warrior: 2, mage: 3 } })
  })
})

describe('the forecast shown before the play is what the enemy then does', () => {
  const economies: [string, EconomyConfig][] = [['B1 (armor lasts one enemy action)', B1], ['standard (armor stays until hit)', gameEconomy]]

  it.each(economies)('an ordinary hit on both: health lost after each choice matches the real hit — %s', (_, economy) => {
    for (const card of ['ice-ward', 'bastion', 'guard', 'stance-strike'] as CardId[]) {
      const state = start(economy, [group(9, 'warrior')], [card], { warrior: 1, mage: 0 })
      const choice = armorChoice(state, cardDefinition(card))!
      expect(choice.hit.imminent).toBe(true)
      for (const option of choice.options) {
        const real = structuredClone(state)
        playCard(real, instance(real, card).instanceId, option.focus)
        const before = healthOf(real)
        endTurn(real)
        expect({ warrior: before.warrior - real.heroes.warrior.health, mage: before.mage - real.heroes.mage.health }, `${card} → ${option.focus}`).toEqual(option.loss)
      }
    }
  })

  it('a piercing hit on both: the pierce is counted, the choice that looks safer may not be', () => {
    const state = start(B1, [group(10, 'warrior', 4)], ['bastion'], { warrior: 0, mage: 0 })
    const choice = armorChoice(state, cardDefinition('bastion'))!
    const byFocus = Object.fromEntries(choice.options.map(option => [option.focus, option]))
    // 6 armor against 10 with pierce 4 stops 2; 3 armor stops 0 (pierce eats it).
    expect(byFocus.warrior!.loss).toEqual({ warrior: 8, mage: 10 })
    expect(byFocus.mage!.loss).toEqual({ warrior: 10, mage: 8 })
    for (const option of choice.options) {
      const real = structuredClone(state)
      playCard(real, instance(real, 'bastion').instanceId, option.focus)
      const before = healthOf(real)
      endTurn(real)
      expect({ warrior: before.warrior - real.heroes.warrior.health, mage: before.mage - real.heroes.mage.health }).toEqual(option.loss)
    }
  })

  it('reports a lethal choice', () => {
    const state = start(B1, [group(30, 'warrior')], ['ice-ward'])
    state.heroes.mage.health = 10
    const choice = armorChoice(state, cardDefinition('ice-ward'))!
    expect(choice.options.every(option => option.lethal)).toBe(true)
    state.heroes.mage.health = 29
    expect(armorChoice(state, cardDefinition('ice-ward'))!.options.map(option => option.lethal)).toEqual([false, false])
  })

  it('a prepared group hit: armor persists in the standard economy (so the loss is shown) and is gone under B1 (nothing to show)', () => {
    const wind = prepared({ kind: 'attack_all', name: 'Взрыв', damage: 10, primaryTarget: 'mage' })
    const standard = start(gameEconomy, [wind], ['bastion'])
    const choice = armorChoice(standard, cardDefinition('bastion'))!
    expect(choice.hit).toEqual({ name: 'Взрыв', imminent: false })
    const forecast = forecastEnemyAction(standard)
    expect(forecast.targets).toEqual([])
    const warriorOption = choice.options.find(option => option.focus === 'warrior')!
    expect(warriorOption.loss).toEqual({ warrior: 4, mage: 7 })
    expect(armorChoice(start(B1, [wind], ['bastion']), cardDefinition('bastion'))!.options.every(option => option.loss === null)).toBe(true)
  })

  it('does not touch the real state: asking for the choices changes nothing', () => {
    const state = start(B1, [group(9, 'warrior')], ['bastion', 'ice-ward'])
    const before = JSON.stringify(state)
    armorChoice(state, cardDefinition('bastion'))
    armorChoice(state, cardDefinition('ice-ward'))
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('the chosen target is part of the transaction', () => {
  it('is stored on the pending play, survives a copy, and applies once', () => {
    const state = start(B1, [group(8, 'warrior')], ['bastion'])
    const started = startCardPlay(state, instance(state, 'bastion').instanceId, 'mage')
    expect(started.ok).toBe(true)
    const copy = structuredClone(state)
    expect(copy.pending!.armorFocus).toBe('mage')
    const actionId = copy.pending!.actionId
    expect(resolveCardPlay(copy, actionId).ok).toBe(true)
    expect(resolveCardPlay(copy, actionId).ok).toBe(false)
    expect(armorOf(copy)).toEqual({ warrior: 3, mage: 6 })
  })

  it('leaves no trace on a play without a choice (the pending play has no armorFocus key)', () => {
    const state = start(B1, [single(8)], ['bastion'])
    const started = startCardPlay(state, instance(state, 'bastion').instanceId, 'mage')
    expect(started.ok && 'armorFocus' in started.play).toBe(false)
  })
})

describe('the choice dialog', () => {
  it('names the hit, both heroes, the armor split and the health each hero is left with, and marks the automatic choice', async () => {
    const { createSSRApp } = await import('vue')
    const { renderToString } = await import('vue/server-renderer')
    const { default: ArmorChoiceDialog } = await import('../components/ArmorChoiceDialog.vue')
    const state = start(B1, [group(9, 'warrior')], [], { warrior: 0, mage: 0 })
    const card = cardDefinition('bastion')
    const html = await renderToString(createSSRApp(ArmorChoiceDialog, { card, choice: armorChoice(state, card)!, heroes: state.heroes }))
    expect(html).toContain('Каменный бастион: кого прикрыть?')
    expect(html).toContain('ударит по обоим героям в конце вашего хода')
    expect(html).toContain('+6 брони')
    expect(html).toContain('+3 брони')
    expect(html).toContain('−6 HP')
    expect(html).toContain('как без выбора')
    expect((html.match(/class="ac-option[ "]/g) ?? []).length).toBe(2)
  })
})
