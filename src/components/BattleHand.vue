<script setup lang="ts">
import { computed } from 'vue'
import HandCard from './HandCard.vue'
import type { HandCardView } from '../composables/useBattle'

const props = defineProps<{ cards: HandCardView[]; outgoing: HandCardView | null; outgoingIndex: number; drawCount: number; discardCount: number; exhaustedCount: number; busy: boolean }>()
const emit = defineEmits<{ play: [instanceId: string] }>()
const displayed = computed(() => {
  const cards = [...props.cards]
  if (props.outgoing) cards.splice(props.outgoingIndex, 0, props.outgoing)
  return cards
})
</script>

<template>
  <div class="deck-summary" title="В начале хода добираются 3 карты. Пустая колода пополняется перемешанным сбросом.">
    <strong>РУКА {{ cards.length }} · КОЛОДА {{ drawCount }}</strong>
    <span>СБРОС {{ discardCount }} · ВЫБЫЛО {{ exhaustedCount }}</span>
  </div>
  <section class="hand-row" :class="{ 'hand-row--wide': displayed.length > 3 }" aria-label="Карты в руке">
    <HandCard v-for="(item, index) in displayed" :key="item.instanceId" :card="item.card" :instance-id="item.instanceId" :preview="item.preview" :index="index" :playable="item.playable" :playing="outgoing?.instanceId === item.instanceId" :busy="busy" @play="emit('play', $event)" />
    <p v-if="!displayed.length" class="empty-hand">Рука пуста · завершите ход для добора</p>
  </section>
</template>

<style scoped>
.deck-summary{position:absolute;z-index:4;left:4%;bottom:25%;display:flex;flex-direction:column;gap:7px;padding:10px 13px;border:1px solid #cfbc8366;border-radius:5px;background:#152431dc;font:700 clamp(11px,.9vw,16px) Manrope,Arial,sans-serif;color:#f8e8bd}
.deck-summary span{font-size:.85em;color:#c7d1d7}.empty-hand{margin:auto 0 35px;color:#e8d9be;font:600 clamp(13px,1vw,18px) Manrope,Arial,sans-serif}
@media(max-width:800px){.deck-summary{left:3%;bottom:26%;padding:6px;font-size:10px;gap:4px}}
</style>
