<script setup lang="ts">
import { computed } from 'vue'
import { forecastEnemyAction } from '../game/battle'
import { pendingTickDamage, statusViews } from '../game/statuses'
import type { BattleState, HeroId } from '../game/types'
import type { BattlePhase, BattlePresentation } from '../composables/useBattleAnimation'
import { heroMarks, lethalHeroes, publicIntent } from '../ui/threatDisplay'
import { enemyTier } from '../ui/enemyTier'
import HeroFrame from './HeroFrame.vue'
import EnemyFrame from './EnemyFrame.vue'
import IntentBanner from './IntentBanner.vue'
import ThreatRays from './ThreatRays.vue'
import BattleFx from './BattleFx.vue'
import BattleResult from './BattleResult.vue'
import BattleHelp from './BattleHelp.vue'
import PhaseShiftBanner from './PhaseShiftBanner.vue'
import BattleBackdrop from './BattleBackdrop.vue'
import { battleBackground } from '../ui/battleBackground'
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
// Presentation only: an elite and a boss tint the lights of the cave, the fight itself is unchanged.
const tier = computed(() => enemyTier(props.state.enemy.encounterId))
// The painted background follows the same stable encounter ID, so a restored save shows the right one at once.
const background = computed(() => battleBackground(props.state.enemy.encounterId))
const rayTargets = computed(() => Object.keys(marks.value) as HeroId[])
const rayLater = computed(() => intent.value.kind === 'prepare')
const rayLethal = computed(() => lethalHeroes(intent.value))
// Changes whenever the announced numbers change, so the rays re-measure after a protective card moved the layout of the badges.
const rayTick = computed(() => [props.state.turn, props.phase, intent.value.name, ...Object.values(marks.value).map(item => `${item!.hero}${item!.when}${item!.when === 'now' ? item!.healthLoss : ''}`)].join('|'))
</script>
<template>
  <main class="battle-scene" data-battle-scene :class="['battle-scene--' + phase, 'battle-scene--tier-' + tier, { 'battle-scene--p2': rebuilt }]">
    <BattleBackdrop :background="background" />
    <header class="battle-header">
      <div class="location-label"><span>✦ Мёртвые копи</span><small>Сектор I · Старые штольни</small></div>
      <div :key="phase + (phase === 'player' ? state.turn : '')" class="phase-indicator" :class="'phase-indicator--' + phase" role="status" aria-live="polite"><strong>{{ phaseTitle }}</strong><span>{{ phase === 'player' ? 'Ход ' + state.turn : phase === 'finished' ? 'Сражение завершено' : animation.label }}</span></div>
      <BattleHelp />
    </header>
    <PhaseShiftBanner :enemy="state.enemy" :turn="state.turn" :next-action="intent.name" />
    <div class="arena">
      <div class="stage">
        <section class="party party--first" aria-label="Вариан Ринн">
          <HeroFrame side="left" :hero="state.heroes.warrior" :statuses="statusViews(state, 'warrior')" :artifacts="state.artifacts" :turn="state.turn" :threat="marks.warrior" :hit="animation.impactTarget === 'warrior' || animation.impactTarget === 'both'" :acting="phase === 'card' && animation.source === 'warrior'" />
        </section>
        <section class="enemy-encounter" aria-label="Противник">
          <EnemyFrame :enemy="state.enemy" :statuses="enemyStatuses" :bleed-tick="bleedTick" :acting="phase === 'enemy'" :hit="animation.impactTarget === 'enemy'" :turn="state.turn" />
          <IntentBanner :intent="intent" :hero-names="heroNames" :executing="phase === 'enemy'" :caption="captioned" />
        </section>
        <section class="party party--second" aria-label="Джайна Праудмур">
          <HeroFrame side="right" :hero="state.heroes.mage" :statuses="statusViews(state, 'mage')" :artifacts="state.artifacts" :turn="state.turn" :threat="marks.mage" :hit="animation.impactTarget === 'mage' || animation.impactTarget === 'both'" :acting="phase === 'card' && animation.source === 'mage'" />
        </section>
      </div>
    </div>
    <ThreatRays :targets="rayTargets" :later="rayLater" :lethal="rayLethal" :tick="rayTick" :executing="phase === 'enemy'" />
    <p v-if="artifactNotices?.length" class="artifact-feedback" role="status" aria-live="polite">{{ artifactNotices.join(' · ') }}</p>
    <BattleFx :pulse="animation.pulse" :action-id="animation.actionId" :effect="animation.effect" :source="animation.source" :target="animation.target" :damage="animation.amount" :bonus-damage="animation.bonusDamage" :partner-armor="animation.partnerArmor" :incoming-loss="incomingLoss" @impact="emit('impact', $event)" />
    <BattleResult v-if="state.result" :result="state.result" :continue-label="continueLabel" :final="final" @continue="emit('continue')" />
  </main>
