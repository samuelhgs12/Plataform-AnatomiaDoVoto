import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ESCOPO, METODOLOGIA, PERGUNTAS, TAMBEM, escopoEmTexto, linkFonte, trechosDeAnos, type LinhaEscopo } from "../src/lib/metodologia";
import { VISOES } from "../src/lib/mapa";

const raiz = (caminho: string) => new URL(`../../${caminho}`, import.meta.url);
const todas = Object.values(METODOLOGIA);

/** A página que atende o caminho: app/<rota>/page.tsx, com ou sem segmento dinâmico. */
const temRota = (pathname: string) => existsSync(raiz(`web/src/app${pathname === "/" ? "" : pathname}/page.tsx`));

describe("METODOLOGIA", () => {
  it("cada entrada tem o id da própria chave e o texto essencial", () => {
    for (const [id, m] of Object.entries(METODOLOGIA)) {
      expect(m.id).toBe(id);
      for (const campo of [m.resposta, m.anos, m.cargos]) expect(campo.trim()).not.toBe("");
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

  it("o primeiro link de cada pergunta respondida leva à resposta", () => {
    for (const { id } of PERGUNTAS) if (id) expect(METODOLOGIA[id].ondeVer[0].rotulo).toMatch(/^Ver a resposta/);
  });
});

describe("PERGUNTAS", () => {
  it("são as dez do dossiê, em ordem", () => {
    expect(PERGUNTAS.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const p of PERGUNTAS) expect(p.texto).toMatch(/\?$/);
  });

  it("cada metodologia aparece uma vez na /sobre (a de dinheiro é só da página de dinheiro)", () => {
    const usadas = [...PERGUNTAS.flatMap((p) => (p.id ? [p.id] : [])), ...TAMBEM.map((t) => t.id)];
    expect(new Set(usadas).size).toBe(usadas.length);
    expect([...usadas, "dinheiro"].sort()).toEqual(Object.keys(METODOLOGIA).sort());
  });

  it("4, 6 e 7 ainda não têm resposta", () => {
    expect(PERGUNTAS.filter((p) => !p.id).map((p) => p.n)).toEqual([4, 6, 7]);
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

  it("escreve os anos em trechos; num Censo, cada ano comparado", () => {
    expect(escopoEmTexto(l({ anos: { 2018: "dado", 2020: "dado" } }))).toBe("2018–2020");
    expect(escopoEmTexto(l({ anos: { 2012: "censo", 2008: "censo", 2010: "censo" } }))).toBe("comparado com 2008, 2010 e 2012");
  });

  it("na matriz real: abstenção de 2008 a 2024, dinheiro de 2018 e cada Censo com os três anos dele", () => {
    const linha = (dado: string) => ESCOPO.find((e) => e.dado === dado)!;
    expect(escopoEmTexto(linha("Participação e abstenção"))).toBe("2008–2024");
    expect(escopoEmTexto(linha("Receitas e despesas"))).toBe("2018–2024");
    expect(escopoEmTexto(linha("Censo 2010"))).toBe("comparado com 2008, 2010 e 2012");
    expect(escopoEmTexto(linha("Censo 2022"))).toBe("comparado com 2020, 2022 e 2024");
    expect(escopoEmTexto(linha("Candidaturas e votação"))).toBe("1998–2024");
  });
});
