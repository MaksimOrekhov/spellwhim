import { describe, expect, it } from 'vitest'
import legacyRaw from '../../docs/data/deadmines-sector-one-balance-v11/fixtures/legacy-v10.json?raw'
import sectorV0Raw from '../../docs/data/deadmines-sector-one-balance-v11/fixtures/sector-v0-battle.json?raw'
import { createSectorScene } from '../ui/sectorScenes'
import { availableDungeonNodes, claimDungeonReward, createSectorRun, dungeonRewardOptions, enterDungeonNode, resolveDungeonBattle, restoreDungeonBattle } from './campaign'
import { createCampaignBattle } from './campaign'
import { endTurn, forecastEnemyAction, playCard, previewCard, startCardPlay } from './battle'
import { applyStatus, statusValue } from './statuses'
import { sectorEncounters, sectorOneElite, rhahkZor } from './sectorContent'
import type { EnemyAction } from './types'
import { chooseCard } from './balance'
import { cardDefinition } from './types'
import { gameEconomy } from './economy'
import { CATALOG_VERSION, decodeSnapshot, encodeSnapshot, createRunSaveStore, IncompatibleSave, ROOM_RULES_VERSION, RULES_VERSION, RUN_SAVE_KEY, SECTOR_CATALOG_VERSION } from './runSave'
import { resolveRoom } from './dungeonRooms'
import { publicIntent } from './observableIntent'

const reload = (run: ReturnType<typeof createSectorRun>) => decodeSnapshot(encodeSnapshot(run, gameEconomy, 1)).run
function signature(a: EnemyAction): string {
  if (a.kind === 'prepare') return 'prepare:' + signature(a.prepared)
  if (a.kind === 'attack') return `${a.target}:${a.damage}`
  if (a.kind === 'attack_all') return `all:${a.damage}:${a.primaryTarget}`
  return `${a.kind}:${a.armor}`
}
const cycles: [string, string[]][] = [
  ['old-mines-raider', ['mage:6', 'warrior:6', 'defend:3']],
  ['old-mines-digger', ['warrior:7', 'mage:7', 'prepare:warrior:12', 'warrior:12']],
  ['old-mines-watchman', ['prepare:mage:11', 'mage:11', 'warrior:6', 'recover:3']],
  ['old-mines-overseer', ['prepare:warrior:13', 'warrior:13', 'mage:6', 'defend:6']],
  ['old-mines-johnson', ['prepare:warrior:14', 'warrior:14', 'mage:7', 'defend:6', 'all:4:mage']],
  ['old-mines-rhahk-zor', ['warrior:7', 'prepare:warrior:13', 'warrior:13', 'mage:6', 'recover:4']],
]

