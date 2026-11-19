import { describe, expect, it } from "vitest";
import {
  cargoEquivalente, cargoNoAno, cargosDoAno, classeMapaVies, escolhaVies, fmtIdade, idadePorMunicipio, lerRelacao, lerSerie, medirIdade, medirVies, medirVotados, naReguaVies,
  paramsVies, parear, rotulosVies, serieVies, textoVies, viesPorMunicipio, votadosPorMunicipio,
  type LinhaEleitorado, type LinhaPopulacao, type LinhaVies, type LinhaVotados,
} from "../src/lib/vies";

const v = (o: Partial<LinhaVies>): LinhaVies => ({ ano: 2022, cargo: "Deputado federal", uf: "MG", cod_ibge: "3100001", votos: 100, votos_score: 100, soma_score: 1000, ...o });
const t = (o: Partial<LinhaVotados>): LinhaVotados => ({ ano: 2022, cargo: "Deputado federal", uf: "MG", cod_ibge: "3100001", votos: 100, votos_idade: 100, soma_idade: 4000, votos_jovem: 10, ...o });
const e = (o: Partial<LinhaEleitorado>): LinhaEleitorado => ({ ano: 2022, uf: "MG", cod_ibge: "3100001", eleitores: 100, soma_idade: 4000, jovens: 20, idosos: 30, ...o });
const p = (o: Partial<LinhaPopulacao>): LinhaPopulacao => ({ uf: "MG", cod_ibge: "3100001", pessoas: 200, soma_idade: 9000, jovens: 50, idosos: 40, ...o });

describe("cargoNoAno", () => {
  it("cargo fora do ciclo não existe no ano", () => {
    expect(cargoNoAno("senador", 2020)).toBeNull();
    expect(cargoNoAno("prefeito", 2020)).toBe("Prefeito");
  });
  it("cargoEquivalente troca de ciclo sem perder o tipo de cargo", () => {
    expect(cargoEquivalente("dep-estadual", 2020)).toBe("vereador");
    expect(cargoEquivalente("prefeito", 2022)).toBe("governador");
    expect(cargoEquivalente("senador", 2018)).toBe("senador");
    expect(cargoEquivalente("presidente", 2024)).toBe("prefeito");
  });
  it("cargosDoAno lista os do ciclo", () => {
    expect(cargosDoAno(2020).map((c) => c.chave)).toEqual(["vereador", "prefeito"]);
    expect(cargosDoAno(2022).map((c) => c.chave)).toEqual(["presidente", "dep-federal", "dep-estadual", "senador", "governador"]);
  });
});

describe("escolhaVies", () => {
  it("padrões: viés, 2022, deputado federal, idade média do eleitorado, eixo dos votados", () => {
    expect(escolhaVies({})).toEqual({ sub: "vies", ano: 2022, cargo: "dep-federal", med: "media", fonte: "eleitorado", eixo: "votados" });
  });
  it("nos anos municipais o padrão é o vereador", () => {
    expect(escolhaVies({ ano: "2024" }).cargo).toBe("vereador");
  });
  it("ignora ano fora da lista e cargo que não houve no ano", () => {
    expect(escolhaVies({ ano: "2016", cargo: "senador" })).toMatchObject({ ano: 2022, cargo: "senador" });
    expect(escolhaVies({ ano: "2024", cargo: "senador" })).toMatchObject({ ano: 2024, cargo: "prefeito" });
  });
  it("o Censo só vale de 2020 a 2024", () => {
    expect(escolhaVies({ ver: "idade", fonte: "censo", ano: "2024" }).fonte).toBe("censo");
    expect(escolhaVies({ ver: "idade", fonte: "censo", ano: "2018" }).fonte).toBe("eleitorado");
  });
});

describe("paramsVies", () => {
  it("só escreve o que foge do padrão; o município só vai com o estado", () => {
    const esc = escolhaVies({ ver: "idade", eixo: "vies" });
    expect(paramsVies(esc, { uf: "MG", mun: "3100001" }).toString()).toBe("ver=idade&uf=MG&mun=3100001&eixo=vies");
    expect(paramsVies(escolhaVies({ cargo: "governador", med: "jovens" }), { mun: "3100001" }).toString()).toBe("ver=vies&cargo=governador");
    // trocar para um ano municipal leva o governador ao prefeito e o Censo de volta ao eleitorado fora de 2020–2024
    expect(paramsVies({ ...escolhaVies({ cargo: "governador" }), ano: 2024 }, {}).toString()).toBe("ver=vies&ano=2024&cargo=prefeito");
    expect(paramsVies({ ...escolhaVies({ ver: "idade", fonte: "censo" }), ano: 2026 }, {}).toString()).toBe("ver=idade&ano=2026");
    // o deputado federal vira vereador no ano municipal, que é o padrão dele: não vai para a URL
    expect(paramsVies({ ...escolhaVies({}), ano: 2020 }, {}).toString()).toBe("ver=vies&ano=2020");
  });
});

describe("medirVies", () => {
  const linhas = [v({}), v({ cod_ibge: "3100002", votos: 300, votos_score: 200, soma_score: -2000 }), v({ uf: "RJ", cod_ibge: "3300001", soma_score: 5000 }), v({ ano: 2018 })];
  it("pondera pelos votos com score e mede a cobertura", () => {
    const m = medirVies(linhas, 2022, "Deputado federal", { uf: "MG" });
    expect(m.score).toBeCloseTo(-1000 / 300);
    expect(m.cobertura).toBeCloseTo(300 / 400);
  });
  it("sem votos com score, o viés é nulo", () => {
    expect(medirVies([v({ votos_score: 0, soma_score: 0 })], 2022, "Deputado federal").score).toBeNull();
    expect(medirVies(linhas, 2022, "Senador").cobertura).toBeNull();
  });
  it("viesPorMunicipio dá a média de cada um", () => {
    expect(viesPorMunicipio(linhas, 2022, "Deputado federal").get("3100002")).toBe(-10);
  });
});

