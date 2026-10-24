import { arc, beam, diamond, drawLattice, easeIn, easeOut, easeOutBack, glowDisc, jagged, lerp, line, polygon, ring, span } from '../draw'
import type { Pt } from '../draw'
import { palette, palettes } from '../palette'
import type { FxRuntime } from '../runtime'
import type { RuneSigil } from '../types'
import { dropletBurst, flash, run, shock, sparks } from './kit'
import type { Beat } from './kit'

const radiusOf = (fx: FxRuntime, anchor: Parameters<FxRuntime['box']>[0]) => { const box = fx.box(anchor); return Math.min(box.w, box.h) * 0.5 }

/* ───────────────────────────── statuses ───────────────────────────── */

export function paintStatus(fx: FxRuntime, beat: Beat<'status'>): void {
  const box = fx.box(beat.anchor)
  const R = radiusOf(fx, beat.anchor)
  const u = fx.u
  if (fx.reduced) return calmStatus(fx, beat)
  const key = `${beat.status}:${beat.mode}`
  switch (key) {
    case 'vulnerability:apply': return reticle(fx, box, R, beat.durMs)
    case 'vulnerability:consume': return reticleBreak(fx, box, R)
    case 'bleeding:apply': return clawMarks(fx, box, R, beat.durMs)
    case 'bleeding:tick': return bleedPulse(fx, box, R)
    case 'bleeding:burst': return bleedBurst(fx, box, R)
    case 'frostbite:apply': return frostApply(fx, box, R, beat.durMs)
    case 'frostbite:consume': return iceShatter(fx, box, R)
    case 'rage:apply': return rageFlare(fx, box, R, beat.durMs)
    default:
      flash(fx, box.x, box.y, R * 0.6 / u, palette.gold, 200, 0.6)
  }
}

/** Reduced motion: a still, coloured ring that appears and fades. */
function calmStatus(fx: FxRuntime, beat: Beat<'status'>): void {
  const box = fx.box(beat.anchor)
  const R = radiusOf(fx, beat.anchor)
  const color = beat.status === 'vulnerability' ? palette.vuln : beat.status === 'bleeding' ? palette.blood : beat.status === 'frostbite' ? palette.frostMid : palette.rage
  run(fx, 360, (t) => ring(fx.layers.glow, box.x, box.y, R * 0.8, color, 5 * fx.u, Math.min(1, t / 60) * (1 - span(t, 200, 360))))
}

function reticle(fx: FxRuntime, box: { x: number; y: number }, R: number, dur: number): void {
  const u = fx.u
  run(fx, dur, (t) => {
    const g = fx.layers.glow
    const close = easeOut(span(t, 0, 230))
    const alpha = Math.min(1, t / 50) * (1 - span(t, dur - 180, dur))
    const r = R * lerp(1.18, 0.6, close)
    ring(g, box.x, box.y, r, palette.vulnDeep, 5 * u, 0.9 * alpha)
    ring(g, box.x, box.y, r * 0.86, palette.vuln, 2.4 * u, 0.9 * alpha)
    for (let tick = 0; tick < 4; tick += 1) {
      const a = tick * Math.PI / 2 + Math.PI / 4
      line(g, { x: box.x + Math.cos(a) * r * 0.74, y: box.y + Math.sin(a) * r * 0.74 }, { x: box.x + Math.cos(a) * r * 1.2, y: box.y + Math.sin(a) * r * 1.2 }, palette.goldHot, 4 * u, alpha)
    }
    const pulse = 1 + 0.08 * Math.sin(t * 0.02)
    g.circle(box.x, box.y, R * 0.07 * pulse).fill({ color: palette.goldHot, alpha: alpha * span(t, 160, 260) })
    if (t > 200 && t < 330) glowDisc(g, box.x, box.y, R * 0.5, palette.vuln, 0.5 * (1 - span(t, 200, 330)) * alpha)
  })
}

