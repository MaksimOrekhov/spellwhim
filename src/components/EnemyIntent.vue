<script setup lang="ts">
import GameTooltip from './GameTooltip.vue'
import type { EnemyAttackForecast } from '../game/battle'
defineProps<{ forecast: EnemyAttackForecast; targetName: string; executing: boolean }>()
</script>
<template>
  <GameTooltip :label="executing ? 'Атака противника' : 'Намерение противника'" placement="bottom">
    <div class="enemy-intent" :class="{ 'enemy-intent--executing': executing }" tabindex="0" aria-label="Прогноз атаки">
      <span class="intent-icon">⚔</span>
      <div><small>{{ executing ? 'Атакует сейчас' : 'Следующая атака' }}</small><strong>{{ targetName }} <span>· {{ forecast.attack }} урона</span></strong><p><span v-if="forecast.absorbed" class="intent-block">⬡ {{ forecast.absorbed }} поглотит броня</span><b :class="{ 'intent-safe': !forecast.healthLoss }">{{ forecast.healthLoss ? '−' + forecast.healthLoss + ' здоровья' : 'Урон полностью заблокирован' }}</b><em v-if="forecast.lethal">Смертельно</em></p></div>
    </div>
    <template #content><p>Враг атакует указанного героя, когда вы завершите общий ход отряда.</p><p>{{ forecast.attack }} урона − {{ forecast.absorbed }} брони = {{ forecast.healthLoss }} потери здоровья{{ forecast.lethal ? ' — герой погибнет.' : '.' }}</p><p>Защитные карты автоматически прикрывают цель врага.</p></template>
  </GameTooltip>
</template>
<style scoped>
.enemy-intent{display:flex;align-items:center;gap:14px;width:max-content;max-width:330px;padding:15px 19px;border-left:3px solid #d69662;border-radius:4px 12px 12px 4px;background:linear-gradient(100deg,#263d3ced,#2d4240b3);box-shadow:0 8px 24px #15313040}.intent-icon{font-size:28px;color:#edb47a}.enemy-intent small{display:block;color:#d5c7a3;font-size:14px;margin-bottom:5px}.enemy-intent strong{font:700 clamp(17px,1.35vw,23px) var(--display)}.enemy-intent strong span{font:400 16px 'Trebuchet MS',Arial,sans-serif;color:#f1d9ac}.enemy-intent p{display:flex;flex-wrap:wrap;gap:5px 10px;margin:8px 0 0;font-size:14px;max-width:260px}.intent-block{color:#a5dfe7}.enemy-intent b{color:#ffbd9e}.enemy-intent b.intent-safe{color:#b9dfb7}.enemy-intent em{font-style:normal;color:#ff977c}.enemy-intent--executing{background:#58382beb;border-color:#ffc18d;animation:enemy-approach .3s ease-out}@keyframes enemy-approach{from{transform:translateX(12px);opacity:.4}to{transform:translateX(0);opacity:1}}
@media(max-width:1100px){.enemy-intent{padding:12px;max-width:280px;gap:9px}.intent-icon{display:none}.enemy-intent strong{font-size:18px}.enemy-intent strong span{font-size:14px}}
@media(max-height:700px){.enemy-intent{padding:10px 14px}.enemy-intent small{font-size:13px;margin-bottom:3px}.enemy-intent p{margin-top:5px;font-size:13px}}
</style>
