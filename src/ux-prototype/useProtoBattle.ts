import { computed, shallowRef } from 'vue'
import { endTurn, forecastEnemyAction, previewCard, resolveCardPlay, startCardPlay } from '../game/battle'
import type { PlayResult } from '../game/battle'
import { cardDefinition } from '../game/types'
import type { BattleState, CardDefinition, CardInstance, CardPreview, PendingPlay } from '../game/types'
import { buildScenario } from './scenarios'
import type { ScenarioId } from './scenarios'

export interface ProtoCardView {
  instanceId: string
  card: CardDefinition
  preview: CardPreview
  /** Why the card cannot be played right now (null = playable). */
  reason: 'mana' | 'busy' | 'finished' | null
}

/** Thin adapter over the real engine — the same contract as src/composables/useBattle.ts, plus scenario loading. */
export function useProtoBattle(initial: ScenarioId = 'normal') {
  const state = shallowRef<BattleState>(buildScenario(initial))

  function view(instance: CardInstance, preview?: CardPreview): ProtoCardView {
    const card = cardDefinition(instance.definitionId)
    const s = state.value
    return {
      instanceId: instance.instanceId, card, preview: preview ?? previewCard(s, card),
      reason: s.result ? 'finished' : s.pending ? 'busy' : s.mana < card.cost ? 'mana' : null,
    }
  }
  const hand = computed(() => state.value.hand.map(instance => view(instance)))
  const forecast = computed(() => forecastEnemyAction(state.value))
  const anyPlayable = computed(() => hand.value.some(item => !item.reason))

  function load(id: ScenarioId) { state.value = buildScenario(id) }
  function begin(instanceId: string): PendingPlay | null {
    const next = structuredClone(state.value)
    const result = startCardPlay(next, instanceId)
    if (!result.ok) return null
    state.value = next
    return result.play
  }
  function resolve(actionId: string): Extract<PlayResult, { ok: true }> | null {
    const next = structuredClone(state.value)
    const result = resolveCardPlay(next, actionId)
    if (!result.ok) return null
    state.value = next
    return result
  }
  /** Applies the enemy action; returns the forecast that was executed (taken before the state changes). */
  function finish() {
    const executed = forecastEnemyAction(state.value)
    const next = structuredClone(state.value)
    if (endTurn(next)) state.value = next
    return executed
  }
  /** Not part of the real game: puts the battle in a "won" state so result screens can be previewed. */
  function forceResult(result: 'victory' | 'defeat') {
    const next = structuredClone(state.value)
    if (result === 'victory') next.enemy.health = 0
    else next.heroes.mage.health = 0
    next.result = result
    state.value = next
  }

  return { state, hand, forecast, anyPlayable, load, begin, resolve, finish, forceResult }
}
