/** Development entry only: real engine journeys, isolated storage, same playable App. */
import { createApp } from 'vue'
import App from './App.vue'
import './assets/fonts.css'
import './assets/tokens.css'
import './assets/main.css'
import { preloadFonts } from './ui/typography'
import { createSectorScene } from './ui/sectorScenes'
import { encodeSnapshot, RUN_SAVE_KEY } from './game/runSave'
import { gameEconomy } from './game/economy'

if (!import.meta.env.DEV) throw new Error('Sector preview is development-only')
const scene = new URLSearchParams(location.search).get('scene') ?? 'forge'
const slot = new URLSearchParams(location.search).get('slot') ?? 'default'
const prefix = `spellwhim.qa.${scene}.${slot}.`
const storage = { getItem: (key: string) => localStorage.getItem(prefix+key), setItem: (key: string, value: string) => localStorage.setItem(prefix+key,value) }
if (!storage.getItem(RUN_SAVE_KEY)) {
  const raw = encodeSnapshot(createSectorScene(scene), gameEconomy, 1)
  storage.setItem(RUN_SAVE_KEY, raw)
  storage.setItem(RUN_SAVE_KEY+'.backup', raw)
}
void preloadFonts()
createApp(App, { saveStorage: storage }).mount('#app')
