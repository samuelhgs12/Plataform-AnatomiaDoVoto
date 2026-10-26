import { test, expect } from '@playwright/test';

test('mapa da abstenção: estado, município, indicador e ano', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' }); // o clique no mapa precisa da página hidratada (navegação sem recarregar)
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2012' })).toBeVisible();
  const mapa = page.getByRole('group', { name: /nos seis estados/ });
  await expect(mapa.getByRole('link')).toHaveCount(6); // só os 6 estados do recorte são clicáveis

  await mapa.getByRole('link', { name: /^Pernambuco:/ }).click();
  await expect(page).toHaveURL(/uf=PE/);
  await expect(page.getByRole('heading', { name: 'Pernambuco', level: 2 })).toBeVisible();
  await expect(page.locator('.palco .mapa-abst .mun')).toHaveCount(184); // Fernando de Noronha fica fora do quadro do mapa

  await page.getByRole('combobox', { name: /^Município/ }).selectOption({ label: 'Recife' });
  await expect(page).toHaveURL(/mun=\d+/);
  await expect(page.getByRole('heading', { name: 'Recife', level: 2 })).toBeVisible();

  // o indicador se liga no menu do mapa, encaixado ao lado dele: Camadas › Comparativos
  await page.locator('.submenu').getByRole('link', { name: /^Renda por pessoa/ }).click();
  await expect(page.getByRole('heading', { name: 'Abstenção × Renda por pessoa' })).toBeVisible();
  await expect(page).toHaveURL(/uf=PE.*mun=\d+/); // trocar o indicador mantém estado e município

  // fora de 2008 e 2012 não há comparação com o Censo 2010
  await page.getByRole('group', { name: 'Ano da eleição' }).getByRole('link', { name: '2022' }).click();
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2022' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E os indicadores sociais?' })).toBeVisible();
});

test('cruzar abstenção com indicador pinta o mapa em 3 × 3', async ({ page }) => {
  await page.goto('/?uf=ES&cor=cruzar');
  await expect(page.locator('.palco .mapa-abst .mun[class*=" b"]').first()).toBeVisible();
  await expect(page.locator('.palco .mapa-abst .mun[class*=" q"]')).toHaveCount(0);
});

test('parâmetros inválidos voltam ao padrão', async ({ page }) => {
  await page.goto('/?ano=1900&uf=SP&ind=xyz&cor=cruzar');
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2012' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Os seis estados', level: 2 })).toBeVisible(); // SP fora do recorte
  await expect(page.locator('.palco .mapa-abst .mun')).toHaveCount(0);
});