function reticleBreak(fx: FxRuntime, box: { x: number; y: number }, R: number): void {
  const u = fx.u
  const rays = Array.from({ length: 10 }, (_, index) => index * Math.PI / 5 + fx.between(-0.12, 0.12))
  run(fx, 520, (t, p) => {
    const g = fx.layers.glow
    const out = easeOut(span(t, 0, 380))
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const a0 = quarter * Math.PI / 2 + 0.12
      arc(g, box.x, box.y, R * (0.6 + 0.7 * out), a0, a0 + Math.PI / 2 - 0.24, palette.vuln, 6 * u * (1 - p), (1 - p) ** 1.5)
    }
    for (const a of rays) line(g, { x: box.x + Math.cos(a) * R * 0.35, y: box.y + Math.sin(a) * R * 0.35 }, { x: box.x + Math.cos(a) * R * (0.35 + 0.7 * out), y: box.y + Math.sin(a) * R * (0.35 + 0.7 * out) }, palette.goldHot, 3 * u * (1 - p), (1 - p) ** 1.4)
  })
  flash(fx, box.x, box.y, R * 0.55 / u, palette.vuln, 220, 0.9)
  sparks(fx, box.x, box.y, { count: 12, speed: [180, 420], life: [240, 420], size: [2.4, 4], colors: [palette.vuln, palette.goldHot, palette.vulnDeep], glow: true, gravity: 260 })
}

function clawMarks(fx: FxRuntime, box: { x: number; y: number }, R: number, dur: number): void {
  const u = fx.u
  const marks = [-1, 0, 1].map(offset => ({ a: { x: box.x - R * 0.55 + offset * R * 0.24, y: box.y - R * 0.62 - offset * R * 0.05 }, e: { x: box.x + R * 0.5 + offset * R * 0.24, y: box.y + R * 0.62 - offset * R * 0.05 } }))
  run(fx, dur, (t) => {
    const fade = 1 - span(t, 260, dur)
    for (const [index, mark] of marks.entries()) {
      const draw = easeOut(span(t, index * 45, index * 45 + 110))
      if (draw <= 0) continue
      beam(fx.layers.glow, [mark.a, { x: lerp(mark.a.x, mark.e.x, draw), y: lerp(mark.a.y, mark.e.y, draw) }], { halo: palette.bloodDeep, body: palette.blood, core: 0xfff0f0 }, 3.2 * u, fade)
    }
  })
  for (const [index, mark] of marks.entries()) fx.after(110 + index * 45, () => dropletBurst(fx, mark.e.x, mark.e.y, 3, 130))
  flash(fx, box.x, box.y, R * 0.5 / u, palette.blood, 180, 0.6)
}

function bleedPulse(fx: FxRuntime, box: { x: number; y: number }, R: number): void {
  const u = fx.u
  run(fx, 400, (t, p) => {
    const g = fx.layers.glow
    const r = R * lerp(1.15, 0.5, easeOut(span(t, 0, 280)))
    ring(g, box.x, box.y, r, palette.blood, 7 * u * (1 - p * 0.6), (1 - p) ** 1.2)
    glowDisc(g, box.x, box.y, R * 0.8, palette.blood, 0.28 * Math.sin(Math.min(1, p * 1.4) * Math.PI))
  })
  fx.after(180, () => dropletBurst(fx, box.x, box.y, 7, 160))
}

function bleedBurst(fx: FxRuntime, box: { x: number; y: number }, R: number): void {
  const u = fx.u
  const rays = Array.from({ length: 16 }, (_, index) => index * Math.PI / 8 + fx.between(-0.1, 0.1))
  run(fx, 540, (t, p) => {
    const g = fx.layers.glow
    const out = easeOut(span(t, 0, 340))
    ring(g, box.x, box.y, R * (0.3 + 0.95 * out), palette.blood, 9 * u * (1 - p), (1 - p) ** 1.3)
    for (const a of rays) line(g, { x: box.x + Math.cos(a) * R * 0.3 * out, y: box.y + Math.sin(a) * R * 0.3 * out }, { x: box.x + Math.cos(a) * R * (0.3 + 0.7 * out), y: box.y + Math.sin(a) * R * (0.3 + 0.7 * out) }, palette.bloodLight, 3 * u * (1 - p), (1 - p) ** 1.4)
  })
  flash(fx, box.x, box.y, R * 0.7 / u, palette.blood, 240, 0.9)
  dropletBurst(fx, box.x, box.y, 18, 280)
}

