<script setup lang="ts">
import { ref } from 'vue'
import BattleBoard from './components/BattleBoard.vue'
import BattleHand from './components/BattleHand.vue'
import CampaignMap from './components/CampaignMap.vue'
import CardReward from './components/CardReward.vue'
import RunComplete from './components/RunComplete.vue'
import { useBattle } from './composables/useBattle'
import { useBattleControls } from './composables/useBattleControls'
import { useBattleAnimation } from './composables/useBattleAnimation'
import { cards as cardPool, encounters } from './game/types'
import type { CardDefinition, EncounterDefinition } from './game/types'

const { state, isOver, cards, pendingCard, drawCount, discardCount, beginPlay, resolvePlay, finishTurn, startBattle, addCard, restart } = useBattle()
const { animation, phase: battlePhase, impact, play, enemyTurn, cancel } = useBattleAnimation({ state, resolvePlay, finishTurn })
const phase = ref<'map' | 'battle' | 'reward' | 'complete'>('map')
const activeIndex = ref(0)
const selectedEncounter = ref<EncounterDefinition | null>(null)
const rewardOptions = ref<CardDefinition[]>([])

function playCard(instanceId: string) {
  if (animation.value.busy || isOver.value) return
  const pending = beginPlay(instanceId)
  if (pending) play(pending)
  else document.getElementById('card-' + instanceId)?.focus()
}

function onEndTurn() {
  if (!animation.value.busy && !isOver.value) enemyTurn()
}

useBattleControls({ enabled: () => phase.value === 'battle' && battlePhase.value === 'player', cards: () => cards.value, play: playCard, endTurn: onEndTurn })

function enterEncounter(index: number) {
  if (phase.value !== 'map' || index !== activeIndex.value) return
  const encounter = encounters[index]
  if (!encounter) return
  cancel()
  selectedEncounter.value = encounter
  startBattle(encounter)
  phase.value = 'battle'
}

function onBattleContinue() {
  cancel()
  if (state.value.result === 'defeat') {
    restartRun()
    return
  }
  if (activeIndex.value >= encounters.length - 1) {
    phase.value = 'complete'
    return
  }
  rewardOptions.value = cardPool.filter(card => card.reward)
  phase.value = 'reward'
}

function chooseReward(card: CardDefinition) {
  addCard(card)
  activeIndex.value += 1
  selectedEncounter.value = null
  phase.value = 'map'
}

function restartRun() {
  cancel()
  restart()
  activeIndex.value = 0
  selectedEncounter.value = null
  rewardOptions.value = []
  phase.value = 'map'
}
</script>
<template>
  <div class="app-shell">
    <div class="game-wrap">
      <CampaignMap v-if="phase === 'map'" :encounters="encounters" :active-index="activeIndex" :heroes="state.heroes" @enter="enterEncounter" />
      <CardReward v-else-if="phase === 'reward'" :options="rewardOptions" :encounter-name="selectedEncounter?.name ?? 'Победа'" @choose="chooseReward" />
      <RunComplete v-else-if="phase === 'complete'" @restart="restartRun" />
      <template v-else>
        <BattleBoard :state="state" :animation="animation" :phase="battlePhase" :continue-label="activeIndex >= encounters.length - 1 ? 'Завершить поход' : 'Выбрать награду'" @impact="impact" @end-turn="onEndTurn" @continue="onBattleContinue" />
        <BattleHand v-if="!isOver" :cards="cards" :outgoing="pendingCard" :outgoing-index="state.pending?.handIndex ?? 0" :draw-count="drawCount" :discard-count="discardCount" :exhausted-count="state.exhausted.length" :phase="battlePhase" :mana="state.mana" :max-mana="state.maxMana" @play="playCard" @end-turn="onEndTurn" />
      </template>
    </div>
  </div>
</template>
