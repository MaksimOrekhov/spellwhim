import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { cloneBattleState, planTurn } from './balancePlanner'
import { armorChoice, createBattle, endTurn, playCard, previewCard, startCardPlay } from './battle'
import { statusValue, applyStatus } from './statuses'
import { acquiredCopy, availableDungeonNodes, campaignRewards, claimDungeonArtifact, claimDungeonReward, createDungeonRun, createSectorRun, dungeonArtifactOptions, dungeonRewardOptions, dungeonRunPhase, enterDungeonNode, enumerateDungeonPaths, GOLD_REWARD_CHOICES, offerDeckOperation, confirmDeckOperation, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle, skipDungeonReward, upgradeDungeonRest } from './campaign'
import type { DungeonRunState } from './campaign'
import { availableGoldCards, canUpgradeCard, resolveCardDefinition } from './cardProgression'
import { upgradedDefinition } from './cardUpgrades'
import { createRoomVisit, resolveRoom } from './dungeonRooms'
import { honestEconomies } from './economy'
import { honestDeck } from './honestDecks'
import { decodeSnapshot, encodeSnapshot, LONG_SECTOR_CATALOG_VERSION, sectorCatalogFor, validateRun } from './runSave'
import { sectorLongConfig } from './sectorLong'
import { cardDefinition, cards, experimentalCards, goldCards } from './types'
import type { BattleState, CardId, EncounterDefinition, GoldCardId } from './types'
import { cardNotes, cardFace, neutralPreview, ruleLines } from '../ui/cardDisplay'
import EliteReward from '../components/EliteReward.vue'

const economy = honestEconomies['honest-b2-long']
const goldIds = goldCards.map(card => card.id as GoldCardId)
const last = <T>(items: readonly T[]): T => items[items.length - 1]!

const dummy = (health: number, behavior: EncounterDefinition['behavior'] = { phase1: [{ kind: 'attack', name: 'Тычок', damage: 3, target: 'warrior' }] }): EncounterDefinition => ({
  id: 'dummy', name: 'Чучело', title: 'Мишень', maxHealth: health, appearance: 'defias', mapLabel: 'тест', behavior,
})
const both: EncounterDefinition['behavior'] = { phase1: [{ kind: 'attack_all', name: 'Волна', damage: 3, primaryTarget: 'warrior' }] }
function fight(hand: CardId[] = [], health = 40, behavior?: EncounterDefinition['behavior']): BattleState {
  const state = createBattle(dummy(health, behavior), undefined, { seed: 3 })
  state.hand = hand.map((id, index) => ({ instanceId: `t/${index}`, definitionId: id }))
  state.mana = state.maxMana = 10
  return state
}
const damageOf = (state: BattleState, id: CardId) => previewCard(state, cardDefinition(id)).damage

// ── a run that has just beaten its first elite ──────────────────────────────────────────────────
function winBattle(run: DungeonRunState): DungeonRunState {
  const battle = restoreDungeonBattle(run, economy)
  battle.result = 'victory'
  battle.enemy.health = 0
  return resolveDungeonBattle(run, battle)
}
function eliteReward(seed = 11, gold = true): DungeonRunState {
  let run = createSectorRun(seed, economy, honestDeck('armor8', true), undefined, 'gold-run')
  if (!gold) delete run.goldRewards
  const path = enumerateDungeonPaths(run.map).find(nodes => nodes.some(node => node.type === 'elite'))!
  for (const node of path) {
    run = enterDungeonNode(run, node.id)
    if (node.type === 'battle' || node.type === 'elite') {
      run = winBattle(run)
      if (node.type === 'elite') return run
      run = skipDungeonReward(run, run.pendingReward!.id)
    } else if (node.type === 'rest') run = resolveDungeonRest(run, null)
    else run = resolveRoom(run, { roomId: run.room!.id, action: 'leave' })
  }
  throw new Error('no elite on the route')
}
const roundTrip = (run: DungeonRunState) => decodeSnapshot(encodeSnapshot(run, economy, 3)).run

