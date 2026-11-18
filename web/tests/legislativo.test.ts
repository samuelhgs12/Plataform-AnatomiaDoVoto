import { describe, expect, it } from "vitest";
import {
  bancadas, caixaDoContorno, cadeirasDaCasa, chaveCasa, classeCusto, classePartido, classeVies, espalhar, fileiras, fmtVies, hemiciclo, lerCasa, legislatura,
  gruposDaLista, lugares, mediana, nomeCasa, faixaVies, ordenarCadeiras, posicaoNaEscala, raioInterno, RAIO_MAX_CADEIRA, textoCentral, quartis, resumo, semResultado, siglaNaComposicao, siglasNoArco, vagasDaCasa,
  type LinhaCadeira, type LinhaGastoPartido,
} from "../src/lib/legislativo";

const c = (o: Partial<LinhaCadeira>): LinhaCadeira => ({
  ano: 2022, casa: "camara", uf: "MG", ano_eleicao: 2022, id_candidato: 1, id_candidatura: 1, nome: "FULANO", sigla: "PX",
  score: 0, erro_padrao: 3, fonte: "bls", gasto: 1000, renovacao: "estreante", ...o,
});
const g = (o: Partial<LinhaGastoPartido>): LinhaGastoPartido => ({
  ano_eleicao: 2022, casa: "camara", uf: "MG", sigla: "PX", candidatos: 10, eleitos: 1, sem_prestacao: 0, gasto: 5000, ...o,
});

describe("lerCasa", () => {
  it("aceita senado, câmara e as assembleias dos seis estados; o resto é ignorado", () => {
    expect(lerCasa("senado")).toEqual({ casa: "senado" });
    expect(lerCasa("al-mg")).toEqual({ casa: "assembleia", uf: "MG" });
    expect(lerCasa("al-sp")).toBeNull();
    expect(lerCasa(undefined)).toBeNull();
    expect(chaveCasa({ casa: "assembleia", uf: "PE" })).toBe("al-pe");
  });
});

describe("nomeCasa e legislatura", () => {
  it("dá o nome oficial com a preposição do estado", () => {
    expect(nomeCasa({ casa: "camara" })).toBe("Câmara dos Deputados");
    expect(nomeCasa({ casa: "assembleia", uf: "RJ" })).toBe("Assembleia Legislativa do Rio de Janeiro");
    expect(nomeCasa({ casa: "assembleia", uf: "MG" })).toBe("Assembleia Legislativa de Minas Gerais");
    expect(legislatura(2022)).toBe("2023–2027");
  });
});

describe("cadeirasDaCasa", () => {
  it("filtra a casa e o ano e ordena da esquerda para a direita, sem viés por último", () => {
    const linhas = [c({ nome: "B", score: 40 }), c({ nome: "A", score: -50 }), c({ nome: "N", score: null }), c({ nome: "X", ano: 2018 }), c({ nome: "S", casa: "senado" })];
    expect(cadeirasDaCasa(linhas, 2022, { casa: "camara" }).map((l) => l.nome)).toEqual(["A", "B", "N"]);
    expect(cadeirasDaCasa([c({ uf: "RJ", casa: "assembleia" }), c({ casa: "assembleia" })], 2022, { casa: "assembleia", uf: "RJ" })).toHaveLength(1);
  });
});

describe("semResultado e vagasDaCasa", () => {
  it("lista os estados sem resultado e soma as vagas", () => {
    expect(semResultado([{ ano: 2026, casa: "camara", uf: "AP", candidatos: 91 }], 2026, { casa: "camara" })).toEqual(["AP"]);
    expect(semResultado([{ ano: 2026, casa: "camara", uf: "AP", candidatos: 91 }], 2022, { casa: "camara" })).toEqual([]);
    const v = [{ ano: 2022, casa: "camara" as const, uf: "MG", vagas: 53 }, { ano: 2022, casa: "camara" as const, uf: "AP", vagas: 8 }];
    expect(vagasDaCasa(v, 2022, { casa: "camara" })).toBe(61);
    expect(vagasDaCasa(v, 2022, { casa: "camara" }, ["AP"])).toBe(8);
  });
});

