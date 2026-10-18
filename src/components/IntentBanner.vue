<script setup lang="ts">
// The enemy's announced action as a banner under its health plate: WHAT (icon + name), HOW MUCH and ON WHOM (hero avatars with
// the predicted loss). A prepared strike is shown with a dashed outline and the words "сейчас без урона": it is never drawn like
// a hit that lands this turn. ThreatRays connects the banner to each target. All numbers are the forecast's.
import { computed } from 'vue'
import { Hourglass, Shield, ShieldPlus, Skull, Swords, Sword } from '@lucide/vue'
import varianPortrait from '../assets/art/varian.jpg'
import jainaPortrait from '../assets/art/jaina.jpg'
import GameTooltip from './GameTooltip.vue'
import { intentSummary } from '../ui/threatDisplay'
import type { EnemyActionForecast } from '../game/battle'
import type { HeroId } from '../game/types'

const props = defineProps<{ forecast: EnemyActionForecast; heroNames: Record<HeroId, string>; executing: boolean }>()
const summary = computed(() => intentSummary(props.forecast))
const icon = computed(() => ({ attack: Sword, attack_all: Swords, defend: Shield, prepare: Hourglass, recover: ShieldPlus })[summary.value.kind])
const avatars: Record<HeroId, string> = { warrior: varianPortrait, mage: jainaPortrait }
</script>

<template>
  <GameTooltip :label="executing ? 'Действие противника' : 'Объявленное намерение'" placement="bottom" class="intent-tip">
    <div class="intent" :class="['intent--' + summary.kind, { 'is-executing': executing, 'is-later': summary.later }]" data-threat-source="intent" tabindex="0" role="group" :aria-label="'Намерение противника: ' + summary.label + ', ' + summary.name + (summary.later ? '. Сейчас без урона, удар на следующем ходу' : '')">
      <span class="intent-icon"><component :is="icon" :size="26" :stroke-width="2.3" aria-hidden="true" /></span>
      <span class="intent-copy">
        <small>{{ summary.label }}<template v-if="summary.phase === 2"> · Фаза II</template></small>
        <strong>{{ summary.name }}</strong>
        <em v-if="summary.later">Сейчас без урона — удар на следующем ходу</em>
        <em v-else-if="summary.armorGain">Получит <b>+{{ summary.armorGain }}</b> брони</em>
        <em v-else-if="summary.primaryTarget">Главная цель: {{ heroNames[summary.primaryTarget] }}</em>
      </span>
      <span v-if="summary.hits.length" class="intent-hits">
        <span v-for="hit in summary.hits" :key="hit.hero" class="hit" :class="{ 'is-lethal': hit.lethal, 'is-later': hit.timing === 'later', 'is-blocked': hit.blocked }">
          <img :src="avatars[hit.hero]" alt="" draggable="false" />
          <b>{{ hit.blocked ? 'блок' : '−' + hit.healthLoss }}</b>
          <small v-if="hit.absorbed"><Shield :size="12" :stroke-width="2.4" aria-hidden="true" />{{ hit.absorbed }}</small>
          <Skull v-if="hit.lethal" :size="20" class="hit-skull" aria-hidden="true" />
        </span>
      </span>
    </div>
    <template #content>
      <p>Показано точное действие, которое противник выполнит после конца хода отряда{{ summary.later ? '; сейчас он только готовит удар' : '' }}.</p>
      <p v-for="hit in forecast.targets" :key="'n' + hit.target">{{ heroNames[hit.target] }}: {{ hit.attack }} урона, броня поглощает {{ hit.absorbed }}, здоровье теряет {{ hit.healthLoss }}.</p>
      <p v-for="hit in forecast.futureTargets" :key="'f' + hit.target">Подготовленный удар: {{ heroNames[hit.target] }} получит {{ hit.attack }} урона на следующем действии (броня поглотит {{ hit.absorbed }}, здоровье потеряет {{ hit.healthLoss }}).</p>
      <p v-if="forecast.action.kind === 'attack_all'">В массовой атаке Стойка защищает главную цель, Бастион также защищает напарника.</p>
      <p v-if="forecast.armorGain">Противник восстановит {{ forecast.armorGain }} брони.</p>
    </template>
  </GameTooltip>
