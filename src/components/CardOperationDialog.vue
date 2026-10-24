<script setup lang="ts">
// One modal for every deck operation (upgrade / remove / replace), at the rest site and in service rooms: a gallery of the real deck on the
// left, and on the right exactly what the chosen operation will do. It only collects a choice; the transaction is the parent's `confirm`.
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import type { CardDefinition, PersistentCard } from '../game/types'
import { resolveCardDefinition } from '../game/cardProgression'
import { neutralPreview } from '../ui/cardDisplay'
import { cardsText, changedWords, classLabel, manaText, upgradeChanges } from '../ui/cardOperations'
import type { CardOperation } from '../ui/cardOperations'
import SpellCard from './SpellCard.vue'
import CardNotes from './CardNotes.vue'
import CardGallery from './CardGallery.vue'
import { ArrowRight, TriangleAlert } from '@lucide/vue'

const props = withDefaults(defineProps<{
  mode: CardOperation
  /** The whole deck: the gallery shows every copy, `isEligible` marks the ones this operation may touch. */
  deck: readonly PersistentCard[]
  isEligible: (copy: PersistentCard) => boolean
  explanation?: string
  confirmLabel?: string
  selectedInstanceId?: string | null
  selectedCardId?: string | null
  replacementsFor?: (copy: PersistentCard) => readonly CardDefinition[]
}>(), { explanation: '', selectedInstanceId: null, selectedCardId: null })
const emit = defineEmits<{ select: [instanceId: string]; pick: [cardId: string]; confirm: [choice: { instanceId: string; cardId?: string }]; close: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const gallery = useTemplateRef<InstanceType<typeof CardGallery>>('gallery')
const detail = useTemplateRef<HTMLElement>('detail')
const selectedId = ref<string | null>(props.selectedInstanceId)
const pickedId = ref<string | null>(props.selectedCardId)
watch(() => props.selectedInstanceId, id => { if (id !== selectedId.value) selectedId.value = id })
watch(() => props.selectedCardId, id => { if (id !== pickedId.value) pickedId.value = id })

const titles: Record<CardOperation, string> = { upgrade: 'Улучшить одну карту', remove: 'Удалить одну карту', replace: 'Заменить одну карту' }
const hints: Record<CardOperation, string> = {
  upgrade: 'Выберите карту: справа — сравнение обычной и улучшенной версии.',
  remove: 'Выберите карту, которую нужно убрать из колоды. Пока вы не нажали «Удалить навсегда», ничего не меняется.',
  replace: 'Выберите карту, которая уйдёт из колоды, затем — новую карту того же класса.',
}
const labels: Record<CardOperation, string> = { upgrade: 'Подтвердить улучшение', remove: 'Удалить навсегда', replace: 'Заменить карту' }

const selected = computed(() => props.deck.find(copy => copy.instanceId === selectedId.value && props.isEligible(copy)) ?? null)
const card = computed(() => selected.value ? resolveCardDefinition(selected.value) : null)
const upgraded = computed(() => card.value ? { before: card.value, after: resolveCardDefinition({ ...selected.value!, upgrade: 1 }) } : null)
const changes = computed(() => upgraded.value ? upgradeChanges(upgraded.value.before, upgraded.value.after) : [])
const words = computed(() => upgraded.value ? changedWords(upgraded.value.before.description, upgraded.value.after.description) : [])
const offers = computed(() => selected.value && props.mode === 'replace' ? [...(props.replacementsFor?.(selected.value) ?? [])] : [])
const chosen = computed(() => offers.value.find(offer => offer.id === pickedId.value) ?? null)
const wasUpgraded = computed(() => !!selected.value?.upgrade)
const lossWarning = computed(() => !wasUpgraded.value ? '' : props.mode === 'remove' ? 'Вы удаляете улучшенную копию. Её улучшение будет потеряно навсегда.' : 'При замене улучшение будет потеряно. Новая копия — без улучшения.')
const twins = computed(() => selected.value ? props.deck.filter(copy => copy.definitionId === selected.value!.definitionId && copy.upgrade === selected.value!.upgrade).length : 0)
const ready = computed(() => !!selected.value && (props.mode !== 'replace' || !!chosen.value))
const lockedReason = (copy: PersistentCard) => {
  if (copy.upgrade) return props.mode === 'upgrade' ? 'Уже улучшена' : 'Улучшенные здесь недоступны'
  if (props.mode === 'upgrade') return 'Улучшения нет'
  return props.mode === 'replace' ? 'Нет замен' : 'Нельзя удалить'
}
const summary = computed(() => {
  if (!selected.value || !card.value) return 'Карта не выбрана — ничего не изменится.'
  const name = card.value.name + (selected.value.upgrade ? ' ↑' : '')
  if (props.mode === 'upgrade') return `Улучшить · ${name} → ${upgraded.value!.after.name} ↑`
  if (props.mode === 'remove') return `Удалить · ${name} · карт в колоде: ${props.deck.length} → ${props.deck.length - 1}`
  return chosen.value ? `Заменить · ${name} → ${chosen.value.name} (без улучшения)` : `Заменить · ${name} → выберите новую карту`
})

function choose(id: string) {
  if (id === selectedId.value) return
  selectedId.value = id
  pickedId.value = null
  emit('select', id)
  if (matchMedia('(max-width: 900px)').matches) void Promise.resolve().then(() => detail.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}
function choosePick(id: string) {
  pickedId.value = id
  emit('pick', id)
}
function confirm() {
  if (ready.value) emit('confirm', { instanceId: selected.value!.instanceId, ...(props.mode === 'replace' ? { cardId: chosen.value!.id } : {}) })
}
// The parent removes the dialog (v-if) instead of closing it, so the browser cannot return focus by itself: the button that opened it gets it back.
let opener: HTMLElement | null = null
onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.value?.showModal()
  gallery.value?.focusSelected()
})
onUnmounted(() => { if (opener?.isConnected) opener.focus() })
</script>

