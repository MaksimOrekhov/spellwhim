<script setup lang="ts">
// The reward of a sector boss (Sector Transition v1, GDD §6/§15): two tracks the player decides independently, then the camp mends the heroes.
//   · the gold card: add it to the deck, trade one of your own for it, or leave it;
//   · the development: one artifact from two (to a hero, replacing what the hero carries) or one upgrade, or neither.
// The screen only collects choices and emits them; the rules and the transaction are `claimBossCard` / `claimBossDevelopment`.
import { computed, nextTick, ref } from 'vue'
import { ArrowBigUpDash, Bell, Check, Crosshair, Flame, Gauge, Gem, Link2, Shield, Star } from '@lucide/vue'
import SpellCard from './SpellCard.vue'
import CardNotes from './CardNotes.vue'
import CardOperationDialog from './CardOperationDialog.vue'
import DeckViewer from './DeckViewer.vue'
import { neutralPreview } from '../ui/cardDisplay'
import { cardChoiceText, developmentChoiceText } from '../ui/bossRewardDisplay'
import { artifactDefinition } from '../game/artifacts'
import { bossHeal, bossRewardRules } from '../game/adventure'
import type { BossReward } from '../game/adventure'
import type { BossCardCommand, BossDevelopmentCommand } from '../game/bossReward'
import { canUpgradeCard } from '../game/cardProgression'
import { cardDefinition } from '../game/types'
import type { ArtifactDefinition, ArtifactId, ArtifactInstance, CardDefinition, CardId, Hero, HeroId, PersistentCard } from '../game/types'

const props = defineProps<{ reward: BossReward; bossName: string; deck: readonly PersistentCard[]; heroes: Record<HeroId, Hero>; ownedArtifacts: readonly ArtifactInstance[] }>()
const emit = defineEmits<{ claimCard: [offerId: string, command: BossCardCommand]; claimDevelopment: [offerId: string, command: BossDevelopmentCommand] }>()

const goldCards = computed(() => props.reward.cards.map(card => { const definition = cardDefinition(card.definitionId); return { card: definition, preview: neutralPreview(definition) } }))
const artifacts = computed<ArtifactDefinition[]>(() => props.reward.artifactIds.map(artifactDefinition))
const heroList = computed(() => [props.heroes.warrior, props.heroes.mage])
const pickedId = ref<CardId | null>(null)
const picked = computed<CardDefinition | null>(() => goldCards.value.find(item => item.card.id === pickedId.value)?.card ?? null)
const dialog = ref<'replace' | 'upgrade' | null>(null)
const section = ref<'artifact' | 'upgrade'>('artifact')
const artifactId = ref<ArtifactId | null>(null)
const ownerId = ref<string | null>(null)

const selectedArtifact = computed(() => artifacts.value.find(item => item.id === artifactId.value) ?? null)
const owner = computed(() => heroList.value.find(hero => hero.instanceId === ownerId.value) ?? null)
const carried = (hero: Hero) => props.ownedArtifacts.find(item => item.ownerInstanceId === hero.instanceId)
const displaced = computed(() => owner.value ? carried(owner.value) : undefined)
const canUpgrade = computed(() => props.deck.some(canUpgradeCard))
const heal = computed(() => bossHeal(props.heroes))
const healLine = (hero: Hero) => `${hero.name}: ${hero.health} → ${hero.health + heal.value[hero.id]} HP`

/** The dialog has exactly one new card to offer, so choosing the card to give up also confirms the newcomer: the dialog clears its pick on every selection, and this puts it back. */
const dialogPick = ref<CardId | null>(null)
function openReplace() { dialogPick.value = picked.value?.id ?? null; dialog.value = 'replace' }
async function keepPick() { const id = picked.value?.id ?? null; dialogPick.value = null; await nextTick(); dialogPick.value = id }
function pickCard(id: CardId) { pickedId.value = pickedId.value === id ? null : id }
function takeCard() { if (picked.value) emit('claimCard', props.reward.id, { kind: 'take', cardId: picked.value.id }) }
function replaceCard(choice: { instanceId: string; cardId?: string }) { dialog.value = null; if (picked.value) emit('claimCard', props.reward.id, { kind: 'replace', cardId: picked.value.id, instanceId: choice.instanceId }) }
function selectArtifact(id: ArtifactId) { artifactId.value = id; ownerId.value = null }
function takeArtifact() { if (selectedArtifact.value && owner.value) emit('claimDevelopment', props.reward.id, { kind: 'artifact', artifactId: selectedArtifact.value.id, ownerInstanceId: owner.value.instanceId, ...(displaced.value ? { replaceInstanceId: displaced.value.instanceId } : {}) }) }
function upgradeCard(choice: { instanceId: string }) { dialog.value = null; emit('claimDevelopment', props.reward.id, { kind: 'upgrade', instanceId: choice.instanceId }) }

