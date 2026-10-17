<script setup lang="ts">
import { useTemplateRef } from 'vue'
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
</script>
<template>
  <button class="help-button" @click="dialog?.showModal()" aria-label="Как играть">? <span>Как играть</span></button>
  <dialog ref="dialog" class="help-dialog" @click="($event.target === dialog) && dialog?.close()">
    <h2>Один отряд. Общий ход.</h2><p>Бранн и Лира действуют вместе: разыгрывайте карты обоих героев в любом порядке, пока хватает маны.</p>
    <dl><dt>Розыгрыш</dt><dd>Нажмите карту или потяните её вверх. Точно целиться не нужно.</dd><dt>Клавиатура</dt><dd>1–9 — карты слева направо. Enter — завершить ход. Escape — закрыть подсказку.</dd><dt>Метка Лиры</dt><dd>Шар подготавливает удар Бранна: +3 урона и добор.</dd><dt>Резонанс Бранна</dt><dd>Защита подготавливает заклинание Лиры: +2 урона.</dd></dl>
    <p>Связки расходуются один раз и исчезают в конце хода. Защита всегда прикрывает героя под прицелом.</p><button class="game-button" @click="dialog?.close()">Понятно</button>
  </dialog>
</template>
<style scoped>
.help-button{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:25px;padding:8px 13px;background:#213c39ba;color:#e5d8bc;font-weight:700}.help-button span{font-size:14px;font-weight:400}.help-dialog{max-width:min(540px,90vw);border:1px solid #d1ae70;border-radius:16px;padding:28px 32px;background:linear-gradient(140deg,#354c45,#1e3537);color:var(--ink);box-shadow:0 24px 70px #08191fc9;font-size:16px;line-height:1.5}.help-dialog::backdrop{background:#102725a8;backdrop-filter:blur(5px)}.help-dialog h2{font:700 28px var(--display);margin:0}.help-dialog dl{display:grid;grid-template-columns:115px 1fr;gap:12px}.help-dialog dt{font-weight:700;color:#f0c887}.help-dialog dd{margin:0}.help-dialog .game-button{float:right;margin-top:5px}@media(max-height:700px){.help-dialog{font-size:14px;padding:22px}.help-dialog dl{gap:8px}.help-dialog h2{font-size:24px}}@media(max-width:1000px){.help-button span{display:none}}
</style>
