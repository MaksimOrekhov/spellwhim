<script setup lang="ts">
// Rest site (RestSite.vue today: two text cards). Here the heroes are the choice: hover/focus a hero to preview the heal
// on their health bar, click to rest. Amount comes from the real REST_HEAL_AMOUNT; full-health heroes are disabled.
import { computed, ref } from 'vue'
import { REST_HEAL_AMOUNT } from '../../game/campaign'
import type { Hero, HeroId } from '../../game/types'
import HeroFrame from './HeroFrame.vue'
import GlyphIcon from './GlyphIcon.vue'

const props = defineProps<{ heroes: Record<HeroId, Hero> }>()
defineEmits<{ choose: [hero: HeroId | null] }>()
const focus = ref<HeroId | null>(null)
const gain = (hero: Hero) => Math.min(REST_HEAL_AMOUNT, Math.max(0, hero.maxHealth - hero.health))
const order: HeroId[] = ['warrior', 'mage']
const allFull = computed(() => order.every(id => gain(props.heroes[id]) === 0))
</script>

<template>
  <main class="rest">
    <header class="rest-head">
      <small>Привал · Мёртвые копи</small>
      <h1>Передышка у фонаря</h1>
      <p>Выберите, кто отдохнёт: до {{ REST_HEAL_AMOUNT }} здоровья одному герою.</p>
    </header>
    <div class="rest-stage">
      <div v-for="(id, i) in order" :key="id" class="rest-hero" :class="{ 'is-pick': focus === id }">
        <button class="rest-pick" :disabled="gain(heroes[id]) === 0" :aria-label="`${heroes[id].name}: ${heroes[id].health} из ${heroes[id].maxHealth}. ${gain(heroes[id]) ? 'Отдохнуть, +' + gain(heroes[id]) + ' здоровья' : 'Здоровье полное'}`" @mouseenter="focus = id" @mouseleave="focus = null" @focus="focus = id" @blur="focus = null" @click="$emit('choose', id)">
          <HeroFrame :hero="heroes[id]" :heal="focus === id ? gain(heroes[id]) : 0" />
          <span class="rest-cta"><GlyphIcon name="camp" /> {{ gain(heroes[id]) ? 'Отдохнуть · +' + gain(heroes[id]) : 'Здоровье полное' }}</span>
        </button>
        <span v-if="i === 0" class="fire" aria-hidden="true"><GlyphIcon name="camp" /></span>
      </div>
    </div>
    <button v-if="allFull" class="rest-skip" @click="$emit('choose', null)">Здоровье полное · продолжить путь</button>
  </main>
</template>

<style scoped>
.rest{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;padding-top:2.2rem;background:radial-gradient(ellipse at 50% 78%,#ff9a4a55,#0000 46%),radial-gradient(ellipse at 50% 40%,#0000 20%,#0b0f10cc 92%)}
.rest-head{text-align:center;text-shadow:0 .2rem .6rem #000}
.rest-head small{font:800 .8rem var(--f-ui);letter-spacing:.2em;text-transform:uppercase;color:#f0d9a0}
.rest-head h1{margin:.2rem 0;font:800 3rem var(--f-display);color:#fff0c8}
.rest-head p{margin:0;font:600 1.05rem var(--f-ui);color:#f0e4c8}
.rest-stage{position:relative;display:flex;gap:11rem;margin-top:3.2rem;align-items:flex-start}
.rest-hero{position:relative}
.rest-pick{display:flex;flex-direction:column;align-items:center;gap:1.4rem;padding:1.4rem 1rem 1rem;border:0;border-radius:3rem 3.4rem 3rem 3.3rem;background:none;transition:transform .25s var(--ease-out)}
.rest-pick:not(:disabled):hover,.rest-pick:not(:disabled):focus-visible{transform:translateY(-.5rem)}
.rest-pick:disabled{opacity:.65}
.rest-cta{display:flex;align-items:center;gap:.5rem;padding:.7rem 1.8rem;border:.14rem solid #ffe3a7;border-radius:1.8rem 1.4rem 1.7rem 1.5rem/1.5rem 1.8rem 1.4rem 1.7rem;background:linear-gradient(#d8923f,#8a4a1d);box-shadow:0 .25rem 0 #4a1f08,0 .6rem 1rem #000a;color:#fff3d6;font:800 1.1rem var(--f-display)}
.rest-cta svg{width:1.3rem;height:1.3rem}
.rest-pick:disabled .rest-cta{background:linear-gradient(#6a5a48,#3d3226);border-color:#a89878;box-shadow:0 .2rem 0 #1f1810}
.fire{position:absolute;right:-8.6rem;top:9rem;display:grid;place-items:center;width:6.4rem;height:6.4rem;color:#ffb347;font-size:5.6rem;filter:drop-shadow(0 0 1.6rem #ff9a4a) drop-shadow(0 0 .6rem #ffd37a);animation:flicker 2.4s ease-in-out infinite}
.fire svg{fill:#ff8a3a33}
@keyframes flicker{40%{transform:scale(1.06) rotate(-2deg)}70%{transform:scale(.97) rotate(2deg)}}
.rest-skip{margin-top:2rem;padding:.7rem 2rem;border:.14rem solid #ffe3a7;border-radius:1.8rem 1.4rem 1.7rem 1.5rem;background:linear-gradient(#d8923f,#8a4a1d);color:#fff3d6;font:800 1.1rem var(--f-display)}
@media (max-height:820px){.rest-head h1{font-size:2.2rem}.rest-stage{margin-top:1.2rem;gap:8rem}.rest-head p{display:none}}
</style>
