import { arc, diamond, drawLattice, easeOut, easeOutBack, glowDisc, line, polygon, ring, shieldPath, span } from '../draw'
import { palette, palettes } from '../palette'
import type { Palette } from '../palette'
import type { FxRuntime } from '../runtime'
import type { GuardStyle } from '../types'
import { flash, run, shock, sparks, toward } from './kit'
import type { Beat } from './kit'

const clampSize = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** The warrior's shield: a steel kite with a bronze inner rim and a gold boss. Drawn on the normal layer. */
export function drawSteelShield(fx: FxRuntime, x: number, y: number, w: number, h: number, alpha: number): void {
  const u = fx.u
  const g = fx.layers.over
  g.poly(shieldPath(x, y, w, h), true).fill({ color: palette.steelMid, alpha: 0.94 * alpha }).stroke({ color: palette.steel, width: 5 * u, alpha, join: 'round' })
  // the right half in shade and a lit edge on the left give the steel some body
  const hw = w / 2
  const hh = h / 2
  g.poly([x, y - hh * 0.97, x + hw * 0.35, y - hh * 0.9, x + hw, y - hh, x + hw * 0.96, y + hh * 0.08, x + hw * 0.62, y + hh * 0.56, x, y + hh]).fill({ color: palette.steelDark, alpha: 0.38 * alpha })
  line(g, { x: x - hw * 0.8, y: y - hh * 0.78 }, { x: x - hw * 0.8, y: y - hh * 0.05 }, 0xffffff, 3.4 * u, 0.7 * alpha)
  g.poly(shieldPath(x, y, w * 0.74, h * 0.76), true).fill({ color: palette.steel, alpha: 0.42 * alpha }).stroke({ color: palette.bronze, width: 2.6 * u, alpha, join: 'round' })
  line(g, { x, y: y - h * 0.38 }, { x, y: y + h * 0.4 }, palette.steelDark, 2 * u, 0.45 * alpha)
  g.circle(x, y - h * 0.02, w * 0.13).fill({ color: palette.goldHot, alpha }).stroke({ color: palette.bronze, width: 2 * u, alpha })
  for (const [dx, dy] of [[-0.3, -0.36], [0.3, -0.36], [-0.27, 0.12], [0.27, 0.12]] as const) g.circle(x + dx * w, y + dy * h, 2.4 * u).fill({ color: palette.goldHot, alpha: 0.9 * alpha })
}

/** The mage's barrier: nested hexagons with rune diamonds on the corners. `crystals` makes it ice. */
export function drawBarrier(fx: FxRuntime, x: number, y: number, r: number, t: number, alpha: number, pal: Palette, crystals: boolean): void {
  const u = fx.u
  const outer = polygon(x, y, r, 6, t * 0.0007 - Math.PI / 2)
  const inner = polygon(x, y, r * 0.7, 6, -t * 0.0009 - Math.PI / 2)
  fx.layers.under.poly(outer.flatMap(point => [point.x, point.y]), true).fill({ color: pal.mid, alpha: 0.13 * alpha })
  const g = fx.layers.glow
  g.poly(outer.flatMap(point => [point.x, point.y]), true).stroke({ color: pal.mid, width: 4 * u, alpha: 0.9 * alpha, join: 'round' })
  g.poly(inner.flatMap(point => [point.x, point.y]), true).stroke({ color: pal.core, width: 2 * u, alpha: 0.7 * alpha, join: 'round' })
  for (const [index, point] of outer.entries()) {
    const angle = toward({ x, y }, point)
    diamond(g, point.x, point.y, (crystals ? 13 : 8) * u, (crystals ? 5 : 3.4) * u, crystals && index % 2 === 0 ? angle : angle + Math.PI / 2, pal.core, alpha)
  }
  arc(g, x, y, r * 0.86, -Math.PI * 0.82, -Math.PI * 0.18, 0xffffff, 3 * u, 0.5 * alpha)
  if (crystals) drawLattice(g, x, y, r * 0.55, 1, 0.35 * alpha, u)
}

