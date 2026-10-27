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

  // o indicador se escolhe no menu do mapa, encaixado ao lado dele: Camadas › Comparar
  await page.locator('.submenu').getByRole('link', { name: 'Comparar' }).click();
  await page.locator('.submenu').getByRole('link', { name: 'Renda por pessoa' }).click();
  await expect(page).toHaveURL(/cor=cruzar/);
  await expect(page.getByRole('heading', { name: 'Abstenção × Renda por pessoa' })).toBeVisible();
  await expect(page).toHaveURL(/uf=PE.*mun=\d+/); // trocar o indicador mantém estado e município

  // em 2022 o mesmo indicador vem do Censo 2022 (IBGE)
  await page.getByRole('group', { name: 'Ano da eleição' }).getByRole('link', { name: '2022' }).click();
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2022' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Censo 2022' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abstenção × Renda por pessoa' })).toBeVisible();

  // fora dos anos em volta de um Censo (2008 a 2012, 2020 a 2024) não há comparação
  await page.getByRole('group', { name: 'Ano da eleição' }).getByRole('link', { name: '2018' }).click();
  await expect(page.getByRole('heading', { name: 'Quem não foi votar em 2018' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E os indicadores sociais?' })).toBeVisible();
});

test('no Censo 2022 o menu só lista os equivalentes do IBGE e o IDHM pedido vira renda', async ({ page }) => {
  await page.goto('/?ano=2024&uf=MG&cor=cruzar', { waitUntil: 'networkidle' });
  const indicadores = page.locator('.submenu').getByRole('navigation', { name: 'Indicador do Censo 2022' });
  await expect(indicadores.getByRole('link')).toHaveCount(5);
  await expect(indicadores.getByRole('link', { name: 'IDHM' })).toHaveCount(0);
  await expect(indicadores.getByRole('link', { name: 'Renda por pessoa' })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.palco .mapa-abst .mun[class*=" b"]').first()).toBeVisible();
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
  await page.goto('/?ver=candidato&cand=999999999&campanha=999'); // id que nenhuma carga tem
  await expect(page.getByRole('heading', { name: 'Onde cada candidato teve votos' })).toBeVisible();
});

test('menu do mapa: camadas de legenda e de comparação', async ({ page }) => {
  await page.goto('/?uf=RJ', { waitUntil: 'networkidle' });
  const submenu = page.locator('.submenu');
  await expect(submenu).toHaveAttribute('open', ''); // no computador, o menu já vem aberto ao lado do mapa
  await expect(submenu.getByRole('navigation', { name: 'O que o mapa mostra' }).getByRole('link', { name: 'Camadas' })).toHaveAttribute('aria-current', 'true');

  // o modo é escolha única: Comparar vem marcado, com a abstenção sozinha e nenhum indicador escolhido
  const modos = submenu.getByRole('navigation', { name: 'O que pinta o mapa' });
  await expect(modos.getByRole('link')).toHaveCount(2);
  await expect(modos.getByRole('link', { name: 'Comparar' })).toHaveAttribute('aria-current', 'true');
  const indicadores = submenu.getByRole('navigation', { name: 'Indicador do Censo 2010' });
  await expect(indicadores.locator('[aria-current]')).toHaveCount(0);
  await expect(page.locator('.palco .mapa-abst .mun[class*=" q"]').first()).toBeVisible();

  // escolher um indicador cruza; clicar de novo nele desmarca e volta à abstenção sozinha
  await indicadores.getByRole('link', { name: 'Pobres' }).click();
  await expect(page).toHaveURL(/ind=pmpob.*cor=cruzar/);
  await expect(indicadores.getByRole('link', { name: 'Pobres' })).toHaveAttribute('aria-current', 'true');
  await indicadores.getByRole('link', { name: 'Pobres' }).click();
  await expect(page).not.toHaveURL(/cor=cruzar/);
  await expect(indicadores.locator('[aria-current]')).toHaveCount(0);
  await indicadores.getByRole('link', { name: 'IDHM' }).click();
  await expect(page).toHaveURL(/cor=cruzar/);
  await expect(page.locator('.palco .mapa-abst .mun[class*=" b"]').first()).toBeVisible();
  await submenu.locator(':scope > summary').click();
  await expect(submenu.locator('.submenu-resumo')).toHaveText('Abstenção × IDHM');
  await expect(submenu.locator('.submenu-resumo')).toBeVisible();
  await submenu.locator(':scope > summary').click();
  await expect(submenu).toHaveAttribute('open', '');
  await modos.getByRole('link', { name: 'Comparar' }).click(); // Comparar de novo também volta à abstenção sozinha
  await expect(page).not.toHaveURL(/cor=cruzar/);

  // Legenda: o modo troca a visão; o partido aparece nele
  await modos.getByRole('link', { name: 'Legenda' }).click();
  await expect(page).toHaveURL(/ver=legenda/);
  await expect(submenu.getByRole('combobox', { name: 'Partido' })).toBeVisible();
});

test('menu do mapa: fora dos anos do Censo, Comparativos explica e leva a um ano do Censo', async ({ page }) => {
  await page.goto('/?ano=2018', { waitUntil: 'networkidle' });
  await page.locator('.submenu').getByRole('link', { name: 'Comparar' }).click();
  await expect(page.getByText('Os indicadores do Censo só são comparados com as eleições em volta dele: 2008, 2010 e 2012 (Censo 2010) e 2020, 2022 e 2024 (Censo 2022).')).toBeVisible();
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

test('menu do mapa: numa tela baixa a lista rola por dentro do menu, não a página', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 640 });
  await page.goto('/?uf=RJ&cor=cruzar', { waitUntil: 'networkidle' });
  const lista = page.locator('.submenu-conteudo');
  expect(await lista.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true); // a lista não cabe: tem de rolar, não ser cortada
  const caixa = (await lista.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + 80);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => lista.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('.submenu').getByRole('link', { name: /^Água encanada/ })).toBeInViewport();
});

test('legenda do cruzamento 3 × 3 escreve os cortes de cada terço', async ({ page }) => {
  await page.goto('/?uf=RJ&cor=cruzar');
  const legenda = page.getByRole('img', { name: /^Cores: abstenção \(colunas: até \d+%/ });
  await expect(legenda).toBeVisible();
  await expect(legenda.locator('.bi-rot-x')).toHaveCount(3);
  await expect(legenda.locator('.bi-rot-y')).toHaveCount(3);
});

test('painel: ficha fixa do município e mini-mapa indo até ele', async ({ page }) => {
  await page.goto('/?uf=RJ&cor=cruzar', { waitUntil: 'networkidle' });
  await expect(page.getByRole('group', { name: /com mais e menos abstenção/ }).getByRole('link')).toHaveCount(8);
  await page.getByRole('combobox', { name: /^Município/ }).selectOption({ label: 'Petrópolis' });
  await expect(page).toHaveURL(/mun=\d+/);
  const ficha = page.locator('.ficha-mun');
  await expect(ficha.getByRole('heading', { name: 'Petrópolis', level: 3 })).toBeVisible();
  await expect(ficha.getByRole('img', { name: /maior abstenção entre os \d+ municípios de Rio de Janeiro/ })).toBeVisible();
  await expect(page.locator('.minimapa')).toHaveAttribute('data-foco', '');
});
