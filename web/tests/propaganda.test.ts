import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lerEstatico } from "../src/lib/data";
import type { TabelaEstatica } from "../src/lib/types";
import { carregarRecorte } from "../src/lib/propaganda-dados";
import {
  analisar, anosDoIndice, buscarCandidaturas, composicaoPorTipo, MINIMO_BUSCA, prepararBusca, candidaturasDe, cargosDoRecorte, conferirRecorte, lerIndice, lerRecorte, municipiosDoCargo,
  nomearPredominantes, parteTexto, reaisCentavos, recortesDoAno, rotuloCandidatura, rotuloOrigem,
  type Candidatura, type Categoria, type Recorte,
} from "../src/lib/propaganda";

const cand = (o: Partial<Candidatura>): Candidatura => ({
  id_candidatura: 1, sequencial: "100", cargo: "Vereador", cod_municipio: "06050", municipio: "MACAPÁ", nome_urna: "FULANA",
  numero_urna: "13123", partido: "PT", lancamentos: 5, total_centavos: 100_000, propaganda_centavos: 0, ...o,
});
const cat = (o: Partial<Categoria>): Categoria => ({ origem: "Publicidade por materiais impressos", grupo: "propaganda_fisica", lancamentos: 1, centavos: 10_000, ...o });
const tabela = (colunas: string[], linhas: TabelaEstatica["linhas"]): TabelaEstatica => ({ colunas, linhas });

/** Um arquivo de recorte no formato do export (pipeline/export_static.py, gravar_q9). */
const arquivo = {
  candidaturas: tabela(["id_candidatura", "sequencial", "cargo", "cod_municipio", "nome_urna", "numero_urna", "partido", "lancamentos", "total_centavos", "propaganda_centavos"], [
    [1, "100", "Vereador", "06050", "BETA", "13123", "PT", 4, 50_000, 30_000],
    [2, "101", "Vereador", "06050", "ALFA", "45678", "PSDB", 0, 0, 0],
    [3, "102", "Prefeito", "06050", "GAMA", "13", "PT", 2, 80_000, 0],
    [4, "103", "Vereador", "06017", "DELTA", null, null, 1, 9_000, 9_000],
  ]),
  municipios: tabela(["cod_municipio", "municipio"], [["06017", "AMAPÁ"], ["06050", "MACAPÁ"]]),
  categorias: tabela(["sequencial", "origem", "lancamentos", "centavos"], [["100", 0, 2, 20_000], ["100", 1, 1, 10_000], ["103", 2, 1, 9_000]]),
  origens: tabela(["origem", "grupo"], [["Publicidade por materiais impressos", "propaganda_fisica"], ["Despesa com Impulsionamento de Conteúdos", "propaganda_digital"], ["Publicidade por adesivos", "propaganda_fisica"]]),
};
const recorte = lerRecorte(arquivo) as Recorte;

describe("lerIndice / anosDoIndice / recortesDoAno", () => {
  const dados = {
    meta: tabela(["origem", "versao", "candidaturas", "categorias"], [["banco", 1, 3, 0]]),
    recortes: tabela(["ano", "uf", "arquivo", "candidaturas", "com_despesas", "com_propaganda", "total_centavos", "propaganda_centavos"], [
      [2022, "BR", "2022-BR", 1, 1, 1, 10, 5], [2022, "AP", "2022-AP", 1, 1, 0, 10, 0], [2024, "AP", "2024-AP", 1, 0, 0, 0, 0],
    ]),
  };
  it("lê a origem e os recortes; sem o arquivo, null", () => {
    expect(lerIndice(dados)?.origem).toBe("banco");
    expect(lerIndice({ ...dados, meta: tabela(["origem"], [["sintetico"]]) })?.origem).toBe("sintetico");
    expect(lerIndice(null)).toBeNull();
  });
  it("anos em ordem e o recorte nacional por último", () => {
    const ind = lerIndice(dados)!;
    expect(anosDoIndice(ind)).toEqual([2022, 2024]);
    expect(recortesDoAno(ind, 2022).map((r) => r.uf)).toEqual(["AP", "BR"]);
  });
});

