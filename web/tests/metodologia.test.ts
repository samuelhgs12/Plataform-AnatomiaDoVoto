import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ESCOPO, METODOLOGIA, ORDEM_SOBRE, escopoEmTexto, formulasDa, linkFonte, marca, trechosDeAnos, type LinhaEscopo } from "../src/lib/metodologia";
import { VISOES } from "../src/lib/mapa";

const raiz = (caminho: string) => new URL(`../../${caminho}`, import.meta.url);
const todas = Object.values(METODOLOGIA);

/** A página que atende o caminho: app/<rota>/page.tsx, com ou sem segmento dinâmico. */
const temRota = (pathname: string) => existsSync(raiz(`web/src/app${pathname === "/" ? "" : pathname}/page.tsx`));

describe("METODOLOGIA", () => {
  it("cada entrada tem o id da própria chave e o texto essencial", () => {
    for (const [id, m] of Object.entries(METODOLOGIA)) {
      expect(m.id).toBe(id);
      for (const campo of [m.numero, m.pergunta, m.resposta, m.anos, m.cargos]) expect(campo.trim()).not.toBe("");
      expect(m.calculo.length).toBeGreaterThan(0);
      expect(m.limites.length).toBeGreaterThan(0);
    }
  });

  it("todo link leva a uma rota que existe, e a visão do mapa é uma das que o mapa conhece", () => {
    for (const { href } of todas.flatMap((m) => m.ondeVer)) {
      const url = new URL(href, "http://x");
      expect(temRota(url.pathname), href).toBe(true);
      const ver = url.searchParams.get("ver");
      if (ver) expect(VISOES as readonly string[]).toContain(ver);
    }
  });

  it("todo sql aponta para um arquivo do repositório, em api/app/analises, api/app/queries ou pipeline/sql", () => {
    for (const caminho of todas.flatMap((m) => m.sql)) {
      expect(caminho).toMatch(/^(api\/app\/(analises|queries)|pipeline\/sql)\/[\w-]+\.sql$/);
      expect(existsSync(raiz(caminho)), caminho).toBe(true);
    }
  });

  it("toda análise de api/app/analises usada pelas páginas aparece em alguma metodologia", () => {
    const citadas = new Set(todas.flatMap((m) => m.sql));
    for (const q of ["q1", "q2", "q5", "q8", "q9", "q10", "municipios"]) expect(citadas).toContain(`api/app/analises/${q}.sql`);
  });

  it("as partes existem e a ordem da /sobre não repete nem esconde uma parte como seção", () => {
    const partes = todas.flatMap((m) => m.partes ?? []);
    for (const p of partes) expect(METODOLOGIA[p]).toBeDefined();
    expect(new Set(ORDEM_SOBRE).size).toBe(ORDEM_SOBRE.length);
    expect(ORDEM_SOBRE.filter((id) => partes.includes(id))).toEqual([]);
    expect([...ORDEM_SOBRE, ...partes].sort()).toEqual(Object.keys(METODOLOGIA).sort());
  });
});

describe("marca", () => {
  it("separa o rótulo do número e o que não é pergunta numerada", () => {
    expect(marca("Pergunta 5")).toEqual({ rotulo: "Pergunta", valor: "5", nota: null });
    expect(marca("Perguntas 1, 2 e 8")).toEqual({ rotulo: "Perguntas", valor: "1, 2 e 8", nota: null });
    expect(marca("Mapa · ligado à pergunta 3")).toEqual({ rotulo: "Mapa", valor: null, nota: "ligado à pergunta 3" });
  });
});

describe("formulasDa", () => {
  it("usa a fórmula da própria seção e, na de dinheiro, a das partes", () => {
    expect(formulasDa(METODOLOGIA.p5).map((f) => f.resultado)).toEqual(["proporção de legenda"]);
    expect(formulasDa(METODOLOGIA.dinheiro).map((f) => f.resultado)).toEqual(["custo da cadeira"]);
    expect(formulasDa(METODOLOGIA.p10)).toEqual([]);
  });
});

describe("linkFonte", () => {
  it("aponta para o arquivo no ramo principal do GitHub", () => {
    expect(linkFonte("api/app/analises/q1.sql")).toBe("https://github.com/samuelhgs12/Plataform-AnatomiaDoVoto/blob/main/api/app/analises/q1.sql");
  });
});

describe("trechosDeAnos", () => {
  it("junta anos seguidos de dois em dois e separa os buracos", () => {
    expect(trechosDeAnos([2018, 2020, 2022, 2024])).toBe("2018–2024");
    expect(trechosDeAnos([2012, 2008])).toBe("2008 e 2012");
    expect(trechosDeAnos([2008, 2010, 2014, 2018, 2020])).toBe("2008–2010, 2014 e 2018–2020");
    expect(trechosDeAnos([])).toBe("");
  });
});

describe("escopoEmTexto", () => {
  const l = (o: Partial<LinhaEscopo>): LinhaEscopo => ({ dado: "x", nota: "", anos: {}, ...o });

  it("escreve os anos e diz quais vêm de fora do banco", () => {
    expect(escopoEmTexto(l({ anos: { 2018: "banco", 2020: "banco" } }))).toBe("2018–2020");
    expect(escopoEmTexto(l({ anos: { 2008: "externo", 2010: "externo", 2012: "banco" } }))).toBe("2008–2012 (2008–2010 dos dados abertos do TSE)");
  });

  it("na matriz real, dinheiro começa em 2018 e o Censo só encosta em 2008 e 2012", () => {
    const linha = (dado: string) => ESCOPO.find((e) => e.dado === dado)!;
    expect(escopoEmTexto(linha("Receitas e despesas"))).toBe("2018–2024");
    expect(escopoEmTexto(linha("Indicadores do Censo 2010"))).toBe("2008 e 2012");
    expect(escopoEmTexto(linha("Candidaturas e votação"))).toBe("1998–2024");
  });
});
