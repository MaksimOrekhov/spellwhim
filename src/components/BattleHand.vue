<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import HandCard from './HandCard.vue'
import CardNotes from './CardNotes.vue'
import GameTooltip from './GameTooltip.vue'
import type { HandCardView } from '../composables/useBattle'
import type { HeroId } from '../game/types'
import type { BattlePhase } from '../composables/useBattleAnimation'
import type { CardBlock } from '../ui/cardDisplay'
import { handMode, handOrder, notesPlacement, TILE_EM_HEIGHT, TILE_EM_WIDTH, zoomFactor, zoomShift } from '../ui/handLayout'
import type { Box } from '../ui/handLayout'
import { useRules } from '../ui/rulesInfo'

const props = defineProps<{ cards: HandCardView[]; outgoing: HandCardView | null; outgoingIndex: number; drawCount: number; discardCount: number; exhaustedCount: number; phase: BattlePhase; mana: number; maxMana: number; nextMana?: number; nextDraw?: number; drawBoostFrom?: number; drawBoostAmount?: number; idleArmor?: HeroId[] }>()
const emit = defineEmits<{ play: [instanceId: string]; endTurn: [] }>()
const displayed = computed(() => handOrder(props.cards, props.outgoing, props.outgoingIndex))
const manaHint = computed(() => {
  if (props.nextMana === undefined || props.nextMana === props.maxMana) return props.maxMana >= 5 ? 'Максимум маны: 5' : ''
  return 'Следующий ход: максимум ' + props.nextMana
})
const rules = useRules()
const drawHint = computed(() => rules.discardsHand
  ? 'В начале каждого хода берётся новая рука из ' + (props.nextDraw ?? rules.openingHand) + ' карт. Несыгранные карты в конце хода уходят в сброс.'
  : props.drawBoostFrom !== undefined && props.drawBoostAmount !== undefined
  ? 'В начале каждого хода после первого добираются 2 карты; с ' + props.drawBoostFrom + '-го хода — ' + props.drawBoostAmount + '. Несыгранные карты остаются в руке.'
  : 'В начале каждого следующего хода добираются ' + (props.nextDraw ?? 2) + ' карты. Несыгранные карты остаются в руке.')
function block(item: HandCardView): CardBlock | null {
  if (props.phase === 'finished') return { kind: 'phase', text: 'Бой завершён.' }
  if (props.phase === 'enemy') return { kind: 'phase', text: 'Сейчас ход противника. Дождитесь начала хода отряда.' }
  if (props.phase === 'card') return { kind: 'phase', text: 'Дождитесь завершения текущей способности.' }
  if (props.mana < item.card.cost) return { kind: 'mana', text: 'Недостаточно маны: нужно ' + item.card.cost + ', доступно ' + props.mana + '.' }
  return item.playable ? null : { kind: 'phase', text: 'Карта сейчас недоступна.' }
}

// ── Fan layout ─────────────────────────────────────────────────────────────
// Cards are absolutely placed on one row. When the row is too narrow they overlap evenly (never wrap or scroll);
// each card still shows its cost, name, class and main number inside the strip its neighbour leaves uncovered.
// The hovered/focused card zooms to the front, is nudged back inside the screen, and its notes open on the free side.
const CARD_EM = 12
const CARD_HEIGHT_EM = 16.6
const MAX_ZOOM = 1.32
const LIFT_EM = 0.5
const NOTES_WIDTH = 300
const track = useTemplateRef<HTMLElement>('track')
const geometry = ref({ width: 900, em: 14, left: 0, bottom: 0, dockTop: 0, viewport: 1280 })
let observer: ResizeObserver | undefined
function measure() {
  const el = track.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  geometry.value = { width: el.clientWidth, em: Number.parseFloat(getComputedStyle(el).fontSize) || 14, left: rect.left, bottom: rect.bottom, dockTop: el.closest('.battle-dock')?.getBoundingClientRect().top ?? rect.top, viewport: window.innerWidth }
}
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (track.value) observer.observe(track.value)
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('resize', measure) })

