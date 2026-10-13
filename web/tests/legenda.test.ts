import { describe, expect, it } from "vitest";
import {
  buscarPartido, compararCiclos, cortesTom, faixaEventos, filtrar, indicePartidos, lerParametros, proporcao, resumoCiclos,
  resumoSerie, serie, sugestoes, TODOS, type EventoPartido, type LinhaLegenda, type Linhagem,
} from "../src/lib/legenda";

const l = (o: Partial<LinhaLegenda>): LinhaLegenda => ({ ano: 2018, cargo: "Deputado federal", uf: "MG", numero: 13, partido: "PT", votos_nominais: 900, votos_legenda: 100, eleitos: 1, ...o });

// MG: eleições gerais de 2018 e 2022 (DEM e PSL viram UNIÃO), mais um vereador em 2020 e uma linha de PE
const linhas: LinhaLegenda[] = [
  l({}),
  l({ ano: 2022, votos_nominais: 800, votos_legenda: 200, eleitos: 2 }),
  l({ partido: "PSOL", numero: 50, votos_nominais: 800, votos_legenda: 200, eleitos: 1 }),
  l({ ano: 2022, partido: "PSOL", numero: 50, votos_nominais: 900, votos_legenda: 90, eleitos: 1 }),
  l({ partido: "DEM", numero: 25, votos_nominais: 400, votos_legenda: 100, eleitos: 0 }),
  l({ partido: "PSL", numero: 17, votos_nominais: 500, votos_legenda: 50, eleitos: 2 }),
  l({ ano: 2022, partido: "UNIÃO", numero: 44, votos_nominais: 600, votos_legenda: 150, eleitos: 3 }),
  l({ partido: "PCO", numero: 29, votos_nominais: 90, votos_legenda: 10, eleitos: 0 }),
  l({ ano: 2022, partido: "NOVATO", numero: 99, votos_nominais: 45, votos_legenda: 5, eleitos: 0 }),
  l({ ano: 2020, cargo: "Vereador", votos_nominais: 1000, votos_legenda: 50 }),
  l({ uf: "PE", votos_nominais: 300, votos_legenda: 100 }),
];
const linhagem: Linhagem[] = [{ partido: "DEM", atual: "UNIÃO", ano: 2022 }, { partido: "PSL", atual: "UNIÃO", ano: 2022 }];
const eventos: EventoPartido[] = [
  { ano: 2019, partido: "REPUBLICANOS", tipo: "renomeacao", rotulo: "ex-PRB" },
  { ano: 2022, partido: "UNIÃO", tipo: "fusao", rotulo: "DEM + PSL" },
  { ano: 2022, partido: "DEM", tipo: "extincao", rotulo: "→ UNIÃO" },
  { ano: 2023, partido: "PODEMOS", tipo: "incorporacao", rotulo: "+ PSC" },
];
const mg = filtrar(linhas, { uf: "MG" });

describe("proporcao", () => {
  it("é legenda ÷ (legenda + nominais) e 0 sem votos", () => {
    expect(proporcao(120, 400)).toBeCloseTo(0.2308, 4);
    expect(proporcao(0, 0)).toBe(0);
  });
});

describe("filtrar", () => {
  it("recorta pela UF", () => {
    expect(mg).toHaveLength(10);
    expect(filtrar(linhas)).toHaveLength(11);
  });
  it("só troca o partido absorvido pelo atual com juntar", () => {
    expect(filtrar(linhas, { juntar: false, linhagem }).some((x) => x.partido === "DEM")).toBe(true);
    const juntas = filtrar(linhas, { juntar: true, linhagem });
    expect(juntas.some((x) => x.partido === "DEM" || x.partido === "PSL")).toBe(false);
    expect(juntas.filter((x) => x.partido === "UNIÃO")).toHaveLength(3);
  });
});

