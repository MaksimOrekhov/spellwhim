import { onMounted, onUnmounted, shallowRef } from 'vue'
import { gameAudio } from './engine'

/** Installed once by the settings button, in the app or the lab; every listener has a matching cleanup. */
export function useAudio() {
  const settings = shallowRef({ ...gameAudio.settings })
  const unsubscribe = gameAudio.subscribe(() => { settings.value = { ...gameAudio.settings } })
  function gesture(event: Event) {
    if (!event.isTrusted || (event instanceof KeyboardEvent && /^(Shift|Control|Alt|Meta|Escape|CapsLock)$/.test(event.key))) return
    if (navigator.userActivation && !navigator.userActivation.isActive) return
    void gameAudio.unlock()
  }
  function visibility() { gameAudio.setHidden(document.hidden) }
  onMounted(() => {
    document.addEventListener('pointerdown', gesture, { capture: true, passive: true })
    document.addEventListener('keydown', gesture, true)
    document.addEventListener('visibilitychange', visibility)
    visibility()
    if (import.meta.env.DEV) (window as unknown as { __audio: unknown }).__audio = { stats: () => gameAudio.stats(), settings: () => ({ ...gameAudio.settings }), update: gameAudio.update.bind(gameAudio) }
  })
  onUnmounted(() => {
    unsubscribe()
    document.removeEventListener('pointerdown', gesture, true)
    document.removeEventListener('keydown', gesture, true)
    document.removeEventListener('visibilitychange', visibility)
    if (import.meta.env.DEV) delete (window as unknown as { __audio?: unknown }).__audio
    gameAudio.dispose()
  })
  return { settings, update: gameAudio.update.bind(gameAudio), unlock: () => gameAudio.unlock() }
}
