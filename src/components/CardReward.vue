<script setup lang="ts">
import { computed } from 'vue'
import { classThemeStyle, getClassTheme } from '../game/classThemes'
import vFitText from '../directives/fitText'
import type { CardDefinition } from '../game/types'
import swordArt from '../assets/art/sword-strike.jpg'
import fireArt from '../assets/art/fireball.jpg'
import guardArt from '../assets/art/guard.jpg'
import quickCutArt from '../assets/art/quick-cut.jpg'
import thunderboltArt from '../assets/art/thunderbolt.jpg'
import bastionArt from '../assets/art/bastion.jpg'

const props = defineProps<{ options: CardDefinition[]; encounterName: string; artOverrides?: Partial<Record<CardDefinition['id'], string>> }>()
const emit = defineEmits<{ choose: [card: CardDefinition] }>()
const artById = { 'sword-strike': swordArt, fireball: fireArt, guard: guardArt, 'quick-cut': quickCutArt, thunderbolt: thunderboltArt, bastion: bastionArt }
const themes = computed(() => props.options.map(card => getClassTheme(card.className)))
const themeStyles = computed(() => props.options.map(card => classThemeStyle(card.className)))

function kindLabel(card: CardDefinition) {
  return card.kind === 'defense' ? 'ЗАЩИТА' : card.kind === 'spell' ? 'ЗАКЛИНАНИЕ' : 'АТАКА'
}
</script>

