import { beam, clamp01, crescent, diamond, dist, drawLattice, easeIn, easeInOut, easeOut, glowDisc, jagged, lerp, line, ring, shieldPath, span, star4 } from '../draw'
import type { Pt } from '../draw'
import { palette, palettes } from '../palette'
import type { Palette } from '../palette'
import type { FxRuntime } from '../runtime'
import { dropletBurst, flash, hitMark, run, shock, sparks, starburst, toward } from './kit'
import type { Beat } from './kit'

type Strike = Beat<'strike'>

const quad = (a: Pt, c: Pt, e: Pt, p: number): Pt => { const i = 1 - p; return { x: i * i * a.x + 2 * i * p * c.x + p * p * e.x, y: i * i * a.y + 2 * i * p * c.y + p * p * e.y } }
const sample = (f: (p: number) => Pt, from: number, to: number, n: number): Pt[] => Array.from({ length: n + 1 }, (_, index) => f(lerp(from, to, index / n)))
const side = (a: Pt, b: Pt) => Math.sign(b.x - a.x) || 1
/** The last `count` positions of a moving thing, sampled from its path: the tail has the same length at any frame rate. */
const trailPoints = (at: (progress: number) => Pt, progress: number, count: number, step: number): Pt[] => Array.from({ length: count }, (_, index) => at(Math.max(0, progress - (count - 1 - index) * step)))

/** Colours of an enemy blow: the common orange, magma for a boss, ice when the Frostbite weakened it. */
function enemyColors(beat: Strike): Palette {
  if (beat.chilled) return palettes.frost
  if (beat.boss) return { core: 0xfff0c4, mid: palette.magma, deep: palette.magmaDeep, spark: palette.ember, accent: palette.ember }
  return { core: 0xfff1d8, mid: palette.enemy, deep: palette.enemyDeep, spark: palette.ember, accent: palette.gold }
}
const colorsOf = (beat: Strike): Palette => beat.from === 'enemy' ? enemyColors(beat) : palettes[beat.school]

/** The extra mark of a blow that the engine says was empowered (a class bonus, an artifact, a spent Vulnerability on a hero). */
function empowerMark(fx: FxRuntime, x: number, y: number): void {
  flash(fx, x, y, 70, palette.vuln, 220, 0.8)
  shock(fx, x, y, 26, 92, palette.vuln, 7, 320)
  const g = fx.layers.glow
  run(fx, 280, (t, p) => star4(g, x, y, 44 * fx.u * (1 - p * 0.4), t * 0.004, palette.goldHot, (1 - p) ** 1.5))
}

/** Reduced motion: one calm flash and ring at the target, at the moment of contact. */
function calmStrike(fx: FxRuntime, beat: Strike): void {
  const to = fx.box(beat.to)
  const pal = colorsOf(beat)
  const size = beat.weight === 'heavy' ? 64 : beat.weight === 'light' ? 40 : 52
  fx.after(beat.landMs, () => {
    starburst(fx, to.x, to.y, size, pal, 240)
    shock(fx, to.x, to.y, size * 0.3, size * 1.1, pal.mid, 6, 260)
    if (beat.empowered) shock(fx, to.x, to.y, size * 0.5, size * 1.4, palette.vuln, 4, 260)
  })
}

export function paintStrike(fx: FxRuntime, beat: Strike): void {
  if (fx.reduced) return calmStrike(fx, beat)
  switch (beat.style) {
    case 'slash': return slash(fx, beat)
    case 'lunge': return lunge(fx, beat)
    case 'cleave': return cleave(fx, beat)
    case 'bash': return bash(fx, beat)
    case 'fireball': return orbBolt(fx, beat, 'fire')
    case 'arcane-bolt': return orbBolt(fx, beat, 'arcane')
    case 'frostbolt': return frostbolt(fx, beat)
    case 'lightning': return lightning(fx, beat)
    case 'chill': return chill(fx, beat)
    case 'claw': return claw(fx, beat)
    case 'slam': return slam(fx, beat)
    case 'needle': return needle(fx, beat)
  }
}

/* ───────────────────────────── Varian: the blade ───────────────────────────── */

function slash(fx: FxRuntime, beat: Strike): void {
  const to = fx.box(beat.to)
  const from = fx.box(beat.from ?? 'warrior')
  const u = fx.u
  const dir = side(from, to)
  const pal = palettes[beat.school]
  const reach = Math.max(64 * u, Math.min(170 * u, to.w * 0.52))
  const a = { x: to.x - dir * reach, y: to.y + reach * 0.7 }
  const c = { x: to.x + dir * reach * 0.25, y: to.y + reach * 0.12 }
  const e = { x: to.x + dir * reach * 0.9, y: to.y - reach * 0.8 }
  const f = (p: number) => quad(a, c, e, p)
  const land = beat.landMs
  run(fx, land + 230, t => {
    const head = easeOut(span(t, 0, land))
    const tail = easeInOut(span(t, 20, land + 100))
    const fade = 1 - span(t, land + 30, land + 220)
    crescent(fx.layers.glow, sample(f, tail, head, 14), { halo: pal.deep, body: pal.mid, core: pal.core }, 10 * u, fade)
  })
  fx.after(land, () => {
    hitMark(fx, to.x, to.y, { size: 62, tones: pal, sparks: 12, angle: toward(a, e), spread: 2.4 })
    if (beat.empowered) empowerMark(fx, to.x, to.y)
  })
}

