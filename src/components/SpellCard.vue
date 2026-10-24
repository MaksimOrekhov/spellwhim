<script setup lang="ts">
// The one card face used by the hand, the reward screen, the deck views and the deck operations. Purely presentational and sized in `em`:
// the parent sets font-size (card = 12em × 16.6em), so the same object scales from a 160px hand card to a 270px reward card.
// Materials (frame, plate, gems, jewels) live in assets/cards.css and are shared with the hand tile (CompactCard); this file is the layout.
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import { cardFace, cardNameScale } from '../ui/cardDisplay'
import type { CardBlock, RuleLine } from '../ui/cardDisplay'
import { cardArt } from '../ui/cardArt'
import CardGlyph from './CardGlyph.vue'
import '../assets/cards.css'

const props = defineProps<{
  card: CardDefinition
  preview: CardPreview
  /** Why the card cannot be played now; null when playable. */
  block?: CardBlock | null
  /** Fraction of the card not covered by its right-hand neighbour (1 = fully visible). Keeps the name and the main number inside the visible strip. */
  vis?: number
}>()
const theme = computed(() => getClassTheme(props.card.className))
const face = computed(() => cardFace(props.card, props.preview))
const artUrl = computed(() => cardArt[props.card.id])
const locked = computed(() => props.block?.kind === 'mana')
const bonus = computed(() => !props.block && props.preview.bonusDamage > 0)
const upgraded = computed(() => !!props.card.upgrade)
const simple = computed(() => !face.value.lines.length && !face.value.tags.length)
const dense = computed(() => (props.vis ?? 1) < 0.9)
/** Three or more rule rows do not fit under the gems: active bonuses then shrink to pills (icon + short text); the notes keep the full sentences. */
const crowded = computed(() => face.value.lines.length + (face.value.tags.length ? 1 : 0) > 2)
/** An active line also shrinks to a pill when its sentence is too long for one or two rows of the card. */
const asPill = (line: RuleLine) => line.tone === 'on' && (crowded.value || line.text.length > 30)
const waiting = computed(() => face.value.lines.filter(line => !asPill(line)))
const pills = computed(() => face.value.lines.filter(asPill))
/** Names are never wrapped: long ones simply shrink a little so the title stays on one line on its plate. */
const nameSize = computed(() => cardNameScale(props.card.name))
const style = computed(() => ({ ...classThemeStyle(props.card.className), '--emblem': `url("${theme.value.emblem}")`, '--vis': String(props.vis ?? 1), '--name-size': nameSize.value + 'em' }))
</script>

<template>
  <span class="cf sc" :class="[`cf--${theme.ornament}`, { 'is-locked': locked, 'is-dim': block?.kind === 'phase', 'is-bonus': bonus, 'is-dense': dense, 'is-simple': simple, 'is-solo': simple && face.chips.length === 1, 'is-upgraded': upgraded }]" :style="style" :data-card-class="theme.id">
    <span class="cf-rim sc-rim" aria-hidden="true"></span>
    <span class="cf-body">
      <span class="cf-art sc-art">
        <img v-if="artUrl" :src="artUrl" alt="" draggable="false" />
        <span v-else class="cf-art-pending" aria-label="Иллюстрация ожидает утверждения"><small>Арт ожидает утверждения</small></span>
        <span v-if="artUrl" class="cf-shade"></span>
        <span v-if="locked" class="cf-lock"><CardGlyph kind="lock" /> нужно {{ card.cost }}</span>
      </span>
      <span class="cf-paper sc-lower">
        <span class="sc-stats">
          <span v-for="(chip, i) in face.chips" :key="i" class="cf-chip sc-chip" :class="['cf-chip--' + chip.kind, { 'is-boosted': chip.boosted, 'is-inactive': chip.inactive }]">
            <i class="cf-gem"><CardGlyph :kind="chip.kind" class="cf-ico" /><b class="cf-num">{{ chip.value }}</b><CardGlyph v-if="chip.boosted" kind="bonus" class="cf-up" /></i>
            <small class="cf-cap">{{ chip.caption }}</small>
          </span>
        </span>
        <span class="sc-rules">
          <span v-if="pills.length" class="sc-pills"><span v-for="(line, i) in pills" :key="'p' + i" class="pill"><CardGlyph v-if="line.glyph" :kind="line.glyph" /><span>{{ line.short }}</span></span></span>
          <span v-for="(line, i) in waiting" :key="'l' + i" class="rule" :class="'rule--' + line.tone"><CardGlyph v-if="line.glyph" :kind="line.glyph" /><span>{{ dense ? line.short : line.text }}</span></span>
          <span v-if="face.tags.length" class="sc-tags"><span v-for="tag in face.tags" :key="tag.id" class="tag" :class="'tag--' + tag.id"><CardGlyph :kind="tag.glyph" /><span>{{ dense ? tag.short : tag.text }}</span></span></span>
        </span>
        <span class="sc-foot"></span>
      </span>
    </span>
    <span class="cf-plate sc-plate"><strong class="cf-name">{{ card.name }}</strong></span>
    <span class="cf-seal" aria-hidden="true"><img :src="theme.emblem" alt="" draggable="false" /></span>
    <span v-if="upgraded" class="cf-upgrade" aria-label="Улучшена" title="Улучшена"><CardGlyph kind="upgrade" /></span>
    <span class="cf-cost" aria-hidden="true"><b>{{ card.cost }}</b></span>
  </span>
