import { describe, expect, it } from "vitest";
import {
  ANOS_DINHEIRO, cargosDoAno, classeComPorte, escolhaMapaDinheiro, hrefMapaDinheiro, contaGasto, mediaPorCandidato, mediasPorResultado, ordenarLinhas, valorDoPorte, contaGastoEstado, corCidade, corPorFaixas, ehMunicipal, legendaPorFaixas, maisRecebeuPublico, tresGrupos, valorDoEstado, fraseTaxas, legendaCidade, qualificacao, referenciaDoPorte, textoValor, valorCidade, abaDe, anoAnterior, cidadesDoPorte, coberturaCurta, composicaoDespesas, contasDaCidade, foraDaDisputaPorte, origemDoDinheiro, contasDoEstado, contasDoPorte, diferencaRelativa, faixasDe, foraDaDisputa, fraseCobertura, ordemCandidatos, ordenarCandidatos, textoDiferenca, unidade, variacaoNominal, coberturaSelo, descricaoFatias, fatias, seloValor, seta, anosDoCargo, barrasQuartis, custoPorVoto, faixaGasto, fraseConcentracao, medidasNosAnos, partidosDeCandidatos, partidosDoRecorte, quartisDeCandidatos, quartisDoRecorte, setaMedida, totalPartidos, caminhoPecas, cargoDeCandidatos, cargosDoRecorte, deCada100, dependeram, fraseDeCada100, fraseDependeram, parteDependeu, fundoDe, maioresDeCandidatos, maioresDoRecorte, parteDoTotal, quemDe, textoDependeram, totalFundos, quartisDeEleicao, fraseQuartis, medidaDe, MEDIDAS_ANOS, MEIAS, opcoesMunicipio, ufDoMunicipio, PINTAR, SECOES_GASTARAM, telaDe, TITULO_TELA, SECOES, type ContagemFundos, type LinhaCargo, type LinhaMaior, type LinhaPartido, type LinhaQuartil, type LinhaDespesa, intervalo, barraPropaganda, parteDaPropaganda, GRUPOS_DESPESA, gastoComForaDaDisputa, foraDoRecorte, cargosComForaDaDisputa, hrefLegislativoCusto,
} from "../src/lib/dinheiro";
import { reais } from "../src/lib/format";
import type { CandidatoLocal, LinhaResumo } from "../src/lib/territorio";

const r = (o: Partial<LinhaResumo>): LinhaResumo => ({
  ano: 2024, id_municipio: 1, uf: "PE", vereador_candidatos: 100, vereador_eleitos: 10, vereador_vagas: 10,
  vereador_gasto: 500_000, vereador_receita: 600_000, vereador_publica: 300_000, vereador_sem_prestacao: 0, prefeito_sem_prestacao: 0,
  prefeito_candidatos: 3, prefeito_gasto: 900_000, prefeito_receita: 400_000, prefeito_publica: 300_000,
  prefeito_id_candidato: 7, prefeito_nome: "FULANO", prefeito_partido: "PFA", prefeito_votos: 5000, prefeito_gasto_eleito: 400_000,
  maior_venceu: true, eleitorado: 30_000, rec_mais_cand: 20, rec_mais_eleitos: 6, ...o,
});

describe("cargosDoAno e ehMunicipal", () => {
  it("dá os cargos de cada tipo de eleição", () => {
    expect(ehMunicipal(2024)).toBe(true);
    expect(cargosDoAno(2024)[0]).toBe("Vereador");
    expect(cargosDoAno(2022)).toContain("Deputado federal");
  });
});

describe("valorCidade", () => {
  it("não mistura cargos", () => {
    expect(valorCidade(r({}), "gasto", "Vereador")).toBe(50_000);
    expect(valorCidade(r({}), "gasto", "Prefeito")).toBe(900_000);
    expect(valorCidade(r({}), "publico", "Vereador")).toBeCloseTo(0.5);
    expect(valorCidade(r({}), "publico", "Prefeito")).toBeCloseTo(0.75);
    expect(valorCidade(r({}), "resultado", "Prefeito")).toBe(1);
    expect(valorCidade(r({}), "resultado", "Vereador")).toBeCloseTo(0.3);
  });
  it("devolve null (não informado), e não zero, quando falta o dado", () => {
    expect(valorCidade(undefined, "gasto", "Vereador")).toBeNull();
    expect(valorCidade(r({ vereador_receita: 0 }), "publico", "Vereador")).toBeNull();
    expect(valorCidade(r({ maior_venceu: null }), "resultado", "Prefeito")).toBeNull();
    expect(valorCidade(r({ rec_mais_cand: 0 }), "resultado", "Vereador")).toBeNull();
    expect(valorCidade(r({ prefeito_candidatos: 0 }), "gasto", "Prefeito")).toBeNull();
  });
  it("soma o gasto de quem não chegou a disputar no gasto e no gasto por eleitor (como na P1), não nas outras abas", () => {
    const fora = r({ vereador_nao_disputou_gasto: 100_000, prefeito_nao_disputou_gasto: 60_000 });
    expect(valorCidade(fora, "gasto", "Vereador")).toBe(60_000);
    expect(valorCidade(fora, "gasto", "Prefeito")).toBe(960_000);
    expect(valorCidade(fora, "eleitor", "Vereador")).toBeCloseTo(600_000 / 30_000);
    expect(valorCidade(fora, "eleitor", "Prefeito")).toBe(32);
    expect(valorCidade(fora, "publico", "Vereador")).toBeCloseTo(0.5);
    expect(valorCidade(r({ vereador_nao_disputou_gasto: null }), "gasto", "Vereador")).toBe(50_000);   // sem a coluna: zero
  });
});

describe("gastoComForaDaDisputa", () => {
  it("soma o gasto de quem não disputou; sem a coluna, zero", () => {
    expect(gastoComForaDaDisputa(500, 120)).toBe(620);
    expect(gastoComForaDaDisputa(500, undefined)).toBe(500);
    expect(gastoComForaDaDisputa(500, null)).toBe(500);
  });
});

describe("corCidade, legendaCidade e textoValor", () => {
  it("usa faixas fixas e separa 'não informado'", () => {
    expect(corCidade(50_000, "gasto", "Vereador")).toBe("q4");
    expect(corCidade(3_000, "gasto", "Vereador")).toBe("q1");
    expect(corCidade(0, "resultado", "Prefeito")).toBe("q0");
    expect(corCidade(null, "publico", "Vereador")).toBe("sem");
    expect(legendaCidade("gasto", "Vereador").map((l) => l.texto)).toEqual(["até R$ 2 mil", "2–5 mil", "5–10 mil", "10–25 mil", "25 mil ou mais", "Não informado"]);
    expect(legendaCidade("gasto", "Prefeito").map((l) => l.texto).slice(2, 5)).toEqual(["250–500 mil", "500 mil–1 mi", "1 mi ou mais"]);
    expect(legendaCidade("publico", "Vereador")[1].texto).toBe("20–40%");
    expect(legendaCidade("resultado", "Prefeito").map((l) => l.classe)).toEqual(["q4", "q0", "sem"]);
    expect(textoValor(null, "gasto", "Vereador")).toBe("Não informado");
    expect(textoValor(0.912, "publico", "Prefeito")).toBe("91%");
    expect(textoValor(0, "resultado", "Prefeito")).toBe("Perdeu");
  });
});

describe("referenciaDoPorte", () => {
  it("compara com a mediana das cidades do mesmo porte e ano", () => {
    const linhas = [r({ id_municipio: 1, vereador_gasto: 100_000 }), r({ id_municipio: 2, vereador_gasto: 300_000 }), r({ id_municipio: 3, eleitorado: 900_000 }), r({ ano: 2020, id_municipio: 4 })];
    expect(referenciaDoPorte(linhas, 2024, "ate50", "gasto", "Vereador")).toEqual({ valor: 20_000, n: 2 });
    expect(referenciaDoPorte([r({}), r({ id_municipio: 2, maior_venceu: false })], 2024, "ate50", "resultado", "Prefeito")).toEqual({ valor: 0.5, n: 2 });
  });
});

describe("fraseTaxas e qualificacao", () => {
  it("escreve as taxas e a diferença em pontos percentuais", () => {
    expect(fraseTaxas(0.3, 0.05)).toBe("30 em cada 100 se elegeram, contra 5 em cada 100 — diferença de 25 pontos percentuais");
    expect(fraseTaxas(0.11, 0.1)).toMatch(/1 ponto percentual$/);
    expect(fraseTaxas(0.002, 0)).toMatch(/^menos de 1 em cada 100.*contra 0 em cada 100 — sem diferença$/);
  });
  it("trata a falta de significância sem dizer que não há relação", () => {
    expect(qualificacao("Sim.")).toMatch(/identificou diferença estatística.*não demonstra que o dinheiro causou/);
    expect(qualificacao("Sem diferença clara.")).toMatch(/não quer dizer que não haja relação/);
    expect(qualificacao("Diferença pequena.")).toMatch(/menor que 20%/);
    expect(qualificacao(null)).toMatch(/Poucos casos/);
  });
});

describe("valorDoEstado, corPorFaixas e classeComPorte", () => {
  const e = (o: Partial<{ ano: number; uf: string; cargo: string; vagas: number; gasto: number; receita: number; receita_publica: number; disputas_maior: number | null; maior_venceu: number | null }>) =>
    ({ ano: 2024, uf: "PE", cargo: "Vereador", vagas: 10, gasto: 100, receita: 200, receita_publica: 150, disputas_maior: null, maior_venceu: null, ...o });
  const linhas = [e({}), e({ uf: "RJ", vagas: 30, gasto: 900 }), e({ cargo: "Prefeito", vagas: 5, disputas_maior: 4, maior_venceu: 3 }), e({ uf: "BR", cargo: "Vereador", vagas: 999 })];
  it("usa a mesma conta da cidade, no estado ou nos seis (sem a linha BR)", () => {
    expect(valorDoEstado(linhas, 2024, "PE", "gasto", "Vereador")).toBe(10);
    expect(valorDoEstado(linhas, 2024, undefined, "gasto", "Vereador")).toBe(25);
    expect(valorDoEstado(linhas, 2024, "PE", "publico", "Vereador")).toBe(0.75);
    expect(valorDoEstado(linhas, 2024, "PE", "resultado", "Prefeito")).toBe(0.75);
    expect(valorDoEstado(linhas, 2024, "PE", "resultado", "Vereador")).toBeNull();
    expect(valorDoEstado(linhas, 2020, "PE", "gasto", "Vereador")).toBeNull();
  });
  it("soma o gasto de quem não disputou no gasto e no gasto por eleitor; a parte pública não muda", () => {
    const fora = [{ ...e({}), gasto_nao_disputou: 50, eleitorado: 30 }, { ...e({ uf: "RJ", vagas: 30, gasto: 900 }), eleitorado: 70 }];
    expect(valorDoEstado(fora, 2024, "PE", "gasto", "Vereador")).toBe(15);
    expect(valorDoEstado(fora, 2024, undefined, "gasto", "Vereador")).toBe(26.25);   // (150 + 900) ÷ 40; RJ sem a coluna
    expect(valorDoEstado(fora, 2024, "PE", "eleitor", "Vereador")).toBe(5);
    expect(valorDoEstado(fora, 2024, "PE", "publico", "Vereador")).toBe(0.75);
  });
  it("pinta por faixas e apaga as cidades de outro porte", () => {
    expect(corPorFaixas(0.65, [0.5, 0.6, 0.7, 0.8])).toBe("q2");
    expect(corPorFaixas(null, [1])).toBe("sem");
    expect(classeComPorte("q2", "ate10", "ate50")).toBe("q2 apagado");
    expect(classeComPorte("q2", "ate50", "ate50")).toBe("q2");
    expect(classeComPorte("q2", "ate10", undefined)).toBe("q2");
  });
});

