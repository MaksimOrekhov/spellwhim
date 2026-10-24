import { describe, expect, it } from 'vitest'
import { chooseCard } from './balance'
import { createBattle, endTurn, playCard } from './battle'
import { createCampaignBattle, createDungeonRun, createSectorRun, dungeonEncounter, equipDungeonArtifact } from './campaign'
import { baselineEconomy, drawForTurn, economyFromSpec, gameEconomy, honestEconomies, isHonestEconomy, knownEconomies, manaForTurn, playableEconomies, scaleEnemyDamage } from './economy'
import { createRoomVisit } from './dungeonRooms'
import { HONEST_RULES_VERSION, RULES_VERSION, RUN_SAVE_KEY, createRunSaveStore, decodeSnapshot, encodeSnapshot, rulesVersionFor } from './runSave'
import { requestedSeed, resolveRulesMode, rulesModeHref, rulesModes } from './rulesMode'
import { sectorOneEnemies, rhahkZor } from './sectorContent'
import type { EconomyConfig } from './economy'
import type { BattleState, CardId, EncounterDefinition, EnemyAction } from './types'
import { startingDeck } from './types'

const A08 = honestEconomies['honest-a08']
const A09 = honestEconomies['honest-a09']

/** A scripted opponent that cannot be killed, so only the rules under test move. */
function dummy(actions: EnemyAction[]): EncounterDefinition {
  return { id: 'dummy', name: 'Чучело', title: 'Проверка', maxHealth: 10_000, appearance: 'defias', mapLabel: 'Проверка', behavior: { phase1: actions } }
}
const hit = (damage: number, target: 'warrior' | 'mage' = 'warrior'): EnemyAction => ({ kind: 'attack', name: 'Удар', damage, target })
function start(economy: EconomyConfig, actions: EnemyAction[], deck: readonly CardId[] = startingDeck, seed = 5) {
  const state = createBattle(dummy(actions), undefined, { deck, seed, economy })
  state.heroes.warrior.health = state.heroes.warrior.maxHealth = 1000
  state.heroes.mage.health = state.heroes.mage.maxHealth = 1000
  return state
}
const idsOf = (state: BattleState) => [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhausted].map(card => card.instanceId).sort()
function playFirst(state: BattleState, id: CardId) {
  const card = state.hand.find(item => item.definitionId === id)
  if (!card) throw new Error('No ' + id + ' in hand')
  expect(playCard(state, card.instanceId).ok).toBe(true)
}
function equip(state: BattleState, definitionId: 'shift-whistle' | 'tension-spool', owner: 'warrior' | 'mage') {
  state.artifacts = [{ instanceId: 'test/' + definitionId, definitionId, ownerInstanceId: state.heroes[owner].instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false }]
}

describe('Honest Turn A — the presets', () => {
  it('are 7 cards, flat 4 mana, discard, armor for one enemy action, 1.75x health; the two differ only in the damage fraction', () => {
    for (const economy of [A08, A09]) {
      expect(economy).toMatchObject({ openingHand: 7, manaByTurn: [4], drawSchedule: { perTurn: 7 }, discardHand: true, armorExpiry: 'turn', enemyHealthScale: 1.75, excludedArtifacts: ['tension-spool'] })
      expect([1, 2, 5, 40].map(turn => manaForTurn(economy, turn))).toEqual([4, 4, 4, 4])
      expect([2, 3, 9].map(turn => drawForTurn(economy, turn))).toEqual([7, 7, 7])
    }
    expect(A08.enemyDamageScale).toBe(0.8)
    expect(A09.enemyDamageScale).toBe(0.9)
    const { id: _a, label: _la, enemyDamageScale: _da, ...rest08 } = A08
    const { id: _b, label: _lb, enemyDamageScale: _db, ...rest09 } = A09
    expect(rest08).toEqual(rest09)
    expect(isHonestEconomy(A08)).toBe(true)
  })

  it('leave the historical economies byte-identical: no experimental field exists on A, B or U, so their saves keep reading', () => {
    for (const economy of Object.values(playableEconomies)) {
      for (const field of ['discardHand', 'armorExpiry', 'enemyDamageScale', 'excludedArtifacts']) expect(Object.keys(economy)).not.toContain(field)
      expect(isHonestEconomy(economy)).toBe(false)
    }
    // The three historical models and the A presets, then the B1/B2 presets of docs/design/honest-turn-b-experiment-v1.md.
    expect(knownEconomies()).toHaveLength(9) // + the two long-route economies (X03)
    expect(gameEconomy.id).toBe('B')
    expect(economyFromSpec('honest-a08')).toBe(A08)
    expect(economyFromSpec('B')).toBe(gameEconomy)
  })
})

