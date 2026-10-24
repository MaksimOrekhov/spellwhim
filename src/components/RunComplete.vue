<script setup lang="ts">
import { computed } from 'vue'
import { Anvil, Crown, Flame, Gem, ScrollText, Skull, Sparkles, Swords, Trophy } from '@lucide/vue'
import type { DungeonRunState } from '../game/campaign'
import { dungeonNode } from '../game/campaign'
import { artifactDefinition } from '../game/artifacts'
import DeckViewer from './DeckViewer.vue'
import varianPortrait from '../assets/art/varian-krea.webp'
import jainaPortrait from '../assets/art/jaina-krea.webp'
import rhahkZorArt from '../assets/art/enemy-rhahk-zor.svg'
import { rhahkZor } from '../game/sectorContent'
const props = defineProps<{ result: 'victory' | 'defeat'; run?: DungeonRunState }>()
const sector = computed(() => props.run?.status === 'sector-complete')
const rooms = computed(() => props.run?.visitedNodeIds.map(id=>dungeonNode(props.run!.map,id)!).filter(Boolean) ?? [])
const labels = { battle:'Обычный бой', elite:'Элитный бой', forge:'Кузница', treasure:'Сокровищница', event:'Событие', rest:'Привал', final:'Босс' }
const icons = { battle: Swords, elite: Crown, forge: Anvil, treasure: Gem, event: ScrollText, rest: Flame, final: Skull }
const count = (type: string) => rooms.value.filter(n => n.type === type).length
const upgraded = computed(() => props.run?.deck.filter(card => card.upgrade).length ?? 0)
// The run is over, so a new one replaces nothing that can still be played; the menu stays one click away.
const emit = defineEmits<{ newRun: []; menu: [] }>()
</script>

<template>
  <main class="run-complete" :class="{ 'is-sector': sector }">
    <div class="rays" aria-hidden="true"></div>
    <section v-if="sector && run" class="sector-card" aria-labelledby="complete-title">
      <header class="banner">
        <span class="trophy" aria-hidden="true"><Trophy :size="38" :stroke-width="1.8"/></span>
        <small>СЕКТОР I · МЁРТВЫЕ КОПИ</small>
        <h1 id="complete-title">Старые штольни очищены</h1>
        <p>Рак'Зор повержен, лампы снова горят по всему штреку. Продолжение Мёртвых копей появится в следующих секторах.</p>
      </header>

      <div class="columns">
        <div class="left">
          <div class="heroes">
            <figure class="hero hero--warrior"><img :src="varianPortrait" alt="" /><figcaption><small>ВАРИАН РИНН</small><strong>{{ run.heroes.warrior.health }} / {{ run.heroes.warrior.maxHealth }} HP</strong></figcaption></figure>
            <figure class="boss"><img :src="rhahkZorArt" alt="" /><span class="stamp">ПОВЕРЖЕН</span><figcaption><small>{{ rhahkZor.name.toUpperCase() }}</small><strong>{{ rhahkZor.title }}</strong></figcaption></figure>
            <figure class="hero hero--mage"><img :src="jainaPortrait" alt="" /><figcaption><small>ДЖАЙНА ПРАУДМУР</small><strong>{{ run.heroes.mage.health }} / {{ run.heroes.mage.maxHealth }} HP</strong></figcaption></figure>
          </div>
          <ul class="stats" aria-label="Итоги похода">
            <li><b>{{ count('battle') + count('elite') + count('final') }}</b><span>Боёв выиграно</span></li>
            <li><b>{{ count('elite') }}</b><span>Элитных</span></li>
            <li><b>{{ run.deck.length }}</b><span>Карт в колоде</span></li>
            <li><b>{{ upgraded }}</b><span>Улучшено</span></li>
            <li v-if="run.artifacts.length"><b>{{ run.artifacts.length }}</b><span>Артефактов</span></li>
          </ul>
          <ul v-if="run.artifacts.length" class="loot" aria-label="Найденные артефакты"><li v-for="item in run.artifacts" :key="item.instanceId"><Sparkles :size="14" aria-hidden="true"/>{{ artifactDefinition(item.definitionId).name }}</li></ul>
        </div>

        <div class="right">
          <h2>Пройденный путь</h2>
          <ol class="route" aria-label="Маршрут">
            <li v-for="(room, i) in rooms" :key="room.id" :class="`route-${room.type}`"><span class="route-medal"><component :is="icons[room.type]" :size="20" aria-hidden="true"/></span><span class="route-label">{{ labels[room.type] }}</span><span v-if="i < rooms.length - 1" class="route-rail" aria-hidden="true"></span></li>
          </ol>
          <template v-if="run.journal?.length"><h2>Решения</h2><ol class="journal"><li v-for="(entry,i) in run.journal" :key="i">{{ entry.text }}</li></ol></template>
        </div>
      </div>

      <footer><DeckViewer :deck="run.deck" /><button class="game-button" @click="emit('menu')">Главное меню</button><button class="primary" @click="emit('newRun')">Начать новый поход</button></footer>
    </section>

    <section v-else class="complete-card">
      <span class="glyph" aria-hidden="true">{{ result === 'victory' ? '✦' : '◇' }}</span>
      <small>МЁРТВЫЕ КОПИ</small>
      <h1>{{ result === 'victory' ? 'Поход завершён' : 'Отряд пал' }}</h1>
      <p>{{ result === 'victory' ? 'Вы прошли штреки и одолели финального противника.' : 'Выберите другой путь и попробуйте пройти шахту снова.' }}</p>
      <div v-if="run" class="run-summary"><p>Вариан: {{ run.heroes.warrior.health }}/{{ run.heroes.warrior.maxHealth }} HP · Джайна: {{ run.heroes.mage.health }}/{{ run.heroes.mage.maxHealth }} HP</p><p>Карт: {{ run.deck.length }} · Обычные бои: {{ count('battle') }} · Элитные бои: {{ count('elite') }}</p><p>{{ rooms.map(n=>labels[n.type]).join(' → ') }}</p><ol v-if="run.journal?.length"><li v-for="(entry,i) in run.journal" :key="i">{{ entry.text }}</li></ol><DeckViewer :deck="run.deck" /></div>
      <div class="complete-actions"><button class="game-button" @click="emit('menu')">Главное меню</button><button class="primary" @click="emit('newRun')">Начать новый поход</button></div>
    </section>
  </main>
