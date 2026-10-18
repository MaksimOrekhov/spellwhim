<script setup lang="ts">
// A playable card: the shared SpellCard face inside a real button. Hover/zoom/notes live in BattleHand, which knows the whole fan.
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import { getClassTheme } from '../game/classThemes'
import { spokenSummary } from '../ui/cardDisplay'
import type { CardBlock } from '../ui/cardDisplay'
import SpellCard from './SpellCard.vue'

const props = defineProps<{ card: CardDefinition; instanceId: string; preview: CardPreview; block: CardBlock | null; playing: boolean; index: number; vis?: number }>()
const emit = defineEmits<{ play: [instanceId: string] }>()
const hotkey = computed(() => String(props.index === 9 ? 0 : props.index + 1))
const label = computed(() => `${hotkey.value}. ${props.card.name}, ${props.card.cost} маны. Класс: ${getClassTheme(props.card.className).name}. ${spokenSummary(props.card, props.preview)}${props.block ? ' ' + props.block.text : ''}`)

function play() {
  if (!props.block && !props.playing) emit('play', props.instanceId)
}
</script>

<template>
  <button :id="'card-' + instanceId" class="hand-card" :class="{ 'is-playing': playing }" :aria-disabled="!!block || playing" :aria-label="label" @click="play">
    <SpellCard :card="card" :preview="preview" :block="block" :hotkey="hotkey" :vis="vis" />
  </button>
</template>

<style scoped>
.hand-card{display:block;width:12em;height:16.6em;padding:0;border:0;background:none;border-radius:1.6em;font-size:inherit;text-align:left;cursor:pointer}
.hand-card[aria-disabled="true"]{cursor:default}
.hand-card:focus-visible{outline:var(--focus-ring);outline-offset:.25em}
.is-playing{pointer-events:none;animation:card-play .36s ease-in forwards}
@keyframes card-play{to{transform:translateY(-6em) scale(.55);opacity:0}}
</style>
