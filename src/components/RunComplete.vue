<script setup lang="ts">
import { computed } from 'vue'
import type { DungeonRunState } from '../game/campaign'
import { dungeonNode } from '../game/campaign'
import DeckViewer from './DeckViewer.vue'
const props = defineProps<{ result: 'victory' | 'defeat'; run?: DungeonRunState }>()
const sector = computed(() => props.run?.status === 'sector-complete')
const rooms = computed(() => props.run?.visitedNodeIds.map(id=>dungeonNode(props.run!.map,id)!).filter(Boolean) ?? [])
const labels = { battle:'Обычный бой', elite:'Элитный бой', forge:'Кузница', treasure:'Сокровищница', event:'Событие', rest:'Привал', final:'Босс' }
const emit = defineEmits<{ restart: [] }>()
</script>

<template>
  <main class="run-complete">
    <section class="complete-card">
      <span>{{ result === 'victory' ? '✦' : '◇' }}</span>
      <small>МЁРТВЫЕ КОПИ</small>
      <h1>{{ sector ? 'Сектор I пройден — Старые штольни' : result === 'victory' ? 'Поход завершён' : 'Отряд пал' }}</h1>
      <p>{{ sector ? "Рак'Зор повержен. Продолжение Мёртвых копей появится в следующих секторах. Тестовый поход завершён." : result === 'victory' ? 'Вы прошли штреки и одолели Сумеречное сердце.' : 'Выберите другой путь и попробуйте пройти шахту снова.' }}</p>
      <div v-if="run" class="run-summary"><p>Вариан: {{ run.heroes.warrior.health }}/{{ run.heroes.warrior.maxHealth }} HP · Джайна: {{ run.heroes.mage.health }}/{{ run.heroes.mage.maxHealth }} HP</p><p>Карт: {{ run.deck.length }} · Обычные бои: {{ rooms.filter(n=>n.type==='battle').length }} · Элитные бои: {{ rooms.filter(n=>n.type==='elite').length }}</p><p>{{ rooms.map(n=>labels[n.type]).join(' → ') }}</p><ol v-if="run.journal?.length"><li v-for="(entry,i) in run.journal" :key="i">{{ entry.text }}</li></ol><DeckViewer :deck="run.deck" /></div>
      <button @click="emit('restart')">НАЧАТЬ НОВЫЙ ПОХОД</button>
    </section>
  </main>
</template>

<style scoped>
.run-complete{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:var(--sp-4);background:var(--mat-wood);color:var(--ink)}
.complete-card{width:min(480px,88vw);padding:38px 36px;text-align:center;border:1px solid #e3c487;border-radius:var(--shape-dialog);background:radial-gradient(ellipse at 50% 0,#7e8261,#2f4e45 72%);box-shadow:0 20px 65px #000b,inset 0 0 35px #d4b47420}
.complete-card>span{color:#ffe3a1;font-size:36px;text-shadow:0 0 20px #ffc968}
.complete-card small{display:block;margin-top:8px;color:#d8c397;font:700 14px var(--font-display);letter-spacing:.23em}
.complete-card h1{margin:12px 0;color:#ffedc4;font:700 clamp(30px,4vw,44px) var(--font-display)}
.complete-card p{color:#dfd1b4;font:500 17px/1.6 var(--font-ui)}
.complete-card button{margin-top:18px;padding:12px 20px;border:1px solid #f0d397;border-radius:var(--shape-plank);background:linear-gradient(#d49b54,#98572e);color:#fff0ce;font:700 16px var(--font-display);letter-spacing:.12em;cursor:pointer}
.complete-card{width:min(840px,94vw);max-height:94vh;overflow:auto;padding:var(--sp-5);background:var(--mat-quiet);border:var(--border-brass);box-shadow:var(--shadow-4)}.run-summary p{font-size:var(--fs-sm);margin:var(--sp-2) 0}.run-summary ol{text-align:left;font:600 var(--fs-sm)/var(--lh-body) var(--font-ui);max-height:180px;overflow:auto}
</style>
