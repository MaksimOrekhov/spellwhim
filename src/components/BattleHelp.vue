<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useRules } from '../ui/rulesInfo'
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const rules = useRules()
</script>
<template>
  <button class="help-button" @click="dialog?.showModal()" aria-label="Как играть">? <span>Как играть</span></button>
  <!-- The heading takes focus on open, so a long help starts at its top instead of scrolling down to the button. -->
  <dialog ref="dialog" class="help-dialog" aria-labelledby="help-title" @click="($event.target === dialog) && dialog?.close()">
    <h2 id="help-title" tabindex="-1" autofocus>Один отряд. Общий ход.</h2><p>Вариан и Джайна действуют вместе: разыгрывайте карты обоих героев в любом порядке, пока хватает маны.</p>
    <dl>
      <dt>Розыгрыш</dt><dd>Нажмите карту, чтобы сыграть её: выбирать цель атаки не нужно. Если враг бьёт по обоим героям, карта с бронёй спросит, кого прикрыть.</dd>
      <dt>Клавиатура</dt><dd>1–9 и 0 — карты слева направо. Enter — завершить ход. Escape — закрыть подсказку или окно.</dd>
      <dt>Броня</dt><dd>Броня «цели» достаётся герою, которого атакует враг, «напарнику» — второму герою. {{ rules.armorExpires ? 'Броня исчезает, когда враг закончит свой ход, даже если по герою не били: защищайтесь в тот ход, когда враг действительно бьёт.' : 'Броня исчезает после атаки по герою.' }}</dd>
      <dt>Уязвимость</dt><dd>Следующая наносящая урон карта получает +3 урона и снимает Уязвимость. Эффект сохраняется между ходами.</dd>
      <dt>Заклинания Джайны</dt><dd>Ледяная стрела и Грозовой разряд наносят на 2 урона больше, если у Джайны есть броня.</dd>
    </dl>
    <p v-if="rules.discardsHand"><b>Ход боя.</b> Каждый ход — новая рука из {{ rules.openingHand }} карт; несыгранные карты уходят в сброс. Мана — {{ rules.mana }} каждый ход.</p>
    <dl v-if="rules.newThreats"><dt>Подготовка</dt><dd>Враг готовит удар: цель видна сразу, а сила и особенности — на следующем ходу, перед самым ударом.</dd><dt>Бронебойный</dt><dd>Удар игнорирует часть брони цели: чтобы поглотить его целиком, брони нужно больше на величину пробоя.</dd><dt>Срыв</dt><dd>Если за ход отнять у врага указанное количество здоровья, удар отменяется целиком. Урон по броне врага не в счёт. Прогресс виден в значке «срыв».</dd><dt>Метка</dt><dd>Если герой переживёт такой удар, он станет Уязвимым: следующий удар по нему сильнее на 3.</dd><dt>Ярость</dt><dd>Каждое следующее объявленное действие врага бьёт сильнее. Уже объявленное не меняется.</dd></dl>
    <dl v-if="rules.frost"><dt>Обморожение</dt><dd>«Ледяная хватка» Джайны ослабляет следующую атаку врага на 30% (минимум на 2) по каждой цели. «Раскол льда» Вариана тратит Обморожение на усиленный удар: враг тогда бьёт в полную силу.</dd></dl><button class="game-button" @click="dialog?.close()">Понятно</button>
  </dialog>
</template>
<style scoped>
.help-button{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:25px;padding:8px 13px;background:#213c39ba;color:#e5d8bc;font-weight:700}.help-button span{font-size:14px;font-weight:400}.help-dialog{max-width:min(680px,92vw);max-height:90vh;overflow:auto;border:1px solid #d1ae70;border-radius:var(--shape-dialog);padding:28px 32px;background:linear-gradient(140deg,#354c45,#1e3537);color:var(--ink);box-shadow:0 24px 70px #08191fc9;font-size:16px;line-height:1.5}.help-dialog::backdrop{background:#102725a8;backdrop-filter:blur(5px)}.help-dialog h2{font:700 28px var(--display);margin:0}.help-dialog dl{display:grid;grid-template-columns:115px 1fr;gap:12px}.help-dialog dt{font-weight:700;color:#f0c887}.help-dialog dd{margin:0}.help-dialog .game-button{float:right;margin-top:5px}@media(max-height:700px){.help-dialog{font-size:14px;padding:22px}.help-dialog dl{gap:8px}.help-dialog h2{font-size:24px}}@media(max-width:1000px){.help-button span{display:none}}
</style>
