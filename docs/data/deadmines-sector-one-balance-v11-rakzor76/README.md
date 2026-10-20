# Sector I v1.1a — Rak'Zor 70 → 76 HP

Единственная балансная поправка после [независимого ревью](../../design/deadmines-sector-one-balance-v11-review.md). Описание и таблица — [отчёт v1.1, §14](../../design/deadmines-sector-one-balance-v11.md#14-поправка-v11a-ракзор-76-hp).

- `compare.mjs` — проверяет, что каталог игры отличается от выбранной V2 только `maxHealth` Рак'Зора, затем на тех же seed main/holdout (по 300) сравнивает 70 и 76 HP: изолированный бой с боссом (aggressive/balanced/defensive) и полный mixed-поход. Использует неизменённые `harness.mjs`, `config.mjs` и `simulation.mjs` Codex.
- `results.json` — вывод скрипта.

Запуск из корня репозитория: `node docs/data/deadmines-sector-one-balance-v11-rakzor76/compare.mjs` (около минуты).
