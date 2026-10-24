<script setup lang="ts">
// The Deadmines as a painted stage. All paintings stay in the DOM and the current one fades in, so a new fight never flashes or reloads
// an image and nothing is redrawn while the battle state changes. The pictures are 16:9 and the visible battle area is much wider
// (the hand takes the bottom), so they are cropped with object-fit: cover around a per-picture focus, never stretched.
// Light is procedural and carries the mood: the scene's --scene-core / -lamp / -far colours tint a few soft layers (the enemy's turn,
// elite, boss, the boss's second phase), a vignette darkens the edges and the strip under the header and the hand.
// It only paints: no pointer events, hidden from assistive tech; characters stand on the floor, the hand covers the bottom.
import { allBattleBackgrounds, type BattleBackground } from '../ui/battleBackground'
import AmbientBackdrop from './AmbientBackdrop.vue'
import type { AmbientProfile } from '../ambient/profiles'
defineProps<{ background: BattleBackground; ambient: AmbientProfile; reduced?: boolean }>()
</script>

<template>
  <div class="backdrop" aria-hidden="true" data-backdrop :data-background="background.id">
    <img v-for="item in allBattleBackgrounds" :key="item.id" class="art" :class="{ 'is-on': item.id === background.id }" :src="item.src" :style="{ objectPosition: item.focus }" alt="" draggable="false" decoding="sync" />
    <div class="light light--far" /><div class="light light--core" /><div class="light light--floor" /><div class="shade" />
    <AmbientBackdrop :profile="ambient" :reduced="reduced" />
  </div>
</template>

<style scoped>
.backdrop{position:absolute;left:0;right:0;top:0;bottom:var(--hand-height);overflow:hidden;pointer-events:none;background:#120d0a;
  --glow-core:var(--scene-core,#ffb866);--glow-lamp:var(--scene-lamp,#ffb054);--glow-far:var(--scene-far,#ffd890)}
.art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .45s ease;user-select:none}
.art.is-on{opacity:1}
/* Colour of the moment: soft, screen-blended, so the painting keeps its own values and only its warmth changes. */
.light{position:absolute;inset:0;mix-blend-mode:soft-light;transition:opacity .4s}
.light--far{background:radial-gradient(ellipse 34% 42% at 50% 34%,var(--glow-far),#0000);opacity:.55}
.light--core{background:radial-gradient(ellipse 70% 80% at 50% 52%,var(--glow-core),#0000 78%);opacity:.5}
/* Under the fighters the floor is a little darker and calmer, so portraits, bars and the intent banner stand out from the busy middle. */
.light--floor{mix-blend-mode:normal;background:radial-gradient(ellipse 46% 40% at 50% 46%,#0b0705a8,#0b070500 100%);opacity:.7}
.shade{position:absolute;inset:0;background:linear-gradient(#0a0807c4,#0a080700 22%,#0a080700 74%,#0a080790)}
</style>
