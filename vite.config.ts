import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        // page d'accueil (landing) servie a /
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // le jeu, deplace sous /game/
        game: fileURLToPath(new URL('./game/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
