<script setup lang="ts">
// The one token every battle readout of "something that is active here" is made of: statuses, the enemy's rage and artifacts.
// Same size, same soft plate, a tone for the family (gold: bonus/mark, red: bleeding, ice: frost, ember: rage, brass: artifact),
// one figure on a corner pill, and a corner arrow for whether it hurts (down) or helps (up) its carrier, so colour is never the
// only cue. Name and rules live in the tooltip (also on keyboard focus). The icon comes in the default slot.
import { ChevronDown, ChevronUp } from '@lucide/vue'
import GameTooltip from './GameTooltip.vue'

defineProps<{ tone: 'bonus' | 'bleed' | 'frost' | 'rage' | 'brass'; label: string; aria: string; badge?: string | number; polarity?: 'negative' | 'positive'; spent?: boolean }>()
</script>

<template>
  <GameTooltip :label="label">
    <button class="stat-chip" :class="['stat-chip--' + tone, { 'is-spent': spent }]" :aria-label="aria">
      <slot />
      <b v-if="badge !== undefined && badge !== ''" class="stat-badge">{{ badge }}</b>
      <span v-if="polarity" class="stat-polarity" :class="{ 'is-up': polarity === 'positive' }" aria-hidden="true"><component :is="polarity === 'negative' ? ChevronDown : ChevronUp" :size="11" :stroke-width="3.6" /></span>
    </button>
    <template #content><slot name="content" /></template>
  </GameTooltip>
</template>

<style scoped>
.stat-chip{--tone:var(--c-bonus);--tone-deep:#3a2610;--tone-lit:#6a4a1f;position:relative;display:grid;place-items:center;width:var(--chip,clamp(30px,4.4vh,44px));height:var(--chip,clamp(30px,4.4vh,44px));padding:0;border:2px solid var(--tone);border-radius:var(--r-2);background:linear-gradient(var(--tone-lit),var(--tone-deep));color:var(--tone);box-shadow:var(--shadow-2),var(--bevel-top)}
.stat-chip>:deep(svg),.stat-chip>:deep(img){width:62%;height:62%;display:block}
.stat-chip--bleed{--tone:var(--c-ghost-threat-a);--tone-lit:#5a1c1c;--tone-deep:#2e0c0c}
.stat-chip--frost{--tone:#9fd8ff;--tone-lit:#1f4a6a;--tone-deep:#0c2236}
.stat-chip--rage{--tone:#ffa66b;--tone-lit:#7a2a0e;--tone-deep:#3a1006}
.stat-chip--brass{--tone:var(--brass-1);--tone-lit:#8a6228;--tone-deep:#4f3716;color:var(--parch-1)}
.stat-chip.is-spent{filter:saturate(.45);opacity:.78}
.stat-badge{position:absolute;right:-8px;bottom:-8px;min-width:1.45em;padding:2px 5px;border-radius:var(--r-pill);background:#1a0f08;border:2px solid var(--tone);font:var(--fw-bold) clamp(11px,1.6vh,16px)/1 var(--font-num);text-align:center;color:var(--tone)}
.stat-polarity{position:absolute;left:-6px;top:-6px;display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:#1a0f08;border:2px solid currentColor;color:var(--c-ghost-threat-a)}
.stat-polarity.is-up{color:#9be37f}
.stat-chip:focus-visible{outline:var(--focus-ring);outline-offset:2px}
@media(prefers-reduced-motion:no-preference){.stat-chip{animation:chip-in .28s var(--ease-snap)}}
@keyframes chip-in{from{scale:.6;opacity:0}}
</style>
