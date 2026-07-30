import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const core = (p: string) =>
  fileURLToPath(new URL(`./packages/core/src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@quickfit/core/engine': core('engine/index.ts'),
      '@quickfit/core/catalog': core('catalog/schema.ts'),
      '@quickfit/core/theme': core('theme/index.ts'),
    },
  },
  test: {
    // `node` porque o motor não precisa de DOM. O que precisa (cache em
    // localStorage) recebe stub via vi.stubGlobal nos próprios testes.
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