describe("lerRecorte", () => {
  it("decodifica município e categoria original com o grupo", () => {
    expect(recorte.candidaturas.find((c) => c.sequencial === "103")?.municipio).toBe("AMAPÁ");
    expect(recorte.categorias.get("100")?.map((k) => [k.origem, k.grupo, k.centavos])).toEqual([
      ["Publicidade por materiais impressos", "propaganda_fisica", 20_000], ["Despesa com Impulsionamento de Conteúdos", "propaganda_digital", 10_000],
    ]);
  });
  it("arquivo ausente ou incompleto: null (dados indisponíveis)", () => {
    expect(lerRecorte(null)).toBeNull();
    expect(lerRecorte({ candidaturas: arquivo.candidaturas })).toBeNull();
  });
});

describe("cargosDoRecorte / municipiosDoCargo / candidaturasDe", () => {
  it("cargos na ordem do site e municípios só do cargo", () => {
    expect(cargosDoRecorte(recorte)).toEqual(["Prefeito", "Vereador"]);
    expect(municipiosDoCargo(recorte, "Vereador")).toEqual([["06017", "AMAPÁ"], ["06050", "MACAPÁ"]]);
    expect(municipiosDoCargo(recorte, "Prefeito")).toEqual([["06050", "MACAPÁ"]]);
  });
  it("filtra pela eleição escolhida (cargo e município) e ordena pelo nome", () => {
    expect(candidaturasDe(recorte, "Vereador", "06050").map((c) => c.sequencial)).toEqual(["101", "100"]);
    expect(candidaturasDe(recorte, "Vereador").map((c) => c.nome_urna)).toEqual(["ALFA", "BETA", "DELTA"]);
    expect(candidaturasDe(recorte, "Governador")).toEqual([]);
  });
  it("eleição geral: sem município", () => {
    const geral = lerRecorte({ ...arquivo, candidaturas: tabela(arquivo.candidaturas.colunas, [[9, "900", "Governador", null, "X", "40", "PSB", 1, 10, 0]]) })!;
    expect(municipiosDoCargo(geral, "Governador")).toEqual([]);
    expect(candidaturasDe(geral, "Governador")).toHaveLength(1);
  });
  it("rótulo da candidatura com partido e número, e sem eles", () => {
    expect(rotuloCandidatura(cand({ nome_urna: "FULANA", partido: "PT", numero_urna: "13123" }))).toBe("FULANA · PT 13123");
    expect(rotuloCandidatura(cand({ nome_urna: null, partido: null, numero_urna: null }))).toBe("Nome não informado");
  });
});

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

describe("buscarCandidaturas", () => {
  const cs = [
    cand({ sequencial: "1", nome_urna: "JOÃO DA SILVA", cargo: "Vereador", municipio: "MACAPÁ" }),
    cand({ sequencial: "2", nome_urna: "JOÃO DA SILVA", cargo: "Vereador", municipio: "AMAPÁ" }),   // homônimo
    cand({ sequencial: "3", nome_urna: "DR. SILVANA", cargo: "Prefeito", municipio: "MACAPÁ" }),
    cand({ sequencial: "4", nome_urna: "MARIA SILVA", cargo: "Vereador", municipio: "MACAPÁ" }),
    cand({ sequencial: "5", nome_urna: "SILVA", cargo: "Vereador", municipio: "OIAPOQUE" }),
    cand({ sequencial: "6", nome_urna: null, cargo: "Vereador" }),
  ];
  const ind = prepararBusca(cs);
  const sqs = (texto: string, cargo?: string) => buscarCandidaturas(ind, texto, cargo).itens.map((c) => c.sequencial);
  it("ignora acentos, maiúsculas e pontuação", () => {
    expect(sqs("joao")).toEqual(["2", "1"]);
    expect(sqs("JOÃO da silva")).toEqual(["2", "1"]);
    expect(sqs("dr silvan")).toEqual(["3"]);
  });
  it("cada palavra casa com o início de uma palavra do nome, em qualquer ordem", () => {
    expect(sqs("silva joao")).toEqual(["2", "1"]);
    expect(sqs("ilva")).toEqual([]);   // meio de palavra não conta
  });
  it("ordem: nome igual, palavras inteiras, início de palavra; homônimos pelo município", () => {
    // SILVA (igual) → JOÃO DA SILVA ×2 e MARIA SILVA (palavra inteira; homônimos pelo município) → DR. SILVANA (início)
    expect(sqs("silva")).toEqual(["5", "2", "1", "4", "3"]);
    expect(buscarCandidaturas(ind, "joao da silva").itens.map((c) => c.municipio)).toEqual(["AMAPÁ", "MACAPÁ"]);
  });
  it("restringe ao cargo e respeita o limite, contando o total", () => {
    expect(sqs("silva", "Prefeito")).toEqual(["3"]);
    const r = buscarCandidaturas(ind, "silva", undefined, 2);
    expect(r.itens).toHaveLength(2);
    expect(r.total).toBe(5);
  });
  it("menos letras que o mínimo: nada", () => {
    expect(MINIMO_BUSCA).toBe(3);
    expect(buscarCandidaturas(ind, "jo").total).toBe(0);
    expect(buscarCandidaturas(ind, "  ").total).toBe(0);
    expect(buscarCandidaturas(ind, "j o a").total).toBe(0);
  });
  it("nome ausente não quebra a busca", () => expect(prepararBusca([cand({ nome_urna: null })])[0].palavras).toEqual([]));
});