describe("hemiciclo", () => {
  it("põe n cadeiras no semicírculo, da esquerda para a direita", () => {
    const { pontos, raio } = hemiciclo(513);
    expect(pontos).toHaveLength(513);
    expect(raio).toBeGreaterThan(0);
    expect(pontos[0].x).toBeLessThan(0);
    expect(pontos.at(-1)!.x).toBeGreaterThan(0);
    expect(pontos.every((p) => p.y <= 1e-9 && Math.hypot(p.x, p.y) <= 1 + 1e-9)).toBe(true);
    expect(hemiciclo(1).pontos).toEqual([{ x: expect.closeTo(0), y: -1 }]);
    expect(hemiciclo(0).pontos).toEqual([]);
  });
  it("tem mais fileiras quanto mais cadeiras", () => {
    expect(fileiras(18)).toBe(2);
    expect(fileiras(81)).toBe(5);
    expect(fileiras(513)).toBe(12);
  });
});

describe("espalhar e lugares", () => {
  it("espalha por igual, na ordem", () => {
    expect(espalhar(2, 10)).toEqual([2, 7]);
    expect(espalhar(3, 3)).toEqual([0, 1, 2]);
    expect(espalhar(0, 5)).toEqual([]);
  });
  it("mantém a ordem dos eleitos e marca as cadeiras sem resultado e as de fora", () => {
    const eleitos = [c({ nome: "A" }), c({ nome: "B" })];
    const l = lugares(eleitos, 6, 2);
    expect(l).toHaveLength(6);
    expect(l.filter((x) => x.tipo === "eleito").map((x) => x.tipo === "eleito" && x.cadeira.nome)).toEqual(["A", "B"]);
    expect(l.filter((x) => x.tipo === "sem_resultado")).toHaveLength(2);
    expect(l.filter((x) => x.tipo === "fora")).toHaveLength(2);
    expect(lugares(eleitos, 0)).toHaveLength(2);   // nunca menos lugares que eleitos
  });
});

describe("siglasNoArco", () => {
  it("põe a sigla no ângulo médio e pula as que encostam numa já posta", () => {
    const s = siglasNoArco([{ bancada: 0, angulos: [3, 2.8] }, { bancada: 1, angulos: [2.85] }, { bancada: 2, angulos: [0.5] }, { bancada: 3, angulos: [] }]);
    expect(s.map((x) => x.bancada)).toEqual([0, 2]);
    expect(s[0].angulo).toBeCloseTo(2.9);
  });
});

describe("classes de cor", () => {
  it("separa o viés em cinco faixas iguais, com cortes simétricos em ±20 e ±60", () => {
    expect([-80, -60, -45, -20, 0, 20, 45, 60, 80].map(faixaVies)).toEqual(["e", "ce", "ce", "c", "c", "c", "cd", "cd", "d"]);
    expect(classeVies(-69)).toBe("v-e");
    expect(classeVies(null)).toBe("v-nd");
  });
  it("põe o gasto no quarto da casa", () => {
    const q = quartis([1, 2, 3, 4, 5])!;
    expect(q).toEqual([2, 3, 4]);
    expect([1, 3, 3.5, 9].map((v) => classeCusto(v, q))).toEqual(["c-1", "c-2", "c-3", "c-4"]);
    expect(classeCusto(null, q)).toBe("c-nd");
    expect(quartis([])).toBeNull();
  });
  it("usa a cor do partido pela sigla, cinza se não houver", () => {
    expect(classePartido("PC do B")).toBe("par-pcdob");
    expect(classePartido("UNIÃO")).toBe("par-uniao");
    expect(classePartido("XYZ")).toBe("par-outro");
  });
});

