<script setup lang="ts">
// Everything that is active on one participant, in one place and one order: harmful statuses, the enemy's rage, the hero's artifact.
// A tray is a single row or column of equal tokens next to the portrait (never on its face), so any number of them lines up.
import { Flame } from '@lucide/vue'
import StatChip from './StatChip.vue'
import StatusChip from './StatusChip.vue'
import ArtifactChip from './ArtifactChip.vue'
import type { StatusView } from '../game/statuses'
import type { BattleArtifactState } from '../game/types'

defineProps<{ statuses?: StatusView[]; artifact?: BattleArtifactState; turn?: number; rage?: number; label: string }>()
</script>

<template>
  <TransitionGroup v-if="statuses?.length || artifact || rage" tag="ul" name="chip" class="tray" role="group" :aria-label="label" data-critical>
    <li v-for="status in statuses" :key="status.id"><StatusChip :status="status" /></li>
    <li v-if="rage" key="rage"><StatChip tone="rage" label="Ярость" :aria="'Ярость, +' + rage + ' к урону'" :badge="'+' + rage" polarity="negative"><Flame :stroke-width="2.4" aria-hidden="true" /><template #content><p>Каждое действие противника, объявленное дальше, бьёт сильнее на {{ rage }}. Уже объявленное не меняется.</p></template></StatChip></li>
    <li v-if="artifact" key="artifact"><ArtifactChip :artifact="artifact" :turn="turn ?? 0" /></li>
  </TransitionGroup>
</template>

<style scoped>
.tray{display:flex;flex-wrap:wrap;gap:clamp(10px,1.6vh,16px);margin:0;padding:0 8px 8px 0;list-style:none}
.chip-enter-active{transition:opacity var(--dur-base),scale var(--dur-base) var(--ease-snap)}
.chip-leave-active{transition:opacity var(--dur-fast),scale var(--dur-fast)}
.chip-enter-from,.chip-leave-to{opacity:0;scale:.6}
</style>
