import { describe, expect, it } from "vitest";
import { agruparFluxo, type LinhaFluxo } from "../src/lib/fluxo";
import { compacto, iniciais, pp } from "../src/lib/format";

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
    expect(pp(0.012)).toBe("+1,2 p.p.");
    expect(pp(-0.1091)).toBe("−10,9 p.p.");
  });
});
