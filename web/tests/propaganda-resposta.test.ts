import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizarTermo, type PorTipo, type TermoNuvem } from "../src/lib/nuvem";
import {
  analisar, barraPecas, comparacao, composicaoPorTipo, DEGRAUS_BARRA, descricaoBarra, fraseComparacao, larguraParaRotulo, linhaNada,
  manchetePecas, mostrarBarra, mostrarNuvem, noEstado, numerosDestaque, parteDosGastos, parteTabela, PECA_MANCHETE, pecaManchete,
  pecasDaManchete, tabelaCategorias, tabelaPecas, TIPO_COMUM, tipoComum, tipoDominante, tiposPorValor, totalTabela, UF_COM_PREPOSICAO, LIMIAR_GRUPO_MINIMO, LIMIAR_GRUPO_PEQUENO,
  grupoPequeno, legendaTipica, mediana, NOTA_DESPESA_DUPLA, temDespesaDupla, tipica, tipicasPorTipo, type LinhaParcelas,
  type Categoria, type LinhaReferencia,
} from "../src/lib/propaganda";

const FIS = "propaganda_fisica", AV = "propaganda_audiovisual", DIG = "propaganda_digital";
const ORIGEM: Record<string, string> = { [FIS]: "Publicidade por materiais impressos", [AV]: "Produção de jingles, vinhetas e slogans", [DIG]: "Despesa com Impulsionamento de Conteúdos" };
/** Peça como a API devolve; por_tipo = [[grupo, centavos], ...] (o grupo dominante é o de maior valor). */
const peca = (termo: string, porTipo: [string, number][], o: Partial<TermoNuvem> = {}): TermoNuvem => normalizarTermo({
  termo, generico: false, despesas: 1, pela_categoria_centavos: 0, explicacao: null, detalhes: [],
  centavos: porTipo.reduce((s, [, c]) => s + c, 0), grupo: [...porTipo].sort((a, b) => b[1] - a[1])[0][0],
  por_tipo: porTipo.map(([grupo, centavos]) => ({ grupo, centavos }) as PorTipo), ...o,   // sem despesas: normalizarTermo completa
})!;
const g = { generico: true };
/** Categorias oficiais coerentes com as peças (o total de cada tipo = soma do por_tipo das peças nesse tipo). */
const categoriasDe = (pecas: TermoNuvem[]): Categoria[] => {
  const porGrupo = new Map<string, number>();
  for (const p of pecas) for (const x of p.por_tipo) porGrupo.set(x.grupo, (porGrupo.get(x.grupo) ?? 0) + x.centavos);
  return [...porGrupo].map(([grupo, centavos]) => ({ origem: ORIGEM[grupo], grupo, lancamentos: 1, centavos }));
};
/** Tudo o que a seção usa: tipos oficiais, total de propaganda, peças e total de despesas (padrão: o dobro da propaganda). */
const caso = (pecas: TermoNuvem[], o: { categorias?: Categoria[]; despesas?: number } = {}) => {
  const categorias = o.categorias ?? categoriasDe(pecas);
  const prop = categorias.reduce((s, k) => s + k.centavos, 0);
  const a = analisar({ lancamentos: 10, total_centavos: o.despesas ?? prop * 2, propaganda_centavos: prop }, categorias);
  if (a.estado !== "com_propaganda") throw new Error("caso sem propaganda");
  return { a, tipos: composicaoPorTipo(a), total: a.propagandaCentavos, pecas, despesas: a.totalCentavos };
};
type Caso = ReturnType<typeof caso>;
const manchete = (c: Caso) => manchetePecas(c.pecas, c.tipos, c.total);
const barra = (c: Caso) => barraPecas(c.tipos, c.pecas, c.total);
const analise = (c: Caso) => c.a;
const sp = (s: string | null) => s?.replace(/\s/g, " ");   // formatos de moeda usam espaço não separável

// Campanhas reais (cópia local de 24/10, mesmas peças que a API devolve), em centavos.
/** Dilma Rousseff, senado MG 2018 (607029); despesas consideradas: R$ 4.165.774,01. */
const dilma = () => caso([
  peca("adesivo", [[FIS, 14_274_500]], { despesas: 6 }), peca("panfleto", [[FIS, 9_600_000]], { despesas: 2 }),
  peca("santinho", [[FIS, 8_902_670]], { despesas: 24 }), peca("Facebook", [[DIG, 7_111_581]], { despesas: 2 }),
  peca("bóton", [[FIS, 4_083_300]]), peca("som", [[FIS, 370_000]]), peca("faixa", [[FIS, 86_000]], { despesas: 2 }),
], { despesas: 416_577_401, categorias: [
  { origem: "Publicidade por materiais impressos", grupo: FIS, lancamentos: 28, centavos: 29_082_970 },
  { origem: "Publicidade por adesivos", grupo: FIS, lancamentos: 4, centavos: 7_418_500 },
  { origem: "Despesa com Impulsionamento de Conteúdos", grupo: DIG, lancamentos: 2, centavos: 7_111_581 },
  { origem: "Publicidade por jornais e revistas", grupo: FIS, lancamentos: 1, centavos: 445_000 },
  { origem: "Publicidade por carros de som", grupo: FIS, lancamentos: 1, centavos: 370_000 },
] });
/** Governador RJ 2018 (609707). */
const governador = () => caso([
  peca("rádio/TV", [[AV, 373_850_000], [FIS, 4_218]]), peca("vídeo", [[AV, 369_800_000]]), peca("santinho", [[FIS, 191_311_068]]),
  peca("anúncios", [[DIG, 65_000_000]]), peca("redes", [[AV, 53_900_000]]), peca("adesivo", [[FIS, 49_652_140]]),
  peca("bandeira", [[FIS, 26_902_000]]), peca("jornal", [[FIS, 17_743_238]]), peca("Facebook", [[DIG, 15_458_600]]),
  peca("jingle", [[AV, 14_500_000]]), peca("impressos", [[FIS, 13_830_800]], g), peca("marketing", [[AV, 6_000_000]], g),
  peca("panfleto", [[FIS, 1_837_700]]), peca("carta", [[FIS, 792_000]]), peca("faixa", [[FIS, 761_539]]),
]);
/** Prefeito MG 2020 (677474). */
const prefeito = () => caso([
  peca("santinho", [[FIS, 1_319_800]]), peca("jornal", [[FIS, 490_000]]), peca("anúncios", [[DIG, 344_379]]),
  peca("camiseta", [[FIS, 150_000]]), peca("bandeira", [[FIS, 100_800]]), peca("redes", [[DIG, 100_000]]), peca("bóton", [[FIS, 89_000]]),
]);
/** Vereador MG 2024 (805216): uma peça só. */
const vereador = () => caso([peca("santinho", [[FIS, 117_000]])], { despesas: 300_000 });
const ref = (o: Partial<LinhaReferencia>): LinhaReferencia => ({ ano: 2018, id_cargo: 5, cargo: "Senador", uf: "MG", grupo: FIS, mediana: 0.68, campanhas: 12, ...o });
const senadorMG = { id_cargo: 5, cargo: "Senador", ano: 2018, uf: "MG" };
const vereadorMG = { id_cargo: 13, cargo: "Vereador", ano: 2024, uf: "MG" };
const r = (mediana: number) => [ref({ id_cargo: 13, ano: 2024, mediana, campanhas: 29_929 })];