<template>
  <dialog ref="dialog" class="cod" :class="`cod--${mode}`" aria-labelledby="cod-title" aria-describedby="cod-hint" @cancel.prevent="emit('close')" @click="($event.target === dialog) && emit('close')">
    <header>
      <div><h2 id="cod-title">{{ titles[mode] }}</h2><p id="cod-hint">{{ explanation || hints[mode] }}</p></div>
      <button class="game-button game-button--quiet" @click="emit('close')">Отмена</button>
    </header>
    <div class="cod-body">
      <section class="cod-pick" aria-label="Колода">
        <CardGallery ref="gallery" :deck="deck" :is-eligible="isEligible" :locked-reason="lockedReason" :selected-instance-id="selectedId" :label="'Карты колоды: ' + deck.length" @select="choose" />
      </section>
      <section ref="detail" class="cod-detail" aria-live="polite">
        <p v-if="!selected || !card" class="cod-empty">{{ mode === 'upgrade' ? 'Выберите ещё не улучшенную карту слева.' : 'Выберите карту слева.' }}</p>

        <template v-else-if="mode === 'upgrade' && upgraded">
          <div class="cod-compare">
            <figure><figcaption>Сейчас</figcaption><SpellCard :card="upgraded.before" :preview="neutralPreview(upgraded.before)" /></figure>
            <ArrowRight class="cod-arrow" :size="34" aria-hidden="true" />
            <figure class="is-after"><figcaption>Станет ↑</figcaption><SpellCard :card="upgraded.after" :preview="neutralPreview(upgraded.after)" /></figure>
          </div>
          <ul class="cod-changes" aria-label="Что изменится">
            <li v-for="row in changes" :key="row.id"><span>{{ row.label }}</span><b><s v-if="row.before">{{ row.before }}</s><template v-else>нет</template> <ArrowRight :size="14" aria-hidden="true" /> <mark>{{ row.after ?? 'нет' }}</mark></b></li>
            <li v-if="!changes.length"><span>Числа и условия не меняются</span></li>
          </ul>
          <p class="cod-text"><template v-for="(part, i) in words" :key="i"><mark v-if="part.changed">{{ part.word }}</mark><template v-else>{{ part.word }}</template></template></p>
          <p class="cod-note">Цена маны и класс сохраняются. Улучшение — один раз на копию.</p>
        </template>

        <template v-else-if="mode === 'remove'">
          <div class="cod-single">
            <SpellCard :card="card" :preview="neutralPreview(card)" />
            <CardNotes :card="card" :preview="neutralPreview(card)" mode="inspect" />
          </div>
          <p class="cod-count">Карт в колоде: <b>{{ deck.length }}</b> <ArrowRight :size="18" aria-hidden="true" /> <b class="is-new">{{ deck.length - 1 }}</b></p>
          <p v-if="twins > 1" class="cod-note">У вас {{ twins }} таких копий — удаляется одна, останется {{ twins - 1 }}.</p>
          <p v-if="lossWarning" class="cod-warn"><TriangleAlert :size="20" aria-hidden="true" />{{ lossWarning }}</p>
          <p class="cod-warn cod-warn--soft"><TriangleAlert :size="20" aria-hidden="true" />Удаление необратимо: карту нельзя вернуть в этом походе.</p>
        </template>

        <template v-else-if="mode === 'replace'">
          <div class="cod-swap">
            <figure class="is-old"><figcaption>Исчезнет<template v-if="wasUpgraded"> · ↑</template></figcaption><SpellCard :card="card" :preview="neutralPreview(card)" /></figure>
            <ArrowRight class="cod-arrow" :size="34" aria-hidden="true" />
            <div class="cod-offers" role="group" :aria-label="`Новая карта вместо «${card.name}». ${classLabel(card)}.`">
              <p v-if="!offers.length" class="cod-empty">Для этой карты нет замен.</p>
              <button v-for="offer in offers" :key="offer.id" class="cod-offer" :class="{ 'is-chosen': pickedId === offer.id }" :aria-pressed="pickedId === offer.id" :aria-label="`${offer.name}. ${manaText(offer.cost)}. ${offer.description}`" @click="choosePick(offer.id)">
                <span class="cod-offer-tag">{{ pickedId === offer.id ? 'Появится' : 'Предложение' }}</span>
                <SpellCard :card="offer" :preview="neutralPreview(offer)" />
                <small>{{ offer.description }}</small>
              </button>
            </div>
          </div>
          <p class="cod-note">Новая карта придёт без улучшения; в колоде останется {{ cardsText(deck.length) }}.</p>
          <p v-if="lossWarning" class="cod-warn"><TriangleAlert :size="20" aria-hidden="true" />{{ lossWarning }}</p>
        </template>
      </section>
    </div>
    <footer>
      <p class="cod-summary" aria-live="polite">{{ summary }}</p>
      <div>
        <button class="game-button game-button--quiet" @click="emit('close')">Отмена</button>
        <button class="game-button" :class="{ 'is-danger': mode === 'remove' }" :disabled="!ready" @click="confirm">{{ confirmLabel ?? labels[mode] }}</button>
      </div>
    </footer>
  </dialog>
