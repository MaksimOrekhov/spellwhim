<script setup lang="ts">
// Enemy intent as a banner under the enemy: WHAT (icon + name), HOW MUCH (big number) and ON WHOM (hero avatars).
// A threat ray (ThreatRays.vue) then connects the banner to the portrait of each target.
import { computed } from 'vue'
import type { EnemyActionForecast } from '../../game/battle'
import type { HeroId } from '../../game/types'
import { portraits } from '../cardArt'
import GlyphIcon from './GlyphIcon.vue'
import type { GlyphName } from './GlyphIcon.vue'

const props = defineProps<{ forecast: EnemyActionForecast; names: Record<HeroId, string>; executing?: boolean }>()
const kind = computed(() => props.forecast.action.kind)
const icon = computed<GlyphName>(() => kind.value === 'defend' ? 'armor' : kind.value === 'recover' ? 'recover' : kind.value === 'prepare' ? 'wait' : kind.value === 'attack_all' ? 'attack-all' : 'damage')
const label = computed(() => ({ attack: 'Атака', attack_all: 'Атака по обоим', defend: 'Защита', prepare: 'Готовит удар', recover: 'Передышка' })[kind.value])
const hits = computed(() => props.forecast.targets.length ? props.forecast.targets : props.forecast.futureTargets)
const later = computed(() => !props.forecast.targets.length && props.forecast.futureTargets.length > 0)
</script>

<template>
  <div class="intent" :class="['intent--' + kind, { 'is-executing': executing }]" data-anchor="intent" role="group" :aria-label="'Намерение противника: ' + label + ', ' + forecast.action.name">
    <span class="intent-icon"><GlyphIcon :name="icon" /></span>
    <span class="intent-copy">
      <small>{{ label }}<template v-if="forecast.phase === 2"> · Фаза II</template></small>
      <strong>{{ forecast.action.name }}</strong>
      <em v-if="later">Сейчас без урона — следом удар</em>
      <em v-else-if="forecast.armorGain">Получит <b>+{{ forecast.armorGain }}</b> брони</em>
      <em v-else-if="forecast.targets.length > 1">Главная цель: {{ names[(forecast.action as { primaryTarget: HeroId }).primaryTarget] }}</em>
    </span>
    <span v-if="hits.length" class="intent-hits">
      <span v-for="hit in hits" :key="hit.target" class="hit" :class="{ 'is-lethal': hit.lethal, 'is-later': later }" :title="`${names[hit.target]}: ${hit.attack} урона, броня поглощает ${hit.absorbed}, здоровье −${hit.healthLoss}`">
        <img :src="portraits[hit.target]" alt="" draggable="false" />
        <b>{{ hit.healthLoss > 0 ? '−' + hit.healthLoss : '0' }}</b>
        <small v-if="hit.absorbed"><GlyphIcon name="armor" />{{ hit.absorbed }}</small>
        <GlyphIcon v-if="hit.lethal" name="skull" class="hit-skull" />
      </span>
    </span>
  </div>
</template>

<style scoped>
.intent{--c:#ff7a4d;position:relative;display:flex;align-items:center;gap:.9rem;min-width:25rem;max-width:40rem;padding:.7rem 1.1rem .7rem .7rem;border-radius:1.7rem 2.6rem 2.4rem 1.9rem/1.8rem 2.4rem 2.6rem 1.7rem;background:linear-gradient(100deg,#2a1710f2,#3d2518f2);border:.14rem solid var(--brass-3);box-shadow:0 .5rem 1.2rem #000b,inset 0 .1rem #ffffff22,inset .45rem 0 .6rem -.2rem var(--c)}
.intent--defend,.intent--recover{--c:#8fc2f0}
.intent--prepare{--c:#ffc15a}
.intent-icon{display:grid;place-items:center;flex:none;width:3.6rem;height:3.6rem;margin-left:.3rem;border-radius:50%;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 55%,#fff),var(--c) 55%,color-mix(in srgb,var(--c) 45%,#000));color:#2a1208;font-size:2rem;box-shadow:0 .2rem .5rem #000a,inset 0 0 .5rem #fff6}
.intent-copy{display:flex;flex-direction:column;gap:.12rem;min-width:0}
.intent-copy small{white-space:nowrap;font:800 .72rem/1.1 var(--f-ui);letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,var(--c) 70%,#fff)}
.intent-copy strong{font:800 1.4rem/1.1 var(--f-display);color:#fff3d6;white-space:nowrap}
.intent-copy em{white-space:nowrap;font:600 .86rem/1.25 var(--f-ui);font-style:normal;color:#e6cfb2}
.intent-copy em b{color:#bfe0ff}
.intent-hits{display:flex;gap:.6rem;margin-left:auto;padding-left:.4rem}
.hit{position:relative;display:grid;grid-template:auto auto/3rem auto;align-items:center;column-gap:.4rem;padding:.2rem .55rem .2rem .2rem;border-radius:2rem;background:#0008;border:.1rem solid #ff9a6d}
.hit.is-later{border-style:dashed;border-color:#e8b273}
.hit.is-lethal{border-color:#ff4a2b;box-shadow:0 0 .9rem #ff4a2baa}
.hit img{grid-row:1/3;width:3rem;height:3rem;border-radius:50%;object-fit:cover;object-position:46% 20%;border:.12rem solid var(--brass-2)}
.hit b{font:800 1.6rem/1 var(--f-num);color:#ffd6c6;text-shadow:0 .08rem .15rem #000}
.hit small{display:flex;align-items:center;gap:.15rem;font:700 .8rem/1 var(--f-num);color:#bfd8f2}
.hit small svg{width:.85rem;height:.85rem}
.hit-skull{position:absolute;right:-.4rem;top:-.55rem;width:1.3rem;height:1.3rem;padding:.15rem;border-radius:50%;background:#e23b22;color:#fff}
.intent.is-executing{animation:exec .5s ease-out;box-shadow:0 .5rem 1.2rem #000b,0 0 2rem var(--c),inset .35rem 0 0 var(--c)}
@keyframes exec{from{scale:1.07}}
</style>