describe('sector I v1.1 behavior and unchanged combat contracts', () => {
  it.each(cycles)('%s executes its exact disclosed cycle twice', (id, expected) => {
    const state = createCampaignBattle({ encounter: sectorEncounters.find(e => e.id === id)!, deck: ['guard'] })
    for (const action of [...expected, ...expected]) {
      expect(signature(state.enemy.nextAction)).toBe(action)
      state.heroes.warrior.armor = state.heroes.mage.armor = 100
      endTurn(state)
      expect(state.result).toBeNull()
    }
  })

  it('crosses the exact 76/2 threshold, preserves the old blow, then executes both targets in phase II', () => {
    const state = createCampaignBattle({ encounter: rhahkZor, deck: ['fireball'], seed: 42 })
    endTurn(state)
    const declared = structuredClone(state.enemy.nextAction)
    expect(rhahkZor.maxHealth).toBe(76)
    state.enemy.health = 46
    expect(playCard(state, state.hand[0]!.instanceId).ok).toBe(true)
    expect(state.enemy.health).toBe(38)
    expect(state.enemy.phase).toBe(2)
    expect(state.enemy.nextAction).toEqual(declared)
    const expected = ['prepare:warrior:13', 'warrior:13', 'all:5:warrior', 'prepare:mage:11', 'mage:11', 'warrior:8', 'recover:2', 'all:5:warrior']
    for (const action of expected) {
      expect(signature(state.enemy.nextAction)).toBe(action)
      state.heroes.warrior.armor = state.heroes.mage.armor = 100
      endTurn(state)
    }
  })

  it('does not change phase above half health', () => {
    const state = createCampaignBattle({ encounter: rhahkZor, deck: ['fireball'] })
    state.enemy.health = 47
    playCard(state, state.hand[0]!.instanceId)
    expect(state.enemy.health).toBe(39)
    expect(state.enemy.phase).toBe(1)
  })

  it.each(['old-mines-watchman', 'old-mines-overseer', 'old-mines-johnson'])('%s preparation fixes its target before armor and may be killed before resolving', id => {
    const encounter = sectorEncounters.find(e => e.id === id)!
    const state = createCampaignBattle({ encounter, deck: ['guard', 'fireball'], seed: 42 })
    const announced = structuredClone(state.enemy.nextAction)
    expect(announced.kind).toBe('prepare')
    if (announced.kind !== 'prepare' || announced.prepared.kind !== 'attack') throw Error('Fixture')
    expect(publicIntent(forecastEnemyAction(state))).toEqual({ kind: 'prepare', name: announced.name, phase: 1, targets: [announced.prepared.target], blow: 'attack' })
    playCard(state, state.hand.find(c => c.definitionId === 'guard')!.instanceId)
    expect(state.enemy.nextAction).toEqual(announced)
    const before = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
    endTurn(state)
    expect(state.enemy.nextAction).toEqual(announced.prepared)
    expect(state.heroes.warrior.health).toBe(before.warrior)
    expect(state.heroes.mage.health).toBe(before.mage)
    state.enemy.health = 1
    playCard(state, state.hand.find(c => c.definitionId === 'fireball')!.instanceId)
    expect(state.result).toBe('victory')
    expect(endTurn(state)).toBe(false)
    expect(state.heroes.warrior.health).toBe(before.warrior)
    expect(state.heroes.mage.health).toBe(before.mage)
  })

  it.each([['johnson', sectorOneElite, 4, 'mage'], ['boss phase II', rhahkZor, 5, 'warrior']] as const)('%s group damage uses independent armor from one snapshot', (_, encounter, damage, primary) => {
    const state = createCampaignBattle({ encounter, deck: ['guard'] })
    // Reach the actual declared group action through the normal scheduler.
    if (encounter === rhahkZor) {
      // A nonlethal hit moves phase; tick at 39->38 preserves current action.
      state.enemy.health = 39
      applyStatus(state, 'enemy', 'bleeding', 1)
    }
    for (let i = 0; i < 6 && state.enemy.nextAction.kind !== 'attack_all'; i++) {
      state.heroes.warrior.armor = state.heroes.mage.armor = 100
      endTurn(state)
    }
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack_all', damage, primaryTarget: primary })
    state.heroes.warrior.armor = 2; state.heroes.mage.armor = 6
    const forecast = forecastEnemyAction(state), w = state.heroes.warrior.health, m = state.heroes.mage.health
    expect(forecast.targets.map(t => [t.target, t.healthLoss])).toEqual([['warrior', damage - 2], ['mage', 0]])
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(w - damage + 2)
    expect(state.heroes.mage.health).toBe(m)
    expect(state.heroes.warrior.armor).toBe(0); expect(state.heroes.mage.armor).toBe(0)
  })

  it('bleeding crosses the phase threshold without consuming vulnerability or cancelling the declared blow', () => {
    const state = createCampaignBattle({ encounter: rhahkZor, deck: ['guard'] })
    state.enemy.health = 39; state.enemy.armor = 8
    applyStatus(state, 'enemy', 'bleeding', 1); applyStatus(state, 'enemy', 'vulnerability')
    const w = state.heroes.warrior.health
    endTurn(state)
    expect(state.enemy.health).toBe(38); expect(state.enemy.armor).toBe(8); expect(state.enemy.phase).toBe(2)
    expect(state.heroes.warrior.health).toBe(w - 7)
    expect(signature(state.enemy.nextAction)).toBe('all:5:warrior')
    expect(statusValue(state, 'enemy', 'vulnerability')).toBe(1)
    expect(statusValue(state, 'enemy', 'bleeding')).toBe(0)
  })

  it.each([['reliable-wedge', 12], ['shift-whistle', 11]] as const)('%s mitigates the prepared Johnson blow through the real forecast', (definitionId, expectedLoss) => {
    const heroes = createCampaignBattle().heroes
    const state = createCampaignBattle({ encounter: sectorOneElite, heroes, deck: ['fireball'], artifacts: [
      { instanceId: 'test-item', definitionId, ownerInstanceId: heroes.warrior.instanceId },
    ] })
    endTurn(state)
    const forecast = forecastEnemyAction(state), before = state.heroes.warrior.health
    expect(forecast.targets[0]!.healthLoss).toBe(expectedLoss)
    endTurn(state)
    expect(before - state.heroes.warrior.health).toBe(forecast.targets[0]!.healthLoss)
    expect(state.artifacts[0]!.usedThisBattle).toBe(true)
  })

  it('still consumes vulnerability on the same armored hit for every selected encounter', () => {
    for (const encounter of sectorEncounters) {
      const state = createCampaignBattle({ encounter, deck: ['fireball'] })
      state.enemy.armor = 8; applyStatus(state, 'enemy', 'vulnerability')
      const preview = previewCard(state, cardDefinition('fireball')), before = state.enemy.health
      playCard(state, state.hand[0]!.instanceId)
      expect(before - state.enemy.health).toBe(preview.healthDamage)
      expect(statusValue(state, 'enemy', 'vulnerability')).toBe(0)
    }
  })
})

