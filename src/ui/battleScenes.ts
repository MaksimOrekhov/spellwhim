import { createBattle, endTurn } from '../game/battle'
import { applyStatus } from '../game/statuses'
import { defaultDungeonRoster } from '../game/encountersV10'
import { gameEconomy } from '../game/economy'
import type { ArtifactId, BattleState, EncounterDefinition, EnemyAction, HeroId } from '../game/types'

/**
 * Reproducible battle-scene states for the dev lab (card-preview.html) and for screenshots: each one is built by the real
 * rules engine and then nudged through plain state fields, never through UI-only data, so what the lab draws is what a
 * run could show. The scene ids are the cases the threat display has to get right.
 */
export type BattleSceneId = 'normal' | 'warrior' | 'both' | 'lethal' | 'prepared' | 'revealed' | 'absorbed' | 'phase2' | 'artifacts' | 'bleeding' | 'vulnerable' | 'everything'

export const battleSceneIds: readonly BattleSceneId[] = ['normal', 'warrior', 'both', 'lethal', 'prepared', 'revealed', 'absorbed', 'phase2', 'artifacts', 'bleeding', 'vulnerable', 'everything']

function encounter(id: string): EncounterDefinition {
  const all = [...defaultDungeonRoster.normal, ...defaultDungeonRoster.elite, ...(defaultDungeonRoster.final ? [defaultDungeonRoster.final] : [])]
  const found = all.find(item => item.id === id)
  if (!found) throw new Error('Unknown scene encounter ' + id)
  return found
}

function equip(state: BattleState, id: ArtifactId, hero: HeroId): void {
  state.artifacts.push({ instanceId: `scene/${id}`, definitionId: id, ownerInstanceId: state.heroes[hero].instanceId, usedThisBattle: false, lastTriggeredTurn: null, armedThisTurn: false })
}

/** Moves the enemy to the n-th action of its current cycle, as if the fight had already reached it. */
function setIntent(state: BattleState, action: EnemyAction, phase: 1 | 2 = 1): void {
  state.enemy.nextAction = action
  state.enemy.nextActionPhase = phase
  state.enemy.focus = action.kind === 'attack' ? action.target : action.kind === 'attack_all' ? action.primaryTarget : action.kind === 'prepare' && action.prepared.kind === 'attack' ? action.prepared.target : state.enemy.focus
}

export function battleScene(id: BattleSceneId, seed = 7): BattleState {
  const base = (encounterId: string) => createBattle(encounter(encounterId), undefined, { seed, economy: gameEconomy })
  switch (id) {
    case 'both': {
      // The deckhand opens with a hit on both heroes.
      const state = base('defias-deckhand')
      state.heroes.warrior.health = 19
      return state
    }
    case 'lethal': {
      // A wounded Jaina against the lookout's announced crossbow shot: the strike would kill her.
      const state = base('defias-lookout')
      const action = state.enemy.nextAction
      if (action.kind === 'prepare') setIntent(state, action.prepared)
      state.heroes.mage.health = 9
      state.heroes.warrior.health = 21
      return state
    }
    case 'warrior': {
      // A plain hit on Varian (the cutpurse's opening stays as written; only its announced target is moved).
      const state = base('defias-cutpurse')
      const action = state.enemy.nextAction
      if (action.kind === 'attack') setIntent(state, { ...action, target: 'warrior' })
      state.heroes.warrior.health = 25
      return state
    }
    case 'revealed': {
      // The lookout's aim, one real turn later: the announced action is now the heavy shot itself, with its exact numbers.
      const state = base('defias-lookout')
      state.heroes.warrior.health = 22
      endTurn(state)
      return state
    }
    case 'vulnerable': {
      const state = base('defias-cutpurse')
      state.heroes.warrior.health = 25
      state.enemy.health = 22
      applyStatus(state, 'enemy', 'vulnerability')
      return state
    }
    case 'everything': {
      // Vulnerability, Bleeding and two artifacts at once on an armored enemy with a blow announced at the wounded mage.
      const state = base('mine-overseer')
      equip(state, 'reliable-wedge', 'mage')
      equip(state, 'tension-spool', 'warrior')
      applyStatus(state, 'enemy', 'vulnerability')
      applyStatus(state, 'enemy', 'bleeding', 3)
      state.heroes.mage.armor = 5
      state.heroes.warrior.armor = 4
      state.heroes.warrior.health = 16
      state.enemy.armor = 6
      state.enemy.health = 33
      const action = state.enemy.nextAction
      if (action.kind === 'prepare') setIntent(state, action.prepared)
      return state
    }
    case 'prepared': {
      // The lookout aims: no damage now, a heavy shot on Jaina next turn.
      const state = base('defias-lookout')
      state.heroes.warrior.health = 22
      return state
    }
    case 'absorbed': {
      // The overseer's heavy swing against a warrior who has covered himself with more armor than the blow carries.
      const state = base('mine-overseer')
      const action = state.enemy.nextAction
      if (action.kind === 'prepare') setIntent(state, action.prepared)
      state.heroes.warrior.armor = 16
      state.heroes.mage.health = 14
      return state
    }
    case 'phase2': {
      const state = base('goblin-foundry-chief')
      state.enemy.health = 36
      state.enemy.phase = 2
      state.enemy.behaviorIndex = 1
      const opening = state.enemy.behavior.phase2![0]!
      setIntent(state, opening, 2)
      state.heroes.warrior.health = 17
      state.heroes.mage.health = 12
      return state
    }
    case 'artifacts': {
      // Two artifacts, Vulnerability on the enemy, armor on both heroes and enemy armor: the busiest honest board.
      const state = base('mine-overseer')
      equip(state, 'reliable-wedge', 'mage')
      equip(state, 'tension-spool', 'warrior')
      applyStatus(state, 'enemy', 'vulnerability')
      state.heroes.mage.armor = 5
      state.heroes.warrior.armor = 4
      state.heroes.warrior.health = 16
      state.enemy.armor = 6
      state.enemy.health = 33
      const action = state.enemy.nextAction
      if (action.kind === 'prepare') setIntent(state, action.prepared)
      return state
    }
    case 'bleeding': {
      // Bleeding 3 and Vulnerability on a wounded, armored enemy: the bar shows the 3 health that the tick will take at the turn's end.
      const state = base('mine-overseer')
      state.enemy.health = 30
      state.enemy.armor = 4
      applyStatus(state, 'enemy', 'bleeding', 3)
      applyStatus(state, 'enemy', 'vulnerability')
      return state
    }
    case 'normal':
    default: {
      const state = base('defias-cutpurse')
      state.heroes.warrior.health = 25
      return state
    }
  }
}
