import { defineConfig } from 'vite';
export default defineConfig({ server: { proxy: { '/api/search': { target: 'http://127.0.0.1:4173', changeOrigin: true } } } });
