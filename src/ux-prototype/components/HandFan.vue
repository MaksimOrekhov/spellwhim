<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ProtoCard from './ProtoCard.vue'
import CardNotes from './CardNotes.vue'
import type { ProtoCardView } from '../useProtoBattle'

const props = defineProps<{ cards: ProtoCardView[]; mana: number; locked?: boolean; pin?: number; labels?: Record<string, string> }>()
const emit = defineEmits<{ play: [instanceId: string]; inspect: [view: ProtoCardView | null] }>()

const box = ref<HTMLElement | null>(null)
const width = ref(1200)
const rem = ref(16)
const scale = ref(1)
const active = ref<string | null>(null)
let observer: ResizeObserver | undefined
function measure() {
  if (!box.value) return
  width.value = box.value.clientWidth
  rem.value = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  scale.value = parseFloat(getComputedStyle(box.value).getPropertyValue('--card-scale')) || 1
}
onMounted(() => {
  measure(); observer = new ResizeObserver(measure); if (box.value) observer.observe(box.value)
  const pinned = props.pin !== undefined ? props.cards[props.pin] : undefined
  if (pinned) enter(pinned)
})
onBeforeUnmount(() => observer?.disconnect())

const cardW = computed(() => 11.6 * rem.value * scale.value)
const gap = computed(() => 0.6 * rem.value)
const step = computed(() => {
  const n = props.cards.length
  if (n <= 1) return cardW.value + gap.value
  const natural = cardW.value + gap.value
  return Math.min(natural, (width.value - cardW.value) / (n - 1))
})
const span = computed(() => step.value * Math.max(0, props.cards.length - 1) + cardW.value)
const activeIndex = computed(() => props.cards.findIndex(c => c.instanceId === active.value))
const visible = computed(() => Math.min(1, step.value / cardW.value))
const overlapped = computed(() => step.value < cardW.value + gap.value - 1)

function slotStyle(index: number) {
  const left = (width.value - span.value) / 2 + index * step.value
  const hot = activeIndex.value
  // The hovered card stays fully readable: its neighbours slide away by the amount hidden behind it.
  const push = 0 // neighbours stay put: the zoomed card simply covers them; shifting would push the last card over the end-turn button
  return { left: left + 'px', width: cardW.value + 'px', zIndex: index === hot ? 60 : index, '--push': push + 'px' }
}
function holderStyle(index: number) {
  const mid = (props.cards.length - 1) / 2
  const d = index - mid
  const rot = props.cards.length > 7 ? 1.35 : 1.8
  return { '--rot': (d * rot).toFixed(2) + 'deg', '--drop': (Math.abs(d) ** 2 * 0.055).toFixed(3) + 'em' }
}
/** Notes open towards the free side so they never run off the screen. */
function side(index: number): 'left' | 'right' {
  const left = (width.value - span.value) / 2 + index * step.value + cardW.value / 2
  return left > width.value * 0.58 ? 'left' : 'right'
}
function enter(view: ProtoCardView) { active.value = view.instanceId; emit('inspect', view) }
function leave(view: ProtoCardView) { if (active.value === view.instanceId) { active.value = null; emit('inspect', null) } }
function hotkey(index: number, view: ProtoCardView) { return props.labels ? props.labels[view.instanceId] ?? '' : String(index === 9 ? 0 : index + 1) }
</script>

<template>
  <section ref="box" class="hand" :class="{ 'is-overlapped': overlapped, 'is-locked': locked }" aria-label="Карты в руке">
    <TransitionGroup name="deal" tag="div" class="hand-track">
      <div v-for="(view, index) in cards" :key="view.instanceId" class="slot" :class="{ 'is-active': active === view.instanceId, 'is-unplayable': !!view.reason }" :style="slotStyle(index)" @mouseenter="enter(view)" @mouseleave="leave(view)" @focusin="enter(view)" @focusout="leave(view)">
        <div class="holder" :style="holderStyle(index)">
          <ProtoCard :id="'pcard-' + view.instanceId" :card="view.card" :preview="view.preview" :reason="view.reason" :hotkey="hotkey(index, view)" :queued="view.queued" :mana="mana" :vis="index === cards.length - 1 || active === view.instanceId ? 1 : visible" @play="emit('play', view.instanceId)" />
        </div>
        <div v-if="active === view.instanceId" class="notes-anchor" :class="'notes-anchor--' + side(index)"><CardNotes :card="view.card" :preview="view.preview" :reason="view.reason" :mana="mana" :hotkey="hotkey(index, view)" /></div>
      </div>
    </TransitionGroup>
    <p v-if="!cards.length" class="empty">Рука пуста — завершите ход, чтобы добрать карты.</p>
  </section>
</template>

<style scoped>
.hand{position:relative;height:100%;min-width:0}
.hand-track{position:absolute;inset:0}
.slot{position:absolute;bottom:0;height:17em;font-size:calc(1rem * var(--card-scale,1));transition:left .32s var(--ease-out),transform .32s var(--ease-out),opacity .25s}
.slot{transform:translateX(var(--push,0))}
.holder{position:absolute;inset:0;transform-origin:50% 100%;transform:translateY(calc(var(--tuck,0rem) + var(--drop))) rotate(var(--rot));transition:transform .24s var(--ease-out)}
.slot.is-active .holder{transform:translateY(calc(-3.4em)) scale(1.3) rotate(0);z-index:2}
.slot.is-unplayable:not(.is-active) .holder{transform:translateY(calc(var(--tuck,0rem) + var(--drop) + .5em)) rotate(var(--rot))}
.notes-anchor{position:absolute;bottom:3.6em;z-index:3;pointer-events:none;animation:notes-in .18s var(--ease-out)}
.notes-anchor--right{left:calc(100% + 3.1em)}
.notes-anchor--left{right:calc(100% + 3.1em)}
@keyframes notes-in{from{opacity:0;translate:0 .6em}}
.deal-enter-from{opacity:0;transform:translate(-26em,3em) rotate(-18deg) scale(.55)!important}
.deal-enter-active{transition:opacity .3s,transform .45s var(--ease-out)!important}
.deal-leave-active{position:absolute;transition:opacity .15s!important}
.deal-leave-to{opacity:0}
.is-locked .slot{pointer-events:none}
.empty{position:absolute;inset:0;display:grid;place-items:center;margin:0;color:var(--text-dim);font:600 1.1rem var(--f-ui)}
</style>
