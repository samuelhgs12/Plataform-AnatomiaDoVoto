import { describe, expect, it } from "vitest";
import {
  cargoDaLista, montarDisputa, nomeProprio, puxadoPor, puxadores, quocienteEleitoral, rotuloPuxador,
  type DadosCadeiras, type LinhaCandidato, type LinhaLista,
} from "../src/lib/cadeiras";

const F = "Deputado federal";
const lista = (o: Partial<LinhaLista>): LinhaLista => ({
  ano: 2018, cargo: F, uf: "MG", id_lista: "A", tipo: "partido", lista: "A", votos_nominais: 0, votos_legenda: 0, eleitos_qp: 0, eleitos_media: 0, ...o,
});
let id = 0;
const c = (o: Partial<LinhaCandidato>): LinhaCandidato => ({
  ano: 2018, cargo: F, uf: "MG", id_lista: "A", partido: "A", id_candidato: ++id, id_candidatura: id, nome_urna: `C${id}`,
  ue: "MG", sequencial: `S${id}`, votos: 0, resultado: "qp", ...o,
});

// MG 2018, 10 vagas, 999 válidos → quociente eleitoral 100 (99,9: fração acima de meio sobe)
// coligação A/X (650 votos): 6 pelo quociente + 1 de sobra; o puxador é do A e dois dos puxados, do X
// B (250): 2 + 1; C (99): nenhuma. Em 2022, a mesma UF com outra eleição; RR sem resultado.
const dados: DadosCadeiras = {
  disputas: [
    { ano: 2018, cargo: F, uf: "MG", vagas: 10 }, { ano: 2022, cargo: F, uf: "MG", vagas: 2 }, { ano: 2018, cargo: F, uf: "RR", vagas: 8 },
  ],
  listas: [
    lista({ id_lista: "s1", tipo: "coligacao", lista: "A/X", votos_nominais: 600, votos_legenda: 50, eleitos_qp: 6, eleitos_media: 1 }),
    lista({ id_lista: "p2", lista: "B", votos_nominais: 240, votos_legenda: 10, eleitos_qp: 2, eleitos_media: 1 }),
    lista({ id_lista: "p3", lista: "C", votos_nominais: 99 }),
    lista({ ano: 2022, id_lista: "p1", lista: "A", votos_nominais: 200, eleitos_qp: 2 }),
    lista({ uf: "RR", id_lista: "p1", lista: "A", votos_nominais: 500 }),
  ],
  candidatos: [
    c({ id_lista: "s1", nome_urna: "PUXADOR", votos: 420 }), c({ id_lista: "s1", nome_urna: "A2", votos: 60 }),
    c({ id_lista: "s1", nome_urna: "A3", votos: 50 }), c({ id_lista: "s1", partido: "X", nome_urna: "X4", votos: 40 }),
    c({ id_lista: "s1", partido: "X", nome_urna: "X5", votos: 30 }), c({ id_lista: "s1", nome_urna: "A6", votos: 20 }),
    c({ id_lista: "s1", nome_urna: "A7", votos: 15, resultado: "media" }), c({ id_lista: "s1", nome_urna: "SUPA", votos: 14, resultado: "suplente" }),
    c({ id_lista: "p2", partido: "B", nome_urna: "B1", votos: 110 }), c({ id_lista: "p2", partido: "B", nome_urna: "B2", votos: 90 }),
    c({ id_lista: "p2", partido: "B", nome_urna: "B3", votos: 25, resultado: "media" }),
    c({ id_lista: "p2", partido: "B", nome_urna: "SUPB", votos: 80, resultado: "suplente" }),
    c({ ano: 2022, id_lista: "p1", nome_urna: "N1", votos: 150 }), c({ ano: 2022, id_lista: "p1", nome_urna: "N2", votos: 40 }),
  ],
};
const MG18 = { ano: 2018, cargo: F, uf: "MG" };

describe("quocienteEleitoral", () => {
  it("despreza a fração igual ou menor que meio e arredonda para cima a maior", () => {
    expect(quocienteEleitoral(1005, 10)).toBe(100);
    expect(quocienteEleitoral(1006, 10)).toBe(101);
    expect(quocienteEleitoral(999, 10)).toBe(100);
  });
  it("sem vagas não tem quociente", () => expect(quocienteEleitoral(100, 0)).toBe(0));
});