describe('the gold catalogue (GDD G01–G04)', () => {
  it('has the four cards, two per class, 2 mana, exhausting, apart from the ordinary catalogue', () => {
    expect(goldIds).toEqual(['commanders-order', 'bloody-finale', 'weakpoint-verdict', 'concerted-volley'])
    expect(goldCards.filter(card => card.className === 'warrior')).toHaveLength(2)
    expect(goldCards.filter(card => card.className === 'mage')).toHaveLength(2)
    for (const card of goldCards) {
      expect(card.cost).toBe(2)
      expect(card.exhaust).toBe(true)
      expect(card.rarity).toBe('gold')
      expect(cardDefinition(card.id)).toBe(card)
      expect(cards.some(ordinary => ordinary.id === card.id)).toBe(false)
      expect(campaignRewards().some(ordinary => ordinary.id === card.id)).toBe(false)
    }
    expect([...cards, ...experimentalCards].some(card => card.rarity === 'gold')).toBe(false)
  })

  it('has no upgraded version: the forge, the rest and the engine all refuse it', () => {
    for (const id of goldIds) {
      expect(canUpgradeCard({ definitionId: id, upgrade: 0 })).toBe(false)
      expect(() => upgradedDefinition(cardDefinition(id))).toThrow()
    }
  })
})

describe('Commander\'s Order', () => {
  it('gives 5 armor to each hero, draws one card, costs 2 and leaves the battle', () => {
    const state = fight(['commanders-order'])
    const drawPile = state.drawPile.length
    const result = playCard(state, 't/0')
    expect(result.ok).toBe(true)
    expect(state.heroes.warrior.armor).toBe(5)
    expect(state.heroes.mage.armor).toBe(5)
    expect(state.mana).toBe(8)
    expect(state.hand).toHaveLength(1)
    expect(state.drawPile.length).toBe(drawPile - 1)
    expect(state.exhausted.map(card => card.instanceId)).toEqual(['t/0'])
    expect(state.discardPile).toHaveLength(0)
  })

  it('gives the same armor whoever the enemy aims at, so against a hit on both heroes nobody is asked', () => {
    const aimedAtMage = fight(['commanders-order'], 40, { phase1: [{ kind: 'attack', name: 'Укол', damage: 3, target: 'mage' }] })
    playCard(aimedAtMage, 't/0')
    expect([aimedAtMage.heroes.warrior.armor, aimedAtMage.heroes.mage.armor]).toEqual([5, 5])
    const wave = fight(['commanders-order', 'bastion'], 40, both)
    expect(armorChoice(wave, 't/0')).toBeNull()
    // The question is still asked for a card whose shares differ.
    expect(armorChoice(wave, 't/1')).not.toBeNull()
  })

  it('does not draw past the hand limit, and a draw pile that is empty is no failure', () => {
    const full = fight(['commanders-order', ...Array<CardId>(10).fill('sword-strike')])
    const drawPile = full.drawPile.length
    playCard(full, 't/0')
    expect(full.hand).toHaveLength(10)
    expect(full.drawPile).toHaveLength(drawPile)
    expect(full.heroes.mage.armor).toBe(5)
  })
})

