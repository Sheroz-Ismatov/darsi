import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // VITE_* variables come from the repository root .env.
  envDir: '../..',
  // allowedHosts: the dev server is exposed to Telegram through a cloudflared tunnel (ARCHITECTURE.md §3.12).
  server: { port: 5174, strictPort: true, allowedHosts: ['.trycloudflare.com'] },
});
