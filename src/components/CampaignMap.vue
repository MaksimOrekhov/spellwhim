<script setup lang="ts">
import { computed } from 'vue'
import { Crown, Flame, Skull, Swords } from '@lucide/vue'
import { availableDungeonNodes } from '../game/campaign'
import type { DungeonMap, DungeonMapNode, DungeonRunState } from '../game/campaign'

const props = defineProps<{ map: DungeonMap; run: DungeonRunState }>()
const emit = defineEmits<{ enter: [nodeId: string]; restart: [] }>()
const nodes = computed(() => props.map.layers.flat())
const available = computed(() => new Set(availableDungeonNodes(props.run).map(node => node.id)))
const visited = computed(() => new Set(props.run.visitedNodeIds))
const edges = computed(() => props.map.layers.flatMap(layer => layer.flatMap(node => node.edges.map(targetId => ({
  id: `${node.id}:${targetId}`,
  path: edgePath(node, nodes.value.find(target => target.id === targetId)!),
  complete: visited.value.has(node.id) && visited.value.has(targetId),
})))))

function position(node: DungeonMapNode) {
  return { x: ((node.column + 0.5) / 3) * 1000, y: 900 - node.layer * 138 }
}

function edgePath(from: DungeonMapNode, to: DungeonMapNode) {
  const a = position(from)
  const b = position(to)
  const bend = Math.min(48, Math.abs(b.x - a.x) * 0.16)
  return `M ${a.x} ${a.y} C ${a.x + (b.x > a.x ? bend : -bend)} ${(a.y + b.y) / 2}, ${b.x - (b.x > a.x ? bend : -bend)} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`
}

function nodeStyle(node: DungeonMapNode) {
  return { left: `${((node.column + 0.5) / 3) * 100}%`, top: `${90 - node.layer * 13.8}%` }
}

function categoryIcon(node: DungeonMapNode) {
  if (node.type === 'rest') return Flame
  if (node.type === 'elite') return Crown
  if (node.type === 'final') return Skull
  return Swords
}

function categoryLabel(node: DungeonMapNode) {
  if (node.type === 'rest') return 'Привал'
  if (node.type === 'elite') return 'Элитный бой'
  if (node.type === 'final') return 'Босс'
  return 'Обычный бой'
}

function layerLabel(node: DungeonMapNode) {
  return node.type === 'final' ? 'ПАЛУБА · ФИНАЛ' : `ШТРЕК ${node.layer + 1}`
}

function ariaLabel(node: DungeonMapNode) {
  const state = visited.value.has(node.id) ? 'пройдено' : available.value.has(node.id) ? 'доступно' : 'закрыто'
  return `${layerLabel(node)}. ${categoryLabel(node)}. ${state}.`
}
</script>

<template>
  <main class="campaign-screen">
    <header class="campaign-header">
      <div class="campaign-topline"><span class="campaign-mark" aria-hidden="true">✦</span><span>МЁРТВЫЕ КОПИ · МАРШРУТ ПОХОДА</span><span class="seed-chip">ЗЕРНО {{ run.seed }}</span><button class="new-run" @click="emit('restart')">Новый поход ↻</button></div>
      <h1>Выберите штрек</h1>
      <p>Рельсы ведут вниз. Привал лечит одного героя, а элита предлагает больше карт на выбор.</p>
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
      <span class="route-progress">{{ run.completedNodeIds.length }} УЗЛОВ ПРОЙДЕНО · {{ run.deck.length }} КАРТ В КОЛОДЕ</span>
    </footer>
  </main>
</template>