<template>
  <main class="reward-screen">
    <div class="reward-content">
      <span class="reward-spark" aria-hidden="true">✦</span>
      <p class="reward-kicker">ПОБЕДА · {{ encounterName.toUpperCase() }}</p>
      <h1>Найдите новую силу</h1>
      <p class="reward-copy">Выберите одну карту. Она останется с отрядом до конца похода.</p>
      <div class="reward-options">
        <button v-for="(card, index) in options" :key="card.id" class="reward-card" :class="[`reward-card--${themes[index]?.ornament}`]" :style="themeStyles[index]" :data-card-class="themes[index]?.id" @click="emit('choose', card)">
          <span class="reward-card-cost">{{ card.cost }}</span>
          <span class="reward-card-emblem" aria-hidden="true"><img :src="themes[index]?.emblem" alt="" /></span>
          <span class="reward-card-art"><img :src="props.artOverrides?.[card.id] ?? artById[card.id]" alt="" aria-hidden="true" /></span>
          <strong v-fit-text class="reward-card-name">{{ card.name }}</strong>
          <span class="reward-card-meta"><b>{{ themes[index]?.label }}</b><span>{{ kindLabel(card) }}</span></span>
          <span class="reward-card-description">{{ card.description }}</span>
          <span class="reward-select">ВЗЯТЬ КАРТУ</span>
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.reward-screen{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:4vh 5vw;background:radial-gradient(ellipse at 50% 30%,#758768,#35564e 62%,#203c3a);color:var(--ink)}
.reward-content{width:min(1100px,94vw);text-align:center}
.reward-spark{font-size:36px;color:#ffe1a0}
.reward-kicker{margin:8px 0;font-size:14px;color:#e1d4b4}
.reward-content h1{margin:0;font:700 clamp(30px,3vw,46px) var(--display);color:#fff0ca}
.reward-copy{margin:12px 0 28px;color:#e4dfcb;font-size:17px}
.reward-options{display:flex;justify-content:center;align-items:stretch;gap:24px}
.reward-card{position:relative;isolation:isolate;display:flex;flex:1;flex-direction:column;align-items:stretch;max-width:290px;min-width:0;padding:12px 14px 16px;border:2px solid var(--class-primary);border-radius:15px 15px 12px 12px;background:linear-gradient(150deg,color-mix(in srgb,var(--class-primary) 62%,var(--class-surface)),var(--class-surface) 36%,#20232e);color:var(--ink);box-shadow:0 12px 30px #173b3466,inset 0 0 0 2px color-mix(in srgb,var(--class-accent) 32%,transparent);transition:transform .2s,border-color .2s,box-shadow .2s;text-align:center;cursor:pointer}
.reward-card::before{position:absolute;z-index:-1;inset:5px;border:1px solid color-mix(in srgb,var(--class-accent) 66%,transparent);border-radius:inherit;content:"";pointer-events:none}
.reward-card:hover{transform:translateY(-7px);box-shadow:0 16px 32px #102b2b88,0 0 14px color-mix(in srgb,var(--class-accent) 36%,transparent)}
.reward-card:focus-visible{outline:3px solid #b0eff5;outline-offset:4px}
.reward-card--angular{border-radius:8px 14px 8px 14px}
.reward-card--angular::before{border-radius:2px}
.reward-card--arcane{border-radius:18px 18px 15px 15px}
.reward-card--arcane::before{inset:4px;border-radius:14px}
.reward-card-cost{position:absolute;z-index:2;top:14px;left:12px;display:grid;place-items:center;width:36px;height:42px;clip-path:polygon(50% 0,95% 25%,87% 77%,50% 100%,13% 77%,5% 25%);background:linear-gradient(145deg,#a8efff,#237cb5);color:white;font:700 26px var(--display);text-shadow:0 2px 3px #174d6b;filter:drop-shadow(0 2px 2px #152d39)}
.reward-card-emblem{position:absolute;z-index:2;top:14px;right:12px;display:grid;place-items:center;width:40px;height:42px;padding:5px;border:1px solid var(--class-accent);border-radius:50%;background:color-mix(in srgb,var(--class-surface) 82%,transparent);filter:drop-shadow(0 2px 3px #1119)}
.reward-card--angular .reward-card-emblem{border:0;border-radius:0;clip-path:polygon(10% 0,90% 0,100% 30%,88% 82%,50% 100%,12% 82%,0 30%);background:var(--class-accent)}
.reward-card-emblem img{width:100%;height:100%}
.reward-card--angular .reward-card-emblem img{filter:brightness(0) opacity(.88)}
.reward-card-art{position:relative;display:block;overflow:hidden;margin:0 0 10px;border:1px solid color-mix(in srgb,var(--class-accent) 76%,#fff);border-radius:10px 10px 4px 4px;background:var(--class-surface)}
.reward-card--angular .reward-card-art{border-radius:3px 9px 2px 2px}
.reward-card--arcane .reward-card-art{border-radius:13px 13px 7px 7px}
.reward-card-art img{display:block;width:100%;height:clamp(130px,20vh,250px);object-fit:cover}
.reward-card-name{display:grid;place-items:center;min-width:0;max-width:100%;overflow:hidden;text-overflow:clip;white-space:nowrap;min-height:42px;padding:5px 8px;border:1px solid var(--class-accent);border-radius:13px;background:linear-gradient(110deg,color-mix(in srgb,var(--class-primary) 58%,var(--class-surface)),var(--class-surface));font:700 clamp(18px,1.5vw,24px)/1.1 var(--display);color:#ffebbd}
.reward-card--angular .reward-card-name{background:linear-gradient(110deg,color-mix(in srgb,var(--class-primary) 58%,var(--class-accent)),var(--class-surface))}
.reward-card--arcane .reward-card-name{background:linear-gradient(110deg,color-mix(in srgb,var(--class-primary) 40%,var(--class-surface)),color-mix(in srgb,var(--class-accent) 25%,var(--class-surface)))}
.reward-card-meta{display:flex;justify-content:center;gap:8px;margin:9px 0;color:#d5ceb7;font-size:11px;letter-spacing:.08em}
.reward-card-meta b{color:var(--class-accent)}
.reward-card-description{display:grid;align-content:start;min-height:62px;margin:4px 0 12px;font-size:clamp(14px,1.05vw,16px);line-height:1.35;color:#f0e4cb}
.reward-select{margin-top:auto;padding:9px 16px;border:1px solid var(--class-accent);border-radius:7px;background:linear-gradient(110deg,color-mix(in srgb,var(--class-primary) 66%,var(--class-surface)),var(--class-surface));color:#fff0d1;font-size:14px;font-weight:800;letter-spacing:.07em}
@media(max-height:700px){.reward-screen{padding:18px}.reward-spark{display:none}.reward-copy{margin:8px 0 18px;font-size:15px}.reward-card{padding:9px 11px 12px;max-width:250px}.reward-card-art img{height:125px}.reward-card-name{font-size:19px;min-height:36px}.reward-card-description{font-size:14px;min-height:55px}.reward-content h1{font-size:30px}}
@media(max-width:800px){.reward-options{gap:12px}.reward-card{padding:8px}.reward-card-art img{height:105px}.reward-card-meta{font-size:9px}}
</style>