/** How a hero's armor looks, whatever happens to it: a shield for the warrior's, a barrier for the mage's. */
function drawArmor(fx: FxRuntime, style: GuardStyle, x: number, y: number, size: number, t: number, alpha: number): void {
  if (style === 'steel') drawSteelShield(fx, x, y, size * 0.8, size, alpha)
  else drawBarrier(fx, x, y, size * 0.62, t, alpha, style === 'frost' ? palettes.frost : palettes.arcane, style === 'frost')
}

const armorSize = (fx: FxRuntime, boxH: number) => clampSize(boxH * 0.46, 84 * fx.u, 210 * fx.u)

/** Reduced motion: the shield simply appears, holds and fades. */
function calmGuard(fx: FxRuntime, beat: Beat<'guard'>): void {
  const box = fx.box(beat.anchor)
  const size = armorSize(fx, box.h) * 0.9
  const style = beat.style
  run(fx, beat.durMs, t => {
    const alpha = Math.min(1, t / 80) * (1 - span(t, beat.durMs - 200, beat.durMs))
    drawArmor(fx, style === 'plate' ? 'steel' : style, box.x, box.y, size, 0, alpha * 0.9)
  })
  fx.after(beat.landMs, () => flash(fx, box.x, box.y, 46, style === 'frost' ? palettes.frost.core : style === 'arcane' ? palettes.arcane.core : palette.steel, 200, 0.6))
}

export function paintGuard(fx: FxRuntime, beat: Beat<'guard'>): void {
  if (fx.reduced) return calmGuard(fx, beat)
  if (beat.style === 'plate') return plates(fx, beat)
  const box = fx.box(beat.anchor)
  const u = fx.u
  const size = armorSize(fx, box.h)
  const land = beat.landMs
  const pal = beat.style === 'frost' ? palettes.frost : palettes.arcane
  let motes = 0
  run(fx, beat.durMs, (t, _p, dt) => {
    const grow = easeOutBack(span(t, 0, land))
    const alpha = Math.min(1, t / 60) * (1 - span(t, beat.durMs - 220, beat.durMs))
    const bob = Math.sin(t * 0.008) * 1.5 * u
    if (beat.style === 'steel') {
      glowDisc(fx.layers.glow, box.x, box.y, size * 0.7 * Math.min(1, grow), palette.gold, 0.18 * alpha)
      drawSteelShield(fx, box.x, box.y + bob, size * 0.8 * (0.4 + 0.6 * grow), size * (0.4 + 0.6 * grow), alpha)
      const q = span(t, land - 40, land + 320)
      if (q > 0 && q < 1) {
        const gx = box.x - size * 0.34 + size * 0.68 * q
        line(fx.layers.glow, { x: gx, y: box.y - size * 0.38 }, { x: gx - size * 0.22, y: box.y + size * 0.08 }, 0xffffff, 5 * u, 0.55 * Math.sin(q * Math.PI) * alpha)
      }
    } else {
      drawBarrier(fx, box.x, box.y + bob, size * 0.62 * (0.5 + 0.5 * grow), t, alpha, pal, beat.style === 'frost')
      motes += dt * 0.035
      while (motes >= 1) {
        motes -= 1
        const a = fx.rand() * Math.PI * 2
        fx.emit({ x: box.x + Math.cos(a) * size * 0.6, y: box.y + Math.sin(a) * size * 0.6, vx: fx.between(-10, 10) * u, vy: fx.between(-60, -20) * u, life: fx.between(380, 620), size: fx.between(2, 3.6), color: [pal.core, pal.mid, pal.accent][Math.floor(fx.rand() * 3)]!, shape: 'dot', glow: true, drag: 1 })
      }
    }
  })
  fx.after(land, () => {
    if (beat.style === 'steel') {
      shock(fx, box.x, box.y, 24, 92, palette.steel, 8, 300)
      sparks(fx, box.x, box.y, { count: 9, speed: [160, 340], life: [220, 380], size: [2.2, 3.8], colors: [palette.steel, 0xffffff, palette.gold], glow: true, gravity: 420 })
    } else {
      shock(fx, box.x, box.y, 30, size * 0.8, pal.mid, 6, 380)
      shock(fx, box.x, box.y, 20, size * 0.62, pal.core, 3, 320)
      flash(fx, box.x, box.y, 50, pal.core, 200, 0.6)
    }
  })
}