function lunge(fx: FxRuntime, beat: Strike): void {
  const to = fx.box(beat.to)
  const from = fx.box(beat.from ?? 'warrior')
  const u = fx.u
  const dir = side(from, to)
  const pal = palettes[beat.school]
  const reach = Math.max(56 * u, Math.min(140 * u, to.w * 0.44))
  const a = { x: to.x - dir * reach * 1.1, y: to.y + reach * 0.32 }
  const e = { x: to.x + dir * reach * 0.85, y: to.y - reach * 0.26 }
  const land = beat.landMs
  run(fx, land + 160, t => {
    const head = easeOut(span(t, 0, land))
    const tail = easeOut(span(t, 6, land + 70))
    const fade = 1 - span(t, land, land + 160)
    const p0 = { x: lerp(a.x, e.x, tail), y: lerp(a.y, e.y, tail) }
    const p1 = { x: lerp(a.x, e.x, head), y: lerp(a.y, e.y, head) }
    crescent(fx.layers.glow, [p0, { x: lerp(p0.x, p1.x, 0.5), y: lerp(p0.y, p1.y, 0.5) }, p1], { halo: pal.deep, body: pal.mid, core: pal.core }, 6 * u, fade)
    for (const offset of [-10, 12]) line(fx.layers.glow, { x: p0.x, y: p0.y + offset * u }, { x: lerp(p0.x, p1.x, 0.7), y: lerp(p0.y, p1.y, 0.7) + offset * u }, pal.spark, 1.8 * u, fade * 0.55)
  })
  fx.after(land, () => {
    hitMark(fx, to.x, to.y, { size: 42, tones: pal, sparks: 7, angle: toward(a, e), spread: 1.6, spikes: 7, ms: 0.8 })
    if (beat.empowered) empowerMark(fx, to.x, to.y)
  })
}

function cleave(fx: FxRuntime, beat: Strike): void {
  const to = fx.box(beat.to)
  const from = fx.box(beat.from ?? 'warrior')
  const u = fx.u
  const dir = side(from, to)
  const pal = palettes[beat.school]
  const reach = Math.max(76 * u, Math.min(190 * u, to.w * 0.6))
  const raise = beat.landMs * 0.42
  // The raised blade: a faint arc from the lower side up over the head...
  const wa = { x: to.x - dir * reach * 0.95, y: to.y + reach * 0.5 }
  const wc = { x: to.x - dir * reach * 1.2, y: to.y - reach * 0.6 }
  const we = { x: to.x - dir * reach * 0.55, y: to.y - reach * 0.95 }
  // ...and the blow: a wide arc down across the target.
  const a = we
  const c = { x: to.x + dir * reach * 0.95, y: to.y - reach * 0.7 }
  const e = { x: to.x + dir * reach * 0.55, y: to.y + reach * 0.85 }
  const land = beat.landMs
  run(fx, land + 380, t => {
    const g = fx.layers.glow
    const windup = span(t, 0, raise)
    if (t < raise + 120) crescent(g, sample(p => quad(wa, wc, we, p), 0, easeOut(windup), 9), { halo: pal.deep, body: pal.mid, core: pal.core }, 6 * u, 0.5 * (1 - span(t, raise, raise + 120)))
    const head = easeIn(span(t, raise, land))
    const tail = easeInOut(span(t, raise + 30, land + 110))
    const fade = 1 - span(t, land + 40, land + 330)
    if (t >= raise) crescent(g, sample(p => quad(a, c, e, p), tail, head, 16), { halo: pal.deep, body: pal.mid, core: pal.core }, 17 * u, fade)
  })
  const cracks = Array.from({ length: 8 }, (_, index) => ({ angle: index * Math.PI / 4 + fx.between(-0.2, 0.2), length: fx.between(38, 74) }))
  fx.after(land, () => {
    const hit = { x: to.x + dir * reach * 0.05, y: to.y + reach * 0.1 }
    hitMark(fx, hit.x, hit.y, { size: 104, tones: pal, ring: palette.steel, sparks: 20, angle: toward(a, e), spread: 3, gravity: 620, spikes: 11 })
    shock(fx, hit.x, hit.y, 22, 136, palette.goldHot, 11, 360)
    sparks(fx, hit.x, hit.y, { count: 7, speed: [180, 380], life: [320, 520], size: [8, 13], colors: [palette.steel, palette.steelMid, pal.mid], shape: 'shard', gravity: 700, drag: 1.2 })
    run(fx, 360, (_t, p) => {
      for (const crack of cracks) {
        const reachNow = (16 + crack.length * easeOut(p * 2)) * u
        line(fx.layers.over, { x: hit.x + Math.cos(crack.angle) * 16 * u, y: hit.y + Math.sin(crack.angle) * 16 * u }, { x: hit.x + Math.cos(crack.angle) * reachNow, y: hit.y + Math.sin(crack.angle) * reachNow }, 0xfff1c4, 3.4 * u * (1 - p), (1 - p) ** 1.6)
      }
    })
    if (beat.empowered) empowerMark(fx, hit.x, hit.y)
  })
}

