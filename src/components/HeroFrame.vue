<script setup lang="ts">
// A party member as a tall arch portrait, built like the cards: the same silhouette for both heroes, the class in the material.
// Varian's frame is studded bronze and steel, Jaina's is sapphire with a violet inner light; each carries its class seal on the
// lower rim. The health plate rides the TOP of the arch (it hangs over the dome's shoulders), so everything that must stay readable
// sits at the top of the figure and the hand, which comes up from below, never reaches it. Statuses and the artifact stand in a
// column on the OUTER side of the portrait, away from the face and from the threat marker on the inner side.
// The portrait states the hero and one thing about the threat: a marker and a rim colour, no numbers. The exact loss is the ghost
// segment of the health bar and the number in the enemy's banner. A prepared strike only marks its target (dashed amber rim,
// hourglass): its size is not public yet, and the mark carries no figure to show. It receives HeroMark (ui/threatDisplay.ts),
// not the engine's forecast.
import { computed } from 'vue'
import { Crosshair, Hourglass, ShieldCheck, Skull } from '@lucide/vue'
import varianPortrait from '../assets/art/varian-krea.webp'
import jainaPortrait from '../assets/art/jaina-krea.webp'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import VitalBar from './VitalBar.vue'
import StatusTray from './StatusTray.vue'
import { markSpoken } from '../ui/threatDisplay'
import type { StatusView } from '../game/statuses'
import type { BattleArtifactState, Hero } from '../game/types'
import type { HeroMark } from '../ui/threatDisplay'

const props = defineProps<{ hero: Hero; artifacts?: BattleArtifactState[]; statuses?: StatusView[]; turn: number; threat?: HeroMark; acting?: boolean; hit?: boolean; hitWeight?: 'light' | 'normal' | 'heavy'; side?: 'left' | 'right' }>()
const portrait = computed(() => props.hero.id === 'warrior' ? varianPortrait : jainaPortrait)
const style = computed(() => classThemeStyle(props.hero.classId))
const emblem = computed(() => getClassTheme(props.hero.classId).emblem)
const artifact = computed(() => props.artifacts?.find(item => item.ownerInstanceId === props.hero.instanceId))
const prepared = computed(() => props.threat?.when === 'prepared')
const now = computed(() => props.threat?.when === 'now')
const lethal = computed(() => props.threat?.when === 'now' && props.threat.lethal)
const blocked = computed(() => props.threat?.when === 'now' && props.threat.blocked)
const ghost = computed(() => props.threat?.when === 'now' ? props.threat.healthLoss : 0)
const marker = computed(() => lethal.value ? Skull : blocked.value ? ShieldCheck : prepared.value ? Hourglass : Crosshair)
const threatText = computed(() => props.threat ? markSpoken(props.threat, props.hero.name) : '')
</script>

<template>
  <article class="hero" :class="['hero--' + hero.id, 'hero--' + (side ?? 'left'), { 'is-threat': now, 'is-prepared': prepared, 'is-lethal': lethal, 'is-blocked': blocked, 'is-acting': acting, 'is-hit': hit, 'is-hit--light': hit && hitWeight === 'light', 'is-hit--heavy': hit && hitWeight === 'heavy' }]" :style="style" :aria-label="`${hero.name}, здоровье ${hero.health} из ${hero.maxHealth}, броня ${hero.armor}${threatText ? '. ' + threatText : ''}`">
    <div class="hero-plate"><VitalBar :name="hero.name" :subtitle="hero.title" :health="hero.health" :max="hero.maxHealth" :armor="hero.armor" :ghost="ghost" :lethal="lethal" side="hero" /></div>
    <div class="arch" :data-threat-target="hero.id" :data-fx-anchor="hero.id">
      <span class="arch-rim"></span>
      <span class="arch-art"><img :src="portrait" :alt="hero.name" draggable="false" /></span>
      <span class="arch-gloss"></span>
      <span class="seal" aria-hidden="true"><img :src="emblem" alt="" draggable="false" /></span>
      <span v-if="threat" class="mark" :class="{ 'mark--prepared': prepared, 'mark--blocked': blocked, 'mark--lethal': lethal }" aria-hidden="true"><component :is="marker" :size="22" :stroke-width="2.4" /></span>
    </div>
    <StatusTray class="hero-tray" :statuses="statuses" :artifact="artifact" :turn="turn" :label="'Состояния: ' + hero.name" />
  </article>
