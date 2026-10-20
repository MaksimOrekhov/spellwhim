<script setup lang="ts">
import { computed } from 'vue'
import { Anvil, Crown, Flame, Gem, Lamp, ScrollText, Skull, Swords } from '@lucide/vue'
import DeckViewer from './DeckViewer.vue'
import { availableDungeonNodes } from '../game/campaign'
import type { DungeonMap, DungeonMapNode, DungeonRunState } from '../game/campaign'

const props = defineProps<{ map: DungeonMap; run: DungeonRunState }>()
const emit = defineEmits<{ enter: [nodeId: string]; mode: [] }>()
const columns = computed(() => props.map.configuration?.columns ?? 3)
const rows = computed(() => props.map.layers.length)
const nodes = computed(() => props.map.layers.flat())
const available = computed(() => new Set(availableDungeonNodes(props.run).map(node => node.id)))
const visited = computed(() => new Set(props.run.visitedNodeIds))
const edges = computed(() => props.map.layers.flatMap(layer => layer.flatMap(node => node.edges.map(targetId => ({
  id: `${node.id}:${targetId}`,
  path: edgePath(node, nodes.value.find(target => target.id === targetId)!),
  complete: visited.value.has(node.id) && visited.value.has(targetId),
})))))

function position(node: DungeonMapNode) {
  return { x: ((node.column + 0.5) / columns.value) * 1000, y: 900 - node.layer * (800 / (rows.value-1)) }
}

function edgePath(from: DungeonMapNode, to: DungeonMapNode) {
  const a = position(from)
  const b = position(to)
  const bend = Math.min(48, Math.abs(b.x - a.x) * 0.16)
  return `M ${a.x} ${a.y} C ${a.x + (b.x > a.x ? bend : -bend)} ${(a.y + b.y) / 2}, ${b.x - (b.x > a.x ? bend : -bend)} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`
}

