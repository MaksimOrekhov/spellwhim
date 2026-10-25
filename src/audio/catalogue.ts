import type { SoundId } from './cues'

/** Dev audition names; gameplay uses only the cue ID. */
export const soundLabels: Record<SoundId, string> = {
  swing: 'Взмах', 'heavy-swing': 'Тяжёлый взмах', 'steel-hit': 'Удар клинка', 'heavy-hit': 'Тяжёлое попадание', 'shield-hit': 'Удар щитом',
  'fire-launch': 'Огонь · полёт', 'fire-hit': 'Огонь · вспышка', 'frost-launch': 'Лёд · полёт', 'frost-hit': 'Лёд · попадание', lightning: 'Молния',
  'arcane-launch': 'Аркана · призыв', 'arcane-hit': 'Аркана · резонанс', 'steel-guard': 'Броня · сталь', 'magic-guard': 'Броня · магия',
  block: 'Полный блок', 'armor-break': 'Разрушение брони', bleed: 'Кровотечение', 'ice-crack': 'Обморожение · расход', 'ice-form': 'Обморожение · наложение', interrupt: 'Срыв атаки',
  draw: 'Добор карты', gather: 'Подготовка удара', victory: 'Победа', defeat: 'Поражение', card: 'Розыгрыш карты', turn: 'Завершение хода', reward: 'Награда', room: 'Выбор комнаты',
  'weapon-draw': 'Вытягивание клинка', door: 'Открытие двери', lock: 'Замок / защёлка',
  'mine-air': 'Шахта · гул', 'crystal-air': 'Кристаллы · воздух', 'forge-air': 'Кузница · печь', creak: 'Скрип дерева', 'distant-metal': 'Отдалённый металл', 'crystal-chime': 'Перелив кристаллов', embers: 'Треск углей',
}
