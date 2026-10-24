<script setup lang="ts">
// A playable card: the shared SpellCard face inside a real button. Hover/zoom/notes live in BattleHand, which knows the whole fan.
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import { getClassTheme } from '../game/classThemes'
import { spokenSummary } from '../ui/cardDisplay'
import { manaText } from '../ui/cardOperations'
import type { CardBlock } from '../ui/cardDisplay'
import SpellCard from './SpellCard.vue'
import CompactCard from './CompactCard.vue'

const props = defineProps<{ card: CardDefinition; instanceId: string; preview: CardPreview; block: CardBlock | null; playing: boolean; index: number; vis?: number; compact?: boolean; active?: boolean; fullShift?: number; fullScale?: number; fullEm?: number }>()
const emit = defineEmits<{ play: [instanceId: string] }>()
const hotkey = computed(() => String(props.index === 9 ? 0 : props.index + 1))
const label = computed(() => `${hotkey.value}. ${props.card.name}, ${manaText(props.card.cost)}. Класс: ${getClassTheme(props.card.className).name}. ${spokenSummary(props.card, props.preview)}${props.block ? ' ' + props.block.text : ''}`)

function play() {
  if (!props.block && !props.playing) emit('play', props.instanceId)
}
</script>

<template>
  <button :id="'card-' + instanceId" class="hand-card" :class="{ 'is-playing': playing }" :aria-disabled="!!block || playing" :aria-label="label" @click="play">
    <template v-if="compact">
      <CompactCard :card="card" :preview="preview" :block="block" />
      <span v-if="active" class="hand-full" :style="{ fontSize: (fullEm ?? 14) + 'px', '--shift': (fullShift ?? 0) + 'px', '--zoom': String(fullScale ?? 1.2) }"><SpellCard :card="card" :preview="preview" :block="block" /></span>
    </template>
    <SpellCard v-else :card="card" :preview="preview" :block="block" :vis="vis" />
  </button>
</template>

<style scoped>
.hand-card{position:relative;display:block;width:100%;height:100%;padding:0;border:0;background:none;border-radius:1.6em;font-size:inherit;text-align:left;cursor:pointer}
.hand-card[aria-disabled="true"]{cursor:default}
.hand-card:focus-visible{outline:var(--focus-ring);outline-offset:.25em}
.is-playing{pointer-events:none;animation:card-play .36s ease-in forwards}
@keyframes card-play{to{transform:translateY(-6em) scale(.55);opacity:0}}
</style>
<style>
/* Compact hand: the full card rises from the tile, centred over it, nudged back inside the screen. */
.hand-full{position:absolute;left:50%;bottom:0;z-index:5;display:block;transform-origin:50% 100%;transform:translateX(calc(-50% + var(--shift))) translateY(-.5em) scale(var(--zoom));animation:hand-full-in var(--dur-fast) var(--ease-out);pointer-events:none}
@keyframes hand-full-in{from{opacity:0;transform:translateX(calc(-50% + var(--shift))) translateY(.4em) scale(calc(var(--zoom) * .92))}}
</style>
