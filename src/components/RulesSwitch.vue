<script setup lang="ts">
// Three links, no settings screen: each one reloads the game under the chosen battle rules. The control is the standard game;
// the others are the EXPERIMENT "Honest Turn". Every set of rules keeps its own save slot.
import { computed } from 'vue'
import { deckVariantIds } from '../game/honestDecks'
import type { DeckVariantId } from '../game/honestDecks'
import { rulesModeHref, rulesModes } from '../game/rulesMode'
import type { RulesModeId } from '../game/rulesMode'

const props = defineProps<{ current: RulesModeId; seed?: number | null; deck?: DeckVariantId | null }>()
// B1 and B2 can start from a deck with 10, 8 or 6 armor cards: another link on the same rules, same map.
const withDeck = computed(() => props.deck != null)
const deckLabels: Record<DeckVariantId, string> = { armor10: 'броня 10 (как в игре)', armor8: 'броня 8', armor6: 'броня 6' }
</script>

<template>
  <nav class="rules-switch" aria-label="Правила боя">
    <p>Правила боя <small>— у каждого набора свой поход и своё сохранение{{ seed != null ? '; переключение сохраняет зерно: та же карта' : '' }}</small></p>
    <div class="options">
      <a v-for="mode in rulesModes" :key="mode.id" class="option game-button" :class="{ 'is-current': mode.id === current }" :href="rulesModeHref(mode.id, seed ?? null)" :aria-current="mode.id === current ? 'true' : undefined">
        <strong>{{ mode.title }}</strong><small>{{ mode.note }}</small>
      </a>
    </div>
    <template v-if="withDeck">
      <p class="deck-title">Стартовая колода нового похода <small>— сколько из 18 карт дают броню</small></p>
      <div class="options">
        <a v-for="variant in deckVariantIds" :key="variant" class="option game-button option--deck" :class="{ 'is-current': variant === deck }" :href="rulesModeHref(current, seed ?? null, variant)" :aria-current="variant === deck ? 'true' : undefined">
          <strong>{{ deckLabels[variant] }}</strong>
        </a>
      </div>
    </template>
  </nav>
</template>

<style scoped>
.rules-switch{margin:var(--sp-3) 0}.rules-switch p{margin:0 0 var(--sp-2);font:var(--fw-semibold) var(--fs-md) var(--font-display)}.rules-switch p small{font:var(--fs-sm) var(--font-ui);opacity:.75}
.options{display:flex;flex-wrap:wrap;gap:var(--sp-2)}
.option{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px 16px;text-decoration:none;line-height:1.2;filter:saturate(.55) brightness(.85)}
.option strong{font-size:16px}.option small{font:var(--fs-xs) var(--font-ui);opacity:.85}
.deck-title{margin:var(--sp-3) 0 var(--sp-2)!important;font:var(--fw-semibold) var(--fs-sm) var(--font-display)!important}.deck-title small{font:var(--fs-xs) var(--font-ui);opacity:.75}.option--deck{padding:5px 12px}.option--deck strong{font-size:14px}
.option.is-current{filter:none;outline:2px solid var(--gold);outline-offset:2px;cursor:default}
</style>