const cardWidth = computed(() => CARD_EM * geometry.value.em)
// The zoomed card may rise only slightly above the dock, so it never hides the heroes' health above the hand.
const zoom = computed(() => {
  const g = geometry.value
  return zoomFactor(g.bottom, g.dockTop, CARD_HEIGHT_EM * g.em, LIFT_EM * g.em, MAX_ZOOM)
})
const mode = computed(() => handMode(displayed.value.length, geometry.value.width, cardWidth.value, 0.45 * geometry.value.em))
const compact = computed(() => mode.value.compact)
const slotWidth = computed(() => mode.value.slotWidth)
const visible = computed(() => (compact.value ? 1 : mode.value.layout.visible))
const overlapped = computed(() => !compact.value && mode.value.layout.overlapped)
const tileEm = computed(() => slotWidth.value / TILE_EM_WIDTH)
const slotX = (index: number) => mode.value.layout.x(index)

const active = shallowRef<string | null>(null)
const activeIndex = computed(() => displayed.value.findIndex(item => item.instanceId === active.value))
const activeItem = computed(() => (activeIndex.value >= 0 && props.outgoing?.instanceId !== active.value ? displayed.value[activeIndex.value]! : null))
// Kept inside the hand row, so a zoomed end card does not climb over the end-turn button or the mana panel.
const shiftFor = (index: number) => zoomShift(slotX(index) + slotWidth.value / 2, cardWidth.value * zoom.value, geometry.value.width, 0)
function slotStyle(index: number) {
  const tile = compact.value ? { height: TILE_EM_HEIGHT * tileEm.value + 'px', fontSize: tileEm.value + 'px' } : {}
  return { ...tile, width: slotWidth.value + 'px', transform: `translateX(${slotX(index).toFixed(1)}px)`, zIndex: index === activeIndex.value ? 60 : index + 1 }
}
function holderStyle(index: number) {
  const middle = (displayed.value.length - 1) / 2
  const offset = index - middle
  const tilt = overlapped.value ? 0.6 : 0
  return { '--rot': (offset * tilt).toFixed(2) + 'deg', '--drop': (offset * offset * (overlapped.value ? 0.02 : 0)).toFixed(3) + 'em', '--shift': (index === activeIndex.value ? shiftFor(index) : 0).toFixed(1) + 'px', '--zoom': zoom.value.toFixed(3), '--lift': LIFT_EM + 'em' }
}
// The readouts that must stay visible while a card is open: health plates, the intent banner, status trays. The scroll may rise only
// until it would cover one of them in its own columns (ui/handLayout.ts, notesPlacement), and folds its text when that leaves too little room.
const critical = shallowRef<Box[]>([])
function collectCritical() {
  critical.value = [...document.querySelectorAll('[data-battle-scene] [data-critical]')].map(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } })
}
const notesElement = useTemplateRef<HTMLElement>('notesElement')
const fold = ref(0)
const notesStyle = computed(() => {
  const g = geometry.value
  const index = activeIndex.value
  if (index < 0) return {}
  const zoomed = cardWidth.value * zoom.value
  const left = g.left + slotX(index) + shiftFor(index) - (zoomed - slotWidth.value) / 2
  const bottom = Math.max(8, window.innerHeight - g.bottom + LIFT_EM * g.em)
  const place = notesPlacement({ left, right: left + zoomed, top: 0, bottom: 0 }, { width: g.viewport, height: window.innerHeight }, bottom, critical.value, NOTES_WIDTH)
  const size = fold.value > 1 ? 11 : Math.max(13, Math.min(16, g.em * 1.05))
  return { bottom: bottom + 'px', maxHeight: place.maxHeight + 'px', fontSize: size + 'px', [place.side === 'right' ? 'left' : 'right']: place.offset + 'px' }
})
// Unfolded text that does not fit its room first loses the keyword explanations, then shrinks a little: the scroll always fits whole.
async function fit() {
  for (let step = 1; step <= 2; step += 1) {
    const element = notesElement.value
    if (!element || element.scrollHeight <= element.clientHeight + 1) return
    fold.value = step
    await nextTick()
  }
}
// Little height above the hand (short screens): fold the notes instead of letting them cover the heroes.
const briefNotes = computed(() => fold.value > 0 || geometry.value.bottom + LIFT_EM * geometry.value.em - geometry.value.dockTop < 340)
watch(activeIndex, async index => { fold.value = 0; if (index < 0) return; collectCritical(); await nextTick(); await fit() })
function enter(item: HandCardView) { if (props.outgoing?.instanceId !== item.instanceId) active.value = item.instanceId }
function leave(item: HandCardView) { if (active.value === item.instanceId) active.value = null }
function focusOut(item: HandCardView, event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) leave(item)
}
function onEscape(event: KeyboardEvent) { if (event.key === 'Escape') active.value = null }
onMounted(() => window.addEventListener('keydown', onEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', onEscape))
watch(() => props.outgoing, outgoing => { if (outgoing) active.value = null })
watch(() => displayed.value.length, () => { if (activeIndex.value < 0) active.value = null })
</script>
<template>
  <footer class="battle-dock">
    <section class="hand-area" aria-label="Карты в руке">
      <div class="hand-bar">
        <GameTooltip label="Общая колода"><button class="deck-counts" aria-label="Колода и сброс"><span>▤ Колода <b>{{ drawCount }}</b></span><span>↻ Сброс <b>{{ discardCount }}</b></span></button><template #content><p>В начале боя в руке {{ rules.openingHand }} карт. {{ drawHint }}</p><p>Максимум руки — 10. Карты сверх лимита остаются в колоде. Выбывших до конца боя: {{ exhaustedCount }}.</p></template></GameTooltip>
        <p class="hand-hint">{{ displayed.length }} / 10 карт · наведите для полного описания · клавиши 1–9, 0</p>
      </div>
      <div ref="track" class="hand-track" data-fx-anchor="hand" :class="{ 'is-overlapped': overlapped, 'is-compact': compact, 'is-burning': rules.discardsHand && phase === 'enemy' }">
        <TransitionGroup name="deal">
          <div v-for="(item, index) in displayed" :key="item.instanceId" class="slot" :class="{ 'is-active': index === activeIndex }" :style="slotStyle(index)" @mouseenter="enter(item)" @mouseleave="leave(item)" @focusin="enter(item)" @focusout="focusOut(item, $event)">
            <div class="holder" :style="holderStyle(index)">
              <HandCard :card="item.card" :instance-id="item.instanceId" :preview="item.preview" :block="block(item)" :index="index" :vis="index === displayed.length - 1 || index === activeIndex ? 1 : visible" :compact="compact" :active="index === activeIndex" :full-shift="index === activeIndex ? shiftFor(index) : 0" :full-scale="zoom" :full-em="geometry.em" :playing="outgoing?.instanceId === item.instanceId" @play="emit('play', $event)" />
            </div>
          </div>
        </TransitionGroup>
        <p v-if="!displayed.length" class="empty-hand">Рука пуста.<br />Завершите ход, чтобы добрать карты.</p>
      </div>
    </section>
    <aside class="turn-controls"><div class="mana-pool" aria-label="Мана отряда"><span>Мана</span><strong>{{ mana }}<small>/{{ maxMana }}</small></strong><div class="mana-pips" aria-hidden="true"><i v-for="pip in maxMana" :key="pip" :class="{ 'is-spent': pip > mana }"></i></div><em v-if="manaHint" class="mana-next">{{ manaHint }}</em></div><button class="game-button end-turn" :disabled="phase !== 'player'" @click="emit('endTurn')"><span>{{ phase === 'enemy' ? 'Ход врага' : phase === 'card' ? 'Действие…' : 'Завершить ход' }}</span><kbd>Enter</kbd></button><small>{{ phase === 'player' ? (rules.discardsHand && displayed.length ? 'Затем ход противника. Несыгранные карты уйдут в сброс: ' + displayed.length : 'Затем ход противника') : 'Дождитесь окончания действия' }}</small></aside>
    <Teleport to="body">
      <Transition name="notes">
        <div v-if="activeItem" ref="notesElement" class="card-notes-pop" :style="notesStyle" aria-hidden="true">
          <CardNotes :brief="briefNotes" :card="activeItem.card" :preview="activeItem.preview" :block="block(activeItem)" :hotkey="String(activeIndex === 9 ? 0 : activeIndex + 1)" :idle-armor="idleArmor" />
        </div>
      </Transition>
    </Teleport>
  </footer>
</template>
<style scoped>
.battle-dock{position:absolute;z-index:10;left:0;right:0;bottom:0;height:var(--hand-height);display:grid;grid-template-columns:minmax(0,1fr) clamp(124px,9.5vw,190px);align-items:center;gap:clamp(8px,1.4vw,28px);padding:0 clamp(14px,2vw,40px);background:linear-gradient(#2a1a10e8,#1b110bf5 30%,#120a06);border-top:3px solid var(--brass-3);box-shadow:0 -14px 26px #0008,inset 0 2px 0 #f5d58b33}
.mana-pool{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;align-items:baseline;width:100%;padding:clamp(6px,1vh,10px) clamp(8px,.9vw,14px);border-radius:var(--shape-chip);background:#0e1a1e99;border:1px solid #7ac6cd55}.mana-pool>span{font-size:15px;color:#d7e7de}.mana-pool strong{font-size:clamp(28px,3.4vh,40px);color:#bce9ed;line-height:1;justify-self:end}.mana-pool small{font-size:.5em;color:#b4c7c3;font-weight:400}.mana-pips{grid-column:1/-1;display:flex;gap:4px}.mana-next{grid-column:1/-1;font-style:normal;font-size:11px;line-height:1.25;color:#f3dfb3}.mana-pips i{height:11px;flex:0 1 22px;min-width:0;border-radius:var(--r-1);background:#7ac6cd;border:1px solid #b7edec}.mana-pips .is-spent{background:#38504f;border-color:#55716a}
.deck-counts{display:flex;gap:14px;padding:0;border:0;background:none;color:#ced4bd;font-size:13px;text-align:left}.deck-counts span{display:flex;align-items:center;gap:5px}.deck-counts b{color:#f3dfb3}
.hand-area{min-width:0;height:100%;position:relative;display:grid;grid-template-rows:27px minmax(0,1fr)}.hand-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;min-width:0;padding:0 clamp(4px,1vw,14px)}.hand-hint{margin:0;color:#e0d9c2;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.hand-track{position:relative;align-self:end;height:calc(var(--card-height) + 4px);margin-bottom:18px;font-size:calc(var(--card-height) / 16.6)}
.slot{position:absolute;left:0;bottom:0;height:16.6em;transition:transform var(--dur-base) var(--ease-out),opacity var(--dur-base)}
.holder{width:100%;height:100%;transform-origin:50% 100%;transform:translateY(var(--drop,0)) rotate(var(--rot,0deg));transition:transform var(--dur-base) var(--ease-out)}
.hand-track:not(.is-compact) .slot.is-active .holder{transform:translate(var(--shift,0),calc(-1 * var(--lift))) scale(var(--zoom));transition-duration:var(--dur-fast)}
.hand-track:not(.is-compact) .slot.is-active .holder :deep(.sc-rim){box-shadow:0 .9em 1.6em #04101299,inset 0 .1em .12em #fff7,inset 0 -.18em .3em #0006}
.deal-enter-from,.deal-leave-to{opacity:0}
.hand-track.is-burning .slot{opacity:.5;filter:grayscale(.65)}
.deal-enter-from .holder{transform:translateY(5em) scale(.9)}
.deal-leave-active{transition:opacity .12s}
.empty-hand{position:absolute;inset:0;display:grid;place-content:center;margin:0;text-align:center;font-size:16px;line-height:1.5;color:#d1cfba}
.turn-controls{display:grid;gap:10px;text-align:center;align-content:center}.end-turn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:74px;padding:12px 14px;font-size:17px;white-space:nowrap}.end-turn kbd{font:12px var(--font-ui);font-weight:400;opacity:.7}.turn-controls>small{font-size:12px;line-height:1.4;color:#c0caba}
@media(min-width:1800px){.mana-pool strong{font-size:42px}.hand-hint{font-size:15px}.deck-counts{font-size:15px}.turn-controls>small{font-size:14px}.end-turn{font-size:20px}}
@media(max-width:1100px){.end-turn{font-size:14px;padding:10px 8px;min-height:60px}.deck-counts{font-size:12px;gap:10px}.mana-pool{gap:3px 7px}.mana-pool>span{font-size:13px}.hand-hint{font-size:12px}.turn-controls>small{display:none}}
</style>
<style>
.card-notes-pop{position:fixed;z-index:1000;width:300px;overflow:hidden;pointer-events:none}
.notes-enter-active,.notes-leave-active{transition:opacity var(--dur-fast),transform var(--dur-fast) var(--ease-out)}
.notes-enter-from,.notes-leave-to{opacity:0;transform:translateY(.4em)}
</style>
