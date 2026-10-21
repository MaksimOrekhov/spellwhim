<script setup lang="ts">
// Three links, no settings screen: each one reloads the game under the chosen battle rules. The control is the standard game;
// the others are the EXPERIMENT "Honest Turn". Every set of rules keeps its own save slot.
import { rulesModeHref, rulesModes } from '../game/rulesMode'
import type { RulesModeId } from '../game/rulesMode'

defineProps<{ current: RulesModeId; seed?: number | null }>()
</script>

<template>
  <nav class="rules-switch" aria-label="Правила боя">
    <p>Правила боя <small>— у каждого набора свой поход и своё сохранение{{ seed != null ? '; переключение сохраняет зерно: та же карта' : '' }}</small></p>
    <div class="options">
      <a v-for="mode in rulesModes" :key="mode.id" class="option game-button" :class="{ 'is-current': mode.id === current }" :href="rulesModeHref(mode.id, seed ?? null)" :aria-current="mode.id === current ? 'true' : undefined">
        <strong>{{ mode.title }}</strong><small>{{ mode.note }}</small>
      </a>
    </div>
  </nav>
</template>

<style scoped>
.rules-switch{margin:var(--sp-3) 0}.rules-switch p{margin:0 0 var(--sp-2);font:var(--fw-semibold) var(--fs-md) var(--font-display)}.rules-switch p small{font:var(--fs-sm) var(--font-ui);opacity:.75}
.options{display:flex;flex-wrap:wrap;gap:var(--sp-2)}
.option{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px 16px;text-decoration:none;line-height:1.2;filter:saturate(.55) brightness(.85)}
.option strong{font-size:16px}.option small{font:var(--fs-xs) var(--font-ui);opacity:.85}
.option.is-current{filter:none;outline:2px solid var(--gold);outline-offset:2px;cursor:default}
</style>
