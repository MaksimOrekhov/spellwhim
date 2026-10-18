<script setup lang="ts">
// Visual direction for the Dungeon Map (docs/dungeon-map-foundation-v01.md). It is driven by the REAL generator
// (createDungeonRun → map, availableDungeonNodes), so it shows the real node types (battle / elite / rest / final), six
// layers, three columns and the real edges. It obeys the hiding rule: a node exposes only its category, layer and state —
// never an enemy name, HP, behaviour or exact reward. CampaignMap.vue is NOT touched; this is a restyling reference.
// Layout is a pure function of (layer, column), so the same data can be laid out horizontally (shown here) or vertically
// (as CampaignMap does today) — orientation is an open question for the implementation stage.
import { computed, ref } from 'vue'
import { availableDungeonNodes, createDungeonRun, DUNGEON_LAYER_COUNT } from '../../game/campaign'
import type { DungeonMapNode, DungeonNodeType } from '../../game/campaign'
import GlyphIcon from './GlyphIcon.vue'
import type { GlyphName } from './GlyphIcon.vue'

defineEmits<{ enter: [] }>()

const meta: Record<DungeonNodeType, { icon: GlyphName; name: string; tone: string; text: string }> = {
  battle: { icon: 'battle', name: 'Обычный бой', tone: '#d9794f', text: 'Схватка с противником. Кто именно ждёт — станет ясно после входа. Победа даёт выбор карты.' },
  elite: { icon: 'crown', name: 'Элитный бой', tone: '#e2505a', text: 'Опаснее обычного боя, зато награда ценнее.' },
  rest: { icon: 'camp', name: 'Привал', tone: '#8fd673', text: 'Передышка: лечит одного героя по вашему выбору.' },
  final: { icon: 'skull', name: 'Босс', tone: '#c59bf0', text: 'Финальная встреча похода.' },
}

// Staged progress for the mock: two nodes already behind us (the real helpers still decide what is reachable next).
const base = createDungeonRun(42)
const first = base.map.layers[0]![1]!
const second = base.map.layers[1]!.find(node => first.edges.includes(node.id))!
const run = { ...base, currentNodeId: second.id, visitedNodeIds: [first.id, second.id], completedNodeIds: [first.id, second.id] }
const nodes = base.map.layers.flat()
const reachable = new Set(availableDungeonNodes(run).map(n => n.id))
const visited = new Set(run.visitedNodeIds)

const X0 = 250, DX = 232, Y0 = 400, DY = 190
const pos = (n: DungeonMapNode) => ({ x: X0 + n.layer * DX, y: Y0 + (n.type === 'final' ? 1 : n.column) * DY })
const byId = new Map(nodes.map(n => [n.id, n]))
const edges = nodes.flatMap(n => n.edges.map(id => {
  const a = pos(n), b = pos(byId.get(id)!)
  const used = visited.has(n.id) && visited.has(id)
  return { key: n.id + id, d: `M${a.x} ${a.y} C${a.x + 100} ${a.y} ${b.x - 100} ${b.y} ${b.x} ${b.y}`, used, open: n.id === second.id }
}))
const stateOf = (n: DungeonMapNode) => n.id === second.id ? 'here' : visited.has(n.id) ? 'done' : reachable.has(n.id) ? 'next' : 'far'
const layerName = (n: DungeonMapNode) => n.type === 'final' ? 'Палуба · финал' : `Штрек ${n.layer + 1}`
// small deterministic irregularity so tokens feel hand-made rather than stamped
const wobble = (i: number) => ['50% 47% 52% 48%/48% 52% 47% 51%', '47% 52% 49% 51%/52% 48% 51% 47%', '51% 49% 47% 53%/49% 51% 53% 47%'][i % 3]
const focus = ref<DungeonMapNode | null>(nodes.find(n => reachable.has(n.id)) ?? null)
const info = computed(() => meta[focus.value?.type ?? 'final'])
const legend: DungeonNodeType[] = ['battle', 'elite', 'rest', 'final']
</script>