describe('Bloody Finale', () => {
  it('deals 6, +2 per point of Bleeding, removes the whole status and gives 3 armor to the threatened hero', () => {
    const state = fight(['bloody-finale'])
    applyStatus(state, 'enemy', 'bleeding', 3)
    const preview = previewCard(state, cardDefinition('bloody-finale'))
    expect(preview.damage).toBe(12)
    playCard(state, 't/0')
    expect(state.enemy.health).toBe(28)
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(0)
    expect(state.heroes.warrior.armor).toBe(3)
    expect(state.heroes.mage.armor).toBe(0)
    expect(state.mana).toBe(8)
    expect(state.exhausted).toHaveLength(1)
  })

  it('is a plain 6 without Bleeding, and the cap of 5 bounds the burst', () => {
    const plain = fight(['bloody-finale'])
    playCard(plain, 't/0')
    expect(plain.enemy.health).toBe(34)
    const capped = fight(['bloody-finale'])
    applyStatus(capped, 'enemy', 'bleeding', 9)
    expect(statusValue(capped, 'enemy', 'bleeding')).toBe(5)
    playCard(capped, 't/0')
    expect(capped.enemy.health).toBe(40 - 16)
  })

  it('goes through the chain: Vulnerability first (+3, spent), then enemy armor absorbs, Bleeding is spent either way', () => {
    const state = fight(['bloody-finale'])
    applyStatus(state, 'enemy', 'bleeding', 2)
    applyStatus(state, 'enemy', 'vulnerability')
    state.enemy.armor = 8
    const preview = previewCard(state, cardDefinition('bloody-finale'))
    expect(preview.damage).toBe(6 + 4 + 3)
    expect(preview.armorDamage).toBe(8)
    expect(preview.healthDamage).toBe(5)
    playCard(state, 't/0')
    expect(state.enemy.armor).toBe(0)
    expect(state.enemy.health).toBe(35)
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(0)
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(0)
  })

  it('a killing blow ends the play before the armor is given', () => {
    const state = fight(['bloody-finale'], 10)
    applyStatus(state, 'enemy', 'bleeding', 3)
    playCard(state, 't/0')
    expect(state.result).toBe('victory')
    expect(state.heroes.warrior.armor).toBe(0)
  })

  it('armor goes to the hero the party chooses against a hit on both heroes', () => {
    const state = fight(['bloody-finale'], 40, both)
    const choice = armorChoice(state, 't/0')!
    expect(choice.options).toHaveLength(2)
    playCard(state, 't/0', 'mage')
    expect([state.heroes.warrior.armor, state.heroes.mage.armor]).toEqual([0, 3])
  })
})

describe('Verdict on the Weak Point', () => {
  it('deals 7, applies Vulnerability and draws one card', () => {
    const state = fight(['weakpoint-verdict'])
    const drawPile = state.drawPile.length
    playCard(state, 't/0')
    expect(state.enemy.health).toBe(33)
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(1)
    expect(state.hand).toHaveLength(1)
    expect(state.drawPile.length).toBe(drawPile - 1)
    expect(state.mana).toBe(8)
    expect(state.exhausted).toHaveLength(1)
  })

  it('first spends the Vulnerability already there (+3), then leaves a new one if the enemy lives', () => {
    const state = fight(['weakpoint-verdict'])
    applyStatus(state, 'enemy', 'vulnerability')
    expect(damageOf(state, 'weakpoint-verdict')).toBe(10)
    playCard(state, 't/0')
    expect(state.enemy.health).toBe(30)
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(1)
  })

  it('a killing blow applies no status and draws nothing', () => {
    const state = fight(['weakpoint-verdict'], 7)
    const drawPile = state.drawPile.length
    playCard(state, 't/0')
    expect(state.result).toBe('victory')
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(0)
    expect(state.drawPile).toHaveLength(drawPile)
  })

  it('makes the next damaging card of either class 3 harder', () => {
    const state = fight(['weakpoint-verdict', 'sword-strike'])
    playCard(state, 't/0')
    expect(damageOf(state, 'sword-strike')).toBe(9)
  })
})