/** The enemy's armor: iron plates sliding in around the medallion. */
function plates(fx: FxRuntime, beat: Beat<'guard'>): void {
  const box = fx.box(beat.anchor)
  const u = fx.u
  const radius = Math.min(box.w, box.h) * 0.5
  const land = beat.landMs
  const count = 6
  const gap = 0.2
  const arcLength = Math.PI * 2 / count - gap
  run(fx, beat.durMs, t => {
    const e = easeOutBack(span(t, 0, land))
    const alpha = Math.min(1, t / 60) * (1 - span(t, beat.durMs - 200, beat.durMs))
    const r = radius * (1.55 - 0.55 * e) * 1.02
    const g = fx.layers.over
    for (let index = 0; index < count; index += 1) {
      const start = index * Math.PI * 2 / count + Math.PI * 0.08 + (1 - e) * 0.5
      arc(g, box.x, box.y, r, start, start + arcLength, palette.plateDark, 17 * u, 0.95 * alpha)
      arc(g, box.x, box.y, r, start, start + arcLength, palette.plate, 10 * u, 0.95 * alpha)
      arc(g, box.x, box.y, r + 3 * u, start + 0.05, start + arcLength - 0.05, 0xffffff, 1.8 * u, 0.55 * alpha)
    }
  })
  fx.after(land, () => {
    shock(fx, box.x, box.y, radius * 0.7, radius * 1.15, palette.steel, 6, 300)
    sparks(fx, box.x, box.y, { count: 12, speed: [120, 300], life: [240, 420], size: [2.2, 3.6], colors: [palette.steel, 0xffffff, palette.gold], glow: true, gravity: 380 })
    sparks(fx, box.x, box.y + radius * 0.6, { count: 6, speed: [20, 80], life: [420, 700], size: [10, 18], colors: [palette.dust, palette.stone], shape: 'dot', alpha: 0.35, grow: 1, drag: 1.2 })
  })
}

/** The enemy's armor meeting a card: sparks when it holds, plates flying when it is gone. */
export function paintArmorFx(fx: FxRuntime, beat: Beat<'armor-fx'>): void {
  const box = fx.box(beat.anchor)
  const u = fx.u
  const radius = Math.min(box.w, box.h) * 0.5
  if (fx.reduced) {
    flash(fx, box.x, box.y, 40, palette.steel, 200, 0.5)
    return
  }
  run(fx, beat.durMs, (_t, p) => arc(fx.layers.glow, box.x, box.y, radius * 1.02, -Math.PI * 0.9, -Math.PI * 0.1, palette.steel, 6 * u, (1 - p) ** 1.5 * (beat.mode === 'break' ? 0.6 : 0.9)))
  if (beat.mode === 'hit') {
    sparks(fx, box.x, box.y, { count: 9, speed: [180, 380], life: [200, 340], size: [2, 3.4], colors: [palette.steel, 0xffffff, palette.gold], glow: true, gravity: 520, angle: -Math.PI / 2, spread: Math.PI * 1.5 })
  } else {
    flash(fx, box.x, box.y, 64, palette.steel, 200, 0.8)
    shock(fx, box.x, box.y, radius * 0.6, radius * 1.3, palette.steel, 8, 320)
    sparks(fx, box.x, box.y, { count: 10, speed: [160, 420], life: [420, 700], size: [9, 15], colors: [palette.plate, palette.plateDark, palette.steelMid], shape: 'shard', gravity: 760, drag: 0.8 })
    sparks(fx, box.x, box.y, { count: 10, speed: [200, 420], life: [240, 400], size: [2, 3.6], colors: [palette.steel, 0xffffff, palette.gold], glow: true, gravity: 500 })
  }
}

