<script setup lang="ts">
// UX/UI exploration prototype «Сцена приключения». Isolated from the shipping game: it imports the rules (read-only)
// and renders them with a new presentation layer. Open /ux-prototype.html (dev) — see docs/ux-ui-redesign-research.md.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useProtoBattle } from './useProtoBattle'
import { scenarioList } from './scenarios'
import type { ScenarioId } from './scenarios'
import { campaignRewardOptions } from '../game/campaign'
import { drawForTurn, manaForTurn } from '../game/economy'
import type { CardDefinition, HeroId } from '../game/types'
import StageBackdrop from './components/StageBackdrop.vue'
import HeroFrame from './components/HeroFrame.vue'
import EnemyFrame from './components/EnemyFrame.vue'
import IntentBanner from './components/IntentBanner.vue'
import ThreatRays from './components/ThreatRays.vue'
import HandFan from './components/HandFan.vue'
import ProtoCard from './components/ProtoCard.vue'
import ManaOrb from './components/ManaOrb.vue'
import EndTurnButton from './components/EndTurnButton.vue'
import GlyphIcon from './components/GlyphIcon.vue'
import ProtoReward from './components/ProtoReward.vue'
import ProtoMap from './components/ProtoMap.vue'
import ProtoResult from './components/ProtoResult.vue'

type Screen = 'battle' | 'reward' | 'map'
type Phase = 'player' | 'card' | 'enemy' | 'finished'

const query = new URLSearchParams(window.location.search)
const initialScenario = (scenarioList.find(s => s.id === query.get('s'))?.id ?? 'normal') as ScenarioId
const battle = useProtoBattle(initialScenario)
const { state, hand, forecast } = battle

const screen = ref<Screen>((query.get('screen') as Screen) || 'battle')
const phase = ref<Phase>('player')
const busy = ref(false)
const scenario = ref<ScenarioId>(initialScenario)
const showPanel = ref(query.get('ui') !== '0')
const panelOpen = ref(query.get('panel') === '1')
const reduce = ref(query.get('reduce') === '1')
const fast = ref(false)
const pin = query.get('hover') !== null ? Number(query.get('hover')) : undefined
const inspected = ref<(typeof hand.value)[number] | null>(null)
const stage = ref<HTMLElement | null>(null)
const rayTick = ref(0)
const announce = reactive({ key: 0, text: '', tone: 'player' })
const hits = reactive<{ enemy: boolean; warrior: boolean; mage: boolean }>({ enemy: false, warrior: false, mage: false })
const guard = reactive<{ warrior: boolean; mage: boolean }>({ warrior: false, mage: false })
const floaters = ref<{ id: number; x: number; y: number; text: string; tone: string; icon?: string }[]>([])
const bursts = ref<{ id: number; x: number; y: number; tone: string }[]>([])
const flyer = ref<null | { view: (typeof hand.value)[number]; x: number; y: number; scale: number; tx: number; ty: number; go: boolean }>(null)
let uid = 0

const heroNames = computed(() => ({ warrior: state.value.heroes.warrior.name, mage: state.value.heroes.mage.name }))
const handViews = computed(() => hand.value.map(v => phase.value !== 'player' && !v.reason ? { ...v, reason: 'busy' as const } : v))
const anyPlayable = computed(() => hand.value.some(v => !v.reason))
const ghost = computed(() => inspected.value && inspected.value.preview.healthDamage > 0 && !inspected.value.reason ? inspected.value.preview.healthDamage : 0)
const incomingFor = (id: HeroId) => state.value.result ? undefined : forecast.value.targets.find(t => t.target === id) ?? forecast.value.futureTargets.find(t => t.target === id)
const armorPreview = (id: HeroId) => inspected.value && !inspected.value.reason ? inspected.value.preview.armor[id] : 0
const later = computed(() => !forecast.value.targets.length && forecast.value.futureTargets.length > 0)
const threatened = computed(() => state.value.result ? [] : forecast.value.threatened)
const endState = computed<'ready' | 'urgent' | 'busy'>(() => phase.value !== 'player' ? 'busy' : anyPlayable.value ? 'ready' : 'urgent')
const endLabel = computed(() => phase.value === 'enemy' ? 'Ход врага' : phase.value === 'card' ? 'Разыгрывается…' : 'Завершить ход')
const endSub = computed(() => phase.value !== 'player' ? 'подождите' : anyPlayable.value ? `далее: ${forecast.value.action.name}` : 'ходов не осталось')
const encounterPips = [0, 1, 2]
const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, reduce.value ? Math.min(ms, 60) : fast.value ? ms * 0.5 : ms))
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