describe("tresGrupos e maisRecebeuPublico", () => {
  it("junta pouco e médio em 'menos' e mantém nada e muito", () => {
    const g = tresGrupos([{ chave: "nada", candidaturas: 10, eleitos: 0 }, { chave: "pouco", candidaturas: 10, eleitos: 1 }, { chave: "medio", candidaturas: 30, eleitos: 4 }, { chave: "muito", candidaturas: 20, eleitos: 10 }]);
    expect(g.menos).toEqual({ candidaturas: 40, eleitos: 5, taxa: 0.125 });
    expect(g.mais.taxa).toBe(0.5);
    expect(tresGrupos([]).mais).toEqual({ candidaturas: 0, eleitos: 0, taxa: 0 });
  });
  it("aponta quem mais recebeu dinheiro público só sem empate, sem falta de prestação e com valor", () => {
    const c = (receita_publica: number, prestou = true) => ({ receita_publica, prestou });
    expect(maisRecebeuPublico([c(10), c(30)])).toEqual(c(30));
    expect(maisRecebeuPublico([c(30), c(30)])).toBeNull();
    expect(maisRecebeuPublico([c(10), c(30, false)])).toBeNull();
    expect(maisRecebeuPublico([c(0), c(0)])).toBeNull();
    expect(maisRecebeuPublico([c(5)])).toBeNull();
  });
});

describe("contaGasto, contaGastoEstado e legendaPorFaixas", () => {
  it("dá o gasto e as vagas da conta (prefeito: 1 vaga)", () => {
    expect(contaGasto(r({}), "Vereador")).toEqual({ gasto: 500_000, vagas: 10 });
    expect(contaGasto(r({}), "Prefeito")).toEqual({ gasto: 900_000, vagas: 1 });
    expect(contaGasto(r({ vereador_vagas: 0 }), "Vereador")).toBeNull();
    expect(contaGasto(undefined, "Vereador")).toBeNull();
  });
  it("na conta da cidade entra o gasto de quem não disputou", () => {
    const fora = r({ vereador_nao_disputou_gasto: 20_000, prefeito_nao_disputou_gasto: 5_000 });
    expect(contaGasto(fora, "Vereador")).toEqual({ gasto: 520_000, vagas: 10 });
    expect(contaGasto(fora, "Prefeito")).toEqual({ gasto: 905_000, vagas: 1 });
  });
  it("soma gasto (com quem não disputou) e vagas do estado ou dos seis, sem a linha BR", () => {
    const e = (uf: string, vagas: number, gasto: number, gasto_nao_disputou?: number) => ({ ano: 2024, uf, cargo: "Vereador", vagas, gasto, gasto_nao_disputou });
    const linhas = [e("PE", 10, 100, 40), e("RJ", 30, 900), e("BR", 999, 1, 7)];
    expect(contaGastoEstado(linhas, 2024, "PE", "Vereador")).toEqual({ gasto: 140, vagas: 10 });
    expect(contaGastoEstado(linhas, 2024, "RJ", "Vereador")).toEqual({ gasto: 900, vagas: 30 });   // sem a coluna: zero
    expect(contaGastoEstado(linhas, 2024, undefined, "Vereador")).toEqual({ gasto: 1040, vagas: 40 });
    expect(contaGastoEstado(linhas, 2020, "PE", "Vereador")).toBeNull();
  });
  it("escreve os limites das faixas na legenda", () => {
    const l = legendaPorFaixas([10, 20], (v) => `${v}%`);
    expect(l.map((x) => x.texto)).toEqual(["até 10%", "10–20%", "20% ou mais", "Não informado"]);
    expect(legendaPorFaixas([40_000, 46_000], (v) => `${v / 1000} mil`, "R$ ").map((x) => x.texto).slice(0, 2)).toEqual(["até R$ 40 mil", "40–46 mil"]);
    expect(legendaPorFaixas([], String)).toEqual([{ classe: "sem", texto: "Não informado" }]);
  });
});

describe("ordenarLinhas", () => {
  const ls = [{ nome: "Olinda", valor: 10 }, { nome: "Recife", valor: 90 }, { nome: "Arcoverde", valor: null }, { nome: "Caruaru", valor: 10 }];
  it("ordena por valor (maior primeiro, empate pelo nome, não informado no fim) ou por nome", () => {
    expect(ordenarLinhas(ls, "valor").map((l) => l.nome)).toEqual(["Recife", "Caruaru", "Olinda", "Arcoverde"]);
    expect(ordenarLinhas(ls, "nome").map((l) => l.nome)).toEqual(["Arcoverde", "Caruaru", "Olinda", "Recife"]);
  });
});

describe("valorDoPorte", () => {
  const linhas = [
    r({ id_municipio: 1, eleitorado: 3_000, vereador_gasto: 100, vereador_vagas: 9 }), r({ id_municipio: 2, eleitorado: 4_000, vereador_gasto: 200, vereador_vagas: 11 }),
    r({ id_municipio: 3, eleitorado: 900_000, vereador_gasto: 9_000_000, vereador_vagas: 40 }), r({ id_municipio: 4, eleitorado: 4_500, uf: "RJ", vereador_gasto: 1_000, vereador_vagas: 10 }),
  ];
  it("soma gasto e vagas só das cidades do porte (no estado ou nos seis)", () => {
    expect(valorDoPorte(linhas, 2024, "PE", "ate5", "gasto", "Vereador")).toEqual({ valor: 15, n: 2, conta: { gasto: 300, vagas: 20 } });
    expect(valorDoPorte(linhas, 2024, undefined, "ate5", "gasto", "Vereador").conta).toEqual({ gasto: 1_300, vagas: 30 });
    expect(valorDoPorte(linhas, 2024, "PE", "ate10", "gasto", "Vereador")).toEqual({ valor: null, n: 0, conta: null });
  });
  it("soma o gasto de quem não disputou no gasto e no gasto por eleitor", () => {
    const fora = [r({ id_municipio: 1, eleitorado: 3_000, vereador_gasto: 100, vereador_vagas: 9, vereador_nao_disputou_gasto: 100, prefeito_nao_disputou_gasto: 100_000 }), r({ id_municipio: 2, eleitorado: 4_000, vereador_gasto: 200, vereador_vagas: 11 })];
    expect(valorDoPorte(fora, 2024, "PE", "ate5", "gasto", "Vereador")).toEqual({ valor: 20, n: 2, conta: { gasto: 400, vagas: 20 } });
    expect(valorDoPorte(fora, 2024, "PE", "ate5", "gasto", "Prefeito").valor).toBe(950_000);   // (1.000.000 + 900.000) ÷ 2 cidades
    expect(valorDoPorte(fora, 2024, "PE", "ate5", "eleitor", "Vereador").valor).toBeCloseTo(400 / 7_000);
  });
  it("prefeito: 1 vaga por cidade; resultado e público pelas somas", () => {
    expect(valorDoPorte(linhas, 2024, "PE", "ate5", "gasto", "Prefeito").valor).toBe(900_000);
    expect(valorDoPorte(linhas, 2024, "PE", "ate5", "resultado", "Prefeito").valor).toBe(1);
    expect(valorDoPorte(linhas, 2024, "PE", "ate5", "resultado", "Vereador").valor).toBeCloseTo(0.3);
    expect(valorDoPorte(linhas, 2024, "PE", "ate5", "publico", "Vereador").valor).toBeCloseTo(0.5);
  });
});

describe("mediasPorResultado", () => {
  const l = (o: Partial<{ ano: number; cargo: string; uf: string; eleito: boolean; candidaturas: number; fundo_eleitoral: number; fundo_partidario: number; doacoes_pessoas: number; recursos_proprios: number; outros_privados: number }>) =>
    ({ ano: 2024, cargo: "Vereador", uf: "PE", eleito: false, candidaturas: 10, fundo_eleitoral: 100, fundo_partidario: 0, doacoes_pessoas: 30, recursos_proprios: 10, outros_privados: 0, ...o });
  it("divide o público e o privado pelos candidatos de cada grupo", () => {
    const m = mediasPorResultado([l({}), l({ partido: "X", candidaturas: 10, fundo_eleitoral: 0, doacoes_pessoas: 0, recursos_proprios: 0 } as never), l({ eleito: true, candidaturas: 2, fundo_eleitoral: 400, fundo_partidario: 100, doacoes_pessoas: 50 }), l({ uf: "RJ", candidaturas: 99 })], 2024, "Vereador", "PE");
    expect(m.naoEleitos).toEqual({ candidaturas: 20, publico: 5, privado: 2 });
    expect(m.eleitos).toEqual({ candidaturas: 2, publico: 250, privado: 30 });
    expect(mediasPorResultado([], 2024, "Vereador").eleitos).toEqual({ candidaturas: 0, publico: 0, privado: 0 });
  });
});

describe("mediaPorCandidato", () => {
  const l = (o: Partial<{ ano: number; cargo: string; uf: string; eleito: boolean; candidaturas: number; fundo_eleitoral: number; fundo_partidario: number; doacoes_pessoas: number; recursos_proprios: number; outros_privados: number }>) =>
    ({ ano: 2024, cargo: "Vereador", uf: "PE", eleito: false, candidaturas: 10, fundo_eleitoral: 100, fundo_partidario: 0, doacoes_pessoas: 30, recursos_proprios: 10, outros_privados: 0, ...o });
  it("junta eleitos e não eleitos, pesando pelo número de candidatos", () => {
    const m = mediaPorCandidato([l({}), l({ eleito: true, candidaturas: 2, fundo_eleitoral: 500, doacoes_pessoas: 60 })], 2024, "Vereador", "PE");
    expect(m.candidaturas).toBe(12);
    expect(m.publico).toBeCloseTo(600 / 12);
    expect(m.privado).toBeCloseTo(110 / 12);   // 30 + 10 (não eleitos) + 60 + 10 (eleitos)
    expect(mediaPorCandidato([], 2024, "Vereador").publico).toBe(0);
  });
});

