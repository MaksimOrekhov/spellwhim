<script setup lang="ts">
// One status as one StatChip: its icon and the single figure that matters (`+3` for Vulnerability, the strength for Bleeding).
// A new status adds a key to StatusIconKey and a line here (Lucide only); the figure comes from the definition (`StatusView.badge`).
// The name and the one explanatory sentence appear only in the tooltip.
import { computed } from 'vue'
import { Droplet, Snowflake } from '@lucide/vue'
import vulnerabilityIcon from '../assets/art/vulnerability.svg'
import StatChip from './StatChip.vue'
import type { StatusView } from '../game/statuses'

const props = defineProps<{ status: StatusView }>()
const tone = computed(() => props.status.icon === 'bleeding' ? 'bleed' : props.status.icon === 'frostbite' ? 'frost' : 'bonus')
</script>

<template>
  <StatChip :tone="tone" :label="status.name" :aria="status.spoken + (status.badge ? ', ' + status.badge : '')" :badge="status.badge ?? undefined" :polarity="status.polarity" :class="'status-chip--' + status.id">
    <img v-if="status.icon === 'vulnerability'" :src="vulnerabilityIcon" alt="" />
    <Droplet v-else-if="status.icon === 'bleeding'" :stroke-width="2.4" aria-hidden="true" />
    <Snowflake v-else-if="status.icon === 'frostbite'" :stroke-width="2.4" aria-hidden="true" />
    <template #content><p>{{ status.description }}</p></template>
  </StatChip>
</template>
