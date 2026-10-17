<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import swordStrikeArt from '../assets/art/sword-strike.jpg'
import fireballArt from '../assets/art/fireball.jpg'
import guardArt from '../assets/art/guard.jpg'
const props = defineProps<{ card: CardDefinition; instanceId: string; preview: CardPreview; playable: boolean; playing: boolean; index: number; busy: boolean }>()
const emit = defineEmits<{ play: [instanceId: string] }>()
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
    emit('play', props.instanceId)
    window.setTimeout(() => { suppressClick.value = false }, 0)
  }
}
</script>
<template>
  <button class="spell-card" :class="[`spell-card--${card.className}`, `spell-card--id-${card.id}`, { 'is-unplayable': !playable && !playing, 'is-link-ready': preview.links.length > 0 && playable, 'is-playing': playing, 'is-dragging': dragging, 'spell-card--left': index === 0, 'spell-card--right': index === 2 }]" :style="cardStyle" :disabled="!playable || busy || playing" :title="preview.links.length ? preview.links.join(' · ') + ': +' + preview.bonusDamage + ' урона' : card.description" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="dragging = false; offset = { x: 0, y: 0 }" @click="!suppressClick && playable && !busy && emit('play', instanceId)">
    <span class="card-cost">{{ card.cost }}</span>
    <span v-if="preview.links.length" class="card-link-bonus">СВЯЗКА +{{ preview.bonusDamage }} · {{ preview.damage }} УРОНА</span>
    <span class="card-art"><img class="card-illustration" :src="cardArt[card.id]" alt="" aria-hidden="true" /><b class="art-flare"></b></span>
    <span class="card-name">{{ card.name }}</span>
    <span class="card-class">{{ card.className === 'mage' ? 'Чародейка' : 'Воин' }}</span>
    <span class="card-description">{{ card.description }}</span>
    <span class="card-edge"></span>
  </button>
</template>

<style scoped>
.spell-card.is-link-ready{box-shadow:0 0 0 2px #e2b5ff,0 0 24px #b27bff9c,inset 0 0 0 2px #4b2d28}
.card-link-bonus{position:absolute;z-index:5;top:43%;left:7%;right:7%;padding:6px 3px;border:1px solid #ebccff;border-radius:5px;background:#39224bea;color:#f6e4ff;font:800 clamp(10px,.8vw,14px) Manrope,Arial,sans-serif;letter-spacing:.02em;box-shadow:0 0 15px #d795ff70}
.spell-card .card-art{top:7%;height:42%}
.spell-card .card-name{top:52%;min-height:clamp(22px,2.8vh,30px)}
.spell-card .card-description{top:73%;left:8%;right:8%;font-size:clamp(11px,.88vw,15px);line-height:1.3}
.spell-card .card-class{top:67%}
@media(max-width:800px){.spell-card .card-description{font-size:9px}.card-link-bonus{font-size:9px;padding:4px 2px}}
</style>
