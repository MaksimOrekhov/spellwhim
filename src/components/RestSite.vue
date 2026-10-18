<script setup lang="ts">
import type { BattleState } from '../game/types'

const props = defineProps<{ heroes: BattleState['heroes']; healAmount: number }>()
const emit = defineEmits<{ choose: [heroId: 'warrior' | 'mage' | null] }>()

function amount(hero: BattleState['heroes']['warrior']) {
  return Math.min(props.healAmount, Math.max(0, hero.maxHealth - hero.health))
}
</script>

<template>
  <main class="rest-screen">
    <section class="rest-card">
      <span class="rest-fire" aria-hidden="true">♨</span>
      <small>ПРИВАЛ · МЁРТВЫЕ КОПИ</small>
      <h1>Передышка у фонаря</h1>
      <p>Распределите до {{ healAmount }} HP одному герою. Здоровье не может превысить максимум.</p>
      <div class="rest-heroes">
        <button class="rest-hero rest-hero--warrior" :disabled="amount(heroes.warrior) === 0" @click="emit('choose', 'warrior')">
          <span class="rest-portrait" aria-hidden="true">⚔</span>
          <span class="rest-name">Вариан Ринн</span>
          <strong>{{ heroes.warrior.health }} / {{ heroes.warrior.maxHealth }} HP</strong>
          <em>{{ amount(heroes.warrior) ? `+${amount(heroes.warrior)} HP` : 'Здоровье полное' }}</em>
          <span class="rest-action">ПЕРЕДЫШКА</span>
        </button>
        <button class="rest-hero rest-hero--mage" :disabled="amount(heroes.mage) === 0" @click="emit('choose', 'mage')">
          <span class="rest-portrait" aria-hidden="true">✦</span>
          <span class="rest-name">Джайна Праудмур</span>
          <strong>{{ heroes.mage.health }} / {{ heroes.mage.maxHealth }} HP</strong>
          <em>{{ amount(heroes.mage) ? `+${amount(heroes.mage)} HP` : 'Здоровье полное' }}</em>
          <span class="rest-action">ПЕРЕДЫШКА</span>
        </button>
      </div>
      <button v-if="amount(heroes.warrior) === 0 && amount(heroes.mage) === 0" class="skip-rest" @click="emit('choose', null)">Здоровье полное · продолжить путь</button>
    </section>
  </main>
</template>

<style scoped>
.rest-screen{position:absolute;z-index:9;inset:0;display:grid;place-items:center;overflow:auto;padding:22px;background:radial-gradient(ellipse at 50% 30%,#837551,#496454 58%,#203f3e);color:#fff0d1}
.rest-card{width:min(780px,94vw);padding:clamp(22px,4vw,42px);border:1px solid #e8c982;border-radius:18px;background:radial-gradient(ellipse at 50% 0,#655a40,#2c4944 72%);box-shadow:0 20px 60px #0c2425aa,inset 0 0 38px #e7bf6720;text-align:center}
.rest-fire{display:block;color:#ffc876;font-size:42px;text-shadow:0 0 18px #ff9b4c}
.rest-card>small{color:#e3c98e;font:700 11px var(--display);letter-spacing:.18em}
.rest-card h1{margin:7px 0;color:#fff0c8;font:700 clamp(28px,4vw,42px) var(--display)}
.rest-card>p{max-width:540px;margin:0 auto 22px;color:#e7ddc7;font:500 15px/1.5 'Trebuchet MS',Arial,sans-serif}
.rest-heroes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.rest-hero{display:flex;flex-direction:column;align-items:center;gap:7px;min-height:210px;padding:17px 14px;border:1px solid #d9bd7b88;border-radius:13px;background:linear-gradient(155deg,#4b4031,#273d3d 72%);color:#fff0d0;cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}
.rest-hero--mage{border-color:#b6a3d899;background:linear-gradient(155deg,#403b5c,#273d3d 72%)}
.rest-hero:not(:disabled):hover,.rest-hero:not(:disabled):focus-visible{transform:translateY(-4px);outline:none;border-color:#ffe09c;box-shadow:0 0 24px #ffd17055}
.rest-hero:disabled{opacity:.55;cursor:default}
.rest-portrait{display:grid;place-items:center;width:45px;height:45px;border:1px solid #dfc17d;border-radius:50%;background:#2b3434;color:#ffdf98;font-size:23px}
.rest-hero--mage .rest-portrait{border-color:#b6a3d8;color:#d7cbff}
.rest-name{font:700 18px var(--display);color:#fff0cf}
.rest-hero strong{font:700 15px 'Trebuchet MS',Arial,sans-serif}
.rest-hero em{color:#bfe2a2;font:800 15px var(--display);font-style:normal}
.rest-hero:disabled em{color:#d2c4a7}
.rest-action{margin-top:auto;padding:7px 13px;border:1px solid #dbbd7e;border-radius:5px;background:#3a4a3d;color:#ffe9b6;font:800 10px var(--display);letter-spacing:.12em}
.skip-rest{margin-top:18px;padding:10px 16px;border:1px solid #d7bf8d;border-radius:6px;background:#263f3b;color:#fff0d1;font-weight:700;cursor:pointer}
@media(max-width:560px){.rest-heroes{grid-template-columns:1fr;gap:10px}.rest-hero{min-height:168px}.rest-card>p{font-size:13px}}
</style>