</template>

<style scoped>
.intent-tip{width:100%;justify-content:center}
.intent{--c:var(--c-threat);position:relative;display:flex;align-items:center;gap:clamp(8px,1.4vh,14px);min-width:clamp(270px,42vh,440px);max-width:min(560px,100%);padding:clamp(6px,1.1vh,11px) clamp(10px,1.6vh,18px) clamp(6px,1.1vh,11px) clamp(6px,1vh,10px);border-radius:var(--shape-banner);background:var(--mat-intent-plate);border:2px solid var(--brass-3);box-shadow:var(--shadow-3),var(--bevel-top),inset 6px 0 9px -4px var(--c)}
.intent--defend,.intent--recover{--c:var(--c-armor)}
.intent--prepare{--c:var(--c-later-line)}
.intent.is-later{border-style:dashed;border-color:var(--c-later-line)}
.intent-icon{display:grid;place-items:center;flex:none;width:clamp(34px,5.4vh,52px);height:clamp(34px,5.4vh,52px);margin-left:4px;border-radius:var(--shape-medallion);background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 55%,#fff),var(--c) 55%,color-mix(in srgb,var(--c) 45%,#000));color:var(--parch-ink);box-shadow:var(--shadow-2),inset 0 0 8px #fff6}
.intent-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.intent-copy small{white-space:nowrap;font:var(--fw-bold) clamp(9px,1.2vh,12px)/1.1 var(--font-ui);letter-spacing:var(--ls-caps);text-transform:uppercase;color:color-mix(in srgb,var(--c) 70%,#fff)}
.intent-copy strong{font:var(--fw-bold) clamp(15px,2.2vh,22px)/1.1 var(--font-display);color:var(--ink);white-space:nowrap}
.intent-copy em{white-space:nowrap;font:var(--fw-semibold) clamp(10px,1.35vh,14px)/1.25 var(--font-ui);font-style:normal;color:var(--text-dim)}
.intent-copy em b{color:var(--c-armor)}
.intent-hits{display:flex;gap:8px;margin-left:auto;padding-left:6px}
.hit{position:relative;display:grid;grid-template:auto auto / clamp(28px,4.4vh,44px) auto;align-items:center;column-gap:6px;padding:3px 10px 3px 3px;border-radius:var(--r-pill);background:#0008;border:2px solid var(--c-threat-line)}
.hit.is-later{border-style:dashed;border-color:var(--c-later-line)}
.hit.is-blocked{border-color:var(--c-armor)}
.hit.is-lethal{border-color:var(--c-lethal);box-shadow:var(--glow-lethal)}
.hit img{grid-row:1/3;width:clamp(28px,4.4vh,44px);height:clamp(28px,4.4vh,44px);border-radius:50%;object-fit:cover;object-position:50% 20%;border:2px solid var(--brass-2)}
.hit b{font:var(--fw-bold) clamp(15px,2.3vh,24px)/1 var(--font-num);color:#ffd6c6;text-shadow:0 1px 3px #000}
.hit.is-blocked b{color:var(--c-armor);font-size:clamp(12px,1.7vh,17px)}
.hit small{display:flex;align-items:center;gap:2px;font:var(--fw-bold) clamp(10px,1.3vh,13px)/1 var(--font-num);color:var(--c-armor)}
.hit-skull{position:absolute;right:-8px;top:-10px;padding:3px;border-radius:50%;background:var(--c-lethal);color:#fff}
.intent.is-executing{animation:exec .5s ease-out;box-shadow:var(--shadow-3),0 0 26px var(--c),inset 5px 0 0 var(--c)}
@keyframes exec{from{scale:1.07}}
.intent:focus-visible{outline:var(--focus-ring);outline-offset:3px}
</style>
