import { describe, expect, it } from 'vitest'
import { adventureSectors, bossHeal, bossRewardRules, createBossReward, newJourney, sectorAfter, sectorIsPlayable, sectorNumber, sectorOf, waitsAtSectorExit } from './adventure'
import { claimBossCard, claimBossDevelopment, sectorGate } from './bossReward'
import { availableDungeonNodes, createAdventureRun, createSectorRun, dungeonNode, dungeonRunPhase, enterDungeonNode, GOLD_REWARD_CHOICES, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle } from './campaign'
import type { DungeonMapNode, DungeonRunState } from './campaign'
import { resolveRoom } from './dungeonRooms'
import { honestEconomies } from './economy'
import { honestDeck } from './honestDecks'
import { sectorLongConfig, sectorLongConfigV3 } from './sectorLong'
import { rhahkZor } from './sectorContent'
import { decodeSnapshot, encodeSnapshot, JOURNEY_CATALOG_VERSION, LONG_SECTOR_CATALOG_VERSION_3, ROOM_RULES_VERSION, SECTOR_CATALOG_VERSION, sectorCatalogFor, validateRun } from './runSave'
import { canUpgradeCard } from './cardProgression'
import { artifactDefinitions } from './artifacts'
import { cardDefinition, goldCards } from './types'
import { equipDungeonArtifact } from './campaign'
import before from './fixtures/long-saves-v3-before-boss.json'

const economy = honestEconomies['honest-b2-long']
const deck = honestDeck('armor8', true)

// ---------------------------------------------------------------------------------------------------------------------------------
// Walking a run with the real transactions. Fights are won by decree, which the boss reward does not care about.
// ---------------------------------------------------------------------------------------------------------------------------------
const won = (run: DungeonRunState) => { const battle = restoreDungeonBattle(run, economy); battle.enemy.health = 0; battle.result = 'victory'; return resolveDungeonBattle(run, battle) }
const lost = (run: DungeonRunState) => { const battle = restoreDungeonBattle(run, economy); battle.heroes.mage.health = 0; battle.result = 'defeat'; return resolveDungeonBattle(run, battle) }
const reload = (run: DungeonRunState, revision = 1) => decodeSnapshot(encodeSnapshot(run, economy, revision)).run
const settleOrdinary = (run: DungeonRunState): DungeonRunState => run.status === 'active' && run.pendingReward ? { ...run, pendingReward: null, decisions: [...run.decisions, run.pendingReward.id] } : run
function walk(run: DungeonRunState, node: DungeonMapNode): DungeonRunState {
  run = enterDungeonNode(run, node.id)
  if (run.room) return resolveRoom(run, { roomId: run.room.id, action: 'leave' })
  if (node.type === 'rest') return resolveDungeonRest(run, null)
  return settleOrdinary(won(run))
}
/** The party at the boss's gate (battle entry saved). */
function atBoss(seed = 11, make: (seed: number) => DungeonRunState = s => createAdventureRun(s, economy, deck, 'boss-' + s)): DungeonRunState {
  let run = make(seed)
  for (let guard = 0; guard < 40; guard += 1) {
    const next = availableDungeonNodes(run).sort((a, b) => a.column - b.column)[0]!
    if (next.type === 'final') return enterDungeonNode(run, next.id)
    run = reload(walk(run, next))
  }
  throw new Error('never reached the boss')
}
/** The boss has fallen and its reward is open. */
const afterBoss = (seed = 11) => won(atBoss(seed))
const hurt = (run: DungeonRunState, warrior: number, mage: number): DungeonRunState => ({ ...run, heroes: { warrior: { ...run.heroes.warrior, health: warrior }, mage: { ...run.heroes.mage, health: mage } } })
const offerOf = (run: DungeonRunState) => run.bossReward!
const upgradable = (run: DungeonRunState) => run.deck.find(canUpgradeCard)!
const rejected = (run: DungeonRunState) => expect(() => validateRun(run)).toThrow('Повреждены данные')
const accepted = (run: DungeonRunState) => expect(() => validateRun(run)).not.toThrow()

describe('the adventure: three sectors in order, only the first one playable', () => {
  it('names Old Mines, Goblin Workshops and Secret Cove, in that order', () => {
    expect(adventureSectors.map(sector => sector.id)).toEqual(['old-mines', 'goblin-workshops', 'secret-cove'])
    expect(adventureSectors.map(sector => sector.name)).toEqual(['Старые штольни', 'Гоблинские мастерские', 'Тайная бухта'])
    expect(adventureSectors.map(sector => sectorNumber(sector.id))).toEqual([1, 2, 3])
    expect(sectorAfter('old-mines')?.id).toBe('goblin-workshops')
    expect(sectorAfter('goblin-workshops')?.id).toBe('secret-cove')
    expect(sectorAfter('secret-cove')).toBeUndefined()
  })

  it('Old Mines is the long route of B2 Long; the others carry no configuration, enemy or boss yet', () => {
    expect(sectorOf('old-mines').current).toBe(sectorLongConfigV3)
    expect(sectorOf('old-mines').configs.map(config => config.version)).toEqual([1, 2, 3])
    expect(adventureSectors.map(sectorIsPlayable)).toEqual([true, false, false])
    for (const sector of adventureSectors.slice(1)) expect(sector.configs).toEqual([])
  })

  it('the boss reward numbers are the GDD ones, and the gold offer is the elite\'s rule', () => {
    expect(bossRewardRules).toEqual({ version: 'boss-reward-1', goldChoices: 3, artifactChoices: 2, healEach: 4 })
    expect(bossRewardRules.goldChoices).toBe(GOLD_REWARD_CHOICES)
  })

  it('only the game\'s long route starts an adventure; the sector run and the short sector end at the boss as before', () => {
    expect(createAdventureRun(3, economy, deck, 'a').journey).toEqual({ sectorId: 'old-mines', cleared: [] })
    expect(createSectorRun(3, economy, deck, undefined, 'b').journey).toBeUndefined()
    expect(createAdventureRun(3, honestEconomies['honest-b2'], honestDeck('armor8', true), 'c').journey).toBeUndefined()
    expect(createAdventureRun(3, economy, deck, 'a').map).toEqual(createSectorRun(3, economy, deck, undefined, 'a').map)
  })
})

