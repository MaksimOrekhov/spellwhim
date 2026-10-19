import { describe, expect, it } from 'vitest'
import { availableDungeonNodes, claimDungeonReward, createDungeonRun, dungeonRewardOptions, dungeonRunPhase, enterDungeonNode, enumerateDungeonPaths, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle, skipDungeonReward } from './campaign'
import type { DungeonRunState } from './campaign'
import { endTurn, startCardPlay } from './battle'
import { gameEconomy, playableEconomies } from './economy'
import { CATALOG_VERSION, createRunSaveStore, decodeSnapshot, encodeSnapshot, RUN_SAVE_KEY, validateRun } from './runSave'

function memory() {
  const data = new Map<string, string>()
  let failKey = ''
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (key === failKey) throw new Error('quota'); data.set(key, value) },
    fail: (key = '') => { failKey = key },
  }
}
const roundTrip = (run: DungeonRunState) => decodeSnapshot(encodeSnapshot(run, gameEconomy, 7)).run
function win(run: DungeonRunState) {
  const battle = restoreDungeonBattle(run)
  battle.result = 'victory'
  battle.heroes.warrior.health = Math.max(1, battle.heroes.warrior.health - 2)
  battle.heroes.mage.health = Math.max(1, battle.heroes.mage.health - 1)
  return resolveDungeonBattle(run, battle)
}
function entry(seed = 77) {
  const run = createDungeonRun(seed)
  return enterDungeonNode(run, availableDungeonNodes(run)[0]!.id)
}

