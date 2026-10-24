<script setup lang="ts">
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { Anvil, Check, Crown, Flag, Flame, Gem, Lamp, ScrollText, Skull, Swords } from '@lucide/vue'
import DeckViewer from './DeckViewer.vue'
import { availableDungeonNodes } from '../game/campaign'
import type { DungeonMap, DungeonMapNode, DungeonRunState } from '../game/campaign'

const props = defineProps<{ map: DungeonMap; run: DungeonRunState }>()
const emit = defineEmits<{ enter: [nodeId: string]; mode: [] }>()
const columns = computed(() => props.map.configuration?.columns ?? 3)
const rows = computed(() => props.map.layers.length)
/** Maps of nine or ten rows (the long route) use compact rooms and scroll to the party; the six- and seven-row maps keep the original layout exactly. */
const dense = computed(() => rows.value > 8)
const viewport = useTemplateRef<HTMLElement>('viewport')
const nodes = computed(() => props.map.layers.flat())
const available = computed(() => new Set(availableDungeonNodes(props.run).map(node => node.id)))
const visited = computed(() => new Set(props.run.visitedNodeIds))
const current = computed(() => props.run.visitedNodeIds[props.run.visitedNodeIds.length - 1])
const edges = computed(() => props.map.layers.flatMap(layer => layer.flatMap(node => node.edges.map(targetId => ({
  id: `${node.id}:${targetId}`,
  path: edgePath(node, nodes.value.find(target => target.id === targetId)!),
  complete: visited.value.has(node.id) && visited.value.has(targetId),
  next: node.id === current.value && available.value.has(targetId),
})))))
const progress = computed(() => Array.from({ length: rows.value }, (_, index) => index < props.run.completedNodeIds.length))

function position(node: DungeonMapNode) {
  return { x: ((node.column + 0.5) / columns.value) * 1000, y: dense.value ? 940 - node.layer * (880 / (rows.value-1)) : 900 - node.layer * (800 / (rows.value-1)) }
}

function edgePath(from: DungeonMapNode, to: DungeonMapNode) {
  const a = position(from)
  const b = position(to)
  const bend = Math.min(48, Math.abs(b.x - a.x) * 0.16)
  return `M ${a.x} ${a.y} C ${a.x + (b.x > a.x ? bend : -bend)} ${(a.y + b.y) / 2}, ${b.x - (b.x > a.x ? bend : -bend)} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`
}

function nodeStyle(node: DungeonMapNode) {
  const p = position(node)
  return { left: `${p.x/10}%`, top: `${p.y/10}%`, width: `${(dense.value ? 66 : 86)/columns.value}%` }
}

function categoryIcon(node: DungeonMapNode) {
  if (node.type === 'rest') return Flame
  if (node.type === 'elite') return Crown
  if (node.type === 'final') return Skull
  if (node.type === 'forge') return Anvil
  if (node.type === 'treasure') return Gem
  if (node.type === 'event') return ScrollText
  return Swords
}

function categoryLabel(node: DungeonMapNode) {
  if (node.type === 'rest') return 'Привал'
  if (node.type === 'elite') return 'Элитный бой'
  if (node.type === 'final') return 'Босс'
  if (node.type === 'forge') return 'Кузница'
  if (node.type === 'treasure') return 'Сокровищница'
  if (node.type === 'event') return 'Событие'
  return 'Обычный бой'
}

/** Brings the rooms the party can enter next to the middle of the scrolled map (the start is at the bottom, the boss at the top). */
function centreOnParty() {
  void nextTick(() => viewport.value?.querySelector<HTMLElement>('.is-available, .is-current')?.scrollIntoView({ block: 'nearest', behavior: 'auto' }))
}
onMounted(centreOnParty)
watch(current, centreOnParty)

function layerLabel(node: DungeonMapNode) {
  return node.type === 'final' ? 'ФИНАЛ' : `ШТРЕК ${node.layer + 1}`
}