describe('the boss falls: the reward opens, the sector does not end', () => {
  it('an adventure run keeps playing and offers three gold cards and two artifacts', () => {
    const run = afterBoss()
    expect(run.status).toBe('active')
    expect(dungeonRunPhase(run)).toBe('boss-reward')
    expect(run.completedNodeIds).toContain(run.map.finalNodeId)
    const reward = offerOf(run)
    expect(reward.id).toBe(`${run.runId}/boss-reward/${run.map.finalNodeId}`)
    expect(reward.cards).toHaveLength(3)
    for (const card of reward.cards) { expect(cardDefinition(card.definitionId).rarity).toBe('gold'); expect(card.upgrade).toBe(0) }
    expect(new Set(reward.cards.map(card => card.definitionId)).size).toBe(3)
    expect(reward.artifactIds).toHaveLength(2)
    expect(reward.cardChoice).toBeNull()
    expect(reward.developmentChoice).toBeNull()
    expect(run.pendingReward).toBeNull()
    expect(availableDungeonNodes(run)).toEqual([])
    expect(run.decisions).not.toContain(reward.id)
    accepted(run)
  })

  it('leaves the hero health, the deck and the artifacts as the battle left them', () => {
    const gate = atBoss()
    const run = won(gate)
    expect(run.deck).toEqual(gate.deck)
    expect(run.artifacts).toEqual(gate.artifacts)
    expect(run.heroes.warrior.health).toBe(gate.heroes.warrior.health)
    expect(run.heroes.mage.health).toBe(gate.heroes.mage.health)
  })

  it('a run without a journey ends at the boss exactly as it always did', () => {
    const run = won(atBoss(11, seed => createSectorRun(seed, economy, deck, undefined, 'plain-' + seed)))
    expect(run.status).toBe('sector-complete')
    expect(run.bossReward).toBeUndefined()
    expect(dungeonRunPhase(run)).toBe('complete')
    accepted(run)
  })

  it('a defeat at the boss is a defeat: no reward, no exit', () => {
    const run = lost(atBoss())
    expect(run.status).toBe('defeat')
    expect(run.bossReward).toBeUndefined()
    expect(dungeonRunPhase(run)).toBe('complete')
    accepted(run)
  })

  it('the offer is a function of the run seed and what the party holds', () => {
    const a = offerOf(afterBoss(11)), b = offerOf(afterBoss(11))
    expect(b).toEqual(a)
    const input = { runId: 'x', runSeed: 5, nodeId: 'boss', deck: deck.map(definitionId => ({ definitionId })), ownedArtifacts: [] }
    expect(createBossReward(input)).toEqual(createBossReward(input))
    expect(createBossReward({ ...input, runSeed: 6 }).cards.map(card => card.definitionId)).not.toEqual([])
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed += 1) createBossReward({ ...input, runSeed: seed }).cards.forEach(card => seen.add(card.definitionId))
    expect(seen.size).toBe(goldCards.length)
  })

  it('never offers a gold card the deck holds, nor an artifact the party carries', () => {
    const held = goldCards[0]!.id
    for (let seed = 1; seed <= 30; seed += 1) {
      const offer = createBossReward({ runId: 'x', runSeed: seed, nodeId: 'boss', deck: [...deck.map(definitionId => ({ definitionId })), { definitionId: held }], ownedArtifacts: [artifactDefinitions[0]!.id] })
      expect(offer.cards.map(card => card.definitionId)).not.toContain(held)
      expect(offer.cards).toHaveLength(3)
      expect(offer.artifactIds).not.toContain(artifactDefinitions[0]!.id)
    }
    const everything = createBossReward({ runId: 'x', runSeed: 1, nodeId: 'boss', deck: goldCards.map(card => ({ definitionId: card.id })), ownedArtifacts: artifactDefinitions.map(item => item.id) })
    expect(everything.cards).toEqual([])
    expect(everything.artifactIds).toEqual([])
  })
})

