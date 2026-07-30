import { test, expect } from '@playwright/test';

test('caminho felizeu: 3 toques até o treino, e a ficha imprime com todos os exercícios', async ({ page }) => {
  await page.goto('/');

  // 1
  await page.getByRole('button', { name: 'Toque para começar' }).click();
  // 2
  await page.getByRole('button', { name: /nenhuma das anteriores/i }).click();
  // 3
  await page.getByRole('button', { name: /peito \+ tríceps/i }).click();

  await expect(page.getByText(/montando seu treino/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /imprimir ficha/i })).toBeVisible({ timeout: 10_000 });

  // O treino tem exercícios de verdade
  const linhas = page.locator('[class*="border-l-4"]');
  const numExercicios = await linhas.count();
  expect(numExercicios).toBeGreaterThanOrEqual(3);

  // Ficha: todos os exercícios no papel (cupom, não tabela A4 — task 16), rodapé CREF presente
  await page.getByRole('button', { name: /imprimir ficha/i }).click();
  await expect(page.getByText(/homologada por/i)).toBeVisible();

  const linhasTela = await page.locator('.qf-sheet .ex').count();
  expect(linhasTela).toBe(numExercicios);
});

test('"Treino rápido" pede o tempo: 4 toques, escada curta, sem pergunta de nível', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toque para começar' }).click();
  await page.getByRole('button', { name: /nenhuma das anteriores/i }).click();
  await page.getByRole('button', { name: /treino rápido/i }).click();

  // Escada curta: 20/30/40/50, e nada de 60 ou 90 — ninguém chama isso de rápido
  await expect(page.getByRole('button', { name: '40 min' })).toBeVisible();
  await expect(page.getByRole('button', { name: '60 min' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '90 min' })).toHaveCount(0);

  await page.getByRole('button', { name: '40 min' }).click();

  // Vai direto para o treino: no atalho não há passo de nível
  await expect(page.getByRole('button', { name: /^Iniciante/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /imprimir ficha/i })).toBeVisible({ timeout: 10_000 });
});

test('PAR-Q reprovado encaminha ao professor e NÃO gera treino', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toque para começar' }).click();
  await page.getByRole('button', { name: /dor no peito/i }).click();

  await expect(page.getByText(/fale com o professor da unidade/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /imprimir ficha/i })).toHaveCount(0);
});

test('montar do zero com 90 min não passa de 9 exercícios', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toque para começar' }).click();
  await page.getByRole('button', { name: /nenhuma das anteriores/i }).click();
  await page.getByRole('button', { name: /montar do zero/i }).click();
  await page.getByRole('button', { name: /emagrecer/i }).click();

  for (const g of ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas']) {
    await page.getByRole('button', { name: new RegExp(`^${g}`) }).click();
  }
  await page.getByRole('button', { name: /continuar com 6 grupos/i }).click();
  await page.getByRole('button', { name: '90 min' }).click();
  await page.getByRole('button', { name: /^Avançado/ }).click();
  await page.getByRole('button', { name: /continuar sem restrições/i }).click();

  await expect(page.getByRole('button', { name: /imprimir ficha/i })).toBeVisible({ timeout: 10_000 });
  const linhas = await page.locator('[class*="border-l-4"]').count();
  expect(linhas).toBeLessThanOrEqual(9);   // era 19 antes do teto
});