describe('versioned run snapshot and restoration phases', () => {
  it('round-trips the full generated map, IDs, counters, heroes, configuration and empty future-operation ledger', () => {
    const run = createDungeonRun(0xffffffff)
    expect(roundTrip(run)).toEqual(run)
    expect(dungeonRunPhase(roundTrip(run))).toBe('map')
    const snapshot = decodeSnapshot(encodeSnapshot(run, playableEconomies.U, 2))
    expect(snapshot.economy).toEqual(playableEconomies.U)
    expect(snapshot.catalogVersion).toBe(CATALOG_VERSION)
    expect(snapshot.revision).toBe(2)
  })

  it('restores the same battle entry after damage, RNG changes and partially paid play with fresh action identities', () => {
    const run = entry()
    const pristine = structuredClone(run)
    const original = restoreDungeonBattle(run, gameEconomy, 'before-close')
    const expected = structuredClone(original)
    endTurn(original)
    const playable = original.hand.find(card => card.definitionId === 'sword-strike') ?? original.hand[0]!
    startCardPlay(original, playable.instanceId)
    expect(run).toEqual(pristine)
    const restored = restoreDungeonBattle(roundTrip(run), gameEconomy, 'after-close')
    expect(dungeonRunPhase(roundTrip(run))).toBe('battle')
    expect(restored.enemy).toEqual(expected.enemy)
    expect(restored.heroes).toEqual(expected.heroes)
    expect(restored.artifacts).toEqual(expected.artifacts)
    expect(restored.hand).toEqual(expected.hand)
    expect(restored.drawPile).toEqual(expected.drawPile)
    expect(restored.seed).toBe(expected.seed)
    expect(restored.rngState).toBe(expected.rngState)
    expect(restored.turn).toBe(1)
    expect(restored.pending).toBeNull()
    expect(restored.battleId).not.toBe(expected.battleId)
  })

  it('rejects a stale battle result from a previous run even when seed and room match', () => {
    const run = entry(90)
    const stale = restoreDungeonBattle(entry(90))
    stale.result = 'victory'
    const before = structuredClone(run)
    expect(() => resolveDungeonBattle(run, stale)).toThrow(/Stale/)
    expect(run).toEqual(before)
  })

  it('restores an unresolved reward and keeps the post-victory health; taking or skipping it survives restart', () => {
    const reward = win(entry())
    const restored = roundTrip(reward)
    expect(dungeonRunPhase(restored)).toBe('reward')
    expect(restored.pendingReward).toEqual(reward.pendingReward)
    expect(restored.heroes.warrior.health).toBe(23)
    expect(restored.battleEntry).toBeNull()
    expect(() => resolveDungeonBattle(restored, restoreDungeonBattle(entry()))).toThrow()
    const chosen = roundTrip(claimDungeonReward(restored, dungeonRewardOptions(restored)[0]!, restored.pendingReward!.id))
    const skipped = roundTrip(skipDungeonReward(restored, restored.pendingReward!.id))
    expect(dungeonRunPhase(chosen)).toBe('map')
    expect(dungeonRunPhase(skipped)).toBe('map')
    expect(chosen.pendingReward).toBeNull()
    expect(skipped.pendingReward).toBeNull()
    expect(chosen.heroes).toEqual(reward.heroes)
    expect(skipped.heroes).toEqual(reward.heroes)
  })

  it('restores an unresolved rest, commits healing once and cannot repeat the service after reload', () => {
    let run = createDungeonRun(81)
    const path = enumerateDungeonPaths(run.map).find(nodes => nodes.some(node => node.type === 'rest'))!
    for (const node of path) {
      run = enterDungeonNode(run, node.id)
      if (node.type === 'rest') {
        run = roundTrip(run)
        expect(dungeonRunPhase(run)).toBe('rest')
        const old = run.heroes.warrior.health
        run = roundTrip(resolveDungeonRest(run, 'warrior'))
        expect(run.heroes.warrior.health).toBe(Math.min(25, old + 6))
        expect(dungeonRunPhase(run)).toBe('map')
        expect(() => resolveDungeonRest(run, 'mage')).toThrow()
        return
      }
      run = win(run)
      run = claimDungeonReward(run, dungeonRewardOptions(run)[0]!, run.pendingReward!.id)
    }
    throw new Error('Missing rest')
  })

  it.each(['victory', 'defeat'] as const)('preserves terminal %s and never offers continuation or another reward', result => {
    let run = createDungeonRun(82)
    if (result === 'defeat') {
      run = enterDungeonNode(run, availableDungeonNodes(run)[0]!.id)
      const battle = restoreDungeonBattle(run)
      battle.heroes.mage.health = 0
      battle.result = 'defeat'
      run = resolveDungeonBattle(run, battle)
    } else {
      for (const node of enumerateDungeonPaths(run.map)[0]!) {
        run = enterDungeonNode(run, node.id)
        if (node.type === 'rest') run = resolveDungeonRest(run, null)
        else {
          run = win(run)
          if (run.pendingReward) run = claimDungeonReward(run, dungeonRewardOptions(run)[0]!, run.pendingReward.id)
        }
      }
    }
    const restored = roundTrip(run)
    expect(restored.status).toBe(result)
    expect(dungeonRunPhase(restored)).toBe('complete')
    expect(availableDungeonNodes(restored)).toEqual([])
    expect(restored.pendingReward).toBeNull()
    expect(() => restoreDungeonBattle(restored)).toThrow()
  })

  const corruptions: [string, (run: DungeonRunState) => void][] = [
    ['duplicate copy ID', run => { run.deck[1]!.instanceId = run.deck[0]!.instanceId }],
    ['unknown definition', run => { (run.deck[0] as { definitionId: string }).definitionId = 'unknown' }],
    ['invalid upgrade', run => { (run.deck[0] as { upgrade: number }).upgrade = 2 }],
    ['reused creation counter', run => { run.nextCardId = 1 }],
    ['out-of-range health', run => { run.heroes.mage.health = 19 }],
    ['dead active party', run => { run.heroes.mage.health = 0 }],
    ['duplicate hero IDs', run => { run.heroes.mage.instanceId = run.heroes.warrior.instanceId }],
    ['missing artifact owner', run => { run.artifacts.push({ instanceId: 'a', definitionId: 'reliable-wedge', ownerInstanceId: 'absent' }) }],
    ['unknown executable effect', run => { Object.assign(run, { futureEffects: [{ type: 'free-card' }] }) }],
    ['invalid current room', run => { run.currentNodeId = 'absent' }],
    ['disconnected route', run => { run.visitedNodeIds = ['final']; run.currentNodeId = 'final' }],
    ['missing battle entry', run => { const next = enterDungeonNode(run, availableDungeonNodes(run)[0]!.id); Object.assign(run, next, { battleEntry: null }) }],
    ['wrong battle seed', run => { const next = enterDungeonNode(run, availableDungeonNodes(run)[0]!.id); Object.assign(run, next); run.battleEntry!.seed++ }],
    ['extra decision', run => { run.decisions.push('made-up-reward') }],
    ['invalid map', run => { run.map.layers[0]![0]!.edges = [] }],
  ]
  it.each(corruptions)('rejects %s without publishing a repaired run', (_, mutate) => {
    const run = createDungeonRun(83)
    mutate(run)
    expect(() => validateRun(run)).toThrow()
    expect(() => encodeSnapshot(run, gameEconomy, 1)).toThrow()
  })

  it('validates offer/source coherence and owner uniqueness', () => {
    const reward = win(entry())
    const badReward = structuredClone(reward)
    badReward.pendingReward!.id = 'another-run/offer'
    expect(() => validateRun(badReward)).toThrow()
    reward.decisions.push(reward.pendingReward!.id)
    expect(() => validateRun(reward)).toThrow()
    const run = createDungeonRun(84)
    run.artifacts = ['reliable-wedge', 'double-pulley'].map((id, index) => ({ instanceId: 'a/' + index, definitionId: id as 'reliable-wedge' | 'double-pulley', ownerInstanceId: run.heroes.warrior.instanceId }))
    expect(() => validateRun(run)).toThrow()
  })
})

