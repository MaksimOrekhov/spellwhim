<script setup lang="ts">
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../game/types'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import vFitText from '../directives/fitText'
import GameTooltip from './GameTooltip.vue'
import swordStrikeArt from '../assets/art/sword-strike.jpg'
import fireballArt from '../assets/art/fireball.jpg'
import guardArt from '../assets/art/guard.jpg'
import quickCutArt from '../assets/art/quick-cut.jpg'
import thunderboltArt from '../assets/art/thunderbolt.jpg'
import bastionArt from '../assets/art/bastion.jpg'

const props = defineProps<{ card: CardDefinition; instanceId: string; preview: CardPreview; reason: string | null; playing: boolean; index: number; artOverride?: string }>()
const emit = defineEmits<{ play: [instanceId: string] }>()
const cardArt = { 'sword-strike': swordStrikeArt, fireball: fireballArt, guard: guardArt, 'quick-cut': quickCutArt, thunderbolt: thunderboltArt, bastion: bastionArt }
const theme = computed(() => getClassTheme(props.card.className))
const themeStyle = computed(() => classThemeStyle(props.card.className))

function play() {
  if (!props.reason && !props.playing) emit('play', props.instanceId)
}
</script>

<template>
  <GameTooltip :label="card.name" :disabled="playing" class="hand-card-wrap">
    <button :id="'card-' + instanceId" class="spell-card" :class="[`spell-card--${theme.ornament}`, { 'is-unavailable': !!reason, 'is-link-ready': preview.links.length > 0 && !reason, 'is-playing': playing }]" :style="themeStyle" :data-card-class="theme.id" :aria-disabled="!!reason || playing" :aria-label="(index + 1) + '. ' + card.name + ', ' + card.cost + ' маны. Класс: ' + theme.name + '. ' + (reason ?? card.description)" @click="play">
      <span class="card-cost">{{ card.cost }}</span>
      <span class="card-class-emblem" aria-hidden="true"><img :src="theme.emblem" alt="" draggable="false" /></span>
      <span class="card-art"><img :src="artOverride ?? cardArt[card.id]" alt="" draggable="false" /></span>
      <span class="card-nameplate"><strong v-fit-text class="card-name">{{ card.name }}</strong></span>
      <span class="card-description">{{ card.description }}</span>
      <span class="card-footer">
        <span class="card-class-label">{{ theme.label }}</span>
        <b v-if="preview.links.length" class="card-link" aria-label="Связка готова"><span>СВЯЗКА</span> +{{ preview.bonusDamage }}</b>
        <kbd v-else>{{ index + 1 }}</kbd>
      </span>
    </button>
    <template #content>
      <p>{{ card.description }}</p>
      <p v-if="preview.damage">Урон: {{ preview.healthDamage }} здоровью<template v-if="preview.armorDamage">, {{ preview.armorDamage }} снимет с брони врага</template>.</p>
      <p v-if="preview.links.length" class="tooltip-accent">{{ preview.links.join(' · ') }}: +{{ preview.bonusDamage }} → {{ preview.damage }} урона.</p>
      <p v-if="preview.draw">Добор: до {{ preview.draw }} {{ preview.draw === 1 ? 'карты' : 'карт' }}.</p>
      <p v-if="card.exhaust">Эта копия выбывает до конца боя.</p>
      <p v-if="reason" class="tooltip-reason">{{ reason }}</p>
      <p v-else class="tooltip-reason">Нажмите, чтобы разыграть карту.</p>
    </template>
  </GameTooltip>
</template>