describe("bancadas", () => {
  it("agrupa na ordem do hemiciclo e calcula o custo por cadeira com todas as campanhas do partido", () => {
    const cads = [
      c({ sigla: "PE", score: -50, gasto: 100, renovacao: "reeleito" }),
      c({ sigla: "PE", score: -50, gasto: 300 }),
      c({ sigla: "PD", score: 40, gasto: null, renovacao: "ja_eleito" }),
    ];
    const b = bancadas(cads, [g({ sigla: "PE", gasto: 1000, candidatos: 9 }), g({ sigla: "PD", gasto: 600 }), g({ sigla: "PE", uf: "RJ", gasto: 9999 })], 2022, { casa: "camara", uf: undefined });
    expect(b.map((x) => x.sigla)).toEqual(["PE", "PD"]);
    // PE: 1000 + 9999 (RJ entra: é a Câmara toda) ÷ 2 cadeiras
    expect(b[0]).toMatchObject({ cadeiras: 2, gastoMediano: 200, custoPorCadeira: 5499.5, reeleitos: 1, estreantes: 1, candidatos: 19 });
    expect(b[1]).toMatchObject({ gastoMediano: null, custoPorCadeira: 600, jaEleitos: 1 });
  });
  it("no Senado, o custo por cadeira só divide pelas cadeiras ganhas no ano", () => {
    const cads = [c({ casa: "senado", sigla: "PS", ano_eleicao: 2018, gasto: null }), c({ casa: "senado", sigla: "PS" })];
    const [b] = bancadas(cads, [g({ casa: "senado", sigla: "PS", gasto: 800 })], 2022, { casa: "senado" });
    expect(b).toMatchObject({ cadeiras: 2, ganhasNoAno: 1, custoPorCadeira: 800 });
    const [so] = bancadas([c({ casa: "senado", sigla: "PS", ano_eleicao: 2018 })], [], 2022, { casa: "senado" });
    expect(so.custoPorCadeira).toBeNull();
  });
});

describe("resumo", () => {
  it("dá o viés médio, as cadeiras por faixa e o custo da cadeira sem os estados sem resultado", () => {
    const cads = [c({ score: -40 }), c({ score: 5 }), c({ score: 50, renovacao: "reeleito" })];
    const r = resumo(cads, [g({ gasto: 3000, eleitos: 3 }), g({ uf: "AP", gasto: 500, eleitos: 0 })], 2022, { casa: "camara" }, ["AP"]);
    expect(r.viesMedio).toBeCloseTo(5);
    expect(r.porFaixa).toEqual({ e: 0, ce: 1, c: 1, cd: 1, d: 0 });
    expect(r.custoCadeira).toBe(1000);
    expect(r.reeleitos).toBe(1);
    expect(resumo([], [], 2022, { casa: "camara" }).custoCadeira).toBeNull();
  });
});

describe("mediana e fmtVies", () => {
  it("formata e resume", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([])).toBeNull();
    expect(fmtVies(13.94)).toBe("+13,9");
    expect(fmtVies(-69.11, 0)).toBe("−69");
    expect(fmtVies(-0.01)).toBe("0,0");
    expect(fmtVies(null)).toBe("—");
  });
});

describe("siglaNaComposicao", () => {
  it("usa o nome em vigor no ano, só para quem mudou de nome", () => {
    expect(siglaNaComposicao("PMDB", 2018)).toBe("MDB");
    expect(siglaNaComposicao("PRB", 2018)).toBe("PRB");
    expect(siglaNaComposicao("PRB", 2022)).toBe("REPUBLICANOS");
    expect(siglaNaComposicao("PCDOB", 2026)).toBe("PC do B");
    expect(siglaNaComposicao("PHS", 2022)).toBe("PHS");   // incorporado pelo PODE: não é o mesmo partido
  });
});

describe("posicaoNaEscala", () => {
  it("põe o viés na barra, linear de −100 a +100", () => {
    expect(posicaoNaEscala(-100)).toBe(0);
    expect(posicaoNaEscala(0)).toBeCloseTo(0.5);
    expect(posicaoNaEscala(100)).toBe(1);
    expect(posicaoNaEscala(20)).toBeCloseTo(0.6);
    expect(posicaoNaEscala(250)).toBe(1);
  });
  it("bancada com nomes juntados tem o viés médio das cadeiras", () => {
    const [b] = bancadas([c({ sigla: "R", score: 40 }), c({ sigla: "R", score: 50 })], [], 2022, { casa: "camara" });
    expect(b.score).toBe(45);
  });
});

