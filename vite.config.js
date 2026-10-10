import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths, so the build works under /openClockClock24/ on GitHub Pages.
  base: './',
  build: {
    chunkSizeWarningLimit: 800, // three.js
  },
})
