<script setup lang="ts">
// Hand tile: the card reduced to what decides a choice at a glance — name, cost, class and the main numbers.
// Sized in `em` (tile = 7.2em × 10em); the full SpellCard opens on hover/focus. Same colours and soft shapes as the full card.
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
const locked = computed(() => props.block?.kind === 'mana')
const bonus = computed(() => !props.block && props.preview.bonusDamage > 0)
const style = computed(() => classThemeStyle(props.card.className))
</script>

<template>
  <span class="tc" :class="[`tc--${theme.ornament}`, { 'is-locked': locked, 'is-dim': block?.kind === 'phase', 'is-bonus': bonus }]" :style="style" :data-card-class="theme.id">
    <span class="tc-art">
      <img :src="cardArt[card.id]" alt="" draggable="false" />
      <span class="tc-marks"><CardGlyph v-for="tag in face.tags" :key="tag.id" :kind="tag.glyph" /></span>
      <CardGlyph v-if="locked" kind="lock" class="tc-lock" />
    </span>
    <span class="tc-cost" aria-hidden="true">{{ card.cost }}</span>
    <span class="tc-name">{{ card.name }}</span>
    <span class="tc-stats">
      <span v-for="(chip, i) in face.chips" :key="i" class="chip" :class="['chip--' + chip.kind, { 'is-boosted': chip.boosted, 'is-inactive': chip.inactive }]"><CardGlyph :kind="chip.kind" /><b>{{ chip.value }}</b></span>
    </span>
    <span class="tc-foot"><kbd v-if="hotkey">{{ hotkey }}</kbd><i class="tc-emblem"><img :src="theme.emblem" alt="" draggable="false" /></i><span>{{ theme.label }}</span></span>
  </span>
</template>

<style scoped>
.tc{position:relative;display:grid;grid-template-rows:3.1em 2.5em 2.1em 1.3em;width:7.2em;height:10em;padding:.3em;border-radius:1.1em .9em 1.2em 1em/.95em 1.15em .9em 1.2em;background:linear-gradient(145deg,color-mix(in srgb,var(--class-accent) 55%,#fff),var(--class-primary) 30%,color-mix(in srgb,var(--class-accent) 70%,#000) 60%,color-mix(in srgb,var(--class-primary) 60%,#000));box-shadow:0 .3em .6em #0a181a99,inset 0 .1em .1em #fff7,inset 0 -.15em .25em #0006;color:var(--parch-ink);text-align:left;font-family:var(--font-ui)}
.tc--arcane{border-radius:1.6em 1.6em 1.1em 1.2em/1.5em 1.7em 1.2em 1.1em}
.tc>*{pointer-events:none}
.tc-art{position:relative;display:block;overflow:hidden;border-radius:.8em .7em .3em .3em;background:var(--class-surface);border:.1em solid color-mix(in srgb,var(--class-accent) 80%,#fff)}
.tc--arcane .tc-art{border-radius:1.2em 1.2em .3em .3em}
.tc-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 45%}
.tc-marks{position:absolute;right:.2em;top:.2em;display:flex;gap:.15em}
.tc-marks .glyph{width:1.25em;height:1.25em;padding:.2em;border-radius:50%;background:#1b1210d0;color:var(--c-vulnerable)}
.tc-marks .glyph--exhaust{color:var(--muted)}
.tc-lock{position:absolute;left:50%;top:50%;width:1.6em;height:1.6em;translate:-50% -50%;padding:.3em;border-radius:50%;background:#1b1210e0;color:var(--c-health)}
.tc-cost{position:absolute;z-index:2;left:-.35em;top:-.35em;display:grid;place-items:center;width:1.9em;height:1.9em;border-radius:50%;background:var(--c-mana-deep);border:.12em solid var(--brass-1);box-shadow:0 .12em .25em #000a;color:#fff;font:700 1.15em/1 var(--font-num)}
.tc-name{display:grid;place-items:center;padding:.1em .2em 0;background:linear-gradient(165deg,var(--parch-1),var(--parch-2));text-align:center;font:700 .98em/1.05 var(--font-display);color:var(--parch-ink)}
.tc-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;align-content:center;padding:.3em .25em}
.tc-stats{display:flex;align-items:center;justify-content:center;gap:.25em;background:linear-gradient(165deg,var(--parch-1),var(--parch-2));padding-bottom:.15em}
.chip{display:inline-flex;align-items:center;gap:.2em;padding:.15em .45em .15em .25em;border-radius:var(--r-pill);background:linear-gradient(180deg,var(--wood-2),var(--wood-1));border:.08em solid var(--brass-3);color:var(--ink)}
.chip .glyph{width:1.2em;height:1.2em;padding:.18em;border-radius:50%;color:#fff;background:var(--chip-c)}
.chip b{font:700 1.45em/1 var(--font-num)}
.chip--damage{--chip-c:var(--c-health)}.chip--armor{--chip-c:var(--c-armor-deep)}.chip--draw{--chip-c:var(--brass-3)}.chip--bleeding{--chip-c:var(--c-ghost-threat-b)}
.chip.is-boosted{border-color:var(--c-bonus)}.chip.is-boosted b{color:var(--c-bonus)}
.chip.is-inactive{opacity:.55;border-style:dashed}
.tc-foot{display:flex;align-items:center;gap:.3em;padding:.1em .3em 0;border-radius:0 0 .6em .6em;background:linear-gradient(165deg,var(--parch-2),var(--parch-2));font:800 .62em/1 var(--font-ui);letter-spacing:var(--ls-caps);color:color-mix(in srgb,var(--class-primary) 70%,var(--parch-ink))}
.tc--arcane .tc-foot{border-radius:0 0 .9em .9em}
.tc-foot kbd{display:inline-grid;place-items:center;min-width:1.5em;height:1.5em;border-radius:var(--r-1);border:.08em solid var(--brass-3);background:var(--wood-1);color:var(--ink);font:700 1.05em/1 var(--font-num)}
.tc-emblem{display:grid;place-items:center;width:1.7em;height:1.7em;padding:.25em;border-radius:50%;background:var(--class-surface);border:.1em solid var(--class-accent)}
.tc-emblem img{width:100%;height:100%;display:block}
.is-locked{filter:saturate(.45) brightness(.8)}
.is-locked .tc-cost{background:#4b4249;color:var(--c-health);border-color:var(--c-health)}
.is-dim{filter:saturate(.7) brightness(.88)}
.is-bonus{box-shadow:0 0 0 .12em var(--c-bonus),var(--glow-bonus),0 .3em .6em #0a181a99}
</style>
