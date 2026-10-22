<script setup lang="ts">
// The one card face used by the hand and the reward screen. Purely presentational and sized in `em`:
// the parent sets font-size (card = 12em × 16.6em), so the same object scales from a 160px hand card to a 270px reward card.
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import { cardFace, cardNameScale, kindLabel } from '../ui/cardDisplay'
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
const artUrl = computed(() => cardArt[props.card.id])
const locked = computed(() => props.block?.kind === 'mana')
const bonus = computed(() => !props.block && props.preview.bonusDamage > 0)
const simple = computed(() => !face.value.lines.length && !face.value.tags.length)
const dense = computed(() => (props.vis ?? 1) < 0.9)
/** Names are never wrapped: long ones simply shrink a little so the title stays on one line over the art. */
const nameSize = computed(() => cardNameScale(props.card.name))
const style = computed(() => ({ ...classThemeStyle(props.card.className), '--vis': String(props.vis ?? 1), '--name-size': nameSize.value + 'em' }))
</script>

<template>
  <span class="sc" :class="[`sc--${theme.ornament}`, { 'is-locked': locked, 'is-dim': block?.kind === 'phase', 'is-bonus': bonus, 'is-dense': dense, 'is-simple': simple, 'is-solo': simple && face.chips.length === 1 }]" :style="style" :data-card-class="theme.id">
    <span class="sc-rim" aria-hidden="true"></span>
    <span class="sc-body">
      <span class="sc-art">
        <img v-if="artUrl" :src="artUrl" alt="" draggable="false" />
        <span v-else class="sc-art-pending" aria-label="Иллюстрация ожидает утверждения"><small>Арт ожидает утверждения</small></span>
        <span v-if="artUrl" class="sc-shade"></span>
        <span v-if="locked" class="sc-lock"><CardGlyph kind="lock" /> нужно {{ card.cost }}</span>
        <span class="sc-plate"><strong class="sc-name">{{ card.name }}</strong></span>
      </span>
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
          <span class="sc-class"><i class="sc-emblem"><img :src="theme.emblem" alt="" draggable="false" /></i>{{ theme.label }}<template v-if="!dense"> · {{ kindLabel[card.kind] }}</template></span>
        </span>
      </span>
    </span>
    <span v-if="card.upgrade" class="sc-upgrade" aria-label="Улучшена">↑</span>
    <span class="sc-cost" aria-hidden="true"><b>{{ card.cost }}</b></span>
  </span>
</template>

<style scoped>
/* Art-first card. Geometry is identical for every class; class identity comes from colour, material and ornament (rivets for the warrior, a gem and an arch for the mage). No clip-path, no sharp corners.
   The illustration fills the top half edge to edge; the title sits on it (no plate), the parchment below curves up over the art's lower edge. */
