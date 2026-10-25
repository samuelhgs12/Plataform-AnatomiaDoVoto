import { describe, expect, it } from "vitest";
import {
  analisar, classeTermo, composicaoPorTipo, nomearPredominantes, parteTexto, reaisCentavos, resumoPropaganda, rotuloOrigem,
  type Categoria, type Propaganda, type Totais,
} from "../src/lib/propaganda";
import type { CarreiraItem } from "../src/lib/types";

const cand = (o: Partial<Totais>): Totais => ({ lancamentos: 5, total_centavos: 100_000, propaganda_centavos: 0, ...o });
const cat = (o: Partial<Categoria>): Categoria => ({ origem: "Publicidade por materiais impressos", grupo: "propaganda_fisica", lancamentos: 1, centavos: 10_000, ...o });

describe("analisar", () => {
  it("soma por categoria, total, denominadores e predominante", () => {
    const a = analisar(cand({ total_centavos: 200_000, propaganda_centavos: 50_000 }), [
      cat({ centavos: 30_000, lancamentos: 3 }), cat({ origem: "Despesa com Impulsionamento de Conteúdos", grupo: "propaganda_digital", centavos: 20_000 }),
    ]);
    if (a.estado !== "com_propaganda") throw new Error(a.estado);
    expect(a.propagandaCentavos).toBe(50_000);
    expect(a.parteDoTotal).toBe(0.25);                       // propaganda ÷ despesas consideradas
    expect(a.categorias.map((k) => k.parteDaPropaganda)).toEqual([0.6, 0.4]);
    expect(a.categorias.map((k) => k.parteDoTotal)).toEqual([0.15, 0.1]);
    expect(a.predominantes.map((k) => k.rotulo)).toEqual(["Materiais impressos"]);
    expect(a.grupos.map((g) => [g.grupo, g.centavos, g.de100])).toEqual([["propaganda_fisica", 30_000, 60], ["propaganda_digital", 20_000, 40]]);
  });
  it("arredondamento: 'de cada R$ 100' soma exatamente 100", () => {
    const a = analisar(cand({ total_centavos: 3 }), [cat({ centavos: 1 }), cat({ origem: "Publicidade por adesivos", centavos: 1 }), cat({ origem: "Publicidade por carros de som", centavos: 1 })]);
    if (a.estado !== "com_propaganda") throw new Error(a.estado);
    expect(a.categorias.reduce((s, k) => s + k.de100, 0)).toBe(100);
  });
  it("empate entre categorias: todas são predominantes, em ordem estável", () => {
    const a = analisar(cand({}), [cat({ origem: "Publicidade por carros de som", centavos: 5_000 }), cat({ origem: "Publicidade por adesivos", centavos: 5_000 }), cat({ centavos: 1_000 })]);
    if (a.estado !== "com_propaganda") throw new Error(a.estado);
    expect(a.predominantes.map((k) => k.rotulo)).toEqual(["Adesivos", "Carros de som"]);
    expect(nomearPredominantes(a.predominantes)).toBe("Adesivos e carros de som");
  });
  it("sem despesa nenhuma = sem dados (não é gasto zero)", () => {
    expect(analisar(cand({ lancamentos: 0, total_centavos: 0 }), [])).toEqual({ estado: "sem_dados" });
  });
  it("com despesas e sem propaganda; categorias de valor zero não contam", () => {
    expect(analisar(cand({ total_centavos: 80_000 }), [])).toEqual({ estado: "sem_propaganda", totalCentavos: 80_000, lancamentos: 5 });
    expect(analisar(cand({}), [cat({ centavos: 0 })]).estado).toBe("sem_propaganda");
  });
  it("categoria muito pequena continua aparecendo", () => {
    const a = analisar(cand({ total_centavos: 10_000_001 }), [cat({ centavos: 10_000_000 }), cat({ origem: "Publicidade por adesivos", centavos: 1 })]);
    if (a.estado !== "com_propaganda") throw new Error(a.estado);
    expect(a.categorias).toHaveLength(2);
    expect(a.categorias[1].de100).toBe(0);
    expect(parteTexto(a.categorias[1].parteDoTotal)).toBe("menos de 0,1%");
  });
});

