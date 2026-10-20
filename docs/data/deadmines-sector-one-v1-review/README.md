# Данные независимого ревью сектора I

Сопровождение [ревью](../../design/deadmines-sector-one-v1-review.md) ветки `codex/deadmines-sector-one-v1` (`e115e81`).

- `scripts/` — скрипты экспериментов. Они загружают модули игры через Vite SSR (как `scripts/run-sector-one.mjs`), **ничего не пишут в проект** и меняют параметры врагов только в памяти процесса.
- `results/` — полные текстовые выводы, на которых основаны таблицы отчёта.

## Запуск

Нужен checkout `codex/deadmines-sector-one-v1` (`e115e81`) с установленными зависимостями. Каталог checkout передаётся через `SPELLWHIM_ROOT` (по умолчанию — текущий каталог):

```sh
cd docs/data/deadmines-sector-one-v1-review/scripts
SPELLWHIM_ROOT=/path/to/spellwhim node exp-structure.mjs 10000
SPELLWHIM_ROOT=/path/to/spellwhim node exp-validator.mjs
SPELLWHIM_ROOT=/path/to/spellwhim node exp-enemies.mjs 300 base   # base | hp | rotate | deck | items
SPELLWHIM_ROOT=/path/to/spellwhim node exp-routes.mjs 300 V0 routes18   # V0 | dmg+1..dmg+4 | PA ; routes | routes18 | elite | enemies
node mutate.mjs /path/to/exported-copy   # только на копии (git archive), файлы копии временно меняются
```

`mutate.mjs` применяет по одной текстовой мутации к копии кода, запускает `npx vitest run` и восстанавливает файл. Не запускать на рабочем checkout.

## Ограничения

Боты (`aggressive`, `balanced`, `defensive`, `planner`) — существующие стратегии Balance Lab с публичной информацией; они не меняют стиль игры от HP. Маршрутная политика, решения в комнатах и выбор наград повторяют эвристики лаборатории Codex (`scripts/run-sector-one.mjs`), включая «первую карту предложения». Варианты `dmg+k` и `PA` — стартовые точки будущих экспериментов, не утверждённый баланс.
