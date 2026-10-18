import { describe, expect, it } from 'vitest'
import {
  availableDungeonNodes, claimDungeonReward, createDungeonMap, createDungeonRun, dungeonEncounter,
  dungeonNode, dungeonRewardOptions, enterDungeonNode, enumerateDungeonPaths, resolveDungeonBattle,
  resolveDungeonRest, validateDungeonMap,
} from './campaign'
import { createCampaignBattle } from './campaign'
import { deriveDungeonSeed } from './campaign'
import { forecastEnemyAction, playCard } from './battle'
import { eliteEncounterCatalog, encounterPoolsByLayer, normalEncounterCatalog } from './encountersV09'
import { cardDefinition } from './types'
import type { EnemyAction, EnemyHit } from './types'

function winCurrentNode(run: ReturnType<typeof createDungeonRun>) {
  const node = dungeonNode(run.map, run.currentNodeId!)!
  const battle = createCampaignBattle({
    encounter: dungeonEncounter(node), heroes: run.heroes, deck: run.deck,
    seed: deriveDungeonSeed(run.seed, `battle:${node.id}`), battleId: `test/${node.id}`,
  })
  battle.heroes.warrior.health = Math.min(battle.heroes.warrior.health, 14)
  battle.heroes.warrior.armor = 4
  battle.result = 'victory'
  return resolveDungeonBattle(run, battle)
}

function claimFirstReward(run: ReturnType<typeof createDungeonRun>) {
  return claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
}