describe('Concerted Volley', () => {
  it('deals 7 alone and draws one card', () => {
    const state = fight(['concerted-volley'])
    const drawPile = state.drawPile.length
    expect(damageOf(state, 'concerted-volley')).toBe(7)
    playCard(state, 't/0')
    expect(state.enemy.health).toBe(33)
    expect(state.drawPile.length).toBe(drawPile - 1)
    expect(state.mana).toBe(8)
    expect(state.exhausted).toHaveLength(1)
  })

  it('gets +2 once a card of the other class has been played this turn, whatever that card did', () => {
    for (const other of ['sword-strike', 'guard', 'quick-cut'] as const) {
      const state = fight([other, 'concerted-volley'])
      playCard(state, 't/0')
      expect(state.classesPlayedThisTurn).toEqual(['warrior'])
      const preview = previewCard(state, cardDefinition('concerted-volley'))
      expect(preview.damage, other).toBe(9)
      expect(preview.damageParts.map(part => part.id)).toEqual(['card', 'other-class'])
      const health = state.enemy.health
      playCard(state, 't/1')
      expect(health - state.enemy.health, other).toBe(9)
    }
  })

  it('stays at 7 after a card of its own class, after itself, or before the other class', () => {
    const own = fight(['arcane-insight', 'concerted-volley'])
    playCard(own, 't/0')
    expect(damageOf(own, 'concerted-volley')).toBe(7)
    const first = fight(['concerted-volley', 'sword-strike'])
    playCard(first, 't/0')
    expect(first.enemy.health).toBe(33)
    expect(first.classesPlayedThisTurn).toEqual(['mage'])
    // The bonus is not retroactive and the second card does not change the first.
    playCard(first, 't/1')
    expect(first.enemy.health).toBe(27)
  })

  it('reads the class of the card, not of a hero: the same in any party', () => {
    const state = fight(['sword-strike', 'concerted-volley'])
    state.heroes.warrior.classId = 'mage'
    playCard(state, 't/0')
    expect(damageOf(state, 'concerted-volley')).toBe(9)
    const swapped = fight(['arcane-insight', 'concerted-volley'])
    swapped.heroes.mage.classId = 'warrior'
    playCard(swapped, 't/0')
    expect(damageOf(swapped, 'concerted-volley')).toBe(7)
  })

  it('forgets the history when the enemy\'s turn ends, and does not carry it across battles', () => {
    const state = fight(['sword-strike', 'concerted-volley'])
    playCard(state, 't/0')
    expect(state.classesPlayedThisTurn).toEqual(['warrior'])
    endTurn(state)
    expect(state.classesPlayedThisTurn).toEqual([])
    expect(damageOf(state, 'concerted-volley')).toBe(7)
    expect(createBattle(dummy(10)).classesPlayedThisTurn).toEqual([])
  })

  it('only a resolved play counts: a card still in flight is not history, and a refused play adds nothing', () => {
    const state = fight(['sword-strike', 'concerted-volley'])
    const start = startCardPlay(state, 't/0')
    expect(start.ok).toBe(true)
    expect(state.classesPlayedThisTurn).toEqual([])
    const poor = fight(['concerted-volley'])
    poor.mana = 1
    expect(playCard(poor, 't/0')).toEqual({ ok: false, reason: 'mana' })
    expect(poor.classesPlayedThisTurn).toEqual([])
    expect(poor.hand).toHaveLength(1)
  })

  it('stacks with Vulnerability in the fixed order: base, class bonus, status', () => {
    const state = fight(['sword-strike', 'concerted-volley'])
    playCard(state, 't/0')
    applyStatus(state, 'enemy', 'vulnerability')
    const preview = previewCard(state, cardDefinition('concerted-volley'))
    expect(preview.damage).toBe(12)
    expect(preview.damageParts.map(part => part.kind)).toEqual(['base', 'class-bonus', 'status'])
    expect(preview.armorBonus).toBe(0)
    expect(preview.vulnerabilityBonus).toBe(3)
    expect(preview.bonusDamage).toBe(5)
  })
})

describe('the Balance Lab planner with gold', () => {
  it('copies the class history and opens with the other class, because the search sees the +2', () => {
    const state = createBattle(dummy(500), undefined, { deck: ['concerted-volley', 'sword-strike'], seed: 4, openingHandSize: 2 })
    state.mana = state.maxMana = 10
    const copy = cloneBattleState(state)
    expect(copy.classesPlayedThisTurn).not.toBe(state.classesPlayedThisTurn)
    const plan = planTurn(state, { profile: { health: 0, keep: 0, armorKeep: 0, lowHealth: 0 }, limits: { beamWidth: 100_000, maxNodes: 1_000_000, maxDepth: 20 } })
    // The Volley is worth 9 after the Strike and 7 before it: the best turn opens with the Strike.
    expect(plan.sequence[0]).toBe('sword-strike')
    expect(plan.sequence).toContain('concerted-volley')
  })
})