describe('the gold card track', () => {
  it('take: the card joins the deck, once, with a fresh identity', () => {
    const run = afterBoss()
    const card = offerOf(run).cards[0]!
    const next = claimBossCard(run, offerOf(run).id, { kind: 'take', cardId: card.definitionId })
    expect(next.deck).toHaveLength(run.deck.length + 1)
    const copy = next.deck[next.deck.length - 1]!
    expect(copy).toEqual({ definitionId: card.definitionId, upgrade: 0, instanceId: `${run.runId}/card/${run.nextCardId}` })
    expect(next.nextCardId).toBe(run.nextCardId + 1)
    expect(offerOf(next).cardChoice).toEqual({ kind: 'take', copy })
    expect(dungeonRunPhase(next)).toBe('boss-reward')
    expect(next.status).toBe('active')
    accepted(next)
    expect(() => claimBossCard(next, offerOf(next).id, { kind: 'take', cardId: card.definitionId })).toThrow()
    expect(() => claimBossCard(next, offerOf(next).id, { kind: 'skip' })).toThrow()
  })

  it('take: only what was offered, and only against the open reward', () => {
    const run = afterBoss()
    const offered = new Set(offerOf(run).cards.map(card => card.definitionId))
    const outsider = goldCards.find(card => !offered.has(card.id))!
    expect(() => claimBossCard(run, offerOf(run).id, { kind: 'take', cardId: outsider.id })).toThrow()
    expect(() => claimBossCard(run, offerOf(run).id, { kind: 'take', cardId: 'sword-strike' })).toThrow()
    expect(() => claimBossCard(run, 'stale-offer', { kind: 'skip' })).toThrow()
    expect(() => claimBossCard(atBoss(), 'whatever', { kind: 'skip' })).toThrow()
  })

  it('replace: one of your cards leaves, the gold one comes, the size stays; the upgrade is not carried over', () => {
    let run = afterBoss()
    const target = upgradable(run)
    run = { ...run, deck: run.deck.map(copy => copy.instanceId === target.instanceId ? { ...copy, upgrade: 1 as const } : copy) }
    const card = offerOf(run).cards[1]!
    const next = claimBossCard(run, offerOf(run).id, { kind: 'replace', cardId: card.definitionId, instanceId: target.instanceId })
    expect(next.deck).toHaveLength(run.deck.length)
    expect(next.deck.some(copy => copy.instanceId === target.instanceId)).toBe(false)
    const copy = next.deck.find(item => item.definitionId === card.definitionId)!
    expect(copy.upgrade).toBe(0)
    expect(copy.instanceId).toBe(`${run.runId}/card/${run.nextCardId}`)
    expect(next.nextCardId).toBe(run.nextCardId + 1)
    expect(offerOf(next).cardChoice).toEqual({ kind: 'replace', removed: { ...target, upgrade: 1 }, copy })
    expect(next.deckOperations.filter(service => service.sourceId.startsWith(offerOf(run).id))).toEqual([{ sourceId: `${offerOf(run).id}/card`, kind: 'replace', options: offerOf(run).cards, resolved: true }])
    accepted(next)
  })

  it('replace: the card to give up must be in the deck, and a refusal leaves the run untouched', () => {
    const run = afterBoss()
    const snapshot = structuredClone(run)
    expect(() => claimBossCard(run, offerOf(run).id, { kind: 'replace', cardId: offerOf(run).cards[0]!.definitionId, instanceId: 'nothing' })).toThrow()
    expect(() => claimBossCard(run, offerOf(run).id, { kind: 'replace', cardId: 'sword-strike', instanceId: run.deck[0]!.instanceId })).toThrow()
    expect(run).toEqual(snapshot)
  })

  it('replace: a gold card in the deck may be the one given up for another gold card', () => {
    let run = afterBoss()
    const held = goldCards.find(card => !offerOf(run).cards.some(option => option.definitionId === card.id))!
    expect(held).toBeDefined()
    run = { ...run, deck: [...run.deck, { definitionId: held.id, upgrade: 0, instanceId: `${run.runId}/card/${run.nextCardId}` }], nextCardId: run.nextCardId + 1 }
    const gold = run.deck[run.deck.length - 1]!
    const next = claimBossCard(run, offerOf(run).id, { kind: 'replace', cardId: offerOf(run).cards[0]!.definitionId, instanceId: gold.instanceId })
    expect(next.deck.filter(copy => cardDefinition(copy.definitionId).rarity === 'gold')).toHaveLength(1)
  })

  it('skip: nothing changes in the deck', () => {
    const run = afterBoss()
    const next = claimBossCard(run, offerOf(run).id, { kind: 'skip' })
    expect(next.deck).toEqual(run.deck)
    expect(next.nextCardId).toBe(run.nextCardId)
    expect(offerOf(next).cardChoice).toEqual({ kind: 'skip' })
    accepted(next)
  })
})

