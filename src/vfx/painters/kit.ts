import { easeOut, glowDisc, ring } from '../draw'
import { palette } from '../palette'
import type { ParticleShape } from '../particles'
import type { FxRuntime } from '../runtime'
import type { VfxBeat } from '../types'

/** The beat of one kind, for painters that take exactly that. */
export type Beat<K extends VfxBeat['kind']> = Extract<VfxBeat, { kind: K }>

/** Three tones of one effect, from the hot centre to the outer edge. */
export interface Tones { core: number; mid: number; deep: number; spark?: number }

/** Runs `step` every frame for `dur` ms: `t` is the time in ms, `p` the progress 0..1. The actor is removed by the runtime when time is up. */
export function run(fx: FxRuntime, dur: number, step: (t: number, p: number, dt: number) => void): void {
  let t = 0
  fx.add(dt => {
    t += dt
    step(Math.min(t, dur), Math.min(1, t / dur), dt)
    return t >= dur
  })
}

export interface SparkOptions {
  count: number
  speed: [number, number]
  life: [number, number]
  size: [number, number]
  colors: readonly number[]
  /** Centre direction in radians (default: every direction) and the width of the fan. */
  angle?: number
  spread?: number
  gravity?: number
  drag?: number
  shape?: ParticleShape
  glow?: boolean
  alpha?: number
  grow?: number
}

/** A burst of short-lived particles. Speeds and sizes are in units of `u`, so they scale with the scene. Reduced motion keeps none of the flying ones. */
export function sparks(fx: FxRuntime, x: number, y: number, o: SparkOptions): void {
  if (fx.reduced && o.shape !== 'dot') return
  const u = fx.u
  const spread = o.spread ?? Math.PI * 2
  for (let index = 0; index < o.count; index += 1) {
    const angle = (o.angle ?? 0) + (o.spread === undefined ? fx.rand() * Math.PI * 2 : (fx.rand() - 0.5) * spread)
    const speed = fx.between(o.speed[0], o.speed[1]) * u
    fx.emit({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: fx.between(o.life[0], o.life[1]), size: fx.between(o.size[0], o.size[1]),
      color: o.colors[Math.floor(fx.rand() * o.colors.length)] ?? 0xffffff, shape: o.shape ?? 'streak', glow: o.glow ?? false, alpha: o.alpha ?? 1,
      gravity: (o.gravity ?? 0) * u, drag: o.drag ?? 0, grow: o.grow ?? 0,
    })
  }
}

/**
 * The splash of a blow landing: a spiky burst in three layers (deep, mid, hot core) that snaps outward and fades, over a soft light.
 * The silhouette is what reads at a glance, so the spikes are uneven and the burst is drawn with normal blending, not just glow.
 */
export function starburst(fx: FxRuntime, x: number, y: number, radius: number, tones: Tones, ms = 240, spikes = 9): void {
  const r = radius * fx.u
  if (fx.reduced) {
    run(fx, ms, (_t, p) => glowDisc(fx.layers.glow, x, y, r * (0.7 + 0.4 * easeOut(p)), tones.mid, 0.8 * (1 - p) ** 1.5, tones.core))
    return
  }
  const phase = fx.rand() * Math.PI * 2
  const lengths = Array.from({ length: spikes }, () => 0.72 + fx.rand() * 0.5)
  run(fx, ms, (_t, p) => {
    const e = easeOut(Math.min(1, p * 1.7))
    const fade = p < 0.3 ? 1 : 1 - (p - 0.3) / 0.7
    const draw = (scale: number, color: number, alpha: number) => {
      const points: number[] = []
      for (let index = 0; index < spikes; index += 1) {
        const a = phase + index * Math.PI * 2 / spikes
        const tip = r * lengths[index]! * scale * e
        points.push(x + Math.cos(a) * tip, y + Math.sin(a) * tip)
        const b = a + Math.PI / spikes
        points.push(x + Math.cos(b) * tip * 0.4, y + Math.sin(b) * tip * 0.4)
      }
      fx.layers.over.poly(points).fill({ color, alpha })
    }
    glowDisc(fx.layers.glow, x, y, r * (0.85 + 0.55 * e), tones.mid, 0.9 * fade, tones.core)
    draw(1, tones.deep, 0.92 * fade)
    draw(0.72, tones.mid, fade)
    draw(0.42, tones.core, fade)
  })
}

/** A short burst of soft light on the additive layer. */
export function flash(fx: FxRuntime, x: number, y: number, radius: number, color: number, ms = 170, strength = 0.9): void {
  const r = radius * fx.u
  run(fx, ms, (_t, p) => glowDisc(fx.layers.glow, x, y, r * (0.7 + 0.5 * easeOut(p)), color, strength * (1 - p) ** 1.6))
}

/** A ring that grows and thins, with a thin bright edge so it reads on a bright background. */
export function shock(fx: FxRuntime, x: number, y: number, from: number, to: number, color: number, width: number, ms = 260, layer: 'glow' | 'over' = 'glow'): void {
  const u = fx.u
  run(fx, ms, (_t, p) => {
    const e = easeOut(p)
    const r = (from + (to - from) * e) * u
    const fade = (1 - p) ** 1.3
    ring(fx.layers[layer], x, y, r, color, Math.max(1.5, width * u * (1 - p * 0.75)), fade)
    ring(fx.layers.over, x, y, r, 0xffffff, Math.max(1, width * u * 0.28 * (1 - p)), fade * 0.8)
  })
}

/** The standard "it hit" mark: the splash, a ring and (in full motion) a handful of sparks. */
export function hitMark(fx: FxRuntime, x: number, y: number, o: { size: number; tones: Tones; ring?: number; sparks?: number; angle?: number; spread?: number; gravity?: number; spikes?: number; ms?: number }): void {
  const scale = o.ms ?? 1
  starburst(fx, x, y, o.size, o.tones, 250 * scale, o.spikes ?? 9)
  shock(fx, x, y, o.size * 0.3, o.size * 1.15, o.ring ?? o.tones.mid, o.size * 0.18, 270 * scale)
  const spark = o.tones.spark ?? o.tones.core
  if (o.sparks) sparks(fx, x, y, { count: o.sparks, speed: [o.size * 5, o.size * 11], life: [220, 400], size: [3, 5], colors: [spark, o.tones.core, o.tones.mid], angle: o.angle, spread: o.spread, gravity: o.gravity ?? 480, glow: true })
}

export function dropletBurst(fx: FxRuntime, x: number, y: number, count: number, speed = 190): void {
  sparks(fx, x, y, { count, speed: [speed * 0.4, speed], life: [380, 620], size: [3, 5.5], colors: [palette.blood, palette.bloodDeep, palette.bloodLight], shape: 'dot', gravity: 760, drag: 0.8, angle: -Math.PI / 2, spread: Math.PI * 1.1 })
}

export const toward = (from: { x: number; y: number }, to: { x: number; y: number }) => Math.atan2(to.y - from.y, to.x - from.x)