<style scoped>
.campaign-screen{position:absolute;z-index:8;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:auto;padding:20px clamp(18px,4vw,64px) 18px;background:radial-gradient(ellipse at 50% 25%,#738467 0,#526d58 38%,#284d46 78%,#1c3a38 100%);color:#fff0d1}
.campaign-screen::before,.campaign-screen::after{position:absolute;inset:0;content:"";pointer-events:none}
.campaign-screen::before{opacity:.22;background:repeating-linear-gradient(172deg,transparent 0 65px,#cda96810 66px 69px,transparent 70px 110px),radial-gradient(ellipse at 16% 54%,#d29f5030,transparent 32%)}
.campaign-screen::after{inset:9px;border:1px solid #e5c47e32;box-shadow:inset 0 0 60px #101f2340}
.campaign-header,.map-viewport,.party-status{position:relative;z-index:1}
.campaign-header{width:min(1080px,100%);text-align:center;flex:0 0 auto}
.campaign-topline{display:flex;align-items:center;justify-content:center;gap:12px;color:#e7cf9b;font:700 clamp(10px,.85vw,13px) var(--display);letter-spacing:.16em}
.campaign-mark{color:#ffe19a;font-size:24px;text-shadow:0 0 18px #ffc262}
.seed-chip{padding:5px 9px;border:1px solid #d7bc8155;border-radius:14px;background:#1d3536aa;font:700 10px var(--font-ui);letter-spacing:.06em}
.new-run{padding:6px 14px;border:1px solid #d7bc8166;border-radius:var(--r-pill);background:#213d39c9;color:#f8e4b6;font:700 11px var(--font-ui);cursor:pointer}
.new-run:hover,.new-run:focus-visible{border-color:#ffe2a0;background:#38554a;outline:none}
.campaign-header h1{margin:5px 0 2px;color:#fff0c9;font:700 clamp(28px,3vw,40px) var(--display);text-shadow:0 4px 14px #0008}
.campaign-header p{margin:0;color:#eee0c5;font:500 clamp(12px,1.05vw,15px) var(--font-ui)}
.map-viewport{width:min(1120px,100%);height:min(64vh,560px);min-height:408px;flex:1 0 auto;margin:8px 0;overflow:visible}
.dungeon-graph{position:relative;width:100%;height:100%;min-height:408px;isolation:isolate}
.route-edges{position:absolute;z-index:-1;inset:0;width:100%;height:100%;overflow:visible}
.route-edges path{fill:none;stroke:#a989553f;stroke-width:9;stroke-linecap:round;filter:drop-shadow(0 3px 2px #132b2d88)}
.route-edges path.is-travelled{stroke:#ffd178c9;stroke-width:12;filter:drop-shadow(0 0 8px #ffd178aa)}
.mine-rail{position:absolute;z-index:-1;top:2%;bottom:5%;width:9px;border-left:2px solid #bd985659;border-right:2px solid #bd985659;opacity:.48;transform:skewY(-4deg)}
.mine-rail::after{position:absolute;top:0;right:-7px;bottom:0;left:-7px;background:repeating-linear-gradient(180deg,transparent 0 18px,#d2ab6b52 19px 21px,transparent 22px 42px);content:""}
.mine-rail--left{left:15%}.mine-rail--right{right:15%}
.map-node{position:absolute;display:flex;align-items:center;justify-content:center;gap:11px;width:23%;min-height:50px;padding:7px 14px;border:1px solid #ddc58a70;border-radius:var(--shape-plank);background:linear-gradient(145deg,#263c39f2,#374d43f2);color:#fff1d0;text-align:left;box-shadow:0 7px 18px #0c282a88,inset 0 0 0 2px #e3c87b0c;transform:translate(-50%,-50%);transition:filter .18s,transform .18s,border-color .18s,box-shadow .18s;cursor:default}
.map-node.is-available{border-color:#ffdc91;box-shadow:0 0 0 2px #ffe19a24,0 0 25px #ffc95a55,inset 0 0 15px #f4cf7420;cursor:pointer;animation:node-glow 2.6s ease-in-out infinite}
.map-node.is-available:hover,.map-node.is-available:focus-visible{z-index:3;outline:none;filter:brightness(1.16);transform:translate(-50%,-50%) scale(1.04);box-shadow:0 0 0 3px #ffe8b255,0 0 34px #ffd36d77}
.map-node.is-visited{border-color:#f3d282;background:linear-gradient(145deg,#55462e,#394b3e);box-shadow:0 0 18px #e6bd5d40}
.map-node.is-locked{filter:saturate(.55) brightness(.78);opacity:.8}
.map-node--rest{background:linear-gradient(145deg,#294a47f2,#4b5a45f2)}
.map-node--elite{border-color:#df9c6d;background:linear-gradient(145deg,#4a3331f5,#543f3cf5)}
.map-node--battle{border-color:#d8bb79a0;background:linear-gradient(145deg,#423d30f5,#35453df5)}
.map-node--final{width:25%;border-color:#c5a7e5;background:linear-gradient(145deg,#51405e,#4a3540);box-shadow:0 0 28px #c19be777}
.node-glyph{flex:0 0 25px;width:25px;height:25px;color:#ffe09a;filter:drop-shadow(0 0 7px #ffc85c66)}
.map-node--rest .node-glyph{color:#bfe5a2;filter:drop-shadow(0 0 7px #a9df9866)}.map-node--elite .node-glyph{color:#ffb091;filter:drop-shadow(0 0 7px #ff977866)}.map-node--final .node-glyph{color:#e2c9ff;filter:drop-shadow(0 0 8px #c69aff88)}
.node-content{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}
.node-content small{color:#e5c984;font:700 9px var(--display);letter-spacing:.1em}
.node-content strong{color:#fff0cf;font:800 clamp(12px,1vw,15px) var(--display);white-space:nowrap}
.party-status{display:flex;align-items:center;justify-content:center;gap:clamp(12px,2vw,28px);width:min(1000px,100%);flex:0 0 auto;padding:9px 22px;border:1px solid #d8bb7b5c;border-radius:var(--shape-banner);background:linear-gradient(90deg,#203b38ed,#314b40ed,#203b38ed);box-shadow:0 8px 22px #102a2b70}
.party-hero{display:flex;align-items:center;gap:9px;min-width:145px}.party-hero>span:last-child{display:grid;gap:2px}.party-hero small{color:#ddc38d;font:700 9px var(--display);letter-spacing:.06em}.party-hero strong{color:#fff1d2;font:700 14px var(--font-ui)}
.hero-medallion{display:grid;place-items:center;width:31px;height:31px;border:1px solid #d5b46e;border-radius:50%;background:#423b31;color:#ffdc8d}.hero-medallion--mage{border-color:#b6a3d7;background:#302e49;color:#d7caff}
.party-divider{color:#e6c678;font-size:14px}.route-progress{margin-left:auto;color:#d9cbab;font:700 9px var(--display);letter-spacing:.08em;text-align:right}
@keyframes node-glow{0%,100%{box-shadow:0 0 0 2px #ffe19a24,0 0 18px #ffc95a40,inset 0 0 15px #f4cf7418}50%{box-shadow:0 0 0 2px #ffe19a42,0 0 28px #ffc95a70,inset 0 0 17px #f4cf7428}}
@media(max-height:760px) and (min-width:701px){.campaign-screen{padding-top:10px;padding-bottom:10px}.campaign-header h1{font-size:28px}.campaign-header p{font-size:12px}.map-viewport{height:min(64vh,500px);min-height:390px;margin:4px 0}.party-status{padding:7px 14px}}
@media(max-width:700px){.campaign-screen{align-items:stretch;padding:14px 12px;overflow-y:auto}.campaign-header{margin-bottom:10px}.campaign-topline{flex-wrap:wrap;gap:8px;font-size:9px}.campaign-header h1{font-size:28px}.campaign-header p{font-size:12px;line-height:1.4}.map-viewport{width:100%;height:500px;min-height:500px;overflow-x:auto;overflow-y:hidden}.dungeon-graph{width:680px;min-height:500px}.map-node{width:30%;min-height:62px;padding:7px}.node-content small{font-size:8px}.node-content strong{font-size:12px}.party-status{flex-wrap:wrap;justify-content:space-evenly;gap:8px;padding:9px}.party-hero{min-width:120px}.route-progress{width:100%;margin:0;text-align:center}.mine-rail--left{left:15%}.mine-rail--right{right:15%}}
</style>