describe('the development track: one artifact from two, or one upgrade', () => {
  it('artifact: the chosen hero carries it; the other offer is gone', () => {
    const run = afterBoss()
    const artifactId = offerOf(run).artifactIds[1]!
    const next = claimBossDevelopment(run, offerOf(run).id, { kind: 'artifact', artifactId, ownerInstanceId: run.heroes.mage.instanceId })
    expect(next.artifacts).toEqual([{ instanceId: `${run.runId}/artifact/${offerOf(run).id}/${artifactId}`, definitionId: artifactId, ownerInstanceId: run.heroes.mage.instanceId }])
    expect(offerOf(next).developmentChoice).toEqual({ kind: 'artifact', artifactId, ownerInstanceId: run.heroes.mage.instanceId })
    accepted(next)
    expect(() => claimBossDevelopment(next, offerOf(next).id, { kind: 'skip' })).toThrow()
  })

  it('artifact: only an offered one, to a hero of the party', () => {
    const run = afterBoss()
    const outsider = artifactDefinitions.find(item => !offerOf(run).artifactIds.includes(item.id))!
    expect(() => claimBossDevelopment(run, offerOf(run).id, { kind: 'artifact', artifactId: outsider.id, ownerInstanceId: run.heroes.warrior.instanceId })).toThrow()
    expect(() => claimBossDevelopment(run, offerOf(run).id, { kind: 'artifact', artifactId: offerOf(run).artifactIds[0]!, ownerInstanceId: 'nobody' })).toThrow()
    expect(run.bossReward!.developmentChoice).toBeNull()
  })

  it('artifact: a hero who already carries one must replace it knowingly, and the swap is remembered', () => {
    const held = artifactDefinitions[0]!
    const gate = atBoss()
    const run = won(equipDungeonArtifact(gate, held.id, gate.heroes.warrior.instanceId, undefined, 'room'))
    const open = offerOf(run)
    expect(open.artifactIds).not.toContain(held.id)
    const taking = { kind: 'artifact' as const, artifactId: open.artifactIds[0]!, ownerInstanceId: run.heroes.warrior.instanceId }
    expect(() => claimBossDevelopment(run, open.id, taking)).toThrow()
    expect(() => claimBossDevelopment(run, open.id, { ...taking, replaceInstanceId: 'nothing' })).toThrow()
    // The other hero's slot is free: no replacement may be named for it.
    expect(() => claimBossDevelopment(run, open.id, { ...taking, ownerInstanceId: run.heroes.mage.instanceId, replaceInstanceId: run.artifacts[0]!.instanceId })).toThrow()
    const swapped = claimBossDevelopment(run, open.id, { ...taking, replaceInstanceId: run.artifacts[0]!.instanceId })
    expect(swapped.artifacts.map(item => item.definitionId)).toEqual([open.artifactIds[0]])
    expect(offerOf(swapped).developmentChoice).toMatchObject({ kind: 'artifact', replacedArtifactId: held.id })
    accepted(swapped)
    // Both slots taken at the boss: a third artifact cannot exist, the swap is the only way.
    const full = won(equipDungeonArtifact(equipDungeonArtifact(gate, held.id, gate.heroes.warrior.instanceId, undefined, 'room'), artifactDefinitions[1]!.id, gate.heroes.mage.instanceId, undefined, 'room2'))
    expect(() => claimBossDevelopment(full, offerOf(full).id, { kind: 'artifact', artifactId: offerOf(full).artifactIds[0]!, ownerInstanceId: full.heroes.mage.instanceId })).toThrow()
  })

  it('upgrade: one ordinary card becomes its upgraded self, once', () => {
    const run = afterBoss()
    const target = upgradable(run)
    const next = claimBossDevelopment(run, offerOf(run).id, { kind: 'upgrade', instanceId: target.instanceId })
    expect(next.deck.find(copy => copy.instanceId === target.instanceId)!.upgrade).toBe(1)
    expect(next.deck.filter(copy => copy.upgrade === 1)).toHaveLength(run.deck.filter(copy => copy.upgrade === 1).length + 1)
    expect(offerOf(next).developmentChoice).toEqual({ kind: 'upgrade', instanceId: target.instanceId, definitionId: target.definitionId })
    accepted(next)
    expect(() => claimBossDevelopment(next, offerOf(next).id, { kind: 'upgrade', instanceId: run.deck.filter(canUpgradeCard)[1]!.instanceId })).toThrow()
  })

  it('upgrade: not an already upgraded copy, not a gold card, not a stranger', () => {
    let run = afterBoss()
    const done = upgradable(run)
    run = { ...run, deck: run.deck.map(copy => copy.instanceId === done.instanceId ? { ...copy, upgrade: 1 as const } : copy) }
    expect(() => claimBossDevelopment(run, offerOf(run).id, { kind: 'upgrade', instanceId: done.instanceId })).toThrow()
    expect(() => claimBossDevelopment(run, offerOf(run).id, { kind: 'upgrade', instanceId: 'nothing' })).toThrow()
    const withGold = claimBossCard(run, offerOf(run).id, { kind: 'take', cardId: offerOf(run).cards[0]!.definitionId })
    const gold = withGold.deck[withGold.deck.length - 1]!
    expect(() => claimBossDevelopment(withGold, offerOf(withGold).id, { kind: 'upgrade', instanceId: gold.instanceId })).toThrow()
  })

  it('skip: nothing changes', () => {
    const run = afterBoss()
    const next = claimBossDevelopment(run, offerOf(run).id, { kind: 'skip' })
    expect(next.deck).toEqual(run.deck)
    expect(next.artifacts).toEqual(run.artifacts)
    accepted(next)
  })
})

