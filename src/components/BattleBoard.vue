<script setup lang="ts">
import { computed } from 'vue'
import { forecastEnemyAttack, hasStatus } from '../game/battle'
import type { BattleState } from '../game/types'
import type { BattlePhase, BattlePresentation } from '../composables/useBattleAnimation'
import HeroPortrait from './HeroPortrait.vue'
import BattleFx from './BattleFx.vue'
import GameTooltip from './GameTooltip.vue'
import EnemyIntent from './EnemyIntent.vue'
import BattleResult from './BattleResult.vue'
import BattleHelp from './BattleHelp.vue'
const props = defineProps<{ state: BattleState; animation: BattlePresentation; phase: BattlePhase; continueLabel?: string }>()
const emit = defineEmits<{ impact: [actionId: string]; endTurn: []; continue: [] }>()
const mark = computed(() => hasStatus(props.state, 'mark'))
const resonance = computed(() => hasStatus(props.state, 'resonance'))
const forecast = computed(() => props.phase === 'enemy' && props.animation.incoming ? props.animation.incoming : forecastEnemyAttack(props.state))
const phaseTitle = computed(() => ({ player: 'Ваш ход', card: 'Способность отряда', enemy: 'Ход противника', finished: 'Бой завершён' })[props.phase])
const enemyHero = computed(() => ({ id: 'mage' as const, name: props.state.enemy.name, title: props.state.enemy.title, health: props.state.enemy.health, maxHealth: props.state.enemy.maxHealth, armor: 0, icon: '✧' }))
</script>
<template>
  <main class="battle-scene" data-battle-scene :class="'battle-scene--' + phase">
    <svg class="scene-art" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><radialGradient id="sky"><stop stop-color="#a9c3b4"/><stop offset=".5" stop-color="#537e76"/><stop offset="1" stop-color="#254d49"/></radialGradient><radialGradient id="sun"><stop stop-color="#ffe7a8" stop-opacity=".8"/><stop offset="1" stop-color="#f7dd9e" stop-opacity="0"/></radialGradient><linearGradient id="earth" x2="0" y2="1"><stop stop-color="#5c8063"/><stop offset="1" stop-color="#263f35"/></linearGradient></defs>
      <path fill="url(#sky)" d="M0 0h1600v1000H0z"/><ellipse cx="800" cy="210" rx="400" ry="320" fill="url(#sun)"/>
      <path d="M0 400Q210 190 425 385T900 320T1600 355V1000H0Z" fill="#3b6b61" opacity=".5"/><path d="M0 540Q400 390 800 500T1600 460V1000H0Z" fill="url(#earth)"/>
      <path d="M-50 830Q160 570 150 180Q90 120 0 110L0 0Q180 55 190 175Q240 100 340 70L370 95Q230 145 228 245Q245 540 115 900Z" fill="#193e36"/>
      <path d="M1650 820Q1460 570 1480 160Q1530 130 1610 115V0Q1430 60 1440 160Q1370 100 1260 50L1220 80Q1400 160 1400 255Q1390 540 1525 900Z" fill="#1c4238"/>
      <path d="M0 30Q290 -140 510 70Q360 180 210 145Q90 220 0 165ZM1600 0Q1310 -90 1090 60Q1210 180 1410 130Q1520 220 1600 155Z" fill="#2e5740"/>
      <path d="M0 780Q210 650 380 830Q580 760 800 800Q1060 750 1260 820Q1490 640 1600 760V1000H0Z" fill="#214437" opacity=".75"/>
      <ellipse cx="800" cy="625" rx="420" ry="105" fill="#c8bd80" opacity=".1"/><ellipse cx="800" cy="625" rx="310" ry="77" fill="none" stroke="#c9bd85" stroke-width="3" opacity=".17"/>
      <path d="M0 880Q80 710 180 740Q110 850 0 920M1600 900Q1510 710 1415 765Q1490 875 1600 940" fill="#446647"/>
    </svg>
    <header class="battle-header">
      <div class="location-label"><span>✦ Сумеречная чаща</span><small>{{ state.enemy.title }}</small></div>
      <div :key="phase + (phase === 'player' ? state.turn : '')" class="phase-indicator" :class="'phase-indicator--' + phase" role="status" aria-live="polite"><strong>{{ phaseTitle }}</strong><span>{{ phase === 'player' ? 'Бранн и Лира · Ход ' + state.turn : phase === 'finished' ? 'Сражение завершено' : animation.label }}</span></div>
      <BattleHelp />
    </header>
    <div class="arena">
      <section class="enemy-encounter" aria-label="Противник">
        <HeroPortrait :hero="enemyHero" side="enemy" :appearance="state.enemy.appearance" :marked="mark" :active="phase === 'enemy'" :damaged="animation.impactTarget === 'enemy'" />
        <div class="enemy-plan"><EnemyIntent :forecast="forecast" :target-name="state.heroes[forecast.target].name" :executing="phase === 'enemy'" /></div>
      </section>
      <section class="party" aria-label="Бранн и Лира — общий ход отряда">
        <HeroPortrait :hero="state.heroes.warrior" side="player" :targeted="forecast.target === 'warrior'" :damaged="animation.impactTarget === 'warrior'" :active="phase === 'card' && animation.source === 'warrior'" />
        <div class="party-link">
          <GameTooltip v-if="resonance" label="Защитный резонанс"><button class="resonance-token" aria-label="Активен защитный резонанс">⬡ <span>Резонанс</span></button><template #content><p>Следующее атакующее заклинание Лиры: +2 урона.</p><p>До конца текущего хода.</p></template></GameTooltip>
          <span v-else class="party-link-line" aria-hidden="true">✦</span>
        </div>
        <HeroPortrait :hero="state.heroes.mage" side="player" :targeted="forecast.target === 'mage'" :damaged="animation.impactTarget === 'mage'" :active="phase === 'card' && animation.source === 'mage'" />
      </section>
    </div>
    <BattleFx :pulse="animation.pulse" :action-id="animation.actionId" :effect="animation.effect" :source="animation.source" :target="animation.target" :damage="animation.amount" :bonus-damage="animation.bonusDamage" :partner-armor="animation.partnerArmor" @impact="emit('impact', $event)" />
    <BattleResult v-if="state.result" :result="state.result" :continue-label="continueLabel" @continue="emit('continue')" />
  </main>
