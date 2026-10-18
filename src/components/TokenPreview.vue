<script setup lang="ts">
// Dev-only gallery of design tokens (src/assets/tokens.css). Not part of the game; open /tokens-preview.html.
import { Crosshair, Flame, Heart, Shield, Swords } from '@lucide/vue'
import { classThemes } from '../game/classThemes'

const colours: { group: string; items: [string, string][] }[] = [
  { group: 'Текст', items: [['--ink', 'основной'], ['--muted', 'вторичный'], ['--text-dim', 'приглушённый'], ['--gold', 'акцент'], ['--parch-ink', 'на пергаменте']] },
  { group: 'Материалы', items: [['--wood-0', 'дерево 0'], ['--wood-1', 'дерево 1'], ['--wood-2', 'дерево 2'], ['--wood-3', 'дерево 3'], ['--brass-1', 'латунь 1'], ['--brass-2', 'латунь 2'], ['--brass-3', 'латунь 3'], ['--brass-4', 'латунь 4'], ['--parch-1', 'пергамент 1'], ['--parch-2', 'пергамент 2']] },
  { group: 'Сцена (текущая бирюзовая)', items: [['--scene-0', 'сцена 0'], ['--scene-1', 'сцена 1'], ['--scene-2', 'сцена 2'], ['--scene-3', 'сцена 3']] },
  { group: 'Игровая семантика', items: [['--c-mana', 'мана'], ['--c-mana-deep', 'мана (глубокая)'], ['--c-health', 'здоровье'], ['--c-health-deep', 'здоровье (глубокое)'], ['--c-armor', 'броня'], ['--c-armor-deep', 'броня (глубокая)'], ['--c-threat', 'угроза'], ['--c-bonus', 'бонус'], ['--c-vulnerable', 'Уязвимость'], ['--c-heal', 'лечение'], ['--c-focus', 'фокус']] },
]
const materials = ['--mat-brass', '--mat-brass-top', '--mat-wood', '--mat-parchment', '--mat-teal-panel', '--mat-quiet', '--mat-ruby', '--mat-gem-mana']
const shapes = ['--shape-plank', '--shape-scroll', '--shape-banner', '--shape-dialog', '--shape-chip', '--shape-medallion', '--shape-arch']
const radii = ['--r-1', '--r-2', '--r-3', '--r-4']
const shadows = ['--shadow-1', '--shadow-2', '--shadow-3', '--shadow-4']
const sizes = ['--fs-2xs', '--fs-xs', '--fs-sm', '--fs-md', '--fs-lg', '--fs-xl', '--fs-2xl', '--fs-3xl', '--fs-4xl']
const classList = Object.values(classThemes)
</script>

<template>
  <main class="tp">
    <header><h1>Токены Spellwhim · этап 1</h1><p>Цвета, материалы, типографика, формы, тени. Источник — <code>src/assets/tokens.css</code>; цвета классов — <code>classThemes.ts</code>; иконки — Lucide.</p></header>

    <section>
      <h2>Типографика</h2>
      <div class="type">
        <p class="t-display big">Вариан Ринн · Победа!</p>
        <p class="t-display">Каменный бастион · Ледяная стрела · Тайное предвидение · Прикрыть союзника</p>
        <p class="t-display semi">El Messiri 600 — ленты, подзаголовки, названия карт</p>
        <p class="t-ui">Nunito 500. 4 урона. Накладывает Уязвимость. При броне Джайны: +2 урона. Следующая наносящая урон карта получает +3 урона и снимает Уязвимость.</p>
        <p class="t-ui bold">Nunito 800 — ВРАГУ · ЦЕЛИ · НАПАРНИКУ · КОЛОДА · СБРОС</p>
        <p class="t-num">0123456789 · 25/25 · −6 · +3 · 11 · 18/18</p>
        <p class="t-num small">Rubik 800 (цифры): мана 3/5, здоровье 18/18, урон 11</p>
      </div>
      <div class="sizes"><span v-for="s in sizes" :key="s" :style="{ fontSize: `var(${s})` }">{{ s.replace('--fs-', '') }}</span></div>
    </section>

    <section v-for="g in colours" :key="g.group">
      <h2>{{ g.group }}</h2>
      <div class="swatches"><div v-for="[name, label] in g.items" :key="name" class="sw"><i :style="{ background: `var(${name})` }"></i><b>{{ name }}</b><span>{{ label }}</span></div></div>
    </section>

    <section>
      <h2>Цвета классов (из classThemes.ts, не токены)</h2>
      <div class="swatches"><div v-for="c in classList" :key="c.id" class="class-row"><b>{{ c.name }}</b><i :style="{ background: c.primary }"></i><i :style="{ background: c.surface }"></i><i :style="{ background: c.accent }"></i><i :style="{ background: c.secondary }"></i></div></div>
    </section>

    <section>
      <h2>Материалы (градиенты)</h2>
      <div class="swatches"><div v-for="m in materials" :key="m" class="sw wide"><i :style="{ background: `var(${m})` }"></i><b>{{ m }}</b></div></div>
    </section>

    <section>
      <h2>Мягкие формы — радиусы и «органические» контуры</h2>
      <div class="shapes">
        <div v-for="r in radii" :key="r" class="shape" :style="{ borderRadius: `var(${r})` }">{{ r }}</div>
        <div v-for="s in shapes" :key="s" class="shape big" :style="{ borderRadius: `var(${s})` }">{{ s }}</div>
      </div>
    </section>

    <section>
      <h2>Тени, кромки, свечение</h2>
      <div class="shapes"><div v-for="s in shadows" :key="s" class="shape lift" :style="{ boxShadow: `var(${s})` }">{{ s }}</div>
        <div class="shape lift" style="box-shadow: var(--glow-bonus)">glow-bonus</div><div class="shape lift" style="box-shadow: var(--glow-threat)">glow-threat</div><div class="shape lift" style="box-shadow: var(--glow-mana)">glow-mana</div></div>
    </section>

    <section>
      <h2>Кнопки и панели</h2>
      <div class="row">
        <button class="game-button"><Swords :size="18" :stroke-width="2.4" /> Завершить ход</button>
        <button class="game-button" disabled>Недоступно</button>
        <button class="game-button game-button--quiet">Пропустить</button>
        <span class="chip"><Heart :size="16" :stroke-width="2.4" /> 25 / 25</span>
        <span class="chip armor"><Shield :size="16" :stroke-width="2.4" /> 3</span>
        <span class="chip bonus"><Crosshair :size="16" :stroke-width="2.4" /> +3 Уязвимость</span>
        <span class="chip threat"><Flame :size="16" :stroke-width="2.4" /> −6 HP</span>
      </div>
      <div class="row"><div class="tip"><strong>Подсказка</strong><p>Поглощает урон. Остаток исчезает после атаки по этому герою.</p></div><div class="scroll"><strong>Свиток</strong><p>Пергаментная панель для чтения: правила карты, награды, события.</p></div></div>
    </section>
  </main>
