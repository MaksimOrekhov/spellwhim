<script setup lang="ts">
// A party member as a tall "arch" portrait. Threat information lives ON the portrait (glow, crosshair, predicted loss),
// so the player never has to read a text panel to learn who is about to be hit.
import { computed } from 'vue'
import type { Hero, HeroId } from '../../game/types'
import type { EnemyTargetForecast } from '../../game/battle'
import { classThemeStyle } from '../../game/classThemes'
import { portraits } from '../cardArt'
import VitalBar from './VitalBar.vue'
import GlyphIcon from './GlyphIcon.vue'

const props = defineProps<{ hero: Hero; incoming?: EnemyTargetForecast; later?: boolean; acting?: boolean; hit?: boolean; guarded?: boolean; armorPreview?: number; heal?: number }>()
const id = computed<HeroId>(() => props.hero.id)
const style = computed(() => classThemeStyle(props.hero.id))
const ghost = computed(() => props.incoming && !props.later ? props.incoming.healthLoss : 0)
</script>

<template>
  <article class="hero" :class="['hero--' + id, { 'is-threat': !!incoming, 'is-later': later, 'is-lethal': incoming?.lethal, 'is-acting': acting, 'is-hit': hit, 'is-guarded': guarded }]" :style="style" :aria-label="`${hero.name}, здоровье ${hero.health} из ${hero.maxHealth}, броня ${hero.armor}`">
    <div class="arch" :data-anchor="'hero-' + id" :data-fx-anchor="id">
      <span class="arch-rim"></span>
      <span class="arch-art"><img :src="portraits[id]" :alt="hero.name" draggable="false" /></span>
      <span class="arch-gloss"></span>
      <div v-if="incoming" class="threat" :class="{ 'threat--later': later }">
        <GlyphIcon name="vulnerable" class="threat-aim" />
        <span class="threat-copy">
          <small>{{ later ? 'Следом' : 'Под ударом' }}</small>
          <b v-if="incoming.healthLoss > 0">−{{ incoming.healthLoss }}<i> HP</i></b>
          <b v-else class="safe">блок</b>
          <em>{{ incoming.attack }} урона<template v-if="incoming.absorbed"> · <GlyphIcon name="armor" /> −{{ incoming.absorbed }}</template></em>
        </span>
        <span v-if="incoming.lethal" class="threat-lethal"><GlyphIcon name="skull" /> смертельно</span>
      </div>
      <span v-if="hero.id === 'mage' && hero.armor > 0" class="spark" title="Пока у Джайны есть броня, её заклинания наносят +2 урона"><GlyphIcon name="attack-all" /> +2</span>
    </div>
    <VitalBar :name="hero.name" :subtitle="hero.title" :health="hero.health" :max="hero.maxHealth" :armor="hero.armor" :armor-preview="armorPreview" :heal="heal" :ghost="ghost" ghost-tone="threat" side="hero" />
  </article>
</template>