describe("PECA_MANCHETE e TIPO_COMUM", () => {
  it("toda peça do dicionário da API (api/app/nuvem.py, PECA) tem forma por extenso", () => {
    const py = readFileSync(new URL("../../api/app/nuvem.py", import.meta.url), "utf-8");
    const bloco = py.slice(py.indexOf("PECA = {"), py.indexOf("}", py.indexOf("PECA = {")));
    const pecas = new Set([...bloco.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]).concat("jornal"));
    expect(pecas.size).toBeGreaterThan(20);
    for (const p of pecas) expect(PECA_MANCHETE[p], `peça sem forma por extenso: ${p}`).toBeTruthy();
    expect([pecaManchete("jornal"), pecaManchete("rádio/TV")]).toEqual(["jornais", "programas de rádio/TV"]);
  });
  it("trocas de nome: faixas, programas de rádio/TV, brindes, carros de som", () => {
    expect(["faixa", "rádio/TV", "pirulito", "som"].map(pecaManchete)).toEqual(["faixas", "programas de rádio/TV", "brindes", "carros de som"]);
    expect(Object.values(PECA_MANCHETE).filter((f) => / e /.test(f))).toEqual(["marketing e criação"]);
  });
  it("rótulos dos tipos em linguagem comum", () => {
    expect([FIS, DIG, AV].map((t) => tipoComum(t).frase)).toEqual(["material impresso e de rua", "internet", "rádio, TV e vídeo"]);
    expect([FIS, DIG, AV].map((t) => tipoComum(t).legenda)).toEqual(["Impresso e de rua", "Internet", "Rádio, TV e vídeo"]);
  });
  it("nenhuma expressão serve ao mesmo tempo para uma peça e para um tipo", () => {
    const tipos = new Set(Object.values(TIPO_COMUM).flatMap((t) => [t.frase, t.em.replace(/^(em|na|no) /, ""), t.legenda])
      .map((s) => s.toLowerCase()));
    for (const forma of Object.values(PECA_MANCHETE)) expect(tipos.has(forma.toLowerCase()), forma).toBe(false);
  });
});

describe("UF_COM_PREPOSICAO e noEstado", () => {
  it("as 27 UFs com a preposição certa; presidente sem estado", () => {
    const esperado: Record<string, string> = {
      AC: "no Acre", AL: "em Alagoas", AP: "no Amapá", AM: "no Amazonas", BA: "na Bahia", CE: "no Ceará", DF: "no Distrito Federal",
      ES: "no Espírito Santo", GO: "em Goiás", MA: "no Maranhão", MT: "em Mato Grosso", MS: "em Mato Grosso do Sul", MG: "em Minas Gerais",
      PA: "no Pará", PB: "na Paraíba", PR: "no Paraná", PE: "em Pernambuco", PI: "no Piauí", RJ: "no Rio de Janeiro",
      RN: "no Rio Grande do Norte", RS: "no Rio Grande do Sul", RO: "em Rondônia", RR: "em Roraima", SC: "em Santa Catarina",
      SP: "em São Paulo", SE: "em Sergipe", TO: "no Tocantins",
    };
    expect(Object.keys(esperado)).toHaveLength(27);
    expect(UF_COM_PREPOSICAO).toEqual(esperado);
    for (const [uf, texto] of Object.entries(esperado)) expect(noEstado(uf)).toBe(` ${texto}`);
    expect([noEstado("BR"), noEstado(null)]).toEqual(["", ""]);
  });
});

describe("manchetePecas", () => {
  it("campanhas reais: Dilma, governador RJ 2018, prefeito MG 2020 (com 'jornais'), vereador de 1 peça", () => {
    expect(manchete(dilma())).toBe("Adesivos, panfletos e santinhos.");
    expect(manchete(governador())).toBe("Programas de rádio/TV, vídeos e santinhos.");
    expect(manchete(prefeito())).toBe("Santinhos, jornais e anúncios na internet.");
    expect(manchete(vereador())).toBe("Santinhos.");
  });
  it("para assim que cobre 80%", () => {
    expect(manchete(caso([peca("adesivo", [[FIS, 85_000]]), peca("santinho", [[FIS, 10_000]]), peca("bandeira", [[FIS, 5_000]])]))).toBe("Adesivos.");
  });
  it("genérico entre 30% e 60%: pelas peças; acima de 60% (ou sem peça específica): pelo tipo dominante", () => {
    expect(manchete(caso([peca("impressos", [[FIS, 40_000]], g), peca("santinho", [[FIS, 60_000]])]))).toBe("Santinhos.");
    expect(manchete(caso([peca("impressos", [[FIS, 70_000]], g), peca("Facebook", [[DIG, 30_000]])])))
      .toBe("Material impresso e de rua, sem especificar a peça.");
    expect(manchete(caso([peca("marketing", [[AV, 50_000]], g)]))).toBe("Rádio, TV e vídeo, sem especificar a peça.");
  });
  it("empate no valor: ordem pelo nome; sem peças (API antiga): null", () => {
    const c = caso([peca("santinho", [[FIS, 50_000]]), peca("adesivo", [[FIS, 50_000]])]);
    expect(manchete(c)).toBe("Adesivos e santinhos.");
    expect(pecasDaManchete(c.pecas).map((p) => p.termo)).toEqual(["adesivo", "santinho"]);
    expect(manchetePecas([], c.tipos, c.total)).toBeNull();
  });
});

