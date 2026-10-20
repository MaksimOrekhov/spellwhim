<script setup lang="ts">
import { computed } from 'vue'
import { Anvil, Gem, ScrollText } from '@lucide/vue'
import type { DungeonRunState } from '../game/campaign'
import { roomActions, roomEligibleCards, roomReplacementOptions, roomActionAvailable } from '../game/dungeonRooms'
import { roomRules } from '../game/roomRules'
import type { RoomAction, RoomCommand, RoomSelection } from '../game/dungeonRooms'
import { sectorEventText } from '../game/sectorContent'
import { artifactDefinition } from '../game/artifacts'
import { cardDefinition } from '../game/types'
import { resolveCardDefinition } from '../game/cardProgression'
import { neutralPreview } from '../ui/cardDisplay'
import UpgradePicker from './UpgradePicker.vue'
import SpellCard from './SpellCard.vue'
import DeckViewer from './DeckViewer.vue'

const props = defineProps<{ run: DungeonRunState }>()
const emit = defineEmits<{ select: [selection: RoomSelection | null]; confirm: [command: RoomCommand] }>()
const room = computed(() => props.run.room!)
const draft = computed(() => room.value.selection)
const action = computed(() => draft.value?.action)
const paid = computed(() => room.value.eventId === 'forgotten-forge')
const title = computed(() => room.value.type === 'forge' ? 'Шахтная кузница' : room.value.type === 'treasure' ? 'Забытый тайник' : sectorEventText[room.value.eventId!].name)
const copy = computed(() => room.value.type === 'event' ? sectorEventText[room.value.eventId!].text : room.value.type === 'forge' ? 'Горн ещё тёплый. Одна услуга на весь отряд: выберите карту и подтвердите изменение.' : 'Под рельсами спрятан сундук. Возьмите один артефакт или одну карту. От остального придётся отказаться.')
const labels: Record<RoomAction,string> = { upgrade:'Улучшить карту',remove:'Удалить карту',replace:'Заменить карту',card:'Взять обычную карту',risk:'Рискнуть ради улучшенной',artifact:'Взять артефакт',leave:'Уйти без награды' }
const descriptions = computed<Record<RoomAction,string>>(() => ({ upgrade: paid.value ? `Цена: ${roomRules.upgradeHealth} HP выбранного героя. Он должен пережить оплату.` : 'Одна обычная копия станет улучшенной. Цена маны прежняя.', remove:'Удалить выбранную копию навсегда. Последнюю карту удалить нельзя.',replace:`До ${roomRules.replacements} карт того же класса. Новая копия без улучшения.`,card:`Одна карта из ${roomRules.cards}, без риска для здоровья.`,risk:`${roomRules.riskChance*100}%: улучшенная карта; ${100-roomRules.riskChance*100}%: оба героя теряют по ${roomRules.riskHealth} HP, без карты.`,artifact:`До ${roomRules.artifacts} предложений. Один личный слот на героя, возможна замена.`,leave:'Завершить посещение. Награду потом забрать нельзя.' }))
const eligible = computed(() => roomEligibleCards(props.run, action.value ?? 'leave'))
const selected = computed(() => eligible.value.find(c => c.instanceId === draft.value?.instanceId))
const replacements = computed(() => selected.value ? roomReplacementOptions(props.run,selected.value).map(resolveCardDefinition) : [])
const selectedCard = computed(() => selected.value ? resolveCardDefinition(selected.value) : undefined)
const selectionSummary = computed(() => selected.value && (action.value === 'remove' || action.value === 'replace') ? `Копия ${props.run.deck.indexOf(selected.value)+1}: ${selectedCard.value!.name}${selected.value.upgrade ? ' ↑ (улучшена)' : ' (без улучшения)'}` : '')
const lossWarning = computed(() => selected.value?.upgrade ? action.value === 'remove' ? 'Вы удаляете улучшенную копию. Её улучшение будет потеряно навсегда.' : 'При замене улучшение будет потеряно. Новая копия — без улучшения.' : '')
const offers = computed(() => room.value.cards.map(resolveCardDefinition))
const selectedOwner = computed(() => draft.value?.heroId ? props.run.heroes[draft.value.heroId] : undefined)
const occupied = computed(() => props.run.artifacts.find(a => a.ownerInstanceId === selectedOwner.value?.instanceId))
const canConfirm = computed(() => !!action.value && roomActionAvailable(props.run,action.value) && (action.value === 'leave' || action.value === 'risk' || (action.value === 'remove' && selected.value) || (action.value === 'replace' && selected.value && replacements.value.some(c => c.id === draft.value?.cardId)) || (action.value === 'card' && offers.value.some(c => c.id === draft.value?.cardId)) || (action.value === 'artifact' && selectedOwner.value && draft.value?.artifactId)))
const payment = computed(() => paid.value && selectedOwner.value ? `Платит ${selectedOwner.value.name}: ${selectedOwner.value.health} → ${selectedOwner.value.health-roomRules.upgradeHealth} HP` : '')
const upgradeOpen = computed(() => action.value === 'upgrade' && (!paid.value || !!selectedOwner.value))
function disabled(a: RoomAction) {
  return !roomActionAvailable(props.run,a)
}
function update(value: Partial<RoomSelection>) { emit('select', { ...draft.value!, ...value }) }
function confirm(instanceId?: string) {
  if (!draft.value) return
  emit('confirm', { ...draft.value, ...(instanceId ? {instanceId} : {}), roomId:room.value.id, ...(occupied.value ? { replaceInstanceId:occupied.value.instanceId } : {}) })
}
</script>