describe('how gold reads on screen', () => {
  const cold = fight(['concerted-volley'])
  const warm = fight(['sword-strike', 'concerted-volley'])
  playCard(warm, 't/0')
  it('shows the Volley condition as waiting, then active, in the rule lines and the notes', () => {
    const volley = cardDefinition('concerted-volley')
    expect(ruleLines(volley, previewCard(cold, volley))).toEqual([expect.objectContaining({ tone: 'off', text: expect.stringContaining('другого класса') })])
    expect(ruleLines(volley, previewCard(warm, volley))).toEqual([expect.objectContaining({ tone: 'on', text: expect.stringContaining('+2') })])
    expect(cardNotes(volley, previewCard(cold, volley)).conditions[0]).toMatchObject({ tone: 'off' })
    const active = cardNotes(volley, previewCard(warm, volley))
    expect(active.damage).toMatchObject({ total: 9, formula: '7 + 2 = 9' })
    expect(active.subtitle).toContain('Золотая')
    expect(cardFace(volley, previewCard(warm, volley)).chips[0]).toMatchObject({ kind: 'damage', value: 9, boosted: true })
  })

  it('previews every gold card without a board (the reward screen) and says it exhausts', () => {
    for (const card of goldCards) {
      const face = cardFace(card, neutralPreview(card))
      expect(face.chips.length, card.id).toBeGreaterThan(0)
      expect(face.tags.some(tag => tag.id === 'exhaust'), card.id).toBe(true)
    }
  })
})

