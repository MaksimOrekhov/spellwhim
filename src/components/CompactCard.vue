<script setup lang="ts">
// Hand tile: the same card system as SpellCard, cropped to what decides a choice at a glance — cost, art, the title and the main numbers.
// The tile is 7.2em × 11em in the parent's font-size; inside, 1em is 1/12 of its width (like the full card), so frame, jewels and gems keep
// their proportions. The full SpellCard opens on hover/focus.
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import { cardFace } from '../ui/cardDisplay'
import type { CardBlock } from '../ui/cardDisplay'
import { cardArt } from '../ui/cardArt'
import CardGlyph from './CardGlyph.vue'
import '../assets/cards.css'

const props = defineProps<{ card: CardDefinition; preview: CardPreview; block?: CardBlock | null }>()
const theme = computed(() => getClassTheme(props.card.className))
const face = computed(() => cardFace(props.card, props.preview))
const artUrl = computed(() => cardArt[props.card.id])
const locked = computed(() => props.block?.kind === 'mana')
const bonus = computed(() => !props.block && props.preview.bonusDamage > 0)
/** Titles wrap to two lines on a tile; a very long single word shrinks instead of being cut. */
const nameSize = computed(() => Math.max(...props.card.name.split(' ').map(word => word.length)) > 11 ? 1.02 : 1.28)
const style = computed(() => ({ ...classThemeStyle(props.card.className), '--emblem': `url("${theme.value.emblem}")`, '--name-size': nameSize.value + 'em' }))
</script>

<template>
  <span class="cf tc" :class="[`cf--${theme.ornament}`, { 'is-locked': locked, 'is-dim': block?.kind === 'phase', 'is-bonus': bonus, 'is-upgraded': !!card.upgrade, 'is-gold': card.rarity === 'gold' }]" :style="style" :data-card-class="theme.id">
    <span class="cf-rim" aria-hidden="true"></span>
    <span class="cf-body">
      <span class="cf-art tc-art">
        <img v-if="artUrl" :src="artUrl" alt="" draggable="false" />
        <span v-else class="cf-art-pending" aria-label="Иллюстрация ожидает утверждения"><small>Арт ожидает утверждения</small></span>
        <span class="cf-shade"></span>
        <span v-if="face.tags.length" class="tc-marks"><CardGlyph v-for="tag in face.tags" :key="tag.id" :kind="tag.glyph" /></span>
        <span v-if="locked" class="cf-lock"><CardGlyph kind="lock" /></span>
      </span>
      <span class="cf-paper tc-stats">
        <span v-for="(chip, i) in face.chips" :key="i" class="cf-chip" :class="['cf-chip--' + chip.kind, { 'is-boosted': chip.boosted, 'is-inactive': chip.inactive }]">
          <i class="cf-gem"><CardGlyph :kind="chip.kind" class="cf-ico" /><b class="cf-num">{{ chip.value }}</b><CardGlyph v-if="chip.boosted" kind="bonus" class="cf-up" /></i>
        </span>
      </span>
    </span>
    <span class="cf-plate tc-plate"><strong class="cf-name tc-name">{{ card.name }}</strong></span>
    <span class="cf-seal" aria-hidden="true"><img :src="theme.emblem" alt="" draggable="false" /></span>
    <span v-if="card.upgrade" class="cf-upgrade" aria-label="Улучшена" title="Улучшена"><CardGlyph kind="upgrade" /></span>
    <span class="cf-cost" aria-hidden="true"><b>{{ card.cost }}</b></span>
  </span>
</template>

<style scoped>
.tc{width:12em;height:18.3em;font-size:.6em}
.tc-art{flex:1;min-height:0}
.tc-plate{left:.12em;right:.12em;bottom:4.55em;min-height:2.3em;padding:.2em .6em}
.tc-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.1}
.tc-stats{flex:none;display:flex;align-items:center;justify-content:center;gap:.7em;height:4.8em;padding:1em .6em .2em 1.7em}
.tc-marks{position:absolute;right:.4em;top:.4em;display:flex;flex-direction:column;gap:.3em}
.tc-marks .glyph{width:1.9em;height:1.9em;padding:.35em;border-radius:50%;background:#1b1210d0;color:var(--c-vulnerable)}
.tc-marks .glyph--exhaust{color:var(--muted)}
.tc .cf-gem{min-width:4.3em;height:2.6em}
.tc .cf-num{font-size:1.75em}
.tc .cf-ico{width:1.8em;height:1.8em}
.tc .cf-lock{padding:.5em;border-radius:50%;top:36%}
.tc .cf-lock .glyph{width:1.8em;height:1.8em}
.tc .cf-seal{width:2.3em;height:2.3em}
</style>