<template>
  <main class="room-screen">
    <header><component :is="room.type === 'forge' ? Anvil : room.type === 'treasure' ? Gem : ScrollText" :size="30" aria-hidden="true"/><div><small>СЕКТОР I · СТАРЫЕ ШТОЛЬНИ</small><h1>{{ title }}</h1></div><DeckViewer :deck="run.deck" /></header>
    <div class="room-body">
      <p class="story">{{ copy }}</p>
      <div class="room-choices" aria-label="Действия в комнате">
        <button v-for="a in roomActions(room)" :key="a" class="choice" :class="{selected:action===a}" :disabled="disabled(a)" :aria-pressed="action===a" @click="emit('select',{action:a})"><strong>{{ labels[a] }}</strong><span>{{ descriptions[a] }}</span><small v-if="disabled(a)">Нет доступной цели или недостаточно здоровья</small></button>
      </div>
      <section v-if="draft" class="selection" aria-live="polite">
        <h2>{{ labels[draft.action] }}</h2>
        <p v-if="action==='upgrade' && paid">Кто потратит {{ roomRules.upgradeHealth }} HP?</p>
        <div v-if="(action==='upgrade' && paid) || action==='artifact'" class="hero-options">
          <button v-for="hero in [run.heroes.warrior,run.heroes.mage]" :key="hero.instanceId" class="game-button" :disabled="action==='upgrade' && hero.health<=roomRules.upgradeHealth" :aria-pressed="draft.heroId===hero.id" @click="update({heroId:hero.id})">{{ hero.name }} · {{ hero.health }}/{{ hero.maxHealth }} HP<span v-if="action==='artifact'"> · {{ run.artifacts.find(a=>a.ownerInstanceId===hero.instanceId) ? 'слот занят' : 'слот свободен' }}</span></button>
        </div>
        <div v-if="action==='remove' || action==='replace'" class="deck-options">
          <button v-for="c in eligible" :key="c.instanceId" class="choice" :class="{selected:draft.instanceId===c.instanceId}" :aria-pressed="draft.instanceId===c.instanceId" @click="emit('select',{action:action!,instanceId:c.instanceId})"><strong>{{ resolveCardDefinition(c).name }}{{ c.upgrade ? ' ↑' : '' }}</strong><span>Копия {{ run.deck.indexOf(c)+1 }} · {{ c.upgrade ? 'Улучшена' : 'Без улучшения' }} · {{ cardDefinition(c.definitionId).className==='warrior' ? 'Воин' : 'Маг' }}</span></button>
        </div>
        <div v-if="selected && selectedCard && (action==='remove' || action==='replace')" class="selected-copy"><SpellCard :card="selectedCard" :preview="neutralPreview(selectedCard)"/><div><p>{{ selectionSummary }}</p><p>{{ selectedCard.description }}</p><p v-if="action==='remove'">В колоде останется {{ run.deck.length-1 }} карт.</p><strong v-if="lossWarning">{{ lossWarning }}</strong></div></div>
        <div v-if="action==='card' || (action==='replace' && selected)" class="card-options">
          <button v-for="c in action==='card' ? offers : replacements" :key="c.id" class="card-choice" :class="{selected:draft.cardId===c.id}" :aria-label="c.name+'. '+c.description" @click="update({cardId:c.id})"><SpellCard :card="c" :preview="neutralPreview(c)"/><p>{{ c.description }}</p></button>
        </div>
        <template v-if="action==='risk' && room.riskCard"><p>{{ descriptions.risk }} Предложение при успехе: {{ resolveCardDefinition(room.riskCard).name }}.</p><div class="card-options"><div class="card-choice"><SpellCard :card="resolveCardDefinition(room.riskCard)" :preview="neutralPreview(resolveCardDefinition(room.riskCard))"/><p>{{ resolveCardDefinition(room.riskCard).description }}</p></div></div></template>
        <div v-if="action==='artifact'" class="artifact-options">
          <button v-for="id in room.artifactIds" :key="id" class="choice" :class="{selected:draft.artifactId===id}" @click="update({artifactId:id})"><strong>{{ artifactDefinition(id).name }}</strong><span>{{ artifactDefinition(id).description }}</span></button>
          <p v-if="occupied">Подтверждение заменит «{{ artifactDefinition(occupied.definitionId).name }}». Старый предмет исчезнет.</p>
        </div>
        <p v-if="action==='leave'">Вы покинете комнату без изменений. Это завершит посещение.</p>
      </section>
    </div>
    <footer><div class="confirmation-summary" aria-live="polite"><span v-if="selectionSummary">{{ action==='replace' ? 'Заменить' : 'Удалить' }} · {{ selectionSummary }}<template v-if="action==='replace' && draft?.cardId"> → {{ replacements.find(c=>c.id===draft?.cardId)?.name }} (без улучшения)</template></span><strong v-if="lossWarning">{{ lossWarning }}</strong><span v-if="!selectionSummary">Вариан {{ run.heroes.warrior.health }} HP · Джайна {{ run.heroes.mage.health }} HP · Карт: {{ run.deck.length }}</span></div><div><button v-if="draft" class="game-button" @click="emit('select',null)">Отмена выбора</button><button v-if="action!=='upgrade'" class="game-button" :disabled="!canConfirm" @click="confirm()">Подтвердить</button></div></footer>
    <UpgradePicker v-if="upgradeOpen" :deck="eligible" :selected-instance-id="draft?.instanceId" :explanation="paid ? payment+'. Одна операция за посещение.' : 'Бесплатная услуга кузницы. Одна операция за посещение.'" :confirm-label="paid ? payment+' · Улучшить' : undefined" @select="update({instanceId:$event})" @confirm="confirm" @close="emit('select',null)" />
  </main>
