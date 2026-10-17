# Spellwhim — Art Style Exploration v0.1

Экспериментальные варианты портрета Вариана, сохранённые отдельно от `src/assets/art/`. Ни один вариант не утверждён и не подключён к игре. Рабочая ветка: `codex/warcraft-art-production-ch1`.

## Файлы

- [Контактный лист](contact-sheet.png)
- [Круговые HUD-превью](circle-previews.png)
- [A — Classic Hearthstone Painterly, полный размер](varian-style-a-painterly.png) · [круговой кроп](varian-style-a-circle.png)
- [B — Warcraft III Stylized Fantasy, полный размер](varian-style-b-warcraft.png) · [круговой кроп](varian-style-b-circle.png)
- [C — Hand-Painted Fantasy Storybook, полный размер](varian-style-c-storybook.png) · [круговой кроп](varian-style-c-circle.png)

## Сравнительная оценка

Оценки субъективные, по шкале 1–10. Здесь A — первая генерация с уточнённым Шаламейном, B — Warcraft III проход с отдельным оружейным референсом, C — повторная storybook-попытка после первого слишком реалистичного результата.

| Критерий | A · Painterly | B · Warcraft III | C · Storybook |
|---|---:|---:|---:|
| Узнаваемость Вариана | 8 | 8 | 7 |
| Соответствие заданному направлению | 6 | 5 | 4 |
| Выраженность живописной фактуры | 8 | 7 | 6 |
| Стилизация лица и пропорций | 7 | 7 | 6 |
| Читаемость силуэта | 7 | 8 | 7 |
| Художественная цельность | 8 | 8 | 7 |
| Потенциал для карточной игры | 7 | 7 | 6 |
| Warcraft / карточное фэнтези | 8 | 8 | 8 |

### Наблюдения

- **A** лучше всего работает как цельный портрет: суровое лицо, читаемые сине-золотые доспехи, заметная фактура. При этом обработка всё ещё слишком гладкая и полированная для уверенного утверждения классического карточного стиля.
- **B** наиболее отличается по постановке: меч выдвинут в передний план, силуэт монументальнее. Это улучшает выразительность, но нарушает требование держать позу и масштаб почти одинаковыми для чистого стилевого сравнения. По рисовке он всё ещё близок к A.
- **C** теплее и свободнее по цветовым массам, однако генерация не ушла достаточно далеко от современного AI fantasy splash art. Направление storybook пока не доказано.
- **Шаламейн:** после референса его форма стала узнаваемее — длинное широкое лезвие, короткое обратное лезвие, выемки, центральный камень и рукоять. В круговых превью важные части остаются видимы, но в A верхушка длинного клинка близка к краю кадра. Перед игровым использованием потребуется более безопасное размещение оружия и отдельная проверка точности формы.
- Ни один вариант не следует считать утверждённым. Для следующего этапа полезнее сильнее изменить графический язык, чем добавлять детализацию или свет.

### Рекомендация

Из этих трёх **A — наиболее перспективная база**, потому что сохраняет выразительный характер Вариана и заметную живописную фактуру в карточном кадре. Это предварительная рекомендация по направлению, не утверждение портрета или художественного стандарта. Главная проблема эксперимента: A и C недостаточно различаются, а B уходит в другую постановку вместо чисто другой техники. Нужен ещё один короткий раунд с жёстче разведённой формой: например, A — крупная живопись с упрощёнными плоскостями; B — плоская графичная иллюстрация RTS; C — матовая гуашь с мягкими краями и меньшей реалистичностью лица.

## Референсы

