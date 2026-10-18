<script setup lang="ts">
// The enemy's announced action as one compact token under its health plate: a main icon, one number per hero and the target's
// face. No sentences: "sword · 9" is an attack, "hourglass · ?" is a preparation whose size is not public yet, "shield · +5" is
// a defence. Details live in the tooltip. The component only receives the PublicIntent (ui/threatDisplay.ts), so it cannot
// draw a number that the player must not know. `caption` is the alternative layout with the action's name under the icon.
import { computed } from 'vue'
import { Hourglass, Shield, ShieldCheck, ShieldPlus, Skull, Swords, Sword } from '@lucide/vue'
import varianPortrait from '../assets/art/varian-krea.webp'
import jainaPortrait from '../assets/art/jaina-krea.webp'
import GameTooltip from './GameTooltip.vue'
import { intentSpoken, intentTooltip } from '../ui/threatDisplay'
import type { HeroNames, PublicIntent } from '../ui/threatDisplay'
import type { HeroId } from '../game/types'

const props = defineProps<{ intent: PublicIntent; heroNames: HeroNames; executing: boolean; caption?: boolean }>()
const icon = computed(() => ({ attack: Sword, attack_all: Swords, defend: Shield, prepare: Hourglass, recover: ShieldPlus })[props.intent.kind])
const avatars: Record<HeroId, string> = { warrior: varianPortrait, mage: jainaPortrait }
const hits = computed(() => props.intent.kind === 'attack' || props.intent.kind === 'attack_all' ? props.intent.hits : [])
const prepared = computed(() => props.intent.kind === 'prepare' ? props.intent : null)
const armor = computed(() => props.intent.kind === 'defend' || props.intent.kind === 'recover' ? props.intent.armor : null)
const pop = computed(() => props.intent.kind + hits.value.map(hit => hit.healthLoss).join())
</script>

<template>
  <GameTooltip :label="executing ? 'Действие противника' : 'Намерение противника'" placement="bottom" class="intent-tip">
    <div class="intent" :class="['intent--' + intent.kind, { 'is-executing': executing, 'has-caption': caption }]" data-threat-source="intent" tabindex="0" role="group" :aria-label="intentSpoken(intent, heroNames)">
      <span class="intent-icon"><component :is="icon" :size="28" :stroke-width="2.3" aria-hidden="true" /></span>
      <small v-if="caption" class="intent-name">{{ intent.name }}</small>
      <span :key="pop" class="intent-body">
        <template v-if="hits.length">
          <span v-for="hit in hits" :key="hit.hero" class="hit" :class="{ 'is-lethal': hit.lethal, 'is-blocked': hit.blocked }">
            <img :src="avatars[hit.hero]" alt="" draggable="false" />
            <ShieldCheck v-if="hit.blocked" class="hit-block" :size="24" :stroke-width="2.4" aria-hidden="true" />
            <b v-else>{{ hit.healthLoss }}</b>
            <small v-if="hit.absorbed && !hit.blocked"><Shield :size="12" :stroke-width="2.6" aria-hidden="true" />{{ hit.absorbed }}</small>
            <Skull v-if="hit.lethal" :size="20" class="hit-skull" aria-hidden="true" />
          </span>
        </template>
        <template v-else-if="prepared">
          <span class="hit is-prepared">
            <span class="faces"><img v-for="id in prepared.targets" :key="id" :src="avatars[id]" alt="" draggable="false" /></span>
            <b>?</b>
          </span>
        </template>
        <b v-else-if="armor !== null" class="armor-gain">+{{ armor }}</b>
      </span>
    </div>
    <template #content>
      <p v-for="line in intentTooltip(intent, heroNames)" :key="line">{{ line }}</p>
    </template>
  </GameTooltip>
</template>

<style scoped>
.intent-tip{width:100%;justify-content:center}
.intent{--c:var(--c-threat);position:relative;display:flex;align-items:center;gap:clamp(8px,1.4vh,14px);padding:clamp(5px,.9vh,9px) clamp(12px,1.8vh,20px) clamp(5px,.9vh,9px) clamp(6px,1vh,10px);border-radius:var(--shape-banner);background:var(--mat-intent-plate);border:2px solid var(--brass-3);box-shadow:var(--shadow-3),var(--bevel-top),inset 6px 0 9px -4px var(--c)}
.intent--defend,.intent--recover{--c:var(--c-armor)}
.intent--prepare{--c:var(--c-later-line);border-style:dashed;border-color:var(--c-later-line)}
.intent-icon{display:grid;place-items:center;flex:none;width:clamp(36px,5.6vh,54px);height:clamp(36px,5.6vh,54px);border-radius:var(--shape-medallion);background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 55%,#fff),var(--c) 55%,color-mix(in srgb,var(--c) 45%,#000));color:var(--parch-ink);box-shadow:var(--shadow-2),inset 0 0 8px #fff6}
.intent-name{white-space:nowrap;font:var(--fw-bold) clamp(11px,1.5vh,15px)/1.15 var(--font-display);color:var(--ink);text-align:left}
.intent-body{display:flex;align-items:center;gap:clamp(8px,1.2vh,12px);animation:reveal var(--dur-base) var(--ease-snap)}
@keyframes reveal{from{scale:.7;opacity:.3}}
.hit{position:relative;display:flex;align-items:center;gap:6px;padding:3px 12px 3px 3px;border-radius:var(--r-pill);background:#0008;border:2px solid var(--c-threat-line)}
.hit.is-blocked{border-color:var(--c-armor)}
.hit.is-lethal{border-color:var(--c-lethal);box-shadow:var(--glow-lethal)}
.hit.is-prepared{border:2px dashed var(--c-later-line)}
.hit img{width:clamp(28px,4.4vh,44px);height:clamp(28px,4.4vh,44px);border-radius:50%;object-fit:cover;object-position:50% 20%;border:2px solid var(--brass-2)}
.faces{display:flex}.faces img+img{margin-left:-10px}
.hit b{font:var(--fw-bold) clamp(20px,3.1vh,32px)/1 var(--font-num);color:#ffd6c6;text-shadow:0 1px 3px #000}
.hit.is-prepared b{color:var(--c-later-line)}
.hit-block{color:var(--c-armor)}
.hit small{display:flex;align-items:center;gap:2px;font:var(--fw-bold) clamp(11px,1.5vh,14px)/1 var(--font-num);color:var(--c-armor)}
.hit-skull{position:absolute;right:-8px;top:-10px;padding:3px;border-radius:50%;background:var(--c-lethal);color:#fff}
.armor-gain{font:var(--fw-bold) clamp(20px,3.1vh,32px)/1 var(--font-num);color:var(--c-armor);text-shadow:0 1px 3px #000}
.intent.is-executing{animation:exec .5s ease-out;box-shadow:var(--shadow-3),0 0 26px var(--c),inset 5px 0 0 var(--c)}
@keyframes exec{from{scale:1.07}}
.intent:focus-visible{outline:var(--focus-ring);outline-offset:3px}
</style>
