<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import varianPortrait from '../assets/art/varian-krea.webp'
import jainaPortrait from '../assets/art/jaina-krea.webp'

/**
 * The one start screen. It offers a saved run, a way back into the run being played, and a new run; there are no rules to choose.
 * A new run overwrites the save slot, so whenever something is in it (a run that can be continued, a finished one, a record that cannot be read
 * or the run being played now) the first click only asks, and the second confirms. An unreadable save can be copied out before that.
 */
const props = defineProps<{
  /** A run waiting in the save slot: `active` can be continued, `finished` only shows its result. */
  saved: { active: boolean } | null
  /** The menu was opened from a run in progress (the map, a result), which can be returned to. */
  canReturn: boolean
  /** The run that can be returned to is over (its summary was on screen): the way back leads to that summary. */
  finished?: boolean
  notice: string
  /** The slot holds a record that could not be read or is not compatible: it can be retried, copied, or knowingly overwritten by a new run. */
  unreadable: boolean
}>()
const emit = defineEmits<{ continue: []; return: []; newRun: []; download: []; retry: [] }>()
const confirming = ref(false)
const replaces = computed(() => props.canReturn || props.saved !== null || props.unreadable)
const warning = computed(() => props.unreadable
  ? 'Сохранение повреждено или не подходит этой версии игры. Новый поход перезапишет его, и вернуть старые данные будет нельзя. Сначала можно скачать копию.'
  : props.canReturn ? (props.finished ? 'Новый поход заменит завершённый.' : 'Новый поход заменит текущий.')
  : props.saved?.active ? 'Новый поход заменит сохранённый, который ещё можно продолжить.'
  : 'Новый поход заменит сохранённый завершённый поход.')
function startNew() {
  if (replaces.value && !confirming.value) { confirming.value = true; return }
  confirming.value = false
  emit('newRun')
}
// Whatever the slot holds has changed (another read, a run returned to): an old question is no longer the question.
watch([() => props.saved?.active ?? null, () => props.canReturn, () => props.unreadable], () => { confirming.value = false })
</script>

<template>
  <main class="main-menu">
    <section class="menu-panel">
      <div class="menu-heroes" aria-hidden="true"><img :src="varianPortrait" alt=""><img :src="jainaPortrait" alt=""></div>
      <h1>Spellwhim</h1>
      <h2>Мёртвые копи</h2>
      <p class="menu-story">Вариан и Джайна спускаются в Старые штольни: подрывники, механики и Рак'Зор в конце длинного пути. Стройте колоду вдвоём, выбирайте штреки и прикрывайте друг друга от ударов.</p>
      <p v-if="saved?.active" class="menu-note">Отряд ждёт у последней комнаты. Прерванный бой начнётся заново с тем же здоровьем и колодой.</p>
      <p v-else-if="saved" class="menu-note">Сохранённый поход завершён.</p>
      <p v-if="notice" class="menu-note" role="status">{{ notice }}</p>
      <div class="menu-actions">
        <button v-if="canReturn" class="game-button" @click="emit('return')">{{ finished ? 'Вернуться к итогам похода' : 'Вернуться в поход' }}</button>
        <button v-else-if="saved" class="game-button" @click="emit('continue')">{{ saved.active ? 'Продолжить поход' : 'Посмотреть итог' }}</button>
        <button v-if="unreadable" class="game-button" @click="emit('retry')">Повторить загрузку</button>
        <button class="game-button" :class="{ 'is-warning': confirming }" @click="startNew">{{ confirming ? (unreadable ? 'Да, перезаписать сохранение' : 'Да, начать новый поход') : 'Новый поход' }}</button>
        <button v-if="confirming" class="game-button" @click="confirming = false">Отмена</button>
        <button v-if="saved || unreadable" class="game-button" @click="emit('download')">Скачать копию</button>
      </div>
      <p v-if="confirming" class="menu-note" role="alert">{{ warning }}</p>
    </section>
  </main>
</template>

<style scoped>
.main-menu{position:absolute;inset:0;display:grid;place-items:center;padding:var(--sp-4);overflow:auto;background:radial-gradient(ellipse at 50% 38%,#f0a64a30,#0000 56%),var(--mat-mine-map);color:var(--ink)}
.menu-panel{width:min(clamp(560px,42vw,860px),100%);padding:clamp(18px,3.4vh,52px) clamp(20px,4vw,60px);border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-quiet);box-shadow:var(--shadow-4);text-align:center}
.menu-heroes{display:flex;justify-content:center;margin-bottom:var(--sp-2)}
.menu-heroes img{width:clamp(64px,12vh,132px);height:clamp(64px,12vh,132px);margin:0 -8px;border:3px solid var(--brass-2);border-radius:50%;object-fit:cover;box-shadow:var(--shadow-3),0 0 18px #ffd56b44}
.menu-panel h1{margin:0;font:700 clamp(36px,7vh,84px) var(--font-display);color:var(--parch-1);text-shadow:0 2px 0 #000a,0 0 22px #f0a64a55}
.menu-panel h2{margin:0 0 var(--sp-3);color:var(--brass-1);font:700 clamp(15px,1.9vh,24px) var(--font-display);letter-spacing:var(--ls-caps);text-transform:uppercase}
.menu-story,.menu-note{margin:var(--sp-2) 0;line-height:var(--lh-body);font:600 clamp(15px,1.9vh,22px) var(--font-ui)}
.menu-note{color:var(--brass-1);font-size:clamp(13px,1.6vh,18px)}
.menu-actions{display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);margin-top:var(--sp-4)}
.menu-actions .game-button{min-width:min(clamp(260px,22vw,380px),100%);font-size:clamp(16px,2vh,24px)}
.menu-actions .game-button.is-warning{filter:hue-rotate(-18deg) saturate(1.2)}
@media(max-height:620px){.menu-heroes{display:none}.menu-story{font-size:var(--fs-sm)}.menu-actions{margin-top:var(--sp-3)}}
</style>
