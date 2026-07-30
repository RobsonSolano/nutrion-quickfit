import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const core = (p: string) => fileURLToPath(new URL(`../../packages/core/src/${p}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@quickfit/core/engine': core('engine/index.ts'),
      '@quickfit/core/catalog': core('catalog/schema.ts'),
      '@quickfit/core/theme': core('theme/index.ts'),
    },
  },
  // O core é fonte TypeScript, não um pacote publicado. Sem isto o Vite
  // tenta pré-empacotá-lo e falha ao encontrar o build.
  optimizeDeps: { exclude: ['@quickfit/core'] },
  server: { port: 5173 },
  preview: { port: 4173 },
});
