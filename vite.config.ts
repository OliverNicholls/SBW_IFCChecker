import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'StreamBIMIDSChecker',
      fileName: (format) => `streambim-ids-checker.${format === 'es' ? 'js' : 'umd.js'}`
    },
    rollupOptions: {
      external: ['streambim-widget-api'],
      output: {
        globals: {
          'streambim-widget-api': 'StreamBIMWidget'
        }
      }
    }
  }
});
