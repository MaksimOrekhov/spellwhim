<script setup lang="ts">
// Hand tile: a miniature of the full card. The illustration fills the top, the title sits on it, and a thin strip below keeps
// only what decides a choice at a glance — the main numbers. Sized in `em` (tile = 7.2em × 11em); the full SpellCard opens on hover/focus.
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import { cardFace } from '../ui/cardDisplay'
import type { CardBlock } from '../ui/cardDisplay'
import { cardArt } from '../ui/cardArt'
import CardGlyph from './CardGlyph.vue'

const props = defineProps<{ card: CardDefinition; preview: CardPreview; block?: CardBlock | null; hotkey?: string }>()
const theme = computed(() => getClassTheme(props.card.className))
const face = computed(() => cardFace(props.card, props.preview))
const artUrl = computed(() => cardArt[props.card.id])
const locked = computed(() => props.block?.kind === 'mana')
const bonus = computed(() => !props.block && props.preview.bonusDamage > 0)
/** Titles wrap to two lines on a tile; a very long single word shrinks instead of being cut. */
const nameSize = computed(() => Math.max(...props.card.name.split(' ').map(word => word.length)) > 11 ? .76 : .9)
const style = computed(() => ({ ...classThemeStyle(props.card.className), '--name-size': nameSize.value + 'em' }))
</script>

<template>
  <span class="tc" :class="[`tc--${theme.ornament}`, { 'is-locked': locked, 'is-dim': block?.kind === 'phase', 'is-bonus': bonus }]" :style="style" :data-card-class="theme.id">
    <span class="tc-body">
      <span class="tc-art">
        <img v-if="artUrl" :src="artUrl" alt="" draggable="false" />
        <span v-else class="tc-art-pending" aria-label="Иллюстрация ожидает утверждения">Арт ожидает утверждения</span>
        <span class="tc-shade"></span>
        <kbd v-if="hotkey" class="tc-key">{{ hotkey }}</kbd>
        <span v-if="face.tags.length" class="tc-marks"><CardGlyph v-for="tag in face.tags" :key="tag.id" :kind="tag.glyph" /></span>
        <CardGlyph v-if="locked" kind="lock" class="tc-lock" />
        <span class="tc-name">{{ card.name }}</span>
      </span>
      <span class="tc-stats">
        <span v-for="(chip, i) in face.chips" :key="i" class="chip" :class="['chip--' + chip.kind, { 'is-boosted': chip.boosted, 'is-inactive': chip.inactive }]"><CardGlyph :kind="chip.kind" /><b>{{ chip.value }}</b></span>
        <span v-if="!face.chips.length" class="tc-class"><i class="tc-emblem"><img :src="theme.emblem" alt="" draggable="false" /></i></span>
      </span>
    </span>
    <span v-if="card.upgrade" class="tc-upgrade" aria-label="Улучшена">↑</span>
    <span class="tc-cost" aria-hidden="true">{{ card.cost }}</span>
  </span>
</template>