describe("numerosDestaque e parteDosGastos", () => {
  it("total curto (mil, milhões), parte inteira e cor pelo tipo de maior valor", () => {
    expect(numerosDestaque(dilma().tipos, dilma().total, dilma().despesas)).toEqual({ total: "R$ 444 mil", parte: "11%", grupo: FIS });
    const gov = governador();
    expect(numerosDestaque(gov.tipos, gov.total, gov.despesas)).toEqual({ total: "R$ 12 milhões", parte: "50%", grupo: AV });
    const net = caso([peca("Facebook", [[DIG, 60_000]]), peca("santinho", [[FIS, 40_000]])]);
    expect(numerosDestaque(net.tipos, net.total, net.despesas).grupo).toBe(DIG);
  });
  it("abaixo de 1%: 'menos de 1%'; sem total de despesas, o número 2 não aparece (null)", () => {
    const d = dilma();
    expect(numerosDestaque(d.tipos, d.total, d.total * 300).parte).toBe("menos de 1%");
    expect(numerosDestaque(d.tipos, d.total, 0).parte).toBeNull();
    expect(parteDosGastos(44_428_051, 416_577_401)).toBe("11%");      // 10,67%
    expect(parteDosGastos(4, 1_000)).toBe("menos de 1%");              // 0,4%
    expect(parteDosGastos(5, 1_000)).toBe("1%");                       // 0,5% arredonda para 1
    expect(parteDosGastos(996, 1_000)).toBe("100%");
    expect(parteDosGastos(1, 0)).toBeNull();
  });
  it("empate entre tipos: física, audiovisual, digital", () => {
    const c = caso([peca("Facebook", [[DIG, 50_000]]), peca("jingle", [[AV, 50_000]])]);
    expect(tipoDominante(c.tipos)).toBe(AV);
    expect(tiposPorValor(c.tipos).map((t) => t.grupo)).toEqual([AV, DIG]);
  });
});

describe("linhaNada", () => {
  const nada = (c: Caso) => sp(linhaNada(c.tipos, c.total, c.pecas));
  it("um tipo ausente; dois ausentes com 'nem'; nenhum: null", () => {
    expect(nada(dilma())).toBe("Nada em rádio, TV e vídeo.");
    expect(nada(vereador())).toBe("Nada em rádio, TV e vídeo, nem na internet.");
    expect(nada(caso([peca("jingle", [[AV, 1]])]))).toBe("Nada em material impresso e de rua, nem na internet.");
    const gov = governador();
    expect(linhaNada(gov.tipos, gov.total, gov.pecas)).toBeNull();
  });
  it("genérico acima de 30%: 'R$ X de cada R$ 100 não dizem a peça.' na mesma linha", () => {
    expect(nada(caso([peca("impressos", [[FIS, 40_000]], g), peca("santinho", [[FIS, 60_000]])])))
      .toBe("Nada em rádio, TV e vídeo, nem na internet. R$ 40 de cada R$ 100 não dizem a peça.");
    expect(nada(caso([peca("impressos", [[FIS, 30_000]], g), peca("santinho", [[FIS, 70_000]])])))
      .toBe("Nada em rádio, TV e vídeo, nem na internet.");                 // 30% exatos: não passa
    expect(nada(caso([peca("marketing", [[AV, 50_000]], g), peca("santinho", [[FIS, 25_000]]), peca("site", [[DIG, 25_000]])])))
      .toBe("R$ 50 de cada R$ 100 não dizem a peça.");
  });
});

describe("larguraParaRotulo", () => {
  it("menor degrau da barra em que o rótulo cabe: 0 = qualquer largura; null = nunca", () => {
    expect(larguraParaRotulo("adesivo", 0.84)).toBe(0);                // curto num segmento grande: cabe sempre
    expect(larguraParaRotulo("Impresso e de rua", 0.25)).toBe(640);    // ~140 px / 25% = ~561 px: some no celular
    expect(larguraParaRotulo("Impresso e de rua", 0.84)).toBe(0);
    expect(larguraParaRotulo("Rádio, TV e vídeo", 0.10)).toBe(1600);
    expect(larguraParaRotulo("Impresso e de rua", 0.05)).toBeNull();
    expect(larguraParaRotulo("x", 0)).toBeNull();
  });
  it("todo degrau tem a regra de container query no globals.css", () => {
    const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf-8");
    for (const d of DEGRAUS_BARRA.slice(1)) {
      expect(css, `degrau ${d}`).toContain(`@container barra-pp (max-width: ${d - 0.02}px) { .pp-cabe-${d} { display: none; } }`);
    }
  });
});