/** How an enemy blow met a hero's armor. The numbers beside it come from the same forecast. */
export function paintResult(fx: FxRuntime, beat: Beat<'result'>): void {
  const box = fx.box(beat.hero)
  const enemy = fx.box('enemy')
  const u = fx.u
  const size = armorSize(fx, box.h)
  const style = beat.style
  const pal = style === 'steel' ? { core: 0xffffff, mid: palette.steelMid, spark: palette.steel } : style === 'frost' ? palettes.frost : palettes.arcane
  const angle = toward(enemy, box)
  if (fx.reduced) {
    if (beat.outcome !== 'fizzle') flash(fx, box.x, box.y, 46, pal.mid, 220, 0.6)
    return
  }
  switch (beat.outcome) {
    case 'block':
      // The armor takes the blow whole: it flares and gives way.
      run(fx, beat.durMs, t => {
        const alpha = 1 - span(t, 120, 440)
        drawArmor(fx, style, box.x, box.y, size * (1 + 0.06 * Math.sin(Math.min(1, t / 120) * Math.PI)), t, alpha)
      })
      shock(fx, box.x, box.y, 24, 100, pal.mid, 9, 300)
      flash(fx, box.x, box.y, 54, pal.core, 160, 0.8)
      sparks(fx, box.x, box.y, { count: style === 'steel' ? 12 : 8, speed: [160, 360], life: [220, 400], size: [2.2, 3.8], colors: [pal.spark, 0xffffff, pal.mid], glow: true, angle: angle + Math.PI, spread: 2.8, gravity: 420 })
      break
    case 'shatter':
    case 'pierce': {
      const pierced = beat.outcome === 'pierce'
      run(fx, 200, (t) => {
        const alpha = 1 - span(t, 70, 200)
        if (pierced) {
          // a ring with a gap where the needle went through
          const gapAt = angle + Math.PI
          arc(fx.layers.glow, box.x, box.y, size * 0.6, gapAt + 0.45, gapAt + Math.PI * 2 - 0.45, pal.mid, 5 * u, alpha)
        } else drawArmor(fx, style, box.x, box.y, size, t, alpha)
      })
      fx.after(pierced ? 40 : 70, () => {
        flash(fx, box.x, box.y, 58, pal.core, 170, 0.85)
        shock(fx, box.x, box.y, 20, 90, pal.mid, 8, 280)
        sparks(fx, box.x, box.y, { count: 11, speed: [180, 460], life: [420, 700], size: [9, 15], colors: style === 'steel' ? [palette.steel, palette.steelMid, palette.bronze] : [pal.core, pal.mid, pal.spark], shape: 'shard', gravity: 620, drag: 0.8 })
        if (pierced) sparks(fx, box.x, box.y, { count: 6, speed: [260, 520], life: [200, 340], size: [2, 3.2], colors: [0xfff1c4, 0xffffff], glow: true, angle, spread: 0.6 })
      })
      break
    }
    case 'fizzle':
      // The blow was weakened to nothing: a puff of cold and no flash.
      run(fx, 360, (_t, p) => ring(fx.layers.glow, box.x, box.y, (24 + 40 * easeOut(p)) * u, palettes.frost.mid, 4 * u * (1 - p), (1 - p) ** 1.4 * 0.7))
      sparks(fx, box.x, box.y, { count: 7, speed: [20, 80], life: [420, 700], size: [8, 14], colors: [palettes.frost.core, palettes.frost.mid], shape: 'dot', glow: true, alpha: 0.4, grow: 1.2, drag: 1 })
      break
  }
}
