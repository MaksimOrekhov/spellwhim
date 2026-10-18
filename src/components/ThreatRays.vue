<script setup lang="ts">
// A curved, animated ray from the enemy's intent banner to each threatened hero. Positions are read from the
// [data-threat-source] / [data-threat-target] elements, the same idea as BattleFx's [data-fx-anchor], so the ray follows
// the layout at any window size. The ray lives in a DOM layer under the Pixi canvas, so it never covers the effects.
// A prepared strike ("later") draws a dashed, dimmer ray: the viewer can tell a hit that lands now from one that is coming.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { HeroId } from '../game/types'

const props = defineProps<{ targets: HeroId[]; later?: boolean; lethal?: HeroId[]; tick: string }>()
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
    const sx = (leftSide ? intent.left + 6 : intent.right - 6) - base.left
    const sy = intent.top + intent.height * 0.62 - base.top
    const ex = arch.left + arch.width / 2 - base.left + (leftSide ? arch.width * 0.2 : -arch.width * 0.2)
    const ey = arch.top - base.top + arch.height * 0.2
    const cx = (sx + ex) / 2
    const cy = Math.min(sy, ey) - Math.abs(ex - sx) * 0.12 + 40
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
    <defs><filter id="ray-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter></defs>
    <g v-for="p in paths" :key="p.id" :class="{ later, lethal: lethal?.includes(p.id) }" :data-ray="p.id">
      <path :d="p.d" class="ray-glow" filter="url(#ray-glow)" />
      <path :d="p.d" class="ray" />
      <circle :cx="p.x" :cy="p.y" r="7" class="ray-dot" />
    </g>
  </svg>
</template>

<style scoped>
.rays{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;overflow:visible}
.ray,.ray-glow{fill:none;stroke:var(--c-threat);stroke-width:5;stroke-linecap:round;stroke-dasharray:3 16;animation:flow 1.1s linear infinite}
.ray-glow{stroke-width:11;opacity:.55;stroke-dasharray:none;animation:none}
.ray-dot{fill:var(--c-threat);stroke:var(--ink);stroke-width:2.5}
.lethal .ray,.lethal .ray-glow,.lethal .ray-dot{stroke:var(--c-lethal)}
.lethal .ray-dot{fill:var(--c-lethal)}
.later .ray{stroke:var(--c-later-line);stroke-dasharray:2 14;opacity:.75}
.later .ray-glow{opacity:.2;stroke:var(--c-later-line)}
.later .ray-dot{fill:var(--c-later-line)}
@keyframes flow{to{stroke-dashoffset:-19}}
</style>
