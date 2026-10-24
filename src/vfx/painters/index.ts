import type { FxRuntime } from '../runtime'
import type { VfxBeat } from '../types'
import { paintArmorFx, paintGuard, paintResult } from './guards'
import { paintStrike } from './strikes'
import { paintBreak, paintDraw, paintGather, paintRune, paintStatus } from './status'

/** One beat of a plan, drawn. Numbers are handled by the runtime's label pool; everything else is a painter. */
export function paintBeat(fx: FxRuntime, beat: VfxBeat): void {
  switch (beat.kind) {
    case 'strike': return paintStrike(fx, beat)
    case 'guard': return paintGuard(fx, beat)
    case 'rune': return paintRune(fx, beat)
    case 'status': return paintStatus(fx, beat)
    case 'draw': return paintDraw(fx, beat)
    case 'gather': return paintGather(fx, beat)
    case 'break': return paintBreak(fx, beat)
    case 'result': return paintResult(fx, beat)
    case 'armor-fx': return paintArmorFx(fx, beat)
    case 'number': return fx.label(beat.anchor, beat.text, beat.tone, beat.size, beat.lane, beat.heavy === true, beat.durMs)
  }
}
