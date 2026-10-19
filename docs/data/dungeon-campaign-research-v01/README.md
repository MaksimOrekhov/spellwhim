# Данные исследования «Поход по Мёртвым копям v0.1»

Сырые результаты и лабораторные скрипты к [отчёту](../../dungeon-campaign-redesign-research-v01.md). Скрипты **только читают** игровые модули через Vite SSR (как `scripts/run-combat-challenge.mjs`) и ничего не меняют в игре: врагов, колоды и правила лечения они собирают в памяти.

| Файл | Что моделирует |
|---|---|
| `lab-common.mjs` | Загрузка движка и общий цикл боя ботом (`balanced` — `chooseCard`, `planner` — `createTurnPlanner`, информация `public`). |
| `lab-deck-size.mjs` → `deck-size.json` | Стартовая колода 18/16/14/12 × стартовая рука 8/7/6 против каждого врага v1.0 при полном здоровье. |
| `lab-power-curve.mjs` → `power-curve.json` | Насколько сильнее становится отряд после 0/4/8 наград, после удаления 4 стартовых карт и при фокусе на Кровотечении. |
| `lab-long-run.mjs` → `long-run-dmg*-hp*.json` | Линейные походы разной длины (5–19 боёв) из нынешних врагов-заменителей с переносом HP, ростом колоды и разными правилами лечения. Аргументы: `runs`, фильтр путей, множитель урона и здоровья обычных врагов. |
| `lab-synergy-odds.mjs` → `synergy-odds.json` | Монте-Карло: вероятность собрать функциональный пакет Кровотечения или «платы за броню» при 3/4 картах в предложении и разном числе наград. |

Воспроизведение из корня репозитория (Node 20+, установленные зависимости):

```bash
node docs/data/dungeon-campaign-research-v01/lab-deck-size.mjs 60 balanced,planner 8,7,6
node docs/data/dungeon-campaign-research-v01/lab-power-curve.mjs 50
node docs/data/dungeon-campaign-research-v01/lab-long-run.mjs 80 all 1 1
node docs/data/dungeon-campaign-research-v01/lab-long-run.mjs 80 all 0.75 0.8
node docs/data/dungeon-campaign-research-v01/lab-synergy-odds.mjs
```

Если скрипты запускаются из копии каталога, путь к репозиторию задаётся переменной `SPELLWHIM_ROOT`.

Ограничения: это боты, а не люди; боссы и элиты длинных походов — заменители из нынешнего ростера (ветеран ×1,25, старший механик ×1,3, Сумеречное сердце); выбор наград — общий скриптовый рейтинг `scripts/lib/dungeonRewardRank.mjs`. Числа годятся для сравнения вариантов между собой, а не для прогноза человеческого процента побед.