describe("barraPecas", () => {
  const resumo = (c: Caso) => barra(c).tipos.map((t) => [t.rotulo, t.de100, t.segmentos.map((s) => `${s.rotulo} ${s.pct}`)]);
  it("Dilma: tipo de maior valor primeiro, peças em ordem decrescente, as menores de 5% juntas em 'outras'", () => {
    expect(resumo(dilma())).toEqual([
      ["Impresso e de rua", 84, ["adesivo 32%", "panfleto 22%", "santinho 20%", "bóton 9%", "outras 1%"]],
      ["Internet", 16, ["Facebook 16%"]],
    ]);
    const outras = barra(dilma()).tipos[0].segmentos.at(-1)!;
    expect([outras.outras, outras.membros.map((m) => m.rotulo)]).toEqual([true, ["som", "faixa"]]);
  });
  it("governador: audiovisual primeiro; peça em dois tipos entra nos dois; genérica em cinza; uma pequena só fica com o nome", () => {
    const b = barra(governador());
    expect(b.tipos.map((t) => t.grupo)).toEqual([AV, FIS, DIG]);
    expect(b.tipos[0].segmentos.map((s) => s.rotulo)).toEqual(["rádio/TV", "vídeo", "outras"]);   // redes, jingle, marketing < 5%
    expect(b.tipos[1].segmentos.map((s) => s.rotulo)).toEqual(["santinho", "outras"]);
    expect(b.tipos[1].segmentos[1].membros.map((m) => m.rotulo)).toContain("rádio/TV");          // os R$ 42,18 físicos
    expect(b.tipos[2].segmentos.map((s) => [s.rotulo, s.generico])).toEqual([["anúncios", false], ["Facebook", false]]);
    const p = barra(prefeito());
    expect(p.tipos[1].segmentos.map((s) => s.rotulo)).toEqual(["anúncios", "redes"]);            // redes, 3,9%: sozinha, com o nome
    const gen = barra(caso([peca("impressos", [[FIS, 70_000]], g), peca("santinho", [[FIS, 30_000]])]));
    expect(gen.tipos[0].segmentos.map((s) => [s.rotulo, s.generico])).toEqual([["impressos", true], ["santinho", false]]);
  });
  it("uma linha por tipo, da maior parcela para a menor, com o percentual desta campanha", () => {
    expect(barra(governador()).tipos.map((t) => [t.rotulo, t.pct])).toEqual([
      ["Rádio, TV e vídeo", "68%"], ["Impresso e de rua", "25%"], ["Internet", "7%"]]);
    expect(barra(dilma()).tipos.map((t) => [t.rotulo, t.pct])).toEqual([["Impresso e de rua", "84%"], ["Internet", "16%"]]);
    const minusculo = barra(caso([peca("santinho", [[FIS, 998]]), peca("site", [[DIG, 2]])]));
    expect(minusculo.tipos.map((t) => t.pct)).toEqual(["100%", "menos de 1%"]);           // de100 = 0, mas existe
  });
  it("tipos com 0% não ganham linha", () => {
    expect(barra(dilma()).tipos.map((t) => t.grupo)).toEqual([FIS, DIG]);                 // nada em rádio, TV e vídeo
    expect(barra(caso([peca("santinho", [[FIS, 60]]), peca("adesivo", [[FIS, 40]])])).tipos.map((t) => t.grupo)).toEqual([FIS]);
  });
  it("rótulo das peças numa linha só ('adesivo 32%'): o degrau sai desse texto", () => {
    for (const s of barra(dilma()).tipos.flatMap((t) => t.segmentos)) expect(s.cabe).toBe(larguraParaRotulo(`${s.rotulo} ${s.pct}`, s.parte));
  });
  it("sem peças (API antiga): um segmento 'sem detalhe' por tipo, com o total oficial", () => {
    const d = dilma();
    const b = barraPecas(d.tipos, [], d.total);
    expect(b.tipos.map((t) => t.segmentos.map((s) => [s.rotulo, s.centavos, s.generico]))).toEqual([
      [["sem detalhe", 37_316_470, true]], [["sem detalhe", 7_111_581, true]]]);
  });
  it("mostrarBarra: não com um tipo e uma peça específica", () => {
    expect(mostrarBarra(barra(vereador()))).toBe(false);
    expect(mostrarBarra(barra(dilma()))).toBe(true);
    expect(mostrarBarra(barra(caso([peca("santinho", [[FIS, 90]]), peca("adesivo", [[FIS, 10]])])))).toBe(true);
    expect(mostrarBarra(barra(caso([peca("impressos", [[FIS, 100]], g)])))).toBe(true);
  });
  it("aria-label: cada tipo com esta, a típica e as peças", () => {
    const d = dilma();
    const t = tipicasPorTipo([ref({ mediana: 0.67 }), ref({ grupo: DIG, mediana: 0.17 })], senadorMG);
    expect(descricaoBarra(barraPecas(d.tipos, d.pecas, d.total, t))).toBe("Impresso e de rua: esta 84%, típica 67%; adesivo 32%, panfleto 22%, "
      + "santinho 20%, bóton 9%, outras (som e faixa) 1%. Internet: esta 16%, típica 17%; Facebook 16%.");
    expect(descricaoBarra(barra(d))).toBe("Impresso e de rua: esta 84%; adesivo 32%, panfleto 22%, santinho 20%, bóton 9%, "
      + "outras (som e faixa) 1%. Internet: esta 16%; Facebook 16%.");                     // sem referência: sem típica
  });
});

describe("a típica em cada linha", () => {
  const refs = [ref({ mediana: 0.67 }), ref({ grupo: DIG, mediana: 0.17 }), ref({ grupo: AV, mediana: 0.09 })];
  const linhas = (b: ReturnType<typeof barra>) => b.tipos.map((t) => [t.grupo, t.tipica, t.pctTipica]);
  it("cada tipo com a típica daquele tipo; o tipo com 0% não tem linha", () => {
    const d = dilma();
    expect(linhas(barraPecas(d.tipos, d.pecas, d.total, tipicasPorTipo(refs, senadorMG)))).toEqual([[FIS, 0.67, "67%"], [DIG, 0.17, "17%"]]);
  });
  it("grupo pequeno: a típica de cada tipo sem a própria campanha (parcela daquele tipo em 'parcelas')", () => {
    const ps: LinhaParcelas[] = [[0.84, 0, 0.16], [0.5, 0.1, 0.4], [0.6, 0.2, 0.2], [0.7, 0, 0.3], [0.9, 0.1, 0]].map(([f, a, dg], i) => ({
      id_candidatura: i + 1, ano: 2018, id_cargo: 5, cargo: "Senador", uf: "MG", propaganda_fisica: f, propaganda_audiovisual: a, propaganda_digital: dg }));
    const r5 = refs.map((x) => ({ ...x, campanhas: 5 }));
    const d = dilma();
    const t = tipicasPorTipo(r5, { ...senadorMG, id_candidatura: 1 }, ps);              // sem a 1: fís 0,5 0,6 0,7 0,9; dig 0 0,2 0,3 0,4
    const b = barraPecas(d.tipos, d.pecas, d.total, t);
    expect(b.tipos.map((x) => x.grupo)).toEqual([FIS, DIG]);
    expect(b.tipos[0].tipica).toBeCloseTo(0.65, 12);
    expect(b.tipos[1].tipica).toBeCloseTo(0.25, 12);
    expect(b.tipos.map((x) => x.pctTipica)).toEqual(["65%", "25%"]);
    expect([t[FIS]?.semAPropria, t[FIS]?.campanhas]).toEqual([true, 4]);
    expect(t[AV]?.mediana).toBeCloseTo(0.1, 12);                                         // audiovisual: 0 0,1 0,1 0,2
    expect(legendaTipica(b, t, senadorMG)).toBe("Típica entre as outras 4 campanhas a senador em Minas Gerais em 2018, em cada tipo. "
      + "Cada barra vai de 0 a 100% da propaganda.");
    const semExcluir = tipicasPorTipo(r5, { ...senadorMG, id_candidatura: 99 }, ps);      // ausente de "parcelas": o grupo inteiro
    expect(barraPecas(d.tipos, d.pecas, d.total, semExcluir).tipos.map((x) => x.tipica)).toEqual([0.67, 0.17]);
    expect(legendaTipica(barraPecas(d.tipos, d.pecas, d.total, semExcluir), semExcluir, senadorMG)).toMatch(/^Típica entre as 5 campanhas a senador/);
  });
  it("grupo grande: 'Típica das campanhas a …'; presidente sem estado", () => {
    const d = dilma();
    const t = tipicasPorTipo(refs.map((x) => ({ ...x, campanhas: 30 })), senadorMG);
    expect(legendaTipica(barraPecas(d.tipos, d.pecas, d.total, t), t, senadorMG))
      .toBe("Típica das campanhas a senador em Minas Gerais em 2018, em cada tipo. Cada barra vai de 0 a 100% da propaganda.");
    const p = { id_cargo: 1, cargo: "Presidente", ano: 2022, uf: null };
    const tp = tipicasPorTipo(refs.map((x) => ({ ...x, id_cargo: 1, ano: 2022, uf: "BR", campanhas: 11 })), p);
    expect(legendaTipica(barraPecas(d.tipos, d.pecas, d.total, tp), tp, p))
      .toBe("Típica entre as 11 campanhas a presidente em 2022, em cada tipo. Cada barra vai de 0 a 100% da propaganda.");
  });
  it("sem referência: sem traço, sem 'típica X%' e sem legenda", () => {
    const d = dilma();
    for (const t of [tipicasPorTipo(null, senadorMG), tipicasPorTipo([ref({ uf: "RJ" })], senadorMG), {}]) {
      const b = barraPecas(d.tipos, d.pecas, d.total, t);
      expect(linhas(b)).toEqual([[FIS, null, null], [DIG, null, null]]);
      expect(legendaTipica(b, t, senadorMG)).toBeNull();
    }
  });
  it("menos de 3 outras campanhas: nenhuma linha tem traço", () => {
    const ps: LinhaParcelas[] = [0.84, 0.5, 0.6].map((f, i) => ({
      id_candidatura: i + 1, ano: 2018, id_cargo: 5, cargo: "Senador", uf: "MG", propaganda_fisica: f, propaganda_audiovisual: 0, propaganda_digital: 1 - f }));
    const d = dilma();
    const t = tipicasPorTipo(refs.map((x) => ({ ...x, campanhas: 3 })), { ...senadorMG, id_candidatura: 1 }, ps);
    const b = barraPecas(d.tipos, d.pecas, d.total, t);
    expect(linhas(b)).toEqual([[FIS, null, null], [DIG, null, null]]);
    expect(legendaTipica(b, t, senadorMG)).toBeNull();
    expect(tipicasPorTipo(refs.map((x) => ({ ...x, campanhas: 2 })), senadorMG)).toEqual({ [FIS]: null, [AV]: null, [DIG]: null });
  });
});