</template>

<style scoped>
.cod{width:min(1240px,96vw);max-width:none;height:min(92vh,880px);max-height:none;padding:var(--sp-4);border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-wood);color:var(--ink);box-shadow:var(--shadow-4);overflow:hidden}
.cod[open]{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:var(--sp-3)}
.cod::backdrop{background:#101919dc}
header,footer{display:flex;justify-content:space-between;align-items:center;gap:var(--sp-4)}
h2{margin:0;font:700 var(--fs-2xl) var(--font-display);color:var(--parch-1)}
header p{margin:var(--sp-1) 0 0;color:var(--muted);font:600 var(--fs-sm)/1.4 var(--font-ui)}
.cod-body{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:var(--sp-4);min-height:0}
.cod-pick,.cod-detail{min-height:0;overflow:auto;padding:var(--sp-2);border:var(--border-panel);border-radius:var(--shape-scroll);background:#0000002e}
.cod-detail{display:flex;flex-direction:column;gap:var(--sp-3);align-items:center}
.cod-empty{margin:auto;color:var(--muted);text-align:center;font:600 var(--fs-md) var(--font-ui)}
figure{display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);margin:0;font-size:12px}
figcaption{font:700 var(--fs-md) var(--font-display);color:var(--parch-1)}
figure.is-after figcaption{color:var(--c-bonus)}
figure.is-old{opacity:.85}figure.is-old figcaption{color:var(--c-threat)}
.cod-compare,.cod-swap,.cod-single{display:flex;align-items:center;justify-content:center;gap:var(--sp-3)}
.cod-arrow{flex:none;color:var(--brass-1)}
.cod-changes{align-self:stretch;margin:0;padding:var(--sp-2) var(--sp-3);list-style:none;border-radius:var(--shape-chip);background:#fff1;font:700 var(--fs-md) var(--font-ui)}
.cod-changes li{display:flex;justify-content:space-between;gap:var(--sp-3);padding:3px 0}
.cod-changes b{display:inline-flex;align-items:center;gap:6px;font:700 var(--fs-lg) var(--font-num)}
.cod-changes s{color:var(--muted)}
mark{padding:0 4px;border-radius:4px;background:var(--brass-1);color:var(--parch-ink)}
.cod-text{align-self:stretch;margin:0;font:600 var(--fs-md)/1.5 var(--font-ui)}
.cod-note{align-self:stretch;margin:0;color:var(--muted);font:600 var(--fs-sm)/1.4 var(--font-ui)}
.cod-single{align-items:flex-start;font-size:14px}.cod-single :deep(.notes){width:16.5em;font-size:14px}
.cod-count{align-self:stretch;display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0;font:700 var(--fs-md) var(--font-ui)}
.cod-count b{font:700 var(--fs-xl) var(--font-num)}.cod-count b.is-new{color:var(--c-bonus)}
.cod-warn{align-self:stretch;display:flex;align-items:flex-start;gap:var(--sp-2);margin:0;padding:var(--sp-2) var(--sp-3);border-left:4px solid var(--c-threat);border-radius:var(--r-1);background:#ff6a3d22;color:var(--parch-1);font:700 var(--fs-sm)/1.35 var(--font-ui)}
.cod-warn svg{flex:none;color:var(--c-threat)}
.cod-warn--soft{background:#0004;border-left-color:var(--brass-3);font-weight:600}.cod-warn--soft svg{color:var(--brass-2)}
.cod-offers{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-2)}
.cod--replace .cod-body{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr)}
.cod--replace figure{font-size:10px}.cod-swap{align-items:flex-start;gap:var(--sp-2)}.cod-swap .cod-arrow{align-self:center}
.cod-offer{display:flex;flex-direction:column;align-items:center;gap:var(--sp-1);width:calc(10px * 12 + 18px);padding:var(--sp-2);border:2px solid transparent;border-radius:var(--shape-scroll);background:transparent;color:var(--ink);font-size:10px;cursor:pointer}
.cod-offer:hover{background:#ffffff10}
.cod-offer:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}
.cod-offer.is-chosen{border-color:var(--c-bonus);background:color-mix(in srgb,var(--c-bonus) 14%,transparent);box-shadow:var(--glow-bonus)}
.cod-offer small{font:600 var(--fs-xs)/1.3 var(--font-ui);color:var(--ink)}
.cod-offer-tag{font:800 var(--fs-xs) var(--font-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.cod-offer.is-chosen .cod-offer-tag{color:var(--c-bonus)}
footer{padding-top:var(--sp-3);border-top:var(--border-panel)}
footer>div{display:flex;flex:none;gap:var(--sp-3)}
.cod-summary{margin:0;font:700 var(--fs-md)/1.35 var(--font-ui);color:var(--parch-1)}
.game-button.is-danger{background:linear-gradient(#b8452f,#6e2418);border-color:#e58a6c}
@media(min-height:900px){.cod{width:min(1600px,96vw);height:min(92vh,1000px)}.cod :deep(.cg-grid){--cs:12px}figure,.cod--replace figure{font-size:15px}.cod-single{font-size:16px}.cod-single :deep(.notes){font-size:15px}.cod-offer{font-size:14px;width:calc(14px * 12 + 20px)}}
@media(max-height:800px){figure,.cod--replace figure,.cod-offer{font-size:9px}.cod-offer{width:calc(9px * 12 + 16px)}.cod-single{font-size:12px}.cod-single :deep(.notes){font-size:12px}}
@media(max-width:900px){
  .cod{padding:var(--sp-2);height:94vh}
  .cod-body{display:flex;flex-direction:column;overflow:auto}
  .cod-pick,.cod-detail{overflow:visible;flex:none}
  footer{flex-wrap:wrap}
  header{align-items:flex-start}
}
</style>