</template>
<style scoped>
/* The scene is one stage: header on top, the arena (a size container: its own height sets the size of the figures), the hand below.
   Mood is carried by --scene-* variables that recolour the backdrop's lights: a warmer lamp on the enemy's turn, a crimson one in a
   boss's second phase, an orange forge glow for a boss, a cold blue one for an elite; the interface itself stays quiet. */
.battle-scene{--scene-core:#ffb866;--scene-lamp:#ffb054;--scene-far:#ffd890;position:absolute;inset:0;padding-bottom:var(--hand-height);display:grid;grid-template-rows:clamp(46px,5.6vh,72px) minmax(0,1fr);overflow:hidden;background:#161a1d}
.battle-scene--enemy{--scene-lamp:#ff8a4a;--scene-core:#ff8a5a}
.battle-scene--card{--scene-core:#c9a8ff}
.battle-scene--tier-elite{--scene-far:#7fb2ff;--scene-core:#8aa4ff}
.battle-scene--tier-boss{--scene-far:#ffa63d;--scene-core:#ff9a45;--scene-lamp:#ffb454}
.battle-scene--p2{--scene-far:#ff4a28;--scene-core:#ff3d3d;--scene-lamp:#ff5a32}
.battle-scene::after{content:'';position:absolute;inset:0;bottom:var(--hand-height);pointer-events:none;z-index:1;background:radial-gradient(ellipse at 50% 46%,#0000 50%,#050709b0 100%);transition:background .25s}
.battle-scene--p2::after{background:radial-gradient(ellipse at 50% 46%,#ff3a1a1c,#0000 40%),radial-gradient(ellipse at 50% 46%,#0000 46%,#2a0805c0 100%)}
.battle-header{position:relative;z-index:7;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(18px,3vw,70px);background:linear-gradient(#0d1214b8,transparent)}
.location-label{display:grid;gap:3px;width:27%}.location-label>span{font:700 clamp(15px,1.2vw,21px) var(--font-display);color:#f4d7a2;text-shadow:0 2px 6px #000b}.location-label small{font-size:13px;color:#d6d8c6;text-shadow:0 1px 4px #000b}
.phase-indicator{position:absolute;left:50%;top:50%;translate:-50% -50%;display:flex;align-items:baseline;justify-content:center;gap:.7em;max-width:46%;padding:clamp(3px,.6vh,7px) clamp(16px,2vw,30px) clamp(4px,.7vh,8px);border-radius:var(--shape-banner);background:linear-gradient(#3d2a1bf0,#21150ff2);border:2px solid var(--brass-3);box-shadow:var(--shadow-2),inset 0 1px 1px #fff3;white-space:nowrap;animation:phase-enter .3s ease-out}
.phase-indicator strong{font:700 clamp(18px,2.6vh,30px)/1.1 var(--font-display);color:#fff0c2;text-shadow:0 2px 6px #000a}
.phase-indicator>span{overflow:hidden;text-overflow:ellipsis;font-size:clamp(12px,1.6vh,16px);color:#e4dfca}
.phase-indicator--enemy{border-color:var(--c-threat-line)}.phase-indicator--enemy strong{color:#ffc198}
.phase-indicator--card{border-color:#b79cf2}.phase-indicator--card strong{color:#ddd4f3}
.arena{container:arena / size;position:relative;z-index:2;min-height:0}
.stage{--arch-h:clamp(110px,46cqh,400px);--arch-w:calc(var(--arch-h) * .78);--medal-d:clamp(100px,min(48cqh,30cqw),440px);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr);align-items:end;gap:clamp(4px,1.4cqw,32px);height:100%;padding:0 clamp(12px,3cqw,90px) 14px}
.enemy-encounter{position:relative;display:flex;flex-direction:column;align-items:center;gap:clamp(2px,.8cqh,12px);width:100%;align-self:center}
.party{position:relative;display:flex;align-items:flex-end;width:100%}
.party--first{justify-content:flex-end;padding-right:clamp(30px,4cqw,100px)}.party--second{justify-content:flex-start;padding-left:clamp(30px,4cqw,100px)}
.artifact-feedback{position:absolute;z-index:6;left:50%;bottom:calc(var(--hand-height) + 12px);transform:translateX(-50%);max-width:min(680px,90vw);margin:0;padding:7px 14px;border:var(--border-soft);border-radius:var(--shape-chip);background:var(--mat-teal-panel);color:var(--gold);font:800 var(--fs-sm)/var(--lh-snug) var(--font-ui);text-align:center;box-shadow:var(--shadow-2);pointer-events:none}

@keyframes phase-enter{from{opacity:.3;scale:.94}to{opacity:1;scale:1}}
@media(max-height:700px){.location-label small{display:none}}
@media(max-width:1000px){.location-label>span{font-size:15px}}
</style>
