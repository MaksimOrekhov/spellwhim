<script setup lang="ts">
// Procedural painted-look backdrop (SVG only — no new raster art). Layers: sky glow, haze trees, lit mid trees with
// leaf puffs, god rays, mossy ground, a rune dais that "holds" the combatants, framing trunks, fireflies, vignette.
// Replace with a real 1920×1080 illustration (bg-* in ASSET_MANIFEST) when it exists; the layout keeps calm zones for the HUD.
import { computed } from 'vue'

const props = withDefaults(defineProps<{ dim?: number; focusX?: number }>(), { dim: 0, focusX: 960 })

function rng(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296 } }

interface Puff { cx: number; cy: number; r: number; tone: number }
interface Tree { x: number; wb: number; wt: number; top: number; bottom: number; lean: number; puffs: Puff[]; streaks: number[] }
function forest(seed: number, xs: number[], wb: [number, number], top: number, bottom: number, puffCount: number, puffR: [number, number], spread: number): Tree[] {
  const rand = rng(seed)
  return xs.map(x => {
    const base = wb[0] + rand() * (wb[1] - wb[0])
    const t = top + rand() * 90
    const lean = (rand() - 0.5) * 40
    const puffs = Array.from({ length: puffCount }, () => ({ cx: x + lean + (rand() - 0.5) * spread, cy: t + (rand() - 0.35) * spread * 0.42, r: puffR[0] + rand() * (puffR[1] - puffR[0]), tone: rand() }))
    return { x, wb: base, wt: base * 0.55, top: t, bottom, lean, puffs, streaks: [0.25, 0.5, 0.72].map(f => f + (rand() - 0.5) * 0.1) }
  })
}
const far = computed(() => forest(11, [40, 170, 300, 430, 560, 690, 1230, 1360, 1490, 1620, 1750, 1880], [26, 44], 90, 700, 7, [34, 62], 220))
const mid = computed(() => forest(23, [90, 300, 560, 1360, 1620, 1840], [78, 128], -30, 800, 13, [58, 112], 420))
const flies = computed(() => { const r = rng(5); return Array.from({ length: 26 }, () => ({ x: r() * 1920, y: 260 + r() * 640, s: 2 + r() * 3.5, d: 6 + r() * 8, o: -r() * 10 })) })
const rays = [-520, -300, -90, 140, 380, 640].map((dx, i) => ({ d: `M${960 + dx * 0.08} -40 L${960 + dx - 70} 900 L${960 + dx + 90} 900 Z`, o: 0.55 + (i % 3) * 0.15, delay: -i * 1.7 }))
const tufts = computed(() => { const r = rng(31); return Array.from({ length: 70 }, () => { const a = r() * Math.PI * 2; return { x: 960 + Math.cos(a) * (700 + r() * 220), y: 772 + Math.sin(a) * (150 + r() * 36), h: 10 + r() * 18 } }) })
const veil = computed(() => props.dim)
const trunkPath = (t: Tree) => `M${t.x - t.wb / 2} ${t.bottom} Q${t.x - t.wb / 2 + 8 + t.lean * 0.4} ${(t.top + t.bottom) / 2} ${t.x - t.wt / 2 + t.lean} ${t.top + 60} L${t.x + t.wt / 2 + t.lean} ${t.top + 60} Q${t.x + t.wb / 2 + 8 + t.lean * 0.4} ${(t.top + t.bottom) / 2} ${t.x + t.wb / 2} ${t.bottom} Z`
</script>