describe('the elite reward', () => {
  it('offers three different gold cards of the catalogue next to the usual artifacts, and an ordinary fight still offers three ordinary cards', () => {
    const run = eliteReward()
    const offer = run.pendingReward!
    expect(offer.elite).toBe(true)
    expect(offer.rarity).toBe('gold')
    expect(offer.count).toBe(GOLD_REWARD_CHOICES)
    expect(offer.cards).toHaveLength(3)
    expect(new Set(offer.cards.map(card => card.definitionId)).size).toBe(3)
    for (const card of offer.cards) {
      expect(goldIds).toContain(card.definitionId)
      expect(card.upgrade).toBe(0)
    }
    expect(dungeonRewardOptions(run).every(card => card.rarity === 'gold')).toBe(true)
    expect(dungeonArtifactOptions(run).length).toBeGreaterThan(0)

    let ordinary = createSectorRun(11, economy, honestDeck('armor8', true), undefined, 'ordinary')
    ordinary = enterDungeonNode(ordinary, availableDungeonNodes(ordinary).find(node => node.type === 'battle')!.id)
    ordinary = winBattle(ordinary)
    expect(ordinary.pendingReward!.elite).toBe(false)
    expect(ordinary.pendingReward!.rarity).toBeUndefined()
    expect(ordinary.pendingReward!.cards).toHaveLength(3)
    expect(dungeonRewardOptions(ordinary).every(card => card.rarity === undefined && !!card.reward)).toBe(true)
  })

  it('is decided by the seed, not by the order the player asks in', () => {
    expect(eliteReward(11).pendingReward).toEqual(eliteReward(11).pendingReward)
    const offers = new Set([11, 12, 13, 14, 15, 16].map(seed => eliteReward(seed).pendingReward!.cards.map(card => card.definitionId).sort().join()))
    expect(offers.size).toBeGreaterThan(1)
  })

  it('every offer holds at least one gold card of each class, so the choice is never one-class only', () => {
    for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
      const classes = new Set(dungeonRewardOptions(eliteReward(seed)).map(card => card.className))
      expect(classes, String(seed)).toEqual(new Set(['warrior', 'mage']))
    }
  })

  it('taking a gold card adds one permanent copy, closes the reward, and shows in the journal', () => {
    const run = eliteReward()
    const pick = dungeonRewardOptions(run)[1]!
    const next = claimDungeonReward(run, pick)
    expect(next.pendingReward).toBeNull()
    expect(next.deck).toHaveLength(run.deck.length + 1)
    expect(last(next.deck)).toEqual({ instanceId: `gold-run/card/${run.nextCardId}`, definitionId: pick.id, upgrade: 0 })
    expect(next.nextCardId).toBe(run.nextCardId + 1)
    expect(next.decisions).toContain(run.pendingReward!.id)
    expect(last(next.journal!).text).toBe(`Золотая карта: ${pick.name}`)
    expect(dungeonRunPhase(next)).toBe('map')
    expect(() => claimDungeonReward(next, pick, run.pendingReward!.id)).toThrow()
  })

  it('refuses a card outside the offer, an ordinary card, and a second claim', () => {
    const run = eliteReward()
    const outside = goldCards.find(card => !run.pendingReward!.cards.some(offered => offered.definitionId === card.id))!
    expect(() => claimDungeonReward(run, outside)).toThrow()
    expect(() => claimDungeonReward(run, cardDefinition('sword-strike'))).toThrow()
    expect(() => skipDungeonReward(run, run.pendingReward!.id)).toThrow()
  })

  it('the artifact is still an alternative: taking it closes the offer without a gold card', () => {
    const run = eliteReward()
    const artifact = run.pendingReward!.artifactIds[0]!
    const next = claimDungeonArtifact(run, artifact, run.heroes.warrior.instanceId)
    expect(next.pendingReward).toBeNull()
    expect(next.deck).toEqual(run.deck)
    expect(next.artifacts).toHaveLength(1)
  })

  it('a gold card is unique in the deck: the offer leaves out what the deck holds, and falls back to the usual five when nothing is left', () => {
    const run = eliteReward()
    const one = { ...run, pendingReward: null }
    const holding = (ids: GoldCardId[]): DungeonRunState => ({ ...one, deck: [...one.deck, ...ids.map((id, index) => ({ instanceId: `gold-run/card/${900 + index}`, definitionId: id, upgrade: 0 as const }))] })
    expect(availableGoldCards(holding(['commanders-order']).deck).map(card => card.id)).toEqual(['bloody-finale', 'weakpoint-verdict', 'concerted-volley'])
    expect(availableGoldCards(holding([...goldIds]).deck)).toEqual([])
    expect(() => acquiredCopy(holding(['bloody-finale']), { definitionId: 'bloody-finale', upgrade: 0 })).toThrow()
    expect(() => acquiredCopy(one, { definitionId: 'bloody-finale', upgrade: 1 })).toThrow()
    expect(acquiredCopy(one, { definitionId: 'bloody-finale', upgrade: 0 }).definitionId).toBe('bloody-finale')
  })

  it('a removed gold card may come back later (GDD §5.1: uniqueness is by what the deck holds)', () => {
    const run = eliteReward()
    const taken = claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
    const gold = last(taken.deck)
    expect(availableGoldCards(taken.deck).some(card => card.id === gold.definitionId)).toBe(false)
    const removing = offerDeckOperation({ ...taken, currentNodeId: taken.currentNodeId }, 'forge-test', 'remove')
    const removed = confirmDeckOperation(removing, 'forge-test', gold.instanceId)
    expect(removed.deck.some(card => card.definitionId === gold.definitionId)).toBe(false)
    expect(availableGoldCards(removed.deck).some(card => card.id === gold.definitionId)).toBe(true)
  })

  it('an older run (no flag) and the old six-layer campaign keep their five ordinary elite cards', () => {
    const old = eliteReward(11, false)
    expect(old.pendingReward!.count).toBe(5)
    expect(old.pendingReward!.rarity).toBeUndefined()
    expect(dungeonRewardOptions(old).every(card => card.rarity === undefined)).toBe(true)
    let legacy = createDungeonRun(81)
    expect(legacy.goldRewards).toBeUndefined()
    const path = enumerateDungeonPaths(legacy.map).find(nodes => nodes.some(node => node.type === 'elite'))!
    for (const node of path) {
      legacy = enterDungeonNode(legacy, node.id)
      if (node.type === 'rest') { legacy = resolveDungeonRest(legacy, null); continue }
      legacy = winBattle(legacy)
      if (node.type === 'elite') break
      legacy = skipDungeonReward(legacy, legacy.pendingReward!.id)
    }
    expect(legacy.pendingReward).toMatchObject({ elite: true, count: 5 })
  })

  it('gold never leaks into ordinary pools: forge and treasure offers, replacements and rewards', () => {
    let run = createSectorRun(5, economy, honestDeck('armor8', true), undefined, 'rooms')
    const seen = new Set<CardId>()
    for (let seed = 1; seed <= 40; seed += 1) {
      run = { ...run, seed }
      const node = { id: `layer-${seed}`, layer: 2, column: 1, type: 'treasure' as const, edges: [] }
      const visit = createRoomVisit(run, node)
      for (const card of [...visit.cards, ...(visit.riskCard ? [visit.riskCard] : []), ...visit.replacements.warrior, ...visit.replacements.mage]) seen.add(card.definitionId)
    }
    expect(goldIds.some(id => seen.has(id))).toBe(false)
  })
})

