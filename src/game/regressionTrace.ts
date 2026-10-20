import { chooseCard } from './balance'
import type { ClassicStrategy } from './balance'
import { createTurnPlanner } from './balancePlanner'
import { createBattle, endTurn, forecastEnemyAction, hasStatus, playCard, previewCard } from './battle'
import { eliteEncounterCatalog, normalEncounterCatalog } from './encountersV09'
import { reinforcedEncounters } from './encountersV07'
import { artifactDefinitions } from './artifacts'
import { cardDefinition, encounters, startingDeck } from './types'
import type { ArtifactId, ArtifactInstance, BattleState, EncounterDefinition, HeroId } from './types'

/**
 * Deterministic battle traces for regression checks of engine refactors. Only the stable, player-visible surface is
 * recorded (previews, forecasts, health, armor, mana, hand order, statuses, artifact notices), so a refactor that keeps
 * the rules keeps every trace identical even when internal state objects change shape.
 */
export type TraceStrategy = ClassicStrategy | 'planner' | 'random'

export interface BattleTraceSpec {
  encounter: EncounterDefinition
  seed: number
  strategy: TraceStrategy
  /** One artifact, equipped on the hero in this party slot. */
  artifact?: { id: ArtifactId; slot: 'first' | 'second' }
}

export interface BattleTrace {
  key: string
  result: string
  turns: number
  warriorHealth: number
  mageHealth: number
  manaSpent: number
  events: unknown[]
  digest: string
}

function fnv(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0
  return hash.toString(16).padStart(8, '0')
}

function snapshot(state: BattleState) {
  return {
    mana: state.mana, turn: state.turn, result: state.result,
    hp: [state.heroes.warrior.health, state.heroes.mage.health],
    armor: [state.heroes.warrior.armor, state.heroes.mage.armor],
    enemy: { hp: state.enemy.health, armor: state.enemy.armor, vulnerable: hasStatus(state, 'vulnerability'), phase: state.enemy.phase, next: state.enemy.nextAction.name, focus: state.enemy.focus },
    hand: state.hand.map(card => card.instanceId),
    draw: state.drawPile.length, discard: state.discardPile.length, exhausted: state.exhausted.length, blocked: state.blockedDraws,
    notices: [...state.artifactNotices],
    artifacts: state.artifacts.map(item => [item.usedThisBattle, item.lastTriggeredTurn, item.armedThisTurn]),
  }
}

function stablePreview(state: BattleState, definitionId: BattleState['hand'][number]['definitionId']) {
  const preview = previewCard(state, cardDefinition(definitionId), 'historical')
  const { damage, armorDamage, healthDamage, bonusDamage, vulnerabilityBonus, armorBonus, artifactDamage, artifactArmor, armor, draw, bonuses, artifactBonuses, appliedStatuses } = preview
  return { damage, armorDamage, healthDamage, bonusDamage, vulnerabilityBonus, armorBonus, artifactDamage, artifactArmor, armor, draw, bonuses, artifactBonuses, appliedStatuses }
}

function stableForecast(state: BattleState) {
  const forecast = forecastEnemyAction(state)
  const pick = (hit: (typeof forecast.targets)[number]) => [hit.target, hit.attack, hit.absorbed, hit.healthLoss, hit.lethal, hit.artifactReduction]
  return { action: forecast.action.name, kind: forecast.action.kind, phase: forecast.phase, targets: forecast.targets.map(pick), future: forecast.futureTargets.map(pick), threatened: forecast.threatened, armorGain: forecast.armorGain }
}

/** Small seeded generator so the `random` player is reproducible and independent of the engine RNG. */
function randomPlayer(seed: number) {
  let value = seed >>> 0 || 1
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 4294967296
  }
}