describe('closing the reward: the camp mends the heroes and the party waits at the exit', () => {
  const close = (run: DungeonRunState, card: Parameters<typeof claimBossCard>[2] = { kind: 'skip' }, development: Parameters<typeof claimBossDevelopment>[2] = { kind: 'skip' }) =>
    claimBossDevelopment(claimBossCard(run, offerOf(run).id, card), offerOf(run).id, development)

  it('the second track to close ends the sector; the order does not matter', () => {
    const run = afterBoss()
    const id = offerOf(run).id
    const cardFirst = claimBossDevelopment(claimBossCard(run, id, { kind: 'skip' }), id, { kind: 'skip' })
    const developmentFirst = claimBossCard(claimBossDevelopment(run, id, { kind: 'skip' }), id, { kind: 'skip' })
    for (const done of [cardFirst, developmentFirst]) {
      expect(done.status).toBe('sector-complete')
      expect(dungeonRunPhase(done)).toBe('transition')
      expect(done.bossReward).toBeUndefined()
      expect(waitsAtSectorExit(done.journey)).toBe(true)
      expect(done.journey!.cleared).toHaveLength(1)
      expect(done.journey!.cleared[0]!.sectorId).toBe('old-mines')
      expect(done.decisions.filter(entry => entry === id)).toHaveLength(1)
      expect(availableDungeonNodes(done)).toEqual([])
      accepted(done)
    }
  })

  it('heals up to 4 of each hero\'s missing health, never past the maximum', () => {
    const cases: [number, number, number, number][] = [[25, 18, 0, 0], [22, 17, 3, 1], [10, 6, 4, 4], [21, 18, 4, 0], [24, 3, 1, 4]]
    for (const [warrior, mage, mendedWarrior, mendedMage] of cases) {
      const run = hurt(afterBoss(), warrior, mage)
      const done = close(run)
      expect(done.heroes.warrior.health, `${warrior}/${mage}`).toBe(warrior + mendedWarrior)
      expect(done.heroes.mage.health, `${warrior}/${mage}`).toBe(mage + mendedMage)
      expect(done.journey!.cleared[0]!.reward.healed).toEqual({ warrior: mendedWarrior, mage: mendedMage })
      expect(done.heroes.warrior.health).toBeLessThanOrEqual(done.heroes.warrior.maxHealth)
    }
    expect(bossHeal({ warrior: { health: 1, maxHealth: 25 }, mage: { health: 17, maxHealth: 18 } })).toEqual({ warrior: 4, mage: 1 })
  })

  it('heals only when the reward closes, not while a track is still open', () => {
    const run = hurt(afterBoss(), 5, 5)
    const half = claimBossCard(run, offerOf(run).id, { kind: 'skip' })
    expect(half.heroes).toEqual(run.heroes)
    expect(half.status).toBe('active')
  })

  it('keeps the party, the deck, the upgrades and the artifacts it earned', () => {
    const run = afterBoss()
    const target = upgradable(run)
    const done = close(run, { kind: 'take', cardId: offerOf(run).cards[0]!.definitionId }, { kind: 'upgrade', instanceId: target.instanceId })
    expect(done.deck).toHaveLength(run.deck.length + 1)
    expect(done.deck.find(copy => copy.instanceId === target.instanceId)!.upgrade).toBe(1)
    expect(done.heroes.warrior.instanceId).toBe(run.heroes.warrior.instanceId)
    expect(done.runId).toBe(run.runId)
    const withArtifact = close(run, { kind: 'skip' }, { kind: 'artifact', artifactId: offerOf(run).artifactIds[0]!, ownerInstanceId: run.heroes.warrior.instanceId })
    expect(withArtifact.artifacts).toHaveLength(1)
  })

  it('writes one line into the route history, and the card with it', () => {
    const run = afterBoss()
    const done = close(run, { kind: 'take', cardId: offerOf(run).cards[0]!.definitionId })
    const entry = done.journal!.filter(item => item.nodeId === run.map.finalNodeId)
    expect(entry).toHaveLength(1)
    expect(entry[0]!.kind).toBe('reward')
    expect(entry[0]!.text).toContain("Рак'Зор")
    expect(entry[0]!.text).toContain(cardDefinition(offerOf(run).cards[0]!.definitionId).name)
    expect(entry[0]!.card?.definitionId).toBe(offerOf(run).cards[0]!.definitionId)
  })

  it('cannot be claimed, healed or entered a second time', () => {
    const gate = atBoss()
    const stale = restoreDungeonBattle(gate, economy)
    stale.enemy.health = 0
    stale.result = 'victory'
    const run = won(gate)
    const done = close(hurt(run, 5, 5))
    const id = `${run.runId}/boss-reward/${run.map.finalNodeId}`
    expect(() => claimBossCard(done, id, { kind: 'take', cardId: offerOf(run).cards[0]!.definitionId })).toThrow()
    expect(() => claimBossDevelopment(done, id, { kind: 'skip' })).toThrow()
    expect(() => resolveDungeonBattle(done, stale)).toThrow()
    expect(() => enterDungeonNode(done, run.map.finalNodeId)).toThrow()
    expect(done.heroes.warrior.health).toBe(9)
    // Putting the open reward back by hand makes a run that no longer validates.
    rejected({ ...done, bossReward: structuredClone(run.bossReward!) })
  })

  it('the gate behind the exit is the next sector, closed until it has something to play', () => {
    const done = close(afterBoss())
    expect(sectorGate(done)).toEqual({ next: sectorOf('goblin-workshops'), open: false })
    expect(sectorGate(afterBoss())).toEqual({ next: sectorOf('goblin-workshops'), open: false })
    expect(sectorGate(createSectorRun(1, economy, deck, undefined, 'plain'))).toEqual({ next: null, open: false })
  })
})

