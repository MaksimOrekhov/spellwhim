<script setup lang="ts">
// Asked only when a card gives armor to "the threatened hero" / "the partner" and the enemy's announced hit lands on BOTH heroes:
// each button is one way to split the armor, with the health each hero then loses to that very hit. Numbers come from the engine (`armorChoice`).
import { onMounted, useTemplateRef } from 'vue'
import { Shield, Skull } from '@lucide/vue'
import type { ArmorChoice } from '../game/battle'
import type { BattleState, CardDefinition, HeroId } from '../game/types'

const props = defineProps<{ card: CardDefinition; choice: ArmorChoice; heroes: BattleState['heroes'] }>()
const emit = defineEmits<{ pick: [focus: HeroId]; cancel: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const ids = Object.keys(props.heroes) as HeroId[]
onMounted(() => {
  dialog.value?.showModal()
  dialog.value?.querySelector<HTMLElement>('.ac-option')?.focus()
})
/** Left/right (and up/down) move between the two options; Enter or Space presses the focused one. */
function onKey(event: KeyboardEvent) {
  const items = [...(dialog.value?.querySelectorAll<HTMLElement>('.ac-option') ?? [])]
  const at = items.indexOf(document.activeElement as HTMLElement)
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step || at < 0) return
  event.preventDefault()
  items[(at + step + items.length) % items.length]!.focus()
}
const lossText = (loss: number) => loss > 0 ? `−${loss} HP` : 'без потерь'
</script>

<template>
  <dialog ref="dialog" class="ac" aria-labelledby="ac-title" aria-describedby="ac-note" @cancel.prevent="emit('cancel')" @click="($event.target === dialog) && emit('cancel')" @keydown="onKey">
    <h2 id="ac-title">{{ card.name }}: кого прикрыть?</h2>
    <p id="ac-note" class="ac-note">
      «{{ choice.hit.name }}» {{ choice.hit.imminent ? 'ударит по обоим героям в конце вашего хода.' : 'готовится: ударит по обоим героям на следующем ходу врага.' }}
      Выберите, кому достанется основная защита.
    </p>
    <div class="ac-options" role="group" aria-label="Распределение брони">
      <button v-for="option in choice.options" :key="option.focus" class="ac-option" :class="{ 'is-lethal': option.lethal }" :aria-label="`Основная защита: ${heroes[option.focus].name}. ` + ids.map(id => `${heroes[id].name}: ${option.armor[id] > 0 ? '+' + option.armor[id] + ' брони' : 'без брони'}${option.loss ? ', ' + lossText(option.loss[id] ?? 0) : ''}`).join('. ') + (option.lethal ? '. Смертельно.' : '')" @click="emit('pick', option.focus)">
        <span class="ac-title"><Shield :size="20" aria-hidden="true" />{{ heroes[option.focus].name }}<small v-if="option.focus === choice.auto">как без выбора</small></span>
        <span v-for="id in ids" :key="id" class="ac-row" :class="'ac-row--' + id">
          <span class="ac-hero">{{ heroes[id].name }}</span>
          <b class="ac-armor" :class="{ 'is-none': option.armor[id] === 0 }">{{ option.armor[id] > 0 ? '+' + option.armor[id] + ' брони' : 'без брони' }}</b>
          <span v-if="option.loss" class="ac-loss" :class="{ 'is-hit': (option.loss[id] ?? 0) > 0 }">{{ lossText(option.loss[id] ?? 0) }} <small>({{ Math.max(0, heroes[id].health - (option.loss[id] ?? 0)) }}/{{ heroes[id].maxHealth }})</small></span>
        </span>
        <span v-if="option.lethal" class="ac-lethal"><Skull :size="16" aria-hidden="true" />Смертельно для героя</span>
        <span v-else-if="!option.loss" class="ac-unknown">Броня исчезнет раньше этого удара</span>
      </button>
    </div>
    <footer><button class="game-button game-button--quiet" @click="emit('cancel')">Отмена</button></footer>
  </dialog>
</template>

<style scoped>
.ac{width:min(760px,94vw);padding:var(--sp-4) var(--sp-5);border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-wood);color:var(--ink);box-shadow:var(--shadow-4)}
.ac::backdrop{background:#101919cc}
h2{margin:0 0 var(--sp-2);font:700 var(--fs-2xl) var(--font-display);color:var(--parch-1)}
.ac-note{margin:0 0 var(--sp-3);color:var(--muted);font:600 var(--fs-sm)/1.4 var(--font-ui)}
.ac-options{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)}
.ac-option{display:grid;gap:var(--sp-2);align-content:start;padding:var(--sp-3);border:var(--border-panel);border-radius:var(--shape-scroll);background:var(--mat-quiet);color:var(--ink);text-align:left;cursor:pointer;font:600 var(--fs-md) var(--font-ui);transition:transform var(--dur-fast),filter var(--dur-fast)}
.ac-option:hover{transform:translateY(-2px);filter:brightness(1.12)}
.ac-option:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset);border-color:var(--brass-1)}
.ac-title{display:flex;align-items:center;gap:var(--sp-2);font:700 var(--fs-lg) var(--font-display);color:var(--parch-1)}
.ac-title small{margin-left:auto;padding:1px 8px;border-radius:var(--r-pill);background:#0006;color:var(--muted);font:700 var(--fs-xs) var(--font-ui)}
.ac-row{display:grid;grid-template-columns:1fr auto auto;align-items:baseline;gap:var(--sp-2);padding:4px 0;border-top:1px solid #ffffff18}
.ac-hero{font:700 var(--fs-sm) var(--font-ui)}
.ac-armor{font:700 var(--fs-md) var(--font-num);color:var(--c-armor)}.ac-armor.is-none{color:var(--muted);font-weight:500}
.ac-loss{min-width:7em;text-align:right;font:700 var(--fs-md) var(--font-num);color:var(--c-heal)}.ac-loss.is-hit{color:var(--c-health)}.ac-loss small{font:500 var(--fs-xs) var(--font-ui);color:var(--muted)}
.ac-lethal{display:flex;align-items:center;gap:var(--sp-1);padding:2px var(--sp-2);border-radius:var(--r-1);background:#ff6a3d33;color:var(--parch-1);font:800 var(--fs-xs) var(--font-ui)}
.ac-unknown{color:var(--muted);font:600 var(--fs-xs) var(--font-ui)}
.is-lethal{border-color:var(--c-threat)}
footer{display:flex;justify-content:flex-end;margin-top:var(--sp-3)}
@media(max-width:620px){.ac-options{grid-template-columns:1fr}}
</style>
