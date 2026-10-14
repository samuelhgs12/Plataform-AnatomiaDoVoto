import { describe, expect, it } from "vitest";
import { caminho, cortar, eixoPct, empilhar, escala, espalhar, yEm } from "../src/lib/grafico";

describe("escala e eixoPct", () => {
  it("converte domínio em pixels", () => {
    const x = escala(2018, 2024, 0, 600);
    expect(x(2018)).toBe(0);
    expect(x(2021)).toBe(300);
  });
  it("arredonda o teto e gera as marcas", () => {
    expect(eixoPct(0.074)).toEqual({ teto: 0.08, marcas: [0, 0.02, 0.04, 0.06, 0.08] });
    expect(eixoPct(0.21).teto).toBe(0.25);
    expect(eixoPct(0).marcas).toEqual([0, 0.02]);
  });
});

describe("espalhar", () => {
  it("afasta rótulos próximos mantendo a ordem original", () => {
    expect(espalhar([50, 52, 10], 12)).toEqual([50, 62, 10]);
  });
  it("respeita o limite de baixo empurrando para cima", () => {
    expect(espalhar([95, 98], 10, 0, 100)).toEqual([90, 100]);
  });
});

describe("empilhar", () => {
  it("põe na mesma linha o que não se sobrepõe", () => {
    expect(empilhar([{ x: 0, largura: 50 }, { x: 30, largura: 50 }, { x: 70, largura: 20 }, { x: 100, largura: 10 }])).toEqual([0, 1, 0, 0]);
  });
});

describe("yEm, cortar e caminho", () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 0 }];
  it("interpola dentro da linha e devolve null fora", () => {
    expect(yEm(pts, 5)).toBe(10);
    expect(yEm(pts, 10)).toBe(20);
    expect(yEm(pts, 30)).toBeNull();
  });
  it("divide a linha no ponto de corte", () => {
    expect(cortar(pts, 15)).toEqual([[{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 15, y: 10 }], [{ x: 15, y: 10 }, { x: 20, y: 0 }]]);
    expect(cortar(pts, -5)).toEqual([[], pts]);
    expect(cortar(pts, 25)).toEqual([pts, []]);
  });
  it("gera o atributo d", () => {
    expect(caminho(pts.slice(0, 2))).toBe("M0.0,0.0L10.0,20.0");
  });
});
