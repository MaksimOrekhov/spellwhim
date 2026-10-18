import { describe, expect, it } from 'vitest'
import { createBattle, playCard, previewCard } from './battle'
import {
  availableDungeonNodes, campaignRewardOptions, campaignRewards, createCampaignBattle, createDungeonRun,
  dungeonEncounter, dungeonRewardOptions, enterDungeonNode, resolveDungeonBattle,
} from './campaign'
import { applyStatus, statusValue } from './statuses'
import { cards, cardDefinition, startingDeck } from './types'
import type { CardId, EncounterDefinition, EnemyAction } from './types'
import { cardArt } from '../ui/cardArt'
import { enemyPortraitsByEncounterId, resolveEnemyPortrait } from '../ui/enemyArt'
import { cardNotes, ruleLines } from '../ui/cardDisplay'
import { defaultDungeonRoster } from './encountersV10'
import { publicDungeonNodeView } from './dungeonRoutePolicy'

const expansionIds: readonly CardId[] = [
  'stance-strike', 'wound-clamp', 'covering-counter', 'crushing-swing',
  'arcane-mark', 'ice-echo', 'frost-seal', 'blood-resonance',
]

const action = (next: EnemyAction = { kind: 'attack', name: 'Тестовый удар', damage: 3, target: 'warrior' }): EncounterDefinition => ({
  id: 'card-pool-test', name: 'Чучело', title: 'Тестовая цель', maxHealth: 40, appearance: 'defias', mapLabel: 'Тест',
  behavior: { phase1: [next] },
})

function fight(hand: CardId[], next?: EnemyAction): ReturnType<typeof createBattle> {
  const state = createBattle(action(next), undefined, { seed: 7, deck: [] })
  state.hand = hand.map((definitionId, index) => ({ instanceId: `card/${index}`, definitionId }))
  state.drawPile = []
  state.mana = state.maxMana = 10
  return state
}

function rewardRun(seed: number) {
  let run = createDungeonRun(seed)
  const node = availableDungeonNodes(run).find(candidate => candidate.type === 'battle')!
  run = enterDungeonNode(run, node.id)
  const battle = createCampaignBattle({
    encounter: dungeonEncounter(node), heroes: run.heroes, deck: run.deck,
    seed: seed + 1, battleId: `card-pool-test/${seed}`,
  })
  battle.result = 'victory'
  return resolveDungeonBattle(run, battle)
}