function centerOf(selector: string) {
  const root = stage.value!.getBoundingClientRect()
  const r = stage.value!.querySelector(selector)?.getBoundingClientRect()
  return r ? { x: r.left - root.left + r.width / 2, y: r.top - root.top + r.height / 2 } : { x: root.width / 2, y: root.height / 2 }
}
function say(text: string, tone: 'player' | 'enemy' | 'win' | 'lose' = 'player') { announce.key++; announce.text = text; announce.tone = tone }
function float(at: { x: number; y: number }, text: string, tone: string, dy = 0) {
  const item = { id: ++uid, x: at.x, y: at.y + dy, text, tone }
  floaters.value = [...floaters.value, item]
  window.setTimeout(() => { floaters.value = floaters.value.filter(f => f.id !== item.id) }, 1500)
}
function burst(at: { x: number; y: number }, tone: string) {
  const item = { id: ++uid, ...at, tone }
  bursts.value = [...bursts.value, item]
  window.setTimeout(() => { bursts.value = bursts.value.filter(b => b.id !== item.id) }, 700)
}
function flash(target: 'enemy' | HeroId) { hits[target] = true; window.setTimeout(() => { hits[target] = false }, 450) }

async function playCard(id: string) {
  if (busy.value || state.value.result || screen.value !== 'battle') return
  const view = hand.value.find(v => v.instanceId === id)
  if (!view || view.reason) return
  const el = document.getElementById('pcard-' + id)
  const rect = el?.getBoundingClientRect()
  const base = stage.value!.getBoundingClientRect()
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const pending = battle.begin(id)
  if (!pending) return
  busy.value = true
  phase.value = 'card'
  inspected.value = null
  const card = view.card
  const preview = pending.preview
  const toEnemy = card.kind !== 'defense'
  const focus = state.value.enemy.focus
  const targetSel = toEnemy ? '[data-anchor="enemy"]' : `[data-anchor="hero-${focus}"]`
  const target = centerOf(targetSel)
  if (rect) {
    const scale = rect.width / (11.6 * rem)
    flyer.value = { view, x: rect.left - base.left, y: rect.top - base.top, scale, tx: target.x - 5.8 * rem, ty: target.y - 8.5 * rem, go: false }
    await frame()
    if (flyer.value) flyer.value.go = true
  }
  await sleep(340)
  const result = battle.resolve(pending.actionId)
  flyer.value = null
  const tone = card.className === 'mage' ? 'arcane' : 'steel'
  if (toEnemy && preview.damage > 0) {
    burst(target, tone); flash('enemy')
    if (preview.healthDamage > 0) float(target, '−' + preview.healthDamage, 'dmg', -10)
    if (preview.armorDamage > 0) float(target, '−' + preview.armorDamage + ' брони', 'armor-hit', 46)
    if (preview.vulnerabilityBonus > 0) float(target, 'Уязвимость снята · +' + preview.vulnerabilityBonus, 'bonus', -64)
  }
  if (preview.appliedStatuses.includes('vulnerability') && state.value.enemy.vulnerable) float(centerOf('[data-anchor="enemy"]'), 'Уязвим!', 'vuln', -110)
  if (!toEnemy || card.effects.some(e => e.type === 'armor')) {
    for (const hero of ['warrior', 'mage'] as HeroId[]) {
      if (preview.armor[hero] > 0) { const at = centerOf(`[data-anchor="hero-${hero}"]`); burst(at, 'guard'); float(at, '+' + preview.armor[hero] + ' брони', 'guard', 20); guard[hero] = true; window.setTimeout(() => { guard[hero] = false }, 900) }
    }
  }
  if (result?.drawn) float(centerOf('.dock-hand'), '+' + result.drawn + ' карта', 'bonus', -120)
  rayTick.value++
  await sleep(420)
  if (state.value.result) finishBattle()
  else phase.value = 'player'
  busy.value = false
}