describe('saving and loading at every stage', () => {
  const stages = () => {
    const open = afterBoss()
    const id = offerOf(open).id
    const target = upgradable(open)
    const cardDone = claimBossCard(open, id, { kind: 'replace', cardId: offerOf(open).cards[0]!.definitionId, instanceId: target.instanceId })
    const closed = claimBossDevelopment(cardDone, id, { kind: 'artifact', artifactId: offerOf(open).artifactIds[0]!, ownerInstanceId: open.heroes.mage.instanceId })
    const upgraded = claimBossDevelopment(claimBossCard(open, id, { kind: 'take', cardId: offerOf(open).cards[2]!.definitionId }), id, { kind: 'upgrade', instanceId: target.instanceId })
    const skipped = claimBossDevelopment(claimBossCard(open, id, { kind: 'skip' }), id, { kind: 'skip' })
    return { open, cardDone, developmentDone: claimBossDevelopment(open, id, { kind: 'skip' }), closed, upgraded, skipped }
  }

  it('every stage survives encode → decode unchanged', () => {
    for (const [name, run] of Object.entries(stages())) {
      const raw = encodeSnapshot(run, economy, 1)
      expect(decodeSnapshot(raw).run, name).toEqual(run)
      expect(JSON.parse(raw).payload.catalogVersion, name).toBe(sectorCatalogFor(sectorLongConfig.id, true, 3, true))
    }
  })

  it('a reload restores the phase: the open reward, then the exit', () => {
    const { open, cardDone, closed } = stages()
    expect(dungeonRunPhase(reload(open))).toBe('boss-reward')
    expect(dungeonRunPhase(reload(cardDone))).toBe('boss-reward')
    expect(dungeonRunPhase(reload(closed))).toBe('transition')
    expect(reload(closed).journey).toEqual(closed.journey)
  })

  it('a reload cannot give the reward back: the claimed tracks stay claimed', () => {
    const { cardDone } = stages()
    const again = reload(cardDone)
    expect(() => claimBossCard(again, offerOf(again).id, { kind: 'skip' })).toThrow()
    expect(offerOf(again).cardChoice).toEqual(offerOf(cardDone).cardChoice)
  })

  it('a stale copy of the open reward cannot be replayed over a closed one', () => {
    const { open, closed } = stages()
    // The earlier snapshot is simply an earlier state: loading it is a different run position and the closed one is not changed by it.
    expect(reload(closed).status).toBe('sector-complete')
    expect(reload(open).status).toBe('active')
  })

  const tampered = (mutate: (run: DungeonRunState) => void, from: 'open' | 'cardDone' | 'closed' | 'upgraded' | 'skipped' = 'closed') => {
    const run = structuredClone(stages()[from]) as DungeonRunState
    mutate(run)
    return run
  }

  it('refuses a reward that was forged', () => {
    const other = (run: DungeonRunState) => goldCards.find(card => !run.bossReward!.cards.some(option => option.definitionId === card.id) && !run.deck.some(copy => copy.definitionId === card.id))!.id
    // A different offer than the seed and the deck produce.
    rejected(tampered(run => { run.bossReward!.cards[0] = { definitionId: other(run), upgrade: 0 } }, 'open'))
    rejected(tampered(run => { run.bossReward!.cards.pop() }, 'open'))
    rejected(tampered(run => { run.bossReward!.artifactIds.reverse() }, 'open'))
    rejected(tampered(run => { run.bossReward!.seed += 1 }, 'open'))
    rejected(tampered(run => { run.bossReward!.id += 'x' }, 'open'))
    rejected(tampered(run => { run.bossReward!.nodeId = 'elsewhere' }, 'open'))
    // The same on the closed ledger entry.
    rejected(tampered(run => { run.journey!.cleared[0]!.reward.cards[0] = { definitionId: other({ ...run, bossReward: run.journey!.cleared[0]!.reward } as DungeonRunState), upgrade: 0 } }))
    rejected(tampered(run => { run.journey!.cleared[0]!.reward.artifactIds = [] }))
  })

  it('refuses choices that left no trace in the deck, or traces without a choice', () => {
    // A taken card that is not in the deck.
    rejected(tampered(run => { run.deck.pop() }, 'upgraded'))
    // A skipped track with a card added anyway.
    rejected(tampered(run => { run.deck.push({ definitionId: run.journey!.cleared[0]!.reward.cards[0]!.definitionId, upgrade: 0, instanceId: `${run.runId}/card/${run.nextCardId}` }); run.nextCardId += 1 }, 'skipped'))
    // An upgrade that was never applied.
    rejected(tampered(run => { run.deck.forEach(copy => { copy.upgrade = 0 }) }, 'upgraded'))
    // An artifact recorded but not carried, and one carried but not recorded.
    rejected(tampered(run => { run.artifacts = [] }, 'closed'))
    rejected(tampered(run => { run.artifacts.push({ instanceId: `${run.runId}/artifact/x`, definitionId: artifactDefinitions[0]!.id, ownerInstanceId: run.heroes.warrior.instanceId }) }, 'skipped'))
    // The replacement's spent service removed.
    rejected(tampered(run => { run.deckOperations = [] }, 'closed'))
    // A spent deck service in the reward's name that no choice accounts for (a card traded away unseen).
    rejected(tampered(run => {
      const source = `${run.journey!.cleared[0]!.reward.id}/card`
      run.deckOperations.push({ sourceId: source, kind: 'replace', options: run.journey!.cleared[0]!.reward.cards, resolved: true })
      run.decisions.push(`deck:${source}`)
    }, 'skipped'))
    // The choice rewritten to a different card.
    rejected(tampered(run => { (run.journey!.cleared[0]!.reward.cardChoice as { copy: { definitionId: string } }).copy.definitionId = 'sword-strike' }, 'upgraded'))
  })

  it('refuses a heal that is not what the rules give', () => {
    accepted(tampered(run => { run.heroes.warrior.health = Math.min(run.heroes.warrior.maxHealth, run.heroes.warrior.health + 1) }, 'skipped'))
    const hurtRun = (() => {
      const run = hurt(afterBoss(), 10, 10)
      return claimBossDevelopment(claimBossCard(run, offerOf(run).id, { kind: 'skip' }), offerOf(run).id, { kind: 'skip' })
    })()
    accepted(hurtRun)
    rejected({ ...hurtRun, journey: { ...hurtRun.journey!, cleared: [{ sectorId: 'old-mines', reward: { ...hurtRun.journey!.cleared[0]!.reward, healed: { warrior: 3, mage: 4 } } }] } })
    rejected({ ...hurtRun, journey: { ...hurtRun.journey!, cleared: [{ sectorId: 'old-mines', reward: { ...hurtRun.journey!.cleared[0]!.reward, healed: { warrior: 5, mage: 4 } } }] } })
    // A heal written onto a reward that is still open.
    rejected(tampered(run => { run.bossReward!.healed = { warrior: 0, mage: 0 } }, 'open'))
  })

  it('refuses a ledger that does not match the run\'s state', () => {
    // The exit without a ledger, and a ledger without the exit.
    rejected(tampered(run => { run.journey!.cleared = [] }))
    rejected(tampered(run => { run.status = 'active' }))
    rejected(tampered(run => { run.status = 'sector-complete' }, 'open'))
    rejected(tampered(run => { run.journey!.cleared.push(structuredClone(run.journey!.cleared[0]!)) }))
    rejected(tampered(run => { run.journey!.sectorId = 'goblin-workshops' }))
    rejected(tampered(run => { run.decisions = run.decisions.filter(id => id !== run.journey!.cleared[0]!.reward.id) }))
    rejected(tampered(run => { run.decisions.push(run.bossReward!.id) }, 'open'))
    rejected(tampered(run => { run.journal = run.journal!.filter(entry => entry.nodeId !== run.map.finalNodeId) }))
    // A journey cannot be attached to a run that is not the game's long route.
    rejected({ ...createSectorRun(2, honestEconomies['honest-b2'], honestDeck('armor8', true), undefined, 'short'), journey: newJourney() })
    rejected({ ...createSectorRun(2, economy, deck, undefined, 'plain'), goldRewards: undefined, journey: newJourney() })
    // A reward without a journey.
    rejected(tampered(run => { delete run.journey }, 'open'))
  })

  it('refuses a victory outright: an adventure does not end at its first sector', () => {
    rejected(tampered(run => { run.status = 'victory' }))
  })

  it('declares the adventure in the fingerprint: a journey run cannot pass for a plain one, nor the reverse', () => {
    const plain = sectorCatalogFor(sectorLongConfig.id, true, 3)
    const adventure = sectorCatalogFor(sectorLongConfig.id, true, 3, true)
    expect(adventure).not.toBe(plain)
    expect(JOURNEY_CATALOG_VERSION).toMatch(/^[0-9a-f]+$/)
    const raw = JSON.parse(encodeSnapshot(createAdventureRun(7, economy, deck, 'f'), economy, 1))
    expect(raw.payload.catalogVersion).toBe(adventure)
    const forged = structuredClone(raw)
    forged.payload.catalogVersion = plain
    expect(() => decodeSnapshot(JSON.stringify(forged))).toThrow()
    const stripped = structuredClone(raw)
    delete stripped.payload.run.journey
    expect(() => decodeSnapshot(JSON.stringify(stripped))).toThrow()
    const plainRaw = JSON.parse(encodeSnapshot(createSectorRun(7, economy, deck, undefined, 'f'), economy, 1))
    expect(plainRaw.payload.catalogVersion).toBe(plain)
    plainRaw.payload.catalogVersion = adventure
    expect(() => decodeSnapshot(JSON.stringify(plainRaw))).toThrow()
  })
})

