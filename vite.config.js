import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Shared between dev (server) and prod-preview so config never drifts.
const PORT = 3003;
const ALLOWED_HOSTS = ['client.bacnet.tools.thefusionapps.com'];
const PROXY = {
  '/api': {
    target: 'https://bacnet.tools.thefusionapps.com',
    changeOrigin: true,
    secure: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: PORT,
    open: false,
    allowedHosts: ALLOWED_HOSTS,
    proxy: PROXY,
  },
  // `vite preview` serves the built dist/ (minified) — production serving.
  preview: {
    host: true,
    port: PORT,
    allowedHosts: ALLOWED_HOSTS,
    proxy: PROXY,
  },
});
