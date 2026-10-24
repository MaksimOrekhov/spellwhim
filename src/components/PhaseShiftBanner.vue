<script setup lang="ts">
// B1 enemy rules (the game since X04): the moment a boss with a phase note enters its second phase. A card in the middle of the scene says what
// changed and what comes next, and says plainly that the action already on the board is NOT changed: the engine keeps the announced
// intent and starts the new cycle only after it. It never blocks a click, fades by itself after a few seconds, can be closed, and the same
// words stay available all fight long in the tooltip of the "Фаза II" badge on the enemy.
import { computed, ref, watch } from 'vue'
import { Flame, X } from '@lucide/vue'
import type { EnemyState } from '../game/types'

const props = defineProps<{ enemy: EnemyState; turn: number; nextAction: string }>()
const closedFor = ref<number | null>(null)
const shiftTurn = computed(() => props.enemy.phase === 2 && props.enemy.phaseNote ? props.enemy.phaseShiftTurn ?? null : null)
// Only on the player turn in which the line was crossed: the next turn is already the new cycle, and the badge keeps the note.
const visible = computed(() => shiftTurn.value !== null && props.turn === shiftTurn.value && closedFor.value !== shiftTurn.value)
// A fight that starts over (another enemy, a new battle) forgets the old dismissal.
watch(() => props.enemy.encounterId, () => { closedFor.value = null })
</script>

<template>
  <Transition name="shift">
    <aside v-if="visible && enemy.phaseNote" class="phase-banner" role="status" aria-live="assertive" data-phase-banner>
      <span class="badge"><Flame :size="34" :stroke-width="2.3" aria-hidden="true" /></span>
      <div class="text">
        <strong>{{ enemy.phaseNote.title }}</strong>
        <p class="now">Это действие остаётся прежним: «{{ nextAction }}». Новый порядок начнётся после него.</p>
        <ul><li v-for="line in enemy.phaseNote.lines" :key="line">{{ line }}</li></ul>
      </div>
      <button class="close" aria-label="Скрыть сообщение" @click="closedFor = shiftTurn"><X :size="18" :stroke-width="2.6" aria-hidden="true" /></button>
    </aside>
  </Transition>
</template>

<style scoped>
.phase-banner{position:absolute;z-index:9;top:30%;left:50%;translate:-50% 0;width:min(560px,52vw);display:flex;gap:16px;align-items:flex-start;padding:16px 18px 16px 16px;border:3px solid #ff9a5a;border-radius:var(--shape-scroll);background:linear-gradient(145deg,#6a1d0ef7,#2c0c0af7);color:#ffe9d0;box-shadow:0 0 0 9999px #1a06048c,var(--shadow-4),0 0 46px #ff5a2d88;animation:phase-fade 1s 9s forwards}
.badge{display:grid;place-items:center;flex:none;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#ffc27a,#d8481a 60%,#5a1608);color:#2a0c06;box-shadow:var(--shadow-2),inset 0 0 8px #fff6}
.text{min-width:0}
.text strong{display:block;font:var(--fw-bold) clamp(20px,2.8vh,28px)/1.15 var(--font-display);color:#ffd9a8}
.now{margin:6px 0 8px;font:var(--fw-semibold) clamp(13px,1.8vh,16px)/1.35 var(--font-ui);color:#ffc9a0}
ul{margin:0;padding-left:1.1em;font:clamp(13px,1.8vh,16px)/1.4 var(--font-ui)}
li+li{margin-top:3px}
.close{flex:none;display:grid;place-items:center;width:32px;height:32px;padding:0;border:2px solid #ff9a5a;border-radius:50%;background:#1a0806;color:#ffd9a8}
.close:focus-visible{outline:var(--focus-ring);outline-offset:2px}
/* The scrim around the card is only a shadow, so nothing under it is blocked: the card itself ignores the pointer except for its close button. */
.phase-banner{pointer-events:none}.close{pointer-events:auto}
.shift-enter-active{animation:shift-in .6s var(--ease-out)}
.shift-leave-active{transition:opacity .3s,translate .3s}
.shift-leave-to{opacity:0;translate:-50% -12px}
@keyframes shift-in{0%{opacity:0;translate:-50% -30px;scale:.9}60%{scale:1.04}100%{opacity:1;translate:-50% 0;scale:1}}
@keyframes phase-fade{to{opacity:0;visibility:hidden}}
@media(max-height:700px){.phase-banner{top:22%;padding:10px 12px 10px 10px;width:min(520px,58vw)}.badge{width:44px;height:44px}ul{display:none}}
@media(prefers-reduced-motion:reduce){.shift-enter-active,.phase-banner{animation:none}}
</style>
