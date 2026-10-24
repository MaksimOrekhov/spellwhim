export type ParticleShape = 'dot' | 'streak' | 'shard' | 'star'

export interface ParticleSpec {
  x: number
  y: number
  /** Pixels per second. */
  vx: number
  vy: number
  /** Milliseconds. */
  life: number
  size: number
  color: number
  shape?: ParticleShape
  /** Drawn with additive blending (light) instead of normally. */
  glow?: boolean
  alpha?: number
  /** Pixels per second squared; negative rises. */
  gravity?: number
  /** Share of the speed lost per second. */
  drag?: number
  /** Relative growth over the life (0.5 = half again as big at the end). */
  grow?: number
}

export interface Particle extends Required<ParticleSpec> { age: number }

/**
 * A capped pool of short-lived particles. The cap is the performance promise: when it is full the newest sparks are dropped, never the
 * frame rate. Pure data, so it is tested without a canvas; the painters draw `live` once per frame.
 */
export class ParticlePool {
  readonly live: Particle[] = []
  private readonly free: Particle[] = []

  constructor(public cap: number) {}

  emit(spec: ParticleSpec): boolean {
    if (this.live.length >= this.cap) return false
    const particle = this.free.pop() ?? ({} as Particle)
    Object.assign(particle, { shape: 'dot', glow: false, alpha: 1, gravity: 0, drag: 0, grow: 0 }, spec, { age: 0 })
    this.live.push(particle)
    return true
  }

  update(dt: number): void {
    const seconds = dt / 1000
    for (let index = this.live.length - 1; index >= 0; index -= 1) {
      const p = this.live[index]!
      p.age += dt
      if (p.age >= p.life) {
        this.live[index] = this.live[this.live.length - 1]!
        this.live.pop()
        this.free.push(p)
        continue
      }
      const keep = Math.max(0, 1 - p.drag * seconds)
      p.vx *= keep
      p.vy = p.vy * keep + p.gravity * seconds
      p.x += p.vx * seconds
      p.y += p.vy * seconds
    }
  }

  clear(): void {
    while (this.live.length) this.free.push(this.live.pop()!)
  }

  get count(): number { return this.live.length }
}