describe("comparacao: tamanho do grupo", () => {
  const frase = (campanhas: number) => fraseComparacao([ref({ campanhas })], senadorMG, dilma().tipos);
  it("30 ou mais: sem número; de 3 a 29: 'Típica entre as N campanhas'; menos de 3: nada", () => {
    expect([LIMIAR_GRUPO_PEQUENO, LIMIAR_GRUPO_MINIMO]).toEqual([30, 3]);
    expect(frase(30)).toBe("Típica campanha a senador em Minas Gerais em 2018: 68% em impresso e de rua; esta: 84%.");
    expect(frase(29)).toBe("Típica entre as 29 campanhas a senador em Minas Gerais em 2018: 68% em impresso e de rua; esta: 84%.");
    expect(frase(3)).toBe("Típica entre as 3 campanhas a senador em Minas Gerais em 2018: 68% em impresso e de rua; esta: 84%.");
    expect(frase(2)).toBeNull();
    expect(comparacao([ref({ campanhas: 2 })], senadorMG, dilma().tipos, true)).toBeNull();
    expect(comparacao([ref({ campanhas: 2 })], senadorMG, dilma().tipos, false)).toBeNull();
    expect(fraseComparacao(r(1).map((x) => ({ ...x, campanhas: 2 })), vereadorMG, vereador().tipos)).toBeNull();   // nem "Como a maioria…"
    expect(fraseComparacao(r(1).map((x) => ({ ...x, campanhas: 3 })), vereadorMG, vereador().tipos))
      .toBe("Como a maioria dos candidatos a vereador em Minas Gerais em 2024.");                               // quase total não muda
    expect(frase(1_234)).toMatch(/^Típica campanha a senador/);
  });
  it("Lula 2022 com os números do MotherDuck (43,1%, 11 campanhas): presidente sem estado; o mesmo valor no traço e no aria-label", () => {
    const lula = caso([peca("rádio/TV", [[AV, 3_789_900_000]]), peca("jingle", [[AV, 123_880_000]]), peca("Google", [[DIG, 2_518_993_688]]),
      peca("site", [[DIG, 37_500_000]]), peca("adesivo", [[FIS, 1_322_877_220]]), peca("impressos", [[FIS, 1_289_222_838]], g)]);
    const p = { id_cargo: 1, cargo: "Presidente", ano: 2022, uf: null };
    const refs = [ref({ id_cargo: 1, ano: 2022, uf: "BR", grupo: AV, mediana: 0.43085, campanhas: 11 })];
    expect(comparacao(refs, p, lula.tipos, true)).toBeNull();                              // com o gráfico, a típica fica nas linhas
    const t = tipicasPorTipo(refs, p);
    const b = barraPecas(lula.tipos, lula.pecas, lula.total, t);
    expect(b.tipos.map((x) => [x.grupo, x.pct, x.pctTipica])).toEqual([[AV, "43%", "43%"], [FIS, "29%", null], [DIG, "28%", null]]);
    expect(descricaoBarra(b)).toMatch(/^Rádio, TV e vídeo: esta 43%, típica 43%; /);
    expect(legendaTipica(b, t, p)).toBe("Típica entre as 11 campanhas a presidente em 2022, em cada tipo. Cada barra vai de 0 a 100% da propaganda.");
  });
});

describe("mediana", () => {
  it("como a median() do DuckDB: ímpar, o do meio; par, a média dos dois do meio", () => {
    expect([mediana([3, 1, 2]), mediana([4, 1, 3, 2]), mediana([0.5]), mediana([])]).toEqual([2, 2.5, 0.5, null]);
  });
});