describe('Honest Turn A — enemy numbers', () => {
  it('scales every damaging number (a prepared strike included) and nothing else', () => {
    const scaled = scaleEnemyDamage(rhahkZor.behavior, 0.8)
    expect(scaled.phase1.map(action => action.kind === 'prepare' ? action.prepared.damage : 'damage' in action ? action.damage : action.armor)).toEqual([6, 10, 5, 4])
    expect(scaled.phase2!.map(action => action.kind === 'prepare' ? action.prepared.damage : 'damage' in action ? action.damage : action.armor)).toEqual([4, 9, 6, 2])
    expect(scaleEnemyDamage(rhahkZor.behavior, 0.9).phase1.map(action => action.kind === 'prepare' ? action.prepared.damage : 'damage' in action ? action.damage : action.armor)).toEqual([6, 12, 5, 4])
    expect(scaleEnemyDamage(rhahkZor.behavior, 1)).toBe(rhahkZor.behavior)
    expect(rhahkZor.behavior.phase1[1]).toMatchObject({ prepared: { damage: 13 } })
  })

  it('applies to the sector encounters only through the economy, without changing the map of a seed', () => {
    const control = createSectorRun(42, gameEconomy)
    const honest = createSectorRun(42, A08)
    expect(honest.map).toEqual(control.map)
    const boss = control.map.layers.flat().find(node => node.type === 'final')!
    expect(dungeonEncounter(boss, gameEconomy)).toMatchObject({ maxHealth: 76, behavior: rhahkZor.behavior })
    const scaled = dungeonEncounter(boss, A08)
    expect(scaled.maxHealth).toBe(133)
    expect(scaled.behavior.phase1[1]).toMatchObject({ prepared: { damage: 10 } })
    expect(dungeonEncounter(boss, A09).behavior.phase1[1]).toMatchObject({ prepared: { damage: 12 } })
    const normal = sectorOneEnemies.map(encounter => Math.round(encounter.maxHealth * 1.75))
    expect(normal).toEqual([56, 63, 60, 70])
    expect(createSectorRun(42, A08).map.layers.flat().filter(node => node.encounterId).every(node => dungeonEncounter(node, A08).maxHealth === Math.round(node.encounterHealth! * 1.75))).toBe(true)
  })
})

describe('Honest Turn A — the turn', () => {
  it('starts with 7 cards and 4 mana, and every later turn is a fresh 7 with 4 mana', () => {
    const state = start(A08, [hit(1)])
    expect(state.hand).toHaveLength(7)
    expect(state.mana).toBe(4)
    const everything = idsOf(state)
    // The first turn: all seven unplayed cards go to the discard pile and the new hand is drawn from the other eleven.
    const unplayed = state.hand.map(card => card.instanceId)
    expect(endTurn(state)).toBe(true)
    expect(state.discardPile.map(card => card.instanceId).sort()).toEqual([...unplayed].sort())
    expect(state.hand.some(card => unplayed.includes(card.instanceId))).toBe(false)
    for (let turn = 0; turn < 40; turn += 1) {
      expect(state.hand).toHaveLength(7)
      expect(state.mana).toBe(4)
      expect(state.maxMana).toBe(4)
      expect(idsOf(state)).toEqual(everything)
      expect(endTurn(state)).toBe(true)
    }
  })

  it('does not discard in the standard game', () => {
    const state = start(gameEconomy, [hit(1)])
    const before = state.hand.map(card => card.instanceId)
    endTurn(state)
    expect(state.hand.map(card => card.instanceId).slice(0, before.length)).toEqual(before)
    expect(state.hand.length).toBeGreaterThan(before.length)
  })

  it('is deterministic for one seed and one sequence of plays', () => {
    const run = () => {
      const state = start(A09, [hit(6, 'mage'), hit(7)], startingDeck, 99)
      for (let turn = 0; turn < 8; turn += 1) {
        for (let n = 0; n < 6; n += 1) { const card = chooseCard(state, 'balanced'); if (!card) break; playCard(state, card.instanceId) }
        endTurn(state)
      }
      return JSON.stringify(state)
    }
    expect(run()).toBe(run())
  })
})