describe("serie", () => {
  it("põe Todos primeiro e deixa buraco no ano sem votos do partido", () => {
    const [todos, pt] = serie(mg, ["PT"]);
    expect(todos.partido).toBe(TODOS);
    expect(todos.pontos.map((p) => p.ano)).toEqual([2018, 2020, 2022]);
    expect(todos.pontos[0].legenda).toBe(460);
    expect(pt.pontos[0]).toMatchObject({ ano: 2018, legenda: 100, nominais: 900, eleitos: 1, proporcao: 0.1 });
    expect(serie(mg, ["NOVATO"])[1].pontos.map((p) => p.ano)).toEqual([2022]);
  });
  it("DEM + PSL somam em UNIÃO só com juntar", () => {
    const separado = serie(filtrar(linhas, { uf: "MG", linhagem }), ["UNIÃO"])[1];
    expect(separado.pontos.map((p) => p.ano)).toEqual([2022]);
    const junto = serie(filtrar(linhas, { uf: "MG", juntar: true, linhagem }), ["UNIÃO"])[1];
    expect(junto.pontos.map((p) => p.ano)).toEqual([2018, 2022]);
    expect(junto.pontos[0]).toMatchObject({ legenda: 150, nominais: 900, eleitos: 2 });
  });
});

describe("cortesTom", () => {
  it("renomeação corta a linha mesmo sem juntar", () => {
    expect(cortesTom("REPUBLICANOS", eventos, false)).toEqual([2019]);
    expect(cortesTom("REPUBLICANOS", eventos, true)).toEqual([2019]);
  });
  it("fusão e incorporação só cortam com juntar; 2022 fica antes da eleição", () => {
    expect(cortesTom("UNIÃO", eventos, false)).toEqual([]);
    expect(cortesTom("UNIÃO", eventos, true)).toEqual([2021.55]);
    expect(cortesTom("PODEMOS", eventos, true)).toEqual([2023]);
  });
  it("extinção nunca corta", () => {
    expect(cortesTom("DEM", eventos, true)).toEqual([]);
  });
});

describe("faixaEventos", () => {
  it("devolve só os eventos dos partidos escolhidos, em ordem, com a posição no eixo", () => {
    const f = faixaEventos(["UNIÃO", "DEM", "REPUBLICANOS"], eventos);
    expect(f.map((e) => [e.partido, e.x])).toEqual([["REPUBLICANOS", 2019], ["UNIÃO", 2021.55], ["DEM", 2021.55]]);
  });
});

describe("indicePartidos e buscarPartido", () => {
  it("sem juntar, cada sigla aponta para si mesma", () => {
    const i = indicePartidos(linhas, false, linhagem);
    expect(i.find((e) => e.sigla === "DEM")).toEqual({ sigla: "DEM", numero: 25, partido: "DEM" });
    expect(buscarPartido(i, "25")).toEqual(["DEM"]);
  });
  it("com juntar, a sigla antiga aponta para o partido atual", () => {
    const i = indicePartidos(linhas, true, linhagem);
    expect(i.find((e) => e.sigla === "DEM")?.partido).toBe("UNIÃO");
    expect(buscarPartido(i, "dem")).toEqual(["UNIÃO"]);
    expect(buscarPartido(i, "uniao")).toEqual(["UNIÃO"]);
    expect(buscarPartido(i, "  ")).toEqual([]);
  });
});

describe("sugestoes", () => {
  it("sugere os partidos com mais legenda que ainda não foram escolhidos", () => {
    expect(sugestoes(mg, ["PT"], 2)).toEqual(["PSOL", "UNIÃO"]);
    expect(sugestoes(mg, [])).toHaveLength(5);
  });
});