function bash(fx: FxRuntime, beat: Strike): void {
  const to = fx.box(beat.to)
  const from = fx.box(beat.from ?? 'warrior')
  const u = fx.u
  const dir = side(from, to)
  const size = Math.max(80 * u, Math.min(150 * u, to.h * 0.34))
  const start = { x: from.x + dir * from.w * 0.3, y: from.y }
  const end = { x: to.x - dir * to.w * 0.1, y: to.y + to.h * 0.02 }
  const control = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 60 * u }
  const land = beat.landMs
  const at = (p: number) => quad(start, control, end, easeIn(p))
  const drawShield = (p: Pt, scale: number, alpha: number, angle: number) => {
    const w = size * 0.78 * scale
    const h = size * scale
    const g = fx.layers.over
    const pts = shieldPath(0, 0, w, h)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const place = (points: number[]) => points.map((value, index) => index % 2 === 0 ? p.x + value * cos - points[index + 1]! * sin : p.y + points[index - 1]! * sin + value * cos)
    g.poly(place(pts), true).fill({ color: palette.steelMid, alpha: 0.96 * alpha }).stroke({ color: palette.steel, width: 5 * u, alpha, join: 'round' })
    g.poly(place(shieldPath(0, 0, w * 0.74, h * 0.76)), true).fill({ color: palette.steel, alpha: 0.5 * alpha }).stroke({ color: palette.bronze, width: 2.6 * u, alpha, join: 'round' })
    g.circle(p.x, p.y - h * 0.02, w * 0.13).fill({ color: palette.goldHot, alpha }).stroke({ color: palette.bronze, width: 2 * u, alpha })
  }
  run(fx, land + 330, t => {
    const p = span(t, 0, land)
    const pos = at(p)
    const alpha = 1 - span(t, land + 90, land + 300)
    const scale = lerp(0.7, 1.12, easeOut(p)) * (1 + 0.1 * Math.sin(span(t, land, land + 120) * Math.PI))
    const angle = lerp(-0.4 * dir, 0.06 * dir, easeOut(p))
    // a smear of the shield's earlier positions
    if (p < 1) for (let ghost = 3; ghost >= 1; ghost -= 1) { const gp = at(Math.max(0, p - ghost * 0.07)); fx.layers.glow.circle(gp.x, gp.y, size * 0.46).fill({ color: 0xffffff, alpha: 0.09 * (4 - ghost) }) }
    drawShield(pos, scale, alpha, angle)
  })
  fx.after(land, () => {
    const tones = { core: 0xffffff, mid: palette.steel, deep: palette.steelDark, spark: palette.goldHot }
    hitMark(fx, end.x, end.y, { size: 82, tones, ring: palette.goldHot, sparks: 18, angle: dir > 0 ? 0 : Math.PI, spread: 3.4, gravity: 540, spikes: 12 })
    shock(fx, end.x, end.y, 16, 118, palette.steelMid, 12, 320)
    const rays = Array.from({ length: 12 }, (_, index) => index * Math.PI / 6 + fx.between(-0.1, 0.1))
    run(fx, 240, (_t, p) => { for (const angle of rays) line(fx.layers.glow, { x: end.x + Math.cos(angle) * 36 * u, y: end.y + Math.sin(angle) * 36 * u }, { x: end.x + Math.cos(angle) * (36 + 62 * easeOut(p)) * u, y: end.y + Math.sin(angle) * (36 + 62 * easeOut(p)) * u }, 0xffffff, 3 * u, (1 - p) ** 1.5) })
    if (beat.empowered) empowerMark(fx, end.x, end.y)
  })
}

/* ───────────────────────────── Jaina: spells ───────────────────────────── */

