<script setup lang="ts">
// A party member as a tall arch portrait. Threat information lives on the portrait itself (glow, badge above the arch,
// ghost segment in the health bar), so the player learns who is about to be hit without reading a text panel.
// Every number comes from forecastEnemyAction through ui/threatDisplay.ts; nothing is calculated here.
import { computed } from 'vue'
import { Crosshair, ShieldCheck, Skull } from '@lucide/vue'
import varianPortrait from '../assets/art/varian.jpg'
import jainaPortrait from '../assets/art/jaina.jpg'
import { classThemeStyle } from '../game/classThemes'
import VitalBar from './VitalBar.vue'
import StatusChip from './StatusChip.vue'
import ArtifactChip from './ArtifactChip.vue'
import type { StatusView } from '../game/statuses'
import type { BattleArtifactState, Hero } from '../game/types'
import type { HeroThreat } from '../ui/threatDisplay'

const props = defineProps<{ hero: Hero; artifacts?: BattleArtifactState[]; statuses?: StatusView[]; turn: number; threat?: HeroThreat; acting?: boolean; hit?: boolean }>()
const portrait = computed(() => props.hero.id === 'warrior' ? varianPortrait : jainaPortrait)
const style = computed(() => classThemeStyle(props.hero.classId))
const artifact = computed(() => props.artifacts?.find(item => item.ownerInstanceId === props.hero.instanceId))
const later = computed(() => props.threat?.timing === 'later')
const now = computed(() => props.threat?.timing === 'now')
const ghost = computed(() => now.value ? props.threat!.healthLoss : 0)
const threatText = computed(() => {
  const threat = props.threat
  if (!threat) return ''
  const when = threat.timing === 'later' ? 'На следующем ходу' : 'В этот ход'
  const result = threat.blocked ? 'удар поглощён бронёй' : 'потеряет ' + threat.healthLoss + ' здоровья'
  return `${when}: ${threat.attack} урона, ${result}${threat.lethal ? ', смертельно' : ''}`
})
</script>

