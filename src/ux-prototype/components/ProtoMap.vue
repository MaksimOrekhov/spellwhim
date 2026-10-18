<script setup lang="ts">
// Visual direction for the future Dungeon Map Foundation (concept «Штреки» from docs/roguelike-adventure-design-research.md §5.4).
// STATIC MOCK with hand-written sample data — it is not a route generator and does not touch CampaignMap.vue.
// A «штрек» is a horizontal mine tunnel: three tunnels run left→right, shafts connect them, each layer is a "horizon".
import { computed, ref } from 'vue'
import GlyphIcon from './GlyphIcon.vue'
import type { GlyphName } from './GlyphIcon.vue'

defineEmits<{ enter: [] }>()

type NodeKind = 'F' | 'E' | 'R' | 'K' | 'M' | 'T' | '?' | 'N' | 'B'
interface MapNode { id: string; layer: number; lane: number; kind: NodeKind; state: 'done' | 'here' | 'next' | 'far' }
const meta: Record<NodeKind, { icon: GlyphName; name: string; tone: string; text: string }> = {
  F: { icon: 'damage', name: 'Бой', tone: '#d2674a', text: 'Обычная схватка. Враг виден заранее: тип узла известен, награда — выбор карты.' },
  E: { icon: 'skull', name: 'Элита', tone: '#e23b45', text: 'Опасный противник. Не раньше 3-го горизонта. Награда выше — артефакт.' },
  R: { icon: 'camp', name: 'Привал', tone: '#8ad66f', text: 'Вылечить отряд (≈ 13 здоровья на двоих) или улучшить карту.' },
  K: { icon: 'anvil', name: 'Кузница', tone: '#e8913a', text: 'Улучшить или убрать карту из колоды. Без лечения.' },
  M: { icon: 'coin', name: 'Торговец', tone: '#62c4c4', text: 'Купить карту, артефакт или лечение за золото похода.' },
  T: { icon: 'chest', name: 'Тайник', tone: '#ffd56b', text: 'Опорная награда середины пути: артефакт, решите, кому он достанется.' },
  '?': { icon: 'cart', name: 'Событие', tone: '#b48cff', text: 'Выбор из 2–3 вариантов с «подходами» героев. Содержимое — при входе.' },
  N: { icon: 'quill', name: 'Рассказчик', tone: '#f1e2bd', text: 'Приукрасить финал: выше риск и награда — или скромничать.' },
  B: { icon: 'crown', name: 'Эдвин ван Клиф', tone: '#ffb23d', text: 'Босс на палубе незавершённого джаггернаута.' },
}
const layout: NodeKind[][] = [['F', 'F', '?'], ['F', '?', 'F'], ['R', 'F', 'E'], ['F', 'M', '?'], ['T', 'F', 'E'], ['?', 'R', 'F'], ['F', 'F', '?'], ['R', 'K', 'N']]
const links: number[][][] = [[[0, 1], [1], [2]], [[0], [0, 1], [1, 2]], [[0, 1], [1], [2]], [[0], [1, 2], [2]], [[0], [0, 1], [1, 2]], [[0, 1], [1], [2]], [[0], [1], [2]]]
const regions = [{ name: 'Забой', from: 0, to: 2 }, { name: 'Мастерская и литейная', from: 3, to: 5 }, { name: 'Железный борт', from: 6, to: 7 }]
const X0 = 250, DX = 188, Y0 = 430, DY = 190
const pos = (layer: number, lane: number) => ({ x: X0 + layer * DX, y: Y0 + lane * DY })
const bossPos = { x: X0 + 8 * DX + 20, y: Y0 + DY }
// sample route: started at lane 1, took ? (L2), is now choosing between Привал (L3 lane 0) and Бой (L3 lane 1)
const route = [[1, 0], [1, 1]]
const nodes = computed<MapNode[]>(() => layout.flatMap((row, layer) => row.map((kind, lane): MapNode => {
  const done = route.some(([l, ln]) => l === layer && ln === lane)
  const here = layer === 1 && lane === 1
  const next = layer === 2 && links[1]![1]!.includes(lane)
  return { id: `${layer}-${lane}`, layer, lane, kind, state: here ? 'here' : done ? 'done' : next ? 'next' : 'far' }
})))
const edges = computed(() => links.flatMap((perLane, layer) => perLane.flatMap((targets, lane) => targets.map(t => {
  const a = pos(layer, lane), b = pos(layer + 1, t)
  const used = route.some(([l, ln]) => l === layer && ln === lane) && route.some(([l, ln]) => l === layer + 1 && ln === t)
  const open = layer === 1 && lane === 1
  return { key: `${layer}-${lane}-${t}`, d: `M${a.x} ${a.y} C${a.x + 80} ${a.y} ${b.x - 80} ${b.y} ${b.x} ${b.y}`, used, open }
}))))
const bossEdges = [0, 1, 2].map(lane => { const a = pos(7, lane); return { key: 'b' + lane, d: `M${a.x} ${a.y} C${a.x + 90} ${a.y} ${bossPos.x - 90} ${bossPos.y} ${bossPos.x} ${bossPos.y}` } })
const focus = ref<MapNode | null>(nodes.value.find(n => n.layer === 2 && n.lane === 0) ?? null)
const info = computed(() => focus.value ? meta[focus.value.kind] : meta.B)
</script>