function boltPath(fx: FxRuntime, beat: Strike, arc: number) {
  const from = fx.box(beat.from ?? 'mage')
  const to = fx.box(beat.to)
  const u = fx.u
  const angle = toward(from, to)
  const start = { x: from.x + Math.cos(angle) * from.w * 0.36, y: from.y - from.h * 0.12 + Math.sin(angle) * from.w * 0.1 }
  const end = { x: to.x, y: to.y }
  const arcHeight = Math.min(96 * u, dist(start, end) * arc)
  const at = (p: number, accelerate = 1.25): Pt => { const e = clamp01(p) ** accelerate; return { x: lerp(start.x, end.x, e), y: lerp(start.y, end.y, e) - Math.sin(Math.PI * clamp01(p)) * arcHeight } }
  return { from, to, start, end, at, angle }
}

function orbBolt(fx: FxRuntime, beat: Strike, kind: 'fire' | 'arcane'): void {
  const u = fx.u
  const pal = palettes[beat.school]
  const { end, at } = boltPath(fx, beat, 0.2)
  const land = beat.landMs
  let ember = 0
  run(fx, land, (t, p, dt) => {
    const g = fx.layers.glow
    const point = at(p)
    const history = trailPoints(at, p, 12, 0.03)
    for (let index = 1; index < history.length; index += 1) {
      const k = index / history.length
      line(g, history[index - 1]!, history[index]!, pal.deep, 30 * u * k, 0.45 * k)
      line(g, history[index - 1]!, history[index]!, pal.mid, 17 * u * k, 0.8 * k)
      line(g, history[index - 1]!, history[index]!, pal.core, 6 * u * k, 0.95 * k)
    }
    const flicker = 1 + Math.sin(t * 0.045) * 0.1
    g.circle(point.x, point.y, 54 * u * flicker).fill({ color: pal.accent, alpha: 0.2 })
    g.circle(point.x, point.y, 37 * u * flicker).fill({ color: pal.deep, alpha: 0.6 })
    g.circle(point.x, point.y, 25 * u * flicker).fill({ color: pal.mid, alpha: 0.98 })
    g.circle(point.x, point.y, 12 * u * flicker).fill({ color: pal.core })
    if (kind === 'arcane') for (let k = 0; k < 3; k += 1) { const a = t * 0.012 + k * Math.PI * 2 / 3; diamond(fx.layers.over, point.x + Math.cos(a) * 33 * u, point.y + Math.sin(a) * 33 * u, 9 * u, 4 * u, a + Math.PI / 2, pal.accent, 0.95) }
    ember += dt * (kind === 'fire' ? 0.1 : 0.06)
    while (ember >= 1) {
      ember -= 1
      fx.emit({ x: point.x + fx.between(-8, 8) * u, y: point.y + fx.between(-8, 8) * u, vx: fx.between(-35, 35) * u, vy: fx.between(-100, -20) * u, life: fx.between(280, 480), size: fx.between(3.4, 6.5), color: kind === 'fire' ? [pal.mid, pal.spark, pal.deep][Math.floor(fx.rand() * 3)]! : [pal.accent, pal.mid, pal.core][Math.floor(fx.rand() * 3)]!, shape: 'dot', glow: true, drag: 1.4 })
    }
  })
  fx.after(land, () => {
    if (kind === 'fire') {
      hitMark(fx, end.x, end.y, { size: 104, tones: pal, ring: pal.accent, spikes: 11 })
      shock(fx, end.x, end.y, 14, 126, pal.accent, 5, 380)
      sparks(fx, end.x, end.y, { count: 10, speed: [200, 420], life: [280, 460], size: [10, 16], colors: [pal.mid, pal.deep, pal.spark], shape: 'shard', glow: true, drag: 3.2 })
      sparks(fx, end.x, end.y, { count: 18, speed: [60, 240], life: [440, 760], size: [3, 6], colors: [pal.spark, pal.mid, pal.core], shape: 'dot', glow: true, gravity: -160, drag: 1.2, angle: -Math.PI / 2, spread: Math.PI * 1.5 })
    } else {
      hitMark(fx, end.x, end.y, { size: 90, tones: pal, ring: pal.accent, spikes: 10 })
      const ticks = Array.from({ length: 8 }, (_, index) => index * Math.PI / 4)
      run(fx, 360, (t, q) => {
        const r = (36 + 56 * easeOut(q)) * u
        ring(fx.layers.glow, end.x, end.y, r, pal.accent, 4 * u * (1 - q), (1 - q) ** 1.3)
        for (const a of ticks) line(fx.layers.glow, { x: end.x + Math.cos(a + t * 0.002) * r * 0.85, y: end.y + Math.sin(a + t * 0.002) * r * 0.85 }, { x: end.x + Math.cos(a + t * 0.002) * r * 1.14, y: end.y + Math.sin(a + t * 0.002) * r * 1.14 }, pal.core, 3 * u, (1 - q) ** 1.5)
      })
      sparks(fx, end.x, end.y, { count: 16, speed: [160, 420], life: [260, 480], size: [3, 5], colors: [pal.mid, pal.accent, pal.core], glow: true, gravity: 260 })
      if (beat.school === 'blood') dropletBurst(fx, end.x, end.y, 9, 190)
    }
    if (beat.empowered) empowerMark(fx, end.x, end.y)
  })
}