function frostApply(fx: FxRuntime, box: { x: number; y: number }, R: number, dur: number): void {
  const u = fx.u
  run(fx, dur, (t) => {
    const grow = easeOut(span(t, 0, 260))
    const alpha = Math.min(1, t / 40) * (1 - span(t, dur - 200, dur))
    drawLattice(fx.layers.glow, box.x, box.y, R, grow, alpha, u)
    glowDisc(fx.layers.glow, box.x, box.y, R * 0.55, palette.frostMid, 0.3 * alpha)
  })
  flash(fx, box.x, box.y, R * 0.5 / u, palette.frost, 180, 0.8)
  sparks(fx, box.x, box.y, { count: 6, speed: [90, 240], life: [320, 520], size: [7, 11], colors: [0xffffff, palette.frostMid], shape: 'shard', drag: 2 })
}

function iceShatter(fx: FxRuntime, box: { x: number; y: number }, R: number): void {
  const u = fx.u
  const cracks = Array.from({ length: 7 }, (_, index) => {
    const a = index * Math.PI * 2 / 7 + fx.between(-0.2, 0.2)
    return jagged(box, { x: box.x + Math.cos(a) * R * 0.95, y: box.y + Math.sin(a) * R * 0.95 }, R * 0.1, 3, fx.rand)
  })
  run(fx, 520, (t) => {
    const g = fx.layers.glow
    const grow = easeOut(span(t, 0, 110))
    const alpha = 1 - span(t, 220, 520)
    for (const crack of cracks) beam(g, crack.slice(0, Math.max(2, Math.ceil(crack.length * grow))), { halo: palette.frostDeep, body: palette.frostMid, core: 0xffffff }, 1.8 * u, alpha)
    if (t < 160) glowDisc(g, box.x, box.y, R * 0.7, 0xffffff, 0.5 * (1 - span(t, 0, 160)))
  })
  fx.after(110, () => {
    flash(fx, box.x, box.y, R * 0.8 / u, 0xffffff, 200, 1)
    shock(fx, box.x, box.y, R * 0.3 / u, R * 1.2 / u, palette.frostMid, 9, 340)
    sparks(fx, box.x, box.y, { count: 14, speed: [220, 520], life: [420, 640], size: [10, 17], colors: [0xffffff, palette.frost, palette.frostMid], shape: 'shard', drag: 1.8, gravity: 260 })
    sparks(fx, box.x, box.y, { count: 8, speed: [140, 340], life: [360, 560], size: [10, 15], colors: [palette.frostMid, palette.frostDeep], shape: 'shard', glow: true, drag: 2 })
    sparks(fx, box.x, box.y, { count: 5, speed: [30, 140], life: [420, 700], size: [8, 13], colors: [0xffffff, palette.frost], shape: 'star', glow: true, drag: 1.6 })
  })
}

function rageFlare(fx: FxRuntime, box: { x: number; y: number }, R: number, dur: number): void {
  const u = fx.u
  let flames = 0
  run(fx, dur, (t, _p, dt) => {
    const g = fx.layers.glow
    const alpha = Math.min(1, t / 50) * (1 - span(t, dur - 220, dur))
    glowDisc(g, box.x, box.y, R * (0.9 + 0.1 * Math.sin(t * 0.02)), palette.rage, 0.32 * alpha)
    ring(g, box.x, box.y, R * (0.8 + 0.35 * easeOut(span(t, 0, 300))), palette.magma, 6 * u * (1 - span(t, 0, 400) * 0.7), 0.85 * alpha)
    flames += dt * 0.05
    while (flames >= 1) {
      flames -= 1
      const a = fx.between(-Math.PI * 0.95, -Math.PI * 0.05)
      fx.emit({ x: box.x + Math.cos(a) * R * 0.85, y: box.y + Math.sin(a) * R * 0.85, vx: fx.between(-30, 30) * u, vy: fx.between(-170, -80) * u, life: fx.between(360, 560), size: fx.between(3, 6), color: [palette.rage, palette.ember, palette.magmaDeep][Math.floor(fx.rand() * 3)]!, shape: 'dot', glow: true, drag: 0.8 })
    }
  })
}

/* ───────────────────────────── runes ───────────────────────────── */

