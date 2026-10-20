<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import type { PersistentCard } from '../game/types'
import { canUpgradeCard, resolveCardDefinition } from '../game/cardProgression'
import { neutralPreview } from '../ui/cardDisplay'
import SpellCard from './SpellCard.vue'

const props = withDefaults(defineProps<{ deck: readonly PersistentCard[]; explanation?: string; selectedInstanceId?: string }>(), { explanation: 'Вместо лечения. Выберите копию и сравните версии.' })
const emit = defineEmits<{ confirm: [instanceId: string]; close: []; select: [instanceId: string] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const selected = ref<string | null>(props.selectedInstanceId ?? null)
const entries = computed(() => props.deck.map((copy, index) => ({ copy, index, card: resolveCardDefinition(copy), eligible: canUpgradeCard(copy) })))
const comparison = computed(() => {
  const copy = props.deck.find(card => card.instanceId === selected.value)
  if (!copy || !canUpgradeCard(copy)) return null
  const before = resolveCardDefinition(copy)
  const after = resolveCardDefinition({ ...copy, upgrade: 1 })
  const oldWords = new Set(before.description.split(/\s+/))
  return { copy, before, after, beforePreview: neutralPreview(before), afterPreview: neutralPreview(after), words: after.description.split(/(\s+)/).map(word => ({ word, changed: word.trim() !== '' && !oldWords.has(word) })) }
})
onMounted(() => dialog.value?.showModal())
</script>

<template>
  <dialog ref="dialog" class="upgrade-dialog" aria-labelledby="upgrade-title" @cancel.prevent="emit('close')" @click="($event.target === dialog) && emit('close')">
    <header><div><h2 id="upgrade-title">Улучшить одну карту</h2><p>{{ explanation }}</p></div><button class="game-button" @click="emit('close')">Отмена</button></header>
    <div class="upgrade-body">
      <div class="upgrade-list" aria-label="Экземпляры в колоде">
        <button v-for="{ copy, index, card, eligible } in entries" :key="copy.instanceId" class="upgrade-option" :class="{ selected: selected === copy.instanceId }" :disabled="!eligible" :aria-pressed="selected === copy.instanceId" @click="selected = copy.instanceId; emit('select',copy.instanceId)">
          <span>{{ card.name }}</span><small>Копия {{ index + 1 }} · {{ eligible ? `Мана: ${card.cost}` : 'Уже улучшена ↑' }}</small>
        </button>
      </div>
      <section v-if="comparison" class="upgrade-comparison" aria-live="polite">
        <article><h3>Обычная</h3><SpellCard :card="comparison.before" :preview="comparison.beforePreview" /><p>{{ comparison.before.description }}</p></article>
        <article><h3>Улучшенная ↑</h3><SpellCard :card="comparison.after" :preview="comparison.afterPreview" /><p><template v-for="(part, i) in comparison.words" :key="i"><mark v-if="part.changed">{{ part.word }}</mark><template v-else>{{ part.word }}</template></template></p></article>
      </section>
      <p v-else class="upgrade-empty">Выберите ещё не улучшенную копию слева.</p>
    </div>
    <footer><span>Цена маны и класс сохраняются. Улучшение — один раз на копию.</span><button class="game-button" :disabled="!comparison" @click="comparison && emit('confirm', comparison.copy.instanceId)">Подтвердить улучшение</button></footer>
  </dialog>
</template>

<style scoped>
.upgrade-dialog{width:min(1040px,94vw);max-height:90vh;padding:var(--sp-4);border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-wood);color:var(--ink);box-shadow:var(--shadow-4)}
.upgrade-dialog::backdrop{background:#101919dc}header,footer{display:flex;justify-content:space-between;align-items:center;gap:var(--sp-4)}h2{margin:0;font:700 var(--fs-2xl) var(--font-display)}header p{margin:var(--sp-1) 0 var(--sp-3);color:var(--muted)}
.upgrade-body{display:grid;grid-template-columns:260px 1fr;gap:var(--sp-4);height:min(440px,62vh);min-height:0}.upgrade-list{overflow:auto;display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-1)}
.upgrade-option{display:grid;gap:var(--sp-1);text-align:left;border:var(--border-panel);border-radius:var(--shape-chip);background:var(--wood-1);color:var(--ink);padding:var(--sp-2) var(--sp-3);cursor:pointer}.upgrade-option span{font:700 var(--fs-base) var(--font-ui)}.upgrade-option small{color:var(--muted)}.upgrade-option.selected{border-color:var(--brass-1);box-shadow:inset 0 0 0 1px var(--brass-1)}.upgrade-option:disabled{opacity:.5;cursor:default}
.upgrade-comparison{overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);text-align:center}.upgrade-comparison article{display:flex;flex-direction:column;align-items:center;font-size:13px}.upgrade-comparison h3{margin:var(--sp-2) 0 var(--sp-3);font:700 var(--fs-lg) var(--font-display)}.upgrade-comparison p{max-width:240px;margin:var(--sp-3) 0;line-height:1.5;font:600 14px/1.5 var(--font-ui)}mark{background:var(--brass-1);color:var(--parch-ink);border-radius:3px;padding:0 2px}.upgrade-empty{align-self:center;text-align:center;color:var(--muted)}footer{margin-top:var(--sp-3);font:600 var(--fs-sm)/1.4 var(--font-ui);color:var(--muted)}
@media(max-width:720px){.upgrade-body{grid-template-columns:170px 1fr}.upgrade-comparison article{font-size:9px}.upgrade-comparison p{font-size:12px}.upgrade-option span{font-size:12px}footer{flex-wrap:wrap}header{align-items:start}.upgrade-dialog{padding:var(--sp-2)}}
</style>
