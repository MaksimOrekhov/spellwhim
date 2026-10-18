import { describe, expect, it } from 'vitest'
import { cloneBattleState, observableSeed } from './balancePlanner'
import { createBattle, endTurn, forecastEnemyAction, hasStatus, playCard, previewCard, resolveCardPlay, startCardPlay } from './battle'
import { composeHit, splitDamage } from './damage'
import { cardOwner, characterGenitive, heroForClass, heroIdsInPartyOrder, partnerOf, resolveArmorTarget } from './party'
import { applyStatus, cleanse, clearStatuses, consumeStatus, createStatuses, hitBonuses, removeStatus, statusDefinitions, statusSignature, statusValue, statusViews, triggerGroup } from './statuses'
import type { StatusDefinition } from './statuses'
import { cardDefinition, cards, encounters } from './types'
import type { BattleState, CardId, EncounterDefinition, StatusId } from './types'
import { ruleLines } from '../ui/cardDisplay'

function fixture(deck: CardId[], options: { encounter?: EncounterDefinition; health?: number } = {}) {
  const state = createBattle({ ...(options.encounter ?? encounters[1]!), maxHealth: options.health ?? 100 }, undefined, { deck, seed: 17, openingHandSize: deck.length })
  state.mana = state.maxMana = 10
  return state
}
function cast(state: BattleState, id: CardId) {
  const card = state.hand.find(instance => instance.definitionId === id)
  if (!card) throw new Error('Missing copy of ' + id)
  return playCard(state, card.instanceId)
}
const bleed = 'fixture-bleed' as StatusId

/** Registers a throw-away status definition (a future Bleed) for the duration of `run`; gameplay never contains it. */
function withFixtureStatus<T>(overrides: Partial<StatusDefinition>, run: () => T): T {
  const table = statusDefinitions as unknown as Record<string, StatusDefinition>
  table[bleed] = {
    id: bleed, name: 'Тестовая рана', shortName: 'Рана', description: 'Фикстура.', spoken: { enemy: 'Рана', hero: 'Рана' }, polarity: 'negative',
    carriers: ['enemy', 'hero'], reading: 'intensity', stacking: 'add', maxValue: 6, icon: 'vulnerability',
    tick: { phase: 'enemy-turn-start', damage: true, ignoresArmor: true, decay: 1 }, ...overrides,
  }
  try { return run() } finally { delete table[bleed] }
}