<style scoped>
.hand-card-wrap{flex:0 0 clamp(180px,14vw,250px);height:var(--card-height);transition:transform .18s ease;transform-origin:bottom center}
.hand-card-wrap:hover,.hand-card-wrap:focus-within{z-index:12;transform:translateY(-12px) scale(1.035)}
.spell-card{position:relative;isolation:isolate;display:grid;grid-template-rows:minmax(0,1fr) auto minmax(42px,auto) auto;gap:5px;width:100%;height:100%;padding:8px 9px 9px;border:2px solid var(--class-primary);border-radius:14px 14px 10px 10px;background:linear-gradient(150deg,color-mix(in srgb,var(--class-primary) 76%,var(--class-surface)),var(--class-surface) 30%,color-mix(in srgb,var(--class-surface) 86%,#080a12));box-shadow:0 6px 16px #0b202c70,inset 0 0 0 2px color-mix(in srgb,var(--class-accent) 38%,transparent);color:#fff0d3;text-align:center;cursor:pointer;transition:filter .16s,border-color .16s,box-shadow .16s}
.spell-card::before{position:absolute;z-index:-1;inset:5px;border:1px solid color-mix(in srgb,var(--class-accent) 66%,transparent);border-radius:inherit;content:"";pointer-events:none}
.spell-card--angular{border-radius:8px 14px 8px 14px}
.spell-card--angular::before{clip-path:polygon(0 0,100% 0,100% 100%,0 100%);border-radius:2px}
.spell-card--arcane{border-radius:18px 18px 15px 15px}
.spell-card--arcane::before{inset:4px;border-radius:14px}
.card-art{position:relative;display:block;overflow:hidden;min-height:0;border:1px solid color-mix(in srgb,var(--class-accent) 76%,#fff);border-radius:8px 8px 4px 4px;background:var(--class-surface)}
.spell-card--angular .card-art{border-radius:3px 9px 2px 2px}
.spell-card--arcane .card-art{border-radius:12px 12px 7px 7px}
.card-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 47%}
.card-cost{position:absolute;z-index:3;left:1px;top:1px;display:grid;place-items:center;width:36px;height:42px;clip-path:polygon(50% 0,96% 23%,88% 78%,50% 100%,12% 78%,4% 23%);background:linear-gradient(135deg,#a8edee,#2a84a5 70%);color:white;font:bold 26px var(--display);text-shadow:0 2px 3px #174d6b;filter:drop-shadow(0 2px 2px #152d39)}
.card-class-emblem{position:absolute;z-index:3;top:5px;right:6px;display:grid;place-items:center;width:38px;height:40px;padding:5px;border:1px solid var(--class-accent);border-radius:50%;background:color-mix(in srgb,var(--class-surface) 82%,transparent);filter:drop-shadow(0 2px 3px #1119)}
.spell-card--angular .card-class-emblem{width:38px;height:42px;padding:5px 6px;border:0;border-radius:0;clip-path:polygon(10% 0,90% 0,100% 30%,88% 82%,50% 100%,12% 82%,0 30%);background:var(--class-accent)}
.card-class-emblem img{display:block;width:100%;height:100%}
.spell-card--angular .card-class-emblem img{filter:brightness(0) opacity(.88)}
.card-nameplate{display:grid;place-items:center;min-height:32px;padding:4px 8px;border:1px solid var(--class-accent);border-radius:5px;background:linear-gradient(110deg,color-mix(in srgb,var(--class-primary) 75%,var(--class-surface)),var(--class-surface) 82%);box-shadow:inset 0 1px #fff3;color:#fff0cb}
.spell-card--angular .card-nameplate{clip-path:polygon(3% 0,97% 0,100% 50%,97% 100%,3% 100%,0 50%);border-radius:0;padding-inline:clamp(12px,1vw,18px);background:linear-gradient(110deg,color-mix(in srgb,var(--class-primary) 68%,var(--class-accent)),var(--class-surface) 84%)}
.spell-card--arcane .card-nameplate{border-radius:12px;background:linear-gradient(110deg,color-mix(in srgb,var(--class-primary) 45%,var(--class-surface)),color-mix(in srgb,var(--class-accent) 26%,var(--class-surface)))}
.card-name{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:clip;white-space:nowrap;font:700 clamp(16px,1.05vw,20px)/1.1 var(--display)}
.card-description{display:grid;align-content:center;min-height:0;padding:2px 5px;color:#f0e4cb;font-size:clamp(13px,.92vw,16px);line-height:1.24}
.card-footer{display:flex;align-items:center;justify-content:space-between;gap:5px;min-height:19px;border-top:1px solid color-mix(in srgb,var(--class-accent) 36%,transparent);padding-top:4px;color:#d2c5a7;font-size:11px}
.card-class-label{color:var(--class-accent);font-weight:800;letter-spacing:.12em}
.card-footer kbd{font:12px inherit;border:1px solid #ad9d7766;border-radius:4px;padding:0 4px}
.card-link{display:flex;align-items:center;gap:5px;border:1px solid #edc6ff8c;border-radius:9px;background:#3b285088;padding:2px 7px;color:#f1d8ff;font-size:12px}
.card-link span{font-size:9px;letter-spacing:.08em}
.is-link-ready{box-shadow:0 0 0 2px #dfc4f0,0 0 15px color-mix(in srgb,var(--class-accent) 45%,transparent),0 6px 16px #0b202c70}
.is-link-ready .card-class-emblem{box-shadow:0 0 0 2px #e2c9f3}
.is-unavailable{filter:saturate(.62);border-color:color-mix(in srgb,var(--class-primary) 52%,#737980)}
.is-unavailable .card-cost{filter:grayscale(.42);opacity:.78}
.is-playing{pointer-events:none;animation:card-play .36s ease-in forwards}
@keyframes card-play{to{transform:translateY(-100px) scale(.55);opacity:0}}
@media(max-height:700px){.spell-card{grid-template-rows:minmax(0,1fr) auto minmax(39px,auto) auto;gap:3px;padding:7px 8px}.card-name{font-size:16px}.card-nameplate{min-height:27px}.card-description{font-size:13px}.card-footer{font-size:10px;padding-top:3px}.card-cost{width:31px;height:36px;font-size:23px}.card-class-emblem{width:33px;height:35px}}
</style>