export function paintRune(fx: FxRuntime, beat: Beat<'rune'>): void {
  const box = fx.box(beat.anchor)
  const R = radiusOf(fx, beat.anchor)
  const u = fx.u
  const pal = palettes[beat.school]
  // A mark sits over the target's head; the other sigils ring the figure.
  const cx = box.x
  const cy = beat.sigil === 'mark' ? box.y - box.h * 0.2 : box.y
  const radius = beat.sigil === 'mark' ? R * 0.5 : R * 0.7
  const land = beat.landMs
  if (fx.reduced) {
    run(fx, beat.durMs, (t) => ring(fx.layers.glow, cx, cy, radius, pal.mid, 5 * u, Math.min(1, t / 60) * (1 - span(t, 220, beat.durMs))))
    return
  }
  let motes = 0
  run(fx, beat.durMs, (t, _p, dt) => {
    const g = fx.layers.glow
    const grow = easeOutBack(span(t, 0, land))
    const alpha = Math.min(1, t / 50) * (1 - span(t, beat.durMs - 260, beat.durMs))
    const r = radius * (0.45 + 0.55 * grow)
    const turn = t * 0.0016
    ring(g, cx, cy, r, pal.mid, 4 * u, 0.95 * alpha)
    ring(g, cx, cy, r * 0.82, pal.core, 1.8 * u, 0.8 * alpha)
    for (let tick = 0; tick < 12; tick += 1) {
      const a = turn + tick * Math.PI / 6
      line(g, { x: cx + Math.cos(a) * r * 0.9, y: cy + Math.sin(a) * r * 0.9 }, { x: cx + Math.cos(a) * r * (tick % 3 === 0 ? 1.14 : 1.04), y: cy + Math.sin(a) * r * (tick % 3 === 0 ? 1.14 : 1.04) }, pal.core, 2.4 * u, 0.85 * alpha)
    }
    for (let glyph = 0; glyph < 3; glyph += 1) { const a = -turn * 1.4 + glyph * Math.PI * 2 / 3; diamond(g, cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97, 8 * u, 3.6 * u, a, pal.accent, alpha) }
    drawSigil(fx, beat.sigil, cx, cy, r * 0.68, t, alpha, pal)
    glowDisc(g, cx, cy, r * 0.9, pal.mid, 0.18 * alpha)
    motes += dt * (beat.sigil === 'heat' ? 0.07 : 0.04)
    while (motes >= 1) {
      motes -= 1
      const a = fx.rand() * Math.PI * 2
      fx.emit({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: fx.between(-12, 12) * u, vy: fx.between(-110, -40) * u, life: fx.between(420, 700), size: fx.between(2.2, 4), color: [pal.core, pal.mid, pal.accent][Math.floor(fx.rand() * 3)]!, shape: 'dot', glow: true, drag: 0.9 })
    }
  })
  fx.after(land, () => {
    flash(fx, cx, cy, radius * 0.9 / u, pal.core, 200, 0.7)
    shock(fx, cx, cy, radius * 0.5 / u, radius * 1.4 / u, pal.mid, 5, 300)
    sparks(fx, cx, cy, { count: 8, speed: [100, 260], life: [300, 520], size: [2.4, 4], colors: [pal.core, pal.mid, pal.accent], glow: true, gravity: -60 })
  })
}

function drawSigil(fx: FxRuntime, sigil: RuneSigil, x: number, y: number, r: number, t: number, alpha: number, pal: { mid: number; core: number; accent: number }): void {
  const g = fx.layers.glow
  const u = fx.u
  const spin = t * 0.0011
  const closed = (points: Pt[], color: number, width: number, a: number) => g.poly(points.flatMap(point => [point.x, point.y]), true).stroke({ color, width, alpha: a, join: 'round' })
  if (sigil === 'insight') {
    closed(polygon(x, y, r, 3, -Math.PI / 2 + spin), pal.core, 2.4 * u, 0.9 * alpha)
    closed(polygon(x, y, r, 3, Math.PI / 2 + spin), pal.mid, 2.4 * u, 0.9 * alpha)
    g.circle(x, y, r * 0.16).fill({ color: pal.core, alpha })
  } else if (sigil === 'mark') {
    closed(polygon(x, y, r, 4, spin), pal.core, 2.6 * u, 0.95 * alpha)
    line(g, { x: x - r * 0.5, y }, { x: x + r * 0.5, y }, pal.mid, 2.2 * u, 0.9 * alpha)
    line(g, { x, y: y - r * 0.5 }, { x, y: y + r * 0.5 }, pal.mid, 2.2 * u, 0.9 * alpha)
    g.circle(x, y, r * 0.14).fill({ color: pal.accent, alpha })
  } else if (sigil === 'seal') {
    closed(polygon(x, y, r, 6, spin), pal.core, 2.4 * u, 0.9 * alpha)
    closed(polygon(x, y, r * 0.62, 3, -spin * 1.5 - Math.PI / 2), pal.mid, 2.4 * u, 0.9 * alpha)
    g.circle(x, y, r * 0.12).fill({ color: pal.accent, alpha })
  } else {
    // heat: flame tongues around a ring
    ring(g, x, y, r * 0.55, pal.core, 2.2 * u, 0.9 * alpha)
    for (let tongue = 0; tongue < 6; tongue += 1) {
      const a = spin + tongue * Math.PI / 3
      g.poly([x + Math.cos(a - 0.2) * r * 0.55, y + Math.sin(a - 0.2) * r * 0.55, x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, x + Math.cos(a + 0.2) * r * 0.55, y + Math.sin(a + 0.2) * r * 0.55]).fill({ color: pal.mid, alpha: 0.8 * alpha })
    }
    g.circle(x, y, r * 0.14).fill({ color: pal.accent, alpha })
  }
}