describe("escolhaMapaDinheiro", () => {
  it("usa o último ano e o primeiro cargo dele quando nada é pedido", () => {
    expect(escolhaMapaDinheiro({})).toEqual({ ano: ANOS_DINHEIRO[ANOS_DINHEIRO.length - 1], cargo: "Deputado federal", porte: undefined, pintar: "vaga", semCargo: false, lista: "ricos" });
    expect(ANOS_DINHEIRO.at(-1)).toBe(2026);
  });
  it("ignora ano sem prestação de contas e cargo que não existe no ano", () => {
    expect(escolhaMapaDinheiro({ ano: "2016", cargo: "Prefeito" })).toMatchObject({ ano: 2026, cargo: "Deputado federal" });
    expect(escolhaMapaDinheiro({ ano: "2024", cargo: "Prefeito" })).toMatchObject({ ano: 2024, cargo: "Prefeito" });
    expect(escolhaMapaDinheiro({ ano: "2022", cargo: "Prefeito" })).toMatchObject({ ano: 2022, cargo: "Deputado federal" });
  });
  it("a pergunta 2 tem os anos do patrimônio (2006 a 2024)", () => {
    expect(escolhaMapaDinheiro({ pintar: "voto", ano: "2012" }).ano).toBe(2012);
    expect(escolhaMapaDinheiro({ pintar: "vaga", ano: "2012" }).ano).toBe(2026);
  });
  it("aceita só portes que existem, só nas eleições municipais e fora da pergunta 2", () => {
    expect(escolhaMapaDinheiro({ ano: "2024", porte: "ate5", pintar: "publico" })).toMatchObject({ porte: "ate5", pintar: "publico" });
    expect(escolhaMapaDinheiro({ porte: "ate5", pintar: "voto" }).porte).toBeUndefined();
    expect(escolhaMapaDinheiro({ porte: "gigante" }).porte).toBeUndefined();
    expect(escolhaMapaDinheiro({ ano: "2022", porte: "ate5" }).porte).toBeUndefined();
  });
  it("semcargo=1 e a lista só valem na pergunta 2", () => {
    expect(escolhaMapaDinheiro({ pintar: "voto", semcargo: "1", lista: "perderam" })).toMatchObject({ semCargo: true, lista: "perderam" });
    expect(escolhaMapaDinheiro({ pintar: "vaga", semcargo: "1" }).semCargo).toBe(false);
    expect(escolhaMapaDinheiro({ pintar: "voto", lista: "sorte" }).lista).toBe("ricos");
  });
  it("pintar: só as perguntas que existem; o padrão é a 1 (gasto por vaga)", () => {
    expect(escolhaMapaDinheiro({ pintar: "eleitor" }).pintar).toBe("vaga");
    expect(escolhaMapaDinheiro({ pintar: "voto" }).pintar).toBe("voto");
    expect(escolhaMapaDinheiro({ pintar: "sorte" }).pintar).toBe("vaga");
    expect(abaDe("publico")).toBe("publico");
    expect(abaDe("propaganda")).toBe("gasto");
    expect(abaDe("vaga")).toBe("gasto");
  });
});

describe("hrefMapaDinheiro", () => {
  const atual = { ano: 2024, cargo: "Vereador", uf: "PE", mun: 10 };
  it("omite o que é padrão e mantém o lugar", () => {
    expect(hrefMapaDinheiro(atual)).toBe("/?ver=dinheiro&ano=2024&uf=PE&mun=10#mapa");
    expect(hrefMapaDinheiro(atual, { cargo: "Prefeito" })).toBe("/?ver=dinheiro&ano=2024&cargo=Prefeito&uf=PE&mun=10#mapa");
  });
  it("trocar o estado solta a cidade; null apaga", () => {
    expect(hrefMapaDinheiro(atual, { uf: "RJ" })).toBe("/?ver=dinheiro&ano=2024&uf=RJ#mapa");
    expect(hrefMapaDinheiro(atual, { uf: null })).toBe("/?ver=dinheiro&ano=2024#mapa");
  });
  it("numa eleição geral não há cidade nem porte, e o cargo municipal cai", () => {
    expect(hrefMapaDinheiro({ ...atual, cargo: "Prefeito", porte: "ate5" }, { ano: 2022 })).toBe("/?ver=dinheiro&ano=2022&uf=PE#mapa");
  });
  it("leva o porte (fora da pergunta 2) e aceita outra âncora", () => {
    expect(hrefMapaDinheiro({ ...atual, porte: "ate5", pintar: "publico" }, {}, "comparar")).toBe("/?ver=dinheiro&ano=2024&uf=PE&mun=10&porte=ate5&pintar=publico#comparar");
    expect(hrefMapaDinheiro({ ...atual, porte: "ate5" }, { pintar: "voto" })).toBe("/?ver=dinheiro&uf=PE&mun=10&pintar=voto#mapa");
  });
  it("na pergunta 2: semcargo, a lista e os anos do patrimônio; ao sair dela, um ano sem dinheiro volta ao último", () => {
    expect(hrefMapaDinheiro({ ...atual, pintar: "voto" }, { semCargo: true, lista: "menos" })).toBe("/?ver=dinheiro&uf=PE&mun=10&pintar=voto&semcargo=1&lista=menos#mapa");
    expect(hrefMapaDinheiro({ ...atual, pintar: "voto", semCargo: true, lista: "menos" }, { pintar: "vaga" })).toBe("/?ver=dinheiro&ano=2024&uf=PE&mun=10#mapa");
    expect(hrefMapaDinheiro({ ...atual, pintar: "voto" }, { lista: "ricos" })).toBe("/?ver=dinheiro&uf=PE&mun=10&pintar=voto#mapa");   // a lista padrão não vai
    expect(hrefMapaDinheiro({ ...atual, pintar: "voto" }, { ano: 2012 })).toBe("/?ver=dinheiro&ano=2012&uf=PE&mun=10&pintar=voto#mapa");
    expect(hrefMapaDinheiro({ ...atual, ano: 2012, pintar: "voto" }, { pintar: "publico" })).toBe("/?ver=dinheiro&uf=PE&pintar=publico#mapa");   // volta a 2026, eleição geral: sem cidade
  });
  it("leva o que pinta o mapa e a ordem dos candidatos, omitindo os padrões e o que não existe", () => {
    expect(hrefMapaDinheiro(atual, { pintar: "voto", ord: "gasto" })).toBe("/?ver=dinheiro&uf=PE&mun=10&pintar=voto&ord=gasto#mapa");
    expect(hrefMapaDinheiro({ ...atual, pintar: "voto", ord: "gasto" }, { pintar: "vaga", ord: "votos" })).toBe("/?ver=dinheiro&ano=2024&uf=PE&mun=10#mapa");
    expect(hrefMapaDinheiro(atual, { pintar: "publico" })).toBe("/?ver=dinheiro&ano=2024&uf=PE&mun=10&pintar=publico#mapa");
    expect(hrefMapaDinheiro(atual, { pintar: "propaganda" })).toBe("/?ver=dinheiro&ano=2024&uf=PE&mun=10&pintar=propaganda#mapa");
    expect(hrefMapaDinheiro(atual, { pintar: "arcoiris", ord: "altura" })).toBe("/?ver=dinheiro&ano=2024&uf=PE&mun=10#mapa");
  });
});

describe("gasto por eleitor (aba eleitor)", () => {
  it("divide o gasto do cargo pelo eleitorado da cidade; sem eleitorado ou sem candidatos, não informado", () => {
    expect(valorCidade(r({}), "eleitor", "Vereador")).toBeCloseTo(500_000 / 30_000);
    expect(valorCidade(r({}), "eleitor", "Prefeito")).toBe(30);
    expect(valorCidade(r({ eleitorado: null }), "eleitor", "Vereador")).toBeNull();
    expect(valorCidade(r({ prefeito_candidatos: 0 }), "eleitor", "Prefeito")).toBeNull();
  });
  it("tem faixas fixas, legenda em reais e o valor com centavos", () => {
    expect(faixasDe("eleitor", "Vereador")).toEqual([3, 6, 10, 15]);
    expect(corCidade(7, "eleitor", "Vereador")).toBe("q2");
    expect(legendaCidade("eleitor", "Prefeito").map((l) => l.texto)).toEqual(["até R$ 10", "R$ 10–20", "R$ 20–30", "R$ 30–40", "R$ 40 ou mais", "Não informado"]);
    expect(textoValor(5.689, "eleitor", "Vereador").replace(/ /g, " ")).toBe("R$ 5,69");
    expect(unidade("eleitor", "Vereador")).toContain("por eleitor apto");
  });
  it("no estado, soma dos gastos ÷ soma dos eleitores aptos (sem eleitorado, não informado)", () => {
    const e = (uf: string, gasto: number, eleitorado: number | null) => ({ ano: 2022, uf, cargo: "Senador", vagas: 1, gasto, receita: 0, receita_publica: 0, disputas_maior: null, maior_venceu: null, eleitorado });
    expect(valorDoEstado([e("PE", 700, 100), e("RJ", 300, 100)], 2022, undefined, "eleitor", "Senador")).toBe(5);
    expect(valorDoEstado([e("PE", 700, 100)], 2022, "PE", "eleitor", "Senador")).toBe(7);
    expect(valorDoEstado([e("PE", 700, null)], 2022, "PE", "eleitor", "Senador")).toBeNull();
  });
  it("por porte, só as cidades do porte com eleitorado", () => {
    const linhas = [r({ id_municipio: 1, vereador_gasto: 60_000, eleitorado: 3_000 }), r({ id_municipio: 2, vereador_gasto: 40_000, eleitorado: 2_000 }), r({ id_municipio: 3, eleitorado: 40_000 })];
    expect(valorDoPorte(linhas, 2024, undefined, "ate5", "eleitor", "Vereador")).toMatchObject({ valor: 20, n: 2 });
  });
});

