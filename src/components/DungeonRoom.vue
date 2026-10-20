<script setup lang="ts">
import { computed } from 'vue'
import { Anvil, Bomb, DoorOpen, Dices, Flame, Gem, Gift, Handshake, Hammer, Heart, Replace, ScrollText, ShieldCheck, Sparkles, Trash, ArrowBigUpDash } from '@lucide/vue'
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

type Tone = 'safe' | 'cost' | 'risk' | 'leave'
const actionIcons: Record<RoomAction, typeof Anvil> = { upgrade: ArrowBigUpDash, remove: Trash, replace: Replace, card: Gift, risk: Dices, artifact: Gem, leave: DoorOpen }
/** Presentation only: what an option costs the party, in one glance. The numbers come from roomRules. */
const tags = computed<Record<RoomAction, { tone: Tone; text: string; icon: typeof Heart }>>(() => ({
  upgrade: paid.value ? { tone: 'cost', text: `Цена: ${roomRules.upgradeHealth} HP`, icon: Heart } : { tone: 'safe', text: 'Бесплатно', icon: ShieldCheck },
  remove: { tone: 'cost', text: 'Навсегда', icon: Trash },
  replace: { tone: 'cost', text: 'Обмен', icon: Replace },
  card: { tone: 'safe', text: 'Без риска', icon: ShieldCheck },
  risk: { tone: 'risk', text: `Риск: ${roomRules.riskChance*100}% / ${100-roomRules.riskChance*100}%`, icon: Flame },
  artifact: { tone: 'safe', text: 'Личный слот', icon: Sparkles },
  leave: { tone: 'leave', text: 'Без награды', icon: DoorOpen },
}))
const roomIcon = computed(() => room.value.type === 'forge' ? Anvil : room.value.type === 'treasure' ? Gem : room.value.eventId === 'powder-store' ? Bomb : room.value.eventId === 'goblin-trade' ? Handshake : room.value.eventId === 'forgotten-forge' ? Hammer : ScrollText)
const kicker = computed(() => room.value.type === 'forge' ? 'Сервисная комната · Кузница' : room.value.type === 'treasure' ? 'Сервисная комната · Сокровищница' : 'Случай в шахте')
const sparks = Array.from({ length: 14 }, (_, i) => ({ left: `${(i * 37 + 11) % 100}%`, delay: `${(i * 0.7) % 6}s`, size: `${3 + (i % 4)}px`, dur: `${5 + (i % 5)}s` }))
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
  <main class="room-screen" :class="[`room-screen--${room.type}`, room.eventId ? `room-screen--${room.eventId}` : '']">
    <div class="sparks" aria-hidden="true"><i v-for="(s, i) in sparks" :key="i" :style="{ left: s.left, animationDelay: s.delay, animationDuration: s.dur, width: s.size, height: s.size }"></i></div>
    <component :is="roomIcon" class="watermark" aria-hidden="true" :stroke-width="0.9"/>
    <header>
      <span class="room-emblem" aria-hidden="true"><component :is="roomIcon" :size="34" :stroke-width="1.8"/></span>
      <div class="room-title"><small>СЕКТОР I · СТАРЫЕ ШТОЛЬНИ</small><h1>{{ title }}</h1><span class="room-kicker">{{ kicker }}</span></div>
      <DeckViewer :deck="run.deck" />
    </header>
    <div class="room-body" :class="{ 'is-compact': !!draft }">
      <p class="story">{{ copy }}</p>
      <div class="room-choices" :class="`room-choices--${room.type}`" aria-label="Действия в комнате">
        <button v-for="a in roomActions(room)" :key="a" class="choice" :class="[`choice--${tags[a].tone}`, `choice--${a}`, {selected:action===a}]" :disabled="disabled(a)" :aria-pressed="action===a" @click="emit('select',{action:a})">
          <span class="choice-icon" aria-hidden="true"><component :is="actionIcons[a]" :size="26" :stroke-width="1.9"/></span>
          <span class="choice-text"><strong>{{ labels[a] }}</strong><span>{{ descriptions[a] }}</span></span>
          <span class="choice-tag"><component :is="tags[a].icon" :size="13" :stroke-width="2.4" aria-hidden="true"/>{{ tags[a].text }}</span>
          <small v-if="disabled(a)">Нет доступной цели или недостаточно здоровья</small>
        </button>
      </div>
      <section v-if="draft" class="selection" aria-live="polite">
        <h2>{{ labels[draft.action] }}</h2>
        <p v-if="action==='upgrade' && paid">Кто потратит {{ roomRules.upgradeHealth }} HP?</p>
        <div v-if="(action==='upgrade' && paid) || action==='artifact'" class="hero-options">
          <button v-for="hero in [run.heroes.warrior,run.heroes.mage]" :key="hero.instanceId" class="game-button" :disabled="action==='upgrade' && hero.health<=roomRules.upgradeHealth" :aria-pressed="draft.heroId===hero.id" @click="update({heroId:hero.id})">{{ hero.name }} · {{ hero.health }}/{{ hero.maxHealth }} HP<span v-if="action==='artifact'"> · {{ run.artifacts.find(a=>a.ownerInstanceId===hero.instanceId) ? 'слот занят' : 'слот свободен' }}</span></button>
        </div>
        <div v-if="action==='remove' || action==='replace'" class="deck-options">
          <button v-for="c in eligible" :key="c.instanceId" class="choice choice--pick" :class="{selected:draft.instanceId===c.instanceId, 'is-upgraded':c.upgrade}" :aria-pressed="draft.instanceId===c.instanceId" @click="emit('select',{action:action!,instanceId:c.instanceId})"><span class="choice-text"><strong>{{ resolveCardDefinition(c).name }}{{ c.upgrade ? ' ↑' : '' }}</strong><span>Копия {{ run.deck.indexOf(c)+1 }} · {{ c.upgrade ? 'Улучшена' : 'Без улучшения' }} · {{ cardDefinition(c.definitionId).className==='warrior' ? 'Воин' : 'Маг' }}</span></span></button>
        </div>
        <div v-if="selected && selectedCard && (action==='remove' || action==='replace')" class="selected-copy"><SpellCard :card="selectedCard" :preview="neutralPreview(selectedCard)"/><div><p>{{ selectionSummary }}</p><p>{{ selectedCard.description }}</p><p v-if="action==='remove'">В колоде останется {{ run.deck.length-1 }} карт.</p><strong v-if="lossWarning" class="loss-warning">{{ lossWarning }}</strong></div></div>
        <div v-if="action==='card' || (action==='replace' && selected)" class="card-options">
          <button v-for="c in action==='card' ? offers : replacements" :key="c.id" class="card-choice" :class="{selected:draft.cardId===c.id}" :aria-label="c.name+'. '+c.description" @click="update({cardId:c.id})"><SpellCard :card="c" :preview="neutralPreview(c)"/><p>{{ c.description }}</p></button>
        </div>
        <template v-if="action==='risk' && room.riskCard"><p>{{ descriptions.risk }} Предложение при успехе: {{ resolveCardDefinition(room.riskCard).name }}.</p><div class="card-options"><div class="card-choice"><SpellCard :card="resolveCardDefinition(room.riskCard)" :preview="neutralPreview(resolveCardDefinition(room.riskCard))"/><p>{{ resolveCardDefinition(room.riskCard).description }}</p></div></div></template>
        <div v-if="action==='artifact'" class="artifact-options">
          <button v-for="id in room.artifactIds" :key="id" class="choice choice--artifact-pick" :class="{selected:draft.artifactId===id}" @click="update({artifactId:id})"><span class="choice-icon" aria-hidden="true"><Gem :size="26" :stroke-width="1.9"/></span><span class="choice-text"><strong>{{ artifactDefinition(id).name }}</strong><span>{{ artifactDefinition(id).description }}</span></span></button>
          <p v-if="occupied" class="loss-warning">Подтверждение заменит «{{ artifactDefinition(occupied.definitionId).name }}». Старый предмет исчезнет.</p>
        </div>
        <p v-if="action==='leave'">Вы покинете комнату без изменений. Это завершит посещение.</p>
      </section>
    </div>
    <footer><div class="confirmation-summary" aria-live="polite"><span v-if="selectionSummary">{{ action==='replace' ? 'Заменить' : 'Удалить' }} · {{ selectionSummary }}<template v-if="action==='replace' && draft?.cardId"> → {{ replacements.find(c=>c.id===draft?.cardId)?.name }} (без улучшения)</template></span><strong v-if="lossWarning">{{ lossWarning }}</strong><span v-if="!selectionSummary">Вариан {{ run.heroes.warrior.health }} HP · Джайна {{ run.heroes.mage.health }} HP · Карт: {{ run.deck.length }}</span></div><div><button v-if="draft" class="game-button" @click="emit('select',null)">Отмена выбора</button><button v-if="action!=='upgrade'" class="game-button" :disabled="!canConfirm" @click="confirm()">Подтвердить</button></div></footer>
    <UpgradePicker v-if="upgradeOpen" :deck="eligible" :selected-instance-id="draft?.instanceId" :explanation="paid ? payment+'. Одна операция за посещение.' : 'Бесплатная услуга кузницы. Одна операция за посещение.'" :confirm-label="paid ? payment+' · Улучшить' : undefined" @select="update({instanceId:$event})" @confirm="confirm" @close="emit('select',null)" />
  </main>