describe("serieVies", () => {
  const linhas = [v({ ano: 2018, soma_score: 2000 }), v({ ano: 2020, cargo: "Vereador", soma_score: 1500 }), v({}), v({ ano: 2022, cargo: "Senador", soma_score: 3000 })];
  it("só os anos do cargo, sem misturar com o vereador", () => {
    expect(serieVies(linhas, "dep-federal")).toEqual([{ ano: 2018, cargo: "Deputado federal", score: 20 }, { ano: 2022, cargo: "Deputado federal", score: 10 }]);
    expect(serieVies(linhas, "vereador")).toEqual([{ ano: 2020, cargo: "Vereador", score: 15 }]);
  });
  it("um cargo só tem os anos do ciclo dele", () => {
    expect(serieVies(linhas, "senador")).toEqual([{ ano: 2022, cargo: "Senador", score: 30 }]);
  });
});

describe("medirIdade", () => {
  const dados = { eleitorado: [e({}), e({ cod_ibge: "3100002", eleitores: 300, soma_idade: 15000, jovens: 30, idosos: 90 }), e({ ano: 2018 })], populacao: [p({})] };
  it("eleitorado do ano, ponderado pelos eleitores", () => {
    expect(medirIdade("eleitorado", dados, 2022, "media", { uf: "MG" })).toBe(19000 / 400);
    expect(medirIdade("eleitorado", dados, 2022, "jovens")).toBe(50 / 400);
    expect(medirIdade("eleitorado", dados, 2022, "idosos", { ibge: "3100002" })).toBe(0.3);
  });
  it("Censo: o mesmo em qualquer ano", () => {
    expect(medirIdade("censo", dados, 2024, "media")).toBe(45);
  });
  it("sem eleitores, nulo", () => {
    expect(medirIdade("eleitorado", dados, 2026, "media")).toBeNull();
  });
  it("idadePorMunicipio", () => {
    expect([...idadePorMunicipio("eleitorado", dados, 2022, "media")]).toEqual([["3100001", 40], ["3100002", 50]]);
  });
});

describe("medirVotados", () => {
  const linhas = [t({}), t({ cod_ibge: "3100002", votos: 100, votos_idade: 50, soma_idade: 3000, votos_jovem: 0 })];
  it("idade só com os votos de quem tem idade; jovens sobre todos os votos", () => {
    const m = medirVotados(linhas, 2022, "Deputado federal");
    expect(m.idade).toBeCloseTo(7000 / 150);
    expect(m.jovem).toBe(10 / 200);
  });
  it("votadosPorMunicipio", () => {
    expect(votadosPorMunicipio(linhas, 2022, "Deputado federal").get("3100002")).toBe(60);
  });
});

describe("parear", () => {
  it("só os municípios com os dois valores, marcando o escolhido", () => {
    const xs = new Map([["1", 10], ["2", 20], ["3", 30]]), ys = new Map([["1", 1], ["3", 3]]);
    expect(parear(xs, ys, ["1", "2", "3"], "3")).toEqual([{ id: 1, x: 10, y: 1, on: false }, { id: 3, x: 30, y: 3, on: true }]);
  });
});

describe("classeMapaVies", () => {
  it("nove degraus, com o centro entre −5 e +5", () => {
    expect([-60, -45, -20, -5.1, 0, 4.9, 5, 29, 30, 70].map(classeMapaVies)).toEqual(["dv0", "dv1", "dv2", "dv3", "dv4", "dv4", "dv5", "dv6", "dv7", "dv8"]);
    expect(classeMapaVies(null)).toBe("sem");
  });
  it("rótulos da legenda", () => {
    const r = rotulosVies();
    expect(r).toHaveLength(9);
    expect([r[0], r[4], r[8]]).toEqual(["−45 ou menos", "−5 a +5", "+45 ou mais"]);
  });
  it("naReguaVies cai no degrau da cor", () => {
    expect(naReguaVies(0)).toBeCloseTo(4.5 / 9);
    expect(naReguaVies(-100)).toBe(0);
    expect(naReguaVies(100)).toBe(1);
  });
});

describe("textos", () => {
  it("textoVies usa as faixas do Legislativo", () => {
    expect(textoVies(18.44)).toBe("+18,4 · Centro");
    expect(textoVies(-25)).toBe("−25,0 · Centro-esquerda");
    expect(textoVies(null)).toBe("sem dado");
  });
  it("fmtIdade", () => {
    expect(fmtIdade(42.34, "media")).toBe("42,3 anos");
    expect(fmtIdade(0.236, "jovens")).toBe("24%");
  });
  it("lerRelacao", () => {
    expect(lerRelacao(0.05, "a idade", "o viés")).toBe("Quase nenhuma relação entre a idade e o viés");
    expect(lerRelacao(-0.35, "a idade", "o viés")).toBe("Relação moderada: onde a idade é maior, o viés tende a ser menor");
  });
  it("lerSerie", () => {
    expect(lerSerie([{ ano: 2018, score: 10 }, { ano: 2026, score: 16.2 }])).toBe("De 2018 a 2026, o viés foi 6,2 pontos para a direita (+10,0 → +16,2).");
    expect(lerSerie([{ ano: 2018, score: 10 }, { ano: 2022, score: 10.4 }])).toMatch(/praticamente igual/);
    expect(lerSerie([{ ano: 2018, score: 10 }])).toBeNull();
  });
});