describe('Honest Turn A — armor lives one enemy action', () => {
  it('clears the armor of a hero who was not hit, which the standard game keeps for later', () => {
    for (const [economy, kept] of [[A08, 0], [gameEconomy, 5]] as const) {
      const state = start(economy, [hit(3, 'warrior')], ['interpose', 'guard', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike'])
      state.enemy.focus = 'warrior'
      playFirst(state, 'interpose')
      expect(state.heroes.mage.armor).toBe(5)
      endTurn(state)
      expect(state.heroes.warrior.armor).toBe(0)
      expect(state.heroes.mage.armor).toBe(kept)
    }
  })

  it('clears armor placed on a quiet turn, so a windup cannot be answered a turn early', () => {
    const windup: EnemyAction = { kind: 'prepare', name: 'Замах', prepared: { kind: 'attack', name: 'Молот', damage: 10, target: 'warrior' } }
    for (const [economy, armor] of [[A08, 0], [gameEconomy, 4]] as const) {
      const state = start(economy, [windup, hit(1)], ['guard', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike'])
      playFirst(state, 'guard')
      expect(state.heroes.warrior.armor).toBe(4)
      endTurn(state)
      expect(state.heroes.warrior.armor).toBe(armor)
    }
  })

  it('clears armor BEFORE the Shift Whistle fires, so its 3 armor is still there when the announced strike lands', () => {
    const windup: EnemyAction = { kind: 'prepare', name: 'Замах', prepared: { kind: 'attack', name: 'Молот', damage: 10, target: 'warrior' } }
    const deck: CardId[] = ['guard', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike']
    const honest = start(A08, [windup], deck)
    equip(honest, 'shift-whistle', 'warrior')
    playFirst(honest, 'guard')
    endTurn(honest)
    // The guard's 4 armor expired; the whistle's 3 was granted after the clear and survives into the player's turn.
    expect(honest.heroes.warrior.armor).toBe(3)
    expect(honest.enemy.nextAction).toMatchObject({ kind: 'attack', damage: 10 })
    expect(honest.artifactNotices.join(' ')).toContain('Свисток')
    endTurn(honest)
    expect(honest.heroes.warrior.health).toBe(1000 - 7)

    const control = start(gameEconomy, [windup], deck)
    equip(control, 'shift-whistle', 'warrior')
    playFirst(control, 'guard')
    endTurn(control)
    expect(control.heroes.warrior.armor).toBe(7)
  })

  it('lets armor absorb the hit it was played for, and the partner keeps nothing', () => {
    const state = start(A09, [hit(7, 'warrior')], ['guard', 'ice-ward', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike', 'sword-strike'])
    state.enemy.focus = 'warrior'
    playFirst(state, 'guard')
    playFirst(state, 'ice-ward')
    expect(state.heroes.warrior.armor).toBe(7)
    expect(state.heroes.mage.armor).toBe(2)
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(1000)
    expect([state.heroes.warrior.armor, state.heroes.mage.armor]).toEqual([0, 0])
  })
})

describe('Honest Turn A — the Tension Spool', () => {
  it('is never offered: not in elite rewards, not in treasure rooms, not equippable', () => {
    let spoolSeenInControl = false
    for (let seed = 1; seed <= 150; seed += 1) {
      const honest = createSectorRun(seed, A08)
      const control = createSectorRun(seed, gameEconomy)
      expect(honest.excludedArtifacts).toEqual(['tension-spool'])
      expect(control.excludedArtifacts).toBeUndefined()
      for (const node of honest.map.layers.flat().filter(item => item.type === 'treasure')) {
        const a = createRoomVisit(honest, node).artifactIds
        expect(a).not.toContain('tension-spool')
        if (createRoomVisit(control, node).artifactIds.includes('tension-spool')) spoolSeenInControl = true
      }
    }
    expect(spoolSeenInControl).toBe(true)
    const run = createSectorRun(7, A08)
    expect(() => equipDungeonArtifact(run, 'tension-spool', run.heroes.warrior.instanceId, undefined, 'test')).toThrow()
    const standard = createSectorRun(7, gameEconomy)
    expect(() => equipDungeonArtifact(standard, 'tension-spool', standard.heroes.warrior.instanceId, undefined, 'test')).not.toThrow()
  })

  it('leaves the other four items on offer', () => {
    const offered = new Set<string>()
    for (let seed = 1; seed <= 300; seed += 1) {
      const run = createSectorRun(seed, A08)
      for (const node of run.map.layers.flat().filter(item => item.type === 'treasure')) createRoomVisit(run, node).artifactIds.forEach(id => offered.add(id))
    }
    expect([...offered].sort()).toEqual(['double-pulley', 'reliable-wedge', 'shift-whistle', 'weakpoint-lens'])
  })
})

describe('Honest Turn A — a whole sector fight is playable', () => {
  it('finishes every sector enemy with the fair bot, under both damage fractions, without losing a card', () => {
    for (const economy of [A08, A09]) {
      const run = createSectorRun(11, economy)
      for (const node of run.map.layers.flat().filter(item => ['battle', 'elite', 'final'].includes(item.type))) {
        const state = createCampaignBattle({ encounter: dungeonEncounter(node, economy), economy, seed: 3, deck: run.deck })
        const everything = idsOf(state)
        for (let turn = 0; turn < 60 && !state.result; turn += 1) {
          for (let n = 0; n < 12 && !state.result; n += 1) { const card = chooseCard(state, 'balanced'); if (!card) break; playCard(state, card.instanceId) }
          if (!state.result) endTurn(state)
          expect(idsOf(state)).toEqual(everything)
        }
        expect(state.result, node.id).not.toBeNull()
      }
    }
  })
})

describe('Honest Turn A — saves and modes', () => {
  function memory() {
    const data = new Map<string, string>()
    return { data, storage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } } }
  }

  it('round-trips under its own rules version and nobody else reads it as theirs', () => {
    const run = createSectorRun(21, A08, undefined, undefined, 'run-honest')
    const raw = encodeSnapshot(run, A08, 1)
    const snapshot = decodeSnapshot(raw)
    expect(snapshot.rulesVersion).toBe(HONEST_RULES_VERSION)
    expect(snapshot.economy).toEqual(A08)
    expect(snapshot.run).toEqual(run)
    expect(rulesVersionFor(gameEconomy)).toBe(RULES_VERSION)
    expect(RULES_VERSION).not.toBe(HONEST_RULES_VERSION)
    const tampered = JSON.parse(raw) as { payload: { rulesVersion: string }; checksum: string }
    tampered.payload.rulesVersion = RULES_VERSION
    expect(() => decodeSnapshot(JSON.stringify(tampered))).toThrow()
  })

  it('refuses to mix rules: an experimental economy needs the sector run it was built for, and the standard game has no exclusions', () => {
    expect(() => encodeSnapshot(createDungeonRun(3, A08), A08, 1)).toThrow()
    const sector = createSectorRun(3, gameEconomy)
    expect(() => encodeSnapshot({ ...sector, excludedArtifacts: ['tension-spool'] }, gameEconomy, 1)).toThrow()
    expect(() => encodeSnapshot(createSectorRun(3, A08), gameEconomy, 1)).toThrow()
    expect(() => encodeSnapshot(sector, A08, 1)).toThrow()
    expect(() => encodeSnapshot(sector, baselineEconomy, 1)).not.toThrow()
  })

  it('keeps each ruleset in its own slot and never touches the standard save', () => {
    const { data, storage } = memory()
    const control = createRunSaveStore(() => storage)
    expect(control.save(createSectorRun(1, gameEconomy, undefined, undefined, 'control-run'), gameEconomy).ok).toBe(true)
    const standardRaw = data.get(RUN_SAVE_KEY)!
    const standardBackup = data.get(RUN_SAVE_KEY + '.backup')!
    for (const mode of rulesModes.filter(item => item.economy)) {
      const store = createRunSaveStore(() => storage, mode.saveKey)
      expect(store.load().snapshot).toBeNull()
      expect(store.save(createSectorRun(2, mode.economy!, undefined, undefined, 'run-' + mode.id), mode.economy!).ok).toBe(true)
      expect(createRunSaveStore(() => storage, mode.saveKey).load().snapshot?.run.runId).toBe('run-' + mode.id)
    }
    expect(data.get(RUN_SAVE_KEY)).toBe(standardRaw)
    expect(data.get(RUN_SAVE_KEY + '.backup')).toBe(standardBackup)
    expect(createRunSaveStore(() => storage).load().snapshot?.run.runId).toBe('control-run')
    expect(new Set(rulesModes.map(mode => mode.saveKey)).size).toBe(rulesModes.length)
  })

  it('opens the standard game for a plain address and an experiment only when asked', () => {
    expect(resolveRulesMode('').id).toBe('control')
    expect(resolveRulesMode('?economy=U').id).toBe('control')
    expect(resolveRulesMode('?rules=nonsense').id).toBe('control')
    expect(resolveRulesMode('?rules=control').id).toBe('control')
    expect(resolveRulesMode('?rules=honest-a08').economy).toBe(A08)
    expect(resolveRulesMode('?rules=honest-a09').economy).toBe(A09)
    expect(resolveRulesMode('?rules=A09').id).toBe('honest-a09')
    expect(resolveRulesMode('?rules=honest08').id).toBe('honest-a08')
    expect(rulesModes[0]!.saveKey).toBe(RUN_SAVE_KEY)
  })

  it('carries a seed from one set of rules to the other, so the same map can be compared', () => {
    expect(rulesModeHref('honest-a09')).toBe('?rules=honest-a09')
    expect(rulesModeHref('control', 1605122906)).toBe('?rules=control&seed=1605122906')
    expect(requestedSeed('?rules=honest-a08&seed=1605122906')).toBe(1605122906)
    expect(requestedSeed('?seed=0')).toBe(0)
    for (const bad of ['', '?seed=', '?seed=-1', '?seed=1.5', '?seed=abc', '?seed=4294967296', '?seed=1e3']) expect(requestedSeed(bad)).toBeNull()
    // One seed is one map under every set of rules.
    const control = createSectorRun(1605122906, gameEconomy)
    expect(createSectorRun(1605122906, A08).map).toEqual(control.map)
    expect(createSectorRun(1605122906, A09).map).toEqual(control.map)
  })
})
