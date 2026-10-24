import type { VfxBeat, VfxPlan } from './types'
import { soundCues, type SoundCue } from '../audio/cues'

/** What the runner needs from a canvas: draw one beat, and call something later on the canvas's own clock. */
export interface PaintHost {
  paint(beat: VfxBeat): void
  after(ms: number, run: () => void): void
}

export interface PlanHooks {
  /** The visuals have reached the target: report `impact` for the action. Called exactly once per run. */
  onImpact(): void
  /** False once the action has been replaced or cancelled; nothing scheduled earlier may draw or report after that. */
  current(): boolean
  /** Decorative cues share the exact canvas clock, including lab slow motion. Never awaited. */
  onSound?(cue: SoundCue): void
}

/**
 * Plays a plan. Every beat, and the one impact, is scheduled up front on the host's clock; all of them check `current()` when they fire,
 * so a plan that has been superseded (a new action, a new battle, an unmounted scene) can never paint a late hit or report a stale impact.
 * The game action is applied by whoever receives `onImpact`; the beats around it are only decoration and never touch game state.
 */
export function runPlan(plan: VfxPlan, host: PaintHost, hooks: PlanHooks): void {
  let reported = false
  host.after(plan.impactMs, () => {
    if (reported || !hooks.current()) return
    reported = true
    hooks.onImpact()
  })
  for (const beat of plan.beats) host.after(beat.at, () => { if (hooks.current()) host.paint(beat) })
  if (hooks.onSound) for (const cue of soundCues(plan)) host.after(cue.at, () => {
    if (hooks.current()) { try { hooks.onSound?.(cue) } catch { /* sound cannot interrupt the canvas or impact */ } }
  })
}
