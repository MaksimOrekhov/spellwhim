<script setup lang="ts">
// Dev-only lab for the battle effects (card-preview.html?view=vfx): the real board and hand, a list of reproducible scenes built by the real
// rules engine (src/vfx/scenarios.ts), and a button that plays the chosen one through the same path as the game (startCardPlay /
// forecastEnemyAction → useBattleAnimation → BattleFx). Query: &fx=<scenario id>  &motion=reduced  &speed=0.25 (slow motion)
// &hold=<ms> (freeze the picture at a moment of the effect, for stills)  &auto=1 (play on load)  &loop=1 (replay forever)  &panel=0 (no panel).
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import BattleBoard from './BattleBoard.vue'
import BattleHand from './BattleHand.vue'
import { endTurn, resolveCardPlay, startCardPlay, previewCard } from '../game/battle'
import { resolveCardDefinition } from '../game/cardProgression'
import { useBattleAnimation } from '../composables/useBattleAnimation'
import { vfxScenario, vfxScenarios } from '../vfx/scenarios'
import type { ScenarioGroup, VfxScenario } from '../vfx/scenarios'
import type { Motion } from '../vfx/types'
import type { HandCardView } from '../composables/useBattle'
import type { BattleState } from '../game/types'

const query = new URLSearchParams(window.location.search)
const showPanel = query.get('panel') !== '0'
const motion = ref<Motion>(query.get('motion') === 'reduced' ? 'reduced' : 'full')
const speed = ref(Number(query.get('speed') ?? 1) || 1)
const hold = ref<number | null>(query.get('hold') !== null ? Number(query.get('hold')) : null)
const loop = ref(query.get('loop') === '1')
const current = shallowRef<VfxScenario>(vfxScenario(query.get('fx') ?? '') ?? vfxScenarios[0]!)
const state = shallowRef<BattleState>(current.value.build())

function resolvePlay(actionId: string) {
  const next = structuredClone(state.value)
  const result = resolveCardPlay(next, actionId)
  if (result.ok) state.value = next
  return result
}
function finishTurn() { const next = structuredClone(state.value); if (endTurn(next)) state.value = next }
const { animation, phase, impact, play, enemyTurn, cancel } = useBattleAnimation({ state, resolvePlay, finishTurn, motion: () => motion.value })

const views = computed<HandCardView[]>(() => state.value.hand.map(instance => {
  const card = resolveCardDefinition(instance)
  return { instanceId: instance.instanceId, card, preview: previewCard(state.value, card), playable: !state.value.pending && state.value.mana >= card.cost }
}))
const pendingView = computed<HandCardView | null>(() => {
  const pending = state.value.pending
  return pending ? { instanceId: pending.card.instanceId, card: resolveCardDefinition(pending.card), preview: pending.preview, playable: false } : null
})

let loopTimer: ReturnType<typeof setTimeout> | undefined
function reset(scenario = current.value) {
  window.clearTimeout(loopTimer)
  cancel()
  current.value = scenario
  state.value = scenario.build()
}
async function replay(scenario = current.value) {
  reset(scenario)
  await nextTick()
  // One frame of stillness between runs so each play starts from the same picture.
  await new Promise(done => window.setTimeout(done, 80))
  const run = scenario.run
  if (run.kind === 'enemy') enemyTurn()
  else {
    const next = structuredClone(state.value)
    const started = startCardPlay(next, next.hand[0]!.instanceId)
    if (!started.ok) return
    state.value = next
    play(started.play)
  }
}
function again() { void replay() }
function choose(scenario: VfxScenario) { void replay(scenario) }

const groups: { id: ScenarioGroup; title: string }[] = [
  { id: 'varian', title: 'Вариан' }, { id: 'jaina', title: 'Джайна' }, { id: 'defense', title: 'Защита' }, { id: 'enemy', title: 'Противники' }, { id: 'boss', title: 'Рак’Зор' },
]
const plan = computed(() => animation.value.vfx)
const summary = computed(() => plan.value ? `${plan.value.scenario} · ${plan.value.beats.length} событий · удар на ${plan.value.impactMs} мс · свободно на ${plan.value.recoveryMs} мс` : 'ничего не играет')

