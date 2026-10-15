import { describe, expect, it } from "vitest";
import { destacarBusca, normalizarBusca } from "../src/lib/busca";
import { agruparFluxo, type LinhaFluxo } from "../src/lib/fluxo";
import { compacto, iniciais, pctSinal, reais } from "../src/lib/format";
import { contarFaixas, deCada100, descreverMudancas, emCada10, ordenarPartidos, parteDosEleitos, sucessoPorFaixa, sucessoTresGrupos, type LinhaSucesso, medianasPorCargo, porAno, porPartido, porUf, somar, textoDe100, type LinhaFaixa, type LinhaFontes, type LinhaMediana } from "../src/lib/financiamento";

const fluxo = (o: Partial<LinhaFluxo>): LinhaFluxo => ({ ano_mandato: 2016, cargo_origem: "Vereador", nivel_origem: 1, uf: "MG", genero: "FEMININO", destino: "Reeleito", n: 10, ...o });

describe("agruparFluxo", () => {
  const linhas = [fluxo({ n: 30 }), fluxo({ destino: "Não disputou a eleição seguinte", n: 10 }), fluxo({ uf: "PE", n: 5 }), fluxo({ cargo_origem: "Prefeito", nivel_origem: 2, n: 4 })];
  it("soma por cargo e ordena pelo nível", () => {
    const g = agruparFluxo(linhas, {}, 1);
    expect(g.map((x) => x.cargo)).toEqual(["Vereador", "Prefeito"]);
    expect(g[0].total).toBe(45);
    expect(g[0].porDestino["Reeleito"]).toBe(35);
  });
  it("aplica filtro de UF e descarta cargos com poucos mandatos", () => {
    const g = agruparFluxo(linhas, { uf: "MG" }, 20);
    expect(g).toHaveLength(1);
    expect(g[0].total).toBe(40);
  });
});

describe("format", () => {
  it("abrevia números e gera iniciais", () => {
    expect(compacto(629200)).toBe("629,2 mil");
    expect(compacto(3700000)).toBe("3,7 mi");
    expect(iniciais("MARIA DA SILVA")).toBe("MS");
    expect(pctSinal(0.25)).toBe("+25%");
    expect(pctSinal(-0.555, 1)).toBe("−55,5%");
    expect(pctSinal(-0.004)).toBe("0%");
  });
});

