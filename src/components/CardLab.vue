<script setup lang="ts">
// Dev-only card lab (card-preview.html?view=sheet|states|deck|ops). Reproducible card states for visual review and screenshots; the rules engine
// still supplies every number (neutralPreview / previewCard), nothing is computed here.
// Query: ?view=sheet &em=14 &tiles=1 | ?view=states | ?view=deck | ?view=ops &mode=upgrade|remove|replace &sel=N (index into the deck gallery order)
import { computed, onMounted } from 'vue'
import SpellCard from './SpellCard.vue'
import CompactCard from './CompactCard.vue'
import DeckViewer from './DeckViewer.vue'
import CardOperationDialog from './CardOperationDialog.vue'
import { cards } from '../game/types'
import { createBattle, previewCard } from '../game/battle'
import { applyStatus } from '../game/statuses'
import { classThemes, classThemeStyle } from '../game/classThemes'
import { canUpgradeCard, resolveCardDefinition } from '../game/cardProgression'
import { honestDeck } from '../game/honestDecks'
import { encounters } from '../game/types'
import { neutralPreview } from '../ui/cardDisplay'
import { groupCopies } from '../ui/cardOperations'
import type { CardBlock } from '../ui/cardDisplay'
import type { BattleState, CardDefinition, CardId, CardPreview, PersistentCard } from '../game/types'

const props = defineProps<{ view: 'sheet' | 'states' | 'deck' | 'ops'; query: URLSearchParams }>()
const em = Number(props.query.get('em') ?? 14)

// ── sheet: every card of the catalogue, by class ─────────────────────────────
const byClass = Object.keys(classThemes).map(id => ({ id: id as keyof typeof classThemes, cards: cards.filter(card => card.className === id) }))

// ── states: the same cards in the states a player meets ──────────────────────
function board(setup?: (state: BattleState) => void): BattleState {
  const state = createBattle(encounters.find(item => item.id === 'root-sentinel')!, undefined, { seed: 7 })
  setup?.(state)
  return state
}
const calm = board()
// The enemy's declared action is an attack, so "if the enemy attacks" cards are active; Vulnerability and Jaina's armor wake the synergies.
const hot = board(state => { applyStatus(state, 'enemy', 'vulnerability'); state.heroes.mage.armor = 3; state.heroes.warrior.armor = 4 })
const frozen = board(state => { applyStatus(state, 'enemy', 'frostbite'); applyStatus(state, 'enemy', 'bleeding', 3) })
const def = (id: CardId, upgrade: 0 | 1 = 0) => resolveCardDefinition({ definitionId: id, upgrade })
interface Specimen { title: string; card: CardDefinition; preview: CardPreview; block?: CardBlock | null }
const specimen = (title: string, card: CardDefinition, state: BattleState | null, block: CardBlock | null = null): Specimen => ({ title, card, preview: state ? previewCard(state, card) : neutralPreview(card), block })
const manaBlock: CardBlock = { kind: 'mana', text: 'Недостаточно маны' }
const phaseBlock: CardBlock = { kind: 'phase', text: 'Сейчас ход противника' }
const groups = computed<{ name: string; items: Specimen[] }[]>(() => [
  { name: 'Доступна · не хватает маны · не её фаза', items: [specimen('Доступна', def('sword-strike'), calm), specimen('Не хватает маны', def('crushing-swing'), calm, manaBlock), specimen('Ход врага', def('fireball'), calm, phaseBlock), specimen('Доступна (маг)', def('frostbolt'), calm)] },
  { name: 'Связка: неактивна → активна', items: [specimen('Условие не выполнено', def('frostbolt'), calm), specimen('Броня Джайны + Уязвим', def('frostbolt'), hot), specimen('Не активна', def('stance-strike'), calm), specimen('Броня Вариана', def('stance-strike'), hot)] },
  { name: 'Условный урон врага', items: [specimen('Враг не атакует', def('parry'), board(state => { state.enemy.nextAction = { kind: 'defend', name: 'Кора', armor: 3 } })), specimen('Враг атакует', def('parry'), calm), specimen('Перехват (атака)', def('covering-counter'), calm), specimen('Грозовой + связка', def('thunderbolt'), hot)] },
  { name: 'Улучшенные', items: [specimen('Удар мечом ↑', def('sword-strike', 1), calm), specimen('Огненный шар ↑', def('fireball', 1), calm), specimen('Каменный бастион ↑', def('bastion', 1), calm), specimen('Тайное предвидение ↑', def('arcane-insight', 1), calm)] },
  { name: 'Статусы: Уязвимость, Кровотечение, Обморожение', items: [specimen('Удар щитом', def('shield-bash'), calm), specimen('Рассекающий удар', def('rend'), calm), specimen('Кровавая расплата (кровь 3)', def('reaping-blow'), frozen), specimen('Жар в венах (кровь 3)', def('boil-blood'), frozen)] },
  { name: 'Мороз и сталь (B2)', items: [specimen('Ледяная хватка', cardOf('frost-grip'), calm), specimen('Раскол льда', cardOf('ice-breaker'), calm), specimen('Раскол льда (мороз)', cardOf('ice-breaker'), frozen), specimen('Ледяная стрела ↑ + связка', def('frostbolt', 1), hot)] },
  { name: 'Дорогие и многословные', items: [specimen('Синяя печать', def('frost-seal'), calm), specimen('Кровавый резонанс', def('blood-resonance'), frozen), specimen('Ледяное эхо', def('ice-echo'), calm), specimen('Прикрыть союзника', def('interpose'), calm)] },
])
function cardOf(id: CardId): CardDefinition { return def(id) }

