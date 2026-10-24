<script setup lang="ts">
// A compact gallery of real cards for choosing a copy: identical copies share one tile with a count, upgraded copies are their own tile,
// cards the operation cannot touch stay visible but dimmed with the reason. Selection is by instanceId (the first eligible copy of a tile).
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import type { PersistentCard } from '../game/types'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import type { CardClassId } from '../game/types'
import { cardSummary, classLabel, groupCopies, manaText } from '../ui/cardOperations'
import SpellCard from './SpellCard.vue'

const props = defineProps<{
  deck: readonly PersistentCard[]
  isEligible: (copy: PersistentCard) => boolean
  /** Why a card cannot be chosen, shown on its tile. */
  lockedReason: (copy: PersistentCard) => string
  selectedInstanceId: string | null
  label: string
}>()
const emit = defineEmits<{ select: [instanceId: string] }>()
const grid = useTemplateRef<HTMLElement>('grid')
const filter = ref<CardClassId | 'all'>('all')
const groups = computed(() => groupCopies(props.deck, props.isEligible))
const classes = computed(() => [...new Set(groups.value.map(group => group.card.className))])
const shown = computed(() => groups.value.filter(group => filter.value === 'all' || group.card.className === filter.value))
const countOf = (id: CardClassId) => groups.value.reduce((sum, group) => sum + (group.card.className === id ? group.copies.length : 0), 0)

function pick(group: (typeof groups.value)[number]) {
  if (!group.eligible.length) return
  emit('select', group.copies.some(copy => copy.instanceId === props.selectedInstanceId) && group.eligible.some(copy => copy.instanceId === props.selectedInstanceId) ? props.selectedInstanceId! : group.eligible[0]!.instanceId)
}
const isSelected = (group: (typeof groups.value)[number]) => group.copies.some(copy => copy.instanceId === props.selectedInstanceId)

/** Arrow keys move between tiles by geometry (rows are read from the grid), Home/End jump to the ends. */
function onKey(event: KeyboardEvent) {
  const items = [...(grid.value?.querySelectorAll<HTMLElement>('.cg-item') ?? [])]
  const at = items.indexOf(document.activeElement as HTMLElement)
  if (at < 0) return
  const columns = Math.max(1, getComputedStyle(grid.value!).gridTemplateColumns.split(' ').length)
  const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key]
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : move === undefined ? -1 : at + move
  if (target < 0 || target >= items.length) return
  event.preventDefault()
  items[target]!.focus()
}
function focusSelected() {
  void nextTick(() => (grid.value?.querySelector<HTMLElement>('.cg-item.is-selected') ?? grid.value?.querySelector<HTMLElement>('.cg-item:not(.is-locked)'))?.focus())
}
defineExpose({ focusSelected })
</script>

