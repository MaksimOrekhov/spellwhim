<script setup lang="ts">
// The enemy as the largest thing on the stage: a round medallion (heroes are arches: different silhouettes read as "us" and "them").
// How dangerous it is shows in the frame, not in numbers: a brass rim for an ordinary foe, a crimson studded one for an elite, a
// gold-and-amethyst double rim with a tier tag for a boss. A second phase with a note is a different fight, so it also looks like
// one (ember rim, hotter portrait, a burst on the turn it begins). The health plate rides the lower rim of the medallion, the
// statuses and rage stand in a row under it (never on the face), and the intent banner of BattleBoard hangs below them.
// Portraits resolve by stable encounter ID and fall back while individual art is pending.
import { computed } from 'vue'
import { Crown, ShieldAlert } from '@lucide/vue'
import VitalBar from './VitalBar.vue'
import StatusTray from './StatusTray.vue'
import { resolveEnemyPortrait } from '../ui/enemyArt'
import { enemyTier, tierLabel } from '../ui/enemyTier'
import type { StatusView } from '../game/statuses'
import type { EnemyState } from '../game/types'

const props = defineProps<{ enemy: EnemyState; statuses?: StatusView[]; bleedTick?: number; acting?: boolean; hit?: boolean; turn?: number }>()
const hasPhases = computed(() => !!props.enemy.behavior.phase2)
const phase2 = computed(() => hasPhases.value && props.enemy.phase === 2)
// B1 enemy rules (the game since X04): a second phase that comes with a note is a different fight, so it also looks like one (hotter portrait, a burst on the turn it begins).
const rebuilt = computed(() => phase2.value && !!props.enemy.phaseNote)
const justShifted = computed(() => rebuilt.value && props.enemy.phaseShiftTurn === props.turn)
const rage = computed(() => props.enemy.power ?? 0)
// The words of the transition card stay on the badge all fight long.
const phaseTip = computed(() => rebuilt.value && props.enemy.phaseNote ? [props.enemy.phaseNote.title, ...props.enemy.phaseNote.lines].join('\n') : undefined)
const vulnerable = computed(() => props.statuses?.some(item => item.id === 'vulnerability') ?? false)
const portrait = computed(() => resolveEnemyPortrait(props.enemy.encounterId))
const tier = computed(() => enemyTier(props.enemy.encounterId))
</script>

<template>
  <article class="enemy" :class="['enemy--' + enemy.appearance, 'tier--' + tier, { 'is-acting': acting, 'is-hit': hit, 'is-vulnerable': vulnerable, 'is-p2': phase2, 'is-p2-rebuilt': rebuilt, 'is-shifting': justShifted, 'has-fallback-art': portrait.fallback }]" :aria-label="`${enemy.name}${tierLabel[tier] ? ', ' + tierLabel[tier].toLowerCase() : ''}, здоровье ${enemy.health} из ${enemy.maxHealth}, броня ${enemy.armor}${phase2 ? ', вторая фаза' : ''}`">
    <div class="medal" data-threat-source="enemy" data-fx-anchor="enemy">
      <span class="medal-aura"></span>
      <span class="medal-rim"></span>
      <span class="medal-art"><img :src="portrait.src" :alt="enemy.name" draggable="false" /></span>
      <span class="medal-gloss"></span>
      <span v-if="hasPhases" class="phase" :class="{ 'phase--2': phase2 }" role="status" :title="phaseTip"><span v-for="n in 2" :key="n" class="phase-pip" :class="{ on: enemy.phase >= n }"></span> Фаза {{ phase2 ? 'II' : 'I' }}</span>
      <span v-else-if="tier !== 'normal'" class="tier-tag" :class="'tier-tag--' + tier"><component :is="tier === 'boss' ? Crown : ShieldAlert" :size="14" :stroke-width="2.6" aria-hidden="true" />{{ tierLabel[tier] }}</span>
    </div>
    <div class="plate"><VitalBar :name="enemy.name" :subtitle="enemy.title" :health="enemy.health" :max="enemy.maxHealth" :armor="enemy.armor" :ghost="bleedTick" ghost-tone="strike" side="enemy" /></div>
    <StatusTray class="enemy-tray" :statuses="statuses" :rage="rage" :label="'Состояния: ' + enemy.name" />
  </article>
</template>

