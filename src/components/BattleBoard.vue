<script setup lang="ts">
import { computed } from 'vue'
import { hasStatus } from '../game/battle'
import { statusDefinitions } from '../game/types'
import type { BattleState, HeroId } from '../game/types'
import type { BattlePresentation } from '../composables/useBattleAnimation'
import HeroPortrait from './HeroPortrait.vue'
import BattleFx from './BattleFx.vue'
const props = defineProps<{ state: BattleState; animation: BattlePresentation }>()
const emit = defineEmits<{ impact: [actionId: string]; endTurn: []; continue: [] }>()
const markActive = computed(() => hasStatus(props.state, 'mark'))
const resonanceActive = computed(() => hasStatus(props.state, 'resonance'))
function hero(id: HeroId) { return props.state.heroes[id] }
</script>
<template>
  <main class="battle-scene">
    <div class="scene-vignette"></div><div class="moon"></div>
    <div class="forest forest--back"></div><div class="forest forest--front"></div>
    <div class="ground-glow"></div>
    <div class="topbar"><div class="game-mark"><span class="mark-icon">✦</span><div><strong>СУМЕРЕЧНАЯ ЧАЩА</strong><small>ГЛАВА I · ЗАБЫТАЯ РОЩА</small></div></div><div class="turn-ribbon"><span>ХОД {{ state.turn }}</span><i></i><small>{{ animation.effect === 'hit' ? 'ХОД СТРАЖА' : 'ВАШ ХОД' }}</small></div><button class="icon-button" aria-label="Настройки">⚙</button></div>
    <section class="enemy-zone">
      <div class="enemy-kicker"><span>✧</span> {{ state.enemy.title.toUpperCase() }} <span>✧</span></div>
      <span v-if="markActive" class="enemy-mark-icon" :title="statusDefinitions.mark.description">✦</span>
      <HeroPortrait :hero="{ id: 'mage', name: state.enemy.name, title: state.enemy.title, health: state.enemy.health, maxHealth: state.enemy.maxHealth, armor: 0, icon: '✧' }" :class="{ 'has-magic-mark': markActive }" side="enemy" :appearance="state.enemy.appearance" :damaged="animation.impactTarget === 'enemy'" />
      <div class="intent"><span class="intent-glyph">⌁</span><span>{{ animation.effect === 'hit' ? 'ВРАГ БЬЁТ' : 'ВРАГ АТАКУЕТ' }}</span><b>{{ hero(animation.effect === 'hit' ? animation.target as HeroId : state.enemy.intent).name }}</b><em>{{ animation.effect === 'hit' ? `−${animation.amount}` : `−${state.enemy.attack}` }}</em></div>
    </section>
    <aside class="link-statuses" aria-label="Связки отряда" aria-live="polite">
      <div class="link-status" :class="{ 'link-status--active': markActive }">
        <strong>✦ Метка Лиры</strong>
        <span>{{ markActive ? 'Удар Бранна: +3 урона и добор' : 'Подготовьте Огненным шаром' }}</span>
        <small>{{ markActive ? 'ГОТОВА · ДО КОНЦА ХОДА' : 'МАГ → ВОИН' }}</small>
      </div>
      <div class="link-status link-status--guard" :class="{ 'link-status--active': resonanceActive }">
        <strong>⬡ Защитный резонанс</strong>
        <span>{{ resonanceActive ? 'Заклинание Лиры: +2 урона' : 'Подготовьте защитой Бранна' }}</span>
        <small>{{ resonanceActive ? 'ГОТОВ · ДО КОНЦА ХОДА' : 'ВОИН → МАГ' }}</small>
      </div>
    </aside>
    <div class="midline"><div class="rune rune--left">✧</div><span>✦</span><div class="rune rune--right">✧</div></div>
    <BattleFx :pulse="animation.pulse" :action-id="animation.actionId" :effect="animation.effect" :target="animation.target" :damage="animation.amount" :bonus-damage="animation.bonusDamage" :partner-armor="animation.partnerArmor" @impact="emit('impact', $event)" />
    <section class="party-zone">
      <div class="party-heading"><span>ОТРЯД ПУТНИКОВ</span><i></i><small>СВЯЗАННЫЕ КЛЯТВОЙ</small></div>
      <div class="heroes"><HeroPortrait :hero="hero('warrior')" side="player" :targeted="state.enemy.intent === 'warrior'" :damaged="animation.impactTarget === 'warrior'"/><div class="party-seal" :class="{ 'party-seal--resonance': resonanceActive }" :title="statusDefinitions.resonance.description">✦</div><HeroPortrait :hero="hero('mage')" side="player" :targeted="state.enemy.intent === 'mage'" :damaged="animation.impactTarget === 'mage'"/></div>
    </section>
    <div class="combat-toast" :class="{ 'toast-active': animation.busy }"><span>✦</span>{{ animation.busy ? animation.label : 'ВАШ ХОД · ВЫБЕРИТЕ КАРТУ' }}<span>✦</span></div>
    <div class="bottom-hud"><div class="mana-panel"><span class="mana-caption">МАНА</span><div class="mana-gems"><i v-for="gem in 3" :key="gem" :class="{ spent: gem > state.mana }">✦</i></div><strong>{{ state.mana }}<small>/ 3</small></strong></div><button class="end-turn" :disabled="animation.busy || state.result !== null" @click="emit('endTurn')"><span>⏵</span><b>ЗАВЕРШИТЬ ХОД</b><small>↵</small></button></div>
    <div v-if="state.result" class="result-screen"><div class="result-card"><span class="result-spark">✦</span><small>СУМЕРЕЧНАЯ ЧАЩА</small><h1>{{ state.result === 'victory' ? 'Победа!' : 'Поражение' }}</h1><p>{{ state.result === 'victory' ? 'Противник пал. В чащу ведёт новая тропа.' : 'Древняя магия оказалась сильнее.' }}</p><button class="restart-button" @click="emit('continue')">{{ state.result === 'victory' ? 'ЗАБРАТЬ НАГРАДУ' : 'ВЕРНУТЬСЯ К КАРТЕ' }}</button></div></div>
  </main>
