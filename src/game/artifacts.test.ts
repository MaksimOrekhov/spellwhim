import { describe, expect, it } from 'vitest'
import { artifactDefinitions } from './artifacts'
import { createBattle, endTurn, forecastEnemyAction, hasStatus, playCard, previewCard, resolveCardPlay, startCardPlay } from './battle'
import { claimDungeonArtifact, claimDungeonReward, createDungeonRun, dungeonArtifactOptions, dungeonEncounter, dungeonNode, dungeonRewardOptions, resolveDungeonBattle } from './campaign'
import { createCampaignBattle } from './campaign'
import { deriveDungeonSeed } from './campaign'
import { cardDefinition, encounters } from './types'
import type { ArtifactId, BattleState, CardId, HeroId } from './types'
import { applyStatus } from './statuses'

function battleWith(id: ArtifactId, owner: HeroId, deck: CardId[] = ['sword-strike']) {
  const state = createBattle(encounters[1]!, undefined, { deck, seed: 17, openingHandSize: deck.length })
  state.artifacts = [{ instanceId: 'run/17/artifact/test/' + id, definitionId: id, ownerInstanceId: state.heroes[owner].instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false }]
  return state
}

function copyId(state: BattleState, id: CardId): string {
  const card = state.hand.find(item => item.definitionId === id)
  if (!card) throw new Error('Missing card ' + id)
  return card.instanceId
}

function winElite(seed: number, artifacts: ReturnType<typeof createDungeonRun>['artifacts'] = [], runId?: string) {
  const run = createDungeonRun(seed, undefined, undefined, undefined, runId)
  run.artifacts = artifacts.map(item => ({ ...item }))
  const node = run.map.layers.flat().find(item => item.type === 'elite')!
  const entered = { ...run, currentNodeId: node.id, visitedNodeIds: [node.id] }
  const battle = createCampaignBattle({ encounter: dungeonEncounter(node), heroes: entered.heroes, seed: deriveDungeonSeed(seed, 'artifact test fight') })
  battle.result = 'victory'
  return { run: resolveDungeonBattle(entered, battle), node }
}

