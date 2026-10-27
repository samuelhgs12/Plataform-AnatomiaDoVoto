import { afterEach, describe, expect, it, vi } from "vitest";
import { lerPecas } from "../src/lib/api";
import {
  ABA_PROPAGANDA, alcance, ancorasSeta, anoAnterior, cargosNoEixo, cargosPropaganda, composicao, composicaoPorCargo, descricaoGrafico, descricaoLinhas,
  descricaoSetas, detalheCampanhas, espalhar, fraseMudanca, GRAFICO, graficoCargos, hrefAba, linhasPorTipo, numerosResposta, recortePropaganda, setasMudanca,
  tiposDaManchete, TITULO_NEUTRO, tituloCargos, type LinhaGeral,
} from "../src/lib/propaganda-geral";

const FIS = "propaganda_fisica", AV = "propaganda_audiovisual", DIG = "propaganda_digital";
/** As três linhas (uma por tipo) de um recorte: médias, partes que usaram e somas em centavos, na ordem física, AV, digital. */
const recorte = (ano: number, cargo: string, uf: string | null, campanhas: number, medias: number[], usaram = [1, 0.2, 0.2], somas = [700, 100, 200],
  despesas: number | null = null): LinhaGeral[] =>
  [FIS, AV, DIG].map((grupo, i) => ({ ano, id_cargo: 0, cargo, uf, grupo, campanhas, media: medias[i], parte_com_gasto: usaram[i], soma_centavos: somas[i],
    despesas_centavos: despesas }));
const sp = (s: string | null) => s?.replace(/\s/g, " ");   // formatos de moeda usam espaço não separável
const linhas: LinhaGeral[] = [
  // números da cópia local de 24/10: vereador 2024 (87/6/7, 17% usaram internet) e deputado federal 2022 (75/9/16)
  ...recorte(2024, "Vereador", null, 53_019, [0.873, 0.061, 0.066], [0.955, 0.182, 0.168]),
  ...recorte(2024, "Vereador", "MG", 30_010, [0.892, 0.051, 0.057]),
  ...recorte(2024, "Prefeito", null, 3_479, [0.7, 0.2, 0.1]),
  ...recorte(2020, "Vereador", null, 56_491, [0.92, 0.05, 0.03]),
  ...recorte(2022, "Presidente", null, 12, [0.408, 0.39, 0.202]),
  ...recorte(2022, "Governador", null, 42, [0.577, 0.246, 0.177]),
  ...recorte(2022, "Governador", "AP", 2, [0.5, 0.5, 0]),
  ...recorte(2022, "Deputado federal", null, 2_266, [0.749, 0.093, 0.158]),
  ...recorte(2022, "Deputado estadual", null, 3_191, [0.81, 0.09, 0.1]),
  ...recorte(2022, "Senador", null, 46, [0.6, 0.25, 0.15]),
];

describe("composicao e linhasPorTipo", () => {
  it("campanha média do recorte: as partes somam 100 e trazem quantas campanhas usaram", () => {
    const c = composicao(linhas, 2024, "Vereador", null)!;
    expect(c.partes.map((p) => p.de100)).toEqual([87, 6, 7]);
    expect(c.partes.reduce((s, p) => s + p.de100, 0)).toBe(100);
    expect([c.campanhas, c.somaCentavos]).toEqual([53_019, 1000]);
    expect(composicao(linhas, 2024, "Vereador", "MG")!.campanhas).toBe(30_010);
    expect(composicao(linhas, 2024, "Vereador", "RJ")).toBeNull();
  });
  it("uma linha por tipo: da maior média para a menor; tipo com média 0 fica de fora", () => {
    expect(linhasPorTipo(composicao(linhas, 2024, "Vereador", null)!).map((l) => [l.rotulo, l.pct, l.usaram])).toEqual([
      ["Impresso e de rua", "87%", "96%"], ["Internet", "7%", "17%"], ["Rádio, TV e vídeo", "6%", "18%"]]);
    expect(linhasPorTipo(composicao(linhas, 2022, "Governador", "AP")!).map((l) => l.grupo)).toEqual([FIS, AV]);   // empate: a ordem dos tipos
    expect(descricaoLinhas(composicao(linhas, 2024, "Vereador", "MG")!, "Minas Gerais"))
      .toBe("Campanha média a vereador em Minas Gerais em 2024: impresso e de rua 89% (100% das campanhas usaram); internet 6% (20% das campanhas usaram); "
        + "rádio, tv e vídeo 5% (20% das campanhas usaram).");
  });
  it("os tipos da manchete pelas peças vêm da soma do recorte", () => {
    expect(tiposDaManchete(composicao(linhas, 2024, "Vereador", null)!).map((t) => [t.grupo, t.centavos, t.parte]))
      .toEqual([[FIS, 700, 0.7], [AV, 100, 0.1], [DIG, 200, 0.2]]);
  });
  it("alcance: estado, seis estados ou campanha nacional", () => {
    expect([alcance("Vereador", "Minas Gerais"), alcance("Vereador", null), alcance("Presidente", null)])
      .toEqual([" em Minas Gerais", " nos seis estados", " (campanha nacional)"]);
  });
});