export function traceBattle(spec: BattleTraceSpec, maxTurns = 40): BattleTrace {
  const battleId = `trace/${spec.encounter.id}/${spec.seed}`
  const artifacts: ArtifactInstance[] = spec.artifact
    ? [{ instanceId: battleId + '/artifact', definitionId: spec.artifact.id, ownerInstanceId: battleId + '/hero/' + spec.artifact.slot }]
    : []
  const state = createBattle(spec.encounter, undefined, { deck: startingDeck, seed: spec.seed, battleId, artifacts })
  const planner = spec.strategy === 'planner' ? createTurnPlanner() : undefined
  const random = randomPlayer(spec.seed * 7919 + spec.encounter.maxHealth)
  const events: unknown[] = [{ start: snapshot(state) }]
  let manaSpent = 0
  for (let guard = 0; guard < 600 && !state.result && state.turn <= maxTurns; guard += 1) {
    let chosenId: string | undefined
    if (planner) chosenId = planner.next(state)
    else if (spec.strategy === 'random') {
      const playable = state.hand.filter(card => cardDefinition(card.definitionId).cost <= state.mana)
      // About one turn in six ends early so the trace also covers held cards and unspent mana.
      chosenId = playable.length && random() > 0.16 ? playable[Math.floor(random() * playable.length)]!.instanceId : undefined
    } else chosenId = chooseCard(state, spec.strategy as ClassicStrategy, 'omniscient')?.instanceId
    if (chosenId) {
      const instance = state.hand.find(card => card.instanceId === chosenId)!
      const preview = stablePreview(state, instance.definitionId)
      const result = playCard(state, chosenId)
      if (!result.ok) { events.push({ rejected: result.reason }); break }
      manaSpent += cardDefinition(instance.definitionId).cost
      events.push({ play: instance.instanceId, card: instance.definitionId, preview, drawn: result.drawn, dealt: result.damageDealt, after: snapshot(state) })
    } else {
      const forecast = stableForecast(state)
      endTurn(state)
      events.push({ end: forecast, after: snapshot(state) })
    }
  }
  const key = [spec.encounter.id, spec.seed, spec.strategy, spec.artifact ? spec.artifact.id + '@' + spec.artifact.slot : 'none'].join('/')
  return {
    key, result: String(state.result), turns: state.turn, warriorHealth: state.heroes.warrior.health, mageHealth: state.heroes.mage.health,
    manaSpent, events, digest: fnv(JSON.stringify(events)),
  }
}

/** The fixed battle set of the status-foundation baseline (identical to the one recorded before the refactor). */
export function regressionSpecs(): BattleTraceSpec[] {
  const list: BattleTraceSpec[] = []
  const pool = [...encounters, ...reinforcedEncounters, ...normalEncounterCatalog, ...eliteEncounterCatalog]
  for (const encounter of pool) {
    for (const seed of [3, 11, 29]) {
      for (const strategy of ['aggressive', 'defensive', 'balanced', 'random'] as const) list.push({ encounter, seed, strategy })
    }
    list.push({ encounter, seed: 5, strategy: 'planner' })
  }
  const artifactEncounters = [encounters[1]!, normalEncounterCatalog[1]!, normalEncounterCatalog[4]!, eliteEncounterCatalog[1]!]
  for (const definition of artifactDefinitions) {
    for (const slot of ['first', 'second'] as const) {
      for (const encounter of artifactEncounters) {
        for (const seed of [2, 17]) {
          for (const strategy of ['balanced', 'defensive', 'random'] as const) list.push({ encounter, seed, strategy, artifact: { id: definition.id, slot } })
        }
      }
    }
    list.push({ encounter: eliteEncounterCatalog[0]!, seed: 8, strategy: 'planner', artifact: { id: definition.id, slot: 'first' } })
  }
  return list
}

export function compactTrace({ key, result, turns, warriorHealth, mageHealth, manaSpent, digest }: BattleTrace) {
  return { key, result, turns, warriorHealth, mageHealth, manaSpent, digest }
}

export type { HeroId }
