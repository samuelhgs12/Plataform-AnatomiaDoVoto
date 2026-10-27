import { describe, expect, it } from "vitest";
import {
  cargosDoAno, classeComPorte, corCidade, corPorFaixas, ehMunicipal, valorDoEstado, fraseTaxas, hrefDinheiro, legendaCidade, lerRecorte, qualificacao, referenciaDoPorte, textoValor, valorCidade,
} from "../src/lib/dinheiro";
import type { LinhaMunicipio, LinhaResumo } from "../src/lib/territorio";

const r = (o: Partial<LinhaResumo>): LinhaResumo => ({
  ano: 2024, id_municipio: 1, uf: "PE", vereador_candidatos: 100, vereador_eleitos: 10, vereador_vagas: 10,
  vereador_gasto: 500_000, vereador_receita: 600_000, vereador_publica: 300_000, vereador_sem_prestacao: 0, prefeito_sem_prestacao: 0,
  prefeito_candidatos: 3, prefeito_gasto: 900_000, prefeito_receita: 400_000, prefeito_publica: 300_000,
  prefeito_id_candidato: 7, prefeito_nome: "FULANO", prefeito_partido: "PFA", prefeito_votos: 5000, prefeito_gasto_eleito: 400_000,
  maior_venceu: true, eleitorado: 30_000, rec_mais_cand: 20, rec_mais_eleitos: 6, ...o,
});
const ms: LinhaMunicipio[] = [{ id_municipio: 1474, uf: "PE", nome: "RECIFE", cod_ibge: "2611606" }, { id_municipio: 3, uf: "RJ", nome: "NITERÓI", cod_ibge: "3303302" }];
const op = { anos: [2018, 2020, 2022, 2024], ufs: ["PE", "RJ"], municipios: ms };

describe("cargosDoAno e ehMunicipal", () => {
  it("dá os cargos de cada tipo de eleição", () => {
    expect(ehMunicipal(2024)).toBe(true);
    expect(cargosDoAno(2024)[0]).toBe("Vereador");
    expect(cargosDoAno(2022)).toContain("Deputado federal");
  });
});

describe("lerRecorte", () => {
  it("usa o ano mais recente, o primeiro cargo e a primeira aba por padrão", () => {
    expect(lerRecorte({}, op)).toMatchObject({ ano: 2024, cargo: "Vereador", aba: "gasto", vista: "mapa", uf: undefined, mun: undefined });
  });
  it("troca o cargo incompatível com a eleição e avisa", () => {
    expect(lerRecorte({ ano: "2022", cargo: "Prefeito" }, op)).toMatchObject({ cargo: "Deputado federal", cargoTrocado: "Prefeito" });
  });
  it("tira a cidade numa eleição geral e avisa; a cidade dá o estado", () => {
    expect(lerRecorte({ ano: "2022", mun: "1474" }, op)).toMatchObject({ mun: undefined, munIgnorado: true });
    expect(lerRecorte({ mun: "1474" }, op)).toMatchObject({ uf: "PE", mun: { id_municipio: 1474 } });
    expect(lerRecorte({ uf: "RJ", mun: "1474" }, op).mun).toBeUndefined();
  });
});

describe("hrefDinheiro", () => {
  it("mantém o recorte e solta a cidade quando o estado muda", () => {
    const rec = lerRecorte({ mun: "1474", aba: "publico" }, op);
    expect(hrefDinheiro(rec, { cargo: "Prefeito" })).toBe("/analises/dinheiro?ano=2024&cargo=Prefeito&uf=PE&mun=1474&aba=publico");
    expect(hrefDinheiro(rec, { uf: "RJ" })).toBe("/analises/dinheiro?ano=2024&cargo=Vereador&uf=RJ&aba=publico");
    expect(hrefDinheiro(rec, { aba: null }, "mapa")).toBe("/analises/dinheiro?ano=2024&cargo=Vereador&uf=PE&mun=1474#mapa");
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
});

describe("corCidade, legendaCidade e textoValor", () => {
  it("usa faixas fixas e separa 'não informado'", () => {
    expect(corCidade(50_000, "gasto", "Vereador")).toBe("q4");
    expect(corCidade(3_000, "gasto", "Vereador")).toBe("q1");
    expect(corCidade(0, "resultado", "Prefeito")).toBe("q0");
    expect(corCidade(null, "publico", "Vereador")).toBe("sem");
    expect(legendaCidade("gasto", "Vereador").map((l) => l.texto)).toEqual(["até R$ 2 mil", "R$ 2–5 mil", "R$ 5–10 mil", "R$ 10–25 mil", "R$ 25 mil ou mais", "Não informado"]);
    expect(legendaCidade("gasto", "Prefeito")[4].texto).toBe("R$ 1 mi ou mais");
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
    expect(qualificacao("Sim.")).toMatch(/grande demais para ser acaso/);
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
  it("pinta por faixas e apaga as cidades de outro porte", () => {
    expect(corPorFaixas(0.65, [0.5, 0.6, 0.7, 0.8])).toBe("q2");
    expect(corPorFaixas(null, [1])).toBe("sem");
    expect(classeComPorte("q2", "ate10", "ate50")).toBe("q2 apagado");
    expect(classeComPorte("q2", "ate50", "ate50")).toBe("q2");
    expect(classeComPorte("q2", "ate10", undefined)).toBe("q2");
  });
});
