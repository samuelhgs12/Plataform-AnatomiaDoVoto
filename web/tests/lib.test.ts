import { describe, expect, it } from "vitest";
import { agruparFluxo, type LinhaFluxo } from "../src/lib/fluxo";
import { agregarPorPartido, proporcao, type LinhaLegenda } from "../src/lib/legenda";
import { compacto, iniciais } from "../src/lib/format";

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

describe("agregarPorPartido", () => {
  const l = (o: Partial<LinhaLegenda>): LinhaLegenda => ({ ano: 2018, cargo: "Deputado estadual", uf: "MG", numero: 10, sigla: "PRB", votos_nominais: 100, votos_legenda: 25, ...o });
  it("unifica siglas renomeadas e soma os votos", () => {
    const { partidos, anos } = agregarPorPartido([l({}), l({ ano: 2020, sigla: "REPUBLICANOS", votos_legenda: 75 })]);
    expect(partidos).toHaveLength(1);
    expect(partidos[0].partido).toBe("REPUBLICANOS");
    expect(partidos[0].legendaTotal).toBe(100);
    expect(anos).toEqual([2018, 2020]);
  });
  it("não unifica fusões (DEM e UNIÃO continuam separados)", () => {
    const { partidos } = agregarPorPartido([l({ sigla: "DEM" }), l({ ano: 2022, sigla: "UNIÃO" })]);
    expect(partidos.map((p) => p.partido).sort()).toEqual(["DEM", "UNIÃO"]);
  });
  it("calcula a proporção de legenda", () => {
    expect(proporcao(120, 400)).toBeCloseTo(0.2308, 4);
    expect(proporcao(0, 0)).toBe(0);
  });
});

describe("format", () => {
  it("abrevia números e gera iniciais", () => {
    expect(compacto(629200)).toBe("629,2 mil");
    expect(compacto(3700000)).toBe("3,7 mi");
    expect(iniciais("MARIA DA SILVA")).toBe("MS");
  });
});
