import { describe, expect, it } from "vitest";
import {
  correlacaoDe, daMedida, efeitoDoCargo, ehMajoritario, forcaCorrelacao, grupo, maiorGastador, respostaGasto, respostaMaior, sucessoPorGasto,
  type LinhaCorrelacao, type LinhaGastoFaixa, type LinhaMaiorGasto,
} from "../src/lib/gastos";
import { semPrestacao } from "../src/lib/financiamento";

const l = (o: Partial<LinhaGastoFaixa>): LinhaGastoFaixa => ({
  medida: "recursos", ano: 2022, cargo: "Deputado federal", uf: "MG", tinha_cargo: false, faixa: 1, candidaturas: 100, eleitos: 1, ...o,
});
const linhas = [
  l({ faixa: 0, eleitos: 0 }), l({}), l({ faixa: 2, eleitos: 2 }), l({ faixa: 3, eleitos: 4 }),
  l({ faixa: 4, eleitos: 10 }), l({ faixa: 4, tinha_cargo: true, candidaturas: 20, eleitos: 12 }),
  l({ faixa: 1, tinha_cargo: true, candidaturas: 5, eleitos: 0 }), l({ uf: "PE", faixa: 4, eleitos: 30 }),
  l({ cargo: "Governador", faixa: 4, candidaturas: 2, eleitos: 2 }),
];

describe("sucessoPorGasto", () => {
  it("soma os quatro grupos e junta as faixas 2 e 3 no meio", () => {
    const g = sucessoPorGasto(linhas, { ano: 2022, uf: "MG", cargo: "Deputado federal" });
    expect(g.map((x) => x.chave)).toEqual(["nada", "pouco", "medio", "muito"]);
    expect(grupo(g, "medio").candidaturas).toBe(200);
    expect(grupo(g, "medio").taxa).toBeCloseTo(0.03);
    expect(grupo(g, "muito").candidaturas).toBe(120);
    expect(grupo(g, "muito").taxa).toBeCloseTo(22 / 120);
  });
  it("deixa de fora quem não entregou a prestação final (faixa -1), que não é 'nada declarado'", () => {
    const f = { ano: 2022, uf: "MG", cargo: "Deputado federal" };
    const g = sucessoPorGasto([...linhas, l({ faixa: -1, candidaturas: 40, eleitos: 0 })], f);
    expect(g.reduce((a, x) => a + x.candidaturas, 0)).toBe(sucessoPorGasto(linhas, f).reduce((a, x) => a + x.candidaturas, 0));
    expect(semPrestacao([...linhas, l({ faixa: -1, candidaturas: 40 }), l({ faixa: -1, uf: "PE", candidaturas: 7 })], f)).toBe(40);
  });
  it("separa quem já tinha o cargo", () => {
    const f = { ano: 2022, uf: "MG", cargo: "Deputado federal" };
    expect(grupo(sucessoPorGasto(linhas, f, { tinhaCargo: true }), "muito").taxa).toBeCloseTo(0.6);
    expect(grupo(sucessoPorGasto(linhas, f, { tinhaCargo: false }), "muito").taxa).toBeCloseTo(0.1);
  });
  it("separa as medidas", () => {
    const comGasto = [...linhas, l({ medida: "gasto", faixa: 4, eleitos: 99 })];
    expect(daMedida(comGasto, "gasto")).toHaveLength(1);
    expect(daMedida(comGasto, "recursos")).toHaveLength(linhas.length);
  });
  it("limita aos cargos pedidos (visão 'todos os cargos' sem os majoritários)", () => {
    expect(grupo(sucessoPorGasto(linhas, { ano: 2022, uf: "MG" }), "muito").candidaturas).toBe(122);
    expect(grupo(sucessoPorGasto(linhas, { ano: 2022, uf: "MG" }, { cargos: ["Deputado federal"] }), "muito").candidaturas).toBe(120);
  });
});

