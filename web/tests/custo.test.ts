import { describe, expect, it } from "vitest";
import { cargoPadrao, custoDoCargo, custoPorAno, custoPorCargo, custoPorUf, variacao, type LinhaCusto } from "../src/lib/custo";

const l = (o: Partial<LinhaCusto>): LinhaCusto => ({
  ano: 2022, cargo: "Deputado federal", uf: "MG", candidatos: 100, com_gasto: 90, eleitos: 10, vagas: 10,
  gasto_total: 1_000_000, gasto_eleitos: 400_000, ...o,
});
const linhas = [
  l({}), l({ uf: "PE", candidatos: 50, eleitos: 5, vagas: 5, gasto_total: 1_000_000, gasto_eleitos: 600_000 }),
  l({ cargo: "Presidente", uf: "BR", candidatos: 10, eleitos: 1, vagas: 1, gasto_total: 5_000_000, gasto_eleitos: 2_000_000 }),
  l({ ano: 2018, gasto_total: 500_000 }),
];

describe("custoDoCargo", () => {
  it("divide o gasto pelas vagas (cadeira) e pelos candidatos", () => {
    const c = custoDoCargo(linhas, { ano: 2022, cargo: "Deputado federal" })!;
    expect(c.gasto).toBe(2_000_000);
    expect(c.vagas).toBe(15);
    expect(c.porCadeira).toBeCloseTo(133_333.33, 1);
    expect(c.porCandidato).toBeCloseTo(13_333.33, 1);
    expect(c.parteEleitos).toBeCloseTo(0.5);
    expect(c.candidatosPorVaga).toBe(10);
  });
  it("filtra a UF e devolve null sem dados", () => {
    expect(custoDoCargo(linhas, { ano: 2022, cargo: "Deputado federal", uf: "PE" })!.porCadeira).toBe(200_000);
    expect(custoDoCargo(linhas, { ano: 2022, cargo: "Vereador" })).toBeNull();
  });
  it("não divide por zero", () => {
    const c = custoDoCargo([l({ vagas: 0, candidatos: 0, gasto_total: 0 })], { ano: 2022, cargo: "Deputado federal" })!;
    expect(c.porCadeira).toBeNull();
    expect(c.porCandidato).toBeNull();
    expect(c.parteEleitos).toBeNull();
  });
});

describe("custoPorCargo", () => {
  it("lista do cargo mais alto ao mais baixo e tira o presidente quando há UF", () => {
    expect(custoPorCargo(linhas, 2022).map((c) => c.cargo)).toEqual(["Presidente", "Deputado federal"]);
    expect(custoPorCargo(linhas, 2022, "MG").map((c) => c.cargo)).toEqual(["Deputado federal"]);
  });
});

describe("custoPorAno e custoPorUf", () => {
  it("traz o cargo em cada eleição", () => {
    expect(custoPorAno(linhas, "Deputado federal", "MG").map((c) => [c.ano, c.porCadeira])).toEqual([[2018, 50_000], [2022, 100_000]]);
  });
  it("ordena as UFs da cadeira mais cara para a mais barata, sem o presidente", () => {
    expect(custoPorUf(linhas, 2022, "Deputado federal").map((c) => c.uf)).toEqual(["PE", "MG"]);
    expect(custoPorUf(linhas, 2022, "Presidente")).toEqual([]);
  });
});

describe("variacao e cargoPadrao", () => {
  it("calcula a variação e evita divisão por zero", () => {
    expect(variacao(100, 238)).toBeCloseTo(1.38);
    expect(variacao(0, 10)).toBeNull();
    expect(variacao(null, 10)).toBeNull();
  });
  it("escolhe deputado federal nas gerais e prefeito nas municipais", () => {
    expect(cargoPadrao(["Presidente", "Deputado federal"], 2022)).toBe("Deputado federal");
    expect(cargoPadrao(["Prefeito", "Vereador"], 2024)).toBe("Prefeito");
    expect(cargoPadrao(["Vereador"], 2024)).toBe("Vereador");
  });
});