<style scoped>
.tc{position:relative;display:block;width:7.2em;height:11em;padding:.28em;border-radius:1.1em .9em 1.2em 1em/.95em 1.15em .9em 1.2em;background:linear-gradient(145deg,color-mix(in srgb,var(--class-accent) 55%,#fff),var(--class-primary) 30%,color-mix(in srgb,var(--class-accent) 70%,#000) 60%,color-mix(in srgb,var(--class-primary) 60%,#000));box-shadow:0 .3em .6em #0a181a99,inset 0 .1em .1em #fff7,inset 0 -.15em .25em #0006;color:var(--parch-ink);text-align:left;font-family:var(--font-ui)}
.tc--arcane{border-radius:1.6em 1.6em 1.1em 1.2em/1.5em 1.7em 1.2em 1.1em}
.tc>*{pointer-events:none}
.tc-body{position:relative;display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;border-radius:.85em .7em .9em .75em/.75em .9em .7em .9em;background:var(--class-surface)}
.tc--arcane .tc-body{border-radius:1.3em 1.3em .9em .9em}
.tc-art{position:relative;display:block;flex:1;min-height:0;overflow:hidden;background:var(--class-surface)}
.tc-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 55%}
.tc-art-pending{position:absolute;inset:0;display:grid;place-items:center;padding:.35em;background:var(--class-surface);color:var(--class-accent);font:800 .58em/1.05 var(--font-ui);letter-spacing:.025em;text-align:center;text-transform:uppercase}
.tc-shade{position:absolute;inset:0;background:linear-gradient(#0000 38%,#000d 100%)}
.tc-key{position:absolute;right:.25em;top:.25em;display:grid;place-items:center;min-width:1.5em;height:1.5em;border-radius:var(--r-1);border:.08em solid var(--brass-3);background:#1b1210cc;color:var(--ink);font:700 .78em/1 var(--font-num)}
.tc-marks{position:absolute;right:.25em;top:2em;display:flex;flex-direction:column;gap:.2em}
.tc-marks .glyph{width:1.3em;height:1.3em;padding:.2em;border-radius:50%;background:#1b1210d0;color:var(--c-vulnerable)}
.tc-marks .glyph--exhaust{color:var(--muted)}
.tc-lock{position:absolute;left:50%;top:38%;width:1.8em;height:1.8em;translate:-50% -50%;padding:.32em;border-radius:50%;background:#1b1210e0;color:var(--c-health)}
.tc-cost{position:absolute;z-index:2;left:-.35em;top:-.35em;display:grid;place-items:center;width:2em;height:2em;border-radius:50%;background:var(--c-mana-deep);border:.12em solid var(--brass-1);box-shadow:0 .12em .25em #000a;color:#fff;font:700 1.2em/1 var(--font-num)}
.tc-name{position:absolute;left:.25em;right:.25em;bottom:.3em;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;text-align:center;font:700 var(--name-size,.9em)/1.05 var(--font-display);color:#fff7e3;text-shadow:0 .06em .1em #000,0 0 .4em #000}
.tc-stats{flex:none;display:flex;align-items:center;justify-content:center;gap:.25em;height:2.5em;background:linear-gradient(165deg,var(--parch-1),var(--parch-2));box-shadow:inset 0 .12em .2em #5b3d1a44}
.chip{display:inline-flex;align-items:center;gap:.2em;padding:.12em .45em .12em .22em;border-radius:var(--r-pill);background:linear-gradient(180deg,var(--wood-2),var(--wood-1));border:.08em solid var(--brass-3);color:var(--ink)}
.chip .glyph{width:1.2em;height:1.2em;padding:.18em;border-radius:50%;color:#fff;background:var(--chip-c)}
.chip b{font:700 1.45em/1 var(--font-num)}
.chip--damage{--chip-c:var(--c-health)}.chip--armor{--chip-c:var(--c-armor-deep)}.chip--draw{--chip-c:var(--brass-3)}.chip--bleeding{--chip-c:var(--c-ghost-threat-b)}
.chip.is-boosted{border-color:var(--c-bonus)}.chip.is-boosted b{color:var(--c-bonus)}
.chip.is-inactive{opacity:.55;border-style:dashed}
.tc-emblem{display:grid;place-items:center;width:1.7em;height:1.7em;padding:.25em;border-radius:50%;background:var(--class-surface);border:.1em solid var(--class-accent)}
.tc-emblem img{width:100%;height:100%;display:block}
.is-locked{filter:saturate(.45) brightness(.8)}
.is-locked .tc-cost{background:#4b4249;color:var(--c-health);border-color:var(--c-health)}
.is-dim{filter:saturate(.7) brightness(.88)}
.is-bonus{box-shadow:0 0 0 .12em var(--c-bonus),var(--glow-bonus),0 .3em .6em #0a181a99}
.tc-upgrade{position:absolute;z-index:4;left:2.5em;top:0;display:grid;place-items:center;width:1.5em;height:1.5em;border-radius:var(--r-pill);background:var(--brass-1);border:.1em solid var(--brass-4);color:var(--parch-ink);font:900 1em/1 var(--font-ui);box-shadow:var(--shadow-1)}
</style>
