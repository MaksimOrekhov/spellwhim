import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer, ref } from 'vue'
import { useCardDrag } from './useCardDrag'
const renderer = createRenderer<object, object>({ patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null })
afterEach(() => vi.unstubAllGlobals())
function fixture() {
  const win = new EventTarget(), doc = new EventTarget()
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
  const available = ref(true), play = vi.fn(), changed = vi.fn()
  let drag!: ReturnType<typeof useCardDrag>
  const app = renderer.createApp({ setup() { drag = useCardDrag({ available: () => available.value, play, changed }); return () => null } })
  app.mount({})
  const element = Object.assign(new EventTarget(), { getBoundingClientRect: () => ({ left: 10, top: 300, width: 180, height: 224 }), setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() })
  const send = (type: string, extra = {}) => win.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: 1, clientX: 100, clientY: 180, buttons: 1, ...extra }))
  const down = () => drag.down({ currentTarget: element, button: 0, pointerId: 1, clientX: 100, clientY: 400 } as unknown as PointerEvent)
  return { app, drag, play, changed, available, element, send, down }
}
it('plays once after a global release, removes the ghost and suppresses the ensuing click', () => {
  const f = fixture()
  f.down(); f.send('pointermove'); expect(f.drag.dragging.value).toBe(true)
  f.send('pointerup', { pointerId: 2 }); expect(f.play).not.toHaveBeenCalled()
  f.send('pointerup'); expect(f.drag.dragging.value).toBe(false)
  expect(f.play).toHaveBeenCalledTimes(1)
  f.drag.click({ detail: 1 } as MouseEvent); expect(f.play).toHaveBeenCalledTimes(1)
  f.send('pointerup'); expect(f.play).toHaveBeenCalledTimes(1)
  f.app.unmount()
})
it('cancels on blur, capture loss, cancelled pointer, missing release, Escape and unavailable state', () => {
  const f = fixture()
  for (const cancel of [() => f.send('blur'), () => f.element.dispatchEvent(new Event('lostpointercapture')), () => f.send('pointercancel'), () => f.send('pointermove', { buttons: 0 }), () => f.send('keydown', { key: 'Escape' }), () => { f.available.value = false }]) {
    f.available.value = true; f.down(); f.send('pointermove'); cancel()
    expect(f.drag.dragging.value).toBe(false)
    f.send('pointerup'); expect(f.play).not.toHaveBeenCalled()
  }
  f.app.unmount()
})
it('keeps native click and keyboard play, and cleans up on unmount', () => {
  const f = fixture()
  f.down(); f.send('pointerup', { clientY: 400 })
  f.drag.click({ detail: 1 } as MouseEvent); expect(f.play).toHaveBeenCalledTimes(1)
  f.down(); f.send('pointermove'); f.send('blur')
  f.drag.click({ detail: 0 } as MouseEvent); expect(f.play).toHaveBeenCalledTimes(2)
  f.down(); f.send('pointermove'); f.app.unmount()
  expect(f.drag.dragging.value).toBe(false)
  f.send('pointerup'); expect(f.play).toHaveBeenCalledTimes(2)
})
