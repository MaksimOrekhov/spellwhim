<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
/** `final`: the fight was the sector's boss, so the next screen sums up the run instead of offering a reward. */
const props = defineProps<{ result: 'victory' | 'defeat'; continueLabel?: string; final?: boolean }>()
const emit = defineEmits<{ continue: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
onMounted(() => dialog.value?.showModal())
// A defeat ends the run: the button leads to its summary, where a new run can be started.
const text = computed(() => props.result === 'defeat'
  ? { kicker: 'Отряд пал', title: 'Поражение', body: 'Один из героев не выдержал удара, и поход окончен. Дальше — итоги похода.', button: 'К итогам похода' }
  : props.final
  ? { kicker: 'Сектор пройден', title: 'Победа!', body: 'Главный противник повержен. Осталось подвести итоги похода.', button: props.continueLabel ?? 'К итогам похода' }
  : { kicker: 'Путь открыт', title: 'Победа!', body: 'Противник повержен, штрек свободен. Пора двигаться дальше.', button: props.continueLabel ?? 'Продолжить' })
</script>
<template>
  <dialog ref="dialog" class="result-card" aria-labelledby="battle-result-title" @cancel.prevent>
    <span class="result-spark">{{ result === 'victory' ? '✦' : '◇' }}</span><p>{{ text.kicker }}</p><h1 id="battle-result-title">{{ text.title }}</h1><p>{{ text.body }}</p><button class="game-button" autofocus @click="emit('continue')">{{ text.button }}</button>
  </dialog>
</template>
<style scoped>
.result-card{width:min(470px,85%);padding:36px;text-align:center;border:1px solid #e7c086;border-radius:var(--shape-dialog);background:radial-gradient(ellipse at 50% 0,#657359,#284141 80%);box-shadow:0 25px 70px #0a2020a8;color:var(--ink)}.result-card::backdrop{background:#102a2b99;backdrop-filter:blur(7px)}.result-spark{font-size:44px;color:#ffe2a0}.result-card h1{font:700 44px var(--display);margin:10px 0;color:#ffeac2}.result-card p{font-size:16px;line-height:1.5;color:#e7e2ca}.result-card .game-button{margin-top:12px}
</style>
