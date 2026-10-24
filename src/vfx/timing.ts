import type { StrikeStyle } from './types'

/**
 * Timings of the beats, in milliseconds, shared by the plan builders and the painters so that a plan can state exactly when a blow lands
 * and when input may be released again. `land` is the moment of contact (the engine applies the action then); `tail` is what still plays after it.
 */
export const STRIKE_TIMING: Record<StrikeStyle, { land: number; tail: number }> = {
  slash: { land: 150, tail: 260 },
  lunge: { land: 90, tail: 200 },
  cleave: { land: 250, tail: 380 },
  bash: { land: 190, tail: 330 },
  fireball: { land: 380, tail: 380 },
  frostbolt: { land: 300, tail: 360 },
  lightning: { land: 140, tail: 300 },
  'arcane-bolt': { land: 340, tail: 340 },
  chill: { land: 170, tail: 520 },
  claw: { land: 140, tail: 260 },
  slam: { land: 230, tail: 420 },
  needle: { land: 130, tail: 300 },
}

export const GUARD_TIMING = { land: 200, dur: 800 }
export const PLATE_TIMING = { land: 200, dur: 700 }
export const RUNE_TIMING = { land: 200, dur: 620 }
export const GATHER_TIMING = { land: 280, dur: 640 }
export const BREAK_TIMING = { land: 160, dur: 560 }
export const RESULT_DUR = 520
export const ARMOR_FX_DUR = 420
export const STATUS_DUR = { apply: 640, consume: 520, tick: 440, burst: 560 } as const
export const DRAW_DUR = 700
export const NUMBER_DUR = { xl: 780, l: 640, m: 600, s: 540 } as const
/** Stagger between numbers that share a portrait, so they read one after another instead of as a pile. */
export const NUMBER_STAGGER = 45
/** The engine is applied this long after the canvas reports nothing; only a safety net. */
export const FALLBACK_MARGIN = 260
export const RECOVERY_MARGIN = 40
export const MIN_AFTER_IMPACT = 300