</template>

<style scoped>
/* Layout of the full card (12em × 16.6em). The art window is 7.4em tall; the plate straddles its lower edge; the parchment starts under the plate. */
.sc{--pad-r:max(.6em,calc(11.9em - 12em * var(--vis,1)));--art-h:7.4em;width:12em;height:16.6em}
.sc-art{height:var(--art-h)}
.sc-plate{left:.12em;right:.12em;top:6.95em;height:1.9em;padding:0 var(--pad-r) 0 .5em}
.is-dense .cf-name{font-size:calc(var(--name-size,1.1em) * .86)}
.sc-lower{flex:1;min-height:0;display:flex;flex-direction:column;padding:1.25em .6em .2em .6em}

/* numbers */
.sc-stats{flex:none;display:flex;align-items:flex-start;justify-content:center;gap:.5em;min-height:3.1em;padding-right:calc(var(--pad-r) - .6em)}
.sc-chip{min-width:4.1em}
.is-dense .sc-stats{justify-content:flex-start;gap:.4em}
.is-dense .rule>span,.is-dense .tag>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Cards with nothing but numbers: the gems grow and sit in the middle instead of leaving empty paper. */
.is-simple .sc-stats{flex:1;align-items:center;gap:.8em;padding-top:.5em}
.is-solo:not(.is-dense) .sc-chip{font-size:1.22em}
/* narrow visible strip (fan overlap): icon + number only; the caption returns when the card is zoomed */
.is-dense .sc-chip{min-width:0}
.is-dense .cf-cap{display:none}
.is-dense .cf-gem{min-width:3.4em;height:2.1em;padding:0 .35em 0 .2em}
.is-dense .cf-num{font-size:1.4em}
.is-dense .cf-ico{width:1.35em;height:1.35em}

/* rules, pills and tags */
.sc-rules{position:relative;flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:safe center;gap:.22em;padding-right:calc(var(--pad-r) - .6em)}
.rule{display:flex;align-items:flex-start;gap:.3em;min-width:0;font:800 .76em/1.15 var(--font-ui);color:var(--parch-ink)}
.rule .glyph{margin-top:.04em;width:1.1em;height:1.1em}
.rule--on{padding:.1em .45em .1em .28em;border-radius:var(--shape-chip);background:linear-gradient(90deg,color-mix(in srgb,var(--c-bonus) 62%,#0000),color-mix(in srgb,var(--c-bonus) 28%,#0000));box-shadow:inset 0 0 0 .08em color-mix(in srgb,var(--brass-2) 60%,#0000);color:color-mix(in srgb,var(--parch-ink) 85%,var(--c-health-deep))}
.rule--on .glyph--armor{color:var(--c-armor-deep)}.rule--on .glyph--vulnerable{color:color-mix(in srgb,var(--c-vulnerable) 60%,#5a2a00)}.rule--on .glyph--damage{color:var(--c-health-deep)}
.rule--off{opacity:.7;font-weight:700;font-style:italic}
.sc-pills{display:flex;flex-wrap:wrap;gap:.2em}
.pill{display:inline-flex;align-items:center;gap:.2em;max-width:100%;padding:.08em .45em .08em .25em;border-radius:var(--r-pill);background:linear-gradient(90deg,color-mix(in srgb,var(--c-bonus) 70%,#0000),color-mix(in srgb,var(--c-bonus) 36%,#0000));box-shadow:inset 0 0 0 .08em color-mix(in srgb,var(--brass-2) 70%,#0000);font:800 .68em/1.2 var(--font-ui);color:var(--parch-ink);white-space:nowrap}
.pill .glyph{width:1.1em;height:1.1em}
.pill .glyph--armor{color:var(--c-armor-deep)}.pill .glyph--vulnerable{color:color-mix(in srgb,var(--c-vulnerable) 60%,#5a2a00)}.pill .glyph--damage,.pill .glyph--bleeding{color:var(--c-health-deep)}
.sc-tags{display:flex;flex-wrap:wrap;gap:.25em}
.tag{display:inline-flex;align-items:center;gap:.25em;padding:.1em .55em .1em .3em;border-radius:var(--r-pill);border:.09em solid color-mix(in srgb,var(--class-accent) 75%,var(--parch-ink));background:linear-gradient(#fff6,color-mix(in srgb,var(--class-accent) 24%,#0000));font:800 .66em/1.2 var(--font-ui);color:var(--parch-ink);white-space:nowrap}
.tag .glyph{width:1.1em;height:1.1em}
.tag--vulnerability .glyph{color:color-mix(in srgb,var(--c-vulnerable) 60%,#5a2a00)}
.tag--frostbite .glyph{color:color-mix(in srgb,#4ab0ff 70%,#0a2a4a)}

/* foot: keeps the bottom-left corner free for the class seal, which sits on the frame */
.sc-foot{position:relative;flex:none;display:flex;align-items:center;height:1.2em;margin-left:1.55em}
</style>