- Вариан: [официальный профиль Blizzard — Heroes of the Storm](https://heroes-site-production-eks-prod-use1-01.heroesofthestorm.blizzard.com/en-us/heroes/varian/).
- Шаламейн: [официальный рассказ Blizzard — Blood of Our Fathers](https://worldofwarcraft.blizzard.com/en-us/media/short-story/varian-wrynn-blood-of-our-fathers).
- Форма оружия дополнительно направлялась изображением Шаламейна, приложенным пользователем в чате. Результаты — оригинальные генерации, не копии официальной композиции.

## Фактические промпты финальных вариантов

### A — Classic Hearthstone Painterly

```text
Use case: stylized-concept. Input image 1 is a weapon shape reference only: accurately preserve Shalamayne's distinctive silhouette, proportions, and construction, but do not copy its black background, rendering, labels, or exact image. Asset type: experimental square hero portrait for a fantasy card roguelike; style exploration, not an approved game asset. Scene: Deadmines gold mine, shadowy timber supports, a few amber lanterns and subdued ore seams, secondary background. Subject: Varian Wrynn, King of Stormwind, adult seasoned warrior with long dark hair, recognizable stern resolute face, blue-and-gold Alliance plate armor and bold lion emblem. Chest-up portrait; face and the weapon's recognizable outline stay in the central safe circle. Shalamayne is held upright beside him and clearly visible: an enormous ornate asymmetric twin-bladed sword, not a normal single straight sword. Match the reference silhouette: long swept broad blade projecting left from a central gold-bronze hilt with a bright round gem/orb, a second shorter jagged crescent blade projecting right from the same crossguard, deep cutouts and hooked notches, dark wrapped grip extending beyond the smaller blade. Show both blade branches and the central orb in frame. Style: Classic Hearthstone-inspired painterly fantasy, original composition; strong visible bristly paint strokes, layered opaque gouache marks, expressive slightly exaggerated face, heavy brow and weathered planes, chunky sculptural armor, simplified gold inlays, rich controlled jewel colors, hand-painted transitions, energetic tabletop-card illustration rather than a render. Composition: square chest-up centered hero in a three-quarter turn, one shoulder slightly forward, sword held diagonally beside shoulder, no other characters. Dramatic warm lantern edge light and cool mine shadow. No text, logo, border, card frame, interface, watermark. Avoid generic straight swords, single blade, ordinary longsword, glossy 3D render, beauty portrait, fashion model face, photorealistic skin, hyper-polished digital concept art, plastic surfaces, excessive microdetail, anime, grimdark.
```

### B — Warcraft III Stylized Fantasy

```text
Use case: stylized-concept. Input image 1 is a weapon silhouette reference only: preserve the recognizable asymmetric twin-bladed Shalamayne with the long swept blade, shorter opposite hooked blade, central round gem and dark wrapped grip; do not copy background, labeling or material rendering. Asset type: experimental square card-game hero portrait, not approved game art. Scene: Deadmines mine interior, timber beams, a few amber lanterns and muted blue-grey rock, background secondary. Subject: Varian Wrynn, King of Stormwind: long dark hair, stern rugged recognizable adult face, blue-and-gold Alliance armor, lion emblem, holding the exact distinctive double-headed Shalamayne clearly in view. Chest-up, centered, three-quarter angle, same scale and placement intended across three styles. Style/medium: hand-drawn 2D Warcraft III-era fantasy illustration, chunky monumental shape design, intentionally simplified painted planes, dramatically exaggerated heroic proportions, massive square pauldrons, thick neck, angular cheekbones and deep-set brows; strong graphic contour edges and flat-ish cel-painted blocks with coarse visible dry paint marks, restricted palette and high contrast. Make it look like a frame from a traditional hand-painted RTS unit portrait, not a polished fantasy splash illustration and not 3D. Lighting: broad amber mine light from one side, cool blue-violet shadow. No text, logos, UI, border, card frame or watermark. Avoid smooth gradients, glossy metal, photorealistic face, tiny ornamental detail, slender realistic anatomy, generic beautiful prince, anime, 3D render, modern cinematic concept art.
```

### C — Hand-Painted Fantasy Storybook

```text
Use case: stylized-concept. Input image 1 is ONLY a shape reference for Shalamayne: broad swept long blade, opposite shorter hooked blade, deep cutouts, central round jewel, wrapped grip. Preserve those recognizable weapon features, but ignore the black background and realistic metal texture. Asset type: exploratory 2D fantasy storybook portrait, square, for a card game's style study; not a final game asset. Subject: Varian Wrynn, King of Stormwind, adult battle-worn warrior, long dark hair, strongly recognizable severe brow and square face, blue-and-gold Alliance armor with one large simple lion emblem. Chest-up portrait, centered; hold the distinctive twin-bladed Shalamayne upright just beside him, showing both blade branches. Scene: simplified Deadmines mine, dark wooden braces and two soft amber lantern shapes against a cool teal tunnel. Style direction is the main requirement: a clearly illustrated hand-painted adventure storybook plate, flatter and more graphic than modern fantasy concept art. Use visibly broken opaque gouache brush shapes, broad simplified color patches, slightly uneven hand-painted contours, matte pigment, stylized facial planes with restrained exaggeration, warm russet shadows and teal-blue background, theatrical lantern glow painted in visible strokes, details selectively omitted. Avoid tiny scratches and photorealistic texture. Silhouette and face must read when reduced to a small circular game portrait. Keep the composition simple and iconic. No text, labels, watermark, border, card frame, interface. Absolutely avoid cinematic photorealism, smooth skin, glossy realistic metal, hyper-detailed pores, lens effects, polished AI splash art, 3D render, anime, childlike cute drawing, generic handsome prince.
```