function frostbolt(fx: FxRuntime, beat: Strike): void {
  const u = fx.u
  const pal = palettes.frost
  const { end, at } = boltPath(fx, beat, 0.07)
  const land = beat.landMs
  let mist = 0
  run(fx, land, (t, p, dt) => {
    const g = fx.layers.glow
    const point = at(p, 1.15)
    const ahead = at(Math.min(1, p + 0.03), 1.15)
    const angle = toward(point, ahead)
    const history = trailPoints(progress => at(progress, 1.15), p, 11, 0.032)
    for (let index = 1; index < history.length; index += 1) { const k = index / history.length; line(g, history[index - 1]!, history[index]!, pal.mid, 14 * u * k, 0.55 * k); line(g, history[index - 1]!, history[index]!, 0xffffff, 3.4 * u * k, 0.95 * k) }
    g.circle(point.x, point.y, 38 * u).fill({ color: pal.deep, alpha: 0.24 })
    g.circle(point.x, point.y, 24 * u).fill({ color: pal.mid, alpha: 0.4 })
    diamond(fx.layers.over, point.x, point.y, 48 * u, 15 * u, angle, pal.mid, 0.95)
    diamond(fx.layers.over, point.x + Math.cos(angle) * 3 * u, point.y + Math.sin(angle) * 3 * u, 38 * u, 7.5 * u, angle, 0xffffff, 0.98)
    star4(g, point.x - Math.cos(angle) * 18 * u, point.y - Math.sin(angle) * 18 * u, (11 + Math.sin(t * 0.03) * 4) * u, t * 0.005, 0xffffff, 0.9)
    mist += dt * 0.09
    while (mist >= 1) {
      mist -= 1
      fx.emit({ x: point.x + fx.between(-6, 6) * u, y: point.y + fx.between(-6, 6) * u, vx: fx.between(-25, 25) * u - Math.cos(angle) * 40 * u, vy: fx.between(-25, 25) * u - Math.sin(angle) * 40 * u, life: fx.between(300, 500), size: fx.between(3.4, 6.5), color: [pal.core, pal.mid, pal.spark][Math.floor(fx.rand() * 3)]!, shape: fx.rand() < 0.3 ? 'star' : 'dot', glow: true, alpha: 0.85, drag: 1.8 })
    }
  })
  fx.after(land, () => {
    hitMark(fx, end.x, end.y, { size: 96, tones: pal, ring: 0xffffff, spikes: 12 })
    sparks(fx, end.x, end.y, { count: 14, speed: [240, 540], life: [400, 600], size: [12, 19], colors: [pal.core, pal.mid, pal.spark, 0xffffff], shape: 'shard', drag: 2.2 })
    sparks(fx, end.x, end.y, { count: 8, speed: [120, 300], life: [340, 520], size: [10, 15], colors: [pal.mid, pal.deep], shape: 'shard', glow: true, drag: 2 })
    sparks(fx, end.x, end.y, { count: 7, speed: [10, 60], life: [450, 700], size: [10, 17], colors: [pal.core, pal.mid], shape: 'dot', glow: true, alpha: 0.35, grow: 1.4, drag: 1 })
    if (beat.empowered) empowerMark(fx, end.x, end.y)
  })
}