const iconFor = (artifact: ArtifactDefinition) => ({ shield: Shield, link: Link2, crosshair: Crosshair, bell: Bell, gauge: Gauge })[artifact.icon]
const cardSummary = computed(() => props.reward.cardChoice ? cardChoiceText(props.reward.cardChoice) : '')
const developmentSummary = computed(() => props.reward.developmentChoice ? developmentChoiceText(props.reward.developmentChoice, props.heroes) : '')
</script>

<template>
  <main class="boss-reward" aria-labelledby="boss-reward-title">
    <div class="boss-content">
      <header class="boss-heading">
        <span class="boss-spark" aria-hidden="true"><Star :size="30" :stroke-width="1.8" /></span>
        <p class="boss-kicker">НАГРАДА БОССА · {{ bossName.toUpperCase() }}</p>
        <h1 id="boss-reward-title">Трофеи побеждённого босса</h1>
        <p class="boss-copy">Два независимых выбора: золотая карта и развитие отряда. От любого можно отказаться. Когда оба решены, отряд передохнёт у выхода из сектора.</p>
      </header>

      <div class="boss-tracks">
        <section class="track track--gold" aria-labelledby="track-gold" :class="{ 'is-closed': reward.cardChoice }">
          <h2 id="track-gold"><Star :size="20" aria-hidden="true" /> Золотая карта</h2>
          <template v-if="reward.cardChoice">
            <p class="track-done" role="status"><Check :size="22" aria-hidden="true" />{{ cardSummary }}</p>
          </template>
          <template v-else>
            <p class="track-hint">Одна из {{ goldCards.length }}. Золотая карта уникальна: в колоде может быть только одна такая, а сыграть её можно один раз за бой.</p>
            <div v-if="goldCards.length" class="gold-offer" :style="{ '--n': goldCards.length }" role="group" aria-label="Золотые карты на выбор">
              <button v-for="{ card, preview } in goldCards" :key="card.id" class="gold-option" :class="{ 'is-picked': pickedId === card.id }" :data-card-id="card.id" :aria-pressed="pickedId === card.id" :aria-label="'Золотая карта: ' + card.name + '. ' + card.description" @click="pickCard(card.id)">
                <SpellCard :card="card" :preview="preview" />
                <CardNotes class="gold-notes" :card="card" :preview="preview" mode="inspect" />
              </button>
            </div>
            <p v-else class="track-hint">Все золотые карты уже в вашей колоде: предложить нечего.</p>
            <div class="track-actions">
              <button class="game-button" :disabled="!picked" @click="takeCard">Добавить в колоду</button>
              <button class="game-button" :disabled="!picked" @click="openReplace">Заменить свою карту…</button>
              <button class="game-button game-button--quiet" @click="emit('claimCard', reward.id, { kind: 'skip' })">{{ goldCards.length ? 'Не брать золото' : 'Дальше' }}</button>
            </div>
            <p class="track-note" aria-live="polite">{{ picked ? `Выбрано: «${picked.name}». Карт в колоде: ${deck.length}; добавление — ${deck.length + 1}, замена — столько же.` : goldCards.length ? 'Выберите карту, чтобы добавить её или обменять на свою.' : '' }}</p>
          </template>
        </section>

        <section class="track track--development" aria-labelledby="track-development" :class="{ 'is-closed': reward.developmentChoice }">
          <h2 id="track-development"><Gem :size="20" aria-hidden="true" /> Развитие отряда</h2>
          <template v-if="reward.developmentChoice">
            <p class="track-done" role="status"><Check :size="22" aria-hidden="true" />{{ developmentSummary }}</p>
          </template>
          <template v-else>
            <p class="track-hint">Один личный артефакт из {{ artifacts.length }} или одно улучшение карты. Не оба сразу.</p>
            <div class="track-tabs" role="tablist" aria-label="Виды развития">
              <button role="tab" :aria-selected="section === 'artifact'" @click="section = 'artifact'">Артефакт · {{ artifacts.length }}</button>
              <button role="tab" :aria-selected="section === 'upgrade'" @click="section = 'upgrade'">Улучшить карту</button>
            </div>

            <div v-if="section === 'artifact'" class="artifact-panel">
              <p v-if="!artifacts.length" class="track-hint">Все артефакты уже у отряда.</p>
              <div v-else class="artifact-options" role="group" aria-label="Артефакты на выбор">
                <button v-for="artifact in artifacts" :key="artifact.id" class="artifact-option" :class="{ 'is-selected': artifactId === artifact.id }" :aria-pressed="artifactId === artifact.id" @click="selectArtifact(artifact.id)">
                  <component :is="iconFor(artifact)" :size="26" :stroke-width="2" aria-hidden="true" />
                  <strong>{{ artifact.name }}</strong>
                  <span>{{ artifact.description }}</span>
                </button>
              </div>
              <div v-if="selectedArtifact" class="owner-choice" aria-live="polite">
                <p>Кому отдать «{{ selectedArtifact.name }}»?</p>
                <div class="owner-options">
                  <button v-for="hero in heroList" :key="hero.instanceId" class="owner-option" :class="{ 'is-selected': ownerId === hero.instanceId }" :aria-pressed="ownerId === hero.instanceId" @click="ownerId = hero.instanceId">
                    <strong>{{ hero.name }}</strong>
                    <span v-if="carried(hero)">Заменить: {{ artifactDefinition(carried(hero)!.definitionId).name }}</span>
                    <span v-else>Слот свободен</span>
                  </button>
                </div>
                <p v-if="displaced" class="track-note">У героя сейчас «{{ artifactDefinition(displaced.definitionId).name }}». Подтверждение заменит его на новый.</p>
                <button class="game-button" :disabled="!owner" @click="takeArtifact">{{ displaced ? 'Заменить и взять артефакт' : 'Взять артефакт' }}</button>
              </div>
            </div>

            <div v-else class="upgrade-panel">
              <p class="track-hint">Одна обычная карта станет улучшенной: цена маны прежняя. Покажем, что изменится, до подтверждения.</p>
              <button class="game-button" :disabled="!canUpgrade" @click="dialog = 'upgrade'"><ArrowBigUpDash :size="18" aria-hidden="true" /> Выбрать карту</button>
              <p v-if="!canUpgrade" class="track-note">Улучшать нечего: все обычные карты уже улучшены.</p>
            </div>

            <div class="track-actions">
              <button class="game-button game-button--quiet" @click="emit('claimDevelopment', reward.id, { kind: 'skip' })">Отказаться от развития</button>
            </div>
          </template>
        </section>
      </div>

      <footer class="boss-foot">
        <p class="camp" aria-label="Привал у выхода"><Flame :size="20" aria-hidden="true" /><span>Привал у выхода: до +{{ bossRewardRules.healEach }} HP каждому, не выше максимума.</span><b>{{ healLine(heroes.warrior) }}</b><b>{{ healLine(heroes.mage) }}</b></p>
        <DeckViewer :deck="deck" />
      </footer>
    </div>

    <CardOperationDialog v-if="dialog === 'replace' && picked" mode="replace" :deck="deck" :is-eligible="() => true" :replacements-for="() => [picked!]" :selected-card-id="dialogPick" :explanation="`Выберите карту, которая уйдёт из колоды: на её место встанет золотая «${picked.name}». Улучшение ушедшей карты не сохраняется.`" confirm-label="Обменять на золотую" @select="keepPick" @confirm="replaceCard" @close="dialog = null" />
    <CardOperationDialog v-else-if="dialog === 'upgrade'" mode="upgrade" :deck="deck" :is-eligible="canUpgradeCard" explanation="Награда босса вместо артефакта. Выберите карту и сравните версии: что изменится, выделено." @confirm="upgradeCard" @close="dialog = null" />
  </main>