<template>
  <main class="map">
    <svg class="map-art" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="m-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#43301f"/><stop offset="1" stop-color="#1b110b"/></linearGradient>
        <linearGradient id="m-drift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5532"/><stop offset=".5" stop-color="#96693a"/><stop offset="1" stop-color="#553a24"/></linearGradient>
        <radialGradient id="m-lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd37a" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
        <filter id="m-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/></filter>
      </defs>
      <rect width="1920" height="1080" fill="url(#m-rock)"/>
      <path d="M0 250Q480 190 960 262T1920 228V300Q1440 340 960 300T0 330Z" fill="#5a3f2a" opacity=".45"/>
      <rect width="1920" height="1080" filter="url(#m-grain)"/>
      <!-- three drifts: soft, tube-like tunnels -->
      <g v-for="lane in 3" :key="lane">
        <rect x="150" :y="Y0 + (lane - 1) * DY - 62" width="1640" height="124" rx="62" fill="url(#m-drift)" stroke="#2a1a10" stroke-width="7"/>
        <rect x="156" :y="Y0 + (lane - 1) * DY - 56" width="1628" height="112" rx="56" fill="none" stroke="#e6bd7a55" stroke-width="3"/>
      </g>
      <!-- hanging lanterns above each layer -->
      <g v-for="i in 7" :key="'p' + i"><circle :cx="X0 + (i - 1) * DX" cy="318" r="50" fill="url(#m-lamp)"/><circle :cx="X0 + (i - 1) * DX" cy="318" r="9" fill="#ffe7a0"/></g>
      <g fill="none" stroke-linecap="round">
        <template v-for="e in edges" :key="e.key">
          <path :d="e.d" stroke="#1c120a" stroke-width="20"/>
          <path :d="e.d" :stroke="e.used ? '#ffd56b' : e.open ? '#f9e2ad' : '#a88455'" :stroke-width="e.used ? 9 : 6" :stroke-dasharray="e.open ? '2 15' : ''" :class="{ pulse: e.open }" :opacity="e.used || e.open ? 1 : .5"/>
        </template>
      </g>
    </svg>

    <header class="map-head">
      <small>Мёртвые копи · маршрут похода · эскиз оформления</small>
      <h1>Выберите штрек</h1>
    </header>

    <div class="map-nodes">
      <button v-for="n in nodes" :key="n.id" class="node" :class="['node--' + stateOf(n), 'node--' + n.type]" :style="{ left: pos(n).x / 19.2 + '%', top: pos(n).y / 10.8 + '%', '--c': meta[n.type].tone, borderRadius: wobble(n.layer + n.column) }" :disabled="stateOf(n) !== 'next'" :aria-label="`${layerName(n).toUpperCase()}. ${meta[n.type].name}. ${stateOf(n) === 'next' ? 'доступно' : stateOf(n) === 'done' || stateOf(n) === 'here' ? 'пройдено' : 'закрыто'}.`" @mouseenter="focus = n" @focus="focus = n" @click="$emit('enter')">
        <GlyphIcon :name="meta[n.type].icon" />
        <span v-if="stateOf(n) === 'here'" class="marker" aria-hidden="true"><GlyphIcon name="pick" /></span>
      </button>
      <span v-for="layer in DUNGEON_LAYER_COUNT + 1" :key="'l' + layer" class="layer-tag" :style="{ left: (X0 + (layer - 1) * DX) / 19.2 + '%' }">{{ layer === DUNGEON_LAYER_COUNT + 1 ? 'Палуба' : 'Штрек ' + layer }}</span>
    </div>

    <aside class="map-info" aria-live="polite">
      <span class="info-icon" :style="{ '--c': info.tone }"><GlyphIcon :name="info.icon" /></span>
      <span class="info-copy"><small>{{ focus ? layerName(focus) : '' }}</small><strong>{{ info.name }}</strong><em>{{ info.text }}</em></span>
    </aside>
    <ul class="map-legend" aria-label="Легенда"><li v-for="k in legend" :key="k" :style="{ '--c': meta[k].tone }"><GlyphIcon :name="meta[k].icon" /> {{ meta[k].name }}</li></ul>
    <footer class="map-party"><span>Отряд</span><b>Вариан {{ run.heroes.warrior.health }}/{{ run.heroes.warrior.maxHealth }}</b><i aria-hidden="true">✦</i><b>Джайна {{ run.heroes.mage.health }}/{{ run.heroes.mage.maxHealth }}</b><span class="gap">Колода: {{ run.deck.length }} карт</span></footer>
  </main>
</template>

