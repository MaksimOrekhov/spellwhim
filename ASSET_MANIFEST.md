# Spellwhim — реестр графических ресурсов

Новые игровые портреты, иллюстрации карт и фоны со статусом **missing** перечислены вместе с уже имеющимися референсами и классовыми эмблемами. Существующие изображения старого сеттинга остаются legacy-кандидатами для просмотра, но не считаются изображениями новых персонажей и не интегрируются под каноническими именами. Размеры в качестве ориентиров — целевые; референсы — официальные материалы Blizzard для точности персонажей/предметов и `ART_BIBLE.md` для стиля. Образ Вариана: тёмные волосы, сине-золотые доспехи, Шаламейн. Образ Джайны: классический облик волшебницы с золотисто-светлыми волосами до уничтожения Терамора. Это художественные ориентиры; сюжет остаётся альтернативным и не привязан к единой дате.

| ID | Предполагаемый файл | Назначение и описание | Размер / формат | Референс и узнаваемость | Статус |
|---|---|---|---|---|---|
| `class-warrior-emblem` | `src/assets/art/warrior-class-sword-clash.svg` | Классовая эмблема Воина — скрещённые клинки | SVG, viewBox 512×512, прозрачный фон | [Sword clash — Lorc / Game-icons.net](https://game-icons.net/1x1/lorc/sword-clash.html), CC BY 3.0 | present |
| `class-mage-emblem` | `src/assets/art/mage-class-wizard-staff.svg` | Классовая эмблема Мага — магический посох | SVG, viewBox 512×512, прозрачный фон | [Wizard staff — Lorc / Game-icons.net](https://game-icons.net/1x1/lorc/wizard-staff.html), CC BY 3.0 | present |
| `style-reference-varian` | `art-exploration/v01/varian.png` | Имеющийся пользовательский ChatGPT-вариант Вариана; референс палитры, света и живописной отделки, не обязательная модель позы для иллюстраций способностей | PNG, квадратный | Добавлен в Git коммитом `05e926c` (`Add class style reference portraits`); предоставлен пользователем, не внешний ассет | present — style reference |
| `style-reference-jaina` | `art-exploration/v01/jaina.png` | Имеющийся пользовательский ChatGPT-вариант Джайны; референс палитры, света и живописной отделки, не обязательная модель позы для иллюстраций способностей | PNG, квадратный | Добавлен в Git коммитом `05e926c` (`Add class style reference portraits`); предоставлен пользователем, не внешний ассет | present — style reference |
| `hero-varian` | `src/assets/art/varian.jpg` | Будущий игровой портрет Вариана по плечи, тёмные волосы, сине-золотые доспехи, Шаламейн у края кадра; сначала проверь, подходит ли существующий style reference, и не создавай копию без отдельной нужды | 768×768, 1:1 JPEG | [Официальный профиль Varian / Blizzard](https://heroes-site-production-eks-prod-use1-01.heroesofthestorm.blizzard.com/en-us/heroes/varian/), [Shalamayne / Blizzard story](https://worldofwarcraft.blizzard.com/en-us/media/short-story/varian-wrynn-blood-of-our-fathers); ориентир и статус существующего референса — выше | missing |
| `hero-jaina` | `src/assets/art/jaina.jpg` | Будущий игровой портрет классической Джайны с золотисто-светлыми волосами и магическим фокусом; не использовать поздний преимущественно беловолосый образ; сначала проверь, подходит ли существующий style reference, и не создавай копию без отдельной нужды | 768×768, 1:1 JPEG | [Jaina Proudmoore: Tides of War / Blizzard](https://worldofwarcraft.blizzard.com/en-gb/media/book/jaina-proudmoore-tides-of-war); классический облик до уничтожения Терамора; ориентир и статус существующего референса — выше | missing |
| `enemy-rhahkzor` | `src/assets/art/rhahkzor.jpg` | Огр-бригадир в шахте, массивный силуэт и признаки надсмотрщика | 768×768, 1:1 JPEG | [Rhahk’Zor](https://warcraft.wiki.gg/wiki/Rhahk%27Zor); огр, рабочая среда | missing |
| `enemy-sneed` | `src/assets/art/sneed.jpg` | Снид, ясно видимый в кабине крошшера; механика рядом не заслоняет гоблина | 768×768, 1:1 JPEG | [Sneed](https://warcraft.wiki.gg/wiki/Sneed), [Shredder](https://warcraft.wiki.gg/wiki/Sneed%27s_Shredder); узнаваемый пилот и машина | missing |
| `enemy-edwin` | `src/assets/art/edwin-vancleef.jpg` | Эдвин на палубе строящегося корабля; образ лидера, без карикатурного злодейства | 768×768, 1:1 JPEG | [Edwin VanCleef](https://warcraft.wiki.gg/wiki/Edwin_VanCleef); канонические черты и эпоха | missing |
| `card-sword-strike` | `src/assets/art/ability-sword-strike.jpg` | Удар мечом: крупная диагональная дуга стального клинка, читаемая сила движения и один янтарный отблеск; персонаж не требуется | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; форма оружия сверяется с [Shalamayne](https://warcraft.wiki.gg/wiki/Shalamayne), если клинок показан | missing |
| `card-fireball` | `src/assets/art/ability-fireball.jpg` | Огненный шар: один крупный оранжево-золотой снаряд с ярким центром и огненным хвостом; магическая принадлежность читается по сапфирово-аметистовым деталям, без персонажа | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; классическая магическая палитра по `ART_BIBLE.md` и `CARD_DESIGN_SYSTEM.md` | missing |
| `card-guard` | `src/assets/art/ability-guard-stance.jpg` | Защитная стойка: стальной клинок поперёк входящего удара, плотно собранная физическая блокирующая композиция и искры контакта; без магического барьера | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; если герой действительно нужен для читаемости, используй каноническую физическую стойку Вариана по `ART_BIBLE.md` | missing |
| `card-quick-cut` | `src/assets/art/ability-quick-cut.jpg` | Быстрый выпад: узкий направленный клинок и короткие угловатые следы скорости; заметно отличается от широкой дуги обычного удара, без обязательного героя | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; оружие может опираться на [Shalamayne](https://warcraft.wiki.gg/wiki/Shalamayne), если оно присутствует | missing |
| `card-thunderbolt` | `src/assets/art/ability-arcane-bolt.jpg` | Тайный разряд: одна направленная сине-бирюзовая линия энергии с аметистовым свечением и несколькими руническими частицами; не круглый огненный шар, без персонажа | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; магия и палитра сверяются с `ART_BIBLE.md` и `CARD_DESIGN_SYSTEM.md` | missing |
| `card-bastion` | `src/assets/art/ability-bastion-cover.jpg` | Бастион: стальной клинок, наплечник или часть щита физически закрывает меньший силуэт союзника от удара; покажи прикрытие позицией и металлом, не магическим щитом | 768×768, 1:1 JPEG | `CARD_SCENE` ниже; герой допустим, только если без него невозможно ясно показать прикрытие напарника; ориентир Вариана описан в `ART_BIBLE.md` | missing |
| `bg-mine-shafts` | `src/assets/art/bg-mine-shafts.jpg` | Золотая шахта, крепи, вагонетки, фонари и дальний штрек | 1920×1080, 16:9 JPEG | [Deadmines](https://warcraft.wiki.gg/wiki/Deadmines_%28Classic%29); не загромождать зону боя | missing |
| `bg-lumber-workshop` | `src/assets/art/bg-lumber-workshop.jpg` | Мастерская с крошшером, пиломатериалами и строящимся корпусом корабля | 1920×1080, 16:9 JPEG | [Deadmines](https://warcraft.wiki.gg/wiki/Deadmines_%28Classic%29), [Sneed’s Shredder](https://warcraft.wiki.gg/wiki/Sneed%27s_Shredder); свободная зона под HUD | missing |
| `bg-juggernaut-deck` | `src/assets/art/bg-juggernaut-deck.jpg` | Палуба незавершённого джаггернаута внутри копей | 1920×1080, 16:9 JPEG | [Deadmines](https://warcraft.wiki.gg/wiki/Deadmines_%28Classic%29); читаемые дерево, такелаж и корпус | missing |

## Контрольные изображения классовых карт v0.1

Эти временные изображения находятся вне `src/assets/art/`, показывают эффекты без персонажей и не подключены в игре. Они проверяют читаемость трёх классовых сцен; статус всех — **experimental / not approved**. См. также `CARD_DESIGN_SYSTEM.md`.

| Файл | Назначение | Формат | Статус |
|---|---|---|---|
| `art-exploration/card-design-system-v01/warrior-defensive-parry.png` | Воин: парирование клинком, сталь, бронза и янтарные искры | квадратный PNG | experimental / not approved |
| `art-exploration/card-design-system-v01/mage-fireball.png` | Маг: огненный шар с аметистовой дугой и сапфировой глубиной | квадратный PNG | experimental / not approved |
| `art-exploration/card-design-system-v01/mage-arcane-bolt.png` | Маг: сине-фиолетовый арканный разряд | квадратный PNG | experimental / not approved |

## Способности Combat Depth v0.6

Шесть SVG в таблице ниже — технические заглушки для расширенной стартовой колоды. Они помогают проверить классовую палитру и разметку; это **не** утверждённые иллюстрации. При создании финального арта использовать `GLOBAL STYLE` + `CLASS ART DNA` нужного класса + `CARD SCENE` из `CARD_DESIGN_SYSTEM.md`; герой не обязателен. Для новых сцен отдельная секция промптов будет добавлена при переходе к генерации этих карт.

| Карта | Текущий файл | Будущая сцена | Статус |
|---|---|---|---|
| Парирование | `src/assets/art/parry.svg` | Стальной клинок принимает физический удар; бронзовая гарда и янтарная контактная искра. Ситуативный ответ читается как короткий встречный след. | temporary SVG placeholder |
| Удар щитом | `src/assets/art/shield-bash.svg` | Тяжёлый край щита/латы наносит удар; сталь и бронза, небольшой алый сигнал расходуемой метки. | temporary SVG placeholder |
| Прикрыть союзника | `src/assets/art/interpose.svg` | Воин заслоняет союзника плечом и клинком; физическая защита, сталь и бронза, сдержанный аметистовый акцент резонанса. | temporary SVG placeholder |
| Ледяная стрела | `src/assets/art/frostbolt.svg` | Один направленный снаряд синего льда с белым ядром и тонким аметистовым контуром. | temporary SVG placeholder |
| Тайное предвидение | `src/assets/art/arcane-insight.svg` | Световая карта проявляется над рунической схемой; сапфир, аметист, тонкая бирюзово-белая линия. | temporary SVG placeholder |
| Ледяной покров | `src/assets/art/ice-ward.svg` | Ледяные пластины и кристаллы укрывают две точки удара; чётко магический лёд и две зоны прикрытия. | temporary SVG placeholder |

Новые заглушки не связаны с портретами Вариана или Джайны и не требуют создания персонажей. См. также [Combat Depth v0.6](docs/combat-depth-v06.md).

## Сохранённые старые файлы

В `src/assets/art/` уже находятся `brann.jpg`, `lira.jpg`, `guardian.jpg`, `sword-strike.jpg`, `fireball.jpg`, `guard.jpg`, `quick-cut.jpg`, `thunderbolt.jpg` и `bastion.jpg`. Все они — **draft/legacy**, не одобрены как Warcraft-образы. Старые файлы не удалять, не перезаписывать и не переименовывать; новые имена из таблицы уникальны и не конфликтуют с legacy-артом. Три старых врага были общими локациями/образами прототипа, отдельных утверждённых портретов Рак'Зора, Снида и Эдвина нет.

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

**GLOBAL STYLE (для всех шести карт):**

> Original fan-made Warcraft fantasy card illustration, vibrant stylized hand-painted fantasy, bold readable silhouette, warm adventurous humor, rich jewel colors, expressive clean shapes, polished painterly finish, dramatic but clear lighting, warm mine-lantern highlights against cool mine shadows, original composition, square composition, readable at thumbnail size, no text, no logo, no card frame, no emblem, no interface, no watermark, no photorealism, no anime, no grimdark.

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