</template>

<style scoped>
.boss-reward{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:clamp(10px,2.4vh,26px) clamp(14px,3vw,48px);background:radial-gradient(ellipse at 50% 18%,#8a7a52,#3b5a4e 58%,#1f3a39);color:var(--ink)}
.boss-content{width:min(1840px,100%);text-align:center}
.boss-heading{margin-bottom:var(--sp-2)}
.boss-spark{display:none;color:var(--gold)}
.boss-kicker{margin:0;color:var(--gold);font:800 var(--fs-xs) var(--font-display);letter-spacing:var(--ls-caps)}
h1{margin:0;color:var(--parch-1);font:700 clamp(24px,2.4vw,40px)/var(--lh-tight) var(--font-display);text-shadow:0 2px 0 #000a,0 0 28px #ffd56b55}
.boss-copy{max-width:960px;margin:2px auto 0;color:var(--muted);font:600 var(--fs-sm)/var(--lh-body) var(--font-ui)}
.boss-tracks{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:var(--sp-4);align-items:start;text-align:left}
.track{display:grid;gap:var(--sp-2);align-content:start;padding:var(--sp-2) var(--sp-4) var(--sp-3);border:var(--border-panel);border-radius:var(--shape-dialog);background:var(--mat-teal-panel);box-shadow:var(--shadow-3)}
.track--gold{border-color:var(--brass-1);box-shadow:var(--shadow-3),0 0 40px #ffd56b22}
.track.is-closed{opacity:.92}
h2{display:flex;align-items:center;gap:var(--sp-2);margin:0;color:var(--brass-1);font:700 var(--fs-lg) var(--font-display);letter-spacing:.04em}
.track-hint,.track-note{margin:0;color:var(--muted);font:600 var(--fs-sm)/var(--lh-body) var(--font-ui)}
.track-note{color:var(--gold)}.track-note:empty{display:none}
.track-done{display:flex;align-items:center;gap:var(--sp-2);margin:0;padding:var(--sp-3);border-radius:var(--shape-chip);background:#0004;color:var(--parch-1);font:700 var(--fs-md)/var(--lh-body) var(--font-ui)}
.track-done svg{flex:none;color:var(--c-heal)}
.track-actions{display:flex;flex-wrap:wrap;gap:var(--sp-2)}
.game-button svg{vertical-align:-3px;margin-right:6px}
/* One card scale for the three gold cards: limited by the viewport height (header, card, notes, buttons, footer) and by the width of the wider column. */
.gold-offer{--em:min(calc((100vh - 500px) / 40),calc((min(100vw,1840px) * .6 - 9rem - (var(--n) - 1) * 1.2rem) / (12.4 * var(--n))),26px);display:flex;justify-content:center;align-items:flex-start;gap:clamp(8px,1.2vw,20px);font-size:max(var(--em),10px)}
.gold-option{display:flex;flex-direction:column;align-items:center;gap:.7em;width:12.4em;padding:.35em;border:2px solid transparent;border-radius:2em;background:none;font-size:inherit;color:inherit;cursor:pointer;transition:transform var(--dur-base) var(--ease-out)}
.gold-option:hover,.gold-option:focus-visible{transform:translateY(-.4em)}
.gold-option:focus-visible{outline:var(--focus-ring);outline-offset:.2em}
.gold-option.is-picked{border-color:var(--c-bonus);background:color-mix(in srgb,var(--c-bonus) 12%,transparent);box-shadow:var(--glow-bonus)}
.gold-notes{font-size:.8em;pointer-events:none}
.track-tabs{display:flex;gap:var(--sp-2)}
.track-tabs button,.owner-option{border:var(--border-soft);border-radius:var(--shape-plank);background:var(--mat-quiet);color:var(--ink);font:800 var(--fs-sm) var(--font-ui);cursor:pointer}
.track-tabs button{min-height:38px;padding:6px 16px}
.track-tabs button[aria-selected=true]{border-color:var(--brass-1);background:var(--mat-brass);color:var(--parch-ink)}
.artifact-options{display:grid;gap:var(--sp-2)}
.artifact-option{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:var(--sp-3);align-items:center;padding:var(--sp-2) var(--sp-3);border:var(--border-soft);border-radius:var(--shape-banner);background:var(--mat-quiet);color:var(--ink);text-align:left;font:500 var(--fs-sm)/var(--lh-body) var(--font-ui);cursor:pointer}
.artifact-option svg{grid-row:span 2;color:var(--gold)}
.artifact-option strong{font:800 var(--fs-md) var(--font-display);color:var(--parch-1)}
.artifact-option.is-selected,.owner-option.is-selected{border-color:var(--brass-1);box-shadow:var(--glow-bonus);background:var(--mat-wood)}
.owner-choice{display:grid;gap:var(--sp-2);margin-top:var(--sp-2)}
.owner-choice>p:first-child{margin:0;color:var(--parch-1);font:800 var(--fs-md) var(--font-display)}
.owner-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-2)}
.owner-option{display:grid;gap:2px;min-height:50px;padding:6px 12px;text-align:left}
.owner-option span{color:var(--muted);font:600 var(--fs-xs) var(--font-ui)}
.upgrade-panel{display:grid;justify-items:start;gap:var(--sp-2)}
.artifact-option:focus-visible,.owner-option:focus-visible,.track-tabs button:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}
.boss-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--sp-3);margin-top:var(--sp-2)}
.camp{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2) var(--sp-3);margin:0;padding:var(--sp-2) var(--sp-4);border-radius:var(--shape-chip);background:#0004;color:var(--parch-1);font:600 var(--fs-sm) var(--font-ui)}
.camp svg{color:var(--c-heal)}
.camp b{font:700 var(--fs-sm) var(--font-num);color:var(--c-heal)}
@media(max-width:1100px){.boss-tracks{grid-template-columns:1fr}.gold-offer{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.gold-option{transition:none}.gold-option:hover,.gold-option:focus-visible{transform:none}}
</style>