<style scoped>
.map{position:absolute;inset:0;z-index:5;color:var(--text)}
.map-art{position:absolute;inset:0;width:100%;height:100%;display:block}
.pulse{animation:flow 1.1s linear infinite}
@keyframes flow{to{stroke-dashoffset:-17}}
.map-head{position:absolute;left:0;right:0;top:1.6rem;text-align:center;text-shadow:0 .2rem .6rem #000}
.map-head small{font:800 .8rem var(--f-ui);letter-spacing:.2em;text-transform:uppercase;color:#d9bf8a}
.map-head h1{margin:.1rem 0 0;font:800 2.6rem var(--f-display);color:#fff0c8}
.map-nodes{position:absolute;inset:0}
.layer-tag{position:absolute;top:calc(100% * 205 / 1080);translate:-50% 0;padding:.25rem 1rem;border-radius:1rem 1.3rem 1rem 1.2rem;background:#2a1a10e6;border:.1rem solid #c9974a99;font:800 .74rem var(--f-ui);letter-spacing:.14em;text-transform:uppercase;color:#f1dba8;white-space:nowrap}
.node{--c:#d9794f;position:absolute;display:grid;place-items:center;width:5.2rem;height:5.2rem;margin:-2.6rem 0 0 -2.6rem;padding:0;border:.3rem solid #3a2412;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 60%,#fff),var(--c) 55%,color-mix(in srgb,var(--c) 50%,#000));box-shadow:0 .5rem .9rem #000b,inset 0 0 0 .14rem #ffffff55,inset 0 -.4rem .6rem #0004;color:#2a1208;font-size:2.4rem;transition:transform .2s var(--ease-out),filter .2s}
.node--far{filter:grayscale(.75) brightness(.55);box-shadow:0 .3rem .6rem #000a}
.node--done{filter:grayscale(.4) brightness(.65)}
.node--here{box-shadow:0 0 0 .3rem #ffd56b,0 0 1.6rem #ffd56b,0 .5rem .9rem #000b}
.node--next{animation:node-pulse 1.4s ease-in-out infinite}
.node--next:hover,.node--next:focus-visible{transform:scale(1.14)}
@keyframes node-pulse{50%{box-shadow:0 0 0 .35rem #fff0b8aa,0 0 1.8rem #ffd56b,0 .5rem .9rem #000b}}
.node--final{width:7.6rem;height:7.6rem;margin:-3.8rem 0 0 -3.8rem;font-size:3.6rem;filter:drop-shadow(0 0 1.3rem #c59bf088)}
.marker{position:absolute;right:-1.3rem;bottom:-1.4rem;display:grid;place-items:center;width:2.7rem;height:2.7rem;border-radius:50% 46% 52% 48%;background:#2a1a10;border:.14rem solid #ffd56b;color:#ffd56b;font-size:1.5rem}
.map-info{position:absolute;left:50%;bottom:6.4rem;translate:-50% 0;display:flex;align-items:center;gap:1.2rem;width:46rem;padding:1rem 1.8rem 1rem 1rem;border-radius:2.2rem 2.8rem 2.3rem 2.6rem/2.4rem 2.2rem 2.7rem 2.3rem;background:linear-gradient(160deg,var(--parch-1),var(--parch-2));color:var(--ink);box-shadow:0 .7rem 1.6rem #000c,0 0 0 .16rem var(--brass-3),0 0 0 .3rem #2b1f14}
.info-icon{--c:#d9794f;display:grid;place-items:center;flex:none;width:4.4rem;height:4.4rem;border-radius:50%;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 55%,#fff),var(--c) 60%,color-mix(in srgb,var(--c) 55%,#000));color:#2a1208;font-size:2.3rem;box-shadow:0 .25rem .5rem #0008}
.info-copy{display:flex;flex-direction:column;gap:.1rem}
.info-copy small{font:800 .7rem var(--f-ui);letter-spacing:.16em;text-transform:uppercase;color:#7a5a2c}
.info-copy strong{font:800 1.5rem var(--f-display)}
.info-copy em{font:600 .92rem/1.35 var(--f-ui);font-style:normal;color:#4a3318}
.map-legend{position:absolute;left:0;right:0;bottom:3.5rem;display:flex;justify-content:center;gap:1.3rem;margin:0;padding:0;list-style:none}
.map-legend li{--c:#fff;display:flex;align-items:center;gap:.4rem;font:700 .8rem var(--f-ui);color:#e6d6b2;text-shadow:0 .1rem .2rem #000}
.map-legend svg{width:1.3rem;height:1.3rem;color:var(--c)}
.map-party{position:absolute;left:50%;bottom:.9rem;translate:-50% 0;display:flex;align-items:center;gap:1rem;padding:.4rem 1.5rem;border-radius:2rem 1.7rem 2rem 1.8rem;background:#1a110bf0;border:.14rem solid var(--brass-3);font:700 .95rem var(--f-ui)}
.map-party span{font:800 .7rem var(--f-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--text-dim)}
.map-party i{color:var(--brass-2);font-style:normal}
.map-party .gap{margin-left:1rem}
@media (max-height:820px){.map-info{bottom:5.4rem;width:40rem}.map-legend{bottom:3.1rem;gap:.9rem}.map-head h1{font-size:2rem}}
</style>
