import { defineConfig } from 'vite';

export default defineConfig({
  base: '/SBW_IFCChecker/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html'
    }
  }
});
