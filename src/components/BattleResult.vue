<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
defineProps<{ result: 'victory' | 'defeat'; continueLabel?: string }>()
const emit = defineEmits<{ continue: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
onMounted(() => dialog.value?.showModal())
</script>
<template>
  <dialog ref="dialog" class="result-card" aria-labelledby="battle-result-title" @cancel.prevent>
    <span class="result-spark">{{ result === 'victory' ? '✦' : '◇' }}</span><p>{{ result === 'victory' ? 'Путь открыт' : 'Отряд пал' }}</p><h1 id="battle-result-title">{{ result === 'victory' ? 'Победа!' : 'Поражение' }}</h1><p>{{ result === 'victory' ? 'Чаща отступила. Пора двигаться дальше.' : 'Используйте Уязвимость и прикрывайте героя под прицелом.' }}</p><button class="game-button" autofocus @click="emit('continue')">{{ result === 'victory' ? continueLabel ?? 'Продолжить' : 'Начать заново' }}</button>
  </dialog>
</template>
<style scoped>
.result-card{width:min(470px,85%);padding:36px;text-align:center;border:1px solid #e7c086;border-radius:20px;background:radial-gradient(ellipse at 50% 0,#657359,#284141 80%);box-shadow:0 25px 70px #0a2020a8;color:var(--ink)}.result-card::backdrop{background:#102a2b99;backdrop-filter:blur(7px)}.result-spark{font-size:44px;color:#ffe2a0}.result-card h1{font:700 44px var(--display);margin:10px 0;color:#ffeac2}.result-card p{font-size:16px;line-height:1.5;color:#e7e2ca}.result-card .game-button{margin-top:12px}
</style>