<style scoped>
.hero{--arch-w:var(--hero-w,17rem);--arch-h:var(--hero-h,21.2rem);position:relative;display:flex;flex-direction:column;align-items:center;width:var(--arch-w);gap:.9rem;transition:transform .3s var(--ease-out)}
.hero.is-acting{transform:translateY(-.6rem)}
.arch{position:relative;width:var(--arch-w);height:var(--arch-h);filter:drop-shadow(0 1rem 1.2rem #000b)}
.arch-rim,.arch-art,.arch-gloss{position:absolute;display:block}
.arch-rim{inset:0;border-radius:50% 50% 2.1rem 2.1rem/34% 34% 2.1rem 2.1rem;background:linear-gradient(160deg,#fff0b8 0%,var(--class-accent) 22%,#7a5424 52%,var(--class-accent) 76%,#4b3015 100%)}
.hero--mage .arch-rim{background:linear-gradient(160deg,#fff3c0 0%,#d9b46a 18%,var(--class-accent) 45%,#4b3a86 70%,#e8c978 100%)}
.arch-art{inset:.55rem;overflow:hidden;border-radius:50% 50% 1.6rem 1.6rem/33% 33% 1.6rem 1.6rem;background:#10202e;box-shadow:inset 0 0 1.2rem #000b}
.arch-art img{width:100%;height:100%;object-fit:cover;object-position:46% 18%;display:block;transform:scale(1.18);transform-origin:50% 22%;transition:transform .5s var(--ease-out),filter .3s}
.hero:hover .arch-art img{transform:scale(1.22)}
.arch-gloss{inset:.55rem;border-radius:50% 50% 1.6rem 1.6rem/33% 33% 1.6rem 1.6rem;pointer-events:none;background:linear-gradient(180deg,#fff2 0,#0000 28%,#0000 62%,#000a 100%);box-shadow:inset 0 0 0 .1rem #ffffff22}
.hero.is-hit .arch-art img{animation:hit-flash .42s ease-out}
.hero.is-hit .arch{animation:shake .42s ease-out}
@keyframes hit-flash{0%{filter:brightness(2.2) saturate(.4)}100%{filter:none}}
@keyframes shake{20%{translate:-.6rem 0}45%{translate:.5rem 0}70%{translate:-.25rem 0}}
/* threat state */
.hero.is-threat .arch{animation:threat-pulse 1.4s ease-in-out infinite}
.hero.is-threat .arch-rim{background:linear-gradient(160deg,#ffd9a8 0%,#ff7a45 24%,#8a2a10 55%,#ff6a3d 80%,#5a1608 100%)}
.hero.is-later .arch-rim{background:linear-gradient(160deg,#ffe6c4,#e29a5d 25%,#7a4a24 55%,#e29a5d 80%,#4b2c15)}
.hero.is-later .arch{animation:none}
@keyframes threat-pulse{50%{filter:drop-shadow(0 1rem 1.2rem #000b) drop-shadow(0 0 1.2rem #ff5a2fcc)}}
.hero.is-guarded .arch{filter:drop-shadow(0 1rem 1.2rem #000b) drop-shadow(0 0 1rem #9fd2ffaa)}
.threat{position:absolute;z-index:3;left:50%;top:-1.9rem;translate:-50% 0;display:flex;align-items:center;gap:.55rem;padding:.4rem .85rem .4rem .55rem;border-radius:2rem;background:linear-gradient(#52150b,#2b0906);border:.16rem solid #ff9a6d;box-shadow:0 .4rem 1rem #000c,0 0 1.4rem #ff5a2f88;white-space:nowrap;animation:threat-in .35s var(--ease-snap)}
.threat--later{background:linear-gradient(#3b2411,#22140a);border:.16rem dashed #e8b273;box-shadow:0 .4rem 1rem #000c;opacity:.95}
@keyframes threat-in{from{scale:.6;opacity:0}}
.threat-aim{width:2.4rem;height:2.4rem;color:#ff8b5e;animation:aim-spin 8s linear infinite}
@keyframes aim-spin{to{rotate:360deg}}
.threat-copy{display:grid;grid-template-columns:auto auto;align-items:baseline;column-gap:.5rem}
.threat-copy small{grid-column:1/-1;font:800 .66rem/1 var(--f-ui);letter-spacing:.16em;text-transform:uppercase;color:#ffc4a8}
.threat-copy b{font:800 1.95rem/1 var(--f-num);color:#ffe1d2;text-shadow:0 .1rem .2rem #000}
.threat-copy b i{font:800 .9rem var(--f-ui);font-style:normal;color:#ffb199}
.threat-copy b.safe{font-size:1.5rem;color:#bfe9ff}
.threat-copy em{font:600 .82rem/1.2 var(--f-ui);font-style:normal;color:#f4d3c0;display:inline-flex;align-items:center;gap:.2rem}
.threat-copy em svg{width:.9rem;height:.9rem;color:#bfd8f2}
.threat-lethal{position:absolute;left:50%;bottom:-1.45rem;translate:-50% 0;display:flex;align-items:center;gap:.3rem;padding:.12rem .6rem;border-radius:.9rem;background:#e23b22;color:#fff;font:800 .78rem/1.2 var(--f-ui);letter-spacing:.1em;text-transform:uppercase;box-shadow:0 .2rem .6rem #000a;animation:blink .9s steps(2) infinite}
.threat-lethal svg{width:1rem;height:1rem}
@keyframes blink{50%{background:#a82312}}
.spark{position:absolute;right:-.7rem;top:3.3rem;z-index:3;display:flex;align-items:center;gap:.2rem;padding:.2rem .6rem .2rem .4rem;border-radius:1rem;background:linear-gradient(#4a3300,#241800);border:.12rem solid var(--bonus);color:var(--bonus);font:800 1.05rem/1 var(--f-num);box-shadow:0 0 1rem #ffd56b88,0 .3rem .6rem #000a}
.spark svg{width:1.05rem;height:1.05rem}
</style>
