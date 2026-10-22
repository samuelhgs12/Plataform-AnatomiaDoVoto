import { describe, expect, it } from "vitest";
import { compararGrupos, responder, zContagem, zProporcoes } from "../src/lib/estatistica";

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
  it("com poucos casos, não afirma nada", () => {
    expect(compararGrupos({ eleitos: 3, candidaturas: 6 }, { eleitos: 1, candidaturas: 6 }).resposta).toBe("Não dá para afirmar.");
  });
  it("com muitos casos e diferença pequena, diz que quase não faz diferença", () => {
    expect(compararGrupos({ eleitos: 1010, candidaturas: 10000 }, { eleitos: 1000, candidaturas: 10000 }).resposta).toBe("Quase não faz diferença.");
    // significativa, mas menos de 20% maior
    expect(responder(0.11, 0.1, 5, 100000)).toBe("Quase não faz diferença.");
  });
  it("sem teste possível, não afirma", () => {
    expect(responder(0.5, 0.1, null, 0)).toBe("Não dá para afirmar.");
  });
});
