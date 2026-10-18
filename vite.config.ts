import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  // Vitest blanks CSS modules by default; the font/token guard tests read these two files as raw text.
  test: { css: { include: [/assets\/(fonts|tokens)\.css/] } },
})
