import { describe, expect, it } from "vitest";
import { evolucaoPatrimonio, frasePatrimonio, grupoDoBem, textoVariacao, type LinhaPatrimonio } from "../src/lib/patrimonio-perfil";

const l = (o: Partial<LinhaPatrimonio>): LinhaPatrimonio => ({
  id_candidatura: 1, ano: 2018, cargo: "Deputado estadual", uf: "MG", municipio: null, eleito: false, cd_tipo_bem: 12, valor: 100_000, bens: 1, ...o,
});
const sem = (s: string) => s.replace(/ /g, " ");

describe("grupoDoBem", () => {
  it("separa pelas faixas de código do Imposto de Renda", () => {
    expect([12, 1, 19, 21, 22, 31, 39, 41, 63, 79, 24, 99, null].map(grupoDoBem)).toEqual([
      "imoveis", "imoveis", "imoveis", "veiculos", "veiculos", "empresas", "empresas", "aplicacoes", "aplicacoes", "aplicacoes", "outros", "outros", "outros",
    ]);
  });
});

describe("evolucaoPatrimonio", () => {
  it("uma candidatura por ponto, da mais antiga à mais recente, somando os tipos nos grupos", () => {
    const p = evolucaoPatrimonio([
      l({ id_candidatura: 2, ano: 2022, cd_tipo_bem: 21, valor: 50_000 }),
      l({ id_candidatura: 2, ano: 2022, cd_tipo_bem: 11, valor: 250_000, bens: 2 }),
      l({ id_candidatura: 1, ano: 2018 }),
    ]);
    expect(p.map((x) => [x.ano, x.total, x.bens])).toEqual([[2018, 100_000, 1], [2022, 300_000, 3]]);
    expect(p[1].grupos.map((g) => g.valor)).toEqual([250_000, 50_000, 0, 0, 0]);
  });
  it("variação desde a candidatura anterior; null na primeira e quando a anterior não tinha bens", () => {
    const p = evolucaoPatrimonio([
      l({ id_candidatura: 1, ano: 2014, cd_tipo_bem: null, valor: 0, bens: 0 }),
      l({ id_candidatura: 2, ano: 2018, valor: 100_000 }),
      l({ id_candidatura: 3, ano: 2022, valor: 150_000 }),
    ]);
    expect(p.map((x) => x.variacao)).toEqual([null, null, 0.5]);
    expect(p[2].antes).toEqual({ ano: 2018, total: 100_000 });
    expect(p[0].total).toBe(0);
  });
  it("duas candidaturas no mesmo ano comparam com o ano anterior, não entre si", () => {
    const p = evolucaoPatrimonio([l({ id_candidatura: 1, ano: 2016, valor: 10 }), l({ id_candidatura: 2, ano: 2020, valor: 20 }), l({ id_candidatura: 3, ano: 2020, valor: 30 })]);
    expect(p.map((x) => x.antes?.ano ?? null)).toEqual([null, 2016, 2016]);
  });
});

describe("textoVariacao", () => {
  it("com sinal; a partir de nada declarado; sem anterior, null", () => {
    expect(textoVariacao({ antes: { ano: 2018, total: 100 }, variacao: 0.5, total: 150 })).toBe("+50% desde 2018");
    expect(textoVariacao({ antes: { ano: 2018, total: 100 }, variacao: -0.3, total: 70 })).toBe("−30% desde 2018");
    expect(textoVariacao({ antes: { ano: 2014, total: 0 }, variacao: null, total: 100 })).toBe("nada declarado em 2014");
    expect(textoVariacao({ antes: null, variacao: null, total: 100 })).toBeNull();
  });
});

describe("frasePatrimonio", () => {
  const pts = (...v: [number, number][]) => evolucaoPatrimonio(v.map(([ano, valor], i) => l({ id_candidatura: i + 1, ano, valor })));
  it("da primeira à última candidatura, com a variação sem sinal", () => {
    expect(sem(frasePatrimonio(pts([2018, 1_000_000], [2026, 1_500_000]))!)).toBe("De R$ 1 milhão em 2018 para R$ 1,5 milhão em 2026: aumentou 50%.");
    expect(sem(frasePatrimonio(pts([2018, 1_000_000], [2022, 700_000]))!)).toBe("De R$ 1 milhão em 2018 para R$ 700 mil em 2022: diminuiu 30%.");
  });
  it("acima do dobro, em vezes: uma casa abaixo de 10", () => {
    expect(sem(frasePatrimonio(pts([2006, 839_034], [2026, 4_775_651]))!)).toBe("De R$ 839 mil em 2006 para R$ 4,8 milhões em 2026: multiplicou por 5,7.");
    expect(sem(frasePatrimonio(pts([2016, 25_000], [2026, 957_000]))!)).toBe("De R$ 25 mil em 2016 para R$ 957 mil em 2026: multiplicou por 38.");
    expect(sem(frasePatrimonio(pts([2016, 100], [2020, 200]))!)).toMatch(/multiplicou por 2\.$/);
  });
  it("partindo de nenhum bem, sem porcentagem; uma candidatura só, só o valor; nada, null", () => {
    expect(sem(frasePatrimonio(pts([2018, 0], [2022, 50_000]))!)).toBe("De nenhum bem em 2018 para R$ 50 mil em 2022.");
    expect(sem(frasePatrimonio(pts([2022, 50_000]))!)).toBe("R$ 50 mil declarados em 2022.");
    expect(frasePatrimonio([])).toBeNull();
  });
});
