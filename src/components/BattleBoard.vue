<script setup lang="ts">
import { computed } from 'vue'
import { forecastEnemyAction } from '../game/battle'
import { pendingTickDamage, statusViews } from '../game/statuses'
import type { BattleState, HeroId } from '../game/types'
import type { BattlePhase, BattlePresentation } from '../composables/useBattleAnimation'
import { heroMarks, lethalHeroes, publicIntent } from '../ui/threatDisplay'
import HeroFrame from './HeroFrame.vue'
import EnemyFrame from './EnemyFrame.vue'
import IntentBanner from './IntentBanner.vue'
import ThreatRays from './ThreatRays.vue'
import BattleFx from './BattleFx.vue'
import BattleResult from './BattleResult.vue'
import BattleHelp from './BattleHelp.vue'
import PhaseShiftBanner from './PhaseShiftBanner.vue'
const props = defineProps<{ state: BattleState; animation: BattlePresentation; phase: BattlePhase; artifactNotices?: string[]; continueLabel?: string; final?: boolean; captioned?: boolean }>()
const emit = defineEmits<{ impact: [actionId: string]; endTurn: []; continue: [] }>()
const enemyStatuses = computed(() => statusViews(props.state, 'enemy'))
// Health the enemy loses to ticking statuses at the start of its turn (Bleeding), drawn as a ghost on its health bar.
const bleedTick = computed(() => props.state.result ? 0 : Math.min(props.state.enemy.health, pendingTickDamage(props.state, 'enemy')))
// While the enemy acts, the forecast the player saw is kept (it was computed before the hit and is what gets executed).
// The engine's forecast stops here: everything below this line receives only the public intent (ui/threatDisplay.ts).
const intent = computed(() => publicIntent(props.phase === 'enemy' && props.animation.incoming ? props.animation.incoming : forecastEnemyAction(props.state)))
const marks = computed(() => heroMarks(intent.value))
// What the sweep effect of an attack on both draws at each hero: the announced loss of a hit that lands now, nothing for a preparation.
const incomingLoss = computed(() => Object.fromEntries(Object.values(marks.value).map(mark => [mark!.hero, mark!.when === 'now' ? mark!.healthLoss : 0])) as Partial<Record<HeroId, number>>)
const heroNames = computed(() => ({ warrior: props.state.heroes.warrior.name, mage: props.state.heroes.mage.name }))
const phaseTitle = computed(() => ({ player: 'Ваш ход', card: 'Способность отряда', enemy: 'Ход противника', finished: 'Бой завершён' })[props.phase])
// B1 enemy rules (the game since X04): the boss's second phase is announced when it begins and keeps its own light for the rest of the fight.
const rebuilt = computed(() => props.state.enemy.phase === 2 && !!props.state.enemy.phaseNote)
const rayTargets = computed(() => Object.keys(marks.value) as HeroId[])
const rayLater = computed(() => intent.value.kind === 'prepare')
const rayLethal = computed(() => lethalHeroes(intent.value))
// Changes whenever the announced numbers change, so the rays re-measure after a protective card moved the layout of the badges.
const rayTick = computed(() => [props.state.turn, props.phase, intent.value.name, ...Object.values(marks.value).map(item => `${item!.hero}${item!.when}${item!.when === 'now' ? item!.healthLoss : ''}`)].join('|'))
</script>
<template>
  <main class="battle-scene" data-battle-scene :class="['battle-scene--' + phase, { 'battle-scene--p2': rebuilt }]">
    <svg class="scene-art" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><radialGradient id="sky"><stop stop-color="#c08d58"/><stop offset=".42" stop-color="#765840"/><stop offset="1" stop-color="#292b2a"/></radialGradient><radialGradient id="sun"><stop stop-color="#ffd28a" stop-opacity=".72"/><stop offset="1" stop-color="#f7a34d" stop-opacity="0"/></radialGradient><linearGradient id="earth" x2="0" y2="1"><stop stop-color="#675744"/><stop offset="1" stop-color="#242827"/></linearGradient></defs>
      <path fill="url(#sky)" d="M0 0h1600v1000H0z"/><ellipse cx="800" cy="340" rx="450" ry="370" fill="url(#sun)"/>
      <path d="M0 0h1600v250Q1360 180 1190 252T800 210T400 250T0 210Z" fill="#252927"/><path d="M0 390Q370 310 800 390T1600 370V1000H0Z" fill="url(#earth)"/>
      <path d="M115 1000V430Q115 90 800 55Q1485 90 1485 430V1000H1350V435Q1350 225 800 205Q250 225 250 435V1000Z" fill="#343633"/>
      <path d="M95 430Q100 65 800 35Q1500 65 1505 430M228 430Q235 185 800 178Q1365 185 1372 430" fill="none" stroke="#765d42" stroke-width="34" stroke-linecap="round"/>
      <path d="M0 650Q330 560 520 650T1050 630T1600 650V1000H0Z" fill="#373831" opacity=".8"/>
      <path d="M0 850H1600M180 440V870M1420 440V870" fill="none" stroke="#604b35" stroke-width="24" stroke-linecap="round"/>
      <ellipse cx="800" cy="695" rx="390" ry="100" fill="#ffd08a" opacity=".1"/><ellipse cx="800" cy="695" rx="300" ry="72" fill="none" stroke="#b79a67" stroke-width="3" opacity=".2"/>
      <path d="M0 920Q240 780 440 900Q650 830 820 920Q1110 800 1300 910Q1480 800 1600 900V1000H0Z" fill="#292b27"/>
    </svg>
    <header class="battle-header">
      <div class="location-label"><span>✦ Мёртвые копи</span><small>Сектор I · Старые штольни</small></div>
      <div :key="phase + (phase === 'player' ? state.turn : '')" class="phase-indicator" :class="'phase-indicator--' + phase" role="status" aria-live="polite"><strong>{{ phaseTitle }}</strong><span>{{ phase === 'player' ? 'Вариан и Джайна · Ход ' + state.turn : phase === 'finished' ? 'Сражение завершено' : animation.label }}</span></div>
      <BattleHelp />
    </header>
    <PhaseShiftBanner :enemy="state.enemy" :turn="state.turn" :next-action="intent.name" />
    <div class="arena">
      <section class="party party--first" aria-label="Вариан Ринн">
        <HeroFrame :hero="state.heroes.warrior" :statuses="statusViews(state, 'warrior')" :artifacts="state.artifacts" :turn="state.turn" :threat="marks.warrior" :hit="animation.impactTarget === 'warrior' || animation.impactTarget === 'both'" :acting="phase === 'card' && animation.source === 'warrior'" />
      </section>
      <section class="enemy-encounter" aria-label="Противник">
        <EnemyFrame :enemy="state.enemy" :statuses="enemyStatuses" :bleed-tick="bleedTick" :acting="phase === 'enemy'" :hit="animation.impactTarget === 'enemy'" :turn="state.turn" />
        <IntentBanner :intent="intent" :hero-names="heroNames" :executing="phase === 'enemy'" :caption="captioned" />
      </section>
      <section class="party party--second" aria-label="Джайна Праудмур">
        <HeroFrame :hero="state.heroes.mage" :statuses="statusViews(state, 'mage')" :artifacts="state.artifacts" :turn="state.turn" :threat="marks.mage" :hit="animation.impactTarget === 'mage' || animation.impactTarget === 'both'" :acting="phase === 'card' && animation.source === 'mage'" />
      </section>
    </div>
    <ThreatRays :targets="rayTargets" :later="rayLater" :lethal="rayLethal" :tick="rayTick" />
    <p v-if="artifactNotices?.length" class="artifact-feedback" role="status" aria-live="polite">{{ artifactNotices.join(' · ') }}</p>
    <BattleFx :pulse="animation.pulse" :action-id="animation.actionId" :effect="animation.effect" :source="animation.source" :target="animation.target" :damage="animation.amount" :bonus-damage="animation.bonusDamage" :partner-armor="animation.partnerArmor" :incoming-loss="incomingLoss" @impact="emit('impact', $event)" />
    <BattleResult v-if="state.result" :result="state.result" :continue-label="continueLabel" :final="final" @continue="emit('continue')" />
  </main>
