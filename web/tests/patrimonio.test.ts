import { describe, expect, it } from "vitest";
import {
  anosDoTipo, classificar, composicaoEleitos, concordancia, concordanciaDeCandidatos, corDaMetade, corDaParteCidades, disputaDeCandidatos, escada,
  escadaDeCandidatos, escadaDeVotos, escalaLista, eixoSerie, fraseSerie, afastarRotulos, escadaPosicoes, frasePosicao, fraseTopo, juntarPatrimonio, legendaMetade,
  legendaPrefeito, listaDe, listaDeCandidatos, listaDoRecorte, marcasLog, medianaPonderada, medianasDeCandidatos, medianasDoRecorte, metadeDaCidade,
  metadeMaisRica, naEscalaLog, posicaoDoEleito, quemTinha, recorteDaDisputa, serieDisputa, serieMaisRico, serieMetade, serieMetadeCidade,
  taxaDoTopo, textoPosicao, topoDaComposicao, tituloP2, valorTipico, vitoriaDoMaisRico, cardDoTopo, cardOutraVariante, vezesPatrimonio, rotuloRespostaP2, type GrupoComposicao,
  type CandidatoP2, type LinhaDecil, type LinhaDisputa, type LinhaLista, type LinhaMedianas, type LinhaPares, type LinhaPosicao, type LinhaVereadorCidade,
} from "../src/lib/patrimonio";

const dec = (o: Partial<LinhaDecil>): LinhaDecil => ({ ano: 2024, cargo: "Vereador", uf: "PE", tinha_cargo: false, decil: 1, candidatos: 10, eleitos: 1, mediana: 10_000, ...o });
const disp = (o: Partial<LinhaDisputa>): LinhaDisputa => ({
  ano: 2024, cargo: "Prefeito", uf: "PE", id_municipio: 1, candidatos: 4, com_bens: 4, vagas: 1, pos_eleito: 1, eleito_sem_bens: false, eleito_tinha: false, reeleicao: false, no_topo: 1, ...o,
});
const cand = (o: Partial<CandidatoP2>): CandidatoP2 => ({ id_candidatura: 1, id_candidato: 1, nome_urna: "A", partido: "PX", votos: 100, eleito: false, patrimonio: 0, tinha_cargo: false, ...o });
const ver = (o: Partial<LinhaVereadorCidade>): LinhaVereadorCidade => ({ ano: 2024, uf: "PE", id_municipio: 1, tinha_cargo: false, candidatos: 50, com_bens: 30, eleitos: 8, eleitos_com_bens: 6, eleitos_rica: 4, ...o });

describe("anosDoTipo", () => {
  it("separa municipais e gerais", () => {
    expect(anosDoTipo("Vereador")).toEqual([2008, 2012, 2016, 2020, 2024]);
    expect(anosDoTipo("Governador")).toEqual([2006, 2010, 2014, 2018, 2022]);
  });
});

describe("medianaPonderada", () => {
  it("pega o valor que cobre metade do peso e ignora nulos", () => {
    expect(medianaPonderada([{ valor: 10, peso: 1 }, { valor: 20, peso: 5 }, { valor: null, peso: 9 }])).toBe(20);
    expect(medianaPonderada([])).toBeNull();
  });
});

describe("escada", () => {
  const linhas = [dec({ decil: 0, candidatos: 40, eleitos: 2, mediana: 0 }), dec({ decil: 10, candidatos: 10, eleitos: 5, mediana: 500_000 }), dec({ decil: 10, tinha_cargo: true, candidatos: 5, eleitos: 5, mediana: 900_000 }), dec({ uf: "RJ", decil: 10 })];
  it("soma os estados e quem tinha o cargo, sem bens primeiro", () => {
    const d = escada(linhas, { anos: [2024], cargo: "Vereador", uf: "PE" });
    expect(d.map((x) => x.chave)).toEqual([0, 10]);
    expect(d[1]).toMatchObject({ candidatos: 15, eleitos: 10, taxa: 10 / 15, tipico: 500_000 });
  });
  it("sem cargo tira quem já tinha o cargo; sem UF junta os seis", () => {
    expect(escada(linhas, { anos: [2024], cargo: "Vereador", uf: "PE" }, { semCargo: true })[1]).toMatchObject({ candidatos: 10, eleitos: 5 });
    expect(escada(linhas, { anos: [2024], cargo: "Vereador" })[1].candidatos).toBe(25);
  });
});

