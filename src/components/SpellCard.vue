<script setup lang="ts">
// The one card face used by the hand and the reward screen. Purely presentational and sized in `em`:
// the parent sets font-size (card = 12em × 16.6em), so the same object scales from a 160px hand card to a 270px reward card.
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import { cardFace } from '../ui/cardDisplay'
import type { CardBlock } from '../ui/cardDisplay'
import { cardArt } from '../ui/cardArt'
import CardGlyph from './CardGlyph.vue'

const props = defineProps<{
  card: CardDefinition
  preview: CardPreview
  /** Why the card cannot be played now; null when playable. */
  block?: CardBlock | null
  hotkey?: string
  /** Fraction of the card not covered by its right-hand neighbour (1 = fully visible). Keeps the name and the main number inside the visible strip. */
  vis?: number
}>()
const theme = computed(() => getClassTheme(props.card.className))
const face = computed(() => cardFace(props.card, props.preview))
const locked = computed(() => props.block?.kind === 'mana')
const bonus = computed(() => !props.block && props.preview.bonusDamage > 0)
const dense = computed(() => (props.vis ?? 1) < 0.9)
const style = computed(() => ({ ...classThemeStyle(props.card.className), '--vis': String(props.vis ?? 1) }))
</script>

<template>
  <span class="sc" :class="[`sc--${theme.ornament}`, { 'is-locked': locked, 'is-dim': block?.kind === 'phase', 'is-bonus': bonus, 'is-dense': dense }]" :style="style" :data-card-class="theme.id">
    <span class="sc-rim" aria-hidden="true"></span>
    <span class="sc-body">
      <span class="sc-art">
        <img :src="cardArt[card.id]" alt="" draggable="false" />
        <span class="sc-shade"></span>
        <span v-if="locked" class="sc-lock"><CardGlyph kind="lock" /> нужно {{ card.cost }}</span>
      </span>
      <span class="sc-plate"><strong class="sc-name">{{ card.name }}</strong></span>
      <span class="sc-lower">
        <span class="sc-stats">
          <span v-for="(chip, i) in face.chips" :key="i" class="chip" :class="['chip--' + chip.kind, { 'is-boosted': chip.boosted, 'is-inactive': chip.inactive }]">
            <i class="chip-disc"><CardGlyph :kind="chip.kind" /></i>
            <b class="chip-num">{{ chip.value }}</b>
            <small class="chip-cap">{{ chip.caption }}</small>
            <CardGlyph v-if="chip.boosted" kind="bonus" class="chip-up" />
          </span>
        </span>
        <span class="sc-rules">
          <span v-for="(line, i) in face.lines" :key="'l' + i" class="rule" :class="'rule--' + line.tone"><CardGlyph v-if="line.glyph" :kind="line.glyph" /><span>{{ dense ? line.short : line.text }}</span></span>
          <span v-if="face.tags.length" class="sc-tags"><span v-for="tag in face.tags" :key="tag.id" class="tag" :class="'tag--' + tag.id"><CardGlyph :kind="tag.glyph" /><span>{{ dense ? tag.short : tag.text }}</span></span></span>
        </span>
        <span class="sc-foot">
          <kbd v-if="hotkey">{{ hotkey }}</kbd>
          <span class="sc-class"><i class="sc-emblem"><img :src="theme.emblem" alt="" draggable="false" /></i>{{ theme.label }}</span>
        </span>
      </span>
    </span>
    <span class="sc-cost" aria-hidden="true"><b>{{ card.cost }}</b></span>
  </span>
</template>