describe("cobertura das prestações de contas", () => {
  it("conta as candidaturas com prestação final na cidade e no estado", () => {
    expect(contasDaCidade(r({ vereador_candidatos: 100, vereador_sem_prestacao: 3 }), "Vereador")).toEqual({ total: 100, com: 97 });
    expect(contasDaCidade(r({ prefeito_candidatos: 3, prefeito_sem_prestacao: 1 }), "Prefeito")).toEqual({ total: 3, com: 2 });
    expect(contasDaCidade(r({ prefeito_candidatos: 0 }), "Prefeito")).toBeNull();
    expect(contasDaCidade(undefined, "Vereador")).toBeNull();
    const e = (uf: string, candidatos: number, sem_prestacao: number) => ({ ano: 2024, uf, cargo: "Vereador", candidatos, sem_prestacao });
    expect(contasDoEstado([e("PE", 10, 1), e("RJ", 20, 4), e("BR", 5, 5)], 2024, undefined, "Vereador")).toEqual({ total: 30, com: 25 });
    expect(contasDoEstado([e("PE", 10, 1)], 2024, "RJ", "Vereador")).toBeNull();
  });
  it("por porte, soma as cidades do porte", () => {
    const linhas = [r({ id_municipio: 1, vereador_candidatos: 10, vereador_sem_prestacao: 1, eleitorado: 3_000 }), r({ id_municipio: 2, vereador_candidatos: 20, vereador_sem_prestacao: 2, eleitorado: 4_000 }), r({ id_municipio: 3, eleitorado: 40_000 })];
    expect(contasDoPorte(linhas, 2024, undefined, "ate5", "Vereador")).toEqual({ total: 30, com: 27 });
  });
  it("escreve a cobertura sem afirmar aprovação, e avisa quando o total pode estar incompleto", () => {
    expect(fraseCobertura({ total: 100, com: 100 })).toBe("Prestação de contas final na base para todas as 100 candidaturas.");
    expect(fraseCobertura({ total: 1200, com: 1150 })).toBe("Prestação de contas final na base para 1.150 de 1.200 candidaturas (50 sem: o total pode estar incompleto).");
    expect(fraseCobertura(null)).toBeNull();
    expect(coberturaCurta({ total: 10, com: 10 })).toEqual({ texto: "Contas na base: todas as 10 candidaturas.", incompleta: false });
    expect(coberturaCurta({ total: 10, com: 8 })).toMatchObject({ incompleta: true });
    expect(coberturaCurta({ total: 10, com: 8 })!.texto).toContain("8 de 10 candidaturas; 2 sem");
  });
});

describe("origemDoDinheiro", () => {
  const e = (uf: string, cargo: string, receita: number, receita_publica: number) => ({ ano: 2024, uf, cargo, receita, receita_publica });
  const ep = (uf: string, cargo: string, receita: number, receita_publica: number, receita_privada: number) => ({ ...e(uf, cargo, receita, receita_publica), receita_privada });
  const dados = {
    resumo: [r({ id_municipio: 1, eleitorado: 3_000, vereador_receita: 100, vereador_publica: 60, vereador_privada: 40 }), r({ id_municipio: 2, eleitorado: 4_000, vereador_receita: 100, vereador_publica: 20, vereador_privada: 80 })],
    estados: [ep("PE", "Vereador", 1000, 700, 300), ep("RJ", "Vereador", 1000, 100, 900), ep("PE", "Prefeito", 50, 50, 0), ep("BR", "Vereador", 9, 9, 0)],
  };
  it("cidade, porte, estado e os seis, sempre do cargo pedido", () => {
    expect(origemDoDinheiro(dados, { ano: 2024, cargo: "Prefeito", mun: r({ prefeito_privada: 100_000 }) })).toEqual({ publico: 300_000, privado: 100_000, naoClassificado: 0, total: 400_000 });
    expect(origemDoDinheiro(dados, { ano: 2024, cargo: "Vereador", porte: "ate5" })).toEqual({ publico: 80, privado: 120, naoClassificado: 0, total: 200 });
    expect(origemDoDinheiro(dados, { ano: 2024, cargo: "Vereador", uf: "PE" })).toEqual({ publico: 700, privado: 300, naoClassificado: 0, total: 1000 });
    expect(origemDoDinheiro(dados, { ano: 2024, cargo: "Vereador" })).toEqual({ publico: 800, privado: 1200, naoClassificado: 0, total: 2000 });
  });
  it("o que não é público nem privado identificado fica como origem não classificada, nunca vira privado", () => {
    expect(origemDoDinheiro({ resumo: [], estados: [ep("PE", "Senador", 1000, 600, 300)] }, { ano: 2024, cargo: "Senador", uf: "PE" })).toEqual({ publico: 600, privado: 300, naoClassificado: 100, total: 1000 });
    // sem a coluna do privado (API antiga ou cache): só "não público", sem chamar de privado nem de sem fonte
    expect(origemDoDinheiro({ resumo: [], estados: [e("PE", "Senador", 1000, 600)] }, { ano: 2024, cargo: "Senador", uf: "PE" })).toEqual({ publico: 600, naoPublico: 400, total: 1000 });
    expect(origemDoDinheiro({ resumo: [], estados: [] }, { ano: 2024, cargo: "Vereador", mun: r({}) })).toEqual({ publico: 300_000, naoPublico: 300_000, total: 600_000 });
  });
  it("sem receita, null", () => {
    expect(origemDoDinheiro(dados, { ano: 2024, cargo: "Governador", uf: "PE" })).toBeNull();
  });
});

describe("referência, eleição anterior e o que a pergunta 1 soma a mais", () => {
  it("diferença relativa e o texto dela", () => {
    expect(diferencaRelativa(135, 100)).toBeCloseTo(0.35);
    expect(diferencaRelativa(null, 100)).toBeNull();
    expect(diferencaRelativa(100, 0)).toBeNull();
    expect(textoDiferenca(0.35)).toBe("35% acima");
    expect(textoDiferenca(-0.12)).toBe("12% abaixo");
    expect(textoDiferenca(0.004)).toBe("igual à referência");
  });
  it("eleição anterior do mesmo tipo só quando há dinheiro dela na base", () => {
    expect(anoAnterior(2024)).toBe(2020);
    expect(anoAnterior(2022)).toBe(2018);
    expect(anoAnterior(2020)).toBeNull();
    expect(variacaoNominal(112, 100)).toBeCloseTo(0.12);
    expect(variacaoNominal(112, null)).toBeNull();
  });
  it("gasto de quem não disputou: só quando existe", () => {
    const e = (uf: string, n: number, gasto: number) => ({ ano: 2018, uf, cargo: "Deputado federal", nao_disputou_com_gasto: n, gasto_nao_disputou: gasto });
    expect(foraDaDisputa([e("AP", 1, 19_000), e("MG", 4, 35_800), e("BR", 9, 1e9)], 2018, undefined, "Deputado federal")).toEqual({ n: 5, gasto: 54_800 });
    expect(foraDaDisputa([e("AP", 0, 0)], 2018, "AP", "Deputado federal")).toBeNull();
    expect(foraDaDisputa([{ ano: 2018, uf: "AP", cargo: "Deputado federal" }], 2018, "AP", "Deputado federal")).toBeNull();
  });
});

describe("ordenarCandidatos", () => {
  const c = (o: Partial<{ nome_urna: string; votos: number; gasto: number; receita: number; receita_publica: number; prestou: boolean }>) => ({ nome_urna: "A", votos: 0, gasto: 0, receita: 0, receita_publica: 0, prestou: true, ...o });
  it("ordena pela medida, do maior para o menor, e quem não prestou contas vai para o fim nas ordens de dinheiro", () => {
    const cands = [c({ nome_urna: "Pouco", votos: 50, gasto: 10, receita: 30, receita_publica: 0 }), c({ nome_urna: "Sem contas", votos: 90, prestou: false }), c({ nome_urna: "Muito", votos: 20, gasto: 100, receita: 10, receita_publica: 5 })];
    expect(ordenarCandidatos(cands, "votos").map((x) => x.nome_urna)).toEqual(["Sem contas", "Pouco", "Muito"]);
    expect(ordenarCandidatos(cands, "gasto").map((x) => x.nome_urna)).toEqual(["Muito", "Pouco", "Sem contas"]);
    expect(ordenarCandidatos(cands, "recebido").map((x) => x.nome_urna)).toEqual(["Pouco", "Muito", "Sem contas"]);
    expect(ordenarCandidatos(cands, "publico").map((x) => x.nome_urna)).toEqual(["Muito", "Pouco", "Sem contas"]);
  });
  it("empate desempata por votos; a ordem pedida que não existe vira 'votos'", () => {
    const cands = [c({ nome_urna: "B", votos: 10, gasto: 5 }), c({ nome_urna: "A", votos: 20, gasto: 5 })];
    expect(ordenarCandidatos(cands, "gasto").map((x) => x.nome_urna)).toEqual(["A", "B"]);
    expect(ordemCandidatos("altura")).toBe("votos");
    expect(ordemCandidatos("recebido")).toBe("recebido");
  });
});

describe("composicaoDespesas", () => {
  const d = (o: Partial<LinhaDespesa>): LinhaDespesa => ({ ano: 2024, cargo: "Vereador", uf: "PE", id_municipio: 1, grupo: "propaganda_fisica", valor: 100, despesas: 2, ...o });
  const linhas = [d({}), d({ grupo: "pessoal", valor: 300, despesas: 1 }), d({ id_municipio: 2, grupo: "pessoal", valor: 100 }), d({ uf: "RJ", id_municipio: 3, grupo: "outros", valor: 500 }), d({ cargo: "Prefeito", valor: 9_999 })];
  it("soma os grupos do recorte e dá a parte de cada um, do maior para o menor, com o nome para o leitor", () => {
    const cidade = composicaoDespesas(linhas, { ano: 2024, cargo: "Vereador", uf: "PE", mun: 1 });
    expect(cidade.map((g) => [g.rotulo, g.valor, g.parte])).toEqual([["Pessoal", 300, 0.75], ["Propaganda impressa e de rua", 100, 0.25]]);
    expect(composicaoDespesas(linhas, { ano: 2024, cargo: "Vereador", uf: "PE" }).map((g) => [g.grupo, g.valor])).toEqual([["pessoal", 400], ["propaganda_fisica", 100]]);
    expect(composicaoDespesas(linhas, { ano: 2024, cargo: "Vereador" }).find((g) => g.grupo === "outros")?.parte).toBeCloseTo(0.5);
  });
  it("com as cidades de um porte, só as despesas delas (o mesmo universo das receitas)", () => {
    expect(composicaoDespesas(linhas, { ano: 2024, cargo: "Vereador", uf: "PE", muns: new Set([2]) }).map((g) => [g.grupo, g.valor])).toEqual([["pessoal", 100]]);
    expect(composicaoDespesas(linhas, { ano: 2024, cargo: "Vereador", muns: new Set() })).toEqual([]);
  });
  it("despesa sem categoria aparece como grupo próprio", () => {
    expect(composicaoDespesas([d({ grupo: "sem_categoria", valor: 50 }), d({ valor: 150 })], { ano: 2024, cargo: "Vereador" }).map((g) => [g.rotulo, g.parte])).toEqual([["Propaganda impressa e de rua", 0.75], ["Sem categoria", 0.25]]);
  });
  it("vazio sem despesas no recorte", () => {
    expect(composicaoDespesas(linhas, { ano: 2020, cargo: "Vereador" })).toEqual([]);
    expect(composicaoDespesas(linhas, { ano: 2024, cargo: "Vereador", uf: "PE", mun: 99 })).toEqual([]);
  });
});

