<script setup lang="ts">
// One status of a carrier as a brass pill with its icon, short name and strength. The icon comes from the definition's key;
// a new status adds a key to StatusIconKey and a line here (Lucide only), nothing else in the scene changes.
import { Droplet } from '@lucide/vue'
import vulnerabilityIcon from '../assets/art/vulnerability.svg'
import GameTooltip from './GameTooltip.vue'
import type { StatusView } from '../game/statuses'

defineProps<{ status: StatusView }>()
</script>

<template>
  <GameTooltip :label="status.name">
    <button class="status-chip" :class="['status-chip--' + status.id, 'status-chip--' + status.polarity]" :aria-label="status.spoken + (status.reading === 'intensity' ? ', сила ' + status.value : '')">
      <img v-if="status.icon === 'vulnerability'" :src="vulnerabilityIcon" alt="" />
      <Droplet v-else-if="status.icon === 'bleeding'" :size="22" :stroke-width="2.4" aria-hidden="true" />
      <span class="status-name">{{ status.shortName }}</span><b v-if="status.reading === 'intensity'">{{ status.value }}</b>
    </button>
    <template #content><p>{{ status.description }}</p><p v-if="status.note">{{ status.note }}</p></template>
  </GameTooltip>
</template>

<style scoped>
.status-chip{display:flex;align-items:center;gap:5px;min-height:clamp(30px,4.4vh,38px);padding:0 11px 0 7px;border:1px solid var(--c-bonus);border-radius:var(--r-pill);background:linear-gradient(#6a4a1f,#3a2610);color:var(--ink);box-shadow:var(--shadow-2),var(--bevel-top)}
.status-chip img{display:block;width:clamp(20px,3vh,26px);height:clamp(20px,3vh,26px)}
.status-name{font:var(--fw-bold) var(--fs-sm)/1 var(--font-ui)}
.status-chip svg{color:var(--c-threat)}.status-chip--bleeding{border-color:var(--c-ghost-threat-a);background:linear-gradient(#5a1c1c,#2e0c0c)}
.status-chip b{font:var(--fw-bold) var(--fs-md)/1 var(--font-num);color:var(--c-bonus)}
.status-chip:focus-visible{outline:var(--focus-ring);outline-offset:2px}
</style>
