import { describe, expect, it } from "vitest";
import {
  ALTURAS, alinhamentoEsta, blocoDinheiro, DIAMETRO_ADVERSARIO, empilhar, LARGURA_REF, LARGURA_REF_ESTREITA, pctInteiro, pctUmaCasa,
  reguaComparacao, rotulosTipicos, valorCurto,
  type CandidatoDisputa,
} from "../src/lib/dinheiro-perfil";
import type { LinhaMediana } from "../src/lib/financiamento";
import type { CarreiraItem, Receitas } from "../src/lib/types";

const sp = (s: string) => s.replace(/\s/g, " ");   // toLocaleString pode usar espaço não separável
const camp = (o: Partial<CarreiraItem>): CarreiraItem => ({
  id_candidatura: 1, ano: 2022, cargo: "Deputado federal", id_cargo: 6, nivel: 1, eh_titular: true, uf: "MG", municipio: null,
  partido: "PT", nome_urna: "X", numero_urna: "13", ue: "MG", sequencial: "1", tipo_eleicao: "ORDINARIA", resultado: "ELEITO",
  eleito: true, disputou: true, votos_1t: 0, ...o,
});
const rec = (o: Partial<Receitas>): Receitas => {
  const r = { id_candidatura: 1, fundo_eleitoral: 0, fundo_partidario: 0, doacoes_pessoas: 0, recursos_proprios: 0, outros_privados: 0,
    mediana_pct_publica_cargo: null, ...o };
  const publica = r.fundo_eleitoral + r.fundo_partidario, total = publica + r.doacoes_pessoas + r.recursos_proprios + r.outros_privados;
  return { publica, privada: total - publica, total, pct_publica: total ? publica / total : null, ...r };
};
/** Deputado federal em MG, 2022: R$ 2,03 mi, 80,7% público. */
const deputado = rec({ fundo_eleitoral: 1_574_000, fundo_partidario: 63_000, doacoes_pessoas: 300_000, recursos_proprios: 91_000 });
const med = (eleito: boolean, mediana_pct_publico: number | null, o: Partial<LinhaMediana> = {}): LinhaMediana => ({
  ano: 2022, cargo: "Deputado federal", uf: "MG", eleito, candidaturas: 100, mediana_total: 0, mediana_publico: 0, mediana_pct_publico, ...o });
const adv = (id: number, pct_publica: number | null, eleito = false, nome = `CANDIDATO ${id}`): CandidatoDisputa => ({ id_candidatura: id, nome_urna: nome, eleito, pct_publica });

describe("formatos", () => {
  it("valor curto dos cartões e percentuais", () => {
    expect([1_637_000, 12_400_000, 63_000, 6_300, 950, 9_996].map(valorCurto).map(sp))
      .toEqual(["R$ 1,6 mi", "R$ 12 mi", "R$ 63 mil", "R$ 6,3 mil", "R$ 950", "R$ 10 mil"]);
    expect([pctUmaCasa(0.807), pctUmaCasa(0.0003), pctUmaCasa(0), pctUmaCasa(1)]).toEqual(["80,7%", "menos de 0,1%", "0,0%", "100,0%"]);
    expect([pctInteiro(0.807), pctInteiro(0.004), pctInteiro(0), pctInteiro(0.9249)]).toEqual(["81%", "menos de 1%", "0%", "92%"]);
  });
});

