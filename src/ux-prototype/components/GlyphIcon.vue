<script setup lang="ts">
// Gameplay glyphs. Icons come from the Lucide library (@lucide/vue, ISC; see docs/third-party-assets.md) — project rule:
// UI icons are never drawn by hand or generated. This file only maps a game concept to a library icon, so one concept
// keeps the same icon on every screen and a future icon swap is a one-line change.
import { Crown, CircleHelp, CopyPlus, Crosshair, Flame, Heart, Hourglass, Layers, Lock, Pickaxe, Recycle, Shield, ShieldPlus, Skull, Sparkles, Sword, Swords } from '@lucide/vue'
import type { Component } from 'vue'

export type GlyphName = 'damage' | 'armor' | 'draw' | 'vulnerable' | 'exhaust' | 'heart' | 'wait' | 'recover' | 'deck' | 'discard' | 'lock' | 'help' | 'attack-all' | 'crown' | 'camp' | 'skull' | 'battle' | 'pick'
defineProps<{ name: GlyphName; strokeWidth?: number }>()
const icons: Record<GlyphName, Component> = {
  damage: Sword, armor: Shield, draw: CopyPlus, vulnerable: Crosshair, exhaust: Flame, heart: Heart, wait: Hourglass, recover: ShieldPlus,
  deck: Layers, discard: Recycle, lock: Lock, help: CircleHelp, 'attack-all': Sparkles, crown: Crown, camp: Flame, skull: Skull, battle: Swords, pick: Pickaxe,
}
</script>
<template><component :is="icons[name]" class="glyph" aria-hidden="true" :stroke-width="strokeWidth ?? 2.4" /></template>
<style scoped>.glyph{display:block;width:1em;height:1em;overflow:visible}</style>