describe("formatos", () => {
  it("reais com centavos, partes e nomes de categoria", () => {
    expect(reaisCentavos(123_456)).toBe("R$ 1.234,56".replace(" ", " "));
    expect(reaisCentavos(0)).toBe("R$ 0,00".replace(" ", " "));
    expect(parteTexto(0)).toBe("0,0%");
    expect(parteTexto(0.25)).toBe("25,0%");
    expect(rotuloOrigem("Despesa com Impulsionamento de Conteúdos")).toBe("Impulsionamento de conteúdo");
    expect(rotuloOrigem("Categoria nova do TSE")).toBe("Categoria nova do TSE");
    expect(nomearPredominantes([{ rotulo: "Adesivos" }, { rotulo: "Carros de som" }, { rotulo: "Programas de rádio, TV ou vídeo" }])).toBe("Adesivos, carros de som e programas de rádio, TV ou vídeo");
  });
});

describe("classeTermo", () => {
  it("cor do tipo de propaganda; neutra para a palavra genérica", () => {
    expect(classeTermo({ grupo: "propaganda_digital", generico: false })).toBe("pp-dig");
    expect(classeTermo({ grupo: "propaganda_fisica", generico: true })).toBe("pp-outra");
    expect(classeTermo({ grupo: "grupo_novo", generico: false })).toBe("pp-outra");
  });
});

describe("composicaoPorTipo", () => {
  const com = (ks: Categoria[]) => {
    const a = analisar(cand({ total_centavos: 1_000_000 }), ks);
    if (a.estado !== "com_propaganda") throw new Error(a.estado);
    return composicaoPorTipo(a);
  };
  const dig = (o: Partial<Categoria>) => cat({ origem: "Despesa com Impulsionamento de Conteúdos", grupo: "propaganda_digital", ...o });
  it("os três tipos, sempre na mesma ordem, com zero para o que não teve despesa", () => {
    const t = com([dig({ centavos: 30_000, lancamentos: 2 }), cat({ centavos: 10_000, lancamentos: 5 }), cat({ origem: "Publicidade por adesivos", centavos: 10_000, lancamentos: 1 })]);
    expect(t.map((x) => [x.grupo, x.centavos, x.lancamentos, x.categorias, x.de100])).toEqual([
      ["propaganda_fisica", 20_000, 6, 2, 40], ["propaganda_audiovisual", 0, 0, 0, 0], ["propaganda_digital", 30_000, 2, 1, 60],
    ]);
    expect(t.map((x) => x.parte)).toEqual([0.4, 0, 0.6]);
  });
  it("partes exatas somam 1 e 'de cada R$ 100' soma 100", () => {
    const t = com([cat({ centavos: 1 }), dig({ centavos: 1 }), cat({ origem: "Produção de jingles, vinhetas e slogans", grupo: "propaganda_audiovisual", centavos: 1 })]);
    expect(t.reduce((s, x) => s + x.de100, 0)).toBe(100);
    expect(t.reduce((s, x) => s + x.parte, 0)).toBeCloseTo(1, 12);
  });
  it("grupo fora dos três (classificação nova) vem depois, sem sumir", () => {
    expect(com([cat({ centavos: 5 }), cat({ origem: "Outra", grupo: "propaganda_nova", centavos: 5 })]).map((x) => x.grupo))
      .toEqual(["propaganda_fisica", "propaganda_audiovisual", "propaganda_digital", "propaganda_nova"]);
  });
});

describe("resumoPropaganda", () => {
  const campanha = (id: number, eleito: boolean) => ({ id_candidatura: id, ano: 2022, cargo: "Deputado Federal", eleito }) as CarreiraItem;
  const prop = (o: Partial<Propaganda>): Propaganda => ({ id_candidatura: 1, lancamentos: 3, total_centavos: 200_000, propaganda_centavos: 50_000, categorias: [], ...o });
  it("propaganda e parte das despesas de cada campanha, na ordem recebida", () => {
    expect(resumoPropaganda([{ c: campanha(2, true), p: prop({}) }, { c: campanha(1, false), p: prop({ propaganda_centavos: 0 }) }])).toEqual([
      { id: 2, ano: 2022, cargo: "Deputado Federal", eleito: true, propagandaCentavos: 50_000, parteDoTotal: 0.25 },
      { id: 1, ano: 2022, cargo: "Deputado Federal", eleito: false, propagandaCentavos: 0, parteDoTotal: 0 },
    ]);
  });
  it("sem resposta da API ou sem despesa registrada = sem dados (não é zero)", () => {
    const r = resumoPropaganda([{ c: campanha(1, false), p: null }, { c: campanha(2, false), p: prop({ lancamentos: 0, total_centavos: 0, propaganda_centavos: 0 }) }]);
    expect(r.map((x) => [x.propagandaCentavos, x.parteDoTotal])).toEqual([[null, null], [null, null]]);
  });
});