describe('gold in later battles', () => {
  it('is shuffled into the deck of the next battle with its own identity, and is played from there', () => {
    const run = eliteReward()
    const pick = dungeonRewardOptions(run).find(card => card.id === 'concerted-volley') ?? dungeonRewardOptions(run)[0]!
    let next = claimDungeonReward(run, pick)
    const copy = last(next.deck)
    next = enterDungeonNode(next, availableDungeonNodes(next)[0]!.id)
    expect(next.battleEntry).not.toBeNull()
    const battle = restoreDungeonBattle(next, economy)
    const zones = [battle.hand, battle.drawPile, battle.discardPile, battle.exhausted].flat()
    expect(zones.filter(card => card.instanceId === copy.instanceId)).toEqual([{ ...copy }])
    // Put it in the hand and play it for real; it leaves the battle, but the permanent deck is untouched.
    const inHand = battle.hand.find(card => card.instanceId === copy.instanceId)
    if (!inHand) {
      battle.drawPile = battle.drawPile.filter(card => card.instanceId !== copy.instanceId)
      battle.hand.push({ ...copy })
    }
    battle.mana = battle.maxMana = 10
    expect(playCard(battle, copy.instanceId).ok).toBe(true)
    expect(battle.exhausted.some(card => card.instanceId === copy.instanceId)).toBe(true)
    expect(last(next.deck)).toEqual(copy)
    const afterWin = winBattle(next)
    expect(afterWin.deck.some(card => card.instanceId === copy.instanceId)).toBe(true)
    // The 3 ordinary choices of an ordinary victory do not offer it again.
    expect(afterWin.pendingReward!.cards.some(card => card.definitionId === pick.id)).toBe(false)
  })
})

describe('saving a run with gold', () => {
  it('round-trips a pending gold offer and a deck that holds a gold card, under a gold-aware catalogue version', () => {
    const run = eliteReward()
    expect(roundTrip(run)).toEqual(run)
    expect(dungeonRunPhase(roundTrip(run))).toBe('reward')
    const raw = encodeSnapshot(run, economy, 2)
    expect(JSON.parse(raw).payload.catalogVersion).toBe(sectorCatalogFor(sectorLongConfig.id, true))
    expect(sectorCatalogFor(sectorLongConfig.id, true)).not.toBe(LONG_SECTOR_CATALOG_VERSION)
    const taken = claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
    expect(roundTrip(taken)).toEqual(taken)
    expect(last(roundTrip(taken).deck).definitionId).toBe(last(taken.deck).definitionId)
  })

  it('reloading before the choice offers the same cards; choosing once cannot be repeated after a reload', () => {
    const run = roundTrip(eliteReward())
    const pick = dungeonRewardOptions(run)[2]!
    const taken = roundTrip(claimDungeonReward(run, pick))
    expect(taken.deck.filter(card => card.definitionId === pick.id)).toHaveLength(1)
    expect(taken.pendingReward).toBeNull()
    expect(() => claimDungeonReward(taken, pick, run.pendingReward!.id)).toThrow()
  })

  it('refuses a damaged gold run: a doctored offer, a duplicate gold card, an upgraded one, gold without the flag', () => {
    const run = eliteReward()
    const doctored = structuredClone(run)
    doctored.pendingReward!.cards = doctored.pendingReward!.cards.slice(0, 2)
    doctored.pendingReward!.count = 2
    expect(() => validateRun(doctored)).toThrow()
    const swapped = structuredClone(run)
    const missing = goldCards.find(card => !swapped.pendingReward!.cards.some(offered => offered.definitionId === card.id))!
    swapped.pendingReward!.cards[0] = { definitionId: missing.id, upgrade: 0 }
    expect(() => validateRun(swapped)).toThrow()
    const cheap = structuredClone(run)
    cheap.pendingReward!.cards[0] = { definitionId: 'sword-strike', upgrade: 0 }
    expect(() => validateRun(cheap)).toThrow()

    const taken = claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
    const gold = last(taken.deck)
    const twice = { ...taken, deck: [...taken.deck, { ...gold, instanceId: `gold-run/card/${taken.nextCardId}` }], nextCardId: taken.nextCardId + 1 }
    expect(() => validateRun(twice)).toThrow()
    const upgraded = { ...taken, deck: taken.deck.map(card => card === gold ? { ...card, upgrade: 1 as const } : card) }
    expect(() => validateRun(upgraded)).toThrow()
    const unflagged = structuredClone(taken)
    delete unflagged.goldRewards
    expect(() => validateRun(unflagged)).toThrow()
    expect(() => validateRun(taken)).not.toThrow()
  })

  it('a run saved before gold (no flag, five ordinary elite cards) loads exactly as before, under the unchanged long catalogue version', () => {
    const old = eliteReward(11, false)
    const raw = encodeSnapshot(old, economy, 1)
    expect(JSON.parse(raw).payload.catalogVersion).toBe(LONG_SECTOR_CATALOG_VERSION)
    expect(decodeSnapshot(raw).run).toEqual(old)
    const taken = claimDungeonReward(old, dungeonRewardOptions(old)[0]!)
    expect(roundTrip(taken)).toEqual(taken)
    // ...and a flag-less run cannot pretend to hold gold.
    const pretending = { ...taken, deck: [...taken.deck, { instanceId: `gold-run/card/${taken.nextCardId}`, definitionId: 'concerted-volley' as const, upgrade: 0 as const }], nextCardId: taken.nextCardId + 1 }
    expect(() => validateRun(pretending)).toThrow()
  })
})