describe('status store', () => {
  it('starts empty for the enemy and for each hero and keeps them separate', () => {
    const state = fixture(['sword-strike'])
    expect(state.statuses).toEqual({ enemy: [], warrior: [], mage: [] })
    expect(applyStatus(state, 'warrior', 'vulnerability')).toEqual({ applied: true, value: 1 })
    expect(statusValue(state, 'warrior', 'vulnerability')).toBe(1)
    expect(statusValue(state, 'mage', 'vulnerability')).toBe(0)
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(0)
    expect(state.statuses.mage).toEqual([])
  })

  it('refreshes instead of stacking Vulnerability and respects the definition limits', () => {
    const state = fixture(['sword-strike'])
    applyStatus(state, 'enemy', 'vulnerability')
    expect(applyStatus(state, 'enemy', 'vulnerability', 5)).toEqual({ applied: true, value: 1 })
    expect(state.statuses.enemy).toEqual([{ id: 'vulnerability', value: 1 }])
    expect(applyStatus(state, 'enemy', 'vulnerability', 0).applied).toBe(false)
  })

  it('removes and cleanses statuses by their own rules and clears every carrier at once', () => {
    const state = fixture(['sword-strike'])
    applyStatus(state, 'enemy', 'vulnerability')
    applyStatus(state, 'mage', 'vulnerability')
    expect(cleanse(state, 'mage')).toEqual(['vulnerability'])
    expect(statusValue(state, 'mage', 'vulnerability')).toBe(0)
    expect(cleanse(state, 'enemy', 'positive')).toEqual([])
    expect(removeStatus(state, 'enemy', 'vulnerability')).toBe(true)
    expect(removeStatus(state, 'enemy', 'vulnerability')).toBe(false)
    applyStatus(state, 'warrior', 'vulnerability')
    applyStatus(state, 'enemy', 'vulnerability')
    clearStatuses(state)
    expect(state.statuses).toEqual(createStatuses())
    expect(consumeStatus(state, 'enemy', 'vulnerability')).toBe(false)
  })

  it('describes every status for the UI as plain data and names its trigger group', () => {
    const state = fixture(['sword-strike'])
    applyStatus(state, 'enemy', 'vulnerability')
    applyStatus(state, 'mage', 'vulnerability')
    expect(statusViews(state, 'enemy')).toEqual([expect.objectContaining({ id: 'vulnerability', name: 'Уязвимость', shortName: 'Уязвим', value: 1, polarity: 'negative', spoken: 'Противник уязвим', trigger: 'player-card' })])
    expect(statusViews(state, 'mage')[0]).toMatchObject({ spoken: 'Герой уязвим', trigger: 'enemy-action' })
    expect(statusViews(state, 'warrior')).toEqual([])
    expect(triggerGroup('vulnerability', 'enemy')).toBe('player-card')
    expect(triggerGroup('vulnerability', 'warrior')).toBe('enemy-action')
    expect(hitBonuses(state, 'enemy')).toEqual([{ id: 'vulnerability', label: 'Уязвимость', amount: 3 }])
  })

  it('refuses a carrier the definition does not allow', () => {
    withFixtureStatus({ carriers: ['enemy'] }, () => {
      const state = fixture(['sword-strike'])
      expect(applyStatus(state, 'mage', bleed, 2)).toEqual({ applied: false, value: 0 })
      expect(applyStatus(state, 'enemy', bleed, 2)).toEqual({ applied: true, value: 2 })
    })
  })

  it('adds intensity up to the maximum and orders statuses canonically', () => {
    withFixtureStatus({}, () => {
      const state = fixture(['sword-strike'])
      applyStatus(state, 'enemy', bleed, 4)
      applyStatus(state, 'enemy', 'vulnerability')
      expect(applyStatus(state, 'enemy', bleed, 4).value).toBe(6)
      expect(state.statuses.enemy.map(item => item.id)).toEqual(['vulnerability', bleed])
      expect(statusSignature(state)).toBe(`enemy:vulnerability=1,enemy:${bleed}=6`)
      expect(statusSignature(state, { carrier: 'enemy', id: 'vulnerability' })).toBe(`enemy:${bleed}=6`)
    })
  })
})

describe('Vulnerability on the new model', () => {
  it('is spent by the card that really deals damage, not by one whose damage is inactive', () => {
    const state = fixture(['frostbolt', 'parry', 'arcane-insight', 'guard', 'sword-strike'])
    cast(state, 'frostbolt')
    for (const idle of ['parry', 'arcane-insight', 'guard'] as const) {
      cast(state, idle)
      expect(hasStatus(state, 'vulnerability'), idle).toBe(true)
    }
    expect(cast(state, 'sword-strike')).toMatchObject({ ok: true, damageDealt: 9 })
    expect(state.statuses.enemy).toEqual([])
  })

  it('spends the old charge first and keeps the new one only while the enemy survives', () => {
    const living = fixture(['shield-bash', 'shield-bash'])
    cast(living, 'shield-bash')
    expect(cast(living, 'shield-bash')).toMatchObject({ ok: true, damageDealt: 8 })
    expect(living.statuses.enemy).toEqual([{ id: 'vulnerability', value: 1 }])

    const lethal = fixture(['shield-bash', 'shield-bash'], { health: 13 })
    cast(lethal, 'shield-bash')
    expect(cast(lethal, 'shield-bash')).toMatchObject({ ok: true })
    expect(lethal.result).toBe('victory')
    expect(lethal.statuses).toEqual(createStatuses())
  })

  it('is spent even when armor absorbs the whole hit', () => {
    const state = fixture(['frostbolt', 'sword-strike'])
    state.enemy.armor = 8
    cast(state, 'frostbolt')
    cast(state, 'sword-strike')
    expect(state.enemy.armor).toBe(0)
    expect(hasStatus(state, 'vulnerability')).toBe(false)
  })

  it('disappears from every carrier when the battle ends, by either result', () => {
    const won = fixture(['frostbolt', 'fireball'], { health: 12 })
    cast(won, 'frostbolt')
    applyStatus(won, 'warrior', 'vulnerability')
    cast(won, 'fireball')
    expect(won.result).toBe('victory')
    expect(won.statuses).toEqual(createStatuses())

    const lost = fixture(['frostbolt'])
    cast(lost, 'frostbolt')
    applyStatus(lost, 'mage', 'vulnerability')
    lost.heroes.mage.health = 0
    // The defeat is noticed on the spot; the turn does not continue.
    expect(endTurn(lost)).toBe(false)
    expect(lost.result).toBe('defeat')
    expect(lost.statuses).toEqual(createStatuses())
  })

  it('survives previews untouched and a played action cannot be resolved twice', () => {
    const state = fixture(['frostbolt', 'sword-strike'])
    cast(state, 'frostbolt')
    const before = structuredClone(state)
    for (const id of ['sword-strike', 'frostbolt'] as const) previewCard(state, cardDefinition(id))
    expect(state).toEqual(before)

    const start = startCardPlay(state, state.hand.find(card => card.definitionId === 'sword-strike')!.instanceId)
    if (!start.ok) throw new Error('play did not start')
    expect(start.play.consumedStatuses).toEqual([{ carrier: 'enemy', id: 'vulnerability' }])
    expect(resolveCardPlay(state, start.play.actionId).ok).toBe(true)
    const after = structuredClone(state)
    expect(resolveCardPlay(state, start.play.actionId)).toEqual({ ok: false, reason: 'stale-action' })
    expect(state).toEqual(after)
    expect(state.statuses.enemy).toEqual([])
  })
})

