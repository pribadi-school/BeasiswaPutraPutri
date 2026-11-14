import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // `npm run dev:server`: /api diteruskan ke server Node.js lokal (`npm run server`).
    proxy: { '/api': 'http://localhost:8787' },
  },
});