</template>

<style scoped>
.tp{min-height:100%;padding:32px clamp(20px,5vw,72px) 64px;background:linear-gradient(var(--wood-1),var(--wood-0));color:var(--ink);overflow:auto;height:100%}
header h1{margin:0;font:700 var(--fs-3xl)/var(--lh-tight) var(--font-display);color:var(--brass-1)}header p{margin:6px 0 0;color:var(--muted)}code{font-family:var(--font-num);font-size:.9em;color:var(--gold)}
section{margin-top:28px}h2{margin:0 0 10px;font:800 var(--fs-xs) var(--font-ui);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--gold)}
.type p{margin:6px 0}.t-display{font:700 var(--fs-xl)/var(--lh-snug) var(--font-display)}.t-display.big{font-size:var(--fs-4xl)}.t-display.semi{font-weight:600;color:var(--gold)}.t-ui{font:500 var(--fs-md)/var(--lh-body) var(--font-ui);max-width:70ch}.t-ui.bold{font-weight:800;letter-spacing:var(--ls-caps);font-size:var(--fs-sm)}.t-num{font:800 var(--fs-3xl)/var(--lh-tight) var(--font-num);color:var(--brass-1)}.t-num.small{font-size:var(--fs-md);font-weight:700}
.sizes{display:flex;flex-wrap:wrap;align-items:baseline;gap:18px;margin-top:10px;font-family:var(--font-ui);color:var(--muted)}
.swatches{display:flex;flex-wrap:wrap;gap:12px}.sw{display:grid;gap:3px;width:128px;font:600 var(--fs-xs)/1.3 var(--font-ui)}.sw.wide{width:200px}.sw i{display:block;height:48px;border-radius:var(--r-2);border:1px solid #ffffff2a}.sw b{font-family:var(--font-num);font-weight:600;color:var(--ink)}.sw span{color:var(--muted)}
.class-row{display:flex;align-items:center;gap:8px;font:700 var(--fs-sm) var(--font-ui)}.class-row b{width:60px}.class-row i{width:46px;height:30px;border-radius:var(--r-1);border:1px solid #ffffff33}
.shapes{display:flex;flex-wrap:wrap;gap:16px}.shape{display:grid;place-items:center;width:128px;height:72px;background:var(--mat-wood);border:var(--border-soft);font:700 var(--fs-xs) var(--font-num);text-align:center;padding:6px}.shape.big{width:190px;height:96px;background:var(--mat-parchment);color:var(--parch-ink)}.shape.lift{background:var(--wood-2)}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin-bottom:16px}.game-button{display:inline-flex;align-items:center;gap:8px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--r-pill);background:#0007;border:1px solid var(--c-health);font:800 var(--fs-md) var(--font-num)}.chip.armor{border-color:var(--c-armor);color:var(--c-armor)}.chip.bonus{border-color:var(--c-bonus);color:var(--c-bonus);box-shadow:var(--glow-bonus)}.chip.threat{border-color:var(--c-threat);color:var(--c-threat)}
.tip{max-width:320px;padding:16px 18px;border:var(--border-panel);border-radius:var(--shape-scroll);background:var(--mat-teal-panel);box-shadow:var(--shadow-3);font:var(--fw-regular) var(--fs-md)/var(--lh-body) var(--font-ui)}.tip strong{display:block;font:700 var(--fs-lg) var(--font-display);color:#ffe3a8}.tip p{margin:6px 0 0}
.scroll{max-width:320px;padding:16px 20px;border-radius:var(--shape-scroll);background:var(--mat-parchment);color:var(--parch-ink);box-shadow:var(--shadow-3),0 0 0 2px var(--brass-3);font:600 var(--fs-md)/var(--lh-body) var(--font-ui)}.scroll strong{display:block;font:700 var(--fs-lg) var(--font-display)}.scroll p{margin:6px 0 0}
</style>