<template>
  <svg class="backdrop" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16314a"/><stop offset=".3" stop-color="#2b6572"/><stop offset=".54" stop-color="#8dbb94"/><stop offset=".64" stop-color="#f3d38c"/><stop offset="1" stop-color="#4c8657"/></linearGradient>
      <radialGradient id="bd-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff0b8" stop-opacity=".95"/><stop offset=".35" stop-color="#ffd37a" stop-opacity=".45"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
      <linearGradient id="bd-trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1f1c"/><stop offset=".55" stop-color="#4a3626"/><stop offset="1" stop-color="#8c6c42"/></linearGradient>
      <linearGradient id="bd-trunk-r" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#2a1f1c"/><stop offset=".55" stop-color="#4a3626"/><stop offset="1" stop-color="#8c6c42"/></linearGradient>
      <radialGradient id="bd-leaf-dark" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#2f8a63"/><stop offset="1" stop-color="#14473f"/></radialGradient>
      <radialGradient id="bd-leaf-mid" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#6cc58a"/><stop offset="1" stop-color="#2a7d5e"/></radialGradient>
      <radialGradient id="bd-leaf-far" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#9ad2a6"/><stop offset="1" stop-color="#4f9a86"/></radialGradient>
      <linearGradient id="bd-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ccb70"/><stop offset=".22" stop-color="#5a9a58"/><stop offset="1" stop-color="#173f35"/></linearGradient>
      <radialGradient id="bd-dais" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#9c9468"/><stop offset=".65" stop-color="#6c6a48"/><stop offset="1" stop-color="#3f4430"/></radialGradient>
      <linearGradient id="bd-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c4" stop-opacity=".55"/><stop offset="1" stop-color="#fff4c4" stop-opacity="0"/></linearGradient>
      <radialGradient id="bd-vignette" cx=".5" cy=".45" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05110f" stop-opacity=".72"/></radialGradient>
      <filter id="bd-paint" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="16"/></filter>
      <filter id="bd-soft"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="bd-haze"><feGaussianBlur stdDeviation="2.5"/></filter>
    </defs>
    <rect width="1920" height="1080" fill="url(#bd-sky)"/>
    <ellipse :cx="focusX" cy="560" rx="760" ry="420" fill="url(#bd-glow)"/>
    <!-- distant haze trees -->
    <g opacity=".7" filter="url(#bd-haze)">
      <g v-for="(t, i) in far" :key="'f' + i">
        <path :d="trunkPath(t)" fill="#3d6f74"/>
        <g filter="url(#bd-paint)"><circle v-for="(c, j) in t.puffs" :key="j" :cx="c.cx" :cy="c.cy + 100" :r="c.r" fill="url(#bd-leaf-far)"/></g>
      </g>
    </g>
    <!-- god rays -->
    <g class="rays" style="mix-blend-mode:screen">
      <path v-for="(r, i) in rays" :key="i" :d="r.d" fill="url(#bd-ray)" :style="{ opacity: r.o * 0.34, animationDelay: r.delay + 's' }" filter="url(#bd-soft)"/>
    </g>
    <!-- mid trees: bark trunks lit from the centre + layered leaf puffs -->
    <g>
      <g v-for="(t, i) in mid" :key="'m' + i">
        <path :d="trunkPath(t)" :fill="t.x < 960 ? 'url(#bd-trunk-r)' : 'url(#bd-trunk)'" filter="url(#bd-paint)"/>
        <path v-for="(_s, k) in t.streaks" :key="k" :d="`M${t.x - t.wb * 0.3 + k * t.wb * 0.28} ${t.bottom} Q${t.x - t.wb * 0.2 + k * t.wb * 0.2 + t.lean * 0.3} ${(t.top + t.bottom) / 2} ${t.x - t.wt * 0.2 + k * t.wt * 0.2 + t.lean} ${t.top + 80}`" fill="none" stroke="#1d1410" stroke-width="5" opacity=".28" stroke-linecap="round"/>
        <path :d="`M${t.x + (t.x < 960 ? t.wb / 2 : -t.wb / 2) } ${t.bottom} Q${t.x + (t.x < 960 ? t.wb / 2 : -t.wb / 2) + 10} ${(t.top + t.bottom) / 2} ${t.x + t.lean + (t.x < 960 ? t.wt / 2 : -t.wt / 2)} ${t.top + 60}`" fill="none" stroke="#ffe7a8" stroke-width="4" opacity=".4" stroke-linecap="round"/>
        <g filter="url(#bd-paint)">
          <circle v-for="(c, j) in t.puffs" :key="'d' + j" :cx="c.cx" :cy="c.cy" :r="c.r" fill="url(#bd-leaf-dark)"/>
          <circle v-for="(c, j) in t.puffs" :key="'m' + j" :cx="c.cx + (t.x < 960 ? c.r * 0.22 : -c.r * 0.22)" :cy="c.cy - c.r * 0.18" :r="c.r * 0.68" fill="url(#bd-leaf-mid)" :opacity="0.55 + c.tone * 0.4"/>
          <circle v-for="(c, j) in t.puffs" :key="'h' + j" :cx="c.cx + (t.x < 960 ? c.r * 0.34 : -c.r * 0.34)" :cy="c.cy - c.r * 0.34" :r="c.r * 0.28" fill="#c9f0a4" :opacity="0.18 + c.tone * 0.28"/>
        </g>
      </g>
    </g>
    <!-- ground -->
    <path d="M-40 640Q320 560 700 600T1300 590T1960 620V1100H-40Z" fill="url(#bd-ground)" filter="url(#bd-paint)"/>
    <path d="M-40 720Q420 650 960 690T1960 700V1100H-40Z" fill="#2c6b4a" opacity=".5"/>
    <!-- rune dais -->
    <g>
      <ellipse cx="960" cy="800" rx="900" ry="205" fill="#0b1f1a" opacity=".5" filter="url(#bd-soft)"/>
      <ellipse cx="960" cy="772" rx="860" ry="186" fill="url(#bd-dais)"/>
      <ellipse cx="960" cy="772" rx="860" ry="186" fill="none" stroke="#3a3a28" stroke-width="16" stroke-dasharray="46 6" opacity=".55"/>
      <ellipse cx="960" cy="772" rx="860" ry="186" fill="none" stroke="#e8c978" stroke-width="3" opacity=".5"/>
      <ellipse cx="960" cy="772" rx="700" ry="150" fill="none" stroke="#e8c978" stroke-width="2" stroke-dasharray="4 14" opacity=".5"/>
      <ellipse cx="960" cy="772" rx="470" ry="100" fill="none" stroke="#fff0b8" stroke-width="1.5" opacity=".28"/>
      <g stroke="#5db36a" stroke-width="3" stroke-linecap="round" opacity=".85"><path v-for="(t, i) in tufts" :key="i" :d="`M${t.x} ${t.y} l-4 ${-t.h} M${t.x} ${t.y} l0 ${-t.h * 1.2} M${t.x} ${t.y} l5 ${-t.h * 0.9}`" fill="none"/></g>
    </g>
    <!-- framing trunks and canopy -->
    <path d="M-30 1100Q150 760 120 360Q60 240 -40 220V-40H260Q220 120 250 260Q320 420 250 700Q230 880 330 1100Z" fill="#241b17" filter="url(#bd-paint)"/>
    <path d="M1950 1100Q1770 760 1800 360Q1860 240 1960 220V-40H1660Q1700 120 1670 260Q1600 420 1670 700Q1690 880 1590 1100Z" fill="#241b17" filter="url(#bd-paint)"/>
    <g filter="url(#bd-paint)"><path d="M-40 -30H640Q540 150 340 150Q170 240 -40 170Z" fill="#184c42"/><path d="M1960 -30H1280Q1380 150 1580 150Q1750 240 1960 170Z" fill="#184c42"/><path d="M-40 -30H450Q380 80 230 90Q90 150 -40 110Z" fill="#2c7a5c"/><path d="M1960 -30H1470Q1540 80 1690 90Q1830 150 1960 110Z" fill="#2c7a5c"/><path d="M-40 60Q200 40 330 130Q200 200 -40 150Z" fill="#3d9a6b" opacity=".8"/><path d="M1960 60Q1720 40 1590 130Q1720 200 1960 150Z" fill="#3d9a6b" opacity=".8"/></g>
    <!-- fireflies -->
    <g class="flies"><circle v-for="(f, i) in flies" :key="i" :cx="f.x" :cy="f.y" :r="f.s" fill="#fff2a8" :style="{ animationDuration: f.d + 's', animationDelay: f.o + 's' }"/></g>
    <rect width="1920" height="1080" fill="url(#bd-vignette)"/>
    <rect v-if="veil" width="1920" height="1080" fill="#0b1418" :opacity="veil"/>
  </svg>
</template>

<style scoped>
.backdrop{position:absolute;inset:0;width:100%;height:100%;display:block}
.rays path{animation:ray 9s ease-in-out infinite}
@keyframes ray{50%{opacity:.12!important}}
.flies circle{filter:drop-shadow(0 0 6px #ffe98a);animation:fly linear infinite;opacity:.8}
@keyframes fly{0%{transform:translate(0,0);opacity:.15}25%{opacity:.95}50%{transform:translate(40px,-60px);opacity:.3}75%{opacity:.9}100%{transform:translate(-20px,-120px);opacity:.1}}
</style>
