# Spellwhim — реестр графических ресурсов

Используемые ресурсы портретов Вариана и Джайны перечислены как временные игровые ассеты; исходные PNG остаются в исследовательском каталоге. Арт делится по назначению: **способности универсальны и используют нейтральный/абстрактный фон; враги, события, боссы и окружение привязаны к приключению**. Размеры — целевые ориентиры; референсы — официальные материалы Blizzard для точности персонажей/предметов и `ART_BIBLE.md` для стиля. Образ Вариана: тёмные волосы, сине-золотые доспехи, Шаламейн. Образ Джайны: классический облик волшебницы с золотисто-светлыми волосами до уничтожения Терамора. Это художественные ориентиры; сюжет остаётся альтернативным и не привязан к единой дате.

| ID | Предполагаемый файл | Назначение и описание | Размер / формат | Референс и узнаваемость | Статус |
|---|---|---|---|---|---|
| `status-vulnerability` | `src/assets/art/vulnerability.svg` | Универсальная мишень/слабая точка для эффекта «Уязвимость»; не связана с бронёй или классом | SVG, viewBox 64×64, прозрачный фон | Оригинальная простая SVG-иконка проекта; подключена в `HeroPortrait.vue` | present |
| `class-warrior-emblem` | `src/assets/art/warrior-class-sword-clash.svg` | Классовая эмблема Воина — скрещённые клинки | SVG, viewBox 512×512, прозрачный фон | [Sword clash — Lorc / Game-icons.net](https://game-icons.net/1x1/lorc/sword-clash.html), CC BY 3.0 | present |
| `class-mage-emblem` | `src/assets/art/mage-class-wizard-staff.svg` | Классовая эмблема Мага — магический посох | SVG, viewBox 512×512, прозрачный фон | [Wizard staff — Lorc / Game-icons.net](https://game-icons.net/1x1/lorc/wizard-staff.html), CC BY 3.0 | present |
| `style-reference-varian` | `art-exploration/v01/varian.png` | Исходный пользовательский портрет Вариана; временный игровой вариант хранится отдельно в `src/assets/art/varian.jpg` | PNG, квадратный | Пользовательский ассет, не внешний ресурс | present — source/reference |
| `style-reference-jaina` | `art-exploration/v01/jaina.png` | Исходный пользовательский портрет Джайны; временный игровой вариант хранится отдельно в `src/assets/art/jaina.jpg` | PNG, квадратный | Пользовательский ассет, не внешний ресурс | present — source/reference |
| `hero-varian` | `src/assets/art/varian.jpg` | Временный игровой портрет Вариана, уменьшенная JPEG-копия пользовательского изображения из `art-exploration/v01/varian.png` | 768×768, 1:1 JPEG | Пользовательский ассет; подключён в `HeroPortrait.vue` | present — temporary in-game |
| `hero-jaina` | `src/assets/art/jaina.jpg` | Временный игровой портрет классической Джайны, уменьшенная JPEG-копия пользовательского изображения из `art-exploration/v01/jaina.png` | 768×768, 1:1 JPEG | Пользовательский ассет; подключён в `HeroPortrait.vue` | present — temporary in-game |
| `enemy-rhahkzor` | `src/assets/art/rhahkzor.jpg` | Огр-бригадир в шахте, массивный силуэт и признаки надсмотрщика | 768×768, 1:1 JPEG | [Rhahk’Zor](https://warcraft.wiki.gg/wiki/Rhahk%27Zor); огр, рабочая среда | missing |
| `enemy-sneed` | `src/assets/art/sneed.jpg` | Снид, ясно видимый в кабине крошшера; механика рядом не заслоняет гоблина | 768×768, 1:1 JPEG | [Sneed](https://warcraft.wiki.gg/wiki/Sneed), [Shredder](https://warcraft.wiki.gg/wiki/Sneed%27s_Shredder); узнаваемый пилот и машина | missing |
| `enemy-edwin` | `src/assets/art/edwin-vancleef.jpg` | Эдвин на палубе строящегося корабля; образ лидера, без карикатурного злодейства | 768×768, 1:1 JPEG | [Edwin VanCleef](https://warcraft.wiki.gg/wiki/Edwin_VanCleef); канонические черты и эпоха | missing |
| `card-sword-strike` | `src/assets/art/sword-strike.jpg` | Удар мечом: крупная диагональная дуга стального клинка, читаемая сила движения и один янтарный отблеск; персонаж не требуется | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; форма оружия сверяется с [Shalamayne](https://warcraft.wiki.gg/wiki/Shalamayne), если клинок показан | present / integrated legacy; neutral-background revision planned |
| `card-fireball` | `src/assets/art/fireball.jpg` | Огненный шар: один крупный оранжево-золотой снаряд с ярким центром и огненным хвостом; магическая принадлежность читается по сапфирово-аметистовым деталям, без персонажа | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; классическая магическая палитра по `ART_BIBLE.md` и `CARD_DESIGN_SYSTEM.md` | present / integrated legacy; neutral-background revision planned |
| `card-guard` | `src/assets/art/guard.jpg` | Защитная стойка: стальной клинок поперёк входящего удара, плотно собранная физическая блокирующая композиция и искры контакта; без магического барьера | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; если герой действительно нужен для читаемости, используй каноническую физическую стойку Вариана по `ART_BIBLE.md` | present / integrated legacy; neutral-background revision planned |
| `card-quick-cut` | `src/assets/art/quick-cut.jpg` | Быстрый выпад: узкий направленный клинок и короткие угловатые следы скорости; заметно отличается от широкой дуги обычного удара, без обязательного героя | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; оружие может опираться на [Shalamayne](https://warcraft.wiki.gg/wiki/Shalamayne), если оно присутствует | present / integrated legacy; neutral-background revision planned |
| `card-thunderbolt` | `src/assets/art/thunderbolt.jpg` | Тайный разряд: одна направленная сине-бирюзовая линия энергии с аметистовым свечением и несколькими руническими частицами; не круглый огненный шар, без персонажа | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; магия и палитра сверяются с `ART_BIBLE.md` и `CARD_DESIGN_SYSTEM.md` | present / integrated legacy; neutral-background revision planned |
| `card-bastion` | `src/assets/art/bastion.jpg` | Бастион: стальной клинок, наплечник или часть щита физически закрывает меньший силуэт союзника от удара; покажи прикрытие позицией и металлом, не магическим щитом | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; герой допустим, только если без него невозможно ясно показать прикрытие напарника; ориентир Вариана описан в `ART_BIBLE.md` | present / integrated legacy; neutral-background revision planned |
| `bg-mine-shafts` | `src/assets/art/bg-mine-shafts.jpg` | Золотая шахта, крепи, вагонетки, фонари и дальний штрек | 1920×1080, 16:9 JPEG | [Deadmines](https://warcraft.wiki.gg/wiki/Deadmines_%28Classic%29); не загромождать зону боя | missing |
| `bg-lumber-workshop` | `src/assets/art/bg-lumber-workshop.jpg` | Мастерская с крошшером, пиломатериалами и строящимся корпусом корабля | 1920×1080, 16:9 JPEG | [Deadmines](https://warcraft.wiki.gg/wiki/Deadmines_%28Classic%29), [Sneed’s Shredder](https://warcraft.wiki.gg/wiki/Sneed%27s_Shredder); свободная зона под HUD | missing |
| `bg-juggernaut-deck` | `src/assets/art/bg-juggernaut-deck.jpg` | Палуба незавершённого джаггернаута внутри копей | 1920×1080, 16:9 JPEG | [Deadmines](https://warcraft.wiki.gg/wiki/Deadmines_%28Classic%29); читаемые дерево, такелаж и корпус | missing |

## Контрольные изображения классовых карт v0.1

Три контрольных изображения заменены версиями с нейтральными абстрактными фонами. Они показывают эффект без локации и персонажа, не подключены в игре и остаются **experimental / not approved**. См. также `CARD_DESIGN_SYSTEM.md`.

| Файл | Назначение | Формат | Статус |
|---|---|---|---|
| `art-exploration/card-design-system-v01/warrior-defensive-parry.png` | Воин: столкновение клинков, сталь, бронза и янтарные искры; нейтральный угольно-серый фон | квадратный PNG | experimental / not approved; neutral-background revision |
| `art-exploration/card-design-system-v01/mage-fireball.png` | Маг: огненный шар с аметистовой дугой и сапфировым контуром; абстрактный индиго-аметистовый фон | квадратный PNG | experimental / not approved; neutral-background revision |
| `art-exploration/card-design-system-v01/mage-arcane-bolt.png` | Маг: сине-фиолетовый арканный разряд; абстрактный тёмно-синий фон | квадратный PNG | experimental / not approved; neutral-background revision |

## Пилотная серия расширения пула карт v0.1

Первые два черновика способностей показаны отдельно в полном размере до расширения серии. Все восемь способностей теперь имеют нейтральные, механически различимые композиции; исходники находятся в `art-exploration/card-pool-art-v01/` и **не подключены** в `src/assets/art/`. Все девять портретов врагов сохраняют свою приключенческую среду и привязаны в этом review-branch по стабильным ID, чтобы проверить медальоны в настоящем интерфейсе. Исходные файлы остаются в exploration; принятие каждого портрета можно скорректировать после визуального просмотра. Художественный стиль утверждён, индивидуальная приёмка новых ability-иллюстраций не подразумевается.

| Файл | Назначение | Ключ чтения | Статус |
|---|---|---|---|
| `card-warrior-stance-strike.jpg` | Воин — «Удар из стойки» | Диагональный физический удар, сталь, бронза и янтарная кинетика; нейтральный светлый фон | experimental / approval pending |
| `card-warrior-wound-clamp.jpg` | Воин — «Зажать рану» | Воин удерживает физический блок; алый импульс тика Кровотечения и бронзовая защита | experimental / approval pending |
| `card-warrior-covering-counter.jpg` | Воин — «Перехват удара» | Щит принимает вражеский клинок и направляет короткую контратаку; янтарные искры | experimental / approval pending |
| `card-warrior-crushing-swing.jpg` | Воин — «Сокрушительный замах» | Широкая дуга стального клинка с универсальным знаком уязвимости | experimental / approval pending |
| `card-mage-arcane-mark.jpg` | Маг — «Арканная метка» | Сапфирово-аметистовый знак и световой намёк на добор; абстрактный индиго-фон | experimental / approval pending |
| `card-mage-ice-echo.jpg` | Маг — «Ледяное эхо» | Сапфирово-аметистовая печать выпускает сине-белую волну льда; абстрактный магический фон | experimental / approval pending |
| `card-mage-frost-seal.jpg` | Маг — «Синяя печать» | Сапфировая руна запечатывает сдержанные алые частицы и оставляет знак уязвимости | experimental / approval pending |
| `card-mage-blood-resonance.jpg` | Маг — «Кровавый резонанс» | Красные искры превращаются в сапфирово-аметистовый магический всплеск | experimental / approval pending |
| `enemy-goblin-powder-runner.jpg` | Обычный враг — «Гоблин-пороховщик» | Хитрая улыбка, большие очки, шашки и горящий фитиль | approved style reference; exact portrait retained as review draft |
| `enemy-defias-lookout.jpg` | Обычный враг — «Дозорный Братства» | Лёгкий силуэт, арбалет и настороженный взгляд | approved style reference; exact portrait retained as review draft |
| `enemy-defias-veteran.jpg` | Элитный враг — «Ветеран Братства» | Седая борода, тяжёлая сталь, шрам, красный шарф и рукоять двуручного меча | revised review draft; former similar-face draft archived as `enemy-defias-veteran-previous.jpg` |

Полный набор способностей: `art-exploration/card-pool-art-v01/ability-art-review.jpg` и `ability-art-review.html`. Все восемь карт также показаны отдельно в `card-*.jpg`; они не подключены. Актуальный контакт-лист врагов — `enemy-art-review.html`; JPEG `enemy-art-review.jpg` — снимок с теми же новыми изображениями, сделанный до последнего уточнения подписи Налётчика. Полноразмерные снимки приложения и отчёт симуляций собраны в `docs/card-pool-expansion-v01.md`.

## Портреты противников: очередь производства по стабильному ID

Для всех портретов целевой формат — квадратный JPEG 768×768; лицо/силуэт держать в центральной зоне, чтобы медальон можно было обрезать по кругу. Референс сцены — соответствующее `EncounterDefinition` в `src/game/encountersV09.ts` или `src/game/types.ts`, локация `mapLabel` и `LORE_BIBLE.md`; для уникального босса сохранить текущую идентичность прототипа. Каждый промпт задаёт оригинальную фанатскую иллюстрацию, без копирования арта Blizzard. Все девять индивидуальных портретов теперь сгенерированы и подключены по стабильному `EnemyState.encounterId` в этой ветке для браузерной проверки. Статус изображений — review draft; это не пометка об окончательном одобрении.

Все девять подключённых Codex-портретов — черновые кандидаты для UI-тестирования, а не утверждённые production-изображения. Пороховщик и Дозорный приняты только как стилевые ориентиры. Финальные портреты будут выбраны отдельно после сравнения, включая варианты Crimson Oath.

| Encounter ID | Файл | Художественная сцена и prompt (EN) | Референс / статус / происхождение |
|---|---|---|---|
| `defias-cutpurse` | `src/assets/art/enemy-defias-cutpurse.jpg` | Проворная женщина-налётчица: рыжая боковая коса, короткий капюшон, два кинжала и кошель с монетами; низкая динамичная стойка. **Prompt:** `A wiry adult human woman of the Defias Brotherhood, auburn side braid, clever eyes, short dark leather hood, two narrow daggers and dangling coin purse, quick low posture; Deadmines shaft, warm lantern against cool blue stone, centered face and props, original vibrant stylized hand-painted fantasy, no text or border.` | Encounter + Deadmines; 768×768 optimized JPEG; revised ImageGen review draft; previous similar-face draft archived as `enemy-defias-cutpurse-previous.jpg`; exact-asset approval pending |
| `mine-overseer` | `src/assets/art/enemy-mine-overseer.jpg` | Широкий силуэт в каске, тяжёлая кирка и заклёпанные наручи. **Prompt:** `Square portrait of a broad stern mine overseer gripping a heavy pick, battered helmet and reinforced work apron, Deadmines timber braces and warm lantern light against cool rock, centered for circular crop, original painterly fantasy, no text or border.` | Encounter + Deadmines; 768×768 optimized JPEG; ImageGen draft, connected for visual review; approval of exact asset pending |
| `goblin-powder-runner` | `src/assets/art/enemy-goblin-powder-runner.jpg` | Хитрый гоблин с фитилями и пороховыми шашками в литейной/шахтной среде. **Prompt:** `Square portrait of a mischievous Deadmines goblin powder runner with oversized goggles and bundled powder charges, foundry glow behind, centered face and props, original painterly fantasy, no text or border.` | Encounter «Литейная гоблинов»; 768×768 optimized JPEG; Codex image is a review draft; user-approved style reference only, not final-asset approval; Crimson Oath alternatives pending |
| `defias-lookout` | `src/assets/art/enemy-defias-lookout.jpg` | Лёгкий дозорный Братства с арбалетом, настороженный взгляд, шахтный обзорный проход; отдельный силуэт от ветерана. **Prompt:** `Square portrait of an alert Defias lookout with a compact crossbow, light red-brown gear, focused gaze and Deadmines timber passage, centered for circular crop, original painterly fantasy, no text or border.` | Encounter + Deadmines; 768×768 optimized JPEG; Codex image is a review draft; user-approved style reference only, not final-asset approval; Crimson Oath alternatives pending |
| `foundry-tinkerer` | `src/assets/art/enemy-foundry-tinkerer.jpg` | Гоблинский инженер с асимметричной оптикой, гаечным ключом и маленькими механическими клешнями. **Prompt:** `Square portrait of a clever goblin foundry tinkerer with oversized magnifying goggles and tools, Deadmines furnace light and brass mechanisms, centered face, original painterly fantasy, no text or border.` | Encounter «Литейная гоблинов»; 768×768 optimized JPEG; ImageGen draft, connected for visual review; approval of exact asset pending |
| `defias-deckhand` | `src/assets/art/enemy-defias-deckhand.jpg` | Широкоплечий моряк средних лет с просоленной бородой, матросской фуражкой, канатом и абордажной саблей; палубный силуэт. **Prompt:** `A middle-aged human Defias Brotherhood deckhand and ship raider, broad weathered face, salt-and-pepper beard, battered navy sailor cap, rope coil over one shoulder and heavy boarding cutlass, sturdy nautical swagger; Deadmines shipyard, timber ribs and rigging, warm forge light, original vibrant stylized hand-painted fantasy, no text or border.` | Encounter «Причал Железного клюва»; 768×768 optimized JPEG; revised ImageGen review draft; previous similar-face draft archived as `enemy-defias-deckhand-previous.jpg`; exact-asset approval pending |
| `defias-veteran` | `src/assets/art/enemy-defias-veteran.jpg` | Седой ветеран с квадратной стальной бронёй, шрамом, красным шарфом и рукоятью двуручного меча; тяжёлый собранный силуэт. **Prompt:** `A hardened older human Defias Brotherhood veteran, close-cropped gray hair, thick gray beard, one old facial scar, heavy square steel-and-leather armor, worn crimson scarf and hilt of a large two-handed sword; stern disciplined expression, Deadmines forge-lit timber hall, original vibrant stylized hand-painted fantasy, no text or border.` | Encounter + Deadmines; 768×768 optimized JPEG; revised ImageGen review draft; previous similar-face draft archived as `enemy-defias-veteran-previous.jpg`; exact-asset approval pending |
| `goblin-foundry-chief` | `src/assets/art/enemy-goblin-foundry-chief.jpg` | Элитный старший механик с котлом, толстыми трубами и поршневой рукавицей; заметно массивнее механика. **Prompt:** `Square portrait of an imposing goblin foundry chief with a boiler harness, piston gauntlet and soot-marked goggles, Deadmines furnace, original painterly fantasy, no text or border.` | Elite encounter; 768×768 optimized JPEG; ImageGen draft, connected for visual review; approval of exact asset pending |
| `twilight-heart` | `src/assets/art/enemy-twilight-heart.jpg` | Пробуждённое древнее сердце чащи в корнях, фиолетово-зелёное ядро и две фазы; сохраняет существующую идентичность босса. **Prompt:** `Square portrait of the existing Twilight Heart, an ancient grove spirit inside twisting roots with a luminous violet-green core, twilight woodland, original painterly fantasy, no text or border.` | Prototype boss identity preserved; 768×768 optimized JPEG; ImageGen draft, connected for visual review; approval of exact asset pending |

`EnemyFrame.vue` выбирает портрет по `EnemyState.encounterId`; неизвестный ID сохраняет аккуратный fallback. Все девять ID связаны в этой ветке для проверки настоящих медальонов, статусов и HP; скриншоты не раскрывают портреты скрытых узлов карты.

## Новые способности пула v0.1

Для будущих иллюстраций использовать принцип `Abilities = class/mechanic-driven, neutral background` из `ART_BIBLE.md` и `CARD_DESIGN_SYSTEM.md`. Сцены ниже — художественное направление, не утверждённый арт.

| Карта | Класс | Сцена способности | Статус арта |
|---|---|---|---|
| Удар из стойки | Воин | Диагональная физическая атака с янтарными искрами и нейтральным охристо-синим фоном | `card-warrior-stance-strike.jpg`; полный размер показан; review draft, не подключён |
| Зажать рану | Воин | Стальной зажим, защитное перекрытие и несколько алых частиц тика; без натуралистичной раны | `card-warrior-wound-clamp.jpg`; 768×768 JPEG; review draft, не подключён |
| Перехват удара | Воин | Щит принимает клинок, за ним начинается короткая контратака; физические искры | `card-warrior-covering-counter.jpg`; 768×768 JPEG; review draft, не подключён |
| Сокрушительный замах | Воин | Широкая дуга двуручного клинка и маленький универсальный отблеск слабой точки | `card-warrior-crushing-swing.jpg`; 768×768 JPEG; review draft, не подключён |
| Арканная метка | Маг | Сапфирово-аметистовая руна, отмеченная цель и светлая пустая карта-добор без надписей | `card-mage-arcane-mark.jpg`; 768×768 JPEG; review draft, не подключён |
| Ледяное эхо | Маг | Арканный фокус выпускает сине-белую ледяную волну; абстрактный фиолетово-синий фон | `card-mage-ice-echo.jpg`; полный размер показан; review draft, не подключён |
| Синяя печать | Маг | Ледяная руна замыкает малиновые частицы и выпускает голубой сигнал уязвимости | `card-mage-frost-seal.jpg`; 768×768 JPEG; review draft, не подключён |
| Кровавый резонанс | Маг | Малиновые искры превращаются в сапфирово-аметистовый импульс и пустой светлый знак добора | `card-mage-blood-resonance.jpg`; 768×768 JPEG; review draft, не подключён |

## Способности Combat Depth v0.6

Шесть SVG в таблице ниже — технические заглушки для расширенной стартовой колоды. Они помогают проверить классовую палитру и разметку; это **не** утверждённые иллюстрации. При создании финального арта использовать `GLOBAL STYLE` + `CLASS ART DNA` нужного класса + готовые scene prompts ниже и в `CARD_DESIGN_SYSTEM.md`; герой не обязателен.

| Карта | Текущий файл | Будущая сцена | Статус |
|---|---|---|---|
| Парирование | `src/assets/art/parry.svg` | Стальной клинок принимает физический удар; бронзовая гарда и янтарная контактная искра. Ситуативный ответ читается как короткий встречный след. | temporary SVG placeholder |
| Удар щитом | `src/assets/art/shield-bash.svg` | Тяжёлый край щита/латы наносит удар; сталь и бронза, небольшой алый сигнал расходуемой метки. | temporary SVG placeholder |
| Прикрыть союзника | `src/assets/art/interpose.svg` | Воин заслоняет союзника плечом и клинком; физическая защита, сталь и бронза, сдержанный аметистовый акцент резонанса. | temporary SVG placeholder |
| Ледяная стрела | `src/assets/art/frostbolt.svg` | Один направленный снаряд синего льда с белым ядром и тонким аметистовым контуром. | temporary SVG placeholder |
| Тайное предвидение | `src/assets/art/arcane-insight.svg` | Световая карта проявляется над рунической схемой; сапфир, аметист, тонкая бирюзово-белая линия. | temporary SVG placeholder |
| Ледяной покров | `src/assets/art/ice-ward.svg` | Ледяные пластины и кристаллы укрывают две точки удара; чётко магический лёд и две зоны прикрытия. | temporary SVG placeholder |

Новые заглушки не связаны с портретами Вариана или Джайны и не требуют создания персонажей. См. также [Combat Depth v0.6](docs/combat-depth-v06.md).

### Готовые англоязычные scene prompts для временных SVG

Каждая сцена наследует нейтральный фон из `GLOBAL STYLE` ниже; при генерации запрещены шахты, рельсы, вагонетки, балки, шахтные фонари, тоннели и узнаваемые adventure-локации.

| Card ID / файл | Prompt (EN) | Формат и production status |
|---|---|---|
| `parry` / `parry.svg` → `ability-parry.jpg` | `Square close-up card illustration of a steel blade catching a physical strike at the exact instant of impact, three amber sparks and one short returning counter-cut, bronze guard, bold readable silhouette, no face, neutral abstract charcoal background.` | 768×768 JPEG; prompt ready; placeholder currently integrated; not approved |
| `shield-bash` / `shield-bash.svg` → `ability-shield-bash.jpg` | `Square close-up card illustration of a heavy steel shield edge driving forward into a target, strong physical impact, amber sparks and a small universal weakpoint glint, no magic barrier, neutral abstract slate background, readable at thumbnail size.` | 768×768 JPEG; prompt ready; placeholder currently integrated; not approved |
| `interpose` / `interpose.svg` → `ability-interpose.jpg` | `Square fantasy card illustration of a warrior physically stepping between an incoming blow and a smaller ally silhouette, steel shoulder and blade create a clear protective overlap, bronze details and a few amber sparks, neutral abstract background, no force field.` | 768×768 JPEG; prompt ready; placeholder currently integrated; not approved |
| `frostbolt` / `frostbolt.svg` → `ability-frostbolt.jpg` | `Square close-up fantasy card illustration of one compact blue-white ice projectile with a crisp sapphire core and thin amethyst edge, directed toward a small universal vulnerability mark, neutral abstract indigo background, bold silhouette.` | 768×768 JPEG; prompt ready; placeholder currently integrated; not approved |
| `arcane-insight` / `arcane-insight.svg` → `ability-arcane-insight.jpg` | `Square fantasy card illustration of a blank luminous card-like shard appearing above a few sapphire and amethyst arcane rings, visual suggestion of insight and a new draw without any letters or symbols that read as text, neutral abstract magical background.` | 768×768 JPEG; prompt ready; placeholder currently integrated; not approved |
| `ice-ward` / `ice-ward.svg` → `ability-ice-ward.jpg` | `Square fantasy card illustration of two distinct blue-white ice plates forming a protective cover over two small points of light, clear paired defense motif, sapphire and amethyst glow, neutral abstract magical background, no architecture.` | 768×768 JPEG; prompt ready; placeholder currently integrated; not approved |

### Приоритетные промпты для карт Кровотечения

Файлы уникальны и не подключены до генерации/утверждения. Визуально показывай статус красными/янтарными следами и частицами, без натуралистичной крови или gore; фон нейтральный и абстрактный.

| Card ID / production file | Prompt (EN) | Референс / статус / происхождение |
|---|---|---|
| `rend` / `ability-rend.jpg` | `Square original fantasy card illustration of a warrior's broad steel slash leaving three distinct restrained crimson ember trails that suggest a lingering bleed, amber impact sparks, physical blade motion, neutral abstract slate background, no gore, no location, readable silhouette.` | Воинская идентичность и эффект карты из `src/game/types.ts`; 768×768 JPEG; prompt ready, not generated, approval pending, not integrated; future original ImageGen output |
| `reaping-blow` / `ability-reaping-blow.jpg` | `Square original fantasy card illustration of a decisive warrior strike drawing several crimson motes from a marked foe into the blade, visualizing a powerful payoff that consumes a lingering bleed, steel and bronze, restrained red glow, neutral abstract charcoal background, no gore, no location.` | Воинская идентичность и status-burst из `src/game/types.ts`; 768×768 JPEG; prompt ready, not generated, approval pending, not integrated; future original ImageGen output |
| `boil-blood` / `ability-boil-blood.jpg` | `Square original fantasy card illustration of a mage's sapphire and amethyst spell making a few crimson motes pulse once and fade, with a small arcane glint suggesting a card drawn, crisp blue-white core, neutral abstract indigo background, no gore, no location.` | Магическая идентичность и status-tick + draw из `src/game/types.ts`; 768×768 JPEG; prompt ready, not generated, approval pending, not integrated; future original ImageGen output |

### Промпты восьми новых карт пула v0.1

Общий `GLOBAL STYLE` и class DNA добавляются ко всем строкам. Пилотные промпты для «Удара из стойки» и «Ледяного эха» уже реально сгенерированы; остальные ниже — задания, не утверждённые результаты.

| Card ID / production file | Prompt (EN) | Референс / статус / происхождение |
|---|---|---|
| `stance-strike` / `ability-stance-strike.jpg` | `Square fantasy card illustration of one decisive diagonal warrior strike with bright amber kinetic sparks; a smaller ally silhouette stays safely behind the physical guard line, steel and bronze, neutral abstract battlefield light, no recognizable setting.` | Готовый review draft: `art-exploration/card-pool-art-v01/card-warrior-stance-strike.jpg`; 768×768 JPEG; отдельно показан в полном размере до генерации остальных семи; одобрение точного изображения ожидает; original ImageGen output |
| `wound-clamp` / `ability-wound-clamp.jpg` | `Square fantasy card illustration of a warrior bracing behind a steel guard as three restrained crimson motes snap into one amber pulse, then settle; physical armor and a few sparks suggest immediate bleed tick plus defense, neutral abstract charcoal background, no gore.` | Готовый review draft: `art-exploration/card-pool-art-v01/card-warrior-wound-clamp.jpg`; 768×768 JPEG; нейтральный фон; одобрение точного изображения ожидает; original ImageGen output |
| `covering-counter` / `ability-covering-counter.jpg` | `Square fantasy card illustration of a warrior's steel shield catching an incoming blade and turning the impact into a short counter-strike, bold physical overlap, amber sparks, neutral abstract slate background, no magic barrier, no location.` | Готовый review draft: `art-exploration/card-pool-art-v01/card-warrior-covering-counter.jpg`; 768×768 JPEG; нейтральный фон; одобрение точного изображения ожидает; original ImageGen output |
| `crushing-swing` / `ability-crushing-swing.jpg` | `Square fantasy card illustration of a heavy two-handed steel sword sweep with a broad forceful arc; a small universal glowing weakpoint mark appears beside the impact, not a cracked armor icon, bronze and amber, neutral abstract background.` | Готовый review draft: `art-exploration/card-pool-art-v01/card-warrior-crushing-swing.jpg`; 768×768 JPEG; нейтральный фон; одобрение точного изображения ожидает; original ImageGen output |
| `arcane-mark` / `ability-arcane-mark.jpg` | `Square fantasy card illustration of a sapphire and amethyst arcane mark settling onto a small target silhouette as a blank luminous card-shaped glint appears beside it, elegant runic arcs, no legible writing, neutral abstract indigo background.` | Готовый review draft: `art-exploration/card-pool-art-v01/card-mage-arcane-mark.jpg`; 768×768 JPEG; нейтральный фон; одобрение точного изображения ожидает; original ImageGen output |
| `ice-echo` / `ability-ice-echo.jpg` | `Square fantasy card illustration of a sapphire-amethyst arcane focus releasing one clear blue-white ice wave and a few crisp shards, with a small luminous echo ripple, bold central effect, neutral abstract magical background, no character or location.` | Готовый review draft: `art-exploration/card-pool-art-v01/card-mage-ice-echo.jpg`; 768×768 JPEG; отдельно показан в полном размере до генерации остальных семи; одобрение точного изображения ожидает; original ImageGen output |
| `frost-seal` / `ability-frost-seal.jpg` | `Square fantasy card illustration of a sapphire frost rune sealing a few restrained crimson motes into a blue-white pulse, leaving one universal vulnerability glint, elegant amethyst contour, neutral abstract indigo background, no gore or location.` | Готовый review draft: `art-exploration/card-pool-art-v01/card-mage-frost-seal.jpg`; 768×768 JPEG; нейтральный фон; одобрение точного изображения ожидает; original ImageGen output |
| `blood-resonance` / `ability-blood-resonance.jpg` | `Square fantasy card illustration of restrained crimson motes being drawn into a sapphire-amethyst arcane resonance burst, one bright cyan-white core and a few rune fragments, visual transformation rather than gore, neutral abstract magical background.` | Готовый review draft: `art-exploration/card-pool-art-v01/card-mage-blood-resonance.jpg`; 768×768 JPEG; нейтральный фон; одобрение точного изображения ожидает; original ImageGen output |

## Сохранённые старые файлы

В `src/assets/art/` уже находятся `brann.jpg`, `lira.jpg`, `guardian.jpg`, `sword-strike.jpg`, `fireball.jpg`, `guard.jpg`, `quick-cut.jpg`, `thunderbolt.jpg` и `bastion.jpg`. Все они — **draft/legacy**, не одобрены как Warcraft-образы. Старые файлы не удалять, не перезаписывать и не переименовывать; новые имена из таблицы уникальны и не конфликтуют с legacy-артом. Три старых врага были общими локациями/образами прототипа, отдельных утверждённых портретов Рак'Зора, Снида и Эдвина нет.

## Полный инвентарь арта способностей

Пути в колонке «Отображается сейчас» — фактические связи из `src/ui/cardArt.ts`. Старые шесть JPEG уже используются, но их пейзажные фоны привязывают способность к отдельному биому: после утверждения нового направления заменять их на нейтральные версии по очереди. Это не мешает текущему пилоту. SVG остаются техническими заглушками; три карты Кровотечения используют повторный арт; восемь новых карт показывают читаемый арт-pending fallback. Пилотные JPEG вне production-каталога и в карту пока не подключены.

| Card ID | Карта | Отображается сейчас | Статус и следующее действие |
|---|---|---|---|
| `sword-strike` | Удар мечом | `src/assets/art/sword-strike.jpg` | integrated legacy JPEG; запланировать нейтральный фон |
| `fireball` | Огненный шар | `src/assets/art/fireball.jpg` | integrated legacy JPEG; запланировать нейтральный фон |
| `guard` | Защитная стойка | `src/assets/art/guard.jpg` | integrated legacy JPEG; запланировать нейтральный фон |
| `quick-cut` | Быстрый выпад | `src/assets/art/quick-cut.jpg` | integrated legacy JPEG; запланировать нейтральный фон |
| `thunderbolt` | Грозовой разряд | `src/assets/art/thunderbolt.jpg` | integrated legacy JPEG; запланировать нейтральный фон |
| `bastion` | Каменный бастион | `src/assets/art/bastion.jpg` | integrated legacy JPEG; запланировать нейтральный фон |
| `parry` | Парирование | `src/assets/art/parry.svg` | integrated temporary SVG; заменить иллюстрацией, нейтральный фон |
| `shield-bash` | Удар щитом | `src/assets/art/shield-bash.svg` | integrated temporary SVG; заменить иллюстрацией, нейтральный фон |
| `interpose` | Прикрыть союзника | `src/assets/art/interpose.svg` | integrated temporary SVG; заменить иллюстрацией, нейтральный фон |
| `frostbolt` | Ледяная стрела | `src/assets/art/frostbolt.svg` | integrated temporary SVG; заменить иллюстрацией, нейтральный фон |
| `arcane-insight` | Тайное предвидение | `src/assets/art/arcane-insight.svg` | integrated temporary SVG; заменить иллюстрацией, нейтральный фон |
| `ice-ward` | Ледяной покров | `src/assets/art/ice-ward.svg` | integrated temporary SVG; заменить иллюстрацией, нейтральный фон |
| `rend` | Рассекающий удар | `src/assets/art/quick-cut.jpg` | повторный art alias; запланировать индивидуальную иллюстрацию |
| `reaping-blow` | Кровавая расплата | `src/assets/art/sword-strike.jpg` | повторный art alias; запланировать индивидуальную иллюстрацию |
| `boil-blood` | Жар в венах | `src/assets/art/fireball.jpg` | повторный art alias; запланировать индивидуальную иллюстрацию |
| `stance-strike` | Удар из стойки | нет; арт-pending fallback | пилотный нейтральный JPEG в exploration; approval pending |
| `wound-clamp` | Зажать рану | нет; арт-pending fallback | prompt ready; не сгенерировано |
| `covering-counter` | Перехват удара | нет; арт-pending fallback | prompt ready; не сгенерировано |
| `crushing-swing` | Сокрушительный замах | нет; арт-pending fallback | prompt ready; не сгенерировано |
| `arcane-mark` | Арканная метка | нет; арт-pending fallback | prompt ready; не сгенерировано |
| `ice-echo` | Ледяное эхо | нет; арт-pending fallback | пилотный нейтральный JPEG в exploration; approval pending |
| `frost-seal` | Синяя печать | нет; арт-pending fallback | prompt ready; не сгенерировано |
| `blood-resonance` | Кровавый резонанс | нет; арт-pending fallback | prompt ready; не сгенерировано |

Для шести legacy JPEG в таблице уже есть базовые `CARD SCENE` ниже; при новой генерации всегда собирать их с нейтральным `GLOBAL STYLE`, без леса или другой adventure-specific локации.

## Англоязычные промпты

Добавляй промпт ниже к стилевому префиксу и ограничениям из `ART_BIBLE.md`. В тексте промптов не использовать `brushing` или `camera`. Результат всегда сверять с лорным референсом.

**Вариан:**

> Square chest-up portrait of Varian Wrynn, recognizable adult human King of Stormwind and warrior from Warcraft, dark hair, strong focused expression, blue-and-gold Alliance armor, Shalamayne visible as a distinctive paired blade, warm mine-lantern highlights against cool stone, centered face with safe circular-crop margins, original composition, no text, no border, no interface.

**Джайна:**

> Square chest-up portrait of Jaina Proudmoore in her classic pre-Theramore-destruction appearance, recognizable Warcraft human sorceress with golden-blonde hair and classic mage robes, poised intelligent expression, subtle arcane crystal and restrained frost motifs, blue and violet palette with a small warm highlight, centered face with safe circular-crop margins, original composition, no text, no border, no interface.

**Рак'Зор:**

> Square portrait of Rhahk'Zor, a massive Warcraft ogre foreman in the Deadmines, mining tools and timber supports suggest his role supervising laborers, expressive intimidating but readable face, ochre stone and warm lantern light, original composition, no text, no border, no interface.

**Снид:**

> Square portrait of Sneed, recognizable Warcraft goblin lumbermaster piloting a chunky wooden-and-metal shredder, keep the goblin clearly visible in the open cockpit, lively workshop shapes and warm forge highlights, original composition, no text, no border, no interface.

**Эдвин ван Клиф:**

> Square portrait of Edwin VanCleef, recognizable human leader of the Defias Brotherhood aboard the unfinished Deadmines juggernaut, calculating determined expression, practical red-and-brown Defias clothing, ship timber and rigging behind him, nuanced rather than monstrous villain portrayal, original composition, no text, no border, no interface.

## Промпты способностей: GLOBAL STYLE + CLASS ART DNA + CARD SCENE

Для каждой новой иллюстрации собери запрос из общего блока **GLOBAL STYLE**, блока **CLASS ART DNA** нужного класса и одного **CARD SCENE** ниже. Это согласованные слои `CARD_DESIGN_SYSTEM.md`: общий визуальный язык, стабильный классовый цвет/материалы и конкретное действие карты. Пользовательские портреты Вариана и Джайны из `art-exploration/v01/` можно использовать только как референсы света, палитры и отделки. Не проси копировать позу или композицию портрета. Персонаж не обязателен; добавляй его, только если без него действие нельзя ясно прочесть, и тогда соблюдай `ART_BIBLE.md`.

**GLOBAL STYLE (для всех способностей):**

> Original fan-made Warcraft fantasy ability-card illustration, vibrant stylized hand-painted fantasy, bold readable silhouette, warm adventurous humor, rich jewel colors, expressive clean shapes, polished painterly finish, dramatic but clear lighting, neutral or abstract fantasy background unrelated to any specific adventure, original composition, square composition, readable at thumbnail size, no mine, cave, tunnel, rails, cart, timber mine supports, or mining lanterns, no text, no logo, no card frame, no emblem, no interface, no watermark, no photorealism, no anime, no grimdark.

**CLASS ART DNA — Воин:**

> Steel & Ember: angular physical motion, readable steel weapon silhouette, bronze fittings, charcoal depth, rust-red and bronze class accents, crisp amber sparks or a small steel glint. Keep metal visibly metallic and physical. Never depict a magical barrier created by Varian.

**CLASS ART DNA — Маг:**

> Arcane & Wonder: sapphire-blue depth, amethyst arcane contour, restrained turquoise-white luminous core, smooth arcs or fine rune-like particles. Preserve the natural main color of the spell: fire stays orange-gold, frost stays blue-white, and arcane energy stays sapphire-amethyst.

**Удар мечом — `ability-sword-strike.jpg` — CARD SCENE:**

> A close, dramatic diagonal sword slash from upper left to lower right. Make the steel blade and its broad physical motion the single focal idea, with one sharp amber glint and a few sparks. No face or full character is needed; if a wielder is essential for clarity, show only a small canonical blue-and-gold armored portion that supports the blade action.

**Огненный шар — `ability-fireball.jpg` — CARD SCENE:**

> One large round orange-gold fireball in flight, with a bright center and clearly separated painterly flame tongues. Use a curling amethyst arcane ribbon and sapphire shadow as subtle mage identifiers. No character or hands are needed; keep the fireball as the single centered silhouette.

**Защитная стойка — `ability-guard-stance.jpg` — CARD SCENE:**

> A steel blade held crosswise to catch one incoming physical strike. Focus on the crossed steel, braced guard and grounded angular motion, with a few amber contact sparks. No magical barrier or energy shield. The blade action should read without a face; include part of a canonical warrior only if needed to make the defensive stance clear.

**Быстрый выпад — `ability-quick-cut.jpg` — CARD SCENE:**

> A compact, fast forward thrust with a narrow blade pointing toward the upper right. Use a low side-on angle, restrained foreshortening and short angular steel streaks to show speed. Keep the blade path narrow and distinct from a broad sword slash; the weapon alone can carry the scene.

**Тайный разряд — `ability-arcane-bolt.jpg` — CARD SCENE:**

> One directed sapphire and amethyst arcane bolt with a bright cyan-white core, travelling diagonally from lower left to upper right. Add a short trail of rune-like fragments and a few particles. Keep the energy path narrow and unmistakably different from the round fireball. No character or hands are needed.

**Бастион — `ability-bastion-cover.jpg` — CARD SCENE:**

> A physical interception that protects an ally: a steel blade, armored shoulder or shield edge takes one incoming blow while a smaller ally silhouette stays safely behind it. Make the protective overlap and metal contact the focus, with bronze fittings and amber sparks. Do not use a force field or magical shield. Include a recognizable canonical hero only if the protection cannot otherwise be understood.

Все шесть сцен остаются оригинальными фанатскими иллюстрациями. Сверяй каждый результат с `ART_BIBLE.md` и `CARD_DESIGN_SYSTEM.md`; по именам способностей не выводи требование изображать персонажа.

**Широкий фон шахты:**

> Wide 16:9 environment illustration of the classic Deadmines gold-mine shafts in Westfall, timber supports, mine carts, golden ore seams, warm lantern pools and cool deep tunnels, clear depth and calm uncluttered central battle area, no foreground characters, original composition, no text, no logo, no interface.

**Широкий фон мастерской:**

> Wide 16:9 environment illustration of a Deadmines lumber workshop beside a half-built ship, chunky shredder parts, cut timber, unfinished masts, copper tools and forge glow, leave calm space for battle UI, no foreground characters, original composition, no text, no logo, no interface.

**Широкий фон палубы:**

> Wide 16:9 environment illustration on the wooden deck of the unfinished Defias juggernaut inside the Deadmines, ropes, unfinished rigging, ship frames and a distant glimpse toward the sea, warm lantern light against cool cavern shadows, leave calm battle UI areas, no foreground characters, original composition, no text, no logo, no interface.
