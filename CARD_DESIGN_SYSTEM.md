# Spellwhim — система идентичности классов и дизайн карт

## Цель

Класс карты должен узнаваться по оформлению карты до чтения подписи. Иллюстрация показывает действие и может обходиться без персонажа. Герои и сюжет остаются в портретах, сцене боя и тексте; способность должна быть понятной по крупному силуэту эффекта или предмета.

Общее направление — яркое приключенческое Warcraft-фэнтези с чистыми формами, насыщенными материалами, выразительным светом и добродушной энергией. При подготовке контрольных изображений пользовательские портреты Вариана и Джайны служат референсами палитры, освещения и живописной отделки, а не поз или композиций.

## Три визуальных слоя

1. **Класс:** цветовая палитра, эмблема, орнамент и имя класса. Они находятся в общем UI и остаются видимыми на обычной, связанной и недоступной карте.
2. **Действие:** отдельная иллюстрация карты. Она показывает один крупный момент и не обязана содержать героя.
3. **Игровое состояние:** стоимость маны, подсказка связи, причина недоступности и выбор награды. Состояние карты не перекрашивает её в другой класс.

## Темы классов

Цветовые значения задаются один раз в `src/game/classThemes.ts`. Компоненты получают их через CSS custom properties от `classThemeStyle`; локальные компоненты задают только форму, размещение и состояния.

| Класс | Основная палитра | Графический характер | Эмблема |
|---|---|---|---|
| Воин | ржаво-красный `#B95743`, угольный `#382C2B`, бронза `#D6A65E`, сталь `#515D69` | угловатые срезы, металлическая окантовка, плотные панели, стальные искры и физический импульс | скрещённые клинки, `src/assets/art/warrior-class-sword-clash.svg` |
| Маг | сапфир `#426EC2`, тёмный индиго `#252C51`, аметист `#9171C9`, светлая бирюза `#81DBED` | плавные дуги, круговые рунические мотивы, слои свечения и частицы | магический посох, `src/assets/art/mage-class-wizard-staff.svg` |

Синий кристалл стоимости маны общий для всех классов. Он обозначает игровую цену, поэтому не используется как классовая метка.

Магическая идентичность сохраняется даже у огня: огненный шар остаётся оранжево-золотым, а сапфировый фон, аметистовый контур и рунические частицы показывают принадлежность магу. Воинские защитные карты изображают стойку, стальной блок или прикрытие. Не изображай Вариана создающим магический щит. Резонанс показывается отдельным магическим откликом.

## Правила для иллюстраций

- Кадр квадратный; действие крупное и читается в миниатюре.
- Используй одну центральную идею: столкновение клинков, огненный шар, узкий арканный разряд.
- **Abilities = class/mechanic-driven, neutral background.** Фон нейтральный или абстрактный и не привязан к конкретному приключению. Для иллюстраций способностей запрещены узнаваемые шахты и их элементы: рельсы, вагонетки, шахтные балки, шахтные фонари, тоннели и подобное окружение.
- Локационный арт врагов, элит, боссов, событий и окружения приключения, наоборот, привязан к сцене. Для Мёртвых копей используй подходящие детали шахты, мастерской или корабельной палубы.
- Цвет классовой системы может поддерживать действие, но не должен портить его естественный цвет: пламя остаётся тёплым, лёд — голубым, металл — стальным.
- Не рисуй рамку карты, эмблему класса, стоимость, подпись, текст или игровой интерфейс внутри иллюстрации.
- Не добавляй персонажа автоматически. Включай его только если он нужен для чтения конкретного действия и прошёл проверку канонического облика.
- Используй оригинальную фанатскую композицию. Не переноси игровые ассеты или конкретные иллюстрации Blizzard.

## Оформление карт

`HandCard.vue` и `CardReward.vue` используют один реестр тем, эмблемы и классовую маркировку. В руке карты класс виден по контуру, орнаменту и эмблеме; в выборе награды тот же характер повторяется на большой карте. Подписи и карточная рамка строятся HTML/CSS отдельно от арт-изображения.

Связка может добавить свечение и короткий маркер связи, но оставляет палитру, эмблему и геометрию класса. Недоступная карта приглушается умеренно, чтобы игрок мог по-прежнему определить её класс. Стоимость, связка и недоступность должны оставаться читаемыми.

## Как добавить класс