describe('artifact combat effects', () => {
  it('uses stable run-member ownership separate from character, class and party slot', () => {
    const state = createBattle(encounters[1]!, undefined, { seed: 17 })
    expect(state.heroes.warrior).toMatchObject({ characterId: 'varian', classId: 'warrior', partySlot: 'first' })
    expect(state.heroes.mage).toMatchObject({ characterId: 'jaina', classId: 'mage', partySlot: 'second' })
    expect(state.heroes.warrior.instanceId).not.toBe(state.heroes.mage.instanceId)
    expect(artifactDefinitions).toHaveLength(5)
  })

  it('reduces the first attack on its owner before armor and updates the shared forecast', () => {
    const state = battleWith('reliable-wedge', 'warrior')
    state.heroes.warrior.armor = 1
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 6, target: 'warrior' }
    expect(forecastEnemyAction(state).targets[0]).toMatchObject({ attack: 4, artifactReduction: 2, absorbed: 1, healthLoss: 3 })
    expect(endTurn(state)).toBe(true)
    expect(state.heroes.warrior.health).toBe(22)
    expect(state.heroes.warrior.armor).toBe(0)
    expect(state.artifacts[0]).toMatchObject({ usedThisBattle: true })
    expect(state.artifactNotices).toEqual(['Верный расклин: удар по владельцу ослаблен на 2'])
  })

  it('does not turn the wedge into a hidden death save and handles both targets on an area strike', () => {
    const single = battleWith('reliable-wedge', 'warrior')
    single.heroes.warrior.health = 2
    single.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 5, target: 'warrior' }
    expect(forecastEnemyAction(single).targets[0]).toMatchObject({ attack: 3, lethal: true, healthLoss: 2 })
    endTurn(single)
    expect(single.result).toBe('defeat')
    expect(single.artifacts[0]).toMatchObject({ usedThisBattle: true })

    const armored = battleWith('reliable-wedge', 'warrior')
    armored.heroes.warrior.armor = 8
    armored.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 5, target: 'warrior' }
    expect(forecastEnemyAction(armored).targets[0]).toMatchObject({ attack: 3, absorbed: 3, healthLoss: 0 })
    endTurn(armored)
    expect(armored.heroes.warrior.health).toBe(25)
    expect(armored.artifacts[0]).toMatchObject({ usedThisBattle: true })

    const area = createBattle(encounters[1]!, undefined, { seed: 18 })
    area.artifacts = (['warrior', 'mage'] as HeroId[]).map((owner, index) => ({ instanceId: `wedge-${index}`, definitionId: 'reliable-wedge', ownerInstanceId: area.heroes[owner].instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false }))
    area.enemy.nextAction = { kind: 'attack_all', name: 'Волна', damage: 4, primaryTarget: 'warrior' }
    expect(forecastEnemyAction(area).targets.map(target => target.artifactReduction)).toEqual([2, 2])
    endTurn(area)
    expect(area.artifacts.every(item => item.usedThisBattle)).toBe(true)
  })

  it('grants partner armor once per turn after a card actually protects its owner', () => {
    const state = battleWith('double-pulley', 'warrior', ['guard', 'bastion'])
    state.enemy.focus = 'warrior'
    state.enemy.nextAction = { kind: 'attack', name: 'Удар', damage: 4, target: 'warrior' }
    expect(previewCard(state, cardDefinition('guard'))).toMatchObject({ armor: { warrior: 4, mage: 2 }, artifactArmor: { warrior: 0, mage: 2 } })
    playCard(state, copyId(state, 'guard'))
    expect(state.heroes.warrior.armor).toBe(4)
    expect(state.heroes.mage.armor).toBe(2)
    playCard(state, copyId(state, 'bastion'))
    expect(state.heroes.mage.armor).toBe(5)
    expect(state.artifacts[0]?.lastTriggeredTurn).toBe(1)
  })

  it('converts a consumed Vulnerability into owner armor even when enemy armor absorbs the hit', () => {
    const state = battleWith('weakpoint-lens', 'mage', ['sword-strike'])
    applyStatus(state, 'enemy', 'vulnerability')
    state.enemy.armor = 50
    expect(previewCard(state, cardDefinition('sword-strike'))).toMatchObject({ damage: 9, armor: { warrior: 0, mage: 2 }, artifactArmor: { warrior: 0, mage: 2 } })
    const started = startCardPlay(state, copyId(state, 'sword-strike'))
    if (!started.ok) throw new Error('Expected a valid play')
    resolveCardPlay(state, started.play.actionId)
    expect(hasStatus(state, 'vulnerability')).toBe(false)
    expect(state.heroes.mage.armor).toBe(2)
    expect(state.artifacts[0]?.usedThisBattle).toBe(true)
    expect(resolveCardPlay(state, started.play.actionId)).toMatchObject({ ok: false, reason: 'stale-action' })
    expect(state.heroes.mage.armor).toBe(2)
  })

  it('does not apply the lens after a lethal hit or when no Vulnerability is consumed', () => {
    const state = battleWith('weakpoint-lens', 'warrior', ['sword-strike'])
    state.enemy.health = 4
    applyStatus(state, 'enemy', 'vulnerability')
    expect(previewCard(state, cardDefinition('sword-strike'))).toMatchObject({ artifactArmor: { warrior: 0, mage: 0 }, artifactBonuses: [] })
    playCard(state, copyId(state, 'sword-strike'))
    expect(state.result).toBe('victory')
    expect(state.heroes.warrior.armor).toBe(0)
    expect(state.artifacts[0]?.usedThisBattle).toBe(false)
  })

  it('pays the whistle only for a prepared single-target hit on its owner', () => {
    const state = battleWith('shift-whistle', 'mage')
    state.enemy.nextAction = { kind: 'prepare', name: 'Готовит удар', prepared: { kind: 'attack', name: 'Удар', damage: 8, target: 'mage' } }
    endTurn(state)
    expect(state.heroes.mage.armor).toBe(3)
    expect(state.artifacts[0]?.usedThisBattle).toBe(true)
    expect(forecastEnemyAction(state).targets[0]).toMatchObject({ attack: 8, absorbed: 3, healthLoss: 5 })
  })

  it('applies to the first damage card played by the party, then can trigger again on a later armored turn', () => {
    const state = battleWith('tension-spool', 'mage', ['quick-cut', 'sword-strike'])
    state.heroes.mage.armor = 1
    state.enemy.nextAction = { kind: 'defend', name: 'Защита', armor: 0 }
    endTurn(state)
    expect(state.artifacts[0]?.armedThisTurn).toBe(true)
    const attack = state.hand.find(item => item.definitionId === 'quick-cut')!
    expect(previewCard(state, cardDefinition('quick-cut'))).toMatchObject({ damage: 5, artifactDamage: 2, bonuses: ['Натяжной шкив'] })
    expect(previewCard(state, cardDefinition('sword-strike')).artifactDamage).toBe(2)
    playCard(state, attack.instanceId)
    expect(state.artifacts[0]?.lastTriggeredTurn).toBe(2)
    expect(previewCard(state, cardDefinition('sword-strike')).artifactDamage).toBe(0)

    state.heroes.mage.armor = 1
    state.enemy.nextAction = { kind: 'defend', name: 'Защита', armor: 0 }
    endTurn(state)
    expect(state.artifacts[0]?.armedThisTurn).toBe(true)
    expect(previewCard(state, cardDefinition('sword-strike'))).toMatchObject({ artifactDamage: 2, damage: 8 })
  })

  it('resets battle charges while preserving run ownership and never carries combat armor', () => {
    const state = battleWith('reliable-wedge', 'warrior')
    state.artifacts[0]!.usedThisBattle = true
    state.artifacts[0]!.lastTriggeredTurn = 3
    state.heroes.warrior.armor = 4
    const next = createBattle(encounters[1]!, state.heroes, { seed: 20, artifacts: state.artifacts })
    expect(next.artifacts[0]).toMatchObject({ instanceId: state.artifacts[0]!.instanceId, ownerInstanceId: state.heroes.warrior.instanceId, usedThisBattle: false, lastTriggeredTurn: null })
    expect(next.heroes.warrior.armor).toBe(0)
  })
})