function nodeStyle(node: DungeonMapNode) {
  const p = position(node)
  return { left: `${p.x/10}%`, top: `${p.y/10}%`, width: `${86/columns.value}%` }
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

    <section class="map-viewport" aria-label="Карта подземелья">
      <div class="dungeon-graph">
        <div class="mine-rail mine-rail--left" aria-hidden="true"></div>
        <div class="mine-rail mine-rail--right" aria-hidden="true"></div>
        <svg class="route-edges" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <path v-for="edge in edges" :key="edge.id" :d="edge.path" :class="{ 'is-travelled': edge.complete }" />
        </svg>
        <button
          v-for="node in nodes"
          :key="node.id"
          class="map-node"
          :class="[`map-node--${node.type}`, { 'is-available': available.has(node.id), 'is-visited': visited.has(node.id), 'is-locked': !available.has(node.id) && !visited.has(node.id) }]"
          :style="nodeStyle(node)"
          :disabled="!available.has(node.id)"
          :aria-label="ariaLabel(node)"
          @click="emit('enter', node.id)"
        >
          <component :is="categoryIcon(node)" class="node-glyph" aria-hidden="true" :stroke-width="2.2" />
          <span class="node-content">
            <small>{{ layerLabel(node) }}</small>
            <strong>{{ categoryLabel(node) }}</strong>
          </span>
        </button>
      </div>
    </section>

    <footer class="party-status">
      <div class="party-hero"><span class="hero-medallion hero-medallion--warrior">⚔</span><span><small>ВАРИАН РИНН</small><strong>{{ run.heroes.warrior.health }} / {{ run.heroes.warrior.maxHealth }} HP</strong></span></div>
      <span class="party-divider" aria-hidden="true">✦</span>
      <div class="party-hero"><span class="hero-medallion hero-medallion--mage">✦</span><span><small>ДЖАЙНА ПРАУДМУР</small><strong>{{ run.heroes.mage.health }} / {{ run.heroes.mage.maxHealth }} HP</strong></span></div>
      <span class="route-progress">{{ run.completedNodeIds.length }}/{{ rows }} ПОСЕЩЕНИЙ · {{ run.deck.length }} КАРТ В КОЛОДЕ</span>
    </footer>
  </main>
</template>

<style scoped>
.campaign-screen{position:absolute;z-index:8;inset:0;display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);overflow:auto;padding:var(--sp-3) clamp(18px,4vw,64px);background:var(--mat-mine-map);color:var(--ink)}
.campaign-screen::after{position:absolute;inset:var(--sp-2);content:"";pointer-events:none;border:var(--border-panel);border-radius:var(--shape-dialog);box-shadow:var(--shadow-4)}
.campaign-header,.map-viewport,.party-status{position:relative;z-index:1}.campaign-header{width:min(1120px,100%);text-align:center;flex:0 0 auto}.campaign-topline{display:flex;align-items:center;justify-content:center;gap:var(--sp-3);color:var(--brass-1);font:700 var(--fs-xs) var(--font-display);letter-spacing:var(--ls-caps)}.campaign-topline .game-button{font-size:var(--fs-xs);padding:var(--sp-2)}.seed-chip{padding:var(--sp-2);border:var(--border-panel);border-radius:var(--shape-chip);font-family:var(--font-num)}.campaign-header h1{margin:var(--sp-1) 0;color:var(--parch-1);font:700 clamp(26px,3vw,40px) var(--font-display)}.campaign-header p{margin:0;color:var(--muted);font:600 var(--fs-sm) var(--font-ui)}.campaign-header .last-decision{color:var(--brass-1);margin-top:var(--sp-1)}
.map-viewport{width:min(1120px,100%);min-height:390px;flex:1;margin:var(--sp-2) 0}.dungeon-graph{position:relative;width:100%;height:100%;min-height:390px;isolation:isolate}.route-edges{position:absolute;z-index:-1;inset:0;width:100%;height:100%;overflow:visible}.route-edges path{fill:none;stroke:var(--brass-3);stroke-width:6;stroke-linecap:round;opacity:.6}.route-edges path.is-travelled{stroke:var(--brass-1);stroke-width:9;opacity:1}.mine-rail{position:absolute;z-index:-1;top:2%;bottom:5%;width:12px;border-left:var(--border-brass);border-right:var(--border-brass);opacity:.18}.mine-rail--left{left:6%}.mine-rail--right{right:6%}
.map-node{position:absolute;display:flex;align-items:center;justify-content:center;gap:var(--sp-2);min-height:52px;padding:var(--sp-2);border:var(--border-panel);border-radius:var(--shape-plank);background:var(--mat-wood);color:var(--ink);box-shadow:var(--shadow-2);transform:translate(-50%,-50%);transition:filter var(--dur-base),transform var(--dur-base);cursor:default}.map-node.is-available{border:var(--border-brass);box-shadow:var(--glow-bonus),var(--shadow-2);cursor:pointer}.map-node.is-available:hover,.map-node.is-available:focus-visible{z-index:3;outline:var(--focus-ring);outline-offset:var(--focus-offset);filter:brightness(1.15);transform:translate(-50%,-50%) scale(1.03)}.map-node.is-visited{border-color:var(--brass-2);background:var(--mat-teal-panel)}.map-node.is-locked{filter:saturate(.5);opacity:.65}.map-node--rest .node-glyph{color:var(--c-heal)}.map-node--elite .node-glyph{color:var(--c-threat)}.map-node--event .node-glyph,.map-node--final .node-glyph{color:var(--c-mana)}.node-glyph{flex:0 0 24px;width:24px;height:24px;color:var(--brass-1)}.node-content{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}.node-content small{color:var(--muted);font:700 9px var(--font-display);letter-spacing:var(--ls-caps)}.node-content strong{font:800 clamp(11px,1vw,15px) var(--font-display);white-space:nowrap}
.party-status{display:flex;align-items:center;justify-content:center;gap:var(--sp-4);width:min(1120px,100%);flex:0 0 auto;padding:var(--sp-2) var(--sp-4);border:var(--border-panel);border-radius:var(--shape-banner);background:var(--mat-wood);box-shadow:var(--shadow-2)}.party-hero{display:flex;align-items:center;gap:var(--sp-2)}.party-hero>span:last-child{display:grid;gap:2px}.party-hero small{color:var(--brass-1);font:700 10px var(--font-display)}.party-hero strong{font:700 var(--fs-sm) var(--font-num)}.hero-medallion{display:grid;place-items:center;width:32px;height:32px;border:var(--border-brass);border-radius:var(--r-pill);background:var(--mat-quiet);color:var(--brass-1)}.hero-medallion--mage{color:var(--c-mana)}.party-divider{color:var(--brass-2)}.route-progress{margin-left:auto;color:var(--muted);font:700 var(--fs-xs) var(--font-ui);text-align:right}
@media(max-width:800px){.campaign-screen{align-items:stretch;padding:var(--sp-3)}.campaign-topline{flex-wrap:wrap;gap:var(--sp-2)}.map-viewport{width:100%;height:460px;min-height:460px;overflow:auto}.dungeon-graph{width:850px;min-height:460px}.party-status{flex-wrap:wrap;gap:var(--sp-2)}.route-progress{width:100%;text-align:center}.seed-chip{display:none}}
@media(max-height:760px){.campaign-header h1{font-size:26px}.campaign-header p{font-size:12px}.map-node{min-height:48px}.campaign-topline{letter-spacing:normal}.campaign-screen{gap:var(--sp-1)}}
</style>
