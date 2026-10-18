import { createApp } from 'vue'
import App from './App.vue'
import './assets/fonts.css'
import './assets/tokens.css'
import './assets/main.css'
import { preloadFonts } from './ui/typography'

// Fonts are bundled locally; wait briefly so the first frame (and PixiJS text) does not flash a fallback face.
void preloadFonts().then(() => createApp(App).mount('#app'))
