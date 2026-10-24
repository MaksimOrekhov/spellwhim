<script setup lang="ts">
// A thin curved ray from the enemy's intent banner to the inner shoulder of each threatened hero, where the threat marker sits.
// Positions are read from the [data-threat-source] / [data-threat-target] elements, the same idea as BattleFx's [data-fx-anchor],
// so the ray follows the layout at any window size. The ray lives in a DOM layer under the Pixi canvas, so it never covers the effects.
// It is quiet by default: a steady line, dashed and dimmer for a strike that is only being prepared, and it flows only while the
// enemy's action is being carried out (`executing`).
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { HeroId } from '../game/types'

const props = defineProps<{ targets: HeroId[]; later?: boolean; lethal?: HeroId[]; tick: string; executing?: boolean }>()
const svg = ref<SVGSVGElement | null>(null)
const paths = ref<{ id: HeroId; d: string; x: number; y: number }[]>([])
let observer: ResizeObserver | undefined
let frame = 0

function measure() {
  const root = svg.value?.parentElement
  if (!root) return
  const base = root.getBoundingClientRect()
  const intent = root.querySelector('[data-threat-source="intent"]')?.getBoundingClientRect()
  if (!intent || !props.targets.length) { paths.value = []; return }
  paths.value = props.targets.flatMap(id => {
    const arch = root.querySelector(`[data-threat-target="${id}"]`)?.getBoundingClientRect()
    if (!arch) return []
    const leftSide = arch.left + arch.width / 2 < intent.left + intent.width / 2
    const sx = (leftSide ? intent.left + 4 : intent.right - 4) - base.left
    const sy = intent.top + intent.height * 0.5 - base.top
    // The inner shoulder of the arch, at the height of the marker.
    const ex = (leftSide ? arch.right - arch.width * 0.04 : arch.left + arch.width * 0.04) - base.left
    const ey = arch.top - base.top + arch.height * 0.34
    const cx = (sx + ex) / 2
    const cy = Math.min(sy, ey) - Math.abs(ex - sx) * 0.16
    return [{ id, d: `M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`, x: ex, y: ey }]
  })
}
function schedule() {
  void nextTick(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) })
}
onMounted(() => { schedule(); observer = new ResizeObserver(schedule); if (svg.value?.parentElement) observer.observe(svg.value.parentElement) })
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame) })
watch(() => [props.targets.join(), props.tick, props.later], schedule)
</script>

<template>
  <svg ref="svg" class="rays" aria-hidden="true" data-testid="threat-rays">
    <g v-for="p in paths" :key="p.id" :class="{ later, lethal: lethal?.includes(p.id), executing }" :data-ray="p.id">
      <path :d="p.d" class="ray-glow" />
      <path :d="p.d" class="ray" />
      <circle :cx="p.x" :cy="p.y" r="5" class="ray-dot" />
    </g>
  </svg>
</template>

<style scoped>
.rays{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;overflow:visible}
.ray,.ray-glow{fill:none;stroke:var(--c-threat);stroke-width:3;stroke-linecap:round}
.ray-glow{stroke-width:8;opacity:.22}
.ray-dot{fill:var(--c-threat);stroke:var(--ink);stroke-width:2}
.lethal .ray,.lethal .ray-glow,.lethal .ray-dot{stroke:var(--c-lethal)}
.lethal .ray-dot{fill:var(--c-lethal)}
.later .ray{stroke:var(--c-later-line);stroke-dasharray:2 12;opacity:.8}
.later .ray-glow{opacity:.1;stroke:var(--c-later-line)}
.later .ray-dot{fill:var(--c-later-line)}
.executing .ray{stroke-dasharray:3 14;animation:flow 1.1s linear infinite}
@keyframes flow{to{stroke-dashoffset:-17}}
</style>
