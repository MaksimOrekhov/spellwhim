import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer } from 'vue'
import { useBattleControls } from './useBattleControls'
const renderer = createRenderer<object, object>({ patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null })
afterEach(() => vi.unstubAllGlobals())
it('handles card keys and Enter only on an available common player turn', () => {
  let listener!: (event: KeyboardEvent) => void
  const remove = vi.fn()
  const modal = vi.fn((): object | null => null)
  vi.stubGlobal('window', { addEventListener: (_: string, callback: typeof listener) => { listener = callback }, removeEventListener: remove })
  vi.stubGlobal('document', { querySelector: modal })
  let enabled = true
  const play = vi.fn(), endTurn = vi.fn()
  const hand = Array.from({ length: 10 }, (_, index) => ({ instanceId: 'copy-' + (index + 1) }))
  const app = renderer.createApp({ setup() { useBattleControls({ enabled: () => enabled, cards: () => hand, play, endTurn }); return () => null } })
  app.mount({})
  const key = (value: string, button = false) => listener({ key: value, preventDefault: vi.fn(), target: { closest: (selector: string) => button && selector === 'button,a' ? {} : null } } as unknown as KeyboardEvent)
  key('1'); expect(play).toHaveBeenCalledExactlyOnceWith('copy-1')
  key('0'); expect(play).toHaveBeenLastCalledWith('copy-10')
  key('Enter'); expect(endTurn).toHaveBeenCalledTimes(1)
  key('Enter', true); expect(endTurn).toHaveBeenCalledTimes(1)
  enabled = false; key('1'); key('Enter'); expect(play).toHaveBeenCalledTimes(2)
  enabled = true; modal.mockReturnValue({}); key('1'); expect(play).toHaveBeenCalledTimes(2)
  app.unmount(); expect(remove).toHaveBeenCalledWith('keydown', listener)
})
