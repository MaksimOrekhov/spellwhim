/** Development entry only: real engine journeys, isolated storage, same playable App. */
import { createApp } from 'vue'
import App from './App.vue'
import './assets/fonts.css'
import './assets/tokens.css'
import './assets/main.css'
import { preloadFonts } from './ui/typography'
import { createSectorScene } from './ui/sectorScenes'
import { createMapScene, isMapScene } from './ui/mapScenes'
import { LAB_PARAM, requestedSeed, resolveLaunch, startingDeckFor } from './game/rulesMode'
import { encodeSnapshot } from './game/runSave'
import { gameEconomy } from './game/economy'

if (!import.meta.env.DEV) throw new Error('Sector preview is development-only')
const scene = new URLSearchParams(location.search).get('scene') ?? 'forge'
const slot = new URLSearchParams(location.search).get('slot') ?? 'default'
// The map scenes (`map-start|map-mid|map-end`) play the default game (long Sector I); `&dev-rules=control` gives the short sector.
// The older scenes were built on the former standard game, so they open it: the address gets `dev-rules=control` unless it names rules itself.
const redirecting = !isMapScene(scene) && !new URLSearchParams(location.search).has(LAB_PARAM)
if (redirecting) {
  const next = new URL(location.href)
  next.searchParams.set(LAB_PARAM, 'control')
  location.replace(next)
}
if (!redirecting) {
  const launch = resolveLaunch(location.search, true)
  const rules = launch.mode
  const prefix = `spellwhim.qa.${scene}.${rules.id}.${slot}.`
  const storage = { getItem: (key: string) => localStorage.getItem(prefix+key), setItem: (key: string, value: string) => localStorage.setItem(prefix+key,value) }
  if (!storage.getItem(rules.saveKey)) {
    const economy = rules.economy ?? gameEconomy
    const run = isMapScene(scene) ? createMapScene(scene, economy, startingDeckFor(rules, launch.search), requestedSeed(launch.search) ?? undefined) : createSectorScene(scene)
    const raw = encodeSnapshot(run, economy, 1)
    storage.setItem(rules.saveKey, raw)
    storage.setItem(rules.saveKey+'.backup', raw)
  }
  void preloadFonts()
  createApp(App, { saveStorage: storage }).mount('#app')
}
