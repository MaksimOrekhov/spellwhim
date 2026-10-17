<script setup lang="ts">
import { ref } from 'vue'
import BattleBoard from './components/BattleBoard.vue'
import CampaignMap from './components/CampaignMap.vue'
import CardReward from './components/CardReward.vue'
import HandCard from './components/HandCard.vue'
import RunComplete from './components/RunComplete.vue'
import { useBattle } from './composables/useBattle'
import { cards as cardPool, encounters } from './game/types'
import type { CardDefinition, EncounterDefinition, HeroId } from './game/types'

const { state, isOver, cards, ownedCards, playedCards, drawCount, discardCount, beginPlay, resolvePlay, finishTurn, startBattle, addCard, restart } = useBattle()
const phase = ref<'map' | 'battle' | 'reward' | 'complete'>('map')
const activeIndex = ref(0)
const selectedEncounter = ref<EncounterDefinition | null>(null)
const rewardOptions = ref<CardDefinition[]>([])
const pulse = ref(0)
const effect = ref<'attack' | 'spell' | 'guard' | 'hit' | ''>('')
const busy = ref(false)
const playingCardId = ref<CardDefinition['id'] | null>(null)
const fxTarget = ref<'enemy' | HeroId>('enemy')
const fxDamage = ref(0)
const fxPartnerArmor = ref(0)
const fxSynergy = ref(false)
const impactTarget = ref<'enemy' | HeroId | null>(null)
let impactFallback: ReturnType<typeof setTimeout> | undefined
let recoveryTimer: ReturnType<typeof setTimeout> | undefined
let pendingImpact: (() => void) | null = null

function clearActionTimers() {
  window.clearTimeout(impactFallback)
  window.clearTimeout(recoveryTimer)
}

function finishImpact() {
  const resolve = pendingImpact
  pendingImpact = null
  window.clearTimeout(impactFallback)
  if (effect.value === 'attack' || effect.value === 'spell' || effect.value === 'hit') impactTarget.value = fxTarget.value
  resolve?.()
}

function startAction(impactFallbackMs: number, recoveryMs: number, resolve: () => void) {
  clearActionTimers()
  impactTarget.value = null
  pendingImpact = resolve
  busy.value = true
  impactFallback = window.setTimeout(finishImpact, impactFallbackMs)
  recoveryTimer = window.setTimeout(() => {
    finishImpact()
    busy.value = false
    effect.value = ''
    playingCardId.value = null
  }, recoveryMs)
}

function playCard(card: CardDefinition) {
  if (busy.value || isOver.value || !beginPlay(card)) return
  playingCardId.value = card.id
  effect.value = card.kind === 'spell' ? 'spell' : card.kind === 'defense' ? 'guard' : 'attack'
  fxTarget.value = card.kind === 'defense' ? state.value.enemy.intent : 'enemy'
  fxDamage.value = (card.damage ?? card.armor ?? 0) + (card.kind === 'attack' && state.value.enemy.marked ? 3 : 0)
  fxPartnerArmor.value = card.partnerArmor ?? 0
  fxSynergy.value = card.kind === 'attack' && state.value.enemy.marked
  pulse.value += 1

  const impactDelay = card.kind === 'spell' ? 820 : 560
  const recovery = card.kind === 'spell' ? 1300 : card.kind === 'defense' ? 1120 : 880
  startAction(impactDelay, recovery, () => resolvePlay(card))
}

function onEndTurn() {
  if (busy.value || isOver.value) return
  const target = state.value.enemy.intent
  const hero = state.value.heroes[target]
  fxTarget.value = target
  fxDamage.value = Math.min(hero.health, Math.max(0, state.value.enemy.attack - Math.min(hero.armor, state.value.enemy.attack)))
  effect.value = 'hit'
  pulse.value += 1
  startAction(560, 880, finishTurn)
}

function onCardAnimationEnd(cardId: CardDefinition['id'], event: AnimationEvent) {
  if (event.animationName !== 'card-launch' && event.animationName !== 'card-guard') return
  if (playingCardId.value === cardId) playingCardId.value = null
}

function onRestart() {
  clearActionTimers()
  pendingImpact = null
  busy.value = false
  effect.value = ''
  playingCardId.value = null
  fxTarget.value = 'enemy'
  fxDamage.value = 0
  fxPartnerArmor.value = 0
  fxSynergy.value = false
  impactTarget.value = null
  restart()
}

function enterEncounter(index: number) {
  if (phase.value !== 'map' || index !== activeIndex.value) return
  const encounter = encounters[index]
  if (!encounter) return
  selectedEncounter.value = encounter
  startBattle(encounter)
  phase.value = 'battle'
}

function onBattleContinue() {
  if (state.value.result === 'defeat') {
    restartRun()
    return
  }
  if (activeIndex.value >= encounters.length - 1) {
    phase.value = 'complete'
    return
  }
  rewardOptions.value = cardPool.filter(card => !ownedCards.value.some(owned => owned.id === card.id))
  phase.value = 'reward'
}

function chooseReward(card: CardDefinition) {
  addCard(card)
  activeIndex.value += 1
  selectedEncounter.value = null
  phase.value = 'map'
}

function restartRun() {
  onRestart()
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
        <BattleBoard :state="state" :pulse="pulse" :effect="effect" :busy="busy" :fx-target="fxTarget" :fx-damage="fxDamage" :fx-partner-armor="fxPartnerArmor" :fx-synergy="fxSynergy" :impact-target="impactTarget" @impact="finishImpact" @end-turn="onEndTurn" @continue="onBattleContinue" />
        <section v-if="!isOver" class="hand-row" :class="{ 'hand-row--wide': cards.length > 3 }" aria-label="Карты в руке">
          <div class="hand-top"><i></i><span>РУКА {{ cards.length }} / 3</span><small>КОЛОДА {{ drawCount }} · СБРОС {{ discardCount }}</small><i></i></div>
          <HandCard v-for="(card, index) in cards" :key="card.id" :card="card" :index="index" :playable="state.mana >= card.cost && !isOver && !playedCards.has(card.id)" :played="playedCards.has(card.id)" :playing="playingCardId === card.id" :busy="busy" @play="playCard" @animation-finished="onCardAnimationEnd(card.id, $event)" />
        </section>
      </template>
    </div>
  </div>
</template>