describe("blocoDinheiro", () => {
  it("topo: parte pública inteira, total curto, cargo, UF e ano; presidente sem UF", () => {
    const b = blocoDinheiro(camp({}), deputado)!;
    expect([b.topo.pct, sp(b.topo.total), b.topo.rotulo, b.topo.eleito]).toEqual(["81%", "R$ 2 milhões", "recebidos · Deputado federal, MG, 2022", true]);
    expect(blocoDinheiro(camp({ cargo: "Presidente", uf: null, eleito: false }), deputado)!.topo.rotulo).toBe("recebidos · Presidente, 2022");
    expect(blocoDinheiro(camp({ cargo: "Presidente", uf: "BR" }), deputado)!.topo.rotulo).toBe("recebidos · Presidente, 2022");
  });
  it("cartões: total do grupo com uma casa; fontes com R$ 0 escondidas", () => {
    const [pub, priv] = blocoDinheiro(camp({}), deputado)!.cartoes;
    expect([pub.titulo, sp(pub.texto), pub.fontes.map((f) => [f.rotulo, sp(f.texto)])]).toEqual(["Público", "R$ 1,6 mi (80,7%)",
      [["Fundo Eleitoral", "R$ 1,6 mi (77,6%)"], ["Fundo Partidário", "R$ 63 mil (3,1%)"]]]);
    expect(priv.fontes.map((f) => f.rotulo)).toEqual(["Doações de pessoas", "Recursos próprios"]);     // outras fontes: R$ 0
  });
  it("a barrinha é a parte da fonte no TOTAL da campanha, não dentro do grupo", () => {
    const b = blocoDinheiro(camp({}), deputado)!;
    const total = 2_028_000;
    expect(b.cartoes[1].fontes[0].parte).toBeCloseTo(300_000 / total, 12);    // e não 300/391 do privado
    expect(b.cartoes.flatMap((k) => k.fontes).reduce((s, f) => s + f.parte, 0)).toBeCloseTo(1, 12);
  });
  it("grupo inteiro zero: 'R$ 0 (0%)', vazio, sem fontes", () => {
    const so = blocoDinheiro(camp({}), rec({ fundo_eleitoral: 1000 }))!;
    expect([so.topo.pct, so.cartoes[1].texto, so.cartoes[1].vazio, so.cartoes[1].fontes]).toEqual(["100%", "R$ 0 (0%)", true, []]);
    expect(so.descricao).toContain("Privado: R$ 0 (0%), nenhum recurso desta origem.");
  });
  it("campanha sem nenhuma receita: null", () => {
    expect(blocoDinheiro(camp({}), rec({}))).toBeNull();
  });
  it("aria-label dos cartões: grupos e fontes com valores e percentuais; a tabela traz as cinco fontes", () => {
    const b = blocoDinheiro(camp({}), deputado)!;
    expect(sp(b.descricao)).toBe("Dinheiro recebido pela campanha. Público: R$ 1,6 mi (80,7%); Fundo Eleitoral R$ 1,6 mi (77,6%), "
      + "Fundo Partidário R$ 63 mil (3,1%). Privado: R$ 391 mil (19,3%); Doações de pessoas R$ 300 mil (14,8%), Recursos próprios R$ 91 mil (4,5%).");
    expect(b.tabela.flatMap((g) => g.fontes.map((f) => f.rotulo))).toHaveLength(5);
  });
});