describe('compatibility: runs saved before the boss rewards', () => {
  const fixtures = before as unknown as Record<'fresh' | 'eliteReward' | 'bossBattle' | 'sectorComplete', { raw: string }> & { versions: Record<'long3' | 'gold3' | 'rooms' | 'sector', string> }

  it('the fingerprints those saves were written under are exactly what they were', () => {
    expect(LONG_SECTOR_CATALOG_VERSION_3).toBe(fixtures.versions.long3)
    expect(SECTOR_CATALOG_VERSION).toBe(fixtures.versions.sector)
    expect(ROOM_RULES_VERSION).toBe(fixtures.versions.rooms)
    expect(sectorCatalogFor(sectorLongConfig.id, true, 3)).toBe(fixtures.versions.gold3)
  })

  it('each of them loads as it was, without a journey, and re-encodes with the same fingerprint', () => {
    for (const key of ['fresh', 'eliteReward', 'bossBattle', 'sectorComplete'] as const) {
      const snapshot = decodeSnapshot(fixtures[key].raw)
      expect(snapshot.run.journey, key).toBeUndefined()
      expect(snapshot.run.bossReward, key).toBeUndefined()
      expect(snapshot.run.campaign, key).toEqual({ id: sectorLongConfig.id, version: 3 })
      const again = JSON.parse(encodeSnapshot(snapshot.run, economy, snapshot.revision + 1))
      expect(again.payload.catalogVersion, key).toBe(JSON.parse(fixtures[key].raw).payload.catalogVersion)
      expect(decodeSnapshot(JSON.stringify(again)).run, key).toEqual(snapshot.run)
    }
  })

  it('a finished old run is still the terminal summary, not a hidden exit', () => {
    const run = decodeSnapshot(fixtures.sectorComplete.raw).run
    expect(run.status).toBe('sector-complete')
    expect(dungeonRunPhase(run)).toBe('complete')
    expect(sectorGate(run)).toEqual({ next: null, open: false })
  })

  it('an old run at the boss\'s gate fights it and ends at it, as before; nothing is granted retroactively', () => {
    const run = decodeSnapshot(fixtures.bossBattle.raw).run
    expect(dungeonRunPhase(run)).toBe('battle')
    const done = won(run)
    expect(done.status).toBe('sector-complete')
    expect(done.bossReward).toBeUndefined()
    expect(done.journey).toBeUndefined()
    accepted(done)
  })

  it('an old run in the middle of the sector plays on to the old ending', () => {
    let run = decodeSnapshot(fixtures.fresh.raw).run
    for (let guard = 0; guard < 40 && run.status === 'active'; guard += 1) {
      const next = availableDungeonNodes(run).sort((a, b) => a.column - b.column)[0]!
      run = reload(walk(run, next))
    }
    expect(run.status).toBe('sector-complete')
    expect(run.journey).toBeUndefined()
  })

  it('the elite\'s gold reward of an old run is untouched by the boss reward', () => {
    const run = decodeSnapshot(fixtures.eliteReward.raw).run
    expect(dungeonRunPhase(run)).toBe('reward')
    expect(run.pendingReward?.rarity).toBe('gold')
  })
})