describe("cargoDaLista", () => {
  it("o cargo da visão de legenda vira o nome do cargo nas tabelas; com os dois, fica o federal", () => {
    expect(cargoDaLista("estadual")).toBe("Deputado estadual");
    expect(cargoDaLista("ambos")).toBe(F);
  });
});

describe("montarDisputa", () => {
  const d = montarDisputa(dados, MG18)!;
  it("soma os válidos das listas do ano e calcula o quociente eleitoral", () => {
    expect([d.vagas, d.validos, d.qe]).toEqual([10, 999, 100]);
  });
  it("separa as listas com cadeira, da que tem mais cadeiras para a que tem menos", () => {
    expect(d.listas.map((l) => [l.lista, l.tipo, l.qp, l.media, l.cadeiras])).toEqual([["A/X", "coligacao", 6, 1, 7], ["B", "partido", 2, 1, 3]]);
    expect(d.semCadeira.map((l) => l.lista)).toEqual(["C"]);
  });
  it("traz os eleitos do mais votado para o menos e o 1º suplente", () => {
    expect(d.listas[1].eleitos.map((e) => e.nome_urna)).toEqual(["B1", "B2", "B3"]);
    expect(d.listas[1].suplente?.nome_urna).toBe("SUPB");
  });
  it("cada ano é uma disputa", () => expect(montarDisputa(dados, { ...MG18, ano: 2022 })!.listas.map((l) => l.cadeiras)).toEqual([2]));
  it("marca a disputa sem resultado na base (nenhum eleito)", () => {
    expect(montarDisputa(dados, { ...MG18, uf: "RR" })!.semResultado).toBe(true);
    expect(d.semResultado).toBe(false);
  });
  it("devolve null quando a disputa não existe", () => expect(montarDisputa(dados, { ...MG18, uf: "AP" })).toBeNull());
});

describe("puxadores", () => {
  const d = montarDisputa(dados, MG18)!;
  it("acha quem teve votos para mais de uma cadeira e quem sentou nas cadeiras que esses votos pagaram, de qualquer partido da lista", () => {
    const [p, ...resto] = puxadores(d);
    expect(resto).toEqual([]);   // B1 passou do quociente, mas sem ele a lista perderia só a própria cadeira
    expect(p.nome_urna).toBe("PUXADOR");
    expect(p.quocientes).toBeCloseTo(4.2);
    // sem os 420 votos, a coligação teria 230: 2 cadeiras pelo quociente em vez de 6; uma era a dele, três foram para outros
    expect([p.cadeirasLista, p.semEle, p.paraOutros]).toEqual([6, 2, 3]);
    expect(p.sentaram.map((s) => [s.nome_urna, s.partido])).toEqual([["X4", "X"], ["X5", "X"], ["A6", "A"]]);
    expect(p.lista).toBe("A/X");
  });
  it("em outra disputa, outro puxador", () => {
    expect(puxadores(montarDisputa(dados, { ...MG18, ano: 2022 })!).map((p) => [p.nome_urna, p.paraOutros])).toEqual([["N1", 1]]);
  });
});

describe("puxadoPor", () => {
  it("diz, para cada puxado, quem o puxou", () => {
    const m = puxadoPor(puxadores(montarDisputa(dados, MG18)!));
    expect([...m.values()].map((p) => p.nome_urna)).toEqual(["PUXADOR", "PUXADOR", "PUXADOR"]);
    expect(m.size).toBe(3);
  });
});

describe("rotuloPuxador", () => {
  it("descreve o puxador e os puxados numa frase curta, para leitor de tela", () => {
    const [p] = puxadores(montarDisputa(dados, MG18)!);
    expect(rotuloPuxador(p)).toBe("Puxador (A), 420 votos, 4,2 quocientes, puxou 3: X4 (X), X5 (X) e A6 (A)");
  });
});

describe("nomeProprio", () => {
  it("tira o nome de urna da caixa alta, com as preposições em minúscula", () => {
    expect(nomeProprio("DR. VICTOR")).toBe("Dr. Victor");
    expect(nomeProprio("JOENIA DA SILVA E SOUZA")).toBe("Joenia da Silva e Souza");
    expect(nomeProprio("GENERAL  PAZUELLO")).toBe("General Pazuello");
  });
});
