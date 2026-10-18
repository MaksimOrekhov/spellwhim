<script setup lang="ts">
// Dev-only lab (card-preview.html): the real board, hand and reward screen driven by the real rules engine
// in reproducible states. Query: ?view=hand|reward  &hand=8|10  &bonus=1  &mana=N  &elite=1  &ids=a,b,c  &rewardIds=a,b,c
// &scene=<id of battleSceneIds> (battle scenes of src/ui/battleScenes.ts; replaces &enemy)  &intent=caption (banner variant with the action name)
import { computed, shallowRef } from 'vue'
import BattleBoard from './BattleBoard.vue'
import BattleHand from './BattleHand.vue'
import CardReward from './CardReward.vue'
import { createBattle, previewCard, resolveCardPlay, startCardPlay, endTurn } from '../game/battle'
import { applyStatus } from '../game/statuses'
import { useBattleAnimation } from '../composables/useBattleAnimation'
import { useBattleControls } from '../composables/useBattleControls'
import { cardDefinition, cards, encounters } from '../game/types'
import { battleScene } from '../ui/battleScenes'
import { defaultDungeonRoster } from '../game/encountersV10'
import type { BattleSceneId } from '../ui/battleScenes'
import type { BattleState, CardDefinition, CardId } from '../game/types'
import type { HandCardView } from '../composables/useBattle'

const query = new URLSearchParams(window.location.search)
const view = query.get('view') ?? 'hand'
const handSize = Number(query.get('hand') ?? 8)
const mixed: CardId[] = ['sword-strike', 'frostbolt', 'bastion', 'parry', 'thunderbolt', 'shield-bash', 'ice-ward', 'quick-cut', 'interpose', 'arcane-insight', 'fireball', 'guard']
const ids = (query.get('ids')?.split(',') as CardId[] | undefined) ?? mixed.slice(0, handSize)

function labState(): BattleState {
  const scene = query.get('scene') as BattleSceneId | null
  const encounterId = query.get('enemy') ?? 'root-sentinel'
  const currentEncounters = [...defaultDungeonRoster.normal, ...defaultDungeonRoster.elite, ...(defaultDungeonRoster.final ? [defaultDungeonRoster.final] : [])]
  const encounter = [...currentEncounters, ...encounters].find(item => item.id === encounterId)!
  const state = scene ? battleScene(scene) : createBattle(encounter, undefined, { seed: 7 })
  if (query.get('phase') === '2' && state.enemy.behavior.phase2) {
    state.enemy.phase = 2
    state.enemy.nextActionPhase = 2
    state.enemy.behaviorIndex = 0
    state.enemy.nextAction = state.enemy.behavior.phase2[0]!
  }
  state.hand = ids.map((id, index) => ({ instanceId: `lab/${index + 1}`, definitionId: id }))
  state.drawPile = state.drawPile.slice(0, 8)
  if (query.get('mana')) { state.mana = Number(query.get('mana')); state.maxMana = Math.max(state.maxMana, state.mana) }
  if (query.get('bonus') === '1') { applyStatus(state, 'enemy', 'vulnerability'); state.heroes.mage.armor = 3 }
  return state
}

const state = shallowRef(labState())
function resolvePlay(actionId: string) {
  const next = structuredClone(state.value)
  const result = resolveCardPlay(next, actionId)
  if (result.ok) state.value = next
  return result
}
function finishTurn() { const next = structuredClone(state.value); if (endTurn(next)) state.value = next }
const { animation, phase, impact, play, enemyTurn } = useBattleAnimation({ state, resolvePlay, finishTurn })

const views = computed<HandCardView[]>(() => state.value.hand.map(instance => {
  const card = cardDefinition(instance.definitionId)
  return { instanceId: instance.instanceId, card, preview: previewCard(state.value, card), playable: !state.value.pending && state.value.mana >= card.cost }
}))
const pendingView = computed<HandCardView | null>(() => {
  const pending = state.value.pending
  return pending ? { instanceId: pending.card.instanceId, card: cardDefinition(pending.card.definitionId), preview: pending.preview, playable: false } : null
})
function playCard(instanceId: string) {
  if (animation.value.busy) return
  const next = structuredClone(state.value)
  const started = startCardPlay(next, instanceId)
  if (!started.ok) return
  state.value = next
  play(started.play)
}
function onEndTurn() { if (!animation.value.busy) enemyTurn() }
useBattleControls({ enabled: () => view === 'hand' && phase.value === 'player', cards: () => views.value, play: playCard, endTurn: onEndTurn })

const rewardIds = query.get('rewardIds')?.split(',') as CardId[] | undefined
const rewardOptions = computed<CardDefinition[]>(() => (rewardIds ?? (query.get('elite') === '1' ? ['bastion', 'frostbolt', 'thunderbolt', 'interpose', 'quick-cut'] : ['parry', 'frostbolt', 'bastion'])).map(id => cards.find(card => card.id === id)!).filter(Boolean))
const chosen = shallowRef('')
</script>

<template>
  <div class="app-shell">
    <div class="game-wrap">
      <template v-if="view === 'hand'">
        <BattleBoard :state="state" :animation="animation" :phase="phase" :captioned="query.get('intent') === 'caption'" @impact="impact" @end-turn="onEndTurn" />
        <BattleHand :cards="views" :outgoing="pendingView" :outgoing-index="state.pending?.handIndex ?? 0" :draw-count="state.drawPile.length" :discard-count="state.discardPile.length" :exhausted-count="state.exhausted.length" :phase="phase" :mana="state.mana" :max-mana="state.maxMana" @play="playCard" @end-turn="onEndTurn" />
      </template>
      <CardReward v-else :options="rewardOptions" :elite="query.get('elite') === '1'" encounter-name="Шахтный забой" @choose="chosen = $event.id" />
    </div>
  </div>
</template>
