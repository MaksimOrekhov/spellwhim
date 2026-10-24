import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  // Vitest blanks CSS modules by default; the font/token guard tests read these two files as raw text.
  test: {
    css: { include: [/assets\/(fonts|tokens)\.css/] },
    // Component tests that mount with a custom renderer (no DOM library in the project) need the client compile of the SFC (MainMenu), not the server one.
    testTransformMode: { web: ['**/components/MainMenu.vue', '**/components/*.test.ts'] },
  },
})
