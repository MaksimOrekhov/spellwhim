<script setup lang="ts">
// The exit of a sector (Sector Transition v1): the boss is down, its reward is closed, and the run goes on. The screen sums up what the party takes along
// and shows the road ahead; it never hides that a sector without content is closed. The ledger it reads is written by `claimBossCard/Development`.
import { computed } from 'vue'
import { Check, Flame, Gem, Lock, MapPin, Star, Trophy } from '@lucide/vue'
import type { DungeonRunState } from '../game/campaign'
import { adventureSectors, currentClearance, sectorAfter, sectorIsPlayable } from '../game/adventure'
import { artifactDefinition } from '../game/artifacts'
import { cardChoiceText, developmentChoiceText, healText, sectorTitle } from '../ui/bossRewardDisplay'
import DeckViewer from './DeckViewer.vue'
import varianPortrait from '../assets/art/varian-krea.webp'
import jainaPortrait from '../assets/art/jaina-krea.webp'
import rhahkZorArt from '../assets/art/enemy-rhahk-zor.svg'
import { knownSectorEncounters } from '../game/sectorLong'

const props = defineProps<{ run: DungeonRunState }>()
const emit = defineEmits<{ menu: [] }>()
const journey = computed(() => props.run.journey!)
const here = computed(() => adventureSectors.find(sector => sector.id === journey.value.sectorId)!)
const next = computed(() => sectorAfter(journey.value.sectorId))
const reward = computed(() => currentClearance(journey.value)!.reward)
const boss = computed(() => knownSectorEncounters.find(item => item.id === props.run.map.layers.flat().find(node => node.id === reward.value.nodeId)?.encounterId))
const upgraded = computed(() => props.run.deck.filter(card => card.upgrade).length)
const stage = (id: string) => journey.value.cleared.some(entry => entry.sectorId === id) ? 'cleared' : id === next.value?.id ? 'next' : 'later'
const stageText = { cleared: 'Пройден', next: 'Следующий', later: 'Впереди' } as const
</script>

<template>
  <main class="transition" aria-labelledby="transition-title">
    <div class="rays" aria-hidden="true"></div>
    <section class="exit-card">
      <header class="banner">
        <span class="trophy" aria-hidden="true"><Trophy :size="38" :stroke-width="1.8" /></span>
        <small>{{ sectorTitle(journey.sectorId).toUpperCase() }}</small>
        <h1 id="transition-title">{{ here.name }} пройдены</h1>
        <p>{{ boss?.name }} повержен. Отряд забрал трофеи и передохнул у выхода: колода, улучшения, артефакты и здоровье идут с ним дальше.</p>
      </header>

      <div class="columns">
        <div class="left">
          <div class="heroes">
            <figure class="hero hero--warrior"><img :src="varianPortrait" alt="" /><figcaption><small>{{ run.heroes.warrior.name.toUpperCase() }}</small><strong>{{ run.heroes.warrior.health }} / {{ run.heroes.warrior.maxHealth }} HP</strong></figcaption></figure>
            <figure class="boss"><img :src="rhahkZorArt" alt="" /><span class="stamp">ПОВЕРЖЕН</span><figcaption><small>{{ boss?.name.toUpperCase() }}</small><strong>{{ boss?.title }}</strong></figcaption></figure>
            <figure class="hero hero--mage"><img :src="jainaPortrait" alt="" /><figcaption><small>{{ run.heroes.mage.name.toUpperCase() }}</small><strong>{{ run.heroes.mage.health }} / {{ run.heroes.mage.maxHealth }} HP</strong></figcaption></figure>
          </div>

          <h2>Трофеи босса</h2>
          <ul class="trophies" aria-label="Что дал босс">
            <li><Star :size="20" aria-hidden="true" /><div><small>Золотая карта</small><span>{{ reward.cardChoice ? cardChoiceText(reward.cardChoice) : '' }}</span></div></li>
            <li><Gem :size="20" aria-hidden="true" /><div><small>Развитие</small><span>{{ reward.developmentChoice ? developmentChoiceText(reward.developmentChoice, run.heroes) : '' }}</span></div></li>
            <li><Flame :size="20" aria-hidden="true" /><div><small>Привал у выхода</small><span>{{ reward.healed ? healText(reward.healed, run.heroes) : '' }}</span></div></li>
          </ul>

          <ul class="stats" aria-label="Состояние отряда">
            <li><b>{{ run.deck.length }}</b><span>Карт в колоде</span></li>
            <li><b>{{ upgraded }}</b><span>Улучшено</span></li>
            <li><b>{{ run.artifacts.length }}</b><span>Артефактов</span></li>
          </ul>
          <ul v-if="run.artifacts.length" class="loot" aria-label="Артефакты отряда"><li v-for="item in run.artifacts" :key="item.instanceId">{{ artifactDefinition(item.definitionId).name }}</li></ul>
        </div>

        <div class="right">
          <h2>Путь приключения</h2>
          <ol class="road" aria-label="Три сектора приключения">
            <li v-for="(sector, index) in adventureSectors" :key="sector.id" :class="`is-${stage(sector.id)}`" :aria-current="stage(sector.id) === 'next' ? 'step' : undefined">
              <span class="medal" aria-hidden="true"><Check v-if="stage(sector.id) === 'cleared'" :size="22" /><MapPin v-else-if="stage(sector.id) === 'next'" :size="22" /><Lock v-else :size="20" /></span>
              <span class="stop"><small>Сектор {{ index + 1 }} · {{ stageText[stage(sector.id)] }}</small><strong>{{ sector.name }}</strong><em>{{ sector.tagline }}</em></span>
            </li>
          </ol>

          <p v-if="next && !sectorIsPlayable(next)" class="gate" role="status"><Lock :size="20" aria-hidden="true" />Путь в сектор «{{ next.name }}» пока закрыт: он ещё в разработке. Поход сохранён у выхода из сектора «{{ here.name }}» — отряд, колода и награды дождутся его открытия.</p>
        </div>
      </div>

      <footer><DeckViewer :deck="run.deck" /><button class="primary" @click="emit('menu')">Главное меню</button></footer>
    </section>
  </main>