describe('Card Pool Expansion v0.1', () => {
  it('adds eight reward definitions while keeping the 18-card starting deck intact', () => {
    expect(expansionIds).toHaveLength(8)
    expect(new Set(expansionIds).size).toBe(8)
    expect(startingDeck).toHaveLength(18)
    expect(expansionIds.every(id => !startingDeck.includes(id))).toBe(true)
    expect(expansionIds.every(id => cards.find(card => card.id === id)?.reward)).toBe(true)
    expect(cards.filter(card => expansionIds.includes(card.id))).toHaveLength(8)
  })

  it('keeps the historical Balance Lab offers unchanged and adds new cards only to seeded dungeon rewards', () => {
    const battle = createBattle(action(), undefined, { seed: 19, deck: [] })
    const historical = campaignRewardOptions(battle, 20).map(card => card.id).sort()
    expect(historical).toEqual(['arcane-insight', 'bastion', 'frostbolt', 'ice-ward', 'interpose', 'parry', 'quick-cut', 'shield-bash', 'thunderbolt'].sort())
    expect(historical.some(id => expansionIds.includes(id))).toBe(false)
    expect(campaignRewards().filter(card => expansionIds.includes(card.id))).toHaveLength(8)

    const first = rewardRun(13)
    expect(dungeonRewardOptions(first)).toEqual(dungeonRewardOptions(rewardRun(13)))
    const expansionAppears = Array.from({ length: 64 }, (_, seed) => rewardRun(seed)).some(run =>
      dungeonRewardOptions(run).some(card => expansionIds.includes(card.id)),
    )
    expect(expansionAppears).toBe(true)
  })

  it('turns Warrior armor into damage without changing the party armor recipient', () => {
    const state = fight(['stance-strike'])
    state.heroes.warrior.armor = 1
    const preview = previewCard(state, cardDefinition('stance-strike'))
    expect(preview.damage).toBe(5)
    expect(preview.armor.mage).toBe(2)
    expect(playCard(state, 'card/0')).toMatchObject({ ok: true })
    expect(state.enemy.health).toBe(35)
    expect(state.heroes.mage.armor).toBe(2)
  })

  it('ticks Bleeding through enemy armor before granting protection', () => {
    const state = fight(['wound-clamp'])
    state.enemy.armor = 8
    applyStatus(state, 'enemy', 'bleeding', 3)
    const preview = previewCard(state, cardDefinition('wound-clamp'))
    expect(preview.statusDamage).toBe(3)
    expect(preview.armor.warrior).toBe(3)
    playCard(state, 'card/0')
    expect(state.enemy.health).toBe(37)
    expect(state.enemy.armor).toBe(8)
    expect(state.heroes.warrior.armor).toBe(3)
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(2)
  })

  it('makes the defensive counter conditional on an attack while protecting both party members', () => {
    const attacking = fight(['covering-counter'])
    expect(previewCard(attacking, cardDefinition('covering-counter'))).toMatchObject({
      damage: 3,
      armor: { warrior: 7, mage: 0 },
    })
    const preparing = fight(['covering-counter'], {
      kind: 'prepare', name: 'Замах', prepared: { kind: 'attack', name: 'Удар', damage: 8, target: 'warrior' },
    })
    expect(previewCard(preparing, cardDefinition('covering-counter'))).toMatchObject({
      damage: 0,
      armor: { warrior: 7, mage: 0 },
    })
    expect(ruleLines(cardDefinition('covering-counter'), previewCard(preparing, cardDefinition('covering-counter')))[0]).toMatchObject({ tone: 'off' })
  })

  it('consumes the old Vulnerability on a heavy hit, then leaves the newly applied charge', () => {
    const state = fight(['crushing-swing'])
    applyStatus(state, 'enemy', 'vulnerability')
    const preview = previewCard(state, cardDefinition('crushing-swing'))
    expect(preview.damage).toBe(12)
    playCard(state, 'card/0')
    expect(state.enemy.health).toBe(28)
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(1)
  })

  it('sets up a card drawn by Arcane Mark so it can use Vulnerability immediately', () => {
    const state = fight(['arcane-mark'])
    state.drawPile = [{ instanceId: 'drawn-echo', definitionId: 'ice-echo' }]
    playCard(state, 'card/0')
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(1)
    expect(state.hand).toEqual([{ instanceId: 'drawn-echo', definitionId: 'ice-echo' }])
    const preview = previewCard(state, cardDefinition('ice-echo'))
    expect(preview.damage).toBe(5)
    expect(preview.draw).toBe(1)
    playCard(state, 'drawn-echo')
    expect(state.enemy.health).toBe(35)
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(0)
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(1)
  })

  it('gives Ice Echo a Bleeding setup and draw role without raising its existing damage', () => {
    const state = fight(['ice-echo', 'blood-resonance'])
    applyStatus(state, 'enemy', 'bleeding', 3)
    state.drawPile = [{ instanceId: 'drawn-after-echo', definitionId: 'guard' }]

    const echo = previewCard(state, cardDefinition('ice-echo'))
    expect(echo).toMatchObject({ damage: 2, draw: 1 })
    expect(cardNotes(cardDefinition('ice-echo'), echo).keywords.map(item => item.name)).toContain('Кровотечение')
    playCard(state, 'card/0')
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(4)
    expect(state.hand).toEqual([
      { instanceId: 'card/1', definitionId: 'blood-resonance' },
      { instanceId: 'drawn-after-echo', definitionId: 'guard' },
    ])

    const resonance = previewCard(state, cardDefinition('blood-resonance'))
    expect(resonance.damage).toBe(7)
    playCard(state, 'card/1')
    expect(state.enemy.health).toBe(31)
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(0)
  })

  it('keeps Crushing Swing viable as a 3→4→5 mana setup and follow-up line', () => {
    const standalone = fight(['crushing-swing'])
    standalone.mana = 3
    expect(playCard(standalone, 'card/0')).toMatchObject({ ok: true })
    expect(standalone.enemy.health).toBe(31)
    expect(statusValue(standalone, 'enemy', 'vulnerability')).toBe(1)

    const fourMana = fight(['crushing-swing', 'sword-strike'])
    fourMana.mana = 4
    playCard(fourMana, 'card/0')
    playCard(fourMana, 'card/1')
    expect(fourMana.enemy.health).toBe(22)
    expect(statusValue(fourMana, 'enemy', 'vulnerability')).toBe(0)

    const fiveMana = fight(['crushing-swing', 'fireball'])
    fiveMana.mana = 5
    playCard(fiveMana, 'card/0')
    playCard(fiveMana, 'card/1')
    expect(fiveMana.enemy.health).toBe(20)
    expect(statusValue(fiveMana, 'enemy', 'vulnerability')).toBe(0)
  })

  it('bridges Bleeding into Vulnerability and spends both statuses in a mage payoff', () => {
    const bridge = fight(['frost-seal'])
    bridge.enemy.armor = 6
    applyStatus(bridge, 'enemy', 'bleeding', 3)
    playCard(bridge, 'card/0')
    expect(bridge.enemy.health).toBe(37)
    expect(bridge.enemy.armor).toBe(6)
    expect(statusValue(bridge, 'enemy', 'bleeding')).toBe(2)
    expect(statusValue(bridge, 'enemy', 'vulnerability')).toBe(1)

    const payoff = fight(['blood-resonance'])
    applyStatus(payoff, 'enemy', 'bleeding', 2)
    applyStatus(payoff, 'enemy', 'vulnerability')
    payoff.drawPile = [{ instanceId: 'drawn-after-resonance', definitionId: 'guard' }]
    const preview = previewCard(payoff, cardDefinition('blood-resonance'))
    expect(preview.damage).toBe(8)
    expect(preview.damageParts.map(part => part.id)).toEqual(['card', 'vulnerability', 'bleeding-burst'])
    expect(cardNotes(cardDefinition('blood-resonance'), preview).damage?.formula).toBe('3 + 3 + 2 = 8')
    expect(ruleLines(cardDefinition('blood-resonance'), preview).find(line => line.glyph === 'bleeding')?.text).toContain('+2')
    playCard(payoff, 'card/0')
    expect(payoff.enemy.health).toBe(32)
    expect(statusValue(payoff, 'enemy', 'bleeding')).toBe(0)
    expect(statusValue(payoff, 'enemy', 'vulnerability')).toBe(0)
    expect(payoff.hand).toEqual([{ instanceId: 'drawn-after-resonance', definitionId: 'guard' }])

    const waiting = fight(['blood-resonance'])
    expect(ruleLines(cardDefinition('blood-resonance'), previewCard(waiting, cardDefinition('blood-resonance'))).find(line => line.glyph === 'bleeding')?.text).toBe('+1 за каждую силу Кровотечения')
  })

  it('keeps new card effects inside the shared artifact rules', () => {
    const lens = fight(['arcane-mark', 'ice-echo'])
    lens.artifacts = [{
      instanceId: 'lens/1', definitionId: 'weakpoint-lens', ownerInstanceId: lens.heroes.warrior.instanceId,
      usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false,
    }]
    playCard(lens, 'card/0')
    const echoPreview = previewCard(lens, cardDefinition('ice-echo'))
    expect(echoPreview.vulnerabilityBonus).toBe(3)
    expect(echoPreview.artifactArmor.warrior).toBe(2)
    expect(echoPreview.artifactBonuses).toContain('Уязвимость была израсходована')
    playCard(lens, 'card/1')
    expect(lens.heroes.warrior.armor).toBe(2)
    expect(lens.artifacts[0]?.usedThisBattle).toBe(true)

    const pulley = fight(['covering-counter'], { kind: 'attack', name: 'Удар', damage: 8, target: 'warrior' })
    pulley.artifacts = [{
      instanceId: 'pulley/1', definitionId: 'double-pulley', ownerInstanceId: pulley.heroes.warrior.instanceId,
      usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false,
    }]
    const counterPreview = previewCard(pulley, cardDefinition('covering-counter'))
    expect(counterPreview.armor.warrior).toBe(7)
    expect(counterPreview.artifactArmor.mage).toBe(2)
    playCard(pulley, 'card/0')
    expect(pulley.heroes.mage.armor).toBe(2)
  })

  it('leaves draft card art unintegrated with a readable UI fallback and supports ID-based enemy art', () => {
    expect(expansionIds.every(id => !cardArt[id])).toBe(true)
    const state = fight(['ice-echo'])
    const cardPreview = previewCard(state, cardDefinition('ice-echo'))
    expect(cardNotes(cardDefinition('ice-echo'), cardPreview).description).toBe(cardDefinition('ice-echo').description)
    expect(resolveEnemyPortrait('goblin-powder-runner')).toMatchObject({ fallback: false })
    expect(resolveEnemyPortrait('defias-lookout/layer-3-column-2').src).toContain('enemy-defias-lookout-krea.webp')
    expect(resolveEnemyPortrait('mine-overseer').src).toContain('enemy-mine-overseer-krea.webp')
    expect(resolveEnemyPortrait('defias-veteran').src).toContain('enemy-defias-veteran.jpg')
    expect(resolveEnemyPortrait('defias-lookout').src).toContain('enemy-defias-lookout-krea.webp')
    expect(resolveEnemyPortrait('defias-cutpurse').src).toContain('enemy-defias-cutpurse-krea.webp')
    expect(resolveEnemyPortrait('defias-deckhand').src).toContain('enemy-defias-deckhand-krea.webp')
    expect(resolveEnemyPortrait('foundry-tinkerer').src).toContain('enemy-foundry-tinkerer.jpg')
    expect(resolveEnemyPortrait('goblin-foundry-chief').src).toContain('enemy-goblin-foundry-chief.jpg')
    expect(resolveEnemyPortrait('twilight-heart').src).toContain('enemy-twilight-heart.jpg')
    expect(resolveEnemyPortrait('goblin-powder-runner', { 'goblin-powder-runner': 'approved-goblin.jpg' })).toEqual({ src: 'approved-goblin.jpg', fallback: false })
    expect(resolveEnemyPortrait('unknown-encounter')).toMatchObject({ fallback: true })
    expect(state.enemy.encounterId).toBe('card-pool-test')

    const encounterIds = [
      ...defaultDungeonRoster.normal.map(encounter => encounter.id),
      ...defaultDungeonRoster.elite.map(encounter => encounter.id),
      ...(defaultDungeonRoster.final ? [defaultDungeonRoster.final.id] : []),
    ]
    expect(encounterIds).toHaveLength(9)
    expect(new Set(encounterIds).size).toBe(9)
    expect(encounterIds.every(id => !resolveEnemyPortrait(id).fallback)).toBe(true)
    expect(Object.keys(enemyPortraitsByEncounterId)).toHaveLength(9)

    const map = createDungeonRun(2026).map
    const hiddenNode = map.layers.flat().find(node => node.encounterId)!
    const publicNode = publicDungeonNodeView(hiddenNode)
    expect(publicNode).not.toHaveProperty('encounterId')
    expect(publicNode).not.toHaveProperty('encounterHealth')
    expect(JSON.stringify(publicNode)).not.toContain(hiddenNode.encounterId!)
  })
})
