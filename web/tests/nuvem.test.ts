import { describe, expect, it } from "vitest";
import { caixaDe, descricaoNuvem, montarNuvem, normalizarTermo, sobrepoe, tamanhoFonte, textoDetalhes, type TermoNuvem } from "../src/lib/nuvem";

const t = (o: Partial<TermoNuvem>): TermoNuvem => ({
  termo: "santinho", grupo: "propaganda_fisica", centavos: 10_000, despesas: 1, pela_categoria_centavos: 0,
  generico: false, explicacao: null, detalhes: [], ...o,
});
const varios = (n: number) => Array.from({ length: n }, (_, i) => t({ termo: `termo ${String(i).padStart(2, "0")}`, centavos: (n - i) * 1_000 }));

describe("tamanhoFonte", () => {
  it("raiz do valor entre o mínimo e o máximo", () => {
    expect(tamanhoFonte(100, 100)).toBe(48);
    expect(tamanhoFonte(25, 100)).toBe(31.5);           // raiz de 1/4 = metade do caminho
    expect(tamanhoFonte(0, 100)).toBe(15);
    expect(tamanhoFonte(10, 0)).toBe(15);
  });
});

describe("sobrepoe", () => {
  const a = { x: 0, y: 0, largura: 10, altura: 10 };
  it("encostar não é sobrepor; a folga afasta", () => {
    expect(sobrepoe(a, { ...a, x: 10 })).toBe(false);
    expect(sobrepoe(a, { ...a, x: 9 })).toBe(true);
    expect(sobrepoe(a, { ...a, x: 11 }, 2)).toBe(true);
    expect(sobrepoe(a, { ...a, x: 14 }, 2)).toBe(false);
  });
});

describe("montarNuvem", () => {
  it("o maior no centro, do maior para o menor, sem sobreposição", () => {
    const n = montarNuvem(varios(30));
    expect(n.palavras[0]).toMatchObject({ termo: "termo 00", x: 0, y: 0, tamanho: 48 });
    expect(n.palavras.map((p) => p.tamanho)).toEqual([...n.palavras.map((p) => p.tamanho)].sort((x, y) => y - x));
    for (let i = 0; i < n.palavras.length; i++)
      for (let j = i + 1; j < n.palavras.length; j++) expect(sobrepoe(n.palavras[i], n.palavras[j], 4)).toBe(false);
  });
  it("determinístico: mesma entrada, mesmo desenho, em qualquer ordem de chegada", () => {
    expect(montarNuvem(varios(12))).toEqual(montarNuvem([...varios(12)].reverse()));
  });
  it("limite: o resto fica só na tabela; termos sem valor nem entram", () => {
    const n = montarNuvem([...varios(8), t({ termo: "zero", centavos: 0 })], { limite: 5 });
    expect(n.palavras).toHaveLength(5);
    expect(n.fora).toBe(3);
    expect(n.todos.map((x) => x.termo)).not.toContain("zero");
  });
  it("partes exatas da propaganda e o valor que veio da categoria do TSE", () => {
    const n = montarNuvem([t({ centavos: 7_500 }), t({ termo: "impressos", centavos: 2_500, pela_categoria_centavos: 2_500 })]);
    expect(n.todos.map((x) => x.parte)).toEqual([0.75, 0.25]);
    expect([n.totalCentavos, n.pelaCategoriaCentavos, n.pelaCategoriaParte]).toEqual([10_000, 2_500, 0.25]);
  });
  it("a caixa contém todas as palavras", () => {
    const { palavras, caixa } = montarNuvem(varios(20));
    for (const p of palavras) {
      expect(p.x - p.largura / 2).toBeGreaterThanOrEqual(caixa.x);
      expect(p.x + p.largura / 2).toBeLessThanOrEqual(caixa.x + caixa.largura);
      expect(p.y - p.altura / 2).toBeGreaterThanOrEqual(caixa.y);
      expect(p.y + p.altura / 2).toBeLessThanOrEqual(caixa.y + caixa.altura);
    }
  });
  it("sem termos com valor: nuvem vazia", () => {
    expect(montarNuvem([]).palavras).toEqual([]);
  });
});

