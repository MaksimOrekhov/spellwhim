/**
 * A tiny deterministic scheduler: callbacks are due at a time on a clock that only moves when `advance` is called (the render ticker
 * feeds it frame by frame; a test feeds it by hand). Used instead of setTimeout so that every beat of one effect shares one clock.
 */
export class Timeline {
  private queue: { at: number; order: number; run: () => void }[] = []
  private sequence = 0
  now = 0

  after(ms: number, run: () => void): void {
    this.queue.push({ at: this.now + Math.max(0, ms), order: this.sequence++, run })
    this.queue.sort((a, b) => a.at - b.at || a.order - b.order)
  }

  /** Moves the clock and runs everything that has come due, in time order. Work scheduled by a callback for "now" runs in the same call. */
  advance(dt: number): void {
    this.now += dt
    while (this.queue.length && this.queue[0]!.at <= this.now) this.queue.shift()!.run()
  }

  get pending(): number { return this.queue.length }

  clear(): void {
    this.queue = []
    this.now = 0
  }
}