describe("cidadesDoPorte e foraDaDisputaPorte", () => {
  const linhas = [
    r({ id_municipio: 1, uf: "PE", eleitorado: 3_000, vereador_nao_disputou_n: 2, vereador_nao_disputou_gasto: 500, prefeito_nao_disputou_n: 1, prefeito_nao_disputou_gasto: 900 }),
    r({ id_municipio: 2, uf: "RJ", eleitorado: 4_000, vereador_nao_disputou_n: 1, vereador_nao_disputou_gasto: 100 }),
    r({ id_municipio: 3, uf: "PE", eleitorado: 40_000, vereador_nao_disputou_n: 9, vereador_nao_disputou_gasto: 9_999 }),
  ];
  it("as cidades do porte no ano e no estado", () => {
    expect([...cidadesDoPorte(linhas, 2024, undefined, "ate5")]).toEqual([1, 2]);
    expect([...cidadesDoPorte(linhas, 2024, "PE", "ate5")]).toEqual([1]);
    expect(cidadesDoPorte(linhas, 2020, undefined, "ate5").size).toBe(0);
  });
  it("o gasto de quem não disputou só nas cidades do porte, do cargo pedido", () => {
    expect(foraDaDisputaPorte(linhas, 2024, undefined, "ate5", "Vereador")).toEqual({ n: 3, gasto: 600 });
    expect(foraDaDisputaPorte(linhas, 2024, "PE", "ate5", "Prefeito")).toEqual({ n: 1, gasto: 900 });
    expect(foraDaDisputaPorte(linhas, 2024, "RJ", "ate5", "Prefeito")).toBeNull();
  });
});

describe("seloValor", () => {
  it("encurta o gasto sem R$ e sem casa decimal acima de 10", () => {
    expect(seloValor(221_900, "gasto")).toBe("222 mil");
    expect(seloValor(4_620, "gasto")).toBe("4,6 mil");
    expect(seloValor(1_234_000, "gasto")).toBe("1,2 mi");
    expect(seloValor(64_300_000, "gasto")).toBe("64 mi");
    expect(seloValor(999_700, "gasto")).toBe("1 mi");   // não vira "1.000 mil"
    expect(seloValor(850, "gasto")).toBe("850");
  });
  it("por eleitor e parte pública", () => {
    expect(seloValor(13.83, "eleitor")).toBe("14");
    expect(seloValor(9.24, "eleitor")).toBe("9,2");
    expect(seloValor(0.734, "publico")).toBe("73%");
    expect(seloValor(null, "gasto")).toBe("");
  });
});

describe("fatias", () => {
  const it3 = [{ chave: "a", rotulo: "A", valor: 10 }, { chave: "b", rotulo: "B", valor: 30 }, { chave: "c", rotulo: "C", valor: 0 }, { chave: "d", rotulo: "D", valor: 60 }];
  it("ordena do maior ao menor, tira zeros e pinta f1, f2...", () => {
    expect(fatias(it3)).toEqual([
      { chave: "d", rotulo: "D", valor: 60, parte: 0.6, cor: "f1" },
      { chave: "b", rotulo: "B", valor: 30, parte: 0.3, cor: "f2" },
      { chave: "a", rotulo: "A", valor: 10, parte: 0.1, cor: "f3" },
    ]);
  });
  it("junta os menores em Outros quando passa do máximo", () => {
    const f = fatias(it3, { max: 2 });
    expect(f.map((x) => [x.chave, x.valor, x.cor])).toEqual([["d", 60, "f1"], ["outros", 40, "o"]]);
  });
  it("com ordem fixa e cor própria, mantém a ordem dada", () => {
    const f = fatias([{ chave: "pub", rotulo: "Público", valor: 1, cor: "pub" }, { chave: "priv", rotulo: "Privado", valor: 3, cor: "priv" }], { fixo: true });
    expect(f.map((x) => [x.chave, x.cor, x.parte])).toEqual([["pub", "pub", 0.25], ["priv", "priv", 0.75]]);
  });
  it("sem total, nenhuma fatia", () => {
    expect(fatias([{ chave: "a", rotulo: "A", valor: 0 }])).toEqual([]);
  });
});

describe("descricaoFatias", () => {
  it("lista cada fatia com a parte", () => {
    expect(descricaoFatias("De onde veio", fatias([{ chave: "p", rotulo: "Público", valor: 73 }, { chave: "q", rotulo: "Privado", valor: 27 }], { fixo: true })))
      .toBe("De onde veio: Público 73%, Privado 27%.");
  });
});

describe("seta", () => {
  it("mostra a direção e o tamanho da variação", () => {
    expect(seta(0.99)).toBe("▲ 99%");
    expect(seta(-0.124)).toBe("▼ 12%");
    expect(seta(0.001)).toBe("= 0%");
    expect(seta(17.53)).toBe("▲ 1.753%");
    expect(seta(null)).toBeNull();
  });
});

describe("coberturaSelo", () => {
  it("resume a cobertura das prestações de contas", () => {
    expect(coberturaSelo({ com: 10, total: 10 })).toMatchObject({ texto: "Todas as contas na base", incompleta: false });
    expect(coberturaSelo(null)).toBeNull();
    expect(coberturaSelo({ com: 0, total: 0 })).toBeNull();
  });
  it("acima do limiar só informa a parte; abaixo, avisa quanto falta", () => {
    expect(coberturaSelo({ com: 14_245, total: 14_453 })).toEqual({
      texto: "98% das contas na base", incompleta: false, detalhe: "14.245 de 14.453 candidaturas com prestação de contas final na base",
    });
    expect(coberturaSelo({ com: 999, total: 1000 })!.texto).toBe("99% das contas na base");   // nunca "100%" sem ser todas
    expect(coberturaSelo({ com: 95, total: 100 })!.incompleta).toBe(false);
    const baixa = coberturaSelo({ com: 70, total: 100 })!;
    expect(baixa.texto).toBe("Faltam 30% das contas");
    expect(baixa.incompleta).toBe(true);
    expect(baixa.detalhe).toContain("pode estar incompleto");
    expect(coberturaSelo({ com: 90, total: 100 }, 0.9)!.incompleta).toBe(false);
  });
});

// --- partidos, custo do voto, quartis e anos ---
const lp = (o: Partial<LinhaPartido>): LinhaPartido => ({
  ano: 2024, cargo: "Vereador", uf: "PE", porte: null, partido: "PFA", candidatos: 10, eleitos: 2, sem_prestacao: 0, gasto: 1000, votos: 100, publico: 400, ...o,
});
const lq = (o: Partial<LinhaQuartil>): LinhaQuartil => ({
  ano: 2024, cargo: "Vereador", uf: "PE", porte: null, faixa: 1, candidatos: 10, eleitos: 1, gasto: 1000, votos: 500, gasto_min: 10, gasto_max: 200, gasto_mediana: 100, ...o,
});
const cl = (o: Partial<CandidatoLocal>): CandidatoLocal => ({
  cargo: "Vereador", id_cargo: 13, id_candidato: 1, id_candidatura: 1, nome_urna: "X", partido: "PFA", votos: 100, gasto: 1000, receita: 1000, receita_publica: 500,
  eleito: false, resultado: "NAO_ELEITO", prestou: true, ...o,
});

describe("custoPorVoto", () => {
  it("divide o gasto pelos votos e não inventa custo sem votos", () => {
    expect(custoPorVoto(1630, 100)).toBeCloseTo(16.3);
    expect(custoPorVoto(500, 0)).toBeNull();
  });
});

describe("partidosDoRecorte", () => {
  const linhas = [lp({ partido: "PFA", gasto: 1000 }), lp({ partido: "PFB", gasto: 3000, votos: 50 }), lp({ partido: "PFC", uf: null, gasto: 9 }), lp({ partido: "PFD", porte: "ate5" })];
  it("pega só o recorte pedido e ordena do que mais gastou", () => {
    const ps = partidosDoRecorte(linhas, { ano: 2024, cargo: "Vereador", uf: "PE" });
    expect(ps.map((p) => p.partido)).toEqual(["PFB", "PFA"]);
    expect(ps[0]).toMatchObject({ parte: 0.75, porVoto: 60 });
  });
  it("sem uf é a linha dos seis estados (não soma os estados de novo)", () => {
    expect(partidosDoRecorte(linhas, { ano: 2024, cargo: "Vereador" }).map((p) => p.partido)).toEqual(["PFC"]);
    expect(partidosDoRecorte(linhas, { ano: 2024, cargo: "Vereador", uf: "PE", porte: "ate5" }).map((p) => p.partido)).toEqual(["PFD"]);
  });
});

describe("partidosDeCandidatos e totalPartidos", () => {
  it("soma os candidatos da cidade por partido", () => {
    const ps = partidosDeCandidatos([cl({ partido: "PFA", eleito: true }), cl({ partido: "PFA", gasto: 3000, votos: 300 }), cl({ partido: null, prestou: false, gasto: 0 })]);
    expect(ps[0]).toMatchObject({ partido: "PFA", candidatos: 2, eleitos: 1, gasto: 4000, votos: 400, porVoto: 10, publico: 1000 });
    expect(ps[1]).toMatchObject({ partido: "?", semPrestacao: 1, gasto: 0 });
    expect(totalPartidos(ps)).toEqual({ gasto: 4000, votos: 500, porVoto: 8, candidatos: 3, eleitos: 1 });
  });
});

describe("quartisDoRecorte", () => {
  const linhas = [lq({ faixa: -1, candidatos: 2, eleitos: 0, gasto: 0 }), lq({ faixa: 0, candidatos: 8, eleitos: 1, gasto: 0 }),
    lq({ faixa: 1, gasto: 100 }), lq({ faixa: 2, gasto: 300 }), lq({ faixa: 3, gasto: 600 }), lq({ faixa: 4, gasto: 9000, eleitos: 6, votos: 1000 })];
  it("junta os grupos em ordem, com taxa de eleição, custo por voto e a concentração no quartil de cima", () => {
    const q = quartisDoRecorte(linhas, { ano: 2024, cargo: "Vereador", uf: "PE" })!;
    expect(q.grupos.map((g) => g.faixa)).toEqual([-1, 0, 1, 2, 3, 4]);
    expect(q).toMatchObject({ candidatos: 50, eleitos: 10, gasto: 10_000, concentracao: 0.9 });
    expect(q.grupos[5]).toMatchObject({ rotulo: "25% que mais gastaram", taxa: 0.6, porVoto: 9 });
  });
  it("null sem candidato com gasto declarado", () => {
    expect(quartisDoRecorte([lq({ faixa: 0 })], { ano: 2024, cargo: "Vereador", uf: "PE" })).toBeNull();
    expect(quartisDoRecorte(linhas, { ano: 2020, cargo: "Vereador", uf: "PE" })).toBeNull();
  });
});

