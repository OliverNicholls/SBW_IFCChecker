import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  base: process.env.NODE_ENV === 'production' ? '/SBW_IFCChecker/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html'
    }
  }
});
