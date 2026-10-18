import { createApp } from 'vue'
import TokenPreview from './components/TokenPreview.vue'
import './assets/fonts.css'
import './assets/tokens.css'
import './assets/main.css'
import { preloadFonts } from './ui/typography'

// Dev-only gallery of the design tokens (like card-preview.html): npm run dev → /tokens-preview.html
void preloadFonts().then(() => createApp(TokenPreview).mount('#app'))