describe("escadaPosicoes", () => {
  const p = (o: Partial<LinhaPosicao>): LinhaPosicao => ({ ano: 2024, cargo: "Prefeito", uf: "PE", reeleicao: false, posicao: 1, candidatos: 10, eleitos: 5, mediana: 1e6, ...o });
  it("ordena do sem bens ao mais rico e tira disputas com reeleição", () => {
    const linhas = [p({ posicao: 1 }), p({ posicao: 4, eleitos: 1 }), p({ posicao: 1, reeleicao: true })];
    expect(escadaPosicoes(linhas, { anos: [2024], cargo: "Prefeito" }).map((x) => x.chave)).toEqual([4, 1]);
    expect(escadaPosicoes(linhas, { anos: [2024], cargo: "Prefeito" }, { semCargo: true }).find((x) => x.chave === 1)!.candidatos).toBe(10);
  });
});

describe("taxaDoTopo", () => {
  it("é o 10º décimo ou, nos majoritários, o mais rico", () => {
    const d = escada([dec({ decil: 1, eleitos: 1 }), dec({ decil: 10, eleitos: 3 })], { anos: [2024], cargo: "Vereador" });
    expect(taxaDoTopo(d, { majoritario: false })).toBe(0.3);
    expect(taxaDoTopo(d, { majoritario: true })).toBe(0.1);
  });
});

describe("metadeMaisRica", () => {
  it("conta só eleitos que declararam bens no denominador", () => {
    const d = escada([dec({ decil: 0, eleitos: 4 }), dec({ decil: 3, eleitos: 1 }), dec({ decil: 6, eleitos: 2 }), dec({ decil: 10, eleitos: 1 })], { anos: [2024], cargo: "Vereador" });
    expect(metadeMaisRica(d)).toMatchObject({ eleitos: 8, comBens: 4, rica: 3, semBens: 4, parte: 0.75 });
  });
});

describe("metadeDaCidade", () => {
  it("soma com e sem quem já era vereador e devolve null sem a cidade", () => {
    const l = [ver({}), ver({ tinha_cargo: true, eleitos: 4, eleitos_com_bens: 4, eleitos_rica: 4, candidatos: 5 })];
    expect(metadeDaCidade(l, 2024, 1)).toMatchObject({ eleitos: 12, comBens: 10, rica: 8, parte: 0.8, candidatos: 55 });
    expect(metadeDaCidade(l, 2024, 1, { semCargo: true })!.parte).toBeCloseTo(4 / 6);
    expect(metadeDaCidade(l, 2020, 1)).toBeNull();
  });
});

describe("posicaoDoEleito", () => {
  it("classifica o eleito e os motivos de ficar fora", () => {
    expect(posicaoDoEleito(disp({})).categoria).toBe("primeiro");
    expect(posicaoDoEleito(disp({ pos_eleito: 2 })).categoria).toBe("segundo");
    expect(posicaoDoEleito(disp({ pos_eleito: 3 })).categoria).toBe("abaixo");
    expect(posicaoDoEleito(disp({ eleito_sem_bens: true, pos_eleito: 4 })).categoria).toBe("sem_bens");
    expect(posicaoDoEleito(disp({ candidatos: 1 }))).toMatchObject({ categoria: "fora", motivo: "um_candidato" });
    expect(posicaoDoEleito(disp({ pos_eleito: null, vagas: 0 })).motivo).toBe("sem_eleito");
    expect(posicaoDoEleito(disp({ com_bens: 0 })).motivo).toBe("ninguem_declarou");
    expect(posicaoDoEleito(disp({ reeleicao: true }), { semCargo: true }).motivo).toBe("reeleicao");
    expect(posicaoDoEleito(disp({ reeleicao: true })).categoria).toBe("primeiro");
  });
});