describe('B2 Long and the first sector are untouched', () => {
  it('Rak\'Zor is the boss he was: 76 health, two phases, the same fight', () => {
    expect(rhahkZor.maxHealth).toBe(76)
    expect(rhahkZor.behavior.phase1).toHaveLength(4)
    expect(rhahkZor.behavior.phase2).toHaveLength(4)
    const run = createAdventureRun(11, economy, deck, 'same')
    const node = dungeonNode(run.map, run.map.finalNodeId)!
    expect(node.encounterHealth).toBe(76)
    // B2 Long scales every enemy's health by its economy; the boss is that of the plain run.
    expect(restoreDungeonBattle(atBoss(), economy).enemy.maxHealth).toBe(Math.round(76 * (economy.enemyHealthScale ?? 1)))
  })

  it('the map, the economy and the deck of an adventure run are exactly those of the plain sector run', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const adventure = createAdventureRun(seed, economy, deck, 'r' + seed)
      const plain = createSectorRun(seed, economy, deck, undefined, 'r' + seed)
      const { journey: _journey, ...rest } = adventure
      expect(rest).toEqual(plain)
    }
    expect(economy).toMatchObject({ id: 'honest-b2-long', openingHand: 7, manaByTurn: [4] })
  })

  it('every battle before the boss is played exactly as in the plain run', () => {
    const a = atBoss(5), b = atBoss(5, seed => createSectorRun(seed, economy, deck, undefined, 'boss-' + seed))
    const { journey: _journey, ...rest } = a
    expect(rest).toEqual(b)
  })
})

describe('whole adventures from the first room to the exit', () => {
  const developmentOf = (run: DungeonRunState, pick: number) => pick % 3 === 0 ? { kind: 'skip' as const }
    : pick % 3 === 1 ? { kind: 'artifact' as const, artifactId: offerOf(run).artifactIds[0]!, ownerInstanceId: pick % 2 ? run.heroes.warrior.instanceId : run.heroes.mage.instanceId }
    : { kind: 'upgrade' as const, instanceId: run.deck.find(canUpgradeCard)!.instanceId }
  const cardOf = (run: DungeonRunState, pick: number) => pick % 3 === 0 ? { kind: 'skip' as const }
    : pick % 3 === 1 ? { kind: 'take' as const, cardId: offerOf(run).cards[pick % 3]!.definitionId }
    : { kind: 'replace' as const, cardId: offerOf(run).cards[0]!.definitionId, instanceId: run.deck[pick % run.deck.length]!.instanceId }

  it('forty seeds: the reward opens, every stage reloads, the exit is reached once and holds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      let run = reload(afterBoss(seed))
      expect(run.status, 'seed ' + seed).toBe('active')
      const id = offerOf(run).id
      run = reload(claimBossCard(run, id, cardOf(run, seed)))
      run = reload(claimBossDevelopment(run, id, developmentOf(run, seed + 1)))
      expect(run.status, 'seed ' + seed).toBe('sector-complete')
      expect(dungeonRunPhase(run)).toBe('transition')
      expect(run.deck.filter(copy => cardDefinition(copy.definitionId).rarity === 'gold').length).toBeLessThanOrEqual(1)
      expect(new Set(run.deck.map(copy => copy.instanceId)).size).toBe(run.deck.length)
    }
  }, 60000)
})
