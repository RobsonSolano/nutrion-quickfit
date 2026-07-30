import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const core = (p: string) => fileURLToPath(new URL(`../../packages/core/src/${p}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // .env.local vive na raiz do monorepo (é lá que `seed:catalog` e os outros
  // scripts node o leem via --env-file). Sem isto o Vite procura env vars em
  // apps/totem/ e não acha nada: o cliente supabase.ts lança no import,
  // antes até do React montar — nenhum error boundary pega isso.
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
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
