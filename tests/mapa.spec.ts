import { test, expect } from '@playwright/test';

test('mapa da página inicial: escolher estado, indicador e ano', async ({ page }) => {
  await page.goto('/');
  const mapa = page.getByRole('group', { name: /por estado/ });
  await expect(mapa).toBeVisible();
  await expect(mapa.getByRole('link')).toHaveCount(6); // só os 6 estados do recorte são clicáveis

  await mapa.getByRole('link', { name: /^Minas Gerais:/ }).click();
  await expect(page).toHaveURL(/uf=MG/);
  await expect(page.getByRole('heading', { name: /^Minas Gerais em \d{4}$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Financiamento' })).toHaveAttribute('href', /\/analises\/financiamento\?uf=MG/);

  await page.getByRole('group', { name: 'Indicador' }).getByRole('link', { name: 'Votos só no partido' }).click();
  await expect(page.getByRole('heading', { name: /^Votos só no partido em \d{4}$/ })).toBeVisible();
  await expect(page).toHaveURL(/uf=MG/); // troca de indicador mantém o estado

  await page.getByRole('group', { name: 'Ano da eleição' }).getByRole('link', { name: '2022' }).click();
  await expect(page.getByRole('heading', { name: 'Votos só no partido em 2022' })).toBeVisible();
});

test('parâmetros inválidos voltam ao padrão', async ({ page }) => {
  await page.goto('/?indicador=xyz&ano=1900&uf=SP');
  await expect(page.getByRole('heading', { name: /^Dinheiro público nas campanhas em \d{4}$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /em \d{4}$/, level: 3 })).toHaveCount(0); // SP fora do recorte: sem painel
});
