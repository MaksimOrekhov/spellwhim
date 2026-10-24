<script setup lang="ts">
// The party deck, read-only, from any screen (map, reward, room, summary). Identical copies share one tile with a count; an upgraded copy
// is its own tile. Order and grouping are the same as in the deck-operation gallery (ui/cardOperations.ts).
import { computed, ref, useTemplateRef } from 'vue'
import { BookOpen } from '@lucide/vue'
import { classThemeStyle } from '../game/classThemes'
import SpellCard from './SpellCard.vue'
import CardNotes from './CardNotes.vue'
import type { PersistentCard } from '../game/types'
import { cardsText, classLabel, groupCopies, manaText } from '../ui/cardOperations'

const props = defineProps<{ deck: readonly PersistentCard[] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const selected = ref<string | null>(null)
const groups = computed(() => groupCopies(props.deck, () => true))
</script>

<template>
  <button class="game-button deck-open" @click="dialog?.showModal()"><BookOpen :size="18" aria-hidden="true" /> Посмотреть колоду · {{ deck.length }}</button>
  <dialog ref="dialog" class="deck-dialog" aria-labelledby="deck-title" @click="($event.target === dialog) && dialog?.close()">
    <header><div><h2 id="deck-title">Колода отряда · {{ cardsText(deck.length) }}</h2><p>Нажмите карту, чтобы прочитать её описание.</p></div><button class="game-button" autofocus @click="dialog?.close()">Закрыть</button></header>
    <div class="deck-grid">
      <article v-for="{ key, card, copies, preview } in groups" :key="key" class="deck-group">
        <button class="deck-card" :class="{ 'cf-stack': copies.length > 1, 'cf-stack--2': copies.length > 2 }" :style="classThemeStyle(card.className)" :aria-label="`${card.name}${card.upgrade ? ', улучшена' : ''}. ${classLabel(card)}, ${manaText(card.cost)}. Копий: ${copies.length}.`" :aria-expanded="selected === key" @click="selected = selected === key ? null : key">
          <SpellCard :card="card" :preview="preview" />
        </button>
        <strong class="copy-state">×{{ copies.length }}<template v-if="card.upgrade"> · улучшена</template></strong>
        <CardNotes v-if="selected === key" :card="card" :preview="preview" mode="inspect" />
      </article>
    </div>
  </dialog>
</template>

<style scoped>
.deck-open{display:inline-flex;align-items:center;gap:var(--sp-2)}
.deck-dialog{width:min(1120px,94vw);max-height:90vh;padding:var(--sp-5);border:var(--border-panel);border-radius:var(--shape-dialog);background:var(--mat-wood);color:var(--ink);box-shadow:var(--shadow-4)}
.deck-dialog::backdrop{background:var(--wood-0);opacity:.85}
header{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);margin-bottom:var(--sp-5)}h2{margin:0;font:700 var(--fs-2xl) var(--font-display)}header p{margin:var(--sp-1) 0;color:var(--muted)}
.deck-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--sp-5);align-items:start}.deck-group{display:grid;justify-items:center;gap:var(--sp-2);font-size:14px}.deck-card{padding:0;border:0;border-radius:var(--shape-scroll);background:none;font-size:14px;margin-right:.9em}.deck-card[aria-expanded=true]{outline:3px solid var(--c-bonus);outline-offset:.5em;box-shadow:var(--glow-bonus)}.deck-card:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}.copy-state{color:var(--muted);font:700 var(--fs-sm) var(--font-ui)}
@media(max-width:700px){header{align-items:start;flex-direction:column}.deck-dialog{padding:var(--sp-3)}.deck-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-3)}.deck-card{font-size:11px}}
</style>
