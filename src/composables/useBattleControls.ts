import { onMounted, onUnmounted } from 'vue'
export function useBattleControls(options: { enabled: () => boolean; cards: () => { instanceId: string }[]; play: (id: string) => void; endTurn: () => void }) {
  function keydown(event: KeyboardEvent) {
    if (!options.enabled() || event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input,textarea,select,[contenteditable="true"]')) return
    if (/^[1-9]$/.test(event.key)) {
      const card = options.cards()[Number(event.key) - 1]
      if (card) { event.preventDefault(); options.play(card.instanceId) }
    } else if (event.key === 'Enter' && !target?.closest('button,a')) { event.preventDefault(); options.endTurn() }
  }
  onMounted(() => window.addEventListener('keydown', keydown))
  onUnmounted(() => window.removeEventListener('keydown', keydown))
}
