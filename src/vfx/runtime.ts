import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { Application, Ticker } from 'pixi.js'
import { fontFamily } from '../ui/typography'
import { easeOut, easeOutBack, span } from './draw'
import { ParticlePool } from './particles'
import { Timeline } from './timeline'
import type { ParticleSpec } from './particles'
import type { PaintHost } from './run'
import type { NumberSize, NumberTone, VfxBeat, VfxPoint } from './types'

export interface Box { x: number; y: number; w: number; h: number }
export interface Layers { under: Graphics; glow: Graphics; over: Graphics }
/** One running effect: advance by `dt` ms, draw into the layers, return true when finished. */
export type Actor = (dt: number) => boolean
export interface FxStats { actors: number; particles: number; timers: number; labels: number; children: number; ticking: boolean; /** Milliseconds of the current plan the canvas has played. */ clock: number }

const POINTS: readonly VfxPoint[] = ['warrior', 'mage', 'enemy', 'hand']
const PARTICLE_CAP = 200
const REDUCED_PARTICLE_CAP = 24
const LABEL_POOL = 14

interface ToneStyle { fill: number; stroke: number; glow?: number }
const toneStyles: Record<NumberTone, ToneStyle> = {
  damage: { fill: 0xfff4d6, stroke: 0x4a1a14 },
  lethal: { fill: 0xffdcd2, stroke: 0x6a0a0a, glow: 0xff3a2a },
  'armor-hit': { fill: 0xc4ebff, stroke: 0x0e3350 },
  'armor-gain': { fill: 0xc2f8ff, stroke: 0x0a3550 },
  block: { fill: 0xf0f9ff, stroke: 0x1c4a78, glow: 0x6fc8ff },
  bonus: { fill: 0xffe08a, stroke: 0x4a2f06 },
  vulnerability: { fill: 0xffd070, stroke: 0x5a2a05 },
  bleed: { fill: 0xff8c96, stroke: 0x4a0a14 },
  frost: { fill: 0xd2f3ff, stroke: 0x0d3350 },
  draw: { fill: 0xeed6ff, stroke: 0x2e1458 },
  info: { fill: 0xf6edd2, stroke: 0x2a2418 },
  rage: { fill: 0xffb080, stroke: 0x4a1308 },
}
const sizePx: Record<NumberSize, number> = { xl: 58, l: 44, m: 30, s: 22 }
/** Where a lane sits below the first one, in units of `u`. */
const laneOffset = [0, 36, 66, 92]
const riseFor: Record<NumberSize, number> = { xl: 56, l: 46, m: 38, s: 30 }

interface Label { text: Text; age: number; dur: number; x: number; y: number; rise: number; heavy: boolean; scale: number; reduced: boolean }

/**
 * The PixiJS side of the battle effects: one ticker callback, three redrawn-every-frame Graphics layers, a capped particle pool, a pool of
 * Text labels and a timeline. Painters never create display objects of their own, so there is nothing to leak: `clear()` between actions and
 * `destroy()` on unmount reset everything that exists. When nothing is alive the ticker stops, so an idle battle costs no frames.
 */
export class FxRuntime implements PaintHost {
  readonly layers: Layers
  readonly pool = new ParticlePool(PARTICLE_CAP)
  readonly timeline = new Timeline()
  /** Set per plan: calm confirmations instead of flying particles. */
  reduced = false
  /** Size unit: 1 at a 720 px tall scene. */
  u = 1
  /** Lab only: slows the clock / freezes the picture at a given moment of the plan. */
  timeScale = 1
  holdAt: number | null = null
  private clock = 0
  private readonly root = new Container()
  private readonly textLayer = new Container()
  private actors: Actor[] = []
  private labels: Label[] = []
  private freeLabels: Text[] = []
  private styles = new Map<string, TextStyle>()
  private boxes = new Map<VfxPoint, Box>()
  private idleFrames = 0
  private seed = 1
  private disposed = false
  private paintFn: ((fx: FxRuntime, beat: VfxBeat) => void) | null = null

  constructor(private readonly app: Application, private readonly host: HTMLElement) {
    const under = new Graphics()
    const glow = new Graphics()
    const over = new Graphics()
    glow.blendMode = 'add'
    this.layers = { under, glow, over }
    this.root.addChild(under, glow, over, this.textLayer)
    app.stage.addChild(this.root)
    app.ticker.add(this.tick)
    this.measure()
  }

