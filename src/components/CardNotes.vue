<script setup lang="ts">
// Parchment "scroll" with everything the small card cannot say: verbatim rules, the exact damage sum,
// who receives armor, every condition and keyword. Used beside the zoomed hand card and under reward cards.
import { computed } from 'vue'
import type { CardDefinition, CardPreview, HeroId } from '../game/types'
import { cardNotes } from '../ui/cardDisplay'
import type { CardBlock } from '../ui/cardDisplay'
import { classThemeStyle } from '../game/classThemes'
import CardGlyph from './CardGlyph.vue'
import { useRules } from '../ui/rulesInfo'

/** `idleArmor`: heroes the enemy does not hit this turn, so armor given to them now expires unused (board only). */
const props = defineProps<{ card: CardDefinition; preview: CardPreview; block?: CardBlock | null; hotkey?: string; mode?: 'play' | 'choose' | 'inspect'; brief?: boolean; idleArmor?: HeroId[] }>()
const neutral = computed(() => props.mode === 'choose' || props.mode === 'inspect')
const rules = useRules()
const notes = computed(() => cardNotes(props.card, props.preview, neutral.value ? 'neutral' : 'board', rules.armorExpires, props.idleArmor))
const footer = computed(() => props.block?.text ?? (props.mode === 'choose' ? 'Нажмите, чтобы взять карту.' : `Нажмите или клавиша ${props.hotkey ?? ''} — разыграть.`))
</script>

<template>
  <aside class="notes" :class="{ 'notes--brief': brief }" :style="classThemeStyle(card.className)">
    <header><strong v-if="!neutral">{{ notes.title }}</strong><small>{{ notes.subtitle }}</small></header>
    <p class="notes-text">{{ notes.description }}</p>
    <div v-if="notes.damage" class="notes-math notes-math--damage">
      <CardGlyph kind="damage" />
      <span>Урон <b :class="{ hot: notes.damage.parts.length > 1 }">{{ notes.damage.total }}</b></span>
      <ul v-if="notes.damage.parts.length > 1" class="notes-sum" aria-label="Из чего складывается урон">
        <li v-for="part in notes.damage.parts" :key="part.kind" :class="'part--' + part.kind"><span>{{ part.label }}</span><b>{{ part.kind === 'base' ? part.amount : '+' + part.amount }}</b></li>
      </ul>
      <small v-if="!neutral" class="notes-sub">Враг: {{ notes.damage.armorDamage ? `броня −${notes.damage.armorDamage}, ` : '' }}здоровье −{{ notes.damage.healthDamage }}</small>
    </div>
    <p v-for="item in notes.armor" :key="item.hero" class="notes-math notes-math--armor"><CardGlyph kind="armor" /><span>Броня: {{ item.name }} <b>+{{ item.amount }}</b></span></p>
    <p v-if="notes.statusDamage" class="notes-math"><CardGlyph kind="bleeding" /><span>Кровотечение сейчас: <b>{{ notes.statusDamage }}</b> здоровья</span></p>
    <p v-if="notes.statusFuture" class="notes-cond">Кровотечение добавит со временем до {{ notes.statusFuture }} урона.</p>
    <p v-if="notes.stopsAfterDamage" class="notes-cond">Смертельный урон завершит бой; последующие эффекты не выполнятся.</p>
    <p v-if="notes.draw" class="notes-math notes-math--draw"><CardGlyph kind="draw" /><span>Добор: <b>{{ notes.draw }}</b></span></p>
    <p v-for="(line, i) in (neutral ? notes.conditions.filter(item => item.tone === 'on') : notes.conditions)" :key="'c' + i" class="notes-cond" :class="'notes-cond--' + line.tone"><CardGlyph v-if="line.glyph" :kind="line.glyph" /><span>{{ line.text }}</span></p>
    <dl v-if="notes.keywords.length" class="notes-keys">
      <div v-for="key in notes.keywords" :key="key.name"><dt><CardGlyph :kind="key.glyph" />{{ key.name }}</dt><dd>{{ key.text }}</dd></div>
    </dl>
    <footer v-if="mode !== 'inspect'" :class="{ bad: !!block }">{{ footer }}</footer>
  </aside>