describe("compararCiclos", () => {
  const geral = { ciclo: "geral", cargo: "ambos", ordem: "soma" } as const;
  it("compara as duas eleições mais recentes do ciclo", () => {
    const { anos, pares } = compararCiclos(mg, geral, linhagem);
    expect(anos).toEqual([2018, 2022]);
    const pt = pares.find((p) => p.partido === "PT")!;
    expect(pt).toMatchObject({ numero: 13, anterior: 0.1, recente: 0.2, eleitosRecente: 2, status: null });
    expect(pt.variacao).toBeCloseTo(0.1);
    expect(pt.fatia).toBeCloseTo(200 / 445);
  });
  it("explica quem falta em um dos anos", () => {
    const status = Object.fromEntries(compararCiclos(mg, geral, linhagem).pares.map((p) => [p.partido, p.status]));
    expect(status).toMatchObject({ DEM: "virou UNIÃO (2022)", PSL: "virou UNIÃO (2022)", UNIÃO: "não existia", NOVATO: "novo", PCO: "não disputou" });
  });
  it("com juntar, UNIÃO tem os dois anos", () => {
    const u = compararCiclos(filtrar(mg, { juntar: true, linhagem }), geral, linhagem).pares.find((p) => p.partido === "UNIÃO")!;
    expect(u.anterior).toBeCloseTo(150 / 1050);
    expect(u.status).toBeNull();
  });
  it("ordena pela soma, pelo ano recente e pelo crescimento", () => {
    const ordem = (o: "soma" | "recente" | "crescimento") => compararCiclos(mg, { ...geral, ordem: o }, linhagem).pares.map((p) => p.partido);
    expect(ordem("soma")).toEqual(["PT", "PSOL", "UNIÃO", "DEM", "PSL", "PCO", "NOVATO"]);
    expect(ordem("recente")).toEqual(["PT", "UNIÃO", "NOVATO", "PSOL", "DEM", "PSL", "PCO"]);
  });
  it("a ordenação por crescimento deixa por último quem não tem os dois anos", () => {
    const pares = compararCiclos(mg, { ...geral, ordem: "crescimento" }, linhagem).pares;
    expect(pares.map((p) => p.partido).slice(0, 2)).toEqual(["PT", "PSOL"]);
    expect(pares.slice(2).every((p) => p.variacao === null)).toBe(true);
  });
  it("filtra o cargo e devolve anos null se o ciclo tem uma eleição só", () => {
    expect(compararCiclos(mg, { ...geral, cargo: "estadual" }).anos).toBeNull();
    expect(compararCiclos(mg, { ...geral, ciclo: "municipal" })).toEqual({ anos: null, pares: [] });
  });
});

describe("resumos", () => {
  it("resumoSerie descreve o conjunto e o destaque entre os escolhidos", () => {
    const s = serie([l({}), l({ ano: 2022, votos_nominais: 800, votos_legenda: 200 }), l({ partido: "PL", votos_nominais: 950, votos_legenda: 50 }), l({ ano: 2022, partido: "PL", votos_nominais: 970, votos_legenda: 30 })], ["PT", "PL"]);
    expect(resumoSerie(s)).toBe("No conjunto dos partidos, a legenda passou de 7,5% dos votos em 2018 para 11,5% em 2022. Entre os escolhidos, PT teve a maior proporção em 2022: 20,0%, acima do conjunto.");
    expect(resumoSerie(serie([], []))).toBe("Sem votos para os filtros escolhidos.");
  });
  it("resumoCiclos conta altas e quedas", () => {
    const c = compararCiclos(mg, { ciclo: "geral", cargo: "ambos", ordem: "soma" }, linhagem);
    expect(resumoCiclos(c)).toBe("Entre 2018 e 2022, 1 partido aumentou a proporção de legenda e 1 diminuiu. Maior alta: PT (+10,0 p.p.). Maior queda: PSOL (−10,9 p.p.).");
    expect(resumoCiclos({ anos: null, pares: [] })).toBe("Não há duas eleições deste ciclo para comparar.");
  });
});

describe("lerParametros", () => {
  it("usa os padrões quando não há parâmetros", () => {
    expect(lerParametros({})).toEqual({ uf: undefined, juntar: false, p: ["PT", "PL", "NOVO"], ciclo: "geral", cargo: "ambos", ordem: "soma", todos: true });
  });
  it("corta p com 5 siglas para 3", () => {
    expect(lerParametros({ p: "PT,PL,NOVO,PSOL,MDB" }).p).toEqual(["PT", "PL", "NOVO"]);
    expect(lerParametros({ p: ["PSOL", "MDB", "PSOL", "PT", "PL"] }).p).toEqual(["PSOL", "MDB", "PT"]);
  });
  it("valida contra os dados e volta ao padrão quando o valor é inválido", () => {
    const opcoes = { ufs: ["MG", "PE"], partidos: ["PT", "PCdoB", "UNIÃO"] };
    expect(lerParametros({ uf: "mg", p: "pcdob,XYZ", juntar: "1", todos: "0" }, opcoes)).toMatchObject({ uf: "MG", p: ["PCdoB"], juntar: true, todos: false });
    expect(lerParametros({ uf: "SP", p: "XYZ", ciclo: "x", cargo: "vereador", ordem: "y", juntar: "talvez" }, opcoes))
      .toEqual({ uf: undefined, juntar: false, p: ["PT", "PL", "NOVO"], ciclo: "geral", cargo: "ambos", ordem: "soma", todos: true });
    expect(lerParametros({ ciclo: "municipal", cargo: "federal", ordem: "crescimento" })).toMatchObject({ ciclo: "municipal", cargo: "federal", ordem: "crescimento" });
  });
});
