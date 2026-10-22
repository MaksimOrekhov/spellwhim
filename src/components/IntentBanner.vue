<script setup lang="ts">
// The enemy's announced action as one compact token under its health plate: a main icon, one number per hero and the target's
// face. No sentences: "sword · 9" is an attack, "hourglass · ?" is a preparation whose size is not public yet, "shield · +5" is
// a defence. Details live in the tooltip. The component only receives the PublicIntent (ui/threatDisplay.ts), so it cannot
// draw a number that the player must not know. `caption` is the alternative layout with the action's name under the icon.
// EXPERIMENT "Honest Turn B": a row of small trait tokens sits under the banner when the action carries one — a hit that
// pierces armor (shield-off), a hit the party can stop this turn (bolt, with the progress), a hit that marks its target
// (crosshair), the weakening of Frostbite (snowflake), the enemy's rage (flame). A preparation shows them without numbers.
import { computed } from 'vue'
import { Crosshair, Flame, Hourglass, Shield, ShieldCheck, ShieldOff, ShieldPlus, Skull, Snowflake, Swords, Sword, Zap } from '@lucide/vue'
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

interface Trait { id: 'pierce' | 'interrupt' | 'exposes' | 'chill' | 'power'; icon: typeof Zap; text: string; state?: 'done' | 'open'; progress?: number }
const traits = computed<Trait[]>(() => {
  const intent = props.intent
  const list: Trait[] = []
  if (intent.kind === 'prepare') {
    if (intent.traits?.pierce) list.push({ id: 'pierce', icon: ShieldOff, text: 'пробой' })
    if (intent.traits?.interruptible) list.push({ id: 'interrupt', icon: Zap, text: 'срыв' })
    if (intent.traits?.exposes) list.push({ id: 'exposes', icon: Crosshair, text: 'метка' })
    return list
  }
  if (intent.kind === 'defend' || intent.kind === 'recover') return intent.power ? [{ id: 'power', icon: Flame, text: `ярость +${intent.power}` }] : []
  if (intent.kind !== 'attack' && intent.kind !== 'attack_all') return list
  const strike = intent as Extract<PublicIntent, { hits: unknown }>
  const pierce = Math.max(0, ...strike.hits.map(hit => hit.pierce ?? 0))
  if (pierce) list.push({ id: 'pierce', icon: ShieldOff, text: `пробой ${pierce}` })
  if (strike.interrupt) {
    const { need, dealt, broken } = strike.interrupt
    list.push({ id: 'interrupt', icon: Zap, text: broken ? 'сорван' : `срыв ${Math.min(dealt, need)}/${need}`, state: broken ? 'done' : 'open', progress: Math.min(1, dealt / need) })
  }
  if (strike.hits.some(hit => hit.exposes)) list.push({ id: 'exposes', icon: Crosshair, text: 'метка' })
  const chill = Math.max(0, ...strike.hits.map(hit => hit.chill ?? 0))
  if (chill) list.push({ id: 'chill', icon: Snowflake, text: `−${chill}` })
  return list
})
</script>

<template>
  <GameTooltip :label="executing ? 'Действие противника' : 'Намерение противника'" placement="bottom" class="intent-tip">
    <div class="intent-wrap">
      <div class="intent" :class="['intent--' + intent.kind, { 'is-executing': executing, 'has-caption': caption }]" data-threat-source="intent" tabindex="0" role="group" :aria-label="intentSpoken(intent, heroNames)">
        <span class="intent-icon"><component :is="icon" :size="28" :stroke-width="2.3" aria-hidden="true" /></span>
        <small v-if="caption" class="intent-name">{{ intent.name }}</small>
        <span :key="pop" class="intent-body">
          <template v-if="hits.length">
            <span v-for="hit in hits" :key="hit.hero" class="hit" :class="{ 'is-lethal': hit.lethal, 'is-blocked': hit.blocked, 'is-cancelled': hit.cancelled }">
              <img :src="avatars[hit.hero]" alt="" draggable="false" />
              <Zap v-if="hit.cancelled" class="hit-cancel" :size="24" :stroke-width="2.4" aria-hidden="true" />
              <ShieldCheck v-else-if="hit.blocked" class="hit-block" :size="24" :stroke-width="2.4" aria-hidden="true" />
              <b v-else>{{ hit.healthLoss }}</b>
              <small v-if="hit.absorbed && !hit.blocked && !hit.cancelled"><Shield :size="12" :stroke-width="2.6" aria-hidden="true" />{{ hit.absorbed }}</small>
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
      <ul v-if="traits.length" class="traits" aria-hidden="true">
        <li v-for="trait in traits" :key="trait.id" class="trait" :class="['trait--' + trait.id, trait.state && 'is-' + trait.state]">
          <component :is="trait.icon" :size="15" :stroke-width="2.6" />
          <span>{{ trait.text }}</span>
          <i v-if="trait.progress !== undefined" class="meter"><i :style="{ width: trait.progress * 100 + '%' }"></i></i>
        </li>
      </ul>
    </div>
    <template #content>
      <p v-for="line in intentTooltip(intent, heroNames)" :key="line">{{ line }}</p>
    </template>
  </GameTooltip>
</template>

<style scoped>
.intent-tip{width:100%;justify-content:center}
.intent-wrap{display:flex;flex-direction:column;align-items:center;gap:clamp(4px,.7vh,8px)}
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
.hit.is-cancelled{border-color:#7fe3a8;opacity:.75}
.hit.is-cancelled img{filter:grayscale(.6)}
.hit-cancel{color:#7fe3a8}
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
/* Trait tokens: icon + two words at most; the progress of a strike the party can stop is the only one with a meter. */
.traits{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(4px,.7vh,7px);margin:0;padding:0;list-style:none}
.trait{position:relative;display:inline-flex;align-items:center;gap:4px;padding:2px 9px 2px 6px;border-radius:var(--r-pill);background:#1d1410d9;border:2px solid var(--brass-3);color:var(--ink);font:var(--fw-bold) clamp(11px,1.5vh,14px)/1.2 var(--font-ui);white-space:nowrap;overflow:hidden;box-shadow:var(--shadow-2)}
.trait--pierce{border-color:#d68a5b;color:#ffd2b0}
.trait--interrupt{border-color:var(--c-bonus);color:#ffe9a8}
.trait--interrupt.is-done{border-color:#7fe3a8;color:#c8ffd9}
.trait--exposes{border-color:var(--c-vulnerable);color:#ffd9a8}
.trait--chill{border-color:#7fc8ff;color:#d5efff}
.trait--power{border-color:#ff8a4d;color:#ffd0b0}
.meter{position:absolute;left:0;right:0;bottom:0;height:3px;background:#0008}
.meter>i{display:block;height:100%;background:var(--c-bonus);transition:width var(--dur-base) var(--ease-out)}
.trait.is-done .meter>i{background:#7fe3a8}
</style>