</template>
<style scoped>
.battle-scene{position:absolute;inset:0;padding-bottom:var(--hand-height);display:grid;grid-template-rows:clamp(68px,8vh,104px) minmax(0,1fr);overflow:hidden;background:#355d50}.scene-art{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.battle-scene::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:1;background:linear-gradient(#112f2b80,transparent 28% 65%,#152c2ac9);transition:background .25s}.battle-scene--enemy::after{background:linear-gradient(#82482b80,#6b38261c 40%,#152c2ac9)}
.battle-header{position:relative;z-index:7;display:flex;align-items:center;justify-content:space-between;padding:10px clamp(24px,3vw,70px);background:linear-gradient(#173632ad,transparent)}.location-label{display:grid;gap:5px;width:27%}.location-label>span{font:700 clamp(15px,1.2vw,21px) var(--display);color:#f4d7a2}.location-label small{font-size:13px;color:#ccd6c4}.phase-indicator{position:absolute;left:50%;transform:translateX(-50%);width:45%;max-width:600px;text-align:center;display:grid;gap:4px;animation:phase-enter .3s ease-out}.phase-indicator strong{font:700 clamp(25px,2.3vw,38px)/1.1 var(--display);color:#fff0c2;text-shadow:0 2px 10px #1a392b}.phase-indicator>span{font-size:clamp(13px,1vw,17px);color:#e4dfca;min-height:18px}.phase-indicator--enemy strong{color:#ffc198}.phase-indicator--card strong{color:#ddd4f3;font-size:clamp(22px,1.9vw,32px)}
.arena{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:space-around;gap:8px;padding:0 5vw 4px;min-height:0}.enemy-encounter{position:relative;display:flex;justify-content:center;width:100%}.enemy-plan{position:absolute;left:calc(50% + var(--enemy-size) / 2 + 32px);top:22%}.party{position:relative;display:flex;justify-content:center;align-items:center;gap:clamp(80px,18vw,400px);width:100%}.party-link{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%)}.party-link-line{color:#d3c68d8c;font-size:22px}.resonance-token{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #a4dbe0;border-radius:20px;background:#31595ee8;color:#caf5ee;font-weight:700;font-size:20px}.resonance-token span{font-size:14px}

@keyframes phase-enter{from{opacity:.3;translate:0 -5px}to{opacity:1;translate:0 0}}
@media(max-height:700px){.battle-scene{grid-template-rows:60px minmax(0,1fr)}.battle-header{padding-top:5px;padding-bottom:5px}.phase-indicator strong{font-size:25px}.phase-indicator>span{font-size:13px}.location-label small{display:none}.arena{padding-bottom:5px;gap:5px}}
@media(max-width:1000px){.enemy-plan{left:calc(50% + var(--enemy-size) / 2 + 10px)}.location-label>span{font-size:15px}.party{gap:22vw}.resonance-token{padding:7px 9px}.resonance-token span{font-size:12px}}
</style>