</template>

<style scoped>
.selected-copy{display:flex;align-items:center;justify-content:center;gap:var(--sp-4);font-size:12px;margin:var(--sp-4) 0}.selected-copy>div{max-width:380px;font-size:var(--fs-sm)}footer .confirmation-summary{display:grid;gap:var(--sp-1);max-width:65%}.confirmation-summary strong{color:var(--parch-1)}
.room-screen{position:absolute;inset:0;z-index:8;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:var(--sp-3);padding:var(--sp-4) clamp(18px,4vw,70px);background:var(--mat-wood);color:var(--ink)}header,footer{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4)}header>div{flex:1}h1,h2{font-family:var(--font-display);margin:0}h1{font-size:var(--fs-3xl)}h2{font-size:var(--fs-xl);margin-bottom:var(--sp-3)}small,.story,footer{color:var(--muted)}.room-body{overflow:auto;padding:var(--sp-2)}.story{max-width:900px;line-height:var(--lh-body);margin:0 0 var(--sp-4)}.room-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:var(--sp-3)}.choice{display:grid;align-content:start;gap:var(--sp-2);padding:var(--sp-3);border:var(--border-panel);border-radius:var(--shape-dialog);background:var(--mat-quiet);color:var(--ink);text-align:left;cursor:pointer;font:600 var(--fs-sm)/var(--lh-body) var(--font-ui)}.choice strong{font:700 var(--fs-lg) var(--font-display);color:var(--parch-1)}.choice span{color:var(--muted)}.selected,[aria-pressed=true]{outline:var(--focus-ring);outline-offset:var(--focus-offset)}button:disabled{opacity:.45;cursor:default}.selection{margin-top:var(--sp-4);padding:var(--sp-4);border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-quiet)}.hero-options{display:flex;flex-wrap:wrap;gap:var(--sp-3);margin-bottom:var(--sp-4)}.deck-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--sp-2);padding:var(--sp-2)}.card-options{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-5);padding:var(--sp-3)}.card-choice{display:flex;flex-direction:column;align-items:center;width:220px;border:0;border-radius:var(--shape-dialog);background:transparent;color:var(--ink);font-size:17px;padding:var(--sp-2);cursor:pointer}.card-choice p{font:600 var(--fs-sm)/var(--lh-body) var(--font-ui)}.artifact-options{display:grid;gap:var(--sp-3);grid-template-columns:repeat(2,minmax(0,1fr))}.artifact-options p{grid-column:1/-1}footer{border-top:var(--border-panel);padding-top:var(--sp-3);font-size:var(--fs-sm)}footer>div{display:flex;gap:var(--sp-3)}@media(max-width:700px){header,footer{flex-wrap:wrap}.artifact-options{grid-template-columns:1fr}.room-screen{padding:var(--sp-3)}h1{font-size:var(--fs-2xl)}}
</style>
