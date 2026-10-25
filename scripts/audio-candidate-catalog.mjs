import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = join(root, 'docs/audio/candidates.json')
const cc0 = 'https://creativecommons.org/publicdomain/zero/1.0/'
const kenneyRpg = { id: 'kenney-rpg-audio', title: 'RPG Audio', author: 'Kenney Vleugels', page: 'https://kenney.nl/assets/rpg-audio', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется; автор просит по возможности указать Kenney / kenney.nl.', redistribution: true }
const kenneyUi = { id: 'kenney-interface-sounds', title: 'Interface Sounds', author: 'Kenney', page: 'https://kenney.nl/assets/interface-sounds', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется; автор просит по возможности указать Kenney / kenney.nl.', redistribution: true }
const tiny = { id: 'tinysized-fantasy-sfx', title: 'Fantasy Sound Effects (Tinysized SFX)', author: 'Vehicle (Jan Schüpke)', page: 'https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется; страница указывает CC0.', redistribution: true }
const fantasySongs = { id: 'fantasy-song-pack-volume-1', title: 'Fantasy Song Pack Volume 1', author: 'troubadour', page: 'https://opengameart.org/content/fantasy-song-pack-volume-1', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется; автор пишет, что credit необязателен.', redistribution: true }
const town = { id: 'town-theme-rpg', title: 'Town Theme RPG', author: 'cynicmusic', page: 'https://opengameart.org/content/town-theme-rpg', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется; страница просит по возможности указать cynicmusic.com / pixelsphere.org.', redistribution: true }
const battle = { id: 'battle-theme-0', title: 'Battle Theme', author: 'Wolfgang_', page: 'https://opengameart.org/content/battle-theme-0', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется.', redistribution: true }
const bossTheme = { id: 'boss-battle-theme', title: 'Boss Battle Theme', author: 'CleytonKauffman', page: 'https://opengameart.org/content/boss-battle-theme', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется; автор просит по возможности ссылку на SoundCloud.', redistribution: true }
const cave = { id: 'cave-theme', title: 'Cave Theme', author: 'Brandon75689 (posted by HaelDB)', page: 'https://opengameart.org/content/cave-theme', license: 'CC0-1.0 (dual-licensed; CC0 selected)', licenseUrl: cc0, attribution: 'Не требуется по выбранной CC0; автор на странице принимает указание HaelDB / Brandon Morris.', redistribution: true }
const victory = { id: 'victory-fanfare', title: 'Victory Fanfare', author: 'ARoachIFoundOnMyPillow', page: 'https://opengameart.org/content/victory-fanfare', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется.', redistribution: true }
const bossfight = { id: 'bossfight-1', title: 'Bossfight_', author: 'G_P', page: 'https://opengameart.org/content/bossfight-1', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется.', redistribution: true }
const victoryShort = { id: 'victory-fanfare-short', title: 'Victory Fanfare Short', author: 'cynicmusic', page: 'https://opengameart.org/content/victory-fanfare-short', license: 'CC0-1.0', licenseUrl: cc0, attribution: 'Не требуется; автор просит по возможности ссылку на cynicmusic.com / pixelsphere.org.', redistribution: true }

const rows = [
  ['music-back-to-nature', 'music', 'Back to Nature', fantasySongs, 'music/back-to-nature.mp3', 'back_to_nature.mp3', ['menu', 'map'], 'Трек из Fantasy Song Pack Volume 1. Страница набора не описывает его звучание; оценка — только после прослушивания.'],
  ['music-fairy-lights', 'music', 'Fairy Lights', fantasySongs, 'music/fairy-lights.mp3', 'fairy_lights.mp3', ['menu', 'map'], 'Трек из Fantasy Song Pack Volume 1. Страница набора не описывает его звучание; оценка — только после прослушивания.'],
  ['music-jaunt', 'music', 'Jaunt', fantasySongs, 'music/jaunt.mp3', 'jaunt.mp3', ['map', 'battle'], 'Трек из Fantasy Song Pack Volume 1. Страница набора не описывает его звучание; оценка — только после прослушивания.'],
  ['music-springly-sprigs', 'music', 'Springly Sprigs', fantasySongs, 'music/springly-sprigs.mp3', 'springly_sprigs.mp3', ['menu', 'battle'], 'Трек из Fantasy Song Pack Volume 1. Страница набора не описывает его звучание; оценка — только после прослушивания.'],
  ['music-town-theme', 'music', 'Town Theme RPG', town, 'music/town-theme.mp3', 'TownTheme.mp3', ['menu', 'map'], 'Автор описывает спокойную RPG-тему с арфами и блокфлейтами.'],
  ['music-battle-theme', 'music', 'Battle Theme', battle, 'music/battle-theme.mp3', 'Battle.mp3', ['battle', 'elite'], 'Автор описывает оркестровую тему для боя или напряжённого момента.'],
  ['music-boss-battle-theme', 'music', 'Boss Battle Theme', bossTheme, 'music/boss-battle-theme.ogg', 'CleytonRX - Battle RPG Theme Var.ogg', ['battle', 'elite', 'boss'], 'Автор обозначает композицию как RPG battle theme и сообщает, что она зацикливается. Тип loop-версии указан источником; шов независимо не проверен.'],
  ['music-cave-theme', 'music', 'Cave Theme', cave, 'music/cave-theme.ogg', 'cave themeb4.ogg', ['map'], 'Автор описывает её как загадочную тему пещеры. На странице доступны CC0 и OGA-BY; в проект включена версия под CC0.'],
  ['music-victory-fanfare', 'music', 'Victory Fanfare', victory, 'music/victory-fanfare.mp3', 'fanfare1.mp3', ['victory'], 'Автор описывает короткую победную фанфару на церковном органе.'],
  ['music-bossfight', 'music', 'Bossfight_', bossfight, 'music/bossfight.mp3', 'bossfight_.mp3', ['elite', 'boss'], 'Автор называет это более длинной музыкой в стиле boss fight. Сочетание оркестра, рока и чиптюна отмечено в комментарии слушателя страницы, а не проверено здесь.'],
  ['music-victory-fanfare-short', 'music', 'Victory Fanfare Short', victoryShort, 'music/victory-fanfare-cynic.wav', 'Heavy_ConceptB.wav', ['victory'], 'Автор описывает несколько тактов победной фанфары для RPG.'],

  ['sfx-rpg-draw-knife', 'sfx', 'Draw knife', kenneyRpg, 'sfx/rpg-draw-knife.ogg', 'drawKnife1.ogg', ['warrior', 'weapon'], 'Вытягивание клинка; кандидат на короткий подготовительный звук.'],
  ['sfx-rpg-knife-slice-a', 'sfx', 'Knife slice A', kenneyRpg, 'sfx/rpg-knife-slice-a.ogg', 'knifeSlice.ogg', ['warrior', 'weapon'], 'Короткий режущий swish; сравнить с whoosh-кандидатами.'],
  ['sfx-rpg-knife-slice-b', 'sfx', 'Knife slice B', kenneyRpg, 'sfx/rpg-knife-slice-b.ogg', 'knifeSlice2.ogg', ['warrior', 'weapon'], 'Второй вариант режущего swish.'],
  ['sfx-rpg-metal-pot-a', 'sfx', 'Metal pot A', kenneyRpg, 'sfx/rpg-metal-pot-a.ogg', 'metalPot1.ogg', ['warrior', 'impact'], 'Металлический удар по предмету; только audition-кандидат на столкновение брони.'],
  ['sfx-rpg-metal-pot-b', 'sfx', 'Metal pot B', kenneyRpg, 'sfx/rpg-metal-pot-b.ogg', 'metalPot2.ogg', ['warrior', 'impact'], 'Второй вариант металлического удара по предмету.'],
  ['sfx-rpg-metal-click', 'sfx', 'Metal click', kenneyRpg, 'sfx/rpg-metal-click.ogg', 'metalClick.ogg', ['mine', 'impact'], 'Короткий клик металлической детали.'],
  ['sfx-rpg-metal-latch', 'sfx', 'Metal latch', kenneyRpg, 'sfx/rpg-metal-latch.ogg', 'metalLatch.ogg', ['mine', 'chest'], 'Щелчок металлической защёлки; сравнить для сундука/механизма.'],
  ['sfx-rpg-wood-creak', 'sfx', 'Wood creak', kenneyRpg, 'sfx/rpg-wood-creak.ogg', 'creak1.ogg', ['mine', 'ambience'], 'Скрип дерева.'],
  ['sfx-rpg-door-open', 'sfx', 'Door open', kenneyRpg, 'sfx/rpg-door-open.ogg', 'doorOpen_1.ogg', ['mine', 'chest'], 'Открывание двери как фоли-кандидат для сундука или комнаты.'],
  ['sfx-rpg-book-flip', 'sfx', 'Book flip', kenneyRpg, 'sfx/rpg-book-flip.ogg', 'bookFlip1.ogg', ['interface', 'card'], 'Переворот страницы; кандидат для добора или выбора карты.'],
  ['sfx-rpg-coin-handling', 'sfx', 'Handle coins', kenneyRpg, 'sfx/rpg-coin-handling.ogg', 'handleCoins.ogg', ['interface', 'reward'], 'Манипуляция монетами; кандидат на награду.'],
  ['sfx-rpg-book-open', 'sfx', 'Book open', kenneyRpg, 'sfx/rpg-book-open.ogg', 'bookOpen.ogg', ['interface', 'card'], 'Открывание книги; сравнить для открытия просмотра колоды.'],
  ['sfx-ui-click', 'sfx', 'Click 001', kenneyUi, 'sfx/ui-click.ogg', 'click_001.ogg', ['interface'], 'Короткий щелчок кнопки.'],
  ['sfx-ui-confirm', 'sfx', 'Confirmation 001', kenneyUi, 'sfx/ui-confirm.ogg', 'confirmation_001.ogg', ['interface', 'reward'], 'Подтверждение; кандидат на завершение хода или принятие награды.'],
  ['sfx-ui-select', 'sfx', 'Select 001', kenneyUi, 'sfx/ui-select.ogg', 'select_001.ogg', ['interface', 'card'], 'Выбор; кандидат для сравнения карт.'],
  ['sfx-ui-open', 'sfx', 'Open 001', kenneyUi, 'sfx/ui-open.ogg', 'open_001.ogg', ['interface', 'chest'], 'Открывание; кандидат для сундука или панели.'],
  ['sfx-ui-close', 'sfx', 'Close 001', kenneyUi, 'sfx/ui-close.ogg', 'close_001.ogg', ['interface'], 'Закрытие панели.'],
  ['sfx-ui-drop', 'sfx', 'Drop 001', kenneyUi, 'sfx/ui-drop.ogg', 'drop_001.ogg', ['interface', 'card'], 'Звук отпускания предмета; сравнить для розыгрыша карты.'],
  ['sfx-ui-scroll', 'sfx', 'Scroll 001', kenneyUi, 'sfx/ui-scroll.ogg', 'scroll_001.ogg', ['interface', 'card'], 'Короткий звук прокрутки/бумаги.'],
  ['sfx-ui-pluck', 'sfx', 'Pluck 001', kenneyUi, 'sfx/ui-pluck.ogg', 'pluck_001.ogg', ['interface', 'reward'], 'Щипковый акцент выбора/награды.'],
  ['sfx-fantasy-sword-clash-a', 'sfx', 'Sword clash A', tiny, 'sfx/fantasy-sword-clash-a.wav', 'sword-clash-01.wav', ['warrior', 'impact'], 'Столкновение мечей; вариант A.'],
  ['sfx-fantasy-sword-clash-b', 'sfx', 'Sword clash B', tiny, 'sfx/fantasy-sword-clash-b.wav', 'sword-clash-02.wav', ['warrior', 'impact'], 'Столкновение мечей; вариант B.'],
  ['sfx-fantasy-hammer-hit-a', 'sfx', 'Metal hammer A', tiny, 'sfx/fantasy-hammer-hit-a.wav', 'metal-hammer-hit-01.wav', ['warrior', 'impact'], 'Удар металла о наковальню; потенциальный слой тяжёлого попадания.'],
  ['sfx-fantasy-hammer-hit-b', 'sfx', 'Metal hammer B', tiny, 'sfx/fantasy-hammer-hit-b.wav', 'metal-hammer-hit-02.wav', ['warrior', 'impact'], 'Второй вариант удара молота по металлу.'],
  ['sfx-fantasy-knife-unsheathe', 'sfx', 'Knife unsheathe', tiny, 'sfx/fantasy-knife-unsheathe.wav', 'knife-unsheathe-02.wav', ['warrior', 'weapon'], 'Извлечение ножа; возможный короткий взмах/подготовка.'],
  ['sfx-fantasy-book-page', 'sfx', 'Book page', tiny, 'sfx/fantasy-book-page.wav', 'book-page-01.wav', ['interface', 'card'], 'Перелистывание книги; кандидат на добор карты.'],
  ['sfx-fantasy-coins', 'sfx', 'Coins', tiny, 'sfx/fantasy-coins.wav', 'coin-spin-fall-01.wav', ['interface', 'reward'], 'Монета вращается и падает; кандидат на награду.'],
  ['sfx-fantasy-floor-creak', 'sfx', 'Floor creak', tiny, 'sfx/fantasy-floor-creak.wav', 'floor-creak-01.wav', ['mine', 'ambience'], 'Скрип пола/деревянной конструкции.'],
  ['sfx-fantasy-paralyzer-discharge', 'sfx', 'Paralyzer discharge', tiny, 'sfx/fantasy-paralyzer-discharge.wav', 'paralyzer-discharge-01.wav', ['mage', 'magic'], 'Электрический разряд; тематическая совместимость должна быть подтверждена владельцем.'],
  ['sfx-fantasy-lock-turn', 'sfx', 'Lockbox key turn', tiny, 'sfx/fantasy-lock-turn.wav', 'keyhole-lockbox-turn-01.wav', ['mine', 'chest'], 'Ключ поворачивается в замке; кандидат для сундука/механизма.'],
  ['sfx-fantasy-whoosh-a', 'sfx', 'Whoosh A', tiny, 'sfx/fantasy-whoosh-a.wav', 'tin-whistle-whoosh-01.wav', ['warrior', 'mage', 'weapon'], 'Короткий свистящий whoosh; источник — Tinysized foley, не записанная магия.'],
  ['sfx-fantasy-whoosh-b', 'sfx', 'Whoosh B', tiny, 'sfx/fantasy-whoosh-b.wav', 'tin-whistle-whoosh-02.wav', ['warrior', 'mage', 'weapon'], 'Второй свистящий whoosh-кандидат.'],
]

const entries = rows.map(([id, kind, title, source, relativePath, originalFilename, roles, note]) => {
  const localPath = join(root, 'src/audio/candidate-assets', relativePath)
  if (!existsSync(localPath)) throw new Error(`Missing asset ${relativePath}`)
  const bytes = readFileSync(localPath)
  const extension = relativePath.split('.').at(-1).toLowerCase()
  return {
    id, kind, title, author: source.author, sourceId: source.id, sourceTitle: source.title,
    sourcePage: source.page, license: source.license, licenseUrl: source.licenseUrl,
    attribution: source.attribution, redistributablePublicGitHub: source.redistribution,
    originalFilename, localPath: `src/audio/candidate-assets/${relativePath}`,
    format: extension, fileSizeBytes: statSync(localPath).size,
    sha256Original: createHash('sha256').update(bytes).digest('hex'),
    roles, note, durationSeconds: null, bpm: null, rmsDbfs: null, peakDbfs: null,
    introEndingAssessment: kind === 'music' ? 'not-auditioned' : null,
    loop: { status: id === 'music-boss-battle-theme' ? 'source-claimed' : 'unverified', note: id === 'music-boss-battle-theme' ? 'Страница автора говорит “Looped: Yes”; шов не проверялся независимо.' : 'Петля не подтверждена; отдельный повтор доступен в библиотеке.' },
  }
})

const catalog = {
  schemaVersion: 1,
  purpose: 'Локальная dev-фонотека для художественного отбора; ничего не подключено к GameAudio.',
  licenses: { 'CC0-1.0': cc0 },
  sources: [kenneyRpg, kenneyUi, tiny, fantasySongs, town, battle, bossTheme, cave, victory, bossfight, victoryShort],
  audioTechnicalNote: 'durationSeconds и RMS/peak в dBFS заполняются браузерным сканером после декодирования. BPM не выводится из длительности или названия. RMS — не LUFS и не оценка воспринимаемой громкости.',
  assets: entries,
}

if (process.argv.includes('--write')) {
  mkdirSync(dirname(catalogPath), { recursive: true })
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
  console.log(`Wrote ${entries.length} licensed candidates to ${catalogPath}`)
} else {
  const current = JSON.parse(readFileSync(catalogPath, 'utf8'))
  if (current.assets.length !== entries.length) throw new Error(`Asset count differs: catalog=${current.assets.length}, files=${entries.length}`)
  const ids = new Set()
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate id ${entry.id}`)
    ids.add(entry.id)
    const saved = current.assets.find(item => item.id === entry.id)
    if (!saved) throw new Error(`Missing catalog record ${entry.id}`)
    for (const key of ['localPath', 'fileSizeBytes', 'sha256Original']) if (saved[key] !== entry[key]) throw new Error(`${entry.id}: ${key} mismatch`)
    if (!saved.sourcePage.startsWith('https://') || !saved.licenseUrl || saved.license !== 'CC0-1.0' && !saved.license.startsWith('CC0-1.0 ')) throw new Error(`${entry.id}: source or license missing/unsupported`)
    if (!saved.redistributablePublicGitHub) throw new Error(`${entry.id}: public redistribution not verified`)
    if (!['mp3', 'ogg', 'wav'].includes(saved.format)) throw new Error(`${entry.id}: unsupported format ${saved.format}`)
    if (saved.durationSeconds !== null && !(saved.durationSeconds > 0)) throw new Error(`${entry.id}: invalid duration`)
    if (saved.bpm !== null && !(saved.bpm > 0)) throw new Error(`${entry.id}: invalid BPM`)
  }
  const extra = current.assets.filter(item => !ids.has(item.id))
  if (extra.length) throw new Error(`Stale entries: ${extra.map(item => item.id).join(', ')}`)
  const totalBytes = entries.reduce((total, entry) => total + entry.fileSizeBytes, 0)
  if (totalBytes > 40 * 1024 * 1024) throw new Error(`Library audio is over 40 MiB: ${totalBytes} bytes`)
  if (entries.some(entry => entry.localPath.endsWith('.zip') || entry.localPath.endsWith('.7z'))) throw new Error('Archive included in library')
  if (current.assets.filter(asset => asset.kind === 'music').some(asset => asset.introEndingAssessment !== 'not-auditioned')) throw new Error('Music intro/outro assessment must remain marked as unauditioned')
  console.log(`PASS ${entries.length} entries, unique IDs, files/hashes, CC0/source fields, format, and ${totalBytes} audio bytes`)
}