describe("quartisDeCandidatos", () => {
  it("usa a regra do percent_rank: empates no mesmo grupo, sem contas e sem gasto à parte", () => {
    const gastos = [10, 20, 30, 40, 50, 60, 70, 80, 90];   // n = 9: posições 0, 1/8 ... 1
    const cands = [...gastos.map((g, i) => cl({ id_candidatura: i, gasto: g, eleito: g >= 80 })), cl({ gasto: 0 }), cl({ prestou: false, gasto: 0 })];
    const q = quartisDeCandidatos(cands)!;
    const de = (f: number) => q.grupos.find((g) => g.faixa === f)!;
    expect(de(1)).toMatchObject({ candidatos: 2, min: 10, max: 20 });   // posições 0 e 0,125
    expect(de(4)).toMatchObject({ candidatos: 3, min: 70, max: 90, eleitos: 2 });   // posições 0,75 a 1
    expect(de(0).candidatos).toBe(1);
    expect(de(-1).candidatos).toBe(1);
    const empate = quartisDeCandidatos(Array.from({ length: 8 }, (_, i) => cl({ id_candidatura: i, gasto: i < 4 ? 5 : 100 })))!;
    expect(empate.grupos.map((g) => [g.faixa, g.candidatos])).toEqual([[1, 4], [3, 4]]);
  });
  it("com poucos candidatos com gasto, não divide em quartis", () => {
    expect(quartisDeCandidatos([cl({}), cl({}), cl({})])).toBeNull();
  });
});

describe("faixaGasto", () => {
  const g = (o: object) => ({ faixa: 2, rotulo: "", candidatos: 1, eleitos: 0, gasto: 0, votos: 0, min: 500.1, max: 1357.5, mediana: 0, taxa: 0, porVoto: null, ...o });
  it("escreve a faixa de cada quartil", () => {
    expect(faixaGasto(g({ faixa: 1, max: 500 }), false)).toBe("até R$ 500");
    expect(faixaGasto(g({}), false)).toBe("R$ 500 a R$ 1.358");
    expect(faixaGasto(g({ faixa: 4, min: 141_850 }), true)).toBe("acima de R$ 142 mil");
  });
});

describe("barrasQuartis", () => {
  it("três barras 100% (candidatos, eleitos, dinheiro) nas cores da escala, sem fatias vazias", () => {
    const q = quartisDoRecorte([lq({ faixa: 0, candidatos: 10, eleitos: 0, gasto: 0 }), lq({ faixa: 1, gasto: 100 }), lq({ faixa: 4, gasto: 900 })], { ano: 2024, cargo: "Vereador", uf: "PE" })!;
    const [cand, ele, din] = barrasQuartis(q);
    expect(cand.fatias.map((f) => [f.chave, f.cor])).toEqual([["0", "o"], ["1", "q1"], ["4", "q4"]]);
    expect(ele.fatias.map((f) => f.chave)).toEqual(["1", "4"]);
    expect(din).toMatchObject({ titulo: "Dinheiro gasto", total: reais(1000) });
    expect(din.fatias[1].parte).toBeCloseTo(0.9);
  });
});

describe("medidasNosAnos e setaMedida", () => {
  it("uma barra por ano na escala do maior e a variação do primeiro ao último", () => {
    const [gasto, pub] = medidasNosAnos([
      { chave: "g", rotulo: "Gasto", valores: [100, 150], fmt: String },
      { chave: "p", rotulo: "Público", valores: [0.6, 0.66], fmt: String, pontos: true },
      { chave: "x", rotulo: "Vazia", valores: [null, null], fmt: String },
    ]);
    expect(gasto).toMatchObject({ textos: ["100", "150"], variacao: 0.5 });
    expect(gasto.partes[0]).toBeCloseTo(2 / 3);
    expect(setaMedida(gasto)).toBe("▲ 50%");
    expect(setaMedida(pub)).toBe("▲ 6 p.p.");
  });
  it("sem dois anos com valor, sem variação", () => {
    const [m] = medidasNosAnos([{ chave: "g", rotulo: "Gasto", valores: [null, 10], fmt: String }]);
    expect(m).toMatchObject({ textos: ["—", "10"], variacao: null });
    expect(setaMedida(m)).toBeNull();
  });
});

describe("anosDoCargo", () => {
  it("os anos com dinheiro em que o cargo foi disputado", () => {
    expect(anosDoCargo("Vereador")).toEqual([2020, 2024]);
    expect(anosDoCargo("Deputado federal")).toEqual([2018, 2022, 2026]);
  });
});