<style scoped>
.enemy{position:relative;display:flex;flex-direction:column;align-items:center;width:calc(var(--medal-d) * 1.42);--overlap:clamp(14px,4.4cqh,34px)}
.medal{position:relative;width:var(--medal-d);height:var(--medal-d);filter:drop-shadow(0 14px 16px #000b);transition:transform .3s var(--ease-out)}
.enemy.is-acting .medal{transform:scale(1.05) translateY(6px)}
.medal-aura{position:absolute;inset:-12%;border-radius:50%;background:radial-gradient(circle,#c48cff44,#0000 66%)}
.tier--elite .medal-aura{background:radial-gradient(circle,#ff5a3d44,#0000 66%)}
.tier--boss .medal-aura{inset:-16%;background:radial-gradient(circle,#d8a0ff66,#ffd56b22 50%,#0000 70%)}
.is-p2 .medal-aura{background:radial-gradient(circle,#ff6a3daa,#0000 68%)}
.is-p2-rebuilt .medal-aura{inset:-22%;background:radial-gradient(circle,#ff5a2dcc,#ff2a0033 55%,#0000 70%);animation:aura 2.2s ease-in-out infinite}
@keyframes aura{50%{opacity:.6;scale:1.05}}
.is-p2-rebuilt .medal-art img{filter:saturate(1.35) contrast(1.1) hue-rotate(-14deg) brightness(1.04)}
.is-shifting .medal{animation:rebuild 1.1s var(--ease-out)}
@keyframes rebuild{0%{scale:1;filter:drop-shadow(0 12px 16px #000b)}25%{scale:1.12;filter:drop-shadow(0 0 36px #ff5a2d) brightness(1.5)}60%{scale:.98}100%{scale:1}}
.medal-rim{position:absolute;inset:0;border-radius:var(--shape-medallion);background:conic-gradient(from 210deg,var(--brass-1),var(--brass-3),var(--brass-2),var(--brass-4),var(--brass-1))}
.medal-rim::after{content:'';position:absolute;inset:clamp(4px,.9cqh,7px);border-radius:var(--shape-medallion);background:conic-gradient(from 20deg,var(--wood-2),var(--brass-3),var(--wood-2),var(--wood-3),var(--wood-2));box-shadow:inset 0 0 6px #000}
/* elite: crimson bronze with a ring of studs */
.tier--elite .medal-rim{background:conic-gradient(from 210deg,#ffd0a0,#b2401c,#ff9a6d,#5a1a0c,#ffd0a0)}
.tier--elite .medal-rim::before{content:'';position:absolute;inset:3px;border-radius:inherit;border:clamp(3px,.7cqh,5px) dotted #ffd9b0;opacity:.85}
/* boss: gold outside, amethyst inside, a thicker frame */
.tier--boss .medal-rim{background:conic-gradient(from 210deg,#fff0b8,#b8862e,#ffe08a,#6a4a14,#e8c36a,#fff0b8)}
.tier--boss .medal-rim::after{inset:clamp(8px,1.8cqh,14px);background:conic-gradient(from 20deg,#2a1640,#8a5ac0,#2a1640,#5a3a82,#2a1640);box-shadow:inset 0 0 8px #000,0 0 0 2px #ffe08a99}
.tier--boss .medal-rim::before{content:'';position:absolute;inset:2px;border-radius:inherit;border:clamp(3px,.7cqh,5px) dotted #fff0b8;opacity:.8}
.medal-art{position:absolute;inset:clamp(9px,2cqh,16px);overflow:hidden;border-radius:50%;background:var(--wood-0);box-shadow:inset 0 0 16px #000c}
.tier--boss .medal-art{inset:clamp(14px,3cqh,24px)}
.medal-art img{width:100%;height:100%;object-fit:cover;transform:scale(1.06);display:block}
.enemy.has-fallback-art.enemy--root img{filter:hue-rotate(28deg) saturate(1.12)}
.enemy.has-fallback-art.enemy--heart img{filter:hue-rotate(295deg) saturate(1.2)}
.medal-gloss{position:absolute;inset:clamp(9px,2cqh,16px);border-radius:50%;pointer-events:none;background:radial-gradient(circle at 35% 18%,#fff3,#0000 40%),radial-gradient(circle,#0000 60%,#000a)}
.tier--boss .medal-gloss{inset:clamp(14px,3cqh,24px)}
.enemy.is-hit .medal-art img{animation:hit-flash .42s ease-out}
.enemy.is-hit .medal{animation:shake .42s ease-out}
@keyframes hit-flash{0%{filter:brightness(2.2) saturate(.4)}100%{filter:none}}
@keyframes shake{20%{translate:-7px 0}45%{translate:6px 0}70%{translate:-3px 0}}
.is-p2 .medal-rim{background:conic-gradient(from 210deg,#ffd9a0,#a53a1a,#ff9a5a,#5a1608,#ffd9a0)}
.is-vulnerable .medal-rim{box-shadow:0 0 0 3px var(--c-vulnerable),0 0 20px var(--c-vulnerable)}
.phase,.tier-tag{position:absolute;left:50%;top:-4px;translate:-50% -50%;z-index:3;display:flex;align-items:center;gap:6px;padding:2px 12px;border-radius:var(--r-pill);background:linear-gradient(#3a2a52,#1c1230);border:2px solid var(--gold);font:var(--fw-bold) clamp(10px,1.3vh,13px)/1.2 var(--font-ui);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--ink);white-space:nowrap;box-shadow:var(--shadow-2)}
.phase--2{background:linear-gradient(#6a1d0e,#33090a);border-color:var(--c-threat-line)}
.tier-tag--elite{background:linear-gradient(#6a1d0e,#33090a);border-color:var(--c-threat-line)}
.tier-tag--boss{background:linear-gradient(#4a2a72,#1c1230);border-color:#ffe08a}
.phase-pip{width:9px;height:9px;border-radius:50%;background:#0006;border:1px solid var(--gold)}
.phase-pip.on{background:var(--c-bonus);box-shadow:0 0 6px var(--c-bonus)}
.plate{position:relative;z-index:2;width:max(100%,clamp(210px,26cqw,420px));margin-top:calc(var(--overlap) * -1)}
/* Statuses stand on the right flank of the medallion, in columns that grow outwards, so they never cost the column any height. */
.enemy .enemy-tray{position:absolute;left:calc(50% + var(--medal-d) / 2 + clamp(6px,.9vw,14px));top:0;flex-flow:column wrap;align-content:flex-start;max-height:var(--medal-d);padding:0;gap:clamp(8px,1.2cqh,14px)}
</style>