</template>

<style scoped>
.transition{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:var(--sp-4);background:radial-gradient(ellipse at 50% 0%,#ffd56b38,#0000 60%),var(--mat-wood);color:var(--ink)}
.rays{position:absolute;inset:0;pointer-events:none;background:repeating-conic-gradient(from 0deg at 50% -10%,#ffd56b14 0 6deg,#0000 6deg 14deg);mask-image:radial-gradient(ellipse at 50% 0%,#000,#0000 70%)}
.exit-card{position:relative;width:min(1080px,96vw);max-height:96vh;display:flex;flex-direction:column;overflow:hidden;border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-quiet);box-shadow:var(--shadow-4),0 0 60px #ffd56b22;text-align:center}
.banner{position:relative;padding:var(--sp-4) var(--sp-5) var(--sp-3);background:radial-gradient(ellipse at 50% 0%,#ffd56b44,#0000 70%),linear-gradient(#4a321f,#2a1a10);border-bottom:var(--border-panel)}
.trophy{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:var(--shape-medallion);border:3px solid var(--brass-1);background:radial-gradient(circle at 35% 25%,#fff5,#0000 55%),var(--mat-ruby);color:var(--parch-1);box-shadow:0 0 36px #ffd56bb0,var(--shadow-3)}
.banner small{display:block;margin-top:6px;color:var(--brass-2);font:700 var(--fs-xs) var(--font-display);letter-spacing:var(--ls-caps)}
.banner h1{margin:4px 0 6px;color:var(--parch-1);font:700 clamp(30px,3.6vw,46px) var(--font-display);text-shadow:0 2px 0 #000a,0 0 30px #ffd56b66}
.banner p{max-width:700px;margin:0 auto;color:var(--parch-2);font:600 var(--fs-md)/var(--lh-body) var(--font-ui)}
.columns{display:grid;grid-template-columns:1.1fr 1fr;gap:var(--sp-5);min-height:0;overflow:auto;padding:var(--sp-4) var(--sp-5)}
.left,.right{display:grid;align-content:start;gap:var(--sp-3);text-align:left}
.heroes{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:var(--sp-3);align-items:end}
figure{position:relative;margin:0;display:grid;justify-items:center;gap:6px}
figure img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:var(--shape-arch);border:3px solid var(--brass-2);box-shadow:var(--shadow-3)}
.hero--warrior img{border-color:var(--c-threat-line)}.hero--mage img{border-color:#b793ff}
.boss img{aspect-ratio:1;border-radius:var(--shape-medallion);filter:saturate(.6) brightness(.8);border-color:var(--brass-3)}
.stamp{position:absolute;top:70%;left:50%;translate:-50% -50%;rotate:-12deg;padding:2px 12px;border:3px solid var(--c-threat-line);border-radius:var(--r-1);background:#2a0f0cd9;color:var(--c-threat-line);font:800 clamp(14px,1.5vw,20px) var(--font-display);letter-spacing:.14em;box-shadow:var(--shadow-2)}
figcaption{display:grid;text-align:center;gap:1px}figcaption small{color:var(--brass-1);font:700 10px var(--font-display);letter-spacing:.08em}figcaption strong{font:700 var(--fs-sm) var(--font-num)}
h2{margin:0;color:var(--brass-1);font:700 var(--fs-lg) var(--font-display);letter-spacing:.06em}
.trophies{display:grid;gap:var(--sp-2);margin:0;padding:0;list-style:none}
.trophies li{display:flex;align-items:flex-start;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);border:var(--border-panel);border-radius:var(--shape-chip);background:var(--wood-1)}
.trophies svg{flex:none;margin-top:2px;color:var(--gold)}
.trophies small{display:block;color:var(--brass-1);font:700 var(--fs-xs) var(--font-display);letter-spacing:.08em;text-transform:uppercase}
.trophies span{color:var(--parch-1);font:600 var(--fs-sm)/var(--lh-body) var(--font-ui)}
.stats{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin:0;padding:0;list-style:none}
.stats li{display:grid;flex:1 1 90px;gap:2px;padding:var(--sp-2) var(--sp-3);border:var(--border-panel);border-radius:var(--shape-chip);background:var(--wood-1);text-align:center}
.stats b{color:var(--brass-1);font:700 var(--fs-2xl) var(--font-num)}.stats span{color:var(--muted);font:700 var(--fs-xs) var(--font-ui)}
.loot{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin:0;padding:0;list-style:none}
.loot li{padding:3px 12px;border-radius:var(--r-pill);background:#ffd56b22;color:var(--c-bonus);font:700 var(--fs-sm) var(--font-ui)}
.road{display:grid;gap:var(--sp-3);margin:0;padding:0;list-style:none}
.road li{position:relative;display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);border:var(--border-panel);border-radius:var(--shape-banner);background:var(--wood-1);--tone:var(--muted)}
.road li:not(:last-child)::after{content:'';position:absolute;left:29px;top:100%;width:5px;height:var(--sp-3);background:repeating-linear-gradient(180deg,var(--brass-2) 0 4px,#0000 4px 7px)}
.road .is-cleared{--tone:var(--c-heal)}.road .is-next{--tone:var(--brass-1);border-color:var(--brass-1);box-shadow:var(--glow-bonus)}
.medal{display:grid;flex:none;place-items:center;width:42px;height:42px;border-radius:var(--r-pill);border:2px solid var(--tone);background:var(--wood-0);color:var(--tone);box-shadow:inset 0 0 8px #000a}
.stop{display:grid;gap:1px}.stop small{color:var(--tone);font:700 var(--fs-xs) var(--font-ui);letter-spacing:.06em;text-transform:uppercase}
.stop strong{color:var(--parch-1);font:700 var(--fs-md) var(--font-display)}.stop em{color:var(--muted);font:600 var(--fs-xs) var(--font-ui);font-style:normal}
.gate{display:flex;align-items:flex-start;gap:var(--sp-2);margin:0;padding:var(--sp-3);border-left:4px solid var(--brass-2);border-radius:var(--r-1);background:#0004;color:var(--parch-1);font:600 var(--fs-sm)/var(--lh-body) var(--font-ui)}
.gate svg{flex:none;margin-top:2px;color:var(--brass-2)}
.exit-card footer{display:flex;align-items:center;justify-content:center;gap:var(--sp-4);padding:var(--sp-3) var(--sp-5);border-top:var(--border-panel);background:var(--wood-1)}
.primary{padding:12px 24px;border:var(--border-brass);border-radius:var(--shape-plank);background:linear-gradient(#d49b54,#98572e);color:var(--parch-1);font:700 var(--fs-md) var(--font-display);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:var(--shadow-2),inset 0 1px 0 #fff4}
.primary:hover,.primary:focus-visible{filter:brightness(1.12);outline:var(--focus-ring);outline-offset:var(--focus-offset)}
@media(max-height:760px){.banner{padding:var(--sp-3) var(--sp-5) var(--sp-2)}.banner p{font-size:var(--fs-sm)}.trophy{width:52px;height:52px}.columns{padding:var(--sp-3) var(--sp-5);gap:var(--sp-4)}.heroes{gap:var(--sp-2)}}
@media(max-width:820px){.columns{grid-template-columns:1fr}}
</style>