describe("vitoriaDoMaisRico", () => {
  it("conta entre as comparáveis (eleito sem bens entra: o mais rico perdeu)", () => {
    const v = vitoriaDoMaisRico([disp({}), disp({ pos_eleito: 2, eleito_tinha: true }), disp({ eleito_sem_bens: true }), disp({ candidatos: 1 })], { anos: [2024], cargo: "Prefeito" });
    expect(v).toMatchObject({ comparaveis: 3, venceu: 1, eleitoTinha: 1 });
    expect(v.parte).toBeCloseTo(1 / 3);
    expect(v.fora.um_candidato).toBe(1);
  });
});

describe("juntarPatrimonio e classificar", () => {
  const cs = juntarPatrimonio(
    [1, 2, 3, 4, 5].map((i) => ({ id_candidatura: i, id_candidato: i, nome_urna: `C${i}`, partido: "PX", votos: i * 10, eleito: i === 5 })),
    [{ id_candidatura: 2, patrimonio: 100, tinha: 0 }, { id_candidatura: 3, patrimonio: 100, tinha: 0 }, { id_candidatura: 4, patrimonio: 300, tinha: 0 }, { id_candidatura: 5, patrimonio: 900, tinha: 1 }],
  );
  it("quem não está na tabela declarou zero; empates no mesmo décimo e na mesma posição", () => {
    const c = classificar(cs);
    expect(c.map((x) => x.decil)).toEqual([0, 1, 1, 7, 10]);   // percent_rank: 0, 0, 2/3, 1
    expect(c.map((x) => x.posicao)).toEqual([5, 3, 3, 2, 1]);
    expect(c[4]).toMatchObject({ tinha_cargo: true, posVotos: 1, naDisputa: 5, comBens: 4 });
  });
  it("um só com bens fica no 1º décimo", () => {
    expect(classificar([cand({ patrimonio: 5 }), cand({ id_candidatura: 2 })]).map((x) => x.decil)).toEqual([1, 0]);
  });
});

describe("recorteDaDisputa", () => {
  const c = classificar([cand({ eleito: true, tinha_cargo: true, patrimonio: 9 }), cand({ id_candidatura: 2, patrimonio: 1 })]);
  it("tira quem tinha o cargo (vereador) ou a disputa inteira (prefeito)", () => {
    expect(recorteDaDisputa(c, { majoritario: false, semCargo: true })).toHaveLength(1);
    expect(recorteDaDisputa(c, { majoritario: true, semCargo: true })).toHaveLength(0);
    expect(recorteDaDisputa(c, { majoritario: true })).toHaveLength(2);
    expect(recorteDaDisputa(c.slice(1), { majoritario: true })).toHaveLength(0);   // um candidato só
  });
});

describe("escadaDeVotos", () => {
  it("um degrau por candidato, do menos ao mais rico, com a parte dos votos", () => {
    const d = escadaDeVotos(classificar([cand({ nome_urna: "MARIA DA SILVA", patrimonio: 900, votos: 75, eleito: true }), cand({ id_candidatura: 2, votos: 25 })]));
    expect(d.map((x) => [x.curto, x.taxa, x.eleitos, x.tipico])).toEqual([["A", 0.25, 0, 0], ["Maria", 0.75, 1, 900]]);
  });
});

describe("escadaDeCandidatos e disputaDeCandidatos", () => {
  const c = classificar([cand({ patrimonio: 900, eleito: true }), cand({ id_candidatura: 2, patrimonio: 100 }), cand({ id_candidatura: 3 })]);
  it("monta as posições com o típico e a disputa no formato da tabela", () => {
    const d = escadaDeCandidatos(c, { majoritario: true });
    expect(d.map((x) => [x.chave, x.eleitos, x.tipico])).toEqual([[0, 0, 0], [2, 0, 100], [1, 1, 900]]);
    expect(posicaoDoEleito(disputaDeCandidatos(c, { ano: 2024, cargo: "Prefeito", uf: "PE", id_municipio: 1 })!).categoria).toBe("primeiro");
  });
  it("nos décimos, cada candidato no seu décimo", () => {
    expect(escadaDeCandidatos(c, { majoritario: false }).map((x) => x.chave)).toEqual([0, 1, 10]);
  });
});

