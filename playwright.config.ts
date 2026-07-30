import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    // O Chromium próprio do Playwright não tem o binário `headless_shell`
    // baixado nesta máquina (só a variante completa seria baixada por
    // `npx playwright install chromium`, que esta task não deve rodar).
    // `channel: 'chrome'` usa o Google Chrome já instalado no sistema.
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },   // proporção de totem
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
