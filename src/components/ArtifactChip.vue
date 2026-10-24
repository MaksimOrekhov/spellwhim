<script setup lang="ts">
// The artifact carried by a hero, as a brass StatChip with a tooltip. Charges and notices stay in the engine; this only reads them.
import { computed } from 'vue'
import { Bell, Crosshair, Gauge, Link2, Shield } from '@lucide/vue'
import StatChip from './StatChip.vue'
import { artifactDefinition } from '../game/artifacts'
import type { BattleArtifactState } from '../game/types'

const props = defineProps<{ artifact: BattleArtifactState; turn: number }>()
const details = computed(() => artifactDefinition(props.artifact.definitionId))
const icon = computed(() => ({ shield: Shield, link: Link2, crosshair: Crosshair, bell: Bell, gauge: Gauge })[details.value.icon])
const status = computed(() => props.artifact.usedThisBattle ? 'заряд использован'
  : props.artifact.definitionId === 'tension-spool' ? props.artifact.lastTriggeredTurn === props.turn ? 'сработал в этом ходу' : props.artifact.armedThisTurn ? 'готов усилить первую атакующую карту отряда' : 'ждёт броню владельца в начале хода'
  : props.artifact.definitionId === 'double-pulley' && props.artifact.lastTriggeredTurn === props.turn ? 'сработал в этом ходу' : 'заряд готов')
// The spool and the pulley work once a turn; the other artifacts hold one charge per battle.
const perTurn = computed(() => props.artifact.definitionId === 'tension-spool' || props.artifact.definitionId === 'double-pulley')
</script>

<template>
  <StatChip tone="brass" :label="details.name" :aria="details.name + '. ' + details.description + ' Статус: ' + status" :polarity="artifact.usedThisBattle ? undefined : 'positive'" :spent="artifact.usedThisBattle">
    <component :is="icon" :stroke-width="2.1" aria-hidden="true" />
    <template #content><p>{{ details.description }}</p><p>Статус: {{ status }}. {{ perTurn ? 'Срабатывает не чаще раза за ход.' : 'Заряд восстанавливается перед следующим боем.' }}</p></template>
  </StatChip>
</template>
