import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// El navegador solo habla con /graphql (mismo origen). Vite lo reenvía al
// backend, incluido el upgrade a WebSocket de las subscriptions.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/graphql': {
        target: process.env.VITE_BACKEND_URL ?? 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