describe("medianasDoRecorte e medianasDeCandidatos", () => {
  it("lê a linha do recorte", () => {
    const l: LinhaMedianas = { ano: 2024, cargo: "Vereador", uf: "PE", sem_cargo: true, eleitos: 2, eleitos_sem_bens: 1, nao_eleitos: 3, nao_sem_bens: 2, mediana_eleitos: 5, mediana_nao: 1, mediana_todos: 2 };
    expect(medianasDoRecorte([l], { ano: 2024, cargo: "Vereador", uf: "PE" }, { semCargo: true })).toMatchObject({ medianaEleitos: 5, eleitosSemBens: 1 });
    expect(medianasDoRecorte([l], { ano: 2024, cargo: "Vereador", uf: "PE" })).toBeNull();
  });
  it("só quem declarou entra na mediana", () => {
    const m = medianasDeCandidatos([cand({ eleito: true, patrimonio: 10 }), cand({ eleito: true, patrimonio: 30 }), cand({ eleito: true }), cand({ patrimonio: 4 })]);
    expect(m).toMatchObject({ eleitos: 3, eleitosSemBens: 1, medianaEleitos: 20, medianaNao: 4, medianaTodos: 10 });
  });
});

describe("composicaoEleitos e topoDaComposicao", () => {
  it("junta os décimos em quatro grupos", () => {
    const d = escada([dec({ decil: 0, candidatos: 50, eleitos: 2 }), dec({ decil: 2, candidatos: 40, eleitos: 2 }), dec({ decil: 10, candidatos: 10, eleitos: 6 })], { anos: [2024], cargo: "Vereador" });
    const g = composicaoEleitos(d, { majoritario: false });
    expect(g.map((x) => x.chave)).toEqual(["sem", "baixo", "topo"]);
    expect(topoDaComposicao(g)).toMatchObject({ parteCandidatos: 0.1, parteEleitos: 0.6 });
  });
});

describe("concordancia e concordanciaDeCandidatos", () => {
  it("soma os pontos do recorte", () => {
    const p = (o: Partial<LinhaPares>): LinhaPares => ({ ano: 2024, cargo: "Vereador", uf: "PE", sem_cargo: false, pares: 10, pontos: 12, ...o });
    expect(concordancia([p({}), p({ uf: "RJ", pares: 10, pontos: 8 })], { anos: [2024], cargo: "Vereador" })).toEqual({ pares: 20, parte: 0.5 });
  });
  it("conta pares com votos diferentes; mesmo patrimônio vale meio; sem bens fora", () => {
    const c = [cand({ votos: 30, patrimonio: 9 }), cand({ votos: 20, patrimonio: 9 }), cand({ votos: 10, patrimonio: 1 }), cand({ votos: 10, patrimonio: 5 }), cand({ votos: 99 })];
    // pares: (30,20) empate=1; (30,10a)=2; (30,10b)=2; (20,10a)=2; (20,10b)=2; (10a,10b) votos iguais: fora
    expect(concordanciaDeCandidatos(c)).toEqual({ pares: 5, parte: 9 / 10 });
  });
});

