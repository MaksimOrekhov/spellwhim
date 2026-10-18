<script setup lang="ts">
// The enemy as a large round medallion (heroes are arches — different silhouettes read as "us" vs "them").
// Vulnerability is shown three ways: a reticle on the body, a hanging "+3" medallion, and gold numbers on the cards.
import { computed } from 'vue'
import type { EnemyState } from '../../game/types'
import { statusDefinitions } from '../../game/types'
import { portraits } from '../cardArt'
import VitalBar from './VitalBar.vue'
import GlyphIcon from './GlyphIcon.vue'

const props = defineProps<{ enemy: EnemyState; acting?: boolean; hit?: boolean; ghost?: number; vulnerable?: boolean }>()
const phase2 = computed(() => props.enemy.behavior.phase2 && props.enemy.phase === 2)
</script>

<template>
  <article class="enemy" :class="['enemy--' + enemy.appearance, { 'is-acting': acting, 'is-hit': hit, 'is-vuln': vulnerable, 'is-p2': phase2 }]" :aria-label="`${enemy.name}, здоровье ${enemy.health} из ${enemy.maxHealth}, броня ${enemy.armor}`">
    <div class="medal" data-anchor="enemy" data-fx-anchor="enemy">
      <span class="medal-aura"></span>
      <span class="medal-rim"></span>
      <span class="medal-art"><img :src="portraits.enemy" :alt="enemy.name" draggable="false" /></span>
      <span class="medal-gloss"></span>
      <svg v-if="vulnerable" class="reticle" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="84" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="10 8"/><circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" stroke-width="2"/><path d="M100 4v34M100 162v34M4 100h34M162 100h34" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>
      <span v-if="enemy.behavior.phase2" class="phase" :class="{ 'phase--2': phase2 }"><span v-for="n in 2" :key="n" class="phase-pip" :class="{ on: enemy.phase >= n }"></span> Фаза {{ enemy.phase === 2 ? 'II' : 'I' }}</span>
      <button v-if="vulnerable" class="vuln" :aria-label="statusDefinitions.vulnerability.name + ': ' + statusDefinitions.vulnerability.description">
        <GlyphIcon name="vulnerable" class="vuln-icon" /><span class="vuln-copy"><b>+3</b><small>{{ statusDefinitions.vulnerability.name }}</small></span>
        <span class="vuln-tip"><strong>{{ statusDefinitions.vulnerability.name }}</strong>{{ statusDefinitions.vulnerability.description }}<em>Сохраняется между ходами и не суммируется.</em></span>
      </button>
    </div>
    <div class="plate"><VitalBar :name="enemy.name" :subtitle="enemy.title" :health="enemy.health" :max="enemy.maxHealth" :armor="enemy.armor" :ghost="ghost" ghost-tone="strike" side="enemy" /></div>
  </article>
</template>

