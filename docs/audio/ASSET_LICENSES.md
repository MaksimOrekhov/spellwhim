# Audio candidate asset licenses

Это отдельная dev-фонотека для предварительного отбора. Она не импортируется из `GameAudio`, не заменяет процедурные боевые звуки и не воспроизводится игровыми экранами.

Полный машинно-читаемый реестр — [`candidates.json`](./candidates.json). На каждую запись там приходится исходная страница, автор, лицензия и её URL, условие атрибуции, разрешение на включение в публичный GitHub, имя файла в источнике, локальный путь, формат, байтовый размер, SHA-256 оригинального аудио, длительность, измеренные RMS/peak и статус проверки петли. Файл остаётся исходным: перекодирования и нормализации нет.

## Источники и лицензии

| Набор/страница | Автор | Проверенная лицензия | Атрибуция | Публичный GitHub |
|---|---|---|---|---|
| [Kenney — RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney Vleugels | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется; Kenney просит указать его по возможности. Текст лицензии набора включён рядом с файлами. | Разрешено |
| [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется; Kenney просит указать его по возможности. Текст лицензии набора включён рядом с файлами. | Разрешено |
| [Fantasy Sound Effects (Tinysized SFX)](https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx) | Vehicle / Jan Schüpke | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется | Разрешено |
| [Fantasy Song Pack Volume 1](https://opengameart.org/content/fantasy-song-pack-volume-1) | troubadour | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется; автор говорит, что credit необязателен. | Разрешено |
| [Town Theme RPG](https://opengameart.org/content/town-theme-rpg) | cynicmusic | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется; страница просит по возможности указать cynicmusic.com / pixelsphere.org. | Разрешено |
| [Battle Theme](https://opengameart.org/content/battle-theme-0) | Wolfgang_ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется | Разрешено |
| [Boss Battle Theme](https://opengameart.org/content/boss-battle-theme) | CleytonKauffman | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется; автор просит по возможности дать ссылку на SoundCloud. | Разрешено |
| [Cave Theme](https://opengameart.org/content/cave-theme) | Brandon75689, опубликовано HaelDB | Страница предлагает [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) и OGA-BY 3.0; в реестре явно выбрана CC0. | По CC0 не требуется; автор принимает указание HaelDB / Brandon Morris. | Разрешено на выбранной CC0-ветке |
| [Victory Fanfare](https://opengameart.org/content/victory-fanfare) | ARoachIFoundOnMyPillow | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется | Разрешено |
| [Bossfight_](https://opengameart.org/content/bossfight-1) | G_P | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется | Разрешено |
| [Victory Fanfare Short](https://opengameart.org/content/victory-fanfare-short) | cynicmusic | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Не требуется; автор просит по возможности указать cynicmusic.com / pixelsphere.org. | Разрешено |

У всех 43 включённых файлов `redistributablePublicGitHub: true`. Взяты только оригинальные страницы авторов/пакетов; перезаливы и звуки из коммерческих игр не использовались.

## Музыка: измерения и художественный статус

Длительность и уровни получены декодированием локальных файлов в Chromium Web Audio. `RMS dBFS` и sample peak — измерения сигнала, не LUFS и не оценка субъективной громкости. Исходники не нормализованы; для сравнения есть общий регулятор плеера.

| ID | Кандидат | Роли для сравнения | Длительность | BPM | RMS / peak | Петля | Вступление / окончание |
|---|---|---|---:|---:|---:|---|---|
| `music-back-to-nature` | Back to Nature | Меню, карта | 2:48 | Не подтверждён | −17,81 / −0,54 dBFS | Не проверена | Не прослушаны |
| `music-fairy-lights` | Fairy Lights | Меню, карта | 2:40 | Не подтверждён | −17,27 / −0,46 dBFS | Не проверена | Не прослушаны |
| `music-jaunt` | Jaunt | Карта, обычный бой | 2:24 | Не подтверждён | −17,03 / −0,67 dBFS | Не проверена | Не прослушаны |
| `music-springly-sprigs` | Springly Sprigs | Меню, обычный бой | 2:22 | Не подтверждён | −17,76 / −0,66 dBFS | Не проверена | Не прослушаны |
| `music-town-theme` | Town Theme RPG | Меню, карта | 1:37 | Не подтверждён | −15,64 / −0,07 dBFS | Не проверена | Не прослушаны |
| `music-battle-theme` | Battle Theme | Обычный бой, элита | 1:56 | Не подтверждён | −15,28 / +0,15 dBFS | Не проверена | Не прослушаны |
| `music-boss-battle-theme` | Boss Battle Theme | Бой, элита, Рак’Зор | 1:54 | Не подтверждён | −14,40 / +0,01 dBFS | Автор указывает loop; шов не проверен | Не прослушаны |
| `music-cave-theme` | Cave Theme | Карта | 4:40 | Не подтверждён | −14,10 / +0,68 dBFS | Не проверена | Не прослушаны |
| `music-victory-fanfare` | Victory Fanfare | Победа | 0:07 | Не подтверждён | −27,55 / −11,58 dBFS | Не проверена | Не прослушаны |
| `music-bossfight` | Bossfight_ | Элита, Рак’Зор | 1:54 | Не подтверждён | −10,98 / +0,43 dBFS | Не проверена | Не прослушаны |
| `music-victory-fanfare-short` | Victory Fanfare Short | Победа | 0:12 | Не подтверждён | −14,92 / +0,03 dBFS | Не проверена | Не прослушаны |

Положительный sample peak после декодирования MP3/OGG не использовался как субъективная оценка; он сохранён для проверки уровня. В BPM не записана догадка: исходные страницы не дают BPM, а автоматический подсчёт без прослушивания не признан надёжным. Повтор в плеере — механический restart/repeat файла, он **не означает** бесшовный музыкальный loop.

## SFX: содержимое набора

32 коротких файла разделены на три источника: 12 Kenney RPG Audio (извлечение клинка, два режущих swish, металлические удары/детали, скрип, дверь, книга, монеты); 8 Kenney Interface Sounds (click, confirmation, select, open/close, drop, scroll, pluck); 12 Tinysized CC0 (два столкновения мечей, два удара по металлу, извлечение ножа, страница книги, монета, скрип пола, электрический разряд, замок и два whoosh). Точные исходные/local имена, назначение, формат, длительность и SHA-256 находятся у каждой записи JSON.

Эти назначения — лишь удобные категории для audition. Например, `metalPot`/hammer не объявлены «правильным» попаданием брони, а Tinysized whoosh не выдается за записанную магию. Некоторые ожидаемые игровые события (кровотечение, раскол льда, защита, вагонетка, печь) не покрыты убедительной CC0-записью и пока остаются для будущего поиска/процедурного слоя.
