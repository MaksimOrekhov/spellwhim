<script setup lang="ts">
// Reward choice. Each option is the same SpellCard object as in the hand, only larger, with the full notes underneath
// (no hover needed here). Numbers come from a neutral preview: no board context, so no synergy is shown as active.
import { computed } from 'vue'
import SpellCard from './SpellCard.vue'
import CardNotes from './CardNotes.vue'
import { neutralPreview } from '../ui/cardDisplay'
import type { CardDefinition } from '../game/types'

const props = defineProps<{ options: CardDefinition[]; encounterName: string; elite?: boolean }>()
const emit = defineEmits<{ choose: [card: CardDefinition] }>()
const items = computed(() => props.options.map(card => ({ card, preview: neutralPreview(card) })))
</script>

<template>
  <main class="reward-screen">
    <div class="reward-content">
      <span class="reward-spark" aria-hidden="true">✦</span>
      <p class="reward-kicker">{{ elite ? 'ЦЕННАЯ НАГРАДА ЭЛИТЫ' : 'НАГРАДА ЗА ПОБЕДУ' }} · {{ encounterName.toUpperCase() }}</p>
      <h1>{{ elite ? 'Заберите трофей' : 'Найдите новую силу' }}</h1>
      <p class="reward-copy">Выберите одну карту из {{ options.length }}. Она останется с отрядом до конца похода.</p>
      <div class="reward-options" :style="{ '--n': options.length }">
        <button v-for="{ card, preview } in items" :key="card.id" class="reward-option" :data-card-id="card.id" :aria-label="'Взять карту: ' + card.name + ', ' + card.cost + ' маны. ' + card.description" @click="emit('choose', card)">
          <SpellCard :card="card" :preview="preview" />
          <CardNotes class="reward-notes" :card="card" :preview="preview" mode="choose" />
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.reward-screen{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:3vh 3vw;background:radial-gradient(ellipse at 50% 30%,#758768,#35564e 62%,#203c3a);color:var(--ink)}
.reward-content{width:min(1320px,96vw);text-align:center}
.reward-spark{font-size:30px;color:#ffe1a0}
.reward-kicker{margin:6px 0;font-size:14px;color:#e1d4b4}
.reward-content h1{margin:0;font:700 clamp(28px,3vw,46px) var(--font-display);color:#fff0ca}
.reward-copy{margin:8px 0 clamp(14px,3vh,28px);color:#e4dfcb;font-size:16px}
/* One card scale for the whole row: limited by the viewport height (card + notes + header) and by the width shared between the options. */
.reward-options{--em:min(calc((100vh - 330px) / 22),calc((100vw - 9rem - (var(--n) - 1) * 1.5rem) / (12.4 * var(--n))),23px);display:flex;justify-content:center;align-items:flex-start;gap:clamp(12px,1.6vw,28px);font-size:var(--em)}
.reward-option{display:flex;flex-direction:column;gap:.9em;align-items:center;width:12.4em;padding:.2em;border:0;border-radius:2em;background:none;font-size:inherit;transition:transform var(--dur-base) var(--ease-out)}
.reward-option:hover,.reward-option:focus-visible{transform:translateY(-.5em)}
.reward-option:focus-visible{outline:var(--focus-ring);outline-offset:.2em}
.reward-option:hover :deep(.sc-rim),.reward-option:focus-visible :deep(.sc-rim){box-shadow:0 .9em 1.6em #04101299,0 0 0 .12em var(--c-focus),inset 0 .1em .12em #fff7}
.reward-notes{font-size:.82em;pointer-events:none}
@media(max-height:800px){.reward-spark{display:none}.reward-copy{margin-bottom:12px}.reward-kicker{margin:0 0 2px}}
@media(max-width:800px){.reward-options{flex-wrap:wrap}}
</style>