describe("tipica: sem a própria campanha nos grupos pequenos", () => {
  // grupo senador MG 2018 inventado: a campanha 1 (a "Dilma") e mais N, com a parcela física de cada uma
  const parcelas = (fisicas: number[], o: Partial<LinhaParcelas> = {}): LinhaParcelas[] => fisicas.map((f, i) => ({
    id_candidatura: i + 1, ano: 2018, id_cargo: 5, cargo: "Senador", uf: "MG",
    propaganda_fisica: f, propaganda_audiovisual: 0, propaganda_digital: 1 - f, ...o }));
  const dilma1 = { ...senadorMG, id_candidatura: 1 };
  const refDe = (ps: LinhaParcelas[], o: Partial<LinhaReferencia> = {}) => [ref({ campanhas: ps.length, mediana: 0.7, ...o })];
  it("número par de outras campanhas: a média das duas do meio; n = o grupo menos 1", () => {
    const ps = parcelas([0.9, 0.5, 0.6, 0.7, 0.8]);                      // sem a 1: 0,5 0,6 0,7 0,8
    const t = tipica(refDe(ps), dilma1, FIS, ps);
    expect([t?.campanhas, t?.semAPropria]).toEqual([4, true]);
    expect(t?.mediana).toBeCloseTo(0.65, 12);
    expect(fraseComparacao(refDe(ps), dilma1, dilma().tipos, ps))
      .toBe("Típica entre as outras 4 campanhas a senador em Minas Gerais em 2018: 65% em impresso e de rua; esta: 84%.");
  });
  it("número ímpar de outras campanhas: a do meio", () => {
    const ps = parcelas([0.9, 0.2, 0.6, 0.4]);                           // sem a 1: 0,2 0,4 0,6
    expect(tipica(refDe(ps), dilma1, FIS, ps)).toEqual({ mediana: 0.4, campanhas: 3, semAPropria: true });
  });
  it("campanha ausente de 'parcelas': a referencia com o grupo inteiro, como antes", () => {
    const ps = parcelas([0.9, 0.5, 0.6, 0.7, 0.8]);
    expect(tipica(refDe(ps), { ...senadorMG, id_candidatura: 99 }, FIS, ps)).toEqual({ mediana: 0.7, campanhas: 5, semAPropria: false });
    expect(fraseComparacao(refDe(ps), { ...senadorMG, id_candidatura: 99 }, dilma().tipos, ps)).toMatch(/^Típica entre as 5 campanhas a senador/);
    expect(tipica(refDe(ps), senadorMG, FIS, ps)?.semAPropria).toBe(false);                     // sem id: idem
  });
  it("limite: 3 outras campanhas comparam; 2 não (nem marca, nem frase)", () => {
    const quatro = parcelas([0.9, 0.2, 0.6, 0.4]), tres = parcelas([0.9, 0.2, 0.6]);
    expect(tipica(refDe(quatro), dilma1, FIS, quatro)?.campanhas).toBe(3);
    expect(tipica(refDe(tres), dilma1, FIS, tres)).toBeNull();
    expect(comparacao(refDe(tres), dilma1, dilma().tipos, false, tres)).toBeNull();
    expect(tipica(refDe(tres), { ...senadorMG, id_candidatura: 99 }, FIS, tres)?.campanhas).toBe(3);   // ausente: grupo inteiro
  });
  it("grupos de 30 ou mais ficam com a referencia, mesmo com a campanha em 'parcelas'", () => {
    const ps = parcelas(Array.from({ length: 30 }, (_, i) => i / 30));
    expect(tipica(refDe(ps), dilma1, FIS, ps)).toEqual({ mediana: 0.7, campanhas: 30, semAPropria: false });
    expect([grupoPequeno(refDe(ps), senadorMG), grupoPequeno(refDe(ps.slice(1)), senadorMG), grupoPequeno(null, senadorMG)]).toEqual([false, true, false]);
  });
  it("presidente sem estado; o traço e o aria-label com o mesmo valor", () => {
    const p = { id_cargo: 1, cargo: "Presidente", ano: 2022, uf: null, id_candidatura: 1 };
    const ps = parcelas([0.1, 0.3, 0.5, 0.2, 0.6], { ano: 2022, id_cargo: 1, cargo: "Presidente", uf: "BR" });
    const refs = [ref({ id_cargo: 1, ano: 2022, uf: "BR", grupo: FIS, mediana: 0.3, campanhas: 5 })];
    const c = caso([peca("santinho", [[FIS, 60]]), peca("site", [[DIG, 40]])]);
    const t = tipicasPorTipo(refs, p, ps);                               // sem a 1: 0,2 0,3 0,5 0,6 -> 0,4
    const b = barraPecas(c.tipos, c.pecas, c.total, t);
    expect(b.tipos[0].tipica).toBeCloseTo(0.4, 12);
    expect(descricaoBarra(b)).toBe("Impresso e de rua: esta 60%, típica 40%; santinho 60%. Internet: esta 40%; site 40%.");
    expect(legendaTipica(b, t, p)).toBe("Típica entre as outras 4 campanhas a presidente em 2022, em cada tipo. Cada barra vai de 0 a 100% da propaganda.");
    expect(fraseComparacao(refs, p, c.tipos, ps)).toBe("Típica entre as outras 4 campanhas a presidente em 2022: 40% em impresso e de rua; esta: 60%.");
  });
  it("o limite de grupo pequeno é o mesmo na q9.sql e na lib", () => {
    const sql = readFileSync(new URL("../../api/app/analises/q9.sql", import.meta.url), "utf-8");
    const limite = sql.match(/QUALIFY count\(\*\) OVER \(PARTITION BY ano, id_cargo, uf\) < (\d+)/);
    expect(Number(limite?.[1])).toBe(LIMIAR_GRUPO_PEQUENO);
  });
});

describe("temDespesaDupla", () => {
  it("Dilma: as peças de impresso e de rua somam 36 despesas, o tipo tem 34: a nota aparece", () => {
    const d = dilma(), t = tabelaPecas(d.tipos, d.pecas, d.total);
    expect([t[0].linhas.reduce((s, l) => s + l.despesas, 0), t[0].despesas]).toEqual([36, 34]);
    expect(temDespesaDupla(t)).toBe(true);
    expect(NOTA_DESPESA_DUPLA).toBe("Uma despesa que cita mais de uma peça é contada em cada uma.");
  });
  it("sem despesa dupla: não aparece", () => {
    const c = caso([peca("santinho", [[FIS, 60]], { despesas: 2 }), peca("adesivo", [[FIS, 40]], { despesas: 3 })],
      { categorias: [{ origem: "Publicidade por materiais impressos", grupo: FIS, lancamentos: 5, centavos: 100 }] });
    expect(temDespesaDupla(tabelaPecas(c.tipos, c.pecas, c.total))).toBe(false);
  });
});

describe("comparacao (texto no topo)", () => {
  it("com o gráfico e referência: nenhum texto (a típica fica nas linhas)", () => {
    expect(comparacao([ref({ grupo: DIG, mediana: 0.1 }), ref({})], senadorMG, dilma().tipos, true)).toBeNull();
  });
  it("padrão quase total: 'Como a maioria…', com ou sem o gráfico", () => {
    const c = caso([peca("santinho", [[FIS, 90]]), peca("adesivo", [[FIS, 10]])]);
    expect(comparacao(r(1), vereadorMG, c.tipos, true)).toBe("Como a maioria dos candidatos a vereador em Minas Gerais em 2024.");
    expect(comparacao(r(1), vereadorMG, vereador().tipos, false)).toBe("Como a maioria dos candidatos a vereador em Minas Gerais em 2024.");
  });
  it("sem o gráfico (um tipo e uma peça): a frase de comparação, em texto", () => {
    expect(comparacao(r(0.68), vereadorMG, vereador().tipos, false))
      .toBe("Típica campanha a vereador em Minas Gerais em 2024: 68% em impresso e de rua; esta: 100%.");
  });
  it("sem referência: nenhum texto", () => {
    expect(comparacao(null, senadorMG, dilma().tipos, false)).toBeNull();
    expect(comparacao([ref({ uf: "RJ" })], senadorMG, dilma().tipos, false)).toBeNull();
  });
});

