// Pure geometry of the hand: order, overlap and zoom. Kept out of the component so it can be tested without a DOM.

/** The cards as the player sees them: the card that is being played stays at its old position until it resolves. */
export function handOrder<T>(cards: readonly T[], outgoing: T | null, outgoingIndex: number): T[] {
  const ordered = [...cards]
  if (outgoing) ordered.splice(outgoingIndex, 0, outgoing)
  return ordered
}

export interface FanLayout {
  /** Distance between the left edges of neighbouring cards. */
  step: number
  /** Total width of the row. */
  span: number
  /** Fraction of a card that its right-hand neighbour leaves uncovered (1 = no overlap). */
  visible: number
  overlapped: boolean
  /** Left edge of card `index`, centred in the available width. */
  x: (index: number) => number
}

/** One row, never wraps or scrolls: cards keep their natural gap while there is room and then overlap evenly. */
export function fanLayout(count: number, width: number, cardWidth: number, gap: number): FanLayout {
  const natural = cardWidth + gap
  const step = count <= 1 ? natural : Math.min(natural, Math.max(1, (width - cardWidth) / (count - 1)))
  const span = step * Math.max(0, count - 1) + cardWidth
  const visible = Math.min(1, step / cardWidth)
  return { step, span, visible, overlapped: visible < 0.98, x: index => (width - span) / 2 + index * step }
}

/** Horizontal nudge that keeps a zoomed card inside the viewport. `center` is the card's centre in viewport coordinates. */
export function zoomShift(center: number, zoomedWidth: number, viewport: number, margin = 8): number {
  const overflowLeft = margin - (center - zoomedWidth / 2)
  const overflowRight = center + zoomedWidth / 2 - (viewport - margin)
  return overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0
}

/** Zoom that lets the card rise only slightly above the dock, so it never hides the heroes' health above the hand. */
export function zoomFactor(trackBottom: number, dockTop: number, cardHeight: number, lift: number, maxZoom = 1.32, minZoom = 1.1, allowance = 10): number {
  return Math.max(minZoom, Math.min(maxZoom, (trackBottom - dockTop + allowance) / (cardHeight + lift)))
}

/** Below this visible fraction a fan hides too much of every card; the hand switches to compact tiles instead. */
export const COMPACT_BELOW = 0.6
export const TILE_EM_WIDTH = 7.2
export const TILE_EM_HEIGHT = 11

export interface HandMode {
  compact: boolean
  /** Width of one slot: the full card in a fan, the tile in compact mode. */
  slotWidth: number
  layout: FanLayout
}

/**
 * Full cards in an overlapping fan while enough of each stays visible; otherwise one row of non-overlapping tiles
 * (name, cost, main numbers) whose full card opens on hover/focus. Every card is always reachable.
 */
export function handMode(count: number, width: number, cardWidth: number, gap: number): HandMode {
  const fan = fanLayout(count, width, cardWidth, gap)
  if (count === 0 || fan.visible >= COMPACT_BELOW) return { compact: false, slotWidth: cardWidth, layout: fan }
  const tile = Math.min(cardWidth * 0.8, (width - (count - 1) * gap) / count)
  return { compact: true, slotWidth: tile, layout: fanLayout(count, width, tile, gap) }
}

export interface Box { left: number; top: number; right: number; bottom: number }

export interface NotesPlacement {
  side: 'right' | 'left'
  /** Distance from the viewport's left edge (side 'right') or from its right edge (side 'left'). */
  offset: number
  /** The scroll's height limit: it grows up from the hand and stops under the lowest readout it would otherwise cover. */
  maxHeight: number
}

/**
 * Where the notes scroll of the zoomed card goes. It opens beside the card on the side with room (the right one first) and
 * may rise only until it would cover a critical readout (health plate, intent, statuses) in its own columns, so the heroes'
 * health stays readable while a card is open. `bottom` is the scroll's distance from the viewport's bottom edge.
 */
export function notesPlacement(card: Box, viewport: { width: number; height: number }, bottom: number, critical: readonly Box[], width = 300, gap = 14, margin = 8): NotesPlacement {
  const fitsRight = viewport.width - card.right - gap >= width
  const left = fitsRight ? card.right + gap : Math.max(margin, card.left - gap - width)
  const right = left + width
  const lowest = critical.filter(box => box.right > left && box.left < right).reduce((max, box) => Math.max(max, box.bottom), 0)
  const top = Math.max(margin, lowest > 0 ? lowest + 3 : margin)
  const maxHeight = Math.max(0, viewport.height - bottom - top)
  return fitsRight ? { side: 'right', offset: left, maxHeight } : { side: 'left', offset: viewport.width - (card.left - gap), maxHeight }
}
