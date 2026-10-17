<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CardDefinition } from '../game/types'
import swordStrikeArt from '../assets/art/sword-strike.jpg'
import fireballArt from '../assets/art/fireball.jpg'
import guardArt from '../assets/art/guard.jpg'
const props = defineProps<{ card: CardDefinition; playable: boolean; played: boolean; playing: boolean; index: number; busy: boolean }>()
const emit = defineEmits<{ play: [card: CardDefinition]; animationFinished: [event: AnimationEvent] }>()
const cardArt = { 'sword-strike': swordStrikeArt, fireball: fireballArt, guard: guardArt, 'quick-cut': swordStrikeArt, thunderbolt: fireballArt, bastion: guardArt }
const dragging = ref(false)
const suppressClick = ref(false)
const offset = ref({ x: 0, y: 0 })
const start = ref({ x: 0, y: 0 })
const cardStyle = computed(() => dragging.value ? { transform: `translate(${offset.value.x}px, ${offset.value.y}px) rotate(0deg) scale(1.08)` } : undefined)
function pointerDown(event: PointerEvent) {
  if (!props.playable || props.busy) return
  start.value = { x: event.clientX, y: event.clientY }
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  if (!dragging.value) return
  offset.value = { x: event.clientX - start.value.x, y: event.clientY - start.value.y }
}
function pointerUp(event: PointerEvent) {
  if (!dragging.value) return
  const shouldPlay = start.value.y - event.clientY > 45
  dragging.value = false
  offset.value = { x: 0, y: 0 }
  if (shouldPlay) {
    suppressClick.value = true
    emit('play', props.card)
    window.setTimeout(() => { suppressClick.value = false }, 0)
  }
}
</script>
<template>
  <button v-show="!played || playing" class="spell-card" :class="[`spell-card--${card.className}`, `spell-card--id-${card.id}`, { 'is-unplayable': !playable && !played, 'is-played': played, 'is-playing': playing, 'is-dragging': dragging, 'spell-card--left': index === 0, 'spell-card--right': index === 2 }]" :style="cardStyle" :disabled="!playable || busy || played" @animationend="emit('animationFinished', $event)" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @click="!suppressClick && playable && !busy && emit('play', card)">
    <span class="card-cost">{{ card.cost }}</span>
    <span v-if="played" class="card-played-label">СЫГРАНА</span>
    <span class="card-art"><img class="card-illustration" :src="cardArt[card.id]" alt="" aria-hidden="true" /><b class="art-flare"></b></span>
    <span class="card-name">{{ card.name }}</span>
    <span class="card-class">{{ card.className === 'mage' ? 'Чародейка' : 'Воин' }}</span>
    <span class="card-description">{{ card.description }}</span>
    <span class="card-edge"></span>
  </button>
</template>
