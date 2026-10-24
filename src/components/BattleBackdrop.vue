<script setup lang="ts">
// The Deadmines as a stage with three planes, drawn in SVG (no image assets): a far mine shaft that recedes to a warm lit opening
// with a hint of violet crystal, the middle plane with timber frames, lanterns, crates and an ore cart, and a near plane of rock
// at the corners. The timber frames are generated from one perspective rule, so the tunnel stays consistent at every size.
// It only paints: characters stand on the floor line (y = 540 of 600) and the hand covers everything below the arena.
// Moods (calm / enemy turn / elite / boss / second phase) arrive as CSS classes of the scene and recolour the glow through
// --glow-core, --glow-lamp and --glow-far, so the backdrop itself has no state.
import { computed } from 'vue'

const VP = { x: 800, y: 262 }
const scales = [0.13, 0.19, 0.28, 0.41, 0.6, 0.86, 1.04]
interface Rect { x0: number; y0: number; x1: number; y1: number; s: number }
const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
/** Colour of a plane at depth t (0 far … 1 near): cool and hazy far away, warm brown close up. */
const tone = (far: [number, number, number], near: [number, number, number], t: number) => hex(mix(far[0], near[0], t), mix(far[1], near[1], t), mix(far[2], near[2], t))

const rects = computed<Rect[]>(() => scales.map(s => ({ s, x0: VP.x - 780 * s, x1: VP.x + 780 * s, y0: VP.y - 215 * s, y1: VP.y + 300 * s })))
const bands = computed(() => rects.value.slice(0, -1).map((inner, i) => {
  const outer = rects.value[i + 1]!
  const t = (i + 1) / (rects.value.length - 1)
  return {
    key: i,
    floor: `M${outer.x0} ${outer.y1}L${outer.x1} ${outer.y1}L${inner.x1} ${inner.y1}L${inner.x0} ${inner.y1}Z`,
    ceiling: `M${outer.x0} ${outer.y0}L${outer.x1} ${outer.y0}L${inner.x1} ${inner.y0}L${inner.x0} ${inner.y0}Z`,
    left: `M${outer.x0} ${outer.y0}L${inner.x0} ${inner.y0}L${inner.x0} ${inner.y1}L${outer.x0} ${outer.y1}Z`,
    right: `M${outer.x1} ${outer.y0}L${inner.x1} ${inner.y0}L${inner.x1} ${inner.y1}L${outer.x1} ${outer.y1}Z`,
    floorFill: tone([30, 36, 42], [70, 50, 34], t),
    wallFill: tone([26, 32, 38], [46, 38, 34], t),
    ceilFill: tone([20, 26, 32], [30, 26, 24], t),
  }
}))
const frames = computed(() => rects.value.map((r, i) => {
  const t = i / (rects.value.length - 1)
  const w = Math.max(3, 62 * r.s)
  return {
    key: i, w, color: tone([44, 58, 68], [104, 70, 38], t), shade: tone([22, 30, 38], [52, 32, 16], t), opacity: 0.55 + 0.45 * t,
    d: `M${r.x0} ${r.y1}V${r.y0 + 14 * r.s}Q${r.x0} ${r.y0} ${r.x0 + 14 * r.s} ${r.y0}H${r.x1 - 14 * r.s}Q${r.x1} ${r.y0} ${r.x1} ${r.y0 + 14 * r.s}V${r.y1}`,
    tie: `M${r.x0 - w / 2} ${r.y1}H${r.x1 + w / 2}`,
  }
}))
/** Stone courses on the walls and boards on the floor: lines that run from the near corner to the vanishing point. */
const lines = computed(() => {
  const near = rects.value[rects.value.length - 1]!
  const walls = [0.14, 0.34, 0.56, 0.78].flatMap(f => [`M${near.x0} ${near.y0 + (near.y1 - near.y0) * f}L${VP.x} ${VP.y}`, `M${near.x1} ${near.y0 + (near.y1 - near.y0) * f}L${VP.x} ${VP.y}`])
  const boards = [-1.4, -0.9, -0.45, 0, 0.45, 0.9, 1.4].map(f => `M${VP.x + f * 560} ${near.y1}L${VP.x} ${VP.y}`)
  return { walls: walls.join(''), boards: boards.join('') }
})
const rails = computed(() => {
  const near = rects.value[rects.value.length - 1]!
  return [-0.2, 0.2].map(f => `M${VP.x + f * 780} ${near.y1}L${VP.x} ${VP.y}`)
})
const sleepers = computed(() => Array.from({ length: 9 }, (_, i) => {
  const t = (i + 1) / 10
  const y = VP.y + (540 - VP.y) * t * t
  const half = 0.2 * 780 * ((y - VP.y) / (540 - VP.y)) + 22 * t
  return `M${VP.x - half} ${y.toFixed(1)}H${VP.x + half}`
}).join(''))
</script>