<style scoped>
/* Geometry is identical for every class; class identity comes from colour, material and ornament (rivets for the warrior, a gem and an arch for the mage). No clip-path, no sharp corners. */
.sc{--pad-r:max(.6em,calc(11.9em - 12em * var(--vis,1)));--paper:color-mix(in srgb,var(--parch-1) 84%,var(--class-secondary));--paper-2:color-mix(in srgb,var(--parch-2) 80%,var(--class-secondary));position:relative;display:block;width:12em;height:16.6em;color:var(--parch-ink);text-align:left;font-family:var(--font-ui);text-shadow:none}
.sc>*{pointer-events:none}
.sc-rim{position:absolute;inset:0;display:block;border-radius:1.5em 1.25em 1.6em 1.3em/1.3em 1.5em 1.25em 1.6em;background:linear-gradient(145deg,color-mix(in srgb,var(--class-accent) 55%,#fff) 0%,var(--class-primary) 24%,color-mix(in srgb,var(--class-accent) 72%,#000) 52%,color-mix(in srgb,var(--class-primary) 62%,#000) 100%);box-shadow:0 .35em .8em #0a181ab0,inset 0 .1em .12em #fff7,inset 0 -.18em .3em #0006,0 0 0 .08em color-mix(in srgb,var(--class-surface) 80%,#000)}
.sc--arcane .sc-rim{border-radius:2.2em 2.2em 1.4em 1.5em/2em 2.3em 1.5em 1.4em}
.sc--angular .sc-rim::before,.sc--angular .sc-rim::after{position:absolute;top:8.6em;width:.36em;height:.36em;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--brass-1),var(--brass-2) 55%,var(--brass-4));box-shadow:0 .06em .1em #000a;content:""}
.sc--angular .sc-rim::before{left:.04em}.sc--angular .sc-rim::after{right:.04em}
.sc--arcane .sc-rim::after{position:absolute;top:-.2em;left:50%;width:.8em;height:.8em;translate:-50% 0;border-radius:50% 50% 48% 48%/42% 42% 58% 58%;background:radial-gradient(circle at 35% 30%,#fff,var(--class-secondary) 55%,var(--class-primary));box-shadow:0 0 .6em .1em var(--class-secondary);content:""}
.sc-body{position:absolute;inset:.45em;display:flex;flex-direction:column;overflow:hidden;border-radius:1.15em .95em 1.25em 1em/1em 1.15em .95em 1.25em;background:linear-gradient(175deg,color-mix(in srgb,var(--class-primary) 38%,var(--class-surface)),var(--class-surface) 50%,color-mix(in srgb,var(--class-surface) 68%,#000));box-shadow:inset 0 0 1.2em #000a}
.sc--arcane .sc-body{border-radius:1.9em 1.9em 1.1em 1.2em/1.7em 2em 1.2em 1.1em}
.sc-art{position:relative;display:block;flex:none;height:5.6em;overflow:hidden;border-bottom:.14em solid color-mix(in srgb,var(--class-accent) 82%,#fff);background:var(--class-surface)}
.sc-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 45%}
.sc-shade{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#0000 58%,#0006),linear-gradient(#0000 62%,#000a)}
.sc-lock{position:absolute;left:50%;top:50%;z-index:2;display:flex;align-items:center;gap:.35em;translate:-50% -50%;padding:.3em .8em;border-radius:var(--r-pill);background:#1b1210e0;border:.1em solid var(--c-health);color:var(--ink);font:800 .85em/1 var(--font-ui);white-space:nowrap}
.sc-lock .glyph{width:1.05em;height:1.05em;color:var(--c-health)}
.sc-plate{position:relative;z-index:2;flex:none;display:grid;place-items:center;height:2.4em;margin:-1.2em .35em 0;padding:0 var(--pad-r) 0 .45em;border-radius:var(--shape-chip);border:.1em solid color-mix(in srgb,var(--class-accent) 80%,#fff);background:linear-gradient(180deg,color-mix(in srgb,var(--class-primary) 78%,var(--class-surface)),color-mix(in srgb,var(--class-primary) 40%,var(--class-surface)));box-shadow:0 .2em .35em #0008,inset 0 .1em .1em #fff5;color:var(--ink)}
.sc--arcane .sc-plate{background:linear-gradient(180deg,color-mix(in srgb,var(--class-primary) 58%,var(--class-surface)),color-mix(in srgb,var(--class-accent) 34%,var(--class-surface)))}
.sc-name{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;text-align:center;text-wrap:balance;font:700 1.1em/1.04 var(--font-display);text-shadow:0 .08em .12em #000a}
.is-dense .sc-name{font-size:.88em}
.sc-lower{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;margin-top:-1.15em;padding:1.3em .6em .3em .55em;background:linear-gradient(165deg,var(--paper),var(--paper-2));box-shadow:inset 0 .12em .3em #5b3d1a55}
.sc-stats{flex:none;display:flex;align-items:flex-start;justify-content:center;gap:.5em;height:2.9em;padding-right:calc(var(--pad-r) - .6em)}
.is-dense .sc-stats{justify-content:flex-start}
.is-dense .rule>span,.is-dense .tag>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.is-dense .sc-plate{padding-left:.2em}
/* Narrow visible strip: chips shrink to icon + number so two of them still fit; the caption returns when the card is zoomed. */
.is-dense .chip{min-width:0;column-gap:.2em;padding:.18em .4em .18em .2em}
.is-dense .chip-cap{display:none}
.is-dense .chip-disc{width:1.25em;height:1.25em}.is-dense .chip-disc .glyph{width:.8em;height:.8em}
.is-dense .chip-num{font-size:1.45em}
.is-dense .sc-stats{gap:.35em}
.chip{position:relative;display:grid;grid-template-columns:auto auto;align-items:center;justify-content:center;column-gap:.3em;min-width:4.1em;padding:.18em .5em .1em .22em;border-radius:var(--shape-chip);background:linear-gradient(180deg,var(--wood-2),var(--wood-1));border:.1em solid var(--brass-3);box-shadow:inset 0 .08em .1em #fff3,0 .12em .2em #0006;color:var(--ink)}
.chip-disc{display:grid;place-items:center;width:1.55em;height:1.55em;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--chip-c) 55%,#fff),var(--chip-c) 60%,color-mix(in srgb,var(--chip-c) 60%,#000));color:#fff;font-size:1em;box-shadow:inset 0 -.1em .15em #0005}
.chip-disc .glyph{width:.95em;height:.95em}
.chip-num{font:700 1.65em/1 var(--font-num);text-shadow:0 .06em .1em #000a}
.chip-cap{grid-column:1/-1;margin-top:.05em;font:800 .62em/1.1 var(--font-ui);letter-spacing:.06em;text-align:center;text-transform:uppercase;color:var(--text-dim);white-space:nowrap}
.chip--damage{--chip-c:var(--c-health)}.chip--armor{--chip-c:var(--c-armor-deep)}.chip--draw{--chip-c:var(--brass-3)}
.chip.is-boosted{border-color:var(--c-bonus);box-shadow:inset 0 .08em .1em #fff3,var(--glow-bonus)}
.chip.is-boosted .chip-num{color:var(--c-bonus)}
.chip-up{position:absolute;right:-.3em;top:-.4em;width:1em;height:1em;padding:.1em;border-radius:50%;background:var(--c-bonus);color:var(--parch-ink)}
.chip.is-inactive{opacity:.55;border-style:dashed;filter:saturate(.5)}
.sc-rules{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:.2em;overflow:hidden;padding-right:calc(var(--pad-r) - .6em)}
.rule{display:flex;align-items:flex-start;gap:.3em;min-width:0;font:800 .74em/1.15 var(--font-ui);color:var(--parch-ink)}
.rule .glyph{margin-top:.04em;width:1.1em;height:1.1em}
.rule--on{padding:.08em .4em .08em .25em;border-radius:var(--shape-chip);background:color-mix(in srgb,var(--c-bonus) 50%,transparent);color:color-mix(in srgb,var(--parch-ink) 85%,var(--c-health-deep))}
.rule--on .glyph--armor{color:var(--c-armor-deep)}.rule--on .glyph--vulnerable{color:color-mix(in srgb,var(--c-vulnerable) 60%,#5a2a00)}.rule--on .glyph--damage{color:var(--c-health-deep)}
.rule--off{opacity:.62;font-weight:700}
.sc-tags{display:flex;flex-wrap:wrap;gap:.25em}
.tag{display:inline-flex;align-items:center;gap:.25em;padding:.1em .5em .1em .3em;border-radius:var(--r-pill);border:.08em solid color-mix(in srgb,var(--class-accent) 70%,var(--parch-ink));background:color-mix(in srgb,var(--class-accent) 20%,transparent);font:800 .66em/1.2 var(--font-ui);color:var(--parch-ink);white-space:nowrap}
.tag .glyph{width:1.1em;height:1.1em}
.tag--vulnerability .glyph{color:color-mix(in srgb,var(--c-vulnerable) 60%,#5a2a00)}
.sc-foot{flex:none;display:flex;align-items:center;gap:.45em;height:1.4em;margin-top:.15em;border-top:.07em solid color-mix(in srgb,var(--parch-ink-soft) 35%,transparent);padding-top:.2em}
.sc-foot kbd{display:inline-grid;place-items:center;min-width:1.35em;height:1.35em;border-radius:var(--r-1);border:.08em solid var(--brass-3);background:var(--wood-1);color:var(--ink);font:700 .7em/1 var(--font-num)}
.sc-class{display:flex;align-items:center;gap:.35em;font:800 .64em/1 var(--font-ui);letter-spacing:var(--ls-caps);color:color-mix(in srgb,var(--class-primary) 70%,var(--parch-ink))}
.sc-emblem{display:grid;place-items:center;width:1.9em;height:1.9em;padding:.28em;border-radius:50%;background:var(--class-surface);border:.1em solid var(--class-accent)}
.sc-emblem img{width:100%;height:100%;display:block}
.sc-cost{position:absolute;z-index:3;left:-.45em;top:-.45em;display:grid;place-items:center;width:2.7em;height:2.7em;border-radius:var(--shape-medallion);background:var(--mat-gem-mana);border:.14em solid var(--brass-1);box-shadow:0 .2em .4em #000a,inset 0 .1em .15em #fff9,inset 0 -.2em .3em #0b2a6a88,var(--glow-mana);color:#fff}
.sc-cost b{font:700 1.6em/1 var(--font-num);text-shadow:0 .06em .1em #0b2a6a}
.is-locked .sc-rim,.is-locked .sc-body{filter:saturate(.45) brightness(.78)}
.is-locked .sc-cost{background:linear-gradient(150deg,#8a7f86,#4b4249);box-shadow:0 .2em .4em #000a,inset 0 .1em .15em #fff6;border-color:var(--c-health)}
.is-locked .sc-cost b{color:var(--c-health);text-shadow:0 .06em .1em #000}
.is-dim .sc-rim,.is-dim .sc-body{filter:saturate(.7) brightness(.85)}
.is-bonus .sc-rim{box-shadow:0 0 0 .14em var(--c-bonus),var(--glow-bonus),0 .35em .8em #0a181ab0,inset 0 .1em .12em #fff7}
</style>
