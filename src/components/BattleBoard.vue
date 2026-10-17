<script setup lang="ts">
import type { BattleState, HeroId } from '../game/types'
import HeroPortrait from './HeroPortrait.vue'
import BattleFx from './BattleFx.vue'
const props = defineProps<{ state: BattleState; pulse: number; effect: 'attack' | 'spell' | 'guard' | 'hit' | ''; busy: boolean; fxTarget: HeroId | 'enemy'; fxDamage: number; fxPartnerArmor: number; fxSynergy: boolean; impactTarget: HeroId | 'enemy' | null }>()
const emit = defineEmits<{ impact: []; endTurn: []; continue: [] }>()
function hero(id: HeroId) { return props.state.heroes[id] }
function activityLabel() {
  if (!props.busy) return 'ВАШ ХОД · ВЫБЕРИТЕ КАРТУ'
  if (props.effect === 'attack') return `БРАНН НАНОСИТ ${props.fxDamage} УРОНА${props.fxSynergy ? ' · ЗНАК СНЯТ, КАРТА В РУКУ' : ''}`
  if (props.effect === 'spell') return `ЛИРА НАНОСИТ ${props.fxDamage} УРОНА · ЗНАК ДЛЯ БРАННА`
  if (props.effect === 'guard') return `${hero(props.fxTarget as HeroId).name.toUpperCase()} +${props.fxDamage} БРОНИ · НАПАРНИКУ +${props.fxPartnerArmor}`
  if (props.effect === 'hit') return props.fxDamage === 0 ? `БРОНЯ ЗАЩИТИЛА ${hero(props.fxTarget as HeroId).name.toUpperCase()}` : `${hero(props.fxTarget as HeroId).name.toUpperCase()} ПОЛУЧАЕТ УДАР`
  return 'ВАШ ХОД'
}
</script>
<template>
  <main class="battle-scene">
    <div class="scene-vignette"></div><div class="moon"></div>
    <div class="forest forest--back"></div><div class="forest forest--front"></div>
    <div class="ground-glow"></div>
    <div class="topbar"><div class="game-mark"><span class="mark-icon">✦</span><div><strong>СУМЕРЕЧНАЯ ЧАЩА</strong><small>ГЛАВА I · ЗАБЫТАЯ РОЩА</small></div></div><div class="turn-ribbon"><span>ХОД {{ state.turn }}</span><i></i><small>{{ effect === 'hit' ? 'ХОД СТРАЖА' : 'ВАШ ХОД' }}</small></div><button class="icon-button" aria-label="Настройки">⚙</button></div>
    <section class="enemy-zone">
      <div class="enemy-kicker"><span>✧</span> {{ state.enemy.title.toUpperCase() }} <span>✧</span></div>
      <div v-if="state.enemy.marked" class="enemy-mark">ЗНАК ЛИРЫ · СЛЕДУЮЩИЙ УДАР +3 И ДОБОР</div>
      <HeroPortrait :hero="{ id: 'mage', name: state.enemy.name, title: state.enemy.title, health: state.enemy.health, maxHealth: state.enemy.maxHealth, armor: 0, icon: '✧' }" side="enemy" :appearance="state.enemy.appearance" :damaged="impactTarget === 'enemy'" />
      <div class="intent"><span class="intent-glyph">⌁</span><span>{{ effect === 'hit' ? 'ВРАГ БЬЁТ' : 'ВРАГ АТАКУЕТ' }}</span><b>{{ hero(effect === 'hit' ? fxTarget as HeroId : state.enemy.intent).name }}</b><em>{{ effect === 'hit' ? `−${fxDamage}` : `−${state.enemy.attack}` }}</em></div>
    </section>
    <div class="midline"><div class="rune rune--left">✧</div><span>✦</span><div class="rune rune--right">✧</div></div>
    <BattleFx :pulse="pulse" :effect="effect" :target="fxTarget" :damage="fxDamage" @impact="emit('impact')" />
    <section class="party-zone">
      <div class="party-heading"><span>ОТРЯД ПУТНИКОВ</span><i></i><small>СВЯЗАННЫЕ КЛЯТВОЙ</small></div>
      <div class="heroes"><HeroPortrait :hero="hero('warrior')" side="player" :targeted="state.enemy.intent === 'warrior'" :damaged="impactTarget === 'warrior'"/><div class="party-seal">✦</div><HeroPortrait :hero="hero('mage')" side="player" :targeted="state.enemy.intent === 'mage'" :damaged="impactTarget === 'mage'"/></div>
    </section>
    <div class="combat-toast" :class="{ 'toast-active': busy }"><span>✦</span>{{ activityLabel() }}<span>✦</span></div>
    <div class="bottom-hud"><div class="mana-panel"><span class="mana-caption">МАНА</span><div class="mana-gems"><i v-for="gem in 3" :key="gem" :class="{ spent: gem > state.mana }">✦</i></div><strong>{{ state.mana }}<small>/ 3</small></strong></div><button class="end-turn" :disabled="busy || state.result !== null" @click="emit('endTurn')"><span>⏵</span><b>ЗАВЕРШИТЬ ХОД</b><small>↵</small></button></div>
    <div v-if="state.result" class="result-screen"><div class="result-card"><span class="result-spark">✦</span><small>СУМЕРЕЧНАЯ ЧАЩА</small><h1>{{ state.result === 'victory' ? 'Победа!' : 'Поражение' }}</h1><p>{{ state.result === 'victory' ? 'Противник пал. В чащу ведёт новая тропа.' : 'Древняя магия оказалась сильнее.' }}</p><button class="restart-button" @click="emit('continue')">{{ state.result === 'victory' ? 'ЗАБРАТЬ НАГРАДУ' : 'ВЕРНУТЬСЯ К КАРТЕ' }}</button></div></div>
  </main>
</template>