describe('the party defines who a class card belongs to', () => {
  it('finds the owner of a class through the actual party, whatever the legacy keys or names', () => {
    const state = fixture(['frostbolt'])
    expect(cardOwner(state.heroes, cardDefinition('frostbolt'))).toEqual({ ok: true, hero: 'mage' })
    expect(cardOwner(state.heroes, cardDefinition('sword-strike'))).toEqual({ ok: true, hero: 'warrior' })
    // Same party, but the mage sits under the other key and has another name: the rule follows the class.
    const swapped = fixture(['frostbolt'])
    swapped.heroes.warrior.classId = 'mage'
    swapped.heroes.mage.classId = 'warrior'
    swapped.heroes.warrior.characterId = 'someone-else'
    expect(heroForClass(swapped.heroes, 'mage')).toEqual({ ok: true, hero: 'warrior' })
    swapped.heroes.warrior.armor = 2
    expect(previewCard(swapped, cardDefinition('frostbolt'))).toMatchObject({ armorBonus: 2, damage: 6, bonusOwner: { hero: 'warrior', characterId: 'someone-else' } })
  })

  it('applies the class bonus only for the owner and names the owner in the text', () => {
    const state = fixture(['frostbolt', 'thunderbolt'])
    const frostbolt = cardDefinition('frostbolt')
    expect(previewCard(state, frostbolt)).toMatchObject({ armorBonus: 0, damage: 4, bonusOwner: { hero: 'mage', characterId: 'jaina' } })
    state.heroes.warrior.armor = 6
    expect(previewCard(state, frostbolt).armorBonus).toBe(0)
    state.heroes.mage.armor = 1
    const preview = previewCard(state, frostbolt)
    expect(preview).toMatchObject({ armorBonus: 2, damage: 6, bonuses: ['Броня Джайны'] })
    expect(ruleLines(frostbolt, preview)[0]!.text).toBe('+2 — броня Джайны')
    expect(characterGenitive('varian')).toBe('Вариана')
  })

  it('does not pick a hero silently when the class is absent or ambiguous', () => {
    const twins = fixture(['frostbolt', 'interpose'])
    twins.heroes.warrior.classId = 'mage'
    expect(heroForClass(twins.heroes, 'mage')).toEqual({ ok: false, reason: 'ambiguous' })
    twins.heroes.warrior.armor = 3
    twins.heroes.mage.armor = 3
    expect(previewCard(twins, cardDefinition('frostbolt'))).toMatchObject({ armorBonus: 0, damage: 4, bonusOwner: null })
    const interpose = previewCard(twins, cardDefinition('interpose'))
    expect(interpose.armor).toEqual({ warrior: 0, mage: 0 })
    const armorBefore = [twins.heroes.warrior.armor, twins.heroes.mage.armor]
    cast(twins, 'interpose')
    expect([twins.heroes.warrior.armor, twins.heroes.mage.armor]).toEqual(armorBefore)

    const nobody = fixture(['frostbolt'])
    nobody.heroes.mage.classId = 'warrior'
    expect(heroForClass(nobody.heroes, 'mage')).toEqual({ ok: false, reason: 'absent' })
    nobody.heroes.warrior.armor = 4
    expect(previewCard(nobody, cardDefinition('frostbolt')).armorBonus).toBe(0)
  })

  it('keeps threatened, partner and addressed protection meaning what they meant', () => {
    const state = fixture(['guard', 'ice-ward', 'interpose'])
    expect(state.enemy.focus).toBe('warrior')
    expect(resolveArmorTarget(state.heroes, 'threatened', 'warrior')).toBe('warrior')
    expect(resolveArmorTarget(state.heroes, 'partner', 'warrior')).toBe('mage')
    expect(resolveArmorTarget(state.heroes, 'class:mage', 'warrior')).toBe('mage')
    expect(resolveArmorTarget(state.heroes, 'mage', 'warrior')).toBe('mage')
    expect(partnerOf(state.heroes, 'mage')).toBe('warrior')
    expect(heroIdsInPartyOrder(state.heroes)).toEqual(['warrior', 'mage'])
    cast(state, 'ice-ward')
    expect([state.heroes.warrior.armor, state.heroes.mage.armor]).toEqual([3, 2])
    cast(state, 'interpose')
    expect([state.heroes.warrior.armor, state.heroes.mage.armor]).toEqual([3, 7])
  })
})