describe('dungeon map generation', () => {
  it('is deterministic by seed and changes with a different seed', () => {
    expect(createDungeonMap(12345)).toEqual(createDungeonMap(12345))
    expect(createDungeonMap(12345)).not.toEqual(createDungeonMap(54321))
  })

  it('keeps every route connected, playable and within elite limits for 1,000 seeds', () => {
    for (let seed = 0; seed < 1_000; seed += 1) {
      const map = createDungeonMap(seed)
      expect(validateDungeonMap(map), `seed ${seed}`).toEqual([])
      for (const node of map.layers.flat().filter(item => item.type === 'battle')) {
        const previous = map.layers[node.layer - 1]?.filter(item => item.edges.includes(node.id)) ?? []
        expect(previous.every(item => item.encounterId !== node.encounterId), `seed ${seed}, node ${node.id}`).toBe(true)
      }
    }
  })

  it('uses distinct Deadmines archetypes, true elites and layer-appropriate pools', () => {
    expect(new Set([...normalEncounterCatalog, ...eliteEncounterCatalog].map(item => item.id)).size).toBe(normalEncounterCatalog.length + eliteEncounterCatalog.length)
    expect(normalEncounterCatalog).toHaveLength(6)
    expect(eliteEncounterCatalog).toHaveLength(2)
    const hits = (action: EnemyAction): EnemyHit[] => action.kind === 'attack' || action.kind === 'attack_all' ? [action] : action.kind === 'prepare' ? [action.prepared] : []
    for (const encounter of [...normalEncounterCatalog, ...eliteEncounterCatalog]) {
      expect(encounter.behavior.phase1.length, encounter.id).toBeGreaterThan(0)
      expect([...encounter.behavior.phase1, ...(encounter.behavior.phase2 ?? [])].every(action => ['attack', 'attack_all', 'prepare', 'defend', 'recover'].includes(action.kind)), encounter.id).toBe(true)
      for (const action of [...encounter.behavior.phase1, ...(encounter.behavior.phase2 ?? [])]) {
        for (const hit of hits(action)) expect(['warrior', 'mage'].includes(hit.kind === 'attack' ? hit.target : hit.primaryTarget)).toBe(true)
        if (action.kind === 'prepare') expect(['attack', 'attack_all'].includes(action.prepared.kind)).toBe(true)
      }
    }
    for (let seed = 0; seed < 1_000; seed += 1) {
      const map = createDungeonMap(seed)
      for (const node of map.layers.flat()) {
        if (node.type === 'battle') expect(encounterPoolsByLayer[Math.min(node.layer, 2)]).toContain(node.encounterId)
        if (node.type === 'elite') expect(eliteEncounterCatalog.map(item => item.id)).toContain(node.encounterId)
      }
    }
  })

  it('announces elite preparations and preserves the current intent when the foundry chief changes phase', () => {
    const mechanic = eliteEncounterCatalog.find(item => item.id === 'goblin-foundry-chief')!
    const battle = createCampaignBattle({ encounter: mechanic, deck: ['fireball'], seed: 81 })
    expect(forecastEnemyAction(battle).futureTargets).toMatchObject([{ target: 'warrior', attack: 4 }, { target: 'mage', attack: 4 }])
    battle.enemy.health = 30
    battle.hand = [{ instanceId: 'test-fireball', definitionId: 'fireball' }]
    battle.mana = 3
    expect(playCard(battle, 'test-fireball').ok).toBe(true)
    expect(battle.enemy.phase).toBe(2)
    expect(battle.enemy.nextAction).toMatchObject({ kind: 'prepare', name: 'Разогревает котёл' })
    expect(battle.enemy.behavior.phase2?.[0]).toMatchObject({ kind: 'prepare', name: 'Переводит котёл в красную зону' })
    expect(cardDefinition('fireball').effects[0]).toMatchObject({ type: 'damage', amount: 8 })
  })

  it('keeps enemy-facing display data out of map nodes while fixing each encounter by seed', () => {
    const map = createDungeonMap(321)
    for (const node of map.layers.flat()) {
      expect(node).not.toHaveProperty('title')
      expect(node).not.toHaveProperty('detail')
      expect(node).not.toHaveProperty('name')
      if (node.type !== 'rest') {
        const regenerated = dungeonNode(createDungeonMap(321), node.id)!
        expect(dungeonEncounter(node)).toEqual(dungeonEncounter(regenerated))
      }
    }
  })

  it('offers materially different safe, healing and elite routes', () => {
    const paths = enumerateDungeonPaths(createDungeonMap(2026))
    const profile = (path: typeof paths[number]) => ({
      battles: path.filter(node => node.type === 'battle' || node.type === 'elite' || node.type === 'final').length,
      elites: path.filter(node => node.type === 'elite').length,
      rests: path.filter(node => node.type === 'rest').length,
    })
    const profiles = paths.map(profile)
    expect(paths.length).toBeGreaterThan(3)
    expect(profiles.some(item => item.rests > 0 && item.elites === 0)).toBe(true)
    expect(profiles.some(item => item.elites > 0)).toBe(true)
    expect(new Set(profiles.map(item => `${item.battles}/${item.elites}/${item.rests}`)).size).toBeGreaterThan(1)
  })
})