function ariaLabel(node: DungeonMapNode) {
  const state = visited.value.has(node.id) ? 'пройдено' : available.value.has(node.id) ? 'доступно' : 'закрыто'
  return `${layerLabel(node)}. ${categoryLabel(node)}. ${state}.`
}
</script>

<template>
  <main class="campaign-screen">
    <header class="campaign-header">
      <div class="campaign-topline"><Lamp :size="22" aria-hidden="true"/><span>{{ map.configuration ? 'СЕКТОР I · '+map.configuration.name.toUpperCase() : 'КОНТРОЛЬНЫЙ ПОХОД · 7 ПОСЕЩЕНИЙ' }}</span><span class="seed-chip">ЗЕРНО {{ run.seed }}</span><button class="game-button new-run" @click="emit('mode')">Выбор похода</button><DeckViewer :deck="run.deck" /></div>
      <h1>Выберите штрек</h1>
      <p>{{ run.campaign ? 'Следуйте освещённым рельсам. Кузница развивает колоду, привал лечит или улучшает карту. Элита — добровольный риск.' : 'Следуйте рельсам. Привал лечит или улучшает карту, а элита предлагает больше карт на выбор.' }}</p>
      <p v-if="run.journal?.length" class="last-decision" role="status">{{ run.journal[run.journal.length-1]?.text }}</p>
    </header>

    <section ref="viewport" class="map-viewport" :class="{ 'is-dense': dense }" aria-label="Карта подземелья">
      <div class="dungeon-graph" :style="{ '--rows': rows }">
        <div class="mine-post mine-post--left" aria-hidden="true"><i></i></div>
        <div class="mine-post mine-post--right" aria-hidden="true"><i></i></div>
        <div class="lamp-hang lamp-hang--left" aria-hidden="true"><i></i></div>
        <div class="lamp-hang lamp-hang--right" aria-hidden="true"><i></i></div>
        <svg class="route-edges" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <g v-for="edge in edges" :key="edge.id" :class="{ 'is-travelled': edge.complete, 'is-next': edge.next }">
            <path class="rail-bed" :d="edge.path" /><path class="rail-steel" :d="edge.path" /><path class="rail-ties" :d="edge.path" />
          </g>
        </svg>
        <button
          v-for="node in nodes"
          :key="node.id"
          class="map-node"
          :class="[`map-node--${node.type}`, { 'is-available': available.has(node.id), 'is-visited': visited.has(node.id), 'is-current': node.id === current, 'is-locked': !available.has(node.id) && !visited.has(node.id) }]"
          :style="nodeStyle(node)"
          :disabled="!available.has(node.id)"
          :aria-label="ariaLabel(node)"
          @click="emit('enter', node.id)"
        >
          <span class="node-medal"><component :is="categoryIcon(node)" class="node-glyph" aria-hidden="true" :stroke-width="2.2" /></span>
          <span class="node-content">
            <small>{{ dense && node.id === current ? 'ОТРЯД ЗДЕСЬ' : layerLabel(node) }}</small>
            <strong>{{ categoryLabel(node) }}</strong>
          </span>
          <span v-if="visited.has(node.id)" class="node-check" aria-hidden="true"><Check :size="14" :stroke-width="3.4" /></span>
          <span v-if="node.id === current && !dense" class="node-flag" aria-hidden="true"><Flag :size="12" :stroke-width="2.6" />Отряд здесь</span>
        </button>
      </div>
    </section>

    <footer class="party-status">
      <div class="party-hero"><span class="hero-medallion hero-medallion--warrior">⚔</span><span><small>ВАРИАН РИНН</small><strong>{{ run.heroes.warrior.health }} / {{ run.heroes.warrior.maxHealth }} HP</strong></span></div>
      <span class="party-divider" aria-hidden="true">✦</span>
      <div class="party-hero"><span class="hero-medallion hero-medallion--mage">✦</span><span><small>ДЖАЙНА ПРАУДМУР</small><strong>{{ run.heroes.mage.health }} / {{ run.heroes.mage.maxHealth }} HP</strong></span></div>
      <span class="route-progress"><span class="progress-pips" aria-hidden="true"><i v-for="(done, index) in progress" :key="index" :class="{ done }"></i></span>{{ run.completedNodeIds.length }}/{{ rows }} ПОСЕЩЕНИЙ · {{ run.deck.length }} КАРТ В КОЛОДЕ</span>
    </footer>
  </main>
