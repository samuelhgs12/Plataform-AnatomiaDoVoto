import { test, expect, type Page } from '@playwright/test';

const PAGINAS = ['/', '/analises', '/analises/financiamento', '/analises/legenda', '/sobre'];

/** Opacidade de cada bloco que se revela; nenhum pode ficar escondido. */
const opacidades = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('.bloco, .card, [data-revelar]')].map((el) => Number(getComputedStyle(el).opacity)));

for (const caminho of PAGINAS) {
  test(`${caminho}: todo bloco aparece depois de rolar a página`, async ({ page }) => {
    await page.goto(caminho);
    const altura = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= altura; y += 400) await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await expect.poll(async () => Math.min(...(await opacidades(page))), { timeout: 5000 }).toBe(1);
  });
}

test('com "reduzir movimento", nada começa escondido', async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(Math.min(...(await opacidades(page)))).toBe(1);
  await page.close();
});