test('lupa: a roda aproxima o estado e, no estado inteiro, rola a página', async ({ page }) => {
  await page.goto('/?uf=RJ', { waitUntil: 'networkidle' });
  const mapa = page.locator('.palco .mapa-abst');
  const caixa = (await mapa.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.wheel(0, -300);
  await expect(page.locator('.palco .mapa-abst .lupa')).toHaveAttribute('style', /scale\((?!1\))/);
  await page.getByRole('button', { name: 'Ver o estado inteiro' }).click();
  await expect(page.locator('.palco .mapa-abst .lupa')).toHaveAttribute('style', /scale\(1\)/);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

// visão Candidato: dados reais da API (precisa da tabela votos_candidatura_municipio no banco)
test('candidato: buscar um governador, ver o estado em zoom e virar a ficha', async ({ page }) => {
  await page.goto('/?ver=candidato', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Onde cada candidato teve votos' })).toBeVisible();
  await expect(page.locator('.palco .mapa-abst .mun')).toHaveCount(0);

  const busca = page.getByRole('combobox', { name: 'Buscar candidato pelo nome' });
  await busca.fill('denarium');
  await page.getByRole('option', { name: /Antonio Denarium/ }).click();
  await expect(page).toHaveURL(/ver=candidato.*cand=\d+/);
  await expect(page.getByRole('heading', { name: 'Onde Antonio Denarium teve votos em 2022' })).toBeVisible();
  await expect(page.getByText('Governador · RR · 1º turno')).toBeVisible();
  await expect(page.locator('.palco .mapa-abst')).toHaveAttribute('data-zoom', 'uf');
  await expect(page.locator('.palco .mapa-abst .mun').first()).toBeVisible();

  // o cartão inteiro é o controle: clicar nele vira; pelo teclado, Enter vira e o foco passa para a outra face
  await page.getByRole('button', { name: /virar para ver os números/ }).click();
  const mais = page.getByRole('link', { name: 'Ver mais detalhes' });
  await expect(mais).toBeVisible();
  await expect(mais).toHaveAttribute('href', /^\/candidato\/\d+\?campanha=\d+$/);
  const voltar = page.getByRole('button', { name: /Voltar à frente da ficha/ });
  await voltar.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /virar para ver os números/ })).toBeFocused();
  await expect(mais).toBeHidden();
});

test('candidato: presidente nos seis estados, zoom num estado e 2º turno', async ({ page }) => {
  await page.goto('/?ver=candidato', { waitUntil: 'networkidle' });
  await page.getByRole('combobox', { name: 'Buscar candidato pelo nome' }).fill('lula');
  await page.getByRole('option', { name: /^Lula/ }).first().click();
  await expect(page.getByRole('heading', { name: /Onde Lula teve votos em 2022/ })).toBeVisible();
  await expect(page.getByText(/só AP, ES, MG, PE, RJ e RR · 1º turno/)).toBeVisible();
  const mapa = page.getByRole('group', { name: /nos seis estados/ });
  await expect(mapa.locator('a.uf[class*=" c"]')).toHaveCount(6); // os seis estados pintados pela proporção

  await mapa.getByRole('link', { name: /^Pernambuco:/ }).click();
  await expect(page).toHaveURL(/uf=PE/);
  await expect(page.locator('.palco .mapa-abst')).toHaveAttribute('data-zoom', 'uf');
  await expect(page.locator('.palco .mapa-abst .mun').first()).toBeVisible();
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

test('menu do mapa: camadas de legenda e de comparação', async ({ page }) => {
  await page.goto('/?uf=RJ', { waitUntil: 'networkidle' });
  const submenu = page.locator('.submenu');
  await expect(submenu).toHaveAttribute('open', ''); // no computador, o menu já vem aberto ao lado do mapa
  await expect(submenu.getByRole('navigation', { name: 'O que o mapa mostra' }).getByRole('link', { name: 'Camadas' })).toHaveAttribute('aria-current', 'true');

  // Comparativos: ligar um indicador pinta o estado em 3 × 3; recolhido, o trilho diz o que está ligado
  await submenu.getByRole('link', { name: /^IDHM/ }).click();
  await expect(page).toHaveURL(/cor=cruzar/);
  await expect(page.locator('.palco .mapa-abst .mun[class*=" b"]').first()).toBeVisible();
  await submenu.locator(':scope > summary').click();
  await expect(submenu.locator('.submenu-resumo')).toHaveText('Abstenção × IDHM');
  await expect(submenu.locator('.submenu-resumo')).toBeVisible();
  await submenu.locator(':scope > summary').click();
  await expect(submenu).toHaveAttribute('open', '');
  await submenu.getByRole('link', { name: /^IDHM/ }).click(); // clicar de novo desliga
  await expect(page).not.toHaveURL(/cor=cruzar/);

  // Votos por legenda: ligar troca a visão; o cargo e o partido ficam no próprio grupo
  await submenu.getByRole('link', { name: /^Voto só no partido/ }).click();
  await expect(page).toHaveURL(/ver=legenda/);
  await expect(submenu.getByRole('combobox', { name: 'Partido' })).toBeVisible();
});

test('menu do mapa: fora dos anos do Censo, Comparativos explica e leva a 2008 ou 2012', async ({ page }) => {
  await page.goto('/?ano=2022', { waitUntil: 'networkidle' });
  await expect(page.getByText('O Censo 2010 só é comparado com as eleições de 2008 e 2012.')).toBeVisible();
  await page.locator('.submenu').getByRole('link', { name: 'Ver 2012' }).click();
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2012' })).toBeVisible();
});

test('mini-mapa: aparece ao rolar até os números e volta ao mapa', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'sem animação ligada à rolagem, o Firefox não mostra o mini-mapa');
  await page.goto('/?uf=RJ', { waitUntil: 'networkidle' });
  const mini = page.locator('.minimapa');
  await expect(mini).not.toBeInViewport(); // no topo, só o mapa grande está na tela
  await page.evaluate(() => window.scrollTo(0, innerHeight * 1.6));
  await expect(mini).toBeInViewport();
  await expect(mini.getByRole('link', { name: /Abstenção · RJ · 2012.*Voltar ao mapa/ })).toBeVisible();
  await mini.getByRole('link').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(50);
});
