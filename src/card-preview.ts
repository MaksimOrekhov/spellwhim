import { createApp } from 'vue'
import HandLab from './components/HandLab.vue'
import VfxLab from './components/VfxLab.vue'
import './assets/fonts.css'
import './assets/tokens.css'
import './assets/main.css'
import { preloadFonts } from './ui/typography'

// Dev-only labs: npm run dev → /card-preview.html?hand=10&bonus=1 (hand lab), /card-preview.html?view=vfx&fx=fireball (battle effects lab)
const view = new URLSearchParams(window.location.search).get('view')
void preloadFonts().then(() => createApp(view === 'vfx' ? VfxLab : HandLab).mount('#app'))
