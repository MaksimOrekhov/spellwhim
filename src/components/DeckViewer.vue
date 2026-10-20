<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { BookOpen } from '@lucide/vue'
import SpellCard from './SpellCard.vue'
import CardNotes from './CardNotes.vue'
import { resolveCardDefinition } from '../game/cardProgression'
import type { PersistentCard } from '../game/types'
import { neutralPreview } from '../ui/cardDisplay'
import { getClassTheme } from '../game/classThemes'

const props = defineProps<{ deck: readonly PersistentCard[] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const selected = ref<string | null>(null)
const groups = computed(() => {
  const entries = new Map<string, { card: ReturnType<typeof resolveCardDefinition>; copies: PersistentCard[] }>()
  for (const copy of props.deck) {
    const key = copy.definitionId + '/' + copy.upgrade
    const group = entries.get(key) ?? { card: resolveCardDefinition(copy), copies: [] }
    group.copies.push(copy)
    entries.set(key, group)
  }
  return [...entries.values()].map(group => ({ ...group, preview: neutralPreview(group.card) }))
})
</script>

<template>
  <button class="game-button deck-open" @click="dialog?.showModal()"><BookOpen :size="18" aria-hidden="true" /> Посмотреть колоду · {{ deck.length }}</button>
  <dialog ref="dialog" class="deck-dialog" aria-labelledby="deck-title" @click="($event.target === dialog) && dialog?.close()">
    <header><div><h2 id="deck-title">Колода отряда · {{ deck.length }} карт</h2><p>Нажмите карту, чтобы прочитать её описание.</p></div><button class="game-button" autofocus @click="dialog?.close()">Вернуться к награде</button></header>
    <div class="deck-grid">
      <article v-for="{ card, copies, preview } in groups" :key="copies[0]!.instanceId" class="deck-group">
        <button class="deck-card" :aria-label="card.name + (card.upgrade ? ' · Улучшена' : '') + ' · ' + getClassTheme(card.className).name + ' · ' + card.cost + ' маны · копий: ' + copies.length" :aria-expanded="selected === copies[0]!.instanceId" @click="selected = selected === copies[0]!.instanceId ? null : copies[0]!.instanceId">
          <SpellCard :card="card" :preview="preview" />
        </button>
        <strong>Копий: {{ copies.length }}</strong>
        <div class="copy-state"><p v-for="(copy, i) in copies" :key="copy.instanceId">Копия {{ i + 1 }} · {{ copy.upgrade === 0 ? 'Обычная' : 'Улучшена' }}</p></div>
        <CardNotes v-if="selected === copies[0]!.instanceId" :card="card" :preview="preview" mode="inspect" />
      </article>
    </div>
  </dialog>
</template>

<style scoped>
.deck-open{display:inline-flex;align-items:center;gap:var(--sp-2)}
.deck-dialog{width:min(1120px,94vw);max-height:90vh;padding:var(--sp-5);border:var(--border-panel);border-radius:var(--shape-dialog);background:var(--mat-wood);color:var(--ink);box-shadow:var(--shadow-4)}
.deck-dialog::backdrop{background:var(--wood-0);opacity:.85}
header{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);margin-bottom:var(--sp-5)}h2{margin:0;font:700 var(--fs-2xl) var(--font-display)}header p{margin:var(--sp-1) 0;color:var(--muted)}
.deck-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--sp-5);align-items:start}.deck-group{display:grid;justify-items:center;gap:var(--sp-2);font-size:14px}.deck-card{padding:0;border:0;border-radius:var(--shape-scroll);background:none;font-size:14px}.deck-card:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}.copy-state{color:var(--muted);font:700 var(--fs-sm) var(--font-ui)}.copy-state p{margin:0}
@media(max-width:700px){header{align-items:start;flex-direction:column}.deck-dialog{padding:var(--sp-3)}.deck-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-3)}.deck-card{font-size:11px}}
</style>