describe('elite artifact rewards', () => {
  it('offers three deterministic unique artifacts independently from the card reward seed', () => {
    const a = winElite(411)
    const b = winElite(411)
    expect(dungeonArtifactOptions(a.run)).toHaveLength(3)
    expect(dungeonArtifactOptions(a.run)).toEqual(dungeonArtifactOptions(b.run))
    expect(dungeonArtifactOptions(a.run).map(item => item.id)).toEqual(a.run.pendingReward?.artifactIds)
    expect(a.run.pendingReward?.artifactSeed).not.toBe(a.run.pendingReward?.seed)
    expect(dungeonRewardOptions(a.run)).toEqual(dungeonRewardOptions(b.run))
  })

  it('validates offered cards, artifact ownership, replacement, duplicate and slot limits', () => {
    let { run } = winElite(412)
    const artifact = dungeonArtifactOptions(run)[0]!
    const hero = run.heroes.mage
    const absent = artifactDefinitions.find(item => !run.pendingReward?.artifactIds.includes(item.id))!
    expect(() => claimDungeonArtifact(run, absent.id, hero.instanceId)).toThrow(/not in the current/)
    run = claimDungeonArtifact(run, artifact.id, hero.instanceId)
    expect(run.artifacts).toHaveLength(1)
    expect(run.artifacts[0]).toMatchObject({ definitionId: artifact.id, ownerInstanceId: hero.instanceId })
    expect(run.pendingReward).toBeNull()
    expect(() => claimDungeonArtifact(run, artifact.id, hero.instanceId)).toThrow()
    expect(() => claimDungeonReward(run, dungeonRewardOptions(run)[0]!)).toThrow()
  })

  it('replaces only the selected owner slot and rejects malformed transfer requests', () => {
    const { run: earned } = winElite(413)
    const first = dungeonArtifactOptions(earned)[0]!
    const run = claimDungeonArtifact(earned, first.id, earned.heroes.warrior.instanceId)
    const nextSeed = 414
    const base = createDungeonRun(nextSeed)
    const owned = { instanceId: `run/${nextSeed}/artifact/old/reliable-wedge`, definitionId: 'reliable-wedge' as const, ownerInstanceId: base.heroes.warrior.instanceId }
    const next = winElite(nextSeed, [owned], base.runId)
    const second = dungeonArtifactOptions(next.run).find(item => item.id !== first.id)!
    expect(() => claimDungeonArtifact(next.run, second.id, next.run.heroes.warrior.instanceId, 'wrong-instance')).toThrow(/confirm its replacement/)
    const replaced = claimDungeonArtifact(next.run, second.id, next.run.heroes.warrior.instanceId, owned.instanceId)
    expect(replaced.artifacts).toHaveLength(1)
    expect(replaced.artifacts[0]?.definitionId).toBe(second.id)
    expect(run.artifacts[0]?.definitionId).toBe(first.id)
  })

  it('does not alter the combat draw sequence when the run carries artifacts', () => {
    const { run: earned } = winElite(415)
    const found = dungeonArtifactOptions(earned)[0]!
    const run = claimDungeonArtifact(earned, found.id, earned.heroes.mage.instanceId)
    const node = dungeonNode(run.map, run.currentNodeId!)!
    const baseline = createCampaignBattle({ encounter: dungeonEncounter(node), heroes: run.heroes, deck: run.deck, seed: 99, battleId: 'rng-control' })
    const equipped = createCampaignBattle({ encounter: dungeonEncounter(node), heroes: run.heroes, deck: run.deck, seed: 99, battleId: 'rng-control', artifacts: run.artifacts })
    expect(equipped.rngState).toBe(baseline.rngState)
    expect(equipped.hand).toEqual(baseline.hand)
    expect(equipped.drawPile).toEqual(baseline.drawPile)
  })
})