async function endTurn() {
  if (busy.value || state.value.result || screen.value !== 'battle') return
  busy.value = true
  inspected.value = null
  phase.value = 'enemy'
  say('Ход противника', 'enemy')
  await sleep(400)
  const executed = forecast.value
  const action = executed.action
  if (executed.targets.length) {
    for (const hit of executed.targets) {
      const at = centerOf(`[data-anchor="hero-${hit.target}"]`)
      burst(at, 'hit'); flash(hit.target)
      float(at, hit.healthLoss > 0 ? '−' + hit.healthLoss : 'блок', hit.healthLoss > 0 ? 'dmg-taken' : 'armor-hit', -20)
      if (hit.absorbed) float(at, '−' + hit.absorbed + ' брони', 'armor-hit', 40)
    }
  } else if (action.kind === 'defend' || action.kind === 'recover') {
    float(centerOf('[data-anchor="enemy"]'), '+' + executed.armorGain + ' брони врага', 'armor-hit', 30)
  }
  await sleep(500)
  battle.finish()
  rayTick.value++
  if (state.value.result) { finishBattle(); busy.value = false; return }
  say('Ваш ход · ' + state.value.turn)
  phase.value = 'player'
  busy.value = false
}

function finishBattle() {
  phase.value = 'finished'
  say(state.value.result === 'victory' ? 'Победа!' : 'Поражение', state.value.result === 'victory' ? 'win' : 'lose')
}

function resetTo(id: ScenarioId) {
  scenario.value = id
  battle.load(id)
  screen.value = 'battle'
  phase.value = 'player'
  busy.value = false
  inspected.value = null
  flyer.value = null
  rayTick.value++
}
function showResult(kind: 'victory' | 'defeat') { screen.value = 'battle'; battle.forceResult(kind); finishBattle() }
const rewardCards = computed<CardDefinition[]>(() => campaignRewardOptions(state.value))