<template>
  <svg class="backdrop" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-backdrop>
    <defs>
      <radialGradient id="bb-far" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:var(--glow-far)" stop-opacity=".95" /><stop offset=".45" style="stop-color:var(--glow-far)" stop-opacity=".35" /><stop offset="1" style="stop-color:var(--glow-far)" stop-opacity="0" /></radialGradient>
      <radialGradient id="bb-lamp" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:var(--glow-lamp)" stop-opacity=".95" /><stop offset=".35" style="stop-color:var(--glow-lamp)" stop-opacity=".4" /><stop offset="1" style="stop-color:var(--glow-lamp)" stop-opacity="0" /></radialGradient>
      <radialGradient id="bb-core" cx="50%" cy="46%" r="62%"><stop offset="0" style="stop-color:var(--glow-core)" stop-opacity=".34" /><stop offset=".5" style="stop-color:var(--glow-core)" stop-opacity=".04" /><stop offset="1" stop-color="#05080a" stop-opacity=".72" /></radialGradient>
      <linearGradient id="bb-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#0a0604" stop-opacity=".55" /></linearGradient>
      <pattern id="bb-grain" width="46" height="9" patternUnits="userSpaceOnUse"><path d="M0 2H46M0 6.5H30M36 6.5H46" stroke="#000" stroke-opacity=".22" stroke-width="1.2" fill="none" /><path d="M0 4.2H46" stroke="#fff" stroke-opacity=".05" stroke-width="1" fill="none" /></pattern>
      <linearGradient id="bb-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6034" /><stop offset=".5" stop-color="#6a4626" /><stop offset="1" stop-color="#4a2f18" /></linearGradient>
      <linearGradient id="bb-rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3835" /><stop offset="1" stop-color="#14181b" /></linearGradient>
    </defs>

    <!-- far plane: the shaft and its lit opening -->
    <rect width="1600" height="600" fill="#101519" />
    <g class="plane-far">
      <g v-for="band in bands" :key="band.key">
        <path :d="band.ceiling" :fill="band.ceilFill" /><path :d="band.left" :fill="band.wallFill" /><path :d="band.right" :fill="band.wallFill" /><path :d="band.floor" :fill="band.floorFill" />
      </g>
      <path :d="lines.walls" stroke="#000" stroke-opacity=".2" stroke-width="1.4" fill="none" />
      <path :d="lines.boards" stroke="#000" stroke-opacity=".22" stroke-width="1.4" fill="none" />
      <ellipse :cx="VP.x" :cy="VP.y" rx="150" ry="104" fill="url(#bb-far)" />
      <g class="crystals" aria-hidden="true">
        <path d="M770 262l9-30 9 30z M788 262l7-44 8 44z M806 262l6-26 7 26z" fill="#a98cf2" fill-opacity=".85" /><path d="M788 262l7-44v44z" fill="#fff" fill-opacity=".28" />
        <ellipse cx="796" cy="262" rx="46" ry="12" fill="#8f6cf0" fill-opacity=".28" />
      </g>
    </g>

    <!-- rails and sleepers leading into the shaft -->
    <g fill="none" stroke-linecap="round">
      <path :d="sleepers" stroke="#3a2614" stroke-width="7" stroke-opacity=".75" />
      <path v-for="(d, i) in rails" :key="i" :d="d" stroke="#8d7a5e" stroke-width="5" stroke-opacity=".7" />
      <path v-for="(d, i) in rails" :key="'h' + i" :d="d" stroke="#e8d3a6" stroke-width="1.6" stroke-opacity=".35" transform="translate(-1.5 -1.5)" />
    </g>

    <!-- middle plane: timber frames from far to near -->
    <g class="plane-mid">
      <g v-for="frame in frames" :key="frame.key" :opacity="frame.opacity">
        <path :d="frame.tie" :stroke="frame.shade" :stroke-width="frame.w * .5" stroke-linecap="round" fill="none" />
        <path :d="frame.d" :stroke="frame.shade" :stroke-width="frame.w + 3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <path :d="frame.d" :stroke="frame.color" :stroke-width="frame.w" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <path :d="frame.d" stroke="url(#bb-grain)" :stroke-width="frame.w" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".7" />
      </g>
      <!-- braces on the nearest frame -->
      <path d="M96 520L300 372M1504 520L1300 372" stroke="#3a2412" stroke-width="30" stroke-linecap="round" fill="none" />
      <path d="M96 520L300 372M1504 520L1300 372" stroke="url(#bb-wood)" stroke-width="24" stroke-linecap="round" fill="none" /><path d="M96 520L300 372M1504 520L1300 372" stroke="url(#bb-grain)" stroke-width="24" stroke-linecap="round" fill="none" opacity=".6" />
    </g>

    <!-- props: crates, barrels, an ore cart on the right-hand rail -->
    <g class="props">
      <g transform="translate(70 470)"><rect width="110" height="88" rx="9" fill="#5a3a1c" /><rect x="5" y="5" width="100" height="78" rx="6" fill="url(#bb-wood)" /><path d="M5 30H105M5 56H105M30 5V83M80 5V83" stroke="#2c1a0b" stroke-opacity=".6" stroke-width="3" /><rect x="22" y="-52" width="76" height="56" rx="8" fill="url(#bb-wood)" stroke="#3a2412" stroke-width="3" /><path d="M22 -26H98M60 -52V4" stroke="#2c1a0b" stroke-opacity=".6" stroke-width="3" /></g>
      <g transform="translate(1448 466)"><ellipse cx="46" cy="92" rx="48" ry="9" fill="#000" fill-opacity=".35" /><path d="M6 14Q-4 52 6 90H86Q96 52 86 14Z" fill="url(#bb-wood)" stroke="#3a2412" stroke-width="3" /><path d="M2 32Q46 44 90 32M0 66Q46 78 92 66" stroke="#2a2018" stroke-width="7" fill="none" /><ellipse cx="46" cy="14" rx="40" ry="10" fill="#3a2412" /><ellipse cx="46" cy="14" rx="34" ry="7" fill="#1a0e06" /></g>
      <g transform="translate(1126 372)"><ellipse cx="82" cy="78" rx="92" ry="9" fill="#000" fill-opacity=".35" /><path d="M0 18H164L148 70H16Z" fill="#4a3a30" stroke="#2a1d16" stroke-width="3" stroke-linejoin="round" /><path d="M0 18H164" stroke="#a88a58" stroke-width="7" stroke-linecap="round" /><path d="M16 70H148" stroke="#1e1410" stroke-width="5" /><circle cx="42" cy="76" r="12" fill="#2a1d16" stroke="#a88a58" stroke-width="3" /><circle cx="122" cy="76" r="12" fill="#2a1d16" stroke="#a88a58" stroke-width="3" /><path d="M24 18l12-20 14 20zM58 18l14-30 14 30zM96 18l10-18 14 18z" fill="#c8a24e" /><path d="M58 18l14-30v30zM24 18l12-20v20z" fill="#fff" fill-opacity=".2" /><path d="M110 18l6-12 8 12z" fill="#a98cf2" /></g>
    </g>

    <!-- lights -->
    <g class="lamps">
      <g v-for="x in [330, 1270]" :key="x">
        <circle class="lamp-glow" :cx="x" cy="132" r="230" fill="url(#bb-lamp)" />
        <path :d="`M${x} 46V96`" stroke="#2a1a0c" stroke-width="4" /><path :d="`M${x - 3} 52v8M${x + 3} 62v8M${x - 3} 72v8M${x + 3} 82v8`" stroke="#8d7a5e" stroke-width="3" stroke-linecap="round" />
        <rect :x="x - 15" y="96" width="30" height="44" rx="11" fill="#2a1a0c" stroke="#b58a46" stroke-width="3" /><rect :x="x - 9" y="102" width="18" height="32" rx="8" fill="#ffe0a0" /><rect :x="x - 9" y="102" width="18" height="32" rx="8" fill="#ff9a3a" fill-opacity=".45" />
        <path :d="`M${x - 14} 96h28`" stroke="#d9b062" stroke-width="5" stroke-linecap="round" />
      </g>
      <circle class="lamp-glow lamp-glow--far" cx="590" cy="190" r="70" fill="url(#bb-lamp)" /><circle class="lamp-glow lamp-glow--far" cx="1010" cy="190" r="70" fill="url(#bb-lamp)" />
    </g>

    <!-- floor light under the fighters, then the near plane -->
    <ellipse class="pool pool-enemy" cx="800" cy="470" rx="330" ry="58" />
    <ellipse class="pool pool-warrior" cx="400" cy="548" rx="180" ry="30" /><ellipse class="pool pool-mage" cx="1200" cy="548" rx="180" ry="30" />
    <rect y="300" width="1600" height="300" fill="url(#bb-floor)" />
    <rect width="1600" height="600" fill="url(#bb-core)" />
    <path d="M0 600V452Q40 430 96 462Q150 490 200 560V600Z" fill="url(#bb-rock)" /><path d="M1600 600V440Q1556 424 1506 460Q1450 494 1400 562V600Z" fill="url(#bb-rock)" />
    <path d="M0 0H190Q120 40 96 120Q70 200 0 250Z" fill="#0c1013" fill-opacity=".55" /><path d="M1600 0H1410Q1480 40 1504 120Q1530 200 1600 250Z" fill="#0c1013" fill-opacity=".55" />
  </svg>
</template>

<style scoped>
.backdrop{position:absolute;left:0;right:0;top:0;bottom:var(--hand-height);width:100%;height:calc(100% - var(--hand-height));pointer-events:none;
  --glow-core:var(--scene-core,#ffb866);--glow-lamp:var(--scene-lamp,#ffb054);--glow-far:var(--scene-far,#ffd890)}
.pool{fill:var(--glow-lamp);fill-opacity:.17}
.pool-enemy{fill-opacity:.2}
.pool-mage{fill:#9c8cff;fill-opacity:.14}
.lamp-glow{transform-box:fill-box;transform-origin:center;animation:lamp 6s ease-in-out infinite}
.lamp-glow--far{animation-delay:-2.4s}
@keyframes lamp{50%{opacity:.82;transform:scale(.96)}}
</style>
