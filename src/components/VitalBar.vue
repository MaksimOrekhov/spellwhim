<script setup lang="ts">
// Health plate shared by the heroes and the enemy: name, one wide bar with the number inside it, armor as a steel shield and
// an optional "ghost" segment — the health that the announced hit will take away this turn. The ghost never shows a prepared
// strike (its size is not public), so the bar only ever predicts damage that is actually about to land. It carries no number:
// the exact figure is in the enemy's banner.
import { computed } from 'vue'
import { Heart, Shield } from '@lucide/vue'
import GameTooltip from './GameTooltip.vue'
import { armorNote, useRules } from '../ui/rulesInfo'

const props = defineProps<{ name: string; subtitle?: string; health: number; max: number; armor: number; ghost?: number; ghostTone?: 'threat' | 'strike'; lethal?: boolean; side: 'hero' | 'enemy' }>()
const pct = computed(() => Math.max(0, Math.min(100, props.health / props.max * 100)))
const ghostPct = computed(() => Math.max(0, Math.min(pct.value, (props.ghost ?? 0) / props.max * 100)))
const low = computed(() => props.health / props.max <= 0.35)
const rules = useRules()
</script>

<template>
  <div class="vitals" :class="['vitals--' + side, { 'is-low': low }]">
    <div class="nameplate"><strong>{{ name }}</strong><small v-if="subtitle">{{ subtitle }}</small></div>
    <div class="bar" role="img" :aria-label="`${name}: здоровье ${health} из ${max}${armor ? ', броня ' + armor : ''}${ghost ? ', в этот ход потеряет ' + ghost : ''}`">
      <span class="fill" :style="{ width: pct + '%' }"></span>
      <span v-if="ghostPct > 0" class="ghost" :class="['ghost--' + (ghostTone ?? 'threat'), { 'ghost--lethal': lethal }]" :style="{ left: (pct - ghostPct) + '%', width: ghostPct + '%' }"></span>
      <span class="hp"><Heart :size="15" :stroke-width="2.6" aria-hidden="true" /><b>{{ health }}</b><i>/{{ max }}</i></span>
    </div>
    <GameTooltip v-if="armor" label="Броня" class="armor-tip">
      <span class="armor" tabindex="0" :aria-label="'Броня ' + armor"><Shield :size="40" :stroke-width="1.6" aria-hidden="true" /><b>{{ armor }}</b></span>
      <template #content><p>{{ armorNote(side, rules) }}</p></template>
    </GameTooltip>
  </div>
</template>

<style scoped>
.vitals{position:relative;width:100%;padding-top:2px}
.nameplate{display:flex;flex-direction:column;align-items:center;gap:1px;margin-bottom:5px;text-align:center;white-space:nowrap;text-shadow:0 2px 6px #000d,0 0 2px #000}
.nameplate strong{font:var(--fw-bold) clamp(17px,2.45vh,28px)/var(--lh-tight) var(--font-display);color:var(--ink)}
.vitals--enemy .nameplate strong{font-size:clamp(19px,2.9vh,34px)}
.nameplate small{font:var(--fw-semibold) clamp(10px,1.2vh,13px)/var(--lh-snug) var(--font-ui);letter-spacing:.07em;text-transform:uppercase;color:var(--gold)}
.bar{position:relative;height:clamp(22px,3vh,32px);border-radius:var(--r-pill);background:var(--mat-hp-track);border:2px solid var(--brass-2);box-shadow:var(--shadow-2),inset 0 2px 5px #000c,0 0 0 1px var(--brass-4);overflow:hidden}
.fill{position:absolute;inset:0 auto 0 0;background:var(--mat-hp-fill);transition:width var(--dur-slow) var(--ease-out);box-shadow:inset 0 2px 2px #fff6}
.fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#0000 75%,#fff3)}
.is-low .fill{background:var(--mat-hp-fill-low)}
.ghost{position:absolute;top:0;bottom:0;background-color:#1a0000;background-image:repeating-linear-gradient(135deg,var(--c-ghost-threat-a) 0 5px,var(--c-ghost-threat-b) 5px 10px);box-shadow:inset 0 0 8px var(--c-threat);transition:left var(--dur-slow) var(--ease-out),width var(--dur-slow) var(--ease-out)}
/* "strike": health the enemy is about to lose on its own (Bleeding at the start of its turn), in gold like the card-damage preview. */
.ghost--strike{background-color:#2a1a00;background-image:repeating-linear-gradient(135deg,var(--c-ghost-strike-a) 0 5px,var(--c-ghost-strike-b) 5px 10px);box-shadow:inset 0 0 8px var(--c-bonus)}
.ghost--lethal{box-shadow:inset 0 0 10px var(--c-lethal),0 0 0 1px var(--c-lethal)}
.hp{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:5px;color:#fff;text-shadow:0 1px 2px #000,0 0 5px #000a}
.hp svg{color:#ffd0c8;fill:currentColor}
.hp b{font:var(--fw-bold) clamp(15px,2.1vh,22px)/1 var(--font-num)}
.hp i{font:var(--fw-semibold) clamp(11px,1.5vh,16px)/1 var(--font-num);font-style:normal;opacity:.78}
.armor-tip{position:absolute;left:-14px;bottom:-8px;z-index:2}
.armor{position:relative;display:grid;place-items:center;width:clamp(36px,5.4vh,50px);height:clamp(40px,6vh,56px);filter:drop-shadow(0 3px 4px #000c)}
.armor svg{position:absolute;inset:0;width:100%;height:100%;color:var(--c-armor-deep);fill:var(--c-armor)}
.armor b{position:relative;margin-top:-2px;font:var(--fw-bold) clamp(15px,2.2vh,23px)/1 var(--font-num);color:#102337;text-shadow:0 1px 0 #fff9}
.armor:focus-visible{outline:var(--focus-ring);outline-offset:2px;border-radius:var(--r-1)}
</style>