describe("comparação entre os cargos", () => {
  it("do cargo mais alto ao mais baixo; presidente entra na eleição geral, nacional mesmo com UF", () => {
    expect(composicaoPorCargo(linhas, 2022, null).map((c) => c.cargo)).toEqual(["Presidente", "Governador", "Senador", "Deputado federal", "Deputado estadual"]);
    expect(composicaoPorCargo(linhas, 2024, null).map((c) => c.cargo)).toEqual(["Prefeito", "Vereador"]);
    expect(composicaoPorCargo(linhas, 2022, "AP").map((c) => [c.cargo, c.uf])).toEqual([["Presidente", null]]);   // governador AP: 2 campanhas
  });
  it("cargos com poucas campanhas: o número ao lado do nome (menos de 30); menos de 3 não aparecem", () => {
    const porCargo = Object.fromEntries(composicaoPorCargo(linhas, 2022, null).map((c) => [c.cargo, detalheCampanhas(c)]));
    expect(porCargo).toEqual({ Presidente: "12 campanhas", Governador: undefined, Senador: undefined, "Deputado federal": undefined, "Deputado estadual": undefined });
    expect(composicaoPorCargo(linhas, 2022, "AP").some((c) => c.cargo === "Governador")).toBe(false);
  });
});

describe("os dois números da resposta", () => {
  const c = (despesas: number | null) => composicao(recorte(2022, "Deputado federal", null, 2_266, [0.749, 0.093, 0.158], [0.95, 0.44, 0.56],
    [10_000_000_000, 2_000_000_000, 3_000_000_000], despesas), 2022, "Deputado federal", null)!;
  it("a soma contratada em formato curto e a parte no gasto todo, na cor do tipo de maior média", () => {
    const n = numerosResposta(c(20_270_000_000));
    expect([sp(n.total), n.rotuloTotal, n.parte, n.grupo]).toEqual(["R$ 150 milhões", "contratados em propaganda pelas 2.266 campanhas", "74%", FIS]);
  });
  it("abaixo de 1%: 'menos de 1%'; sem o total de despesas, o número 2 não aparece", () => {
    expect(numerosResposta(c(15_000_000_000_000)).parte).toBe("menos de 1%");
    expect(numerosResposta(c(null)).parte).toBeNull();
    expect(numerosResposta(c(0)).parte).toBeNull();
    expect(composicao(linhas, 2024, "Vereador", null)!.despesasCentavos).toBeNull();     // API anterior ao total: sem o dado
  });
});