describe('sector v1.1 saves and legacy isolation', () => {
  it('fingerprints behavior data without changing shared rules, rooms or the legacy catalogue', () => {
    expect(CATALOG_VERSION).toBe('e77d6518')
    // b29a110 = prototype sector, d4691ce = v1.1 PA with Rak'Zor 70 HP.
    expect(SECTOR_CATALOG_VERSION).not.toBe('b29a110')
    expect(SECTOR_CATALOG_VERSION).not.toBe('d4691ce')
    expect(RULES_VERSION).toBe('combat-upgrades-1')
    expect(ROOM_RULES_VERSION).toBe('sector-rooms-2:a7984ea9')
    const old = decodeSnapshot(legacyRaw)
    expect(decodeSnapshot(encodeSnapshot(old.run, gameEconomy, 2)).run).toEqual(old.run)
    expect(old.run.map.layers).toHaveLength(7)
  })

  it('blocks a genuine V0 unfinished fight and preserves both originals for export without backup rollback', () => {
    const old = sectorV0Raw, current = encodeSnapshot(createSectorRun(42), gameEconomy, 2)
    expect(() => decodeSnapshot(old)).toThrow(IncompatibleSave)
    const data = new Map([[RUN_SAVE_KEY, old], [RUN_SAVE_KEY + '.backup', current]])
    const before = new Map(data)
    const store = createRunSaveStore(() => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }))
    expect(store.load()).toMatchObject({ snapshot: null, blocked: true })
    expect(data).toEqual(before)
    expect(JSON.parse(store.exportSnapshot()).records).toEqual([{ key: RUN_SAVE_KEY, raw: old }, { key: RUN_SAVE_KEY + '.backup', raw: current }])
  })

  it('restarts an unfinished selected-balance battle from its saved entry, including upgraded copies', () => {
    let run = createSectorRun(91, undefined, undefined, undefined, 'balance-save')
    run.deck[0]!.upgrade = 1
    run = enterDungeonNode(run, availableDungeonNodes(run)[0]!.id)
    const expected = restoreDungeonBattle(run, gameEconomy, 'before')
    const active = restoreDungeonBattle(run, gameEconomy, 'active')
    const card = active.hand.find(c => cardDefinition(c.definitionId).cost <= active.mana)!
    startCardPlay(active, card.instanceId)
    const restored = restoreDungeonBattle(reload(run), gameEconomy, 'after')
    expect(restored.enemy).toEqual(expected.enemy)
    expect(restored.hand).toEqual(expected.hand); expect(restored.drawPile).toEqual(expected.drawPile)
    expect(restored.heroes).toEqual(expected.heroes); expect(restored.pending).toBeNull()
    expect(restored.turn).toBe(1)
    expect(reload(run).deck[0]).toEqual(run.deck[0])
    expect(reload(run).map).toEqual(run.map)
  })

  it.each(['forge', 'powder-store', 'treasure', 'rest', 'elite', 'boss', 'complete'])('restores %s and the exact route, room offers and ledger without regeneration', scene => {
    const run = createSectorScene(scene)
    expect(reload(run)).toEqual(run)
  })

  it('does not duplicate an upgraded room reward or a battle reward after reload', () => {
    const room = createSectorScene('forge')
    const command = { roomId: room.room!.id, action: 'upgrade' as const, instanceId: room.deck[0]!.instanceId }
    const upgraded = reload(resolveRoom(room, command))
    expect(upgraded.deck[0]!.upgrade).toBe(1)
    expect(() => resolveRoom(upgraded, command)).toThrow()
    // Real battle result through the engine; fixtures never manufacture victory.
    const fresh = createSectorRun(42), run = enterDungeonNode(fresh, availableDungeonNodes(fresh)[0]!.id)
    const battle = restoreDungeonBattle(run)
    // Use the existing public heuristic; no hidden deck-order access.
    for (let turn = 0; turn < 30 && !battle.result; turn++) {
      for (let n = 0; n < 40 && !battle.result; n++) {
        const card = chooseCard(battle, 'defensive')
        if (!card) break
        playCard(battle, card.instanceId)
      }
      if (!battle.result) endTurn(battle)
    }
    expect(battle.result).toBe('victory')
    const reward = reload(resolveDungeonBattle(run, battle)), offer = reward.pendingReward!
    const claimed = reload(claimDungeonReward(reward, dungeonRewardOptions(reward)[0]!))
    expect(claimed.pendingReward).toBeNull()
    expect(() => claimDungeonReward(claimed, dungeonRewardOptions(reward)[0]!, offer.id)).toThrow()
  })
})
