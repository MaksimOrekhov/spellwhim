<script setup lang="ts">
// The enemy as a large round medallion (heroes are arches: different silhouettes read as "us" and "them"). Statuses hang on
// the medallion as pills, the second phase of a boss is a labelled badge and a hotter rim, and the health plate below it is
// the same VitalBar as the heroes'. The portrait art is the temporary guardian image; no new enemy art is part of this stage.
import { computed } from 'vue'
import guardianPortrait from '../assets/art/guardian.jpg'
import VitalBar from './VitalBar.vue'
import StatusChip from './StatusChip.vue'
import type { StatusView } from '../game/statuses'
import type { EnemyState } from '../game/types'

const props = defineProps<{ enemy: EnemyState; statuses?: StatusView[]; bleedTick?: number; acting?: boolean; hit?: boolean }>()
const hasPhases = computed(() => !!props.enemy.behavior.phase2)
const phase2 = computed(() => hasPhases.value && props.enemy.phase === 2)
const vulnerable = computed(() => props.statuses?.some(item => item.id === 'vulnerability') ?? false)
</script>

<template>
  <article class="enemy" :class="['enemy--' + enemy.appearance, { 'is-acting': acting, 'is-hit': hit, 'is-vulnerable': vulnerable, 'is-p2': phase2 }]" :aria-label="`${enemy.name}, здоровье ${enemy.health} из ${enemy.maxHealth}, броня ${enemy.armor}${phase2 ? ', вторая фаза' : ''}`">
    <div class="medal" data-threat-source="enemy" data-fx-anchor="enemy">
      <span class="medal-aura"></span>
      <span class="medal-rim"></span>
      <span class="medal-art"><img :src="guardianPortrait" :alt="enemy.name" draggable="false" /></span>
      <span class="medal-gloss"></span>
      <span v-if="hasPhases" class="phase" :class="{ 'phase--2': phase2 }" role="status"><span v-for="n in 2" :key="n" class="phase-pip" :class="{ on: enemy.phase >= n }"></span> Фаза {{ phase2 ? 'II' : 'I' }}</span>
      <div v-if="statuses?.length" class="status-rack"><StatusChip v-for="status in statuses" :key="status.id" :status="status" /></div>
    </div>
    <div class="plate"><VitalBar :name="enemy.name" :subtitle="enemy.title" :health="enemy.health" :max="enemy.maxHealth" :armor="enemy.armor" :ghost="bleedTick" ghost-tone="strike" side="enemy" /></div>
  </article>
</template>

<style scoped>
.enemy{position:relative;display:flex;flex-direction:column;align-items:center;width:calc(var(--medal-d) * 1.55);gap:clamp(10px,1.7vh,18px)}
.medal{position:relative;width:var(--medal-d);height:var(--medal-d);filter:drop-shadow(0 12px 16px #000b);transition:transform .3s var(--ease-out)}
.enemy.is-acting .medal{transform:scale(1.06) translateY(8px)}
.medal-aura{position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(circle,#c48cff55,#0000 68%);animation:aura 4s ease-in-out infinite}
@keyframes aura{50%{opacity:.55;scale:1.06}}
.is-p2 .medal-aura{background:radial-gradient(circle,#ff6a3daa,#0000 68%)}
.medal-rim{position:absolute;inset:0;border-radius:var(--shape-medallion);background:conic-gradient(from 210deg,var(--brass-1),var(--brass-3),var(--brass-2),var(--brass-4),var(--brass-1))}
.medal-rim::after{content:'';position:absolute;inset:6px;border-radius:var(--shape-medallion);background:conic-gradient(from 20deg,var(--wood-2),var(--brass-3),var(--wood-2),var(--wood-3),var(--wood-2));box-shadow:inset 0 0 6px #000}
.medal-art{position:absolute;inset:11px;overflow:hidden;border-radius:50%;background:var(--wood-0);box-shadow:inset 0 0 16px #000c}
.medal-art img{width:100%;height:100%;object-fit:cover;transform:scale(1.06);display:block}
.enemy--root img{filter:hue-rotate(28deg) saturate(1.12)}
.enemy--heart img{filter:hue-rotate(295deg) saturate(1.2)}
.medal-gloss{position:absolute;inset:11px;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 35% 18%,#fff3,#0000 40%),radial-gradient(circle,#0000 60%,#000a)}
.enemy.is-hit .medal-art img{animation:hit-flash .42s ease-out}
.enemy.is-hit .medal{animation:shake .42s ease-out}
@keyframes hit-flash{0%{filter:brightness(2.2) saturate(.4)}100%{filter:none}}
@keyframes shake{20%{translate:-7px 0}45%{translate:6px 0}70%{translate:-3px 0}}
.is-p2 .medal-rim{background:conic-gradient(from 210deg,#ffd9a0,#a53a1a,#ff9a5a,#5a1608,#ffd9a0)}
.is-vulnerable .medal-rim{box-shadow:0 0 0 3px var(--c-vulnerable),0 0 20px var(--c-vulnerable)}
.phase{position:absolute;left:50%;top:-12px;translate:-50% 0;z-index:3;display:flex;align-items:center;gap:6px;padding:2px 12px;border-radius:var(--r-pill);background:linear-gradient(#3a2a52,#1c1230);border:2px solid var(--gold);font:var(--fw-bold) clamp(10px,1.3vh,13px)/1.2 var(--font-ui);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--ink);white-space:nowrap;box-shadow:var(--shadow-2)}
.phase--2{background:linear-gradient(#6a1d0e,#33090a);border-color:var(--c-threat-line)}
.phase-pip{width:9px;height:9px;border-radius:50%;background:#0006;border:1px solid var(--gold)}
.phase-pip.on{background:var(--c-bonus);box-shadow:0 0 6px var(--c-bonus)}
.status-rack{position:absolute;z-index:3;left:calc(-1 * clamp(10px,2vh,24px));bottom:6px;display:flex;flex-direction:column;align-items:flex-start;gap:5px}
.plate{width:100%}
</style>