describe("gráfico de linhas pelos cargos", () => {
  it("o eixo em ordem de alcance: eleição geral e municipal", () => {
    expect(cargosNoEixo(linhas, 2022, null).map((c) => c.cargo)).toEqual(["Deputado estadual", "Deputado federal", "Senador", "Governador", "Presidente"]);
    expect(cargosNoEixo(linhas, 2024, null).map((c) => c.cargo)).toEqual(["Vereador", "Prefeito"]);
  });
  it("cargos com menos de 3 campanhas ficam fora; com menos de 30, o número embaixo do nome", () => {
    expect(cargosNoEixo(linhas, 2022, "AP").map((c) => [c.cargo, c.uf])).toEqual([["Presidente", null]]);   // governador AP: 2 campanhas
    expect(graficoCargos(cargosNoEixo(linhas, 2022, null), "Senador").colunas.map((c) => [c.nome, c.detalhe, c.atual])).toEqual([
      [["Deputado", "estadual"], undefined, false], [["Deputado", "federal"], undefined, false], [["Senador"], undefined, true],
      [["Governador"], undefined, false], [["Presidente"], "12 campanhas", false]]);
  });
  it("as três formas do título", () => {
    expect(tituloCargos(cargosNoEixo(linhas, 2022, null))).toBe("Quanto maior o cargo, menos material impresso e mais rádio, TV e vídeo");
    expect(tituloCargos(cargosNoEixo(linhas, 2024, null))).toBe("Prefeitos põem mais em rádio, TV e vídeo e menos em material impresso que vereadores");
    const parecidos = recorte(2024, "Vereador", null, 50, [0.873, 0.061, 0.066]).concat(recorte(2024, "Prefeito", null, 50, [0.8, 0.12, 0.08]));
    expect(tituloCargos(cargosNoEixo(parecidos, 2024, null))).toBe(TITULO_NEUTRO);        // rádio e TV sobe só 6 pontos
    expect(tituloCargos([composicao(linhas, 2024, "Vereador", null)!])).toBe(TITULO_NEUTRO);
  });
  it("posições, a faixa e os valores do cargo escolhido; tipo com 0% em todos os cargos não tem linha", () => {
    const g = graficoCargos(cargosNoEixo(linhas, 2024, null), "Prefeito");
    expect([g.y100, g.y50, g.y0]).toEqual([GRAFICO.topo, GRAFICO.topo + GRAFICO.alturaPlot / 2, GRAFICO.topo + GRAFICO.alturaPlot]);
    expect(g.colunas.map((c) => c.x)).toEqual([GRAFICO.margemEsq, GRAFICO.largura - GRAFICO.margemDir]);
    expect(g.series.map((s) => [s.grupo, s.tracejada])).toEqual([[FIS, false], [AV, false], [DIG, true]]);
    expect(g.faixa?.x).toBeCloseTo(GRAFICO.largura - GRAFICO.margemDir - g.faixa!.largura / 2, 9);
    expect(g.valores.map((v) => [v.grupo, v.texto])).toEqual([[FIS, "70%"], [AV, "20%"], [DIG, "10%"]]);
    const semNet = recorte(2024, "Vereador", null, 50, [0.9, 0.1, 0]).concat(recorte(2024, "Prefeito", null, 50, [0.8, 0.2, 0]));
    expect(graficoCargos(cargosNoEixo(semNet, 2024, null), "Vereador").series.map((s) => s.grupo)).toEqual([FIS, AV]);
    expect(graficoCargos(cargosNoEixo(linhas, 2024, null), "Governador").faixa).toBeNull();
  });
  it("rótulos vizinhos se afastam na vertical, sem passar do limite", () => {
    expect(espalhar([100, 102, 50], 15)).toEqual([100, 115, 50]);
    expect(espalhar([180, 182], 15, 0, 186)).toEqual([171, 186]);
  });
  it("aria-label: por tipo, os valores de cada cargo na ordem do eixo", () => {
    expect(descricaoGrafico(cargosNoEixo(linhas, 2024, null), 2024, " nos seis estados")).toBe("Campanha média de cada cargo em 2024 nos seis estados, de "
      + "vereador a prefeito. Impresso e de rua: vereador 87%, prefeito 70%; Rádio, TV e vídeo: vereador 6%, prefeito 20%; Internet: vereador 7%, prefeito 10%.");
  });
});