describe("linhaNada com a típica", () => {
  const nada = (c: Caso, refs: LinhaReferencia[] | null, quem = senadorMG) => sp(linhaNada(c.tipos, c.total, c.pecas, tipicasPorTipo(refs, quem)));
  it("um tipo zerado com típica acima de zero: 'onde a típica põe X%'", () => {
    expect(nada(dilma(), [ref({ grupo: AV, mediana: 0.09 })])).toBe("Nada em rádio, TV e vídeo, onde a típica põe 9%.");
  });
  it("dois tipos zerados: entre parênteses, com 'nem'; o que tem típica 0% fica sem ela", () => {
    const refs = (av: number, dig: number) => [ref({ id_cargo: 13, ano: 2024, grupo: AV, mediana: av, campanhas: 500 }),
      ref({ id_cargo: 13, ano: 2024, grupo: DIG, mediana: dig, campanhas: 500 })];
    expect(nada(vereador(), refs(0.09, 0.06), vereadorMG)).toBe("Nada em rádio, TV e vídeo (a típica põe 9%), nem na internet (a típica põe 6%).");
    expect(nada(vereador(), refs(0, 0.06), vereadorMG)).toBe("Nada em rádio, TV e vídeo, nem na internet (a típica põe 6%).");
    expect(nada(vereador(), refs(0, 0), vereadorMG)).toBe("Nada em rádio, TV e vídeo, nem na internet.");
  });
  it("típica 0% ou sem referência: como antes", () => {
    expect(nada(dilma(), [ref({ grupo: AV, mediana: 0 })])).toBe("Nada em rádio, TV e vídeo.");
    expect(nada(dilma(), null)).toBe("Nada em rádio, TV e vídeo.");
    expect(nada(dilma(), [ref({ grupo: AV, mediana: 0.09, campanhas: 2 })])).toBe("Nada em rádio, TV e vídeo.");   // grupo pequeno demais
  });
  it("com o genérico acima de 30%, a frase do genérico continua depois", () => {
    const c = caso([peca("impressos", [[FIS, 40_000]], g), peca("santinho", [[FIS, 60_000]]), peca("site", [[DIG, 1]])]);
    expect(nada(c, [ref({ grupo: AV, mediana: 0.2 })])).toBe("Nada em rádio, TV e vídeo, onde a típica põe 20%. R$ 40 de cada R$ 100 não dizem a peça.");
  });
});

describe("parteTabela", () => {
  it("uma casa decimal; abaixo de 0,1%, '< 0,1%'", () => {
    expect([parteTabela(0.2163), parteTabela(0.001), parteTabela(0.00099), parteTabela(0), parteTabela(1)]).toEqual(["21,6%", "0,1%", "< 0,1%", "0,0%", "100,0%"]);
  });
});

describe("tabelaPecas", () => {
  it("Dilma: agrupada por tipo, grupos e linhas em ordem decrescente, nomes por extenso", () => {
    const d = dilma();
    const t = tabelaPecas(d.tipos, d.pecas, d.total);
    expect(t.map((x) => [x.rotulo, parteTabela(x.parte)])).toEqual([["Impresso e de rua", "84,0%"], ["Internet", "16,0%"]]);
    expect(t[0].linhas.map((l) => [l.nome, parteTabela(l.parte)])).toEqual([
      ["adesivos", "32,1%"], ["panfletos", "21,6%"], ["santinhos", "20,0%"], ["bótons", "9,2%"], ["carros de som", "0,8%"], ["faixas", "0,2%"]]);
  });
  it("peça em dois tipos aparece nos dois grupos, com o valor e as despesas de cada um; '< 0,1%'", () => {
    const gov = governador();
    const t = tabelaPecas(gov.tipos, [peca("rádio/TV", [[AV, 373_850_000], [FIS, 4_218]], { despesas: 7,
      por_tipo: [{ grupo: AV, centavos: 373_850_000, despesas: 6 }, { grupo: FIS, centavos: 4_218, despesas: 1 }] }), ...gov.pecas.slice(1)], gov.total);
    const radio = t.flatMap((x) => x.linhas.filter((l) => l.nome === "programas de rádio/TV").map((l) => [x.grupo, l.centavos, l.despesas, parteTabela(l.parte)]));
    expect(radio).toEqual([[AV, 373_850_000, 6, "31,1%"], [FIS, 4_218, 1, "< 0,1%"]]);
    expect(t[1].linhas.at(-1)!.nome).toBe("programas de rádio/TV");
  });
  it("detalhe: os formatos com % ou a explicação; genérica marcada", () => {
    const c = caso([
      peca("adesivo", [[FIS, 100]], { detalhes: [{ termo: "praguinha", centavos: 48 }, { termo: "adesivo", centavos: 41 }, { termo: "adesivo para-choque", centavos: 11 }] }),
      peca("Facebook", [[DIG, 50]], { explicacao: "Facebook, Instagram e WhatsApp" }), peca("impressos", [[FIS, 30]], g),
    ]);
    const linhas = tabelaPecas(c.tipos, c.pecas, c.total).flatMap((x) => x.linhas).map((l) => [l.nome, l.detalhe, l.generico]);
    expect(linhas).toEqual([
      ["adesivos", "praguinha 48%, adesivo 41%, para-choque 11%", false], ["material impresso", null, true],
      ["anúncios no Facebook", "Facebook, Instagram e WhatsApp", false]]);
  });
});

describe("cabeçalhos dos grupos das tabelas", () => {
  it("totais oficiais do tipo, iguais nas duas tabelas; a soma dos cabeçalhos é o total de propaganda", () => {
    for (const c of [dilma(), governador(), prefeito(), vereador()]) {
      const pecas = tabelaPecas(c.tipos, c.pecas, c.total), cats = tabelaCategorias(c.a, c.tipos);
      expect(pecas.reduce((s, g) => s + g.centavos, 0)).toBe(c.total);
      expect(cats.reduce((s, g) => s + g.centavos, 0)).toBe(c.total);
      expect(pecas.map((g) => [g.grupo, g.despesas, g.centavos])).toEqual(cats.map((g) => [g.grupo, g.despesas, g.centavos]));
      for (const g of pecas) expect(g.linhas.reduce((s, l) => s + l.centavos, 0)).toBe(g.centavos);   // as linhas fecham o cabeçalho
    }
    expect(tabelaCategorias(analise(dilma()), dilma().tipos).map((g) => [g.rotulo, g.despesas, g.centavos]))
      .toEqual([["Impresso e de rua", 34, 37_316_470], ["Internet", 2, 7_111_581]]);
  });
});