function onKey(event: KeyboardEvent) {
  if (screen.value !== 'battle' || phase.value !== 'player' || event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); void endTurn(); return }
  if (/^[0-9]$/.test(event.key)) {
    const index = event.key === '0' ? 9 : Number(event.key) - 1
    const view = handViews.value[index]
    if (view) void playCard(view.instanceId)
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (query.get('screen') === 'victory') void nextTick(() => showResult('victory'))
  if (query.get('screen') === 'defeat') void nextTick(() => showResult('defeat'))
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div ref="stage" class="stage" :class="{ 'reduce-motion': reduce, 'is-enemy-phase': phase === 'enemy' }">
    <StageBackdrop :dim="screen === 'battle' ? 0 : 0.28" />

    <template v-if="screen === 'battle'">
      <header class="topbar">
        <div class="where">
          <GlyphIcon name="crown" class="where-icon" />
          <span class="where-copy"><strong>Сумеречная чаща</strong><small>Бой 1 из 3</small></span>
          <span class="where-pips"><i v-for="n in encounterPips" :key="n" :class="{ on: n === 0 }"></i></span>
        </div>
        <div class="ribbon" :class="'ribbon--' + (phase === 'enemy' ? 'enemy' : phase === 'finished' ? 'done' : 'player')" role="status" aria-live="polite">
          <span class="ribbon-turn">Ход {{ state.turn }}</span>
          <strong>{{ phase === 'enemy' ? 'Ход противника' : phase === 'finished' ? 'Бой завершён' : phase === 'card' ? 'Способность отряда' : 'Ваш ход' }}</strong>
        </div>
        <button class="help" aria-label="Как играть"><GlyphIcon name="help" /> <span>Как играть</span></button>
      </header>

      <main class="arena" data-battle-scene>
        <div class="col col--left"><HeroFrame :hero="state.heroes.warrior" :incoming="incomingFor('warrior')" :armor-preview="armorPreview('warrior')" :later="later" :hit="hits.warrior" :guarded="guard.warrior" /></div>
        <div class="col col--center">
          <EnemyFrame :enemy="state.enemy" :vulnerable="state.enemy.vulnerable" :ghost="ghost" :hit="hits.enemy" :acting="phase === 'enemy'" />
          <IntentBanner :forecast="forecast" :names="heroNames" :executing="phase === 'enemy'" />
        </div>
        <div class="col col--right"><HeroFrame :hero="state.heroes.mage" :incoming="incomingFor('mage')" :armor-preview="armorPreview('mage')" :later="later" :hit="hits.mage" :guarded="guard.mage" /></div>
      </main>

      <ThreatRays :targets="threatened" :later="later" :tick="rayTick" />

      <div class="fx-layer" aria-hidden="true">
        <span v-for="b in bursts" :key="b.id" class="burst" :class="'burst--' + b.tone" :style="{ left: b.x + 'px', top: b.y + 'px' }"></span>
        <span v-for="f in floaters" :key="f.id" class="floater" :class="'floater--' + f.tone" :style="{ left: f.x + 'px', top: f.y + 'px' }">{{ f.text }}</span>
        <div v-if="flyer" class="flyer" :class="{ go: flyer.go }" :style="{ left: flyer.x + 'px', top: flyer.y + 'px', '--s0': flyer.scale, '--dx': flyer.tx - flyer.x + 'px', '--dy': flyer.ty - flyer.y + 'px' }">
          <ProtoCard :card="flyer.view.card" :preview="flyer.view.preview" :reason="null" :tabbable="false" />
        </div>
      </div>

      <footer class="dock">
        <aside class="dock-left">
          <ManaOrb :mana="state.mana" :max="state.maxMana" :next-max="manaForTurn(state.economy, state.turn + 1)" />
          <div class="piles">
            <span class="pile" :title="'Колода: добор ' + drawForTurn(state.economy, state.turn + 1) + ' карты в начале хода. Максимум руки — 10.'"><GlyphIcon name="deck" /><b>{{ state.drawPile.length }}</b><small>колода</small></span>
            <span class="pile" title="Сброс"><GlyphIcon name="discard" /><b>{{ state.discardPile.length }}</b><small>сброс</small></span>
          </div>
        </aside>
        <div class="dock-hand">
          <HandFan :cards="handViews" :mana="state.mana" :locked="phase !== 'player'" :pin="pin" @play="playCard" @inspect="inspected = $event" />
          <p class="hand-count" :class="{ full: hand.length >= 10 }">{{ hand.length }} / 10 карт · клавиши 1–9, 0</p>
        </div>
        <aside class="dock-right">
          <EndTurnButton :state="endState" :label="endLabel" :sub="endSub" @press="endTurn" />
          <p class="dock-note">После конца хода враг выполнит объявленное действие. Несыгранные карты остаются в руке.</p>
        </aside>
      </footer>

      <div v-if="announce.key" :key="announce.key" class="announce" :class="'announce--' + announce.tone" aria-hidden="true"><span>{{ announce.text }}</span></div>
      <ProtoResult v-if="state.result" :result="state.result" @next="screen = 'reward'" @again="resetTo(scenario)" />
    </template>

    <ProtoReward v-else-if="screen === 'reward'" :options="rewardCards" @pick="screen = 'map'" />
    <ProtoMap v-else-if="screen === 'map'" @enter="resetTo('normal')" />

    <aside v-if="showPanel" class="proto-panel" :class="{ open: panelOpen }">
      <button class="proto-toggle" :aria-expanded="panelOpen" @click="panelOpen = !panelOpen">Прототип «Сцена приключения» {{ panelOpen ? '▾' : '▸' }}</button>
      <div v-if="panelOpen" class="proto-body">
        <p class="proto-title">Бой (движок v0.8, без правки правил)</p>
        <button v-for="s in scenarioList" :key="s.id" class="proto-btn" :class="{ on: screen === 'battle' && scenario === s.id }" @click="resetTo(s.id)"><b>{{ s.label }}</b><small>{{ s.hint }}</small></button>
        <p class="proto-title">Другие экраны</p>
        <button class="proto-btn" @click="showResult('victory')"><b>Победа</b></button>
        <button class="proto-btn" @click="showResult('defeat')"><b>Поражение</b></button>
        <button class="proto-btn" @click="screen = 'reward'"><b>Награда</b></button>
        <button class="proto-btn" @click="screen = 'map'"><b>Карта «Штреки» (схема)</b></button>
        <p class="proto-title">Параметры</p>
        <label class="proto-check"><input v-model="reduce" type="checkbox" /> Уменьшить анимации</label>
        <label class="proto-check"><input v-model="fast" type="checkbox" /> Быстрый режим (×2)</label>
        <p class="proto-tip">Наведите на карту — увеличение и «свиток». Клик или 1–9, 0 — розыгрыш, Enter — конец хода.</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.stage{--hero-w:17rem;--hero-h:21.2rem;--medal-d:19rem;--dock-h:19.4rem;position:absolute;inset:0;overflow:hidden;background:#10231f;font-family:var(--f-ui);user-select:none}
/* top bar */
.topbar{position:absolute;z-index:8;left:0;right:0;top:0;height:5rem;display:flex;align-items:flex-start;justify-content:space-between;padding:1rem 2rem 0;background:linear-gradient(#0c1713cc,#0000)}
.where{display:flex;align-items:center;gap:.7rem;padding:.45rem 1.1rem .45rem .7rem;border-radius:2rem;background:linear-gradient(#2a1d13ee,#1a110bee);border:.14rem solid var(--brass-3);box-shadow:0 .35rem .8rem #0009}
.where-icon{width:1.7rem;height:1.7rem;color:var(--brass-1)}
.where-copy{display:flex;flex-direction:column;line-height:1.15}
.where-copy strong{font:800 1.15rem var(--f-display);color:#fff0c8}
.where-copy small{font:700 .7rem var(--f-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)}
.where-pips{display:flex;gap:.3rem;margin-left:.4rem}
.where-pips i{width:.7rem;height:.7rem;border-radius:50%;border:.1rem solid var(--brass-2);background:#0006}
.where-pips i.on{background:var(--brass-1);box-shadow:0 0 .5rem var(--brass-1)}
.ribbon{position:absolute;left:50%;top:.6rem;translate:-50% 0;display:flex;align-items:center;gap:1rem;padding:.55rem 3rem;clip-path:polygon(1.2rem 0,calc(100% - 1.2rem) 0,100% 50%,calc(100% - 1.2rem) 100%,1.2rem 100%,0 50%);filter:drop-shadow(0 .3rem .5rem #000a)}
.ribbon::before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(#3a2a52,#1f1532);box-shadow:inset 0 0 0 .18rem #e8c978}
.ribbon{background:none}
.ribbon--player::before{background:linear-gradient(#24507c,#152c4d)}
.ribbon--enemy::before{background:linear-gradient(#7a2412,#3d0f0a)}
.ribbon--done::before{background:linear-gradient(#5a4a1a,#2c2308)}
.ribbon-turn{font:800 .78rem var(--f-ui);letter-spacing:.2em;text-transform:uppercase;color:#ffe3a0}
.ribbon strong{font:800 1.45rem var(--f-display);color:#fff3d6;text-shadow:0 .1rem .2rem #000a;white-space:nowrap}
.help{display:flex;align-items:center;gap:.5rem;margin-top:.3rem;padding:.4rem .9rem .4rem .6rem;border-radius:2rem;background:linear-gradient(#2a1d13ee,#1a110bee);border:.14rem solid var(--brass-3);color:#f0dfb4;font:700 .9rem var(--f-ui);margin-right:0}
.help svg{width:1.4rem;height:1.4rem;color:var(--brass-1)}
/* arena */
.arena{position:absolute;z-index:3;left:0;right:0;top:4.4rem;bottom:var(--dock-h);display:grid;grid-template-columns:1fr 36rem 1fr;align-items:end;padding:0 2rem}
.col{display:flex;flex-direction:column;align-items:center;min-width:0}
.col--center{align-self:start;gap:1rem;padding-top:.6rem}
.col--left,.col--right{align-self:end;padding-bottom:.4rem}
.col--left{justify-self:center}.col--right{justify-self:center}
/* dock */
.dock{position:absolute;z-index:6;left:0;right:0;bottom:0;height:var(--dock-h);display:grid;grid-template-columns:13rem minmax(0,1fr) 16.5rem;align-items:end;gap:.6rem;padding:0 1.2rem .6rem;background:linear-gradient(#0000,#0f0804cc 34%,#0a0502f2);pointer-events:none}
.dock>*{position:relative;z-index:1;pointer-events:auto}
.dock::before{content:'';position:absolute;left:0;right:0;bottom:0;height:calc(var(--dock-h) - 3.4rem);background:repeating-linear-gradient(90deg,#ffffff06 0 .15rem,#0000 .15rem .7rem),linear-gradient(#2a1a0f00,#2a1a0f);border-top:.14rem solid #d2a24f55;box-shadow:0 -.1rem 1.6rem #000a;pointer-events:none;z-index:0}
.dock-left{position:relative;display:flex;flex-direction:column;align-items:center;gap:.5rem;align-self:end;padding-bottom:.2rem}
.piles{display:flex;gap:.6rem}
.pile{display:flex;align-items:center;gap:.35rem;padding:.25rem .65rem .25rem .45rem;border-radius:1.2rem;background:#0008;border:.1rem solid #d2a24f66;color:#e9dcc0}
.pile svg{width:1.2rem;height:1.2rem;color:var(--brass-2)}
.pile b{font:800 1.15rem var(--f-num);color:#fff}
.pile small{font:700 .66rem var(--f-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)}
.dock-hand{position:relative;height:100%;min-width:0}
.dock-hand :deep(.hand){position:absolute;inset:auto 0 .9rem 0;height:17.8rem}
.hand-count{position:absolute;left:50%;top:-.1rem;translate:-50% 0;margin:0;padding:.2rem .9rem;border-radius:1rem;background:#0007;font:700 .78rem var(--f-ui);letter-spacing:.06em;color:#e6d6b2;white-space:nowrap;pointer-events:none}
.hand-count.full{color:var(--bonus)}
.dock-right{display:flex;flex-direction:column;align-items:center;gap:.7rem;align-self:end;padding-bottom:.4rem}
.dock-note{margin:0;max-width:15rem;font:600 .78rem/1.35 var(--f-ui);text-align:center;color:#d9c9a6;text-shadow:0 .1rem .2rem #000}
/* fx */
.fx-layer{position:absolute;inset:0;z-index:20;pointer-events:none;overflow:hidden}
.flyer{position:absolute;transform-origin:0 0;transform:scale(var(--s0,1));transition:transform .34s cubic-bezier(.45,.05,.55,.95),opacity .34s;z-index:3}
.flyer.go{transform:translate(var(--dx),var(--dy)) scale(.42) rotate(14deg);opacity:.9}
.burst{position:absolute;width:3rem;height:3rem;translate:-50% -50%;border-radius:50%;animation:burst .6s ease-out forwards;mix-blend-mode:screen}
.burst--steel{background:radial-gradient(circle,#fff 0 12%,#ffd9a0 24%,#ff9a4d99 45%,#0000 70%)}
.burst--arcane{background:radial-gradient(circle,#fff 0 12%,#9ee9ff 26%,#8c6bff99 48%,#0000 72%)}
.burst--guard{background:radial-gradient(circle,#fff6 0 20%,#bfe0ff88 40%,#0000 70%)}
.burst--hit{background:radial-gradient(circle,#fff 0 10%,#ff8a5c 28%,#e2362299 50%,#0000 72%)}
@keyframes burst{from{scale:.3;opacity:1}to{scale:5.5;opacity:0}}
.floater{position:absolute;translate:-50% -50%;font:800 3rem/1 var(--f-num);color:#fff;text-shadow:0 .15rem 0 #000,0 0 .8rem #000,0 0 1.4rem currentColor;white-space:nowrap;animation:floatup 1.3s ease-out forwards}
.floater--dmg{color:#ffd9a0;font-size:4.2rem}
.floater--dmg-taken{color:#ff8e72;font-size:3.6rem}
.floater--armor-hit{color:#bfd8f2;font-size:1.5rem}
.floater--bonus{color:var(--bonus);font-size:1.5rem;font-family:var(--f-ui)}
.floater--vuln{color:var(--vuln);font-size:2rem;font-family:var(--f-display)}
.floater--guard{color:#bfe0ff;font-size:2.4rem}
@keyframes floatup{0%{opacity:0;transform:translateY(1rem) scale(.6)}15%{opacity:1;transform:translateY(0) scale(1.15)}70%{opacity:1}100%{opacity:0;transform:translateY(-3.5rem) scale(1)}}
.announce{position:absolute;z-index:18;left:0;right:0;top:58%;display:grid;place-items:center;pointer-events:none;animation:announce 1.25s ease-out forwards}
.announce span{padding:1rem 7rem;font:800 4.2rem/1.1 var(--f-display);color:#fff3d6;text-shadow:0 .2rem .4rem #000c;background:linear-gradient(90deg,#0000,#1b2f4acc 22%,#1b2f4acc 78%,#0000);letter-spacing:.02em}
.announce--enemy span{background:linear-gradient(90deg,#0000,#5a160acc 22%,#5a160acc 78%,#0000);color:#ffd2bd}
.announce--win span{background:linear-gradient(90deg,#0000,#6b4a0acc 22%,#6b4a0acc 78%,#0000);color:#ffe9a8}
@keyframes announce{0%{opacity:0;transform:translateX(-6rem)}18%{opacity:1;transform:none}72%{opacity:1}100%{opacity:0;transform:translateX(6rem)}}
/* prototype control panel (hidden with ?ui=0) */
.proto-panel{position:absolute;z-index:60;right:1rem;top:5.3rem;width:17rem;font:600 .8rem var(--f-ui);color:#fff}
.proto-toggle{width:100%;padding:.45rem .8rem;border:.1rem solid #ffffff44;border-radius:.6rem;background:#0b1a24e6;text-align:left;font:700 .78rem var(--f-ui);color:#cfe8ff}
.proto-body{display:flex;flex-direction:column;gap:.3rem;margin-top:.3rem;padding:.6rem;border-radius:.6rem;background:#0b1a24f2;border:.1rem solid #ffffff33;max-height:70vh;overflow:auto}
.proto-title{margin:.4rem 0 .1rem;font:800 .66rem var(--f-ui);letter-spacing:.14em;text-transform:uppercase;color:#7fb4d8}
.proto-btn{display:flex;flex-direction:column;align-items:flex-start;padding:.35rem .6rem;border:.1rem solid #ffffff22;border-radius:.4rem;background:#13293a;text-align:left}
.proto-btn.on{border-color:var(--brass-1);background:#27405a}
.proto-btn b{font:700 .8rem var(--f-ui)}.proto-btn small{font:500 .68rem var(--f-ui);color:#9fc0d8}
.proto-check{display:flex;align-items:center;gap:.4rem;font:600 .78rem var(--f-ui)}
.proto-tip{margin:.4rem 0 0;font:500 .7rem/1.35 var(--f-ui);color:#9fc0d8}
/* compact desktop (≤ ~720p): smaller combatants, tucked hand */
@media (max-height:820px){
  .stage{--hero-w:12.8rem;--hero-h:16rem;--medal-d:14.4rem;--dock-h:17.2rem;--card-scale:.95}
  .topbar{height:4.2rem;padding:.7rem 1.4rem 0}
  .arena{top:3.8rem}
  .ribbon strong{font-size:1.2rem}
  .col--center{gap:.6rem}
  .dock{grid-template-columns:10.6rem minmax(0,1fr) 13.6rem}
  .dock-hand :deep(.hand){--tuck:2.6rem}
  .dock-note{display:none}
  .pile small{display:none}
  .piles{gap:.3rem}
  .where-pips{display:none}
}
</style>