describe("carregarRecorte", () => {
  it("nome inválido: sem recorte, sem ler o disco", async () => {
    expect((await carregarRecorte("../q8")).recorte).toBeNull();
    expect((await carregarRecorte("2024-mg")).recorte).toBeNull();
  });
  it("arquivo inexistente: sem recorte", async () => expect((await carregarRecorte("1990-ZZ")).recorte).toBeNull());
});

describe("conferirRecorte", () => {
  it("recorte íntegro", () => expect(conferirRecorte(recorte)).toEqual([]));
  it("acusa categorias que não fecham, candidatura repetida e categoria órfã", () => {
    const ruim = lerRecorte({
      ...arquivo,
      candidaturas: tabela(arquivo.candidaturas.colunas, [...arquivo.candidaturas.linhas, [5, "100", "Vereador", "06050", "DUP", null, null, 1, 1, 0]]),
      categorias: tabela(arquivo.categorias.colunas, [...arquivo.categorias.linhas, ["999", 0, 1, 5], ["103", 0, 1, 1]]),
    })!;
    const p = conferirRecorte(ruim);
    expect(p.some((x) => x.startsWith("candidatura repetida"))).toBe(true);
    expect(p.some((x) => x.startsWith("categorias sem candidatura"))).toBe(true);
    expect(p.some((x) => x.startsWith("categorias de 103"))).toBe(true);
  });
});

describe("lerEstatico (pergunta 9)", () => {
  it("só aceita os nomes que o export gera", async () => {
    expect(await lerEstatico("q9/../q8")).toBeNull();
    expect(await lerEstatico("q9/2024-mg")).toBeNull();
  });
});

// Os arquivos gerados (reais ou de exemplo), se existirem: índice e recortes batem, e cada recorte é íntegro.
const PASTA = path.join(process.cwd(), "public", "data", "q9");   // vitest roda a partir de web/, como o lerEstatico
const TEM_DADOS = existsSync(path.join(PASTA, "indice.json"));
const ler = (n: string) => JSON.parse(readFileSync(path.join(PASTA, `${n}.json`), "utf-8"));
describe.skipIf(!TEM_DADOS)("integridade de public/data/q9", () => {
  const ind = TEM_DADOS ? lerIndice(ler("indice"))! : { origem: "sintetico" as const, recortes: [] };
  it("cada recorte do índice tem arquivo, e nenhum arquivo sobra", () => {
    expect(readdirSync(PASTA).filter((f) => f !== "indice.json").sort()).toEqual(ind.recortes.map((r) => `${r.arquivo}.json`).sort());
  });
  it("o cache devolve o mesmo recorte na segunda leitura", async () => {
    const menor = [...ind.recortes].sort((a, b) => a.candidaturas - b.candidaturas)[0];
    const a = await carregarRecorte(menor.arquivo);
    expect(a.recorte?.candidaturas).toHaveLength(menor.candidaturas);
    expect(await carregarRecorte(menor.arquivo)).toBe(a);
    expect(a.problemas).toEqual([]);
  });
  it.each(ind.recortes.map((r) => [r.arquivo, r] as const))("%s: íntegro e com os totais do índice", (nome, r) => {
    const rec = lerRecorte(ler(nome))!;
    expect(conferirRecorte(rec)).toEqual([]);
    expect(rec.candidaturas).toHaveLength(r.candidaturas);
    expect(rec.candidaturas.reduce((s, c) => s + c.propaganda_centavos, 0)).toBe(r.propaganda_centavos);
    expect(rec.candidaturas.reduce((s, c) => s + c.total_centavos, 0)).toBe(r.total_centavos);
  });
});