</template>

<style scoped>
/* Every service room is a small scene: a themed glow behind a timbered frame, drifting sparks, a lamp-lit story card. */
.room-screen{--glow:#f0a64a;--glow-soft:#f0a64a30;position:absolute;inset:0;z-index:8;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:var(--sp-3);padding:var(--sp-4) clamp(18px,4vw,70px);color:var(--ink);overflow:hidden;background:radial-gradient(ellipse at 50% 0%,var(--glow-soft),#0000 62%),radial-gradient(ellipse at 50% 120%,var(--glow-soft),#0000 55%),var(--mat-wood)}
.room-screen--forge,.room-screen--forgotten-forge{--glow:#ff7a2a;--glow-soft:#ff6a3d38}
.room-screen--treasure{--glow:var(--c-bonus);--glow-soft:#ffd56b30}
.room-screen--powder-store{--glow:#ff6a3d;--glow-soft:#ff6a3d2e}
.room-screen--goblin-trade{--glow:var(--c-heal);--glow-soft:#8ad66f26}
.room-screen::before{position:absolute;inset:var(--sp-2);content:"";pointer-events:none;border:var(--border-panel);border-radius:var(--shape-dialog);box-shadow:var(--shadow-4),inset 0 0 90px #0009}
.room-screen>*{position:relative;z-index:1}
.sparks{position:absolute!important;inset:0;z-index:0!important;overflow:hidden;pointer-events:none}
.sparks i{position:absolute;bottom:-12px;border-radius:50%;background:var(--glow);box-shadow:0 0 10px 2px var(--glow);opacity:0;animation:rise linear infinite}
@keyframes rise{0%{opacity:0;transform:translateY(0)}12%{opacity:.9}100%{opacity:0;transform:translateY(-70vh) translateX(26px)}}
header,footer{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4)}
header>.room-title{flex:1}
.room-emblem{display:grid;place-items:center;flex:0 0 68px;height:68px;border-radius:var(--shape-medallion);border:3px solid var(--brass-2);background:radial-gradient(circle at 35% 25%,#fff3,#0000 55%),var(--wood-0);color:var(--glow);box-shadow:0 0 28px var(--glow-soft),0 0 0 4px var(--wood-1),var(--shadow-3)}
h1,h2{font-family:var(--font-display);margin:0}
h1{font-size:var(--fs-3xl);color:var(--parch-1);text-shadow:0 2px 0 #000a,0 0 26px var(--glow-soft)}
h2{font-size:var(--fs-xl);margin-bottom:var(--sp-3);color:var(--parch-1)}
.room-title small{color:var(--brass-2);font:700 var(--fs-xs) var(--font-display);letter-spacing:var(--ls-caps)}
.room-kicker{display:inline-block;margin-top:2px;padding:1px 10px;border-radius:var(--r-pill);background:var(--glow-soft);color:var(--glow);font:800 11px var(--font-display);letter-spacing:var(--ls-caps);text-transform:uppercase}
footer{color:var(--muted)}
.room-body{display:flex;flex-direction:column;overflow:auto;padding:var(--sp-2)}.room-body>.story{margin-top:var(--sp-5)}.room-body>.room-choices{margin-bottom:auto}
.is-compact>.story{display:none}.is-compact .choice{padding:var(--sp-2) var(--sp-3)}.is-compact .choice-text>span,.is-compact .choice>small{display:none}.is-compact .choice-icon{width:40px;height:40px}.is-compact .choice-icon :deep(svg){width:20px;height:20px}.is-compact .choice-tag{grid-column:2}.is-compact .room-choices--treasure .choice--artifact,.is-compact .room-choices--treasure .choice--card{min-height:0}.is-compact .selection{margin-top:var(--sp-3)}.is-compact .choice--pick .choice-text>span,.is-compact .choice--artifact-pick .choice-text>span{display:block}
.watermark{position:absolute!important;z-index:0!important;left:50%;bottom:-70px;translate:-50% 0;width:560px;height:560px;color:var(--glow);opacity:.07;pointer-events:none}
.story{max-width:880px;margin:0 auto var(--sp-5);padding:var(--sp-4) var(--sp-6);border:var(--border-brass);border-radius:var(--shape-scroll);background:var(--mat-parchment);color:var(--parch-ink);font:600 var(--fs-lg)/var(--lh-body) var(--font-ui);text-align:center;box-shadow:var(--shadow-3),inset 0 0 26px #8a622833}
.room-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--sp-3)}
.room-choices--treasure{grid-template-columns:1fr 1fr;max-width:980px;margin:0 auto}
.room-choices--treasure .choice--leave{grid-column:1/-1;justify-self:center;width:min(420px,100%)}
.choice{position:relative;display:grid;grid-template-columns:auto 1fr;align-content:start;align-items:center;gap:var(--sp-2) var(--sp-3);padding:var(--sp-4);border:var(--border-panel);border-radius:var(--shape-dialog);background:var(--mat-quiet);color:var(--ink);text-align:left;cursor:pointer;font:600 var(--fs-sm)/var(--lh-body) var(--font-ui);box-shadow:var(--shadow-2);transition:transform var(--dur-base),filter var(--dur-base)}
.choice:not(:disabled):hover{transform:translateY(-2px);filter:brightness(1.12)}
.choice-icon{display:grid;place-items:center;width:54px;height:54px;border-radius:var(--r-pill);border:2px solid var(--tone,var(--brass-2));background:var(--wood-0);color:var(--tone,var(--brass-2));box-shadow:inset 0 0 10px #000a}
.choice-text{display:grid;gap:2px}
.choice strong{font:700 var(--fs-lg) var(--font-display);color:var(--parch-1)}
.choice-text>span{color:var(--muted);font-size:var(--fs-md)}
.choice-tag{grid-column:1/-1;display:inline-flex;align-items:center;justify-self:start;gap:5px;padding:2px 10px;border-radius:var(--r-pill);background:#0006;color:var(--tone,var(--brass-2));font:800 11px var(--font-ui);letter-spacing:.04em;text-transform:uppercase}
.choice>small{grid-column:1/-1;color:var(--muted)}
.choice--safe{--tone:var(--c-heal)}.choice--cost{--tone:var(--c-bonus)}.choice--risk{--tone:var(--c-threat);background:linear-gradient(#5a2a1c,#2f1a14)}.choice--leave{--tone:var(--muted);background:var(--wood-1);box-shadow:none}
.choice--leave strong{color:var(--muted)}
.choice--pick{grid-template-columns:1fr;padding:var(--sp-2) var(--sp-3)}.choice--pick.is-upgraded{--tone:var(--c-bonus);border-color:var(--c-bonus);box-shadow:var(--glow-bonus)}
.choice--artifact-pick{--tone:var(--c-bonus);min-height:86px}
.room-screen--treasure .choice--artifact,.room-screen--treasure .choice--card{min-height:132px;--tone:var(--c-bonus);background:linear-gradient(#4a3a1a,#2a2010);border-color:var(--brass-2)}
.selected,[aria-pressed=true]{outline:var(--focus-ring);outline-offset:var(--focus-offset)}
button:disabled{opacity:.45;cursor:default}
.selection{margin-top:var(--sp-4);padding:var(--sp-4);border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-quiet);box-shadow:var(--shadow-3)}
.selected-copy{display:flex;align-items:center;justify-content:center;gap:var(--sp-4);font-size:12px;margin:var(--sp-4) 0}.selected-copy>div{max-width:380px;font-size:var(--fs-sm)}
.loss-warning{display:block;padding:var(--sp-2) var(--sp-3);border-left:4px solid var(--c-threat);border-radius:var(--r-1);background:#ff6a3d22;color:var(--parch-1)}
footer .confirmation-summary{display:grid;gap:var(--sp-1);max-width:65%}.confirmation-summary strong{color:var(--parch-1)}
.hero-options{display:flex;flex-wrap:wrap;gap:var(--sp-3);margin-bottom:var(--sp-4)}
.deck-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--sp-2);padding:var(--sp-2)}
.card-options{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-5);padding:var(--sp-3)}
.card-choice{display:flex;flex-direction:column;align-items:center;width:220px;border:0;border-radius:var(--shape-dialog);background:transparent;color:var(--ink);font-size:17px;padding:var(--sp-2);cursor:pointer}.card-choice p{font:600 var(--fs-sm)/var(--lh-body) var(--font-ui)}
.artifact-options{display:grid;gap:var(--sp-3);grid-template-columns:repeat(2,minmax(0,1fr))}.artifact-options p{grid-column:1/-1}
footer{border-top:var(--border-panel);padding-top:var(--sp-3);font-size:var(--fs-sm)}footer>div{display:flex;gap:var(--sp-3)}
@media(prefers-reduced-motion:reduce){.sparks i{animation:none}}
@media(max-height:760px){.story{padding:var(--sp-3) var(--sp-5);font-size:var(--fs-md)}.room-emblem{flex-basis:56px;height:56px}h1{font-size:var(--fs-2xl)}.choice{padding:var(--sp-2) var(--sp-3)}}
@media(max-width:700px){header,footer{flex-wrap:wrap}.artifact-options,.room-choices--treasure{grid-template-columns:1fr}.room-screen{padding:var(--sp-3)}h1{font-size:var(--fs-2xl)}}
</style>