describe("listaDe, listaDoRecorte e listaDeCandidatos", () => {
  it("valida a aba", () => {
    expect(listaDe("perderam")).toBe("perderam");
    expect(listaDe(["menos"])).toBe("menos");
    expect(listaDe("x")).toBe("ricos");
  });
  it("lê a lista do recorte em ordem", () => {
    const l = (o: Partial<LinhaLista>): LinhaLista => ({
      ano: 2024, cargo: "Vereador", uf: "PE", sem_cargo: false, lista: "ricos", pos: 1, id_candidato: 1, id_candidatura: 1, nome_urna: "A", partido: "PX",
      municipio: "RECIFE", patrimonio: 9, decil: 10, posicao: 1, na_disputa: 9, votos: 1, eleito: false, tinha_cargo: false, ...o,
    });
    expect(listaDoRecorte([l({ pos: 2, nome_urna: "B" }), l({}), l({ lista: "menos" })], { ano: 2024, cargo: "Vereador", uf: "PE" }, "ricos").map((x) => x.nome)).toEqual(["A", "B"]);
  });
  it("menos: sem bens primeiro, depois o menor patrimônio", () => {
    const c = classificar([cand({ id_candidatura: 1, eleito: true, patrimonio: 50 }), cand({ id_candidatura: 2, eleito: true, votos: 5 }), cand({ id_candidatura: 3, eleito: true, votos: 9 }), cand({ id_candidatura: 4, patrimonio: 900 })]);
    expect(listaDeCandidatos(c, "menos").map((x) => x.id_candidatura)).toEqual([3, 2, 1]);
    expect(listaDeCandidatos(c, "perderam").map((x) => x.id_candidatura)).toEqual([4]);
    expect(listaDeCandidatos(c, "ricos", 1)[0].id_candidatura).toBe(4);
  });
});

describe("escalaLista", () => {
  it("usa o 2º maior quando o 1º passa de 5 vezes ele, e marca o 1º", () => {
    const e = escalaLista([12e9, 26e6, 24e6]);
    expect(e.max).toBe(26e6);
    expect([e.foraDoComum(12e9), e.foraDoComum(26e6)]).toEqual([true, false]);
    expect(escalaLista([10, 8]).max).toBe(10);
    expect(escalaLista([]).max).toBe(1);
  });
});

describe("textoPosicao", () => {
  it("escreve a posição na disputa", () => {
    expect(textoPosicao({ patrimonio: 1, posicao: 1, naDisputa: 842 })).toBe("1º mais rico de 842");
    expect(textoPosicao({ patrimonio: 0, posicao: 9, naDisputa: 1200 })).toBe("sem bens declarados (1.200 candidatos)");
  });
});

describe("corDaMetade e legendaMetade", () => {
  it("diverge em torno do neutro 50–60% e hachura cidades pequenas", () => {
    expect([0.3, 0.45, 0.55, 0.65, 0.8].map((p) => corDaMetade(p, 100))).toEqual(["d0", "d1", "d2", "d3", "d4"]);
    expect(corDaMetade(0.8, 10)).toBe("poucos");
    expect(corDaMetade(null, 100)).toBe("sem");
    expect(legendaMetade().find((l) => l.classe === "d2")!.texto).toContain("pouca ou nenhuma relação");
  });
});

describe("corDaParteCidades e legendaPrefeito", () => {
  it("dá as faixas dos estados e as categorias do prefeito", () => {
    expect(corDaParteCidades(0.55)).toBe("q3");
    expect(corDaParteCidades(null)).toBe("sem");
    expect(legendaPrefeito().map((l) => l.classe)).toEqual(["p1", "p2", "p3", "psb", "fora"]);
  });
});

describe("as séries", () => {
  it("serieMetade e serieMetadeCidade percorrem as eleições do tipo", () => {
    const s = serieMetade([dec({ decil: 6, eleitos: 3 }), dec({ decil: 1, eleitos: 1 })], "Vereador", "PE");
    expect(s.map((x) => x.ano)).toEqual([2008, 2012, 2016, 2020, 2024]);
    expect(s.at(-1)).toEqual({ ano: 2024, valor: 0.75, n: 4 });
    expect(s[0].valor).toBeNull();
    expect(serieMetadeCidade([ver({})], 1).at(-1)!.valor).toBeCloseTo(4 / 6);
  });
  it("serieMaisRico e serieDisputa", () => {
    expect(serieMaisRico([disp({}), disp({ pos_eleito: 2 })], "Prefeito", "PE").at(-1)).toEqual({ ano: 2024, valor: 0.5, n: 2 });
    expect(serieDisputa([disp({ pos_eleito: 2 })], "Prefeito", "PE", 1).at(-1)!.p!.categoria).toBe("segundo");
    expect(serieDisputa([], "Prefeito", "PE", 1)[0].p).toBeNull();
  });
});

