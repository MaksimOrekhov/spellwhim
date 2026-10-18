import { describe, expect, it } from 'vitest'
import { createDungeonMap, createDungeonRun, dungeonEncounter, dungeonNode, validateDungeonMap } from './campaign'
import { defaultDungeonRoster, eliteEncounterCatalogV10, finalEncounterV10, normalEncounterCatalogV10, rosterV10 } from './encountersV10'
import { rosterFromSpec, experimentRosters } from './encounterExperiments'
import { rosterV09 } from './rosters'
import { eliteEncounterCatalog, normalEncounterCatalog } from './encountersV09'
import { gameEconomy } from './economy'
import { endTurn, forecastEnemyAction } from './battle'
import { createCampaignBattle } from './campaign'
import type { EncounterDefinition, EnemyAction, EnemyHit } from './types'

const all = [...normalEncounterCatalogV10, ...eliteEncounterCatalogV10, finalEncounterV10]
const actionsOf = (encounter: EncounterDefinition): EnemyAction[] => [...encounter.behavior.phase1, ...(encounter.behavior.phase2 ?? [])]
const hitsOf = (action: EnemyAction): EnemyHit[] => action.kind === 'attack' || action.kind === 'attack_all' ? [action] : action.kind === 'prepare' ? [action.prepared] : []

describe('Deadmines roster v1.0 (Combat Overhaul stage A)', () => {
  it('is the playable roster, while v0.9 stays available unchanged as the control', () => {
    expect(defaultDungeonRoster).toBe(rosterV10)
    expect(rosterV09.normal).toBe(normalEncounterCatalog)
    expect(rosterV09.elite).toBe(eliteEncounterCatalog)
    expect(rosterFromSpec('A')).toBe(rosterV09)
    expect(normalEncounterCatalog.map(item => item.maxHealth)).toEqual([27, 32, 29, 30, 34, 35])
    expect(eliteEncounterCatalog.map(item => item.maxHealth)).toEqual([54, 60])
  })

  it('keeps the same enemies, ids and layer pools so one seed gives one map in every roster', () => {
    expect(normalEncounterCatalogV10.map(item => item.id)).toEqual(normalEncounterCatalog.map(item => item.id))
    expect(eliteEncounterCatalogV10.map(item => item.id)).toEqual(eliteEncounterCatalog.map(item => item.id))
    for (const seed of [1, 42, 321, 2026, 99999]) {
      const shape = (roster: typeof rosterV10) => createDungeonMap(seed, gameEconomy, roster).layers.flat().map(node => [node.id, node.type, node.encounterId, node.edges.join(',')])
      for (const roster of Object.values(experimentRosters)) expect(shape(roster), `${roster.id} seed ${seed}`).toEqual(shape(rosterV09))
    }
  })

  it('is deterministic and valid for 300 seeds', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const map = createDungeonMap(seed, gameEconomy, rosterV10)
      expect(map).toEqual(createDungeonMap(seed, gameEconomy, rosterV10))
      expect(validateDungeonMap(map, rosterV10), `seed ${seed}`).toEqual([])
    }
  })

  it('is tougher than the control in health and in announced damage, enemy by enemy', () => {
    const total = (encounter: EncounterDefinition) => actionsOf(encounter).flatMap(hitsOf).reduce((sum, hit) => sum + hit.damage, 0)
    const pairs: [EncounterDefinition, EncounterDefinition][] = [
      ...normalEncounterCatalog.map((old, index): [EncounterDefinition, EncounterDefinition] => [old, normalEncounterCatalogV10[index]!]),
      ...eliteEncounterCatalog.map((old, index): [EncounterDefinition, EncounterDefinition] => [old, eliteEncounterCatalogV10[index]!]),
    ]
    for (const [old, next] of pairs) {
      expect(next.id).toBe(old.id)
      expect(next.maxHealth, old.id).toBeGreaterThan(old.maxHealth)
      expect(next.maxHealth, old.id).toBeLessThanOrEqual(Math.ceil(old.maxHealth * 1.4))
      expect(total(next), old.id).toBeGreaterThan(total(old))
    }
  })

  it('never hides or oversizes an attack: every hit is survivable from full health and strong hits are announced', () => {
    for (const encounter of all) {
      for (const action of actionsOf(encounter)) {
        for (const hit of hitsOf(action)) {
          const target = hit.kind === 'attack' ? hit.target : null
          // Warrior 25, mage 18: no single announced hit can kill a healthy hero; area hits touch the mage too.
          expect(hit.damage, `${encounter.id}: ${hit.name}`).toBeLessThanOrEqual(target === 'warrior' ? 24 : 17)
        }
        if (action.kind === 'attack' || action.kind === 'attack_all') expect(action.damage, `${encounter.id}: ${action.name} must be announced by a prepare turn`).toBeLessThanOrEqual(12)
        if (action.kind === 'prepare') expect(action.prepared.damage, `${encounter.id}: ${action.name}`).toBeGreaterThanOrEqual(7)
      }
    }
  })

  it('leaves few quiet turns: at most a third of any cycle is a pure armor turn', () => {
    for (const encounter of all) {
      for (const phase of [encounter.behavior.phase1, encounter.behavior.phase2 ?? []]) {
        if (!phase.length) continue
        const quiet = phase.filter(action => action.kind === 'defend' || action.kind === 'recover').length
        expect(quiet / phase.length, encounter.id).toBeLessThanOrEqual(1 / 3 + 1e-9)
      }
    }
  })

  it('threatens both heroes in every enemy so that the party has to choose whom to cover', () => {
    for (const encounter of all) {
      const targets = new Set(actionsOf(encounter).flatMap(hitsOf).flatMap(hit => hit.kind === 'attack' ? [hit.target] : ['warrior', 'mage']))
      expect(targets.has('warrior') && targets.has('mage'), encounter.id).toBe(true)
    }
  })

  it('resolves dungeon encounters from the chosen roster, including the finale', () => {
    const run = createDungeonRun(7)
    const final = dungeonEncounter(dungeonNode(run.map, 'final')!)
    expect(final.maxHealth).toBe(finalEncounterV10.maxHealth)
    const control = createDungeonRun(7, gameEconomy, undefined, rosterV09)
    expect(dungeonEncounter(dungeonNode(control.map, 'final')!, gameEconomy, rosterV09).maxHealth).toBe(110)
  })

  it('executes exactly the health loss that was forecast, turn after turn', () => {
    for (const encounter of [...normalEncounterCatalogV10, ...eliteEncounterCatalogV10]) {
      const battle = createCampaignBattle({ encounter, seed: 5, battleId: 'v10/' + encounter.id })
      for (let turn = 0; turn < 12 && !battle.result; turn += 1) {
        const forecast = forecastEnemyAction(battle)
        const before = { warrior: battle.heroes.warrior.health, mage: battle.heroes.mage.health }
        endTurn(battle)
        for (const target of forecast.targets) expect(before[target.target] - battle.heroes[target.target].health, `${encounter.id} turn ${turn}`).toBe(target.healthLoss)
      }
    }
  })
})