describe("tabelaCategorias e totalTabela", () => {
  it("Dilma: categorias do TSE no mesmo formato, rótulo curto e classificação original embaixo", () => {
    const a = analise(dilma());
    const t = tabelaCategorias(a, composicaoPorTipo(a));
    expect(t.map((x) => x.rotulo)).toEqual(["Impresso e de rua", "Internet"]);
    expect(t[0].linhas.map((l) => [l.nome, l.detalhe, l.despesas, parteTabela(l.parte)])).toEqual([
      ["Materiais impressos", "Publicidade por materiais impressos", 28, "65,5%"], ["Adesivos", "Publicidade por adesivos", 4, "16,7%"],
      ["Jornais e revistas", "Publicidade por jornais e revistas", 1, "1,0%"], ["Carros de som", "Publicidade por carros de som", 1, "0,8%"]]);
    const total = totalTabela(a);
    expect([total.despesas, total.centavos, total.parte, sp(total.frase)])
      .toEqual([36, 44_428_051, "10,7% do total", "Total de despesas da campanha: R$ 4.165.774,01, em 10 lançamentos."]);
  });
  it("sem total de despesas: a linha só com despesas e valor, sem a frase", () => {
    const a = analisar({ lancamentos: 1, total_centavos: 0, propaganda_centavos: 100 }, [{ origem: "Publicidade por adesivos", grupo: FIS, lancamentos: 1, centavos: 100 }]);
    if (a.estado !== "com_propaganda") throw new Error("caso sem propaganda");
    expect(totalTabela(a)).toEqual({ despesas: 1, centavos: 100, parte: null, frase: null });
  });
});

describe("Dilma 2018 de ponta a ponta", () => {
  it("manchete, R$ 444 mil, 11%; impresso 84% com típica 67%, internet 16%, sem linha de rádio, TV e vídeo", () => {
    const d = dilma();
    const t = tipicasPorTipo([ref({ mediana: 0.67 }), ref({ grupo: DIG, mediana: 0.17 }), ref({ grupo: AV, mediana: 0 })], senadorMG);
    const b = barraPecas(d.tipos, d.pecas, d.total, t);
    expect({
      manchete: manchete(d), numeros: numerosDestaque(d.tipos, d.total, d.despesas), nada: linhaNada(d.tipos, d.total, d.pecas, t),
      linhas: b.tipos.map((x) => [x.rotulo, x.pct, x.pctTipica, x.segmentos.map((s) => `${s.rotulo} ${s.pct}`)]),
      grafico: mostrarBarra(b), texto: comparacao([ref({ mediana: 0.67 })], senadorMG, d.tipos, mostrarBarra(b)), nuvem: mostrarNuvem(d.pecas),
    }).toEqual({
      manchete: "Adesivos, panfletos e santinhos.", numeros: { total: "R$ 444 mil", parte: "11%", grupo: FIS },
      nada: "Nada em rádio, TV e vídeo.",
      linhas: [["Impresso e de rua", "84%", "67%", ["adesivo 32%", "panfleto 22%", "santinho 20%", "bóton 9%", "outras 1%"]],
        ["Internet", "16%", "17%", ["Facebook 16%"]]],
      grafico: true, texto: null, nuvem: true,
    });
  });
});

describe("mostrarNuvem", () => {
  it("só com 4 ou mais peças específicas", () => {
    const tres = [peca("adesivo", [[FIS, 1]]), peca("santinho", [[FIS, 1]]), peca("bandeira", [[FIS, 1]]), peca("impressos", [[FIS, 9]], g)];
    expect(mostrarNuvem(tres)).toBe(false);
    expect(mostrarNuvem([...tres, peca("panfleto", [[FIS, 1]])])).toBe(true);
  });
});

describe("fraseComparacao", () => {
  it("estado por extenso, pelo tipo dominante desta campanha", () => {
    const c = { id_cargo: 5, cargo: "Senador", ano: 2018, uf: "MG" };
    expect(fraseComparacao([ref({ grupo: DIG, mediana: 0.1 }), ref({})], c, dilma().tipos))
      .toBe("Típica entre as 12 campanhas a senador em Minas Gerais em 2018: 68% em impresso e de rua; esta: 84%.");
    expect(fraseComparacao([ref({ id_cargo: 3, uf: "RJ", grupo: AV, mediana: 0.49 })], { id_cargo: 3, cargo: "Governador", ano: 2018, uf: "RJ" }, governador().tipos))
      .toBe("Típica entre as 12 campanhas a governador no Rio de Janeiro em 2018: 49% em rádio, TV e vídeo; esta: 68%.");
    expect(fraseComparacao([ref({ uf: "RJ" })], c, dilma().tipos)).toBeNull();
    expect(fraseComparacao(null, c, dilma().tipos)).toBeNull();
  });
  it("padrão quase total (≥ 95% na típica e nesta): 'Como a maioria…'; abaixo disso, a frase de sempre", () => {
    const v = { id_cargo: 13, cargo: "Vereador", ano: 2024, uf: "MG" };
    const r = (mediana: number) => [ref({ id_cargo: 13, ano: 2024, mediana, campanhas: 29_929 })];
    expect(fraseComparacao(r(1), v, vereador().tipos)).toBe("Como a maioria dos candidatos a vereador em Minas Gerais em 2024.");
    expect(fraseComparacao(r(0.95), v, vereador().tipos)).toBe("Como a maioria dos candidatos a vereador em Minas Gerais em 2024.");
    expect(fraseComparacao(r(0.94), v, vereador().tipos)).toBe("Típica campanha a vereador em Minas Gerais em 2024: 94% em impresso e de rua; esta: 100%.");
    const quase = caso([peca("santinho", [[FIS, 94]]), peca("site", [[DIG, 6]])]).tipos;      // esta: 94%
    expect(fraseComparacao(r(1), v, quase)).toBe("Típica campanha a vereador em Minas Gerais em 2024: 100% em impresso e de rua; esta: 94%.");
  });
  it("presidente: sem estado", () => {
    const p = { id_cargo: 1, cargo: "Presidente", ano: 2022, uf: null };
    expect(fraseComparacao([ref({ id_cargo: 1, ano: 2022, uf: "BR", grupo: AV, mediana: 0.31 })], p, governador().tipos))
      .toBe("Típica entre as 12 campanhas a presidente em 2022: 31% em rádio, TV e vídeo; esta: 68%.");
    expect(fraseComparacao([ref({ id_cargo: 1, ano: 2022, uf: "BR", mediana: 1 })], p, vereador().tipos)).toBe("Como a maioria dos candidatos a presidente em 2022.");
  });
});
