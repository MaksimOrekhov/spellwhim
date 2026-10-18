<script setup lang="ts">
// "Свиток" next to the zoomed card: verbatim rules text, exact damage maths, keyword glossary, and the reason a card is locked.
// Replaces the generic tooltip for cards: it is visible only on hover/focus and never covers the combatants' health.
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../../game/types'
import { statusDefinitions } from '../../game/types'
import { getClassTheme } from '../../game/classThemes'
import { damageBreakdown } from '../cardGlyphs'
import GlyphIcon from './GlyphIcon.vue'

const props = defineProps<{ card: CardDefinition; preview: CardPreview; reason: 'mana' | 'busy' | 'finished' | null; mana?: number; hotkey?: string; mode?: 'play' | 'choose' }>()
const theme = computed(() => getClassTheme(props.card.className))
const armorLines = computed(() => ([['warrior', 'Вариану'], ['mage', 'Джайне']] as const).map(([hero, name]) => ({ hero, name, amount: props.preview.armor[hero] })).filter(a => a.amount > 0))
const breakdown = computed(() => damageBreakdown(props.preview))
const keyword = computed(() => props.preview.appliedStatuses.includes('vulnerability') || props.preview.vulnerabilityBonus > 0 ? statusDefinitions.vulnerability : null)
const reasonText = computed(() => props.reason === 'mana' ? `Не хватает маны: нужно ${props.card.cost}, есть ${props.mana ?? 0}.` : props.reason === 'busy' ? 'Дождитесь окончания действия.' : props.reason === 'finished' ? 'Бой завершён.' : '')
</script>

<template>
  <aside class="notes" :style="{ '--accent': theme.accent }">
    <header><strong>{{ card.name }}</strong><small>{{ theme.name }} · {{ card.kind === 'defense' ? 'защита' : card.kind === 'spell' ? 'заклинание' : 'атака' }} · {{ card.cost }} {{ card.cost === 1 ? 'мана' : 'маны' }}</small></header>
    <p class="notes-text">{{ card.description }}</p>
    <p v-if="preview.damage > 0" class="notes-math"><GlyphIcon name="damage" /> <span>Урон <b :class="{ hot: preview.bonusDamage > 0 }">{{ preview.damage }}</b><small v-if="preview.bonusDamage > 0"> = {{ breakdown }}</small></span></p>
    <p v-if="preview.damage > 0" class="notes-sub">Враг: {{ preview.armorDamage ? `броня −${preview.armorDamage}, ` : '' }}здоровье −{{ preview.healthDamage }}</p>
    <p v-for="a in armorLines" :key="a.hero" class="notes-math notes-math--armor"><GlyphIcon name="armor" /> <span>Броня: {{ a.name }} <b>+{{ a.amount }}</b></span></p>
    <p v-if="keyword" class="notes-key"><GlyphIcon name="vulnerable" /> <span><b>{{ keyword.name }}.</b> {{ keyword.description }}</span></p>
    <p v-if="card.exhaust" class="notes-key notes-key--plain"><GlyphIcon name="exhaust" /> <span><b>Выбывает.</b> Эта копия не вернётся до конца боя.</span></p>
    <footer :class="{ bad: !!reason }">{{ reasonText || (mode === 'choose' ? 'Нажмите, чтобы взять карту в колоду' : 'Нажмите или клавиша ' + (hotkey ?? '') + ' — разыграть') }}</footer>
  </aside>
</template>

<style scoped>
.notes{--accent:#d6a65e;width:15.5em;padding:.9em 1em .8em;border-radius:1.1em 1.5em 1.2em 1.6em/1.3em 1.1em 1.6em 1.2em;background:linear-gradient(160deg,var(--parch-1),var(--parch-2));color:var(--ink);box-shadow:0 .6em 1.4em #000b,inset 0 0 1.6em #8a622c66,0 0 0 .14em var(--brass-3),0 0 0 .26em #2b1f14;font-size:1rem;line-height:1.3;text-align:left}
header{display:flex;flex-direction:column;gap:.1em;padding-bottom:.4em;margin-bottom:.45em;border-bottom:.08em solid #8a622c88}
header strong{font:800 1.12em/1.15 var(--f-display)}
header small{font:700 .66em/1.2 var(--f-ui);letter-spacing:.1em;text-transform:uppercase;color:#7a5a2c}
.notes-text{margin:0 0 .4em;font:600 .88em/1.35 var(--f-ui)}
.notes-math{display:flex;align-items:center;gap:.4em;margin:.25em 0 0;font:700 .88em/1.2 var(--f-ui);color:#7a2b18}
.notes-math svg{width:1.2em;height:1.2em;color:#b8381f}
.notes-math--armor{color:#24496e}.notes-math--armor svg{color:#3f78b5}
.notes-math b{font:800 1.4em/1 var(--f-num)}
.notes-math b.hot{color:#a85d00;text-shadow:0 0 .5em #ffd56b}
.notes-math small{font-size:.82em;font-weight:600;color:#5b3d1a}
.notes-sub{margin:.1em 0 .3em 1.7em;font:600 .74em/1.25 var(--f-ui);color:#5b3d1a}
.notes-key{display:flex;gap:.4em;margin:.45em 0 0;padding:.45em .6em;border-radius:.9em;background:#fff6;font:600 .76em/1.3 var(--f-ui)}
.notes-key svg{flex:none;width:1.4em;height:1.4em;color:#c27a0b;margin-top:.05em}
.notes-key--plain svg{color:#c2501b}
footer{margin-top:.55em;padding-top:.4em;border-top:.08em solid #8a622c88;font:700 .72em/1.3 var(--f-ui);color:#4f6d2a}
footer.bad{color:#a52b1c}
</style>
