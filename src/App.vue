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
import { advanceCampaign, campaignEncounter, campaignEncounters, campaignRewardOptions } from './game/campaign'
import { drawForTurn, economyFromSearch, gameEconomy, manaForTurn } from './game/economy'
import type { CardDefinition, EncounterDefinition } from './game/types'

// Model B is the standard economy in development, production and Tauri. A and U remain dev-only comparisons.
const economy = import.meta.env.DEV
  ? economyFromSearch(window.location.search || (import.meta.env.VITE_SPELLWHIM_ECONOMY ? '?economy=' + import.meta.env.VITE_SPELLWHIM_ECONOMY : ''))
  : gameEconomy
const experimental = economy !== gameEconomy
const encounters = campaignEncounters(economy)
const { state, isOver, cards, pendingCard, drawCount, discardCount, beginPlay, resolvePlay, finishTurn, startBattle, addCard, restart } = useBattle({ economy })
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
  const encounter = campaignEncounter(index, economy)
  if (!encounter) return
  cancel()
  selectedEncounter.value = encounter
  startBattle(encounter)
  phase.value = 'battle'
}

function onBattleContinue() {
  cancel()
  const advance = advanceCampaign(state.value, activeIndex.value)
  if (advance.kind === 'defeat') {
    restartRun()
    return
  }
  if (advance.kind === 'complete') {
    phase.value = 'complete'
    return
  }
  rewardOptions.value = campaignRewardOptions(state.value)
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
      <p v-if="experimental" class="economy-badge" :title="economy.label">Режим сравнения · модель {{ economy.manaCurve }} · {{ economy.label }}</p>
      <CampaignMap v-if="phase === 'map'" :encounters="encounters" :active-index="activeIndex" :heroes="state.heroes" @enter="enterEncounter" />
      <CardReward v-else-if="phase === 'reward'" :options="rewardOptions" :encounter-name="selectedEncounter?.name ?? 'Победа'" @choose="chooseReward" />
      <RunComplete v-else-if="phase === 'complete'" @restart="restartRun" />
      <template v-else>
        <BattleBoard :state="state" :animation="animation" :phase="battlePhase" :continue-label="activeIndex >= encounters.length - 1 ? 'Завершить поход' : 'Выбрать награду'" @impact="impact" @end-turn="onEndTurn" @continue="onBattleContinue" />
        <BattleHand v-if="!isOver" :cards="cards" :outgoing="pendingCard" :outgoing-index="state.pending?.handIndex ?? 0" :draw-count="drawCount" :discard-count="discardCount" :exhausted-count="state.exhausted.length" :phase="battlePhase" :mana="state.mana" :max-mana="state.maxMana" :next-mana="manaForTurn(state.economy, state.turn + 1)" :next-draw="drawForTurn(state.economy, state.turn + 1)" :draw-boost-from="state.economy.drawSchedule.boost?.fromTurn" :draw-boost-amount="state.economy.drawSchedule.boost?.amount" @play="playCard" @end-turn="onEndTurn" />
      </template>
    </div>
  </div>
</template>
<style scoped>
.economy-badge{position:absolute;z-index:40;top:64px;left:24px;max-width:230px;margin:0;padding:5px 12px;border-radius:12px;border:1px solid #f0c36a;background:#3b2a52e6;color:#ffe8b0;font-size:12px;line-height:1.35;pointer-events:none;letter-spacing:.02em}
</style>