describe("fraseSerie e eixoSerie", () => {
  it("responde com o último ano e as duas linhas", () => {
    const com = [{ ano: 2018, valor: 0.85, n: 1 }, { ano: 2022, valor: 0.81, n: 1 }], sem = [{ ano: 2018, valor: 0.8, n: 1 }, { ano: 2022, valor: 0.53, n: 1 }];
    expect(fraseSerie(com, sem, "Deputado federal")).toBe("Em 2022, 8 em cada 10 eleitos estavam na metade mais rica; sem quem já tinha o cargo, 5 em cada 10");
    expect(fraseSerie([{ ano: 2024, valor: 0.53, n: 1 }], [{ ano: 2024, valor: 0.51, n: 1 }], "Prefeito")).toBe("Em 2024, o mais rico venceu em 53% das cidades; sem disputas com reeleição, 51%");
    expect(fraseSerie([{ ano: 2024, valor: 0.6, n: 1 }, { ano: 2020, valor: null, n: 0 }], null, "Vereador")).toBe("Em 2024, 6 em cada 10 eleitos estavam na metade mais rica");
    expect(fraseSerie([{ ano: 2012, valor: null, n: 0 }], null, "Prefeito")).toBeNull();
  });
  it("eixo pelos dados, com o 50% à vista para vereador e deputados", () => {
    expect(eixoSerie([0.53, 0.96], "Deputado federal")).toEqual({ min: 0.4, max: 1, marcas: [0.5, 1] });
    expect(eixoSerie([0.6, 0.66], "Vereador")).toEqual({ min: 0.4, max: 0.7, marcas: [0.5, 0.7] });
    expect(eixoSerie([0.45, 0.53], "Prefeito")).toEqual({ min: 0.4, max: 0.6, marcas: [0.4, 0.6] });
  });
});

describe("afastarRotulos", () => {
  it("desce os que encostam e sobe o grupo se passar do fim", () => {
    expect(afastarRotulos([10, 12, 50], 10)).toEqual([10, 20, 50]);
    expect(afastarRotulos([90, 95, 100], 10, 0, 100)).toEqual([80, 90, 100]);
    expect(afastarRotulos([], 10)).toEqual([]);
  });
});

describe("textos", () => {
  it("quemTinha, tituloP2 e valorTipico", () => {
    expect(quemTinha("Vereador")).toBe("quem já era vereador");
    expect(quemTinha("Prefeito")).toContain("reeleição");
    expect(tituloP2(2024)).toBe("Patrimônio e vitória em 2024");
    expect(tituloP2(2006)).toBe("Patrimônio e vitória em 2006");
    expect(valorTipico(57_000)).toBe("R$ 57 mil");
    expect(valorTipico(null)).toBe("—");
  });
  it("fraseTopo põe o recorte ligado primeiro", () => {
    expect(fraseTopo("Vereador", 0.14, 0.09, true)).toBe("Sem quem já era vereador, os 10% mais ricos se elegem 9 em cada 100 (com todos: 14).");
    expect(fraseTopo("Vereador", 0.14, null, false)).toBe("Com todos, os 10% mais ricos se elegem 14 em cada 100.");
    expect(fraseTopo("Prefeito", 0.53, 0.51, false)).toBe("Com todas as cidades, o mais rico venceu em 53 de cada 100 (sem as disputas com prefeito tentando a reeleição: 51).");
    expect(fraseTopo("Prefeito", 0.53, 0.51, true)).toBe("Sem as disputas com prefeito tentando a reeleição, o mais rico venceu em 51 de cada 100 (com todas as cidades: 53).");
    expect(fraseTopo("Vereador", null, 0.1, false)).toBeNull();
  });
  it("frasePosicao", () => {
    expect(frasePosicao(posicaoDoEleito(disp({ pos_eleito: 2 })))).toBe("O eleito era o 2º mais rico entre 4");
    expect(frasePosicao(posicaoDoEleito(disp({ candidatos: 1 })))).toBe("Fora da conta: um candidato só");
  });
});

