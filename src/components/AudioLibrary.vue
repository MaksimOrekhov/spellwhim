<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { audioCandidates, libraryAudioUrl, readRatings, writeRatings } from '../audio/library'
import type { LibraryAsset, Rating } from '../audio/library'

type Section = 'music' | 'sfx'
type MusicRole = 'all' | 'menu' | 'map' | 'battle' | 'elite' | 'boss' | 'victory'
type SfxRole = 'all' | 'warrior' | 'mage' | 'interface' | 'mine' | 'reward' | 'chest'
const section = ref<Section>('music')
const musicRole = ref<MusicRole>('all')
const sfxRole = ref<SfxRole>('all')
const search = ref('')
const ratingFilter = ref<'all' | Rating>('all')
const ratings = ref<Record<string, Rating>>(readRatings(typeof localStorage === 'undefined' ? undefined : localStorage))
const ratingSaved = ref(true)
const notice = ref('')
const playingId = ref<string | null>(null)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playerVolume = ref(.72)
const repeat = ref(false)
const playbackError = ref('')
const audio = new Audio()
audio.preload = 'metadata'

const musicRoles: { id: MusicRole; title: string }[] = [
  { id: 'all', title: 'Все треки' }, { id: 'menu', title: 'Главное меню' }, { id: 'map', title: 'Карта' },
  { id: 'battle', title: 'Обычный бой' }, { id: 'elite', title: 'Элита' }, { id: 'boss', title: 'Рак’Зор' }, { id: 'victory', title: 'Победа' },
]
const sfxRoles: { id: SfxRole; title: string }[] = [
  { id: 'all', title: 'Все категории' }, { id: 'warrior', title: 'Сталь и удары' }, { id: 'mage', title: 'Магия' },
  { id: 'interface', title: 'Интерфейс и карты' }, { id: 'reward', title: 'Награды' }, { id: 'chest', title: 'Замки и двери' }, { id: 'mine', title: 'Мёртвые копи' },
]
const roleTitles: Record<string, string> = {
  menu: 'Меню', map: 'Карта', battle: 'Обычный бой', elite: 'Элита', boss: 'Рак’Зор', victory: 'Победа',
  warrior: 'Сталь', mage: 'Магия', interface: 'Интерфейс', reward: 'Награды', chest: 'Сундуки', mine: 'Копи', weapon: 'Оружие', impact: 'Удар', card: 'Карты', ambience: 'Атмосфера', magic: 'Разряд',
}
const current = computed(() => audioCandidates.find(asset => asset.id === playingId.value))
const music = computed(() => audioCandidates.filter(asset => asset.kind === 'music'))
const sfx = computed(() => audioCandidates.filter(asset => asset.kind === 'sfx'))
const visibleAssets = computed(() => {
  const collection = section.value === 'music' ? music.value : sfx.value
  const role = section.value === 'music' ? musicRole.value : sfxRole.value
  const term = search.value.trim().toLocaleLowerCase('ru')
  return collection.filter(asset =>
    (role === 'all' || asset.roles.includes(role)) &&
    (!term || `${asset.title} ${asset.author} ${asset.note} ${asset.id}`.toLocaleLowerCase('ru').includes(term)) &&
    (ratingFilter.value === 'all' || ratings.value[asset.id] === ratingFilter.value))
})
const musicVisible = computed(() => visibleAssets.value.filter(asset => asset.kind === 'music'))
const sfxVisible = computed(() => visibleAssets.value.filter(asset => asset.kind === 'sfx'))
const ratedAssets = computed(() => audioCandidates.filter(asset => ratings.value[asset.id]))
const formattedTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '—:—'
  const value = Math.floor(seconds)
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}
const formatBytes = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`
const formatRms = (asset: LibraryAsset) => asset.rmsDbfs == null ? 'измеряется браузером' : `${asset.rmsDbfs.toFixed(1)} dBFS RMS`
const loopText = (asset: LibraryAsset) => asset.loop.status === 'source-claimed' ? 'Автор указывает loop; шов не проверен' : 'Повтор не проверен'

function updateRating(asset: LibraryAsset, value: string) {
  if (value === 'like' || value === 'maybe' || value === 'nope') ratings.value[asset.id] = value
  else delete ratings.value[asset.id]
  ratingSaved.value = writeRatings(typeof localStorage === 'undefined' ? undefined : localStorage, ratings.value)
}
async function copyRatings() {
  const text = ratedAssets.value.map(asset => `${ratings.value[asset.id]}\t${asset.id}\t${asset.title}`).join('\n')
  try {
    await navigator.clipboard.writeText(text || 'Нет оценённых кандидатов')
    notice.value = `Скопировано: ${ratedAssets.value.length}`
  } catch { notice.value = 'Буфер обмена недоступен; отметки остаются сохранены в этом браузере.' }
  window.setTimeout(() => { notice.value = '' }, 3000)
}
function playAsset(asset: LibraryAsset) {
  playbackError.value = ''
  if (playingId.value === asset.id && !audio.paused) { audio.pause(); playing.value = false; return }
  if (playingId.value !== asset.id) {
    audio.pause()
    audio.currentTime = 0
    const url = libraryAudioUrl(asset)
    if (!url) { playbackError.value = 'Локальный файл не найден в каталоге.'; return }
    audio.src = url
    playingId.value = asset.id
    currentTime.value = 0
    duration.value = asset.durationSeconds ?? 0
  }
  audio.volume = playerVolume.value
  audio.loop = repeat.value
  void audio.play().then(() => { playing.value = true }).catch(() => { playing.value = false; playbackError.value = 'Не удалось открыть этот файл в браузере.' })
}
function stopPlayback() { audio.pause(); audio.currentTime = 0; playing.value = false; currentTime.value = 0 }
function seek(value: string) { const next = Number(value); if (Number.isFinite(next) && duration.value > 0) { audio.currentTime = duration.value * next; currentTime.value = audio.currentTime } }
function setVolume(value: string) { const next = Number(value); if (Number.isFinite(next)) { playerVolume.value = Math.max(0, Math.min(1, next)); audio.volume = playerVolume.value } }
function setRepeat(value: boolean) { repeat.value = value; audio.loop = value }
function onTimeUpdate() { currentTime.value = audio.currentTime; if (Number.isFinite(audio.duration)) duration.value = audio.duration }
function onMetadata() { if (Number.isFinite(audio.duration)) duration.value = audio.duration }
function onEnded() { playing.value = false }
function onError() { playing.value = false; playbackError.value = 'Файл не декодировался.' }

onMounted(() => {
  audio.addEventListener('timeupdate', onTimeUpdate)
  audio.addEventListener('loadedmetadata', onMetadata)
  audio.addEventListener('durationchange', onMetadata)
  audio.addEventListener('ended', onEnded)
  audio.addEventListener('error', onError)
  if (import.meta.env.DEV) {
    ;(window as unknown as { __audioLibrary?: unknown }).__audioLibrary = {
      assets: audioCandidates,
      play: (id: string) => { const asset = audioCandidates.find(entry => entry.id === id); if (asset) playAsset(asset) },
      player: () => ({ id: playingId.value, paused: audio.paused, currentSrc: audio.currentSrc, currentTime: audio.currentTime, duration: audio.duration, volume: audio.volume, loop: audio.loop }),
      ratings: () => ({ ...ratings.value }),
      analyzeAll: async () => {
        const context = new AudioContext()
        const output: Record<string, { durationSeconds: number; rmsDbfs: number; peakDbfs: number }> = {}
        try {
          for (const asset of audioCandidates) {
            const url = libraryAudioUrl(asset)
            if (!url) throw new Error(`${asset.id}: local file URL is missing`)
            const response = await fetch(url)
            if (!response.ok) throw new Error(`${asset.id}: HTTP ${response.status}`)
            const decoded = await context.decodeAudioData(await response.arrayBuffer())
            let square = 0, peak = 0, count = 0
            for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
              const samples = decoded.getChannelData(channel)
              for (let i = 0; i < samples.length; i++) { const sample = samples[i]!; square += sample * sample; peak = Math.max(peak, Math.abs(sample)); count++ }
            }
            output[asset.id] = {
              durationSeconds: Number(decoded.duration.toFixed(3)),
              rmsDbfs: Number((20 * Math.log10(Math.sqrt(square / Math.max(1, count)) || 1e-9)).toFixed(2)),
              peakDbfs: Number((20 * Math.log10(peak || 1e-9)).toFixed(2)),
            }
          }
        } finally { await context.close() }
        return output
      },
    }
  }
})
onUnmounted(() => {
  stopPlayback()
  audio.removeEventListener('timeupdate', onTimeUpdate)
  audio.removeEventListener('loadedmetadata', onMetadata)
  audio.removeEventListener('durationchange', onMetadata)
  audio.removeEventListener('ended', onEnded)
  audio.removeEventListener('error', onError)
  if (import.meta.env.DEV) delete (window as unknown as { __audioLibrary?: unknown }).__audioLibrary
})
</script>

<template>
  <main class="audio-library">
    <header class="library-header">
      <div>
        <a class="back-link" href="/">← Spellwhim</a>
        <p class="eyebrow">ВНУТРЕННИЙ ИНСТРУМЕНТ · ВЕТКА AUDIO ASSET DISCOVERY</p>
        <h1>Фонотека кандидатов</h1>
        <p class="intro">Прослушивай по одному, сравнивай роли и сохраняй собственную оценку. Ни один кандидат пока не подключён к боевой звуковой системе.</p>
      </div>
      <div class="summary" aria-label="Размер библиотеки">
        <span><strong>{{ music.length }}</strong> треков</span>
        <span><strong>{{ sfx.length }}</strong> SFX</span>
        <span><strong>{{ formatBytes(audioCandidates.reduce((sum, item) => sum + item.fileSizeBytes, 0)) }}</strong> файлов</span>
      </div>
    </header>

    <section class="toolbar" aria-label="Каталог аудио">
      <div class="section-switch" role="tablist" aria-label="Тип аудио">
        <button type="button" role="tab" :aria-selected="section === 'music'" @click="section = 'music'">Музыка <span>{{ music.length }}</span></button>
        <button type="button" role="tab" :aria-selected="section === 'sfx'" @click="section = 'sfx'">Эффекты <span>{{ sfx.length }}</span></button>
      </div>
      <div class="filters">
        <div class="role-filters" :aria-label="section === 'music' ? 'Ситуация' : 'Категория'">
          <template v-if="section === 'music'">
            <button v-for="role in musicRoles" :key="role.id" type="button" :class="{ active: musicRole === role.id }" @click="musicRole = role.id">{{ role.title }}</button>
          </template>
          <template v-else>
            <button v-for="role in sfxRoles" :key="role.id" type="button" :class="{ active: sfxRole === role.id }" @click="sfxRole = role.id">{{ role.title }}</button>
          </template>
        </div>
        <div class="filter-tools">
          <label class="search-label"><span>Поиск</span><input v-model="search" type="search" placeholder="Название, автор, ID" /></label>
          <label class="rating-label"><span>Оценка</span><select v-model="ratingFilter"><option value="all">Все</option><option value="like">Нравится</option><option value="maybe">Под вопросом</option><option value="nope">Не подходит</option></select></label>
          <button class="copy-button" type="button" @click="copyRatings">Скопировать отмеченные · {{ ratedAssets.length }}</button>
        </div>
      </div>
    </section>

    <div class="catalog-note">
      <strong>Кандидаты, не финальный выбор.</strong>
      Метаданные и уровень сигнала измерены технически. Codex не прослушивал композиции и не выставлял субъективные оценки; финальный отбор делай по звуку.
    </div>

    <section v-if="section === 'music'" class="asset-grid" aria-label="Музыкальные кандидаты">
      <article v-for="asset in musicVisible" :key="asset.id" class="asset-card music-card" :class="{ 'is-playing': playingId === asset.id && playing }">
        <div class="card-top">
          <span class="file-kind">{{ asset.format.toUpperCase() }} · {{ formatBytes(asset.fileSizeBytes) }}</span>
          <button class="play-button" type="button" :aria-label="playingId === asset.id && playing ? 'Пауза ' + asset.title : 'Играть ' + asset.title" @click="playAsset(asset)">{{ playingId === asset.id && playing ? 'Ⅱ Пауза' : '▶ Слушать' }}</button>
        </div>
        <h2>{{ asset.title }}</h2>
        <p class="author">{{ asset.author }}</p>
        <p class="asset-note">{{ asset.note }}</p>
        <div class="facts">
          <span>Длительность <b>{{ asset.durationSeconds ? formattedTime(asset.durationSeconds) : 'читается при воспроизведении' }}</b></span>
          <span>BPM <b>{{ asset.bpm ?? 'не подтверждён' }}</b></span>
          <span>Сигнал <b>{{ formatRms(asset) }}</b></span>
          <span>Петля <b>{{ loopText(asset) }}</b></span>
          <span>Вступление/конец <b>не оценены на слух</b></span>
        </div>
        <div class="tags"><span v-for="role in asset.roles" :key="role">{{ roleTitles[role] ?? role }}</span></div>
        <div class="card-foot">
          <a :href="asset.sourcePage" target="_blank" rel="noreferrer">Источник · {{ asset.license }}</a>
          <label class="rating-control"><span>Оценка</span><select :value="ratings[asset.id] ?? ''" :aria-label="'Оценка: ' + asset.title" @change="updateRating(asset, ($event.target as HTMLSelectElement).value)"><option value="">Не оценено</option><option value="like">Нравится</option><option value="maybe">Под вопросом</option><option value="nope">Не подходит</option></select></label>
        </div>
        <code class="asset-id">{{ asset.id }}</code>
      </article>
      <p v-if="!musicVisible.length" class="empty-state">По этим условиям музыкальных кандидатов нет.</p>
    </section>

    <section v-else class="asset-grid sfx-grid" aria-label="Кандидаты звуковых эффектов">
      <article v-for="asset in sfxVisible" :key="asset.id" class="asset-card sfx-card" :class="{ 'is-playing': playingId === asset.id && playing }">
        <div class="card-top">
          <span class="file-kind">{{ asset.format.toUpperCase() }} · {{ formatBytes(asset.fileSizeBytes) }}</span>
          <button class="play-button compact" type="button" :aria-label="playingId === asset.id && playing ? 'Пауза ' + asset.title : 'Играть ' + asset.title" @click="playAsset(asset)">{{ playingId === asset.id && playing ? 'Ⅱ' : '▶' }} {{ playingId === asset.id && playing ? 'Пауза' : 'Прослушать' }}</button>
        </div>
        <h2>{{ asset.title }}</h2>
        <p class="asset-note">{{ asset.note }}</p>
        <div class="sfx-meta"><span>{{ asset.author }}</span><span>{{ asset.durationSeconds ? formattedTime(asset.durationSeconds) : 'длительность при декодировании' }}</span></div>
        <div class="card-foot">
          <a :href="asset.sourcePage" target="_blank" rel="noreferrer">{{ asset.sourceTitle }} · CC0</a>
          <label class="rating-control"><span>Оценка</span><select :value="ratings[asset.id] ?? ''" :aria-label="'Оценка: ' + asset.title" @change="updateRating(asset, ($event.target as HTMLSelectElement).value)"><option value="">—</option><option value="like">Нравится</option><option value="maybe">Вопрос</option><option value="nope">Нет</option></select></label>
        </div>
        <code class="asset-id">{{ asset.id }}</code>
      </article>
      <p v-if="!sfxVisible.length" class="empty-state">По этим условиям эффектов нет.</p>
    </section>

    <aside class="player-dock" aria-label="Текущий аудиоплеер">
      <div class="now-playing">
        <span class="player-label">СЕЙЧАС ИГРАЕТ</span>
        <strong>{{ current?.title ?? 'Выбери кандидата выше' }}</strong>
        <span>{{ current?.author ?? 'Одновременно играет не больше одного файла' }}</span>
      </div>
      <button class="stop-button" type="button" :disabled="!current" @click="stopPlayback">■ Стоп</button>
      <div class="seek-group">
        <span>{{ formattedTime(currentTime) }}</span>
        <input aria-label="Позиция воспроизведения" type="range" min="0" max="1" step="0.001" :value="duration ? currentTime / duration : 0" :disabled="!current || !duration" @input="seek(($event.target as HTMLInputElement).value)" />
        <span>{{ formattedTime(duration) }}</span>
      </div>
      <label class="dock-volume"><span>Громкость</span><input aria-label="Громкость кандидата" type="range" min="0" max="1" step="0.01" :value="playerVolume" @input="setVolume(($event.target as HTMLInputElement).value)" /></label>
      <label class="loop-control"><input type="checkbox" :checked="repeat" @change="setRepeat(($event.target as HTMLInputElement).checked)" /><span>Повтор</span></label>
      <span v-if="playbackError" class="player-error" role="status">{{ playbackError }}</span>
      <span v-else-if="!ratingSaved" class="player-error" role="status">Оценки не удалось сохранить в localStorage.</span>
      <span v-else-if="notice" class="player-notice" role="status">{{ notice }}</span>
    </aside>
  </main>
</template>

<style scoped>
.audio-library{min-height:100vh;padding:28px clamp(28px,4vw,88px) 148px;color:var(--ink);background:linear-gradient(135deg,var(--wood-0),var(--scene-0));font:var(--fs-md)/var(--lh-body) var(--font-ui)}
.library-header{display:flex;justify-content:space-between;align-items:end;gap:36px;max-width:1920px;margin:0 auto 30px;padding:8px 4px 26px;border-bottom:var(--border-soft)}
.back-link{color:var(--gold);text-decoration:none;font-weight:800}.eyebrow{margin:22px 0 5px;color:var(--brass-1);font-size:var(--fs-xs);font-weight:900;letter-spacing:var(--ls-caps)}
h1{margin:0;font:700 clamp(34px,3vw,54px)/1.05 var(--font-display);color:var(--parch-1)}.intro{max-width:900px;margin:12px 0 0;color:var(--muted);font-size:var(--fs-lg)}
.summary{display:flex;gap:22px;flex-shrink:0;color:var(--muted)}.summary span{display:grid;gap:4px;text-align:center;font-size:var(--fs-sm)}.summary strong{font:700 25px/1 var(--font-num);color:var(--gold)}
.toolbar,.catalog-note,.asset-grid{max-width:1920px;margin-right:auto;margin-left:auto}.toolbar{display:flex;align-items:stretch;gap:18px;margin-bottom:18px}
.section-switch{display:flex;flex-direction:column;gap:7px;flex:0 0 185px}.section-switch button{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:var(--border-soft);border-radius:var(--shape-scroll);color:var(--muted);background:var(--mat-wood);font:700 var(--fs-md)/1.2 var(--font-ui);cursor:pointer}.section-switch button[aria-selected="true"]{border-color:var(--brass-2);color:var(--parch-1);background:var(--wood-2);box-shadow:inset 3px 0 0 var(--gold)}.section-switch span{color:var(--gold);font:700 var(--fs-sm) var(--font-num)}
.filters{display:grid;flex:1;gap:12px;min-width:0}.role-filters{display:flex;flex-wrap:wrap;gap:7px}.role-filters button{padding:8px 12px;border:var(--border-soft);border-radius:var(--shape-chip);color:var(--muted);background:var(--wood-1);font:600 var(--fs-sm) var(--font-ui);cursor:pointer}.role-filters button.active{border-color:var(--brass-2);color:var(--brass-1);background:var(--wood-2)}
.filter-tools{display:flex;align-items:end;gap:12px}.filter-tools label{display:grid;gap:4px;color:var(--text-dim);font-size:var(--fs-xs);font-weight:700}.filter-tools input,.filter-tools select,.rating-control select{min-height:36px;padding:5px 10px;border:var(--border-soft);border-radius:var(--shape-chip);color:var(--ink);background:var(--wood-1);font:600 var(--fs-sm) var(--font-ui)}.search-label{flex:1;max-width:440px}.search-label input{width:100%}.copy-button{min-height:38px;padding:6px 14px;border:var(--border-brass);border-radius:var(--shape-chip);color:var(--parch-1);background:var(--wood-2);font:700 var(--fs-sm) var(--font-ui);cursor:pointer}
.catalog-note{display:flex;gap:8px;align-items:baseline;margin-bottom:18px;padding:11px 14px;border-left:3px solid var(--gold);border-radius:var(--shape-chip);color:var(--muted);background:var(--scene-1);font-size:var(--fs-sm)}.catalog-note strong{flex:none;color:var(--brass-1)}
.asset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.asset-card{display:flex;flex-direction:column;min-width:0;padding:17px 18px 14px;border:var(--border-soft);border-radius:var(--shape-scroll);background:var(--mat-wood);box-shadow:var(--shadow-1)}.asset-card.is-playing{border-color:var(--brass-2);box-shadow:var(--glow-bonus),var(--shadow-2)}.card-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.file-kind{color:var(--text-dim);font:700 var(--fs-xs) var(--font-num);letter-spacing:.04em}.play-button{min-height:35px;padding:6px 13px;border:var(--border-brass);border-radius:var(--shape-plank);color:var(--parch-ink);background:var(--mat-brass);font:800 var(--fs-sm) var(--font-ui);cursor:pointer}.play-button.compact{min-width:122px}
h2{margin:12px 0 2px;color:var(--parch-1);font:700 23px/1.16 var(--font-display)}.author{margin:0;color:var(--brass-1);font-size:var(--fs-sm)}.asset-note{min-height:48px;margin:12px 0;color:var(--muted);font-size:var(--fs-sm);line-height:var(--lh-body)}.facts{display:grid;grid-template-columns:1fr 1fr;gap:7px 10px;padding:10px 0;border-top:var(--border-soft);border-bottom:var(--border-soft)}.facts span{display:flex;flex-direction:column;gap:2px;color:var(--text-dim);font-size:var(--fs-xs)}.facts b{color:var(--muted);font-size:var(--fs-xs);font-weight:700}.tags{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 8px}.tags span{padding:3px 7px;border:var(--border-soft);border-radius:var(--shape-chip);color:var(--brass-1);font-size:var(--fs-xs)}
.card-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:auto;padding-top:10px}.card-foot>a{overflow:hidden;color:var(--gold);font-size:var(--fs-xs);text-overflow:ellipsis;white-space:nowrap}.rating-control{display:flex;align-items:center;gap:6px;color:var(--text-dim);font-size:var(--fs-xs)}.rating-control select{max-width:142px;min-height:32px;padding:4px 8px}.asset-id{display:block;margin-top:8px;color:var(--text-dim);font-size:10px}
.sfx-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.sfx-card{padding:14px 15px 12px}.sfx-card h2{font-size:20px}.sfx-card .asset-note{min-height:42px;margin:8px 0}.sfx-meta{display:flex;justify-content:space-between;gap:8px;color:var(--text-dim);font-size:var(--fs-xs)}.sfx-card .card-foot{padding-top:8px}.sfx-card .rating-control>span{display:none}
.empty-state{grid-column:1/-1;padding:40px;text-align:center;color:var(--muted)}
.player-dock{position:fixed;z-index:20;right:0;bottom:0;left:0;display:grid;grid-template-columns:minmax(210px,1.1fr) 95px minmax(220px,1.6fr) minmax(160px,.85fr) 105px auto;align-items:center;gap:18px;padding:15px clamp(24px,4vw,82px);border-top:var(--border-brass);background:var(--wood-0);box-shadow:var(--shadow-3)}.now-playing{display:grid;min-width:0;gap:2px}.player-label{color:var(--gold);font-size:var(--fs-2xs);font-weight:900;letter-spacing:var(--ls-caps)}.now-playing strong{overflow:hidden;color:var(--parch-1);font:700 19px/1.2 var(--font-display);text-overflow:ellipsis;white-space:nowrap}.now-playing>span:last-child{overflow:hidden;color:var(--text-dim);font-size:var(--fs-xs);text-overflow:ellipsis;white-space:nowrap}.stop-button{min-height:36px;border:var(--border-soft);border-radius:var(--shape-plank);color:var(--ink);background:var(--wood-2);font:700 var(--fs-sm) var(--font-ui);cursor:pointer}.stop-button:disabled{opacity:.45;cursor:default}.seek-group{display:grid;grid-template-columns:40px 1fr 40px;align-items:center;gap:8px;color:var(--muted);font:600 var(--fs-xs) var(--font-num)}.seek-group input,.dock-volume input{width:100%;accent-color:var(--gold)}.dock-volume{display:grid;gap:2px;color:var(--muted);font-size:var(--fs-xs)}.loop-control{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:var(--fs-xs);white-space:nowrap}.loop-control input{accent-color:var(--gold)}.player-error,.player-notice{grid-column:1/-1;margin-top:-10px;color:var(--c-threat);font-size:var(--fs-xs)}.player-notice{color:var(--brass-1)}
</style>