describe("como mudou", () => {
  it("a eleição anterior do mesmo tipo, se houver dados", () => {
    expect([anoAnterior(linhas, 2024), anoAnterior(linhas, 2020), anoAnterior(linhas, 2022)]).toEqual([2020, null, null]);
  });
  it("a frase do tipo que mais mudou; sem mudança, nenhuma", () => {
    const [antes, depois] = [composicao(linhas, 2020, "Vereador", null)!, composicao(linhas, 2024, "Vereador", null)!];
    expect(fraseMudanca(antes, depois)).toBe("De 2020 para 2024, o material impresso e de rua caiu de R$ 92 para R$ 87 de cada R$ 100 na campanha média a vereador.");
    const radio = recorte(2018, "Senador", null, 40, [0.7, 0.2, 0.1]).concat(recorte(2022, "Senador", null, 40, [0.6, 0.3, 0.1]));
    expect(fraseMudanca(composicao(radio, 2018, "Senador", null)!, composicao(radio, 2022, "Senador", null)!))
      .toBe("De 2018 para 2022, o material impresso e de rua caiu de R$ 70 para R$ 60 de cada R$ 100 na campanha média a senador.");
    const av = recorte(2018, "Senador", null, 40, [0.7, 0.2, 0.1]).concat(recorte(2022, "Senador", null, 40, [0.65, 0.3, 0.05]));
    expect(fraseMudanca(composicao(av, 2018, "Senador", null)!, composicao(av, 2022, "Senador", null)!))
      .toBe("De 2018 para 2022, rádio, TV e vídeo subiram de R$ 20 para R$ 30 de cada R$ 100 na campanha média a senador.");
    expect(fraseMudanca(composicao(linhas, 2024, "Vereador", null)!, composicao(linhas, 2024, "Vereador", null)!)).toBeNull();
  });
  const antes = composicao(linhas, 2020, "Vereador", null)!, depois = composicao(linhas, 2024, "Vereador", null)!;
  it("setas: na ordem das linhas por tipo do ano escolhido, com a direção e a diferença em pontos", () => {
    expect(setasMudanca(antes, depois).map((s) => [s.grupo, s.textoDe, s.textoPara, s.direcao, s.diferenca])).toEqual([
      [FIS, "92%", "87%", "desce", "−5 pontos"], [DIG, "3%", "7%", "sobe", "+4 pontos"], [AV, "5%", "6%", "sobe", "+1 ponto"]]);
  });
  it("menos de 1 ponto: sem mudança; tipo com 0% nos dois anos fica de fora", () => {
    const r = recorte(2018, "Senador", null, 40, [0.701, 0.299, 0]).concat(recorte(2022, "Senador", null, 40, [0.698, 0.302, 0]));
    const setas = setasMudanca(composicao(r, 2018, "Senador", null)!, composicao(r, 2022, "Senador", null)!);
    expect(setas.map((s) => [s.grupo, s.direcao, s.diferenca])).toEqual([[FIS, "igual", "sem mudança"], [AV, "igual", "sem mudança"]]);
    expect(ancorasSeta("igual")).toEqual({ de: "translateX(-50%)", para: null });
    expect(ancorasSeta("sobe")).toEqual({ de: "translateX(calc(-100% - 8px))", para: "translateX(4px)" });
    expect(ancorasSeta("desce")).toEqual({ de: "translateX(8px)", para: "translateX(calc(-100% - 4px))" });
  });
  it("aria-label das setas", () => {
    expect(descricaoSetas(setasMudanca(antes, depois), 2020, 2024)).toBe("Campanha média de 2020 para 2024: material impresso e de rua de 92% para 87%, "
      + "menos 5 pontos; internet de 3% para 7%, mais 4 pontos; rádio, TV e vídeo de 5% para 6%, mais 1 ponto.");
  });
});