describe("financiamento (pergunta 8)", () => {
  const fo = (o: Partial<LinhaFontes>): LinhaFontes => ({
    ano: 2022, cargo: "Deputado federal", uf: "MG", partido: "PT", eleito: false, candidaturas: 10, com_receita: 8,
    fundo_eleitoral: 600, fundo_partidario: 100, doacoes_pessoas: 200, recursos_proprios: 100, outros_privados: 0, ...o,
  });
  const linhas = [fo({}), fo({ uf: "PE", partido: "PL", eleito: true, fundo_eleitoral: 0, fundo_partidario: 0 }), fo({ ano: 2024, cargo: "Vereador" })];

  it("soma as fontes e separa público de privado", () => {
    const s = somar(linhas, { ano: 2022, uf: "MG" });
    expect(s.total).toBe(1000);
    expect(s.publico).toBe(700);
    expect(s.privado).toBe(300);
    expect(s.candidaturas).toBe(10);
    expect(somar(linhas, { ano: 2022 }).total).toBe(1300);
  });
  it("agrupa por ano e por partido (maior primeiro)", () => {
    expect(porAno(linhas, { cargo: "Vereador" }).map((a) => a.soma.total)).toEqual([0, 1000]);
    expect(porPartido(linhas, { ano: 2022 }).map((p) => p.partido)).toEqual(["PT", "PL"]);
  });
  it("compara estados pelo % público, sem a campanha nacional", () => {
    const l = [...linhas, fo({ uf: "BR", cargo: "Presidente" })];
    const u = porUf(l, { ano: 2022 });
    expect(u.map((x) => x.uf)).toEqual(["MG", "PE"]);
    expect(u[0].soma.publico).toBe(700);
  });
  it("compara geral com geral e municipal com municipal", () => {
    const l = [fo({ ano: 2018, fundo_eleitoral: 582, fundo_partidario: 0 }), fo({ ano: 2022, fundo_eleitoral: 1279, fundo_partidario: 0 }), fo({ ano: 2024, cargo: "Vereador" })];
    const m = descreverMudancas(porAno(l, {}));
    expect(m).toEqual([{ tipo: "gerais", texto: "o dinheiro público foi de 66% em 2018 para 81% em 2022 (subiu 15 pontos)." }]);
  });
  it("ordena partidos por valor ou por % público, sem os muito pequenos", () => {
    const l = [fo({ partido: "A" }), fo({ partido: "B", fundo_eleitoral: 5000 }), fo({ partido: "NANICO", fundo_eleitoral: 1, fundo_partidario: 0, doacoes_pessoas: 0, recursos_proprios: 0 })];
    const p = porPartido(l, { ano: 2022 });
    expect(ordenarPartidos(p, "valor").map((x) => x.partido)).toEqual(["B", "A", "NANICO"]);
    expect(ordenarPartidos(p, "publico").map((x) => x.partido)).toEqual(["B", "A"]);
  });
  it("calcula a taxa de eleição por faixa de dinheiro público", () => {
    const su = (o: Partial<LinhaSucesso>): LinhaSucesso => ({ ano: 2022, cargo: "Deputado federal", uf: "MG", faixa: 4, candidaturas: 100, eleitos: 22, publico_min: 200000, publico_max: 3000000, ...o });
    const r = sucessoPorFaixa([su({}), su({ uf: "PE", candidaturas: 100, eleitos: 18 }), su({ faixa: 0, candidaturas: 50, eleitos: 0, publico_min: 0, publico_max: 0 })], { ano: 2022 });
    expect(r).toHaveLength(5);
    expect(r[4].taxa).toBeCloseTo(0.2);
    expect(r[0].taxa).toBe(0);
    expect(r[2].candidaturas).toBe(0);
  });
  it("junta as faixas em nada / pouco / muito", () => {
    const su = (o: Partial<LinhaSucesso>): LinhaSucesso => ({ ano: 2022, cargo: "Deputado federal", uf: "MG", faixa: 1, candidaturas: 100, eleitos: 1, publico_min: 1, publico_max: 2, ...o });
    const g = sucessoTresGrupos([su({ faixa: 0, eleitos: 0 }), su({}), su({ faixa: 2 }), su({ faixa: 3, eleitos: 4 }), su({ faixa: 4, eleitos: 22 })], { ano: 2022 });
    expect(g.nada.taxa).toBe(0);
    expect(g.pouco.candidaturas).toBe(300);
    expect(g.pouco.taxa).toBeCloseTo(0.02);
    expect(g.muito.taxa).toBeCloseTo(0.22);
  });
  it("mede a parte do dinheiro público que ficou com os eleitos", () => {
    const r = parteDosEleitos([fo({ eleito: true, candidaturas: 1 }), fo({ candidaturas: 9, fundo_eleitoral: 0, fundo_partidario: 300 })], { ano: 2022 });
    expect(r.pctCandidatos).toBeCloseTo(0.1);
    expect(r.pctPublico).toBeCloseTo(0.7);
  });
  it("divide em 100 sem sobrar nem faltar", () => {
    expect(deCada100([1, 1, 1])).toEqual([34, 33, 33]);
    expect(deCada100([600, 100, 200, 100, 0])).toEqual([60, 10, 20, 10, 0]);
    expect(deCada100([0, 0]).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it("conta faixas e filtra eleitos", () => {
    const fx = (o: Partial<LinhaFaixa>): LinhaFaixa => ({ ano: 2022, cargo: "Senador", uf: "RJ", eleito: false, faixa: "so_publico", candidaturas: 3, ...o });
    const l = [fx({}), fx({ faixa: "sem_receita", candidaturas: 1 }), fx({ eleito: true, faixa: "mais_privado", candidaturas: 2 })];
    expect(contarFaixas(l, { ano: 2022 }).total).toBe(6);
    expect(contarFaixas(l, { ano: 2022 }, true).porFaixa.mais_privado).toBe(2);
  });
  it("usa a linha sem UF para 'todas as UFs' nas medianas", () => {
    const m = (o: Partial<LinhaMediana>): LinhaMediana => ({ ano: 2024, cargo: "Vereador", uf: null, eleito: true, candidaturas: 5, mediana_total: 20000, mediana_publico: 12000, mediana_pct_publico: 0.6, ...o });
    const l = [m({}), m({ eleito: false, mediana_total: 2000 }), m({ uf: "MG", mediana_total: 1 }), m({ cargo: "Prefeito" })];
    const r = medianasPorCargo(l, 2024);
    expect(r.map((x) => x.cargo)).toEqual(["Prefeito", "Vereador"]);
    expect(r[1].eleito?.mediana_total).toBe(20000);
    expect(r[1].naoEleito?.mediana_total).toBe(2000);
  });
  it("escreve frações e valores para leigos", () => {
    expect(emCada10(0.31)).toBe("3 em cada 10 candidatos");
    expect(textoDe100(0, 2000)).toBe("menos de R$ 1 de cada R$ 100");
    expect(textoDe100(14, 1)).toBe("R$ 14 de cada R$ 100");
    expect(emCada10(0)).toBe("nenhum candidato");
    expect(emCada10(0.97)).toBe("quase todos os candidatos");
    expect(reais(1665900000)).toBe("R$ 1,7 bilhão");
    expect(reais(2023700000)).toBe("R$ 2 bilhões");
    expect(reais(120400000)).toBe("R$ 120 milhões");
    expect(reais(20400)).toBe("R$ 20 mil");
  });
});

describe("destacarBusca", () => {
  const marcado = (nome: string, q: string) => destacarBusca(nome, q).filter((t) => t.casou).map((t) => t.texto).join("|");

  it("normaliza como a API", () => {
    expect(normalizarBusca("  João, do Comércio! ")).toBe("joao do comercio");
  });
  it("marca o trecho contínuo ignorando acento e caixa", () => {
    expect(destacarBusca("JOÃO DO COMÉRCIO", "joao do com")).toEqual([
      { texto: "JOÃO DO COM", casou: true },
      { texto: "ÉRCIO", casou: false },
    ]);
    expect(marcado("MARIA DA SILVA SANTOS", "silva san")).toBe("SILVA SAN");
  });
  it("atravessa pontuação", () => {
    expect(marcado("DR. LULA PEREIRA", "dr lula")).toBe("DR. LULA");
  });
  it("só casa no início de palavra e na ordem", () => {
    expect(marcado("CELULAR", "lula")).toBe("");
    expect(marcado("MARIA DA SILVA", "maria silva")).toBe("");
    expect(destacarBusca("MARIA DA SILVA", "maria silva")).toEqual([{ texto: "MARIA DA SILVA", casou: false }]);
  });
});
