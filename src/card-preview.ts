import { createApp } from 'vue'
import HandLab from './components/HandLab.vue'
import './assets/fonts.css'
import './assets/tokens.css'
import './assets/main.css'
import { preloadFonts } from './ui/typography'

// Dev-only hand lab: npm run dev → /card-preview.html?hand=10&bonus=1
void preloadFonts().then(() => createApp(HandLab).mount('#app'))