</template>

<style scoped>
.link-statuses{position:absolute;z-index:3;left:4%;top:29%;width:23%;max-width:300px;display:grid;gap:12px}
.link-status{display:grid;gap:6px;padding:12px 14px;border:1px solid #ad8dcc66;border-radius:7px;background:#211e30dc;color:#e5d8ef;opacity:.75}
.link-status strong{font:700 clamp(13px,1vw,18px) Georgia,serif}.link-status span{font:500 clamp(11px,.8vw,14px)/1.35 Manrope,Arial,sans-serif}.link-status small{font:800 clamp(9px,.65vw,12px) Manrope,Arial,sans-serif;color:#d0b2ea;letter-spacing:.05em}
.link-status--active{opacity:1;border-color:#e2b9ff;box-shadow:0 0 20px #ac6add40;background:#352346ed}.link-status--guard{border-color:#83d2e277}.link-status--guard.link-status--active{border-color:#a8f5ff;box-shadow:0 0 20px #66ccff40;background:#1b3a4aec}.link-status--guard small{color:#a3e4ef}
.enemy-mark-icon{position:absolute;z-index:4;top:23%;left:calc(50% + 65px);display:grid;place-items:center;width:36px;height:36px;border:2px solid #e5bdff;border-radius:50%;background:#593278;color:#f7e4ff;font-size:28px;box-shadow:0 0 20px #b875ff}
.has-magic-mark :deep(.hero-art){box-shadow:0 0 0 4px #211830,0 0 0 8px #d4a0ff,0 0 35px #ba74ff9c}
.party-seal--resonance{border-color:#bdfaff;color:#c2f8ff;box-shadow:0 0 25px #63dcff;animation:resonance-ready 1.6s ease-in-out infinite}
@keyframes resonance-ready{50%{box-shadow:0 0 36px #6fe9ff;transform:scale(1.12)}}
@media(max-width:800px){.link-statuses{left:3%;width:25%;top:30%;gap:7px}.link-status{padding:8px;gap:4px}.link-status strong{font-size:11px}.link-status span{font-size:9px}.link-status small{font-size:8px}.enemy-mark-icon{left:calc(50% + 45px);width:28px;height:28px;font-size:22px}}
@media(max-width:540px){.link-statuses{top:11%;width:30%}.link-status{padding:6px}.link-status span{display:none}.link-status small{font-size:7px}.link-status strong{font-size:10px}}
@media(prefers-reduced-motion:reduce){.party-seal--resonance{animation:none}}
</style>
