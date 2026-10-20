# Sector I Balance v1.1 — пакет независимого ревью

[Отчёт](../../design/deadmines-sector-one-balance-v11-review.md) · [все таблицы](results/tables.md) · сводка `results/summary.json`.

Объект ревью — `codex/deadmines-sector-one-balance-v11` @ **c344a4e**, база **1afabb3**. Игровые файлы и пакет Codex не изменялись. Движок обоих коммитов побайтово одинаков (отличается только `src/game/sectorContent.ts`), поэтому эксперименты запускаются на любом из них: определения врагов устанавливаются в памяти процесса.

## Состав

- `config/pa-c344a4e.json` — определения PA, извлечённые из коммита Codex (`scripts/extract-pa.mjs`); `config/v0-codex-frozen.json` — замороженный V0 Codex (= каталог 1afabb3).
- `scripts/harness.mjs` — загрузка модулей игры через Vite SSR (как в пакетах ревью раньше), ничего не пишет в исходники.
- `scripts/lib.mjs` — варианты V0/V1/PA/V3 и пробы босса Z1–Z7; бой с телеметрией по ходам и фазам; исследовательские политики `aggressive-fill` и `tempo`. Проверки «объявленное действие не меняется» и «подготовка не меняет цель» выполняются в каждом ходу.
- `scripts/oracle.mjs` — оракул: полный перебор последовательностей хода и rollout-оценка до конца боя. Порядок колоды скрыт (`determinize`), циклы врагов считаются выученными. Не игровой бот.
- `scripts/verify.mjs` — сверка определений с Codex и воспроизведение 36 ячеек изолированных боёв → `results/verify.json`.
- `scripts/exp-bots.mjs` — изолированные бои всех политик; `exp-frontier.mjs` — оракул с λ = 0,5 / 3 / 40 и метрики решений; `exp-same-hand.mjs` — одинаковая стартовая рука V0 против PA/V1.
- `scripts/exp-routes.mjs`, `exp-elite.mjs`, `exp-boss.mjs` — полные походы, элитные развилки и входы к боссу через неизменённый route-харнесс Codex (`simulation.mjs`), с подключением исследовательских политик.
- `scripts/analyze.py`, `bossstats.py`, `svg.py` — таблицы, сводка и SVG-графики (только стандартная библиотека Python).
- `results/raw/*.jsonl.gz` — все строки (seed, исход, телеметрия); `figures/*.svg` — графики отчёта.

## Запуск

Из корня репозитория с установленными зависимостями. Скриптам маршрутов нужен пакет Codex: после merge он лежит в `docs/data/deadmines-sector-one-balance-v11`, до merge укажите путь к его копии (`git archive c344a4e docs/data/deadmines-sector-one-balance-v11 | tar -x -C <dir>`) в `CODEX_PKG`.

```sh
D=docs/data/deadmines-sector-one-balance-v11-review/scripts
CODEX_PKG=<dir>/docs/data/deadmines-sector-one-balance-v11 node $D/verify.mjs 300
node $D/exp-bots.mjs PA 300 42 aggressive,aggressive-fill,tempo,balanced,defensive base   # также V0/V1/V3, hurt, 1000042, planner 100
node $D/exp-frontier.mjs PA 3 200 42                                                      # λ = 0.5, 3, 40; V0/V1/PA/V3
node $D/exp-same-hand.mjs 200 42 3 3 V0,PA                                                # и 1000042; V0,V1
node $D/exp-routes.mjs PA tempo 300 42                                                    # tempo/oracle3/oracle12/aggressive-fill, 42 и 1000042
node $D/exp-elite.mjs PA balanced 300 42                                                  # balanced/defensive/tempo/oracle3
node $D/exp-boss.mjs PA 300 42 balanced aggressive,tempo,balanced,defensive,oracle3       # V0/PA/V3/Z1–Z7
python $D/analyze.py
```

Все seed, вариант и политика записаны в каждой строке; повторный запуск даёт те же файлы (gzip с `mtime 0`). Полный набор занимает около часа на 12 ядрах; в отчёте использованы именно эти команды.

## Ограничения

- Оракул — верхняя оценка «опытного игрока, знающего циклы врагов», одна детерминизация на ход; его решения шумные на уровне отдельного хода и используются только в агрегатах.
- `tempo` — исследовательская политика атакующего стиля, а не модель человека и не изменение контрольных ботов.
- Пробы Z1–Z7 существуют только в памяти исследования; в игру не переносились.
- Файлы `boss-PA-aggressive-*`, `boss-PA-defensive-*`, `boss-V0-aggressive-*` получены до исправления разрешения ничьих в оракуле; строки оракула из них удалены, остальные политики от исправления не зависят.