describe("hemiciclo sem sobreposição", () => {
  it("em qualquer tamanho de casa, nenhuma cadeira encosta em outra e o raio tem teto", () => {
    for (const n of [3, 18, 24, 30, 70, 77, 81, 142, 150, 274, 513]) {
      const { pontos, raio } = hemiciclo(n);
      expect(raio).toBeLessThanOrEqual(RAIO_MAX_CADEIRA);
      let menor = Infinity;
      for (let i = 0; i < pontos.length; i++) for (let j = i + 1; j < pontos.length; j++)
        menor = Math.min(menor, Math.hypot(pontos[i].x - pontos[j].x, pontos[i].y - pontos[j].y));
      expect(menor, `n=${n}`).toBeGreaterThanOrEqual(2 * raio * 1.1);
    }
  });
  it("casas pequenas têm vão central maior", () => {
    expect(raioInterno(24)).toBeGreaterThan(raioInterno(513));
  });
});

describe("textoCentral", () => {
  it("encolhe o número e a legenda até caberem no vão", () => {
    const largo = textoCentral(200, "+12,9", "viés médio: centro");
    expect(largo).toEqual({ numero: 96, legenda: 24 });
    const estreito = textoCentral(90, "R$ 2,3 mi", "custo de uma cadeira");
    expect(estreito.numero).toBeLessThan(96);
    expect(estreito.legenda).toBeLessThan(24);
    // o número cabe na largura do arco interno na altura dele
    const topo = estreito.legenda * 1.6 + estreito.numero * 0.78;
    expect("R$ 2,3 mi".length * estreito.numero * 0.6 / 2).toBeLessThanOrEqual(Math.sqrt(90 * 90 - topo * topo));
  });
});

describe("ordenarCadeiras", () => {
  const cads = [
    c({ nome: "A", renovacao: "estreante", gasto: 300 }), c({ nome: "B", renovacao: "reeleito", gasto: null }),
    c({ nome: "C", renovacao: "ja_eleito", gasto: 100 }), c({ nome: "D", renovacao: "reeleito", gasto: 200 }),
  ];
  const nomes = (l: LinhaCadeira[]) => l.map((x) => x.nome);
  it("na Renovação, forma blocos contíguos mantendo a ordem do viés dentro de cada um", () => {
    expect(nomes(ordenarCadeiras(cads, "renovacao"))).toEqual(["B", "D", "C", "A"]);
  });
  it("no Custo, ordena pelo gasto com os sem dado no fim; padrão mantém a ordem", () => {
    expect(nomes(ordenarCadeiras(cads, "custo", "maior"))).toEqual(["A", "D", "C", "B"]);
    expect(nomes(ordenarCadeiras(cads, "custo", "menor"))).toEqual(["C", "D", "A", "B"]);
    expect(nomes(ordenarCadeiras(cads, "custo"))).toEqual(["A", "B", "C", "D"]);
    expect(nomes(ordenarCadeiras(cads, "vies", "maior"))).toEqual(["A", "B", "C", "D"]);
  });
});

describe("gruposDaLista", () => {
  const cads = [
    c({ nome: "ZÉ", sigla: "PE", score: -70, renovacao: "reeleito" }), c({ nome: "ANA", sigla: "PE", score: -70, renovacao: "estreante" }),
    c({ nome: "BIA", sigla: "PD", score: 40, renovacao: "reeleito" }),
  ];
  it("agrupa por bancada na ordem do hemiciclo, com os nomes em ordem", () => {
    expect(gruposDaLista(cads, "vies").map((g) => [g.titulo, g.cadeiras.map((x) => x.nome)])).toEqual([["PE", ["ANA", "ZÉ"]], ["PD", ["BIA"]]]);
  });
  it("na Renovação agrupa pelos blocos e omite os vazios", () => {
    expect(gruposDaLista(cads, "renovacao").map((g) => [g.chave, g.cadeiras.length])).toEqual([["reeleito", 2], ["estreante", 1]]);
  });
  it("respeita o filtro de faixa", () => {
    expect(gruposDaLista(cads, "custo", "cd").map((g) => g.titulo)).toEqual(["PD"]);
  });
});

describe("caixaDoContorno", () => {
  it("enquadra o contorno num quadrado centralizado, com margem", () => {
    const c = caixaDoContorno("M10 20L30 20L30 60L10 60Z", 0);
    expect(c).toEqual({ x: 0, y: 20, largura: 40, altura: 40 });
    expect(caixaDoContorno("M0 0L10 0L10 10Z", 0.1).largura).toBeCloseTo(12);
    expect(caixaDoContorno("")).toEqual({ x: 0, y: 0, largura: 1, altura: 1 });
  });
});