describe("régua, caso A (cargos proporcionais)", () => {
  const meds = [med(false, 0.45), med(true, 0.74), med(false, 0.2, { uf: null }), med(true, 0.3, { uf: "RJ" })];
  it("círculo vazado no não eleito típico e cheio no eleito típico, do mesmo cargo, ano e UF", () => {
    const r = reguaComparacao(camp({}), 0.807, meds, null);
    expect(r.rotulo).toBe("Comparada aos outros candidatos a deputado federal em Minas Gerais");
    expect(r.marcas.map((m) => [m.pos, m.cheio, m.rotulo])).toEqual([[0.45, false, "○ não eleito 45%"], [0.74, true, "● eleito 74%"]]);
    expect(r.esta).toEqual({ pos: 0.807, pct: "81%", rotulo: "esta campanha" });
  });
  const um = "Os círculos são a campanha típica de quem se elegeu e de quem não se elegeu.";
  const frases = (parte: number, ne: number, el: number) => reguaComparacao(camp({}), parte, [med(false, ne), med(true, el)], null).frases;
  it("as cinco frases, pelos percentuais inteiros da tela", () => {
    expect(frases(0.5, 0.5, 0.5)).toEqual([um, "Esta ficou igual às duas."]);
    expect(frases(0.7, 0.5, 0.504)).toEqual([um, "As duas tiveram a mesma parte de dinheiro público; esta usou mais."]);   // 50% e 50% na tela
    expect(frases(0.3, 0.5, 0.5)).toEqual([um, "As duas tiveram a mesma parte de dinheiro público; esta usou menos."]);
    expect(frases(0.2, 0.45, 0.74)).toEqual([um, "Esta usou menos dinheiro público que as duas."]);
    expect(frases(0.807, 0.45, 0.74)).toEqual([um, "Esta usou mais dinheiro público que as duas."]);
    expect(frases(0.6, 0.45, 0.74)).toEqual([um, "Esta ficou mais perto dos eleitos."]);
    expect(frases(0.5, 0.45, 0.74)).toEqual([um, "Esta ficou mais perto dos não eleitos."]);
    expect(frases(0.6, 0.4, 0.8)).toEqual([um]);                                            // a mesma distância: nenhuma
    expect(frases(0.744, 0.45, 0.74)).toEqual([um, "Esta ficou mais perto dos eleitos."]);  // 74% e 74% na tela: não "mais que as duas"
  });
  it("aria-label", () => {
    expect(reguaComparacao(camp({}), 0.807, meds, null).descricao).toBe("Parte de dinheiro público desta campanha, 81%, comparada ao não eleito "
      + "típico, 45%, e ao eleito típico, 74%, entre os candidatos a deputado federal em Minas Gerais em 2022.");
  });
  const rotulo = (pos: number) => rotulosTipicos([{ pos, cheio: true, nivel: 0, nivelEstreito: 0, rotulo: "● eleito 50%", titulo: "" }])[0];
  it("rótulo nas pontas: começa ou termina na borda do círculo; entre 15% e 85%, centrado", () => {
    expect(rotulo(0)).toEqual({ left: "calc(0% - 9px)", transform: "translateX(0%)", linha: 0 });
    expect(rotulo(0.14)).toEqual({ left: "calc(14% - 9px)", transform: "translateX(0%)", linha: 0 });
    expect(rotulo(0.5)).toEqual({ left: "50%", transform: "translateX(-50%)", linha: 0 });
    expect(rotulo(0.86)).toEqual({ left: "calc(86% + 9px)", transform: "translateX(-100%)", linha: 0 });
    expect(rotulo(1)).toEqual({ left: "calc(100% + 9px)", transform: "translateX(-100%)", linha: 0 });
    expect(rotulosTipicos([{ pos: 0.5, cheio: false, nivel: 0, nivelEstreito: 0, rotulo: null, titulo: "" }])).toEqual([null]);
  });
  it("típicos iguais: um marcador só e um rótulo só; o aria-label diz o mesmo", () => {
    const r = reguaComparacao(camp({}), 0.3, [med(false, 0.5), med(true, 0.503)], null);
    expect(r.marcas.map((m) => [m.ambos, m.rotulo])).toEqual([[true, "○● eleito e não eleito 50%"]]);
    expect(r.descricao).toBe("Parte de dinheiro público desta campanha, 30%, comparada ao eleito e ao não eleito típicos, ambos com 50%, "
      + "entre os candidatos a deputado federal em Minas Gerais em 2022.");
  });
  it("típicos próximos: os dois círculos no lugar e os rótulos em duas linhas (o do menor valor em cima)", () => {
    const r = reguaComparacao(camp({}), 0.2, [med(false, 0.55), med(true, 0.45)], null);
    expect(r.marcas.map((m) => m.pos)).toEqual([0.55, 0.45]);
    expect(rotulosTipicos(r.marcas).map((x) => x?.linha)).toEqual([1, 0]);                 // o não eleito (55%) desce
    expect(rotulosTipicos(r.marcas, LARGURA_REF * 10).map((x) => x?.linha)).toEqual([0, 0]); // numa régua bem larga, cabem lado a lado
    expect(rotulosTipicos(reguaComparacao(camp({}), 0.5, meds, null).marcas).map((x) => x?.linha)).toEqual([0, 0]);
  });
  it("Nikolas Ferreira, dep. federal MG 2022: 2%, típicos 83% (eleito) e 100% (não eleito)", () => {
    const r = reguaComparacao(camp({}), 0.02, [med(false, 1), med(true, 0.83)], null);
    expect(r.frases).toEqual([um, "Esta usou menos dinheiro público que as duas."]);
    const [ne, el] = rotulosTipicos(r.marcas);
    expect(ne).toEqual({ left: "calc(100% + 9px)", transform: "translateX(-100%)", linha: 1 });   // termina na borda do círculo
    expect(el).toEqual({ left: "83%", transform: "translateX(-50%)", linha: 0 });
  });
  it("Nikolas Ferreira, vereador MG 2020: 0%, típicos 0% e 0%", () => {
    const v = camp({ cargo: "Vereador", ano: 2020 });
    const r = reguaComparacao(v, 0, [med(false, 0, { cargo: "Vereador", ano: 2020 }), med(true, 0, { cargo: "Vereador", ano: 2020 })], null);
    expect(r.frases).toEqual([um, "Esta ficou igual às duas."]);
    expect(r.marcas.map((m) => [m.pos, m.ambos, m.rotulo])).toEqual([[0, true, "○● eleito e não eleito 0%"]]);
    expect(rotulosTipicos(r.marcas)).toEqual([{ left: "calc(0% - 9px)", transform: "translateX(0%)", linha: 0 }]);
  });
  it("o caso fica marcado: típicos, adversários ou sem referência", () => {
    expect(reguaComparacao(camp({}), 0.807, meds, null).caso).toBe("tipicos");
    expect(reguaComparacao(camp({}), 0.807, null, null).caso).toBe("sem");
    expect(reguaComparacao(camp({ cargo: "Governador" }), 0.807, null, [adv(2, 0.5)]).caso).toBe("adversarios");
  });
  it("sem mediana: só esta campanha, rótulo 'Parte de dinheiro público'", () => {
    for (const m of [null, [], [med(true, 0.7, { ano: 2018 })], [med(false, null), med(true, null)]]) {
      const r = reguaComparacao(camp({}), 0.807, m, null);
      expect([r.rotulo, r.marcas, r.frases, r.descricao]).toEqual(["Parte de dinheiro público", [], [], "Parte de dinheiro público desta campanha: 81%."]);
    }
  });
});

