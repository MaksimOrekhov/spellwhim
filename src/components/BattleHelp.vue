<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useRules } from '../ui/rulesInfo'
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const rules = useRules()
</script>
<template>
  <button class="help-button" @click="dialog?.showModal()" aria-label="Как играть">? <span>Как играть</span></button>
  <dialog ref="dialog" class="help-dialog" @click="($event.target === dialog) && dialog?.close()">
    <h2>Один отряд. Общий ход.</h2><p>Вариан и Джайна действуют вместе: разыгрывайте карты обоих героев в любом порядке, пока хватает маны.</p>
    <dl><dt>Розыгрыш</dt><dd>Нажмите карту, чтобы сыграть её. Точно целиться не нужно.</dd><dt>Клавиатура</dt><dd>1–9 — карты слева направо. Enter — завершить ход. Escape — закрыть подсказку.</dd><dt>Уязвимость</dt><dd>Следующая наносящая урон карта получает +3 урона и снимает Уязвимость. Эффект сохраняется между ходами.</dd><dt>Заклинания Джайны</dt><dd>Ледяная стрела и Грозовой разряд наносят на 2 урона больше, если у Джайны есть броня.</dd></dl>
    <p>Защита всегда прикрывает героя под прицелом.</p>
    <p v-if="rules.discardsHand" class="experiment-rules"><b>Ход боя.</b> Каждый ход — новая рука из {{ rules.openingHand }} карт: несыгранные сгорают. Броня держится ровно до конца хода врага, потом исчезает у обоих героев. Мана — 4 каждый ход.</p>
    <dl v-if="rules.newThreats" class="experiment-rules"><dt>Бронебойный</dt><dd>Удар игнорирует часть брони: чтобы поглотить его целиком, нужно больше брони, чем его урон.</dd><dt>Срыв</dt><dd>Если за ход нанести врагу указанный урон, удар отменяется целиком. Прогресс виден в значке «срыв».</dd><dt>Метка</dt><dd>Удар, переживший героя, делает его Уязвимым: следующий удар по нему сильнее на 3.</dd><dt>Ярость</dt><dd>Каждое следующее объявленное действие врага бьёт сильнее. Уже объявленное не меняется.</dd></dl>
    <dl v-if="rules.frost" class="experiment-rules"><dt>Обморожение</dt><dd>«Ледяная хватка» Джайны ослабляет следующую атаку врага на 30% (минимум 2) по каждой цели. «Раскол льда» Вариана тратит Обморожение на усиленный удар: враг тогда бьёт в полную силу.</dd></dl><button class="game-button" @click="dialog?.close()">Понятно</button>
  </dialog>
</template>
<style scoped>
.help-button{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:25px;padding:8px 13px;background:#213c39ba;color:#e5d8bc;font-weight:700}.help-button span{font-size:14px;font-weight:400}.help-dialog{max-width:min(540px,90vw);border:1px solid #d1ae70;border-radius:var(--shape-dialog);padding:28px 32px;background:linear-gradient(140deg,#354c45,#1e3537);color:var(--ink);box-shadow:0 24px 70px #08191fc9;font-size:16px;line-height:1.5}.help-dialog::backdrop{background:#102725a8;backdrop-filter:blur(5px)}.help-dialog h2{font:700 28px var(--display);margin:0}.help-dialog dl{display:grid;grid-template-columns:115px 1fr;gap:12px}.help-dialog dt{font-weight:700;color:#f0c887}.help-dialog dd{margin:0}.help-dialog .game-button{float:right;margin-top:5px}@media(max-height:700px){.help-dialog{font-size:14px;padding:22px}.help-dialog dl{gap:8px}.help-dialog h2{font-size:24px}}@media(max-width:1000px){.help-button span{display:none}}
</style>