function lightning(fx: FxRuntime, beat: Strike): void {
  const u = fx.u
  const pal = palettes.lightning
  const from = fx.box(beat.from ?? 'mage')
  const to = fx.box(beat.to)
  const angle = toward(from, to)
  const start = { x: from.x + Math.cos(angle) * from.w * 0.3, y: from.y - from.h * 0.14 }
  const end = { x: to.x, y: to.y - to.h * 0.04 }
  const land = beat.landMs
  const strike = land - 25
  const build = () => {
    const main = jagged(start, end, dist(start, end) * 0.1, 5, fx.rand)
    const branches: Pt[][] = []
    for (let k = 0; k < 3; k += 1) {
      const origin = main[Math.floor(main.length * fx.between(0.25, 0.8))]!
      const turn = toward(start, end) + (fx.rand() < 0.5 ? -1 : 1) * fx.between(0.5, 0.95)
      const length = dist(start, end) * fx.between(0.13, 0.26)
      branches.push(jagged(origin, { x: origin.x + Math.cos(turn) * length, y: origin.y + Math.sin(turn) * length }, length * 0.14, 3, fx.rand))
    }
    return { main, branches }
  }
  let bolt = build()
  let rebuilt = -1
  const arcs = Array.from({ length: 8 }, () => ({ angle: fx.between(0, Math.PI * 2), length: fx.between(34, 66) }))
  run(fx, land + 300, t => {
    const g = fx.layers.glow
    const charge = span(t, 0, strike)
    if (t < strike) {
      glowDisc(g, start.x, start.y, (12 + 28 * easeIn(charge)) * u, pal.deep, 0.95)
      if (charge > 0.4) for (let k = 0; k < 2; k += 1) { const a = fx.rand() * Math.PI * 2; line(g, start, { x: start.x + Math.cos(a) * 30 * u, y: start.y + Math.sin(a) * 30 * u }, pal.mid, 2.4 * u, 0.85) }
      return
    }
    const sinceStrike = t - strike
    const frame = Math.floor(sinceStrike / 55)
    if (frame !== rebuilt && frame < 4) { bolt = build(); rebuilt = frame }
    const fade = 1 - span(sinceStrike, 150, 300)
    const flicker = 0.78 + fx.rand() * 0.22
    const colors = { halo: pal.deep, body: pal.mid, core: 0xffffff }
    beam(g, bolt.main, colors, 5 * u, fade * flicker)
    for (const branch of bolt.branches) beam(g, branch, colors, 2.4 * u, fade * flicker * 0.9)
    glowDisc(g, end.x, end.y, (36 + 28 * (1 - span(sinceStrike, 0, 200))) * u, pal.mid, fade * 0.9)
    for (const arcLine of arcs) {
      const reach = arcLine.length * u * (0.6 + 0.4 * flicker)
      beam(g, jagged(end, { x: end.x + Math.cos(arcLine.angle) * reach, y: end.y + Math.sin(arcLine.angle) * reach }, reach * 0.22, 2, fx.rand), colors, 1.8 * u, fade * 0.85)
    }
  })
  fx.after(strike, () => {
    hitMark(fx, end.x, end.y, { size: 90, tones: { core: 0xffffff, mid: pal.mid, deep: pal.deep, spark: pal.spark }, ring: pal.mid, sparks: 14, gravity: 200, spikes: 12, ms: 0.8 })
    sparks(fx, end.x, end.y, { count: 5, speed: [30, 120], life: [260, 420], size: [10, 16], colors: [0xffffff, pal.mid], shape: 'star', glow: true, drag: 2 })
    if (beat.empowered) empowerMark(fx, end.x, end.y)
  })
}

function chill(fx: FxRuntime, beat: Strike): void {
  const u = fx.u
  const pal = palettes.frost
  const from = fx.box(beat.from ?? 'mage')
  const to = fx.box(beat.to)
  const angle = toward(from, to)
  const start = { x: from.x + Math.cos(angle) * from.w * 0.32, y: from.y - from.h * 0.1 }
  const end = { x: to.x, y: to.y }
  const land = beat.landMs
  const radius = Math.min(to.w, to.h) * 0.56
  let gust = 0
  run(fx, beat.durMs, (t, _p, dt) => {
    const g = fx.layers.glow
    if (t < land) {
      const head = easeOut(span(t, 0, land))
      const front = { x: lerp(start.x, end.x, head), y: lerp(start.y, end.y, head) }
      line(g, start, front, pal.mid, 8 * u, 0.55 * (1 - head * 0.4))
      line(g, start, front, 0xffffff, 2.4 * u, 0.95)
      gust += dt * 0.2
      while (gust >= 1) {
        gust -= 1
        const along = fx.rand() * head
        fx.emit({ x: lerp(start.x, end.x, along) + fx.between(-12, 12) * u, y: lerp(start.y, end.y, along) + fx.between(-12, 12) * u, vx: fx.between(-20, 20) * u, vy: fx.between(-20, 20) * u, life: fx.between(280, 440), size: fx.between(3.6, 7), color: [pal.core, pal.mid, pal.spark][Math.floor(fx.rand() * 3)]!, shape: 'dot', glow: true, alpha: 0.65, drag: 1.5 })
      }
      return
    }
    const since = t - land
    const grow = easeOut(span(since, 0, 220))
    const alpha = 1 - span(since, 260, beat.durMs - land)
    drawLattice(g, end.x, end.y, radius, grow, alpha, u)
    glowDisc(g, end.x, end.y, radius * 0.55, pal.mid, 0.4 * alpha)
  })
  fx.after(land, () => {
    hitMark(fx, end.x, end.y, { size: 76, tones: pal, ring: 0xffffff, spikes: 10 })
    sparks(fx, end.x, end.y, { count: 10, speed: [150, 380], life: [320, 520], size: [10, 16], colors: [pal.core, pal.mid, pal.spark], shape: 'shard', drag: 2.2 })
    if (beat.empowered) empowerMark(fx, end.x, end.y)
  })
}

