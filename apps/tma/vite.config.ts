import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // VITE_* variables come from the repository root .env.
  envDir: '../..',
  server: {
    port: 5174,
    strictPort: true,
    // The dev server is exposed to Telegram through a cloudflared tunnel (ARCHITECTURE.md §3.12).
    allowedHosts: ['.trycloudflare.com'],
    // Same-origin API: one tunnel serves both the Mini App and /api (production: Caddy does the same).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
