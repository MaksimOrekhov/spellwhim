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
