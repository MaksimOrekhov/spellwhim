<script setup lang="ts">
import type { EncounterDefinition, Hero } from '../game/types'

defineProps<{ encounters: EncounterDefinition[]; activeIndex: number; heroes: Record<'warrior' | 'mage', Hero> }>()
const emit = defineEmits<{ enter: [index: number] }>()
</script>

<template>
  <main class="campaign-screen">
    <header class="campaign-header">
      <span class="campaign-mark">✦</span>
      <p>ГЛАВА I · ЗАБЫТАЯ РОЩА</p>
      <h1>Путь через чащу</h1>
      <span class="campaign-subtitle">Выберите следующий шаг своего похода</span>
    </header>

    <section class="route-map" aria-label="Маршрут похода">
      <div class="route-line"></div>
      <button v-for="(encounter, index) in encounters" :key="encounter.id" class="route-node" :class="{ 'is-complete': index < activeIndex, 'is-current': index === activeIndex, 'is-locked': index > activeIndex }" :disabled="index !== activeIndex" @click="emit('enter', index)">
        <span class="node-glyph">{{ index === encounters.length - 1 ? '✹' : index < activeIndex ? '✓' : '⚔' }}</span>
        <span class="node-copy"><small>{{ index === encounters.length - 1 ? 'ФИНАЛЬНЫЙ БОЙ' : `СТОЛКНОВЕНИЕ ${index + 1}` }}</small><strong>{{ encounter.mapLabel }}</strong><em>{{ encounter.name }} · {{ encounter.maxHealth }} здоровья</em></span>
        <span class="node-arrow">{{ index < activeIndex ? 'ПРОЙДЕНО' : index === activeIndex ? 'ВСТУПИТЬ В БОЙ →' : 'ЗАКРЫТО' }}</span>
      </button>
    </section>

    <footer class="party-status">
      <span>ОТРЯД ПУТНИКОВ</span>
      <strong>Бранн {{ heroes.warrior.health }}/{{ heroes.warrior.maxHealth }}</strong>
      <i>✦</i>
      <strong>Лира {{ heroes.mage.health }}/{{ heroes.mage.maxHealth }}</strong>
    </footer>
  </main>
</template>

<style scoped>
.campaign-screen{position:absolute;z-index:8;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:auto;padding:5vh 8vw;background:radial-gradient(ellipse at 50% 30%,#6c8566,#355750 62%,#203e3b);color:#fff1d1}

.campaign-header,.route-map,.party-status{position:relative;z-index:1}
.campaign-header{text-align:center;margin-bottom:4vh}
.campaign-mark{display:block;color:#ffe4a4;font-size:28px;text-shadow:0 0 20px #ffc56a}
.campaign-header p{margin:7px 0;color:#d7bd8c;font:700 clamp(11px,1.2vw,14px) var(--display);letter-spacing:.2em}
.campaign-header h1{margin:0;color:#fff0c9;font:700 clamp(32px,4vw,48px) var(--display);text-shadow:0 4px 14px #0008}
.campaign-subtitle{display:block;margin-top:9px;color:#eee1c9;font:500 clamp(15px,1.45vw,18px) 'Trebuchet MS',Arial,sans-serif}
.route-map{display:flex;flex-direction:column;gap:14px;width:min(850px,92vw)}
.route-line{position:absolute;top:40px;bottom:40px;left:33px;width:2px;background:linear-gradient(#f0c777,#8b7a5566,#8b7a5522)}
.route-node{position:relative;display:flex;align-items:center;gap:18px;min-height:96px;padding:15px 22px;border:1px solid #d9bf8850;border-radius:6px;background:linear-gradient(100deg,#213c39ef,#36504aef);color:#fff1d1;text-align:left;box-shadow:0 5px 18px #0004;transition:transform .2s,border-color .2s,background .2s}
.route-node:not(:disabled){cursor:pointer}
.route-node:not(:disabled):hover{transform:translateX(5px);border-color:#ffe1a5;background:linear-gradient(100deg,#385548,#52654f);box-shadow:0 0 24px #f3c66b30}
.route-node.is-current{border-color:#f1ca7a;box-shadow:0 0 0 1px #f1ca7a2c,0 0 25px #f1ca7a20}
.route-node.is-complete{border-color:#9bb89a6b;background:linear-gradient(100deg,#1e2b2d,#29393a);color:#d7e1ca}
.route-node.is-locked{opacity:.48;filter:saturate(.6)}
.node-glyph{z-index:1;display:grid;place-items:center;flex:0 0 50px;height:50px;border:1px solid #e6c987;border-radius:50%;background:#292a38;color:#ffe5a6;font:700 21px var(--display);text-shadow:0 0 10px #ffc960}
.is-complete .node-glyph{border-color:#acd2ac;color:#cce8c0;text-shadow:none}
.is-locked .node-glyph{border-color:#c5b38c6e;color:#b4a78d;text-shadow:none}
.node-copy{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}
.node-copy small{color:#f0d89f;font:700 clamp(10px,1vw,12px) var(--display);letter-spacing:.14em}
.node-copy strong{overflow:hidden;color:#fff0ca;font:700 clamp(18px,2vw,22px) var(--display);text-overflow:ellipsis;white-space:nowrap}
.node-copy em{color:#e0d4c0;font:500 clamp(13px,1.3vw,15px) 'Trebuchet MS',Arial,sans-serif;font-style:normal}
.node-arrow{color:#ffe1a5;font:700 clamp(10px,1.05vw,12px) var(--display);letter-spacing:.07em;white-space:nowrap}
.is-locked .node-arrow{color:#ad9d7c}
.party-status{display:flex;align-items:center;gap:16px;margin-top:4vh;padding:12px 20px;border:1px solid #d9bf8847;border-radius:5px;background:#233d38d4;color:#fff0d0;font:600 clamp(13px,1.25vw,15px) 'Trebuchet MS',Arial,sans-serif}
.party-status span{color:#e1c98f;font:700 clamp(10px,1vw,12px) var(--display);letter-spacing:.1em}
.party-status i{color:#e0c88d;font-size:14px;font-style:normal}
@media(max-width:650px){.campaign-screen{padding:3vh 3vw}.campaign-header{margin-bottom:3vh}.campaign-header h1{font-size:clamp(28px,8vw,38px)}.campaign-subtitle{font-size:14px}.route-map{width:94vw;gap:10px}.route-node{gap:9px;min-height:84px;padding:9px}.node-glyph{flex-basis:36px;height:36px;font-size:17px}.node-copy{gap:3px}.node-copy small{font-size:9px}.node-copy strong{font-size:clamp(14px,4vw,18px)}.node-copy em{font-size:11px}.node-arrow{max-width:88px;font-size:8px;text-align:right;white-space:normal}.party-status{gap:7px;margin-top:3vh;padding:9px;font-size:11px}.party-status span{font-size:8px}}
</style>