describe("fraseConcentracao", () => {
  it("a parte do dinheiro e dos eleitos que ficou com os 25% que mais gastaram", () => {
    const q = quartisDoRecorte([lq({ faixa: 0, eleitos: 2, gasto: 0 }), lq({ faixa: 1, gasto: 100, eleitos: 2 }), lq({ faixa: 4, gasto: 900, eleitos: 4 })], { ano: 2024, cargo: "Vereador", uf: "PE" })!;
    expect(fraseConcentracao(q)).toEqual({ dinheiro: 0.9, eleitos: 0.5 });
    expect(fraseConcentracao({ ...q, eleitos: 0 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// quem mais gastou, cada cadeira, "de cada 100" e a nuvem
// ---------------------------------------------------------------------------------------------------------------------

const lc = (o: Partial<LinhaCargo>): LinhaCargo => ({
  ano: 2022, cargo: "Deputado estadual", uf: "MG", porte: null, vagas: 10, candidatos: 100, eleitos: 10, gasto: 1_000_000, gasto_eleitos: 400_000,
  mediana_eleito: 30_000, maioria: 63, parte: 7, nada: 15, sem_receita: 13, sem_contas: 2,
  el_maioria: 6, el_parte: 2, el_nada: 2, el_sem_receita: 0, el_sem_contas: 0, ...o,
});
const lm = (o: Partial<LinhaMaior>): LinhaMaior => ({
  ano: 2022, cargo: "Deputado estadual", uf: "MG", porte: null, so_eleitos: false, pos: 1, id_candidato: 1, id_candidatura: 1,
  nome_urna: "FULANO", partido: "PFA", municipio: null, uf_candidato: "MG", eleito: true, gasto: 1000, votos: 100, receita: 2000, publico: 500, ...o,
});
const zero: ContagemFundos = { maioria: 0, parte: 0, nada: 0, sem_receita: 0, sem_contas: 0 };

describe("quemDe e hrefMapaDinheiro com quem", () => {
  it("só aceita eleitos; o resto é todos", () => {
    expect(quemDe("eleitos")).toBe("eleitos");
    expect(quemDe(["eleitos", "todos"])).toBe("eleitos");
    expect(quemDe("x")).toBe("todos");
    expect(quemDe(undefined)).toBe("todos");
  });
  it("guarda quem=eleitos no endereço e solta com null", () => {
    expect(hrefMapaDinheiro({ ano: 2024, cargo: "Vereador", quem: "eleitos" })).toBe("/?ver=dinheiro&ano=2024&quem=eleitos#mapa");
    expect(hrefMapaDinheiro({ ano: 2024, cargo: "Vereador", quem: "eleitos" }, { quem: null })).toBe("/?ver=dinheiro&ano=2024#mapa");
    expect(hrefMapaDinheiro({ ano: 2024, cargo: "Vereador", quem: "todos" })).toBe("/?ver=dinheiro&ano=2024#mapa");
  });
});

describe("fundoDe", () => {
  it("separa em cinco grupos, com a metade exata como dependência", () => {
    expect(fundoDe({ prestou: false, receita: 100, receita_publica: 100 })).toBe("sem_contas");
    expect(fundoDe({ prestou: true, receita: 0, receita_publica: 0 })).toBe("sem_receita");
    expect(fundoDe({ prestou: true, receita: 100, receita_publica: 0 })).toBe("nada");
    expect(fundoDe({ prestou: true, receita: 100, receita_publica: 50 })).toBe("maioria");
    expect(fundoDe({ prestou: true, receita: 100, receita_publica: 49.99 })).toBe("parte");
  });
});

describe("deCada100", () => {
  it("soma exatamente 100 e tira os grupos vazios", () => {
    const g = deCada100({ maioria: 1, parte: 1, nada: 1, sem_receita: 0, sem_contas: 0 })!;
    expect(g.map((x) => x.chave)).toEqual(["maioria", "parte", "nada"]);
    expect(g.reduce((a, x) => a + x.de100, 0)).toBe(100);
    expect(g.map((x) => x.de100)).toEqual([34, 33, 33]);   // a sobra vai para o primeiro no empate de restos
  });
  it("com os números já em 100, não mexe; sem ninguém, null", () => {
    expect(deCada100({ maioria: 63, parte: 7, nada: 15, sem_receita: 13, sem_contas: 2 })!.map((x) => x.de100)).toEqual([63, 7, 15, 13, 2]);
    expect(deCada100(zero)).toBeNull();
  });
  it("arredonda pelos maiores restos", () => {
    // 3028/4780 = 63,35; 323 = 6,76; 706 = 14,77; 614 = 12,85; 109 = 2,28 → 63 + 7 + 15 + 13 + 2
    expect(deCada100({ maioria: 3028, parte: 323, nada: 706, sem_receita: 614, sem_contas: 109 })!.map((x) => x.de100)).toEqual([63, 7, 15, 13, 2]);
  });
});

describe("dependeram, fraseDeCada100 e textoDependeram", () => {
  it("dá quantos de 100 dependeram, 0 se ninguém e null sem pessoas", () => {
    expect(dependeram({ ...zero, maioria: 3, nada: 1 })).toBe(75);
    expect(dependeram({ ...zero, nada: 4 })).toBe(0);
    expect(dependeram(zero)).toBeNull();
  });
  it("escreve a frase para candidatos e para eleitos", () => {
    const c = { maioria: 63, parte: 7, nada: 15, sem_receita: 13, sem_contas: 2 };
    expect(fraseDeCada100("Deputado estadual", 2022, c)).toBe("De cada 100 candidatos a deputado estadual em 2022, 63 tiveram mais da metade do dinheiro vindo de fundos públicos.");
    expect(fraseDeCada100("Vereador", 2024, { ...zero, maioria: 1, nada: 99 }, true)).toBe("De cada 100 eleitos para vereador em 2024, 1 teve mais da metade do dinheiro vindo de fundos públicos.");
    expect(fraseDeCada100("Vereador", 2024, zero)).toBeNull();
  });
  it("com poucas pessoas, mostra a conta de verdade", () => {
    expect(textoDependeram({ ...zero, maioria: 2, nada: 1 })).toBe("2 de 3");
    expect(textoDependeram({ ...zero, maioria: 63, nada: 37 })).toBe("63 de 100");
    expect(textoDependeram(zero)).toBeNull();
    expect(totalFundos({ maioria: 1, parte: 2, nada: 3, sem_receita: 4, sem_contas: 5 })).toBe(15);
  });
});

describe("cargosDoRecorte", () => {
  const linhas = [
    lc({ cargo: "Governador", vagas: 1, gasto: 5_000_000 }), lc({}), lc({ cargo: "Deputado federal" }), lc({ uf: null }), lc({ ano: 2018 }),
    lc({ ano: 2024, cargo: "Vereador", uf: "MG", porte: "ate5" }), lc({ ano: 2024, cargo: "Vereador", uf: "MG", porte: null, vagas: 0 }),
  ];
  it("pega os cargos da eleição no lugar, na ordem das opções do ano", () => {
    const cs = cargosDoRecorte(linhas, { ano: 2022, uf: "MG" });
    expect(cs.map((c) => c.cargo)).toEqual(["Deputado federal", "Deputado estadual", "Governador"]);
    expect(cs[2].porCadeira).toBe(5_000_000);
    expect(cs[1].todos.maioria).toBe(63);
    expect(cs[1].soEleitos).toEqual({ maioria: 6, parte: 2, nada: 2, sem_receita: 0, sem_contas: 0 });
    expect(cargosDoRecorte(linhas, { ano: 2022 })).toHaveLength(1);   // os seis estados: só a linha sem uf
  });
  it("o porte só vale nas municipais; sem cadeiras, sem custo da cadeira", () => {
    expect(cargosDoRecorte(linhas, { ano: 2024, uf: "MG", porte: "ate5" })).toHaveLength(1);
    expect(cargosDoRecorte(linhas, { ano: 2024, uf: "MG" })[0].porCadeira).toBeNull();
    expect(cargosDoRecorte(linhas, { ano: 2022, uf: "MG", porte: "ate5" })).toHaveLength(3);
  });
});

describe("cargoDeCandidatos", () => {
  it("soma a cidade: custo da cadeira, eleito típico (só quem prestou contas) e os grupos", () => {
    const cs = [
      cl({ eleito: true, gasto: 1000, receita: 1000, receita_publica: 800 }), cl({ eleito: true, gasto: 3000, receita: 3000, receita_publica: 0 }),
      cl({ eleito: true, gasto: 0, prestou: false }), cl({ gasto: 2000, receita: 0, receita_publica: 0 }),
    ];
    const c = cargoDeCandidatos("Vereador", cs, 2);
    expect(c.porCadeira).toBe(3000);
    expect(c.medianaEleito).toBe(2000);
    expect(c.eleitos).toBe(3);
    expect(c.gastoEleitos).toBe(4000);
    expect(c.todos).toEqual({ maioria: 1, parte: 0, nada: 1, sem_receita: 1, sem_contas: 1 });
    expect(c.soEleitos).toEqual({ maioria: 1, parte: 0, nada: 1, sem_receita: 0, sem_contas: 1 });
    expect(cargoDeCandidatos("Prefeito", [], 0).porCadeira).toBeNull();
  });
});

describe("foraDoRecorte", () => {
  const estados = [
    { ano: 2022, uf: "MG", cargo: "Deputado federal", nao_disputou_com_gasto: 3, gasto_nao_disputou: 30_000 },
    { ano: 2022, uf: "PE", cargo: "Deputado federal", nao_disputou_com_gasto: 1, gasto_nao_disputou: 10_000 },
  ];
  const resumo = [
    r({ id_municipio: 1, eleitorado: 3_000, vereador_nao_disputou_n: 2, vereador_nao_disputou_gasto: 500 }),
    r({ id_municipio: 2, eleitorado: 40_000, prefeito_nao_disputou_n: 1, prefeito_nao_disputou_gasto: 900 }),
  ];
  it("estado ou os seis: a tabela estados", () => {
    expect(foraDoRecorte({ resumo, estados }, { ano: 2022, cargo: "Deputado federal", uf: "MG" })).toEqual({ n: 3, gasto: 30_000 });
    expect(foraDoRecorte({ resumo, estados }, { ano: 2022, cargo: "Deputado federal" })).toEqual({ n: 4, gasto: 40_000 });
  });
  it("a cidade: a linha dela no resumo; com um porte: só as cidades dele", () => {
    expect(foraDoRecorte({ resumo, estados }, { ano: 2024, cargo: "Prefeito", mun: 2 })).toEqual({ n: 1, gasto: 900 });
    expect(foraDoRecorte({ resumo, estados }, { ano: 2024, cargo: "Prefeito", mun: 1 })).toBeNull();
    expect(foraDoRecorte({ resumo, estados }, { ano: 2024, cargo: "Vereador", porte: "ate5" })).toEqual({ n: 2, gasto: 500 });
  });
});

describe("cargosComForaDaDisputa", () => {
  it("soma o gasto de quem não disputou e recalcula o custo da cadeira", () => {
    const cs = cargosDoRecorte([lc({ cargo: "Deputado federal", vagas: 10, gasto: 1_000 }), lc({ vagas: 4, gasto: 400 }), lc({ cargo: "Governador", vagas: 0, gasto: 50 })], { ano: 2022, uf: "MG" });
    const fora = { "Deputado federal": { gasto: 200 } } as Record<string, { gasto: number }>;
    const com = cargosComForaDaDisputa(cs, (c) => fora[c] ?? null);
    expect(com.map((c) => [c.cargo, c.gasto, c.porCadeira])).toEqual([["Deputado federal", 1_200, 120], ["Deputado estadual", 400, 100], ["Governador", 50, null]]);
    expect(com[0].medianaEleito).toBe(cs[0].medianaEleito);
  });
});

describe("hrefLegislativoCusto", () => {
  it("leva à casa do cargo, só nas eleições gerais", () => {
    expect(hrefLegislativoCusto(2022, "Deputado federal", "MG")).toBe("/legislativo?casa=camara&ano=2022&ver=custo");
    expect(hrefLegislativoCusto(2018, "Senador")).toBe("/legislativo?casa=senado&ano=2018&ver=custo");
    expect(hrefLegislativoCusto(2022, "Deputado estadual", "MG")).toBe("/legislativo?casa=al-mg&ano=2022&ver=custo");
    expect(hrefLegislativoCusto(2022, "Deputado estadual")).toBeNull();   // sem estado, não há Assembleia
    expect(hrefLegislativoCusto(2022, "Governador", "MG")).toBeNull();
    expect(hrefLegislativoCusto(2024, "Vereador", "MG")).toBeNull();
  });
});

describe("maioresDoRecorte e maioresDeCandidatos", () => {
  it("pega o recorte e o grupo pedidos, em ordem, com cada voto e parte pública", () => {
    const linhas = [lm({ pos: 2, id_candidatura: 2, gasto: 500 }), lm({}), lm({ so_eleitos: true, id_candidatura: 9 }), lm({ uf: null, id_candidatura: 8 })];
    const ms = maioresDoRecorte(linhas, { ano: 2022, cargo: "Deputado estadual", uf: "MG" }, "todos");
    expect(ms.map((m) => m.id_candidatura)).toEqual([1, 2]);
    expect(ms[0].porVoto).toBe(10);
    expect(ms[0].partePublica).toBe(0.25);
    expect(maioresDoRecorte(linhas, { ano: 2022, cargo: "Deputado estadual", uf: "MG" }, "eleitos").map((m) => m.id_candidatura)).toEqual([9]);
  });
  it("sem receita, a parte pública fica indefinida; sem nome, avisa", () => {
    const [m] = maioresDoRecorte([lm({ receita: 0, nome_urna: null })], { ano: 2022, cargo: "Deputado estadual", uf: "MG" }, "todos");
    expect(m.partePublica).toBeNull();
    expect(m.nome).toBe("(sem nome)");
  });
  it("na cidade: só quem declarou gasto, do maior para o menor, e só eleitos se pedido", () => {
    const cs = [cl({ id_candidatura: 1, gasto: 10 }), cl({ id_candidatura: 2, gasto: 30, eleito: true }), cl({ id_candidatura: 3, gasto: 0 }), cl({ id_candidatura: 4, gasto: 20 })];
    expect(maioresDeCandidatos(cs, "todos").map((m) => m.id_candidatura)).toEqual([2, 4, 1]);
    expect(maioresDeCandidatos(cs, "eleitos").map((m) => m.id_candidatura)).toEqual([2]);
    expect(maioresDeCandidatos(cs, "todos", 1)).toHaveLength(1);
  });
});

describe("parteDoTotal e caminhoPecas", () => {
  it("dá a parte do total e nada sem total", () => {
    expect(parteDoTotal(25, 100)).toBe(0.25);
    expect(parteDoTotal(25, 0)).toBeNull();
    expect(parteDoTotal(25, null)).toBeNull();
  });
  it("monta o caminho: a cidade vale no lugar do estado, e eleitos só quando pedido", () => {
    expect(caminhoPecas({ ano: 2022, cargo: "Deputado estadual", uf: "MG" }, "todos")).toBe("/dinheiro/pecas?ano=2022&cargo=Deputado+estadual&uf=MG");
    expect(caminhoPecas({ ano: 2024, cargo: "Vereador", uf: "MG", mun: 7 }, "eleitos")).toBe("/dinheiro/pecas?ano=2024&cargo=Vereador&mun=7&eleitos=true");
    expect(caminhoPecas({ ano: 2024, cargo: "Vereador" }, "todos")).toBe("/dinheiro/pecas?ano=2024&cargo=Vereador");
  });
});

describe("parteDependeu e fraseDependeram", () => {
  const z: ContagemFundos = { maioria: 0, parte: 0, nada: 0, sem_receita: 0, sem_contas: 0 };
  it("dá a parte que dependeu, e null sem ninguém", () => {
    expect(parteDependeu({ ...z, maioria: 3, nada: 1 })).toBe(0.75);
    expect(parteDependeu(z)).toBeNull();
  });
  it("escreve a conta real com o verbo no número certo", () => {
    expect(fraseDependeram({ ...z, maioria: 3, nada: 2 }, { ...z, maioria: 1 })).toBe("3 de 5 candidatos dependeram do dinheiro público; entre os eleitos, 1 de 1.");
    expect(fraseDependeram({ ...z, maioria: 1, nada: 4 }, { ...z, nada: 1 })).toBe("1 de 5 candidatos dependeu do dinheiro público; entre os eleitos, nenhum.");
    expect(fraseDependeram({ ...z, nada: 2 }, z)).toBe("Nenhum dos 2 candidatos dependeu do dinheiro público.");
    expect(fraseDependeram(z, z)).toContain("Ninguém");
  });
});

describe("perguntas do menu: PINTAR, telaDe, medidaDe, SECOES, MEIAS e MEDIDAS_ANOS", () => {
  it("o menu tem uma pergunta por item, nesta ordem, sem número", () => {
    expect(PINTAR.map((p) => p.chave)).toEqual(["vaga", "voto", "publico", "propaganda"]);
    expect(PINTAR.map((p) => p.rotulo)).toEqual(["Quanto custa uma cadeira?", "Patrimônio elege?", "Dinheiro público e privado", "Onde se investe em propaganda?"]);
    expect(PINTAR.some((p) => /^\d|pergunta/i.test(p.rotulo))).toBe(false);
    expect(escolhaMapaDinheiro({ pintar: "gastou" }).pintar).toBe("vaga");
    expect(hrefMapaDinheiro({ ano: 2024, cargo: "Vereador" }, { pintar: "voto" })).toBe("/?ver=dinheiro&pintar=voto#mapa");
  });
  it("os endereços de antes: ?pintar=voto&medir=publico abre a 8; ?pintar=publico e ?pintar=propaganda valem direto", () => {
    expect(escolhaMapaDinheiro({ pintar: "voto", medir: "publico" }).pintar).toBe("publico");
    expect(escolhaMapaDinheiro({ pintar: "voto", medir: "recursos" }).pintar).toBe("voto");
    expect(escolhaMapaDinheiro({ pintar: "vaga", medir: "publico" }).pintar).toBe("vaga");
    expect(escolhaMapaDinheiro({ pintar: "publico" }).pintar).toBe("publico");
    expect(escolhaMapaDinheiro({ pintar: "propaganda" }).pintar).toBe("propaganda");
    expect(escolhaMapaDinheiro({ pintar: "voto", medir: "publico" })).not.toHaveProperty("medir");
  });
  it("telaDe e os títulos: cada pergunta da VisaoDinheiro é uma tela (a 2 é a VisaoPatrimonio)", () => {
    expect(telaDe("vaga")).toBe("vaga");
    expect(telaDe("publico")).toBe("publico");
    expect(telaDe("propaganda")).toBe("propaganda");
    expect(TITULO_TELA).toEqual({ vaga: "Custo da cadeira", publico: "Dinheiro público e privado", propaganda: "Propaganda" });
  });
  it("só a 8 pinta a parte pública; as outras telas, o gasto por vaga", () => {
    expect(medidaDe("publico").chave).toBe("publico");
    for (const t of ["vaga", "propaganda"] as const) expect(medidaDe(t).chave).toBe("vaga");
  });
  it("cada tela mostra só os seus blocos: a 8 sem os da 9, e a 9 só os dela", () => {
    expect(SECOES.vaga).toEqual(["numeros", "cadeiras", "ranking"]);   // a 1 é uma conta do conjunto; o card "Desde" cobre os anos
    expect(SECOES.publico).toEqual(["p8"]);   // a 8: eleitos × não eleitos, no público e no privado (PublicoPrivado)
    expect(SECOES.propaganda).toEqual(SECOES_GASTARAM);
    expect(SECOES_GASTARAM).toEqual(["destino", "propaganda"]);
    for (const x of SECOES_GASTARAM) expect(SECOES.publico).not.toContain(x);
    expect(Object.keys(SECOES)).toEqual(["vaga", "publico", "propaganda"]);
  });
  it("os blocos de meia largura vêm aos pares, vizinhos, e são da própria tela", () => {
    expect(MEIAS).toEqual({ vaga: [], publico: [], propaganda: [] });
    for (const t of ["vaga", "publico", "propaganda"] as const) {
      const m = MEIAS[t];
      expect(m.length % 2).toBe(0);
      for (let k = 0; k < m.length; k += 2) expect(SECOES[t].indexOf(m[k + 1]) - SECOES[t].indexOf(m[k])).toBe(1);
    }
  });
  it("os anos mostram só as linhas da tela, e só nas que têm anos", () => {
    expect(MEDIDAS_ANOS).toEqual({ vaga: [], publico: [], propaganda: [] });
    for (const t of ["vaga", "publico", "propaganda"] as const) expect(MEDIDAS_ANOS[t].length > 0).toBe(SECOES[t].includes("anos"));
  });
});

describe("CALCULO_MAPA_DINHEIRO", () => {
  it("o mapa explica as próprias medidas e começa pela regra da análise, sem mudar o texto da análise", async () => {
    const { CALCULO_MAPA_DINHEIRO, METODOLOGIA } = await import("../src/lib/metodologia");
    expect(CALCULO_MAPA_DINHEIRO[0]).toBe(METODOLOGIA.dinheiro.calculo[0]);
    expect(CALCULO_MAPA_DINHEIRO.some((t) => t.startsWith("Gasto por eleitor"))).toBe(true);
    expect(CALCULO_MAPA_DINHEIRO.some((t) => t.startsWith("Cada cadeira"))).toBe(true);
    expect(METODOLOGIA.dinheiro.calculo.some((t) => t.startsWith("Gasto por eleitor"))).toBe(false);
  });
});

describe("intervalo", () => {
  it("escreve a unidade uma vez quando as pontas a têm igual", () => {
    expect(intervalo("40 mil", "46 mil")).toBe("40–46 mil");
    expect(intervalo("500 mil", "1 mi")).toBe("500 mil–1 mi");
    expect(intervalo("9,5 mil", "12 mil")).toBe("9,5–12 mil");
  });
});

describe("opcoesMunicipio e ufDoMunicipio", () => {
  const m = (cod_ibge: string, uf: string, nome: string) => ({ cod_ibge, uf, nome });
  const lista = [m("2", "PE", "Recife"), m("1", "PE", "Bom Jesus"), m("3", "RJ", "Bom Jesus do Itabapoana"), m("4", "RJ", "Angra dos Reis")];
  it("com estado, só as cidades dele, em ordem alfabética e sem a sigla", () => {
    expect(opcoesMunicipio(lista, "PE")).toEqual([["1", "Bom Jesus"], ["2", "Recife"]]);
  });
  it("sem estado, todas as cidades dos seis, com a sigla do estado", () => {
    expect(opcoesMunicipio(lista).map((o) => o[1])).toEqual(["Angra dos Reis (RJ)", "Bom Jesus (PE)", "Bom Jesus do Itabapoana (RJ)", "Recife (PE)"]);
  });
  it("acha o estado pelo código do IBGE; código vazio ou desconhecido não acha", () => {
    expect(ufDoMunicipio(lista, "3")).toBe("RJ");
    expect(ufDoMunicipio(lista, "99")).toBeUndefined();
    expect(ufDoMunicipio(lista, undefined)).toBeUndefined();
  });
});

describe("quartisDeEleicao e fraseQuartis", () => {
  const l = (faixa: number, candidaturas: number, eleitos: number) => ({ faixa, candidaturas, eleitos });
  const linhas = [l(4, 50, 20), l(4, 50, 10), l(3, 100, 10), l(2, 100, 5), l(1, 100, 3), l(0, 40, 0), l(-1, 30, 1)];
  it("soma por faixa, do quartil de mais dinheiro ao grupo sem dinheiro, sem quem não prestou contas", () => {
    const q = quartisDeEleicao(linhas);
    expect(q.map((g) => g.chave)).toEqual(["q4", "q3", "q2", "q1", "nada"]);
    expect(q[0]).toMatchObject({ candidaturas: 100, eleitos: 30, taxa: 0.3, rotulo: "Os 25% com mais dinheiro" });
    expect(q.reduce((a, g) => a + g.candidaturas, 0)).toBe(440);
  });
  it("no dinheiro público, os rótulos dizem público; grupos vazios saem", () => {
    const q = quartisDeEleicao([l(4, 10, 5), l(1, 10, 1)], true);
    expect(q.map((g) => g.rotulo)).toEqual(["Os 25% com mais dinheiro público", "Os 25% com menos dinheiro público"]);
  });
  it("a frase compara o topo com a base e diz quantas vezes, só a partir de 2", () => {
    expect(fraseQuartis(quartisDeEleicao(linhas))).toBe("Dos 25% com mais dinheiro, 30 em cada 100 se elegeram; dos 25% com menos dinheiro, 3 em cada 100: 10 vezes mais.");
    expect(fraseQuartis(quartisDeEleicao([l(4, 10, 3), l(1, 10, 2)]))).toBe("Dos 25% com mais dinheiro, 30 em cada 100 se elegeram; dos 25% com menos dinheiro, 20 em cada 100.");
    expect(fraseQuartis(quartisDeEleicao([l(4, 10, 3)]))).toBeNull();
  });
});

describe("barraPropaganda", () => {
  const termo = (por_tipo: { grupo: string; centavos: number }[]) => ({ por_tipo: por_tipo.map((p) => ({ ...p, despesas: 1 })) }) as never;
  it("soma o por_tipo de todos os termos por tipo; grupo desconhecido vai para Outra propaganda", () => {
    const f = barraPropaganda({ todos: [
      termo([{ grupo: "propaganda_fisica", centavos: 10_000 }, { grupo: "propaganda_digital", centavos: 5_000 }]),
      termo([{ grupo: "propaganda_fisica", centavos: 20_000 }, { grupo: "xyz", centavos: 1_000 }, { grupo: "", centavos: 1_000 }]),
      termo([{ grupo: "propaganda_audiovisual", centavos: 3_000 }]),
    ] });
    expect(f.map((x) => [x.rotulo, x.valor, x.cor])).toEqual([
      ["Impressos e rua", 300, "pp-fis"], ["Rádio, TV e vídeo", 30, "pp-av"], ["Internet", 50, "pp-dig"], ["Outra propaganda", 20, "pp-outra"],
    ]);
  });
  it("grupos com valor 0 saem", () => {
    expect(barraPropaganda({ todos: [termo([{ grupo: "propaganda_digital", centavos: 100 }])] }).map((x) => x.rotulo)).toEqual(["Internet"]);
  });
});

describe("parteDaPropaganda", () => {
  it("só os 3 grupos de propaganda entram no numerador; sem total, null", () => {
    const g = [{ grupo: "propaganda_fisica", valor: 30 }, { grupo: "propaganda_digital", valor: 10 }, { grupo: "propaganda_audiovisual", valor: 10 },
      { grupo: "pessoal", valor: 40 }, { grupo: "outros", valor: 10 }];
    expect(parteDaPropaganda(g)).toEqual({ valor: 50, total: 100, parte: 0.5 });
    expect(parteDaPropaganda([])).toBeNull();
  });
});

describe("GRUPOS_DESPESA", () => {
  it("o grupo outros diz o que tem dentro", () => {
    expect(GRUPOS_DESPESA.find((g) => g.chave === "outros")?.rotulo).toBe("Taxas, multas e outros");
  });
});
