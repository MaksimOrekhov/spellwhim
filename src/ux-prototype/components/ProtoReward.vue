<script setup lang="ts">
// Reward screen: the same card, bigger, with the same "свиток" always open beneath it — choosing a card is a reading task,
// so (unlike the hand) rules text is shown in full. Cards sit on the same scene, not on a separate flat gradient.
import { computed } from 'vue'
import type { CardDefinition } from '../../game/types'
import { cards as allCards } from '../../game/types'
import { previewCard, createBattle } from '../../game/battle'
import ProtoCard from './ProtoCard.vue'
import CardNotes from './CardNotes.vue'
import GlyphIcon from './GlyphIcon.vue'

const props = defineProps<{ options: CardDefinition[] }>()
defineEmits<{ pick: [card: CardDefinition] }>()
// Neutral preview (no statuses) so the reward shows the card's own numbers.
const neutral = createBattle(undefined, undefined, { seed: 3 })
const picks = computed(() => props.options.map(card => ({ card, preview: previewCard(neutral, allCards.find(c => c.id === card.id)!) })))
</script>

<template>
  <main class="reward">
    <header class="reward-head">
      <span class="spark"><GlyphIcon name="attack-all" /></span>
      <small>Победа · Корневой дозорный</small>
      <h1>Выберите новую силу</h1>
      <p>Карта останется в колоде до конца похода. Колода: 18 → 19 карт.</p>
    </header>
    <div class="reward-row">
      <div v-for="(p, i) in picks" :key="p.card.id" class="choice" :style="{ '--i': i }">
        <div class="choice-card"><ProtoCard :card="p.card" :preview="p.preview" :reason="null" @play="$emit('pick', p.card)" /></div>
        <CardNotes class="choice-notes" :card="p.card" :preview="p.preview" :reason="null" mode="choose" />
        <button class="take" @click="$emit('pick', p.card)">Взять карту</button>
      </div>
    </div>
    <button class="skip">Пропустить награду</button>
  </main>
</template>

<style scoped>
.reward{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;padding-top:2.4rem;background:radial-gradient(ellipse at 50% 38%,#0000 20%,#0b1410cc 90%)}
.reward-head{text-align:center;text-shadow:0 .2rem .6rem #000}
.spark{display:inline-grid;width:2.4rem;height:2.4rem;color:#ffe3a0;filter:drop-shadow(0 0 .8rem #ffc968)}
.reward-head small{display:block;margin-top:.2rem;font:800 .8rem var(--f-ui);letter-spacing:.2em;text-transform:uppercase;color:#ecd9a8}
.reward-head h1{margin:.2rem 0;font:800 3rem var(--f-display);color:#fff0c8}
.reward-head p{margin:0;font:600 1.05rem var(--f-ui);color:#f0e4c8}
.reward-row{display:flex;gap:4.5rem;margin-top:2.6rem;align-items:flex-start}
.choice{display:flex;flex-direction:column;align-items:center;gap:1rem;animation:rise .55s var(--ease-out) both;animation-delay:calc(var(--i) * .09s)}
@keyframes rise{from{opacity:0;transform:translateY(3rem) scale(.9)}}
.choice-card{width:17.4rem;height:25.5rem;transition:transform .25s var(--ease-out)}
.choice-card :deep(.pcard){font-size:1.5rem}
.choice:hover .choice-card{transform:translateY(-.8rem) scale(1.03)}
.choice-notes{width:17.4rem!important;font-size:1.1rem;min-height:14.2em}
.take{padding:.7rem 2.2rem;border:.14rem solid #ffe3a7;border-radius:.6rem;background:linear-gradient(#d8923f,#8a4a1d);box-shadow:0 .25rem 0 #4a1f08,0 .6rem 1rem #000a;color:#fff3d6;font:800 1.1rem var(--f-display)}
.take:hover{filter:brightness(1.12)}
.skip{margin-top:1.3rem;padding:.35rem 1.4rem;border:.1rem solid #ffffff44;border-radius:2rem;background:#0006;color:#d9c9a6;font:700 .9rem var(--f-ui)}
@media (max-height:820px){.reward{padding-top:1.4rem}.reward-head h1{font-size:2.2rem}.reward-row{margin-top:1.2rem;gap:3rem}.choice-card{width:13.9rem;height:20.4rem}.choice-card :deep(.pcard){font-size:1.2rem}.choice-notes{width:13.9rem!important;font-size:.9rem}.reward-head p{display:none}}
</style>
