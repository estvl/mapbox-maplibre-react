import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/mapbox-maplibre-react/', // replace with your repository name
  plugins: [react()],
  server: {
    proxy: {
      '/ors': {
        target: 'https://api.openrouteservice.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ors/, ''),
      },
    },
  },
});
