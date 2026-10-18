<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import BattleBoard from './components/BattleBoard.vue'
import BattleHand from './components/BattleHand.vue'
import CampaignMap from './components/CampaignMap.vue'
import CardReward from './components/CardReward.vue'
import RestSite from './components/RestSite.vue'
import RunComplete from './components/RunComplete.vue'
import { useBattle } from './composables/useBattle'
import { useBattleControls } from './composables/useBattleControls'
import { useBattleAnimation } from './composables/useBattleAnimation'
import { availableDungeonNodes, claimDungeonReward, createDungeonRun, deriveDungeonSeed, dungeonEncounter, dungeonNode, dungeonRewardOptions, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest } from './game/campaign'
import { drawForTurn, economyFromSearch, gameEconomy, manaForTurn } from './game/economy'
import type { CardDefinition, HeroId } from './game/types'

// Model B is the standard economy in development, production and Tauri. A and U remain dev-only comparisons.
const economy = import.meta.env.DEV
  ? economyFromSearch(window.location.search || (import.meta.env.VITE_SPELLWHIM_ECONOMY ? '?economy=' + import.meta.env.VITE_SPELLWHIM_ECONOMY : ''))
  : gameEconomy
const experimental = economy !== gameEconomy
const initialSeed = Date.now() >>> 0
const run = shallowRef(createDungeonRun(initialSeed, economy))
const { state, isOver, cards, pendingCard, drawCount, discardCount, beginPlay, resolvePlay, finishTurn, startBattle, addCard, restart } = useBattle({ economy, seed: initialSeed })
const { animation, phase: battlePhase, impact, play, enemyTurn, cancel } = useBattleAnimation({ state, resolvePlay, finishTurn })
const phase = ref<'map' | 'battle' | 'reward' | 'rest' | 'complete'>('map')
const selectedNodeId = ref<string | null>(null)
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

function enterNode(nodeId: string) {
  if (phase.value !== 'map' || !availableDungeonNodes(run.value).some(node => node.id === nodeId)) return
  const nextRun = enterDungeonNode(run.value, nodeId)
  run.value = nextRun
  selectedNodeId.value = nodeId
  const node = dungeonNode(nextRun.map, nodeId)!
  if (node.type === 'rest') {
    phase.value = 'rest'
    return
  }
  cancel()
  const encounter = dungeonEncounter(node, economy)
  const battleSeed = deriveDungeonSeed(nextRun.seed, `battle:${node.id}`)
  startBattle(encounter, nextRun.heroes, battleSeed, node.id)
  phase.value = 'battle'
}

function onBattleContinue() {
  cancel()
  const nextRun = resolveDungeonBattle(run.value, state.value)
  run.value = nextRun
  if (nextRun.status !== 'active') { phase.value = 'complete'; return }
  rewardOptions.value = dungeonRewardOptions(nextRun)
  phase.value = 'reward'
}

function chooseReward(card: CardDefinition) {
  run.value = claimDungeonReward(run.value, card)
  addCard(card)
  selectedNodeId.value = null
  phase.value = 'map'
}

function chooseRestTarget(heroId: HeroId | null) {
  run.value = resolveDungeonRest(run.value, heroId)
  selectedNodeId.value = null
  phase.value = 'map'
}

function restartRun() {
  cancel()
  const nextSeed = ((Date.now() >>> 0) === run.value.seed ? run.value.seed + 1 : Date.now()) >>> 0
  run.value = createDungeonRun(nextSeed, economy)
  restart(nextSeed)
  selectedNodeId.value = null
  rewardOptions.value = []
  phase.value = 'map'
}
</script>
<template>
  <div class="app-shell">
    <div class="game-wrap">
      <p v-if="experimental" class="economy-badge" :title="economy.label">Режим сравнения · модель {{ economy.manaCurve }} · {{ economy.label }}</p>
      <CampaignMap v-if="phase === 'map'" :map="run.map" :run="run" @enter="enterNode" @restart="restartRun" />
      <CardReward v-else-if="phase === 'reward'" :options="rewardOptions" :encounter-name="state.enemy.name" :elite="run.pendingReward?.elite ?? false" @choose="chooseReward" />
      <RestSite v-else-if="phase === 'rest'" :heroes="run.heroes" :heal-amount="selectedNodeId ? dungeonNode(run.map, selectedNodeId)?.healAmount ?? 6 : 6" @choose="chooseRestTarget" />
      <RunComplete v-else-if="phase === 'complete'" :result="run.status === 'defeat' ? 'defeat' : 'victory'" @restart="restartRun" />
      <template v-else>
        <BattleBoard :state="state" :animation="animation" :phase="battlePhase" :continue-label="dungeonNode(run.map, selectedNodeId ?? '')?.type === 'final' ? 'Завершить поход' : 'Выбрать награду'" @impact="impact" @end-turn="onEndTurn" @continue="onBattleContinue" />
        <BattleHand v-if="!isOver" :cards="cards" :outgoing="pendingCard" :outgoing-index="state.pending?.handIndex ?? 0" :draw-count="drawCount" :discard-count="discardCount" :exhausted-count="state.exhausted.length" :phase="battlePhase" :mana="state.mana" :max-mana="state.maxMana" :next-mana="manaForTurn(state.economy, state.turn + 1)" :next-draw="drawForTurn(state.economy, state.turn + 1)" :draw-boost-from="state.economy.drawSchedule.boost?.fromTurn" :draw-boost-amount="state.economy.drawSchedule.boost?.amount" @play="playCard" @end-turn="onEndTurn" />
      </template>
    </div>
  </div>
</template>
<style scoped>
.economy-badge{position:absolute;z-index:40;top:64px;left:24px;max-width:230px;margin:0;padding:5px 12px;border-radius:12px;border:1px solid #f0c36a;background:#3b2a52e6;color:#ffe8b0;font-size:12px;line-height:1.35;pointer-events:none;letter-spacing:.02em}
</style>