describe('one damage rule set', () => {
  it('composes parts in order and never lets a reduction push the hit below zero', () => {
    const hit = composeHit([
      { kind: 'base', id: 'card', label: 'Урон', amount: 2 },
      { kind: 'status', id: 'vulnerability', label: 'Уязвимость', amount: 3 },
      { kind: 'artifact', id: 'wedge', label: 'Расклин', amount: -9 },
    ])
    expect(hit.total).toBe(0)
    expect(hit.parts.map(part => part.amount)).toEqual([2, 3, -5])
    expect(splitDamage({ armor: 3, health: 10 }, 5)).toEqual({ absorbed: 3, healthLoss: 2, lethal: false })
    expect(splitDamage({ armor: 0, health: 4 }, 9)).toEqual({ absorbed: 0, healthLoss: 4, lethal: true })
  })

  it('itemises a card hit and agrees with the damage that is actually dealt', () => {
    const state = fixture(['frostbolt', 'frostbolt', 'sword-strike'])
    state.heroes.mage.armor = 2
    cast(state, 'frostbolt')
    state.enemy.armor = 3
    const preview = previewCard(state, cardDefinition('frostbolt'))
    expect(preview.damageParts.map(part => [part.kind, part.amount])).toEqual([['base', 4], ['class-bonus', 2], ['status', 3]])
    expect(preview.damageParts.reduce((sum, part) => sum + part.amount, 0)).toBe(preview.damage)
    const health = state.enemy.health
    const result = cast(state, 'frostbolt')
    if (!result.ok) throw new Error('not played')
    expect(health - state.enemy.health).toBe(preview.healthDamage)
    expect(state.enemy.armor).toBe(0)
    expect(result.damageDealt).toBe(preview.healthDamage)
  })

  it('predicts enemy hits exactly, with a hero status, area damage, armor and the wedge artifact', () => {
    const area: EncounterDefinition = { ...encounters[0]!, behavior: { phase1: [{ kind: 'attack_all', name: 'Волна', damage: 5, primaryTarget: 'warrior' }] } }
    for (const withWedge of [false, true]) {
      const state = createBattle(area, undefined, withWedge ? { seed: 3, artifacts: [{ instanceId: 'a', definitionId: 'reliable-wedge', ownerInstanceId: 'battle/hero/second' }], battleId: 'battle' } : { seed: 3 })
      applyStatus(state, 'mage', 'vulnerability')
      state.heroes.mage.armor = 4
      state.heroes.warrior.armor = 1
      const forecast = forecastEnemyAction(state)
      const [first, second] = forecast.targets
      expect(first).toMatchObject({ target: 'warrior', attack: 5, absorbed: 1, healthLoss: 4, consumedStatuses: [] })
      expect(second).toMatchObject({ target: 'mage', attack: withWedge ? 6 : 8, consumedStatuses: [{ carrier: 'mage', id: 'vulnerability' }] })
      expect(second!.parts.reduce((sum, part) => sum + part.amount, 0)).toBe(second!.attack)
      const hp = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
      endTurn(state)
      expect(hp.warrior - state.heroes.warrior.health).toBe(first!.healthLoss)
      expect(hp.mage - state.heroes.mage.health).toBe(second!.healthLoss)
      expect(hasStatus(state, 'vulnerability', 'mage')).toBe(false)
    }
  })

  it('keeps hero statuses isolated: only the marked hero takes the bonus and only its status is spent', () => {
    const strikes: EncounterDefinition = { ...encounters[0]!, behavior: { phase1: [{ kind: 'attack', name: 'Выпад', damage: 4, target: 'warrior' }, { kind: 'attack', name: 'Выпад', damage: 4, target: 'warrior' }] } }
    const state = createBattle(strikes, undefined, { seed: 3 })
    applyStatus(state, 'mage', 'vulnerability')
    expect(forecastEnemyAction(state).targets[0]).toMatchObject({ target: 'warrior', attack: 4, consumedStatuses: [] })
    endTurn(state)
    expect(hasStatus(state, 'vulnerability', 'mage')).toBe(true)
    applyStatus(state, 'warrior', 'vulnerability')
    const marked = forecastEnemyAction(state).targets[0]!
    expect(marked).toMatchObject({ attack: 7, consumedStatuses: [{ carrier: 'warrior', id: 'vulnerability' }] })
    expect(marked.parts.map(part => part.amount)).toEqual([4, 3])
    const health = state.heroes.warrior.health
    endTurn(state)
    expect(health - state.heroes.warrior.health).toBe(7)
    expect(hasStatus(state, 'vulnerability', 'warrior')).toBe(false)
    expect(hasStatus(state, 'vulnerability', 'mage')).toBe(true)
  })
})