describe('local snapshot transport and failure recovery', () => {
  it('treats an empty store as a fresh installation and mirrors the latest committed generation', () => {
    const storage = memory()
    const store = createRunSaveStore(() => storage)
    expect(store.load()).toEqual({ snapshot: null, blocked: false, message: '' })
    const run = createDungeonRun(85)
    expect(store.save(run, gameEconomy).ok).toBe(true)
    expect(storage.data.get(RUN_SAVE_KEY)).toBe(storage.data.get(RUN_SAVE_KEY + '.backup'))
    const snapshot = createRunSaveStore(() => storage).load().snapshot!
    expect(snapshot.run).toEqual(run)
  })

  it('recovers from a corrupt primary without resurrecting an accepted reward', () => {
    const storage = memory()
    const store = createRunSaveStore(() => storage)
    const reward = win(entry())
    store.save(reward, gameEconomy)
    const claimed = claimDungeonReward(reward, dungeonRewardOptions(reward)[0]!, reward.pendingReward!.id)
    store.save(claimed, gameEconomy)
    storage.data.set(RUN_SAVE_KEY, '{truncated')
    const recovery = createRunSaveStore(() => storage).load()
    expect(recovery.blocked).toBe(false)
    expect(recovery.message).toContain('резервной')
    expect(recovery.snapshot!.run).toEqual(claimed)
    expect(recovery.snapshot!.run.pendingReward).toBeNull()
  })

  it('keeps the previous valid snapshot on a failed primary write; retry persists the same decision only once', () => {
    const storage = memory()
    const store = createRunSaveStore(() => storage)
    const reward = win(entry())
    store.save(reward, gameEconomy)
    const skipped = skipDungeonReward(reward, reward.pendingReward!.id)
    storage.fail(RUN_SAVE_KEY)
    expect(store.save(skipped, gameEconomy).ok).toBe(false)
    expect(createRunSaveStore(() => storage).load().snapshot!.run).toEqual(reward)
    expect(decodeSnapshot(store.exportSnapshot()).run).toEqual(skipped)
    storage.fail()
    expect(store.save(skipped, gameEconomy).ok).toBe(true)
    const restored = createRunSaveStore(() => storage).load().snapshot!.run
    expect(restored).toEqual(skipped)
    expect(() => skipDungeonReward(restored, reward.pendingReward!.id)).toThrow()
  })

  it('reports mirror failure and chooses the newer valid primary; retry repairs the mirror', () => {
    const storage = memory()
    const store = createRunSaveStore(() => storage)
    const reward = win(entry())
    store.save(reward, gameEconomy)
    const skipped = skipDungeonReward(reward, reward.pendingReward!.id)
    storage.fail(RUN_SAVE_KEY + '.backup')
    expect(store.save(skipped, gameEconomy).ok).toBe(false)
    expect(createRunSaveStore(() => storage).load().snapshot!.run).toEqual(skipped)
    storage.fail()
    expect(store.save(skipped, gameEconomy).ok).toBe(true)
    expect(storage.data.get(RUN_SAVE_KEY)).toBe(storage.data.get(RUN_SAVE_KEY + '.backup'))
  })

  it('handles unavailable storage, invalid JSON, altered checksums and two damaged records without throwing', () => {
    const unavailable = createRunSaveStore(() => { throw new Error('access denied') })
    expect(unavailable.load().blocked).toBe(true)
    expect(unavailable.save(createDungeonRun(86), gameEconomy).ok).toBe(false)
    expect(unavailable.exportSnapshot()).not.toBe('')
    for (const raw of ['null', '{}', '{', '[]', '{"payload":{},"checksum":"bad"}']) {
      const storage = memory()
      storage.data.set(RUN_SAVE_KEY, raw)
      storage.data.set(RUN_SAVE_KEY + '.backup', raw)
      expect(createRunSaveStore(() => storage).load()).toMatchObject({ snapshot: null, blocked: true })
    }
    const raw = encodeSnapshot(createDungeonRun(87), gameEconomy, 1)
    const altered = JSON.parse(raw)
    altered.payload.run.heroes.mage.health = 1
    expect(() => decodeSnapshot(JSON.stringify(altered))).toThrow()
  })

  it.each(['schemaVersion', 'rulesVersion', 'generatorVersion', 'catalogVersion'] as const)('refuses incompatible %s and leaves both records untouched', key => {
    const storage = memory()
    const raw = encodeSnapshot(createDungeonRun(88), gameEconomy, 1)
    const incompatible = JSON.parse(raw)
    incompatible.payload[key] = key === 'schemaVersion' ? 999 : 'future'
    storage.data.set(RUN_SAVE_KEY, JSON.stringify(incompatible))
    storage.data.set(RUN_SAVE_KEY + '.backup', raw)
    const before = new Map(storage.data)
    const result = createRunSaveStore(() => storage).load()
    expect(result).toMatchObject({ snapshot: null, blocked: true })
    expect(result.message).toContain('другой версии')
    expect(storage.data).toEqual(before)
  })

  it('does not revive a finished campaign after one record is lost', () => {
    const storage = memory()
    const store = createRunSaveStore(() => storage)
    const run = entry()
    store.save(run, gameEconomy)
    const battle = restoreDungeonBattle(run)
    battle.result = 'defeat'
    battle.heroes.warrior.health = 0
    store.save(resolveDungeonBattle(run, battle), gameEconomy)
    storage.data.delete(RUN_SAVE_KEY)
    const restored = createRunSaveStore(() => storage).load().snapshot!.run
    expect(dungeonRunPhase(restored)).toBe('complete')
    expect(availableDungeonNodes(restored)).toEqual([])
  })
})
