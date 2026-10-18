<script setup lang="ts">
defineProps<{ result: 'victory' | 'defeat' }>()
const emit = defineEmits<{ restart: [] }>()
</script>

<template>
  <main class="run-complete">
    <section class="complete-card">
      <span>{{ result === 'victory' ? '✦' : '◇' }}</span>
      <small>МЁРТВЫЕ КОПИ</small>
      <h1>{{ result === 'victory' ? 'Поход завершён' : 'Отряд пал' }}</h1>
      <p>{{ result === 'victory' ? 'Вы прошли штреки и одолели Сумеречное сердце.' : 'Выберите другой путь и попробуйте пройти шахту снова.' }}</p>
      <button @click="emit('restart')">НАЧАТЬ НОВЫЙ ПОХОД</button>
    </section>
  </main>
</template>

<style scoped>
.run-complete{position:absolute;z-index:8;inset:0;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,#758768,#35564e 62%,#203c3a);color:#fff0d0}
.complete-card{width:min(480px,88vw);padding:38px 36px;text-align:center;border:1px solid #e3c487;border-radius:18px;background:radial-gradient(ellipse at 50% 0,#7e8261,#2f4e45 72%);box-shadow:0 20px 65px #000b,inset 0 0 35px #d4b47420}
.complete-card>span{color:#ffe3a1;font-size:36px;text-shadow:0 0 20px #ffc968}
.complete-card small{display:block;margin-top:8px;color:#d8c397;font:700 14px Cinzel,Georgia,serif;letter-spacing:.23em}
.complete-card h1{margin:12px 0;color:#ffedc4;font:700 clamp(30px,4vw,44px) Cinzel,Georgia,serif}
.complete-card p{color:#dfd1b4;font:500 17px/1.6 Manrope,Arial,sans-serif}
.complete-card button{margin-top:18px;padding:12px 20px;border:1px solid #f0d397;border-radius:4px;background:linear-gradient(#d49b54,#98572e);color:#fff0ce;font:700 16px Cinzel,Georgia,serif;letter-spacing:.12em;cursor:pointer}
</style>