describe('ordinary rewards and upgrades beside gold', () => {
  it('an upgrade at a rest still works on ordinary copies of a deck that holds gold, and is refused on the gold copy', () => {
    const run = eliteReward()
    const taken = claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
    const gold = last(taken.deck)
    // Walk to the next rest on the map.
    let next = taken
    let rested: DungeonRunState | null = null
    for (let guard = 0; guard < 12 && !rested; guard += 1) {
      const options = availableDungeonNodes(next)
      if (!options.length) break
      const rest = options.find(node => node.type === 'rest')
      const node = rest ?? options.find(candidate => candidate.type === 'battle') ?? options[0]!
      next = enterDungeonNode(next, node.id)
      if (node.type === 'rest') rested = next
      else if (node.type === 'battle' || node.type === 'elite') { next = winBattle(next); next = next.pendingReward!.rarity === 'gold' ? claimDungeonReward(next, dungeonRewardOptions(next)[0]!) : skipDungeonReward(next, next.pendingReward!.id) }
      else if (node.type === 'final') break
      else next = resolveRoom(next, { roomId: next.room!.id, action: 'leave' })
    }
    expect(rested, 'a rest is reachable after the elite').not.toBeNull()
    const source = `${rested!.runId}/${rested!.currentNodeId}`
    expect(() => upgradeDungeonRest(rested!, gold.instanceId, source)).toThrow()
    const ordinary = rested!.deck.find(card => canUpgradeCard(card))!
    const upgraded = upgradeDungeonRest(rested!, ordinary.instanceId, source)
    expect(upgraded.deck.find(card => card.instanceId === ordinary.instanceId)!.upgrade).toBe(1)
    expect(resolveCardDefinition(upgraded.deck.find(card => card.instanceId === gold.instanceId)!).rarity).toBe('gold')
    expect(roundTrip(upgraded)).toEqual(upgraded)
  })
})

describe('the reward screen', () => {
  it('renders the gold offer with the gold frame, the gold wording and the artifact tab', async () => {
    const run = eliteReward()
    const html = await renderToString(createSSRApp(EliteReward, {
      options: dungeonRewardOptions(run), artifacts: dungeonArtifactOptions(run), heroes: run.heroes, ownedArtifacts: run.artifacts,
      encounterName: 'Тест', deck: run.deck, offerId: run.pendingReward!.id, gold: true,
    }))
    expect(html).toContain('ЗОЛОТАЯ НАГРАДА ЭЛИТЫ')
    expect(html).toContain('Золотые карты · 3')
    expect((html.match(/is-gold/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('Взять золотую карту')
    expect(html).toContain('Артефакты')
    const plain = await renderToString(createSSRApp(EliteReward, {
      options: [cardDefinition('sword-strike')], artifacts: [], heroes: run.heroes, ownedArtifacts: [], encounterName: 'Тест',
    }))
    expect(plain).toContain('ЭЛИТНАЯ НАХОДКА')
    expect(plain).not.toContain('is-gold')
  })
})