<template>
  <main class="map">
    <svg class="map-art" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Схема шахты: три штрека, горизонты и развилки">
      <defs>
        <linearGradient id="m-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a1e"/><stop offset="1" stop-color="#1b110b"/></linearGradient>
        <linearGradient id="m-drift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4a2c"/><stop offset=".5" stop-color="#8a6236"/><stop offset="1" stop-color="#4d3320"/></linearGradient>
        <radialGradient id="m-lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd37a" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
        <filter id="m-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/></filter>
      </defs>
      <rect width="1920" height="1080" fill="url(#m-rock)"/>
      <g opacity=".5"><path d="M0 250Q480 210 960 262T1920 238V300Q1440 330 960 300T0 322Z" fill="#5a3f2a"/><path d="M0 880Q520 842 960 892T1920 868V930Q1400 960 960 926T0 950Z" fill="#2a1a10"/></g>
      <rect width="1920" height="1080" filter="url(#m-grain)"/>
      <!-- three drifts (штреки) -->
      <g v-for="lane in 3" :key="lane">
        <rect :x="170" :y="Y0 + (lane - 1) * DY - 54" :width="1620" height="108" rx="54" fill="url(#m-drift)" stroke="#2a1a10" stroke-width="6"/>
        <rect :x="170" :y="Y0 + (lane - 1) * DY - 54" :width="1620" height="108" rx="54" fill="none" stroke="#c9974a55" stroke-width="2"/>
        <line :x1="200" :x2="1760" :y1="Y0 + (lane - 1) * DY + 40" :y2="Y0 + (lane - 1) * DY + 40" stroke="#2a1a10" stroke-width="5" stroke-dasharray="26 14" opacity=".55"/>
      </g>
      <!-- timber props between horizons + lanterns -->
      <g v-for="i in 9" :key="'p' + i">
        <rect :x="X0 + (i - 1.5) * DX - 9" y="318" width="18" height="582" fill="#2a1a10" opacity=".55"/>
        <circle :cx="X0 + (i - 1.5) * DX" cy="338" r="46" fill="url(#m-lamp)"/>
        <circle :cx="X0 + (i - 1.5) * DX" cy="338" r="7" fill="#ffe7a0"/>
      </g>
      <!-- edges: rails -->
      <g fill="none" stroke-linecap="round">
        <template v-for="e in edges" :key="e.key">
          <path :d="e.d" stroke="#1c120a" stroke-width="16"/>
          <path :d="e.d" :stroke="e.used ? '#ffd56b' : e.open ? '#f4d9a0' : '#9b7a4c'" :stroke-width="e.used ? 8 : 5" :stroke-dasharray="e.open ? '2 14' : ''" :class="{ pulse: e.open }" :opacity="e.used || e.open ? 1 : .55"/>
        </template>
        <template v-for="e in bossEdges" :key="e.key"><path :d="e.d" stroke="#1c120a" stroke-width="16"/><path :d="e.d" stroke="#9b7a4c" stroke-width="5" opacity=".4"/></template>
      </g>
      <!-- region plates -->
      <g font-family="Palatino Linotype, Georgia, serif" text-anchor="middle">
        <g v-for="r in regions" :key="r.name">
          <rect :x="pos(r.from, 0).x - 80" y="150" :width="(r.to - r.from) * DX + 160" height="62" rx="10" fill="#2a1a10" stroke="#c9974a" stroke-width="3"/>
          <text :x="(pos(r.from, 0).x + pos(r.to, 0).x) / 2" y="192" font-size="30" font-weight="800" fill="#f6e3b0">{{ r.name }}</text>
        </g>
        <text x="1810" y="172" font-size="22" font-weight="800" fill="#ffd56b">Палуба</text>
      </g>
    </svg>

    <header class="map-head">
      <small>Мёртвые копи · эскиз Dungeon Map Foundation</small>
      <h1>Чертёж шахты</h1>
    </header>

    <!-- nodes as HTML buttons: focusable, keyboard-friendly, scalable text -->
    <div class="map-nodes">
      <button v-for="n in nodes" :key="n.id" class="node" :class="'node--' + n.state" :style="{ left: pos(n.layer, n.lane).x / 19.2 + '%', top: pos(n.layer, n.lane).y / 10.8 + '%', '--c': meta[n.kind].tone }" :disabled="n.state === 'far' || n.state === 'done' || n.state === 'here'" :aria-label="meta[n.kind].name + (n.state === 'next' ? ' — доступно' : '')" @mouseenter="focus = n" @focus="focus = n" @click="$emit('enter')">
        <GlyphIcon :name="meta[n.kind].icon" />
        <span v-if="n.state === 'here'" class="cart" aria-hidden="true"><GlyphIcon name="cart" /></span>
      </button>
      <button class="node node--boss" :style="{ left: bossPos.x / 19.2 + '%', top: bossPos.y / 10.8 + '%', '--c': meta.B.tone }" disabled aria-label="Босс"><GlyphIcon name="crown" /></button>
    </div>

    <aside class="map-info" aria-live="polite">
      <span class="info-icon" :style="{ '--c': info.tone }"><GlyphIcon :name="info.icon" /></span>
      <span class="info-copy"><small>{{ focus ? 'Горизонт ' + (focus.layer + 1) : 'Финал' }}</small><strong>{{ info.name }}</strong><em>{{ info.text }}</em></span>
    </aside>
    <ul class="map-legend" aria-label="Легенда"><li v-for="k in (['F','E','R','K','M','T','?','N'] as NodeKind[])" :key="k" :style="{ '--c': meta[k].tone }"><GlyphIcon :name="meta[k].icon" /> {{ meta[k].name }}</li></ul>
    <footer class="map-party"><span>Отряд</span><b>Вариан 25/25</b><i>✦</i><b>Джайна 18/18</b><span class="gap">Колода: 18 карт</span></footer>
  </main>