// ── deck / ops ───────────────────────────────────────────────────────────────
const upgradedIds = new Set<CardId>(['sword-strike', 'bastion', 'frostbolt', 'fireball'])
const deck: PersistentCard[] = [...honestDeck('armor8', true), 'rend', 'rend', 'thunderbolt', 'parry', 'ice-echo', 'quick-cut', 'crushing-swing'].map((id, index) => ({ instanceId: `lab-${index}`, definitionId: id as CardId, upgrade: 0 }))
for (const id of upgradedIds) { const copy = deck.find(item => item.definitionId === id && item.upgrade === 0); if (copy) copy.upgrade = 1 }
const mode = (props.query.get('mode') ?? 'upgrade') as 'upgrade' | 'remove' | 'replace'
const isEligible = (copy: PersistentCard) => mode === 'upgrade' ? canUpgradeCard(copy) : !copy.upgrade || mode === 'remove'
const gallery = groupCopies(deck, isEligible)
const selectedInstanceId = gallery.filter(group => group.eligible.length)[Number(props.query.get('sel') ?? 2)]?.eligible[0]?.instanceId ?? null
const replacementsFor = (copy: PersistentCard) => { const own = resolveCardDefinition(copy).className; return cards.filter(card => card.reward && card.className === own && card.id !== copy.definitionId).slice(0, 3) }

onMounted(() => { if (props.view === 'deck') setTimeout(() => (document.querySelector('.deck-open') as HTMLButtonElement | null)?.click(), 250) })
</script>

<template>
  <div v-if="view === 'sheet'" class="lab lab-sheet" :style="{ fontSize: em + 'px' }">
    <section v-for="group in byClass" :key="group.id" :style="classThemeStyle(group.id)">
      <h2>{{ classThemes[group.id].name }} · {{ group.cards.length }}</h2>
      <div class="lab-row">
        <figure v-for="card in group.cards" :key="card.id" :title="card.id">
          <SpellCard :card="card" :preview="neutralPreview(card)" />
          <CompactCard v-if="query.get('tiles') === '1'" class="lab-tile" :card="card" :preview="neutralPreview(card)" />
        </figure>
      </div>
    </section>
  </div>

  <div v-else-if="view === 'states'" class="lab lab-states" :style="{ fontSize: em + 'px' }">
    <section v-for="group in groups" :key="group.name">
      <h2>{{ group.name }}</h2>
      <div class="lab-row">
        <figure v-for="item in group.items" :key="item.title">
          <SpellCard :card="item.card" :preview="item.preview" :block="item.block" :hotkey="'1'" />
          <figcaption>{{ item.title }}</figcaption>
        </figure>
      </div>
    </section>
  </div>

  <div v-else-if="view === 'deck'" class="lab"><DeckViewer :deck="deck" /></div>

  <CardOperationDialog v-else :mode="mode" :deck="deck" :is-eligible="isEligible" :selected-instance-id="selectedInstanceId" :replacements-for="replacementsFor" />
</template>

<style scoped>
.lab{min-height:100vh;padding:1.2em 1.6em;background:radial-gradient(ellipse at 50% 20%,#4d6a5c,#203c3a 70%);color:var(--ink)}
.lab h2{margin:.6em 0 .5em;font:700 1.4em var(--font-display);color:var(--parch-1)}
.lab-row{display:flex;flex-wrap:wrap;gap:1.4em 1.6em;align-items:flex-start}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:.5em}
figcaption{max-width:12em;text-align:center;font:700 .8em var(--font-ui);color:var(--muted)}
.lab-tile{font-size:.9em}
</style>