<template>
  <article class="hero" :class="['hero--' + hero.id, { 'is-threat': now, 'is-later': later, 'is-lethal': threat?.lethal, 'is-blocked': now && threat?.blocked, 'is-acting': acting, 'is-hit': hit }]" :style="style" :aria-label="`${hero.name}, здоровье ${hero.health} из ${hero.maxHealth}, броня ${hero.armor}${threatText ? '. ' + threatText : ''}`">
    <div class="arch" :data-threat-target="hero.id" :data-fx-anchor="hero.id">
      <span class="arch-rim"></span>
      <span class="arch-art"><img :src="portrait" :alt="hero.name" draggable="false" /></span>
      <span class="arch-gloss"></span>
      <div v-if="threat" class="threat" :class="{ 'threat--later': later, 'threat--blocked': threat.blocked }" role="status">
        <component :is="threat.blocked ? ShieldCheck : Crosshair" class="threat-icon" :size="30" :stroke-width="2.2" aria-hidden="true" />
        <span class="threat-copy">
          <small>{{ later ? 'Следом' : threat.blocked ? 'Блок' : 'Под ударом' }}</small>
          <b v-if="threat.blocked" :key="'b' + threat.attack">0<i> HP</i></b>
          <b v-else :key="'h' + threat.healthLoss">−{{ threat.healthLoss }}<i> HP</i></b>
          <em>{{ threat.attack }} урона<template v-if="threat.absorbed"> · броня −{{ threat.absorbed }}</template></em>
        </span>
      </div>
      <span v-if="threat?.lethal" class="threat-lethal" :class="{ 'threat-lethal--later': later }"><Skull :size="16" :stroke-width="2.4" aria-hidden="true" /> {{ later ? 'Смертельно · следом' : 'Смертельно' }}</span>
      <div class="side-rack side-rack--statuses" v-if="statuses?.length"><StatusChip v-for="status in statuses" :key="status.id" :status="status" /></div>
      <div class="side-rack side-rack--artifact" v-if="artifact"><ArtifactChip :artifact="artifact" :turn="turn" /></div>
    </div>
    <VitalBar :name="hero.name" :subtitle="hero.title" :health="hero.health" :max="hero.maxHealth" :armor="hero.armor" :ghost="ghost" side="hero" />
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
/* A threat that lands this turn paints the whole rim hot; a prepared one only tints it, dashed, so "now" and "later" never look alike. */
.hero.is-threat .arch{animation:threat-pulse 1.4s ease-in-out infinite}
.hero.is-threat .arch-rim{background:linear-gradient(160deg,#ffd9a8 0%,var(--c-threat) 24%,#8a2a10 55%,var(--c-threat) 80%,#5a1608 100%)}
.hero.is-blocked .arch-rim{background:linear-gradient(160deg,#eaf6ff 0%,var(--c-armor) 24%,var(--c-armor-deep) 55%,var(--c-armor) 80%,#243a52 100%)}
.hero.is-blocked .arch{animation:none}
.hero.is-later .arch-rim{background:linear-gradient(160deg,#ffe6c4,var(--c-later-line) 25%,#7a4a24 55%,var(--c-later-line) 80%,#4b2c15)}
@keyframes threat-pulse{50%{filter:drop-shadow(0 12px 14px #000b) drop-shadow(0 0 16px var(--c-threat))}}
.threat{position:absolute;z-index:3;left:50%;top:calc(-1 * clamp(22px,3.6vh,34px));translate:-50% 0;display:flex;align-items:center;gap:8px;padding:5px 14px 5px 8px;border-radius:var(--r-pill);background:var(--mat-threat-plate);border:2px solid var(--c-threat-line);box-shadow:var(--shadow-3),var(--glow-threat);white-space:nowrap;animation:threat-in .35s var(--ease-snap)}
.threat--later{background:var(--mat-later-plate);border:2px dashed var(--c-later-line);box-shadow:var(--shadow-3)}
.threat--blocked{background:linear-gradient(#173049,#0b1a2a);border-color:var(--c-armor);box-shadow:var(--shadow-3)}
@keyframes threat-in{from{scale:.6;opacity:0}}
.threat-icon{flex:none;color:var(--c-threat);animation:aim-spin 8s linear infinite}
.threat--later .threat-icon{color:var(--c-later-line);animation:none}
.threat--blocked .threat-icon{color:var(--c-armor);animation:none}
@keyframes aim-spin{to{rotate:360deg}}
.threat-copy{display:grid;grid-template-columns:auto auto;align-items:baseline;column-gap:8px}
.threat-copy small{grid-column:1/-1;font:var(--fw-bold) clamp(9px,1.1vh,11px)/1 var(--font-ui);letter-spacing:var(--ls-caps);text-transform:uppercase;color:#ffc4a8}
.threat-copy b{font:var(--fw-bold) clamp(20px,3vh,32px)/1 var(--font-num);color:#ffe1d2;text-shadow:0 1px 3px #000;animation:loss-in .3s var(--ease-snap)}
.threat-copy b i{font:var(--fw-bold) clamp(10px,1.4vh,14px) var(--font-ui);font-style:normal;color:#ffb199}
.threat--blocked b,.threat--blocked small{color:var(--c-armor)}
.threat--blocked b i{color:var(--c-armor)}
.threat-copy em{font:var(--fw-semibold) clamp(10px,1.3vh,13px)/1.2 var(--font-ui);font-style:normal;color:#f4d3c0}
@keyframes loss-in{from{scale:1.5;opacity:.2}}
.threat-lethal{position:absolute;left:50%;bottom:calc(-1 * clamp(10px,1.6vh,16px));translate:-50% 0;z-index:3;display:flex;align-items:center;gap:5px;padding:2px 11px;border-radius:var(--r-pill);background:var(--c-lethal);color:#fff;font:var(--fw-bold) clamp(10px,1.3vh,13px)/1.3 var(--font-ui);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;box-shadow:var(--shadow-2),var(--glow-lethal);animation:blink .9s steps(2) infinite}
.threat-lethal--later{animation:none;background:#7a2a18;border:1px dashed var(--c-later-line)}
@keyframes blink{50%{background:#a82312}}
.side-rack{position:absolute;z-index:3;display:flex;flex-direction:column;gap:5px}
.side-rack--statuses{left:-10px;bottom:14px;align-items:flex-start}
.side-rack--artifact{right:-8px;bottom:8px}
</style>