describe('where future statuses plug into the turn (fixtures only)', () => {
  it('ticks at the start of the enemy turn, ignores armor, decays, and ends at zero', () => {
    withFixtureStatus({}, () => {
      const state = fixture(['sword-strike'])
      state.enemy.armor = 5
      applyStatus(state, 'enemy', bleed, 2)
      endTurn(state)
      expect(state.enemy.health).toBe(98)
      expect(state.enemy.armor).toBe(5)
      expect(statusValue(state, 'enemy', bleed)).toBe(1)
      endTurn(state)
      expect(state.enemy.health).toBe(97)
      expect(state.statuses.enemy).toEqual([])
    })
  })

  it('kills the enemy before it acts, and the heroes are untouched', () => {
    withFixtureStatus({}, () => {
      const state = fixture(['sword-strike'], { encounter: encounters[0]! })
      state.enemy.health = 3
      applyStatus(state, 'enemy', bleed, 3)
      const heroes = structuredClone(state.heroes)
      const turn = state.turn
      expect(endTurn(state)).toBe(true)
      expect(state.result).toBe('victory')
      expect(state.heroes).toEqual(heroes)
      expect(state.turn).toBe(turn)
      expect(state.statuses).toEqual(createStatuses())
    })
  })

  it('moves the boss into phase two exactly as ordinary damage does, keeping the announced action', () => {
    withFixtureStatus({}, () => {
      const heart = encounters[2]!
      const viaCard = createBattle(heart, undefined, { seed: 4, deck: ['sword-strike'], openingHandSize: 1 })
      const viaTick = createBattle(heart, undefined, { seed: 4, deck: ['sword-strike'], openingHandSize: 1 })
      viaCard.enemy.health = viaTick.enemy.health = 25
      viaCard.enemy.health = 24
      viaTick.enemy.health = 24
      applyStatus(viaTick, 'enemy', bleed, 2)
      const announced = viaTick.enemy.nextAction
      endTurn(viaTick)
      expect(viaTick.enemy.health).toBe(22)
      expect(viaTick.enemy.phase).toBe(2)
      expect(announced.name).toBe(forecastEnemyAction(viaCard).action.name)
      cast(viaCard, 'sword-strike')
      expect(viaCard.enemy.phase).toBe(2)
      expect(viaCard.enemy.behaviorIndex).toBe(0)
    })
  })

  it('lets an ordinary card effect apply such a status, with its amount, and previews it', () => {
    withFixtureStatus({}, () => {
      const wound: (typeof cards)[number] = { id: 'fixture-wound' as CardId, name: 'Рана', className: 'warrior', cost: 1, description: 'Фикстура.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 2 }, { type: 'status', status: bleed, amount: 3 }] }
      cards.push(wound)
      try {
        const state = fixture(['fixture-wound' as CardId, 'fixture-wound' as CardId])
        expect(previewCard(state, wound).appliedStatuses).toEqual([bleed])
        cast(state, 'fixture-wound' as CardId)
        expect(statusValue(state, 'enemy', bleed)).toBe(3)
        cast(state, 'fixture-wound' as CardId)
        expect(statusValue(state, 'enemy', bleed)).toBe(6)
        endTurn(state)
        expect(state.enemy.health).toBe(100 - 4 - 6)
        expect(statusValue(state, 'enemy', bleed)).toBe(5)
      } finally { cards.splice(cards.indexOf(wound), 1) }
    })
  })

  it('does nothing when no status declares a tick, and Vulnerability never ticks', () => {
    const state = fixture(['sword-strike'])
    applyStatus(state, 'enemy', 'vulnerability')
    const health = state.enemy.health
    endTurn(state)
    expect(state.enemy.health).toBe(health)
    expect(hasStatus(state, 'vulnerability')).toBe(true)
  })
})

describe('artifacts keep their single trigger', () => {
  it('Weakpoint Lens fires once per spent Vulnerability and only once per battle', () => {
    const state = fixture(['frostbolt', 'sword-strike', 'sword-strike', 'frostbolt'])
    state.artifacts = [{ instanceId: 'lens', definitionId: 'weakpoint-lens', ownerInstanceId: state.heroes.warrior.instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false }]
    cast(state, 'frostbolt')
    expect(state.heroes.warrior.armor).toBe(0)
    cast(state, 'sword-strike')
    expect(state.heroes.warrior.armor).toBe(2)
    expect(state.artifactNotices).toHaveLength(1)
    cast(state, 'frostbolt')
    cast(state, 'sword-strike')
    expect(state.heroes.warrior.armor).toBe(2)
    expect(state.artifacts[0]!.usedThisBattle).toBe(true)
  })

  it('Reliable Wedge shows its reduction in the parts and spends exactly once', () => {
    const state = createBattle(encounters[0]!, undefined, { seed: 3, battleId: 'b', artifacts: [{ instanceId: 'w', definitionId: 'reliable-wedge', ownerInstanceId: 'b/hero/second' }] })
    const hit = forecastEnemyAction(state).targets[0]!
    expect(hit).toMatchObject({ target: 'mage', attack: 2, artifactReduction: 2 })
    expect(hit.parts.map(part => [part.kind, part.amount])).toEqual([['base', 4], ['artifact', -2]])
    endTurn(state)
    expect(state.artifacts[0]!.usedThisBattle).toBe(true)
    expect(state.artifactNotices).toHaveLength(1)
  })
})

describe('planner copies and determinism', () => {
  it('copies statuses of every carrier without sharing and keeps them out of the hidden-information seed when absent', () => {
    const state = fixture(['sword-strike'])
    applyStatus(state, 'enemy', 'vulnerability')
    applyStatus(state, 'warrior', 'vulnerability')
    const copy = cloneBattleState(state)
    expect(copy).toEqual(structuredClone(state))
    expect(copy.statuses).not.toBe(state.statuses)
    expect(copy.statuses.enemy).not.toBe(state.statuses.enemy)
    consumeStatus(copy, 'warrior', 'vulnerability')
    expect(statusValue(state, 'warrior', 'vulnerability')).toBe(1)
  })

  it('separates states that differ only by a hero status, but treats the enemy Vulnerability as before', () => {
    const plain = fixture(['sword-strike'])
    const marked = fixture(['sword-strike'])
    applyStatus(marked, 'mage', 'vulnerability')
    expect(observableSeed(marked)).not.toBe(observableSeed(plain))
    const enemyMarked = fixture(['sword-strike'])
    applyStatus(enemyMarked, 'enemy', 'vulnerability')
    expect(observableSeed(enemyMarked)).not.toBe(observableSeed(plain))
    expect(statusSignature(enemyMarked, { carrier: 'enemy', id: 'vulnerability' })).toBe('')
  })

  it('replays identical battles from one seed, statuses included', () => {
    const play = () => {
      const state = createBattle(encounters[2]!, undefined, { seed: 99 })
      const log: unknown[] = []
      for (let turn = 0; turn < 4 && !state.result; turn += 1) {
        for (const card of [...state.hand]) if (cardDefinition(card.definitionId).cost <= state.mana) log.push(playCard(state, card.instanceId))
        log.push(structuredClone(state.statuses))
        endTurn(state)
      }
      return log
    }
    expect(play()).toEqual(play())
  })
})
