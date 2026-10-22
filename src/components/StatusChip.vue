<script setup lang="ts">
// One status as one compact token: its icon and the single figure that matters (`+3` for Vulnerability, the strength for
// Bleeding). Every status has the same size and sits in the same rack beside its carrier's portrait, so any number of them
// line up. The name and the one explanatory sentence appear only in the tooltip. Polarity is not carried by colour alone: a
// corner arrow marks a status that hurts its carrier (down) or helps it (up). A new status adds a key to StatusIconKey and a
// line here (Lucide only); the figure comes from the definition (`StatusView.badge`).
import { ChevronDown, ChevronUp, Droplet, Snowflake } from '@lucide/vue'
import vulnerabilityIcon from '../assets/art/vulnerability.svg'
import GameTooltip from './GameTooltip.vue'
import type { StatusView } from '../game/statuses'

defineProps<{ status: StatusView }>()
</script>

<template>
  <GameTooltip :label="status.name">
    <button class="status-chip" :class="['status-chip--' + status.id, 'status-chip--' + status.polarity]" :aria-label="status.spoken + (status.badge ? ', ' + status.badge : '')">
      <img v-if="status.icon === 'vulnerability'" :src="vulnerabilityIcon" alt="" />
      <Droplet v-else-if="status.icon === 'bleeding'" :size="28" :stroke-width="2.4" aria-hidden="true" />
      <Snowflake v-else-if="status.icon === 'frostbite'" :size="28" :stroke-width="2.4" aria-hidden="true" />
      <b v-if="status.badge">{{ status.badge }}</b>
      <span class="polarity" aria-hidden="true"><component :is="status.polarity === 'negative' ? ChevronDown : ChevronUp" :size="12" :stroke-width="3.4" /></span>
    </button>
    <template #content><p>{{ status.description }}</p></template>
  </GameTooltip>
</template>

<style scoped>
.status-chip{position:relative;display:grid;place-items:center;width:clamp(40px,5.8vh,54px);height:clamp(40px,5.8vh,54px);padding:0;border:2px solid var(--c-bonus);border-radius:var(--r-3);background:linear-gradient(#6a4a1f,#3a2610);color:var(--ink);box-shadow:var(--shadow-2),var(--bevel-top)}
.status-chip img{display:block;width:70%;height:70%}
.status-chip svg{color:var(--c-threat)}
.status-chip--bleeding{border-color:var(--c-ghost-threat-a);background:linear-gradient(#5a1c1c,#2e0c0c)}
.status-chip--frostbite{border-color:#7fc8ff;background:linear-gradient(#1f4a6a,#0c2236)}.status-chip--frostbite svg{color:#bfe6ff}.status-chip--frostbite b{color:#bfe6ff}
.status-chip b{position:absolute;right:-9px;bottom:-9px;min-width:1.5em;padding:2px 4px;border-radius:var(--r-pill);background:#1a0f08;border:2px solid currentColor;font:var(--fw-bold) clamp(13px,1.9vh,18px)/1 var(--font-num);text-align:center;color:var(--c-bonus)}
.status-chip--bleeding b{color:var(--c-ghost-threat-a)}
.polarity{position:absolute;left:-7px;top:-7px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#1a0f08;border:2px solid currentColor;color:var(--c-ghost-threat-a)}
.status-chip--positive .polarity{color:#9be37f}
.status-chip:focus-visible{outline:var(--focus-ring);outline-offset:2px}
</style>
