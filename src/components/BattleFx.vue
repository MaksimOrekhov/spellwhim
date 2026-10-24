<script setup lang="ts">
// The PixiJS layer of the battle: it draws a VfxPlan (src/vfx/plan.ts) and nothing else. The plan was derived from the engine's own numbers,
// so this component holds no rules; its single contact with the game is the `impact` event with the action ID, reported once when the
// plan's blow lands. All timing runs on the runtime's own clock (one ticker callback), and a new plan, a new battle or an unmount clears it.
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import { Application } from 'pixi.js'
import { paintBeat } from '../vfx/painters'
import { runPlan } from '../vfx/run'
import { FxRuntime } from '../vfx/runtime'
import type { FxStats } from '../vfx/runtime'
import type { VfxPlan } from '../vfx/types'
import { gameAudio } from '../audio/engine'

const props = defineProps<{ pulse: number; actionId: string | null; plan: VfxPlan | null; soundActive?: boolean; /** Lab only: playback speed and a moment of the plan to freeze at. */ speed?: number; hold?: number | null }>()
const emit = defineEmits<{ impact: [actionId: string] }>()
const canvasHost = useTemplateRef<HTMLDivElement>('canvasHost')
let app: Application | null = null
let fx: FxRuntime | null = null
let resizeObserver: ResizeObserver | null = null
let disposed = false
let soundScope = ''

onMounted(async () => {
  const instance = new Application()
  try { await instance.init({ backgroundAlpha: 0, antialias: true, autoDensity: true, autoStart: false, resolution: Math.min(window.devicePixelRatio || 1, 2), resizeTo: canvasHost.value! }) }
  catch { return /* the existing game fallback timer resolves the action without WebGL */ }
  if (disposed || !canvasHost.value) { instance.destroy(true); return }
  app = instance
  canvasHost.value.appendChild(instance.canvas)
  fx = new FxRuntime(instance, canvasHost.value)
  fx.setPainter(paintBeat)
  resizeObserver = new ResizeObserver(() => {
    if (app && canvasHost.value) { app.renderer.resize(canvasHost.value.clientWidth, canvasHost.value.clientHeight); fx?.measure() }
  })
  resizeObserver.observe(canvasHost.value)
  document.addEventListener('visibilitychange', onVisible)
  // A development hook for the lab and for browser checks: nothing in the game reads it.
  if (import.meta.env.DEV) (window as unknown as { __fx?: () => FxStats | null }).__fx = () => fx?.stats() ?? null
  trigger()
})

// A hidden tab stops the canvas clock while the game moves on through its own timers: showing the leftovers later would draw hits that already happened.
function onVisible() { fx?.clear(); if (soundScope) gameAudio.stopScope(soundScope) }

onUnmounted(() => {
  disposed = true
  if (soundScope) gameAudio.stopScope(soundScope)
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisible)
  if (import.meta.env.DEV) delete (window as unknown as { __fx?: unknown }).__fx
  if (app) {
    fx?.destroy()
    fx = null
    app.ticker.stop()
    app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
    app = null
  }
})

function trigger() {
  if (soundScope) gameAudio.stopScope(soundScope)
  if (!fx) return
  const plan = props.plan
  const actionId = props.actionId
  fx.begin(plan ? plan.scenario + '|' + actionId : '', plan?.motion === 'reduced')
  if (!plan || !actionId) return
  fx.timeScale = props.speed ?? 1
  fx.holdAt = props.hold ?? null
  const runtime = fx
  const pulse = props.pulse
  soundScope = `vfx/${actionId}/${pulse}`
  const scope = soundScope
  runPlan(plan, runtime, {
    current: () => !disposed && fx === runtime && props.actionId === actionId && props.pulse === pulse && !document.hidden,
    onImpact: () => emit('impact', actionId),
    onSound: cue => { if (props.soundActive !== false && props.hold == null) gameAudio.play(cue.sound, cue.gain, scope) },
  })
}
watch(() => props.pulse, trigger, { flush: 'post' })
</script>

<template><div ref="canvasHost" class="battle-fx" aria-hidden="true" /></template>