.sc{--pad-r:max(.6em,calc(11.9em - 12em * var(--vis,1)));--art-h:8.7em;--paper:color-mix(in srgb,var(--parch-1) 84%,var(--class-secondary));--paper-2:color-mix(in srgb,var(--parch-2) 80%,var(--class-secondary));position:relative;display:block;width:12em;height:16.6em;color:var(--parch-ink);text-align:left;font-family:var(--font-ui);text-shadow:none}
.sc>*{pointer-events:none}
.sc-rim{position:absolute;inset:0;display:block;border-radius:1.5em 1.25em 1.6em 1.3em/1.3em 1.5em 1.25em 1.6em;background:linear-gradient(145deg,color-mix(in srgb,var(--class-accent) 55%,#fff) 0%,var(--class-primary) 24%,color-mix(in srgb,var(--class-accent) 72%,#000) 52%,color-mix(in srgb,var(--class-primary) 62%,#000) 100%);box-shadow:0 .35em .8em #0a181ab0,inset 0 .1em .12em #fff7,inset 0 -.18em .3em #0006,0 0 0 .08em color-mix(in srgb,var(--class-surface) 80%,#000)}
.sc--arcane .sc-rim{border-radius:2.2em 2.2em 1.4em 1.5em/2em 2.3em 1.5em 1.4em}
.sc--arcane .sc-rim::after{position:absolute;top:-.2em;left:50%;width:.8em;height:.8em;translate:-50% 0;border-radius:50% 50% 48% 48%/42% 42% 58% 58%;background:radial-gradient(circle at 35% 30%,#fff,var(--class-secondary) 55%,var(--class-primary));box-shadow:0 0 .6em .1em var(--class-secondary);content:""}
.sc--angular .sc-rim::before,.sc--angular .sc-rim::after{position:absolute;top:50%;width:.36em;height:.36em;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--brass-1),var(--brass-2) 55%,var(--brass-4));box-shadow:0 .06em .1em #000a;content:""}
.sc--angular .sc-rim::before{left:.04em}.sc--angular .sc-rim::after{right:.04em}
.sc-body{position:absolute;inset:.4em;display:flex;flex-direction:column;overflow:hidden;border-radius:1.2em 1em 1.3em 1.05em/1.05em 1.2em 1em 1.3em;background:var(--class-surface);box-shadow:inset 0 0 1.2em #000a}
.sc--arcane .sc-body{border-radius:1.9em 1.9em 1.2em 1.3em/1.7em 2em 1.3em 1.2em}
.sc-art{position:relative;display:block;flex:none;height:var(--art-h);overflow:hidden;background:var(--class-surface)}
.sc-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 55%}
.sc-art-pending{position:absolute;inset:0;display:grid;place-items:center;padding:.4em;background:var(--class-surface);color:var(--class-accent);text-shadow:none;text-align:center}
.sc-art-pending small{font:800 .72em/1.1 var(--font-ui);letter-spacing:.03em;color:var(--ink);text-transform:uppercase}
.sc-shade{position:absolute;inset:0;background:linear-gradient(#0000 52%,color-mix(in srgb,var(--class-surface) 55%,#000) 100%),radial-gradient(ellipse at 50% 42%,#0000 62%,#0005)}
.sc-lock{position:absolute;left:50%;top:42%;z-index:2;display:flex;align-items:center;gap:.35em;translate:-50% -50%;padding:.3em .8em;border-radius:var(--r-pill);background:#1b1210e0;border:.1em solid var(--c-health);color:var(--ink);font:800 .85em/1 var(--font-ui);white-space:nowrap}
.sc-lock .glyph{width:1.05em;height:1.05em;color:var(--c-health)}
.sc-plate{position:absolute;z-index:2;left:.3em;right:.3em;bottom:.95em;display:grid;place-items:center;padding:0 var(--pad-r) 0 .45em;color:#fff7e3}
.sc-name{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font:700 var(--name-size,1.1em)/1.15 var(--font-display);letter-spacing:.01em;text-shadow:0 .06em .1em #000,0 0 .5em #000c,0 .12em .5em #000a}
.is-dense .sc-name{font-size:calc(var(--name-size,1.1em) * .86)}
.sc-lower{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;margin-top:-.85em;padding:1.1em .6em .3em .55em;border-radius:1.1em 1.1em 0 0/.9em .9em 0 0;background:linear-gradient(165deg,var(--paper),var(--paper-2));box-shadow:0 -.12em .35em #0007,inset 0 .14em .1em #fff8,inset 0 -.12em .3em #5b3d1a44}
.sc--arcane .sc-lower{border-radius:1.5em 1.5em 0 0/1.2em 1.2em 0 0}
.sc-lower::before{position:absolute;left:1.4em;right:1.4em;top:.22em;height:.1em;border-radius:1em;background:linear-gradient(90deg,#0000,color-mix(in srgb,var(--class-accent) 80%,var(--parch-ink)),#0000);content:""}
.sc-stats{flex:none;display:flex;align-items:center;justify-content:center;gap:.45em;min-height:2.4em;padding-right:calc(var(--pad-r) - .6em)}
.is-dense .sc-stats{justify-content:flex-start}
.is-dense .rule>span,.is-dense .tag>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Cards with nothing but numbers: the numbers grow and sit in the middle instead of leaving empty parchment. */
.is-simple .sc-stats{flex:1;gap:.6em}
.is-solo:not(.is-dense) .chip{font-size:1.28em}
/* Narrow visible strip: chips shrink to icon + number so two of them still fit; the caption returns when the card is zoomed. */
.is-dense .chip{min-width:0;column-gap:.2em;padding:.18em .4em .18em .2em}
.is-dense .chip-cap{display:none}
.is-dense .chip-disc{width:1.25em;height:1.25em}.is-dense .chip-disc .glyph{width:.8em;height:.8em}
.is-dense .chip-num{font-size:1.45em}
.is-dense .sc-stats{gap:.35em}
.chip{position:relative;display:grid;grid-template-columns:auto auto;align-items:center;justify-content:center;column-gap:.3em;min-width:3.9em;padding:.16em .5em .08em .2em;border-radius:var(--shape-chip);background:linear-gradient(180deg,var(--wood-2),var(--wood-1));border:.1em solid var(--brass-3);box-shadow:inset 0 .08em .1em #fff3,0 .12em .2em #0006;color:var(--ink)}
.chip-disc{display:grid;place-items:center;width:1.5em;height:1.5em;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--chip-c) 55%,#fff),var(--chip-c) 60%,color-mix(in srgb,var(--chip-c) 60%,#000));color:#fff;font-size:1em;box-shadow:inset 0 -.1em .15em #0005}
.chip-disc .glyph{width:.92em;height:.92em}
.chip-num{font:700 1.65em/1 var(--font-num);text-shadow:0 .06em .1em #000a}
.chip-cap{grid-column:1/-1;margin-top:.02em;font:800 .58em/1.1 var(--font-ui);letter-spacing:.06em;text-align:center;text-transform:uppercase;color:var(--text-dim);white-space:nowrap}
.chip--damage{--chip-c:var(--c-health)}.chip--armor{--chip-c:var(--c-armor-deep)}.chip--draw{--chip-c:var(--brass-3)}.chip--bleeding{--chip-c:var(--c-ghost-threat-b)}
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
.tag--frostbite .glyph{color:color-mix(in srgb,#4ab0ff 70%,#0a2a4a)}
.sc-foot{flex:none;display:flex;align-items:center;gap:.45em;height:1.4em;margin-top:.1em;border-top:.07em solid color-mix(in srgb,var(--parch-ink-soft) 35%,transparent);padding-top:.2em}
.sc-foot kbd{display:inline-grid;place-items:center;min-width:1.35em;height:1.35em;border-radius:var(--r-1);border:.08em solid var(--brass-3);background:var(--wood-1);color:var(--ink);font:700 .7em/1 var(--font-num)}
.sc-class{display:flex;white-space:nowrap;align-items:center;gap:.35em;font:800 .6em/1 var(--font-ui);letter-spacing:var(--ls-caps);text-transform:uppercase;color:color-mix(in srgb,var(--class-primary) 70%,var(--parch-ink))}
.sc-emblem{display:grid;place-items:center;width:1.9em;height:1.9em;padding:.28em;border-radius:50%;background:var(--class-surface);border:.1em solid var(--class-accent)}
.sc-emblem img{width:100%;height:100%;display:block}
.sc-cost{position:absolute;z-index:3;left:-.45em;top:-.45em;display:grid;place-items:center;width:2.7em;height:2.7em;border-radius:var(--shape-medallion);background:var(--mat-gem-mana);border:.14em solid var(--brass-1);box-shadow:0 .2em .4em #000a,inset 0 .1em .15em #fff9,inset 0 -.2em .3em #0b2a6a88;color:#fff}
.sc-cost b{font:700 1.6em/1 var(--font-num);text-shadow:0 .06em .1em #0b2a6a}
.is-locked .sc-rim,.is-locked .sc-body{filter:saturate(.45) brightness(.78)}
.is-locked .sc-cost{background:linear-gradient(150deg,#8a7f86,#4b4249);box-shadow:0 .2em .4em #000a,inset 0 .1em .15em #fff6;border-color:var(--c-health)}
.is-locked .sc-cost b{color:var(--c-health);text-shadow:0 .06em .1em #000}
.is-dim .sc-rim,.is-dim .sc-body{filter:saturate(.7) brightness(.85)}
.is-bonus .sc-rim{box-shadow:0 0 0 .14em var(--c-bonus),var(--glow-bonus),0 .35em .8em #0a181ab0,inset 0 .1em .12em #fff7}
.sc-upgrade{position:absolute;z-index:4;left:2.5em;top:0;display:grid;place-items:center;width:1.5em;height:1.5em;border-radius:var(--r-pill);background:var(--brass-1);border:.1em solid var(--brass-4);color:var(--parch-ink);font:900 1em/1 var(--font-ui);box-shadow:var(--shadow-1)}
</style>