/* ───────────────────────────── the enemy ───────────────────────────── */

function claw(fx: FxRuntime, beat: Strike): void {
  const u = fx.u
  const pal = enemyColors(beat)
  const from = fx.box(beat.from ?? 'enemy')
  const to = fx.box(beat.to)
  const land = beat.landMs
  const angle = toward(from, to)
  const start = { x: from.x + Math.cos(angle) * from.w * 0.3, y: from.y + Math.sin(angle) * from.h * 0.2 }
  const dir = side(from, to)
  // three claw marks across the hero, running against the line of approach
  const span3 = Math.max(64 * u, Math.min(120 * u, to.w * 0.46))
  const marks = [-1, 0, 1].map(offset => ({
    a: { x: to.x - dir * span3 * 0.5 + offset * 16 * u * dir, y: to.y - span3 * 0.7 + offset * 13 * u },
    e: { x: to.x + dir * span3 * 0.5 + offset * 16 * u * dir, y: to.y + span3 * 0.7 + offset * 13 * u },
  }))
  run(fx, land + 260, t => {
    const g = fx.layers.glow
    const dash = span(t, 0, land * 0.8)
    if (dash < 1) {
      const head = easeIn(dash)
      const tailAt = easeIn(Math.max(0, dash - 0.35))
      crescent(g, [{ x: lerp(start.x, to.x, tailAt), y: lerp(start.y, to.y, tailAt) }, { x: lerp(start.x, to.x, (head + tailAt) / 2), y: lerp(start.y, to.y, (head + tailAt) / 2) }, { x: lerp(start.x, to.x, head), y: lerp(start.y, to.y, head) }], { halo: pal.deep, body: pal.mid, core: pal.core }, 9 * u, 0.9)
    }
    for (const [index, mark] of marks.entries()) {
      const draw = easeOut(span(t, land - 30 + index * 28, land + 50 + index * 28))
      if (draw <= 0) continue
      const fade = 1 - span(t, land + 90, land + 260)
      const head = { x: lerp(mark.a.x, mark.e.x, draw), y: lerp(mark.a.y, mark.e.y, draw) }
      crescent(g, [mark.a, { x: (mark.a.x + head.x) / 2, y: (mark.a.y + head.y) / 2 }, head], { halo: pal.deep, body: pal.mid, core: pal.core }, 7 * u, fade)
    }
  })
  fx.after(land, () => {
    hitMark(fx, to.x, to.y, { size: 62, tones: pal, sparks: 10, angle, spread: 2.6, gravity: 380, spikes: 8 })
    if (beat.empowered) empowerMark(fx, to.x, to.y)
    if (beat.chilled) sparks(fx, to.x, to.y, { count: 6, speed: [100, 260], life: [320, 500], size: [10, 15], colors: [palettes.frost.core, palettes.frost.mid], shape: 'shard', drag: 2 })
  })
}

