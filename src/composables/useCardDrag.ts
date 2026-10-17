import { onUnmounted, ref, watch } from 'vue'

/** Own the pointer until release, including releases outside the card. */
export function useCardDrag(options: {
  available: () => boolean
  play: () => void
  changed: (active: boolean, ready: boolean) => void
}) {
  const dragging = ref(false)
  const offset = ref({ x: 0, y: 0 })
  const bounds = ref({ left: 0, top: 0, width: 180, height: 224 })
  let pointer: number | null = null
  let start = { x: 0, y: 0 }
  let suppressClick = false
  let capture: HTMLElement | null = null

  function reset() {
    const previous = pointer
    pointer = null
    dragging.value = false
    offset.value = { x: 0, y: 0 }
    window.removeEventListener('pointermove', move, true)
    window.removeEventListener('pointerup', up, true)
    window.removeEventListener('pointercancel', cancel, true)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('keydown', escape)
    document.removeEventListener('visibilitychange', visibility)
    capture?.removeEventListener('lostpointercapture', cancel)
    if (previous !== null && capture?.hasPointerCapture(previous)) capture.releasePointerCapture(previous)
    capture = null
    options.changed(false, false)
  }
  function down(event: PointerEvent) {
    if (!options.available() || event.button !== 0 || pointer !== null || event.isPrimary === false) return
    suppressClick = false
    pointer = event.pointerId
    capture = event.currentTarget as HTMLElement
    const rect = capture.getBoundingClientRect()
    bounds.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    start = { x: event.clientX, y: event.clientY }
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', escape)
    document.addEventListener('visibilitychange', visibility)
    capture.addEventListener('lostpointercapture', cancel)
    capture.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointer) return
    // Recover even when the browser missed a release outside its window.
    if (event.buttons === 0) { cancel(); return }
    const next = { x: event.clientX - start.x, y: event.clientY - start.y }
    if (Math.hypot(next.x, next.y) > 7) dragging.value = true
    if (!dragging.value) return
    event.preventDefault()
    offset.value = next
    options.changed(true, next.y < -55)
  }
  function up(event: PointerEvent) {
    if (event.pointerId !== pointer) return
    const play = dragging.value && start.y - event.clientY > 55 && options.available()
    suppressClick = dragging.value
    reset()
    if (play) options.play()
  }
  function cancel() { if (pointer !== null) { suppressClick = true; reset() } }
  function escape(event: KeyboardEvent) { if (event.key === 'Escape') cancel() }
  function visibility() { if (document.hidden) cancel() }
  function click(event: MouseEvent) {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return }
    if (options.available()) options.play()
  }
  watch(options.available, available => { if (!available) cancel() }, { flush: 'sync' })
  onUnmounted(reset)
  return { dragging, offset, bounds, down, click }
}