<template>
  <div class="cg">
    <div v-if="classes.length > 1" class="cg-filters" role="group" aria-label="Фильтр по классу">
      <button class="cg-filter" :class="{ 'is-on': filter === 'all' }" :aria-pressed="filter === 'all'" @click="filter = 'all'">Все · {{ deck.length }}</button>
      <button v-for="id in classes" :key="id" class="cg-filter" :class="{ 'is-on': filter === id }" :style="classThemeStyle(id)" :aria-pressed="filter === id" @click="filter = id"><i class="cg-dot" aria-hidden="true"></i>{{ getClassTheme(id).name }} · {{ countOf(id) }}</button>
    </div>
    <div ref="grid" class="cg-grid" role="group" :aria-label="label" @keydown="onKey">
      <button v-for="group in shown" :key="group.key" class="cg-item" :class="{ 'is-selected': isSelected(group), 'is-locked': !group.eligible.length, 'is-upgraded': group.card.upgrade }" :style="classThemeStyle(group.card.className)" :aria-pressed="isSelected(group)" :aria-disabled="!group.eligible.length" :aria-label="`${group.card.name}${group.card.upgrade ? ', улучшена' : ''}. ${classLabel(group.card)}, ${manaText(group.card.cost)}. ${cardSummary(group.card, group.preview)}. Копий: ${group.copies.length}.${group.eligible.length ? '' : ' Недоступна: ' + lockedReason(group.copies[0]!) + '.'}`" @click="pick(group)">
        <span class="cg-card"><SpellCard :card="group.card" :preview="group.preview" /></span>
        <b v-if="group.copies.length > 1" class="cg-count" aria-hidden="true">×{{ group.copies.length }}</b>
        <span class="cg-name">{{ group.card.name }}<template v-if="group.card.upgrade"> ↑</template></span>
        <span class="cg-meta"><i class="cg-dot" aria-hidden="true"></i>{{ classLabel(group.card) }} · {{ manaText(group.card.cost) }}</span>
        <span class="cg-sum">{{ cardSummary(group.card, group.preview) }}</span>
        <span v-if="!group.eligible.length" class="cg-reason">{{ lockedReason(group.copies[0]!) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cg{display:flex;flex-direction:column;gap:var(--sp-3);min-height:0}
.cg-filters{display:flex;flex-wrap:wrap;gap:var(--sp-2)}
.cg-filter{display:inline-flex;align-items:center;gap:var(--sp-2);min-height:36px;padding:var(--sp-1) var(--sp-3);border:var(--border-soft);border-radius:var(--shape-plank);background:var(--wood-1);color:var(--ink);font:700 var(--fs-sm) var(--font-ui);cursor:pointer}
.cg-filter.is-on{border-color:var(--brass-1);background:var(--mat-quiet);box-shadow:inset 0 0 0 1px var(--brass-1)}
.cg-filter:focus-visible,.cg-item:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}
.cg-dot{flex:none;width:.7em;height:.7em;border-radius:50%;background:var(--class-primary,var(--brass-2));box-shadow:0 0 0 .12em var(--class-accent,var(--brass-4))}
.cg-grid{--cs:9.5px;display:grid;grid-template-columns:repeat(auto-fill,minmax(calc(var(--cs) * 12 + 22px),1fr));gap:var(--sp-3) var(--sp-2);align-content:start}
.cg-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:var(--sp-2) var(--sp-1) var(--sp-2);border:2px solid transparent;border-radius:var(--shape-scroll);background:transparent;color:var(--ink);text-align:center;cursor:pointer;transition:transform var(--dur-fast),background var(--dur-fast)}
.cg-item:not(.is-locked):hover{transform:translateY(-3px);background:#ffffff10}
.cg-item.is-selected{border-color:var(--brass-1);background:color-mix(in srgb,var(--brass-1) 16%,transparent);box-shadow:0 0 18px color-mix(in srgb,var(--brass-1) 45%,transparent)}
.cg-item.is-upgraded:not(.is-selected){border-color:color-mix(in srgb,var(--c-bonus) 55%,transparent)}
.cg-card{display:block;font-size:var(--cs);width:calc(var(--cs) * 12);height:calc(var(--cs) * 16.6);margin-bottom:var(--sp-1)}
.cg-count{position:absolute;z-index:2;top:2px;right:6px;padding:1px 9px;border-radius:var(--r-pill);border:2px solid var(--brass-1);background:var(--wood-0);color:var(--parch-1);font:700 var(--fs-md) var(--font-num);box-shadow:var(--shadow-2)}
.cg-name{max-width:100%;font:700 var(--fs-md)/1.15 var(--font-display);color:var(--parch-1)}
.cg-meta{display:inline-flex;align-items:center;gap:6px;font:800 var(--fs-xs) var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.cg-sum{max-width:100%;font:600 var(--fs-xs)/1.25 var(--font-ui);color:var(--ink)}
.cg-reason{margin-top:2px;padding:1px 8px;border-radius:var(--r-pill);background:#0007;color:var(--c-bonus);font:800 var(--fs-xs) var(--font-ui)}
.cg-item.is-locked{cursor:default}
.cg-item.is-locked .cg-card,.cg-item.is-locked .cg-name,.cg-item.is-locked .cg-meta,.cg-item.is-locked .cg-sum{opacity:.5;filter:saturate(.6)}
@media(max-height:800px){.cg-grid{--cs:8.5px}}
@media(max-width:700px){.cg-grid{--cs:8px}}
</style>