describe("filtros da aba", () => {
  const nomeUf = (u: string) => ({ MG: "Minas Gerais", RJ: "Rio de Janeiro" })[u] ?? u;
  it("presidente só na eleição geral; com UF, a UF é ignorada com aviso", () => {
    expect(cargosPropaganda(2022, ["Deputado federal", "Senador"])).toEqual(["Presidente", "Deputado federal", "Senador"]);
    expect(cargosPropaganda(2024, ["Vereador", "Prefeito"])).toEqual(["Vereador", "Prefeito"]);
    expect(recortePropaganda({ ano: 2022, cargo: "Deputado federal", uf: "MG" }, { cargo: "Presidente", nomeUf })).toEqual({
      ano: 2022, cargo: "Presidente", uf: null, avisos: ["A campanha a presidente é nacional: os números não são só de Minas Gerais."] });
    expect(recortePropaganda({ ano: 2022, cargo: "Deputado federal" }, { cargo: "Presidente" })).toEqual({ ano: 2022, cargo: "Presidente", uf: null, avisos: [] });
    expect(recortePropaganda({ ano: 2024, cargo: "Vereador" }, { cargo: "Presidente" }).avisos).toEqual(["Presidente não é eleito em 2024: mostrando vereador."]);
  });
  it("município e porte: dados do estado inteiro, com aviso", () => {
    expect(recortePropaganda({ ano: 2024, cargo: "Vereador", uf: "MG", mun: { nome: "Belo Horizonte" } }, { cargo: "Vereador", porte: "grande", nomeUf }).avisos)
      .toEqual(["A propaganda não tem recorte por município: dados do estado inteiro (Minas Gerais), não só de Belo Horizonte."]);
    expect(recortePropaganda({ ano: 2022, cargo: "Senador", uf: "RJ", munIgnorado: true }, {}).avisos)
      .toEqual(["A propaganda não tem recorte por município: dados do estado inteiro."]);
    expect(recortePropaganda({ ano: 2024, cargo: "Vereador", uf: "MG" }, { porte: "pequena" }).avisos)
      .toEqual(["O porte da cidade não se aplica à propaganda: dados do estado inteiro."]);
    expect(recortePropaganda({ ano: 2024, cargo: "Vereador", uf: "MG" }, { cargo: "Vereador" })).toEqual({ ano: 2024, cargo: "Vereador", uf: "MG", avisos: [] });
  });
  it("os links preservam ano, cargo, UF e a aba; presidente não existe na aba padrão", () => {
    expect(ABA_PROPAGANDA).toBe("propaganda");
    expect(hrefAba({ ano: 2024, cargo: "Prefeito", uf: "MG" }, ABA_PROPAGANDA, "h-p9g")).toBe("/analises/dinheiro?ano=2024&cargo=Prefeito&uf=MG&aba=propaganda#h-p9g");
    expect(hrefAba({ ano: 2024, cargo: "Prefeito", uf: "MG" }, null)).toBe("/analises/dinheiro?ano=2024&cargo=Prefeito&uf=MG");
    expect(hrefAba({ ano: 2022, cargo: "Presidente", uf: "MG" }, ABA_PROPAGANDA)).toBe("/analises/dinheiro?ano=2022&cargo=Presidente&uf=MG&aba=propaganda");
    expect(hrefAba({ ano: 2022, cargo: "Presidente", uf: null }, null)).toBe("/analises/dinheiro?ano=2022");
    expect(hrefAba({ ano: 2022, cargo: "Deputado federal", uf: null }, ABA_PROPAGANDA)).toBe("/analises/dinheiro?ano=2022&cargo=Deputado+federal&aba=propaganda");
  });
});

describe("lerPecas", () => {
  afterEach(() => vi.unstubAllGlobals());
  const resposta = (status: number, corpo: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(corpo), { status })));
  it("202 = em preparação; 200 = as peças; erro ou API fora do ar = null", async () => {
    resposta(202, { estado: "preparando" });
    expect(await lerPecas(2024, "Vereador", null)).toBe("preparando");
    resposta(200, [{ termo: "santinho" }]);
    expect(await lerPecas(2024, "Vereador", "MG")).toEqual([{ termo: "santinho" }]);
    resposta(503, { estado: "erro" });
    expect(await lerPecas(2024, "Vereador", null)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fora do ar"); }));
    expect(await lerPecas(2024, "Vereador", null)).toBeNull();
  });
  it("o recorte vai na URL: sem UF, todos os estados", async () => {
    const f = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", f);
    await lerPecas(2022, "Deputado federal", null);
    await lerPecas(2024, "Vereador", "MG");
    expect((f.mock.calls as unknown as [string][]).map(([u]) => u.replace(/^.*\/api/, ""))).toEqual([
      "/propaganda/pecas?ano=2022&cargo=Deputado+federal", "/propaganda/pecas?ano=2024&cargo=Vereador&uf=MG"]);
  });
});
