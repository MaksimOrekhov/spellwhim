# Sector I Combat Balance v1.1 — воспроизводимый пакет

База `1afabb357dc8b541bfe7bb04b1d4ae6d2b5c0c0f`, ревью Claude `0431cf9`. Выбран **V2 = PA**; выбор до holdout — `selection.json`. [Отчёт](../../design/deadmines-sector-one-balance-v11.md), [таблицы](tables.md).

- `config/v0.json` — зафиксированные шесть определений от 1afabb3; не зависят от текущего игрового каталога.
- `config/versions-v0.json` — прежние версии/fingerprint; `fixtures/` — настоящие прежние секторный/legacy snapshots для regression-тестов.
- `scripts/config.mjs` — V0/V1/V2/V3, seed-диапазоны, комплекты предметов.
- `scripts/simulation.mjs` — настоящий движок/транзакции, метрики и фиксированные public-политики. Legacy-боты не меняются.
- `scripts/run.mjs` — фазовые эксперименты. Манифест каждой фазы сохраняет определения, экономику, составы/политики и диапазон seed.
- `results/*.json` — клеточные агрегаты; `*.jsonl.gz` — все строки с seed, исходами, точными копиями, боями/комнатами и checkpoint. Проигрыши сохраняются.
- `scripts/analyze.py` — таблицы, парный bootstrap и четыре PNG-графика (matplotlib/numpy нужны только этому скрипту отчёта).
- `scripts/structure.mjs` — независимый DFS 10 002 карт и сравнение графов V0/PA.
- `scripts/audit.mjs` — точное совпадение выбранных определений, неизменность защищённых исходников и воспроизведение 567 основных строк.
- `inventory.json` — размеры и SHA-256 скриптов/конфигов/fixtures/результатов/графиков этого пакета; старые исследовательские каталоги не перезаписываются.

Из корня репозитория (установленные зависимости игры):

```sh
node docs/data/deadmines-sector-one-balance-v11/scripts/run.mjs --phase classic
node docs/data/deadmines-sector-one-balance-v11/scripts/run.mjs --phase classic --variants V3
node docs/data/deadmines-sector-one-balance-v11/scripts/run.mjs --phase classic --split holdout --variants V0,V1,V2,V3
node docs/data/deadmines-sector-one-balance-v11/scripts/run.mjs --phase planner
node docs/data/deadmines-sector-one-balance-v11/scripts/run.mjs --phase planner --variants V3
node docs/data/deadmines-sector-one-balance-v11/scripts/run.mjs --phase planner --split holdout --variants V0,V1,V2,V3
```

Для каждой из фаз `sensitivity`, `diagnostic`, `elite`, `rest` повторить `run.mjs --phase <phase>` и `--split holdout`; каждая использует V0/V1/V2 и 300 seed. Для `routes-extra`, `elite-noart`, `development` добавить `--variants V0,V2`, также оба диапазона. Допустим `--runs N` для проверки harness, но уменьшенное N не заменяет основной опыт. Planner 60, остальные 300 по умолчанию. Не запускать holdout для подбора новых параметров.

```sh
node docs/data/deadmines-sector-one-balance-v11/scripts/structure.mjs
node docs/data/deadmines-sector-one-balance-v11/scripts/audit.mjs
python docs/data/deadmines-sector-one-balance-v11/scripts/analyze.py
```

`prepare.mjs` — однократная фиксация V0 **только на нетронутом 1afabb3**. На v1.1 он намеренно отказывается работать: текущие определения не должны перезаписать контрольные fixtures. Повторное исследование использует уже сохранённый `v0.json`.

Перед публикацией исправлена маркировка врага в маршрутной телеметрии: публичный узел не содержит encounterId, он читается из уже посещённой комнаты. `replay-routes.mjs primary|elite|rest|extra` повторил затронутые эксперименты с зафиксированными параметрами и сравнил все прежние сводки, кроме разбиения `byEnemy`. `results/replay-*.json` подтверждают неизменность числовых исходов. Карточные боты не получили доступа к скрытой встрече.

Для построения графиков достаточно matplotlib 3.11.2 и numpy 2.5.4 в отдельном Python-окружении. В этой сессии они установлены во временный каталог; `package.json`/lock-файл игры не менялись.

В inventory текст нормализуется к UTF-8/LF (`normalization: utf8-lf`), архивы/PNG хешируются побайтово. Это позволяет проверять пакет после Windows checkout с `core.autocrlf`, не принимая CRLF за изменение исследования. `harnessCommit` в манифестах — HEAD в момент эксперимента до исследовательского коммита; фактические скрипты зафиксированы в этом пакете и проверяются inventory.

## Как читать вмешательства

Элитные пары начинаются перед одной и той же реальной развилкой, выбранной только по публичным категориям/связям. `normal-*` — штатные награды и услуга; `neutral-*` — уход из услуги и исследовательская нейтрализация принятой элитной карты (в игре нет skip для элит). Прямая цена, стоимость полного хвоста и выгода приза считаются отдельно. `elite-noart` запрещает предметы на всей последующей дистанции; `elite` дополнительно проверяет два фиксированных предметных комплекта на входе.

В rest-парах состояние до привала одинаково, ветви heal/upgrade/skip используют тот же последующий seed. При полном HP ветвь heal законно пропускает привал. Решение после просмотра будущего результата не подставляется в основную политику. `natural` содержит весь естественный поход; `branches` — только его хвост. Поэтому их поле `turns` нельзя сравнивать как длительность полного похода; для темпа используйте бои и `bossTurns` с явным числом дошедших.

`development` возвращает из одного pre-rest checkpoint развитый пакет или буквальный старт без предметов; в обоих хвостах rest=skip. Это исследовательское вмешательство в пакет развития, а не новая игровая транзакция удаления/возврата карт.

Для terminal HP проигрыш учитывается вместе с HP выжившего героя. `preBossW/M=0` для недошедших — отдельная zero-imputed метрика, не «босс нанёс ноль». `bossAmongArrivals` даёт условную сводку и N. Редкие ранние смерти не удаляются из побед/финального здоровья.

`aggressive-fill` добавляет balanced-розыгрыши только после остановки исходного aggressive. Она диагностическая; веса/публичность оригинальных ботов сохранены. У них возможна не монотонность по HP из-за переключения lethal-threat-эвристики.