</template>

<style scoped>
.map{position:absolute;inset:0;z-index:5;color:var(--text)}
.map-art{position:absolute;inset:0;width:100%;height:100%;display:block}
.pulse{animation:flow 1.1s linear infinite}
@keyframes flow{to{stroke-dashoffset:-16}}
.map-head{position:absolute;left:0;right:0;top:1.6rem;text-align:center;text-shadow:0 .2rem .6rem #000}
.map-head small{font:800 .8rem var(--f-ui);letter-spacing:.2em;text-transform:uppercase;color:#d9bf8a}
.map-head h1{margin:.1rem 0 0;font:800 2.6rem var(--f-display);color:#fff0c8}
.map-nodes{position:absolute;inset:0}
.node{--c:#d2674a;position:absolute;display:grid;place-items:center;width:4.9rem;height:4.9rem;margin:-2.45rem 0 0 -2.45rem;padding:0;border-radius:50%;border:.28rem solid #3a2412;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 60%,#fff),var(--c) 55%,color-mix(in srgb,var(--c) 50%,#000));box-shadow:0 .5rem .9rem #000b,inset 0 0 0 .14rem #ffffff55;color:#2a1208;font-size:2.4rem;transition:transform .2s var(--ease-out),filter .2s}
.node svg{filter:drop-shadow(0 .06rem 0 #fff7)}
.node--far{filter:grayscale(.75) brightness(.55);box-shadow:0 .3rem .6rem #000a}
.node--done{filter:grayscale(.4) brightness(.65)}
.node--here{box-shadow:0 0 0 .3rem #ffd56b,0 0 1.6rem #ffd56b,0 .5rem .9rem #000b}
.node--next{animation:node-pulse 1.4s ease-in-out infinite}
.node--next:hover,.node--next:focus-visible{transform:scale(1.18)}
@keyframes node-pulse{50%{box-shadow:0 0 0 .35rem #fff0b8aa,0 0 1.8rem #ffd56b,0 .5rem .9rem #000b}}
.node--boss{width:7.4rem;height:7.4rem;margin:-3.7rem 0 0 -3.7rem;font-size:3.6rem;border-color:#5a3a0c;filter:drop-shadow(0 0 1.3rem #ffb23d88)}
.cart{position:absolute;right:-1.2rem;bottom:-1.3rem;display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:.5rem;background:#2a1a10;border:.14rem solid #ffd56b;color:#ffd56b;font-size:1.6rem}
.map-info{position:absolute;left:50%;bottom:6.2rem;translate:-50% 0;display:flex;align-items:center;gap:1.2rem;width:44rem;padding:1rem 1.6rem 1rem 1rem;border-radius:.6rem 2rem .6rem 2rem;background:linear-gradient(160deg,var(--parch-1),var(--parch-2));color:var(--ink);box-shadow:0 .7rem 1.6rem #000c,0 0 0 .16rem var(--brass-3),0 0 0 .3rem #2b1f14}
.info-icon{--c:#d2674a;display:grid;place-items:center;flex:none;width:4.4rem;height:4.4rem;border-radius:50%;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 55%,#fff),var(--c) 60%,color-mix(in srgb,var(--c) 55%,#000));color:#2a1208;font-size:2.3rem;box-shadow:0 .25rem .5rem #0008}
.info-copy{display:flex;flex-direction:column;gap:.1rem}
.info-copy small{font:800 .7rem var(--f-ui);letter-spacing:.16em;text-transform:uppercase;color:#7a5a2c}
.info-copy strong{font:800 1.5rem var(--f-display)}
.info-copy em{font:600 .92rem/1.35 var(--f-ui);font-style:normal;color:#4a3318}
.map-legend{position:absolute;left:0;right:0;bottom:3.4rem;display:flex;justify-content:center;gap:1.1rem;margin:0;padding:0;list-style:none}
.map-legend li{--c:#fff;display:flex;align-items:center;gap:.35rem;font:700 .8rem var(--f-ui);color:#e6d6b2;text-shadow:0 .1rem .2rem #000}
.map-legend svg{width:1.3rem;height:1.3rem;color:var(--c)}
.map-party{position:absolute;left:50%;bottom:.9rem;translate:-50% 0;display:flex;align-items:center;gap:1rem;padding:.4rem 1.4rem;border-radius:2rem;background:#1a110bf0;border:.14rem solid var(--brass-3);font:700 .95rem var(--f-ui)}
.map-party span{font:800 .7rem var(--f-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--text-dim)}
.map-party i{color:var(--brass-2);font-style:normal}
.map-party .gap{margin-left:1rem}
@media (max-height:820px){.map-info{bottom:5.2rem;width:38rem}.map-legend{bottom:3rem;gap:.8rem}.map-head h1{font-size:2rem}}
</style>