</template>

<style scoped>
.notes{box-sizing:border-box;width:100%;padding:.95em 1.1em .8em;border-radius:var(--shape-scroll);background:var(--mat-parchment);box-shadow:var(--shadow-3),inset 0 0 1.6em #8a622c66,0 0 0 .14em var(--brass-3),0 0 0 .26em var(--wood-1);color:var(--parch-ink);font:var(--fw-semibold) 1em/1.3 var(--font-ui);text-align:left}
header{display:flex;flex-direction:column;gap:.1em;margin-bottom:.45em;padding-bottom:.4em;border-bottom:.08em solid color-mix(in srgb,var(--class-primary) 45%,#8a622c88)}
header strong{font:var(--fw-bold) 1.2em/1.15 var(--font-display);color:color-mix(in srgb,var(--class-primary) 50%,var(--parch-ink))}
header small{font:var(--fw-bold) .68em/1.2 var(--font-ui);letter-spacing:.1em;text-transform:uppercase;color:color-mix(in srgb,var(--class-primary) 40%,var(--parch-ink-soft))}
.notes-text{margin:0 0 .45em;font-size:.92em;line-height:1.35}
.notes-math{display:flex;flex-wrap:wrap;align-items:center;gap:.1em .45em;margin:.3em 0 0;font:var(--fw-bold) .92em/1.2 var(--font-ui)}
.notes-math>.glyph{width:1.3em;height:1.3em}
.notes-math b{font:var(--fw-semibold) 1.5em/1 var(--font-num)}
.notes-math--damage{color:var(--c-health-deep)}.notes-math--armor{color:var(--c-armor-deep)}.notes-math--draw{color:var(--brass-4)}
.notes-math b.hot{color:#9a5200;text-shadow:0 0 .5em var(--c-bonus)}
.notes-sum{flex-basis:100%;margin:.2em 0 0;padding:.4em .6em;border-radius:var(--shape-chip);background:#fff6;list-style:none;font-size:.86em;color:var(--parch-ink)}
.notes-sum li{display:flex;justify-content:space-between;gap:1em;padding:.08em 0}
.notes-sum b{font:var(--fw-semibold) 1em/1.2 var(--font-num)}
.part--synergy b{color:#8a5a00}.part--armor b{color:var(--c-armor-deep)}.part--vulnerability b{color:#9a5200}
.notes-sub{flex-basis:100%;margin:0 0 0 1.75em;font:var(--fw-semibold) .8em/1.25 var(--font-ui);color:var(--parch-ink-soft)}
.notes-cond{display:flex;gap:.4em;margin:.4em 0 0;font-size:.82em;line-height:1.3}
.notes-cond .glyph{flex:none;width:1.25em;height:1.25em;margin-top:.05em}
.notes-cond--on{color:#3d5a1c}.notes-cond--off{color:var(--parch-ink-soft);opacity:.85}
.notes-keys{margin:.55em 0 0;display:grid;gap:.35em}
.notes-keys div{padding:.4em .6em;border-radius:var(--shape-chip);background:#fff6}
.notes-keys dt{display:flex;align-items:center;gap:.4em;font:var(--fw-bold) .82em/1.2 var(--font-ui)}
.notes-keys dt .glyph{width:1.2em;height:1.2em;color:var(--brass-4)}
.notes-keys dd{margin:.15em 0 0;font:var(--fw-semibold) .76em/1.3 var(--font-ui);color:var(--parch-ink-soft)}
/* Short screens: the scroll must not climb over the heroes, so the keyword explanations (also on the enemy portrait) fold to titles. */
.notes--brief .notes-keys dd,.notes--brief .notes-sub{display:none}
.notes--brief .notes-keys div{padding:.25em .6em}
footer{margin-top:.55em;padding-top:.4em;border-top:.08em solid #8a622c88;font:var(--fw-bold) .76em/1.3 var(--font-ui);color:#4f6d2a}
footer.bad{color:#9a2a1c}
</style>