describe("normalizarTermo", () => {
  it("completa o que falta numa resposta de outra versão da API, sem quebrar a nuvem", () => {
    // formato encontrado num cache antigo do Next: sem despesas, generico, explicacao e detalhes
    const antigo = { termo: "santinho", grupo: "propaganda_fisica", centavos: 5_000, lancamentos: 3, parte: 0.5, ressalva: null } as Partial<TermoNuvem>;
    expect(normalizarTermo(antigo)).toEqual({ termo: "santinho", grupo: "propaganda_fisica", centavos: 5_000, despesas: 0,
      pela_categoria_centavos: 0, generico: false, explicacao: null, detalhes: [] });
    const n = montarNuvem([antigo, { termo: "bandeira", centavos: 2_500 }]);
    expect(n.palavras.map((p) => p.termo)).toEqual(["santinho", "bandeira"]);
    expect(textoDetalhes(n.todos[0])).toBe("");
  });
  it("descarta o que não tem nome ou valor; limpa detalhes inválidos", () => {
    expect(normalizarTermo(null)).toBeNull();
    expect(normalizarTermo({ centavos: 10 })).toBeNull();
    expect(normalizarTermo({ termo: "x", centavos: Number.NaN })).toBeNull();
    const d = normalizarTermo({ termo: "adesivo", centavos: 10, detalhes: [{ termo: "praguinha", centavos: 6 }, { termo: "?" } as never, null as never] });
    expect(d?.detalhes).toEqual([{ termo: "praguinha", centavos: 6 }]);
    expect(montarNuvem([null, undefined, { termo: "" , centavos: 5 }]).palavras).toEqual([]);
  });
});

describe("caixaDe", () => {
  it("tamanho mínimo, centrado nas palavras", () => {
    expect(caixaDe([{ x: 0, y: 0, largura: 100, altura: 40 }], 0)).toEqual({ x: -280, y: -100, largura: 560, altura: 200 });
  });
});

describe("textoDetalhes", () => {
  const d = (termo: string, centavos: number) => ({ termo, centavos });
  it("formatos da peça com a parte de cada um, os maiores primeiro", () => {
    const adesivo = t({ termo: "adesivo", centavos: 1_000, detalhes: [d("adesivo perfurado", 520), d("praguinha", 230), d("adesivo", 150), d("pragão", 95), d("bóton", 5)] });
    expect(textoDetalhes(adesivo)).toBe("adesivo perfurado 52%, praguinha 23%, adesivo 15% e mais 2");
    expect(textoDetalhes(adesivo, 5)).toBe("adesivo perfurado 52%, praguinha 23%, adesivo 15%, pragão 10% e bóton menos de 1%");
    expect(textoDetalhes(t({ termo: "santinho", centavos: 100, detalhes: [d("santinho", 70), d("colinha", 30)] }))).toBe("santinho 70% e colinha 30%");
  });
  it("nada a detalhar com um formato só (mesmo de outro nome) ou sem formatos", () => {
    expect(textoDetalhes(t({ termo: "bandeira", detalhes: [d("bandeira", 10_000)] }))).toBe("");
    expect(textoDetalhes(t({ termo: "anúncios", detalhes: [d("impulsionamento", 10_000)] }))).toBe("");
    expect(textoDetalhes(t({ detalhes: [] }))).toBe("");
  });
});

describe("descricaoNuvem", () => {
  it("lista os maiores valores para o leitor de tela", () => {
    const n = montarNuvem([t({ centavos: 150_000_00 }), t({ termo: "bandeira", centavos: 2_000_00 })]);
    // o formato de moeda usa espaço não separável
    expect(descricaoNuvem(n).replace(/\s/g, " ")).toBe("Nuvem de palavras do que a campanha comprou em propaganda, 2 termos. Maiores valores: santinho, R$ 150 mil; bandeira, R$ 2.000.");
    expect(descricaoNuvem(montarNuvem([]))).toMatch(/vazia/);
  });
});