describe("régua, caso B (cargos de uma vaga)", () => {
  const gov = camp({ id_candidatura: 9, cargo: "Governador", uf: "RJ", ano: 2018, eleito: false });
  it("um círculo vazado por adversário com receita; a própria campanha fica fora; quem não declarou vira frase", () => {
    const r = reguaComparacao(gov, 0.823, null, [adv(9, 0.823), adv(1, 0.641, true), adv(2, 0.9), adv(3, null), adv(4, null)]);
    expect(r.rotulo).toBe("Comparada aos outros 4 candidatos a governador no Rio de Janeiro em 2018");
    expect(r.marcas.map((m) => [m.pos, m.cheio])).toEqual([[0.641, false], [0.9, false]]);
    expect(r.esta.rotulo).toBe("esta campanha · não eleita");
    expect(r.frases).toEqual(["Cada círculo é um adversário.", "O eleito usou menos dinheiro público que a maioria dos adversários.",
      "2 adversários não declararam receitas."]);
  });
  it("a frase de mais ou menos que a maioria só quando é verdade; com dois eleitos (senado), nenhuma", () => {
    const frase = (d: CandidatoDisputa[], c = gov, parte = 0.5) => reguaComparacao(c, parte, null, d).frases.slice(1);
    expect(frase([adv(1, 0.9, true), adv(2, 0.2), adv(3, 0.3)])).toEqual(["O eleito usou mais dinheiro público que a maioria dos adversários."]);
    expect(frase([adv(1, 0.4, true), adv(2, 0.2), adv(3, 0.9)], gov, 0.4)).toEqual([]);           // 1 acima, 1 abaixo, 1 igual: sem maioria
    expect(frase([adv(1, 0.5, true), adv(2, 0.5), adv(3, 0.5)])).toEqual([]);                    // empates não contam
    expect(frase([adv(2, 0.9), adv(3, 0.8)], { ...gov, eleito: true }, 0.1)).toEqual(["O eleito usou menos dinheiro público que a maioria dos adversários."]);
    const senado = camp({ id_candidatura: 9, cargo: "Senador", uf: "MG", ano: 2018, eleito: false });
    expect(frase([adv(1, 0.38, true), adv(2, 0.45, true), adv(3, 0.99)], senado, 0.99)).toEqual([]);
    expect(frase([adv(1, 0.9, true), adv(3, null)])).toEqual(["O eleito usou mais dinheiro público que a maioria dos adversários.",
      "1 adversário não declarou receitas."]);
  });
  it("regra das alturas: valores distantes ficam todos na primeira altura", () => {
    expect([ALTURAS, DIAMETRO_ADVERSARIO, LARGURA_REF, LARGURA_REF_ESTREITA]).toEqual([3, 16, 560, 340]);
    expect(empilhar([0.9, 0.1, 0.5, 0.3])).toEqual([0, 0, 0, 0]);
    expect(empilhar([0.5, 0.5 + 16 / 560])).toEqual([0, 0]);                       // exatamente um diâmetro: cabe
  });
  it("6 adversários entre 95% e 100% se distribuem nas 3 alturas, sem mudar a posição horizontal", () => {
    const pos = [1, 0.95, 0.97, 0.96, 0.99, 0.98];
    expect(empilhar(pos)).toEqual([2, 0, 2, 1, 1, 0]);                             // na ordem: 0,95 0,96 0,97 | 0,98 0,99 1
    const r = reguaComparacao(gov, 0.1, null, pos.map((p, i) => adv(i + 1, p)));
    expect(r.marcas.map((m) => m.pos)).toEqual(pos);
    expect(new Set(r.marcas.map((m) => m.nivel))).toEqual(new Set([0, 1, 2]));
    // no celular (340px) o diâmetro é uma fração maior da régua: 0,98 já não cabe ao lado do 0,95
    expect(r.marcas.map((m) => m.nivelEstreito)).toEqual(empilhar(pos, LARGURA_REF_ESTREITA));
    expect(empilhar([0.95, 0.98], LARGURA_REF_ESTREITA)).toEqual([0, 1]);
  });
  it("mais de 3 coincidentes reaproveitam a altura cujo último círculo está mais longe", () => {
    expect(empilhar([0.5, 0.5, 0.5, 0.5])).toEqual([0, 1, 2, 0]);
    expect(empilhar([0.4, 0.5, 0.5, 0.5, 0.5])).toEqual([0, 0, 1, 2, 0]);           // o 1º 0,5 cabe ao lado do 0,4; o último reaproveita a altura 0
    expect(empilhar([0.5, 0.5, 0.48, 0.5])).toEqual([1, 2, 0, 0]);                   // nenhuma livre: a altura do 0,48, o mais distante
  });
  it("prefeito: o município; um adversário só: 'ao outro candidato'", () => {
    const pref = camp({ id_candidatura: 9, cargo: "Prefeito", uf: "MG", ano: 2020, municipio: "BELO HORIZONTE", eleito: true });
    expect(reguaComparacao(pref, 0.6, null, [adv(1, 0.2)]).rotulo).toBe("Comparada ao outro candidato a prefeito em Belo Horizonte em 2020");
    expect(reguaComparacao({ ...pref, municipio: "RIO DE JANEIRO", uf: "RJ" }, 0.6, null, [adv(1, 0.2), adv(2, 0.3)]).rotulo)
      .toBe("Comparada aos outros 2 candidatos a prefeito no Rio de Janeiro em 2020");
  });
  it("nenhum adversário com receita: sem referência, mas diz quantos não declararam", () => {
    const r = reguaComparacao(gov, 0.823, null, [adv(9, 0.823), adv(3, null)]);
    expect([r.rotulo, r.marcas, r.frases]).toEqual(["Parte de dinheiro público", [], ["1 adversário não declarou receitas."]]);
    expect(reguaComparacao(gov, 0.823, null, null).rotulo).toBe("Parte de dinheiro público");
    expect(reguaComparacao(gov, 0.823, null, []).marcas).toEqual([]);
  });
  it("Lula 2022 (MotherDuck): 92% público, eleito, comparado aos outros 10 candidatos a presidente", () => {
    const lula = camp({ id_candidatura: 759956, cargo: "Presidente", id_cargo: 1, uf: null, ano: 2022, eleito: true });
    const disputa = [adv(759949, 0, false, "SOFIA MANZANO"), adv(759952, 0.976, false, "LÉO PÉRICLES"), adv(759955, 0, false, "FELIPE D AVILA"),
      adv(759956, 0.9249, true, "LULA"), adv(759958, 0.98, false, "VERA"), adv(759960, 0.967, false, "SIMONE TEBET"), adv(759963, 0.991, false, "CIRO GOMES"),
      adv(759964, 0.249, false, "JAIR BOLSONARO"), adv(759966, 0.998, false, "SORAYA THRONICKE"), adv(759970, 1, false, "CONSTITUINTE EYMAEL"),
      adv(759972, 0.997, false, "PADRE KELMON")];
    const r = reguaComparacao(lula, 0.9249, null, disputa);
    expect(r.rotulo).toBe("Comparada aos outros 10 candidatos a presidente em 2022");
    expect(r.esta).toEqual({ pos: 0.9249, pct: "92%", rotulo: "esta campanha · eleita" });
    expect(r.marcas).toHaveLength(10);
    expect(r.frases).toEqual(["Cada círculo é um adversário.", "O eleito usou menos dinheiro público que a maioria dos adversários."]);   // 7 de 10 acima
    expect(Math.max(...r.marcas.map((m) => m.nivel))).toBeLessThan(ALTURAS);
    expect(r.descricao).toMatch(/^Parte de dinheiro público desta campanha, 92%, eleita, comparada aos outros 10 candidatos a presidente em 2022: Constituinte Eymael, 100%; /);
    expect(r.descricao).toMatch(/Jair Bolsonaro, 25%; Sofia Manzano, 0%; [^;]+, 0%\.$/);
  });
});

describe("alinhamentoEsta", () => {
  it("centrado no traço; acima de 85%, alinhado à direita (de -70% a -100%); abaixo de 15%, à esquerda", () => {
    expect(alinhamentoEsta(0.5)).toEqual({ left: "50%", transform: "translateX(-50%)", textAlign: "center" });
    expect(alinhamentoEsta(0.85)).toEqual({ left: "85%", transform: "translateX(-50%)", textAlign: "center" });
    expect(alinhamentoEsta(0.9249).transform).toBe("translateX(-85%)");
    expect(alinhamentoEsta(0.9249).textAlign).toBe("right");
    expect(alinhamentoEsta(1)).toEqual({ left: "100%", transform: "translateX(-100%)", textAlign: "right" });
    expect(alinhamentoEsta(0.1)).toEqual({ left: "10%", transform: "translateX(0%)", textAlign: "left" });
    expect(alinhamentoEsta(0)).toEqual({ left: "0%", transform: "translateX(0%)", textAlign: "left" });
  });
});