<style scoped>
.enemy{--d:var(--medal-d,19rem);position:relative;display:flex;flex-direction:column;align-items:center;width:25rem;gap:1.1rem}
.medal{position:relative;width:var(--d);height:var(--d);filter:drop-shadow(0 1rem 1.3rem #000b);transition:transform .3s var(--ease-out)}
.enemy.is-acting .medal{transform:scale(1.06) translateY(.6rem)}
.medal-aura{position:absolute;inset:-1.2rem;border-radius:50%;background:radial-gradient(circle,#c48cff55,#0000 68%);animation:aura 4s ease-in-out infinite}
@keyframes aura{50%{opacity:.55;scale:1.06}}
.is-p2 .medal-aura{background:radial-gradient(circle,#ff6a3daa,#0000 68%)}
.medal-rim{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 210deg,#f0d28a,#7a5424,#d9b56a,#4b3015,#f0d28a)}
.medal-rim::after{content:'';position:absolute;inset:.5rem;border-radius:50%;background:conic-gradient(from 20deg,#3f2a14,#8b6a35,#3f2a14,#6f4d22,#3f2a14);box-shadow:inset 0 0 .5rem #000}
.medal-art{position:absolute;inset:.95rem;overflow:hidden;border-radius:50%;background:#1d1030;box-shadow:inset 0 0 1.4rem #000c}
.medal-art img{width:100%;height:100%;object-fit:cover;transform:scale(1.06);display:block}
.enemy--root img{filter:hue-rotate(28deg) saturate(1.12)}
.enemy--heart img{filter:hue-rotate(295deg) saturate(1.2)}
.medal-gloss{position:absolute;inset:.95rem;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 35% 18%,#fff3,#0000 40%),radial-gradient(circle,#0000 60%,#000a)}
.enemy.is-hit .medal-art img{animation:hit-flash .42s ease-out}
.enemy.is-hit .medal{animation:shake .42s ease-out}
@keyframes hit-flash{0%{filter:brightness(2.2) saturate(.4)}100%{filter:none}}
@keyframes shake{20%{translate:-.6rem 0}45%{translate:.5rem 0}70%{translate:-.25rem 0}}
.is-p2 .medal-rim{background:conic-gradient(from 210deg,#ffd9a0,#a53a1a,#ff9a5a,#5a1608,#ffd9a0)}
.reticle{position:absolute;inset:-.9rem;width:calc(100% + 1.8rem);height:calc(100% + 1.8rem);color:var(--vuln);filter:drop-shadow(0 0 .5rem #ffb23dcc);animation:reticle 6s linear infinite;pointer-events:none}
@keyframes reticle{to{rotate:360deg}}
.phase{position:absolute;left:50%;top:-1.1rem;translate:-50% 0;display:flex;align-items:center;gap:.35rem;padding:.2rem .8rem;border-radius:1rem;background:linear-gradient(#3a2a52,#1c1230);border:.12rem solid #e8c978;font:800 .8rem/1.2 var(--f-ui);letter-spacing:.16em;text-transform:uppercase;color:#fff0c5;white-space:nowrap;box-shadow:0 .3rem .6rem #000a}
.phase--2{background:linear-gradient(#6a1d0e,#33090a);border-color:#ff9a6d}
.phase-pip{width:.55rem;height:.55rem;border-radius:50%;background:#0006;border:.08rem solid #e8c978}
.phase-pip.on{background:#ffd56b;box-shadow:0 0 .4rem #ffd56b}
.vuln{position:absolute;left:-1.6rem;bottom:1.2rem;z-index:4;display:flex;align-items:center;gap:.4rem;padding:.3rem .9rem .3rem .4rem;border-radius:2rem;background:linear-gradient(#5a3b05,#2c1b02);border:.16rem solid var(--vuln);color:#fff2d0;box-shadow:0 .4rem .9rem #000c,0 0 1.2rem #ffb23d99;animation:vuln-in .45s var(--ease-snap)}
.vuln-icon{width:2.6rem;height:2.6rem;color:var(--vuln)}
.vuln-copy{display:grid;text-align:left}
.vuln-copy b{font:800 1.6rem/1 var(--f-num);color:var(--bonus)}
.vuln-copy small{font:800 .66rem/1.1 var(--f-ui);letter-spacing:.1em;text-transform:uppercase;color:#ffdca3}
.vuln-tip{position:absolute;left:0;top:calc(100% + .6rem);width:17rem;padding:.8rem 1rem;border-radius:.5rem;background:linear-gradient(160deg,var(--parch-1),var(--parch-2));color:var(--ink);font:600 .88rem/1.35 var(--f-ui);text-align:left;box-shadow:0 .6rem 1.4rem #000b,0 0 0 .14rem var(--brass-3);opacity:0;visibility:hidden;transition:opacity .15s;pointer-events:none}
.vuln-tip strong{display:block;font:800 1.05rem var(--f-display);margin-bottom:.2rem}
.vuln-tip em{display:block;margin-top:.35rem;font-style:normal;color:#6a4a1c;font-size:.8rem}
.vuln:hover .vuln-tip,.vuln:focus-visible .vuln-tip{opacity:1;visibility:visible}
@keyframes vuln-in{from{scale:.4;opacity:0}}
.plate{width:21rem}
</style>