</template>

<style scoped>
.hero{position:relative;display:flex;flex-direction:column;align-items:center;width:var(--arch-w);transition:transform .3s var(--ease-out);--overlap:clamp(10px,2.2cqh,20px)}
.hero.is-acting{transform:translateY(-8px)}
.hero-plate{position:relative;z-index:3;width:max(calc(var(--arch-w) * 1.22),clamp(150px,13vw,300px));margin-bottom:calc(var(--overlap) * -1)}
.arch{position:relative;width:var(--arch-w);height:var(--arch-h);filter:drop-shadow(0 12px 12px #000a)}
.arch-rim,.arch-art,.arch-gloss{position:absolute;display:block}
.arch-rim{inset:0;border-radius:var(--shape-arch);background:linear-gradient(160deg,var(--brass-1) 0%,var(--class-accent) 22%,var(--brass-3) 52%,var(--class-accent) 76%,var(--brass-4) 100%);box-shadow:inset 0 2px 2px #fff8,inset 0 -3px 5px #0007}
/* warrior: studded plate. The dotted ring follows the arch and reads as a row of rivets. */
.hero--warrior .arch-rim::before{content:'';position:absolute;inset:2px;border-radius:inherit;border:3px dotted color-mix(in srgb,var(--brass-1) 80%,#fff);opacity:.9}
/* mage: enamelled sapphire with a violet inner light. */
.hero--mage .arch-rim{background:linear-gradient(160deg,color-mix(in srgb,var(--class-secondary) 55%,#fff) 0%,var(--class-primary) 24%,var(--brass-3) 52%,var(--class-primary) 78%,var(--brass-4) 100%)}
.hero--mage .arch-rim::before{content:'';position:absolute;inset:3px;border-radius:inherit;border:2px solid color-mix(in srgb,var(--class-secondary) 70%,#fff);box-shadow:0 0 10px var(--class-secondary),inset 0 0 8px var(--class-secondary);opacity:.85}
.arch-art{inset:7px;overflow:hidden;border-radius:50% 50% 1.5rem 1.5rem / 33% 33% 1.5rem 1.5rem;background:var(--wood-1);box-shadow:inset 0 0 14px #000b}
.arch-art img{width:100%;height:100%;object-fit:cover;object-position:50% 24%;display:block;transform:scale(1.12);transform-origin:50% 25%;transition:transform .5s var(--ease-out),filter .3s}
.hero:hover .arch-art img{transform:scale(1.16)}
.arch-gloss{inset:7px;border-radius:50% 50% 1.5rem 1.5rem / 33% 33% 1.5rem 1.5rem;pointer-events:none;background:linear-gradient(180deg,#fff2 0,#0000 28%,#0000 62%,#000a 100%);box-shadow:inset 0 0 0 1px #ffffff22}
.seal{position:absolute;z-index:2;left:50%;bottom:-6px;translate:-50% 0;box-sizing:border-box;display:grid;place-items:center;width:clamp(26px,3.8vh,40px);height:clamp(26px,3.8vh,40px);padding:clamp(4px,.7vh,7px);border-radius:var(--shape-medallion);background:radial-gradient(circle at 34% 26%,color-mix(in srgb,var(--class-primary) 70%,var(--class-surface)),var(--class-surface) 75%);border:2px solid var(--brass-1);box-shadow:0 3px 6px #000a,inset 0 1px 2px #fff6}
.seal img{width:100%;height:100%;display:block}
.hero.is-acting .arch{filter:drop-shadow(0 12px 12px #000a) drop-shadow(0 0 14px var(--class-secondary))}
.hero.is-hit .arch-art img{animation:hit-flash .42s ease-out}
.hero.is-hit .arch{animation:shake .42s ease-out}
.hero.is-hit--light .arch{animation:shake-light .28s ease-out}
.hero.is-hit--heavy .arch{animation:shake-heavy .52s ease-out}
.hero.is-hit--heavy .arch-art img{animation:hit-flash-heavy .52s ease-out}
@keyframes hit-flash{0%{filter:brightness(2.2) saturate(.4)}100%{filter:none}}
@keyframes shake{20%{translate:-6px 0}45%{translate:5px 0}70%{translate:-2px 0}}
@keyframes shake-light{25%{translate:-3px 0}60%{translate:2px 0}}
@keyframes shake-heavy{12%{translate:-11px 2px}30%{translate:9px -1px}50%{translate:-6px 0}72%{translate:3px 0}}
@keyframes hit-flash-heavy{0%{filter:brightness(2.8) saturate(.3)}35%{filter:brightness(1.5) saturate(.7)}100%{filter:none}}
/* The rim says it all: hot when a hit lands this turn, deep red when it would kill, steel when armor takes it, dashed amber for a strike still being prepared. Static: nothing pulses. */
.hero.is-threat .arch-rim{background:linear-gradient(160deg,#ffd9a8 0%,var(--c-threat) 24%,#8a2a10 55%,var(--c-threat) 80%,#5a1608 100%)}
.hero.is-lethal .arch{filter:drop-shadow(0 12px 12px #000a) drop-shadow(0 0 12px var(--c-lethal))}
.hero.is-lethal .arch-rim{background:linear-gradient(160deg,#ffb8a8 0%,var(--c-lethal) 24%,#5a0a06 55%,var(--c-lethal) 80%,#3a0503 100%)}
.hero.is-blocked .arch-rim{background:linear-gradient(160deg,#eaf6ff 0%,var(--c-armor) 24%,var(--c-armor-deep) 55%,var(--c-armor) 80%,#243a52 100%)}
.hero.is-prepared .arch-rim{background:repeating-linear-gradient(160deg,var(--c-later-line) 0 14px,#7a4a24 14px 24px)}
/* The marker sits on the inner shoulder, where the threat ray arrives. */
.mark{position:absolute;z-index:3;top:34%;display:grid;place-items:center;width:clamp(30px,4.4vh,42px);height:clamp(30px,4.4vh,42px);border-radius:50%;background:var(--mat-threat-plate);border:2px solid var(--c-threat-line);color:var(--c-threat);box-shadow:var(--shadow-3),var(--glow-threat)}
.hero--left .mark{right:-18%;translate:0 -50%}
.hero--right .mark{left:-18%;translate:0 -50%}
.mark--prepared{border:2px dashed var(--c-later-line);color:var(--c-later-line);box-shadow:var(--shadow-3)}
.mark--blocked{background:linear-gradient(#173049,#0b1a2a);border-color:var(--c-armor);color:var(--c-armor);box-shadow:var(--shadow-3)}
.mark--lethal{background:var(--c-lethal);border-color:#ffd0c6;color:#fff;box-shadow:var(--shadow-3),var(--glow-lethal)}
/* Statuses stand beside the arch on its outer side, lined up from its lower half upwards. */
.hero .hero-tray{position:absolute;bottom:4px;flex-direction:column-reverse;flex-wrap:nowrap;align-items:center;padding:0}
.hero--left .hero-tray{right:100%;margin-right:clamp(6px,.9vw,14px)}
.hero--right .hero-tray{left:100%;margin-left:clamp(6px,.9vw,14px)}
</style>
