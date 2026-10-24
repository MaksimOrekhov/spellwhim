<script setup lang="ts">
// Card-effect icons. Lucide only (ISC, see docs/third-party-assets.md); one glyph = one meaning:
// damage = sword, armor = shield, draw = stacked cards, Vulnerability = crosshair (weak point), exhaust = ghost (the copy vanishes), upgrade = fat up arrow.
import { ArrowBigUp, ChevronsUp, CopyPlus, Crosshair, Droplet, Ghost, Lock, Shield, Snowflake, Sword } from '@lucide/vue'
import type { GlyphKind } from '../ui/cardDisplay'

defineProps<{ kind: GlyphKind }>()
const icons = { damage: Sword, armor: Shield, draw: CopyPlus, vulnerable: Crosshair, exhaust: Ghost, bonus: ChevronsUp, lock: Lock, bleeding: Droplet, frostbite: Snowflake, upgrade: ArrowBigUp }
</script>

<template>
  <component :is="icons[kind]" class="glyph" :class="'glyph--' + kind" :stroke-width="2.4" aria-hidden="true" />
</template>

<style scoped>
.glyph{display:block;flex:none;width:1em;height:1em}
</style>
