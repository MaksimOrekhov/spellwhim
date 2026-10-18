<script setup lang="ts">
// The artifact carried by a hero as a brass medallion with a tooltip. Charges and notices stay in the engine; this only reads them.
import { computed } from 'vue'
import { Bell, Crosshair, Gauge, Link2, Shield } from '@lucide/vue'
import GameTooltip from './GameTooltip.vue'
import { artifactDefinition } from '../game/artifacts'
import type { BattleArtifactState } from '../game/types'

const props = defineProps<{ artifact: BattleArtifactState; turn: number }>()
const details = computed(() => artifactDefinition(props.artifact.definitionId))
const icon = computed(() => ({ shield: Shield, link: Link2, crosshair: Crosshair, bell: Bell, gauge: Gauge })[details.value.icon])
const status = computed(() => props.artifact.usedThisBattle ? 'заряд использован'
  : props.artifact.definitionId === 'tension-spool' ? props.artifact.lastTriggeredTurn === props.turn ? 'сработал в этом ходу' : props.artifact.armedThisTurn ? 'готов усилить первую атакующую карту отряда' : 'ждёт броню владельца в начале хода'
  : props.artifact.definitionId === 'double-pulley' && props.artifact.lastTriggeredTurn === props.turn ? 'сработал в этом ходу' : 'заряд готов')
</script>

<template>
  <GameTooltip :label="details.name" class="artifact" :class="{ 'is-spent': artifact.usedThisBattle }">
    <button class="artifact-chip" :aria-label="details.name + '. ' + details.description + ' Статус: ' + status">
      <component :is="icon" :size="22" :stroke-width="2.1" aria-hidden="true" />
    </button>
    <template #content><p>{{ details.description }}</p><p>Статус: {{ status }}. Заряд боя восстанавливается перед следующим боем.</p></template>
  </GameTooltip>
</template>

<style scoped>
.artifact-chip{display:grid;place-items:center;width:clamp(30px,4.6vh,40px);height:clamp(30px,4.6vh,40px);border:var(--border-brass);border-radius:var(--shape-medallion);background:var(--mat-brass);color:var(--parch-ink);box-shadow:var(--shadow-2),var(--bevel-top)}
.is-spent .artifact-chip{filter:saturate(.45);opacity:.78}
.artifact-chip:focus-visible{outline:var(--focus-ring);outline-offset:2px}
</style>