describe("cardDoTopo", () => {
  const g = (o: Partial<GrupoComposicao>): GrupoComposicao => ({ chave: "topo", rotulo: "10% mais ricos", candidatos: 10, eleitos: 6, parteCandidatos: 0.07, parteEleitos: 0.31, cor: "q4", ...o });
  it("as partes dos eleitos e dos candidatos, com o título de cada tipo de cargo", () => {
    expect(cardDoTopo(g({}), { majoritario: false })).toEqual({ titulo: "Décimo mais rico", eleitos: 0.31, candidatos: 0.07 });
    expect(cardDoTopo(g({ chave: "1" }), { majoritario: true })?.titulo).toBe("O mais rico de cada disputa");
  });
  it("sem o grupo ou sem eleitos, nada", () => {
    expect(cardDoTopo(null, { majoritario: false })).toBeNull();
    expect(cardDoTopo(g({ eleitos: 0, parteEleitos: 0 }), { majoritario: false })).toBeNull();
  });
});

describe("vezesPatrimonio", () => {
  it("arredonda eleito ÷ não eleito; null se o não eleito for ≤ 0 ou faltar", () => {
    expect(vezesPatrimonio(978_000, 303_000)).toBe(3);
    expect(vezesPatrimonio(100, 0)).toBeNull();
    expect(vezesPatrimonio(100, -5)).toBeNull();
    expect(vezesPatrimonio(null, 10)).toBeNull();
  });
});

describe("cardOutraVariante", () => {
  it("com todos ativo: mostra a variante sem quem já tinha o cargo, comparada com a de todos", () => {
    expect(cardOutraVariante("Deputado estadual", false, "metade", 0.79, 0.68)).toEqual({
      titulo: "Sem quem já era deputado estadual", valor: "68%", unidade: "na metade mais rica", compara: "com todos: 79%",
    });
  });
  it("sem cargo ativo: mostra com todos; prefeito fala das cidades; sem a outra, null", () => {
    expect(cardOutraVariante("Deputado estadual", true, "metade", 0.68, 0.79)).toMatchObject({ titulo: "Com todos", valor: "79%", compara: "sem quem já era deputado estadual: 68%" });
    expect(cardOutraVariante("Prefeito", false, "vitoria", 0.53, 0.51)?.unidade).toBe("das cidades elegeram o mais rico");
    expect(cardOutraVariante("Vereador", false, "metade", 0.6, null)).toBeNull();
    expect(cardOutraVariante("Vereador", false, "metade", null, 0.6)?.compara).toBeNull();
  });
});

describe("rotuloRespostaP2", () => {
  it("diz qual número a resposta mostra", () => {
    expect(rotuloRespostaP2({ unica: true, prefeitoEstado: false })).toBe("Onde estava o eleito");
    expect(rotuloRespostaP2({ unica: false, prefeitoEstado: true })).toBe("O mais rico venceu?");
    expect(rotuloRespostaP2({ unica: false, prefeitoEstado: false })).toBe("Eleitos na metade mais rica");
  });
});

describe("marcasLog e naEscalaLog", () => {
  it("cobre os valores de 10 em 10", () => {
    const m = marcasLog([5_000, 2_000_000]);
    expect(m.marcas.map((x) => x.rotulo)).toEqual(["R$ 1 mil", "R$ 10 mil", "R$ 100 mil", "R$ 1 mi", "R$ 10 mi"]);
    expect(marcasLog([50, 5_000]).marcas[0].rotulo).toBe("R$ 1 mil");   // abaixo de R$ 1 mil encosta na ponta
    expect(naEscalaLog(1e5, m.min, m.max)).toBeCloseTo(0.5);
  });
});