// After a run ends, replay it when looping.
let wasBusy = false
const watchBusy = () => {
  if (wasBusy && !animation.value.busy && loop.value) loopTimer = window.setTimeout(again, 700)
  wasBusy = animation.value.busy
}
const poll = window.setInterval(watchBusy, 100)
onUnmounted(() => { window.clearInterval(poll); window.clearTimeout(loopTimer) })

onMounted(() => {
  ;(window as unknown as { __vfxLab: unknown }).__vfxLab = { play: (id: string) => { const scenario = vfxScenario(id); if (scenario) return replay(scenario) }, busy: () => animation.value.busy, ids: vfxScenarios.map(item => item.id), setHold: (ms: number | null) => { hold.value = ms }, setSpeed: (value: number) => { speed.value = value }, setMotion: (value: Motion) => { motion.value = value }, plan: () => animation.value.vfx }
  if (query.get('auto') === '1') window.setTimeout(again, 900)
})
</script>

<template>
  <div class="lab">
    <aside v-if="showPanel" class="lab-panel" aria-label="Лаборатория эффектов">
      <h1>Эффекты боя</h1>
      <div class="lab-controls">
        <button type="button" class="primary" @click="again">▶ Играть снова</button>
        <button type="button" @click="reset()">⟲ Сброс</button>
        <label>Скорость <select v-model.number="speed"><option :value="1">1×</option><option :value="0.5">0,5×</option><option :value="0.25">0,25×</option><option :value="0.1">0,1×</option></select></label>
        <label>Режим <select v-model="motion"><option value="full">Полный</option><option value="reduced">Reduced motion</option></select></label>
        <label><input v-model="loop" type="checkbox" /> Повторять</label>
        <label>Кадр <input type="range" min="0" max="1400" step="10" :value="hold ?? 1400" @input="hold = Number(($event.target as HTMLInputElement).value) >= 1400 ? null : Number(($event.target as HTMLInputElement).value)" /> {{ hold === null ? 'живой' : hold + ' мс' }}</label>
      </div>
      <p class="lab-summary">{{ summary }}</p>
      <section v-for="group in groups" :key="group.id">
        <h2>{{ group.title }}</h2>
        <button v-for="item in vfxScenarios.filter(entry => entry.group === group.id)" :key="item.id" type="button" class="scene" :class="{ on: item.id === current.id }" @click="choose(item)">{{ item.title }}</button>
      </section>
    </aside>
    <div class="lab-stage">
      <div class="app-shell">
        <div class="game-wrap">
          <BattleBoard :state="state" :animation="animation" :phase="phase" :fx-speed="speed" :fx-hold="hold" @impact="impact" @end-turn="() => undefined" />
          <BattleHand :cards="views" :outgoing="pendingView" :outgoing-index="state.pending?.handIndex ?? 0" :draw-count="state.drawPile.length" :discard-count="state.discardPile.length" :exhausted-count="state.exhausted.length" :phase="phase" :mana="state.mana" :max-mana="state.maxMana" @play="() => undefined" @end-turn="() => undefined" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab{position:absolute;inset:0;display:flex;background:#0d1214}
.lab-panel{flex:0 0 300px;overflow:auto;padding:12px;background:#171d20;color:#e8e2d0;font:13px/1.35 var(--font-ui);border-right:1px solid #3a4448}
.lab-panel h1{margin:0 0 8px;font:700 18px var(--font-display);color:#ffd98a}
.lab-panel h2{margin:12px 0 4px;font:700 13px var(--font-display);color:#9fb6c2;text-transform:uppercase;letter-spacing:.06em}
.lab-controls{display:grid;gap:6px}
.lab-controls label{display:flex;gap:6px;align-items:center}
.lab-controls button,.scene{padding:6px 8px;border:1px solid #4a565b;border-radius:8px;background:#232c30;color:inherit;text-align:left;font:inherit;cursor:pointer}
.lab-controls .primary{background:#6a4a1c;border-color:#d9a23a;font-weight:700}
.scene{display:block;width:100%;margin-bottom:3px}
.scene.on{border-color:#ffd98a;background:#3a3220}
.lab-summary{margin:8px 0;padding:6px 8px;border-radius:8px;background:#0d1214;color:#9fb6c2;font-size:12px}
.lab-stage{position:relative;flex:1;min-width:0}
.lab-stage :deep(.app-shell){height:100%;min-width:0;min-height:0}
</style>
