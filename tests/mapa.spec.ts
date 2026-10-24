import { test, expect } from '@playwright/test';

test('mapa da abstenção: estado, município, indicador e ano', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' }); // o clique no mapa precisa da página hidratada (navegação sem recarregar)
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2012' })).toBeVisible();
  const mapa = page.getByRole('group', { name: /nos seis estados/ });
  await expect(mapa.getByRole('link')).toHaveCount(6); // só os 6 estados do recorte são clicáveis

  await mapa.getByRole('link', { name: /^Pernambuco:/ }).click();
  await expect(page).toHaveURL(/uf=PE/);
  await expect(page.getByRole('heading', { name: 'Pernambuco', level: 2 })).toBeVisible();
  await expect(page.locator('.mapa-abst .mun')).toHaveCount(184); // Fernando de Noronha fica fora do quadro do mapa

  await page.getByRole('combobox', { name: /^Município/ }).selectOption({ label: 'Recife' });
  await expect(page).toHaveURL(/mun=\d+/);
  await expect(page.getByRole('heading', { name: 'Recife', level: 2 })).toBeVisible();

  await page.getByRole('link', { name: /^Renda por pessoa/ }).click();
  await expect(page.getByRole('heading', { name: 'Abstenção × Renda por pessoa' })).toBeVisible();
  await expect(page).toHaveURL(/uf=PE.*mun=\d+/); // trocar o indicador mantém estado e município

  // fora de 2008 e 2012 não há comparação com o Censo 2010
  await page.getByRole('group', { name: 'Ano da eleição' }).getByRole('link', { name: '2022' }).click();
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2022' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E os indicadores sociais?' })).toBeVisible();
});

test('cruzar abstenção com indicador pinta o mapa em 3 × 3', async ({ page }) => {
  await page.goto('/?uf=ES&cor=cruzar');
  await expect(page.locator('.mapa-abst .mun[class*=" b"]').first()).toBeVisible();
  await expect(page.locator('.mapa-abst .mun[class*=" q"]')).toHaveCount(0);
});

test('parâmetros inválidos voltam ao padrão', async ({ page }) => {
  await page.goto('/?ano=1900&uf=SP&ind=xyz&cor=cruzar');
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2012' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Os seis estados', level: 2 })).toBeVisible(); // SP fora do recorte
  await expect(page.locator('.mapa-abst .mun')).toHaveCount(0);
});

test('lupa: a roda aproxima o estado e, no estado inteiro, rola a página', async ({ page }) => {
  await page.goto('/?uf=RJ', { waitUntil: 'networkidle' });
  const mapa = page.locator('.mapa-abst');
  const caixa = (await mapa.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.wheel(0, -300);
  await expect(page.locator('.mapa-abst .lupa')).toHaveAttribute('style', /scale\((?!1\))/);
  await page.getByRole('button', { name: 'Ver o estado inteiro' }).click();
  await expect(page.locator('.mapa-abst .lupa')).toHaveAttribute('style', /scale\(1\)/);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

// visão Candidato (protótipo com dados fictícios de web/src/lib/candidato-mapa.mock.ts)
test('candidato: buscar um deputado, ver o estado em zoom e virar a ficha', async ({ page }) => {
  await page.goto('/?ver=candidato', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Onde cada candidato teve votos' })).toBeVisible();
  await expect(page.locator('.mapa-abst .mun')).toHaveCount(0);

  const busca = page.getByRole('combobox', { name: 'Buscar candidato pelo nome' });
  await busca.fill('otav');
  await page.getByRole('option', { name: /Otávio Cerejeira/ }).click();
  await expect(page).toHaveURL(/ver=candidato.*cand=9006/);
  await expect(page.getByRole('heading', { name: 'Onde Otávio Cerejeira teve votos em 2022' })).toBeVisible();
  await expect(page.getByText('Deputado federal · RJ · 1º turno')).toBeVisible();
  await expect(page.locator('.mapa-abst')).toHaveAttribute('data-zoom', 'uf');
  await expect(page.locator('.mapa-abst .mun').first()).toBeVisible();

  const virar = page.getByRole('button', { name: 'Ver números' });
  await virar.click();
  await expect(page.getByRole('button', { name: 'Voltar à frente' })).toHaveAttribute('aria-pressed', 'true');
  const mais = page.getByRole('link', { name: 'Ver mais detalhes' });
  await expect(mais).toBeVisible();
  await expect(mais).toHaveAttribute('href', '/candidato/9006?campanha=900602');
});

test('candidato: presidente nos seis estados, zoom num estado e 2º turno', async ({ page }) => {
  await page.goto('/?ver=candidato', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /Marisol Pedraverde/ }).click();
  await expect(page).toHaveURL(/cand=9007/);
  await expect(page.getByText(/só AP, ES, MG, PE, RJ e RR · 1º turno/)).toBeVisible();
  const mapa = page.getByRole('group', { name: /nos seis estados/ });
  await expect(mapa.locator('a.uf[class*=" c"]')).toHaveCount(6); // os seis estados pintados pela proporção

  await mapa.getByRole('link', { name: /^Pernambuco:/ }).click();
  await expect(page).toHaveURL(/uf=PE/);
  await expect(page.locator('.mapa-abst')).toHaveAttribute('data-zoom', 'uf');
  await expect(page.locator('.mapa-abst .mun').first()).toBeVisible();
  await expect(page.locator('.palco')).toHaveAttribute('aria-busy', 'false'); // a navegação do clique no estado terminou

  await page.getByRole('group', { name: 'Turno' }).getByRole('link', { name: '2º turno' }).click();
  await expect(page).toHaveURL(/turno=2/);
  await expect(page).toHaveURL(/uf=PE/); // trocar de turno mantém o estado
  await expect(page.getByText(/só AP, ES, MG, PE, RJ e RR · 2º turno/)).toBeVisible();
});

test('candidato: parâmetros inválidos voltam à busca', async ({ page }) => {
  await page.goto('/?ver=candidato&cand=123&campanha=999');
  await expect(page.getByRole('heading', { name: 'Onde cada candidato teve votos' })).toBeVisible();
});
