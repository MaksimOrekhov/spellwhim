<script setup lang="ts">
// The health plate shared by the heroes and the enemy, as a small wooden sign: the name, then one row with an armor well and one wide
// health bar with the number inside it. Armor has a socket of its own beside the bar (empty while there is none), so it never
// covers the number or the plate next to it and never moves the bar. The optional "ghost" is the health that the announced hit
// will take away this turn (or the Bleeding tick): bright diagonal stripes cut out of the end of the bar with a dark edge, so
// it is told apart from the red health by brightness, not hue alone. It never shows a prepared strike (its size is not public
// yet) and carries no number: the exact figure is in the enemy's banner and in the hero's accessible name.
import { computed } from 'vue'
import { Heart, Shield } from '@lucide/vue'
import GameTooltip from './GameTooltip.vue'
import { armorNote, useRules } from '../ui/rulesInfo'
import { vitalsSpoken, vitalsView } from '../ui/vitals'

const props = defineProps<{ name: string; subtitle?: string; health: number; max: number; armor: number; ghost?: number; ghostTone?: 'threat' | 'strike'; lethal?: boolean; side: 'hero' | 'enemy' }>()
const view = computed(() => vitalsView(props.health, props.max, props.ghost))
const rules = useRules()
</script>

<template>
  <div class="vitals" :class="['vitals--' + side, { 'is-low': view.low, 'is-lethal': lethal }]" data-critical>
    <div class="nameplate"><strong>{{ name }}</strong><small v-if="subtitle">{{ subtitle }}</small></div>
    <div class="row">
      <GameTooltip v-if="armor" label="Броня" class="armor-tip">
        <span :key="armor" class="armor" tabindex="0" :aria-label="'Броня ' + armor"><Shield :size="40" :stroke-width="1.6" aria-hidden="true" /><b>{{ armor }}</b></span>
        <template #content><p>{{ armorNote(side, rules) }}</p></template>
      </GameTooltip>
      <span v-else class="armor armor--empty" aria-hidden="true"><Shield :size="40" :stroke-width="1.6" /></span>
      <div class="bar" role="img" :aria-label="vitalsSpoken(name, health, max, armor, ghost)">
        <span class="fill" :style="{ width: view.pct + '%' }"></span>
        <span v-if="view.ghostPct > 0" class="ghost" :class="['ghost--' + (ghostTone ?? 'threat'), { 'ghost--lethal': lethal }]" :style="{ left: view.ghostFrom + '%', width: view.ghostPct + '%' }"></span>
        <span class="hp"><Heart :size="15" :stroke-width="2.6" aria-hidden="true" /><b>{{ health }}</b><i>/{{ max }}</i></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vitals{--bar-h:clamp(20px,3vh,32px);position:relative;width:100%;padding:clamp(4px,.7vh,8px) clamp(8px,1.1vw,14px) clamp(5px,.8vh,9px);border-radius:var(--shape-banner);background:linear-gradient(#3d2a1bf2,#21150ff5);border:2px solid var(--brass-3);box-shadow:var(--shadow-3),inset 0 1px 1px #fff3,inset 0 0 0 1px #0007}
.vitals.is-lethal{border-color:var(--c-lethal);box-shadow:var(--shadow-3),inset 0 1px 1px #fff3,var(--glow-lethal)}
.nameplate{display:flex;flex-direction:column;align-items:center;gap:0;margin-bottom:clamp(2px,.4vh,5px);text-align:center;white-space:nowrap;overflow:hidden;text-shadow:0 2px 4px #000c}
.nameplate strong{font:var(--fw-bold) clamp(14px,2.1vh,24px)/var(--lh-tight) var(--font-display);color:var(--ink);overflow:hidden;text-overflow:ellipsis}
.vitals--enemy .nameplate strong{font-size:clamp(16px,2.7vh,32px)}
.nameplate strong,.nameplate small{max-width:100%}
.nameplate small{display:none;font:var(--fw-semibold) clamp(9px,1.15vh,12px)/var(--lh-snug) var(--font-ui);letter-spacing:.07em;text-transform:uppercase;color:var(--gold);overflow:hidden;text-overflow:ellipsis}
@container arena (min-width: 1100px){.nameplate small{display:block}}
.row{display:flex;align-items:center;gap:clamp(5px,.8vh,9px)}
.bar{position:relative;flex:1;min-width:0;height:var(--bar-h);border-radius:var(--r-pill);background:var(--mat-hp-track);border:2px solid var(--brass-2);box-shadow:inset 0 2px 5px #000c,0 0 0 1px var(--brass-4);overflow:hidden}
.fill{position:absolute;inset:0 auto 0 0;background:var(--mat-hp-fill);transition:width var(--dur-slow) var(--ease-out);box-shadow:inset 0 2px 2px #fff6}
.fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#0000 75%,#fff3)}
.is-low .fill{background:var(--mat-hp-fill-low)}
.ghost{position:absolute;top:0;bottom:0;background-color:#3a0a04;background-image:repeating-linear-gradient(135deg,var(--c-ghost-threat-a) 0 4px,var(--c-ghost-threat-b) 4px 9px);border-left:2px solid #1a0300;box-shadow:inset 0 0 6px #fff9,inset 0 0 10px var(--c-threat);transition:left var(--dur-slow) var(--ease-out),width var(--dur-slow) var(--ease-out)}
/* "strike": health the enemy is about to lose on its own (Bleeding at the start of its turn), in gold like the card-damage preview. */
.ghost--strike{background-color:#2a1a00;background-image:repeating-linear-gradient(135deg,var(--c-ghost-strike-a) 0 4px,var(--c-ghost-strike-b) 4px 9px);box-shadow:inset 0 0 6px #fff9,inset 0 0 10px var(--c-bonus)}
.ghost--lethal{box-shadow:inset 0 0 8px #fff,inset 0 0 12px var(--c-lethal),0 0 0 1px var(--c-lethal)}
.hp{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:5px;color:#fff;text-shadow:0 1px 2px #000,0 0 5px #000a,0 0 2px #000}
.hp svg{color:#ffd0c8;fill:currentColor}
.hp b{font:var(--fw-bold) clamp(14px,2vh,22px)/1 var(--font-num)}
.hp i{font:var(--fw-semibold) clamp(11px,1.5vh,16px)/1 var(--font-num);font-style:normal;opacity:.82}
.armor-tip{flex:none}
.armor{position:relative;flex:none;display:grid;place-items:center;width:calc(var(--bar-h) * 1.5);height:calc(var(--bar-h) * 1.7);filter:drop-shadow(0 3px 3px #000b);animation:armor-pop .32s var(--ease-snap)}
.armor svg{position:absolute;inset:0;width:100%;height:100%;color:var(--c-armor-deep);fill:var(--c-armor)}
.armor b{position:relative;margin-top:-2px;font:var(--fw-bold) clamp(14px,2.1vh,23px)/1 var(--font-num);color:#102337;text-shadow:0 1px 0 #fff9}
.armor--empty{animation:none;filter:none}
.armor--empty svg{fill:none;color:#ffffff30;stroke-dasharray:3 3}
@keyframes armor-pop{from{scale:.6}60%{scale:1.14}}
.armor:focus-visible{outline:var(--focus-ring);outline-offset:2px;border-radius:var(--r-1)}
</style>
