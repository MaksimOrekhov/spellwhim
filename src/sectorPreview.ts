/** Development entry only: real engine journeys, isolated storage, same playable App. */
import { createApp } from 'vue'
import App from './App.vue'
import './assets/fonts.css'
import './assets/tokens.css'
import './assets/main.css'
import { preloadFonts } from './ui/typography'
import { createSectorScene } from './ui/sectorScenes'
import { createMapScene, isMapScene } from './ui/mapScenes'
import { requestedSeed, resolveRulesMode, startingDeckFor } from './game/rulesMode'
import { encodeSnapshot } from './game/runSave'
import { gameEconomy } from './game/economy'

if (!import.meta.env.DEV) throw new Error('Sector preview is development-only')
const scene = new URLSearchParams(location.search).get('scene') ?? 'forge'
const slot = new URLSearchParams(location.search).get('slot') ?? 'default'
// Map scenes (`map-start|map-mid|map-end`) follow `?rules=` (e.g. honest-b2-long) and `?seed=`; the other scenes stay in the standard game.
const mapScene = isMapScene(scene)
const rules = mapScene ? resolveRulesMode(location.search) : resolveRulesMode('')
const prefix = `spellwhim.qa.${scene}.${rules.id}.${slot}.`
const storage = { getItem: (key: string) => localStorage.getItem(prefix+key), setItem: (key: string, value: string) => localStorage.setItem(prefix+key,value) }
if (!storage.getItem(rules.saveKey)) {
  const economy = rules.economy ?? gameEconomy
  const run = isMapScene(scene) ? createMapScene(scene, economy, startingDeckFor(rules, location.search), requestedSeed(location.search) ?? undefined) : createSectorScene(scene)
  const raw = encodeSnapshot(run, economy, 1)
  storage.setItem(rules.saveKey, raw)
  storage.setItem(rules.saveKey+'.backup', raw)
}
void preloadFonts()
createApp(App, { saveStorage: storage }).mount('#app')