  /** Painters are injected so the runtime stays a small, testable core and the painters can import it freely. */
  setPainter(paint: (fx: FxRuntime, beat: VfxBeat) => void): void { this.paintFn = paint }

  paint(beat: VfxBeat): void { this.paintFn?.(this, beat) }

  after(ms: number, run: () => void): void {
    this.timeline.after(ms, run)
    this.wake()
  }

  add(actor: Actor): void {
    this.actors.push(actor)
    this.wake()
  }

  emit(spec: ParticleSpec): void {
    if (this.reduced && spec.shape !== 'dot') return
    this.pool.emit(spec)
    this.wake()
  }

  /** Visual randomness: seeded per plan so a lab replay draws the same picture. */
  rand = (): number => {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0
    let t = this.seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  between(min: number, max: number): number { return min + (max - min) * this.rand() }

  /** Start of a plan: forget the previous one, reseed, re-measure the portraits. */
  begin(seedText: string, reduced: boolean): void {
    this.clear()
    let hash = 2166136261
    for (const char of seedText) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    this.seed = hash >>> 0
    this.reduced = reduced
    this.pool.cap = reduced ? REDUCED_PARTICLE_CAP : PARTICLE_CAP
    this.measure()
  }

  /** Reads the anchors of the portraits and of the hand from the DOM, relative to the canvas. Called at the start of each plan and on resize. */
  measure(): void {
    const canvasBox = this.host.getBoundingClientRect()
    this.u = Math.min(1.8, Math.max(0.8, canvasBox.height / 720))
    const scene = this.host.closest('[data-battle-scene]')
    const root = this.host.closest('.game-wrap') ?? document
    for (const key of POINTS) {
      const element = scene?.querySelector<HTMLElement>(`[data-fx-anchor="${key}"]`) ?? root.querySelector<HTMLElement>(`[data-fx-anchor="${key}"]`)
      if (!element) { this.boxes.delete(key); continue }
      const rect = element.getBoundingClientRect()
      this.boxes.set(key, { x: rect.left + rect.width / 2 - canvasBox.left, y: rect.top + rect.height / 2 - canvasBox.top, w: rect.width, h: rect.height })
    }
  }

  /** Where a portrait (or the hand) is. Missing anchors fall back to the middle of the canvas so a painter never has to guess. */
  box(point: VfxPoint): Box {
    return this.boxes.get(point) ?? { x: this.host.clientWidth / 2, y: this.host.clientHeight / 2, w: 120, h: 120 }
  }
  has(point: VfxPoint): boolean { return this.boxes.has(point) }

  /** Floating text. See `numberLabel` for the placement rules. */
  label(point: VfxPoint, text: string, tone: NumberTone, size: NumberSize, lane: number, heavy: boolean, dur: number): void {
    const box = this.box(point)
    const hero = point !== 'enemy'
    // Enemy: above the middle of the medallion (name and health ride its lower rim). Hero: from the lower half of the arch, rising towards the plate.
    const baseY = hero ? box.y + box.h * 0.08 : box.y - box.h * 0.12
    const item = this.freeLabels.pop() ?? (this.labels.length + this.freeLabels.length < LABEL_POOL ? this.makeText() : null)
    if (!item) return
    const style = this.styleFor(tone, size)
    item.style = style
    item.text = text
    item.anchor.set(0.5)
    item.alpha = 0
    item.visible = true
    const u = this.u
    this.labels.push({ text: item, age: 0, dur, x: box.x, y: baseY + (laneOffset[lane] ?? 92) * u, rise: riseFor[size] * u, heavy, scale: 1, reduced: this.reduced })
    this.wake()
  }

  clear(): void {
    this.timeline.clear()
    this.actors = []
    this.pool.clear()
    for (const label of this.labels) this.release(label.text)
    this.labels = []
    this.clock = 0
    this.holdAt = null
    for (const layer of [this.layers.under, this.layers.glow, this.layers.over]) layer.clear()
    this.reduced = false
  }

  stats(): FxStats {
    return { actors: this.actors.length, particles: this.pool.count, timers: this.timeline.pending, labels: this.labels.length, children: this.textLayer.children.filter(child => child.visible).length + this.root.children.length - 1, ticking: this.app.ticker.started, clock: Math.round(this.clock) }
  }

  destroy(): void {
    this.disposed = true
    this.app.ticker.remove(this.tick)
    this.clear()
    this.root.destroy({ children: true })
    for (const style of this.styles.values()) style.destroy()
    this.styles.clear()
    this.freeLabels = []
  }

  private makeText(): Text {
    const text = new Text({ text: '', style: this.styleFor('damage', 'l') })
    this.textLayer.addChild(text)
    return text
  }

  private release(text: Text): void {
    text.visible = false
    text.scale.set(1)
    this.freeLabels.push(text)
  }

  private styleFor(tone: NumberTone, size: NumberSize): TextStyle {
    const key = tone + size + this.u.toFixed(2)
    const known = this.styles.get(key)
    if (known) return known
    const tint = toneStyles[tone]
    const px = Math.round(sizePx[size] * this.u)
    const style = new TextStyle({
      fontFamily: fontFamily('--font-display'), fontSize: px, fontWeight: 'bold', fill: tint.fill, stroke: { color: tint.stroke, width: Math.max(4, Math.round(px * 0.17)), join: 'round' },
      dropShadow: { color: tint.glow ?? 0x120e20, blur: tint.glow ? 10 : 6, distance: tint.glow ? 0 : 3, alpha: tint.glow ? 0.9 : 0.8 },
    })
    this.styles.set(key, style)
    return style
  }

  private wake(): void {
    this.idleFrames = 0
    if (!this.disposed && !this.app.ticker.started) this.app.ticker.start()
  }

  private tick = (ticker: Ticker): void => {
    if (this.disposed) return
    let dt = Math.min(ticker.deltaMS, 50) * this.timeScale
    if (this.holdAt !== null) dt = Math.max(0, Math.min(dt, this.holdAt - this.clock))
    this.clock += dt
    this.timeline.advance(dt)
    const { under, glow, over } = this.layers
    under.clear()
    glow.clear()
    over.clear()
    if (this.actors.length) this.actors = this.actors.filter(actor => !actor(dt))
    this.pool.update(dt)
    this.drawParticles()
    this.updateLabels(dt)
    const busy = this.actors.length || this.pool.count || this.timeline.pending || this.labels.length
    this.idleFrames = busy ? 0 : this.idleFrames + 1
    // One more frame after the last effect is gone so the cleared layers are rendered, then the ticker rests.
    if (this.idleFrames > 2) this.app.ticker.stop()
  }

  private updateLabels(dt: number): void {
    if (!this.labels.length) return
    this.labels = this.labels.filter(label => {
      label.age += dt
      const p = Math.min(1, label.age / label.dur)
      if (p >= 1) { this.release(label.text); return false }
      const text = label.text
      const enter = span(label.age, 0, label.reduced ? 60 : label.heavy ? 150 : 110)
      const scale = label.reduced ? 1 : label.heavy ? 1.55 - 0.55 * easeOut(enter) : 0.5 + 0.5 * easeOutBack(enter)
      text.scale.set(scale)
      text.position.set(label.x, label.y - (label.reduced ? 0 : label.rise * easeOut(p)))
      text.alpha = Math.min(1, label.age / 50) * (p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38)
      text.rotation = label.reduced || label.heavy ? 0 : Math.sin(p * Math.PI) * -0.05
      return true
    })
  }

  private drawParticles(): void {
    if (!this.pool.count) return
    for (const p of this.pool.live) {
      const t = p.age / p.life
      const fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88
      const alpha = p.alpha * Math.max(0, fade)
      if (alpha <= 0.01) continue
      const size = p.size * this.u * (1 + p.grow * t)
      const g = p.glow ? this.layers.glow : this.layers.over
      if (p.shape === 'dot') g.circle(p.x, p.y, size).fill({ color: p.color, alpha })
      else if (p.shape === 'streak') g.moveTo(p.x, p.y).lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05).stroke({ color: p.color, width: Math.max(1.6, size * 0.85), alpha, cap: 'round' })
      else if (p.shape === 'shard') {
        const angle = Math.atan2(p.vy, p.vx)
        const c = Math.cos(angle)
        const s = Math.sin(angle)
        g.poly([p.x + c * size, p.y + s * size, p.x - s * size * 0.34, p.y + c * size * 0.34, p.x - c * size * 0.5, p.y - s * size * 0.5, p.x + s * size * 0.34, p.y - c * size * 0.34]).fill({ color: p.color, alpha })
      } else {
        const points: number[] = []
        for (let index = 0; index < 8; index += 1) {
          const radius = index % 2 === 0 ? size : size * 0.26
          const angle = p.age * 0.004 + index * Math.PI / 4
          points.push(p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius)
        }
        g.poly(points).fill({ color: p.color, alpha })
      }
    }
  }
}
