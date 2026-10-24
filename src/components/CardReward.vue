<script setup lang="ts">
// Reward choice. Each option is the same SpellCard object as in the hand, only larger, with the full notes underneath
// (no hover needed here). Numbers come from a neutral preview: no board context, so no synergy is shown as active.
import { computed } from 'vue'
import SpellCard from './SpellCard.vue'
import CardNotes from './CardNotes.vue'
import DeckViewer from './DeckViewer.vue'
import { neutralPreview } from '../ui/cardDisplay'
import { manaText } from '../ui/cardOperations'
import type { CardDefinition, PersistentCard } from '../game/types'

const props = defineProps<{ options: CardDefinition[]; encounterName: string; elite?: boolean; deck?: readonly PersistentCard[]; offerId?: string }>()
const emit = defineEmits<{ choose: [card: CardDefinition, offerId?: string]; skip: [offerId: string] }>()
const items = computed(() => props.options.map(card => ({ card, preview: neutralPreview(card) })))
</script>

<template>
  <main class="reward-screen" :class="{ 'reward-screen--progression': deck || offerId }">
    <div class="reward-content">
      <header class="reward-heading">
        <span class="reward-spark" aria-hidden="true">✦</span>
        <p class="reward-kicker">{{ elite ? 'ЦЕННАЯ НАГРАДА ЭЛИТЫ' : 'НАГРАДА ЗА ПОБЕДУ' }} · {{ encounterName.toUpperCase() }}</p>
        <h1>{{ elite ? 'Заберите трофей' : 'Найдите новую силу' }}</h1>
        <p class="reward-copy">Выберите одну карту из {{ options.length }}: она войдёт в общую колоду отряда.</p>
      </header>
      <div class="reward-options" :style="{ '--n': options.length }">
        <button v-for="{ card, preview } in items" :key="card.id" class="reward-option" :data-card-id="card.id" :aria-label="'Взять карту: ' + card.name + ', ' + manaText(card.cost) + '. ' + (card.upgrade ? 'Улучшена. ' : '') + card.description" @click="emit('choose', card, offerId)">
          <SpellCard :card="card" :preview="preview" />
          <CardNotes class="reward-notes" :card="card" :preview="preview" mode="choose" />
        </button>
      </div>
      <footer class="reward-actions">
        <DeckViewer v-if="deck" :deck="deck" />
        <button v-if="offerId && !elite" class="game-button" @click="emit('skip', offerId)">Пропустить награду</button>
        <p v-if="offerId && !elite">Пропуск не даёт дополнительных наград.</p>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.reward-screen{--reward-room:330px;position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:3vh 3vw;background:radial-gradient(ellipse at 50% 30%,#758768,#35564e 62%,#203c3a);color:var(--ink)}
.reward-screen--progression{--reward-room:410px}
.reward-content{width:min(1320px,100%);text-align:center}
.reward-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-3);margin-top:var(--sp-4)}.reward-actions p{flex-basis:100%;margin:0;color:var(--muted);font-size:var(--fs-sm)}
.reward-heading{display:block}
.reward-spark{font-size:30px;color:#ffe1a0}
.reward-kicker{margin:6px 0;font-size:14px;color:#e1d4b4}
.reward-content h1{margin:0;font:700 clamp(28px,3vw,46px) var(--font-display);color:#fff0ca}
.reward-copy{margin:8px 0 clamp(14px,3vh,28px);color:#e4dfcb;font-size:16px}
/* One card scale for the whole row: limited by the viewport height (card + notes + header) and by the width shared between the options. */
.reward-options{--em:min(calc((100vh - var(--reward-room)) / 22),calc((100vw - 9rem - (var(--n) - 1) * 1.5rem) / (12.4 * var(--n))),28px);display:flex;justify-content:center;align-items:flex-start;gap:clamp(12px,1.6vw,28px);font-size:var(--em)}
.reward-option{display:flex;flex-direction:column;gap:.9em;align-items:center;width:12.4em;padding:.2em;border:0;border-radius:2em;background:none;font-size:inherit;transition:transform var(--dur-base) var(--ease-out)}
.reward-option:hover,.reward-option:focus-visible{transform:translateY(-.5em)}
.reward-option:focus-visible{outline:var(--focus-ring);outline-offset:.2em}
.reward-option:hover :deep(.sc-rim),.reward-option:focus-visible :deep(.sc-rim){box-shadow:0 .9em 1.6em #04101299,0 0 0 .12em var(--c-focus),inset 0 .1em .12em #fff7}
.reward-notes{font-size:.82em;pointer-events:none}
@media(min-width:801px) and (max-height:800px){
  .reward-screen{padding:6px 3vw}
  .reward-heading{display:grid;grid-template-columns:max-content auto minmax(0,1fr);align-items:center;gap:0 1rem;margin-bottom:4px;text-align:left}
  .reward-spark{display:none}
  .reward-kicker{margin:0;text-align:left;white-space:nowrap;font-size:12px}
  .reward-content h1{font-size:clamp(26px,2.8vw,40px);white-space:nowrap}
  .reward-copy{margin:0;text-align:left;line-height:1.25}
  .reward-option{gap:.25em}
}
@media(min-width:801px) and (min-height:801px) and (max-height:1200px){
  .reward-heading{display:grid;grid-template-columns:max-content auto minmax(0,1fr);align-items:center;gap:0 1.5rem;margin-bottom:16px;text-align:left}
  .reward-spark{display:none}
  .reward-kicker{margin:0;text-align:left;white-space:nowrap}
  .reward-content h1{font-size:clamp(32px,2.4vw,46px);white-space:nowrap}
  .reward-copy{margin:0;text-align:left;line-height:1.3}
}
@media(max-width:800px){.reward-heading{display:block;margin-bottom:0;text-align:center}.reward-copy{margin:8px 0 12px;text-align:center}.reward-options{flex-wrap:wrap}}
</style>
