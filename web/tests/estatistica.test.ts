import { describe, expect, it } from "vitest";
import { compararGrupos, explicacao, responder, zContagem, zProporcoes } from "../src/lib/estatistica";

describe("zProporcoes", () => {
  it("calcula o teste de duas proporções", () => {
    // 30% de 1000 contra 10% de 1000: diferença enorme
    expect(zProporcoes(300, 1000, 100, 1000)!).toBeCloseTo(11.18, 1);
    // 3 de 6 contra 1 de 6: diferença grande, amostra pequena
    expect(Math.abs(zProporcoes(3, 6, 1, 6)!)).toBeLessThan(1.96);
  });
  it("devolve 0 sem variação e null com grupo vazio", () => {
    expect(zProporcoes(0, 50, 0, 50)).toBe(0);
    expect(zProporcoes(1, 0, 1, 10)).toBeNull();
  });
});

describe("zContagem", () => {
  it("compara o observado com o esperado", () => {
    expect(zContagem(753, 459.2, 263)!).toBeCloseTo(18.1, 1);
    expect(zContagem(1, 1, 0)).toBeNull();
  });
});

describe("responder e compararGrupos", () => {
  it("diz 'Sim' só com diferença significativa e ao menos 20% maior", () => {
    expect(compararGrupos({ eleitos: 300, candidaturas: 1000 }, { eleitos: 100, candidaturas: 1000 }).resposta).toBe("Sim.");
    expect(compararGrupos({ eleitos: 100, candidaturas: 1000 }, { eleitos: 300, candidaturas: 1000 }).resposta).toBe("Não.");
  });
  it("sem diferença estatística, não conclui que é igual: 'sem diferença clara'", () => {
    expect(compararGrupos({ eleitos: 3, candidaturas: 6 }, { eleitos: 1, candidaturas: 6 }).resposta).toBe("Sem diferença clara.");
    expect(compararGrupos({ eleitos: 1010, candidaturas: 10000 }, { eleitos: 1000, candidaturas: 10000 }).resposta).toBe("Sem diferença clara.");
    expect(explicacao("Sem diferença clara.")).toMatch(/Não foi possível identificar uma diferença clara/);
  });
  it("diferença real, mas menor que 20%: 'diferença pequena'", () => {
    expect(responder(0.11, 0.1, 5)).toBe("Diferença pequena.");
    expect(explicacao("Diferença pequena.")).toMatch(/menor que 20%/);
    expect(explicacao("Sim.")).toBeNull();
  });
  it("sem teste possível, diz que faltam dados", () => {
    expect(responder(0.5, 0.1, null)).toBe("Sem dados suficientes.");
  });
});
