<script setup lang="ts">
import GameTooltip from './GameTooltip.vue'
import type { EnemyActionForecast } from '../game/battle'
import type { HeroId } from '../game/types'
const props = defineProps<{ forecast: EnemyActionForecast; heroNames: Record<HeroId, string>; executing: boolean }>()
const actionLabel = (kind: string) => ({ attack: 'АТАКА', attack_all: 'АТАКА ПО ОБОИМ', defend: 'ЗАЩИТА', prepare: 'ГОТОВИТСЯ', recover: 'ВОССТАНОВЛЕНИЕ' }[kind] ?? kind)
</script>
<template>
  <GameTooltip :label="executing ? 'Действие противника' : 'Объявленное намерение'" placement="bottom">
    <div class="enemy-intent" :class="{ 'enemy-intent--executing': executing }" tabindex="0" aria-label="Объявленное действие противника">
      <span class="intent-icon">{{ forecast.action.kind === 'defend' || forecast.action.kind === 'recover' ? '⬡' : forecast.action.kind === 'prepare' ? '✦' : '⚔' }}</span>
      <div class="intent-copy">
        <small>{{ actionLabel(forecast.action.kind) }}<template v-if="forecast.phase === 2"> · ФАЗА II</template></small>
        <strong>{{ forecast.action.name }}</strong>
        <div v-if="forecast.targets.length" class="intent-targets">
          <p v-for="hit in forecast.targets" :key="hit.target"><b>{{ heroNames[hit.target] }}</b><span v-if="forecast.action.kind === 'attack_all' && forecast.action.primaryTarget === hit.target" class="intent-primary">главная цель</span><span>{{ hit.attack }} урона</span><span v-if="hit.absorbed" class="intent-block">⬡ {{ hit.absorbed }} броня</span><em :class="{ 'intent-safe': !hit.healthLoss }">{{ hit.healthLoss ? '−' + hit.healthLoss + ' HP' : 'блок' }}</em><i v-if="hit.lethal">смертельно</i></p>
        </div>
        <p v-if="forecast.futureTargets.length" class="intent-future"><template v-if="forecast.action.kind === 'prepare'">Сейчас без урона. Следом: </template><template v-else>Следом: </template><template v-for="(hit, index) in forecast.futureTargets" :key="hit.target"><span v-if="index">; </span>{{ heroNames[hit.target] }} — {{ hit.attack }} урона</template></p>
        <p v-if="forecast.armorGain" class="intent-defense">Получит {{ forecast.armorGain }} брони</p>
      </div>
    </div>
    <template #content>
      <p>Показано точное действие, которое противник выполнит после конца хода отряда.</p>
      <p v-for="hit in forecast.targets" :key="hit.target">{{ heroNames[hit.target] }}: {{ hit.attack }} урона, броня поглощает {{ hit.absorbed }}, здоровье теряет {{ hit.healthLoss }}.</p>
      <p v-for="hit in forecast.futureTargets" :key="hit.target">Подготовленная атака: {{ heroNames[hit.target] }} получит {{ hit.attack }} урона на следующем действии.</p>
      <p v-if="forecast.action.kind === 'attack_all'">В массовой атаке Стойка защищает главную цель, Бастион также защищает напарника.</p>
      <p v-if="forecast.armorGain">Противник восстановит {{ forecast.armorGain }} брони.</p>
    </template>
  </GameTooltip>
</template>
<style scoped>
.enemy-intent{display:flex;align-items:center;gap:12px;max-width:390px;min-width:260px;padding:14px 17px;border-left:3px solid #d69662;border-radius:4px 12px 12px 4px;background:linear-gradient(100deg,#263d3ced,#2d4240e8);box-shadow:0 8px 24px #15313040}.intent-icon{font-size:28px;color:#edb47a}.intent-copy{min-width:0}.enemy-intent small{display:block;color:#efc27f;font-size:14px;letter-spacing:.12em;margin-bottom:3px}.enemy-intent strong{font:700 clamp(17px,1.25vw,22px) var(--display)}.intent-targets p{display:flex;flex-wrap:wrap;gap:3px 8px;margin:7px 0 0;font-size:14px}.intent-targets b{color:#fff0cf}.intent-targets span{color:#e9d2aa}.intent-targets .intent-primary{color:#f4cf87;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.intent-block{color:#9ce7ef!important}.intent-targets em{font-style:normal;color:#ffb397}.intent-targets em.intent-safe{color:#b9dfb7}.intent-targets i{font-style:normal;color:#ff8e7b}.intent-future,.intent-defense{margin:7px 0 0;font-size:14px;color:#cce9ee}.intent-defense{color:#9ce7ef}.enemy-intent--executing{background:#58382beb;border-color:#ffc18d;animation:enemy-approach .3s ease-out}@keyframes enemy-approach{from{transform:translateX(12px);opacity:.4}to{transform:translateX(0);opacity:1}}
@media(max-width:1000px){.enemy-intent{min-width:220px;max-width:300px;padding:10px;gap:8px}.intent-icon{display:none}.intent-targets p,.intent-future,.intent-defense{font-size:12px}.enemy-intent small{font-size:12px}.enemy-intent strong{font-size:17px}}
</style>