/* ───────────────────────────── drawn cards ───────────────────────────── */

export function paintDraw(fx: FxRuntime, beat: Beat<'draw'>): void {
  const from = fx.box(beat.from)
  const hand = fx.box('hand')
  const u = fx.u
  const pal = palettes.arcane
  const target = { x: hand.x, y: hand.y - hand.h * 0.15 }
  if (fx.reduced) {
    fx.after(0, () => flash(fx, target.x, target.y, 40, pal.core, 240, 0.7))
    return
  }
  const flight = 380
  const motes = Array.from({ length: beat.count }, (_, index) => ({ delay: index * 110, bend: fx.between(-70, 70) * u, history: [] as Pt[] }))
  const start = { x: from.x, y: from.y - from.h * 0.05 }
  run(fx, beat.durMs, (t) => {
    const g = fx.layers.glow
    for (const mote of motes) {
      const p = span(t, mote.delay, mote.delay + flight)
      if (p <= 0 || p >= 1) continue
      const e = easeIn(p) * 0.35 + p * 0.65
      const control = { x: (start.x + target.x) / 2 + mote.bend, y: Math.min(start.y, target.y) + (target.y - start.y) * 0.2 }
      const i = 1 - e
      const point = { x: i * i * start.x + 2 * i * e * control.x + e * e * target.x, y: i * i * start.y + 2 * i * e * control.y + e * e * target.y }
      mote.history.push(point)
      if (mote.history.length > 8) mote.history.shift()
      for (let index = 1; index < mote.history.length; index += 1) { const k = index / mote.history.length; line(g, mote.history[index - 1]!, mote.history[index]!, pal.mid, 14 * u * k, 0.65 * k); line(g, mote.history[index - 1]!, mote.history[index]!, 0xffffff, 4 * u * k, 0.95 * k) }
      glowDisc(g, point.x, point.y, 24 * u, pal.mid, 1)
    }
  })
  for (const mote of motes) fx.after(mote.delay + flight, () => {
    flash(fx, target.x, target.y, 36, pal.core, 220, 0.8)
    sparks(fx, target.x, target.y, { count: 4, speed: [60, 160], life: [300, 480], size: [5, 8], colors: [0xffffff, pal.accent], shape: 'star', glow: true, drag: 2 })
  })
}

/* ───────────────────────────── the enemy gathers a blow ───────────────────────────── */

