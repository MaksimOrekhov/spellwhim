<script setup lang="ts">
// A party member as a tall arch portrait. The portrait states the hero (health bar, armor, statuses) and one thing about the
// threat: a marker and a rim colour, no numbers. The exact loss is the ghost segment of the health bar and the number in the
// enemy's banner. A prepared strike only marks its target (dashed amber rim, hourglass): its size is not public yet, and the
// mark carries no figure to show. It receives HeroMark (ui/threatDisplay.ts), not the engine's forecast.
import { computed } from 'vue'
import { Crosshair, Hourglass, ShieldCheck, Skull } from '@lucide/vue'
import varianPortrait from '../assets/art/varian-krea.webp'
import jainaPortrait from '../assets/art/jaina-krea.webp'
import { classThemeStyle } from '../game/classThemes'
import VitalBar from './VitalBar.vue'
import StatusChip from './StatusChip.vue'
import ArtifactChip from './ArtifactChip.vue'
import { markSpoken } from '../ui/threatDisplay'
import type { StatusView } from '../game/statuses'
import type { BattleArtifactState, Hero } from '../game/types'
import type { HeroMark } from '../ui/threatDisplay'

const props = defineProps<{ hero: Hero; artifacts?: BattleArtifactState[]; statuses?: StatusView[]; turn: number; threat?: HeroMark; acting?: boolean; hit?: boolean }>()
const portrait = computed(() => props.hero.id === 'warrior' ? varianPortrait : jainaPortrait)
const style = computed(() => classThemeStyle(props.hero.classId))
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
  <article class="hero" :class="['hero--' + hero.id, { 'is-threat': now, 'is-prepared': prepared, 'is-lethal': lethal, 'is-blocked': blocked, 'is-acting': acting, 'is-hit': hit }]" :style="style" :aria-label="`${hero.name}, здоровье ${hero.health} из ${hero.maxHealth}, броня ${hero.armor}${threatText ? '. ' + threatText : ''}`">
    <div class="arch" :data-threat-target="hero.id" :data-fx-anchor="hero.id">
      <span class="arch-rim"></span>
      <span class="arch-art"><img :src="portrait" :alt="hero.name" draggable="false" /></span>
      <span class="arch-gloss"></span>
      <span v-if="threat" class="mark" :class="{ 'mark--prepared': prepared, 'mark--blocked': blocked, 'mark--lethal': lethal }" aria-hidden="true"><component :is="marker" :size="24" :stroke-width="2.4" /></span>
      <div class="side-rack side-rack--statuses" v-if="statuses?.length"><StatusChip v-for="status in statuses" :key="status.id" :status="status" /></div>
      <div class="side-rack side-rack--artifact" v-if="artifact"><ArtifactChip :artifact="artifact" :turn="turn" /></div>
    </div>
    <VitalBar :name="hero.name" :subtitle="hero.title" :health="hero.health" :max="hero.maxHealth" :armor="hero.armor" :ghost="ghost" :lethal="lethal" side="hero" />
  </article>
</template>

<style scoped>
.hero{position:relative;display:flex;flex-direction:column;align-items:center;width:var(--arch-w);gap:clamp(14px,2.3vh,26px);transition:transform .3s var(--ease-out)}
.hero.is-acting{transform:translateY(-8px)}
.arch{position:relative;width:var(--arch-w);height:var(--arch-h);filter:drop-shadow(0 12px 14px #000b)}
.arch-rim,.arch-art,.arch-gloss{position:absolute;display:block}
.arch-rim{inset:0;border-radius:var(--shape-arch);background:linear-gradient(160deg,var(--brass-1) 0%,var(--class-accent) 22%,var(--brass-3) 52%,var(--class-accent) 76%,var(--brass-4) 100%)}
.arch-art{inset:6px;overflow:hidden;border-radius:50% 50% 1.5rem 1.5rem / 33% 33% 1.5rem 1.5rem;background:var(--wood-1);box-shadow:inset 0 0 14px #000b}
.arch-art img{width:100%;height:100%;object-fit:cover;object-position:50% 24%;display:block;transform:scale(1.12);transform-origin:50% 25%;transition:transform .5s var(--ease-out),filter .3s}
.hero:hover .arch-art img{transform:scale(1.16)}
.arch-gloss{inset:6px;border-radius:50% 50% 1.5rem 1.5rem / 33% 33% 1.5rem 1.5rem;pointer-events:none;background:linear-gradient(180deg,#fff2 0,#0000 28%,#0000 62%,#000a 100%);box-shadow:inset 0 0 0 1px #ffffff22}
.hero.is-hit .arch-art img{animation:hit-flash .42s ease-out}
.hero.is-hit .arch{animation:shake .42s ease-out}
@keyframes hit-flash{0%{filter:brightness(2.2) saturate(.4)}100%{filter:none}}
@keyframes shake{20%{translate:-6px 0}45%{translate:5px 0}70%{translate:-2px 0}}
/* The rim says it all: hot when a hit lands this turn, deep red when it would kill, steel when armor takes it, dashed amber for a strike still being prepared. Static: nothing pulses. */
.hero.is-threat .arch-rim{background:linear-gradient(160deg,#ffd9a8 0%,var(--c-threat) 24%,#8a2a10 55%,var(--c-threat) 80%,#5a1608 100%)}
.hero.is-lethal .arch{filter:drop-shadow(0 12px 14px #000b) drop-shadow(0 0 16px var(--c-lethal))}
.hero.is-lethal .arch-rim{background:linear-gradient(160deg,#ffb8a8 0%,var(--c-lethal) 24%,#5a0a06 55%,var(--c-lethal) 80%,#3a0503 100%)}
.hero.is-blocked .arch-rim{background:linear-gradient(160deg,#eaf6ff 0%,var(--c-armor) 24%,var(--c-armor-deep) 55%,var(--c-armor) 80%,#243a52 100%)}
.hero.is-prepared .arch-rim{background:repeating-linear-gradient(160deg,var(--c-later-line) 0 14px,#7a4a24 14px 24px)}
.mark{position:absolute;z-index:3;left:50%;top:calc(-1 * clamp(14px,2.2vh,22px));translate:-50% 0;display:grid;place-items:center;width:clamp(34px,5vh,46px);height:clamp(34px,5vh,46px);border-radius:50%;background:var(--mat-threat-plate);border:2px solid var(--c-threat-line);color:var(--c-threat);box-shadow:var(--shadow-3),var(--glow-threat)}
.mark--prepared{border:2px dashed var(--c-later-line);color:var(--c-later-line);box-shadow:var(--shadow-3)}
.mark--blocked{background:linear-gradient(#173049,#0b1a2a);border-color:var(--c-armor);color:var(--c-armor);box-shadow:var(--shadow-3)}
.mark--lethal{background:var(--c-lethal);border-color:#ffd0c6;color:#fff;box-shadow:var(--shadow-3),var(--glow-lethal)}
.side-rack{position:absolute;z-index:3;display:flex;flex-direction:column;gap:5px}
.side-rack--statuses{left:-12px;bottom:12px;gap:14px;align-items:flex-start}
.side-rack--artifact{right:-8px;bottom:8px}
</style>