function slam(fx: FxRuntime, beat: Strike): void {
  const u = fx.u
  const pal = enemyColors(beat)
  const boss = beat.boss === true
  const from = fx.box(beat.from ?? 'enemy')
  const to = fx.box(beat.to)
  const land = beat.landMs
  const angle = toward(from, to)
  const start = { x: from.x + Math.cos(angle) * from.w * 0.3, y: from.y + Math.sin(angle) * from.h * 0.15 }
  const hit = { x: to.x, y: to.y + to.h * 0.04 }
  const cracks = Array.from({ length: boss ? 9 : 7 }, (_, index) => ({ angle: index * Math.PI * 2 / (boss ? 9 : 7) + fx.between(-0.25, 0.25), length: fx.between(54, boss ? 132 : 100) }))
  const pathAt = (q: number): Pt => { const p = easeIn(q); return { x: lerp(start.x, hit.x, p), y: lerp(start.y, hit.y, p) - Math.sin(Math.PI * p) * 36 * u } }
  run(fx, land, t => {
    const q = span(t, 40, land)
    const point = pathAt(q)
    const history = trailPoints(pathAt, q, 14, 0.07)
    const g = fx.layers.glow
    for (let index = 1; index < history.length; index += 1) {
      const k = index / history.length
      line(g, history[index - 1]!, history[index]!, pal.deep, 66 * u * k, 0.4 * k)
      line(g, history[index - 1]!, history[index]!, pal.mid, 40 * u * k, 0.8 * k)
      line(g, history[index - 1]!, history[index]!, pal.core, 14 * u * k, 0.95 * k)
    }
    g.circle(point.x, point.y, (boss ? 42 : 33) * u).fill({ color: pal.deep, alpha: 0.5 })
    g.circle(point.x, point.y, (boss ? 32 : 25) * u).fill({ color: pal.mid, alpha: 0.95 })
    g.circle(point.x, point.y, (boss ? 17 : 13) * u).fill({ color: pal.core })
  })
  fx.after(land, () => {
    const size = boss ? 128 : 100
    hitMark(fx, hit.x, hit.y, { size, tones: pal, ring: pal.mid, spikes: 11 })
    shock(fx, hit.x, hit.y, 26, size * 1.55, pal.mid, 17, 400)
    fx.after(70, () => shock(fx, hit.x, hit.y, 16, size * 1.2, pal.spark ?? pal.core, 10, 340))
    sparks(fx, hit.x, hit.y, { count: boss ? 16 : 11, speed: [180, 480], life: [480, 740], size: [10, 18], colors: boss ? [palette.stone, palette.stoneDark, palette.magmaDeep, palette.ember] : [palette.stone, palette.stoneDark, pal.mid], shape: 'shard', gravity: 950, drag: 0.8, angle: -Math.PI / 2, spread: Math.PI * 1.3 })
    sparks(fx, hit.x, hit.y, { count: 9, speed: [40, 140], life: [480, 780], size: [16, 28], colors: [palette.dust, palette.stone], shape: 'dot', alpha: 0.45, grow: 1.1, drag: 1.4, gravity: -40 })
    sparks(fx, hit.x, hit.y, { count: boss ? 18 : 12, speed: [200, 460], life: [260, 460], size: [3, 5], colors: [pal.spark ?? pal.core, pal.core, pal.mid], glow: true, gravity: 520 })
    if (boss) sparks(fx, hit.x, hit.y, { count: 14, speed: [30, 140], life: [600, 1000], size: [3, 6], colors: [palette.ember, palette.magma], shape: 'dot', glow: true, gravity: -170, drag: 1, angle: -Math.PI / 2, spread: Math.PI * 1.4 })
    run(fx, 460, (_t, q) => {
      const grow = easeOut(q * 2.2)
      for (const crack of cracks) {
        const a = { x: hit.x + Math.cos(crack.angle) * 18 * u, y: hit.y + Math.sin(crack.angle) * 18 * u }
        const e = { x: hit.x + Math.cos(crack.angle) * (18 + crack.length * grow) * u, y: hit.y + Math.sin(crack.angle) * (18 + crack.length * grow) * u }
        line(fx.layers.over, a, e, 0x2a1810, 6.5 * u * (1 - q), (1 - q) ** 1.3)
        line(fx.layers.glow, a, e, boss ? palette.magma : pal.core, 2.8 * u * (1 - q), (1 - q) ** 1.5)
      }
    })
    if (beat.empowered) empowerMark(fx, hit.x, hit.y)
    if (beat.chilled) sparks(fx, hit.x, hit.y, { count: 7, speed: [100, 280], life: [320, 520], size: [11, 16], colors: [palettes.frost.core, palettes.frost.mid], shape: 'shard', drag: 2 })
  })
}

function needle(fx: FxRuntime, beat: Strike): void {
  const u = fx.u
  const pal: Palette = beat.boss ? enemyColors(beat) : { core: 0xffffff, mid: 0xffe08a, deep: 0xff9a3a, spark: 0xfff1c4, accent: 0x9fe8ff }
  const from = fx.box(beat.from ?? 'enemy')
  const to = fx.box(beat.to)
  const land = beat.landMs
  const angle = toward(from, to)
  const start = { x: from.x + Math.cos(angle) * from.w * 0.32, y: from.y + Math.sin(angle) * from.h * 0.1 }
  const through = { x: to.x + Math.cos(angle) * 56 * u, y: to.y + Math.sin(angle) * 56 * u }
  run(fx, beat.durMs, t => {
    const head = easeIn(span(t, 0, land))
    const past = easeOut(span(t, land, land + 90))
    const tail = easeInOut(span(t, 20, land + 140))
    const target = head < 1 ? to : through
    const hp = head < 1 ? { x: lerp(start.x, to.x, head), y: lerp(start.y, to.y, head) } : { x: lerp(to.x, through.x, past), y: lerp(to.y, through.y, past) }
    const tp = { x: lerp(start.x, target.x, tail), y: lerp(start.y, target.y, tail) }
    const fade = 1 - span(t, land + 80, land + 300)
    beam(fx.layers.glow, [tp, hp], { halo: pal.deep, body: pal.mid, core: pal.core }, 3.6 * u, fade)
    fx.layers.glow.circle(hp.x, hp.y, 7 * u).fill({ color: 0xffffff, alpha: fade })
  })
  fx.after(land, () => {
    hitMark(fx, to.x, to.y, { size: 50, tones: pal, sparks: 10, angle, spread: 1.4, gravity: 300, spikes: 6, ms: 0.8 })
    if (beat.empowered) empowerMark(fx, to.x, to.y)
  })
}
