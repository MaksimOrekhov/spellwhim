import type { Graphics } from 'pixi.js'

export interface Pt { x: number; y: number }

export const clamp01 = (value: number) => value < 0 ? 0 : value > 1 ? 1 : value
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3
export const easeIn = (t: number) => clamp01(t) ** 2.2
export const easeInOut = (t: number) => { const c = clamp01(t); return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2 }
export const easeOutBack = (t: number) => { const c = clamp01(t) - 1; return 1 + 2.4 * c ** 3 + 1.4 * c ** 2 }
/** Fraction of [from, to] that `t` has covered. */
export const span = (t: number, from: number, to: number) => clamp01((t - from) / Math.max(1e-6, to - from))
/** 0 → 1 → 0 across [from, to]. */
export const pulse = (t: number, from: number, to: number) => Math.sin(span(t, from, to) * Math.PI)

/** A soft light: a few concentric discs, brightest in the middle. Draw it on the additive layer. */
export function glowDisc(g: Graphics, x: number, y: number, r: number, color: number, alpha = 1, core = 0xffffff): void {
  g.circle(x, y, r).fill({ color, alpha: alpha * 0.2 })
  g.circle(x, y, r * 0.7).fill({ color, alpha: alpha * 0.32 })
  g.circle(x, y, r * 0.42).fill({ color, alpha: alpha * 0.6 })
  g.circle(x, y, r * 0.2).fill({ color: core, alpha: alpha * 0.9 })
}

/** A swept blade or comet: a path drawn in segments that swell towards the middle and thin to both ends, in three nested strokes. */
export function crescent(g: Graphics, points: readonly Pt[], colors: { halo: number; body: number; core?: number }, width: number, alpha = 1): void {
  const last = points.length - 1
  if (last < 1 || alpha <= 0) return
  for (let index = 0; index < last; index += 1) {
    const k = (index + 0.5) / last
    const w = width * (0.22 + 0.78 * Math.sin(Math.PI * k) ** 0.7)
    const a = points[index]!
    const b = points[index + 1]!
    const stroke = (lineWidth: number, color: number, strength: number) => g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width: lineWidth, alpha: alpha * strength, cap: 'round', join: 'round' })
    stroke(w * 2.6, colors.halo, 0.34)
    stroke(w * 1.5, colors.body, 0.8)
    stroke(w * 0.55, colors.core ?? 0xffffff, 1)
  }
}

export function ring(g: Graphics, x: number, y: number, r: number, color: number, width: number, alpha = 1): void {
  if (r <= 0 || alpha <= 0) return
  g.circle(x, y, r).stroke({ color, width, alpha })
}

export function line(g: Graphics, a: Pt, b: Pt, color: number, width: number, alpha = 1): void {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha, cap: 'round', join: 'round' })
}

/** A path drawn as three nested strokes: wide halo, body, white core. */
export function beam(g: Graphics, points: readonly Pt[], colors: { halo: number; body: number; core?: number }, width: number, alpha = 1): void {
  if (points.length < 2) return
  const first = points[0]!
  const draw = (w: number, color: number, a: number) => {
    g.moveTo(first.x, first.y)
    for (let index = 1; index < points.length; index += 1) g.lineTo(points[index]!.x, points[index]!.y)
    g.stroke({ color, width: w, alpha: a, cap: 'round', join: 'round' })
  }
  draw(width * 3, colors.halo, alpha * 0.2)
  draw(width * 1.6, colors.body, alpha * 0.62)
  draw(width * 0.55, colors.core ?? 0xffffff, alpha)
}

export function diamond(g: Graphics, x: number, y: number, length: number, width: number, angle: number, color: number, alpha = 1): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  g.poly([x + c * length, y + s * length, x - s * width, y + c * width, x - c * length * 0.45, y - s * length * 0.45, x + s * width, y - c * width]).fill({ color, alpha })
}

export function star4(g: Graphics, x: number, y: number, r: number, rotation: number, color: number, alpha = 1): void {
  const points: number[] = []
  for (let index = 0; index < 8; index += 1) {
    const radius = index % 2 === 0 ? r : r * 0.28
    const angle = rotation + index * Math.PI / 4
    points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
  }
  g.poly(points).fill({ color, alpha })
}