describe('dungeon run transitions', () => {
  it('allows only connected next nodes and never repeats a visited node', () => {
    let run = createDungeonRun(11)
    const starts = availableDungeonNodes(run)
    expect(starts).toHaveLength(3)
    const first = starts[0]!
    const unrelated = starts[1]!
    run = enterDungeonNode(run, first.id)
    expect(() => enterDungeonNode(run, unrelated.id)).toThrow(/not an available/)
    expect(() => enterDungeonNode(run, first.id)).toThrow(/not an available/)
    expect(run.visitedNodeIds).toEqual([first.id])
  })

  it('keeps health and the deck between battles, clears carried armor, and offers deterministic rewards', () => {
    let run = createDungeonRun(19)
    const first = availableDungeonNodes(run)[0]!
    run = enterDungeonNode(run, first.id)
    run = winCurrentNode(run)
    expect(run.heroes.warrior.health).toBe(14)
    expect(run.heroes.warrior.armor).toBe(0)
    expect(run.pendingReward).toMatchObject({ nodeId: first.id, count: 3, elite: false })
    expect(run.pendingReward!.seed).not.toBe(deriveDungeonSeed(run.seed, `battle:${first.id}`))

    const offers = dungeonRewardOptions(run)
    expect(dungeonRewardOptions(run)).toEqual(offers)
    run = claimDungeonReward(run, offers[0]!)
    expect(run.deck).toHaveLength(19)
    expect(run.pendingReward).toBeNull()

    const next = availableDungeonNodes(run)[0]!
    run = enterDungeonNode(run, next.id)
    const nextBattle = createCampaignBattle({ encounter: dungeonEncounter(next), heroes: run.heroes, deck: run.deck, seed: 2 })
    expect(nextBattle.heroes.warrior).toMatchObject({ health: 14, armor: 0 })
    expect(nextBattle.drawPile.concat(nextBattle.hand).length).toBe(19)
  })

  it('heals only the selected hero up to the displayed amount and maximum HP', () => {
    const initial = createDungeonRun(22)
    const path = enumerateDungeonPaths(initial.map).find(candidate => candidate.some(node => node.type === 'rest'))!
    let run = createDungeonRun(22)
    run.heroes.warrior.health = 24
    run.heroes.mage.health = 9

    for (const node of path) {
      run = enterDungeonNode(run, node.id)
      if (node.type === 'rest') {
        const deckBefore = [...run.deck]
        const warriorBefore = run.heroes.warrior.health
        run = resolveDungeonRest(run, 'mage')
        expect(run.heroes.mage.health).toBe(15)
        expect(run.heroes.warrior.health).toBe(warriorBefore)
        expect(run.deck).toEqual(deckBefore)
        expect(availableDungeonNodes(run).length).toBeGreaterThan(0)
        return
      }
      run = claimFirstReward(winCurrentNode(run))
    }
    throw new Error('Expected the selected route to contain a rest node')
  })

  it('sets defeat and final victory outcomes and resets to a fresh run', () => {
    let run = createDungeonRun(88)
    const first = availableDungeonNodes(run)[0]!
    run = enterDungeonNode(run, first.id)
    const defeat = createCampaignBattle({ encounter: dungeonEncounter(first), heroes: run.heroes, deck: run.deck, seed: 1 })
    defeat.heroes.mage.health = 0
    defeat.result = 'defeat'
    run = resolveDungeonBattle(run, defeat)
    expect(run.status).toBe('defeat')
    expect(availableDungeonNodes(run)).toEqual([])

    let winningRun = createDungeonRun(89)
    const path = enumerateDungeonPaths(winningRun.map)[0]!
    for (const node of path) {
      winningRun = enterDungeonNode(winningRun, node.id)
      if (node.type === 'rest') winningRun = resolveDungeonRest(winningRun, null)
      else if (node.type === 'final') {
        const boss = createCampaignBattle({ encounter: dungeonEncounter(node), heroes: winningRun.heroes, deck: winningRun.deck, seed: 3 })
        boss.result = 'victory'
        winningRun = resolveDungeonBattle(winningRun, boss)
      } else winningRun = claimFirstReward(winCurrentNode(winningRun))
    }
    expect(winningRun.status).toBe('victory')
    expect(availableDungeonNodes(winningRun)).toEqual([])
    expect(createDungeonRun(90).visitedNodeIds).toEqual([])
    expect(createDungeonRun(90).deck).toHaveLength(18)
  })

  it('uses separate stable seeds for the map, battle and reward of each node', () => {
    const a = createDungeonRun(5150)
    const b = createDungeonRun(5150)
    expect(a.mapSeed).toBe(b.mapSeed)
    const node = availableDungeonNodes(a)[0]!
    const entered = enterDungeonNode(a, node.id)
    const resolved = winCurrentNode(entered)
    expect(dungeonRewardOptions(resolved)).toEqual(dungeonRewardOptions(winCurrentNode(enterDungeonNode(b, node.id))))
    expect(resolved.pendingReward?.seed).toBe(deriveDungeonSeed(a.seed, `reward:${node.id}`))
  })
})