1. Добавь литерал в `CardClassId` в `src/game/types.ts`.
2. Добавь один объект темы в `src/game/classThemes.ts`, включая токены, эмблему, подпись и характер орнамента.
3. Подбери SVG-эмблему в `src/assets/art/` и подключи её из реестра тем. Для внешнего ассета укажи автора, источник и лицензию в `README.md`.
4. Используй `classThemeStyle` и структурные классы орнамента в UI. Не копируй цветовые значения в компоненты.
5. Добавь класс в карты и проверь смешанную руку и награды в локальном предпросмотре.

Не выводи класс из имени героя. Класс — отдельная идентичность данных карты.

## Контрольные иллюстрации v0.1

Три контрольных изображения лежат в `art-exploration/card-design-system-v01/`. Это черновые стилевые образцы, созданные встроенным ImageGen; фон у всех заменён на нейтральный/абстрактный после уточнения арт-дирекшена. Они не подключены в игру и не считаются утверждёнными игровыми ассетами. Эти три примера проверяют классовые сигналы и различимость действий; массовая генерация карт начинается после отдельного просмотра и утверждения направления.

| Файл | Класс и действие | Визуальная проверка |
|---|---|---|
| `warrior-defensive-parry.png` | Воин — защитное парирование | сталь и бронза, угловатый удар, янтарные искры на нейтральном угольно-сером фоне |
| `mage-fireball.png` | Маг — огненный шар | тёплое пламя с аметистовым контуром на абстрактном индиго-фиолетовом фоне |
| `mage-arcane-bolt.png` | Маг — арканный разряд | сапфир, аметист и светлая энергия на абстрактном тёмно-синем фоне |

## Заготовка промпта способности: GLOBAL STYLE + CLASS ART DNA + CARD SCENE

Собирай промпт способности из общего **GLOBAL STYLE**, одного блока **CLASS ART DNA** и конкретного **CARD SCENE**. Пользовательские портреты Вариана и Джайны можно использовать только как референсы палитры, освещения и фактуры, не копируя позы или композицию. Персонаж не обязателен; включай его, только когда без него действие нельзя ясно понять, и соблюдай канонические требования `ART_BIBLE.md`.

**GLOBAL STYLE:**

> Original fan-made Warcraft fantasy ability-card illustration, vibrant stylized hand-painted fantasy, bold readable silhouette, warm adventurous humor, rich jewel colors, expressive clean shapes, polished painterly finish, dramatic but clear lighting, neutral or abstract fantasy background, original composition, square composition, readable at thumbnail size, no specific adventure setting, no mines, caves, tunnels, rails, carts, timber mine supports, or mining lanterns, no text, no logo, no card frame, no emblem, no interface, no watermark, no photorealism, no anime, no grimdark.

**CLASS ART DNA — Воин:**

> Steel & Ember: angular physical motion, readable steel weapon silhouette, bronze fittings, charcoal depth, rust-red and bronze class accents, crisp amber sparks or a small steel glint. Keep metal visibly metallic and physical. Never depict a magical barrier created by Varian.

**CLASS ART DNA — Маг:**

> Arcane & Wonder: sapphire-blue depth, amethyst arcane contour, restrained turquoise-white luminous core, smooth arcs or fine rune-like particles. Preserve the natural main color of the spell: fire stays orange-gold, frost stays blue-white, and arcane energy stays sapphire-amethyst.

**CARD SCENE — Воин, парирование:**

> Square close-up card illustration of two steel blades meeting in a decisive defensive parry, one blade held across the incoming strike, bright amber sparks at impact, bronze fittings and charcoal shadows, angular physical motion, neutral abstract slate and ember background, no visible face or full character, one clear action readable at thumbnail size, original composition, no mine, cave, tunnel, rails, cart, timber supports, lanterns, text, frame, emblem, or UI.

**CARD SCENE — Маг, огненный шар:**

> Square close-up card illustration of one large orange-gold fireball in flight, luminous core and painterly flame tongues, subtle amethyst arcane ribbons and sapphire accents identifying a mage, simple abstract indigo-violet magical background, bold centered silhouette readable at thumbnail size, no character or hands, original composition, no mine, cave, tunnel, rails, cart, timber supports, lanterns, text, frame, emblem, or UI.

**CARD SCENE — Маг, арканный разряд:**

> Square close-up card illustration of one directed sapphire and amethyst arcane bolt with a bright cyan-white core, a short trail of rune-like fragments and a few particles, simple abstract indigo background, bold diagonal silhouette readable at thumbnail size, no character or hands, original composition, no mine, cave, tunnel, rails, cart, timber supports, lanterns, text, frame, emblem, or UI.

Каждый результат сначала проверяется как экспериментальный. Проверяй читаемость действия, классовый сигнал и совпадение с общим художественным направлением до оптимизации и интеграции.