export function polygon(x: number, y: number, r: number, sides: number, rotation: number): Pt[] {
  return Array.from({ length: sides }, (_, index) => ({ x: x + Math.cos(rotation + index * Math.PI * 2 / sides) * r, y: y + Math.sin(rotation + index * Math.PI * 2 / sides) * r }))
}

export function strokePolygon(g: Graphics, points: readonly Pt[], color: number, width: number, alpha = 1, fill?: { color: number; alpha: number }): void {
  if (points.length < 3) return
  g.poly(points.flatMap(point => [point.x, point.y]), true)
  if (fill) g.fill(fill)
  g.stroke({ color, width, alpha, join: 'round' })
}

/** An arc of a circle as a stroke. */
export function arc(g: Graphics, x: number, y: number, r: number, from: number, to: number, color: number, width: number, alpha = 1): void {
  if (alpha <= 0 || r <= 0) return
  g.moveTo(x + Math.cos(from) * r, y + Math.sin(from) * r).arc(x, y, r, from, to).stroke({ color, width, alpha, cap: 'round' })
}

/** A kite shield, point down, centred on (x, y). */
export function shieldPath(x: number, y: number, w: number, h: number): number[] {
  const hw = w / 2
  const hh = h / 2
  return [x - hw, y - hh, x - hw * 0.35, y - hh * 0.9, x, y - hh * 0.97, x + hw * 0.35, y - hh * 0.9, x + hw, y - hh, x + hw * 0.96, y + hh * 0.08, x + hw * 0.62, y + hh * 0.56, x, y + hh, x - hw * 0.62, y + hh * 0.56, x - hw * 0.96, y + hh * 0.08]
}

/** Midpoint-displacement line between two points: the body of a lightning bolt or a crack. */
export function jagged(a: Pt, b: Pt, jitter: number, depth: number, rand: () => number): Pt[] {
  let points: Pt[] = [a, b]
  let offset = jitter
  for (let level = 0; level < depth; level += 1) {
    const next: Pt[] = [points[0]!]
    for (let index = 1; index < points.length; index += 1) {
      const p = points[index - 1]!
      const q = points[index]!
      const dx = q.x - p.x
      const dy = q.y - p.y
      const length = Math.hypot(dx, dy) || 1
      const bend = (rand() - 0.5) * 2 * offset
      next.push({ x: (p.x + q.x) / 2 - dy / length * bend, y: (p.y + q.y) / 2 + dx / length * bend }, q)
    }
    points = next
    offset *= 0.55
  }
  return points
}

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

/** A snowflake of frost: six spokes with side branches inside a hexagon. `grow` 0..1 draws it outward. */
export function drawLattice(g: Graphics, x: number, y: number, r: number, grow: number, alpha: number, u: number): void {
  for (let spoke = 0; spoke < 6; spoke += 1) {
    const angle = spoke * Math.PI / 3 - Math.PI / 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const length = r * grow
    line(g, { x, y }, { x: x + cos * length, y: y + sin * length }, frostMid, 3 * u, alpha * 0.9)
    line(g, { x, y }, { x: x + cos * length, y: y + sin * length }, 0xffffff, 1.2 * u, alpha)
    for (const [at, size] of [[0.55, 0.26], [0.8, 0.18]] as const) {
      const bx = x + cos * length * at
      const by = y + sin * length * at
      for (const turn of [-0.62, 0.62]) line(g, { x: bx, y: by }, { x: bx + Math.cos(angle + turn) * r * size * grow, y: by + Math.sin(angle + turn) * r * size * grow }, frostMid, 2 * u, alpha * 0.8)
    }
    if (grow > 0.9) diamond(g, x + cos * length, y + sin * length, 9 * u, 4 * u, angle, 0xffffff, alpha)
  }
  const hex = Array.from({ length: 6 }, (_, index) => ({ x: x + Math.cos(index * Math.PI / 3 - Math.PI / 2) * r * 0.92 * grow, y: y + Math.sin(index * Math.PI / 3 - Math.PI / 2) * r * 0.92 * grow }))
  g.poly(hex.flatMap(point => [point.x, point.y]), true).stroke({ color: 0xf2feff, width: 2.4 * u, alpha: alpha * 0.8, join: 'round' })
}
const frostMid = 0x8fe6ff