</template>

<style scoped>
.run-complete{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:var(--sp-4);background:radial-gradient(ellipse at 50% 0%,#ffd56b38,#0000 60%),var(--mat-wood);color:var(--ink)}
.rays{position:absolute;inset:0;pointer-events:none;background:repeating-conic-gradient(from 0deg at 50% -10%,#ffd56b14 0 6deg,#0000 6deg 14deg);mask-image:radial-gradient(ellipse at 50% 0%,#000,#0000 70%)}
.complete-card,.sector-card{position:relative;border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-quiet);box-shadow:var(--shadow-4),0 0 60px #ffd56b22;text-align:center}
.complete-card{width:min(840px,94vw);max-height:94vh;overflow:auto;padding:var(--sp-5)}
.glyph{color:var(--brass-1);font-size:36px;text-shadow:0 0 20px #ffc968}
.complete-card small{display:block;margin-top:8px;color:var(--brass-2);font:700 14px var(--font-display);letter-spacing:.23em}
.complete-card h1{margin:12px 0;color:var(--parch-1);font:700 clamp(30px,4vw,44px) var(--font-display)}
.complete-card p{color:var(--parch-2);font:500 17px/1.6 var(--font-ui)}
.run-summary p{font-size:var(--fs-sm);margin:var(--sp-2) 0}.run-summary ol{text-align:left;font:600 var(--fs-sm)/var(--lh-body) var(--font-ui);max-height:180px;overflow:auto}
.primary{padding:12px 24px;border:var(--border-brass);border-radius:var(--shape-plank);background:var(--mat-ruby);background:linear-gradient(#d49b54,#98572e);color:var(--parch-1);font:700 var(--fs-md) var(--font-display);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:var(--shadow-2),inset 0 1px 0 #fff4}
.primary:hover,.primary:focus-visible{filter:brightness(1.12);outline:var(--focus-ring);outline-offset:var(--focus-offset)}
.complete-card .complete-actions{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:var(--sp-3);margin-top:18px}

.sector-card{width:min(1080px,96vw);max-height:96vh;display:flex;flex-direction:column;overflow:hidden}
.banner{position:relative;padding:var(--sp-4) var(--sp-5) var(--sp-3);background:radial-gradient(ellipse at 50% 0%,#ffd56b44,#0000 70%),linear-gradient(#4a321f,#2a1a10);border-bottom:var(--border-panel)}
.trophy{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:var(--shape-medallion);border:3px solid var(--brass-1);background:radial-gradient(circle at 35% 25%,#fff5,#0000 55%),var(--mat-ruby);color:var(--parch-1);box-shadow:0 0 36px #ffd56bb0,var(--shadow-3)}
.banner small{display:block;margin-top:6px;color:var(--brass-2);font:700 var(--fs-xs) var(--font-display);letter-spacing:var(--ls-caps)}
.banner h1{margin:4px 0 6px;color:var(--parch-1);font:700 clamp(30px,3.6vw,46px) var(--font-display);text-shadow:0 2px 0 #000a,0 0 30px #ffd56b66}
.banner p{max-width:640px;margin:0 auto;color:var(--parch-2);font:600 var(--fs-md)/var(--lh-body) var(--font-ui)}
.columns{display:grid;grid-template-columns:1.1fr 1fr;gap:var(--sp-5);min-height:0;overflow:auto;padding:var(--sp-4) var(--sp-5)}
.left,.right{display:grid;align-content:start;gap:var(--sp-3);text-align:left}
.heroes{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:var(--sp-3);align-items:end}
figure{position:relative;margin:0;display:grid;justify-items:center;gap:6px}
figure img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:var(--shape-arch);border:3px solid var(--brass-2);box-shadow:var(--shadow-3)}
.hero--warrior img{border-color:var(--c-threat-line)}.hero--mage img{border-color:#b793ff}
.boss img{aspect-ratio:1;border-radius:var(--shape-medallion);filter:saturate(.6) brightness(.8);border-color:var(--brass-3)}
.stamp{position:absolute;top:70%;left:50%;translate:-50% -50%;rotate:-12deg;padding:2px 12px;border:3px solid var(--c-threat-line);border-radius:var(--r-1);background:#2a0f0cd9;color:var(--c-threat-line);font:800 clamp(14px,1.5vw,20px) var(--font-display);letter-spacing:.14em;box-shadow:var(--shadow-2)}
figcaption{display:grid;text-align:center;gap:1px}figcaption small{color:var(--brass-1);font:700 10px var(--font-display);letter-spacing:.08em}figcaption strong{font:700 var(--fs-sm) var(--font-num)}
.stats{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin:0;padding:0;list-style:none}
.stats li{display:grid;flex:1 1 90px;gap:2px;padding:var(--sp-2) var(--sp-3);border:var(--border-panel);border-radius:var(--shape-chip);background:var(--wood-1);text-align:center}
.stats b{color:var(--brass-1);font:700 var(--fs-2xl) var(--font-num)}.stats span{color:var(--muted);font:700 var(--fs-xs) var(--font-ui)}
.loot{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin:0;padding:0;list-style:none}
.loot li{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:var(--r-pill);background:#ffd56b22;color:var(--c-bonus);font:700 var(--fs-sm) var(--font-ui)}
h2{margin:0;color:var(--brass-1);font:700 var(--fs-lg) var(--font-display);letter-spacing:.06em}
.route{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2) 0;margin:0;padding:0;list-style:none}
.route li{display:flex;align-items:center;gap:6px;--tone:var(--c-armor)}
.route-elite{--tone:var(--c-threat)}.route-event{--tone:var(--c-mana)}.route-forge{--tone:var(--c-threat)}.route-treasure{--tone:var(--c-bonus)}.route-rest{--tone:var(--c-heal)}.route-final{--tone:#d9a0ff}
.route-medal{display:grid;place-items:center;width:38px;height:38px;border-radius:var(--r-pill);border:2px solid var(--tone);background:var(--wood-0);color:var(--tone);box-shadow:inset 0 0 8px #000a}
.route-label{font:700 var(--fs-xs) var(--font-ui);color:var(--parch-2)}
.route-rail{width:14px;height:5px;margin:0 6px 0 2px;border-radius:2px;background:repeating-linear-gradient(90deg,var(--brass-2) 0 4px,#0000 4px 7px)}
.journal{margin:0;padding:var(--sp-3) var(--sp-4) var(--sp-3) var(--sp-6);max-height:150px;overflow:auto;border-radius:var(--shape-scroll);background:var(--mat-parchment);color:var(--parch-ink);font:600 var(--fs-sm)/var(--lh-body) var(--font-ui);box-shadow:inset 0 0 20px #8a622840}
.sector-card footer{display:flex;align-items:center;justify-content:center;gap:var(--sp-4);padding:var(--sp-3) var(--sp-5);border-top:var(--border-panel);background:var(--wood-1)}
@media(max-height:760px){.banner{padding:var(--sp-3) var(--sp-5) var(--sp-2)}.banner p{font-size:var(--fs-sm)}.trophy{width:52px;height:52px}.columns{padding:var(--sp-3) var(--sp-5);gap:var(--sp-4)}.heroes{gap:var(--sp-2)}.journal{max-height:90px}}
@media(max-width:820px){.columns{grid-template-columns:1fr}}
</style>