</template>

<style scoped>
.campaign-screen{position:absolute;z-index:8;inset:0;display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);overflow:auto;padding:var(--sp-3) clamp(18px,4vw,64px);background:radial-gradient(ellipse at 50% 42%,#f0a64a30,#0000 52%),var(--mat-mine-map);color:var(--ink)}
.campaign-screen::before{position:absolute;inset:0;content:"";pointer-events:none;background:repeating-linear-gradient(95deg,#0000 0 46px,#0000000d 46px 48px),radial-gradient(ellipse at 50% 50%,#0000 52%,#000a 100%)}
.campaign-screen::after{position:absolute;inset:var(--sp-2);content:"";pointer-events:none;border:var(--border-panel);border-radius:var(--shape-dialog);box-shadow:var(--shadow-4)}
.campaign-header,.map-viewport,.party-status{position:relative;z-index:1}
.campaign-header{width:min(1120px,100%);text-align:center;flex:0 0 auto}
.campaign-topline{display:flex;align-items:center;justify-content:center;gap:var(--sp-3);color:var(--brass-1);font:700 var(--fs-xs) var(--font-display);letter-spacing:var(--ls-caps)}
.campaign-topline .game-button{font-size:var(--fs-xs);padding:var(--sp-2)}
.seed-chip{padding:var(--sp-2);border:var(--border-panel);border-radius:var(--shape-chip);font-family:var(--font-num)}
.campaign-header h1{margin:var(--sp-1) 0;color:var(--parch-1);font:700 clamp(26px,3vw,40px) var(--font-display);text-shadow:0 2px 0 #000a,0 0 22px #f0a64a55}
.campaign-header p{margin:0;color:var(--muted);font:600 var(--fs-sm) var(--font-ui)}
.campaign-header .last-decision{color:var(--brass-1);margin-top:var(--sp-1)}
.map-viewport{width:min(1120px,100%);min-height:390px;flex:1;margin:var(--sp-2) 0}
.dungeon-graph{position:relative;width:100%;height:100%;min-height:390px;isolation:isolate}
/* timber supports and hanging lamps frame the tunnel */
.mine-post{position:absolute;z-index:-1;top:-2%;bottom:3%;width:30px;border-radius:var(--r-2);background:linear-gradient(90deg,#2b1a0d,#6b4424 45%,#3a2412);box-shadow:inset 0 0 0 2px #1a0f08,var(--shadow-2);opacity:.8}
.mine-post--left{left:1.5%}.mine-post--right{right:1.5%}
.mine-post i{position:absolute;top:50%;width:64px;height:18px;border-radius:var(--r-1);background:linear-gradient(#6b4424,#3a2412);box-shadow:inset 0 0 0 2px #1a0f08}
.mine-post--left i{left:-4px;transform:rotate(-2deg)}.mine-post--right i{right:-4px;transform:rotate(2deg)}
.lamp-hang{position:absolute;z-index:0;top:-8px;width:2px;height:34px;background:#0009;pointer-events:none}
.lamp-hang--left{left:7%}.lamp-hang--right{right:7%}
.lamp-hang i{position:absolute;left:-9px;bottom:-16px;width:20px;height:22px;border-radius:7px;background:var(--c-bonus);box-shadow:0 0 0 3px #3a2a1c,0 0 34px 14px #ff9a2e66;animation:flicker 3.6s ease-in-out infinite}
@keyframes flicker{0%,100%{opacity:1}45%{opacity:.82}60%{opacity:.95}}
/* a route is a mine rail: bed, steel and sleepers */
.route-edges{position:absolute;z-index:-1;inset:0;width:100%;height:100%;overflow:visible}
.route-edges path{fill:none;stroke-linecap:round;vector-effect:non-scaling-stroke}
.rail-bed{stroke:#0b0806;stroke-width:12;opacity:.55}
.rail-steel{stroke:var(--brass-3);stroke-width:5;opacity:.6}
.rail-ties{stroke:var(--wood-3);stroke-width:14;stroke-dasharray:3 15;stroke-linecap:butt!important;opacity:.85}
.is-next .rail-steel{stroke:var(--brass-1);stroke-width:7;opacity:1;filter:drop-shadow(0 0 7px var(--c-bonus))}
.is-next .rail-ties{stroke:var(--brass-3)}
.is-travelled .rail-steel{stroke:var(--brass-2);stroke-width:7;opacity:1}
.is-travelled .rail-ties{stroke:var(--brass-4)}
.map-node{position:absolute;display:flex;align-items:center;justify-content:flex-start;gap:var(--sp-2);min-height:54px;padding:6px var(--sp-3) 6px 6px;border:var(--border-panel);border-radius:var(--shape-plank);background:var(--mat-wood);color:var(--ink);box-shadow:var(--shadow-2),inset 0 1px 0 #fff2;transform:translate(-50%,-50%);transition:filter var(--dur-base),transform var(--dur-base);cursor:default;--tone:var(--brass-2)}
.node-medal{display:grid;place-items:center;flex:0 0 40px;height:40px;border-radius:var(--r-pill);border:2px solid var(--tone);background:radial-gradient(circle at 35% 25%,#fff3,#0000 55%),var(--wood-0);box-shadow:inset 0 0 8px #000a}
.node-glyph{width:22px;height:22px;color:var(--tone)}
.node-content{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0}
.node-content small{color:var(--muted);font:700 9px var(--font-display);letter-spacing:var(--ls-caps)}
.node-content strong{font:800 clamp(12px,1vw,15px) var(--font-display);white-space:nowrap;color:var(--parch-1)}
.map-node--battle{--tone:var(--c-armor)}
.map-node--elite{--tone:var(--c-threat);background:linear-gradient(#5a2a1c,#2f130c);border-color:var(--c-threat-line)}
.map-node--event{--tone:var(--c-mana)}
.map-node--forge{--tone:var(--c-threat)}
.map-node--treasure{--tone:var(--c-bonus)}
.map-node--rest{--tone:var(--c-heal)}
.map-node--final{--tone:#d9a0ff;min-height:66px;background:linear-gradient(#4a2a58,#1f1030);border:2px solid var(--brass-2);box-shadow:0 0 28px #b36bff55,var(--shadow-3)}
.map-node--final .node-medal{flex-basis:50px;height:50px}.map-node--final .node-glyph{width:28px;height:28px}
.map-node--final .node-content strong{font-size:clamp(14px,1.3vw,19px)}
.map-node.is-available{border:var(--border-brass);box-shadow:0 0 0 2px #ffd56b66,var(--glow-bonus),var(--shadow-2);cursor:pointer;animation:lantern-pulse 2.4s ease-in-out infinite}
@keyframes lantern-pulse{50%{box-shadow:0 0 0 4px #ffd56b33,0 0 30px #ffd56b88,var(--shadow-2)}}
.map-node.is-available:hover,.map-node.is-available:focus-visible{z-index:3;outline:var(--focus-ring);outline-offset:var(--focus-offset);filter:brightness(1.18);transform:translate(-50%,-50%) scale(1.04);animation:none}
.map-node.is-visited{border-color:var(--brass-3);background:var(--mat-teal-panel);filter:saturate(.8)}
.map-node.is-visited .node-content strong{color:var(--muted)}
.map-node.is-current{border:var(--border-brass);filter:none;box-shadow:0 0 22px #ffd56b88,var(--shadow-2)}
.map-node.is-locked{filter:saturate(.45) brightness(.8);opacity:.7}
.node-check{position:absolute;top:-8px;right:-4px;display:grid;place-items:center;width:22px;height:22px;border-radius:var(--r-pill);background:var(--c-heal);color:var(--wood-0);box-shadow:var(--shadow-2)}
.node-flag{position:absolute;left:50%;bottom:calc(100% + 4px);translate:-50% 0;display:flex;align-items:center;gap:4px;padding:2px 10px;border-radius:var(--r-pill);background:var(--brass-1);color:var(--wood-1);font:800 10px var(--font-display);letter-spacing:var(--ls-caps);text-transform:uppercase;white-space:nowrap;box-shadow:var(--shadow-2)}
.party-status{display:flex;align-items:center;justify-content:center;gap:var(--sp-4);width:min(1120px,100%);flex:0 0 auto;padding:var(--sp-2) var(--sp-4);border:var(--border-panel);border-radius:var(--shape-banner);background:var(--mat-wood);box-shadow:var(--shadow-2)}
.party-hero{display:flex;align-items:center;gap:var(--sp-2)}.party-hero>span:last-child{display:grid;gap:2px}.party-hero small{color:var(--brass-1);font:700 10px var(--font-display)}.party-hero strong{font:700 var(--fs-sm) var(--font-num)}
.hero-medallion{display:grid;place-items:center;width:32px;height:32px;border:var(--border-brass);border-radius:var(--r-pill);background:var(--mat-quiet);color:var(--brass-1)}.hero-medallion--mage{color:var(--c-mana)}.party-divider{color:var(--brass-2)}
.route-progress{display:flex;align-items:center;gap:var(--sp-3);margin-left:auto;color:var(--muted);font:700 var(--fs-xs) var(--font-ui);text-align:right}
.progress-pips{display:flex;gap:5px}.progress-pips i{width:14px;height:14px;border-radius:var(--r-pill);border:2px solid var(--brass-3);background:var(--wood-0)}.progress-pips i.done{background:var(--brass-1);box-shadow:0 0 8px #ffd56b99}
/* Dense (long) maps: every row keeps at least 52px, the viewport scrolls when the window is shorter, the rooms are one line smaller. */
.map-viewport.is-dense{overflow-y:auto;overflow-x:hidden;scrollbar-width:thin}
.is-dense .dungeon-graph{min-height:calc(var(--rows) * 52px)}
.is-dense .map-node{min-height:42px;padding:3px var(--sp-2) 3px 4px;gap:var(--sp-1)}
.is-dense .node-medal{flex-basis:32px;height:32px}.is-dense .node-glyph{width:18px;height:18px}
.is-dense .node-content small{font-size:8px}.is-dense .node-content strong{font-size:clamp(11px,.95vw,14px)}
.is-dense .map-node--final{min-height:48px}.is-dense .map-node--final .node-medal{flex-basis:38px;height:38px}
.is-dense .node-check{top:-7px;width:18px;height:18px}
@media(max-width:800px){.campaign-screen{align-items:stretch;padding:var(--sp-3)}.campaign-topline{flex-wrap:wrap;gap:var(--sp-2)}.map-viewport{width:100%;height:460px;min-height:460px;overflow:auto}.dungeon-graph{width:850px;min-height:460px}.party-status{flex-wrap:wrap;gap:var(--sp-2)}.route-progress{width:100%;justify-content:center}.seed-chip{display:none}}
@media(max-height:760px){.campaign-header h1{font-size:26px}.campaign-header p{font-size:12px}.map-node{min-height:48px}.node-medal{flex-basis:34px;height:34px}.campaign-topline{letter-spacing:normal}.campaign-screen{gap:var(--sp-1)}}
</style>
