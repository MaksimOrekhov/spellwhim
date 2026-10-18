<script setup lang="ts">
// Health plate shared by heroes and the enemy: name, one wide HP bar with the number INSIDE it, armor as a steel shield badge,
// and an optional "ghost" segment that previews the HP about to be lost (enemy intent on a hero, card damage on the enemy).
import { computed } from 'vue'
import GlyphIcon from './GlyphIcon.vue'

const props = defineProps<{ name: string; subtitle?: string; health: number; max: number; armor: number; armorPreview?: number; heal?: number; ghost?: number; ghostTone?: 'threat' | 'strike'; side: 'hero' | 'enemy' }>()
const pct = computed(() => Math.max(0, Math.min(100, props.health / props.max * 100)))
const ghostPct = computed(() => Math.max(0, Math.min(pct.value, (props.ghost ?? 0) / props.max * 100)))
const healPct = computed(() => Math.max(0, Math.min(100 - pct.value, (props.heal ?? 0) / props.max * 100)))
const low = computed(() => props.health / props.max <= 0.35)
</script>

<template>
  <div class="vitals" :class="['vitals--' + side, { 'is-low': low }]">
    <div class="nameplate"><strong>{{ name }}</strong><small v-if="subtitle">{{ subtitle }}</small></div>
    <div class="bar" role="img" :aria-label="`${name}: здоровье ${health} из ${max}${armor ? ', броня ' + armor : ''}`">
      <span class="fill" :style="{ width: pct + '%' }"></span>
      <span v-if="ghostPct > 0" class="ghost" :class="'ghost--' + (ghostTone ?? 'threat')" :style="{ left: (pct - ghostPct) + '%', width: ghostPct + '%' }"></span>
      <span v-if="healPct > 0" class="heal" :style="{ left: pct + '%', width: healPct + '%' }"></span>
      <span class="hp"><GlyphIcon name="heart" /><b>{{ health }}</b><i>/{{ max }}</i><em v-if="ghost" :class="'loss--' + (ghostTone ?? 'threat')">−{{ ghost }}</em><em v-if="heal" class="loss--heal">+{{ heal }}</em></span>
    </div>
    <span v-if="armor || armorPreview" class="armor" :class="{ 'armor--preview': !!armorPreview }" aria-hidden="true"><GlyphIcon name="armor" /><b>{{ armor + (armorPreview ?? 0) }}</b><em v-if="armorPreview">+{{ armorPreview }}</em></span>
  </div>
</template>

<style scoped>
.vitals{position:relative;width:100%;padding-top:.1rem}
.nameplate{display:flex;flex-direction:column;align-items:center;gap:.05rem;margin-bottom:.35rem;text-align:center;white-space:nowrap;text-shadow:0 .1rem .35rem #000d,0 0 .1rem #000}
.nameplate strong{font:800 1.6rem/1.1 var(--f-display);color:#fff3d6;letter-spacing:.01em}
.nameplate small{font:700 .72rem/1.2 var(--f-ui);letter-spacing:.07em;text-transform:uppercase;color:#f0d9a0}
.vitals--enemy .nameplate strong{font-size:1.9rem}
.bar{position:relative;height:1.85rem;border-radius:.95rem;background:linear-gradient(#1c0a0c,#2d1114);border:.16rem solid var(--brass-2);box-shadow:0 .25rem .7rem #000b,inset 0 .15rem .4rem #000c,0 0 0 .1rem var(--brass-4);overflow:hidden}
.fill{position:absolute;inset:0 auto 0 0;background:linear-gradient(#ff8a73,var(--hp) 45%,var(--hp-deep));transition:width .5s var(--ease-out);box-shadow:inset 0 .12rem .1rem #fff6}
.fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#0000 75%,#fff3)}
.is-low .fill{background:linear-gradient(#ffb27b,#ff6a3d 45%,#9a2412)}
.ghost{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(135deg,#fff 0 .3rem,transparent .3rem .6rem);animation:ghost-blink 1s ease-in-out infinite}
.ghost--threat{background-color:#1a0000;background-image:repeating-linear-gradient(135deg,#ffb199 0 .3rem,#c2290f .3rem .6rem);box-shadow:inset 0 0 .5rem #ff3a1ecc}
.ghost--strike{background-image:repeating-linear-gradient(135deg,#fff3b8 0 .3rem,#e09a1f .3rem .6rem);box-shadow:inset 0 0 .5rem #ffd56bcc}
@keyframes ghost-blink{50%{opacity:.62}}
.heal{position:absolute;top:0;bottom:0;background-color:#17381b;background-image:repeating-linear-gradient(135deg,#d6ffb8 0 .3rem,#4fae47 .3rem .6rem);box-shadow:inset 0 0 .5rem #8ad66f;animation:ghost-blink 1s ease-in-out infinite}
.loss--heal{color:#c9ffa8}
.hp{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:.3rem;color:#fff;text-shadow:0 .08rem .15rem #000,0 0 .3rem #000a}
.hp svg{width:1.05rem;height:1.05rem;color:#ffd0c8;fill:currentColor}
.hp b{font:800 1.3rem/1 var(--f-num)}
.hp i{font:600 .95rem/1 var(--f-num);font-style:normal;opacity:.78}
.hp em{margin-left:.35rem;padding:.02rem .35rem;border-radius:.4rem;background:#000a;font:800 1rem/1.15 var(--f-num);font-style:normal}
.loss--threat{color:#ffb199}.loss--strike{color:var(--bonus)}
.armor{position:absolute;left:-1.1rem;bottom:-.3rem;display:grid;place-items:center;width:3.1rem;height:3.4rem;color:var(--armor);filter:drop-shadow(0 .2rem .25rem #000c)}
.armor svg{position:absolute;inset:0;width:100%;height:100%;color:#27425f;fill:#cfe3f6;stroke-width:1.5}
.armor--preview{animation:armor-ghost 1s ease-in-out infinite}
.armor em{position:absolute;right:-1.1rem;top:-.4rem;padding:0 .3rem;border-radius:.6rem;background:#1b3a5c;border:.08rem solid #bfe0ff;color:#e7f3ff;font:800 .85rem/1.25 var(--f-num);font-style:normal}
@keyframes armor-ghost{50%{opacity:.6;filter:drop-shadow(0 0 .6rem #9fd2ff)}}
.armor b{position:relative;margin-top:-.2rem;font:800 1.5rem/1 var(--f-num);color:#102337;text-shadow:0 .05rem 0 #fff9}
@media (max-height:820px){.nameplate small{display:none}.nameplate strong,.vitals--enemy .nameplate strong{font-size:1.35rem}.bar{height:1.6rem}.hp b{font-size:1.15rem}.armor{width:2.6rem;height:2.9rem}.armor b{font-size:1.25rem}}
</style>
