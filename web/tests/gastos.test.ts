import { describe, expect, it } from "vitest";
import {
  efeitoDoCargo, ehMajoritario, grupo, maiorGastador, respostaGasto, sucessoPorGasto, type LinhaGastoFaixa, type LinhaMaiorGasto,
} from "../src/lib/gastos";

const l = (o: Partial<LinhaGastoFaixa>): LinhaGastoFaixa => ({
  ano: 2022, cargo: "Deputado federal", uf: "MG", tinha_cargo: false, faixa: 1, candidaturas: 100, eleitos: 1, ...o,
});
const linhas = [
  l({ faixa: 0, eleitos: 0 }), l({}), l({ faixa: 2, eleitos: 2 }), l({ faixa: 3, eleitos: 4 }),
  l({ faixa: 4, eleitos: 10 }), l({ faixa: 4, tinha_cargo: true, candidaturas: 20, eleitos: 12 }),
  l({ faixa: 1, tinha_cargo: true, candidaturas: 5, eleitos: 0 }), l({ uf: "PE", faixa: 4, eleitos: 30 }),
];

describe("sucessoPorGasto", () => {
  it("soma os quatro grupos e junta as faixas 2 e 3 no meio", () => {
    const g = sucessoPorGasto(linhas, { ano: 2022, uf: "MG" });
    expect(g.map((x) => x.chave)).toEqual(["nada", "pouco", "medio", "muito"]);
    expect(grupo(g, "medio").candidaturas).toBe(200);
    expect(grupo(g, "medio").taxa).toBeCloseTo(0.03);
    expect(grupo(g, "muito").candidaturas).toBe(120);
    expect(grupo(g, "muito").taxa).toBeCloseTo(22 / 120);
  });
  it("separa quem já tinha o cargo", () => {
    expect(grupo(sucessoPorGasto(linhas, { ano: 2022, uf: "MG" }, true), "muito").taxa).toBeCloseTo(0.6);
    expect(grupo(sucessoPorGasto(linhas, { ano: 2022, uf: "MG" }, false), "muito").taxa).toBeCloseTo(0.1);
  });
});

describe("respostaGasto", () => {
  it("compara quem gastou muito com quem gastou pouco", () => {
    const r = respostaGasto(sucessoPorGasto(linhas, { ano: 2022, uf: "MG" }));
    expect(r.curta).toBe("Sim.");
    expect(r.base.chave).toBe("pouco");
    expect(r.vezes).toBeCloseTo((22 / 120) / (1 / 105));
  });
  it("usa 'não gastou' quando não há ninguém no grupo 'pouco' e responde 'Não.' quando o topo perde", () => {
    const r = respostaGasto(sucessoPorGasto([l({ faixa: 0, eleitos: 50 }), l({ faixa: 4, eleitos: 5 })], {}));
    expect(r.base.chave).toBe("nada");
    expect(r.curta).toBe("Não.");
  });
  it("não responde sem dados", () => {
    expect(respostaGasto(sucessoPorGasto([], {})).curta).toBeNull();
  });
});

describe("maiorGastador", () => {
  const m = (o: Partial<LinhaMaiorGasto>): LinhaMaiorGasto => ({ ano: 2024, cargo: "Prefeito", uf: "MG", disputas: 100, maior_venceu: 60, maior_tinha_cargo: 30, chance_sorteio: 35, ...o });
  it("soma as disputas e compara com o sorteio", () => {
    const r = maiorGastador([m({}), m({ uf: "PE", disputas: 50, maior_venceu: 30, chance_sorteio: 20 }), m({ cargo: "Vereador" })], { ano: 2024, cargo: "Prefeito" });
    expect(r.disputas).toBe(150);
    expect(r.pct).toBeCloseTo(0.6);
    expect(r.pctSorteio).toBeCloseTo(55 / 150);
    expect(maiorGastador([], {}).pct).toBe(0);
  });
  it("reconhece os cargos majoritários", () => {
    expect(ehMajoritario("Prefeito")).toBe(true);
    expect(ehMajoritario("Vereador")).toBe(false);
    expect(ehMajoritario(undefined)).toBe(false);
  });
});

describe("efeitoDoCargo", () => {
  it("compara, entre os que mais gastaram, quem já tinha o cargo e quem não tinha", () => {
    const r = efeitoDoCargo(linhas, { ano: 2022, uf: "MG" });
    expect(r.com.taxa).toBeCloseTo(0.6);
    expect(r.sem.taxa).toBeCloseTo(0.1);
    expect(r.quemTinha).toBe(25);
    expect(r.parteNoTopo).toBeCloseTo(0.8);
  });
});