describe("respostaGasto", () => {
  it("compara quem teve muitos recursos com quem teve poucos", () => {
    const r = respostaGasto(sucessoPorGasto(linhas, { ano: 2022, uf: "MG", cargo: "Deputado federal" }));
    expect(r.curta).toBe("Sim.");
    expect(r.base.chave).toBe("pouco");
    expect(r.vezes).toBeCloseTo((22 / 120) / (1 / 105));
  });
  it("usa 'nada declarado' quando não há ninguém no grupo 'pouco' e responde 'Não.' quando o topo perde", () => {
    const r = respostaGasto(sucessoPorGasto([l({ faixa: 0, eleitos: 50 }), l({ faixa: 4, eleitos: 5 })], {}));
    expect(r.base.chave).toBe("nada");
    expect(r.curta).toBe("Não.");
  });
  it("não responde sem dados e não afirma com poucos candidatos", () => {
    expect(respostaGasto(sucessoPorGasto([], {})).curta).toBeNull();
    const poucos = respostaGasto(sucessoPorGasto([l({ faixa: 1, candidaturas: 4, eleitos: 0 }), l({ faixa: 4, candidaturas: 4, eleitos: 1 })], {}));
    expect(poucos.curta).toBe("Sem diferença clara.");
  });
});

describe("maiorGastador e respostaMaior", () => {
  const m = (o: Partial<LinhaMaiorGasto>): LinhaMaiorGasto => ({ medida: "recursos", ano: 2024, cargo: "Prefeito", uf: "MG", disputas: 100, maior_venceu: 60, maior_tinha_cargo: 30, chance_sorteio: 35, var_sorteio: 22, ...o });
  it("soma as disputas e compara com o sorteio", () => {
    const r = maiorGastador([m({}), m({ uf: "PE", disputas: 50, maior_venceu: 30, chance_sorteio: 20, var_sorteio: 13 }), m({ cargo: "Vereador" })], { ano: 2024, cargo: "Prefeito" });
    expect(r.disputas).toBe(150);
    expect(r.pct).toBeCloseTo(0.6);
    expect(r.pctSorteio).toBeCloseTo(55 / 150);
    expect(r.variancia).toBe(35);
    expect(respostaMaior(r)).toBe("Sim.");
  });
  it("responde 'Não.', 'sem diferença clara' ou nada", () => {
    expect(respostaMaior(maiorGastador([m({ maior_venceu: 20, chance_sorteio: 50, var_sorteio: 25 })], {}))).toBe("Não.");
    expect(respostaMaior(maiorGastador([m({ maior_venceu: 50, chance_sorteio: 48, var_sorteio: 25 })], {}))).toBe("Sem diferença clara.");
    // 6 disputas, 0 vitórias contra ~1 esperada: pode ser acaso
    expect(respostaMaior(maiorGastador([m({ disputas: 6, maior_venceu: 0, chance_sorteio: 0.97, var_sorteio: 0.8 })], {}))).toBe("Sem diferença clara.");
    expect(respostaMaior(maiorGastador([], {}))).toBeNull();
  });
  it("reconhece os cargos majoritários", () => {
    expect(ehMajoritario("Prefeito")).toBe(true);
    expect(ehMajoritario("Vereador")).toBe(false);
    expect(ehMajoritario(undefined)).toBe(false);
  });
});

describe("efeitoDoCargo", () => {
  it("compara, entre os que tiveram mais recursos, quem já tinha o cargo e quem não tinha", () => {
    const r = efeitoDoCargo(linhas, { ano: 2022, uf: "MG" }, ["Deputado federal"]);
    expect(r.com.taxa).toBeCloseTo(0.6);
    expect(r.sem.taxa).toBeCloseTo(0.1);
    expect(r.quemTinha).toBe(25);
    expect(r.parteNoTopo).toBeCloseTo(0.8);
  });
});

describe("correlacaoDe e forcaCorrelacao", () => {
  const c = (o: Partial<LinhaCorrelacao>): LinhaCorrelacao => ({ medida: "recursos", ano: 2022, cargo: "Deputado federal", uf: null, n: 3000, correlacao: 0.75, ...o });
  it("usa a linha sem UF para 'todas as UFs'", () => {
    const linhasC = [c({}), c({ uf: "MG", correlacao: 0.6 })];
    expect(correlacaoDe(linhasC, 2022, "Deputado federal")?.correlacao).toBe(0.75);
    expect(correlacaoDe(linhasC, 2022, "Deputado federal", "MG")?.correlacao).toBe(0.6);
    expect(correlacaoDe(linhasC, 2022, "Vereador")).toBeUndefined();
  });
  it("descreve a força em palavras", () => {
    expect(forcaCorrelacao(0.05)).toBe("nenhuma relação");
    expect(forcaCorrelacao(0.46)).toBe("relação moderada");
    expect(forcaCorrelacao(0.75)).toBe("relação muito forte");
    expect(forcaCorrelacao(-0.4)).toBe("relação moderada, inversa");
  });
});