</template>
<style scoped>
.battle-scene{position:absolute;inset:0;padding-bottom:var(--hand-height);display:grid;grid-template-rows:clamp(68px,8vh,104px) minmax(0,1fr);overflow:hidden;background:#355d50}.scene-art{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.battle-scene::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:1;background:linear-gradient(#112f2b80,transparent 28% 65%,#152c2ac9);transition:background .25s}.battle-scene--enemy::after{background:linear-gradient(#82482b80,#6b38261c 40%,#152c2ac9)}.battle-scene--p2::after{background:radial-gradient(ellipse at 50% 38%,#ff6a3d2e,#0000 55%),linear-gradient(#5a1d1280,transparent 30% 62%,#2a0d0acf)}.battle-scene--p2.battle-scene--enemy::after{background:radial-gradient(ellipse at 50% 38%,#ff6a3d45,#0000 60%),linear-gradient(#8a2d1480,#6b2a1a24 40%,#2a0d0acf)}
.battle-header{position:relative;z-index:7;display:flex;align-items:center;justify-content:space-between;padding:10px clamp(24px,3vw,70px);background:linear-gradient(#173632ad,transparent)}.location-label{display:grid;gap:5px;width:27%}.location-label>span{font:700 clamp(15px,1.2vw,21px) var(--display);color:#f4d7a2}.location-label small{font-size:13px;color:#ccd6c4}.phase-indicator{position:absolute;left:50%;transform:translateX(-50%);width:45%;max-width:600px;text-align:center;display:grid;gap:4px;animation:phase-enter .3s ease-out}.phase-indicator strong{font:700 clamp(25px,2.3vw,38px)/1.1 var(--display);color:#fff0c2;text-shadow:0 2px 10px #1a392b}.phase-indicator>span{font-size:clamp(13px,1vw,17px);color:#e4dfca;min-height:18px}.phase-indicator--enemy strong{color:#ffc198}.phase-indicator--card strong{color:#ddd4f3;font-size:clamp(22px,1.9vw,32px)}
.arena{--arch-h:clamp(150px,calc(100vh - clamp(68px,8vh,104px) - var(--hand-height) - 150px),40vh);--arch-w:calc(var(--arch-h) * .78);--medal-d:clamp(110px,calc(var(--arch-h) * .72),330px);position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr);align-items:end;justify-items:center;gap:clamp(8px,2vw,40px);padding:0 clamp(16px,3.5vw,90px) clamp(8px,1.8vh,20px);min-height:0}.enemy-encounter{position:relative;display:flex;flex-direction:column;align-items:center;gap:clamp(8px,1.4vh,16px);width:100%}.party{position:relative;display:flex;justify-content:center;align-items:flex-end;width:100%}
.artifact-feedback{position:absolute;z-index:6;left:50%;bottom:calc(var(--hand-height) + 12px);transform:translateX(-50%);max-width:min(680px,90vw);margin:0;padding:7px 14px;border:var(--border-soft);border-radius:var(--shape-chip);background:var(--mat-teal-panel);color:var(--gold);font:800 var(--fs-sm)/var(--lh-snug) var(--font-ui);text-align:center;box-shadow:var(--shadow-2);pointer-events:none}

@keyframes phase-enter{from{opacity:.3;translate:0 -5px}to{opacity:1;translate:0 0}}
@media(max-height:700px){.arena{--arch-h:clamp(140px,calc(100vh - 60px - var(--hand-height) - 140px),200px)}.battle-scene{grid-template-rows:60px minmax(0,1fr)}.battle-header{padding-top:5px;padding-bottom:5px}.phase-indicator strong{font-size:25px}.phase-indicator>span{font-size:13px}.location-label small{display:none}}
@media(max-width:1000px){.location-label>span{font-size:15px}.arena{gap:8px;padding-inline:12px}}
</style>