export function paintGather(fx: FxRuntime, beat: Beat<'gather'>): void {
  const box = fx.box(beat.anchor)
  const R = radiusOf(fx, beat.anchor)
  const u = fx.u
  const boss = beat.boss === true
  const inner = boss ? palette.magma : palette.ember
  const outer = boss ? palette.magmaDeep : 0xc88aff
  const land = beat.landMs
  const heroes = beat.targets.map(id => fx.box(id))
  if (fx.reduced) {
    run(fx, beat.durMs, (t) => ring(fx.layers.glow, box.x, box.y, R * 0.8, inner, 5 * u, Math.min(1, t / 60) * (1 - span(t, 260, beat.durMs))))
    return
  }
  let streaks = 0
  run(fx, beat.durMs, (t, _p, dt) => {
    const g = fx.layers.glow
    const charge = span(t, 0, land)
    const after = span(t, land, beat.durMs)
    const alpha = 1 - after
    ring(g, box.x, box.y, R * lerp(1.38, 0.78, easeOut(charge)) + after * R * 0.3, outer, 4 * u, 0.85 * alpha)
    ring(g, box.x, box.y, R * lerp(1.1, 0.6, easeOut(charge)) + after * R * 0.4, inner, 6 * u * (1 - after * 0.6), 0.95 * alpha)
    glowDisc(g, box.x, box.y, R * (0.1 + 0.32 * easeIn(charge) + after * 0.25), inner, (0.5 + 0.5 * charge) * alpha)
    if (t < land) {
      streaks += dt * (boss ? 0.12 : 0.09)
      while (streaks >= 1) {
        streaks -= 1
        const a = fx.rand() * Math.PI * 2
        const r = R * fx.between(1.0, 1.35)
        const speed = (r - R * 0.3) / 0.24
        fx.emit({ x: box.x + Math.cos(a) * r, y: box.y + Math.sin(a) * r, vx: -Math.cos(a) * speed, vy: -Math.sin(a) * speed, life: 230, size: fx.between(2.4, 4), color: fx.rand() < 0.5 ? inner : outer, shape: 'streak', glow: true })
      }
    }
    // the party is shown who is aimed at, and only that
    for (const hero of heroes) {
      const turn = t * 0.0014
      for (let dash = 0; dash < 6; dash += 1) arc(g, hero.x, hero.y, Math.min(hero.w, hero.h) * 0.52, turn + dash * Math.PI / 3, turn + dash * Math.PI / 3 + 0.5, inner, 4 * u, 0.85 * Math.min(1, t / 160) * (1 - span(t, beat.durMs - 220, beat.durMs)))
    }
  })
  fx.after(land, () => {
    flash(fx, box.x, box.y, R * 0.7 / u, inner, 200, 0.8)
    shock(fx, box.x, box.y, R * 0.4 / u, R * 1.2 / u, inner, 6, 320)
    if (boss) sparks(fx, box.x, box.y, { count: 10, speed: [40, 150], life: [500, 800], size: [2.6, 4.6], colors: [palette.ember, palette.magma], shape: 'dot', glow: true, gravity: -150, angle: -Math.PI / 2, spread: Math.PI * 1.4 })
  })
}

/** A gathered blow the party has stopped: the ring cracks apart and drifts away, and nothing flies at the heroes. */
export function paintBreak(fx: FxRuntime, beat: Beat<'break'>): void {
  const box = fx.box(beat.anchor)
  const R = radiusOf(fx, beat.anchor)
  const u = fx.u
  const boss = beat.boss === true
  const inner = boss ? palette.magma : palette.ember
  const land = beat.landMs
  if (fx.reduced) {
    fx.after(land, () => flash(fx, box.x, box.y, R * 0.6 / u, 0xcdbbff, 220, 0.6))
    return
  }
  const pieces = 6
  const spin = fx.between(0, 1)
  run(fx, beat.durMs, (t) => {
    const g = fx.layers.glow
    const broken = easeOut(span(t, land, land + 360))
    const alpha = t < land ? 1 : 1 - broken
    for (let piece = 0; piece < pieces; piece += 1) {
      const a0 = spin + piece * Math.PI * 2 / pieces
      const drift = broken * R * 0.55
      const mid = a0 + Math.PI / pieces
      const ox = Math.cos(mid) * drift
      const oy = Math.sin(mid) * drift
      arc(g, box.x + ox, box.y + oy, R * 0.8 * (1 + broken * 0.2), a0 + 0.04, a0 + Math.PI * 2 / pieces - 0.04, inner, 6 * u * (1 - broken * 0.5), 0.95 * alpha)
    }
    if (t < land) glowDisc(g, box.x, box.y, R * 0.32, inner, 0.6)
  })
  fx.after(land, () => {
    flash(fx, box.x, box.y, R * 0.55 / u, 0xe6ddff, 180, 0.7)
    sparks(fx, box.x, box.y, { count: 10, speed: [120, 300], life: [380, 620], size: [7, 12], colors: [0xcdbbff, 0x8a7aa8, inner], shape: 'shard', drag: 2, gravity: 200 })
    sparks(fx, box.x, box.y, { count: 6, speed: [20, 70], life: [480, 760], size: [12, 20], colors: [0xb8aad0, 0x8a7aa8], shape: 'dot', alpha: 0.35, grow: 1.2, drag: 1 })
  })
}
